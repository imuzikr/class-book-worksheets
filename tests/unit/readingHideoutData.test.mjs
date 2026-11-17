import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveReading, hideoutOn, initialReadingState, kstToday } from "../../lib/reading.js";
import { hideoutProgress, normalizeHideoutRoom, sameHideoutArrange, validateHideoutLayout } from "../../lib/readingHideout.js";
import { settleHideoutArrange, validateHideoutArrange } from "../../lib/readingHideoutArrange.js";
import { petGrowthOfSummary } from "../../lib/readingPet.js";

// 실제 자료 모듈을 실행하되 Firebase/로그인/서재 경계만 바꿉니다. 실제 네트워크는 호출하지 않습니다.
const source = await readFile(new URL("../../lib/data/readingHideout.js", import.meta.url), "utf8");
let serial = 0;
async function demo({ lowLevel = false } = {}) {
  const values = new Map();
  const stateReads = [];
  let blockWrite = false;
  let user = { uid: "student-a", role: "student" };
  const cls = { id: "class", createdBy: "teacher", readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true };
  const mock = { classes: [cls], demoUsers: [{ uid: "student-a", role: "student" }, { uid: "student-b", role: "student" }],
    memberships: ["student-a", "student-b"].map((uid) => ({ uid, classId: "class" })) };
  const suspended = new Set();
  const state = lowLevel ? initialReadingState() : {
    ...initialReadingState(),
    books: [{ id: "book", title: "공간을 꾸미는 독서", totalPages: 10000 }],
    logs: [{ id: "log", bookId: "book", classId: "class", date: kstToday(), startPage: 1, endPage: 10000 }],
  };
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { if (blockWrite) throw new Error("Quota exceeded"); values.set(key, String(value)); },
    removeItem: (key) => values.delete(key),
  } };
  globalThis.__hideoutDataFixture = {
    isFirebaseConfigured: false,
    mock, hideoutOn,
    demoSuspendedSet: () => suspended,
    isTeacher: (value) => value.role === "teacher" || value.role === "admin",
    deriveReading, hideoutProgress, normalizeHideoutRoom, validateHideoutLayout, petGrowthOfSummary,
    sameHideoutArrange, settleHideoutArrange, validateHideoutArrange,
    demoReadingAccess: (classId, targetUid) => {
      const selected = mock.classes.find((entry) => entry.id === classId);
      if (!selected || !selected.readingEnabled || selected.archived) throw Object.assign(new Error("Disabled"), { code: "reading-disabled" });
      if (targetUid && targetUid !== user.uid && !["teacher", "admin"].includes(user.role)) throw Object.assign(new Error("Forbidden"), { code: "permission-denied" });
      if (user.role === "teacher" && user.uid !== selected.createdBy) throw Object.assign(new Error("Forbidden"), { code: "permission-denied" });
      if (user.role === "student" && !mock.memberships.some((member) => member.uid === user.uid && member.classId === classId)) throw Object.assign(new Error("Forbidden"), { code: "permission-denied" });
      return user;
    },
    demoReadingState: (uid) => { stateReads.push(uid); return state; },
    readingRequest: () => { throw new Error("Unexpected network request"); },
  };
  const injected = `const { isFirebaseConfigured, mock, hideoutOn, demoSuspendedSet, isTeacher, deriveReading, hideoutProgress, normalizeHideoutRoom, validateHideoutLayout, petGrowthOfSummary, sameHideoutArrange, settleHideoutArrange, validateHideoutArrange, demoReadingAccess, demoReadingState, readingRequest } = globalThis.__hideoutDataFixture;\n`
    + source.replace(/^import .+ from "[^"]+";\n/gm, "") + `\n// instance ${serial++}`;
  const module = await import(`data:text/javascript;base64,${Buffer.from(injected).toString("base64")}`);
  return { module, values, cls, mock, suspended, stateReads, blockWrite: (on) => { blockWrite = on; }, switchUser: (uid, role = "student") => { user = { uid, role }; } };
}
after(() => { delete globalThis.window; delete globalThis.__hideoutDataFixture; });

test("demo initial fetch and unchanged save perform no storage writes", async () => {
  const env = await demo();
  const first = await env.module.fetchReadingHideout("class");
  assert.equal(first.room.version, 2);
  assert.equal(Object.keys(first.room.layout).length, 30);
  assert.deepEqual((await env.module.saveReadingHideout("class", first.room)).room, first.room);
  assert.equal(env.values.size, 0);
});

