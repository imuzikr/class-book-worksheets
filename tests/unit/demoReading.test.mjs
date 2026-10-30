import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoReadingStates } from "../../lib/demoReading.js";
import { DEMO_ACTIVITY_IDS, DEMO_CLASS_ID, DEMO_STUDENTS } from "../../lib/demoClassroom.js";
import { applyReadingAction, deriveReading, kstToday } from "../../lib/reading.js";

const NOW = "2026-10-30T03:00:00.000Z";
const states = createDemoReadingStates(NOW);

test("15명 각각 1~2권과 실제 독서 기록·감상을 가진 독립 서재", () => {
  assert.deepEqual(Object.keys(states), DEMO_STUDENTS.map((student) => student.uid));
  assert.equal(Object.values(states).reduce((sum, state) => sum + state.books.length, 0), 24);
  for (const state of Object.values(states)) {
    assert.ok(state.books.length >= 1 && state.books.length <= 2);
    assert.ok(state.logs.length >= 3);
    assert.ok(state.reviews.length >= 1);
    assert.equal(state.books[0].title, "바람을 모으는 도서관");
    assert.equal(state.books[0].activityId, DEMO_ACTIVITY_IDS.kwls);
    assert.ok(!("xp" in state) && !("level" in state) && !("badges" in state));
    assert.equal(new Set(state.books.map((book) => book.id)).size, state.books.length);
    assert.equal(new Set(state.logs.map((log) => log.id)).size, state.logs.length);
    assert.equal(new Set(state.reviews.map((review) => review.bookId)).size, state.reviews.length);
  }
});

test("모든 서재 기록은 체험반·실존 도서와 연결되고 날짜와 쪽 범위가 유효", () => {
  for (const state of Object.values(states)) {
    const books = new Map(state.books.map((book) => [book.id, book]));
    for (const record of [...state.logs, ...state.reviews]) {
      assert.equal(record.classId, DEMO_CLASS_ID);
      assert.ok(books.has(record.bookId));
      assert.ok(kstToday(record.createdAt) <= kstToday(NOW));
    }
    for (const book of state.books) {
      const logs = state.logs.filter((log) => log.bookId === book.id).sort((a, b) => a.startPage - b.startPage);
      assert.ok(logs.length > 0);
      let last = 0;
      for (const log of logs) {
        assert.ok(log.startPage > last && log.endPage >= log.startPage && log.endPage <= book.totalPages);
        assert.ok(log.date <= kstToday(NOW));
        assert.ok(log.date >= "2026-10-03");
        assert.ok(log.notes.trim().length > 30);
        last = log.endPage;
      }
    }
    for (const review of state.reviews) assert.ok(review.text.trim().length > 50 && review.rating >= 1 && review.rating <= 5);
  }
});

test("완독·진행·멈춤, 여러 레벨과 뱃지는 실제 규칙으로 계산", () => {
  const summaries = Object.values(states).map((state) => deriveReading(state, NOW));
  const statuses = new Set(summaries.flatMap((summary) => summary.books.map((book) => book.status)));
  assert.deepEqual(statuses, new Set(["completed", "reading", "paused"]));
  assert.ok(new Set(summaries.map((summary) => summary.level)).size >= 3);
  assert.ok(summaries.some((summary) => summary.currentStreak >= 14));
  for (const summary of summaries) {
    assert.ok(summary.xp > 0);
    assert.equal(summary.totalPages, summary.logs.reduce((sum, log) => sum + log.endPage - log.startPage + 1, 0));
    assert.equal(summary.totalBooks, summary.books.filter((book) => book.status === "completed").length);
    assert.equal(summary.classScores[DEMO_CLASS_ID].allTime, summary.xp);
    assert.ok(summary.featuredBadge?.earned);
    assert.ok(summary.earnedBadges.every((badge) => !["completion_2", "completion_3", "shelf_2", "shelf_3", "review_2", "review_3"].includes(badge.id)));
  }
});

test("생성한 기록도 실제 수정·삭제 규칙을 통해 정정할 수 있음", () => {
  const [uid, original] = Object.entries(states)[0];
  const log = original.logs[0];
  const corrected = applyReadingAction(original, { type: "updateLog", logId: log.id, notes: "다시 읽고 생각한 내용을 덧붙였어요." }, {
    uid, classId: DEMO_CLASS_ID, now: NOW, id: "demo_note_correction",
  });
  assert.equal(deriveReading(corrected, NOW).xp, deriveReading(original, NOW).xp);
  const deleted = applyReadingAction(corrected, { type: "deleteLog", logId: log.id }, {
    uid, classId: DEMO_CLASS_ID, now: NOW, id: "demo_log_deletion",
  });
  assert.equal(deleted.logs.length, original.logs.length - 1);
  assert.ok(deriveReading(deleted, NOW).xp < deriveReading(original, NOW).xp);
});

test("같은 기준 시각은 재현 가능하고 호출 간 배열·객체를 공유하지 않음", () => {
  const first = createDemoReadingStates(NOW);
  const second = createDemoReadingStates(NOW);
  assert.deepEqual(first, second);
  first[DEMO_STUDENTS[0].uid].books[0].title = "수정한 제목";
  assert.equal(second[DEMO_STUDENTS[0].uid].books[0].title, "바람을 모으는 도서관");
  assert.ok(Buffer.byteLength(JSON.stringify(second), "utf8") < 750000);
});

test("한국 날짜가 넘어간 직후에도 오늘 기록과 감상이 미래가 되지 않음", () => {
  const now = "2026-10-29T15:01:00.000Z";
  const fixture = createDemoReadingStates(now);
  for (const state of Object.values(fixture)) {
    assert.ok(state.logs.every((log) => log.date <= "2026-10-30" && new Date(log.createdAt) <= new Date(now)));
    assert.ok(state.reviews.every((review) => new Date(review.createdAt) <= new Date(now)));
  }
  assert.ok(fixture[DEMO_STUDENTS[0].uid].logs.some((log) => log.date === "2026-10-30"));
});
