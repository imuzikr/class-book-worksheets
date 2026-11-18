// 아지트 바닥의 원근(2026년 11월 · 선생님 요청 — "침대처럼 가구를 길게 놓았을 때 전체적인 배경처럼 아래로 내려올수록 넓어지는
// 효과가 있어야 하는데 그냥 직사각형 모양").
//
// 방 그림(public/reading-hideout/background.webp)의 바닥은 뒷벽 아래에서 앞(아래)으로 올수록 넓어지고, 양옆 가장자리(초록 벽판
// 아래 선)를 위로 늘이면 한 점 — 소실점에서 만납니다. 앞뒤로 길게 누운 가구(세로로 놓은 독서 침대 — 돌린 그림의 look
// 'lengthwise', lib/readingHideoutTurn.js)를 그 점 쪽으로 좁혀 그립니다: 그림 상자의 아래 변(바닥에 닿는 앞쪽)은 그대로 두고,
// 위 변(뒤쪽)은 소실점 쪽으로 좁아지며(높이는 그대로) 긴 두 변이 그 점을 향해 기웁니다 — 방 왼쪽에 놓은 침대는 오른쪽으로,
// 오른쪽에 놓은 침대는 왼쪽으로(옆벽 아래 선처럼), 가운데 놓은 침대는 양쪽이 고르게 좁아집니다. 서 있는 가구의 앞모습 ·
// 옆모습(책장 · 소파 · 보물함 · 어항 · 의자 앞 책상)은 그대로입니다.
//
// 셈은 바닥 평면의 원근 그대로(사영 변환) — 그림 상자 안의 점은 hideoutPerspectivePoint, 화면은 같은 변환을 CSS transform 하나로
// 그립니다(hideoutPerspectiveCss · tests/unit/readingHideoutPerspective.test.mjs가 둘이 같은지 행렬로 견줌). 꾸미는 동안 누르는
// 칸(보이는 모양 — hideoutArtQuad) · 겹침과 포털 판정(보이는 상자 — hideoutArtBox) · 걷는 발자리(hideoutFootprints)도 같은 셈을 따릅니다.
// 발자리는 위아래 범위를 그대로 두고 좌우만 기울입니다(hideoutPerspectiveSlices) — 뒷벽에 머리를 붙여 둔 저장된 침대가 그대로 놓이게.

// 소실점(장면 좌표) — 바닥 양옆 가장자리를 줄마다(y 516~686) 재어 곧은 줄로 맞추면 (761, −1562)에서 만납니다. 방이 좌우 대칭이라
// 가운데 줄 x 768로 둡니다. 방 그림을 바꾸면 다시 재세요(시험이 그림의 바닥 가장자리와 견줌).
export const HIDEOUT_VANISHING_POINT = Object.freeze({ x: 768, y: -1560 });
// 원근을 입히는 모습 — 바닥에 앞뒤로 길게 누운 그림의 look
export const HIDEOUT_FLOOR_LOOKS = Object.freeze(["lengthwise"]);
const LOOKS = new Set(HIDEOUT_FLOOR_LOOKS);

/**
 * 한 소품의 바닥 원근 — { x, y(그림 상자의 바닥 가운데), height(그림 상자의 키), depth(바닥 가운데에서 소실점까지의 높이 D),
 * lean(소실점이 바닥 가운데에서 떨어진 가로 거리 — 오른쪽이 +) }. 원근을 입히지 않는 소품이면 null.
 * 위 변은 (D − 키) ÷ D만큼으로 좁아집니다(바닥 그림이 그만큼 좁아지므로).
 */
export function hideoutFloorPerspective(prop) {
  if (!prop || !LOOKS.has(prop.look)) return null;
  const { x, y, height } = prop;
  if (![x, y, height].every(Number.isFinite) || height <= 0) return null;
  const depth = y - HIDEOUT_VANISHING_POINT.y;
  if (depth <= height * 2) return null;   // 소실점 가까이(장면 밖 — 실제로는 없음)
  return Object.freeze({ x, y, height, depth, lean: HIDEOUT_VANISHING_POINT.x - x });
}

/**
 * 그림 상자 안의 점(원근을 입히기 전 · 장면 좌표)이 원근을 입힌 뒤 서는 자리 — persp가 없으면 그대로.
 * 바닥 가운데에서 오른쪽 X · 위로 Y인 점은 X' = (X·d + lean·Y) ÷ (d + Y), Y' = D·Y ÷ (d + Y) (d = D − 키): 아래 변(Y 0)은 그대로,
 * 위 변(Y 키)은 키 그대로 · 소실점 쪽으로 좁아지고, 세로줄은 모두 소실점을 향합니다.
 */
export function hideoutPerspectivePoint(persp, px, py) {
  if (!persp) return { x: px, y: py };
  const X = px - persp.x, Y = persp.y - py, d = persp.depth - persp.height;
  return { x: persp.x + (X * d + persp.lean * Y) / (d + Y), y: persp.y - persp.depth * Y / (d + Y) };
}

