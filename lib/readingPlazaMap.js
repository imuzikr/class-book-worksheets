// =============================================================
// 독서 광장의 지도 — 걷는 길 · 여는 곳 (components/reading/ReadingPlaza.jsx의 무대만 씀)
// -------------------------------------------------------------
// 공유 사본 · 목록의 셈(lib/readingPlaza.js)과 갈라 둡니다 — 이 파일은 광장 탭을 열 때만 내려받습니다
// (ReadingHub가 무대를 그때 불러옴). 서버는 쓰지 않습니다.
// =============================================================

// ── 광장 지도 — 걷는 길 ─────────────────────────────────────────
// 좌표는 배경 그림(public/reading-plaza/plaza.webp)의 원본 크기(1672×941) 기준 px입니다. 화면은 %로 바꿔 놓습니다.
// 캐릭터의 자리는 '발'입니다. 그림이 한 장이라 캐릭터는 늘 배경 위에 그려지므로, 키 큰 물건(가판대 · 분수 ·
// 그네)의 **뒤쪽**까지 못 가는 곳으로 막아 캐릭터가 지붕 위에 올라선 듯 보이지 않게 합니다.
// 배경 그림을 바꾸면 이 값들도 함께 다시 재세요(시험 tests/unit/readingPlaza.test.mjs가 길이 이어지는지 봅니다).
export const PLAZA_W = 1672;
export const PLAZA_H = 941;
export const PLAZA_CELL = 16;
// 걸을 수 있는 바닥(돌 깔린 마당)의 테두리 — 시계 방향
const FLOOR = [
  [352, 196], [1300, 196], [1368, 240], [1492, 264], [1452, 290], [1452, 452], [1596, 456], [1602, 484],
  [1626, 556], [1660, 590], [1392, 596], [1392, 804], [1470, 850], [1432, 926], [244, 926], [216, 862],
  [132, 782], [52, 704], [212, 694], [212, 500], [60, 498], [60, 466], [208, 464], [208, 292], [108, 270], [256, 208], [330, 184],
];
// 바닥 안의 못 가는 곳 — 분수(둥근 받침 + 그 뒤의 물줄기 기둥)
const BLOCK_ELLIPSES = [{ cx: 836, cy: 496, rx: 130, ry: 58 }, { cx: 836, cy: 428, rx: 74, ry: 48 }];
// 처음 서는 자리(마당 아래쪽 가운데)
export const PLAZA_SPAWN = Object.freeze({ x: 836, y: 760 });
// 눌러서 여는 곳 — rect는 그림에서 그 물건이 차지한 자리(누르는 곳), stand는 그 앞에 서는 자리,
// sign은 이름표 자리(align — 그 점이 이름표의 왼쪽 끝 · 가운데 · 오른쪽 끝인가. 가장자리의 가판대는
// 이름표가 그림 밖으로 잘리지 않게 안쪽으로 뻗습니다).
export const PLAZA_SPOTS = Object.freeze([
  { id: "shelf", place: "shelf", label: "책꽂이", rect: [580, 0, 1100, 190], stand: { x: 836, y: 222 }, sign: { x: 836, y: 30 }, align: "center" },
  { id: "stall-1", place: "stall", label: "가판대", rect: [36, 292, 206, 462], stand: { x: 250, y: 436 }, sign: { x: 40, y: 290 }, align: "left" },
  { id: "stall-2", place: "stall", label: "가판대", rect: [24, 500, 210, 690], stand: { x: 254, y: 650 }, sign: { x: 30, y: 498 }, align: "left" },
  { id: "stall-3", place: "stall", label: "가판대", rect: [1456, 282, 1620, 446], stand: { x: 1414, y: 420 }, sign: { x: 1636, y: 278 }, align: "right" },
].map((s) => Object.freeze({ ...s, stand: Object.freeze(s.stand), sign: Object.freeze(s.sign), rect: Object.freeze(s.rect) })));
// 그 앞에 섰다고 치는 거리(px) — 이 안이면 '열기' 안내가 뜨고 Space/Enter로 엽니다.
export const PLAZA_NEAR = 96;

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function plazaWalkable(x, y) {
  if (!(x >= 0 && y >= 0 && x <= PLAZA_W && y <= PLAZA_H) || !inPolygon(x, y, FLOOR)) return false;
  return !BLOCK_ELLIPSES.some((e) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1);
}

const COLS = Math.ceil(PLAZA_W / PLAZA_CELL);
const ROWS = Math.ceil(PLAZA_H / PLAZA_CELL);
let gridCache = null;
function grid() {
  if (gridCache) return gridCache;
  const cells = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (plazaWalkable((c + 0.5) * PLAZA_CELL, (r + 0.5) * PLAZA_CELL)) cells[r * COLS + c] = 1;
    }
  }
  gridCache = cells;
  return cells;
}
const cellOf = (x, y) => [Math.min(COLS - 1, Math.max(0, Math.floor(x / PLAZA_CELL))), Math.min(ROWS - 1, Math.max(0, Math.floor(y / PLAZA_CELL)))];
const centerOf = (c, r) => ({ x: (c + 0.5) * PLAZA_CELL, y: (r + 0.5) * PLAZA_CELL });
const open = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && grid()[r * COLS + c] === 1;

