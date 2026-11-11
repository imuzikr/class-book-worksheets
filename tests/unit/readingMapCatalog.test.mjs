import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  DEFAULT_READING_MAP_THEME, READING_MAP_THEMES, getReadingMapTheme,
  isReadingMapTheme, readingMapThemeOf, readingMapThemeSettings,
} from "../../lib/readingMapCatalog.js";

test("맵 선택은 등록된 두 값만 허용하고 기존 반·잘못된 값은 구름섬으로 안전하게 표시한다", () => {
  assert.equal(DEFAULT_READING_MAP_THEME, "cloud-islands");
  for (const theme of READING_MAP_THEMES) {
    assert.ok(isReadingMapTheme(theme.id));
    assert.equal(readingMapThemeOf({ readingMapTheme: theme.id }), theme.id);
    assert.ok(existsSync(new URL(`../../public${theme.image}`, import.meta.url)));
    assert.ok(existsSync(new URL(`../../public${theme.preview}`, import.meta.url)));
  }
  for (const value of [undefined, null, false, 0, {}, [], "", "../outside", "CONTINENT"]) {
    assert.equal(isReadingMapTheme(value), false);
    assert.equal(readingMapThemeOf({ readingMapTheme: value }), DEFAULT_READING_MAP_THEME);
    assert.equal(getReadingMapTheme(value).id, DEFAULT_READING_MAP_THEME);
  }
  assert.equal(readingMapThemeOf(), DEFAULT_READING_MAP_THEME);
});

test("교사 선택 상태는 운영 중인 반만 비교하고 서로 다른 지도는 혼합 상태로 구분한다", () => {
  const values = Object.freeze([
    Object.freeze({ id: "one", readingMapTheme: "continent" }),
    Object.freeze({ id: "two", readingMapTheme: "continent" }),
    Object.freeze({ id: "old", archived: true, readingMapTheme: "cloud-islands" }),
  ]);
  assert.deepEqual(readingMapThemeSettings(values), { value: "continent", mixed: false });
  assert.equal(readingMapThemeSettings([...values, { id: "new" }]).mixed, true);
  assert.deepEqual(readingMapThemeSettings([]), { value: DEFAULT_READING_MAP_THEME, mixed: false });
  assert.deepEqual(readingMapThemeSettings(null), { value: DEFAULT_READING_MAP_THEME, mixed: false });
});
