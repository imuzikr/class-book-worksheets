// =============================================================
// 학생 사용 중지(전학 등) — users/{uid}.suspended
//   ① 담당 교사가 켜고 끈다(그 학생의 반이 모두 내 반일 때만 · 세 칸만 · 적은 사람은 나)
//   ② 중지된 학생은 휴면 — 반 기록 읽기 · 쓰기가 막히고, 자기 프로필만 읽는다
//   ③ 반 친구들은 그 학생이 남긴 글을 그대로 읽는다(모둠에서 빠져 suspendedUids로 옮겨도)
//   ④ 중지된 학생의 해시태그 글에는 댓글을 달 수 없다
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const NAMES = { stu1: ["김하윤", "30101"], stu2: ["이도윤", "30102"] };
const comment = (uid) => ({
  activityId: "hash1", postUid: "stu1", authorId: uid, authorName: NAMES[uid][0], studentId: NAMES[uid][1],
  byTeacher: false, kind: "ask", text: "왜 그렇게 생각했나요?",
});

describe("학생 사용 중지 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-suspend"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { name: "A", createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "cB"), { name: "B", createdBy: "teacherB", archived: false });
      for (const uid of ["stu1", "stu2"]) {
        await setDoc(doc(db, "memberships", `${uid}_cA`), { uid, classId: "cA" });
        await setDoc(doc(db, "users", uid), { role: "student", classIds: ["cA"], realName: NAMES[uid][0], studentId: NAMES[uid][1] });
      }
      await setDoc(doc(db, "memberships", "stu3_cA"), { uid: "stu3", classId: "cA" });
      await setDoc(doc(db, "memberships", "stu3_cB"), { uid: "stu3", classId: "cB" });
      await setDoc(doc(db, "users", "stu3"), { role: "student", classIds: ["cA", "cB"] });
      await setDoc(doc(db, "rewards", "cA_stu1"), { classId: "cA", uid: "stu1", count: 3 });
      await setDoc(doc(db, "bookActivities", "raft1"), { classId: "cA", type: "raft", grouped: true, locked: false });
      await setDoc(doc(db, "bookActivities", "raft1", "groups", "group_1"), { memberUids: ["stu2"], suspendedUids: ["stu1"] });
      await setDoc(doc(db, "bookActivities", "raft1", "entries", "stu1"), { activityId: "raft1", authorId: "stu1", groupId: "group_1", answers: { writing: "글" } });
      await setDoc(doc(db, "bookActivities", "hash1"), { classId: "cA", type: "hashtag", locked: false, published: true });
      await setDoc(doc(db, "bookActivities", "hash1", "hashtagPosts", "stu1"), { authorId: "stu1", tags: [] });
    });
  });

  it("담당 교사가 켜고 끈다 — 반이 모두 내 반일 때만 · 적은 사람은 나", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(t, "users", "stu1"), { suspended: true, suspendedBy: "teacherA" }));
    await assertSucceeds(updateDoc(doc(t, "users", "stu1"), { suspended: false, suspendedBy: "teacherA" }));
    await assertFails(updateDoc(doc(t, "users", "stu1"), { suspended: true, suspendedBy: "teacherB" }));
    await assertFails(updateDoc(doc(t, "users", "stu1"), { suspended: "yes", suspendedBy: "teacherA" }));
    await assertFails(updateDoc(doc(t, "users", "stu1"), { suspended: true, suspendedBy: "teacherA", realName: "바꿈" }));
    // 다른 선생님 반에도 있는 학생 · 다른 반 교사 · 학생 본인
    await assertFails(updateDoc(doc(t, "users", "stu3"), { suspended: true, suspendedBy: "teacherA" }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "users", "stu1"), { suspended: true, suspendedBy: "teacherB" }));
    await assertFails(updateDoc(doc(asStudent(env, "stu1").firestore(), "users", "stu1"), { suspended: false, suspendedBy: "stu1" }));
  });

  it("중지된 학생은 휴면 — 반 기록을 못 읽고 못 쓰며, 자기 프로필만 읽음", async () => {
    await updateDoc(doc(asTeacher(env, "teacherA").firestore(), "users", "stu1"), { suspended: true, suspendedBy: "teacherA" });
    const s1 = asStudent(env, "stu1").firestore();
    await assertSucceeds(getDoc(doc(s1, "users", "stu1")));
    await assertFails(getDoc(doc(s1, "users", "stu2")));
    await assertFails(getDoc(doc(s1, "rewards", "cA_stu1")));
    await assertFails(getDoc(doc(s1, "bookActivities", "raft1")));
    await assertFails(setDoc(doc(s1, "bookActivities", "raft1", "entries", "stu1"), { groupId: "group_1" }, { merge: true }));
    await assertFails(getDocs(query(collection(s1, "memberships"), where("classId", "==", "cA"))));
  });

  it("반 친구는 그 학생이 남긴 글을 그대로 읽음 — 모둠에서 빠진(suspendedUids) 친구의 RAFT 글도", async () => {
    await updateDoc(doc(asTeacher(env, "teacherA").firestore(), "users", "stu1"), { suspended: true, suspendedBy: "teacherA" });
    const s2 = asStudent(env, "stu2").firestore();
    await assertSucceeds(getDoc(doc(s2, "bookActivities", "raft1", "entries", "stu1")));
    await assertSucceeds(getDoc(doc(s2, "bookActivities", "hash1", "hashtagPosts", "stu1")));
    await assertSucceeds(getDoc(doc(s2, "users", "stu1")));
  });

  it("중지된 학생의 해시태그 글에는 댓글을 달 수 없음", async () => {
    const s2 = asStudent(env, "stu2").firestore();
    const col = collection(s2, "bookActivities", "hash1", "hashtagComments");
    await assertSucceeds(addDoc(col, comment("stu2")));
    await updateDoc(doc(asTeacher(env, "teacherA").firestore(), "users", "stu1"), { suspended: true, suspendedBy: "teacherA" });
    await assertFails(addDoc(col, comment("stu2")));
  });
});
