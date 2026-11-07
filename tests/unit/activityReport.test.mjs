import { test } from "node:test";
import assert from "node:assert/strict";
import { activityReportContent, readableAnswer } from "../../lib/activityReport.js";
import { buildDashboardData } from "../../lib/dashboard.js";
import { scopedTeacherPersonalDashboard } from "../../lib/dashboardReports.js";
import { createDemoClassroom, DEMO_STUDENTS, DEMO_ACTIVITY_IDS } from "../../lib/demoClassroom.js";
import { createDemoBookActivities } from "../../lib/demoBookActivities.js";

const NOW = "2026-10-30T03:00:00.000Z";
const classroom = createDemoClassroom(NOW);
const fixture = createDemoBookActivities(NOW);
const fullRange = { period: "custom", start: "2026-10-03", end: "2026-10-30" };

function textOf(report) {
  return report.sections.flatMap((section) => section.items.flatMap((item) => [item.text, item.note || ""])).join("\n");
}
function states(report, sectionId) {
  return report.sections.find((section) => section.id === sectionId).items.map((item) => item.state);
}

test("답안의 태그는 걷고 문단은 남긴다", () => {
  assert.equal(readableAnswer("<p>첫째 문단</p><p>둘째 <b>문단</b></p><script>alert(1)</script>"), "첫째 문단\n둘째 문단");
  assert.equal(readableAnswer("javascript:alert(1)").includes("alert"), true);
});

test("열 가지 활동은 가상 학생의 실제 답과 빈 칸을 함께 담고 다른 학생 글은 넣지 않는다", () => {
  const student = DEMO_STUDENTS[10];
  const data = buildDashboardData({
    role: "student", uid: student.uid, classDoc: classroom.classDoc, roster: [student],
    memberUids: classroom.students.map((item) => item.uid), activities: fixture.bookActivities, records: fixture, now: NOW,
  }, fullRange);
  assert.deepEqual(data.studentActivities.map((activity) => activity.type), Object.keys(DEMO_ACTIVITY_IDS));
  const byType = Object.fromEntries(data.studentActivities.map((activity) => [activity.type, activity]));
  assert.match(textOf(byType.paratext), /바람을 모으는 도서관/);
  assert.equal(byType.paratext.sections.find((section) => section.id === "T-title").items.find((item) => item.id === "titleSub").state, "optional");
  assert.equal(byType.paratext.sections.find((section) => section.id === "P-page").items.every((item) => item.state === "missing"), true);
  assert.match(textOf(byType.raft), /다양성/);
  assert.match(textOf(byType.kwls), /읽기 전 나는/);
  assert.equal(byType.kwls.sections.find((section) => section.id === "still").items[0].state, "missing");
  assert.match(textOf(byType.mindmap), /각자 다른 끝맺음/);
  assert.equal(JSON.stringify(byType.mindmap).includes("https://"), false);
  assert.match(textOf(byType.opinion), /다양성/);
  assert.equal(byType.hashtag.sections.find((section) => section.id === "tags").items.length >= 6, true);
  assert.equal(byType.hashtag.sections.find((section) => section.id === "tags").items.filter((item) => item.state === "missing").length, 2);
  assert.equal(byType.qmark.sections.find((section) => section.id === "asks").items.filter((item) => item.state === "missing").length > 0, true);
  assert.equal(byType.qmark.sections.find((section) => section.id === "picks").items.find((item) => item.id === "bias").state, "selected");
  assert.equal(byType.qmark.sections.find((section) => section.id === "picks").items.find((item) => item.id === "interest").state, "missing");
  assert.match(textOf(byType.consonant), /도서관|독서|마음|이야기|책/);
  assert.equal(byType.crossword.sections[0].items.some((item) => item.state === "written"), true);
  assert.equal(byType.brainwrite.sections[0].items.some((item) => item.state === "written"), true);
  assert.equal(byType.brainwrite.sections[0].items.some((item) => item.state === "missing"), true);
  const own = JSON.stringify(data.studentActivities);
  assert.equal(own.includes("용기를 생각했다"), false);
  assert.equal(own.includes("<script>"), false);
  assert.equal(own.includes("개인 감상문"), false);
  const teacher = buildDashboardData({
    role: "teacher", uid: "t1", classDoc: classroom.classDoc, roster: classroom.students,
    memberUids: classroom.students.map((item) => item.uid), activities: fixture.bookActivities, records: fixture, now: NOW,
  }, { ...fullRange, activityId: DEMO_ACTIVITY_IDS.raft });
  assert.equal(teacher.studentActivities.length, 0);
  assert.equal(teacher.activity.rows[0].sections, undefined);
});

