import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialReadingState, applyReadingAction, deriveReading, READING_BADGES,
  kstToday, readingPeriodKey, readingEnabled, getExpForReadingLevel, getReadingLevel, READING_LEVEL_MAX,
  teacherBookAction, bookPagesFloor, TEACHER_BOOK_FIELDS,
} from "../../lib/reading.js";

const NOW = "2026-10-29T03:00:00.000Z";
const context = (id, extra = {}) => ({ uid: "student", classId: "classA", now: NOW, id, ...extra });
const book = (state, id = "book1", pages = 100, title = id) => applyReadingAction(state, { type: "addBook", title, author: "작가", totalPages: pages }, context(id));
const log = (state, id, startPage, endPage, date = "2026-10-29", extra = {}) => applyReadingAction(state, {
  type: "addLog", bookId: "book1", date, startPage, endPage, notes: "읽은 내용을 생각했어요.", ...extra,
}, context(id));
const review = (state, bookId = "book1", extra = {}) => applyReadingAction(state, {
  type: "saveReview", bookId, text: "인물의 선택을 돌아보았어요.", rating: 4, ...extra,
}, context(`review-${bookId}`));

// UI gating must be strict even before settings arrive.
test("책 봄은 명시적으로 켠 운영 반에서만 활성화", () => {
  for (const value of [undefined, null, {}, { readingEnabled: "true" }, { readingEnabled: false }, { readingEnabled: true, archived: true }]) assert.equal(readingEnabled(value), false);
  assert.equal(readingEnabled({ readingEnabled: true }), true);
});

test("한국 시간 날짜와 주·월 경계는 호스트 시간대와 무관", () => {
  assert.equal(kstToday("2026-10-28T14:59:59Z"), "2026-10-28");
  assert.equal(kstToday("2026-10-28T15:00:00Z"), "2026-10-29");
  assert.equal(readingPeriodKey("weekly", "2026-11-01T14:59:00Z"), "2026-10-26");
  assert.equal(readingPeriodKey("weekly", "2026-11-01T15:00:00Z"), "2026-11-02");
  assert.equal(readingPeriodKey("monthly", "2026-10-31T15:00:00Z"), "2026-11");
});

test("레벨은 누적 경계값으로 판정", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(getExpForReadingLevel), [0, 100, 250, 500, 1000, 1500, 2250]);
  assert.deepEqual([0, 99, 100, 249, 250, 999, 1000, 1500].map(getReadingLevel), [1, 1, 2, 2, 3, 4, 5, 6]);
  assert.equal(getReadingLevel(-50), 1);
});

test("레벨은 10이 끝 — 표는 그대로이고 그 위로는 오르지 않는다(선생님 결정 · 한 학기)", () => {
  assert.equal(READING_LEVEL_MAX, 10);
  assert.deepEqual([8, 9, 10].map(getExpForReadingLevel), [3375, 5063, 7595]);
  // 11레벨 이상은 없으므로 10레벨 값 — '다음 레벨까지'는 최고 레벨인지 먼저 봅니다.
  for (const level of [11, 12, 100, 1e9]) assert.equal(getExpForReadingLevel(level), 7595);
  assert.deepEqual([5062, 5063, 7594, 7595, 11393, 1e9, Number.MAX_VALUE].map(getReadingLevel), [8, 9, 9, 10, 10, 10, 10]);
});

test("최고 레벨이면 다음 레벨까지 0 · 진행 100이고 경험치는 계속 쌓인다", () => {
  let state = book(initialReadingState(), "book1", 9000);
  state = log(state, "first", 1, 7000, "2026-10-28");
  const below = deriveReading(state, NOW);
  assert.equal(below.level, 9);
  assert.equal(below.maxLevel, false);
  assert.equal(below.nextXp, 7595);
  assert.equal(below.expToNextLevel, 7595 - below.xp);
  assert.ok(below.progress > 0 && below.progress < 100);
  state = log(state, "second", 7001, 9000);
  const top = deriveReading(state, NOW);
  assert.equal(top.level, 10);
  assert.equal(top.maxLevel, true);
  assert.ok(top.xp > below.xp + 2000);
  assert.equal(top.nextXp, getExpForReadingLevel(10));
  assert.equal(top.expToNextLevel, 0);
  assert.equal(top.progress, 100);
});

test("초기 상태와 6개 시리즈의 세 단계 뱃지 정의", () => {
  const a = initialReadingState(); const b = initialReadingState();
  a.books.push({}); assert.equal(b.books.length, 0);
  assert.equal(READING_BADGES.length, 18);
  assert.equal(new Set(READING_BADGES.map((badge) => badge.id)).size, 18);
  assert.deepEqual(READING_BADGES.filter((badge) => badge.series === "completion").map((badge) => badge.threshold), [1, 3, 5]);
  assert.ok(READING_BADGES.every((badge) => [1, 2, 3].includes(badge.tier)));
});

test("책 등록만으로는 경험치나 '독자의 길' 뱃지를 지급하지 않음", () => {
  const state = book(initialReadingState());
  const summary = deriveReading(state, NOW);
  assert.equal(summary.xp, 0); assert.equal(summary.earnedBadges.length, 0);
  assert.equal(summary.books[0].status, "reading"); assert.equal(summary.books[0].progress, 0);
});

test("독서 기록은 불변 상태로 보존하고 같은 날 연속 보너스는 한 번만 지급", () => {
  const original = book(initialReadingState());
  const first = log(original, "log1", 1, 10);
  const second = log(first, "log2", 11, 20);
  assert.equal(original.logs.length, 0); assert.equal(first.logs.length, 1);
  const summary = deriveReading(second, NOW);
  assert.equal(summary.totalPages, 20); assert.equal(summary.startedBooks, 1);
  assert.equal(summary.xp, 20 + 15 + 20); // pages + one day + beginner shelf
  assert.equal(summary.events.filter((event) => event.kind === "streak").length, 1);
});

test("중복 페이지·잘못된 날짜·페이지·감상은 거부", () => {
  const state = log(book(initialReadingState()), "log1", 1, 10);
  assert.throws(() => log(state, "log2", 5, 15), /겹쳐/);
  for (const date of ["2026-02-30", "2026-2-01", "2026-10-30", "not-a-date"]) assert.throws(() => log(state, "x", 11, 12, date), /날짜/);
  for (const range of [[0, 4], [20, 10], [10, 101], [11.5, 13], [true, 12]]) assert.throws(() => log(state, "x", ...range));
  assert.throws(() => log(state, "x", 11, 12, "2026-10-29", { notes: " " }), /감상/);
  assert.throws(() => log(state, "x", 11, 12, "2026-10-29", { notes: "가".repeat(2001) }), /2000/);
});

