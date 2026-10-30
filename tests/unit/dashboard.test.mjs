import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardData, dashboardPeriod } from "../../lib/dashboard.js";
import { createDemoClassroom, DEMO_STUDENTS, DEMO_ACTIVITY_IDS } from "../../lib/demoClassroom.js";
import { createDemoBookActivities } from "../../lib/demoBookActivities.js";
import { createDemoReadingStates } from "../../lib/demoReading.js";
import { deriveReading } from "../../lib/reading.js";

const NOW = "2026-10-30T03:00:00.000Z";
const classroom = createDemoClassroom(NOW);
const fixture = createDemoBookActivities(NOW);
const states = createDemoReadingStates(NOW);
const fullRange = { period: "custom", start: "2026-10-03", end: "2026-10-30" };
const students = ["s1", "s2", "s3"].map((uid, index) => ({ uid, name: `학생${index + 1}`, studentId: String(30101 + index), role: "student" }));
function input(extra = {}) {
  return { role: "teacher", uid: "t1", classDoc: { id: "c1", name: "독서반", readingEnabled: true }, roster: students, memberUids: students.map((s) => s.uid), activities: [], records: {}, readingStates: {}, now: NOW, ...extra };
}
function demo(extra = {}) {
  return input({ classDoc: classroom.classDoc, roster: classroom.students, memberUids: classroom.students.map((student) => student.uid),
    activities: fixture.bookActivities, records: fixture, readingStates: states, ...extra });
}
const book = (id, title = "우리 책") => ({ id, title, author: "시험 작가", totalPages: 100, status: "reading", createdAt: "2026-10-01T00:00:00Z" });
const log = (id, bookId, classId, date, startPage, endPage) => ({ id, bookId, classId, date, startPage, endPage, notes: "비공개 독서 감상 원문", createdAt: `${date}T01:00:00Z` });
const reading = (books, logs, reviews = []) => ({ version: 1, books, logs, reviews, featuredBadge: null });

test("한국 시간 월요일과 월간 비교는 같은 경과 일수로 제한한다", () => {
  const week = dashboardPeriod("weekly", "2026-10-25T15:01:00Z");
  assert.deepEqual(week, { key: "weekly", start: "2026-10-26", end: "2026-10-26", label: "이번 주", previous: { start: "2026-10-19", end: "2026-10-19" } });
  const month = dashboardPeriod("monthly", "2026-10-31T03:00:00Z");
  assert.equal(month.previous.start, "2026-09-01");
  assert.equal(month.previous.end, "2026-09-30");
  const midmonth = dashboardPeriod("monthly", "2026-03-10T03:00:00Z");
  assert.equal(midmonth.previous.end, "2026-02-10");
});

test("학기는 명시적으로 설정하고 직접 선택은 양끝을 포함하여 비교한다", () => {
  const semester = dashboardPeriod("semester", NOW, { semesterStart: "2026-08-20", semesterEnd: "2027-01-05" });
  assert.equal(semester.start, "2026-08-20"); assert.equal(semester.end, "2026-10-30"); assert.equal(semester.previous, null);
  const custom = dashboardPeriod("custom", NOW, { start: "2026-10-27", end: "2026-10-30" });
  assert.deepEqual(custom.previous, { start: "2026-10-23", end: "2026-10-26" });
  for (const options of [{ start: "2026-02-30", end: "2026-10-30" }, { start: "2026-10-30", end: "2026-10-29" }, { start: "2026-10-01", end: "2026-10-31" }, { start: "2024-01-01", end: "2026-10-30" }]) assert.throws(() => dashboardPeriod("custom", NOW, options));
  assert.throws(() => dashboardPeriod("semester", NOW, {}));
  assert.throws(() => dashboardPeriod("semester", NOW, { semesterStart: "2026-11-01", semesterEnd: "2027-01-01" }));
});

