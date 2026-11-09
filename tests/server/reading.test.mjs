// Run through Firebase CLI with both Auth and Firestore emulators.
// Uses the production service and real transactions; no credentials required.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getReading, mutateReading, getReadingRankings, getReadingTop, readingPrincipal, refreshReadingMember, saveReadingCharacter } from "../../lib/server/readingService.js";
import { FRUIT_XP, READING_FORMULA, getReadingLevel, readingTopWeek } from "../../lib/reading.js";

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

test("teacher reads a member student's reading state; others and non-members are rejected", async () => {
  const seen = await getReading(principal("teacher"), "api-class", ids.student);
  assert.ok(Array.isArray(seen.state.books));
  await assert.rejects(() => getReading(principal("teacher"), "api-class", ids.other), (e) => e.code === "reading/not-member");
  await assert.rejects(() => getReading(principal("other"), "api-class", ids.student), (e) => e.status === 403);
  const self = await getReading(principal("student"), "api-class", ids.student);
  assert.ok(Array.isArray(self.state.books));
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
  // 리더보드 — 쪽수 · 완독 · 뱃지는 함께 오고, 책 제목은 오지 않습니다
  assert.equal(ranking.rankings[0].totalPages, 50);
  assert.equal(ranking.rankings[0].completedBooks, 1);
  assert.equal(ranking.rankings[0].totalXp, saved.summary.xp);
  assert.ok(ranking.rankings[0].badges.includes("completion_1"));
  assert.equal(JSON.stringify(ranking).includes(saved.state.books[0].title), false);
  const edited = await mutateReading(principal("student"), payload("api-edit-0001", { type: "updateLog", logId: "api-log-0001", endPage: 20 }));
  assert.equal(edited.summary.totalBooks, 0);
  assert.equal((await getReadingRankings(principal("teacher"), "api-class", "daily")).rankings[0].xp, edited.summary.classScores["api-class"].daily);
});

test("idempotent retry returns current state after later edits", async () => {
  const retried = await mutateReading(principal("student"), payload("api-book-0001", addBook));
  assert.equal(retried.replayed, true);
  assert.equal(retried.state.logs[0].endPage, 20);
});

