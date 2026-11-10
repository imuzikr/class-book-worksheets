// Imported exclusively by Next.js route handlers. Never import from client code.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash, randomInt } from "node:crypto";
import { initialReadingState, deriveReading, applyReadingAction, kstToday, readingTopWeek, READING_FORMULA } from "../reading.js";
import { isRankedStudent, memberSnapshot, memberStats, RANKING_PERIODS, readingTopAsOf, topReaders } from "../readingJourney.js";
import { characterChoiceEnabled, hasCurrentReadingSnapshot, normalizeReadingCharacter } from "../readingCharacter.js";
import { normalizePetMirror, PET_SPECIES, petEnabled, petGrowthXp, petProgress, planPetAction, rankingPet } from "../readingPet.js";
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
    tx.set(stateRef, { state: next, updatedAt: FieldValue.serverTimestamp() });
    writeMemberSnapshots(tx, db, uid, summary, [classId, ...before.events.map((e) => e.classId)]);
    tx.set(receiptRef, { classId, actionHash, createdAt: FieldValue.serverTimestamp() });
    return { state: next, summary, replayed: false };
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
    // 리더보드를 꺼 둔 반도 고를 수 있습니다('내 프로필'에서 — 선생님 요청: 리더보드 스위치는 보이는 화면만).
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
      characterOn: characterChoiceEnabled(classDoc),
      // 관리자 설정의 '학생 펫'(lib/readingPet.js) — 끈 반은 리더보드에 펫을 싣지 않습니다
      petOn: petEnabled(classDoc),
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

export async function getReadingRankings(principal, selectedClassId, period = "weekly") {
  const classId = readingClassId(selectedClassId);
  const now = new Date();
  readingPeriodBounds(period, now);
  const { characterOn, petOn, snapshots, profiles } = await readClassRanking(principal.db, principal, classId);
  if (!profiles.length) return { rankings: [], period };
  const rows = rankingStudents(profiles).map(({ id, data: profile }) => {
    const reading = snapshots.get(id);
    // 네 기간(오늘 · 이번 주 · 이번 달 · 누적)의 경험치를 함께 보냅니다 — 화면이 기간 단추를 누를 때 다시 묻지 않고
    // 이것으로 다시 세웁니다(lib/readingJourney.js의 rankingsForPeriod). 같은 집계에서 셈만 넷이라 읽기는 늘지 않습니다.
    // xp · rank는 물어 온 기간의 것 그대로 둡니다(옛 화면이 그것을 씀).
    const xpBy = Object.fromEntries(RANKING_PERIODS.map((key) => [key, readingPeriodXp(reading?.events, key, now)]));
    return {
      uid: id,
      name: String(profile.realName || "이름 미설정").slice(0, 40),
      studentId: String(profile.studentId || "").slice(0, 20),
      level: reading?.level || 1,
      xp: xpBy[period],
      xpBy,
      featuredBadge: reading?.featuredBadge || null,
      allTimeXp: xpBy["all-time"],
      // 캐릭터를 끈 반은 고른 값 대신 기본 캐릭터(null → 화면이 정함)
      character: characterOn ? normalizeReadingCharacter(profile.readingCharacter) : null,
      // 캐릭터 옆의 펫 — 프로필의 readingPet(알이면 종 없음)과 이 집계의 누적 · 과일로 단계를 셉니다(읽기 0)
      pet: petOn ? rankingPet(profile.readingPet, reading) : null,
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
    const { profiles, snapshots } = await readClassRanking(db, principal, classId);
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
