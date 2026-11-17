// 아지트 2단계(2026년 11월 · 선생님 요청) — 학생이 소품을 옮기고(끌기 · 방향키) 좌우로 뒤집고 돌릴 때의 판정입니다.
// 꾸미기 화면 · 체험반 · 서버가 같은 셈을 씁니다(서버는 저장할 때 다시 확인 — 화면을 거치지 않은 요청도 같은 규칙).
//   · 바닥 가구 · 러그는 방 바닥 안에(배경 그림의 바닥 — 뒷벽 아래 선과 비스듬한 옆벽 아래 선 안쪽), 벽 장식은 벽 안에
//     (천장 들보 아래 · 바닥 선 위)만 놓습니다. 벽 장식은 창문(커튼까지)을 가리지 않습니다.
//   · 바닥 가구끼리는 발자리가 겹치지 않고(같은 바닥을 둘이 차지할 수 없음), 벽 장식끼리는 크게(작은 쪽의 40% 넘게) 겹치지 않습니다.
//   · 바닥 가구 · 러그는 돌아가는 포털을 가리지 않습니다.
//   · 들어오는 자리(가까운 빈 바닥)에서 포털까지 걸어갈 길이 늘 남습니다.
//   · 포털도 옮깁니다(2026년 11월 · 선생님 요청 — 배치의 'portal' 칸, 자리만): 보이는 포털이 바닥 안에 들고, 가구 · 러그와
//     겹치지 않고(옮기지 않은 가구까지), 캐릭터가 들어오는 자리(방 가운데)에서 떨어져 있어야 합니다. 걸어갈 길은 위와 같은 판정.
//   · 작은 소품을 가구 위에 올립니다(2026년 11월 · 선생님 요청 — "책상 위, 선반 위, 책장 위에도"): 배치 칸 { on, at }. 소품의
//     보이는 폭 양쪽 10% 안쪽 끝이 그 윗면 안이고(자리가 모자라면 못 올림), 같은 윗면의 다른 소품과 겹치지 않고, 천장에 닿지 않고,
//     벽 선반 위의 소품은 창문 · 다른 벽 장식을 가리지 않습니다. 가구 위의 소품은 바닥을 차지하지 않아 길과 무관합니다.
//     받치는 가구를 옮기거나 돌리면 위의 소품이 따라가므로, 그 가구를 볼 때 위의 소품도 함께 봅니다.
// 겹침 · 창문 · 포털은 그림의 '보이는 상자'(투명 여백을 뺀 부분 — lib/readingHideoutBoxes.js)로 잽니다.
// 옮기지 않은(카탈로그 자리의) 소품끼리는 판정하지 않습니다 — 처음 배치는 사람이 맞춰 둔 것이라(예: 책갈피 걸이가 아래 진열
// 선반 끝에 살짝 걸침) 그 둘 가운데 하나를 옮길 때만 봅니다.
import {
  HIDEOUT_ARRANGE_KEYS, HIDEOUT_DEFAULT_ANCHORS, HIDEOUT_FLOOR_UNITS, HIDEOUT_PORTAL_UNIT, HIDEOUT_SCENE, HIDEOUT_SURFACE_UNITS, HIDEOUT_TOP_HOME,
  HIDEOUT_TOP_STEPS, HIDEOUT_TOPPERS, HIDEOUT_TOP_UNITS, HIDEOUT_UNITS, HIDEOUT_WALL_UNITS,
  hideoutArrangeShape, hideoutArtBox, hideoutSceneProps, hideoutSurfaces, hideoutTopAt, hideoutTopRange, hideoutUnitCategory, hideoutUnitFlips,
} from "./readingHideout.js";
import {
  HIDEOUT_FOOT_RADIUS, HIDEOUT_SPAWN, createHideoutWalkMap, hideoutAtReturnPortal, hideoutFootprints, hideoutReturnPortal,
} from "./readingHideoutMap.js";
import { hideoutTurnArt } from "./readingHideoutTurn.js";

