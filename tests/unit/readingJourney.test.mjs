// 리더보드 · 독서 여정의 셈 (lib/readingJourney.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialReadingState, applyReadingAction, deriveReading } from "../../lib/reading.js";
import {
  journeyTitle, currentStreakOf, memberSnapshot, memberStats, journeyNarrative,
  RANKING_PERIODS, rankingsForPeriod, sortReadingRankings, isRankedStudent,
} from "../../lib/readingJourney.js";
import { sortReadingRankings as serverSort } from "../../lib/server/readingPolicy.js";

const NOW = "2026-10-29T03:00:00.000Z";
const ctx = (id) => ({ uid: "s", classId: "c", now: NOW, id });

function sample() {
  let s = applyReadingAction(initialReadingState(), { type: "addBook", title: "어린 왕자", author: "작가", totalPages: 50 }, ctx("b1"));
  s = applyReadingAction(s, { type: "addLog", bookId: "b1", date: "2026-10-27", startPage: 1, endPage: 20, notes: "읽었어요." }, ctx("l1"));
  s = applyReadingAction(s, { type: "addLog", bookId: "b1", date: "2026-10-28", startPage: 21, endPage: 50, notes: "읽었어요." }, ctx("l2"));
  return deriveReading(s, new Date(NOW));
}

test("레벨별 칭호", () => {
  assert.equal(journeyTitle(5), "열정적인 독서가");
});

test("오늘 기준 연속 독서일 — 어제까지 읽었으면 잇고, 그 전이면 0", () => {
  assert.equal(currentStreakOf(3, "2026-10-29", "2026-10-29"), 3);
  assert.equal(currentStreakOf(3, "2026-10-28", "2026-10-29"), 3);
  assert.equal(currentStreakOf(3, "2026-10-26", "2026-10-29"), 0);
  assert.equal(currentStreakOf(0, "2026-10-29", "2026-10-29"), 0);
});

test("반 집계에 적는 값 — 책 제목 없이 수와 뱃지 id만", () => {
  const summary = sample();
  const snap = memberSnapshot(summary);
  assert.equal(snap.totalPages, 50);
  assert.equal(snap.completedBooks, 1);
  assert.equal(snap.lastReadDate, "2026-10-28");
  assert.equal(snap.streakRun, 2);
  assert.ok(snap.badges.includes("completion_1"));
  assert.ok(!JSON.stringify(snap).includes("어린 왕자"));
  const stats = memberStats(snap, "2026-10-29");
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.badgeCount, snap.badges.length);
});

test("옛 집계(칸이 없음)는 null — 화면이 '—'로", () => {
  const stats = memberStats({ level: 2, events: [] }, "2026-10-29");
  assert.equal(stats.totalPages, null);
  assert.equal(stats.badges, null);
  assert.equal(stats.currentStreak, null);
  assert.deepEqual(memberStats({ badges: ["nope", "shelf_1", "shelf_1"] }, "2026-10-29").badges, ["shelf_1"]);
});

test("나의 독서 여정 이야기", () => {
  assert.match(journeyNarrative(deriveReading(initialReadingState(), new Date(NOW)), "2026-10-29")[0], /아직 독서 여정이/);
  const lines = journeyNarrative(sample(), "2026-10-29");
  assert.match(lines[0], /「어린 왕자」를 펼치며/);
  assert.ok(lines.some((l) => /1권을 완독/.test(l)));
  assert.ok(lines.some((l) => /레벨 \d/.test(l)));
});

// ---- 경험치 균형: 연속 보너스 상한 · 최소 쪽수 · 과일 ----
import { readingFruitGains, FRUIT_XP, STREAK_MIN_PAGES } from "../../lib/reading.js";

function dailyReads(days, pagesPerDay) {
  let s = applyReadingAction(initialReadingState(), { type: "addBook", title: "긴 책", author: "작가", totalPages: 1000 }, ctx("b1"));
  let page = 1;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    s = applyReadingAction(s, { type: "addLog", bookId: "b1", date, startPage: page, endPage: page + pagesPerDay - 1, notes: "읽었어요." }, ctx(`l${i}`));
    page += pagesPerDay;
  }
  return deriveReading(s, new Date(NOW));
}
const streakXp = (summary) => summary.events.filter((e) => e.kind === "streak").reduce((t, e) => t + e.xp, 0);

