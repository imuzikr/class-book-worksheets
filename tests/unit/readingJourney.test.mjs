// 리더보드 · 독서 여정의 셈 (lib/readingJourney.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import { initialReadingState, applyReadingAction, deriveReading } from "../../lib/reading.js";
import {
  journeyAvatar, journeyTitle, journeyStage, levelProgress, journeyTrackMax, journeyPosition,
  currentStreakOf, memberSnapshot, memberStats, sortJourney, journeyNarrative,
} from "../../lib/readingJourney.js";

const NOW = "2026-10-29T03:00:00.000Z";
const ctx = (id) => ({ uid: "s", classId: "c", now: NOW, id });

function sample() {
  let s = applyReadingAction(initialReadingState(), { type: "addBook", title: "어린 왕자", author: "작가", totalPages: 50 }, ctx("b1"));
  s = applyReadingAction(s, { type: "addLog", bookId: "b1", date: "2026-10-27", startPage: 1, endPage: 20, notes: "읽었어요." }, ctx("l1"));
  s = applyReadingAction(s, { type: "addLog", bookId: "b1", date: "2026-10-28", startPage: 21, endPage: 50, notes: "읽었어요." }, ctx("l2"));
  return deriveReading(s, new Date(NOW));
}

test("레벨별 모습 · 칭호 · 곳", () => {
  assert.equal(journeyAvatar(1), "🌱");
  assert.equal(journeyAvatar(3), "📚");
  assert.equal(journeyAvatar(7), "🦉");
  assert.equal(journeyTitle(5), "열정적인 독서가");
  assert.equal(journeyStage(1), "시작의 마을");
  assert.equal(journeyStage(99), "마스터의 궁전");
});

test("레벨 안 진행률과 다음 레벨까지", () => {
  assert.deepEqual(levelProgress(0), { level: 1, from: 0, to: 100, toNext: 100, percent: 0 });
  const p = levelProgress(175);
  assert.equal(p.level, 2);
  assert.equal(p.percent, 50);
  assert.equal(p.toNext, 75);
});

test("트랙 끝 레벨과 자리", () => {
  assert.equal(journeyTrackMax([{ level: 2 }]), 7);
  assert.equal(journeyTrackMax([{ level: 9 }]), 10);
  assert.equal(journeyPosition(0, 7), 4);
  assert.ok(journeyPosition(175, 7) > journeyPosition(100, 7));
  assert.equal(journeyPosition(10 ** 9, 7), 96);
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

test("트랙 순서 — 누적 경험치 → 최근에 읽은 학생 → 학번", () => {
  const order = sortJourney([
    { uid: "a", totalXp: 10, studentId: "3" },
    { uid: "b", totalXp: 50, studentId: "2" },
    { uid: "c", totalXp: 10, lastReadDate: "2026-10-28", studentId: "4" },
    { uid: "d", totalXp: 10, studentId: "1" },
  ]).map((r) => r.uid);
  assert.deepEqual(order, ["b", "c", "d", "a"]);
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
