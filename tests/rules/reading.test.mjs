// 책나눔: 기본 비활성, 교사 설정 권한, 서버 전용 보상·랭킹 자료.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

describe("책나눔 활성화와 서버 전용 보상 자료", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-reading"); });
  after(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "legacy"), { name: "기존 반", createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "active"), { name: "활성 반", createdBy: "teacherA", archived: false, readingEnabled: true });
      await setDoc(doc(db, "classes", "archived"), { name: "보관 반", createdBy: "teacherA", archived: true, readingEnabled: false });
      await setDoc(doc(db, "users", "studentA"), { role: "student", realName: "김학생", studentId: "10101" });
      await setDoc(doc(db, "memberships", "studentA_active"), { uid: "studentA", classId: "active" });
      await setDoc(doc(db, "users", "studentA", "reading", "main"), { version: 1, books: [], logs: [], reviews: [] });
      await setDoc(doc(db, "users", "studentA", "readingRequests", "request1"), { action: "addLog" });
      await setDoc(doc(db, "classes", "active", "readingMembers", "studentA"), { xp: 200, level: 2 });
    });
  });

  it("기존 반에 설정이 없으면 켜짐으로 간주하지 않으며 새 반은 꺼짐으로 생성", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    const legacy = await assertSucceeds(getDoc(doc(db, "classes", "legacy")));
    assert.equal(legacy.data().readingEnabled === true, false);
    await assertSucceeds(setDoc(doc(db, "classes", "new1"), { name: "새 반", createdBy: "teacherA", readingEnabled: false }));
    await assertSucceeds(setDoc(doc(db, "classes", "new2"), { name: "옛 생성 경로", createdBy: "teacherA" }));
    await assertFails(setDoc(doc(db, "classes", "enabledAtCreate"), { name: "켜진 새 반", createdBy: "teacherA", readingEnabled: true }));
    await assertFails(setDoc(doc(db, "classes", "badType"), { name: "타입 오류", createdBy: "teacherA", readingEnabled: "false" }));
  });

  it("담당 교사는 기존 반에서 켜고 끌 수 있다", async () => {
    const ref = doc(asTeacher(env, "teacherA").firestore(), "classes", "legacy");
    await assertSucceeds(updateDoc(ref, { readingEnabled: true }));
    await assertSucceeds(updateDoc(ref, { readingEnabled: false }));
  });

  it("학생과 다른 반 교사는 설정을 바꿀 수 없다", async () => {
    for (const ctx of [asStudent(env, "studentA"), asTeacher(env, "teacherB"), env.unauthenticatedContext()]) {
      await assertFails(updateDoc(doc(ctx.firestore(), "classes", "legacy"), { readingEnabled: true }));
      await assertFails(updateDoc(doc(ctx.firestore(), "classes", "active"), { readingEnabled: false }));
    }
  });

  it("관리자는 운영 중인 반의 설정을 바꿀 수 있다", async () => {
    const ref = doc(asAdmin(env, "admin").firestore(), "classes", "legacy");
    await assertSucceeds(updateDoc(ref, { readingEnabled: true }));
    await assertSucceeds(updateDoc(ref, { readingEnabled: false }));
  });

  it("문자열·null·삭제로 설정을 위조할 수 없다", async () => {
    const ref = doc(asTeacher(env, "teacherA").firestore(), "classes", "active");
    for (const value of ["true", 1, null, deleteField()]) {
      await assertFails(updateDoc(ref, { readingEnabled: value }));
    }
  });

  it("보관된 반에서는 교사·관리자 모두 사용 설정을 바꿀 수 없다", async () => {
    for (const ctx of [asTeacher(env, "teacherA"), asAdmin(env, "admin")]) {
      await assertFails(updateDoc(doc(ctx.firestore(), "classes", "archived"), { readingEnabled: true }));
    }
    // 기존 반 보관·복원 길은 유지합니다.
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(db, "classes", "archived"), { archived: false }));
    await assertSucceeds(updateDoc(doc(db, "classes", "archived"), { readingEnabled: true }));
    await assertSucceeds(updateDoc(doc(db, "classes", "archived"), { archived: true }));
  });

  it("새 설정과 무관한 기존 반 이름·출석 수정은 유지", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(db, "classes", "legacy"), { name: "새 이름", attendanceOpen: true }));
    await assertSucceeds(updateDoc(doc(db, "classes", "active"), { attendanceOpen: false }));
  });

  it("학생은 자기 프로필에 임의의 경험치·레벨·뱃지를 덧쓸 수 없다", async () => {
    const ref = doc(asStudent(env, "studentA").firestore(), "users", "studentA");
    for (const patch of [{ xp: 999999 }, { exp: 999999 }, { level: 99 }, { badges: ["all"] }]) {
      await assertFails(updateDoc(ref, patch));
    }
  });

  it("활성 반이라도 브라우저는 개인 독서 자료·요청 영수증·랭킹을 직접 읽거나 쓸 수 없다", async () => {
    const paths = [
      ["users", "studentA", "reading", "main"],
      ["users", "studentA", "readingRequests", "request1"],
      ["classes", "active", "readingMembers", "studentA"],
    ];
    for (const ctx of [asStudent(env, "studentA"), asStudent(env, "studentB"), asTeacher(env, "teacherA"), asAdmin(env, "admin"), env.unauthenticatedContext()]) {
      const db = ctx.firestore();
      for (const path of paths) {
        const ref = doc(db, ...path);
        await assertFails(getDoc(ref));
        await assertFails(getDocs(collection(db, ...path.slice(0, -1))));
        await assertFails(updateDoc(ref, { xp: 999999 }));
        await assertFails(setDoc(ref, { xp: 999999 }));
        await assertFails(deleteDoc(ref));
        await assertFails(setDoc(doc(db, ...path.slice(0, -1), "forged"), { xp: 999999 }));
      }
    }
  });
});
