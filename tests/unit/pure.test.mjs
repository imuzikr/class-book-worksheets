// lib/의 순수 함수들 — CLAUDE.md에 '이래야 한다'로 적어 둔 규칙을 그대로 시험으로.
// 한 줄 규칙이 문서에만 있으면 고치는 사람이 못 보고 지나갑니다.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

// chatTime(null)이 '지금'을 돌려주는지 보려면 '지금'이 정해져 있어야 합니다.
const NOW = new Date(2026, 8, 25, 10, 0, 0);
mock.timers.enable({ apis: ["Date"], now: NOW });

const { toDate, todayDateKey, formatClockMs, formatStampMs } = await import("@/lib/dates");
const { cellIndexOfWord } = await import("@/lib/consonants");
const { chatTime } = await import("@/lib/messenger");

// ── 날짜 ─────────────────────────────────────────────────────
test("todayDateKey는 두 자리로 채운 YYYY-MM-DD", () => {
  assert.equal(todayDateKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(todayDateKey(), "2026-09-25");
});

test("toDate는 Firestore Timestamp·Date·문자열을 모두 받습니다", () => {
  const d = new Date(2026, 8, 1);
  assert.equal(toDate({ toDate: () => d }), d);
  assert.equal(toDate(d), d);
  assert.equal(toDate("2026-09-01T00:00:00Z").toISOString(), "2026-09-01T00:00:00.000Z");
});

test("밀리초 시각: 세 자리를 손으로 붙이고, 값이 없으면 지어내지 않습니다", () => {
  const d = new Date(2026, 8, 22, 9, 3, 7, 48);
  assert.equal(formatClockMs(d), "09:03:07.048");
  assert.match(formatStampMs(d), /09:03:07\.048$/);
  // serverTimestamp()가 아직 null인 순간 — '지금'의 밀리초를 찍으면 안 됩니다.
  assert.equal(formatClockMs(null), "");
  assert.equal(formatStampMs(undefined), "");
});

// ── 닿소리 칸 고르기 ─────────────────────────────────────────
test("쌍자음은 홑자음 칸, 한글로 시작하지 않으면 -1", () => {
  assert.equal(cellIndexOfWord("까치"), 0); // ㄱ
  assert.equal(cellIndexOfWord("땅"), 2); // ㄷ
  assert.equal(cellIndexOfWord("쓰레기"), 6); // ㅅ
  assert.equal(cellIndexOfWord("짜장"), 8); // ㅈ
  assert.equal(cellIndexOfWord("하늘"), 13); // ㅎ
  assert.equal(cellIndexOfWord("AI"), -1);
  assert.equal(cellIndexOfWord(""), -1);
});

// ── 메신저 말의 시각 ─────────────────────────────────────────
test("chatTime: 서버 시각이 아직 없으면 0이 아니라 '지금'", () => {
  // 0으로 치면 방금 보낸 말이 대화 맨 위로 튀었다가 내려앉습니다.
  assert.equal(chatTime(null), NOW.getTime());
});
