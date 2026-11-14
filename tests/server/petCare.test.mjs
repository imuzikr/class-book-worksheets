// 펫 먹이 — 서버(먹이 주기 · 읽은 날 유지 · 다시 부르기 · 선생님이 불러 주기)를 에뮬레이터의 진짜 트랜잭션으로 봅니다.
// 셈 자체는 tests/unit/petCare.test.mjs. Run through `npm run test:reading-server`.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getReadingPet, getReadingRankings, mutateReading, readingPetAction } from "../../lib/server/readingService.js";
import { READING_FORMULA, getReadingLevel, kstToday, readingDayKey, readingDayNumber } from "../../lib/reading.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const app = initializeApp({ projectId }, "pet-care-test-seed");
const db = getFirestore(app);
const C = "care-class";
const OFF = "care-off";
const OLD = "care-old"; // 펫 먹이를 40일 전에 켠 반 — 나중에 들어온 학생
const today = kstToday(new Date());
const dayBefore = (n) => readingDayKey(readingDayNumber(today) - n);
const who = (uid) => ({ uid, roleClaim: null, db });
const snapshot = (uid, totalXp) => ({ uid, level: getReadingLevel(totalXp), featuredBadge: null, formula: READING_FORMULA,
  events: [{ date: today, xp: totalXp }], xpDays: [{ date: today, xp: totalXp }],
  totalXp, badges: [], totalPages: 0, completedBooks: 0, reviewCount: 0, longestStreak: 0, streakRun: 0,
  lastReadDate: today, xpReachedOn: today });
const care = async (uid) => (await db.doc(`users/${uid}`).get()).data().readingPet.care ?? null;
const fruits = async (uid, classId = C) => (await db.doc(`rewards/${classId}_${uid}`).get()).data()?.count ?? null;
const rankings = (uid = "care-teacher") => getReadingRankings(who(uid), C, "all-time", { maxAgeMs: 0 });
const hatched = (extra = {}) => ({ species: "owl", baseXp: 0, assignedAt: Date.now() - 40 * 86400000, hatchedAt: Date.now() - 39 * 86400000, ...extra });
const away = (days = [], fruit = 0) => ({ full: 0, day: dayBefore(1), kept: null, away: { on: dayBefore(1), days, fruit } });

