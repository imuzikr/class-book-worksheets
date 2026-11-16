// Avatar feet move locally. Neither the route nor the position is persisted or broadcast.
import { HIDEOUT_DEFAULT_ANCHORS, HIDEOUT_OCCUPANTS, HIDEOUT_SCENE, HIDEOUT_DEFAULT_LAYOUT, hideoutSceneProps } from "./readingHideout.js";
import { createWalkMap } from "./readingWalkMap.js";

export const HIDEOUT_FOOT_RADIUS = 48;
export const HIDEOUT_FLOOR = Object.freeze([
  [90, 550], [1400, 550], [1500, 650], [1500, 990], [40, 990], [40, 620],
].map((point) => Object.freeze(point)));
// 교실로 돌아가는 포털 — width × height는 그림(portal.webp 640×280)을 맞춰 놓는 상자, hit은 누르면 포털로 걸어가는 단추,
// rx · ry는 발이 들어서면 교실로 건너가는 타원입니다. 도트 포털의 그림 · 누르는 범위 · 들어서는 타원을 함께
// 1.5배 키웠습니다(선생님 요청). 가운데는 그대로 두고, 누르는 범위는 투명 여백을 뺀 보이는 포털에 맞춥니다.
// 도는 빛은 상자 폭의 절반에 얹습니다(hideout.css — 안쪽 청록 소용돌이 안에 듦).
export const HIDEOUT_RETURN_PORTAL = Object.freeze({
  id: "to-classroom", to: "classroom", label: "교실로", x: 1415, y: 820,
  width: 228, height: 114, hit: Object.freeze({ width: 156, height: 99 }), rx: 75, ry: 57,
  src: "/reading-plaza/portal.webp", swirl: "/reading-plaza/portal-swirl.webp",
});
export const HIDEOUT_SPAWN = Object.freeze({ x: HIDEOUT_OCCUPANTS.character.x, y: HIDEOUT_OCCUPANTS.character.y });
export function hideoutAtReturnPortal(point, padding = 0) {
  if (!point || ![point.x, point.y, padding].every(Number.isFinite) || padding < 0) return false;
  const gate = HIDEOUT_RETURN_PORTAL;
  return ((point.x - gate.x) / (gate.rx + padding)) ** 2 + ((point.y - gate.y) / (gate.ry + padding)) ** 2 <= 1;
}
const rect = (id, x0, y0, x1, y1) => ({ id, kind: "rect", x0, y0, x1, y1 });
const FURNITURE_FOOT = Object.freeze({
  "desk-calendar": Object.freeze({ kind: "rect", w: 0.48, h: 0.45 }), // 독서 침대 — 옆으로 긴 침대의 바닥 전체
  "badge-display": Object.freeze({ kind: "rect", w: 0.47, h: 0.15 }), // 스탠드 어항 — 수납장 바닥
  "pencil-caddy": Object.freeze({ kind: "ellipse", w: 0.45, h: 0.12 }), // 1인 독서 소파
  "pet-water": Object.freeze({ kind: "ellipse", w: 0.44, h: 0.12 }), // 독서 텐트
  "cover-display": Object.freeze({ kind: "ellipse", w: 0.25, h: 0.07 }), // 큰 나무 화분 — 화분 밑동
  hourglass: Object.freeze({ kind: "ellipse", w: 0.3, h: 0.04 }), // 지구본 스탠드 — 세 다리
});
// 돌린 그림(아지트 2단계)의 발자리 — 같은 셈(그림의 바닥 가운데에서 폭 · 높이의 비율), 그림을 보고 잼.
//   세로 침대는 머리판 아래부터 발치까지(그림 높이의 72%)가 바닥이고, 의자가 앞에 놓인 책상은 책상 다리부터 의자 다리까지입니다.
const TURNED_FOOT = Object.freeze({
  "desk-calendar": Object.freeze({ kind: "rect", w: 0.46, h: 0.72 }),
  desk: Object.freeze({ kind: "rect", w: 0.48, h: 0.42 }),
});
const ellipse = (id, cx, cy, rx, ry) => ({ id, kind: "ellipse", cx, cy, rx, ry });
const SMALL_FOOT = new Set(["pet-toys", "terrarium", "travel-case", "chest"]);
/**
 * 한 소품의 발자리(걸어 지나갈 수 없는 바닥) — 네모 { kind: "rect", x0, y0, x1, y1 } 또는 타원 { kind: "ellipse", cx, cy, rx, ry }.
 * 러그 · 독서 쿠션 · 벽 장식처럼 밟고 지나가는(또는 바닥에 서지 않는) 소품은 빈 목록입니다. 펫 방석이 처음 자리(창가 구석)에 있으면
 * 그 뒤 구석(window-nook)도 막습니다 — 방석을 옮기면 구석은 그냥 바닥입니다.
 */
