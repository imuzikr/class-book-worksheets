"use client";
// =============================================================
// 책 광장의 대화 — 무대가 쓰는 상태와 할 일 (components/reading/ReadingPlaza.jsx가 부름)
// -------------------------------------------------------------
// 셈과 자료의 모양은 lib/readingPlazaTalk.js 머리말, 통로는 lib/plazaTalkChannel.js(실서비스) · lib/data/plazaTalkDemo.js(체험반),
// 언제 잇고 놓는지는 lib/plazaLiveSession.js(함께 있는 친구들과 같은 연결). 여기는 그 소식을 화면의 상태로 바꾸고,
// 무대의 단추 · 자판이 부를 일(초대 · 승인 · 거절 · 말 · 나가기)을 한곳에 모읍니다.
//
// 상태
//   incoming — 나에게 온 요청 가운데 아직 대답하지 않은 것(먼저 온 것부터 — 승인창은 하나씩)
//   out      — 대답을 기다리는 내 요청 { to, i, t, k, state: "sending" 보내는 중 · "waiting" 기다림 · "expired" 20초 지남 }
//              20초가 지나도 잠깐(늦게 닿은 승인 — 서버가 3초 더 봐줌) 더 듣습니다. 그 사이 승인이 오면 대화를 엽니다.
//   talk     — 지금(또는 막 끝난) 대화 { id, members(지금 든 사람), names(든 적이 있는 사람의 이름), lines, ended, why }
//              ended면 대화창이 읽던 말을 둔 채 '끝났어요'를 띄우고(혼자 남음 · 반에서 빠짐), 닫기를 누르면 걷습니다.
//   marks    — 머리 위에 잠깐 뜨는 결과(uid → "accepted" · "declined" · "expired")
// 약속
//   · 대화는 한 사람에 하나 — 대화 중에 온 요청은 곧바로 거절합니다(서버도 승인을 받지 않음).
//   · 내 요청은 한 번에 하나 · 같은 친구에게 다시 청하려면 앞 요청에서 15초(규칙이 막음 — 화면도 남은 시간을 알림).
//   · 승인하면 내가 보내 둔 요청은 거둡니다. 혼자 남은 대화는 저절로 나옵니다.
//   · 쉬는 화면(연결을 놓은 동안)에 누른 '나가기'는 다시 이어질 때 보냅니다 — 친구들 대화창에 내가 남지 않게.
//   · 다시 들어오면(새로고침) 내가 든 대화를 되찾습니다(30분 넘게 말이 없던 대화는 이어 가지 않고 나옴).
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TALK_ASK_AGAIN_MS, TALK_ASK_GRACE_MS, TALK_ASK_MS, TALK_SEND_GAP_MS,
  readTalkAsk, readTalkLine, readTalkMembers, sortTalkLines, talkAskAgainIn, talkCallName, talkChoice, talkIdOk, talkIncoming, talkStale, talkTextOf,
} from "@/lib/readingPlazaTalk";

// 머리 위 결과 표시가 머무는 시간
const MARK_MS = 2600;
// 20초가 지난 내 요청을 그만 듣는 때 — 서버가 승인을 3초 더 받아 주므로 그보다 조금 더
const LATE_MS = TALK_ASK_MS + TALK_ASK_GRACE_MS + 2500;
// 대화창이 들고 있는 말의 천장(오래 이야기해도 화면이 무거워지지 않게 — 기록은 서버에 다 남음)
const LINES_MAX = 300;
const OFFLINE = "광장에 다시 이어지는 중이에요. 잠시 뒤 다시 해 주세요.";
function recallLeft(key) {
  try { return key ? window.localStorage.getItem(key) : null; } catch { return null; }
}
function rememberLeft(key, id) {
  try {
    if (!key) return;
    if (id) window.localStorage.setItem(key, id); else window.localStorage.removeItem(key);
  } catch { /* 저장소를 못 쓰는 창 — 기억하지 않을 뿐입니다 */ }
}

/** '가람님이' · '선생님이' · '친구가' — 이름 뒤에 붙는 말 */
export const talkSubject = (call) => (call === "친구" ? "친구가" : `${call}이`);

/** 대화의 일이 안 됐을 때의 한 줄 — 서버 · 체험반이 준 까닭(우리말)을 그대로, 없으면 fallback */
export function talkErrorText(error, fallback) {
  const code = String(error?.code || "");
  if (code === "talk/offline") return OFFLINE;
  if (code === "reading/plaza-talk-disabled") return "이 반에서는 광장 대화를 사용하지 않아요.";
  if (code.startsWith("reading/") && error?.message) return error.message;
  return fallback;
}

