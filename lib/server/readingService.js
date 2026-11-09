// Imported exclusively by Next.js route handlers. Never import from client code.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { initialReadingState, deriveReading, applyReadingAction, kstToday, readingFruitGains, readingTopWeek, READING_FORMULA } from "../reading.js";
import { memberSnapshot, memberStats, readingTopAsOf, topReaders } from "../readingJourney.js";
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

function readingResult(state, now, replayed = false, fruits = []) {
  return { state, summary: deriveReading(state, now, { fruits }), replayed, fruits };
}

// 그 학생이 든 반들(25개까지) — 과일 경험치를 셀 반이자, 반 집계를 함께 고쳐 적을 반.
async function memberClassIds(db, uid) {
  const members = await db.collection("memberships").where("uid", "==", uid).get();
  return [...new Set(members.docs.map((d) => d.data().classId).filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id)))].slice(0, 25);
}

// 과일 경험치 — 그 학생이 든 반들의 지급 이력(classes/{c}/rewardEvents where uid)에서
// '경험치로 칠 과일'을 날짜별로 셉니다(lib/reading.js의 readingFruitGains).
// 트랜잭션 밖에서 읽습니다 — 과일 이력은 독서 기록과 따로 쌓여 같은 커밋에 묶을 까닭이 없습니다.
// **지급 이력 전체를 읽습니다**(학기 말이면 학생 한 명에 수십~100건) — 저장할 때 · 반 집계를 다시 셀 때 ·
// 책나눔을 처음 열 때 · 과일 수가 바뀌었을 때만 부릅니다. 평소 다시 묻기는 반 집계의 allFruits를 씁니다(getReading).
async function fruitsFor(db, uid, classIds = null) {
  const ids = classIds ?? await memberClassIds(db, uid);
  const snaps = await Promise.all(ids.map((c) => db.collection(`classes/${c}/rewardEvents`).where("uid", "==", uid).get()));
  const events = snaps.flatMap((snap) => snap.docs.map((d) => {
    const data = d.data();
    return { classId: data.classId, delta: data.delta, at: data.at?.toDate ? data.at.toDate() : null };
  }));
  return readingFruitGains(events);
}

// 과일 날 목록을 견줄 모양으로 — { classId, date, count }, 날짜 · 반 차례.
function fruitKey(list) {
  return JSON.stringify((Array.isArray(list) ? list : [])
    .map((f) => ({ classId: f?.classId, date: f?.date, count: f?.count }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.classId).localeCompare(String(b.classId))));
}

// 반 집계(리더보드 · 랭킹이 읽음) — 한 학생의 요약을 관련된 반마다 한 장씩.
// alsoClassIds — 그 학생이 든 다른 반들. 25개를 넘지 않는 만큼 함께 고쳐 적습니다(모든 반의 과일 날
// allFruits가 반마다 같은 값이어야, 어느 반에서 책나눔을 열어도 같은 경험치가 나옵니다).
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
  // 모든 반에서 받은 과일 날 — 책나눔을 평소 다시 물을 때(getReading) 지급 이력 대신 이것을 씁니다.
  const allFruits = summary.events.filter((e) => e.kind === "fruit").map((e) => ({ classId: e.classId, date: e.date, count: e.count }));
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
      allFruits,
      formula: READING_FORMULA,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

