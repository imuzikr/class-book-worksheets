// 책나눔의 계산과 입력 검증. 브라우저 데모와 서버가 같은 규칙을 사용합니다.
// 보상 총계는 입력으로 받지 않고 기록에서 재계산합니다. 수정·삭제도 같은 경로입니다.
import { DEFAULT_READING_MAP_THEME, readingMapThemeSettings } from "./readingMapCatalog";

const DAY_MS = 86400000;
const KST_OFFSET = 9 * 3600000;
const LIMITS = { books: 100, logs: 500, reviews: 100 };
const TIER_NAMES = ["초급", "중급", "고급"];
const TIER_REWARDS = [20, 50, 100];
// 연속 독서 보너스 — 하루 (연속일 × 15) EXP, 7일째부터는 105로 고정(상한).
// 그날 처음 읽은 쪽이 5쪽 이상이어야 연속일로 칩니다('1쪽만 적기'로 보너스를 받지 않게).
export const STREAK_XP = 15;
export const STREAK_DAY_CAP = 7;
export const STREAK_MIN_PAGES = 5;
// 과일은 경험치가 아닙니다(선생님 요청 — 앞으로 펫에게 주는 먹이로만 씀). 한때 1개에 10 EXP였고,
// 그 셈(지급 이력을 '어디까지 셌나'부터 이어 읽던 readingFruitFold 등)은 함께 걷었습니다.
// 계산 기준이 바뀌면 올립니다 — 반 집계(readingMembers.formula)가 다르면 랭킹을 읽을 때 다시 셉니다.
// 2 = 연속 보너스 상한 · 하루 5쪽 · 과일 경험치, 3 = 과일 경험치를 뺌, 4 = 레벨 상한 10.
export const READING_FORMULA = 4;
// 독서 레벨은 10이 끝입니다(선생님 결정 — 한 학기 수업에 맞춤, 펫 10단계와 짝). 한때 100까지였는데 6레벨부터
// 다음 레벨이 1.5배씩 멀어지는 표라 100레벨은 닿을 수 없었습니다(약 5,355경 EXP). 표는 그대로 두었습니다 —
// 평일마다 20쪽씩 읽으면 한 학기(20주) 끝에 10레벨, 주 3일이면 7레벨쯤(READING_GROWTH.md '레벨').
// 10레벨이 된 뒤에도 경험치는 계속 쌓여 순위 · 독서 TOP 3(레벨이 같으면 경험치 순)는 그대로 가려집니다.
export const READING_LEVEL_MAX = 10;
// 뱃지의 번호(id — shelf_1 …)는 저장된 기록(대표 뱃지 · 반 집계 · 순위 장)에 그대로 적히므로 바꾸지 않습니다.
// 이름은 여기 한 곳이라 고쳐도 옮길 자료가 없습니다.
// shelf — '독자의 길'(한때 '서재의 시작' · 선생님 결정): 읽기 시작한 책(읽은 쪽을 기록한 책)의 수.
const SERIES = [
  { id: "shelf", name: "독자의 길", noun: "권 독서 시작", thresholds: [1, 3, 5] },
  { id: "completion", name: "완독의 성취", noun: "권 완독", thresholds: [1, 3, 5] },
  { id: "streak", name: "꾸준한 독서", noun: "일 연속 독서", thresholds: [3, 7, 14] },
  { id: "review", name: "생각의 기록", noun: "권 감상문", thresholds: [1, 3, 5] },
  { id: "pages", name: "페이지 탐험", noun: "쪽 월간 독서", thresholds: [100, 300, 500] },
  { id: "level", name: "독서 성장", noun: "레벨", thresholds: [3, 5, 7] },
];

export const READING_BADGES = Object.freeze(SERIES.flatMap((series) => series.thresholds.map((threshold, index) => Object.freeze({
  id: `${series.id}_${index + 1}`,
  series: series.id,
  tier: index + 1,
  tierName: TIER_NAMES[index],
  name: series.name,
  label: `${series.name} · ${TIER_NAMES[index]}`,
  threshold,
  description: series.id === "level" ? `레벨 ${threshold} 달성` : `${threshold}${series.noun}`,
  expReward: TIER_REWARDS[index],
}))));

export function initialReadingState() {
  return { version: 1, books: [], logs: [], reviews: [], featuredBadge: null };
}

function dateValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("날짜를 확인해 주세요.");
  return date;
}
export function kstToday(now = new Date()) {
  return new Date(dateValue(now).getTime() + KST_OFFSET).toISOString().slice(0, 10);
}
function dayNumber(key) { return Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS); }
function dateOfDay(day) { return new Date(day * DAY_MS).toISOString().slice(0, 10); }
function validDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(dayNumber(value)) && dateOfDay(dayNumber(value)) === value;
}
export function readingPeriodKey(period, now = new Date()) {
  const day = kstToday(now);
  if (period === "daily") return day;
  if (period === "monthly") return day.slice(0, 7);
  if (period === "weekly") {
    const n = dayNumber(day);
    return dateOfDay(n - ((n + 3) % 7)); // 월요일 시작
  }
  return "all-time";
}
// 상단바 '독서 TOP 3'의 한 주 — 서울 시각 **월요일 오전 7시**에 바뀝니다(선생님 요청).
// 돌려주는 값은 그 주가 시작한 월요일의 날짜('YYYY-MM-DD')이고, 그 주의 TOP 3는
// 이 날짜 **전날(일요일)까지**의 기록으로 셉니다 — 처음 셈한 때가 월요일이든
// 수요일이든 같은 셋이 나오게(lib/readingJourney.js의 readingTopAsOf).
// 서울 시각에서 7시간을 빼면 월요일 07:00이 그날 자정이 되므로, 그 날짜의 주를 셉니다.
export const READING_TOP_HOUR = 7;
export function readingTopWeek(now = new Date()) {
  const day = new Date(dateValue(now).getTime() + KST_OFFSET - READING_TOP_HOUR * 3600000).toISOString().slice(0, 10);
  const n = dayNumber(day);
  return dateOfDay(n - ((n + 3) % 7));
}
// 다음에 TOP 3가 바뀌는 때(ms) — 다음 월요일 서울 시각 07:00.
export function nextReadingTopRefresh(now = new Date()) {
  return Date.parse(`${readingTopWeek(now)}T00:00:00Z`) + 7 * DAY_MS - KST_OFFSET + READING_TOP_HOUR * 3600000;
}
export function readingEnabled(classDoc) {
  return classDoc?.readingEnabled === true && classDoc?.archived !== true;
}
// 리더보드(보이는 화면 — 상단바 리더보드) — 책나눔이 켜진 반에서, 따로 끄지 않았으면 켜짐.
// 책나눔의 '우리 반 랭킹' 탭과 독서 TOP 3는 이 값을 안 봅니다(선생님 요청 — TOP 3는 제 스위치 readingTopOn).
// 칸 이름은 옛 그대로 rankingEnabled(한때 스위치 이름이 '랭킹 시스템'). 경험치 · 레벨 · 반 집계는 이 값과 상관없이
// 책나눔만 켜지면 늘 셉니다(선생님 요청 — 스위치는 화면만 켜고 끔).
// 값이 없는 옛 반은 켜진 것으로 봅니다(이 설정이 생기기 전과 같게). 관리자 설정 화면에서 바꿉니다.
export function rankingEnabled(classDoc) {
  return readingEnabled(classDoc) && classDoc?.rankingEnabled !== false;
}
// 독서 TOP 3(상단바 가운데 — 이번 주 우리 반 셋) — 책나눔이 켜진 반에서, 따로 끄지 않았으면 켜짐.
// 리더보드와 따로 켜고 끕니다(선생님 요청 — 한때 리더보드(옛 '랭킹 시스템') 스위치를 함께 따랐음).
// 상단바(TopNav) · 서버 getReadingTop · 데모 fetchReadingTop · 다시 세기(refreshReadingTops)가 이 한 곳을 씁니다.
export function readingTopOn(classDoc) {
  return readingEnabled(classDoc) && classDoc?.readingTopEnabled !== false;
}
// 도서 검색(카카오 책 검색) — 책나눔이 켜진 반에서, 교사가 켰을 때만(기본 꺼짐).
// 카카오 REST API 키가 있어야 쓰는 기능이라, 키 없이 직접 입력만 쓰는 선생님도 있습니다.
export function bookSearchEnabled(classDoc) {
  return readingEnabled(classDoc) && classDoc?.bookSearchEnabled === true;
}
// 책 광장(책나눔의 셋째 탭 — 반 친구들과 독서 발자국 · 한 권의 책을 나눔) — 책나눔이 켜진 반에서,
// 교사가 켰을 때만(기본 꺼짐). 켠 반은 '우리 반 랭킹' 탭 자리에 '책 광장'이 섭니다(선생님 요청).
// 셈 · 공유 사본은 lib/readingPlaza.js, 기준 문서는 READING_GROWTH.md의 '책 광장' 절.
export function plazaOn(classDoc) {
  return readingEnabled(classDoc) && classDoc?.plazaEnabled === true;
}
// 관리자 설정은 반마다가 아니라 선생님의 모든 반에 한 값입니다(선생님 요청).
// 반 문서마다 같은 값을 적어 두고(서버 API · 규칙 · 학생 화면이 반 문서를 읽으므로),
// 화면은 운영 중인 반들에서 그 값을 읽습니다 — 모두 켜져 있어야 켜짐, 다르면 mixed.
// 학생 펫(petEnabled) — 값이 없으면 켜짐(선생님 결정). 판정은 lib/readingPet.js의 petEnabled.
// 독서 TOP 3(readingTopEnabled) — 값이 없으면 켜짐. 판정은 readingTopOn.
// 책 광장(plazaEnabled) — 값이 없으면 꺼짐(켠 것만 true). 판정은 plazaOn.
export const TEACHER_FEATURES = ["readingEnabled", "bookSearchEnabled", "rankingEnabled", "readingTopEnabled", "characterEnabled", "fruitBasketEnabled", "petEnabled", "plazaEnabled"];
const FEATURE_DEFAULT = { readingEnabled: false, bookSearchEnabled: false, rankingEnabled: true, readingTopEnabled: true, characterEnabled: true, fruitBasketEnabled: true, petEnabled: true, plazaEnabled: false };
// 과일 바구니(과일 담기 · 이벤트 응모) — 값이 없으면 켜짐. 끄면 떠 있는 동그라미의 '과일 바구니'와
// `/books?open=fruit` 창이 감춰집니다(관리자 설정). 책나눔 성장 기능과 무관합니다.
export function fruitBasketOn(classDoc) {
  return classDoc?.fruitBasketEnabled !== false;
}
export function featureValue(classDoc, key) {
  const v = classDoc?.[key];
  return typeof v === "boolean" ? v : FEATURE_DEFAULT[key];
}
export function teacherFeatureSettings(classes = []) {
  const live = (classes || []).filter((c) => c && !c.archived);
  const out = {};
  for (const key of TEACHER_FEATURES) {
    const values = live.map((c) => featureValue(c, key));
    out[key] = { on: values.length > 0 && values.every(Boolean), mixed: new Set(values).size > 1 };
  }
  return out;
}
// 새 반이 따를 값 — 운영 중인 반이 하나라도 있으면 그 반들의 값(모두 켜져 있으면 켜짐).
export function featuresForNewClass(classes = []) {
  const live = (classes || []).filter((c) => c && !c.archived);
  if (!live.length) return null;
  const settings = teacherFeatureSettings(live);
  const map = readingMapThemeSettings(live);
  return {
    ...Object.fromEntries(TEACHER_FEATURES.map((k) => [k, settings[k].on])),
    readingMapTheme: map.mixed ? DEFAULT_READING_MAP_THEME : map.value,
  };
}
// 그 레벨에 닿는 누적 경험치 — 10레벨(READING_LEVEL_MAX) 위는 없어서 10레벨 값을 돌려줍니다.
// '다음 레벨까지'를 셀 때는 먼저 최고 레벨인지 보세요(같은 값끼리 나누면 0으로 나눔).
export function getExpForReadingLevel(level) {
  const n = Math.min(READING_LEVEL_MAX, Math.max(1, Math.floor(Number(level) || 1)));
  if (n <= 5) return [0, 0, 100, 250, 500, 1000][n];
  let threshold = 1000;
  for (let i = 6; i <= n; i += 1) threshold = Math.round(threshold * 1.5);
  return threshold;
}
export function getReadingLevel(exp) {
  const xp = Math.max(0, Number(exp) || 0);
  let level = 1;
  while (level < READING_LEVEL_MAX && xp >= getExpForReadingLevel(level + 1)) level += 1;
  return level;
}

