// 아지트 2단계(2026년 11월 · 선생님 요청) — 학생이 소품을 옮기고(끌기 · 방향키) 좌우로 뒤집고 돌릴 때의 판정입니다.
// 꾸미기 화면 · 체험반 · 서버가 같은 셈을 씁니다(서버는 저장할 때 다시 확인 — 화면을 거치지 않은 요청도 같은 규칙).
//   · 바닥 가구 · 러그는 방 바닥 안에(배경 그림의 바닥 — 뒷벽 아래 선과 비스듬한 옆벽 아래 선 안쪽), 벽 장식은 벽 안에
//     (천장 들보 아래 · 바닥 선 위)만 놓습니다. 벽 장식은 창문(커튼까지)을 가리지 않습니다.
//   · 바닥 가구끼리는 발자리가 겹치지 않고(같은 바닥을 둘이 차지할 수 없음), 벽 장식끼리는 크게(작은 쪽의 40% 넘게) 겹치지 않습니다.
//   · 바닥 가구 · 러그는 돌아가는 포털을 가리지 않습니다.
//   · 들어오는 자리(가까운 빈 바닥)에서 포털까지 걸어갈 길이 늘 남습니다.
// 겹침 · 창문 · 포털은 그림의 '보이는 상자'(투명 여백을 뺀 부분 — lib/readingHideoutBoxes.js)로 잽니다.
// 옮기지 않은(카탈로그 자리의) 소품끼리는 판정하지 않습니다 — 처음 배치는 사람이 맞춰 둔 것이라(예: 책갈피 걸이가 아래 진열
// 선반 끝에 살짝 걸침) 그 둘 가운데 하나를 옮길 때만 봅니다.
import {
  HIDEOUT_DEFAULT_ANCHORS, HIDEOUT_FLOOR_UNITS, HIDEOUT_SCENE, HIDEOUT_UNITS, HIDEOUT_WALL_UNITS,
  hideoutArrangeShape, hideoutArtBox, hideoutSceneProps, hideoutUnitCategory, hideoutUnitFlips,
} from "./readingHideout.js";
import { HIDEOUT_RETURN_PORTAL, HIDEOUT_SPAWN, createHideoutWalkMap, hideoutAtReturnPortal, hideoutFootprints } from "./readingHideoutMap.js";
import { hideoutTurnArt } from "./readingHideoutTurn.js";

// 끌어 놓을 때 맞춰 붙는 칸(장면 px) — 도트 그림이 반 칸에 걸쳐 흐려지지 않게 · 방향키 한 번에 한 칸.
export const HIDEOUT_GRID = 8;
// 가구가 설 수 있는 바닥 — 배경 그림의 바닥(뒷벽 아래 선 y 508 · 왼쪽 벽 아래 선 (60,508)→(0,692) · 오른쪽은 거울)에서 몇 px 안쪽.
export const HIDEOUT_PLACE_FLOOR = Object.freeze([[64, 516], [1472, 516], [1530, 700], [1530, 1020], [6, 1020], [6, 700]].map((p) => Object.freeze(p)));
// 벽 장식을 걸 수 있는 벽 — 천장 들보 아래부터 바닥 선 위까지(징두리 판 포함).
export const HIDEOUT_PLACE_WALL = Object.freeze({ x0: 4, y0: 72, x1: 1532, y1: 508 });
// 창문 — 커튼 봉 · 커튼 · 창틀(배경 그림에 그려져 있어 옮길 수 없음 · 창가 장식이 걸림).
export const HIDEOUT_WINDOW = Object.freeze({ x0: 84, y0: 84, x1: 552, y1: 426 });
const WALL_OVERLAP_MAX = 0.4;
const FLOOR_UNITS = new Set(HIDEOUT_FLOOR_UNITS), WALL_UNITS = new Set(HIDEOUT_WALL_UNITS);
// 돌아가는 포털의 보이는 부분(누르는 단추와 같은 상자)
const PORTAL_BOX = Object.freeze({
  x0: HIDEOUT_RETURN_PORTAL.x - HIDEOUT_RETURN_PORTAL.hit.width / 2, x1: HIDEOUT_RETURN_PORTAL.x + HIDEOUT_RETURN_PORTAL.hit.width / 2,
  y0: HIDEOUT_RETURN_PORTAL.y - HIDEOUT_RETURN_PORTAL.hit.height / 2, y1: HIDEOUT_RETURN_PORTAL.y + HIDEOUT_RETURN_PORTAL.hit.height / 2,
});

