// =============================================================
// 독서 펫 그림을 앱에 넣을 모양으로 다듬기 — public/reading-pets/
// -------------------------------------------------------------
//   node scripts/prepare-pet-art.mjs egg <알 그림>
//   node scripts/prepare-pet-art.mjs <종 열쇠> <2단계 그림> <3단계> … <10단계>   (아홉 장, 단계 차례대로)
//
// 선생님이 주시는 원본은 투명 바탕의 정사각 그림(1024px)입니다. 그대로 쓰지 않고
//   · 안쪽 투명도 250 이상은 완전히 불투명하게(255) — 원본은 안쪽이 252~253이라 아주 조금 비칩니다.
//   · 투명도 3 이하의 옅은 점은 완전히 투명하게(0) — 눈에는 안 보이지만 독서 맵 · 순위표의
//     그림자(drop-shadow)에 옅게 비치고 파일만 키웁니다.
//   · 두 크기로 줄여 WebP(품질 85)로 — 640px `{이름}.webp`(자세히 보기 132px · 축하 폭죽 180px)와
//     160px `{이름}-160.webp`(카드 60px · 순위표 · 독서 맵처럼 작게 여러 장 뜨는 자리).
//     어느 것을 받을지는 브라우저가 자리 크기로 고릅니다(PetFigure의 srcSet — lib/readingPet.js의 petImageSrcSet).
// 이름: 알은 egg, 종은 {열쇠}-02 … {열쇠}-10(1단계는 모두가 같이 쓰는 비밀 알 — 종마다 그리지 않음).
// 다 넣은 뒤 lib/readingPet.js의 PET_ART_READY에 종 열쇠(또는 "egg")를 더해야 화면에 나옵니다.
// sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import { existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

// lib/의 셈을 그대로 씁니다(종 열쇠 · 단계 수). package.json에 "type"이 없어 Node가 'ES 모듈로 다시 읽는다'는
// 경고를 한 줄 내는데, 이 스크립트에는 뜻이 없어 그 경고만 끄고 읽습니다.
process.removeAllListeners("warning");
const { PET_SPECIES_KEYS, PET_STAGE_MAX, PET_HATCH_STAGE } = await import("../lib/readingPet.js");

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.join(ROOT, "public", "reading-pets");
const SIZES = [[640, ""], [160, "-160"]];
const OPAQUE_FROM = 250;
const CLEAR_TO = 3;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [key, ...files] = process.argv.slice(2);
if (!key) fail("사용법: node scripts/prepare-pet-art.mjs egg <알 그림> | <종 열쇠> <2단계 그림> … <10단계 그림>");
const stages = PET_STAGE_MAX - PET_HATCH_STAGE + 1; // 2~10단계 — 아홉 장
let names;
if (key === "egg") {
  if (files.length !== 1) fail("알 그림은 한 장이어야 합니다.");
  names = ["egg"];
} else {
  if (!PET_SPECIES_KEYS.includes(key)) fail(`모르는 종 열쇠예요: ${key} (가능: ${PET_SPECIES_KEYS.join(", ")})`);
  if (files.length !== stages) fail(`${key}: 2~10단계 그림 ${stages}장이 단계 차례대로 있어야 합니다(지금 ${files.length}장).`);
  names = files.map((_, i) => `${key}-${String(i + PET_HATCH_STAGE).padStart(2, "0")}`);
}
for (const file of files) if (!existsSync(file)) fail(`그림 파일이 없어요: ${file}`);
mkdirSync(OUT, { recursive: true });

for (let i = 0; i < files.length; i += 1) {
  const { data, info } = await sharp(files[i]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== info.height) console.warn(`  ! 정사각이 아니에요(${info.width}×${info.height}) — 가운데에 맞춰 여백을 둡니다: ${files[i]}`);
  for (let p = 3; p < data.length; p += 4) {
    if (data[p] >= OPAQUE_FROM) data[p] = 255;
    else if (data[p] <= CLEAR_TO) { data[p] = 0; data[p - 1] = 0; data[p - 2] = 0; data[p - 3] = 0; }
  }
  const sizes = [];
  for (const [size, suffix] of SIZES) {
    const out = path.join(OUT, `${names[i]}${suffix}.webp`);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
      .webp({ quality: 85, alphaQuality: 100, effort: 6 })
      .toFile(out);
    sizes.push(`${size}px ${(statSync(out).size / 1024).toFixed(1)}KB`);
  }
  console.log(`${names[i]} ← ${path.basename(files[i])} · ${sizes.join(" · ")}`);
}
console.log(`\n${OUT}에 넣었습니다. lib/readingPet.js의 PET_ART_READY에 이 열쇠를 더하세요(이미 있으면 그대로): "${key}"`);
