// =============================================================
// 아지트 '돌린 가구' 묶음(2026년 11월 16일)을 앱에 넣기 — public/reading-hideout
// -------------------------------------------------------------
//   node scripts/prepare-hideout-turn.mjs <풀어 둔 묶음 폴더>
//   (2026년 11월: 선생님이 주신 hideout-turn-sheets.zip — 시트 여섯 장)
//
// 선생님 요청(아지트 2단계 — 소품을 옮기고 방향을 바꾸기): 바닥 가구 여섯 종의 '돌린 모습'을 그림 AI로 받았습니다.
// 시트 한 장 = 가구 한 종, 1536×1024 투명 PNG · 3열 × 2행(칸 512px). 칸 차례는 숲속 · 별빛 · 탐험 / 바닷가 · 기본 · 빈 칸이고,
// 기본형이 없는 종류는 아랫줄 가운데 · 오른쪽이 빈 칸입니다(참고 시트와 같은 차례 — 받는 프롬프트에 적어 보낸 약속).
//   · 책상·의자 — 의자가 책상 앞(보는 사람 쪽)에 놓여 등받이가 보이는 모습
//   · 독서 침대 — 머리판이 뒤(위)인 세로 모습
//   · 책장 · 1인 독서 소파 · 독서 보물함 · 스탠드 어항 — 앞면이 오른쪽을 보는 옆모습(왼쪽을 보는 모습은 앱이 좌우로 뒤집음)
//
// 크기: 참고 시트는 앞모습 그림을 한 배율로 줄여 칸에 넣었습니다(그 종류의 앞모습 가운데 가장 긴 변이 448px이 되게,
// 크면 줄이기만 — refScale). 그림 AI는 그 참고 그림과 같은 키로 그렸으므로, 돌린 그림의 '앞모습 단위' 크기는 시트의 픽셀 ÷ refScale입니다.
// 화면은 앞모습과 같은 배율(자리 폭 ÷ 앞모습 그림 폭)을 이 단위에 곱해 그립니다(lib/readingHideoutTurn.js).
//
// 자르기: 칸 안의 불투명 점(알파 128 이상)을 모두 담는 상자로 자르고(칸마다 가구 하나 — 칸 경계에 닿으면 멈춤),
// 작은 얼룩(이어진 점 50개 아래)은 걷습니다. 알파는 0 또는 255로 — 시트에 반투명 점이 없음을 확인했습니다.
// 크기는 시트의 원래 크기(줄이지 않음). 끝에 찍는 크기를 lib/readingHideoutTurn.js에 옮겨 적습니다
// (tests/unit/readingHideoutTurn.test.mjs가 그림 크기와 견줌).
// sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { WEBP_ALPHA } from "./hideout-furniture-art.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TARGET = path.join(ROOT, "public", "reading-hideout");
const CELL = 512, SOLID = 128, SPECK = 50, REF_SIDE = 448;
const THEMES = ["forest", "starlight", "explorer", "coastal"];
// slot — 카탈로그의 자리 이름(저장된 방이 쓰는 이름 · 예전 그대로), folder — items/ 아래 그림 폴더, basic — 기본형 그림 이름
const TURN_SHEETS = [
  { file: "desk-turn.png", slot: "desk", folder: "desk", basic: "desk-basic", label: "책상·의자" },
  { file: "shelf-turn.png", slot: "shelf", folder: "shelf", basic: "shelf-low", label: "책장" },
  { file: "reading-chair-turn.png", slot: "pencil-caddy", folder: "reading-chair", label: "1인 독서 소파" },
  { file: "reading-bed-turn.png", slot: "desk-calendar", folder: "reading-bed", label: "독서 침대" },
  { file: "chest-turn.png", slot: "chest", folder: "chest", label: "독서 보물함" },
  { file: "aquarium-turn.png", slot: "badge-display", folder: "aquarium", label: "스탠드 어항" },
];

const [packArg] = process.argv.slice(2);
if (!packArg) {
  console.error("사용법: node scripts/prepare-hideout-turn.mjs <풀어 둔 돌린 가구 묶음 폴더>");
  process.exit(1);
}
const pack = path.resolve(packArg);
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// 이어진 불투명 덩어리(8방향) — 칸 하나 안에서만 셉니다.
function cellComponents(data, W, cx, cy) {
  const seen = new Uint8Array(CELL * CELL), found = [];
  const solid = (x, y) => data[((cy + y) * W + cx + x) * 4 + 3] >= SOLID;
  for (let start = 0; start < CELL * CELL; start += 1) {
    const sx = start % CELL, sy = (start - sx) / CELL;
    if (seen[start] || !solid(sx, sy)) continue;
    const queue = [start], points = [];
    seen[start] = 1;
    while (queue.length) {
      const p = queue.pop(), x = p % CELL, y = (p - x) / CELL;
      points.push(p);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue;
        const q = ny * CELL + nx;
        if (!seen[q] && solid(nx, ny)) { seen[q] = 1; queue.push(q); }
      }
    }
    found.push(points);
  }
  return found;
}

