// One boundary for the in-memory demo and the authenticated reading API.
// No XP, badge, or ranking totals are written through the browser Firestore SDK.
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { demoSuspendedSet, getCurrentUser, isAdmin, isTeacher } from "../user";
import { applyReadingAction, deriveReading, initialReadingState, kstToday, readingEnabled, readingTopOn, readingTopWeek } from "../reading";
import { dailyXp, isRankedStudent, memberSnapshot, memberStats, RANKING_PERIODS, rankingResponse, readingTopAsOf, topReaders } from "../readingJourney";
import { characterChoiceEnabled, normalizeReadingCharacter } from "../readingCharacter";
import { normalizePetMirror, PET_SPECIES, petEnabled, petGrowthOfSummary, petProgress, planPetAction, rankingPet } from "../readingPet";
import { createDemoPet } from "../demoPets";
import { DEMO_STUDENTS } from "../demoClassroom";
import { mock, mockListeners } from "./shared";
import { buildMockDirectory } from "./users";
import { createDemoReadingStates } from "../demoReading";
import { startVisiblePoll } from "../visiblePoll";

const states = new Map();
const listeners = new Set();
const queues = new Map();
const MAX_RECEIPTS = 1000;
const receipts = new Map();
const revisions = new Map();
const identity = () => getCurrentUser();
let demoSeeded = false;
const demoCharacterKey = (uid) => `bookbom.reading.character.v1:${encodeURIComponent(uid)}`;

function demoCharacter(uid, profile) {
  try {
    if (typeof window !== "undefined") {
      const stored = normalizeReadingCharacter(JSON.parse(window.localStorage.getItem(demoCharacterKey(uid))));
      if (stored) return stored;
    }
  } catch { /* A blocked or malformed demo preference is not reading data. */ }
  return normalizeReadingCharacter(profile?.readingCharacter);
}

function ensureDemoReading() {
  if (isFirebaseConfigured || demoSeeded) return;
  const fixtures = createDemoReadingStates();
  for (const [uid, state] of Object.entries(fixtures)) {
    if (!states.has(uid)) states.set(uid, state);
  }
  demoSeeded = true;
}

// The dashboard derives demo statistics from the same editable in-memory state
// as the library. Live reading data must always go through the server API.
export function demoReadingStatesForDashboard(uids = []) {
  if (isFirebaseConfigured) throw fail("실제 독서 자료는 서버에서만 집계할 수 있어요.");
  ensureDemoReading();
  return Object.fromEntries([...new Set(uids)].map((uid) => [uid, structuredClone(states.get(uid) ?? initialReadingState())]));
}

function fail(message, code = "permission-denied") {
  return Object.assign(new Error(message), { code });
}

function demoAccess(classId, uid, { teacherView = false } = {}) {
  const user = identity();
  const cls = mock.classes.find((c) => c.id === classId);
  if (!readingEnabled(cls)) throw fail("이 반은 책나눔 성장 기능을 사용하지 않아요.", "reading-disabled");
  // 교사가 그 반 학생의 책나눔을 읽기 전용으로 볼 때(서버의 getReading studentUid와 같은 판정)
  if (teacherView && user?.uid && uid && uid !== user.uid) {
    const owns = isAdmin(user) || (isTeacher(user) && cls.createdBy === user.uid);
    if (!owns) throw fail("담당 교사만 학생의 책나눔을 볼 수 있어요.");
    if (!mock.memberships?.some((m) => m.classId === classId && m.uid === uid)) throw fail("이 반의 학생이 아니에요.");
    return user;
  }
  if (!user?.uid || (uid && uid !== user.uid)) throw fail("본인의 독서 기록만 열 수 있어요.");
  const allowed = isAdmin(user) || (isTeacher(user) ? cls.createdBy === user.uid
    : mock.memberships?.some((m) => m.classId === classId && m.uid === user.uid));
  if (!allowed) throw fail("이 반의 구성원만 사용할 수 있어요.");
  return user;
}

