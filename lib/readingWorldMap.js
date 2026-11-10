// A fixed, authored world for the existing reading-growth summary.
// This module maps totalXp to geometry; it never awards or changes experience.
import { getExpForReadingLevel, getReadingLevel, READING_LEVEL_MAX } from "./reading.js";

// 레벨마다 길 위의 자리(0 출발 ~ 1 도착) — 독서 레벨은 10이 끝이라(READING_LEVEL_MAX) 길 한 바퀴가 곧 여정 전체입니다.
// 한때 10레벨씩 여정 10개(Lv.1~11 · 11~21 … 91~100)를 같은 길에 겹쳐 그렸는데, 레벨 상한을 10으로 정하며
// 한 바퀴로 합쳤습니다(선생님 결정 — 한 학기 수업). Lv.1~9의 자리는 그때 그대로라 지형이 바뀌는 곳에서
// 홀수 레벨이 시작하고(숲 1 · 사막 3 · 계곡 5 · 설산 7 · 폭풍 해안 9), Lv.10이 길 끝(도착)입니다.
export const WORLD_LEVEL_STOPS = Object.freeze([0, 0.08, 0.17, 0.25, 0.32, 0.45, 0.57, 0.70, 0.84, 1]);

export const WORLD_REGIONS = Object.freeze([
  { id: "forest", name: "시작의 숲", start: 0, end: 0.17 },
  { id: "desert", name: "모래바람 사막", start: 0.17, end: 0.32 },
  { id: "valley", name: "급류와 폭포의 계곡", start: 0.32, end: 0.57 },
  { id: "mountains", name: "바위산과 설산", start: 0.57, end: 0.84 },
  { id: "storm", name: "폭풍 해안", start: 0.84, end: 1 },
].map(Object.freeze));

export const WORLD_CHARACTERS = Object.freeze([
  { number: 1, id: "01-bear", name: "곰" },
  { number: 2, id: "02-rabbit", name: "토끼" },
  { number: 3, id: "03-cat", name: "고양이" },
  { number: 4, id: "04-dog", name: "강아지" },
  { number: 5, id: "05-panda", name: "판다" },
  { number: 6, id: "06-fox", name: "여우" },
  { number: 7, id: "07-penguin", name: "펭귄" },
  { number: 8, id: "08-owl", name: "부엉이" },
  { number: 9, id: "09-deer", name: "사슴" },
  { number: 10, id: "10-squirrel", name: "다람쥐" },
].map(Object.freeze));

