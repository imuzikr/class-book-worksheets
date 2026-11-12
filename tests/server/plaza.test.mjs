// 책 광장 — 서버가 저장할 때 맞추는 공유 사본과 댓글 · 내리기(lib/server/readingService.js).
// Auth · Firestore 에뮬레이터에서 진짜 트랜잭션으로 봅니다(tests/server/README.md).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mutateReading, plazaAction } from "../../lib/server/readingService.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const seedApp = initializeApp({ projectId }, "plaza-api-test-seed");
const db = getFirestore(seedApp);
const CLASS = "plz-class";
const ids = { a: "plz-a", b: "plz-b", out: "plz-out", teacher: "plz-teacher", other: "plz-other-teacher" };
const who = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const send = (kind, requestId, action, classId = CLASS) => mutateReading(who(kind), { classId, requestId, action });
const shelf = async (kind) => (await db.doc(`classes/${CLASS}/plazaShelves/${ids[kind]}`).get()).data();
const bookDoc = async (kind, bookId) => (await db.doc(`classes/${CLASS}/plazaBooks/${ids[kind]}_${bookId}`).get()).data();
const act = (kind, payload) => plazaAction(who(kind), { classId: CLASS, ...payload });

before(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(response.ok, true);
  const batch = db.batch();
  // 처음에는 광장이 꺼져 있습니다(기본값)
  batch.set(db.doc(`classes/${CLASS}`), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc("users/plz-a"), { role: "student", realName: "김하나", studentId: "30101", displayName: "익명 이름" });
  batch.set(db.doc("users/plz-b"), { role: "student", realName: "이두리", studentId: "30102" });
  batch.set(db.doc("users/plz-out"), { role: "student", realName: "반 밖 학생", studentId: "30199" });
  batch.set(db.doc("users/plz-teacher"), { role: "teacher", realName: "담임 교사" });
  batch.set(db.doc("users/plz-other-teacher"), { role: "teacher", realName: "옆 반 교사" });
  batch.set(db.doc(`memberships/${ids.a}_${CLASS}`), { uid: ids.a, classId: CLASS });
  batch.set(db.doc(`memberships/${ids.b}_${CLASS}`), { uid: ids.b, classId: CLASS });
  await batch.commit();
});
after(async () => { await deleteApp(seedApp); });

test("광장을 켜기 전에 쓴 발자국은 도장이 없고 사본도 만들지 않는다", async () => {
  await send("a", "plz-book-0001", { type: "addBook", title: "바람의 도서관", author: "지은이", totalPages: 40 });
  const saved = await send("a", "plz-log-00001", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 1, endPage: 10, notes: "광장 전에 쓴 비공개 발자국" });
  assert.equal(saved.state.logs[0].plaza, undefined);
  assert.equal(await shelf("a"), undefined);
  assert.equal(await bookDoc("a", "plz-book-0001"), undefined);
  // 꺼 둔 반에서는 댓글도 못 답니다
  await assert.rejects(() => act("b", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "안녕", requestId: "plz-cmt-off-01" }), (e) => e.code === "reading/plaza-disabled");
});

test("광장을 켠 뒤에 쓴 발자국은 반 친구에게 보이는 사본으로 나간다", async () => {
  await db.doc(`classes/${CLASS}`).update({ plazaEnabled: true });
  const saved = await send("a", "plz-log-00002", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 11, endPage: 20, notes: "함께 읽고 싶은 장면" });
  assert.equal(saved.state.logs.find((l) => l.id === "plz-log-00002").plaza, true);
  const s = await shelf("a");
  assert.equal(s.uid, ids.a);
  assert.equal(s.name, "김하나");
  assert.equal(s.studentId, "30101");
  assert.equal(s.books.length, 1);
  assert.deepEqual([s.books[0].id, s.books[0].place, s.books[0].logs, s.books[0].title], ["plz-book-0001", "stall", 1, "바람의 도서관"]);
  assert.equal(s.books[0].excerpt, "함께 읽고 싶은 장면");
  const b = await bookDoc("a", "plz-book-0001");
  assert.equal(b.place, "stall");
  assert.equal(b.name, "김하나");
  assert.deepEqual(b.logs.map((l) => l.notes), ["함께 읽고 싶은 장면"]);
  // 켜기 전에 쓴 글 · 익명 이름 · 반 id 같은 서재 안쪽 칸은 사본에 없다
  const all = JSON.stringify([s, b]);
  assert.equal(all.includes("광장 전에 쓴 비공개 발자국"), false);
  assert.equal(all.includes("익명 이름"), false);
  assert.equal("classId" in b.logs[0], false);
});

