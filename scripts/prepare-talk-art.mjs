// =============================================================
// 광장 대화의 그림 — 선생님이 주신 도트 대화 묶음을 화면에 쓸 크기로
// -------------------------------------------------------------
//   node scripts/prepare-talk-art.mjs <풀어 둔 묶음 폴더(reading-conversation-assets-v1)>
//   (2026년 11월: asset-downloads-conversation-v1 브랜치의 reading-conversation-assets-v1.zip)
//
// 묶음의 assets/ 아래 PNG 31장(지도 표시 12 · 창 틀 3 · 단추 바탕 8 · 작은 아이콘 8)을 public/reading-plaza/talk/에
// WebP로 굽습니다. 원본은 표시 크기의 대여섯 배라(말풍선 248px을 34px로 그림) **표시 크기의 두 배**로 줄여 둡니다 —
// 고해상도 화면에서도 또렷하고, 묶음의 앱용 무손실 WebP(약 1.1MB)보다 훨씬 가볍습니다.
//   · 지도 표시 · 아이콘: 표시 폭(아이콘은 긴 변)의 두 배로. 비율은 그대로.
//   · 창 틀 · 단추 바탕(나인슬라이스): 꼭 절반으로 — 묶음의 자르는 선(창 64 · 단추 40)도 절반(32 · 20)이 되고,
//     표시 테두리(창 16px · 단추 10px)는 그대로라 두 배 밀도가 됩니다(plaza-talk.css의 border-image-slice).
// 줄이는 셈은 lanczos3입니다(nearest · mitchell과 견주어 도트 테두리가 가장 고르게 남음 — 2026년 11월 실측).
// 무엇을 어떤 크기로 굽는지는 lib/readingPlazaTalk.js의 TALK_ART 한 곳이고, tests/unit/readingPlazaTalk.test.mjs가
// 구운 파일의 크기를 그 값과 견줍니다. sharp는 next가 함께 설치합니다(따로 설치 없음).
// =============================================================
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

process.removeAllListeners("warning");
const { TALK_ART } = await import("../lib/readingPlazaTalk.js");

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const [bundle] = process.argv.slice(2);
if (!bundle || !existsSync(path.join(bundle, "assets"))) {
  console.error("사용법: node scripts/prepare-talk-art.mjs <풀어 둔 묶음 폴더 — assets/ 가 든 곳>");
  process.exit(1);
}

let total = 0;
for (const art of Object.values(TALK_ART)) {
  const from = path.join(bundle, "assets", art.from);
  if (!existsSync(from)) { console.error(`없는 그림: ${art.from}`); process.exit(1); }
  const out = path.join(ROOT, "public", art.src.replace(/^\//, ""));
  mkdirSync(path.dirname(out), { recursive: true });
  const meta = await sharp(from).metadata();
  // 나인슬라이스는 꼭 절반, 나머지는 표시 크기의 두 배(긴 변 기준)
  const resize = art.slice
    ? { width: Math.round(meta.width / 2), height: Math.round(meta.height / 2), fit: "fill" }
    : meta.width >= meta.height ? { width: art.w * 2 } : { height: art.h * 2 };
  const info = await sharp(from).resize({ ...resize, kernel: "lanczos3" }).webp({ lossless: true, effort: 6 }).toFile(out);
  total += info.size;
  console.log(`${art.src}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)}KiB`);
}
console.log(`모두 ${Object.keys(TALK_ART).length}장 · ${(total / 1024).toFixed(0)}KiB`);
