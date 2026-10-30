import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterProgressCards, getProgressStageRows, getProgressStageStates,
} from "../../lib/progressStageFilter.js";

const rows = [{ key: "plan", label: "계획" }, { key: "write", label: "글쓰기" }];
const cards = [
  { uid: "not-started" },
  { uid: "planning", entry: { answers: { plan: "done", write: "doing" } } },
  { uid: "finished", entry: { answers: { plan: "done", write: "done" } } },
];
const cellState = (row, answers) => answers[row.key] ?? "empty";

test("교사는 선택한 단계의 미작성·일부 작성 학생을 실제 답안 상태로 추린다", () => {
  const options = { rows, cellState, stageKey: "write" };
  assert.deepEqual(filterProgressCards(cards, { ...options, state: "empty" }).map((c) => c.uid), ["not-started"]);
  assert.deepEqual(filterProgressCards(cards, { ...options, state: "doing" }).map((c) => c.uid), ["planning"]);
  assert.deepEqual(getProgressStageStates(cards, options), [
    { state: "empty", count: 1 }, { state: "doing", count: 1 }, { state: "done", count: 1 },
  ]);
});

test("다른 단계의 답안이 있어도 선택한 단계 미작성 상태를 가리지 않는다", () => {
  const planningOnly = { uid: "p", entry: { answers: { plan: "done" } } };
  assert.equal(filterProgressCards([planningOnly], { rows, cellState, stageKey: "write", state: "empty" }).length, 1);
  assert.equal(filterProgressCards([planningOnly], { rows, cellState, stageKey: "plan", state: "empty" }).length, 0);
});

test("필터를 초기화하면 같은 전체 명부를 반환하며 원본을 바꾸지 않는다", () => {
  const snapshot = JSON.stringify(cards);
  assert.equal(filterProgressCards(cards, { rows, cellState }), cards);
  assert.equal(filterProgressCards(cards, { rows, cellState, state: "empty" }), cards);
  assert.equal(filterProgressCards(cards, { rows, cellState, stageKey: "plan" }), cards);
  filterProgressCards(cards, { rows, cellState, stageKey: "plan", state: "done" });
  assert.equal(JSON.stringify(cards), snapshot);
  assert.equal(cards.length, 3);
});

test("브레인라이팅의 작은 모둠·미배정 학생을 앞 차례 대기와 섞지 않는다", () => {
  const turns = [{ key: "k0", label: "첫 줄" }, { key: "k1", label: "둘째 줄" }];
  const writers = [
    { uid: "waiting", ownRows: turns, entry: { answers: { k0: "done", k1: "empty" } } },
    { uid: "ready", ownRows: turns, entry: { answers: { k1: "doing" } } },
    { uid: "small-group", ownRows: turns.slice(0, 1) },
    { uid: "no-group", unassigned: true, ownRows: [] },
  ];
  const options = { rows: turns, rowsOf: (card) => card.ownRows, cellState, stageKey: "k1" };
  assert.deepEqual(getProgressStageStates(writers, options), [
    { state: "empty", count: 1 }, { state: "doing", count: 1 },
    { state: "none", count: 1 }, { state: "unassigned", count: 1 },
  ]);
  assert.deepEqual(filterProgressCards(writers, { ...options, state: "empty" }).map((c) => c.uid), ["waiting"]);
  assert.deepEqual(filterProgressCards(writers, { ...options, state: "unassigned" }).map((c) => c.uid), ["no-group"]);
});

test("가변 단계 목록은 모둠별 공통 키를 한 번씩만 보여 준다", () => {
  const ownRows = [{ key: "k0", label: "첫 줄" }, { key: "k1", label: "둘째 줄" }];
  const result = getProgressStageRows([{ count: 1 }, { count: 2 }, { count: 0 }], {
    rowsOf: (card) => ownRows.slice(0, card.count),
  });
  assert.deepEqual(result, ownRows);
});

test("상태 계산에는 학생 카드도 전달하여 배정·차례 정보를 재사용한다", () => {
  const roster = [{ uid: "waiting", status: "locked" }, { uid: "ready", status: "doing" }];
  const options = { rows, stageKey: "plan", cellState: (_row, _answers, card) => card.status };
  assert.deepEqual(filterProgressCards(roster, { ...options, state: "locked" }).map((c) => c.uid), ["waiting"]);
  assert.deepEqual(getProgressStageStates(roster, options), [{ state: "doing", count: 1 }, { state: "locked", count: 1 }]);
});

test("실시간 수정으로 선택 상태 학생이 없어지면 빈 목록이며 전체 명부는 유지한다", () => {
  const completed = [{ uid: "last", entry: { answers: { write: "done" } } }];
  assert.deepEqual(filterProgressCards(completed, { rows, cellState, stageKey: "write", state: "doing" }), []);
  assert.equal(completed.length, 1);
});
