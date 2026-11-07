import { test } from "node:test";
import assert from "node:assert/strict";
import { activityReport, activityReportText } from "../../lib/activityReport.js";
import { createDemoBookActivities } from "../../lib/demoBookActivities.js";
import { DEMO_ACTIVITY_IDS, DEMO_STUDENTS } from "../../lib/demoClassroom.js";

const NOW = new Date("2026-11-08T00:00:00Z");
const fixture = () => createDemoBookActivities(NOW);
const members = new Set(DEMO_STUDENTS.map((student) => student.uid));
const activityOf = (data, type) => data.bookActivities.find((activity) => activity.type === type);
const reportOf = (data, type, student = DEMO_STUDENTS[0]) => activityReport(activityOf(data, type), student, data, members);

test("11종 실제 데모 활동이 문항별 학생 원문 또는 원본 시각 자료로 투영된다", () => {
  const data = fixture();
  assert.equal(Object.keys(DEMO_ACTIVITY_IDS).length, 11);
  for (const type of Object.keys(DEMO_ACTIVITY_IDS)) {
    const report = reportOf(data, type);
    assert.ok(report.topic, type);
    assert.ok(report.sections.length || report.map || report.bingo, type);
    for (const section of report.sections) {
      assert.equal(typeof section.id, "string");
      assert.equal(typeof section.title, "string");
      for (const entry of section.entries) assert.deepEqual(Object.keys(entry).sort(), ["label", "text"]);
    }
  }
  assert.equal(reportOf(data, "paratext").sections.length, 8);
  assert.equal(reportOf(data, "hashtag").sections.filter((section) => section.id.startsWith("tag-")).length, 6);
  assert.equal(reportOf(data, "kwls").sections[0].entries.length, 4);
  assert.equal(reportOf(data, "consonant").sections[0].entries.length, 14);
});

test("RAFT 원문은 3천자를 넘겨도 개행·공백·문자열과 피드백 위치가 바뀌지 않는다", () => {
  const data = fixture();
  const entry = data.bookEntries.find((item) => item.activityId === DEMO_ACTIVITY_IDS.raft && item.authorId === DEMO_STUDENTS[0].uid);
  const original = `  첫 문단 <생각> &amp;\n\n${"긴 글입니다. ".repeat(600)}\n  마지막 문단  `;
  const quote = "<생각> &amp;";
  entry.answers.writing = original;
  data.bookRaftFeedback = [{ id: "fb", activityId: entry.activityId, studentUid: entry.authorId,
    start: original.indexOf(quote), end: original.indexOf(quote) + quote.length, quote, text: "연결된 피드백", privateExtra: "PRIVATE" }];
  const report = reportOf(data, "raft");
  assert.equal(report.sections.find((section) => section.id === "writing").entries[0].text, original);
  assert.equal(report.feedback[0].quote, quote);
  assert.equal(original.slice(report.feedback[0].start, report.feedback[0].end), quote);
  assert.ok(original.length > 3000);
  assert.ok(!JSON.stringify(report).includes("PRIVATE"));
});

test("일반 서식 답안의 문단과 긴 글은 보존하고 실행 태그는 텍스트 투영에서 제거한다", () => {
  const text = `<p>첫 문단 &amp; 질문</p><div>${"생각 ".repeat(1500)}<br>이어지는 줄</div><script>SECRET_SCRIPT()</script>`;
  const result = activityReportText(text);
  assert.ok(result.startsWith("첫 문단 & 질문\n"));
  assert.ok(result.endsWith("\n이어지는 줄"));
  assert.ok(result.length > 3000);
  assert.ok(!result.includes("SECRET_SCRIPT"));
  assert.equal(activityReportText("<p>내 <생각> 그대로</p>"), "내 <생각> 그대로");
  assert.equal(activityReportText({ secret: "never stringify objects" }), "");
});

test("해시태그의 선택 대표이미지는 안전한 주소·설명·출처만 보존한다", () => {
  const data = fixture();
  const post = data.bookHashtagPosts.find((item) => item.activityId === DEMO_ACTIVITY_IDS.hashtag && item.authorId === DEMO_STUDENTS[0].uid);
  post.image = { url: "https://example.com/book.png", caption: "책 속 도서관", credit: "학생이 그린 그림", privateExtra: "PRIVATE_IMAGE" };
  const report = reportOf(data, "hashtag");
  assert.deepEqual(report.image, { url: post.image.url, caption: post.image.caption, credit: post.image.credit });
  assert.ok(!JSON.stringify(report).includes("PRIVATE_IMAGE"));
  post.image.url = "javascript:alert(1)";
  assert.equal(Object.hasOwn(reportOf(data, "hashtag"), "image"), false);
});

test("마인드맵 위치·레이아웃별 이동량·이미지와 연결 설명을 허용된 키로 보존한다", () => {
  const data = fixture();
  const student = DEMO_STUDENTS[1];
  const entry = data.bookEntries.find((item) => item.activityId === DEMO_ACTIVITY_IDS.mindmap && item.authorId === student.uid);
  entry.answers.privateExtra = "PRIVATE_MAP";
  entry.answers.nodes[1] = { ...entry.answers.nodes[1], treeOffsetY: 73, radialOffsetY: -45, x: 415, y: 82,
    image: "storage:uploads/bookbom_demo_class/bookbom_demo_student_02/picture.png", privateExtra: "PRIVATE_NODE" };
  const report = reportOf(data, "mindmap", student);
  assert.equal(report.map.layout, "tree");
  const node = report.map.nodes[1];
  assert.equal(node.treeOffsetY, 73);
  assert.equal(node.radialOffsetY, -45);
  assert.equal(node.x, 415);
  assert.equal(node.y, 82);
  assert.equal(node.image, entry.answers.nodes[1].image);
  assert.equal(node.edgeLabel, entry.answers.nodes[1].edgeLabel);
  assert.ok(!JSON.stringify(report).includes("PRIVATE_"));
});

