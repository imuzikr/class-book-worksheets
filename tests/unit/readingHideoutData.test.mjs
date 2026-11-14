import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveReading, hideoutOn, initialReadingState, kstToday } from "../../lib/reading.js";
import { hideoutProgress, normalizeHideoutRoom, validateHideoutLayout } from "../../lib/readingHideout.js";

// 실제 자료 모듈을 실행하되 Firebase/로그인/서재 경계만 바꿉니다. 실제 네트워크는 호출하지 않습니다.
const source = await readFile(new URL("../../lib/data/readingHideout.js", import.meta.url), "utf8");
let serial = 0;
async function demo({ lowLevel = false } = {}) {
  const values = new Map();
  let blockWrite = false;
  let user = { uid: "student-a", role: "student" };
  const cls = { id: "class", createdBy: "teacher", readingEnabled: true, plazaEnabled: true, classroomEnabled: true, hideoutEnabled: true };
  const mock = { classes: [cls], demoUsers: [{ uid: "student-a", role: "student" }, { uid: "student-b", role: "student" }] };
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
    deriveReading, hideoutProgress, normalizeHideoutRoom, validateHideoutLayout,
    demoReadingAccess: (classId, targetUid) => {
      if (classId !== cls.id || !cls.readingEnabled || cls.archived) throw Object.assign(new Error("Disabled"), { code: "reading-disabled" });
      if (targetUid && targetUid !== user.uid && !["teacher", "admin"].includes(user.role)) throw Object.assign(new Error("Forbidden"), { code: "permission-denied" });
      if (user.role === "teacher" && user.uid !== cls.createdBy) throw Object.assign(new Error("Forbidden"), { code: "permission-denied" });
      return user;
    },
    demoReadingState: () => state,
    readingRequest: () => { throw new Error("Unexpected network request"); },
  };
  const injected = `const { isFirebaseConfigured, mock, hideoutOn, demoSuspendedSet, isTeacher, deriveReading, hideoutProgress, normalizeHideoutRoom, validateHideoutLayout, demoReadingAccess, demoReadingState, readingRequest } = globalThis.__hideoutDataFixture;\n`
    + source.replace(/^import .+ from "[^"]+";\n/gm, "") + `\n// instance ${serial++}`;
  const module = await import(`data:text/javascript;base64,${Buffer.from(injected).toString("base64")}`);
  return { module, values, cls, mock, suspended, blockWrite: (on) => { blockWrite = on; }, switchUser: (uid, role = "student") => { user = { uid, role }; } };
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
  await assert.rejects(() => env.module.saveReadingHideout("class", first.room), (e) => e.code === "reading/hideout-students-only");
});

test("teacher demo lookup reads the selected student's room while peers and non-student profiles remain private", async () => {
  const env = await demo();
  const first = await env.module.fetchReadingHideout("class");
  const saved = await env.module.saveReadingHideout("class", { ...first.room, layout: { ...first.room.layout, rug: "rug-starlight" } });
  env.switchUser("student-b");
  await assert.rejects(() => env.module.fetchReadingHideout("class", "student-a"), (e) => e.code === "permission-denied");
  env.switchUser("teacher", "teacher");
  assert.deepEqual((await env.module.fetchReadingHideout("class", "student-a")).room, saved.room);
  await assert.rejects(() => env.module.fetchReadingHideout("class", "../other"), (e) => e.code === "reading/invalid-hideout");
  env.mock.demoUsers[0].role = "teacher";
  await assert.rejects(() => env.module.fetchReadingHideout("class", "student-a"), (e) => e.code === "reading/not-member");
});
