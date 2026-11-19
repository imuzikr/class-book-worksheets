// =============================================================
// 레벨 옷이 바뀌는 순간의 축하 — 언제 띄우나 (셈 + 이 기기의 기억)
// -------------------------------------------------------------
// 독서 레벨이 7 · 10에 닿아 옷(lib/readingCharacter.js의 CHARACTER_OUTFITS)이 바뀌면 책 봄에서 한 번 폭죽과 함께
// '예전 옷 → 빛 → 새 옷'을 보여 줍니다(components/reading/OutfitCelebration.jsx · 선생님 요청).
//   · 옷마다 **한 번** — 이 기기에 학생마다 '축하한 가장 높은 옷'을 적어 둡니다(같은 기기에서 다시 안 뜸).
//   · 이미 Lv.7 · Lv.10인 학생이 이 기능이 생긴 뒤 처음 책 봄을 열면 그때 한 번 뜹니다(적힌 것이 없으므로).
//   · 레벨이 내려가 옷이 돌아간 뒤 다시 오르면 또 뜨지 않습니다(가장 높은 옷만 기억 · 내려갈 때는 알리지 않음).
//   · 저장이 막힌 기기(사생활 보호 창 등)는 이 탭이 떠 있는 동안만 기억합니다.
// =============================================================
import { CHARACTER_OUTFITS, characterOutfit } from "./readingCharacter.js";

const KEY = (uid) => `bookbom.outfit.cheer.v1:${encodeURIComponent(uid)}`;
const memory = new Map();
const rank = (key) => CHARACTER_OUTFITS.findIndex((outfit) => outfit.key === key);

/** 축하할 옷 — { from(예전 옷), to(새 옷) } 또는 null. seenKey는 이 기기에 적힌 '축하한 가장 높은 옷'(없으면 null). */
export function outfitCheerFor(seenKey, level) {
  const to = characterOutfit(level);
  const target = rank(to.key);
  if (target <= 0 || rank(seenKey) >= target) return null;
  return { from: CHARACTER_OUTFITS[target - 1], to };
}

export function readOutfitSeen(uid) {
  if (!uid) return null;
  if (memory.has(uid)) return memory.get(uid);
  try {
    const value = typeof window === "undefined" ? null : window.localStorage.getItem(KEY(uid));
    return rank(value) >= 0 ? value : null;
  } catch {
    return null;
  }
}

export function markOutfitSeen(uid, key) {
  if (!uid || rank(key) < 0 || rank(readOutfitSeen(uid)) >= rank(key)) return;
  memory.set(uid, key);
  try { window.localStorage.setItem(KEY(uid), key); } catch { /* 저장이 막힌 기기 — 이 탭의 기억으로만 */ }
}
