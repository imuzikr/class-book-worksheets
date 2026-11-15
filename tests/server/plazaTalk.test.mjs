// 책 광장의 대화(광장 대화 — lib/readingPlazaTalk.js 머리말) — 요청 · 승인 · 말 · 나가기 · 선생님 기록 · 정리.
// Auth · Firestore · Realtime Database 에뮬레이터에서 **진짜 규칙(database.rules.json)**과 진짜 SDK로 봅니다:
// 입장권과 승인(대화에 사람을 넣는 일)은 서버(plazaAction)가, 요청 · 말 · 나가기는 화면과 같은 SDK가 씁니다.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeApp, deleteApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabaseWithUrl } from "firebase-admin/database";
import { initializeApp as initClient, deleteApp as deleteClient } from "firebase/app";
import { connectDatabaseEmulator, get, getDatabase, onValue, orderByChild, push, query, ref, remove, serverTimestamp, set, startAt, update } from "firebase/database";
import { plazaAction, resetReadingRankings } from "../../lib/server/readingService.js";
import { TALK_MAX, plazaTalkHistory, talkNewId } from "../../lib/readingPlazaTalk.js";
import { openPlazaTalk } from "../../lib/plazaTalkChannel.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use the auth, firestore and database emulators and a demo- project; production execution is forbidden.");
}
const DATABASE_URL = `https://${projectId}-default-rtdb.firebaseio.com`;
const seedApp = initializeApp({ projectId }, "plaza-talk-test-seed");
const db = getFirestore(seedApp);
const rtdb = getDatabaseWithUrl(DATABASE_URL, seedApp);
const CLASS = "plt-class";
const OFF = "plt-off";
const kinds = ["a", "b", "c", "d", "e", "teacher", "other", "out"];
const ids = Object.fromEntries(kinds.map((k) => [k, `plt-${k}`]));
const who = (kind) => ({ uid: ids[kind], roleClaim: null, db });
const act = (kind, payload, classId = CLASS) => plazaAction(who(kind), { classId, ...payload });
const enter = (kind, classId = CLASS) => act(kind, { action: "enter" }, classId);
const accept = (kind, from, askId, classId = CLASS) => act(kind, { action: "talkAccept", from: ids[from], askId }, classId);
const read = async (path) => (await rtdb.ref(path).get()).val();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 화면과 같은 SDK로 에뮬레이터에 잇습니다 — 그 사람으로 로그인한 것처럼(mockUserToken)
const clients = [];
const dbs = {};
function clientDb(kind) {
  if (dbs[kind]) return dbs[kind];
  const app = initClient({ projectId, databaseURL: DATABASE_URL }, `plaza-talk-${kind}`);
  const database = getDatabase(app);
  const [host, port] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(":");
  connectDatabaseEmulator(database, host, Number(port), { mockUserToken: { sub: ids[kind] } });
  clients.push(app);
  dbs[kind] = database;
  return database;
}
const askPath = (to, from, classId = CLASS) => `plazaAsk/${classId}/${ids[to]}/${ids[from]}`;
// 요청을 보냅니다(화면과 같은 모양 — t는 서버 시각, i는 요청 번호)
async function ask(from, to, extra = {}, classId = CLASS) {
  const i = talkNewId(12);
  await set(ref(clientDb(from), askPath(to, from, classId)), { t: serverTimestamp(), i, ...extra });
  return i;
}
const talkPath = (talkId, rest = "") => `plazaTalk/${CLASS}/${talkId}${rest ? `/${rest}` : ""}`;
// 말 한 마디 — 말과 '마지막으로 말한 때'를 한 번에(규칙이 0.5초에 한 마디로 막음)
function say(kind, talkId, text) {
  const database = clientDb(kind);
  const key = push(ref(database, talkPath(talkId, "l"))).key;
  return update(ref(database, talkPath(talkId)), { [`l/${key}`]: { u: ids[kind], x: text, t: serverTimestamp() }, [`e/${ids[kind]}`]: serverTimestamp() });
}
// 내가 들어온 뒤의 말만 — 규칙이 그 질의(때 차례 · 들어온 때부터)만 받습니다
async function hear(kind, talkId, from = null) {
  const database = clientDb(kind);
  const members = (await get(ref(database, talkPath(talkId, "m")))).val() ?? {};
  const since = from ?? members[ids[kind]]?.j ?? 0;
  // 화면처럼 듣기(listen)로 — 규칙의 질의 판정(query.startAt)은 듣기에 실린 질의를 봅니다
  const snap = await new Promise((resolve, reject) => {
    onValue(query(ref(database, talkPath(talkId, "l")), orderByChild("t"), startAt(since)), resolve, reject, { onlyOnce: true });
  });
  return Object.values(snap.val() ?? {}).sort((x, y) => x.t - y.t);
}

