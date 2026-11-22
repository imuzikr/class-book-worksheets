// 학생 탈퇴의 마무리(POST /api/account/withdraw가 쓰는 finishStudentWithdrawal 그대로)를
// Auth · Firestore 에뮬레이터의 진짜 ID 토큰으로 부릅니다. 담당 교사(프로필의 탈퇴 표시가 제 uid) · 관리자만
// 학생의 로그인 계정과 프로필 아래 전부를 지우고, 그 밖에는 아무것도 지워지지 않아야 합니다.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readingPrincipal } from "../../lib/server/readingService.js";
import { finishStudentWithdrawal } from "../../lib/server/accountService.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const app = initializeApp({ projectId }, "account-api-test-seed");
const db = getFirestore(app);
const auth = getAuth(app);
after(() => deleteApp(app));

let seq = 0;
async function signUp(role, extra = {}) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `account-${role}-${Date.now()}-${++seq}@example.com`, password: "valid-test-password", returnSecureToken: true }),
  });
  assert.equal(response.ok, true);
  const who = await response.json();
  if (role) await db.doc(`users/${who.localId}`).set({ role, realName: role, ...extra });
  return { uid: who.localId, token: who.idToken };
}
const principalOf = (token) => readingPrincipal(new Request("http://test/api/account/withdraw", { headers: { Authorization: `Bearer ${token}` } }));
const finish = async (who, uid) => finishStudentWithdrawal(await principalOf(who.token), uid);
const accountExists = (uid) => auth.getUser(uid).then(() => true, (e) => { if (e?.code === "auth/user-not-found") return false; throw e; });
const refused = (status, code) => (e) => e?.status === status && e?.code === code;

test("담당 교사 — 탈퇴 표시가 제 uid인 학생의 로그인 계정 · 프로필 · 그 아래 전부를 지운다", async () => {
  const teacher = await signUp("teacher");
  const student = await signUp("student", { withdrawingBy: teacher.uid });
  await db.doc(`users/${student.uid}/reading/main`).set({ state: { books: [] } });
  await db.doc(`users/${student.uid}/reading/pet`).set({ species: "fox" });
  await db.doc(`users/${student.uid}/reading/hideout`).set({ room: {} });
  await db.doc(`users/${student.uid}/readingRequests/req-1`).set({ at: 1 });
  // 없는 반을 가리키는 소속은 서버가 걷는다
  await db.doc(`memberships/${student.uid}_gone-class`).set({ uid: student.uid, classId: "gone-class" });

  assert.deepEqual(await finish(teacher, student.uid), { ok: true, authDeleted: true });
  assert.equal(await accountExists(student.uid), false);
  assert.equal((await db.doc(`users/${student.uid}`).get()).exists, false);
  for (const path of ["reading/main", "reading/pet", "reading/hideout", "readingRequests/req-1"]) {
    assert.equal((await db.doc(`users/${student.uid}/${path}`).get()).exists, false, path);
  }
  assert.equal((await db.doc(`memberships/${student.uid}_gone-class`).get()).exists, false);
  // 교사 자신은 그대로
  assert.equal(await accountExists(teacher.uid), true);
  assert.equal((await db.doc(`users/${teacher.uid}`).get()).exists, true);
});

test("탈퇴 표시가 없거나 남의 것이면 교사는 못 지우고, 관리자는 표시 없이도 지운다", async () => {
  const teacher = await signUp("teacher");
  const other = await signUp("teacher");
  const admin = await signUp("admin");
  const plain = await signUp("student");
  const theirs = await signUp("student", { withdrawingBy: other.uid });
  await assert.rejects(() => finish(teacher, plain.uid), refused(403, "account/forbidden"));
  await assert.rejects(() => finish(teacher, theirs.uid), refused(403, "account/forbidden"));
  assert.equal(await accountExists(plain.uid), true);
  assert.equal((await db.doc(`users/${theirs.uid}`).get()).exists, true);
  assert.deepEqual(await finish(admin, plain.uid), { ok: true, authDeleted: true });
  assert.equal(await accountExists(plain.uid), false);
});

