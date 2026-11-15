// 대문(첫 화면)의 활동 장면 — 목록(lib/landingScenes.js)과 그림 파일(public/landing/)이 맞는가
// 그림을 다시 구우면(scripts/prepare-landing-art.mjs) 크기가 바뀔 수 있습니다. 목록의 width · height는 그림이 오기 전에
// 칸의 비율을 잡는 값이라 그림과 어긋나면 화면이 한 번 튑니다 — 어긋나면 목록을 그림에 맞추세요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { LANDING_SCENES, LANDING_SCENE_SIZES, LANDING_SCENE_WIDTHS, landingSceneImage } from "../../lib/landingScenes.js";

const pub = (src) => path.join(path.resolve("public"), src.replace(/^\//, ""));

test("장면 셋 — 책 광장 · 교실 · 개인 아지트(2 · 3 · 4분면 차례), 이름은 문서의 낱말", () => {
  assert.deepEqual(LANDING_SCENES.map((s) => s.key), ["plaza", "classroom", "hideout"]);
  assert.deepEqual(LANDING_SCENES.map((s) => s.name), ["책 광장", "교실", "개인 아지트"]);
  for (const scene of LANDING_SCENES) {
    assert.ok(scene.desc && scene.alt, `${scene.key} — 설명 · 대체 글이 비어 있음`);
    assert.doesNotMatch(`${scene.name} ${scene.desc} ${scene.alt}`, /독서 광장/, "옛 이름(독서 광장)");
  }
});

test("그림 두 벌이 있고, 큰 그림의 크기가 목록의 width · height와 같고, 작은 그림도 같은 비율", async () => {
  for (const scene of LANDING_SCENES) {
    const { src, srcSet } = landingSceneImage(scene.key);
    const small = `/landing/${scene.key}-800.webp`;
    assert.ok(srcSet.includes(`${small} 800w`) && srcSet.includes(`${src} 1440w`), srcSet);
    for (const file of [src, small]) assert.ok(existsSync(pub(file)), `${file} 없음`);
    const big = await sharp(pub(src)).metadata();
    const little = await sharp(pub(small)).metadata();
    assert.deepEqual([big.width, big.height], [scene.width, scene.height], `${scene.key} 큰 그림 ${big.width}×${big.height}`);
    assert.deepEqual([big.width, little.width], [LANDING_SCENE_WIDTHS[1], LANDING_SCENE_WIDTHS[0]]);
    assert.ok(Math.abs(little.height - (scene.height * little.width) / scene.width) <= 1, `${scene.key} 작은 그림 비율 ${little.width}×${little.height}`);
    // 대문에서 늘 내려받는 그림이라 가볍게 — 큰 그림 200KiB · 작은 그림 90KiB 안(지금 약 160 · 70KiB가 가장 큼)
    assert.ok(statSync(pub(src)).size <= 200 * 1024, `${src} ${Math.round(statSync(pub(src)).size / 1024)}KiB`);
    assert.ok(statSync(pub(small)).size <= 90 * 1024, `${small} ${Math.round(statSync(pub(small)).size / 1024)}KiB`);
  }
});

test("넷으로 나누는 조건 — srcset의 sizes와 CSS의 @media가 같다", () => {
  const css = readFileSync(path.resolve("app/styles/01-base-landing-footer.css"), "utf8");
  const query = LANDING_SCENE_SIZES.replace(/\s+50vw,\s*100vw$/, "");
  assert.equal(query, "(min-width: 900px) and (min-aspect-ratio: 5/4)");
  assert.ok(css.includes(`@media ${query} {`), "CSS에 같은 @media가 없음");
  assert.match(css, /grid-template-areas:\s*"plaza main"\s*"classroom hideout";/, "2분면 광장 · 1분면 대문 · 3분면 교실 · 4분면 아지트");
});
