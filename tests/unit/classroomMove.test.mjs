// 모두 이동의 10초 알림(선생님 요청) — 신호 읽기 · 세는 중 · 취소 · 내놓기의 셈(lib/classroomMove.js).
// 화면마다 제 시계로 세고(신호가 닿은 때부터), 언제 보낸 것인지 알 수 없는 신호는 세지 않습니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSROOM_MOVE_DROP_MS, CLASSROOM_MOVE_IDLE, CLASSROOM_MOVE_LATE_PULL_MS, CLASSROOM_MOVE_WAIT_MAX_S, CLASSROOM_MOVE_WAIT_S,
  classroomMoveDropShown, classroomMoveDue, classroomMoveFeed, classroomMoveLeft, classroomMoveShare, classroomMoveShown, classroomMoveSignal, classroomMoveUrl,
} from "../../lib/classroomMove.js";

const T = 1794500000000;       // 선생님 기기의 '보낸 때'
const NOW = 5_000_000;         // 이 기기의 지금(선생님 시각과 아무 상관 없는 값 — 견주지 않음을 보이려고 일부러 다르게)
const sig = (to, at, wait = CLASSROOM_MOVE_WAIT_S) => ({ to, at, wait });
// 화면을 열고 처음 본 값(기준)까지 먹인 상태
const watching = (to = null, at = 0) => classroomMoveFeed(CLASSROOM_MOVE_IDLE, sig(to, at, 0), NOW - 60_000);

test("신호 읽기 — 반 문서의 세 칸을 읽고, 모양이 틀린 값은 비운 값으로", () => {
  assert.equal(CLASSROOM_MOVE_WAIT_S, 10, "선생님이 정한 10초");
  assert.deepEqual(classroomMoveSignal({ classroomMoveTo: "classroom", classroomMoveAt: T, classroomMoveWait: 10 }), { to: "classroom", at: T, wait: 10 });
  assert.deepEqual(classroomMoveSignal({ classroomMoveTo: "plaza", classroomMoveAt: T }), { to: "plaza", at: T, wait: 0 }, "셀 시간이 없는 옛 신호");
  assert.deepEqual(classroomMoveSignal({ classroomMoveTo: null, classroomMoveAt: T, classroomMoveWait: 0 }), { to: null, at: T, wait: 0 }, "취소");
  assert.deepEqual(classroomMoveSignal(null), { to: null, at: 0, wait: 0 });
  assert.deepEqual(classroomMoveSignal({}), { to: null, at: 0, wait: 0 });
  for (const to of ["교실", "Classroom", "door", 1, true, {}, []]) assert.equal(classroomMoveSignal({ classroomMoveTo: to, classroomMoveAt: T }).to, null, String(to));
  for (const at of [null, undefined, 0, -5, "", "abc", NaN, Infinity]) assert.equal(classroomMoveSignal({ classroomMoveTo: "plaza", classroomMoveAt: at }).at, 0, String(at));
  for (const wait of [null, undefined, 0, -3, "", "abc", NaN]) assert.equal(classroomMoveSignal({ classroomMoveWait: wait }).wait, 0, String(wait));
  assert.equal(classroomMoveSignal({ classroomMoveWait: 99999 }).wait, CLASSROOM_MOVE_WAIT_MAX_S, "지나치게 큰 값은 천장까지만");
  assert.equal(classroomMoveSignal({ classroomMoveWait: Infinity }).wait, 0);
  assert.equal(classroomMoveSignal({ classroomMoveAt: String(T), classroomMoveWait: "10" }).wait, 10, "수로 읽히는 글자는 받는다");
});

