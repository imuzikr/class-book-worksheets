// Browser-only persistence for demo class metadata, including the teacher's
// opt-in setting. Production settings continue to live in Firestore.
import { isReadingMapTheme } from "./readingMapCatalog";
import { CARE_PAUSES_MAX, isCareReadChars, isCareReadPages, normalizeCareRests } from "./petCare";
import { DEMO_CLASS_ID, DEMO_CLASS_NAME } from "./demoClassroom";

export const DEMO_CLASSES_KEY = "bookbom.demo.classes.v1";
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

function metadata(value) {
  if (!value || typeof value.id !== "string" || !IDENTIFIER.test(value.id) || typeof value.name !== "string" || !value.name.trim()
      || value.name.length > 200 || typeof value.createdBy !== "string" || !value.createdBy || value.createdBy.length > 128
      || (value.readingEnabled !== undefined && typeof value.readingEnabled !== "boolean")
      || (value.bookActivitiesEnabled !== undefined && typeof value.bookActivitiesEnabled !== "boolean")
      || (value.rankingEnabled !== undefined && typeof value.rankingEnabled !== "boolean")
      || (value.characterEnabled !== undefined && typeof value.characterEnabled !== "boolean")
      || (value.bookSearchEnabled !== undefined && typeof value.bookSearchEnabled !== "boolean")
      || (value.fruitBasketEnabled !== undefined && typeof value.fruitBasketEnabled !== "boolean")
      || (value.readingTopEnabled !== undefined && typeof value.readingTopEnabled !== "boolean")
      || (value.petEnabled !== undefined && typeof value.petEnabled !== "boolean")
      || (value.petPreviewEnabled !== undefined && typeof value.petPreviewEnabled !== "boolean")
      || (value.plazaEnabled !== undefined && typeof value.plazaEnabled !== "boolean")
      || (value.classroomEnabled !== undefined && typeof value.classroomEnabled !== "boolean")
      || (value.plazaTalkEnabled !== undefined && typeof value.plazaTalkEnabled !== "boolean")
      || (value.petFeedEnabled !== undefined && typeof value.petFeedEnabled !== "boolean")
      || (value.petFeedFrom !== undefined && !(Number.isFinite(value.petFeedFrom) && value.petFeedFrom >= 0))
      || (value.petRests !== undefined && !Array.isArray(value.petRests))
      || (value.hideoutEnabled !== undefined && typeof value.hideoutEnabled !== "boolean")
      || (value.readingMapTheme !== undefined && !isReadingMapTheme(value.readingMapTheme))
      || (value.archived !== undefined && typeof value.archived !== "boolean")) return null;
  const result = { id: value.id, name: value.name, createdBy: value.createdBy,
    readingEnabled: value.readingEnabled === true, archived: value.archived === true };
  // 책방(bookActivitiesEnabled)은 값이 없으면 켜짐 — 끈 것만 남깁니다(관리자 설정 · lib/reading.js의 bookActivitiesOn).
  if (value.bookActivitiesEnabled === false) result.bookActivitiesEnabled = false;
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
  // 교실도 체험반은 켜진 채로 시작합니다 — 같은 까닭으로 끈 것도 남깁니다.
  if (typeof value.classroomEnabled === "boolean") result.classroomEnabled = value.classroomEnabled;
  // 광장 대화도 체험반은 켜진 채로 시작합니다 — 같은 까닭으로 끈 것도 남깁니다.
  if (typeof value.plazaTalkEnabled === "boolean") result.plazaTalkEnabled = value.plazaTalkEnabled;
  // 펫 먹이도 체험반은 켜진 채로 시작합니다 — 끈 것도 남깁니다. 켠 때 · 배고파지지 않는 날(쉬는 기간)도 함께.
  // 한때 함께 남기던 '주말에는 줄지 않아요'(petRestWeekend)는 걷었습니다 — 주말에도 줄어듭니다(선생님 결정 · 옛 값은 버림).
  if (typeof value.petFeedEnabled === "boolean") result.petFeedEnabled = value.petFeedEnabled;
  if (Number.isFinite(value.petFeedFrom) && value.petFeedFrom > 0) result.petFeedFrom = value.petFeedFrom;
  // 펫 먹이를 끈 때 · 다시 켠 때 · 지난 쉰 기간(lib/readingPet.js의 petFeedTimesPatch — 체험반은 ms 수). 틀린 값은 버리기만 합니다.
  for (const key of ["petFeedOffAt", "petFeedOnAt"]) if (Number.isFinite(value[key]) && value[key] > 0) result[key] = value[key];
  if (Array.isArray(value.petFeedPauses)) {
    const pauses = value.petFeedPauses
      .filter((p) => p && Number.isFinite(p.off) && Number.isFinite(p.on) && p.off > 0 && p.on >= p.off)
      .slice(-CARE_PAUSES_MAX).map((p) => ({ off: p.off, on: p.on }));
    if (pauses.length) result.petFeedPauses = pauses;
  }
  const rests = normalizeCareRests(value.petRests);
  if (rests.length) result.petRests = rests;
  // 펫 먹이의 '읽은 날' 기준(선생님이 정한 쪽수 · 글자 수 — lib/petCare.js의 careReadRule). 틀린 값은 버리기만 합니다(처음 값으로 셈).
  if (isCareReadPages(value.petReadPages)) result.petReadPages = value.petReadPages;
  if (isCareReadChars(value.petReadChars)) result.petReadChars = value.petReadChars;
  if (typeof value.hideoutEnabled === "boolean") result.hideoutEnabled = value.hideoutEnabled;
  // 펫 미리보기도 체험반은 켜진 채로 시작합니다(lib/demoClassroom.js) — 끈 것도 남깁니다.
  if (typeof value.petPreviewEnabled === "boolean") result.petPreviewEnabled = value.petPreviewEnabled;
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
    // 앱 이름을 바꾸기 전의 기본 체험반 이름만 복원하며 바꿉니다. 사용자가 정한 반 이름과 저장 키는 보존합니다.
    return classes.map((c) => c.id === DEMO_CLASS_ID && c.name === "책봄 체험반 (15명)" ? { ...c, name: DEMO_CLASS_NAME } : c);
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
