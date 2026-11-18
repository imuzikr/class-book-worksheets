// 아지트 바닥의 원근(2026년 11월 · 선생님 요청) — 세로로 놓은 침대를 방 그림처럼 '아래로 올수록 넓게'(lib/readingHideoutPerspective.js).
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_SCENE, hideoutArtBox, hideoutArtQuad, hideoutSceneProps } from "../../lib/readingHideout.js";
import { hideoutFootprints } from "../../lib/readingHideoutMap.js";
import { hideoutArrangeProblem } from "../../lib/readingHideoutArrange.js";
import {
  HIDEOUT_FLOOR_LOOKS, HIDEOUT_VANISHING_POINT, hideoutFloorPerspective, hideoutPerspectiveCss, hideoutPerspectivePoint, hideoutPerspectiveQuad,
  hideoutPerspectiveSlices, hideoutPerspectiveStyle, hideoutQuadBounds, hideoutQuadHit,
} from "../../lib/readingHideoutPerspective.js";

const LAYOUT = { ...HIDEOUT_DEFAULT_LAYOUT, "desk-calendar": "desk-calendar-forest" };
const bedAt = (x, y, extra = {}) => hideoutSceneProps(LAYOUT, { "desk-calendar": { x, y, turn: true, ...extra } }).find((prop) => prop.category === "desk-calendar");
const near = (a, b, tolerance, message) => assert.ok(Math.abs(a - b) <= tolerance, `${message ?? ""} ${a} ≈ ${b}`);

