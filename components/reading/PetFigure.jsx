"use client";

// =============================================================
// 독서 펫 그림 한 장(lib/readingPet.js)
// -------------------------------------------------------------
// 그림 파일(public/reading-pets/{종}-{단계}.webp · egg.webp)이 준비된 종은 그 그림을,
// 아직 없으면 자리표시를 그립니다 — 알은 그린 알 한 개(종을 드러내지 않음), 깨어난 펫은
// 옅은 동그라미 안의 동물 그림 문자(단계가 오를수록 커짐). 그림이 오면 PET_ART_READY에
// 종을 더하는 것만으로 바뀝니다(없는 파일을 학생마다 요청하지 않게).
// 꾸밈 그림이라 읽어 주는 기기에는 감춥니다 — 이름 · 단계는 옆 글자가 말합니다.
// =============================================================
import { useId } from "react";
import { petImageSrc, petSpecies, PET_STAGE_MAX } from "@/lib/readingPet";
import "./pet.css";

// 자리표시 동그라미의 옅은 바탕 — 종마다(그림이 오면 쓰지 않음)
const TINTS = {
  owl: "#efe4d6", hedgehog: "#f2e7dc", chick: "#fff3c7", otter: "#e8e0d6", fennec: "#fbe8d3",
  redpanda: "#f9dfd3", rabbit: "#efe7f7", bear: "#f0e4d7", cat: "#f7ebe4", puppy: "#f7ecdb",
};

// 그린 알 — 크림빛 알에 파스텔 점. ready면 살짝 흔들립니다(곧 깨어남).
export function PetEgg({ ready = false, size = 64 }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`pet-egg${ready ? " is-ready" : ""}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-shell`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="62%" stopColor="#fbefd2" />
          <stop offset="100%" stopColor="#ecd7a8" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="93" rx="23" ry="4.5" fill="#6b5a3a" opacity=".14" />
      <path d="M50 8C68 8 80 38 80 60c0 19-13 31-30 31S20 79 20 60C20 38 32 8 50 8Z" fill={`url(#${id}-shell)`} stroke="#dcc595" strokeWidth="1.6" />
      <circle cx="38" cy="44" r="5.2" fill="#f5c7bd" />
      <circle cx="61" cy="34" r="3.6" fill="#c5e2d0" />
      <circle cx="64" cy="64" r="6" fill="#cddcf3" />
      <circle cx="40" cy="72" r="4.4" fill="#f3dc9d" />
      <circle cx="53" cy="53" r="2.6" fill="#e8cbe5" />
      <ellipse cx="37" cy="27" rx="4.5" ry="9" transform="rotate(-24 37 27)" fill="#fff" opacity=".7" />
    </svg>
  );
}

/**
 * species — 종 열쇠(알이면 null) · stage — 1~10 · ready — 곧 깨어날 알 · size — 한 변(px)
 */
export default function PetFigure({ species = null, stage = 1, ready = false, size = 64, className = "" }) {
  const egg = !species || stage <= 1;
  const src = petImageSrc(egg ? null : species, egg ? 1 : stage);
  const box = { width: size, height: size };
  if (src) {
    return (
      <span className={`pet-figure${egg && ready ? " is-ready" : ""} ${className}`.trim()} style={box} aria-hidden="true">
        <img src={src} alt="" width={size} height={size} draggable={false} loading="lazy" />
      </span>
    );
  }
  if (egg) {
    return <span className={`pet-figure ${className}`.trim()} style={box} aria-hidden="true"><PetEgg ready={ready} size={size} /></span>;
  }
  const sp = petSpecies(species);
  // 단계가 오를수록 그림 문자가 커집니다(2단계 40% → 10단계 80%)
  const scale = 0.4 + (Math.min(PET_STAGE_MAX, Math.max(2, stage)) - 2) * 0.05;
  return (
    <span className={`pet-figure pet-ph ${className}`.trim()} aria-hidden="true"
      style={{ ...box, "--pet-tint": TINTS[species] ?? "#f3ece2", "--pet-glyph": `${Math.round(size * scale)}px` }}>
      <span className="pet-ph-glyph">{sp?.emoji ?? "🐾"}</span>
    </span>
  );
}
