import test from "node:test";
import assert from "node:assert/strict";
import {
  HIDEOUT_ITEMS, HIDEOUT_SLOTS, HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_THEMES,
  hideoutProgress, isHideoutItemUnlocked, normalizeHideoutRoom, validateHideoutLayout, hideoutSceneProps,
} from "../../lib/readingHideout.js";

test("every student starts with a furnished room and display surfaces before reward shelves unlock", () => {
  const room = normalizeHideoutRoom(null, { level: 1 });
  assert.equal(room.version, 2);
  assert.equal(room.revision, 0);
  assert.equal(Object.keys(room.layout).length, 30);
  assert.equal(Object.values(room.layout).filter(Boolean).length, 8);
  assert.equal(room.layout["wall-shelf"], "wall-shelf-basic");
  assert.equal(room.layout.chest, null);
  assert.equal(hideoutSceneProps(room.layout).filter((p) => p.category === "wall-shelf").length, 2);
  assert.deepEqual(validateHideoutLayout(room.layout, { level: 1 }), room.layout);
});

test("the approved120 reward designs unlock by reading level, with four equal theme choices", () => {
  assert.equal(HIDEOUT_ITEMS.filter((entry) => entry.stage > 0).length, 120);
  for (let level = 1; level <= 10; level++) {
    const categories = HIDEOUT_SLOTS.filter((entry) => entry.stage === level);
    assert.equal(categories.length, 3);
    for (const category of categories) {
      const choices = HIDEOUT_ITEMS.filter((entry) => entry.slot === category.id && entry.stage > 0);
      assert.equal(choices.length, 4);
      for (const entry of choices) {
        assert.equal(isHideoutItemUnlocked(entry.id, { level }), true);
        if (level > 1) assert.equal(isHideoutItemUnlocked(entry.id, { level: level - 1 }), false);
      }
    }
  }
  assert.equal(HIDEOUT_THEMES.length, 4);
  assert.equal(isHideoutItemUnlocked({ id: "bed-starlight", unlock: {} }, { level: 1 }), false);
});

test("saving rejects locked furniture, another slot, missing slots and unknown properties", () => {
  const layout = { ...HIDEOUT_DEFAULT_LAYOUT, bed: "bed-starlight" };
  assert.throws(() => validateHideoutLayout(layout, { level: 3 }), { code: "reading/hideout-locked" });
  assert.equal(validateHideoutLayout(layout, { level: 4 }).bed, "bed-starlight");
  assert.throws(() => validateHideoutLayout({ ...layout, bed: "desk-forest" }, { level: 10 }));
  assert.throws(() => validateHideoutLayout({ ...layout, bed: null }, { level: 10 }));
  const missing = { ...layout };delete missing.clock;
  assert.throws(() => validateHideoutLayout(missing, { level: 10 }));
  assert.throws(() => validateHideoutLayout({ ...layout, position: { x: 1, y: 2 } }, { level: 10 }));
  assert.throws(() => validateHideoutLayout({ ...layout, bed: "not-an-item" }, { level: 10 }));
});

test("record corrections remove unavailable rewards while preserving basic furniture and revision", () => {
  const input = { version: 2, layout: { ...HIDEOUT_DEFAULT_LAYOUT, bed: "bed-starlight", clock: "clock-coastal" }, revision: 6 };
  const room = normalizeHideoutRoom(input, { level: 2 });
  assert.equal(room.layout.bed, "bed-linen");
  assert.equal(room.layout.clock, null);
  assert.equal(room.revision, 6);
  assert.equal(input.layout.bed, "bed-starlight");
  assert.equal(normalizeHideoutRoom({ revision: Infinity }, null).revision, 0);
  assert.equal(hideoutProgress({ level: "10" }).level, 1);
});

test("layout validation never evaluates accessor values or inherited item IDs", () => {
  let evaluated = false;
  const layout = { ...HIDEOUT_DEFAULT_LAYOUT };
  Object.defineProperty(layout, "desk", { enumerable: true, get() { evaluated = true; return "desk-basic"; } });
  assert.throws(() => validateHideoutLayout(layout, { level: 10 }));
  assert.equal(evaluated, false);
  assert.throws(() => validateHideoutLayout(Object.create(HIDEOUT_DEFAULT_LAYOUT), { level: 10 }));
});

test("every full theme uses the approved sizes and supported empty shelves without duplicated ornaments", () => {
  for (const theme of HIDEOUT_THEMES) {
    const layout = Object.fromEntries(HIDEOUT_SLOTS.map((entry) => [entry.id, `${entry.id}-${theme.id}`]));
    const valid = validateHideoutLayout(layout, { level: 10 });
    const props = hideoutSceneProps(valid);
    assert.equal(props.length, 31);
    const find = (id) => props.find((entry) => entry.category === id);
    assert.equal(find("desk").width, 288);
    assert.equal(find("rug").width, 432);
    assert.deepEqual([find("chest").x, find("chest").y, find("chest").width], [145, 970, 135]);
    assert.deepEqual([find("book-trophy").x, find("book-trophy").width], [874, 72]);
    const ledges = props.filter((p) => p.category === "wall-shelf");
    assert.equal(ledges[1].width, 240);
    assert.equal(ledges[1].y, 482);
    assert.ok(ledges.every((p) => p.src.includes("/helpers/empty-wall-shelf/")));
    for (const prop of props.filter((p) => p.support)) {
      const ledge = ledges.find((p) => p.id === "wall-shelf-" + prop.support);
      assert.ok(Math.abs(prop.y - ledge.surfaceY - 0.5) < 0.0001);
    }
    for (const prop of props) {
      assert.ok(prop.x - prop.width / 2 >= 0 && prop.x + prop.width / 2 <= 1536, prop.itemId);
      assert.ok(prop.y - prop.height >= 0 && prop.y <= 1024, prop.itemId);
    }
  }
});
