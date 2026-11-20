"use client";
// =============================================================
// 공지사항을 학생 화면 가운데에 글자만 잠시 — 선생님이 보낸 반 공지 (선생님 요청 · 2026년 11월)
// -------------------------------------------------------------
// 상단바(TopNav)가 학생 화면에만 답니다. 상단바는 모든 화면에 떠 있으므로 학생이 책 광장 · 교실 · 개인 아지트 · 책꽂이 ·
// 책방 · 리더보드 · 분석 리포트 어디에 있든 뜹니다('모두 이동'의 알림 띠와 같은 자리 잡기).
//   · **모양은 배움나눔의 '해설 띄우기'(수업 모드 — 슬라이드 위에 덮는 해설) 그대로입니다** — 화면을 어둡게 덮고 가운데에
//     '공지사항' 제목과 공지 글만 크게. 카드 · 테두리 · 단추가 없고, 글 길이에 따라 5 ~ 30초 머물다 저절로 사라집니다
//     (noticeFlashMs). 한때 흰 카드에 '확인' 단추였는데 선생님이 이 모양을 고르셨습니다 — 카드로 되돌리지 마세요.
//   · 아무 데나 누르거나 Esc로 먼저 닫습니다. **초점은 옮기지 않습니다** — 쓰던 글 칸 · 걷던 무대가 그대로 키를 받습니다.
//   · 여러 개면 보낸 차례대로 하나씩(nextNoticeFlash). 화면이 가려진 동안(다른 탭 · 잠긴 기기)은 띄우지 않고 세던 시간도
//     멈춥니다 — 돌아와서 봅니다. 아주 긴 글은 화면에 들도록 글자를 줄이고(15px까지), 그래도 넘치면 화면 안에서 구릅니다.
//   · 공지는 반 공지 그대로입니다(classes/{c}/classNotices — 책 광장 · 교실의 '공지사항'과 상단바 📢가 같은 곳에 씀).
//     '여기까지 봤다'는 알림 벨과 같은 표시(chatReads.rooms.notice)로 셉니다 — 벨과 같은 질의 · 같은 문서라 SDK가 구독을
//     함께 써서 읽기가 늘지 않습니다. 띄운 공지는 이 기기에 적어 두어 다시 띄우지 않고, **눌러서 먼저 닫은 공지만** 벨에서도
//     읽은 것이 됩니다 — 저절로 사라진 공지는 벨에 안 읽은 채 남아 놓친 학생이 다시 읽습니다.
//   · 어떤 공지를 띄울지는 lib/classNoticeSpot.js(화면을 연 뒤에 온 공지는 시계를 보지 않고 · 처음부터 있던 공지는 한 시간 안 ·
//     이미 본 것은 안 띄움).
// 선생님 · 관리자 화면에는 띄우지 않습니다(보낸 사람 — 보낸 공지는 '공지사항' 창에 남음).
// =============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { markChatRoomSeen, subscribeChatReads, subscribeClassNotices } from "@/lib/store";
import { NOTICE_SEEN_ROOM, nextNoticeFlash, noticeFlashMs, noticeSeenAfter, pickNoticeSpot } from "@/lib/classNoticeSpot";
import { backdropClose } from "@/lib/modal";
import "./notice-spot.css";

