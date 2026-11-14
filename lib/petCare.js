// =============================================================
// 독서 펫의 먹이 — 셈(순수 함수 · 서버와 화면 · 체험반이 함께 씀)
// -------------------------------------------------------------
// 선생님과 정한 것(되돌리려면 먼저 여쭙니다 — 기준 문서는 READING_GROWTH.md의 '펫 먹이'):
//   · 펫의 배부름은 0~100. **매일 10씩** 줄어듭니다 — 단계와 상관없이, **알도**(알은 과일을 먹지 않음).
//   · **과일 1개 = 배부름 +10.** 100이면 더 먹지 않습니다(과일이 버려지지 않게).
//   · **'읽은 날'에는 줄지 않습니다**(다시 차는 것이 아니라 **유지**) — 오늘 날짜로 남긴 독서 발자국이
//     **5쪽 이상 · 글 250자 이상**일 때(여러 번에 나눠 남겨도 그날 것을 합쳐서 셈).
//   · 30 이하가 되면 펫이 배고프다고 말하고, **0이 되면 먹이를 찾아 떠납니다**. 30 아래에서도 책을 읽지 않으면
//     날마다 10씩 줄어듭니다(한때 '그 말을 들은 날에만 줄어든다'를 제안했는데 선생님이 빼셨습니다).
//   · 줄지 않는 날은 **선생님이 관리자 설정에서 정합니다** — 주말(끄지 않았으면 쉼) · 방학 · 시험 기간 ·
//     기타(명절 · 예외적인 연휴)의 기간.
//   · 떠난 펫은 **같은 펫이 돌아옵니다**(새 알을 주지 않음 — 일부러 떠나보내 바꾸지 못하게). '다시 부르기'
//     걸음을 채우면 배부름 60으로 돌아옵니다 — 읽은 날 하루 = 1걸음 · 과일 2개 = 1걸음, 필요한 걸음은
//     알~5단계 3 · 6~8단계 4 · 9~10단계 5.
//
// 자료 — 프로필의 펫(users/{uid}.readingPet)에 care 한 칸. **서버만 씁니다**(lib/server/readingService.js).
//   care: { full — 배부름(day까지 셈한 값), day — 'YYYY-MM-DD' 이 날까지 셈함, kept — 마지막 '읽은 날',
//           away — 떠났으면 { on: 떠난 날, days: 걸음이 된 읽은 날들, fruit: 과일로 낸 걸음 수 },
//           back — 돌아온 횟수, fed — 마지막으로 먹인 때(ms) }
//   care가 없는 펫은 '알을 받은 날(선생님이 펫 먹이를 그 뒤에 켰으면 켠 날)에 100'에서 시작한 것으로 셉니다
//   — 그래서 이 기능을 켤 때 옮길 자료가 없습니다.
//
// **시간이 지나 줄어드는 것은 어디에도 적지 않습니다.** 화면도 서버도 (care · 반 설정 · 오늘 날짜)로 그때그때
// 셉니다(읽기 · 쓰기 0 — careStatus). 적는 때는 먹이를 줄 때 · 오늘이 '읽은 날'이 될 때 · 다시 부르기 걸음이
// 늘 때뿐입니다. 하루는 그날이 **끝날 때** 줄어듭니다 — 그날 안에는 책을 읽거나 과일을 주어 막을 수 있습니다.
// 날짜는 모두 서울 날짜입니다(lib/reading.js의 kstToday). 시험 tests/unit/petCare.test.mjs.
// =============================================================
import { isReadingDay, kstToday, readingDayKey, readingDayNumber } from "./reading.js";

export const CARE_MAX = 100;
// 하루에 줄어드는 배부름(매일 — 선생님 결정)
export const CARE_DAY_DROP = 10;
// 과일 1개가 채우는 배부름(선생님 결정)
export const CARE_FRUIT = 10;
// 이 값 이하면 펫이 배고프다고 말합니다
export const CARE_HUNGRY = 30;
// '읽은 날' — 그날의 독서 발자국이 이만큼(선생님 결정)
export const CARE_READ_PAGES = 5;
export const CARE_READ_CHARS = 250;
// 돌아온 펫의 배부름
export const CARE_RETURN = 60;
// 다시 부르기 — 과일 몇 개가 한 걸음인가
export const CARE_STEP_FRUIT = 2;
// 한 번에 줄 수 있는 과일(100까지 채우는 데 드는 만큼)
export const CARE_FEED_MAX = CARE_MAX / CARE_FRUIT;
// 줄지 않는 기간의 종류(관리자 설정 — 선생님이 고름). '기타'는 명절 · 예외적인 연휴.
export const CARE_REST_KINDS = Object.freeze([
  Object.freeze({ key: "vacation", label: "방학" }),
  Object.freeze({ key: "exam", label: "시험 기간" }),
  Object.freeze({ key: "other", label: "기타" }),
]);
export const CARE_RESTS_MAX = 20;
export const CARE_REST_NOTE_MAX = 20;
const REST_KEYS = CARE_REST_KINDS.map((k) => k.key);
// 한 번의 셈에서 넘겨 보는 날 수의 천장(10년) — 망가진 날짜로 끝없이 돌지 않게
const WALK_MAX = 3660;
const STEP_DAYS_MAX = 10;

