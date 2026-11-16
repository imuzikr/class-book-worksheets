// =============================================================
// 아지트 바닥 가구(2026년 11월 16일 묶음)와 문 없는 배경 — 두 스크립트가 함께 쓰는 값
// -------------------------------------------------------------
//   scripts/prepare-hideout-furniture.mjs — 가구 시트를 잘라 넣고, 배경의 문을 지웁니다(이 묶음을 넣을 때).
//   scripts/import-pixel-art.mjs          — 도트 묶음을 다시 구울 때도 문을 지우고, 바꾼 소품 자리는 건너뜁니다.
// 선생님 요청: 작고 눈에 잘 안 들어오던 소품 여섯을 큰 바닥 가구로 바꾸고(레벨 · 네 테마는 그대로), 아지트 안에서
// 보이던 오른쪽 벽의 문을 걷습니다 — 나가는 길은 포털과 '광장으로' 단추입니다.
// 저장된 방(users/{uid}/reading/hideout)은 자리 이름 · 소품 id로 짚으므로 자리 이름(slot)은 예전 그대로 둡니다
// (예: 'pencil-caddy' 자리에 이제 1인 독서 소파가 섭니다 — 이미 그 소품을 고른 학생의 방도 그대로 새 가구로 보임).
// =============================================================

// 시트 한 장 = 3열 × 2행(칸 512px). cell은 왼쪽 위부터 0 · 1 · 2 / 3 · 4 · 5.
export const FLOOR_FURNITURE = Object.freeze([
  { cell: 0, slot: "pencil-caddy", folder: "reading-chair", label: "1인 독서 소파" },
  { cell: 1, slot: "cover-display", folder: "big-tree", label: "큰 나무 화분" },
  { cell: 2, slot: "pet-water", folder: "reading-tent", label: "독서 텐트" },
  { cell: 3, slot: "hourglass", folder: "globe-stand", label: "지구본 스탠드" },
  { cell: 4, slot: "desk-calendar", folder: "reading-bed", label: "독서 침대" },
  { cell: 5, slot: "badge-display", folder: "aquarium", label: "스탠드 어항" },
].map((entry) => Object.freeze(entry)));
export const FLOOR_FURNITURE_THEMES = Object.freeze(["forest", "starlight", "explorer", "coastal"]);
// 예전 작은 소품의 그림 폴더(public/reading-hideout/items/<자리>) — 새 가구로 바뀌어 앱에 없습니다.
export const RETIRED_ITEM_FOLDERS = Object.freeze(FLOOR_FURNITURE.map((entry) => entry.slot));

// WebP 굽는 값 — 도트 그림을 넣을 때와 같게(품질 88 · 투명 그림은 알파 무손실).
export const WEBP_OPAQUE = Object.freeze({ quality: 88, smartSubsample: true, effort: 6 });
export const WEBP_ALPHA = Object.freeze({ quality: 88, alphaQuality: 100, smartSubsample: true, effort: 6 });

// 배경(1536×1024)의 오른쪽 벽 문 — 문틀과 문(x 1330~1486, y 150~536)을 둘레의 벽 · 바닥으로 채웁니다.
//   · 뒷벽 · 징두리 판(y < 488): 160px 왼쪽 그대로 — 징두리 판의 세로 줄 간격이 40px이라 네 칸을 건너면 줄이 맞습니다.
//   · 징두리 아래 띠 · 바닥(y ≥ 488): 문 바로 왼쪽 한 줄(x 1327)을 가로로 늘립니다 — 바닥 널이 가로줄뿐이라 이음매가 없습니다.
//   · 방 모서리(x ≥ 1477): 문 위(y 140)의 모서리 줄을 아래로 잇고, 오른쪽 징두리 높이부터(y ≥ 385)는 왼쪽 모서리를 거울로.
// 채울 때는 늘 문 밖(원래 그림)에서만 가져옵니다. 문이 그 자리에 없으면(이미 지웠거나 다른 그림) 아무것도 바꾸지 않고 멈춥니다 —
// 배경 그림을 바꾸면 이 자리를 다시 재세요.
export const HIDEOUT_DOOR = Object.freeze({
  x0: 1330, x1: 1486, y0: 150, y1: 536, corner: 1477, floorFrom: 488, wainscotFrom: 385, shift: 160, floorColumn: 1327, cornerRow: 140,
});
// 문짝(주황 나무)의 점 다섯 — 이 점들이 모두 나무색이면 문이 있는 것입니다.
const DOOR_WOOD = [[1375, 300], [1410, 260], [1440, 330], [1395, 460], [1420, 480]];
const woodAt = (data, width, channels, [x, y]) => {
  const i = (y * width + x) * channels;
  return data[i] > 200 && data[i + 1] > 110 && data[i + 1] < 175 && data[i + 2] < 110;
};
export const hideoutDoorPresent = ({ data, width, channels }) => DOOR_WOOD.every((point) => woodAt(data, width, channels, point));

export function removeHideoutDoor({ data, width, height, channels }) {
  if (width !== 1536 || height !== 1024) throw Error(`아지트 배경이 1536×1024가 아니에요(${width}×${height}) — 문 자리를 다시 재세요`);
  if (!hideoutDoorPresent({ data, width, channels })) throw Error("아지트 배경의 문 자리에 문이 없어요 — 이미 지운 그림이거나 다른 그림입니다(scripts/hideout-furniture-art.mjs의 자리를 확인하세요)");
  const d = HIDEOUT_DOOR, out = Buffer.from(data);
  for (let y = d.y0; y <= d.y1; y += 1) {
    for (let x = d.x0; x <= d.x1; x += 1) {
      let sx = x, sy = y;
      if (x < d.corner) sx = y >= d.floorFrom ? d.floorColumn : x - d.shift;
      else if (y < d.wainscotFrom) sy = d.cornerRow;
      else sx = width - 1 - x;
      const from = (sy * width + sx) * channels, to = (y * width + x) * channels;
      for (let c = 0; c < channels; c += 1) out[to + c] = data[from + c];
    }
  }
  return out;
}