export const HIDEOUT_ARRANGE_MESSAGES = Object.freeze({
  floor: "바닥 안쪽에만 놓을 수 있어요.",
  wall: "벽의 빈 곳에만 걸 수 있어요.",
  window: "창문을 가리지 않게 걸어 주세요.",
  scene: "방 밖으로 나가지 않게 놓아 주세요.",
  overlap: "다른 가구와 겹쳐요. 조금 떨어뜨려 놓아 주세요.",
  "wall-overlap": "다른 벽 장식과 많이 겹쳐요. 조금 떨어뜨려 걸어 주세요.",
  portal: "포털을 가리지 않게 놓아 주세요.",
  path: "포털까지 걸어갈 길이 막혀요. 지나갈 길을 남겨 주세요.",
});
const problem = (unit, code) => ({ unit, code, message: HIDEOUT_ARRANGE_MESSAGES[code] });

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const area = (box) => Math.max(0, box.x1 - box.x0) * Math.max(0, box.y1 - box.y0);
const meet = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const union = (boxes) => boxes.reduce((all, box) => ({
  x0: Math.min(all.x0, box.x0), y0: Math.min(all.y0, box.y0), x1: Math.max(all.x1, box.x1), y1: Math.max(all.y1, box.y1),
}));
const insideEllipse = (e, x, y) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 < 1;
function shapesMeet(a, b) {
  if (a.kind === "rect" && b.kind === "rect") return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  if (a.kind === "rect") return shapesMeet(b, a);
  if (b.kind === "rect") {
    // 타원을 단위 원으로 펴서 네모의 가장 가까운 점이 원 안인가
    const X0 = (b.x0 - a.cx) / a.rx, X1 = (b.x1 - a.cx) / a.rx, Y0 = (b.y0 - a.cy) / a.ry, Y1 = (b.y1 - a.cy) / a.ry;
    const px = Math.max(X0, Math.min(0, X1)), py = Math.max(Y0, Math.min(0, Y1));
    return px * px + py * py < 1;
  }
  if (insideEllipse(a, b.cx, b.cy) || insideEllipse(b, a.cx, a.cy)) return true;
  for (let i = 0; i < 32; i += 1) {
    const t = i / 32 * Math.PI * 2;
    if (insideEllipse(a, b.cx + b.rx * Math.cos(t), b.cy + b.ry * Math.sin(t))) return true;
    if (insideEllipse(b, a.cx + a.rx * Math.cos(t), a.cy + a.ry * Math.sin(t))) return true;
  }
  return false;
}
// 겹침을 볼 때의 바닥 넓이 — 걷는 발자리(창가 구석은 빼고) + 밟고 지나가는 독서 쿠션의 바닥(겹쳐 놓지만 않게).
function spaceOf(prop) {
  if (prop.category === "cushion") return [{ id: "cushion", kind: "ellipse", cx: prop.x, cy: prop.y - prop.height * 0.25, rx: prop.width * 0.42, ry: prop.height * 0.25 }];
  return hideoutFootprints(prop).filter((shape) => shape.id !== "window-nook");
}

// 방의 소품을 배치 열쇠마다 묶습니다 — 벽 선반 · 책상은 위에 놓인 소품까지 한 묶음(함께 움직이고 함께 잼).
function groupsOf(props) {
  const groups = new Map();
  for (const prop of props) {
    const unit = prop.unit ?? prop.parentUnit;
    if (!unit) continue;
    if (!groups.has(unit)) groups.set(unit, { unit, main: null, all: [] });
    const group = groups.get(unit);
    group.all.push(prop);
    if (prop.unit) group.main = prop;
  }
  for (const [unit, group] of groups) if (!group.main) groups.delete(unit);
  return groups;
}
const visibleOf = (group) => union(group.all.map(hideoutArtBox));

