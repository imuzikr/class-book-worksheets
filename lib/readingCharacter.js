// The public journey appearance is separate from reading records and rewards.
// Keep both the authenticated API and demo strict about the same small shape.
import { getReadingLevel, READING_BADGES, READING_FORMULA } from "./reading.js";

// 캐릭터 묶음(스타일)의 열쇠는 '묶음 이름'입니다 — 등급 이름(수련생 · 무도가 · 영웅)은 화면 글자일 뿐이라
// 바뀌어도 저장값이 따라 바뀌지 않게(목록 · 이름 · 그림은 lib/readingCharacterCatalog.js).
export const CHARACTER_STYLES = Object.freeze(["zodiac", "animal", "fantasy"]);
const STYLES = new Set(CHARACTER_STYLES);
// 2026년 11월 묶음을 바꾸기 전에 저장된 값 — 읽을 때 · 저장할 때 새 열쇠로 옮깁니다(이미 고른 모습이 그대로 남게).
//  beginner = 판타지(그 그림 그대로, 지금은 영웅) · intermediate = 동물(그대로, 무도가)
//  advanced = 전통 무술복 동물(묶음을 내림) → 같은 번호의 동물(곰은 곰, 토끼는 토끼)
const LEGACY_STYLES = Object.freeze({ beginner: "fantasy", intermediate: "animal", advanced: "animal" });
const BADGE_IDS = new Set(READING_BADGES.map((badge) => badge.id));
const SUMMARY_COUNTS = ["totalXp", "totalPages", "completedBooks", "reviewCount", "longestStreak", "streakRun"];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const nonnegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

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
