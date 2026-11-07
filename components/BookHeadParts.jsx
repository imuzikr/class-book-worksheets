"use client";

// =============================================================
// 독서 활동 화면의 작은 공통 조각 — 배움나눔(class-peer-qna)의 같은 파일에서 가져옴
// -------------------------------------------------------------
// 배움나눔은 이 파일에 교사 머리말(BookBoardHead)까지 두고 활동 화면 전부를
// 이 조각으로 그리게 바꿨습니다. 책봄은 아직 화면마다 머리말을 따로 짜므로
// **작은 조각만** 들였습니다 — 새 활동(낱말 빙고)과 도서 정보 단추가 씁니다.
//
//  · BookInfoLink   — '도서 정보' 단추(교사 · 학생 공용)
//  · BookSaveStatus — 학생 화면의 저장 표시(잠김 · 저장 중 · 저장됨 · 실패)
//  · BookLockedNote — 학생 화면 머리말 아래의 잠김 안내 한 줄
//  · BookLockToggle — 교사 머리말의 '활동 열림 / 잠김' 단추(주제어 · 도서명 다음)
// =============================================================

import { useState } from "react";
import { safeBookUrl } from "@/lib/paratext";
import { updateBookActivity } from "@/lib/store";
import { IconBook, IconLock, IconLockState } from "./StatusIcons";

export const BOOK_LOCKED_TEACHER = "지금은 잠겨 있어 학생이 고칠 수 없어요.";
export const BOOK_LOCKED_STUDENT = "지금은 잠겨 있어 고칠 수 없어요. 쓴 내용은 그대로 남아 있습니다.";
export const BOOK_NO_STUDENTS = "아직 이 반에 들어온 학생이 없어요. 학생이 반에 들어오면 목록이 생깁니다.";
export const BOOK_PICK_STUDENT = "왼쪽에서 학생을 골라 주세요.";
export const BOOK_PICK_GROUP_STUDENT = "왼쪽 모둠 카드에서 학생 이름을 눌러 주세요.";

// 도서 정보 — 활동에 주소가 있을 때만. 열 수 없는 주소(javascript: 등)는 안 그립니다.
export function BookInfoLink({ url }) {
  const href = safeBookUrl(url);
  if (!href) return null;
  return (
    <a className="btn-primary book-info-btn" href={href} target="_blank" rel="noopener noreferrer">
      <IconBook size={15} /> 도서 정보
    </a>
  );
}

// 학생 화면 머리의 저장 표시 — 저장은 늘 저절로라 '제출'이 없고, 이 한 줄이
// 지금 상태를 말합니다. **실패를 숨기지 않습니다** — 예전에 넷이 실패를
// 'idle'로 삼켜 학생은 저장된 줄 알았습니다. 글은 화면에 그대로 있고, 다시
// 고치면 다시 저장합니다.
//   status: "idle" | "saving" | "saved" | "error"
export function BookSaveStatus({ status, locked }) {
  if (locked) {
    return (
      <span className="paratext-saved locked">
        <IconLock size={14} /> 잠김
      </span>
    );
  }
  if (status === "saving") return <span className="paratext-saved" aria-live="polite">저장 중…</span>;
  if (status === "saved") return <span className="paratext-saved" aria-live="polite">저장됨</span>;
  if (status === "error") {
    return (
      <span
        className="paratext-saved err"
        role="alert"
        title="쓴 글은 화면에 그대로 있어요. 연결을 확인하고 한 글자만 고치면 다시 저장합니다."
      >
        저장하지 못했어요
      </span>
    );
  }
  return null;
}

// 학생 화면 머리말 아래의 잠김 안내 — 활동마다 남는 것이 달라 뒷말만 받습니다.
export function BookLockedNote({ children = BOOK_LOCKED_STUDENT }) {
  return (
    <p className="book-locked-note">
      <IconLock size={15} /> {children}
    </p>
  );
}

// 교사 머리말의 활동 여닫기 — 활동 목록 카드의 '활동 잠그기 / 활동 시작하기'와
// **같은 값**(activity.locked)을 고칩니다. 활동을 연 채로도 잠그고 열 수 있게
// 주제어 · 도서명 다음에 둡니다(선생님 요청). 그 자리가 곧 상태라 자물쇠 그림과
// 상태 말을 달고, 할 일은 툴팁이 말합니다(동료 평가 여닫기와 같은 모양).
// 동료 평가 잠금(peerReviewLocked)과는 따로입니다.
export function BookLockToggle({ activity }) {
  const [busy, setBusy] = useState(false);
  if (!activity?.id) return null;
  const locked = activity.locked === true;
  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      await updateBookActivity(activity.id, { locked: !locked });
    } catch (e) {
      console.warn("[활동 잠금] 바꾸지 못했어요:", e?.code, e?.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className={`btn-ghost peer-lock-btn book-lock-toggle${locked ? " on" : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={locked}
      title={
        locked
          ? "지금 잠겨 있어요 — 눌러서 학생이 다시 쓸 수 있게 엽니다"
          : "지금 열려 있어요 — 눌러서 잠그면 학생이 더 고칠 수 없어요"
      }
    >
      <IconLockState locked={locked} size={14} />
      {locked ? "활동 잠김" : "활동 열림"}
    </button>
  );
}
