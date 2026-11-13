// =============================================================
// 책 광장의 실시간 — 데모(체험반 · 체험용 샘플 반)
// -------------------------------------------------------------
// 서버도 Realtime Database도 없으므로 두 가지로 흉내 냅니다.
//   · 가상 친구 — 체험반 학생 몇 명(과 선생님)이 마당을 거닐고, 가판대 · 책꽂이 앞에서 글을 읽고, 가끔 한 명이
//     나가고 다른 한 명이 들어옵니다.
//   · 같은 브라우저의 다른 탭 — 체험반은 탭마다 다른 학생이 될 수 있어(신원 전환 — DEMO_CLASSROOM.md),
//     탭끼리 BroadcastChannel로 자리를 주고받습니다. 두 창을 나란히 두면 한쪽에서 걷는 캐릭터가 다른 쪽에서
//     함께 걷습니다. 다른 탭에 실제로 들어온 사람은 가상 친구에서 뺍니다.
// 자료의 모양(입장권 · 자리)과 맞대는 셈(plazaRoster)은 실서비스와 같은 것을 씁니다 — 무대는 차이를 모릅니다.
//
// **교실**(관리자 설정의 '교실'을 켠 체험반 — me.classroom)
//   · 가상 친구가 광장과 교실에 나뉘어 있고, 포털로 오갑니다. 교실에서는 자리표의 제 책상으로 걸어가(가까운 쪽
//     러그 귀에 올라서서) 앉고, 일어설 때는 앉기 전에 섰던 그 귀로 내려섭니다.
//     가상 선생님은 칠판 앞을 거닙니다(출석은 부르지 않음 — 선생님으로 바꿔 직접 눌러 봅니다).
//   · **앉은 채 다른 사람으로 바꾸면 그 학생은 자리에 남아 있습니다**(stays). 체험반은 한 탭에서 신원을 바꿔 가며 보므로,
//     학생으로 앉은 뒤 선생님으로 바꿔 '출석시작'을 눌러 볼 수 있게 한 것입니다(실서비스에서는 화면을 떠나면 자리에 없음).
//   · 선생님이 출석을 확인하면(반 문서의 classroomCallAt이 바뀜) 앉아 있는 가상 친구 · 남아 있는 학생의 출석을 남깁니다 —
//     실서비스에서 앉아 있던 학생의 화면이 스스로 하는 일을 대신합니다.
//   · 다른 탭 — 체험반 자료는 탭마다 따로라, 출석시작 · 출석종료 · 남긴 출석을 탭끼리 전해 줍니다(두 창을 나란히 두고
//     한쪽은 선생님, 한쪽은 앉은 학생으로 확인할 수 있게).
// 이 파일은 데모에서만 내려받습니다(lib/data/plazaLive.js의 import()).
// =============================================================
import { todayDateKey } from "../dates";
import { DEMO_TEACHER_UID, getDemoStudent } from "../demoClassroom";
import { classroomDesks, classroomSeatOf, classroomSeatSide } from "../readingClassroom";
import { characterOf } from "../readingCharacterCatalog";
import { CLASSROOM_BOARD, CLASSROOM_SEATS, PLAZA_H, PLAZA_W, plazaArrival, plazaNearest, plazaPath, plazaRoomOf, plazaWalkable } from "../readingPlazaMap";
import { PLAZA_LIVE_TTL_MS, plazaLiveGone, plazaLivePos, plazaLiveWho, plazaRoster, plazaSpawnFor } from "../readingPlazaLive";
import { PLAZA_WALK_SPEED, plazaFacing } from "../readingPlazaSprites";
import { getCurrentUser } from "../user";
import { markStudyAttendance, subscribeClassAttendanceOn, subscribeStudySeatLayout } from "./attendance";
import { callClassroomRoll, stopClassAttendance, subscribeClass } from "./classes";
import { fetchReadingRankings } from "./reading";

