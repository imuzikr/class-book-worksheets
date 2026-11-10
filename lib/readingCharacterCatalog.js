// Public character choices share one catalog across the chooser, map and profile.
// Styles are freely selected appearances, independent of reading levels or XP.
// 묶음 열쇠(zodiac · animal · fantasy)와 옛 열쇠 옮기기는 lib/readingCharacter.js 한 곳입니다.
import { normalizeReadingCharacter } from "./readingCharacter.js";
import { WORLD_CHARACTERS, defaultWorldAvatar } from "./readingWorldMap.js";

// 고르기 창에 서는 차례 = 등급 차례. 화면 글자는 여기 한 곳에서만 고칩니다.
// 2026년 11월 선생님이 고른 이름: 수련생 · 무도가 · 영웅(한때 초급 · 중급 · 고급) — 도복 입은 십이지는 수련생,
// 무술복 동물은 무도가, 판타지 캐릭터는 영웅. '용 · 수련생'처럼 캐릭터 이름 뒤에도 붙습니다.
export const CHARACTER_STYLE_OPTIONS = Object.freeze([
  ["zodiac", "수련생"],
  ["animal", "무도가"],
  ["fantasy", "영웅"],
].map(Object.freeze));

// 기본(아직 안 고른 학생)은 동물 묶음 — 묶음을 바꾸기 전과 같은 얼굴이 그대로 섭니다.
const DEFAULT_STYLE = "animal";

// 십이지 무술 묶음 — 사용자 제공 ZIP(zodiac-martial-arts)의 차례 그대로(뱀 · 말은 없음).
const ZODIAC_CHARACTERS = Object.freeze([
  { number: 1, id: "01-rat", name: "쥐" },
  { number: 2, id: "02-ox", name: "소" },
  { number: 3, id: "03-tiger", name: "호랑이" },
  { number: 4, id: "04-rabbit", name: "토끼" },
  { number: 5, id: "05-dragon", name: "용" },
  { number: 6, id: "06-goat", name: "양" },
  { number: 7, id: "07-monkey", name: "원숭이" },
  { number: 8, id: "08-rooster", name: "닭" },
  { number: 9, id: "09-dog", name: "개" },
  { number: 10, id: "10-pig", name: "돼지" },
].map(Object.freeze));

// 판타지 묶음 — 사용자 제공 그림의 첨부 순서 그대로. 번호는 동물 묶음과 따로입니다.
const FANTASY_CHARACTERS = Object.freeze([
  { number: 1, id: "01-elf-archer", name: "엘프 궁수" },
  { number: 2, id: "02-bear-knight", name: "곰 기사" },
  { number: 3, id: "03-dwarf", name: "드워프" },
  { number: 4, id: "04-purple-mage", name: "보라 마법사" },
  { number: 5, id: "05-red-dragon", name: "레드 드래곤" },
  { number: 6, id: "06-druid", name: "드루이드" },
  { number: 7, id: "07-masked-rogue", name: "가면 도적" },
  { number: 8, id: "08-cleric", name: "성직자" },
  { number: 9, id: "09-orc", name: "오크" },
  { number: 10, id: "10-fairy", name: "요정" },
].map(Object.freeze));

const CATALOGS = Object.freeze({ zodiac: ZODIAC_CHARACTERS, animal: WORLD_CHARACTERS, fantasy: FANTASY_CHARACTERS });

const styleOf = (style) => normalizeReadingCharacter({ number: 1, style })?.style || DEFAULT_STYLE;

export function characterCatalog(style) {
  return CATALOGS[styleOf(style)];
}

/** Missing choices retain the same UID-based animal in the default (animal) style. */
export function characterOf(row) {
  return {
    number: Number.isInteger(row?.character?.number) && row.character.number >= 1 && row.character.number <= 10
      ? row.character.number : defaultWorldAvatar(row?.uid || ""),
    style: styleOf(row?.character?.style),
  };
}

export function characterImage(character) {
  const { number, style } = characterOf({ character });
  return `/reading-journey/${style}-${String(number).padStart(2, "0")}.webp`;
}

export function styleLabel(style) {
  const selectedStyle = styleOf(style);
  return CHARACTER_STYLE_OPTIONS.find(([value]) => value === selectedStyle)[1];
}

export function characterName(character) {
  const name = characterCatalog(character?.style).find((item) => item.number === character?.number)?.name || "캐릭터";
  return `${name} · ${styleLabel(character?.style)}`;
}
