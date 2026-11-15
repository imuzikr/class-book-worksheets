// Nearby characters are transient, client-side obstacles. Never put this state in Firebase.
// Coordinates and distances use the same original-image world as readingPlazaMap.
import { PLAZA_ROOM, plazaClear, plazaPath, plazaStep } from "./readingPlazaMap.js";

export const PLAZA_AVATAR_RADIUS = 26;
export const PLAZA_AVATAR_SEPARATION = PLAZA_AVATAR_RADIUS * 2;
export const PLAZA_AVATAR_LOOKAHEAD = 112;
const ROUTE_GUARD = 4;
const EPS = 1e-6;
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const point = (p) => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const peersOf = (peers, id) => (peers ?? []).filter((p) => finite(p) && (!id || p.uid !== id));
const peerKey = (peer) => peer.uid == null ? `@${peer.x},${peer.y}` : String(peer.uid);

function retireEscape(memo, at, peers, clearance) {
  if (!(memo?.escape instanceof Set)) return;
  for (const key of memo.escape) {
    const peer = peers.find((entry) => peerKey(entry) === key);
    if (!peer || distance(at, peer) >= clearance - EPS) memo.escape.delete(key);
  }
  if (!memo.escape.size) delete memo.escape;
}

// Exact closest distance to the swept segment, rather than only checking its end.
// This also works for long frames / clients which just received a new position.
function segmentDistance(a, b, p) {
  const x = b.x - a.x, y = b.y - a.y, d = x * x + y * y;
  const t = d ? Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / d)) : 0;
  return Math.hypot(a.x + x * t - p.x, a.y + y * t - p.y);
}

function actorClear(from, to, peers, clearance) {
  for (const peer of peers) {
    const before = distance(from, peer);
    if (before < clearance - EPS) {
      // Shared spawn / a delayed presence packet can start inside another actor.
      // Permit separation, but never deepen that overlap or travel through them.
      if (distance(to, peer) <= before + EPS || segmentDistance(from, to, peer) < before - EPS) return false;
    } else if (segmentDistance(from, to, peer) < clearance - EPS) return false;
  }
  return true;
}

const routeRooms = new WeakMap();
function occupiedRoom(from, peers, room, clearance) {
  // Existing overlaps must be escapable. Do not project the start to a distant
  // free cell (which would make the path's first segment jump through an actor).
  const blockers = peers.filter((p) => distance(from, p) >= clearance - ROUTE_GUARD + EPS)
    .map((p) => ({ ...p, guard: Math.min(clearance, distance(from, p) - EPS) }));
  if (!blockers.length) return room;
  const key = `${clearance}|${blockers.map((p) => `${p.uid ?? ""}:${p.x},${p.y},${p.guard}`).sort().join(";")}`;
  const previous = routeRooms.get(room);
  if (previous?.key === key) return previous.room;
  const dynamic = { ...room, ellipses: [...room.ellipses, ...blockers.map((p) => ({ cx: p.x, cy: p.y, rx: p.guard, ry: p.guard }))] };
  // Only one cached transient map per static room; moving peers cannot grow a
  // permanent collection of grids. Call this on a route change, never each RAF.
  routeRooms.set(room, { key, room: dynamic });
  return dynamic;
}

/** Occasional full route replan, including a nearby free goal if a peer occupies it. */
export function plazaAvoidPath(from, to, peers = [], room = PLAZA_ROOM, options = {}) {
  if (!finite(from) || !finite(to)) return [];
  const clearance = Math.max(1, options.clearance ?? PLAZA_AVATAR_SEPARATION) + ROUTE_GUARD;
  const valid = peersOf(peers, options.id);
  return plazaPath(from, to, occupiedRoom(from, valid, room, clearance));
}

/**
 * Resolve one already static-safe proposed step. The returned point never moves
 * farther than desired/maxStep. A stable pass-right preference avoids mirrored
 * head-on clients choosing the same WORLD side. If a wall blocks that side, use
 * the other. A fully occupied passage waits instead of walking through people.
 * `memo` belongs to one local avatar and is reset on room / input changes.
 */
