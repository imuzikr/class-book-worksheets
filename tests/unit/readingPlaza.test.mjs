import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReadingAction, deriveReading, featureValue, initialReadingState, plazaOn, teacherFeatureSettings } from "../../lib/reading.js";
import {
  PLAZA_BOOK_CAP, PLAZA_COMMENT_MAX, PLAZA_LOG_CAP,
  plazaCommentText, plazaFriends, plazaHasContent, plazaItems, plazaNameLabel,
  plazaProjection, plazaStable, plazaThisWeek, plazaWeekStart,
} from "../../lib/readingPlaza.js";
import {
  PLAZA_H, PLAZA_SPAWN, PLAZA_SPOTS, PLAZA_W,
  plazaClear, plazaNearest, plazaPath, plazaSpotAt, plazaSpotNear, plazaStep, plazaWalkable,
} from "../../lib/readingPlazaMap.js";

// 2026-11-12(목) 12:00 서울 — 그 주의 월요일은 11-09
const NOW = "2026-11-12T03:00:00.000Z";
const ctx = (id, extra = {}) => ({ uid: "stu", classId: "classA", now: NOW, id, ...extra });
const at = (iso, id, extra = {}) => ({ uid: "stu", classId: "classA", now: iso, id, ...extra });
const run = (state, action, context) => applyReadingAction(state, action, context);
const addBook = (state, id, pages = 20) => run(state, { type: "addBook", title: `책 ${id}`, author: "지은이", totalPages: pages }, ctx(id));
const addLog = (state, id, bookId, a, b, extra = {}, date = "2026-11-12") => run(state,
  { type: "addLog", bookId, date, startPage: a, endPage: b, notes: `발자국 ${id}` }, ctx(id, extra));
const project = (state, classId = "classA", options) => plazaProjection(deriveReading(state, new Date(NOW)), classId, options);

test("독서 광장 스위치 — 책나눔이 켜진 반에서 켰을 때만(기본 꺼짐)", () => {
  assert.equal(plazaOn({ readingEnabled: true }), false);
  assert.equal(plazaOn({ readingEnabled: true, plazaEnabled: true }), true);
  assert.equal(plazaOn({ readingEnabled: false, plazaEnabled: true }), false);
  assert.equal(plazaOn({ readingEnabled: true, plazaEnabled: true, archived: true }), false);
  assert.equal(featureValue({}, "plazaEnabled"), false);
  assert.equal(teacherFeatureSettings([{ id: "a", plazaEnabled: true }, { id: "b" }]).plazaEnabled.on, false);
  assert.equal(teacherFeatureSettings([{ id: "a", plazaEnabled: true }]).plazaEnabled.on, true);
});

test("발자국 도장 — 광장을 켠 반에서 쓴(고친) 발자국만 공유된다", () => {
  let s = addBook(initialReadingState(), "book1", 40);
  s = addLog(s, "log00001", "book1", 1, 10);                    // 광장을 켜기 전
  s = addLog(s, "log00002", "book1", 11, 20, { plaza: true });  // 켠 뒤
  assert.equal(s.logs[0].plaza, undefined);
  assert.equal(s.logs[1].plaza, true);
  let p = project(s);
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].place, "stall");
  assert.equal(p.entries[0].logs, 1);
  assert.deepEqual(p.books.book1.logs.map((l) => l.id), ["log00002"]);
  assert.equal(p.books.book1.review, null);
  // 옛 발자국을 광장이 켜진 동안 고치면 그때부터 보인다(고치는 창에 안내가 뜸)
  s = run(s, { type: "updateLog", logId: "log00001", notes: "고친 글" }, ctx("x0000001", { plaza: true }));
  assert.equal(s.logs.find((l) => l.id === "log00001").plaza, true);
  // 광장이 꺼진 동안 고쳐도 이미 찍힌 도장은 그대로
  s = run(s, { type: "updateLog", logId: "log00002", notes: "또 고침" }, ctx("x0000002"));
  assert.equal(s.logs.find((l) => l.id === "log00002").plaza, true);
  p = project(s);
  assert.equal(p.entries[0].logs, 2);
  // 사본에는 책 제목 · 쪽수 · 발자국만 — 서재의 다른 칸(반 id · 도장)은 싣지 않는다
  assert.deepEqual(Object.keys(p.books.book1.logs[0]).sort(), ["createdAt", "date", "endPage", "id", "notes", "startPage"]);
});

test("책마다 '광장에 보이기'를 끄면 그 책의 발자국은 안 나간다", () => {
  let s = addBook(initialReadingState(), "book1", 40);
  s = addLog(s, "log00001", "book1", 1, 10, { plaza: true });
  assert.equal(project(s).entries.length, 1);
  s = run(s, { type: "setBookPlaza", bookId: "book1", hidden: true }, ctx("x0000001"));
  assert.equal(s.books[0].plazaHidden, true);
  assert.equal(project(s).entries.length, 0);
  s = run(s, { type: "setBookPlaza", bookId: "book1", hidden: false }, ctx("x0000002"));
  assert.equal("plazaHidden" in s.books[0], false);
  assert.equal(project(s).entries.length, 1);
  assert.throws(() => run(s, { type: "setBookPlaza", bookId: "book1" }, ctx("x0000003")), /광장에 보일지/);
});