test("같은 요청 ID는 재시도해도 다시 저장·지급하지 않음", () => {
  const state = log(book(initialReadingState()), "log1", 1, 10);
  const retried = log(state, "log1", 1, 10);
  assert.strictEqual(retried, state);
  assert.equal(deriveReading(retried, NOW).xp, deriveReading(state, NOW).xp);
});

test("책 제목·저자 정규화 중복과 보관 후 재등록을 차단", () => {
  const state = book(initialReadingState(), "book1", 100, "동물 농장");
  assert.throws(() => book(state, "other", 100, "  동물   농장  "), /이미/);
  const archived = applyReadingAction(state, { type: "archiveBook", bookId: "book1" }, context("archive"));
  assert.throws(() => book(archived, "other", 100, "동물 농장"), /이미/);
  assert.throws(() => log(archived, "x", 1, 10), /보관/);
  const restored = applyReadingAction(archived, { type: "archiveBook", bookId: "book1", archived: false }, context("restore"));
  assert.equal(restored.books[0].archived, false);
});

test("완독은 쪽 범위 전체를 채워야 인정하며 상태 조작으로 만들지 못함", () => {
  let state = log(book(initialReadingState()), "last", 100, 100);
  let summary = deriveReading(state, NOW);
  assert.equal(summary.totalBooks, 0); assert.equal(summary.books[0].progress, 1);
  state = log(state, "rest", 1, 99);
  summary = deriveReading(state, NOW);
  assert.equal(summary.totalBooks, 1); assert.equal(summary.books[0].status, "completed");
  assert.equal(summary.books[0].progress, 100);
  assert.throws(() => applyReadingAction(state, { type: "updateBook", bookId: "book1", status: "completed" }, context("x")), /자동/);
  assert.throws(() => applyReadingAction(state, { type: "updateBook", bookId: "book1", totalPages: 99 }, context("x")), /전체 쪽수/);
});

test("한 번에 완독(1쪽~마지막 쪽 발자국 하나) — 완독으로 셈하고 같은 감상을 '한 권의 책'에도 남김(선생님 요청)", async () => {
  const { wholeBookReviewPlan, coversWholeBook } = await import("@/lib/reading");
  let state = book(initialReadingState(), "book1", 114);
  state = log(state, "whole", 1, 114, "2026-10-29", { notes: "한 번에 다 읽었어요. 마지막 장면이 오래 남아요.", rating: 4 });
  const summary = deriveReading(state, NOW);
  assert.equal(summary.books[0].status, "completed"); // 완독은 읽은 쪽으로 저절로
  assert.equal(summary.totalBooks, 1);
  assert.equal(state.reviews.length, 1);
  assert.deepEqual(
    (({ id, bookId, classId, text, rating, fromLogId }) => ({ id, bookId, classId, text, rating, fromLogId }))(state.reviews[0]),
    { id: "whole-rv", bookId: "book1", classId: "classA", text: "한 번에 다 읽었어요. 마지막 장면이 오래 남아요.", rating: 4, fromLogId: "whole" },
  );
  assert.equal(summary.reviewCount, 1); // '한 권의 책' 70 EXP도 함께(직접 썼을 때와 같은 셈)
  assert.ok(summary.events.some((e) => e.kind === "review" && e.bookId === "book1" && e.xp === 70));
  // 별점을 고르지 않으면 5 · 1~5가 아니면 거부
  const plain = log(book(initialReadingState(), "book1", 30), "w2", 1, 30);
  assert.equal(plain.reviews[0].rating, 5);
  assert.throws(() => log(book(initialReadingState(), "book1", 30), "w3", 1, 30, "2026-10-29", { rating: 6 }), /별점/);
  // 같은 요청을 다시 보내도 하나뿐
  assert.equal(log(state, "whole", 1, 114).reviews.length, 1);
  // 셈의 이름표
  assert.equal(coversWholeBook({ startPage: 1, endPage: 114 }, { totalPages: 114 }), true);
  assert.equal(coversWholeBook({ startPage: 2, endPage: 114 }, { totalPages: 114 }), false);
  assert.equal(coversWholeBook({ startPage: 1, endPage: 113 }, { totalPages: 114 }), false);
  assert.equal(wholeBookReviewPlan({ book: { id: "b", totalPages: 10 }, after: { startPage: 1, endPage: 10 } }), "create");
  assert.equal(wholeBookReviewPlan({ book: { id: "b", totalPages: 10, archived: true }, after: { startPage: 1, endPage: 10 } }), null);
  assert.equal(wholeBookReviewPlan({ book: { id: "b", totalPages: 10 }, after: { startPage: 1, endPage: 10 }, reviews: Array.from({ length: 100 }, (_, i) => ({ bookId: `x${i}` })) }), null); // 가득 참
  assert.equal(wholeBookReviewPlan({ book: null, after: { startPage: 1, endPage: 10 } }), null);
});

test("한 번에 완독이 아니면(나눠 읽기) '한 권의 책'을 저절로 만들지 않고, 이미 있으면 그대로", () => {
  // 나눠 읽어 마지막 발자국으로 완독 — 완독은 되지만 '한 권의 책'은 학생이 직접(지금처럼)
  let split = log(book(initialReadingState(), "book1", 100), "a", 1, 50);
  split = log(split, "b", 51, 100);
  assert.equal(deriveReading(split, NOW).books[0].status, "completed");
  assert.equal(split.reviews.length, 0);
  // 전에 써 둔 '한 권의 책'이 있으면 새로 만들지도 덮어쓰지도 않음
  let written = review(book(initialReadingState(), "book1", 20));
  written = log(written, "whole", 1, 20, "2026-10-29", { notes: "새 감상" });
  assert.equal(written.reviews.length, 1);
  assert.equal(written.reviews[0].text, "인물의 선택을 돌아보았어요.");
  assert.equal(written.reviews[0].fromLogId, undefined);
  // 발자국을 지워도 그 글은 남음(함께 남긴 글이 아니므로)
  written = applyReadingAction(written, { type: "deleteLog", logId: "whole" }, context("del"));
  assert.equal(written.reviews.length, 1);
});