// 끌어 놓을 때 맞춰 붙는 칸(장면 px) — 도트 그림이 반 칸에 걸쳐 흐려지지 않게 · 방향키 한 번에 한 칸.
export const HIDEOUT_GRID = 8;
// 가구가 설 수 있는 바닥 — 배경 그림의 바닥(뒷벽 아래 선 y 508 · 왼쪽 벽 아래 선 (60,508)→(0,692) · 오른쪽은 거울)에서 몇 px 안쪽.
export const HIDEOUT_PLACE_FLOOR = Object.freeze([[64, 516], [1472, 516], [1530, 700], [1530, 1020], [6, 1020], [6, 700]].map((p) => Object.freeze(p)));
// 벽 장식을 걸 수 있는 벽 — 천장 들보 아래부터 바닥 선 위까지(징두리 판 포함). 가구 위에 올린 소품도 들보(y0) 아래까지만.
export const HIDEOUT_PLACE_WALL = Object.freeze({ x0: 4, y0: 72, x1: 1532, y1: 508 });
// 창문 — 커튼 봉 · 커튼 · 창틀(배경 그림에 그려져 있어 옮길 수 없음 · 창가 장식이 걸림).
export const HIDEOUT_WINDOW = Object.freeze({ x0: 84, y0: 84, x1: 552, y1: 426 });
// 끄는 소품의 바닥 가운데가 윗면의 줄에서 위아래로 이만큼 안이면(좌우는 윗면 끝에서 16px 안) 그 윗면에 붙습니다.
export const HIDEOUT_TOP_SNAP = 48;
const WALL_OVERLAP_MAX = 0.4;
// 같은 윗면의 두 소품이 이만큼(px)까지는 맞닿아도 됨(보이는 상자 끝의 흐린 테두리)
const TOP_TOUCH = 2;
const FLOOR_UNITS = new Set(HIDEOUT_FLOOR_UNITS), WALL_UNITS = new Set(HIDEOUT_WALL_UNITS);
const TOPPERS = new Set(HIDEOUT_TOPPERS), TOP_ONLY = new Set(HIDEOUT_TOP_UNITS), LEDGES = new Set(["ledge-left", "ledge-right"]);
// 돌아가는 포털의 보이는 부분(누르는 단추와 같은 상자) — gate는 옮긴 자리의 포털(hideoutReturnPortal)
const portalBox = (gate) => ({
  x0: gate.x - gate.hit.width / 2, x1: gate.x + gate.hit.width / 2,
  y0: gate.y - gate.hit.height / 2, y1: gate.y + gate.hit.height / 2,
});
// 보이는 포털(타원)의 둘레 점 열여섯 — 모두 바닥 안이어야 포털을 놓습니다(비스듬한 옆벽 쪽에서 네모 귀만 보면 너무 엄격함)
const PORTAL_RIM = Object.freeze(Array.from({ length: 16 }, (_, i) => Object.freeze([Math.cos(i / 8 * Math.PI), Math.sin(i / 8 * Math.PI)])));

