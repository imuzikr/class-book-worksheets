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

// 책상 위 소품(책 받침대 · 필기구 정리함 · 탁상 달력)의 자리 — 책상마다 다릅니다(선생님 신고 · 2026년 11월).
// x · y는 소품 그림의 바닥 가운데(장면 좌표), width는 그림 폭입니다. 카탈로그의 한 자리(예전 그림 v2의 넓고 낮은 윗면 기준)를
// 그대로 쓰면, 윗면이 좁고 높이 들린 도트 책상에서 세 소품이 윗면 뒤 가장자리에 한 줄로 걸리고(달력은 왼쪽 밖으로 삐져나옴)
// 테마 책상 넷은 가운데에 그려진 책을 받침대가 덮었습니다.
//   · 기본 책상(책 없음) — 받침대는 가운데 뒤, 달력은 앞 왼쪽, 필기구 정리함은 앞 오른쪽.
//   · 테마 책상(가운데에 책) — 달력은 책 왼쪽, 받침대는 앞 왼쪽, 필기구 정리함은 앞 오른쪽(그려진 책을 가리지 않게).
// 책상 그림을 바꾸면 이 숫자도 다시 재세요 — tests/unit/plazaArtFit.test.mjs가 소품 바닥이 윗면 위에 있는지 ·
// 그려진 책을 가리지 않는지 · 소품끼리 가리지 않는지를 그림과 직접 견줍니다.
const THEME_DESK_TOP = Object.freeze({
  "desk-calendar": Object.freeze({ x: 117, y: 640, width: 24 }),
  bookstand: Object.freeze({ x: 127, y: 676, width: 52 }),
  "pencil-caddy": Object.freeze({ x: 194, y: 676, width: 24 }),
});
export const HIDEOUT_TABLETOP = Object.freeze({
  "desk-basic": Object.freeze({
    bookstand: Object.freeze({ x: 166, y: 640, width: 60 }),
    "desk-calendar": Object.freeze({ x: 112, y: 676, width: 26 }),
    "pencil-caddy": Object.freeze({ x: 196, y: 678, width: 26 }),
  }),
  "desk-forest": THEME_DESK_TOP,
  "desk-starlight": THEME_DESK_TOP,
  "desk-coastal": THEME_DESK_TOP,
  // 탐험 책상은 그려진 책이 윗면 앞까지 닿아(앞쪽 띠가 없음) 소품을 조금 작게 둡니다.
  "desk-explorer": Object.freeze({
    "desk-calendar": Object.freeze({ x: 125, y: 632, width: 20 }),
    bookstand: Object.freeze({ x: 127, y: 669, width: 48 }),
    "pencil-caddy": Object.freeze({ x: 200, y: 669, width: 22 }),
  }),
});
// 책상(z 890)보다 위, 책상 앞에 선 캐릭터(z 953 이상 — 걷는 길이 책상 앞 y 853부터)보다 아래.
// 그 안에서는 앞에 놓인(바닥이 아래인) 소품이 뒤의 소품을 가립니다.
const tabletopZ = (y) => 900 + Math.round((y - 600) / 2);

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
  const panel = PLAQUE_PANELS[prop?.theme] ?? PLAQUE_PANELS.forest;
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

export function hideoutSceneProps(layout) {
  const selected = plain(layout) ? layout : HIDEOUT_DEFAULT_LAYOUT;
  const deskItem = BY_ID.get(selected.desk);
  const tabletop = HIDEOUT_TABLETOP[deskItem?.slot === "desk" ? deskItem.id : "desk-basic"] ?? HIDEOUT_TABLETOP["desk-basic"];
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
    const position = { ...HIDEOUT_CATALOG_DATA.slots[slot.id], ...(TABLE.has(slot.id) ? tabletop[slot.id] : null) };
    if (slot.id === "lamp") position.width = Math.min(120, 280 * entry.width / entry.height);
    if (position.support) position.y = surfaces[position.support] + 0.5;
    const height = position.width * entry.height / entry.width;
    if (position.top !== undefined) position.y = position.top + height;
    let z = 100 + position.y;
    if (WALL.has(slot.id)) z = 5;
    if (slot.id === "garland") z = 10;
    if (slot.id === "rug") z = 0;
    if (position.support) z = 20;
    if (TABLE.has(slot.id)) z = tabletopZ(position.y);
    props.push({ ...entry, ...position, id: entry.id, itemId: entry.id, category: slot.id, height, z, contactShadow: CONTACT.has(slot.id) });
  }
  return [...props, ...ledges];
}
