import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialReadingState, applyReadingAction, deriveReading, READING_BADGES,
  kstToday, readingPeriodKey, readingEnabled, getExpForReadingLevel, getReadingLevel,
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
test("책나눔은 명시적으로 켠 운영 반에서만 활성화", () => {
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

test("초기 상태와 6개 시리즈의 세 단계 뱃지 정의", () => {
  const a = initialReadingState(); const b = initialReadingState();
  a.books.push({}); assert.equal(b.books.length, 0);
  assert.equal(READING_BADGES.length, 18);
  assert.equal(new Set(READING_BADGES.map((badge) => badge.id)).size, 18);
  assert.deepEqual(READING_BADGES.filter((badge) => badge.series === "completion").map((badge) => badge.threshold), [1, 3, 5]);
  assert.ok(READING_BADGES.every((badge) => [1, 2, 3].includes(badge.tier)));
});

test("책 등록만으로는 경험치나 서재 뱃지를 지급하지 않음", () => {
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

test("기록 수정·삭제는 XP와 진행률·완독·대표 뱃지까지 함께 정정", () => {
  let state = log(book(initialReadingState(), "book1", 10), "log1", 1, 10);
  state = applyReadingAction(state, { type: "setFeaturedBadge", badgeId: "completion_1" }, context("featured"));
  assert.equal(state.featuredBadge, "completion_1");
  const corrected = applyReadingAction(state, { type: "updateLog", logId: "log1", endPage: 5 }, context("edit"));
  assert.equal(corrected.featuredBadge, null);
  assert.equal(deriveReading(corrected, NOW).totalBooks, 0);
  assert.equal(deriveReading(corrected, NOW).totalPages, 5);
  const removed = applyReadingAction(corrected, { type: "deleteLog", logId: "log1" }, context("delete"));
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
  state = applyReadingAction(state, { type: "deleteReview", bookId: "book1" }, context("delete"));
  assert.equal(deriveReading(state, NOW).xp, 0);
});

test("다른 반에서 쓴 기록·감상문을 우회 수정할 수 없음", () => {
  const state = review(log(book(initialReadingState()), "a", 1, 10));
  for (const action of [
    { type: "updateLog", logId: "a", notes: "바꿈" },
    { type: "deleteLog", logId: "a" },
    { type: "saveReview", bookId: "book1", text: "바꿈", rating: 4 },
    { type: "deleteReview", bookId: "book1" },
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

test("네이버 도서 정보는 서재 저장·수정 후에도 유지되고 메타데이터만으로 보상하지 않음", () => {
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
});

test("같은 ISBN의 표기만 다른 검색 도서 중복 등록을 거부", () => {
  const state = applyReadingAction(initialReadingState(), { type: "addBook", title: "원제", author: "저자", totalPages: 100, isbn: "978-0-306-40615-7" }, context("original"));
  assert.equal(state.books[0].isbn, "9780306406157");
  assert.throws(() => applyReadingAction(state, { type: "addBook", title: "원제 (개정 표기)", author: "저자 번역가", totalPages: 100, isbn: "9780306406157" }, context("duplicate")), /이미/);
  let more = book(state, "manual", 100, "다른 책");
  assert.throws(() => applyReadingAction(more, { type: "updateBook", bookId: "manual", isbn: "9780306406157" }, context("merge")), /이미/);
});

test("도서 메타데이터는 잘못된 ISBN·비보안 URL·비네이버 링크를 거부", () => {
  for (const fields of [{ isbn: "9780306406158" }, { isbn: "not-isbn" }, { coverImage: "javascript:alert(1)" }, { coverImage: "http://example.com/book.jpg" }, { bookLink: "https://naver.com.evil.test/book" }, { bookLink: "https://user:password@naver.com/book" }]) {
    assert.throws(() => applyReadingAction(initialReadingState(), { type: "addBook", title: "책", author: "저자", totalPages: 100, ...fields }, context("bad")));
  }
});
