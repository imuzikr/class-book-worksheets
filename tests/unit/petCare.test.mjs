// 독서 펫의 먹이 — 배부름 · 읽은 날 · 쉬는 날 · 떠남 · 다시 부르기(lib/petCare.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARE_DAY_DROP, CARE_FRUIT, CARE_HUNGRY, CARE_MAX, CARE_READ_CHARS, CARE_READ_PAGES, CARE_RESTS_MAX, CARE_RETURN, CARE_STEP_FRUIT,
  careAfterHatch, careAway, careRestOf, careRules, careRulesFor, careSeed, careStatus, careStepsNeeded, isCareRestDay, normalizeCare, normalizeCareRests,
  planCareFeed, planCareReadDay, planCareRecall, planCareStep, readingDayProof,
} from "@/lib/petCare";
import { normalizePetMirror, petCareRules, petFeedOn, planPetAction } from "@/lib/readingPet";
import { applyReadingAction, deriveReading, initialReadingState } from "@/lib/reading";

// 서울 날짜 d의 낮 12시(ms)
const at = (d) => Date.parse(`${d}T12:00:00+09:00`);
// 2026-11-02(월) ~ 11-06(금), 11-07(토) · 11-08(일)
const rulesFrom = (from, extra = {}) => careRules({ petFeedFrom: at(from), ...extra }, true);
const pet = (extra = {}) => normalizePetMirror({ species: "owl", baseXp: 0, assignedAt: at("2026-09-01"), hatchedAt: at("2026-09-03"), ...extra });
const egg = (extra = {}) => normalizePetMirror({ species: null, baseXp: 0, assignedAt: at("2026-09-01"), hatchedAt: null, ...extra });

test("정한 숫자 — 매일 -10 · 과일 +10 · 30 이하 배고픔 · 5쪽 250자 · 돌아오면 60 · 과일 2개 한 걸음", () => {
  assert.equal(CARE_MAX, 100);
  assert.equal(CARE_DAY_DROP, 10);
  assert.equal(CARE_FRUIT, 10);
  assert.equal(CARE_HUNGRY, 30);
  assert.equal(CARE_READ_PAGES, 5);
  assert.equal(CARE_READ_CHARS, 250);
  assert.equal(CARE_RETURN, 60);
  assert.equal(CARE_STEP_FRUIT, 2);
  assert.deepEqual([1, 2, 5, 6, 8, 9, 10].map(careStepsNeeded), [3, 3, 3, 4, 4, 5, 5]);
});

test("펫 먹이 스위치 — 학생 펫이 켜진 반에서 켠 것만(기본 꺼짐)", () => {
  assert.equal(petFeedOn({ readingEnabled: true }), false);
  assert.equal(petFeedOn({ readingEnabled: true, petFeedEnabled: true }), true);
  assert.equal(petFeedOn({ readingEnabled: true, petEnabled: false, petFeedEnabled: true }), false);
  assert.equal(petFeedOn({ readingEnabled: false, petFeedEnabled: true }), false);
  assert.equal(petFeedOn({ readingEnabled: true, petFeedEnabled: true, archived: true }), false);
  assert.equal(petCareRules({ readingEnabled: true, petFeedEnabled: true, petFeedFrom: at("2026-11-01") }).on, true);
  assert.equal(petCareRules({ readingEnabled: true, petFeedFrom: at("2026-11-01") }).on, false);
});

test("반 설정 → 규칙 — 켠 날 · 주말(값이 없으면 쉼) · 기간(틀린 줄은 버림 · 시작일 차례)", () => {
  const rules = careRules({
    petFeedFrom: at("2026-11-01"),
    petRests: [
      { kind: "exam", from: "2026-12-08", to: "2026-12-11" },
      { kind: "vacation", from: "2026-12-24", to: "2027-02-01", note: "  겨울   방학 " },
      { kind: "other", from: "2026-11-20", to: "2026-11-19" },
      { kind: "moon", from: "2026-11-25", to: "2026-11-25" },
      { kind: "other", from: "2026-13-01", to: "2026-13-02" },
      null, "x",
    ],
  });
  assert.equal(rules.from, "2026-11-01");
  assert.equal(rules.weekend, true);
  assert.deepEqual(rules.rests, [
    { kind: "other", from: "2026-11-25", to: "2026-11-25" },
    { kind: "exam", from: "2026-12-08", to: "2026-12-11" },
    { kind: "vacation", from: "2026-12-24", to: "2027-02-01", note: "겨울 방학" },
  ]);
  assert.equal(careRules({ petRestWeekend: false }).weekend, false);
  assert.equal(careRules({}).from, null);
  assert.equal(normalizeCareRests(Array.from({ length: 30 }, () => ({ kind: "other", from: "2026-11-25", to: "2026-11-25" }))).length, CARE_RESTS_MAX);
  assert.deepEqual(normalizeCareRests("x"), []);
});