test("닿소리·브레인라이팅·가로세로는 같은 모둠이어도 다른 학생의 글을 반환하지 않는다", () => {
  const data = fixture();
  const uid = DEMO_STUDENTS[0].uid;
  const peer = DEMO_STUDENTS[1].uid;
  for (const [type, key, writer, field] of [
    ["consonant", "bookWords", "authorId", "text"],
    ["brainwrite", "bookBwNotes", "writerUid", "text"],
    ["crossword", "bookXwHints", "writerUid", "hint"],
  ]) {
    const mine = data[key].find((item) => item.activityId === DEMO_ACTIVITY_IDS[type] && item[writer] === uid);
    const other = data[key].find((item) => item.activityId === DEMO_ACTIVITY_IDS[type] && item[writer] === peer);
    mine[field] = `OWN_${type}`;
    other[field] = `PRIVATE_PEER_${type}`;
    data[key].push({ ...mine, groupId: "foreign-group", [field]: `PRIVATE_GROUP_${type}` });
    data[key].push({ ...mine, activityId: "foreign-activity", [field]: `PRIVATE_ACTIVITY_${type}` });
    const serialized = JSON.stringify(reportOf(data, type));
    assert.ok(serialized.includes(`OWN_${type}`), type);
    assert.ok(!serialized.includes("PRIVATE_"), type);
  }
});

test("다른 반·다른 학생·교사 대리 메모·다른 대상 피드백과 임의 답안 필드를 제외한다", () => {
  const data = fixture();
  const uid = DEMO_STUDENTS[0].uid;
  const raft = data.bookEntries.find((item) => item.activityId === DEMO_ACTIVITY_IDS.raft && item.authorId === uid);
  raft.answers.secret = "PRIVATE_FIELD";
  data.bookEntries.unshift({ ...raft, classId: "foreign-class", answers: { writing: "PRIVATE_CLASS" } });
  data.bookEntries.unshift({ ...raft, authorId: DEMO_STUDENTS[1].uid, id: uid, answers: { writing: "PRIVATE_OWNER" } });
  data.bookRaftFeedback.push({ id: "foreign", activityId: raft.activityId, studentUid: DEMO_STUDENTS[1].uid, text: "PRIVATE_FEEDBACK" });
  const note = data.bookOpinionNotes.find((item) => item.authorId === uid);
  data.bookOpinionNotes.push({ ...note, byTeacher: true, text: "PRIVATE_TEACHER_NOTE" });
  for (const type of ["raft", "opinion"]) assert.ok(!JSON.stringify(reportOf(data, type)).includes("PRIVATE_"));
});

test("KWLS는 중복 저장 대신 kwl 정본을 한 번 보여 주고 빈 문항도 유지한다", () => {
  const data = fixture();
  const uid = DEMO_STUDENTS[0].uid;
  const stream = data.kwl.find((item) => item.activityId === DEMO_ACTIVITY_IDS.kwls && item.userId === uid);
  stream.answers.learned = "정본 원문\n읽은 뒤의 생각";
  stream.answers.still = "";
  const report = reportOf(data, "kwls");
  assert.equal(report.sections.length, 1);
  assert.equal(report.sections[0].entries[2].text, stream.answers.learned);
  assert.equal(report.sections[0].entries[3].text, "");
});

test("빙고는 선택 학생이 속한 판의 결과와 개인·모둠 구분을 명시한다", () => {
  const data = fixture();
  const report = reportOf(data, "bingo");
  assert.deepEqual([report.bingo.filled, report.bingo.total, report.bingo.goal, report.bingo.lines], [25, 25, 2, 2]);
  assert.equal(report.bingo.words.length, 25);
  assert.equal(report.bingo.groupResult, true);
  const ownBoard = data.bookBingoBoards.find((row) => row.activityId === DEMO_ACTIVITY_IDS.bingo && row.id === "group_1");
  assert.deepEqual(report.bingo.words, Array.from({ length: 25 }, (_, i) => ownBoard.cells[String(i)]));
  activityOf(data, "bingo").groupMode = "solo";
  assert.equal(reportOf(data, "bingo").bingo.groupResult, false);
});

test("브레인라이팅의 탈반 주인과 미배정 학생에게 다른 기여를 섞지 않는다", () => {
  const data = fixture();
  const student = DEMO_STUDENTS[0];
  const filtered = activityReport(activityOf(data, "brainwrite"), student, data, new Set([student.uid]));
  assert.equal(filtered.sections.length, 1);
  assert.equal(filtered.sections[0].title, "내가 만든 질문");
  activityOf(data, "brainwrite").questionMode = "teacher";
  const teacherQuestion = activityReport(activityOf(data, "brainwrite"), student, data, new Set([student.uid]));
  assert.equal(teacherQuestion.sections[0].title, "내가 시작한 생각");
  const unassigned = activityReport(activityOf(data, "brainwrite"), { uid: "unassigned" }, data, members);
  assert.deepEqual(unassigned.sections, []);
  assert.equal(unassigned.groupName, null);
});
