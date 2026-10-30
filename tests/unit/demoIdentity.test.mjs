import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as fixtures from "../../lib/demoClassroom.js";

// Run the real identity module with only its Firebase configuration dependency
// replaced. This also exercises production mode without initializing Firebase.
const source = await readFile(new URL("../../lib/user.js", import.meta.url), "utf8");
let serial = 0;
async function identity(configured = false) {
  globalThis.__bookbomIdentityFixtures = fixtures;
  const injected = source
    .replace('import { isFirebaseConfigured } from "./firebase";', `const isFirebaseConfigured = ${configured};`)
    .replace('import { DEMO_STUDENTS, getDemoStudent } from "./demoClassroom";', "const { DEMO_STUDENTS, getDemoStudent } = globalThis.__bookbomIdentityFixtures;");
  const encoded = Buffer.from(`${injected}\n// instance ${serial++}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function browser() {
  const values = new Map();
  const events = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { dispatchEvent: (event) => events.push(event.type) };
  globalThis.sessionStorage = storage;
  storage.setItem("anon_profile", JSON.stringify({ uid: "teacher_session", name: "기존 교사 세션", emoji: "📘" }));
  return { storage, events };
}

test("15명 체험 학생의 본인 신원을 선택하고 새 모듈에서도 유지", async () => {
  const { events } = browser();
  const users = await identity();
  for (const student of fixtures.DEMO_STUDENTS) {
    assert.equal(users.setDemoStudentSelection(student.uid), true);
    const actual = users.getCurrentUser();
    assert.equal(actual.uid, student.uid);
    assert.equal(actual.realName, student.realName);
    assert.equal(actual.studentId, student.studentId);
    assert.equal(actual.role, "student");
    assert.deepEqual(actual.classIds, [fixtures.DEMO_CLASS_ID]);
    actual.classIds.push("unrelated");
    assert.deepEqual(users.getCurrentUser().classIds, [fixtures.DEMO_CLASS_ID]);
  }
  const reloaded = await identity();
  assert.equal(reloaded.getCurrentUser().uid, fixtures.DEMO_STUDENTS.at(-1).uid);
  assert.equal(events.length, fixtures.DEMO_STUDENTS.length);
  assert.ok(events.every((event) => event === "role-change"));
});

test("교사로 돌아가면 기존 세션을 유지하고 다시 학생을 누르면 선택한 학생 복원", async () => {
  const { storage } = browser();
  const users = await identity();
  const original = storage.getItem("anon_profile");
  users.setDemoStudentSelection(fixtures.DEMO_STUDENTS[6].uid);
  assert.equal(users.setRoleOverride("admin"), true);
  assert.equal(users.getCurrentUser().uid, "teacher_session");
  assert.equal(users.getCurrentUser().role, "admin");
  assert.equal(storage.getItem("anon_profile"), original);
  users.setRoleOverride("student");
  assert.equal(users.getCurrentUser().uid, fixtures.DEMO_STUDENTS[6].uid);
});

test("잘못된 학생·역할은 적용하지 않고 손상된 학생 선택은 첫 학생으로 복구", async () => {
  const { storage, events } = browser();
  const users = await identity();
  assert.equal(users.setDemoStudentSelection("real_account_uid"), false);
  assert.equal(users.setRoleOverride("superadmin"), false);
  assert.equal(events.length, 0);
  storage.setItem("dev_role_override", "unexpected");
  assert.equal(users.getRoleOverride(), null);
  storage.setItem(users.DEMO_STUDENT_KEY, "real_account_uid");
  users.setRoleOverride("student");
  assert.equal(users.getCurrentUser().uid, fixtures.DEMO_STUDENTS[0].uid);
});

test("실서비스에서는 저장된 데모 역할과 선택을 무시하고 모든 데모 변경 차단", async () => {
  const { storage, events } = browser();
  storage.setItem("dev_role_override", "admin");
  storage.setItem("bookbom.demo.student.v1", fixtures.DEMO_STUDENTS[0].uid);
  const users = await identity(true);
  const authenticated = { uid: "real_student", role: "student", realName: "실제 사용자" };
  users._setAuthUser(authenticated);
  assert.equal(users.getCurrentUser(), authenticated);
  assert.equal(users.getRoleOverride(), null);
  assert.equal(users.getDemoStudentSelection(), null);
  assert.equal(users.setRoleOverride("admin"), false);
  assert.equal(users.setDemoStudentSelection(fixtures.DEMO_STUDENTS[3].uid), false);
  assert.equal(users.getCurrentUser(), authenticated);
  assert.equal(storage.getItem("bookbom.demo.student.v1"), fixtures.DEMO_STUDENTS[0].uid);
  assert.deepEqual(events, []);
});

test("저장 차단·서버 렌더링 환경에서 데모 선택기가 예외를 던지지 않음", async () => {
  browser();
  const users = await identity();
  globalThis.sessionStorage = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } };
  assert.equal(users.getRoleOverride(), null);
  assert.equal(users.getDemoStudentSelection().uid, fixtures.DEMO_STUDENTS[0].uid);
  assert.equal(users.setRoleOverride("student"), false);
  assert.equal(users.setDemoStudentSelection(fixtures.DEMO_STUDENTS[0].uid), false);
  const fallbackUid = users.getCurrentUser().uid;
  assert.equal(users.getCurrentUser().uid, fallbackUid);
  delete globalThis.window;
  assert.equal(users.getRoleOverride(), null);
  assert.equal(users.getDemoStudentSelection(), null);
  assert.equal(users.setRoleOverride("student"), false);
  assert.equal(users.setDemoStudentSelection(fixtures.DEMO_STUDENTS[0].uid), false);
  delete globalThis.sessionStorage;
  delete globalThis.__bookbomIdentityFixtures;
});
