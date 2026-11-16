// =============================================================
// 돌발 퀴즈(옛 기록) — classes/{cId}/popQuizzes/{qId} (+ submissions/{uid})
// -------------------------------------------------------------
// 돌발 퀴즈는 앱에서 걷었습니다(선생님 요청 · 2026년 11월 — 화면 · 자료 함수 · 셈).
// 옛 퀴즈 · 답은 지우지 않고 남겨 두었다가 반 완전 삭제 · 학생 탈퇴 때 지웁니다
// (lib/classPurge.js · lib/data/withdraw.js) — 그 길(담당 교사 · 관리자의 읽기 · 지우기)만
// 남기고, 만들기 · 고치기는 닫았습니다. 학생은 읽지도 못합니다(보는 화면이 없음).
// 보관된 반의 완전 삭제는 반 아래 와일드카드 규칙이 받습니다(tests/rules/classPurge.test.mjs).
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, serverTimestamp } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

const C = "cA";
const quiz = (extra = {}) => ({
  classId: C, kind: "text", title: "변수란?", desc: "", boardId: null, boardTitle: "",
  byUid: "teacherA", open: true, createdAt: serverTimestamp(), closedAt: null, ...extra,
});
const answer = (uid, extra = {}) => ({
  classId: C, quizId: "q1", uid, kind: "text", text: "<p>값을 담는 상자</p>", output: "",
  status: "submitted", submittedAt: serverTimestamp(), ...extra,
});
const qRef = (db, id = "q1", c = C) => doc(db, "classes", c, "popQuizzes", id);
const aRef = (db, uid, id = "q1", c = C) => doc(db, "classes", c, "popQuizzes", id, "submissions", uid);

describe("돌발 퀴즈(걷음) — 옛 기록 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-pop-quiz"); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", C), { createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "memberships", `stu1_${C}`), { uid: "stu1", classId: C });
      await setDoc(qRef(db), { ...quiz(), createdAt: new Date() });
      await setDoc(aRef(db, "stu1"), { ...answer("stu1"), submittedAt: new Date() });
    });
  });

  it("담당 교사도 새 퀴즈를 못 만들고, 옛 퀴즈를 못 닫거나 고침 · 답의 상태도 못 바꿈", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(setDoc(qRef(t, "q2"), quiz()));
    await assertFails(updateDoc(qRef(t), { open: false, closedAt: serverTimestamp() }));
    await assertFails(updateDoc(aRef(t, "stu1"), { status: "rewarded", reviewedAt: serverTimestamp(), reviewedBy: "teacherA" }));
    const a = asAdmin(env, "adminA").firestore();
    await assertFails(setDoc(qRef(a, "q3"), quiz({ byUid: "adminA" })));
  });

  it("학생은 옛 퀴즈 · 제 답을 못 읽고, 답을 보내거나 고치지 못함", async () => {
    const s = asStudent(env, "stu1").firestore();
    await assertFails(getDoc(qRef(s)));
    await assertFails(getDocs(collection(s, "classes", C, "popQuizzes")));
    await assertFails(getDoc(aRef(s, "stu1")));
    await assertFails(setDoc(aRef(s, "stu1", "q1"), answer("stu1")));
    await assertFails(updateDoc(aRef(s, "stu1"), { text: "<p>고침</p>" }));
    await assertFails(deleteDoc(aRef(s, "stu1")));
  });

  it("담당 교사는 옛 기록을 찾아 지움 — 학생 탈퇴와 같은 차례(퀴즈 목록 → 그 학생 자리, 없는 답도)", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    const list = await assertSucceeds(getDocs(collection(t, "classes", C, "popQuizzes")));
    for (const q of list.docs) {
      await assertSucceeds(deleteDoc(doc(q.ref, "submissions", "stu1")));
      await assertSucceeds(deleteDoc(doc(q.ref, "submissions", "stu9"))); // 보내지 않은 학생의 자리 — 없는 문서
    }
    await assertSucceeds(getDocs(collection(t, "classes", C, "popQuizzes", "q1", "submissions")));
    await assertSucceeds(deleteDoc(qRef(t)));
    const a = asAdmin(env, "adminA").firestore();
    await assertSucceeds(getDocs(collection(a, "classes", C, "popQuizzes")));
  });

  it("다른 반 교사는 못 읽고 못 지움", async () => {
    const other = asTeacher(env, "teacherB").firestore();
    await assertFails(getDocs(collection(other, "classes", C, "popQuizzes")));
    await assertFails(getDoc(aRef(other, "stu1")));
    await assertFails(deleteDoc(aRef(other, "stu1")));
    await assertFails(deleteDoc(qRef(other)));
  });
});
