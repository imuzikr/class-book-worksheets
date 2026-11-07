import { test } from "node:test";
import assert from "node:assert/strict";
import { membersPatched, namePatchFor } from "../../lib/nameFields.js";

test("기록 한 장 — 그 학생을 가리키는 이름표만 바꾼다", () => {
  assert.deepEqual(namePatchFor({ authorId: "s1", authorName: "옛이름" }, "s1", "새이름", "30101"), { authorName: "새이름" });
  assert.deepEqual(namePatchFor({ fromUid: "s2", toUid: "s1", fromName: "가", toName: "옛" }, "s1", "새", null), { toName: "새" });
  assert.deepEqual(namePatchFor({ userId: "s1", authorName: "옛" }, "s1", "새", null), { authorName: "새" });
  assert.deepEqual(namePatchFor({ authorId: "s1", authorName: "같음" }, "s1", "같음", null), {});
  assert.deepEqual(namePatchFor({ authorId: "s1", authorName: "선생님", byTeacher: true }, "s1", "새", null), {});
  assert.deepEqual(namePatchFor({ fromUid: "s1", fromName: "선생님", fromRole: "teacher" }, "s1", "새", null), {});
});

test("학번은 withSid일 때만, 칸이 있을 때만", () => {
  assert.deepEqual(namePatchFor({ uid: "s1", name: "가", studentId: "1" }, "s1", "가", "2", { withSid: true }), { studentId: "2" });
  assert.deepEqual(namePatchFor({ uid: "s1", name: "가", studentId: "1" }, "s1", "가", "2"), {});
  assert.deepEqual(namePatchFor({ uid: "s1", name: "가" }, "s1", "가", "2", { withSid: true }), {});
});

test("모둠 명단 — 그 학생만 바꾸고, 바꿀 것이 없으면 null", () => {
  const m = [{ uid: "s1", name: "옛", studentId: "1", emoji: "🦦" }, { uid: "s2", name: "친구" }];
  const next = membersPatched(m, "s1", "새", "2");
  assert.deepEqual(next[0], { uid: "s1", name: "새", studentId: "2", emoji: "🙂" });
  assert.equal(next[1], m[1]);
  assert.equal(membersPatched([{ uid: "s1", name: "새", studentId: "2", emoji: "🙂" }], "s1", "새", "2"), null);
  assert.equal(membersPatched(null, "s1", "새", "2"), null);
});
