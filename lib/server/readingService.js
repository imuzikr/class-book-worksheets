// Imported exclusively by Next.js route handlers. Never import from client code.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { initialReadingState, deriveReading, applyReadingAction, kstToday, readingFruitGains, READING_FORMULA } from "../reading.js";
import { memberSnapshot, memberStats } from "../readingJourney.js";
import { characterChoiceEnabled, hasCurrentReadingSnapshot, normalizeReadingCharacter } from "../readingCharacter.js";
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

function readingResult(state, now, replayed = false, fruits = []) {
  return { state, summary: deriveReading(state, now, { fruits }), replayed, fruits };
}

// 과일 경험치 — 그 학생이 든 반들의 지급 이력(classes/{c}/rewardEvents where uid)에서
// '경험치로 칠 과일'을 날짜별로 셉니다(lib/reading.js의 readingFruitGains).
// 트랜잭션 밖에서 읽습니다 — 과일 이력은 독서 기록과 따로 쌓여 같은 커밋에 묶을 까닭이 없습니다.
async function fruitsFor(db, uid) {
  const members = await db.collection("memberships").where("uid", "==", uid).get();
  const classIds = [...new Set(members.docs.map((d) => d.data().classId).filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id)))].slice(0, 25);
  const snaps = await Promise.all(classIds.map((c) => db.collection(`classes/${c}/rewardEvents`).where("uid", "==", uid).get()));
  const events = snaps.flatMap((snap) => snap.docs.map((d) => {
    const data = d.data();
    return { classId: data.classId, delta: data.delta, at: data.at?.toDate ? data.at.toDate() : null };
  }));
  return readingFruitGains(events);
}

