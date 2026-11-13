// 책 광장 — 서버가 저장할 때 맞추는 공유 사본과 댓글 · 내리기(lib/server/readingService.js).
// **광장을 켠 반에서는 그 반에서 쓴 독서 발자국 · 한 권의 책이 모두 반 친구에게 보입니다**(선생님 결정 — 학생이 고르는
// 것이 없음 · 켜기 전에 쓴 글도 켜면 반 전체를 한 번 맞춰 모두 공개). 꺼 둔 반의 글은 사본으로 나가지 않습니다.
// Auth · Firestore 에뮬레이터에서 진짜 트랜잭션으로 봅니다(tests/server/README.md).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { mutateReading, plazaAction } from "../../lib/server/readingService.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const seedApp = initializeApp({ projectId }, "plaza-api-test-seed");
const db = getFirestore(seedApp);
const CLASS = "plz-class";
const NEVER = "plz-class-never";
const LEASE = "plz-class-lease";
const ids = { a: "plz-a", b: "plz-b", c: "plz-c", ghost: "plz-ghost", out: "plz-out", teacher: "plz-teacher", other: "plz-other-teacher" };
const who = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const send = (kind, requestId, action, classId = CLASS) => mutateReading(who(kind), { classId, requestId, action });
const shelf = async (kind, classId = CLASS) => (await db.doc(`classes/${classId}/plazaShelves/${ids[kind]}`).get()).data();
const bookDoc = async (kind, bookId, classId = CLASS) => (await db.doc(`classes/${classId}/plazaBooks/${ids[kind]}_${bookId}`).get()).data();
const classDoc = async (classId = CLASS) => (await db.doc(`classes/${classId}`).get()).data();
const act = (kind, payload) => plazaAction(who(kind), { classId: CLASS, ...payload });

before(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  assert.equal(response.ok, true);
  const batch = db.batch();
  // 처음에는 광장이 꺼져 있습니다(기본값)
  batch.set(db.doc(`classes/${CLASS}`), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  // 광장을 한 번도 켜지 않는 반(맨 아래 시험)
  batch.set(db.doc(`classes/${NEVER}`), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc("users/plz-a"), { role: "student", realName: "김하나", studentId: "30101", displayName: "익명 이름" });
  batch.set(db.doc("users/plz-b"), { role: "student", realName: "이두리", studentId: "30102" });
  batch.set(db.doc("users/plz-c"), { role: "student", realName: "박세찬", studentId: "30103" });
  batch.set(db.doc("users/plz-out"), { role: "student", realName: "반 밖 학생", studentId: "30199" });
  batch.set(db.doc("users/plz-teacher"), { role: "teacher", realName: "담임 교사" });
  batch.set(db.doc("users/plz-other-teacher"), { role: "teacher", realName: "옆 반 교사" });
  batch.set(db.doc(`memberships/${ids.a}_${CLASS}`), { uid: ids.a, classId: CLASS });
  batch.set(db.doc(`memberships/${ids.b}_${CLASS}`), { uid: ids.b, classId: CLASS });
  batch.set(db.doc(`memberships/${ids.c}_${CLASS}`), { uid: ids.c, classId: CLASS });
  batch.set(db.doc(`memberships/${ids.a}_${NEVER}`), { uid: ids.a, classId: NEVER });
  // 맞추던 서버가 도중에 끊긴 반(맨 아래 시험) — 처음에는 광장이 꺼져 있고, 곧 지워질 계정이 하나 있습니다
  batch.set(db.doc(`classes/${LEASE}`), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc("users/plz-ghost"), { role: "student", realName: "지워질 학생", studentId: "30198" });
  batch.set(db.doc(`memberships/${ids.b}_${LEASE}`), { uid: ids.b, classId: LEASE });
  batch.set(db.doc(`memberships/${ids.ghost}_${LEASE}`), { uid: ids.ghost, classId: LEASE });
  await batch.commit();
});
after(async () => { await deleteApp(seedApp); });

