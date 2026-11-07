// =============================================================
// 반 완전 삭제 — 보관된 반의 담당 교사만 그 반의 기록을 지운다
// (lib/data/classes.js의 purgeClass · 규칙의 canPurgeClass)
//   ① 보관된 반의 담당 교사 — 반 아래 · 독서 활동 아래 · 반 바깥 기록을
//      읽고 지우고, 마지막에 반 문서까지 지운다
//   ② 운영 중인 반은 같은 교사도 이 길로 못 지운다(보관이 먼저)
//   ③ 다른 반 교사 · 그 반 학생은 못 지운다
//   ④ 보관된 반이라도 쓰기 · 고치기는 여전히 막힌다
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

describe("반 완전 삭제 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-class-purge"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      for (const [id, archived] of [["cOld", true], ["cLive", false]]) {
        await setDoc(doc(db, "classes", id), { name: id, createdBy: "teacherA", archived });
        await setDoc(doc(db, "classes", id, "attendanceRecords", "d_stu1"), { uid: "stu1", classId: id, date: "d" });
        await setDoc(doc(db, "classes", id, "rewardEvents", "e1"), { uid: "stu1", classId: id, delta: 1, count: 1 });
        await setDoc(doc(db, "classes", id, "chatReads", "stu1"), { rooms: {} });
        await setDoc(doc(db, "classes", id, "readingMembers", "stu1"), { xp: 3 });
        await setDoc(doc(db, "classes", id, "popQuizzes", "q1"), { classId: id });
        await setDoc(doc(db, "classes", id, "popQuizzes", "q1", "submissions", "stu1"), { uid: "stu1" });
        await setDoc(doc(db, "bookActivities", `a_${id}`), { classId: id, type: "raft" });
        await setDoc(doc(db, "bookActivities", `a_${id}`, "entries", "stu1"), { uid: "stu1" });
        await setDoc(doc(db, "bookActivities", `a_${id}`, "entries", "stu1", "raftFeedback", "f1"), { studentUid: "stu1" });
        await setDoc(doc(db, "bookActivities", `a_${id}`, "groups", "g1", "words", "w1"), { authorId: "stu1" });
        await setDoc(doc(db, "memberships", `stu1_${id}`), { uid: "stu1", classId: id });
        await setDoc(doc(db, "rewards", `${id}_stu1`), { uid: "stu1", classId: id, count: 2 });
        await setDoc(doc(db, "presence", `stu1_${id}`), { uid: "stu1", classId: id, visible: true });
        await setDoc(doc(db, "studentNotes", `n_${id}`), { classId: id, teacherId: "teacherA", studentUid: "stu1" });
        await setDoc(doc(db, "studyBoards", `b_${id}`), { classId: id, type: "notice" });
        await setDoc(doc(db, "kwl", `k_${id}`), { classId: id, userId: "stu1", date: "d" });
        await setDoc(doc(db, "broadcasts", id), { mode: "entry" });
      }
    });
  });

  it("보관된 반의 담당 교사 — 반 아래 기록을 읽고 지움", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    for (const name of ["attendanceRecords", "rewardEvents", "chatReads", "readingMembers", "popQuizzes"]) {
      const snap = await assertSucceeds(getDocs(collection(t, "classes", "cOld", name)));
      if (name === "popQuizzes") {
        await assertSucceeds(getDocs(collection(t, "classes", "cOld", "popQuizzes", "q1", "submissions")));
        await assertSucceeds(deleteDoc(doc(t, "classes", "cOld", "popQuizzes", "q1", "submissions", "stu1")));
      }
      for (const d of snap.docs) await assertSucceeds(deleteDoc(d.ref));
    }
  });

  it("보관된 반의 담당 교사 — 독서 활동 아래까지 지움", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(query(collection(t, "bookActivities"), where("classId", "==", "cOld"))));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "a_cOld", "entries", "stu1", "raftFeedback", "f1")));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "a_cOld", "entries", "stu1")));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "a_cOld", "groups", "g1", "words", "w1")));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "a_cOld")));
  });

  it("보관된 반의 담당 교사 — 반 바깥 기록을 질의로 찾아 지우고, 마지막에 반 문서", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    for (const name of ["memberships", "rewards", "presence", "studentNotes", "studyBoards", "kwl"]) {
      const snap = await assertSucceeds(getDocs(query(collection(t, name), where("classId", "==", "cOld"))));
      for (const d of snap.docs) await assertSucceeds(deleteDoc(d.ref));
    }
    await assertSucceeds(deleteDoc(doc(t, "broadcasts", "cOld")));
    await assertSucceeds(deleteDoc(doc(t, "classes", "cOld")));
  });

  it("운영 중인 반은 같은 교사도 이 길로 못 지움", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(deleteDoc(doc(t, "classes", "cLive", "rewardEvents", "e1")));
    await assertFails(deleteDoc(doc(t, "classes", "cLive", "chatReads", "stu1")));
    await assertFails(deleteDoc(doc(t, "classes", "cLive")));
  });

  it("다른 반 교사 · 그 반 학생은 못 지움", async () => {
    const other = asTeacher(env, "teacherB").firestore();
    const stu = asStudent(env, "stu1").firestore();
    for (const db of [other, stu]) {
      await assertFails(deleteDoc(doc(db, "classes", "cOld", "rewardEvents", "e1")));
      await assertFails(deleteDoc(doc(db, "bookActivities", "a_cOld", "entries", "stu1")));
      await assertFails(deleteDoc(doc(db, "rewards", "cOld_stu1")));
      await assertFails(deleteDoc(doc(db, "classes", "cOld")));
    }
  });

  it("보관된 반이라도 쓰기 · 고치기는 여전히 막힘", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(setDoc(doc(t, "classes", "cOld", "rewardEvents", "e2"), { uid: "stu1", classId: "cOld" }));
    await assertFails(updateDoc(doc(t, "bookActivities", "a_cOld", "entries", "stu1"), { uid: "x" }));
    await assertFails(updateDoc(doc(t, "rewards", "cOld_stu1"), { count: 5 }));
  });
});
