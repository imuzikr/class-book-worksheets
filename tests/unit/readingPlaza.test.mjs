import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReadingAction, deriveReading, featureValue, initialReadingState, plazaNeedsSync, plazaOn, teacherFeatureSettings } from "../../lib/reading.js";
import {
  PLAZA_BOOK_CAP, PLAZA_COMMENT_MAX, PLAZA_LOG_CAP, PLAZA_SHARE_RULE,
  plazaCommentText, plazaFriends, plazaHasContent, plazaItems, plazaNameLabel,
  plazaProjection, plazaStable, plazaThisWeek, plazaWeekStart,
} from "../../lib/readingPlaza.js";
import {
  PLAZA_BODY, PLAZA_H, PLAZA_SPAWN, PLAZA_SPOTS, PLAZA_W,
  plazaCamera, plazaClear, plazaNearest, plazaPath, plazaSpotAt, plazaSpotNear, plazaStep, plazaView, plazaWalkable,
} from "../../lib/readingPlazaMap.js";
import {
  FACING_STICK, PET_GAP, PET_PEEK, PET_PEEK_BACK, PLAZA_PET_SHEET_KEYS, PLAZA_WALK_SPEED, SPRITE_BODY, SPRITE_CELL, SPRITE_FOOT, WALK_SEQUENCE, WALK_STRIDE,
  plazaCharacterSheet, plazaCharacterSize, plazaFacing, plazaPetFollow, plazaPetHeel, plazaPetPeek, plazaPetScale, plazaPetSheet, plazaPetSize, plazaPetStart, plazaPetStep,
  plazaShownFrame, plazaSpriteCell, plazaTrailBehind, plazaTrailPush, plazaWalkFrame,
} from "../../lib/readingPlazaSprites.js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PET_SPECIES_KEYS } from "../../lib/readingPet.js";
import { CHARACTER_STYLE_OPTIONS, characterOf } from "../../lib/readingCharacterCatalog.js";

// 2026-11-12(목) 12:00 서울 — 그 주의 월요일은 11-09
const NOW = "2026-11-12T03:00:00.000Z";
const ctx = (id, extra = {}) => ({ uid: "stu", classId: "classA", now: NOW, id, ...extra });
const at = (iso, id, extra = {}) => ({ uid: "stu", classId: "classA", now: iso, id, ...extra });
const run = (state, action, context) => applyReadingAction(state, action, context);
const addBook = (state, id, pages = 20) => run(state, { type: "addBook", title: `책 ${id}`, author: "지은이", totalPages: pages }, ctx(id));
const addLog = (state, id, bookId, a, b, extra = {}, date = "2026-11-12") => run(state,
  { type: "addLog", bookId, date, startPage: a, endPage: b, notes: `발자국 ${id}` }, ctx(id, extra));
const project = (state, classId = "classA", options) => plazaProjection(deriveReading(state, new Date(NOW)), classId, options);

test("책 광장 스위치 — 책나눔이 켜진 반에서 켰을 때만(기본 꺼짐)", () => {
  assert.equal(plazaOn({ readingEnabled: true }), false);
  assert.equal(plazaOn({ readingEnabled: true, plazaEnabled: true }), true);
  assert.equal(plazaOn({ readingEnabled: false, plazaEnabled: true }), false);
  assert.equal(plazaOn({ readingEnabled: true, plazaEnabled: true, archived: true }), false);
  assert.equal(featureValue({}, "plazaEnabled"), false);
  assert.equal(teacherFeatureSettings([{ id: "a", plazaEnabled: true }, { id: "b" }]).plazaEnabled.on, false);
  assert.equal(teacherFeatureSettings([{ id: "a", plazaEnabled: true }]).plazaEnabled.on, true);
});

// ── 무엇이 반 친구에게 보이나 — 선생님 결정: "학생이 선택할 수 있는 옵션을 제거하고 모두 공개" ──
test("모두 공개 — 그 반에서 쓴 독서 발자국은 언제 썼든 모두 사본에 실린다(학생이 고르는 것이 없음)", () => {
  let s = addBook(initialReadingState(), "book1", 40);
  s = addLog(s, "log00001", "book1", 1, 10);
  s = addLog(s, "log00002", "book1", 11, 20);
  // 발자국에 공개 도장을 찍지 않는다(옛 화면이 넘기던 표시는 읽지 않음)
  assert.equal("plaza" in s.logs[0], false);
  assert.equal("plaza" in run(s, { type: "addLog", bookId: "book1", date: "2026-11-12", startPage: 21, endPage: 22, notes: "도장 없이" }, ctx("log00009", { plaza: true })).logs[2], false);
  let p = project(s);
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].place, "stall");
  assert.equal(p.entries[0].logs, 2);
  assert.deepEqual(p.books.book1.logs.map((l) => l.id).sort(), ["log00001", "log00002"]);
  assert.equal(p.books.book1.review, null);
  // 고치면 고친 글이 그대로 따라간다
  s = run(s, { type: "updateLog", logId: "log00001", notes: "고친 글" }, ctx("x0000001"));
  p = project(s);
  assert.equal(p.books.book1.logs.find((l) => l.id === "log00001").notes, "고친 글");
  // 지우면 빠진다 — 다 지우면 책도 내려간다
  s = run(s, { type: "deleteLog", logId: "log00001" }, ctx("x0000002"));
  assert.deepEqual(project(s).books.book1.logs.map((l) => l.id), ["log00002"]);
  s = run(s, { type: "deleteLog", logId: "log00002" }, ctx("x0000003"));
  assert.equal(project(s).entries.length, 0);
  // 글이 하나도 없는 책(등록만 한 책)은 싣지 않는다
  assert.equal(project(addBook(initialReadingState(), "book7", 40)).entries.length, 0);
  // 기준을 바꾸면 번호를 올린다 — 1은 학생이 고른 글만 싣던 때(그 번호의 사본은 서버가 통째로 다시 씀)
  assert.ok(Number.isInteger(PLAZA_SHARE_RULE) && PLAZA_SHARE_RULE >= 2);
});