test("고치기 · 지우기 · 책별 숨기기가 사본에 그대로 따라간다", async () => {
  await send("a", "plz-edit-0001", { type: "updateLog", logId: "plz-log-00002", notes: "고쳐 쓴 장면" });
  assert.deepEqual((await bookDoc("a", "plz-book-0001")).logs.map((l) => l.notes), ["고쳐 쓴 장면"]);
  assert.equal((await shelf("a")).books[0].excerpt, "고쳐 쓴 장면");
  // 이 책을 광장에서 숨김 → 목록에서 빠지고 내용이 비워진다
  await send("a", "plz-hide-0001", { type: "setBookPlaza", bookId: "plz-book-0001", hidden: true });
  assert.deepEqual((await shelf("a")).books, []);
  const hidden = await bookDoc("a", "plz-book-0001");
  assert.deepEqual([hidden.place, hidden.logs, hidden.review], [null, [], null]);
  // 다시 보이기 → 돌아온다. 광장을 꺼도(이미 나간 글이 있으면) 고친 것은 따라간다
  await send("a", "plz-hide-0002", { type: "setBookPlaza", bookId: "plz-book-0001", hidden: false });
  assert.equal((await bookDoc("a", "plz-book-0001")).place, "stall");
  await db.doc(`classes/${CLASS}`).update({ plazaEnabled: false });
  const off = await send("a", "plz-log-00003", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 21, endPage: 25, notes: "꺼 둔 동안 쓴 글" });
  assert.equal(off.state.logs.find((l) => l.id === "plz-log-00003").plaza, undefined);
  await send("a", "plz-del-00001", { type: "deleteLog", logId: "plz-log-00002" });
  assert.deepEqual((await shelf("a")).books, []);
  assert.equal((await bookDoc("a", "plz-book-0001")).place, null);
  await db.doc(`classes/${CLASS}`).update({ plazaEnabled: true });
});

test("완독한 책은 꽂아야 책꽂이에 선다 — 한 권의 책과 발자국이 함께", async () => {
  await send("a", "plz-log-00004", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 26, endPage: 40, notes: "마지막 장" });
  // 앞에서 지운 11~20쪽이 비어 아직 완독이 아니다 — 읽는 중인 책으로 가판대에 선다
  assert.equal((await shelf("a")).books[0].place, "stall");
  await send("a", "plz-log-00006", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 11, endPage: 20, notes: "빠진 쪽을 채움" });
  // 완독했지만 아직 안 꽂음 — 광장에 없다
  assert.deepEqual((await shelf("a")).books, []);
  await send("a", "plz-review-01", { type: "saveReview", bookId: "plz-book-0001", text: "끝까지 읽은 한 권의 책", rating: 5 });
  assert.deepEqual((await shelf("a")).books, []);
  await send("a", "plz-shelve-01", { type: "shelveReview", bookId: "plz-book-0001", shelved: true });
  const s = await shelf("a");
  assert.deepEqual([s.books[0].place, s.books[0].rating, s.books[0].excerpt], ["shelf", 5, "끝까지 읽은 한 권의 책"]);
  const b = await bookDoc("a", "plz-book-0001");
  assert.equal(b.review.text, "끝까지 읽은 한 권의 책");
  assert.deepEqual(b.logs.map((l) => l.notes), ["빠진 쪽을 채움", "마지막 장"]);
});