test("학생 · 사용 중지된 교사 · 자기 자신 · 잘못된 uid는 거절", async () => {
  const teacher = await signUp("teacher");
  const frozen = await signUp("teacher", { suspended: true });
  const student = await signUp("student");
  const victim = await signUp("student", { withdrawingBy: student.uid });
  const frozenVictim = await signUp("student", { withdrawingBy: frozen.uid });
  await assert.rejects(() => finish(student, victim.uid), refused(403, "account/forbidden"));
  await assert.rejects(() => finish(frozen, frozenVictim.uid), refused(403, "account/forbidden"));
  await assert.rejects(() => finish(teacher, teacher.uid), refused(403, "account/self"));
  await assert.rejects(() => finish(teacher, "bad/uid"), refused(400, "account/bad-request"));
  await assert.rejects(() => finish(teacher, undefined), refused(400, "account/bad-request"));
  assert.equal(await accountExists(victim.uid), true);
  assert.equal(await accountExists(frozenVictim.uid), true);
});

test("교사 · 관리자 계정은 지우지 않는다 — 프로필의 role도, 로그인 계정의 role 클레임도 봄", async () => {
  const admin = await signUp("admin");
  const colleague = await signUp("teacher", { withdrawingBy: admin.uid });
  await assert.rejects(() => finish(admin, colleague.uid), refused(403, "account/not-student"));
  // 프로필은 학생인데 로그인 계정에 교사 클레임이 남은 옛 계정
  const claimed = await signUp("student", { withdrawingBy: admin.uid });
  await auth.setCustomUserClaims(claimed.uid, { role: "teacher" });
  await assert.rejects(() => finish(admin, claimed.uid), refused(403, "account/not-student"));
  assert.equal(await accountExists(colleague.uid), true);
  assert.equal(await accountExists(claimed.uid), true);
  assert.equal((await db.doc(`users/${claimed.uid}`).get()).exists, true);
});

test("아직 있는 반에 소속이 남아 있으면 멈추고 아무것도 지우지 않는다", async () => {
  const teacher = await signUp("teacher");
  const student = await signUp("student", { withdrawingBy: teacher.uid });
  await db.doc("classes/account-live-class").set({ name: "남은 반", createdBy: "someone-else" });
  await db.doc(`memberships/${student.uid}_account-live-class`).set({ uid: student.uid, classId: "account-live-class" });
  await assert.rejects(() => finish(teacher, student.uid), refused(409, "account/still-member"));
  assert.equal(await accountExists(student.uid), true);
  assert.equal((await db.doc(`users/${student.uid}`).get()).exists, true);
  // 소속을 지운 뒤 다시 부르면 끝까지 간다
  await db.doc(`memberships/${student.uid}_account-live-class`).delete();
  assert.deepEqual(await finish(teacher, student.uid), { ok: true, authDeleted: true });
  // 다른 서버 시험(대시보드의 '모든 반' 집계)이 이 반을 세지 않게 걷어 둡니다 — 에뮬레이터를 함께 씁니다.
  await db.doc("classes/account-live-class").delete();
});

test("프로필이 이미 없으면 교사는 404, 관리자는 남은 로그인 계정만 지운다 · 계정도 없으면 authDeleted false", async () => {
  const teacher = await signUp("teacher");
  const admin = await signUp("admin");
  const ghost = await signUp(null);
  await assert.rejects(() => finish(teacher, ghost.uid), refused(404, "account/no-profile"));
  assert.equal(await accountExists(ghost.uid), true);
  assert.deepEqual(await finish(admin, ghost.uid), { ok: true, authDeleted: true });
  assert.deepEqual(await finish(admin, ghost.uid), { ok: true, authDeleted: false });
});
