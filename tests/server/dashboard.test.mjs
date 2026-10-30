// Use the real dashboard service with Auth + Firestore emulators only. These
// fixtures never clear the database: the reading suite has its own api-* docs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDashboard, saveDashboardSemester } from "../../lib/server/dashboardService.js";
import { applyReadingAction, initialReadingState, kstToday } from "../../lib/reading.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const app = initializeApp({ projectId }, "dashboard-api-test-seed");
const db = getFirestore(app);
const ids = {
  teacher: "dash-teacher", otherTeacher: "dash-other-teacher", admin: "dash-admin",
  alice: "dash-alice", bob: "dash-bob", quiet: "dash-quiet", outsider: "dash-outsider", former: "dash-former",
};
const classes = { own: "dash-class-a", other: "dash-class-b", off: "dash-class-off", archived: "dash-class-archived" };
const acts = { kwls: "dash-kwls-a", raft: "dash-raft-a", off: "dash-kwls-off", other: "dash-kwls-b", deleted: "dash-deleted-a" };
const now = new Date();
const today = kstToday(now);
const day = (offset) => new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86400000).toISOString().slice(0, 10);
const at = (offset) => new Date(`${day(offset)}T00:00:00+09:00`).toISOString();
const principal = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const options = (extra = {}) => ({ classId: classes.own, activityId: acts.kwls, period: "custom", start: day(7), end: today, ...extra });
const answers = (learned) => ({ know: "책의 제목에서 내용을 예측했다.", want: "인물이 다른 선택을 하면 어떻게 될까?", learned, still: "이 선택을 우리 생활에서 어떻게 이어 갈까?" });
const privateMarkers = [
  "PRIVATE_ALICE_CURRENT_NOTE", "PRIVATE_ALICE_OTHER_NOTE", "PRIVATE_ALICE_REVIEW", "PRIVATE_OTHER_CLASS_BOOK",
  "PRIVATE_OTHER_REVIEW", "PRIVATE_BOB_NOTE", "PRIVATE_BOB_REVIEW", "PRIVATE_FORMER_BOOK", "PRIVATE_PROFILE_EMAIL",
];

function stateFor(uid, definition) {
  let state = initialReadingState();
  const run = (action, id, classId = classes.own, back = 0) => {
    state = applyReadingAction(state, action, { uid, classId, id, now: at(back) });
  };
  definition(run);
  return state;
}

const aliceState = stateFor(ids.alice, (run) => {
  run({ type: "addBook", title: "두 반에서 함께 읽은 책", author: "책봄 시험", totalPages: 40 }, "dash-alice-shared-book", classes.own, 9);
  run({ type: "addBook", title: "우리 반에서 완독한 책", author: "책봄 시험", totalPages: 10 }, "dash-alice-class-book", classes.own, 9);
  run({ type: "addBook", title: "PRIVATE_OTHER_CLASS_BOOK", author: "비공개", totalPages: 20 }, "dash-alice-other-book", classes.other, 9);
  run({ type: "addLog", bookId: "dash-alice-other-book", date: day(4), startPage: 1, endPage: 20, notes: "PRIVATE_ALICE_OTHER_NOTE" }, "dash-alice-other-log", classes.other, 4);
  run({ type: "addLog", bookId: "dash-alice-class-book", date: day(3), startPage: 1, endPage: 10, notes: "PRIVATE_ALICE_CURRENT_NOTE" }, "dash-alice-class-log", classes.own, 3);
  run({ type: "saveReview", bookId: "dash-alice-class-book", text: "PRIVATE_ALICE_REVIEW", rating: 4 }, "dash-alice-class-review", classes.own, 3);
  run({ type: "addLog", bookId: "dash-alice-shared-book", date: day(2), startPage: 1, endPage: 20, notes: "PRIVATE_ALICE_CURRENT_NOTE" }, "dash-alice-shared-log-a", classes.own, 2);
  run({ type: "addLog", bookId: "dash-alice-shared-book", date: day(1), startPage: 21, endPage: 40, notes: "PRIVATE_ALICE_OTHER_NOTE" }, "dash-alice-shared-log-b", classes.other, 1);
  run({ type: "saveReview", bookId: "dash-alice-other-book", text: "PRIVATE_OTHER_REVIEW", rating: 3 }, "dash-alice-other-review", classes.other, 1);
});
const bobState = stateFor(ids.bob, (run) => {
  run({ type: "addBook", title: "우리 반의 두 번째 책", author: "책봄 시험", totalPages: 12 }, "dash-bob-book", classes.own, 8);
  run({ type: "addLog", bookId: "dash-bob-book", date: day(2), startPage: 1, endPage: 12, notes: "PRIVATE_BOB_NOTE" }, "dash-bob-log", classes.own, 2);
  run({ type: "saveReview", bookId: "dash-bob-book", text: "PRIVATE_BOB_REVIEW", rating: 5 }, "dash-bob-review", classes.own, 2);
});

