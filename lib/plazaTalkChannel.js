// =============================================================
// 책 광장의 대화 — Realtime Database 통로 (한 반 · 한 사람)
// -------------------------------------------------------------
// 자료의 모양은 lib/readingPlazaTalk.js 머리말, 규칙은 database.rules.json. 여기는 그 자료를 듣고 쓰는 일만 합니다 —
// 언제 잇고 놓는지는 함께 있는 친구들의 통로(lib/plazaLiveChannel.js)와 같아서 lib/plazaLiveSession.js가 함께 엽니다.
// 대화에 사람을 넣는 일(승인)은 서버만 합니다(lib/server/readingService.js의 plazaTalkAccept — lib/data/plazaLive.js가 부름).
//
// 이 파일은 firebase/database를 끌고 옵니다. **광장 탭에서 실시간을 실제로 쓸 때만** 내려받게, 부르는 쪽이 import()로
// 그때 불러옵니다(lib/data/plazaLive.js의 loadLive). 에뮬레이터에 이은 db로 그대로 시험합니다(tests/server/plazaTalk.test.mjs).
//
// handlers — onIncoming(나에게 온 요청들 { 보낸 사람: 요청 }) · onOutgoing(받는 사람, 내 요청 | null) ·
//            onTalk(대화 번호, { members, names } | null — 내가 그 대화에서 빠졌거나 읽을 수 없으면 null) ·
//            onLine(대화 번호, 말 번호, 말) — 내가 들어온 뒤의 말만, 오는 차례대로
// 돌려주는 값은 아래 return 머리말.
// =============================================================
import { get, limitToLast, onChildAdded, onValue, orderByChild, orderByValue, push, query, ref, remove, serverTimestamp, set, startAt, update } from "firebase/database";
import { talkIdOk, talkNewId } from "./readingPlazaTalk.js";

export function openPlazaTalk(db, { classId, uid, onIncoming, onOutgoing, onTalk, onLine }) {
  let closed = false;
  const stops = [];
  const outs = new Map();       // 받는 사람 → 내 요청을 듣기 그만두기
  let followed = null;          // { id, stops, lineStop, j, members, names }
  const askPath = (to, from) => `plazaAsk/${classId}/${to}/${from}`;
  const talkRef = (id, rest = "") => ref(db, `plazaTalk/${classId}/${id}${rest ? `/${rest}` : ""}`);

  // 나에게 온 요청 — 받는 요청함 하나를 통째로(요청은 사람마다 하나라 작음)
  stops.push(onValue(ref(db, `plazaAsk/${classId}/${uid}`), (snap) => { if (!closed) onIncoming?.(snap.val() || {}); }, () => {}));

  function watchOut(to) {
    if (closed || outs.has(to)) return;
    outs.set(to, onValue(ref(db, askPath(to, uid)), (snap) => { if (!closed) onOutgoing?.(to, snap.val()); }, () => { if (!closed) onOutgoing?.(to, null); }));
  }
  function unwatchOut(to) {
    outs.get(to)?.();
    outs.delete(to);
  }

  function unfollow() {
    const was = followed;
    followed = null;
    if (!was) return;
    was.stops.forEach((stop) => stop());
    was.lineStop?.();
  }
  function follow(id) {
    if (closed || !talkIdOk(id) || followed?.id === id) return;
    unfollow();
    const mine = { id, stops: [], lineStop: null, j: null, members: null, names: {} };
    followed = mine;
    const tellState = () => {
      if (closed || followed !== mine || !mine.members) return;
      onTalk?.(id, { members: mine.members, names: mine.names });
    };
    const lost = () => {
      if (closed || followed !== mine) return;
      unfollow();
      onTalk?.(id, null);
    };
    mine.stops.push(onValue(talkRef(id, "m"), (snap) => {
      const members = snap.val() || {};
      const me = members[uid];
      if (!me) { lost(); return; }
      mine.members = members;
      // 말은 내가 들어온 때부터만(규칙이 그 질의만 받음 — 들어오기 전의 말은 원래 있던 사람과 선생님만)
      const j = Number(me.j) || 0;
      if (mine.j === null && j > 0) {
        mine.j = j;
        mine.lineStop = onChildAdded(query(talkRef(id, "l"), orderByChild("t"), startAt(j)),
          (child) => { if (!closed && followed === mine) onLine?.(id, child.key, child.val()); }, () => {});
      }
      tellState();
    }, lost));
    mine.stops.push(onValue(talkRef(id, "n"), (snap) => { mine.names = snap.val() || {}; tellState(); }, () => {}));
  }

  return {
    // 대화 초대 — 받는 사람에게 요청을 적습니다(무리로의 초대면 k = 내 대화 번호). 돌려줌 { i }
    async ask(to, { k = null } = {}) {
      const i = talkNewId(12);
      await set(ref(db, askPath(to, uid)), { t: serverTimestamp(), i, ...(talkIdOk(k) ? { k } : {}) });
      watchOut(to);
      return { i };
    },
    // 내 요청을 거둠(받는 사람 화면의 승인창이 닫힘) · 받은 요청을 거절 · 끝난 내 요청을 치움(15초가 지난 것만 — 규칙)
    cancel: (to) => set(ref(db, `${askPath(to, uid)}/x`), 1),
    decline: (from) => set(ref(db, `${askPath(uid, from)}/no`), 1),
    clear: (to) => remove(ref(db, askPath(to, uid))),
    watchOut,
    unwatchOut,
    follow,
    unfollow,
    // 말 한 마디 — 말과 '마지막으로 말한 때'를 한 번에(규칙이 0.5초에 한 마디로 막음)
    say(id, text) {
      const key = push(talkRef(id, "l")).key;
      return update(talkRef(id), { [`l/${key}`]: { u: uid, x: text, t: serverTimestamp() }, [`e/${uid}`]: serverTimestamp() });
    },
    // 나가기 — '나갔어요' 한 줄과 함께 내 자리를 뺍니다. 입장권이 죽어 한 줄을 못 쓰면 자리만 뺍니다.
    leave(id) {
      if (followed?.id === id) unfollow();
      const key = push(talkRef(id, "l")).key;
      return update(talkRef(id), { [`l/${key}`]: { u: uid, s: "leave", t: serverTimestamp() }, [`m/${uid}`]: null })
        .catch(() => remove(talkRef(id, `m/${uid}`)));
    },
    // 지금 든 대화 — 마지막으로 들어간 대화부터 보며 아직 그 사람 목록에 있으면 { id, j, lastAt(마지막 말의 때) }, 없으면 null
    async restore() {
      const index = (await get(query(ref(db, `plazaTalkBy/${classId}/${uid}`), orderByValue(), limitToLast(3)))).val() || {};
      const ids = Object.entries(index).filter(([id]) => talkIdOk(id)).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)).map(([id]) => id);
      for (const id of ids) {
        try {
          const me = (await get(talkRef(id, "m"))).val()?.[uid];
          if (!me) continue;
          const j = Number(me.j) || 0;
          const last = (await get(query(talkRef(id, "l"), orderByChild("t"), startAt(j), limitToLast(1)))).val() || {};
          const lastAt = Math.max(j, ...Object.values(last).map((line) => Number(line?.t) || 0));
          return { id, j, lastAt };
        } catch { /* 이미 빠진 대화 — 다음 것 */ }
      }
      return null;
    },
    close() {
      if (closed) return;
      closed = true;
      stops.forEach((stop) => stop());
      outs.forEach((stop) => stop());
      outs.clear();
      unfollow();
    },
  };
}