// 한 묶음이 그 자리에서 지킬 것(다른 소품과의 겹침은 따로) — 문제가 없으면 null
function placeProblem(group) {
  const { unit, main } = group;
  const box = visibleOf(group);
  if (box.x0 < 0 || box.x1 > HIDEOUT_SCENE.width || box.y0 < 0 || main.y > HIDEOUT_SCENE.height) return problem(unit, "scene");
  if (WALL_UNITS.has(unit)) {
    const wall = HIDEOUT_PLACE_WALL;
    if (box.x0 < wall.x0 || box.x1 > wall.x1 || box.y0 < wall.y0 || box.y1 > wall.y1) return problem(unit, "wall");
    if (meet(box, HIDEOUT_WINDOW) > 0) return problem(unit, "window");
    return null;
  }
  const art = hideoutArtBox(main);
  const inset = (art.x1 - art.x0) * 0.1;
  const feet = unit === "rug"
    // 러그는 통째로 바닥에 깔림 — 보이는 상자의 네 귀(둥근 러그라 15% 안쪽)가 모두 바닥 안
    ? [[art.x0 + (art.x1 - art.x0) * 0.15, art.y0 + (art.y1 - art.y0) * 0.15], [art.x1 - (art.x1 - art.x0) * 0.15, art.y0 + (art.y1 - art.y0) * 0.15],
      [art.x0 + (art.x1 - art.x0) * 0.15, main.y], [art.x1 - (art.x1 - art.x0) * 0.15, main.y]]
    : [[art.x0 + inset, main.y], [main.x, main.y], [art.x1 - inset, main.y]];
  if (!feet.every(([x, y]) => insidePolygon(x, y, HIDEOUT_PLACE_FLOOR))) return problem(unit, "floor");
  // 발자리(바닥을 차지하는 넓이)가 뒷벽 속으로 파고들지 않게 — 세로로 놓은 침대를 뒷벽에 너무 붙이면 머리 쪽이 벽 안으로 들어감.
  // 창가 방석의 처음 자리처럼 벽 선에 살짝 걸친 것(40px 안)은 그대로 둡니다.
  if (group.all.flatMap(spaceOf).some((shape) => (shape.kind === "rect" ? shape.y0 : shape.cy - shape.ry) < HIDEOUT_PLACE_FLOOR[0][1] - 40)) {
    return problem(unit, "floor");
  }
  if (meet(art, PORTAL_BOX) > 0) return problem(unit, "portal");
  return null;
}

// 두 묶음이 서로 겹치면 문제(한쪽이라도 옮긴 것일 때만 부름)
function meetProblem(a, b) {
  if (FLOOR_UNITS.has(a.unit) && FLOOR_UNITS.has(b.unit)) {
    const sa = a.all.flatMap(spaceOf), sb = b.all.flatMap(spaceOf);
    return sa.some((p) => sb.some((q) => shapesMeet(p, q)));
  }
  if (WALL_UNITS.has(a.unit) && WALL_UNITS.has(b.unit)) {
    const pa = visibleOf(a), pb = visibleOf(b);
    return meet(pa, pb) > WALL_OVERLAP_MAX * Math.min(area(pa), area(pb));
  }
  return false;
}

/** 들어오는 자리(가까운 빈 바닥)에서 포털까지 걸어갈 길이 있는가. */
export function hideoutPortalReachable(layout, arrange) {
  const map = createHideoutWalkMap(layout, arrange);
  const start = map.nearest(HIDEOUT_SPAWN.x, HIDEOUT_SPAWN.y);
  if (!map.walkable(start.x, start.y)) return false;
  const route = map.path(start, { x: HIDEOUT_RETURN_PORTAL.x, y: HIDEOUT_RETURN_PORTAL.y });
  return route.length > 0 && hideoutAtReturnPortal(route.at(-1));
}

/**
 * 배치의 첫 문제 — { unit, code, message } 또는 null. 옮긴 소품(배치에 칸이 있는 것)마다 자리 · 겹침을 보고, 끝으로 포털까지의 길을 봅니다.
 * only를 주면 그 소품의 자리 · 겹침만 봅니다(끌어 놓는 소품 하나 — 길은 늘 봄).
 */
