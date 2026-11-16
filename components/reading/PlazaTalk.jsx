"use client";
// =============================================================
// 책 광장의 대화 — 무대 위에 얹는 조각들 (components/reading/ReadingPlaza.jsx가 그림)
// -------------------------------------------------------------
//   PlazaTalkFocus   고른 친구의 머리 위 — 'A' 표시(누르면 고르는 상자) · 고르는 상자 [대화 초대(S) · 취소(C)].
//                    친구는 걸어 다니므로 무대의 걸음 루프가 place(x, y)로 곧바로 옮깁니다(PlazaActor와 같은 손잡이).
//   PlazaTalkAsk     나에게 온 요청 — '○○님이 대화를 요청합니다' [승인(S) · 취소(C)] · 남은 시간. 책 보기 창(1200) 위에 뜨게
//                    body에 띄웁니다(1300). S · C는 무대 · 이 창 · 아무 데도 초점이 없을 때만 듣습니다(글 칸에 쓰는 중에는 안 들음).
//   PlazaTalkWaiting 대답을 기다리는 내 요청 — '○○님의 대답을 기다려요 · 18초' [요청 거두기]
//   PlazaTalkPanel   오른쪽 대화창 — 든 사람 · 말 · 쓰는 칸(Enter로 보냄 · Shift+Enter는 줄바꿈 — 선생님 요청) · 접기 · 나가기.
//                    접어도 대화에서 나가지 않습니다(접기 · 닫기 · 나가기는 서로 다른 일 — 묶음의 규격). 폰에서는 아래쪽 창.
// 그림은 선생님이 주신 도트 대화 묶음(public/reading-plaza/talk — 목록과 크기는 lib/readingPlazaTalk.js의 TALK_ART),
// 모양은 plaza-talk.css. 글자 · 이름 · S/C는 그림에 굽지 않고 여기서 적습니다.
// =============================================================
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PLAZA_H, PLAZA_W } from "@/lib/readingPlazaMap";
import { plazaLetterKey } from "@/lib/readingClassroom";
import { TALK_ART, TALK_MAX, TALK_TEXT_MAX, talkArtBox, talkEnterKey, talkEnterStillWaiting, talkLineBreak, talkTextOf, talkUnread } from "@/lib/readingPlazaTalk";
import "./plaza-talk.css";

const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;
/** '가람님을' · '선생님을' · '친구를' */
const objectOf = (call) => (call === "친구" ? "친구를" : `${call}을`);

/** 도트 표시 하나(말풍선 · 선택 타원 · 결과) — 닻(꼬리 끝 · 가운데)이 감싼 칸의 (0, 0)에 옵니다 */
export function TalkMarker({ art, className = "", scale = 1, style }) {
  const box = talkArtBox(art);
  const w = Math.round(box.w * scale);
  const h = Math.round(box.h * scale);
  return <img className={`plaza-talk-art ${className}`} src={art.src} alt="" draggable={false} width={w} height={h}
    style={{ left: Math.round(box.left * scale), top: Math.round(box.top * scale), width: w, height: h, ...style }} />;
}

