import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getReadingHideout, saveReadingHideout } from "../../lib/server/readingService.js";
import { deriveReading, initialReadingState, kstToday } from "../../lib/reading.js";
import { HIDEOUT_DEFAULT_LAYOUT } from "../../lib/readingHideout.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const app = initializeApp({ projectId }, "hideout-api-test-seed");
const db = getFirestore(app);
const classId = "hideout-class";
const ids = { student: "hideout-student", peer: "hideout-peer", outsider: "hideout-outsider", teacher: "hideout-teacher", otherTeacher: "hideout-other-teacher", admin: "hideout-admin" };
const who = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const mainRef = db.doc(`users/${ids.student}/reading/main`);
const roomRef = db.doc(`users/${ids.student}/reading/hideout`);
const room = (layout = {}, revision = 0) => ({ version: 2, layout: { ...HIDEOUT_DEFAULT_LAYOUT, ...layout }, revision });
const payload = (value = room()) => ({ classId, room: value });
const highState = () => ({
  ...initialReadingState(),
  books: [{ id: "hideout-book", title: "이 제목은 아지트에 복사되지 않아요", author: "시험", totalPages: 10000 }],
  logs: [{ id: "hideout-log", bookId: "hideout-book", classId, date: kstToday(), startPage: 1, endPage: 10000, notes: "비공개 독서 감상" }],
});

before(async () => {
  const batch = db.batch();
  batch.set(db.doc(`classes/${classId}`), { createdBy: ids.teacher, readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true, archived: false });
  batch.set(db.doc("classes/hideout-off"), { createdBy: ids.teacher });
  batch.set(db.doc("classes/hideout-archived"), { createdBy: ids.teacher, readingEnabled: true, archived: true });
  for (const [kind, uid] of Object.entries(ids)) {
    batch.set(db.doc(`users/${uid}`), { role: kind === "admin" ? "admin" : kind.includes("Teacher") || kind === "teacher" ? "teacher" : "student", realName: kind });
  }
  for (const kind of ["student", "peer"]) batch.set(db.doc(`memberships/${ids[kind]}_${classId}`), { uid: ids[kind], classId });
  await batch.commit();
});
beforeEach(async () => {
  await db.doc(`classes/${classId}`).update({ readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true, archived: false });
  await mainRef.set({ state: initialReadingState() });
  await roomRef.delete();
});
after(async () => { await deleteApp(app); });

test("opening a basic hideout returns free base furniture and thirty fixed slots without creating a document", async () => {
  const result = await getReadingHideout(who("student"), classId);
  assert.deepEqual(result.room, room());
  assert.deepEqual(result.progress, { level: 1, earnedBadgeIds: [] });
  assert.equal(Object.keys(result.room.layout).length, 30);
  assert.equal((await roomRef.get()).exists, false);
  // 완료 단추를 바꾸지 않고 눌러도 문서를 만들거나 revision을 올리지 않습니다.
  assert.deepEqual((await saveReadingHideout(who("student"), payload())).room, room());
  assert.equal((await roomRef.get()).exists, false);
});

test("the hideout switch and its parent features block reads and writes without erasing the room", async () => {
  await roomRef.set(room({}, 3));
  for (const feature of ["hideoutEnabled", "classroomEnabled", "plazaEnabled", "readingEnabled"]) {
    await db.doc(`classes/${classId}`).update({ [feature]: false });
    try {
      const code = feature === "readingEnabled" ? "reading/disabled" : "reading/hideout-disabled";
      await assert.rejects(() => getReadingHideout(who("student"), classId), (e) => e.status === 403 && e.code === code);
      await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 3))), (e) => e.status === 403 && e.code === code);
      await assert.rejects(() => getReadingHideout(who("teacher"), classId, ids.student), (e) => e.status === 403 && e.code === code);
      assert.deepEqual((await roomRef.get()).data(), room({}, 3));
    } finally { await db.doc(`classes/${classId}`).update({ [feature]: true }); }
  }
  await db.doc(`classes/${classId}`).update({ hideoutEnabled: FieldValue.delete() });
  await assert.rejects(() => getReadingHideout(who("student"), classId), (e) => e.code === "reading/hideout-disabled");
  assert.equal((await roomRef.get()).data().revision, 3);
});

