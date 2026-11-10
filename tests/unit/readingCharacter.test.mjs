import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveReading, initialReadingState, READING_FORMULA } from "../../lib/reading.js";
import { memberSnapshot, memberStats } from "../../lib/readingJourney.js";
import { CHARACTER_STYLES, characterChoiceEnabled, hasCurrentReadingSnapshot, normalizeReadingCharacter } from "../../lib/readingCharacter.js";

test("journey appearance accepts only a known numbered character and outfit", () => {
  assert.deepEqual(CHARACTER_STYLES, ["zodiac", "animal", "fantasy"]);
  for (const style of CHARACTER_STYLES) {
    for (let number = 1; number <= 10; number += 1) {
      assert.deepEqual(normalizeReadingCharacter({ number, style }), { number, style });
    }
  }
  for (const value of [null, undefined, [], "1", {}, { number: 1 },
    { number: "1", style: "fantasy" }, { number: 1.5, style: "fantasy" },
    { number: 0, style: "zodiac" }, { number: 11, style: "zodiac" }, { number: 11, style: "advanced" },
    { number: 1, style: "unknown" }, { number: 1, style: "../zodiac" }, { number: 1, style: "../beginner" },
    { number: 1, style: "beginner/../../advanced" }, { number: 1, style: ["beginner"] }, { number: 1, style: ["zodiac"] },
    { number: 1, style: "__proto__" }, { number: 1, style: "constructor" }, { number: 1, style: "toString" },
    { number: 1, style: "zodiac", xp: 1000 }, { number: 1, style: "advanced", role: "admin" },
    Object.assign(Object.create({ number: 1 }), { style: "zodiac" })]) {
    assert.equal(normalizeReadingCharacter(value), null, JSON.stringify(value));
  }
  const original = { number: 1, style: "zodiac" };
  assert.notEqual(normalizeReadingCharacter(original), original);
});

test("묶음을 바꾸기 전에 저장된 옛 열쇠는 같은 모습의 새 열쇠로 옮겨 읽는다", () => {
  for (let number = 1; number <= 10; number += 1) {
    // 판타지 그림(옛 초급)은 그대로 판타지(지금 영웅)
    assert.deepEqual(normalizeReadingCharacter({ number, style: "beginner" }), { number, style: "fantasy" });
    // 동물(옛 중급)은 그대로(지금 무도가)
    assert.deepEqual(normalizeReadingCharacter({ number, style: "intermediate" }), { number, style: "animal" });
    // 옛 고급(11월 9일부터 십이지 그림이 들어 있던 자리)은 같은 번호의 십이지(지금 수련생) — 쥐는 쥐, 용은 용
    assert.deepEqual(normalizeReadingCharacter({ number, style: "advanced" }), { number, style: "zodiac" });
  }
});

const snapshot = () => {
  const summary = deriveReading(initialReadingState(), new Date("2026-11-07T03:00:00Z"));
  return { ...memberSnapshot(summary), level: summary.level, formula: READING_FORMULA, events: [] };
};

test("same-formula legacy snapshots still need canonical global XP and badges", () => {
  const good = snapshot();
  assert.equal(hasCurrentReadingSnapshot(good), true);
  assert.equal(hasCurrentReadingSnapshot({ ...good, formula: READING_FORMULA - 1 }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, totalXp: null }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, totalXp: "0" }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, totalXp: NaN }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, totalXp: -1 }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, level: 5 }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, badges: ["unknown"] }), false);
  assert.equal(hasCurrentReadingSnapshot({ ...good, badges: null }), false);
  for (const field of ["totalXp", "badges", "lastReadDate", "totalPages"]) {
    const old = { ...good };
    delete old[field];
    assert.equal(hasCurrentReadingSnapshot(old), false, field);
  }
});

test("unknown public numeric statistics do not become zero XP or zero pages", () => {
  for (const totalXp of [null, undefined, "0", NaN, -1]) {
    assert.equal(memberStats({ totalXp }, "2026-11-07").totalXp, null);
  }
  assert.equal(memberStats({ totalXp: 0 }, "2026-11-07").totalXp, 0);
  assert.equal(memberStats({ totalXp: 2000 }, "2026-11-07").totalXp, 2000);
});

test("학생 캐릭터 스위치 — 값이 없으면 켜짐, 끈 반만 false", () => {
  assert.equal(characterChoiceEnabled({}), true);
  assert.equal(characterChoiceEnabled(null), true);
  assert.equal(characterChoiceEnabled({ characterEnabled: true }), true);
  assert.equal(characterChoiceEnabled({ characterEnabled: false }), false);
});