test("함께 남긴 '한 권의 책'은 발자국을 따라감 — 감상을 고치면 같은 글로, 한 번에 완독이 아니게 고치거나 지우면 글은 그대로 두고 따로", () => {
  let state = log(book(initialReadingState(), "book1", 40), "whole", 1, 40, "2026-10-29", { notes: "처음 감상", rating: 3 });
  // 감상을 고치면 함께 남긴 글도 같은 글로(별점은 그대로)
  state = applyReadingAction(state, { type: "updateLog", logId: "whole", notes: "고친 감상" }, context("e1"));
  assert.deepEqual([state.reviews[0].text, state.reviews[0].rating, state.reviews[0].fromLogId], ["고친 감상", 3, "whole"]);
  // 날짜만 고치면 글은 그대로
  state = applyReadingAction(state, { type: "updateLog", logId: "whole", date: "2026-10-28" }, context("e2"));
  assert.equal(state.reviews[0].text, "고친 감상");
  // 마지막 쪽을 줄여 완독이 아니게 되어도 '한 권의 책'은 지우지 않음 — 이음만 풀림(지울 수 없고 고쳐쓰기만 · 선생님 요청)
  const shrunk = applyReadingAction(state, { type: "updateLog", logId: "whole", endPage: 14 }, context("e3"));
  assert.deepEqual([shrunk.reviews.length, shrunk.reviews[0].text, shrunk.reviews[0].rating, "fromLogId" in shrunk.reviews[0]], [1, "고친 감상", 3, false]);
  assert.equal(deriveReading(shrunk, NOW).books[0].status, "reading");
  assert.equal(deriveReading(shrunk, NOW).reviewCount, 1);
  // 따로 남은 뒤에는 발자국 감상을 고쳐도 그대로 · 다시 끝까지가 되어도 새로 만들거나 덮어쓰지 않음(이미 있음)
  let after = applyReadingAction(shrunk, { type: "updateLog", logId: "whole", notes: "또 고친 감상" }, context("e4"));
  after = applyReadingAction(after, { type: "updateLog", logId: "whole", endPage: 40, rating: 2 }, context("e5"));
  assert.deepEqual(after.reviews.map((r) => [r.text, r.rating, "fromLogId" in r]), [["고친 감상", 3, false]]);
  // 이어진 채로 발자국을 지워도 '한 권의 책'은 남음(이음만 풀림)
  const linked = log(book(initialReadingState(), "book1", 40), "w2", 1, 40, "2026-10-29", { notes: "지울 발자국" });
  const removed = applyReadingAction(linked, { type: "deleteLog", logId: "w2" }, context("e6"));
  assert.deepEqual([removed.logs.length, removed.reviews.length, removed.reviews[0].text, "fromLogId" in removed.reviews[0]], [0, 1, "지울 발자국", false]);
  assert.equal(deriveReading(removed, NOW).reviewCount, 1);
});

test("학생이 '한 권의 책'을 직접 고치면 이음이 풀려 따로 — 발자국을 고치거나 지워도 그대로", async () => {
  const { wholeBookReviewPlan } = await import("@/lib/reading");
  let state = log(book(initialReadingState(), "book1", 40), "whole", 1, 40, "2026-10-29", { notes: "발자국 감상" });
  state = review(state, "book1", { text: "따로 다듬은 한 권의 책", rating: 5 });
  assert.equal(state.reviews[0].fromLogId, undefined);
  assert.equal(state.reviews[0].id, "whole-rv"); // 같은 글을 고친 것 — id는 그대로
  state = applyReadingAction(state, { type: "updateLog", logId: "whole", notes: "발자국만 고침" }, context("e1"));
  assert.equal(state.reviews[0].text, "따로 다듬은 한 권의 책");
  state = applyReadingAction(state, { type: "updateLog", logId: "whole", endPage: 20 }, context("e2"));
  assert.equal(state.reviews.length, 1);
  state = applyReadingAction(state, { type: "deleteLog", logId: "whole" }, context("e3"));
  assert.deepEqual(state.reviews.map((r) => r.text), ["따로 다듬은 한 권의 책"]);
  // 계획 셈 — 이어진 글: 끝까지면 sync, 아니면 detach(지우기 없음)
  const linkedReviews = [{ bookId: "b", fromLogId: "l1" }];
  const b = { id: "b", totalPages: 10 };
  assert.equal(wholeBookReviewPlan({ book: b, before: { id: "l1", startPage: 1, endPage: 10 }, after: { startPage: 1, endPage: 10 }, reviews: linkedReviews }), "sync");
  assert.equal(wholeBookReviewPlan({ book: b, before: { id: "l1", startPage: 1, endPage: 10 }, after: { startPage: 1, endPage: 9 }, reviews: linkedReviews }), "detach");
  assert.equal(wholeBookReviewPlan({ book: b, before: { id: "l1", startPage: 1, endPage: 10 }, after: null, reviews: linkedReviews }), "detach");
});

test("'한 권의 책'은 지울 수 없고 고쳐쓰기만 — 지우기 요청은 어느 반에서 와도 거절(선생님 요청)", () => {
  let state = review(log(book(initialReadingState(), "book1", 10), "a", 1, 5));
  for (const action of [{ type: "deleteReview", bookId: "book1" }, { type: "deleteReview", reviewId: state.reviews[0].id }, { type: "deleteReview", bookId: "none" }]) {
    assert.throws(() => applyReadingAction(state, action, context("del")), /지울 수 없어요/);
    assert.throws(() => applyReadingAction(state, action, context("del", { classId: "classB" })), /지울 수 없어요/);
  }
  state = review(state, "book1", { text: "고쳐 쓴 생각", rating: 3 });
  assert.deepEqual([state.reviews.length, state.reviews[0].text, state.reviews[0].rating], [1, "고쳐 쓴 생각", 3]);
});

test("기록 수정·삭제는 XP와 진행률·완독·대표 뱃지까지 함께 정정", () => {
  // 두 번에 나눠 읽어 완독 — 한 번에 완독한 발자국이면 지울 수 없는 '한 권의 책'이 함께 남아(위 시험) 경험치가 0으로 돌아가지 않음
  let state = log(book(initialReadingState(), "book1", 10), "log1", 1, 5);
  state = log(state, "log2", 6, 10);
  assert.equal(state.reviews.length, 0);
  state = applyReadingAction(state, { type: "setFeaturedBadge", badgeId: "completion_1" }, context("featured"));
  assert.equal(state.featuredBadge, "completion_1");
  const corrected = applyReadingAction(state, { type: "updateLog", logId: "log2", endPage: 8 }, context("edit"));
  assert.equal(corrected.featuredBadge, null);
  assert.equal(deriveReading(corrected, NOW).totalBooks, 0);
  assert.equal(deriveReading(corrected, NOW).totalPages, 8);
  let removed = applyReadingAction(corrected, { type: "deleteLog", logId: "log1" }, context("delete"));
  removed = applyReadingAction(removed, { type: "deleteLog", logId: "log2" }, context("delete2"));
  assert.equal(deriveReading(removed, NOW).xp, 0); assert.equal(removed.logs.length, 0);
});

