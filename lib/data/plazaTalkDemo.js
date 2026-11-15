// =============================================================
// 책 광장의 대화 — 데모(체험반) 흉내
// -------------------------------------------------------------
// 서버도 Realtime Database도 없으므로, 실서비스의 통로(lib/plazaTalkChannel.js) · 승인(서버)과 **같은 모양의 소식**을
// 이 탭 안에서 만들어 냅니다 — 무대(components/reading/ReadingPlaza.jsx)는 차이를 모릅니다.
//   · 가상 친구에게 대화를 청하면 잠시 뒤 승인하거나(대부분) 거절합니다. 승인하면 대화가 열리고, 내가 말하면 그 친구가
//     잠시 뒤 대답합니다(책 이야기 몇 마디를 돌려 씀). 무리로 초대한 친구는 내 곁으로 걸어옵니다.
//   · 가상 친구가 가끔 나에게 대화를 청합니다(한 차시에 두 번까지) — 받은 요청 창(승인 · 취소)을 혼자서도 볼 수 있게.
//   · 가상 친구끼리도 가끔 마주 서서 이야기합니다(머리 위 말풍선만 — 내용은 없음).
//   · 같은 브라우저의 다른 탭과는 BroadcastChannel로 요청 · 승인 · 말을 주고받습니다(두 창을 나란히 두고 두 학생으로 대화).
// 선생님의 '광장 대화' 기록은 이 탭에서 나눈 대화를 보여 줍니다(demoTalkHistory — 체험반은 서버가 없음).
// 이 파일은 데모에서만 내려받습니다(lib/data/plazaLiveDemo.js가 부름).
// =============================================================
import { TALK_ASK_AGAIN_MS, TALK_MAX, plazaTalkSpot, readTalkAsk, talkAskAcceptable, talkIdOk, talkNewId } from "../readingPlazaTalk";

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// 가상 친구가 하는 말 — 책 이야기(누구의 글도 옮기지 않은 지어낸 말)
const OPENERS = ["안녕! 무슨 책 읽고 있어?", "반가워! 요즘 재미있는 책 있어?", "나 방금 가판대에서 네 발자국 봤어!", "같이 이야기하자 😊"];
const REPLIES = [
  "오, 그거 재미있겠다!", "나도 그 장면 좋았어.", "그 책 다 읽으면 한 권의 책도 써 볼래?", "나는 요즘 모험 이야기를 읽고 있어.",
  "주인공이 왜 그랬는지 궁금해.", "책꽂이에 새 감상이 올라왔더라.", "오늘은 열 쪽 넘게 읽었어!", "다음에 빌려줄 수 있어?",
  "맞아, 나도 그렇게 생각해.", "그 부분 다시 읽어 봐야겠다.",
];
const GROUP_REPLIES = ["안녕! 나도 끼워 줘서 고마워.", "무슨 이야기 하고 있었어?", "다들 반가워!"];

// 이 탭이 살아 있는 동안 나눈 대화 — 반마다(신원을 바꿔도 그대로 · 선생님의 기록 창이 읽음)
const archives = new Map();
const archiveOf = (classId) => {
  if (!archives.has(classId)) archives.set(classId, new Map());
  return archives.get(classId);
};
/** [데모 · 교사] 한 학생이 든 대화들 — 서버의 talkHistory와 같은 모양 */
export function demoTalkHistory(classId, studentUid) {
  const talks = [...archiveOf(classId).values()]
    .filter((talk) => talk.n[studentUid])
    .map((talk) => ({ id: talk.id, at: talk.a, names: { ...talk.n }, lines: talk.l.map((line) => ({ ...line })) }));
  return { talks, live: true };
}

