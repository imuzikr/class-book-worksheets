// One boundary for the in-memory demo and the authenticated reading API.
// No XP, badge, or ranking totals are written through the browser Firestore SDK.
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin, isTeacher } from "../user";
import { applyReadingAction, deriveReading, initialReadingState, kstToday, readingEnabled, readingFruitGains, readingTopWeek } from "../reading";
import { dailyXp, memberSnapshot, memberStats, readingTopAsOf, topReaders } from "../readingJourney";
import { characterChoiceEnabled, normalizeReadingCharacter } from "../readingCharacter";
import { mock, mockListeners } from "./shared";
import { buildMockDirectory } from "./users";
import { createDemoReadingStates } from "../demoReading";
import { startVisiblePoll } from "../visiblePoll";
// rewards.js도 이 파일을 가져옵니다(refreshReadingMember) — 서로 가져오므로 함수 안에서만 씁니다.
import { subscribeMyClassRewardCount } from "./rewards";

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
  return Object.fromEntries([...new Set(uids)].map((uid) => [uid,
    { ...structuredClone(states.get(uid) ?? initialReadingState()), fruits: demoFruits(uid) }]));
}

// 데모 — 과일 지급 이력(mock.rewardEvents)에서 경험치로 칠 과일(실서비스는 서버가 셈).
function demoFruits(uid) {
  return readingFruitGains((mock.rewardEvents ?? []).filter((e) => e.uid === uid));
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
//   · 그 반의 과일 수가 바뀌었을 때 — 선생님이 과일을 주면 경험치가 바뀝니다(구독 1건, 상단바와 같은 질의라 공유)
//   · 탭으로 돌아왔을 때 · 그 밖에는 화면이 보일 때만 60초마다(lib/visiblePoll.js — 다른 기기에서 쓴 기록)
//   반 설정(책나눔 끄기 · 랭킹 · 캐릭터)은 페이지가 반 문서를 실시간으로 받아 화면을 닫거나 바꿉니다.
// 받은 내용이 지난번과 같으면 화면에 넘기지 않습니다(새 객체가 오면 화면 전체가 다시 그려짐).
export function subscribeReadingState(classId, uid, onValue, onError = () => {}) {
  const viewing = !!uid && uid !== identity()?.uid;
  let alive = true;
  let pending = false;
  let rerun = false;
  let lastJson = null;
  let poll = null;
  let offFruit = () => {};
  let nudgeTimer;
  const deliver = (value) => {
    const json = JSON.stringify(value);
    if (json === lastJson) return;
    lastJson = json;
    onValue(value);
  };
  // fresh — 과일 경험치를 서버가 지급 이력에서 다시 세게 합니다. **처음 한 번과 과일 수가 바뀌었을 때만**
  // 보냅니다. 그 밖의 다시 묻기(60초마다 · 돌아왔을 때 · 저장 뒤)는 서버가 반 집계에 적어 둔 과일 날을
  // 써서 지급 이력을 읽지 않습니다(lib/server/readingService.js의 getReading).
  let rerunFresh = false;
  const run = async (fresh) => {
    if (!alive) return;
    if (pending) { rerun = true; rerunFresh = rerunFresh || fresh; return; }
    // 어느 길로 묻든(처음 · 저장 뒤 · 과일 · 돌아옴) 방금 물었다고 적어 둡니다 — 곧이어 오는 주기는 건너뜁니다.
    poll?.mark();
    pending = true;
    const revision = revisions.get(uid) ?? 0;
    try {
      if (isFirebaseConfigured) {
        const data = await request(`/api/reading?classId=${encodeURIComponent(classId)}${viewing ? `&uid=${encodeURIComponent(uid)}` : ""}${fresh ? "&fresh=1" : ""}`);
        // 과일 경험치는 서버가 함께 보내 준 과일 날들(fruits)로 셉니다(deriveReading이 state.fruits를 읽음).
        if (alive && revision === (revisions.get(uid) ?? 0)) deliver({ ...data.state, fruits: data.fruits ?? [] });
      } else {
        demoAccess(classId, uid, { teacherView: viewing });
        ensureDemoReading();
        if (alive) deliver({ ...structuredClone(states.get(uid) ?? initialReadingState()), fruits: demoFruits(uid) });
      }
    } catch (error) {
      // 실패한 뒤 같은 내용이 다시 와도 화면이 되살아나도록 지난 값을 잊습니다.
      lastJson = null;
      if (alive) onError(error);
    }
    finally {
      pending = false;
      if (alive && rerun) {
        const again = rerunFresh;
        rerun = false;
        rerunFresh = false;
        run(again);
      }
    }
  };
  const emit = () => run(false);
  const emitFresh = () => run(true);
  listeners.add(emit);
  // The demo responds to the same class toggle immediately, including disable.
  if (!isFirebaseConfigured) {
    mockListeners.classes.add(emit);
    if (!mockListeners.rewardEvents) mockListeners.rewardEvents = new Set();
    mockListeners.rewardEvents.add(emit);
  } else {
    poll = startVisiblePoll(emit);
    // 과일 수가 바뀌면 곧바로(선생님이 연달아 주면 한 번으로 모아서). 첫 답은 기준점일 뿐입니다.
    let fruitBase;
    offFruit = subscribeMyClassRewardCount(classId, uid, (count) => {
      if (fruitBase === undefined) { fruitBase = count; return; }
      if (count === fruitBase) return;
      fruitBase = count;
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(emitFresh, 800);
    });
  }
  emitFresh();
  return () => {
    alive = false;
    poll?.stop();
    clearTimeout(nudgeTimer);
    offFruit();
    listeners.delete(emit);
    mockListeners.classes.delete(emit);
    mockListeners.rewardEvents?.delete(emit);
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
        { classId, now: new Date(), id: requestId, uid, fruits: demoFruits(uid) });
      states.set(uid, next);
      receipts.set(key, signature);
      if (receipts.size > MAX_RECEIPTS) receipts.delete(receipts.keys().next().value);
    }
    const state = structuredClone(states.get(uid) ?? initialReadingState());
    listeners.forEach((emit) => emit());
    return { state, summary: deriveReading(state, new Date(), { fruits: demoFruits(uid) }) };
  });
  queues.set(uid, operation);
  try { return await operation; }
  finally { if (queues.get(uid) === operation) queues.delete(uid); }
}

