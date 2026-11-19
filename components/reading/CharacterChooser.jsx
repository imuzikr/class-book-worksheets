"use client";
// =============================================================
// 독서 동반자(캐릭터) 고르기 창 — 독서 여정 지도의 '캐릭터 꾸미기'와 상단바
// '내 프로필' 창의 '바꾸기'가 같은 창 하나를 씁니다(두 곳이 어긋나지 않게).
// 수련생(십이지) 10종 · 무도가(동물) 10종 · 영웅(판타지) 10종, 그림은 public/reading-journey/.
// 묶음 차례 · 이름 · 그림 경로는 lib/readingCharacterCatalog.js 한 곳입니다.
// 참여 코드로 반에 막 들어온 학생의 '첫 만남'(StudentWelcome)도 이 창을 씁니다 — 머리말 · 안내 · 닫는 단추의 말만
// 바꿔 넘깁니다(eyebrow · title · lead · cancelLabel — 넘기지 않으면 지금 그대로).
// 그림은 **고르는 학생의 지금 옷**으로 보입니다(row.level — 레벨 옷 Lv.7 · Lv.10, lib/readingCharacter.js) — 다른 캐릭터로
// 바꿔도 같은 옷을 입은 모습이라, 고른 뒤의 모습 그대로입니다. 레벨을 모르면 기본 옷.
// =============================================================
import { useEffect, useId, useRef, useState } from "react";
import { CHARACTER_STYLE_OPTIONS, characterCatalog, characterOf, characterImage } from "@/lib/readingCharacterCatalog";
import "./reading-world-map.css";

// 지도 · 프로필 · TOP 3에서 쓰던 경로도 같은 순수 helper를 사용합니다.
export { CHARACTER_STYLE_OPTIONS, characterOf, characterImage, styleLabel, characterName } from "@/lib/readingCharacterCatalog";

export default function CharacterChooser({
  row, onClose, onSave,
  eyebrow = "나의 독서 동반자", title = "함께 걸을 캐릭터를 골라요",
  lead = "원하는 등급과 캐릭터를 자유롭게 선택할 수 있어요.", cancelLabel = "취소",
}) {
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
  // Esc는 이 창만 닫습니다 — keydown에서 preventDefault를 불러 공통 처리(lib/modal.js)가 뒤에 떠 있는 창(선생님의 '내 프로필'은
  // 고르는 동안 그대로 떠 있음)까지 닫지 않게 합니다. 브라우저가 따로 보내는 cancel도 같은 닫기라 두 번 불려도 그대로입니다.
  return <dialog ref={dialog} className="rwm-character-dialog" aria-labelledby={titleId}
    onKeyDown={(event) => { if (event.key !== "Escape" || event.nativeEvent.isComposing) return; event.preventDefault(); if (!busy) onClose(); }}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="rwm-character-head"><div><span>{eyebrow}</span><h3 id={titleId}>{title}</h3></div><button type="button" aria-label="캐릭터 선택 닫기" disabled={busy} onClick={onClose}>×</button></div>
    <p>{lead}</p>
    <fieldset className="rwm-outfits" disabled={busy}><legend>캐릭터 등급</legend>{CHARACTER_STYLE_OPTIONS.map(([value, label]) => <label key={value}><input type="radio" name={titleId} checked={draft.style === value} onChange={() => setDraft((old) => ({ ...old, style: value }))} />{label}</label>)}</fieldset>
    <div className="rwm-character-grid" role="group" aria-label="캐릭터 선택">{characterCatalog(draft.style).map((character) => <button key={character.number} type="button" disabled={busy} aria-pressed={draft.number === character.number} onClick={() => setDraft((old) => ({ ...old, number: character.number }))}>
      <img src={characterImage({ number: character.number, style: draft.style }, row?.level)} alt="" width={100} height={100} /><span>{character.name}</span>
    </button>)}</div>
    {error && <p className="rwm-save-error" role="alert">{error}</p>}
    <div className="rwm-character-footer"><button type="button" disabled={busy} onClick={onClose}>{cancelLabel}</button><button type="button" disabled={busy} onClick={save}>{busy ? "저장 중…" : "이 캐릭터로 함께하기"}</button></div>
  </dialog>;
}
