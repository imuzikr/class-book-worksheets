// 떠 있는 동그라미의 자리 셈(lib/hubPlace.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanHubPos, hubPosFromPoint, hubPlacement, hubLibraryOnly, hubItemOff, hubOrbit, HUB_FAB, HUB_EDGE, HUB_DISC, HUB_PLANET, HUB_ORBIT, HUB_ORBIT_WIDE } from "@/lib/hubPlace";

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

test("책 봄에서는 '독서로 검색 · 성장·뱃지'(선생님은 '공지 보내기'도)만 — 학생도 교사처럼, 예외 없이", () => {
  assert.equal(hubLibraryOnly({ readingOpen: true }), true);    // 책 봄 — 교사 · 학생 모두
  assert.equal(hubLibraryOnly({ readingOpen: false }), false);  // 책방 · 리더보드 · 대시보드
  assert.equal(hubLibraryOnly(), false);
  // 책방과 리더보드를 모두 끈 반의 학생도 막습니다(선생님 결정 — 한때 그런 반의 학생만 그대로 두었음). 반 설정을 넘겨도
  // 판정은 책 봄이 열려 있는가 하나뿐입니다.
  assert.equal(hubLibraryOnly({ readingOpen: true, isTeacher: false, booksOn: false, rankingOn: false }), true);
  // '공지 보내기'(선생님만 · 한때 책 광장 · 교실 맵 위의 '공지사항' 단추)는 책 봄에서도 켜 둡니다(선생님 요청)
  const keys = ["msg", "notice", "library", "badges", "attend", "classes", "fruit", "report"];
  assert.deepEqual(keys.filter((k) => hubItemOff(k, true)), ["msg", "attend", "classes", "fruit", "report"]);
  assert.deepEqual(keys.filter((k) => hubItemOff(k, false)), []);
});

// 행성 n개의 가운데 자리(원판 가운데 기준) — FloatingHub가 그리는 셈과 같게
function planets(n) {
  const { radius, start, step } = hubOrbit(n);
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + i * step) * Math.PI) / 180;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
}
const dist = ([ax, ay], [bx, by]) => Math.hypot(ax - bx, ay - by);
// 닫기 동그라미의 가운데 — 원판의 네 모서리 가운데 하나에서 28px 안쪽(동그라미를 옮기면 모서리가 바뀜)
const half = HUB_DISC / 2 - HUB_FAB / 2;
const FAB_CORNERS = [[half, half], [-half, half], [-half, -half], [half, -half]];

test("궤도 — 일곱까지는 지금처럼(101px · 메신저가 맨 위), 여덟이면 넓히고 반 칸 돌림", () => {
  for (const n of [5, 6, 7]) {
    assert.deepEqual(hubOrbit(n), { radius: HUB_ORBIT, start: -90, step: 360 / n });
  }
  assert.deepEqual(hubOrbit(8), { radius: HUB_ORBIT_WIDE, start: -67.5, step: 45 });
  assert.equal(hubOrbit(0).radius, HUB_ORBIT);
  assert.equal(hubOrbit("x").radius, HUB_ORBIT);
});

test("여덟 행성(선생님의 책 봄) — 서로 · 닫기 동그라미와 떨어지고 원판 안", () => {
  const ps = planets(8);
  // 이웃 행성 사이 14px 이상(101px 궤도 그대로면 7px)
  for (let i = 0; i < ps.length; i += 1) {
    const gap = dist(ps[i], ps[(i + 1) % ps.length]) - HUB_PLANET;
    assert.ok(gap >= 14, `행성 ${i} · ${i + 1} 사이 ${gap.toFixed(1)}px`);
  }
  // 동그라미가 어느 모서리에 있든 가장 가까운 행성과 15px 이상(대각선을 비움 — 그대로면 한 행성이 8px로 붙음)
  for (const fab of FAB_CORNERS) {
    const near = Math.min(...ps.map((p) => dist(p, fab))) - HUB_PLANET / 2 - HUB_FAB / 2;
    assert.ok(near >= 15, `동그라미(${fab}) 곁 ${near.toFixed(1)}px`);
  }
  // 행성 바깥 끝은 원판 안 — 올려놓아 1.06배로 커져도
  assert.ok(HUB_ORBIT_WIDE + (HUB_PLANET / 2) * 1.06 <= HUB_DISC / 2);
});

test("일곱 행성(선생님 · 책 봄 밖) — 이웃 사이 17px 이상", () => {
  const ps = planets(7);
  for (let i = 0; i < ps.length; i += 1) {
    assert.ok(dist(ps[i], ps[(i + 1) % ps.length]) - HUB_PLANET >= 17);
  }
});
