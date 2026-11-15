// 대문(첫 화면)의 활동 장면 — 목록(lib/landingScenes.js)과 그림 파일(public/landing/)이 맞는가
// 그림을 다시 구우면(scripts/prepare-landing-art.mjs) 크기가 바뀔 수 있습니다. 목록의 width · height는 그림이 오기 전에
// 칸의 비율을 잡는 값이라 그림과 어긋나면 화면이 한 번 튑니다 — 어긋나면 목록을 그림에 맞추세요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { LANDING_READING, LANDING_SCENES, LANDING_SCENE_SIZES, LANDING_SCENE_WIDTHS, landingSceneImage } from "../../lib/landingScenes.js";

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

test("무대 맨 뒤의 일러스트 — 원본과 800px 두 벌이 같은 비율이고 srcset에 둘 다", async () => {
  const [small, big] = LANDING_READING.srcSet.split(",").map((part) => part.trim().split(/\s+/));
  assert.deepEqual([small[1], big[1]], ["800w", `${LANDING_READING.width}w`]);
  assert.equal(big[0], LANDING_READING.src);
  const bigMeta = await sharp(pub(big[0])).metadata();
  const smallMeta = await sharp(pub(small[0])).metadata();
  assert.deepEqual([bigMeta.width, bigMeta.height], [LANDING_READING.width, LANDING_READING.height]);
  assert.equal(smallMeta.width, 800);
  assert.ok(Math.abs(smallMeta.height - (LANDING_READING.height * 800) / LANDING_READING.width) <= 1, `${smallMeta.width}×${smallMeta.height}`);
  assert.ok(statSync(pub(small[0])).size <= 60 * 1024, `${small[0]} ${Math.round(statSync(pub(small[0])).size / 1024)}KiB`);
  assert.ok(LANDING_READING.alt.length > 10, "대체 글");
});

// 그림을 고르는 조건(sizes)과 화면을 바꾸는 @media가 어긋나면 작은 칸에 큰 그림을(또는 큰 칸에 흐린 그림을) 받습니다.
const conditionsOf = (sizes) => sizes.split(",").map((part) => part.trim()).slice(0, -1).map((part) => part.replace(/\s+\d+vw$/, ""));

test("배치 조건 — 그림의 sizes 조건과 CSS의 @media가 같다(나란히 960px · 무대 한 판 700px)", () => {
  const css = readFileSync(path.resolve("app/styles/01-base-landing-footer.css"), "utf8");
  const scene = conditionsOf(LANDING_SCENE_SIZES);
  assert.deepEqual(scene, ["(min-width: 960px) and (min-aspect-ratio: 5/4)", "(min-width: 700px)"]);
  assert.deepEqual(conditionsOf(LANDING_READING.sizes), scene, "일러스트와 장면이 같은 조건");
  for (const query of scene) assert.ok(css.includes(`@media ${query} {`), `CSS에 '@media ${query}'가 없음`);
});

test("무대 — 사진 넷(일러스트 · 장면 셋)마다 자리(--x · --y · --w)와 기울기가 있다", () => {
  const css = readFileSync(path.resolve("app/styles/01-base-landing-footer.css"), "utf8");
  for (const key of ["reading", ...LANDING_SCENES.map((s) => s.key)]) {
    assert.match(css, new RegExp(`\\.lp-shot--${key}\\s*\\{[^}]*--x:[^}]*--y:[^}]*--w:[^}]*--tilt:`), `${key}의 자리`);
  }
  // 움직임 줄이기 기기에서는 들어오기 · 둥실 · 포털의 빛을 멈춘다
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  for (const name of [".lp-shot-in", ".lp-shot-bob", ".lp-portal-swirl"]) assert.ok(reduced.includes(name), `움직임 줄이기에 ${name}`);
});