function stateOf(state) {
  return {
    version: 1,
    books: Array.isArray(state?.books) ? state.books : [],
    logs: Array.isArray(state?.logs) ? state.logs : [],
    reviews: Array.isArray(state?.reviews) ? state.reviews : [],
    featuredBadge: typeof state?.featuredBadge === "string" ? state.featuredBadge : null,
  };
}
function text(value, label, max, optional = false) {
  if (typeof value !== "string") {
    if (optional && value == null) return "";
    throw new Error(`${label}을 확인해 주세요.`);
  }
  const cleaned = value.replace(/\r\n?/g, "\n").trim();
  if ((!optional && !cleaned) || cleaned.length > max) throw new Error(`${label}은 ${max}자 이내로 입력해 주세요.`);
  return cleaned;
}
function integer(value, label, min, max) {
  // API accepts numeric form fields, but not booleans, null or empty strings.
  if (!["number", "string"].includes(typeof value) || (typeof value === "string" && !value.trim())) throw new Error(`${label}을 확인해 주세요.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(`${label}은 ${min}~${max} 사이의 정수여야 해요.`);
  return number;
}
function checkLimit(array, name, limit) {
  if (array.length >= limit) throw new Error(`${name}은 최대 ${limit}개까지 저장할 수 있어요.`);
}
function identifier(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new Error("기록 식별자를 확인해 주세요.");
  return value;
}
function identity(book) {
  return `${book.title.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ")}\u0000${book.author.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ")}`;
}
function sameBook(a, b) {
  return (a.isbn && b.isbn && a.isbn === b.isbn) || identity(a) === identity(b);
}
const BOOK_LINK_DOMAINS = ["daum.net", "kakao.com", "naver.com"];
function bookMetadata(book, action) {
  const next = { ...book };
  for (const [key, label, max] of [["publisher", "출판사", 100], ["isbn", "ISBN", 30], ["coverImage", "표지 주소", 1000], ["bookLink", "도서 정보 주소", 1000]]) {
    if (action[key] === undefined) continue;
    let value = text(action[key], label, max, true);
    if (!value) { delete next[key]; continue; }
    if (key === "isbn") {
      value = value.replace(/[-\s]/g, "").toUpperCase();
      const valid13 = /^\d{13}$/.test(value) && [...value].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10 === 0;
      const valid10 = /^\d{9}[\dX]$/.test(value) && [...value].reduce((sum, digit, i) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - i), 0) % 11 === 0;
      if (!valid13 && !valid10) throw new Error("도서 ISBN을 확인해 주세요.");
    }
    if (key === "coverImage" || key === "bookLink") {
      let url;
      try { url = new URL(value); } catch { throw new Error(`${label}를 확인해 주세요.`); }
      if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error(`${label}는 HTTPS 주소를 사용해 주세요.`);
      // 책 링크는 검색 결과의 다음(카카오) 페이지 — 네이버 책 검색이 끝나기 전에 저장한 네이버 주소도 받습니다.
      if (key === "bookLink" && !BOOK_LINK_DOMAINS.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) throw new Error("도서 정보 주소를 확인해 주세요.");
      value = url.href;
    }
    next[key] = value;
  }
  return next;
}
function recordId(action, context) { return identifier(context.id ?? action.id); }
// 책 광장(lib/readingPlaza.js) — 광장을 켠 반에서 쓴(고친) 독서 발자국에는 도장(plaza)을 찍습니다.
// 반 친구에게 보이는 것은 이 도장이 있는 발자국뿐입니다 — 광장을 켜기 전에 써 둔 글이 저절로 공개되지 않게.
// 도장을 찍을지는 부르는 쪽(서버 · 데모)이 반 설정을 보고 context.plaza로 알려 줍니다.
function plazaStamp(context) {
  return context?.plaza === true ? { plaza: true } : {};
}
// 한 권의 책의 '책꽂이에 꽂기' 표시 — 꽂은 때(shelvedAt)는 처음 꽂은 때를 지킵니다(고쳐 써도 그대로).
function shelveMark(review, shelved, existing, now) {
  const next = { ...review };
  delete next.shelved;
  delete next.shelvedAt;
  if (shelved !== true) return next;
  return { ...next, shelved: true, shelvedAt: existing?.shelved === true && existing.shelvedAt ? existing.shelvedAt : now };
}
function checkClass(record, classId) {
  if (record.classId !== classId) throw new Error("이 기록을 작성한 반에서 수정해 주세요.");
}
function assertBook(state, bookId, allowArchived = false) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book || (!allowArchived && book.archived)) throw new Error("책을 찾을 수 없거나 보관된 책이에요.");
  return book;
}
function logFields(state, action, book, today, excludeId) {
  const date = action.date;
  if (!validDay(date) || date > today || date < "2000-01-01") throw new Error("미래 날짜가 아닌 올바른 독서 날짜를 입력해 주세요.");
  const startPage = integer(action.startPage, "시작 쪽", 1, book.totalPages);
  const endPage = integer(action.endPage, "마지막 쪽", startPage, book.totalPages);
  if (state.logs.some((log) => log.bookId === book.id && log.id !== excludeId && log.startPage <= endPage && log.endPage >= startPage)) {
    throw new Error("이미 기록한 쪽과 겹쳐요. 기존 기록을 수정하거나 새로운 범위를 입력해 주세요.");
  }
  return { date, startPage, endPage, notes: text(action.notes, "오늘의 감상", 2000) };
}

// 모든 쓰기는 이 검증기를 거칩니다. uid/반 소속·기능 활성화는 호출하는 저장소/API에서 검증합니다.
export function applyReadingAction(previous, action, context = {}) {
  if (!action || typeof action !== "object") throw new Error("요청 내용을 확인해 주세요.");
  const state = stateOf(previous);
  const classId = identifier(context.classId);
  const now = dateValue(context.now ?? new Date()).toISOString();
  const today = kstToday(now);
  let next = { ...state };
  switch (action.type) {
    case "addBook": {
      checkLimit(state.books, "도서", LIMITS.books);
      const id = recordId(action, context);
      if (state.books.some((book) => book.id === id)) return previous ?? state;
      const book = bookMetadata({
        id, title: text(action.title, "책 제목", 150), author: text(action.author, "저자", 100),
        totalPages: integer(action.totalPages, "전체 쪽수", 1, 100000), status: "reading", createdAt: now,
      }, action);
      if (state.books.some((other) => sameBook(other, book))) throw new Error("같은 책이 이미 있어요. 보관된 책도 확인해 주세요.");
      if (action.activityId != null && action.activityId !== "") book.activityId = identifier(action.activityId);
      next.books = [...state.books, book];
      break;
    }
    case "updateBook": {
      const book = assertBook(state, action.bookId);
      const updated = bookMetadata(book, action);
      if (action.title !== undefined) updated.title = text(action.title, "책 제목", 150);
      if (action.author !== undefined) updated.author = text(action.author, "저자", 100);
      if (action.activityId !== undefined) updated.activityId = action.activityId === null || action.activityId === "" ? null : identifier(action.activityId);
      if (action.totalPages !== undefined) updated.totalPages = integer(action.totalPages, "전체 쪽수", 1, 100000);
      if (updated.totalPages !== book.totalPages && (state.logs.some((log) => log.bookId === book.id) || state.reviews.some((review) => review.bookId === book.id))) {
        throw new Error("독서 기록이 있는 책의 전체 쪽수는 변경할 수 없어요. 기록을 먼저 정정해 주세요.");
      }
      if (state.logs.some((log) => log.bookId === book.id && log.endPage > updated.totalPages)) throw new Error("기록한 마지막 쪽보다 전체 쪽수를 줄일 수 없어요.");
      if (action.status !== undefined) {
        if (!["reading", "paused"].includes(action.status)) throw new Error("완독은 독서 기록을 기준으로 자동 반영해요.");
        updated.status = action.status;
      }
      if (state.books.some((other) => other.id !== book.id && sameBook(other, updated))) throw new Error("같은 책이 이미 있어요.");
      next.books = state.books.map((item) => item.id === book.id ? updated : item);
      break;
    }
    case "archiveBook": {
      const book = assertBook(state, action.bookId, true);
      if (action.archived !== undefined && typeof action.archived !== "boolean") throw new Error("보관 상태를 확인해 주세요.");
      next.books = state.books.map((item) => item.id === book.id ? { ...book, archived: action.archived !== false } : item);
      break;
    }
    case "addLog": {
      const id = recordId(action, context);
      if (state.logs.some((log) => log.id === id)) return previous ?? state;
      checkLimit(state.logs, "독서 기록", LIMITS.logs);
      const book = assertBook(state, action.bookId);
      const fields = logFields(state, action, book, today);
      next.logs = [...state.logs, { id, bookId: book.id, classId, ...fields, createdAt: now, ...plazaStamp(context) }];
      break;
    }
    case "updateLog": {
      const old = state.logs.find((log) => log.id === (action.logId ?? action.id));
      if (!old) throw new Error("독서 기록을 찾을 수 없어요.");
      checkClass(old, classId);
      const book = assertBook(state, old.bookId, true);
      if (action.bookId !== undefined && action.bookId !== old.bookId) throw new Error("기록의 책은 바꿀 수 없어요.");
      const fields = logFields(state, { ...old, ...action }, book, today, old.id);
      next.logs = state.logs.map((log) => log.id === old.id ? { ...old, ...fields, updatedAt: now, ...plazaStamp(context) } : log);
      break;
    }
    case "deleteLog": {
      const old = state.logs.find((log) => log.id === (action.logId ?? action.id));
      if (!old) return previous ?? state;
      checkClass(old, classId);
      next.logs = state.logs.filter((log) => log.id !== old.id);
      break;
    }
    case "saveReview": {
      const book = assertBook(state, action.bookId);
      const existing = state.reviews.find((review) => review.bookId === book.id);
      if (existing) checkClass(existing, classId);
      else checkLimit(state.reviews, "감상문", LIMITS.reviews);
      if (action.shelved !== undefined && typeof action.shelved !== "boolean") throw new Error("책꽂이에 꽂을지 확인해 주세요.");
      const review = shelveMark({
        id: existing?.id ?? recordId(action, context), bookId: book.id, classId,
        text: text(action.text ?? action.content, "감상문", 5000),
        rating: integer(action.rating ?? existing?.rating ?? 5, "별점", 1, 5),
        createdAt: existing?.createdAt ?? now, updatedAt: now,
      }, action.shelved ?? existing?.shelved === true, existing, now);
      next.reviews = [...state.reviews.filter((item) => item.bookId !== book.id), review];
      break;
    }
    // 책 광장 — 완독한 책의 '한 권의 책'을 책꽂이에 꽂거나 뺍니다(학생이 고름 — 꽂은 것만 반 친구에게 보임).
    case "shelveReview": {
      const review = state.reviews.find((item) => item.bookId === action.bookId);
      if (!review) throw new Error("한 권의 책을 먼저 써 주세요.");
      checkClass(review, classId);
      if (typeof action.shelved !== "boolean") throw new Error("책꽂이에 꽂을지 확인해 주세요.");
      next.reviews = state.reviews.map((item) => item.id === review.id ? shelveMark(review, action.shelved, review, now) : item);
      break;
    }
    // 책 광장 — 이 책의 독서 발자국을 광장(가판대)에 보일지. 기본은 보임이고 끈 책만 plazaHidden을 적습니다.
    case "setBookPlaza": {
      const book = assertBook(state, action.bookId, true);
      if (typeof action.hidden !== "boolean") throw new Error("광장에 보일지 확인해 주세요.");
      const updated = { ...book };
      if (action.hidden) updated.plazaHidden = true;
      else delete updated.plazaHidden;
      next.books = state.books.map((item) => item.id === book.id ? updated : item);
      break;
    }
    case "deleteReview": {
      const review = state.reviews.find((item) => action.reviewId ? item.id === action.reviewId : item.bookId === action.bookId);
      if (!review) return previous ?? state;
      checkClass(review, classId);
      next.reviews = state.reviews.filter((item) => item.id !== review.id);
      break;
    }
    case "setFeaturedBadge": {
      const id = action.badgeId ?? null;
      if (id !== null && !deriveReading(state, now).earnedBadges.some((badge) => badge.id === id)) throw new Error("획득한 뱃지에서 대표 뱃지를 골라 주세요.");
      next.featuredBadge = id;
      break;
    }
    default: throw new Error("지원하지 않는 책나눔 요청이에요.");
  }
  // 정정으로 자격을 잃은 뱃지가 대표로 남지 않습니다.
  if (next.featuredBadge && !deriveReading(next, now).earnedBadges.some((badge) => badge.id === next.featuredBadge)) next = { ...next, featuredBadge: null };
  return next;
}

function compareRecords(a, b) {
  return a.date.localeCompare(b.date) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || String(a.id).localeCompare(String(b.id));
}
function reviewDay(review) {
  try { return kstToday(review.createdAt); } catch { return ""; }
}
// Invalid historical ranges are ignored; overlapping historical ranges are counted only once.
function uniqueSegments(log, covered) {
  let pieces = [[log.startPage, log.endPage]];
  for (const [start, end] of covered) {
    pieces = pieces.flatMap(([a, b]) => b < start || a > end ? [[a, b]] : [a < start ? [a, start - 1] : null, b > end ? [end + 1, b] : null].filter(Boolean));
  }
  return pieces;
}

// 경험치는 독서 기록에서만 — 읽은 쪽 · 감상문 · 연속 독서 · 뱃지(과일은 경험치가 아님).
export function deriveReading(input, now = new Date()) {
  const state = stateOf(input);
  const today = kstToday(now);
  const books = state.books.filter((book) => book && typeof book.id === "string" && Number.isInteger(book.totalPages) && book.totalPages > 0);
  const bookById = new Map(books.map((book) => [book.id, book]));
  const logs = state.logs.filter((log) => {
    const book = bookById.get(log?.bookId);
    return book && validDay(log.date) && log.date <= today && Number.isInteger(log.startPage) && Number.isInteger(log.endPage) && log.startPage >= 1 && log.endPage >= log.startPage && log.endPage <= book.totalPages;
  }).slice().sort(compareRecords);
  const seenReviewBooks = new Set();
  const reviews = state.reviews.filter((review) => {
    if (!review || !bookById.has(review.bookId) || seenReviewBooks.has(review.bookId) || !String(review.text ?? "").trim()) return false;
    const date = reviewDay(review);
    if (!date || date > today) return false;
    seenReviewBooks.add(review.bookId);
    return true;
  });
  const timeline = [
    ...logs.map((log) => ({ ...log, kind: "log" })),
    ...reviews.map((review) => ({ ...review, date: reviewDay(review), kind: "review" })),
  ].sort(compareRecords);
  const events = [];
  const covered = new Map();
  const pagesByBook = new Map();
  const completed = new Set();
  const started = new Set();
  const reviewBooks = new Set();
  const days = new Set();
  const dayPages = new Map();
  const monthly = new Map();
  const earned = new Map();
  let xp = 0;
  let streak = 0;
  let longestStreak = 0;
  let previousDay = null;
  let lastReadDate = null;
  let bestMonthPages = 0;

  function addEvent(event) { events.push(event); xp += event.xp; }
  function metric(series) {
    return ({ shelf: started.size, completion: completed.size, streak: longestStreak, review: reviewBooks.size, pages: bestMonthPages, level: getReadingLevel(xp) })[series] ?? 0;
  }
  function awardBadges(record) {
    // Badge EXP can unlock another level badge. There are only 18 definitions;
    // evaluate to a fixed point and never award an already-earned ID twice.
    let changed = true;
    while (changed) {
      changed = false;
      for (const badge of READING_BADGES) {
        if (earned.has(badge.id) || metric(badge.series) < badge.threshold) continue;
        earned.set(badge.id, { date: record.date, earnedAt: record.createdAt ?? `${record.date}T00:00:00+09:00`, classId: record.classId });
        addEvent({ id: `badge:${badge.id}`, kind: "badge", badgeId: badge.id, date: record.date, classId: record.classId, xp: badge.expReward });
        changed = true;
      }
    }
  }

  for (const record of timeline) {
    if (record.kind === "review") {
      reviewBooks.add(record.bookId);
      addEvent({ id: `review:${record.bookId}`, kind: "review", bookId: record.bookId, classId: record.classId, date: record.date, xp: 70 });
    } else {
      const pieces = uniqueSegments(record, covered.get(record.bookId) ?? []);
      const pages = pieces.reduce((sum, [a, b]) => sum + b - a + 1, 0);
      covered.set(record.bookId, [...(covered.get(record.bookId) ?? []), ...pieces]);
      if (!pages) continue;
      pagesByBook.set(record.bookId, (pagesByBook.get(record.bookId) ?? 0) + pages);
      started.add(record.bookId);
      const month = record.date.slice(0, 7);
      monthly.set(month, (monthly.get(month) ?? 0) + pages);
      bestMonthPages = Math.max(bestMonthPages, monthly.get(month));
      if (pagesByBook.get(record.bookId) >= bookById.get(record.bookId).totalPages) completed.add(record.bookId);
      addEvent({ id: `pages:${record.id}`, kind: "pages", bookId: record.bookId, classId: record.classId, date: record.date, xp: pages });
      // 그날 새로 읽은 쪽이 STREAK_MIN_PAGES에 닿는 기록에서 연속일을 셉니다(여러 번에 나눠 읽어도 합쳐서).
      dayPages.set(record.date, (dayPages.get(record.date) ?? 0) + pages);
      if (!days.has(record.date) && dayPages.get(record.date) >= STREAK_MIN_PAGES) {
        const day = dayNumber(record.date);
        streak = previousDay !== null && day === previousDay + 1 ? streak + 1 : 1;
        previousDay = day;
        longestStreak = Math.max(longestStreak, streak);
        lastReadDate = record.date;
        days.add(record.date);
        addEvent({ id: `streak:${record.date}`, kind: "streak", classId: record.classId, date: record.date, xp: Math.min(streak, STREAK_DAY_CAP) * STREAK_XP });
      }
    }
    awardBadges(record);
  }
  const level = getReadingLevel(xp);
  // 최고 레벨이면 다음 레벨이 없습니다 — nextXp는 그 레벨 값 그대로, 남은 경험치 0, 진행 100.
  const maxLevel = level >= READING_LEVEL_MAX;
  const currentThreshold = getExpForReadingLevel(level);
  const nextXp = maxLevel ? currentThreshold : getExpForReadingLevel(level + 1);
  const badges = READING_BADGES.map((badge) => {
    const current = metric(badge.series);
    return { ...badge, earned: earned.has(badge.id), current, progress: Math.min(100, Math.round(current / badge.threshold * 100)), ...(earned.get(badge.id) ?? {}) };
  });
  const earnedBadges = badges.filter((badge) => badge.earned);
  const decoratedBooks = books.map((book) => {
    const pages = pagesByBook.get(book.id) ?? 0;
    const bookLogs = logs.filter((log) => log.bookId === book.id);
    return { ...book, currentPage: bookLogs.length ? Math.max(...bookLogs.map((log) => log.endPage)) : 0, pagesRead: pages, progress: Math.min(100, Math.round(pages / book.totalPages * 100)), status: completed.has(book.id) ? "completed" : book.status === "paused" ? "paused" : "reading", completedAt: completed.has(book.id) ? bookLogs.at(-1)?.date : null };
  });
  const classScores = Object.create(null);
  const weekStart = readingPeriodKey("weekly", now);
  for (const event of events) {
    if (!event.classId) continue;
    const score = classScores[event.classId] ?? { daily: 0, weekly: 0, monthly: 0, allTime: 0, totalExp: 0 };
    score.allTime += event.xp;
    score.totalExp += event.xp;
    if (event.date === today) score.daily += event.xp;
    if (event.date >= weekStart && event.date <= today) score.weekly += event.xp;
    if (event.date.startsWith(today.slice(0, 7))) score.monthly += event.xp;
    classScores[event.classId] = score;
  }
  return {
    xp, exp: xp, level, maxLevel, nextXp, expToNextLevel: maxLevel ? 0 : nextXp - xp,
    progress: maxLevel ? 100 : Math.min(100, Math.max(0, Math.round((xp - currentThreshold) / (nextXp - currentThreshold) * 100))),
    totalPages: [...pagesByBook.values()].reduce((sum, pages) => sum + pages, 0),
    totalBooks: completed.size, startedBooks: started.size,
    currentStreak: previousDay !== null && dayNumber(today) - previousDay <= 1 ? streak : 0,
    streakRun: streak, lastReadDate,
    longestStreak, monthPages: monthly.get(today.slice(0, 7)) ?? 0, bestMonthPages,
    reviewCount: reviewBooks.size, books: decoratedBooks, logs, reviews,
    badges, earnedBadges, featuredBadge: earnedBadges.find((badge) => badge.id === state.featuredBadge) ?? null,
    events, classScores,
  };
}
