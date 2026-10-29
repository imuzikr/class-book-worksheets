"use client";

// 반 공지는 기존 classNotices/chatReads 구독을 유지합니다.
// 교사 댓글은 내 opinionNotes를 구독해 합치고, 메모의 replySeenAt으로 읽음을 표시합니다.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  subscribeMyOpinionReplies,
  markOpinionReplySeen,
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
  const router = useRouter();
  const [replies, setReplies] = useState([]);
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
  useEffect(() => {
    if (!uid) { setReplies([]); return; }
    return subscribeMyOpinionReplies(uid, setReplies);
  }, [uid]);
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

  const items = useMemo(() => [
    ...unreadNotices.map((n) => ({ ...n, _src: "notice", type: "class_notice" })),
    ...replies.map((r) => ({
      id: r.id, _src: "opinion", type: "opinion_reply",
      activityId: r.activityId, createdAt: r.replyAt ?? r.updatedAt ?? r.createdAt,
      text: String(r.reply ?? ""), original: String(r.text ?? ""),
    })),
  ].sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0)),
  [unreadNotices, replies]);

  function handleOpen(n) {
    if (n._src !== "opinion" || !n.activityId) return;
    setOpen(false);
    router.push(`/books?activity=${encodeURIComponent(n.activityId)}&note=${encodeURIComponent(n.id)}`);
  }

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

  // 읽지 않은 공지와 교사 댓글의 합계입니다.
  const unreadCount = items.length;
  const [markingAll, setMarkingAll] = useState(false);

  // 한 건 읽음 — '여기까지 봤다'를 그 공지로 옮겨 목록에서 뺍니다.
  function handleRead(e, n) {
    e.stopPropagation();
    if (n._src === "opinion") markOpinionReplySeen(n.activityId, n.id).catch(() => {});
    else markNoticeSeen(n._ms).catch(() => {});
  }

  async function handleReadAll() {
    if (markingAll || items.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all([
        markNoticeSeen(Math.max(0, ...unreadNotices.map((n) => n._ms))),
        ...replies.map((r) => markOpinionReplySeen(r.activityId, r.id)),
      ]);
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
        <div className={`notif-dropdown${replies.length ? " notif-dropdown--wide" : ""}`} role="menu">
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
              {items.map((n) => {
                const label = n.type === "opinion_reply" ? { icon: "💬", text: "내 생각에 선생님 댓글" } : NOTICE_LABEL;
                const isReply = n._src === "opinion";
                // 공지와 교사 댓글의 본문을 알림에서 바로 읽을 수 있습니다.
                const isNotice = n.type === "class_notice" || isReply;
                // 반 공지는 열어 볼 글이 없어 눌러도 갈 곳이 없습니다 —
                // 누를 수 있는 것처럼 보이지 않도록 버튼이 아닌 칸으로 그립니다.
                // 선생님 댓글은 그 활동의 메모로 갑니다.
                const canOpen = isReply && !!n.activityId;
                const body = isReply ? (
                  <>
                    <span className="notif-item-head">
                      <span aria-hidden="true">{label.icon}</span> {label.text}
                      <span className="notif-item-time">{formatTime(n.createdAt)}</span>
                    </span>
                    <span className="notif-op-block notif-op-block--mine">
                      <span className="notif-op-label">내 글</span>
                      <span className="notif-op-text">{n.original || "(내용 없음)"}</span>
                    </span>
                    <span className="notif-op-block notif-op-block--reply">
                      <span className="notif-op-label">선생님 댓글</span>
                      <span className="notif-op-text">{n.text}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="notif-item-head">
                      <span aria-hidden="true">{label.icon}</span> {label.text}
                      <span className="notif-item-time">{formatTime(n.createdAt)}</span>
                    </span>
                    <span
                      className={`notif-item-sub${isNotice ? " notif-item-sub--full" : ""}`}
                    >
                      {isNotice ? n.text : n.questionTitle}
                    </span>
                    {isNotice && (n.senderName || n.className) && (
                      <span className="notif-item-from">
                        {[n.className, n.senderName].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={`${n._src}_${n.id}`} className="notif-row">
                    {canOpen ? (
                      <button
                        type="button"
                        className="notif-item unread"
                        onClick={() => handleOpen(n)}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="notif-item unread notif-item--static">{body}</div>
                    )}
                    {/* 댓글 메모를 열거나 읽음 버튼을 누르면 알림이 사라집니다. */}
                    <button
                      type="button"
                      className="notif-read-btn"
                      onClick={(e) => handleRead(e, n)}
                      title="읽음으로 표시하고 목록에서 치우기"
                    >
                      읽음
                    </button>
                  </li>
                );
              })}
            </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