test("demo keeps the latest saved room when quota blocks writes but old storage is still readable", async () => {
  const env = await demo();
  const { module: data } = env;
  const first = await data.fetchReadingHideout("class");
  const saved = await data.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } });
  const key = "bookbom.reading.hideout.v2:student-a";
  assert.equal(JSON.parse(env.values.get(key)).revision, 1);
  env.blockWrite(true);
  const memory = await data.saveReadingHideout("class", { ...saved.room, layout: { ...saved.room.layout, desk: "desk-forest" } });
  assert.equal(memory.room.revision, 2);
  assert.equal(JSON.parse(env.values.get(key)).revision, 1);
  assert.deepEqual((await data.fetchReadingHideout("class")).room, memory.room);
  env.blockWrite(false);
  const recovered = await data.saveReadingHideout("class", { ...memory.room, layout: { ...memory.room.layout, plant: "plant-starlight" } });
  assert.equal(recovered.room.revision, 3);
  assert.equal(JSON.parse(env.values.get(key)).revision, 3);
  // 저장이 다시 되면 다른 탭의 변경을 읽어야 합니다(메모리가 영구히 저장소보다 앞서면 안 됨).
  env.values.set(key, JSON.stringify({ ...recovered.room, revision: 4, layout: { ...recovered.room.layout, shelf: "shelf-forest" } }));
  assert.equal((await data.fetchReadingHideout("class")).room.revision, 4);
  await assert.rejects(() => data.saveReadingHideout("class", recovered.room), (e) => e.code === "reading/hideout-conflict");
});

test("demo room saves remain per student and withdrawal clears both fallback memory and storage", async () => {
  const env = await demo();
  const { module: data } = env;
  const first = await data.fetchReadingHideout("class");
  env.blockWrite(true);
  const saved = await data.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } });
  env.switchUser("student-b");
  assert.equal((await data.fetchReadingHideout("class")).room.layout.rug, "rug-linen");
  env.switchUser("student-a");
  assert.deepEqual((await data.fetchReadingHideout("class")).room, saved.room);
  data.clearDemoReadingHideout("student-a");
  assert.deepEqual((await data.fetchReadingHideout("class")).room, first.room);
  assert.equal(env.values.has("bookbom.reading.hideout.v2:student-a"), false);
});

test("a queued demo save is rejected after identity changes instead of changing the next student's room", async () => {
  const env = await demo();
  const { module: data } = env;
  const first = await data.fetchReadingHideout("class");
  const pending = data.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } });
  env.switchUser("student-b");
  await assert.rejects(() => pending, (e) => e.code === "reading/unauthenticated");
  assert.equal((await data.fetchReadingHideout("class")).room.layout.rug, "rug-linen");
  env.switchUser("student-a");
  assert.equal((await data.fetchReadingHideout("class")).room.layout.rug, "rug-linen");
});

test("feature changes and withdrawal invalidate queued demo saves", async () => {
  const env = await demo();
  const first = await env.module.fetchReadingHideout("class");
  const next = { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } };
  const pending = env.module.saveReadingHideout("class", next);
  env.cls.hideoutEnabled = false;
  await assert.rejects(() => pending, (e) => e.code === "reading/hideout-disabled");
  env.cls.hideoutEnabled = true;
  const withdrawal = env.module.saveReadingHideout("class", next);
  env.module.clearDemoReadingHideout("student-a");
  await assert.rejects(() => withdrawal, (e) => e.code === "reading/unauthenticated");
  assert.deepEqual((await env.module.fetchReadingHideout("class")).room, first.room);
});

test("demo reads and writes obey hideout and parent switches, suspension and unlocks", async () => {
  const env = await demo({ lowLevel: true });
  const first = await env.module.fetchReadingHideout("class");
  for (const feature of ["hideoutEnabled", "classroomEnabled", "plazaEnabled"]) {
    env.cls[feature] = false;
    await assert.rejects(() => env.module.fetchReadingHideout("class"), (e) => e.code === "reading/hideout-disabled");
    await assert.rejects(() => env.module.saveReadingHideout("class", first.room), (e) => e.code === "reading/hideout-disabled");
    env.cls[feature] = true;
  }
  env.suspended.add("student-a");
  await assert.rejects(() => env.module.fetchReadingHideout("class"), (e) => e.code === "reading/suspended");
  env.suspended.clear();
  await assert.rejects(() => env.module.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, "book-trophy": "book-trophy-forest" } }), (e) => e.code === "reading/hideout-locked");
  env.switchUser("teacher", "teacher");
  assert.equal((await env.module.saveReadingHideout("class", first.room)).progress.teacher, true);
});

