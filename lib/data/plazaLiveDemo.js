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
// 이 파일은 데모에서만 내려받습니다(lib/data/plazaLive.js의 import()).
// =============================================================
import { DEMO_TEACHER_UID } from "../demoClassroom";
import { characterOf } from "../readingCharacterCatalog";
import { PLAZA_H, PLAZA_SPOTS, PLAZA_W, plazaNearest, plazaPath, plazaWalkable } from "../readingPlazaMap";
import { PLAZA_LIVE_TTL_MS, plazaLiveGone, plazaLivePos, plazaLiveWho, plazaRoster, plazaSpawnFor } from "../readingPlazaLive";
import { PLAZA_WALK_SPEED, plazaFacing } from "../readingPlazaSprites";
import { getCurrentUser } from "../user";
import { fetchReadingRankings } from "./reading";

// 한 번에 마당에 있는 가상 친구(선생님 빼고) · 가상 친구를 살피는 사이 · 한 명이 나가고 들어오는 사이
const BOTS_AT_ONCE = 7;
const TICK_MS = 600;
const SWAP_MS = [24000, 42000];
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function openDemoPlazaLive(classId, me, handlers = {}) {
  const uid = me.uid;
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
  const emit = (bot, state, now) => roster.pos(bot.uid, { ...plazaLivePos(state), t: now }, now);
  function botEnter(bot, now) {
    const at = plazaSpawnFor(bot.uid);
    Object.assign(bot, { x: at.x, y: at.y, facing: "down", here: true, todo: [], busyUntil: now + rand(600, 7000) });
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
    const route = plazaPath(bot, goal);
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
  function botAct(bot, now) {
    if (Math.random() < 0.24) {
      // 가판대 · 책꽂이 앞으로 가서 한동안 글을 읽습니다
      const spot = pick(PLAZA_SPOTS);
      const ms = botWalk(bot, plazaNearest(spot.stand.x + rand(-36, 36), spot.stand.y + rand(-4, 22)), now);
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
      if (plazaWalkable(x, y)) goal = { x, y };
    }
    const ms = botWalk(bot, goal ?? plazaNearest(PLAZA_W / 2, PLAZA_H / 2), now);
    bot.busyUntil = now + ms + rand(1800, 9000);
  }
  function tick() {
    if (closed) return;
    const now = Date.now();
    for (const bot of bots) {
      if (!bot.here || bot.muted) continue;
      while (bot.todo.length && bot.todo[0].at <= now) emit(bot, bot.todo.shift().state, now);
      if (bot.busyUntil <= now && !bot.todo.length) botAct(bot, now);
    }
    if (now >= swapAt) {
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
        if (row.uid !== uid) bots.push({ uid: row.uid, who: whoOf(row), here: false, muted: peers.has(row.uid), todo: [], busyUntil: 0 });
      }
      // 순서를 섞어 들어올 사람을 고릅니다(볼 때마다 조금씩 다른 얼굴)
      for (let i = bots.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [bots[i], bots[j]] = [bots[j], bots[i]];
      }
      if (!me.teacher && uid !== DEMO_TEACHER_UID) {
        bots.push({ uid: DEMO_TEACHER_UID, who: teacherWho(DEMO_TEACHER_UID), teacher: true, here: false, muted: teacherPeer, todo: [], busyUntil: 0 });
      }
      handlers.onStatus?.("live", "");
      let entered = 0;
      for (const bot of bots) {
        if (bot.muted) continue;
        if (!bot.teacher && entered >= BOTS_AT_ONCE) continue;
        if (!bot.teacher) entered += 1;
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
      myPos = { pos: plazaLivePos(state), at: Date.now() };
      announce();
    },
    close() {
      if (closed) return;
      post({ k: "bye" });
      closed = true;
      clearInterval(ticker);
      window.removeEventListener("pagehide", onPageHide);
      try { channel?.close(); } catch { /* 이미 닫힘 */ }
    },
  };
}