before(async () => {
  const batch = db.batch();
  // 펫 먹이를 사흘 전에 켠 반 — 주말에도 줄게 해 요일과 상관없이 같은 값(켠 날은 안 세고 그제 · 어제 이틀 → 80)
  batch.set(db.doc(`classes/${C}`), { createdBy: "care-teacher", readingEnabled: true, archived: false,
    petFeedEnabled: true, petFeedFrom: Date.parse(`${dayBefore(3)}T12:00:00+09:00`), petRestWeekend: false });
  batch.set(db.doc(`classes/${OFF}`), { createdBy: "care-teacher", readingEnabled: true, archived: false });
  batch.set(db.doc("users/care-teacher"), { role: "teacher", realName: "선생님" });
  batch.set(db.doc("users/care-other-teacher"), { role: "teacher", realName: "다른 선생님" });
  const students = {
    "care-a": hatched(),                              // 먹이 주기
    "care-b": hatched(),                              // 읽은 날
    "care-c": hatched({ care: away() }),              // 떠남 → 걸음으로 돌아옴
    "care-d": hatched({ care: away() }),              // 떠남 → 선생님이 불러 줌
    "care-e": { species: null, baseXp: 0, assignedAt: Date.now() - 40 * 86400000, hatchedAt: null }, // 알
    "care-f": { species: null, baseXp: 0, assignedAt: Date.now() - 40 * 86400000, hatchedAt: null, care: away() }, // 떠난 알
    "care-g": hatched(),                              // 과일 없음
  };
  let n = 0;
  for (const [uid, readingPet] of Object.entries(students)) {
    n += 1;
    batch.set(db.doc(`users/${uid}`), { role: "student", realName: uid, studentId: `6010${n}`, readingPet });
    batch.set(db.doc(`memberships/${uid}_${C}`), { uid, classId: C });
    batch.set(db.doc(`classes/${C}/readingMembers/${uid}`), snapshot(uid, uid === "care-e" || uid === "care-f" ? 150 : 300));
    batch.set(db.doc(`users/${uid}/reading/pet`), { species: "otter", baseXp: 0, classId: C });
  }
  batch.set(db.doc(`memberships/care-a_${OFF}`), { uid: "care-a", classId: OFF });
  batch.set(db.doc(`classes/${OFF}/readingMembers/care-a`), snapshot("care-a", 300));
  batch.set(db.doc(`rewards/${C}_care-a`), { classId: C, uid: "care-a", count: 5, name: "care-a" });
  batch.set(db.doc(`rewards/${OFF}_care-a`), { classId: OFF, uid: "care-a", count: 5 });
  batch.set(db.doc(`rewards/${C}_care-c`), { classId: C, uid: "care-c", count: 5 });
  batch.set(db.doc(`rewards/${C}_care-e`), { classId: C, uid: "care-e", count: 5 });
  // 펫 먹이를 40일 전에 켠 반(주말에도 줆) — care-late는 그제 들어왔고, care-early는 들어온 때를 모릅니다(옛 소속 문서)
  batch.set(db.doc(`classes/${OLD}`), { createdBy: "care-teacher", readingEnabled: true, archived: false,
    petFeedEnabled: true, petFeedFrom: Date.parse(`${dayBefore(40)}T12:00:00+09:00`), petRestWeekend: false });
  for (const [uid, joinedAt] of [["care-late", Timestamp.fromMillis(Date.parse(`${dayBefore(2)}T10:00:00+09:00`))], ["care-early", null]]) {
    batch.set(db.doc(`users/${uid}`), { role: "student", realName: uid, studentId: uid === "care-late" ? "60201" : "60202", readingPet: hatched() });
    batch.set(db.doc(`memberships/${uid}_${OLD}`), { uid, classId: OLD, ...(joinedAt ? { joinedAt } : {}) });
    batch.set(db.doc(`classes/${OLD}/readingMembers/${uid}`), snapshot(uid, 300));
    batch.set(db.doc(`rewards/${OLD}_${uid}`), { classId: OLD, uid, count: 3 });
  }
  await batch.commit();
});
after(async () => { await deleteApp(app); });

test("먹이 주기 — 과일 1개에 +10, 과일은 서버가 줄이고, 100이면 더 안 먹음", async () => {
  const a = who("care-a");
  const before0 = await getReadingPet(a, C);
  assert.equal(before0.care.full, 80);
  assert.equal(before0.care.room, 2);
  const fed = await readingPetAction(a, { classId: C, action: "feed" });
  assert.deepEqual([fed.event, fed.used, fed.fruits, fed.care.full], ["fed", 1, 4, 90]);
  assert.equal(await fruits("care-a"), 4);
  assert.deepEqual({ ...(await care("care-a")), fed: null }, { full: 90, day: dayBefore(1), kept: null, away: null, back: 0, fed: null });
  // 이름표 같은 다른 칸은 그대로
  assert.equal((await db.doc(`rewards/${C}_care-a`).get()).data().name, "care-a");
  // 여러 개를 주려 해도 빈 자리만큼
  const more = await readingPetAction(a, { classId: C, action: "feed", count: 5 });
  assert.deepEqual([more.used, more.fruits, more.care.full, more.care.room], [1, 3, 100, 0]);
  await assert.rejects(() => readingPetAction(a, { classId: C, action: "feed" }), (e) => e.status === 409 && e.code === "reading/pet-full");
  assert.equal(await fruits("care-a"), 3);
  // 지급 이력에는 적지 않음(선생님이 준 것의 기록)
  assert.equal((await db.collection(`classes/${C}/rewardEvents`).get()).size, 0);
  // 틀린 개수 · 남의 uid 끼워 넣기
  await assert.rejects(() => readingPetAction(a, { classId: C, action: "feed", count: 0 }), (e) => e.status === 400);
  await assert.rejects(() => readingPetAction(a, { classId: C, action: "feed", count: 11 }), (e) => e.status === 400);
  await assert.rejects(() => readingPetAction(a, { classId: C, action: "call", count: 2 }), (e) => e.status === 400);
  await assert.rejects(() => readingPetAction(a, { classId: C, action: "feed", uid: "care-b" }), (e) => e.status === 400);
  // 펫 먹이를 켜지 않은 반에서는 과일이 줄지 않음
  await assert.rejects(() => readingPetAction(a, { classId: OFF, action: "feed" }), (e) => e.status === 403 && e.code === "reading/pet-feed-disabled");
  assert.equal(await fruits("care-a", OFF), 5);
  assert.equal((await getReadingPet(a, OFF)).care, null);
});

