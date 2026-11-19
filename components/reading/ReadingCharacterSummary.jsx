"use client";

import { useEffect, useState } from "react";
import { subscribeMyReadingCharacter } from "@/lib/data/reading";
import { characterImage, characterName, characterOf } from "@/lib/readingCharacterCatalog";
import ReadingCharacterInfoModal from "./ReadingCharacterInfoModal";

const number = (value) => value.toLocaleString("ko-KR");
const nonnegative = (value) => Number.isFinite(value) && value >= 0;

export default function ReadingCharacterSummary({ uid, summary = null, active = true, readOnly = false }) {
  const [profile, setProfile] = useState({ ownerUid: null, loaded: false, character: null });
  const [openUid, setOpenUid] = useState(null);

  useEffect(() => {
    let live = true;
    setOpenUid(null);
    setProfile({ ownerUid: uid, loaded: false, character: null });
    if (!uid) return undefined;
    const off = subscribeMyReadingCharacter(uid, (character) => {
      if (live) setProfile({ ownerUid: uid, loaded: true, character });
    });
    return () => { live = false; off?.(); };
  }, [uid]);
  // 교사의 모두 이동 등으로 머리말이 숨으면, native modal도 함께 닫습니다.
  useEffect(() => { if (!active) setOpenUid(null); }, [active]);

  // Render-time ownership guards the frame before the new UID's effect runs.
  const loaded = !!uid && profile.ownerUid === uid && profile.loaded;
  const character = loaded ? characterOf({ uid, character: profile.character }) : null;
  const hasGrowth = loaded && Number.isFinite(summary?.level) && summary.level >= 1;
  const xp = summary?.xp ?? summary?.exp;
  const hasXp = nonnegative(xp);
  const hasNextXp = nonnegative(summary?.nextXp);
  const progress = Number.isFinite(summary?.progress) ? Math.max(0, Math.min(100, Math.round(summary.progress))) : null;
  const xpLabel = hasXp ? summary?.maxLevel ? `${number(xp)} EXP · 최고 레벨` : hasNextXp ? `${number(xp)} / ${number(summary.nextXp)} EXP` : `${number(xp)} EXP` : "";

  const open = active && loaded && openUid === uid;
  // 레벨 옷(Lv.7 탐험가 옷 · Lv.10 마스터 옷 — lib/readingCharacter.js) — 그림은 레벨을 안 뒤에 그립니다(기본 옷이 한 박자
  // 보였다가 바뀌지 않게 · 그동안은 자리만). 레벨은 이 카드가 받은 요약(책 봄의 그 학생 · 아지트의 방 주인)의 것입니다.
  const pictured = loaded && hasGrowth;
  const ownerLabel = readOnly ? "학생의 캐릭터" : "나의 캐릭터";
  return <>
    <button type="button" className="reading-character-summary" aria-label={loaded ? `${characterName(character)}${hasGrowth ? ` · 독서 레벨 ${summary.level}${xpLabel ? ` · ${xpLabel}` : ""}` : ""} · ${ownerLabel} 자세히 보기` : `${ownerLabel} 불러오는 중`}
      aria-haspopup="dialog" aria-expanded={open} disabled={!loaded || !active} onClick={() => { if (loaded && active) setOpenUid(uid); }}>
      {pictured ? <img src={characterImage(character, summary.level)} width={60} height={60} alt="" draggable={false} />
        : <span className="reading-character-placeholder" aria-hidden="true" />}
      <span className="reading-character-info">
        <small>{ownerLabel}</small>
        <strong>{loaded ? characterName(character) : "불러오는 중…"}</strong>
        {loaded && profile.character === null && <em>기본 캐릭터</em>}
        <span className="reading-character-growth">
          {hasGrowth ? <>
            <span className="reading-character-level">독서 레벨 <b>Lv. {number(summary.level)}</b></span>
            {progress !== null && <span className="reading-character-growth-track" role="progressbar" aria-label={summary.maxLevel ? "최고 독서 레벨" : "다음 독서 레벨까지"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <i style={{ width: `${progress}%` }} />
            </span>}
            {xpLabel && <span className="reading-character-xp">{xpLabel}</span>}
          </> : <span className="reading-character-xp">독서 기록 불러오는 중…</span>}
        </span>
      </span>
    </button>
    {open && <ReadingCharacterInfoModal key={uid} uid={uid} character={profile.character} isDefault={profile.character === null} summary={summary} readOnly={readOnly} onClose={() => setOpenUid(null)} />}
  </>;
}