test("쉬는 날 — 주말(쉬게 한 반) · 선생님이 넣은 기간", () => {
  const rules = rulesFrom("2026-11-01", { petRests: [{ kind: "exam", from: "2026-11-10", to: "2026-11-11" }] });
  assert.equal(isCareRestDay("2026-11-07", rules), true);  // 토
  assert.equal(isCareRestDay("2026-11-08", rules), true);  // 일
  assert.equal(isCareRestDay("2026-11-09", rules), false); // 월
  assert.equal(isCareRestDay("2026-11-10", rules), true);
  assert.equal(isCareRestDay("2026-11-11", rules), true);
  assert.equal(isCareRestDay("2026-11-12", rules), false);
  assert.equal(careRestOf("2026-11-10", rules).kind, "exam");
  assert.equal(careRestOf("2026-11-07", rules), null);
  const every = rulesFrom("2026-11-01", { petRestWeekend: false });
  assert.equal(isCareRestDay("2026-11-07", every), false);
  assert.equal(isCareRestDay("bad", every), false);
});

test("매일 10씩 줄어듦 — 켠 날은 세지 않고, 그날이 끝나야 줄며, 주말은 쉼", () => {
  const rules = rulesFrom("2026-11-01"); // 일요일에 켬
  const p = pet();
  assert.equal(careStatus(p, rules, "2026-11-01", 3).full, 100);
  assert.equal(careStatus(p, rules, "2026-11-02", 3).full, 100); // 월 — 아직 하루가 안 끝남
  assert.equal(careStatus(p, rules, "2026-11-03", 3).full, 90);  // 월요일이 끝남
  assert.equal(careStatus(p, rules, "2026-11-06", 3).full, 60);
  assert.equal(careStatus(p, rules, "2026-11-07", 3).full, 50);  // 금요일이 끝남
  assert.equal(careStatus(p, rules, "2026-11-09", 3).full, 50);  // 주말은 그대로
  const s = careStatus(p, rules, "2026-11-10", 3);
  assert.equal(s.full, 40);
  assert.equal(s.hungry, false);
  assert.equal(s.daysLeft, 4);
  assert.equal(s.room, 6);
  // 단계와 상관없이 같은 빠르기
  assert.equal(careStatus(p, rules, "2026-11-10", 10).full, 40);
  // 주말에도 줄게 한 반 — 11-02(월)부터 11-08(일)까지 이레
  assert.equal(careStatus(p, rulesFrom("2026-11-01", { petRestWeekend: false }), "2026-11-09", 3).full, 30);
});

test("알도 날마다 줄어듦 — 알을 받은 날이 켠 날보다 뒤면 받은 날부터", () => {
  const rules = rulesFrom("2026-11-01");
  assert.equal(careStatus(egg(), rules, "2026-11-06", 1).full, 60);
  const late = egg({ assignedAt: at("2026-11-04") });
  assert.equal(careStatus(late, rules, "2026-11-04", 1).full, 100);
  assert.equal(careStatus(late, rules, "2026-11-06", 1).full, 90);
});

