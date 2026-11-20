// =============================================================
// 쓰는 칸의 Enter — Enter로 보내고 Shift+Enter는 줄바꿈 (셈만)
// -------------------------------------------------------------
// 광장 대화의 쓰는 칸(선생님 요청)과 떠 있는 동그라미의 '공지 보내기' 창이 함께 씁니다 — 앱의 다른 채팅 칸은 그대로
// Ctrl/⌘+Enter입니다. 화면 쪽 훅은 lib/useEnterSend.js 한 곳이고, 여기는 Firebase · React를 안 가져와 tests/unit이 그대로 읽습니다
// (광장 대화의 셈 lib/readingPlazaTalk.js가 옛 이름으로 다시 내보냅니다 — 시험 tests/unit/readingPlazaTalk.test.mjs).
// 한때 lib/readingPlazaTalk.js 안에 있었는데, '공지 보내기' 창이 이 셈 하나 때문에 광장 지도까지 끌어오지 않게 떼어 냈습니다.
//
// 한글은 마지막 글자가 '조합 중'인 채로 Enter를 누르게 되고, 그 Enter는 기기마다 다르게 옵니다.
//   · 조합 중의 keydown(isComposing · keyCode 229 — 윈도는 key가 'Process'라 code로 알아봄) → 조합이 끝난 뒤 보냅니다.
//     걸러 내기만 하면 첫 Enter가 통째로 먹힙니다(낱말 퀴즈에서 겪은 일 — components/CrosswordTyping.jsx).
//   · 맥 크롬은 조합을 마친 뒤 같은 Enter를 조합 없이 한 번 더 보냄 → 이미 보내 칸이 비어 아무 일도 없습니다.
//   · 조합을 마치며 줄바꿈까지 넣는 입력기 · keydown 없이 줄바꿈만 보내는 휴대폰 자판 → 그 줄바꿈(beforeinput)을 막고 보냅니다.
// 길이 둘 다 와도 한 번만 나갑니다 — 보내는 순간 칸을 비우고, 빈 칸은 보내지 않습니다(부르는 쪽의 submit).
// =============================================================

/** 쓰는 칸의 keydown — "send"(곧바로 보냄) · "later"(조합이 끝나면 보냄) · "newline"(Shift+Enter — 줄바꿈은 그대로) · null(Enter가 아님) */
export function enterSendKey({ key = "", code = "", shiftKey = false, composing = false } = {}) {
  const enter = key === "Enter" || code === "Enter" || code === "NumpadEnter";
  if (!enter) return null;
  if (shiftKey) return "newline";
  return composing ? "later" : "send";
}
/** 쓰는 칸의 beforeinput — 줄바꿈이 들어오려 할 때만: "allow"(Shift+Enter가 연 줄바꿈) · "send" · "later" · null(줄바꿈이 아님) */
export function enterLineBreak({ inputType = "", newlineOk = false, composing = false } = {}) {
  if (inputType !== "insertLineBreak" && inputType !== "insertParagraph") return null;
  if (newlineOk) return "allow";
  return composing ? "later" : "send";
}
/** 조합 중에 누른 Enter를 조합이 끝날 때 아직 지켜 줄까 — 누른 지 이만큼 안에 조합이 끝났을 때만(늦게 끝난 조합은 다음 말의 것) */
export const ENTER_SEND_WAIT_MS = 1500;
export const enterStillWaiting = (pressedAt, now) =>
  Number.isFinite(pressedAt) && pressedAt > 0 && now - pressedAt >= 0 && now - pressedAt < ENTER_SEND_WAIT_MS;
