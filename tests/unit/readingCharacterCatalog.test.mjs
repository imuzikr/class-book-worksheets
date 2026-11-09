import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLD_CHARACTERS, defaultWorldAvatar } from "../../lib/readingWorldMap.js";
import {
  CHARACTER_STYLE_OPTIONS, characterCatalog, characterOf, characterImage, styleLabel, characterName,
} from "../../lib/readingCharacterCatalog.js";

test("초급 · 중급 · 고급을 순서대로 제공하고 초급의 첨부 순서와 이름을 보존한다", () => {
  assert.deepEqual(CHARACTER_STYLE_OPTIONS, [["beginner", "초급"], ["intermediate", "중급"], ["advanced", "고급"]]);
  const beginners = characterCatalog("beginner");
  assert.deepEqual(beginners.map(({ number }) => number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(beginners.map(({ name }) => name), [
    "엘프 궁수", "곰 기사", "드워프", "보라 마법사", "레드 드래곤",
    "드루이드", "가면 도적", "성직자", "오크", "요정",
  ]);
  assert.equal(new Set(beginners.map(({ id }) => id)).size, 10);
});

test("중급 · 고급은 기존 동물과 ID를 그대로 사용하며 초급 번호와 혼동하지 않는다", () => {
  assert.equal(characterCatalog("intermediate"), WORLD_CHARACTERS);
  assert.equal(characterCatalog("advanced"), WORLD_CHARACTERS);
  assert.equal(characterName({ number: 1, style: "beginner" }), "엘프 궁수 · 초급");
  assert.equal(characterName({ number: 1, style: "intermediate" }), "곰 · 중급");
  assert.equal(characterName({ number: 2, style: "beginner" }), "곰 기사 · 초급");
  assert.equal(characterName({ number: 2, style: "advanced" }), "토끼 · 고급");
  assert.equal(characterName({ number: 10, style: "beginner" }), "요정 · 초급");
});

test("초급을 포함한 모든 선택은 UID · 레벨 · 경험치와 무관하게 그대로 표시한다", () => {
  for (const [style] of CHARACTER_STYLE_OPTIONS) {
    for (let number = 1; number <= 10; number += 1) {
      const character = Object.freeze({ number, style });
      assert.deepEqual(characterOf({ uid: "first", character, level: 1, totalXp: 0 }), character);
      assert.deepEqual(characterOf({ uid: "other", character, level: 100, totalXp: 999999 }), character);
    }
  }
  assert.equal(characterImage({ number: 1, style: "beginner" }), "/reading-journey/beginner-01.webp");
  assert.equal(characterImage({ number: 10, style: "beginner" }), "/reading-journey/beginner-10.webp");
  assert.equal(characterImage({ number: 3, style: "intermediate" }), "/reading-journey/intermediate-03.webp");
  assert.equal(characterImage({ number: 9, style: "advanced" }), "/reading-journey/advanced-09.webp");
});

test("선택이 없으면 기존 UID 기반 동물과 중급 기본값을 유지한다", () => {
  for (const uid of ["", "bookbom_demo_student_01", "student-a", "student-b"]) {
    const expected = { number: defaultWorldAvatar(uid), style: "intermediate" };
    assert.deepEqual(characterOf({ uid }), expected);
    assert.deepEqual(characterOf({ uid, character: null, level: 100 }), expected);
    for (const number of [0, 11, "1", 1.5, NaN, Infinity]) {
      assert.deepEqual(characterOf({ uid, character: { number, style: "beginner" } }), { ...expected, style: "beginner" });
    }
  }
  assert.deepEqual(characterOf(null), { number: defaultWorldAvatar(""), style: "intermediate" });
});

test("알 수 없는 스타일 · 경로 입력을 이미지 URL에 삽입하지 않는다", () => {
  for (const style of [undefined, null, "unknown", "__proto__", "../beginner", "beginner/../../advanced", ["beginner"]]) {
    assert.equal(characterCatalog(style), WORLD_CHARACTERS);
    assert.equal(styleLabel(style), "중급");
    assert.equal(characterImage({ number: 3, style }), "/reading-journey/intermediate-03.webp");
  }
  assert.equal(characterImage({ number: "../../elsewhere", style: "beginner" }), `/reading-journey/beginner-${String(defaultWorldAvatar("")).padStart(2, "0")}.webp`);
  assert.equal(characterName({ number: 99, style: "beginner" }), "캐릭터 · 초급");
  assert.equal(characterName(null), "캐릭터 · 중급");
});
