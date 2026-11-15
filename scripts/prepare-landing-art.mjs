// =============================================================
// 대문(첫 화면 /)의 활동 그림 세 장 — 체험반에서 찍은 장면을 대문용 WebP로
// -------------------------------------------------------------
//   node scripts/prepare-landing-art.mjs <광장 PNG> <교실 PNG> <아지트 PNG>
//
// 대문은 화면을 넷으로 나눠 2분면(왼쪽 위)에 책 광장, 3분면(왼쪽 아래)에 교실, 4분면(오른쪽 아래)에 개인 아지트의
// 장면을 둡니다(app/page.js · 1분면은 지금까지의 대문을 줄인 것). 장면은 체험반을 띄워 무대만 찍은 PNG입니다 —
// 찍는 법은 public/landing/README.md에 있습니다(이름표 · 머리말 · 단추를 가리고 무대 요소만 찍음).
//   · 그림마다 두 벌 — 큰 화면용 1440px(`이름.webp`)과 폰 · 작은 칸용 800px(`이름-800.webp`). 화면은 srcset으로
//     칸 폭에 맞는 쪽만 내려받습니다(1440 × 900 화면의 한 칸 ≈ 700px이면 800px 쪽 — 세 장 합 약 160KiB).
//   · 아지트는 무대의 둥근 모서리 · 테두리까지 찍혀 가장자리 12px을 걷습니다(1.28배로 찍은 값 — 다른 배율로 찍으면
//     TRIM을 그 배율에 맞춰 고치세요). 광장 · 교실은 지도 그림 그대로(1672 × 941)라 걷을 것이 없습니다.
//   · 품질 80 — 도트 그림이 뭉개지지 않는 선에서 가장 가볍게(84와 눈으로 차이가 없고 20%쯤 가벼움 · 실측).
// sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import { existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.join(ROOT, "public", "landing");
const SCENES = [
  { name: "plaza", trim: 0 },
  { name: "classroom", trim: 0 },
  { name: "hideout", trim: 12 },
];
const WIDTHS = [{ width: 1440, suffix: "" }, { width: 800, suffix: "-800" }];
const QUALITY = 80;

const files = process.argv.slice(2);
if (files.length !== SCENES.length || files.some((file) => !existsSync(file))) {
  console.error("사용법: node scripts/prepare-landing-art.mjs <광장 PNG> <교실 PNG> <아지트 PNG>");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

for (const [i, scene] of SCENES.entries()) {
  const meta = await sharp(files[i]).metadata();
  const box = { left: scene.trim, top: scene.trim, width: meta.width - scene.trim * 2, height: meta.height - scene.trim * 2 };
  for (const { width, suffix } of WIDTHS) {
    const file = path.join(OUT, `${scene.name}${suffix}.webp`);
    const info = await sharp(files[i]).extract(box).resize({ width }).webp({ quality: QUALITY, effort: 6 }).toFile(file);
    console.log(`${path.relative(ROOT, file)} — ${info.width} × ${info.height} · ${Math.round(statSync(file).size / 1024)}KiB`);
  }
}