test("기록 정정 시 겹침 검사는 자기 기록만 제외", () => {
  let state = log(book(initialReadingState()), "a", 1, 10);
  state = log(state, "b", 11, 20);
  assert.throws(() => applyReadingAction(state, { type: "updateLog", logId: "a", endPage: 11 }, context("edit")), /겹쳐/);
  const edited = applyReadingAction(state, { type: "updateLog", logId: "a", notes: "새 감상" }, context("edit"));
  assert.equal(edited.logs[0].notes, "새 감상");
});

test("책당 첫 감상문 보상만 인정하고 수정해도 중복 지급하지 않음", () => {
  let state = review(book(initialReadingState()));
  const firstXp = deriveReading(state, NOW).xp;
  state = review(state, "book1", { text: "수정한 생각" });
  assert.equal(state.reviews.length, 1); assert.equal(deriveReading(state, NOW).xp, firstXp);
  assert.equal(firstXp, 70 + 20); // review + review beginner badge
  // '한 권의 책'은 지울 수 없음 — 받은 보상도 그대로(고쳐쓰기만)
  assert.throws(() => applyReadingAction(state, { type: "deleteReview", bookId: "book1" }, context("delete")), /지울 수 없어요/);
  assert.equal(deriveReading(state, NOW).xp, firstXp);
});

test("다른 반에서 쓴 기록·감상문을 우회 수정할 수 없음", () => {
  const state = review(log(book(initialReadingState()), "a", 1, 10));
  for (const action of [
    { type: "updateLog", logId: "a", notes: "바꿈" },
    { type: "deleteLog", logId: "a" },
    { type: "saveReview", bookId: "book1", text: "바꿈", rating: 4 },
  ]) assert.throws(() => applyReadingAction(state, action, context("x", { classId: "classB" })), /작성한 반/);
});

test("소급 기록은 날짜 순서로 연속일과 하루 보너스를 재계산", () => {
  let state = book(initialReadingState());
  state = log(state, "a", 1, 10, "2026-10-27");
  state = log(state, "c", 21, 30, "2026-10-29");
  assert.equal(deriveReading(state, NOW).longestStreak, 1);
  state = log(state, "b", 11, 20, "2026-10-28");
  const summary = deriveReading(state, NOW);
  assert.equal(summary.currentStreak, 3); assert.equal(summary.longestStreak, 3);
  assert.deepEqual(summary.events.filter((event) => event.kind === "streak").map((event) => event.xp), [15, 30, 45]);
  assert.equal(summary.badges.find((badge) => badge.id === "streak_1").earned, true);
  const later = deriveReading(state, "2026-11-02T00:00:00Z");
  assert.equal(later.currentStreak, 0); assert.equal(later.longestStreak, 3);
  assert.equal(later.badges.find((badge) => badge.id === "streak_1").earned, true);
});

test("월간 뱃지는 월 경계를 합치지 않고 지난 달 달성 이력을 유지", () => {
  let state = book(initialReadingState(), "book1", 1000);
  state = log(state, "sep", 1, 80, "2026-09-30");
  state = log(state, "oct", 81, 110, "2026-10-01");
  assert.equal(deriveReading(state, NOW).badges.find((badge) => badge.id === "pages_1").earned, false);
  state = log(state, "oct2", 111, 180, "2026-10-02");
  assert.equal(deriveReading(state, NOW).bestMonthPages, 100);
  const later = deriveReading(state, "2026-11-10T00:00:00Z");
  assert.equal(later.monthPages, 0); assert.equal(later.badges.find((badge) => badge.id === "pages_1").earned, true);
});

test("고급 완독 뱃지는 하위 단계도 부여하며 뱃지 XP로 열린 레벨도 한 번만 계산", () => {
  let state = initialReadingState();
  for (let i = 1; i <= 5; i += 1) {
    state = book(state, `b${i}`, 100);
    state = log(state, `l${i}`, 1, 100, "2026-10-29", { bookId: `b${i}` });
  }
  const summary = deriveReading(state, NOW);
  assert.deepEqual(summary.badges.filter((badge) => badge.series === "completion" && badge.earned).map((badge) => badge.tier), [1, 2, 3]);
  assert.equal(new Set(summary.events.map((event) => event.id)).size, summary.events.length);
  assert.equal(summary.events.reduce((sum, event) => sum + event.xp, 0), summary.xp);
  assert.equal(summary.level, getReadingLevel(summary.xp));
  assert.deepEqual(deriveReading(state, NOW), summary);
});

test("기간별 반 점수는 귀속 이벤트만 합산하고 월요일에 주간 점수를 초기화", () => {
  let state = book(initialReadingState());
  state = log(state, "sunday", 1, 10, "2026-10-25");
  state = applyReadingAction(state, { type: "addLog", bookId: "book1", date: "2026-10-26", startPage: 11, endPage: 20, notes: "월요일" }, context("monday", { classId: "classB" }));
  const summary = deriveReading(state, NOW);
  assert.equal(summary.classScores.classA.weekly, 0);
  assert.equal(summary.classScores.classB.weekly, 10 + 30);
  assert.equal(summary.classScores.classA.allTime + summary.classScores.classB.allTime, summary.xp);
  assert.equal(summary.classScores.classB.daily, 0);
});

test("알 수 없는 요청과 뱃지 선택을 거부하고 입력 경계를 검증", () => {
  const state = book(initialReadingState());
  assert.throws(() => applyReadingAction(state, { type: "setFeaturedBadge", badgeId: "completion_3" }, context("x")), /획득한/);
  assert.throws(() => applyReadingAction(state, { type: "resetXp", xp: 9999 }, context("x")), /지원하지/);
  for (const pages of [0, -1, NaN, Infinity, "", null, true, 1.5]) assert.throws(() => book(initialReadingState(), "x", pages));
  assert.throws(() => applyReadingAction(initialReadingState(), { type: "addBook", title: "책", author: "작가", totalPages: 10, coverImage: "javascript:alert(1)" }, context("x")), /HTTPS/);
});

test("이전 자료에 겹친 범위가 있어도 쪽수를 중복 집계하지 않음", () => {
  const state = book(initialReadingState());
  state.logs = [
    { id: "a", bookId: "book1", classId: "classA", date: "2026-10-29", startPage: 1, endPage: 20 },
    { id: "b", bookId: "book1", classId: "classA", date: "2026-10-29", startPage: 10, endPage: 30 },
  ];
  assert.equal(deriveReading(state, NOW).totalPages, 30);
});


test("도서 활동 연결은 선택 메타데이터이며 경험치를 추가하지 않음", () => {
  const state = applyReadingAction(initialReadingState(), { type: "addBook", title: "책", author: "작가", totalPages: 50, activityId: "activity-1" }, context("book1"));
  assert.equal(state.books[0].activityId, "activity-1");
  const linked = applyReadingAction(state, { type: "updateBook", bookId: "book1", activityId: "activity-2" }, context("edit"));
  assert.equal(linked.books[0].activityId, "activity-2");
  assert.equal(deriveReading(linked, NOW).xp, 0);
  assert.throws(() => applyReadingAction(linked, { type: "updateBook", bookId: "book1", activityId: "../unsafe" }, context("edit")), /식별자/);
  const unlinked = applyReadingAction(linked, { type: "updateBook", bookId: "book1", activityId: null }, context("edit"));
  assert.equal(unlinked.books[0].activityId, null);
});


