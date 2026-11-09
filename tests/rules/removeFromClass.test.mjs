// =============================================================
// 반에서 빼기 — 학생 프로필 창의 '이 반에서 빼기'(lib/data/removeFromClass.js)
//   앱이 보내는 것과 같은 차례 · 같은 모양으로 씁니다. 규칙은 새로 열지 않았습니다 —
//   아래가 모두 이미 담당 교사에게 열려 있다는 것을 박아 둡니다.
//   ① 기본 모둠 · 자리표 · 독서 활동 모둠에서 빼기 → 손 내리기 → classIds 줄이기 → 소속 지우기
//   ② 다른 선생님 반의 소속 · 그 반 기록은 그대로
//   ③ 다른 반 교사 · 학생은 막힘 · 보관된 반은 모둠을 못 고침(그래서 앱도 보관된 반에서는 빼지 않음)
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { arrayRemove, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

describe("반에서 빼기 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-remove-from-class"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { name: "A반", createdBy: "teacherA", archived: false });
      await setDoc(doc(db, "classes", "cB"), { name: "B반", createdBy: "teacherB", archived: false });
      await setDoc(doc(db, "classes", "cZ"), { name: "옛 반", createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", ownedClassIds: ["cA", "cZ"] });
      await setDoc(doc(db, "users", "teacherB"), { role: "teacher", ownedClassIds: ["cB"] });
      // stu1 — 내 반(cA)과 다른 선생님 반(cB)에 함께 있는 학생 · stu2 — 내 반 친구
      await setDoc(doc(db, "users", "stu1"), { role: "student", realName: "김하윤", studentId: "30101", classIds: ["cA", "cB"] });
      await setDoc(doc(db, "users", "stu2"), { role: "student", realName: "이도윤", studentId: "30102", classIds: ["cA"] });
      await setDoc(doc(db, "memberships", "stu1_cA"), { uid: "stu1", classId: "cA" });
      await setDoc(doc(db, "memberships", "stu1_cB"), { uid: "stu1", classId: "cB" });
      await setDoc(doc(db, "memberships", "stu2_cA"), { uid: "stu2", classId: "cA" });
      await setDoc(doc(db, "classes", "cA", "groupAssignments", "default"), {
        classId: "cA",
        groups: [{ name: "1모둠", memberUids: ["stu1", "stu2"], members: [{ uid: "stu1" }, { uid: "stu2" }] }],
      });
      await setDoc(doc(db, "classes", "cA", "seatLayouts", "default"), { classId: "cA", layoutId: "default", seats: ["stu1", null, "stu2"] });
      await setDoc(doc(db, "classes", "cA", "seatLayouts", "daily_2026-11-09"), { classId: "cA", layoutId: "daily_2026-11-09", seats: ["stu2", "stu1"] });
      await setDoc(doc(db, "bookActivities", "raft1"), { classId: "cA", type: "raft", grouped: true, locked: true });
      await setDoc(doc(db, "bookActivities", "raft1", "groups", "group_1"), { memberUids: ["stu1", "stu2"], members: [{ uid: "stu1" }, { uid: "stu2" }] });
      await setDoc(doc(db, "bookActivities", "raft1", "entries", "stu1"), { activityId: "raft1", authorId: "stu1", answers: { writing: "남는 글" } });
      await setDoc(doc(db, "classes", "cA", "questionSignals", "stu1"), { uid: "stu1", classId: "cA" });
      await setDoc(doc(db, "rewards", "cA_stu1"), { classId: "cA", uid: "stu1", count: 5 });
      await setDoc(doc(db, "classes", "cB", "groupAssignments", "default"), {
        classId: "cB",
        groups: [{ name: "1모둠", memberUids: ["stu1"], members: [{ uid: "stu1" }] }],
      });
    });
  });

  it("담당 교사가 앱과 같은 차례로 뺀다 — 모둠 · 자리표 · 활동 모둠 · 손 · classIds · 소속", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    // 기본 모둠
    await assertSucceeds(getDoc(doc(t, "classes", "cA", "groupAssignments", "default")));
    await assertSucceeds(updateDoc(doc(t, "classes", "cA", "groupAssignments", "default"), {
      groups: [{ name: "1모둠", memberUids: ["stu2"], members: [{ uid: "stu2" }] }],
    }));
    // 자리표 — 그 학생이 앉은 것만 찾아서
    const seats = await assertSucceeds(getDocs(query(collection(t, "classes", "cA", "seatLayouts"), where("seats", "array-contains", "stu1"))));
    assert.equal(seats.size, 2);
    for (const s of seats.docs) {
      await assertSucceeds(updateDoc(s.ref, { seats: s.data().seats.map((x) => (x === "stu1" ? null : x)) }));
    }
    // 독서 활동 모둠 — 잠긴 활동이어도 교사는 모둠을 고침
    const acts = await assertSucceeds(getDocs(query(collection(t, "bookActivities"), where("classId", "==", "cA"))));
    assert.equal(acts.size, 1);
    for (const field of ["memberUids", "suspendedUids"]) {
      await assertSucceeds(getDocs(query(collection(t, "bookActivities", "raft1", "groups"), where(field, "array-contains", "stu1"))));
    }
    await assertSucceeds(updateDoc(doc(t, "bookActivities", "raft1", "groups", "group_1"), { memberUids: ["stu2"], members: [{ uid: "stu2" }] }));
    // 올려 둔 손 — 없는 손을 한 번 더 내려도 괜찮음(앱은 있는지 안 보고 내림)
    await assertSucceeds(deleteDoc(doc(t, "classes", "cA", "questionSignals", "stu1")));
    await assertSucceeds(deleteDoc(doc(t, "classes", "cA", "questionSignals", "stu1")));
    // 프로필의 반 목록 — 줄이기만
    await assertSucceeds(getDoc(doc(t, "users", "stu1")));
    await assertSucceeds(updateDoc(doc(t, "users", "stu1"), { classIds: arrayRemove("cA") }));
    // 소속 — 맨 마지막
    await assertSucceeds(deleteDoc(doc(t, "memberships", "stu1_cA")));

    await seed(env, async (db) => {
      assert.deepEqual((await getDoc(doc(db, "users", "stu1"))).data().classIds, ["cB"]);
      assert.equal((await getDoc(doc(db, "memberships", "stu1_cA"))).exists(), false);
      // 다른 선생님 반의 소속 · 모둠, 내 반의 글 · 과일은 그대로
      assert.equal((await getDoc(doc(db, "memberships", "stu1_cB"))).exists(), true);
      assert.deepEqual((await getDoc(doc(db, "classes", "cB", "groupAssignments", "default"))).data().groups[0].memberUids, ["stu1"]);
      assert.equal((await getDoc(doc(db, "bookActivities", "raft1", "entries", "stu1"))).exists(), true);
      assert.equal((await getDoc(doc(db, "rewards", "cA_stu1"))).data().count, 5);
    });
  });

  it("다른 반 교사는 남의 반에서 못 뺀다", async () => {
    const tb = asTeacher(env, "teacherB").firestore();
    await assertFails(deleteDoc(doc(tb, "memberships", "stu2_cA")));
    await assertFails(updateDoc(doc(tb, "users", "stu2"), { classIds: arrayRemove("cA") }));
    await assertFails(updateDoc(doc(tb, "classes", "cA", "groupAssignments", "default"), { groups: [] }));
    await assertFails(updateDoc(doc(tb, "bookActivities", "raft1", "groups", "group_1"), { memberUids: ["stu2"], members: [{ uid: "stu2" }] }));
  });

  it("학생은 스스로도 친구도 못 뺀다", async () => {
    const s1 = asStudent(env, "stu1").firestore();
    await assertFails(deleteDoc(doc(s1, "memberships", "stu2_cA")));
    await assertFails(deleteDoc(doc(s1, "memberships", "stu1_cA")));
    await assertFails(updateDoc(doc(s1, "classes", "cA", "groupAssignments", "default"), { groups: [] }));
  });

  it("classIds는 줄이기만 — 반을 끼워 넣거나 바꿔 치거나 다른 칸을 함께 고치는 것은 막힘", async () => {
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(updateDoc(doc(t, "users", "stu1"), { classIds: ["cA", "cB", "cX"] }));
    await assertFails(updateDoc(doc(t, "users", "stu1"), { classIds: ["cA", "cX"] }));
    await assertFails(updateDoc(doc(t, "users", "stu1"), { classIds: arrayRemove("cA"), realName: "바꿈" }));
  });

  it("보관된 반은 모둠을 고칠 수 없다 — 그래서 앱도 보관된 반에서는 빼지 않음", async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, "memberships", "stu2_cZ"), { uid: "stu2", classId: "cZ" });
      await setDoc(doc(db, "classes", "cZ", "groupAssignments", "default"), {
        classId: "cZ", groups: [{ memberUids: ["stu2"], members: [{ uid: "stu2" }] }],
      });
    });
    const t = asTeacher(env, "teacherA").firestore();
    await assertFails(updateDoc(doc(t, "classes", "cZ", "groupAssignments", "default"), {
      groups: [{ memberUids: [], members: [] }],
    }));
    // 소속 지우기는 보관된 반에도 열려 있습니다 — 반 완전 삭제가 지우는 길(canPurgeClass).
    // '이 반에서 빼기'는 앱이 보관된 반을 막습니다(lib/data/removeFromClass.js의 archived).
    await assertSucceeds(deleteDoc(doc(t, "memberships", "stu2_cZ")));
  });
});
