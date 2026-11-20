"use client";
// =============================================================
// 공지 보내기 — 떠 있는 동그라미의 '공지 보내기' 행성이 여는 창(선생님만 · 선생님 요청 · 2026년 11월)
// -------------------------------------------------------------
// 메신저처럼 동그라미 자리에서 펼쳐집니다(틀 components/HubPanel.jsx · 자리 app/styles/41-floating-messenger.css의 .hub-panel).
// 책 봄에서도 켜져 있습니다(lib/hubPlace.js의 HUB_READING_KEYS — 독서로 검색 · 성장·뱃지와 함께). 한때 책 광장 · 교실 맵 위의
// '공지사항' 단추가 대화창 자리에 열던 창이었는데, 선생님 요청으로 이 동그라미로 옮겼습니다 — 맵 위 단추 · 대화창의 탭 줄을
// 되살리지 마세요.
//   · 위에 보낸 공지(최근 20건 — 옛것이 위 · 새것이 아래), 아래에 쓰는 칸. **Enter로 보내기 · Shift+Enter 줄바꿈**(광장 대화와
//     같은 손놀림 — lib/useEnterSend.js 한 곳. 앱의 다른 채팅 칸은 그대로 Ctrl/⌘+Enter).
//   · 보낸 공지는 반 공지 그대로(classes/{c}/classNotices — 상단바 📢와 같은 곳 · 알림 벨 · 메신저 '공지' 탭도 같은 공지)이고,
//     학생 화면에는 어디에 있든(광장 · 교실 · 아지트 · 책꽂이 · 책방 …) 가운데에 글자만 잠시 뜹니다
//     (components/reading/ClassNoticeSpotlight.jsx). 보낸 공지는 고치거나 지울 수 없습니다(학생이 이미 읽었을 수 있음).
//   · 쓰던 글은 창을 닫아도(× · Esc · 바깥 누르기 · 동그라미) 이 화면에 남습니다 — 반마다 따로(drafts). 보내면 지웁니다.
// 이 파일은 누를 때만 내려받습니다(FloatingHub의 dynamic) — 모든 화면의 첫 묶음에 안 실리게.
// =============================================================
import "./notice-send.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import HubPanel from "./HubPanel";
import { CLASS_NOTICE_MAX, sendClassNotice, subscribeClassNotices } from "@/lib/store";
import { noticeMs } from "@/lib/classNoticeSpot";
import { useEnterSend } from "@/lib/useEnterSend";

// 보낸 공지는 최근 이만큼 — 상단바 📢의 '보낸 공지'와 같은 수(같은 질의라 구독을 함께 씀)
const NOTICE_HISTORY = 20;
// 쓰던 글 — 창을 닫았다 다시 열어도 남게(이 화면이 떠 있는 동안 · 반마다)
const drafts = new Map();
const touchOnly = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

