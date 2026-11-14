// 책 광장 · 교실 · 아지트의 '따로 놓는 그림'과 숫자가 맞는가 — 그림을 직접 재어 봅니다(sharp).
// 그림을 바꾸면(2026년 11월 도트 그림처럼) 보이는 크기가 달라져, 숫자만 그대로면 도는 빛이 금테를 덮거나
// 서는 자리가 러그 밖으로 나갑니다. 이 시험이 어긋나면 lib/readingPlazaMap.js · lib/readingHideoutMap.js의 값을 다시 재세요.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { CLASSROOM_DESK, CLASSROOM_RUG, CLASSROOM_SEATS, CLASSROOM_SIT_HIDE, CLASSROOM_ROOM, PORTAL_ART } from "../../lib/readingPlazaMap.js";
import { HIDEOUT_RETURN_PORTAL } from "../../lib/readingHideoutMap.js";

const file = (src) => path.join(path.resolve("public"), src.replace(/^\//, ""));
// 그림의 점 가운데 조건에 맞는 것의 상자 [x0, y0, x1, y1](그림 px)
async function box(src, keep) {
  const { data, info } = await sharp(file(src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      if (!keep(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { b: [x0, y0, x1 + 1, y1 + 1], w: info.width, h: info.height };
}
const opaque = (r, g, b, a) => a > 128;
// 포털 안쪽의 청록 소용돌이(금테 · 손잡이 · 바닥색이 아닌 곳)
const teal = (r, g, b, a) => a > 200 && g > r + 25 && b > r + 10;

test("러그 — 보이는 타원이 CLASSROOM_RUG의 rx · ry와 같고, 책상 옆에 서는 자리 · 펫 자리가 러그 안", async () => {
  const { b, w, h } = await box(CLASSROOM_RUG.src, opaque);
  const rx = (b[2] - b[0]) / 2 * CLASSROOM_RUG.w / w, ry = (b[3] - b[1]) / 2 * CLASSROOM_RUG.h / h;
  assert.ok(Math.abs(rx - CLASSROOM_RUG.rx) <= 2, `보이는 rx ${rx.toFixed(1)} · 숫자 ${CLASSROOM_RUG.rx}`);
  assert.ok(Math.abs(ry - CLASSROOM_RUG.ry) <= 2, `보이는 ry ${ry.toFixed(1)} · 숫자 ${CLASSROOM_RUG.ry}`);
  for (const seat of CLASSROOM_SEATS) {
    for (const side of seat.sides) {
      for (const [p, what] of [[side.stand, "서는 자리"], [side.pet, "펫 자리"]]) {
        const d = ((p.x - seat.rug.x) / rx) ** 2 + ((p.y - seat.rug.y) / ry) ** 2;
        assert.ok(d <= 1, `자리 ${seat.index} ${what} — 보이는 러그 밖(${d.toFixed(2)})`);
      }
    }
  }
});

test("의자 — 앉은 캐릭터를 가리는 선 · 의자 상자가 의자 그림(chair-front)의 보이는 자리와 맞는다", async () => {
  const { b, w } = await box(CLASSROOM_DESK.chair, opaque);
  const k = CLASSROOM_DESK.w / w;
  const seat = CLASSROOM_SEATS[0], top = seat.box[1], left = seat.box[0];
  const chairTop = top + b[1] * k, chairLeft = left + b[0] * k, chairRight = left + b[2] * k;
  assert.ok(Math.abs(seat.sit.y - CLASSROOM_SIT_HIDE - chairTop) <= 2, `가리는 선 ${seat.sit.y - CLASSROOM_SIT_HIDE} · 등받이 윗선 ${chairTop.toFixed(1)}`);
  assert.ok(Math.abs(seat.chair[1] - chairTop) <= 2, `의자 상자 위 ${seat.chair[1]} · 등받이 윗선 ${chairTop.toFixed(1)}`);
  assert.ok(seat.chair[0] <= chairLeft + 1 && seat.chair[2] >= chairRight - 1, `의자 상자 ${seat.chair[0]}~${seat.chair[2]} · 의자 ${chairLeft.toFixed(1)}~${chairRight.toFixed(1)}`);
});

test("포털 — 도는 빛은 안쪽 소용돌이 안, 누르는 범위는 보이는 포털 크기, 들어서는 곳은 소용돌이보다 작다(선생님 요청)", async () => {
  const gate = CLASSROOM_ROOM.portals[0];
  const outer = await box(PORTAL_ART.src, opaque), inner = await box(PORTAL_ART.src, teal);
  const kx = PORTAL_ART.w / outer.w, ky = PORTAL_ART.h / outer.h;
  const vis = { rx: (outer.b[2] - outer.b[0]) / 2 * kx, ry: (outer.b[3] - outer.b[1]) / 2 * ky };
  const swirlRoom = { rx: (inner.b[2] - inner.b[0]) / 2 * kx, ry: (inner.b[3] - inner.b[1]) / 2 * ky };
  // 누르는 범위(ring) — 보이는 포털(금테 · 손잡이)과 같은 크기
  assert.ok(Math.abs(gate.ring.rx - vis.rx) <= 3 && Math.abs(gate.ring.ry - vis.ry) <= 3, `ring ${gate.ring.rx}×${gate.ring.ry} · 보이는 포털 ${vis.rx.toFixed(1)}×${vis.ry.toFixed(1)}`);
  // 도는 빛 — 얹는 상자가 안쪽 소용돌이를 넘지 않는다(도는 빛 그림은 그 상자의 72% — 금테를 덮지 않음)
  assert.ok(gate.swirl.rx <= swirlRoom.rx + 1 && gate.swirl.ry <= swirlRoom.ry + 1, `swirl ${gate.swirl.rx}×${gate.swirl.ry} · 안쪽 ${swirlRoom.rx.toFixed(1)}×${swirlRoom.ry.toFixed(1)}`);
  assert.ok(gate.swirl.rx >= swirlRoom.rx - 3 && gate.swirl.ry >= swirlRoom.ry - 3, "도는 빛이 소용돌이에 견줘 너무 작지 않다");
  // 들어서는 곳 — 소용돌이 안쪽 깊숙이(가장자리를 밟자마자 건너가지 않게)
  assert.ok(gate.rx < gate.swirl.rx * 0.7 && gate.ry < gate.swirl.ry * 0.7, `들어서는 곳 ${gate.rx}×${gate.ry}`);
  // 그림의 가운데가 곧 못의 가운데(drop) — 소용돌이 가운데와 2px 안
  const swirlCenterY = ((inner.b[1] + inner.b[3]) / 2 - outer.h / 2) * ky;
  assert.ok(Math.abs(swirlCenterY + PORTAL_ART.drop) <= 2, `소용돌이 가운데 ${swirlCenterY.toFixed(1)} · drop ${PORTAL_ART.drop}`);
});

test("아지트의 교실로 가는 포털 — 누르는 단추 · 들어서는 곳이 보이는 포털 크기", async () => {
  const portal = HIDEOUT_RETURN_PORTAL;
  const outer = await box(portal.src, opaque);
  // 그림(640×280)을 상자(width × height)에 담으면(contain) 폭에 맞춰집니다
  const k = Math.min(portal.width / outer.w, portal.height / outer.h);
  const visW = (outer.b[2] - outer.b[0]) * k, visH = (outer.b[3] - outer.b[1]) * k;
  assert.ok(Math.abs(portal.hit.width - visW) <= 3 && Math.abs(portal.hit.height - visH) <= 3, `단추 ${portal.hit.width}×${portal.hit.height} · 보이는 포털 ${visW.toFixed(1)}×${visH.toFixed(1)}`);
  assert.ok(portal.rx <= portal.hit.width / 2, "들어서는 곳이 보이는 포털보다 넓지 않다");
});