// me — { uid, teacher, name() 지금 내 이름표 · pos() 지금 내 자리({ x, y, room }) · inClass() }
// bots — 가상 친구 손잡이(lib/data/plazaLiveDemo.js): find(uid) · nameOf(uid — 가상 친구 · 다른 탭 사람의 이름표) · nearMe() ·
//        idlePair() · setTalk(bot, id | null) · stay(bot, ms) · resume(bot) · walkNear(bot, target, others)
// post — 다른 탭에 알리기({ k: "talk", ... }) · handlers — 무대의 talk 소식(onIncoming · onOutgoing · onTalk · onLine)
export function createDemoTalk({ classId, me, bots, post, handlers = {} }) {
  const uid = me.uid;
  const talks = archiveOf(classId);
  const asks = new Map();        // `${받는 사람}>${보낸 사람}` → 요청
  const outWatch = new Set();
  const timers = new Set();
  let followed = null;
  let closed = false;
  let botAsks = 0;
  let nextBotAsk = Date.now() + rand(22000, 32000);
  let nextChat = Date.now() + rand(9000, 16000);
  const later = (ms, fn) => {
    const timer = setTimeout(() => { timers.delete(timer); if (!closed) fn(); }, ms);
    timers.add(timer);
  };
  const key = (to, from) => `${to}>${from}`;
  const mineOf = (id) => talks.get(id)?.m?.[uid] ?? null;

  // ── 소식 ──
  function tellIncoming() {
    const map = {};
    for (const [k, raw] of asks) { const [to, from] = k.split(">"); if (to === uid) map[from] = raw; }
    handlers.onIncoming?.(map);
  }
  function tellOutgoing(to) { if (outWatch.has(to)) handlers.onOutgoing?.(to, asks.get(key(to, uid)) ?? null); }
  function tellTalk(id) {
    if (followed !== id) return;
    const talk = talks.get(id);
    if (!talk?.m?.[uid]) { followed = null; handlers.onTalk?.(id, null); return; }
    handlers.onTalk?.(id, { members: { ...talk.m }, names: { ...talk.n } });
  }
  function hearLine(id, line) {
    const j = mineOf(id)?.j ?? Infinity;
    if (followed === id && line.t >= j) handlers.onLine?.(id, line.id, line);
  }

  // ── 자료 고치기(이 탭) — 다른 탭에서 온 것도 같은 길 ──
  function putAsk(to, from, raw, share = true) {
    if (raw) asks.set(key(to, from), raw); else asks.delete(key(to, from));
    if (to === uid) tellIncoming();
    if (from === uid) tellOutgoing(to);
    if (share) post({ k: "talk", op: "ask", to, from, raw });
  }
  function putTalk(id, patch, share = true) {
    const talk = talks.get(id) ?? { id, a: patch.a ?? Date.now(), m: {}, n: {}, l: [] };
    Object.assign(talk.m, patch.m ?? {});
    for (const out of patch.out ?? []) delete talk.m[out];
    Object.assign(talk.n, patch.n ?? {});
    talks.set(id, talk);
    if (share) post({ k: "talk", op: "talk", id, patch: { a: talk.a, m: patch.m, n: patch.n, out: patch.out } });
    tellTalk(id);
    return talk;
  }
  function putLine(id, line, share = true) {
    const talk = talks.get(id);
    if (!talk || talk.l.some((l) => l.id === line.id)) return;
    talk.l.push(line);
    if (share) post({ k: "talk", op: "line", id, line });
    hearLine(id, line);
  }

  // ── 대화에 넣기(실서비스의 서버 승인과 같은 판정) ──
  const currentOf = (who) => [...talks.values()].find((talk) => talk.m[who])?.id ?? null;
  const nameOf = (who) => (who === uid ? me.name() : bots.nameOf(who) ?? talks.get(currentOf(who))?.n?.[who] ?? "친구");
  const memberOf = (who, at) => ({ n: nameOf(who), j: at, ...(who === uid && me.teacher ? { r: 1 } : {}) });
  function join(accepter, from, raw) {
    const now = Date.now();
    const ask = readTalkAsk(raw, now - 3000);
    const theirs = currentOf(from);
    const mine = currentOf(accepter);
    if (ask.k) {
      const talk = talks.get(ask.k);
      if (theirs !== ask.k || !talk) throw Object.assign(new Error("친구의 대화가 이미 끝났어요."), { code: "reading/plaza-talk-gone" });
      if (talk.m[accepter]) return { talkId: ask.k, invited: true };
      if (Object.keys(talk.m).length >= TALK_MAX) throw Object.assign(new Error(`대화는 ${TALK_MAX}명까지 함께할 수 있어요.`), { code: "reading/plaza-talk-full" });
      if (mine) throw Object.assign(new Error("이미 다른 친구와 이야기하고 있어요."), { code: "reading/plaza-talk-busy" });
      putTalk(ask.k, { m: { [accepter]: memberOf(accepter, now) }, n: { [accepter]: nameOf(accepter) } });
      putLine(ask.k, { id: talkNewId(), u: accepter, s: "join", t: now });
      putAsk(accepter, from, { ...raw, ok: ask.k });
      return { talkId: ask.k, invited: true };
    }
    if (theirs) throw Object.assign(new Error("친구가 다른 대화를 시작했어요."), { code: "reading/plaza-talk-busy" });
    if (mine) throw Object.assign(new Error("이미 다른 친구와 이야기하고 있어요."), { code: "reading/plaza-talk-busy" });
    const id = talkNewId();
    putTalk(id, { a: now, m: { [from]: memberOf(from, now), [accepter]: memberOf(accepter, now) }, n: { [from]: nameOf(from), [accepter]: nameOf(accepter) } });
    putAsk(accepter, from, { ...raw, ok: id });
    return { talkId: id, invited: false };
  }

  // ── 가상 친구 ──
  const botsIn = (id) => Object.keys(talks.get(id)?.m ?? {}).map((who) => bots.find(who)).filter(Boolean);
  function botSay(bot, id, text, wait) {
    later(wait, () => {
      const talk = talks.get(id);
      if (!talk?.m?.[bot.uid]) return;
      putLine(id, { id: talkNewId(), u: bot.uid, x: text, t: Date.now() });
    });
  }
  // 내 요청을 받은 가상 친구 — 대부분 승인, 가끔 거절(다른 친구와 이야기 중이면 늘 거절)
  function botAnswer(bot, raw) {
    later(rand(1200, 2400), () => {
      const now = Date.now();
      const current = asks.get(key(bot.uid, uid));
      if (!talkAskAcceptable(current, raw.i, now)) return;
      if (bot.talk || Math.random() < 0.15) { putAsk(bot.uid, uid, { ...current, no: 1 }); return; }
      try {
        const { talkId, invited } = join(bot.uid, uid, current);
        bots.setTalk(bot, talkId);
        bots.stay(bot, 10 * 60 * 1000);
        // 무리로의 초대 — 초대받은 친구가 무리 쪽(나)으로 걸어옵니다(선생님 결정). 새 대화는 요청한 내가 걸어감(무대가 함).
        if (invited) {
          const others = Object.keys(talks.get(talkId).m).filter((who) => who !== bot.uid).map((who) => (who === uid ? me.pos() : bots.find(who))).filter(Boolean);
          bots.walkNear(bot, me.pos(), others);
          botSay(bot, talkId, pick(GROUP_REPLIES), rand(2600, 3800));
        } else botSay(bot, talkId, pick(OPENERS), rand(2400, 3600));
      } catch { putAsk(bot.uid, uid, { ...current, no: 1 }); }
    });
  }
  // 대화가 가상 친구만 남으면 끝냅니다 — 친구들은 다시 거닙니다
  function settle(id) {
    const talk = talks.get(id);
    if (!talk) return;
    const people = Object.keys(talk.m);
    if (people.some((who) => !bots.find(who))) return;
    for (const bot of botsIn(id)) {
      putTalk(id, { out: [bot.uid] });
      bots.setTalk(bot, null);
      bots.resume(bot);
    }
  }

  // ── 무대가 부르는 것(실서비스의 통로와 같은 모양) ──
  const api = {
    now: () => Date.now(),
    async ask(to, { k = null } = {}) {
      const now = Date.now();
      const prev = asks.get(key(to, uid));
      if (prev && now - Number(prev.t) < TALK_ASK_AGAIN_MS) throw Object.assign(new Error("Permission denied"), { code: "PERMISSION_DENIED" });
      const raw = { t: now, i: talkNewId(12), ...(talkIdOk(k) ? { k } : {}) };
      outWatch.add(to);
      putAsk(to, uid, raw);
      const bot = bots.find(to);
      if (bot) botAnswer(bot, raw);
      return { i: raw.i };
    },
    async cancel(to) { const raw = asks.get(key(to, uid)); if (raw) putAsk(to, uid, { ...raw, x: 1 }); },
    async decline(from) { const raw = asks.get(key(uid, from)); if (raw) putAsk(uid, from, { ...raw, no: 1 }); },
    async clear(to) { putAsk(to, uid, null); },
    forget(to) { outWatch.delete(to); },
    async accept(from, askId) {
      const raw = asks.get(key(uid, from));
      if (!talkAskAcceptable(raw, askId, Date.now())) throw Object.assign(new Error("요청이 이미 끝났어요."), { code: "reading/plaza-talk-gone" });
      const result = join(uid, from, raw);
      const bot = bots.find(from);
      if (bot) {
        bots.setTalk(bot, result.talkId);
        bots.stay(bot, 10 * 60 * 1000);
        // 가상 친구가 청한 새 대화 — 요청한 친구가 내 곁으로 걸어옵니다
        if (!result.invited) {
          bots.walkNear(bot, me.pos(), []);
          botSay(bot, result.talkId, pick(OPENERS), rand(2800, 4000));
        }
      }
      return result;
    },
    follow(id) {
      followed = id;
      tellTalk(id);
      const j = mineOf(id)?.j ?? Infinity;
      for (const line of talks.get(id)?.l ?? []) if (line.t >= j) handlers.onLine?.(id, line.id, line);
    },
    unfollow() { followed = null; },
    async say(id, text) {
      if (!mineOf(id)) throw Object.assign(new Error("Permission denied"), { code: "PERMISSION_DENIED" });
      putLine(id, { id: talkNewId(), u: uid, x: text, t: Date.now() });
      // 이 대화의 가상 친구 하나가 대답합니다(여럿이어도 한 명 — 대화창이 넘치지 않게)
      const listeners = botsIn(id);
      if (listeners.length) botSay(pick(listeners), id, pick(REPLIES), rand(1500, 3200));
    },
    async leave(id) {
      if (!mineOf(id)) return;
      putLine(id, { id: talkNewId(), u: uid, s: "leave", t: Date.now() });
      putTalk(id, { out: [uid] });
      if (followed === id) followed = null;
      settle(id);
    },
    async restore() {
      const id = currentOf(uid);
      if (!id) return null;
      const talk = talks.get(id);
      const j = talk.m[uid].j;
      return { id, j, lastAt: Math.max(j, ...talk.l.map((line) => line.t)) };
    },
  };

  return {
    api,
    // 다른 탭에서 온 것({ k: "talk", ... })
    hear(message) {
      if (closed) return;
      if (message.op === "ask") putAsk(message.to, message.from, message.raw, false);
      else if (message.op === "talk") putTalk(message.id, message.patch ?? {}, false);
      else if (message.op === "line") putLine(message.id, message.line, false);
    },
    // 가상 친구가 스스로 하는 일 — 가끔 나에게 대화를 청하고, 친구끼리 이야기합니다(lib/data/plazaLiveDemo.js의 tick이 부름)
    tick(now) {
      if (closed) return;
      if (now >= nextBotAsk && botAsks < 2) {
        nextBotAsk = now + rand(80000, 110000);
        const free = !currentOf(uid) && ![...asks.keys()].some((k) => k.startsWith(`${uid}>`) && readTalkAsk(asks.get(k), now)?.state === "waiting");
        const bot = free ? pick(bots.nearMe()) : null;
        if (bot) {
          botAsks += 1;
          putAsk(uid, bot.uid, { t: now, i: talkNewId(12) });
        }
      }
      if (now >= nextChat) {
        nextChat = now + rand(24000, 40000);
        const pair = bots.idlePair();
        if (pair) {
          const [a, b] = pair;
          const id = talkNewId();
          bots.setTalk(a, id);
          bots.setTalk(b, id);
          bots.stay(a, 30000);
          bots.stay(b, 30000);
          bots.walkNear(b, a, []);
          later(rand(18000, 28000), () => {
            for (const bot of [a, b]) if (bot.talk === id) { bots.setTalk(bot, null); bots.resume(bot); }
          });
        }
      }
    },
    close() {
      closed = true;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
  };
}