test("기록이 생긴 책의 전체 쪽수는 다른 활성 반에서도 바꿔 보상을 재판정하지 못함", () => {
  const state = log(book(initialReadingState(), "book1", 100), "classA-log", 1, 50);
  const before = deriveReading(state, NOW);
  assert.equal(before.totalBooks, 0);
  for (const classId of ["classA", "classB"]) {
    assert.throws(() => applyReadingAction(state, {
      type: "updateBook", bookId: "book1", totalPages: 50,
    }, context("edit", { classId })), /독서 기록이 있는 책의 전체 쪽수는 변경할 수 없어요/);
    assert.throws(() => applyReadingAction(state, {
      type: "updateBook", bookId: "book1", totalPages: 200,
    }, context("edit", { classId })), /전체 쪽수/);
  }
  assert.equal(state.books[0].totalPages, 100);
  assert.equal(deriveReading(state, NOW).xp, before.xp);
  const titled = applyReadingAction(state, { type: "updateBook", bookId: "book1", title: "바뀐 제목", totalPages: 100 }, context("edit", { classId: "classB" }));
  assert.equal(titled.books[0].title, "바뀐 제목");
  assert.equal(deriveReading(titled, NOW).xp, before.xp);
});

test("감상문만 있는 책도 전체 쪽수를 고정하고 아직 기록 없는 책은 수정 가능", () => {
  const empty = book(initialReadingState(), "book1", 100);
  const resized = applyReadingAction(empty, { type: "updateBook", bookId: "book1", totalPages: 120 }, context("edit"));
  assert.equal(resized.books[0].totalPages, 120);
  const reviewed = review(empty);
  assert.throws(() => applyReadingAction(reviewed, { type: "updateBook", bookId: "book1", totalPages: 120 }, context("edit")), /전체 쪽수/);
});

// 선생님 고치기(context.byTeacher — 담당 교사가 학생의 책 정보를 고칠 때 · 선생님 요청 · 2026년 11월)
const teacherCtx = (id, extra = {}) => context(id, { byTeacher: true, ...extra });

test("선생님 고치기 — 기록이 있어도 쪽수 · 제목 · 지은이를 고치고, 완독 · 경험치는 새 쪽수로 다시 셈", () => {
  // 240쪽 책을 24쪽으로 잘못 적고 1~24쪽을 읽어 '완독' · 한 번에 완독의 '한 권의 책'까지 생긴 학생
  let state = book(initialReadingState(), "book1", 24, "싯타르타");
  state = log(state, "whole", 1, 24, "2026-10-29", { rating: 5 });
  const before = deriveReading(state, NOW);
  assert.equal(before.totalBooks, 1);
  assert.equal(state.reviews[0].fromLogId, "whole");
  // 학생은 여전히 막힘
  assert.throws(() => applyReadingAction(state, { type: "updateBook", bookId: "book1", totalPages: 240 }, context("edit")), /전체 쪽수/);
  // 선생님은 고침 — 완독이 풀리고(10%) '한 권의 책'은 그대로 남되 발자국과의 이음만 풀림
  const fixed = applyReadingAction(state, teacherBookAction({ type: "updateBook", bookId: "book1", title: "싯다르타", author: "헤르만 헤세", totalPages: 240 }), teacherCtx("t-edit"));
  const after = deriveReading(fixed, NOW);
  assert.deepEqual([fixed.books[0].title, fixed.books[0].author, fixed.books[0].totalPages], ["싯다르타", "헤르만 헤세", 240]);
  assert.equal(after.totalBooks, 0);
  assert.deepEqual([after.books[0].status, after.books[0].progress], ["reading", 10]);
  assert.equal(fixed.reviews.length, 1);
  assert.equal(fixed.reviews[0].text, state.reviews[0].text);
  assert.equal(fixed.reviews[0].fromLogId, undefined);
  assert.equal(fixed.logs.length, 1);
  assert.ok(after.xp < before.xp, "완독 뱃지 경험치가 빠짐(읽은 쪽 · 감상 경험치는 그대로)");
  // 기록한 마지막 쪽 아래로는 못 줄임 — 몇 쪽까지인지 알려 줌
  assert.equal(bookPagesFloor(fixed, "book1"), 24);
  assert.equal(bookPagesFloor(fixed, "nothing"), 0);
  assert.throws(() => applyReadingAction(fixed, teacherBookAction({ type: "updateBook", bookId: "book1", totalPages: 20 }), teacherCtx("t-cut")), /24쪽까지/);
  // 다시 24쪽으로 되돌리면 완독 — 이음은 다시 걸지 않음(새 글도 만들지 않음)
  const back = applyReadingAction(fixed, teacherBookAction({ type: "updateBook", bookId: "book1", totalPages: 24 }), teacherCtx("t-back"));
  assert.equal(deriveReading(back, NOW).totalBooks, 1);
  assert.equal(back.reviews.length, 1);
  assert.equal(back.reviews[0].fromLogId, undefined);
});

test("선생님 고치기 — 쪽수가 그대로면 '한 번에 완독'의 이음도 그대로", () => {
  let state = book(initialReadingState(), "book1", 30);
  state = log(state, "whole", 1, 30);
  const titled = applyReadingAction(state, teacherBookAction({ type: "updateBook", bookId: "book1", title: "바른 제목", totalPages: 30 }), teacherCtx("t-title"));
  assert.equal(titled.reviews[0].fromLogId, "whole");
  assert.equal(deriveReading(titled, NOW).xp, deriveReading(state, NOW).xp);
});

