// Imported exclusively by Next.js route handlers. Never import from client code.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { initialReadingState, deriveReading, applyReadingAction } from "../reading.js";
import { ReadingHttpError, assertReadingAccess, readingClassId, readingPeriodBounds, readingPeriodXp, sortReadingRankings } from "./readingPolicy.js";

function readingAdmin() {
  const existing = getApps().find((app) => app.name === "reading-suite");
  if (existing) return existing;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && projectId) {
    return initializeApp({ projectId }, "reading-suite");
  }
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, "reading-suite");
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) }, "reading-suite");
  }
  throw new ReadingHttpError("책나눔 서버 인증 설정이 필요합니다. 담당 교사에게 문의해 주세요.", 503, "reading/server-not-configured");
}

export async function readingPrincipal(request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 8192) throw new ReadingHttpError("로그인이 필요합니다.", 401, "reading/unauthenticated");
  const app = readingAdmin();
  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    if (decoded.firebase?.sign_in_provider === "anonymous") throw new Error("anonymous");
    return { uid: decoded.uid, roleClaim: decoded.role || null, db: getFirestore(app) };
  } catch {
    throw new ReadingHttpError("로그인을 다시 확인해 주세요.", 401, "reading/unauthenticated");
  }
}

async function accessInTransaction(tx, db, principal, classId) {
  const [classSnap, profileSnap, memberSnap] = await tx.getAll(
    db.doc(`classes/${classId}`),
    db.doc(`users/${principal.uid}`),
    db.doc(`memberships/${principal.uid}_${classId}`)
  );
  const profile = profileSnap.exists ? profileSnap.data() : null;
  assertReadingAccess({
    ...principal,
    profile,
    classDoc: classSnap.exists ? { ...classSnap.data(), id: classId } : null,
    membership: memberSnap.exists ? memberSnap.data() : null,
  });
  return profile;
}

function stateFromSnapshot(snap) {
  return snap.exists ? snap.data().state || initialReadingState() : initialReadingState();
}

function readingResult(state, now, replayed = false) {
  return { state, summary: deriveReading(state, now), replayed };
}

export async function getReading(principal, selectedClassId) {
  const classId = readingClassId(selectedClassId);
  const { db, uid } = principal;
  return db.runTransaction(async (tx) => {
    await accessInTransaction(tx, db, principal, classId);
    const snap = await tx.get(db.doc(`users/${uid}/reading/main`));
    return readingResult(stateFromSnapshot(snap), new Date());
  }, { readOnly: true });
}

export async function mutateReading(principal, payload) {
  const classId = readingClassId(payload?.classId);
  const action = payload?.action;
  const requestId = payload?.requestId;
  if (!action || typeof action !== "object" || Array.isArray(action)) throw new ReadingHttpError("변경할 내용을 확인해 주세요.");
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) throw new ReadingHttpError("요청 식별자가 올바르지 않습니다.");
  const actionHash = createHash("sha256").update(JSON.stringify({ classId, action })).digest("hex");
  const { db, uid } = principal;
  const stateRef = db.doc(`users/${uid}/reading/main`);
  const receiptRef = db.doc(`users/${uid}/readingRequests/${requestId}`);
  const now = new Date();
  return db.runTransaction(async (tx) => {
    await accessInTransaction(tx, db, principal, classId);
    const [snap, receipt] = await tx.getAll(stateRef, receiptRef);
    const state = stateFromSnapshot(snap);
    if (receipt.exists) {
      if (receipt.data().actionHash !== actionHash) throw new ReadingHttpError("같은 요청 식별자로 다른 내용을 보낼 수 없습니다.", 409, "reading/request-conflict");
      return readingResult(state, now, true);
    }
    let next;
    try {
      next = applyReadingAction(state, action, { uid, classId, now: now.toISOString(), id: requestId });
    } catch (error) {
      throw new ReadingHttpError(error?.message || "독서 기록을 확인해 주세요.");
    }
    // A correction can change streak or badge attribution in another class. Keep
    // each affected class's minimal ranking snapshot consistent in the same commit.
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > 750000) {
      throw new ReadingHttpError("저장 공간이 가득 찼습니다. 불필요한 독서 기록을 정리해 주세요.", 413, "reading/state-too-large");
    }
    const before = deriveReading(state, now);
    const summary = deriveReading(next, now);
    const affectedClasses = new Set([classId, ...before.events.map((e) => e.classId), ...summary.events.map((e) => e.classId)]);
    affectedClasses.delete(null);
    affectedClasses.delete(undefined);
    affectedClasses.delete("");
    if (affectedClasses.size > 25) throw new ReadingHttpError("독서 기록에 연결된 반이 너무 많습니다.");
    tx.set(stateRef, { state: next, updatedAt: FieldValue.serverTimestamp() });
    for (const affectedId of affectedClasses) {
      readingClassId(affectedId);
      tx.set(db.doc(`classes/${affectedId}/readingMembers/${uid}`), {
        uid,
        level: summary.level,
        featuredBadge: typeof summary.featuredBadge === "string" ? summary.featuredBadge : summary.featuredBadge?.id || null,
        events: summary.events.filter((e) => e.classId === affectedId).map((e) => ({ date: e.date, xp: e.xp })),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(receiptRef, { classId, actionHash, createdAt: FieldValue.serverTimestamp() });
    return { state: next, summary, replayed: false };
  });
}

export async function getReadingRankings(principal, selectedClassId, period = "weekly") {
  const classId = readingClassId(selectedClassId);
  const now = new Date();
  readingPeriodBounds(period, now);
  const { db } = principal;
  return db.runTransaction(async (tx) => {
    await accessInTransaction(tx, db, principal, classId);
    const [membersSnap, rankingsSnap] = await Promise.all([
      tx.get(db.collection("memberships").where("classId", "==", classId)),
      tx.get(db.collection(`classes/${classId}/readingMembers`)),
    ]);
    const ids = [...new Set(membersSnap.docs.map((d) => d.data().uid).filter((id) => typeof id === "string" && id && !id.includes("/")))];
    if (!ids.length) return { rankings: [], period };
    const profileSnaps = await tx.getAll(...ids.map((id) => db.doc(`users/${id}`)));
    const snapshots = new Map(rankingsSnap.docs.map((d) => [d.id, d.data()]));
    const rows = profileSnaps.filter((s) => s.exists && (s.data().role || "student") === "student").map((s) => {
      const profile = s.data();
      const reading = snapshots.get(s.id);
      return {
        uid: s.id,
        name: String(profile.realName || "이름 미설정").slice(0, 40),
        studentId: String(profile.studentId || "").slice(0, 20),
        level: reading?.level || 1,
        xp: readingPeriodXp(reading?.events, period, now),
        featuredBadge: reading?.featuredBadge || null,
      };
    });
    return { rankings: sortReadingRankings(rows), period };
  }, { readOnly: true });
}

export function readingErrorResponse(error) {
  if (error instanceof ReadingHttpError) return { status: error.status, body: { error: error.message, code: error.code } };
  // Never expose credential, Admin SDK, or Firestore internals in API responses.
  console.error("[reading] request failed", error?.code || error?.name || "unknown");
  return { status: 500, body: { error: "책나눔 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "reading/internal" } };
}