const REAL_RULES = readFileSync(fileURLToPath(new URL("../../database.rules.json", import.meta.url)), "utf8");
async function putRules(rules) {
  const put = await fetch(`http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/.settings/rules.json?ns=${projectId}-default-rtdb`, {
    method: "PUT", headers: { Authorization: "Bearer owner" }, body: rules,
  });
  assert.equal(put.ok, true, "규칙을 올리지 못함");
}

before(async () => {
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL = DATABASE_URL;
  await putRules(REAL_RULES);
  await Promise.all(["plaza", "plazaAsk", "plazaTalk", "plazaTalkBy"].map((root) => rtdb.ref(`${root}/${CLASS}`).remove()));
  const batch = db.batch();
  batch.set(db.doc(`classes/${CLASS}`), { createdBy: ids.teacher, readingEnabled: true, plazaEnabled: true, plazaTalkEnabled: true, archived: false });
  batch.set(db.doc(`classes/${OFF}`), { createdBy: ids.teacher, readingEnabled: true, plazaEnabled: true, archived: false });
  const names = { a: "가람", b: "나래", c: "다온", d: "라온", e: "마루", out: "반 밖" };
  for (const kind of ["a", "b", "c", "d", "e", "out"]) {
    batch.set(db.doc(`users/${ids[kind]}`), { role: "student", realName: names[kind], studentId: `3010${kinds.indexOf(kind)}` });
  }
  batch.set(db.doc(`users/${ids.teacher}`), { role: "teacher", realName: "담임 교사" });
  batch.set(db.doc(`users/${ids.other}`), { role: "teacher", realName: "옆 반 교사" });
  for (const kind of ["a", "b", "c", "d", "e"]) {
    batch.set(db.doc(`memberships/${ids[kind]}_${CLASS}`), { uid: ids[kind], classId: CLASS });
    batch.set(db.doc(`memberships/${ids[kind]}_${OFF}`), { uid: ids[kind], classId: OFF });
  }
  await batch.commit();
  for (const kind of ["a", "b", "c", "d", "e", "teacher"]) await enter(kind);
});
after(async () => {
  await Promise.all(clients.map((app) => deleteClient(app).catch(() => {})));
  await Promise.all(getApps().map((app) => deleteApp(app).catch(() => {})));
});

let talk = null;      // 가람 · 다온의 대화(아래 시험들이 이어 씀)