const whole = (v, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const fail = (message, status, code) => ({ message, status, code });
const OFF = fail("이 반에서는 펫 먹이를 쓰지 않아요.", 403, "reading/pet-feed-disabled");

export function careRestLabel(kind) {
  return CARE_REST_KINDS.find((k) => k.key === kind)?.label ?? "기타";
}

/** 줄지 않는 기간 목록을 고른 모양으로 — 날짜가 틀린 줄은 버리고, 시작일 차례로. */
export function normalizeCareRests(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    if (!isReadingDay(raw.from) || !isReadingDay(raw.to) || raw.to < raw.from) continue;
    const note = typeof raw.note === "string" ? raw.note.replace(/\s+/g, " ").trim().slice(0, CARE_REST_NOTE_MAX) : "";
    out.push({ kind: REST_KEYS.includes(raw.kind) ? raw.kind : "other", from: raw.from, to: raw.to, ...(note ? { note } : {}) });
    if (out.length >= CARE_RESTS_MAX) break;
  }
  return out.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

// 때(ms 수 · Date · Firestore의 Timestamp) → ms. 모르는 모양이면 null.
function msOf(value) {
  if (value == null) return null;
  const ms = typeof value === "number" ? value
    : typeof value.toMillis === "function" ? value.toMillis()
      : value instanceof Date ? value.getTime()
        : typeof value.seconds === "number" ? value.seconds * 1000 : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * 그 학생에게 적용할 규칙 — **그 반에 들어온 날(joinedAt — 소속 문서의 때)보다 앞의 날은 세지 않습니다.**
 * 반을 미리 만들어 펫 먹이를 켜 두고 학생이 나중에 들어오면(새 학기 반 · 전학생 · 다른 반에서 옮겨 온 학생),
 * 그 사이의 날을 세어 들어오자마자 펫이 배고프거나 떠나 있는 일이 없게 합니다. 들어온 날을 모르면 그대로.
 */
export function careRulesFor(rules, joinedAt) {
  const ms = msOf(joinedAt);
  if (!rules?.from || ms === null) return rules;
  const day = kstToday(new Date(ms));
  return day > rules.from ? { ...rules, from: day } : rules;
}

/**
 * 반 문서 → 먹이의 규칙. on은 부르는 쪽이 정합니다(lib/readingPet.js의 petFeedOn — 책나눔 · 학생 펫 · 펫 먹이가 모두 켜짐).
 *   from    이 날부터 셉니다(그 전의 날은 세지 않음) — 선생님이 펫 먹이를 켠 날과 그 학생이 반에 들어온 날
 *           (joinedAt) 가운데 늦은 날. 켠 날이 없으면 null — 그때는 아무 날도 세지 않습니다
 *           (켠 날을 모르는 채로 '알을 받은 날부터' 세면 켜자마자 펫이 한꺼번에 떠남).
 *   weekend 주말에는 줄지 않음(값이 없으면 쉼 — 끈 것만 false)
 *   rests   줄지 않는 기간들
 */
export function careRules(classDoc, on = true, joinedAt = null) {
  const from = Number(classDoc?.petFeedFrom);
  return careRulesFor({
    on: !!on,
    from: Number.isFinite(from) && from > 0 ? kstToday(new Date(from)) : null,
    weekend: classDoc?.petRestWeekend !== false,
    rests: normalizeCareRests(classDoc?.petRests),
  }, joinedAt);
}

/** 그날은 배부름이 줄지 않는 날인가 — 주말(쉬게 해 둔 반) · 선생님이 넣은 기간. */
export function isCareRestDay(key, rules) {
  if (!isReadingDay(key)) return false;
  if (rules?.weekend !== false) {
    const dow = (((readingDayNumber(key) + 4) % 7) + 7) % 7;
    if (dow === 0 || dow === 6) return true;
  }
  return (rules?.rests ?? []).some((r) => r.from <= key && key <= r.to);
}
/** 그날이 든 기간(없으면 null) — 화면이 '방학 중이라 줄지 않아요'를 말할 때. */
export function careRestOf(key, rules) {
  return (rules?.rests ?? []).find((r) => r.from <= key && key <= r.to) ?? null;
}

/** 다시 부르기에 필요한 걸음 — 알~5단계 3 · 6~8단계 4 · 9~10단계 5. */
export function careStepsNeeded(stage) {
  const n = Math.floor(Number(stage) || 1);
  return n >= 9 ? 5 : n >= 6 ? 4 : 3;
}

function normalizeAway(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !isReadingDay(raw.on)) return null;
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter(isReadingDay))].sort().slice(-STEP_DAYS_MAX) : [];
  return { on: raw.on, days, fruit: whole(raw.fruit, 0, STEP_DAYS_MAX) };
}

