"use client";

import { useEffect, useState } from "react";
import { subscribeMyReadingCharacter } from "@/lib/data/reading";
import { characterImage, characterName, characterOf } from "@/lib/readingCharacterCatalog";

export default function ReadingCharacterSummary({ uid }) {
  const [profile, setProfile] = useState({ ownerUid: null, loaded: false, character: null });

  useEffect(() => {
    let live = true;
    setProfile({ ownerUid: uid, loaded: false, character: null });
    if (!uid) return undefined;
    const off = subscribeMyReadingCharacter(uid, (character) => {
      if (live) setProfile({ ownerUid: uid, loaded: true, character });
    });
    return () => { live = false; off?.(); };
  }, [uid]);

  // Render-time ownership guards the frame before the new UID's effect runs.
  const loaded = !!uid && profile.ownerUid === uid && profile.loaded;
  const character = loaded ? characterOf({ uid, character: profile.character }) : null;

  return <div className="reading-character-summary" role="group" aria-label="나의 캐릭터">
    {loaded ? <img src={characterImage(character)} width={60} height={60} alt="" draggable={false} />
      : <span className="reading-character-placeholder" aria-hidden="true" />}
    <span className="reading-character-info">
      <small>나의 캐릭터</small>
      <strong>{loaded ? characterName(character) : "불러오는 중…"}</strong>
      {loaded && profile.character === null && <em>기본 캐릭터</em>}
    </span>
  </div>;
}
