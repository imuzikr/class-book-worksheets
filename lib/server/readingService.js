// Imported exclusively by Next.js route handlers. Never import from client code.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash, randomInt } from "node:crypto";
import { initialReadingState, deriveReading, applyReadingAction, hideoutOn, kstToday, readingTopWeek, READING_FORMULA } from "../reading.js";
import { hideoutProgress, normalizeHideoutRoom, validateHideoutLayout } from "../readingHideout.js";
import { isRankedStudent, memberSnapshot, memberStats, RANKING_PERIODS, RANKING_REFRESH_MS, rankingCacheFresh, rankingResponse, readingTopAsOf, topReaders } from "../readingJourney.js";
import { characterChoiceEnabled, hasCurrentReadingSnapshot, normalizeReadingCharacter } from "../readingCharacter.js";
import { normalizePetMirror, PET_SPECIES, petEnabled, petGrowthXp, petProgress, planPetAction, rankingPet } from "../readingPet.js";
import { PLAZA_PLACES, PLAZA_SHARE_RULE, plazaBookKey, plazaCommentText, plazaHasContent, plazaOn, plazaProjection, plazaStable } from "../readingPlaza.js";
import { PLAZA_LIVE_TTL_MS, plazaLiveDatabaseUrl, plazaLivePrune, plazaLiveWho } from "../readingPlazaLive.js";
import { characterOf } from "../readingCharacterCatalog.js";
import { ReadingHttpError, assertReadingAccess, readingClassId, readingPeriodBounds, readingPeriodXp } from "./readingPolicy.js";
import { plazaLiveStore } from "./plazaLiveStore.js";

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

// 접근 확인에 반 문서도 함께 읽으므로, 반 설정(랭킹 · 캐릭터)이 필요하면 여기서 받아 씁니다
// (반 문서를 한 번 더 읽지 않게).
async function readAccessInTransaction(tx, db, principal, classId) {
  const [classSnap, profileSnap, memberSnap] = await tx.getAll(
    db.doc(`classes/${classId}`),
    db.doc(`users/${principal.uid}`),
    db.doc(`memberships/${principal.uid}_${classId}`)
  );
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const classDoc = classSnap.exists ? { ...classSnap.data(), id: classId } : null;
  assertReadingAccess({
    ...principal,
    profile,
    classDoc,
    membership: memberSnap.exists ? memberSnap.data() : null,
  });
  return { profile, classDoc };
}

async function accessInTransaction(tx, db, principal, classId) {
  return (await readAccessInTransaction(tx, db, principal, classId)).profile;
}

function stateFromSnapshot(snap) {
  return snap.exists ? snap.data().state || initialReadingState() : initialReadingState();
}

function readingResult(state, now, replayed = false) {
  return { state, summary: deriveReading(state, now), replayed };
}

// 그 학생이 든 반들(25개까지) — 반 집계를 함께 고쳐 적을 반.
async function memberClassIds(db, uid) {
  const members = await db.collection("memberships").where("uid", "==", uid).get();
  return [...new Set(members.docs.map((d) => d.data().classId).filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id)))].slice(0, 25);
}

// 반 집계(리더보드 · 랭킹이 읽음) — 한 학생의 요약을 관련된 반마다 한 장씩.
// 리더보드를 꺼 둔 반에도 똑같이 적습니다 — 스위치는 보이는 화면만 켜고 끄므로(선생님 요청),
// 다시 켜면 그동안 쌓인 순위가 곧바로 보입니다.
// alsoClassIds — 그 학생이 든 다른 반들. 25개를 넘지 않는 만큼 함께 고쳐 적습니다(누적 · 레벨 · 뱃지가
// 반마다 같은 값이 되게 — 다시 셀 때).
// set이 문서를 통째로 갈아 끼우므로, 옛 집계에 남아 있던 과일 칸(fruits · allFruits · fruitCursor —
// 과일 경험치를 걷기 전의 것)은 다시 적힐 때 저절로 사라집니다.
function writeMemberSnapshots(tx, db, uid, summary, classIds, alsoClassIds = []) {
  const affected = new Set([...classIds, ...summary.events.map((e) => e.classId)]);
  affected.delete(null);
  affected.delete(undefined);
  affected.delete("");
  if (affected.size > 25) throw new ReadingHttpError("독서 기록에 연결된 반이 너무 많습니다.");
  for (const id of alsoClassIds) {
    if (affected.size >= 25) break;
    if (typeof id === "string" && id) affected.add(id);
  }
  for (const affectedId of affected) {
    readingClassId(affectedId);
    tx.set(db.doc(`classes/${affectedId}/readingMembers/${uid}`), {
      uid,
      level: summary.level,
      featuredBadge: typeof summary.featuredBadge === "string" ? summary.featuredBadge : summary.featuredBadge?.id || null,
      events: summary.events.filter((e) => e.classId === affectedId).map((e) => ({ date: e.date, xp: e.xp })),
      // 리더보드에 함께 보이는 값 — 책 제목 · 감상 글은 담지 않습니다(lib/readingJourney.js)
      ...memberSnapshot(summary),
      formula: READING_FORMULA,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

// 한 학생의 반 집계를 지금 기준으로 다시 씁니다(계산 기준이 바뀌었을 때 · 아직 집계가 없을 때 —
// 리더보드 · 독서 TOP 3를 셀 때와 펫의 바탕을 셀 때 부름). 서재 1장 + 그 학생이 든 반 목록을 읽습니다.
async function recomputeMember(db, uid, classId) {
  const classIds = await memberClassIds(db, uid);
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(`users/${uid}/reading/main`));
    writeMemberSnapshots(tx, db, uid, deriveReading(stateFromSnapshot(snap), now), [classId], classIds);
  });
}

// studentUid — [교사] 그 반 학생의 책나눔을 읽기 전용으로 볼 때(교사 책나눔의 학생 명단 · 선생님 요청).
// 담당 교사 · 관리자만, 그 반에 소속된 학생만. 쓰기(mutateReading)는 늘 본인 것뿐입니다.
// 읽는 것 — 접근 확인 3 + 서재 1. 경험치는 서재(독서 기록)만으로 셉니다(과일은 경험치가 아님).
// 한때 과일 경험치 때문에 반 집계 한 장과 과일 지급 이력까지 읽었습니다.
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
  const state = await db.runTransaction(async (tx) => {
    if (!other) await accessInTransaction(tx, db, principal, classId);
    return stateFromSnapshot(await tx.get(db.doc(`users/${uid}/reading/main`)));
  }, { readOnly: true });
  return readingResult(state, new Date());
}

// Personal rooms have no live movement writes. Opening reads once; only an
// explicit changed layout writes one private document, using the reading state
// in the same transaction to enforce unlocked items and the class feature gate.
function assertHideoutEnabled(classDoc) {
  if (!hideoutOn(classDoc)) {
    throw new ReadingHttpError("이 반에서는 개인 아지트를 사용하지 않습니다.", 403, "reading/hideout-disabled");
  }
}

export async function getReadingHideout(principal, selectedClassId, studentUid = null) {
  const classId = readingClassId(selectedClassId);
  if (studentUid != null && (typeof studentUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(studentUid))) {
    throw new ReadingHttpError("학생을 확인해 주세요.");
  }
  const uid = studentUid || principal.uid;
  const other = uid !== principal.uid;
  const { db } = principal;
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    assertHideoutEnabled(classDoc);
    const role = principal.roleClaim || profile?.role || "student";
    if (other) {
      if (role !== "teacher" && role !== "admin") {
        throw new ReadingHttpError("담당 교사만 학생의 아지트를 볼 수 있습니다.", 403, "reading/forbidden");
      }
      const [member, target] = await tx.getAll(db.doc(`memberships/${uid}_${classId}`), db.doc(`users/${uid}`));
      if (!member.exists || member.data().uid !== uid || member.data().classId !== classId
        || !target.exists || (target.data().role || "student") !== "student") {
        throw new ReadingHttpError("이 반의 학생이 아닙니다.", 404, "reading/not-member");
      }
    } else if (role !== "student") {
      throw new ReadingHttpError("학생의 아지트에서 확인해 주세요.", 403, "reading/hideout-students-only");
    }
    const [main, stored] = await tx.getAll(db.doc(`users/${uid}/reading/main`), db.doc(`users/${uid}/reading/hideout`));
    const summary = deriveReading(stateFromSnapshot(main), new Date());
    return { room: normalizeHideoutRoom(stored.exists ? stored.data() : null, summary), progress: hideoutProgress(summary) };
  }, { readOnly: true });
}

const plainHideoutObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export async function saveReadingHideout(principal, payload) {
  if (!plainHideoutObject(payload) || Reflect.ownKeys(payload).some((key) => !["classId", "room"].includes(key))) {
    throw new ReadingHttpError("아지트 요청을 확인해 주세요.");
  }
  const classId = readingClassId(payload.classId);
  const input = payload.room;
  if (!plainHideoutObject(input) || Reflect.ownKeys(input).some((key) => !["version", "layout", "revision"].includes(key))
    || input.version !== 2 || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER) {
    throw new ReadingHttpError("아지트 저장 형식을 확인해 주세요.");
  }
  const { db, uid } = principal;
  const roomRef = db.doc(`users/${uid}/reading/hideout`);
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    assertHideoutEnabled(classDoc);
    if ((principal.roleClaim || profile?.role || "student") !== "student") {
      throw new ReadingHttpError("아지트는 학생 본인만 꾸밀 수 있습니다.", 403, "reading/hideout-students-only");
    }
    const [main, stored] = await tx.getAll(db.doc(`users/${uid}/reading/main`), roomRef);
    const summary = deriveReading(stateFromSnapshot(main), new Date());
    let layout;
    try { layout = validateHideoutLayout(input.layout, summary); }
    catch (error) { throw new ReadingHttpError(error?.message || "소품을 확인해 주세요.", 400, error?.code || "reading/invalid-hideout"); }
    const requested = normalizeHideoutRoom({ version: 2, layout, revision: input.revision }, summary);
    const current = normalizeHideoutRoom(stored.exists ? stored.data() : null, summary);
    if (current.revision !== input.revision) {
      throw new ReadingHttpError("다른 창에서 아지트가 바뀌었어요. 다시 불러온 뒤 꾸며 주세요.", 409, "reading/hideout-conflict");
    }
    const changed = JSON.stringify(current.layout) !== JSON.stringify(requested.layout);
    const room = { version: 2, layout: requested.layout, revision: current.revision + (changed ? 1 : 0) };
    if (changed) tx.set(roomRef, { ...room, updatedAt: FieldValue.serverTimestamp() });
    return { room, progress: hideoutProgress(summary) };
  });
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
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    // 책 광장 — 켠 반에서는 그 반에서 쓴 발자국 · 한 권의 책이 모두 반 친구에게 보입니다(학생이 고르는 것이 없음 —
    // lib/readingPlaza.js 머리말). plazaSynced는 그 반의 사본을 한 번 통째로 맞춘 적이 있다는 표시(아래 plazaSyncClass).
    const plaza = plazaOn(classDoc);
    const plazaKept = plaza || classDoc?.plazaSynced != null;
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
    // 책 광장의 공유 사본 — 같은 트랜잭션에서 맞춥니다(읽기는 쓰기보다 먼저 — 목록 한 장).
    //   · 광장을 켠 반 · 켠 적이 있어 사본을 통째로 맞춰 둔 반(plazaSynced): 늘 맞춥니다. 꺼 둔 동안에 쓴 글도 사본에
    //     들어가 있어야, 다시 켰을 때 빠진 글 없이 곧바로 모두 보입니다(꺼 둔 동안에는 규칙이 반 친구의 읽기를 막음).
    //   · 광장을 한 번도 켜지 않은 반: 사본을 만들지 않습니다(쓰기 0). 다만 이 학생의 사본이 이미 있으면(옛 기준으로
    //     나간 글 · 켰다가 곧 끈 반) 고치기 · 삭제가 따라가게 맞춥니다 — **이미 있는 사본은 늘 맞춰 둡니다**
    //     (사본은 '고치기 전의 셈'과 견주어 바뀐 책만 다시 쓰므로, 한 번이라도 건너뛰면 지운 글이 사본에 남음).
    const plazaShelf = plazaKept || plazaHasContent(state, classId) || plazaHasContent(next, classId)
      ? await tx.get(plazaShelfRef(db, classId, uid)) : null;
    tx.set(stateRef, { state: next, updatedAt: FieldValue.serverTimestamp() });
    writeMemberSnapshots(tx, db, uid, summary, [classId, ...before.events.map((e) => e.classId)]);
    if (plazaShelf && (plazaKept || plazaShelf.exists)) writePlaza(tx, db, { uid, classId, profile, before, summary, shelfSnap: plazaShelf });
    tx.set(receiptRef, { classId, actionHash, createdAt: FieldValue.serverTimestamp() });
    return { state: next, summary, replayed: false };
  });
}

// ── 책 광장 — 공유 사본(lib/readingPlaza.js) ─────────────────────────────────────
//   · classes/{c}/plazaShelves/{uid}  학생마다 한 장 — 광장에 보이는 책 목록(제목 · 쪽수 · 최근 글 한 줄 · 댓글 수)
//   · classes/{c}/plazaBooks/{uid}_{bookId}  책마다 한 장 — 독서 발자국 · 한 권의 책
//   · classes/{c}/plazaComments/{id}  댓글(책 한 권에 한 줄기)
// 셋 다 **서버만 씁니다**(규칙은 같은 반 학생 · 담당 교사의 읽기만 엶). 서재 정본이 바뀔 때마다 여기서 맞추므로
// 사본은 언제든 정본에서 다시 만들 수 있는 값입니다. 댓글 수는 사본과 따로 세어 둡니다 — 책 문서의 comments와
// 목록 문서의 counts.{bookId}(목록의 '댓글 n'). 사본을 다시 쓸 때는 merge라 이 수가 지워지지 않고, 책이 광장에서
// 내려갔다 다시 올라와도 그대로입니다.
// 사본에 적는 기준 번호(rule)는 PLAZA_SHARE_RULE(lib/reading.js) — 번호가 다른 사본은 통째로 다시 씁니다.
const PLAZA_COMMENT_CAP = 300;
function plazaShelfRef(db, classId, uid) { return db.doc(`classes/${classId}/plazaShelves/${uid}`); }
function plazaBookRef(db, classId, uid, bookId) { return db.doc(`classes/${classId}/plazaBooks/${plazaBookKey(uid, bookId)}`); }
function plazaIdentity(profile) {
  return { name: String(profile?.realName || "이름 미설정").slice(0, 40), studentId: String(profile?.studentId || "").slice(0, 20) };
}
function plazaBlocked(shelf) {
  return Array.isArray(shelf?.blocked) ? shelf.blocked.filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id)).slice(0, 100) : [];
}

