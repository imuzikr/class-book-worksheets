// 책 광장 — 무대가 쓸 수 있는 높이(lib/plazaStageRoom.js).
// 진짜 무대(ReadingPlaza의 measure)와 내려받는 동안의 자리(ReadingHub의 PlazaLoading)가 함께 쓰는 셈입니다.
// 화면(DOM)을 재는 셈이라 여기서는 필요한 모양만 흉내 냅니다.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PLAZA_STAGE_MIN_H, plazaRoom, plazaScroller } from "@/lib/plazaStageRoom";

// 요소 하나 — 화면 자리(top) · 보이는 높이(clientHeight) · 굴린 만큼(scrollTop) · overflow-y
const box = ({ top = 0, clientHeight = 0, scrollTop = 0, overflowY = "visible", parent = null } = {}) => ({
  parentElement: parent, clientHeight, scrollTop, overflowY,
  getBoundingClientRect: () => ({ top }),
});

const saved = {};
beforeEach(() => {
  for (const key of ["document", "window", "getComputedStyle"]) saved[key] = globalThis[key];
  globalThis.document = { body: box() };
  globalThis.window = { innerHeight: 900, scrollY: 0 };
  globalThis.getComputedStyle = (el) => ({ overflowY: el.overflowY });
});
afterEach(() => {
  for (const key of Object.keys(saved)) {
    if (saved[key] === undefined) delete globalThis[key];
    else globalThis[key] = saved[key];
  }
});

test("구르는 칸 찾기 — overflow-y가 auto · scroll인 가장 가까운 조상", () => {
  const body = globalThis.document.body;
  const main = box({ overflowY: "auto", parent: body });
  const hub = box({ parent: main });                       // visible
  const clipped = box({ overflowY: "clip", parent: hub }); // clip · hidden은 구르는 칸이 아님
  const wrap = box({ parent: clipped });
  assert.equal(plazaScroller(wrap), main);
  assert.equal(plazaScroller(box({ parent: box({ overflowY: "scroll", parent: body }) }))?.overflowY, "scroll");
  // 가까운 것이 이깁니다
  const inner = box({ overflowY: "auto", parent: main });
  assert.equal(plazaScroller(box({ parent: inner })), inner);
});

test("구르는 칸 찾기 — 문서가 구르는 화면(조상에 없음)이면 null", () => {
  const body = globalThis.document.body;
  assert.equal(plazaScroller(box({ parent: box({ overflowY: "hidden", parent: body }) })), null);
  assert.equal(plazaScroller(box({ parent: body })), null);
  // body 자신이 구르게 되어 있어도 '구르는 칸'으로 치지 않습니다(창 높이로 잼)
  globalThis.document.body.overflowY = "auto";
  assert.equal(plazaScroller(box({ parent: globalThis.document.body })), null);
  assert.equal(plazaScroller(null), null);
});

test("남은 높이 — 무대 칸의 위쪽부터 구르는 칸의 바닥까지", () => {
  // 상단바 81px 아래에 본문 칸(819px)이 서고 무대가 그 맨 위에 붙은 화면
  const main = box({ top: 81, clientHeight: 819 });
  assert.equal(plazaRoom(box({ top: 81 }), main), 819);
  // 무대 위에 알림 줄 60px이 있으면 그만큼 줄어듭니다
  assert.equal(plazaRoom(box({ top: 141 }), main), 759);
  // 휴대폰(상단바 87px)
  assert.equal(plazaRoom(box({ top: 87 }), box({ top: 87, clientHeight: 713 })), 713);
});

test("남은 높이 — 본문이 굴러가 있어도 같은 값(탭을 바꾸는 순간 앞 화면에서 굴린 값이 남아 있을 수 있음)", () => {
  // 140px 굴린 상태: 무대의 화면 자리는 그만큼 올라가 있습니다(81 − 140 = −59)
  const main = box({ top: 81, clientHeight: 819, scrollTop: 140 });
  assert.equal(plazaRoom(box({ top: -59 }), main), 819);
  // 알림 줄 60px 아래 + 140px 굴림
  assert.equal(plazaRoom(box({ top: 1 }), main), 759);
});

test("남은 높이 — 구르는 칸이 없으면 창 높이로(문서가 굴러가 있어도 같은 값)", () => {
  assert.equal(plazaRoom(box({ top: 81 }), null), 819);
  globalThis.window.scrollY = 100;
  assert.equal(plazaRoom(box({ top: -19 }), null), 819);
});

test("무대의 바닥 높이 — 창이 아주 낮아도 300px", () => {
  assert.equal(PLAZA_STAGE_MIN_H, 300);
});
