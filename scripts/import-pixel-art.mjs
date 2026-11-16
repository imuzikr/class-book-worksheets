// =============================================================
// 도트 그림 묶음(1번 스타일)을 앱에 넣기 — public/reading-hideout · public/reading-plaza
// -------------------------------------------------------------
//   node scripts/import-pixel-art.mjs <풀어 둔 도트 묶음 폴더> [<덧씌울 묶음 폴더> …]
//   (2026년 11월: node scripts/import-pixel-art.mjs <도트 묶음> <넓은 러그 묶음> <숫자 없는 벽시계 묶음>)
//
// 선생님이 주신 묶음(bookbom-pixel-style1 — 두 ZIP을 한 폴더에 풀면 build/png-masters/ 아래에 PNG 원본)을
// **같은 이름 · 같은 크기의 WebP**로 구워 public/에 넣습니다. 좌표(lib/readingPlazaMap.js · lib/readingHideoutCatalog.js)는
// 그 크기에 맞춰 있으므로 크기가 지금 파일과 다르면 아무것도 쓰지 않고 멈춥니다.
//   · 불투명한 배경(광장 둘 · 교실 · 아지트): 품질 88 · smartSubsample. 묶음의 앱용 WebP는 무손실이라 광장 한 장이
//     1.5MB(예전 그림의 6배)였습니다 — 반 전체가 한꺼번에 들어오는 자리라 줄였고, 3배로 키워 견줘도 구별되지 않습니다.
//   · 투명 그림(아지트 소품 120 · 기본 가구 7 · 빈 선반 4 · 교실 소품): 같은 품질 + 알파는 무손실(alphaQuality 100).
//     테두리의 투명도가 원본 그대로라, 쉬는 펫이 방석 안에 드는지 보는 시험이 원본과 같은 결과를 냅니다.
//   · 덧씌울 묶음 — 처음 묶음의 몇 장만 다시 그려 보내 준 것(같은 build/png-masters/ 구조). 뒤에 적은 묶음이 앞의 것을
//     덮고, 처음 묶음에 없는 그림은 받지 않습니다(이름이 틀렸을 수 있어 멈춤). 지금까지 둘입니다:
//       넓은 러그(bookbom-classroom-wide-rug) — 처음 묶음의 러그는 폭이 좁아 학생 · 펫이 서는 자리(책상 옆 ±72 · ±70)가 러그 밖.
//       숫자 없는 벽시계(bookbom-numberless-wall-clocks) — 아지트 꾸미기 시계 4종. 처음 묶음의 시계는 굵은 눈금이 로마 숫자 Ⅰ처럼
//       보였습니다. 교실 벽의 빈 시계판은 이 시계판으로 scripts/prepare-classroom-clock.mjs가 따로 만듭니다.
// 2026년 11월 — 아지트의 작은 소품 여섯(필기구 정리함 · 표지 전시대 · 펫 물그릇 · 모래시계 · 탁상 달력 · 배지 진열대)은
// 바닥 가구로 바뀌어(scripts/prepare-hideout-furniture.mjs) 묶음의 그 그림은 건너뛰고, 아지트 배경은 구울 때 오른쪽 벽의 문을
// 지웁니다(scripts/hideout-furniture-art.mjs의 removeHideoutDoor — 선생님 요청). 그래서 이 스크립트를 다시 돌려도 문 · 옛 소품이
// 돌아오지 않습니다.
// 끝나면 public/reading-hideout/manifest.json의 파일 목록(크기 · SHA-256)을 새로 씁니다 — 시험이 그 값을 봅니다.
// 펫 성장 그림 · 알은 scripts/prepare-pet-art.mjs로 따로 넣습니다(public/reading-pets).
// 걷는 그림(sprites/) · 쉬는 펫(pets/)은 묶음에서도 예전 파일 그대로라 건드리지 않습니다.
// sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { FLOOR_FURNITURE, RETIRED_ITEM_FOLDERS, WEBP_ALPHA, WEBP_OPAQUE, removeHideoutDoor } from "./hideout-furniture-art.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const HIDEOUT_BACKGROUND = "reading-hideout/background.png";
const retired = (rel) => RETIRED_ITEM_FOLDERS.some((folder) => rel.startsWith(`reading-hideout/items/${folder}/`));
const AREAS = ["reading-hideout", "reading-plaza"];

const [packArg, ...overrideArgs] = process.argv.slice(2);
if (!packArg) {
  console.error("사용법: node scripts/import-pixel-art.mjs <풀어 둔 도트 묶음 폴더> [<덧씌울 묶음 폴더> …]");
  process.exit(1);
}
const masters = path.resolve(packArg, "build", "png-masters");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])));
  return nested.flat();
}

