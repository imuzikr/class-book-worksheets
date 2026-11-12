// Browser-only persistence for demo class metadata, including the teacher's
// opt-in setting. Production settings continue to live in Firestore.
import { isReadingMapTheme } from "./readingMapCatalog";

export const DEMO_CLASSES_KEY = "bookbom.demo.classes.v1";
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

function metadata(value) {
  if (!value || typeof value.id !== "string" || !IDENTIFIER.test(value.id) || typeof value.name !== "string" || !value.name.trim()
      || value.name.length > 200 || typeof value.createdBy !== "string" || !value.createdBy || value.createdBy.length > 128
      || (value.readingEnabled !== undefined && typeof value.readingEnabled !== "boolean")
      || (value.rankingEnabled !== undefined && typeof value.rankingEnabled !== "boolean")
      || (value.characterEnabled !== undefined && typeof value.characterEnabled !== "boolean")
      || (value.bookSearchEnabled !== undefined && typeof value.bookSearchEnabled !== "boolean")
      || (value.fruitBasketEnabled !== undefined && typeof value.fruitBasketEnabled !== "boolean")
      || (value.readingTopEnabled !== undefined && typeof value.readingTopEnabled !== "boolean")
      || (value.petEnabled !== undefined && typeof value.petEnabled !== "boolean")
      || (value.plazaEnabled !== undefined && typeof value.plazaEnabled !== "boolean")
      || (value.readingMapTheme !== undefined && !isReadingMapTheme(value.readingMapTheme))
      || (value.archived !== undefined && typeof value.archived !== "boolean")) return null;
  const result = { id: value.id, name: value.name, createdBy: value.createdBy,
    readingEnabled: value.readingEnabled === true, archived: value.archived === true };
  // 리더보드(rankingEnabled)는 값이 없으면 켜짐 — 끈 것만 남깁니다(관리자 설정).
  if (value.rankingEnabled === false) result.rankingEnabled = false;
  if (value.characterEnabled === false) result.characterEnabled = false;
  // 독서 TOP 3 · 학생 펫도 값이 없으면 켜짐 — 끈 것만 남깁니다(한때 펫은 빠져 있어 새로고침하면 다시 켜졌음).
  if (value.readingTopEnabled === false) result.readingTopEnabled = false;
  if (value.petEnabled === false) result.petEnabled = false;
  // 과일 바구니도 값이 없으면 켜짐 — 끈 것만 남깁니다.
  if (value.fruitBasketEnabled === false) result.fruitBasketEnabled = false;
  // 도서 검색은 값이 없으면 꺼짐 — 켠 것만 남깁니다.
  if (value.bookSearchEnabled === true) result.bookSearchEnabled = true;
  // 책 광장은 값이 없으면 꺼짐이지만, 체험반은 켜진 채로 시작합니다(lib/demoClassroom.js) — 그래서 끈 것도
  // 그대로 남깁니다. 켠 것만 남기면 체험반에서 꺼도 새로고침할 때 시작값(켜짐)이 되살아납니다.
  if (typeof value.plazaEnabled === "boolean") result.plazaEnabled = value.plazaEnabled;
  if (isReadingMapTheme(value.readingMapTheme)) result.readingMapTheme = value.readingMapTheme;
  if (typeof value.joinCode === "string" && value.joinCode.length <= 20) result.joinCode = value.joinCode;
  if (Number.isFinite(value.order)) result.order = value.order;
  if (value.dashboardSemesterStart != null || value.dashboardSemesterEnd != null) {
    const start = value.dashboardSemesterStart;
    const end = value.dashboardSemesterEnd;
    const day = (text) => typeof text === "string" && /^\d{4}-\d{2}-\d{2}$/.test(text)
      && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text;
    if (!day(start) || !day(end) || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 >= 366) return null;
    result.dashboardSemesterStart = start;
    result.dashboardSemesterEnd = end;
  }
  for (const key of ["createdAt", "codeExpiresAt"]) {
    if (value[key] == null) continue;
    const date = new Date(value[key]);
    if (!Number.isFinite(date.getTime())) return null;
    result[key] = date;
  }
  return result;
}

export function readDemoClasses(storage) {
  try {
    if (!storage) return null;
    const value = JSON.parse(storage.getItem(DEMO_CLASSES_KEY));
    if (value?.version !== 1 || !Array.isArray(value.classes) || value.classes.length > 100) return null;
    const classes = value.classes.map(metadata);
    if (classes.some((c) => !c) || new Set(classes.map((c) => c.id)).size !== classes.length) return null;
    return classes;
  } catch { return null; }
}

export function writeDemoClasses(classes, storage) {
  const safe = Array.isArray(classes) ? classes.map(metadata) : null;
  if (!safe || safe.length > 100 || safe.some((c) => !c) || new Set(safe.map((c) => c.id)).size !== safe.length) {
    throw new Error("저장할 반 정보를 확인해 주세요.");
  }
  try {
    if (!storage) throw new Error("Storage unavailable");
    storage.setItem(DEMO_CLASSES_KEY, JSON.stringify({ version: 1, classes: safe }));
  } catch {
    throw new Error("브라우저에 반 설정을 저장하지 못했어요. 사이트 저장소를 허용한 뒤 다시 시도해 주세요.");
  }
}
