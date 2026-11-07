// =============================================================
// 낱말 빙고 — bookActivities/{aId}/bingoBoards/{판 id}
//
// 못 박아 두는 것:
//   ① 판은 반 구성원 · 담당 교사가 읽고, 반 밖은 못 읽는다
//   ② 쓰기는 그 판(모둠)의 구성원만, 칸 merge(지우기 포함)가 통과한다
//   ③ 판 채우기 단계(bingo.stage == 'fill')에서만 — 빙고가 시작되면 굳는다
//   ④ 잠긴 활동에서는 못 쓴다
//   ⑤ 모양을 못 박는다 — 칸 열쇠는 "0"~"24", 다른 칸 · groupId 둔갑은 거부
//   ⑥ 지우기는 담당 교사만
//   ⑦ 학생은 빙고 중에 낱말 하나를 부를 수 있다(bingo.called 끝에 하나만 · 상자의 낱말 ·
//      아직 안 부른 것) — 되돌리기 · 다른 칸 · 잠긴 활동 · 판 채우기 단계 · 반 밖은 거부
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const actPath = ["bookActivities", "act1"];
const boardPath = (gId) => ["bookActivities", "act1", "bingoBoards", gId];
const write = (db, gId, cells) =>
  setDoc(doc(db, ...boardPath(gId)), { groupId: gId, cells, updatedAt: serverTimestamp() }, { merge: true });

