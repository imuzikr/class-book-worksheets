"use client";

// =============================================================
// 상단바 알림 벨 — 반 공지(학생만)
// -------------------------------------------------------------
// classes/{cId}/classNotices의 최근 공지를 구독해 안 읽은 것을 셉니다.
// 교사가 서버 함수 없이 곧바로 쓰는 문서라 학생 알림함에는 들어오지
// 않습니다. 어디까지 읽었나는 간편 메신저와 같은 문서(chatReads)의
// 'notice' 칸에 '여기까지 봤다'(그 공지의 서버 시각)로 적습니다 — 기기를
// 바꿔도 같습니다.
//
// 배움나눔 시절에는 개인 알림함(users/{uid}/notifications — 서버 함수가
// 쓰던 새 답변 · 채택 알림)과 모둠 메모(groupMemos)도 함께 합쳤는데,
// 책 나눔에는 서버 함수도 질문방 · 모둠 메모 화면도 없어 늘 비어 있는
// 구독이었으므로 걷었습니다.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import {
  subscribeClassNotices,
  subscribeChatReads,
  markChatRoomSeen,
  formatTime,
  toDate,
} from "@/lib/store";

const NOTICE_LABEL = { icon: "📢", text: "선생님 공지" };

// 알림 벨에 올리는 반 공지 — 최근 몇 건까지. 새로 들어온 학생에게 지난
// 공지가 한꺼번에 쌓이지 않게 좁게 둡니다(메신저 '공지' 탭에서 다시 봄).
const NOTICE_WINDOW = 5;
const NOTICE_SEEN_KEY = "notice"; // chatReads.rooms의 칸 이름(방 열쇠 dm_ · grp_와 안 겹침)

export default function NotificationBell({ uid, classId = null, isStudent = false }) {
  const [notices, setNotices] = useState([]);
  const [seen, setSeen] = useState({});
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // 반 공지(학생만) — 그 반의 최근 공지와 '여기까지 봤다' 표시
  const noticeOn = !!(uid && classId && isStudent);
  useEffect(() => {
    if (!noticeOn) { setNotices([]); return; }
    return subscribeClassNotices(classId, setNotices, NOTICE_WINDOW);
  }, [noticeOn, classId]);
  useEffect(() => {
    if (!noticeOn) { setSeen({}); return; }
    return subscribeChatReads(classId, uid, setSeen);
  }, [noticeOn, classId, uid]);
  const seenNotice = Number(seen?.[NOTICE_SEEN_KEY]) || 0;
  const unreadNotices = useMemo(
    () =>
      notices
        .filter((n) => n.sentAt && (toDate(n.sentAt)?.getTime() ?? 0) > seenNotice)
        .map((n) => ({
          id: n.id,
          createdAt: n.sentAt,
          text: n.text,
          senderName: n.senderName,
          _ms: toDate(n.sentAt)?.getTime() ?? 0,
        })),
    [notices, seenNotice]
  );

  // 최신순
  const items = useMemo(
    () => [...unreadNotices].sort((x, y) => y._ms - x._ms),
    [unreadNotices]
  );

  // 반 공지 읽음 — '여기까지 봤다'를 앞으로만 옮깁니다(더 옛 공지를 읽어도
  // 이미 본 새 공지가 되살아나지 않게).
  function markNoticeSeen(ms) {
    if (!noticeOn || !ms || ms <= seenNotice) return Promise.resolve();
    return markChatRoomSeen(classId, uid, NOTICE_SEEN_KEY, ms);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // 안 읽은 공지만 올라오므로 그 수가 곧 뱃지 수입니다.
  const unreadCount = items.length;
  const [markingAll, setMarkingAll] = useState(false);

  // 한 건 읽음 — '여기까지 봤다'를 그 공지로 옮겨 목록에서 뺍니다.
  function handleRead(e, n) {
    e.stopPropagation();
    markNoticeSeen(n._ms).catch(() => {});
  }

  async function handleReadAll() {
    if (markingAll || items.length === 0) return;
    setMarkingAll(true);
    try {
      await markNoticeSeen(Math.max(0, ...unreadNotices.map((n) => n._ms)));
    } catch {
      /* 실패하면 목록이 그대로 남습니다 — 다시 누르면 됩니다 */
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn-ghost notif-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="알림"
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : "알림"}
      >
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          {items.length === 0 ? (
            <p className="notif-empty">읽지 않은 알림이 없어요.</p>
          ) : (
            <>
            <div className="notif-tools">
              <span className="notif-tools-count">읽지 않음 {items.length}</span>
              <button
                type="button"
                className="notif-readall"
                onClick={handleReadAll}
                disabled={markingAll}
              >
                {markingAll ? "처리 중…" : "모두 읽음"}
              </button>
            </div>
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className="notif-row">
                  {/* 공지는 내용이 알림 줄에 다 들어 있어 눌러 갈 곳이 없습니다 —
                      누를 수 있는 것처럼 보이지 않게 버튼이 아닌 칸으로 그립니다. */}
                  <div className="notif-item unread notif-item--static">
                    <span className="notif-item-head">
                      <span aria-hidden="true">{NOTICE_LABEL.icon}</span> {NOTICE_LABEL.text}
                      <span className="notif-item-time">{formatTime(n.createdAt)}</span>
                    </span>
                    <span className="notif-item-sub notif-item-sub--full">{n.text}</span>
                    {n.senderName && (
                      <span className="notif-item-from">{n.senderName}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="notif-read-btn"
                    onClick={(e) => handleRead(e, n)}
                    title="읽음으로 표시하고 목록에서 치우기"
                  >
                    읽음
                  </button>
                </li>
              ))}
            </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