/** 프로필에 적힌 care를 고른 모양으로 — 없거나 모양이 틀리면 null(그때는 '처음부터 100'으로 셈). */
export function normalizeCare(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !isReadingDay(raw.day)) return null;
  const fed = Number(raw.fed);
  return {
    full: whole(raw.full, 0, CARE_MAX),
    day: raw.day,
    kept: isReadingDay(raw.kept) ? raw.kept : null,
    away: normalizeAway(raw.away),
    back: whole(raw.back, 0, 9999),
    fed: Number.isFinite(fed) && fed > 0 ? Math.round(fed) : null,
  };
}

// 셈을 시작할 자리 — care가 있으면 그것, 없으면 '알을 받은 날에 100'. 펫 먹이를 켠 날(rules.from)보다 앞의 날은
// 세지 않습니다(껐다 켠 사이도 — 그 사이의 날은 건너뛰고 배부름은 그대로 이어짐).
function anchorOf(mirror, rules, today) {
  const care = normalizeCare(mirror?.care);
  const assigned = Number(mirror?.assignedAt) > 0 ? kstToday(new Date(Number(mirror.assignedAt))) : null;
  let day = care?.day ?? assigned ?? today;
  // 켠 날을 모르면(값이 없는 반) 아무 날도 세지 않습니다
  const from = rules?.from ?? today;
  if (from > day) day = from;
  return { full: care ? care.full : CARE_MAX, day, kept: care?.kept ?? null, away: care?.away ?? null, back: care?.back ?? 0, fed: care?.fed ?? null };
}

// 어제까지의 날을 넘겨 셈한 care — day는 '어제'(이미 그 뒤면 그대로). 떠났으면 away가 채워집니다.
function settle(mirror, rules, today) {
  const a = anchorOf(mirror, rules, today);
  let { full, away } = a;
  const start = readingDayNumber(a.day);
  const last = readingDayNumber(today) - 1;
  if (!away && full <= 0) away = { on: readingDayKey(start + 1), days: [], fruit: 0 };
  if (!away) {
    const end = Math.min(last, start + WALK_MAX);
    for (let n = start + 1; n <= end; n += 1) {
      const key = readingDayKey(n);
      if (key === a.kept || isCareRestDay(key, rules)) continue;
      full -= CARE_DAY_DROP;
      if (full <= 0) { away = { on: readingDayKey(n + 1), days: [], fruit: 0 }; break; }
    }
  }
  return {
    full: away ? 0 : Math.max(0, full),
    day: readingDayKey(Math.max(start, last)),
    kept: a.kept,
    away,
    back: a.back,
    fed: a.fed,
  };
}

/**
 * 펫의 지금 배부름 — mirror: 프로필의 펫(lib/readingPet.js의 normalizePetMirror), rules: careRules, today: 서울 날짜,
 * stage: 펫의 단계(다시 부르기 걸음 수에만 씀). 펫 먹이를 쓰지 않는 반 · 펫이 없으면 null.
 * 돌려줌 {
 *   full       지금 배부름(0~100)
 *   hungry     30 이하(떠나지 않은 펫)      low  10 이하 — 오늘 못 먹으면 떠남
 *   away       먹이를 찾아 떠남              awayOn  떠난 날
 *   keptToday  오늘은 '읽은 날'이라 줄지 않음   restToday  오늘은 쉬는 날(주말 · 기간)이라 줄지 않음
 *   daysLeft   지금 배부름으로 버티는 날 수(쉬는 날 · 읽은 날은 안 셈)
 *   room       지금 먹을 수 있는 과일 수(떠났으면 0 — 알인지는 부르는 쪽이 봄)
 *   steps      떠났을 때 { need, done, days(읽은 날 걸음), fruit(과일 걸음) }
 *   care       지금까지 셈한 care(서버가 적을 때의 바탕)
 * }
 */
