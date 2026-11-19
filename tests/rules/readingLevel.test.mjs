// =============================================================
// 독서 레벨(users/{uid}.readingLevel) — 레벨 옷(Lv.7 탐험가 옷 · Lv.10 마스터 옷)을 고르는 값은 서버만 적는다
// -------------------------------------------------------------
//  · 학생이 가입해 프로필을 만들 때 readingLevel을 끼워 넣지 못함(입지 않은 옷을 스스로 입는 길)
//  · 학생 · 담당 교사가 프로필의 readingLevel을 고치거나 지우지 못함(update의 칸 목록에 없음)
//  · 반 친구 · 담당 교사는 그대로 읽음(순위 · 리더보드에 이미 보이는 레벨 — 친구 화면이 그 옷을 그림)
// 적는 쪽은 lib/server/readingService.js(levelMirror · backfillReadingLevel — Admin SDK라 규칙을 거치지 않음).
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const signupProfile = (extra = {}) => ({
  email: "s1@example.com", realName: "김학생", displayName: "김학생", role: "student",
  requestedRole: null, studentId: null, createdAt: new Date(), ...extra,
});

describe("독서 레벨 — 프로필의 readingLevel은 서버만", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-reading-level"); });
  after(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "c1"), { name: "1반", createdBy: "teacherA", archived: false, readingEnabled: true });
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", realName: "선생님", ownedClassIds: ["c1"] });
      await setDoc(doc(db, "users", "s2"), { role: "student", realName: "이학생", studentId: "10102", classIds: ["c1"], readingLevel: 6 });
      await setDoc(doc(db, "users", "s3"), { role: "student", realName: "박학생", studentId: "10103", classIds: ["c1"] });
      await setDoc(doc(db, "memberships", "s2_c1"), { uid: "s2", classId: "c1" });
      await setDoc(doc(db, "memberships", "s3_c1"), { uid: "s3", classId: "c1" });
    });
  });

  it("가입할 때 레벨을 끼워 넣을 수 없다(레벨이 없으면 그대로 가입됨)", async () => {
    const db = asStudent(env, "s1").firestore();
    await assertFails(setDoc(doc(db, "users", "s1"), signupProfile({ readingLevel: 10 })));
    await assertFails(setDoc(doc(db, "users", "s1"), signupProfile({ readingLevel: null })));
    await assertSucceeds(setDoc(doc(db, "users", "s1"), signupProfile()));
  });

  it("학생은 제 레벨을 고치거나 지울 수 없다", async () => {
    const ref = doc(asStudent(env, "s2").firestore(), "users", "s2");
    await assertFails(updateDoc(ref, { readingLevel: 10 }));
    await assertFails(updateDoc(ref, { readingLevel: 7 }));
    await assertFails(updateDoc(ref, { readingLevel: deleteField() }));
    await assertSucceeds(getDoc(ref));
  });

  it("담당 교사도 학생의 레벨은 고칠 수 없다(이름 · 학번 고치기는 그대로)", async () => {
    const ref = doc(asTeacher(env, "teacherA").firestore(), "users", "s2");
    await assertFails(updateDoc(ref, { readingLevel: 10 }));
    await assertFails(updateDoc(ref, { realName: "이학생2", readingLevel: 10 }));
    await assertSucceeds(updateDoc(ref, { realName: "이학생2" }));
  });

  it("반 친구는 레벨을 읽는다(친구 화면이 그 옷을 그림)", async () => {
    const snap = await assertSucceeds(getDoc(doc(asStudent(env, "s3").firestore(), "users", "s2")));
    if (snap.data().readingLevel !== 6) throw new Error("레벨을 못 읽음");
  });
});