test("30 이하면 배고픔, 10 이하면 오늘이 고비, 0이면 떠남(떠난 날)", () => {
  const rules = rulesFrom("2026-11-01");
  const p = pet();
  assert.equal(careStatus(p, rules, "2026-11-11", 3).full, 30);
  assert.equal(careStatus(p, rules, "2026-11-11", 3).hungry, true);
  assert.equal(careStatus(p, rules, "2026-11-11", 3).low, false);
  const last = careStatus(p, rules, "2026-11-13", 3);
  assert.deepEqual([last.full, last.hungry, last.low, last.away], [10, true, true, false]);
  const gone = careStatus(p, rules, "2026-11-14", 3);
  assert.deepEqual([gone.full, gone.hungry, gone.away, gone.awayOn, gone.room], [0, false, true, "2026-11-14", 0]);
  assert.deepEqual(gone.steps, { need: 3, done: 0, days: 0, fruit: 0 });
  // 한참 뒤에 봐도 떠난 날은 그대로
  assert.equal(careStatus(p, rules, "2027-03-02", 3).awayOn, "2026-11-14");
  assert.equal(careAway(p, rules, "2026-11-14"), true);
  assert.equal(careAway(p, rules, "2026-11-13"), false);
});

test("쉬는 기간에는 줄지 않음 — 방학 내내 그대로, 끝난 다음 날부터", () => {
  const rules = rulesFrom("2026-11-01", { petRests: [{ kind: "vacation", from: "2026-11-05", to: "2026-11-30" }] });
  const p = pet();
  assert.equal(careStatus(p, rules, "2026-11-05", 3).full, 70);
  assert.equal(careStatus(p, rules, "2026-11-30", 3).full, 70);
  assert.equal(careStatus(p, rules, "2026-11-30", 3).restToday, true);
  assert.equal(careStatus(p, rules, "2026-12-01", 3).full, 70);
  assert.equal(careStatus(p, rules, "2026-12-02", 3).full, 60);
});

test("펫 먹이를 끈 반 · 켠 날을 모르는 반 — 세지 않음", () => {
  const p = pet();
  assert.equal(careStatus(p, careRules({ petFeedFrom: at("2026-11-01") }, false), "2026-11-20", 3), null);
  assert.equal(careStatus(null, rulesFrom("2026-11-01"), "2026-11-20", 3), null);
  assert.equal(careStatus(p, rulesFrom("2026-11-01"), "bad", 3), null);
  // 켠 날이 없으면(값이 빠진 반) 아무 날도 세지 않습니다 — 켜자마자 한꺼번에 떠나지 않게
  const noFrom = careRules({}, true);
  assert.equal(careStatus(p, noFrom, "2026-11-20", 3).full, 100);
  assert.equal(careStatus(p, noFrom, "2026-11-20", 3).away, false);
});

test("껐다 다시 켜면 — 그 사이의 날은 세지 않고 배부름은 그대로 이어짐", () => {
  const p = pet({ care: { full: 40, day: "2026-11-10", kept: null } });
  // 11-10까지 셈해 40 → 한 달 꺼 두었다가 12-14(월)에 다시 켬
  const rules = rulesFrom("2026-12-14");
  assert.equal(careStatus(p, rules, "2026-12-14", 3).full, 40);
  assert.equal(careStatus(p, rules, "2026-12-16", 3).full, 30);
});

test("care의 모양 — 틀린 값은 버리고, 프로필의 펫에 붙어 다님", () => {
  assert.equal(normalizeCare(null), null);
  assert.equal(normalizeCare({ full: 50 }), null);
  assert.deepEqual(normalizeCare({ full: 150, day: "2026-11-10", kept: "x", away: { on: "2026-11-11", days: ["2026-11-12", "2026-11-12", "bad"], fruit: 2.4 }, back: -3, fed: "x" }),
    { full: 100, day: "2026-11-10", kept: null, away: { on: "2026-11-11", days: ["2026-11-12"], fruit: 2 }, back: 0, fed: null });
  assert.equal("care" in pet(), false);
  assert.deepEqual(pet({ care: { full: 70, day: "2026-11-10", kept: "2026-11-10" } }).care,
    { full: 70, day: "2026-11-10", kept: "2026-11-10", away: null, back: 0, fed: null });
});

