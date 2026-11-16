// 광장 대화의 셈(lib/readingPlazaTalk.js) — 요청 · 다시 요청 · 고르는 상자 · 말 · 말풍선 · 마주 설 자리 · 선생님 기록 · 그림
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import {
  TALK_ART, TALK_ASK_AGAIN_MS, TALK_ASK_MS, TALK_GAP, TALK_MAX, TALK_STALE_MS, TALK_TEXT_MAX,
  plazaTalkHistory, plazaTalkSpot, readTalkAsk, readTalkLine, readTalkMembers, sortTalkLines, talkInProgress,
  talkArtBox, talkAskAcceptable, talkAskAgainIn, talkAskTitle, talkBubbles, talkCallName, talkChoice, talkIdOk, talkIncoming,
  talkNewId, talkStale, talkTextOf, talkUnread, talkEnterKey, talkLineBreak, talkEnterStillWaiting, TALK_ENTER_WAIT_MS,
} from "@/lib/readingPlazaTalk";
import { CLASSROOM_ROOM, PLAZA_ROOM, PLAZA_SPAWN, plazaPortalAt, plazaWalkable } from "@/lib/readingPlazaMap";
import { classroomSeatSide } from "@/lib/readingClassroom";
import { plazaTalkOn, teacherFeatureSettings, TEACHER_FEATURES } from "@/lib/reading";

const NOW = 1_800_000_000_000;
const ask = (over = {}) => ({ t: NOW - 1000, i: "ask_000001", ...over });