test("요청 — 입장권이 있는 두 사람 사이에만 · 보낸 사람과 받는 사람만 읽음 · 15초 안에 같은 친구에게 다시 못 보냄", async () => {
  const i = await ask("a", "b");
  const mine = (await get(ref(clientDb("b"), `plazaAsk/${CLASS}/${ids.b}`))).val();
  assert.equal(mine[ids.a].i, i, "받는 사람은 나에게 온 요청을 모두 읽음");
  assert.equal((await get(ref(clientDb("a"), askPath("b", "a")))).val().i, i, "보낸 사람은 제 요청을 읽음");
  await assert.rejects(get(ref(clientDb("c"), `plazaAsk/${CLASS}/${ids.b}`)), "다른 친구는 남의 요청함을 못 읽음");
  await assert.rejects(get(ref(clientDb("c"), askPath("b", "a"))));
  await assert.rejects(ask("a", "b"), "같은 친구에게는 15초 안에 다시 못 보냄");
  await assert.rejects(remove(ref(clientDb("a"), askPath("b", "a"))), "15초 안에는 지워서 다시 보내지도 못함");
  await assert.rejects(ask("a", "out"), "입장권이 없는 사람(광장에 없음)에게는 못 보냄");
  await assert.rejects(set(ref(clientDb("a"), askPath("a", "a")), { t: serverTimestamp(), i: talkNewId(12) }), "나에게는 못 보냄");
  await assert.rejects(ask("c", "d", { ok: "talk_forged_1" }), "승인 표시는 서버만 적음");
  await assert.rejects(ask("c", "d", { no: 1 }), "거절 표시는 받는 사람만");
  await assert.rejects(set(ref(clientDb("c"), askPath("b", "a")), { t: serverTimestamp(), i: talkNewId(12) }), "남의 이름으로 못 보냄");
  // 받는 사람은 거절(no), 보낸 사람은 거둠(x)만 더함
  await assert.rejects(set(ref(clientDb("c"), `${askPath("b", "a")}/x`), 1));
  await set(ref(clientDb("b"), `${askPath("b", "a")}/no`), 1);
  await set(ref(clientDb("a"), `${askPath("b", "a")}/x`), 1);
  await assert.rejects(set(ref(clientDb("b"), `${askPath("b", "a")}/t`), 1), "받는 사람이 요청을 고쳐 쓰지 못함");
});

test("승인 — 서버가 대화를 만들어 두 사람을 넣고, 요청에 대화 번호를 적는다", async () => {
  const i = await ask("a", "c");
  const result = await accept("c", "a", i);
  talk = result.talkId;
  assert.equal(result.invited, false);
  const node = await read(talkPath(talk));
  assert.deepEqual(Object.keys(node.m).sort(), [ids.a, ids.c].sort());
  assert.equal(node.m[ids.a].n, "가람");
  assert.equal(node.n[ids.c], "다온");
  assert.equal(node.m[ids.a].j, node.m[ids.c].j, "두 사람은 같은 때에 들어옴");
  assert.ok((await read(`plazaTalkBy/${CLASS}/${ids.a}`))[talk] > 0);
  assert.equal((await read(askPath("c", "a"))).ok, talk);
  // 대화에 든 사람만 사람 목록 · 말을 읽음
  assert.ok((await get(ref(clientDb("a"), talkPath(talk, "m")))).exists());
  await assert.rejects(get(ref(clientDb("b"), talkPath(talk, "m"))), "대화 밖의 친구는 못 읽음");
  // 말풍선 — 내 자리에 대화 번호를 실음(모양만 봄)
  await set(ref(clientDb("a"), `plaza/${CLASS}/pos/${ids.a}`), { x: 700, y: 330, m: 0, f: 1, k: talk, t: serverTimestamp() });
  await assert.rejects(set(ref(clientDb("c"), `plaza/${CLASS}/pos/${ids.c}`), { x: 700, y: 330, m: 0, f: 1, k: "../bad", t: serverTimestamp() }));
});

test("말 — 대화에 든 사람만 · 제 이름으로 · 0.5초에 한 마디 · 고치거나 지우지 못함", async () => {
  await say("a", talk, "이 책 어디까지 읽었어?");
  await assert.rejects(say("a", talk, "또"), "0.5초 안에 또 말하면 막힘");
  await sleep(600);
  await say("a", talk, "나는 3장!");
  await say("c", talk, "나는 다 읽었어");
  const heard = await hear("c", talk);
  assert.deepEqual(heard.map((l) => l.x), ["이 책 어디까지 읽었어?", "나는 3장!", "나는 다 읽었어"]);
  await assert.rejects(say("b", talk, "끼어들기"), "대화 밖의 친구는 말을 못 넣음");
  const database = clientDb("a");
  const key = push(ref(database, talkPath(talk, "l"))).key;
  await sleep(600);
  await assert.rejects(update(ref(database, talkPath(talk)), { [`l/${key}`]: { u: ids.c, x: "남의 이름", t: serverTimestamp() }, [`e/${ids.a}`]: serverTimestamp() }), "남의 이름으로 못 씀");
  await assert.rejects(update(ref(database, talkPath(talk)), { [`l/${key}`]: { u: ids.a, x: "가".repeat(401), t: serverTimestamp() }, [`e/${ids.a}`]: serverTimestamp() }), "너무 긴 말");
  await assert.rejects(set(ref(database, `${talkPath(talk, "l")}/${key}`), { u: ids.a, x: "때 표시 없이", t: serverTimestamp() }), "'마지막으로 말한 때'를 함께 적어야 함");
  const first = Object.keys((await read(talkPath(talk, "l"))))[0];
  await assert.rejects(set(ref(database, `${talkPath(talk, "l")}/${first}/x`), "고친 말"), "고치지 못함");
  await assert.rejects(remove(ref(database, `${talkPath(talk, "l")}/${first}`)), "지우지 못함");
  await assert.rejects(get(ref(database, talkPath(talk, "l"))), "말은 '들어온 때부터'의 질의로만 읽음");
});

