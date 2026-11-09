// 화면이 보일 때만 되풀이하는 확인 — 서버에 다시 묻는 주기를 한 곳에서 정합니다.
// 책나눔 상태(lib/data/reading.js의 subscribeReadingState)와 리더보드 순위
// (components/reading/ReadingLeaderboard.jsx)가 함께 씁니다.
//
// - intervalMs마다 run을 부르되, 탭이 숨어 있으면 건너뜁니다(한때 10초마다,
//   숨은 탭에서도 물어 학생 한 명이 1분에 수십~수백 건을 읽었습니다).
// - 방금 물었으면(intervalMs의 절반 안) 그 차례도 건너뜁니다 — 탭으로 돌아와
//   물은 직후에 주기가 겹쳐 한 번 더 묻지 않게.
// - 탭으로 돌아오면(visibilitychange → 보임 · 창 focus) 한 번 곧바로 부릅니다.
//   두 이벤트가 함께 오므로 wakeGapMs 안의 두 번째 부름은 버립니다(한때 돌아올
//   때마다 두 번씩 물었습니다).
// - 다른 길로 방금 물었으면(처음 읽기 · 저장 뒤 · 과일이 바뀜) mark()로 알려 둡니다.
export const POLL_INTERVAL_MS = 60000;
export const POLL_WAKE_GAP_MS = 10000;

// 리더보드(순위와 그 화면의 '나의 독서 여정')는 더 길게 — 10분마다, 탭으로 돌아왔을 때는 마지막으로 받은 지
// 5분이 넘었을 때만 다시 받습니다(선생님 요청). 순위 한 번이 반 인원의 세 배쯤(25명 반이면 80장 남짓)이라,
// 1분마다 받을 때는 학생 25명이 10분 띄워 두면 2만 장을 넘었습니다. 열어 둔 화면의 순위는 최대 10분 늦게
// 바뀌고, 화면을 새로 열거나 '새로고침'을 누르면 곧바로 받습니다.
export const RANKING_POLL_MS = 600000;
export const RANKING_WAKE_GAP_MS = 300000;

export function startVisiblePoll(run, {
  intervalMs = POLL_INTERVAL_MS,
  wakeGapMs = POLL_WAKE_GAP_MS,
  doc = typeof document === "undefined" ? null : document,
  win = typeof window === "undefined" ? null : window,
  now = () => Date.now(),
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
} = {}) {
  let last = -Infinity;
  let stopped = false;
  const visible = () => !doc || doc.visibilityState !== "hidden";
  const fire = () => {
    if (stopped) return;
    last = now();
    run();
  };
  const tick = () => {
    if (visible() && now() - last >= intervalMs / 2) fire();
  };
  const wake = () => {
    if (visible() && now() - last >= wakeGapMs) fire();
  };
  const timer = setTimer(tick, intervalMs);
  win?.addEventListener?.("focus", wake);
  doc?.addEventListener?.("visibilitychange", wake);
  return {
    mark() { last = now(); },
    stop() {
      stopped = true;
      clearTimer(timer);
      win?.removeEventListener?.("focus", wake);
      doc?.removeEventListener?.("visibilitychange", wake);
    },
  };
}
