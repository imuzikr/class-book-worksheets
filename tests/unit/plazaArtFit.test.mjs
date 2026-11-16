// 책 광장 · 교실 · 아지트의 '따로 놓는 그림'과 숫자가 맞는가 — 그림을 직접 재어 봅니다(sharp).
// 그림을 바꾸면(2026년 11월 도트 그림처럼) 보이는 크기가 달라져, 숫자만 그대로면 도는 빛이 금테를 덮거나
// 서는 자리가 러그 밖으로 나갑니다. 이 시험이 어긋나면 lib/readingPlazaMap.js · lib/readingHideoutMap.js의 값을 다시 재세요.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { CLASSROOM_CLOCK, CLASSROOM_DESK, CLASSROOM_RUG, CLASSROOM_SEATS, CLASSROOM_SIT_HIDE, CLASSROOM_ROOM, PORTAL_ART } from "../../lib/readingPlazaMap.js";
import { HIDEOUT_RETURN_PORTAL } from "../../lib/readingHideoutMap.js";
import { HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_ITEMS, HIDEOUT_PLAQUE_FONT, HIDEOUT_PLAQUE_PANELS, HIDEOUT_TABLETOP, HIDEOUT_THEMES, hideoutSceneProps } from "../../lib/readingHideout.js";

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

