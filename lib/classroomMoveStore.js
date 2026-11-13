"use client";
// =============================================================
// 모두 이동의 10초 알림 — 반마다 하나인 상태와 타이머 (셈은 lib/classroomMove.js)
// -------------------------------------------------------------
// 반 문서를 구독하는 곳(상단바 · 책방 페이지)이 받은 문서를 그대로 먹이면(feedClassroomMove), 여기서 '세는 중 → 내놓음'을
// 맡습니다. 알림 띠(components/reading/ClassMoveBanner.jsx) · 책방 페이지(무대에 넘길 신호) · 체험반의 가상 친구가
// 같은 상태를 봅니다 — 저마다 세면 띠는 0인데 무대는 아직인 화면이 됩니다.
//
// **모듈에 둡니다(컴포넌트의 상태가 아님).** 상단바는 화면(페이지)을 옮길 때마다 새로 서는데, 그때마다 '처음 본 값'으로
// 되돌아가면 세던 카운트다운이 사라지고, 이미 데려온 신호로 다시 데려옵니다. 새로고침하면 처음부터입니다.
//
// **잠들었다 깬 기기에 밀려 온 신호는 세지 않습니다**(lib/classroomMove.js 머리말). 깼는지는 이 기기의 시계끼리만
// 견주어 압니다 — 5초마다 '살아 있음'을 적어 두고, 그 사이가 1분 30초 넘게 벌어졌으면 잠들었던 것입니다(가려 둔 탭의
// 느린 타이머는 길어야 1분). 깬 뒤 2분 동안 오는 새 신호는 '이미 있던 신호'로 둡니다(연결이 다시 붙어 밀린 값이 오는 동안).
// 오래 끊겼던 인터넷이 다시 붙었을 때도 같습니다.
// **한참 아무도 반 문서를 보지 않다가 다시 본 첫 값**도 같습니다(watchClassroomMove) — 상단바가 없는 화면(약관 · 첫 화면)에
// 오래 있다 돌아오면 그사이의 신호가 언제 보낸 것인지 알 수 없습니다. 화면을 옮기는 짧은 틈(20초 안)은 이어 본 것으로 칩니다.
// =============================================================
import { useCallback, useSyncExternalStore } from "react";
import { CLASSROOM_MOVE_IDLE, classroomMoveDue, classroomMoveFeed, classroomMoveSignal } from "./classroomMove";

const BEAT_MS = 5000;
const GAP_MS = 90 * 1000;
const WAKE_GRACE_MS = 120 * 1000;
const WATCH_GAP_MS = 20 * 1000;

const states = new Map();     // 반 id → 상태
const listeners = new Map();  // 반 id → 듣는 함수들
const timers = new Map();     // 반 id → 다 셌을 때 울릴 타이머
const pulled = new Map();     // 반 id → 마지막으로 데려온 신호의 '보낸 때'
const watchers = new Map();   // 반 id → { n 보는 곳 수, idleSince 아무도 안 보기 시작한 때, gap 한참 끊겼다 다시 봄 }

let beating = false;
let lastBeat = 0;
let wokeAt = 0;
let offlineSince = 0;

function beat() {
  const now = Date.now();
  if (lastBeat && (now - lastBeat > GAP_MS || now < lastBeat - GAP_MS)) wokeAt = now;
  lastBeat = now;
  return now;
}
function startBeat() {
  if (beating || typeof window === "undefined") return;
  beating = true;
  lastBeat = Date.now();
  setInterval(beat, BEAT_MS);
  window.addEventListener("offline", () => { offlineSince = Date.now(); });
  window.addEventListener("online", () => {
    const now = Date.now();
    if (offlineSince && now - offlineSince > GAP_MS) wokeAt = now;
    offlineSince = 0;
  });
  // 가려 둔 탭은 타이머가 느립니다 — 돌아온 순간 다 센 것이 있으면 곧바로 내놓습니다
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const classId of [...timers.keys()]) settle(classId);
  });
}
const wokeLately = (now) => wokeAt > 0 && now - wokeAt >= 0 && now - wokeAt < WAKE_GRACE_MS;

