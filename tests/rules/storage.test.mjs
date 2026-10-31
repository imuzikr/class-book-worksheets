// =============================================================
// Storage 규칙 — uploads/{userId}/{fileName}  (이미지 보안 1단계 안전망)
//
// **지금 규칙을 있는 그대로 기록**합니다. 고쳐야 할 동작도 "통과"로 적어 둡니다.
//   ① 로그인만 하면 누구 폴더든 읽기·목록 보기가 된다(다른 반 학생 포함) ← 2단계에서 막을 곳
//   ② 비로그인은 못 읽는다
//   ③ 쓰기는 제 uid 폴더에만, 이미지 6MB 미만 · 문서 20MB 미만 · 텍스트 1MB 미만
//   ④ 지우기는 본인 또는 교사/관리자(클레임이나 users 문서의 role)
//   ⑤ uploads 밖은 전부 막힌다
// 반(class) 개념이 규칙에 아직 없으므로, '같은 반/다른 반' 학생은 결과가 똑같아야 합니다.
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes, getMetadata, listAll, deleteObject } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { asStudent, asTeacher, asAdmin } from "./helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const hostPort = (raw, port) => {
  if (!raw) return { host: "127.0.0.1", port };
  const [host, p] = raw.split(":");
  return { host, port: Number(p) };
};

// 같은 반: stu1·stu2(교사 t1) / 다른 반: other(교사 t2)
const FILE = "uploads/stu1/1_photo.jpg";
const img = (n = 10) => new Uint8Array(n);
const jpeg = { contentType: "image/jpeg" };
let env;

before(async () => {
  env = await initializeTestEnvironment({
    // 규칙의 firestore.get()은 에뮬레이터를 띄운 프로젝트(package.json의 --project)를 봅니다.
    projectId: "demo-rules-test",
    storage: { rules: readFileSync(resolve(here, "../../storage.rules"), "utf8"), ...hostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 9199) },
    firestore: { rules: readFileSync(resolve(here, "../../firestore.rules"), "utf8"), ...hostPort(process.env.FIRESTORE_EMULATOR_HOST, 8080) },
  });
});
after(() => env?.cleanup());
beforeEach(async () => {
  await env.clearStorage();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), FILE), img(), jpeg);
    await setDoc(doc(ctx.firestore(), "users", "docTeacher"), { role: "teacher" });
    await setDoc(doc(ctx.firestore(), "users", "stu2"), { role: "student" });
  });
});

const st = (ctx) => ctx.storage();

describe("읽기 — 현재: 로그인한 누구나", () => {
  it("본인", () => assertSucceeds(getBytes(ref(st(asStudent(env, "stu1")), FILE))));
  it("같은 반 학생", () => assertSucceeds(getBytes(ref(st(asStudent(env, "stu2")), FILE))));
  it("다른 반 학생도 통과 (2단계에서 막을 곳)", () => assertSucceeds(getBytes(ref(st(asStudent(env, "other")), FILE))));
  it("다른 반 학생이 메타데이터도 읽음", () => assertSucceeds(getMetadata(ref(st(asStudent(env, "other")), FILE))));
  it("다른 반 학생이 남의 폴더 목록(list)도 봄", () => assertSucceeds(listAll(ref(st(asStudent(env, "other")), "uploads/stu1"))));
  it("uploads 맨 위 목록은 아무도 못 봄(규칙이 uploads/{uid}/… 에만 걸림)", () => assertFails(listAll(ref(st(asStudent(env, "other")), "uploads"))));
  it("담임 교사", () => assertSucceeds(getBytes(ref(st(asTeacher(env, "t1")), FILE))));
  it("다른 반 교사", () => assertSucceeds(getBytes(ref(st(asTeacher(env, "t2")), FILE))));
  it("비로그인은 실패", () => assertFails(getBytes(ref(st(env.unauthenticatedContext()), FILE))));
  it("비로그인 목록도 실패", () => assertFails(listAll(ref(st(env.unauthenticatedContext()), "uploads/stu1"))));
});

describe("쓰기 — 제 폴더에만, 종류·크기 제한", () => {
  it("본인 폴더에 이미지", () => assertSucceeds(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/stu1/2.jpg"), img(), jpeg)));
  it("같은 반 친구 폴더는 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu2")), "uploads/stu1/2.jpg"), img(), jpeg)));
  it("교사도 남의 폴더는 실패", () => assertFails(uploadBytes(ref(st(asTeacher(env, "t1")), "uploads/stu1/2.jpg"), img(), jpeg)));
  it("비로그인 실패", () => assertFails(uploadBytes(ref(st(env.unauthenticatedContext()), "uploads/anon/2.jpg"), img(), jpeg)));
  it("이미지 6MB 이상 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/stu1/big.jpg"), img(6 * 1024 * 1024), jpeg)));
  it("PDF 2MB 통과", () => assertSucceeds(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/stu1/a.pdf"), img(2 * 1024 * 1024), { contentType: "application/pdf" })));
  it("텍스트 2MB 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/stu1/a.txt"), img(2 * 1024 * 1024), { contentType: "text/plain" })));
  it("영상은 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/stu1/a.mp4"), img(), { contentType: "video/mp4" })));
  it("현재: 반 폴더 모양(uploads/반/학생/파일)은 아무도 못 씀", () =>
    assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/class1/stu1/a.jpg"), img(), jpeg)));
});

describe("지우기 — 본인·교사·관리자", () => {
  it("본인", () => assertSucceeds(deleteObject(ref(st(asStudent(env, "stu1")), FILE))));
  it("같은 반 친구는 실패", () => assertFails(deleteObject(ref(st(asStudent(env, "stu2")), FILE))));
  it("교사(클레임) — 다른 반 교사여도 통과", () => assertSucceeds(deleteObject(ref(st(asTeacher(env, "t2")), FILE))));
  it("관리자", () => assertSucceeds(deleteObject(ref(st(asAdmin(env, "a1")), FILE))));
  it("users 문서 role=teacher(클레임 없음)도 통과", () => assertSucceeds(deleteObject(ref(st(asStudent(env, "docTeacher")), FILE))));
  it("비로그인 실패", () => assertFails(deleteObject(ref(st(env.unauthenticatedContext()), FILE))));
});

describe("uploads 밖은 전부 차단", () => {
  it("읽기", () => assertFails(getBytes(ref(st(asTeacher(env, "t1")), "other/x.jpg"))));
  it("쓰기", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "stu1/x.jpg"), img(), jpeg)));
});
