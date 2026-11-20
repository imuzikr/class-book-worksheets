// 공지사항을 학생 화면 가운데에 글자만 잠시(선생님 요청) — 어떤 공지를 띄울지 고르는 셈(lib/classNoticeSpot.js).
// 화면을 연 뒤에 온 공지는 기기 시계를 보지 않고, 처음부터 있던 공지는 한 시간 안의 것만, 이미 본 것은 다시 안 띄웁니다.
// 여러 개면 보낸 차례대로 하나씩, 한 공지는 글 길이에 따라 5 ~ 30초 머뭅니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_FLASH_MAX_MS, NOTICE_FLASH_MIN_MS, NOTICE_SPOT_FRESH_MS, NOTICE_SPOT_MAX, NOTICE_SEEN_ROOM,
  nextNoticeFlash, noticeFlashMs, noticeMs, noticeSeenAfter, pickNoticeSpot,
} from "../../lib/classNoticeSpot.js";

const T = 1794500000000;   // 선생님이 보낸 때(서버 시각)
const MIN = 60 * 1000;
const n = (id, ms, text = `공지 ${id}`) => ({ id, text, sentAt: ms === null ? null : { toMillis: () => ms } });

test("열쇠 · 숫자 — 벨과 같은 '여기까지 봤다' 칸 · 한 시간 · 셋까지", () => {
  assert.equal(NOTICE_SEEN_ROOM, "notice");
  assert.equal(NOTICE_SPOT_FRESH_MS, 60 * MIN);
  assert.equal(NOTICE_SPOT_MAX, 3);
});

test("서버 시각 읽기 — Timestamp · Date · 숫자 · {seconds}, 아직 없는 시각과 범위 밖 값은 0", () => {
  assert.equal(noticeMs(n("a", T)), T);
  assert.equal(noticeMs({ sentAt: new Date(T) }), T);
  assert.equal(noticeMs({ sentAt: T }), T);
  assert.equal(noticeMs({ sentAt: { seconds: T / 1000, nanoseconds: 500e6 } }), T + 500);
  assert.equal(noticeMs({ sentAt: { toDate: () => new Date(T) } }), T);
  assert.equal(noticeMs({ sentAt: null }), 0, "서버가 아직 답하지 않은 시각");
  assert.equal(noticeMs({}), 0);
  assert.equal(noticeMs({ sentAt: 9e15 }), 0, "아주 큰 수");
  assert.equal(noticeMs({ sentAt: -5 }), 0);
});

test("화면을 연 뒤에 온 공지 — 기기 시계가 몇 시간 틀려도 곧바로 띄움", () => {
  const base = new Set(["old"]);
  const notices = [n("old", T - 24 * 60 * MIN), n("new", T)];   // 어제 공지 — 처음부터 있던 것
  for (const nowMs of [T, T + 5 * 60 * MIN, T - 5 * 60 * MIN]) {
    const spot = pickNoticeSpot({ notices, seenMs: 0, baseIds: base, nowMs });
    assert.deepEqual(spot.map((x) => x.id), ["new"], `기기 시계 ${(nowMs - T) / MIN}분 차이`);
  }
});

test("처음부터 있던 공지 — 한 시간 안의 것만(늦게 들어온 학생), 시계가 뒤로 틀려 '앞날'로 보여도 띄움", () => {
  const notices = [n("a", T - 30 * MIN), n("b", T - 90 * MIN)];
  const base = new Set(["a", "b"]);
  assert.deepEqual(pickNoticeSpot({ notices, baseIds: base, nowMs: T }).map((x) => x.id), ["a"], "90분 전 공지는 안 띄움");
  assert.deepEqual(pickNoticeSpot({ notices, baseIds: base, nowMs: T - 120 * MIN }).map((x) => x.id), ["a", "b"], "기기 시계가 두 시간 늦음");
  assert.deepEqual(pickNoticeSpot({ notices: [n("y", T - 24 * 60 * MIN)], baseIds: new Set(["y"]), nowMs: T }), [], "어제 공지는 오늘 화면을 가리지 않음");
});

test("이미 본 것 — '여기까지 봤다'보다 늦은 공지만(벨에서 읽은 것도 같은 표시)", () => {
  const notices = [n("a", T - 10 * MIN), n("b", T - 5 * MIN), n("c", T)];
  const base = new Set(["a", "b", "c"]);
  assert.deepEqual(pickNoticeSpot({ notices, seenMs: T - 5 * MIN, baseIds: base, nowMs: T }).map((x) => x.id), ["c"]);
  assert.deepEqual(pickNoticeSpot({ notices, seenMs: T, baseIds: base, nowMs: T }), []);
});

