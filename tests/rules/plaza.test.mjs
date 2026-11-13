// =============================================================
// 책 광장 — 공유 사본과 댓글
//   classes/{cId}/plazaShelves/{학생 uid} · plazaBooks/{학생uid_책id} · plazaComments/{id}
// -------------------------------------------------------------
// 셋 다 서버(Next API · Admin SDK)만 씁니다(lib/server/readingService.js). 규칙은 읽기만 엽니다.
//
// 여기서 지키려는 것:
//  · 같은 반 학생은 **그 반이 광장을 켰을 때만** 읽는다(목록 · 책 한 권 · 댓글 질의)
//  · 다른 반 학생 · 사용 중지된 학생 · 광장을 끈 반의 학생은 못 읽는다
//  · 담당 교사는 꺼 둔 동안에도 읽는다(이름 맞추기 · 탈퇴 정리) — 남의 반 교사는 못 읽는다
//  · **아무도 앱에서 직접 쓰지 못한다** — 학생 본인도, 담당 교사도(글 · 댓글 · 댓글 수를 꾸며 넣지 못하게)
//  · 다만 이미 있는 길은 그대로: 이름 맞추기(이름표만 · 지금 프로필 값으로), 탈퇴 중인 학생의 기록 지우기,
//    보관된 반의 완전 삭제
//  · 반 설정 plazaEnabled는 담당 교사가 참 · 거짓으로만, 운영 중인 반에서만 바꾼다
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

const shelf = (db, cId, uid) => doc(db, "classes", cId, "plazaShelves", uid);
const book = (db, cId, key) => doc(db, "classes", cId, "plazaBooks", key);
const comment = (db, cId, id) => doc(db, "classes", cId, "plazaComments", id);