test("연속 보너스는 7일째부터 하루 105로 고정", () => {
  const s = dailyReads(10, 5);
  assert.equal(s.longestStreak, 10);
  assert.equal(streakXp(s), 15 * (1 + 2 + 3 + 4 + 5 + 6 + 7) + 105 * 3);
});

test(`하루에 ${STREAK_MIN_PAGES}쪽이 안 되면 연속일이 아님`, () => {
  const s = dailyReads(5, 4);
  assert.equal(s.longestStreak, 0);
  assert.equal(streakXp(s), 0);
  assert.equal(s.xp, 20 + 20); // 쪽 20 + 서재의 시작 초급 뱃지 20
});

test("같은 날 나눠 읽은 쪽은 합쳐서 셈", () => {
  let s = applyReadingAction(initialReadingState(), { type: "addBook", title: "책", author: "작가", totalPages: 100 }, ctx("b1"));
  s = applyReadingAction(s, { type: "addLog", bookId: "b1", date: "2026-10-28", startPage: 1, endPage: 3, notes: "읽었어요." }, ctx("l1"));
  s = applyReadingAction(s, { type: "addLog", bookId: "b1", date: "2026-10-28", startPage: 4, endPage: 6, notes: "읽었어요." }, ctx("l2"));
  assert.equal(deriveReading(s, new Date(NOW)).longestStreak, 1);
});

test("과일 — 받은 누계의 최고치만큼만, 바로잡은 −1은 두 번 세지 않음", () => {
  const at = (d, h = 3) => new Date(`2026-10-${d}T0${h}:00:00Z`);
  const gains = readingFruitGains([
    { classId: "c", delta: 1, at: at(27) },
    { classId: "c", delta: 1, at: at(27, 4) },
    { classId: "c", delta: -1, at: at(28) },
    { classId: "c", delta: 1, at: at(28, 4) },
    { classId: "c", delta: 2, at: at(29) },
    { classId: "d", delta: 3, at: at(29) },
  ], new Date(NOW));
  assert.deepEqual(gains, [
    { classId: "c", date: "2026-10-27", count: 2 },
    { classId: "c", date: "2026-10-29", count: 2 },
    { classId: "d", date: "2026-10-29", count: 3 },
  ]);
  const summary = deriveReading(initialReadingState(), new Date(NOW), { fruits: gains });
  assert.equal(summary.fruitCount, 7);
  assert.equal(summary.xp, 7 * FRUIT_XP);
  assert.equal(summary.classScores.c.allTime, 4 * FRUIT_XP);
  assert.equal(summary.longestStreak, 0);
});

test("과일 경험치로 레벨이 오르면 레벨 뱃지도", () => {
  const summary = deriveReading(initialReadingState(), new Date(NOW), { fruits: [{ classId: "c", date: "2026-10-29", count: 25 }] });
  assert.equal(summary.level, 3);
  assert.ok(summary.earnedBadges.some((b) => b.id === "level_1"));
});

import { READING_BADGES } from "../../lib/reading.js";
import { badgeHint } from "../../lib/readingJourney.js";
test("뱃지 툴팁 — 18종 모두 조건 숫자와 보상을 말함", () => {
  for (const b of READING_BADGES) {
    const lines = badgeHint(b);
    assert.ok(lines.length >= 2, b.id);
    assert.ok(lines[0].includes(String(b.threshold)), b.id);
    assert.equal(lines.at(-1), `받으면 +${b.expReward} EXP`);
  }
  assert.match(badgeHint(READING_BADGES.find((b) => b.id === "streak_2"))[0], /하루 5쪽 이상 읽은 날이 7일 연속/);
});

import { rankingEnabled } from "../../lib/reading.js";
test("랭킹 시스템 — 책나눔이 켜져 있고 끄지 않았을 때만", () => {
  assert.equal(rankingEnabled({ readingEnabled: true }), true);
  assert.equal(rankingEnabled({ readingEnabled: true, rankingEnabled: false }), false);
  assert.equal(rankingEnabled({ readingEnabled: false }), false);
  assert.equal(rankingEnabled(null), false);
});

