// =============================================================
// 참여 코드 잠금 셈 — lib/joinLockout.js의 CommonJS 사본입니다.
// 함수 폴더만 따로 배포되어 앱 쪽 파일을 가져올 수 없어 베껴 두었습니다.
// **고칠 때는 두 파일을 함께** — tests/unit/joinLockout.test.mjs가 같은 표로
// 둘을 함께 시험해 어긋나면 잡습니다.
// =============================================================
const JOIN_MAX_FAILS = 3;
const JOIN_LOCK_MS = 5 * 60 * 1000;

// 지금 막혀 있는가 — 막혀 있으면 풀리는 시각(ms), 아니면 0.
function lockedUntilOf(rec, now) {
  const until = Number(rec?.lockedUntil) || 0;
  return until > now ? until : 0;
}

// 잠그면서 횟수를 0으로 돌려 두므로, 잠금이 풀린 뒤 처음 틀린 것은 1부터
// 다시 셉니다. 막혀 있는 동안에는 부르지 않습니다(서버가 먼저 막음).
function failsOf(rec) {
  return Number(rec?.fails) || 0;
}

// 한 번 틀린 뒤의 기록.
function recordFailure(rec, now) {
  const fails = failsOf(rec) + 1;
  if (fails >= JOIN_MAX_FAILS) return { fails: 0, lockedUntil: now + JOIN_LOCK_MS };
  return { fails, lockedUntil: 0 };
}

// 화면에 적을 남은 기회(잠기기 전까지).
function triesLeft(rec, now) {
  if (lockedUntilOf(rec, now)) return 0;
  return Math.max(0, JOIN_MAX_FAILS - failsOf(rec));
}

// 참여 코드 모양 — 입력을 대문자로 맞추고 글자·숫자만 남깁니다.
// 서버도 같은 셈을 하므로 '공백이 섞여 틀림'으로 세는 일이 없습니다.
function normalizeJoinCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

module.exports = {
  JOIN_MAX_FAILS,
  JOIN_LOCK_MS,
  lockedUntilOf,
  recordFailure,
  triesLeft,
  normalizeJoinCode,
};