test("모둠 낱말과 힌트는 그 학생이 맡은 것만 보여 준다", () => {
  const [one, two] = ["s1", "s2"].map((uid, index) => ({ uid, name: `학생${index + 1}`, studentId: String(index + 1) }));
  const activity = { id: "a1", classId: "c1", type: "consonant", groupMode: "teacher", topic: "우리 책" };
  const records = {
    bookGroups: [{ id: "g1", activityId: "a1", groupName: "가 모둠", memberUids: ["s1", "s2"], members: [one, two] }],
    bookWords: [
      { id: "w1", activityId: "a1", groupId: "g1", authorId: "s1", cellKey: "c0", text: "가나다" },
      { id: "w2", activityId: "a1", groupId: "g1", authorId: "s2", cellKey: "c1", text: "다른학생낱말" },
    ],
  };
  const mine = activityReportContent(activity, one, records, ["s1", "s2"]);
  assert.match(textOf(mine), /가나다/);
  assert.equal(textOf(mine).includes("다른학생낱말"), false);
  const quiz = { id: "x1", classId: "c1", type: "crossword", groupMode: "teacher", sourceTitle: "닿소리" };
  const hints = {
    bookGroups: [{ id: "g1", activityId: "x1", groupName: "가 모둠", memberUids: ["s1", "s2"], members: [one, two] }],
    bookXwHints: [
      { id: "h1", activityId: "x1", groupId: "g1", writerUid: "s1", num: 1, dir: "across", word: "도서관", hint: "<b>책을 만나는 곳</b>" },
      { id: "h2", activityId: "x1", groupId: "g1", writerUid: "s2", num: 2, dir: "down", word: "비밀단어", hint: "다른 학생의 힌트" },
    ],
  };
  const report = activityReportContent(quiz, one, hints, ["s1", "s2"]);
  assert.equal(report.sourceLabel, "낱말 출처 · 닿소리");
  assert.equal(textOf(report).trim(), "책을 만나는 곳");
  assert.equal(JSON.stringify(report).includes("비밀단어"), false);
  assert.equal(report.bookUrl, "");
});

test("그림 주소와 위험한 링크는 답안 원문으로 옮기지 않는다", () => {
  const student = { uid: "s1", name: "학생" };
  const map = activityReportContent({ id: "m", type: "mindmap", topic: "책", bookUrl: "javascript:alert(1)" }, student, {
    bookEntries: [{ activityId: "m", authorId: "s1", answers: { nodes: [
      { id: "root", parentId: null, text: "책" },
      { id: "pic", parentId: "root", text: "", image: "https://secret.example/private.png" },
    ] } }],
  });
  assert.equal(map.bookUrl, "");
  assert.equal(JSON.stringify(map).includes("secret.example"), false);
  assert.equal(map.sections.find((section) => section.id === "branches").items[0].state, "attached");
});

test("배정 대기인 활동은 빈 답안을 지어내지 않는다", () => {
  const report = activityReportContent({ id: "b", type: "brainwrite", topic: "질문" }, { uid: "s1" }, { bookBwNotes: [
    { activityId: "b", groupId: "g", writerUid: "s1", ownerUid: "s1", text: "배정 전 글" },
  ] }, ["s1"]);
  assert.deepEqual(report.sections, []);
  assert.equal(JSON.stringify(report).includes("배정 전 글"), false);
});

test("KWLS 정본이 있으면 그 글을 보여 준다", () => {
  const report = activityReportContent({ id: "k", type: "kwls" }, { uid: "s1" }, {
    bookEntries: [{ activityId: "k", authorId: "s1", answers: { learned: "엔트리 글" } }],
    kwl: [{ activityId: "k", userId: "s1", answers: { know: "정본", learned: "정본에서 알게 된 것" } }],
  });
  assert.match(textOf(report), /정본에서 알게 된 것/);
  assert.equal(textOf(report).includes("엔트리 글"), false);
  assert.deepEqual(states(report, "want"), ["missing"]);
});

test("교사 개인 보고서에는 그 학생의 활동 답만 남는다", () => {
  const own = { uid: "s1", name: "하나", studentId: "1" };
  const source = buildDashboardData({
    role: "student", uid: "s1", classDoc: { id: "c1", name: "선택 반", readingEnabled: false }, roster: [own], memberUids: ["s1"],
    activities: [{ id: "a1", classId: "c1", type: "raft", title: "편지", topic: "우리 책" }],
    records: { bookEntries: [{ activityId: "a1", authorId: "s1", answers: { role: "화자", writing: "<p>학생 글</p><script>x</script>" } }] },
    now: NOW,
  }, fullRange);
  const result = scopedTeacherPersonalDashboard(source, own);
  const writing = result.studentActivities[0].sections.find((section) => section.id === "writing").items[0];
  assert.equal(writing.state, "written");
  assert.equal(writing.text, "학생 글");
  assert.equal(result.studentActivities[0].topic, "우리 책");
  assert.equal(JSON.stringify(result).includes("<script>"), false);
});