async function request(path, options = {}) {
  const current = auth?.currentUser;
  if (!current) throw fail("로그인 후 다시 시도해 주세요.", "unauthenticated");
  const token = await current.getIdToken();
  const response = await fetch(path, {
    ...options, cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(body.error || "독서 기록을 처리하지 못했어요.", body.code);
  return body;
}

// uid가 나와 다르면 [교사] 그 학생의 책나눔을 읽기만 합니다(서버 GET ?uid= — 담당 교사 · 그 반 학생만).
//
// 정본은 서버만 읽어 Firestore 실시간 구독을 못 쓰므로, 서버에 다시 묻는 것으로 대신합니다.
// 언제 묻나(한때 10초마다, 숨은 탭에서도 물어 학생 한 명이 1분에 수십 건을 읽었습니다):
//   · 처음 한 번 · 내가 저장한 뒤(mutateReading이 부름)
//   · 탭으로 돌아왔을 때 · 그 밖에는 화면이 보일 때만 60초마다(lib/visiblePoll.js — 다른 기기에서 쓴 기록)
//   한때 그 반의 과일 수가 바뀌어도 곧바로 물었습니다(과일이 경험치였을 때 — 걷음, 과일은 이제 펫 먹이로만).
//   반 설정(책나눔 끄기 · 랭킹 · 캐릭터)은 페이지가 반 문서를 실시간으로 받아 화면을 닫거나 바꿉니다.
// 받은 내용이 지난번과 같으면 화면에 넘기지 않습니다(새 객체가 오면 화면 전체가 다시 그려짐).
// pollOptions — 되풀이 주기(lib/visiblePoll.js). 리더보드는 그 화면의 순위와 같이 10분 · 돌아올 때 5분을 넘깁니다.
export function subscribeReadingState(classId, uid, onValue, onError = () => {}, pollOptions = {}) {
  const viewing = !!uid && uid !== identity()?.uid;
  let alive = true;
  let pending = false;
  let rerun = false;
  let lastJson = null;
  let poll = null;
  const deliver = (value) => {
    const json = JSON.stringify(value);
    if (json === lastJson) return;
    lastJson = json;
    onValue(value);
  };
  const run = async () => {
    if (!alive) return;
    if (pending) { rerun = true; return; }
    // 어느 길로 묻든(처음 · 저장 뒤 · 돌아옴) 방금 물었다고 적어 둡니다 — 곧이어 오는 주기는 건너뜁니다.
    poll?.mark();
    pending = true;
    const revision = revisions.get(uid) ?? 0;
    try {
      if (isFirebaseConfigured) {
        const data = await request(`/api/reading?classId=${encodeURIComponent(classId)}${viewing ? `&uid=${encodeURIComponent(uid)}` : ""}`);
        if (alive && revision === (revisions.get(uid) ?? 0)) deliver(data.state);
      } else {
        demoAccess(classId, uid, { teacherView: viewing });
        ensureDemoReading();
        if (alive) deliver(structuredClone(states.get(uid) ?? initialReadingState()));
      }
    } catch (error) {
      // 실패한 뒤 같은 내용이 다시 와도 화면이 되살아나도록 지난 값을 잊습니다.
      lastJson = null;
      if (alive) onError(error);
    }
    finally {
      pending = false;
      if (alive && rerun) {
        rerun = false;
        run();
      }
    }
  };
  const emit = () => run();
  listeners.add(emit);
  // The demo responds to the same class toggle immediately, including disable.
  if (!isFirebaseConfigured) mockListeners.classes.add(emit);
  else poll = startVisiblePoll(emit, pollOptions);
  emit();
  return () => {
    alive = false;
    poll?.stop();
    listeners.delete(emit);
    mockListeners.classes.delete(emit);
  };
}

export async function mutateReading(classId, action, requestId = globalThis.crypto.randomUUID()) {
  const user = identity();
  if (!user?.uid) throw fail("로그인 후 다시 시도해 주세요.", "unauthenticated");
  const uid = user.uid;
  // Serialize local requests, matching server transactions under rapid clicks.
  const previous = queues.get(uid) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    if (isFirebaseConfigured) {
      const result = await request("/api/reading", { method: "POST", body: JSON.stringify({ classId, action, requestId }) });
      revisions.set(uid, (revisions.get(uid) ?? 0) + 1);
      listeners.forEach((emit) => emit());
      return result;
    }
    demoAccess(classId, uid);
    ensureDemoReading();
    const key = `${uid}:${requestId}`;
    const signature = JSON.stringify({ classId, action });
    if (receipts.has(key) && receipts.get(key) !== signature) throw fail("같은 요청으로 다른 내용을 보낼 수 없어요.", "reading/request-conflict");
    if (!receipts.has(key)) {
      const next = applyReadingAction(states.get(uid) ?? initialReadingState(), action,
        { classId, now: new Date(), id: requestId, uid });
      states.set(uid, next);
      receipts.set(key, signature);
      if (receipts.size > MAX_RECEIPTS) receipts.delete(receipts.keys().next().value);
    }
    const state = structuredClone(states.get(uid) ?? initialReadingState());
    // 구독에 알리는 것은 이 저장의 답을 돌려준 **뒤에** — 실서비스는 구독이 서버에 다시 묻느라 늘 늦게 오는데,
    // 데모만 곧바로 알리면 책나눔이 '레벨 n 달성!'을 띄운 직후 저장 알림('오늘의 독서를 기록했어요.')이
    // 그 줄을 덮어써, 데모에서는 레벨 알림이 한 번도 안 보였습니다.
    setTimeout(() => listeners.forEach((emit) => emit()), 0);
    return { state, summary: deriveReading(state, new Date()) };
  });
  queues.set(uid, operation);
  try { return await operation; }
  finally { if (queues.get(uid) === operation) queues.delete(uid); }
}

