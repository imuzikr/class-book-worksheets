// A private room stores item choices and, since stage 2 (2026년 11월), where each piece stands and which way it faces
// (arrange). Walking and preview state never write to Firestore.
import { READING_BADGES, READING_LEVEL_MAX } from "./reading.js";
import { HIDEOUT_CATALOG_DATA } from "./readingHideoutCatalog.js";
import { HIDEOUT_ART_INSETS } from "./readingHideoutBoxes.js";
import { hideoutTurnArt } from "./readingHideoutTurn.js";

export const HIDEOUT_SCENE = Object.freeze({ width: 1536, height: 1024, background: "/reading-hideout/background.webp" });
export const HIDEOUT_OCCUPANTS = Object.freeze({
  character: Object.freeze({ x: 760, y: 850, width: 252 }),
  pet: Object.freeze({ x: 190, y: 516.8, width: 120 }),
});
export const HIDEOUT_THEMES = Object.freeze(HIDEOUT_CATALOG_DATA.themes.map((theme) => Object.freeze({ ...theme })));
const DESCRIPTIONS = {
  rug: "독서 공간에 포근한 자리를 만들어요.", cushion: "편안히 앉아 읽는 작은 쿠션이에요.", "bookmark-rack": "이야기의 자리를 기억하는 책갈피를 모아요.",
  desk: "책과 함께 집중하는 나만의 자리예요.", bookstand: "읽는 책을 편하게 펼쳐 두어요.", "pencil-caddy": "푹 기대어 책 속으로 빠져드는 1인 소파예요.",
  shelf: "좋아하는 이야기를 차곡차곡 모아요.", bookends: "작은 책들을 가지런히 세워 두어요.", "cover-display": "방 안을 싱그러운 초록으로 채우는 큰 나무예요.",
  bed: "함께 여행하는 펫이 쉬는 자리예요.", "pet-water": "쏙 들어가 이야기에 빠지는 아늑한 독서 텐트예요.", "pet-toys": "여행 친구의 장난감을 담아 두어요.",
  lamp: "책 읽는 시간을 따뜻한 빛으로 채워요.", "mood-light": "작은 빛으로 서재를 포근하게 꾸며요.", "music-box": "이야기를 떠올리는 작은 오르골 장식이에요.",
  plant: "책 읽는 곁을 초록으로 채워요.", terrarium: "유리 안의 작은 정원을 감상해요.", "hanging-planter": "벽에 작은 초록 친구를 걸어요.",
  wall: "새로운 이야기를 상상하는 벽 장식이에요.", "memo-board": "떠오른 생각을 기억하는 게시판이에요.", "wall-shelf": "작은 기념 소품을 올려 두는 진열 선반이에요.",
  clock: "독서 공간의 시간을 꾸미는 벽시계예요.", hourglass: "책 속 나라를 찾아보는 지구본이에요.", "desk-calendar": "포근히 누워 마지막 장까지 읽는 침대예요.",
  chest: "독서 여행의 보물을 모아 두어요.", "badge-display": "헤엄치는 물고기를 보며 쉬어 가는 어항이에요.", "travel-case": "다음 이야기로 떠날 준비를 해요.",
  garland: "독서 여행의 성장을 축하하는 창가 장식이에요.", "book-trophy": "완독의 순간을 기념하는 책 트로피예요.", "door-plaque": "나만의 독서 공간을 알리는 문패예요.",
};
const REQUIRED = new Set(["desk", "rug", "shelf", "lamp", "plant", "wall", "bed", "wall-shelf"]);
const SHELVES = new Map(HIDEOUT_CATALOG_DATA.shelves.map((shelf) => [shelf.theme, Object.freeze({ ...shelf })]));
export const HIDEOUT_SLOTS = Object.freeze(HIDEOUT_CATALOG_DATA.categories.map((category) => Object.freeze({
  ...category, ...HIDEOUT_CATALOG_DATA.slots[category.id], required: REQUIRED.has(category.id),
})));
const makeItem = (entry) => {
  const shelf = entry.slot === "wall-shelf" ? SHELVES.get(entry.theme === "basic" ? "forest" : entry.theme) : null;
  return Object.freeze({ ...entry, ...(shelf || {}), id: entry.id, slot: entry.slot,
    theme: entry.theme, description: DESCRIPTIONS[entry.slot],
    unlock: Object.freeze(entry.stage ? { level: entry.stage } : {}),
    unlockHint: entry.stage ? `독서 레벨 ${entry.stage}에 열려요` : "처음부터 사용할 수 있어요",
  });
};
const basicShelf = SHELVES.get("forest");
export const HIDEOUT_ITEMS = Object.freeze([
  ...HIDEOUT_CATALOG_DATA.baseline.map(makeItem),
  makeItem({ ...basicShelf, id: "wall-shelf-basic", slot: "wall-shelf", name: "기본 진열 선반", stage: 0, theme: "basic", themeName: "기본" }),
  ...HIDEOUT_CATALOG_DATA.items.map(makeItem),
]);
const BY_ID = new Map(HIDEOUT_ITEMS.map((entry) => [entry.id, entry]));
const SLOT_IDS = HIDEOUT_SLOTS.map((entry) => entry.id);
const BADGES = new Set(READING_BADGES.map((badge) => badge.id));
export const HIDEOUT_DEFAULT_LAYOUT = Object.freeze(Object.fromEntries(HIDEOUT_SLOTS.map((slot) => [slot.id,
  HIDEOUT_ITEMS.find((entry) => entry.slot === slot.id && entry.stage === 0)?.id ?? null,
])));
const plain = (value) => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const own = (value, key) => plain(value) ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;