test("먹이 주기 — 과일이 없거나 · 알이거나 · 떠났으면 막힘, 마지막 과일을 두 번 쓰지 못함", async () => {
  await assert.rejects(() => readingPetAction(who("care-g"), { classId: C, action: "feed" }), (e) => e.status === 409 && e.code === "reading/pet-no-fruit");
  await assert.rejects(() => readingPetAction(who("care-e"), { classId: C, action: "feed" }), (e) => e.status === 409 && e.code === "reading/pet-egg");
  assert.equal(await fruits("care-e"), 5);
  await assert.rejects(() => readingPetAction(who("care-c"), { classId: C, action: "feed" }), (e) => e.status === 409 && e.code === "reading/pet-away");
  await assert.rejects(() => readingPetAction(who("care-teacher"), { classId: C, action: "feed" }), (e) => e.status === 403 && e.code === "reading/pet-students-only");
  // 과일 한 개 · 동시에 두 번 — 한 번만 먹음
  await db.doc(`rewards/${C}_care-g`).set({ classId: C, uid: "care-g", count: 1 });
  const twice = await Promise.allSettled([readingPetAction(who("care-g"), { classId: C, action: "feed" }), readingPetAction(who("care-g"), { classId: C, action: "feed" })]);
  assert.equal(twice.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await fruits("care-g"), 0);
  assert.equal((await care("care-g")).full, 90);
});

test("읽은 날 — 오늘 날짜의 발자국이 5쪽 · 250자 이상이면 배부름 유지, 모자라면 아님, 줄이면 풀림", async () => {
  const b = who("care-b");
  const send = (requestId, action) => mutateReading(b, { classId: C, requestId, action });
  const book = await send("care-book-0001", { type: "addBook", title: "먹이 시험", author: "지은이", totalPages: 300 });
  assert.equal(book.petEvent, undefined);
  assert.equal(await care("care-b"), null);
  // 5쪽이지만 249자 — 아직 아님
  const short = await send("care-log-0001", { type: "addLog", bookId: "care-book-0001", date: today, startPage: 1, endPage: 5, notes: "가".repeat(249) });
  assert.equal(short.petEvent, undefined);
  assert.equal(await care("care-b"), null);
  // 어제 날짜로 넉넉히 남겨도 오늘의 '읽은 날'은 아님
  const past = await send("care-log-0002", { type: "addLog", bookId: "care-book-0001", date: dayBefore(1), startPage: 6, endPage: 30, notes: "나".repeat(400) });
  assert.equal(past.petEvent, undefined);
  // 오늘 것에 한 글자를 더해 250자 — 읽은 날
  const kept = await send("care-edit-0001", { type: "updateLog", logId: "care-log-0001", notes: "가".repeat(250) });
  assert.equal(kept.petEvent, "kept");
  assert.deepEqual(await care("care-b"), { full: 80, day: dayBefore(1), kept: today, away: null, back: 0, fed: null });
  assert.equal((await getReadingPet(b, C)).care.keptToday, true);
  // 같은 날 또 저장해도 다시 적지 않음 · 같은 요청을 다시 보내도 그대로
  const again = await send("care-log-0003", { type: "addLog", bookId: "care-book-0001", date: today, startPage: 31, endPage: 40, notes: "다".repeat(10) });
  assert.equal(again.petEvent, undefined);
  const replay = await send("care-edit-0001", { type: "updateLog", logId: "care-log-0001", notes: "가".repeat(250) });
  assert.equal(replay.replayed, true);
  // 오늘 기록을 줄이면 풀림
  await send("care-del-0001", { type: "deleteLog", logId: "care-log-0003" });
  const undone = await send("care-edit-0002", { type: "updateLog", logId: "care-log-0001", notes: "가".repeat(100) });
  assert.equal(undone.petEvent, "unkept");
  assert.equal((await care("care-b")).kept, null);
  // 펫 먹이를 켜지 않은 반에서 쓴 기록은 care를 건드리지 않음
  const aOff = await mutateReading(who("care-a"), { classId: OFF, requestId: "care-off-0001", action: { type: "addBook", title: "꺼진 반", author: "지은이", totalPages: 100 } });
  assert.equal(aOff.petEvent, undefined);
});

