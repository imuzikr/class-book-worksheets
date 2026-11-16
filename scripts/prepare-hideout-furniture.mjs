// =============================================================
// 아지트 바닥 가구 묶음(2026년 11월 16일)을 앱에 넣기 — public/reading-hideout
// -------------------------------------------------------------
//   node scripts/prepare-hideout-furniture.mjs <풀어 둔 가구 묶음 폴더> [<풀어 둔 도트 묶음 폴더>]
//   (2026년 11월: node scripts/prepare-hideout-furniture.mjs bookbom-hideout-floor-furniture-20261116 bookbom-pixel-style1)
//
// 1) 가구 — 묶음의 테마별 시트 네 장({forest,starlight,explorer,coastal}-sheet.png, 1536×1024 투명 PNG · 3열 × 2행)에서
//    가구 여섯 종씩, 모두 24개를 잘라 items/<가구 폴더>/<테마>.webp로 굽습니다(자리 · 폴더는 scripts/hideout-furniture-art.mjs).
//    · 묶음 안내대로 512px 칸으로 똑같이 자르지 않습니다(칸 경계를 넘는 가구가 있음). 칸 가운데에서 가장 가까운 불투명 점부터
//      이어진 덩어리(알파 128 이상, 8방향)를 통째로 따라가 그 상자를 자릅니다. 시트마다 덩어리가 정확히 여섯이 아니면 멈춥니다.
//    · 덩어리는 불투명(알파 255), 나머지는 모두 투명 — 시트에는 배경을 지운 자리의 옅은 얼룩(알파 1~15)과 바닥의 흐린 그림자가
//      남아 있어 그대로 두면 바닥에 뿌연 테가 섭니다. 바닥 그림자는 화면이 따로 그립니다(hideout.css의 .is-grounded).
//    · 가구 안쪽의 빈틈(지구본 다리 사이 · 나뭇가지 사이)은 투명 그대로 — 바닥이 비쳐 보입니다.
//    · 크기는 시트의 원래 크기(줄이지 않음) — 다른 소품 그림과 같습니다. 카탈로그(lib/readingHideoutCatalog.js)의 width · height는
//      이 크기와 같아야 합니다(tests/unit/readingHideoutPetAssets.test.mjs가 봄) — 끝에 찍는 크기를 옮겨 적으세요.
// 2) 배경 — 도트 묶음 폴더를 주면 build/png-masters/reading-hideout/background.png(무손실 원본)에서 오른쪽 벽의 문을 지우고
//    background.webp로 다시 굽습니다(이미 구운 WebP를 다시 구우면 화질이 한 번 더 깎여 원본에서). 안 주면 배경은 그대로입니다.
// 3) 예전 작은 소품 여섯의 그림(items/<자리>/)을 지우고 그림 목록(manifest.json — 크기 · SHA-256)을 새로 씁니다.
// sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  FLOOR_FURNITURE, FLOOR_FURNITURE_THEMES, RETIRED_ITEM_FOLDERS, WEBP_ALPHA, WEBP_OPAQUE, removeHideoutDoor,
} from "./hideout-furniture-art.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const TARGET = path.join(ROOT, "public", "reading-hideout");
const CELL = 512, PAD = 2, SOLID = 128;

const [packArg, pixelArg] = process.argv.slice(2);
if (!packArg) {
  console.error("사용법: node scripts/prepare-hideout-furniture.mjs <풀어 둔 가구 묶음 폴더> [<풀어 둔 도트 묶음 폴더>]");
  process.exit(1);
}
const pack = path.resolve(packArg);
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// 이어진 불투명 덩어리(8방향) — 칸마다 하나씩 찾되, 시트 전체의 덩어리 수도 셉니다.
function components(data, W, H) {
  const label = new Int32Array(W * H), queue = new Int32Array(W * H), found = [];
  for (let start = 0; start < W * H; start += 1) {
    if (label[start] || data[start * 4 + 3] < SOLID) continue;
    const id = found.length + 1;
    let head = 0, tail = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    queue[tail++] = start; label[start] = id;
    while (head < tail) {
      const p = queue[head++], x = p % W, y = (p - x) / W;
      sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (!label[r] && data[r * 4 + 3] >= SOLID) { label[r] = id; queue[tail++] = r; }
      }
    }
    found.push({ id, size: tail, box: [x0, y0, x1, y1], cell: Math.floor(sy / tail / CELL) * 3 + Math.floor(sx / tail / CELL) });
  }
  return { label, found };
}