// 한 학생의 사본을 지금 서재에 맞춥니다. before는 고치기 전의 셈(바뀐 책만 다시 쓰려고 견줌) — 저장해 둔 사본의
// 모양(rule)이 다르거나 이름표가 바뀌었으면 견주지 않고 모두 다시 씁니다. blocked는 선생님이 내린 책(그 책은 사본을 비움).
function writePlaza(tx, db, { uid, classId, profile, before, summary, shelfSnap, blocked }) {
  const old = shelfSnap?.exists ? shelfSnap.data() : null;
  const blockedBefore = plazaBlocked(old);
  const blockedNow = blocked ?? blockedBefore;
  const who = plazaIdentity(profile);
  const fresh = !old || old.rule !== PLAZA_SHARE_RULE || old.name !== who.name || (old.studentId ?? "") !== who.studentId;
  const was = fresh ? { entries: [], books: {} } : plazaProjection(before, classId, { blocked: blockedBefore });
  const now = plazaProjection(summary, classId, { blocked: blockedNow });
  // 사본이 아직 없고 실을 글도 없으면(책만 등록한 학생 · 글이 없는 학생) 빈 장을 만들지 않습니다
  if (!old && !now.entries.length && !blockedNow.length) return;
  const sameShelf = !fresh && plazaStable(old.books ?? []) === plazaStable(now.entries) && plazaStable(blockedBefore) === plazaStable(blockedNow);
  if (!sameShelf) {
    // merge — 댓글 수(counts)는 댓글 쪽이 고치는 칸이라 그대로 둡니다(books · blocked 배열은 통째로 갈아 끼워짐).
    tx.set(plazaShelfRef(db, classId, uid), { uid, ...who, rule: PLAZA_SHARE_RULE, books: now.entries, blocked: blockedNow, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  for (const [bookId, content] of Object.entries(now.books)) {
    if (was.books[bookId] && plazaStable(was.books[bookId]) === plazaStable(content)) continue;
    // merge — 댓글 수(comments)는 댓글 쪽이 고치는 칸이라 그대로 둡니다.
    tx.set(plazaBookRef(db, classId, uid, bookId), { uid, ...who, ...content, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  // 광장에서 내려간 책(글을 모두 지움 · 보관함으로 옮김 · 선생님이 내림) — 내용을 비웁니다.
  // 문서와 댓글은 남겨, 다시 올라오면 댓글이 이어집니다.
  const gone = new Set(Object.keys(was.books).filter((bookId) => !now.books[bookId]));
  if (fresh) for (const b of Array.isArray(old?.books) ? old.books : []) if (typeof b?.id === "string" && !now.books[b.id]) gone.add(b.id);
  for (const bookId of blockedNow) if (!blockedBefore.includes(bookId)) gone.add(bookId);
  for (const bookId of gone) {
    if (now.books[bookId] || !/^[A-Za-z0-9_-]{1,100}$/.test(bookId)) continue;
    tx.set(plazaBookRef(db, classId, uid, bookId), { uid, ...who, bookId, place: null, logs: [], logCount: 0, review: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

function plazaTarget(payload) {
  const ownerUid = payload?.ownerUid;
  const bookId = payload?.bookId;
  if (typeof ownerUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid) || typeof bookId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(bookId)) {
    throw new ReadingHttpError("책을 확인해 주세요.");
  }
  return { ownerUid, bookId };
}

// ── 책 광장의 실시간(함께 있는 친구들의 캐릭터) — 입장권 ─────────────────────
// 자리는 Realtime Database에서 화면끼리 주고받습니다(lib/readingPlazaLive.js 머리말). 그 규칙(database.rules.json)은
// Firestore를 읽지 못해 '이 반 구성원인가'를 스스로 알 수 없으므로, **서버가 확인한 뒤 입장권을 적어 줍니다** —
// plaza/{반}/who/{uid}. 이름 · 캐릭터 · 펫도 여기에 서버가 적습니다(본인이 적게 하면 남의 이름표를 달 수 있음).
//   · 주소(NEXT_PUBLIC_FIREBASE_DATABASE_URL)가 없으면 { live: false } — 광장은 지금까지처럼 내 캐릭터만.
//   · 읽기: 접근 확인 3 + 이 반 집계 1(펫 단계) · Realtime Database에서 그 반의 자료 한 번(죽은 것 걷기).
//   · 입장권은 PLAZA_LIVE_TTL_MS(2시간) 동안 살고, 화면이 만료 전에 새로 받습니다.
//   · Realtime Database는 REST로만 읽고 씁니다(lib/server/plazaLiveStore.js — 관리자 SDK의 연결은 무료 요금제의
//     동시 연결 100개를 차지하므로 쓰지 않음).
// Realtime Database의 열쇠로 쓸 수 있는 uid인가(. $ # [ ] / 가 들면 못 씀 — Firebase가 주는 uid는 늘 통과)
const LIVE_KEY = /^[A-Za-z0-9_-]{1,128}$/;
function plazaLiveRoot(classId) {
  const url = plazaLiveDatabaseUrl(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
  return url ? plazaLiveStore(readingAdmin(), url, classId) : null;
}
async function plazaEnter(principal, classId) {
  const { db, uid } = principal;
  const root = plazaLiveRoot(classId);
  const { profile, classDoc, saved } = await db.runTransaction(async (tx) => {
    const access = await readAccessInTransaction(tx, db, principal, classId);
    if (!plazaOn(access.classDoc)) throw new ReadingHttpError("이 반에서는 책 광장을 사용하지 않습니다.", 403, "reading/plaza-disabled");
    if (!root) return { ...access, saved: null };
    const member = await tx.get(db.doc(`classes/${classId}/readingMembers/${uid}`));
    return { ...access, saved: member.exists ? member.data() : null };
  }, { readOnly: true });
  if (!root || !LIVE_KEY.test(uid)) return { live: false };
  const role = principal.roleClaim || profile?.role || "student";
  const teacher = role === "teacher" || role === "admin";
  const now = Date.now();
  const who = plazaLiveWho({
    name: teacher ? "선생님" : plazaIdentity(profile).name,
    teacher,
    // 캐릭터를 꺼 둔 반은 기본 캐릭터(리더보드와 같은 약속), 선생님 · 관리자는 펫이 없습니다.
    character: characterOf({ uid, character: characterChoiceEnabled(classDoc) ? normalizeReadingCharacter(profile?.readingCharacter) : null }),
    pet: !teacher && petEnabled(classDoc) ? rankingPet(profile?.readingPet, saved) : null,
    exp: now + PLAZA_LIVE_TTL_MS,
  });
  try {
    const tree = await root.read();
    await root.update({ ...plazaLivePrune(tree, now), [`who/${uid}`]: who });
  } catch (error) {
    // 데이터베이스를 아직 안 만들었거나 주소가 틀렸을 때 — 광장 자체는 그대로 쓰게 조용히 끕니다.
    console.warn("[책 광장] 실시간 입장권을 적지 못했어요:", error?.code || error?.message);
    return { live: false };
  }
  return { live: true, expiresAt: who.exp };
}
// [교사] 그 학생의 입장권과 자리를 걷습니다 — 사용 중지 · 반에서 빼기 · 탈퇴 뒤(resetReadingRankings가 부름).
// 못 걷어도 입장권은 2시간 안에 죽습니다.
// [교사] 그 반의 실시간 자료(입장권 · 자리)를 통째로 걷습니다 — 반을 완전히 지울 때(lib/data/classes.js의 purgeClass).
// Realtime Database는 화면에서 지울 수 없어(규칙이 지우기를 막음) 서버가 합니다. 보관된 반 · 책나눔을 끈 반에서도
// 걷을 수 있어야 하므로 책나눔 접근 판정(assertReadingAccess)을 거치지 않고, 그 반을 만든 교사(또는 관리자)인지만 봅니다.
async function plazaClearLive(principal, classId) {
  const { db, uid } = principal;
  const [classSnap, profileSnap] = await db.getAll(db.doc(`classes/${classId}`), db.doc(`users/${uid}`));
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const role = principal.roleClaim || profile?.role || "student";
  const owns = role === "admin" || (role === "teacher" && classSnap.exists && classSnap.data().createdBy === uid);
  if (!owns || profile?.suspended === true) throw new ReadingHttpError("담당 교사만 반의 자료를 걷을 수 있습니다.", 403, "reading/forbidden");
  const root = plazaLiveRoot(classId);
  if (!root) return { cleared: false };
  try {
    await root.remove();
    return { cleared: true };
  } catch (error) {
    console.warn("[책 광장] 실시간 자료를 걷지 못했어요:", error?.code || error?.message);
    return { cleared: false };
  }
}

async function dropPlazaLive(classId, studentUid) {
  const root = plazaLiveRoot(classId);
  if (!root) return;
  await root.update({ [`who/${studentUid}`]: null, [`pos/${studentUid}`]: null })
    .catch((error) => console.warn("[책 광장] 실시간 입장권을 걷지 못했어요:", error?.code || error?.message));
}

// ── 책 광장 — 그 반의 공유 사본을 한 번 통째로 맞춥니다('모두 공개' — 선생님 결정) ─────────────────
// 사본은 학생이 저장할 때마다 그 학생 것만 맞춰집니다(mutateReading). 그래서 **광장을 켜기 전에 쓴 글 · 기준이 바뀌기
// 전에 쓴 글**은 그 학생이 다시 저장할 때까지 사본에 없습니다 — '켜면 모두 자동으로 공개'가 되려면 그 반의 학생들
// 것을 한 번 통째로 맞춰야 합니다.
//   · 누가 부르나: 책방 화면(app/books/page.js) — 광장을 켠 반인데 반 문서의 plazaSynced가 지금 기준 번호가 아닐 때,
//     그 반의 학생 · 선생님 누구의 화면이든 한 번 부탁합니다(lib/reading.js의 plazaNeedsSync).
//   · 여럿이 한꺼번에 와도 **한 요청만** 맞춥니다('맞추는 중' 표시 — 반 순위와 같은 길, classes/{c}/readingRank/plaza).
//   · 읽기: 반 명단 N + 학생마다 3(서재 · 목록 · 프로필). 쓰기: 글이 있는 학생의 목록 한 장 + 책마다 한 장.
//     반마다 **기준 번호마다 한 번뿐**입니다 — 끝나면 반 문서에 plazaSynced를 적고, 그 뒤로는 저장할 때마다 맞춰 둡니다
//     (그 표시가 있는 반은 광장을 꺼 둔 동안에도 사본을 맞춰 두어, 다시 켜도 다시 맞출 일이 없음).
//   · 한 학생이라도 못 맞추면(그 학생만 한 번 더 해 보고도) 표시를 적지 않습니다 — 나중에 화면을 연 사람이 이어서
//     맞춥니다(이미 맞춘 학생은 읽기만 하고 지나감). 그때는 '맞추는 중' 표시를 10분 뒤로 미뤄 둡니다 — 계속 실패하는
//     동안 화면을 여는 사람마다 반 전체를 다시 읽지 않게(PLAZA_SYNC_BACKOFF_MS). 서버가 도중에 끊기면(시간 초과)
//     표시는 30초 뒤에 풀리고, 화면이 조금 뒤 한 번 더 부탁합니다(app/books/page.js).
//   · 프로필이 없는 소속(지운 계정의 흔적)은 건너뜁니다 — 이름 없는 글을 새로 내걸지 않습니다.
const PLAZA_SYNC_LANES = 5;
const PLAZA_SYNC_BACKOFF_MS = 10 * 60 * 1000;
async function syncPlazaMember(db, classId, uid) {
  await db.runTransaction(async (tx) => {
    const [stateSnap, shelfSnap, profileSnap] = await tx.getAll(db.doc(`users/${uid}/reading/main`), plazaShelfRef(db, classId, uid), db.doc(`users/${uid}`));
    if (!profileSnap.exists || (!stateSnap.exists && !shelfSnap.exists)) return;
    const summary = deriveReading(stateFromSnapshot(stateSnap), new Date());
    writePlaza(tx, db, { uid, classId, profile: profileSnap.data(), before: summary, summary, shelfSnap });
  });
}
// 여러 학생을 몇 줄로 나눠 맞추고, 못 맞춘 학생의 uid를 돌려줍니다
async function syncPlazaMembers(db, classId, uids) {
  const failed = [];
  for (let i = 0; i < uids.length; i += PLAZA_SYNC_LANES) {
    const lane = uids.slice(i, i + PLAZA_SYNC_LANES);
    const results = await Promise.allSettled(lane.map((id) => syncPlazaMember(db, classId, id)));
    results.forEach((result, k) => {
      if (result.status !== "rejected") return;
      failed.push(lane[k]);
      console.error("[책 광장] 사본을 맞추지 못했어요:", result.reason?.code || result.reason?.name || result.reason?.message);
    });
  }
  return failed;
}
async function plazaSyncClass(principal, classId) {
  const { db } = principal;
  const classDoc = await db.runTransaction(async (tx) => (await readAccessInTransaction(tx, db, principal, classId)).classDoc, { readOnly: true });
  if (!plazaOn(classDoc)) throw new ReadingHttpError("이 반에서는 책 광장을 사용하지 않습니다.", 403, "reading/plaza-disabled");
  if (classDoc.plazaSynced === PLAZA_SHARE_RULE) return { synced: true, ran: false };
  const ref = db.doc(`classes/${classId}/readingRank/plaza`);
  // 다른 요청이 맞추는 중이면(또는 조금 전에 못 맞춰 쉬는 중이면) 맡기고 돌아갑니다 — 끝나면 반 문서의 표시가 바뀌어 화면이 압니다
  if (!(await claimRankingLease(ref, await ref.get()))) return { synced: false, ran: false };
  try {
    const members = await db.collection("memberships").where("classId", "==", classId).get();
    const uids = [...new Set(members.docs.map((d) => d.data().uid))].filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id));
    let failed = await syncPlazaMembers(db, classId, uids);
    // 잠깐의 실패(같은 순간 그 학생이 저장함 등)는 그 학생만 한 번 더 해 봅니다
    if (failed.length) failed = await syncPlazaMembers(db, classId, failed);
    if (failed.length) throw new ReadingHttpError("책 광장의 글을 모두 맞추지 못했어요. 잠시 뒤 다시 열어 주세요.", 503, "reading/plaza-sync-failed");
    await db.doc(`classes/${classId}`).update({ plazaSynced: PLAZA_SHARE_RULE });
    // set이 장을 통째로 갈아 끼워 '맞추는 중' 표시도 함께 걷힙니다
    await ref.set({ rule: PLAZA_SHARE_RULE, members: uids.length, syncedAt: FieldValue.serverTimestamp() });
    return { synced: true, ran: true, members: uids.length };
  } catch (error) {
    await ref.set({ leaseUntil: Timestamp.fromMillis(Date.now() + PLAZA_SYNC_BACKOFF_MS) }, { merge: true }).catch(() => {});
    throw error;
  }
}

// 책 광장에서 하는 일 — 댓글 달기 · 지우기, [교사] 책을 광장에서 내리기 · 다시 올리기, 실시간 입장, 반의 사본 맞추기.
//   { classId, action: "comment", ownerUid, bookId, text, requestId }  → { comment }
//   { classId, action: "deleteComment", commentId }                    → { deleted }
//   { classId, action: "block", ownerUid, bookId, blocked }            → { blocked: [...] }
//   { classId, action: "enter" }                                       → { live, expiresAt } (위 '입장권')
//   { classId, action: "sync" }                                        → { synced, ran } 그 반의 공유 사본을 한 번 통째로 맞춤(위)
//   { classId, action: "clear" }                                       → { cleared } [교사] 반을 완전히 지울 때 실시간 자료도 걷음
// 광장을 켠 반의 구성원(학생 · 담당 교사 · 관리자)만. 이름표는 서버가 프로필에서 붙입니다(실명 · 학번, 선생님은 '선생님').
export async function plazaAction(principal, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ReadingHttpError("요청 내용을 확인해 주세요.");
  const classId = readingClassId(payload.classId);
  const { db, uid } = principal;
  if (payload.action === "enter") return plazaEnter(principal, classId);
  if (payload.action === "sync") return plazaSyncClass(principal, classId);
  if (payload.action === "clear") return plazaClearLive(principal, classId);
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if (!plazaOn(classDoc)) throw new ReadingHttpError("이 반에서는 책 광장을 사용하지 않습니다.", 403, "reading/plaza-disabled");
    const role = principal.roleClaim || profile?.role || "student";
    const byTeacher = role === "teacher" || role === "admin";
    const comments = db.collection(`classes/${classId}/plazaComments`);

    if (payload.action === "comment") {
      const { ownerUid, bookId } = plazaTarget(payload);
      let text;
      try { text = plazaCommentText(payload.text); } catch (error) { throw new ReadingHttpError(error?.message || "댓글을 확인해 주세요."); }
      const requestId = payload.requestId;
      if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) throw new ReadingHttpError("요청 식별자가 올바르지 않습니다.");
      const commentRef = comments.doc(requestId);
      const bookRef = plazaBookRef(db, classId, ownerUid, bookId);
      const [commentSnap, bookSnap, ownerSnap] = await tx.getAll(commentRef, bookRef, db.doc(`users/${ownerUid}`));
      // 같은 요청을 다시 보냈으면(두 번 누름 · 다시 시도) 이미 단 댓글을 그대로 돌려줍니다.
      if (commentSnap.exists) {
        if (commentSnap.data().uid !== uid) throw new ReadingHttpError("같은 요청 식별자를 다시 쓸 수 없습니다.", 409, "reading/request-conflict");
        return { comment: { id: commentSnap.id, ...plazaCommentView(commentSnap.data()) }, replayed: true };
      }
      const book = bookSnap.exists ? bookSnap.data() : null;
      if (!book || !PLAZA_PLACES.includes(book.place)) throw new ReadingHttpError("광장에서 내려간 책이에요.", 404, "reading/plaza-gone");
      // 사용 중지된 친구의 책에는 댓글을 달 수 없습니다(해시태그 댓글과 같은 약속 — 글은 그대로 읽힘).
      if (ownerSnap.exists && ownerSnap.data().suspended === true) throw new ReadingHttpError("입력할 수 없습니다.", 403, "reading/plaza-suspended");
      if ((Number(book.comments) || 0) >= PLAZA_COMMENT_CAP) throw new ReadingHttpError("이 책에는 댓글이 가득 찼어요.", 409, "reading/plaza-full");
      const who = byTeacher ? { name: "선생님", studentId: "" } : plazaIdentity(profile);
      const comment = { book: plazaBookKey(ownerUid, bookId), ownerUid, bookId, uid, ...who, byTeacher, text };
      tx.set(commentRef, { ...comment, at: FieldValue.serverTimestamp() });
      tx.update(bookRef, { comments: FieldValue.increment(1) });
      // 목록의 '댓글 n' — 주인의 목록 한 장에 책마다 세어 둡니다(읽지 않고 더함). 책이 광장에 있으면 목록도 있습니다.
      tx.set(plazaShelfRef(db, classId, ownerUid), { counts: { [bookId]: FieldValue.increment(1) } }, { merge: true });
      return { comment: { id: requestId, ...comment, at: new Date().toISOString() }, replayed: false };
    }

    if (payload.action === "deleteComment") {
      const commentId = payload.commentId;
      if (typeof commentId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(commentId)) throw new ReadingHttpError("댓글을 확인해 주세요.");
      const commentRef = comments.doc(commentId);
      const commentSnap = await tx.get(commentRef);
      if (!commentSnap.exists) return { deleted: false };
      const comment = commentSnap.data();
      // 지우기는 쓴 사람과 선생님만(책 주인은 못 지움 — 해시태그 댓글과 같은 약속)
      if (!byTeacher && comment.uid !== uid) throw new ReadingHttpError("내가 쓴 댓글만 지울 수 있어요.", 403, "reading/forbidden");
      const okTarget = typeof comment.ownerUid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(comment.ownerUid)
        && typeof comment.bookId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(comment.bookId);
      if (okTarget) {
        const bookRef = plazaBookRef(db, classId, comment.ownerUid, comment.bookId);
        const shelfRef = plazaShelfRef(db, classId, comment.ownerUid);
        const [bookSnap, shelfSnap] = await tx.getAll(bookRef, shelfRef);
        if (bookSnap.exists) tx.update(bookRef, { comments: Math.max(0, (Number(bookSnap.data().comments) || 0) - 1) });
        if (shelfSnap.exists) {
          const count = Math.max(0, (Number(shelfSnap.data().counts?.[comment.bookId]) || 0) - 1);
          tx.set(shelfRef, { counts: { [comment.bookId]: count } }, { merge: true });
        }
      }
      tx.delete(commentRef);
      return { deleted: true };
    }

    if (payload.action === "block") {
      if (!byTeacher) throw new ReadingHttpError("담당 교사만 책을 광장에서 내릴 수 있습니다.", 403, "reading/forbidden");
      const { ownerUid, bookId } = plazaTarget(payload);
      if (typeof payload.blocked !== "boolean") throw new ReadingHttpError("내릴지 올릴지 확인해 주세요.");
      const shelfRef = plazaShelfRef(db, classId, ownerUid);
      const [shelfSnap, stateSnap, ownerSnap] = await tx.getAll(shelfRef, db.doc(`users/${ownerUid}/reading/main`), db.doc(`users/${ownerUid}`));
      const before = plazaBlocked(shelfSnap.exists ? shelfSnap.data() : null);
      const blocked = payload.blocked ? [...new Set([...before, bookId])] : before.filter((id) => id !== bookId);
      if (blocked.length > 100) throw new ReadingHttpError("내린 책이 너무 많습니다.");
      // 그 학생의 서재에서 사본을 다시 맞춥니다 — 내리면 그 책이 비워지고, 다시 올리면 지금 서재대로 돌아옵니다.
      const summary = deriveReading(stateFromSnapshot(stateSnap), new Date());
      writePlaza(tx, db, { uid: ownerUid, classId, profile: ownerSnap.exists ? ownerSnap.data() : null, before: summary, summary, shelfSnap, blocked });
      return { blocked };
    }
    throw new ReadingHttpError("지원하지 않는 책 광장 요청이에요.");
  });
}
function plazaCommentView(data) {
  const at = typeof data?.at?.toDate === "function" ? data.at.toDate().toISOString() : null;
  return { book: data.book, ownerUid: data.ownerUid, bookId: data.bookId, uid: data.uid, name: data.name, studentId: data.studentId, byTeacher: data.byTeacher === true, text: data.text, at };
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
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if ((principal.roleClaim || profile?.role || "student") !== "student") {
      throw new ReadingHttpError("학생 본인의 캐릭터만 고칠 수 있어요.", 403, "reading/forbidden");
    }
    // 리더보드를 꺼 둔 반도 고를 수 있습니다('내 프로필'에서 — 선생님 요청: 리더보드 스위치는 보이는 화면만).
    // 관리자 설정에서 '학생 캐릭터'를 끈 반 — 고르기를 막습니다(lib/readingCharacter.js).
    if (!characterChoiceEnabled(classDoc)) {
      throw new ReadingHttpError("이 반에서는 캐릭터 고르기를 사용하지 않습니다.", 403, "reading/character-disabled");
    }
    // 저장해 둔 반 순위(readingRank)에 이 학생 줄이 있으면 캐릭터만 함께 고칩니다(읽기 1 · 쓰기 1) —
    // 안 고치면 리더보드가 곧바로 다시 받을 때 10분 동안 옛 캐릭터로 되돌아가 보입니다.
    const rankRef = rankingRef(db, classId);
    const rankSnap = await tx.get(rankRef);
    tx.update(db.doc(`users/${uid}`), { readingCharacter: character });
    if (rankSnap.exists && rankSnap.get(new FieldPath("rows", uid))) {
      tx.update(rankRef, new FieldPath("rows", uid, "character"), character);
    }
  });
  return { character };
}

// 반 순위를 셀 재료 — 반 명단 · 반 집계 · 프로필을 읽기 전용 트랜잭션 하나로 한 번씩만 읽습니다(접근 확인은
// 부르는 쪽이 먼저 합니다). 반 순위(getReadingRankings — 10분에 한 번)와 상단바 '독서 TOP 3'(getReadingTop —
// 한 주에 한 번)가 함께 씁니다. 학생 25명 반이면 약 75건(명단 25 + 집계 25 + 프로필 25).
// 한때 접근 확인 · 반 문서 · 명단 · 반 집계를 두 번씩 읽어, 학생 30명 반이면 한 번에 약 157건이었습니다.
async function readClassRanking(db, classId) {
  const read = await db.runTransaction(async (tx) => {
    // 관리자 설정의 '리더보드'는 여기서 보지 않습니다 — 순위는 책나눔과 함께 늘 돌고, 책나눔의 '우리 반 랭킹' 탭이
    // 리더보드를 꺼도 이것을 씁니다(선생님 요청). 리더보드를 끈 반에서 막는 것은 독서 TOP 3(getReadingTop)뿐입니다.
    const [membersSnap, rankingsSnap] = await Promise.all([
      tx.get(db.collection("memberships").where("classId", "==", classId)),
      tx.get(db.collection(`classes/${classId}/readingMembers`)),
    ]);
    const memberUids = [...new Set(membersSnap.docs.map((d) => d.data().uid))];
    const ids = memberUids.filter((id) => typeof id === "string" && id && !id.includes("/"));
    const profileSnaps = ids.length ? await tx.getAll(...ids.map((id) => db.doc(`users/${id}`))) : [];
    return {
      memberUids,
      profiles: profileSnaps.filter((s) => s.exists).map((s) => ({ id: s.id, data: s.data() })),
      snapshots: new Map(rankingsSnap.docs.map((d) => [d.id, d.data()])),
    };
  }, { readOnly: true });
  const { snapshots } = read;
  // 계산 기준이 바뀌었거나(formula) 아직 집계가 없는 학생은 먼저 다시 세고, 그 학생들의 집계만 다시 읽습니다 —
  // 옛 기준(예: 과일 경험치가 들어 있던 때)의 집계가 순위에 섞이지 않게.
  const stale = read.memberUids.filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) && !hasCurrentReadingSnapshot(snapshots.get(id)));
  for (let i = 0; i < stale.length; i += 5) {
    await Promise.all(stale.slice(i, i + 5).map((id) => recomputeMember(db, id, classId)
      .catch((e) => console.error("[reading] recompute failed", e?.code || e?.name))));
  }
  if (stale.length) {
    const refreshed = await db.getAll(...stale.map((id) => db.doc(`classes/${classId}/readingMembers/${id}`)));
    for (const snap of refreshed) {
      if (snap.exists) snapshots.set(snap.id, snap.data());
    }
  }
  return read;
}

// 순위 한 줄에 보일 학생 — 교사 · 관리자 계정과 사용 중지된 학생은 뺍니다(lib/readingJourney.js의 isRankedStudent).
// 프로필은 순위를 셀 때 이미 읽어 오므로 사용 중지를 가려도 꺼내 보는 장수는 안 늡니다.
function rankingStudents(profiles) {
  return profiles.filter(({ data }) => isRankedStudent(data));
}

// ── 반 순위 — 10분에 한 번 셈해 한 장에 저장하고 여러 학생이 그대로 씁니다(선생님 요청) ────────────
//   · 저장 자리: classes/{c}/readingRank/current — { rule, formula, computedAt, rows: { [uid]: 한 줄 } }.
//     서버만 읽고 씁니다(규칙에 match가 없어 앱에서는 못 읽음 — 반 완전 삭제만 지움, lib/classPurge.js).
//   · 10분 안의 조회: 접근 확인 3 + 이 한 장 1 = 4건만 읽고 그대로 답합니다.
//   · 10분이 지난 뒤(또는 서울 날짜가 바뀐 뒤) 첫 조회: 반 명단 · 반 집계 · 프로필(학생 25명이면 약 75건)로
//     다시 세어 적고 답합니다. 여럿이 한꺼번에 와도 **한 요청만** 셉니다 — 먼저 온 요청이 '세는 중' 표시
//     (leaseUntil)를 걸고, 나머지는 잠깐(4초까지) 기다렸다가 그 결과를 받습니다. 끝내 안 오면 직전 순위를 줍니다.
//   · 아무도 안 보는 동안에는 세지 않습니다(정해진 시각에 도는 일이 없음).
//   · 반 전체를 적어 두고 학생 · 교사 모두에게 반 전체를 보냅니다(선생님 결정 — lib/readingJourney.js의
//     rankingResponse). 한때 학생에게는 상위 10명 + 본인만 보냈는데, 읽는 것은 이 한 장 그대로라 줄지 않아 되돌렸습니다.
//     캐릭터 · 펫은 늘 적어 두고 반 설정은 보낼 때 따릅니다.
//   · 저장한 줄을 바로 고치는 때: 학생이 캐릭터를 바꿀 때(saveReadingCharacter — 그 줄만),
//     선생님이 학생을 사용 중지 · 반에서 빼기 · 탈퇴시킬 때(resetReadingRankings — 한 장을 지워 다음 조회가 다시 셈).
// 한때 조회할 때마다 반 전체를 다시 셌습니다(25명 반 한 번에 약 78건 — 학생마다 10분에 한 번씩).
const RANKING_CACHE_RULE = 1;
const RANKING_LEASE_MS = 30000;
const RANKING_WAIT_TRIES = 10;
const RANKING_WAIT_MS = 400;
// 저장한 순위에 물어 온 학생이 없으면(그 뒤에 반에 들어옴) 1분이 지났을 때 한 번 다시 셉니다.
const RANKING_MISSING_GAP_MS = 60000;

function rankingRef(db, classId) {
  return db.doc(`classes/${classId}/readingRank/current`);
}

// 저장해 둔 순위 한 장 → { rows, computedAt(ms) }. 모양이 다르거나 계산 기준이 바뀌었으면 없는 것으로.
function savedRanking(snap) {
  if (!snap?.exists) return null;
  const data = snap.data();
  const at = typeof data.computedAt?.toMillis === "function" ? data.computedAt.toMillis() : NaN;
  if (data.rule !== RANKING_CACHE_RULE || data.formula !== READING_FORMULA || !Number.isFinite(at)
    || !data.rows || typeof data.rows !== "object" || Array.isArray(data.rows)) return null;
  return { rows: data.rows, computedAt: at };
}

// 반 전체의 순위 줄 — 네 기간(오늘 · 이번 주 · 이번 달 · 누적)의 경험치를 함께 둡니다. 화면이 기간 단추를 누를 때
// 다시 묻지 않고 이것으로 다시 세웁니다(lib/readingJourney.js의 rankingsForPeriod).
function rankingRowsOf(profiles, snapshots, now) {
  const today = kstToday(now);
  return rankingStudents(profiles).map(({ id, data: profile }) => {
    const reading = snapshots.get(id);
    const xpBy = Object.fromEntries(RANKING_PERIODS.map((key) => [key, readingPeriodXp(reading?.events, key, now)]));
    return {
      uid: id,
      name: String(profile.realName || "이름 미설정").slice(0, 40),
      studentId: String(profile.studentId || "").slice(0, 20),
      level: reading?.level || 1,
      xpBy,
      featuredBadge: reading?.featuredBadge || null,
      allTimeXp: xpBy["all-time"],
      // 캐릭터 · 펫은 반 설정과 상관없이 적어 두고, 보낼 때 반 설정을 따릅니다(getReadingRankings)
      character: normalizeReadingCharacter(profile.readingCharacter) ?? null,
      // 캐릭터 옆의 펫 — 프로필의 readingPet(알이면 종 없음)과 이 집계의 누적 경험치로 단계를 셉니다(읽기 0)
      pet: rankingPet(profile.readingPet, reading) ?? null,
      ...memberStats(reading, today),
    };
  });
}

// '세는 중' 표시 걸기 — 다른 요청이 먼저 걸었으면(아직 30초 안) 거짓. 조건부 쓰기로 둘이 함께 걸지 못합니다:
// 있던 장은 읽은 때 그대로일 때만(lastUpdateTime), 없던 장은 아직 없을 때만(create).
async function claimRankingLease(ref, snap) {
  const now = Date.now();
  const until = snap?.exists ? snap.get("leaseUntil") : null;
  if (typeof until?.toMillis === "function" && until.toMillis() > now) return false;
  const lease = { leaseUntil: Timestamp.fromMillis(now + RANKING_LEASE_MS) };
  try {
    if (snap?.exists) await ref.update(lease, { lastUpdateTime: snap.updateTime });
    else await ref.create(lease);
    return true;
  } catch (error) {
    // 9 FAILED_PRECONDITION(그사이 누가 고침) · 6 ALREADY_EXISTS(그사이 누가 만듦) — 다른 요청이 먼저 맡았습니다
    if (error?.code === 9 || error?.code === 6) return false;
    throw error;
  }
}

// 순위를 다시 세어 적기 — '세는 중' 표시를 건 요청 하나만 셉니다. 못 건 요청은 결과를 기다립니다.
async function refreshClassRanking(db, classId, snap, previous) {
  const ref = rankingRef(db, classId);
  if (!(await claimRankingLease(ref, snap))) {
    for (let i = 0; i < RANKING_WAIT_TRIES; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, RANKING_WAIT_MS));
      const next = savedRanking(await ref.get());
      if (next && (!previous || next.computedAt > previous.computedAt)) return next;
    }
    // 기다려도 안 오면 직전 순위를 줍니다(다음 조회가 새것을 받음). 처음이라 직전 것도 없으면 직접 셉니다.
    if (previous) return previous;
  }
  try {
    const { profiles, snapshots } = await readClassRanking(db, classId);
    const now = new Date();
    const rows = Object.fromEntries(rankingRowsOf(profiles, snapshots, now).map((row) => [row.uid, row]));
    const computedAt = now.getTime();
    // set이 장을 통째로 갈아 끼워 '세는 중' 표시도 함께 걷힙니다
    await ref.set({ rule: RANKING_CACHE_RULE, formula: READING_FORMULA, computedAt: Timestamp.fromMillis(computedAt), rows });
    return { rows, computedAt };
  } catch (error) {
    await ref.update({ leaseUntil: FieldValue.delete() }).catch(() => {});
    throw error;
  }
}

