import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bwNoteId, sortMembers, columnOrder, notesByColumn, columnRows,
  previousRow, writerProgress, writerChars, brainwriteStageTarget, brainwriteSlotState,
} from "../../lib/brainwrite.js";

const M = [
  { uid: "c", name: "다", studentId: "30103" },
  { uid: "a", name: "가", studentId: "30101" },
  { uid: "e", name: "마", studentId: "30110" },
  { uid: "b", name: "나", studentId: "30102" },
];

test("학번순(숫자로)", () => {
  assert.deepEqual(sortMembers(M).map((m) => m.uid), ["a", "b", "c", "e"]);
});

test("컬럼 차례는 주인부터 돌아가며", () => {
  assert.deepEqual(columnOrder(M, "c").map((m) => m.uid), ["c", "e", "a", "b"]);
  assert.deepEqual(columnOrder(M, "a").map((m) => m.uid), ["a", "b", "c", "e"]);
  assert.deepEqual(columnOrder(M, "zz").map((m) => m.uid), ["a", "b", "c", "e"]);
});

test("줄 · 앞 사람 · 진행", () => {
  const notes = [
    { ownerUid: "c", writerUid: "c", text: "질문" },
    { ownerUid: "c", writerUid: "e", text: "  " },
    { ownerUid: "a", writerUid: "e", text: "생각" },
  ];
  assert.equal(bwNoteId("c", "e"), "c_e");
  const by = notesByColumn(notes);
  const rows = columnRows(M, "c", by);
  assert.deepEqual(rows.map((r) => r.filled), [true, false, false, false]);
  assert.equal(previousRow(M, "c", "e", by).member.uid, "c");
  assert.equal(previousRow(M, "c", "c", by), null);
  assert.deepEqual(writerProgress(M, "e", by).map((p) => p.done), [true, false, false, false]);
  assert.equal(writerChars("e", notes), 2);
});

import { rowWritable, writerSlots } from "../../lib/brainwrite.js";

test("앞 사람이 써야 내 줄이 열림", () => {
  const rows = [{ filled: true }, { filled: false }, { filled: false }];
  assert.equal(rowWritable(rows, 0), true);
  assert.equal(rowWritable(rows, 1), true);
  assert.equal(rowWritable(rows, 2), false);
  assert.equal(rowWritable([{ filled: false }, { filled: true }], 1), true); // 이미 쓴 줄
});

test("이어 쓰는 차례 — k번째 줄의 주인", () => {
  const by = notesByColumn([
    { ownerUid: "a", writerUid: "a", text: "q" },
    { ownerUid: "a", writerUid: "b", text: "x" },
  ]);
  const s = writerSlots(M, "b", by);
  assert.deepEqual(s.map((x) => x.owner.uid), ["b", "a", "e", "c"]);
  assert.deepEqual(s.map((x) => x.done), [false, true, false, false]);
  assert.deepEqual(s.map((x) => x.ready), [true, true, false, false]);
});


test("학생 질문은 본인 첫 칸에 남고 저장된 뒤 친구의 답변 차례가 열림", () => {
  const empty = columnRows(M, "a", {});
  assert.equal(empty[0].member.uid, "a");
  assert.equal(rowWritable(empty, 0), true);
  assert.equal(rowWritable(empty, 1), false);
  const by = notesByColumn([
    { ownerUid: "a", writerUid: "a", text: "주인공은 왜 떠났을까?" },
    { ownerUid: "a", writerUid: "b", text: "새로운 곳이 궁금해서라고 생각해요." },
  ]);
  const rows = columnRows(M, "a", by);
  assert.equal(rows[0].note.text, "주인공은 왜 떠났을까?");
  assert.equal(rows[1].member.uid, "b");
  assert.equal(rowWritable(rows, 1), true);
  assert.equal(rowWritable(rows, 2), true);
  assert.equal(rowWritable(rows, 3), false);
  assert.equal(writerSlots(M, "a", by)[0].done, true);
});

test("진행 조각은 쓴 학생의 칸이 아니라 실제 기여한 친구 컬럼과 줄로 이동", () => {
  const slots = writerSlots(M, "b", notesByColumn([
    { ownerUid: "a", writerUid: "a", text: "친구 질문" },
    { ownerUid: "a", writerUid: "b", text: "내가 쓴 답" },
  ]));
  const card = { uid: "b", group: { id: "g" }, slots };
  assert.deepEqual(brainwriteStageTarget(card, "k0"), { ownerUid: "b", writerUid: "b", k: 0, stageKey: "k0" });
  assert.deepEqual(brainwriteStageTarget(card, "k1"), { ownerUid: "a", writerUid: "b", k: 1, stageKey: "k1" });
  const target = brainwriteStageTarget(card, "k1");
  const rows = columnRows(M, target.ownerUid, notesByColumn([
    { ownerUid: "a", writerUid: "a", text: "친구 질문" },
    { ownerUid: "a", writerUid: "b", text: "내가 쓴 답" },
  ]));
  assert.equal(rows[target.k].member.uid, target.writerUid);
  assert.equal(rows[target.k].note.text, "내가 쓴 답");
});

test("작은 모둠에 없는 차례와 미배정 학생은 다른 원문으로 이동하지 않음", () => {
  const pair = M.slice(0, 2);
  const card = { uid: "a", group: { id: "g" }, slots: writerSlots(pair, "a", {}) };
  assert.equal(brainwriteStageTarget(card, "k2"), null);
  assert.equal(brainwriteStageTarget({ uid: "a", group: null, slots: [] }, "k0"), null);
  assert.equal(brainwriteStageTarget({ ...card, group: null }, "k0"), null);
  assert.equal(brainwriteStageTarget(card, "col"), null);
  assert.equal(brainwriteStageTarget(card, "k-1"), null);
  assert.equal(brainwriteStageTarget(card, undefined), null);
});

test("미배정·해당 차례 없음·앞 차례 대기·내 차례·완료를 서로 구분", () => {
  assert.equal(brainwriteSlotState({ group: null, unassigned: true, slots: [] }, 0), "unassigned");
  const card = { group: { id: "g" }, slots: [
    { k: 0, done: true, ready: true },
    { k: 1, done: false, ready: true },
    { k: 2, done: false, ready: false },
  ] };
  assert.equal(brainwriteSlotState(card, 0), "done");
  assert.equal(brainwriteSlotState(card, 1), "doing");
  assert.equal(brainwriteSlotState(card, 2), "empty");
  assert.equal(brainwriteSlotState(card, 3), "none");
});