export async function fetchReadingRankings(classId, period = "weekly") {
  if (!["daily", "weekly", "monthly", "all-time"].includes(period)) throw fail("랭킹 기간을 확인해 주세요.", "reading/invalid-request");
  if (isFirebaseConfigured) {
    const data = await request(`/api/reading/rankings?classId=${encodeURIComponent(classId)}&period=${encodeURIComponent(period)}`);
    return data.rankings;
  }
  const user = demoAccess(classId);
  if (mock.classes.find((c) => c.id === classId)?.rankingEnabled === false) {
    throw fail("이 반에서는 랭킹 시스템을 사용하지 않습니다.", "reading/ranking-disabled");
  }
  ensureDemoReading();
  const dir = buildMockDirectory();
  const members = new Set((mock.memberships ?? []).filter((m) => m.classId === classId).map((m) => m.uid));
  const rows = [...members].map((uid) => {
    const profile = uid === user.uid ? user : dir.find((p) => p.uid === uid) ?? {};
    if (isTeacher(profile)) return null;
    const summary = deriveReading(states.get(uid) ?? initialReadingState(), new Date(), { fruits: demoFruits(uid) });
    const scores = summary.classScores?.[classId] ?? {};
    return { uid, name: profile.realName || "이름 미설정", studentId: profile.studentId || "",
      level: summary.level, xp: scores[period === "all-time" ? "allTime" : period] ?? 0,
      featuredBadge: summary.featuredBadge?.id ?? null,
      allTimeXp: scores.allTime ?? 0,
      character: characterChoiceEnabled(mock.classes.find((c) => c.id === classId)) ? demoCharacter(uid, profile) : null,
      ...memberStats(memberSnapshot(summary), kstToday()) };
  }).filter(Boolean).sort((a, b) => b.xp - a.xp || a.studentId.localeCompare(b.studentId, "ko") || a.uid.localeCompare(b.uid));
  let rank = 0;
  return rows.map((row, i) => { if (!i || row.xp !== rows[i - 1].xp) rank = i + 1; return { ...row, rank }; });
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
  if (cls?.rankingEnabled === false) throw fail("이 반에서는 랭킹 시스템을 사용하지 않습니다.", "reading/ranking-disabled");
  ensureDemoReading();
  const week = readingTopWeek();
  const dir = buildMockDirectory();
  const characterOn = characterChoiceEnabled(cls);
  const members = new Set((mock.memberships ?? []).filter((m) => m.classId === classId).map((m) => m.uid));
  const rows = [...members].map((uid) => {
    const profile = uid === user.uid ? user : dir.find((p) => p.uid === uid) ?? {};
    if (isTeacher(profile)) return null;
    const summary = deriveReading(states.get(uid) ?? initialReadingState(), new Date(), { fruits: demoFruits(uid) });
    return { uid, name: profile.realName || "이름 미설정", studentId: profile.studentId || "",
      character: characterOn ? demoCharacter(uid, profile) : null,
      ...readingTopAsOf({ xpDays: dailyXp(summary.events) }, week) };
  }).filter(Boolean);
  return { week, rows: topReaders(rows, 3) };
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
  if (mock.classes.find((cls) => cls.id === classId)?.rankingEnabled === false) {
    throw fail("이 반에서는 랭킹 시스템을 사용하지 않습니다.", "reading/ranking-disabled");
  }
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

// [교사] 과일을 준 뒤 그 학생의 책나눔 반 집계를 다시 세게 합니다(실서비스만 — 데모는 읽을 때 셈).
// 기다리지 않고, 실패해도 과일 지급에는 영향이 없습니다(책나눔이 꺼진 반이면 서버가 거절할 뿐).
// 같은 학생에게 잇달아 주면 마지막 한 번만 보냅니다.
const refreshTimers = new Map();
export function refreshReadingMember(classId, uid) {
  if (!isFirebaseConfigured || !classId || !uid) return;
  const key = `${classId}:${uid}`;
  clearTimeout(refreshTimers.get(key));
  refreshTimers.set(key, setTimeout(() => {
    refreshTimers.delete(key);
    request("/api/reading/refresh", { method: "POST", body: JSON.stringify({ classId, uid }) }).catch(() => {});
  }, 1500));
}