// maxAgeMs — 저장한 순위를 그대로 쓰는 시간(기본 10분). 서버 시험만 0을 넘겨 늘 다시 세게 합니다.
export async function getReadingRankings(principal, selectedClassId, period = "weekly", { maxAgeMs = RANKING_REFRESH_MS } = {}) {
  const classId = readingClassId(selectedClassId);
  readingPeriodBounds(period, new Date());
  const { db } = principal;
  const ref = rankingRef(db, classId);
  const first = await db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    return { role: principal.roleClaim || profile?.role || "student", classDoc, snap: await tx.get(ref) };
  }, { readOnly: true });
  // 교사 · 관리자는 순위에 서지 않으므로 저장한 장에 없어도 다시 세지 않습니다
  const ranked = first.role !== "teacher" && first.role !== "admin";
  let saved = savedRanking(first.snap);
  const now = Date.now();
  const missingMe = ranked && saved && !saved.rows[principal.uid] && now - saved.computedAt >= RANKING_MISSING_GAP_MS;
  if (!saved || !rankingCacheFresh(saved.computedAt, now, maxAgeMs) || missingMe) {
    saved = await refreshClassRanking(db, classId, first.snap, saved);
  }
  // 반 설정 — 캐릭터를 끈 반은 기본 캐릭터(null → 화면이 정함), 펫을 끈 반은 펫 없이
  const characterOn = characterChoiceEnabled(first.classDoc);
  const petOn = petEnabled(first.classDoc);
  const rows = Object.values(saved.rows).map((row) => ({
    ...row,
    character: characterOn ? row.character ?? null : null,
    pet: petOn ? row.pet ?? null : null,
  }));
  return rankingResponse(rows, { period, computedAt: new Date(saved.computedAt).toISOString() });
}

