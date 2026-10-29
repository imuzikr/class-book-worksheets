// One boundary for the in-memory demo and the authenticated reading API.
// No XP, badge, or ranking totals are written through the browser Firestore SDK.
import { auth, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin, isTeacher } from "../user";
import { applyReadingAction, deriveReading, initialReadingState, readingEnabled } from "../reading";
import { mock, mockListeners } from "./shared";
import { buildMockDirectory } from "./users";

const states = new Map();
const listeners = new Set();
const queues = new Map();
const MAX_RECEIPTS = 1000;
const receipts = new Map();
const revisions = new Map();
const identity = () => getCurrentUser();

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
        if (alive && revision === (revisions.get(uid) ?? 0)) onValue(data.state);
      } else {
        demoAccess(classId, uid);
        if (alive) onValue(structuredClone(states.get(uid) ?? initialReadingState()));
      }
    } catch (error) { if (alive) onError(error); }
    finally {
      pending = false;
      if (alive && rerun) { rerun = false; emit(); }
    }
  };
  listeners.add(emit);
  // The demo responds to the same class toggle immediately, including disable.
  if (!isFirebaseConfigured) mockListeners.classes.add(emit);
  else timer = setInterval(emit, 10000);
  emit();
  return () => {
    alive = false;
    clearInterval(timer);
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
    listeners.forEach((emit) => emit());
    return { state, summary: deriveReading(state, new Date()) };
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
  const dir = buildMockDirectory();
  const members = new Set((mock.memberships ?? []).filter((m) => m.classId === classId).map((m) => m.uid));
  const rows = [...members].map((uid) => {
    const profile = uid === user.uid ? user : dir.find((p) => p.uid === uid) ?? {};
    if (isTeacher(profile)) return null;
    const summary = deriveReading(states.get(uid) ?? initialReadingState(), new Date());
    const scores = summary.classScores?.[classId] ?? {};
    return { uid, name: profile.realName || "이름 미설정", studentId: profile.studentId || "",
      level: summary.level, xp: scores[period === "all-time" ? "allTime" : period] ?? 0,
      featuredBadge: summary.featuredBadge?.id ?? null };
  }).filter(Boolean).sort((a, b) => b.xp - a.xp || a.studentId.localeCompare(b.studentId, "ko") || a.uid.localeCompare(b.uid));
  let rank = 0;
  return rows.map((row, i) => { if (!i || row.xp !== rows[i - 1].xp) rank = i + 1; return { ...row, rank }; });
}
