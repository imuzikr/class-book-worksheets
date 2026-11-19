"use client";
// =============================================================
// 레벨 옷이 바뀌는 순간의 축하 — 독서 레벨 7 · 10에 닿아 캐릭터가 새 옷을 입을 때(선생님 요청)
// -------------------------------------------------------------
// 펫이 깨어날 때처럼 창이 아니라 폭죽(RewardCelebration) 위에 띄웠다가 저절로 사라집니다(5.2초 · 누를 단추 없음).
//   예전 옷(0~0.9초) → 빛이 번쩍(0.85~1.6초) → 새 옷이 튀어나옴(1.05초) · 그때 폭죽을 한 번 더 · 글자가 떠오름.
// 언제 띄우나는 lib/readingOutfitCheer.js(옷마다 한 번 · 이 기기에 기억), 띄우는 자리는 책 봄(학생 본인 화면 — ReadingHub).
// 캐릭터는 내 프로필에서 한 번 읽고(학생 캐릭터를 끈 반은 기본 캐릭터), 두 옷의 그림을 먼저 받아 둔 뒤 시작합니다
// (그림이 늦게 와 빈 자리에서 튀어나오지 않게 — 1.5초가 지나면 그냥 시작).
// 기기의 '동작 줄이기' 설정에서는 폭죽 · 밤하늘 없이(RewardCelebration) 새 옷과 글자만 떠 있다 사라집니다(CSS).
// =============================================================
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeMyReadingCharacter } from "@/lib/data/reading";
import { characterImage, characterOf } from "@/lib/readingCharacterCatalog";
import { journeyTitle } from "@/lib/readingJourney";
import RewardCelebration from "../RewardCelebration";
import "./pet.css";

const REVEAL_MS = 1000;
const PRELOAD_MS = 1500;

function preload(srcs) {
  return Promise.race([
    Promise.all(srcs.map((src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    }))),
    new Promise((resolve) => setTimeout(resolve, PRELOAD_MS)),
  ]);
}

// from · to — CHARACTER_OUTFITS의 옷(예전 · 새) · level — 지금 독서 레벨 · characterOn — 학생 캐릭터를 켠 반인가
export default function OutfitCelebration({ uid, characterOn = true, from, to, level, onDone }) {
  const [chosen, setChosen] = useState({ uid: null, character: null });
  const [ready, setReady] = useState(false);
  const [shots, setShots] = useState(1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!characterOn) return undefined;
    let live = true;
    const off = subscribeMyReadingCharacter(uid, (value) => { if (live) setChosen({ uid, character: value }); });
    return () => { live = false; off?.(); };
  }, [uid, characterOn]);
  // 학생 캐릭터를 끈 반은 기본 캐릭터(리더보드 · 광장과 같은 약속)
  const character = !characterOn ? characterOf({ uid }) : chosen.uid === uid ? characterOf({ uid, character: chosen.character }) : null;
  const oldSrc = character ? characterImage(character, from.level) : null;
  const newSrc = character ? characterImage(character, to.level) : null;
  useEffect(() => {
    if (!oldSrc || !newSrc) return undefined;
    let live = true;
    preload([oldSrc, newSrc]).then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [oldSrc, newSrc]);
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(() => setShots(2), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready || typeof document === "undefined") return null;
  const title = journeyTitle(to.level);
  return createPortal(
    <RewardCelebration amount={shots} onDone={() => doneRef.current?.()}>
      <div className="outfit-burst" role="status">
        <span className="outfit-burst-stage" aria-hidden="true">
          <span className="outfit-burst-glow" />
          <span className="outfit-burst-old"><img src={oldSrc} alt="" width={210} height={210} draggable={false} /></span>
          <span className="outfit-burst-flash" />
          <span className="outfit-burst-new"><img src={newSrc} alt="" width={230} height={230} draggable={false} /></span>
        </span>
        <span className="outfit-burst-note">
          <span className="outfit-burst-level">{level === to.level ? `독서 레벨 ${level} 달성!` : `독서 레벨 ${level}`}</span>
          <strong>{title}가 되었어요!</strong>
          <span className="outfit-burst-sub">{to.name}을 입었어요. {to.level >= 10 ? "끝까지 걸어온 독서 여정을 축하해요!" : "책 광장\u00a0·\u00a0교실\u00a0·\u00a0아지트에서도 새 옷이에요."}</span>
        </span>
      </div>
    </RewardCelebration>,
    document.body,
  );
}
