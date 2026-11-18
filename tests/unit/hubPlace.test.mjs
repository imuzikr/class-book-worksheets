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

test("책 봄에서는 '독서로 검색 · 성장·뱃지'만 — 학생도 교사처럼, 예외 없이", () => {
  assert.equal(hubLibraryOnly({ readingOpen: true }), true);    // 책 봄 — 교사 · 학생 모두
  assert.equal(hubLibraryOnly({ readingOpen: false }), false);  // 책방 · 리더보드 · 대시보드
  assert.equal(hubLibraryOnly(), false);
  // 책방과 리더보드를 모두 끈 반의 학생도 막습니다(선생님 결정 — 한때 그런 반의 학생만 그대로 두었음). 반 설정을 넘겨도
  // 판정은 책 봄이 열려 있는가 하나뿐입니다.
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: false, rankingOn: false }), true);
  const keys = ["msg", "library", "badges", "attend", "classes", "fruit", "report"];
  assert.deepEqual(keys.filter((k) => hubItemOff(k, true)), ["msg", "attend", "classes", "fruit", "report"]);
  assert.deepEqual(keys.filter((k) => hubItemOff(k, false)), []);
});