// 1) 가구 — 먼저 네 장을 모두 확인하고 잘라 둔 뒤(하나라도 어긋나면 아무것도 쓰지 않음) 굽습니다.
const cuts = [];
const sheets = {};
for (const theme of FLOOR_FURNITURE_THEMES) {
  const file = path.join(pack, `${theme}-sheet.png`);
  const bytes = await fs.readFile(file).catch(() => null);
  if (!bytes) throw Error(`시트가 없어요: ${file}`);
  sheets[theme] = sha(bytes);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  if (W !== CELL * 3 || H !== CELL * 2) throw Error(`${theme}-sheet.png: ${W}×${H} — 1536×1024 시트가 아니에요`);
  const { label, found } = components(data, W, H);
  const big = found.filter((entry) => entry.size >= 50);
  if (big.length !== 6 || new Set(big.map((entry) => entry.cell)).size !== 6) {
    throw Error(`${theme}-sheet.png: 칸마다 가구 하나여야 하는데 덩어리가 ${big.length}개(칸 ${big.map((entry) => entry.cell).join(",")})예요 — 묶음을 확인하세요`);
  }
  for (const furniture of FLOOR_FURNITURE) {
    const part = big.find((entry) => entry.cell === furniture.cell);
    const [x0, y0, x1, y1] = part.box;
    const bx = Math.max(0, x0 - PAD), by = Math.max(0, y0 - PAD);
    const bw = Math.min(W, x1 + PAD + 1) - bx, bh = Math.min(H, y1 + PAD + 1) - by;
    const pixels = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        const s = (by + y) * W + bx + x;
        if (label[s] !== part.id) continue;
        const d = (y * bw + x) * 4;
        pixels[d] = data[s * 4]; pixels[d + 1] = data[s * 4 + 1]; pixels[d + 2] = data[s * 4 + 2]; pixels[d + 3] = 255;
      }
    }
    cuts.push({ ...furniture, theme, width: bw, height: bh, pixels, rel: `items/${furniture.folder}/${theme}.webp` });
  }
}

// 2) 배경(도트 묶음을 줬을 때만)
let background = null;
if (pixelArg) {
  const master = path.resolve(pixelArg, "build", "png-masters", "reading-hideout", "background.png");
  const { data, info } = await sharp(master).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const now = await sharp(path.join(TARGET, "background.webp")).metadata();
  if (now.width !== info.width || now.height !== info.height) throw Error(`배경 크기가 달라요(${info.width}×${info.height} · 지금 ${now.width}×${now.height})`);
  const patched = removeHideoutDoor({ data, width: info.width, height: info.height, channels: info.channels });
  background = await sharp(patched, { raw: { width: info.width, height: info.height, channels: info.channels } }).webp(WEBP_OPAQUE).toBuffer();
}

// 3) 쓰기 — 예전 소품 그림을 지우고 새 가구 · 배경을 넣은 뒤 그림 목록을 새로
for (const folder of RETIRED_ITEM_FOLDERS) await fs.rm(path.join(TARGET, "items", folder), { recursive: true, force: true });
for (const cut of cuts) {
  const bytes = await sharp(cut.pixels, { raw: { width: cut.width, height: cut.height, channels: 4 } }).webp(WEBP_ALPHA).toBuffer();
  await fs.mkdir(path.dirname(path.join(TARGET, cut.rel)), { recursive: true });
  await fs.writeFile(path.join(TARGET, cut.rel), bytes);
  cut.bytes = bytes.length;
  cut.sha256 = sha(bytes);
}
if (background) await fs.writeFile(path.join(TARGET, "background.webp"), background);

const manifestPath = path.join(TARGET, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const ours = new Set([...RETIRED_ITEM_FOLDERS, ...FLOOR_FURNITURE.map((entry) => entry.folder)].map((folder) => `items/${folder}/`));
const files = [];
for (const entry of manifest.files) {
  if ([...ours].some((prefix) => entry.path.startsWith(prefix))) continue;
  if (entry.path === "background.webp" && background) {
    files.push({ path: entry.path, bytes: background.length, sha256: sha(background) });
  } else files.push(entry);
}
for (const cut of cuts) files.push({ path: cut.rel, bytes: cut.bytes, sha256: cut.sha256 });
await fs.writeFile(manifestPath, JSON.stringify({
  ...manifest,
  floorFurniture: { pack: path.basename(pack), designs: cuts.length, sheets },
  ...(background ? { doorRemoved: true } : {}),
  files,
}, null, 2) + "\n");

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(`가구 ${cuts.length}개를 구웠습니다 · 모두 ${kb(cuts.reduce((sum, cut) => sum + cut.bytes, 0))}${background ? ` · 문 없는 배경 ${kb(background.length)}` : " · 배경은 그대로"}`);
for (const furniture of FLOOR_FURNITURE) {
  const row = cuts.filter((cut) => cut.slot === furniture.slot);
  console.log(`  ${furniture.label}(${furniture.slot} → items/${furniture.folder}/): ${row.map((cut) => `${cut.theme} ${cut.width}×${cut.height} ${kb(cut.bytes)}`).join(" · ")}`);
}
