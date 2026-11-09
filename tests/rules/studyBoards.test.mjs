// =============================================================
// 공부방 보드(옛 기록) — studyBoards/{bId}
//
// 책봄에는 공부방 화면이 없습니다. 한때 반을 만들 때 '선생님 보드' 한 장을
// 함께 만들었는데 그 길을 걷었습니다(lib/data/classes.js의 addClass).
// 이미 있는 문서는 반 완전 삭제 때 지우므로 읽기 · 지우기만 남깁니다.
//   ① 아무도 새로 만들거나 고치지 못한다(교사도)
//   ② 반 목록 질의(반 완전 삭제가 찾는 길)는 그대로 통과한다
//   ③ 담당 교사는 옛 보드를 지울 수 있다 · 다른 반 교사는 못 지운다
// 학생 카드(cards) 규칙은 걷었습니다 — 하위 문서는 아무도 못 씁니다.
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const board = (classId, by) => ({
  title: "선생님 보드", type: "notice", description: "수업 안내와 자료를 올려 주세요.",
  classId, createdBy: by, editMode: "open", createdAt: serverTimestamp(),
});

describe("공부방 보드(옛 기록) 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-studyboards"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "cOld"), { createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "memberships", "stu1_cA"), { uid: "stu1", classId: "cA" });
      await setDoc(doc(db, "studyBoards", "old1"), { classId: "cA", type: "notice", createdBy: "teacherA" });
    });
  });

  it("아무도 새로 만들지 못함 — 담당 교사도", async () => {
    await assertFails(setDoc(doc(asTeacher(env, "teacherA").firestore(), "studyBoards", "b1"), board("cA", "teacherA")));
    await assertFails(setDoc(doc(asStudent(env, "stu1").firestore(), "studyBoards", "b2"), board("cA", "stu1")));
    await assertFails(setDoc(doc(asTeacher(env, "teacherB").firestore(), "studyBoards", "b2"), board("cA", "teacherB")));
  });

  it("옛 보드를 고치지 못함 — 담당 교사도", async () => {
    await assertFails(updateDoc(doc(asTeacher(env, "teacherA").firestore(), "studyBoards", "old1"), { title: "새 이름" }));
  });

  it("반 목록 질의는 통과(반 완전 삭제가 찾는 길) · 담당 교사는 옛 보드를 지움", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(query(collection(t, "studyBoards"), where("classId", "==", "cA"))));
    await assertSucceeds(deleteDoc(doc(t, "studyBoards", "old1")));
  });

  it("다른 반 교사 · 학생은 옛 보드를 못 지움", async () => {
    await assertFails(deleteDoc(doc(asTeacher(env, "teacherB").firestore(), "studyBoards", "old1")));
    await assertFails(deleteDoc(doc(asStudent(env, "stu1").firestore(), "studyBoards", "old1")));
  });

  it("학생 카드는 아무도 못 씀(규칙을 걷음)", async () => {
    await assertFails(setDoc(doc(asStudent(env, "stu1").firestore(), "studyBoards", "old1", "cards", "stu1"), { authorId: "stu1", boardId: "old1" }));
  });
});
