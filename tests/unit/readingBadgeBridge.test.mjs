import test from "node:test";
import assert from "node:assert/strict";

import {
  publishReadingBadges,
  withdrawReadingBadges,
  subscribeReadingBadges,
  readingBadgesSnapshot,
  readingBadgeSummary,
  requestReadingBadgesPanel,
  takeReadingBadgesRequest,
  onReadingBadgesRequest,
  READING_BADGES_OPEN_WAIT_MS,
} from "@/lib/readingBadgeBridge";

test("성장·뱃지 다리 — 걸면 알리고, 내가 건 것만 걷음", () => {
  let calls = 0;
  const off = subscribeReadingBadges(() => { calls += 1; });
  const a = {};
  const b = {};
  publishReadingBadges({ token: a, state: "loading", owner: null, stats: null });
  assert.equal(readingBadgesSnapshot().token, a);
  // 교사가 다른 학생을 고름 — 새 화면(b)이 먼저 걸고, 옛 화면(a)의 정리가 늦게 와도 b가 남아야 함
  publishReadingBadges({ token: b, state: "ready", owner: "김민준", stats: { badges: [] } });
  withdrawReadingBadges(a);
  assert.equal(readingBadgesSnapshot().token, b);
  withdrawReadingBadges(b);
  assert.equal(readingBadgesSnapshot(), null);
  assert.equal(calls, 3);
  off();
  publishReadingBadges(null);
  assert.equal(calls, 3); // 구독을 끊은 뒤에는 안 부름
  assert.equal(readingBadgesSnapshot(), null);
});

test("창 머리의 둘째 줄 — 본인 · 교사 · 불러오는 중 · 실패", () => {
  const badges = [{ earned: true }, { earned: false }, { earned: true }];
  assert.equal(readingBadgeSummary(null), "");
  assert.equal(readingBadgeSummary({ state: "ready", owner: null, stats: { badges } }), "3개 중 2개를 모았어요");
  assert.equal(readingBadgeSummary({ state: "ready", owner: "김민준", stats: { badges } }), "김민준 · 3개 중 2개");
  assert.equal(readingBadgeSummary({ state: "loading", owner: null, stats: null }), "불러오는 중");
  assert.equal(readingBadgeSummary({ state: "loading", owner: "김민준", stats: null }), "김민준 · 불러오는 중");
  assert.equal(readingBadgeSummary({ state: "error", owner: null, stats: null }), "독서 기록을 불러오지 못했어요");
});

test("창 열기 부탁 — 한 번만 가져가고, 오래된 부탁은 버림", () => {
  let told = 0;
  const off = onReadingBadgesRequest(() => { told += 1; });
  assert.equal(takeReadingBadgesRequest(1000), false); // 부탁이 없으면 거짓
  requestReadingBadgesPanel(1000);
  assert.equal(told, 1);
  assert.equal(takeReadingBadgesRequest(1500), true);
  assert.equal(takeReadingBadgesRequest(1600), false); // 한 번 가져가면 끝
  requestReadingBadgesPanel(2000);
  assert.equal(takeReadingBadgesRequest(2000 + READING_BADGES_OPEN_WAIT_MS + 1), false); // 너무 늦게 온 동그라미는 안 엶
  off();
  requestReadingBadgesPanel(5000);
  assert.equal(told, 2); // 끊은 뒤에는 안 부름
  assert.equal(takeReadingBadgesRequest(5000), true); // 부탁은 남아 있다가 다음 동그라미가 가져감
});