export const HIDEOUT_ARRANGE_MESSAGES = Object.freeze({
  floor: "바닥 안쪽에만 놓을 수 있어요.",
  wall: "벽의 빈 곳에만 걸 수 있어요.",
  window: "창문을 가리지 않게 걸어 주세요.",
  scene: "방 밖으로 나가지 않게 놓아 주세요.",
  overlap: "다른 가구와 겹쳐요. 조금 떨어뜨려 놓아 주세요.",
  "wall-overlap": "다른 벽 장식과 많이 겹쳐요. 조금 떨어뜨려 걸어 주세요.",
  portal: "포털을 가리지 않게 놓아 주세요.",
  spawn: "캐릭터가 들어오는 자리(방 가운데)와 너무 가까워요. 조금 떨어뜨려 놓아 주세요.",
  path: "포털까지 걸어갈 길이 막혀요. 지나갈 길을 남겨 주세요.",
  // 가구 위에 올리기
  "top-only": "책상 · 책장 · 선반 위에만 놓을 수 있어요.",
  narrow: "그 위에는 이 소품이 들어갈 자리가 모자라요.",
  "top-overlap": "위에 놓인 다른 소품과 겹쳐요. 조금 떨어뜨려 놓아 주세요.",
  ceiling: "천장에 닿지 않게 놓아 주세요.",
  "top-window": "창문을 가리지 않게 놓아 주세요.",
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
  if (prop.parentUnit) return [];   // 가구 위에 올린 소품은 바닥을 차지하지 않음
  if (prop.category === "cushion") return [{ id: "cushion", kind: "ellipse", cx: prop.x, cy: prop.y - prop.height * 0.25, rx: prop.width * 0.42, ry: prop.height * 0.25 }];
  return hideoutFootprints(prop).filter((shape) => shape.id !== "window-nook");
}

// 방의 소품을 배치 열쇠마다 묶습니다 — 책상 · 책장 · 벽 선반은 위에 놓인 소품까지 한 묶음(함께 움직이고 함께 잼).
// 위에 놓인 소품도 저마다 제 묶음이 있습니다(그 소품 하나 — 따로 옮길 때 씀).
function groupsOf(props) {
  const groups = new Map();
  for (const prop of props) if (prop.unit) groups.set(prop.unit, { unit: prop.unit, main: prop, all: [prop] });
  for (const prop of props) if (prop.parentUnit && groups.has(prop.parentUnit)) groups.get(prop.parentUnit).all.push(prop);
  return groups;
}
const visibleOf = (group) => union(group.all.map(hideoutArtBox));

// 한 묶음이 그 자리에서 지킬 것(다른 소품과의 겹침은 따로) — 문제가 없으면 null. gate는 지금 자리의 포털.
function placeProblem(group, gate) {
  const { unit, main } = group;
  // 늘 가구 위에 서는 소품이 바닥(공중)에 — 끄는 동안의 미리보기 · 화면을 거치지 않은 요청에서만
  if (TOP_ONLY.has(unit)) return problem(unit, "top-only");
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
  if (meet(art, portalBox(gate)) > 0) return problem(unit, "portal");
  return null;
}

// 가구 위에 올린 소품이 그 자리에서 지킬 것 — 윗면에 들어가는가(양쪽 10% 안쪽) · 방 안 · 천장 아래 · 벽 선반 위면 창문을 가리지 않음.
// 같은 윗면의 다른 소품 · 벽 장식과의 겹침은 따로(meetCode).
function topProblem(group, surfaces) {
  const { unit, main } = group;
  const surface = surfaces.get(main.parentUnit);
  if (!surface) return problem(unit, "top-only");
  const range = hideoutTopRange(surface, main.src, main.width, main.flip);
  if (range.hi < range.lo - 0.5) return problem(unit, "narrow");
  const box = hideoutArtBox(main);
  if (box.x0 < 0 || box.x1 > HIDEOUT_SCENE.width || box.y0 < 0) return problem(unit, "scene");
  if (box.y0 < HIDEOUT_PLACE_WALL.y0) return problem(unit, "ceiling");
  if (LEDGES.has(main.parentUnit) && meet(box, HIDEOUT_WINDOW) > 0) return problem(unit, "top-window");
  return null;
}

// 포털을 놓는 자리가 지킬 것 — 보이는 포털(타원)이 바닥 안에 들고, 캐릭터가 들어오는 자리(HIDEOUT_SPAWN)가 들어서는 타원에서
// 발 반지름만큼 떨어져 있고(들어오자마자 포털 위에 서지 않게), 바닥 가구 · 러그의 보이는 상자와 겹치지 않을 것 — 옮기지 않은
// 가구까지 봅니다(포털을 가구 위로 옮길 수는 없음 · 가구가 포털을 가리는 것은 placeProblem이 봄). 걸어갈 길은 따로.
function portalPlaceProblem(gate, groups) {
  const rx = gate.hit.width / 2, ry = gate.hit.height / 2;
  if (!PORTAL_RIM.every(([c, s]) => insidePolygon(gate.x + rx * c, gate.y + ry * s, HIDEOUT_PLACE_FLOOR))) return problem(HIDEOUT_PORTAL_UNIT, "floor");
  if (hideoutAtReturnPortal(HIDEOUT_SPAWN, HIDEOUT_FOOT_RADIUS, gate)) return problem(HIDEOUT_PORTAL_UNIT, "spawn");
  const box = portalBox(gate);
  for (const group of groups.values()) {
    if (FLOOR_UNITS.has(group.unit) && !group.main.parentUnit && meet(hideoutArtBox(group.main), box) > 0) return problem(HIDEOUT_PORTAL_UNIT, "overlap");
  }
  return null;
}

// 두 묶음이 서로 겹치면 그 까닭(한쪽이라도 옮긴 것일 때만 부름) — 겹치지 않으면 null.
function meetCode(a, b) {
  const aOn = a.main.parentUnit, bOn = b.main.parentUnit;
  if (aOn || bOn) {
    // 가구 위에 올린 소품 — 같은 윗면의 소품끼리(한 줄에 서므로 좌우만 봄). 가구 · 바닥 · 다른 가구 위의 소품과는 겹쳐 보여도 됨
    if (aOn && bOn) {
      if (aOn !== bOn) return null;
      const pa = hideoutArtBox(a.main), pb = hideoutArtBox(b.main);
      return Math.min(pa.x1, pb.x1) - Math.max(pa.x0, pb.x0) > TOP_TOUCH ? "top-overlap" : null;
    }
    // 벽 선반 위의 소품은 벽에 붙은 것 — 다른 벽 장식(다른 벽 선반과 그 위 소품 포함, 받치는 선반은 빼고)과 크게 겹치지 않게
    const lifted = aOn ? a : b, other = aOn ? b : a;
    if (LEDGES.has(lifted.main.parentUnit) && WALL_UNITS.has(other.unit) && other.unit !== lifted.main.parentUnit) {
      const pa = hideoutArtBox(lifted.main), pb = visibleOf(other);
      return meet(pa, pb) > WALL_OVERLAP_MAX * Math.min(area(pa), area(pb)) ? "wall-overlap" : null;
    }
    return null;
  }
  if (FLOOR_UNITS.has(a.unit) && FLOOR_UNITS.has(b.unit)) {
    const sa = a.all.flatMap(spaceOf), sb = b.all.flatMap(spaceOf);
    return sa.some((p) => sb.some((q) => shapesMeet(p, q))) ? "overlap" : null;
  }
  if (WALL_UNITS.has(a.unit) && WALL_UNITS.has(b.unit)) {
    const pa = visibleOf(a), pb = visibleOf(b);
    return meet(pa, pb) > WALL_OVERLAP_MAX * Math.min(area(pa), area(pb)) ? "wall-overlap" : null;
  }
  return null;
}

// 걷는 지도 위에서 들어오는 자리(가까운 빈 바닥)부터 포털(gate)까지 걸어가 들어서는 타원 안에 닿는가.
function portalReachable(map, gate) {
  const start = map.nearest(HIDEOUT_SPAWN.x, HIDEOUT_SPAWN.y);
  if (!map.walkable(start.x, start.y)) return false;
  const route = map.path(start, { x: gate.x, y: gate.y });
  return route.length > 0 && hideoutAtReturnPortal(route.at(-1), 0, gate);
}
/** 들어오는 자리(가까운 빈 바닥)에서 포털(옮겼으면 옮긴 자리)까지 걸어갈 길이 있는가. */
export function hideoutPortalReachable(layout, arrange) {
  return portalReachable(createHideoutWalkMap(layout, arrange), hideoutReturnPortal(arrange));
}

/**
 * 배치의 첫 문제 — { unit, code, message } 또는 null. 옮긴 소품(배치에 칸이 있는 것)마다 자리 · 겹침을 보고, 포털을 옮겼으면
 * 그 자리를 보고, 끝으로 포털까지의 길을 봅니다. only를 주면 그 소품(또는 'portal')만 봅니다(끌어 놓는 것 하나 — 길은 늘 봄,
 * 가구 위에 올린 소품 하나면 길은 보지 않음 · 받치는 가구면 그 위에 올린 소품도 함께 봄).
 */
export function hideoutArrangeProblem(layout, arrange, { only = null } = {}) {
  const props = hideoutSceneProps(layout, arrange);
  const groups = groupsOf(props);
  const surfaces = hideoutSurfaces(props);
  const gate = hideoutReturnPortal(arrange);
  const has = (key) => !!arrange && Object.hasOwn(arrange, key);
  const moved = (unit) => has(unit) && groups.has(unit);
  // 받치는 가구를 옮기거나 돌리면 위에 올린 소품이 따라가므로(윗면이 좁아질 수 있음) 그 소품들도 봅니다.
  const riders = only ? HIDEOUT_UNITS.filter((unit) => unit !== only && moved(unit) && groups.get(unit).main.parentUnit === only) : [];
  const units = only ? [only, ...riders].filter(moved) : HIDEOUT_UNITS.filter(moved);
  for (const unit of units) {
    const group = groups.get(unit);
    const issue = group.main.parentUnit ? topProblem(group, surfaces) : placeProblem(group, gate);
    if (issue) return issue;
    for (const [other, peer] of groups) {
      if (other === unit) continue;
      const code = meetCode(group, peer);
      if (code) return problem(unit, code);
    }
  }
  if ((only ?? HIDEOUT_PORTAL_UNIT) === HIDEOUT_PORTAL_UNIT && has(HIDEOUT_PORTAL_UNIT)) {
    const issue = portalPlaceProblem(gate, groups);
    if (issue) return issue;
  }
  // 가구 위에 올린 소품 하나 — 바닥을 차지하지 않아 걷는 길과 무관합니다(길 찾기는 판정에서 가장 무거움).
  if (only && only !== HIDEOUT_PORTAL_UNIT && groups.get(only)?.main.parentUnit) return null;
  return portalReachable(createHideoutWalkMap(layout, arrange), gate) ? null : problem(only, "path");
}

function invalid(message, code = "reading/invalid-hideout") {
  return Object.assign(new Error(message), { code, status: 400 });
}
const plain = (value) => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/**
 * 저장하려는 배치를 엄격히 확인합니다(서버 · 체험반의 저장) — 모양이 어긋나면(모르는 열쇠 · 정수가 아닌 자리 · 빈 자리의 소품 ·
 * 돌린 그림이 없는 소품의 turn · 포털의 뒤집기 · 돌리기 · 올릴 수 없는 소품이나 윗면 · 늘 가구 위에 서는 소품의 바닥 자리) 거절하고,
 * 자리 · 겹침 · 길에 문제가 있으면 그 까닭으로 거절합니다. 통과하면 다듬은 배치를 돌려줍니다.
 */
export function validateHideoutArrange(layout, raw) {
  if (raw == null) return {};
  if (!plain(raw)) throw invalid("아지트의 배치 정보를 확인해 주세요.");
  for (const unit of Reflect.ownKeys(raw)) {
    if (typeof unit !== "string" || !HIDEOUT_ARRANGE_KEYS.includes(unit)) throw invalid("옮길 수 없는 소품이 들어 있어요.");
    const entry = raw[unit];
    const portal = unit === HIDEOUT_PORTAL_UNIT;
    const lifted = plain(entry) && Object.hasOwn(entry, "on");
    const allowed = portal ? ["x", "y"] : lifted ? ["on", "at", "flip"] : ["x", "y", "flip", "turn"];
    if (!plain(entry) || Reflect.ownKeys(entry).some((key) => !allowed.includes(key))) throw invalid("아지트의 배치 정보를 확인해 주세요.");
    if (lifted) {
      // 가구 위에 올린 소품 — { on: 윗면, at: 0~1000 정수, flip? }
      const { on, at, flip } = entry;
      if (!TOPPERS.has(unit) || !HIDEOUT_SURFACE_UNITS.includes(on)) throw invalid("그 소품은 그곳에 올릴 수 없어요.");
      if (!Number.isSafeInteger(at) || at < 0 || at > HIDEOUT_TOP_STEPS) throw invalid("소품의 자리를 확인해 주세요.");
      if (flip !== undefined && typeof flip !== "boolean") throw invalid("아지트의 배치 정보를 확인해 주세요.");
      if (!layout?.[hideoutUnitCategory(unit)]) throw invalid("빈 자리의 소품은 옮길 수 없어요.");
      continue;
    }
    if (TOP_ONLY.has(unit)) throw invalid(HIDEOUT_ARRANGE_MESSAGES["top-only"]);
    const { x, y, flip, turn } = entry;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height) {
      throw invalid(portal ? "포털의 자리를 확인해 주세요." : "소품의 자리를 확인해 주세요.");
    }
    if (portal) continue;
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
 * 소품(또는 포털)은 제자리로 돌려(칸을 지움) 문제가 없어질 때까지 되풀이합니다. 길이 막힌 까닭이 어느 것인지 모르면 옮긴 것을
 * 뒤에서부터 하나씩 돌립니다(포털 칸이 맨 뒤).
 */
export function settleHideoutArrange(layout, raw) {
  let arrange = hideoutArrangeShape(raw, layout);
  for (let guard = 0; guard <= HIDEOUT_ARRANGE_KEYS.length; guard += 1) {
    const issue = hideoutArrangeProblem(layout, arrange);
    if (!issue) return arrange;
    const unit = issue.unit && Object.hasOwn(arrange, issue.unit) ? issue.unit : Object.keys(arrange).at(-1);
    if (!unit) return arrange;
    const { [unit]: _dropped, ...rest } = arrange;
    arrange = rest;
  }
  return {};
}

/**
 * 배치에 한 소품(또는 포털)의 칸을 넣은 새 배치 — 기본 자리 · 뒤집기 없음 · 돌리기 없음이면 칸을 지웁니다(patch가 null이면 제자리로).
 * 포털은 자리만 적습니다(뒤집기 · 돌리기를 버림). patch.on이 있으면 가구 위에 올린 칸 { on, at, flip? }(돌리기 없음)입니다 —
 * 바닥으로 내리는 patch는 on을 null로 주세요.
 */
export function hideoutWithEntry(arrange, unit, patch) {
  const next = { ...(plain(arrange) ? arrange : {}) };
  if (patch == null) { delete next[unit]; return next; }
  if (patch.on) {
    next[unit] = { on: patch.on, at: Math.max(0, Math.min(HIDEOUT_TOP_STEPS, Math.round(patch.at ?? HIDEOUT_TOP_STEPS / 2))), ...(patch.flip ? { flip: true } : {}) };
    return next;
  }
  const home = HIDEOUT_DEFAULT_ANCHORS[unit];
  const turns = unit !== HIDEOUT_PORTAL_UNIT;
  const entry = { x: Math.round(patch.x), y: Math.round(patch.y), ...(turns && patch.flip ? { flip: true } : {}), ...(turns && patch.turn ? { turn: true } : {}) };
  if (home && entry.x === home.x && entry.y === home.y && !entry.flip && !entry.turn) delete next[unit];
  else next[unit] = entry;
  return next;
}

/**
 * 지금 그 소품이 서 있는 자리 · 방향(배치에 칸이 없으면 기본 자리). 가구 위에 올린 소품은 { on, at, flip, turn: false } — 늘 가구 위에
 * 서는 소품이 처음 자리(칸 없음)면 at이 null입니다(그 가구 위의 정해진 자리).
 */
export function hideoutUnitPlacement(arrange, unit) {
  const entry = plain(arrange) && Object.hasOwn(arrange, unit) ? arrange[unit] : null;
  if (entry?.on) return { on: entry.on, at: entry.at, flip: entry.flip === true, turn: false };
  if (TOP_ONLY.has(unit) && !(entry && Number.isFinite(entry.x) && Number.isFinite(entry.y))) return { on: HIDEOUT_TOP_HOME[unit], at: null, flip: false, turn: false };
  const home = HIDEOUT_DEFAULT_ANCHORS[unit];
  return { x: entry?.x ?? home.x, y: entry?.y ?? home.y, flip: entry?.flip === true, turn: entry?.turn === true };
}

const snap = (value) => Math.round(value / HIDEOUT_GRID) * HIDEOUT_GRID;
const propOf = (props, unit) => props.find((prop) => prop.unit === unit) ?? null;

/**
 * 지금 자리 — hideoutUnitPlacement와 같되, 늘 가구 위에 서는 소품이 처음 자리(칸 없음)면 그 자리의 천분율(at)까지 채웁니다.
 * 뒤집기 · 소품 바꾸기처럼 '지금 자리 그대로' 칸을 적을 때의 바탕(at이 비면 윗면 가운데로 튐).
 */
export function hideoutPlacementNow(layout, arrange, unit) {
  const now = hideoutUnitPlacement(arrange, unit);
  if (!now.on || now.at != null) return now;
  const props = hideoutSceneProps(layout, arrange), prop = propOf(props, unit), surface = hideoutSurfaces(props).get(now.on);
  if (!prop || !surface || prop.parentUnit !== now.on) return { ...now, at: HIDEOUT_TOP_STEPS / 2 };
  return { ...now, at: hideoutTopAt(surface, hideoutTopRange(surface, prop.src, prop.width, prop.flip), prop.x) };
}

// 후보 자리를 차례로 재어 처음으로 문제없는 자리 — 값싼 판정(자리 · 겹침)을 먼저 하고 길은 그다음에.
// candidates는 patch들({ x, y } 또는 가구 위 { on, at } · 바닥으로 내리는 { on: null, x, y })이고, 찾은 patch를 그대로 돌려줍니다.
function firstFit(layout, arrange, unit, candidates, base) {
  if (unit === HIDEOUT_PORTAL_UNIT) {
    // 포털은 가구를 움직이지 않으므로 방의 소품 · 걷는 지도를 한 번만 세고, 후보마다 포털 자리만 바꿔 봅니다.
    const groups = groupsOf(hideoutSceneProps(layout, arrange));
    const map = createHideoutWalkMap(layout, arrange);
    for (const { x, y } of candidates) {
      const gate = hideoutReturnPortal({ [HIDEOUT_PORTAL_UNIT]: { x, y } });
      if (portalPlaceProblem(gate, groups) || !portalReachable(map, gate)) continue;
      return { x, y };
    }
    return null;
  }
  const gate = hideoutReturnPortal(arrange);
  for (const patch of candidates) {
    const next = hideoutWithEntry(arrange, unit, { ...base, ...patch });
    const props = hideoutSceneProps(layout, next);
    const groups = groupsOf(props);
    const group = groups.get(unit);
    if (!group) continue;
    if (group.main.parentUnit ? topProblem(group, hideoutSurfaces(props)) : placeProblem(group, gate)) continue;
    let clash = false;
    for (const [other, peer] of groups) if (other !== unit && meetCode(group, peer)) { clash = true; break; }
    if (clash) continue;
    if (hideoutArrangeProblem(layout, next, { only: unit })) continue;
    return patch;
  }
  return null;
}

// 소품이 서 있는(또는 placement대로 놓일) 자리의 장면 좌표(그림의 바닥 가운데) — 가구 위 · 바닥 모두.
function pointOf(layout, arrange, unit, placement) {
  if (!placement) return null;
  if (!placement.on) return Number.isFinite(placement.x) && Number.isFinite(placement.y) ? { x: placement.x, y: placement.y } : null;
  const next = placement.at == null ? arrange : hideoutWithEntry(arrange, unit, placement);
  const prop = propOf(hideoutSceneProps(layout, next), unit);
  return prop ? { x: prop.x, y: prop.y } : null;
}

// 윗면 on 위의 후보 자리들(4px 간격 · point에서 radius 안) — [{ patch: { on, at }, d }]
function surfaceCandidates(layout, arrange, unit, on, base, point, radius) {
  const probe = hideoutSceneProps(layout, hideoutWithEntry(arrange, unit, { on, at: 0, flip: !!base.flip }));
  const surface = hideoutSurfaces(probe).get(on), prop = propOf(probe, unit);
  if (!surface || !prop) return [];
  const range = hideoutTopRange(surface, prop.src, prop.width, prop.flip);
  if (range.hi < range.lo) return [];
  const span = range.hi - range.lo, count = Math.max(1, Math.ceil(span / 4));
  const seen = new Set(), list = [];
  for (let i = 0; i <= count; i += 1) {
    const x = range.lo + span * i / count, d = Math.hypot(x - point.x, surface.y - point.y);
    if (d > radius) continue;
    const at = hideoutTopAt(surface, range, x);
    if (seen.has(at)) continue;
    seen.add(at);
    list.push({ patch: { on, at }, d });
  }
  return list;
}
// 바닥 후보(가구 위에서 내려놓는 소품) — point 둘레의 칸(16px), 위쪽은 below면 point보다 아래만
function floorCandidates(point, radius, step, below = false) {
  const list = [];
  for (let dy = -radius; dy <= radius; dy += step) for (let dx = -radius; dx <= radius; dx += step) {
    const d = Math.hypot(dx, dy);
    if (d > radius) continue;
    const x = snap(point.x + dx), y = snap(point.y + dy);
    if (x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height || (below && y <= point.y)) continue;
    list.push({ patch: { on: null, x, y }, d });
  }
  return list;
}
// 가구 위에 올릴 수 있는 소품의 후보 — target(어디로: 'floor' · 윗면)이 없으면 from이 있는 곳(가구 위 자리면 그 윗면, 바닥의
// 점이면 바닥 — 늘 가구 위에 서는 소품은 모든 윗면), from도 없으면 지금 있는 곳에서 찾습니다. 가까운 차례.
function topperCandidates(layout, arrange, unit, base, { from, radius, step, target }) {
  const point = pointOf(layout, arrange, unit, from) ?? pointOf(layout, arrange, unit, base);
  if (!point) return [];
  const on = from ? from.on || "floor" : base.on || "floor";
  const where = target ? [target] : on !== "floor" ? [on] : TOP_ONLY.has(unit) ? HIDEOUT_SURFACE_UNITS : ["floor"];
  const list = [];
  for (const place of where) {
    if (place === "floor") { if (!TOP_ONLY.has(unit)) list.push(...floorCandidates(point, Math.min(radius, 720), step)); }
    else list.push(...surfaceCandidates(layout, arrange, unit, place, base, point, radius));
  }
  return list.sort((a, b) => a.d - b.d).map((entry) => entry.patch);
}

/**
 * 가까운 빈자리 — from(기본: 지금 자리)에서 가까운 차례로 칸(16px)을 훑어 문제없는 첫 자리를 돌려줍니다(없으면 null).
 * 새 소품을 놓았는데 그 자리를 다른 가구가 차지했을 때 · 돌렸더니 옆 가구와 겹칠 때 · 제자리로 돌리려는데 막혔을 때 씁니다.
 * patch로 뒤집기 · 돌리기를 함께 바꿀 수 있습니다. 가구 위에 올릴 수 있는 소품은 target('floor' 또는 윗면 — 없으면 지금 있는 곳)
 * 에서 찾고 patch({ on, at } 또는 { on: null, x, y })를 돌려줍니다 — from은 장면 좌표 { x, y } 또는 가구 위 자리 { on, at }.
 */
export function hideoutFindSpot(layout, arrange, unit, { from = null, patch = null, radius = 720, step = 16, target = null } = {}) {
  const now = hideoutUnitPlacement(arrange, unit);
  const base = { ...now, ...(patch || {}) };
  if (TOPPERS.has(unit)) return firstFit(layout, arrange, unit, topperCandidates(layout, arrange, unit, base, { from, radius, step, target }), base);
  const origin = from ?? { x: now.x, y: now.y };
  const candidates = [];
  for (let dy = -radius; dy <= radius; dy += step) for (let dx = -radius; dx <= radius; dx += step) {
    const d = Math.hypot(dx, dy);
    if (d > radius) continue;
    const x = dx === 0 && dy === 0 ? Math.round(origin.x) : snap(origin.x + dx), y = dx === 0 && dy === 0 ? Math.round(origin.y) : snap(origin.y + dy);
    if (x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height) continue;
    candidates.push({ x, y, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  return firstFit(layout, arrange, unit, candidates.map(({ x, y }) => ({ x, y })), base);
}

/**
 * 방향키로 한 칸 — 그 쪽으로 step만큼씩 나아가며 처음으로 문제없는 자리(가구를 건너뛸 수 있게). 끝까지 없으면 null.
 * 가구 위에 올린 소품은 ← → 로 그 윗면을 따라 옮기고(다른 소품을 건너뜀), ↑ ↓ 로 위아래의 다른 윗면(가까운 차례)으로 건너가며,
 * 바닥에도 서는 소품은 ↓ 로 바닥에 내려놓습니다(돌려주는 patch는 { on, at } 또는 { on: null, x, y }).
 */
export function hideoutNudge(layout, arrange, unit, dx, dy, step = HIDEOUT_GRID) {
  const now = hideoutUnitPlacement(arrange, unit);
  if (TOPPERS.has(unit) && now.on) {
    const props = hideoutSceneProps(layout, now.at == null ? arrange : hideoutWithEntry(arrange, unit, now));
    const surfaces = hideoutSurfaces(props), prop = propOf(props, unit), here = surfaces.get(now.on);
    if (!prop || !here) return null;
    const point = { x: prop.x, y: prop.y };
    if (!dy) {
      const range = hideoutTopRange(here, prop.src, prop.width, prop.flip);
      const atNow = hideoutTopAt(here, range, point.x), seen = new Set([atNow]), candidates = [];
      for (let k = 1; k <= 400; k += 1) {
        const x = point.x + dx * step * k;
        if (x < range.lo - 0.01 || x > range.hi + 0.01) break;
        const at = hideoutTopAt(here, range, x);
        if (seen.has(at)) continue;
        seen.add(at);
        candidates.push({ on: now.on, at });
      }
      return firstFit(layout, arrange, unit, candidates, now);
    }
    const list = [];
    for (const [on, surface] of surfaces) {
      if (on === now.on || (dy < 0 ? surface.y >= here.y - 1 : surface.y <= here.y + 1)) continue;
      list.push(...surfaceCandidates(layout, arrange, unit, on, now, point, 4000));
    }
    if (dy > 0 && !TOP_ONLY.has(unit)) list.push(...floorCandidates(point, 720, 16, true));
    return firstFit(layout, arrange, unit, list.sort((a, b) => a.d - b.d).map((entry) => entry.patch), now);
  }
  const candidates = [];
  for (let k = 1; k <= 200; k += 1) {
    const x = Math.round(now.x + dx * step * k), y = Math.round(now.y + dy * step * k);
    if (x < 0 || y < 0 || x > HIDEOUT_SCENE.width || y > HIDEOUT_SCENE.height) break;
    candidates.push({ x, y });
  }
  return firstFit(layout, arrange, unit, candidates, now);
}

/**
 * 끄는 동안 — 가구 위에 올릴 수 있는 소품의 바닥 가운데(point · 장면 좌표)가 어느 윗면 가까이(줄에서 위아래 HIDEOUT_TOP_SNAP 안 ·
 * 윗면 끝에서 16px 안)면 그 윗면의 자리 { on, at }(가장 가까운 줄), 아니면 null.
 */
export function hideoutTopTarget(layout, arrange, unit, point) {
  if (!TOPPERS.has(unit) || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const now = hideoutUnitPlacement(arrange, unit);
  let best = null;
  for (const on of HIDEOUT_SURFACE_UNITS) {
    const probe = hideoutSceneProps(layout, hideoutWithEntry(arrange, unit, { on, at: 0, flip: !!now.flip }));
    const surface = hideoutSurfaces(probe).get(on), prop = propOf(probe, unit);
    if (!surface || !prop) continue;
    const gap = Math.abs(point.y - surface.y);
    if (gap > HIDEOUT_TOP_SNAP || point.x < surface.x0 - 16 || point.x > surface.x1 + 16 || (best && gap >= best.gap)) continue;
    best = { gap, on, at: hideoutTopAt(surface, hideoutTopRange(surface, prop.src, prop.width, prop.flip), point.x) };
  }
  return best ? { on: best.on, at: best.at } : null;
}

/** 끌어 놓은 자리(장면 좌표)를 칸에 맞춥니다. */
export const hideoutSnap = (point) => ({ x: snap(point.x), y: snap(point.y) });