// [교사] 저장해 둔 반 순위를 지웁니다 — 학생을 사용 중지 · 반에서 빼기 · 탈퇴시킨 뒤(lib/data/reading.js의
// resetReadingRankings). 다음 조회가 지금 명단으로 다시 셉니다(그 학생의 이름도 저장한 장에서 곧바로 사라짐).
// 담당 교사 · 관리자만. 읽기: 접근 확인 3, 지우기 1.
// studentUid를 함께 주면 그 학생의 책 광장 실시간 입장권 · 자리도 걷습니다(위 dropPlazaLive — 광장에 남은
// 그 학생의 캐릭터가 곧바로 사라지게).
export async function resetReadingRankings(principal, selectedClassId, studentUid = null) {
  const classId = readingClassId(selectedClassId);
  const { db } = principal;
  await db.runTransaction(async (tx) => {
    const { profile } = await readAccessInTransaction(tx, db, principal, classId);
    if (!["teacher", "admin"].includes(principal.roleClaim || profile?.role || "student")) {
      throw new ReadingHttpError("담당 교사만 순위를 다시 셀 수 있습니다.", 403, "reading/forbidden");
    }
    tx.delete(rankingRef(db, classId));
  });
  if (typeof studentUid === "string" && LIVE_KEY.test(studentUid)) await dropPlazaLive(classId, studentUid);
  return { reset: true };
}