// 데모 — 순위에 설 학생의 프로필(교사 · 관리자 · 사용 중지된 학생이면 null — lib/readingJourney.js의 isRankedStudent).
// 체험 학생의 사용 중지 표시는 이 브라우저에 남겨 둔 목록(demoSuspendedSet)에도 있습니다(lib/data/suspend.js).
function demoRankedProfile(uid, user, dir, suspended) {
  const profile = uid === user.uid ? user : dir.find((p) => p.uid === uid) ?? {};
  return isRankedStudent({ ...profile, suspended: profile.suspended === true || suspended.has(uid) }) ? profile : null;
}

// 반 순위 — 서버가 10분에 한 번 셈해 저장한 것을 받습니다(lib/server/readingService.js의 getReadingRankings).
// 학생 · 교사 모두 반 전체입니다(선생님 결정 — lib/readingJourney.js의 rankingResponse). 줄마다 네 기간
// (오늘 · 이번 주 · 이번 달 · 누적)의 경험치(xpBy)가 함께 와서, 화면은 기간 단추를 누르면 rankingsForPeriod로
// 다시 세웁니다(다시 묻지 않음 — 선생님 요청). period는 줄의 xp · rank가 어느 기간의 것인지만 정합니다(옛 화면이 씀).
// 돌려주는 값: { period, computedAt(센 때 — 화면의 '오후 6:30 기준'), refreshMs, rankings }.
// 데모는 그 자리에서 셉니다(저장 없이 — 브라우저 안이라 읽기 비용이 없음).
export async function fetchReadingRankings(classId, period = "weekly") {
  if (!RANKING_PERIODS.includes(period)) throw fail("랭킹 기간을 확인해 주세요.", "reading/invalid-request");
  if (isFirebaseConfigured) {
    return request(`/api/reading/rankings?classId=${encodeURIComponent(classId)}&period=${encodeURIComponent(period)}`);
  }
  const user = demoAccess(classId);
  // 리더보드를 꺼 둔 반도 순위를 줍니다 — 책나눔의 '우리 반 랭킹' 탭이 씀(서버 getReadingRankings와 같음).
  ensureDemoReading();
  const dir = buildMockDirectory();
  const off = demoSuspendedSet();
  const members = new Set((mock.memberships ?? []).filter((m) => m.classId === classId).map((m) => m.uid));
  const rows = [...members].map((uid) => {
    const profile = demoRankedProfile(uid, user, dir, off);
    if (!profile) return null;
    const summary = deriveReading(states.get(uid) ?? initialReadingState(), new Date());
    const scores = summary.classScores?.[classId] ?? {};
    // 서버와 같은 모양 — 네 기간의 경험치(xpBy)를 함께 둬 기간 단추가 다시 묻지 않게(lib/readingJourney.js의 rankingsForPeriod).
    const xpBy = { daily: scores.daily ?? 0, weekly: scores.weekly ?? 0, monthly: scores.monthly ?? 0, "all-time": scores.allTime ?? 0 };
    return { uid, name: profile.realName || "이름 미설정", studentId: profile.studentId || "",
      level: summary.level, xp: xpBy[period], xpBy,
      featuredBadge: summary.featuredBadge?.id ?? null,
      allTimeXp: xpBy["all-time"],
      character: characterChoiceEnabled(mock.classes.find((c) => c.id === classId)) ? demoCharacter(uid, profile) : null,
      // 서버와 같은 셈 — 프로필의 펫(데모는 demoPets)과 누적 경험치(lib/readingPet.js의 rankingPet)
      pet: petEnabled(mock.classes.find((c) => c.id === classId)) ? rankingPet(demoPetMirror(uid), memberSnapshot(summary)) : null,
      ...memberStats(memberSnapshot(summary), kstToday()) };
  }).filter(Boolean);
  return rankingResponse(rows, { period, computedAt: new Date().toISOString() });
}

