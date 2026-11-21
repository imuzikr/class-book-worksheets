// A fixed, authored world for the existing reading-growth summary.
// This module maps totalXp to geometry; it never awards or changes experience.
import { getExpForReadingLevel, getReadingLevel, READING_LEVEL_MAX } from "./reading.js";
import { getReadingMapTheme } from "./readingMapCatalog.js";

// 레벨마다 길 위의 자리(0 출발 ~ 1 도착) — 독서 레벨은 10이 끝이라(READING_LEVEL_MAX) 길 한 바퀴가 곧 여정 전체입니다.
// 한때 10레벨씩 여정 10개(Lv.1~11 · 11~21 … 91~100)를 같은 길에 겹쳐 그렸는데, 레벨 상한을 10으로 정하며
// 한 바퀴로 합쳤습니다(선생님 결정 — 한 학기 수업). Lv.1~9의 자리는 그때 그대로라 지형이 바뀌는 곳에서
// 홀수 레벨이 시작하고(숲 1 · 사막 3 · 계곡 5 · 설산 7 · 폭풍 해안 9), Lv.10이 길 끝(도착)입니다.
export const WORLD_LEVEL_STOPS = Object.freeze([0, 0.08, 0.17, 0.25, 0.32, 0.45, 0.57, 0.70, 0.84, 1]);

// Region changes coincide with the starts of levels 1, 3, 5, 7 and 9 on both maps.
function makeRegions(landmarks) {
  return Object.freeze(landmarks.map(([id, name], index) => Object.freeze({
    id, name, start: WORLD_LEVEL_STOPS[index * 2], end: WORLD_LEVEL_STOPS[index * 2 + 2] ?? 1,
  })));
}

export const WORLD_REGIONS = makeRegions([
  ["forest", "시작의 숲"], ["desert", "모래바람 사막"], ["valley", "급류와 폭포의 계곡"],
  ["mountains", "바위산과 설산"], ["storm", "폭풍 해안"],
]);

const SKY_LIBRARY_REGIONS = makeRegions([
  ["library", "지상 도서관"], ["bindery", "제본소"], ["reading-tree", "나무 속 서재"],
  ["picture-book", "그림책 정원"], ["sky-library", "천공의 도서관"],
]);

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

// Pixel coordinates on the approved 1536 × 1024 sky-library artwork.
// Start at the village library, turn at the book press, then cross the wooden
// bridge to the reading tree and follow the paved path to the sky library.
const SKY_LIBRARY_ANCHORS = [
  [259, 949], [323, 946], [408, 941], [478, 930], [566, 923],
  [640, 914], [696, 907], [729, 894], [745, 873], [747, 852],
  [760, 837], [788, 823], [831, 810], [880, 799], [933, 795],
  [978, 793], [1039, 786], [1098, 793], [1142, 789], [1153, 781],
  [1142, 775], [1119, 770], [1081, 760], [1067, 749], [1030, 731],
  [988, 713], [945, 700], [901, 693], [845, 695], [789, 702],
  [725, 708], [646, 719], [571, 726], [509, 728], [457, 725],
  [413, 720], [376, 711], [347, 703], [325, 694], [308, 686],
  [298, 676], [299, 666], [312, 657], [340, 650], [389, 645],
  [434, 637], [469, 626], [486, 615], [485, 602], [473, 591],
  [466, 579], [473, 565], [492, 553], [519, 543], [556, 536],
  [602, 531], [641, 523], [663, 513], [676, 500], [680, 486],
  [675, 474], [663, 463], [640, 454], [605, 446], [571, 439],
  [545, 431], [525, 423], [517, 412], [518, 399], [524, 385],
  [537, 370], [558, 360], [591, 354], [621, 346], [646, 336],
  [676, 325], [705, 313], [753, 305], [804, 301], [849, 300],
  [903, 301], [959, 304], [1007, 311], [1056, 319], [1103, 322],
  [1149, 316], [1186, 304], [1215, 288], [1236, 271],
];
const SKY_LIBRARY_CHECKPOINT_ANCHORS = [0, 10, 18, 29, 44, 58, 71, 77, 84, 88];

// Authored against the selected cloud-island revision, not the original map.
// Four bridges are sampled along their decks, including the arched stone bridge.
const CLOUD_ANCHORS = [
  [399, 913], [385, 882], [270, 844], [230, 790], [304, 726],
  [349, 705], [359, 680], [296, 638], [239, 619], [207, 595],
  [194, 565], [196, 487], [239, 411], [268, 382], [205, 342],
  [187, 317], [205, 292], [250, 277], [365, 286], [415, 306],
  [472, 351], [472, 374], [511, 422], [557, 465], [612, 508],
  [672, 538], [708, 551], [731, 579], [708, 653], [732, 685],
  [820, 710], [915, 678], [965, 648], [1041, 589], [1040, 560],
  [1020, 534], [1000, 514], [985, 468], [960, 420], [928, 381],
  [897, 354], [879, 342], [824, 323], [780, 304], [749, 276],
  [748, 243], [767, 211], [804, 191], [849, 180], [905, 177],
  [944, 184], [971, 205], [985, 231], [1008, 250], [1040, 253],
  [1081, 266], [1125, 274], [1164, 269], [1203, 250], [1246, 256],
  [1287, 268], [1323, 261], [1358, 247],
];
const CLOUD_CHECKPOINT_ANCHORS = [0, 5, 13, 18, 26, 30, 41, 49, 58, 62];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clampProgress = (value) => typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : 0;
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/**
 * A global growth summary -> shared journey progress (Lv.1 start … Lv.10 goal).
 * Each map translates this progress to its own road, without changing EXP.
 * Missing/invalid totalXp is unknown, not an invented zero or class-only score.
 * At the top level (complete) the traveler stands at the goal; extra EXP keeps it there.
 */
