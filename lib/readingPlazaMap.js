// =============================================================
// 책 광장의 지도 — 걷는 길 · 여는 곳 · 시점 (components/reading/ReadingPlaza.jsx의 무대만 씀)
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
// 처음 서는 자리 — 책꽂이와 분수 사이(마당 위쪽 가운데).
// 맵이 화면을 가득 채우면서 넓은 화면에서는 그림의 위아래 일부만 보이는데(아래 plazaView), 처음에 책꽂이와 가판대가
// 함께 보이려면 위쪽에 서야 합니다. 한때 마당 아래쪽(836, 760)이었고, 그러면 책꽂이가 화면 밖이었습니다.
// 책꽂이 앞(stand)에서는 PLAZA_NEAR보다 멀어, 들어서자마자 '눌러서 열기'가 깜빡이지 않습니다.
export const PLAZA_SPAWN = Object.freeze({ x: 836, y: 330 });
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

// ── 무대 — 그림이 화면(보이는 창)을 가득 덮게 ───────────────────────
// 광장에서 캐릭터의 키(그림 원본 px) — 무대가 그리는 크기(lib/readingPlazaSprites.js)와 시점의 셈이 함께 씁니다.
// 걷는 그림 묶음의 기준(72px)보다 조금 크게 잡았습니다 — 맵을 키운 배율을 따라 노트북 화면에서는 65~75px,
// 큰 화면에서는 100px 가까이, 폰에서는 47px쯤으로 섭니다(실측). 한때 그림 폭의 7.8%짜리 네모(PLAZA_AVATAR)였습니다(걷는 그림을 넣기 전).
export const PLAZA_BODY = 88;
// 보이는 창(w×h, 화면 px)을 빈틈없이 덮는 그림의 크기 — 가로 · 세로 가운데 더 크게 키워야 하는 쪽에 맞춥니다.
// 그림(16:9)보다 넓적한 창은 폭에 맞아 위아래가, 길쭉한 창(폰)은 높이에 맞아 좌우가 창 밖으로 넘칩니다.
// 돌려주는 값 { w, h, scale(그림 원본 px → 화면 px), worldW, worldH }
export function plazaView(w, h) {
  const width = Math.max(0, Number(w) || 0);
  const height = Math.max(0, Number(h) || 0);
  const scale = Math.max(width / PLAZA_W, height / PLAZA_H);
  return { w: width, h: height, scale, worldW: PLAZA_W * scale, worldH: PLAZA_H * scale };
}
// 시점 — 그림의 어느 자리가 창의 왼쪽 위에 오는가(화면 px). 캐릭터의 몸 가운데(발에서 그림 키의 절반 위)를
// 창 가운데에 두되, 그림 바깥이 보이지 않게 가장자리에서 멈춥니다. pos는 그림 원본 px(발).
export function plazaCamera(view, pos) {
  if (!view || !(view.scale > 0)) return { x: 0, y: 0 };
  const maxX = Math.max(0, view.worldW - view.w);
  const maxY = Math.max(0, view.worldH - view.h);
  const bodyY = (pos.y - PLAZA_BODY * 0.5) * view.scale;
  return {
    x: Math.min(maxX, Math.max(0, pos.x * view.scale - view.w / 2)),
    y: Math.min(maxY, Math.max(0, bodyY - view.h / 2)),
  };
}

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
// 분수에 막혔으면 그 둘레를 따라 돌아갑니다(plazaRound) — 처음 서는 자리가 분수 바로 위라, 아래 방향키 하나만
// 눌러도 분수를 돌아 내려가야 합니다(안 그러면 몇 걸음 만에 멈춰 섬).
// memo — 걷는 쪽이 들고 있는 작은 기억({ turn, key }). 분수를 어느 쪽으로 돌고 있는지 적어 둡니다. 분수는 타원 둘
// (받침 · 기둥)이 겹친 모양이라, 프레임마다 새로 고르면 둘이 만나는 오목한 자리에서 오도 가도 못합니다(실측).
// 곧게 걸을 수 있게 되거나 방향키가 바뀌면 지웁니다. 안 넘기면 그때그때 고릅니다.
export function plazaStep(from, dx, dy, memo = null) {
  const key = `${Math.sign(dx)},${Math.sign(dy)}`;
  if (memo && memo.key !== key) { memo.key = key; memo.turn = 0; }
  const free = (x, y) => {
    if (!plazaWalkable(x, y)) return null;
    if (memo) memo.turn = 0;
    return { x, y };
  };
  const straight = free(from.x + dx, from.y + dy);
  if (straight) return straight;
  // 분수가 막았으면 둘레를 돕니다 — 대각선 걸음도 '가로만 · 세로만'보다 이것이 먼저입니다(그 둘을 번갈아 쓰면
  // 받침과 기둥이 만나는 오목한 자리에서 제자리걸음을 합니다 — 실측).
  const round = plazaRound(from, dx, dy, memo);
  if (round) return round;
  const slide = dx && dy ? free(from.x + dx, from.y) ?? free(from.x, from.y + dy) : null;
  if (slide) return slide;
  if (memo) memo.turn = 0;
  return { x: from.x, y: from.y };
}
// 분수 둘레를 따라 한 걸음 — 같은 빠르기로 걷습니다. 도는 쪽(turn: 1 = 화면에서 시계 방향 · -1 = 반대)은
// 가려던 쪽에 가까운 접선으로 정하고, 정면으로 부딪혔으면 지금 치우쳐 있는 쪽으로(한가운데면 시계 방향) 정합니다.
// 한 조각의 둘레를 따라가다 다른 조각에 막히면 같은 쪽으로 그 조각의 둘레로 갈아탑니다.
// 분수가 아닌 것(마당 가장자리 · 가판대)에 막혔으면 null — 거기서는 멈춰 섭니다.
function plazaRound(from, dx, dy, memo) {
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  const inside = (b, x, y) => ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 <= 1;
  const hit = BLOCK_ELLIPSES.filter((b) => inside(b, from.x + dx, from.y + dy));
  if (!hit.length) return null;
  let turn = memo?.turn || 0;
  for (const e of [...hit, ...BLOCK_ELLIPSES.filter((b) => !hit.includes(b))]) {
    // 타원의 바깥 법선 ∝ ((x−cx)/rx², (y−cy)/ry²), 접선은 그것을 90° 돌린 것(화면에서 시계 방향)
    let nx = (from.x - e.cx) / (e.rx * e.rx);
    let ny = (from.y - e.cy) / (e.ry * e.ry);
    const n = Math.hypot(nx, ny);
    if (!n) continue;
    nx /= n; ny /= n;
    const sx = -ny;
    const sy = nx;
    if (!turn) {
      let along = sx * dx + sy * dy;
      if (Math.abs(along) < len * 0.08) along = sx * (from.x - e.cx) + sy * (from.y - e.cy);
      turn = along < 0 ? -1 : 1;
    }
    // 둘레가 굽어 있어 접선으로 가면 살짝 안으로 파고들 수 있습니다 — 그때는 바깥으로 조금 밀어 냅니다.
    for (const push of [0, 0.5, 1, 2, 4]) {
      const x = from.x + turn * sx * len + nx * push;
      const y = from.y + turn * sy * len + ny * push;
      if (plazaWalkable(x, y)) {
        if (memo) memo.turn = turn;
        return { x, y };
      }
    }
  }
  return null;
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