test("읽은 날에는 줄지 않음(유지) — 다시 차지는 않음", () => {
  const rules = rulesFrom("2026-11-01");
  // 11-04(수)에 읽음 — 어제까지 셈해 80, 오늘은 유지
  const plan = planCareReadDay({ mirror: pet(), rules, today: "2026-11-04", stage: 3, ok: true });
  assert.equal(plan.event, "kept");
  assert.deepEqual(plan.care, { full: 80, day: "2026-11-03", kept: "2026-11-04", away: null, back: 0, fed: null });
  const p = pet({ care: plan.care });
  assert.equal(careStatus(p, rules, "2026-11-04", 3).keptToday, true);
  assert.equal(careStatus(p, rules, "2026-11-05", 3).full, 80); // 수요일은 안 줄었음
  assert.equal(careStatus(p, rules, "2026-11-06", 3).full, 70); // 목요일은 줄었음
  // 이미 읽은 날이면 다시 적지 않음
  assert.deepEqual(planCareReadDay({ mirror: p, rules, today: "2026-11-04", stage: 3, ok: true }), { care: null, event: null });
  // 그날 기록을 지우거나 줄여 250자 · 5쪽에 못 미치면 풀림
  const undone = planCareReadDay({ mirror: p, rules, today: "2026-11-04", stage: 3, ok: false });
  assert.equal(undone.event, "unkept");
  assert.equal(undone.care.kept, null);
  // 읽지 않은 날의 저장(책 등록 등)은 아무것도 안 바꿈
  assert.deepEqual(planCareReadDay({ mirror: pet(), rules, today: "2026-11-04", stage: 3, ok: false }), { care: null, event: null });
  // 쉬는 날에는 어차피 안 줄어 적지 않음
  assert.deepEqual(planCareReadDay({ mirror: pet(), rules, today: "2026-11-07", stage: 3, ok: true }), { care: null, event: null });
  // 펫 먹이를 끈 반
  assert.deepEqual(planCareReadDay({ mirror: pet(), rules: careRules({}, false), today: "2026-11-04", ok: true }), { care: null, event: null });
});

test("날마다 읽으면 과일 없이도 그대로 — 읽은 날을 이어 가도 지난 '읽은 날'을 잃지 않음", () => {
  const rules = rulesFrom("2026-11-01");
  let p = pet();
  for (const day of ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09", "2026-11-10"]) {
    const plan = planCareReadDay({ mirror: p, rules, today: day, stage: 3, ok: true });
    assert.equal(plan.event, "kept", day);
    p = pet({ care: plan.care });
  }
  assert.equal(careStatus(p, rules, "2026-11-11", 3).full, 100);
});

test("먹이 주기 — 과일 1개에 +10, 100까지만, 알 · 떠난 펫 · 배부른 펫은 안 먹음", () => {
  const rules = rulesFrom("2026-11-01");
  const one = planCareFeed({ mirror: pet(), rules, today: "2026-11-10", stage: 3, fruits: 5, want: 1, now: 1234 });
  assert.equal(one.used, 1);
  assert.deepEqual(one.care, { full: 50, day: "2026-11-09", kept: null, away: null, back: 0, fed: 1234 });
  // 여러 개 — 가진 과일 · 빈 자리 안에서
  assert.equal(planCareFeed({ mirror: pet(), rules, today: "2026-11-10", stage: 3, fruits: 2, want: 9 }).used, 2);
  const fill = planCareFeed({ mirror: pet(), rules, today: "2026-11-10", stage: 3, fruits: 50, want: 50 });
  assert.equal(fill.used, 6);
  assert.equal(fill.care.full, 100);
  // 먹인 뒤에도 그날의 '읽은 날' 표시는 그대로
  const kept = pet({ care: { full: 30, day: "2026-11-09", kept: "2026-11-10" } });
  assert.equal(planCareFeed({ mirror: kept, rules, today: "2026-11-10", stage: 3, fruits: 1 }).care.kept, "2026-11-10");
  const err = (plan) => plan.error?.code;
  assert.equal(err(planCareFeed({ mirror: pet(), rules, today: "2026-11-02", stage: 3, fruits: 5 })), "reading/pet-full");
  assert.equal(err(planCareFeed({ mirror: pet(), rules, today: "2026-11-10", stage: 3, fruits: 0 })), "reading/pet-no-fruit");
  assert.equal(err(planCareFeed({ mirror: egg(), rules, today: "2026-11-10", stage: 1, fruits: 5 })), "reading/pet-egg");
  assert.equal(err(planCareFeed({ mirror: pet(), rules, today: "2026-11-20", stage: 3, fruits: 5 })), "reading/pet-away");
  assert.equal(err(planCareFeed({ mirror: pet(), rules: careRules({}, false), today: "2026-11-10", fruits: 5 })), "reading/pet-feed-disabled");
});