export function careStatus(mirror, rules, today, stage = 1) {
  if (!mirror || typeof mirror !== "object" || !rules?.on || !isReadingDay(today)) return null;
  const care = settle(mirror, rules, today);
  const away = !!care.away;
  const need = careStepsNeeded(stage);
  const done = away ? care.away.days.length + care.away.fruit : 0;
  return {
    full: care.full,
    hungry: !away && care.full <= CARE_HUNGRY,
    low: !away && care.full <= CARE_DAY_DROP,
    away,
    awayOn: away ? care.away.on : null,
    keptToday: care.kept === today,
    restToday: isCareRestDay(today, rules),
    daysLeft: away ? 0 : Math.ceil(care.full / CARE_DAY_DROP),
    room: away ? 0 : Math.floor((CARE_MAX - care.full) / CARE_FRUIT),
    steps: away ? { need, done: Math.min(need, done), days: care.away.days.length, fruit: care.away.fruit } : null,
    care,
  };
}

/** 화면에 돌려줄 배부름 요약 — care 자체(다음 셈의 바탕)는 뺍니다(화면은 프로필의 펫을 구독해 스스로 셈). */
export function careView(status) {
  if (!status) return null;
  return {
    full: status.full, hungry: status.hungry, low: status.low, away: status.away, awayOn: status.awayOn,
    keptToday: status.keptToday, restToday: status.restToday, daysLeft: status.daysLeft, room: status.room, steps: status.steps,
  };
}

/** 친구 화면(리더보드 · 책 광장)에서 이 펫을 감출까 — 먹이를 찾아 떠난 펫은 표시 없이 안 보입니다(선생님 결정). */
export function careAway(mirror, rules, today) {
  return careStatus(mirror, rules, today)?.away === true;
}

/**
 * 그날이 '읽은 날'인가 — summary: lib/reading.js의 deriveReading 결과, dateKey: 그 날짜.
 * 그날 날짜로 남긴 독서 발자국의 **새로 읽은 쪽**(겹친 쪽은 한 번만 — 경험치와 같은 셈)과 **글자 수**(앞뒤 공백을 뺀
 * 길이 — 화면의 글자 수와 같음)를 합쳐, 5쪽 이상 · 250자 이상이면 읽은 날입니다(어느 반에서 남겼든).
 */
export function readingDayProof(summary, dateKey) {
  let pages = 0;
  let chars = 0;
  for (const event of summary?.events ?? []) if (event?.kind === "pages" && event.date === dateKey) pages += Number(event.xp) || 0;
  for (const log of summary?.logs ?? []) if (log?.date === dateKey) chars += String(log.notes ?? "").trim().length;
  return { pages, chars, ok: pages >= CARE_READ_PAGES && chars >= CARE_READ_CHARS };
}

function returned(care, today) {
  return {
    full: CARE_RETURN,
    // 돌아온 날은 세지 않습니다(다음 날부터 줄어듦)
    day: today,
    kept: care.away?.days.includes(today) ? today : care.kept,
    away: null,
    back: (care.back ?? 0) + 1,
    fed: care.fed ?? null,
  };
}
function afterStep(care, today, stage, event) {
  const done = care.away.days.length + care.away.fruit;
  return done >= careStepsNeeded(stage) ? { care: returned(care, today), event: "returned" } : { care, event };
}

/**
 * [학생] 먹이 주기 — want개를 주려 할 때(가진 과일 fruits). 알 · 떠난 펫 · 배부른 펫은 먹지 않습니다.
 * 돌려줌 { care, used(쓴 과일 수) } 또는 { error }.
 */
export function planCareFeed({ mirror, rules, today, stage = 1, fruits = 0, want = 1, now = Date.now() } = {}) {
  const status = careStatus(mirror, rules, today, stage);
  if (!status) return { error: OFF };
  if (!mirror.species) return { error: fail("알은 아직 과일을 먹지 않아요. 책을 읽고 발자국을 남기면 따뜻하게 지켜져요.", 409, "reading/pet-egg") };
  if (status.away) return { error: fail("펫이 먹이를 찾아 떠나 있어요. 먼저 다시 불러 주세요.", 409, "reading/pet-away") };
  if (status.room < 1) return { error: fail("지금은 배가 불러요. 조금 뒤에 주세요.", 409, "reading/pet-full") };
  const have = Math.max(0, Math.floor(Number(fruits) || 0));
  if (have < 1) return { error: fail("줄 과일이 없어요. 수업 활동으로 과일을 모아 보세요.", 409, "reading/pet-no-fruit") };
  const used = Math.max(1, Math.min(Math.floor(Number(want) || 1), status.room, have, CARE_FEED_MAX));
  return { care: { ...status.care, full: status.care.full + used * CARE_FRUIT, fed: Math.round(Number(now) || Date.now()) }, used };
}

