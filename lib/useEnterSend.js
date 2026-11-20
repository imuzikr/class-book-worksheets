"use client";
// =============================================================
// Enter로 보내기 — 쓰는 칸(textarea)에 거는 훅 한 곳
// -------------------------------------------------------------
// 광장 대화의 쓰는 칸(components/reading/PlazaTalk.jsx — 선생님 요청)과 떠 있는 동그라미의 '공지 보내기' 창
// (components/NoticeSendPanel.jsx)이 함께 씁니다 — 두 칸의 손놀림이 같아야 하므로 저마다 짜지 마세요. 앱의 다른 채팅 칸은
// 그대로 Ctrl/⌘+Enter입니다. 셈(어떤 키가 보내기인가)은 lib/enterSend.js.
//
// Enter 보냄 · Shift+Enter 줄바꿈 · Ctrl/⌘+Enter도 보냄(예전 손버릇). 한글을 조합하는 중의 Enter는 조합이 끝난 뒤 보냅니다 —
// 걸러 내기만 하면 첫 Enter가 먹히고, 막으면(preventDefault) 마지막 글자가 칸에 안 들어갈 수 있어 기본 동작은 둡니다.
// 줄바꿈이 keydown 없이 오는 길(조합을 마치며 줄바꿈까지 넣는 입력기 · 휴대폰 자판)은 칸에 직접 건 beforeinput이 맡습니다 —
// Shift+Enter가 연 것만 들이고 나머지는 막고 보냅니다(React의 onBeforeInput은 inputType을 몰라 칸에 직접 · 칸이 새로 서면
// ref 콜백이 다시 겁니다). submit · onEscape는 늘 최신 것을 부릅니다.
//
// 쓰는 법: const enter = useEnterSend(submit, onEscape);
//   <textarea ref={enter.ref} onKeyDown={enter.onKeyDown} onCompositionStart={enter.onCompositionStart}
//             onCompositionEnd={enter.onCompositionEnd} /> — 칸 자체는 enter.inputRef.current
// onEscape를 넘기면 Esc를 그쪽이 맡고(기본 동작을 막음), 안 넘기면 Esc는 그대로 위로 갑니다.
// =============================================================
import { useCallback, useMemo, useRef } from "react";
import { enterLineBreak, enterSendKey, enterStillWaiting } from "./enterSend";

export function useEnterSend(submit, onEscape) {
  const inputRef = useRef(null);
  const composingRef = useRef(false);  // 한글을 조합하는 중인가(compositionstart ~ end)
  const enterAt = useRef(0);           // 조합 중에 누른 Enter의 때 — 조합이 끝나면 보냄
  const newlineOk = useRef(false);     // 방금 누른 것이 Shift+Enter — 그 줄바꿈만 들임
  const act = useRef({ submit, onEscape });
  act.current = { submit, onEscape };
  const onBeforeInput = useMemo(() => (e) => {
    const step = enterLineBreak({ inputType: e.inputType, newlineOk: newlineOk.current, composing: composingRef.current || e.isComposing });
    if (!step) return;
    newlineOk.current = false;
    if (step === "allow") return;
    e.preventDefault();
    if (step === "later") enterAt.current = Date.now();
    else act.current.submit();
  }, []);
  const ref = useCallback((el) => {
    inputRef.current?.removeEventListener("beforeinput", onBeforeInput);
    inputRef.current = el;
    el?.addEventListener("beforeinput", onBeforeInput);
  }, [onBeforeInput]);
  function onKeyDown(e) {
    const step = enterSendKey({ key: e.key, code: e.code, shiftKey: e.shiftKey, composing: e.nativeEvent.isComposing || composingRef.current });
    if (step) {
      newlineOk.current = step === "newline";
      if (step === "later") enterAt.current = Date.now();
      if (step === "send") { e.preventDefault(); enterAt.current = 0; act.current.submit(); }
      return;
    }
    if (e.key === "Escape" && act.current.onEscape) { e.preventDefault(); act.current.onEscape(); }
  }
  function onCompositionStart() { composingRef.current = true; }
  function onCompositionEnd() {
    composingRef.current = false;
    const pressed = enterAt.current;
    enterAt.current = 0;
    // 조합 중에 누른 Enter — 마지막 글자가 칸에 들어간 뒤(브라우저에 따라 compositionend 뒤에 input이 한 번 더 옴) 보냅니다
    if (enterStillWaiting(pressed, Date.now())) setTimeout(() => act.current.submit(), 0);
  }
  return { inputRef, ref, onKeyDown, onCompositionStart, onCompositionEnd };
}