test("enabled class, actual membership, suspended status and role are enforced on every read and save", async () => {
  for (const disabled of ["hideout-off", "hideout-archived"]) {
    await assert.rejects(() => getReadingHideout(who("student"), disabled), (e) => e.code === "reading/disabled");
    await assert.rejects(() => saveReadingHideout(who("student"), { classId: disabled, room: room() }), (e) => e.code === "reading/disabled");
    await assert.rejects(() => getReadingHideout(who("admin"), disabled, ids.student), (e) => e.code === "reading/disabled");
  }
  await assert.rejects(() => getReadingHideout(who("outsider"), classId), (e) => e.status === 403);
  await assert.rejects(() => saveReadingHideout(who("outsider"), payload()), (e) => e.status === 403);
  await db.doc(`users/${ids.student}`).update({ suspended: true });
  try {
    await assert.rejects(() => getReadingHideout(who("student"), classId), (e) => e.code === "reading/suspended");
    await assert.rejects(() => saveReadingHideout(who("student"), payload()), (e) => e.code === "reading/suspended");
  } finally { await db.doc(`users/${ids.student}`).update({ suspended: false }); }
  for (const kind of ["teacher", "admin"]) {
    await assert.rejects(() => saveReadingHideout(who(kind), payload()), (e) => e.code === "reading/hideout-students-only");
  }
});

test("only the assigned teacher or admin may read a member's room; peer and nonmember targets remain private", async () => {
  assert.deepEqual((await getReadingHideout(who("teacher"), classId, ids.student)).room, room());
  assert.deepEqual((await getReadingHideout(who("admin"), classId, ids.student)).room, room());
  await assert.rejects(() => getReadingHideout(who("peer"), classId, ids.student), (e) => e.status === 403);
  await assert.rejects(() => getReadingHideout(who("otherTeacher"), classId, ids.student), (e) => e.status === 403);
  await assert.rejects(() => getReadingHideout(who("teacher"), classId, ids.outsider), (e) => e.code === "reading/not-member");
  await assert.rejects(() => getReadingHideout(who("teacher"), classId), (e) => e.code === "reading/hideout-students-only");
  await assert.rejects(() => getReadingHideout(who("student"), classId, "../other"), (e) => e.status === 400);
});

test("orphan and non-student memberships cannot turn into teacher-viewable rooms", async () => {
  const orphan = "hideout-orphan";
  const orphanRef = db.doc(`memberships/${orphan}_${classId}`);
  const peerRef = db.doc(`users/${ids.peer}`);
  await orphanRef.set({ uid: orphan, classId });
  await peerRef.update({ role: "teacher" });
  try {
    await assert.rejects(() => getReadingHideout(who("teacher"), classId, orphan), (e) => e.code === "reading/not-member");
    await assert.rejects(() => getReadingHideout(who("admin"), classId, ids.peer), (e) => e.code === "reading/not-member");
  } finally {
    await orphanRef.delete();
    await peerRef.update({ role: "student" });
  }
});

