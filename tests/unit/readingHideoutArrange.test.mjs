// 아지트 2단계(2026년 11월) — 소품의 자리 · 방향 바꾸기(배치)의 셈과 판정, 돌린 가구 그림.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  HIDEOUT_ARRANGE_KEYS, HIDEOUT_DEFAULT_ANCHORS, HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_ITEMS, HIDEOUT_PORTAL_HOME, HIDEOUT_SLOTS, HIDEOUT_THEMES,
  HIDEOUT_TURN_TABLETOP, HIDEOUT_UNITS,
  hideoutArrangeShape, hideoutArtBox, hideoutPlaqueLabel, hideoutPortalPlacement, hideoutSceneProps, hideoutUnitFlips, normalizeHideoutRoom, sameHideoutArrange,
} from "../../lib/readingHideout.js";
import { HIDEOUT_ART_INSETS } from "../../lib/readingHideoutBoxes.js";
import { HIDEOUT_TURN_ART, HIDEOUT_TURN_SLOTS, hideoutTurnArt } from "../../lib/readingHideoutTurn.js";
import {
  HIDEOUT_RETURN_PORTAL, HIDEOUT_SPAWN, createHideoutWalkMap, hideoutAtReturnPortal, hideoutReturnPortal,
} from "../../lib/readingHideoutMap.js";
import {
  HIDEOUT_GRID, hideoutArrangeProblem, hideoutFindSpot, hideoutNudge, hideoutPortalReachable, hideoutSnap, hideoutUnitPlacement, hideoutWithEntry,
  settleHideoutArrange, validateHideoutArrange,
} from "../../lib/readingHideoutArrange.js";
import { measureInsets } from "../../scripts/measure-hideout-boxes.mjs";