test("떠난 펫 — 친구 화면에서는 표시 없이 안 보이고, 걸음(읽은 날 · 과일 2개)을 채우면 같은 펫이 60으로 돌아옴", async () => {
  const c = who("care-c");
  const view = await getReadingPet(c, C);
  assert.deepEqual([view.care.away, view.care.full, view.care.steps.need, view.care.steps.done], [true, 0, 3, 0]);
  const rowsBefore = (await rankings()).rankings;
  assert.equal(rowsBefore.find((r) => r.uid === "care-c").pet, null);
  assert.equal(rowsBefore.find((r) => r.uid === "care-a").pet.species, "owl");
  assert.equal(rowsBefore.some((r) => "care" in r), false); // care는 화면에 보내지 않음
  assert.equal((await rankings("care-c")).rankings.find((r) => r.uid === "care-c").pet, null); // 본인의 줄도 같음
  // 과일 2개로 한 걸음
  const step1 = await readingPetAction(c, { classId: C, action: "call" });
  assert.deepEqual([step1.event, step1.used, step1.fruits, step1.care.steps.done], ["step", 2, 3, 1]);
  assert.equal(await fruits("care-c"), 3);
  // 읽은 날이 한 걸음
  await mutateReading(c, { classId: C, requestId: "care-c-book-01", action: { type: "addBook", title: "돌아와", author: "지은이", totalPages: 200 } });
  const read = await mutateReading(c, { classId: C, requestId: "care-c-log-001", action: { type: "addLog", bookId: "care-c-book-01", date: today, startPage: 1, endPage: 8, notes: "라".repeat(260) } });
  assert.equal(read.petEvent, "step");
  assert.deepEqual((await care("care-c")).away, { on: dayBefore(1), days: [today], fruit: 1 });
  // 마지막 걸음 — 돌아옴(같은 펫 · 배부름 60 · 오늘은 읽은 날)
  const step3 = await readingPetAction(c, { classId: C, action: "call" });
  assert.deepEqual([step3.event, step3.fruits, step3.care.away, step3.care.full], ["returned", 1, false, 60]);
  assert.deepEqual({ ...(await care("care-c")) }, { full: 60, day: today, kept: today, away: null, back: 1, fed: null });
  assert.equal((await db.doc("users/care-c").get()).data().readingPet.species, "owl");
  assert.equal((await rankings()).rankings.find((r) => r.uid === "care-c").pet.species, "owl");
  // 곁에 있는 펫은 다시 부를 것이 없음 · 과일도 그대로
  await assert.rejects(() => readingPetAction(c, { classId: C, action: "call" }), (e) => e.status === 409 && e.code === "reading/pet-not-away");
  assert.equal(await fruits("care-c"), 1);
});

test("선생님이 불러 주기 — 담당 교사만, 그 반 학생의 떠난 펫만", async () => {
  await assert.rejects(() => readingPetAction(who("care-a"), { classId: C, action: "recall", uid: "care-d" }), (e) => e.status === 403 && e.code === "reading/forbidden");
  await assert.rejects(() => readingPetAction(who("care-other-teacher"), { classId: C, action: "recall", uid: "care-d" }), (e) => e.status === 403);
  await assert.rejects(() => readingPetAction(who("care-teacher"), { classId: C, action: "recall", uid: "nobody" }), (e) => e.status === 404 && e.code === "reading/not-member");
  await assert.rejects(() => readingPetAction(who("care-teacher"), { classId: C, action: "recall" }), (e) => e.status === 400);
  await assert.rejects(() => readingPetAction(who("care-teacher"), { classId: C, action: "recall", uid: "care-a" }), (e) => e.status === 409 && e.code === "reading/pet-not-away");
  await assert.rejects(() => readingPetAction(who("care-teacher"), { classId: OFF, action: "recall", uid: "care-a" }), (e) => e.status === 403 && e.code === "reading/pet-feed-disabled");
  const back = await readingPetAction(who("care-teacher"), { classId: C, action: "recall", uid: "care-d" });
  assert.deepEqual([back.event, back.care.away, back.care.full], ["returned", false, 60]);
  assert.deepEqual(await care("care-d"), { full: 60, day: today, kept: null, away: null, back: 1, fed: null });
});