test("완독한 책은 '책꽂이에 꽂기'를 눌러야 책꽂이에 선다", () => {
  let s = addBook(initialReadingState(), "book1", 20);
  s = addLog(s, "log00001", "book1", 1, 20, { plaza: true });
  // 완독했지만 아직 안 꽂음 — 가판대에서 내려오고 책꽂이에도 없다
  assert.equal(project(s).entries.length, 0);
  s = run(s, { type: "saveReview", bookId: "book1", text: "끝까지 읽었다", rating: 4 }, ctx("rev00001"));
  assert.equal(project(s).entries.length, 0);
  s = run(s, { type: "shelveReview", bookId: "book1", shelved: true }, at("2026-11-12T04:00:00.000Z", "x0000001"));
  assert.equal(s.reviews[0].shelved, true);
  assert.equal(s.reviews[0].shelvedAt, "2026-11-12T04:00:00.000Z");
  let p = project(s);
  assert.equal(p.entries[0].place, "shelf");
  assert.equal(p.entries[0].rating, 4);
  assert.equal(p.entries[0].excerpt, "끝까지 읽었다");
  assert.equal(p.books.book1.review.text, "끝까지 읽었다");
  assert.equal(p.books.book1.logs.length, 1);
  assert.equal(p.entries[0].last, "2026-11-12T04:00:00.000Z");
  // 고쳐 써도 꽂은 것 · 꽂은 때는 그대로
  s = run(s, { type: "saveReview", bookId: "book1", text: "고쳐 쓴 글", rating: 5 }, at("2026-11-12T05:00:00.000Z", "x0000002"));
  assert.equal(s.reviews[0].shelved, true);
  assert.equal(s.reviews[0].shelvedAt, "2026-11-12T04:00:00.000Z");
  // 발자국을 숨겨도 꽂은 한 권의 책은 그대로(발자국만 빠짐)
  s = run(s, { type: "setBookPlaza", bookId: "book1", hidden: true }, ctx("x0000003"));
  p = project(s);
  assert.equal(p.entries[0].place, "shelf");
  assert.equal(p.books.book1.logs.length, 0);
  // 빼면 내려온다
  s = run(s, { type: "shelveReview", bookId: "book1", shelved: false }, ctx("x0000004"));
  assert.equal("shelved" in s.reviews[0], false);
  assert.equal("shelvedAt" in s.reviews[0], false);
  assert.equal(project(s).entries.length, 0);
  // 한 권의 책 창에서 저장하며 함께 꽂기
  s = run(s, { type: "saveReview", bookId: "book1", text: "다시", rating: 5, shelved: true }, ctx("x0000005"));
  assert.equal(project(s).entries[0].place, "shelf");
  assert.throws(() => run(s, { type: "saveReview", bookId: "book1", text: "다시", rating: 5, shelved: "yes" }, ctx("x0000006")), /책꽂이/);
  assert.throws(() => run(addBook(initialReadingState(), "book9"), { type: "shelveReview", bookId: "book9", shelved: true }, ctx("x0000007")), /먼저 써/);
});

test("보관한 책 · 선생님이 내린 책 · 다른 반에서 쓴 글은 사본에 없다", () => {
  let s = addBook(initialReadingState(), "book1", 40);
  s = addBook(s, "book2", 40);
  s = addLog(s, "log00001", "book1", 1, 10, { plaza: true });
  s = run(s, { type: "addLog", bookId: "book2", date: "2026-11-12", startPage: 1, endPage: 5, notes: "다른 반" }, { uid: "stu", classId: "classB", now: NOW, id: "log00002", plaza: true });
  assert.deepEqual(project(s).entries.map((e) => e.id), ["book1"]);
  assert.deepEqual(project(s, "classB").entries.map((e) => e.id), ["book2"]);
  assert.equal(project(s, "classA", { blocked: ["book1"] }).entries.length, 0);
  s = run(s, { type: "archiveBook", bookId: "book1", archived: true }, ctx("x0000001"));
  assert.equal(project(s).entries.length, 0);
  assert.equal(plazaHasContent(s, "classA"), true);
  assert.equal(plazaHasContent(s, "classC"), false);
  assert.equal(plazaHasContent(initialReadingState(), "classA"), false);
});

test("사본은 최근 발자국부터 정해진 수만 싣고, 목록은 최근에 쓴 책부터", () => {
  let s = addBook(initialReadingState(), "book1", 200);
  for (let i = 0; i < PLAZA_LOG_CAP + 5; i += 1) {
    s = run(s, { type: "addLog", bookId: "book1", date: "2026-11-10", startPage: i + 1, endPage: i + 1, notes: `n${i}` },
      at(new Date(Date.parse("2026-11-10T00:00:00Z") + i * 60000).toISOString(), `log${String(i).padStart(5, "0")}`, { plaza: true }));
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
      at(new Date(Date.parse("2026-11-10T00:00:00Z") + i * 60000).toISOString(), `lg${String(i).padStart(6, "0")}`, { plaza: true }));
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
