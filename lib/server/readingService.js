// Imported exclusively by Next.js route handlers. Never import from client code.
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash, randomInt } from "node:crypto";
import { initialReadingState, deriveReading, applyReadingAction, hideoutOn, kstToday, plazaTalkOn, readingTopDay, READING_FORMULA, teacherBookAction } from "../reading.js";
import { hideoutProgress, normalizeHideoutRoom, sameHideoutArrange, validateHideoutLayout } from "../readingHideout.js";
import { settleHideoutArrange, validateHideoutArrange } from "../readingHideoutArrange.js";
import { isRankedStudent, memberSnapshot, memberStats, RANKING_PERIODS, RANKING_REFRESH_MS, rankingCacheFresh, rankingResponse, readingTopAsOf, topReaders } from "../readingJourney.js";
import { characterChoiceEnabled, hasCurrentReadingSnapshot, normalizeReadingCharacter, profileReadingLevel } from "../readingCharacter.js";
import { normalizePetMirror, PET_SPECIES, petCareRules, petEnabled, petGrowthOfSummary, petGrowthXp, petPreviewOn, petProgress, planPetAction, rankingPet } from "../readingPet.js";
import { careAway, careRulesFor, careSeed, careStatus, careView, planCareFeed, planCareReadDay, planCareRecall, planCareStep, readingDayProof } from "../petCare.js";
import { PLAZA_COMMENT_EDIT_MAX, PLAZA_PLACES, PLAZA_SHARE_RULE, plazaBookKey, plazaCommentText, plazaHasContent, plazaOn, plazaProjection, plazaStable } from "../readingPlaza.js";
import { PLAZA_LIVE_TTL_MS, plazaLiveDatabaseUrl, plazaLivePrune, plazaLiveWho, readPlazaLiveWho } from "../readingPlazaLive.js";
import { TALK_ASK_GRACE_MS, TALK_DELETE_MAX, TALK_MAX, readTalkAsk, talkAskAcceptable, talkIdOk, talkInProgress, talkNewId, talkUidOk } from "../readingPlazaTalk.js";
import { characterOf } from "../readingCharacterCatalog.js";
import { ReadingHttpError, assertReadingAccess, readingClassId, readingPeriodBounds, readingPeriodXp } from "./readingPolicy.js";
import { plazaLiveStore, realtimeStore } from "./plazaLiveStore.js";

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
  throw new ReadingHttpError("책 봄 서버 인증 설정이 필요합니다. 담당 교사에게 문의해 주세요.", 503, "reading/server-not-configured");
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
  // joinedAt — 이 반에 들어온 때(학생의 소속 문서). 펫 먹이가 그날보다 앞의 날을 세지 않게 넘깁니다(lib/petCare.js의 careRulesFor)
  return { profile, classDoc, joinedAt: memberSnap.exists ? memberSnap.data().joinedAt ?? null : null };
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

// 프로필에 적어 두는 독서 레벨(users/{uid}.readingLevel — 레벨 옷 · lib/readingCharacter.js). 상단바 · 프로필 창 · 캐릭터 고르기 창처럼
// 책 봄 요약이 없는 화면이 그 학생의 옷(Lv.7 탐험가 옷 · Lv.10 마스터 옷)을 고를 때 읽습니다. 서버만 적고(규칙 — 가입 때 끼워
// 넣기를 막고, 고치기는 칸 목록에 없음) **레벨이 바뀔 때만** 씁니다 — 독서 저장 · 선생님의 책 정보 고치기 · 반 집계를 다시 셀 때는
// 같은 트랜잭션에서, 이 칸이 생기기 전에 쌓인 기록은 책 봄을 열 때 한 번(backfillReadingLevel). 학생만 — 선생님 · 관리자는
// 늘 Lv.10 옷이라 적지 않습니다(선생님 결정).
function levelMirror(profile, level, role = profile?.role) {
  if (!profile || (role || "student") !== "student") return null;
  const lv = Number.isInteger(level) ? Math.min(10, Math.max(1, level)) : null;
  return lv && profile.readingLevel !== lv ? { readingLevel: lv } : null;
}
async function backfillReadingLevel(principal, profile, level) {
  const role = principal.roleClaim || profile?.role || "student";
  if (!levelMirror(profile, level, role)) return;
  const { db, uid } = principal;
  try {
    // 저장과 엇갈려 옛 레벨로 덮지 않게 — 트랜잭션 안에서 서재를 다시 읽어 셉니다(다를 때만 쓰기 1건).
    await db.runTransaction(async (tx) => {
      const [userSnap, stateSnap] = await tx.getAll(db.doc(`users/${uid}`), db.doc(`users/${uid}/reading/main`));
      if (!userSnap.exists) return;
      const patch = levelMirror(userSnap.data(), deriveReading(stateFromSnapshot(stateSnap), new Date()).level, role);
      if (patch) tx.update(userSnap.ref, patch);
    });
  } catch (error) {
    // 못 맞춰도 책 봄은 그대로 엽니다 — 다음에 열 때 · 저장할 때 다시 맞춥니다.
    console.warn("[책 봄] 프로필의 독서 레벨을 맞추지 못했어요:", error?.code || error?.message);
  }
}

// 한 학생의 반 집계를 지금 기준으로 다시 씁니다(계산 기준이 바뀌었을 때 · 아직 집계가 없을 때 —
// 리더보드 · 독서 TOP 3를 셀 때와 펫의 바탕을 셀 때 부름). 서재 1장 + 프로필 1장(레벨 옷의 레벨) + 그 학생이 든 반 목록을 읽습니다.
async function recomputeMember(db, uid, classId) {
  const classIds = await memberClassIds(db, uid);
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const [snap, userSnap] = await tx.getAll(db.doc(`users/${uid}/reading/main`), db.doc(`users/${uid}`));
    const summary = deriveReading(stateFromSnapshot(snap), now);
    writeMemberSnapshots(tx, db, uid, summary, [classId], classIds);
    // 셈이 바뀌어 레벨이 달라졌으면 프로필의 레벨(레벨 옷)도 함께
    const patch = userSnap.exists ? levelMirror(userSnap.data(), summary.level) : null;
    if (patch) tx.update(userSnap.ref, patch);
  });
}

// studentUid — [교사] 그 반 학생의 책 봄을 읽기 전용으로 볼 때(교사 책 봄의 학생 명단 · 선생님 요청).
// 담당 교사 · 관리자만, 그 반에 소속된 학생만. 쓰기(mutateReading)는 본인 것뿐이고, 하나만 예외 — 선생님의 책 정보 고치기(mutateStudentBook).
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
      if (role !== "teacher" && role !== "admin") throw new ReadingHttpError("담당 교사만 학생의 책 봄을 볼 수 있습니다.", 403, "reading/forbidden");
      const member = await tx.get(db.doc(`memberships/${uid}_${classId}`));
      return member.exists;
    }, { readOnly: true });
    if (!ok) throw new ReadingHttpError("이 반의 학생이 아닙니다.", 404, "reading/not-member");
  }
  let ownProfile = null;
  const state = await db.runTransaction(async (tx) => {
    if (!other) ownProfile = await accessInTransaction(tx, db, principal, classId);
    return stateFromSnapshot(await tx.get(db.doc(`users/${uid}/reading/main`)));
  }, { readOnly: true });
  const result = readingResult(state, new Date());
  // 본인 책 봄 — 프로필의 레벨(레벨 옷)이 다르면 한 번 맞춥니다(다를 때만 · 위 levelMirror)
  if (!other) await backfillReadingLevel(principal, ownProfile, result.summary.level);
  return result;
}