test("처음 본 값은 기준일 뿐 — 세지도, 다른 화면에서 데려오지도 않는다", () => {
  // 신호가 한 번도 없던 반
  const none = classroomMoveFeed(CLASSROOM_MOVE_IDLE, sig(null, 0, 0), NOW);
  assert.deepEqual(none, { seen: 0, pending: null, released: null, dropped: null });
  // 화면을 열었을 때 이미 있던 신호(세는 중이던 것이라도 언제 보낸 것인지 모름) — '이미 있던 신호'로만 둔다
  const old = classroomMoveFeed(CLASSROOM_MOVE_IDLE, sig("classroom", T), NOW);
  assert.equal(old.pending, null, "카운트다운을 띄우지 않는다");
  assert.deepEqual(old.released, { to: "classroom", at: T, live: false, pull: false, tick: NOW });
  assert.equal(old.seen, T);
  // 취소로 끝나 있던 반
  assert.equal(classroomMoveFeed(CLASSROOM_MOVE_IDLE, sig(null, T, 0), NOW).released, null);
  // 상태를 안 넘겨도 처음으로 본다
  assert.equal(classroomMoveFeed(undefined, sig("plaza", T), NOW).released.to, "plaza");
});

test("보는 동안 온 새 신호 — 닿은 때부터 10초를 세고, 다 세면 모두를 데려온다(기기 시계와 견주지 않음)", () => {
  const base = watching("plaza", T - 500);
  const counting = classroomMoveFeed(base, sig("classroom", T), NOW);
  assert.deepEqual(counting.pending, { to: "classroom", at: T, wait: 10, since: NOW, until: NOW + 10_000 });
  assert.equal(counting.released.at, T - 500, "세는 동안 무대가 보는 신호는 그대로(아직 아무도 안 옮김)");
  assert.equal(counting.seen, T);
  // 세는 동안
  assert.equal(classroomMoveLeft(counting.pending, NOW), 10);
  assert.equal(classroomMoveLeft(counting.pending, NOW + 1), 10);
  assert.equal(classroomMoveLeft(counting.pending, NOW + 1000), 9);
  assert.equal(classroomMoveLeft(counting.pending, NOW + 9001), 1);
  assert.equal(classroomMoveLeft(counting.pending, NOW + 10_000), 0);
  assert.equal(classroomMoveLeft(counting.pending, NOW + 99_000), 0);
  assert.equal(classroomMoveLeft(counting.pending, NOW - 5000), 10, "시계가 뒤로 가도 10을 넘지 않는다");
  assert.equal(classroomMoveLeft(null, NOW), 0);
  assert.equal(classroomMoveShare(counting.pending, NOW), 1);
  assert.equal(classroomMoveShare(counting.pending, NOW + 5000), 0.5);
  assert.equal(classroomMoveShare(counting.pending, NOW + 20_000), 0);
  assert.equal(classroomMoveShare(null, NOW), 0);
  // 아직이면 같은 객체(화면이 다시 그리지 않게)
  assert.equal(classroomMoveDue(counting, NOW + 9999), counting);
  // 다 셌다 — 내놓는다: 무대가 시계를 보지 않고 따르고(live), 다른 화면의 사람도 데려온다(pull)
  const done = classroomMoveDue(counting, NOW + 10_000);
  assert.equal(done.pending, null);
  assert.deepEqual(done.released, { to: "classroom", at: T, live: true, pull: true, tick: NOW + 10_000 });
  // 가려 둔 탭의 느린 타이머(1분에 한 번)는 제때로 친다
  assert.equal(classroomMoveDue(counting, NOW + 10_000 + 60_000).released.pull, true);
  assert.equal(classroomMoveDue(counting, NOW + 10_000 + CLASSROOM_MOVE_LATE_PULL_MS).released.pull, true);
  // 세는 중이 아니면 그대로
  assert.equal(classroomMoveDue(done, NOW + 99_000), done);
  assert.equal(classroomMoveDue(base, NOW), base);
  assert.equal(classroomMoveDue(undefined, NOW), undefined);
});

