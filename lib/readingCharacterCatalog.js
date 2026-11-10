// Public character choices share one catalog across the chooser, map and profile.
// Styles are freely selected appearances, independent of reading levels or XP.
import { normalizeReadingCharacter } from "./readingCharacter.js";
import { WORLD_CHARACTERS, defaultWorldAvatar } from "./readingWorldMap.js";

export const CHARACTER_STYLE_OPTIONS = Object.freeze([
  ["beginner", "초급"],
  ["intermediate", "중급"],
  ["advanced", "고급"],
].map(Object.freeze));

// Keep the supplied beginner images in attachment order. Their identities are
// separate from the numbered animals shared by the intermediate/advanced sets.
const BEGINNER_CHARACTERS = Object.freeze([
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

const styleOf = (style) => normalizeReadingCharacter({ number: 1, style })?.style || "intermediate";

export function characterCatalog(style) {
  return styleOf(style) === "beginner" ? BEGINNER_CHARACTERS : WORLD_CHARACTERS;
}

/** Missing choices retain the same UID-based animal and intermediate style. */
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
