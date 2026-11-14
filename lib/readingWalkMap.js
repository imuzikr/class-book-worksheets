// Client-only geometry shared by the book plaza and classroom. Positions are avatar feet.
const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

export function createWalkMap({ width, height, cell = 16, spawn, isWalkable }) {
  const cols = Math.ceil(width / cell), rows = Math.ceil(height / cell);
  const walkable = (x, y) => Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && y >= 0 && x <= width && y <= height && isWalkable(x, y);
  let cells = null;
  function grid() {
    if (cells) return cells;
    cells = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (walkable((c + 0.5) * cell, (r + 0.5) * cell)) cells[r * cols + c] = 1;
    }
    return cells;
  }
  const cellOf = (x, y) => [Math.min(cols - 1, Math.max(0, Math.floor(x / cell))), Math.min(rows - 1, Math.max(0, Math.floor(y / cell)))];
  const center = (c, r) => ({ x: (c + 0.5) * cell, y: (r + 0.5) * cell });
  const open = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && grid()[r * cols + c] === 1;

  function nearest(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...spawn };
    if (walkable(x, y)) return { x, y };
    // Bound outside clicks before searching so enormous finite values do not dominate distances.
    const px = Math.min(width, Math.max(0, x)), py = Math.min(height, Math.max(0, y));
    const [c0, r0] = cellOf(px, py);
    let best = null, bestD = Infinity;
    for (let ring = 0; ring <= Math.max(cols, rows); ring++) {
      if (best && (ring - 1) * cell > bestD) break;
      for (let dc = -ring; dc <= ring; dc++) for (let dr = -ring; dr <= ring; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring || !open(c0 + dc, r0 + dr)) continue;
        const p = center(c0 + dc, r0 + dr), d = Math.hypot(p.x - px, p.y - py);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return best ?? { ...spawn };
  }

  function clear(a, b) {
    if (!finitePoint(a) || !finitePoint(b) || !walkable(a.x, a.y) || !walkable(b.x, b.y)) return false;
    // Fine samples keep a smoothed diagonal from shaving a narrow desk/chair corner.
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!walkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }

  function path(from, to) {
    if (!finitePoint(from) || !finitePoint(to)) return [];
    const start = nearest(from.x, from.y), goal = nearest(to.x, to.y);
    if (clear(start, goal)) return [goal];
    // A foot can be inside a narrow aisle while its 16px cell center is inside a desk.
    // Attach each exact endpoint to a nearby visible grid center, rather than rejecting it.
    function nodeFor(p) {
      const [c0, r0] = cellOf(p.x, p.y);
      let best = null, distance = Infinity;
      for (let ring = 0; ring <= 3; ring++) {
        for (let dc = -ring; dc <= ring; dc++) for (let dr = -ring; dr <= ring; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring || !open(c0 + dc, r0 + dr)) continue;
          const at = center(c0 + dc, r0 + dr), d = Math.hypot(at.x - p.x, at.y - p.y);
          if (d < distance && clear(p, at)) { best = [c0 + dc, r0 + dr]; distance = d; }
        }
        if (best) return best;
      }
      return null;
    }
    const startNode = nodeFor(start), goalNode = nodeFor(goal);
    if (!startNode || !goalNode) return [];
    const [sc, sr] = startNode, [gc, gr] = goalNode;
    const total = cols * rows, cost = new Float64Array(total).fill(Infinity);
    const prev = new Int32Array(total).fill(-1), done = new Uint8Array(total);
    const startIdx = sr * cols + sc, goalIdx = gr * cols + gc;
    const heuristic = (c, r) => Math.hypot(c - gc, r - gr);
    const candidates = [startIdx], score = new Float64Array(total).fill(Infinity);
    cost[startIdx] = 0; score[startIdx] = heuristic(sc, sr);
    while (candidates.length) {
      let at = 0;
      for (let i = 1; i < candidates.length; i++) if (score[candidates[i]] < score[candidates[at]]) at = i;
      const current = candidates[at];
      candidates[at] = candidates[candidates.length - 1]; candidates.pop();
      if (current === goalIdx) break;
      if (done[current]) continue;
      done[current] = 1;
      const c = current % cols, r = (current - c) / cols;
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if ((!dc && !dr) || !open(c + dc, r + dr)) continue;
        if (dc && dr && (!open(c + dc, r) || !open(c, r + dr))) continue;
        const next = (r + dr) * cols + c + dc, g = cost[current] + (dc && dr ? Math.SQRT2 : 1);
        if (g >= cost[next]) continue;
        cost[next] = g; prev[next] = current;
        score[next] = g + heuristic(c + dc, r + dr); candidates.push(next);
      }
    }
    if (prev[goalIdx] === -1 && goalIdx !== startIdx) return [];
    const route = [];
    for (let at = goalIdx; at !== -1; at = prev[at]) {
      route.push(center(at % cols, Math.floor(at / cols)));
      if (at === startIdx) break;
    }
    route.reverse();
    if (route.at(-1)?.x !== goal.x || route.at(-1)?.y !== goal.y) route.push(goal);
    const result = [];
    let here = start, i = 0;
    while (i < route.length) {
      let far = i;
      for (let j = route.length - 1; j > i; j--) if (clear(here, route[j])) { far = j; break; }
      // Each returned segment must itself be safe, including an endpoint near a grid boundary.
      if (!clear(here, route[far])) return [];
      result.push(route[far]); here = route[far]; i = far + 1;
    }
    return result;
  }

  function step(from, dx, dy) {
    if (!finitePoint(from)) return { ...spawn };
    if (!walkable(from.x, from.y)) return nearest(from.x, from.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { x: from.x, y: from.y };
    const both = { x: from.x + dx, y: from.y + dy };
    if (clear(from, both)) return both;
    const horizontal = { x: from.x + dx, y: from.y };
    if (dx && clear(from, horizontal)) return horizontal;
    const vertical = { x: from.x, y: from.y + dy };
    if (dy && clear(from, vertical)) return vertical;
    return { x: from.x, y: from.y };
  }
  return Object.freeze({ walkable, nearest, clear, path, step });
}
