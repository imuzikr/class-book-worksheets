"use client";

import { useEffect, useState } from "react";
import { subscribeMyReadingCharacter } from "@/lib/data/reading";
import { characterImage, characterName, characterOf } from "@/lib/readingCharacterCatalog";
import ReadingCharacterInfoModal from "./ReadingCharacterInfoModal";

export default function ReadingCharacterSummary({ uid, summary = null, active = true }) {
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

  const open = active && loaded && openUid === uid;
  return <>
    <button type="button" className="reading-character-summary" aria-label={loaded ? `${characterName(character)} · 나의 캐릭터 자세히 보기` : "나의 캐릭터 불러오는 중"}
      aria-haspopup="dialog" aria-expanded={open} disabled={!loaded || !active} onClick={() => { if (loaded && active) setOpenUid(uid); }}>
      {loaded ? <img src={characterImage(character)} width={60} height={60} alt="" draggable={false} />
        : <span className="reading-character-placeholder" aria-hidden="true" />}
      <span className="reading-character-info">
        <small>나의 캐릭터</small>
        <strong>{loaded ? characterName(character) : "불러오는 중…"}</strong>
        {loaded && profile.character === null && <em>기본 캐릭터</em>}
      </span>
    </button>
    {open && <ReadingCharacterInfoModal key={uid} uid={uid} character={profile.character} isDefault={profile.character === null} summary={summary} onClose={() => setOpenUid(null)} />}
  </>;
}