test("다 센 때보다 한참 늦게 내놓게 됐으면(잠든 기기 · 얼린 탭) 데려오지 않는다", () => {
  const counting = classroomMoveFeed(watching(), sig("classroom", T), NOW);
  const late = classroomMoveDue(counting, NOW + 10_000 + CLASSROOM_MOVE_LATE_PULL_MS + 1);
  assert.equal(late.pending, null);
  assert.deepEqual(late.released, { to: "classroom", at: T, live: false, pull: false, tick: NOW + 10_000 + CLASSROOM_MOVE_LATE_PULL_MS + 1 },
    "'이미 있던 신호'로 — 책 광장 탭을 열면 한 시간 안의 것만 따른다");
  // 기기 시계가 뒤로 갔으면 영영 기다리지 않고 곧바로 내놓는다
  const back = classroomMoveDue(counting, NOW - 60_000);
  assert.equal(back.pending, null);
  assert.equal(back.released.pull, true);
  // 조금(2초 안) 뒤로 간 것은 그대로 센다
  assert.equal(classroomMoveDue(counting, NOW - 1500), counting);
});

test("새 신호가 아닌 것 — 같은 값 · 옛 값 · 잠깐 비었다 돌아온 값은 아무 일도 하지 않는다(같은 객체)", () => {
  const base = watching("plaza", T);
  for (const signal of [sig("plaza", T), sig("classroom", T), sig("classroom", T - 1), sig(null, 0, 0), sig("classroom", 0), null, undefined, {}]) {
    assert.equal(classroomMoveFeed(base, signal, NOW), base, JSON.stringify(signal));
  }
  // 세는 중에도 같다 — 같은 문서를 두 곳(상단바 · 책방 페이지)이 먹여도 다시 세지 않는다
  const counting = classroomMoveFeed(base, sig("classroom", T + 1), NOW);
  assert.equal(classroomMoveFeed(counting, sig("classroom", T + 1), NOW + 3000), counting);
  assert.equal(classroomMoveFeed(counting, sig("plaza", T), NOW + 3000), counting, "옛 값이 뒤늦게 와도");
});

test("취소 — 방이 아닌 새 신호는 세던 것을 걷고, 잠깐 '취소됐어요'를 띄운다", () => {
  const base = watching("plaza", T - 500);
  const counting = classroomMoveFeed(base, sig("classroom", T), NOW);
  const cancelled = classroomMoveFeed(counting, sig(null, T + 1, 0), NOW + 4000);
  assert.equal(cancelled.pending, null);
  assert.deepEqual(cancelled.dropped, { to: "classroom", at: T + 1, tick: NOW + 4000 });
  assert.equal(cancelled.released, base.released, "아무도 옮기지 않는다");
  assert.equal(cancelled.seen, T + 1);
  assert.equal(classroomMoveDue(cancelled, NOW + 99_000), cancelled);
  // 띄워 두는 시간
  assert.equal(classroomMoveDropShown(cancelled.dropped, NOW + 4000), true);
  assert.equal(classroomMoveDropShown(cancelled.dropped, NOW + 4000 + CLASSROOM_MOVE_DROP_MS - 1), true);
  assert.equal(classroomMoveDropShown(cancelled.dropped, NOW + 4000 + CLASSROOM_MOVE_DROP_MS), false);
  assert.equal(classroomMoveDropShown(cancelled.dropped, NOW - 60_000), false, "시계가 크게 뒤로 가면 띄우지 않는다");
  assert.equal(classroomMoveDropShown(null, NOW), false);
  // 취소한 뒤 다시 누르면 처음부터 10초
  const again = classroomMoveFeed(cancelled, sig("classroom", T + 2), NOW + 6000);
  assert.deepEqual(again.pending, { to: "classroom", at: T + 2, wait: 10, since: NOW + 6000, until: NOW + 16_000 });
  assert.equal(again.dropped, null);
  // 세는 중이 아닐 때 온 취소(이미 옮긴 뒤) — 되돌리지 않고, '취소됐어요'도 없다
  const done = classroomMoveDue(counting, NOW + 10_000);
  const lateCancel = classroomMoveFeed(done, sig(null, T + 1, 0), NOW + 12_000);
  assert.equal(lateCancel.released, done.released);
  assert.equal(lateCancel.dropped, null);
});