test("여럿이면 새것부터 셋까지 · 글이 없거나 시각을 모르는 공지는 건너뜀", () => {
  const notices = [n("a", T - 4), n("b", T - 3), n("c", T - 2), n("d", T - 1), n("e", T), n("blank", T + 1, "   "), n("pending", null)];
  const spot = pickNoticeSpot({ notices, baseIds: new Set(), nowMs: T });
  assert.deepEqual(spot.map((x) => x.id), ["e", "d", "c"]);
  assert.equal(spot[0].ms, T, "고른 공지에는 서버 시각(ms)을 붙여 둠");
  assert.equal(spot[0].text, "공지 e");
  assert.deepEqual(pickNoticeSpot({ notices: [n("x", T, "  안녕  ")], baseIds: new Set(), nowMs: T })[0].text, "안녕", "앞뒤 빈칸을 걷음");
  assert.deepEqual(pickNoticeSpot({ notices: null, nowMs: T }), [], "목록이 없어도 멈추지 않음");
});

test("머무는 시간 — 빈칸을 뺀 글자마다 0.15초 + 3초, 짧아도 5초 · 길어도 30초", () => {
  assert.equal(NOTICE_FLASH_MIN_MS, 5000);
  assert.equal(NOTICE_FLASH_MAX_MS, 30000);
  assert.equal(noticeFlashMs("여러분 안녕하세요."), 5000, "짧은 공지(9자)도 5초");
  assert.equal(noticeFlashMs(""), 5000);
  assert.equal(noticeFlashMs(null), 5000);
  const sixty = "가".repeat(60);
  assert.equal(noticeFlashMs(sixty), 3000 + 60 * 150, "60자는 12초");
  assert.equal(noticeFlashMs(`${"가".repeat(30)} \n  ${"가".repeat(30)}`), 12000, "빈칸 · 줄바꿈은 세지 않음");
  assert.equal(noticeFlashMs("가".repeat(500)), 30000, "500자도 30초에서 멈춤");
  assert.equal(noticeFlashMs("🙂".repeat(20)), 6000, "그림 글자는 한 글자로");
});

test("다음에 띄울 공지 — 띄울 것들 가운데 가장 먼저 보낸 것(보낸 차례대로)", () => {
  const pending = pickNoticeSpot({ notices: [n("a", T - 20), n("b", T - 10), n("c", T)], baseIds: new Set(), nowMs: T });
  assert.deepEqual(pending.map((x) => x.id), ["c", "b", "a"], "고르기는 새것부터");
  assert.equal(nextNoticeFlash(pending).id, "a", "띄우기는 먼저 보낸 것부터");
  assert.equal(nextNoticeFlash(pending).ms, T - 20);
  assert.equal(nextNoticeFlash([n("x", T), n("y", T - 5)]).id, "y", "ms가 없으면 서버 시각에서 셈");
  assert.equal(nextNoticeFlash([]), null);
  assert.equal(nextNoticeFlash(null), null);
  assert.equal(nextNoticeFlash([{ id: "z", text: "시각 모름" }]), null, "시각을 모르는 공지는 건너뜀");
  // 띄운 것을 '봤다'로 적으면 그다음 것이 나옴 — 남은 공지는 그대로
  const after = pickNoticeSpot({ notices: [n("a", T - 20), n("b", T - 10), n("c", T)], seenMs: noticeSeenAfter(0, [nextNoticeFlash(pending)]), baseIds: new Set(), nowMs: T });
  assert.equal(nextNoticeFlash(after).id, "b");
  assert.deepEqual(after.map((x) => x.id), ["c", "b"]);
});

test("띄운 뒤의 표시 — 앞으로만(더 옛 공지를 띄워도 이미 본 새 공지가 되살아나지 않게)", () => {
  assert.equal(noticeSeenAfter(0, [{ ms: T }, { ms: T - 5 }]), T);
  assert.equal(noticeSeenAfter(T + 10, [{ ms: T }]), T + 10);
  assert.equal(noticeSeenAfter(T, []), T);
  assert.equal(noticeSeenAfter(null, [n("a", T)]), T, "ms가 없으면 시각에서 셈");
});
