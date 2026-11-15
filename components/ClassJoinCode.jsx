"use client";

// =============================================================
// 반별 참여 코드 — 카드 안 한 줄 + 전체 화면(칠판 투사)
// -------------------------------------------------------------
// 반 관리하기의 카드에서는 '참여 코드 · 코드 · 수정 · 유효기간 · 전체 화면'이
// 한 줄로 섭니다(반이 여섯이면 그만큼 되풀이되는 줄이라 짧아야 합니다).
// '코드 재발급'은 이 줄이 아니라 카드 머리줄의 편집(✏) 옆에 있습니다 —
// 반에 하는 일끼리 한자리에 모읍니다.
// **'수정'만은 코드 바로 옆**입니다(선생님 요청 — 코드를 직접 정하기). 누르면 그 자리의
// 코드가 입력칸이 되고 '취소 · 저장'이 서며, 아래 한 줄이 규칙과 결과를 말합니다(셈은
// lib/joinCode.js, 저장은 lib/data/classes.js의 setJoinCode). 칸을 벗어나도 저장하지 않습니다 —
// 코드를 바꾸면 지금 코드로는 더 못 들어오므로 '저장'을 눌러야만 바꿉니다(반 이름 고치기와 다름).
// 무엇을 고치는 중인지(editing) · 저장 중인지(saving)는 반 관리하기 창이 듭니다 — 저장하는 동안
// 재발급 · 보관을 잠그고, 고치는 동안 카드를 끌어 옮기지 않게(입력칸의 글자를 끌어 고르다 카드가
// 딸려 감) 하려고요.
// 칠판에 띄우는 전체 화면은 지금까지대로 크게 쌓아 보여 주고, 거기서도
// 재발급할 수 있게 단추를 함께 둡니다(그 화면만 보고 있을 때가 있어서).
// =============================================================
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toDate } from "@/lib/store";
import {
  JOIN_CODE_MAX, JOIN_CODE_MIN, JOIN_CODE_TTL_DAYS, joinCodeLookalikeHint, joinCodeProblem, tidyJoinCode,
} from "@/lib/joinCode";
import { IconPen } from "./StatusIcons";

// 붙여 넣은 'BOOK-3B-CLASS'처럼 붙임표 · 띄어쓰기가 섞인 글이 브라우저에서 먼저 잘리지 않게 칸은
// 넉넉히 받고, 다듬은 뒤의 길이로 판정합니다(12자를 넘으면 저장할 때 까닭을 말함).
const DRAFT_MAX = 24;
const HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;