// 참고 시트를 만들 때와 같은 배율 — 그 종류의 앞모습(기본형 포함) 가운데 가장 긴 변을 448px로(크면 줄이기만).
async function refScaleOf(sheet) {
  const sources = [...THEMES.map((theme) => `items/${sheet.folder}/${theme}.webp`), ...(sheet.basic ? [`${sheet.basic}.webp`] : [])];
  let longest = 0;
  for (const rel of sources) {
    const meta = await sharp(path.join(TARGET, rel)).metadata();
    longest = Math.max(longest, meta.width, meta.height);
  }
  return Math.min(1, REF_SIDE / longest);
}

const cuts = [], sheets = {}, scales = {};
for (const sheet of TURN_SHEETS) {
  const file = path.join(pack, sheet.file);
  const bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) throw Error(`시트가 없어요: ${file}`);
  sheets[sheet.file] = sha(bytes);
  scales[sheet.slot] = await refScaleOf(sheet);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  if (W !== CELL * 3 || H !== CELL * 2) throw Error(`${sheet.file}: ${W}×${H} — 1536×1024 시트가 아니에요`);
  const filled = [...THEMES, ...(sheet.basic ? ["basic"] : [])];
  for (let cell = 0; cell < 6; cell += 1) {
    const cx = (cell % 3) * CELL, cy = Math.floor(cell / 3) * CELL;
    const parts = cellComponents(data, W, cx, cy).filter((points) => points.length >= SPECK);
    const theme = filled[cell];
    if (!theme) {
      if (parts.length) throw Error(`${sheet.file}: 비어 있어야 할 칸 ${cell + 1}에 그림이 있어요 — 묶음을 확인하세요`);
      continue;
    }
    if (!parts.length) throw Error(`${sheet.file}: 칸 ${cell + 1}(${theme})이 비어 있어요 — 묶음을 확인하세요`);
    let x0 = CELL, y0 = CELL, x1 = -1, y1 = -1;
    for (const points of parts) for (const p of points) {
      const x = p % CELL, y = (p - x) / CELL;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x0 === 0 || y0 === 0 || x1 === CELL - 1 || y1 === CELL - 1) throw Error(`${sheet.file}: 칸 ${cell + 1}(${theme})의 그림이 칸 경계에 닿아요 — 묶음을 확인하세요`);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pixels = Buffer.alloc(bw * bh * 4);
    for (const points of parts) for (const p of points) {
      const x = p % CELL, y = (p - x) / CELL;
      const s = ((cy + y) * W + cx + x) * 4, d = ((y - y0) * bw + (x - x0)) * 4;
      pixels[d] = data[s]; pixels[d + 1] = data[s + 1]; pixels[d + 2] = data[s + 2]; pixels[d + 3] = 255;
    }
    const rel = theme === "basic" ? `${sheet.basic}-turn.webp` : `items/${sheet.folder}/${theme}-turn.webp`;
    cuts.push({ ...sheet, theme, rel, width: bw, height: bh, pixels, parts: parts.length });
  }
}

for (const cut of cuts) {
  const bytes = await sharp(cut.pixels, { raw: { width: cut.width, height: cut.height, channels: 4 } }).webp(WEBP_ALPHA).toBuffer();
  await fs.mkdir(path.dirname(path.join(TARGET, cut.rel)), { recursive: true });
  await fs.writeFile(path.join(TARGET, cut.rel), bytes);
  cut.bytes = bytes.length;
  cut.sha256 = sha(bytes);
}

const manifestPath = path.join(TARGET, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const files = manifest.files.filter((entry) => !entry.path.endsWith("-turn.webp"));
for (const cut of cuts) files.push({ path: cut.rel, bytes: cut.bytes, sha256: cut.sha256 });
await fs.writeFile(manifestPath, JSON.stringify({
  ...manifest,
  turnArt: { pack: path.basename(pack), designs: cuts.length, sheets },
  files,
}, null, 2) + "\n");

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(`돌린 가구 ${cuts.length}개를 구웠습니다 · 모두 ${kb(cuts.reduce((sum, cut) => sum + cut.bytes, 0))}`);
for (const sheet of TURN_SHEETS) {
  const scale = scales[sheet.slot];
  console.log(`  ${sheet.label}(${sheet.slot}) refScale ${Math.round(scale * 10000) / 10000}`);
  for (const cut of cuts.filter((entry) => entry.slot === sheet.slot)) {
    console.log(`    ${cut.rel}: ${cut.width}×${cut.height}${cut.parts > 1 ? ` (덩어리 ${cut.parts})` : ""} · 앞모습 단위 ${Math.round(cut.width / scale)}×${Math.round(cut.height / scale)} · ${kb(cut.bytes)}`);
  }
}
