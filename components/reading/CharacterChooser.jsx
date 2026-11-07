"use client";
// =============================================================
// 독서 동반자(캐릭터) 고르기 창 — 독서 여정 지도의 '캐릭터 꾸미기'와 상단바
// '내 프로필' 창의 '바꾸기'가 같은 창 하나를 씁니다(두 곳이 어긋나지 않게).
// 동물 10종(WORLD_CHARACTERS) × 의상 2벌, 그림은 public/reading-journey/.
// =============================================================
import { useEffect, useId, useRef, useState } from "react";
import { WORLD_CHARACTERS, defaultWorldAvatar } from "@/lib/readingWorldMap";
import "./reading-world-map.css";

/** 고른 값이 없으면 uid로 정해지는 기본 동물 · 중급 스타일. */
export const characterOf = (row) => ({
  number: Number.isInteger(row?.character?.number) && row.character.number >= 1 && row.character.number <= 10
    ? row.character.number : defaultWorldAvatar(row?.uid || ""),
  style: row?.character?.style === "advanced" ? "advanced" : "intermediate",
});
export const characterImage = (character) => `/reading-journey/${character.style}-${String(character.number).padStart(2, "0")}.webp`;
// 스타일 이름 — 그림 세트(intermediate · advanced)를 화면에서는 중급 · 고급으로 부릅니다
// (선생님 요청 — 한때 '모험 · 무술복 스타일'). 초급 세트는 그림이 오면 더합니다.
export const CHARACTER_STYLE_OPTIONS = [["intermediate", "중급"], ["advanced", "고급"]];
export const styleLabel = (style) => (style === "advanced" ? "고급" : "중급");
export const characterName = (character) => {
  const animal = WORLD_CHARACTERS.find((c) => c.number === character?.number)?.name || "캐릭터";
  return `${animal} · ${styleLabel(character?.style)}`;
};

export default function CharacterChooser({ row, onClose, onSave }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [draft, setDraft] = useState(() => characterOf(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try { await onSave(draft); }
    catch (e) { setError(e?.message || "캐릭터를 저장하지 못했어요. 다시 시도해 주세요."); setBusy(false); }
  }
  return <dialog ref={dialog} className="rwm-character-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="rwm-character-head"><div><span>나의 독서 동반자</span><h3 id={titleId}>함께 걸을 캐릭터를 골라요</h3></div><button type="button" aria-label="캐릭터 선택 닫기" disabled={busy} onClick={onClose}>×</button></div>
    <p>모든 캐릭터와 의상을 자유롭게 선택할 수 있어요.</p>
    <fieldset className="rwm-outfits" disabled={busy}><legend>스타일 선택</legend>{CHARACTER_STYLE_OPTIONS.map(([value, label]) => <label key={value}><input type="radio" name={titleId} checked={draft.style === value} onChange={() => setDraft((old) => ({ ...old, style: value }))} />{label}</label>)}</fieldset>
    <div className="rwm-character-grid" role="group" aria-label="캐릭터 선택">{WORLD_CHARACTERS.map((character) => <button key={character.number} type="button" disabled={busy} aria-pressed={draft.number === character.number} onClick={() => setDraft((old) => ({ ...old, number: character.number }))}>
      <img src={characterImage({ number: character.number, style: draft.style })} alt="" width={100} height={100} /><span>{character.name}</span>
    </button>)}</div>
    {error && <p className="rwm-save-error" role="alert">{error}</p>}
    <div className="rwm-character-footer"><button type="button" disabled={busy} onClick={onClose}>취소</button><button type="button" disabled={busy} onClick={save}>{busy ? "저장 중…" : "이 캐릭터로 함께하기"}</button></div>
  </dialog>;
}