// ── 배치(arrange) — 아지트 2단계(2026년 11월 · 선생님 요청: 소품의 자리와 방향을 학생이 바꾸기) ──────────────────────────
// 옮길 수 있는 소품(배치 열쇠)은 바닥에 서는 가구 · 러그, 벽에 거는 장식, 가구 위에 올리는 작은 소품입니다. 작은 벽 선반은 그림이
// 둘이라 따로 옮깁니다(ledge-left · ledge-right — 둘 다 'wall-shelf' 자리의 소품). 창가 장식은 창문에 걸려 옮기지 않습니다.
// 배치 한 칸 = { x, y, flip?, turn? } — x · y는 그림의 바닥 가운데(장면 좌표, 정수), flip은 좌우 뒤집기, turn은 돌린 모습
// (lib/readingHideoutTurn.js에 그림이 있는 소품만). 옮기지 않은 소품은 칸이 없고 카탈로그의 자리에 섭니다.
// 가구 위에 올린 소품은 { on, at, flip? }입니다(아래 '가구 위에 올리기').
export const HIDEOUT_FLOOR_UNITS = Object.freeze(["rug", "desk", "shelf", "bed", "lamp", "plant", "chest", "cushion", "pencil-caddy",
  "cover-display", "pet-water", "pet-toys", "hourglass", "desk-calendar", "badge-display", "travel-case", "terrarium"]);
export const HIDEOUT_WALL_UNITS = Object.freeze(["wall", "clock", "memo-board", "bookmark-rack", "hanging-planter", "door-plaque", "ledge-left", "ledge-right"]);
// 가구 위에 올리기(2026년 11월 · 선생님 요청 — "아이템 위치를 변경할 때 책상 위, 선반 위, 책장 위에도 올려 놓을 수 없을까요?"):
//   · 올리는 곳(윗면) — 책상 · 책장(맨 위) · 작은 벽 선반 · 아래 진열 선반(HIDEOUT_SURFACE_UNITS — 모두 꼭 있는 가구라 늘 있음).
//   · 늘 가구 위에만 서는 소품 — 책 받침대(처음엔 책상 위) · 북엔드 · 미니 오르골(작은 벽 선반) · 탁상 무드등 · 완독 기념
//     트로피(아래 진열 선반). 한때 받치는 가구를 따라가기만 하고 따로 옮기지 않았는데, 이제 다른 가구 위로도 옮깁니다.
//   · 바닥에도 서는 소품 — 화분 · 테라리움 · 펫 장난감 바구니 · 독서 여행 가방(처음엔 바닥, HIDEOUT_FLOOR_UNITS에도 있음).
//   · 배치 칸 { on, at, flip? } — on은 받치는 가구의 배치 열쇠, at은 그 윗면에서의 자리(0 왼쪽 끝 → 1000 오른쪽 끝 — 소품의
//     가운데가 설 수 있는 범위의 천분율, 받치는 가구를 뒤집으면 거울로). 천분율이라 가구를 옮기고 돌리고 다른 테마로 바꿔도
//     위의 소품이 같은 자리(비율)를 따라갑니다. 소품의 높이는 윗면의 줄(아래 HIDEOUT_SURFACE_ART)이 정합니다.
export const HIDEOUT_TOP_UNITS = Object.freeze(["bookstand", "bookends", "music-box", "mood-light", "book-trophy"]);
export const HIDEOUT_TOPPERS = Object.freeze([...HIDEOUT_TOP_UNITS, "plant", "terrarium", "pet-toys", "travel-case"]);
/** 늘 가구 위에 서는 소품이 처음(배치 칸이 없을 때) 서는 가구. */
export const HIDEOUT_TOP_HOME = Object.freeze({ bookstand: "desk", bookends: "ledge-left", "music-box": "ledge-left", "mood-light": "ledge-right", "book-trophy": "ledge-right" });
export const HIDEOUT_SURFACE_UNITS = Object.freeze(["desk", "shelf", "ledge-left", "ledge-right"]);
export const HIDEOUT_SURFACE_LABELS = Object.freeze({ desk: "책상 위", shelf: "책장 위", "ledge-left": "작은 벽 선반", "ledge-right": "아래 진열 선반" });
export const HIDEOUT_TOP_STEPS = 1000;
export const HIDEOUT_UNITS = Object.freeze([...HIDEOUT_FLOOR_UNITS, ...HIDEOUT_WALL_UNITS, ...HIDEOUT_TOP_UNITS]);
const UNIT_SET = new Set(HIDEOUT_UNITS);
const TOPPERS = new Set(HIDEOUT_TOPPERS), TOP_ONLY = new Set(HIDEOUT_TOP_UNITS), SURFACES = new Set(HIDEOUT_SURFACE_UNITS);
/** 가구 위에 올릴 수 있는 소품인가 · 늘 가구 위에만 서는 소품인가. */
export const hideoutUnitTops = (unit) => TOPPERS.has(unit);
export const hideoutUnitTopOnly = (unit) => TOP_ONLY.has(unit);
/** 그 소품을 놓을 수 있는 곳 — 'floor'(바닥)와 윗면들(받치는 가구의 배치 열쇠). */
export const hideoutPlaceTargets = (unit) => TOP_ONLY.has(unit) ? [...HIDEOUT_SURFACE_UNITS] : TOPPERS.has(unit) ? ["floor", ...HIDEOUT_SURFACE_UNITS] : [];
// 돌아가는 포털(2026년 11월 · 선생님 요청 — "포털의 위치도 사용자가 수정할 수 있게")도 배치의 한 칸입니다: 열쇠 'portal' ·
// 칸은 { x, y }(포털 가운데 · 장면 좌표 정수)뿐 — 둥근 포털이라 뒤집기 · 돌리기가 없고, 고르는 소품이 아니라 layout에 자리가 없습니다.
// 그림 · 누르는 범위 · 들어서는 타원은 lib/readingHideoutMap.js의 HIDEOUT_RETURN_PORTAL, 놓는 자리의 판정은 lib/readingHideoutArrange.js.
export const HIDEOUT_PORTAL_UNIT = "portal";
export const HIDEOUT_PORTAL_HOME = Object.freeze({ x: 1415, y: 820 });
/** 배치(arrange)에 들 수 있는 열쇠 — 옮기는 소품들과 포털. */
export const HIDEOUT_ARRANGE_KEYS = Object.freeze([...HIDEOUT_UNITS, HIDEOUT_PORTAL_UNIT]);
const LEDGE_SIDE = Object.freeze({ "ledge-left": "left", "ledge-right": "right" });
/** 배치 열쇠가 가리키는 자리(카테고리) — 벽 선반 둘은 'wall-shelf'. */
export const hideoutUnitCategory = (unit) => LEDGE_SIDE[unit] ? "wall-shelf" : unit;
/** 소품을 옮기지 않았을 때 서는 자리(그림의 바닥 가운데) — 포털은 포털 가운데. 늘 가구 위에 서는 소품은 없음(HIDEOUT_TOP_HOME의 가구 위). */
export const HIDEOUT_DEFAULT_ANCHORS = Object.freeze({
  ...Object.fromEntries([...HIDEOUT_FLOOR_UNITS, ...HIDEOUT_WALL_UNITS].map((unit) => {
    const base = LEDGE_SIDE[unit] ? HIDEOUT_CATALOG_DATA.ledgeSlots[LEDGE_SIDE[unit]] : HIDEOUT_CATALOG_DATA.slots[unit];
    return [unit, Object.freeze({ x: base.x, y: base.y })];
  })),
  [HIDEOUT_PORTAL_UNIT]: HIDEOUT_PORTAL_HOME,
});
/** 그 소품이 좌우로 뒤집히는가 — 벽 선반은 위의 소품 자리 때문에 뒤집지 않습니다. */
export const hideoutUnitFlips = (unit) => UNIT_SET.has(unit) && !LEDGE_SIDE[unit];
/**
 * 배치의 모양만 다듬습니다(자리가 비었거나 · 열쇠 · 숫자가 이상한 칸은 버림). 겹침 · 포털 길처럼 방 전체를 봐야 하는 판정은
 * lib/readingHideoutArrange.js(settleHideoutArrange · validateHideoutArrange)가 합니다. 옮기지 않은 것과 같은 칸(기본 자리 ·
 * 뒤집기 · 돌리기 없음)도 버려 저장되는 배치가 늘 가장 짧게 둡니다.
 */
