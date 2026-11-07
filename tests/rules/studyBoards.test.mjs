// =============================================================
// 선생님 보드 — studyBoards/{bId}
//
// 책봄에는 공부방 화면이 없지만, 반을 만들 때 '선생님 보드' 한 장을 함께
// 만듭니다(lib/data/classes.js의 addClass → ensureDefaultStudyBoard).
// 그 길이 막히면 반 만들기가 중간에 실패하므로 못 박아 둡니다.
//   ① 반을 만든 교사는 그 반의 보드를 만들고, 반 목록 질의도 통과한다
//   ② 학생 · 다른 반 교사 · 보관된 반에서는 못 만든다
// 학생 카드(cards) 규칙은 걷었습니다 — 하위 문서는 아무도 못 씁니다.
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDocs, setDoc, collection, query, where, limit, serverTimestamp } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const board = (classId, by) => ({
  title: "선생님 보드", type: "notice", description: "수업 안내와 자료를 올려 주세요.",
  classId, createdBy: by, editMode: "open", createdAt: serverTimestamp(),
});

describe("선생님 보드 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-studyboards"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "cOld"), { createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "memberships", "stu1_cA"), { uid: "stu1", classId: "cA" });
    });
  });

  it("반을 만든 교사 — 보드를 만들고, 반 목록 질의도 통과", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(query(collection(t, "studyBoards"),
      where("classId", "==", "cA"), where("type", "==", "notice"), limit(1))));
    await assertSucceeds(setDoc(doc(t, "studyBoards", "b1"), board("cA", "teacherA")));
  });

  it("학생 · 다른 반 교사 · 보관된 반은 못 만듦", async () => {
    await assertFails(setDoc(doc(asStudent(env, "stu1").firestore(), "studyBoards", "b2"), board("cA", "stu1")));
    await assertFails(setDoc(doc(asTeacher(env, "teacherB").firestore(), "studyBoards", "b2"), board("cA", "teacherB")));
    await assertFails(setDoc(doc(asTeacher(env, "teacherA").firestore(), "studyBoards", "b2"), board("cOld", "teacherA")));
  });

  it("학생 카드는 아무도 못 씀(규칙을 걷음)", async () => {
    await seed(env, (db) => setDoc(doc(db, "studyBoards", "b1"), board("cA", "teacherA")));
    await assertFails(setDoc(doc(asStudent(env, "stu1").firestore(), "studyBoards", "b1", "cards", "stu1"), { authorId: "stu1", boardId: "b1" }));
  });
});
