// 책 광장의 실시간 — 서버가 적는 입장권(plazaAction의 enter), 화면끼리 주고받는 통로(lib/plazaLiveChannel.js),
// 언제 잇고 놓는지(lib/plazaLiveSession.js).
// Auth · Firestore · Realtime Database 에뮬레이터에서 **진짜 규칙(database.rules.json)**과 진짜 SDK로 봅니다:
// 입장권은 서버(Admin)가 적고, 두 사람은 화면과 같은 SDK로 이어 서로의 자리를 주고받습니다.
// 화면(탭이 가려짐 · 누르기)만 가짜로 넣습니다.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabaseWithUrl } from "firebase-admin/database";
import { initializeApp as initClient, deleteApp as deleteClient } from "firebase/app";
import { connectDatabaseEmulator, get, getDatabase, goOffline, goOnline, ref } from "firebase/database";
import { plazaAction, resetReadingRankings } from "../../lib/server/readingService.js";
import { openPlazaChannel } from "../../lib/plazaLiveChannel.js";
import { createPlazaLiveSession } from "../../lib/plazaLiveSession.js";
import { PLAZA_LIVE_TTL_MS, plazaLivePos, readPlazaLivePos, readPlazaLiveWho } from "../../lib/readingPlazaLive.js";
import { characterOf } from "../../lib/readingCharacterCatalog.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use the auth, firestore and database emulators and a demo- project; production execution is forbidden.");
}
const DATABASE_URL = `https://${projectId}-default-rtdb.firebaseio.com`;
const seedApp = initializeApp({ projectId }, "plaza-live-test-seed");
const db = getFirestore(seedApp);
const rtdb = getDatabaseWithUrl(DATABASE_URL, seedApp);
const CLASS = "plv-class";
const OFF = "plv-class-off";
const ids = { a: "plv-a", b: "plv-b", egg: "plv-egg", out: "plv-out", stop: "plv-stop", teacher: "plv-teacher", other: "plv-other-teacher" };
const who = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const enter = (kind, classId = CLASS) => plazaAction(who(kind), { classId, action: "enter" });
const tree = async (classId = CLASS) => (await rtdb.ref(`plaza/${classId}`).get()).val() ?? {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, ms = 4000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) assert.fail(`기다렸지만 오지 않음: ${label}`);
    await sleep(25);
  }
}

// 화면과 같은 SDK로 에뮬레이터에 잇습니다 — 그 사람으로 로그인한 것처럼(mockUserToken).
const clients = [];
function clientDb(uid) {
  const app = initClient({ projectId, databaseURL: DATABASE_URL }, `plaza-live-${uid}-${clients.length}`);
  const database = getDatabase(app);
  const [host, port] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(":");
  connectDatabaseEmulator(database, host, Number(port), { mockUserToken: { sub: uid } });
  clients.push(app);
  return database;
}
// 통로 하나 — 들은 것을 모아 둡니다
function join(uid, classId = CLASS) {
  const heard = { who: new Map(), pos: new Map(), posLog: [], denied: [], linked: false, clock: null };
  const database = clientDb(uid);
  const channel = openPlazaChannel(database, {
    classId, uid,
    onWho: (id, raw) => heard.who.set(id, raw),
    onWhoGone: (id) => heard.who.delete(id),
    onPos: (id, raw) => { heard.pos.set(id, raw); heard.posLog.push({ id, raw }); },
    onPosGone: (id) => heard.pos.delete(id),
    onClock: (offset) => { heard.clock = offset; },
    onLink: (linked) => { heard.linked = linked; },
    onDenied: (error) => heard.denied.push(String(error?.code || error?.message || error)),
  });
  return { database, channel, heard };
}

