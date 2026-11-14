// =============================================================
// 독서 펫 — 프로필의 readingPet은 서버만, 알 단계의 종(reading/pet)은 아무도 못 읽음
// -------------------------------------------------------------
// 알 받기 · 깨우기는 서버 API(Admin SDK — 규칙을 우회)가 합니다(lib/server/readingService.js).
// 규칙이 지키는 것:
//  · 학생이 가입해 프로필을 만들 때 readingPet을 끼워 넣지 못함(마음에 드는 종 · 단계를 고르는 길)
//  · 학생 · 교사가 프로필의 readingPet을 고치지 못함(update의 칸 목록에 없음)
//  · 알 단계의 종을 적어 둔 users/{uid}/reading/pet은 학생 본인도 못 읽음(비밀 — 선생님 결정)
//  · 관리자 설정의 '학생 펫'(petEnabled)은 참 · 거짓만, 운영 중인 반에서만
//  · 펫 먹이(lib/petCare.js) — 배부름(readingPet.care)도 서버만 적고(학생이 제 펫을 배부르게 고치지 못함),
//    반 설정 네 칸(petFeedEnabled · petFeedFrom · petRestWeekend · petRests)은 모양이 맞을 때만 담당 교사가
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const signupProfile = (extra = {}) => ({
  email: "s1@example.com", realName: "김학생", displayName: "김학생", role: "student",
  requestedRole: null, studentId: null, createdAt: new Date(), ...extra,
});