export function hideoutArrangeProblem(layout, arrange, { only = null } = {}) {
  const groups = groupsOf(hideoutSceneProps(layout, arrange));
  const moved = (unit) => !!arrange && Object.hasOwn(arrange, unit) && groups.has(unit);
  const units = only ? [only].filter(moved) : HIDEOUT_UNITS.filter(moved);
  for (const unit of units) {
    const group = groups.get(unit);
    const issue = placeProblem(group);
    if (issue) return issue;
    for (const [other, peer] of groups) {
      if (other === unit) continue;
      if (meetProblem(group, peer)) return problem(unit, FLOOR_UNITS.has(unit) ? "overlap" : "wall-overlap");
    }
  }
  return hideoutPortalReachable(layout, arrange) ? null : problem(only, "path");
}

function invalid(message, code = "reading/invalid-hideout") {
  return Object.assign(new Error(message), { code, status: 400 });
}
const plain = (value) => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/**
 * 저장하려는 배치를 엄격히 확인합니다(서버 · 체험반의 저장) — 모양이 어긋나면(모르는 열쇠 · 정수가 아닌 자리 · 빈 자리의 소품 ·
 * 돌린 그림이 없는 소품의 turn) 거절하고, 자리 · 겹침 · 길에 문제가 있으면 그 까닭으로 거절합니다. 통과하면 다듬은 배치를 돌려줍니다.
 */
export function validateHideoutArrange(layout, raw) {
  if (raw == null) return {};
  if (!plain(raw)) throw invalid("아지트의 배치 정보를 확인해 주세요.");
  for (const unit of Reflect.ownKeys(raw)) {
    if (typeof unit !== "string" || !HIDEOUT_UNITS.includes(unit)) throw invalid("옮길 수 없는 소품이 들어 있어요.");
    const entry = raw[unit];
    if (!plain(entry) || Reflect.ownKeys(entry).some((key) => !["x", "y", "flip", "turn"].includes(key))) throw invalid("아지트의 배치 정보를 확인해 주세요.");
    const { x, y, flip, turn } = entry;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height) {
      throw invalid("소품의 자리를 확인해 주세요.");
    }
    if ((flip !== undefined && typeof flip !== "boolean") || (turn !== undefined && typeof turn !== "boolean")) throw invalid("아지트의 배치 정보를 확인해 주세요.");
    const itemId = layout?.[hideoutUnitCategory(unit)];
    if (!itemId) throw invalid("빈 자리의 소품은 옮길 수 없어요.");
    if (flip && !hideoutUnitFlips(unit)) throw invalid("이 소품은 뒤집을 수 없어요.");
    if (turn && !hideoutTurnArt(itemId)) throw invalid("이 소품은 돌릴 수 없어요.");
  }
  const arrange = hideoutArrangeShape(raw, layout);
  const issue = hideoutArrangeProblem(layout, arrange);
  if (issue) throw invalid(issue.message, "reading/hideout-arrange");
  return arrange;
}

/**
 * 읽어 온 배치를 쓸 수 있게 맞춥니다(관대 — 방을 열 때 · 옛 화면이 배치 없이 소품만 바꿔 저장할 때). 모양을 다듬고, 문제가 되는
 * 소품은 제자리로 돌려(칸을 지움) 문제가 없어질 때까지 되풀이합니다. 길이 막힌 까닭이 어느 소품인지 모르면 옮긴 소품을 하나씩 돌립니다.
 */
export function settleHideoutArrange(layout, raw) {
  let arrange = hideoutArrangeShape(raw, layout);
  for (let guard = 0; guard <= HIDEOUT_UNITS.length; guard += 1) {
    const issue = hideoutArrangeProblem(layout, arrange);
    if (!issue) return arrange;
    const unit = issue.unit && Object.hasOwn(arrange, issue.unit) ? issue.unit : Object.keys(arrange).at(-1);
    if (!unit) return arrange;
    const { [unit]: _dropped, ...rest } = arrange;
    arrange = rest;
  }
  return {};
}

