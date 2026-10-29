import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CLASSES_KEY, readDemoClasses, writeDemoClasses } from "../../lib/demoClasses.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const CREATED = "2026-10-29T03:00:00.000Z";
const EXPIRES = "2026-11-12T03:00:00.000Z";
const classroom = (id, extra = {}) => ({
  id, name: `${id}반`, createdBy: "teacher_01", createdAt: new Date(CREATED),
  joinCode: "MATH31", codeExpiresAt: new Date(EXPIRES), readingEnabled: false,
  archived: false, order: 0, ...extra,
});
function seed(storage, classes, version = 1) {
  storage.setItem(DEMO_CLASSES_KEY, JSON.stringify({ version, classes }));
}

test("책나눔 설정은 새 저장소에서 기본 꺼짐이며 값 누락으로 켜지지 않음", () => {
  const storage = memoryStorage();
  assert.equal(DEMO_CLASSES_KEY, "bookbom.demo.classes.v1");
  assert.equal(readDemoClasses(storage), null);
  const noFlags = classroom("class1");
  delete noFlags.readingEnabled;
  delete noFlags.archived;
  seed(storage, [noFlags]);
  const restored = readDemoClasses(storage);
  assert.equal(restored[0].readingEnabled, false);
  assert.equal(restored[0].archived, false);
});

test("반별 켜기·끄기를 직렬화한 뒤 새로 읽어도 서로 독립적으로 유지", () => {
  const storage = memoryStorage();
  writeDemoClasses([
    classroom("class1", { readingEnabled: true }),
    classroom("class2", { readingEnabled: false, order: 1 }),
  ], storage);
  // Recreate the storage adapter to model a fresh page/module instance.
  const afterReload = memoryStorage();
  afterReload.setItem(DEMO_CLASSES_KEY, storage.getItem(DEMO_CLASSES_KEY));
  let restored = readDemoClasses(afterReload);
  assert.deepEqual(restored.map((c) => [c.id, c.readingEnabled]), [["class1", true], ["class2", false]]);
  // A later teacher change must replace the persisted value, not merge truthy flags.
  writeDemoClasses(restored.map((c) => ({ ...c, readingEnabled: c.id === "class2" })), afterReload);
  const secondReload = memoryStorage();
  secondReload.setItem(DEMO_CLASSES_KEY, afterReload.getItem(DEMO_CLASSES_KEY));
  restored = readDemoClasses(secondReload);
  assert.deepEqual(restored.map((c) => [c.id, c.readingEnabled]), [["class1", false], ["class2", true]]);
});

test("새로 만든 반의 식별자·교사·참여 코드·날짜·보관 상태까지 복원", () => {
  const storage = memoryStorage();
  const saved = classroom("cl_custom_321", { name: "수요일 독서반", createdBy: "teacher_other", archived: true, order: 8, joinCode: "READ45" });
  writeDemoClasses([saved], storage);
  const [restored] = readDemoClasses(storage);
  assert.equal(restored.id, saved.id);
  assert.equal(restored.name, saved.name);
  assert.equal(restored.createdBy, saved.createdBy);
  assert.equal(restored.joinCode, saved.joinCode);
  assert.equal(restored.archived, true);
  assert.equal(restored.order, 8);
  assert.ok(restored.createdAt instanceof Date);
  assert.ok(restored.codeExpiresAt instanceof Date);
  assert.equal(restored.createdAt.toISOString(), CREATED);
  assert.equal(restored.codeExpiresAt.toISOString(), EXPIRES);
});

test("문자열·숫자 플래그는 저장된 활성화 권한으로 해석하지 않음", () => {
  const storage = memoryStorage();
  for (const value of ["true", "false", 1, 0, {}, [], null]) {
    seed(storage, [classroom("class1", { readingEnabled: value })]);
    const restored = readDemoClasses(storage);
    assert.equal(restored, null);
  }
});

test("손상된 저장값·알 수 없는 버전·잘못된 반 구조는 안전하게 무시", () => {
  const storage = memoryStorage();
  for (const raw of ["", "{broken", "null", "[]", JSON.stringify({ version: 99, classes: [classroom("class1")] }), JSON.stringify({ version: 1, classes: {} })]) {
    storage.setItem(DEMO_CLASSES_KEY, raw);
    assert.equal(readDemoClasses(storage), null);
  }
  for (const invalid of [
    { ...classroom("class1"), id: "" },
    { ...classroom("class1"), name: "" },
    { ...classroom("class1"), createdBy: "" },
    { ...classroom("class1"), id: 123 },
    { ...classroom("class1"), createdAt: "not-a-date" },
    null,
  ]) {
    seed(storage, [invalid]);
    assert.equal(readDemoClasses(storage), null);
  }
});

test("저장소 읽기가 제한돼도 앱 시작을 막지 않고 빈 스냅샷은 구별", () => {
  assert.equal(readDemoClasses({ getItem() { throw new Error("Blocked storage"); } }), null);
  const storage = memoryStorage();
  writeDemoClasses([], storage);
  assert.deepEqual(readDemoClasses(storage), []);
});

test("개인 활동·학생 명단·수업 자료는 반 설정 스냅샷에 복사하지 않음", () => {
  const storage = memoryStorage();
  writeDemoClasses([classroom("class1", {
    task: { text: "private lesson content" }, students: [{ name: "학생 이름" }],
    notes: "private note", readingState: { logs: ["private reading"] },
  })], storage);
  const serialized = storage.getItem(DEMO_CLASSES_KEY);
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.version, 1);
  const allowed = new Set(["id", "name", "createdBy", "readingEnabled", "archived", "order", "createdAt", "codeExpiresAt", "joinCode"]);
  assert.ok(Object.keys(envelope.classes[0]).every((key) => allowed.has(key)));
  assert.equal(serialized.includes("private"), false);
  assert.equal(serialized.includes("학생 이름"), false);
});

test("브라우저 저장 실패를 성공으로 숨기지 않고 조치 가능한 오류를 반환", () => {
  const persisted = memoryStorage();
  writeDemoClasses([classroom("class1", { readingEnabled: false })], persisted);
  const storage = { getItem: persisted.getItem, setItem() { throw new Error("Quota exceeded"); } };
  assert.throws(() => writeDemoClasses([classroom("class1", { readingEnabled: true })], storage), /저장|브라우저/);
  assert.equal(readDemoClasses(storage)[0].readingEnabled, false);
});

test("중복 반 식별자는 설정 대상을 혼동하지 않도록 읽기·쓰기를 거부", () => {
  const storage = memoryStorage();
  const duplicates = [classroom("class1", { readingEnabled: true }), classroom("class1", { readingEnabled: false })];
  seed(storage, duplicates);
  assert.equal(readDemoClasses(storage), null);
  assert.throws(() => writeDemoClasses(duplicates, storage), /반 정보/);
});