const notesOf = (doc) => doc.logs.map((l) => l.notes);

test("광장을 켜지 않은 반 — 쓴 글은 사본으로 나가지 않는다(본인과 선생님만 봄)", async () => {
  await send("a", "plz-book-0001", { type: "addBook", title: "바람의 도서관", author: "지은이", totalPages: 40 });
  const saved = await send("a", "plz-log-00001", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 1, endPage: 10, notes: "광장 전에 쓴 발자국" });
  // 발자국에 공개 도장을 찍지 않는다(학생이 고르던 때의 표시 — 걷음)
  assert.equal("plaza" in saved.state.logs[0], false);
  await send("b", "plz-bookb-001", { type: "addBook", title: "두리의 책", author: "지은이", totalPages: 20 });
  await send("b", "plz-logb-0001", { type: "addLog", bookId: "plz-bookb-001", date: today, startPage: 1, endPage: 5, notes: "두리의 옛 발자국" });
  assert.equal(await shelf("a"), undefined);
  assert.equal(await shelf("b"), undefined);
  assert.equal(await bookDoc("a", "plz-book-0001"), undefined);
  // 꺼 둔 반에서는 댓글도 못 달고, 사본을 맞춰 달라는 부탁도 받지 않는다
  await assert.rejects(() => act("b", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "안녕", requestId: "plz-cmt-off-01" }), (e) => e.code === "reading/plaza-disabled");
  await assert.rejects(() => act("teacher", { action: "sync" }), (e) => e.code === "reading/plaza-disabled");
  assert.equal("plazaSynced" in (await classDoc()), false);
});

test("광장을 켜면 켜기 전에 쓴 글도 모두 공개된다 — 반의 사본을 한 번 통째로 맞춘다(여럿이 불러도 한 번만)", async () => {
  await db.doc(`classes/${CLASS}`).update({ plazaEnabled: true });
  // 아직 맞추기 전 — 저장한 학생의 사본에는 그 학생이 예전에 쓴 글까지 모두 실린다
  await send("b", "plz-logb-0002", { type: "addLog", bookId: "plz-bookb-001", date: today, startPage: 6, endPage: 9, notes: "켠 뒤에 쓴 발자국" });
  assert.deepEqual(notesOf(await bookDoc("b", "plz-bookb-001")), ["켠 뒤에 쓴 발자국", "두리의 옛 발자국"]);
  // 저장하지 않은 학생(a)의 글은 아직 없다 → 반 전체 맞추기
  assert.equal(await shelf("a"), undefined);
  const results = await Promise.all([act("a", { action: "sync" }), act("teacher", { action: "sync" }), act("b", { action: "sync" })]);
  assert.equal(results.filter((r) => r.ran).length, 1, "한 요청만 맞춘다");
  assert.deepEqual(results.find((r) => r.ran), { synced: true, ran: true, members: 3 });
  assert.equal((await classDoc()).plazaSynced, 2);
  const mark = (await db.doc(`classes/${CLASS}/readingRank/plaza`).get()).data();
  assert.deepEqual([mark.rule, mark.members, "leaseUntil" in mark], [2, 3, false]);
  const s = await shelf("a");
  assert.deepEqual([s.uid, s.name, s.studentId, s.rule, s.books.length], [ids.a, "김하나", "30101", 2, 1]);
  assert.deepEqual([s.books[0].id, s.books[0].place, s.books[0].logs, s.books[0].title, s.books[0].excerpt], ["plz-book-0001", "stall", 1, "바람의 도서관", "광장 전에 쓴 발자국"]);
  const b = await bookDoc("a", "plz-book-0001");
  assert.deepEqual([b.place, b.name, notesOf(b)], ["stall", "김하나", ["광장 전에 쓴 발자국"]]);
  // 익명 이름 · 반 id 같은 서재 안쪽 칸은 사본에 없다
  const all = JSON.stringify([s, b]);
  assert.equal(all.includes("익명 이름"), false);
  assert.equal("classId" in b.logs[0], false);
  // 글이 없는 학생은 빈 장을 만들지 않는다
  assert.equal(await shelf("c"), undefined);
  // 이미 맞춘 반 — 다시 불러도 읽기만 하고 돌아온다. 반 밖 학생 · 다른 반 교사는 부를 수 없다
  assert.deepEqual(await act("b", { action: "sync" }), { synced: true, ran: false });
  await assert.rejects(() => act("out", { action: "sync" }), (e) => e.status === 403);
  await assert.rejects(() => act("other", { action: "sync" }), (e) => e.status === 403);
});

