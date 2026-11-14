import { test } from "node:test";
import assert from "node:assert/strict";
import { hideoutOn, teacherFeatureSettings, featuresForNewClass } from "../../lib/reading.js";
import { readDemoClasses, writeDemoClasses } from "../../lib/demoClasses.js";

const enabled = { readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true };
const classroom = (id, flags = {}) => ({ id, name: id, createdBy: "teacher", ...flags });
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test("아지트는 명시적으로 켠 운영 반에서 책나눔·광장·교실이 모두 켜져야 열림", () => {
  assert.equal(hideoutOn(enabled), true);
  assert.equal(hideoutOn(null), false);
  assert.equal(hideoutOn({ readingEnabled: true, plazaEnabled: true, classroomEnabled: true }), false);
  for (const key of Object.keys(enabled)) {
    assert.equal(hideoutOn({ ...enabled, [key]: false }), false, key);
    assert.equal(hideoutOn({ ...enabled, [key]: "true" }), false, key);
  }
  assert.equal(hideoutOn({ ...enabled, archived: true }), false);
});

test("교사 아지트 설정은 운영 중인 모든 반에 적용하고 새 반도 같은 설정을 따름", () => {
  const classes = [classroom("a", enabled), classroom("b", enabled), classroom("archived", { archived: true })];
  assert.deepEqual(teacherFeatureSettings(classes).hideoutEnabled, { on: true, mixed: false });
  assert.equal(featuresForNewClass(classes).hideoutEnabled, true);
  const mixed = [classes[0], classroom("b")];
  assert.deepEqual(teacherFeatureSettings(mixed).hideoutEnabled, { on: false, mixed: true });
  assert.equal(featuresForNewClass(mixed).hideoutEnabled, false);
  assert.deepEqual(teacherFeatureSettings([]).hideoutEnabled, { on: false, mixed: false });
});

test("체험 반에서 아지트 켜기·끄기가 새로고침 뒤에도 유지되고 다른 설정은 보존됨", () => {
  const local = storage();
  writeDemoClasses([classroom("a", enabled), classroom("b", { ...enabled, hideoutEnabled: false })], local);
  const restored = readDemoClasses(local);
  assert.deepEqual(restored.map((row) => row.hideoutEnabled), [true, false]);
  writeDemoClasses(restored.map((row) => ({ ...row, hideoutEnabled: false })), local);
  const disabled = readDemoClasses(local);
  assert.deepEqual(disabled.map((row) => row.hideoutEnabled), [false, false]);
  assert.ok(disabled.every((row) => row.classroomEnabled && row.plazaEnabled && row.readingEnabled));
});

test("체험 반의 손상된 아지트 설정은 활성화 값으로 복원하지 않음", () => {
  for (const value of [null, "true", 1, {}, []]) {
    assert.throws(() => writeDemoClasses([classroom("a", { hideoutEnabled: value })], storage()));
    const local = storage();
    local.setItem("bookbom.demo.classes.v1", JSON.stringify({ version: 1, classes: [classroom("a", { hideoutEnabled: value })] }));
    assert.equal(readDemoClasses(local), null);
  }
});