function commit(classId, prev, next) {
  if (next === prev) return;
  states.set(classId, next);
  arm(classId);
  for (const fn of [...(listeners.get(classId) ?? [])]) fn();
}
function arm(classId) {
  clearTimeout(timers.get(classId));
  const pending = states.get(classId)?.pending;
  if (!pending) { timers.delete(classId); return; }
  timers.set(classId, setTimeout(() => settle(classId), Math.max(0, pending.until - Date.now()) + 30));
}
function settle(classId) {
  const prev = states.get(classId);
  if (!prev?.pending) return;
  const next = classroomMoveDue(prev, beat());
  if (next === prev) { arm(classId); return; }
  commit(classId, prev, next);
}

// 반 문서를 먹입니다 — 아직 못 받은 문서(null)는 먹이지 않습니다('신호 없음'을 기준으로 삼으면 곧이어 오는 진짜 값이
// 새 신호로 읽혀, 화면을 열 때마다 옛 신호로 카운트다운이 뜹니다).
export function feedClassroomMove(classId, classDoc) {
  if (!classId || !classDoc || typeof window === "undefined") return;
  startBeat();
  const now = beat();
  const prev = states.get(classId) ?? CLASSROOM_MOVE_IDLE;
  const watch = watchers.get(classId);
  const stale = wokeLately(now) || !!watch?.gap;
  if (watch) watch.gap = false;
  commit(classId, prev, classroomMoveFeed(prev, classroomMoveSignal(classDoc), now, { stale }));
}
// 반 문서를 보기 시작합니다(구독을 거는 효과에서 부르고, 돌려받은 함수를 정리에서 부릅니다). 한참(20초 넘게) 아무도
// 안 보다가 다시 보는 것이면, 이어서 오는 첫 값은 '이미 있던 신호'로 다룹니다 — 그사이에 온 신호는 언제 보낸 것인지 모릅니다.
export function watchClassroomMove(classId) {
  if (!classId || typeof window === "undefined") return () => {};
  let watch = watchers.get(classId);
  if (!watch) watchers.set(classId, (watch = { n: 0, idleSince: 0, gap: false }));
  if (watch.n === 0 && watch.idleSince && Math.abs(Date.now() - watch.idleSince) > WATCH_GAP_MS) watch.gap = true;
  watch.n += 1;
  let on = true;
  return () => {
    if (!on) return;
    on = false;
    watch.n -= 1;
    if (watch.n === 0) watch.idleSince = Date.now();
  };
}
// [선생님] 신호를 적지 못했습니다(권한 · 연결) — 이 화면이 먼저 세기 시작한 것을 걷습니다. 반 문서의 쓰기는 이 화면에
// 곧바로 비치므로(저장이 끝나기 전에), 그대로 두면 아무에게도 닿지 않은 신호로 선생님만 10초 뒤에 옮겨 갑니다.
export function abandonClassroomMove(classId) {
  const prev = states.get(classId);
  if (!prev?.pending) return;
  commit(classId, prev, { ...prev, pending: null });
}
export function readClassroomMove(classId) {
  return (classId && states.get(classId)) || CLASSROOM_MOVE_IDLE;
}
export function subscribeClassroomMove(classId, fn) {
  if (!classId) return () => {};
  let set = listeners.get(classId);
  if (!set) listeners.set(classId, (set = new Set()));
  set.add(fn);
  return () => { set.delete(fn); };
}
// 다른 화면에 있던 사람을 데려올 신호 — **신호마다 한 번만** 내어 줍니다(상단바가 화면을 옮길 때마다 새로 서도 같은
// 신호로 두 번 데려오지 않게). 데려올 것이 없으면 null.
// 내놓은 지 한참 된 신호도 내어 주지 않습니다 — 상단바가 없는 화면(약관 · 첫 화면)에 있다가 한참 뒤에 돌아온 사람의
// 화면이 알림도 없이 바뀌면 안 됩니다(책 광장 탭을 열면 무대가 한 시간 안의 것만 따름).
const PULL_FRESH_MS = 15 * 1000;
export function takeClassroomPull(classId) {
  const released = states.get(classId)?.released;
  if (!released?.pull || !(released.at > (pulled.get(classId) ?? 0))) return null;
  pulled.set(classId, released.at);
  const age = Date.now() - released.tick;
  return age > -PULL_FRESH_MS && age <= PULL_FRESH_MS ? released : null;
}
export function useClassroomMove(classId) {
  const subscribe = useCallback((fn) => subscribeClassroomMove(classId, fn), [classId]);
  const read = useCallback(() => readClassroomMove(classId), [classId]);
  return useSyncExternalStore(subscribe, read, () => CLASSROOM_MOVE_IDLE);
}
