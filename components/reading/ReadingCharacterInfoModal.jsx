"use client";

import { useEffect, useId, useRef } from "react";
import { characterCatalog, characterImage, characterName, characterOf, styleLabel } from "@/lib/readingCharacterCatalog";

const number = (value) => value.toLocaleString("ko-KR");
const nonnegative = (value) => Number.isFinite(value) && value >= 0;

function onBackdrop(event) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

// Uses the already loaded appearance and reading summary. The native dialog
// keeps keyboard focus inside, including when the card sits in a clipped rail.
export default function ReadingCharacterInfoModal({ uid, character, isDefault = false, summary = null, onClose }) {
  const dialogRef = useRef(null);
  const backdropDown = useRef(false);
  const titleId = useId();
  const appearance = characterOf({ uid, character });
  const name = characterCatalog(appearance.style).find((item) => item.number === appearance.number)?.name || "캐릭터";
  const xp = summary?.xp ?? summary?.exp;
  const hasLevel = Number.isFinite(summary?.level) && summary.level >= 1;
  const hasXp = nonnegative(xp);
  const hasProgress = Number.isFinite(summary?.progress);
  const progress = hasProgress ? Math.max(0, Math.min(100, Math.round(summary.progress))) : 0;

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} className="reading-character-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}
    onPointerDown={(event) => { backdropDown.current = onBackdrop(event); }}
    onPointerCancel={() => { backdropDown.current = false; }}
    onClick={(event) => { const close = backdropDown.current && onBackdrop(event); backdropDown.current = false; if (close) onClose(); }}>
    <header className="reading-character-dialog-head">
      <h2 id={titleId}>나의 캐릭터</h2>
      <button type="button" aria-label="캐릭터 정보 닫기" onClick={onClose}>×</button>
    </header>
    <figure className="reading-character-dialog-figure">
      <img src={characterImage(appearance)} alt="" width={220} height={220} draggable={false} />
      <figcaption>{characterName(appearance)}</figcaption>
    </figure>
    <dl className="reading-character-dialog-facts">
      <div><dt>캐릭터 이름</dt><dd>{name}</dd></div>
      <div><dt>스타일</dt><dd>{styleLabel(appearance.style)}</dd></div>
      <div><dt>선택</dt><dd>{isDefault ? "기본 캐릭터" : "내가 고른 캐릭터"}</dd></div>
    </dl>
    <p className="reading-character-dialog-note">독서 맵·교실·책 광장·아지트에서 나를 나타내는 캐릭터예요. 스타일은 독서 레벨과 관계없이 고를 수 있어요. 캐릭터 변경은 상단의 내 프로필에서 할 수 있어요.</p>
    {(hasLevel || hasXp || hasProgress) && <section className="reading-character-dialog-stats" aria-label="독서 성장 정보">
      <h3>나의 독서 성장</h3>
      <dl>
        {hasLevel && <div><dt>독서 레벨</dt><dd>Lv. {number(summary.level)}</dd></div>}
        {hasXp && <div><dt>누적 경험치</dt><dd>{number(xp)} EXP</dd></div>}
      </dl>
      {hasProgress && <div className="reading-character-dialog-progress">
        <p><span>{summary.maxLevel ? "최고 레벨" : "다음 레벨 진도"}</span><strong>{progress}%</strong></p>
        <div className="reading-character-progress-track" role="progressbar" aria-label={summary.maxLevel ? "최고 레벨" : "다음 독서 레벨까지"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <i style={{ width: `${progress}%` }} />
        </div>
      </div>}
    </section>}
    <footer className="reading-character-dialog-foot"><button type="button" onClick={onClose}>닫기</button></footer>
  </dialog>;
}