describe("독서 펫 — 프로필의 펫과 비밀 문서", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-reading-pet"); });
  after(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "c1"), { name: "1반", createdBy: "teacherA", archived: false, readingEnabled: true });
      await setDoc(doc(db, "classes", "old"), { name: "보관 반", createdBy: "teacherA", archived: true, readingEnabled: false });
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", realName: "선생님", ownedClassIds: ["c1", "old"] });
      await setDoc(doc(db, "users", "s2"), {
        role: "student", realName: "이학생", studentId: "10102", classIds: ["c1"],
        readingPet: { species: null, baseXp: 120, assignedAt: 1700000000000, hatchedAt: null },
      });
      await setDoc(doc(db, "memberships", "s2_c1"), { uid: "s2", classId: "c1" });
      await setDoc(doc(db, "users", "s2", "reading", "pet"), { species: "owl", baseXp: 120 });
    });
  });

  it("가입할 때 펫을 끼워 넣을 수 없다(펫이 없으면 그대로 가입됨)", async () => {
    const db = asStudent(env, "s1").firestore();
    await assertFails(setDoc(doc(db, "users", "s1"), signupProfile({ readingPet: { species: "owl", baseXp: 0 } })));
    await assertFails(setDoc(doc(db, "users", "s1"), signupProfile({ readingPet: null })));
    await assertSucceeds(setDoc(doc(db, "users", "s1"), signupProfile()));
  });

  it("학생은 제 프로필의 펫을 고치거나 지울 수 없다", async () => {
    const ref = doc(asStudent(env, "s2").firestore(), "users", "s2");
    await assertFails(updateDoc(ref, { "readingPet.species": "cat" }));
    await assertFails(updateDoc(ref, { readingPet: { species: "cat", baseXp: 0 } }));
    await assertFails(updateDoc(ref, { readingPet: deleteField() }));
    await assertSucceeds(getDoc(ref)); // 제 프로필 읽기는 그대로
  });

  it("담당 교사도 학생 프로필의 펫은 고칠 수 없다(이름 · 학번 고치기는 그대로)", async () => {
    const ref = doc(asTeacher(env, "teacherA").firestore(), "users", "s2");
    await assertFails(updateDoc(ref, { "readingPet.species": "bear" }));
    await assertFails(updateDoc(ref, { realName: "이학생2", readingPet: { species: "bear", baseXp: 0 } }));
    await assertSucceeds(updateDoc(ref, { realName: "이학생2" }));
  });

  it("알 단계의 종(reading/pet)은 학생 본인도 · 교사도 못 읽고 못 쓴다", async () => {
    for (const ctx of [asStudent(env, "s2"), asTeacher(env, "teacherA")]) {
      const ref = doc(ctx.firestore(), "users", "s2", "reading", "pet");
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { species: "cat", baseXp: 0 }));
    }
  });

  it("관리자 설정 '학생 펫'은 참 · 거짓만, 운영 중인 반에서만", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(db, "classes", "c1"), { petEnabled: false }));
    await assertSucceeds(updateDoc(doc(db, "classes", "c1"), { petEnabled: true }));
    await assertFails(updateDoc(doc(db, "classes", "c1"), { petEnabled: "false" }));
    await assertFails(updateDoc(doc(db, "classes", "c1"), { petEnabled: null }));
    await assertFails(updateDoc(doc(db, "classes", "old"), { petEnabled: false }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1"), { petEnabled: false }));
  });

  it("펫 먹이 — 배부름(readingPet.care)은 학생도 교사도 못 고친다(먹이 · 다시 부르기는 서버만)", async () => {
    const care = { full: 100, day: "2026-11-13", kept: "2026-11-13", away: null };
    const mine = doc(asStudent(env, "s2").firestore(), "users", "s2");
    await assertFails(updateDoc(mine, { "readingPet.care": care }));
    await assertFails(updateDoc(mine, { "readingPet.care.full": 100 }));
    await assertFails(updateDoc(mine, { readingPet: { species: null, baseXp: 120, assignedAt: 1700000000000, hatchedAt: null, care } }));
    const teacher = doc(asTeacher(env, "teacherA").firestore(), "users", "s2");
    await assertFails(updateDoc(teacher, { "readingPet.care": care }));
  });

  it("관리자 설정 '펫 먹이' — 스위치 · 켠 때 · 주말 · 쉬는 기간은 모양이 맞을 때만, 운영 중인 반의 담당 교사가", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    const c1 = doc(db, "classes", "c1");
    // 켤 때 — 스위치와 켠 때를 한 번에(lib/data/classes.js의 featureWrite)
    await assertSucceeds(updateDoc(c1, { petFeedEnabled: true, petFeedFrom: 1794000000000 }));
    await assertSucceeds(updateDoc(c1, { petFeedEnabled: false }));
    await assertFails(updateDoc(c1, { petFeedEnabled: "true" }));
    await assertFails(updateDoc(c1, { petFeedEnabled: null }));
    await assertFails(updateDoc(c1, { petFeedFrom: "2026-11-14" }));
    await assertFails(updateDoc(c1, { petFeedFrom: -1 }));
    // 배고파지지 않는 날 — 주말(참 · 거짓) · 기간 목록(20줄까지)
    const rest = { kind: "vacation", from: "2026-12-24", to: "2027-02-01", note: "겨울 방학" };
    await assertSucceeds(updateDoc(c1, { petRestWeekend: false, petRests: [rest, { kind: "exam", from: "2026-12-08", to: "2026-12-11" }] }));
    await assertSucceeds(updateDoc(c1, { petRestWeekend: true, petRests: [] }));
    await assertFails(updateDoc(c1, { petRestWeekend: "no" }));
    await assertFails(updateDoc(c1, { petRests: "2026-12-24" }));
    await assertFails(updateDoc(c1, { petRests: { 0: rest } }));
    await assertFails(updateDoc(c1, { petRests: Array.from({ length: 21 }, () => rest) }));
    await assertSucceeds(updateDoc(c1, { petRests: Array.from({ length: 20 }, () => rest) }));
    // 보관된 반 · 학생 · 다른 선생님은 못 바꿈
    await assertFails(updateDoc(doc(db, "classes", "old"), { petFeedEnabled: true, petFeedFrom: 1794000000000 }));
    await assertFails(updateDoc(doc(db, "classes", "old"), { petRests: [] }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1"), { petFeedEnabled: true }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1"), { petRests: [] }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "c1"), { petFeedEnabled: true }));
    // 학생은 반 문서의 설정을 읽는다(배부름을 스스로 셈)
    await assertSucceeds(getDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1")));
  });
});
