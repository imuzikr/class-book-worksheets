// 떠 있는 동그라미의 자리 셈(lib/hubPlace.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanHubPos, hubPosFromPoint, hubPlacement, hubLibraryOnly, hubItemOff, HUB_FAB, HUB_EDGE } from "@/lib/hubPlace";

test("저장 값 거르기 — 숫자 둘이 아니면 기본 자리, 넘치면 0~1로", () => {
  assert.equal(cleanHubPos(null), null);
  assert.equal(cleanHubPos({ fx: "a", fy: 1 }), null);
  assert.equal(cleanHubPos({ fx: NaN, fy: 0.5 }), null);
  assert.deepEqual(cleanHubPos({ fx: 1.4, fy: -2 }), { fx: 1, fy: 0 });
});

test("가운데 자리 → 비율", () => {
  assert.deepEqual(hubPosFromPoint(720, 450, 1440, 900), { fx: 0.5, fy: 0.5 });
  assert.equal(hubPosFromPoint(10, 10, 0, 900), null);
});

test("오른쪽 아래 — 왼쪽 위로 펼침, 네 변 거리가 화면과 맞음", () => {
  const p = hubPlacement({ fx: 0.9, fy: 0.9 }, 1000, 800);
  assert.equal(p.left, 900 - 28);
  assert.equal(p.top, 720 - 28);
  assert.equal(p.right, 1000 - p.left - HUB_FAB);
  assert.equal(p.bottom, 800 - p.top - HUB_FAB);
  assert.equal(p.isLeft, false);
  assert.equal(p.isTop, false);
});

test("왼쪽 위 — 오른쪽 아래로 펼침", () => {
  const p = hubPlacement({ fx: 0.1, fy: 0.2 }, 1000, 800);
  assert.equal(p.isLeft, true);
  assert.equal(p.isTop, true);
});

test("화면 밖으로는 안 나감 — 가장자리에서 8px", () => {
  const p = hubPlacement({ fx: 0, fy: 1 }, 1000, 800);
  assert.equal(p.left, HUB_EDGE);
  assert.equal(p.bottom, HUB_EDGE);
  const q = hubPlacement({ fx: 1, fy: 0 }, 1000, 800);
  assert.equal(q.right, HUB_EDGE);
  assert.equal(q.top, HUB_EDGE);
});

test("저장한 자리가 없으면 null(CSS 기본 자리)", () => {
  assert.equal(hubPlacement(null, 1000, 800), null);
  assert.equal(hubPlacement({ fx: 0.5, fy: 0.5 }, 0, 0), null);
});

test("책 봄에서는 '독서로 검색 · 성장·뱃지'만 — 학생도 교사처럼", () => {
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: true }), true);
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: true, booksOn: false, rankingOn: false }), true);   // 교사는 책방이 늘 있음
  assert.equal(hubLibraryOnly({ readingOpen: false, isTeacher: true, booksOn: true }), false);  // 책방 · 리더보드 · 대시보드
  // 책방을 끈 반의 학생도 이제 막음(선생님 요청) — 메신저 · 출석부는 리더보드 화면의 동그라미에서
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: false }), true);
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: false, rankingOn: true }), true);
  // 책방 · 리더보드를 모두 끈 반의 학생 — 동그라미가 다 켜지는 화면이 없어 그대로(열 곳이 없어지지 않게)
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: false, rankingOn: false }), false);
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: true, rankingOn: false }), true);
  assert.equal(hubLibraryOnly(), false);
  const keys = ["msg", "library", "badges", "attend", "classes", "fruit", "report"];
  assert.deepEqual(keys.filter((k) => hubItemOff(k, true)), ["msg", "attend", "classes", "fruit", "report"]);
  assert.deepEqual(keys.filter((k) => hubItemOff(k, false)), []);
});