test("ranking switch off blocks rankings only (admin settings)", async () => {
  await db.doc("classes/api-class").update({ rankingEnabled: false });
  await assert.rejects(() => getReadingRankings(principal("teacher"), "api-class", "weekly"), (e) => e.status === 403 && e.code === "reading/ranking-disabled");
  assert.ok((await getReading(principal("student"), "api-class")).state);
  await db.doc("classes/api-class").update({ rankingEnabled: true });
  assert.ok((await getReadingRankings(principal("teacher"), "api-class", "weekly")).rankings);
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

test("과일 — 선생님이 준 과일이 다시 세기(refresh) 뒤 랭킹 경험치에 들어가고, 학생은 다시 세기를 못 부름", async () => {
  const before = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings[0];
  const at = new Date();
  await db.collection("classes/api-class/rewardEvents").add({ classId: "api-class", uid: ids.student, delta: 3, count: 3, byUid: ids.teacher, at });
  await db.collection("classes/api-class/rewardEvents").add({ classId: "api-class", uid: ids.student, delta: -1, count: 2, byUid: ids.teacher, at: new Date(at.getTime() + 1000) });
  await assert.rejects(() => refreshReadingMember(principal("student"), "api-class", ids.student), (e) => e.status === 403);
  await refreshReadingMember(principal("teacher"), "api-class", ids.student);
  const after = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings[0];
  assert.equal(after.xp, before.xp + 3 * FRUIT_XP);
  const snap = (await db.doc(`classes/api-class/readingMembers/${ids.student}`).get()).data();
  assert.equal(snap.formula, READING_FORMULA);
  assert.deepEqual(snap.fruits.map((f) => f.count), [3]);
  const own = await getReading(principal("student"), "api-class");
  assert.equal(own.summary.fruitCount, 3);
});

test("계산 기준이 바뀐 옛 집계는 랭킹을 읽을 때 다시 셈", async () => {
  await db.doc(`classes/api-class/readingMembers/${ids.student}`).set({ uid: ids.student, level: 9, events: [{ date: today, xp: 99999 }], formula: 1 });
  const row = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings[0];
  assert.notEqual(row.xp, 99999);
  assert.equal((await db.doc(`classes/api-class/readingMembers/${ids.student}`).get()).data().formula, READING_FORMULA);
});

test("집계가 아직 없는 학생은 랭킹을 읽을 때 그 자리에서 세어, 같은 응답에 함께 보여 줌", async () => {
  const ref = db.doc(`classes/api-class/readingMembers/${ids.student}`);
  const expected = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((r) => r.uid === ids.student);
  await ref.delete();
  const row = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((r) => r.uid === ids.student);
  assert.deepEqual(row, expected);
  assert.equal((await ref.get()).data().formula, READING_FORMULA);
});

test("journey appearance changes only the authenticated student's public character", async () => {
  const profileRef = db.doc(`users/${ids.student}`);
  const beforeProfile = (await profileRef.get()).data();
  const beforeReading = await getReading(principal("student"), "api-class");
  const character = { number: 9, style: "advanced" };
  assert.deepEqual(await saveReadingCharacter(principal("student"), { classId: "api-class", character }), { character });
  assert.deepEqual((await profileRef.get()).data(), { ...beforeProfile, readingCharacter: character });
  const afterReading = await getReading(principal("student"), "api-class");
  assert.deepEqual(afterReading.state, beforeReading.state);
  assert.equal(afterReading.summary.xp, beforeReading.summary.xp);
  const row = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings[0];
  assert.deepEqual(row.character, character);
  assert.equal(row.totalXp, beforeReading.summary.xp);
  assert.equal(Object.hasOwn(row, "email"), false);
  assert.equal(Object.hasOwn(row, "state"), false);
});

test("journey appearance rejects other UIDs, malformed choices, teachers and disabled access", async () => {
  const character = { number: 1, style: "intermediate" };
  for (const body of [null, [], { classId: "api-class", uid: ids.other, character },
    { classId: "api-class", character: { ...character, role: "admin" } },
    { classId: "api-class", character: { number: 11, style: "advanced" } }]) {
    await assert.rejects(() => saveReadingCharacter(principal("student"), body), (error) => error.status === 400);
  }
  await assert.rejects(() => saveReadingCharacter(principal("other"), { classId: "api-class", character }), (error) => error.status === 403);
  await assert.rejects(() => saveReadingCharacter(principal("teacher"), { classId: "api-class", character }), (error) => error.status === 403);
  await assert.rejects(() => saveReadingCharacter(principal("admin"), { classId: "api-class", character }), (error) => error.status === 403);
  await assert.rejects(() => saveReadingCharacter(principal("student"), { classId: "api-off", character }), (error) => error.status === 403);
  await db.doc("classes/api-class").update({ rankingEnabled: false });
  try {
    await assert.rejects(() => saveReadingCharacter(principal("student"), { classId: "api-class", character }), (error) => error.code === "reading/ranking-disabled");
  } finally { await db.doc("classes/api-class").update({ rankingEnabled: true }); }
});

test("character switch off blocks choosing and shows the default character, keeping the saved choice", async () => {
  const character = { number: 4, style: "intermediate" };
  await saveReadingCharacter(principal("student"), { classId: "api-class", character });
  await db.doc("classes/api-class").update({ characterEnabled: false });
  try {
    await assert.rejects(() => saveReadingCharacter(principal("student"), { classId: "api-class", character }), (error) => error.status === 403 && error.code === "reading/character-disabled");
    const off = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((r) => r.uid === ids.student);
    assert.equal(off.character, null);
    assert.deepEqual((await db.doc(`users/${ids.student}`).get()).data().readingCharacter, character);
  } finally { await db.doc("classes/api-class").update({ characterEnabled: true }); }
  const on = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((r) => r.uid === ids.student);
  assert.deepEqual(on.character, character);
});

test("same-formula projections missing global XP are repaired rather than treated as a starting student", async () => {
  await db.doc(`classes/api-class/readingMembers/${ids.student}`).set({ uid: ids.student, level: 1, events: [], formula: READING_FORMULA });
  const canonical = await getReading(principal("student"), "api-class");
  const row = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings[0];
  assert.equal(row.totalXp, canonical.summary.xp);
  assert.deepEqual(row.badges, canonical.summary.earnedBadges.map((badge) => badge.id));
  await db.doc(`users/${ids.student}`).update({ readingCharacter: { number: 11, style: "advanced" } });
  assert.equal((await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings[0].character, null);
});

// 상단바 '독서 TOP 3' — 서울 시각 월요일 07:00에 한 주가 바뀌고, 그 주 내내 같은 셋(선생님 요청).
test("독서 TOP 3 — 한 주에 한 번 셈해 적어 두고, 그 주에는 같은 셋 · 반에서 빠진 학생은 빼고 채움", async () => {
  const week = readingTopWeek(new Date());
  const before = new Date(Date.parse(`${week}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10); // 지난주 목요일쯤
  const top = ["top-a", "top-b", "top-c", "top-d"];
  const snapshot = (uid, pastXp, thisWeekXp) => {
    const totalXp = pastXp + thisWeekXp;
    return { uid, level: getReadingLevel(totalXp), featuredBadge: null, formula: READING_FORMULA,
      events: [{ date: before, xp: pastXp }, ...(thisWeekXp ? [{ date: week, xp: thisWeekXp }] : [])],
      totalXp, badges: [], totalPages: 0, completedBooks: 0, reviewCount: 0, longestStreak: 0, streakRun: 0,
      lastReadDate: before, fruitCount: 0, xpReachedOn: thisWeekXp ? week : before, fruits: [] };
  };
  const batch = db.batch();
  batch.set(db.doc("classes/api-top"), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  top.forEach((uid, i) => {
    batch.set(db.doc(`users/${uid}`), { role: "student", realName: `상위${i + 1}`, studentId: `3010${i + 1}` });
    batch.set(db.doc(`memberships/${uid}_api-top`), { uid, classId: "api-top" });
  });
  // a: 지난주까지 300(새 집계 — 날마다의 경험치 xpDays) · b: 200(+이번 주 500 — 이번 주 셋에는 안 듦, 옛 집계)
  // · c: 150 · d: 이번 주에 처음 읽음 · api-student: 다른 반에서 이번 주에만 얻은 경험치(이 반 집계는 그 자리에서 셈)
  batch.set(db.doc("classes/api-top/readingMembers/top-a"), { ...snapshot("top-a", 300, 40), events: [], xpDays: [{ date: before, xp: 300 }, { date: week, xp: 40 }] });
  batch.set(db.doc("classes/api-top/readingMembers/top-b"), snapshot("top-b", 200, 500));
  batch.set(db.doc("classes/api-top/readingMembers/top-c"), snapshot("top-c", 150, 0));
  batch.set(db.doc("classes/api-top/readingMembers/top-d"), { ...snapshot("top-d", 0, 90), events: [{ date: week, xp: 90 }] });
  batch.set(db.doc(`memberships/${ids.student}_api-top`), { uid: ids.student, classId: "api-top" });
  await batch.commit();

  const first = await getReadingTop(principal("teacher"), "api-top");
  assert.equal(first.week, week);
  assert.deepEqual(first.rows.map((r) => r.uid), ["top-a", "top-b", "top-c"]);
  assert.deepEqual(first.rows.map((r) => r.totalXp), [300, 200, 150]); // a의 이번 주 40 · b의 이번 주 500은 빠짐
  // 다른 반에서 이번 주에만 얻은 경험치도 빠짐 — 그 학생은 다섯 자리 후보에도 없음
  const studentSnap = (await db.doc(`classes/api-top/readingMembers/${ids.student}`).get()).data();
  assert.ok(Array.isArray(studentSnap.xpDays) && studentSnap.xpDays.length > 0);
  assert.equal(first.rows[1].level, getReadingLevel(200));
  assert.equal(first.rows[0].name, "상위1");
  const saved = (await db.doc("classes/api-top/readingTop/current").get()).data();
  assert.equal(saved.week, week);
  assert.equal(saved.formula, READING_FORMULA);
  assert.ok(saved.rows.length <= 5);
  assert.ok(!saved.rows.some((r) => r.uid === ids.student || r.uid === "top-d"));

  // 그 주 안에서는 다시 세지 않음 — 반 집계가 바뀌어도 같은 셋(학생이 물어도 같음)
  await db.doc("classes/api-top/readingMembers/top-c").set(snapshot("top-c", 900, 0));
  assert.deepEqual((await getReadingTop(principal("student"), "api-top")).rows.map((r) => r.uid), ["top-a", "top-b", "top-c"]);

  // 반에서 빠진 학생은 그 자리에서 빼고 다음 학생이 올라옴 — 적어 둔 한 장에서도 이름을 지움
  await db.doc("memberships/top-a_api-top").delete();
  const after = await getReadingTop(principal("teacher"), "api-top");
  assert.deepEqual(after.rows.map((r) => r.uid), ["top-b", "top-c"]);
  assert.ok(!(await db.doc("classes/api-top/readingTop/current").get()).data().rows.some((r) => r.uid === "top-a"));

  // 주가 바뀌면(적어 둔 주가 지난주) 그때 다시 셈 — 바뀐 집계가 들어옴
  await db.doc("classes/api-top/readingTop/current").update({ week: "2000-01-03" });
  assert.deepEqual((await getReadingTop(principal("teacher"), "api-top")).rows.map((r) => r.uid), ["top-c", "top-b"]);

  // 다른 반 학생 · 랭킹을 끈 반은 막음
  await assert.rejects(() => getReadingTop(principal("other"), "api-top"), (e) => e.status === 403);
  await db.doc("classes/api-top").update({ rankingEnabled: false });
  await assert.rejects(() => getReadingTop(principal("teacher"), "api-top"), (e) => e.code === "reading/ranking-disabled");
});

// 책나눔 상태 — 평소 다시 묻기(60초마다 · 돌아왔을 때)는 반 집계에 적어 둔 '모든 반의 과일 날'(allFruits)로,
// 처음 열 때 · 과일 수가 바뀌었을 때(fresh)만 지급 이력에서 다시 셉니다.
test("책나눔 상태 — 평소에는 반 집계의 과일 날로, fresh일 때만 지급 이력에서 다시 셈해 집계도 고쳐 적음", async () => {
  const memberRef = db.doc(`classes/api-class/readingMembers/${ids.student}`);
  const base = await getReading(principal("student"), "api-class", null, { fresh: true });
  assert.ok(Array.isArray((await memberRef.get()).data().allFruits));
  const count0 = base.summary.fruitCount;
  // 선생님이 과일을 줬는데 '다시 세기'가 아직(또는 실패) — 평소 다시 묻기는 집계 그대로(지급 이력을 안 읽음)
  await db.collection("classes/api-class/rewardEvents").add({ classId: "api-class", uid: ids.student, delta: 20, count: 99, byUid: ids.teacher, at: new Date() });
  assert.equal((await getReading(principal("student"), "api-class")).summary.fruitCount, count0);
  // 과일 수가 바뀌어 화면이 fresh로 물으면 — 다시 세고, 집계도 고쳐 적음(리더보드 · TOP 3가 같은 집계를 씀)
  const fresh = await getReading(principal("student"), "api-class", null, { fresh: true });
  assert.ok(fresh.summary.fruitCount > count0);
  const healed = (await memberRef.get()).data();
  assert.equal(healed.allFruits.reduce((n, f) => n + f.count, 0), fresh.summary.fruitCount);
  assert.equal((await getReading(principal("student"), "api-class")).summary.fruitCount, fresh.summary.fruitCount);
  // 교사가 보는 학생의 책나눔도 같은 길
  assert.equal((await getReading(principal("teacher"), "api-class", ids.student)).summary.fruitCount, fresh.summary.fruitCount);
  // 옛 집계(allFruits가 생기기 전)는 평소 다시 묻기에서도 다시 셈해 고쳐 적음
  const { allFruits, ...old } = healed;
  assert.ok(allFruits.length > 0);
  await memberRef.set(old);
  assert.equal((await getReading(principal("student"), "api-class")).summary.fruitCount, fresh.summary.fruitCount);
  assert.ok(Array.isArray((await memberRef.get()).data().allFruits));
});

test("책나눔 상태 — 과일이 하나도 없는 학생도 처음 한 번 집계에 과일 날(빈 목록)을 적어, 그 뒤로는 다시 세지 않음", async () => {
  const uid = "fruitless-student";
  await db.doc(`users/${uid}`).set({ role: "student", realName: "과일없음", studentId: "20199" });
  await db.doc(`memberships/${uid}_api-class`).set({ uid, classId: "api-class" });
  const who = { uid, roleClaim: null, db };
  const ref = db.doc(`classes/api-class/readingMembers/${uid}`);
  assert.equal((await ref.get()).exists, false);
  assert.equal((await getReading(who, "api-class")).summary.fruitCount, 0);
  const written = (await ref.get()).data();
  assert.deepEqual(written.allFruits, []);
  assert.equal(written.formula, READING_FORMULA);
});