test("teacher and admin demo rooms unlock decor without reading a student ledger and remain owner-scoped", async () => {
  const env = await demo({ lowLevel: true });
  const student = await env.module.fetchReadingHideout("class");
  for (const role of ["teacher", "admin"]) {
    env.switchUser(role, role);
    const reads = env.stateReads.length;
    const first = await env.module.fetchReadingHideout("class");
    assert.deepEqual(first.progress, { level: 1, earnedBadgeIds: [], teacher: true });
    assert.equal(env.stateReads.length, reads, "teacher access does not read the student ledger");
    const saved = await env.module.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, "book-trophy": "book-trophy-forest" } });
    assert.equal(saved.room.layout["book-trophy"], "book-trophy-forest");
    assert.equal(saved.room.revision, 1);
    assert.deepEqual((await env.module.fetchReadingHideout("class")).room, saved.room);
    assert.equal(env.stateReads.length, reads);
    assert.equal(JSON.parse(env.values.get(`bookbom.reading.hideout.v2:${role}`)).layout["book-trophy"], "book-trophy-forest");
    await assert.rejects(() => env.module.saveReadingHideout("class", { ...saved.room, teacher: true }), (e) => e.code === "reading/invalid-hideout");
    const viewed = await env.module.fetchReadingHideout("class", "student-a");
    assert.deepEqual(viewed.room, student.room);
    assert.equal(viewed.progress.teacher, undefined);
    assert.equal(env.stateReads.length, reads + 1);
    assert.equal(env.stateReads.at(-1), "student-a");
  }
  env.switchUser("student-a");
  assert.equal((await env.module.fetchReadingHideout("class")).progress.teacher, undefined);
  await assert.rejects(() => env.module.saveReadingHideout("class", { ...student.room, layout: { ...student.room.layout, "book-trophy": "book-trophy-forest" } }), (e) => e.code === "reading/hideout-locked");
  assert.equal(env.values.has("bookbom.reading.hideout.v2:student-a"), false);
});

test("teacher room follows the same account across owned demo classes and rejects foreign or disabled entry", async () => {
  const env = await demo({ lowLevel: true });
  env.mock.classes.push({ ...env.cls, id: "second" }, { ...env.cls, id: "foreign", createdBy: "someone-else" });
  env.switchUser("teacher", "teacher");
  const first = await env.module.fetchReadingHideout("class");
  const saved = await env.module.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } });
  assert.deepEqual((await env.module.fetchReadingHideout("second")).room, saved.room);
  await assert.rejects(() => env.module.fetchReadingHideout("foreign"), (e) => e.code === "permission-denied");
  await assert.rejects(() => env.module.saveReadingHideout("foreign", saved.room), (e) => e.code === "permission-denied");
  for (const feature of ["hideoutEnabled", "classroomEnabled", "plazaEnabled", "readingEnabled"]) {
    env.cls[feature] = false;
    await assert.rejects(() => env.module.fetchReadingHideout("class"));
    await assert.rejects(() => env.module.saveReadingHideout("class", saved.room));
    env.cls[feature] = true;
  }
  assert.deepEqual((await env.module.fetchReadingHideout("class")).room, saved.room);
});

test("queued teacher demo saves recheck identity, privileges and feature gates", async () => {
  const env = await demo({ lowLevel: true });
  env.switchUser("teacher", "teacher");
  const first = await env.module.fetchReadingHideout("class");
  const next = { ...first.room, layout: { ...first.room.layout, "book-trophy": "book-trophy-forest" } };
  const denied = env.module.saveReadingHideout("class", next);
  env.cls.hideoutEnabled = false;
  await assert.rejects(() => denied, (e) => e.code === "reading/hideout-disabled");
  env.cls.hideoutEnabled = true;
  const identity = env.module.saveReadingHideout("class", next);
  env.switchUser("student-a");
  await assert.rejects(() => identity, (e) => e.code === "reading/unauthenticated");
  env.switchUser("teacher", "teacher");
  env.mock.memberships.push({ uid: "teacher", classId: "class" });
  const demotion = env.module.saveReadingHideout("class", next);
  env.switchUser("teacher", "student");
  await assert.rejects(() => demotion, (e) => e.code === "reading/hideout-locked");
  env.switchUser("teacher", "teacher");
  assert.deepEqual((await env.module.fetchReadingHideout("class")).room, first.room);
  const saved = await env.module.saveReadingHideout("class", next);
  await assert.rejects(() => env.module.saveReadingHideout("class", first.room), (e) => e.code === "reading/hideout-conflict");
  assert.deepEqual((await env.module.fetchReadingHideout("class")).room, saved.room);
});