test("승인 — 그 번호의 요청이 기다리는 중일 때만 · 둘 다 다른 대화에 있지 않을 때만 · 광장 대화를 끈 반은 받지 않음", async () => {
  const i = await ask("d", "e");
  await assert.rejects(accept("e", "d", talkNewId(12)), (e) => e.code === "reading/plaza-talk-gone", "다른 요청 번호(늦게 닿은 승인)");
  await set(ref(clientDb("d"), `${askPath("e", "d")}/x`), 1);
  await assert.rejects(accept("e", "d", i), (e) => e.code === "reading/plaza-talk-gone", "보낸 사람이 거둔 요청");
  // 이미 대화 중인 사람은 새 대화를 승인하지 못함(한 사람은 한 번에 한 대화)
  const toBusy = await ask("e", "a");
  await assert.rejects(accept("a", "e", toBusy), (e) => e.code === "reading/plaza-talk-busy");
  // 광장 대화를 끈 반
  for (const kind of ["d", "e"]) await enter(kind, OFF);
  const off = await ask("d", "e", {}, OFF);
  await assert.rejects(accept("e", "d", off, OFF), (e) => e.code === "reading/plaza-talk-disabled");
});

test("여럿 — 대화에 든 사람이 초대하면 받은 사람이 그 대화에 들어오고, 들어온 뒤의 말만 읽음 · 4명까지", async () => {
  await assert.rejects(ask("e", "b", { k: talk }), "대화 밖의 사람은 그 대화로 초대하지 못함");
  // 다온(대화에 든 사람)이 나래를 초대 — 가람이 아니어도 대화에 든 사람이면 누구나
  const toB = await ask("c", "b", { k: talk });
  const joined = await accept("b", "c", toB);
  assert.deepEqual(joined, { talkId: talk, invited: true });
  const heard = await hear("b", talk);
  assert.deepEqual(heard.map((l) => l.s ?? l.x), ["join"], "들어온 뒤의 말(들어왔다는 한 줄)만");
  await assert.rejects(hear("b", talk, 0), "들어오기 전의 말은 못 읽음");
  // 넷째 · 다섯째
  const toD = await ask("a", "d", { k: talk });
  await accept("d", "a", toD);
  assert.equal(Object.keys(await read(talkPath(talk, "m"))).length, TALK_MAX);
  const toE = await ask("a", "e", { k: talk });
  await assert.rejects(accept("e", "a", toE), (e) => e.code === "reading/plaza-talk-full");
});

test("나가기 — 나간다는 한 줄과 함께 내 자리만 지움 · 남의 자리는 못 지움", async () => {
  const database = clientDb("d");
  await assert.rejects(remove(ref(clientDb("c"), talkPath(talk, `m/${ids.b}`))), "남을 내보내지 못함");
  const key = push(ref(database, talkPath(talk, "l"))).key;
  await assert.rejects(set(ref(database, `${talkPath(talk, "l")}/${key}`), { u: ids.d, s: "leave", t: serverTimestamp() }), "나가는 한 줄만 쓰고 남아 있지 못함");
  await update(ref(database, talkPath(talk)), { [`l/${key}`]: { u: ids.d, s: "leave", t: serverTimestamp() }, [`m/${ids.d}`]: null });
  await assert.rejects(get(ref(database, talkPath(talk, "m"))), "나간 사람은 더 못 읽음");
  const heard = await hear("a", talk);
  assert.equal(heard.at(-1).s, "leave");
});

