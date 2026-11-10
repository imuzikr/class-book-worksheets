import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { WORLD_CHARACTERS, defaultWorldAvatar } from "../../lib/readingWorldMap.js";
import {
  CHARACTER_STYLE_OPTIONS, characterCatalog, characterOf, characterImage, styleLabel, characterName,
} from "../../lib/readingCharacterCatalog.js";

test("수련생(십이지) · 무도가(동물) · 영웅(판타지)을 순서대로 제공하고 제공 순서와 이름을 보존한다", () => {
  assert.deepEqual(CHARACTER_STYLE_OPTIONS, [["zodiac", "수련생"], ["animal", "무도가"], ["fantasy", "영웅"]]);
  const zodiac = characterCatalog("zodiac");
  assert.deepEqual(zodiac.map(({ number }) => number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(zodiac.map(({ name }) => name), ["쥐", "소", "호랑이", "토끼", "용", "양", "원숭이", "닭", "개", "돼지"]);
  const fantasy = characterCatalog("fantasy");
  assert.deepEqual(fantasy.map(({ number }) => number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(fantasy.map(({ name }) => name), [
    "엘프 궁수", "곰 기사", "드워프", "보라 마법사", "레드 드래곤",
    "드루이드", "가면 도적", "성직자", "오크", "요정",
  ]);
  for (const [style] of CHARACTER_STYLE_OPTIONS) {
    assert.equal(new Set(characterCatalog(style).map(({ id }) => id)).size, 10, style);
  }
});

test("무도가는 기존 동물과 ID를 그대로 사용하며 다른 묶음의 번호와 혼동하지 않는다", () => {
  assert.equal(characterCatalog("animal"), WORLD_CHARACTERS);
  assert.equal(characterName({ number: 1, style: "zodiac" }), "쥐 · 수련생");
  assert.equal(characterName({ number: 1, style: "animal" }), "곰 · 무도가");
  assert.equal(characterName({ number: 1, style: "fantasy" }), "엘프 궁수 · 영웅");
  assert.equal(characterName({ number: 2, style: "fantasy" }), "곰 기사 · 영웅");
  assert.equal(characterName({ number: 5, style: "zodiac" }), "용 · 수련생");
  assert.equal(characterName({ number: 10, style: "fantasy" }), "요정 · 영웅");
});

test("옛 열쇠로 저장된 선택은 같은 모습으로 보인다 — 판타지는 영웅, 옛 고급(십이지)은 같은 번호의 수련생", () => {
  assert.deepEqual(characterOf({ uid: "a", character: { number: 3, style: "beginner" } }), { number: 3, style: "fantasy" });
  assert.equal(characterImage({ number: 3, style: "beginner" }), "/reading-journey/fantasy-03.webp");
  assert.equal(characterName({ number: 3, style: "beginner" }), "드워프 · 영웅");
  assert.deepEqual(characterOf({ uid: "a", character: { number: 4, style: "intermediate" } }), { number: 4, style: "animal" });
  assert.equal(characterImage({ number: 4, style: "intermediate" }), "/reading-journey/animal-04.webp");
  assert.deepEqual(characterOf({ uid: "a", character: { number: 2, style: "advanced" } }), { number: 2, style: "zodiac" });
  assert.equal(characterImage({ number: 2, style: "advanced" }), "/reading-journey/zodiac-02.webp");
  assert.equal(characterName({ number: 2, style: "advanced" }), "소 · 수련생");
  assert.equal(characterName({ number: 5, style: "advanced" }), "용 · 수련생");
});

test("모든 선택은 UID · 레벨 · 경험치와 무관하게 그대로 표시한다", () => {
  for (const [style] of CHARACTER_STYLE_OPTIONS) {
    for (let number = 1; number <= 10; number += 1) {
      const character = Object.freeze({ number, style });
      assert.deepEqual(characterOf({ uid: "first", character, level: 1, totalXp: 0 }), character);
      assert.deepEqual(characterOf({ uid: "other", character, level: 100, totalXp: 999999 }), character);
    }
  }
  assert.equal(characterImage({ number: 1, style: "zodiac" }), "/reading-journey/zodiac-01.webp");
  assert.equal(characterImage({ number: 10, style: "zodiac" }), "/reading-journey/zodiac-10.webp");
  assert.equal(characterImage({ number: 3, style: "animal" }), "/reading-journey/animal-03.webp");
  assert.equal(characterImage({ number: 9, style: "fantasy" }), "/reading-journey/fantasy-09.webp");
});

test("그림 파일은 세 묶음 × 10장, 정확히 30장이 있다(내린 옛 고급 그림은 남지 않음)", () => {
  const dir = new URL("../../public/reading-journey/", import.meta.url);
  const expected = [];
  for (const [style] of CHARACTER_STYLE_OPTIONS) {
    for (let number = 1; number <= 10; number += 1) {
      const file = characterImage({ number, style }).replace("/reading-journey/", "");
      expected.push(file);
      assert.ok(existsSync(new URL(file, dir)), `그림이 없음: ${file}`);
    }
  }
  const present = readdirSync(dir).filter((name) => /^[a-z]+-\d{2}\.webp$/.test(name)).sort();
  assert.deepEqual(present, expected.sort());
});

test("선택이 없으면 기존 UID 기반 동물과 무도가(동물) 기본값을 유지한다", () => {
  for (const uid of ["", "bookbom_demo_student_01", "student-a", "student-b"]) {
    const expected = { number: defaultWorldAvatar(uid), style: "animal" };
    assert.deepEqual(characterOf({ uid }), expected);
    assert.deepEqual(characterOf({ uid, character: null, level: 100 }), expected);
    for (const number of [0, 11, "1", 1.5, NaN, Infinity]) {
      assert.deepEqual(characterOf({ uid, character: { number, style: "zodiac" } }), { ...expected, style: "zodiac" });
    }
  }
  assert.deepEqual(characterOf(null), { number: defaultWorldAvatar(""), style: "animal" });
});

test("알 수 없는 스타일 · 경로 입력을 이미지 URL에 삽입하지 않는다", () => {
  for (const style of [undefined, null, "unknown", "__proto__", "constructor", "../zodiac", "zodiac/../../fantasy", ["zodiac"]]) {
    assert.equal(characterCatalog(style), WORLD_CHARACTERS);
    assert.equal(styleLabel(style), "무도가");
    assert.equal(characterImage({ number: 3, style }), "/reading-journey/animal-03.webp");
  }
  assert.equal(characterImage({ number: "../../elsewhere", style: "zodiac" }), `/reading-journey/zodiac-${String(defaultWorldAvatar("")).padStart(2, "0")}.webp`);
  assert.equal(characterName({ number: 99, style: "zodiac" }), "캐릭터 · 수련생");
  assert.equal(characterName(null), "캐릭터 · 무도가");
});
