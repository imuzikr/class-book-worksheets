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

// =============================================================
// 반 폴더 uploads/{classId}/{uid}/{file} — 이미지 보안 2단계
//   c1: 담당 t1, 학생 stu1·stu2 / c2: 담당 t2, 학생 other / arch: 보관된 반(담당 t1, 학생 stu1)
// =============================================================
describe("반 폴더 uploads/{classId}/{uid}/{file}", () => {
  const CF = "uploads/c1/stu1/1_photo.jpg";
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "classes", "c1"), { createdBy: "t1", name: "1반" });
      await setDoc(doc(db, "classes", "c2"), { createdBy: "t2", name: "2반" });
      await setDoc(doc(db, "classes", "arch"), { createdBy: "t1", name: "옛 반", archived: true });
      for (const [u, c] of [["stu1", "c1"], ["stu2", "c1"], ["other", "c2"], ["stu1", "arch"]]) {
        await setDoc(doc(db, "memberships", `${u}_${c}`), { uid: u, classId: c });
      }
      await setDoc(doc(db, "users", "docAdmin"), { role: "admin" });
      await uploadBytes(ref(ctx.storage(), CF), img(), jpeg);
      await uploadBytes(ref(ctx.storage(), "uploads/arch/stu1/old.jpg"), img(), jpeg);
    });
  });

  describe("읽기(get)", () => {
    it("본인", () => assertSucceeds(getBytes(ref(st(asStudent(env, "stu1")), CF))));
    it("같은 반 학생", () => assertSucceeds(getBytes(ref(st(asStudent(env, "stu2")), CF))));
    it("같은 반 학생 메타데이터", () => assertSucceeds(getMetadata(ref(st(asStudent(env, "stu2")), CF))));
    it("다른 반 학생은 실패", () => assertFails(getBytes(ref(st(asStudent(env, "other")), CF))));
    it("어느 반에도 없는 학생은 실패", () => assertFails(getBytes(ref(st(asStudent(env, "nobody")), CF))));
    it("담당 교사", () => assertSucceeds(getBytes(ref(st(asTeacher(env, "t1")), CF))));
    it("다른 반 교사는 실패", () => assertFails(getBytes(ref(st(asTeacher(env, "t2")), CF))));
    it("관리자(클레임)", () => assertSucceeds(getBytes(ref(st(asAdmin(env, "a1")), CF))));
    it("관리자(users 문서 role)", () => assertSucceeds(getBytes(ref(st(asStudent(env, "docAdmin")), CF))));
    it("교사 클레임 없이 createdBy만 같은 학생 계정은 실패", async () => {
      await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "classes", "c3"), { createdBy: "stuX" }));
      await env.withSecurityRulesDisabled((ctx) => uploadBytes(ref(ctx.storage(), "uploads/c3/stuY/a.jpg"), img(), jpeg));
      await assertFails(getBytes(ref(st(asStudent(env, "stuX")), "uploads/c3/stuY/a.jpg")));
    });
    it("비로그인은 실패", () => assertFails(getBytes(ref(st(env.unauthenticatedContext()), CF))));
    it("보관된 반: 소속 학생도 실패", () => assertFails(getBytes(ref(st(asStudent(env, "stu1")), "uploads/arch/stu1/old.jpg"))));
    it("보관된 반: 담당 교사는 읽기 가능", () => assertSucceeds(getBytes(ref(st(asTeacher(env, "t1")), "uploads/arch/stu1/old.jpg"))));
    it("없는 반은 실패", () => assertFails(getBytes(ref(st(asStudent(env, "stu1")), "uploads/zzz/stu1/a.jpg"))));
  });

  describe("목록(list) — 막힘", () => {
    it("같은 반 학생도 학생 폴더 목록 실패", () => assertFails(listAll(ref(st(asStudent(env, "stu2")), "uploads/c1/stu1"))));
    it("담당 교사도 실패", () => assertFails(listAll(ref(st(asTeacher(env, "t1")), "uploads/c1/stu1"))));
    it("관리자도 실패", () => assertFails(listAll(ref(st(asAdmin(env, "a1")), "uploads/c1/stu1"))));
    // 주의: uploads/{classId} 한 단계 목록은 옛 규칙 uploads/{userId}/{fileName}의
    // read(로그인한 누구나)에 걸립니다 — 학생 uid 하위 폴더 이름이 보입니다. 7단계에서 옛 규칙과 함께 닫습니다.
    it("현재: uploads/c1 목록은 옛 규칙 때문에 다른 반 학생도 통과", () =>
      assertSucceeds(listAll(ref(st(asStudent(env, "other")), "uploads/c1"))));
  });

  describe("쓰기(create)", () => {
    const P = "uploads/c1/stu1/2.jpg";
    it("본인·소속 반·이미지", () => assertSucceeds(uploadBytes(ref(st(asStudent(env, "stu1")), P), img(), jpeg)));
    it("png·webp도 통과", () => assertSucceeds(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/c1/stu1/3.webp"), img(), { contentType: "image/webp" })));
    it("남의 uid 폴더는 실패(같은 반이어도)", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu2")), P), img(), jpeg)));
    it("소속 아닌 반에 본인 폴더도 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "other")), "uploads/c1/other/a.jpg"), img(), jpeg)));
    it("보관된 반은 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/arch/stu1/new.jpg"), img(), jpeg)));
    it("이미지가 아니면 실패(PDF)", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/c1/stu1/a.pdf"), img(), { contentType: "application/pdf" })));
    it("이미지가 아니면 실패(텍스트)", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/c1/stu1/a.txt"), img(), { contentType: "text/plain" })));
    it("6MB 이상 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), "uploads/c1/stu1/big.jpg"), img(6 * 1024 * 1024), jpeg)));
    it("덮어쓰기 실패", () => assertFails(uploadBytes(ref(st(asStudent(env, "stu1")), CF), img(), jpeg)));
    it("담당 교사도 학생 폴더엔 실패", () => assertFails(uploadBytes(ref(st(asTeacher(env, "t1")), P), img(), jpeg)));
    it("비로그인 실패", () => assertFails(uploadBytes(ref(st(env.unauthenticatedContext()), "uploads/c1/anon/a.jpg"), img(), jpeg)));
  });

  describe("지우기", () => {
    it("본인", () => assertSucceeds(deleteObject(ref(st(asStudent(env, "stu1")), CF))));
    it("같은 반 친구는 실패", () => assertFails(deleteObject(ref(st(asStudent(env, "stu2")), CF))));
    it("담당 교사", () => assertSucceeds(deleteObject(ref(st(asTeacher(env, "t1")), CF))));
    it("다른 반 교사는 실패", () => assertFails(deleteObject(ref(st(asTeacher(env, "t2")), CF))));
    it("관리자", () => assertSucceeds(deleteObject(ref(st(asAdmin(env, "a1")), CF))));
    it("비로그인 실패", () => assertFails(deleteObject(ref(st(env.unauthenticatedContext()), CF))));
  });
});
