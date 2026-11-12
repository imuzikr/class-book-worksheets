// 책 광장의 실시간 — 주고받는 자료의 모양 · 친구 캐릭터의 걸음 · 처음 서는 자리 · 서버의 정리
// (lib/readingPlazaLive.js). 규칙 쪽은 tests/rules/plazaLive.test.mjs, 통로는 tests/server/plazaLive.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PLAZA_LIVE_GONE_KEEP_MS, PLAZA_LIVE_KEY_MS, PLAZA_LIVE_PATH_MAX, PLAZA_LIVE_SEND_MS, REMOTE_LAG, REMOTE_SNAP, REMOTE_STALE_MS,
  plazaAlong, plazaLiveGone, plazaLivePos, plazaLivePrune, plazaLiveWho, plazaPathDecode, plazaPathEncode,
  plazaRemoteEnter, plazaRemoteHear, plazaRemoteStep, plazaRoster, plazaSpawnFor, readPlazaLivePos, readPlazaLiveWho,
} from "../../lib/readingPlazaLive.js";
import { PLAZA_H, PLAZA_NEAR, PLAZA_SPAWN, PLAZA_SPOTS, PLAZA_W, plazaPath, plazaWalkable } from "../../lib/readingPlazaMap.js";
import { PLAZA_WALK_SPEED, plazaPetHeel } from "../../lib/readingPlazaSprites.js";
import { characterOf } from "../../lib/readingCharacterCatalog.js";

const NOW = 1_800_000_000_000;

test("입장권 — 서버가 적는 모양과 화면이 읽는 모양", () => {
  const student = plazaLiveWho({ name: "이서연", character: characterOf({ uid: "u1", character: { style: "animal", number: 3 } }), pet: { species: "hedgehog", stage: 4 }, exp: NOW + 1000 });
  assert.deepEqual(student, { n: "이서연", c: "animal-03", p: "hedgehog", ps: 4, exp: NOW + 1000 });
  assert.deepEqual(readPlazaLiveWho(student, NOW), { name: "이서연", teacher: false, character: { style: "animal", number: 3 }, pet: { species: "hedgehog", stage: 4 }, exp: NOW + 1000 });

  // 알 단계의 종은 싣지 않는다(비밀) — 종이 섞여 들어와도 알로만 읽는다
  const egg = plazaLiveWho({ name: "조유진", character: { style: "zodiac", number: 10 }, pet: { species: null, stage: 1 }, exp: NOW + 1 });
  assert.deepEqual({ p: egg.p, ps: egg.ps, c: egg.c }, { p: "", ps: 1, c: "zodiac-10" });
  assert.deepEqual(readPlazaLiveWho(egg, NOW).pet, { species: null, stage: 1 });
  assert.deepEqual(readPlazaLiveWho({ ...egg, p: "owl", ps: 1 }, NOW).pet, { species: null, stage: 1 });

  // 선생님 — 펫 없음
  const teacher = plazaLiveWho({ name: "선생님", teacher: true, character: characterOf({ uid: "t1" }), pet: null, exp: NOW + 1 });
  assert.equal(teacher.r, 1);
  assert.equal(teacher.ps, 0);
  assert.equal("p" in teacher, false);
  const seen = readPlazaLiveWho(teacher, NOW);
  assert.equal(seen.teacher, true);
  assert.equal(seen.pet, null);

  // 만료 · 모양이 틀린 것은 없는 것으로
  assert.equal(readPlazaLiveWho(student, NOW + 1000), null);
  assert.equal(readPlazaLiveWho(null, NOW), null);
  assert.equal(readPlazaLiveWho({ n: "x" }, NOW), null);
  // 모르는 캐릭터 · 단계는 손질한다(그릴 수 없는 값이 화면에 오지 않게)
  const odd = readPlazaLiveWho({ n: "가".repeat(90), c: "robot-99", p: "DROP TABLE", ps: 99, exp: NOW + 5 }, NOW);
  assert.equal(odd.name.length, 40);
  assert.equal(odd.character, null);
  assert.deepEqual(odd.pet, { species: null, stage: 1 });
});