/** 배치에 한 소품의 칸을 넣은 새 배치 — 기본 자리 · 뒤집기 없음 · 돌리기 없음이면 칸을 지웁니다(patch가 null이면 제자리로). */
export function hideoutWithEntry(arrange, unit, patch) {
  const next = { ...(plain(arrange) ? arrange : {}) };
  if (patch == null) { delete next[unit]; return next; }
  const home = HIDEOUT_DEFAULT_ANCHORS[unit];
  const entry = { x: Math.round(patch.x), y: Math.round(patch.y), ...(patch.flip ? { flip: true } : {}), ...(patch.turn ? { turn: true } : {}) };
  if (entry.x === home.x && entry.y === home.y && !entry.flip && !entry.turn) delete next[unit];
  else next[unit] = entry;
  return next;
}

/** 지금 그 소품이 서 있는 자리 · 방향(배치에 칸이 없으면 기본 자리). */
export function hideoutUnitPlacement(arrange, unit) {
  const entry = plain(arrange) && Object.hasOwn(arrange, unit) ? arrange[unit] : null;
  const home = HIDEOUT_DEFAULT_ANCHORS[unit];
  return { x: entry?.x ?? home.x, y: entry?.y ?? home.y, flip: entry?.flip === true, turn: entry?.turn === true };
}

const snap = (value) => Math.round(value / HIDEOUT_GRID) * HIDEOUT_GRID;

// 후보 자리를 차례로 재어 처음으로 문제없는 자리 — 값싼 판정(자리 · 겹침)을 먼저 하고 길은 그다음에.
function firstFit(layout, arrange, unit, candidates, base) {
  for (const [x, y] of candidates) {
    const next = hideoutWithEntry(arrange, unit, { ...base, x, y });
    const groups = groupsOf(hideoutSceneProps(layout, next));
    const group = groups.get(unit);
    if (!group || placeProblem(group)) continue;
    let clash = false;
    for (const [other, peer] of groups) if (other !== unit && meetProblem(group, peer)) { clash = true; break; }
    if (clash) continue;
    if (hideoutArrangeProblem(layout, next, { only: unit })) continue;
    return { x, y };
  }
  return null;
}

/**
 * 가까운 빈자리 — from(기본: 지금 자리)에서 가까운 차례로 칸(16px)을 훑어 문제없는 첫 자리를 돌려줍니다(없으면 null).
 * 새 소품을 놓았는데 그 자리를 다른 가구가 차지했을 때 · 돌렸더니 옆 가구와 겹칠 때 · 제자리로 돌리려는데 막혔을 때 씁니다.
 * patch로 뒤집기 · 돌리기를 함께 바꿀 수 있습니다.
 */
export function hideoutFindSpot(layout, arrange, unit, { from = null, patch = null, radius = 720, step = 16 } = {}) {
  const now = hideoutUnitPlacement(arrange, unit);
  const base = { ...now, ...(patch || {}) };
  const origin = from ?? { x: now.x, y: now.y };
  const candidates = [];
  for (let dy = -radius; dy <= radius; dy += step) for (let dx = -radius; dx <= radius; dx += step) {
    const d = Math.hypot(dx, dy);
    if (d > radius) continue;
    const x = dx === 0 && dy === 0 ? Math.round(origin.x) : snap(origin.x + dx), y = dx === 0 && dy === 0 ? Math.round(origin.y) : snap(origin.y + dy);
    if (x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height) continue;
    candidates.push([x, y, d]);
  }
  candidates.sort((a, b) => a[2] - b[2]);
  return firstFit(layout, arrange, unit, candidates, base);
}

/**
 * 방향키로 한 칸 — 그 쪽으로 step만큼씩 나아가며 처음으로 문제없는 자리(가구를 건너뛸 수 있게). 끝까지 없으면 null.
 */
export function hideoutNudge(layout, arrange, unit, dx, dy, step = HIDEOUT_GRID) {
  const now = hideoutUnitPlacement(arrange, unit);
  const candidates = [];
  for (let k = 1; k <= 200; k += 1) {
    const x = Math.round(now.x + dx * step * k), y = Math.round(now.y + dy * step * k);
    if (x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height) break;
    candidates.push([x, y]);
  }
  return firstFit(layout, arrange, unit, candidates, now);
}

/** 끌어 놓은 자리(장면 좌표)를 칸에 맞춥니다. */
export const hideoutSnap = (point) => ({ x: snap(point.x), y: snap(point.y) });
