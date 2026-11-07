// One boundary for the in-memory demo and the authenticated reading API.
// No XP, badge, or ranking totals are written through the browser Firestore SDK.
import { auth, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin, isTeacher } from "../user";
import { applyReadingAction, deriveReading, initialReadingState, kstToday, readingEnabled, readingFruitGains } from "../reading";
import { memberSnapshot, memberStats } from "../readingJourney";
import { mock, mockListeners } from "./shared";
import { buildMockDirectory } from "./users";
import { createDemoReadingStates } from "../demoReading";

const states = new Map();
const listeners = new Set();
const queues = new Map();
const MAX_RECEIPTS = 1000;
const receipts = new Map();
const revisions = new Map();
const identity = () => getCurrentUser();
let demoSeeded = false;

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

function demoAccess(classId, uid) {
  const user = identity();
  const cls = mock.classes.find((c) => c.id === classId);
  if (!readingEnabled(cls)) throw fail("이 반은 책나눔 성장 기능을 사용하지 않아요.", "reading-disabled");
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

export function subscribeReadingState(classId, uid, onValue, onError = () => {}) {
  let alive = true;
  let pending = false;
  let rerun = false;
  let timer;
  const emit = async () => {
    if (!alive) return;
    if (pending) { rerun = true; return; }
    pending = true;
    const revision = revisions.get(uid) ?? 0;
    try {
      if (isFirebaseConfigured) {
        const data = await request(`/api/reading?classId=${encodeURIComponent(classId)}`);
        // 과일 경험치는 서버가 함께 보내 준 과일 날들(fruits)로 셉니다(deriveReading이 state.fruits를 읽음).
        if (alive && revision === (revisions.get(uid) ?? 0)) onValue({ ...data.state, fruits: data.fruits ?? [] });
      } else {
        demoAccess(classId, uid);
        ensureDemoReading();
        if (alive) onValue({ ...structuredClone(states.get(uid) ?? initialReadingState()), fruits: demoFruits(uid) });
      }
    } catch (error) { if (alive) onError(error); }
    finally {
      pending = false;
      if (alive && rerun) { rerun = false; emit(); }
    }
  };
  listeners.add(emit);
  // The demo responds to the same class toggle immediately, including disable.
  if (!isFirebaseConfigured) {
    mockListeners.classes.add(emit);
    if (!mockListeners.rewardEvents) mockListeners.rewardEvents = new Set();
    mockListeners.rewardEvents.add(emit);
  }
  else timer = setInterval(emit, 10000);
  emit();
  return () => {
    alive = false;
    clearInterval(timer);
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
      ...memberStats(memberSnapshot(summary), kstToday()) };
  }).filter(Boolean).sort((a, b) => b.xp - a.xp || a.studentId.localeCompare(b.studentId, "ko") || a.uid.localeCompare(b.uid));
  let rank = 0;
  return rows.map((row, i) => { if (!i || row.xp !== rows[i - 1].xp) rank = i + 1; return { ...row, rank }; });
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