test("소실점은 방 그림의 바닥 양옆 가장자리가 만나는 점 — 그림을 바꾸면 다시 재기", async () => {
  const file = path.resolve("public", HIDEOUT_SCENE.background.replace(/^\//, ""));
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const floor = (x, y) => {
    const i = (y * info.width + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    return r > 190 && g > 120 && g < 180 && b < 135 && r - b > 80;
  };
  const run = (x, y, dir) => [0, 1, 2, 3, 4, 5].every((k) => floor(x + k * dir, y));
  const left = [], right = [];
  for (let y = 516; y <= 686; y += 1) {
    const l = Array.from({ length: 300 }, (_, x) => x).find((x) => run(x, y, 1));
    const r = Array.from({ length: 300 }, (_, k) => info.width - 1 - k).find((x) => run(x, y, -1));
    if (l !== undefined) left.push([y, l]);
    if (r !== undefined) right.push([y, r]);
  }
  // 곧은 줄로 맞춤(널빤지 금이 걸린 줄은 빼며 다섯 번)
  const fit = (points) => {
    let kept = points;
    let line = null;
    for (let round = 0; round < 6; round += 1) {
      const n = kept.length, sy = kept.reduce((s, [y]) => s + y, 0), sx = kept.reduce((s, [, x]) => s + x, 0);
      const syy = kept.reduce((s, [y]) => s + y * y, 0), sxy = kept.reduce((s, [y, x]) => s + x * y, 0);
      const k = (n * sxy - sy * sx) / (n * syy - sy * sy), c = (sx - k * sy) / n;
      line = { k, c };
      const residual = kept.map(([y, x]) => Math.abs(k * y + c - x));
      const cut = Math.max(3, [...residual].sort((a, b) => a - b)[Math.floor(residual.length * 0.8)]);
      kept = kept.filter((_, i) => residual[i] < cut);
    }
    return line;
  };
  const a = fit(left), b = fit(right);
  const y = (b.c - a.c) / (a.k - b.k), x = a.k * y + a.c;
  near(x, HIDEOUT_VANISHING_POINT.x, 12, "소실점 x");
  near(y, HIDEOUT_VANISHING_POINT.y, 60, "소실점 y");
});

test("원근은 바닥에 앞뒤로 길게 누운 그림(세로 침대)에만 — 앞모습 · 옆모습 · 의자 앞 책상 · 다른 소품은 그대로", () => {
  assert.deepEqual([...HIDEOUT_FLOOR_LOOKS], ["lengthwise"]);
  const bed = bedAt(400, 900);
  assert.equal(bed.look, "lengthwise");
  const persp = hideoutFloorPerspective(bed);
  assert.ok(Object.isFrozen(persp));
  assert.deepEqual({ ...persp }, { x: 400, y: 900, height: bed.height, depth: 900 - HIDEOUT_VANISHING_POINT.y, lean: HIDEOUT_VANISHING_POINT.x - 400 });
  const arranged = hideoutSceneProps({ ...LAYOUT, chest: "chest-forest" }, {
    desk: { x: 600, y: 900, turn: true }, shelf: { x: 1000, y: 700, turn: true }, chest: { x: 1200, y: 960, turn: true },
  });
  for (const prop of [...hideoutSceneProps(LAYOUT), ...arranged]) {
    if (prop.look === "lengthwise") continue;
    assert.equal(hideoutFloorPerspective(prop), null, prop.id);
  }
  assert.equal(hideoutFloorPerspective(null), null);
  assert.equal(hideoutFloorPerspective({ look: "lengthwise", x: 1, y: Number.NaN, height: 10 }), null);
  assert.equal(hideoutPerspectiveCss(null), "");
  assert.equal(hideoutPerspectiveStyle(null), null);
});

test("아래 변은 그대로 · 위 변은 키 그대로 소실점 쪽으로 좁아지고 · 긴 두 변은 소실점을 향한다", () => {
  for (const [x, y] of [[180, 960], [768, 840], [1400, 1000], [520, 720]]) {
    const bed = bedAt(x, y), persp = hideoutFloorPerspective(bed);
    const box = { x0: x - bed.width / 2, y0: y - bed.height, x1: x + bed.width / 2, y1: y };
    const [tl, tr, br, bl] = hideoutPerspectiveQuad(persp, box);
    near(bl.x, box.x0, 1e-9, "아래 왼쪽"); near(br.x, box.x1, 1e-9, "아래 오른쪽"); near(bl.y, y, 1e-9); near(br.y, y, 1e-9);
    near(tl.y, box.y0, 1e-9, "위 변의 높이"); near(tr.y, box.y0, 1e-9);
    const k = (persp.depth - persp.height) / persp.depth;
    near(tr.x - tl.x, bed.width * k, 1e-9, "위 변 = 아래 변 × (D − 키) ÷ D");
    // 두 옆선을 늘이면 소실점에서 만남
    for (const [top, bottom] of [[tl, bl], [tr, br]]) {
      const t = (HIDEOUT_VANISHING_POINT.y - bottom.y) / (top.y - bottom.y);
      near(bottom.x + (top.x - bottom.x) * t, HIDEOUT_VANISHING_POINT.x, 1e-6, `(${x}, ${y}) 옆선`);
    }
    // 그림 상자 가운데 세로줄의 점도 소실점을 향하는 줄 위
    const mid = hideoutPerspectivePoint(persp, x, y - bed.height / 2);
    near((mid.x - x) / (y - mid.y), (HIDEOUT_VANISHING_POINT.x - x) / (y - HIDEOUT_VANISHING_POINT.y), 1e-9, "가운데 줄");
    assert.ok(mid.y < y - bed.height / 2, "먼 쪽(위)의 줄은 조금 위로 모임");
  }
  // 왼쪽에 놓은 침대는 오른쪽으로, 오른쪽은 왼쪽으로, 가운데는 기울지 않음
  const lean = (x) => { const bed = bedAt(x, 960), [tl, tr] = hideoutArtQuad(bed); return (tl.x + tr.x) / 2 - x; };
  assert.ok(lean(180) > 40, "왼쪽 침대는 머리가 오른쪽으로");
  assert.ok(lean(1400) < -40, "오른쪽 침대는 머리가 왼쪽으로");
  near(lean(768), 0, 1e-9, "가운데 침대");
});

// CSS transform(4×4 행렬 — CSS Transforms 명세의 행렬)을 직접 곱해, 화면이 그리는 모양과 셈(hideoutPerspectivePoint)이 같은지
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => Array.from({ length: 16 }, (_, n) => {
  const r = Math.floor(n / 4), c = n % 4;
  return a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + a[r * 4 + 3] * b[12 + c];
});
const set = (entries) => { const m = I(); for (const [r, c, v] of entries) m[r * 4 + c] = v; return m; };
const translate = (x, y) => set([[0, 3, x], [1, 3, y]]);
const apply = (m, x, y) => {
  const X = m[0] * x + m[1] * y + m[3], Y = m[4] * x + m[5] * y + m[7], W = m[12] * x + m[13] * y + m[15];
  return { x: X / W, y: Y / W };
};
function cssMatrix(css, unitPx, w, h, flip) {
  const match = css.match(/^perspective\(calc\(1px \* ([\d.]+)\)\) rotateX\(45deg\) scaleY\(([\d.]+)\) skewX\((-?[\d.]+)deg\)$/);
  assert.ok(match, css);
  const [depth, scaleY, skew] = match.slice(1).map(Number);
  const a = Math.PI / 4, s = Math.sin(a), c = Math.cos(a);
  const chain = [
    translate(w / 2, h),                              // transform-origin 50% 100% (앞)
    translate(-w / 2, -h),                            // translate(-50%, -100%)
    set([[3, 2, -1 / (depth * unitPx)]]),             // perspective
    set([[1, 1, c], [1, 2, -s], [2, 1, s], [2, 2, c]]), // rotateX(45deg)
    set([[1, 1, scaleY]]),                            // scaleY
    set([[0, 1, Math.tan(skew * Math.PI / 180)]]),     // skewX
    ...(flip ? [set([[0, 0, -1]])] : []),             // scaleX(-1)
    translate(-w / 2, -h),                            // transform-origin(뒤)
  ];
  return chain.reduce((all, m) => mul(all, m), I());
}

test("화면의 CSS transform이 셈과 같은 모양을 그린다(무대 크기 · 좌우 뒤집기와 상관없이)", () => {
  for (const [x, y] of [[180, 960], [768, 840], [1400, 1000]]) {
    for (const flip of [false, true]) {
      const bed = bedAt(x, y, flip ? { flip: true } : {}), persp = hideoutFloorPerspective(bed);
      const css = hideoutPerspectiveCss(persp, "1px");
      for (const unit of [1, 0.5, 0.137]) {
        const w = bed.width * unit, h = bed.height * unit, m = cssMatrix(css, unit, w, h, flip);
        // 그림의 네 귀(요소 안의 px) → 화면 자리(장면 px) — 뒤집은 그림은 왼쪽 위 픽셀이 오른쪽 위에 섬
        for (const [lx, ly] of [[0, 0], [w, 0], [w, h], [0, h], [w / 2, h / 2]]) {
          const shown = apply(m, lx, ly);
          const sceneX = x + (flip ? w / 2 - lx : lx - w / 2) / unit, sceneY = y - h / unit + ly / unit;
          const want = hideoutPerspectivePoint(persp, sceneX, sceneY);
          near(x + shown.x / unit, want.x, 0.05, `(${x}, ${y}) ${flip ? "뒤집음" : ""} ×${unit} x`);
          near(y + shown.y / unit, want.y, 0.05, `(${x}, ${y}) ${flip ? "뒤집음" : ""} ×${unit} y`);
        }
      }
    }
  }
  const style = hideoutPerspectiveStyle(hideoutFloorPerspective(bedAt(300, 900)), true);
  assert.equal(style.transformOrigin, "50% 100%");
  assert.match(style.transform, /^translate\(-50%, -100%\) perspective\(calc\(var\(--hideout-unit, 1px\) \* [\d.]+\)\) .* scaleX\(-1\)$/);
});

test("누르는 칸 · 보이는 상자 — 기운 모양 그대로(옆의 빈 바닥은 안 잡힘), 원근이 없는 소품은 지금까지와 같음", () => {
  const bed = bedAt(200, 940), quad = hideoutArtQuad(bed);
  assert.deepEqual(hideoutArtBox(bed), hideoutQuadBounds(quad));
  const hit = hideoutQuadHit(quad);
  assert.deepEqual(hit.box, hideoutQuadBounds(quad));
  const points = hit.clipPath.match(/^polygon\((.*)\)$/)[1].split(", ");
  assert.equal(points.length, 4);
  assert.ok(points.every((point) => /^\d+(\.\d+)?% \d+(\.\d+)?%$/.test(point)), hit.clipPath);
  // 왼쪽에 놓은 침대 — 오른쪽 위 귀가 가장 오른쪽, 왼쪽 아래 귀가 가장 왼쪽(머리가 오른쪽으로 기움)
  assert.equal(points[1], "100% 0%");
  assert.equal(points[3], "0% 100%");
  assert.ok(points[0].endsWith(" 0%") && points[2].endsWith(" 100%"));
  assert.ok(Number.parseFloat(points[0]) > 0 && Number.parseFloat(points[2]) < 100);
  // 앞모습 침대 · 다른 소품의 보이는 상자는 네모 그대로(네 귀를 감싼 상자 = 상자)
  for (const prop of hideoutSceneProps(LAYOUT)) {
    const [tl, tr, br, bl] = hideoutArtQuad(prop), box = hideoutArtBox(prop);
    assert.deepEqual([tl.x, tl.y, tr.x, br.y, bl.x], [box.x0, box.y0, box.x1, box.y1, box.x0], prop.id);
  }
});

test("발자리 — 위아래 범위는 평평할 때 그대로(뒷벽 판정 · 저장된 침대), 좌우는 기운 모양을 따르는 계단 여섯", () => {
  for (const [x, y] of [[180, 960], [768, 840], [1400, 1000]]) {
    const bed = bedAt(x, y), feet = hideoutFootprints(bed);
    assert.equal(feet.length, 6);
    assert.ok(feet.every((foot) => foot.kind === "rect" && foot.id === "desk-calendar"));
    near(feet[0].y0, y - bed.height * 0.72, 1e-9, "윗줄"); near(feet.at(-1).y1, y, 1e-9, "바닥");
    for (let i = 1; i < feet.length; i += 1) near(feet[i].y0, feet[i - 1].y1, 1e-9, "이어짐");
    const persp = hideoutFloorPerspective(bed);
    const flat = { x0: x - bed.width * 0.46, y0: y - bed.height * 0.72, x1: x + bed.width * 0.46, y1: y };
    const [tl, tr] = hideoutPerspectiveQuad(persp, flat);
    // 기운 쪽으로 계단: 왼쪽 침대는 위 칸일수록 오른쪽(맨 아래 칸의 왼쪽 끝은 평평할 때 그대로), 오른쪽 침대는 거울, 가운데는 좁아지기만
    if (x < 700) {
      assert.ok(feet[0].x0 > feet.at(-1).x0 && feet[0].x1 > feet.at(-1).x1, "왼쪽 침대");
      near(feet.at(-1).x0, flat.x0, 1e-9, "맨 아래 칸의 왼쪽 끝");
    }
    if (x > 840) {
      assert.ok(feet[0].x1 < feet.at(-1).x1 && feet[0].x0 < feet.at(-1).x0, "오른쪽 침대");
      near(feet.at(-1).x1, flat.x1, 1e-9, "맨 아래 칸의 오른쪽 끝");
    }
    if (x === 768) {
      for (const foot of feet) near((foot.x0 + foot.x1) / 2, 768, 1e-9, "가운데 줄");
      assert.ok(feet.every((foot) => foot.x0 >= flat.x0 - 1e-9 && foot.x1 <= flat.x1 + 1e-9), "가운데 침대는 좁아지기만");
    }
    // 칸마다 기운 모양(두 옆선 사이)을 위아래 끝 모두에서 덮음
    const side = (from, to, at) => from.x + (to.x - from.x) * (at - from.y) / (to.y - from.y);
    for (const foot of feet) {
      for (const at of [foot.y0, foot.y1]) {
        assert.ok(foot.x0 <= side({ x: flat.x0, y: flat.y1 }, tl, at) + 1e-9, "왼쪽 옆선");
        assert.ok(foot.x1 >= side({ x: flat.x1, y: flat.y1 }, tr, at) - 1e-9, "오른쪽 옆선");
      }
    }
  }
  // 원근이 없으면 네모 하나 그대로
  assert.deepEqual(hideoutPerspectiveSlices(null, { x0: 1, y0: 2, x1: 3, y1: 4 }), [{ x0: 1, y0: 2, x1: 3, y1: 4 }]);
});

test("뒷벽에 머리를 붙인 세로 침대는 원근을 입혀도 그대로 놓인다(위아래 범위가 그대로라)", () => {
  // 바닥 가운데 y가 이만큼 아래면 발자리 윗줄이 뒷벽 선(516 − 40) 안 — 평평할 때와 같은 경계
  const bed = bedAt(768, 696), limit = 516 - 40;
  assert.ok(bed.y - bed.height * 0.72 >= limit);
  assert.equal(hideoutArrangeProblem(LAYOUT, { "desk-calendar": { x: 768, y: 696, turn: true } })?.code ?? null, null);
  assert.equal(hideoutArrangeProblem(LAYOUT, { "desk-calendar": { x: 768, y: 680, turn: true } })?.code, "floor");
});
