import { test } from "node:test";
import assert from "node:assert/strict";
import { suspendInGroup, resumeInGroup, suspendInBase, resumeInBase } from "@/lib/suspendGroups";

test("활동 모둠 — 빼서 suspendedUids로, 다시 사용하면 돌려놓음 · 혼자 쓰던 판은 그대로", () => {
  const g = { memberUids: ["a", "b"], members: [{ uid: "a", name: "가" }, { uid: "b", name: "나" }] };
  const out = suspendInGroup(g, "a");
  assert.deepEqual(out.memberUids, ["b"]);
  assert.deepEqual(out.members, [{ uid: "b", name: "나" }]);
  assert.deepEqual(out.suspendedUids, ["a"]);
  assert.deepEqual(out.suspendedMembers, [{ uid: "a", name: "가" }]);
  const back = resumeInGroup({ ...g, ...out }, "a");
  assert.deepEqual(back.memberUids, ["b", "a"]);
  assert.deepEqual(back.members.map((m) => m.name), ["나", "가"]);
  assert.deepEqual(back.suspendedUids, []);
  assert.equal(suspendInGroup({ memberUids: ["a"] }, "a"), null);
  assert.equal(suspendInGroup(g, "z"), null);
  assert.equal(resumeInGroup(g, "a"), null);
});

test("기본 모둠 — 빼고 자리를 적어 두었다가 그 모둠으로 돌려놓음", () => {
  const doc = { groups: [{ name: "1모둠", memberUids: ["a"], members: [{ uid: "a" }] }, { name: "2모둠", memberUids: ["b", "c"], members: [{ uid: "b" }, { uid: "c", name: "다" }] }] };
  const out = suspendInBase(doc, "c");
  assert.deepEqual(out.groups[1].memberUids, ["b"]);
  assert.deepEqual(out.suspendedPlacements, [{ uid: "c", groupIndex: 1, member: { uid: "c", name: "다" } }]);
  const back = resumeInBase({ ...doc, ...out }, "c");
  assert.deepEqual(back.groups[1].memberUids, ["b", "c"]);
  assert.deepEqual(back.suspendedPlacements, []);
  // 그 사이 모둠 수가 줄었으면 자리만 지움
  assert.deepEqual(resumeInBase({ groups: [doc.groups[0]], suspendedPlacements: out.suspendedPlacements }, "c").groups, [doc.groups[0]]);
  assert.equal(suspendInBase(doc, "z"), null);
  assert.equal(resumeInBase(doc, "c"), null);
});
