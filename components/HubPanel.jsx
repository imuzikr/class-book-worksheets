"use client";
// =============================================================
// 떠 있는 동그라미의 창 틀 — 메신저처럼 동그라미 자리에서 펼쳐지는 창(독서로 검색 · 성장·뱃지)
// -------------------------------------------------------------
// 선생님 요청(2026년 11월 — '메신저처럼 열리게'): 독서로 검색은 한때 화면 가운데 모달이었고, 성장·뱃지는 책 봄
// 왼쪽 칸이었습니다. 지금은 둘 다 메신저 창과 **같은 자리 · 같은 틀**로 동그라미에서 펼쳐집니다.
// 자리 · 크기 · 펼치는 쪽(교사가 동그라미를 옮긴 자리)은 app/styles/41-floating-messenger.css의 `.hub-panel` 한 곳이
// 메신저 창(MessengerWindow — `msgr hub-panel`)과 함께 정합니다. 모달이 아니라 뒤 화면을 막지 않고, 닫기는 × · Esc(창 안에
// 초점이 있을 때) · 동그라미(창이 떠 있는 동안 ×)입니다. 한 번에 하나만 열립니다(FloatingHub의 panel).
// =============================================================
import { useEffect, useRef } from "react";

// autoFocus — 열리자마자 창에 초점(키보드로 곧바로 고르고 Esc로 닫게). 안에서 따로 초점을 줄 창(검색 칸)은 넘기지 않습니다.
export default function HubPanel({ title, sub = "", className = "", onClose, closeLabel = "", autoFocus = false, busy = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  function onKeyDown(e) {
    if (e.key !== "Escape" || e.defaultPrevented || e.nativeEvent?.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
  }
  return (
    <section
      ref={ref}
      className={`hub-panel${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-label={title}
      aria-busy={busy || undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="hub-panel-head">
        <div className="hub-panel-title">
          <strong>{title}</strong>
          {sub ? <span>{sub}</span> : null}
        </div>
        <button type="button" className="btn-close hub-panel-close" onClick={onClose} aria-label={closeLabel || `${title} 닫기`}>
          ×
        </button>
      </header>
      {children}
    </section>
  );
}
