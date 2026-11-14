import test from "node:test";
import assert from "node:assert/strict";
import { HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_SLOTS, HIDEOUT_THEMES } from "../../lib/readingHideout.js";
import {
  HIDEOUT_RETURN_PORTAL, HIDEOUT_SPAWN, createHideoutWalkMap, hideoutAtReturnPortal,
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

test("keyboard movement cannot jump through the desk into the quiet window corner", () => {
  const nav = createHideoutWalkMap();
  let here = { x: 480, y: 760 };
  for (let i = 0; i < 100; i++) here = nav.step(here, -8, 0);
  assert.equal(nav.walkable(here.x, here.y), true);
  assert.ok(here.x > 400);
  assert.equal(hideoutAtReturnPortal({ x: NaN, y: 820 }), false);
});