test("반 전체를 한 번 맞출 일이 있는가 — 광장을 켠 반인데 지금 기준으로 맞춘 표시가 없을 때만", () => {
  const on = { readingEnabled: true, plazaEnabled: true };
  assert.equal(plazaNeedsSync(on), true, "켠 반 · 아직 맞춘 적 없음");
  assert.equal(plazaNeedsSync({ ...on, plazaSynced: 1 }), true, "옛 기준으로 맞춘 반은 다시");
  assert.equal(plazaNeedsSync({ ...on, plazaSynced: PLAZA_SHARE_RULE }), false, "지금 기준으로 맞춘 반");
  // 광장을 끈 반 · 책나눔을 끈 반 · 반을 아직 모를 때는 부탁하지 않는다
  assert.equal(plazaNeedsSync({ readingEnabled: true, plazaEnabled: false }), false);
  assert.equal(plazaNeedsSync({ readingEnabled: true, plazaEnabled: false, plazaSynced: 1 }), false);
  assert.equal(plazaNeedsSync({ readingEnabled: false, plazaEnabled: true }), false);
  assert.equal(plazaNeedsSync(null), false);
  assert.equal(plazaNeedsSync(undefined), false);
});

test("모두 공개 — 옛 표시(도장 없음 · '발자국 보이기' 끔 · 안 꽂음)가 남은 서재도 모두 실린다", () => {
  // 학생이 고르던 때에 저장된 서재 — 도장 없는 발자국, 숨긴 책, 꽂지 않은 한 권의 책
  let s = addBook(initialReadingState(), "book1", 20);
  s = addLog(s, "log00001", "book1", 1, 20);
  s = run(s, { type: "saveReview", bookId: "book1", text: "끝까지 읽었다", rating: 4 }, ctx("rev00001"));
  s = addBook(s, "book2", 40);
  s = addLog(s, "log00002", "book2", 1, 5);
  s = { ...s, books: s.books.map((b) => (b.id === "book2" ? { ...b, plazaHidden: true } : b)) };
  const p = project(s);
  assert.deepEqual(p.entries.map((e) => [e.id, e.place]).sort(), [["book1", "shelf"], ["book2", "stall"]]);
  assert.equal(p.books.book1.review.text, "끝까지 읽었다");
  assert.equal(p.books.book2.logs.length, 1);
  // 사본에는 책 제목 · 쪽수 · 글만 — 서재의 다른 칸(반 id · 옛 표시)은 싣지 않는다
  assert.deepEqual(Object.keys(p.books.book1.logs[0]).sort(), ["createdAt", "date", "endPage", "id", "notes", "startPage"]);
  assert.deepEqual(Object.keys(p.books.book1.review).sort(), ["createdAt", "rating", "text", "updatedAt"]);
  assert.equal(JSON.stringify(p).includes("plazaHidden"), false);
});

test("완독한 책은 책꽂이에 — 한 권의 책을 쓰기 전에도, 쓴 뒤에도(꽂는 단추가 없음)", () => {
  let s = addBook(initialReadingState(), "book1", 20);
  s = addLog(s, "log00001", "book1", 1, 10);
  assert.equal(project(s).entries[0].place, "stall");
  s = run(s, { type: "addLog", bookId: "book1", date: "2026-11-12", startPage: 11, endPage: 20, notes: "발자국 log00002" }, at("2026-11-12T03:30:00.000Z", "log00002"));
  // 완독 — 한 권의 책을 아직 안 썼어도 책꽂이로 옮겨 가고, 발자국이 그대로 보인다
  let p = project(s);
  assert.deepEqual([p.entries[0].place, p.entries[0].rating, p.books.book1.review, p.books.book1.logs.length], ["shelf", null, null, 2]);
  assert.equal(p.entries[0].excerpt, "발자국 log00002");
  // 한 권의 책을 쓰면 곧바로 보인다
  s = run(s, { type: "saveReview", bookId: "book1", text: "끝까지 읽었다", rating: 4 }, at("2026-11-12T04:00:00.000Z", "rev00001"));
  assert.equal("shelved" in s.reviews[0], false);
  p = project(s);
  assert.deepEqual([p.entries[0].place, p.entries[0].rating, p.entries[0].excerpt], ["shelf", 4, "끝까지 읽었다"]);
  assert.equal(p.books.book1.review.text, "끝까지 읽었다");
  assert.equal(p.books.book1.logs.length, 2);
  assert.equal(p.entries[0].last, "2026-11-12T04:00:00.000Z");
  // 한 권의 책을 지워도 책은 책꽂이에 남는다(발자국이 있으므로)
  s = run(s, { type: "deleteReview", bookId: "book1" }, ctx("x0000001"));
  assert.deepEqual([project(s).entries[0].place, project(s).books.book1.review], ["shelf", null]);
});

test("걷은 요청 — 옛 화면이 보내는 '빼기 · 숨기기'는 까닭을 알려 거절하고, '꽂기 · 보이기'는 아무 일 없이 받는다", () => {
  let s = addBook(initialReadingState(), "book1", 20);
  s = addLog(s, "log00001", "book1", 1, 20);
  s = run(s, { type: "saveReview", bookId: "book1", text: "끝까지 읽었다", rating: 4 }, ctx("rev00001"));
  const before = JSON.stringify(s);
  assert.throws(() => run(s, { type: "shelveReview", bookId: "book1", shelved: false }, ctx("x0000001")), /모두 함께 읽어요/);
  assert.throws(() => run(s, { type: "setBookPlaza", bookId: "book1", hidden: true }, ctx("x0000002")), /모두 함께 읽어요/);
  assert.equal(JSON.stringify(run(s, { type: "shelveReview", bookId: "book1", shelved: true }, ctx("x0000003"))), before);
  assert.equal(JSON.stringify(run(s, { type: "setBookPlaza", bookId: "book1", hidden: false }, ctx("x0000004"))), before);
  // 옛 화면이 한 권의 책에 함께 보내던 shelved는 읽지 않는다(어떤 값이든 저장은 되고 표시는 남지 않음)
  for (const shelved of [true, false, "yes"]) {
    const saved = run(s, { type: "saveReview", bookId: "book1", text: "고쳐 쓴 글", rating: 5, shelved }, ctx(`x000001${String(shelved).length}`));
    assert.equal(saved.reviews[0].text, "고쳐 쓴 글");
    assert.equal("shelved" in saved.reviews[0], false);
    assert.equal(project(saved).entries[0].place, "shelf");
  }
  // 옛 표시가 남은 한 권의 책을 고쳐 쓰면 표시도 함께 걷힌다
  const old = { ...s, reviews: s.reviews.map((r) => ({ ...r, shelved: true, shelvedAt: NOW })) };
  const again = run(old, { type: "saveReview", bookId: "book1", text: "다시", rating: 3 }, ctx("x0000009"));
  assert.deepEqual(["shelved" in again.reviews[0], "shelvedAt" in again.reviews[0]], [false, false]);
});