export function hideoutFootprints(prop) {
  if (!prop) return [];
  const { category, x, y, width, height } = prop;
  const turned = prop.turned ? TURNED_FOOT[category] : null;
  const foot = turned ?? FURNITURE_FOOT[category];
  if (foot) {
    return [foot.kind === "rect" ? rect(category, x - width * foot.w, y - height * foot.h, x + width * foot.w, y)
      : ellipse(category, x, y - height * foot.h, width * foot.w, height * foot.h)];
  }
  if (category === "desk") return [rect("desk", x - width / 2, y - width * 0.36, x + width / 2, y + 15)];
  if (category === "shelf") return [rect("shelf", x - width / 2, y - 45, x + width / 2, y + 15)];
  if (category === "bed") {
    const home = HIDEOUT_DEFAULT_ANCHORS.bed;
    return [ellipse("bed", x, y - 45, width / 2, width * 0.26),
      ...(x === home.x && y === home.y ? [rect("window-nook", 0, 0, x + width / 2, y + 20)] : [])];
  }
  if (category === "lamp") return [ellipse("lamp", x, y - 10, width * 0.2, width * 0.16)];
  if (category === "plant") return [ellipse("plant", x, y - 10, width * 0.3, width * 0.22)];
  if (SMALL_FOOT.has(category)) return [ellipse(category, x, y - 6, width * 0.42, Math.min(22, width * 0.2))];
  return [];
}
function collidersFor(layout, arrange) {
  // 바닥 가구(2026년 11월 — 자리 이름은 예전 작은 소품 그대로)의 발자리: 그림의 바닥 가운데(x, y)에서 폭 · 높이의 비율로
  // 잰 바닥 넓이입니다(그림을 보고 잼). 네모는 바닥 가운데에서 좌우 w · 위로 h, 타원은 바닥에 닿는 반지름 w · h.
  return hideoutSceneProps(layout, arrange).filter((prop) => prop.unit).flatMap(hideoutFootprints);
}
function insidePolygon(x, y) {
  let inside = false;
  for (let i = 0, j = HIDEOUT_FLOOR.length - 1; i < HIDEOUT_FLOOR.length; j = i++) {
    const [xi, yi] = HIDEOUT_FLOOR[i], [xj, yj] = HIDEOUT_FLOOR[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function touchesFurniture(x, y, colliders) {
  return colliders.some((obstacle) => {
    if (obstacle.kind === "rect") {
      const nearX = Math.max(obstacle.x0, Math.min(obstacle.x1, x));
      const nearY = Math.max(obstacle.y0, Math.min(obstacle.y1, y));
      return Math.hypot(x - nearX, y - nearY) <= HIDEOUT_FOOT_RADIUS;
    }
    return ((x - obstacle.cx) / (obstacle.rx + HIDEOUT_FOOT_RADIUS)) ** 2
      + ((y - obstacle.cy) / (obstacle.ry + HIDEOUT_FOOT_RADIUS)) ** 2 <= 1;
  });
}
export function createHideoutWalkMap(layout = HIDEOUT_DEFAULT_LAYOUT, arrange = null) {
  const colliders = Object.freeze(collidersFor(layout, arrange).map((entry) => Object.freeze(entry)));
  const navigation = createWalkMap({
    width: HIDEOUT_SCENE.width, height: HIDEOUT_SCENE.height, cell: 16, spawn: HIDEOUT_SPAWN,
    isWalkable: (x, y) => x >= 110 && x <= 1420 && insidePolygon(x, y)
      && HIDEOUT_FLOOR.every((a, i) => segmentDistance(x, y, a, HIDEOUT_FLOOR[(i + 1) % HIDEOUT_FLOOR.length]) > HIDEOUT_FOOT_RADIUS)
      && !touchesFurniture(x, y, colliders),
  });
  return Object.freeze({ width: HIDEOUT_SCENE.width, height: HIDEOUT_SCENE.height, spawn: HIDEOUT_SPAWN, colliders, ...navigation });
}
export const HIDEOUT_WALK_MAP = createHideoutWalkMap();
export const HIDEOUT_COLLIDERS = HIDEOUT_WALK_MAP.colliders;
export const hideoutCanStand = (point) => !!point && HIDEOUT_WALK_MAP.walkable(point.x, point.y);
export const hideoutWalkPath = (from, destination) => HIDEOUT_WALK_MAP.path(from, destination);
export const hideoutNearest = (x, y) => HIDEOUT_WALK_MAP.nearest(x, y);
export const hideoutWalkStep = (from, dx, dy) => HIDEOUT_WALK_MAP.step(from, dx, dy);
export const hideoutStep = hideoutWalkStep;