const PUBLIC = path.resolve("public");
const file = (src) => path.join(PUBLIC, src.replace(/^\//, ""));
const themeLayout = (theme) => Object.fromEntries(HIDEOUT_SLOTS.map((slot) => [slot.id, `${slot.id}-${theme}`]));
const LAYOUTS = { basic: { ...HIDEOUT_DEFAULT_LAYOUT }, ...Object.fromEntries(HIDEOUT_THEMES.map((theme) => [theme.id, themeLayout(theme.id)])) };
const propOf = (props, category) => props.find((prop) => prop.category === category);

test("돌린 가구 그림 — 26개(여섯 종류 × 네 테마 + 기본 책상 · 책장)가 그림 파일 크기와 같고 그림 목록에 있다", async () => {
  assert.deepEqual([...HIDEOUT_TURN_SLOTS].sort(), ["badge-display", "chest", "desk", "desk-calendar", "pencil-caddy", "shelf"]);
  assert.equal(Object.keys(HIDEOUT_TURN_ART).length, 26);
  const manifest = JSON.parse(await fs.readFile(path.join(PUBLIC, "reading-hideout/manifest.json"), "utf8"));
  const listed = new Set(manifest.files.map((entry) => `/reading-hideout/${entry.path}`));
  assert.equal(manifest.turnArt.designs, 26);
  for (const art of Object.values(HIDEOUT_TURN_ART)) {
    const meta = await sharp(file(art.src)).metadata();
    assert.deepEqual([meta.width, meta.height], [art.width, art.height], art.itemId);
    assert.equal(meta.hasAlpha, true, art.itemId);
    assert.ok(listed.has(art.src), `${art.src} — 그림 목록(manifest.json)에 없음`);
    assert.ok(HIDEOUT_ITEMS.some((item) => item.id === art.itemId && item.slot === art.slot), art.itemId);
  }
  for (const slot of HIDEOUT_TURN_SLOTS) {
    for (const item of HIDEOUT_ITEMS.filter((entry) => entry.slot === slot)) assert.ok(hideoutTurnArt(item.id), `${item.id} — 돌린 그림이 없음`);
  }
  assert.equal(hideoutTurnArt("rug-forest"), null);
  assert.equal(hideoutTurnArt("__proto__"), null);
});

test("보이는 상자 표(lib/readingHideoutBoxes.js)가 그림과 같다 — 그림을 바꾸면 scripts/measure-hideout-boxes.mjs를 다시", async () => {
  const sources = new Set([...HIDEOUT_ITEMS.map((item) => item.src), ...Object.values(HIDEOUT_TURN_ART).map((art) => art.src)]);
  for (const src of sources) {
    assert.ok(HIDEOUT_ART_INSETS[src], `${src} — 보이는 상자가 없음`);
    assert.deepEqual(await measureInsets(file(src)), HIDEOUT_ART_INSETS[src], src);
  }
});

test("돌린 그림은 앞모습과 같은 배율 — 옆모습 · 의자 앞 책상은 키가 앞모습과 거의 같다(그림 AI가 참고 그림의 키를 지킴)", () => {
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    for (const slot of HIDEOUT_TURN_SLOTS) {
      if (!layout[slot] || slot === "desk-calendar") continue;
      const front = propOf(hideoutSceneProps(layout), slot);
      const turned = propOf(hideoutSceneProps(layout, { [slot]: { ...HIDEOUT_DEFAULT_ANCHORS[slot], turn: true } }), slot);
      assert.equal(turned.turned, true);
      assert.equal(turned.src, hideoutTurnArt(layout[slot]).src);
      const a = hideoutArtBox(front), b = hideoutArtBox(turned);
      const ratio = (b.y1 - b.y0) / (a.y1 - a.y0);
      // 책상은 의자가 앞으로 나와 조금 더 큼
      assert.ok(ratio > 0.9 && ratio < (slot === "desk" ? 1.25 : 1.1), `${name} · ${slot} 키 비율 ${ratio.toFixed(2)}`);
      assert.equal(Math.round(turned.y), Math.round(front.y), "바닥 가운데는 그대로");
    }
  }
});

test("배치가 없으면 지금까지와 똑같은 방 — 자리 · 폭 · 그림이 그대로", () => {
  for (const layout of Object.values(LAYOUTS)) {
    const before = hideoutSceneProps(layout), after = hideoutSceneProps(layout, {});
    assert.deepEqual(after, before);
    for (const prop of before) {
      assert.equal(prop.flip, false, prop.id);
      assert.equal(prop.turned, false, prop.id);
      if (prop.unit) assert.deepEqual([prop.x, prop.y], [HIDEOUT_DEFAULT_ANCHORS[prop.unit].x, HIDEOUT_DEFAULT_ANCHORS[prop.unit].y], prop.unit);
    }
    // 옮길 수 없는 것: 창가 장식(창문) · 책상 위 · 선반 위 소품은 따라가는 가구가 있음
    for (const prop of before.filter((entry) => !entry.unit)) {
      if (prop.category === "garland") assert.equal(prop.parentUnit, null);
      else assert.ok(["desk", "ledge-left", "ledge-right"].includes(prop.parentUnit), `${prop.category} → ${prop.parentUnit}`);
    }
  }
});

test("돌린 책상 — 책 받침대의 바닥 줄이 책상 윗면(밝은 나무) 위에 있다(넓힌 그림과 견줌)", async () => {
  for (const [deskId, spots] of Object.entries(HIDEOUT_TURN_TABLETOP)) {
    const art = hideoutTurnArt(deskId), { x, y, width } = spots.bookstand;
    const { data, info } = await sharp(file(art.src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const row = y - 2;
    for (let px = Math.round(x - width / 2); px <= Math.round(x + width / 2); px += 1) {
      const i = (row * info.width + px) * 4;
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      assert.ok(data[i + 3] >= 128 && lum >= 120, `${deskId} — 받침대 바닥(${px}, ${row})이 책상 윗면이 아님`);
    }
  }
});

test("책상을 옮기고 뒤집고 돌리면 책 받침대가 따라간다 · 벽 선반을 옮기면 위의 소품이 따라간다", () => {
  const layout = { ...LAYOUTS.forest };
  const home = hideoutSceneProps(layout);
  const deskHome = propOf(home, "desk"), standHome = propOf(home, "bookstand");
  const moved = hideoutSceneProps(layout, { desk: { x: 600, y: 900 } });
  const stand = propOf(moved, "bookstand");
  assert.deepEqual([stand.x - 600, stand.y - 900], [standHome.x - deskHome.x, standHome.y - deskHome.y]);
  assert.equal(stand.z, Math.round(100 + 900) + 1, "책상보다 한 칸 위");
  const flipped = hideoutSceneProps(layout, { desk: { x: 600, y: 900, flip: true } });
  const mirror = propOf(flipped, "bookstand");
  assert.equal(mirror.x - 600, -(standHome.x - deskHome.x), "거울 자리");
  assert.equal(mirror.flip, true);
  assert.equal(propOf(flipped, "desk").flip, true);
  // 돌린 책상 — 돌린 그림의 픽셀 자리(받침대 바닥이 책상 윗면)
  for (const [deskId, spots] of Object.entries(HIDEOUT_TURN_TABLETOP)) {
    const props = hideoutSceneProps({ ...layout, desk: deskId }, { desk: { x: 600, y: 900, turn: true } });
    const desk = propOf(props, "desk"), art = hideoutTurnArt(deskId), k = desk.width / art.width;
    const item = propOf(props, "bookstand");
    assert.ok(Math.abs(item.x - (600 + (spots.bookstand.x - art.width / 2) * k)) < 1e-9, deskId);
    assert.ok(Math.abs(item.y - (900 + (spots.bookstand.y - art.height) * k)) < 1e-9, deskId);
    assert.equal(item.width, spots.bookstand.width);
  }
  // 벽 선반 — 위의 소품이 같은 만큼 옮겨 가고 선반 윗면에 놓임
  const shelfHome = home.filter((prop) => prop.parentUnit === "ledge-left");
  const shifted = hideoutSceneProps(layout, { "ledge-left": { x: HIDEOUT_DEFAULT_ANCHORS["ledge-left"].x + 80, y: HIDEOUT_DEFAULT_ANCHORS["ledge-left"].y - 40 } });
  const ledge = shifted.find((prop) => prop.unit === "ledge-left");
  for (const prop of shifted.filter((entry) => entry.parentUnit === "ledge-left")) {
    const before = shelfHome.find((entry) => entry.category === prop.category);
    assert.equal(prop.x - before.x, 80, prop.category);
    assert.ok(Math.abs(prop.y - (ledge.surfaceY + 0.5)) < 1e-9, prop.category);
  }
});

test("배치의 모양 다듬기 — 모르는 열쇠 · 빈 자리 · 정수가 아닌 자리 · 기본과 같은 칸을 버리고, 선반은 뒤집지 않고, 돌린 그림이 없으면 돌리지 않음", () => {
  const layout = { ...HIDEOUT_DEFAULT_LAYOUT };
  const shaped = hideoutArrangeShape({
    desk: { x: 400, y: 880, flip: true, extra: 1 }, rug: { x: 260.5, y: 850 }, chest: { x: 100, y: 900 }, nope: { x: 1, y: 1 },
    lamp: { x: HIDEOUT_DEFAULT_ANCHORS.lamp.x, y: HIDEOUT_DEFAULT_ANCHORS.lamp.y }, "ledge-left": { x: 700, y: 380, flip: true },
    plant: { x: 600, y: 640, turn: true }, shelf: { x: 1100, y: 600, turn: true }, wall: { x: -8, y: 200 },
  }, layout);
  assert.deepEqual(shaped, {
    desk: { x: 400, y: 880, flip: true }, shelf: { x: 1100, y: 600, turn: true }, plant: { x: 600, y: 640 }, "ledge-left": { x: 700, y: 380 },
  });
  assert.deepEqual(hideoutArrangeShape("x", layout), {});
  assert.equal(hideoutUnitFlips("ledge-right"), false);
  assert.equal(hideoutUnitFlips("door-plaque"), true);
  assert.equal(sameHideoutArrange({ desk: { x: 1, y: 2 } }, { desk: { x: 1, y: 2, flip: false } }), true);
  assert.equal(sameHideoutArrange({ desk: { x: 1, y: 2 } }, {}), false);
  // 저장된 방을 읽을 때도 모양만 다듬어 실음
  const room = normalizeHideoutRoom({ version: 2, layout, arrange: { desk: { x: 400, y: 880 }, chest: { x: 1, y: 1 } }, revision: 1 }, { level: 1 });
  assert.deepEqual(room.arrange, { desk: { x: 400, y: 880 } });
  assert.deepEqual(normalizeHideoutRoom(null, { level: 1 }).arrange, {});
});

const PROBE = { ...HIDEOUT_DEFAULT_LAYOUT, "desk-calendar": "desk-calendar-forest", chest: "chest-forest", clock: "clock-forest", "memo-board": "memo-board-forest" };
test("판정 — 바닥 · 벽 밖, 창문 가림, 가구 겹침, 벽 장식 크게 겹침, 포털 가림, 포털 길 막힘", () => {
  const code = (arrange) => hideoutArrangeProblem(PROBE, arrange)?.code ?? null;
  assert.equal(code({ desk: { x: 216, y: 304 } }), "floor", "책상을 벽에");
  assert.equal(code({ rug: { x: 760, y: 560 } }), "floor", "러그가 뒷벽에 걸침");
  assert.equal(code({ clock: { x: 992, y: 704 } }), "wall", "시계를 바닥에");
  assert.equal(code({ clock: { x: 304, y: 256 } }), "window", "시계로 창문을 가림");
  assert.equal(code({ chest: { x: 216, y: 792 } }), "overlap", "보물함을 책상 자리에");
  assert.equal(code({ clock: { x: 848, y: 296 } }), "wall-overlap", "시계를 액자 위에");
  assert.equal(code({ clock: { x: 880, y: 160 } }), null, "액자 모서리에 살짝 걸친 것은 됨");
  assert.equal(code({ plant: { x: 1416, y: 864 } }), "portal", "화분으로 포털을 가림");
  assert.equal(code({ "desk-calendar": { x: 1150, y: 800, turn: true }, desk: { x: 1150, y: 930, turn: true } }), "path", "침대 · 책상으로 포털 가는 길을 막음");
  assert.equal(code({ plant: { x: 600, y: 640 }, clock: { x: 1200, y: 240 }, "desk-calendar": { x: 1384, y: 704, turn: true } }), null);
  const issue = hideoutArrangeProblem(PROBE, { chest: { x: 216, y: 792 } });
  assert.equal(issue.unit, "chest");
  assert.match(issue.message, /겹쳐요/);
});

test("모든 테마 — 기본 자리는 '옮긴 것'으로 봐도(뒤집어도) 문제가 없다 · 포털을 한 칸 옮겨도", () => {
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    const arrange = {};
    for (const unit of HIDEOUT_UNITS) {
      const category = unit.startsWith("ledge-") ? "wall-shelf" : unit;
      if (!layout[category]) continue;
      const home = HIDEOUT_DEFAULT_ANCHORS[unit];
      arrange[unit] = hideoutUnitFlips(unit) ? { ...home, flip: true } : { x: home.x + HIDEOUT_GRID, y: home.y };
    }
    assert.equal(hideoutArrangeProblem(layout, arrange), null, name);
    // 포털 — 처음 자리에서 한 칸씩 옮겨도(옮기지 않은 가구 · 옮긴 가구 모두와) 문제가 없음
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const portal = { x: HIDEOUT_PORTAL_HOME.x + dx * HIDEOUT_GRID, y: HIDEOUT_PORTAL_HOME.y + dy * HIDEOUT_GRID };
      assert.equal(hideoutArrangeProblem(layout, { portal }), null, `${name} · 포털 ${JSON.stringify(portal)}`);
      assert.equal(hideoutArrangeProblem(layout, { ...arrange, portal }), null, `${name} · 가구를 옮긴 방의 포털 ${JSON.stringify(portal)}`);
    }
  }
});

test("포털 옮기기 — 배치의 'portal' 칸(자리만): 모양 다듬기 · 같은 배치 · 옮긴 포털의 자리 · 들어서는 타원", () => {
  const layout = { ...HIDEOUT_DEFAULT_LAYOUT };
  assert.deepEqual(HIDEOUT_ARRANGE_KEYS.at(-1), "portal");
  assert.deepEqual(HIDEOUT_DEFAULT_ANCHORS.portal, HIDEOUT_PORTAL_HOME);
  assert.deepEqual([HIDEOUT_RETURN_PORTAL.x, HIDEOUT_RETURN_PORTAL.y], [HIDEOUT_PORTAL_HOME.x, HIDEOUT_PORTAL_HOME.y], "처음 자리의 포털");
  // 모양 — 자리만 남기고 뒤집기 · 돌리기 · 낯선 칸은 버림, 처음 자리와 같거나 정수가 아니거나 장면 밖이면 칸이 없음
  assert.deepEqual(hideoutArrangeShape({ portal: { x: 400, y: 920, flip: true, turn: true, extra: 1 } }, layout), { portal: { x: 400, y: 920 } });
  for (const portal of [{ ...HIDEOUT_PORTAL_HOME }, { x: 400.5, y: 920 }, { x: 1600, y: 920 }, { x: -8, y: 920 }, "x", null]) {
    assert.deepEqual(hideoutArrangeShape({ portal }, layout), {}, JSON.stringify(portal));
  }
  // 소품 칸은 앞, 포털 칸은 맨 뒤(관대한 맞춤이 길이 막힌 까닭을 모를 때 뒤에서부터 되돌림)
  assert.deepEqual(Object.keys(hideoutArrangeShape({ portal: { x: 400, y: 920 }, desk: { x: 760, y: 1000 } }, layout)), ["desk", "portal"]);
  assert.equal(sameHideoutArrange({ portal: { x: 400, y: 920 } }, {}), false);
  assert.equal(sameHideoutArrange({ portal: { x: 400, y: 920 } }, { portal: { x: 400, y: 920 } }), true);
  assert.deepEqual(normalizeHideoutRoom({ version: 2, layout, arrange: { portal: { x: 400, y: 920 } }, revision: 0 }, { level: 1 }).arrange, { portal: { x: 400, y: 920 } });
  // 자리 · 칸 넣기
  assert.deepEqual(hideoutPortalPlacement({}), HIDEOUT_PORTAL_HOME);
  assert.deepEqual(hideoutPortalPlacement({ portal: { x: 400, y: 920 } }), { x: 400, y: 920 });
  assert.deepEqual(hideoutUnitPlacement({}, "portal"), { ...HIDEOUT_PORTAL_HOME, flip: false, turn: false });
  assert.deepEqual(hideoutWithEntry({}, "portal", { x: 400, y: 920, flip: true, turn: true }), { portal: { x: 400, y: 920 } }, "포털은 자리만");
  assert.deepEqual(hideoutWithEntry({ portal: { x: 400, y: 920 } }, "portal", { ...HIDEOUT_PORTAL_HOME }), {}, "처음 자리면 칸을 지움");
  // 옮긴 포털 — 그림 · 범위 · 타원은 그대로, 자리만
  assert.equal(hideoutReturnPortal({}), HIDEOUT_RETURN_PORTAL);
  assert.equal(hideoutReturnPortal(null), HIDEOUT_RETURN_PORTAL);
  const gate = hideoutReturnPortal({ portal: { x: 400, y: 920 } });
  assert.deepEqual({ ...gate, x: HIDEOUT_RETURN_PORTAL.x, y: HIDEOUT_RETURN_PORTAL.y }, { ...HIDEOUT_RETURN_PORTAL });
  assert.deepEqual([gate.x, gate.y], [400, 920]);
  assert.equal(hideoutAtReturnPortal({ x: 400, y: 920 }, 0, gate), true);
  assert.equal(hideoutAtReturnPortal({ x: 400, y: 920 }), false, "처음 자리의 포털이 아님");
  assert.equal(hideoutAtReturnPortal(HIDEOUT_PORTAL_HOME, 0, gate), false);
  assert.equal(hideoutAtReturnPortal({ x: 400, y: 920 }, 0, { x: NaN, y: 920, rx: 75, ry: 57 }), false);
});

test("포털 옮기기 — 판정: 바닥 밖 · 가구 위 · 캐릭터가 들어오는 자리 · 길 / 가구는 옛 포털 자리를 쓰고 옮긴 포털은 가리지 않음", () => {
  const issue = (arrange) => hideoutArrangeProblem(PROBE, arrange);
  const code = (arrange) => issue(arrange)?.code ?? null;
  assert.equal(code({ portal: { x: 400, y: 920 } }), null, "왼쪽 아래 빈 바닥");
  assert.equal(code({ portal: { x: 1000, y: 720 } }), null, "뒤쪽 가운데 빈 바닥");
  assert.equal(code({ portal: { x: 760, y: 400 } }), "floor", "벽에");
  assert.equal(code({ portal: { x: 760, y: 1000 } }), "floor", "바닥 아래 끝 너머");
  assert.equal(code({ portal: { x: 30, y: 900 } }), "floor", "왼쪽 벽에 걸침");
  assert.equal(code({ portal: { x: 760, y: 850 } }), "spawn", "방 가운데(캐릭터가 들어오는 자리)");
  assert.equal(code({ portal: { x: HIDEOUT_SPAWN.x + 140, y: HIDEOUT_SPAWN.y } }), null, "들어오는 자리 옆은 됨");
  assert.equal(code({ portal: { x: 216, y: 760 } }), "overlap", "옮기지 않은 책상 위");
  assert.deepEqual([issue({ portal: { x: 216, y: 760 } }).unit, issue({ portal: { x: 760, y: 850 } }).unit], ["portal", "portal"]);
  assert.match(issue({ portal: { x: 760, y: 850 } }).message, /캐릭터가 들어오는 자리/);
  // 포털을 옮기면 옛 자리는 가구가 쓰고, 옮긴 자리는 가구가 가리지 못함
  assert.equal(code({ plant: { x: 1416, y: 864 } }), "portal", "처음 자리의 포털을 가림");
  assert.equal(code({ portal: { x: 400, y: 920 }, plant: { x: 1416, y: 864 } }), null, "옛 포털 자리에 화분");
  assert.equal(code({ portal: { x: 1000, y: 720 }, plant: { x: 1000, y: 780 } }), "portal", "화분으로 옮긴 포털을 가림");
  assert.equal(issue({ portal: { x: 1000, y: 720 }, plant: { x: 1000, y: 780 } }).unit, "plant");
  // 길 — 침대 · 책상으로 막은 오른쪽 구석에 포털을 두면 막히고, 막히지 않은 곳으로 옮기면 같은 가구 배치도 됨
  const wall = { "desk-calendar": { x: 1150, y: 800, turn: true }, desk: { x: 1150, y: 930, turn: true } };
  assert.equal(code(wall), "path");
  assert.equal(code({ ...wall, portal: { x: 1400, y: 760 } }), "path");
  assert.equal(code({ ...wall, portal: { x: 400, y: 920 } }), null);
  assert.equal(hideoutPortalReachable(PROBE, { ...wall, portal: { x: 400, y: 920 } }), true);
  // 하나만 볼 때(끌어 놓는 포털) — 포털의 자리와 길만
  assert.equal(hideoutArrangeProblem(PROBE, { portal: { x: 216, y: 760 } }, { only: "portal" })?.code, "overlap");
  assert.equal(hideoutArrangeProblem(PROBE, { portal: { x: 400, y: 920 } }, { only: "portal" }), null);
});

test("포털 옮기기 — 빈자리 찾기 · 방향키 · 엄격한 확인(저장) · 관대한 맞춤(읽을 때)", () => {
  // 막힌 자리에서 가까운 빈자리 — 그 자리는 문제가 없고 칸에 맞춤
  for (const from of [{ x: 216, y: 760 }, { x: 760, y: 850 }]) {
    const spot = hideoutFindSpot(PROBE, {}, "portal", { from, radius: 400 });
    assert.ok(spot, JSON.stringify(from));
    assert.equal(hideoutArrangeProblem(PROBE, { portal: spot }), null, JSON.stringify(spot));
    assert.ok(Math.hypot(spot.x - from.x, spot.y - from.y) < 200, JSON.stringify(spot));
  }
  // 방향키 — 한 칸씩, 바닥 끝에서는 더 못 감
  assert.deepEqual(hideoutNudge(PROBE, {}, "portal", -1, 0), { x: HIDEOUT_PORTAL_HOME.x - HIDEOUT_GRID, y: HIDEOUT_PORTAL_HOME.y });
  let here = {};
  for (let i = 0; i < 20; i += 1) {
    const next = hideoutNudge(PROBE, here, "portal", 1, 0);
    if (!next) break;
    here = hideoutWithEntry(here, "portal", next);
  }
  assert.equal(hideoutNudge(PROBE, here, "portal", 1, 0), null, "오른쪽 벽 쪽으로는 더 못 감");
  assert.equal(hideoutArrangeProblem(PROBE, here), null);
  // 엄격한 확인 — 모양 · 자리 · 문제
  assert.deepEqual(validateHideoutArrange(PROBE, { portal: { x: 400, y: 920 } }), { portal: { x: 400, y: 920 } });
  assert.deepEqual(validateHideoutArrange(PROBE, { portal: { ...HIDEOUT_PORTAL_HOME } }), {});
  for (const portal of [{ x: 400, y: 920, flip: true }, { x: 400, y: 920, turn: false }, { x: 400.5, y: 920 }, { x: -8, y: 920 }, { x: 400 }, "x"]) {
    assert.throws(() => validateHideoutArrange(PROBE, { portal }), { code: "reading/invalid-hideout" }, JSON.stringify(portal));
  }
  assert.throws(() => validateHideoutArrange(PROBE, { portal: { x: 400.5, y: 920 } }), { message: /포털의 자리/ });
  assert.throws(() => validateHideoutArrange(PROBE, { portal: { x: 760, y: 850 } }), { code: "reading/hideout-arrange", message: /캐릭터가 들어오는 자리/ });
  assert.throws(() => validateHideoutArrange(PROBE, { portal: { x: 216, y: 760 } }), { code: "reading/hideout-arrange", message: /겹쳐요/ });
  // 관대한 맞춤 — 못 서는 포털은 처음 자리로(옮긴 가구는 그대로), 처음 자리를 옮긴 가구가 차지했으면 그 가구도 제자리로
  assert.deepEqual(settleHideoutArrange(PROBE, { portal: { x: 216, y: 760 }, plant: { x: 600, y: 640 } }), { plant: { x: 600, y: 640 } });
  assert.deepEqual(settleHideoutArrange(PROBE, { portal: { x: 400, y: 920 }, plant: { x: 1416, y: 864 } }), { plant: { x: 1416, y: 864 }, portal: { x: 400, y: 920 } });
  const crowded = settleHideoutArrange(PROBE, { portal: { x: 216, y: 760 }, plant: { x: 1416, y: 864 } });
  assert.equal(hideoutArrangeProblem(PROBE, crowded), null);
  assert.deepEqual(crowded, {});
});

test("돌린 모습 — 기본 자리에서 겹치면 가까운 빈자리를 찾고, 그 자리는 문제가 없다", () => {
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    for (const slot of HIDEOUT_TURN_SLOTS) {
      if (!layout[slot]) continue;
      const atHome = hideoutWithEntry({}, slot, { ...HIDEOUT_DEFAULT_ANCHORS[slot], turn: true });
      if (!hideoutArrangeProblem(layout, atHome)) continue;
      const spot = hideoutFindSpot(layout, {}, slot, { patch: { turn: true } });
      assert.ok(spot, `${name} · ${slot} — 빈자리가 없음`);
      const placed = hideoutWithEntry({}, slot, { ...spot, turn: true });
      assert.equal(hideoutArrangeProblem(layout, placed), null, `${name} · ${slot}`);
      assert.ok(Math.hypot(spot.x - HIDEOUT_DEFAULT_ANCHORS[slot].x, spot.y - HIDEOUT_DEFAULT_ANCHORS[slot].y) < 160, `${name} · ${slot} — 너무 먼 자리`);
    }
  }
});

