// 레벨 옷(Lv.7 탐험가 옷 · Lv.10 마스터 옷) — 레벨 → 옷 셈과 그림 파일(scripts/prepare-outfit-art.py가 넣은 120장)이 맞는가
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getExpForReadingLevel } from "../../lib/reading.js";
import {
  CHARACTER_OUTFITS, TEACHER_OUTFIT_LEVEL, characterOutfit, outfitLevelOf, outfitWardrobe,
} from "../../lib/readingCharacter.js";
import { CHARACTER_STYLE_OPTIONS, characterImage, characterOf } from "../../lib/readingCharacterCatalog.js";
import { plazaCharacterSheet } from "../../lib/readingPlazaSprites.js";

const pub = (src) => path.join(path.resolve("public"), src.replace(/^\//, ""));
const STYLES = CHARACTER_STYLE_OPTIONS.map(([style]) => style);

test("옷은 셋 — 기본(Lv.1~6) · Lv.7 탐험가 옷(Lv.7~9) · Lv.10 마스터 옷(Lv.10), 선생님은 늘 Lv.10", () => {
  assert.deepEqual(CHARACTER_OUTFITS.map((o) => [o.key, o.level, o.name]), [
    ["base", 1, "기본 옷"], ["lv07", 7, "Lv.7 탐험가 옷"], ["lv10", 10, "Lv.10 마스터 옷"],
  ]);
  for (let level = 1; level <= 6; level += 1) assert.equal(characterOutfit(level).key, "base", `Lv.${level}`);
  for (const level of [7, 8, 9]) assert.equal(characterOutfit(level).key, "lv07", `Lv.${level}`);
  for (const level of [10, 11, 100]) assert.equal(characterOutfit(level).key, "lv10", `Lv.${level}`);
  // 레벨을 모르면(서버가 아직 안 적은 학생 · 옛 입장권) 기본 옷
  for (const unknown of [undefined, null, NaN, "", "칠", -3, 0, {}, []]) assert.equal(characterOutfit(unknown).key, "base", String(unknown));
  assert.equal(TEACHER_OUTFIT_LEVEL, 10);
  assert.equal(outfitLevelOf({ teacher: true, level: 1 }), 10);
  assert.equal(outfitLevelOf({ teacher: true }), 10);
  assert.equal(outfitLevelOf({ level: 7 }), 7);
  assert.equal(outfitLevelOf(), null);
});

test("옷장 — 입을 수 있는 옷 · 지금 옷 · 다음 옷까지 남은 경험치(레벨이 내려가면 옷도 돌아감)", () => {
  const at = (xp, opts) => outfitWardrobe(xp, opts).map((o) => [o.key, o.unlocked, o.current, o.remaining]);
  const lv7 = getExpForReadingLevel(7);
  const lv10 = getExpForReadingLevel(10);
  assert.deepEqual([lv7, lv10], [2250, 7595]);
  assert.deepEqual(at(0), [["base", true, true, 0], ["lv07", false, false, lv7], ["lv10", false, false, lv10]]);
  assert.deepEqual(at(lv7 - 1), [["base", true, true, 0], ["lv07", false, false, 1], ["lv10", false, false, lv10 - lv7 + 1]]);
  assert.deepEqual(at(lv7), [["base", true, false, 0], ["lv07", true, true, 0], ["lv10", false, false, lv10 - lv7]]);
  assert.deepEqual(at(lv10), [["base", true, false, 0], ["lv07", true, false, 0], ["lv10", true, true, 0]]);
  assert.deepEqual(at(99999), at(lv10));
  // 선생님은 경험치와 상관없이 모두 입음 · 지금 옷은 Lv.10
  assert.deepEqual(at(0, { teacher: true }), [["base", true, false, 0], ["lv07", true, false, 0], ["lv10", true, true, 0]]);
  // 이상한 값은 0으로
  assert.deepEqual(at(-50), at(0));
  assert.deepEqual(at("abc"), at(0));
});

test("그림 경로 — 레벨 옷은 같은 이름 뒤에 -lv07 · -lv10, 모르는 레벨 · 모르는 캐릭터는 기본 옷 그대로", () => {
  const rat = { number: 1, style: "zodiac" };
  assert.equal(characterImage(rat), "/reading-journey/zodiac-01.webp");
  assert.equal(characterImage(rat, 6), "/reading-journey/zodiac-01.webp");
  assert.equal(characterImage(rat, 7), "/reading-journey/zodiac-01-lv07.webp");
  assert.equal(characterImage(rat, 9), "/reading-journey/zodiac-01-lv07.webp");
  assert.equal(characterImage(rat, 10), "/reading-journey/zodiac-01-lv10.webp");
  assert.equal(characterImage({ number: 4, style: "fantasy" }, outfitLevelOf({ teacher: true })), "/reading-journey/fantasy-04-lv10.webp");
  assert.equal(plazaCharacterSheet(rat), "/reading-plaza/sprites/zodiac-01.webp");
  assert.equal(plazaCharacterSheet(rat, 8), "/reading-plaza/sprites/zodiac-01-lv07.webp");
  assert.equal(plazaCharacterSheet({ number: 10, style: "animal" }, 10), "/reading-plaza/sprites/animal-10-lv10.webp");
  // 고르지 않은 학생(기본 캐릭터)도 레벨 옷을 입음
  const plain = characterOf({ uid: "아무개" });
  assert.match(characterImage(plain, 7), /^\/reading-journey\/animal-\d{2}-lv07\.webp$/);
  // 경로에 끼어들 수 없는 값은 지금처럼 거름
  assert.equal(plazaCharacterSheet({ style: "../zodiac", number: 1 }, 10), null);
  assert.equal(characterImage({ number: 3, style: "__proto__" }, 10), "/reading-journey/animal-03-lv10.webp");
});

test("그림 파일 — 세 묶음 × 10 × 두 옷, 카드 640×640 · 걷는 그림 288×288 투명 WebP가 정확히 60장씩", async () => {
  const cards = [];
  const sheets = [];
  for (const style of STYLES) {
    for (let number = 1; number <= 10; number += 1) {
      for (const level of [7, 10]) {
        cards.push(characterImage({ number, style }, level));
        sheets.push(plazaCharacterSheet({ number, style }, level));
      }
    }
  }
  for (const [list, size, maxKb] of [[cards, 640, 140], [sheets, 288, 90]]) {
    for (const src of list) {
      assert.ok(existsSync(pub(src)), `그림이 없음: ${src}`);
      const meta = await sharp(pub(src)).metadata();
      assert.deepEqual([meta.format, meta.width, meta.height, meta.hasAlpha], ["webp", size, size, true], src);
      assert.ok(statSync(pub(src)).size <= maxKb * 1024, `${src} ${Math.round(statSync(pub(src)).size / 1024)}KiB — 다시 구울 때 너무 무거움`);
    }
  }
  const outfitFiles = (dir) => readdirSync(pub(dir)).filter((name) => /-lv\d+\.webp$/.test(name)).sort();
  assert.deepEqual(outfitFiles("/reading-journey"), cards.map((src) => path.basename(src)).sort());
  assert.deepEqual(outfitFiles("/reading-plaza/sprites"), sheets.map((src) => path.basename(src)).sort());
});

test("걷는 그림 — 레벨 옷도 발 자리가 기본 옷과 같고(±1px) 칸 경계에 닿지 않는다(옷을 갈아입어도 자리가 안 튐)", async () => {
  const alphaOf = async (src) => {
    const { data, info } = await sharp(pub(src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return (x, y) => data[(y * info.width + x) * info.channels + 3];
  };
  const bottom = (alpha, row, col) => {
    for (let y = 95; y >= 0; y -= 1) {
      for (let x = 0; x < 96; x += 1) if (alpha(col * 96 + x, row * 96 + y) > 200) return y;
    }
    return -1;
  };
  for (const style of STYLES) {
    for (let number = 1; number <= 10; number += 1) {
      const base = await alphaOf(plazaCharacterSheet({ number, style }));
      for (const level of [7, 10]) {
        const src = plazaCharacterSheet({ number, style }, level);
        const alpha = await alphaOf(src);
        for (let row = 0; row < 3; row += 1) {
          for (let col = 0; col < 3; col += 1) {
            const y = bottom(alpha, row, col);
            assert.ok(Math.abs(y - bottom(base, row, col)) <= 1, `${src} 칸(${row}, ${col}) 발 높이 ${y}`);
            for (let i = 0; i < 96; i += 1) {
              for (const [x, yy] of [[i, 0], [i, 95], [0, i], [95, i]]) {
                assert.equal(alpha(col * 96 + x, row * 96 + yy), 0, `${src} 칸(${row}, ${col}) 가장자리에 그림이 닿음`);
              }
            }
          }
        }
      }
    }
  }
});

test("옷 축하 — 옷마다 한 번(이 기기에 기억한 가장 높은 옷보다 높을 때만) · 처음이면 지금 옷 · 내려가면 알리지 않음", async () => {
  const { outfitCheerFor, markOutfitSeen, readOutfitSeen } = await import("../../lib/readingOutfitCheer.js");
  const pair = (cheer) => (cheer ? [cheer.from.key, cheer.to.key] : null);
  // 기본 옷(Lv.1~6)은 축하하지 않음
  for (const level of [1, 3, 6]) assert.equal(outfitCheerFor(null, level), null);
  // 처음(적힌 것 없음) — 지금 옷을 한 번(이미 Lv.7 · Lv.10인 학생이 이 기능 뒤 처음 열 때도)
  assert.deepEqual(pair(outfitCheerFor(null, 7)), ["base", "lv07"]);
  assert.deepEqual(pair(outfitCheerFor(null, 9)), ["base", "lv07"]);
  assert.deepEqual(pair(outfitCheerFor(null, 10)), ["lv07", "lv10"]);
  assert.deepEqual(pair(outfitCheerFor("base", 7)), ["base", "lv07"]);
  // 이미 본 옷 · 그보다 낮은 옷은 다시 안 띄움(레벨이 내려갔다 다시 올라와도)
  assert.equal(outfitCheerFor("lv07", 7), null);
  assert.equal(outfitCheerFor("lv07", 9), null);
  assert.equal(outfitCheerFor("lv10", 7), null);
  assert.equal(outfitCheerFor("lv10", 10), null);
  assert.deepEqual(pair(outfitCheerFor("lv07", 10)), ["lv07", "lv10"]);
  // 모르는 값이 적혀 있으면 적힌 것이 없는 것으로
  assert.deepEqual(pair(outfitCheerFor("lv99", 7)), ["base", "lv07"]);
  // 기억 — 저장이 없는 곳(시험)에서도 이 탭 안에서는 기억하고, 높은 옷만 올라감
  assert.equal(readOutfitSeen("u-cheer"), null);
  markOutfitSeen("u-cheer", "lv07");
  assert.equal(readOutfitSeen("u-cheer"), "lv07");
  markOutfitSeen("u-cheer", "base");
  assert.equal(readOutfitSeen("u-cheer"), "lv07");
  markOutfitSeen("u-cheer", "lv10");
  assert.equal(readOutfitSeen("u-cheer"), "lv10");
  markOutfitSeen("u-cheer", "nope");
  assert.equal(readOutfitSeen("u-cheer"), "lv10");
  assert.equal(readOutfitSeen(""), null);
});
