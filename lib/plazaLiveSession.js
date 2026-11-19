// =============================================================
// 책 광장의 실시간 — 언제 잇고 놓나 (한 화면의 한 번 입장)
// -------------------------------------------------------------
// 자료의 모양 · 규칙은 lib/readingPlazaLive.js 머리말, 통로는 lib/plazaLiveChannel.js.
// 여기는 그 둘 사이에서 '언제'만 정합니다. 서버 · 데이터베이스 · 브라우저는 밖에서 받아 씁니다
// (lib/data/plazaLive.js가 진짜 것을 넣고, tests/server/plazaLive.test.mjs가 에뮬레이터와 가짜 화면을 넣어 시험).
//
// 하는 일
//   · 서버에서 입장권을 받고(enter — 반 구성원인지는 서버가 봄) 그 뒤에 통로를 엽니다(connect).
//   · 입장권은 2시간짜리라 만료 15분 전에 새로 받습니다. 올리기 · 듣기가 거부되면(입장권이 죽음 — 만료 · 선생님이
//     반에서 뺌) 새로 받아 다시 잇습니다. 서버가 거절하면 그만두고, 새로 받자마자 또 막히면(규칙이 게시되지 않음)
//     그만둡니다.
//   · **연결을 아낍니다** — 무료 요금제의 동시 연결은 100개입니다. 탭이 45초 넘게 가려지거나(다른 탭 · 화면 꺼짐)
//     학생이 10분 동안 아무것도 안 누르면 놓습니다('나감' 표시를 남김). 돌아와 움직이면 곧바로 다시 잇습니다.
//     선생님 화면은 가만히 두어도 놓지 않습니다(교실 화면에 띄워 두고 수업하는 자리 — 반마다 하나뿐).
//     교실에서 제자리에 앉아 있는 학생(handlers.keep()이 참)은 한 시간까지 놓지 않습니다 — 앉아서 선생님의
//     출석 확인을 기다리는 동안 선생님 화면에서 사라지지 않게. 가려진 탭은 앉아 있어도 45초 뒤에 놓습니다.
//
// createPlazaLiveSession({ classId, me: { uid, teacher }, handlers, enter, connect, page, times, accept }) → { publish(내 자리), talk, close() }
//   handlers — current() 지금 내 자리(이어질 때마다 이것을 올림) · keep() 가만히 있어도 더 오래 이어 둘 때인가(앉아 있음) ·
//              onJoin(uid, 입장권, 자리, 소식의 나이 ms) · onWho(uid, 입장권) · onMove(uid, 자리) · onLeave(uid) · onStatus(상태, 까닭)
//   상태     — "connecting" 잇는 중 · "live" 이어짐 · "resting" 쉬는 화면이라 놓음 ·
//              "off" 쓰지 않음(까닭: "server" 서버가 데이터베이스에 못 적음 · "denied" 규칙이 막음 · "refused" 서버가 거절)
//   enter()   — 입장권을 받습니다 → { live, expiresAt }. 서버가 거절하면 code가 든 오류, 닿지 못하면 code 없는 오류.
//   connect() — 연결을 잡습니다 → { open(통로의 handlers) → { publish, close() }, openTalk?(대화 통로의 handlers), release() }
//   accept(보낸 사람, 요청 번호) — 받은 대화 요청을 승인합니다(서버 — 대화에 사람을 넣는 일은 서버만). → { talkId, invited }
//   handlers.talk — 광장 대화(lib/readingPlazaTalk.js · 통로 lib/plazaTalkChannel.js)의 소식:
//              { onIncoming(나에게 온 요청들), onOutgoing(받는 사람, 내 요청 | null), onTalk(대화 번호, 상태 | null), onLine(대화 번호, 말 번호, 말) }
//     돌려주는 talk는 그 통로를 감싼 것 — 쉬는 화면이라 통로가 닫혀 있으면 쓰기는 code "talk/offline"으로 거절되고,
//     듣던 것(따라가는 대화 · 대답을 기다리는 내 요청)은 기억해 두었다가 다시 이어질 때 다시 듣습니다.
//   page      — { hidden() 탭이 가려졌나, watch(onInput, onVisibility) → 그만 듣기 }
// =============================================================
import {
  PLAZA_LIVE_HIDDEN_MS, PLAZA_LIVE_IDLE_MS, PLAZA_LIVE_RENEW_MS, PLAZA_LIVE_SEATED_IDLE_MS, PLAZA_LIVE_TTL_MS, plazaLivePos, plazaRoster,
} from "./readingPlazaLive.js";