test("선생님 고치기 — 읽기 상태 · 활동 연결은 받지 않고, 책 정보 말고 다른 요청은 거절", () => {
  assert.deepEqual([...TEACHER_BOOK_FIELDS], ["title", "author", "totalPages", "publisher", "isbn", "coverImage", "bookLink"]);
  assert.deepEqual(
    teacherBookAction({ type: "updateBook", bookId: "book1", title: "새 제목", totalPages: 50, status: "paused", activityId: "a1", archived: true, extra: 1 }),
    { type: "updateBook", bookId: "book1", title: "새 제목", totalPages: 50 },
  );
  for (const type of ["addBook", "addLog", "updateLog", "deleteLog", "saveReview", "archiveBook", "setFeaturedBadge", "deleteReview"]) {
    assert.throws(() => teacherBookAction({ type, bookId: "book1" }), /책 정보만/);
  }
  assert.throws(() => teacherBookAction(null), /책 정보만/);
  // 셈도 선생님 갈래에서는 status · activityId를 읽지 않음(체험반이 곧바로 부를 때를 위한 이중 확인)
  const state = book(initialReadingState(), "book1", 100);
  const edited = applyReadingAction(state, { type: "updateBook", bookId: "book1", status: "paused", activityId: "a1", title: "바뀐 제목" }, teacherCtx("t"));
  assert.deepEqual([edited.books[0].status, edited.books[0].activityId, edited.books[0].title], ["reading", undefined, "바뀐 제목"]);
  // 같은 책(제목 · 지은이 · ISBN)으로 바꾸는 것은 선생님도 막힘 · 보관된 책은 못 고침
  const two = applyReadingAction(state, { type: "addBook", title: "다른 책", author: "작가", totalPages: 50 }, context("book2"));
  assert.throws(() => applyReadingAction(two, { type: "updateBook", bookId: "book2", title: "book1" }, teacherCtx("t2")), /같은 책/);
  const archived = applyReadingAction(two, { type: "archiveBook", bookId: "book2", archived: true }, context("arch"));
  assert.throws(() => applyReadingAction(archived, { type: "updateBook", bookId: "book2", title: "새" }, teacherCtx("t3")), /보관된 책/);
});

test("검색한 도서 정보(카카오 · 옛 네이버)는 서재 저장·수정 후에도 유지되고 메타데이터만으로 보상하지 않음", () => {
  const metadata = { isbn: "9780306406157", publisher: "출판사", coverImage: "https://shopping-phinf.pstatic.net/book.jpg", bookLink: "https://search.shopping.naver.com/book/catalog/123" };
  const state = applyReadingAction(initialReadingState(), { type: "addBook", title: "검색한 책", author: "저자", totalPages: 200, ...metadata }, context("searched"));
  for (const [key, value] of Object.entries(metadata)) assert.equal(state.books[0][key], value);
  assert.equal(deriveReading(state, NOW).xp, 0);
  const edited = applyReadingAction(state, { type: "updateBook", bookId: "searched", status: "paused" }, context("edit"));
  assert.equal(edited.books[0].isbn, metadata.isbn);
  assert.equal(edited.books[0].coverImage, metadata.coverImage);
  const manual = applyReadingAction(edited, { type: "updateBook", bookId: "searched", title: "다른 직접 입력 책", author: "다른 저자", isbn: "", publisher: "", coverImage: "", bookLink: "" }, context("manual"));
  for (const key of Object.keys(metadata)) assert.equal(manual.books[0][key], undefined);
  assert.equal(state.books[0].isbn, metadata.isbn);
  const kakao = { coverImage: "https://search1.kakaocdn.net/thumb/R120x174/?fname=x", bookLink: "https://search.daum.net/search?w=bookpage&bookId=1" };
  const fromKakao = applyReadingAction(initialReadingState(), { type: "addBook", title: "카카오 책", author: "저자", totalPages: 100, ...kakao }, context("kakao"));
  for (const [key, value] of Object.entries(kakao)) assert.equal(fromKakao.books[0][key], value);
});

test("같은 ISBN의 표기만 다른 검색 도서 중복 등록을 거부", () => {
  const state = applyReadingAction(initialReadingState(), { type: "addBook", title: "원제", author: "저자", totalPages: 100, isbn: "978-0-306-40615-7" }, context("original"));
  assert.equal(state.books[0].isbn, "9780306406157");
  assert.throws(() => applyReadingAction(state, { type: "addBook", title: "원제 (개정 표기)", author: "저자 번역가", totalPages: 100, isbn: "9780306406157" }, context("duplicate")), /이미/);
  let more = book(state, "manual", 100, "다른 책");
  assert.throws(() => applyReadingAction(more, { type: "updateBook", bookId: "manual", isbn: "9780306406157" }, context("merge")), /이미/);
});

test("도서 메타데이터는 잘못된 ISBN·비보안 URL·낯선 도서 링크를 거부", () => {
  for (const fields of [{ isbn: "9780306406158" }, { isbn: "not-isbn" }, { coverImage: "javascript:alert(1)" }, { coverImage: "http://example.com/book.jpg" }, { bookLink: "https://naver.com.evil.test/book" }, { bookLink: "https://user:password@naver.com/book" }, { bookLink: "https://daum.net.evil.test/book" }, { bookLink: "https://example.org/book" }]) {
    assert.throws(() => applyReadingAction(initialReadingState(), { type: "addBook", title: "책", author: "저자", totalPages: 100, ...fields }, context("bad")));
  }
});

test("관리자 설정은 선생님의 모든 반에 한 값 — 도서 검색 · 새 반이 따를 값", async () => {
  const { bookSearchEnabled, teacherFeatureSettings, featuresForNewClass } = await import("@/lib/reading");
  assert.equal(bookSearchEnabled({ readingEnabled: true, bookSearchEnabled: true }), true);
  assert.equal(bookSearchEnabled({ readingEnabled: true }), false); // 기본 꺼짐
  assert.equal(bookSearchEnabled({ readingEnabled: false, bookSearchEnabled: true }), false); // 책 봄이 꺼지면 함께
  assert.equal(bookSearchEnabled({ readingEnabled: true, bookSearchEnabled: true, archived: true }), false);
  const classes = [
    { id: "a", readingEnabled: true, bookSearchEnabled: true },
    { id: "b", readingEnabled: true, rankingEnabled: false },
    { id: "z", archived: true, readingEnabled: false },
  ];
  const s = teacherFeatureSettings(classes);
  assert.deepEqual(s.readingEnabled, { on: true, mixed: false }); // 보관된 반은 안 셈
  assert.deepEqual(s.bookSearchEnabled, { on: false, mixed: true });
  assert.deepEqual(s.rankingEnabled, { on: false, mixed: true });
  assert.deepEqual(s.characterEnabled, { on: true, mixed: false }); // 값이 없으면 켜짐
  assert.deepEqual(s.petEnabled, { on: true, mixed: false }); // 학생 펫도 값이 없으면 켜짐(선생님 결정)
  // 독서 TOP 3도 값이 없으면 켜짐 — 리더보드를 끈 반(b)이어도 TOP 3는 따로(선생님 요청)
  assert.deepEqual(s.readingTopEnabled, { on: true, mixed: false });
  // 펫 먹이는 값이 없으면 꺼짐(켠 것만 true) — 새 반도 그 값과 '배고파지지 않는 날'(쉬는 기간)을 따름
  assert.deepEqual(s.petFeedEnabled, { on: false, mixed: false });
  // 펫 미리보기도 값이 없으면 꺼짐(켠 것만 true)
  assert.deepEqual(s.petPreviewEnabled, { on: false, mixed: false });
  // 책방은 값이 없으면 켜짐(선생님 요청 — 기본 활성화)
  assert.deepEqual(s.bookActivitiesEnabled, { on: true, mixed: false });
  // 책방 · 펫 미리보기는 반마다 따로라 새 반이 따를 값에 없습니다(새 반은 기본값 — 책방 켜짐 · 펫 미리보기 꺼짐)
  assert.deepEqual(featuresForNewClass(classes), { readingEnabled: true, bookSearchEnabled: false, rankingEnabled: false, readingTopEnabled: true, characterEnabled: true, fruitBasketEnabled: true, petEnabled: true, petFeedEnabled: false, plazaEnabled: false, plazaTalkEnabled: false, classroomEnabled: false, hideoutEnabled: false, readingMapTheme: "cloud-islands", petRests: [] });
  assert.equal(featuresForNewClass([{ archived: true }]), null);
  assert.equal(teacherFeatureSettings([]).readingEnabled.on, false);
  // 펫 먹이의 '읽은 날' 기준(선생님이 정한 쪽수 · 글자 수)도 새 반이 따름 — 정한 적이 없으면 넘기지 않음(처음 값 5쪽 · 250자)
  const ruled = featuresForNewClass([{ id: "a", readingEnabled: true, petReadPages: 12, petReadChars: 0 }]);
  assert.deepEqual([ruled.petReadPages, ruled.petReadChars], [12, 0]);
  assert.equal("petReadPages" in featuresForNewClass([{ id: "a", readingEnabled: true }]), false);
});

