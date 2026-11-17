import test from "node:test";
import assert from "node:assert/strict";
import { HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_SCENE, HIDEOUT_SLOTS, HIDEOUT_THEMES } from "../../lib/readingHideout.js";
import {
  HIDEOUT_RETURN_PORTAL, HIDEOUT_SPAWN, createHideoutWalkMap, hideoutAtReturnPortal, hideoutReturnPortal,
} from "../../lib/readingHideoutMap.js";

test("entry spawn is away from the return portal and every full theme can walk back to class", () => {
  const layouts = [HIDEOUT_DEFAULT_LAYOUT, ...HIDEOUT_THEMES.map((theme) => Object.fromEntries(HIDEOUT_SLOTS.map((slot) => [slot.id, `${slot.id}-${theme.id}`])))];
  for (const layout of layouts) {
    const nav = createHideoutWalkMap(layout);
    assert.equal(nav.walkable(HIDEOUT_SPAWN.x, HIDEOUT_SPAWN.y), true);
    assert.equal(nav.walkable(HIDEOUT_RETURN_PORTAL.x, HIDEOUT_RETURN_PORTAL.y), true);
    assert.equal(hideoutAtReturnPortal(HIDEOUT_SPAWN, 24), false);
    assert.equal(hideoutAtReturnPortal(HIDEOUT_RETURN_PORTAL), true);
    const route = nav.path(HIDEOUT_SPAWN, HIDEOUT_RETURN_PORTAL);
    assert.ok(route.length > 0);
    let here = HIDEOUT_SPAWN;
    for (const next of route) { assert.equal(nav.clear(here, next), true);here = next; }
    assert.ok(hideoutAtReturnPortal(here));
  }
});

test("furniture and the resting pet nook are blocked while center floor remains reachable", () => {
  const nav = createHideoutWalkMap();
  assert.equal(nav.walkable(190, 560), false);
  assert.equal(nav.walkable(215, 760), false);
  assert.equal(nav.walkable(1180, 570), false);
  assert.equal(nav.walkable(760, 850), true);
  assert.ok(nav.path(HIDEOUT_SPAWN, nav.nearest(215, 760)).length);
  assert.deepEqual(nav.step(HIDEOUT_SPAWN, Infinity, 1), HIDEOUT_SPAWN);
  assert.deepEqual(nav.path(HIDEOUT_SPAWN, { x: NaN, y: 0 }), []);
});

test("enlarged return portal stays in the scene and leaves the nearby passage outside its trigger", () => {
  const portal = HIDEOUT_RETURN_PORTAL;
  assert.ok(portal.x - portal.width / 2 >= 0 && portal.x + portal.width / 2 <= HIDEOUT_SCENE.width);
  assert.ok(portal.y - portal.height / 2 >= 0 && portal.y + portal.height / 2 <= HIDEOUT_SCENE.height);
  const nav = createHideoutWalkMap();
  const passage = { x: portal.x - portal.rx - 24, y: portal.y };
  assert.equal(nav.walkable(passage.x, passage.y), true);
  assert.equal(hideoutAtReturnPortal(passage, 15), false);
  const inside = { x: portal.x - portal.rx + 16, y: portal.y };
  assert.equal(nav.walkable(inside.x, inside.y), true);
  assert.equal(hideoutAtReturnPortal(inside), true);
  assert.ok(nav.path(passage, inside).length > 0);
});

test("keyboard movement cannot jump through the desk into the quiet window corner", () => {
  const nav = createHideoutWalkMap();
  let here = { x: 480, y: 760 };
  for (let i = 0; i < 100; i++) here = nav.step(here, -8, 0);
  assert.equal(nav.walkable(here.x, here.y), true);
  assert.ok(here.x > 400);
  assert.equal(hideoutAtReturnPortal({ x: NaN, y: 820 }), false);
});

test("바닥 가구(2026년 11월)의 발자리는 막히고, 여섯을 모두 놓아도 가운데 바닥 · 포털까지의 길은 열려 있다", () => {
  for (const theme of HIDEOUT_THEMES) {
    const layout = Object.fromEntries(HIDEOUT_SLOTS.map((slot) => [slot.id, `${slot.id}-${theme.id}`]));
    const nav = createHideoutWalkMap(layout);
    const ids = nav.colliders.map((entry) => entry.id);
    for (const id of ["pencil-caddy", "cover-display", "pet-water", "hourglass", "desk-calendar", "badge-display"]) assert.ok(ids.includes(id), `${theme.id} · ${id}`);
    assert.equal(nav.walkable(1370, 650), false, `${theme.id} — 독서 침대 위`);
    assert.equal(nav.walkable(835, 690), false, `${theme.id} — 스탠드 어항 앞`);
    assert.equal(nav.walkable(1150, 815), false, `${theme.id} — 독서 텐트 안`);
    assert.equal(nav.walkable(482, 684), false, `${theme.id} — 지구본 스탠드 다리`);
    assert.equal(nav.walkable(628, 940), false, `${theme.id} — 1인 독서 소파 뒤에 바짝`);
    assert.equal(nav.walkable(HIDEOUT_SPAWN.x, HIDEOUT_SPAWN.y), true);
    // 텐트와 포털 사이 · 소파와 나무 사이로 걸어 지나갈 수 있음
    assert.equal(nav.walkable(1320, 820), true, `${theme.id} — 텐트와 포털 사이`);
    assert.ok(nav.path(HIDEOUT_SPAWN, { x: 1320, y: 820 }).length > 0);
    assert.ok(nav.path(HIDEOUT_SPAWN, nav.nearest(560, 640)).length > 0, `${theme.id} — 지구본과 어항 사이 안쪽`);
  }
});

test("옮긴 포털(배치의 'portal' 칸) — 들어오는 자리에서 걸어가면 옮긴 자리의 타원에 닿고, 처음 자리는 그냥 바닥", () => {
  const gate = hideoutReturnPortal({ portal: { x: 400, y: 920 } });
  const nav = createHideoutWalkMap(HIDEOUT_DEFAULT_LAYOUT, { portal: { x: 400, y: 920 } });
  const route = nav.path(HIDEOUT_SPAWN, gate);
  assert.ok(route.length > 0);
  let here = HIDEOUT_SPAWN;
  for (const next of route) { assert.equal(nav.clear(here, next), true); here = next; }
  assert.equal(hideoutAtReturnPortal(here, 0, gate), true);
  assert.equal(hideoutAtReturnPortal(HIDEOUT_RETURN_PORTAL, 0, gate), false, "처음 자리는 이제 포털이 아님");
  assert.equal(hideoutAtReturnPortal(HIDEOUT_SPAWN, 24, gate), false);
  // 포털은 걷는 지도의 막힌 곳이 아님 — 가구만 막음
  assert.deepEqual(nav.colliders, createHideoutWalkMap(HIDEOUT_DEFAULT_LAYOUT).colliders);
});
