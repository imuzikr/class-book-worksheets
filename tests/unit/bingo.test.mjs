// 낱말 빙고(lib/bingo.js) — 줄 세기 · 순위 · 채우기 · 부르기.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BINGO_CELLS, BINGO_LINES, BINGO_LINE_COUNT, BINGO_WORD_MAX,
  bingoWordPool, normalizeBingo, normalizeBingoCells, bingoProgress,
  rankBingo, bingoRandomFill, nextBingoCall, normalizeBingoGoal,
} from "../../lib/bingo.js";

function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// 0~24번 칸에 w0 ~ w24
const WORDS = Array.from({ length: 30 }, (_, i) => `w${i}`);
const FULL = Object.fromEntries(WORDS.slice(0, 25).map((w, i) => [String(i), w]));

test("줄은 가로 5 · 세로 5 · 대각선 2 = 12줄이고 칸 번호가 판 안에 있다", () => {
  assert.equal(BINGO_LINES.length, BINGO_LINE_COUNT);
  assert.equal(BINGO_LINE_COUNT, 12);
  for (const l of BINGO_LINES) {
    assert.equal(l.cells.length, 5);
    assert.ok(l.cells.every((i) => i >= 0 && i < BINGO_CELLS));
  }
  assert.deepEqual(BINGO_LINES.find((l) => l.key === "d1").cells, [4, 8, 12, 16, 20]);
});

test("낱말 상자 — 겹친 것 · 빈 것 · 너무 긴 것은 빼고 처음 차례 그대로", () => {
  const long = "가".repeat(BINGO_WORD_MAX + 1);
  const pool = bingoWordPool([{ text: " 사과 " }, { text: "사과" }, { text: "" }, { text: long }, "배", { word: "감" }]);
  assert.deepEqual(pool, ["사과", "배", "감"]);
});

test("normalizeBingo — 상자에 없는 낱말 · 겹친 부름은 버리고, 목표는 1~5", () => {
  const b = normalizeBingo({ stage: "play", words: ["가", "나", "다"], called: ["나", "나", "라", "가"], goal: 9 });
  assert.equal(b.stage, "play");
  assert.deepEqual(b.called, ["나", "가"]);
  assert.equal(b.goal, 3);
  assert.equal(normalizeBingo(null), null);
  assert.equal(normalizeBingo({}).stage, "fill");
  assert.equal(normalizeBingoGoal("2"), 2);
});

test("칸 맵 → 길이 25 배열(빈칸은 빈 글자)", () => {
  const cells = normalizeBingoCells({ 0: "가", 24: "나", 30: "넘침" });
  assert.equal(cells.length, 25);
  assert.equal(cells[0], "가");
  assert.equal(cells[24], "나");
  assert.equal(cells.filter(Boolean).length, 2);
});

test("부른 낱말로 칸을 표시하고 완성된 줄을 센다", () => {
  // 첫 가로줄(w0~w4)과 첫 세로줄(w0, w5, w10, w15, w20)
  const called = ["w0", "w1", "w2", "w3", "w4", "w5", "w10", "w15", "w20", "x"];
  const p = bingoProgress(FULL, called, 2);
  assert.equal(p.count, 2);
  assert.deepEqual(p.lines.sort(), ["c0", "r0"]);
  assert.equal(p.marked.size, 9);
  assert.ok(p.lineCells.has(20));
  assert.equal(p.bingo, true);
  // 둘째 줄은 w20을 부른 때(9번째) 완성
  assert.equal(p.bingoAt, 9);
  // 목표 3줄이면 아직 빙고 아님
  const q = bingoProgress(FULL, called, 3);
  assert.equal(q.bingo, false);
  assert.equal(q.bingoAt, null);
});

test("대각선도 줄이고, 빈칸은 표시되지 않는다", () => {
  const p = bingoProgress(FULL, ["w0", "w6", "w12", "w18", "w24"], 1);
  assert.deepEqual(p.lines, ["d0"]);
  const holes = { ...FULL };
  delete holes["12"];
  const q = bingoProgress(holes, ["w0", "w6", "w12", "w18", "w24"], 1);
  assert.equal(q.count, 0);
  assert.equal(q.filled, 24);
});

