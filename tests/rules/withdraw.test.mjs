// =============================================================
// 학생 탈퇴 — 선생님이 학생 프로필(users/{uid})과 개인 서재를 지운다
// (lib/data/withdraw.js · 규칙의 teacherMayWithdraw)
//   ① 학생의 classIds가 모두 내 반(또는 이미 없는 반)이면 지운다
//   ② 다른 선생님 반에도 있으면 · classIds가 비었으면 · 학생이 아니면 거부
//   ③ 학생 본인 · 다른 반 교사는 못 지운다
//   ④ 개인 서재(reading/main)는 지우기만 — 읽기는 여전히 막힘
//   ⑤ 탈퇴 표시(withdrawingBy)를 한 교사는 운영 중인 내 반에서 그 학생의 기록만 지운다
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

describe("학생 탈퇴 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-withdraw"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { name: "A", createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "cA2"), { name: "A2", createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "classes", "cB"), { name: "B", createdBy: "teacherB", archived: false });
      // 교사는 내가 만든 반 목록(ownedClassIds)으로 '내 반 학생'을 알아봅니다(users 규칙).
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", ownedClassIds: ["cA", "cA2"] });
      await setDoc(doc(db, "users", "teacherB"), { role: "teacher", ownedClassIds: ["cB"] });
      // 내 반에만 (지운 반 cGone도 적혀 있음)
      await setDoc(doc(db, "users", "s1"), { role: "student", classIds: ["cA", "cA2", "cGone"] });
      await setDoc(doc(db, "users", "s1", "reading", "main"), { books: [] });
      // 다른 선생님 반에도
      await setDoc(doc(db, "users", "s2"), { role: "student", classIds: ["cA", "cB"] });
      // 반 없음 · 선생님
      await setDoc(doc(db, "users", "s3"), { role: "student", classIds: [] });
      await setDoc(doc(db, "users", "t9"), { role: "teacher", classIds: ["cA"] });
      await setDoc(doc(db, "users", "s4"), { role: "student", classIds: ["cA"] });
      for (const who of ["s1", "s4"]) {
        await setDoc(doc(db, "classes", "cA", "rewardEvents", `e_${who}`), { uid: who, classId: "cA", delta: 1, count: 1 });
        await setDoc(doc(db, "classes", "cA", "chatReads", who), { rooms: {} });
        await setDoc(doc(db, "bookActivities", "aA", "entries", who), { authorId: who });
        await setDoc(doc(db, "bookActivities", "aA", "peerReviews", `x_${who}`), { fromUid: "s4", toUid: who });
      }
      await setDoc(doc(db, "bookActivities", "aA"), { classId: "cA", type: "raft" });
      await setDoc(doc(db, "bookActivities", "aA", "groups", "solo_s1"), { memberUids: ["s1"], members: [{ uid: "s1", name: "가" }] });
      await setDoc(doc(db, "classes", "cB", "rewardEvents", "e_s1"), { uid: "s1", classId: "cB", delta: 1, count: 1 });
    });
  });

  it("내 반에만 있는 학생 — 개인 서재와 프로필을 지움", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(getDoc(doc(t, "users", "s1", "reading", "main")));
    await assertSucceeds(deleteDoc(doc(t, "users", "s1", "reading", "main")));
    await assertSucceeds(deleteDoc(doc(t, "users", "s1")));
  });

  it("다른 선생님 반에도 있으면 · 반이 없으면 · 선생님이면 거부", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(deleteDoc(doc(t, "users", "s2")));
    await assertFails(deleteDoc(doc(t, "users", "s3")));
    await assertFails(deleteDoc(doc(t, "users", "t9")));
  });

  it("학생 본인 · 다른 반 교사는 못 지움", async () => {
    await assertFails(deleteDoc(doc(asStudent(env, "s1").firestore(), "users", "s1")));
    await assertFails(deleteDoc(doc(asTeacher(env, "teacherB").firestore(), "users", "s1")));
    await assertFails(deleteDoc(doc(asTeacher(env, "teacherB").firestore(), "users", "s1", "reading", "main")));
  });

  it("탈퇴 표시 — 담당 교사만 제 uid로 적을 수 있음", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(t, "users", "s1"), { withdrawingBy: "teacherA" }));
    await assertFails(updateDoc(doc(t, "users", "s1"), { withdrawingBy: "teacherB" }));
    await assertFails(updateDoc(doc(asStudent(env, "s4").firestore(), "users", "s4"), { withdrawingBy: "s4" }));
    // 그 학생을 가르치지 않는 교사는 표시를 못 적음
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "users", "s1"), { withdrawingBy: "teacherB" }));
  });

  it("탈퇴 표시한 학생의 기록만 — 내 운영 중인 반에서 지움", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(deleteDoc(doc(t, "classes", "cA", "rewardEvents", "e_s1")));
    await updateDoc(doc(t, "users", "s1"), { withdrawingBy: "teacherA" });
    await assertSucceeds(deleteDoc(doc(t, "classes", "cA", "rewardEvents", "e_s1")));
    await assertSucceeds(deleteDoc(doc(t, "classes", "cA", "chatReads", "s1")));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "aA", "entries", "s1")));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "aA", "peerReviews", "x_s1")));
    await assertSucceeds(deleteDoc(doc(t, "bookActivities", "aA", "groups", "solo_s1")));
    // 다른 학생의 기록 · 다른 선생님 반은 그대로 막힘
    await assertFails(deleteDoc(doc(t, "classes", "cA", "rewardEvents", "e_s4")));
    await assertFails(deleteDoc(doc(t, "classes", "cA", "chatReads", "s4")));
    await assertFails(deleteDoc(doc(t, "classes", "cB", "rewardEvents", "e_s1")));
    // 다른 교사는 표시를 봐도 못 지움
    await assertFails(deleteDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "cA", "rewardEvents", "e_s1")));
  });
});
