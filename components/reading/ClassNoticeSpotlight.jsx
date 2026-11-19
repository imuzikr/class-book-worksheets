"use client";
// =============================================================
// 공지사항을 학생 화면에 크게 — 선생님이 보낸 반 공지를 큰 글씨 카드로 (선생님 요청 · 2026년 11월)
// -------------------------------------------------------------
// 상단바(TopNav)가 학생 화면에만 답니다. 상단바는 모든 화면에 떠 있으므로 학생이 책 광장 · 교실 · 개인 아지트 · 책꽂이 ·
// 책방 · 리더보드 · 분석 리포트 어디에 있든 이 카드가 뜹니다('모두 이동'의 알림 띠와 같은 자리 잡기).
//   · 공지는 반 공지 그대로입니다(classes/{c}/classNotices — 책 광장 · 교실의 '공지사항'과 상단바 📢가 같은 곳에 씀).
//     알림 벨 · 메신저 '공지' 탭과 같은 공지를 같은 '여기까지 봤다'(chatReads.rooms.notice)로 셉니다 — 벨과 같은 질의 ·
//     같은 문서라 SDK가 구독을 함께 써서 읽기가 늘지 않습니다.
//   · 어떤 공지를 띄울지는 lib/classNoticeSpot.js(화면을 연 뒤에 온 공지는 시계를 보지 않고 · 처음부터 있던 공지는 한 시간 안 ·
//     이미 본 것은 안 띄움). '확인'(또는 Esc · 바깥)을 누르면 벨의 공지도 읽은 것이 됩니다.
//   · 카드가 뜨면 '확인'에 초점을 두고, 닫으면 쓰던 자리(무대 · 글 칸)로 초점을 돌려줍니다.
// 선생님 · 관리자 화면에는 띄우지 않습니다(보낸 사람 — 보낸 공지는 '공지사항' 창에 남음).
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markChatRoomSeen, subscribeChatReads, subscribeClassNotices } from "@/lib/store";
import { NOTICE_SEEN_ROOM, noticeSeenAfter, pickNoticeSpot } from "@/lib/classNoticeSpot";
import { backdropClose } from "@/lib/modal";
import { IconMegaphone } from "@/components/StatusIcons";
import "./notice-spot.css";

// 벨과 같은 질의(최근 5건)여야 구독을 함께 씁니다 — components/NotificationBell.jsx의 NOTICE_WINDOW
const NOTICE_WINDOW = 5;
// 이 기기에서 확인한 공지(벨의 표시를 못 적었을 때 — 데모 · 잠깐 끊긴 연결)
const LOCAL_KEY = (classId, uid) => `notice_spot_seen:${classId}:${uid}`;
function readLocal(key) {
  try { return Number(window.localStorage.getItem(key)) || 0; } catch { return 0; }
}
function writeLocal(key, ms) {
  try { window.localStorage.setItem(key, String(ms)); } catch { /* 저장을 막은 기기 — 이 화면 안에서만 기억 */ }
}
function clockOf(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ClassNoticeSpotlight({ classId, uid }) {
  const [notices, setNotices] = useState(null);   // null = 아직 첫 답 전
  const [reads, setReads] = useState(null);
  const [closedMs, setClosedMs] = useState(0);     // 이 화면에서 닫은 것
  const [localMs, setLocalMs] = useState(0);
  const baseRef = useRef(null);                     // { key, ids } — 화면을 열고 처음 받은 공지
  const [baseIds, setBaseIds] = useState(null);
  const okRef = useRef(null);
  const returnFocus = useRef(null);
  const key = classId && uid ? `${classId}:${uid}` : "";

  useEffect(() => {
    setNotices(null);
    setReads(null);
    setClosedMs(0);
    setBaseIds(null);
    baseRef.current = null;
    if (!classId || !uid) return undefined;
    setLocalMs(readLocal(LOCAL_KEY(classId, uid)));
    const stopNotices = subscribeClassNotices(classId, (list) => {
      const rows = Array.isArray(list) ? list : [];
      // 처음 받은 목록 — 여기에 있던 공지는 '처음부터 있던 것'(한 시간 안만 띄움), 없던 공지는 '방금 온 것'
      if (!baseRef.current) {
        baseRef.current = new Set(rows.map((n) => n.id));
        setBaseIds(baseRef.current);
      }
      setNotices(rows);
    }, NOTICE_WINDOW);
    const stopReads = subscribeChatReads(classId, uid, (rooms) => setReads(rooms || {}));
    return () => { stopNotices(); stopReads(); };
  }, [classId, uid]);

  const seenMs = Math.max(Number(reads?.[NOTICE_SEEN_ROOM]) || 0, localMs, closedMs);
  // 두 첫 답(공지 · 읽음 표시)이 다 온 뒤에만 고릅니다 — 읽음 표시가 늦게 와 이미 본 공지가 한 번 번쩍이지 않게
  const shown = useMemo(() => (notices && reads && baseIds
    ? pickNoticeSpot({ notices, seenMs, baseIds, nowMs: Date.now() })
    : []), [notices, reads, baseIds, seenMs]);
  const open = shown.length > 0;
  const top = shown[0];

  // 뜨는 순간 '확인'에 초점 — 닫으면 쓰던 자리로 돌려줍니다
  useEffect(() => {
    if (!open) return undefined;
    if (!returnFocus.current) {
      const active = document.activeElement;
      returnFocus.current = active && active !== document.body ? active : null;
    }
    const timer = setTimeout(() => okRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, [open, top?.id]);

  function close() {
    if (!shown.length) return;
    const mark = noticeSeenAfter(seenMs, shown);
    setClosedMs(mark);
    setLocalMs(mark);
    writeLocal(LOCAL_KEY(classId, uid), mark);
    // 벨의 '여기까지 봤다'도 함께 — 앞으로만(이미 더 늦은 것을 읽었으면 그대로)
    if (mark > (Number(reads?.[NOTICE_SEEN_ROOM]) || 0)) {
      markChatRoomSeen(classId, uid, NOTICE_SEEN_ROOM, mark).catch((e) => console.warn("[공지] 읽음을 못 적었어요:", e?.code || e?.message));
    }
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back?.isConnected) setTimeout(() => back.focus({ preventScroll: true }), 0);
  }

  if (!open || !key || typeof document === "undefined") return null;
  const rest = shown.slice(1);
  return createPortal(
    <div className="notice-spot-backdrop" {...backdropClose(close)}>
      <section className="notice-spot" role="alertdialog" aria-modal="true" aria-labelledby="notice-spot-title" aria-describedby="notice-spot-text">
        <header className="notice-spot-head">
          <span className="notice-spot-icon" aria-hidden="true"><IconMegaphone size={30} /></span>
          <h2 id="notice-spot-title">공지사항</h2>
          <span className="notice-spot-meta">{top.senderName ? `${top.senderName} · ` : "선생님 · "}{clockOf(top.ms)}</span>
        </header>
        <p id="notice-spot-text" className="notice-spot-text">{top.text}</p>
        {rest.length > 0 && (
          <ol className="notice-spot-rest" aria-label="앞서 온 공지">
            {rest.map((n) => <li key={n.id}><time>{clockOf(n.ms)}</time><span>{n.text}</span></li>)}
          </ol>
        )}
        <button ref={okRef} type="button" className="btn-primary notice-spot-ok" onClick={close}>확인</button>
      </section>
    </div>,
    document.body,
  );
}