// [교사] 저장해 둔 반 순위를 지웁니다 — 학생이 순위에서 빠지거나 돌아오는 일(사용 중지 · 반에서 빼기 · 탈퇴) 뒤에
// 부릅니다(lib/data/suspend.js · removeFromClass.js · withdraw.js). 다음 조회가 지금 명단으로 다시 셉니다 —
// 안 지우면 그 학생이 10분까지 순위에 남고, 아무도 안 보면 저장한 장에 이름이 계속 남습니다.
// 책나눔이 켜진 반만. 기다리지 않습니다(못 지워도 부른 일은 그대로 · 10분 뒤 저절로 맞춰짐). 데모는 할 일이 없습니다.
export function resetReadingRankings(classes = [], label = "반 순위") {
  if (!isFirebaseConfigured) return;
  for (const c of classes) {
    if (!c?.id || c.archived || !readingEnabled(c)) continue;
    request("/api/reading/rankings", { method: "POST", body: JSON.stringify({ classId: c.id }) })
      .catch((e) => console.warn(`[${label}] 저장해 둔 반 순위를 지우지 못했어요:`, e?.code || e?.message));
  }
}

// 상단바 '독서 TOP 3' — 한 주 내내 같은 셋입니다(서울 시각 월요일 07:00에 바뀜 · lib/reading.js의
// readingTopWeek). 서버가 반마다 한 주에 한 번 '지난 일요일까지의 기록'으로 셈해 적어 둔 것을
// 받습니다(getReadingTop). 데모는 같은 셈(readingTopAsOf)을 그 자리에서 합니다.
// 돌려주는 값: { week: 그 주가 시작한 월요일 'YYYY-MM-DD', rows: 셋까지 }.
export async function fetchReadingTop(classId) {
  if (isFirebaseConfigured) {
    const data = await request(`/api/reading/top?classId=${encodeURIComponent(classId)}`);
    return { week: data.week, rows: Array.isArray(data.rows) ? data.rows : [] };
  }
  const user = demoAccess(classId);
  const cls = mock.classes.find((c) => c.id === classId);
  if (cls?.readingTopEnabled === false) throw fail("이 반에서는 독서 TOP 3를 사용하지 않습니다.", "reading/top-disabled");
  ensureDemoReading();
  const week = readingTopWeek();
  const dir = buildMockDirectory();
  const off = demoSuspendedSet();
  const characterOn = characterChoiceEnabled(cls);
  const members = new Set((mock.memberships ?? []).filter((m) => m.classId === classId).map((m) => m.uid));
  const rows = [...members].map((uid) => {
    const profile = demoRankedProfile(uid, user, dir, off);
    if (!profile) return null;
    const summary = deriveReading(states.get(uid) ?? initialReadingState(), new Date());
    return { uid, name: profile.realName || "이름 미설정", studentId: profile.studentId || "",
      character: characterOn ? demoCharacter(uid, profile) : null,
      ...readingTopAsOf({ xpDays: dailyXp(summary.events) }, week) };
  }).filter(Boolean);
  return { week, rows: topReaders(rows, 3) };
}