test("알 — 떠난 알은 먼저 불러야 깨우고, 깨어난 펫은 배부름 100에서 시작", async () => {
  await assert.rejects(() => readingPetAction(who("care-f"), { classId: C, action: "hatch" }), (e) => e.status === 409 && e.code === "reading/pet-away");
  const e = who("care-e");
  assert.equal((await getReadingPet(e, C)).care.full, 80); // 알도 날마다 줄어듦
  const born = await readingPetAction(e, { classId: C, action: "hatch" });
  assert.equal(born.event, "hatched");
  assert.equal(born.pet.species, "otter");
  assert.deepEqual(await care("care-e"), { full: 100, day: today, kept: null, away: null, back: 0, fed: null });
  // 깨어난 뒤에는 먹음(100이라 지금은 배부름)
  await assert.rejects(() => readingPetAction(e, { classId: C, action: "feed" }), (err) => err.code === "reading/pet-full");
});

test("반에 들어온 날부터 셈 — 미리 만들어 둔 반에 나중에 들어온 학생의 펫은 떠나 있지 않음", async () => {
  const late = who("care-late");
  // 그제 들어옴 — 들어온 날은 세지 않고 어제 하루만(90). 40일 전부터 세었다면 떠나 있었을 펫
  const view = await getReadingPet(late, OLD);
  assert.deepEqual([view.care.away, view.care.full], [false, 90]);
  // 들어온 때를 모르는 학생(옛 소속 문서)은 켠 날부터 — 떠나 있음
  const early = await getReadingPet(who("care-early"), OLD);
  assert.deepEqual([early.care.away, early.care.full], [true, 0]);
  // 친구 화면(순위) — 나중에 들어온 학생의 펫은 보이고, 떠난 펫은 표시 없이 안 보임
  const rows = (await getReadingRankings(who("care-teacher"), OLD, "all-time", { maxAgeMs: 0 })).rankings;
  assert.equal(rows.find((r) => r.uid === "care-late").pet.species, "owl");
  assert.equal(rows.find((r) => r.uid === "care-early").pet, null);
  assert.equal(rows.some((r) => "care" in r), false);
  // 먹이 주기 · 읽은 날 · 선생님이 불러 주기도 같은 셈
  const fed = await readingPetAction(late, { classId: OLD, action: "feed" });
  assert.deepEqual([fed.used, fed.fruits, fed.care.full], [1, 2, 100]);
  assert.deepEqual({ ...(await care("care-late")), fed: null }, { full: 100, day: dayBefore(1), kept: null, away: null, back: 0, fed: null });
  await mutateReading(late, { classId: OLD, requestId: "care-late-bk01", action: { type: "addBook", title: "새 반에서", author: "지은이", totalPages: 200 } });
  const read = await mutateReading(late, { classId: OLD, requestId: "care-late-lg01", action: { type: "addLog", bookId: "care-late-bk01", date: today, startPage: 1, endPage: 6, notes: "마".repeat(250) } });
  assert.equal(read.petEvent, "kept");
  await assert.rejects(() => readingPetAction(who("care-teacher"), { classId: OLD, action: "recall", uid: "care-late" }), (e) => e.status === 409 && e.code === "reading/pet-not-away");
  const back = await readingPetAction(who("care-teacher"), { classId: OLD, action: "recall", uid: "care-early" });
  assert.deepEqual([back.event, back.care.away, back.care.full], ["returned", false, 60]);
});
