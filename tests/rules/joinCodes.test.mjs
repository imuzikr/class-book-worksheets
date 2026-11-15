// =============================================================
// 참여 코드(joinCodes) — 선생님이 직접 정하기 · 재발급 · 보관
// -------------------------------------------------------------
// 선생님 요청으로 참여 코드를 직접 정할 수 있게 되었습니다(lib/joinCode.js · lib/data/classes.js의 setJoinCode).
// 앱은 새 코드 만들기와 옛 코드 지우기를 **한 트랜잭션**으로 하고(replaceClassJoinCode), 옛 코드는 '내가 만든
// 코드' 질의에서 고릅니다(classJoinCodeDocs). 여기서는 그 길을 앱과 같은 모양으로 보내 봅니다.
//  · 교사가 반으로 곧바로 찾는 질의(classId ==)는 거부됩니다 — 한때 앱이 그 질의를 써서 선생님 계정에서는
//    재발급 · 보관 · 복원이 실패했습니다(관리자 계정에서만 됨).
//  · 코드는 영어 대문자 · 숫자 6~12자(규칙의 create — 화면을 거치지 않아도).
//  · 다른 선생님이 쓰는 코드는 못 가져가고(이미 있는 문서에 쓰면 update), 제 코드를 다른 반으로 돌려 적지
//    못합니다(교사의 update는 유효기간만 — 한때 열려 있던 빈틈).
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

const DAY = 86400000;
const later = () => new Date(Date.now() + 14 * DAY);

// 앱의 replaceClassJoinCode와 같은 모양 — 새 코드가 없으면 옛 코드(있는 것만)를 지우고 새 코드를 만듭니다
async function replaceCode(db, { classId, code, owner, oldCodes }) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "joinCodes", code);
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error(snap.data().classId === classId ? "same" : "taken");
    const alive = [];
    for (const old of oldCodes) {
      const oldRef = doc(db, "joinCodes", old);
      if ((await tx.get(oldRef)).exists()) alive.push(oldRef);
    }
    alive.forEach((r) => tx.delete(r));
    tx.set(ref, { classId, createdBy: owner, expiresAt: later(), createdAt: serverTimestamp() });
  });
}

