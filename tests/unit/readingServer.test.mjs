import { test } from "node:test";
import assert from "node:assert/strict";
import { assertReadingAccess, readingClassId, readingPeriodBounds, readingPeriodXp, sortReadingRankings } from "@/lib/server/readingPolicy";

const student = { uid: "s1", profile: { role: "student" }, classDoc: { id: "a", readingEnabled: true }, membership: { uid: "s1", classId: "a" } };

test("reading server: default-off, archived classes and other-class membership stay denied", () => {
  assert.doesNotThrow(() => assertReadingAccess(student));
  for (const patch of [
    { classDoc: { id: "a" } },
    { classDoc: { id: "a", readingEnabled: false } },
    { classDoc: { id: "a", readingEnabled: true, archived: true } },
    { membership: null },
    { membership: { uid: "s1", classId: "b" } },
    { membership: { uid: "s2", classId: "a" } },
  ]) assert.throws(() => assertReadingAccess({ ...student, ...patch }), (e) => e.status === 403);
});

test("reading server: only own-class teacher or administrator, and neither bypasses feature-off", () => {
  const teacher = { ...student, uid: "teacher", profile: { role: "teacher" }, classDoc: { id: "a", createdBy: "teacher", readingEnabled: true }, membership: null };
  assert.doesNotThrow(() => assertReadingAccess(teacher));
  assert.throws(() => assertReadingAccess({ ...teacher, uid: "another" }), (e) => e.status === 403);
  assert.doesNotThrow(() => assertReadingAccess({ ...teacher, uid: "admin", roleClaim: "admin" }));
  assert.throws(() => assertReadingAccess({ ...teacher, roleClaim: "admin", classDoc: { ...teacher.classDoc, readingEnabled: false } }), (e) => e.code === "reading/disabled");
});

test("reading server: class IDs cannot inject paths", () => {
  for (const id of [undefined, "", "a/b", "..", 1, "a".repeat(129)]) assert.throws(() => readingClassId(id));
  assert.equal(readingClassId("class_Abc-123"), "class_Abc-123");
});

test("reading server: KST midnight, month and Monday period boundaries", () => {
  assert.deepEqual(readingPeriodBounds("daily", "2026-11-01T14:59:59Z"), { start: "2026-11-01", end: "2026-11-01" });
  assert.deepEqual(readingPeriodBounds("weekly", "2026-11-01T15:00:00Z"), { start: "2026-11-02", end: "2026-11-02" });
  assert.deepEqual(readingPeriodBounds("monthly", "2026-10-31T15:00:00Z"), { start: "2026-11-01", end: "2026-11-01" });
  assert.throws(() => readingPeriodBounds("yearly"));
});

test("reading server: dated snapshot scores roll into new periods without a fresh write", () => {
  const events = [{ date: "2026-11-01", xp: 70 }, { date: "2026-11-02", xp: 5 }, { date: "2026-11-10", xp: 100 }];
  assert.equal(readingPeriodXp(events, "weekly", "2026-11-02T00:00:00Z"), 5);
  assert.equal(readingPeriodXp(events, "daily", "2026-11-03T00:00:00Z"), 0);
  assert.equal(readingPeriodXp(events, "all-time", "2026-11-02T00:00:00Z"), 75);
});

test("reading server: ranks include every member, share ties, and use stable ordering", () => {
  const ranked = sortReadingRankings([
    { uid: "new", xp: 1000, studentId: "103" },
    { uid: "older", xp: 2, studentId: "101" },
    { uid: "same", xp: 1000, studentId: "102" },
  ]);
  assert.deepEqual(ranked.map((r) => [r.uid, r.rank]), [["same", 1], ["new", 1], ["older", 3]]);
});