test("세는 중에 온 더 새 신호 — 그 신호로 처음부터 다시 센다", () => {
  const counting = classroomMoveFeed(watching(), sig("classroom", T), NOW);
  const next = classroomMoveFeed(counting, sig("plaza", T + 1), NOW + 3000);
  assert.deepEqual(next.pending, { to: "plaza", at: T + 1, wait: 10, since: NOW + 3000, until: NOW + 13_000 });
  assert.equal(classroomMoveDue(next, NOW + 10_000), next, "앞 신호의 10초에 옮기지 않는다");
  assert.equal(classroomMoveDue(next, NOW + 13_000).released.to, "plaza");
});

test("셀 시간이 없는 신호(이 칸이 생기기 전의 화면이 보낸 것) — 그때처럼 광장 탭의 화면만 곧바로", () => {
  const base = watching();
  const now = classroomMoveFeed(base, sig("classroom", T, 0), NOW);
  assert.equal(now.pending, null, "알림을 띄우지 않는다");
  assert.deepEqual(now.released, { to: "classroom", at: T, live: true, pull: false, tick: NOW }, "다른 화면에서 데려오지 않는다");
  // 세는 중에 오면 세던 것을 걷고 곧바로
  const counting = classroomMoveFeed(base, sig("classroom", T), NOW);
  const direct = classroomMoveFeed(counting, sig("plaza", T + 1, 0), NOW + 2000);
  assert.equal(direct.pending, null);
  assert.equal(direct.released.to, "plaza");
});

test("잠들었다 깬 기기에 밀려 온 신호(stale) — 세지 않고 '이미 있던 신호'로 둔다", () => {
  const base = watching("plaza", T - 500);
  const woke = classroomMoveFeed(base, sig("classroom", T), NOW, { stale: true });
  assert.equal(woke.pending, null, "어제 누른 신호로 '선생님이 부르고 있어요'를 띄우지 않는다");
  assert.deepEqual(woke.released, { to: "classroom", at: T, live: false, pull: false, tick: NOW });
  assert.equal(woke.seen, T);
  // 밀려 온 취소 — 아무것도 바꾸지 않는다(본 것으로만 적음)
  const cancel = classroomMoveFeed(base, sig(null, T, 0), NOW, { stale: true });
  assert.equal(cancel.released, base.released);
  assert.equal(cancel.seen, T);
  assert.equal(cancel.dropped, null);
  // 새 신호가 아니면 stale이어도 그대로
  assert.equal(classroomMoveFeed(base, sig("plaza", T - 500), NOW, { stale: true }), base);
  // 그 뒤(깬 지 한참 지나) 온 신호는 다시 센다
  assert.equal(classroomMoveFeed(woke, sig("plaza", T + 1), NOW + 200_000).pending.to, "plaza");
});

test("셀 시간이 틀린 모양으로 넘어와도 천장을 넘지 않는다", () => {
  const big = classroomMoveFeed(watching(), sig("classroom", T, 99999), NOW);
  assert.equal(big.pending.wait, CLASSROOM_MOVE_WAIT_MAX_S);
  assert.equal(big.pending.until, NOW + CLASSROOM_MOVE_WAIT_MAX_S * 1000);
  assert.equal(classroomMoveLeft(big.pending, NOW), CLASSROOM_MOVE_WAIT_MAX_S);
  // 소수 초
  const half = classroomMoveFeed(watching(), sig("classroom", T, 2.5), NOW);
  assert.equal(half.pending.until, NOW + 2500);
  assert.equal(classroomMoveLeft(half.pending, NOW), 3);
});

