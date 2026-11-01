// lib/sizeRef.js — 붙을 때마다 다시 재고, 떨어지면 관찰을 풉니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeRef } from "../../lib/sizeRef.js";

function fakeRO() {
  const live = new Set();
  class RO {
    constructor(cb) { this.cb = cb; this.els = []; }
    observe(el) { this.els.push(el); live.add(this); }
    disconnect() { live.delete(this); }
  }
  const fire = () => { for (const r of live) r.cb(); };
  return { RO, live, fire };
}

test("re-measures when the board is attached again (narrow → wide)", () => {
  const { RO, live, fire } = fakeRO();
  const seen = [];
  const ref = sizeRef((s) => seen.push(s), RO);
  const wide = { clientWidth: 840, clientHeight: 500 };
  ref(wide);
  ref(null); // 목록으로 바뀌어 떨어짐
  assert.equal(live.size, 0);
  const again = { clientWidth: 1290, clientHeight: 600 };
  ref(again); // 다시 붙음 — 새 폭을 곧바로
  assert.deepEqual(seen, [{ w: 840, h: 500 }, { w: 0, h: 0 }, { w: 1290, h: 600 }]);
  assert.equal(live.size, 1);
  again.clientWidth = 1000;
  fire();
  assert.deepEqual(seen.at(-1), { w: 1000, h: 600 });
});

test("switching elements without null disconnects the old observer", () => {
  const { RO, live } = fakeRO();
  const seen = [];
  const ref = sizeRef((s) => seen.push(s), RO);
  ref({ clientWidth: 1, clientHeight: 1 });
  ref({ clientWidth: 2, clientHeight: 2 });
  assert.equal(live.size, 1);
  assert.deepEqual(seen.at(-1), { w: 2, h: 2 });
});

test("same element twice does not re-measure", () => {
  const { RO } = fakeRO();
  const seen = [];
  const ref = sizeRef((s) => seen.push(s), RO);
  const el = { clientWidth: 5, clientHeight: 5 };
  ref(el); ref(el);
  assert.equal(seen.length, 1);
});
