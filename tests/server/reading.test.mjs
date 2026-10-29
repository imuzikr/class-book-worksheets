// Run through Firebase CLI with both Auth and Firestore emulators.
// Uses the production service and real transactions; no credentials required.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getReading, mutateReading, getReadingRankings, readingPrincipal } from "../../lib/server/readingService.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const seedApp = initializeApp({ projectId }, "reading-api-test-seed");
const db = getFirestore(seedApp);
const ids = { student: "api-student", other: "api-other", teacher: "api-teacher", admin: "api-admin" };
const principal = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const addBook = { type: "addBook", title: "독서 API 시험", author: "테스트", totalPages: 50 };
const payload = (requestId, action, classId = "api-class") => ({ classId, requestId, action });
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

before(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(response.ok, true);
  const batch = db.batch();
  batch.set(db.doc("classes/api-class"), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc("classes/api-off"), { createdBy: ids.teacher });
  for (const [kind, uid] of Object.entries(ids)) {
    batch.set(db.doc(`users/${uid}`), { role: kind === "teacher" || kind === "admin" ? kind : "student", realName: kind === "student" ? "김학생" : "다른사용자", studentId: kind === "student" ? "20101" : "20102", displayName: "익명으로 바뀌면 안 됨" });
  }
  batch.set(db.doc(`memberships/${ids.student}_api-class`), { uid: ids.student, classId: "api-class" });
  batch.set(db.doc(`memberships/${ids.other}_api-other-class`), { uid: ids.other, classId: "api-other-class" });
  await batch.commit();
});
after(async () => { await deleteApp(seedApp); });

test("API authentication accepts verified email identity and rejects anonymous/missing token", async () => {
  await assert.rejects(() => readingPrincipal(new Request("http://test")), (e) => e.status === 401);
  const signUp = async (body) => {
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, returnSecureToken: true }),
    });
    assert.equal(response.ok, true); return response.json();
  };
  const identity = await signUp({ email: `reading-${Date.now()}@example.com`, password: "valid-test-password" });
  const request = new Request("http://test", { headers: { Authorization: `Bearer ${identity.idToken}` } });
  assert.equal((await readingPrincipal(request)).uid, identity.localId);
  const anon = await signUp({});
  await assert.rejects(() => readingPrincipal(new Request("http://test", { headers: { Authorization: `Bearer ${anon.idToken}` } })), (e) => e.status === 401);
});

test("GET/POST enforce default-off and actual class membership, including administrators", async () => {
  await assert.rejects(() => getReading(principal("student"), "api-off"), (e) => e.code === "reading/disabled");
  await assert.rejects(() => getReading(principal("admin"), "api-off"), (e) => e.code === "reading/disabled");
  await assert.rejects(() => getReading(principal("other"), "api-class"), (e) => e.status === 403);
  await assert.rejects(() => mutateReading(principal("other"), payload("forbidden-0001", addBook)), (e) => e.status === 403);
});

test("POST idempotency is atomic under concurrent submissions and conflicts reject", async () => {
  const body = payload("api-book-0001", addBook);
  const responses = await Promise.all([mutateReading(principal("student"), body), mutateReading(principal("student"), body)]);
  assert.equal(responses.filter((r) => r.replayed).length, 1);
  const result = await getReading(principal("student"), "api-class");
  assert.equal(result.state.books.length, 1);
  assert.equal(result.state.books[0].id, "api-book-0001");
  await assert.rejects(() => mutateReading(principal("student"), payload("api-book-0001", { ...addBook, title: "다른 내용" })), (e) => e.status === 409);
});

test("record creation, rank projection and correction are atomic and exclude private content", async () => {
  const log = { type: "addLog", bookId: "api-book-0001", date: today, startPage: 1, endPage: 50, notes: "비공개 감상은 랭킹에 나오면 안 됨" };
  const saved = await mutateReading(principal("student"), payload("api-log-0001", log));
  assert.equal(saved.summary.totalBooks, 1);
  const ranking = await getReadingRankings(principal("student"), "api-class", "daily");
  assert.equal(ranking.rankings.length, 1);
  assert.equal(ranking.rankings[0].name, "김학생");
  assert.equal(ranking.rankings[0].xp, saved.summary.classScores["api-class"].daily);
  assert.equal(JSON.stringify(ranking).includes(log.notes), false);
  assert.equal(JSON.stringify(ranking).includes("익명으로"), false);
  const edited = await mutateReading(principal("student"), payload("api-edit-0001", { type: "updateLog", logId: "api-log-0001", endPage: 20 }));
  assert.equal(edited.summary.totalBooks, 0);
  assert.equal((await getReadingRankings(principal("teacher"), "api-class", "daily")).rankings[0].xp, edited.summary.classScores["api-class"].daily);
});

test("idempotent retry returns current state after later edits", async () => {
  const retried = await mutateReading(principal("student"), payload("api-book-0001", addBook));
  assert.equal(retried.replayed, true);
  assert.equal(retried.state.logs[0].endPage, 20);
});

test("disabling a class immediately blocks private reads, rankings and writes, retaining state", async () => {
  await db.doc("classes/api-class").update({ readingEnabled: false });
  await assert.rejects(() => getReading(principal("student"), "api-class"), (e) => e.status === 403);
  await assert.rejects(() => getReadingRankings(principal("teacher"), "api-class", "weekly"), (e) => e.status === 403);
  await assert.rejects(() => mutateReading(principal("student"), payload("api-blocked-0001", { type: "deleteLog", logId: "api-log-0001" })), (e) => e.status === 403);
  await db.doc("classes/api-class").update({ readingEnabled: true });
  assert.equal((await getReading(principal("student"), "api-class")).state.logs[0].endPage, 20);
});


test("oversized Korean state is rejected before any transaction writes", async () => {
  const uid = "api-large-student";
  const classId = "api-large-class";
  const createdAt = new Date().toISOString();
  const state = {
    version: 1,
    books: [{ id: "api-large-book", title: "대용량 독서 기록", author: "시험", totalPages: 10000, status: "reading", createdAt }],
    logs: Array.from({ length: 140 }, (_, index) => ({
      id: `large-log-${index}`, bookId: "api-large-book", classId, date: today,
      startPage: index + 1, endPage: index + 1, notes: "가".repeat(1800), createdAt,
    })),
    reviews: [], featuredBadge: null,
  };
  // Character count alone would pass: Korean UTF-8 bytes push the state above
  // our application cap while it is still a valid, sub-1-MiB Firestore document.
  assert.ok(JSON.stringify(state).length < 750000);
  const bytes = Buffer.byteLength(JSON.stringify(state), "utf8");
  assert.ok(bytes > 750000 && bytes < 1000000);
  const stateRef = db.doc(`users/${uid}/reading/main`);
  const batch = db.batch();
  batch.set(db.doc(`users/${uid}`), { role: "student", realName: "김대용량", studentId: "20103" });
  batch.set(db.doc(`classes/${classId}`), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc(`memberships/${uid}_${classId}`), { uid, classId });
  batch.set(stateRef, { state });
  await batch.commit();
  await assert.rejects(
    () => mutateReading({ uid, roleClaim: null, db }, payload("api-large-request", { type: "setFeaturedBadge", badgeId: null }, classId)),
    (error) => error.status === 413 && error.code === "reading/state-too-large"
  );
  assert.deepEqual((await stateRef.get()).data().state, state);
  assert.equal((await db.doc(`users/${uid}/readingRequests/api-large-request`).get()).exists, false);
  assert.equal((await db.doc(`classes/${classId}/readingMembers/${uid}`).get()).exists, false);
});