export function hideoutArrangeShape(raw, layout) {
  const result = {};
  if (!plain(raw)) return result;
  const inScene = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x <= HIDEOUT_SCENE.width && y <= HIDEOUT_SCENE.height;
  for (const unit of HIDEOUT_UNITS) {
    const entry = own(raw, unit);
    if (!plain(entry)) continue;
    const itemId = own(layout, hideoutUnitCategory(unit));
    if (!BY_ID.has(itemId)) continue;
    // 가구 위에 올린 소품 — { on, at, flip? }(올릴 수 있는 소품 · 윗면 · 0~1000 정수만)
    const on = own(entry, "on");
    if (on !== undefined) {
      const at = own(entry, "at");
      if (!TOPPERS.has(unit) || !SURFACES.has(on) || !Number.isSafeInteger(at) || at < 0 || at > HIDEOUT_TOP_STEPS) continue;
      result[unit] = { on, at, ...(own(entry, "flip") === true ? { flip: true } : {}) };
      continue;
    }
    if (TOP_ONLY.has(unit)) continue;   // 늘 가구 위에 서는 소품에는 바닥 자리가 없음
    const x = own(entry, "x"), y = own(entry, "y");
    if (!inScene(x, y)) continue;
    const flip = own(entry, "flip") === true && hideoutUnitFlips(unit);
    const turn = own(entry, "turn") === true && !!hideoutTurnArt(itemId);
    const home = HIDEOUT_DEFAULT_ANCHORS[unit];
    if (x === home.x && y === home.y && !flip && !turn) continue;
    result[unit] = { x, y, ...(flip ? { flip: true } : {}), ...(turn ? { turn: true } : {}) };
  }
  // 포털 — 자리만(뒤집기 · 돌리기는 버림). 처음 자리와 같으면 칸을 두지 않습니다.
  const portal = own(raw, HIDEOUT_PORTAL_UNIT);
  if (plain(portal)) {
    const x = own(portal, "x"), y = own(portal, "y");
    if (inScene(x, y) && !(x === HIDEOUT_PORTAL_HOME.x && y === HIDEOUT_PORTAL_HOME.y)) result[HIDEOUT_PORTAL_UNIT] = { x, y };
  }
  return result;
}
/** 돌아가는 포털이 서는 자리(포털 가운데) — 배치에 포털 칸이 없으면 처음 자리. */
export function hideoutPortalPlacement(arrange) {
  const move = own(arrange, HIDEOUT_PORTAL_UNIT);
  return plain(move) && Number.isFinite(move.x) && Number.isFinite(move.y) ? { x: move.x, y: move.y } : { x: HIDEOUT_PORTAL_HOME.x, y: HIDEOUT_PORTAL_HOME.y };
}
/** 두 배치가 같은가(칸의 차례와 무관 · 포털 자리 · 가구 위에 올린 자리까지). */
export function sameHideoutArrange(a, b) {
  const left = plain(a) ? a : {}, right = plain(b) ? b : {};
  return HIDEOUT_ARRANGE_KEYS.every((unit) => {
    const p = own(left, unit), q = own(right, unit);
    if (!p || !q) return !p && !q;
    return p.x === q.x && p.y === q.y && p.on === q.on && p.at === q.at && !!p.flip === !!q.flip && !!p.turn === !!q.turn;
  });
}
export function hideoutProgress(summary, { teacher = false } = {}) {
  // Only an authenticated server/demo role grants this mode. It is not a
  // reading level and never creates XP, badges or a reading ledger for teachers.
  if (teacher === true) return { level: 1, earnedBadgeIds: [], teacher: true };
  const raw = own(summary, "level");
  const level = typeof raw === "number" && Number.isFinite(raw) ? Math.max(1, Math.min(READING_LEVEL_MAX, Math.floor(raw))) : 1;
  const earned = own(summary, "earnedBadges");
  const ids = Array.isArray(earned) ? earned.map((entry) => typeof entry === "string" ? entry : own(entry, "id")) : own(summary, "earnedBadgeIds");
  return { level, earnedBadgeIds: [...new Set((Array.isArray(ids) ? ids : []).filter((id) => BADGES.has(id)))] };
}
export function isHideoutItemUnlocked(itemOrId, summary) {
  const entry = BY_ID.get(typeof itemOrId === "string" ? itemOrId : own(itemOrId, "id"));
  return !!entry && (own(summary, "teacher") === true || !entry.unlock.level || hideoutProgress(summary).level >= entry.unlock.level);
}
export function normalizeHideoutRoom(input, summary) {
  const stored = own(input, "layout"), layout = { ...HIDEOUT_DEFAULT_LAYOUT };
  for (const slot of SLOT_IDS) {
    const id = own(stored, slot), entry = BY_ID.get(id);
    if (id === null && !REQUIRED.has(slot)) layout[slot] = null;
    else if (entry?.slot === slot && isHideoutItemUnlocked(id, summary)) layout[slot] = id;
  }
  const value = own(input, "revision");
  const revision = Number.isSafeInteger(value) && value >= 0 ? value : 0;
  // 배치는 모양만 여기서 다듬습니다 — 방 전체를 보는 판정(겹침 · 포털 길)은 settleHideoutArrange(lib/readingHideoutArrange.js).
  return { version: 2, layout, arrange: hideoutArrangeShape(own(input, "arrange"), layout), revision };
}
function invalid(message, code = "reading/invalid-hideout") {
  return Object.assign(new Error(message), { code, status: 400 });
}
export function validateHideoutLayout(layout, summary) {
  if (!plain(layout)) throw invalid("아지트의 소품 정보를 확인해 주세요.");
  const keys = Reflect.ownKeys(layout);
  if (keys.length !== SLOT_IDS.length || keys.some((key) => !SLOT_IDS.includes(key))) throw invalid("아지트의 소품 자리가 올바르지 않아요.");
  const result = {};
  for (const slot of SLOT_IDS) {
    const id = own(layout, slot), entry = BY_ID.get(id);
    if (id === null && !REQUIRED.has(slot)) { result[slot] = null; continue; }
    if (!entry || entry.slot !== slot) throw invalid("이 자리에 놓을 수 있는 소품을 골라 주세요.");
    if (!isHideoutItemUnlocked(id, summary)) throw invalid("아직 열리지 않은 소품이에요. 독서 성장 조건을 확인해 주세요.", "reading/hideout-locked");
    result[slot] = id;
  }
  return result;
}