// ── 고른 친구의 머리 위 ──────────────────────────────────────
// at — 친구의 발(지금 자리) · lift — 이름표 위까지의 높이(px — 무대가 캐릭터 크기로 셈) · seated — 앉아 있음(머리 위에 놓음) ·
// raised — 친구 머리 위에 말풍선이 있음(그 위로 한 칸 더) · call — '가람님' · choice — talkChoice의 결과 · group — 내 대화로 부르는 초대
export const PlazaTalkFocus = forwardRef(function PlazaTalkFocus({ at, lift, seated = false, raised = false, call, open = false, choice, group = false, onOpen, onChoose }, ref) {
  const rootRef = useRef(null);
  useImperativeHandle(ref, () => ({
    place(x, y) {
      const el = rootRef.current;
      if (!el) return;
      el.style.left = pct(x, PLAZA_W);
      el.style.top = pct(y, PLAZA_H);
    },
  }), []);
  const ok = choice?.kind === "invite";
  const question = group ? `${objectOf(call)} 지금 대화에 초대할까요?` : `${call}에게 대화를 청할까요?`;
  return (
    <div ref={rootRef} className={`plaza-talk-focus${seated ? " is-seated" : ""}${raised ? " is-raised" : ""}`}
      style={{ left: pct(at.x, PLAZA_W), top: pct(at.y, PLAZA_H), "--talk-lift": `${lift}px` }}>
      <div className="plaza-talk-focus-up">
        {!open ? (
          <button type="button" className="plaza-talk-ready" onClick={onOpen} aria-label={`${call} — 대화 초대 고르기 (A)`} title="A를 누르거나 눌러서 대화 초대">
            <img className="plaza-talk-ready-art" src={TALK_ART.ready.src} alt="" width={TALK_ART.ready.w} height={TALK_ART.ready.h} draggable={false} />
            <kbd aria-hidden="true">A</kbd>
          </button>
        ) : (
          <div className="plaza-talk-menu plaza-talk-frame plaza-talk-frame--menu" role="group" aria-label={`${call}과의 대화`}>
            <p className="plaza-talk-menu-note">
              {ok ? question : (
                <><img className="plaza-talk-inline-mark" src={TALK_ART.unavailable.src} alt="" width="22" height="19" />{choice?.text}</>
              )}
            </p>
            <div className="plaza-talk-buttons">
              <button type="button" className="plaza-talk-btn plaza-talk-btn--primary" disabled={!ok} onClick={() => onChoose(true)}>
                대화 초대 <kbd>S</kbd>
              </button>
              <button type="button" className="plaza-talk-btn plaza-talk-btn--secondary" onClick={() => onChoose(false)}>
                취소 <kbd>C</kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ── 나에게 온 요청 ───────────────────────────────────────────
// title — talkAskTitle의 첫 줄 · left — 남은 시간(ms) · more — 그 뒤에 기다리는 요청 수 · stageRef — 무대(여기에 초점이 있어도 S · C를 들음)
const EDITABLE = "input, textarea, select, [contenteditable='true'], [contenteditable='']";
export function PlazaTalkAsk({ title, left, more = 0, group = false, stageRef, onAccept, onDecline }) {
  const rootRef = useRef(null);
  const act = useRef({ onAccept, onDecline });
  act.current = { onAccept, onDecline };
  // 맵 위쪽에 섭니다(상단바 · 반 이동 알림 띠 아래 — 무대가 서는 자리를 재서). 창 크기가 바뀌면 다시 잽니다.
  const [top, setTop] = useState(96);
  useLayoutEffect(() => {
    const measure = () => {
      const stageTop = stageRef?.current?.getBoundingClientRect().top;
      setTop(Math.max(36, Math.round((Number.isFinite(stageTop) ? stageTop : 60) + 34)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [stageRef]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target;
      const here = rootRef.current?.contains(target);
      const onStage = stageRef?.current && (target === stageRef.current || stageRef.current.contains(target));
      const idle = !target || target === document.body || target === document.documentElement;
      if (!here && !onStage && !idle) return;
      if (!here && target?.closest?.(EDITABLE)) return;
      const letter = plazaLetterKey(e);
      if (letter !== "s" && letter !== "c") return;
      e.preventDefault();
      if (letter === "s") act.current.onAccept(); else act.current.onDecline();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageRef]);
  if (typeof document === "undefined") return null;
  const seconds = Math.max(0, Math.ceil(left / 1000));
  return createPortal(
    <div ref={rootRef} className="plaza-talk-ask plaza-talk-frame plaza-talk-frame--dialog" role="alertdialog" aria-modal="false" aria-labelledby="plaza-talk-ask-title" aria-describedby="plaza-talk-ask-sub"
      style={{ top }}>
      <img className="plaza-talk-ask-mark" src={TALK_ART.incoming.src} alt="" width={TALK_ART.incoming.w} height={TALK_ART.incoming.h} draggable={false} />
      <h4 id="plaza-talk-ask-title">{title}</h4>
      <p id="plaza-talk-ask-sub">
        {group ? "승인하면 친구들이 이야기하는 대화에 함께해요." : "승인하면 친구가 곁으로 와서 대화창이 열려요."}
        <span className="plaza-talk-ask-left"> {seconds}초 뒤 닫혀요</span>
        {more > 0 && <span className="plaza-talk-ask-more"> · 기다리는 요청 {more}개</span>}
      </p>
      <div className="plaza-talk-buttons">
        <button type="button" className="plaza-talk-btn plaza-talk-btn--primary" onClick={onAccept}>승인 <kbd>S</kbd></button>
        <button type="button" className="plaza-talk-btn plaza-talk-btn--secondary" onClick={onDecline}>취소 <kbd>C</kbd></button>
      </div>
    </div>,
    document.body,
  );
}

// ── 대답을 기다리는 내 요청 ────────────────────────────────────
export function PlazaTalkWaiting({ call, left, onCancel }) {
  const seconds = Math.max(0, Math.ceil(left / 1000));
  return (
    <div className="plaza-talk-waiting" role="status">
      <img src={TALK_ART.waiting.src} alt="" width="26" height="22" />
      <span><b>{call}</b>의 대답을 기다려요 <em>{seconds}초</em></span>
      <button type="button" onClick={onCancel}>요청 거두기</button>
    </div>
  );
}

// ── 오른쪽 대화창 ─────────────────────────────────────────────
// talk — usePlazaTalk의 talk { id, members, names, lines, ended, why } · myUid · onSend(글) → { ok } | { error } ·
// onLeave · onDismiss(끝난 대화의 창 닫기) · teacher — 내가 선생님인가(안내 글을 조금 다르게)
const ENDED_TEXT = {
  alone: "모두 나가 대화가 끝났어요.",
  removed: "대화가 닫혔어요.",
};
function clockOf(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const touchOnly = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function PlazaTalkPanel({ talk, myUid, onSend, onLeave, onDismiss, onCover }) {
  const [folded, setFolded] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [seenAt, setSeenAt] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  // Enter로 보내기(선생님 요청 — lib/readingPlazaTalk.js의 talkEnterKey · talkLineBreak)
  const composingRef = useRef(false);  // 한글을 조합하는 중인가(compositionstart ~ end)
  const enterAt = useRef(0);           // 조합 중에 누른 Enter의 때 — 조합이 끝나면 보냄
  const newlineOk = useRef(false);     // 방금 누른 것이 Shift+Enter — 그 줄바꿈만 들임
  const panelRef = useRef(null);
  const nearBottom = useRef(true);
  const lines = talk.lines;
  const lastAt = lines.length ? lines[lines.length - 1].t : 0;
  const members = talk.members;
  const nameOf = (uid) => (uid === myUid ? "나" : talk.names?.[uid] || members.find((m) => m.uid === uid)?.name || "친구");
  // 선생님의 이름표는 '선생님'(서버가 입장권에서 옮김) — 대화에서 나간 뒤에도 이름으로 알아봅니다
  const teacherOf = (uid) => !!members.find((m) => m.uid === uid)?.teacher || talk.names?.[uid] === "선생님";
  // '가람님이' · '선생님이' · '내가' — 들어옴 · 나감 줄
  const subjectOf = (uid) => {
    if (uid === myUid) return "내가";
    const name = nameOf(uid);
    if (teacherOf(uid)) return "선생님이";
    return name === "친구" ? "친구가" : `${name}님이`;
  };

  // 새 대화가 열리면 펼치고, 쓰는 칸에 초점을 둡니다(손가락으로 쓰는 기기는 자판이 맵을 가려 두지 않음)
  useEffect(() => {
    setFolded(false);
    setDraft("");
    setError("");
    setSeenAt(0);
    nearBottom.current = true;
    if (!touchOnly()) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [talk.id]);
  // 펼쳐 둔 동안은 다 읽은 것 · 맨 아래를 보고 있었으면 새 말에 따라 내려갑니다
  useLayoutEffect(() => {
    if (folded) return;
    setSeenAt(lastAt);
    const el = listRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [folded, lastAt, lines.length]);
  const unread = folded ? talkUnread(lines, myUid, seenAt) : 0;
  // 맵을 가린 만큼을 무대에 알립니다(시점이 내 캐릭터를 가려지지 않은 쪽의 가운데에 둠) — 오른쪽 창이면 오른쪽, 폰의 아래쪽 창이면 아래
  useLayoutEffect(() => {
    const el = panelRef.current;
    const wrap = el?.closest(".plaza-stage-wrap");
    if (!onCover) return undefined;
    const report = () => {
      if (!el || !wrap || folded) { onCover({ right: 0, bottom: 0 }); return; }
      const a = el.getBoundingClientRect();
      const b = wrap.getBoundingClientRect();
      const sheet = a.left - b.left < 40;
      onCover(sheet ? { right: 0, bottom: Math.round(Math.max(0, b.bottom - a.top)) } : { right: Math.round(Math.max(0, b.right - a.left)), bottom: 0 });
    };
    report();
    const observer = typeof ResizeObserver !== "undefined" && wrap ? new ResizeObserver(report) : null;
    observer?.observe(wrap);
    return () => { observer?.disconnect(); onCover({ right: 0, bottom: 0 }); };
  }, [folded, onCover]);

  // 보내기 — 칸의 글을 곧바로 비우고 보냅니다. 그래서 Enter가 두 번 와도(맥 크롬 · 줄바꿈까지 넣는 입력기) 둘째는 빈 칸이라
  // 아무 일도 없고, 앞 말이 가는 동안에도 다음 말을 이어 적어 보냅니다(0.5초 간격은 usePlazaTalk의 send가 맞춤).
  // 글은 칸(DOM)에서 읽습니다 — 조합을 막 마친 마지막 글자가 아직 상태(draft)에 안 들었을 수 있어서.
  function submit() {
    if (talk.ended) return;
    const el = inputRef.current;
    const raw = el ? el.value : draft;
    const { text, error: problem } = talkTextOf(raw);
    if (problem) { setError(problem); return; }
    if (!text) return;
    if (el) el.value = "";   // 곧바로 비움 — 다음 Enter가 같은 글을 또 읽지 않게(상태는 아래에서 맞춤)
    setDraft("");
    setError("");
    nearBottom.current = true;
    el?.focus({ preventScroll: true });
    Promise.resolve()
      .then(() => onSend(text))
      .catch(() => ({ error: "보내지 못했어요. 잠시 뒤 다시 보내 주세요." }))
      .then((result) => {
        if (result?.ok || !result?.error) return;
        setError(result.error);
        setDraft((now) => now || raw);   // 보내지 못한 말은 칸이 비어 있으면 되돌려 둡니다(다시 보내기 쉽게)
      });
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;
  // Enter로 보냅니다 · Shift+Enter는 줄바꿈 · Ctrl/⌘+Enter도 보냄(예전 손버릇). 한글을 조합하는 중의 Enter는 조합이 끝난 뒤
  // 보냅니다 — 걸러 내기만 하면 첫 Enter가 먹히고, 막으면(preventDefault) 마지막 글자가 칸에 안 들어갈 수 있어 기본 동작은 둡니다.
  function onKeyDown(e) {
    const act = talkEnterKey({ key: e.key, code: e.code, shiftKey: e.shiftKey, composing: e.nativeEvent.isComposing || composingRef.current });
    if (act) {
      newlineOk.current = act === "newline";
      if (act === "later") enterAt.current = Date.now();
      if (act === "send") { e.preventDefault(); enterAt.current = 0; submit(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setFolded(true); }
  }
  function onCompositionEnd() {
    composingRef.current = false;
    const pressed = enterAt.current;
    enterAt.current = 0;
    // 조합 중에 누른 Enter — 마지막 글자가 칸에 들어간 뒤(브라우저에 따라 compositionend 뒤에 input이 한 번 더 옴) 보냅니다
    if (talkEnterStillWaiting(pressed, Date.now())) setTimeout(() => submitRef.current(), 0);
  }
  // 줄바꿈이 keydown 없이 오는 길 — 조합을 마치며 줄바꿈까지 넣는 입력기 · 휴대폰 자판. Shift+Enter가 연 것만 들이고, 나머지는 막고
  // 보냅니다(React의 onBeforeInput은 inputType을 몰라 칸에 직접 겁니다 — 칸은 접기 · 끝남에 따라 새로 섬).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const onBeforeInput = (e) => {
      const act = talkLineBreak({ inputType: e.inputType, newlineOk: newlineOk.current, composing: composingRef.current || e.isComposing });
      if (!act) return;
      newlineOk.current = false;
      if (act === "allow") return;
      e.preventDefault();
      if (act === "later") enterAt.current = Date.now();
      else submitRef.current();
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [folded, talk.ended, talk.id]);
  const count = members.length;
  // 든 사람 — 나를 맨 앞에, 그다음 들어온 차례
  const people = useMemo(() => members.map((m) => ({ ...m, me: m.uid === myUid })).sort((a, b) => Number(b.me) - Number(a.me)), [members, myUid]);
  const left = TALK_TEXT_MAX - [...draft].length;

  if (folded) {
    return (
      <button type="button" className="plaza-talk-fold" onClick={() => setFolded(false)}
        aria-label={`대화창 펼치기 — ${count}명${unread ? ` · 새 말 ${unread}개` : ""}`}>
        <img src={TALK_ART.iconChat.src} alt="" width="22" height="20" />
        <span>대화 <b>{count}</b>명</span>
        {unread > 0 && <span className="plaza-talk-unread"><img src={TALK_ART.unread.src} alt="" width="24" height="22" /><b>{unread > 99 ? "99+" : unread}</b></span>}
        <img className="plaza-talk-fold-expand" src={TALK_ART.iconExpand.src} alt="" width="18" height="18" />
      </button>
    );
  }
  return (
    <section ref={panelRef} className={`plaza-talk-panel plaza-talk-frame plaza-talk-frame--panel${talk.ended ? " is-ended" : ""}`} aria-label="광장 대화">
      <header className="plaza-talk-head">
        <h4><img src={TALK_ART.iconParticipants.src} alt="" width="22" height="17" />광장 대화 <small>{count}명</small></h4>
        <button type="button" className="plaza-talk-icon" onClick={() => setFolded(true)} aria-label="대화창 접기" title="접기 — 대화는 그대로예요">
          <img src={TALK_ART.iconMinimize.src} alt="" width="18" height="6" />
        </button>
        {talk.ended
          ? <button type="button" className="plaza-talk-icon" onClick={onDismiss} aria-label="대화창 닫기" title="닫기"><img src={TALK_ART.iconClose.src} alt="" width="16" height="16" /></button>
          : <button type="button" className="plaza-talk-leave" onClick={onLeave} title="이 대화에서 나가요 — 친구들의 대화창에 '나갔어요'가 떠요"><img src={TALK_ART.iconLeave.src} alt="" width="16" height="15" />대화 나가기</button>}
      </header>
      <ul className="plaza-talk-people" aria-label="함께 이야기하는 사람">
        {people.map((m) => <li key={m.uid} className={`${m.me ? "is-me" : ""}${m.teacher ? " is-teacher" : ""}`}>{m.me ? "나" : m.name}</li>)}
      </ul>
      <ol className="plaza-talk-lines" ref={listRef} aria-live="polite" aria-relevant="additions"
        onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {lines.length === 0 && <li className="plaza-talk-line is-system"><span>대화가 열렸어요. 먼저 인사해 볼까요?</span></li>}
        {lines.map((line, index) => {
          if (line.kind !== "say") {
            return <li key={line.id} className="plaza-talk-line is-system"><span>{subjectOf(line.uid)} {line.kind === "join" ? "들어왔어요" : "나갔어요"}</span></li>;
          }
          const mine = line.uid === myUid;
          const prev = lines[index - 1];
          const head = !mine && !(prev && prev.kind === "say" && prev.uid === line.uid);
          return (
            <li key={line.id} className={`plaza-talk-line${mine ? " is-mine" : ""}${teacherOf(line.uid) ? " is-teacher" : ""}`}>
              {head && <b className="plaza-talk-who">{nameOf(line.uid)}</b>}
              <span className="plaza-talk-bubble">{line.text}</span>
              <time>{clockOf(line.t)}</time>
            </li>
          );
        })}
        {talk.ended && <li className="plaza-talk-line is-system is-end"><span>{ENDED_TEXT[talk.why] ?? ENDED_TEXT.removed}</span></li>}
      </ol>
      {talk.ended ? (
        <div className="plaza-talk-endbar">
          <button type="button" className="plaza-talk-btn plaza-talk-btn--secondary" onClick={onDismiss}>대화창 닫기</button>
        </div>
      ) : (
        <form className="plaza-talk-compose" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {count < TALK_MAX && <p className="plaza-talk-tip">다른 친구를 누르고 A를 누르면 이 대화에 초대해요 · {TALK_MAX}명까지</p>}
          <div className="plaza-talk-write">
            <textarea ref={inputRef} value={draft} rows={2} maxLength={TALK_TEXT_MAX * 2} placeholder="이야기를 적어요 (Enter로 보내기 · Shift+Enter 줄바꿈)"
              aria-label="보낼 말" enterKeyHint="send" onChange={(e) => { setDraft(e.target.value); if (error) setError(""); }} onKeyDown={onKeyDown}
              onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={onCompositionEnd} />
            <button type="submit" className="plaza-talk-send" disabled={!draft.trim() || left < 0} aria-label="메시지 보내기" title="보내기 (Enter)">
              <img src={TALK_ART.iconSend.src} alt="" width="22" height="19" />
            </button>
          </div>
          <div className="plaza-talk-foot">
            <span className="plaza-talk-notice">모든 대화는 선생님이 확인할 수 있습니다.</span>
            <span className={`plaza-talk-count${left < 0 ? " is-over" : ""}`}>{[...draft].length}/{TALK_TEXT_MAX}</span>
          </div>
          {error && <p className="plaza-talk-error" role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}