// [교사] 학생을 사용 중지하거나 다시 사용하게 한 뒤 — 그 반의 이번 주 TOP 3를 지금 다시 셉니다(lib/data/suspend.js가 부름).
// 사용 중지된 학생은 TOP 3에 서지 않는데(lib/readingJourney.js의 isRankedStudent), TOP 3는 한 주에 한 번만 세므로
// 다시 세지 않으면 다음 월요일 07:00까지 그대로 남습니다. 셈은 그 주에 처음 셀 때와 같습니다(서버 POST — 담당 교사 · 관리자만).
// 다시 센 것은 READING_TOP_EVENT로 알려 상단바(components/ClassTopReaders.jsx)가 곧바로 바꿉니다. 다른 사람의 화면은
// 그 주 안에서는 다시 묻지 않으므로, 다음에 앱을 열 때 새것을 받습니다.
export const READING_TOP_EVENT = "bookbom:reading-top";
export async function refreshReadingTop(classId) {
  if (!classId) return null;
  const result = isFirebaseConfigured
    ? await request("/api/reading/top", { method: "POST", body: JSON.stringify({ classId }) })
    : await fetchReadingTop(classId);
  const detail = { classId, week: result?.week ?? null, rows: Array.isArray(result?.rows) ? result.rows : [] };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(READING_TOP_EVENT, { detail }));
  return detail;
}

// 반 여럿의 독서 TOP 3를 지금 다시 셉니다 — 책나눔 · 독서 TOP 3가 켜진 반만(readingTopOn). 기다리지 않습니다:
// 다시 세지 못해도 부른 일(사용 중지 · 반에서 빼기)은 그대로이고, TOP 3는 다음 월요일 07:00에 맞춰집니다.
// 학생이 순위에서 빠지거나 돌아오는 일 뒤에 부릅니다(lib/data/suspend.js · lib/data/removeFromClass.js).
export function refreshReadingTops(classes = [], label = "독서 TOP 3") {
  for (const c of classes) {
    if (!c?.id || !readingTopOn(c)) continue;
    refreshReadingTop(c.id).catch((e) => console.warn(`[${label}] 독서 TOP 3를 다시 세지 못했어요:`, e?.code || e?.message));
  }
}

// A separate appearance preference: this never changes XP or reading records.
// The live endpoint derives the target UID from authentication, not this input.
// 내 캐릭터 — 상단바 프로필(동그라미 · '내 프로필' 창)이 씁니다. 내 users 문서
// 한 건만 구독합니다(본인 읽기는 규칙이 엶). 데모는 저장할 때 알려 줍니다.
const characterListeners = new Set();
export function subscribeMyReadingCharacter(uid, callback) {
  if (!uid) { callback(null); return () => {}; }
  if (isFirebaseConfigured) {
    return onSnapshot(doc(db, "users", uid),
      (snap) => callback(normalizeReadingCharacter(snap.exists() ? snap.data().readingCharacter : null)),
      () => callback(null));
  }
  const emit = () => callback(demoCharacter(uid, (mock.demoUsers ?? []).find((p) => p.uid === uid)));
  characterListeners.add(emit);
  emit();
  return () => characterListeners.delete(emit);
}

