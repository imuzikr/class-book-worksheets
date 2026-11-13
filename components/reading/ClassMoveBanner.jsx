"use client";
// =============================================================
// 모두 이동의 알림 띠 — 화면 위쪽 한가운데에 '선생님이 모두를 ○○로 부르고 있어요'와 10초 카운트다운 (선생님 요청)
// -------------------------------------------------------------
// 선생님이 책 광장 · 교실에서 '모두 교실로 · 모두 광장으로'를 누르면, 반의 **모든 화면**에 이 띠가 뜹니다(상단바가
// 달아 책방 · 책나눔 · 리더보드 · 분석 리포트 어디서나). 10초를 다 세면
//   · 책 광장 탭을 열어 둔 화면 — 무대가 그 방으로 옮깁니다(ReadingPlaza).
//   · 책나눔의 다른 탭(책꽂이 · 성장) — 책나눔 틀이 책 광장 탭으로 바꿉니다(쓰던 입력 창은 그대로 둠 — ReadingHub).
//   · 그 밖의 화면(책방의 활동 · 목록 · 리더보드 · 분석 리포트) — **여기서 책 광장 탭으로 보냅니다.**
// 한때는 책 광장 탭을 열어 둔 학생만 곧바로 옮겼습니다(다른 화면의 학생은 쓰던 글이 날아갈까 봐 그대로 둠). 미리 알리고
// 10초를 주어 하던 일을 마무리하게 한 뒤 모두 옮깁니다. 자동 저장하는 활동 화면은 떠나는 순간 마지막 글자까지 저장합니다
// (lib/useSaveOnLeave.js). '보내기 · 붙이기'를 눌러야 저장되는 창의 글은 10초 안에 눌러야 남습니다 — 그래서 띠가
// '쓰던 글을 마무리해 주세요'를 말합니다.
//
// 셈은 lib/classroomMove.js, 반마다 하나인 상태 · 타이머는 lib/classroomMoveStore.js(상단바가 화면을 옮길 때마다 새로
// 서도 세던 것이 이어짐). 선생님의 띠에는 '취소'가 있습니다 — 잘못 눌렀을 때 10초 안에 거둡니다(cancelClassroomMove).
//
// 띠의 글은 바뀌지 않게 두고(읽어 주는 기기가 초마다 다시 읽지 않게) 줄어드는 수는 동그라미 안에만 적습니다.
// 다른 것을 막지 않습니다(pointer-events는 띠 자신에게만) — 10초 동안 하던 일을 마무리해야 하므로.
// =============================================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { classroomMoveDropShown, classroomMoveLeft, classroomMoveShare, classroomMoveUrl } from "@/lib/classroomMove";
import { takeClassroomPull, useClassroomMove } from "@/lib/classroomMoveStore";
import { cancelClassroomMove } from "@/lib/store";
import "./move-banner.css";

const ROOM_TO = { classroom: "교실로", plaza: "책 광장으로" };
// 동그라미 테두리의 둘레(r = 20)
const RING = 2 * Math.PI * 20;

export default function ClassMoveBanner({ classId, isTeacher = false }) {
  const router = useRouter();
  const { pending, dropped, released } = useClassroomMove(classId);
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [failed, setFailed] = useState(false);
  const dropShown = classroomMoveDropShown(dropped, now);
  const live = !!pending || dropShown;

  // 세는 동안 · '취소됐어요'가 떠 있는 동안만 시계를 돌립니다
  useEffect(() => {
    if (!pending && !dropped) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [pending, dropped]);
  useEffect(() => { setCancelling(false); setFailed(false); }, [pending?.at]);

  // 다 셌습니다 — 책 광장이 떠 있지 않은 화면이면 책 광장 탭으로 보냅니다(신호마다 한 번 — 상단바가 화면을 옮기며
  // 새로 서도 다시 보내지 않음). 책 광장이 이미 떠 있으면 무대가 스스로 옮깁니다. 책나눔의 다른 탭이면 주소만 바뀌고
  // 탭은 책나눔 틀이 바꿉니다(쓰던 입력 창을 그대로 두려고 — ReadingHub). 초점은 건드리지 않습니다(그 창에서 쓰던 커서).
  useEffect(() => {
    if (!classId || !released?.pull) return;
    if (!takeClassroomPull(classId)) return;
    if (document.querySelector(".reading-hub--plaza")) return;
    router.push(classroomMoveUrl(window.location.pathname, window.location.search));
  }, [classId, released, router]);

  if (!classId || !live) return null;

  async function cancel() {
    if (cancelling || !pending) return;
    setCancelling(true);
    setFailed(false);
    try {
      await cancelClassroomMove(classId, pending.at);
    } catch {
      setFailed(true);
      setCancelling(false);
    }
  }

  if (!pending) {
    return (
      <div className="class-move class-move--dropped" role="status">
        <span className="class-move-mark" aria-hidden="true">✕</span>
        <span className="class-move-text">
          <strong>{isTeacher ? "이동을 취소했어요." : "이동이 취소됐어요."}</strong>
          {!isTeacher && <small>하던 일을 이어서 해 주세요.</small>}
        </span>
      </div>
    );
  }

  const left = classroomMoveLeft(pending, now);
  const share = classroomMoveShare(pending, now);
  const wait = Math.ceil(pending.wait);
  const to = ROOM_TO[pending.to] ?? ROOM_TO.plaza;
  return (
    <div className={`class-move${isTeacher ? " class-move--teacher" : ""}`} role="status" aria-live="polite">
      <span className="class-move-ring" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48">
          <circle className="class-move-ring-bed" cx="24" cy="24" r="20" />
          <circle className="class-move-ring-run" cx="24" cy="24" r="20" strokeDasharray={RING} strokeDashoffset={RING * (1 - share)} />
        </svg>
        <b>{left}</b>
      </span>
      <span className="class-move-text">
        {isTeacher ? <>
          <strong>모두 {to} 이동합니다</strong>
          <small>{failed ? "취소하지 못했어요. 다시 눌러 주세요." : `${wait}초 뒤에 옮겨요 · 학생 화면에도 이 알림이 떠 있어요.`}</small>
        </> : <>
          <strong>선생님이 모두를 {to} 부르고 있어요</strong>
          <small>{wait}초 뒤에 함께 이동해요 · 쓰던 글을 마무리해 주세요.</small>
        </>}
      </span>
      {isTeacher && <button type="button" className="class-move-cancel" onClick={cancel} disabled={cancelling}>취소</button>}
    </div>
  );
}