describe("책 광장 규칙", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-plaza"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "cOn"), { name: "광장 켠 반", createdBy: "teacherA", archived: false, readingEnabled: true, plazaEnabled: true });
      await setDoc(doc(db, "classes", "cOff"), { name: "광장 끈 반", createdBy: "teacherA", archived: false, readingEnabled: true });
      await setDoc(doc(db, "classes", "cOld"), { name: "보관된 반", createdBy: "teacherA", archived: true, readingEnabled: true, plazaEnabled: true });
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", ownedClassIds: ["cOn", "cOff", "cOld"] });
      await setDoc(doc(db, "users", "teacherB"), { role: "teacher", ownedClassIds: [] });
      await setDoc(doc(db, "users", "s1"), { role: "student", realName: "김하나", studentId: "30101", classIds: ["cOn", "cOff", "cOld"] });
      await setDoc(doc(db, "users", "s2"), { role: "student", realName: "이두리", studentId: "30102", classIds: ["cOn"] });
      await setDoc(doc(db, "users", "s3"), { role: "student", realName: "멈춘 학생", studentId: "30103", classIds: ["cOn"], suspended: true });
      await setDoc(doc(db, "users", "sX"), { role: "student", realName: "다른 반", studentId: "30199", classIds: [] });
      for (const [uid, cId] of [["s1", "cOn"], ["s2", "cOn"], ["s3", "cOn"], ["s1", "cOff"], ["s1", "cOld"]]) {
        await setDoc(doc(db, "memberships", `${uid}_${cId}`), { uid, classId: cId });
      }
      for (const cId of ["cOn", "cOff", "cOld"]) {
        await setDoc(shelf(db, cId, "s1"), { uid: "s1", name: "김하나", studentId: "30101", rule: 1, books: [{ id: "b1", title: "책", place: "stall" }], blocked: [], counts: { b1: 1 } });
        await setDoc(book(db, cId, "s1_b1"), { uid: "s1", name: "김하나", studentId: "30101", bookId: "b1", title: "책", place: "stall", logs: [{ id: "l1", notes: "발자국" }], review: null, comments: 1 });
        await setDoc(comment(db, cId, "c1"), { book: "s1_b1", ownerUid: "s1", bookId: "b1", uid: "s2", name: "이두리", studentId: "30102", byTeacher: false, text: "잘 읽었어요" });
      }
    });
  });

  it("같은 반 학생은 광장을 켠 반에서 목록 · 책 · 댓글을 읽는다", async () => {
    const db = asStudent(env, "s2").firestore();
    await assertSucceeds(getDocs(collection(db, "classes", "cOn", "plazaShelves")));
    await assertSucceeds(getDoc(shelf(db, "cOn", "s1")));
    await assertSucceeds(getDoc(book(db, "cOn", "s1_b1")));
    await assertSucceeds(getDocs(query(collection(db, "classes", "cOn", "plazaComments"), where("book", "==", "s1_b1"))));
    // 아직 없는 책도 읽기 자체는 된다(없다는 답)
    await assertSucceeds(getDoc(book(db, "cOn", "s2_none")));
  });

  it("광장을 끈 반 · 보관된 반의 학생, 다른 반 학생, 사용 중지된 학생, 로그인 안 한 사람은 못 읽는다", async () => {
    const mine = asStudent(env, "s1").firestore();
    await assertFails(getDocs(collection(mine, "classes", "cOff", "plazaShelves")));
    await assertFails(getDoc(book(mine, "cOff", "s1_b1")));
    await assertFails(getDocs(collection(mine, "classes", "cOff", "plazaComments")));
    await assertFails(getDoc(book(mine, "cOld", "s1_b1")));
    const outsider = asStudent(env, "sX").firestore();
    await assertFails(getDocs(collection(outsider, "classes", "cOn", "plazaShelves")));
    await assertFails(getDoc(book(outsider, "cOn", "s1_b1")));
    await assertFails(getDocs(collection(outsider, "classes", "cOn", "plazaComments")));
    const stopped = asStudent(env, "s3").firestore();
    await assertFails(getDoc(shelf(stopped, "cOn", "s1")));
    await assertFails(getDoc(book(stopped, "cOn", "s1_b1")));
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(book(anon, "cOn", "s1_b1")));
  });

  it("담당 교사 · 관리자는 꺼 둔 반에서도 읽고, 남의 반 교사는 못 읽는다", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(collection(teacher, "classes", "cOn", "plazaShelves")));
    await assertSucceeds(getDocs(query(collection(teacher, "classes", "cOff", "plazaBooks"), where("uid", "==", "s1"))));
    await assertSucceeds(getDocs(query(collection(teacher, "classes", "cOff", "plazaComments"), where("ownerUid", "==", "s1"))));
    const admin = asAdmin(env, "admin1").firestore();
    await assertSucceeds(getDoc(book(admin, "cOff", "s1_b1")));
    const other = asTeacher(env, "teacherB").firestore();
    await assertFails(getDocs(collection(other, "classes", "cOn", "plazaShelves")));
    await assertFails(getDoc(book(other, "cOn", "s1_b1")));
  });

  it("아무도 앱에서 직접 쓰지 못한다 — 본인의 글도, 댓글도, 댓글 수도, 담당 교사도", async () => {
    const owner = asStudent(env, "s1").firestore();
    await assertFails(setDoc(shelf(owner, "cOn", "s1"), { uid: "s1", name: "김하나", books: [] }));
    await assertFails(updateDoc(shelf(owner, "cOn", "s1"), { counts: { b1: 99 } }));
    await assertFails(updateDoc(book(owner, "cOn", "s1_b1"), { review: { text: "꾸민 글", rating: 5 } }));
    await assertFails(setDoc(book(owner, "cOn", "s1_b2"), { uid: "s1", bookId: "b2", place: "shelf" }));
    await assertFails(deleteDoc(book(owner, "cOn", "s1_b1")));
    const friend = asStudent(env, "s2").firestore();
    await assertFails(setDoc(comment(friend, "cOn", "c2"), { book: "s1_b1", ownerUid: "s1", bookId: "b1", uid: "s2", name: "이두리", text: "직접 쓴 댓글" }));
    await assertFails(updateDoc(comment(friend, "cOn", "c1"), { text: "고친 댓글" }));
    await assertFails(deleteDoc(comment(friend, "cOn", "c1")));
    await assertFails(updateDoc(book(friend, "cOn", "s1_b1"), { comments: 100 }));
    const teacher = asTeacher(env, "teacherA").firestore();
    await assertFails(setDoc(comment(teacher, "cOn", "c3"), { book: "s1_b1", ownerUid: "s1", bookId: "b1", uid: "teacherA", name: "선생님", byTeacher: true, text: "직접" }));
    await assertFails(updateDoc(book(teacher, "cOn", "s1_b1"), { place: null }));
    await assertFails(deleteDoc(book(teacher, "cOn", "s1_b1")));
    await assertFails(deleteDoc(comment(teacher, "cOn", "c1")));
  });

  it("이름 맞추기 — 담당 교사가 이름표만, 그 학생의 지금 프로필 값으로", async () => {
    await seed(env, (db) => updateDoc(doc(db, "users", "s1"), { realName: "김하늘", studentId: "30111" }));
    const teacher = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(shelf(teacher, "cOn", "s1"), { name: "김하늘", studentId: "30111" }));
    await assertSucceeds(updateDoc(book(teacher, "cOn", "s1_b1"), { name: "김하늘", studentId: "30111" }));
    // 아무 이름이나 못 적고, 이름표 밖의 칸은 못 건드린다
    await assertFails(updateDoc(book(teacher, "cOn", "s1_b1"), { name: "엉뚱한 이름" }));
    await assertFails(updateDoc(book(teacher, "cOn", "s1_b1"), { name: "김하늘", title: "바꾼 제목" }));
    await seed(env, (db) => updateDoc(doc(db, "users", "s2"), { realName: "이두루" }));
    await assertSucceeds(updateDoc(comment(teacher, "cOn", "c1"), { name: "이두루" }));
    await assertFails(updateDoc(comment(teacher, "cOn", "c1"), { name: "이두루", text: "고친 댓글" }));
    // 남의 반 교사 · 학생은 이름표도 못 고친다
    await assertFails(updateDoc(book(asTeacher(env, "teacherB").firestore(), "cOn", "s1_b1"), { name: "김하늘" }));
    await assertFails(updateDoc(book(asStudent(env, "s1").firestore(), "cOn", "s1_b1"), { name: "김하늘" }));
  });

  it("학생 탈퇴 — 탈퇴 중으로 표시한 학생의 목록 · 책 · 댓글(쓴 것 · 그 책에 달린 것)만 지운다", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    // 표시 전에는 못 지운다
    await assertFails(deleteDoc(shelf(teacher, "cOn", "s1")));
    await seed(env, async (db) => {
      await updateDoc(doc(db, "users", "s1"), { withdrawingBy: "teacherA" });
      await setDoc(comment(db, "cOn", "c9"), { book: "s2_b7", ownerUid: "s2", bookId: "b7", uid: "s1", name: "김하나", studentId: "30101", byTeacher: false, text: "s1이 쓴 댓글" });
      await setDoc(book(db, "cOn", "s2_b7"), { uid: "s2", name: "이두리", bookId: "b7", place: "stall", logs: [], review: null });
    });
    await assertSucceeds(deleteDoc(shelf(teacher, "cOn", "s1")));
    await assertSucceeds(deleteDoc(book(teacher, "cOn", "s1_b1")));
    await assertSucceeds(deleteDoc(comment(teacher, "cOn", "c1")));   // s1의 책에 달린 s2의 댓글(ownerUid)
    await assertSucceeds(deleteDoc(comment(teacher, "cOn", "c9")));   // s1이 쓴 댓글(uid)
    // 다른 학생의 책은 그대로
    await assertFails(deleteDoc(book(teacher, "cOn", "s2_b7")));
  });

  it("반 완전 삭제 — 보관된 반의 담당 교사가 읽고 지운다", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(getDocs(collection(teacher, "classes", "cOld", "plazaShelves")));
    await assertSucceeds(deleteDoc(shelf(teacher, "cOld", "s1")));
    await assertSucceeds(deleteDoc(book(teacher, "cOld", "s1_b1")));
    await assertSucceeds(deleteDoc(comment(teacher, "cOld", "c1")));
    await assertFails(deleteDoc(book(asTeacher(env, "teacherB").firestore(), "cOld", "s1_b1")));
  });

  it("반 설정 plazaEnabled — 담당 교사가 참 · 거짓으로만, 운영 중인 반에서만", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOff"), { plazaEnabled: true }));
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOff"), { plazaEnabled: false }));
    await assertFails(updateDoc(doc(teacher, "classes", "cOff"), { plazaEnabled: "yes" }));
    await assertFails(updateDoc(doc(teacher, "classes", "cOld"), { plazaEnabled: false }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "cOff"), { plazaEnabled: true }));
    await assertFails(updateDoc(doc(asStudent(env, "s1").firestore(), "classes", "cOff"), { plazaEnabled: true }));
    // 켜면 그 반 학생이 읽게 된다
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOff"), { plazaEnabled: true }));
    await assertSucceeds(getDoc(book(asStudent(env, "s1").firestore(), "cOff", "s1_b1")));
  });

  // 교실(책 광장의 둘째 방) — 스위치와 칠판의 '출석시작'(lib/data/classes.js의 callClassroomRoll)
  it("반 설정 classroomEnabled — 담당 교사가 참 · 거짓으로만, 운영 중인 반에서만", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOn"), { classroomEnabled: true }));
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOn"), { classroomEnabled: false }));
    await assertFails(updateDoc(doc(teacher, "classes", "cOn"), { classroomEnabled: "yes" }));
    await assertFails(updateDoc(doc(teacher, "classes", "cOld"), { classroomEnabled: true }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "cOn"), { classroomEnabled: true }));
    await assertFails(updateDoc(doc(asStudent(env, "s1").firestore(), "classes", "cOn"), { classroomEnabled: true }));
  });
  it("칠판의 출석시작 — 담당 교사가 출석을 열면서 '확인한 때'(수)를 함께 적는다", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    // 앱과 같은 한 번의 쓰기(세 칸) — 다시 부르면 '확인한 때'만 바뀐다
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOn"), { attendanceOpen: true, attendanceOpenDate: "2026-11-13", classroomCallAt: 1794500000000 }));
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOn"), { attendanceOpen: true, attendanceOpenDate: "2026-11-13", classroomCallAt: 1794500001234 }));
    // 수가 아니거나 음수면 안 받는다
    await assertFails(updateDoc(doc(teacher, "classes", "cOn"), { classroomCallAt: "now" }));
    await assertFails(updateDoc(doc(teacher, "classes", "cOn"), { classroomCallAt: -1 }));
    // 학생 · 다른 반 교사는 못 적는다(학생이 스스로 '출석 확인'을 꾸며 낼 수 없음), 보관된 반에도 못 적는다
    await assertFails(updateDoc(doc(asStudent(env, "s1").firestore(), "classes", "cOn"), { classroomCallAt: 1794500002000 }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "cOn"), { classroomCallAt: 1794500002000 }));
    await assertFails(updateDoc(doc(teacher, "classes", "cOld"), { classroomCallAt: 1794500002000 }));
    // 반 학생은 그 값을 읽는다(반 문서 한 건 — 앉아 있는 학생의 화면이 바뀌는 것을 본다)
    await assertSucceeds(getDoc(doc(asStudent(env, "s1").firestore(), "classes", "cOn")));
  });
  // 모두 이동 — 선생님의 '모두 교실로 · 모두 광장으로'(lib/data/classes.js의 moveClassroomAll).
  // 규칙을 새로 열지 않았습니다 — 반 문서는 담당 교사(와 관리자)만 고치므로 지금 규칙이 그대로 받습니다.
  // (값의 모양은 규칙이 보지 않고 화면이 걸러 읽습니다 — lib/readingClassroom.js의 classroomMoveCall.)
  it("모두 이동 — 담당 교사만 '어느 방으로 · 보낸 때'를 적고, 반 학생은 그 값을 읽는다", async () => {
    const teacher = asTeacher(env, "teacherA").firestore();
    // 앱과 같은 한 번의 쓰기(두 칸) — 다시 누르면 방과 '보낸 때'가 함께 바뀐다
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOn"), { classroomMoveTo: "classroom", classroomMoveAt: 1794500000000 }));
    await assertSucceeds(updateDoc(doc(teacher, "classes", "cOn"), { classroomMoveTo: "plaza", classroomMoveAt: 1794500004321 }));
    // 학생 · 다른 반 교사는 못 적는다(학생이 스스로 반 전체를 옮길 수 없음)
    await assertFails(updateDoc(doc(asStudent(env, "s1").firestore(), "classes", "cOn"), { classroomMoveTo: "classroom", classroomMoveAt: 1794500009000 }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "cOn"), { classroomMoveTo: "classroom", classroomMoveAt: 1794500009000 }));
    // 반 학생은 그 값을 읽는다(반 문서 한 건 — 광장 탭을 연 화면이 바뀌는 것을 보고 스스로 옮긴다)
    const seen = await assertSucceeds(getDoc(doc(asStudent(env, "s1").firestore(), "classes", "cOn")));
    assert.equal(seen.data().classroomMoveTo, "plaza");
    assert.equal(seen.data().classroomMoveAt, 1794500004321);
  });
});
