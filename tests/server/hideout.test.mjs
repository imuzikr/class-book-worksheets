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
const room = (layout = {}, revision = 0, arrange = {}) => ({ version: 2, layout: { ...HIDEOUT_DEFAULT_LAYOUT, ...layout }, arrange, revision });
const payload = (value = room()) => ({ classId, room: value });
const highState = () => ({
  ...initialReadingState(),
  books: [{ id: "hideout-book", title: "이 제목은 아지트에 복사되지 않아요", author: "시험", totalPages: 10000 }],
  logs: [{ id: "hideout-log", bookId: "hideout-book", classId, date: kstToday(), startPage: 1, endPage: 10000, notes: "비공개 독서 감상" }],
});

before(async () => {
  const batch = db.batch();
  batch.set(db.doc(`classes/${classId}`), { createdBy: ids.teacher, readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true, archived: false });
  batch.set(db.doc("classes/hideout-second"), { createdBy: ids.teacher, readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true, archived: false });
  batch.set(db.doc("classes/hideout-foreign"), { createdBy: ids.otherTeacher, readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true, archived: false });
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
  await Promise.all(["teacher", "admin"].flatMap((kind) => [
    db.doc(`users/${ids[kind]}/reading/hideout`).delete(),
    db.doc(`users/${ids[kind]}/reading/main`).delete(),
    db.doc(`classes/${classId}/readingMembers/${ids[kind]}`).delete(),
  ]));
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
      for (const kind of ["teacher", "admin"]) {
        await assert.rejects(() => getReadingHideout(who(kind), classId), (e) => e.status === 403 && e.code === code);
        await assert.rejects(() => saveReadingHideout(who(kind), payload()), (e) => e.status === 403 && e.code === code);
      }
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
  await assert.rejects(() => getReadingHideout(who("otherTeacher"), classId), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => saveReadingHideout(who("otherTeacher"), payload()), (e) => e.code === "reading/forbidden");
});

test("only the assigned teacher or admin may read a member's room; peer and nonmember targets remain private", async () => {
  assert.deepEqual((await getReadingHideout(who("teacher"), classId, ids.student)).room, room());
  assert.deepEqual((await getReadingHideout(who("admin"), classId, ids.student)).room, room());
  await assert.rejects(() => getReadingHideout(who("peer"), classId, ids.student), (e) => e.status === 403);
  await assert.rejects(() => getReadingHideout(who("otherTeacher"), classId, ids.student), (e) => e.status === 403);
  await assert.rejects(() => getReadingHideout(who("teacher"), classId, ids.outsider), (e) => e.code === "reading/not-member");
  assert.equal((await getReadingHideout(who("teacher"), classId)).progress.teacher, true);
  await assert.rejects(() => getReadingHideout(who("student"), classId, "../other"), (e) => e.status === 400);
});

test("teachers and admins decorate only their own private room without reading XP or rank documents", async () => {
  const studentBefore = (await mainRef.get()).data();
  await roomRef.set(room({}, 3));
  for (const kind of ["teacher", "admin"]) {
    const ownRoom = db.doc(`users/${ids[kind]}/reading/hideout`);
    const ownMain = db.doc(`users/${ids[kind]}/reading/main`);
    const ownRank = db.doc(`classes/${classId}/readingMembers/${ids[kind]}`);
    const first = await getReadingHideout(who(kind), classId);
    assert.deepEqual(first.room, room());
    assert.deepEqual(first.progress, { level: 1, earnedBadgeIds: [], teacher: true });
    assert.equal((await ownRoom.get()).exists, false, "opening does not create a room");
    assert.deepEqual((await saveReadingHideout(who(kind), payload(first.room))).room, first.room);
    assert.equal((await ownRoom.get()).exists, false, "an unchanged save does not create a room");
    const next = room({ "book-trophy": "book-trophy-forest", desk: "desk-forest", bed: "bed-starlight" });
    const saved = await saveReadingHideout(who(kind), payload(next));
    assert.deepEqual(saved.room, { ...next, revision: 1 });
    assert.deepEqual(saved.progress, first.progress);
    assert.deepEqual((await getReadingHideout(who(kind), classId)).room, saved.room);
    assert.deepEqual(Object.keys((await ownRoom.get()).data()).sort(), ["arrange", "layout", "revision", "updatedAt", "version"]);
    assert.equal((await ownMain.get()).exists, false, "decor access never creates a reading ledger");
    assert.equal((await ownRank.get()).exists, false, "decor access never writes a ranking snapshot");
    await assert.rejects(() => saveReadingHideout(who(kind), { ...payload(saved.room), uid: ids.student }), (e) => e.status === 400);
    await assert.rejects(() => saveReadingHideout(who(kind), payload({ ...saved.room, teacher: true })), (e) => e.status === 400);
  }
  assert.deepEqual((await mainRef.get()).data(), studentBefore);
  assert.deepEqual((await roomRef.get()).data(), room({}, 3));
  const studentView = await getReadingHideout(who("teacher"), classId, ids.student);
  assert.equal(studentView.progress.teacher, undefined, "teacher student-view uses the student's own eligibility");
  assert.equal(studentView.progress.level, 1);
  await assert.rejects(() => saveReadingHideout(who("student"), payload(room({ "book-trophy": "book-trophy-forest" }))), (e) => e.code === "reading/hideout-locked");
});

