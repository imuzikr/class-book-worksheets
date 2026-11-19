// The public journey appearance is separate from reading records and rewards.
// Keep both the authenticated API and demo strict about the same small shape.
import { getExpForReadingLevel, getReadingLevel, READING_BADGES, READING_FORMULA } from "./reading.js";

// 캐릭터 묶음(스타일)의 열쇠는 '묶음 이름'입니다 — 등급 이름(수련생 · 무도가 · 영웅)은 화면 글자일 뿐이라
// 바뀌어도 저장값이 따라 바뀌지 않게(목록 · 이름 · 그림은 lib/readingCharacterCatalog.js).
export const CHARACTER_STYLES = Object.freeze(["zodiac", "animal", "fantasy"]);
const STYLES = new Set(CHARACTER_STYLES);
// 2026년 11월 묶음을 바꾸기 전에 저장된 값 — 읽을 때 · 저장할 때 새 열쇠로 옮깁니다(이미 고른 모습이 그대로 남게).
//  beginner = 판타지(그 그림 그대로, 지금은 영웅) · intermediate = 동물(그대로, 무도가)
//  advanced = 11월 9일부터 십이지 그림이 들어 있던 자리(그 전에는 전통 무술복 동물 — 그 그림이 십이지로 바뀌며
//             고른 번호 그대로 십이지가 보였음) → 같은 번호의 십이지(지금은 수련생). 쥐는 쥐, 용은 용.
const LEGACY_STYLES = Object.freeze({ beginner: "fantasy", intermediate: "animal", advanced: "zodiac" });
const BADGE_IDS = new Set(READING_BADGES.map((badge) => badge.id));
const SUMMARY_COUNTS = ["totalXp", "totalPages", "completedBooks", "reviewCount", "longestStreak", "streakRun"];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const nonnegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

// ── 레벨 옷 (선생님 요청 · 2026년 11월) ─────────────────────────────────────
// 독서 레벨이 오르면 고른 캐릭터가 옷을 갈아입습니다 — Lv.1~6 기본 옷 · Lv.7~9 탐험가 옷 · Lv.10 마스터 옷
// (이름은 독서 맵의 칭호 '독서 탐험가' · '독서 마스터'와 짝 — lib/readingJourney.js의 journeyTitle).
// 고른 묶음 · 번호는 그대로이고 그림만 바뀝니다 — 카드 그림 `{묶음}-{번호}-lv07.webp`, 걷는 그림도 같은 이름
// (그림은 scripts/prepare-outfit-art.py · 경로는 lib/readingCharacterCatalog.js의 characterImage ·
// lib/readingPlazaSprites.js의 plazaCharacterSheet). 따로 켜고 끄는 스위치는 없습니다 — 레벨이 도는 책 봄 성장 기능을 따릅니다.
// 레벨은 늘 **그 캐릭터 주인**의 것입니다(선생님이 학생을 볼 때 · 친구를 볼 때 모두). 레벨이 내려가면(기록을 지워
// 경험치가 줄면) 옷도 돌아가고, 모르는 레벨은 기본 옷입니다. **선생님은 늘 Lv.10 옷**(선생님 결정 — 선생님은 레벨이 없음).
export const CHARACTER_OUTFITS = Object.freeze([
  { key: "base", level: 1, name: "기본 옷", suffix: "" },
  { key: "lv07", level: 7, name: "Lv.7 탐험가 옷", suffix: "-lv07" },
  { key: "lv10", level: 10, name: "Lv.10 마스터 옷", suffix: "-lv10" },
].map(Object.freeze));
export const TEACHER_OUTFIT_LEVEL = CHARACTER_OUTFITS[CHARACTER_OUTFITS.length - 1].level;

/** 독서 레벨 → 입는 옷(CHARACTER_OUTFITS의 한 칸). 숫자가 아니거나 7 아래면 기본 옷. */
export function characterOutfit(level) {
  const n = Number(level);
  for (let i = CHARACTER_OUTFITS.length - 1; i > 0; i -= 1) {
    if (n >= CHARACTER_OUTFITS[i].level) return CHARACTER_OUTFITS[i];
  }
  return CHARACTER_OUTFITS[0];
}

/** 그림에 쓸 레벨 — 선생님이면 늘 맨 위 옷(Lv.10), 학생이면 그 학생의 독서 레벨(모르면 null → 기본 옷). */
export function outfitLevelOf({ teacher = false, level = null } = {}) {
  return teacher ? TEACHER_OUTFIT_LEVEL : level;
}

/** 프로필에 서버가 적어 두는 독서 레벨(users/{uid}.readingLevel) — 1~10의 정수만 믿고, 아니면 null(모름 → 기본 옷).
 *  상단바 · 프로필 창처럼 책 봄 요약이 없는 화면이 그 학생의 옷을 고를 때 읽습니다(lib/server/readingService.js가 적음). */
export function profileReadingLevel(profile) {
  const level = profile?.readingLevel;
  return Number.isInteger(level) && level >= 1 && level <= 10 ? level : null;
}

/** 옷장(캐릭터 정보 창) — 옷마다 입을 수 있는지 · 지금 입은 옷인지 · 그 옷까지 남은 경험치. 선생님은 모두 입을 수 있음. */
export function outfitWardrobe(totalXp, { teacher = false } = {}) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = teacher ? TEACHER_OUTFIT_LEVEL : getReadingLevel(xp);
  const current = characterOutfit(level).key;
  return CHARACTER_OUTFITS.map((outfit) => {
    const unlocked = level >= outfit.level;
    return {
      ...outfit, unlocked, current: outfit.key === current,
      remaining: unlocked ? 0 : Math.max(0, getExpForReadingLevel(outfit.level) - xp),
    };
  });
}

// 관리자 설정의 '학생 캐릭터' 스위치 — 값이 없으면 켜짐(끈 반만 false).
// 끄면 학생이 고를 수 없고(서버 · 데모 모두 거절), 리더보드는 고른 값 대신
// 기본 캐릭터를 보여 줍니다. 고른 값은 프로필에 남아 다시 켜면 돌아옵니다.
export function characterChoiceEnabled(classDoc) {
  return classDoc?.characterEnabled !== false;
}

/** Return only the two public appearance properties, or null for invalid data.
 *  옛 열쇠(beginner · intermediate · advanced)는 새 열쇠로 옮겨 돌려줍니다. */
export function normalizeReadingCharacter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).length !== 2 || !own(value, "number") || !own(value, "style")) return null;
  if (!Number.isInteger(value.number) || value.number < 1 || value.number > 10) return null;
  const style = STYLES.has(value.style) ? value.style
    : typeof value.style === "string" && own(LEGACY_STYLES, value.style) ? LEGACY_STYLES[value.style] : null;
  if (!style) return null;
  return { number: value.number, style };
}

// A matching reward formula alone does not establish that an older projection
// includes the global XP and badges needed to place someone on the world map.
export function hasCurrentReadingSnapshot(snapshot) {
  if (!snapshot || snapshot.formula !== READING_FORMULA) return false;
  if (!SUMMARY_COUNTS.every((field) => own(snapshot, field) && nonnegative(snapshot[field]))) return false;
  if (snapshot.level !== getReadingLevel(snapshot.totalXp)) return false;
  if (!Array.isArray(snapshot.badges) || !snapshot.badges.every((id) => BADGE_IDS.has(id))) return false;
  if (!Array.isArray(snapshot.events)) return false;
  if (!own(snapshot, "lastReadDate") || !(snapshot.lastReadDate === null || /^\d{4}-\d{2}-\d{2}$/.test(snapshot.lastReadDate))) return false;
  return true;
}
