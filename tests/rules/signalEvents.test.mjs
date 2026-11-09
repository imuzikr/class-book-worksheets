// =============================================================
// 손들기 확인 이력(옛 기록) — classes/{cId}/signalEvents/{auto}
// -------------------------------------------------------------
// 한때 교사가 손든 학생을 '확인'할 때마다 한 장씩 남겼는데, 그것을 읽는 화면이
// 없어 앱이 더는 쓰지 않습니다(lib/data/signals.js의 confirmQuestionSignal).
// 그래서 만들기를 닫았습니다. 이미 남은 기록은 반 삭제 · 학생 탈퇴 때 지우므로,
// 담당 교사가 그 학생 것을 찾아 읽는 길은 그대로 둡니다.
//
// 여기서 지키는 것:
//  · 아무도 새로 만들지 못할 것(담당 교사도)
//  · 담당 교사는 옛 기록을 찾아 읽을 것(탈퇴 정리) · 남의 반 교사는 못 읽을 것
//  · 학생은 '자기 것만' 읽을 것
//  · 고치거나 그냥 지우지 못할 것(지우기는 반 삭제 · 탈퇴 갈래만)
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc,
  addDoc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

const evCol = (db, cId) => collection(db, "classes", cId, "signalEvents");

// 한때 클라이언트(confirmQuestionSignal)가 보내던 형태
const payload = (cId, uid, byUid) => ({
  classId: cId,
  uid,
  name: "홍길동",
  studentId: "30101",
  raisedAt: null,
  byUid,
  at: serverTimestamp(),
});

describe("손들기 확인 이력(옛 기록) 규칙", () => {
  let env;

  before(async () => {
    env = await makeEnv("demo-rules-signal-events");
  });
  after(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cA"), {
        createdBy: "teacherA", archived: false, name: "A반",
      });
      await setDoc(doc(db, "classes", "cB"), {
        createdBy: "teacherB", archived: false, name: "B반",
      });
      await setDoc(doc(db, "classes", "cOld"), {
        createdBy: "teacherA", archived: true, name: "보관된 반",
      });
      await setDoc(doc(db, "memberships", "stu1_cA"), { uid: "stu1", classId: "cA" });
      await setDoc(doc(db, "memberships", "stu2_cA"), { uid: "stu2", classId: "cA" });
    });
  });

  // ── 쓰기 ── 앱이 더는 쓰지 않아 닫았습니다.
  it("담당 교사도 새로 남길 수 없다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(addDoc(evCol(db, "cA"), payload("cA", "stu1", "teacherA")));
  });

  it("남의 반 교사는 남길 수 없다", async () => {
    const db = asTeacher(env, "teacherB").firestore();
    await assertFails(addDoc(evCol(db, "cA"), payload("cA", "stu1", "teacherB")));
  });

  // 학생이 직접 적을 수 있으면 손든 횟수를 스스로 부풀릴 수 있습니다.
  it("학생은 스스로 이력을 남길 수 없다", async () => {
    const db = asStudent(env, "stu1").firestore();
    await assertFails(addDoc(evCol(db, "cA"), payload("cA", "stu1", "stu1")));
  });

  it("보관된 반에는 남길 수 없다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(addDoc(evCol(db, "cOld"), payload("cOld", "stu1", "teacherA")));
  });

  it("byUid를 다른 사람으로 위조할 수 없다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(addDoc(evCol(db, "cA"), payload("cA", "stu1", "teacherB")));
  });

  // at을 임의 시각으로 넣으면 '최근 4주' 집계가 통째로 흔들립니다.
  it("at을 임의 시각으로 넣을 수 없다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(
      addDoc(evCol(db, "cA"), { ...payload("cA", "stu1", "teacherA"), at: new Date("2099-01-01") })
    );
  });

  it("classId가 경로와 다르면 거부된다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(addDoc(evCol(db, "cA"), payload("cB", "stu1", "teacherA")));
  });

  it("uid가 문자열이 아니면 거부된다", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(
      addDoc(evCol(db, "cA"), { ...payload("cA", "stu1", "teacherA"), uid: 123 })
    );
  });

  // ── 읽기 ──
  it("학생은 자기 이력을 읽을 수 있다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asStudent(env, "stu1").firestore();
    await assertSucceeds(getDoc(doc(db, "classes", "cA", "signalEvents", id)));
  });

  it("학생은 남의 이력을 읽을 수 없다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu2", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asStudent(env, "stu1").firestore();
    await assertFails(getDoc(doc(db, "classes", "cA", "signalEvents", id)));
  });

  it("담당 교사는 읽을 수 있다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDoc(doc(db, "classes", "cA", "signalEvents", id)));
  });

  // 학생 탈퇴 때 담당 교사가 그 학생 것을 찾아 지웁니다(lib/data/withdraw.js).
  it("담당 교사는 그 학생 것을 찾아 읽을 수 있다(탈퇴 정리)", async () => {
    await seed(env, (db) => addDoc(evCol(db, "cA"), {
      classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
    }));
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(query(evCol(db, "cA"), where("uid", "==", "stu1"))));
  });

  it("남의 반 교사는 읽을 수 없다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asTeacher(env, "teacherB").firestore();
    await assertFails(getDoc(doc(db, "classes", "cA", "signalEvents", id)));
  });

  it("최고 관리자는 읽을 수 있다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asAdmin(env, "root").firestore();
    await assertSucceeds(getDoc(doc(db, "classes", "cA", "signalEvents", id)));
  });

  // ── 고치기·지우기 ── 고칠 수 있으면 이력이 아닙니다.
  it("교사도 이력을 고칠 수 없다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(updateDoc(doc(db, "classes", "cA", "signalEvents", id), { uid: "stu2" }));
  });

  it("교사도 이력을 지울 수 없다", async () => {
    let id;
    await seed(env, async (db) => {
      const ref = await addDoc(evCol(db, "cA"), {
        classId: "cA", uid: "stu1", byUid: "teacherA", at: new Date(),
      });
      id = ref.id;
    });
    const db = asTeacher(env, "teacherA").firestore();
    await assertFails(deleteDoc(doc(db, "classes", "cA", "signalEvents", id)));
  });
});