test("10종의 실제 진행 기준을 적용하고 공동 완성은 개인 완성으로 올리지 않는다", () => {
  const expected = { consonant: 0, paratext: 9, raft: 14, kwls: 9, mindmap: 0, opinion: 0, hashtag: 10, qmark: 11, crossword: 15, brainwrite: 5 };
  for (const [type, done] of Object.entries(expected)) {
    const data = buildDashboardData(demo(), { ...fullRange, activityId: DEMO_ACTIVITY_IDS[type] });
    assert.equal(data.activity.started, 15, type);
    assert.equal(data.activity.eligible, 15, type);
    assert.equal(data.activity.done, done, type);
    assert.equal(data.activity.rows.length, 15, type);
    assert.equal(data.activity.completionSupported, !["consonant", "mindmap", "opinion"].includes(type), type);
    assert.ok(data.activity.rows.every((row) => typeof row.preview === "string" && !row.preview.includes("<p>")));
  }
});

test("기록이 없는 학생도 분모에 포함하고 빈 문서는 참여가 아니다", () => {
  const activity = { id: "a1", classId: "c1", type: "raft", title: "편지" };
  const data = buildDashboardData(input({ activities: [activity], records: { bookEntries: [
    { activityId: "a1", authorId: "s1", answers: { role: "화자" } },
    { activityId: "a1", authorId: "s2", answers: { role: " <p><br></p> " } },
  ] } }));
  assert.equal(data.activity.eligible, 3); assert.equal(data.activity.started, 1);
  assert.equal(data.activity.rows[1].state, "empty"); assert.equal(data.activity.rows[2].state, "empty");
});

test("모둠 미배정은 대기로 분리하고 남의 낱말은 개인 참여가 아니다", () => {
  const activity = { id: "a1", classId: "c1", type: "consonant", groupMode: "teacher" };
  const data = buildDashboardData(input({ activities: [activity], records: {
    bookGroups: [{ id: "g1", activityId: "a1", memberUids: ["s1", "s2"], members: students.slice(0, 2) }],
    bookWords: Array.from({ length: 14 }, (_, index) => ({ id: `word${index}`, activityId: "a1", groupId: "g1", authorId: "s1", cellKey: `c${index}`, text: "낱말" })),
  } }));
  assert.equal(data.activity.eligible, 2); assert.equal(data.activity.waiting, 1);
  assert.equal(data.activity.started, 1); assert.equal(data.activity.done, 0);
  assert.equal(data.activity.rows[1].state, "empty"); assert.ok(data.activity.rows[1].groupProgress.includes("14/14"));
  assert.equal(data.activity.rows[2].state, "waiting");
});

test("마인드맵 기본 주제나 빈 가지는 참여로 계산하지 않는다", () => {
  const data = buildDashboardData(input({ activities: [{ id: "m1", classId: "c1", type: "mindmap" }], records: { bookEntries: [
    { activityId: "m1", authorId: "s1", answers: { nodes: [{ id: "root", parentId: null, text: "처음부터 있는 주제" }] } },
    { activityId: "m1", authorId: "s2", answers: { nodes: [{ id: "root", parentId: null, text: "주제" }, { id: "blank", parentId: "root", text: "" }] } },
  ] } }));
  assert.equal(data.activity.started, 0); assert.equal(data.activity.completionSupported, false);
});

test("KWLS 정본을 우선하고 이중 저장·복수 활동의 같은 학생은 중복 집계하지 않는다", () => {
  const activities = ["k1", "k2"].map((id) => ({ id, classId: "c1", type: "kwls", title: id }));
  const data = buildDashboardData(input({ activities, records: {
    bookEntries: [{ activityId: "k1", authorId: "s1", answers: { learned: "entry로 잘못 더하면 안 됨" }, updatedAt: NOW }],
    kwl: [
      { activityId: "k1", classId: "c1", userId: "s1", date: "2026-10-28", answers: { know: "K", learned: "L", still: "S" } },
      { activityId: "k2", classId: "c1", userId: "s1", date: "2026-10-29", answers: { learned: "두 번째 활동 L" } },
      { activityId: "k1", classId: "c1", userId: "s2", date: "2026-10-29", answers: { know: "K" } },
    ],
  } }));
  assert.equal(data.reflections.records.length, 3);
  assert.deepEqual(data.reflections.counts, { know: 2, want: 0, learned: 1, still: 1 });
  assert.equal(data.reflections.eligible, 3);
  assert.equal(data.reflections.records.find((r) => r.activityId === "k1" && r.uid === "s1").answers.learned, "L");
});