test("저장할 때마다 사본이 따라간다 — 고치기 · 지우기, 광장을 꺼 둔 동안에 쓴 글까지", async () => {
  const saved = await send("a", "plz-log-00002", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 11, endPage: 20, notes: "함께 읽고 싶은 장면" });
  assert.equal("plaza" in saved.state.logs.find((l) => l.id === "plz-log-00002"), false);
  assert.deepEqual([(await shelf("a")).books[0].logs, (await shelf("a")).books[0].excerpt], [2, "함께 읽고 싶은 장면"]);
  await send("a", "plz-edit-0001", { type: "updateLog", logId: "plz-log-00002", notes: "고쳐 쓴 장면" });
  assert.deepEqual(notesOf(await bookDoc("a", "plz-book-0001")), ["고쳐 쓴 장면", "광장 전에 쓴 발자국"]);
  assert.equal((await shelf("a")).books[0].excerpt, "고쳐 쓴 장면");
  // 학생이 고르던 요청(옛 화면)은 걷었다 — 숨기기 · 빼기는 까닭을 알려 거절하고, 보이기 · 꽂기는 아무 일 없이 받는다
  await assert.rejects(() => send("a", "plz-hide-0001", { type: "setBookPlaza", bookId: "plz-book-0001", hidden: true }), (e) => e.status === 400 && /모두 함께 읽어요/.test(e.message));
  await assert.rejects(() => send("a", "plz-unshelf-1", { type: "shelveReview", bookId: "plz-book-0001", shelved: false }), (e) => e.status === 400);
  await send("a", "plz-hide-0002", { type: "setBookPlaza", bookId: "plz-book-0001", hidden: false });
  assert.equal((await bookDoc("a", "plz-book-0001")).place, "stall");
  // 광장을 꺼 둔 동안에도(한 번 맞춘 반) 사본은 그대로 따라간다 — 다시 켰을 때 빠진 글 · 지운 글이 없게
  await db.doc(`classes/${CLASS}`).update({ plazaEnabled: false });
  await send("a", "plz-log-00003", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 21, endPage: 25, notes: "꺼 둔 동안 쓴 글" });
  await send("a", "plz-del-00001", { type: "deleteLog", logId: "plz-log-00002" });
  assert.deepEqual(notesOf(await bookDoc("a", "plz-book-0001")), ["꺼 둔 동안 쓴 글", "광장 전에 쓴 발자국"]);
  // 꺼 둔 동안 처음 글을 쓴 학생의 사본도 만들어 둔다
  await send("c", "plz-bookc-001", { type: "addBook", title: "세찬의 책", author: "지은이", totalPages: 30 });
  assert.equal(await shelf("c"), undefined, "글이 없는 책만으로는 장을 만들지 않는다");
  await send("c", "plz-logc-0001", { type: "addLog", bookId: "plz-bookc-001", date: today, startPage: 1, endPage: 6, notes: "세찬의 첫 발자국" });
  assert.deepEqual((await shelf("c")).books.map((x) => [x.id, x.place]), [["plz-bookc-001", "stall"]]);
  // 꺼 둔 동안에는 댓글을 달 수 없다(반 친구는 규칙으로도 사본을 못 읽음 — tests/rules/plaza.test.mjs)
  await assert.rejects(() => act("b", { action: "comment", ownerUid: ids.a, bookId: "plz-book-0001", text: "보이나요", requestId: "plz-cmt-off-02" }), (e) => e.code === "reading/plaza-disabled");
  // 다시 켜면 그대로 모두 보인다 — 다시 맞출 것이 없다
  await db.doc(`classes/${CLASS}`).update({ plazaEnabled: true });
  assert.deepEqual(await act("teacher", { action: "sync" }), { synced: true, ran: false });
});