// 한 번에 마당에 있는 가상 친구(선생님 빼고) · 가상 친구를 살피는 사이 · 한 명이 나가고 들어오는 사이
const BOTS_AT_ONCE = 7;
const TICK_MS = 600;
const SWAP_MS = [24000, 42000];
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// 앉은 채 다른 사람으로 바꾼 학생들 — 반 → (uid → 자리 번호). 이 탭이 살아 있는 동안만 기억합니다.
const stays = new Map();

export function openDemoPlazaLive(classId, me, handlers = {}) {
  const uid = me.uid;
  const classroom = !!me.classroom;
  const roomOf = (id) => plazaRoomOf(id, classroom);
  const today = todayDateKey();
  let desks = classroomDesks(null);
  let lastState = null;      // 내가 마지막으로 알린 걸음(앉아 있었는지 — 나갈 때 stays에 남김)
  let relaying = false;      // 다른 탭이 전해 준 출석시작 · 종료를 이 탭의 자료에 옮기는 중(다시 전하지 않음)
  let closed = false;
  let ticker = null;
  let swapAt = 0;
  let myWho = null;
  let myPos = null;          // { pos(올린 모양), at(올린 때) }
  const bots = [];           // { uid, who, x, y, facing, here, muted, busyUntil, todo: [{ at, state }] }
  const peers = new Set();   // 다른 탭에 들어와 있는 사람
  let teacherPeer = false;   // 다른 탭에 선생님이 들어온 적이 있는가(가상 선생님을 물림 — 데모의 선생님 uid는 탭마다 다름)
  const guard = (fn) => (...args) => { if (!closed) fn?.(...args); };
  const roster = plazaRoster(uid, {
    onJoin: guard(handlers.onJoin), onWho: guard(handlers.onWho), onMove: guard(handlers.onMove), onLeave: guard(handlers.onLeave),
  });
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`bookbom.demo.plaza.v1:${classId}`) : null;
  const post = (message) => { try { channel?.postMessage({ ...message, uid }); } catch { /* 닫힌 통로 */ } };
  const announce = () => { if (myWho) post({ k: "here", who: myWho, pos: myPos?.pos ?? null, at: myPos?.at ?? Date.now() }); };

  // ── 가상 친구 ──
  // 알릴 때의 방 · 자리는 그때의 친구 것(bot.room · bot.seat)을 싣습니다
  const emit = (bot, state, now) => roster.pos(bot.uid, { ...plazaLivePos({ ...state, room: bot.room, seat: bot.seat }), t: now }, now);
  function botEnter(bot, now) {
    // 교실에서 시작하는 친구 — 제 책상이 있으면 앉아서, 없으면 교실 뒤쪽에 서서. 가상 선생님은 칠판 앞.
    const seat = bot.room === "classroom" && bot.desk !== null && !bot.teacher ? CLASSROOM_SEATS[bot.desk] : null;
    const at = seat ? seat.sit : bot.room === "classroom" && bot.teacher ? { x: rand(620, 1050), y: CLASSROOM_BOARD.standY } : plazaSpawnFor(bot.uid, roomOf(bot.room));
    Object.assign(bot, { x: at.x, y: at.y, facing: seat ? "up" : "down", seat: seat ? seat.index : null, here: true, todo: [], busyUntil: now + (seat ? rand(9000, 40000) : rand(600, 7000)) });
    roster.who(bot.uid, bot.who, now);
    emit(bot, bot, now);
  }
  function botLeave(bot, now) {
    bot.here = false;
    bot.todo = [];
    roster.pos(bot.uid, { ...plazaLiveGone(bot), t: now }, now);
  }
  // 그곳으로 걸어가라고 알리고(길을 한 번 — 실서비스와 같은 약속) 걸리는 시간(ms)을 돌려줍니다
  function botWalk(bot, goal, now) {
    const route = plazaPath(bot, goal, roomOf(bot.room));
    let length = 0;
    let from = bot;
    for (const point of route) { length += Math.hypot(point.x - from.x, point.y - from.y); from = point; }
    if (length < 30) return 0;
    emit(bot, { x: bot.x, y: bot.y, path: route, mode: 1, facing: bot.facing }, now);
    const end = route[route.length - 1];
    const before = route.length > 1 ? route[route.length - 2] : bot;
    bot.facing = plazaFacing(null, end.x - before.x, end.y - before.y);
    bot.x = Math.round(end.x);
    bot.y = Math.round(end.y);
    return length / PLAZA_WALK_SPEED * 1000;
  }
  // 포털로 걸어가 다른 방으로 건너갑니다(걸어가는 동안은 지금 방에 있고, 다 가면 저 방의 포털 한가운데에 나타남)
  function botWarp(bot, now) {
    const to = bot.room === "plaza" ? "classroom" : "plaza";
    const gate = roomOf(bot.room).portals.find((g) => g.to === to);
    if (!gate) return false;
    const ms = botWalk(bot, { x: gate.x, y: gate.y }, now);
    const arrive = plazaArrival(roomOf(to), bot.room);
    bot.todo.push({ at: now + ms + 200, set: { room: to, x: arrive.x, y: arrive.y, facing: "down" }, state: { x: arrive.x, y: arrive.y, facing: "down" } });
    bot.busyUntil = now + ms + rand(1200, 2600);
    return true;
  }
  // 교실에서 — 제 책상으로 가서 앉고, 한참 앉아 있다가 가끔 일어나 거닐거나 광장으로 나갑니다
  function botActClass(bot, now) {
    const place = roomOf("classroom");
    if (bot.teacher) {
      // 가상 선생님 — 칠판 앞을 거닙니다
      const ms = botWalk(bot, { x: rand(560, 1110), y: CLASSROOM_BOARD.standY }, now);
      bot.busyUntil = now + ms + rand(6000, 15000);
      return;
    }
    if (bot.seat !== null) {
      if (bot.pinned || Math.random() < 0.72) { bot.busyUntil = now + rand(12000, 32000); return; }
      // 일어섭니다 — 앉기 전에 섰던 쪽 러그 귀에(처음부터 앉아 있었으면 오른쪽)
      const seat = CLASSROOM_SEATS[bot.seat];
      const up = (bot.side === -1 ? seat.sides[0] : seat.sides[1]).stand;
      Object.assign(bot, { seat: null, x: up.x, y: up.y, facing: "down" });
      emit(bot, bot, now);
      bot.busyUntil = now + rand(700, 1800);
      return;
    }
    const roll = Math.random();
    if (bot.desk !== null && roll < 0.66) {
      const seat = CLASSROOM_SEATS[bot.desk];
      const side = classroomSeatSide(bot.desk, bot);
      const ms = botWalk(bot, side.stand, now);
      bot.todo.push({ at: now + ms + 450, set: { seat: seat.index, side: side.side, x: seat.sit.x, y: seat.sit.y, facing: "up" }, state: { x: seat.sit.x, y: seat.sit.y, facing: "up" } });
      bot.busyUntil = now + ms + rand(14000, 36000);
      return;
    }
    if (roll > 0.82 && botWarp(bot, now)) return;
    // 교실을 거닙니다
    let goal = null;
    for (let i = 0; i < 8 && !goal; i += 1) {
      const x = rand(120, PLAZA_W - 140);
      const y = rand(250, PLAZA_H - 30);
      if (plazaWalkable(x, y, place)) goal = { x, y };
    }
    const ms = botWalk(bot, goal ?? place.spawn, now);
    bot.busyUntil = now + ms + rand(1500, 6000);
  }
  function botAct(bot, now) {
    if (bot.room === "classroom") { botActClass(bot, now); return; }
    const place = roomOf("plaza");
    // 교실을 켠 반 — 가끔 포털로 걸어가 교실로 들어갑니다
    if (classroom && !bot.teacher && Math.random() < 0.13 && botWarp(bot, now)) return;
    if (Math.random() < 0.24) {
      // 가판대 · 책꽂이 앞으로 가서 한동안 글을 읽습니다
      const spot = pick(place.spots);
      const ms = botWalk(bot, plazaNearest(spot.stand.x + rand(-36, 36), spot.stand.y + rand(-4, 22), place), now);
      const look = plazaFacing(null, (spot.rect[0] + spot.rect[2]) / 2 - bot.x, (spot.rect[1] + spot.rect[3]) / 2 - bot.y);
      const stay = rand(7000, 16000);
      bot.facing = look;
      bot.todo.push({ at: now + ms + 250, state: { x: bot.x, y: bot.y, facing: look, reading: true } });
      bot.todo.push({ at: now + ms + 250 + stay, state: { x: bot.x, y: bot.y, facing: look } });
      bot.busyUntil = now + ms + stay + rand(900, 3000);
      return;
    }
    // 마당을 거닙니다
    let goal = null;
    for (let i = 0; i < 8 && !goal; i += 1) {
      const x = rand(140, PLAZA_W - 140);
      const y = rand(230, PLAZA_H - 40);
      if (plazaWalkable(x, y, place)) goal = { x, y };
    }
    const ms = botWalk(bot, goal ?? plazaNearest(PLAZA_W / 2, PLAZA_H / 2, place), now);
    bot.busyUntil = now + ms + rand(1800, 9000);
  }
  function tick() {
    if (closed) return;
    const now = Date.now();
    for (const bot of bots) {
      if (!bot.here || bot.muted) continue;
      while (bot.todo.length && bot.todo[0].at <= now) {
        const step = bot.todo.shift();
        if (step.set) Object.assign(bot, step.set);
        emit(bot, step.state, now);
      }
      if (bot.busyUntil <= now && !bot.todo.length) botAct(bot, now);
    }
    // 교실을 켠 반은 친구들이 모두 들어와 두 방을 오갑니다 — 나가고 들어오는 바꿈은 광장만 있는 반에서만
    if (!classroom && now >= swapAt) {
      swapAt = now + rand(...SWAP_MS);
      const inside = bots.filter((b) => b.here && !b.muted && !b.teacher);
      const outside = bots.filter((b) => !b.here && !b.muted && !b.teacher);
      if (inside.length && outside.length) {
        botLeave(pick(inside), now);
        botEnter(pick(outside), now);
      }
    }
  }

  // ── 다른 탭 ──
  if (channel) {
    channel.onmessage = (event) => {
      const message = event.data;
      if (closed || !message || typeof message !== "object" || !message.uid || message.uid === uid) return;
      const now = Date.now();
      if (message.k === "hello") { announce(); return; }
      // 다른 탭의 선생님이 출석을 시작 · 종료했거나, 다른 탭의 학생이 출석을 남겼습니다 — 이 탭의 자료에도 옮깁니다
      if (message.k === "call" || message.k === "stop") {
        if (!classroom) return;
        relaying = true;
        Promise.resolve(message.k === "call" ? callClassroomRoll(classId, today) : stopClassAttendance(classId)).catch(() => {}).finally(() => { relaying = false; });
        return;
      }
      if (message.k === "attended") {
        if (classroom && typeof message.id === "string" && !attended.has(message.id)) {
          relayed.add(message.id);
          markStudyAttendance(classId, getDemoStudent(message.id) ?? { uid: message.id }, today).catch(() => {});
        }
        return;
      }
      if (message.k === "bye") {
        peers.delete(message.uid);
        roster.pos(message.uid, { x: 0, y: 0, m: 0, f: 0, g: 1, t: now }, now);
        return;
      }
      if (message.k !== "here") return;
      if (!peers.has(message.uid)) {
        peers.add(message.uid);
        // 그 사람의 가상 친구는 물립니다 — 이제 진짜가 움직입니다(같은 uid라 명단에서는 진짜의 소식이 그 자리를 덮음)
        const bot = bots.find((b) => b.uid === message.uid);
        if (bot) Object.assign(bot, { muted: true, here: false, todo: [] });
      }
      // 진짜 선생님이 들어오면 가상 선생님도 물립니다(반에 선생님은 한 명)
      if (message.who?.r === 1 && !teacherPeer) {
        teacherPeer = true;
        const bot = bots.find((b) => b.teacher && !b.muted);
        if (bot) {
          if (bot.here) botLeave(bot, now);
          bot.muted = true;
        }
      }
      if (message.who) roster.who(message.uid, message.who, now);
      if (message.pos) roster.pos(message.uid, { ...message.pos, t: Number(message.at) || now }, now);
    };
  }
  const onPageHide = () => post({ k: "bye" });
  window.addEventListener("pagehide", onPageHide);

  // ── 교실 — 자리표 · 출석 확인 · 남긴 출석 ──
  // (체험반의 구독은 걸자마자 지금 값을 한 번 줍니다 — 아래 친구들을 세울 때 이미 자리표를 압니다)
  const attended = new Set();   // 오늘 출석 기록이 있는 사람(이 탭의 자료)
  const relayed = new Set();    // 다른 탭이 전해 줘서 남긴 출석(다시 전하지 않음)
  const offs = [];
  if (classroom) {
    offs.push(subscribeStudySeatLayout(classId, "default", (layout) => {
      desks = classroomDesks(layout?.seats);
      for (const bot of bots) {
        bot.desk = classroomSeatOf(desks, bot.uid);
        // 앉아 있던 자리가 더는 제 자리가 아니면 일어섭니다
        if (bot.seat !== null && bot.seat !== bot.desk && bot.here) {
          const seat = CLASSROOM_SEATS[bot.seat];
          const up = (bot.side === -1 ? seat.sides[0] : seat.sides[1]).stand;
          Object.assign(bot, { seat: null, pinned: false, x: up.x, y: up.y, facing: "down", todo: [] });
          emit(bot, bot, Date.now());
        }
      }
    }));
    // 선생님의 출석 확인 — '확인한 때'가 바뀌면 앉아 있는 가상 친구 · 남아 있는 학생이 출석을 남깁니다
    let seenCall;
    let wasOpen = false;
    offs.push(subscribeClass(classId, (cls) => {
      const open = !!cls?.attendanceOpen && cls?.attendanceOpenDate === today;
      const call = Number(cls?.classroomCallAt) || 0;
      if (seenCall !== undefined && !closed) {
        if (call && call !== seenCall && open) {
          for (const bot of bots) {
            if (!bot.here || bot.muted || bot.teacher || bot.room !== "classroom" || bot.seat === null || attended.has(bot.uid)) continue;
            markStudyAttendance(classId, getDemoStudent(bot.uid) ?? { uid: bot.uid, realName: bot.who?.n }, today).catch(() => {});
          }
          if (!relaying) post({ k: "call" });
        } else if (wasOpen && !open && !relaying) post({ k: "stop" });
      }
      seenCall = call;
      wasOpen = open;
    }));
    let first = true;
    offs.push(subscribeClassAttendanceOn(classId, today, (records) => {
      for (const record of records) {
        if (!record?.uid || attended.has(record.uid)) continue;
        attended.add(record.uid);
        // 이 탭에서 새로 남긴 출석만 다른 탭에 전합니다(처음부터 있던 기록 · 전해 받아 남긴 기록은 빼고)
        if (!first && !relayed.has(record.uid)) post({ k: "attended", id: record.uid });
      }
      first = false;
    }));
  }

  (async () => {
    try {
      const user = getCurrentUser();
      const { rankings } = await fetchReadingRankings(classId, "all-time");
      if (closed) return;
      const now = Date.now();
      const exp = now + PLAZA_LIVE_TTL_MS;
      const whoOf = (row) => plazaLiveWho({ name: row.name, character: characterOf({ uid: row.uid, character: row.character }), pet: row.pet, exp });
      const teacherWho = (id) => plazaLiveWho({ name: "선생님", teacher: true, character: characterOf({ uid: id, character: null }), exp });
      const mine = rankings.find((row) => row.uid === uid);
      myWho = me.teacher ? teacherWho(uid)
        : mine ? whoOf(mine)
          : plazaLiveWho({ name: user?.realName || user?.displayName || "나", character: characterOf({ uid, character: null }), exp });
      for (const row of rankings) {
        if (row.uid !== uid) bots.push({ uid: row.uid, who: whoOf(row), here: false, muted: peers.has(row.uid), todo: [], busyUntil: 0, room: "plaza", seat: null, desk: classroomSeatOf(desks, row.uid) });
      }
      // 순서를 섞어 들어올 사람을 고릅니다(볼 때마다 조금씩 다른 얼굴)
      for (let i = bots.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [bots[i], bots[j]] = [bots[j], bots[i]];
      }
      if (!me.teacher && uid !== DEMO_TEACHER_UID) {
        // 가상 선생님 — 교실을 켠 반에서는 교실의 칠판 앞에 있습니다
        bots.push({ uid: DEMO_TEACHER_UID, who: teacherWho(DEMO_TEACHER_UID), teacher: true, here: false, muted: teacherPeer, todo: [], busyUntil: 0, room: classroom ? "classroom" : "plaza", seat: null, desk: null });
      }
      // 앉은 채 다른 사람으로 바꾼 학생들 — 그 자리에 그대로 앉혀 둡니다(내가 그 학생으로 돌아왔으면 걷음)
      const kept = stays.get(classId);
      kept?.delete(uid);
      handlers.onStatus?.("live", "");
      let entered = 0;
      for (const bot of bots) {
        if (bot.muted) continue;
        const stay = classroom ? kept?.get(bot.uid) : undefined;
        if (stay !== undefined && bot.desk === stay) {
          Object.assign(bot, { room: "classroom", pinned: true });
        } else if (!bot.teacher) {
          // 광장에 일곱 — 교실을 켠 반은 나머지가 교실에(제 책상에 앉아), 끈 반은 밖에서 차례를 기다립니다
          if (entered >= BOTS_AT_ONCE) {
            if (!classroom) continue;
            bot.room = "classroom";
          } else entered += 1;
        }
        botEnter(bot, now);
      }
      swapAt = now + rand(...SWAP_MS);
      ticker = setInterval(tick, TICK_MS);
      post({ k: "hello" });
      announce();
    } catch {
      if (!closed) handlers.onStatus?.("off", "server");
    }
  })();

  return {
    publish(state) {
      lastState = state;
      myPos = { pos: plazaLivePos(state), at: Date.now() };
      announce();
    },
    close() {
      if (closed) return;
      post({ k: "bye" });
      closed = true;
      // 앉은 채 나갑니다(다른 사람으로 바꿈 · 탭을 옮김) — 그 자리에 남겨 둡니다. 일어서서 나갔으면 걷습니다.
      if (classroom && !me.teacher) {
        const seat = lastState?.room === "classroom" && Number.isInteger(lastState?.seat) ? lastState.seat : null;
        if (seat !== null) { if (!stays.has(classId)) stays.set(classId, new Map()); stays.get(classId).set(uid, seat); }
        else stays.get(classId)?.delete(uid);
      }
      offs.forEach((off) => off?.());
      clearInterval(ticker);
      window.removeEventListener("pagehide", onPageHide);
      try { channel?.close(); } catch { /* 이미 닫힘 */ }
    },
  };
}