// 상단바 '독서 TOP 3' — 한 주에 한 번만 셉니다(서울 시각 월요일 07:00에 바뀜 · 선생님 요청).
//   · 그 주의 첫 요청이 '지난 일요일까지의 기록'으로 셈해 classes/{c}/readingTop/current 한 장에 적습니다
//     (반 명단 · 반 집계 · 프로필 — 반 인원의 세 배쯤을 반마다 한 주에 한 번).
//   · 그 뒤 요청은 접근 확인(3) · 그 한 장(1) · 거기 적힌 학생이 아직 반에 있는지(최대 5)만 읽습니다.
//     반에서 빠진 학생은 빼고 다음 학생이 올라옵니다(그래서 다섯까지 적어 둠). 빠진 학생의 이름은
//     그 한 장에서도 곧바로 지웁니다.
//   · 이 문서는 서버만 읽고 씁니다 — 규칙에 match가 없어 앱에서는 못 읽고, 반 완전 삭제만 지웁니다.
//   · 캐릭터는 셀 때의 것을 적어 두고, 반이 캐릭터를 끄면 보낼 때 기본 캐릭터로 바꿉니다.
//   · 사용 중지된 학생은 순위에 서지 않습니다(rankingStudents). 선생님이 학생을 사용 중지하거나 다시 사용하게
//     하면 그 반의 TOP 3를 그 자리에서 다시 셉니다(refresh — 담당 교사 · 관리자만, lib/data/suspend.js가 부름).
//     셈은 그 주에 처음 셀 때와 같아(지난 일요일까지의 기록) 그 학생 말고는 그대로입니다.
// 한때 모든 화면의 상단바가 2~4분마다 순위를 새로 셌습니다(25명 반 한 차시에 2만 건 남짓).
const READING_TOP_KEEP = 5;
const READING_TOP_SHOW = 3;
// TOP 3를 고르는 기준의 번호 — 기준을 바꾸면 올립니다. 적어 둔 그 주의 TOP 3가 이 번호와 다르면(옛 서버가
// 적은 것) 그 자리에서 한 번 다시 셉니다(반마다 한 번 — 반 인원의 세 배쯤).
// 2 = 사용 중지된 학생 빼기(이미 사용 중지된 학생이 그 주가 끝날 때까지 TOP 3에 남지 않게).
const READING_TOP_RULE = 2;
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
export async function getReadingTop(principal, selectedClassId, { refresh = false } = {}) {
  const classId = readingClassId(selectedClassId);
  const { db } = principal;
  const week = readingTopWeek(new Date());
  const ref = db.doc(`classes/${classId}/readingTop/current`);
  const first = await db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if (refresh && !["teacher", "admin"].includes(principal.roleClaim || profile?.role || "student")) {
      throw new ReadingHttpError("담당 교사만 독서 TOP 3를 다시 셀 수 있습니다.", 403, "reading/forbidden");
    }
    // 관리자 설정의 '독서 TOP 3'를 끈 반(lib/reading.js의 readingTopOn — 리더보드 스위치와는 따로, 선생님 요청)
    if (classDoc?.readingTopEnabled === false) return { topOff: true };
    const characterOn = characterChoiceEnabled(classDoc);
    if (refresh) return { characterOn, saved: null };
    const snap = await tx.get(ref);
    const saved = snap.exists ? snap.data() : null;
    if (!saved || saved.week !== week || saved.formula !== READING_FORMULA || saved.rule !== READING_TOP_RULE
      || !Array.isArray(saved.rows)) return { characterOn, saved: null };
    const rows = saved.rows.filter((r) => typeof r?.uid === "string" && SAFE_UID.test(r.uid)).slice(0, READING_TOP_KEEP);
    const members = rows.length ? await tx.getAll(...rows.map((r) => db.doc(`memberships/${r.uid}_${classId}`))) : [];
    return { characterOn, saved, rows, kept: rows.filter((_, i) => members[i]?.exists) };
  }, { readOnly: true });
  if (first.topOff) throw new ReadingHttpError("이 반에서는 독서 TOP 3를 사용하지 않습니다.", 403, "reading/top-disabled");
  let rows = first.kept;
  if (!first.saved) {
    const { profiles, snapshots } = await readClassRanking(db, classId);
    rows = topReaders(rankingStudents(profiles).map(({ id, data: profile }) => ({
      uid: id,
      name: String(profile.realName || "이름 미설정").slice(0, 40),
      studentId: String(profile.studentId || "").slice(0, 20),
      character: normalizeReadingCharacter(profile.readingCharacter) ?? null,
      ...readingTopAsOf(snapshots.get(id), week),
    })), READING_TOP_KEEP);
    await ref.set({ week, formula: READING_FORMULA, rule: READING_TOP_RULE, rows, computedAt: FieldValue.serverTimestamp() });
  } else if (rows.length !== first.rows.length) {
    await ref.set({ ...first.saved, rows });
  }
  return {
    week,
    rows: rows.slice(0, READING_TOP_SHOW).map((r) => ({ ...r, character: first.characterOn ? r.character ?? null : null })),
  };
}