test("펫 먹이의 '배고파지지 않는 날'은 선생님의 모든 반에 한 값 — 운영 중인 첫 반의 값, 다르면 mixed", async () => {
  const { teacherFeatureSettings, teacherPetRestSettings, featuresForNewClass } = await import("@/lib/reading");
  const rest = { kind: "vacation", from: "2026-12-24", to: "2027-02-01" };
  const same = [
    { id: "a", readingEnabled: true, petFeedEnabled: true, petRests: [rest] },
    // 한때의 '주말에는 줄지 않아요'(petRestWeekend)가 남은 반 — 읽지 않으므로 같은 값으로 봄(주말에도 줄어듦 — 선생님 결정)
    { id: "b", readingEnabled: true, petFeedEnabled: true, petRestWeekend: true, petRests: [rest] },
    { id: "old", archived: true, petRests: [] },
  ];
  assert.deepEqual(teacherFeatureSettings(same).petFeedEnabled, { on: true, mixed: false });
  assert.deepEqual(teacherPetRestSettings(same), { rests: [rest], mixed: false });
  const made = featuresForNewClass(same);
  assert.deepEqual([made.petFeedEnabled, made.petRests, "petRestWeekend" in made], [true, [rest], false]);
  // 값이 없으면 기간 없음. 반마다 다르면 mixed
  assert.deepEqual(teacherPetRestSettings([{ id: "a" }]), { rests: [], mixed: false });
  assert.equal(teacherPetRestSettings([{ id: "a", petRests: [rest] }, { id: "b" }]).mixed, true);
  assert.deepEqual(teacherPetRestSettings([]), { rests: [], mixed: false });
});

test("새 반은 운영 중인 반의 독서 맵을 따르고 보관된 반·혼합된 선택은 기본 맵으로 처리", async () => {
  const { featuresForNewClass } = await import("@/lib/reading");
  assert.equal(featuresForNewClass([
    { id: "a", readingMapTheme: "continent" },
    { id: "b", readingMapTheme: "continent" },
    { id: "old", archived: true, readingMapTheme: "cloud-islands" },
  ]).readingMapTheme, "continent");
  assert.equal(featuresForNewClass([{ id: "a", readingMapTheme: "cloud-islands" }]).readingMapTheme, "cloud-islands");
  assert.equal(featuresForNewClass([{ id: "a", readingMapTheme: "continent" }, { id: "b" }]).readingMapTheme, "cloud-islands");
  assert.equal(featuresForNewClass([{ archived: true, readingMapTheme: "continent" }]), null);
});

test("도서 정보 보기(bookInfoUrl) — 검색으로 담은 책은 그 책의 정보 쪽, 주소가 없거나 낯선 주소면 다음 검색으로 '제목 지은이'", async () => {
  const { bookInfoUrl, BOOK_INFO_SEARCH } = await import("@/lib/reading");
  const page = "https://search.daum.net/search?w=bookpage&bookId=123&q=%EC%96%B4%EB%A6%B0%20%EC%99%95%EC%9E%90";
  assert.equal(bookInfoUrl({ title: "어린 왕자", author: "생텍쥐페리", bookLink: page }), page);
  assert.equal(bookInfoUrl({ title: "책", bookLink: "https://book.naver.com/bookdb/book_detail.naver?bid=1" }), "https://book.naver.com/bookdb/book_detail.naver?bid=1");
  const search = (q) => BOOK_INFO_SEARCH + encodeURIComponent(q);
  // 직접 적어 담은 책(주소 없음) — 제목 + 지은이로 찾기, 지은이가 없으면 제목만
  assert.equal(bookInfoUrl({ title: " 어린 왕자 ", author: " 생텍쥐페리 " }), search("어린 왕자 생텍쥐페리"));
  assert.equal(bookInfoUrl({ title: "어린 왕자", author: "" }), search("어린 왕자"));
  assert.ok(bookInfoUrl({ title: "가 & 나?", author: "A/B" }).startsWith("https://search.daum.net/search?w=tot&q="));
  assert.equal(new URL(bookInfoUrl({ title: "가 & 나?", author: "A/B" })).searchParams.get("q"), "가 & 나? A/B");
  // 저장할 때 받지 않는 주소는 쓰지 않고 검색으로(HTTPS가 아님 · 다른 사이트 · 스크립트 · 계정 · 포트 · 깨진 주소)
  for (const bad of ["http://search.daum.net/x", "https://evil.example.com/daum.net", "https://daum.net.evil.com/", "javascript:alert(1)", "https://u:p@search.daum.net/", "https://search.daum.net:8443/", "not a url"]) {
    assert.equal(bookInfoUrl({ title: "어린 왕자", author: "생텍쥐페리", bookLink: bad }), search("어린 왕자 생텍쥐페리"), bad);
  }
  // 제목이 없으면 단추를 그리지 않음
  assert.equal(bookInfoUrl({ title: "  ", author: "누구" }), null);
  assert.equal(bookInfoUrl(null), null);
});

