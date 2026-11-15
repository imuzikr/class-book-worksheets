// 참여 코드 직접 정하기의 셈(lib/joinCode.js) — 반 관리하기의 '수정' 칸과 자료 함수(setJoinCode)가 함께 씁니다
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOIN_CODE_MAX, JOIN_CODE_MIN, JOIN_CODE_PATTERN, JOIN_CODE_TTL_DAYS,
  joinCodeLookalikeHint, joinCodeProblem, joinCodeSaveError, tidyJoinCode,
} from "@/lib/joinCode";
import { readFileSync } from "node:fs";

test("다듬기 — 영어는 대문자로, 띄어쓰기 · 붙임표는 걷고, 다른 글자는 남긴다(까닭을 말하려고)", () => {
  assert.equal(tidyJoinCode("book3b"), "BOOK3B");
  assert.equal(tidyJoinCode(" Book-3B  class "), "BOOK3BCLASS");
  assert.equal(tidyJoinCode("3반_코드"), "3반_코드");
  assert.equal(tidyJoinCode(null), "");
});

test("받을 수 없는 까닭 — 빈 칸 · 한글(한/영 키) · 기호 · 길이", () => {
  assert.match(joinCodeProblem(""), /적어 주세요/);
  assert.match(joinCodeProblem("ㅠㅐㅐㅏ3B"), /한\/영 키/);
  assert.match(joinCodeProblem("BOOK_3B"), /영어와 숫자만/);
  assert.equal(joinCodeProblem("BOOK3"), `${JOIN_CODE_MIN}~${JOIN_CODE_MAX}자로 정해 주세요. 지금 5자예요.`);
  assert.match(joinCodeProblem("ABCDEFGHJKMNP"), /지금 13자/);
  assert.equal(joinCodeProblem("BOOK3B"), "");
  assert.equal(joinCodeProblem("ABCDEFGHJKMN"), "");
});

test("규칙과 같은 모양 — 화면이 받는 코드는 firestore.rules의 create 검사와 같다", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  assert.ok(rules.includes(`code.matches('${JOIN_CODE_PATTERN.source}')`), "규칙의 코드 모양이 lib/joinCode.js와 다릅니다");
  for (const code of ["BOOK3B", "CLASS7", "ABCDEFGHJKMN", "AB12C", "ABCDEFGHJKMNP", "BOOK_3"]) {
    assert.equal(joinCodeProblem(code) === "", JOIN_CODE_PATTERN.test(code), code);
  }
  // 학생의 입장 칸은 12자에서 자릅니다 — 그보다 긴 코드를 받으면 학생이 들어올 수 없습니다
  assert.equal(JOIN_CODE_MAX, 12);
  assert.equal(JOIN_CODE_TTL_DAYS, 14);
});

test("헷갈리는 짝 — 한 코드에 둘 다 들었을 때만 알린다", () => {
  assert.equal(joinCodeLookalikeHint("BOOK3B"), "");
  assert.equal(joinCodeLookalikeHint("CLASS7"), "");
  assert.equal(joinCodeLookalikeHint("BOOK10"), "O와 0이 함께 있으면 학생이 헷갈리기 쉬워요.");
  assert.equal(joinCodeLookalikeHint("LOOK10"), "O와 0, I · L과 1이 함께 있으면 학생이 헷갈리기 쉬워요.");
  assert.match(joinCodeLookalikeHint("LUCKY1"), /I · L과 1/);
  assert.doesNotMatch(joinCodeLookalikeHint("LUCKY1"), /O와 0/);
});

test("바꾸지 못한 까닭 한 줄 — 낯선 오류는 영어 문구 대신 우리말로", () => {
  const error = (reason, message = "") => Object.assign(new Error(message || reason), { reason });
  assert.equal(joinCodeSaveError(error("invalid", "영어와 숫자만 쓸 수 있어요.")), "영어와 숫자만 쓸 수 있어요.");
  assert.match(joinCodeSaveError(error("taken")), /다른 반이 쓰고 있는 코드/);
  assert.match(joinCodeSaveError(error("missing")), /반을 찾지 못했어요/);
  assert.match(joinCodeSaveError(new Error("Missing or insufficient permissions.")), /잠시 후 다시/);
  assert.match(joinCodeSaveError(null), /잠시 후 다시/);
});