test("교실 벽시계 — 배경의 빈 시계판(크림)이 CLASSROOM_CLOCK 자리 · 지름이고, 얹는 시계판(점 12개 · 바늘)이 그 안에 든다", async () => {
  const clock = CLASSROOM_CLOCK;
  // 배경의 시계판 — (x, y)에서 이어진 밝은 크림 점들의 상자
  const { data, info } = await sharp(file(CLASSROOM_ROOM.art)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const bright = (x, y) => { const i = (y * W + x) * 3; return data[i] > 225 && data[i + 1] > 205 && data[i + 2] > 170; };
  const seen = new Set(), stack = [[clock.x, clock.y]];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  while (stack.length) {
    const [x, y] = stack.pop(), k = y * W + x;
    if (x < 0 || y < 0 || x >= W || y >= info.height || seen.has(k) || !bright(x, y)) continue;
    seen.add(k);
    assert.ok(seen.size < 10000, "시계판이 아니라 넓은 벽을 칠하고 있습니다 — CLASSROOM_CLOCK의 자리를 다시 재세요");
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const faceW = x1 - x0 + 1, faceH = y1 - y0 + 1;
  assert.ok(Math.abs(faceW - clock.d) <= 3 && Math.abs(faceH - clock.d) <= 3, `배경의 시계판 ${faceW}×${faceH} · 지름 ${clock.d}`);
  assert.ok(Math.abs((x0 + x1) / 2 - clock.x) <= 1.5 && Math.abs((y0 + y1) / 2 - clock.y) <= 1.5, `배경의 시계판 가운데 ${(x0 + x1) / 2}, ${(y0 + y1) / 2}`);
  // 얹는 그림 — 진한 점(먹)이 시계판 안쪽에만 있고, 따로 떨어진 덩어리가 13개(점 12 + 바늘과 축 하나 — 숫자 · 긴 눈금이 없음)
  const ink = await sharp(file(clock.src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const S = ink.info.width, k = clock.d / S;
  assert.equal(ink.info.height, S);
  const solid = (x, y) => ink.data[(y * S + x) * 4 + 3] > 128;
  const done = new Uint8Array(S * S);
  let blobs = 0;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      if (!solid(x, y)) continue;
      const r = Math.hypot((x + 0.5) * k - clock.d / 2, (y + 0.5) * k - clock.d / 2);
      assert.ok(r <= clock.d / 2 - 2, `시계판 그림의 먹이 테에 닿습니다(${r.toFixed(1)} / ${clock.d / 2})`);
      if (done[y * S + x]) continue;
      blobs += 1;
      const fill = [[x, y]];
      while (fill.length) {
        const [px, py] = fill.pop();
        if (px < 0 || py < 0 || px >= S || py >= S || done[py * S + px] || !solid(px, py)) continue;
        done[py * S + px] = 1;
        fill.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
    }
  }
  assert.equal(blobs, 13, "점 12개 + 바늘과 축 하나");
});

// ── 아지트 책상 위 소품 · 문패 (선생님 신고 · 2026년 11월) ──────────────────────────────
// 그림의 점 하나(장면 좌표 → 그 그림의 점) — 그림 상자는 바닥 가운데(x, y) · 폭 width · 높이 height
const rawCache = new Map();
async function raw(src) {
  if (!rawCache.has(src)) rawCache.set(src, await sharp(file(src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  return rawCache.get(src);
}
async function scenePixel(prop, sx, sy) {
  const { data, info } = await raw(prop.src);
  const ix = Math.floor((sx - (prop.x - prop.width / 2)) / prop.width * info.width);
  const iy = Math.floor((sy - (prop.y - prop.height)) / prop.height * info.height);
  if (ix < 0 || iy < 0 || ix >= info.width || iy >= info.height) return [0, 0, 0, 0];
  const i = (iy * info.width + ix) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}
// 소품의 보이는 상자(장면 좌표) — 그림에서 불투명한 점의 상자를 그 소품 크기로
async function visibleBox(prop) {
  const { b, w, h } = await box(prop.src, opaque);
  const left = prop.x - prop.width / 2, top = prop.y - prop.height;
  return [left + b[0] / w * prop.width, top + b[1] / h * prop.height, left + b[2] / w * prop.width, top + b[3] / h * prop.height];
}
const area = (r) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
const meet = (a, b) => area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
// 테마 책상 넷의 윗면에 그려진 책(장면 좌표 — 책상 폭 288 · 바닥 (215, 790)에서 잰 상자). 그림이 바뀌었는지는 아래에서 함께 봅니다.
const DRAWN_BOOK = {
  "desk-forest": [133, 585, 205, 657], "desk-starlight": [133, 585, 205, 656],
  "desk-coastal": [135, 586, 205, 657], "desk-explorer": [137, 602, 199, 666],
};
// 책상 위에 서는 소품 — 한때 필기구 정리함 · 탁상 달력도 있었는데 2026년 11월에 바닥 가구로 바뀌었습니다.
const TABLE_SLOTS = ["bookstand"];

test("아지트 책상 위 소품 — 바닥이 그 책상의 윗면 위, 그려진 책을 가리지 않고, 소품끼리 가리지 않는다", async () => {
  const desks = HIDEOUT_ITEMS.filter((item) => item.slot === "desk");
  assert.equal(desks.length, 5, "기본 + 테마 넷");
  for (const desk of desks) {
    assert.ok(HIDEOUT_TABLETOP[desk.id], `${desk.id}의 책상 위 자리가 있어야 합니다`);
    for (const theme of HIDEOUT_THEMES) {
      const layout = { ...HIDEOUT_DEFAULT_LAYOUT, desk: desk.id };
      for (const slot of TABLE_SLOTS) layout[slot] = `${slot}-${theme.id}`;
      const props = hideoutSceneProps(layout);
      const deskProp = props.find((p) => p.category === "desk");
      const items = props.filter((p) => TABLE_SLOTS.includes(p.category));
      assert.equal(items.length, TABLE_SLOTS.length);
      const boxes = [];
      for (const item of items) {
        const where = `${desk.id} · ${item.itemId}`;
        // 바닥 양 끝(3px 안쪽)과 가운데가 책상 그림의 밝은 윗면 위 — 빈 곳(삐져나옴) · 검은 테두리(가장자리에 걸림)가 아님
        for (const sx of [item.x - item.width / 2 + 3, item.x, item.x + item.width / 2 - 3]) {
          const [r, g, b, a] = await scenePixel(deskProp, sx, item.y - 1);
          assert.ok(a > 200 && r + g + b > 300, `${where} — 바닥 (${sx.toFixed(1)}, ${item.y - 1})이 책상 윗면 밖이거나 테두리 위(${[r, g, b, a]})`);
          const book = DRAWN_BOOK[desk.id];
          if (book) assert.ok(!(sx >= book[0] && sx <= book[2] && item.y - 1 >= book[1] && item.y - 1 <= book[3]), `${where} — 그려진 책 위에 섰습니다`);
        }
        boxes.push({ item, box: await visibleBox(item) });
      }
      // 소품끼리 — 겹치는 넓이가 작은 쪽의 15% 이하
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const share = meet(boxes[i].box, boxes[j].box) / Math.min(area(boxes[i].box), area(boxes[j].box));
          assert.ok(share <= 0.15, `${desk.id} · ${boxes[i].item.category} · ${boxes[j].item.category}가 서로 ${(share * 100).toFixed(0)}% 가립니다`);
        }
      }
      const book = DRAWN_BOOK[desk.id];
      if (!book) continue;
      // 그려진 책 — 소품이 가리는 넓이가 책의 15% 이하이고, 책 가운데(잎 · 별 · 나침반 · 조개)는 가리지 않음
      const hidden = boxes.reduce((sum, entry) => sum + meet(entry.box, book), 0) / area(book);
      assert.ok(hidden <= 0.15, `${desk.id} — 그려진 책의 ${(hidden * 100).toFixed(0)}%를 가립니다`);
      const [cx, cy] = [(book[0] + book[2]) / 2, (book[1] + book[3]) / 2];
      for (const { item, box: r } of boxes) assert.ok(!(cx >= r[0] && cx <= r[2] && cy >= r[1] && cy <= r[3]), `${desk.id} · ${item.category}가 책 가운데를 가립니다`);
    }
  }
  // 재어 둔 '그려진 책' 상자가 그림과 맞는가 — 상자 안의 점 대부분이 나무색(주황)이 아님. 책상 그림이 바뀌면 여기서 걸립니다
  // (맨 나무 위라면 거의 모두 나무색. 탐험 책은 표지 · 걸쇠가 나무와 비슷한 갈색이라 23%쯤이 나무색으로 잡혀 35%를 기준으로 둠).
  for (const [deskId, book] of Object.entries(DRAWN_BOOK)) {
    const deskProp = hideoutSceneProps({ ...HIDEOUT_DEFAULT_LAYOUT, desk: deskId }).find((p) => p.category === "desk");
    let wood = 0, all = 0;
    for (let y = book[1] + 2; y < book[3] - 1; y += 2) {
      for (let x = book[0] + 2; x < book[2] - 1; x += 2) {
        const [r, g, b] = await scenePixel(deskProp, x, y);
        all += 1;
        if (r > 180 && g > 95 && g < 200 && b < 130 && r - b > 90) wood += 1;
      }
    }
    assert.ok(wood / all < 0.35, `${deskId} — 재어 둔 책 상자의 ${(wood / all * 100).toFixed(0)}%가 나무색입니다(책 자리를 다시 재세요)`);
  }
});

test("아지트 문패 — 글자를 놓는 띠(HIDEOUT_PLAQUE_PANELS)가 문패 그림의 크림색 칸 안", async () => {
  const cream = (r, g, b, a) => a > 200 && r > 225 && g > 200 && b > 160;
  for (const theme of HIDEOUT_THEMES) {
    const item = HIDEOUT_ITEMS.find((entry) => entry.id === `door-plaque-${theme.id}`);
    const panel = HIDEOUT_PLAQUE_PANELS[theme.id];
    assert.ok(item && panel, theme.id);
    const { data, info } = await raw(item.src);
    const cy = (panel.top + panel.bottom) / 2 * info.height, ph = (panel.bottom - panel.top) * info.height;
    for (const [band, share] of [[panel.one, HIDEOUT_PLAQUE_FONT.share.one], [panel.two, HIDEOUT_PLAQUE_FONT.share.two]]) {
      let ok = 0, all = 0;
      for (let y = Math.ceil(cy - ph * share / 2); y < cy + ph * share / 2; y += 1) {
        for (let x = Math.ceil(band[0] * info.width); x < band[1] * info.width; x += 1) {
          const i = (y * info.width + x) * 4;
          all += 1;
          if (cream(data[i], data[i + 1], data[i + 2], data[i + 3])) ok += 1;
        }
      }
      assert.ok(ok / all >= 0.98, `${theme.id} — 글자 띠(${share * 100}% 높이)의 ${((1 - ok / all) * 100).toFixed(1)}%가 크림색 칸 밖`);
    }
  }
});
