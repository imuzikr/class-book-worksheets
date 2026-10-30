import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardData } from "../../lib/dashboard.js";
import { overallDashboardData, scopedTeacherPersonalDashboard } from "../../lib/dashboardReports.js";

const NOW = "2026-10-30T03:00:00.000Z";
const PERIOD = { period: "custom", start: "2026-10-26", end: "2026-10-30" };
const student = (uid, name = uid) => ({ uid, name, studentId: uid });
const book = (id, extra = {}) => ({ id, title: "함께 읽는 책", author: "작가", totalPages: 100, status: "reading", createdAt: "2026-10-01T00:00:00Z", ...extra });
const log = (id, bookId, classId, date, startPage, endPage) => ({ id, bookId, classId, date, startPage, endPage, notes: "개인 독서 메모", createdAt: `${date}T01:00:00Z` });
const state = (books, logs, reviews = []) => ({ version: 1, books, logs, reviews, featuredBadge: null });
function dashboard(id, roster, extra = {}) {
  const result = buildDashboardData({ role: "teacher", uid: "teacher", classDoc: { id, name: `반 ${id}`, readingEnabled: true }, roster,
    memberUids: roster.map((row) => row.uid), activities: [], records: {}, readingStates: {}, now: NOW, ...extra }, PERIOD);
  return { ...result, roster };
}

test("전체 보고서는 학생과 수강 인원을 구분하고 같은 전역 독서 상태의 반별 기여만 더한다", () => {
  const common = state([book("shared")], [log("first", "shared", "c1", "2026-10-27", 1, 60), log("second", "shared", "c2", "2026-10-28", 40, 100)], [
    { id: "review", bookId: "shared", classId: "c2", text: "개인 감상문", rating: 4, createdAt: "2026-10-28T02:00:00Z" },
  ]);
  const classes = [dashboard("c1", [student("s1"), student("s2")], { readingStates: { s1: common,
    s2: state([book("another-copy")], [log("third", "another-copy", "c1", "2026-10-28", 1, 10)]) } }),
  dashboard("c2", [student("s1"), student("s3")], { readingStates: { s1: common } })];
  const before = structuredClone(classes);
  const result = overallDashboardData(classes);
  assert.equal(result.view, "teacher"); assert.equal(result.reportView, "overall");
  assert.deepEqual({ classes: result.summary.classes, students: result.summary.students, memberships: result.summary.memberships }, { classes: 2, students: 3, memberships: 4 });
  assert.deepEqual(result.summary.reading, { enabledClasses: 2, eligibleStudents: 3, readerMemberships: 3, pages: 110, days: 2, readers: 2, completed: 1, reviews: 1, books: 1 });
  assert.deepEqual(result.students.find((row) => row.uid === "s1").classes.map((row) => row.id), ["c1", "c2"]);
  assert.equal(result.reading.books.length, 1); assert.equal(result.reading.books[0].readerMemberships, 3);
  assert.equal(result.reading.daily.reduce((sum, row) => sum + row.pages, 0), 110);
  assert.equal(result.reading.weekly[0].readerMemberships, 3);
  assert.equal(result.reading.daily[2].readerMemberships, 2);
  assert.equal(Object.hasOwn(result.reading.daily[2], "readers"), false);
  assert.deepEqual(classes, before);
  for (const secret of ["개인 독서 메모", "개인 감상문", '"personal"']) assert.equal(JSON.stringify(result).includes(secret), false);
});

test("선택 활동의 인원 합계는 반별 비율의 평균 대신 실제 분모를 보존한다", () => {
  const one = [student("s1")], nine = Array.from({ length: 9 }, (_, index) => student(`n${index}`));
  const first = dashboard("c1", one, { activities: [{ id: "a1", classId: "c1", type: "raft" }],
    records: { bookEntries: [{ activityId: "a1", authorId: "s1", answers: { role: "화자", audience: "독자", format: "편지", topic: "주제", writing: "내용" } }] } });
  const second = dashboard("c2", nine, { activities: [{ id: "a2", classId: "c2", type: "raft" }, { id: "older", classId: "c2", type: "raft", createdAt: "2026-01-01" }], selectedActivityId: "a2" });
  const result = overallDashboardData([first, second]);
  assert.equal(result.summary.activityCount, 3);
  assert.deepEqual(result.summary.selectedActivity, { scope: "selected-per-class", classes: 2, eligible: 10, started: 1, done: 1, waiting: 0, completionEligible: 10, completionSupportedClasses: 2 });
  assert.equal(result.summary.selectedActivity.done / result.summary.selectedActivity.completionEligible, 0.1);
  assert.equal(result.classes[1].selectedActivity.id, "a2");
});

test("완성 기준이 없는 활동과 배정 대기는 완성 분모에 섞지 않는다", () => {
  const classes = [dashboard("mind", [student("s1")], { activities: [{ id: "m", classId: "mind", type: "mindmap" }],
    records: { bookEntries: [{ activityId: "m", authorId: "s1", answers: { nodes: [{ id: "root", parentId: null, text: "주제" }, { id: "branch", parentId: "root", text: "내 생각" }] } }] } }),
  dashboard("waiting", [student("s2")], { activities: [{ id: "c", classId: "waiting", type: "consonant", groupMode: "teacher" }] })];
  const result = overallDashboardData(classes);
  assert.equal(result.summary.selectedActivity.eligible, 1); assert.equal(result.summary.selectedActivity.started, 1);
  assert.equal(result.summary.selectedActivity.waiting, 1); assert.equal(result.summary.selectedActivity.completionEligible, 0);
});

