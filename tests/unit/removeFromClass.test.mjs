// 반에서 빼기 · 탈퇴가 함께 쓰는 셈 — 모둠 · 자리표에서 학생 한 명 빼기(lib/removeFromClass.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { activityGroupWithout, baseGroupsWithout, seatsWithout } from "@/lib/removeFromClass";
import { resumeInBase, suspendInBase, suspendInGroup } from "@/lib/suspendGroups";

test("기본 모둠 — 그 학생만 빼고 다른 모둠은 그대로", () => {
  const g1 = { name: "1모둠", memberUids: ["a", "b"], members: [{ uid: "a" }, { uid: "b", name: "나" }] };
  const g2 = { name: "2모둠", memberUids: ["c"], members: [{ uid: "c" }] };
  const out = baseGroupsWithout({ groups: [g1, g2] }, "a");
  assert.deepEqual(out.groups[0].memberUids, ["b"]);
  assert.deepEqual(out.groups[0].members, [{ uid: "b", name: "나" }]);
  assert.equal(out.groups[0].name, "1모둠");
  assert.equal(out.groups[1], g2); // 손대지 않은 모둠은 같은 것
  assert.equal("suspendedPlacements" in out, false); // 적어 둔 자리가 없으면 그 칸을 안 씀
  assert.equal(baseGroupsWithout({ groups: [g1, g2] }, "z"), null);
  assert.equal(baseGroupsWithout(null, "a"), null);
  assert.equal(baseGroupsWithout({ groups: [g1] }, ""), null);
});

test("기본 모둠 — 사용 중지로 빠져 있던 학생은 돌려놓을 자리도 지워, 다시 사용해도 이 반 모둠에 안 돌아옴", () => {
  const doc = { groups: [{ memberUids: ["a", "b"], members: [{ uid: "a" }, { uid: "b" }] }] };
  const suspended = { ...doc, ...suspendInBase(doc, "a") };
  assert.equal(suspended.suspendedPlacements.length, 1);
  const out = baseGroupsWithout(suspended, "a");
  assert.deepEqual(out.suspendedPlacements, []);
  assert.deepEqual(out.groups[0].memberUids, ["b"]);
  assert.equal(resumeInBase({ ...suspended, ...out }, "a"), null);
});

test("기본 모둠 — memberUids와 members가 어긋난 옛 문서도 둘 다에서 뺌", () => {
  const out = baseGroupsWithout({ groups: [{ memberUids: ["b"], members: [{ uid: "a" }, { uid: "b" }] }] }, "a");
  assert.deepEqual(out.groups[0].members, [{ uid: "b" }]);
  assert.deepEqual(out.groups[0].memberUids, ["b"]);
});

test("활동 모둠 — 함께 쓰는 모둠에서는 빼고, 혼자 쓰던 판(그 학생의 기록)은 그대로", () => {
  const g = { memberUids: ["a", "b"], members: [{ uid: "a" }, { uid: "b" }] };
  assert.deepEqual(activityGroupWithout(g, "a"), { memberUids: ["b"], members: [{ uid: "b" }] });
  assert.equal(activityGroupWithout({ memberUids: ["a"], members: [{ uid: "a" }] }, "a"), null);
  assert.equal(activityGroupWithout(g, "z"), null);
});

test("활동 모둠 — 사용 중지로 옮겨 둔 자리(suspendedUids)에서도 뺌", () => {
  const g = { memberUids: ["a", "b", "c"], members: [{ uid: "a" }, { uid: "b" }, { uid: "c" }] };
  const suspended = { ...g, ...suspendInGroup(g, "a") };
  const out = activityGroupWithout(suspended, "a");
  assert.deepEqual(out, { suspendedUids: [], suspendedMembers: [] }); // 이미 명단 밖 — 옮겨 둔 자리만
  // 다른 학생을 빼면 옮겨 둔 자리는 건드리지 않음
  assert.deepEqual(activityGroupWithout(suspended, "b"), { memberUids: ["c"], members: [{ uid: "c" }] });
});

test("자리표 — 그 자리만 빈자리로, 앉아 있지 않으면 null", () => {
  assert.deepEqual(seatsWithout(["a", null, "b", "a"], "a"), [null, null, "b", null]);
  assert.equal(seatsWithout(["b", null], "a"), null);
  assert.equal(seatsWithout(null, "a"), null);
  assert.equal(seatsWithout(["a"], ""), null);
});