// 바닥에 닿는 그림자(hideout.css의 .is-grounded) — 작은 바닥 소품과 2026년 11월에 바꾼 바닥 가구 여섯
// (1인 독서 소파 · 큰 나무 화분 · 독서 텐트 · 지구본 스탠드 · 독서 침대 · 스탠드 어항 — 자리 이름은 예전 그대로).
const CONTACT = new Set(["pet-toys", "terrarium", "travel-case", "cushion",
  "pencil-caddy", "cover-display", "pet-water", "hourglass", "desk-calendar", "badge-display"]);
const WALL = new Set(["wall", "clock", "memo-board", "bookmark-rack", "hanging-planter", "door-plaque"]);
const TABLE = new Set(["bookstand"]);

// 책상 위 소품(책 받침대)의 자리 — 책상마다 다릅니다(선생님 신고 · 2026년 11월).
// x · y는 소품 그림의 바닥 가운데(장면 좌표), width는 그림 폭입니다. 카탈로그의 한 자리(예전 그림 v2의 넓고 낮은 윗면 기준)를
// 그대로 쓰면, 윗면이 좁고 높이 들린 도트 책상에서 소품이 윗면 뒤 가장자리에 걸리고 테마 책상 넷은 가운데에 그려진 책을
// 받침대가 덮었습니다.
//   · 기본 책상(책 없음) — 받침대는 가운데 뒤.
//   · 테마 책상(가운데에 책) — 받침대는 앞 왼쪽(그려진 책을 가리지 않게).
// 한때 필기구 정리함 · 탁상 달력도 책상 위에 섰는데, 2026년 11월에 바닥 가구(1인 독서 소파 · 독서 침대)로 바뀌었습니다.
// 책상 그림을 바꾸면 이 숫자도 다시 재세요 — tests/unit/plazaArtFit.test.mjs가 소품 바닥이 윗면 위에 있는지 ·
// 그려진 책을 가리지 않는지를 그림과 직접 견줍니다.
const THEME_DESK_TOP = Object.freeze({
  bookstand: Object.freeze({ x: 127, y: 676, width: 52 }),
});
export const HIDEOUT_TABLETOP = Object.freeze({
  "desk-basic": Object.freeze({
    bookstand: Object.freeze({ x: 166, y: 640, width: 60 }),
  }),
  "desk-forest": THEME_DESK_TOP,
  "desk-starlight": THEME_DESK_TOP,
  "desk-coastal": THEME_DESK_TOP,
  // 탐험 책상은 그려진 책이 윗면 앞까지 닿아(앞쪽 띠가 없음) 소품을 조금 작게 둡니다.
  "desk-explorer": Object.freeze({
    bookstand: Object.freeze({ x: 127, y: 669, width: 48 }),
  }),
});
// 돌린 책상(의자가 책상 앞 — lib/readingHideoutTurn.js)의 책 받침대 자리 — 돌린 그림의 픽셀 좌표(x · y는 받침대의 바닥 가운데)와
// 화면 폭입니다. 기본 책상은 윗면 가운데, 테마 책상은 그려진 책과 윗면 오른쪽 끝의 가운데(탐험 책상은 금속 장식을 비켜 책 쪽으로
// 조금 작게). 그림을 보고 잼 — 돌린 책상 그림을 바꾸면 다시 재세요(tests/unit/readingHideoutArrange.test.mjs가 받침대 바닥이
// 책상 윗면(밝은 나무)인지 그림과 견줌). 2026년 11월에 돌린 책상을 좌우로 32px씩 넓히며(scripts/hideout-desk-widen.mjs) 다시 쟀습니다.
const TURN_DESK_TOP = Object.freeze({ bookstand: Object.freeze({ x: 244, y: 122, width: 44 }) });
export const HIDEOUT_TURN_TABLETOP = Object.freeze({
  "desk-basic": Object.freeze({ bookstand: Object.freeze({ x: 158, y: 104, width: 52 }) }),
  "desk-forest": TURN_DESK_TOP,
  "desk-starlight": TURN_DESK_TOP,
  "desk-coastal": TURN_DESK_TOP,
  "desk-explorer": Object.freeze({ bookstand: Object.freeze({ x: 213, y: 112, width: 36 }) }),
});
// 책상 위 소품의 앞뒤 차례 — 책상(z = 100 + 책상 바닥 y)보다 한 칸 위. 책상 앞에 선 캐릭터는 책상 발자리(책상 바닥 y + 15)와
// 발 반지름(48)만큼 떨어져 서므로 늘 그보다 위(z가 큼)에 그려지고, 책상 뒤의 캐릭터는 책상과 함께 가려집니다.
// 한때 고정 셈(900 + (y − 600) / 2)이었는데 책상을 옮길 수 있게 되며 책상을 따르게 했습니다(2026년 11월).
const tabletopZ = (deskY) => Math.round(100 + deskY) + 1;