test("자리 — 올리는 모양 · 받는 모양 · 길", () => {
  const path = [{ x: 900.4, y: 420.6 }, { x: 1010, y: 455 }];
  assert.equal(plazaPathEncode(path), "900,421,1010,455");
  assert.deepEqual(plazaPathDecode("900,421,1010,455"), [{ x: 900, y: 421 }, { x: 1010, y: 455 }]);
  // 길은 열두 점까지 — 규칙의 글자 수 천장(160자)에 든다
  const long = Array.from({ length: 30 }, (_, i) => ({ x: 1600 + i, y: 900 + i }));
  assert.equal(plazaPathDecode(plazaPathEncode(long)).length, PLAZA_LIVE_PATH_MAX);
  assert.ok(plazaPathEncode(long).length <= 160);
  // 모양이 틀린 길은 빈 길로(글자가 섞임 · 짝이 안 맞음 · 너무 김 · 글자가 아님)
  for (const bad of ["", "12", "a,b", "1;2", "-1,2", "1.5,2", "1,2,3,4,".repeat(60), null, 42, ["1,2"]]) assert.deepEqual(plazaPathDecode(bad), [], String(bad).slice(0, 12));
  assert.deepEqual(plazaPathDecode("5000,5000"), [{ x: PLAZA_W, y: PLAZA_H }], "그림 밖의 점은 가장자리로");

  const walking = plazaLivePos({ x: 836.2, y: 330.7, path, mode: 1, facing: "right" });
  assert.deepEqual(walking, { x: 836, y: 331, m: 1, f: 1, w: "900,421,1010,455" });
  assert.deepEqual(readPlazaLivePos({ ...walking, t: NOW }), { x: 836, y: 331, path: [{ x: 900, y: 421 }, { x: 1010, y: 455 }], mode: 1, facing: "right", reading: false, gone: false, t: NOW });
  // 방향키 걸음 · 선 자리 · 글을 읽는 중
  assert.deepEqual(plazaLivePos({ x: 500, y: 700, mode: 2, facing: "left" }), { x: 500, y: 700, m: 2, f: 3 });
  assert.deepEqual(plazaLivePos({ x: 500, y: 700, mode: 0, facing: "up", reading: true }), { x: 500, y: 700, m: 0, f: 2, a: 1 });
  // 길 없이 '길을 따라 걷는 중'이라고 하면 선 것
  assert.equal(plazaLivePos({ x: 1, y: 1, mode: 1, path: [] }).m, 0);
  assert.equal(readPlazaLivePos({ x: 1, y: 1, m: 1, f: 0 }).mode, 0);
  // 나감 표시
  assert.deepEqual(plazaLiveGone({ x: 12.4, y: 9 }), { x: 12, y: 9, m: 0, f: 0, g: 1 });
  assert.equal(readPlazaLivePos({ ...plazaLiveGone({ x: 12, y: 9 }), t: NOW }).gone, true);
  // 모양이 틀리면 없는 것으로(그림 밖 · 숫자가 아님)
  for (const bad of [null, {}, { x: "a", y: 1 }, { x: -1, y: 1 }, { x: 1, y: PLAZA_H + 1 }, { x: NaN, y: 0 }]) assert.equal(readPlazaLivePos(bad), null);
  // 모르는 방향 · 모드는 손질
  assert.deepEqual({ ...readPlazaLivePos({ x: 1, y: 2, m: 9, f: 9 }), t: 0 }, { x: 1, y: 2, path: [], mode: 0, facing: "left", reading: false, gone: false, t: 0 });
});

test("올리는 간격 — 방향키 걸음은 규칙의 천장(0.1초)보다 넉넉히 드물게", () => {
  const rules = JSON.parse(readFileSync(fileURLToPath(new URL("../../database.rules.json", import.meta.url)), "utf8"));
  const write = rules.rules.plaza.$classId.pos.$uid[".write"];
  const gap = Number(write.match(/now - (\d+)/)?.[1]);
  assert.ok(gap >= 50 && gap <= 150, "규칙이 가장 짧은 간격을 잰다");
  assert.ok(PLAZA_LIVE_SEND_MS >= gap * 2, "화면은 그 두 배보다 드물게 올린다");
  assert.ok(PLAZA_LIVE_KEY_MS >= PLAZA_LIVE_SEND_MS);
  // 따라갈 때 두는 거리 = 방향키 소식 한 번 사이에 걷는 거리
  assert.equal(REMOTE_LAG, Math.round(PLAZA_WALK_SPEED * PLAZA_LIVE_KEY_MS / 1000));
});