export default function ClassJoinCode({
  classroom,
  codeInfo,
  onRegenerate,
  regenerating = false,
  disabled = false,
  editing = false,
  saving = false,
  onEditStart,
  onEditCancel,
  onSave,
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState("");   // 저장을 눌렀을 때 받지 못한 까닭(모양 · 다른 반이 씀 …)
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const editBtnRef = useRef(null);
  const wasEditing = useRef(false);
  const titleId = useId();
  const noteId = useId();
  const expired = codeInfo?.expiresAt && toDate(codeInfo.expiresAt) < new Date();
  const expiry = codeInfo?.expiresAt
    ? (expired
      ? "⚠️ 만료된 코드예요 — 재발급해 주세요"
      : `${toDate(codeInfo.expiresAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}까지 유효`)
    : "";

  useEffect(() => {
    if (!fullscreen) return;
    const trigger = triggerRef.current;
    const manager = trigger?.closest(".modal-class-manager");
    const wasInert = manager?.inert;
    const previousOverflow = document.body.style.overflow;
    if (manager) manager.inert = true;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setFullscreen(false);
      } else if (event.key === "Tab") {
        const buttons = [...dialogRef.current.querySelectorAll("button:not(:disabled)")];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!buttons.includes(document.activeElement)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (manager) manager.inert = wasInert;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [fullscreen]);

  // 고치기를 열면 입력칸에 초점(글자를 골라 두어 곧바로 새로 적게), 닫으면 '수정' 단추로 돌려줍니다 —
  // 다른 카드의 입력칸으로 초점이 옮겨 간 때(그 카드를 고치기 시작함)는 빼앗지 않습니다.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) {
      const active = document.activeElement;
      if (!active || active === document.body) editBtnRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  const tidy = tidyJoinCode(draft);
  // 한글 · 기호는 적는 동안 곧바로 알립니다(한/영 키가 한글에 놓인 채 적는 일이 잦음). 길이는 저장할 때만 —
  // 적는 도중 '6자로 정해 주세요'가 줄곧 뜨면 성가십니다.
  const charProblem = HANGUL.test(draft) || /[^A-Z0-9]/.test(tidy) ? joinCodeProblem(tidy) : "";
  const note = problem || charProblem;
  const lookalike = note ? "" : joinCodeLookalikeHint(tidy);

  function startEdit() {
    setDraft(codeInfo?.code ?? "");
    setProblem("");
    onEditStart?.();
  }
  function cancelEdit() {
    setProblem("");
    onEditCancel?.();
  }
  function changeDraft(event) {
    const { value } = event.target;
    // 한글을 조합하는 동안에는 값을 건드리지 않습니다(조합이 끊김) — 조합이 끝나면 다듬습니다.
    setDraft(event.nativeEvent.isComposing ? value : tidyJoinCode(value));
    setProblem("");
  }
  async function save() {
    if (saving) return;
    if (tidy && tidy === codeInfo?.code) { cancelEdit(); return; }   // 그대로면 바꿀 것이 없습니다
    const why = joinCodeProblem(tidy);
    if (why) {
      setProblem(why);
      inputRef.current?.focus();
      return;
    }
    const message = await onSave?.(tidy);
    if (message) {
      setProblem(message);
      inputRef.current?.focus();
    }
  }
  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      // 창(반 관리하기)까지 닫히지 않게 — 공통 Esc 처리는 preventDefault를 보고 비켜 갑니다(lib/modal.js)
      event.preventDefault();
      if (!saving) cancelEdit();
    }
  }

  return (
    <div
      className={`class-joincode${editing ? " is-editing" : ""}`}
      onDragStart={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      <span className="joincode-label">참여 코드</span>
      {editing ? (
        <>
          <input
            ref={inputRef}
            type="text"
            className="joincode-input"
            value={draft}
            onChange={changeDraft}
            onCompositionEnd={(event) => setDraft(tidyJoinCode(event.currentTarget.value))}
            onKeyDown={handleKeyDown}
            readOnly={saving}
            maxLength={DRAFT_MAX}
            placeholder="예: BOOK3B"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label={`${classroom.name}의 새 참여 코드`}
            aria-describedby={noteId}
            aria-invalid={note ? true : undefined}
          />
          <div className="joincode-edit-actions">
            <button type="button" className="btn-ghost" onClick={cancelEdit} disabled={saving}>
              취소
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
          <p
            id={noteId}
            className={`joincode-edit-note${note ? " is-error" : lookalike ? " is-warn" : ""}`}
            aria-live="polite"
          >
            {note || lookalike || `영어 · 숫자 ${JOIN_CODE_MIN}~${JOIN_CODE_MAX}자 — 남이 짐작하기 어려울수록 안전해요. 바꾸면 지금 코드로는 더 들어올 수 없고(이미 들어온 학생은 그대로), 새 코드는 ${JOIN_CODE_TTL_DAYS}일 동안 쓸 수 있어요.`}
          </p>
        </>
      ) : (
        <>
          <span className="joincode-value" aria-live="polite">{codeInfo?.code ?? "—"}</span>
          <button
            ref={editBtnRef}
            type="button"
            className="btn-ghost joincode-edit"
            onClick={startEdit}
            disabled={regenerating || disabled}
            title={`참여 코드를 직접 정해요(영어 · 숫자 ${JOIN_CODE_MIN}~${JOIN_CODE_MAX}자)`}
            aria-label="참여 코드 수정"
          >
            <IconPen size={14} /> 수정
          </button>
          {expiry && <span className={`joincode-expiry${expired ? " expired" : ""}`}>{expiry}</span>}
          <button ref={triggerRef} type="button" className="btn-ghost joincode-expand" onClick={() => setFullscreen(true)} aria-haspopup="dialog">
            전체 화면
          </button>
        </>
      )}
      {fullscreen && createPortal(
        <div className="joincode-fullscreen" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn-ghost joincode-close" onClick={() => setFullscreen(false)} aria-label="전체 화면 닫기">닫기 ×</button>
          <div className="joincode-fullscreen-content">
            <h2 id={titleId} className="joincode-class">{classroom.name}</h2>
            <p className="joincode-label">참여 코드</p>
            <p className="joincode-value" aria-live="polite">{codeInfo?.code ?? "—"}</p>
            <p className="joincode-hint">책방 입장 화면에서 이 코드를 입력하세요</p>
            {expiry && <p className={`joincode-expiry${expired ? " expired" : ""}`}>{expiry}</p>}
            <div className="joincode-actions">
              <button type="button" className="joincode-regen" onClick={onRegenerate} disabled={regenerating || disabled}>
                {regenerating ? "재발급 중…" : "🔄 코드 재발급"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