test("teacher demo lookup reads the selected student's room while peers and non-student profiles remain private", async () => {
  const env = await demo();
  const first = await env.module.fetchReadingHideout("class");
  const saved = await env.module.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } });
  env.switchUser("student-b");
  await assert.rejects(() => env.module.fetchReadingHideout("class", "student-a"), (e) => e.code === "permission-denied");
  env.switchUser("teacher", "teacher");
  const view = await env.module.fetchReadingHideout("class", "student-a");
  assert.deepEqual(view.room, saved.room);
  // 방 주인의 누적 경험치(서버와 같은 칸) — 선생님이 학생의 방을 볼 때 방석의 펫이 자란 만큼 그리는 바탕
  assert.ok(first.petGrowthXp > 0);
  assert.equal(view.petGrowthXp, first.petGrowthXp);
  // 선생님 본인의 방에는 펫이 없어 싣지 않습니다
  assert.equal("petGrowthXp" in (await env.module.fetchReadingHideout("class")), false);
  await assert.rejects(() => env.module.fetchReadingHideout("class", "../other"), (e) => e.code === "reading/invalid-hideout");
  env.mock.demoUsers[0].role = "teacher";
  await assert.rejects(() => env.module.fetchReadingHideout("class", "student-a"), (e) => e.code === "reading/not-member");
});

test("체험반 — 배치(아지트 2단계: 자리 · 뒤집기 · 돌리기)를 저장하고 다시 읽으며, 문제가 있는 배치는 거절하고, 배치를 모르는 옛 요청은 옮겨 둔 자리를 지우지 않음", async () => {
  const env = await demo();
  const { module: data } = env;
  const first = await data.fetchReadingHideout("class");
  assert.deepEqual(first.room.arrange, {});
  const arranged = await data.saveReadingHideout("class", { ...first.room, arrange: { plant: { x: 600, y: 640 }, desk: { x: 400, y: 880, flip: true, turn: true } } });
  assert.equal(arranged.room.revision, 1);
  assert.deepEqual(arranged.room.arrange, { desk: { x: 400, y: 880, flip: true, turn: true }, plant: { x: 600, y: 640 } });
  assert.deepEqual((await data.fetchReadingHideout("class")).room.arrange, arranged.room.arrange);
  // 배치만 바꿔도 저장(revision이 오름) · 같은 배치를 다시 보내면 쓰지 않음
  const moved = await data.saveReadingHideout("class", { ...arranged.room, arrange: { ...arranged.room.arrange, plant: { x: 640, y: 640 } } });
  assert.equal(moved.room.revision, 2);
  assert.equal((await data.saveReadingHideout("class", moved.room)).room.revision, 2);
  // 포털을 가리거나 다른 가구와 겹치는 배치는 그 까닭으로 거절(저장된 방은 그대로)
  await assert.rejects(() => data.saveReadingHideout("class", { ...moved.room, arrange: { plant: { x: 1416, y: 864 } } }), (e) => e.code === "reading/hideout-arrange" && /포털/.test(e.message));
  await assert.rejects(() => data.saveReadingHideout("class", { ...moved.room, arrange: { nope: { x: 1, y: 1 } } }), (e) => e.code === "reading/invalid-hideout");
  // 포털 옮기기 — 자리를 저장 · 처음 자리로 되돌리기, 방 가운데는 거절
  const portal = await data.saveReadingHideout("class", { ...moved.room, arrange: { ...moved.room.arrange, portal: { x: 1000, y: 720 } } });
  assert.equal(portal.room.revision, 3);
  assert.deepEqual(portal.room.arrange.portal, { x: 1000, y: 720 });
  await assert.rejects(() => data.saveReadingHideout("class", { ...portal.room, arrange: { portal: { x: 760, y: 850 } } }), (e) => e.code === "reading/hideout-arrange" && /캐릭터가 들어오는 자리/.test(e.message));
  const home = await data.saveReadingHideout("class", { ...portal.room, arrange: moved.room.arrange });
  assert.equal(home.room.revision, 4);
  // 배치를 모르는 옛 화면의 요청 — 소품만 바꾸고 옮겨 둔 자리는 그대로
  const { arrange: _old, ...legacy } = home.room;
  const kept = await data.saveReadingHideout("class", { ...legacy, layout: { ...home.room.layout, rug: "rug-starlight" } });
  assert.equal(kept.room.layout.rug, "rug-starlight");
  assert.deepEqual(kept.room.arrange, moved.room.arrange);
});
