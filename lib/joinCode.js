// =============================================================
// 참여 코드 — 선생님이 직접 정하는 코드의 셈 (화면 · 자료 함수 · 시험이 함께 씀)
// -------------------------------------------------------------
// 학생이 반에 들어올 때 적는 코드입니다(joinCodes/{코드} — 문서 id가 곧 코드).
//  · 자동 코드는 헷갈리는 글자(O·0 · I·L·1)를 뺀 32글자로 6자리입니다(lib/data/classes.js의 makeJoinCode).
//  · **선생님이 정하는 코드는 영어 · 숫자 6~12자**입니다(선생님 요청 — 외우기 쉬운 코드로 바꾸게).
//    학생의 입장 칸이 대문자로 바꾸고 영어 · 숫자만 남겨 12자에서 자르므로(normalizeJoinCode), 그 칸이
//    받을 수 있는 모양으로만 받습니다.
//  · **6자 아래는 받지 않습니다.** 틀린 횟수 잠금이 없어(서버 함수 없이 돌리려고 걷음) 짧은 코드는
//    하나씩 대 보며 맞힐 수 있습니다. 규칙도 같은 모양만 받습니다(firestore.rules의 joinCodes create —
//    `^[A-Z0-9]{6,12}$`) — 화면을 거치지 않고 써도 같습니다.
// 시험 tests/unit/joinCode.test.mjs.
// =============================================================
export const JOIN_CODE_MIN = 6;
export const JOIN_CODE_MAX = 12;
export const JOIN_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;
// 코드는 만들거나 바꾼 때부터 14일 동안 쓸 수 있습니다(재발급 · 직접 정하기 · 반 만들기 모두 — 만료 뒤에는 재발급)
export const JOIN_CODE_TTL_DAYS = 14;

// 선생님이 적은 코드 다듬기 — 영어는 대문자로, 띄어쓰기 · 붙임표는 걷습니다(학생의 입장 칸도 걷음).
// 그 밖의 글자(한글 · 기호)는 남겨 joinCodeProblem이 까닭을 말하게 합니다 — 조용히 지우면 선생님이
// 적은 것과 다른 코드가 저장됩니다.
export function tidyJoinCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[\s-]+/g, "");
}

// 받을 수 없는 까닭 한 줄 — 괜찮으면 빈 글자. 다듬은 뒤의 코드를 넘깁니다.
export function joinCodeProblem(code) {
  const text = String(code ?? "");
  if (!text) return "새 참여 코드를 적어 주세요.";
  // 한/영 키가 한글로 놓인 채 적는 일이 잦아(BOOK → ㅠㅐㅐㅏ) 그때는 고칠 길까지 말합니다
  if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text)) return "한글이 들어 있어요. 한/영 키를 눌러 영어로 적어 주세요.";
  if (/[^A-Z0-9]/.test(text)) return "영어와 숫자만 쓸 수 있어요.";
  if (text.length < JOIN_CODE_MIN || text.length > JOIN_CODE_MAX) {
    return `${JOIN_CODE_MIN}~${JOIN_CODE_MAX}자로 정해 주세요. 지금 ${text.length}자예요.`;
  }
  return "";
}

// 헷갈리기 쉬운 짝(O와 0 · I · L과 1)이 **한 코드에 함께** 들었으면 알려 주는 한 줄 — 막지는 않습니다(선생님이
// 고른 코드). 한쪽만 든 코드(BOOK3B · CLASS7)는 낱말로 읽혀 헷갈리지 않으므로 말하지 않습니다(늘 뜨면 성가심).
export function joinCodeLookalikeHint(code) {
  const text = String(code ?? "");
  const pairs = [];
  if (/O/.test(text) && /0/.test(text)) pairs.push("O와 0");
  if (/[IL]/.test(text) && /1/.test(text)) pairs.push("I · L과 1");
  return pairs.length ? `${pairs.join(", ")}이 함께 있으면 학생이 헷갈리기 쉬워요.` : "";
}

// 코드를 바꾸지 못했을 때 입력칸 아래에 세울 한 줄(자료 함수가 던진 오류의 reason으로 고름 — lib/data/classes.js의
// setJoinCode · regenerateJoinCode). 규칙 거부 같은 낯선 오류는 Firebase의 영어 문구 대신 우리말 한 줄로.
export function joinCodeSaveError(error) {
  const reason = error?.reason;
  if (reason === "invalid") return error.message || "영어 · 숫자 6~12자로 정해 주세요.";
  if (reason === "taken") return "다른 반이 쓰고 있는 코드예요. 다른 코드를 정해 주세요.";
  if (reason === "missing") return "반을 찾지 못했어요. 창을 닫았다가 다시 열어 주세요.";
  return "코드를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.";
}