// 가구의 윗면(소품을 올리는 줄 — 2026년 11월 · 선생님 요청, 위 '가구 위에 올리기') — 그 가구 그림의 픽셀(왼쪽 위가 0)입니다:
// y는 올린 소품의 그림 바닥이 닿는 줄, x0 ~ x1은 그 줄에서 소품이 설 수 있는 좌우 범위(밝은 나무 윗면의 양 끝). 그림을 보고 잼.
//   · 책상 앞모습 — 책 받침대가 처음 서는 높이(HIDEOUT_TABLETOP과 1px 안으로 같음 — 받침대를 옮겨도 높이가 그대로).
//   · 책상 돌린 모습(의자를 앞으로) — HIDEOUT_TURN_TABLETOP의 높이.
//   · 책장 — 맨 위 윗면. 장식(잎과 도토리 · 달 · 조개 · 나침반)이 얹힌 책장은 장식 아래 몸통 윗판의 줄이라 소품이 장식 앞에 섭니다
//     (탐험 책장은 뚜껑 모양 윗면의 위 끝 — 가운데 나침반 앞에도 놓임).
// 화면은 가구의 배율 · 좌우 뒤집기대로 장면 좌표로 바꿉니다(surfaceOf). 그림을 바꾸면 다시 재세요 — tests/unit/readingHideoutArrange.test.mjs가
// 줄이 그 가구 그림의 밝은 윗면 위인지 그림과 직접 견줍니다.
const topLine = (y, x0, x1) => Object.freeze({ y, x0, x1 });
export const HIDEOUT_SURFACE_ART = Object.freeze({
  "desk-basic": Object.freeze({ front: topLine(114, 86, 352), turn: topLine(104, 16, 299) }),
  "desk-forest": Object.freeze({ front: topLine(204, 29, 277), turn: topLine(122, 12, 291) }),
  "desk-starlight": Object.freeze({ front: topLine(204, 29, 277), turn: topLine(122, 12, 292) }),
  "desk-explorer": Object.freeze({ front: topLine(156, 56, 294), turn: topLine(112, 15, 294) }),
  "desk-coastal": Object.freeze({ front: topLine(204, 28, 275), turn: topLine(122, 12, 294) }),
  "shelf-low": Object.freeze({ front: topLine(125, 65, 441), turn: topLine(30, 24, 182) }),
  "shelf-forest": Object.freeze({ front: topLine(148, 82, 402), turn: topLine(106, 40, 174) }),
  "shelf-starlight": Object.freeze({ front: topLine(185, 70, 350), turn: topLine(100, 16, 160) }),
  "shelf-explorer": Object.freeze({ front: topLine(60, 66, 392), turn: topLine(98, 10, 168) }),
  "shelf-coastal": Object.freeze({ front: topLine(205, 70, 362), turn: topLine(98, 10, 150) }),
});
// 벽 선반(빈 선반 그림 · 테마마다 — 기본 선반은 숲속 그림)의 좌우 범위. 줄은 지금 위의 소품이 서는 높이(그림 높이의 20% —
// 카탈로그 surfaceYFraction · 장면에서 +0.5)라 범위만 적습니다.
export const HIDEOUT_LEDGE_SPAN = Object.freeze({
  forest: Object.freeze([33, 518]), starlight: Object.freeze([44, 523]), explorer: Object.freeze([38, 523]), coastal: Object.freeze([42, 526]),
});
// 그림 픽셀의 줄 → 장면 좌표의 윗면 { y, x0, x1, flip }(뒤집은 가구는 바닥 가운데를 축으로 거울 — flip은 위 소품의 자리도 거울로)
function surfaceOf(prop, line, artWidth) {
  if (!line) return null;
  const k = prop.width / artWidth, left = prop.x - prop.width / 2;
  let x0 = left + line.x0 * k, x1 = left + line.x1 * k;
  if (prop.flip) [x0, x1] = [2 * prop.x - x1, 2 * prop.x - x0];
  return Object.freeze({ y: prop.y - prop.height + line.y * k, x0, x1, flip: !!prop.flip });
}
/**
 * 윗면 위에서 소품의 가운데(그림의 바닥 가운데 x)가 설 수 있는 범위 { lo, hi } — 소품의 보이는 폭(투명 여백 뺀)에서 양쪽 10%
 * 안쪽 끝이 윗면 안이어야 합니다(바닥 가구가 바닥에 설 때와 같은 셈 — 잎이 넓은 화분은 그만큼 걸쳐도 됨). hi < lo면 들어갈 자리가 모자람.
 */