test("보관한 책 · 선생님이 내린 책 · 다른 반에서 쓴 글은 사본에 없다", () => {
  let s = addBook(initialReadingState(), "book1", 40);
  s = addBook(s, "book2", 40);
  s = addLog(s, "log00001", "book1", 1, 10);
  s = run(s, { type: "addLog", bookId: "book2", date: "2026-11-12", startPage: 1, endPage: 5, notes: "다른 반" }, { uid: "stu", classId: "classB", now: NOW, id: "log00002" });
  assert.deepEqual(project(s).entries.map((e) => e.id), ["book1"]);
  assert.deepEqual(project(s, "classB").entries.map((e) => e.id), ["book2"]);
  assert.equal(project(s, "classA", { blocked: ["book1"] }).entries.length, 0);
  // 다른 반에서 쓴 한 권의 책도 이 반의 사본에는 없다
  let r = addBook(initialReadingState(), "book3", 10);
  r = addLog(r, "log00003", "book3", 1, 10);
  r = run(r, { type: "saveReview", bookId: "book3", text: "이 반의 글", rating: 5 }, ctx("rev00003"));
  assert.equal(project(r, "classB").entries.length, 0);
  assert.equal(project(r).books.book3.review.text, "이 반의 글");
  // 보관함으로 옮긴 책은 내려가고, 돌려놓으면 다시 올라온다
  s = run(s, { type: "archiveBook", bookId: "book1", archived: true }, ctx("x0000001"));
  assert.equal(project(s).entries.length, 0);
  assert.equal(project(run(s, { type: "archiveBook", bookId: "book1", archived: false }, ctx("x0000002"))).entries.length, 1);
  // 이 반에서 쓴 글이 있는가(서버가 사본을 살펴볼지 정함) — 보관 · 옛 표시와 상관없이
  assert.equal(plazaHasContent(s, "classA"), true);
  assert.equal(plazaHasContent(s, "classB"), true);
  assert.equal(plazaHasContent(s, "classC"), false);
  assert.equal(plazaHasContent(initialReadingState(), "classA"), false);
  assert.equal(plazaHasContent(r, "classA"), true);
});

test("사본은 최근 발자국부터 정해진 수만 싣고, 목록은 최근에 쓴 책부터", () => {
  let s = addBook(initialReadingState(), "book1", 200);
  for (let i = 0; i < PLAZA_LOG_CAP + 5; i += 1) {
    s = run(s, { type: "addLog", bookId: "book1", date: "2026-11-10", startPage: i + 1, endPage: i + 1, notes: `n${i}` },
      at(new Date(Date.parse("2026-11-10T00:00:00Z") + i * 60000).toISOString(), `log${String(i).padStart(5, "0")}`));
  }
  const p = project(s);
  assert.equal(p.entries[0].logs, PLAZA_LOG_CAP + 5);
  assert.equal(p.books.book1.logs.length, PLAZA_LOG_CAP);
  assert.equal(p.books.book1.logCount, PLAZA_LOG_CAP + 5);
  assert.equal(p.books.book1.logs[0].notes, `n${PLAZA_LOG_CAP + 4}`);
  // 책이 많으면 최근에 쓴 책부터 PLAZA_BOOK_CAP권
  let many = initialReadingState();
  for (let i = 0; i < PLAZA_BOOK_CAP + 3; i += 1) {
    const id = `bk${String(i).padStart(6, "0")}`;
    many = run(many, { type: "addBook", title: `책 ${i}`, author: "지은이", totalPages: 50 }, ctx(id));
    many = run(many, { type: "addLog", bookId: id, date: "2026-11-10", startPage: 1, endPage: 5, notes: "읽음" },
      at(new Date(Date.parse("2026-11-10T00:00:00Z") + i * 60000).toISOString(), `lg${String(i).padStart(6, "0")}`));
  }
  const q = project(many);
  assert.equal(q.entries.length, PLAZA_BOOK_CAP);
  assert.equal(Object.keys(q.books).length, PLAZA_BOOK_CAP);
  assert.equal(q.entries[0].id, `bk${String(PLAZA_BOOK_CAP + 2).padStart(6, "0")}`);
});

test("바뀐 것만 다시 쓰도록 — 같은 내용은 같은 값", () => {
  assert.equal(plazaStable({ b: 1, a: [1, { d: 2, c: 3 }] }), plazaStable({ a: [1, { c: 3, d: 2 }], b: 1 }));
  assert.notEqual(plazaStable({ a: 1 }), plazaStable({ a: 2 }));
  assert.equal(plazaStable({ a: undefined }), plazaStable({ a: null }));
});

test("이번 주 — 서울 시각 월요일 0시부터", () => {
  assert.equal(plazaWeekStart(NOW), "2026-11-09T00:00:00+09:00");
  assert.equal(plazaThisWeek("2026-11-08T15:00:00.000Z", NOW), true);   // 월요일 0시(서울)
  assert.equal(plazaThisWeek("2026-11-08T14:59:59.000Z", NOW), false);  // 일요일 밤
  assert.equal(plazaThisWeek(null, NOW), false);
  assert.equal(plazaThisWeek("엉뚱한 값", NOW), false);
});

