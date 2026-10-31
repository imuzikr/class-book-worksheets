// =============================================================
// 역할은 users/{uid}.role — 서버 함수 · 커스텀 클레임 없이
// -------------------------------------------------------------
// 책 나눔은 Cloud Functions를 쓰지 않아 role 클레임을 줄 길이 없습니다.
// 그래서 규칙이 프로필 문서의 role을 읽어 교사 · 관리자를 가립니다.
// 여기서는 **클레임 없는 로그인**(asStudent와 같은 토큰)에 문서 role만
// 달리 두고 확인합니다.
//  · 문서 role이 teacher면 교사가 할 일을 하고, student면 못 한다
//  · 학생은 스스로 role을 못 올린다 — 단 하나의 길은 교사 가입 코드
//    (config/teacherSignup.code, 앱에서는 아무도 못 읽음)
//  · 관리자(문서 role admin)는 남의 역할을 바꾼다, 교사는 못 바꾼다
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { makeEnv, asStudent, seed } from "./helpers.mjs";

// 클레임 없는 로그인 — 역할은 users 문서만 말합니다
const as = (env, uid) => asStudent(env, uid);

const promote = (code, extra = {}) => ({
  role: "teacher",
  teacherCode: code,
  teacherAt: serverTimestamp(),
  requestedRole: null,
  ...extra,
});

describe("users 문서의 role로 판정하기", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-doc-roles"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "users", "tDoc"), { role: "teacher", displayName: "선생님" });
      await setDoc(doc(db, "users", "sDoc"), { role: "student", displayName: "다람쥐", realName: "학생" });
      await setDoc(doc(db, "users", "aDoc"), { role: "admin", displayName: "선생님" });
      await setDoc(doc(db, "config", "teacherSignup"), { code: "BOOK-2026" });
      await setDoc(doc(db, "classes", "cT"), { name: "1반", createdBy: "tDoc", archived: false });
    });
  });

  describe("교사 · 학생 판정", () => {
    it("문서 role이 teacher면 반을 만든다", async () => {
      const db = as(env, "tDoc").firestore();
      await assertSucceeds(setDoc(doc(db, "classes", "c2"), { name: "2반", createdBy: "tDoc" }));
    });

    it("문서 role이 student면 반을 못 만든다", async () => {
      const db = as(env, "sDoc").firestore();
      await assertFails(setDoc(doc(db, "classes", "c3"), { name: "3반", createdBy: "sDoc" }));
    });

    it("문서 role이 teacher면 학생 프로필을 읽는다", async () => {
      const db = as(env, "tDoc").firestore();
      await assertSucceeds(getDoc(doc(db, "users", "sDoc")));
    });

    it("문서 role이 teacher면 자기 반에 참여 코드를 만들고 공지를 남긴다", async () => {
      const db = as(env, "tDoc").firestore();
      await assertSucceeds(
        setDoc(doc(db, "joinCodes", "ABC234"), {
          classId: "cT", createdBy: "tDoc", expiresAt: new Date(Date.now() + 86400000),
        })
      );
      await assertSucceeds(
        addDoc(collection(db, "classes", "cT", "classNotices"), {
          classId: "cT", text: "공지", sentCount: 0, senderUid: "tDoc",
          senderName: "선생님", sentAt: serverTimestamp(),
        })
      );
    });

    it("프로필이 아직 없는 계정은 학생으로 본다", async () => {
      const db = as(env, "nobody").firestore();
      await assertFails(setDoc(doc(db, "classes", "c4"), { name: "4반", createdBy: "nobody" }));
    });
  });

  describe("역할 바꾸기", () => {
    it("관리자(문서 role admin)는 남의 역할을 바꾼다", async () => {
      const db = as(env, "aDoc").firestore();
      await assertSucceeds(updateDoc(doc(db, "users", "sDoc"), { role: "teacher" }));
    });

    it("교사는 남의 역할을 못 바꾼다", async () => {
      const db = as(env, "tDoc").firestore();
      await assertFails(updateDoc(doc(db, "users", "sDoc"), { role: "teacher" }));
    });

    it("교사는 스스로 관리자가 될 수 없다", async () => {
      const db = as(env, "tDoc").firestore();
      await assertFails(updateDoc(doc(db, "users", "tDoc"), { role: "admin" }));
    });
  });

  describe("교사 가입 코드", () => {
    it("맞는 코드면 학생이 스스로 선생님이 된다", async () => {
      const db = as(env, "sDoc").firestore();
      await assertSucceeds(updateDoc(doc(db, "users", "sDoc"), promote("BOOK-2026")));
    });

    it("틀린 코드 · 빈 코드는 거부된다", async () => {
      const db = as(env, "sDoc").firestore();
      await assertFails(updateDoc(doc(db, "users", "sDoc"), promote("WRONG-1")));
      await assertFails(updateDoc(doc(db, "users", "sDoc"), promote("")));
    });

    it("코드로도 관리자는 될 수 없다", async () => {
      const db = as(env, "sDoc").firestore();
      await assertFails(updateDoc(doc(db, "users", "sDoc"), promote("BOOK-2026", { role: "admin" })));
    });

    it("코드를 핑계로 실명 같은 다른 칸을 함께 바꿀 수 없다", async () => {
      const db = as(env, "sDoc").firestore();
      await assertFails(
        updateDoc(doc(db, "users", "sDoc"), promote("BOOK-2026", { realName: "가짜" }))
      );
      await assertFails(
        updateDoc(doc(db, "users", "sDoc"), promote("BOOK-2026", { displayName: "가짜" }))
      );
    });

    it("남을 선생님으로 만들 수 없다", async () => {
      const db = as(env, "tDoc").firestore();
      await assertFails(updateDoc(doc(db, "users", "sDoc"), promote("BOOK-2026")));
    });

    it("콘솔에 코드를 안 적어 두었으면 아무도 선생님이 될 수 없다", async () => {
      await seed(env, async (db) => {
        await setDoc(doc(db, "config", "teacherSignup"), { other: 1 });
      });
      const db = as(env, "sDoc").firestore();
      await assertFails(updateDoc(doc(db, "users", "sDoc"), promote("")));
      await assertFails(updateDoc(doc(db, "users", "sDoc"), promote("BOOK-2026")));
    });

    it("코드 문서는 앱에서 아무도 읽거나 고치지 못한다", async () => {
      const sdb = as(env, "sDoc").firestore();
      const adb = as(env, "aDoc").firestore();
      await assertFails(getDoc(doc(sdb, "config", "teacherSignup")));
      await assertFails(getDoc(doc(adb, "config", "teacherSignup")));
      await assertFails(setDoc(doc(adb, "config", "teacherSignup"), { code: "MINE-123" }));
    });

    it("가입(프로필 만들기) 때는 학생으로만 만든다", async () => {
      const db = as(env, "newbie").firestore();
      await assertFails(
        setDoc(doc(db, "users", "newbie"), { role: "teacher", teacherCode: "BOOK-2026" })
      );
      await assertSucceeds(setDoc(doc(db, "users", "newbie"), { role: "student" }));
    });
  });
});