// ── 독서 펫(lib/readingPet.js) ─────────────────────────────────────
// 알 받기 · 알 깨우기 · 내 펫 보기(/api/reading/pet) — 학생 본인만, '학생 펫'이 켜진 반에서만.
// 종은 알 단계 동안 서버만 읽고 쓰는 users/{uid}/reading/pet에만 있고, 프로필(users/{uid}.readingPet —
// 급우도 읽음)에는 깨어난 뒤에 적습니다(선생님 결정 — 알 단계에서는 비밀). 규칙은 학생 · 교사가
// 프로필의 readingPet을 쓰지 못하게 막습니다(가입해 프로필을 만들 때도 — firestore.rules의 users create).
// 읽기: 접근 확인 3 + 이 반 집계 1(+ 쓸 때 프로필 · 비밀 문서 2). 집계가 옛것이면 먼저 다시 셉니다.
async function petAccess(db, principal, classId) {
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if ((principal.roleClaim || profile?.role || "student") !== "student") {
      throw new ReadingHttpError("펫은 학생만 키워요.", 403, "reading/pet-students-only");
    }
    if (!petEnabled(classDoc)) {
      throw new ReadingHttpError("이 반에서는 학생 펫을 사용하지 않습니다.", 403, "reading/pet-disabled");
    }
    const member = await tx.get(db.doc(`classes/${classId}/readingMembers/${principal.uid}`));
    return { profile, saved: member.exists ? member.data() : null };
  }, { readOnly: true });
}