test("댓글 — 같은 반 학생과 담당 교사만, 이름표는 서버가 붙이고 수를 함께 센다", async () => {
  const target = { ownerUid: ids.a, bookId: "plz-book-0001" };
  const first = await act("b", { action: "comment", ...target, text: "  나도 읽어 보고 싶어요  ", requestId: "plz-cmt-00001" });
  assert.deepEqual([first.comment.name, first.comment.studentId, first.comment.byTeacher, first.comment.text], ["이두리", "30102", false, "나도 읽어 보고 싶어요"]);
  // 같은 요청을 다시 보내도 한 번만
  const again = await act("b", { action: "comment", ...target, text: "  나도 읽어 보고 싶어요  ", requestId: "plz-cmt-00001" });
  assert.equal(again.replayed, true);
  const teacher = await act("teacher", { action: "comment", ...target, text: "꼼꼼하게 읽었네요", requestId: "plz-cmt-00002" });
  assert.deepEqual([teacher.comment.name, teacher.comment.byTeacher], ["선생님", true]);
  const saved = (await db.collection(`classes/${CLASS}/plazaComments`).get()).docs.map((d) => d.data());
  assert.equal(saved.length, 2);
  assert.ok(saved.every((c) => c.book === `${ids.a}_plz-book-0001` && c.ownerUid === ids.a));
  assert.equal(JSON.stringify(saved).includes("담임 교사"), false);
  assert.equal((await bookDoc("a", "plz-book-0001")).comments, 2);
  assert.equal((await shelf("a")).counts["plz-book-0001"], 2);
  // 책을 다시 저장해도(사본을 다시 씀) 댓글 수는 그대로
  await send("a", "plz-review-02", { type: "saveReview", bookId: "plz-book-0001", text: "고쳐 쓴 한 권의 책", rating: 4 });
  assert.equal((await bookDoc("a", "plz-book-0001")).comments, 2);
  assert.equal((await shelf("a")).counts["plz-book-0001"], 2);
  assert.equal((await bookDoc("a", "plz-book-0001")).review.text, "고쳐 쓴 한 권의 책");
  // 반 밖 학생 · 다른 반 교사 · 빈 글 · 없는 책
  await assert.rejects(() => act("out", { action: "comment", ...target, text: "끼어들기", requestId: "plz-cmt-00003" }), (e) => e.status === 403);
  await assert.rejects(() => act("other", { action: "comment", ...target, text: "끼어들기", requestId: "plz-cmt-00004" }), (e) => e.status === 403);
  await assert.rejects(() => act("b", { action: "comment", ...target, text: "   ", requestId: "plz-cmt-00005" }), (e) => e.status === 400);
  await assert.rejects(() => act("b", { action: "comment", ownerUid: ids.a, bookId: "no-such-book", text: "어디", requestId: "plz-cmt-00006" }), (e) => e.code === "reading/plaza-gone");
  // 다른 학생의 요청 식별자를 가로채 쓸 수 없다
  await assert.rejects(() => act("a", { action: "comment", ...target, text: "가로채기", requestId: "plz-cmt-00001" }), (e) => e.status === 409);
});

test("댓글 지우기 — 쓴 사람과 선생님만(책 주인은 못 지움)", async () => {
  await assert.rejects(() => act("a", { action: "deleteComment", commentId: "plz-cmt-00001" }), (e) => e.status === 403);
  assert.deepEqual(await act("b", { action: "deleteComment", commentId: "plz-cmt-00001" }), { deleted: true });
  assert.equal((await bookDoc("a", "plz-book-0001")).comments, 1);
  assert.equal((await shelf("a")).counts["plz-book-0001"], 1);
  // 이미 지운 것은 조용히
  assert.deepEqual(await act("b", { action: "deleteComment", commentId: "plz-cmt-00001" }), { deleted: false });
  // 선생님은 학생 댓글도 지운다
  await act("b", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "지워질 댓글", requestId: "plz-cmt-00007" });
  assert.deepEqual(await act("teacher", { action: "deleteComment", commentId: "plz-cmt-00007" }), { deleted: true });
  assert.equal((await bookDoc("a", "plz-book-0001")).comments, 1);
});