test("엄격한 확인(저장) — 모양이 어긋나면 거절, 문제가 있으면 그 까닭으로 거절, 통과하면 다듬은 배치", () => {
  const layout = { ...PROBE };
  const bad = [
    { nope: { x: 1, y: 1 } }, { desk: { x: 1, y: 1, extra: true } }, { desk: { x: 1.5, y: 2 } }, { desk: { x: -8, y: 2 } },
    { desk: { x: 8, y: 2, flip: "yes" } }, { "pet-water": { x: 760, y: 900 } }, { "ledge-left": { x: 700, y: 380, flip: true } },
    { plant: { x: 600, y: 640, turn: true } }, [], "desk",
  ];
  for (const raw of bad) assert.throws(() => validateHideoutArrange(layout, raw), { code: "reading/invalid-hideout" }, JSON.stringify(raw));
  assert.throws(() => validateHideoutArrange(layout, { chest: { x: 216, y: 792 } }), { code: "reading/hideout-arrange", message: /겹쳐요/ });
  assert.deepEqual(validateHideoutArrange(layout, undefined), {});
  assert.deepEqual(validateHideoutArrange(layout, { plant: { x: 600, y: 640 }, lamp: { ...HIDEOUT_DEFAULT_ANCHORS.lamp } }), { plant: { x: 600, y: 640 } });
});