// Personal rooms have no live movement writes. Opening reads once; only an
// explicit changed layout or arrangement (stage 2 — where each piece stands and
// which way it faces) writes one private document. The same transaction
// enforces the class gate and verified owner eligibility (student reading
// growth, or the teacher's own all-decor access without a reading ledger).
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
    }
    const teacher = !other && (role === "teacher" || role === "admin");
    const [main, stored] = teacher
      ? [null, await tx.get(db.doc(`users/${uid}/reading/hideout`))]
      : await tx.getAll(db.doc(`users/${uid}/reading/main`), db.doc(`users/${uid}/reading/hideout`));
    // The role is verified above. Teacher decor access is room eligibility,
    // never student XP, badges, a reading ledger or a client-provided flag.
    const summary = teacher ? null : deriveReading(stateFromSnapshot(main), new Date());
    const progress = teacher ? hideoutProgress(null, { teacher: true }) : hideoutProgress(summary);
    // 방석에서 쉬는 펫이 자란 만큼 그리려면 방 주인의 누적 경험치가 필요합니다(펫의 단계 · 펫 정보 창의 경험치 —
    // lib/readingPet.js의 petProgress). 선생님이 학생의 방을 볼 때는 화면에 그 학생의 책 봄 요약이 없어 이 값이 유일한
    // 바탕입니다(없으면 다 자란 펫도 2단계 · 경험치 0으로 보였음). 숫자 하나뿐이고 책 · 글은 싣지 않습니다.
    // 선생님 본인의 방에는 펫이 없어 싣지 않습니다.
    // 배치(아지트 2단계)는 방 전체를 보고 맞춥니다 — 쓸 수 없게 된 칸(예: 그림이 바뀌어 겹침)은 제자리로(settleHideoutArrange).
    const shaped = normalizeHideoutRoom(stored.exists ? stored.data() : null, progress);
    return {
      room: { ...shaped, arrange: settleHideoutArrange(shaped.layout, shaped.arrange) },
      progress,
      ...(summary ? { petGrowthXp: petGrowthOfSummary(summary) } : {}),
    };
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
  if (!plainHideoutObject(input) || Reflect.ownKeys(input).some((key) => !["version", "layout", "arrange", "revision"].includes(key))
    || input.version !== 2 || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER) {
    throw new ReadingHttpError("아지트 저장 형식을 확인해 주세요.");
  }
  const { db, uid } = principal;
  const roomRef = db.doc(`users/${uid}/reading/hideout`);
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    assertHideoutEnabled(classDoc);
    const role = principal.roleClaim || profile?.role || "student";
    const teacher = role === "teacher" || role === "admin";
    const [main, stored] = teacher ? [null, await tx.get(roomRef)]
      : await tx.getAll(db.doc(`users/${uid}/reading/main`), roomRef);
    const progress = teacher ? hideoutProgress(null, { teacher: true })
      : hideoutProgress(deriveReading(stateFromSnapshot(main), new Date()));
    const current = normalizeHideoutRoom(stored.exists ? stored.data() : null, progress);
    let layout, arrange;
    try {
      layout = validateHideoutLayout(input.layout, progress);
      // 배치(아지트 2단계 — 소품의 자리 · 뒤집기 · 돌리기)는 화면과 같은 규칙으로 다시 확인합니다(바닥 · 벽 안 · 겹침 · 창문 ·
      // 포털 · 포털까지의 길 — lib/readingHideoutArrange.js). 배치 칸이 없는 요청(배치를 모르는 옛 화면)은 저장된 배치를
      // 그대로 두되, 새로 고른 소품과 맞지 않게 된 칸만 제자리로 돌립니다(옛 화면이 학생이 옮겨 둔 자리를 지우지 않게).
      arrange = Object.hasOwn(input, "arrange") ? validateHideoutArrange(layout, input.arrange) : settleHideoutArrange(layout, current.arrange);
    } catch (error) { throw new ReadingHttpError(error?.message || "소품을 확인해 주세요.", 400, error?.code || "reading/invalid-hideout"); }
    const requested = normalizeHideoutRoom({ version: 2, layout, arrange, revision: input.revision }, progress);
    if (current.revision !== input.revision) {
      throw new ReadingHttpError("다른 창에서 아지트가 바뀌었어요. 다시 불러온 뒤 꾸며 주세요.", 409, "reading/hideout-conflict");
    }
    const changed = JSON.stringify(current.layout) !== JSON.stringify(requested.layout) || !sameHideoutArrange(current.arrange, requested.arrange);
    const room = { version: 2, layout: requested.layout, arrange: requested.arrange, revision: current.revision + (changed ? 1 : 0) };
    if (changed) tx.set(roomRef, { ...room, updatedAt: FieldValue.serverTimestamp() });
    return { room, progress };
  });
}

export async function mutateReading(principal, payload) {
  const classId = readingClassId(payload?.classId);
  const action = payload?.action;
  const requestId = payload?.requestId;
  if (!action || typeof action !== "object" || Array.isArray(action)) throw new ReadingHttpError("변경할 내용을 확인해 주세요.");
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) throw new ReadingHttpError("요청 식별자가 올바르지 않습니다.");
  // uid가 나와 다르면 [교사] 그 학생의 책 정보 고치기(아래 mutateStudentBook) — 그 밖의 쓰기는 늘 본인 것뿐입니다.
  if (payload?.uid != null && payload.uid !== principal.uid) {
    return mutateStudentBook(principal, { classId, action, requestId, studentUid: payload.uid });
  }
  const actionHash = createHash("sha256").update(JSON.stringify({ classId, action })).digest("hex");
  const { db, uid } = principal;
  const stateRef = db.doc(`users/${uid}/reading/main`);
  const receiptRef = db.doc(`users/${uid}/readingRequests/${requestId}`);
  const now = new Date();
  return db.runTransaction(async (tx) => {
    const { profile, classDoc, joinedAt } = await readAccessInTransaction(tx, db, principal, classId);
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
    // 펫 먹이(lib/petCare.js) — 오늘 날짜의 발자국이 그 반의 기준(선생님이 정한 쪽수 · 글자 수 — 처음 5쪽 · 250자) 이상이 되면 오늘은 '읽은 날'이라 배부름이 줄지 않고,
    // 떠난 펫에게는 다시 부르기 한 걸음입니다(그날 기록을 지우거나 줄이면 풀림). 프로필 · 반 문서는 접근 확인 때
    // 이미 읽었으므로 읽기는 늘지 않고, 바뀔 때만 프로필에 쓰기 1건입니다.
    const petCare = readingPetCare({ principal, profile, classDoc, joinedAt, summary, now });
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
    // 프로필 — 펫의 배부름(바뀔 때) · 독서 레벨(레벨 옷 — 바뀔 때)을 한 번에 씁니다
    const profilePatch = {
      ...(petCare.care ? { "readingPet.care": petCare.care } : {}),
      ...levelMirror(profile, summary.level, principal.roleClaim || profile?.role),
    };
    if (Object.keys(profilePatch).length) tx.update(db.doc(`users/${uid}`), profilePatch);
    tx.set(receiptRef, { classId, actionHash, createdAt: FieldValue.serverTimestamp() });
    return { state: next, summary, replayed: false, ...(petCare.event ? { petEvent: petCare.event } : {}) };
  });
}

// [교사] 학생의 책 정보 고치기(선생님 요청 · 2026년 11월 — 학생이 잘못 적은 제목 · 지은이 · 쪽수를 선생님이 바로잡게).
//   · 담당 교사 · 관리자만(접근 확인 — 반을 만든 교사), 그 반에 소속된 학생의 책만.
//   · 책 정보만 — 제목 · 지은이 · 전체 쪽수 · 출판사 · ISBN · 표지 · 도서 정보 주소(lib/reading.js의 teacherBookAction이 칸을 거르고
//     다른 요청은 거절). 기록이 있어도 쪽수를 고치고, 완독 · 경험치 · 뱃지는 새 쪽수로 다시 셉니다(updateBook의 byTeacher).
//   · 학생이 저장할 때와 같은 뒷일을 같은 트랜잭션에서 — 반 집계(writeMemberSnapshots) · 책 광장 사본(writePlaza — 이름표는 학생의
//     프로필) · 프로필의 독서 레벨(레벨 옷 — 바뀔 때만). 펫의 배부름은 오늘 남긴 발자국(쪽 · 글자)으로 정하므로 책 정보와 무관해 건드리지 않습니다.
//   · 같은 요청이 두 번 와도 한 번만 — 영수증은 학생의 readingRequests에(고친 사람 by를 함께).
//   · 읽기 — 접근 확인 3 + 학생의 소속 · 프로필 · 서재 · 영수증 4(+ 책 광장 사본 1).
async function mutateStudentBook(principal, { classId, action, requestId, studentUid }) {
  if (typeof studentUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(studentUid)) throw new ReadingHttpError("학생을 확인해 주세요.");
  let teacherAction;
  try { teacherAction = teacherBookAction(action); } catch (error) {
    throw new ReadingHttpError(error?.message || "선생님은 학생의 책 정보만 고칠 수 있어요.", 403, "reading/forbidden");
  }
  const actionHash = createHash("sha256").update(JSON.stringify({ classId, uid: studentUid, action: teacherAction })).digest("hex");
  const { db } = principal;
  const stateRef = db.doc(`users/${studentUid}/reading/main`);
  const receiptRef = db.doc(`users/${studentUid}/readingRequests/${requestId}`);
  const now = new Date();
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    const role = principal.roleClaim || profile?.role || "student";
    if (role !== "teacher" && role !== "admin") throw new ReadingHttpError("담당 교사만 학생의 책 정보를 고칠 수 있습니다.", 403, "reading/forbidden");
    const [member, studentSnap, snap, receipt] = await tx.getAll(db.doc(`memberships/${studentUid}_${classId}`), db.doc(`users/${studentUid}`), stateRef, receiptRef);
    if (!member.exists) throw new ReadingHttpError("이 반의 학생이 아닙니다.", 404, "reading/not-member");
    const state = stateFromSnapshot(snap);
    if (receipt.exists) {
      if (receipt.data().actionHash !== actionHash) throw new ReadingHttpError("같은 요청 식별자로 다른 내용을 보낼 수 없습니다.", 409, "reading/request-conflict");
      return readingResult(state, now, true);
    }
    let next;
    try {
      next = applyReadingAction(state, teacherAction, { uid: studentUid, classId, now: now.toISOString(), id: requestId, byTeacher: true });
    } catch (error) {
      throw new ReadingHttpError(error?.message || "책 정보를 확인해 주세요.");
    }
    if (Buffer.byteLength(JSON.stringify(next), "utf8") > 750000) {
      throw new ReadingHttpError("저장 공간이 가득 찼습니다. 불필요한 독서 기록을 정리해 주세요.", 413, "reading/state-too-large");
    }
    const before = deriveReading(state, now);
    const summary = deriveReading(next, now);
    const plazaKept = plazaOn(classDoc) || classDoc?.plazaSynced != null;
    const plazaShelf = plazaKept || plazaHasContent(state, classId) || plazaHasContent(next, classId)
      ? await tx.get(plazaShelfRef(db, classId, studentUid)) : null;
    tx.set(stateRef, { state: next, updatedAt: FieldValue.serverTimestamp() });
    writeMemberSnapshots(tx, db, studentUid, summary, [classId, ...before.events.map((e) => e.classId)]);
    if (plazaShelf && (plazaKept || plazaShelf.exists)) {
      writePlaza(tx, db, { uid: studentUid, classId, profile: studentSnap.exists ? studentSnap.data() : null, before, summary, shelfSnap: plazaShelf });
    }
    // 쪽수를 고쳐 완독 · 경험치가 바뀌면 학생의 레벨(레벨 옷)도 함께
    const levelPatch = studentSnap.exists ? levelMirror(studentSnap.data(), summary.level) : null;
    if (levelPatch) tx.update(studentSnap.ref, levelPatch);
    tx.set(receiptRef, { classId, actionHash, by: principal.uid, createdAt: FieldValue.serverTimestamp() });
    return { state: next, summary, replayed: false };
  });
}