test("목록 — 가판대/책꽂이 · 이번 주가 앞 · 친구별", () => {
  const shelves = [
    { uid: "u2", name: "이도윤", studentId: "30102", counts: { b1: 2, b9: 5 }, books: [
      { id: "b1", place: "stall", last: "2026-11-11T01:00:00.000Z" },
      { id: "b2", place: "shelf", last: "2026-10-20T01:00:00.000Z" },
    ] },
    { uid: "u1", name: "김민준", studentId: "30101", books: [
      { id: "b1", place: "stall", last: "2026-11-01T01:00:00.000Z" },
      { id: "b3", place: "stall", last: "2026-11-12T01:00:00.000Z" },
    ] },
    { uid: "u3", name: "박서준", studentId: "30103", books: [] },
    null,
  ];
  const stall = plazaItems(shelves, { place: "stall", now: NOW });
  assert.deepEqual(stall.week.map((r) => r.key), ["u1_b3", "u2_b1"]);
  assert.deepEqual(stall.earlier.map((r) => r.key), ["u1_b1"]);
  assert.equal(stall.week[1].comments, 2);
  assert.equal(stall.week[0].name, "김민준");
  const shelf = plazaItems(shelves, { place: "shelf", now: NOW });
  assert.deepEqual([shelf.week.length, shelf.earlier.map((r) => r.key)], [0, ["u2_b2"]]);
  assert.deepEqual(plazaItems(shelves, { place: "stall", friendUid: "u2", now: NOW }).week.map((r) => r.key), ["u2_b1"]);
  assert.deepEqual(plazaFriends(shelves).map((f) => [f.studentId, f.stall, f.shelf]), [["30101", 2, 0], ["30102", 1, 1]]);
});

test("이름표 · 댓글 검사", () => {
  assert.equal(plazaNameLabel({ name: "홍길동", studentId: "30105" }), "30105 홍길동");
  assert.equal(plazaNameLabel({ name: "홍길동" }), "홍길동");
  assert.equal(plazaNameLabel({ byTeacher: true, name: "김교사" }), "선생님");
  assert.equal(plazaCommentText("  좋아요\r\n다음 장도 궁금해요  "), "좋아요\n다음 장도 궁금해요");
  assert.throws(() => plazaCommentText("   "), /댓글/);
  assert.throws(() => plazaCommentText("가".repeat(PLAZA_COMMENT_MAX + 1)), /댓글/);
  assert.throws(() => plazaCommentText(12), /댓글/);
  assert.equal(plazaCommentText("가".repeat(PLAZA_COMMENT_MAX)).length, PLAZA_COMMENT_MAX);
});

// ── 걷는 길 ──
test("광장 지도 — 처음 서는 자리와 여는 곳 앞은 걸을 수 있고, 물건 위는 못 간다", () => {
  assert.equal(plazaWalkable(PLAZA_SPAWN.x, PLAZA_SPAWN.y), true);
  for (const spot of PLAZA_SPOTS) {
    assert.equal(plazaWalkable(spot.stand.x, spot.stand.y), true, `${spot.id} 앞`);
    const [x0, y0, x1, y1] = spot.rect;
    assert.equal(plazaWalkable((x0 + x1) / 2, (y0 + y1) / 2), false, `${spot.id} 위`);
    assert.equal(plazaSpotAt((x0 + x1) / 2, (y0 + y1) / 2)?.id, spot.id);
    assert.equal(plazaSpotNear(spot.stand)?.id, spot.id);
  }
  assert.equal(plazaWalkable(836, 500), false);   // 분수
  assert.equal(plazaWalkable(836, 420), false);   // 분수 뒤(물줄기 기둥)
  assert.equal(plazaWalkable(1520, 700), false);  // 그네
  assert.equal(plazaWalkable(-5, 400), false);
  assert.equal(plazaWalkable(PLAZA_W + 5, PLAZA_H + 5), false);
  assert.equal(plazaSpotAt(836, 700), null);
  assert.equal(plazaSpotNear(PLAZA_SPAWN), null);
  // 처음 서는 자리는 책꽂이와 분수 사이 — 맵이 화면을 가득 채워 위아래가 잘려도 책꽂이 · 가판대가 처음부터 보이게
  assert.ok(PLAZA_SPAWN.y > 222 && PLAZA_SPAWN.y < 380);
  assert.deepEqual(PLAZA_SPOTS.map((s) => s.place), ["shelf", "stall", "stall", "stall"]);
});

test("길 찾기 — 어디서든 여는 곳까지 이어지고, 걷는 구간은 모두 바닥 위", () => {
  const starts = [PLAZA_SPAWN, ...PLAZA_SPOTS.map((s) => s.stand), { x: 836, y: 300 }, { x: 1300, y: 880 }, { x: 300, y: 900 }];
  for (const from of starts) {
    for (const spot of PLAZA_SPOTS) {
      const path = plazaPath(from, spot.stand);
      assert.ok(path.length >= 1, `${JSON.stringify(from)} → ${spot.id}`);
      assert.deepEqual(path.at(-1), spot.stand);
      let here = from;
      for (const point of path) {
        assert.equal(plazaClear(here, point), true, `${spot.id} 가는 길이 막힌 곳을 지남`);
        here = point;
      }
      assert.ok(path.length <= 8, "곧게 갈 수 있는 구간은 한 번에 잇는다");
    }
  }
  // 분수를 사이에 두면 돌아간다
  const around = plazaPath({ x: 836, y: 330 }, { x: 836, y: 640 });
  assert.ok(around.length >= 2);
  // 막힌 곳을 눌러도 가장 가까운 바닥까지
  const toStall = plazaPath(PLAZA_SPAWN, { x: 120, y: 380 });
  assert.equal(plazaWalkable(toStall.at(-1).x, toStall.at(-1).y), true);
  const near = plazaNearest(836, 500);
  assert.equal(plazaWalkable(near.x, near.y), true);
  assert.ok(Math.hypot(near.x - 836, near.y - 500) < 120);
  assert.deepEqual(plazaNearest(700, 700), { x: 700, y: 700 });
});

test("방향키 걸음 — 막히면 벽을 따라 미끄러진다", () => {
  assert.deepEqual(plazaStep({ x: 700, y: 700 }, 10, 0), { x: 710, y: 700 });
  // 책꽂이 앞에서 위로는 못 가지만 옆으로는 간다
  const top = { x: 800, y: 200 };
  assert.deepEqual(plazaStep(top, 0, -10), top);
  assert.deepEqual(plazaStep(top, 10, -10), { x: 810, y: 200 });
});

