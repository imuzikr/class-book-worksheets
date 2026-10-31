// 체험용 샘플 반 — 들어가기·나가기 세션 값과 데모 전환 판정.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SAMPLE_CLASS_ID,
  SAMPLE_CLASS_KEY,
  canUseSampleClass,
  clearSampleClass,
  markSampleClass,
} from "../../lib/sampleClass.js";
import { readSampleFlag } from "../../lib/firebase.js";

function memory(init = {}) {
  const values = new Map(Object.entries(init));
  return {
    values,
    getItem: (k) => (values.has(k) ? values.get(k) : null),
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k),
  };
}

test("교사·관리자만 샘플 반을 쓸 수 있다", () => {
  assert.equal(canUseSampleClass({ role: "teacher" }), true);
  assert.equal(canUseSampleClass({ role: "admin" }), true);
  assert.equal(canUseSampleClass({ role: "student" }), false);
  assert.equal(canUseSampleClass(null), false);
});

test("들어가면 표시·교사 보기·샘플 반이 정해지고, 나가면 원래 반으로 돌아간다", () => {
  const s = memory({ study_class_id: "realClassA", unrelated: "keep" });
  markSampleClass(s);
  assert.equal(readSampleFlag(s), true);
  assert.equal(s.getItem("study_class_id"), SAMPLE_CLASS_ID);
  assert.equal(s.getItem("dev_role_override"), "admin");
  // 체험 중 학생 보기로 바꾼 흔적
  s.setItem("bookbom.demo.student.v1", "demo_s1");
  s.setItem("anon_profile", "{}");
  clearSampleClass(s);
  assert.equal(readSampleFlag(s), false);
  assert.equal(s.getItem(SAMPLE_CLASS_KEY), null);
  assert.equal(s.getItem("dev_role_override"), null);
  assert.equal(s.getItem("bookbom.demo.student.v1"), null);
  assert.equal(s.getItem("anon_profile"), null);
  assert.equal(s.getItem("study_class_id"), "realClassA");
  assert.equal(s.getItem("unrelated"), "keep");
});

test("로그아웃은 체험 값과 샘플 반 선택을 모두 지우고 원래 반도 되돌리지 않는다", () => {
  const s = memory({ study_class_id: "realClassA" });
  markSampleClass(s);
  clearSampleClass(s, { restore: false });
  assert.equal(readSampleFlag(s), false);
  assert.equal(s.getItem("study_class_id"), null);
  assert.equal(s.values.size, 0);
});

test("반을 고르지 않은 채 들어갔다 나오면 샘플 반 id가 남지 않는다", () => {
  const s = memory();
  markSampleClass(s);
  clearSampleClass(s);
  assert.equal(s.getItem("study_class_id"), null);
});

test("저장소가 없거나 막혀 있어도 터지지 않는다", () => {
  assert.equal(readSampleFlag(null), false);
  assert.equal(readSampleFlag({ getItem() { throw new Error("blocked"); } }), false);
  assert.doesNotThrow(() => clearSampleClass(null));
});

// lib/firebase.js를 Firebase SDK 없이 실행해, 탭의 표시에 따라 데모 전환이
// 정해지는지 봅니다(실제 반 동작은 표시가 없을 때 그대로).
const source = await readFile(new URL("../../lib/firebase.js", import.meta.url), "utf8");
let serial = 0;
async function firebaseModule(win) {
  globalThis.window = win;
  const injected = source
    .replace(/import \{[^}]*\} from "firebase\/app";/, "const initializeApp = () => ({}); const getApps = () => [];")
    .replace(/import \{[^}]*\} from "firebase\/firestore";/, "const getFirestore = () => ({});")
    .replace(/import \{[^}]*\} from "firebase\/auth";/, "const getAuth = () => ({});")
    .replace(/import \{[^}]*\} from "firebase\/storage";/, "const getStorage = () => ({});");
  const encoded = Buffer.from(`${injected}\n// instance ${serial++}`).toString("base64");
  try {
    return await import(`data:text/javascript;base64,${encoded}`);
  } finally {
    delete globalThis.window;
  }
}

test("표시가 없으면 실제 Firebase, 표시가 있으면 데모 자료(샘플 반)", async () => {
  const plain = await firebaseModule({ location: { hostname: "x" }, sessionStorage: memory() });
  assert.equal(plain.firebaseReady, true);
  assert.equal(plain.sampleMode, false);
  assert.equal(plain.isFirebaseConfigured, true);

  const sample = await firebaseModule({ location: { hostname: "x" }, sessionStorage: memory({ [SAMPLE_CLASS_KEY]: "1" }) });
  assert.equal(sample.sampleMode, true);
  assert.equal(sample.isFirebaseConfigured, false);
  // 로그인 확인·로그아웃용으로 auth는 그대로 준비됩니다
  assert.ok(sample.auth);
});