test("KWLS 최신 수정일로 과거 참여를 만들지 않고 날짜 없는 원문은 표시만 한다", () => {
  const data = buildDashboardData(input({ activities: [{ id: "k1", classId: "c1", type: "kwls" }], records: {
    bookEntries: [
      { activityId: "k1", authorId: "s1", answers: { learned: "최신 entry" }, updatedAt: NOW },
      { activityId: "k1", authorId: "s2", answers: { learned: "날짜를 알 수 없는 기존 기록" }, updatedAt: NOW },
    ], kwl: [{ activityId: "k1", classId: "c1", userId: "s1", date: "2026-10-01", answers: { know: "기간 밖 K" }, updatedAt: NOW }],
  } }));
  assert.equal(data.reflections.records.length, 1);
  assert.equal(data.reflections.records[0].uid, "s2"); assert.equal(data.reflections.records[0].date, null);
  assert.equal(data.reflections.learned, 0);
});

test("반별 쪽수는 전 반 중복을 제거한 실제 페이지 이벤트로 계산하고 완독은 한 번만 귀속한다", () => {
  const b = book("b1");
  const logs = [log("l1", "b1", "other", "2026-10-27", 1, 60), log("l2", "b1", "c1", "2026-10-28", 40, 100), log("l3", "b1", "c1", "2026-10-29", 1, 100)];
  const first = buildDashboardData(input({ readingStates: { s1: reading([b], logs) } }));
  assert.equal(first.reading.summary.pages, 40); assert.equal(first.reading.summary.completed, 1); assert.equal(first.reading.summary.days, 1);
  assert.equal(first.reading.members[0].pages, 40); assert.equal(first.reading.daily.reduce((sum, day) => sum + day.pages, 0), 40);
  const corrected = buildDashboardData(input({ readingStates: { s1: reading([b], logs.slice(1, 2)) } }));
  assert.equal(corrected.reading.summary.pages, 61); assert.equal(corrected.reading.summary.completed, 0);
});

test("현재 기간 쪽수·독서일·학생·도서종류와 학생별 완독건수를 서로 구분한다", () => {
  const data = buildDashboardData(input({ readingStates: {
    s1: reading([book("b1")], [log("s1log", "b1", "c1", "2026-10-28", 1, 100)]),
    s2: reading([book("b2")], [log("s2log", "b2", "c1", "2026-10-28", 1, 100)]),
  } }));
  assert.deepEqual(data.reading.summary, { pages: 200, days: 1, readers: 2, completed: 2, reviews: 0, books: 1 });
  assert.deepEqual(data.reading.members.map((row) => row.days), [1, 1, 0]);
  assert.equal(data.reading.books[0].readers, 2);
  assert.equal(data.reading.daily.length, 5); assert.equal(data.reading.daily[0].pages, 0);
  assert.equal(data.reading.weekly.reduce((sum, week) => sum + week.pages, 0), 200);
});