test("활동도 독서 기능도 없는 반의 명단은 전체 학생과 반 수에 포함한다", () => {
  const off = dashboard("off", [student("s1"), student("s2")], { classDoc: { id: "off", name: "독서 OFF", readingEnabled: false } });
  const result = overallDashboardData([off]);
  assert.equal(result.summary.students, 2); assert.equal(result.summary.memberships, 2);
  assert.equal(result.summary.classes, 1); assert.equal(result.summary.activityCount, 0);
  assert.equal(result.summary.reading.enabledClasses, 0); assert.equal(result.summary.reading.eligibleStudents, 0);
  assert.equal(result.classes[0].reading, null); assert.equal(result.classes[0].selectedActivity, null);
  assert.deepEqual(result.students.map((row) => row.uid), ["s1", "s2"]);
});

test("도서 종류는 식별키로 합치고 같은 제목의 다른 ISBN은 구분한다", () => {
  const classes = [dashboard("c1", [student("s1")], { readingStates: { s1: state([book("b1", { isbn: "978-1" })], [log("l1", "b1", "c1", "2026-10-27", 1, 10)]) } }),
    dashboard("c2", [student("s2")], { readingStates: { s2: state([book("b2", { isbn: "978-2" })], [log("l2", "b2", "c2", "2026-10-27", 1, 20)]) } })];
  const result = overallDashboardData(classes);
  assert.equal(result.summary.reading.books, 2); assert.equal(result.summary.reading.days, 1);
  assert.deepEqual(result.reading.books.map((row) => row.key).sort(), ["9781", "9782"]);
});

test("빈 전체 보고서는 요청 기간을 유지하고 일부 반의 실패나 기간 불일치는 숨기지 않는다", () => {
  const full = dashboard("c1", [student("s1")]);
  const empty = overallDashboardData([], { period: full.period, generatedAt: NOW });
  assert.equal(empty.summary.classes, 0); assert.equal(empty.summary.students, 0); assert.equal(empty.generatedAt, NOW);
  assert.deepEqual(empty.period, full.period); assert.deepEqual(empty.students, []); assert.deepEqual(empty.reading.daily, []);
  assert.throws(() => overallDashboardData([full, null]), /일부 반/);
  assert.throws(() => overallDashboardData([full, full]), /중복/);
  assert.throws(() => overallDashboardData([{ ...full, roster: undefined }]), /명단/);
  assert.throws(() => overallDashboardData([{ ...full, reading: null }]), /독서 보고서/);
  assert.throws(() => overallDashboardData([full, { ...full, class: { ...full.class, id: "c2" }, period: { ...full.period, start: "2026-10-01" } }]), /조회 기간/);
  assert.throws(() => overallDashboardData([{ ...full, view: "student" }]), /일부 반/);
});

test("교사의 개인 보고서는 학생의 선택 반 활동만 보존하고 누적 성장과 서재·메모를 제거한다", () => {
  const own = student("s1", "하나");
  const source = buildDashboardData({ role: "student", uid: own.uid, classDoc: { id: "c1", name: "선택 반", readingEnabled: true }, roster: [own], memberUids: [own.uid],
    activities: [{ id: "a1", classId: "c1", type: "raft", title: "우리 반 쓰기" }, { id: "other", classId: "c2", type: "raft", title: "다른 반 활동" }], records: {
      bookEntries: [{ activityId: "a1", authorId: "s1", answers: { role: "내 역할" } }],
    }, readingStates: { s1: state([book("ours"), book("private", { title: "다른 반 비공개 책" })], [
      log("mine", "ours", "c1", "2026-10-28", 1, 10), log("theirs", "private", "c2", "2026-10-27", 1, 20),
    ]) }, now: NOW }, PERIOD);
  assert.equal(source.reading.personal.library.length, 2);
  const result = scopedTeacherPersonalDashboard({ ...source, roster: [own, student("another")] }, own);
  assert.equal(result.view, "student"); assert.equal(result.reportView, "personal"); assert.deepEqual(result.subject, own);
  assert.deepEqual(result.roster, [own]); assert.equal(result.reading.personal, null); assert.deepEqual(result.reading.dayRecords, []);
  assert.equal(result.reading.summary.pages, 10); assert.equal(result.studentActivities.length, 1);
  for (const marker of ["다른 반 비공개 책", "다른 반 활동", "개인 독서 메모", '"level"', '"library"']) assert.equal(JSON.stringify(result).includes(marker), false, marker);
  assert.equal(source.reading.personal.library.length, 2); assert.equal(source.reading.dayRecords.length, 1);
  assert.throws(() => scopedTeacherPersonalDashboard(source, student("another")), /다른 학생/);
  assert.throws(() => scopedTeacherPersonalDashboard({ ...source, view: "teacher" }, own), /학생을 확인/);
});
