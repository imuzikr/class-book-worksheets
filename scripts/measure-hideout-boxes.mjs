// =============================================================
// 아지트 그림마다 '보이는 상자'를 재어 lib/readingHideoutBoxes.js에 씁니다.
// -------------------------------------------------------------
//   node scripts/measure-hideout-boxes.mjs
//
// 소품 그림에는 투명 여백이 있습니다(위쪽이 그림 높이의 45%까지 빈 그림도 있음). 소품을 옮길 때 '벽 장식끼리 겹치나 ·
// 창문을 가리나 · 포털을 가리나 · 방 밖으로 나가나'를 그림 상자로 재면 빈 여백 때문에 멀쩡한 자리도 막히므로,
// 불투명 점(알파 128 이상)을 모두 담는 상자를 그림 폭 · 높이에 대한 여백 비율 [왼쪽, 위, 오른쪽, 아래]로 적어 둡니다
// (소수 셋째 자리에서 내림 — 상자가 실제보다 조금 넓게). 그림을 바꾸면 다시 돌리세요 — tests/unit/readingHideoutArrange.test.mjs가 견줍니다.
// 대상은 public/reading-hideout/manifest.json의 그림 가운데 배경 · 쉬는 펫을 뺀 것(소품 · 기본 가구 · 빈 선반 · 돌린 가구)입니다.
// =============================================================
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = path.join(ROOT, "public", "reading-hideout");
const OUT = path.join(ROOT, "lib", "readingHideoutBoxes.js");

export async function measureInsets(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (data[(y * W + x) * 4 + 3] < 128) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw Error(`빈 그림이에요: ${file}`);
  const floor3 = (value) => Math.floor(value * 1000) / 1000;
  return [floor3(x0 / W), floor3(y0 / H), floor3((W - 1 - x1) / W), floor3((H - 1 - y1) / H)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await fs.readFile(path.join(DIR, "manifest.json"), "utf8"));
  const rows = [];
  for (const entry of manifest.files) {
    if (!entry.path.endsWith(".webp") || entry.path === "background.webp" || entry.path.startsWith("pets/")) continue;
    rows.push([`/reading-hideout/${entry.path}`, await measureInsets(path.join(DIR, entry.path))]);
  }
  rows.sort(([a], [b]) => a.localeCompare(b));
  const body = rows.map(([src, insets]) => `  ${JSON.stringify(src)}: [${insets.join(", ")}],`).join("\n");
  await fs.writeFile(OUT, `// 아지트 그림마다 투명 여백을 뺀 '보이는 상자' — 그림 폭 · 높이에 대한 여백 비율 [왼쪽, 위, 오른쪽, 아래].
// scripts/measure-hideout-boxes.mjs가 그림에서 재어 쓴 파일입니다(손으로 고치지 마세요 — 그림을 바꾸면 다시 돌림).
// 소품을 옮길 때 벽 장식끼리 겹치는지 · 창문 · 포털을 가리는지 · 방 밖으로 나가는지를 이 상자로 잽니다(lib/readingHideoutArrange.js).
export const HIDEOUT_ART_INSETS = Object.freeze({
${body}
});
`);
  console.log(`보이는 상자 ${rows.length}개를 lib/readingHideoutBoxes.js에 썼습니다`);
}