export async function saveReadingCharacter(classId, value) {
  const character = normalizeReadingCharacter(value);
  if (!character) throw fail("캐릭터와 의상을 다시 선택해 주세요.", "reading/invalid-request");
  if (isFirebaseConfigured) {
    return request("/api/reading/character", { method: "POST", body: JSON.stringify({ classId, character }) });
  }
  const user = demoAccess(classId);
  if (isTeacher(user)) throw fail("학생 본인의 캐릭터만 고칠 수 있어요.", "reading/forbidden");
  // 리더보드를 꺼 둔 반도 고를 수 있습니다(서버 saveReadingCharacter와 같음).
  if (!characterChoiceEnabled(mock.classes.find((cls) => cls.id === classId))) {
    throw fail("이 반에서는 캐릭터 고르기를 사용하지 않습니다.", "reading/character-disabled");
  }
  mock.demoUsers = (mock.demoUsers ?? []).map((profile) => profile.uid === user.uid
    ? { ...profile, readingCharacter: character } : profile);
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(demoCharacterKey(user.uid), JSON.stringify(character));
  } catch { /* Demo still works in memory when browser storage is unavailable. */ }
  characterListeners.forEach((fn) => fn());
  return { character };
}

// ── 독서 펫(lib/readingPet.js) ───────────────────────────────────────
// 알 받기 · 깨우기는 서버만 합니다(/api/reading/pet — 종은 알 단계 동안 비밀이라 서버만 압니다).
// 화면은 내 프로필의 readingPet(종 없이 적힌 알 · 깨어난 뒤의 종)만 구독하고, 단계는 그 값과
// 지금의 '독서로 얻은 경험치'로 셉니다(petProgress — 책나눔은 이미 받은 서재로, 리더보드는 서버가 실어 줌).
// 데모는 체험 학생 15명에게 미리 정해 둔 펫(lib/demoPets.js)을 이 브라우저 안에서만 바꿉니다.
const demoPets = new Map(); // uid → { mirror, secret(알의 종) }
const petListeners = new Set();
function demoGrowth(uid) {
  ensureDemoReading();
  return petGrowthOfSummary(deriveReading(states.get(uid) ?? initialReadingState(), new Date()));
}
let demoPetsSeeded = false;
function ensureDemoPets() {
  if (isFirebaseConfigured || demoPetsSeeded) return;
  DEMO_STUDENTS.forEach((student, index) => {
    const pet = createDemoPet(index, demoGrowth(student.uid));
    if (pet) demoPets.set(student.uid, pet);
  });
  demoPetsSeeded = true;
}
function demoPetMirror(uid) {
  ensureDemoPets();
  return demoPets.get(uid)?.mirror ?? null;
}

// 내 펫 — 상단바(알 받기 · '내 프로필')와 책나눔이 씁니다. 내 users 문서 한 건(캐릭터와 같은 문서 —
// Firestore가 같은 문서의 구독을 하나로 묶습니다). callback({ loaded, mirror, fromCache, failed }).
// fromCache — 기기에 남은 옛 값일 수 있어, 상단바는 이때 알을 새로 받지 않습니다.
export function subscribeMyReadingPet(uid, callback) {
  if (!uid) { callback({ loaded: true, mirror: null, fromCache: false, failed: false }); return () => {}; }
  if (isFirebaseConfigured) {
    return onSnapshot(doc(db, "users", uid), { includeMetadataChanges: true },
      (snap) => callback({
        loaded: true,
        mirror: normalizePetMirror(snap.exists() ? snap.data().readingPet : null),
        fromCache: snap.metadata.fromCache,
        failed: false,
      }),
      () => callback({ loaded: true, mirror: null, fromCache: false, failed: true }));
  }
  const emit = () => callback({ loaded: true, mirror: demoPetMirror(uid), fromCache: false, failed: false });
  petListeners.add(emit);
  emit();
  return () => petListeners.delete(emit);
}