export function worldProgress(totalXp, map = WORLD_MAP) {
  if (typeof totalXp !== "number" || !Number.isFinite(totalXp) || totalXp < 0) return null;
  const level = getReadingLevel(totalXp);
  const complete = level >= READING_LEVEL_MAX;
  const from = getExpForReadingLevel(level);
  const to = complete ? from : getExpForReadingLevel(level + 1);
  const ratio = complete ? 1 : clamp((totalXp - from) / (to - from), 0, 1);
  const begin = WORLD_LEVEL_STOPS[level - 1];
  const end = complete ? 1 : WORLD_LEVEL_STOPS[level];
  const progress = complete ? 1 : clampProgress(begin + ratio * (end - begin));
  const region = map.regions.find((item) => progress < item.end) ?? map.regions.at(-1);
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
function buildPath(anchors) {
  const points = [{ x: anchors[0][0], y: anchors[0][1], distance: 0 }];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const p0 = anchors[Math.max(0, i - 1)];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
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

function buildWorldMap(theme, regions, anchors, checkpointAnchors) {
  const points = Object.freeze(buildPath(anchors).map(Object.freeze));
  const length = points.at(-1).distance;
  return Object.freeze({
    ...getReadingMapTheme(theme),
    regions,
    version: theme === "continent" ? "bookbom-world-sky-library-1" : "bookbom-world-cloud-islands-1",
    width: 1536,
    height: 1024,
    length,
    points,
    // Look up physical road distances at each authored level checkpoint.
    levelDistances: Object.freeze(checkpointAnchors.map((index) => points[index * 32].distance)),
    path: points.map((point, i) => `${i ? "L" : "M"}${point.x},${point.y}`).join(" "),
  });
}

// Keep the stored "continent" key so existing classes open the new sky-library map.
export const WORLD_MAP = buildWorldMap("continent", SKY_LIBRARY_REGIONS, SKY_LIBRARY_ANCHORS, SKY_LIBRARY_CHECKPOINT_ANCHORS);
export const WORLD_MAPS = Object.freeze({
  continent: WORLD_MAP,
  "cloud-islands": buildWorldMap("cloud-islands", WORLD_REGIONS, CLOUD_ANCHORS, CLOUD_CHECKPOINT_ANCHORS),
});

export function getWorldMap(theme) {
  return WORLD_MAPS[getReadingMapTheme(theme).id];
}

function distanceOnMap(progress, map) {
  const value = clampProgress(progress);
  const next = WORLD_LEVEL_STOPS.findIndex((stop) => stop > value);
  if (next < 0) return map.length;
  const before = next - 1;
  const ratio = (value - WORLD_LEVEL_STOPS[before]) / (WORLD_LEVEL_STOPS[next] - WORLD_LEVEL_STOPS[before]);
  return map.levelDistances[before] + (map.levelDistances[next] - map.levelDistances[before]) * ratio;
}

/** Sample the rendered route by distance, with a stable local tangent. */
export function worldPoint(progress, map = WORLD_MAP) {
  const points = map.points;
  const distance = distanceOnMap(progress, map);
  let low = 1;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].distance < distance) low = middle + 1;
    else high = middle;
  }
  const before = points[low - 1];
  const after = points[low];
  const span = after.distance - before.distance;
  const ratio = span > 0 ? clamp((distance - before.distance) / span, 0, 1) : 0;
  return {
    x: before.x + (after.x - before.x) * ratio,
    y: before.y + (after.y - before.y) * ratio,
    angle: Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI,
  };
}

/** Authored, fixed level checkpoints — Lv.1 (start) … Lv.10 (goal). */
export function worldCheckpoints(map = WORLD_MAP) {
  return WORLD_LEVEL_STOPS.map((progress, index) => ({
    level: index + 1, xp: getExpForReadingLevel(index + 1), progress, ...worldPoint(progress, map),
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
export function groupWorldTravelers(rows, { selectedUid, epsilon = 0, map = WORLD_MAP } = {}) {
  const tolerance = typeof epsilon === "number" && Number.isFinite(epsilon) ? clamp(epsilon, 0, 1) : 0;
  const picked = selectedUid == null ? null : String(selectedUid);
  const seen = new Set();
  const travelers = (Array.isArray(rows) ? rows : []).flatMap((row) => {
    if (!row || !["string", "number"].includes(typeof row.uid) || !String(row.uid)) return [];
    const uid = String(row.uid);
    if (seen.has(uid)) return [];
    seen.add(uid);
    const world = worldProgress(row.totalXp, map);
    if (!world) return [];
    return [{ ...row, uid, world }];
  }).sort((a, b) => a.world.progress - b.world.progress || compareText(a.uid, b.uid));

  const buckets = [];
  const routeProgress = (traveler) => distanceOnMap(traveler.world.progress, map) / map.length;
  for (const traveler of travelers) {
    const bucket = buckets.at(-1);
    if (bucket && routeProgress(traveler) - routeProgress(bucket[0]) <= tolerance) bucket.push(traveler);
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
