// The public journey appearance is separate from reading records and rewards.
// Keep both the authenticated API and demo strict about the same small shape.
import { getReadingLevel, READING_BADGES, READING_FORMULA } from "./reading.js";

const STYLES = new Set(["beginner", "intermediate", "advanced"]);
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

/** Return only the two public appearance properties, or null for invalid data. */
export function normalizeReadingCharacter(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.keys(value).length !== 2 || !own(value, "number") || !own(value, "style")) return null;
  if (!Number.isInteger(value.number) || value.number < 1 || value.number > 10 || !STYLES.has(value.style)) return null;
  return { number: value.number, style: value.style };
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