/** 상자(장면 좌표 { x0, y0, x1, y1 })의 네 귀가 원근을 입힌 뒤 — [왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래]({ x, y }). */
export function hideoutPerspectiveQuad(persp, box) {
  return [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]].map(([x, y]) => hideoutPerspectivePoint(persp, x, y));
}

/** 점 여럿을 감싸는 상자 { x0, y0, x1, y1 }. */
export function hideoutQuadBounds(quad) {
  return {
    x0: Math.min(...quad.map((point) => point.x)), y0: Math.min(...quad.map((point) => point.y)),
    x1: Math.max(...quad.map((point) => point.x)), y1: Math.max(...quad.map((point) => point.y)),
  };
}

/**
 * 바닥 넓이(네모 — 장면 좌표, 원근을 입히기 전)를 원근을 입힌 모양에 맞춘 네모 n개로 — 위아래 범위(y0 ~ y1)는 그대로 두고, 그 사이를
 * n칸으로 나눠 칸마다 원근을 입힌 두 옆선의 좌우 끝을 씁니다(기운 쪽으로 계단 모양). 위아래를 그대로 두는 까닭: 원근은 그림 상자 안의
 * 줄을 조금씩 위로 모으는데(뒤쪽이 멀어서), 발자리의 윗줄까지 따라 올리면 뒷벽에 머리를 붙여 저장해 둔 세로 침대가 '바닥 밖'이 됩니다.
 */
export function hideoutPerspectiveSlices(persp, rect, n = 6) {
  if (!persp) return [{ ...rect }];
  const [tl, tr, br, bl] = hideoutPerspectiveQuad(persp, rect);
  const along = (a, b, y) => (b.y === a.y ? a.x : a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
  const left = (y) => along(bl, tl, y), right = (y) => along(br, tr, y);
  return Array.from({ length: n }, (_, i) => {
    const ya = rect.y0 + (rect.y1 - rect.y0) * i / n, yb = rect.y0 + (rect.y1 - rect.y0) * (i + 1) / n;
    return { x0: Math.min(left(ya), left(yb)), y0: ya, x1: Math.max(right(ya), right(yb)), y1: yb };
  });
}

const fixed = (value, digits) => Number(value.toFixed(digits));
/**
 * 화면에 그리는 CSS transform — 그림 상자의 바닥 가운데를 기준(transform-origin 50% 100%)으로 translate(-50%, -100%) 바로 뒤 ·
 * 좌우 뒤집기(scaleX(-1)) 앞에 둡니다. unit은 장면 1px의 화면 길이(CSS 길이 — 아지트 무대의 --hideout-unit).
 * 셈: 원근 거리 = D(장면 px × unit), 45° 눕히고 세로로 √2·D ÷ d배 늘이면 위 변이 d ÷ D로 좁아지며 키는 그대로, 기울기는
 * skewX(atan(−lean ÷ d)) — hideoutPerspectivePoint와 같은 변환입니다(d = D − 키).
 */
export function hideoutPerspectiveCss(persp, unit = "var(--hideout-unit, 1px)") {
  if (!persp) return "";
  const d = persp.depth - persp.height;
  return `perspective(calc(${unit} * ${fixed(persp.depth, 3)})) rotateX(45deg) scaleY(${fixed(Math.SQRT2 * persp.depth / d, 6)}) skewX(${fixed(Math.atan(-persp.lean / d) * 180 / Math.PI, 5)}deg)`;
}

/**
 * 원근을 입힌 소품의 그림(<img>) 모양 — { transformOrigin, transform }. 아지트 무대 · 선생님의 아지트 목록(축소 그림)이 함께 씁니다.
 * 좌우로 뒤집은 그림은 거울로 한 뒤 원근을 입힙니다(뒤집어도 아래 변 · 기울기는 그대로 — 소실점은 방의 것).
 */
export function hideoutPerspectiveStyle(persp, flip = false, unit = undefined) {
  if (!persp) return null;
  return { transformOrigin: "50% 100%", transform: `translate(-50%, -100%) ${hideoutPerspectiveCss(persp, unit)}${flip ? " scaleX(-1)" : ""}` };
}

/**
 * 기운 모양(점 넷 — hideoutPerspectiveQuad)을 누르는 칸으로 — 감싸는 상자 { x0, y0, x1, y1 }(장면 좌표)와 그 상자 안의 CSS
 * clip-path(polygon, %). clip-path 밖은 누름을 받지 않아 기운 침대 옆의 빈 바닥을 눌러도 침대가 잡히지 않습니다.
 */
export function hideoutQuadHit(quad) {
  const box = hideoutQuadBounds(quad);
  const w = box.x1 - box.x0 || 1, h = box.y1 - box.y0 || 1;
  const at = (point) => `${fixed((point.x - box.x0) / w * 100, 3)}% ${fixed((point.y - box.y0) / h * 100, 3)}%`;
  return { box, clipPath: `polygon(${quad.map(at).join(", ")})` };
}