test("방향키 걸음 — 분수에 막히면 둘레를 돌아 지나간다(처음 자리에서 아래로만 눌러도)", () => {
  const stride = 330 / 60;   // 한 프레임의 걸음
  const walk = (from, dx, dy, frames = 420) => {
    let p = { ...from };
    const memo = { turn: 0, key: "" };
    for (let i = 0; i < frames; i += 1) {
      p = plazaStep(p, dx * stride, dy * stride, memo);
      assert.equal(plazaWalkable(p.x, p.y), true, "걷는 내내 바닥 위");
    }
    return p;
  };
  assert.ok(walk(PLAZA_SPAWN, 0, 1).y > 700, "처음 자리에서 ↓ — 분수를 돌아 마당 아래까지");
  assert.ok(walk({ x: 836, y: 760 }, 0, -1).y < 300, "분수 아래에서 ↑");
  // 분수는 받침과 기둥(타원 둘)이 겹친 모양 — 둘이 만나는 오목한 자리에 끼지 않는다
  assert.ok(walk({ x: 500, y: 480 }, 1, 0).x > 1000, "분수의 왼쪽 어깨에서 →");
  assert.ok(walk({ x: 1200, y: 470 }, -1, 0).x < 600, "분수의 오른쪽 어깨에서 ←");
  assert.ok(walk({ x: 600, y: 300 }, Math.SQRT1_2, Math.SQRT1_2).y > 700, "대각선 ↘");
  assert.ok(walk({ x: 1050, y: 700 }, -Math.SQRT1_2, -Math.SQRT1_2).y < 300, "대각선 ↖");
  // 도는 쪽을 기억하지 않아도(memo 없이) 바닥 밖으로 나가지 않는다
  let p = { ...PLAZA_SPAWN };
  for (let i = 0; i < 240; i += 1) {
    p = plazaStep(p, 0, stride);
    assert.equal(plazaWalkable(p.x, p.y), true);
  }
  // 방향키가 바뀌면 도는 쪽을 새로 고른다
  const memo = { turn: 0, key: "" };
  let q = { ...PLAZA_SPAWN };
  for (let i = 0; i < 20; i += 1) q = plazaStep(q, 0, stride, memo);
  assert.notEqual(memo.turn, 0);
  plazaStep(q, -stride, 0, memo);
  assert.equal(memo.key, "-1,0");
});

test("무대 — 그림이 보이는 창을 빈틈없이 덮고, 시점은 캐릭터를 따라가되 그림 밖을 보이지 않는다", () => {
  // 넓적한 창 — 폭에 맞추고 위아래가 넘친다
  const wide = plazaView(1600, 500);
  assert.equal(Math.round(wide.worldW), 1600);
  assert.ok(wide.worldH > 500);
  // 길쭉한 창(폰) — 높이에 맞추고 좌우가 넘친다
  const tall = plazaView(400, 560);
  assert.equal(Math.round(tall.worldH), 560);
  assert.ok(tall.worldW > 400);
  // 그림과 같은 비율이면 딱 맞아 시점이 움직일 일이 없다
  const same = plazaView(PLAZA_W / 2, PLAZA_H / 2);
  assert.equal(same.scale, 0.5);
  assert.deepEqual(plazaCamera(same, { x: 300, y: 800 }), { x: 0, y: 0 });
  for (const view of [wide, tall, plazaView(1300, 720), plazaView(900, 300)]) {
    assert.ok(view.worldW >= view.w - 1e-6 && view.worldH >= view.h - 1e-6, "그림이 창보다 작지 않다");
    for (const pos of [PLAZA_SPAWN, { x: 0, y: 0 }, { x: PLAZA_W, y: PLAZA_H }, { x: 250, y: 436 }, { x: 1414, y: 420 }, { x: 836, y: 900 }]) {
      const cam = plazaCamera(view, pos);
      assert.ok(cam.x >= 0 && cam.x <= view.worldW - view.w + 1e-6, "가로로 그림 밖을 보이지 않는다");
      assert.ok(cam.y >= 0 && cam.y <= view.worldH - view.h + 1e-6, "세로로 그림 밖을 보이지 않는다");
    }
  }
  // 처음 서는 자리 — 넓적한 창에서도 책꽂이(그림 맨 위)가 함께 보인다
  assert.ok(plazaCamera(wide, PLAZA_SPAWN).y / wide.scale < 40);
  // 아래로 내려가면 시점이 따라 내려가고, 맨 아래에서는 그림의 바닥에서 멈춘다
  assert.ok(plazaCamera(wide, { x: 836, y: 700 }).y > plazaCamera(wide, PLAZA_SPAWN).y);
  assert.equal(Math.round(plazaCamera(wide, { x: 836, y: 926 }).y), Math.round(wide.worldH - wide.h));
  // 폰 — 좌우로는 캐릭터가 창 가운데에 온다
  const camTall = plazaCamera(tall, PLAZA_SPAWN);
  assert.ok(Math.abs(camTall.x + tall.w / 2 - PLAZA_SPAWN.x * tall.scale) < 1e-6);
  // 크기를 아직 모르면 시점은 0
  assert.deepEqual(plazaCamera(plazaView(0, 0), PLAZA_SPAWN), { x: 0, y: 0 });
});

// ── 걷는 그림 · 펫 따라오기 (lib/readingPlazaSprites.js) ──
const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

test("걷는 그림 — 캐릭터 30종 · 펫 10종의 시트가 모두 있다", () => {
  for (const [style] of CHARACTER_STYLE_OPTIONS) {
    for (let number = 1; number <= 10; number += 1) {
      const sheet = plazaCharacterSheet({ style, number });
      assert.equal(sheet, `/reading-plaza/sprites/${style}-${String(number).padStart(2, "0")}.webp`);
      assert.equal(existsSync(PUBLIC + sheet), true, sheet);
    }
  }
  // 캐릭터를 아직 안 고른 학생(기본 캐릭터)도 시트가 있다
  assert.equal(existsSync(PUBLIC + plazaCharacterSheet(characterOf({ uid: "아무개" }))), true);
  assert.deepEqual([...PLAZA_PET_SHEET_KEYS].sort(), [...PET_SPECIES_KEYS].sort());
  for (const species of PET_SPECIES_KEYS) assert.equal(existsSync(PUBLIC + plazaPetSheet(species)), true, species);
  // 알(종 없음) · 모르는 값은 시트가 없다 — 알은 공통 알 그림을, 모르는 캐릭터는 예전 그림을 씀
  assert.equal(plazaPetSheet(null), null);
  assert.equal(plazaPetSheet("dragon"), null);
  assert.equal(plazaCharacterSheet({ style: "advanced", number: 1 }), null);
  assert.equal(plazaCharacterSheet({ style: "zodiac", number: 11 }), null);
  assert.equal(plazaCharacterSheet(null), null);
});