describe("참여 코드 — 직접 정하기 · 재발급 · 보관", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-join-codes"); });
  after(async () => { await env.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "users", "t1"), { role: "teacher", ownedClassIds: ["cA", "cA2", "cArch"] });
      await setDoc(doc(db, "users", "t2"), { role: "teacher", ownedClassIds: ["cB"] });
      await setDoc(doc(db, "users", "a1"), { role: "admin" });
      await setDoc(doc(db, "users", "s1"), { role: "student" });
      await setDoc(doc(db, "classes", "cA"), { name: "1반", createdBy: "t1" });
      await setDoc(doc(db, "classes", "cA2"), { name: "2반", createdBy: "t1" });
      await setDoc(doc(db, "classes", "cArch"), { name: "옛 반", createdBy: "t1", archived: true });
      await setDoc(doc(db, "classes", "cB"), { name: "옆 반", createdBy: "t2" });
      await setDoc(doc(db, "joinCodes", "AAAAAA"), { classId: "cA", createdBy: "t1", expiresAt: later() });
      await setDoc(doc(db, "joinCodes", "BBBBBB"), { classId: "cB", createdBy: "t2", expiresAt: later() });
    });
  });
  const exists = async (code) => {
    let found = false;
    await seed(env, async (db) => { found = (await getDoc(doc(db, "joinCodes", code))).exists(); });
    return found;
  };

  it("교사가 반으로 곧바로 찾는 질의(classId ==)는 거부되고, '내가 만든 코드' 질의는 통과한다", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertFails(getDocs(query(collection(t1, "joinCodes"), where("classId", "==", "cA"))));
    const mine = await assertSucceeds(getDocs(query(collection(t1, "joinCodes"), where("createdBy", "==", "t1"))));
    assert.deepEqual(mine.docs.filter((d) => d.data().classId === "cA").map((d) => d.id), ["AAAAAA"]);
    // 관리자는 반으로 곧바로 찾습니다
    await assertSucceeds(getDocs(query(collection(asAdmin(env, "a1").firestore(), "joinCodes"), where("classId", "==", "cA"))));
  });

  it("앱과 같은 트랜잭션으로 내 반의 코드를 직접 정한다 — 옛 코드는 지워지고 새 코드로 들어온다", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertSucceeds(replaceCode(t1, { classId: "cA", code: "BOOK3B", owner: "t1", oldCodes: ["AAAAAA"] }));
    assert.equal(await exists("AAAAAA"), false);
    assert.equal(await exists("BOOK3B"), true);
    // 학생은 새 코드로 들어오고, 옛 코드로는 못 들어옵니다(이미 들어온 학생의 소속은 코드와 무관)
    const s1 = asStudent(env, "s1").firestore();
    await assertFails(setDoc(doc(s1, "memberships", "s1_cA"), { uid: "s1", classId: "cA", code: "AAAAAA", joinedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(s1, "memberships", "s1_cA"), { uid: "s1", classId: "cA", code: "BOOK3B", joinedAt: serverTimestamp() }));
  });

  it("재발급도 같은 길 — 무작위 코드로 갈아 끼운다(선생님 계정에서도)", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertSucceeds(replaceCode(t1, { classId: "cA", code: "XK7P2M", owner: "t1", oldCodes: ["AAAAAA"] }));
    assert.equal(await exists("AAAAAA"), false);
    // 옛 코드가 이미 없어도(다른 화면에서 먼저 지움) 트랜잭션은 그대로 됩니다 — 있는 것만 지우므로
    await assertSucceeds(replaceCode(t1, { classId: "cA", code: "Q2W3E4", owner: "t1", oldCodes: ["XK7P2M", "AAAAAA"] }));
    assert.equal(await exists("Q2W3E4"), true);
  });

  it("코드는 영어 대문자 · 숫자 6~12자만 — 짧은 코드 · 소문자 · 기호 · 한글은 거부된다", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    const make = (code) => setDoc(doc(t1, "joinCodes", code), { classId: "cA2", createdBy: "t1", expiresAt: later() });
    await assertFails(make("AB12C"));
    await assertFails(make("ABCDEFGHJKMNP"));
    await assertFails(make("book3b"));
    await assertFails(make("BOOK_3"));
    await assertFails(make("3반책방들어와"));
    await assertSucceeds(make("CLASS7"));
    await assertSucceeds(make("ABCDEFGHJKMN"));
  });

  it("다른 선생님이 쓰는 코드는 가져갈 수 없다 — 이미 있는 코드 문서에 쓰면 거부", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertFails(setDoc(doc(t1, "joinCodes", "BBBBBB"), { classId: "cA", createdBy: "t1", expiresAt: later() }));
    await assert.rejects(replaceCode(t1, { classId: "cA", code: "BBBBBB", owner: "t1", oldCodes: ["AAAAAA"] }), /taken/);
    assert.equal(await exists("AAAAAA"), true);   // 실패하면 아무것도 안 바뀜
  });

  it("제 코드를 다른 반으로 돌려 적을 수 없다 — 교사가 고칠 수 있는 칸은 유효기간뿐", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertFails(updateDoc(doc(t1, "joinCodes", "AAAAAA"), { classId: "cB" }));
    await assertFails(updateDoc(doc(t1, "joinCodes", "AAAAAA"), { classId: "cA2" }));
    await assertFails(updateDoc(doc(t1, "joinCodes", "AAAAAA"), { createdBy: "t2" }));
    await assertSucceeds(updateDoc(doc(t1, "joinCodes", "AAAAAA"), { expiresAt: new Date(Date.now() + 20 * DAY) }));
    // 남의 코드는 유효기간도 못 고칩니다
    await assertFails(updateDoc(doc(t1, "joinCodes", "BBBBBB"), { expiresAt: new Date(Date.now() + 20 * DAY) }));
  });

  it("보관된 반 · 남의 반에는 코드를 만들 수 없고, 학생은 코드를 못 만든다", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertFails(setDoc(doc(t1, "joinCodes", "OLDCLASS"), { classId: "cArch", createdBy: "t1", expiresAt: later() }));
    await assertFails(setDoc(doc(t1, "joinCodes", "NEIGHB0R"), { classId: "cB", createdBy: "t1", expiresAt: later() }));
    await assertFails(setDoc(doc(t1, "joinCodes", "NEIGHB0R"), { classId: "cB", createdBy: "t2", expiresAt: later() }));
    const s1 = asStudent(env, "s1").firestore();
    await assertFails(setDoc(doc(s1, "joinCodes", "MYOWN1"), { classId: "cA", createdBy: "s1", expiresAt: later() }));
  });

  it("관리자는 다른 선생님 반의 코드를 그 선생님 이름으로 바꾸고, 그 선생님의 목록에 보인다", async () => {
    const admin = asAdmin(env, "a1").firestore();
    await assertSucceeds(replaceCode(admin, { classId: "cB", code: "NEXT2026", owner: "t2", oldCodes: ["BBBBBB"] }));
    const t2 = asTeacher(env, "t2").firestore();
    const mine = await assertSucceeds(getDocs(query(collection(t2, "joinCodes"), where("createdBy", "==", "t2"))));
    assert.deepEqual(mine.docs.map((d) => d.id), ["NEXT2026"]);
  });

  it("보관할 때 선생님은 제 코드를 지우고, 남의 코드는 못 지운다", async () => {
    const t1 = asTeacher(env, "t1").firestore();
    await assertSucceeds(deleteDoc(doc(t1, "joinCodes", "AAAAAA")));
    await assertFails(deleteDoc(doc(t1, "joinCodes", "BBBBBB")));
  });
});