test("a teacher room is shared across owned enabled classes while foreign and archived classes deny access", async () => {
  const saved = await saveReadingHideout(who("teacher"), payload(room({ "book-trophy": "book-trophy-forest" })));
  assert.deepEqual((await getReadingHideout(who("teacher"), "hideout-second")).room, saved.room);
  const next = await saveReadingHideout(who("teacher"), { classId: "hideout-second", room: { ...saved.room, layout: { ...saved.room.layout, rug: "rug-starlight" } } });
  assert.deepEqual((await getReadingHideout(who("teacher"), classId)).room, next.room);
  await assert.rejects(() => getReadingHideout(who("teacher"), "hideout-foreign"), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => saveReadingHideout(who("teacher"), { classId: "hideout-foreign", room: next.room }), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => getReadingHideout(who("teacher"), "hideout-archived"), (e) => e.code === "reading/disabled");
  await assert.rejects(() => saveReadingHideout(who("teacher"), { classId: "hideout-archived", room: next.room }), (e) => e.code === "reading/disabled");
  assert.deepEqual((await getReadingHideout(who("teacher"), classId)).room, next.room);
});

test("teacher revisions prevent stale edits and role changes are revalidated on each request", async () => {
  const saved = await saveReadingHideout(who("teacher"), payload(room({ "book-trophy": "book-trophy-forest" })));
  await assert.rejects(() => saveReadingHideout(who("teacher"), payload(room({ rug: "rug-starlight" }))), (e) => e.code === "reading/hideout-conflict");
  const teacherProfile = db.doc(`users/${ids.teacher}`);
  await teacherProfile.update({ role: "student" });
  try {
    await assert.rejects(() => getReadingHideout(who("teacher"), classId), (e) => e.code === "reading/forbidden");
    await assert.rejects(() => saveReadingHideout(who("teacher"), payload(saved.room)), (e) => e.code === "reading/forbidden");
  } finally { await teacherProfile.update({ role: "teacher" }); }
  assert.deepEqual((await getReadingHideout(who("teacher"), classId)).room, saved.room);
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
  assert.deepEqual(Object.keys(stored).sort(), ["arrange", "layout", "revision", "updatedAt", "version"]);
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

test("방 주인의 누적 경험치가 방과 함께 옵니다 — 선생님이 학생의 방을 볼 때도 펫이 자란 만큼 그리게", async () => {
  await mainRef.set({ state: highState() });
  const expected = Math.round(deriveReading(highState(), new Date()).xp);
  assert.ok(expected > 0);
  // 선생님이 학생의 방을 볼 때 — 화면에 그 학생의 책 봄 요약이 없어 이 값이 펫의 단계 · 경험치의 바탕입니다
  const studentView = await getReadingHideout(who("teacher"), classId, ids.student);
  assert.equal(studentView.petGrowthXp, expected);
  assert.equal((await getReadingHideout(who("admin"), classId, ids.student)).petGrowthXp, expected);
  assert.equal((await getReadingHideout(who("student"), classId)).petGrowthXp, expected);
  // 숫자 하나뿐 — 책 제목 · 감상은 아지트 응답 어디에도 없습니다
  assert.equal(JSON.stringify(studentView).includes("비공개 독서 감상"), false);
  assert.equal(JSON.stringify(studentView).includes("이 제목은 아지트에 복사되지 않아요"), false);
  // 선생님 본인의 방에는 펫이 없어 싣지 않습니다
  assert.equal("petGrowthXp" in (await getReadingHideout(who("teacher"), classId)), false);
});

test("배치(아지트 2단계) — 자리 · 뒤집기 · 돌리기를 저장하고 다시 읽으며, 문제가 있으면 그 까닭으로 거절하고, 배치를 모르는 옛 요청은 옮긴 자리를 지우지 않음", async () => {
  const arrange = { desk: { x: 400, y: 880, flip: true, turn: true }, plant: { x: 600, y: 640 } };
  const saved = await saveReadingHideout(who("student"), payload(room({}, 0, arrange)));
  assert.equal(saved.room.revision, 1);
  assert.deepEqual(saved.room.arrange, arrange);
  assert.deepEqual((await roomRef.get()).data().arrange, arrange);
  assert.deepEqual((await getReadingHideout(who("student"), classId)).room.arrange, arrange);
  // 선생님의 읽기 전용 보기에도 같은 배치
  assert.deepEqual((await getReadingHideout(who("teacher"), classId, ids.student)).room.arrange, arrange);
  // 배치만 바꿔도 저장 · 같은 것을 다시 보내면 쓰지 않음
  const moved = await saveReadingHideout(who("student"), payload(room({}, 1, { ...arrange, plant: { x: 640, y: 640 } })));
  assert.equal(moved.room.revision, 2);
  assert.equal((await saveReadingHideout(who("student"), payload(moved.room))).room.revision, 2);
  // 포털을 가림 · 모르는 소품 · 정수가 아닌 자리 · 빈 자리의 소품 · 돌린 그림이 없는 소품 → 400(저장된 방은 그대로)
  await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 2, { plant: { x: 1416, y: 864 } }))),
    (e) => e.status === 400 && e.code === "reading/hideout-arrange" && /포털/.test(e.message));
  for (const bad of [{ nope: { x: 1, y: 1 } }, { desk: { x: 1.5, y: 2 } }, { chest: { x: 100, y: 900 } }, { plant: { x: 600, y: 640, turn: true } }, [1]]) {
    await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 2, bad))), (e) => e.status === 400, JSON.stringify(bad));
  }
  assert.equal((await roomRef.get()).data().revision, 2);
  // 배치 칸이 없는 옛 요청 — 소품만 바꾸고 옮긴 자리는 그대로
  const { arrange: _old, ...legacy } = room({ rug: "rug-linen" }, 2);
  const kept = await saveReadingHideout(who("student"), payload({ ...legacy, layout: { ...legacy.layout, plant: "plant-leafy" } }));
  assert.deepEqual(kept.room.arrange, moved.room.arrange);
  // 저장된 배치가 (예전 그림 등으로) 맞지 않게 되면 읽을 때 그 소품만 제자리로
  await roomRef.set({ ...room({}, 5), arrange: { desk: { x: 1415, y: 820 }, plant: { x: 600, y: 640 } } });
  assert.deepEqual((await getReadingHideout(who("student"), classId)).room.arrange, { plant: { x: 600, y: 640 } });
});

