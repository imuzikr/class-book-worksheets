// Avatar feet move locally. Neither the route nor the position is persisted or broadcast.
import { HIDEOUT_OCCUPANTS, HIDEOUT_SCENE, HIDEOUT_DEFAULT_LAYOUT, hideoutSceneProps } from "./readingHideout.js";
import { createWalkMap } from "./readingWalkMap.js";

export const HIDEOUT_FOOT_RADIUS = 48;
export const HIDEOUT_FLOOR = Object.freeze([
  [90, 550], [1400, 550], [1500, 650], [1500, 990], [40, 990], [40, 620],
].map((point) => Object.freeze(point)));
export const HIDEOUT_RETURN_PORTAL = Object.freeze({
  id: "to-classroom", to: "classroom", label: "교실로", x: 1415, y: 820,
  width: 152, height: 76, rx: 72, ry: 38,
  src: "/reading-plaza/portal.webp", swirl: "/reading-plaza/portal-swirl.webp",
});
export const HIDEOUT_SPAWN = Object.freeze({ x: HIDEOUT_OCCUPANTS.character.x, y: HIDEOUT_OCCUPANTS.character.y });
export function hideoutAtReturnPortal(point, padding = 0) {
  if (!point || ![point.x, point.y, padding].every(Number.isFinite) || padding < 0) return false;
  const gate = HIDEOUT_RETURN_PORTAL;
  return ((point.x - gate.x) / (gate.rx + padding)) ** 2 + ((point.y - gate.y) / (gate.ry + padding)) ** 2 <= 1;
}
const rect = (id, x0, y0, x1, y1) => ({ id, kind: "rect", x0, y0, x1, y1 });
const ellipse = (id, cx, cy, rx, ry) => ({ id, kind: "ellipse", cx, cy, rx, ry });
function collidersFor(layout) {
  const props = hideoutSceneProps(layout), get = (category) => props.find((entry) => entry.category === category);
  const result = [];
  const desk = get("desk"), shelf = get("shelf"), bed = get("bed"), lamp = get("lamp"), plant = get("plant");
  if (desk) result.push(rect("desk", desk.x - desk.width / 2, desk.y - desk.width * 0.36, desk.x + desk.width / 2, desk.y + 15));
  if (shelf) result.push(rect("shelf", shelf.x - shelf.width / 2, shelf.y - 45, shelf.x + shelf.width / 2, shelf.y + 15));
  if (bed) {
    result.push(ellipse("bed", bed.x, bed.y - 45, bed.width / 2, bed.width * 0.26));
    result.push(rect("window-nook", 0, 0, bed.x + bed.width / 2, bed.y + 20));
  }
  if (lamp) result.push(ellipse("lamp", lamp.x, lamp.y - 10, lamp.width * 0.2, lamp.width * 0.16));
  if (plant) result.push(ellipse("plant", plant.x, plant.y - 10, plant.width * 0.3, plant.width * 0.22));
  for (const category of ["pet-water", "pet-toys", "terrarium", "travel-case", "chest"]) {
    const item = get(category);
    if (item) result.push(ellipse(category, item.x, item.y - 6, item.width * 0.42, Math.min(22, item.width * 0.2)));
  }
  return result;
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
export function createHideoutWalkMap(layout = HIDEOUT_DEFAULT_LAYOUT) {
  const colliders = Object.freeze(collidersFor(layout).map((entry) => Object.freeze(entry)));
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
