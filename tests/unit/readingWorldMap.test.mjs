import { test } from "node:test";
import assert from "node:assert/strict";
import { getExpForReadingLevel } from "../../lib/reading.js";
import {
  WORLD_MAP, WORLD_LEVEL_STOPS, WORLD_REGIONS, WORLD_CHARACTERS,
  worldProgress, worldPoint, worldCheckpoints, groupWorldTravelers, defaultWorldAvatar, readingLeaderUids, splitWorldLeaderGroups,
} from "../../lib/readingWorldMap.js";

const near = (actual, expected, epsilon = 1e-10) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≈ ${expected}`);

test("독서 대장은 학급의 검증된 최고 레벨 중 누적 경험치가 가장 많은 학생이다", () => {
  const rows = [
    { uid: "lower", totalXp: 249, level: 2, xp: 99999, allTimeXp: 99999 },
    { uid: "leader", totalXp: 485, level: 3, xp: 0, allTimeXp: 0 },
    { uid: "same-level", totalXp: 435, level: 3, xp: 88888, allTimeXp: 88888 },
    { uid: "unknown", level: 100, xp: 999999, allTimeXp: 999999 },
  ];
  assert.deepEqual(readingLeaderUids(rows), ["leader"]);
  // A later chapter is eligible even while the UI is viewing an earlier map.
  assert.deepEqual(readingLeaderUids([...rows, { uid: "next-chapter", totalXp: 11393, level: 11 }]), ["next-chapter"]);
});

test("최고 레벨과 누적 경험치가 완전히 같으면 공동 대장이며 입력 순서와 중복은 결과를 바꾸지 않는다", () => {
  const rows = Object.freeze([
    Object.freeze({ uid: "z", totalXp: 712, level: 4 }),
    Object.freeze({ uid: "a", totalXp: 712, level: 4 }),
    Object.freeze({ uid: "other", totalXp: 705, level: 4 }),
    Object.freeze({ uid: "a", totalXp: 712, level: 4 }),
  ]);
  assert.deepEqual(readingLeaderUids(rows), ["a", "z"]);
  assert.deepEqual(readingLeaderUids(rows.slice().reverse()), ["a", "z"]);
  assert.ok(rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "world")));
});

test("집계 대기·잘못된 EXP·불일치 레벨은 독서 대장으로 추정하지 않는다", () => {
  const invalidRows = [
    null, {}, { uid: "missing-level", totalXp: 712 },
    { uid: "stale-level", totalXp: 712, level: 99 },
    { uid: "text-level", totalXp: 712, level: "4" },
    { uid: "", totalXp: 712, level: 4 },
    { uid: "   ", totalXp: 712, level: 4 },
    { uid: {}, totalXp: 712, level: 4 },
    { uid: NaN, totalXp: 712, level: 4 },
    ...[null, undefined, "712", NaN, Infinity, -1, false].map((totalXp, index) => ({ uid: `invalid-${index}`, totalXp, level: 4 })),
  ];
  for (const rows of [undefined, null, {}, [], invalidRows]) assert.deepEqual(readingLeaderUids(rows), []);
  assert.deepEqual(readingLeaderUids([...invalidRows, { uid: "valid-zero", totalXp: 0, level: 1 }]), ["valid-zero"]);
});

test("대장은 EXP 갱신·정정과 학급 구성에 따라 다시 계산하고 최고 레벨에서도 EXP로 구분한다", () => {
  const rows = [{ uid: "first", totalXp: 485, level: 3 }, { uid: "second", totalXp: 435, level: 3 }];
  assert.deepEqual(readingLeaderUids(rows), ["first"]);
  assert.deepEqual(readingLeaderUids([rows[0], { ...rows[1], totalXp: 500, level: 4 }]), ["second"]);
  assert.deepEqual(readingLeaderUids([{ ...rows[0], totalXp: 400 }, rows[1]]), ["second"]);
  assert.deepEqual(readingLeaderUids([rows[1]]), ["second"]);
  const maxXp = getExpForReadingLevel(100);
  assert.deepEqual(readingLeaderUids([{ uid: "at-max", totalXp: maxXp, level: 100 }, { uid: "above-max", totalXp: maxXp * 2, level: 100 }]), ["above-max"]);
});

test("근접 모임에서 다른 학생을 선택해도 공동 대장이 숨거나 대장 표시를 빌려주지 않는다", () => {
  const rows = [
    { uid: "peer-a", totalXp: 435, level: 3 }, { uid: "peer-b", totalXp: 445, level: 3 },
    { uid: "leader-a", totalXp: 485, level: 3 }, { uid: "leader-b", totalXp: 485, level: 3 },
  ];
  const original = groupWorldTravelers(rows, { selectedUid: "peer-b", epsilon: 0.02 })[0];
  const [leaders, peers] = splitWorldLeaderGroups([original], readingLeaderUids(rows), "peer-b");
  assert.equal(leaders.id, `${original.id}:leaders`);
  assert.equal(peers.id, `${original.id}:peers`);
  assert.deepEqual(leaders.members.map((row) => row.uid), ["leader-a", "leader-b"]);
  assert.deepEqual(peers.members.map((row) => row.uid), ["peer-a", "peer-b"]);
  assert.equal(leaders.representative.uid, "leader-a");
  assert.equal(leaders.isLeader, true);
  assert.equal(peers.representative.uid, "peer-b");
  assert.equal(peers.isLeader, false);
  assert.equal(leaders.progress, worldProgress(485).progress);
  assert.equal(peers.progress, original.progress);
  assert.equal(peers.leaderProgress, leaders.progress);
  const selectedLeader = splitWorldLeaderGroups([original], new Set(readingLeaderUids(rows)), "leader-b");
  assert.equal(selectedLeader[0].representative.uid, "leader-b");
  assert.equal(selectedLeader[1].representative.uid, "peer-a");
});

test("대장 슬롯 ID·진도·멤버 순서는 선택 학생과 원본 배열 순서에 무관하다", () => {
  const rows = [
    { uid: "peer", totalXp: 435, level: 3 },
    { uid: "leader-b", totalXp: 485, level: 3 }, { uid: "leader-a", totalXp: 485, level: 3 },
    { uid: "start", totalXp: 0, level: 1 },
  ];
  const snapshot = (values) => values.map(({ id, progress, members, isLeader, leaderProgress }) => ({
    id, progress, members: members.map((member) => member.uid), isLeader, leaderProgress,
  }));
  const expected = snapshot(splitWorldLeaderGroups(groupWorldTravelers(rows, { epsilon: 0.02 }), readingLeaderUids(rows)));
  for (const input of [rows, rows.slice().reverse()]) {
    for (const selectedUid of ["peer", "leader-a", "leader-b", "start", null]) {
      const groups = groupWorldTravelers(input, { selectedUid, epsilon: 0.02 });
      assert.deepEqual(snapshot(splitWorldLeaderGroups(groups, readingLeaderUids(input), selectedUid)), expected);
    }
  }
});

test("대장 없는 모임은 동일 객체로 남고 대장만 있는 모임은 원 ID·진도로 공동 표시한다", () => {
  const rows = [{ uid: "a", totalXp: 485, level: 3 }, { uid: "b", totalXp: 485, level: 3 }];
  const [original] = groupWorldTravelers(rows, { selectedUid: "b" });
  assert.equal(splitWorldLeaderGroups([original], ["absent"], "a")[0], original);
  assert.equal(splitWorldLeaderGroups([original], [], "a")[0], original);
  const [shared] = splitWorldLeaderGroups([original], readingLeaderUids(rows), "b");
  assert.equal(shared.id, original.id);
  assert.equal(shared.progress, original.progress);
  assert.equal(shared.isLeader, true);
  assert.equal(shared.representative.uid, "b");
  assert.deepEqual(shared.members, original.members);
  assert.equal(splitWorldLeaderGroups([original], readingLeaderUids(rows), "absent")[0].representative.uid, "a");
  for (const input of [null, undefined, {}]) assert.deepEqual(splitWorldLeaderGroups(input, []), []);
});

test("슬롯 분리는 원본을 변경하지 않고 부가 정보와 모든 학생을 중복·유실 없이 보존한다", () => {
  const rows = [{ uid: "z-peer", totalXp: 435, level: 3 }, { uid: "a-leader", totalXp: 485, level: 3 }, { uid: "start", totalXp: 0, level: 1 }];
  const metadata = Object.freeze({ source: "class-public-snapshot" });
  const groups = groupWorldTravelers(rows, { epsilon: 0.02 }).map((group) => ({ ...group, metadata }));
  const before = structuredClone(groups);
  const freeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  };
  freeze(groups);
  const split = splitWorldLeaderGroups(groups, Object.freeze(["a-leader", "a-leader", "absent"]), "z-peer");
  const members = split.flatMap((group) => group.members.map((member) => member.uid));
  assert.deepEqual(members.slice().sort(), rows.map((row) => row.uid).sort());
  assert.equal(new Set(members).size, rows.length);
  assert.deepEqual(groups, before);
  assert.ok(split.every((group) => group.metadata === metadata));
  assert.ok(split.flatMap((group) => group.members).every((member) => groups.some((group) => group.members.includes(member))));
});

test("최고 레벨의 같은 종점에 겹쳐도 EXP가 더 많은 대장은 별도 슬롯에 남는다", () => {
  const maxXp = getExpForReadingLevel(100);
  const rows = [{ uid: "peer", totalXp: maxXp, level: 100 }, { uid: "leader", totalXp: maxXp * 2, level: 100 }];
  const groups = groupWorldTravelers(rows, { selectedUid: "peer" });
  const [leader, peer] = splitWorldLeaderGroups(groups, readingLeaderUids(rows), "peer");
  assert.equal(leader.representative.uid, "leader");
  assert.equal(leader.isLeader, true);
  assert.equal(peer.representative.uid, "peer");
  assert.equal(peer.isLeader, false);
  assert.equal(leader.progress, 1);
  assert.equal(peer.progress, 1);
  assert.equal(peer.leaderProgress, 1);
});

test("개인 전체 EXP가 없거나 유효하지 않으면 출발점으로 추정하지 않는다", () => {
  for (const value of [null, undefined, "", "100", false, {}, [], NaN, Infinity, -1]) assert.equal(worldProgress(value), null);
  assert.equal(worldProgress(0).level, 1);
  assert.equal(worldProgress(0).progress, 0);
  assert.deepEqual(groupWorldTravelers([{ uid: "old", allTimeXp: 500, level: 4 }]), []);
});

test("레벨별 거점은 기존 도달 기준을 따르며 반이나 기간으로 재조정되지 않는다", () => {
  for (let level = 1; level <= 10; level += 1) {
    const world = worldProgress(getExpForReadingLevel(level));
    assert.equal(world.level, level);
    assert.equal(world.chapter, 1);
    assert.equal(world.progress, WORLD_LEVEL_STOPS[level - 1]);
    assert.equal(world.ratio, 0);
  }
  const row = { uid: "one", totalXp: 2000, xp: 10, allTimeXp: 20 };
  const grouped = groupWorldTravelers([row, { uid: "other", totalXp: 600000 }]);
  const first = grouped.find((group) => group.members.some((member) => member.uid === row.uid)).members[0];
  near(first.world.progress, worldProgress(row.totalXp).progress);
  const changedPeriod = groupWorldTravelers([{ ...row, xp: 999, allTimeXp: 1000 }])[0].members[0];
  assert.deepEqual(changedPeriod.world, first.world);
});

test("2,000 EXP는 Lv.6의 2/3 지점이며 곡선 전체의 53%에 놓인다", () => {
  const world = worldProgress(2000);
  assert.equal(world.level, 6);
  assert.equal(world.from, 1500);
  assert.equal(world.to, 2250);
  assert.equal(world.toNext, 250);
  near(world.ratio, 2 / 3);
  near(world.progress, 0.53);
  assert.equal(world.percent, 67);
  assert.equal(world.region.id, "valley");
});

test("반올림한 표시 진행률이 100이어도 다음 거점에 미리 도착하지 않는다", () => {
  const before = worldProgress(2249);
  assert.equal(before.level, 6);
  assert.equal(before.percent, 100);
  assert.ok(before.progress < 0.57);
  const after = worldProgress(2250);
  assert.equal(after.level, 7);
  assert.equal(after.progress, 0.57);
  assert.equal(after.region.id, "mountains");
  for (const [xp, level] of [[0, 1], [99, 1], [100, 2], [249, 2], [250, 3]]) assert.equal(worldProgress(xp).level, level);
});

test("챕터 경계의 이전 지도 도착과 다음 지도 출발은 같은 레벨이다", () => {
  assert.equal(getExpForReadingLevel(11), 11393);
  const before = worldProgress(11392);
  assert.equal(before.chapter, 1);
  assert.ok(before.progress < 1);
  const after = worldProgress(11393);
  assert.equal(after.chapter, 2);
  assert.equal(after.startLevel, 11);
  assert.equal(after.endLevel, 21);
  assert.equal(after.progress, 0);
  assert.equal(after.complete, false);
  const previousEnd = worldCheckpoints(1).at(-1);
  assert.equal(previousEnd.level, after.level);
  assert.equal(previousEnd.xp, after.xp);
  assert.equal(previousEnd.progress, 1);
});

test("마지막 챕터는 Lv.91~100이고, Lv.100은 0으로 나누지 않고 종점에 도착한다", () => {
  const checkpoints = worldCheckpoints(10);
  assert.equal(checkpoints.length, 10);
  assert.equal(checkpoints[0].level, 91);
  assert.equal(checkpoints[0].progress, 0);
  assert.equal(checkpoints.at(-1).level, 100);
  assert.equal(checkpoints.at(-1).progress, 1);
  const max = worldProgress(getExpForReadingLevel(100));
  assert.equal(max.chapter, 10);
  assert.equal(max.level, 100);
  assert.equal(max.complete, true);
  assert.equal(max.ratio, 1);
  assert.equal(max.percent, 100);
  assert.equal(max.progress, 1);
  assert.equal(max.toNext, 0);
  assert.ok(Object.values(worldPoint(max.progress)).every(Number.isFinite));
  assert.equal(worldProgress(Number.MAX_VALUE).progress, 1);
});

test("기록 정정으로 EXP가 줄면 실제 성장에 맞춰 거점도 뒤로 이동한다", () => {
  const before = worldProgress(2250);
  const after = worldProgress(2000);
  assert.equal(after.level, 6);
  assert.ok(after.progress < before.progress);
});

test("렌더링 경로와 좌표 표본은 같은 원점·끝점·가상 좌표계를 사용한다", () => {
  assert.equal(WORLD_MAP.width, 1536);
  assert.equal(WORLD_MAP.height, 1024);
  assert.match(WORLD_MAP.path, /^M246,876 L/);
  assert.match(WORLD_MAP.path, /L1257,215$/);
  const start = worldPoint(0);
  const finish = worldPoint(1);
  assert.equal(start.x, 246);
  assert.equal(start.y, 876);
  assert.equal(finish.x, 1257);
  assert.equal(finish.y, 215);
  assert.deepEqual(worldPoint(-100), start);
  assert.deepEqual(worldPoint(Infinity), start);
  assert.deepEqual(worldPoint(10), finish);
  for (let i = 0; i <= 1000; i += 1) {
    const point = worldPoint(i / 1000);
    assert.ok(Object.values(point).every(Number.isFinite));
    assert.ok(point.x >= 0 && point.x <= WORLD_MAP.width);
    assert.ok(point.y >= 0 && point.y <= WORLD_MAP.height);
  }
});

test("각 챕터 거점 좌표는 경로 위에 놓이며 양 끝이 고정된다", () => {
  for (let chapter = 1; chapter <= 10; chapter += 1) {
    const checkpoints = worldCheckpoints(chapter);
    assert.equal(checkpoints[0].progress, 0);
    assert.equal(checkpoints.at(-1).progress, 1);
    for (const checkpoint of checkpoints) {
      const point = worldPoint(checkpoint.progress);
      assert.equal(checkpoint.x, point.x);
      assert.equal(checkpoint.y, point.y);
      assert.equal(checkpoint.angle, point.angle);
    }
  }
});

test("같은 EXP 학생 15명은 한 모임이며 선택과 배열 순서가 위치를 바꾸지 않는다", () => {
  const rows = Array.from({ length: 15 }, (_, index) => ({ uid: `s${index}`, name: `학생${index}`, totalXp: 250 }));
  const groups = groupWorldTravelers(rows, { selectedUid: "s8" });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 15);
  assert.equal(groups[0].representative.uid, "s8");
  assert.equal(groups[0].progress, 0.17);
  const reordered = groupWorldTravelers(rows.slice().reverse(), { selectedUid: "s2" });
  assert.equal(reordered[0].id, groups[0].id);
  assert.equal(reordered[0].progress, groups[0].progress);
  assert.equal(reordered[0].representative.uid, "s2");
  assert.deepEqual(reordered[0].members, groups[0].members);
  assert.ok(rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "world")));
});

test("다른 챕터의 출발점을 같은 모임으로 묶거나 같은 학생을 두 번 표시하지 않는다", () => {
  const rows = [{ uid: "a", totalXp: 0 }, { uid: "b", totalXp: 11393 }, { uid: "b", totalXp: 11393 }];
  assert.equal(groupWorldTravelers(rows).length, 2);
  assert.deepEqual(groupWorldTravelers(rows, { chapter: 2 })[0].members.map((row) => row.uid), ["b"]);
});

test("가까운 진도를 묶더라도 원 EXP와 진도를 보존하고 이웃의 연쇄 병합을 막는다", () => {
  const rows = [{ uid: "a", totalXp: 1 }, { uid: "b", totalXp: 2 }, { uid: "c", totalXp: 3 }];
  assert.equal(groupWorldTravelers(rows).length, 3);
  const groups = groupWorldTravelers(rows, { epsilon: 0.001 });
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].members.map((row) => row.totalXp), [1, 2]);
  near(groups[0].members[1].world.progress, worldProgress(2).progress);
});

test("캐릭터 기본값은 레벨·기간·반과 무관한 UID로 정하며 번호 1~10을 유지한다", () => {
  assert.equal(WORLD_CHARACTERS.length, 10);
  assert.deepEqual(WORLD_CHARACTERS.map((item) => item.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let i = 0; i < 100; i += 1) {
    const number = defaultWorldAvatar(`student-${i}`);
    assert.ok(Number.isInteger(number) && number >= 1 && number <= 10);
    assert.equal(number, defaultWorldAvatar(`student-${i}`));
  }
  assert.ok(defaultWorldAvatar(null) >= 1);
  assert.deepEqual(WORLD_REGIONS.map((item) => item.id), ["forest", "desert", "valley", "mountains", "storm"]);
});