/**
 * 독서를 저장한 뒤 — 오늘이 '읽은 날'인가(ok)에 맞춥니다. 바뀔 것이 없으면 { care: null, event: null }(쓰기 없음).
 * event: "kept"(오늘은 줄지 않음) · "unkept"(기록을 지우거나 줄여 풀림) · "step"(다시 부르기 한 걸음) ·
 *        "unstep"(걸음이 풀림) · "returned"(펫이 돌아옴)
 */
export function planCareReadDay({ mirror, rules, today, stage = 1, ok = false } = {}) {
  const status = careStatus(mirror, rules, today, stage);
  if (!status) return { care: null, event: null };
  const care = status.care;
  if (status.away) {
    const has = care.away.days.includes(today);
    if (ok && !has) {
      return afterStep({ ...care, away: { ...care.away, days: [...care.away.days, today].slice(-STEP_DAYS_MAX) } }, today, stage, "step");
    }
    if (!ok && has) return { care: { ...care, away: { ...care.away, days: care.away.days.filter((d) => d !== today) } }, event: "unstep" };
    return { care: null, event: null };
  }
  // 쉬는 날은 어차피 줄지 않습니다 — 적지 않습니다(쓰기를 아낌)
  if (ok && care.kept !== today && !status.restToday) return { care: { ...care, kept: today }, event: "kept" };
  if (!ok && care.kept === today) return { care: { ...care, kept: null }, event: "unkept" };
  return { care: null, event: null };
}

/** [학생] 다시 부르기 — 과일 2개로 한 걸음. 돌려줌 { care, event: "step" | "returned", used } 또는 { error }. */
export function planCareStep({ mirror, rules, today, stage = 1, fruits = 0 } = {}) {
  const status = careStatus(mirror, rules, today, stage);
  if (!status) return { error: OFF };
  if (!status.away) return { error: fail("펫이 곁에 있어요.", 409, "reading/pet-not-away") };
  if (Math.floor(Number(fruits) || 0) < CARE_STEP_FRUIT) {
    return { error: fail(`과일 ${CARE_STEP_FRUIT}개가 있어야 한 걸음을 낼 수 있어요.`, 409, "reading/pet-no-fruit") };
  }
  const care = { ...status.care, away: { ...status.care.away, fruit: status.care.away.fruit + 1 } };
  return { ...afterStep(care, today, stage, "step"), used: CARE_STEP_FRUIT };
}

/** [선생님] 불러 주기 — 걸음과 상관없이 곧바로 돌아옵니다(긴 병결 같은 예외). 돌려줌 { care, event } 또는 { error }. */
export function planCareRecall({ mirror, rules, today, stage = 1 } = {}) {
  const status = careStatus(mirror, rules, today, stage);
  if (!status) return { error: OFF };
  if (!status.away) return { error: fail("이 학생의 펫은 곁에 있어요.", 409, "reading/pet-not-away") };
  return { care: returned(status.care, today), event: "returned" };
}

/** 알이 깨어날 때의 care — 깨어난 펫은 배부름 100에서 시작합니다. 펫 먹이를 쓰지 않는 반이면 null(건드리지 않음). */
export function careAfterHatch(mirror, rules, today) {
  const status = careStatus(mirror, rules, today);
  if (!status) return null;
  return { full: CARE_MAX, day: today, kept: status.care.kept, away: null, back: status.care.back ?? 0, fed: status.care.fed ?? null };
}

/**
 * 순위 한 장에 적어 둘 만큼만 추린 care — 보낼 때 반 설정 · 그날 날짜로 '떠났나'를 셉니다(서버의 getReadingRankings).
 * joinedAt — 그 학생이 반에 들어온 때(careRulesFor에 넘길 값 · ms로 적어 둠).
 */
export function careSeed(mirror, joinedAt = null) {
  if (!mirror || typeof mirror !== "object") return null;
  const care = normalizeCare(mirror.care);
  return {
    joined: msOf(joinedAt),
    assignedAt: Number(mirror.assignedAt) > 0 ? Math.round(Number(mirror.assignedAt)) : null,
    care: care ? { full: care.full, day: care.day, kept: care.kept, away: care.away ? { on: care.away.on } : null } : null,
  };
}