// Centerline traced on the approved 1536 × 1024 map. Every image, checkpoint,
// and character uses this coordinate system, independent of viewport size.
const ANCHORS = [
  [246, 876], [350, 885], [500, 860], [700, 887], [860, 842],
  [1000, 825], [1135, 835], [1195, 795], [1170, 750], [1080, 712],
  [980, 687], [875, 652], [810, 689], [735, 732], [650, 713],
  [560, 685], [470, 661], [340, 622], [288, 576], [316, 547],
  [390, 525], [530, 507], [610, 505], [704, 493], [760, 448],
  [735, 412], [675, 392], [600, 372], [530, 349], [495, 321],
  [506, 293], [560, 274], [655, 262], [730, 272], [840, 299],
  [970, 319], [1060, 307], [1120, 285], [1135, 247], [1115, 227],
  [1180, 210], [1257, 215],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clampProgress = (value) => typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : 0;
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/**
 * A global growth summary -> a raw arc-length position on the one journey (Lv.1 start … Lv.10 goal).
 * Missing/invalid totalXp is unknown, not an invented zero or class-only score.
 * At the top level (complete) the traveler stands at the goal; extra EXP keeps it there.
 */
export function worldProgress(totalXp) {
  if (typeof totalXp !== "number" || !Number.isFinite(totalXp) || totalXp < 0) return null;
  const level = getReadingLevel(totalXp);
  const complete = level >= READING_LEVEL_MAX;
  const from = getExpForReadingLevel(level);
  const to = complete ? from : getExpForReadingLevel(level + 1);
  const ratio = complete ? 1 : clamp((totalXp - from) / (to - from), 0, 1);
  const begin = WORLD_LEVEL_STOPS[level - 1];
  const end = complete ? 1 : WORLD_LEVEL_STOPS[level];
  const progress = complete ? 1 : clampProgress(begin + ratio * (end - begin));
  const region = WORLD_REGIONS.find((item) => progress < item.end) ?? WORLD_REGIONS.at(-1);
  return {
    xp: totalXp, level, from, to,
    toNext: complete ? 0 : Math.max(0, to - totalXp),
    ratio, percent: Math.round(ratio * 100), progress, complete, region,
  };
}

/**
 * Highest verified public level, then cumulative EXP, within the supplied class.
 * Exact ties share the title — at the top level (10) the one with more EXP leads.
 * Missing or inconsistent growth is still unknown, and the selected traveler never affects the result.
 */
export function readingLeaderUids(rows) {
  let bestLevel = -1;
  let bestXp = -1;
  const leaders = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !["string", "number"].includes(typeof row.uid)) continue;
    const uid = String(row.uid);
    if (!uid.trim() || (typeof row.uid === "number" && !Number.isFinite(row.uid))) continue;
    const growth = worldProgress(row.totalXp);
    // Match the map's growthOf contract: an outdated public level is not ready.
    if (!growth || growth.level !== row.level) continue;
    if (growth.level > bestLevel || (growth.level === bestLevel && growth.xp > bestXp)) {
      bestLevel = growth.level;
      bestXp = growth.xp;
      leaders.clear();
      leaders.add(uid);
    } else if (growth.level === bestLevel && growth.xp === bestXp) {
      leaders.add(uid);
    }
  }
  return [...leaders].sort(compareText);
}

function catmullPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return p1.map((value, axis) => 0.5 * (
    2 * value + (-p0[axis] + p2[axis]) * t
    + (2 * p0[axis] - 5 * value + 4 * p2[axis] - p3[axis]) * t2
    + (-p0[axis] + 3 * value - 3 * p2[axis] + p3[axis]) * t3
  ));
}

// A densely sampled Catmull–Rom curve serves both the SVG and the point lookup.
// Their shared polyline avoids DOM-only path measurement and hydration jumps.
function buildPath() {
  const points = [{ x: ANCHORS[0][0], y: ANCHORS[0][1], distance: 0 }];
  for (let i = 0; i < ANCHORS.length - 1; i += 1) {
    const p0 = ANCHORS[Math.max(0, i - 1)];
    const p1 = ANCHORS[i];
    const p2 = ANCHORS[i + 1];
    const p3 = ANCHORS[Math.min(ANCHORS.length - 1, i + 2)];
    for (let sample = 1; sample <= 32; sample += 1) {
      const [rawX, rawY] = catmullPoint(p0, p1, p2, p3, sample / 32);
      const x = Math.round(rawX * 1000) / 1000;
      const y = Math.round(rawY * 1000) / 1000;
      const previous = points.at(-1);
      points.push({ x, y, distance: previous.distance + Math.hypot(x - previous.x, y - previous.y) });
    }
  }
  return points;
}

const PATH_POINTS = buildPath();
const PATH_LENGTH = PATH_POINTS.at(-1).distance;

