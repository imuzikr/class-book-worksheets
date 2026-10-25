// =============================================================
// 참여 코드 잠금 — 3번 틀리면 5분 동안 막습니다
// -------------------------------------------------------------
// 학생이 반에 들어가는 관문은 교사가 미리 만든 참여 코드 하나입니다.
// 코드가 6자리(32글자)라 하나씩 대 보며 맞히기는 어렵지만, 그래도 아무나
// 계속 두드리지 못하게 **연달아 3번 틀리면 5분 동안** 입력을 받지 않습니다.
//
// 진짜 잠금은 서버 함수(functions/index.js의 joinClassWithCode)가
// joinAttempts/{uid} 문서로 합니다 — 화면에서만 막으면 새로고침 한 번으로
// 풀리기 때문입니다. 이 파일은 그 셈을 순수 함수로 떼어 둔 것이고,
// functions/joinLockout.js가 **같은 내용의 CommonJS 사본**입니다(함수 폴더만
// 따로 배포되어 여기를 가져갈 수 없음). 둘이 어긋나지 않게
// tests/unit/joinLockout.test.mjs가 두 파일을 같은 표로 함께 시험합니다.
//
// 기록 모양: { fails: 틀린 횟수, lockedUntil: ms | 0 }
//  · 맞히면 기록을 지웁니다(다음에 다시 3번).
//  · 만료된 코드는 '틀림'으로 세지 않습니다 — 코드는 맞게 알고 있는 것이라
//    선생님께 새 코드를 받으면 됩니다.
// =============================================================

export const JOIN_MAX_FAILS = 3;
export const JOIN_LOCK_MS = 5 * 60 * 1000;

// 지금 막혀 있는가 — 막혀 있으면 풀리는 시각(ms), 아니면 0.
export function lockedUntilOf(rec, now) {
  const until = Number(rec?.lockedUntil) || 0;
  return until > now ? until : 0;
}

// 잠그면서 횟수를 0으로 돌려 두므로, 잠금이 풀린 뒤 처음 틀린 것은 1부터
// 다시 셉니다. 막혀 있는 동안에는 부르지 않습니다(서버가 먼저 막음).
function failsOf(rec) {
  return Number(rec?.fails) || 0;
}

// 한 번 틀린 뒤의 기록.
export function recordFailure(rec, now) {
  const fails = failsOf(rec) + 1;
  if (fails >= JOIN_MAX_FAILS) return { fails: 0, lockedUntil: now + JOIN_LOCK_MS };
  return { fails, lockedUntil: 0 };
}

// 화면에 적을 남은 기회(잠기기 전까지).
export function triesLeft(rec, now) {
  if (lockedUntilOf(rec, now)) return 0;
  return Math.max(0, JOIN_MAX_FAILS - failsOf(rec));
}

// 참여 코드 모양 — 입력을 대문자로 맞추고 글자·숫자만 남깁니다.
// 서버도 같은 셈을 하므로 '공백이 섞여 틀림'으로 세는 일이 없습니다.
export function normalizeJoinCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}
