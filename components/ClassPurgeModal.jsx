"use client";

// =============================================================
// 반 완전 삭제 — 보관된 반만. 반 이름을 그대로 적어야 지워집니다.
// -------------------------------------------------------------
// 생김새는 되묻는 창(ConfirmModal)과 같고, 이름 칸과 진행 줄이 더 붙습니다.
// 지우는 동안에는 닫히지 않습니다(창을 닫아도 지우기는 계속되지만, 끝났는지
// 알 길이 없어집니다). 중간에 실패하면 반이 남아 있으니 다시 누르면 남은
// 것부터 이어 지웁니다(lib/data/classes.js의 purgeClass).
// =============================================================
import { useState } from "react";
import { backdropClose } from "@/lib/modal";
import { purgeClass } from "@/lib/store";
import { purgeNameMatches, purgeStepText } from "@/lib/classPurge";
import { IconTrash } from "./StatusIcons";

export default function ClassPurgeModal({ cls, onClose, onDone }) {
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(null);
  const [error, setError] = useState("");
  const ok = purgeNameMatches(typed, cls.name);

  async function run() {
    if (!ok || running) return;
    setRunning(true);
    setError("");
    try {
      await purgeClass(cls.id, setStep);
      onDone?.(cls);
    } catch (e) {
      console.warn("[반 삭제] 멈췄어요:", e?.code, e?.message);
      setError(
        e?.message === "not-archived"
          ? "보관된 반만 지울 수 있어요."
          : "지우는 도중에 멈췄어요. 남은 기록은 그대로이니 '완전 삭제'를 다시 누르면 이어서 지웁니다."
      );
      setRunning(false);
      setStep(null);
    }
  }

  const close = running ? () => {} : onClose;

  return (
    <div className="modal-backdrop confirm-backdrop" {...backdropClose(close)}>
      <div
        className="confirm-modal class-purge-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="class-purge-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-icon-wrap">
          <span className="confirm-icon"><IconTrash size={40} /></span>
        </div>
        <h3 id="class-purge-title" className="confirm-title">반을 완전히 지울까요?</h3>
        <p className="confirm-preview">"{cls.name}"</p>
        <p className="confirm-desc">
          이 반의 독서 활동과 학생 글, 출석 · 자리표 · 모둠, 과일과 바구니, 메신저 ·
          손들기 · 돌발 퀴즈, 반 공지가 모두 지워지고 <b>되돌릴 수 없습니다.</b>
          <br />
          학생 계정은 다른 반에서도 쓰므로 남습니다.
        </p>
        <label className="class-purge-label" htmlFor="class-purge-name">
          확인하려면 반 이름 <b>{cls.name}</b>을(를) 그대로 적어 주세요.
        </label>
        <input
          id="class-purge-name"
          className="class-purge-input"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) run();
          }}
          placeholder={cls.name}
          disabled={running}
          autoFocus
          autoComplete="off"
        />
        {running && (
          <p className="class-purge-step" role="status">
            {purgeStepText(step)} — 창을 닫지 말고 기다려 주세요.
          </p>
        )}
        {error && <p className="form-error class-purge-error">{error}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn-ghost confirm-cancel" onClick={onClose} disabled={running}>
            취소
          </button>
          <button
            type="button"
            className="confirm-confirm danger"
            onClick={run}
            disabled={!ok || running}
          >
            {running ? "지우는 중…" : "완전 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