// 독서를 저장한 뒤 펫의 care를 어떻게 고칠까 — { care(적을 값 · 바뀔 것이 없으면 null), event }.
// 펫 먹이를 켠 반의 학생 · 알을 받은 학생만(선생님 · 관리자는 펫이 없음).
function readingPetCare({ principal, profile, classDoc, joinedAt, summary, now }) {
  // 서버는 '오늘'을 함께 넘깁니다 — 내일보다 뒤로 꾸며 적은 '들어온 날'을 믿지 않게(lib/petCare.js의 careRulesFor)
  const rules = petCareRules(classDoc, joinedAt, kstToday(now));
  if (!rules.on || (principal.roleClaim || profile?.role || "student") !== "student") return { care: null, event: null };
  const mirror = normalizePetMirror(profile?.readingPet);
  if (!mirror) return { care: null, event: null };
  const today = kstToday(now);
  return planCareReadDay({
    mirror, rules, today,
    stage: petProgress(mirror, petGrowthOfSummary(summary))?.stage ?? 1,
    // '읽은 날'의 기준은 그 반의 것(선생님이 관리자 설정에서 정한 쪽수 · 글자 수 — rules.read)
    ok: readingDayProof(summary, today, rules).ok,
  });
}

// ── 책 광장 — 공유 사본(lib/readingPlaza.js) ─────────────────────────────────────
//   · classes/{c}/plazaShelves/{uid}  학생마다 한 장 — 광장에 보이는 책 목록(제목 · 쪽수 · 최근 글 한 줄 · 댓글 수)
//   · classes/{c}/plazaBooks/{uid}_{bookId}  책마다 한 장 — 독서 발자국 · 한 권의 책
//   · classes/{c}/plazaComments/{id}  댓글(책 한 권에 한 줄기) — 쓴 사람이 고치면 text가 바뀌고 edits · editedAt이 붙음('수정됨')
//   · classes/{c}/plazaCommentLog/{id}  댓글을 고치거나 지울 때마다 한 장 — 고치기 전 글 · 고친 글 · 지운 글 · 누가 · 언제 · 어느 책.
//     **담당 선생님만 읽습니다**(규칙 — 반 친구에게는 옛 글이 가지 않음). 선생님의 '댓글 이력'(학생마다 쓴 댓글 · 받은 댓글)이
//     지금 댓글과 이 기록을 묶어 보여 줍니다(lib/readingPlaza.js의 plazaCommentHistory · 선생님 요청).
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
// 댓글 이력 한 장 — 고치기(kind "edit": text = 고치기 전 글 · after = 고친 글)나 지우기(kind "delete": text = 지운 글).
// 이름표 · 책 · 처음 쓴 때는 그 댓글에서 그대로 옮기고, 책 제목은 그때의 사본에서(내려간 책이면 빈 글).
// uid(쓴 사람) · ownerUid(책 주인) 칸이 있어 학생 탈퇴 때 그 학생 몫이 함께 지워지고(규칙의 isWithdrawnRecord),
// 이름이 바뀌면 이름표도 맞춥니다(lib/data/nameSync.js).
function plazaLogRow(comment, commentId, { kind, before, after = "", by, byTeacher, title }) {
  return {
    commentId, kind,
    uid: comment.uid ?? null, name: String(comment.name ?? ""), studentId: String(comment.studentId ?? ""), byTeacher: comment.byTeacher === true,
    book: comment.book ?? null, ownerUid: comment.ownerUid ?? null, bookId: comment.bookId ?? null,
    title: typeof title === "string" ? title.slice(0, 200) : "",
    text: String(before ?? ""), ...(kind === "edit" ? { after: String(after ?? "") } : {}),
    at: comment.at ?? null,
    doneAt: FieldValue.serverTimestamp(), doneBy: by, doneByTeacher: byTeacher === true,
  };
}
function plazaCommentId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ReadingHttpError("댓글을 확인해 주세요.");
  return value;
}
const plazaTargetOk = (comment) => typeof comment?.ownerUid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(comment.ownerUid)
  && typeof comment?.bookId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(comment.bookId);
