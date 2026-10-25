// 참여 코드 잠금 — 앱 쪽(lib)과 서버 쪽(functions) 사본이 같은 셈인지 함께 봅니다.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as app from "../../lib/joinLockout.js";

const require = createRequire(import.meta.url);
const server = require("../../functions/joinLockout.js");

for (const [name, m] of [["lib", app], ["functions", server]]) {
  test(`${name}: 3번 틀리면 5분 잠금, 잠금 동안 남은 기회 0`, () => {
    const t = 1_000_000;
    let rec = null;
    assert.equal(m.triesLeft(rec, t), 3);
    rec = m.recordFailure(rec, t);
    assert.deepEqual(rec, { fails: 1, lockedUntil: 0 });
    assert.equal(m.triesLeft(rec, t), 2);
    rec = m.recordFailure(rec, t);
    assert.equal(m.triesLeft(rec, t), 1);
    rec = m.recordFailure(rec, t);
    assert.equal(rec.lockedUntil, t + 5 * 60 * 1000);
    assert.equal(m.lockedUntilOf(rec, t + 1000), t + 5 * 60 * 1000);
    assert.equal(m.triesLeft(rec, t + 1000), 0);
  });

  test(`${name}: 5분이 지나면 풀리고 다시 세 번`, () => {
    const t = 5_000_000;
    const locked = { fails: 0, lockedUntil: t };
    assert.equal(m.lockedUntilOf(locked, t), 0);
    assert.equal(m.triesLeft(locked, t), 3);
    assert.deepEqual(m.recordFailure(locked, t), { fails: 1, lockedUntil: 0 });
  });

  test(`${name}: 코드 모양 맞추기`, () => {
    assert.equal(m.normalizeJoinCode(" ab-c 12 "), "ABC12");
    assert.equal(m.normalizeJoinCode(null), "");
  });
}

test("두 사본의 상수가 같음", () => {
  assert.equal(app.JOIN_MAX_FAILS, server.JOIN_MAX_FAILS);
  assert.equal(app.JOIN_LOCK_MS, server.JOIN_LOCK_MS);
});
