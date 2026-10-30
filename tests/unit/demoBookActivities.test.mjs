import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoBookActivities } from "../../lib/demoBookActivities.js";
import { DEMO_ACTIVITY_IDS, DEMO_CLASS_ID, DEMO_STUDENTS } from "../../lib/demoClassroom.js";
import { paratextDoneCount } from "../../lib/paratext.js";
import { raftDone, raftStarted } from "../../lib/raft.js";
import { kwlsFilledCount } from "../../lib/kwls.js";
import { qmarkDone, qmarkStarted } from "../../lib/qmark.js";
import { hashtagProgress, normalizeHashtagPost } from "../../lib/hashtag.js";
import { cellIndexOfWord } from "../../lib/consonants.js";
import { columnRows, notesByColumn, writerProgress } from "../../lib/brainwrite.js";
import { entryCellKeys, fixedLettersOf, groupSolveProgress, normalizeGroupCrossword } from "../../lib/crossword.js";

const NOW = new Date("2026-10-30T15:05:00.000Z");
const studentIds = DEMO_STUDENTS.map((s) => s.uid).sort();
const sortedIds = (records, field) => [...new Set(records.map((r) => r[field]))].sort();
const fixture = () => createDemoBookActivities(NOW);

test("체험반 15명 전원은 10종 활동마다 실제 확인할 기록이 있음", () => {
  const data = fixture();
  assert.deepEqual(data.bookActivities.map((a) => a.type).sort(), Object.keys(DEMO_ACTIVITY_IDS).sort());
  assert.ok(data.bookActivities.every((a) => a.classId === DEMO_CLASS_ID));
  for (const type of ["paratext", "raft", "kwls", "mindmap", "qmark"]) {
    const entries = data.bookEntries.filter((e) => e.activityId === DEMO_ACTIVITY_IDS[type]);
    assert.deepEqual(sortedIds(entries, "authorId"), studentIds, type);
    assert.equal(entries.length, 15, type);
  }
  for (const [records, field] of [
    [data.bookWords, "authorId"], [data.bookOpinionNotes, "authorId"], [data.bookHashtagPosts, "authorId"],
    [data.bookXwHints, "writerUid"], [data.bookBwNotes, "writerUid"],
  ]) assert.deepEqual(sortedIds(records, field), studentIds);
});

test("활동 모둠은 3개씩 5명이며 낱말·평가·이어쓰기의 학생 귀속이 정확함", () => {
  const data = fixture();
  const groups = new Map(data.bookGroups.map((g) => [`${g.activityId}:${g.id}`, g]));
  for (const type of ["consonant", "paratext", "raft", "crossword", "brainwrite"]) {
    const rows = data.bookGroups.filter((g) => g.activityId === DEMO_ACTIVITY_IDS[type]);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((g) => g.members.length === 5 && g.memberUids.length === 5));
    assert.deepEqual(rows.flatMap((g) => g.memberUids).sort(), studentIds);
  }
  for (const word of data.bookWords) {
    assert.ok(groups.get(`${word.activityId}:${word.groupId}`).memberUids.includes(word.authorId));
    assert.equal(word.cellKey, `c${cellIndexOfWord(word.text)}`);
  }
  for (const review of data.bookPeerReviews) {
    const group = groups.get(`${review.activityId}:${review.groupId}`);
    assert.ok(group.memberUids.includes(review.fromUid));
    assert.ok(group.memberUids.includes(review.toUid));
    assert.notEqual(review.fromUid, review.toUid);
    assert.ok(data.bookEntries.some((e) => e.activityId === review.activityId && e.authorId === review.toUid));
  }
  for (const note of data.bookBwNotes) {
    const group = groups.get(`${note.activityId}:${note.groupId}`);
    assert.ok(group.memberUids.includes(note.ownerUid));
    assert.ok(group.memberUids.includes(note.writerUid));
  }
});

test("화면의 실제 진행 함수에서 완성·부분작성 상태가 모두 확인됨", () => {
  const data = fixture();
  const entries = (type) => data.bookEntries.filter((e) => e.activityId === DEMO_ACTIVITY_IDS[type]);
  const paratext = entries("paratext").map((e) => paratextDoneCount(e.answers));
  assert.ok(paratext.includes(8) && paratext.some((n) => n > 0 && n < 8));
  const raft = entries("raft");
  assert.ok(raft.every((e) => raftStarted(e.answers)));
  assert.ok(raft.some((e) => raftDone(e.answers)) && raft.some((e) => !raftDone(e.answers)));
  const kwls = entries("kwls").map((e) => kwlsFilledCount(e.answers));
  assert.ok(kwls.includes(4) && kwls.includes(2));
  const qmark = entries("qmark");
  assert.ok(qmark.every((e) => qmarkStarted(e.answers)));
  assert.ok(qmark.some((e) => qmarkDone(e.answers)) && qmark.some((e) => !qmarkDone(e.answers)));
  const hashtag = data.bookHashtagPosts.map((p) => hashtagProgress(normalizeHashtagPost(p)).done);
  assert.ok(hashtag.includes(6) && hashtag.includes(2));
});

