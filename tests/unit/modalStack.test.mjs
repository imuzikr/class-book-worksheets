import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { backdropClose, hasModalAbove } from "../../lib/modal.js";

// 가짜 DOM — 배경마다 z-index · 보임 · 문서 차례 · 품은 요소만 흉내 냅니다.
// hasModalAbove가 공통 Esc의 '맨 위 창' 셈(isAbove — 안에 든 것 → z-index → 문서에서 뒤의 것)과
// 같은 차례로 판정하는지 봅니다(책나눔 창 위에 펫 '자랐어요!' 창이 뜬 경우가 처음 까닭).
let all = [];
function setup() {
  all = [];
  globalThis.Node = { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 };
  globalThis.getComputedStyle = (el) => ({ zIndex: el.detached ? "" : String(el.z ?? "auto") });
  globalThis.document = { querySelectorAll: (sel) => (sel === ".modal-backdrop" ? all.filter((el) => el.modalBackdrop) : []) };
}
function backdrop({ z, modalBackdrop = true, shown = true, inside = null, detached = false } = {}) {
  const node = { z, modalBackdrop, detached, order: all.length, isConnected: !detached, kids: [] };
  node.getClientRects = () => (shown && !detached ? [{}] : []);
  node.contains = (other) => other === node || node.kids.includes(other) || node.kids.some((k) => k.contains(other));
  node.compareDocumentPosition = (other) => (other.order > node.order ? 4 : 2);
  if (inside) inside.kids.push(node);
  all.push(node);
  return node;
}
afterEach(() => { delete globalThis.document; delete globalThis.getComputedStyle; delete globalThis.Node; });

test("책나눔 창(z 1200) 위에 펫 축하 창(z 1250)이 뜨면 위에 창이 있다 — 닫히면(숨으면) 없다", () => {
  setup();
  const reading = backdrop({ z: 1200, modalBackdrop: false });
  const cheer = backdrop({ z: 1250 });
  assert.equal(hasModalAbove(reading), true);
  assert.equal(hasModalAbove(cheer), false);
  cheer.getClientRects = () => [];
  assert.equal(hasModalAbove(reading), false);
});

test("z-index가 낮은 보통 창은 아래 · 같으면 문서에서 뒤의 것이 위", () => {
  setup();
  const plain = backdrop({ z: 100 });
  const reading = backdrop({ z: 1200, modalBackdrop: false });
  assert.equal(hasModalAbove(reading), false);
  assert.equal(hasModalAbove(plain), false); // 책나눔 창은 .modal-backdrop도 등록된 창도 아니라 세지 않음
  const first = backdrop({ z: 200 });
  const second = backdrop({ z: 200 });
  assert.equal(hasModalAbove(first), true);
  assert.equal(hasModalAbove(second), false);
});

test("창 안에 든 창은 위, 창을 품은 바깥 창은 아래 · 자기 자신과 빈 값은 세지 않음", () => {
  setup();
  const outer = backdrop({ z: 100 });
  const reading = backdrop({ z: 1200, modalBackdrop: false, inside: outer });
  assert.equal(hasModalAbove(reading), false);
  const nested = backdrop({ z: 50, inside: reading });
  assert.equal(hasModalAbove(reading), true);
  assert.equal(hasModalAbove(nested), false);
  assert.equal(hasModalAbove(null), false);
});

test("이 줄(backdropClose)로 등록한 배경도 셈 · 문서에서 떨어진 배경은 z-index 0으로 봄", () => {
  setup();
  const reading = backdrop({ z: 1200, modalBackdrop: false });
  const registered = backdrop({ z: 1300, modalBackdrop: false });
  assert.equal(hasModalAbove(reading), false);
  backdropClose(() => {}).ref(registered);
  assert.equal(hasModalAbove(reading), true);
  // 닫히는 중인 창(문서에서 떨어짐) — 떠 있는 창이 있으면 위로 봅니다(초점을 돌려놓지 않게)
  const closing = backdrop({ z: 1200, modalBackdrop: false, detached: true });
  assert.equal(hasModalAbove(closing), true);
  registered.getClientRects = () => [];
  assert.equal(hasModalAbove(closing), false);
});