test("통로(lib/plazaTalkChannel.js) — 내 대화 되찾기 · 따라가며 사람과 말 듣기 · 말하기", async () => {
  const heard = { talk: null, lines: [] };
  const channel = openPlazaTalk(clientDb("a"), {
    classId: CLASS, uid: ids.a,
    onTalk: (id, state) => { heard.talk = state; },
    onLine: (id, lineId, line) => heard.lines.push(line),
  });
  try {
    const found = await channel.restore();
    assert.equal(found.id, talk, "마지막으로 들어간 대화(아직 든 것)");
    assert.ok(found.lastAt >= found.j);
    channel.follow(talk);
    const until = async (check, label) => {
      for (let n = 0; n < 160 && !check(); n += 1) await sleep(25);
      assert.ok(check(), label);
    };
    await until(() => heard.talk && Object.keys(heard.talk.members).length === 3, "지금 든 세 사람");
    assert.equal(heard.talk.names[ids.d], "라온", "나간 사람의 이름도(그 사람의 지난 말에 쓰려고)");
    await until(() => heard.lines.some((l) => l.s === "leave"), "지난 말부터 차례로");
    await sleep(600);
    await channel.say(talk, "통로로 한 마디");
    await until(() => heard.lines.some((l) => l.x === "통로로 한 마디"), "내 말도 들음");
  } finally {
    channel.close();
  }
});

test("선생님 기록 — 담당 교사만 · 한 학생이 든 대화의 말 전부(들어오기 전의 말도)", async () => {
  const result = await act("teacher", { action: "talkHistory", uid: ids.b });
  assert.equal(result.live, true);
  const rows = plazaTalkHistory(result.talks, ids.b);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lines.find((l) => l.kind === "say").text, "이 책 어디까지 읽었어?", "학생이 들어오기 전의 말도 선생님은 봄");
  assert.ok(rows[0].lines.some((l) => l.kind === "join" && l.mine));
  await assert.rejects(act("a", { action: "talkHistory", uid: ids.b }), (e) => e.code === "reading/forbidden");
  await assert.rejects(act("other", { action: "talkHistory", uid: ids.b }), (e) => e.code === "reading/forbidden");
});