test("완독한 책은 책꽂이에 선다 — 한 권의 책을 쓰기 전에도(꽂는 단추가 없음), 쓰면 그 글이 함께", async () => {
  await send("a", "plz-log-00004", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 26, endPage: 40, notes: "마지막 장" });
  // 앞에서 지운 11~20쪽이 비어 아직 완독이 아니다 — 읽는 중인 책으로 가판대에 선다
  assert.equal((await shelf("a")).books[0].place, "stall");
  await send("a", "plz-log-00006", { type: "addLog", bookId: "plz-book-0001", date: today, startPage: 11, endPage: 20, notes: "빠진 쪽을 채움" });
  // 완독 — 한 권의 책을 아직 안 썼어도 책꽂이로 옮겨 가고 발자국이 그대로 보인다
  let s = await shelf("a");
  assert.deepEqual([s.books[0].place, s.books[0].rating, s.books[0].excerpt, s.books[0].logs], ["shelf", null, "빠진 쪽을 채움", 4]);
  assert.equal((await bookDoc("a", "plz-book-0001")).review, null);
  // 한 권의 책을 쓰면 곧바로 보인다(옛 화면이 함께 보내는 shelved: false는 읽지 않음)
  const saved = await send("a", "plz-review-01", { type: "saveReview", bookId: "plz-book-0001", text: "끝까지 읽은 한 권의 책", rating: 5, shelved: false });
  assert.equal("shelved" in saved.state.reviews[0], false);
  s = await shelf("a");
  assert.deepEqual([s.books[0].place, s.books[0].rating, s.books[0].excerpt], ["shelf", 5, "끝까지 읽은 한 권의 책"]);
  const b = await bookDoc("a", "plz-book-0001");
  assert.equal(b.review.text, "끝까지 읽은 한 권의 책");
  assert.deepEqual(notesOf(b), ["빠진 쪽을 채움", "마지막 장", "꺼 둔 동안 쓴 글", "광장 전에 쓴 발자국"]);
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

test("광장을 한 번도 켜지 않은 반 — 저장해도 사본을 만들지 않고, 이미 있는 사본(옛 기준)은 꺼 둔 동안에도 맞춘다", async () => {
  await send("a", "plz-never-bk01", { type: "addBook", title: "다른 반의 책", author: "지은이", totalPages: 30 }, NEVER);
  await send("a", "plz-never-lg01", { type: "addLog", bookId: "plz-never-bk01", date: today, startPage: 1, endPage: 5, notes: "광장이 없는 반의 발자국" }, NEVER);
  assert.equal(await shelf("a", NEVER), undefined);
  assert.equal(await bookDoc("a", "plz-never-bk01", NEVER), undefined);
  // 이 반에서 쓴 글은 다른 반의 사본에 섞이지 않는다
  assert.equal(JSON.stringify(await shelf("a")).includes("다른 반의 책"), false);
  // 학생이 고르던 때(기준 1)에 나간 사본이 남아 있는 반 — 광장이 꺼져 있고 통째로 맞춘 적이 없어도, 그 학생이 고치면 따라간다
  await db.doc(`classes/${NEVER}/plazaShelves/${ids.a}`).set({ uid: ids.a, name: "옛 이름", studentId: "30101", rule: 1, blocked: [],
    books: [{ id: "plz-never-bk01", place: "stall", title: "다른 반의 책", logs: 1, excerpt: "옛 글" }] });
  await db.doc(`classes/${NEVER}/plazaBooks/${ids.a}_plz-never-bk01`).set({ uid: ids.a, bookId: "plz-never-bk01", place: "stall", logs: [{ id: "x", notes: "옛 글" }], logCount: 1, review: null, comments: 3 });
  await send("a", "plz-never-ed01", { type: "updateLog", logId: "plz-never-lg01", notes: "고쳐 쓴 발자국" }, NEVER);
  const s = await shelf("a", NEVER);
  assert.deepEqual([s.rule, s.books[0].excerpt], [2, "고쳐 쓴 발자국"]);
  const b = await bookDoc("a", "plz-never-bk01", NEVER);
  assert.deepEqual([notesOf(b), b.comments], [["고쳐 쓴 발자국"], 3]);
  // 지우면 사본도 비워진다(지운 글이 남지 않게)
  await send("a", "plz-never-dl01", { type: "deleteLog", logId: "plz-never-lg01" }, NEVER);
  assert.deepEqual((await shelf("a", NEVER)).books, []);
  assert.deepEqual([(await bookDoc("a", "plz-never-bk01", NEVER)).place, (await bookDoc("a", "plz-never-bk01", NEVER)).logs], [null, []]);
  assert.equal("plazaSynced" in (await classDoc(NEVER)), false);
});

test("반 전체 맞추기 — 다른 요청이 맞추는 중이면 맡기고, 표시가 풀리면 이어서 맞춘다 · 프로필이 없는 소속은 건너뛴다", async () => {
  const mark = db.doc(`classes/${LEASE}/readingRank/plaza`);
  const sync = (kind) => plazaAction(who(kind), { classId: LEASE, action: "sync" });
  // 광장을 켜기 전에 쓴 글
  await send("b", "plz-lease-bk01", { type: "addBook", title: "켜기 전의 책", author: "지은이", totalPages: 30 }, LEASE);
  await send("b", "plz-lease-lg01", { type: "addLog", bookId: "plz-lease-bk01", date: today, startPage: 1, endPage: 7, notes: "켜기 전의 발자국" }, LEASE);
  await send("ghost", "plz-ghost-bk01", { type: "addBook", title: "떠난 학생의 책", author: "지은이", totalPages: 30 }, LEASE);
  await send("ghost", "plz-ghost-lg01", { type: "addLog", bookId: "plz-ghost-bk01", date: today, startPage: 1, endPage: 7, notes: "떠난 학생의 발자국" }, LEASE);
  await db.doc("users/plz-ghost").delete();
  await db.doc(`classes/${LEASE}`).update({ plazaEnabled: true });
  // 다른 요청이 맞추는 중(표시가 살아 있음) — 맡기고 돌아온다
  await mark.set({ leaseUntil: Timestamp.fromMillis(Date.now() + 20000) });
  assert.deepEqual(await sync("b"), { synced: false, ran: false });
  assert.equal(await shelf("b", LEASE), undefined);
  assert.equal("plazaSynced" in (await classDoc(LEASE)), false);
  // 맞추던 서버가 도중에 끊겨 표시만 남았다가 풀린 뒤 — 다음 부탁이 이어서 맞춘다
  await mark.set({ leaseUntil: Timestamp.fromMillis(Date.now() - 1000) });
  assert.deepEqual(await sync("teacher"), { synced: true, ran: true, members: 2 });
  assert.deepEqual((await shelf("b", LEASE)).books.map((x) => [x.id, x.place, x.excerpt]), [["plz-lease-bk01", "stall", "켜기 전의 발자국"]]);
  // 다른 반(CLASS)에서 쓴 글은 이 반의 사본에 섞이지 않는다
  assert.equal(JSON.stringify(await shelf("b", LEASE)).includes("두리의 책"), false);
  // 계정이 지워진 소속 — 이름 없는 글을 새로 내걸지 않는다
  assert.equal(await shelf("ghost", LEASE), undefined);
  assert.equal(await bookDoc("ghost", "plz-ghost-bk01", LEASE), undefined);
  assert.equal((await classDoc(LEASE)).plazaSynced, 2);
  assert.equal("leaseUntil" in (await mark.get()).data(), false);
});