test("포털 옮기기 — 포털 자리를 저장 · 다시 읽고(선생님 보기에도), 놓을 수 없는 자리 · 포털의 뒤집기는 거절하며, 옛 포털 자리에는 가구를 둘 수 있음", async () => {
  const arrange = { plant: { x: 1416, y: 864 }, portal: { x: 400, y: 920 } };
  const saved = await saveReadingHideout(who("student"), payload(room({}, 0, arrange)));
  assert.equal(saved.room.revision, 1);
  assert.deepEqual(saved.room.arrange, arrange);
  assert.deepEqual((await roomRef.get()).data().arrange, arrange);
  assert.deepEqual((await getReadingHideout(who("student"), classId)).room.arrange, arrange);
  assert.deepEqual((await getReadingHideout(who("teacher"), classId, ids.student)).room.arrange, arrange);
  // 포털만 옮겨도 저장 · 처음 자리로 돌리면 칸이 없어짐
  const back = await saveReadingHideout(who("student"), payload(room({}, 1, { portal: { x: 1415, y: 820 } })));
  assert.equal(back.room.revision, 2);
  assert.deepEqual(back.room.arrange, {});
  // 방 가운데(캐릭터가 들어오는 자리) · 가구 위 · 벽 · 뒤집기 · 정수가 아닌 자리 → 400(저장된 방은 그대로)
  await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 2, { portal: { x: 760, y: 850 } }))),
    (e) => e.status === 400 && e.code === "reading/hideout-arrange" && /캐릭터가 들어오는 자리/.test(e.message));
  await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 2, { portal: { x: 216, y: 760 } }))),
    (e) => e.status === 400 && e.code === "reading/hideout-arrange" && /겹쳐요/.test(e.message));
  for (const portal of [{ x: 760, y: 400 }, { x: 400, y: 920, flip: true }, { x: 400.5, y: 920 }]) {
    await assert.rejects(() => saveReadingHideout(who("student"), payload(room({}, 2, { portal }))), (e) => e.status === 400, JSON.stringify(portal));
  }
  assert.equal((await roomRef.get()).data().revision, 2);
  // 저장된 포털이 (그 뒤 고른 소품 등으로) 설 수 없게 되면 읽을 때 처음 자리로
  await roomRef.set({ ...room({}, 5), arrange: { portal: { x: 216, y: 760 }, plant: { x: 600, y: 640 } } });
  assert.deepEqual((await getReadingHideout(who("student"), classId)).room.arrange, { plant: { x: 600, y: 640 } });
});