test("걷는 그림 — 방향: 좌우로 더 가면 옆모습, 45도 근처에서는 직전 방향을 지킨다", () => {
  assert.equal(plazaFacing(null, 0, 0), "down");            // 처음에는 앞모습
  assert.equal(plazaFacing("up", 0, 0), "up");              // 멈추면 보던 쪽 그대로
  assert.equal(plazaFacing(null, 5, 1), "right");
  assert.equal(plazaFacing(null, -5, 1), "left");
  assert.equal(plazaFacing(null, 1, 5), "down");
  assert.equal(plazaFacing(null, 1, -5), "up");
  // 45도보다 조금 가로 · 조금 세로 — 직전 방향 쪽으로 기울어 판정한다
  assert.ok(FACING_STICK > 1);
  assert.equal(plazaFacing("down", 5.5, 5), "down");
  assert.equal(plazaFacing("right", 5, 5.5), "right");
  assert.equal(plazaFacing("left", -5, 5.5), "left");
  // 확실히 넘어가면 바뀐다
  assert.equal(plazaFacing("down", 8, 5), "right");
  assert.equal(plazaFacing("right", 5, 8), "down");
  assert.equal(plazaFacing("right", -5, 1), "left");
  // 비스듬히 걷는 내내(작은 흔들림이 있어도) 그림이 번갈아 바뀌지 않는다
  let facing = "down";
  let flips = 0;
  for (let i = 0; i < 200; i += 1) {
    const next = plazaFacing(facing, 5 + Math.sin(i) * 0.6, 5 + Math.cos(i * 1.7) * 0.6);
    if (next !== facing) flips += 1;
    facing = next;
  }
  assert.equal(flips, 0);
});

test("걷는 그림 — 칸: 왼쪽은 오른쪽 줄을 뒤집고, 걸은 거리로 걷기 A → 정지 → 걷기 B → 정지", () => {
  assert.deepEqual(plazaSpriteCell("down", 0), { row: 0, col: 0, mirror: false });
  assert.deepEqual(plazaSpriteCell("right", 1), { row: 1, col: 1, mirror: false });
  assert.deepEqual(plazaSpriteCell("left", 2), { row: 1, col: 2, mirror: true });
  assert.deepEqual(plazaSpriteCell("up", 0), { row: 2, col: 0, mirror: false });
  assert.deepEqual(plazaSpriteCell("모름", 9), { row: 0, col: 0, mirror: false });
  assert.deepEqual(WALK_SEQUENCE, [1, 0, 2, 0]);
  const seen = [];
  for (let d = 0; d < WALK_STRIDE * 8; d += WALK_STRIDE) seen.push(plazaWalkFrame(d + 1));
  assert.deepEqual(seen, [1, 0, 2, 0, 1, 0, 2, 0]);
  assert.equal(plazaWalkFrame(0), 1);            // 걸음을 떼는 순간 걷기 A부터
  assert.equal(plazaWalkFrame(-5), 1);
  // 걷는 빠르기에서 초당 8장쯤(선생님이 주신 묶음의 안내는 초당 7장)
  assert.ok(PLAZA_WALK_SPEED / WALK_STRIDE > 6.5 && PLAZA_WALK_SPEED / WALK_STRIDE < 10);
});