// 펫이 자라는 바탕 — 이 반 집계의 누적 경험치(리더보드가 셈하는 값과 같음 · 과일은 경험치가 아님).
// 집계가 없거나 옛 기준이면 먼저 다시 셉니다(readClassRanking과 같은 길) — 이미 경험치가 있는
// 학생이 다른 반에서 알을 받을 때 바탕이 0으로 잡혀 단숨에 자라는 일이 없게.
async function petGrowthIn(db, uid, classId, saved) {
  let snapshot = saved;
  if (!hasCurrentReadingSnapshot(snapshot)) {
    await recomputeMember(db, uid, classId);
    const again = await db.doc(`classes/${classId}/readingMembers/${uid}`).get();
    snapshot = again.exists ? again.data() : null;
  }
  return petGrowthXp(snapshot?.totalXp);
}

// [학생] 알 받기(adopt) · 알 깨우기(hatch). 무엇을 쓸지는 lib/readingPet.js의 planPetAction 한 곳이 정합니다.
// 같은 요청이 겹쳐도(두 번 누름 · 두 기기) 트랜잭션 안에서 프로필을 다시 읽어 알은 하나만 생깁니다.
export async function readingPetAction(principal, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || Object.keys(payload).some((key) => !["classId", "action"].includes(key))
    || !["adopt", "hatch"].includes(payload.action)) {
    throw new ReadingHttpError("펫 요청을 확인해 주세요.");
  }
  const classId = readingClassId(payload.classId);
  const { db, uid } = principal;
  const { saved } = await petAccess(db, principal, classId);
  const growthXp = await petGrowthIn(db, uid, classId, saved);
  const randomIndex = randomInt(PET_SPECIES.length);
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const secretRef = db.doc(`users/${uid}/reading/pet`);
    const [profileSnap, secretSnap] = await tx.getAll(userRef, secretRef);
    if (!profileSnap.exists) throw new ReadingHttpError("로그인이 필요합니다.", 401, "reading/unauthenticated");
    const plan = planPetAction({
      action: payload.action,
      mirror: profileSnap.data().readingPet ?? null,
      secretSpecies: secretSnap.exists ? secretSnap.data().species ?? null : null,
      growthXp,
      randomIndex,
      now: Date.now(),
    });
    if (plan.error) throw new ReadingHttpError(plan.error.message, plan.error.status, plan.error.code);
    if (plan.secret) {
      tx.set(secretRef, { species: plan.secret.species, baseXp: plan.secret.baseXp, classId, assignedAt: FieldValue.serverTimestamp() });
    }
    if (plan.mirror) tx.update(userRef, { readingPet: plan.mirror });
    return { pet: plan.pet, event: plan.event };
  });
}

// [학생] 내 펫의 지금 모습 — '내 프로필' 창이 엽니다. 알을 아직 안 받았으면 { pet: null }.
export async function getReadingPet(principal, selectedClassId) {
  const classId = readingClassId(selectedClassId);
  const { db, uid } = principal;
  const { profile, saved } = await petAccess(db, principal, classId);
  const mirror = normalizePetMirror(profile?.readingPet);
  if (!mirror) return { pet: null };
  return { pet: petProgress(mirror, await petGrowthIn(db, uid, classId, saved)) };
}

export function readingErrorResponse(error) {
  if (error instanceof ReadingHttpError) return { status: error.status, body: { error: error.message, code: error.code } };
  // Never expose credential, Admin SDK, or Firestore internals in API responses.
  console.error("[reading] request failed", error?.code || error?.name || "unknown");
  return { status: 500, body: { error: "책나눔 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "reading/internal" } };
}