// on — 광장 대화를 켠 반인가 · sessionRef — 무대의 실시간 세션(ref — .current.talk가 통로) ·
// idRef — 지금 든 대화의 번호를 담을 무대의 ref(무대가 내 자리를 올릴 때 함께 실음 — 없으면 이 훅의 것)
// nameOf(uid) → { name, teacher } | null(무대가 아는 친구 · 선생님) · say(한 줄) — 맵 아래쪽 안내
// onChange() — 내가 든 대화가 바뀜(무대가 내 자리와 함께 대화 번호를 올림 — 친구 화면의 말풍선)
// onAccepted({ to, talkId, invited }) — 내 요청이 승인됨(새 대화면 무대가 나를 상대 곁으로 걷게 함)
// onJoined({ from, talkId, invited }) — 내가 승인함(무리로의 초대면 내가 초대한 사람 곁으로, 새 대화면 돌아서기만)
// onAsked() — 새 요청이 옴(무대가 열려 있던 고르는 상자를 닫음 — S · C가 승인창의 것이 되게)
// storeKey — 광장 탭을 나갈 때 못 보낸 '나가기'를 이 기기에 적어 둘 열쇠(반 · 사람마다). 다음에 들어와 그 대화를 되찾으면
//   이어 가지 않고 나옵니다(쉬는 화면이라 나가기가 서버에 닿지 못한 채 탭을 나간 때 — 새로고침은 적지 않아 이어 감).
export default function usePlazaTalk({ on = false, sessionRef, idRef = null, storeKey = "", nameOf, say, onChange, onAccepted, onJoined, onAsked }) {
  const [asks, setAsks] = useState({});
  const [out, setOut] = useState(null);
  const [talk, setTalk] = useState(null);
  const [marks, setMarks] = useState(() => new Map());
  const [clock, setClock] = useState(0);
  const [, setHandledTick] = useState(0);

  const asksRef = useRef({});
  const outRef = useRef(null);
  // 지금 든 대화의 번호 — 무대가 준 ref가 있으면 그것을(무대가 내 자리를 올릴 때 함께 실음)
  const ownIdRef = useRef(null);
  const talkIdRef = idRef ?? ownIdRef;
  const countRef = useRef(0);
  const linesRef = useRef(new Map());
  const handled = useRef(new Set());       // 대답한(승인 · 거절 · 저절로 거절) 요청 번호
  const seenAsks = useRef(new Set());      // 이미 알린 요청 번호(onAsked는 새 요청에만)
  const lastAsk = useRef(new Map());       // 받는 사람 → 마지막으로 청한 때(서버 시각)
  const leaving = useRef(new Set());       // 내가 나온 대화(그 뒤에 오는 '빠졌어요'는 끝남으로 보이지 않게)
  const pendingLeave = useRef(new Set());  // 쉬는 동안 못 보낸 나가기
  const timers = useRef(new Set());
  const sentAt = useRef(0);
  const restored = useRef(false);
  const onRef = useRef(on);
  onRef.current = on;
  const keyRef = useRef(storeKey);
  keyRef.current = storeKey;
  const cb = useRef({});
  cb.current = { nameOf, say, onChange, onAccepted, onJoined, onAsked };

  const api = useCallback(() => sessionRef.current?.talk ?? null, [sessionRef]);
  const now = useCallback(() => {
    const t = api()?.now?.();
    return Number.isFinite(t) ? t : Date.now();
  }, [api]);
  const later = useCallback((ms, fn) => {
    const timer = setTimeout(() => { timers.current.delete(timer); fn(); }, Math.max(0, ms));
    timers.current.add(timer);
  }, []);
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); timers.current.clear(); }, []);

  const callOf = useCallback((uid) => {
    const who = cb.current.nameOf?.(uid);
    return talkCallName(who?.name, !!who?.teacher);
  }, []);
  const tellNote = useCallback((text) => cb.current.say?.(text), []);
  const putOut = useCallback((next) => { outRef.current = next; setOut(next); }, []);
  const mark = useCallback((uid, kind) => {
    const key = `${kind}:${Date.now()}`;
    setMarks((prev) => new Map(prev).set(uid, { kind, key }));
    later(MARK_MS, () => setMarks((prev) => {
      if (prev.get(uid)?.key !== key) return prev;
      const next = new Map(prev);
      next.delete(uid);
      return next;
    }));
  }, [later]);

  // ── 대화에 들고 나기 ──
  const activate = useCallback((id) => {
    if (!talkIdOk(id) || talkIdRef.current === id) return;
    talkIdRef.current = id;
    countRef.current = 0;
    linesRef.current = new Map();
    leaving.current.delete(id);
    if (recallLeft(keyRef.current) === id) rememberLeft(keyRef.current, null);
    setTalk({ id, members: [], names: {}, lines: [], ended: false, why: "" });
    api()?.follow(id);
    cb.current.onChange?.();
  }, [api, talkIdRef]);
  // 대화가 끝났습니다(혼자 남음 · 반에서 빠짐) — 대화창은 읽던 말을 둔 채 '끝났어요'로
  const finish = useCallback((id, why) => {
    if (talkIdRef.current === id) {
      talkIdRef.current = null;
      countRef.current = 0;
      cb.current.onChange?.();
    }
    api()?.unfollow();
    setTalk((t) => (t && t.id === id ? { ...t, ended: true, why } : t));
  }, [api, talkIdRef]);
  const sendLeave = useCallback((id) => {
    leaving.current.add(id);
    const session = api();
    if (!session) { pendingLeave.current.add(id); return; }
    session.leave(id).then(() => pendingLeave.current.delete(id), (error) => {
      if (error?.code === "talk/offline") pendingLeave.current.add(id);
    });
  }, [api]);
  /** 대화에서 나옵니다(대화창의 '나가기') — 친구들의 대화창에 '○○님이 나갔어요'가 뜹니다. 내 대화창은 닫힙니다. */
  const leave = useCallback(() => {
    const id = talkIdRef.current;
    setTalk(null);
    if (!id) return;
    talkIdRef.current = null;
    countRef.current = 0;
    cb.current.onChange?.();
    sendLeave(id);
  }, [sendLeave, talkIdRef]);
  /** 끝난 대화의 창을 닫습니다 */
  const dismiss = useCallback(() => setTalk((t) => (t?.ended ? null : t)), []);

  // ── 내 요청 ──
  // 끝난 요청 — 그만 듣고, 15초가 지나면 치웁니다(그 전에는 규칙이 못 지우게 막음 — 그 사이 같은 친구에게 다시 청하지 못함)
  const settleOut = useCallback((cur, result, talkId = null) => {
    if (outRef.current && outRef.current !== cur && !(outRef.current.to === cur.to && outRef.current.i === cur.i)) return;
    putOut(null);
    const session = api();
    session?.forget(cur.to);
    const sent = Number(cur.t) || now();
    later(sent + TALK_ASK_AGAIN_MS + 800 - now(), () => {
      if (outRef.current?.to === cur.to) return;
      api()?.clear(cur.to).catch(() => {});
    });
    const call = callOf(cur.to);
    if (result === "accepted" && talkIdOk(talkId)) {
      mark(cur.to, "accepted");
      activate(talkId);
      cb.current.onAccepted?.({ to: cur.to, talkId, invited: !!cur.k });
    } else if (result === "declined") {
      mark(cur.to, "declined");
      tellNote(`${talkSubject(call)} 지금은 대화하기 어렵대요.`);
    } else if (result === "gone") {
      tellNote(`${talkSubject(call)} 책 광장을 떠나 요청이 닫혔어요.`);
    }
  }, [activate, api, callOf, later, mark, now, putOut, tellNote]);

  const choiceFor = useCallback((to, friendTalk = null) => {
    const cur = outRef.current;
    return talkChoice({
      friendTalk: talkIdOk(friendTalk) ? friendTalk : null,
      myTalk: talkIdRef.current,
      myCount: countRef.current,
      outgoing: cur && (cur.state === "sending" || cur.state === "waiting") ? cur : null,
      againIn: talkAskAgainIn(lastAsk.current.get(to), now()),
    });
  }, [now, talkIdRef]);

  /** 대화 초대(고르는 상자의 '대화 초대') — 대화 중이면 내 대화로 부르는 초대(k)입니다. 돌려줌 보냈는가 */
  const invite = useCallback((to, friendTalk = null) => {
    if (!onRef.current || !to) return false;
    const choice = choiceFor(to, friendTalk);
    if (choice.kind !== "invite") { tellNote(choice.text); return false; }
    const session = api();
    if (!session) { tellNote(OFFLINE); return false; }
    const prev = outRef.current;
    if (prev) session.forget(prev.to);
    const t = now();
    const k = talkIdRef.current;
    putOut({ to, i: null, t, k, state: "sending" });
    lastAsk.current.set(to, t);
    session.ask(to, { k }).then(({ i } = {}) => {
      const cur = outRef.current;
      if (cur && cur.to === to && !cur.i && i) putOut({ ...cur, i, state: cur.state === "sending" ? "waiting" : cur.state });
    }, (error) => {
      const cur = outRef.current;
      if (cur && cur.to === to && cur.state === "sending") putOut(null);
      session.forget(to);
      tellNote(talkErrorText(error, `${talkSubject(callOf(to))} 지금은 대화 초대를 받을 수 없어요. 잠시 뒤 다시 해 볼래요?`));
    });
    return true;
  }, [api, callOf, choiceFor, now, putOut, tellNote, talkIdRef]);
  /** 내 요청을 거둡니다(상대의 승인창이 닫힘) */
  const cancelOut = useCallback(() => {
    const cur = outRef.current;
    if (!cur || (cur.state !== "sending" && cur.state !== "waiting")) return;
    const session = api();
    if (!session) { putOut(null); return; }
    session.cancel(cur.to).catch(() => {});
    settleOut(cur, "cancelled");
  }, [api, putOut, settleOut]);

  // ── 받은 요청 ──
  const markHandled = useCallback((i) => { handled.current.add(i); setHandledTick((n) => n + 1); }, []);
  /** 승인 — 대화에 넣는 일은 서버가 합니다(늦게 닿은 승인 · 정원 · 이미 다른 대화를 서버가 가림) */
  const accept = useCallback((ask) => {
    if (!ask || handled.current.has(ask.i) || !onRef.current) return;
    const session = api();
    if (!session) { tellNote(OFFLINE); return; }
    markHandled(ask.i);
    const cur = outRef.current;
    if (cur && (cur.state === "sending" || cur.state === "waiting")) {
      session.cancel(cur.to).catch(() => {});
      settleOut(cur, "cancelled");
    }
    session.accept(ask.from, ask.i).then((result = {}) => {
      if (!talkIdOk(result.talkId)) return;
      activate(result.talkId);
      cb.current.onJoined?.({ from: ask.from, talkId: result.talkId, invited: !!result.invited });
    }, (error) => tellNote(talkErrorText(error, "대화를 시작하지 못했어요. 잠시 뒤 다시 해 주세요.")));
  }, [activate, api, markHandled, settleOut, tellNote]);
  /** 거절(승인창의 '취소') — 상대 머리 위에 거절 표시가 뜹니다 */
  const decline = useCallback((ask) => {
    if (!ask || handled.current.has(ask.i)) return;
    markHandled(ask.i);
    api()?.decline(ask.from).catch(() => {});
  }, [api, markHandled]);
  const declineAll = useCallback(() => {
    const session = api();
    for (const ask of talkIncoming(asksRef.current, now())) {
      if (handled.current.has(ask.i)) continue;
      handled.current.add(ask.i);
      session?.decline(ask.from).catch(() => {});
    }
    setHandledTick((n) => n + 1);
  }, [api, now]);

  // ── 말 ──
  /** 한 마디 — 돌려줌 { ok } · { error(한 줄 — 빈 글이면 "") } */
  const send = useCallback(async (raw) => {
    const { text, error } = talkTextOf(raw);
    if (error) return { error };
    if (!text) return { error: "" };
    const id = talkIdRef.current;
    if (!id) return { error: "대화가 끝났어요." };
    const session = api();
    if (!session) return { error: OFFLINE };
    const wait = sentAt.current + TALK_SEND_GAP_MS + 80 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const attempt = async () => {
      sentAt.current = Date.now();
      try { await session.say(id, text); return true; } catch (failure) {
        // 쓰기 전에 대화창에 먼저 뜬 그 말을 걷습니다(서버가 거절함)
        const lineId = failure?.lineId;
        if (lineId && linesRef.current.delete(String(lineId))) {
          const list = sortTalkLines([...linesRef.current.values()]);
          setTalk((t) => (t && t.id === id ? { ...t, lines: list } : t));
        }
        if (failure?.code === "talk/offline") throw failure;
        return false;
      }
    };
    try {
      if (await attempt()) return { ok: true };
      // 0.5초에 한 마디(규칙) — 와이파이로 앞 말이 늦게 닿아 막혔으면 한 번만 다시
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (talkIdRef.current !== id) return { error: "대화가 끝났어요." };
      if (await attempt()) return { ok: true };
      return { error: "보내지 못했어요. 잠시 뒤 다시 보내 주세요." };
    } catch {
      return { error: OFFLINE };
    }
  }, [api, talkIdRef]);

  // ── 무대가 한꺼번에 정리할 때 ──
  /** 선생님의 '모두 이동' — 대화 · 내 요청 · 받은 요청을 모두 닫습니다(선생님 결정 — 이동과 함께 대화도 닫힘). 돌려줌 든 대화가 있었나 */
  const endAll = useCallback(() => {
    const id = talkIdRef.current;
    if (id) leave();
    else setTalk(null);
    const closed = !!id;
    const cur = outRef.current;
    if (cur && (cur.state === "sending" || cur.state === "waiting")) {
      api()?.cancel(cur.to).catch(() => {});
      settleOut(cur, "cancelled");
    }
    declineAll();
    return closed;
  }, [api, declineAll, leave, settleOut, talkIdRef]);

  // ── 통로의 소식(무대가 joinPlazaLive의 handlers.talk로 넘김 — 늘 같은 묶음) ──
  const impl = useRef({});
  impl.current = {
    onIncoming(map) {
      const next = map && typeof map === "object" ? map : {};
      asksRef.current = next;
      setAsks(next);
      const waiting = talkIncoming(next, now());
      // 대화 중 · 광장 대화를 끈 반이면 곧바로 거절합니다(상대가 20초를 기다리지 않게)
      if (talkIdRef.current || !onRef.current) {
        for (const ask of waiting) {
          if (handled.current.has(ask.i)) continue;
          handled.current.add(ask.i);
          api()?.decline(ask.from).catch(() => {});
        }
        return;
      }
      if (waiting.some((ask) => !handled.current.has(ask.i) && !seenAsks.current.has(ask.i))) {
        for (const ask of waiting) seenAsks.current.add(ask.i);
        cb.current.onAsked?.();
      }
    },
    onOutgoing(to, raw) {
      const cur = outRef.current;
      if (!cur || cur.to !== to) return;
      if (!raw) {
        // 요청이 사라졌습니다(받는 사람이 광장을 떠나 서버가 걷음 · 읽을 수 없게 됨)
        if (cur.state === "waiting") settleOut(cur, "gone");
        else if (cur.state === "expired") settleOut(cur, "silent");
        return;
      }
      const ask = readTalkAsk(raw, now());
      if (!ask || (cur.i && ask.i !== cur.i)) return;
      let mine = cur;
      if (!cur.i) {
        mine = { ...cur, i: ask.i, t: ask.t, state: cur.state === "sending" ? "waiting" : cur.state };
        putOut(mine);
      } else if (Math.abs((Number(cur.t) || 0) - ask.t) > 1) {
        // 처음 들은 때는 기기의 짐작 — 서버가 적은 때로 고칩니다(20초 · 15초를 서버 시각으로 셈)
        mine = { ...cur, t: ask.t };
        putOut(mine);
      }
      if (ask.state === "accepted") settleOut(mine, "accepted", ask.talk);
      else if (ask.state === "declined") settleOut(mine, "declined");
      else if (ask.state === "cancelled") settleOut(mine, "cancelled");
    },
    onTalk(id, state) {
      if (!talkIdOk(id)) return;
      const active = talkIdRef.current === id;
      if (!state) {
        if (leaving.current.has(id)) return;
        if (active) finish(id, "removed");
        return;
      }
      if (!active) return;
      const members = readTalkMembers(state.members, state.names);
      const names = { ...(state.names && typeof state.names === "object" ? state.names : {}) };
      for (const m of members) if (!names[m.uid]) names[m.uid] = m.name;
      countRef.current = members.length;
      setTalk((t) => (t && t.id === id ? { ...t, members, names } : t));
      if (members.length <= 1) {
        // 모두 나가 혼자 남았습니다 — 대화를 닫습니다(대화창은 읽던 말을 둔 채)
        finish(id, "alone");
        sendLeave(id);
      }
    },
    onLine(id, lineId, raw) {
      if (talkIdRef.current !== id) return;
      const line = readTalkLine(lineId, raw);
      if (!line) return;
      const lines = linesRef.current;
      const had = lines.get(line.id);
      if (had && had.t === line.t && had.text === line.text) return;
      lines.set(line.id, line);
      while (lines.size > LINES_MAX) lines.delete(lines.keys().next().value);
      const list = sortTalkLines([...lines.values()]);
      setTalk((t) => (t && t.id === id ? { ...t, lines: list } : t));
    },
  };
  const handlers = useMemo(() => ({
    onIncoming: (...args) => impl.current.onIncoming(...args),
    onOutgoing: (...args) => impl.current.onOutgoing(...args),
    onTalk: (...args) => impl.current.onTalk(...args),
    onLine: (...args) => impl.current.onLine(...args),
  }), []);

  /** 연결이 이어졌을 때(무대의 onStatus "live") — 못 보낸 나가기를 보내고, 처음이면 내가 든 대화를 되찾습니다 */
  const onLive = useCallback(() => {
    const session = api();
    if (!session) return;
    for (const id of [...pendingLeave.current]) {
      session.leave(id).then(() => pendingLeave.current.delete(id), () => {});
    }
    if (restored.current || talkIdRef.current) return;
    restored.current = true;
    session.restore().then((found) => {
      if (!found || !talkIdOk(found.id) || talkIdRef.current) return;
      const left = recallLeft(keyRef.current) === found.id;
      if (left || !onRef.current || talkStale(found.lastAt, now())) {
        if (left) rememberLeft(keyRef.current, null);
        sendLeave(found.id);
        return;
      }
      activate(found.id);
    }, () => { restored.current = false; });
  }, [activate, api, now, sendLeave, talkIdRef]);

  // 광장 대화를 끄면 — 든 대화에서 나오고 요청을 모두 닫습니다
  useEffect(() => {
    if (!on) endAll();
  }, [on, endAll]);

  // 남은 시간을 셉니다(받은 요청의 20초 · 내 요청의 20초와 늦은 승인을 기다리는 몇 초)
  const busy = !!out || Object.keys(asks).length > 0;
  useEffect(() => {
    if (!busy) return undefined;
    const tick = () => {
      const t = now();
      setClock(t);
      const cur = outRef.current;
      if (!cur || !cur.i) return;
      const age = t - (Number(cur.t) || t);
      if (cur.state === "waiting" && age > TALK_ASK_MS) {
        putOut({ ...cur, state: "expired" });
        mark(cur.to, "expired");
        tellNote(`${talkSubject(callOf(cur.to))} 대답하지 않아 요청이 닫혔어요.`);
      } else if (cur.state === "expired" && age > LATE_MS) {
        settleOut(cur, "silent");
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [busy, callOf, mark, now, putOut, settleOut, tellNote]);

  /** 무대가 문을 닫을 때(광장 탭을 나감 · 아지트로 들어감) — 대화에서 나오고 요청을 닫습니다(화면은 곧 사라짐) */
  const shutdown = useCallback(() => {
    const session = api();
    const id = talkIdRef.current;
    if (id) {
      talkIdRef.current = null;
      leaving.current.add(id);
      // 나가기가 서버에 닿지 못해도(쉬는 화면) 다음에 들어와 이 대화를 이어 가지 않게 적어 둡니다
      rememberLeft(keyRef.current, id);
      if (session) session.leave(id).then(() => { if (recallLeft(keyRef.current) === id) rememberLeft(keyRef.current, null); }, () => {});
    }
    const cur = outRef.current;
    if (cur && (cur.state === "sending" || cur.state === "waiting")) session?.cancel(cur.to).catch(() => {});
    outRef.current = null;
    for (const ask of talkIncoming(asksRef.current, now())) {
      if (handled.current.has(ask.i)) continue;
      handled.current.add(ask.i);
      session?.decline(ask.from).catch(() => {});
    }
  }, [api, now, talkIdRef]);

  const clockNow = clock || now();
  const incomingAll = on ? talkIncoming(asks, clockNow).filter((ask) => !handled.current.has(ask.i)) : [];
  const pending = out && (out.state === "sending" || out.state === "waiting") ? out : null;
  return {
    handlers,
    talkIdRef,
    // 받은 요청 — 지금 보일 하나와 그 뒤에 기다리는 수
    incoming: incomingAll[0] ?? null,
    incomingMore: Math.max(0, incomingAll.length - 1),
    // 대답을 기다리는 내 요청(20초가 지나면 null) · 남은 시간(ms)
    pending,
    pendingLeft: pending ? Math.max(0, TALK_ASK_MS - (clockNow - (Number(pending.t) || clockNow))) : 0,
    talk,
    marks,
    choiceFor, invite, cancelOut, accept, decline, send, leave, dismiss, endAll, shutdown, onLive,
  };
}