test("걷는 그림 — 걷는 동안에는 늘 넘긴다(기기의 '애니메이션 줄이기' 설정을 보지 않음)", () => {
  // 걷는 중이면 걸은 거리로 고른 걷는 그림, 멈추면 정지 그림
  const walked = [];
  for (let d = 0; d < WALK_STRIDE * 4; d += WALK_STRIDE) walked.push(plazaShownFrame(true, d + 1));
  assert.deepEqual(walked, [1, 0, 2, 0]);
  assert.equal(plazaShownFrame(false, WALK_STRIDE * 2 + 1), 0);
  // 펫은 제 걸음 거리로
  assert.equal(plazaShownFrame(true, 23, 22), 0);
  assert.equal(plazaShownFrame(true, 45, 22), 2);
  // 받는 것은 '걷는 중인가 · 걸은 거리 · 한 장의 거리' 셋뿐 — 기기 설정을 받을 자리가 없다
  assert.equal(plazaShownFrame.length, 2);
  // 무대(components/reading/ReadingPlaza.jsx)가 걷는 그림을 고르는 네 자리(내 캐릭터 · 내 펫 · 친구 · 친구의 펫)는
  // 모두 이 셈을 쓰고, 기기의 '움직임 줄이기'(calm)를 끼워 넣지 않는다. 한때 끼워 넣어, 그 설정이 켜진 기기에서
  // 캐릭터가 발을 안 움직이고 미끄러져 다녔다(선생님 신고).
  const stage = readFileSync(fileURLToPath(new URL("../../components/reading/ReadingPlaza.jsx", import.meta.url)), "utf8");
  const picks = stage.split("\n").filter((line) => /\.(show|showPet)\(/.test(line) && !/SPRITE_IDLE\)/.test(line));
  assert.equal(picks.length, 4, "걷는 그림을 고르는 자리는 넷");
  for (const line of picks) {
    assert.match(line, /plazaShownFrame\(/, line.trim());
    assert.doesNotMatch(line, /calm/, line.trim());
  }
  assert.doesNotMatch(stage, /plazaWalkFrame\(/, "무대는 plazaWalkFrame을 곧바로 부르지 않는다(plazaShownFrame을 거침)");
  // CSS — 움직임을 줄여 달라고 한 기기에서도 알이 통통 뛰는 것(걷는 모습)은 끄지 않는다
  const css = readFileSync(fileURLToPath(new URL("../../components/reading/plaza.css", import.meta.url)), "utf8");
  const calmBlocks = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) ?? [];
  assert.ok(calmBlocks.length >= 2);
  for (const block of calmBlocks) assert.doesNotMatch(block, /plaza-pet\.is-moving|plaza-pet-figure|plaza-sprite/, "걷는 모습은 끄지 않는다");
  assert.match(css, /\.plaza-pet\.is-moving \.plaza-pet-figure \{ animation: plaza-bob/);
});

test("걷는 그림 — 크기: 발 기준점은 칸의 (48, 88), 펫은 단계가 오를수록 크다", () => {
  assert.equal(SPRITE_CELL, 96);
  assert.deepEqual(SPRITE_FOOT, { x: 48, y: 88 });
  const c = plazaCharacterSize(1);
  assert.equal(c.body, PLAZA_BODY);
  assert.ok(Math.abs(c.cell - 96 * PLAZA_BODY / SPRITE_BODY) < 1e-9);
  assert.ok(Math.abs(c.footX - c.cell / 2) < 1e-9);
  assert.ok(Math.abs(c.footY - c.cell * 88 / 96) < 1e-9);
  // 화면이 작아도 캐릭터는 40px, 펫은 18px 아래로 줄지 않는다
  assert.equal(plazaCharacterSize(0.2).body, 40);
  assert.equal(plazaPetSize(0.2, 2).body, 18);
  // 2단계가 가장 작고 10단계가 제 크기 — 단계마다 커진다
  assert.equal(plazaPetScale(10), 1);
  assert.ok(plazaPetScale(2) > 0.5 && plazaPetScale(2) < 0.75);
  for (let stage = 3; stage <= 10; stage += 1) assert.ok(plazaPetScale(stage) > plazaPetScale(stage - 1), `단계 ${stage}`);
  assert.equal(plazaPetScale(1), plazaPetScale(2));
  assert.equal(plazaPetScale(99), 1);
  // 다 자란 펫도 캐릭터보다 작다
  assert.ok(plazaPetSize(1, 10).body < plazaCharacterSize(1).body * 0.7);
  assert.ok(plazaPetSize(1, 2).body < plazaPetSize(1, 10).body);
});

test("펫 따라오기 — 걷는 동안은 지나온 길을 조금 뒤에서, 멈추면 곁자리로", () => {
  // 지나온 길 — 오른쪽으로 100, 다시 아래로 100 걸었다
  const trail = [];
  for (let x = 0; x <= 100; x += 5) plazaTrailPush(trail, { x: 600 + x, y: 300 });
  for (let y = 5; y <= 100; y += 5) plazaTrailPush(trail, { x: 700, y: 300 + y });
  const behind = plazaTrailBehind(trail, PET_GAP);
  // 모퉁이를 가로지르지 않고 길 위에 있다(x = 700인 세로 구간)
  assert.ok(Math.abs(behind.x - 700) < 1e-9);
  assert.ok(Math.abs(behind.y - (400 - PET_GAP)) < 1e-9);
  // 길이 아직 짧으면 가장 오래된 자리
  const short = [];
  plazaTrailPush(short, { x: 10, y: 10 });
  plazaTrailPush(short, { x: 20, y: 10 });
  assert.deepEqual(plazaTrailBehind(short, PET_GAP), { x: 10, y: 10 });
  assert.equal(plazaTrailBehind([], PET_GAP), null);
  // 제자리 걸음은 길에 안 쌓이고, 오래된 길은 잊는다
  const before = trail.length;
  plazaTrailPush(trail, { x: 700, y: 400 });
  assert.equal(trail.length, before);
  for (let y = 105; y <= 900; y += 5) plazaTrailPush(trail, { x: 700, y: 300 + y });
  assert.ok(trail.at(-1).s - trail[1].s <= 150);

  // 멈춘 캐릭터 곁 — 펫이 있던 쪽 옆자리, 걸을 수 있는 자리
  const me = { x: 836, y: 330 };
  const left = plazaPetHeel(me, { x: 700, y: 330 });
  const right = plazaPetHeel(me, { x: 900, y: 330 });
  assert.ok(left.x < me.x && right.x > me.x);
  for (const spot of [left, right]) assert.equal(plazaWalkable(spot.x, spot.y), true);
  // 가장자리(왼쪽 가판대 앞)에서는 걸을 수 있는 쪽으로
  const edge = plazaPetHeel({ x: 250, y: 436 }, { x: 240, y: 436 });
  assert.equal(plazaWalkable(edge.x, edge.y), true);

  // 한 걸음 — 다가가되 지나치지 않고, 다 오면 그 자리. 바닥 밖으로는 안 나간다
  let pet = { x: 786, y: 338 };
  const target = { x: 836, y: 600 };            // 분수 건너편(곧장 가면 분수에 막힘)
  for (let i = 0; i < 600; i += 1) {
    const next = plazaPetStep(pet, target, 1 / 60);
    assert.equal(plazaWalkable(next.x, next.y), true);
    assert.ok(Math.hypot(next.x - pet.x, next.y - pet.y) <= 430 / 60 + 1e-6, "한 걸음이 가장 빠른 걸음을 넘지 않는다");
    pet = next;
  }
  let near = { x: 500, y: 700 };
  for (let i = 0; i < 240; i += 1) near = plazaPetStep(near, { x: 560, y: 700 }, 1 / 60);
  assert.ok(Math.hypot(near.x - 560, near.y - 700) < 0.02, "다 오면 그 자리에 선다");
  assert.deepEqual(plazaPetStep({ x: 500, y: 700 }, { x: 500, y: 700 }, 1 / 60), { x: 500, y: 700 });
});

test("책 광장 펫 — 아래쪽(앞)으로 걸을 때는 캐릭터 몸에 가리지 않게 옆으로 비켜 따라온다", () => {
  const me = { x: 600, y: 700 };
  // 곧장 아래로 걷는 중 — 따라갈 자리가 바로 위(뒤)면 몸에 가린다 → 펫이 있는 쪽 옆으로
  const behind = { x: 600, y: 700 - PET_GAP };
  const leftSide = plazaPetPeek(behind, me, { x: 590, y: 650 });
  const rightSide = plazaPetPeek(behind, me, { x: 612, y: 650 });
  // …그리고 너무 뒤에 있지 않게 당겨 온다(머리 위 이름표와 겹치지 않게)
  assert.deepEqual(leftSide, { x: 600 - PET_PEEK, y: 700 - PET_PEEK_BACK });
  assert.deepEqual(rightSide, { x: 600 + PET_PEEK, y: 700 - PET_PEEK_BACK });
  assert.ok(PET_PEEK_BACK < PET_GAP);
  // 펫이 딱 뒤에 있으면 길이 굽은 쪽, 그것도 없으면 오른쪽
  assert.equal(plazaPetPeek({ x: 598, y: 640 }, me, { x: 600, y: 650 }).x, 600 - PET_PEEK);
  assert.equal(plazaPetPeek(behind, me, { x: 600, y: 650 }).x, 600 + PET_PEEK);
  assert.equal(plazaPetPeek(behind, me, null).x, 600 + PET_PEEK);
  // 이미 옆으로 충분히 떨어져 있으면 그대로(같은 객체)
  const aside = { x: 600 + PET_PEEK + 5, y: 650 };
  assert.equal(plazaPetPeek(aside, me, { x: 650, y: 650 }), aside);
  // 옆 · 아래(앞)에서 따라올 때는 그대로 — 옆으로 걸을 때 · 위로 걸을 때
  const level = { x: 600 - PET_GAP, y: 700 };
  const below = { x: 600, y: 700 + PET_GAP };
  assert.equal(plazaPetPeek(level, me, level), level);
  assert.equal(plazaPetPeek(below, me, below), below);
  // 조금만 뒤(위)면 조금만 비켜 선다 — 방향을 틀 때 펫이 갑자기 튀지 않게(뒤로 갈수록 고르게 늘어남)
  let last = 0;
  for (let rise = 0; rise <= 60; rise += 3) {
    const spot = plazaPetPeek({ x: 600, y: 700 - rise }, me, { x: 610, y: 690 });
    const shift = spot.x - 600;
    assert.ok(shift >= last - 1e-9 && shift <= PET_PEEK + 1e-9, `rise ${rise}`);
    assert.ok(shift - last <= PET_PEEK / 10 + 1e-9, "한 번에 조금씩만 늘어난다");
    last = shift;
  }
  assert.equal(last, PET_PEEK);
  // 비스듬히 뒤에서 따라올 때 — 옆으로 벗어난 만큼 덜 당겨 오고, 다 벗어나면 그대로(자리가 고르게 이어진다)
  let lastY = 700 - PET_PEEK_BACK;
  for (let dx = 0; dx <= PET_PEEK; dx += 4) {
    const spot = plazaPetPeek({ x: 600 + dx, y: 700 - PET_GAP }, me, { x: 630, y: 650 });
    assert.ok(spot.y <= lastY + 1e-9 && spot.y >= 700 - PET_GAP - 1e-9, `dx ${dx}`);
    lastY = spot.y;
  }
  assert.equal(lastY, 700 - PET_GAP);
  // 비켜 설 자리가 바닥 밖이면(왼쪽 가장자리) 그대로 둔다 — 바닥 밖으로 끌려 나가지 않게
  const edge = { x: 250, y: 436 };
  const tight = plazaPetPeek({ x: 250, y: 400 }, edge, { x: 240, y: 400 });
  assert.equal(plazaWalkable(tight.x, tight.y) || (tight.x === 250 && tight.y === 400), true);
});

test("펫 한 마리의 걸음 — 주인이 걸으면 지나온 길을 따라오고, 멈추면 곁에 와서 같은 쪽을 본다", () => {
  // 무대가 캐릭터마다(내 캐릭터 · 함께 있는 친구들) 펫 상태를 하나씩 들고 프레임마다 부르는 셈
  const owner = { x: 700, y: 330, facing: "down" };
  const pet = plazaPetStart(owner, "down");
  assert.equal(plazaWalkable(pet.x, pet.y), true);
  assert.ok(Math.hypot(pet.x - owner.x, pet.y - owner.y) < 70, "처음에는 곁에");
  // 주인이 오른쪽으로 2초 걷는다
  const pace = PLAZA_WALK_SPEED / 60;
  let walked = 0;
  for (let i = 0; i < 120; i += 1) {
    const from = { x: owner.x, y: owner.y };
    owner.x += pace;
    owner.facing = "right";
    const step = plazaPetFollow(pet, owner, 1 / 60, { active: true, moved: pace, from });
    if (step.walking) walked += 1;
    assert.equal(step.busy, step.walking);
    assert.equal(plazaWalkable(pet.x, pet.y), true);
  }
  assert.ok(walked > 100, "걷는 내내 따라 걷는다");
  assert.ok(pet.x < owner.x - 30 && pet.x > owner.x - 140, `조금 뒤에서 따라온다(${Math.round(owner.x - pet.x)}px 뒤)`);
  assert.equal(pet.facing, "right");
  assert.ok(pet.stride > 100, "걸은 거리로 걷는 그림을 넘긴다");
  // 멈추면 곁자리로 와서 서고, 주인과 같은 쪽을 본다. 다 온 뒤에는 더 그릴 것이 없다(걸음 루프가 쉼).
  owner.facing = "up";
  let last = null;
  for (let i = 0; i < 240; i += 1) last = plazaPetFollow(pet, owner, 1 / 60, { active: false, moved: 0, from: owner });
  assert.deepEqual(last, { walking: false, busy: false });
  assert.ok(Math.hypot(pet.x - owner.x, pet.y - owner.y) < 70);
  assert.equal(pet.facing, "up");
  assert.equal(pet.stride, 0);
  // 다시 걷기 시작하면 펫이 선 자리부터 따라온다(뒷걸음질하지 않음 — 지나온 길의 첫머리가 펫의 자리)
  const stood = { x: pet.x, y: pet.y };
  const from = { x: owner.x, y: owner.y };
  owner.x += pace;
  plazaPetFollow(pet, owner, 1 / 60, { active: true, moved: pace, from });
  assert.deepEqual({ x: pet.trail[0].x, y: pet.trail[0].y }, stood);
  // 서 있던 주인이 멀리 옮겨지면(오래 끊겼다 이어진 친구) 옛 곁자리에 남지 않고 곧바로 곁으로 온다
  for (let i = 0; i < 240; i += 1) plazaPetFollow(pet, owner, 1 / 60, { active: false, moved: 0, from: owner });
  owner.x = 420;
  owner.y = 760;
  plazaPetFollow(pet, owner, 1 / 60, { active: false, moved: 0, from: owner });
  assert.ok(Math.hypot(pet.x - owner.x, pet.y - owner.y) < 70, "멀어진 펫은 걸어오지 않고 곧바로 곁에");
  // 처음 한 프레임(dt 0)에 갈 곳이 남아 있으면 더 그릴 것이 있다고 알린다
  const far = plazaPetStart({ x: 700, y: 330 }, "down");
  const wait = plazaPetFollow(far, { x: 760, y: 330, facing: "right" }, 0, { active: false, moved: 0 });
  assert.deepEqual(wait, { walking: false, busy: true });
});
