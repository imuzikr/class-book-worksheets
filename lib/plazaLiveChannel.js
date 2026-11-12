// =============================================================
// 책 광장의 실시간 — Realtime Database 통로 (한 반 · 한 사람)
// -------------------------------------------------------------
// 자료의 모양 · 규칙은 lib/readingPlazaLive.js 머리말과 database.rules.json. 여기는 그 자료를 듣고 올리는 일만 합니다 —
// 언제 잇고 놓는지(입장권 · 쉬는 화면)는 lib/data/plazaLive.js가 정합니다.
//
// 이 파일은 firebase/database를 끌고 옵니다. **광장 탭에서 실시간을 실제로 쓸 때만** 내려받게, 부르는 쪽이
// import()로 그때 불러옵니다(책방 첫 화면 · 광장 탭 묶음에 넣지 않음).
// db(Realtime Database 인스턴스)를 받아 쓰므로 에뮬레이터에 이은 것으로 그대로 시험합니다
// (tests/server/plazaLive.test.mjs — 진짜 규칙 · 두 사람).
// =============================================================
import { child, onChildAdded, onChildChanged, onChildRemoved, onDisconnect, onValue, ref, serverTimestamp, set } from "firebase/database";
import { PLAZA_LIVE_SEND_MS, plazaLiveGone } from "./readingPlazaLive.js";

// 올리기가 거듭 거부되면(입장권이 죽었음) 알리기까지 다시 해 보는 횟수 · 그 사이
const RETRY_MAX = 3;
const RETRY_MS = 400;
// 나갈 때 '나감' 표시가 서버에 닿기를 기다리는 가장 긴 시간
const CLOSE_WAIT_MS = 800;
// 같은 자리인가(올리는 모양 — plazaLivePos)
const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.m === b.m && a.f === b.f
  && (a.w ?? "") === (b.w ?? "") && (a.a ?? 0) === (b.a ?? 0) && (a.g ?? 0) === (b.g ?? 0);

// handlers — onWho(uid, 입장권) · onWhoGone(uid) · onPos(uid, 자리) · onPosGone(uid) · onClock(서버 시계와의 차이 ms) ·
//            onLink(이어졌나) · onDenied(error — 읽기가 끊겼거나 올리기가 거듭 거부됨) ·
//            fresh() — 지금 내 자리(없으면 마지막으로 올린 것을 다시 씀). 이어질 때마다 · 내 자리에 '나감'이 적혔을 때 부릅니다 —
//            길을 따라 걷던 중에 끊겼다 이어지면 '처음 자리에서 그 길로'가 아니라 '지금 자리에서 남은 길로'를 올려야 해서입니다.
// 돌려주는 값 { publish(자리), close() }. 자리는 plazaLivePos의 모양(t는 여기서 붙임).
export function openPlazaChannel(db, { classId, uid, onWho, onWhoGone, onPos, onPosGone, onClock, onLink, onDenied, fresh }) {
  const base = ref(db, `plaza/${classId}`);
  const whoRef = child(base, "who");
  const posRef = child(base, "pos");
  const mine = child(posRef, uid);
  const stops = [];
  let closed = false;
  let linked = false;
  let wanted = null;      // 올릴 자리(가장 최근 것만 — 밀린 것은 버림)
  let sent = null;        // 마지막으로 올린 자리
  let sentAt = 0;
  let timer = null;
  let fails = 0;

  const denied = (error) => { if (!closed) onDenied?.(error); };
  const schedule = (wait) => { if (!timer && !closed) timer = setTimeout(flush, Math.max(0, wait)); };

  function flush() {
    timer = null;
    if (closed || !linked || !wanted) return;
    const state = wanted;
    wanted = null;
    sent = state;
    sentAt = Date.now();
    set(mine, { ...state, t: serverTimestamp() }).then(() => { fails = 0; }, (error) => {
      if (closed) return;
      // 규칙이 거부했습니다 — 몰아서 도착해 너무 잦았거나(와이파이), 입장권이 죽었거나.
      // 몇 번은 가장 최근 자리로 다시 올리고, 그래도 안 되면 알립니다(부르는 쪽이 입장권을 새로 받음).
      fails += 1;
      if (fails >= RETRY_MAX) { denied(error); return; }
      if (!wanted) wanted = state;
      schedule(RETRY_MS);
    });
  }

  // 내 자리를 올립니다 — 가장 짧은 간격(PLAZA_LIVE_SEND_MS)보다 잦으면 마지막 것만 모아서.
  // 방금 올린 것과 같으면 올리지 않습니다(친구 수만큼 내려받는 양이 드는 일 — 같은 소식을 거듭 보내지 않음).
  function publish(state) {
    if (!wanted && !fails && same(sent, state)) return;
    wanted = state;
    if (closed || !linked) return;
    const wait = PLAZA_LIVE_SEND_MS - (Date.now() - sentAt);
    if (wait <= 0 && !timer) flush();
    else schedule(wait);
  }

  stops.push(onValue(ref(db, ".info/serverTimeOffset"), (snap) => onClock?.(Number(snap.val()) || 0)));
  stops.push(onValue(ref(db, ".info/connected"), (snap) => {
    linked = snap.val() === true;
    onLink?.(linked);
    if (!linked || closed) return;
    // 이어질 때마다 — 끊기면(탭 닫기 · 와이파이) 서버가 대신 남길 '나감' 표시를 맡겨 두고, 지금 자리를 다시 올립니다.
    const now = fresh?.() ?? null;
    if (now) wanted = now;
    else if (!wanted && sent) wanted = sent;
    onDisconnect(mine).set({ ...plazaLiveGone(wanted ?? sent), t: serverTimestamp() }).catch(() => {});
    if (wanted) {
      if (timer) { clearTimeout(timer); timer = null; }
      sentAt = 0;
      flush();
    }
  }));
  stops.push(onChildAdded(whoRef, (snap) => onWho?.(snap.key, snap.val()), denied));
  stops.push(onChildChanged(whoRef, (snap) => onWho?.(snap.key, snap.val()), denied));
  stops.push(onChildRemoved(whoRef, (snap) => onWhoGone?.(snap.key), denied));
  const hear = (snap) => {
    if (snap.key !== uid) { onPos?.(snap.key, snap.val()); return; }
    // 내 자리에 '나감'이 적혔는데 나는 아직 여기 있습니다(같은 계정의 다른 탭이 닫힘) — 다시 올립니다.
    if (!closed && linked && snap.val()?.g === 1 && sent && !wanted) { wanted = fresh?.() ?? sent; schedule(PLAZA_LIVE_SEND_MS); }
  };
  stops.push(onChildAdded(posRef, hear, denied));
  stops.push(onChildChanged(posRef, hear, denied));
  stops.push(onChildRemoved(posRef, (snap) => { if (snap.key !== uid) onPosGone?.(snap.key); }, denied));

  return {
    publish,
    // 나갑니다 — 듣기를 멈추고 '나감' 표시를 남깁니다. 표시가 서버에 닿으면(늦어도 0.8초 뒤) 끝납니다.
    close() {
      if (closed) return Promise.resolve();
      closed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      stops.forEach((stop) => stop());
      const last = sent ?? wanted;
      if (!linked || !last) return Promise.resolve();
      onDisconnect(mine).cancel().catch(() => {});
      return Promise.race([
        set(mine, { ...plazaLiveGone(last), t: serverTimestamp() }).catch(() => {}),
        new Promise((resolve) => { setTimeout(resolve, CLOSE_WAIT_MS); }),
      ]);
    },
  };
}