test("과일 1개는 하루치 — 안 읽는 날마다 1개씩 주면 그대로", () => {
  const rules = rulesFrom("2026-11-01");
  let p = pet();
  for (const day of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]) {
    const plan = planCareFeed({ mirror: p, rules, today: day, stage: 3, fruits: 1 });
    assert.equal(plan.care.full, 100, day);
    p = pet({ care: plan.care });
  }
});

test("다시 부르기 — 읽은 날이 한 걸음, 걸음을 채우면 배부름 60으로 같은 펫이 돌아옴", () => {
  const rules = rulesFrom("2026-11-01");
  let p = pet();
  assert.equal(careStatus(p, rules, "2026-11-16", 3).away, true);
  const first = planCareReadDay({ mirror: p, rules, today: "2026-11-16", stage: 3, ok: true });
  assert.equal(first.event, "step");
  assert.deepEqual(first.care.away, { on: "2026-11-14", days: ["2026-11-16"], fruit: 0 });
  p = pet({ care: first.care });
  // 같은 날 또 저장해도 한 걸음
  assert.deepEqual(planCareReadDay({ mirror: p, rules, today: "2026-11-16", stage: 3, ok: true }), { care: null, event: null });
  // 그날 기록을 지우면 걸음도 풀림
  assert.equal(planCareReadDay({ mirror: p, rules, today: "2026-11-16", stage: 3, ok: false }).event, "unstep");
  const second = planCareReadDay({ mirror: p, rules, today: "2026-11-17", stage: 3, ok: true });
  assert.equal(second.event, "step");
  p = pet({ care: second.care });
  assert.deepEqual(careStatus(p, rules, "2026-11-18", 3).steps, { need: 3, done: 2, days: 2, fruit: 0 });
  const third = planCareReadDay({ mirror: p, rules, today: "2026-11-18", stage: 3, ok: true });
  assert.equal(third.event, "returned");
  assert.deepEqual(third.care, { full: 60, day: "2026-11-18", kept: "2026-11-18", away: null, back: 1, fed: null });
  p = pet({ care: third.care });
  assert.equal(p.species, "owl"); // 같은 펫
  assert.equal(careStatus(p, rules, "2026-11-19", 3).full, 60); // 돌아온 날은 세지 않고, 그날 읽었으니 유지
  assert.equal(careStatus(p, rules, "2026-11-20", 3).full, 50);
  // 쉬는 날(주말)에 읽어도 걸음이 됨
  const weekend = planCareReadDay({ mirror: pet(), rules, today: "2026-11-21", stage: 3, ok: true });
  assert.equal(weekend.event, "step");
});

test("다시 부르기 — 과일 2개로 한 걸음, 단계가 높을수록 걸음이 더 듦", () => {
  const rules = rulesFrom("2026-11-01");
  const gone = pet();
  assert.equal(planCareStep({ mirror: gone, rules, today: "2026-11-16", stage: 3, fruits: 1 }).error.code, "reading/pet-no-fruit");
  assert.equal(planCareStep({ mirror: gone, rules, today: "2026-11-10", stage: 3, fruits: 9 }).error.code, "reading/pet-not-away");
  let p = gone;
  let plan = planCareStep({ mirror: p, rules, today: "2026-11-16", stage: 3, fruits: 9 });
  assert.deepEqual([plan.event, plan.used, plan.care.away.fruit], ["step", 2, 1]);
  p = pet({ care: plan.care });
  plan = planCareStep({ mirror: p, rules, today: "2026-11-16", stage: 3, fruits: 7 });
  p = pet({ care: plan.care });
  plan = planCareStep({ mirror: p, rules, today: "2026-11-16", stage: 3, fruits: 5 });
  assert.equal(plan.event, "returned"); // 과일로만 6개
  assert.equal(plan.care.full, 60);
  assert.equal(plan.care.kept, null);
  // 9단계는 다섯 걸음 — 읽은 날 둘 + 과일 걸음 셋
  const big = pet({ care: { full: 0, day: "2026-11-13", kept: null, away: { on: "2026-11-14", days: ["2026-11-16", "2026-11-17"], fruit: 2 } } });
  assert.deepEqual(careStatus(big, rules, "2026-11-18", 9).steps, { need: 5, done: 4, days: 2, fruit: 2 });
  assert.equal(planCareStep({ mirror: big, rules, today: "2026-11-18", stage: 9, fruits: 2 }).event, "returned");
  // 같은 걸음이라도 3단계였으면 이미 다 채운 것 — 다음 걸음에서 돌아옴
  assert.equal(planCareReadDay({ mirror: big, rules, today: "2026-11-18", stage: 3, ok: true }).event, "returned");
});

