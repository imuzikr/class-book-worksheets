// =============================================================
// 반 문서 읽기 — classes/{classId}
//
// 한때 로그인한 사람이면 누구나 모든 반을 목록으로 받았습니다(subscribeClasses가 통째로
// 구독). 이 앱을 쓰는 선생님 · 반이 늘수록 화면마다 읽기가 늘고, 남의 반 이름 · 설정까지
// 실려 왔습니다. 지금은 목록(list)을 좁힙니다 — 관리자는 전체, 교사는 내가 만든 반만.
// 문서 id로 한 건 읽기(get)는 그대로 열려 있습니다(참여 코드로 들어갈 때 · 탈퇴 전
// 다른 선생님 반 확인).
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

describe("반 문서 읽기", () => {
  let env;

  before(async () => {
    env = await makeEnv("demo-rules-classes-read");
  });
  after(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "classA"), { name: "1반", createdBy: "teacherA" });
      await setDoc(doc(db, "classes", "classA2"), { name: "2반", createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "classes", "classB"), { name: "3반", createdBy: "teacherB" });
      await setDoc(doc(db, "memberships", "stu1_classA"), { uid: "stu1", classId: "classA" });
      await setDoc(doc(db, "users", "stu1"), { uid: "stu1", role: "student", classIds: ["classA"] });
    });
  });

  it("교사는 내가 만든 반만 목록으로 받는다(보관된 반 포함)", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    const snap = await assertSucceeds(getDocs(query(collection(db, "classes"), where("createdBy", "==", "teacherA"))));
    if (snap.size !== 2) throw new Error(`내 반 둘이어야 함: ${snap.size}`);
  });

  it("교사는 모든 반 · 남의 반을 목록으로 받지 못한다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(getDocs(collection(db, "classes")));
    await assertFails(getDocs(query(collection(db, "classes"), where("createdBy", "==", "teacherB"))));
  });

  it("학생은 반 목록을 받지 못하고, 제 반은 문서 id로 읽는다", async () => {
    const db = asStudent(env, "stu1").firestore();
    await assertFails(getDocs(collection(db, "classes")));
    await assertFails(getDocs(query(collection(db, "classes"), where("createdBy", "==", "teacherA"))));
    await assertSucceeds(getDoc(doc(db, "classes", "classA")));
  });

  it("문서 id로 한 건 읽기는 로그인한 사람에게 열려 있다(참여 코드 · 탈퇴 확인)", async () => {
    await assertSucceeds(getDoc(doc(asStudent(env, "stranger").firestore(), "classes", "classB")));
    await assertSucceeds(getDoc(doc(asTeacher(env, "teacherA").firestore(), "classes", "classB")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "classes", "classA")));
  });

  it("관리자는 모든 반을 목록으로 받는다", async () => {
    const db = asAdmin(env, "root").firestore();
    const snap = await assertSucceeds(getDocs(collection(db, "classes")));
    if (snap.size !== 3) throw new Error(`반 셋이어야 함: ${snap.size}`);
  });
});
