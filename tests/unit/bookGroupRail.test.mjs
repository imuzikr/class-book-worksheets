import { test } from "node:test";
import assert from "node:assert/strict";
import { bookGroupRailGroups, UNASSIGNED_GROUP_ID } from "@/lib/bookGroupRail";

test("모둠 배정 순서를 따르고 이름과 작성 내용은 현재 카드에서 가져온다", () => {
  const currentA = { uid: "a", name: "현재 이름", entry: { title: "현재 글" } };
  const currentB = { uid: "b", name: "나", entry: { title: "새 글" } };
  const groups = [{
    id: "second", groupIndex: 2, groupName: "책 친구",
    memberUids: ["b", "a", "former"],
    members: [{ uid: "a", name: "옛 이름", entry: { title: "옛 글" } }, { uid: "former" }],
  }];

  const rail = bookGroupRailGroups(groups, [currentA, currentB]);
  assert.deepEqual(rail, [{ id: "second", name: "책 친구", members: [currentB, currentA] }]);
  assert.equal(rail[0].members[0], currentB);
  assert.equal(rail[0].members[1], currentA);
});

test("새 배정과 카드 구독 결과로 다시 계산하면 이전 모둠원과 글이 남지 않는다", () => {
  const oldA = { uid: "a", entry: { title: "이전 글" } };
  const initialGroups = [{ id: "one", memberUids: ["a"] }, { id: "two", memberUids: ["b"] }];
  const initial = bookGroupRailGroups(initialGroups, [oldA, { uid: "b" }]);
  const newA = { uid: "a", entry: { title: "수정한 글" } };
  const newC = { uid: "c", name: "새 학생" };
  const updated = bookGroupRailGroups([
    { id: "one", memberUids: ["b"], members: [oldA] },
    { id: "two", memberUids: ["a", "c"] },
  ], [newA, newC]);

  assert.deepEqual(updated.map((group) => group.members.map((card) => card.uid)), [[], ["a", "c"]]);
  assert.equal(updated[1].members[0], newA);
  assert.equal(initial[0].members[0], oldA);
});

test("memberUids 배열은 빈 배열도 권위가 있고 없을 때만 members 명단을 쓴다", () => {
  const cards = [{ uid: "a" }, { uid: "b" }, { uid: "c" }];
  const rail = bookGroupRailGroups([
    { id: "empty", groupIndex: 4, memberUids: [], members: [{ uid: "a" }] },
    { id: "legacy", groupIndex: 2, members: [{ uid: "c" }, { uid: "b" }] },
  ], cards);

  assert.deepEqual(rail, [
    { id: "empty", name: "4모둠", members: [] },
    { id: "legacy", name: "2모둠", members: [cards[2], cards[1]] },
    { id: UNASSIGNED_GROUP_ID, name: "모둠 배정 대기", members: [cards[0]] },
  ]);
});

test("폐기된 모둠에만 배정되었거나 배정이 없는 학생은 대기 모둠에 남는다", () => {
  const cards = [{ uid: "retired-only" }, { uid: "waiting" }, { uid: "live" }];
  const rail = bookGroupRailGroups([
    { id: "retired", retired: true, memberUids: ["retired-only", "live"] },
    { id: "live", groupIndex: 3, memberUids: ["live"] },
  ], cards);

  assert.deepEqual(rail, [
    { id: "live", name: "3모둠", members: [cards[2]] },
    { id: "__none", name: "모둠 배정 대기", members: [cards[0], cards[1]] },
  ]);
});

test("중복 uid는 첫 현재 카드와 첫 현재 모둠을 쓰며 빈 모둠과 구독 순서를 유지한다", () => {
  const firstA = { uid: "a", name: "첫 카드" };
  const firstB = { uid: "b" };
  const rail = bookGroupRailGroups([
    { id: "later-index", groupIndex: 9, memberUids: ["a", "a", "missing", null] },
    { id: "empty", groupIndex: 1, memberUids: ["a"] },
    { id: "earlier-index", groupIndex: 2, memberUids: ["b", "a", "b"] },
  ], [firstA, { uid: "a", name: "중복 카드" }, firstB, null, {}, { uid: "" }]);

  assert.deepEqual(rail, [
    { id: "later-index", name: "9모둠", members: [firstA] },
    { id: "empty", name: "1모둠", members: [] },
    { id: "earlier-index", name: "2모둠", members: [firstB] },
  ]);
});

test("모둠이 없어도 현재 카드를 한 번씩 대기 모둠에 놓고 카드가 없으면 빈 목록이다", () => {
  const cards = [{ uid: "b" }, { uid: "a" }];
  assert.deepEqual(bookGroupRailGroups(), []);
  assert.deepEqual(bookGroupRailGroups([], cards), [
    { id: UNASSIGNED_GROUP_ID, name: "모둠 배정 대기", members: cards },
  ]);
  assert.deepEqual(bookGroupRailGroups([{ id: "empty" }]), [
    { id: "empty", name: "1모둠", members: [] },
  ]);
});

test("원본 모둠과 카드 및 안쪽 배열을 바꾸지 않는다", () => {
  const card = Object.freeze({ uid: "a", entry: Object.freeze({ title: "글" }) });
  const cards = Object.freeze([card]);
  const members = Object.freeze([Object.freeze({ uid: "stale", name: "옛 학생" })]);
  const memberUids = Object.freeze(["a", "a"]);
  const groups = Object.freeze([Object.freeze({ id: "one", memberUids, members })]);
  const before = structuredClone({ groups, cards });

  const rail = bookGroupRailGroups(groups, cards);
  assert.deepEqual({ groups, cards }, before);
  assert.equal(rail[0].members[0], card);
  assert.notEqual(rail[0].members, memberUids);
  assert.notEqual(rail[0].members, cards);
});