test("친구 캐릭터 — 길을 따라 걷고, 다 오면 선다", () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
  assert.deepEqual(plazaAlong(points, 0), { x: 0, y: 0, rest: [{ x: 100, y: 0 }, { x: 100, y: 50 }], heading: { dx: 100, dy: 0 } });
  const mid = plazaAlong(points, 120);
  assert.deepEqual({ x: mid.x, y: mid.y, rest: mid.rest }, { x: 100, y: 20, rest: [{ x: 100, y: 50 }] });
  const end = plazaAlong(points, 999);
  assert.deepEqual({ x: end.x, y: end.y, rest: end.rest, heading: end.heading }, { x: 100, y: 50, rest: [], heading: { dx: 0, dy: 50 } });

  // 진짜 길로 — 분수 건너편까지
  const from = { x: 836, y: 330 };
  const path = plazaPath(from, { x: 836, y: 700 });
  assert.ok(path.length >= 2, "분수를 돌아가는 길");
  const state = readPlazaLivePos({ ...plazaLivePos({ ...from, path, mode: 1, facing: "down" }), t: NOW });
  const actor = plazaRemoteEnter(state, 0, 0);
  assert.deepEqual({ x: actor.x, y: actor.y }, from);
  let now = 0;
  let total = 0;
  let frames = 0;
  let sawWalking = false;
  for (; frames < 2000; frames += 1) {
    now += 1000 / 60;
    const step = plazaRemoteStep(actor, 1 / 60, now);
    assert.equal(plazaWalkable(actor.x, actor.y), true, "길 위(바닥)로만 걷는다");
    assert.ok(step.moved <= PLAZA_WALK_SPEED * 1.6 / 60 + 1e-6, "한 프레임에 가장 빠른 걸음을 넘지 않는다");
    total += step.moved;
    if (step.walking) sawWalking = true;
    if (!step.busy && !step.walking) break;
  }
  assert.ok(sawWalking);
  const goal = state.path.at(-1);
  assert.ok(Math.hypot(actor.x - goal.x, actor.y - goal.y) < 0.01, "도착점에 선다");
  assert.equal(actor.stride, 0, "서면 걸은 거리(그림 차례)를 처음으로");
  // 걸린 시간 — 같은 빠르기보다 조금 빠르게(따라잡게), 터무니없이 빠르지는 않게
  const seconds = frames / 60;
  assert.ok(seconds > total / (PLAZA_WALK_SPEED * 1.2) && seconds < total / PLAZA_WALK_SPEED + 0.1);
});

test("친구 캐릭터 — 늦게 들어와도 지금 있을 자리에 선다", () => {
  const state = readPlazaLivePos({ x: 300, y: 700, w: "560,700,560,800", m: 1, f: 1, t: NOW });
  // 0.5초 전 소식 — 그동안 걸었을 만큼(130px) 가 있다
  const half = plazaRemoteEnter(state, 500, 0);
  assert.ok(Math.abs(half.x - (300 + PLAZA_WALK_SPEED * 0.5)) < 1e-6 && half.y === 700);
  assert.equal(half.queue.length, 2);
  assert.equal(half.facing, "right");
  // 한참 전 소식 — 이미 다 걸어간 자리에 서 있다(길을 처음부터 다시 걷지 않음) · 마지막에 걷던 쪽을 본다
  const old = plazaRemoteEnter(state, 60_000, 0);
  assert.deepEqual({ x: old.x, y: old.y, queue: old.queue, mode: old.mode, facing: old.facing }, { x: 560, y: 800, queue: [], mode: 0, facing: "down" });
  assert.equal(plazaRemoteStep(old, 1 / 60, 10).walking, false);
  // 선 사람 · 방향키로 걷던 사람은 적힌 자리 그대로
  const still = plazaRemoteEnter(readPlazaLivePos({ x: 900, y: 600, m: 0, f: 2, a: 1, t: NOW }), 99_000, 0);
  assert.deepEqual({ x: still.x, y: still.y, facing: still.facing, reading: still.reading }, { x: 900, y: 600, facing: "up", reading: true });
});

