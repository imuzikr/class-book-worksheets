"use client";

import { useEffect, useId, useRef } from "react";
import { characterCatalog, characterImage, characterName, characterOf, styleLabel } from "@/lib/readingCharacterCatalog";
import { outfitWardrobe } from "@/lib/readingCharacter";

const number = (value) => value.toLocaleString("ko-KR");
const nonnegative = (value) => Number.isFinite(value) && value >= 0;

function onBackdrop(event) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

// Uses the already loaded appearance and reading summary. The native dialog
// keeps keyboard focus inside, including when the card sits in a clipped rail.
export default function ReadingCharacterInfoModal({ uid, character, isDefault = false, summary = null, readOnly = false, onClose }) {
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
  // 옷장 — 레벨 옷 셋(기본 · Lv.7 탐험가 옷 · Lv.10 마스터 옷 — lib/readingCharacter.js). 아직 못 입는 옷은 **검은 그림자**로 감추고
  // 그 옷까지 남은 경험치를 적습니다(선생님 결정 — 무엇이 나올지 궁금하게). 누적 경험치를 모르면 옷장을 그리지 않습니다.
  const wardrobe = hasXp ? outfitWardrobe(xp) : null;
  const outfitLevel = hasLevel ? summary.level : null;

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
      <h2 id={titleId}>{readOnly ? "학생의 캐릭터" : "나의 캐릭터"}</h2>
      <button type="button" aria-label="캐릭터 정보 닫기" onClick={onClose}>×</button>
    </header>
    <figure className="reading-character-dialog-figure">
      <img src={characterImage(appearance, outfitLevel)} alt="" width={220} height={220} draggable={false} />
      <figcaption>{characterName(appearance)}</figcaption>
    </figure>
    <dl className="reading-character-dialog-facts">
      <div><dt>캐릭터 이름</dt><dd>{name}</dd></div>
      <div><dt>스타일</dt><dd>{styleLabel(appearance.style)}</dd></div>
      <div><dt>선택</dt><dd>{isDefault ? "기본 캐릭터" : readOnly ? "학생이 고른 캐릭터" : "내가 고른 캐릭터"}</dd></div>
    </dl>
    <p className="reading-character-dialog-note">독서 맵·교실·책 광장·아지트에서 {readOnly ? "학생을" : "나를"} 나타내는 캐릭터예요. 스타일은 독서 레벨과 관계없이 고를 수 있고, 독서 레벨 7과 10에 닿으면 새 옷을 입어요. {readOnly ? "학생이 자신의 프로필에서 캐릭터를 바꿀 수 있어요." : "캐릭터 변경은 상단의 내 프로필에서 할 수 있어요."}</p>
    {wardrobe && <section className="reading-character-wardrobe" aria-label="옷장 — 독서 레벨에 따라 입는 옷">
      <h3>옷장</h3>
      <ul>
        {wardrobe.map((outfit, index) => {
          const until = wardrobe[index + 1] ? `Lv.${outfit.level}~${wardrobe[index + 1].level - 1}` : `Lv.${outfit.level}`;
          return <li key={outfit.key} className={`${outfit.unlocked ? "" : "is-locked"}${outfit.current ? " is-current" : ""}`}>
            <span className="reading-character-wardrobe-art">
              <img src={characterImage(appearance, outfit.level)} alt="" width={96} height={96} draggable={false} />
            </span>
            <strong>{outfit.name}</strong>
            <span>{outfit.current ? "지금 입은 옷" : outfit.unlocked ? `${until} · 지나온 옷` : `${number(outfit.remaining)} EXP 남았어요`}</span>
          </li>;
        })}
      </ul>
    </section>}
    {(hasLevel || hasXp || hasProgress) && <section className="reading-character-dialog-stats" aria-label="독서 성장 정보">
      <h3>{readOnly ? "학생의 독서 성장" : "나의 독서 성장"}</h3>
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