// 한 학생의 반 집계를 지금 기준으로 다시 씁니다(과일을 받았을 때 · 계산 기준이 바뀌었을 때).
// known — 방금 센 { fruits, classIds }가 있으면 다시 읽지 않습니다(getReading이 고쳐 적을 때).
async function recomputeMember(db, uid, classId, known = null) {
  const classIds = known?.classIds ?? await memberClassIds(db, uid);
  const fruits = known?.fruits ?? await fruitsFor(db, uid, classIds);
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(`users/${uid}/reading/main`));
    const summary = deriveReading(stateFromSnapshot(snap), now, { fruits });
    writeMemberSnapshots(tx, db, uid, summary, [classId], classIds);
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
// fresh — 과일 경험치를 지급 이력에서 다시 셉니다(책나눔을 처음 열 때 · 과일 수가 바뀌었을 때 화면이 보냄).
// 그 밖의 다시 묻기(60초마다 · 탭으로 돌아왔을 때)는 이 반 집계 한 장에 적어 둔 '모든 반의 과일 날'
// (allFruits)로 셉니다 — 접근 확인 3 + 서재 1 + 집계 1. 한때 물을 때마다 그 학생의 지급 이력을
// 통째로 읽었습니다(학기 말이면 한 번에 수십~100건).
export async function getReading(principal, selectedClassId, studentUid = null, { fresh = false } = {}) {
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
  const read = await db.runTransaction(async (tx) => {
    if (!other) await accessInTransaction(tx, db, principal, classId);
    const [snap, member] = await tx.getAll(db.doc(`users/${uid}/reading/main`), db.doc(`classes/${classId}/readingMembers/${uid}`));
    const saved = member.exists ? member.data() : null;
    return {
      state: stateFromSnapshot(snap),
      savedFruits: saved?.formula === READING_FORMULA && Array.isArray(saved.allFruits) ? saved.allFruits : null,
    };
  }, { readOnly: true });
  if (!fresh && read.savedFruits) return readingResult(read.state, new Date(), false, read.savedFruits);
  // 다시 셈 — 집계에 적어 둔 것과 다르면(또는 아직 없으면) 그 자리에서 고쳐 적습니다. 리더보드 · TOP 3 ·
  // 분석 리포트도 같은 집계를 읽으므로, 과일을 준 뒤 '다시 세기'가 실패했어도 여기서 따라잡습니다.
  const classIds = await memberClassIds(db, uid);
  const fruits = await fruitsFor(db, uid, classIds);
  // 집계에 과일 날이 아직 없으면(옛 집계 · 처음 여는 학생) 과일이 0개여도 한 번 적어 둡니다 — 안 그러면 평소 다시 묻기가 늘 이 길로 옵니다.
  if (read.savedFruits === null || fruitKey(fruits) !== fruitKey(read.savedFruits)) {
    await recomputeMember(db, uid, classId, { fruits, classIds })
      .catch((e) => console.error("[reading] snapshot heal failed", e?.code || e?.name));
  }
  return readingResult(read.state, new Date(), false, fruits);
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
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if ((principal.roleClaim || profile?.role || "student") !== "student") {
      throw new ReadingHttpError("학생 본인의 캐릭터만 고칠 수 있어요.", 403, "reading/forbidden");
    }
    if (classDoc?.rankingEnabled === false) {
      throw new ReadingHttpError("이 반에서는 랭킹 시스템을 사용하지 않습니다.", 403, "reading/ranking-disabled");
    }
    // 관리자 설정에서 '학생 캐릭터'를 끈 반 — 고르기를 막습니다(lib/readingCharacter.js).
    if (!characterChoiceEnabled(classDoc)) {
      throw new ReadingHttpError("이 반에서는 캐릭터 고르기를 사용하지 않습니다.", 403, "reading/character-disabled");
    }
    tx.update(db.doc(`users/${uid}`), { readingCharacter: character });
  });
  return { character };
}

// 반 순위를 셀 재료 — 접근 확인(반 문서 포함) · 반 명단 · 반 집계 · 프로필을 읽기 전용 트랜잭션 하나로
// 한 번씩만 읽습니다. 리더보드 · '우리 반 랭킹'(getReadingRankings)과 상단바 '독서 TOP 3'(getReadingTop)가 함께 씁니다.
// 한때 접근 확인 · 반 문서 · 명단 · 반 집계를 두 번씩 읽어, 학생 30명 반이면 한 번에 약 157건이었습니다
// (지금은 약 93건 — 접근 3 + 명단 30 + 집계 30 + 프로필 30).
async function readClassRanking(db, principal, classId) {
  const read = await db.runTransaction(async (tx) => {
    const { classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    // 관리자 설정에서 랭킹 시스템을 끈 반 — 리더보드 · '우리 반 랭킹' · 독서 TOP 3 모두 막습니다(lib/reading.js의 rankingEnabled).
    if (classDoc?.rankingEnabled === false) return { rankingOff: true };
    const [membersSnap, rankingsSnap] = await Promise.all([
      tx.get(db.collection("memberships").where("classId", "==", classId)),
      tx.get(db.collection(`classes/${classId}/readingMembers`)),
    ]);
    const memberUids = [...new Set(membersSnap.docs.map((d) => d.data().uid))];
    const ids = memberUids.filter((id) => typeof id === "string" && id && !id.includes("/"));
    const profileSnaps = ids.length ? await tx.getAll(...ids.map((id) => db.doc(`users/${id}`))) : [];
    return {
      rankingOff: false,
      characterOn: characterChoiceEnabled(classDoc),
      memberUids,
      profiles: profileSnaps.filter((s) => s.exists).map((s) => ({ id: s.id, data: s.data() })),
      snapshots: new Map(rankingsSnap.docs.map((d) => [d.id, d.data()])),
    };
  }, { readOnly: true });
  if (read.rankingOff) throw new ReadingHttpError("이 반에서는 랭킹 시스템을 사용하지 않습니다.", 403, "reading/ranking-disabled");
  const { snapshots } = read;
  // 계산 기준이 바뀌었거나(formula) 아직 집계가 없는 학생은 먼저 다시 세고, 그 학생들의 집계만 다시 읽습니다 —
  // 연속 보너스 상한 · 최소 쪽수 · 과일이 들어오기 전의 집계가 순위에 섞이지 않게.
  const stale = read.memberUids.filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id) && !hasCurrentReadingSnapshot(snapshots.get(id)));
  for (let i = 0; i < stale.length; i += 5) {
    await Promise.all(stale.slice(i, i + 5).map((id) => recomputeMember(db, id, classId).catch((e) => console.error("[reading] recompute failed", e?.code || e?.name))));
  }
  if (stale.length) {
    const refreshed = await db.getAll(...stale.map((id) => db.doc(`classes/${classId}/readingMembers/${id}`)));
    for (const snap of refreshed) {
      if (snap.exists) snapshots.set(snap.id, snap.data());
    }
  }
  return read;
}

