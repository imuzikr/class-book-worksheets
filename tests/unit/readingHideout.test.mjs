import test from "node:test";
import assert from "node:assert/strict";
import {
  HIDEOUT_ITEMS, HIDEOUT_SLOTS, HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_THEMES, HIDEOUT_TABLETOP, HIDEOUT_PLAQUE_PANELS, HIDEOUT_PLAQUE_FONT,
  hideoutProgress, isHideoutItemUnlocked, normalizeHideoutRoom, validateHideoutLayout, hideoutSceneProps, hideoutPlaqueLabel, hideoutPlaqueTextEm,
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

test("verified teacher eligibility opens the catalogue without a fabricated reading level or badges", () => {
  const teacher = hideoutProgress({ level: 50, earnedBadges: ["book-1"] }, { teacher: true });
  assert.deepEqual(teacher, { level: 1, earnedBadgeIds: [], teacher: true });
  assert.deepEqual(hideoutProgress({ level: 1, teacher: true }), { level: 1, earnedBadgeIds: [] }, "ordinary progress never infers a teacher role from summary input");
  for (const item of HIDEOUT_ITEMS) assert.equal(isHideoutItemUnlocked(item.id, teacher), true);
  const layout = { ...HIDEOUT_DEFAULT_LAYOUT, rug: "rug-starlight", "book-trophy": "book-trophy-starlight" };
  assert.deepEqual(validateHideoutLayout(layout, teacher), layout);
  assert.deepEqual(normalizeHideoutRoom({ version: 2, layout, revision: 2 }, teacher).layout, layout);
  assert.equal(normalizeHideoutRoom({ version: 2, layout }, hideoutProgress({ level: 1 })).layout["book-trophy"], null);
  assert.equal(isHideoutItemUnlocked("not-a-real-item", teacher), false);
  assert.throws(() => validateHideoutLayout({ ...layout, rug: "desk-forest" }, teacher));
  assert.throws(() => validateHideoutLayout({ ...layout, teacher: true }, teacher));
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

test("책상 위 소품(책 받침대) — 책상마다 정한 자리에 놓이고, 책상보다 위 · 책상 앞에 선 캐릭터보다 아래", () => {
  for (const desk of HIDEOUT_ITEMS.filter((item) => item.slot === "desk")) {
    const spots = HIDEOUT_TABLETOP[desk.id];
    assert.ok(spots, desk.id);
    assert.deepEqual(Object.keys(spots), ["bookstand"], `${desk.id} — 책상 위에는 받침대만(필기구 정리함 · 탁상 달력은 바닥 가구로 바뀜)`);
    const props = hideoutSceneProps({ ...HIDEOUT_DEFAULT_LAYOUT, desk: desk.id, bookstand: "bookstand-forest" });
    const deskProp = props.find((p) => p.category === "desk");
    const items = props.filter((p) => p.category === "bookstand");
    assert.equal(items.length, 1);
    for (const item of items) {
      assert.deepEqual([item.x, item.y, item.width], [spots.bookstand.x, spots.bookstand.y, spots.bookstand.width], desk.id);
      assert.ok(Number.isInteger(item.z), "z-index는 정수(CSS)");
      // 걷는 길은 책상 앞 y 853부터 — 그 캐릭터(z = 100 + y)보다 아래
      assert.ok(item.z > deskProp.z && item.z < 100 + 853, `${desk.id} · ${item.category} z ${item.z}`);
    }
  }
  // 이름이 잘못된 책상(옛 자료 등)이어도 기본 책상의 자리로
  const odd = hideoutSceneProps({ ...HIDEOUT_DEFAULT_LAYOUT, desk: "no-such-desk", bookstand: "bookstand-forest" }).find((p) => p.category === "bookstand");
  assert.deepEqual([odd.x, odd.y], [HIDEOUT_TABLETOP["desk-basic"].bookstand.x, HIDEOUT_TABLETOP["desk-basic"].bookstand.y]);
});

// 2026년 11월 — 작고 눈에 안 들어오던 소품 여섯을 바닥 가구로(선생님 요청). 자리 이름 · 소품 id · 열리는 레벨은 그대로라
// 이미 그 소품을 고른 학생의 저장된 방이 그대로 새 가구로 보입니다.
const FLOOR_FURNITURE = {
  "pencil-caddy": { label: "1인 독서 소파", stage: 2, folder: "reading-chair" },
  "cover-display": { label: "큰 나무 화분", stage: 3, folder: "big-tree" },
  "pet-water": { label: "독서 텐트", stage: 4, folder: "reading-tent" },
  hourglass: { label: "지구본 스탠드", stage: 8, folder: "globe-stand" },
  "desk-calendar": { label: "독서 침대", stage: 8, folder: "reading-bed" },
  "badge-display": { label: "스탠드 어항", stage: 9, folder: "aquarium" },
};
test("바닥 가구 여섯 — 예전 자리 이름 · 레벨 그대로, 바닥에 서서(책상 · 선반 위가 아님) 앞뒤 차례로 겹치고 바닥 그림자", () => {
  for (const [slotId, want] of Object.entries(FLOOR_FURNITURE)) {
    const slot = HIDEOUT_SLOTS.find((entry) => entry.id === slotId);
    assert.deepEqual([slot.label, slot.stage, slot.placement], [want.label, want.stage, "floor"], slotId);
    assert.equal(slot.support, undefined, `${slotId} — 선반 위가 아님`);
    assert.ok(!HIDEOUT_TABLETOP["desk-basic"][slotId], `${slotId} — 책상 위가 아님`);
    for (const theme of HIDEOUT_THEMES) {
      const item = HIDEOUT_ITEMS.find((entry) => entry.id === `${slotId}-${theme.id}`);
      assert.equal(item.name, `${theme.name} ${want.label}`);
      assert.equal(item.src, `/reading-hideout/items/${want.folder}/${theme.id}.webp`);
      assert.equal(isHideoutItemUnlocked(item.id, { level: want.stage }), true);
      assert.equal(isHideoutItemUnlocked(item.id, { level: want.stage - 1 }), false);
    }
  }
  for (const theme of HIDEOUT_THEMES) {
    const layout = Object.fromEntries(HIDEOUT_SLOTS.map((entry) => [entry.id, `${entry.id}-${theme.id}`]));
    const props = hideoutSceneProps(layout);
    for (const slotId of Object.keys(FLOOR_FURNITURE)) {
      const prop = props.find((p) => p.category === slotId);
      assert.ok(prop, `${theme.id} · ${slotId}`);
      assert.equal(prop.z, 100 + prop.y, `${theme.id} · ${slotId} — 바닥의 앞뒤 차례(캐릭터와 같은 셈)`);
      assert.equal(prop.contactShadow, true);
      assert.ok(prop.x - prop.width / 2 >= 0 && prop.x + prop.width / 2 <= 1536 && prop.y - prop.height >= 0 && prop.y <= 1024, `${theme.id} · ${slotId}`);
    }
  }
  // 저장해 둔 옛 방(예전 소품 id) — 그대로 받아 새 가구로
  const saved = { layout: { ...HIDEOUT_DEFAULT_LAYOUT, "pencil-caddy": "pencil-caddy-forest", "desk-calendar": "desk-calendar-coastal" }, revision: 3 };
  const room = normalizeHideoutRoom(saved, { level: 8 });
  assert.equal(room.layout["pencil-caddy"], "pencil-caddy-forest");
  assert.equal(room.layout["desk-calendar"], "desk-calendar-coastal");
  assert.equal(room.revision, 3);
});

test("문패 글자 — 문패의 크림색 칸(글자 띠) 안에 들고, 한 줄 · 두 줄 가운데 글자가 큰 쪽을 고른다", () => {
  const plaqueOf = (theme) => hideoutSceneProps({ ...HIDEOUT_DEFAULT_LAYOUT, "door-plaque": `door-plaque-${theme}` }).find((p) => p.category === "door-plaque");
  for (const theme of HIDEOUT_THEMES) {
    const prop = plaqueOf(theme.id);
    const panel = HIDEOUT_PLAQUE_PANELS[theme.id];
    const panelHeight = (panel.bottom - panel.top) * prop.height;
    for (const owner of ["나", "선생님", "김민준", "남궁민수", "Alexander Kim", "", null, "  "]) {
      const label = hideoutPlaqueLabel(prop, owner);
      const name = String(owner ?? "").trim() || "나";
      assert.equal(label.lines.join(" "), `${name}의 아지트`, "글자는 '○○의 아지트' 그대로(두 줄이면 '○○의' / '아지트')");
      assert.ok(label.lines.length === 1 || label.lines.length === 2);
      const band = label.lines.length === 1 ? panel.one : panel.two, share = HIDEOUT_PLAQUE_FONT.share[label.lines.length === 1 ? "one" : "two"];
      assert.ok(Math.abs(label.width - (band[1] - band[0]) * prop.width) < 1e-9, "글자 상자 폭 = 그 띠의 폭");
      assert.ok(label.fontSize >= HIDEOUT_PLAQUE_FONT.min && label.fontSize <= HIDEOUT_PLAQUE_FONT.max);
      // 어림한 글자 폭이 띠 안 · 줄 높이가 띠의 높이 안(가장 작은 크기까지 줄인 아주 긴 이름은 화면이 말줄임으로 자름)
      const widest = Math.max(...label.lines.map(hideoutPlaqueTextEm)) * label.fontSize;
      if (label.fontSize > HIDEOUT_PLAQUE_FONT.min) assert.ok(widest <= label.width, `${theme.id} · ${name} — 글자 폭 ${widest.toFixed(1)} > 띠 ${label.width.toFixed(1)}`);
      if (/^[가-힣]{1,4}$/.test(name)) assert.ok(label.fontSize > HIDEOUT_PLAQUE_FONT.min, `${theme.id} · ${name} — 네 글자까지의 이름은 줄이지 않아도 든다`);
      assert.ok(label.lines.length * HIDEOUT_PLAQUE_FONT.lineHeight * label.fontSize <= panelHeight * share + 1e-9, `${theme.id} · ${name} — 높이`);
      // 가운데가 문패 그림 안
      assert.ok(label.x > prop.x - prop.width / 2 && label.x < prop.x + prop.width / 2);
      assert.ok(label.y > prop.y - prop.height && label.y < prop.y);
    }
  }
  const forest = plaqueOf("forest");
  assert.equal(hideoutPlaqueLabel(forest, "나").lines.length, 1, "짧으면 한 줄");
  assert.equal(hideoutPlaqueLabel(forest, "남궁민수").lines.length, 2, "길면 두 줄이 더 크게 든다");
  // 한 줄 · 두 줄 가운데 큰 쪽 — 고르지 않은 쪽으로 쓰면 글자가 더 작거나 같다
  for (const owner of ["나", "선생님", "남궁민수"]) {
    const label = hideoutPlaqueLabel(forest, owner);
    assert.ok(label.fontSize >= 9, `${owner} — 글자가 너무 작아지지 않는다(${label.fontSize})`);
  }
  // 글자 폭 어림 — 한글 1 · 띄어쓰기 0.32 · 영어/숫자 0.62
  assert.equal(hideoutPlaqueTextEm("가나"), 2);
  assert.ok(Math.abs(hideoutPlaqueTextEm("A1 가") - (0.62 * 2 + 0.32 + 1)) < 1e-9);
  // 아주 긴 이름도 문패를 넘지 않게 — 가장 작은 크기에서 넘치는 부분은 화면이 말줄임으로 자름
  const huge = hideoutPlaqueLabel(forest, "아주아주아주긴이름의학생");
  assert.equal(huge.fontSize, HIDEOUT_PLAQUE_FONT.min);
});