test("KWLS 이중 저장은 동일한 활동·학생·답을 가리키며 댓글 수신자도 존재함", () => {
  const data = fixture();
  assert.equal(data.kwl.length, 15);
  for (const kwl of data.kwl) {
    const entry = data.bookEntries.find((e) => e.activityId === kwl.activityId && e.authorId === kwl.userId);
    assert.deepEqual(kwl.answers, entry.answers);
    assert.equal(kwl.L, kwl.answers.learned);
    assert.equal(kwl.S, kwl.answers.still);
    assert.equal(kwl.classId, DEMO_CLASS_ID);
    assert.match(kwl.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  for (const comment of data.bookHashtagComments) {
    assert.ok(data.bookHashtagPosts.some((p) => p.activityId === comment.activityId && p.authorId === comment.postUid));
    assert.ok(["like", "ask", "suggest"].includes(comment.kind));
  }
});

test("실제 퍼즐에서 모둠별 힌트·정답 지문과 채운 판의 풀이 기록이 일치함", () => {
  const data = fixture();
  const puzzle = normalizeGroupCrossword(data.bookActivities.find((a) => a.type === "crossword").crossword);
  assert.equal(puzzle.entries.length, 15);
  assert.equal(puzzle.stage, "solve");
  for (const board of data.bookXwBoards) {
    const own = data.bookXwHints.filter((hint) => hint.groupId === board.groupId);
    assert.equal(own.length, 5);
    for (const hint of own) {
      assert.equal(puzzle.entries[hint.idx].groupId, board.groupId);
      assert.equal(hint.hint.includes(hint.word), false, hint.word);
    }
    const fixed = fixedLettersOf(puzzle, own);
    const progress = groupSolveProgress(puzzle, board.groupId, board.cells, fixed);
    const solveIds = data.bookXwSolves.filter((solve) => solve.groupId === board.groupId).map((solve) => solve.idx).sort((a, b) => a - b);
    assert.deepEqual([...progress.solved].sort((a, b) => a - b), solveIds);
    assert.ok(progress.solved.size > 0);
    for (const entry of puzzle.entries) assert.equal(entryCellKeys(entry).length, entry.len);
  }
});

test("낱말 풀이 단계의 공개 퍼즐에는 다른 모둠이 읽을 힌트가 모두 게시됨", () => {
  const data = fixture();
  const puzzle = normalizeGroupCrossword(data.bookActivities.find((a) => a.type === "crossword").crossword);
  const hints = new Map(data.bookXwHints.map((hint) => [hint.idx, hint]));
  for (const [index, entry] of puzzle.entries.entries()) {
    assert.ok(entry.clue.trim().length > 0, `낱말 ${index}의 공개 힌트`);
    assert.equal(entry.clue, hints.get(index).hint);
  }
});

test("브레인라이팅은 앞줄이 있는 순서대로 채워지고 모든 학생이 참여함", () => {
  const data = fixture();
  for (const group of data.bookGroups.filter((g) => g.activityId === DEMO_ACTIVITY_IDS.brainwrite)) {
    const notes = data.bookBwNotes.filter((n) => n.groupId === group.id);
    const byColumn = notesByColumn(notes);
    for (const owner of group.members) {
      const rows = columnRows(group.members, owner.uid, byColumn);
      let empty = false;
      for (const row of rows) {
        if (!row.filled) empty = true;
        else assert.equal(empty, false, "빈 앞줄을 건너뛰어 작성한 fixture가 없어야 함");
      }
    }
    for (const student of group.members) assert.ok(writerProgress(group.members, student.uid, byColumn).some((p) => p.done));
  }
});

test("날짜는 미래가 아니며 생성은 결정적이고 반환값은 서로 독립적임", () => {
  const first = fixture();
  const second = fixture();
  assert.deepEqual(first, second);
  for (const rows of Object.values(first)) for (const record of rows) {
    for (const key of ["createdAt", "updatedAt", "movedAt", "replyAt", "replySeenAt", "at"]) {
      if (record[key] instanceof Date) assert.ok(record[key].getTime() <= NOW.getTime(), key);
    }
  }
  first.bookEntries[0].answers.covers = "changed";
  first.bookGroups[0].members[0].name = "changed";
  assert.notEqual(first.bookEntries[0].answers.covers, second.bookEntries[0].answers.covers);
  assert.notEqual(first.bookGroups[0].members[0].name, second.bookGroups[0].members[0].name);
});
