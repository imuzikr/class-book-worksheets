// =============================================================
// 교실 벽시계의 시계판 — 교실 배경(classroom.webp)의 빈 시계판에 얹는 그림
// -------------------------------------------------------------
//   node scripts/prepare-classroom-clock.mjs <숫자 없는 벽시계 PNG 원본>
//   (2026년 11월: bookbom-numberless-wall-clocks의 build/png-masters/reading-hideout/items/clock/forest.png)
//
// 도트 그림의 교실 배경은 칠판 위 벽시계가 빈 동그라미입니다. 선생님이 주신 숫자 없는 벽시계(아지트 꾸미기 시계 4종 —
// 시계판은 넷 다 같음: 작은 점 12개 · 10시 10분의 두 바늘 · 가운데 금빛 축)에서 **시계판의 점 · 바늘 · 축만** 떠내어
// public/reading-plaza/classroom-clock.webp(교실 시계판 지름의 네 배 — 책상 그림처럼 크게 두고 화면이 줄여 그림)에 넣습니다.
// 화면은 러그 · 책상처럼 배경 위에 따로 얹습니다(components/reading/PlazaClassroom.jsx의 PlazaFurniture · 자리와 지름은
// lib/readingPlazaMap.js의 CLASSROOM_CLOCK). 배경을 고쳐 그리지 않는 까닭 — 도트 묶음을 다시 넣어도(import-pixel-art.mjs)
// 시계가 지워지지 않게.
//   · 시계판 찾기: 그림에서 가장 큰 크림색 덩어리(시계판 — 축의 밝은 반짝임 같은 작은 덩어리는 버림)의 상자로 가운데 ·
//     지름을 잽니다. 어두운 테를 피해 반지름의 93% 안쪽만 씁니다.
//   · 크림 바탕은 투명으로(GIMP의 '색을 알파로'를 **어두워지는 쪽으로만** — 점 · 바늘 · 축은 모두 크림보다 어둡습니다).
//     교실 시계판의 크림이 그대로 비치고, 점 · 바늘 가장자리의 반투명이 그 위에서 원래대로 섞입니다(교실 크림 253·225·186 ≈
//     시계판 크림 252·229·193). 밝아지는 쪽까지 세면 빨강이 255에 가까워 1만 달라도(253·230·194) 3분의 1 불투명이 되어
//     시계판 전체에 옅은 얼룩이 깔립니다(실측 — 파일도 66KB로 커짐).
// 시험 tests/unit/plazaArtFit.test.mjs가 이 그림이 교실 시계판 안에 드는지 · 점 12개가 따로 떨어져 있는지 봅니다.
// sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

// lib/의 값을 그대로 씁니다(시계판 지름). package.json에 "type"이 없어 Node가 'ES 모듈로 다시 읽는다'는 경고를 한 줄 내는데,
// 이 스크립트에는 뜻이 없어 그 경고만 끄고 읽습니다.
process.removeAllListeners("warning");
const { CLASSROOM_CLOCK } = await import("../lib/readingPlazaMap.js");

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.join(ROOT, "public", CLASSROOM_CLOCK.src.replace(/^\//, ""));
const SCALE = 4;        // 교실 시계판 지름의 네 배로 둡니다(책상 · 의자 그림과 같음)
const INNER = 0.93;     // 시계판 반지름의 이만큼 안쪽만(테를 피함)
const MIN_ALPHA = 0.12; // 이보다 옅은 차이는 크림의 얼룩(도트 그림의 미세한 색 차이)으로 보고 버림

const [file] = process.argv.slice(2);
if (!file || !existsSync(file)) {
  console.error("사용법: node scripts/prepare-classroom-clock.mjs <숫자 없는 벽시계 PNG 원본(forest.png 등)>");
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const at = (x, y) => (y * W + x) * 4;
const isCream = (x, y) => {
  const i = at(x, y);
  return data[i + 3] > 200 && data[i] > 225 && data[i + 1] > 200 && data[i + 2] > 160;
};

// 1) 시계판 — 크림색 점을 이어 칠한 덩어리 가운데 가장 큰 것(축의 밝은 반짝임 같은 작은 덩어리는 버림)
const seen = new Uint8Array(W * H);
let best = null;
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    if (seen[y * W + x] || !isCream(x, y)) continue;
    const blob = { x0: x, y0: y, x1: x, y1: y, n: 0, r: 0, g: 0, b: 0 };
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const k = py * W + px;
      if (seen[k] || !isCream(px, py)) continue;
      seen[k] = 1;
      const i = at(px, py);
      blob.n += 1; blob.r += data[i]; blob.g += data[i + 1]; blob.b += data[i + 2];
      if (px < blob.x0) blob.x0 = px; if (px > blob.x1) blob.x1 = px; if (py < blob.y0) blob.y0 = py; if (py > blob.y1) blob.y1 = py;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    if (!best || blob.n > best.n) best = blob;
  }
}
if (!best) throw Error("시계판(크림색)을 찾지 못했어요 — 숫자 없는 벽시계 그림이 맞는지 확인하세요");
const { x0, y0, x1, y1, n } = best;
const [sr, sg, sb] = [best.r, best.g, best.b];
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
const radius = side / 2;
if (side < 80 || Math.abs((x1 - x0) - (y1 - y0)) > side * 0.06) throw Error(`시계판이 동그라미가 아니에요(${x1 - x0 + 1}×${y1 - y0 + 1})`);
const cream = [sr / n, sg / n, sb / n];

// 2) 점 · 바늘 · 축만 남기기 — 크림을 투명으로(색을 알파로)
const S = Math.ceil(side);
const ink = Buffer.alloc(S * S * 4);
const left = cx - S / 2, top = cy - S / 2;
let inked = 0;
for (let y = 0; y < S; y += 1) {
  for (let x = 0; x < S; x += 1) {
    const px = Math.round(left + x), py = Math.round(top + y);
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    if (Math.hypot(px - cx, py - cy) > radius * INNER) continue;
    const i = at(px, py);
    let a = 0;
    for (let c = 0; c < 3; c += 1) a = Math.max(a, (cream[c] - data[i + c]) / cream[c]);
    if (a < MIN_ALPHA) continue;
    a = Math.min(1, a);
    const o = (y * S + x) * 4;
    for (let c = 0; c < 3; c += 1) ink[o + c] = Math.max(0, Math.min(255, Math.round(cream[c] + (data[i + c] - cream[c]) / a)));
    ink[o + 3] = Math.round(a * data[i + 3]);
    inked += 1;
  }
}
if (inked < S * S * 0.01) throw Error("시계판에 점 · 바늘이 없어요");

// 3) 교실 시계판 지름의 네 배로 줄여 무손실 WebP로(투명한 점은 색 값도 0)
const size = CLASSROOM_CLOCK.d * SCALE;
await sharp(ink, { raw: { width: S, height: S, channels: 4 } })
  .resize(size, size, { kernel: "lanczos3" })
  .webp({ lossless: true, exact: false, effort: 6 })
  .toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`시계판 ${x1 - x0 + 1}×${y1 - y0 + 1}px(가운데 ${cx}, ${cy} · 크림 ${cream.map(Math.round).join("·")}) → ${path.relative(ROOT, OUT)} ${meta.width}×${meta.height}`);