export function plazaAvoidStep(from, desired, {
  peers = [], memo = null, room = PLAZA_ROOM, id = "", maxStep = Infinity,
  clearance = PLAZA_AVATAR_SEPARATION, goal = null,
} = {}) {
  const stay = { ...(finite(from) ? point(from) : { x: 0, y: 0 }), avoiding: false, blocked: false };
  if (!finite(from) || !finite(desired)) return stay;
  const valid = peersOf(peers, id);
  retireEscape(memo, from, valid, clearance);
  const finish = (result) => { retireEscape(memo, result, valid, clearance); return result; };
  const dx = desired.x - from.x, dy = desired.y - from.y;
  const wanted = Math.hypot(dx, dy);
  let step = Math.min(wanted, Math.max(0, maxStep));
  if (step <= EPS) return finish(stay);
  let ux = dx / wanted, uy = dy / wanted;
  let straight = { x: from.x + ux * step, y: from.y + uy * step };
  if (!plazaClear(from, straight, room)) {
    // A* shortcut visibility samples every6px. A very short actual frame can
    // therefore discover a desk-corner sliver that the shortcut skipped. Reuse
    // the existing static wall-slide instead of freezing or crossing furniture.
    const staticMemo = memo ? (memo.static ??= {}) : null;
    const nudge = plazaStep(from, ux * step, uy * step, staticMemo, room);
    const moved = distance(from, nudge);
    if (moved <= EPS) return finish({ ...stay, blocked: true });
    const budget = Math.min(step, moved);
    straight = { x: from.x + (nudge.x - from.x) / moved * budget, y: from.y + (nudge.y - from.y) / moved * budget };
    if (!plazaClear(from, straight, room)) return finish({ ...stay, blocked: true });
    step = budget; ux = (straight.x - from.x) / step; uy = (straight.y - from.y) / step;
  }
  const nearby = valid.filter((p) => distance(from, p) <= PLAZA_AVATAR_LOOKAHEAD + clearance + step);
  if (!nearby.length) {
    if (memo) { memo.side = 0; memo.peer = null; }
    return finish(plazaClear(from, straight, room) ? { ...straight, avoiding: false, blocked: false } : { ...stay, blocked: true });
  }
  // Do not forecast beyond a route corner: the next waypoint changes heading.
  const horizon = Math.max(step, Math.min(PLAZA_AVATAR_LOOKAHEAD, finite(goal) ? distance(from, goal) : Infinity));
  const forecast = { x: from.x + ux * horizon, y: from.y + uy * horizon };
  const guard = clearance + ROUTE_GUARD;
  const threats = nearby.filter((p) => {
    const ahead = (p.x - from.x) * ux + (p.y - from.y) * uy;
    return (ahead >= 0 || distance(from, p) < clearance) && segmentDistance(from, forecast, p) < guard;
  }).sort((a, b) => distance(from, a) - distance(from, b) || String(a.uid).localeCompare(String(b.uid)));
  if (!threats.length && actorClear(from, straight, nearby, clearance) && plazaClear(from, straight, room)) {
    if (memo) { memo.side = 0; memo.peer = null; }
    return finish({ ...straight, avoiding: false, blocked: false });
  }

  const obstacle = threats[0] ?? nearby.find((p) => !actorClear(from, straight, [p], clearance));
  const peer = obstacle?.uid ?? (obstacle ? `${obstacle.x},${obstacle.y}` : null);
  const preferred = memo?.peer === peer && memo.side ? memo.side : 1;
  // Crossing movers otherwise can keep dodging in parallel forever. One stable
  // ID-based right of way lets the other briefly wait while the first passes.
  // Stationary people never receive this priority: they must be walked around.
  if (id && threats.some((p) => p.moving === true && p.uid && String(id) > String(p.uid)
      && distance(from, p) >= clearance
      && segmentDistance(from, forecast, p) < clearance)) {
    if (memo) { memo.side = preferred; memo.peer = peer; }
    return finish({ ...stay, avoiding: true, blocked: true });
  }
  // Search small steering angles first. Every candidate checks the full swept
  // step and a look-ahead ray, so turning starts before bodies touch.
  for (const side of [preferred, -preferred]) {
    for (const angle of [Math.PI / 16, Math.PI / 8, Math.PI * 3 / 16, Math.PI / 4, Math.PI * 5 / 16, Math.PI * 3 / 8, Math.PI * 7 / 16, Math.PI / 2]) {
      const c = Math.cos(angle), s = Math.sin(angle) * side;
      const vx = ux * c - uy * s, vy = ux * s + uy * c;
      const next = { x: from.x + vx * step, y: from.y + vy * step };
      const ahead = { x: from.x + vx * horizon, y: from.y + vy * horizon };
      if (!plazaClear(from, next, room) || !actorClear(from, next, nearby, clearance)) continue;
      if (!plazaClear(from, ahead, room) || !actorClear(from, ahead, nearby, guard)) continue;
      if (memo) { memo.side = side; memo.peer = peer; }
      return finish({ ...next, avoiding: true, blocked: false });
    }
  }
  // When neither side has space, wait for a global route replan or for the
  // other person to pass. Repeated tiny sideways moves would jitter in a
  // classroom's narrow row corridor without making any forward progress.
  // An existing densely packed spawn is different: no vector can simultaneously
  // increase distance from three surrounding neighbours. Only after ALL normal
  // candidates failed, capture the already-overlapping cohort and let the actor
  // walk out at its normal bounded speed. Never add newly encountered people to
  // an active cohort; each original neighbour becomes solid as soon as cleared.
  const overlap = nearby.filter((entry) => distance(from, entry) < clearance - EPS);
  const escapeAngles = [0, preferred * Math.PI / 8, -preferred * Math.PI / 8,
    preferred * Math.PI / 4, -preferred * Math.PI / 4,
    preferred * Math.PI / 2, -preferred * Math.PI / 2,
    preferred * Math.PI * 3 / 4, -preferred * Math.PI * 3 / 4, Math.PI];
  if (overlap.length) {
    // A nearby fountain/wall can block the long forecast even though a short
    // outward step is safe. This retains the STRICT monotonic overlap check;
    // it is not grace and cannot pass through even one existing neighbour.
    for (const angle of escapeAngles) {
      const c = Math.cos(angle), s = Math.sin(angle);
      const next = { x: from.x + (ux * c - uy * s) * step, y: from.y + (ux * s + uy * c) * step };
      if (!plazaClear(from, next, room) || !actorClear(from, next, nearby, clearance)) continue;
      if (memo) { memo.side = preferred; memo.peer = peer; }
      return finish({ ...next, avoiding: true, blocked: false });
    }
  }
  if (memo) {
    if (!memo.escape) {
      if (overlap.length >= 2) memo.escape = new Set(overlap.map(peerKey));
    }
    if (memo.escape?.size) {
      const solid = nearby.filter((entry) => !memo.escape.has(peerKey(entry)));
      for (const angle of escapeAngles) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const next = { x: from.x + (ux * c - uy * s) * step, y: from.y + (ux * s + uy * c) * step };
        if (!plazaClear(from, next, room) || !actorClear(from, next, solid, clearance)) continue;
        memo.side = preferred; memo.peer = peer;
        return finish({ ...next, avoiding: true, blocked: false });
      }
    }
  }
  if (memo) { memo.side = preferred; memo.peer = peer; }
  return finish({ ...stay, avoiding: true, blocked: true });
}