before(async () => {
  const batch = db.batch();
  for (const [kind, uid] of Object.entries(ids)) {
    batch.set(db.doc(`users/${uid}`), {
      role: kind === "teacher" || kind === "otherTeacher" ? "teacher" : kind === "admin" ? "admin" : "student",
      realName: { alice: "김독서", bob: "이성찰", quiet: "박조용" }[kind] || `시험 ${kind}`,
      displayName: "익명 닉네임 대신 실명 사용", studentId: { alice: "20101", bob: "20102", quiet: "20103" }[kind] || "",
      emoji: "🌱", email: "PRIVATE_PROFILE_EMAIL@example.invalid",
    });
  }
  batch.set(db.doc(`classes/${classes.own}`), { name: "대시보드 시험반", createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc(`classes/${classes.other}`), { name: "다른 교사의 반", createdBy: ids.otherTeacher, readingEnabled: true, archived: false });
  batch.set(db.doc(`classes/${classes.off}`), { name: "성장 기능을 쓰지 않는 반", createdBy: ids.teacher, archived: false });
  batch.set(db.doc(`classes/${classes.archived}`), { name: "보관된 반", createdBy: ids.teacher, readingEnabled: true, archived: true });
  for (const [uid, classId] of [[ids.alice, classes.own], [ids.bob, classes.own], [ids.quiet, classes.own], [ids.teacher, classes.own], [ids.alice, classes.other], [ids.outsider, classes.other], [ids.alice, classes.off]]) {
    batch.set(db.doc(`memberships/${uid}_${classId}`), { uid, classId });
  }
  for (const [id, classId, type, extra = {}] of [[acts.kwls, classes.own, "kwls"], [acts.raft, classes.own, "raft"], [acts.off, classes.off, "kwls"], [acts.other, classes.other, "kwls"], [acts.deleted, classes.own, "kwls", { deleted: true }]]) {
    batch.set(db.doc(`bookActivities/${id}`), { classId, type, title: `${type} 독서 활동`, topic: "같이 읽는 책", groupMode: "solo", createdBy: classId === classes.other ? ids.otherTeacher : ids.teacher, createdAt: new Date(at(5)), ...extra });
  }
  const lesson = answers("서로 다른 입장을 먼저 듣는 일이 중요함을 알았다.");
  batch.set(db.doc(`bookActivities/${acts.kwls}/entries/${ids.alice}`), { activityId: acts.kwls, authorId: ids.alice, authorName: "김독서", answers: lesson, updatedAt: new Date(at(1)) });
  // An automatically saved empty response must not become participation.
  batch.set(db.doc(`bookActivities/${acts.kwls}/entries/${ids.bob}`), { activityId: acts.kwls, authorId: ids.bob, topic: "제목만 있는 자동 저장", answers: {}, updatedAt: new Date(at(1)) });
  batch.set(db.doc(`bookActivities/${acts.kwls}/entries/${ids.former}`), { activityId: acts.kwls, authorId: ids.former, answers: answers("전출생의 과거 기록"), updatedAt: new Date(at(1)) });
  for (const [uid, content] of [[ids.alice, lesson], [ids.bob, {}], [ids.former, answers("전출생의 과거 기록")]]) {
    batch.set(db.doc(`kwl/${uid}_${classes.own}_act_${acts.kwls}`), { classId: classes.own, userId: uid, activityId: acts.kwls, activityTitle: "독서 성찰", date: day(2), answers: content, createdAt: new Date(at(2)) });
  }
  batch.set(db.doc(`kwl/${ids.alice}_${classes.other}_act_${acts.other}`), { classId: classes.other, userId: ids.alice, activityId: acts.other, date: day(2), answers: answers("다른 반 성찰 원문"), createdAt: new Date(at(2)) });
  batch.set(db.doc(`bookActivities/${acts.raft}/entries/${ids.alice}`), { activityId: acts.raft, authorId: ids.alice, answers: { role: "책 속 인물", audience: "친구", format: "편지", topic: "생각 나눔", writing: "학생 본인의 RAFT 글" }, updatedAt: new Date(at(1)) });
  batch.set(db.doc(`bookActivities/${acts.raft}/entries/${ids.bob}`), { activityId: acts.raft, authorId: ids.bob, answers: { role: "다른 인물", audience: "친구", format: "편지", topic: "다른 생각", writing: "다른 학생의 RAFT 글은 본인 화면에 나오면 안 됨" }, updatedAt: new Date(at(1)) });
  batch.set(db.doc(`users/${ids.alice}/reading/main`), { state: aliceState });
  batch.set(db.doc(`users/${ids.bob}/reading/main`), { state: bobState });
  batch.set(db.doc(`users/${ids.former}/reading/main`), { state: { ...initialReadingState(), books: [{ id: "dash-former-private", title: "PRIVATE_FORMER_BOOK", author: "비공개", totalPages: 10 }] } });
  batch.set(db.doc("questions/dash-irrelevant-question"), { title: "QUESTION_ROOM_MUST_NOT_APPEAR", authorId: ids.alice });
  await batch.commit();
});
after(async () => { await deleteApp(app); });

test("dashboard access follows actual class ownership and membership", async () => {
  const teacher = await getDashboard(principal("teacher"), options());
  assert.equal(teacher.view, "teacher");
  assert.equal((await getDashboard(principal("admin"), options())).view, "teacher");
  assert.equal((await getDashboard(principal("alice"), options())).view, "student");
  for (const actor of ["outsider", "otherTeacher"]) {
    await assert.rejects(() => getDashboard(principal(actor), options()), (error) => error.status === 403);
  }
  await assert.rejects(() => getDashboard({ uid: "dash-missing-profile", roleClaim: null, db }, options()), (error) => [401, 403].includes(error.status));
  await assert.rejects(() => getDashboard(principal("admin"), options({ classId: classes.archived, activityId: null })), (error) => [403, 404].includes(error.status));
});

test("teacher progress uses the complete current student roster and deduplicates KWLS", async () => {
  const data = await getDashboard(principal("teacher"), options());
  assert.equal(data.reportView, "class");
  assert.deepEqual(data.roster.map((student) => student.uid).sort(), [ids.alice, ids.bob, ids.quiet].sort());
  assert.ok(data.roster.every((student) => Object.keys(student).every((key) => ["uid", "name", "studentId", "emoji"].includes(key))));
  assert.equal(data.activity.eligible, 3);
  assert.equal(data.activity.rows.length, 3);
  assert.equal(data.activity.started, 1);
  assert.equal(data.activity.done, 1);
  assert.equal(data.activity.rows.find((row) => row.uid === ids.alice).name, "김독서");
  assert.equal(data.activity.rows.find((row) => row.uid === ids.bob).state, "empty");
  assert.equal(data.activity.rows.find((row) => row.uid === ids.quiet).state, "empty");
  assert.equal(data.reflections.records.filter((record) => record.uid === ids.alice).length, 1);
  assert.equal(data.reflections.counts.learned, 1);
  assert.ok(data.activity.rows.every((row) => ![ids.teacher, ids.former].includes(row.uid)));
  assert.ok(data.activities.every((activity) => ![acts.other, acts.deleted].includes(activity.id)));
});

test("teacher personal reports follow the current student roster and include all class activities", async () => {
  const data = await getDashboard(principal("teacher"), options({ view: "personal", studentUid: ids.alice }));
  assert.equal(data.reportView, "personal");
  assert.equal(data.view, "student");
  assert.equal(data.subject.uid, ids.alice);
  assert.equal(data.subject.name, "김독서");
  assert.deepEqual(data.roster.map((student) => student.uid), [ids.alice]);
  assert.deepEqual(data.studentActivities.map((activity) => activity.id).sort(), [acts.kwls, acts.raft].sort());
  assert.match(data.studentActivities.find((activity) => activity.id === acts.raft).preview, /학생 본인의 RAFT 글/);
  assert.ok(data.activity.rows.every((row) => row.uid === ids.alice));
  assert.ok(data.reflections.records.every((row) => row.uid === ids.alice));
  assert.equal(data.reading.summary.pages, 30);
  assert.equal(data.reading.summary.completed, 1);
  assert.equal(data.reading.personal, null);
  assert.deepEqual(data.reading.dayRecords, []);
  const serialized = JSON.stringify(data);
  for (const marker of privateMarkers) assert.equal(serialized.includes(marker), false, marker);
  assert.equal(serialized.includes("다른 학생의 RAFT 글은 본인 화면에 나오면 안 됨"), false);
  assert.equal(serialized.includes("다른 반 성찰 원문"), false);
  assert.equal((await getDashboard(principal("admin"), options({ view: "personal", studentUid: ids.alice }))).subject.uid, ids.alice);
  for (const studentUid of [ids.outsider, ids.former, ids.teacher, "dash-no-profile"]) {
    await assert.rejects(() => getDashboard(principal("teacher"), options({ view: "personal", studentUid })), (error) => error.status === 403);
  }
  await assert.rejects(() => getDashboard(principal("otherTeacher"), options({ view: "personal", studentUid: ids.alice })), (error) => error.status === 403);
  for (const actor of ["alice", "bob"]) {
    for (const studentUid of [ids.alice, ids.bob]) {
      await assert.rejects(() => getDashboard(principal(actor), options({ view: "personal", studentUid })), (error) => [400, 403].includes(error.status));
    }
  }
});

test("overall reports aggregate every authorized active class and deduplicate students", async () => {
  const scope = options({ view: "overall", activityId: null });
  const data = await getDashboard(principal("teacher"), scope);
  assert.equal(data.reportView, "overall");
  assert.equal(data.view, "teacher");
  assert.deepEqual(data.classes.map((row) => row.classId).sort(), [classes.own, classes.off].sort());
  assert.equal(data.summary.classes, 2);
  assert.equal(data.summary.students, 3);
  assert.equal(data.summary.memberships, 4);
  assert.equal(data.summary.activityCount, 3);
  assert.equal(data.summary.reading.pages, 42);
  assert.equal(data.summary.reading.readers, 2);
  assert.equal(data.summary.reading.enabledClasses, 1);
  assert.equal(data.summary.selectedActivity.scope, "selected-per-class");
  assert.equal(data.students.find((student) => student.uid === ids.alice).classes.length, 2);
  const admin = await getDashboard(principal("admin"), scope);
  assert.deepEqual(admin.classes.map((row) => row.classId).sort(), [classes.own, classes.off, classes.other].sort());
  assert.equal(admin.summary.students, 4);
  assert.equal(admin.summary.reading.pages, 82);
  assert.equal(admin.summary.reading.readers, 2);
  for (const marker of privateMarkers) assert.equal(JSON.stringify(data).includes(marker), false, marker);
  for (const marker of privateMarkers.filter((marker) => marker !== "PRIVATE_OTHER_CLASS_BOOK")) assert.equal(JSON.stringify(admin).includes(marker), false, marker);
  for (const actor of ["alice", "bob", "outsider"]) {
    await assert.rejects(() => getDashboard(principal(actor), scope), (error) => error.status === 403);
  }
  await assert.rejects(() => getDashboard(principal("otherTeacher"), scope), (error) => error.status === 403);
  const other = await getDashboard(principal("otherTeacher"), { ...scope, classId: null });
  assert.deepEqual(other.classes.map((row) => row.classId), [classes.other]);
  for (const extra of [{ studentUid: ids.alice }, { activityId: acts.kwls }, { view: "unknown" }]) {
    await assert.rejects(() => getDashboard(principal("teacher"), { ...scope, ...extra }), (error) => error.status === 400);
  }
});

test("overall reports reuse shared reading sources and fail if any authorized class fails", async () => {
  const touched = [];
  const observed = new Proxy(db, {
    get(target, key) {
      if (key === "doc") return (path) => { touched.push(path); return target.doc(path); };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const scope = options({ view: "overall", activityId: null });
  await getDashboard({ ...principal("admin"), db: observed }, scope);
  assert.equal(touched.filter((path) => path === `users/${ids.alice}/reading/main`).length, 1);
  const unavailable = new Error("A class source is unavailable");
  const failing = new Proxy(db, {
    get(target, key) {
      if (key === "collection") return (path) => {
        const collection = target.collection(path);
        if (path !== "bookActivities") return collection;
        return new Proxy(collection, {
          get(reference, name) {
            if (name === "where") return (...args) => {
              if (args[0] === "classId" && args[2] === classes.off) throw unavailable;
              return reference.where(...args);
            };
            const value = Reflect.get(reference, name);
            return typeof value === "function" ? value.bind(reference) : value;
          },
        });
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  await assert.rejects(() => getDashboard({ ...principal("teacher"), db: failing }, scope), (error) => error === unavailable);
});

test("teacher reading totals remain class scoped and never expose personal source records", async () => {
  const data = await getDashboard(principal("teacher"), options());
  assert.equal(data.reading.personal, null);
  assert.equal(data.reading.summary.pages, 42);
  assert.equal(data.reading.summary.readers, 2);
  // Alice's shared book was completed in the other class, so it is not a
  // completion for this class. Her ten-page book and Bob's book are.
  assert.equal(data.reading.summary.completed, 2);
  assert.equal(data.reading.summary.reviews, 2);
  assert.equal(data.reading.members.length, 3);
  assert.equal(data.reading.members.find((row) => row.uid === ids.quiet).pages, 0);
  const serialized = JSON.stringify(data);
  for (const marker of privateMarkers) assert.equal(serialized.includes(marker), false, marker);
  assert.equal(serialized.includes("다른 반 성찰 원문"), false);
  assert.equal(serialized.includes("QUESTION_ROOM_MUST_NOT_APPEAR"), false);
  assert.equal(Object.hasOwn(data, "readingStates"), false);
});

test("student sees only personal activity records with global growth separated from class totals", async () => {
  const data = await getDashboard(principal("alice"), options());
  assert.equal(data.reading.summary.pages, 30);
  assert.equal(data.reading.summary.completed, 1);
  assert.equal(data.reading.summary.readers, 1);
  assert.equal(data.reading.personal.totalPages, 70);
  assert.equal(data.reading.personal.totalBooks, 3);
  assert.equal(data.reading.personal.library.length, 3);
  assert.ok(data.activity.rows.every((row) => row.uid === ids.alice));
  assert.ok(data.reflections.records.every((row) => row.uid === ids.alice));
  assert.equal(JSON.stringify(data).includes("다른 학생의 RAFT 글은 본인 화면에 나오면 안 됨"), false);
  assert.equal(JSON.stringify(data).includes("PRIVATE_BOB_NOTE"), false);
  assert.equal(JSON.stringify(data).includes("PRIVATE_BOB_REVIEW"), false);
  for (const key of ["uid", "userId", "studentUid"]) {
    await assert.rejects(() => getDashboard(principal("alice"), options({ [key]: ids.bob })), (error) => [400, 403].includes(error.status));
  }
});

test("reading default-off preserves class activities without loading private reading states", async () => {
  // Observe Firestore paths while keeping actual emulator transactions. A
  // disabled feature must not even construct a private reading-state query.
  const touched = [];
  const observed = new Proxy(db, {
    get(target, key) {
      if (key === "doc" || key === "collection") return (path) => { touched.push(path); return target[key](path); };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const offOptions = options({ classId: classes.off, activityId: acts.off });
  const teacher = await getDashboard({ ...principal("teacher"), db: observed }, offOptions);
  assert.equal(teacher.class.readingEnabled, false);
  assert.equal(teacher.reading, null);
  assert.equal(teacher.activities.length, 1);
  assert.equal(teacher.activity.rows.length, 1);
  assert.equal(touched.some((path) => /\/reading(?:\/|$)/.test(path)), false);
  const student = await getDashboard(principal("alice"), offOptions);
  assert.equal(student.reading, null);
  assert.equal(student.studentActivities.length, 1);
});

test("selected activities cannot cross class boundaries or resurrect deleted work", async () => {
  for (const activityId of [acts.other, acts.deleted, "dash-unknown-activity"]) {
    await assert.rejects(() => getDashboard(principal("teacher"), options({ activityId })), (error) => [400, 403, 404].includes(error.status));
  }
});

test("dashboard periods validate actual dates and require a configured semester", async () => {
  for (const invalid of [
    { classId: "../other" },
    { period: "all-time" },
    { start: "2026-02-30" },
    { start: today, end: day(1) },
    { start: day(367) },
    { end: day(-1) },
    { period: "semester" },
  ]) {
    await assert.rejects(() => getDashboard(principal("teacher"), options(invalid)), (error) => error.status === 400);
  }
});

test("semester settings are owner/admin-only and do not activate the growth feature", async () => {
  const input = { classId: classes.off, start: day(30), end: today };
  for (const actor of ["alice", "otherTeacher"]) {
    await assert.rejects(() => saveDashboardSemester(principal(actor), input), (error) => error.status === 403);
  }
  await saveDashboardSemester(principal("teacher"), input);
  const saved = (await db.doc(`classes/${classes.off}`).get()).data();
  assert.equal(saved.dashboardSemesterStart, input.start);
  assert.equal(saved.dashboardSemesterEnd, input.end);
  assert.notEqual(saved.readingEnabled, true);
  const data = await getDashboard(principal("alice"), options({ classId: classes.off, activityId: acts.off, period: "semester" }));
  assert.equal(data.period.start, input.start);
  assert.equal(data.period.end, input.end);
  assert.equal(data.class.semesterStart, input.start);
  assert.equal(data.reading, null);
  const overall = await getDashboard(principal("teacher"), options({ classId: classes.off, activityId: null, view: "overall", period: "semester" }));
  assert.equal(overall.period.key, "semester");
  assert.equal(overall.period.start, input.start);
  assert.equal(overall.period.end, input.end);
  assert.deepEqual(overall.semesterAnchor, { id: classes.off, name: "성장 기능을 쓰지 않는 반" });
  await saveDashboardSemester(principal("admin"), { ...input, start: day(29) });
  assert.equal((await db.doc(`classes/${classes.off}`).get()).data().dashboardSemesterStart, day(29));
  for (const invalid of [{ start: "bad-date" }, { start: today, end: day(1) }, { start: day(400) }]) {
    await assert.rejects(() => saveDashboardSemester(principal("teacher"), { ...input, ...invalid }), (error) => error.status === 400);
  }
});

test("reading corrections and deletion immediately change dashboard totals without cached private state", async () => {
  const classId = "dash-correction-class";
  const uid = "dash-correction-student";
  const state = stateFor(uid, (run) => {
    run({ type: "addBook", title: "정정 시험 책", author: "책봄", totalPages: 30 }, "dash-correction-book", classId, 3);
    run({ type: "addLog", bookId: "dash-correction-book", date: day(1), startPage: 1, endPage: 30, notes: "PRIVATE_CORRECTION_NOTE" }, "dash-correction-log", classId, 1);
  });
  const batch = db.batch();
  batch.set(db.doc(`classes/${classId}`), { name: "정정 시험반", createdBy: ids.teacher, readingEnabled: true });
  batch.set(db.doc(`users/${uid}`), { role: "student", realName: "정정학생", studentId: "20301" });
  batch.set(db.doc(`memberships/${uid}_${classId}`), { uid, classId });
  batch.set(db.doc(`users/${uid}/reading/main`), { state });
  await batch.commit();
  const scope = options({ classId, activityId: null });
  const before = await getDashboard(principal("teacher"), scope);
  assert.equal(before.reading.summary.pages, 30);
  assert.equal(before.reading.summary.completed, 1);
  const edited = applyReadingAction(state, { type: "updateLog", logId: "dash-correction-log", endPage: 12 }, { uid, classId, id: "dash-correction-edit", now: now.toISOString() });
  await db.doc(`users/${uid}/reading/main`).set({ state: edited });
  const afterEdit = await getDashboard(principal("teacher"), scope);
  assert.equal(afterEdit.reading.summary.pages, 12);
  assert.equal(afterEdit.reading.summary.completed, 0);
  const deleted = applyReadingAction(edited, { type: "deleteLog", logId: "dash-correction-log" }, { uid, classId, id: "dash-correction-delete", now: now.toISOString() });
  await db.doc(`users/${uid}/reading/main`).set({ state: deleted });
  const afterDelete = await getDashboard(principal("teacher"), scope);
  assert.equal(afterDelete.reading.summary.pages, 0);
  assert.equal(afterDelete.reading.summary.readers, 0);
  assert.equal(afterDelete.reading.summary.completed, 0);
  assert.equal(JSON.stringify(afterDelete).includes("PRIVATE_CORRECTION_NOTE"), false);
});