test("친구 캐릭터 — 새 소식을 들으면 선 자리에서 이어 걷고, 멈춘 소식이면 그쪽을 보고 선다", () => {
  const actor = plazaRemoteEnter(readPlazaLivePos({ x: 500, y: 700, m: 0, f: 0, t: NOW }), 0, 0);
  // 방향키 걸음 — 0.3초마다 지금 자리가 온다. 소식 사이에 섰다 걷지 않는다(걷는 자세가 이어짐).
  let now = 0;
  let stops = 0;
  let walkedOnce = false;
  for (let report = 1; report <= 8; report += 1) {
    plazaRemoteHear(actor, readPlazaLivePos({ x: 500 + report * REMOTE_LAG, y: 700, m: 2, f: 1, t: NOW }), now);
    for (let f = 0; f < 18; f += 1) {            // 0.3초
      now += 1000 / 60;
      const step = plazaRemoteStep(actor, 1 / 60, now);
      if (step.walking) walkedOnce = true;
      else if (walkedOnce) stops += 1;
    }
  }
  assert.equal(stops, 0, "걷는 동안 선 자세가 끼지 않는다");
  assert.equal(actor.facing, "right");
  assert.ok(actor.x > 500 + 6 * REMOTE_LAG && actor.x <= 500 + 8 * REMOTE_LAG + 1e-6, "한 박자쯤 뒤를 따라간다");
  // 멈춘 소식 — 그 자리까지 가서 적힌 쪽(위)을 본다
  plazaRemoteHear(actor, readPlazaLivePos({ x: 500 + 8 * REMOTE_LAG + 20, y: 700, m: 0, f: 2, a: 1, t: NOW }), now);
  for (let f = 0; f < 120; f += 1) { now += 1000 / 60; plazaRemoteStep(actor, 1 / 60, now); }
  assert.deepEqual({ x: actor.x, y: actor.y, facing: actor.facing, walking: actor.walking, reading: actor.reading },
    { x: 500 + 8 * REMOTE_LAG + 20, y: 700, facing: "up", walking: false, reading: true });

  // 소식이 끊기면(탭이 얼었음) 걷는 자세로 굳지 않는다
  plazaRemoteHear(actor, readPlazaLivePos({ x: actor.x + 30, y: 700, m: 2, f: 1, t: NOW }), now);
  let last = null;
  for (let f = 0; f < 200; f += 1) { now += 1000 / 60; last = plazaRemoteStep(actor, 1 / 60, now); }
  assert.ok(200 * 1000 / 60 > REMOTE_STALE_MS);
  assert.deepEqual({ walking: last.walking, busy: last.busy }, { walking: false, busy: false });

  // 제자리에서 방향만 바꾼 소식(책꽂이를 열며 돌아봄)은 곧바로
  plazaRemoteHear(actor, readPlazaLivePos({ x: actor.x, y: actor.y, m: 0, f: 3, t: NOW }), now);
  assert.equal(actor.facing, "left");
  // 너무 멀리 떨어진 소식(오래 끊겼다 이어짐)은 걸어가지 않고 곧바로 옮긴다
  plazaRemoteHear(actor, readPlazaLivePos({ x: actor.x - REMOTE_SNAP - 50, y: 700, m: 0, f: 0, t: NOW }), now);
  assert.equal(actor.queue.length, 0);
  assert.ok(Math.abs(actor.x - (500 + 8 * REMOTE_LAG + 20 + 30 - REMOTE_SNAP - 50)) < 1e-6);
});

test("처음 서는 자리 — 사람마다 흩어 서고, 여는 곳 바로 앞은 피한다", () => {
  const spots = [];
  for (let i = 0; i < 60; i += 1) {
    const uid = `student_${i}_${(i * 7919).toString(36)}`;
    const at = plazaSpawnFor(uid);
    assert.deepEqual(plazaSpawnFor(uid), at, "같은 사람은 늘 같은 자리");
    assert.equal(plazaWalkable(at.x, at.y), true);
    for (const s of PLAZA_SPOTS) assert.ok(Math.hypot(at.x - s.stand.x, at.y - s.stand.y) > PLAZA_NEAR, "들어서자마자 '눌러서 열기'가 뜨지 않는다");
    assert.ok(Math.abs(at.x - PLAZA_SPAWN.x) <= 250 && Math.abs(at.y - PLAZA_SPAWN.y) <= 40, "책꽂이와 분수 사이");
    const heel = plazaPetHeel(at, null);
    assert.equal(plazaWalkable(heel.x, heel.y), true, "펫이 설 곁자리도 바닥");
    spots.push(at);
  }
  // 한 덩이로 겹치지 않는다 — 서로 다른 자리가 대부분이고 좌우로 넓게 퍼진다
  assert.ok(new Set(spots.map((p) => `${p.x},${p.y}`)).size >= 55);
  const xs = spots.map((p) => p.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 300);
  assert.equal(plazaWalkable(plazaSpawnFor("").x, plazaSpawnFor("").y), true);
});