describe("낱말 빙고 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-bingo"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), { createdBy: "teacherA", archived: false });
      for (const uid of ["stu1", "stu2", "stu3"]) {
        await setDoc(doc(db, "memberships", `${uid}_cA`), { uid, classId: "cA" });
      }
      await setDoc(doc(db, ...actPath), {
        classId: "cA", type: "bingo", title: "빙고", locked: false, groupMode: "base",
        bingo: { stage: "fill", words: ["사과", "배"], called: [], goal: 3 },
      });
      // 1모둠: stu1·stu2 / 2모둠: stu3
      await setDoc(doc(db, ...actPath, "groups", "group_1"), { activityId: "act1", groupIndex: 1, memberUids: ["stu1", "stu2"], members: [] });
      await setDoc(doc(db, ...actPath, "groups", "group_2"), { activityId: "act1", groupIndex: 2, memberUids: ["stu3"], members: [] });
      await setDoc(doc(db, ...boardPath("group_2")), { groupId: "group_2", cells: { 0: "사과" } });
    });
  });

  it("읽기 — 반 구성원(다른 모둠 포함) · 담당 교사는 읽고, 반 밖은 못 읽음", async () => {
    await assertSucceeds(getDoc(doc(asStudent(env, "stu1").firestore(), ...boardPath("group_2"))));
    await assertSucceeds(getDocs(collection(asStudent(env, "stu1").firestore(), ...actPath, "bingoBoards")));
    await assertSucceeds(getDocs(collection(asTeacher(env, "teacherA").firestore(), ...actPath, "bingoBoards")));
    await assertFails(getDoc(doc(asStudent(env, "outsider").firestore(), ...boardPath("group_2"))));
  });

  it("쓰기 — 그 모둠원이 칸 merge로 넣고 지움, 다른 모둠은 못 씀", async () => {
    const db1 = asStudent(env, "stu1").firestore();
    await assertSucceeds(write(db1, "group_1", { 0: "사과", 24: "배" }));
    await assertSucceeds(write(asStudent(env, "stu2").firestore(), "group_1", { 1: "배" }));
    await assertSucceeds(write(db1, "group_1", { 24: deleteField() }));
    await assertFails(write(asStudent(env, "stu3").firestore(), "group_1", { 2: "사과" }));
    await assertFails(write(db1, "group_2", { 1: "배" }));
  });

  it("모양 — 칸 열쇠는 0~24만, groupId 둔갑 · 다른 필드는 거부", async () => {
    const db1 = asStudent(env, "stu1").firestore();
    await assertFails(write(db1, "group_1", { 25: "사과" }));
    await assertFails(write(db1, "group_1", { "a": "사과" }));
    await assertFails(setDoc(doc(db1, ...boardPath("group_1")), { groupId: "group_2", cells: {}, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db1, ...boardPath("group_1")), { groupId: "group_1", cells: {}, updatedAt: serverTimestamp(), extra: 1 }));
  });

  it("빙고가 시작되면(play) · 잠기면 판이 굳음", async () => {
    const db1 = asStudent(env, "stu1").firestore();
    await seed(env, (db) => updateDoc(doc(db, ...actPath), { "bingo.stage": "play" }));
    await assertFails(write(db1, "group_1", { 0: "사과" }));
    await seed(env, (db) => updateDoc(doc(db, ...actPath), { "bingo.stage": "fill", locked: true }));
    await assertFails(write(db1, "group_1", { 0: "사과" }));
    await seed(env, (db) => updateDoc(doc(db, ...actPath), { locked: false }));
    await assertSucceeds(write(db1, "group_1", { 0: "사과" }));
  });

  it("빙고 상태가 없는 활동에서는 못 씀", async () => {
    await seed(env, (db) => updateDoc(doc(db, ...actPath), { bingo: null }));
    await assertFails(write(asStudent(env, "stu1").firestore(), "group_1", { 0: "사과" }));
  });

  it("지우기 — 담당 교사만", async () => {
    await assertFails(deleteDoc(doc(asStudent(env, "stu3").firestore(), ...boardPath("group_2"))));
    await assertSucceeds(deleteDoc(doc(asTeacher(env, "teacherA").firestore(), ...boardPath("group_2"))));
  });

  describe("학생이 낱말 부르기", () => {
    const words = ["사과", "배", "감"];
    const setPlay = (extra = {}) => seed(env, (db) => updateDoc(doc(db, ...actPath), {
      bingo: { stage: "play", words, called: ["사과"], goal: 3 }, ...extra,
    }));
    const call = (db, called, bingoExtra = {}) => updateDoc(doc(db, ...actPath), {
      bingo: { stage: "play", words, called, goal: 3, ...bingoExtra },
    });

    it("반 학생은 끝에 낱말 하나를 붙일 수 있음 · 처음 부를 때도", async () => {
      await setPlay();
      await assertSucceeds(call(asStudent(env, "stu1").firestore(), ["사과", "배"]));
      await seed(env, (db) => updateDoc(doc(db, ...actPath), { bingo: { stage: "play", words, called: [], goal: 3 } }));
      await assertSucceeds(call(asStudent(env, "stu3").firestore(), ["감"]));
    });

    it("둘 이상 · 되돌리기 · 순서 바꾸기 · 이미 부른 것 · 상자 밖 낱말은 거부", async () => {
      await setPlay();
      const s1 = asStudent(env, "stu1").firestore();
      await assertFails(call(s1, ["사과", "배", "감"]));
      await assertFails(call(s1, []));
      await assertFails(call(s1, ["배", "사과"]));
      await assertFails(call(s1, ["사과", "사과"]));
      await assertFails(call(s1, ["사과", "귤"]));
    });

    it("다른 칸을 함께 바꾸면 거부(목표 · 단계 · 활동 칸)", async () => {
      await setPlay();
      const s1 = asStudent(env, "stu1").firestore();
      await assertFails(call(s1, ["사과", "배"], { goal: 1 }));
      await assertFails(call(s1, ["사과", "배"], { stage: "fill" }));
      await assertFails(updateDoc(doc(s1, ...actPath), { "bingo.called": ["사과", "배"], title: "바꿈" }));
    });

    it("판 채우기 단계 · 잠긴 활동 · 반 밖 학생은 거부", async () => {
      await seed(env, (db) => updateDoc(doc(db, ...actPath), { bingo: { stage: "fill", words, called: [], goal: 3 } }));
      await assertFails(call(asStudent(env, "stu1").firestore(), ["배"]));
      await setPlay({ locked: true });
      await assertFails(call(asStudent(env, "stu1").firestore(), ["사과", "배"]));
      await setPlay({ locked: false });
      await assertFails(call(asStudent(env, "outsider").firestore(), ["사과", "배"]));
    });

    it("빙고가 아닌 활동에서는 학생 갈래가 안 열림", async () => {
      await seed(env, (db) => setDoc(doc(db, "bookActivities", "act2"), {
        classId: "cA", type: "raft", title: "RAFT", locked: false,
        bingo: { stage: "play", words, called: [], goal: 3 },
      }));
      await assertFails(updateDoc(doc(asStudent(env, "stu1").firestore(), "bookActivities", "act2"), {
        bingo: { stage: "play", words, called: ["배"], goal: 3 },
      }));
    });
  });
});
