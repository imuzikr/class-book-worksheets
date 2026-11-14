// 개인 아지트: 교사 설정은 운영 중인 내 반에서만, 개인 방은 인증된 서버 API만 읽고 씁니다.
// 기존 학생 탈퇴 정리용 담당 교사 delete 예외는 유지합니다.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

const room = (db, uid = "s1") => doc(db, "users", uid, "reading", "hideout");
const initialRoom = { version: 2, layout: { desk: "desk-basic" }, revision: 0 };

describe("개인 아지트 설정과 비공개 방 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-hideout"); });
  after(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      const active = { createdBy: "teacherA", archived: false, readingEnabled: true, plazaEnabled: true, classroomEnabled: true };
      await setDoc(doc(db, "classes", "cOn"), { ...active, hideoutEnabled: true });
      await setDoc(doc(db, "classes", "cOff"), { ...active, hideoutEnabled: false });
      await setDoc(doc(db, "classes", "cLegacy"), active);
      await setDoc(doc(db, "classes", "cArchived"), { ...active, archived: true, hideoutEnabled: false });
      await setDoc(doc(db, "classes", "cForeign"), { ...active, createdBy: "teacherB", hideoutEnabled: false });
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", ownedClassIds: ["cOn", "cOff", "cLegacy", "cArchived"] });
      await setDoc(doc(db, "users", "teacherB"), { role: "teacher", ownedClassIds: ["cForeign"] });
      await setDoc(doc(db, "users", "s1"), { role: "student", realName: "내 방 주인", classIds: ["cOn"] });
      await setDoc(doc(db, "users", "s2"), { role: "student", realName: "같은 반 친구", classIds: ["cOn"] });
      await setDoc(doc(db, "users", "sCross"), { role: "student", classIds: ["cOn", "cForeign"] });
      await setDoc(doc(db, "users", "sStopped"), { role: "student", classIds: ["cOn"], suspended: true });
      for (const uid of ["s1", "s2", "sCross", "sStopped"]) {
        await setDoc(doc(db, "memberships", `${uid}_cOn`), { uid, classId: "cOn" });
        await setDoc(room(db, uid), initialRoom);
      }
      await setDoc(doc(db, "memberships", "sCross_cForeign"), { uid: "sCross", classId: "cForeign" });
    });
  });

  it("기존 반과 새 반에 아지트 설정이 없으면 켜진 값이 없다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    const legacy = await assertSucceeds(getDoc(doc(db, "classes", "cLegacy")));
    assert.equal(legacy.data().hideoutEnabled === true, false);
    const created = doc(db, "classes", "new-hideout-default");
    await assertSucceeds(setDoc(created, { name: "새 반", createdBy: "teacherA", readingEnabled: false }));
    assert.equal((await getDoc(created)).data().hideoutEnabled === true, false);
  });

  it("새 반의 아지트 설정은 누락 또는 참·거짓만 허용한다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    for (const hideoutEnabled of [false, true]) {
      await assertSucceeds(setDoc(doc(db, "classes", `new-hideout-${hideoutEnabled}`), {
        name: "새 반", createdBy: "teacherA", readingEnabled: false, hideoutEnabled,
      }));
    }
    for (const hideoutEnabled of ["true", 1, null, {}, []]) {
      await assertFails(setDoc(doc(db, "classes", "new-hideout-invalid"), {
        name: "새 반", createdBy: "teacherA", readingEnabled: false, hideoutEnabled,
      }));
    }
  });

  it("담당 교사와 관리자는 운영 중인 반의 아지트를 참·거짓으로 켜고 끈다", async () => {
    const teacherRef = doc(asTeacher(env, "teacherA").firestore(), "classes", "cOff");
    await assertSucceeds(updateDoc(teacherRef, { hideoutEnabled: true }));
    await assertSucceeds(updateDoc(teacherRef, { hideoutEnabled: false }));
    const adminRef = doc(asAdmin(env, "admin").firestore(), "classes", "cOff");
    await assertSucceeds(updateDoc(adminRef, { hideoutEnabled: true }));
    await assertSucceeds(updateDoc(adminRef, { hideoutEnabled: false }));
  });

  it("학생·다른 반 교사·비로그인은 아지트 설정을 바꾸지 못한다", async () => {
    for (const ctx of [asStudent(env, "s1"), asStudent(env, "sStopped"), asTeacher(env, "teacherB"), env.unauthenticatedContext()]) {
      await assertFails(updateDoc(doc(ctx.firestore(), "classes", "cOff"), { hideoutEnabled: true }));
      await assertFails(updateDoc(doc(ctx.firestore(), "classes", "cOn"), { hideoutEnabled: false }));
    }
  });

  it("아지트 설정의 문자열·숫자·null·컬렉션·필드 삭제는 거부한다", async () => {
    const ref = doc(asTeacher(env, "teacherA").firestore(), "classes", "cOn");
    for (const value of ["true", "false", 1, 0, null, {}, [], deleteField()]) {
      await assertFails(updateDoc(ref, { hideoutEnabled: value }));
    }
    assert.equal((await getDoc(ref)).data().hideoutEnabled, true);
  });

  it("보관된 반은 관리자도 설정을 바꾸지 못하고 복원과 동시에 바꾸는 우회도 막힌다", async () => {
    for (const ctx of [asTeacher(env, "teacherA"), asAdmin(env, "admin")]) {
      const ref = doc(ctx.firestore(), "classes", "cArchived");
      await assertFails(updateDoc(ref, { hideoutEnabled: true }));
      await assertFails(updateDoc(ref, { archived: false, hideoutEnabled: true }));
    }
  });

  it("여러 반 설정에 다른 선생님 반을 섞으면 전체 요청이 거부된다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, "classes", "cOff"), { hideoutEnabled: true });
    batch.update(doc(db, "classes", "cForeign"), { hideoutEnabled: true });
    await assertFails(batch.commit());
    assert.equal((await getDoc(doc(db, "classes", "cOff"))).data().hideoutEnabled, false);
  });

  it("방 주인·친구·교사·관리자 모두 브라우저에서 개인 방과 목록을 직접 읽거나 꾸며 쓸 수 없다", async () => {
    const contexts = [asStudent(env, "s1"), asStudent(env, "s2"), asTeacher(env, "teacherA"), asTeacher(env, "teacherB"), asAdmin(env, "admin"), env.unauthenticatedContext()];
    for (const ctx of contexts) {
      const db = ctx.firestore();
      await assertFails(getDoc(room(db)));
      await assertFails(getDoc(doc(db, "users", "s1", "reading", "missing-hideout")));
      await assertFails(getDocs(collection(db, "users", "s1", "reading")));
      await assertFails(setDoc(room(db), { version: 2, layout: { desk: "desk-starlight" }, revision: 100 }));
      await assertFails(updateDoc(room(db), { "layout.desk": "desk-starlight", revision: 100 }));
      await assertFails(setDoc(doc(db, "users", "s1", "reading", "forged-hideout"), initialRoom));
      await assertFails(setDoc(doc(db, "users", "s1", "reading", "hideout", "layout", "extra"), { item: "book-trophy-starlight" }));
    }
  });

  it("학생 본인·친구·다른 반 교사는 방을 직접 지우지 못한다", async () => {
    for (const ctx of [asStudent(env, "s1"), asStudent(env, "s2"), asStudent(env, "sStopped"), asTeacher(env, "teacherB"), env.unauthenticatedContext()]) {
      await assertFails(deleteDoc(room(ctx.firestore())));
    }
  });

  it("기존 탈퇴 정리의 담당 교사 삭제만 유지하고 타 교사 반도 있는 학생은 보호한다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(getDoc(room(db)));
    await assertSucceeds(deleteDoc(room(db)));
    await assertFails(deleteDoc(room(db, "sCross")));
  });
});