test("선생님이 불러 주기 — 걸음과 상관없이 돌아옴(곁에 있는 펫은 아님)", () => {
  const rules = rulesFrom("2026-11-01");
  const plan = planCareRecall({ mirror: pet(), rules, today: "2026-11-16", stage: 3 });
  assert.equal(plan.event, "returned");
  assert.deepEqual(plan.care, { full: 60, day: "2026-11-16", kept: null, away: null, back: 1, fed: null });
  assert.equal(planCareRecall({ mirror: pet(), rules, today: "2026-11-10", stage: 3 }).error.code, "reading/pet-not-away");
  assert.equal(planCareRecall({ mirror: pet(), rules: careRules({}, false), today: "2026-11-16" }).error.code, "reading/pet-feed-disabled");
});

test("알 깨우기 — 깨어난 펫은 배부름 100에서, 떠난 알은 먼저 불러야 함", () => {
  const rules = rulesFrom("2026-11-01");
  const warm = egg({ assignedAt: at("2026-11-02") });
  const hatched = planPetAction({ action: "hatch", mirror: warm, secretSpecies: "otter", growthXp: 150, now: at("2026-11-06"), care: rules, today: "2026-11-06" });
  assert.equal(hatched.event, "hatched");
  assert.deepEqual(hatched.mirror.care, { full: 100, day: "2026-11-06", kept: null, away: null, back: 0, fed: null });
  assert.deepEqual(careAfterHatch(warm, rules, "2026-11-06"), hatched.mirror.care);
  // 펫 먹이를 끈 반 — care를 건드리지 않음
  const plain = planPetAction({ action: "hatch", mirror: warm, secretSpecies: "otter", growthXp: 150, now: at("2026-11-06") });
  assert.equal("care" in plain.mirror, false);
  assert.equal(careAfterHatch(warm, careRules({}, false), "2026-11-06"), null);
  // 떠난 알
  const gone = planPetAction({ action: "hatch", mirror: egg(), secretSpecies: "otter", growthXp: 150, now: at("2026-11-16"), care: rules, today: "2026-11-16" });
  assert.equal(gone.error.code, "reading/pet-away");
  // 알을 받을 때는 care를 적지 않음(받은 날부터 100으로 셈)
  const adopted = planPetAction({ action: "adopt", mirror: null, growthXp: 0, now: at("2026-11-06"), care: rules, today: "2026-11-06" });
  assert.equal("care" in adopted.mirror, false);
});

test("'읽은 날' — 그날 날짜의 발자국을 합쳐 5쪽 이상 · 250자 이상", () => {
  const now = new Date(at("2026-11-04"));
  const ctx = (id) => ({ uid: "u", classId: "c", now, id });
  const text = (n) => "가".repeat(n);
  let state = applyReadingAction(initialReadingState(), { type: "addBook", title: "책", author: "지은이", totalPages: 200 }, ctx("book-0001"));
  const add = (id, date, startPage, endPage, notes) => { state = applyReadingAction(state, { type: "addLog", bookId: "book-0001", date, startPage, endPage, notes }, ctx(id)); };
  add("log-0001", "2026-11-03", 1, 10, text(300));
  add("log-0002", "2026-11-04", 11, 13, text(100));
  let proof = readingDayProof(deriveReading(state, now), "2026-11-04");
  assert.deepEqual(proof, { pages: 3, chars: 100, ok: false });
  add("log-0003", "2026-11-04", 14, 15, text(149));
  proof = readingDayProof(deriveReading(state, now), "2026-11-04");
  assert.deepEqual(proof, { pages: 5, chars: 249, ok: false }); // 쪽은 됐는데 글이 1자 모자람
  state = applyReadingAction(state, { type: "updateLog", logId: "log-0003", notes: `  ${text(150)}  ` }, ctx("edit-0001"));
  proof = readingDayProof(deriveReading(state, now), "2026-11-04");
  assert.deepEqual(proof, { pages: 5, chars: 250, ok: true }); // 앞뒤 공백은 안 셈
  // 글은 넉넉한데 쪽이 모자란 날
  add("log-0004", "2026-11-02", 16, 19, text(400));
  assert.equal(readingDayProof(deriveReading(state, now), "2026-11-02").ok, false);
  // 어제 것은 어제 것대로
  assert.deepEqual(readingDayProof(deriveReading(state, now), "2026-11-03"), { pages: 10, chars: 300, ok: true });
  assert.deepEqual(readingDayProof(null, "2026-11-03"), { pages: 0, chars: 0, ok: false });
});

