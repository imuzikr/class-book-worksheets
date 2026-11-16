// 돌린 가구 — 아지트 2단계(소품의 자리 · 방향 바꾸기)에서 쓰는 '돌린 모습' 그림입니다(2026년 11월 · 선생님이 그림 AI로 받아
// 주신 묶음, scripts/prepare-hideout-turn.mjs가 시트 여섯 장에서 잘라 구움).
//   · side — 앞면이 오른쪽을 보는 옆모습(책장 · 1인 독서 소파 · 독서 보물함 · 스탠드 어항). 왼쪽을 보는 모습은 좌우 뒤집기로.
//   · chair-front — 의자가 책상 앞(보는 사람 쪽)에 놓여 등받이가 보이는 책상·의자.
//   · lengthwise — 머리판이 뒤(위)인 세로 독서 침대.
// 그림 파일은 시트에서 자른 크기 그대로(width × height)입니다. 참고 시트가 앞모습 그림을 scale만큼 줄여 보여 줬고 그림 AI가 그
// 크기에 맞춰 그렸으므로, 픽셀 ÷ scale이 앞모습 그림과 같은 단위입니다. 화면은 앞모습과 같은 배율(자리 폭 ÷ 앞모습 그림 폭)을
// 그 단위에 곱해 그립니다(lib/readingHideout.js의 hideoutSceneProps). 그림을 다시 넣으면 width × height를 스크립트가 찍은 값으로
// 고치세요 — tests/unit/readingHideoutArrange.test.mjs가 그림 파일과 견줍니다.
const LOOK = Object.freeze({
  desk: "chair-front", shelf: "side", "pencil-caddy": "side", "desk-calendar": "lengthwise", chest: "side", "badge-display": "side",
});
// 참고 시트 배율 — 그 종류의 앞모습(기본형 포함) 가운데 가장 긴 변을 448px로(크면 줄이기만). 스크립트와 같은 셈.
const SCALE = Object.freeze({
  desk: 448 / 640, shelf: 448 / 640, "pencil-caddy": 1, "desk-calendar": 448 / 574, chest: 1, "badge-display": 448 / 466,
});
const FOLDER = Object.freeze({
  desk: "desk", shelf: "shelf", "pencil-caddy": "reading-chair", "desk-calendar": "reading-bed", chest: "chest", "badge-display": "aquarium",
});
const BASIC = Object.freeze({ "desk-basic": "desk", "shelf-low": "shelf" });
const SIZE = Object.freeze({
  "desk-forest": [240, 326], "desk-starlight": [241, 326], "desk-explorer": [246, 318], "desk-coastal": [243, 324], "desk-basic": [252, 324],
  "shelf-forest": [185, 399], "shelf-starlight": [174, 376], "shelf-explorer": [178, 392], "shelf-coastal": [164, 375], "shelf-low": [200, 378],
  "pencil-caddy-forest": [299, 431], "pencil-caddy-starlight": [304, 434], "pencil-caddy-explorer": [309, 434], "pencil-caddy-coastal": [300, 433],
  "desk-calendar-forest": [191, 435], "desk-calendar-starlight": [191, 435], "desk-calendar-explorer": [191, 435], "desk-calendar-coastal": [191, 435],
  "chest-forest": [312, 358], "chest-starlight": [325, 371], "chest-explorer": [328, 355], "chest-coastal": [335, 378],
  "badge-display-forest": [183, 437], "badge-display-starlight": [186, 441], "badge-display-explorer": [186, 446], "badge-display-coastal": [183, 440],
});

function artFor(itemId, [width, height]) {
  const slot = BASIC[itemId] ?? itemId.slice(0, itemId.lastIndexOf("-"));
  const theme = itemId.slice(itemId.lastIndexOf("-") + 1);
  const src = BASIC[itemId] ? `/reading-hideout/${itemId}-turn.webp` : `/reading-hideout/items/${FOLDER[slot]}/${theme}-turn.webp`;
  return Object.freeze({ itemId, slot, src, width, height, scale: SCALE[slot], look: LOOK[slot] });
}
export const HIDEOUT_TURN_ART = Object.freeze(Object.fromEntries(Object.entries(SIZE).map(([itemId, size]) => [itemId, artFor(itemId, size)])));
// 돌릴 수 있는 종류(자리 이름 — 저장된 방이 쓰는 예전 이름 그대로)
export const HIDEOUT_TURN_SLOTS = Object.freeze(Object.keys(LOOK));
export const hideoutTurnArt = (itemId) => (typeof itemId === "string" && Object.hasOwn(HIDEOUT_TURN_ART, itemId) ? HIDEOUT_TURN_ART[itemId] : null);
