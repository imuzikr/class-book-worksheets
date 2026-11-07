import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveReading, initialReadingState, READING_FORMULA } from "../../lib/reading.js";
import { memberSnapshot, memberStats } from "../../lib/readingJourney.js";
import { hasCurrentReadingSnapshot, normalizeReadingCharacter } from "../../lib/readingCharacter.js";

test("journey appearance accepts only a known numbered character and outfit", () => {
  for (const style of ["intermediate", "advanced"]) {
    for (let number = 1; number <= 10; number += 1) {
      assert.deepEqual(normalizeReadingCharacter({ number, style }), { number, style });
    }
  }
  for (const value of [null, undefined, [], "1", {}, { number: 1 },
    { number: "1", style: "advanced" }, { number: 1.5, style: "advanced" },
    { number: 0, style: "advanced" }, { number: 11, style: "advanced" },
    { number: 1, style: "unknown" }, { number: 1, style: "advanced", role: "admin" }]) {
    assert.equal(normalizeReadingCharacter(value), null, JSON.stringify(value));
  }
  const original = { number: 1, style: "advanced" };
  assert.notEqual(normalizeReadingCharacter(original), original);
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
  for (const field of ["totalXp", "badges", "lastReadDate", "totalPages", "fruitCount"]) {
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