test("책 등록 창 — 제목이 검색한 책과 다른 책이 되었나(bookTitleDrifted): 띄어쓰기 · 문장 부호 · 대소문자만 다르면 같은 책", async () => {
  const { bookTitleDrifted } = await import("@/lib/reading");
  const picked = "뱅크시, 아무 데나 낙서해도 돼?";
  assert.equal(bookTitleDrifted(picked, picked), false);
  assert.equal(bookTitleDrifted("뱅크시 아무데나 낙서해도 돼", picked), false); // 쉼표 · 물음표 · 띄어쓰기만 다름
  assert.equal(bookTitleDrifted("  뱅크시, 아무 데나 낙서해도 돼?  ", picked), false);
  assert.equal(bookTitleDrifted("Harry Potter", "harry potter!"), false); // 대소문자
  assert.equal(bookTitleDrifted("어린 왕자", picked), true); // 다른 책
  assert.equal(bookTitleDrifted("", picked), true); // 지우고 새로 적는 중
  assert.equal(bookTitleDrifted("어린 왕자", ""), false); // 검색 정보가 없으면 늘 거짓
  assert.equal(bookTitleDrifted("어린 왕자", null), false);
});

test("책방 스위치(bookActivitiesOn) — 값이 없으면 켜짐 · 끈 것만 꺼짐 · 책 봄과 무관(선생님 요청)", async () => {
  const { bookActivitiesOn, teacherFeatureSettings, featuresForNewClass, TEACHER_FEATURES } = await import("@/lib/reading");
  assert.equal(TEACHER_FEATURES[0], "bookActivitiesEnabled"); // 관리자 설정의 맨 앞 스위치
  assert.equal(bookActivitiesOn(null), true); // 반을 아직 모를 때도 켜짐(이미 쓰던 반 그대로)
  assert.equal(bookActivitiesOn({}), true);
  assert.equal(bookActivitiesOn({ bookActivitiesEnabled: true }), true);
  assert.equal(bookActivitiesOn({ bookActivitiesEnabled: false }), false);
  // 참 · 거짓이 아닌 값은 켜짐으로 봅니다(규칙이 참 · 거짓만 받음 — 끈 것은 false 하나)
  assert.equal(bookActivitiesOn({ bookActivitiesEnabled: "false" }), true);
  // 책 봄 성장 기능과는 따로
  assert.equal(bookActivitiesOn({ readingEnabled: false }), true);
  assert.equal(bookActivitiesOn({ readingEnabled: true, bookActivitiesEnabled: false }), false);
});

test("책방 · 펫 미리보기만 반마다 따로(선생님 요청 · 2026년 11월) — 새 반은 다른 반의 값과 상관없이 기본값으로 시작", async () => {
  const { PER_CLASS_FEATURES, isPerClassFeature, featureValue, featuresForNewClass, TEACHER_FEATURES } = await import("@/lib/reading");
  assert.deepEqual([...PER_CLASS_FEATURES], ["bookActivitiesEnabled", "petPreviewEnabled"]);
  assert.equal(isPerClassFeature("bookActivitiesEnabled"), true);
  assert.equal(isPerClassFeature("petPreviewEnabled"), true);
  // 나머지 스위치는 그대로 선생님의 모든 반에 한 값(반마다가 아님) — 펫 먹이(배부름)도(선생님 결정)
  assert.equal(isPerClassFeature("petFeedEnabled"), false);
  for (const key of TEACHER_FEATURES.filter((k) => !["bookActivitiesEnabled", "petPreviewEnabled"].includes(k))) assert.equal(isPerClassFeature(key), false, key);
  assert.equal(isPerClassFeature("readingMapTheme"), false);
  assert.equal(isPerClassFeature(""), false);
  assert.throws(() => { PER_CLASS_FEATURES.push("readingEnabled"); }); // 목록은 얼어 있음
  // 반마다 제 값 — 한 반을 꺼도 다른 반은 그대로 켜짐
  const classes = [{ id: "a" }, { id: "b", bookActivitiesEnabled: false }, { id: "c", bookActivitiesEnabled: true }];
  assert.deepEqual(classes.map((c) => featureValue(c, "bookActivitiesEnabled")), [true, false, true]);
  // 새 반은 책방 칸을 받지 않아 기본값(켜짐)으로 시작 — 모든 반을 꺼 두었어도, 반마다 달라도
  const allOff = [{ id: "a", bookActivitiesEnabled: false }, { id: "b", bookActivitiesEnabled: false }, { id: "old", archived: true }];
  for (const list of [allOff, classes, [{ id: "a" }]]) {
    const made = featuresForNewClass(list);
    assert.equal("bookActivitiesEnabled" in made, false);
    assert.equal(featureValue(made, "bookActivitiesEnabled"), true);
  }
  // 다른 스위치는 지금처럼 모든 반의 값을 따름(한 반이라도 꺼져 있으면 새 반도 꺼짐)
  assert.equal(featuresForNewClass([{ id: "a", fruitBasketEnabled: false }, { id: "b" }]).fruitBasketEnabled, false);
  // 펫 미리보기 — 반마다 제 값(한 반만 켜도 다른 반은 그대로 꺼짐), 새 반은 모든 반이 켜 두었어도 꺼진 채 시작
  const previews = [{ id: "a", petPreviewEnabled: true }, { id: "b" }, { id: "c", petPreviewEnabled: false }];
  assert.deepEqual(previews.map((c) => featureValue(c, "petPreviewEnabled")), [true, false, false]);
  for (const list of [[{ id: "a", petPreviewEnabled: true }, { id: "b", petPreviewEnabled: true }], previews, [{ id: "a" }]]) {
    const made = featuresForNewClass(list);
    assert.equal("petPreviewEnabled" in made, false);
    assert.equal(featureValue(made, "petPreviewEnabled"), false);
  }
});

test("독서 TOP 3 스위치(readingTopOn) — 책 봄이 켜지고 끄지 않았을 때만 · 리더보드 스위치와는 따로(선생님 요청)", async () => {
  const { readingTopOn, rankingEnabled } = await import("@/lib/reading");
  assert.equal(readingTopOn({ readingEnabled: true }), true); // 값이 없으면 켜짐
  assert.equal(readingTopOn({ readingEnabled: true, readingTopEnabled: false }), false);
  assert.equal(readingTopOn({ readingEnabled: false, readingTopEnabled: true }), false); // 책 봄이 꺼지면 함께
  assert.equal(readingTopOn({ readingEnabled: true, archived: true }), false);
  assert.equal(readingTopOn(null), false);
  // 리더보드를 꺼도 TOP 3는 그대로, TOP 3를 꺼도 리더보드는 그대로
  assert.equal(readingTopOn({ readingEnabled: true, rankingEnabled: false }), true);
  assert.equal(rankingEnabled({ readingEnabled: true, readingTopEnabled: false }), true);
});