function noticeClock(ms) {
  if (!ms) return "보내는 중…";
  const d = new Date(ms);
  const now = new Date();
  const time = `${d.getHours() < 12 ? "오전" : "오후"} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toDateString() === now.toDateString() ? time : `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

// classId — 보낼 반(선생님이 고른 반) · className — 그 반 이름(머리에 적어 엉뚱한 반에 보내지 않게) · memberCount — 학생 수
// (보낸 기록에 남김 — 상단바 📢와 같은 값)
export default function NoticeSendPanel({ classId, className = "", memberCount = 0, onClose }) {
  const [list, setList] = useState(null);           // null = 아직 첫 답 전
  const [draft, setDraft] = useState(() => drafts.get(classId) ?? "");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const listRef = useRef(null);
  // Enter로 보내기 · Shift+Enter 줄바꿈. Esc는 넘기지 않아 창(HubPanel)이 닫습니다 — 쓰던 글은 drafts에 남습니다.
  const enter = useEnterSend(submit);

  // 반이 바뀌면(선생님이 다른 반을 고름) 그 반의 쓰던 글 · 보낸 공지로
  useEffect(() => {
    setDraft(drafts.get(classId) ?? "");
    setError("");
    setSent(false);
    setList(null);
    if (!classId) return undefined;
    return subscribeClassNotices(classId, (rows) => setList(Array.isArray(rows) ? rows : []), NOTICE_HISTORY);
  }, [classId]);
  // 열면 곧바로 쓰게 — 손가락으로 쓰는 기기는 자판이 화면을 가려 초점을 두지 않습니다(창 머리에)
  useEffect(() => {
    if (touchOnly()) return undefined;
    const timer = setTimeout(() => enter.inputRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
    // 여는 순간 한 번만 — enter.inputRef는 늘 같은 ref라 다시 그려져도 초점을 끌어오지 않습니다
  }, [enter.inputRef]);

  // 옛것이 위 · 새것이 아래(쓰는 칸 바로 위) — 새 공지가 오면 아래로 굴러갑니다
  const rows = useMemo(
    () => (list ? list.map((n) => ({ ...n, ms: noticeMs(n) })).sort((a, b) => (a.ms || Infinity) - (b.ms || Infinity)) : []),
    [list],
  );
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  function edit(value) {
    setDraft(value);
    drafts.set(classId, value);
    if (error) setError("");
    if (sent) setSent(false);
  }

  // 보내기 — 칸을 곧바로 비우고(Enter가 두 번 와도 둘째는 빈 칸) 보냅니다. 보내지 못하면 칸이 비어 있을 때 글을 되돌려 둡니다.
  function submit() {
    if (busyRef.current || !classId) return;
    const el = enter.inputRef.current;
    const raw = el ? el.value : draft;
    const text = raw.trim();
    if (!text) return;
    if (text.length > CLASS_NOTICE_MAX) { setError(`공지는 ${CLASS_NOTICE_MAX}자까지 쓸 수 있어요.`); return; }
    if (el) el.value = "";
    setDraft("");
    drafts.delete(classId);
    setError("");
    setSent(false);
    busyRef.current = true;
    setBusy(true);
    Promise.resolve()
      .then(() => sendClassNotice(classId, text, memberCount))
      .then(() => setSent(true))
      .catch((e) => {
        setError(e?.message || "보내지 못했어요. 잠시 뒤 다시 보내 주세요.");
        setDraft((now) => {
          const back = now || raw;
          drafts.set(classId, back);
          return back;
        });
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
        if (!touchOnly()) el?.focus({ preventScroll: true });
      });
  }

  const length = draft.length;
  const left = CLASS_NOTICE_MAX - length;
  const target = `${className || "이 반"} · 학생 ${memberCount}명`;

  return (
    <HubPanel title="공지 보내기" sub={target} className="notice-panel" onClose={onClose} closeLabel="공지 보내기 닫기" busy={busy}>
      <div className="hub-panel-body notice-panel-body" ref={listRef}>
        <p className="notice-panel-lead">보낸 공지는 반 학생 모두의 화면 가운데에 잠시 떠요 — 광장 · 교실 · 아지트 · 책꽂이 어디에 있든.
          보낸 공지는 고치거나 지울 수 없어요.</p>
        <ol className="notice-panel-list" aria-live="polite" aria-relevant="additions" aria-label="보낸 공지">
          {list === null ? (
            <li className="notice-panel-empty">보낸 공지를 불러오는 중…</li>
          ) : rows.length === 0 ? (
            <li className="notice-panel-empty">아직 이 반에 보낸 공지가 없어요. 아래에 적어 보내 보세요.</li>
          ) : (
            rows.map((n) => (
              <li key={n.id} className="notice-panel-item">
                <span className="notice-panel-meta">
                  <time>{noticeClock(n.ms)}</time>
                  {Number.isInteger(n.sentCount) && n.sentCount > 0 ? <span>{n.sentCount}명</span> : null}
                </span>
                <p className="notice-panel-text">{n.text}</p>
              </li>
            ))
          )}
        </ol>
      </div>
      <form className="notice-panel-compose" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="notice-panel-write">
          <textarea
            ref={enter.ref}
            value={draft}
            rows={3}
            maxLength={CLASS_NOTICE_MAX * 2}
            placeholder="반 모두에게 알릴 말을 적어요"
            aria-label={`공지 내용 — ${target}`}
            enterKeyHint="send"
            onChange={(e) => edit(e.target.value)}
            onKeyDown={enter.onKeyDown}
            onCompositionStart={enter.onCompositionStart}
            onCompositionEnd={enter.onCompositionEnd}
          />
          <button type="submit" className="btn-primary notice-panel-send" disabled={busy || !draft.trim() || left < 0 || !classId}>
            {busy ? "보내는 중…" : "보내기"}
          </button>
        </div>
        <div className="notice-panel-foot">
          <span>Enter로 보내기 · Shift+Enter 줄바꿈</span>
          <span className={`notice-panel-count${left < 0 ? " is-over" : ""}`}>{length}/{CLASS_NOTICE_MAX}</span>
        </div>
        {sent && <p className="notice-panel-sent" role="status">학생 화면에 띄웠어요{memberCount ? ` · ${memberCount}명` : ""}</p>}
        {error && <p className="notice-panel-error" role="alert">{error}</p>}
      </form>
    </HubPanel>
  );
}