test("saving unlocked decor stores only slot IDs and leaves reading records, XP and rankings unchanged", async () => {
  const state = highState();
  const summary = deriveReading(state);
  assert.equal(summary.level, 10);
  assert.ok(summary.earnedBadges.length >= 3);
  await mainRef.set({ state });
  const memberRef = db.doc(`classes/${classId}/readingMembers/${ids.student}`);
  const marker = { uid: ids.student, totalXp: summary.xp, level: summary.level, untouched: "ranking projection" };
  await memberRef.set(marker);
  const next = room({ desk: "desk-forest", rug: "rug-starlight", shelf: "shelf-forest", lamp: "lamp-starlight", plant: "plant-starlight", wall: "wall-starlight", bed: "bed-starlight" });
  const saved = await saveReadingHideout(who("student"), payload(next));
  assert.deepEqual(saved.room, { ...next, revision: 1 });
  const stored = (await roomRef.get()).data();
  assert.deepEqual(Object.keys(stored).sort(), ["layout", "revision", "updatedAt", "version"]);
  assert.deepEqual(stored.layout, next.layout);
  assert.ok(typeof stored.updatedAt.toMillis() === "number");
  assert.deepEqual((await mainRef.get()).data(), { state });
  assert.deepEqual((await memberRef.get()).data(), marker);
  assert.equal(JSON.stringify(saved).includes(state.books[0].title), false);
  assert.equal(JSON.stringify(saved).includes(state.logs[0].notes), false);
  const before = (await roomRef.get()).updateTime.toMillis();
  const same = await saveReadingHideout(who("student"), payload(saved.room));
  assert.equal(same.room.revision, 1);
  assert.equal((await roomRef.get()).updateTime.toMillis(), before);
});

test("the server rejects locked items and forged XP, uid, URLs, slot names and versions", async () => {
  await assert.rejects(() => saveReadingHideout(who("student"), payload(room({ bed: "bed-starlight" }))), (e) => e.code === "reading/hideout-locked");
  for (const invalid of [
    { ...payload(), uid: ids.peer },
    { ...payload(), xp: 999999 },
    payload({ ...room(), level: 10, earnedBadges: ["level_3"] }),
    payload({ ...room(), revision: -1 }),
    payload({ ...room(), revision: 0.5 }),
    payload({ ...room(), version: 1 }),
    payload(room({ desk: "https://example.com/image.png" })),
    payload(room({ desk: "bed-linen" })),
    payload({ ...room(), layout: { ...room().layout, extra: "bed-linen" } }),
  ]) await assert.rejects(() => saveReadingHideout(who("student"), invalid), (e) => e.status === 400);
  assert.equal((await roomRef.get()).exists, false);
});

test("concurrent edits use revisions so one tab cannot overwrite a newer room", async () => {
  await mainRef.set({ state: highState() });
  const result = await Promise.allSettled([
    saveReadingHideout(who("student"), payload(room({ rug: "rug-starlight" }))),
    saveReadingHideout(who("student"), payload(room({ desk: "desk-forest" }))),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const failure = result.find((r) => r.status === "rejected").reason;
  assert.equal(failure.code, "reading/hideout-conflict");
  assert.equal(failure.status, 409);
  const loaded = await getReadingHideout(who("student"), classId);
  assert.equal(loaded.room.revision, 1);
  await assert.rejects(() => saveReadingHideout(who("student"), payload(room())), (e) => e.code === "reading/hideout-conflict");
});

test("record corrections safely fall back to basic decor without writing on load", async () => {
  const invalidStored = room({ desk: "desk-forest", bed: "bed-starlight" }, 4);
  await roomRef.set(invalidStored);
  const loaded = await getReadingHideout(who("student"), classId);
  assert.deepEqual(loaded.room, room({}, 4));
  assert.deepEqual((await roomRef.get()).data(), invalidStored);
  assert.equal(loaded.progress.level, 1);
});

test("removing membership closes a previously saved personal room without deleting it", async () => {
  await roomRef.set(room({}, 2));
  const memberRef = db.doc(`memberships/${ids.student}_${classId}`);
  await memberRef.delete();
  try {
    await assert.rejects(() => getReadingHideout(who("student"), classId), (e) => e.status === 403);
    await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 2))), (e) => e.status === 403);
    await assert.rejects(() => getReadingHideout(who("teacher"), classId, ids.student), (e) => e.code === "reading/not-member");
    assert.equal((await roomRef.get()).data().revision, 2);
  } finally { await memberRef.set({ uid: ids.student, classId }); }
});