// 반 집계(리더보드 · 랭킹이 읽음) — 한 학생의 요약을 관련된 반마다 한 장씩.
function writeMemberSnapshots(tx, db, uid, summary, classIds) {
  const affected = new Set([...classIds, ...summary.events.map((e) => e.classId)]);
  affected.delete(null);
  affected.delete(undefined);
  affected.delete("");
  if (affected.size > 25) throw new ReadingHttpError("독서 기록에 연결된 반이 너무 많습니다.");
  for (const affectedId of affected) {
    readingClassId(affectedId);
    tx.set(db.doc(`classes/${affectedId}/readingMembers/${uid}`), {
      uid,
      level: summary.level,
      featuredBadge: typeof summary.featuredBadge === "string" ? summary.featuredBadge : summary.featuredBadge?.id || null,
      events: summary.events.filter((e) => e.classId === affectedId).map((e) => ({ date: e.date, xp: e.xp })),
      // 리더보드에 함께 보이는 값 — 책 제목 · 감상 글은 담지 않습니다(lib/readingJourney.js)
      ...memberSnapshot(summary),
      // 이 반에서 받은 과일 날들 — 관리자 대시보드가 과일 경험치를 셀 때 씁니다(지급 이력 전체를 안 읽게)
      fruits: summary.events.filter((e) => e.kind === "fruit" && e.classId === affectedId).map((e) => ({ date: e.date, count: e.count })),
      formula: READING_FORMULA,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

// 한 학생의 반 집계를 지금 기준으로 다시 씁니다(과일을 받았을 때 · 계산 기준이 바뀌었을 때).
async function recomputeMember(db, uid, classId) {
  const fruits = await fruitsFor(db, uid);
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(`users/${uid}/reading/main`));
    const summary = deriveReading(stateFromSnapshot(snap), now, { fruits });
    writeMemberSnapshots(tx, db, uid, summary, [classId]);
  });
}

// [교사] 과일을 준 뒤 그 학생의 반 집계를 다시 셉니다(/api/reading/refresh).
export async function refreshReadingMember(principal, selectedClassId, studentUid) {
  const classId = readingClassId(selectedClassId);
  if (typeof studentUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(studentUid)) throw new ReadingHttpError("학생을 확인해 주세요.");
  const { db } = principal;
  const ok = await db.runTransaction(async (tx) => {
    const profile = await accessInTransaction(tx, db, principal, classId);
    const role = principal.roleClaim || profile?.role || "student";
    if (role !== "teacher" && role !== "admin") throw new ReadingHttpError("담당 교사만 다시 셀 수 있습니다.", 403, "reading/forbidden");
    const member = await tx.get(db.doc(`memberships/${studentUid}_${classId}`));
    return member.exists;
  }, { readOnly: true });
  if (!ok) throw new ReadingHttpError("이 반의 학생이 아닙니다.", 404, "reading/not-member");
  await recomputeMember(db, studentUid, classId);
  return { ok: true };
}

// studentUid — [교사] 그 반 학생의 책나눔을 읽기 전용으로 볼 때(교사 책나눔의 학생 명단 · 선생님 요청).
// 담당 교사 · 관리자만, 그 반에 소속된 학생만. 쓰기(mutateReading)는 늘 본인 것뿐입니다.
export async function getReading(principal, selectedClassId, studentUid = null) {
  const classId = readingClassId(selectedClassId);
  const { db } = principal;
  const other = typeof studentUid === "string" && studentUid && studentUid !== principal.uid;
  if (other && !/^[A-Za-z0-9_-]{1,128}$/.test(studentUid)) throw new ReadingHttpError("학생을 확인해 주세요.");
  const uid = other ? studentUid : principal.uid;
  if (other) {
    const ok = await db.runTransaction(async (tx) => {
      const profile = await accessInTransaction(tx, db, principal, classId);
      const role = principal.roleClaim || profile?.role || "student";
      if (role !== "teacher" && role !== "admin") throw new ReadingHttpError("담당 교사만 학생의 책나눔을 볼 수 있습니다.", 403, "reading/forbidden");
      const member = await tx.get(db.doc(`memberships/${uid}_${classId}`));
      return member.exists;
    }, { readOnly: true });
    if (!ok) throw new ReadingHttpError("이 반의 학생이 아닙니다.", 404, "reading/not-member");
  }
  const fruits = await fruitsFor(db, uid);
  return db.runTransaction(async (tx) => {
    if (!other) await accessInTransaction(tx, db, principal, classId);
    const snap = await tx.get(db.doc(`users/${uid}/reading/main`));
    return readingResult(stateFromSnapshot(snap), new Date(), false, fruits);
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
  const fruits = await fruitsFor(db, uid);
  return db.runTransaction(async (tx) => {
    await accessInTransaction(tx, db, principal, classId);
    const [snap, receipt] = await tx.getAll(stateRef, receiptRef);
    const state = stateFromSnapshot(snap);
    if (receipt.exists) {
      if (receipt.data().actionHash !== actionHash) throw new ReadingHttpError("같은 요청 식별자로 다른 내용을 보낼 수 없습니다.", 409, "reading/request-conflict");
      return readingResult(state, now, true, fruits);
    }
    let next;
    try {
      next = applyReadingAction(state, action, { uid, classId, now: now.toISOString(), id: requestId, fruits });
    } catch (error) {
      throw new ReadingHttpError(error?.message || "독서 기록을 확인해 주세요.");
    }
    // A correction can change streak or badge attribution in another class. Keep
    // each affected class's minimal ranking snapshot consistent in the same commit.
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > 750000) {
      throw new ReadingHttpError("저장 공간이 가득 찼습니다. 불필요한 독서 기록을 정리해 주세요.", 413, "reading/state-too-large");
    }
    const before = deriveReading(state, now, { fruits });
    const summary = deriveReading(next, now, { fruits });
    tx.set(stateRef, { state: next, updatedAt: FieldValue.serverTimestamp() });
    writeMemberSnapshots(tx, db, uid, summary, [classId, ...before.events.map((e) => e.classId)]);
    tx.set(receiptRef, { classId, actionHash, createdAt: FieldValue.serverTimestamp() });
    return { state: next, summary, replayed: false, fruits };
  });
}

// Only a student's own appearance can be saved. No caller-selected UID,
// arbitrary profile patch, reward value, or reading record is written here.
export async function saveReadingCharacter(principal, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || Object.keys(payload).some((key) => !["classId", "character"].includes(key))) {
    throw new ReadingHttpError("캐릭터 설정을 확인해 주세요.");
  }
  const classId = readingClassId(payload.classId);
  const character = normalizeReadingCharacter(payload.character);
  if (!character) throw new ReadingHttpError("캐릭터와 의상을 다시 선택해 주세요.");
  const { db, uid } = principal;
  await db.runTransaction(async (tx) => {
    const profile = await accessInTransaction(tx, db, principal, classId);
    if ((principal.roleClaim || profile?.role || "student") !== "student") {
      throw new ReadingHttpError("학생 본인의 캐릭터만 고칠 수 있어요.", 403, "reading/forbidden");
    }
    const cls = await tx.get(db.doc(`classes/${classId}`));
    if (cls.data()?.rankingEnabled === false) {
      throw new ReadingHttpError("이 반에서는 랭킹 시스템을 사용하지 않습니다.", 403, "reading/ranking-disabled");
    }
    // 관리자 설정에서 '학생 캐릭터'를 끈 반 — 고르기를 막습니다(lib/readingCharacter.js).
    if (!characterChoiceEnabled(cls.data())) {
      throw new ReadingHttpError("이 반에서는 캐릭터 고르기를 사용하지 않습니다.", 403, "reading/character-disabled");
    }
    tx.update(db.doc(`users/${uid}`), { readingCharacter: character });
  });
  return { character };
}

export async function getReadingRankings(principal, selectedClassId, period = "weekly") {
  const classId = readingClassId(selectedClassId);
  const now = new Date();
  readingPeriodBounds(period, now);
  const { db } = principal;
  // 계산 기준이 바뀌었거나(formula) 아직 집계가 없는 학생은 먼저 다시 셉니다 —
  // 연속 보너스 상한 · 최소 쪽수 · 과일이 들어오기 전의 집계가 순위에 섞이지 않게.
  const { rankingOff, characterOn } = await db.runTransaction(async (tx) => {
    await accessInTransaction(tx, db, principal, classId);
    const cls = await tx.get(db.doc(`classes/${classId}`));
    return { rankingOff: cls.exists && cls.data().rankingEnabled === false,
      characterOn: characterChoiceEnabled(cls.exists ? cls.data() : null) };
  }, { readOnly: true });
  // 관리자 설정에서 랭킹 시스템을 끈 반 — 리더보드 · '우리 반 랭킹' 모두 막습니다(lib/reading.js의 rankingEnabled).
  if (rankingOff) throw new ReadingHttpError("이 반에서는 랭킹 시스템을 사용하지 않습니다.", 403, "reading/ranking-disabled");
  const [memberList, snapList] = await Promise.all([
    db.collection("memberships").where("classId", "==", classId).get(),
    db.collection(`classes/${classId}/readingMembers`).get(),
  ]);
  const fresh = new Set(snapList.docs.filter((d) => hasCurrentReadingSnapshot(d.data())).map((d) => d.id));
  const stale = [...new Set(memberList.docs.map((d) => d.data().uid))].filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) && !fresh.has(id));
  for (let i = 0; i < stale.length; i += 5) {
    await Promise.all(stale.slice(i, i + 5).map((id) => recomputeMember(db, id, classId).catch((e) => console.error("[reading] recompute failed", e?.code || e?.name))));
  }
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
        allTimeXp: readingPeriodXp(reading?.events, "all-time", now),
        // 캐릭터를 끈 반은 고른 값 대신 기본 캐릭터(null → 화면이 정함)
        character: characterOn ? normalizeReadingCharacter(profile.readingCharacter) : null,
        ...memberStats(reading, kstToday(now)),
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