test("서버의 정리 — 만료된 입장권 · 주인 없는 자리 · 나간 지 오래된 자리를 걷는다", () => {
  const tree = {
    who: {
      alive: { n: "가", exp: NOW + 1000 },
      expired: { n: "나", exp: NOW - 1 },
      leaver: { n: "다", exp: NOW + 1000 },
      fresh: { n: "라", exp: NOW + 1000 },
    },
    pos: {
      alive: { x: 1, y: 1, m: 0, f: 0, t: NOW - 5000 },
      expired: { x: 1, y: 1, m: 0, f: 0, t: NOW - 5000 },
      orphan: { x: 1, y: 1, m: 0, f: 0, t: NOW - 5000 },
      leaver: { x: 1, y: 1, m: 0, f: 0, g: 1, t: NOW - PLAZA_LIVE_GONE_KEEP_MS - 1 },
      fresh: { x: 1, y: 1, m: 0, f: 0, g: 1, t: NOW - 1000 },
      "bad.key": { x: 1, y: 1 },
    },
  };
  assert.deepEqual(plazaLivePrune(tree, NOW), { "who/expired": null, "pos/expired": null, "pos/orphan": null, "pos/leaver": null });
  assert.deepEqual(plazaLivePrune(null, NOW), {});
  assert.deepEqual(plazaLivePrune({ who: { a: { exp: NOW + 1 } } }, NOW), {});
});

test("친구 캐릭터 — 방향키를 누른 채 막혀 있으면 제자리걸음하지 않고, 늦게 본 걸음 소식은 선 것으로 본다", () => {
  const stand = (extra = {}) => ({ x: 600, y: 300, path: [], mode: 0, facing: "down", reading: false, ...extra });
  const actor = plazaRemoteEnter(stand(), 0, 0);
  // 같은 자리에서 방향키 소식이 거듭 온다(왼쪽을 누르고 있지만 벽에 막힘) — 누른 쪽을 보고 선다
  plazaRemoteHear(actor, stand({ mode: 2, facing: "left" }), 100);
  const blocked = plazaRemoteStep(actor, 1 / 60, 110);
  assert.deepEqual({ walking: blocked.walking, busy: blocked.busy, facing: actor.facing }, { walking: false, busy: false, facing: "left" });
  // 움직인 소식이면 걷는다
  plazaRemoteHear(actor, stand({ x: 600 - REMOTE_LAG, mode: 2, facing: "left" }), 400);
  assert.equal(plazaRemoteStep(actor, 1 / 60, 410).walking, true);
  // 광장에 들어섰을 때 본 방향키 소식이 오래된 것이면(걷다 끊긴 친구) 걷는 자세로 서 있지 않는다
  const late = plazaRemoteEnter(stand({ mode: 2, facing: "right" }), REMOTE_STALE_MS + 200, 5000);
  assert.equal(plazaRemoteStep(late, 1 / 60, 5010).walking, false);
  // 방금 온 소식이면 다음 소식을 기다리며 걷는 자세
  const fresh = plazaRemoteEnter(stand({ mode: 2, facing: "right" }), 100, 5000);
  assert.equal(plazaRemoteStep(fresh, 1 / 60, 5010).walking, true);
});