// 한 학생의 사본을 지금 서재에 맞춥니다. before는 고치기 전의 셈(바뀐 책만 다시 쓰려고 견줌) — 저장해 둔 사본의
// 모양(rule)이 다르거나 이름표가 바뀌었으면 견주지 않고 모두 다시 씁니다.
// 한때 선생님이 책을 광장에서 내리면(blocked) 그 책은 사본을 비웠는데, 그 기능을 걷었습니다(선생님 요청 — 되살리지 마세요).
// 예전 사본에 남은 blocked 칸은 다시 쓸 때 지우고, 내렸던 책도 다른 책처럼 다시 올라옵니다(PLAZA_SHARE_RULE 4로 올려 통째로 다시 씀).
function writePlaza(tx, db, { uid, classId, profile, before, summary, shelfSnap }) {
  const old = shelfSnap?.exists ? shelfSnap.data() : null;
  const who = plazaIdentity(profile);
  const fresh = !old || old.rule !== PLAZA_SHARE_RULE || old.name !== who.name || (old.studentId ?? "") !== who.studentId;
  const was = fresh ? { entries: [], books: {} } : plazaProjection(before, classId);
  const now = plazaProjection(summary, classId);
  // 사본이 아직 없고 실을 글도 없으면(책만 등록한 학생 · 글이 없는 학생) 빈 장을 만들지 않습니다
  if (!old && !now.entries.length) return;
  const leftover = old && Object.prototype.hasOwnProperty.call(old, "blocked");
  const sameShelf = !fresh && !leftover && plazaStable(old.books ?? []) === plazaStable(now.entries);
  if (!sameShelf) {
    // merge — 댓글 수(counts)는 댓글 쪽이 고치는 칸이라 그대로 둡니다(books 배열은 통째로 갈아 끼워짐).
    tx.set(plazaShelfRef(db, classId, uid), {
      uid, ...who, rule: PLAZA_SHARE_RULE, books: now.entries, ...(leftover ? { blocked: FieldValue.delete() } : {}), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  for (const [bookId, content] of Object.entries(now.books)) {
    if (was.books[bookId] && plazaStable(was.books[bookId]) === plazaStable(content)) continue;
    // merge — 댓글 수(comments)는 댓글 쪽이 고치는 칸이라 그대로 둡니다.
    tx.set(plazaBookRef(db, classId, uid, bookId), { uid, ...who, ...content, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  // 광장에서 내려간 책(글을 모두 지움 · 보관함으로 옮김) — 내용을 비웁니다.
  // 문서와 댓글은 남겨, 다시 올라오면 댓글이 이어집니다.
  const gone = new Set(Object.keys(was.books).filter((bookId) => !now.books[bookId]));
  if (fresh) for (const b of Array.isArray(old?.books) ? old.books : []) if (typeof b?.id === "string" && !now.books[b.id]) gone.add(b.id);
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
  const { profile, classDoc, joinedAt, saved } = await db.runTransaction(async (tx) => {
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
    // 먹이를 찾아 떠난 펫은 표시 없이 싣지 않습니다(선생님 결정 — lib/petCare.js)
    pet: !teacher && petEnabled(classDoc) && !careAway(normalizePetMirror(profile?.readingPet), petCareRules(classDoc, joinedAt, kstToday(new Date(now))), kstToday(new Date(now)))
      ? rankingPet(profile?.readingPet, saved) : null,
    // 독서 레벨 — 친구 화면이 내 레벨 옷(Lv.7 · Lv.10)을 고릅니다. 반 집계(지금 셈이면) → 프로필의 레벨 차례, 모르면 싣지 않음(기본 옷).
    // 선생님은 싣지 않습니다(입장권의 r — 받는 쪽이 늘 Lv.10 옷으로 그림).
    level: teacher ? null : hasCurrentReadingSnapshot(saved) ? saved.level : profileReadingLevel(profile),
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
// Realtime Database는 화면에서 지울 수 없어(규칙이 지우기를 막음) 서버가 합니다. 보관된 반 · 책 봄을 끈 반에서도
// 걷을 수 있어야 하므로 책 봄 접근 판정(assertReadingAccess)을 거치지 않고, 그 반을 만든 교사(또는 관리자)인지만 봅니다.
async function plazaClearLive(principal, classId) {
  const { db, uid } = principal;
  const [classSnap, profileSnap] = await db.getAll(db.doc(`classes/${classId}`), db.doc(`users/${uid}`));
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const role = principal.roleClaim || profile?.role || "student";
  const owns = role === "admin" || (role === "teacher" && classSnap.exists && classSnap.data().createdBy === uid);
  if (!owns || profile?.suspended === true) throw new ReadingHttpError("담당 교사만 반의 자료를 걷을 수 있습니다.", 403, "reading/forbidden");
  const store = plazaRealtime();
  if (!store) return { cleared: false };
  try {
    // 입장권 · 자리와 함께 광장 대화의 요청 · 대화 · 기록 찾기도(반을 지우면 그 반의 대화 기록도 사라짐)
    await store.patch({ [`plaza/${classId}`]: null, [`plazaAsk/${classId}`]: null, [`plazaTalk/${classId}`]: null, [`plazaTalkBy/${classId}`]: null });
    return { cleared: true };
  } catch (error) {
    console.warn("[책 광장] 실시간 자료를 걷지 못했어요:", error?.code || error?.message);
    return { cleared: false };
  }
}

// 광장 대화도 함께 걷습니다 — 그 학생에게 온 요청 · 그 학생이 보낸 요청 · 든 대화의 자리(남은 친구들의 대화창에서 빠짐).
// 탈퇴(withdraw)면 그 학생이 대화에 남긴 말 · 이름 · 기록 찾기까지 지웁니다(사용 중지 · 반에서 빼기는 기록을 남김 — 다른 기록과 같은 약속).
async function dropPlazaLive(classId, studentUid, { withdraw = false } = {}) {
  const store = plazaRealtime();
  if (!store) return;
  try {
    const [asks, index] = await Promise.all([store.get(`plazaAsk/${classId}`), store.get(`plazaTalkBy/${classId}/${studentUid}`)]);
    const changes = {
      [`plaza/${classId}/who/${studentUid}`]: null,
      [`plaza/${classId}/pos/${studentUid}`]: null,
      [`plazaAsk/${classId}/${studentUid}`]: null,
    };
    for (const [to, byFrom] of Object.entries(asks && typeof asks === "object" ? asks : {})) {
      if (to !== studentUid && talkUidOk(to) && byFrom && typeof byFrom === "object" && byFrom[studentUid]) changes[`plazaAsk/${classId}/${to}/${studentUid}`] = null;
    }
    const talkIds = Object.keys(index && typeof index === "object" ? index : {}).filter(talkIdOk);
    for (const id of talkIds) changes[`plazaTalk/${classId}/${id}/m/${studentUid}`] = null;
    if (withdraw) {
      changes[`plazaTalkBy/${classId}/${studentUid}`] = null;
      const lines = await Promise.all(talkIds.map((id) => store.get(`plazaTalk/${classId}/${id}/l`).then((l) => [id, l])));
      for (const [id, byId] of lines) {
        for (const [lineId, line] of Object.entries(byId && typeof byId === "object" ? byId : {})) {
          if (line?.u === studentUid) changes[`plazaTalk/${classId}/${id}/l/${lineId}`] = null;
        }
        changes[`plazaTalk/${classId}/${id}/n/${studentUid}`] = null;
      }
    }
    await store.patch(changes);
  } catch (error) {
    console.warn("[책 광장] 실시간 입장권 · 대화를 걷지 못했어요:", error?.code || error?.message);
  }
}

// ── 책 광장의 대화(광장 대화 — 선생님 요청 · 셈과 자료의 모양은 lib/readingPlazaTalk.js 머리말) ─────────────
// 요청 · 말은 화면끼리 Realtime Database로 주고받고(규칙 database.rules.json), **대화에 사람을 넣는 일만 서버가 합니다** —
// 규칙은 Firestore를 읽지 못해 반 설정(광장 대화를 켰나) · 정원 · 늦게 닿은 승인을 스스로 가리지 못합니다.
//   · talkAccept — 받은 사람이 '승인'을 누름: 그 요청이 아직 기다리는 중인지(요청 번호 i까지 같아야 — 거둔 요청 · 지난 요청에
//     늦게 닿은 승인이 대화를 열지 않게), 두 사람의 입장권이 살아 있는지, 둘 다 다른 대화에 들어 있지 않은지(무리로의 초대면
//     초대한 사람이 그 대화에 있는지 · 4명이 넘지 않는지) 본 뒤 대화를 만들거나 넣고, 요청에 ok(대화 번호)를 적습니다(한 번에).
//     이름은 입장권의 이름표(서버가 적은 것)를 옮깁니다.
//   · talkHistory — [담당 교사 · 관리자] 한 학생이 든 대화들(최근 40개)의 말 전부(교사 책 봄의 '광장 대화' 창).
//   · talkDelete — [담당 교사 · 관리자] 그 창에서 대화를 지움(하나 · 여럿 — 아래 plazaTalkDelete).
// 읽기: 접근 확인 3(Firestore) · Realtime Database REST 몇 번(요청 · 입장권 둘 · 두 사람의 대화 찾기).
function plazaRealtime() {
  const url = plazaLiveDatabaseUrl(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
  return url ? realtimeStore(readingAdmin(), url) : null;
}
// 지금 든 대화 — 마지막으로 들어간 대화부터 보며, 아직 그 대화의 사람 목록에 있으면 그 번호
async function plazaTalkOpenFor(store, classId, uid) {
  const index = await store.get(`plazaTalkBy/${classId}/${uid}`, { orderBy: '"$value"', limitToLast: 3 });
  const ids = Object.entries(index && typeof index === "object" ? index : {})
    .filter(([id]) => talkIdOk(id)).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)).map(([id]) => id);
  for (const id of ids) {
    if (await store.get(`plazaTalk/${classId}/${id}/m/${uid}`)) return id;
  }
  return null;
}
async function plazaTalkAccept(principal, classId, payload) {
  const { db, uid } = principal;
  const from = payload.from;
  const askId = payload.askId;
  if (!talkUidOk(from) || from === uid || !talkIdOk(askId) || !LIVE_KEY.test(uid)) throw new ReadingHttpError("대화 요청을 확인해 주세요.");
  const store = plazaRealtime();
  if (!store) throw new ReadingHttpError("이 배포에서는 광장 대화를 쓸 수 없습니다.", 503, "reading/plaza-talk-unavailable");
  const { classDoc } = await db.runTransaction((tx) => readAccessInTransaction(tx, db, principal, classId), { readOnly: true });
  if (!plazaTalkOn(classDoc)) throw new ReadingHttpError("이 반에서는 광장 대화를 사용하지 않습니다.", 403, "reading/plaza-talk-disabled");
  const now = Date.now();
  const [askRaw, myWho, fromWho] = await Promise.all([
    store.get(`plazaAsk/${classId}/${uid}/${from}`),
    store.get(`plaza/${classId}/who/${uid}`),
    store.get(`plaza/${classId}/who/${from}`),
  ]);
  if (!talkAskAcceptable(askRaw, askId, now)) throw new ReadingHttpError("요청이 이미 끝났어요.", 409, "reading/plaza-talk-gone");
  const me = readPlazaLiveWho(myWho, now);
  const them = readPlazaLiveWho(fromWho, now);
  if (!me || !them) throw new ReadingHttpError("친구가 책 광장을 떠났어요.", 409, "reading/plaza-talk-away");
  const ask = readTalkAsk(askRaw, now - TALK_ASK_GRACE_MS);
  const [mine, theirs] = await Promise.all([plazaTalkOpenFor(store, classId, uid), plazaTalkOpenFor(store, classId, from)]);
  let talkId;
  if (ask.k) {
    // 이미 이야기하는 무리로의 초대 — 초대한 사람이 아직 그 대화에 있어야 하고, 4명이 넘지 않아야 합니다
    if (theirs !== ask.k) throw new ReadingHttpError("친구의 대화가 이미 끝났어요.", 409, "reading/plaza-talk-gone");
    const members = await store.get(`plazaTalk/${classId}/${ask.k}/m`);
    const count = Object.keys(members && typeof members === "object" ? members : {}).length;
    if (members?.[uid]) return { talkId: ask.k, invited: true };
    if (count >= TALK_MAX) throw new ReadingHttpError(`대화는 ${TALK_MAX}명까지 함께할 수 있어요.`, 409, "reading/plaza-talk-full");
    talkId = ask.k;
  } else {
    if (theirs) throw new ReadingHttpError("친구가 다른 대화를 시작했어요.", 409, "reading/plaza-talk-busy");
    talkId = talkNewId();
  }
  if (mine && mine !== talkId) throw new ReadingHttpError("이미 다른 친구와 이야기하고 있어요. 그 대화에서 나온 뒤 승인해 주세요.", 409, "reading/plaza-talk-busy");
  const stamp = { ".sv": "timestamp" };
  const member = (ticket) => ({ n: ticket.name, j: stamp, ...(ticket.teacher ? { r: 1 } : {}) });
  const base = `plazaTalk/${classId}/${talkId}`;
  const changes = {
    [`${base}/m/${uid}`]: member(me),
    [`${base}/n/${uid}`]: me.name,
    [`plazaTalkBy/${classId}/${uid}/${talkId}`]: stamp,
    [`plazaAsk/${classId}/${uid}/${from}/ok`]: talkId,
  };
  if (ask.k) {
    changes[`${base}/l/${talkNewId()}`] = { u: uid, s: "join", t: stamp };
  } else {
    changes[`${base}/a`] = stamp;
    changes[`${base}/m/${from}`] = member(them);
    changes[`${base}/n/${from}`] = them.name;
    changes[`plazaTalkBy/${classId}/${from}/${talkId}`] = stamp;
  }
  await store.patch(changes);
  return { talkId, invited: !!ask.k };
}
// [담당 교사 · 관리자] 한 학생의 광장 대화 기록 — 광장을 꺼 둔 반 · 학생이 반에서 빠진 뒤에도 봅니다(댓글 이력과 같은 약속).
const PLAZA_TALK_HISTORY_MAX = 40;
// 담당 교사 · 관리자인가(그 반을 만든 교사 · 사용 중지가 아님) — 광장 대화의 기록 보기 · 지우기가 함께 씁니다.
async function plazaTalkTeacher(principal, classId) {
  const { db, uid } = principal;
  const [classSnap, profileSnap] = await db.getAll(db.doc(`classes/${classId}`), db.doc(`users/${uid}`));
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const role = principal.roleClaim || profile?.role || "student";
  const owns = role === "admin" || (role === "teacher" && classSnap.exists && classSnap.data().createdBy === uid);
  return owns && profile?.suspended !== true;
}
async function plazaTalkHistory(principal, classId, payload) {
  const studentUid = payload.uid;
  if (!talkUidOk(studentUid)) throw new ReadingHttpError("학생을 확인해 주세요.");
  if (!(await plazaTalkTeacher(principal, classId))) throw new ReadingHttpError("담당 교사만 광장 대화 기록을 볼 수 있습니다.", 403, "reading/forbidden");
  const store = plazaRealtime();
  if (!store) return { talks: [], live: false };
  const index = await store.get(`plazaTalkBy/${classId}/${studentUid}`, { orderBy: '"$value"', limitToLast: PLAZA_TALK_HISTORY_MAX });
  const ids = Object.entries(index && typeof index === "object" ? index : {})
    .filter(([id]) => talkIdOk(id)).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)).map(([id]) => id);
  const now = Date.now();
  const talks = await Promise.all(ids.map(async (id) => {
    const raw = await store.get(`plazaTalk/${classId}/${id}`);
    if (!raw || typeof raw !== "object") return null;
    const lines = Object.entries(raw.l && typeof raw.l === "object" ? raw.l : {}).map(([lineId, line]) => ({ id: lineId, ...(line || {}) }));
    // ongoing — 지금 이야기하는 중(기록 창이 그 대화의 '지우기'를 쉬게 함 — 아래 plazaTalkDelete)
    return { id, at: Number(raw.a) || 0, names: raw.n && typeof raw.n === "object" ? raw.n : {}, lines, ongoing: talkInProgress(raw, now) };
  }));
  return { talks: talks.filter(Boolean), live: true };
}
// [담당 교사 · 관리자] 광장 대화 지우기(선생님 요청 · 2026년 11월 — 교사 책 봄의 '광장 대화' 창에서 하나씩 · 모두).
// 대화(plazaTalk/{반}/{대화} — 말 · 이름 · 든 사람)와 **든 적이 있는 모든 사람**의 기록 찾기(plazaTalkBy/{반}/{uid}/{대화})를
// 한 번에 걷습니다 — 함께한 친구들(선생님 포함)의 기록에서도 사라집니다. **지금 이야기하는 중인 대화는 지우지 않고**
// ongoing으로 돌려줍니다(lib/readingPlazaTalk.js의 talkInProgress — 학생의 대화창이 갑자기 비지 않게, 끝난 뒤에 지움).
// 이미 없는 대화는 missing. 반 설정(광장 대화를 껐나)과 상관없이 지웁니다(기록 정리).
// payload { talkIds: [대화 번호 1~40개] } → { deleted: [], ongoing: [], missing: [] }
// 읽기: 접근 확인 2(Firestore) + Realtime Database 대화 수만큼 · 쓰기: 한 번(여러 곳을 한꺼번에).
async function plazaTalkDelete(principal, classId, payload) {
  const ids = [...new Set(Array.isArray(payload.talkIds) ? payload.talkIds : [])];
  if (!ids.length || ids.length > TALK_DELETE_MAX || !ids.every(talkIdOk)) throw new ReadingHttpError("지울 대화를 확인해 주세요.");
  if (!(await plazaTalkTeacher(principal, classId))) throw new ReadingHttpError("담당 교사만 광장 대화를 지울 수 있습니다.", 403, "reading/forbidden");
  const store = plazaRealtime();
  if (!store) throw new ReadingHttpError("이 배포에서는 광장 대화를 쓸 수 없습니다.", 503, "reading/plaza-talk-unavailable");
  const now = Date.now();
  const raws = await Promise.all(ids.map((id) => store.get(`plazaTalk/${classId}/${id}`)));
  const result = { deleted: [], ongoing: [], missing: [] };
  const changes = {};
  ids.forEach((id, index) => {
    const raw = raws[index];
    if (!raw || typeof raw !== "object") { result.missing.push(id); return; }
    if (talkInProgress(raw, now)) { result.ongoing.push(id); return; }
    const people = new Set([
      ...Object.keys(raw.n && typeof raw.n === "object" ? raw.n : {}),
      ...Object.keys(raw.m && typeof raw.m === "object" ? raw.m : {}),
      ...Object.values(raw.l && typeof raw.l === "object" ? raw.l : {}).map((line) => line?.u),
    ].filter(talkUidOk));
    changes[`plazaTalk/${classId}/${id}`] = null;
    for (const person of people) changes[`plazaTalkBy/${classId}/${person}/${id}`] = null;
    result.deleted.push(id);
  });
  if (result.deleted.length) await store.patch(changes);
  return result;
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

// 책 광장에서 하는 일 — 댓글 달기 · 고치기 · 지우기, 실시간 입장, 반의 사본 맞추기.
//   { classId, action: "comment", ownerUid, bookId, text, requestId }  → { comment }
//   { classId, action: "editComment", commentId, text }                → { edited, comment } 쓴 사람만 · 같은 글이면 그대로
//   { classId, action: "deleteComment", commentId }                    → { deleted }
//   (고치기 · 지우기는 같은 트랜잭션에서 이력 한 장을 함께 남깁니다 — plazaLogRow)
//   { classId, action: "block", … } — 한때 [교사] 책을 광장에서 내리기 · 다시 올리기였는데 걷었습니다(선생님 요청).
//     새로고침 전의 옛 화면이 보내면 410으로 거절합니다(reading/plaza-block-removed — 아무것도 읽거나 쓰지 않음).
//   { classId, action: "enter" }                                       → { live, expiresAt } (위 '입장권')
//   { classId, action: "sync" }                                        → { synced, ran } 그 반의 공유 사본을 한 번 통째로 맞춤(위)
//   { classId, action: "clear" }                                       → { cleared } [교사] 반을 완전히 지울 때 실시간 자료도 걷음
//   { classId, action: "talkHistory", uid } · { classId, action: "talkDelete", talkIds } — [교사] 광장 대화 기록 보기 · 지우기(위)
// 광장을 켠 반의 구성원(학생 · 담당 교사 · 관리자)만. 이름표는 서버가 프로필에서 붙입니다(실명 · 학번, 선생님은 '선생님').
export async function plazaAction(principal, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ReadingHttpError("요청 내용을 확인해 주세요.");
  const classId = readingClassId(payload.classId);
  const { db, uid } = principal;
  if (payload.action === "enter") return plazaEnter(principal, classId);
  if (payload.action === "sync") return plazaSyncClass(principal, classId);
  if (payload.action === "clear") return plazaClearLive(principal, classId);
  if (payload.action === "talkAccept") return plazaTalkAccept(principal, classId, payload);
  if (payload.action === "talkHistory") return plazaTalkHistory(principal, classId, payload);
  if (payload.action === "talkDelete") return plazaTalkDelete(principal, classId, payload);
  if (payload.action === "block") throw new ReadingHttpError("이제 책 광장에서 책을 내리지 않아요. 화면을 새로고침해 주세요.", 410, "reading/plaza-block-removed");
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    if (!plazaOn(classDoc)) throw new ReadingHttpError("이 반에서는 책 광장을 사용하지 않습니다.", 403, "reading/plaza-disabled");
    const role = principal.roleClaim || profile?.role || "student";
    const byTeacher = role === "teacher" || role === "admin";
    const comments = db.collection(`classes/${classId}/plazaComments`);
    const commentLog = db.collection(`classes/${classId}/plazaCommentLog`);

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

    if (payload.action === "editComment") {
      const commentId = plazaCommentId(payload.commentId);
      let text;
      try { text = plazaCommentText(payload.text); } catch (error) { throw new ReadingHttpError(error?.message || "댓글을 확인해 주세요."); }
      const commentRef = comments.doc(commentId);
      const commentSnap = await tx.get(commentRef);
      if (!commentSnap.exists) throw new ReadingHttpError("이미 지워진 댓글이에요.", 404, "reading/plaza-comment-gone");
      const comment = commentSnap.data();
      // 고치기는 쓴 사람만(선생님도 학생 댓글은 못 고침 — 지우기만)
      if (comment.uid !== uid) throw new ReadingHttpError("내가 쓴 댓글만 고칠 수 있어요.", 403, "reading/forbidden");
      if (comment.text === text) return { edited: false, comment: { id: commentId, ...plazaCommentView(comment) } };
      const edits = Math.max(0, Number(comment.edits) || 0);
      if (edits >= PLAZA_COMMENT_EDIT_MAX) {
        throw new ReadingHttpError(`댓글은 ${PLAZA_COMMENT_EDIT_MAX}번까지 고칠 수 있어요. 지우고 다시 남겨 주세요.`, 409, "reading/plaza-edit-limit");
      }
      if (!plazaTargetOk(comment)) throw new ReadingHttpError("광장에서 내려간 책이에요.", 404, "reading/plaza-gone");
      const [bookSnap, ownerSnap] = await tx.getAll(plazaBookRef(db, classId, comment.ownerUid, comment.bookId), db.doc(`users/${comment.ownerUid}`));
      const book = bookSnap.exists ? bookSnap.data() : null;
      // 댓글 달기와 같은 약속 — 광장에서 내려간 책 · 사용 중지된 친구의 책에는 고쳐 쓸 수도 없습니다
      if (!book || !PLAZA_PLACES.includes(book.place)) throw new ReadingHttpError("광장에서 내려간 책이에요.", 404, "reading/plaza-gone");
      if (ownerSnap.exists && ownerSnap.data().suspended === true) throw new ReadingHttpError("입력할 수 없습니다.", 403, "reading/plaza-suspended");
      tx.update(commentRef, { text, edits: edits + 1, editedAt: FieldValue.serverTimestamp() });
      tx.set(commentLog.doc(), plazaLogRow(comment, commentId, { kind: "edit", before: comment.text, after: text, by: uid, byTeacher, title: book.title }));
      return { edited: true, comment: { id: commentId, ...plazaCommentView({ ...comment, text, edits: edits + 1 }), editedAt: new Date().toISOString() } };
    }

    if (payload.action === "deleteComment") {
      const commentId = plazaCommentId(payload.commentId);
      const commentRef = comments.doc(commentId);
      const commentSnap = await tx.get(commentRef);
      if (!commentSnap.exists) return { deleted: false };
      const comment = commentSnap.data();
      // 지우기는 쓴 사람과 선생님만(책 주인은 못 지움 — 해시태그 댓글과 같은 약속)
      if (!byTeacher && comment.uid !== uid) throw new ReadingHttpError("내가 쓴 댓글만 지울 수 있어요.", 403, "reading/forbidden");
      let title = "";
      if (plazaTargetOk(comment)) {
        const bookRef = plazaBookRef(db, classId, comment.ownerUid, comment.bookId);
        const shelfRef = plazaShelfRef(db, classId, comment.ownerUid);
        const [bookSnap, shelfSnap] = await tx.getAll(bookRef, shelfRef);
        if (bookSnap.exists) {
          title = typeof bookSnap.data().title === "string" ? bookSnap.data().title : "";
          tx.update(bookRef, { comments: Math.max(0, (Number(bookSnap.data().comments) || 0) - 1) });
        }
        if (shelfSnap.exists) {
          const count = Math.max(0, (Number(shelfSnap.data().counts?.[comment.bookId]) || 0) - 1);
          tx.set(shelfRef, { counts: { [comment.bookId]: count } }, { merge: true });
        }
      }
      tx.delete(commentRef);
      // 지운 글은 선생님만 읽는 이력에 남습니다(누가 지웠나 — 쓴 사람 · 선생님)
      tx.set(commentLog.doc(), plazaLogRow(comment, commentId, { kind: "delete", before: comment.text, by: uid, byTeacher, title }));
      return { deleted: true };
    }

    throw new ReadingHttpError("지원하지 않는 책 광장 요청이에요.");
  });
}
function plazaCommentView(data) {
  const iso = (v) => (typeof v?.toDate === "function" ? v.toDate().toISOString() : null);
  return {
    book: data.book, ownerUid: data.ownerUid, bookId: data.bookId, uid: data.uid, name: data.name, studentId: data.studentId, byTeacher: data.byTeacher === true,
    text: data.text, at: iso(data.at), edits: Math.max(0, Number(data.edits) || 0), editedAt: iso(data.editedAt),
  };
}

// Only the caller's own appearance can be saved. No caller-selected UID,
// arbitrary profile patch, reward value, or reading record is written here.
// 학생 · 선생님 · 관리자 모두 제 캐릭터만 고릅니다('내 프로필' — 선생님도 고르게 · 선생님 요청, 2026년 11월).
// 선생님은 담당 반(관리자는 어느 반이든)에서, 학생은 소속 반에서 — 접근 판정은 책 봄과 같습니다(readAccessInTransaction).
// 고른 값은 프로필 한 칸이라 그 사람의 모든 반에 같고, 선생님의 캐릭터는 책 광장 · 교실 · 아지트에서 늘 Lv.10 옷으로 보입니다.
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
    const { classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    // 리더보드를 꺼 둔 반도 고를 수 있습니다('내 프로필'에서 — 선생님 요청: 리더보드 스위치는 보이는 화면만).
    // 관리자 설정에서 '학생 캐릭터'를 끈 반 — 고르기를 막습니다(lib/readingCharacter.js). 선생님도 같습니다 —
    // 끈 반에서는 광장 · 아지트의 선생님도 기본 캐릭터로 보이므로(plazaEnter · 화면의 characterOn) 고를 까닭이 없습니다.
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
// 하루에 한 번)가 함께 씁니다. 학생 25명 반이면 약 75건(명단 25 + 집계 25 + 프로필 25).
// 한때 접근 확인 · 반 문서 · 명단 · 반 집계를 두 번씩 읽어, 학생 30명 반이면 한 번에 약 157건이었습니다.
async function readClassRanking(db, classId) {
  const read = await db.runTransaction(async (tx) => {
    // 관리자 설정의 '리더보드'는 여기서 보지 않습니다 — 순위는 책 봄과 함께 늘 돌고, 책 봄의 '우리 반 랭킹' 탭이
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
      // 학생마다 이 반에 들어온 때 — 펫 먹이가 그날보다 앞의 날을 세지 않게(읽기는 늘지 않음 — 같은 소속 문서)
      joined: new Map(membersSnap.docs.map((d) => [d.data().uid, d.data().joinedAt ?? null])),
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
// 2 = 줄마다 펫의 care(lib/petCare.js의 careSeed)를 함께 적음 — 보낼 때 '먹이를 찾아 떠났나'를 셈
const RANKING_CACHE_RULE = 2;
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
function rankingRowsOf(profiles, snapshots, now, joined = new Map()) {
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
      // 펫 먹이 — 떠났는지는 보낼 때(반 설정 · 그날 날짜로) 셉니다. 화면에는 보내지 않습니다(getReadingRankings).
      care: careSeed(normalizePetMirror(profile.readingPet), joined.get(id)),
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
    const { profiles, snapshots, joined } = await readClassRanking(db, classId);
    const now = new Date();
    const rows = Object.fromEntries(rankingRowsOf(profiles, snapshots, now, joined).map((row) => [row.uid, row]));
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
  // 펫 먹이를 켠 반 — 먹이를 찾아 떠난 펫은 '떠남' 표시 없이 안 보입니다(선생님 결정 · 본인의 줄도 같음)
  const feed = petCareRules(first.classDoc);
  const today = kstToday(new Date(now));
  const rows = Object.values(saved.rows).map(({ care, ...row }) => ({
    ...row,
    character: characterOn ? row.character ?? null : null,
    pet: petOn && !(care && careAway(care, careRulesFor(feed, care.joined, today), today)) ? row.pet ?? null : null,
  }));
  return rankingResponse(rows, { period, computedAt: new Date(saved.computedAt).toISOString() });
}

// [교사] 저장해 둔 반 순위를 지웁니다 — 학생을 사용 중지 · 반에서 빼기 · 탈퇴시킨 뒤(lib/data/reading.js의
// resetReadingRankings). 다음 조회가 지금 명단으로 다시 셉니다(그 학생의 이름도 저장한 장에서 곧바로 사라짐).
// 담당 교사 · 관리자만. 읽기: 접근 확인 3, 지우기 1.
// studentUid를 함께 주면 그 학생의 책 광장 실시간 입장권 · 자리도 걷습니다(위 dropPlazaLive — 광장에 남은
// 그 학생의 캐릭터가 곧바로 사라지게).
export async function resetReadingRankings(principal, selectedClassId, studentUid = null, { withdraw = false } = {}) {
  const classId = readingClassId(selectedClassId);
  const { db } = principal;
  await db.runTransaction(async (tx) => {
    const { profile } = await readAccessInTransaction(tx, db, principal, classId);
    if (!["teacher", "admin"].includes(principal.roleClaim || profile?.role || "student")) {
      throw new ReadingHttpError("담당 교사만 순위를 다시 셀 수 있습니다.", 403, "reading/forbidden");
    }
    tx.delete(rankingRef(db, classId));
  });
  if (typeof studentUid === "string" && LIVE_KEY.test(studentUid)) await dropPlazaLive(classId, studentUid, { withdraw: withdraw === true });
  return { reset: true };
}

// 상단바 '독서 TOP 3' — 하루에 한 번만 셉니다(서울 시각 날마다 07:00에 바뀜 · 선생님 요청 · 2026년 11월 —
// 한때 월요일 07:00에 한 주에 한 번. 적어 두는 칸 이름 week는 그때 그대로이고 값은 그 하루의 날짜입니다).
//   · 그날의 첫 요청이 '어제까지의 기록'으로 셈해 classes/{c}/readingTop/current 한 장에 적습니다
//     (반 명단 · 반 집계 · 프로필 — 반 인원의 세 배쯤을 반마다 하루에 한 번 · 아무도 안 열면 안 셈).
//   · 그 뒤 요청은 접근 확인(3) · 그 한 장(1) · 거기 적힌 학생이 아직 반에 있는지(최대 5)만 읽습니다.
//     반에서 빠진 학생은 빼고 다음 학생이 올라옵니다(그래서 다섯까지 적어 둠). 빠진 학생의 이름은
//     그 한 장에서도 곧바로 지웁니다.
//   · 이 문서는 서버만 읽고 씁니다 — 규칙에 match가 없어 앱에서는 못 읽고, 반 완전 삭제만 지웁니다.
//   · 캐릭터는 셀 때의 것을 적어 두고, 반이 캐릭터를 끄면 보낼 때 기본 캐릭터로 바꿉니다.
//   · 사용 중지된 학생은 순위에 서지 않습니다(rankingStudents). 선생님이 학생을 사용 중지하거나 다시 사용하게
//     하면 그 반의 TOP 3를 그 자리에서 다시 셉니다(refresh — 담당 교사 · 관리자만, lib/data/suspend.js가 부름).
//     셈은 그날 처음 셀 때와 같아(어제까지의 기록) 그 학생 말고는 그대로입니다.
// 한때 모든 화면의 상단바가 2~4분마다 순위를 새로 셌습니다(25명 반 한 차시에 2만 건 남짓).
const READING_TOP_KEEP = 5;
const READING_TOP_SHOW = 3;
// TOP 3를 고르는 기준의 번호 — 기준을 바꾸면 올립니다. 적어 둔 그날의 TOP 3가 이 번호와 다르면(옛 서버가
// 적은 것) 그 자리에서 한 번 다시 셉니다(반마다 한 번 — 반 인원의 세 배쯤).
// 2 = 사용 중지된 학생 빼기(이미 사용 중지된 학생이 그날이 끝날 때까지 TOP 3에 남지 않게).
const READING_TOP_RULE = 2;
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
export async function getReadingTop(principal, selectedClassId, { refresh = false } = {}) {
  const classId = readingClassId(selectedClassId);
  const { db } = principal;
  const week = readingTopDay(new Date());
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
// 펫을 쓸 수 있는가 — 트랜잭션 안에서 반 문서 · 프로필 · 소속을 읽어 봅니다(책 봄 · 사용 중지 · 소속 · 학생 · 학생 펫).
async function petAccessIn(tx, db, principal, classId) {
  const { profile, classDoc, joinedAt } = await readAccessInTransaction(tx, db, principal, classId);
  if ((principal.roleClaim || profile?.role || "student") !== "student") {
    throw new ReadingHttpError("펫은 학생만 키워요.", 403, "reading/pet-students-only");
  }
  if (!petEnabled(classDoc)) {
    throw new ReadingHttpError("이 반에서는 학생 펫을 사용하지 않습니다.", 403, "reading/pet-disabled");
  }
  return { profile, classDoc, joinedAt };
}

async function petAccess(db, principal, classId) {
  return db.runTransaction(async (tx) => {
    const access = await petAccessIn(tx, db, principal, classId);
    const member = await tx.get(db.doc(`classes/${classId}/readingMembers/${principal.uid}`));
    return { ...access, saved: member.exists ? member.data() : null };
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

// [학생] 알 받기(adopt) · 알 깨우기(hatch) · 먹이 주기(feed — 과일 count개) · 다시 부르기의 과일 걸음(call — 과일 2개) ·
//   펫 고르기(choose — species: 종 열쇠 · 관리자 설정의 '펫 미리보기'를 켠 반에서만 · 알일 때만, lib/readingPet.js의 planPetAction).
// [선생님] 떠난 펫을 불러 주기(recall — uid: 그 학생)는 아래 readingPetRecall.
// 무엇을 쓸지는 lib/readingPet.js의 planPetAction · lib/petCare.js의 planCare…가 정합니다.
// 같은 요청이 겹쳐도(두 번 누름 · 두 기기) 트랜잭션 안에서 프로필 · 과일을 다시 읽어 한 번만 반영됩니다.
// **반 설정 · 소속 · 사용 중지도 그 트랜잭션 안에서 다시 읽어 그 값으로 정합니다** — 처리하는 사이 선생님이 펫 먹이(또는
// 학생 펫 · 책 봄)를 끄거나 학생을 사용 중지 · 반에서 빼면, 과일을 빼기 전에 알아채고 그만둡니다. 한때 트랜잭션 밖
// (petAccess)에서 한 번만 읽은 값으로 셈해, 그 사이에 꺼져도 과일이 빠질 수 있었습니다(검토에서 찾음 · 서버 시험).
// 트랜잭션이 읽은 반 문서를 그 사이 누가 고치면 Firestore가 트랜잭션을 다시 돌려, 늘 고친 뒤의 값으로 셈합니다.
// **과일은 서버가 줄입니다**(rewards/{반}_{학생}.count — 과일 화면 · 규칙은 그대로 두고 개수만. 과일 바구니에 담을 때
// 줄어드는 것과 같이 지급 이력(rewardEvents)에는 적지 않습니다 — 선생님이 준 것의 기록이라서).
export async function readingPetAction(principal, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || Object.keys(payload).some((key) => !["classId", "action", "count", "uid", "species"].includes(key))
    || !["adopt", "hatch", "feed", "call", "recall", "choose"].includes(payload.action)) {
    throw new ReadingHttpError("펫 요청을 확인해 주세요.");
  }
  // 고를 종(species)은 '펫 고르기'에만 — 다른 요청에 끼워 넣지 못하게
  if ((payload.action === "choose") !== (payload.species !== undefined)
    || (payload.species !== undefined && (typeof payload.species !== "string" || payload.species.length > 20))) {
    throw new ReadingHttpError("펫 요청을 확인해 주세요.");
  }
  if (payload.action === "recall") return readingPetRecall(principal, payload);
  if (payload.uid !== undefined) throw new ReadingHttpError("펫 요청을 확인해 주세요.");
  const feeding = payload.action === "feed" || payload.action === "call";
  let want = 1;
  if (payload.count !== undefined) {
    want = Number(payload.count);
    if (payload.action !== "feed" || !Number.isInteger(want) || want < 1 || want > 10) throw new ReadingHttpError("과일 개수를 확인해 주세요.");
  }
  const classId = readingClassId(payload.classId);
  const { db, uid } = principal;
  // 먼저 한 번(읽기만) — 펫이 자라는 바탕(반 집계)을 다시 셀 일이 있으면 트랜잭션 밖에서 해 둡니다
  const { saved } = await petAccess(db, principal, classId);
  const growthXp = await petGrowthIn(db, uid, classId, saved);
  const randomIndex = randomInt(PET_SPECIES.length);
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    // 과일을 빼거나 펫을 고치는 바로 그 트랜잭션에서 다시 확인합니다(위 머리말)
    const { profile, classDoc, joinedAt } = await petAccessIn(tx, db, principal, classId);
    const now = Date.now();
    const today = kstToday(new Date(now));
    const rules = petCareRules(classDoc, joinedAt, today);
    if (feeding) {
      const rewardRef = db.doc(`rewards/${classId}_${uid}`);
      const rewardSnap = await tx.get(rewardRef);
      const mirror = normalizePetMirror(profile.readingPet);
      if (!mirror) throw new ReadingHttpError("아직 받은 알이 없어요.", 404, "reading/pet-missing");
      const fruits = rewardSnap.exists ? Math.max(0, Math.floor(Number(rewardSnap.data().count) || 0)) : 0;
      const stage = petProgress(mirror, growthXp)?.stage ?? 1;
      const plan = payload.action === "feed"
        ? planCareFeed({ mirror, rules, today, stage, fruits, want, now })
        : planCareStep({ mirror, rules, today, stage, fruits });
      if (plan.error) throw new ReadingHttpError(plan.error.message, plan.error.status, plan.error.code);
      tx.update(rewardRef, { count: fruits - plan.used, updatedAt: FieldValue.serverTimestamp() });
      tx.update(userRef, { "readingPet.care": plan.care });
      const next = { ...mirror, care: plan.care };
      return {
        pet: petProgress(next, growthXp), care: careView(careStatus(next, rules, today, stage)),
        event: payload.action === "feed" ? "fed" : plan.event, used: plan.used, fruits: fruits - plan.used,
      };
    }
    // 펫 고르기 — 관리자 설정의 '펫 미리보기'를 켠 반에서만(이 트랜잭션이 읽은 반 문서로 — 도중에 끄면 막힘)
    const choosing = payload.action === "choose";
    if (choosing && !petPreviewOn(classDoc)) {
      throw new ReadingHttpError("이 반에서는 펫 미리보기를 사용하지 않습니다.", 403, "reading/pet-preview-disabled");
    }
    const secretRef = db.doc(`users/${uid}/reading/pet`);
    const secretSnap = await tx.get(secretRef);
    // 고르기는 알일 때만이라(선생님 결정 — 깨어난 펫은 바꾸지 않음) 프로필의 종 · 저장해 둔 반 순위는 건드리지 않습니다
    // (알은 반 친구에게 늘 '신비한 알' — 비밀 문서의 종만 바뀜)
    const plan = planPetAction({
      action: payload.action,
      mirror: profile.readingPet ?? null,
      secretSpecies: secretSnap.exists ? secretSnap.data().species ?? null : null,
      secretChosen: secretSnap.exists && secretSnap.data().chosen === true,
      species: choosing ? payload.species : null,
      growthXp,
      randomIndex,
      now,
      care: rules,
      today,
    });
    if (plan.error) throw new ReadingHttpError(plan.error.message, plan.error.status, plan.error.code);
    if (plan.secret) {
      // chosen — 학생이 고른 종(펫 미리보기)이라 본인에게는 알려 줍니다(getReadingPet). 무작위 알은 지금처럼 본인에게도 비밀.
      tx.set(secretRef, { species: plan.secret.species, baseXp: plan.secret.baseXp, classId, assignedAt: FieldValue.serverTimestamp(),
        ...(plan.secret.chosen ? { chosen: true } : {}) });
    }
    if (plan.mirror) tx.update(userRef, { readingPet: plan.mirror });
    return { pet: plan.pet, event: plan.event, ...(plan.chosen ? { chosen: plan.chosen } : {}) };
  });
}

// [선생님] 먹이를 찾아 떠난 학생의 펫을 불러 줍니다 — 걸음과 상관없이 곧바로(긴 병결 같은 예외 · 선생님 화면의 '불러 주기').
// 담당 교사 · 관리자만, 그 반 학생만, 펫 먹이를 켠 반에서만. 읽기: 접근 확인 3 + 소속 1 + 그 학생의 프로필 1.
async function readingPetRecall(principal, payload) {
  if (payload.count !== undefined) throw new ReadingHttpError("펫 요청을 확인해 주세요.");
  const classId = readingClassId(payload.classId);
  const studentUid = payload.uid;
  if (typeof studentUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(studentUid)) throw new ReadingHttpError("학생을 확인해 주세요.");
  const { db } = principal;
  return db.runTransaction(async (tx) => {
    const { profile, classDoc } = await readAccessInTransaction(tx, db, principal, classId);
    const role = principal.roleClaim || profile?.role || "student";
    if (role !== "teacher" && role !== "admin") throw new ReadingHttpError("담당 교사만 학생의 펫을 불러 줄 수 있습니다.", 403, "reading/forbidden");
    if (!petCareRules(classDoc).on) throw new ReadingHttpError("이 반에서는 펫 먹이를 쓰지 않아요.", 403, "reading/pet-feed-disabled");
    const userRef = db.doc(`users/${studentUid}`);
    const [member, studentSnap] = await tx.getAll(db.doc(`memberships/${studentUid}_${classId}`), userRef);
    if (!member.exists) throw new ReadingHttpError("이 반의 학생이 아닙니다.", 404, "reading/not-member");
    // 그 학생이 이 반에 들어온 때부터 셉니다(선생님 자신의 소속이 아니라 학생의 것)
    const today = kstToday(new Date());
    const rules = petCareRules(classDoc, member.data().joinedAt ?? null, today);
    const mirror = normalizePetMirror(studentSnap.exists ? studentSnap.data().readingPet : null);
    if (!mirror) throw new ReadingHttpError("아직 받은 알이 없어요.", 404, "reading/pet-missing");
    const plan = planCareRecall({ mirror, rules, today });
    if (plan.error) throw new ReadingHttpError(plan.error.message, plan.error.status, plan.error.code);
    tx.update(userRef, { "readingPet.care": plan.care });
    return { event: plan.event, care: careView(careStatus({ ...mirror, care: plan.care }, rules, today)) };
  });
}

// [학생] 내 펫의 지금 모습 — '내 프로필' 창 · 펫 미리보기가 엽니다. 알을 아직 안 받았으면 { pet: null }.
// 펫 먹이를 켠 반이면 배부름(care)도 함께 — 끈 반이면 null.
// chosen — 알이고 학생이 고른 종(펫 미리보기)이면 그 종(본인에게만 · 반 친구에게는 깨어날 때까지 '신비한 알'). 고르지 않은
// 알은 null(지금처럼 본인에게도 비밀). 알일 때만 비밀 문서를 한 건 더 읽습니다.
export async function getReadingPet(principal, selectedClassId) {
  const classId = readingClassId(selectedClassId);
  const { db, uid } = principal;
  const { profile, classDoc, joinedAt, saved } = await petAccess(db, principal, classId);
  const mirror = normalizePetMirror(profile?.readingPet);
  if (!mirror) return { pet: null, care: null, chosen: null };
  const pet = petProgress(mirror, await petGrowthIn(db, uid, classId, saved));
  const today = kstToday(new Date());
  let chosen = null;
  if (!mirror.species) {
    const secret = await db.doc(`users/${uid}/reading/pet`).get();
    const data = secret.exists ? secret.data() : null;
    if (data?.chosen === true && PET_SPECIES.some((s) => s.key === data.species)) chosen = data.species;
  }
  return { pet, care: careView(careStatus(mirror, petCareRules(classDoc, joinedAt, today), today, pet?.stage ?? 1)), chosen };
}

export function readingErrorResponse(error) {
  if (error instanceof ReadingHttpError) return { status: error.status, body: { error: error.message, code: error.code } };
  // Never expose credential, Admin SDK, or Firestore internals in API responses.
  console.error("[reading] request failed", error?.code || error?.name || "unknown");
  return { status: 500, body: { error: "책 봄 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", code: "reading/internal" } };
}