test("데려갈 주소 — 책 광장 탭. 책방에 있었으면 고른 학생은 남기고 활동 · 창을 여는 칸은 뺀다", () => {
  assert.equal(classroomMoveUrl("/dashboard", "?class=c1"), "/books?area=reading&tab=plaza");
  assert.equal(classroomMoveUrl("/books", ""), "/books?area=reading&tab=plaza");
  assert.equal(classroomMoveUrl("/books", "?activity=a1&view=all&face=cloud"), "/books?area=reading&tab=plaza");
  assert.equal(classroomMoveUrl("/books", "?area=leaderboard"), "/books?area=reading&tab=plaza");
  assert.equal(classroomMoveUrl("/books", "?area=reading&student=u1&book=b1"), "/books?area=reading&student=u1&tab=plaza");
  assert.equal(classroomMoveUrl("/books", "?open=fruit"), "/books?area=reading&tab=plaza");
  assert.equal(classroomMoveUrl("/books", "?area=reading&tab=library"), "/books?area=reading&tab=plaza");
  assert.equal(classroomMoveUrl(), "/books?area=reading&tab=plaza");
});

test("무대에 넘길 신호 — 다 센 뒤에 내놓인 것. 반 문서를 아직 먹이기 전이면 그 문서의 값을 '이미 있던 신호'로", () => {
  const classDoc = { classroomMoveTo: "classroom", classroomMoveAt: T, classroomMoveWait: 10 };
  // 아직 먹이기 전(상태가 처음) — 문서의 값이 '이미 있던 신호'다. 세는 중이던 신호라도 지켜본 것이 아니다
  assert.deepEqual(classroomMoveShown(CLASSROOM_MOVE_IDLE, classDoc), { to: "classroom", at: T, live: false, pull: false, tick: 0 });
  assert.deepEqual(classroomMoveShown(undefined, classDoc, NOW), { to: "classroom", at: T, live: false, pull: false, tick: NOW });
  assert.equal(classroomMoveShown(CLASSROOM_MOVE_IDLE, null), null, "반 문서도 아직 없음");
  assert.equal(classroomMoveShown(CLASSROOM_MOVE_IDLE, { classroomMoveTo: null, classroomMoveAt: T }), null, "취소로 끝나 있던 반");
  assert.equal(classroomMoveShown(CLASSROOM_MOVE_IDLE, {}), null);
  // 먹인 뒤에는 상태가 내놓은 것만 — 처음 본 값은 문서에서 읽은 것과 같은 방 · 같은 때라 무대가 다시 움직이지 않는다
  const base = classroomMoveFeed(CLASSROOM_MOVE_IDLE, classroomMoveSignal(classDoc), NOW);
  assert.equal(classroomMoveShown(base, classDoc), base.released);
  assert.equal(classroomMoveShown(base, classDoc).at, classroomMoveShown(CLASSROOM_MOVE_IDLE, classDoc).at);
  assert.equal(classroomMoveShown(base, classDoc).to, classroomMoveShown(CLASSROOM_MOVE_IDLE, classDoc).to);
  // 세는 동안 — 문서에는 새 신호가 적혀 있어도 무대에는 앞의 것만 넘긴다(아직 아무도 안 옮김)
  const next = { classroomMoveTo: "plaza", classroomMoveAt: T + 1, classroomMoveWait: 10 };
  const counting = classroomMoveFeed(base, classroomMoveSignal(next), NOW + 1000);
  assert.equal(classroomMoveShown(counting, next).at, T);
  assert.equal(classroomMoveShown(counting, next).to, "classroom");
  // 다 세면 새 신호
  const done = classroomMoveDue(counting, NOW + 11_000);
  assert.deepEqual(classroomMoveShown(done, next), { to: "plaza", at: T + 1, live: true, pull: true, tick: NOW + 11_000 });
  // 신호가 한 번도 없던 반을 먹인 뒤
  assert.equal(classroomMoveShown(classroomMoveFeed(CLASSROOM_MOVE_IDLE, classroomMoveSignal({}), NOW), {}), null);
});