test("지금 광장에 있는 사람 — 입장권과 자리가 다 있어야 서고, 나가거나 만료되면 내려간다", () => {
  const events = [];
  const roster = plazaRoster("me", {
    onJoin: (uid, who, pos, age) => events.push(["join", uid, who.name, pos.x, age]),
    onWho: (uid, who) => events.push(["who", uid, who.pet?.stage ?? 0]),
    onMove: (uid, pos) => events.push(["move", uid, pos.x, pos.mode]),
    onLeave: (uid) => events.push(["leave", uid]),
  });
  const who = (name, extra = {}) => ({ n: name, c: "animal-03", ps: 0, exp: NOW + 60000, ...extra });
  const pos = (x, extra = {}) => ({ x, y: 300, m: 0, f: 0, t: NOW - 500, ...extra });
  // 어느 쪽이 먼저 와도 — 둘이 다 있어야 선다. 소식의 나이(0.5초)를 함께 준다(늦게 들어온 화면이 그만큼 걸어가 있게)
  roster.pos("a", pos(700), NOW);
  assert.deepEqual(events, []);
  roster.who("a", who("가"), NOW);
  assert.deepEqual(events.splice(0), [["join", "a", "가", 700, 500]]);
  roster.who("b", who("나"), NOW);
  assert.deepEqual(events, []);
  roster.pos("b", pos(800), NOW);
  assert.deepEqual(events.splice(0), [["join", "b", "나", 800, 500]]);
  assert.equal(roster.size, 2);
  // 걸음 · 이름표가 바뀜(펫이 자람)
  roster.pos("a", pos(720, { m: 2 }), NOW);
  roster.who("a", who("가", { ps: 3, p: "owl" }), NOW);
  assert.deepEqual(events.splice(0), [["move", "a", 720, 2], ["who", "a", 3]]);
  // 내 것은 흘려보낸다
  roster.who("me", who("나"), NOW);
  roster.pos("me", pos(1), NOW);
  assert.deepEqual(events, []);
  // '나감' 표시 → 내려가고, 다시 자리를 올리면 다시 선다(쉬던 화면이 돌아옴)
  roster.pos("a", pos(720, { g: 1 }), NOW);
  assert.deepEqual(events.splice(0), [["leave", "a"]]);
  roster.pos("a", pos(730), NOW);
  assert.deepEqual(events.splice(0).map((e) => e[0]), ["join"]);
  // 입장권이 걷힘(선생님이 반에서 뺌) · 자리가 지워짐 → 내려간다. 없는 사람을 걷어도 아무 일 없다
  roster.whoGone("a", NOW);
  roster.posGone("b", NOW);
  roster.whoGone("nobody", NOW);
  assert.deepEqual(events.splice(0), [["leave", "a"], ["leave", "b"]]);
  // 만료된 입장권으로는 서지 못하고, 서 있다가 만료되면 걷힌다
  roster.who("c", who("다", { exp: NOW - 1 }), NOW);
  roster.pos("c", pos(600), NOW);
  assert.deepEqual(events, []);
  roster.who("d", who("라", { exp: NOW + 1000 }), NOW);
  roster.pos("d", pos(600), NOW);
  events.length = 0;
  roster.sweep(NOW + 500);
  assert.deepEqual(events, []);
  roster.sweep(NOW + 2000);
  assert.deepEqual(events.splice(0), [["leave", "d"]]);
  // 모양이 틀린 자리는 없는 것으로
  roster.who("e", who("마"), NOW);
  roster.pos("e", { x: -5, y: 10 }, NOW);
  assert.deepEqual(events, []);
  // 연결을 놓으면 모두 내린다
  roster.pos("e", pos(500), NOW);
  roster.who("f", who("바"), NOW);
  roster.pos("f", pos(520), NOW);
  events.length = 0;
  roster.clear();
  assert.deepEqual(events.map((e) => e.join()).sort(), ["leave,e", "leave,f"]);
  assert.equal(roster.size, 0);
});

test("친구 캐릭터 — 소식의 자리가 분수 건너편이면 가로지르지 않고 돌아서 간다", () => {
  // 분수 위쪽에 선 친구가 방향키로 둘레를 돌아 아래쪽에 가 있다는 소식(그 사이의 소식을 놓침)
  const from = { x: 836, y: 360 };
  const to = { x: 836, y: 590 };
  assert.equal(plazaWalkable(from.x, from.y) && plazaWalkable(to.x, to.y), true);
  assert.equal(plazaWalkable(836, 480), false, "둘 사이는 분수");
  const actor = plazaRemoteEnter({ ...from, path: [], mode: 0, facing: "down", reading: false }, 0, 0);
  plazaRemoteHear(actor, { ...to, path: [], mode: 2, facing: "down", reading: false }, 0);
  assert.ok(actor.queue.length > 1, "돌아가는 길");
  let now = 0;
  for (let i = 0; i < 600 && actor.queue.length; i += 1) {
    now += 1000 / 60;
    plazaRemoteStep(actor, 1 / 60, now);
    assert.equal(plazaWalkable(actor.x, actor.y), true, `걷는 내내 바닥 위(${Math.round(actor.x)}, ${Math.round(actor.y)})`);
  }
  assert.deepEqual({ x: actor.x, y: actor.y }, to);
  // 곧게 갈 수 있으면 곧게(점 하나)
  const plain = plazaRemoteEnter({ x: 600, y: 300, path: [], mode: 0, facing: "down", reading: false }, 0, 0);
  plazaRemoteHear(plain, { x: 660, y: 310, path: [], mode: 2, facing: "right", reading: false }, 0);
  assert.deepEqual(plain.queue, [{ x: 660, y: 310 }]);
});