test("선생님 기록 지우기 — 담당 교사만 · 끝난 대화만 · 함께한 사람들의 기록 찾기까지 걷고, 이야기하는 중인 대화는 남김", async () => {
  // 지금 이야기하는 중인 대화(talk — 아래 '정리'가 이어 씀)는 지우지 않습니다
  assert.deepEqual(await act("teacher", { action: "talkDelete", talkIds: [talk] }), { deleted: [], ongoing: [talk], missing: [] });
  assert.ok(await read(talkPath(talk)), "이야기하는 중인 대화는 그대로");
  const before = await act("teacher", { action: "talkHistory", uid: ids.b });
  assert.equal(before.talks.find((t) => t.id === talk)?.ongoing, true, "기록에 '이야기하는 중' 표시");
  // 끝난 대화 둘 — 아무도 남지 않은 대화 · '나감' 없이 떠난 사람만 남아 30분 넘게 조용한 대화
  const now = Date.now();
  const ended = "talk_ended_0001";
  const quiet = "talk_quiet_0001";
  await rtdb.ref().update({
    [talkPath(ended)]: { a: now - 3_600_000, n: { [ids.b]: "나래", [ids.e]: "마루" }, l: { l1: { u: ids.b, x: "끝난 대화", t: now - 3_500_000 } } },
    [`plazaTalkBy/${CLASS}/${ids.b}/${ended}`]: now - 3_600_000,
    [`plazaTalkBy/${CLASS}/${ids.e}/${ended}`]: now - 3_600_000,
    [talkPath(quiet)]: { a: now - 7_200_000, m: { [ids.d]: { n: "라온", j: now - 7_200_000 } }, n: { [ids.b]: "나래", [ids.d]: "라온" }, l: { l1: { u: ids.d, x: "조용한 대화", t: now - 7_000_000 } } },
    [`plazaTalkBy/${CLASS}/${ids.b}/${quiet}`]: now - 7_200_000,
    [`plazaTalkBy/${CLASS}/${ids.d}/${quiet}`]: now - 7_200_000,
  });
  // 학생 · 다른 반 선생님은 못 지움 · 번호가 없거나 이상하면 거절
  await assert.rejects(act("b", { action: "talkDelete", talkIds: [ended] }), (e) => e.code === "reading/forbidden");
  await assert.rejects(act("other", { action: "talkDelete", talkIds: [ended] }), (e) => e.code === "reading/forbidden");
  await assert.rejects(act("teacher", { action: "talkDelete", talkIds: [] }), (e) => e.status === 400);
  await assert.rejects(act("teacher", { action: "talkDelete", talkIds: ["bad id"] }), (e) => e.status === 400);
  assert.ok(await read(talkPath(ended)), "거절된 요청은 아무것도 안 지움");
  // 한 번에 여럿 — 끝난 둘은 지우고, 이야기하는 중인 대화 · 없는 대화는 그대로 알려 줌
  const result = await act("teacher", { action: "talkDelete", talkIds: [ended, quiet, talk, "talk_gone_0001"] });
  assert.deepEqual(result, { deleted: [ended, quiet], ongoing: [talk], missing: ["talk_gone_0001"] });
  assert.equal(await read(talkPath(ended)), null);
  assert.equal(await read(talkPath(quiet)), null);
  for (const [kind, id] of [["b", ended], ["e", ended], ["b", quiet], ["d", quiet]]) {
    assert.equal(await read(`plazaTalkBy/${CLASS}/${ids[kind]}/${id}`), null, `${kind}의 기록 찾기에서도 걷음`);
  }
  assert.ok(await read(`plazaTalkBy/${CLASS}/${ids.b}/${talk}`), "이야기하는 중인 대화의 기록 찾기는 그대로");
  const after = await act("teacher", { action: "talkHistory", uid: ids.b });
  assert.deepEqual(after.talks.map((t) => t.id), [talk]);
});

test("정리 — 반에서 빼기 · 사용 중지는 요청 · 대화 자리를 걷고 기록은 남김, 탈퇴는 그 학생의 말까지 지움", async () => {
  await sleep(600);
  await say("b", talk, "나래의 말");
  await resetReadingRankings(who("teacher"), CLASS, ids.b);
  assert.equal(await read(talkPath(talk, `m/${ids.b}`)), null, "대화에서 빠짐");
  assert.ok(Object.values(await read(talkPath(talk, "l"))).some((l) => l.x === "나래의 말"), "기록은 남음");
  assert.ok(await read(`plazaTalkBy/${CLASS}/${ids.b}`), "선생님의 기록 찾기도 남음");
  assert.equal(await read(`plazaAsk/${CLASS}/${ids.b}`), null, "받은 요청을 걷음");
  assert.equal(await read(askPath("b", "a")), null);
  await resetReadingRankings(who("teacher"), CLASS, ids.c, { withdraw: true });
  const lines = Object.values(await read(talkPath(talk, "l")));
  assert.equal(lines.some((l) => l.u === ids.c), false, "탈퇴한 학생의 말은 지움");
  assert.equal(await read(talkPath(talk, `n/${ids.c}`)), null);
  assert.equal(await read(`plazaTalkBy/${CLASS}/${ids.c}`), null);
  assert.ok(lines.some((l) => l.u === ids.a), "다른 친구의 말은 그대로");
});

test("반 완전 삭제 — 그 반의 요청 · 대화 · 기록 찾기를 모두 걷음", async () => {
  const result = await act("teacher", { action: "clear" });
  assert.equal(result.cleared, true);
  for (const root of ["plaza", "plazaAsk", "plazaTalk", "plazaTalkBy"]) assert.equal(await read(`${root}/${CLASS}`), null, root);
});