export function hideoutTopRange(surface, src, width, flip = false) {
  const [l, , r] = HIDEOUT_ART_INSETS[src] ?? [0, 0, 0, 0];
  const [left, right] = flip ? [r, l] : [l, r];
  const slack = width * (1 - left - right) * 0.1;
  return { lo: surface.x0 + width / 2 - left * width - slack, hi: surface.x1 - width / 2 + right * width + slack };
}
/** 올린 자리(at 0~1000) → 장면 x. 받치는 가구를 뒤집었으면 거울로. 자리가 모자라면 가운데. */
export function hideoutTopX(surface, range, at) {
  const t = (surface.flip ? HIDEOUT_TOP_STEPS - at : at) / HIDEOUT_TOP_STEPS;
  return range.hi >= range.lo ? range.lo + t * (range.hi - range.lo) : (range.lo + range.hi) / 2;
}
/** 장면 x → 올린 자리(at 0~1000 정수 · 범위 안으로). */
export function hideoutTopAt(surface, range, x) {
  if (!(range.hi > range.lo)) return HIDEOUT_TOP_STEPS / 2;
  const at = Math.round(Math.max(0, Math.min(1, (x - range.lo) / (range.hi - range.lo))) * HIDEOUT_TOP_STEPS);
  return surface.flip ? HIDEOUT_TOP_STEPS - at : at;
}

// 문패 글자 칸 — 그림마다 크림색 칸의 위 · 아래(그림 높이의 비율)와, 장식(잎 · 별 · 나침반 · 조개)이 파고들지 않는
// 가로 띠(그림 폭의 비율)입니다. one은 칸 높이의 가운데 50%(한 줄)에서, two는 가운데 88%(두 줄)에서 잰 띠입니다.
// 그 높이 몫(share)과 줄 간격(lineHeight)은 아래 HIDEOUT_PLAQUE_FONT — 띠를 다시 재면 몫도 함께 맞추세요(시험이 그림과 견줌).
const PLAQUE_PANELS = Object.freeze({
  forest: Object.freeze({ top: 0.289, bottom: 0.777, one: [0.162, 0.768], two: [0.252, 0.708] }),
  starlight: Object.freeze({ top: 0.256, bottom: 0.785, one: [0.168, 0.8], two: [0.224, 0.72] }),
  explorer: Object.freeze({ top: 0.315, bottom: 0.794, one: [0.204, 0.719], two: [0.281, 0.679] }),
  coastal: Object.freeze({ top: 0.293, bottom: 0.832, one: [0.139, 0.762], two: [0.222, 0.649] }),
});
export const HIDEOUT_PLAQUE_PANELS = PLAQUE_PANELS;
// 글자 크기(장면 단위) · 줄 간격 — lineHeight는 hideout.css의 .hideout-plaque-label line-height와 같아야 합니다.
export const HIDEOUT_PLAQUE_FONT = Object.freeze({ max: 15, min: 6, lineHeight: 1.06, share: Object.freeze({ one: 0.5, two: 0.88 }) });
// 글자 폭 어림(글자 크기의 몇 배) — 한글 · 그 밖의 글자 1, 띄어쓰기 0.32, 영어 · 숫자 0.62. 실제 글꼴(Pretendard 등)보다
// 조금 넉넉히 잡아, 어림이 빗나가도 칸을 넘지 않게 합니다(화면은 넘치면 말줄임 — 안전망).
export function hideoutPlaqueTextEm(text) {
  return [...String(text ?? "")].reduce((sum, ch) => sum + (ch === " " ? 0.32 : /[!-~]/.test(ch) ? 0.62 : 1), 0);
}
// 문패에 쓸 글자와 자리(장면 좌표) — '○○의 아지트'를 한 줄로, 또는 '○○의' / '아지트' 두 줄로 쓰되 글자가 더 크게
// 들어가는 쪽을 고릅니다(선생님 신고 · 2026년 11월 — 한때 글자 크기를 화면 폭(vw)에 맞춰, 그림이 작게 보이는 화면에서는
// '선생님의 아지트'가 문패 밖으로 넘쳤습니다). 크기는 장면 단위라 화면에서는 --hideout-unit을 곱해 그림과 함께 커지고 작아집니다.
export function hideoutPlaqueLabel(prop, owner) {
  const base = PLAQUE_PANELS[prop?.theme] ?? PLAQUE_PANELS.forest;
  // 좌우로 뒤집은 문패(아지트 2단계)는 장식이 반대쪽으로 가므로 글자 띠도 거울로(글자는 뒤집지 않음 — 그림 위에 따로 씀).
  const mirror = ([l, r]) => [1 - r, 1 - l];
  const panel = prop?.flip ? { ...base, one: mirror(base.one), two: mirror(base.two) } : base;
  const name = String(owner ?? "").trim() || "나";
  const left = prop.x - prop.width / 2, top = prop.y - prop.height;
  const panelHeight = (panel.bottom - panel.top) * prop.height;
  const y = top + (panel.top + panel.bottom) / 2 * prop.height;
  const fit = (lines, [l, r], share) => {
    const width = (r - l) * prop.width;
    const widest = Math.max(...lines.map(hideoutPlaqueTextEm));
    const fontSize = Math.min(HIDEOUT_PLAQUE_FONT.max, width * 0.94 / widest,
      panelHeight * share / (lines.length * HIDEOUT_PLAQUE_FONT.lineHeight));
    return { lines, x: left + (l + r) / 2 * prop.width, y, width, fontSize };
  };
  const one = fit([`${name}의 아지트`], panel.one, HIDEOUT_PLAQUE_FONT.share.one);
  const two = fit([`${name}의`, "아지트"], panel.two, HIDEOUT_PLAQUE_FONT.share.two);
  const best = two.fontSize > one.fontSize * 1.05 ? two : one;
  return { ...best, fontSize: Math.max(HIDEOUT_PLAQUE_FONT.min, Math.floor(best.fontSize * 10) / 10) };
}

