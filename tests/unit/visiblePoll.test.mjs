// 화면이 보일 때만 되풀이하는 확인(lib/visiblePoll.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { startVisiblePoll } from "@/lib/visiblePoll";

function fakeEnv() {
  let clock = 0;
  let tickFn = null;
  let cleared = false;
  const handlers = { doc: new Map(), win: new Map() };
  const target = (map) => ({
    addEventListener: (type, fn) => map.set(type, fn),
    removeEventListener: (type, fn) => { if (map.get(type) === fn) map.delete(type); },
  });
  const doc = { visibilityState: "visible", ...target(handlers.doc) };
  const win = target(handlers.win);
  return {
    doc, win, handlers,
    opts: {
      doc, win,
      now: () => clock,
      setTimer: (fn) => { tickFn = fn; return 1; },
      clearTimer: () => { cleared = true; },
      intervalMs: 60000,
      wakeGapMs: 10000,
    },
    advance(ms) { clock += ms; },
    tick() { tickFn?.(); },
    focus() { handlers.win.get("focus")?.(); },
    visibility(state) { doc.visibilityState = state; handlers.doc.get("visibilitychange")?.(); },
    get cleared() { return cleared; },
  };
}

test("주기마다 묻되, 탭이 숨어 있으면 건너뜀", () => {
  const env = fakeEnv();
  let runs = 0;
  startVisiblePoll(() => { runs += 1; }, env.opts);
  env.advance(60000); env.tick();
  assert.equal(runs, 1);
  env.doc.visibilityState = "hidden";
  env.advance(60000); env.tick();
  assert.equal(runs, 1);
});

test("탭으로 돌아오면 한 번만 — visibilitychange와 focus가 함께 와도", () => {
  const env = fakeEnv();
  let runs = 0;
  startVisiblePoll(() => { runs += 1; }, env.opts);
  env.visibility("hidden");
  assert.equal(runs, 0);
  env.advance(30000);
  env.visibility("visible");
  env.focus();
  assert.equal(runs, 1);
  // 잠깐 다른 창을 보고 곧바로 돌아오면(10초 안) 다시 묻지 않음
  env.advance(4000);
  env.focus();
  assert.equal(runs, 1);
  env.advance(7000);
  env.focus();
  assert.equal(runs, 2);
});

test("방금 물었으면(mark · 돌아와 물음) 곧이어 오는 주기는 건너뜀", () => {
  const env = fakeEnv();
  let runs = 0;
  const poll = startVisiblePoll(() => { runs += 1; }, env.opts);
  poll.mark();
  env.advance(20000); env.tick();
  assert.equal(runs, 0);
  env.advance(15000); env.tick();
  assert.equal(runs, 1);
  // 처음 읽은 직후의 focus도 건너뜀
  const env2 = fakeEnv();
  let runs2 = 0;
  const poll2 = startVisiblePoll(() => { runs2 += 1; }, env2.opts);
  poll2.mark();
  env2.advance(1000); env2.focus();
  assert.equal(runs2, 0);
});

test("멈추면 주기 · 이벤트를 모두 걷음", () => {
  const env = fakeEnv();
  let runs = 0;
  const poll = startVisiblePoll(() => { runs += 1; }, env.opts);
  poll.stop();
  assert.equal(env.cleared, true);
  assert.equal(env.handlers.doc.size, 0);
  assert.equal(env.handlers.win.size, 0);
  env.advance(60000); env.tick();
  assert.equal(runs, 0);
});

test("document · window가 없는 곳(서버)에서도 깨지지 않음", () => {
  let runs = 0;
  let tickFn;
  const poll = startVisiblePoll(() => { runs += 1; }, { doc: null, win: null, now: () => 100000, setTimer: (fn) => { tickFn = fn; return 1; }, clearTimer: () => {} });
  tickFn();
  assert.equal(runs, 1);
  poll.stop();
});
