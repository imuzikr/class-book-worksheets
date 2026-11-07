// 반 완전 삭제의 목록(lib/classPurge.js)이 규칙(firestore.rules)과 어긋나지 않는지 —
// 반에 딸린 컬렉션을 새로 만들고 목록에 안 더하면, 반을 지워도 그 기록만 남습니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLASS_LINKED_COLLECTIONS,
  CLASS_NESTED,
  CLASS_SPECIAL_COLLECTIONS,
  CLASS_SUBCOLLECTIONS,
  NOT_CLASS_COLLECTIONS,
  purgeNameMatches,
  purgeStepText,
} from "../../lib/classPurge.js";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const lines = rules.split("\n");

// classes/{cId} 블록 — 그 match 줄부터 같은 들여쓰기의 닫는 괄호까지
function classesBlock() {
  const start = lines.findIndex((l) => /^ {4}match \/classes\/\{cId\} \{/.test(l));
  const end = lines.findIndex((l, i) => i > start && l === "    }");
  return lines.slice(start + 1, end);
}

test("반 아래 컬렉션이 모두 지울 목록에 있다", () => {
  const nested = new Set(Object.values(CLASS_NESTED).flat());
  const names = classesBlock()
    .map((l) => l.match(/^\s+match \/([A-Za-z]+)\//)?.[1])
    .filter(Boolean);
  assert.ok(names.length > 10);
  for (const n of names) {
    assert.ok(CLASS_SUBCOLLECTIONS.includes(n) || nested.has(n), `${n} — lib/classPurge.js에 더하세요`);
  }
});

test("최상위 컬렉션이 모두 어느 갈래에 들어 있다", () => {
  const names = lines.map((l) => l.match(/^ {4}match \/([A-Za-z]+)\//)?.[1]).filter(Boolean);
  const known = new Set([...CLASS_LINKED_COLLECTIONS, ...CLASS_SPECIAL_COLLECTIONS, ...NOT_CLASS_COLLECTIONS]);
  for (const n of names) assert.ok(known.has(n), `${n} — 반에 딸렸으면 CLASS_LINKED_COLLECTIONS에`);
});

test("반 이름은 그대로 적어야 한다", () => {
  assert.equal(purgeNameMatches("3학년 3반", "3학년 3반"), true);
  assert.equal(purgeNameMatches("  3학년 3반 ", "3학년 3반"), true);
  assert.equal(purgeNameMatches("3학년3반", "3학년 3반"), false);
  assert.equal(purgeNameMatches("", ""), false);
});

test("진행 표시", () => {
  assert.equal(purgeStepText({ stage: "activities", done: 0, total: 4 }), "독서 활동 지우는 중 (1/4)");
  assert.equal(purgeStepText({ stage: "records", done: 9, total: 10 }), "반 기록 지우는 중 (10/10)");
  assert.equal(purgeStepText(null), "");
});