test("관대한 맞춤(읽을 때 · 옛 화면 저장) — 문제가 되는 소품만 제자리로", () => {
  const settled = settleHideoutArrange(PROBE, { desk: { x: 1415, y: 820 }, plant: { x: 600, y: 640 }, chest: { x: 216, y: 792 } });
  assert.deepEqual(settled, { plant: { x: 600, y: 640 } });
  const blocked = settleHideoutArrange(PROBE, { "desk-calendar": { x: 1150, y: 800, turn: true }, desk: { x: 1150, y: 930, turn: true } });
  assert.equal(hideoutArrangeProblem(PROBE, blocked), null);
  assert.ok(Object.keys(blocked).length < 2);
});

test("빈자리 찾기 · 방향키 — 가구를 건너뛰어 다음 빈자리로, 칸(8px)에 맞춤", () => {
  const layout = { ...PROBE };
  const spot = hideoutFindSpot(layout, {}, "chest", { from: { x: 216, y: 792 } });
  assert.ok(spot);
  assert.equal(hideoutArrangeProblem(layout, hideoutWithEntry({}, "chest", spot)), null);
  assert.ok(Math.hypot(spot.x - 216, spot.y - 792) < 200);
  const step = hideoutNudge(layout, {}, "desk", 1, 0);
  assert.deepEqual(step, { x: HIDEOUT_DEFAULT_ANCHORS.desk.x + HIDEOUT_GRID, y: HIDEOUT_DEFAULT_ANCHORS.desk.y });
  // 왼쪽 끝 벽 쪽으로는 더 갈 수 없음
  let here = {};
  for (let i = 0; i < 40; i += 1) {
    const next = hideoutNudge(layout, here, "chest", -1, 0, 32);
    if (!next) break;
    here = hideoutWithEntry(here, "chest", next);
  }
  assert.equal(hideoutNudge(layout, here, "chest", -1, 0, 32), null);
  assert.deepEqual(hideoutSnap({ x: 213, y: 795 }), { x: 216, y: 792 });
  assert.deepEqual(hideoutUnitPlacement({}, "desk"), { ...HIDEOUT_DEFAULT_ANCHORS.desk, flip: false, turn: false });
  assert.deepEqual(hideoutWithEntry({ desk: { x: 1, y: 2 } }, "desk", null), {});
  assert.deepEqual(hideoutWithEntry({}, "desk", { ...HIDEOUT_DEFAULT_ANCHORS.desk }), {}, "기본 자리면 칸을 남기지 않음");
});

