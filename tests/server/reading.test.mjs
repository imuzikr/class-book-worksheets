// Run through Firebase CLI with both Auth and Firestore emulators.
// Uses the production service and real transactions; no credentials required.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getReading, mutateReading, getReadingRankings, getReadingTop, readingPrincipal, saveReadingCharacter } from "../../lib/server/readingService.js";
import { READING_FORMULA, getReadingLevel, readingTopWeek } from "../../lib/reading.js";

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
  // 네 기간의 경험치가 한 번에 옵니다 — 화면은 기간 단추를 눌러도 다시 묻지 않고 이것으로 다시 세웁니다
  const scores = saved.summary.classScores["api-class"];
  assert.deepEqual(ranking.rankings[0].xpBy, { daily: scores.daily, weekly: scores.weekly, monthly: scores.monthly, "all-time": scores.allTime });
  assert.equal(ranking.rankings[0].allTimeXp, scores.allTime);
  const weekly = await getReadingRankings(principal("student"), "api-class", "weekly");
  assert.deepEqual(weekly.rankings[0].xpBy, ranking.rankings[0].xpBy);
  assert.equal(weekly.rankings[0].xp, scores.weekly);
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

// 리더보드 스위치(관리자 설정)는 상단바 리더보드 화면만 켜고 끕니다 — 순위는 책나눔과 함께 늘 돌아, 꺼도 책나눔의
// '우리 반 랭킹' 탭이 같은 순위를 받고, 독서 TOP 3는 제 스위치(readingTopEnabled)를 따릅니다(선생님 요청).
test("leaderboard switch off keeps rankings and TOP 3; the TOP 3 switch blocks only TOP 3 (admin settings)", async () => {
  const on = (await getReadingRankings(principal("student"), "api-class", "weekly")).rankings;
  await db.doc("classes/api-class").update({ rankingEnabled: false });
  try {
    assert.deepEqual((await getReadingRankings(principal("student"), "api-class", "weekly")).rankings, on);
    assert.ok((await getReading(principal("student"), "api-class")).state);
    assert.ok(Array.isArray((await getReadingTop(principal("student"), "api-class")).rows));
  } finally { await db.doc("classes/api-class").update({ rankingEnabled: true }); }
  await db.doc("classes/api-class").update({ readingTopEnabled: false });
  try {
    await assert.rejects(() => getReadingTop(principal("student"), "api-class"), (e) => e.status === 403 && e.code === "reading/top-disabled");
    assert.deepEqual((await getReadingRankings(principal("student"), "api-class", "weekly")).rankings, on);
  } finally { await db.doc("classes/api-class").update({ readingTopEnabled: true }); }
});