test("순위 — 먼저 빙고한 판이 앞, 그다음 줄 수 · 표시 칸 · 채운 칸 · 원래 차례", () => {
  const called = ["w0", "w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9"];
  const a = { ...bingoProgress(FULL, called, 1), order: 0 }; // 5번째에 빙고, 2줄
  const swapped = { ...FULL, 0: "w9", 9: "w0" }; // 같은 낱말 — 줄은 같지만 늦게 빙고
  const b = { ...bingoProgress(swapped, called, 1), order: 1 };
  const c = { ...bingoProgress({}, called, 1), order: 2 };
  const d = { ...bingoProgress({}, called, 1), order: 3 };
  assert.equal(a.bingoAt, 5);
  assert.equal(b.bingoAt, 9);
  const ranked = rankBingo([d, c, b, a]);
  assert.deepEqual(ranked.map((x) => x.order), [0, 1, 2, 3]);
});

test("무작위 채우기 — 빈칸만, 이미 놓인 낱말은 다시 안 씀, 모자라면 남김", () => {
  const set = bingoRandomFill({ 0: "w0", 1: "w1" }, WORDS, seeded());
  assert.equal(Object.keys(set).length, 23);
  assert.ok(!("0" in set) && !("1" in set));
  const vals = Object.values(set);
  assert.equal(new Set(vals).size, vals.length);
  assert.ok(!vals.includes("w0") && !vals.includes("w1"));
  const few = bingoRandomFill({}, ["가", "나", "다"], seeded());
  assert.equal(Object.keys(few).length, 3);
});

test("무작위 부르기 — 판에 놓인 안 부른 낱말 먼저, 다 부르면 상자에서, 없으면 null", () => {
  const rng = seeded(3);
  const boards = [{ 0: "w0", 1: "w1" }];
  for (let i = 0; i < 10; i++) {
    const w = nextBingoCall(boards, WORDS, ["w0"], rng);
    assert.equal(w, "w1");
  }
  const w = nextBingoCall(boards, WORDS, ["w0", "w1"], rng);
  assert.ok(WORDS.includes(w) && w !== "w0" && w !== "w1");
  assert.equal(nextBingoCall(boards, ["w0"], ["w0"], rng), null);
});

test("판 크기 — 4×4는 16칸 · 10줄, 없거나 이상한 값은 5×5", async () => {
  const { normalizeBingoSize, bingoCellCount, bingoLineCount, bingoLines, normalizeBingo } = await import("../../lib/bingo.js");
  assert.equal(normalizeBingoSize(4), 4);
  assert.equal(normalizeBingoSize(undefined), 5);
  assert.equal(normalizeBingoSize(6), 5);
  assert.equal(bingoCellCount(4), 16);
  assert.equal(bingoLineCount(4), 10);
  assert.equal(bingoLines(4).length, 10);
  assert.deepEqual(bingoLines(4).find((l) => l.key === "d1").cells, [3, 6, 9, 12]);
  assert.equal(normalizeBingo({ words: [] }).size, 5);
  assert.equal(normalizeBingo({ size: 4, words: [] }).size, 4);
});

test("4×4 진행 — 칸 16개만 읽고, 첫 가로줄이 불리면 1줄", async () => {
  const { bingoProgress, normalizeBingoCells, bingoRandomFill } = await import("../../lib/bingo.js");
  const words = Array.from({ length: 16 }, (_, i) => `낱말${i}`);
  const cells = Object.fromEntries(words.map((w, i) => [String(i), w]));
  cells["20"] = "판밖";
  assert.equal(normalizeBingoCells(cells, 4).length, 16);
  const p = bingoProgress(cells, ["낱말0", "낱말1", "낱말2", "낱말3"], 1, 4);
  assert.equal(p.total, 16);
  assert.equal(p.filled, 16);
  assert.equal(p.count, 1);
  assert.equal(p.bingo, true);
  assert.equal(p.bingoAt, 4);
  const set = bingoRandomFill({}, words, () => 0.5, 4);
  assert.equal(Object.keys(set).length, 16);
  assert.ok(Object.keys(set).every((k) => Number(k) < 16));
});