test("상단바 독서 TOP 3 — 레벨 → 경험치 → 그 경험치에 먼저 이른 학생, 0 EXP는 빼고 셋까지", async () => {
  const { topReaders, xpReachedOn } = await import("../../lib/readingJourney.js");
  assert.equal(xpReachedOn([{ date: "2026-10-01", xp: 10 }, { date: "2026-10-05", xp: 0 }, { date: "2026-10-03", xp: 5 }]), "2026-10-03");
  const rows = [
    { uid: "a", studentId: "1", level: 3, totalXp: 300, xpReachedOn: "2026-10-09" },
    { uid: "b", studentId: "2", level: 4, totalXp: 260, xpReachedOn: "2026-10-09" },
    { uid: "c", studentId: "3", level: 3, totalXp: 300, xpReachedOn: "2026-10-02" },
    { uid: "d", studentId: "4", level: 3, totalXp: 320, xpReachedOn: "2026-10-10" },
    { uid: "e", studentId: "5", level: 1, totalXp: 0 },
  ];
  assert.deepEqual(topReaders(rows).map((r) => r.uid), ["b", "d", "c"]);
  assert.deepEqual(topReaders(rows, 5).map((r) => r.uid), ["b", "d", "c", "a"]);
  assert.deepEqual(topReaders([{ uid: "z", totalXp: 0 }]), []);
});

test("독서 TOP 3의 한 주 — 서울 시각 월요일 07:00에 바뀜", async () => {
  const { readingTopWeek, nextReadingTopRefresh } = await import("../../lib/reading.js");
  const kst = (s) => new Date(`${s}+09:00`);
  // 2026-11-09은 월요일
  assert.equal(readingTopWeek(kst("2026-11-09T06:59:59")), "2026-11-02");
  assert.equal(readingTopWeek(kst("2026-11-09T07:00:00")), "2026-11-09");
  assert.equal(readingTopWeek(kst("2026-11-11T12:00:00")), "2026-11-09");
  assert.equal(readingTopWeek(kst("2026-11-15T23:59:59")), "2026-11-09");
  assert.equal(readingTopWeek(kst("2026-11-16T06:59:59")), "2026-11-09");
  assert.equal(readingTopWeek(kst("2026-11-16T07:00:00")), "2026-11-16");
  // 다음에 바뀌는 때 — 다음 월요일 07:00(서울). 바로 그 순간이면 그 다음 주.
  assert.equal(nextReadingTopRefresh(kst("2026-11-09T06:59:59")), kst("2026-11-09T07:00:00").getTime());
  assert.equal(nextReadingTopRefresh(kst("2026-11-09T07:00:00")), kst("2026-11-16T07:00:00").getTime());
  assert.equal(nextReadingTopRefresh(kst("2026-11-12T20:00:00")), kst("2026-11-16T07:00:00").getTime());
});

test("독서 TOP 3는 그 주 월요일 전날(일요일)까지의 기록으로 — 이번 주 몫은 덜어 냄", async () => {
  const { readingTopAsOf } = await import("../../lib/readingJourney.js");
  const snap = {
    totalXp: 300,
    events: [
      { date: "2026-11-01", xp: 100 }, // 지난주 일요일 — 셈에 듦
      { date: "2026-11-08", xp: 150 }, // 이번 주 TOP 3가 정해지기 전날 — 셈에 듦
      { date: "2026-11-09", xp: 30 },  // 이번 주 월요일 — 다음 주 TOP 3에
      { date: "2026-11-11", xp: 20 },
    ],
  };
  assert.deepEqual(readingTopAsOf(snap, "2026-11-09"), { totalXp: 250, level: 3, xpReachedOn: "2026-11-08" });
  // 지난주 TOP 3 자리에서 보면
  assert.deepEqual(readingTopAsOf(snap, "2026-11-02"), { totalXp: 100, level: 2, xpReachedOn: "2026-11-01" });
  // 누적 칸이 없는 옛 집계는 그 반 기록의 합으로
  assert.deepEqual(readingTopAsOf({ events: snap.events }, "2026-11-09"), { totalXp: 250, level: 3, xpReachedOn: "2026-11-08" });
  // 이번 주에 처음 읽은 학생은 0 — TOP 3에서 빠짐
  assert.deepEqual(readingTopAsOf({ totalXp: 40, events: [{ date: "2026-11-10", xp: 40 }] }, "2026-11-09"), { totalXp: 0, level: 1, xpReachedOn: null });
  assert.deepEqual(readingTopAsOf(undefined, "2026-11-09"), { totalXp: 0, level: 1, xpReachedOn: null });
});