// 순위 한 줄에 보일 학생 — 교사 · 관리자 계정은 뺍니다.
function rankingStudents(profiles) {
  return profiles.filter(({ data }) => (data.role || "student") === "student");
}

export async function getReadingRankings(principal, selectedClassId, period = "weekly") {
  const classId = readingClassId(selectedClassId);
  const now = new Date();
  readingPeriodBounds(period, now);
  const { characterOn, snapshots, profiles } = await readClassRanking(principal.db, principal, classId);
  if (!profiles.length) return { rankings: [], period };
  const rows = rankingStudents(profiles).map(({ id, data: profile }) => {
    const reading = snapshots.get(id);
    return {
      uid: id,
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
}

// 상단바 '독서 TOP 3' — 한 주에 한 번만 셉니다(서울 시각 월요일 07:00에 바뀜 · 선생님 요청).
//   · 그 주의 첫 요청이 '지난 일요일까지의 기록'으로 셈해 classes/{c}/readingTop/current 한 장에 적습니다
//     (반 명단 · 반 집계 · 프로필 — 반 인원의 세 배쯤을 반마다 한 주에 한 번).
//   · 그 뒤 요청은 접근 확인(3) · 그 한 장(1) · 거기 적힌 학생이 아직 반에 있는지(최대 5)만 읽습니다.
//     반에서 빠진 학생은 빼고 다음 학생이 올라옵니다(그래서 다섯까지 적어 둠). 빠진 학생의 이름은
//     그 한 장에서도 곧바로 지웁니다.
//   · 이 문서는 서버만 읽고 씁니다 — 규칙에 match가 없어 앱에서는 못 읽고, 반 완전 삭제만 지웁니다.
//   · 캐릭터는 셀 때의 것을 적어 두고, 반이 캐릭터를 끄면 보낼 때 기본 캐릭터로 바꿉니다.
// 한때 모든 화면의 상단바가 2~4분마다 순위를 새로 셌습니다(25명 반 한 차시에 2만 건 남짓).
const READING_TOP_KEEP = 5;
const READING_TOP_SHOW = 3;
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
export async function getReadingTop(principal, selectedClassId) {
  const classId = readingClassId(selectedClassId);
  const { db } = principal;
  const week = readingTopWeek(new Date());
  const ref = db.doc(`classes/${classId}/readingTop/current`);
  const first = await db.runTransaction(async (tx) => {
    const { classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if (classDoc?.rankingEnabled === false) return { rankingOff: true };
    const characterOn = characterChoiceEnabled(classDoc);
    const snap = await tx.get(ref);
    const saved = snap.exists ? snap.data() : null;
    if (!saved || saved.week !== week || saved.formula !== READING_FORMULA || !Array.isArray(saved.rows)) return { characterOn, saved: null };
    const rows = saved.rows.filter((r) => typeof r?.uid === "string" && SAFE_UID.test(r.uid)).slice(0, READING_TOP_KEEP);
    const members = rows.length ? await tx.getAll(...rows.map((r) => db.doc(`memberships/${r.uid}_${classId}`))) : [];
    return { characterOn, saved, rows, kept: rows.filter((_, i) => members[i]?.exists) };
  }, { readOnly: true });
  if (first.rankingOff) throw new ReadingHttpError("이 반에서는 랭킹 시스템을 사용하지 않습니다.", 403, "reading/ranking-disabled");
  let rows = first.kept;
  if (!first.saved) {
    const { profiles, snapshots } = await readClassRanking(db, principal, classId);
    rows = topReaders(rankingStudents(profiles).map(({ id, data: profile }) => ({
      uid: id,
      name: String(profile.realName || "이름 미설정").slice(0, 40),
      studentId: String(profile.studentId || "").slice(0, 20),
      character: normalizeReadingCharacter(profile.readingCharacter) ?? null,
      ...readingTopAsOf(snapshots.get(id), week),
    })), READING_TOP_KEEP);
    await ref.set({ week, formula: READING_FORMULA, rows, computedAt: FieldValue.serverTimestamp() });
  } else if (rows.length !== first.rows.length) {
    await ref.set({ ...first.saved, rows });
  }
  return {
    week,
    rows: rows.slice(0, READING_TOP_SHOW).map((r) => ({ ...r, character: first.characterOn ? r.character ?? null : null })),
  };
}

export function readingErrorResponse(error) {
  if (error instanceof ReadingHttpError) return { status: error.status, body: { error: error.message, code: error.code } };
  // Never expose credential, Admin SDK, or Firestore internals in API responses.
  console.error("[reading] request failed", error?.code || error?.name || "unknown");
  return { status: 500, body: { error: "책나눔 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "reading/internal" } };
}
