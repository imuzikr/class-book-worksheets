// =============================================================
// 이름 맞추기 — 교사가 학생 프로필을 고친 뒤 내 반 기록의 이름표를 새 값으로
// (lib/data/nameSync.js · 규칙의 isNameSync)
//   ① 운영 중인 내 반 — 이름표 칸을 그 학생의 지금 프로필 값으로 바꾼다
//   ② 프로필과 다른 이름 · 이름표가 아닌 칸 · 남의 이름표는 거부
//   ③ 보관된 반 · 다른 반 교사 · 학생은 거부
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

describe("이름 맞추기 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-namesync"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { name: "A", createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "cOld"), { name: "Old", createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "users", "s1"), { role: "student", realName: "새이름", studentId: "30199", classIds: ["cA"] });
      for (const c of ["cA", "cOld"]) {
        await setDoc(doc(db, "bookActivities", `a_${c}`), { classId: c, type: "raft" });
        await setDoc(doc(db, "bookActivities", `a_${c}`, "entries", "s1"), { authorId: "s1", authorName: "옛이름", answers: {} });
        await setDoc(doc(db, "bookActivities", `a_${c}`, "peerReviews", "r1"), { fromUid: "s2", fromName: "친구", toUid: "s1", toName: "옛이름", html: "" });
        await setDoc(doc(db, "classes", c, "questionSignals", "s1"), { uid: "s1", name: "옛이름", studentId: "30101", classId: c });
      }
    });
  });

  it("운영 중인 내 반 — 프로필의 새 이름 · 학번으로 바꾼다", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(t, "bookActivities", "a_cA", "entries", "s1"), { authorName: "새이름" }));
    await assertSucceeds(updateDoc(doc(t, "bookActivities", "a_cA", "peerReviews", "r1"), { toName: "새이름" }));
    await assertSucceeds(updateDoc(doc(t, "classes", "cA", "questionSignals", "s1"), { name: "새이름", studentId: "30199" }));
  });

  it("프로필과 다른 이름 · 이름표가 아닌 칸 · 남의 이름표는 거부", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(updateDoc(doc(t, "bookActivities", "a_cA", "entries", "s1"), { authorName: "아무이름" }));
    await assertFails(updateDoc(doc(t, "bookActivities", "a_cA", "entries", "s1"), { authorName: "새이름", answers: { x: 1 } }));
    await assertFails(updateDoc(doc(t, "bookActivities", "a_cA", "peerReviews", "r1"), { fromName: "새이름" }));
    await assertFails(updateDoc(doc(t, "classes", "cA", "questionSignals", "s1"), { studentId: "99999" }));
  });

  it("보관된 반 · 다른 반 교사 · 학생은 거부", async () => {
    await assertFails(updateDoc(doc(asTeacher(env, "teacherA").firestore(), "bookActivities", "a_cOld", "entries", "s1"), { authorName: "새이름" }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "bookActivities", "a_cA", "entries", "s1"), { authorName: "새이름" }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "bookActivities", "a_cA", "peerReviews", "r1"), { toName: "새이름" }));
  });
});