test("교사 결과에는 개인 원문·타반 도서·명단 밖 사용자 자료가 포함되지 않는다", () => {
  const data = buildDashboardData(input({ activities: [
    { id: "a1", classId: "c1", type: "raft" }, { id: "a-private", classId: "other", type: "raft", title: "타반 활동 비밀" },
  ], records: { bookEntries: [{ activityId: "a-private", authorId: "s1", answers: { writing: "다른 반 글 비밀" } }] }, readingStates: {
    s1: reading([book("b1"), book("private-book", "타반 서재 비밀")], [log("mine", "b1", "c1", "2026-10-28", 1, 10), log("private", "private-book", "other", "2026-10-28", 1, 30)], [{ id: "r1", bookId: "b1", classId: "c1", createdAt: "2026-10-28T00:00:00Z", text: "개인 감상문 비밀", rating: 5 }]),
    outsider: reading([book("outsider", "명단 밖 사용자 비밀")], [log("out", "outsider", "c1", "2026-10-28", 1, 100)]),
  } }));
  const json = JSON.stringify(data);
  for (const marker of ["비공개 독서 감상 원문", "개인 감상문 비밀", "타반 서재 비밀", "명단 밖 사용자 비밀", "다른 반 글 비밀", "타반 활동 비밀", "featuredBadge", "earnedBadges"]) assert.equal(json.includes(marker), false, marker);
  assert.equal(data.reading.personal, null);
  assert.equal(data.activities.length, 1);
  assert.equal(data.reading.summary.pages, 10);
});

test("책나눔 OFF는 성장만 제거하고 수업 활동과 성찰을 유지한다", () => {
  const source = demo({ classDoc: { ...classroom.classDoc, readingEnabled: false } });
  Object.defineProperty(source, "readingStates", { get() { throw new Error("OFF 상태에서 원본 서재를 읽으면 안 됨"); } });
  const result = buildDashboardData(source, { ...fullRange, activityId: DEMO_ACTIVITY_IDS.kwls });
  assert.equal(result.reading, null); assert.equal(result.activities.length, 10); assert.equal(result.activity.started, 15); assert.equal(result.reflections.learned, 13);
});

test("학생은 본인의 누적 성장·서재와 선택 반의 기간 활동만 받는다", () => {
  const uid = DEMO_STUDENTS[0].uid;
  const result = buildDashboardData(demo({ role: "student", uid }), { ...fullRange, activityId: DEMO_ACTIVITY_IDS.brainwrite });
  assert.equal(result.activity.rows.length, 1); assert.equal(result.activity.rows[0].uid, uid);
  assert.equal(result.activity.rows[0].total, 5); assert.equal(result.activity.rows[0].filled, 5);
  assert.equal(result.studentActivities.length, 10);
  assert.equal(result.reading.members.length, 1); assert.equal(result.reading.personal.library.length, 2);
  assert.equal(result.reading.personal.level, deriveReading(states[uid], NOW).level);
  assert.equal(result.reading.personal.badges.length, 18); assert.ok(result.reading.personal.nextBadges.length <= 3);
  assert.ok(result.reflections.records.every((record) => record.uid === uid));
  assert.ok(result.feedback.every((record) => record.uid === uid));
  assert.equal(JSON.stringify(result).includes("비공개 독서 감상 원문"), false);
});

test("피드백의 uid/name은 수신 학생이고 글은 HTML로 실행되지 않는 평문이다", () => {
  const result = buildDashboardData(input({ activities: [{ id: "a1", classId: "c1", type: "raft", title: "편지" }], records: {
    bookPeerReviews: [{ id: "r1", activityId: "a1", fromUid: "s2", fromName: "쓴 학생", toUid: "s1", html: "<p>구체적인 장면이 좋아요.</p><script>alert(1)</script>" }],
  } }));
  assert.equal(result.feedback.length, 1); assert.equal(result.feedback[0].uid, "s1"); assert.equal(result.feedback[0].name, "학생1"); assert.equal(result.feedback[0].authorName, "쓴 학생");
  assert.equal(result.feedback[0].text, "구체적인 장면이 좋아요.");
});