test("순위 장에 적어 둘 care — 보낼 때 반 설정 · 날짜로 '떠났나'를 다시 셈", () => {
  const rules = rulesFrom("2026-11-01");
  const seed = careSeed(pet());
  assert.deepEqual(seed, { joined: null, assignedAt: at("2026-09-01"), care: null });
  assert.equal(careAway(seed, rules, "2026-11-13"), false);
  assert.equal(careAway(seed, rules, "2026-11-14"), true);
  const away = careSeed(pet({ care: { full: 0, day: "2026-11-13", kept: null, away: { on: "2026-11-14", days: ["2026-11-16"], fruit: 1 } } }));
  assert.deepEqual(away.care, { full: 0, day: "2026-11-13", kept: null, away: { on: "2026-11-14" } });
  assert.equal(careAway(away, rules, "2026-11-17"), true);
  assert.equal(careAway(away, careRules({}, false), "2026-11-17"), false); // 펫 먹이를 끈 반에서는 늘 곁에
  assert.equal(careSeed(null), null);
  // 반에 들어온 때도 함께 적어 둠(ms) — 보낼 때 그날부터 셈
  const late = careSeed(pet(), { toMillis: () => at("2026-11-10") });
  assert.equal(late.joined, at("2026-11-10"));
  assert.equal(careAway(late, rules, "2026-11-14"), true); // 들어온 날을 안 보면 떠난 것으로 셈
  assert.equal(careAway(late, careRulesFor(rules, late.joined), "2026-11-14"), false);
});

