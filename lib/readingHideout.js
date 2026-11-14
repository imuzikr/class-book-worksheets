// A private room stores item choices only. Movement and preview state never write to Firestore.
import { READING_BADGES, READING_LEVEL_MAX } from "./reading.js";
import { HIDEOUT_CATALOG_DATA } from "./readingHideoutCatalog.js";

export const HIDEOUT_SCENE = Object.freeze({ width: 1536, height: 1024, background: "/reading-hideout/background.webp" });
export const HIDEOUT_OCCUPANTS = Object.freeze({
  character: Object.freeze({ x: 760, y: 850, width: 252 }),
  pet: Object.freeze({ x: 190, y: 516.8, width: 120 }),
});
export const HIDEOUT_THEMES = Object.freeze(HIDEOUT_CATALOG_DATA.themes.map((theme) => Object.freeze({ ...theme })));
const DESCRIPTIONS = {
  rug: "독서 공간에 포근한 자리를 만들어요.", cushion: "편안히 앉아 읽는 작은 쿠션이에요.", "bookmark-rack": "이야기의 자리를 기억하는 책갈피를 모아요.",
  desk: "책과 함께 집중하는 나만의 자리예요.", bookstand: "읽는 책을 편하게 펼쳐 두어요.", "pencil-caddy": "생각을 적는 필기구를 모아 두어요.",
  shelf: "좋아하는 이야기를 차곡차곡 모아요.", bookends: "작은 책들을 가지런히 세워 두어요.", "cover-display": "아끼는 책을 앞에 펼쳐 전시해요.",
  bed: "함께 여행하는 펫이 쉬는 자리예요.", "pet-water": "쉬는 친구 곁에 놓는 작은 물그릇이에요.", "pet-toys": "여행 친구의 장난감을 담아 두어요.",
  lamp: "책 읽는 시간을 따뜻한 빛으로 채워요.", "mood-light": "작은 빛으로 서재를 포근하게 꾸며요.", "music-box": "이야기를 떠올리는 작은 오르골 장식이에요.",
  plant: "책 읽는 곁을 초록으로 채워요.", terrarium: "유리 안의 작은 정원을 감상해요.", "hanging-planter": "벽에 작은 초록 친구를 걸어요.",
  wall: "새로운 이야기를 상상하는 벽 장식이에요.", "memo-board": "떠오른 생각을 기억하는 게시판이에요.", "wall-shelf": "작은 기념 소품을 올려 두는 진열 선반이에요.",
  clock: "독서 공간의 시간을 꾸미는 벽시계예요.", hourglass: "책과 함께 흐르는 시간을 떠올려요.", "desk-calendar": "읽는 날을 기대하게 하는 달력 장식이에요.",
  chest: "독서 여행의 보물을 모아 두어요.", "badge-display": "성장의 순간을 기념하는 배지 장식이에요.", "travel-case": "다음 이야기로 떠날 준비를 해요.",
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
export function hideoutProgress(summary) {
  const raw = own(summary, "level");
  const level = typeof raw === "number" && Number.isFinite(raw) ? Math.max(1, Math.min(READING_LEVEL_MAX, Math.floor(raw))) : 1;
  const earned = own(summary, "earnedBadges");
  const ids = Array.isArray(earned) ? earned.map((entry) => typeof entry === "string" ? entry : own(entry, "id")) : own(summary, "earnedBadgeIds");
  return { level, earnedBadgeIds: [...new Set((Array.isArray(ids) ? ids : []).filter((id) => BADGES.has(id)))] };
}
export function isHideoutItemUnlocked(itemOrId, summary) {
  const entry = BY_ID.get(typeof itemOrId === "string" ? itemOrId : own(itemOrId, "id"));
  return !!entry && (!entry.unlock.level || hideoutProgress(summary).level >= entry.unlock.level);
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
  return { version: 2, layout, revision };
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

const CONTACT = new Set(["pet-water", "pet-toys", "terrarium", "travel-case", "cushion"]);
const WALL = new Set(["wall", "clock", "memo-board", "bookmark-rack", "hanging-planter", "door-plaque"]);
const TABLE = new Set(["bookstand", "pencil-caddy", "desk-calendar"]);
export function hideoutSceneProps(layout) {
  const selected = plain(layout) ? layout : HIDEOUT_DEFAULT_LAYOUT;
  const shelfItem = BY_ID.get(selected["wall-shelf"]) ?? BY_ID.get("wall-shelf-basic");
  const shelf = SHELVES.get(shelfItem.theme === "basic" ? "forest" : shelfItem.theme);
  const surfaces = {};
  const ledges = Object.entries(HIDEOUT_CATALOG_DATA.ledgeSlots).map(([side, position]) => {
    const height = position.width * shelf.height / shelf.width;
    const surfaceY = position.y - height + height * shelf.surfaceYFraction;
    surfaces[side] = surfaceY;
    return { ...shelfItem, ...position, id: "wall-shelf-" + side, itemId: shelfItem.id, category: "wall-shelf", imageId: "empty-ledge-" + shelf.theme,
      src: shelf.src, height, z: 10, surfaceY, contactShadow: false };
  });
  const props = [];
  for (const slot of HIDEOUT_SLOTS) {
    if (slot.id === "wall-shelf") continue;
    const entry = BY_ID.get(selected[slot.id]);
    if (!entry || entry.slot !== slot.id) continue;
    const position = { ...HIDEOUT_CATALOG_DATA.slots[slot.id] };
    if (slot.id === "lamp") position.width = Math.min(120, 280 * entry.width / entry.height);
    if (position.support) position.y = surfaces[position.support] + 0.5;
    const height = position.width * entry.height / entry.width;
    if (position.top !== undefined) position.y = position.top + height;
    let z = 100 + position.y;
    if (WALL.has(slot.id)) z = 5;
    if (slot.id === "garland") z = 10;
    if (slot.id === "rug") z = 0;
    if (position.support) z = 20;
    if (TABLE.has(slot.id)) z = 925;
    props.push({ ...entry, ...position, id: entry.id, itemId: entry.id, category: slot.id, height, z, contactShadow: CONTACT.has(slot.id) });
  }
  return [...props, ...ledges];
}