test("학생 KWLS는 기간 내 활동별 기록 건수이고 교사는 작성 학생 수다", () => {
  const activities = ["k1", "k2"].map((id) => ({ id, classId: "c1", type: "kwls", title: id }));
  const source = input({ activities, records: { kwl: [
    { activityId: "k1", classId: "c1", userId: "s1", date: "2026-10-28", answers: { know: "K1", learned: "L1" } },
    { activityId: "k2", classId: "c1", userId: "s1", date: "2026-10-29", answers: { know: "K2", learned: "L2" } },
  ] } });
  const teacher = buildDashboardData(source);
  const student = buildDashboardData({ ...source, role: "student", uid: "s1" });
  assert.equal(teacher.reflections.counts.learned, 1);
  assert.equal(teacher.reflections.eligible, 3);
  assert.equal(student.reflections.counts.learned, 2);
  assert.equal(student.reflections.learned, 2);
  assert.equal(student.reflections.eligible, 2);
});

test("개인 서재의 감상 유무는 본인의 실제 감상문과 연결한다", () => {
  const ownBooks = [book("b1"), book("b2", "두 번째 책")];
  const source = input({ role: "student", uid: "s1", readingStates: { s1: reading(ownBooks, [log("a", "b1", "c1", "2026-10-28", 1, 100), log("b", "b2", "c1", "2026-10-29", 1, 100)], [
    { id: "review", bookId: "b1", classId: "c1", createdAt: "2026-10-28T00:00:00Z", text: "읽은 생각", rating: 4 },
  ]) } });
  const data = buildDashboardData(source);
  assert.equal(data.reading.personal.library.find((b) => b.id === "b1").hasReview, true);
  assert.equal(data.reading.personal.library.find((b) => b.id === "b2").hasReview, false);
});

test("학생의 날짜별 원기록은 본인·선택 반·기간의 유효 페이지 기여만 포함한다", () => {
  const own = reading([book("b1")], [
    { ...log("other-class", "b1", "other", "2026-10-27", 1, 40), notes: "다른 반의 비공개 메모" },
    { ...log("mine", "b1", "c1", "2026-10-28", 30, 80), notes: "<p>내 반의 짧은 감상</p>" },
    { ...log("duplicate", "b1", "c1", "2026-10-29", 1, 80), notes: "중복 기록은 빼야 함" },
    { ...log("outside-period", "b1", "c1", "2026-10-20", 81, 90), notes: "기간 밖 메모" },
  ]);
  const source = input({ readingStates: {
    s1: own,
    s2: reading([book("s2-book", "다른 학생의 책")], [{ ...log("s2-record", "s2-book", "c1", "2026-10-28", 1, 20), notes: "다른 학생 메모" }]),
  } });
  const teacher = buildDashboardData(source);
  assert.deepEqual(teacher.reading.dayRecords, []);
  for (const privateText of ["내 반의 짧은 감상", "다른 반의 비공개 메모", "기간 밖 메모", "다른 학생 메모"]) assert.equal(JSON.stringify(teacher).includes(privateText), false);
  const student = buildDashboardData({ ...source, role: "student", uid: "s1" });
  assert.deepEqual(student.reading.dayRecords, [{ id: "mine", date: "2026-10-28", bookId: "b1", title: "우리 책", startPage: 30, endPage: 80, pages: 40, notes: "내 반의 짧은 감상" }]);
  for (const privateText of ["다른 반의 비공개 메모", "기간 밖 메모", "다른 학생 메모", "중복 기록은 빼야 함"]) assert.equal(JSON.stringify(student).includes(privateText), false);
});

test("학생 활동의 잠금 여부를 표시하고 잠금 상태로 진행 기준을 바꾸지 않는다", () => {
  const result = buildDashboardData(input({ role: "student", uid: "s1", activities: [
    { id: "locked", classId: "c1", type: "raft", locked: true },
    { id: "open", classId: "c1", type: "raft" },
  ], records: { bookEntries: [{ activityId: "locked", authorId: "s1", answers: { role: "등장인물" } }] } }));
  assert.equal(result.studentActivities.find((activity) => activity.id === "locked").locked, true);
  assert.equal(result.studentActivities.find((activity) => activity.id === "locked").state, "doing");
  assert.equal(result.studentActivities.find((activity) => activity.id === "open").locked, false);
});