test("그림 — 31장이 모두 있고, 지도 표시 · 아이콘은 표시 크기의 두 배, 창 틀 · 단추 바탕은 원본의 절반", async () => {
  const arts = Object.values(TALK_ART);
  assert.equal(arts.length, 31);
  for (const art of arts) {
    const meta = await sharp(path.join(path.resolve("public"), art.src.replace(/^\//, ""))).metadata();
    const [sw, sh] = art.size;
    let w, h;
    if (art.slice) { w = Math.round(sw / 2); h = Math.round(sh / 2); }
    else if (sw >= sh) { w = art.w * 2; h = sh * w / sw; }
    else { h = art.h * 2; w = sw * h / sh; }
    assert.ok(Math.abs(meta.width - w) <= 1 && Math.abs(meta.height - h) <= 1, `${art.src} — ${meta.width}×${meta.height} (기대 ${w}×${h.toFixed?.(0) ?? h})`);
    assert.equal(meta.format, "webp", art.src);
  }
});

test("그림 — 표시 상자: 비율 그대로 · 말풍선은 꼬리 끝이 닻 · 여럿 말풍선은 닻이 왼쪽(0.37)", () => {
  const talking = talkArtBox(TALK_ART.talking);
  assert.deepEqual([talking.w, talking.h], [34, 30]);
  assert.equal(talking.left, -17);
  assert.equal(talking.top, -29);
  const group = talkArtBox(TALK_ART.group);
  assert.equal(group.left, -13, "겹친 말풍선 — 앞쪽 꼬리가 그림 가운데보다 왼쪽");
  const accepted = talkArtBox(TALK_ART.accepted);
  assert.deepEqual([accepted.w, accepted.h], [34, 34], "세로가 더 긴 그림은 높이 기준");
  const ring = talkArtBox(TALK_ART.ring);
  assert.deepEqual([ring.w, ring.h, ring.left, ring.top], [64, 36, -32, -18], "선택 타원은 가운데가 닻");
});

test("요청 — 대답을 기다림 · 승인 · 거절 · 거둠 · 20초가 지나면 닫힘", () => {
  assert.equal(readTalkAsk(ask(), NOW).state, "waiting");
  assert.equal(readTalkAsk(ask(), NOW).left, TALK_ASK_MS - 1000);
  assert.deepEqual([readTalkAsk(ask({ ok: "talk_00001" }), NOW).state, readTalkAsk(ask({ ok: "talk_00001" }), NOW).talk], ["accepted", "talk_00001"]);
  assert.equal(readTalkAsk(ask({ no: 1 }), NOW).state, "declined");
  assert.equal(readTalkAsk(ask({ x: 1 }), NOW).state, "cancelled");
  assert.equal(readTalkAsk(ask({ t: NOW - TALK_ASK_MS - 1 }), NOW).state, "expired");
  assert.equal(readTalkAsk(ask({ k: "talk_00002" }), NOW).k, "talk_00002", "이미 이야기하는 무리로 초대");
  assert.equal(readTalkAsk(ask({ k: "../x" }), NOW).k, null, "모양이 틀린 대화 번호는 버림");
  for (const bad of [null, "x", {}, { t: NOW }, { i: "ask_000001" }, { t: -1, i: "ask_000001" }, { t: NOW, i: "a/b" }]) {
    assert.equal(readTalkAsk(bad, NOW), null, JSON.stringify(bad));
  }
});

test("요청 — 나에게 온 것 가운데 기다리는 것만, 먼저 온 것부터", () => {
  const list = talkIncoming({
    late: ask({ t: NOW - 500 }),
    early: ask({ t: NOW - 3000 }),
    done: ask({ t: NOW - 2000, no: 1 }),
    old: ask({ t: NOW - TALK_ASK_MS - 10 }),
    "bad/uid": ask(),
  }, NOW);
  assert.deepEqual(list.map((a) => a.from), ["early", "late"]);
  assert.deepEqual(talkIncoming(null, NOW), []);
});

test("다시 요청 — 같은 친구에게는 앞 요청을 보낸 때에서 15초 뒤부터(선생님 결정)", () => {
  assert.equal(TALK_ASK_AGAIN_MS, 15000);
  assert.equal(talkAskAgainIn(0, NOW), 0);
  assert.equal(talkAskAgainIn(NOW - 5000, NOW), 10000);
  assert.equal(talkAskAgainIn(NOW - 15000, NOW), 0);
  assert.equal(talkAskAgainIn(NOW - 60000, NOW), 0);
});

test("승인 — 그 번호의 요청이 아직 기다리는 중일 때만(늦게 닿은 승인 · 거둔 요청 · 다른 요청은 받지 않음)", () => {
  assert.equal(talkAskAcceptable(ask(), "ask_000001", NOW), true);
  assert.equal(talkAskAcceptable(ask(), "ask_000002", NOW), false, "그사이 새로 보낸 다른 요청");
  assert.equal(talkAskAcceptable(ask({ x: 1 }), "ask_000001", NOW), false, "보낸 사람이 거둠");
  assert.equal(talkAskAcceptable(ask({ no: 1 }), "ask_000001", NOW), false);
  assert.equal(talkAskAcceptable(ask({ ok: "talk_00001" }), "ask_000001", NOW), false, "이미 승인됨(두 번 누름)");
  assert.equal(talkAskAcceptable(ask({ t: NOW - TALK_ASK_MS - 1000 }), "ask_000001", NOW), true, "와이파이로 조금 늦게 닿은 승인(3초 안)");
  assert.equal(talkAskAcceptable(ask({ t: NOW - TALK_ASK_MS - 4000 }), "ask_000001", NOW), false);
  assert.equal(talkAskAcceptable(null, "ask_000001", NOW), false);
});

test("이름 — '○○님이 대화를 요청합니다.' · 선생님 · 이름을 모를 때 · 무리로 초대", () => {
  assert.equal(talkCallName("가람"), "가람님");
  assert.equal(talkCallName("가람", true), "선생님");
  assert.equal(talkCallName(""), "친구");
  assert.equal(talkAskTitle("가람"), "가람님이 대화를 요청합니다.");
  assert.equal(talkAskTitle("선생님", true), "선생님이 대화를 요청합니다.");
  assert.equal(talkAskTitle("", false), "친구가 대화를 요청합니다.");
  assert.equal(talkAskTitle("나래", false, true), "나래님이 대화에 초대합니다.");
});

test("고르는 상자 — 대화 초대를 할 수 있는가와 그 까닭", () => {
  assert.equal(talkChoice({}).kind, "invite");
  assert.equal(talkChoice({ myTalk: "talk_00001", myCount: 2 }).kind, "invite", "대화 중에 다른 친구를 초대");
  assert.equal(talkChoice({ friendTalk: "talk_00001", myTalk: "talk_00001", myCount: 2 }).kind, "same");
  assert.equal(talkChoice({ friendTalk: "talk_00009" }).kind, "busy");
  assert.equal(talkChoice({ myTalk: "talk_00001", myCount: TALK_MAX }).kind, "full");
  assert.equal(talkChoice({ myTalk: "talk_00001", myCount: TALK_MAX }).text, "대화는 4명까지 함께할 수 있어요.");
  assert.equal(talkChoice({ outgoing: { to: "u2" } }).kind, "pending");
  assert.equal(talkChoice({ againIn: 9100 }).text, "10초 뒤에 다시 초대할 수 있어요.");
});

test("말 — 앞뒤 빈칸 · 빈 줄 정리, 200자까지", () => {
  assert.deepEqual(talkTextOf("  안녕\r\n\n\n\n반가워  "), { text: "안녕\n\n반가워", error: "" });
  assert.deepEqual(talkTextOf("   "), { text: "", error: "" });
  assert.equal(talkTextOf("가".repeat(TALK_TEXT_MAX)).error, "");
  assert.equal(talkTextOf("가".repeat(TALK_TEXT_MAX + 1)).error, "한 마디는 200자까지 쓸 수 있어요.");
  assert.equal(talkTextOf("😀".repeat(TALK_TEXT_MAX)).error, "", "그림 글자도 한 글자");
});

test("쓰는 칸의 Enter — Enter는 보내기 · Shift+Enter는 줄바꿈 · 한글 조합 중이면 조합이 끝난 뒤(선생님 요청)", () => {
  assert.equal(talkEnterKey({ key: "Enter" }), "send");
  assert.equal(talkEnterKey({ key: "Enter", code: "NumpadEnter" }), "send", "숫자 자판의 Enter");
  assert.equal(talkEnterKey({ key: "Enter", shiftKey: true }), "newline", "Shift+Enter는 줄바꿈 그대로");
  assert.equal(talkEnterKey({ key: "Enter", shiftKey: true, composing: true }), "newline");
  assert.equal(talkEnterKey({ key: "Enter", composing: true }), "later", "맥 · 조합 중의 Enter — 조합이 끝나면 보냄(걸러 내기만 하면 첫 Enter가 먹힘)");
  assert.equal(talkEnterKey({ key: "Process", code: "Enter", composing: true }), "later", "윈도 — 입력기가 받은 키는 key가 'Process', code로 Enter를 알아봄");
  assert.equal(talkEnterKey({ key: "Enter", code: "Enter" }), "send", "조합을 마친 뒤 한 번 더 오는 Enter(맥 크롬) — 보내되 이미 빈 칸이라 아무 일 없음");
  assert.equal(talkEnterKey({ key: "a", code: "KeyA" }), null);
  assert.equal(talkEnterKey({ key: "Process", code: "KeyA", composing: true }), null);
  assert.equal(talkEnterKey(), null);
  assert.equal(talkEnterKey({ key: "Enter", ctrlKey: true }), "send", "Ctrl+Enter도 보냄(예전 손버릇)");
});

test("쓰는 칸의 줄바꿈(beforeinput) — Shift+Enter가 연 것만 들이고 나머지는 막고 보냄", () => {
  assert.equal(talkLineBreak({ inputType: "insertLineBreak" }), "send", "keydown 없이 줄바꿈만 오는 휴대폰 자판");
  assert.equal(talkLineBreak({ inputType: "insertParagraph" }), "send");
  assert.equal(talkLineBreak({ inputType: "insertLineBreak", newlineOk: true }), "allow", "Shift+Enter");
  assert.equal(talkLineBreak({ inputType: "insertLineBreak", composing: true }), "later");
  assert.equal(talkLineBreak({ inputType: "insertText" }), null, "글자는 그대로");
  assert.equal(talkLineBreak({ inputType: "insertFromPaste" }), null, "붙여 넣은 여러 줄은 그대로");
  assert.equal(talkLineBreak({ inputType: "insertCompositionText" }), null);
  assert.equal(talkLineBreak(), null);
});

test("조합 중에 누른 Enter — 조합이 곧 끝날 때만 지켜 줌", () => {
  const at = 1_000_000;
  assert.equal(talkEnterStillWaiting(at, at), true);
  assert.equal(talkEnterStillWaiting(at, at + 30), true);
  assert.equal(talkEnterStillWaiting(at, at + TALK_ENTER_WAIT_MS - 1), true);
  assert.equal(talkEnterStillWaiting(at, at + TALK_ENTER_WAIT_MS), false, "늦게 끝난 조합은 다음 말의 것 — 보내지 않음");
  assert.equal(talkEnterStillWaiting(0, at), false, "누른 적 없음");
  assert.equal(talkEnterStillWaiting(at, at - 5), false, "시계가 뒤로 감");
  assert.equal(talkEnterStillWaiting(NaN, at), false);
});

test("말 — 받은 한 줄(말 · 들어옴 · 나감)과 차례", () => {
  assert.deepEqual(readTalkLine("l1", { u: "u1", x: "안녕", t: 5 }), { id: "l1", uid: "u1", kind: "say", text: "안녕", t: 5 });
  assert.equal(readTalkLine("l2", { u: "u1", s: "join", t: 6 }).kind, "join");
  assert.equal(readTalkLine("l3", { u: "u1", s: "leave", t: 7 }).kind, "leave");
  for (const bad of [null, { u: "u1", t: 5 }, { u: "u1", x: "", t: 5 }, { u: "a/b", x: "x", t: 5 }, { u: "u1", x: "x" }]) {
    assert.equal(readTalkLine("b", bad), null, JSON.stringify(bad));
  }
  const sorted = sortTalkLines([{ id: "b", t: 2 }, { id: "c", t: 1 }, { id: "a", t: 2 }]);
  assert.deepEqual(sorted.map((l) => l.id), ["c", "a", "b"]);
});

test("든 사람 — 들어온 차례 · 이름이 없으면 기록의 이름 · 선생님 표시", () => {
  const members = readTalkMembers({ u2: { n: "나래", j: 20 }, u1: { n: "가람", j: 10 }, t1: { j: 30, r: 1 }, "x/y": { n: "?" } }, { t1: "선생님" });
  assert.deepEqual(members.map((m) => [m.uid, m.name, m.teacher]), [["u1", "가람", false], ["u2", "나래", false], ["t1", "선생님", true]]);
  assert.deepEqual(readTalkMembers(null), []);
});

test("새 말 수 · 오래 쉰 대화", () => {
  const lines = [{ kind: "say", uid: "me", t: 30 }, { kind: "say", uid: "u2", t: 40 }, { kind: "join", uid: "u3", t: 50 }, { kind: "say", uid: "u2", t: 60 }];
  assert.equal(talkUnread(lines, "me", 0), 2);
  assert.equal(talkUnread(lines, "me", 40), 1);
  assert.equal(talkStale(NOW - 60 * 1000, NOW), false);
  assert.equal(talkStale(NOW - 31 * 60 * 1000, NOW), true);
  assert.equal(talkStale(0, NOW), true);
});

test("말풍선 — 같은 대화가 둘이면 대화 중, 셋 이상 보이면 여럿이 이야기하는 말풍선", () => {
  const bubbles = talkBubbles([
    { uid: "a", talk: "talk_00001" }, { uid: "b", talk: "talk_00001" },
    { uid: "c", talk: "talk_00002" }, { uid: "d", talk: "talk_00002" }, { uid: "e", talk: "talk_00002" },
    { uid: "f", talk: null }, { uid: "g", talk: "bad" },
  ]);
  assert.equal(bubbles.get("a"), "talking");
  assert.equal(bubbles.get("c"), "group");
  assert.equal(bubbles.has("f"), false);
  assert.equal(bubbles.has("g"), false, "모양이 틀린 번호는 그리지 않음");
});

test("마주 설 자리 — 상대 곁(걸어오는 쪽)의 바닥에 서고, 서로 마주 봄", () => {
  const target = { x: PLAZA_SPAWN.x, y: PLAZA_SPAWN.y };
  const left = plazaTalkSpot({ target, mover: { x: 300, y: 400 }, room: PLAZA_ROOM });
  assert.deepEqual([left.x, left.y], [target.x - TALK_GAP, target.y]);
  assert.deepEqual([left.facing, left.back], ["right", "left"]);
  const right = plazaTalkSpot({ target, mover: { x: 1400, y: 380 }, room: PLAZA_ROOM });
  assert.deepEqual([right.x, right.y, right.facing, right.back], [target.x + TALK_GAP, target.y, "left", "right"]);
  // 다른 사람이 서 있는 자리는 피함
  const avoid = plazaTalkSpot({ target, mover: { x: 300, y: 400 }, room: PLAZA_ROOM, others: [{ x: target.x - TALK_GAP + 10, y: target.y }] });
  assert.notDeepEqual([avoid.x, avoid.y], [target.x - TALK_GAP, target.y]);
  assert.ok(plazaWalkable(avoid.x, avoid.y, PLAZA_ROOM));
  for (const s of [left, right, avoid]) assert.equal(plazaPortalAt(s, PLAZA_ROOM, 8), null);
});

test("마주 설 자리 — 교실에서 앉아 있는 상대에게는 그 책상의 러그 귀(걸어오는 쪽)로", () => {
  const mover = { x: 200, y: 700 };
  const spot = plazaTalkSpot({ target: { x: 300, y: 400 }, mover, room: CLASSROOM_ROOM, seat: 7 });
  const side = classroomSeatSide(7, mover);
  assert.deepEqual([spot.x, spot.y, spot.back], [side.stand.x, side.stand.y, null]);
});

test("선생님 기록 — 최근 대화가 위, 대화 안은 때 차례 · 이름 · 그 학생의 말 표시", () => {
  const rows = plazaTalkHistory([
    { id: "talk_00001", at: 100, names: { u1: "가람", u2: "나래" }, lines: [{ id: "b", u: "u2", x: "응", t: 120 }, { id: "a", u: "u1", x: "안녕", t: 110 }] },
    { id: "talk_00002", at: 200, names: { u1: "가람", u3: "다온" }, lines: [{ id: "c", u: "u3", x: "반가워", t: 210 }, { id: "d", u: "u3", s: "leave", t: 220 }] },
    { id: "bad id", at: 300, names: {}, lines: [] },
  ], "u1");
  assert.deepEqual(rows.map((r) => r.id), ["talk_00002", "talk_00001"]);
  assert.deepEqual(rows[1].lines.map((l) => [l.text, l.name, l.mine]), [["안녕", "가람", true], ["응", "나래", false]]);
  assert.equal(rows[0].says, 1);
  assert.deepEqual(rows[0].people.map((p) => p.name), ["가람", "다온"]);
});

test("선생님 기록 지우기 — 이야기하는 중인 대화(talkInProgress)는 든 사람이 있고 30분 안에 움직임이 있을 때만", () => {
  assert.equal(talkInProgress(null, NOW), false);
  assert.equal(talkInProgress({ a: NOW - 1000, n: { u1: "가람" }, l: { x: { u: "u1", x: "안녕", t: NOW - 500 } } }, NOW), false, "든 사람이 없으면 끝난 대화");
  assert.equal(talkInProgress({ a: NOW - 1000, m: { u1: { n: "가람", j: NOW - 1000 } } }, NOW), true, "막 만든 대화");
  const old = NOW - 2 * TALK_STALE_MS;
  assert.equal(talkInProgress({ a: old, m: { u1: { j: old } }, l: { x: { u: "u1", x: "안녕", t: NOW - TALK_STALE_MS - 1 } } }, NOW), false,
    "'나감' 없이 떠난 사람만 남아 30분 넘게 움직임이 없으면 끝난 것으로");
  assert.equal(talkInProgress({ a: old, m: { u1: { j: old } }, l: [{ u: "u1", x: "방금", t: NOW - 1000 }] }, NOW), true, "말(체험반은 배열)도 셈");
  assert.equal(talkInProgress({ a: old, m: { u1: { j: NOW - 60_000 } } }, NOW), true, "방금 들어온 사람");
  // 기록 줄에 그대로 실림(기록 창이 그 대화의 '지우기'를 쉬게 함)
  const rows = plazaTalkHistory([
    { id: "talk_00001", at: 100, names: { u1: "가람" }, lines: [], ongoing: true },
    { id: "talk_00002", at: 200, names: { u1: "가람" }, lines: [] },
  ], "u1");
  assert.deepEqual(rows.map((r) => [r.id, r.ongoing]), [["talk_00002", false], ["talk_00001", true]]);
});

test("번호 — 대화 · 요청 번호의 모양", () => {
  const id = talkNewId();
  assert.equal(id.length, 20);
  assert.equal(talkIdOk(id), true);
  assert.notEqual(talkNewId(), talkNewId());
  assert.equal(talkIdOk("short"), false);
});

test("스위치 — 책 광장이 켜진 반에서 선생님이 켰을 때만(기본 꺼짐) · 관리자 설정의 한 값", () => {
  assert.equal(plazaTalkOn({ readingEnabled: true, plazaEnabled: true, plazaTalkEnabled: true }), true);
  assert.equal(plazaTalkOn({ readingEnabled: true, plazaEnabled: true }), false, "값이 없으면 꺼짐");
  assert.equal(plazaTalkOn({ readingEnabled: true, plazaEnabled: false, plazaTalkEnabled: true }), false, "책 광장을 끈 반");
  assert.equal(plazaTalkOn({ readingEnabled: false, plazaEnabled: true, plazaTalkEnabled: true }), false, "책 봄을 끈 반");
  assert.equal(TEACHER_FEATURES.includes("plazaTalkEnabled"), true);
  const both = teacherFeatureSettings([{ plazaTalkEnabled: true }, { plazaTalkEnabled: false }]);
  assert.deepEqual(both.plazaTalkEnabled, { on: false, mixed: true });
});
