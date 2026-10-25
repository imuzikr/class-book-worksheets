// =============================================================
// 가입 · 참여 코드 — 공개 운영
// -------------------------------------------------------------
// 학교 도메인 제한과 등록 코드는 걷었습니다. 가입은 **구글 계정이면 누구나**,
// 반에 들어가는 관문은 교사가 만든 **참여 코드**입니다. 그래서 규칙은
//  · users 생성을 구글 로그인 · 학생 역할로만 받고
//  · joinCodes는 '정확한 코드로 1건'만 읽게 하고 목록은 막습니다
//    (소속 생성의 코드 대조는 memberships.test.mjs).
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

function profile(extra = {}) {
  return {
    email: "someone@gmail.com",
    realName: "아무개",
    displayName: "다급한 달팽이",
    emoji: "🐌",
    role: "student",
    requestedRole: null,
    studentId: null,
    createdAt: new Date(),
    ...extra,
  };
}

describe("가입(users 생성)", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-signup"); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => { await env.clearFirestore(); });

  it("어느 도메인이든 구글 계정이면 학생으로 가입된다", async () => {
    const db = asStudent(env, "u1").firestore();
    await assertSucceeds(setDoc(doc(db, "users", "u1"), profile()));
  });

  it("선생님 신청 표시를 달고 가입할 수 있다(권한은 아님)", async () => {
    const db = asStudent(env, "u1").firestore();
    await assertSucceeds(setDoc(doc(db, "users", "u1"), profile({ requestedRole: "teacher" })));
  });

  it("스스로 교사 역할로는 가입할 수 없다", async () => {
    const db = asStudent(env, "u1").firestore();
    await assertFails(setDoc(doc(db, "users", "u1"), profile({ role: "teacher" })));
  });

  it("엉뚱한 신청 표시는 거부된다", async () => {
    const db = asStudent(env, "u1").firestore();
    await assertFails(setDoc(doc(db, "users", "u1"), profile({ requestedRole: "admin" })));
  });

  it("구글이 아닌 로그인(이메일·비밀번호)으로는 가입할 수 없다", async () => {
    const db = env
      .authenticatedContext("u2", {
        email: "u2@example.com",
        email_verified: true,
        firebase: { sign_in_provider: "password" },
      })
      .firestore();
    await assertFails(setDoc(doc(db, "users", "u2"), profile()));
  });

  it("남의 프로필은 만들 수 없다", async () => {
    const db = asStudent(env, "u1").firestore();
    await assertFails(setDoc(doc(db, "users", "u9"), profile()));
  });
});

describe("참여 코드(joinCodes) 읽기", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-joincodes"); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, (db) =>
      setDoc(doc(db, "joinCodes", "ABC234"), {
        classId: "classA", createdBy: "teacherA", expiresAt: new Date(Date.now() + 86400000),
      })
    );
  });

  it("로그인한 학생은 정확한 코드로 1건 읽는다", async () => {
    const db = asStudent(env, "stu1").firestore();
    await assertSucceeds(getDoc(doc(db, "joinCodes", "ABC234")));
  });

  it("학생은 코드 목록을 훑을 수 없다", async () => {
    const db = asStudent(env, "stu1").firestore();
    await assertFails(getDocs(collection(db, "joinCodes")));
  });

  it("교사는 아직 없는 코드를 읽어 겹치지 않는지 본다", async () => {
    const db = asTeacher(env, "teacherB").firestore();
    await assertSucceeds(getDoc(doc(db, "joinCodes", "ZZZ999")));
  });

  it("관리자는 읽는다", async () => {
    const db = asAdmin(env, "root").firestore();
    await assertSucceeds(getDoc(doc(db, "joinCodes", "ABC234")));
  });
});