test("걷는 지도 — 옮긴 가구의 새 자리는 막히고 옛 자리는 열린다 · 창가 구석은 방석이 처음 자리일 때만 막힘", () => {
  const layout = { ...PROBE };
  const before = createHideoutWalkMap(layout), after = createHideoutWalkMap(layout, { desk: { x: 760, y: 1000 } });
  assert.equal(before.walkable(215, 760), false);
  assert.equal(after.walkable(215, 760), true);
  assert.equal(after.walkable(760, 960), false);
  assert.ok(before.colliders.some((shape) => shape.id === "window-nook"));
  assert.ok(!createHideoutWalkMap(layout, { bed: { x: 480, y: 640 } }).colliders.some((shape) => shape.id === "window-nook"));
});

test("뒤집은 문패 — 글자 띠도 거울로(장식이 반대쪽으로 감)", () => {
  for (const theme of HIDEOUT_THEMES) {
    const layout = { ...HIDEOUT_DEFAULT_LAYOUT, "door-plaque": `door-plaque-${theme.id}` };
    const plain = propOf(hideoutSceneProps(layout), "door-plaque");
    const flipped = propOf(hideoutSceneProps(layout, { "door-plaque": { ...HIDEOUT_DEFAULT_ANCHORS["door-plaque"], flip: true } }), "door-plaque");
    const a = hideoutPlaqueLabel(plain, "선생님"), b = hideoutPlaqueLabel(flipped, "선생님");
    assert.ok(Math.abs((a.x - plain.x) + (b.x - flipped.x)) < 1e-9, theme.id);
    assert.equal(a.fontSize, b.fontSize);
  }
});