// 그 점에서 가장 가까운 걸을 수 있는 자리 — 가판대나 꽃밭을 눌러도 그 앞까지 걸어갑니다.
export function plazaNearest(x, y) {
  if (plazaWalkable(x, y)) return { x, y };
  const [c0, r0] = cellOf(x, y);
  let best = null;
  let bestD = Infinity;
  const reach = Math.max(COLS, ROWS);
  for (let ring = 1; ring <= reach; ring += 1) {
    // 이미 찾은 자리보다 가까운 칸이 이 고리에는 없으면 그만
    if (best && (ring - 1) * PLAZA_CELL > bestD) break;
    for (let dc = -ring; dc <= ring; dc += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring || !open(c0 + dc, r0 + dr)) continue;
        const p = centerOf(c0 + dc, r0 + dr);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
  }
  return best ?? { ...PLAZA_SPAWN };
}

// 두 점 사이를 곧게 걸을 수 있는가(6px마다 짚어 봄)
export function plazaClear(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (!plazaWalkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

// 길 찾기 — from에서 to까지 걸어갈 점들(from은 빼고, 마지막이 도착점). 길이 없으면 빈 배열.
// 칸(16px) 위의 A*로 찾고, 곧게 갈 수 있는 구간은 한 번에 잇습니다(지그재그로 걷지 않게).
export function plazaPath(from, to) {
  const start = plazaNearest(from.x, from.y);
  const goal = plazaNearest(to.x, to.y);
  if (plazaClear(start, goal)) return [goal];
  const [sc, sr] = cellOf(start.x, start.y);
  const [gc, gr] = cellOf(goal.x, goal.y);
  if (!open(sc, sr) || !open(gc, gr)) return [];
  const total = COLS * ROWS;
  const cost = new Float64Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const done = new Uint8Array(total);
  const startIdx = sr * COLS + sc;
  const goalIdx = gr * COLS + gc;
  const h = (c, r) => Math.hypot(c - gc, r - gr);
  cost[startIdx] = 0;
  // 작은 판(6천 칸 남짓)이라 열린 목록을 배열로 두고 가장 싼 것을 훑어 고릅니다.
  const openList = [startIdx];
  const score = new Float64Array(total).fill(Infinity);
  score[startIdx] = h(sc, sr);
  while (openList.length) {
    let at = 0;
    for (let i = 1; i < openList.length; i += 1) if (score[openList[i]] < score[openList[at]]) at = i;
    const current = openList[at];
    openList[at] = openList[openList.length - 1];
    openList.pop();
    if (current === goalIdx) break;
    if (done[current]) continue;
    done[current] = 1;
    const c = current % COLS;
    const r = (current - c) / COLS;
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (!dc && !dr) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (!open(nc, nr)) continue;
        // 모서리를 가로질러 막힌 칸을 스치지 않게
        if (dc && dr && (!open(c + dc, r) || !open(c, r + dr))) continue;
        const next = nr * COLS + nc;
        const g = cost[current] + (dc && dr ? Math.SQRT2 : 1);
        if (g >= cost[next]) continue;
        cost[next] = g;
        prev[next] = current;
        score[next] = g + h(nc, nr);
        openList.push(next);
      }
    }
  }
  if (prev[goalIdx] === -1 && goalIdx !== startIdx) return [];
  const cells = [];
  for (let at = goalIdx; at !== -1 && at !== startIdx; at = prev[at]) cells.push(at);
  cells.reverse();
  const points = cells.map((idx) => centerOf(idx % COLS, Math.floor(idx / COLS)));
  if (points.length) points[points.length - 1] = goal;
  else points.push(goal);
  // 곧게 갈 수 있는 가장 먼 점까지 한 번에
  const path = [];
  let here = start;
  let i = 0;
  while (i < points.length) {
    let far = i;
    for (let j = points.length - 1; j > i; j -= 1) {
      if (plazaClear(here, points[j])) { far = j; break; }
    }
    path.push(points[far]);
    here = points[far];
    i = far + 1;
  }
  return path;
}

// 방향키로 한 걸음 — 막히면 벽을 따라 미끄러집니다(가로만 · 세로만 차례로 시도).
export function plazaStep(from, dx, dy) {
  if (plazaWalkable(from.x + dx, from.y + dy)) return { x: from.x + dx, y: from.y + dy };
  if (dx && plazaWalkable(from.x + dx, from.y)) return { x: from.x + dx, y: from.y };
  if (dy && plazaWalkable(from.x, from.y + dy)) return { x: from.x, y: from.y + dy };
  return { x: from.x, y: from.y };
}

// 그 자리에서 열 수 있는 곳(가장 가까운 것) — 없으면 null
export function plazaSpotNear(point, near = PLAZA_NEAR) {
  let best = null;
  let bestD = near;
  for (const spot of PLAZA_SPOTS) {
    const d = Math.hypot(point.x - spot.stand.x, point.y - spot.stand.y);
    if (d <= bestD) { bestD = d; best = spot; }
  }
  return best;
}
// 그 점이 어느 물건(책꽂이 · 가판대) 위인가 — 눌렀을 때
export function plazaSpotAt(x, y) {
  return PLAZA_SPOTS.find((s) => x >= s.rect[0] && x <= s.rect[2] && y >= s.rect[1] && y <= s.rect[3]) ?? null;
}