export const PLAZA_LIVE_TIMES = Object.freeze({
  // 서버에 닿지 못했을 때(와이파이) 다시 해 보는 사이
  retry: 30 * 1000,
  // 쉬는 화면인지 · 만료된 입장권이 있는지 살피는 사이
  beat: 30 * 1000,
  // 입장권을 새로 받는 사이(만료 15분 전)
  renew: Math.max(60 * 1000, PLAZA_LIVE_TTL_MS - PLAZA_LIVE_RENEW_MS),
  // 거부된 뒤 새로 받았는데 이 안에 또 거부되면 그만둡니다(입장권 탓이 아니라 규칙이 막는 것)
  again: 60 * 1000,
  hidden: PLAZA_LIVE_HIDDEN_MS,
  idle: PLAZA_LIVE_IDLE_MS,
  // 제자리에 앉아 있는 학생이 가만히 있어도 이어 두는 시간
  idleSeated: PLAZA_LIVE_SEATED_IDLE_MS,
});

export function createPlazaLiveSession({ classId, me, handlers = {}, enter, connect, page, times = PLAZA_LIVE_TIMES, accept = null }) {
  const uid = me.uid;
  let closed = false;
  // 광장 대화의 통로(있으면)와, 다시 이어질 때 다시 들을 것(따라가는 대화 · 대답을 기다리는 내 요청)
  let talkChannel = null;
  const talkWants = { follow: null, out: new Set() };
  let dead = false;          // 다시 잇지 않습니다(서버가 거절 · 규칙이 막음)
  let wanted = true;         // 이어 두려는가 — 쉬는 화면이면 false
  let status = "";
  let channel = null;
  let link = null;
  let opening = false;
  let round = 0;             // 통로를 열 때마다 하나씩 — 닫은 통로의 늦은 소식을 흘려보냄
  let offset = 0;            // 서버 시계 − 내 시계(ms)
  let lastActive = Date.now();
  let deniedAt = 0;          // 마지막으로 거부된 때
  let renewTimer = null;
  let retryTimer = null;
  let hiddenTimer = null;

  const serverNow = () => Date.now() + offset;
  const guard = (fn) => (...args) => { if (!closed) fn?.(...args); };
  const roster = plazaRoster(uid, {
    onJoin: guard(handlers.onJoin), onWho: guard(handlers.onWho), onMove: guard(handlers.onMove), onLeave: guard(handlers.onLeave),
  });
  const say = (next, why = "") => {
    if (closed || status === next) return;
    status = next;
    handlers.onStatus?.(next, why);
  };

  // 통로를 닫습니다 — '나감' 표시가 서버에 닿은 뒤(늦어도 0.8초) 연결을 놓습니다.
  function shut() {
    const open = channel;
    const held = link;
    channel = null;
    link = null;
    round += 1;
    talkChannel?.close();
    talkChannel = null;
    if (open) open.close().then(() => held?.release(), () => held?.release());
    else held?.release();
  }
  function drop() {
    clearTimeout(renewTimer);
    renewTimer = null;
    shut();
    roster.clear();
  }
  function giveUp(why) {
    dead = true;
    clearTimeout(retryTimer);
    retryTimer = null;
    drop();
    say("off", why);
  }

  async function open() {
    if (closed || dead || !wanted || channel || opening) return;
    opening = true;
    clearTimeout(retryTimer);
    retryTimer = null;
    say("connecting");
    try {
      const ticket = await enter();
      if (closed) return;
      // 서버가 데이터베이스에 적지 못했습니다(아직 안 만들었거나 주소가 틀림) — 광장은 그대로 씁니다.
      if (!ticket?.live) { giveUp("server"); return; }
      const held = await connect();
      if (closed || dead || !wanted || channel) { held.release(); return; }
      link = held;
      round += 1;
      const mine = round;
      channel = held.open({
        classId, uid,
        onWho: (id, raw) => { if (mine === round) roster.who(id, raw, serverNow()); },
        onWhoGone: (id) => { if (mine === round) roster.whoGone(id, serverNow()); },
        onPos: (id, raw) => { if (mine === round) roster.pos(id, raw, serverNow()); },
        onPosGone: (id) => { if (mine === round) roster.posGone(id, serverNow()); },
        onClock: (ms) => { offset = ms; },
        onLink: (linked) => { if (mine === round) say(linked ? "live" : "connecting"); },
        onDenied: () => { if (mine === round) denied(); },
        // 이어질 때마다 무대에 '지금 자리'를 물어 올립니다(기억해 둔 옛 자리를 다시 올리지 않음)
        fresh: () => {
          const now = closed ? null : handlers.current?.();
          return now ? plazaLivePos(now) : null;
        },
      });
      // 광장 대화 — 같은 연결로 엽니다(새 연결을 쓰지 않음). 듣던 것은 다시 듣습니다.
      if (handlers.talk && typeof held.openTalk === "function") {
        const talk = handlers.talk;
        const live = (fn) => (...args) => { if (!closed && mine === round) fn?.(...args); };
        talkChannel = held.openTalk({
          classId, uid,
          onIncoming: live(talk.onIncoming), onOutgoing: live(talk.onOutgoing), onTalk: live(talk.onTalk), onLine: live(talk.onLine),
        });
        if (talkWants.follow) talkChannel.follow(talkWants.follow);
        for (const to of talkWants.out) talkChannel.watchOut(to);
      }
      renewLater(times.renew);
    } catch (error) {
      if (closed) return;
      // 서버가 거절했으면(반에서 빠짐 · 사용 중지 · 광장을 끔) 그만두고, 닿지 못했으면(와이파이) 잠시 뒤 다시 해 봅니다.
      if (error?.code) giveUp("refused");
      else if (wanted && !dead) retryTimer = setTimeout(open, times.retry);
    } finally {
      opening = false;
    }
  }

  // 듣기가 끊겼거나 올리기가 거듭 거부됐습니다 — 입장권이 죽었거나(만료 · 선생님이 반에서 뺌) 규칙이 막은 것.
  // 입장권을 새로 받아 다시 잇습니다(반에서 빠졌으면 서버가 거절 → 그만둠). 새로 받자마자 또 막혔으면 입장권 탓이
  // 아니라 규칙이 막는 것이라(게시되지 않음) 그만둡니다 — 서버에 거듭 묻지 않게.
  function denied() {
    if (closed || dead || !channel) return;
    drop();
    const now = Date.now();
    if (now - deniedAt < times.again) { giveUp("denied"); return; }
    deniedAt = now;
    open();
  }

  // 다음 갱신은 늘 하나만 — 새로 걸기 전에 걸려 있던 것을 걷습니다(refresh가 갱신 도중에 또 불러도 타이머가 겹쳐 쌓이지 않게).
  function renewLater(ms) {
    clearTimeout(renewTimer);
    renewTimer = setTimeout(renew, ms);
  }
  async function renew() {
    renewTimer = null;
    if (closed || dead || !channel) return;
    const mine = round;
    try {
      const ticket = await enter();
      if (closed || dead || mine !== round) return;
      if (!ticket?.live) { giveUp("server"); return; }
      renewLater(times.renew);
    } catch (error) {
      if (closed || dead || mine !== round) return;
      if (error?.code) giveUp("refused");
      else renewLater(times.retry);
    }
  }

  // 쉬는 화면 — 연결을 놓습니다(친구들 화면에서 내 캐릭터가 사라지고, 내 화면의 친구들도 내려감)
  function rest() {
    if (closed || dead || !wanted) return;
    wanted = false;
    clearTimeout(retryTimer);
    retryTimer = null;
    drop();
    say("resting");
  }
  const active = () => {
    lastActive = Date.now();
    if (closed || dead || wanted || page.hidden()) return;
    wanted = true;
    open();
  };
  const onVisibility = () => {
    clearTimeout(hiddenTimer);
    hiddenTimer = null;
    if (page.hidden()) hiddenTimer = setTimeout(rest, times.hidden);
    else active();
  };
  const beat = setInterval(() => {
    if (closed) return;
    roster.sweep(serverNow());
    const idle = handlers.keep?.() ? Math.max(times.idle, times.idleSeated ?? times.idle) : times.idle;
    if (!me.teacher && wanted && !page.hidden() && Date.now() - lastActive >= idle) rest();
  }, times.beat);
  const unwatch = page.watch(active, onVisibility);
  if (page.hidden()) onVisibility();
  open();

  const offline = () => Promise.reject(Object.assign(new Error("광장에 이어져 있지 않아요."), { code: "talk/offline" }));
  const talk = {
    // 서버 시각(ms) — 요청의 20초 · 다시 요청하는 15초를 셀 때(기기 시계가 틀려도 맞게)
    now: serverNow,
    ask(to, options) {
      if (!talkChannel) return offline();
      talkWants.out.add(to);
      return talkChannel.ask(to, options);
    },
    cancel: (to) => (talkChannel ? talkChannel.cancel(to) : offline()),
    decline: (from) => (talkChannel ? talkChannel.decline(from) : offline()),
    clear: (to) => (talkChannel ? talkChannel.clear(to) : offline()),
    // 대답을 기다리던 내 요청을 그만 들음(끝난 요청)
    forget(to) {
      talkWants.out.delete(to);
      talkChannel?.unwatchOut(to);
    },
    accept: (from, askId) => (typeof accept === "function" ? accept(from, askId) : offline()),
    follow(id) {
      talkWants.follow = id;
      talkChannel?.follow(id);
    },
    unfollow() {
      talkWants.follow = null;
      talkChannel?.unfollow();
    },
    say: (id, text) => (talkChannel ? talkChannel.say(id, text) : offline()),
    leave(id) {
      if (talkWants.follow === id) talkWants.follow = null;
      return talkChannel ? talkChannel.leave(id) : offline();
    },
    restore: () => (talkChannel ? talkChannel.restore() : Promise.resolve(null)),
  };

  return {
    // 내 자리 — { x, y, path, mode, facing, reading, room, seat, talk }(lib/readingPlazaLive.js의 plazaLivePos가 받는 모양).
    // 통로가 아직 없으면(잇는 중 · 쉬는 중) 버립니다 — 이어질 때 current()로 지금 자리를 올립니다.
    publish(next) {
      channel?.publish(plazaLivePos(next));
    },
    // 내 이름표가 바뀌었습니다('내 프로필'에서 캐릭터를 바꿈 — 학생 · 선생님) — 입장권을 곧바로 새로 받아 친구들 화면에도
    // 새 모습이 가게 합니다(입장권의 캐릭터는 서버가 프로필에서 읽어 적음 · 안 하면 다음 갱신(2시간 안)까지 옛 모습).
    // 이어져 있지 않으면 할 일이 없습니다 — 다음에 이을 때 새 입장권을 받습니다.
    refresh() {
      if (closed || dead || !channel) return;
      clearTimeout(renewTimer);
      renewTimer = null;
      renew();
    },
    talk,
    close() {
      if (closed) return;
      closed = true;
      clearInterval(beat);
      clearTimeout(renewTimer);
      clearTimeout(retryTimer);
      clearTimeout(hiddenTimer);
      unwatch?.();
      shut();
    },
  };
}