// 리더보드 스위치는 보이는 화면만 켜고 끕니다(선생님 요청) — 꺼 둔 동안에도 경험치 · 레벨 · 반 집계는 그대로 쌓여,
// 다시 켜면 그동안의 순위가 곧바로 보입니다. 다른 시험과 섞이지 않게 제 반 · 제 학생으로.
test("리더보드를 꺼도 경험치 · 반 집계 · '우리 반 랭킹' · 독서 TOP 3는 그대로", async () => {
  const uid = "api-lb-student";
  const me = { uid, roleClaim: null, db };
  await db.doc("classes/api-lb").set({ createdBy: ids.teacher, readingEnabled: true, archived: false, rankingEnabled: false });
  await db.doc(`users/${uid}`).set({ role: "student", realName: "리더보드학생", studentId: "20177" });
  await db.doc(`memberships/${uid}_api-lb`).set({ uid, classId: "api-lb" });
  await mutateReading(me, payload("api-lb-book-0001", { ...addBook, title: "리더보드를 꺼 둔 반" }, "api-lb"));
  const saved = await mutateReading(me, payload("api-lb-log-0001", { type: "addLog", bookId: "api-lb-book-0001", date: today, startPage: 1, endPage: 30, notes: "리더보드를 꺼 둔 날의 감상" }, "api-lb"));
  assert.ok(saved.summary.xp > 0);
  const member = (await db.doc(`classes/api-lb/readingMembers/${uid}`).get()).data();
  assert.equal(member.totalXp, saved.summary.xp);
  assert.equal(member.level, saved.summary.level);
  assert.equal(member.formula, READING_FORMULA);
  // 꺼 둔 동안에도 순위(학생 본인의 '우리 반 랭킹' 탭)와 독서 TOP 3(제 스위치)는 그대로 나옵니다
  const row = (await getReadingRankings(me, "api-lb", "all-time")).rankings.find((r) => r.uid === uid);
  assert.equal(row.totalXp, saved.summary.xp);
  assert.equal(row.xp, saved.summary.classScores["api-lb"].allTime);
  assert.ok(Array.isArray((await getReadingTop(me, "api-lb")).rows));
  await db.doc("classes/api-lb").update({ rankingEnabled: true });
  assert.deepEqual((await getReadingRankings(principal("teacher"), "api-lb", "all-time")).rankings.find((r) => r.uid === uid), row);
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

test("과일은 경험치가 아님 — 지급 이력이 있어도 경험치가 그대로, 옛 집계의 과일 칸은 다시 적을 때 사라짐(선생님 요청 · 과일은 펫 먹이로만)", async () => {
  const ref = db.doc(`classes/api-class/readingMembers/${ids.student}`);
  const before = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((r) => r.uid === ids.student);
  const own0 = (await getReading(principal("student"), "api-class")).summary;
  await db.collection("classes/api-class/rewardEvents").add({ classId: "api-class", uid: ids.student, delta: 3, count: 3, byUid: ids.teacher, at: new Date() });
  const own1 = (await getReading(principal("student"), "api-class")).summary;
  assert.equal(own1.xp, own0.xp);
  assert.equal(Object.hasOwn(own1, "fruitCount"), false);
  // 옛 기준(2 — 과일 경험치가 들어 있던 때)의 집계는 랭킹을 읽을 때 새 기준으로 다시 적고, 과일 칸은 사라집니다
  await ref.set({ ...(await ref.get()).data(), formula: 2, totalXp: before.totalXp + 30, fruitCount: 3,
    fruits: [{ date: today, count: 3 }], allFruits: [{ classId: "api-class", date: today, count: 3 }], fruitCursor: {} });
  const after = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((r) => r.uid === ids.student);
  assert.equal(after.totalXp, before.totalXp);
  assert.equal(after.xp, before.xp);
  const snap = (await ref.get()).data();
  assert.equal(snap.formula, READING_FORMULA);
  for (const field of ["fruitCount", "fruits", "allFruits", "fruitCursor"]) assert.equal(Object.hasOwn(snap, field), false, field);
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
  for (const style of ["beginner", "intermediate", "advanced"]) {
    const character = { number: 9, style };
    assert.deepEqual(await saveReadingCharacter(principal("student"), { classId: "api-class", character }), { character }, style);
    assert.deepEqual((await profileRef.get()).data(), { ...beforeProfile, readingCharacter: character }, style);
    const afterReading = await getReading(principal("student"), "api-class");
    assert.deepEqual(afterReading.state, beforeReading.state, style);
    assert.equal(afterReading.summary.xp, beforeReading.summary.xp, style);
    const row = (await getReadingRankings(principal("teacher"), "api-class", "all-time")).rankings.find((item) => item.uid === ids.student);
    assert.deepEqual(row.character, character, style);
    assert.equal(row.totalXp, beforeReading.summary.xp, style);
    assert.equal(Object.hasOwn(row, "email"), false, style);
    assert.equal(Object.hasOwn(row, "state"), false, style);
  }
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
  // 리더보드를 꺼 둔 반도 캐릭터는 고릅니다('내 프로필'에서 — 선생님 요청: 리더보드 스위치는 보이는 화면만).
  await db.doc("classes/api-class").update({ rankingEnabled: false });
  try {
    assert.deepEqual((await saveReadingCharacter(principal("student"), { classId: "api-class", character })).character, character);
    assert.deepEqual((await db.doc(`users/${ids.student}`).get()).data().readingCharacter, character);
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
      lastReadDate: before, xpReachedOn: thisWeekXp ? week : before };
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

  // 다른 반 학생 · 독서 TOP 3를 끈 반은 막음(리더보드를 끈 반은 그대로 — 따로 켜고 끔, 선생님 요청)
  await assert.rejects(() => getReadingTop(principal("other"), "api-top"), (e) => e.status === 403);
  await db.doc("classes/api-top").update({ rankingEnabled: false });
  assert.deepEqual((await getReadingTop(principal("teacher"), "api-top")).rows.map((r) => r.uid), ["top-c", "top-b"]);
  await db.doc("classes/api-top").update({ rankingEnabled: true, readingTopEnabled: false });
  await assert.rejects(() => getReadingTop(principal("teacher"), "api-top"), (e) => e.code === "reading/top-disabled");
  await assert.rejects(() => getReadingTop(principal("teacher"), "api-top", { refresh: true }), (e) => e.code === "reading/top-disabled");
});

// 책나눔 상태 — 서재(독서 기록) 한 장으로만 셉니다. 반 집계 · 과일 지급 이력을 읽지도 고쳐 적지도 않습니다
// (한때 과일 경험치 때문에 둘 다 읽고, 다르면 집계를 고쳐 적었습니다).
test("책나눔 상태 — 서재만으로 셈하고 반 집계는 건드리지 않음 · 교사가 보는 학생 책나눔도 같은 값", async () => {
  const memberRef = db.doc(`classes/api-class/readingMembers/${ids.student}`);
  const kept = (await memberRef.get()).data();
  await memberRef.set({ ...kept, sentinel: "그대로" });
  try {
    const own = await getReading(principal("student"), "api-class");
    assert.equal(Object.hasOwn(own, "fruits"), false);
    assert.equal((await getReading(principal("teacher"), "api-class", ids.student)).summary.xp, own.summary.xp);
    assert.equal((await memberRef.get()).data().sentinel, "그대로");
  } finally { await memberRef.set(kept); }
});

test("사용 중지 — 리더보드 · TOP 3에서 빠지고, 옛 TOP 3 장은 새 기준으로 다시 셈 · 다시 세기는 담당 교사만", async () => {
  const week = readingTopWeek(new Date());
  const before = new Date(Date.parse(`${week}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
  const snapshot = (uid, totalXp) => ({ uid, level: getReadingLevel(totalXp), featuredBadge: null, formula: READING_FORMULA,
    events: [{ date: before, xp: totalXp }], xpDays: [{ date: before, xp: totalXp }],
    totalXp, badges: [], totalPages: 0, completedBooks: 0, reviewCount: 0, longestStreak: 0, streakRun: 0,
    lastReadDate: before, xpReachedOn: before });
  const kids = { "su-a": 400, "su-b": 300, "su-c": 200, "su-d": 100 };
  const batch = db.batch();
  batch.set(db.doc("classes/api-susp"), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  Object.entries(kids).forEach(([uid, xp], i) => {
    batch.set(db.doc(`users/${uid}`), { role: "student", realName: `중지${i + 1}`, studentId: `4010${i + 1}`, ...(uid === "su-a" ? { suspended: true } : {}) });
    batch.set(db.doc(`memberships/${uid}_api-susp`), { uid, classId: "api-susp" });
    batch.set(db.doc(`classes/api-susp/readingMembers/${uid}`), snapshot(uid, xp));
  });
  // 이번 주 TOP 3를 옛 서버가 이미 적어 둔 경우 — 고르는 기준 번호(rule)가 없고, 사용 중지된 su-a가 1위
  batch.set(db.doc("classes/api-susp/readingTop/current"), { week, formula: READING_FORMULA,
    rows: Object.entries(kids).map(([uid, xp]) => ({ uid, name: uid, studentId: "", character: null, totalXp: xp, level: getReadingLevel(xp), xpReachedOn: before })) });
  await batch.commit();
  const uids = (rows) => rows.map((r) => r.uid);

  // 리더보드 순위 — 사용 중지된 su-a는 없음(누적 경험치가 가장 많아도)
  const ranked = uids((await getReadingRankings(principal("teacher"), "api-susp", "all-time")).rankings);
  assert.deepEqual(ranked, ["su-b", "su-c", "su-d"]);
  // 기록 · 반 집계는 그대로
  assert.equal((await db.doc("classes/api-susp/readingMembers/su-a").get()).data().totalXp, 400);

  // 옛 기준으로 적힌 이번 주 TOP 3 — 그 자리에서 한 번 다시 셈해 su-a를 빼고, 새 기준 번호를 적음
  assert.deepEqual(uids((await getReadingTop(principal("teacher"), "api-susp")).rows), ["su-b", "su-c", "su-d"]);
  const saved = (await db.doc("classes/api-susp/readingTop/current").get()).data();
  assert.equal(saved.rule, 2);
  assert.ok(!saved.rows.some((r) => r.uid === "su-a"));

  // 주 중간에 사용 중지 — 평소 묻기(GET)는 적어 둔 그 주의 셋 그대로(프로필을 다시 안 읽음)
  await db.doc("users/su-b").update({ suspended: true });
  assert.deepEqual(uids((await getReadingTop(principal("teacher"), "api-susp")).rows), ["su-b", "su-c", "su-d"]);
  // 선생님이 사용 중지를 누르면 앱이 그 반 TOP 3를 다시 세게 함(refresh) — su-b가 빠짐
  assert.deepEqual(uids((await getReadingTop(principal("teacher"), "api-susp", { refresh: true })).rows), ["su-c", "su-d"]);
  assert.ok(!(await db.doc("classes/api-susp/readingTop/current").get()).data().rows.some((r) => r.uid === "su-b"));
  assert.deepEqual(uids((await getReadingTop(principal("teacher"), "api-susp")).rows), ["su-c", "su-d"]);

  // 다시 사용하게 하면 다시 세기로 되돌아옴(그 주 셈 그대로 — 지난 일요일까지의 기록)
  await db.doc("users/su-a").update({ suspended: false });
  assert.deepEqual(uids((await getReadingTop(principal("teacher"), "api-susp", { refresh: true })).rows), ["su-a", "su-c", "su-d"]);
  assert.deepEqual(uids((await getReadingRankings(principal("teacher"), "api-susp", "all-time")).rankings), ["su-a", "su-c", "su-d"]);

  // 다시 세기는 담당 교사 · 관리자만 — 그 반 학생 · 다른 반 사람은 막음
  const studentC = { uid: "su-c", roleClaim: null, db };
  assert.deepEqual(uids((await getReadingTop(studentC, "api-susp")).rows), ["su-a", "su-c", "su-d"]);
  await assert.rejects(() => getReadingTop(studentC, "api-susp", { refresh: true }), (e) => e.status === 403 && e.code === "reading/forbidden");
  await assert.rejects(() => getReadingTop(principal("other"), "api-susp", { refresh: true }), (e) => e.status === 403);
  assert.deepEqual(uids((await getReadingTop(principal("admin"), "api-susp", { refresh: true })).rows), ["su-a", "su-c", "su-d"]);
  // 사용 중지된 학생 본인은 책나눔 API를 못 씀(그대로)
  await assert.rejects(() => getReadingTop({ uid: "su-b", roleClaim: null, db }, "api-susp"), (e) => e.status === 403 && e.code === "reading/suspended");
});

test("독서 펫 — 학생만 알 하나(받을 때의 경험치가 바탕 · 종은 비밀 문서에만), 100 모이면 깨우기, 리더보드 줄에 펫", async () => {
  const { getReadingPet, readingPetAction } = await import("../../lib/server/readingService.js");
  const snapshot = (uid, totalXp) => ({ uid, level: getReadingLevel(totalXp), featuredBadge: null, formula: READING_FORMULA,
    events: [{ date: today, xp: totalXp }], xpDays: [{ date: today, xp: totalXp }],
    totalXp, badges: [], totalPages: 0, completedBooks: 0, reviewCount: 0, longestStreak: 0, streakRun: 0,
    lastReadDate: today, xpReachedOn: today });
  const batch = db.batch();
  batch.set(db.doc("classes/api-pet"), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc("classes/api-pet-off"), { createdBy: ids.teacher, readingEnabled: true, archived: false, petEnabled: false });
  for (const uid of ["pet-a", "pet-b"]) {
    batch.set(db.doc(`users/${uid}`), { role: "student", realName: uid, studentId: uid === "pet-a" ? "50101" : "50102" });
    batch.set(db.doc(`memberships/${uid}_api-pet`), { uid, classId: "api-pet" });
  }
  batch.set(db.doc("memberships/pet-a_api-pet-off"), { uid: "pet-a", classId: "api-pet-off" });
  // pet-a는 이미 1,800 경험치 — 알부터 시작해야 함
  batch.set(db.doc("classes/api-pet/readingMembers/pet-a"), snapshot("pet-a", 1800));
  batch.set(db.doc("classes/api-pet/readingMembers/pet-b"), snapshot("pet-b", 50));
  await batch.commit();
  const a = { uid: "pet-a", roleClaim: null, db };

  // 알 받기 — 바탕은 그때의 누적 경험치(1,800), 프로필에는 종이 없고 비밀 문서에만
  const adopted = await readingPetAction(a, { classId: "api-pet", action: "adopt" });
  assert.equal(adopted.event, "adopted");
  assert.equal(adopted.pet.stage, 1);
  assert.equal(adopted.pet.xp, 0);
  const mirror = (await db.doc("users/pet-a").get()).data().readingPet;
  assert.equal(mirror.species, null);
  assert.equal(mirror.baseXp, 1800);
  const secret = (await db.doc("users/pet-a/reading/pet").get()).data();
  assert.ok(typeof secret.species === "string" && secret.species.length > 0);
  assert.equal(secret.baseXp, mirror.baseXp);
  // 두 번 · 동시에 불러도 알은 하나(종도 그대로)
  const again = await Promise.all([readingPetAction(a, { classId: "api-pet", action: "adopt" }), readingPetAction(a, { classId: "api-pet", action: "adopt" })]);
  assert.ok(again.every((r) => r.event === null));
  assert.equal((await db.doc("users/pet-a/reading/pet").get()).data().species, secret.species);

  // 리더보드 줄 — 알은 종 없이(비밀), 펫이 없는 학생은 null
  const rows = (await getReadingRankings(principal("teacher"), "api-pet", "all-time")).rankings;
  assert.deepEqual(rows.find((r) => r.uid === "pet-a").pet, { species: null, stage: 1, xp: 0, ready: false });
  assert.equal(rows.find((r) => r.uid === "pet-b").pet, null);
  // 처음 받기가 동시에 두 번 와도(두 기기 · 상단바와 펫 카드) 알은 하나 — 하나만 'adopted'
  const b = { uid: "pet-b", roleClaim: null, db };
  const firstB = await Promise.all([readingPetAction(b, { classId: "api-pet", action: "adopt" }), readingPetAction(b, { classId: "api-pet", action: "adopt" })]);
  assert.equal(firstB.filter((r) => r.event === "adopted").length, 1);
  assert.equal((await db.doc("users/pet-b").get()).data().readingPet.baseXp, 50);

  // 아직 100이 안 모였으면 못 깨움
  await assert.rejects(() => readingPetAction(a, { classId: "api-pet", action: "hatch" }), (e) => e.status === 409 && e.code === "reading/pet-not-ready");
  // 독서로 120을 더 얻음 → 깨울 수 있음 · 종은 비밀 문서의 것
  await db.doc("classes/api-pet/readingMembers/pet-a").set(snapshot("pet-a", 1920));
  const ready = (await getReadingRankings(principal("teacher"), "api-pet", "all-time")).rankings.find((r) => r.uid === "pet-a").pet;
  assert.deepEqual(ready, { species: null, stage: 1, xp: 120, ready: true });
  const hatched = await readingPetAction(a, { classId: "api-pet", action: "hatch" });
  assert.equal(hatched.event, "hatched");
  assert.equal(hatched.pet.species, secret.species);
  assert.equal(hatched.pet.stage, 2);
  assert.equal((await db.doc("users/pet-a").get()).data().readingPet.species, secret.species);
  assert.equal((await getReadingPet(a, "api-pet")).pet.species, secret.species);
  // 선생님이 과일을 줘도 펫은 그대로 — 과일은 경험치가 아님(앞으로 펫 먹이로만 · 선생님 요청)
  await db.collection("classes/api-pet/rewardEvents").add({ classId: "api-pet", uid: "pet-a", delta: 5, count: 5, byUid: ids.teacher, at: new Date() });
  assert.equal((await getReadingPet(a, "api-pet")).pet.xp, 120);

  // 막히는 길 — 선생님(펫 없음) · 다른 반 · 펫을 끈 반 · 모르는 요청 · 남의 uid를 끼워 넣기
  await assert.rejects(() => readingPetAction(principal("teacher"), { classId: "api-pet", action: "adopt" }), (e) => e.status === 403 && e.code === "reading/pet-students-only");
  await assert.rejects(() => readingPetAction(principal("other"), { classId: "api-pet", action: "adopt" }), (e) => e.status === 403);
  await assert.rejects(() => readingPetAction(a, { classId: "api-pet-off", action: "adopt" }), (e) => e.status === 403 && e.code === "reading/pet-disabled");
  await assert.rejects(() => getReadingPet(a, "api-pet-off"), (e) => e.code === "reading/pet-disabled");
  await assert.rejects(() => readingPetAction(a, { classId: "api-pet", action: "feed" }), (e) => e.status === 400);
  await assert.rejects(() => readingPetAction(a, { classId: "api-pet", action: "adopt", uid: "pet-b" }), (e) => e.status === 400);
  // 펫을 끈 반의 리더보드에는 펫을 싣지 않음
  await db.doc("classes/api-pet").update({ petEnabled: false });
  assert.equal((await getReadingRankings(principal("teacher"), "api-pet", "all-time")).rankings.find((r) => r.uid === "pet-a").pet, null);
  await db.doc("classes/api-pet").update({ petEnabled: true });
});