test("순위 — 한 번 받은 네 기간의 경험치로 기간 단추마다 그 자리에서 다시 세움(다시 묻지 않음)", () => {
  assert.deepEqual(RANKING_PERIODS, ["daily", "weekly", "monthly", "all-time"]);
  // 서버와 화면이 같은 셈 하나를 씀
  assert.equal(serverSort, sortReadingRankings);
  const rows = [
    { uid: "a", studentId: "10102", xp: 5, rank: 2, xpBy: { daily: 0, weekly: 5, monthly: 40, "all-time": 90 } },
    { uid: "b", studentId: "10101", xp: 5, rank: 2, xpBy: { daily: 3, weekly: 5, monthly: 10, "all-time": 200 } },
    { uid: "c", studentId: "10103", xp: 9, rank: 1, xpBy: { daily: 3, weekly: 9, monthly: 40, "all-time": 50 } },
  ];
  const view = (period) => rankingsForPeriod(rows, period).map((r) => [r.uid, r.xp, r.rank]);
  // 같은 경험치는 공동 순위, 그다음 학번(숫자로) 차례
  assert.deepEqual(view("daily"), [["b", 3, 1], ["c", 3, 1], ["a", 0, 3]]);
  assert.deepEqual(view("weekly"), [["c", 9, 1], ["b", 5, 2], ["a", 5, 2]]);
  assert.deepEqual(view("monthly"), [["a", 40, 1], ["c", 40, 1], ["b", 10, 3]]);
  assert.deepEqual(view("all-time"), [["b", 200, 1], ["a", 90, 2], ["c", 50, 3]]);
  // 받아 둔 줄은 그대로(단추를 오가도 처음 값으로 다시 셈)
  assert.deepEqual(rows.map((r) => [r.xp, r.rank]), [[5, 2], [5, 2], [9, 1]]);
  // 다른 칸(이름 · 캐릭터 · 쪽수)은 그대로 따라감
  const withInfo = rankingsForPeriod([{ uid: "z", studentId: "1", name: "홍길동", totalPages: 30, xpBy: { weekly: 4 } }], "weekly");
  assert.deepEqual(withInfo, [{ uid: "z", studentId: "1", name: "홍길동", totalPages: 30, xpBy: { weekly: 4 }, xp: 4, rank: 1 }]);
  // 기간 칸이 비었거나 이상하면 0
  assert.equal(rankingsForPeriod([{ uid: "q", xpBy: { weekly: -3 } }], "weekly")[0].xp, 0);
  assert.equal(rankingsForPeriod([{ uid: "q", xpBy: {} }], "monthly")[0].xp, 0);
  // xpBy가 없는 줄(옛 서버)은 받아 온 xp 그대로 · uid가 없어도 멈추지 않음
  assert.deepEqual(rankingsForPeriod([{ uid: "x", xp: 7 }, { uid: "y", xp: 9 }], "monthly").map((r) => [r.uid, r.rank]), [["y", 1], ["x", 2]]);
  assert.deepEqual(rankingsForPeriod([{ xp: 1 }, { xp: 1 }], "daily").map((r) => r.rank), [1, 1]);
  assert.deepEqual(rankingsForPeriod(undefined, "weekly"), []);
});

test("순위에 서는 학생 — 교사 · 관리자와 사용 중지된 학생(전학 등)은 빼고, 역할이 비어 있으면 학생", () => {
  assert.equal(isRankedStudent({ role: "student" }), true);
  assert.equal(isRankedStudent({}), true); // 옛 계정 — 역할 칸이 없으면 학생
  assert.equal(isRankedStudent({ role: "student", suspended: false }), true);
  assert.equal(isRankedStudent({ role: "student", suspended: true }), false);
  assert.equal(isRankedStudent({ suspended: true }), false);
  assert.equal(isRankedStudent({ role: "teacher" }), false);
  assert.equal(isRankedStudent({ role: "admin" }), false);
  // 사용 중지는 참일 때만 — 이상한 값은 빼지 않음(규칙 · 서버 API의 판정과 같음)
  assert.equal(isRankedStudent({ role: "student", suspended: "true" }), true);
  assert.equal(isRankedStudent(null), false);
  assert.equal(isRankedStudent(undefined), false);
});