test("[교사] 책을 광장에서 내리면 비워지고, 학생이 다시 써도 안 올라온다 — 다시 올리면 돌아온다", async () => {
  await assert.rejects(() => act("b", { action: "block", ownerUid: ids.a, bookId: "plz-book-0001", blocked: true }), (e) => e.status === 403);
  assert.deepEqual(await act("teacher", { action: "block", ownerUid: ids.a, bookId: "plz-book-0001", blocked: true }), { blocked: ["plz-book-0001"] });
  let s = await shelf("a");
  assert.deepEqual([s.books, s.blocked], [[], ["plz-book-0001"]]);
  let b = await bookDoc("a", "plz-book-0001");
  assert.deepEqual([b.place, b.logs, b.review, b.comments], [null, [], null, 1]);
  // 내려간 책에는 댓글을 달 수 없다
  await assert.rejects(() => act("b", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "아직 있나요", requestId: "plz-cmt-00008" }), (e) => e.code === "reading/plaza-gone");
  // 학생이 고쳐 써도 내린 책은 그대로 내려가 있다
  await send("a", "plz-review-03", { type: "saveReview", bookId: "plz-book-0001", text: "또 고친 글", rating: 4 });
  s = await shelf("a");
  assert.deepEqual([s.books, s.blocked], [[], ["plz-book-0001"]]);
  assert.equal((await bookDoc("a", "plz-book-0001")).place, null);
  // 다시 올리면 지금 서재대로 돌아오고, 댓글 수도 그대로
  assert.deepEqual(await act("teacher", { action: "block", ownerUid: ids.a, bookId: "plz-book-0001", blocked: false }), { blocked: [] });
  s = await shelf("a");
  assert.equal(s.books[0].place, "shelf");
  assert.equal(s.counts["plz-book-0001"], 1);
  b = await bookDoc("a", "plz-book-0001");
  assert.deepEqual([b.place, b.review.text, b.comments], ["shelf", "또 고친 글", 1]);
});

test("사용 중지된 친구의 책에는 댓글을 달 수 없고, 사용 중지된 학생은 댓글을 못 단다", async () => {
  await db.doc("users/plz-a").update({ suspended: true });
  await assert.rejects(() => act("b", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "잘 지내?", requestId: "plz-cmt-00009" }), (e) => e.code === "reading/plaza-suspended");
  await assert.rejects(() => act("a", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "내 글", requestId: "plz-cmt-00010" }), (e) => e.code === "reading/suspended");
  await db.doc("users/plz-a").update({ suspended: false });
});

test("이름이 바뀌면 다음 저장 때 사본의 이름표도 모두 다시 적는다", async () => {
  await db.doc("users/plz-a").update({ realName: "김하늘", studentId: "30111" });
  await send("a", "plz-book-0002", { type: "addBook", title: "둘째 책", author: "지은이", totalPages: 30 });
  await send("a", "plz-log-00005", { type: "addLog", bookId: "plz-book-0002", date: today, startPage: 1, endPage: 6, notes: "둘째 책의 첫 발자국" });
  const s = await shelf("a");
  assert.deepEqual([s.name, s.studentId], ["김하늘", "30111"]);
  assert.deepEqual(s.books.map((x) => [x.id, x.place]).sort(), [["plz-book-0001", "shelf"], ["plz-book-0002", "stall"]]);
  assert.equal((await bookDoc("a", "plz-book-0001")).name, "김하늘");
  assert.equal((await bookDoc("a", "plz-book-0002")).name, "김하늘");
});