/**
 * 방에 그릴 소품들 — 저마다 그림 · 자리(바닥 가운데 x · y) · 폭 · 높이 · 앞뒤 차례(z)를 셉니다.
 * arrange(아지트 2단계 — 학생이 옮긴 자리 · 뒤집기 · 돌리기 · 가구 위에 올림)가 있으면 그 칸대로, 없으면 카탈로그의 자리에 섭니다.
 * 소품마다 unit(옮길 때 쓰는 배치 열쇠 — 옮길 수 없으면 null)과 parentUnit(책상 위 · 책장 위 · 선반 위 소품을 받치는 가구 —
 * 그 가구를 따라 함께 움직임), flip(좌우 뒤집음) · turned(돌린 그림) · look(돌린 모습의 종류)을 함께 싣습니다. 받치는 가구(책상 ·
 * 책장 · 벽 선반 둘)에는 윗면 surface({ y, x0, x1, flip } — 장면 좌표)가 붙습니다.
 */
export function hideoutSceneProps(layout, arrange = null) {
  const selected = plain(layout) ? layout : HIDEOUT_DEFAULT_LAYOUT;
  const moves = plain(arrange) ? arrange : {};
  const moveOf = (unit) => {
    const move = own(moves, unit);
    return plain(move) && Number.isFinite(move.x) && Number.isFinite(move.y) && move.on == null ? move : null;
  };
  // 가구 위에 올린 소품의 칸 — { on, at }(받치는 가구는 아래에서 다 센 뒤에 그 윗면에 세움)
  const liftOf = (unit) => {
    const move = own(moves, unit);
    return TOPPERS.has(unit) && plain(move) && SURFACES.has(move.on) && Number.isFinite(move.at) ? move : null;
  };
  // 책상 — 책상 위 소품(책 받침대)이 따라갑니다(뒤집으면 거울로 · 돌리면 돌린 그림의 자리로).
  const deskItem = BY_ID.get(selected.desk);
  const deskHome = HIDEOUT_CATALOG_DATA.slots.desk;
  const deskMove = moveOf("desk");
  const deskTurn = deskMove?.turn === true ? hideoutTurnArt(deskItem?.id) : null;
  const desk = { x: deskMove?.x ?? deskHome.x, y: deskMove?.y ?? deskHome.y, flip: deskMove?.flip === true, turn: deskTurn };
  const deskKey = deskItem?.slot === "desk" ? deskItem.id : "desk-basic";
  const tabletop = HIDEOUT_TABLETOP[deskKey] ?? HIDEOUT_TABLETOP["desk-basic"];
  const turnTop = HIDEOUT_TURN_TABLETOP[deskKey] ?? HIDEOUT_TURN_TABLETOP["desk-basic"];
  // 벽 선반 둘 — 위에 놓인 소품이 따라갑니다.
  const shelfItem = BY_ID.get(selected["wall-shelf"]) ?? BY_ID.get("wall-shelf-basic");
  const shelf = SHELVES.get(shelfItem.theme === "basic" ? "forest" : shelfItem.theme);
  const surfaces = {}, ledgeShift = {};
  const ledges = Object.entries(HIDEOUT_CATALOG_DATA.ledgeSlots).map(([side, home]) => {
    const unit = "ledge-" + side, move = moveOf(unit);
    const position = { ...home, ...(move ? { x: move.x, y: move.y } : null) };
    ledgeShift[side] = { dx: position.x - home.x, dy: position.y - home.y };
    const height = position.width * shelf.height / shelf.width;
    const surfaceY = position.y - height + height * shelf.surfaceYFraction;
    surfaces[side] = surfaceY;
    // 윗면 — 줄은 위의 소품이 처음부터 서던 높이(+0.5) 그대로, 좌우는 빈 선반 그림의 밝은 윗면(HIDEOUT_LEDGE_SPAN)
    const span = HIDEOUT_LEDGE_SPAN[shelf.theme] ?? HIDEOUT_LEDGE_SPAN.forest, k = position.width / shelf.width, left = position.x - position.width / 2;
    const surface = Object.freeze({ y: surfaceY + 0.5, x0: left + span[0] * k, x1: left + span[1] * k, flip: false });
    return { ...shelfItem, ...position, id: "wall-shelf-" + side, itemId: shelfItem.id, category: "wall-shelf", imageId: "empty-ledge-" + shelf.theme,
      src: shelf.src, height, z: 10, surfaceY, surface, contactShadow: false, unit, parentUnit: null, flip: false, turned: false, look: null };
  });
  const props = [], lifted = [];
  let deskProp = null;
  for (const slot of HIDEOUT_SLOTS) {
    if (slot.id === "wall-shelf") continue;
    const entry = BY_ID.get(selected[slot.id]);
    if (!entry || entry.slot !== slot.id) continue;
    const home = HIDEOUT_CATALOG_DATA.slots[slot.id];
    const position = { ...home };
    const unit = UNIT_SET.has(slot.id) ? slot.id : null;
    const lift = unit ? liftOf(unit) : null;
    // 바닥(벽) 자리 — 늘 가구 위에 서는 소품의 바닥 자리는 끄는 동안의 미리보기에서만 생김(저장되는 배치에는 없음)
    const move = unit && !lift ? moveOf(unit) : null;
    let flip = move?.flip === true && hideoutUnitFlips(unit);
    const turn = move?.turn === true ? hideoutTurnArt(entry.id) : null;
    let parentUnit = null;
    if (slot.id === "lamp") position.width = Math.min(120, 280 * entry.width / entry.height);
    // 처음 자리(배치 칸 없음) — 책 받침대는 책상 위, 북엔드 · 오르골 · 무드등 · 트로피는 벽 선반 위의 정해진 자리
    const resting = !lift && !move;
    if (lift) parentUnit = lift.on;
    else if (resting && TABLE.has(slot.id)) {
      parentUnit = "desk";
      flip = desk.flip;
      if (desk.turn && deskProp) {
        // 돌린 책상 — 돌린 그림의 픽셀 자리를 화면 배율로(뒤집으면 거울로)
        const spot = turnTop[slot.id], k = deskProp.width / desk.turn.width;
        const dx = (spot.x - desk.turn.width / 2) * k;
        position.x = desk.x + (desk.flip ? -dx : dx);
        position.y = desk.y + (spot.y - desk.turn.height) * k;
        position.width = spot.width;
      } else {
        const spot = tabletop[slot.id];
        const dx = spot.x - deskHome.x;
        position.x = desk.x + (desk.flip ? -dx : dx);
        position.y = desk.y + (spot.y - deskHome.y);
        position.width = spot.width;
      }
    }
    if (resting && position.support) {
      parentUnit = "ledge-" + position.support;
      position.x = home.x + ledgeShift[position.support].dx;
      position.y = surfaces[position.support] + 0.5;
    }
    if (move) { position.x = move.x; position.y = move.y; }
    let src = entry.src, width = position.width, height;
    if (turn) {
      // 돌린 그림은 앞모습과 같은 배율로 — 픽셀 ÷ 참고 시트 배율이 앞모습 그림과 같은 단위(lib/readingHideoutTurn.js)
      width = position.width * (turn.width / turn.scale) / entry.width;
      height = width * turn.height / turn.width;
      src = turn.src;
    } else height = width * entry.height / entry.width;
    if (position.top !== undefined) position.y = position.top + height;
    let z = 100 + position.y;
    if (WALL.has(slot.id)) z = 5;
    if (slot.id === "garland") z = 10;
    if (slot.id === "rug") z = 0;
    if (resting && position.support) z = 20;
    if (resting && TABLE.has(slot.id)) z = tabletopZ(desk.y);
    const prop = { ...entry, ...position, src, width, height, id: entry.id, itemId: entry.id, category: slot.id, z, contactShadow: CONTACT.has(slot.id) && !lift,
      unit, parentUnit, flip, turned: !!turn, look: turn?.look ?? null };
    if (slot.id === "desk") deskProp = prop;
    // 받치는 가구의 윗면 — 앞모습 · 돌린 모습의 그림 픽셀(HIDEOUT_SURFACE_ART)을 장면 좌표로
    if (slot.id === "desk" || slot.id === "shelf") {
      const art = HIDEOUT_SURFACE_ART[entry.id];
      prop.surface = surfaceOf(prop, turn ? art?.turn : art?.front, turn ? turn.width : entry.width);
    }
    if (lift) lifted.push(prop);
    props.push(prop);
  }
  // 가구 위에 올린 소품 — 받치는 가구를 다 센 뒤 그 윗면의 줄에 세웁니다(자리는 천분율 at, 받치는 가구를 뒤집으면 자리도
  // 방향도 거울로). 앞뒤 차례는 받치는 가구보다 한 칸 위(벽 선반 위는 지금처럼 20).
  const bearers = new Map([...props, ...ledges].filter((prop) => prop.surface).map((prop) => [prop.unit, prop]));
  for (const prop of lifted) {
    const bearer = bearers.get(prop.parentUnit), lift = own(moves, prop.unit);
    if (!bearer) { prop.parentUnit = null; continue; }   // 받칠 가구가 없는 방(꼭 있는 가구라 실제로는 없음) — 카탈로그 자리에
    if (prop.category === "bookstand") {
      // 책 받침대는 책상마다 정해 둔 크기(HIDEOUT_TABLETOP · HIDEOUT_TURN_TABLETOP — 카탈로그 폭은 예전 넓은 책상 기준이라 큼).
      // 책상 위에서 옮기면 처음 크기 그대로, 책상이 아닌 곳에서는 테마 책상의 크기.
      const art = BY_ID.get(prop.itemId);
      prop.width = bearer.unit === "desk" ? (desk.turn ? turnTop.bookstand.width : tabletop.bookstand.width) : THEME_DESK_TOP.bookstand.width;
      prop.height = prop.width * art.height / art.width;
    }
    prop.flip = (lift.flip === true) !== bearer.surface.flip;
    const range = hideoutTopRange(bearer.surface, prop.src, prop.width, prop.flip);
    prop.x = hideoutTopX(bearer.surface, range, lift.at);
    prop.y = bearer.surface.y;
    prop.z = bearer.category === "wall-shelf" ? 20 : Math.round(100 + bearer.y) + 1;
  }
  return [...props, ...ledges];
}

/** 방의 윗면들 — 받치는 가구(책상 · 책장 · 벽 선반 둘)의 배치 열쇠 → { y, x0, x1, flip }(장면 좌표). */
export function hideoutSurfaces(props) {
  return new Map((Array.isArray(props) ? props : []).filter((prop) => prop.surface && prop.unit).map((prop) => [prop.unit, prop.surface]));
}

/**
 * 소품 그림의 '보이는 상자'(장면 좌표) — 투명 여백을 뺀 부분(lib/readingHideoutBoxes.js). 좌우로 뒤집은 그림은 여백도 거울로.
 * 표에 없는 그림이면 그림 상자 그대로입니다.
 */
export function hideoutArtBox(prop) {
  const [l, t, r, b] = HIDEOUT_ART_INSETS[prop?.src] ?? [0, 0, 0, 0];
  const [left, right] = prop?.flip ? [r, l] : [l, r];
  const x0 = prop.x - prop.width / 2, y0 = prop.y - prop.height;
  return { x0: x0 + left * prop.width, y0: y0 + t * prop.height, x1: x0 + (1 - right) * prop.width, y1: y0 + (1 - b) * prop.height };
}
