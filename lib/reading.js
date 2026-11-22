// 책 봄의 계산과 입력 검증. 브라우저 데모와 서버가 같은 규칙을 사용합니다.
// 보상 총계는 입력으로 받지 않고 기록에서 재계산합니다. 수정·삭제도 같은 경로입니다.
import { DEFAULT_READING_MAP_THEME, readingMapThemeSettings } from "./readingMapCatalog";
import { dateKeyOf } from "./dates";

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
// 날짜 열쇠('YYYY-MM-DD') ↔ 날 번호 — 펫 먹이(lib/petCare.js)가 날짜를 하루씩 넘길 때 같은 셈을 씁니다
// (날 번호 + 4를 7로 나눈 나머지가 요일 — 0 일요일 … 6 토요일).
export function readingDayNumber(key) { return dayNumber(key); }
export function readingDayKey(day) { return dateOfDay(day); }
export function isReadingDay(value) { return validDay(value); }
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
// 상단바 '독서 TOP 3'의 하루 — 서울 시각 **날마다 오전 7시**에 바뀝니다(선생님 요청 · 2026년 11월 —
// 한때 월요일 오전 7시에 한 주에 한 번만 바뀌어, 그 주에 처음 읽기 시작한 반은 다음 월요일까지 비어 보였습니다).
// 돌려주는 값은 그 하루가 시작한 날짜('YYYY-MM-DD')이고, 그날의 TOP 3는
// 이 날짜 **전날(어제)까지**의 기록으로 셉니다 — 처음 셈한 때가 아침이든
// 오후든 같은 셋이 나오게(lib/readingJourney.js의 readingTopAsOf).
// 서울 시각에서 7시간을 빼면 07:00이 그날 자정이 되므로, 그 날짜가 곧 그 하루입니다.
export const READING_TOP_HOUR = 7;
export function readingTopDay(now = new Date()) {
  return new Date(dateValue(now).getTime() + KST_OFFSET - READING_TOP_HOUR * 3600000).toISOString().slice(0, 10);
}
// 다음에 TOP 3가 바뀌는 때(ms) — 다음 서울 시각 07:00.
export function nextReadingTopRefresh(now = new Date()) {
  return Date.parse(`${readingTopDay(now)}T00:00:00Z`) + DAY_MS - KST_OFFSET + READING_TOP_HOUR * 3600000;
}
export function readingEnabled(classDoc) {
  return classDoc?.readingEnabled === true && classDoc?.archived !== true;
}
// 책방(열한 가지 독서 활동 — 상단바 '책방' · 활동 목록 · 활동 화면) — **값이 없으면 켜짐**(선생님 요청 — 이미 쓰던 반은 그대로).
// 끈 반에서는 **학생 화면에서만** 가립니다: 상단바의 '책방' 단추 · 활동 목록 · 활동(주소 ?activity= 로 와도)이 사라지고,
// 책 봄이 켜져 있으면 그 자리에 책 봄이 섭니다(app/books/page.js). 선생님 화면은 그대로이고 목록 위에 '학생에게는 보이지
// 않아요' 띠가 섭니다 — 끈 동안에도 활동을 미리 만들고 지난 글을 봅니다. 글 · 기록은 지우지 않습니다(다시 켜면 그대로 이어짐).
// 가리는 것은 화면이고 규칙은 스위치의 모양(참 · 거짓)만 봅니다(과일 바구니와 같음). 책 봄 성장 기능과 무관합니다.
export function bookActivitiesOn(classDoc) {
  return classDoc?.bookActivitiesEnabled !== false;
}
// 리더보드(보이는 화면 — 상단바 리더보드) — 책 봄이 켜진 반에서, 따로 끄지 않았으면 켜짐.
// 책 봄의 '우리 반 랭킹' 탭과 독서 TOP 3는 이 값을 안 봅니다(선생님 요청 — TOP 3는 제 스위치 readingTopOn).
// 칸 이름은 옛 그대로 rankingEnabled(한때 스위치 이름이 '랭킹 시스템'). 경험치 · 레벨 · 반 집계는 이 값과 상관없이
// 책 봄만 켜지면 늘 셉니다(선생님 요청 — 스위치는 화면만 켜고 끔).
// 값이 없는 옛 반은 켜진 것으로 봅니다(이 설정이 생기기 전과 같게). 관리자 설정 화면에서 바꿉니다.
export function rankingEnabled(classDoc) {
  return readingEnabled(classDoc) && classDoc?.rankingEnabled !== false;
}
// 독서 TOP 3(상단바 가운데 — 오늘의 우리 반 셋) — 책 봄이 켜진 반에서, 따로 끄지 않았으면 켜짐.
// 리더보드와 따로 켜고 끕니다(선생님 요청 — 한때 리더보드(옛 '랭킹 시스템') 스위치를 함께 따랐음).
// 상단바(TopNav) · 서버 getReadingTop · 데모 fetchReadingTop · 다시 세기(refreshReadingTops)가 이 한 곳을 씁니다.
export function readingTopOn(classDoc) {
  return readingEnabled(classDoc) && classDoc?.readingTopEnabled !== false;
}
// 도서 검색(카카오 책 검색) — 책 봄이 켜진 반에서, 교사가 켰을 때만(기본 꺼짐).
// 카카오 REST API 키가 있어야 쓰는 기능이라, 키 없이 직접 입력만 쓰는 선생님도 있습니다.
export function bookSearchEnabled(classDoc) {
  return readingEnabled(classDoc) && classDoc?.bookSearchEnabled === true;
}
// 책 광장(책 봄의 셋째 탭 — 반 친구들과 독서 발자국 · 한 권의 책을 나눔) — 책 봄이 켜진 반에서,
// 교사가 켰을 때만(기본 꺼짐). 켠 반은 '우리 반 랭킹' 탭 자리에 '책 광장'이 섭니다(선생님 요청).
// 셈 · 공유 사본은 lib/readingPlaza.js, 기준 문서는 READING_GROWTH.md의 '책 광장' 절.
export function plazaOn(classDoc) {
  return readingEnabled(classDoc) && classDoc?.plazaEnabled === true;
}
// 책 광장의 공유 사본을 만드는 기준의 번호 — 무엇이 반 친구에게 보이나 · 사본의 모양을 바꾸면 올립니다
// (lib/readingPlaza.js 머리말). 1 = 학생이 고른 글만 · 2 = 광장을 켠 반에서는 모두 공개 ·
// 3 = 가판대는 발자국, 책꽂이는 완독 감상(완독 뒤에도 발자국 유지 · 목록의 종류별 글 한 줄·시각 추가) ·
// **4 = 선생님이 '광장에서 내리기'로 내린 책도 다시 보임**(그 기능을 걷음 — 사본에 남은 blocked 칸도 지움).
// 저장해 둔 사본의 번호가 다르면 서버가 그 학생의 사본을 통째로 다시 쓰고, 반 문서의 plazaSynced가 다르면
// 그 반의 사본을 한 번 통째로 맞춥니다(lib/server/readingService.js의 writePlaza · plazaSyncClass).
export const PLAZA_SHARE_RULE = 4;
// 광장을 켠 반인데 그 반의 공유 사본이 아직 지금 기준으로 맞춰지지 않았는가 — 켜기 전에 쓴 글 · 기준이 바뀌기 전의 글이
// 아직 사본에 없을 수 있습니다. 책방 화면이 이것을 보고 서버에 한 번 맞춰 달라고 부탁합니다(app/books/page.js).
export function plazaNeedsSync(classDoc) {
  return plazaOn(classDoc) && classDoc?.plazaSynced !== PLAZA_SHARE_RULE;
}
// 교실(책 광장의 둘째 방 — 포털로 오가고, 제 책상에 앉아 있으면 선생님이 칠판에서 출석을 확인함 · 선생님 요청) —
// 책 광장이 켜진 반에서, 교사가 켰을 때만(기본 꺼짐). 끈 반의 광장에는 교실로 가는 문 · 포털이 없습니다.
// 셈은 lib/readingClassroom.js, 기준 문서는 READING_GROWTH.md의 '교실' 절.
export function classroomOn(classDoc) {
  return plazaOn(classDoc) && classDoc?.classroomEnabled === true;
}
// 광장 대화(친구 캐릭터를 눌러 대화 초대 → 승인하면 마주 서서 오른쪽 대화창으로 이야기 · 선생님 요청) — 책 광장이 켜진 반에서,
// 교사가 켰을 때만(기본 꺼짐). 교실을 켠 반은 교실에서도 됩니다. 셈은 lib/readingPlazaTalk.js, 기준 문서는 READING_GROWTH.md의
// '광장 대화' 절. 서버(대화에 사람을 넣는 승인)도 이 판정을 봅니다.
export function plazaTalkOn(classDoc) {
  return plazaOn(classDoc) && classDoc?.plazaTalkEnabled === true;
}
// 개인 아지트는 교실의 포털로 들어갑니다. 기존 반에는 기본 꺼짐이며,
// 교실·책 광장·책 봄 중 하나라도 꺼지면 입장과 서버 조회·저장을 함께 막습니다.
export function hideoutOn(classDoc) {
  return classroomOn(classDoc) && classDoc?.hideoutEnabled === true;
}
// 오늘 선생님이 교실의 칠판에서 출석을 확인한 반인가 — 그런 날에는 **제자리에 앉아 있어야만 출석**이라(선생님 결정),
// 책방 머리말의 '출석하기' 단추를 걷습니다(app/books/page.js — 교실을 나간 학생에게는 출석이 보이지 않게).
// 칠판의 '출석시작'이 반 문서에 적는 '확인한 때'(classroomCallAt — 선생님 기기의 시각 ms)를 출석 날짜와 같은 셈
// (기기 시간대의 날짜 열쇠 — lib/dates.js)으로 오늘(todayKey)과 견줍니다. '출석 관리' 창의 '출석 시작'은 그 값을
// 적지 않으므로 그 창으로만 출석을 받은 날은 지금까지처럼 단추로 출석하고, 교실을 끈 반은 늘 아닙니다(앉을 자리가 없음).
// 교실의 다른 셈(lib/readingClassroom.js)과 따로 둔 까닭 — 책방 첫 화면이 쓰는 판정인데, 그 파일은 광장 지도를 끌어옵니다.
export function classroomRollToday(classDoc, todayKey) {
  const at = Number(classDoc?.classroomCallAt) || 0;
  if (!(at > 0) || !todayKey || !classroomOn(classDoc)) return false;
  return dateKeyOf(new Date(at)) === todayKey;
}
// 관리자 설정은 반마다가 아니라 선생님의 모든 반에 한 값입니다(선생님 요청).
// 반 문서마다 같은 값을 적어 두고(서버 API · 규칙 · 학생 화면이 반 문서를 읽으므로),
// 화면은 운영 중인 반들에서 그 값을 읽습니다 — 모두 켜져 있어야 켜짐, 다르면 mixed.
// **둘만 예외 — 책방 · 펫 미리보기는 반마다 따로입니다**(PER_CLASS_FEATURES · 아래).
// 책방(bookActivitiesEnabled) — 값이 없으면 켜짐(끈 것만 false). 판정은 bookActivitiesOn. 반마다 따로 켜고 끕니다.
// 학생 펫(petEnabled) — 값이 없으면 켜짐(선생님 결정). 판정은 lib/readingPet.js의 petEnabled.
// 독서 TOP 3(readingTopEnabled) — 값이 없으면 켜짐. 판정은 readingTopOn.
// 책 광장(plazaEnabled) — 값이 없으면 꺼짐(켠 것만 true). 판정은 plazaOn.
// 교실(classroomEnabled) — 값이 없으면 꺼짐(켠 것만 true). 책 광장이 켜져 있어야 씁니다. 판정은 classroomOn.
// 광장 대화(plazaTalkEnabled) — 값이 없으면 꺼짐(켠 것만 true). 책 광장이 켜져 있어야 씁니다. 판정은 plazaTalkOn.
// 펫 먹이(petFeedEnabled) — 값이 없으면 꺼짐(켠 것만 true). 학생 펫이 켜져 있어야 씁니다. 판정은 lib/readingPet.js의 petFeedOn.
//   켤 때 '켠 때'(petFeedFrom)를 함께 적고, 줄지 않는 기간(petRests — 주말은 쉬지 않음)은 아래 teacherPetRestSettings,
//   '읽은 날'의 기준(petReadPages · petReadChars — 선생님이 정하는 쪽수 · 글자 수)은 lib/petCare.js의 teacherPetReadSettings.
// 펫 미리보기(petPreviewEnabled) — 값이 없으면 꺼짐(켠 것만 true). 학생 펫이 켜져 있어야 씁니다. 판정은 lib/readingPet.js의 petPreviewOn.
//   반마다 따로 켜고 끕니다(선생님 요청 · 2026년 11월 — 배부름(펫 먹이) 설정은 그대로 모든 반에 한 값).
export const TEACHER_FEATURES = ["bookActivitiesEnabled", "readingEnabled", "bookSearchEnabled", "rankingEnabled", "readingTopEnabled", "characterEnabled", "fruitBasketEnabled", "petEnabled", "petPreviewEnabled", "petFeedEnabled", "plazaEnabled", "plazaTalkEnabled", "classroomEnabled", "hideoutEnabled"];
const FEATURE_DEFAULT = { bookActivitiesEnabled: true, readingEnabled: false, bookSearchEnabled: false, rankingEnabled: true, readingTopEnabled: true, characterEnabled: true, fruitBasketEnabled: true, petEnabled: true, petPreviewEnabled: false, petFeedEnabled: false, plazaEnabled: false, plazaTalkEnabled: false, classroomEnabled: false, hideoutEnabled: false };
// 반마다 따로 켜고 끄는 스위치 — 책방과 펫 미리보기 둘입니다(선생님 요청 · 2026년 11월 — 책방 "이 옵션만 반별로 나눠서 · 기본값은
// 모든 반이 활성", 펫 미리보기 "펫 미리보기 하나만 반별 설정을" · 펫 먹이(배부름)의 스위치 · 독서량 · 쉬는 날은 모든 반에 한 값 그대로).
// 관리자 설정의 그 카드는 운영 중인 반마다 한 칸씩 스위치를 세우고 그 반 문서 한 장에만 씁니다(lib/data/classes.js의
// setPerClassFeature). 새 반은 다른 반의 값을 따르지 않고 기본값으로 시작합니다(featuresForNewClass가 이 칸을 넘기지 않음 —
// 책방은 켜짐 · 펫 미리보기는 꺼짐). 화면 · 서버 · 규칙은 처음부터 반 문서의 값을 읽어(petPreviewOn(그 반)) 고칠 것이 없었습니다.
// 나머지 스위치는 그대로 선생님의 모든 반에 한 값입니다(되살리지 마세요 — 한때 모든 스위치가 반마다였음).
export const PER_CLASS_FEATURES = Object.freeze(["bookActivitiesEnabled", "petPreviewEnabled"]);
export function isPerClassFeature(key) {
  return PER_CLASS_FEATURES.includes(key);
}
// 과일 바구니(과일 담기 · 이벤트 응모) — 값이 없으면 켜짐. 끄면 떠 있는 동그라미의 '과일 바구니'와
// `/books?open=fruit` 창이 감춰집니다(관리자 설정). 책 봄 성장 기능과 무관합니다.
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
// 반마다 따로인 스위치(책방 · 펫 미리보기 — PER_CLASS_FEATURES)는 넘기지 않습니다 — 새 반은 그 칸이 비어 기본값으로 시작합니다
// (책방 켜짐 · 펫 미리보기 꺼짐).
export function featuresForNewClass(classes = []) {
  const live = (classes || []).filter((c) => c && !c.archived);
  if (!live.length) return null;
  const settings = teacherFeatureSettings(live);
  const map = readingMapThemeSettings(live);
  const rest = teacherPetRestSettings(live);
  return {
    ...Object.fromEntries(TEACHER_FEATURES.filter((k) => !isPerClassFeature(k)).map((k) => [k, settings[k].on])),
    readingMapTheme: map.mixed ? DEFAULT_READING_MAP_THEME : map.value,
    // 펫 먹이의 '배고파지지 않는 날'도 선생님의 모든 반에 한 값 — 새 반도 따릅니다
    petRests: rest.rests,
    // 펫 먹이의 '읽은 날' 기준(쪽수 · 글자 수)도 — 운영 중인 첫 반의 값(정한 적이 없으면 넘기지 않아 처음 값 · 범위는 lib/data/classes.js가 봄)
    ...(Number.isInteger(live[0]?.petReadPages) ? { petReadPages: live[0].petReadPages } : {}),
    ...(Number.isInteger(live[0]?.petReadChars) ? { petReadChars: live[0].petReadChars } : {}),
  };
}
// 펫 먹이의 '배고파지지 않는 날' — 선생님이 넣은 쉬는 기간들(방학 · 시험 기간 · 기타)뿐. **주말에도 줄어듭니다**(선생님 결정 —
// 한때 있던 '주말에는 줄지 않아요' 칸(petRestWeekend)은 걷었고, 반 문서에 남은 그 값은 읽지 않습니다 · lib/petCare.js 머리말).
// 선생님의 모든 반에 한 값이라 운영 중인 첫 반의 값을 읽습니다(반마다 다르면 mixed — 저장하면 모두 같게 맞춤).
// 기간의 모양을 고르는 것은 lib/petCare.js의 normalizeCareRests(화면이 그 값을 넘겨 받음 — 이 파일은 그 파일을 끌어오지 않음).
export function teacherPetRestSettings(classes = []) {
  const live = (classes || []).filter((c) => c && !c.archived);
  const of = (c) => ({ rests: Array.isArray(c?.petRests) ? c.petRests : [] });
  const first = of(live[0]);
  const key = JSON.stringify(first);
  return { ...first, mixed: live.some((c) => JSON.stringify(of(c)) !== key) };
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
/**
 * 누적 경험치 → 레벨 · 다음 레벨 경험치 · 남은 경험치 · 진행(%) — 책 봄 요약(deriveReading)이 쓰는 그 셈 한 곳입니다.
 * 최고 레벨이면 다음 레벨이 없습니다 — nextXp는 그 레벨 값 그대로, 남은 경험치 0, 진행 100.
 * 책 봄 요약이 없는 화면(아지트 머리의 캐릭터 카드 — 아지트 응답의 누적 경험치 petGrowthXp)도 이것으로 셉니다.
 */
export function readingLevelProgress(exp) {
  const xp = Number.isFinite(Number(exp)) ? Number(exp) : 0;
  const level = getReadingLevel(xp);
  const maxLevel = level >= READING_LEVEL_MAX;
  const currentThreshold = getExpForReadingLevel(level);
  const nextXp = maxLevel ? currentThreshold : getExpForReadingLevel(level + 1);
  return {
    xp, exp: xp, level, maxLevel, nextXp, expToNextLevel: maxLevel ? 0 : nextXp - xp,
    progress: maxLevel ? 100 : Math.min(100, Math.max(0, Math.round((xp - currentThreshold) / (nextXp - currentThreshold) * 100))),
  };
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
// 새 책 등록 · 고치기 창 — 지금 제목이 표지 · ISBN과 함께 온 제목(검색에서 고른 책 · 저장된 책)과 다른 책 제목이 되었나.
// 띄어쓰기 · 문장 부호 · 대소문자만 다른 것은 같은 제목으로 봅니다. 다르면 창이 '다른 책이면 검색 정보 해제' 안내를 띄웁니다
// (components/reading/ReadingHub.jsx의 BookForm — 검색 정보를 저절로 지우지 않음). ISBN이 '같은 책' 판정(sameBook)에 쓰여,
// 다른 책의 ISBN이 남으면 그 책을 나중에 책꽂이에 담을 수 없기 때문입니다. original이 비어 있으면(검색 정보 없음) 늘 거짓.
export function bookTitleDrifted(title, original) {
  const key = (value) => String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  return key(original) !== "" && key(title) !== key(original);
}
const BOOK_LINK_DOMAINS = ["daum.net", "kakao.com", "naver.com"];
const onBookLinkHost = (host) => BOOK_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
// '도서 정보 보기'(책 카드 아래 첫 칸 · 책 상세 창) — 도서 검색으로 담은 책은 그 책의 정보 쪽(bookLink — 저장할 때와 같은
// 검사: HTTPS · 다음 · 카카오 · 네이버), 직접 적어 담은 책은 주소가 없어 다음 검색에서 '제목 지은이'로 찾아 줍니다
// (선생님 요청 · 2026년 11월 — 카드의 '기록 살펴보기'를 '도서 정보 보기'로 바꾸며, 주소가 없는 책에서도 단추가 일하게).
// 제목이 없으면 null(단추를 그리지 않음). 화면은 새 창으로 엽니다(rel="noopener noreferrer").
export const BOOK_INFO_SEARCH = "https://search.daum.net/search?w=tot&q=";
export function bookInfoUrl(book) {
  const link = typeof book?.bookLink === "string" ? book.bookLink.trim() : "";
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol === "https:" && !url.username && !url.password && !url.port && onBookLinkHost(url.hostname)) return url.href;
    } catch { /* 아래 검색으로 */ }
  }
  const title = typeof book?.title === "string" ? book.title.trim() : "";
  if (!title) return null;
  const author = typeof book?.author === "string" ? book.author.trim() : "";
  return BOOK_INFO_SEARCH + encodeURIComponent(author ? `${title} ${author}` : title);
}
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
      if (key === "bookLink" && !onBookLinkHost(url.hostname)) throw new Error("도서 정보 주소를 확인해 주세요.");
      value = url.href;
    }
    next[key] = value;
  }
  return next;
}
function recordId(action, context) { return identifier(context.id ?? action.id); }
// 책 광장(lib/readingPlaza.js) — **학생이 고르는 공개 설정은 없습니다**(선생님 결정 — 광장을 켠 반에서는 그 반에서 쓴
// 발자국 · 한 권의 책이 모두 반 친구에게 보임). 한때 발자국에 도장(log.plaza)을 찍고, 책마다 '발자국 보이기'
// (book.plazaHidden)와 한 권의 책의 '광장 책꽂이에 꽂기'(review.shelved · shelvedAt)를 학생이 골랐습니다 — 걷었습니다.
// 서재에 남아 있는 그 칸들은 아무도 읽지 않습니다(되살리지 마세요).
// 옛 화면(새로고침하지 않은 탭)이 보내는 '빼기 · 숨기기' 요청에는 까닭을 알려 줍니다.
const PLAZA_NO_CHOICE = "이제 책 광장에서는 내가 쓴 독서 발자국과 한 권의 책을 반 친구들이 모두 함께 읽어요. 화면을 새로고침해 주세요.";
const REVIEW_NO_DELETE = "‘한 권의 책’은 지울 수 없어요. ‘고쳐쓰기’로 다듬어 주세요(화면을 새로고침하면 ‘고쳐쓰기’ 단추가 보여요).";
function checkClass(record, classId) {
  if (record.classId !== classId) throw new Error("이 기록을 작성한 반에서 수정해 주세요.");
}
function assertBook(state, bookId, allowArchived = false) {
  const book = state.books.find((item) => item.id === bookId);
  if (!book || (!allowArchived && book.archived)) throw new Error("책을 찾을 수 없거나 보관된 책이에요.");
  return book;
}
// 이 책의 독서 발자국이 닿은 가장 큰 쪽(없으면 0) — 전체 쪽수를 이보다 적게는 못 바꿉니다(updateBook).
// 선생님의 '책 정보 고치기' 창이 쪽수 칸의 바닥으로도 씁니다(components/reading/ReadingHub.jsx의 BookForm).
export function bookPagesFloor(input, bookId) {
  const logs = Array.isArray(input?.logs) ? input.logs : [];
  return logs.reduce((max, log) => (log?.bookId === bookId && Number.isInteger(log.endPage) ? Math.max(max, log.endPage) : max), 0);
}
// 선생님이 고칠 수 있는 책 정보 — 제목 · 지은이 · 전체 쪽수 · 출판사 · ISBN · 표지 · 도서 정보 주소(선생님 요청 · 2026년 11월).
// 읽기 상태(읽는 중 · 잠시 멈춤) · 활동 연결 · 보관은 학생의 것이라 넣지 않습니다. 서버(mutateReading의 선생님 갈래)와
// 체험반이 같은 셈으로 칸을 거릅니다 — 그 밖의 칸은 버리고, 다른 요청은 거절합니다.
export const TEACHER_BOOK_FIELDS = Object.freeze(["title", "author", "totalPages", "publisher", "isbn", "coverImage", "bookLink"]);
export function teacherBookAction(action) {
  if (!action || typeof action !== "object" || action.type !== "updateBook") throw new Error("선생님은 학생의 책 정보만 고칠 수 있어요.");
  const picked = { type: "updateBook", bookId: action.bookId };
  for (const key of TEACHER_BOOK_FIELDS) if (action[key] !== undefined) picked[key] = action[key];
  return picked;
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

// ── 한 번에 완독한 발자국과 '한 권의 책'(선생님 요청 · 2026년 11월) ──────────────────────────────
// 발자국 하나가 1쪽부터 마지막 쪽까지면 '한 번에 완독'입니다. 겹치는 쪽은 받지 않으므로(logFields) 그런 발자국은 그 책의
// 하나뿐인 기록이고, 완독은 읽은 쪽으로 저절로 셉니다(deriveReading — 따로 적는 칸이 없음). 그때 그 발자국의 감상을
// **'한 권의 책'에도 같은 글로** 남깁니다 — 끝까지 읽은 날 같은 글을 두 번 쓰지 않게.
//   · 함께 남긴 '한 권의 책'은 fromLogId(그 발자국의 id)로 잇습니다. 이어져 있는 동안은 발자국을 따라갑니다 — 감상을 고치면
//     같은 글로 맞춥니다(sync). 발자국을 지우거나 고쳐서 한 번에 완독이 아니게 되면 **이음만 풀고 글은 그대로 둡니다**(detach) —
//     '한 권의 책'은 지울 수 없고 고쳐쓰기만 되기 때문입니다(선생님 요청 · 아래 deleteReview). 한때 이때 함께 걷었습니다(drop).
//   · 학생이 '한 권의 책'을 직접 고쳐 저장하면(saveReview — 새로 지은 글에는 fromLogId가 없음) 그때부터 따로입니다.
//   · 이 책에 '한 권의 책'이 이미 있으면(전에 써 둔 것) 새로 만들지 않고 그대로 둡니다. 보관된 책 · 가득 찬 목록도 만들지 않음.
//   · 별점은 발자국 창에서 고른 값(action.rating · 1~5), 없으면 5 — '한 권의 책' 창의 처음 값과 같습니다.
// 화면(components/reading/ReadingHub.jsx의 LogForm)도 이 셈으로 안내를 고릅니다 — 둘이 어긋나지 않게 한 곳에 둡니다.
export function coversWholeBook(range, book) {
  const total = Number(book?.totalPages);
  return Number.isInteger(total) && total > 0 && Number(range?.startPage) === 1 && Number(range?.endPage) === total;
}
// before — 고치기 전 발자국(새 발자국이면 null) · after — 저장할 범위(지우면 null) · reviews — 서재의 '한 권의 책' 목록.
// "create" 함께 남김 · "sync" 함께 남긴 글을 고친 감상으로 · "detach" 이음만 풀고 글은 그대로 · null 할 일 없음.
export function wholeBookReviewPlan({ book, before = null, after = null, reviews = [] } = {}) {
  if (!book) return null;
  const list = Array.isArray(reviews) ? reviews : [];
  const linked = before ? list.some((r) => r?.bookId === book.id && r?.fromLogId === before.id) : false;
  const isWhole = !!after && coversWholeBook(after, book);
  if (linked) return isWhole ? "sync" : "detach";
  const wasWhole = !!before && coversWholeBook(before, book);
  if (isWhole && !wasWhole && !book.archived && list.length < LIMITS.reviews && !list.some((r) => r?.bookId === book.id)) return "create";
  return null;
}
function wholeBookReview(book, log, action, classId, now) {
  return {
    id: `${String(log.id).slice(0, 96)}-rv`, bookId: book.id, classId,
    text: log.notes, rating: integer(action.rating ?? 5, "별점", 1, 5),
    fromLogId: log.id, createdAt: now, updatedAt: now,
  };
}
// 발자국을 남기거나 고치거나 지운 뒤의 '한 권의 책' 목록(위 계획대로).
function reviewsAfterLog(state, book, before, after, action, classId, now) {
  const plan = wholeBookReviewPlan({ book, before, after, reviews: state.reviews });
  const linked = (r) => r.bookId === book.id && before && r.fromLogId === before.id;
  if (plan === "create") return [...state.reviews, wholeBookReview(book, after, action, classId, now)];
  if (plan === "sync") return state.reviews.map((r) => linked(r) && r.text !== after.notes ? { ...r, text: after.notes, updatedAt: now } : r);
  if (plan === "detach") return state.reviews.map((r) => { if (!linked(r)) return r; const { fromLogId: _from, ...kept } = r; return kept; });
  return state.reviews;
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
      // context.byTeacher — 담당 선생님이 학생의 책 정보를 고칠 때(선생님 요청 · 2026년 11월 · 서버가 담당 교사 · 그 반 학생을
      // 확인하고 teacherBookAction으로 칸을 걸러 보냄). 학생과 다른 점 둘: ① 읽기 상태 · 활동 연결은 학생의 것이라 받지 않고
      // ② **기록이 있어도 전체 쪽수를 고칩니다**(학생은 막혀 있는 정정 — 잘못 적은 쪽수를 바로잡게). 그래도 기록한 마지막 쪽
      // 아래로는 못 줄이고, 완독 · 경험치 · 뱃지는 새 쪽수로 다시 셉니다(deriveReading — 따로 적는 칸이 없음).
      const byTeacher = context.byTeacher === true;
      const book = assertBook(state, action.bookId);
      const updated = bookMetadata(book, action);
      if (action.title !== undefined) updated.title = text(action.title, "책 제목", 150);
      if (action.author !== undefined) updated.author = text(action.author, "저자", 100);
      if (!byTeacher && action.activityId !== undefined) updated.activityId = action.activityId === null || action.activityId === "" ? null : identifier(action.activityId);
      if (action.totalPages !== undefined) updated.totalPages = integer(action.totalPages, "전체 쪽수", 1, 100000);
      if (!byTeacher && updated.totalPages !== book.totalPages && (state.logs.some((log) => log.bookId === book.id) || state.reviews.some((review) => review.bookId === book.id))) {
        throw new Error("독서 기록이 있는 책의 전체 쪽수는 변경할 수 없어요. 기록을 먼저 정정해 주세요.");
      }
      const floor = bookPagesFloor(state, book.id);
      if (updated.totalPages < floor) {
        throw new Error(byTeacher ? `이 책의 독서 발자국이 ${floor}쪽까지 있어요. 전체 쪽수는 ${floor}쪽보다 적게 바꿀 수 없어요.` : "기록한 마지막 쪽보다 전체 쪽수를 줄일 수 없어요.");
      }
      if (!byTeacher && action.status !== undefined) {
        if (!["reading", "paused"].includes(action.status)) throw new Error("완독은 독서 기록을 기준으로 자동 반영해요.");
        updated.status = action.status;
      }
      if (state.books.some((other) => other.id !== book.id && sameBook(other, updated))) throw new Error("같은 책이 이미 있어요.");
      next.books = state.books.map((item) => item.id === book.id ? updated : item);
      // 쪽수가 바뀌면 '한 번에 완독'(1쪽~마지막 쪽 발자국 하나)이 아니게 된 발자국과 함께 남긴 '한 권의 책'은 이음만 풉니다(글은 그대로 —
      // 발자국을 고쳐 한 번에 완독이 아니게 될 때와 같음 · 위 wholeBookReviewPlan). 새로 맞게 된 발자국에 글을 만들지는 않습니다.
      if (updated.totalPages !== book.totalPages) {
        next.reviews = state.reviews.map((review) => {
          if (review.bookId !== book.id || !review.fromLogId) return review;
          const log = state.logs.find((item) => item.id === review.fromLogId);
          if (log && coversWholeBook(log, updated)) return review;
          const { fromLogId: _from, ...kept } = review;
          return kept;
        });
      }
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
      const log = { id, bookId: book.id, classId, ...fields, createdAt: now };
      next.logs = [...state.logs, log];
      // 한 번에 완독(1쪽~마지막 쪽) — 그 감상을 '한 권의 책'에도 같은 글로(위 wholeBookReviewPlan)
      next.reviews = reviewsAfterLog(state, book, null, log, action, classId, now);
      break;
    }
    case "updateLog": {
      const old = state.logs.find((log) => log.id === (action.logId ?? action.id));
      if (!old) throw new Error("독서 기록을 찾을 수 없어요.");
      checkClass(old, classId);
      const book = assertBook(state, old.bookId, true);
      if (action.bookId !== undefined && action.bookId !== old.bookId) throw new Error("기록의 책은 바꿀 수 없어요.");
      const fields = logFields(state, { ...old, ...action }, book, today, old.id);
      const updated = { ...old, ...fields, updatedAt: now };
      next.logs = state.logs.map((log) => log.id === old.id ? updated : log);
      // 함께 남긴 '한 권의 책'은 고친 감상을 따라가고, 한 번에 완독이 아니게 되면 따로 남습니다(처음으로 1쪽~마지막 쪽이 되면 새로 남김)
      next.reviews = reviewsAfterLog(state, book, old, updated, action, classId, now);
      break;
    }
    case "deleteLog": {
      const old = state.logs.find((log) => log.id === (action.logId ?? action.id));
      if (!old) return previous ?? state;
      checkClass(old, classId);
      next.logs = state.logs.filter((log) => log.id !== old.id);
      // 이 발자국과 함께 남긴 '한 권의 책'은 지우지 않고 이음만 풉니다('한 권의 책'은 지울 수 없음 — 아래 deleteReview)
      const book = state.books.find((item) => item.id === old.bookId);
      if (book) next.reviews = reviewsAfterLog(state, book, old, null, action, classId, now);
      break;
    }
    case "saveReview": {
      const book = assertBook(state, action.bookId);
      const existing = state.reviews.find((review) => review.bookId === book.id);
      if (existing) checkClass(existing, classId);
      else checkLimit(state.reviews, "감상문", LIMITS.reviews);
      // (옛 화면이 함께 보내는 shelved — '광장 책꽂이에 꽂기' — 는 읽지 않습니다. 고쳐 쓰면 옛 표시도 함께 걷힙니다.)
      // 한 번에 완독한 발자국과 함께 남긴 글(fromLogId)도 직접 고쳐 저장하면 이음이 풀려 그때부터 따로입니다(새로 지은 글에 없음).
      const review = {
        id: existing?.id ?? recordId(action, context), bookId: book.id, classId,
        text: text(action.text ?? action.content, "감상문", 5000),
        rating: integer(action.rating ?? existing?.rating ?? 5, "별점", 1, 5),
        createdAt: existing?.createdAt ?? now, updatedAt: now,
      };
      next.reviews = [...state.reviews.filter((item) => item.bookId !== book.id), review];
      break;
    }
    // 걷은 요청 둘 — '광장 책꽂이에 꽂기/빼기' · '발자국 보이기/숨기기'(위 PLAZA_NO_CHOICE). 옛 화면이 보내면
    // 꽂기 · 보이기(이미 그렇게 되어 있음)는 아무 일 없이 받고, 빼기 · 숨기기는 까닭을 알려 거절합니다.
    case "shelveReview": {
      if (action.shelved === false) throw new Error(PLAZA_NO_CHOICE);
      return previous ?? state;
    }
    case "setBookPlaza": {
      if (action.hidden === true) throw new Error(PLAZA_NO_CHOICE);
      return previous ?? state;
    }
    // '한 권의 책'은 지울 수 없고 고쳐쓰기만 됩니다(선생님 요청 · 2026년 11월 — 상세 창의 '한 권의 책 삭제' 단추를 '고쳐쓰기'로 바꿈).
    // 옛 화면(새로고침하지 않은 탭)이 보내는 지우기 요청에는 까닭을 알려 거절합니다. 학생 탈퇴 · 반 삭제는 서재 문서째 지우므로 이 길과 무관.
    case "deleteReview": throw new Error(REVIEW_NO_DELETE);
    case "setFeaturedBadge": {
      const id = action.badgeId ?? null;
      if (id !== null && !deriveReading(state, now).earnedBadges.some((badge) => badge.id === id)) throw new Error("획득한 뱃지에서 대표 뱃지를 골라 주세요.");
      next.featuredBadge = id;
      break;
    }
    default: throw new Error("지원하지 않는 책 봄 요청이에요.");
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
  // 레벨 · 다음 레벨 · 진행 — 아지트 머리의 캐릭터 카드와 같은 셈 한 곳(readingLevelProgress)
  const growth = readingLevelProgress(xp);
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
    ...growth,
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