// 벨과 같은 질의(최근 5건)여야 구독을 함께 씁니다 — components/NotificationBell.jsx의 NOTICE_WINDOW
const NOTICE_WINDOW = 5;
// 사라지는 데 걸리는 시간 — notice-spot.css의 .notice-spot.is-leaving 길이와 같아야 합니다
const FADE_MS = 450;
// 가려졌다 돌아왔을 때 남겨 두는 가장 짧은 시간(돌아오자마자 사라지지 않게)
const RESUME_MIN_MS = 1500;
// 아주 긴 글도 이 크기 아래로는 줄이지 않습니다(그때는 화면 안에서 구름)
const FIT_MIN_PX = 15;
// 이 기기에서 띄운 공지(벨의 표시와 따로 — 저절로 사라진 공지는 벨에 안 읽은 채 두므로)
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
  const [baseIds, setBaseIds] = useState(null);
  const baseRef = useRef(null);                     // 화면을 열고 처음 받은 공지의 id들
  const [localMs, setLocalMs] = useState(0);        // 이 기기에 적어 둔 '띄운 공지'
  const [shownMs, setShownMs] = useState(0);        // 이 화면에서 띄운 것(저장을 막은 기기에서도 다시 안 띄우게)
  const [current, setCurrent] = useState(null);     // 지금 띄운 공지
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const remainRef = useRef(0);                      // 지금 공지가 더 머물 시간(가려지면 멈춤)
  const boxRef = useRef(null);
  const key = classId && uid ? `${classId}:${uid}` : "";

  useEffect(() => {
    setNotices(null);
    setReads(null);
    setShownMs(0);
    setBaseIds(null);
    setCurrent(null);
    setLeaving(false);
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

  // 화면이 보이는가 — 다른 탭 · 잠긴 기기에서는 띄우지 않고 세던 시간도 멈춥니다
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const readMs = Number(reads?.[NOTICE_SEEN_ROOM]) || 0;
  const seenMs = Math.max(readMs, localMs, shownMs);
  // 두 첫 답(공지 · 읽음 표시)이 다 온 뒤에만 고릅니다 — 읽음 표시가 늦게 와 이미 본 공지가 한 번 번쩍이지 않게
  const pending = useMemo(() => (notices && reads && baseIds
    ? pickNoticeSpot({ notices, seenMs, baseIds, nowMs: Date.now() })
    : []), [notices, reads, baseIds, seenMs]);

  // 띄운 것이 없으면 다음 공지를 — 보낸 차례대로. 띄우는 순간 '띄웠다'를 적어 둡니다(다시 열어도 또 안 뜨게)
  useEffect(() => {
    if (current || !visible || !key) return;
    const next = nextNoticeFlash(pending);
    if (!next) return;
    const mark = noticeSeenAfter(seenMs, [next]);
    remainRef.current = noticeFlashMs(next.text);
    setLeaving(false);
    setCurrent(next);
    setShownMs(mark);
    setLocalMs(mark);
    writeLocal(LOCAL_KEY(classId, uid), mark);
  }, [current, visible, pending, seenMs, key, classId, uid]);

  // 머무는 시간 — 다 되면 사라지기 시작. 화면이 가려지면 멈췄다가 돌아오면 남은 만큼(적어도 1.5초)
  useEffect(() => {
    if (!current || leaving || !visible) return undefined;
    const started = Date.now();
    const timer = setTimeout(() => setLeaving(true), Math.max(0, remainRef.current));
    return () => {
      clearTimeout(timer);
      remainRef.current = Math.max(RESUME_MIN_MS, remainRef.current - (Date.now() - started));
    };
  }, [current, leaving, visible]);

  // 사라지는 동안(0.45초) 기다렸다가 거둡니다 — 다음 공지가 있으면 그다음에
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // 화면에 들게 — 넘치면 공지 글의 크기를 반씩 좁혀 '넘치지 않는 가장 큰 크기'를 찾습니다(매번 실제로 그려 잼)
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !current) return undefined;
    let raf = 0;
    const measure = () => {
      box.style.removeProperty("--spot-size");
      box.classList.remove("is-scroll");
      const fits = () => box.scrollHeight <= box.clientHeight + 1;
      if (fits()) return;
      const text = box.querySelector(".notice-spot-text");
      let hi = Math.floor(parseFloat(text ? getComputedStyle(text).fontSize : "") || 40);
      let lo = FIT_MIN_PX;
      const fitsAt = (px) => {
        box.style.setProperty("--spot-size", `${px}px`);
        return fits();
      };
      if (!fitsAt(lo)) {
        box.classList.add("is-scroll");   // 가장 작게도 넘치면 화면 안에서 구름
        return;
      }
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (fitsAt(mid)) lo = mid;
        else hi = mid;
      }
      box.style.setProperty("--spot-size", `${lo}px`);
    };
    measure();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [current]);

  // 눌러서 먼저 닫기(아무 데나 · Esc) — 본 것이니 벨의 공지도 읽은 것으로(앞으로만)
  function dismiss() {
    if (!current || leaving) return;
    setLeaving(true);
    if (current.ms > readMs) {
      markChatRoomSeen(classId, uid, NOTICE_SEEN_ROOM, current.ms).catch((e) => console.warn("[공지] 읽음을 못 적었어요:", e?.code || e?.message));
    }
  }

  if (!current || !key || typeof document === "undefined") return null;
  const close = backdropClose(dismiss);
  return createPortal(
    <div
      ref={(el) => {
        boxRef.current = el;
        close.ref?.(el);
      }}
      className={`notice-spot${leaving ? " is-leaving" : ""}`}
      role="alert"
      onClick={dismiss}
    >
      <div className="notice-spot-inner">
        <div className="notice-spot-head">
          <h2 className="notice-spot-title">공지사항</h2>
          <span className="notice-spot-meta">{current.senderName ? `${current.senderName} · ` : "선생님 · "}{clockOf(current.ms)}</span>
        </div>
        <p className="notice-spot-text">{current.text}</p>
      </div>
    </div>,
    document.body,
  );
}