// 규칙을 갈아 끼웁니다 — 에뮬레이터 설정(tests/server/firebase.json)은 제 폴더 밖의 파일을 못 읽어, 처음에는
// 모두 막는 규칙(tests/server/database.rules.json)으로 뜨고 저장소의 database.rules.json(진짜 규칙)을 여기서 올립니다.
const REAL_RULES = readFileSync(fileURLToPath(new URL("../../database.rules.json", import.meta.url)), "utf8");
const DENY_RULES = JSON.stringify({ rules: { ".read": false, ".write": false } });
async function putRules(rules) {
  const put = await fetch(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/.settings/rules.json?ns=${projectId}-default-rtdb`, {
    method: "PUT", headers: { Authorization: "Bearer owner" }, body: rules,
  });
  assert.equal(put.ok, true, "규칙을 올리지 못함");
}

// 한 화면의 입장(lib/plazaLiveSession.js) — 서버 · 데이터베이스 · 규칙은 진짜, 화면(가려짐 · 누르기)만 가짜.
// 때는 짧게 줄입니다(가려진 지 0.12초면 놓음). 가만히 둔 화면을 놓는 때는 그것을 보는 시험에서만 줄입니다.
const visits = [];
function visit(kind, { teacher = false, times = {}, enterWith = null } = {}) {
  const uid = ids[kind];
  const database = clientDb(uid);
  const heard = { status: [], here: new Map(), moves: [], entered: 0, connected: 0 };
  let holders = 0;
  const view = { hidden: false, input: null, visibility: null, state: { x: 700, y: 330, path: [], mode: 0, facing: "down", reading: false } };
  const session = createPlazaLiveSession({
    classId: CLASS, me: { uid, teacher },
    handlers: {
      current: () => view.state,
      // 교실에서 제자리에 앉아 있는가(앉아 있으면 가만히 있어도 더 오래 이어 둠)
      keep: () => !!view.seated,
      onJoin: (id, ticket, pos, age) => heard.here.set(id, { who: ticket, pos, age }),
      onWho: (id, ticket) => { const row = heard.here.get(id); if (row) row.who = ticket; },
      onMove: (id, pos) => { const row = heard.here.get(id); if (row) row.pos = pos; heard.moves.push(id); },
      onLeave: (id) => heard.here.delete(id),
      onStatus: (status, why) => heard.status.push(why ? `${status}:${why}` : status),
    },
    enter: async () => { heard.entered += 1; return enterWith ? enterWith(heard.entered) : enter(kind); },
    // 화면(lib/data/plazaLive.js)과 같은 약속 — 쓰는 통로 수를 세어 0이 될 때만 연결을 놓습니다
    // (쉬었다 곧 돌아오면 앞 통로의 '나감'이 닿기 전에 새 통로가 이미 쓰고 있음)
    connect: async () => {
      heard.connected += 1;
      holders += 1;
      if (holders === 1) goOnline(database);
      let released = false;
      return {
        open: (handlers) => openPlazaChannel(database, handlers),
        release() {
          if (released) return;
          released = true;
          holders -= 1;
          if (!holders) { try { goOffline(database); } catch { /* 시험이 끝나 이미 지운 앱 */ } }
        },
      };
    },
    page: {
      hidden: () => view.hidden,
      watch(onInput, onVisibility) { view.input = onInput; view.visibility = onVisibility; return () => { view.input = null; view.visibility = null; }; },
    },
    times: { retry: 150, beat: 50, renew: 60000, again: 3000, hidden: 120, idle: 600000, ...times },
  });
  visits.push(session);
  const now = () => heard.status.at(-1);
  return { session, heard, view, now, uid };
}

before(async () => {
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = DATABASE_URL;
  await putRules(REAL_RULES);
  await rtdb.ref("plaza").remove();
  const batch = db.batch();
  batch.set(db.doc(`classes/${CLASS}`), { createdBy: ids.teacher, readingEnabled: true, plazaEnabled: true, archived: false });
  batch.set(db.doc(`classes/${OFF}`), { createdBy: ids.teacher, readingEnabled: true, archived: false });
  batch.set(db.doc(`users/${ids.a}`), { role: "student", realName: "김하나", studentId: "30101", displayName: "익명 이름", readingCharacter: { style: "animal", number: 7 }, readingPet: { species: "hedgehog", baseXp: 0, assignedAt: 1, hatchedAt: 2 } });
  batch.set(db.doc(`users/${ids.b}`), { role: "student", realName: "이두리", studentId: "30102" });
  batch.set(db.doc(`users/${ids.egg}`), { role: "student", realName: "박알", studentId: "30103", readingPet: { species: null, baseXp: 0, assignedAt: 1, hatchedAt: null } });
  batch.set(db.doc(`users/${ids.out}`), { role: "student", realName: "반 밖 학생", studentId: "30199" });
  batch.set(db.doc(`users/${ids.stop}`), { role: "student", realName: "멈춘 학생", studentId: "30104", suspended: true });
  batch.set(db.doc(`users/${ids.teacher}`), { role: "teacher", realName: "담임 교사" });
  batch.set(db.doc(`users/${ids.other}`), { role: "teacher", realName: "옆 반 교사" });
  for (const kind of ["a", "b", "egg", "stop"]) {
    batch.set(db.doc(`memberships/${ids[kind]}_${CLASS}`), { uid: ids[kind], classId: CLASS });
    batch.set(db.doc(`memberships/${ids[kind]}_${OFF}`), { uid: ids[kind], classId: OFF });
  }
  // 펫 단계는 이 반 집계의 누적 경험치로 셉니다(500 EXP = 4단계)
  batch.set(db.doc(`classes/${CLASS}/readingMembers/${ids.a}`), { totalXp: 500 });
  await batch.commit();
});
after(async () => {
  // 실패한 시험이 열어 둔 입장까지 닫습니다(살피는 타이머가 남으면 시험이 끝나지 않음).
  // 닫은 입장은 '나감' 표시가 닿은 뒤(늦어도 0.8초) 연결을 놓으므로, 그 뒤에 앱을 지웁니다.
  visits.forEach((session) => session.close());
  await sleep(900);
  await Promise.all(clients.map((app) => deleteClient(app).catch(() => {})));
  // 서버 코드가 연 앱(reading-suite)까지 닫습니다 — Realtime Database는 연결(웹소켓)을 열어 둬, 안 닫으면 시험이 끝나지 않습니다.
  await Promise.all(getApps().map((app) => deleteApp(app).catch(() => {})));
});

test("입장권 — 서버가 반 구성원인지 본 뒤 이름표 · 캐릭터 · 펫을 적어 준다", async () => {
  const before = Date.now();
  const result = await enter("a");
  assert.equal(result.live, true);
  assert.ok(result.expiresAt >= before + PLAZA_LIVE_TTL_MS && result.expiresAt <= Date.now() + PLAZA_LIVE_TTL_MS);
  const ticket = (await tree()).who[ids.a];
  assert.deepEqual(ticket, { n: "김하나", c: "animal-07", p: "hedgehog", ps: 4, exp: result.expiresAt });
  // 익명 이름 · 학번 · 이메일 같은 프로필 안쪽 칸은 싣지 않는다
  assert.equal(JSON.stringify(ticket).includes("익명"), false);
  assert.equal(JSON.stringify(ticket).includes("30101"), false);

  // 캐릭터를 안 고른 학생은 기본 캐릭터 · 펫을 안 받은 학생은 펫 없음
  await enter("b");
  const plain = (await tree()).who[ids.b];
  const base = characterOf({ uid: ids.b });
  assert.deepEqual({ n: plain.n, c: plain.c, ps: plain.ps, hasPet: "p" in plain }, { n: "이두리", c: `${base.style}-${String(base.number).padStart(2, "0")}`, ps: 0, hasPet: false });
  // 알 — 종은 싣지 않는다(비밀)
  await enter("egg");
  const egg = (await tree()).who[ids.egg];
  assert.deepEqual({ p: egg.p, ps: egg.ps }, { p: "", ps: 1 });
  assert.deepEqual(readPlazaLiveWho(egg, Date.now()).pet, { species: null, stage: 1 });
  // 선생님 — 이름표는 '선생님', 펫 없음
  await enter("teacher");
  const teacher = (await tree()).who[ids.teacher];
  assert.deepEqual({ n: teacher.n, r: teacher.r, ps: teacher.ps }, { n: "선생님", r: 1, ps: 0 });
  assert.equal(JSON.stringify(teacher).includes("담임"), false);
});

test("입장권 — 반 밖 · 사용 중지 · 다른 반 교사 · 광장을 끈 반에는 주지 않는다", async () => {
  await assert.rejects(() => enter("out"), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => enter("stop"), (e) => e.code === "reading/suspended");
  await assert.rejects(() => enter("other"), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => enter("a", OFF), (e) => e.code === "reading/plaza-disabled");
  const now = await tree();
  for (const kind of ["out", "stop", "other"]) assert.equal(now.who[ids[kind]], undefined);
  assert.deepEqual(await tree(OFF), {});
  await assert.rejects(() => plazaAction(who("a"), { classId: "bad/class", action: "enter" }));
});

test("주소(환경변수)가 없으면 실시간을 쓰지 않는다 — 광장은 그대로", async () => {
  const saved = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  try {
    for (const value of ["", "http://example.com", "https://evil.example.com/db", undefined]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      else process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = value;
      assert.deepEqual(await enter("a"), { live: false });
      // 그래도 반 구성원인지는 본다
      await assert.rejects(() => enter("out"), (e) => e.code === "reading/forbidden");
    }
  } finally {
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = saved;
  }
});

test("입장할 때 죽은 것을 걷는다 — 만료된 입장권 · 주인 없는 자리", async () => {
  const now = Date.now();
  await rtdb.ref(`plaza/${CLASS}`).update({
    "who/plv-old": { n: "지난 학생", c: "zodiac-01", ps: 0, exp: now - 1000 },
    "pos/plv-old": { x: 1, y: 1, m: 0, f: 0, t: now - 5000 },
    "pos/plv-orphan": { x: 2, y: 2, m: 0, f: 0, t: now - 5000 },
    [`pos/${ids.b}`]: { x: 700, y: 400, m: 0, f: 1, t: now - 5000 },
  });
  await enter("a");
  const after = await tree();
  assert.equal(after.who["plv-old"], undefined);
  assert.equal(after.pos["plv-old"], undefined);
  assert.equal(after.pos["plv-orphan"], undefined);
  assert.equal(after.pos[ids.b].x, 700, "입장권이 살아 있는 친구의 자리는 그대로");
  assert.ok(after.who[ids.a] && after.who[ids.b] && after.who[ids.teacher]);
});

test("통로 — 두 사람이 서로의 이름표와 자리를 주고받는다(진짜 규칙)", async () => {
  await enter("a");
  await enter("b");
  const a = join(ids.a);
  const b = join(ids.b);
  await until(() => a.heard.linked && b.heard.linked, "두 사람이 이어짐");
  await until(() => b.heard.who.has(ids.a) && a.heard.who.has(ids.b), "서로의 입장권");
  assert.equal(readPlazaLiveWho(b.heard.who.get(ids.a), Date.now()).name, "김하나");
  assert.equal(typeof a.heard.clock, "number");

  // A가 길을 따라 걷기 시작 → B가 듣는다(서버 시각이 붙어서)
  a.channel.publish(plazaLivePos({ x: 836, y: 330, path: [{ x: 900, y: 420 }, { x: 1010, y: 455 }], mode: 1, facing: "right" }));
  const first = await until(() => b.heard.pos.get(ids.a), "A의 자리");
  const seen = readPlazaLivePos(first);
  assert.deepEqual({ x: seen.x, y: seen.y, path: seen.path, mode: seen.mode, facing: seen.facing, gone: seen.gone },
    { x: 836, y: 330, path: [{ x: 900, y: 420 }, { x: 1010, y: 455 }], mode: 1, facing: "right", gone: false });
  assert.ok(Math.abs(seen.t - Date.now()) < 5000, "서버 시각");
  // 제 자리는 저에게 되돌아오지 않는다
  assert.equal(a.heard.pos.has(ids.a), false);

  // 연달아 여러 번 올려도(방향키를 마구 누름) 규칙에 걸리지 않고 마지막 자리가 간다 — 사이의 것은 모아서 버림
  for (let i = 1; i <= 12; i += 1) a.channel.publish(plazaLivePos({ x: 836 + i * 10, y: 330, mode: 2, facing: "right" }));
  await until(() => b.heard.pos.get(ids.a)?.x === 956, "마지막 자리");
  const burst = b.heard.posLog.filter((row) => row.id === ids.a).length;
  assert.ok(burst <= 4, `열두 번을 올려도 서버에는 두어 번만 간다(${burst}번)`);
  assert.deepEqual(a.heard.denied, []);

  // B도 올리고 A가 듣는다 — 글을 읽는 중
  b.channel.publish(plazaLivePos({ x: 250, y: 436, mode: 0, facing: "left", reading: true }));
  const reading = await until(() => a.heard.pos.get(ids.b)?.a === 1 && a.heard.pos.get(ids.b), "B의 자리");
  assert.deepEqual({ x: reading.x, f: reading.f, a: reading.a }, { x: 250, f: 3, a: 1 });
  // 같은 자리를 거듭 올려도 서버에는 다시 가지 않는다(친구 수만큼 내려받는 양이 드는 일)
  const once = a.heard.posLog.filter((row) => row.id === ids.b).length;
  for (let i = 0; i < 5; i += 1) b.channel.publish(plazaLivePos({ x: 250, y: 436, mode: 0, facing: "left", reading: true }));
  await sleep(500);
  assert.equal(a.heard.posLog.filter((row) => row.id === ids.b).length, once);

  // A가 광장을 나감 → B에게 '나감'이 간다(자리를 지우지 않고 표시)
  await a.channel.close();
  const gone = await until(() => b.heard.pos.get(ids.a)?.g === 1 && b.heard.pos.get(ids.a), "A의 나감");
  assert.equal(readPlazaLivePos(gone).gone, true);
  assert.equal((await tree()).pos[ids.a].g, 1);

  // B의 연결이 그냥 끊김(탭을 닫음 · 와이파이) → 서버가 대신 '나감'을 남긴다
  goOffline(b.database);
  await until(async () => (await tree()).pos[ids.b]?.g === 1, "끊긴 B의 나감");
});

test("통로 — 다시 들어오면 자리가 되살아난다 · 같은 계정의 다른 탭이 닫혀도 남은 탭이 다시 올린다", async () => {
  await enter("a");
  await enter("b");
  const watcher = join(ids.b);
  const tab1 = join(ids.a);
  await until(() => tab1.heard.linked && watcher.heard.linked, "이어짐");
  tab1.channel.publish(plazaLivePos({ x: 600, y: 700, mode: 0, facing: "down" }));
  await until(() => watcher.heard.pos.get(ids.a)?.x === 600 && watcher.heard.pos.get(ids.a)?.g !== 1, "A가 돌아옴");
  // 같은 계정으로 탭을 하나 더 열었다 닫음 → 남은 탭(tab1)이 '나감'을 보고 제 자리를 다시 올린다
  const tab2 = join(ids.a);
  await until(() => tab2.heard.linked, "둘째 탭");
  tab2.channel.publish(plazaLivePos({ x: 640, y: 700, mode: 0, facing: "down" }));
  await until(() => watcher.heard.pos.get(ids.a)?.x === 640, "둘째 탭의 자리");
  await tab2.channel.close();
  await until(() => watcher.heard.pos.get(ids.a)?.g === 1, "둘째 탭이 나감");
  await until(() => watcher.heard.pos.get(ids.a)?.g !== 1 && watcher.heard.pos.get(ids.a)?.x === 600, "남은 탭이 다시 올림");
  await tab1.channel.close();
  await watcher.channel.close();
});

test("통로 — 입장권이 없으면 듣지도 올리지도 못하고, 그 사실을 알린다", async () => {
  const stranger = join(ids.out);
  await until(() => stranger.heard.denied.length > 0, "읽기 거부");
  assert.equal(stranger.heard.who.size, 0);
  assert.equal(stranger.heard.pos.size, 0);
  stranger.channel.publish(plazaLivePos({ x: 1, y: 1, mode: 0 }));
  await sleep(300);
  assert.equal((await tree()).pos[ids.out], undefined);
  await stranger.channel.close();
});

test("선생님이 학생을 뺀 뒤 — 그 학생의 입장권과 자리가 걷히고, 그 학생의 화면은 더 못 듣는다", async () => {
  await enter("a");
  await enter("b");
  const a = join(ids.a);
  const b = join(ids.b);
  await until(() => a.heard.linked && b.heard.linked, "이어짐");
  a.channel.publish(plazaLivePos({ x: 500, y: 700, mode: 0 }));
  await until(() => b.heard.pos.get(ids.a)?.x === 500 && b.heard.pos.get(ids.a)?.g !== 1, "A의 자리");

  // 학생은 남을 내보내지 못한다
  await assert.rejects(() => resetReadingRankings(who("b"), CLASS, ids.a), (e) => e.code === "reading/forbidden");
  assert.ok((await tree()).who[ids.a]);

  await resetReadingRankings(who("teacher"), CLASS, ids.a);
  const now = await tree();
  assert.equal(now.who[ids.a], undefined);
  assert.equal(now.pos[ids.a], undefined);
  // 남은 친구의 화면에서 그 학생이 사라진다
  await until(() => !b.heard.who.has(ids.a) && !b.heard.pos.has(ids.a), "B의 화면에서 A가 사라짐");
  assert.ok(b.heard.who.has(ids.b), "다른 사람의 입장권은 그대로");
  // 빠진 학생은 더 올리지 못하고(거듭 거부 → 알림), 다시 읽지도 못한다
  a.channel.publish(plazaLivePos({ x: 520, y: 700, mode: 0 }));
  await until(() => a.heard.denied.length > 0, "A에게 거부를 알림", 6000);
  assert.equal((await tree()).pos[ids.a], undefined);
  await assert.rejects(() => get(ref(a.database, `plaza/${CLASS}/who`)));
  // uid 없이 부르면(순위만 지우기) 입장권은 그대로
  await resetReadingRankings(who("teacher"), CLASS);
  assert.ok((await tree()).who[ids.b]);
  await a.channel.close();
  await b.channel.close();
});

test("입장 — 이어지면 지금 자리를 올리고 서로가 보인다 · 나가면 사라진다", async () => {
  const a = visit("a");
  const b = visit("b");
  b.view.state = { x: 900, y: 420, path: [{ x: 1000, y: 455 }], mode: 1, facing: "right", reading: false };
  await until(() => a.now() === "live" && b.now() === "live", "두 화면이 이어짐");
  assert.deepEqual(a.heard.status, ["connecting", "live"]);
  // 올리라고 하지 않아도 이어지는 순간 '지금 자리'(current)가 올라간다 — 서로의 이름표 · 캐릭터 · 펫과 자리
  const seenB = await until(() => a.heard.here.get(ids.b), "A의 화면에 B");
  assert.deepEqual({ name: seenB.who.name, pet: seenB.who.pet, x: seenB.pos.x, mode: seenB.pos.mode, path: seenB.pos.path },
    { name: "이두리", pet: null, x: 900, mode: 1, path: [{ x: 1000, y: 455 }] });
  assert.ok(seenB.age >= 0 && seenB.age < 5000, "소식의 나이(서버 시각 기준)");
  const seenA = await until(() => b.heard.here.get(ids.a), "B의 화면에 A");
  assert.deepEqual({ name: seenA.who.name, pet: seenA.who.pet, x: seenA.pos.x }, { name: "김하나", pet: { species: "hedgehog", stage: 4 }, x: 700 });
  assert.equal(a.heard.here.has(ids.a), false, "나는 내 명단에 없다");
  // 걸음을 알리면 친구 화면이 듣는다
  a.session.publish({ x: 720, y: 330, path: [], mode: 2, facing: "right", reading: true });
  await until(() => b.heard.here.get(ids.a)?.pos.x === 720, "A의 걸음");
  assert.deepEqual({ mode: b.heard.here.get(ids.a).pos.mode, reading: b.heard.here.get(ids.a).pos.reading }, { mode: 2, reading: true });
  // A가 광장을 나감 → B의 화면에서 사라지고, 닫은 화면에는 더 알리지 않는다
  const quiet = a.heard.status.length;
  a.session.close();
  await until(() => !b.heard.here.has(ids.a), "B의 화면에서 A가 사라짐");
  b.session.publish({ x: 910, y: 420, path: [], mode: 0, facing: "down", reading: false });
  await sleep(200);
  assert.equal(a.heard.status.length, quiet);
  assert.equal(a.heard.here.get(ids.b)?.pos.x, 900, "닫은 화면은 더 듣지 않는다");
  b.session.close();
  await until(async () => (await tree()).pos[ids.b]?.g === 1, "B의 나감");
});

test("쉬는 화면 — 탭이 가려지면 놓고(나감), 돌아오면 입장권을 새로 받아 지금 자리로 다시 선다", async () => {
  const a = visit("a");
  const b = visit("b");
  await until(() => a.now() === "live" && b.now() === "live" && a.heard.here.has(ids.b) && b.heard.here.has(ids.a), "서로 보임");
  // 잠깐 가려졌다 곧 돌아오면 놓지 않는다
  b.view.hidden = true;
  b.view.visibility();
  await sleep(50);
  b.view.hidden = false;
  b.view.visibility();
  await sleep(200);
  assert.equal(b.now(), "live");
  assert.equal(b.heard.entered, 1);
  // 오래 가려지면 놓는다 — 친구 화면에서 사라지고, 내 화면의 친구도 내려간다
  b.view.hidden = true;
  b.view.visibility();
  await until(() => b.now() === "resting", "B가 쉼");
  assert.equal(b.heard.here.size, 0);
  await until(() => !a.heard.here.has(ids.b), "A의 화면에서 B가 사라짐");
  // 가려진 동안에는 무엇이 눌려도(다른 창) 다시 잇지 않는다. 쉬는 동안의 걸음은 버린다
  b.view.input();
  b.session.publish({ x: 5, y: 5, path: [], mode: 0, facing: "down", reading: false });
  await sleep(150);
  assert.equal(b.now(), "resting");
  // 돌아오면 다시 잇는다 — 입장권을 새로 받고, 그동안 바뀐 '지금 자리'로 선다
  b.view.state = { x: 1100, y: 500, path: [], mode: 0, facing: "left", reading: false };
  b.view.hidden = false;
  b.view.visibility();
  await until(() => b.now() === "live", "B가 돌아옴");
  assert.equal(b.heard.entered, 2);
  const back = await until(() => a.heard.here.get(ids.b), "A의 화면에 B가 다시");
  assert.deepEqual({ x: back.pos.x, facing: back.pos.facing }, { x: 1100, facing: "left" });
  await until(() => b.heard.here.has(ids.a), "B의 화면에 A가 다시");
  assert.deepEqual(b.heard.status, ["connecting", "live", "resting", "connecting", "live"]);
  a.session.close();
  b.session.close();
});

test("가만히 둔 화면 — 학생은 놓고(누르면 다시 이음), 선생님 화면은 놓지 않는다", async () => {
  // 실제로는 10분 — 시험에서는 0.4초
  const student = visit("b", { times: { idle: 400 } });
  const teacher = visit("teacher", { teacher: true, times: { idle: 400 } });
  await until(() => student.now() === "live" && teacher.now() === "live", "이어짐");
  // 쓰는 동안(누르기 · 움직이기)은 놓지 않는다
  for (let i = 0; i < 6; i += 1) { await sleep(100); student.view.input(); }
  assert.equal(student.now(), "live");
  // 아무것도 안 누르면 놓는다 — 선생님 화면은 그대로(교실 화면에 띄워 둔 자리)
  await until(() => student.now() === "resting", "학생 화면이 쉼", 3000);
  await sleep(300);
  assert.equal(teacher.now(), "live");
  await until(() => !teacher.heard.here.has(ids.b), "선생님 화면에서 학생이 사라짐");
  // 다시 누르면 곧바로 이어진다
  student.view.input();
  await until(() => student.now() === "live" && teacher.heard.here.has(ids.b), "학생이 돌아옴");
  student.session.close();
  teacher.session.close();
});

test("교실 — 어느 방 · 어느 책상에 앉았는지가 진짜 규칙을 지나 전해지고, 앉아 있는 학생은 가만히 있어도 놓지 않는다", async () => {
  // 가만히 둔 화면을 놓는 때 — 실제로는 서 있으면 10분 · 앉아 있으면 한 시간. 시험에서는 0.3초 · 1분.
  const a = visit("a", { times: { idle: 300, idleSeated: 60000 } });
  const b = visit("b");
  // A가 교실에 들어가 제 책상(첫 자리)에 앉음 — 이어지자마자 그 자리를 올린다
  a.view.seated = true;
  a.view.state = { x: 353, y: 339, path: [], mode: 0, facing: "up", reading: false, room: "classroom", seat: 0 };
  const sat = await until(() => { const row = b.heard.here.get(ids.a); return row?.pos.seat === 0 ? row : null; }, "B의 화면에 A가 앉아 있음");
  assert.deepEqual({ room: sat.pos.room, seat: sat.pos.seat, facing: sat.pos.facing, x: sat.pos.x, y: sat.pos.y }, { room: "classroom", seat: 0, facing: "up", x: 353, y: 339 });
  assert.deepEqual((await rtdb.ref(`plaza/${CLASS}/pos/${ids.a}`).get()).val().z, 1);
  // 가만히 있어도(서 있는 학생이면 놓았을 0.3초가 한참 지나도) 이어져 있다
  await sleep(900);
  assert.equal(a.now(), "live");
  assert.equal(b.heard.here.get(ids.a)?.pos.seat, 0);
  // 일어서서 광장으로 나감 — 방 · 자리 칸을 싣지 않는다(규칙을 새로 게시하지 않은 배포의 광장과 같은 모양)
  a.view.seated = false;
  a.view.state = { x: 381, y: 823, path: [], mode: 0, facing: "down", reading: false, room: "plaza", seat: null };
  a.view.input();
  a.session.publish(a.view.state);
  const out = await until(() => { const row = b.heard.here.get(ids.a); return row?.pos.room === "plaza" ? row : null; }, "A가 광장으로");
  assert.equal(out.pos.seat, null);
  const raw = (await rtdb.ref(`plaza/${CLASS}/pos/${ids.a}`).get()).val();
  assert.equal("z" in raw || "s" in raw, false, "광장에서는 방 · 자리 칸이 없다");
  // 이제는 서 있는 학생 — 가만히 있으면 놓는다
  await until(() => a.now() === "resting", "서 있는 학생의 화면은 쉼", 3000);
  a.session.close();
  b.session.close();
});

test("입장권이 죽으면 — 새로 받아 다시 잇고, 반에서 빠진 학생은 서버가 거절해 그만둔다", async () => {
  // again을 짧게 — 두 번의 거부를 '한참 사이를 둔 일'로 봅니다(실제로는 1분)
  const a = visit("a", { times: { again: 40 } });
  const b = visit("b");
  await until(() => a.now() === "live" && b.now() === "live" && b.heard.here.has(ids.a), "서로 보임");
  // 입장권이 사라짐(만료된 것을 서버가 걷음 등) → 듣기가 끊김 → 새로 받아 다시 선다
  await rtdb.ref(`plaza/${CLASS}/who/${ids.a}`).remove();
  await until(() => a.heard.entered === 2 && a.now() === "live", "A가 입장권을 새로 받음", 6000);
  await until(() => b.heard.here.has(ids.a) && a.heard.here.has(ids.b), "다시 서로 보임");
  await sleep(120);
  // 선생님이 반에서 뺌 — 소속이 사라지고 입장권 · 자리가 걷힌다 → 새로 받으려 해도 서버가 거절 → 그만둔다
  await db.doc(`memberships/${ids.a}_${CLASS}`).delete();
  await resetReadingRankings(who("teacher"), CLASS, ids.a);
  await until(() => a.now() === "off:refused", "A의 화면이 그만둠", 6000);
  assert.equal(a.heard.here.size, 0);
  await until(() => !b.heard.here.has(ids.a), "B의 화면에서 A가 사라짐");
  // 그만둔 화면은 눌러도 · 올려도 다시 잇지 않는다
  const tried = a.heard.entered;
  a.view.input();
  a.session.publish({ x: 1, y: 1, path: [], mode: 0, facing: "down", reading: false });
  await sleep(250);
  assert.equal(a.heard.entered, tried);
  assert.equal((await tree()).pos[ids.a], undefined);
  a.session.close();
  b.session.close();
  await db.doc(`memberships/${ids.a}_${CLASS}`).set({ uid: ids.a, classId: CLASS });
});

test("잇지 못할 때 — 규칙이 막으면 두 번 만에 그만두고, 서버가 못 적으면 켜지 않고, 서버에 닿지 못하면 다시 해 본다", async () => {
  // 규칙이 게시되지 않음(모두 막힘) — 입장권은 서버가 적지만 화면이 듣지 못한다 → 한 번 더 해 보고 그만둠('denied')
  await putRules(DENY_RULES);
  try {
    const blocked = visit("b");
    await until(() => blocked.now() === "off:denied", "규칙에 막혀 그만둠", 8000);
    assert.equal(blocked.heard.entered, 2);
    assert.equal(blocked.heard.here.size, 0);
    blocked.session.close();
  } finally {
    await putRules(REAL_RULES);
  }
  // 서버가 데이터베이스에 적지 못함(아직 안 만듦 · 주소가 틀림) → 켜지 않는다. 연결도 잡지 않는다
  const unset = visit("b", { enterWith: async () => ({ live: false }) });
  await until(() => unset.now() === "off:server", "켜지 않음");
  assert.equal(unset.heard.connected, 0);
  unset.session.close();
  // 서버에 닿지 못함(와이파이) → 잠시 뒤 다시 해 보고 이어진다
  const flaky = visit("b", { enterWith: async (n) => { if (n === 1) throw new TypeError("fetch failed"); return enter("b"); } });
  await until(() => flaky.now() === "live", "다시 해 보고 이어짐");
  assert.equal(flaky.heard.entered, 2);
  assert.deepEqual(flaky.heard.status, ["connecting", "live"]);
  // 입장권을 받는 사이에 화면을 나가면 연결을 잡지 않는다
  let release = null;
  const slow = visit("b", { enterWith: () => new Promise((resolve) => { release = () => resolve(enter("b")); }) });
  await until(() => release, "입장권을 기다림");
  slow.session.close();
  release();
  await sleep(200);
  assert.equal(slow.heard.connected, 0);
  flaky.session.close();
});

test("반을 완전히 지울 때 — 담당 교사만 그 반의 실시간 자료를 통째로 걷는다(보관된 반 · 광장을 끈 반에서도)", async () => {
  const clear = (kind, classId = CLASS) => plazaAction(who(kind), { classId, action: "clear" });
  await enter("a");
  await enter("b");
  await rtdb.ref(`plaza/${CLASS}/pos/${ids.a}`).set({ x: 1, y: 1, m: 0, f: 0, t: Date.now() });
  await rtdb.ref("plaza/plv-next-door/who/someone").set({ n: "옆 반 학생", c: "", ps: 0, exp: Date.now() + 60000 });
  // 학생 · 다른 반 교사 · 없는 반은 못 걷는다
  await assert.rejects(() => clear("a"), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => clear("other"), (e) => e.code === "reading/forbidden");
  await assert.rejects(() => clear("teacher", "plv-no-such-class"), (e) => e.code === "reading/forbidden");
  assert.ok((await tree()).who[ids.a]);
  // 완전 삭제는 보관된 반에서 합니다 — 보관되고 광장을 끈 뒤에도 걷힌다(책나눔 접근 판정을 거치지 않음)
  await db.doc(`classes/${CLASS}`).update({ archived: true, plazaEnabled: false });
  try {
    assert.deepEqual(await clear("teacher"), { cleared: true });
    assert.deepEqual(await tree(), {});
    assert.ok((await tree("plv-next-door")).who.someone, "다른 반의 것은 그대로");
    // 주소가 없는 배포에서는 아무 일도 없다
    const saved = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    delete process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    try { assert.deepEqual(await clear("teacher"), { cleared: false }); } finally { process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = saved; }
  } finally {
    await db.doc(`classes/${CLASS}`).update({ archived: false, plazaEnabled: true });
    await rtdb.ref("plaza/plv-next-door").remove();
  }
});
