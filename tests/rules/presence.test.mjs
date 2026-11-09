// =============================================================
// 참여 상태(옛 기록) — presence/{uid}_{classId}
// -------------------------------------------------------------
// 한때 수업 화면을 띄우는 동안 학생 기기가 20초마다 '화면이 보이는지'를
// 적었는데(옛 공부방 전광판용), 그것을 읽는 화면이 없어 앱이 더는 쓰지
// 않습니다. 그래서 만들기 · 고치기를 닫았습니다.
// 이미 남은 기록은 반 완전 삭제 · 학생 탈퇴 때 지웁니다(lib/classPurge.js ·
// lib/data/withdraw.js) — 그 길(읽기 · 지우기)은 그대로입니다.
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, deleteDoc, getDocs, collection, query, where } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

describe("참여 상태(옛 기록) 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-presence"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "memberships", "stu1_cA"), { uid: "stu1", classId: "cA" });
      await setDoc(doc(db, "presence", "stu2_cA"), { uid: "stu2", classId: "cA", visible: true });
    });
  });

  it("학생은 제 참여 상태를 더는 못 씀", async () => {
    const db = asStudent(env, "stu1").firestore();
    await assertFails(setDoc(doc(db, "presence", "stu1_cA"), { uid: "stu1", classId: "cA", visible: true }));
  });

  it("담당 교사는 옛 기록을 찾아 지움(반 삭제 · 탈퇴 정리)", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(query(collection(db, "presence"), where("classId", "==", "cA"))));
    await assertSucceeds(deleteDoc(doc(db, "presence", "stu2_cA")));
  });

  it("다른 반 교사는 못 읽고 못 지움", async () => {
    const db = asTeacher(env, "teacherB").firestore();
    await assertFails(getDocs(query(collection(db, "presence"), where("classId", "==", "cA"))));
    await assertFails(deleteDoc(doc(db, "presence", "stu2_cA")));
  });
});