function demoPetAccess(classId) {
  const user = demoAccess(classId);
  if (isTeacher(user) || isAdmin(user)) throw fail("펫은 학생만 키워요.", "reading/pet-students-only");
  if (!petEnabled(mock.classes.find((c) => c.id === classId))) throw fail("이 반에서는 학생 펫을 사용하지 않습니다.", "reading/pet-disabled");
  ensureDemoPets();
  return user;
}

function demoPetAction(classId, action) {
  const user = demoPetAccess(classId);
  const current = demoPets.get(user.uid) ?? null;
  const plan = planPetAction({
    action,
    mirror: current?.mirror ?? null,
    secretSpecies: current?.secret ?? null,
    growthXp: demoGrowth(user.uid),
    randomIndex: Math.floor(Math.random() * PET_SPECIES.length),
  });
  if (plan.error) throw fail(plan.error.message, plan.error.code);
  if (plan.mirror || plan.secret) {
    demoPets.set(user.uid, {
      mirror: plan.mirror ?? current?.mirror ?? null,
      secret: plan.secret?.species ?? current?.secret ?? null,
    });
    petListeners.forEach((emit) => emit());
  }
  return { pet: plan.pet, event: plan.event };
}

// [학생] 알 받기 — 상단바가 알이 없는 학생에게 한 번 부릅니다(이미 있으면 서버가 그대로 돌려줌).
// 돌려줌 { pet, event: "adopted"(새로 받음) | null }.
export async function adoptReadingPet(classId) {
  if (isFirebaseConfigured) return request("/api/reading/pet", { method: "POST", body: JSON.stringify({ classId, action: "adopt" }) });
  return demoPetAction(classId, "adopt");
}

// [학생] 알이 없을 때 한 번만 받기 — 상단바와 책나눔 펫 카드가 함께 부릅니다(같은 약속을 나눠 가짐 —
// 둘이 동시에 불러도 요청은 하나). 실패하면 잊어 다음에 다시 부를 수 있게 합니다.
// 돌려줌 adoptReadingPet과 같음 — event가 "adopted"인 답은 처음 한 번뿐(상단바가 '알을 받았어요'를 띄움).
// 새로 받은 순간은 창 이벤트(READING_PET_EVENT)로 알립니다 — 누가 불렀든(상단바 · 펫 카드) 상단바가
// '알을 받았어요' 한 줄을 한 번 띄웁니다(부른 쪽이 답을 기다리는 사이 화면이 바뀌어도 놓치지 않게).
export const READING_PET_EVENT = "bookbom:reading-pet-adopted";
const adopting = new Map(); // uid → Promise
export function ensureReadingPet(classId, uid) {
  if (!classId || !uid) return Promise.resolve(null);
  if (!adopting.has(uid)) {
    const promise = adoptReadingPet(classId).then((result) => {
      if (result?.event === "adopted" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(READING_PET_EVENT, { detail: { uid, pet: result.pet } }));
      }
      return result;
    }, (error) => {
      adopting.delete(uid);
      throw error;
    });
    adopting.set(uid, promise);
  }
  return adopting.get(uid);
}

// [학생] 알 깨우기 — 펫 경험치 100이 모였을 때(책나눔의 펫 카드). 돌려줌 { pet(종이 적힌 모습), event: "hatched" | null }.
export async function hatchReadingPet(classId) {
  if (isFirebaseConfigured) return request("/api/reading/pet", { method: "POST", body: JSON.stringify({ classId, action: "hatch" }) });
  return demoPetAction(classId, "hatch");
}

// [학생] 내 펫의 지금 모습 — '내 프로필' 창이 열 때 한 번(접근 확인 3 + 반 집계 1). 알을 안 받았으면 null.
export async function fetchMyReadingPet(classId) {
  if (isFirebaseConfigured) {
    const data = await request(`/api/reading/pet?classId=${encodeURIComponent(classId)}`);
    return data?.pet ?? null;
  }
  const user = demoPetAccess(classId);
  const mirror = demoPetMirror(user.uid);
  return mirror ? petProgress(mirror, demoGrowth(user.uid)) : null;
}