// 덧씌울 그림 — 묶음 안의 자리(reading-plaza/rug.png 같은) → 그 묶음의 원본. 뒤에 적은 묶음이 이깁니다.
const overrides = new Map();
for (const arg of overrideArgs) {
  const root = path.resolve(arg, "build", "png-masters");
  const found = (await walk(root)).filter((f) => f.endsWith(".png")).sort();
  if (!found.length) throw Error(`덧씌울 PNG 원본이 없어요: ${root}`);
  for (const file of found) overrides.set(path.relative(root, file).split(path.sep).join("/"), file);
}

// 1) 무엇을 어디에 — 먼저 모두 확인하고(크기 · 빠진 파일), 하나라도 어긋나면 아무것도 쓰지 않습니다.
const jobs = [];
const skipped = [];
for (const area of AREAS) {
  for (const file of (await walk(path.join(masters, area))).filter((f) => f.endsWith(".png")).sort()) {
    const rel = path.relative(masters, file).split(path.sep).join("/");
    if (retired(rel)) { skipped.push(rel); continue; } // 바닥 가구로 바뀐 옛 소품 — 앱에 그 그림이 없습니다
    const source = overrides.get(rel) ?? file;
    const target = path.join(PUBLIC, rel.replace(/\.png$/, ".webp"));
    const meta = await sharp(source).metadata();
    const now = await sharp(target).metadata().catch(() => null);
    if (!now) throw Error(`지금 앱에 없는 그림이에요(이름을 확인하세요): ${rel}`);
    if (now.width !== meta.width || now.height !== meta.height) {
      throw Error(`${rel}: 크기가 ${meta.width}×${meta.height}인데 지금 그림은 ${now.width}×${now.height}입니다 — 좌표를 다시 재야 합니다`);
    }
    const { isOpaque } = await sharp(source).stats();
    jobs.push({ rel, source, target, opaque: isOpaque });
  }
}
if (!jobs.length) throw Error(`PNG 원본이 없어요: ${masters}`);
const stray = [...overrides.keys()].filter((rel) => !jobs.some((j) => j.rel === rel));
if (stray.length) throw Error(`처음 묶음에 없는 덧씌울 그림이에요(이름 · 자리를 확인하세요): ${stray.join(", ")}`);

// 2) 굽기
let before = 0, after = 0;
for (const job of jobs) {
  before += (await fs.stat(job.target)).size;
  let image = sharp(job.source);
  if (job.rel === HIDEOUT_BACKGROUND) {
    // 아지트 배경 — 굽기 전에 오른쪽 벽의 문을 지웁니다(무손실 원본에서)
    const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    image = sharp(removeHideoutDoor({ data, width: info.width, height: info.height, channels: info.channels }),
      { raw: { width: info.width, height: info.height, channels: info.channels } });
  }
  const webp = job.opaque ? image.removeAlpha().webp(WEBP_OPAQUE) : image.webp(WEBP_ALPHA);
  const bytes = await webp.toBuffer();
  await fs.writeFile(job.target, bytes);
  after += bytes.length;
}

// 3) 아지트 그림 목록 — 파일마다 크기 · SHA-256(시험 tests/unit/readingHideoutPetAssets.test.mjs가 봄)
const manifestPath = path.join(PUBLIC, "reading-hideout", "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const replaced = new Set(jobs.filter((j) => j.rel.startsWith("reading-hideout/")).map((j) => j.rel.slice("reading-hideout/".length).replace(/\.png$/, ".webp")));
const untouched = [];
const files = [];
for (const entry of manifest.files) {
  const bytes = await fs.readFile(path.join(PUBLIC, "reading-hideout", entry.path));
  const furniture = FLOOR_FURNITURE.some((f) => entry.path.startsWith(`items/${f.folder}/`)); // 가구 묶음의 그림 — 이 묶음에는 없음
  if (!replaced.has(entry.path) && !entry.path.startsWith("pets/") && !furniture) untouched.push(entry.path);
  files.push({ path: entry.path, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
}
await fs.writeFile(manifestPath, JSON.stringify({ ...manifest, art: "pixel-style-1", files }, null, 2) + "\n");

const mb = (n) => `${(n / 1048576).toFixed(2)}MB`;
if (skipped.length) console.log(`  바닥 가구로 바뀐 옛 소품 ${skipped.length}장은 건너뜀(scripts/prepare-hideout-furniture.mjs) · 아지트 배경은 문을 지우고 구움`);
console.log(`${jobs.length}장을 구웠습니다 · ${mb(before)} → ${mb(after)}${overrides.size ? ` · 덧씌운 그림 ${overrides.size}장(${[...overrides.keys()].join(", ")})` : ""}`);
for (const area of AREAS) console.log(`  ${area}: ${jobs.filter((j) => j.rel.startsWith(area + "/")).length}장`);
if (untouched.length) console.warn(`  ! 묶음에 없어 예전 그림 그대로인 아지트 파일 ${untouched.length}개: ${untouched.slice(0, 5).join(", ")}…`);