test("반에 들어온 날부터 셈 — 미리 만들어 둔 반에 나중에 들어온 학생은 그 사이의 날을 세지 않음", () => {
  const cls = { petFeedFrom: at("2026-09-01") };
  // 9월 1일에 켠 반에 11월 10일(화)에 들어옴 — 들어온 날은 세지 않고 다음 날부터
  const late = careRules(cls, true, at("2026-11-10"));
  assert.equal(late.from, "2026-11-10");
  // 켜기 전부터 있던 학생은 켠 날부터 · 들어온 때를 모르면(옛 소속 문서) 그대로
  assert.equal(careRules(cls, true, at("2026-08-20")).from, "2026-09-01");
  assert.equal(careRules(cls, true, null).from, "2026-09-01");
  assert.equal(careRules(cls, true).from, "2026-09-01");
  // 켠 날을 모르는 반은 들어온 날이 있어도 세지 않음
  assert.equal(careRules({}, true, at("2026-11-10")).from, null);
  // 때의 모양 — ms 수 · Date · Firestore의 Timestamp(toMillis) · { seconds }
  const ms = at("2026-11-10");
  for (const shape of [ms, new Date(ms), { toMillis: () => ms }, { seconds: ms / 1000, nanoseconds: 0 }]) {
    assert.equal(careRulesFor(rulesFrom("2026-09-01"), shape).from, "2026-11-10");
  }
  assert.equal(careRulesFor(rulesFrom("2026-09-01"), "어제").from, "2026-09-01");
  assert.equal(careRulesFor(rulesFrom("2026-09-01"), 0).from, "2026-09-01");
  assert.equal(careRulesFor(null, ms), null);
  assert.equal(petCareRules({ readingEnabled: true, petFeedEnabled: true, ...cls }, ms).from, "2026-11-10");
  // 주말 · 기간 같은 다른 칸은 그대로
  const base = rulesFrom("2026-09-01", { petRestWeekend: false, petRests: [{ kind: "exam", from: "2026-12-08", to: "2026-12-11" }] });
  assert.deepEqual({ ...careRulesFor(base, ms), from: null }, { ...base, from: null });

  // 다른 반에서 옮겨 온 학생의 펫(care 없음 · 9월에 받음) — 들어온 날을 안 보면 들어오자마자 떠나 있음
  const moved = pet();
  assert.equal(careStatus(moved, rulesFrom("2026-09-01"), "2026-11-12").away, true);
  const mine = careStatus(moved, late, "2026-11-12");
  assert.equal(mine.away, false);
  assert.equal(mine.full, 90); // 11일 하루만 지남(10일은 들어온 날)
  assert.equal(careStatus(moved, late, "2026-11-10").full, 100); // 들어온 날
  // 옛 반에서 적힌 care(배부름 40 · 10월 30일까지 셈)를 들고 온 학생 — 사이의 날은 건너뛰고 40에서 이어 감
  const carried = pet({ care: { full: 40, day: "2026-10-30", kept: null, away: null } });
  assert.equal(careStatus(carried, rulesFrom("2026-09-01"), "2026-11-12").away, true);
  const kept = careStatus(carried, late, "2026-11-12");
  assert.deepEqual([kept.away, kept.full, kept.hungry], [false, 30, true]);
  // 떠난 채로 옮겨 온 펫은 떠난 채 — 새 반에서 걸음을 채워 부름(들어온 날이 떠남을 지우지는 않음)
  const gone = pet({ care: { full: 0, day: "2026-10-30", kept: null, away: { on: "2026-10-31", days: [], fruit: 0 } } });
  assert.equal(careStatus(gone, late, "2026-11-12").away, true);
});

test("꾸며 적은 '들어온 날' — 서버가 오늘을 넘기면 내일보다 뒤의 날은 믿지 않음(화면은 그대로 믿음)", () => {
  const rules = rulesFrom("2026-09-01");
  const today = "2026-11-12";
  // 지난 날 · 오늘 · 내일(서버끼리의 시계 차이)은 그대로
  assert.equal(careRulesFor(rules, at("2026-11-10"), today).from, "2026-11-10");
  assert.equal(careRulesFor(rules, at("2026-11-12"), today).from, "2026-11-12");
  assert.equal(careRulesFor(rules, at("2026-11-13"), today).from, "2026-11-13");
  // 모레부터는 꾸민 값 — 모르는 것으로 보아 켠 날부터 셈
  assert.equal(careRulesFor(rules, at("2026-11-14"), today).from, "2026-09-01");
  assert.equal(careRulesFor(rules, at("2099-01-01"), today).from, "2026-09-01");
  // 꾸민 값으로는 펫을 지키지 못함 — 걸러 내지 않으면 2099년까지 아무 날도 세지 않아 늘 100
  assert.equal(careStatus(pet(), careRulesFor(rules, at("2099-01-01")), today).full, 100);
  assert.equal(careStatus(pet(), careRulesFor(rules, at("2099-01-01"), today), today).away, true);
  // today를 넘기지 않는 화면은 그대로 믿음(기기 시계가 틀린 PC에서 멀쩡한 펫이 떠나 보이지 않게 — 적는 것은 서버)
  assert.equal(careRulesFor(rules, at("2099-01-01")).from, "2099-01-01");
  assert.equal(careRulesFor(rules, at("2099-01-01"), "오늘").from, "2099-01-01"); // 틀린 today는 없는 것으로
  // careRules · petCareRules도 같은 값을 넘겨받음
  assert.equal(careRules({ petFeedFrom: at("2026-09-01") }, true, at("2099-01-01"), today).from, "2026-09-01");
  assert.equal(careRules({ petFeedFrom: at("2026-09-01") }, true, at("2026-11-10"), today).from, "2026-11-10");
  assert.equal(petCareRules({ readingEnabled: true, petFeedEnabled: true, petFeedFrom: at("2026-09-01") }, at("2099-01-01"), today).from, "2026-09-01");
});