export const WORLD_MAP = Object.freeze({
  version: "bookbom-world-1",
  width: 1536,
  height: 1024,
  length: PATH_LENGTH,
  path: PATH_POINTS.map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`).join(" "),
});

/** Sample the rendered route by distance, with a stable local tangent. */
export function worldPoint(progress) {
  const distance = clampProgress(progress) * PATH_LENGTH;
  let low = 1;
  let high = PATH_POINTS.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (PATH_POINTS[middle].distance < distance) low = middle + 1;
    else high = middle;
  }
  const before = PATH_POINTS[low - 1];
  const after = PATH_POINTS[low];
  const span = after.distance - before.distance;
  const ratio = span > 0 ? clamp((distance - before.distance) / span, 0, 1) : 0;
  return {
    x: before.x + (after.x - before.x) * ratio,
    y: before.y + (after.y - before.y) * ratio,
    angle: Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI,
  };
}

/** Authored, fixed level checkpoints — Lv.1 (start) … Lv.10 (goal). */
export function worldCheckpoints() {
  return WORLD_LEVEL_STOPS.map((progress, index) => ({
    level: index + 1, xp: getExpForReadingLevel(index + 1), progress, ...worldPoint(progress),
  }));
}

/** A level-independent default character, stable across classes and sorting. */
export function defaultWorldAvatar(uid) {
  const key = String(uid ?? "");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
  return hash % WORLD_CHARACTERS.length + 1;
}

/**
 * Group the same path positions, retaining each original row's actual growth.
 * Optional proximity grouping uses arc length, never closeness across hairpins.
 * Selection changes the representative, not any student's growth or group key.
 */
export function groupWorldTravelers(rows, { selectedUid, epsilon = 0 } = {}) {
  const tolerance = typeof epsilon === "number" && Number.isFinite(epsilon) ? clamp(epsilon, 0, 1) : 0;
  const picked = selectedUid == null ? null : String(selectedUid);
  const seen = new Set();
  const travelers = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    if (!row || !["string", "number"].includes(typeof row.uid) || !String(row.uid)) return [];
    const uid = String(row.uid);
    if (seen.has(uid)) return [];
    seen.add(uid);
    const world = worldProgress(row.totalXp);
    if (!world) return [];
    return [{ ...row, uid, world }];
  }).sort((a, b) => a.world.progress - b.world.progress || compareText(a.uid, b.uid));

  const buckets = [];
  for (const traveler of travelers) {
    const bucket = buckets.at(-1);
    if (bucket && traveler.world.progress - bucket[0].world.progress <= tolerance) bucket.push(traveler);
    else buckets.push([traveler]);
  }
  return buckets.map((bucket) => {
    const members = bucket.slice().sort((a, b) => compareText(a.uid, b.uid));
    return {
      id: `world:${members.map((member) => encodeURIComponent(member.uid)).join(",")}`,
      progress: bucket[0].world.progress,
      members,
      representative: members.find((member) => member.uid === picked) ?? members[0],
    };
  });
}

/**
 * Keep leaders visible as their own slot without lending their title to peers.
 * Slot keys and anchors depend on membership and growth, never on selection.
 */
export function splitWorldLeaderGroups(groups, leaderUids, selectedUid) {
  const leaders = new Set((Array.isArray(leaderUids) || leaderUids instanceof Set ? [...leaderUids] : []).map(String));
  const picked = selectedUid == null ? null : String(selectedUid);
  const representative = (members) => members.find((member) => String(member.uid) === picked) ?? members[0];
  return (Array.isArray(groups) ? groups : []).flatMap((group) => {
    const leaderMembers = [];
    const peerMembers = [];
    for (const member of group.members) {
      (leaders.has(String(member.uid)) ? leaderMembers : peerMembers).push(member);
    }
    if (!leaderMembers.length) return [group];
    const leaderGroup = { ...group, members: leaderMembers, representative: representative(leaderMembers), isLeader: true };
    if (!peerMembers.length) return [leaderGroup];
    const leaderProgress = leaderMembers[0].world.progress;
    return [
      { ...leaderGroup, id: `${group.id}:leaders`, progress: leaderProgress },
      {
        ...group, id: `${group.id}:peers`, members: peerMembers,
        representative: representative(peerMembers), isLeader: false,
        leaderProgress,
      },
    ];
  });
}
