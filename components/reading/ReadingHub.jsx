"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { bookInfoUrl, bookPagesFloor, bookTitleDrifted, coversWholeBook, deriveReading, initialReadingState, kstToday, READING_BADGES, wholeBookReviewPlan } from "@/lib/reading";
import { subscribeReadingState, mutateReading, mutateStudentBook, fetchReadingRankings } from "@/lib/data/reading";
import { rankingAsOf, rankingsForPeriod } from "@/lib/readingJourney";
import { petGrowthOfSummary } from "@/lib/readingPet";
import { careReadLabel, readingDayProof } from "@/lib/petCare";
import ReadingBadge from "./ReadingBadge";
import ReadingCharacterSummary from "./ReadingCharacterSummary";
import { IconTrophy } from "@/components/StatusIcons";
import BookSearch from "./BookSearch";
import { hasModalAbove } from "@/lib/modal";
import { PLAZA_STAGE_MIN_H, plazaRoom, plazaScroller } from "@/lib/plazaStageRoom";
import { publishReadingBadges, requestReadingBadgesPanel, withdrawReadingBadges } from "@/lib/readingBadgeBridge";
import PetCard, { StudentPetSummary } from "./PetCard";
import OutfitCelebration from "./OutfitCelebration";
import { markOutfitSeen, outfitCheerFor, readOutfitSeen } from "@/lib/readingOutfitCheer";
import "./reading.css";
import "./plaza.css";

// 책 광장의 무대 · 창 · 걷는 길은 광장 탭을 열 때만 내려받습니다 — 광장을 안 쓰는 반 · 책꽂이 탭만 보는 학생의
// 책방 첫 화면이 무거워지지 않게(넣기 전후 First Load JS: 그대로 두면 +13KB).
// 내려받는 동안의 자리(PlazaLoading) — 광장 탭은 책방 머리말과 탭 줄을 가리므로(plaza.css의 '광장 탭') 그 사이에도
// 나가는 길('나가기')이 서 있어야 합니다. 한때 안내 한 줄만 띄웠는데, 느린 와이파이에서는 탭 줄도 '나가기'도 없이 그
// 한 줄만 뜬 채 몇 초 갇혔습니다(실측 — 내려받기를 4초 붙잡아 봄). 팻말은 진짜 무대와 **같은 자리 · 같은 모양**이고
// 높이도 같은 셈(lib/plazaStageRoom.js)으로 화면 바닥까지라, 다 받으면 그 뒤로 맵이 깔리는 것으로 보입니다.
// '나가기'는 틀이 문맥(PlazaExitContext)으로 건넵니다 — dynamic의 loading은 부르는 쪽의 props를 못 받습니다.
const PlazaExitContext = createContext(null);
function PlazaLoading() {
  const onExit = useContext(PlazaExitContext);
  const stageRef = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const scroller = plazaScroller(stage);
    const fit = () => setHeight(Math.max(PLAZA_STAGE_MIN_H, Math.floor(plazaRoom(stage, scroller))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return <section className="plaza" aria-label="책 광장">
    <div className="plaza-stage-wrap">
      <div className="plaza-stage plaza-stage--loading" ref={stageRef} role="status" style={height ? { height } : undefined}><span className="reading-loader" />책 광장을 펼치고 있어요.</div>
      <div className="plaza-hud">
        <div className="plaza-hud-lead">
          <h3 className="plaza-title">책 광장</h3>
          {onExit && <button type="button" className="plaza-exit" onClick={onExit} aria-label="책 광장에서 나가기">나가기</button>}
        </div>
      </div>
    </div>
  </section>;
}
const ReadingPlaza = dynamic(() => import("./ReadingPlaza"), { ssr: false, loading: PlazaLoading });
function HideoutLoading() {
  const onExit = useContext(PlazaExitContext);
  return <section className="reading-loading" role="status" aria-label="아지트 불러오기">
    <span className="reading-loader" />아지트를 펼치고 있어요.
    {onExit && <button type="button" className="btn-ghost" onClick={onExit}>돌아가기</button>}
  </section>;
}
const ReadingHideout = dynamic(() => import("./ReadingHideout"), { ssr: false, loading: HideoutLoading });

// 선생님의 책 광장 — **반 전체의 자리**라 '고른 학생'의 책 봄(아래 ReadingHub) 밖에 따로 섭니다
// (TeacherReadingView의 '책 광장 들어가기'). 한때 선생님이 들어가는 길이 고른 학생 화면의 셋째 탭 하나뿐이라,
// 학생이 한 명도 없는 반에서는 탭 줄 자체가 없어 들어갈 길이 없었고(주소에 ?tab=plaza를 붙여도), 학생이 있는
// 반에서도 '○○의 독서 여정' 안에 섞여 입구로 보이지 않았습니다(선생님 신고). 틀의 클래스(.reading-hub--plaza)가
// 학생 화면과 같아 '광장 탭'의 CSS(머리말 · 명단 · 옆 패널 가리기)가 그대로 듣습니다. 선생님에게는 펫 · 곧바로 열 책이 없습니다.
export function TeacherPlaza({ classId, user, characterOn = true, classroom = null, hideoutOn = false, talkOn = false, initialHideout = false, initialHideoutRoom = "classroom", plazaCall = 0, onExit }) {
  const [ownHideout, setOwnHideout] = useState(initialHideout);
  const [hideoutOrigin, setHideoutOrigin] = useState(initialHideoutRoom === "plaza" ? "plaza" : "classroom");
  const [plazaReturn, setPlazaReturn] = useState(null);
  const sequence = useRef(0);
  const seenCall = useRef(plazaCall);
  const canHideout = hideoutOn && !!classroom?.on && !!user?.uid;
  const enterHideout = useCallback((origin = "classroom") => {
    if (canHideout) { setHideoutOrigin(origin === "plaza" ? "plaza" : "classroom"); setOwnHideout(true); }
  }, [canHideout]);
  // to — "plaza"면 들어온 곳과 상관없이 책 광장으로(아지트 머리의 '광장으로'), 아니면 들어온 곳(포털 · 그 밖의 나가기)
  const leaveHideout = useCallback((to) => {
    setOwnHideout(false);
    const room = to !== "plaza" && classroom?.on && hideoutOrigin === "classroom" ? "classroom" : "plaza";
    setPlazaReturn({ room, key: `teacher-hideout-return-${++sequence.current}` });
  }, [classroom?.on, hideoutOrigin]);
  useEffect(() => {
    if (ownHideout && !canHideout) leaveHideout();
  }, [ownHideout, canHideout, leaveHideout]);
  useEffect(() => {
    if (plazaCall === seenCall.current) return;
    seenCall.current = plazaCall;
    if (plazaCall) { setOwnHideout(false); setPlazaReturn(null); }
  }, [plazaCall]);
  const inHideout = ownHideout && canHideout;
  return <section className="reading-hub reading-hub--plaza" aria-label={inHideout ? "선생님의 아지트" : "책 광장"}>
    <PlazaExitContext.Provider value={inHideout ? leaveHideout : onExit}>
      {inHideout
        ? <ReadingHideout key={`${classId}:${user.uid}`} classId={classId} user={user} characterOn={characterOn} petOn={false} returnRoom={hideoutOrigin} onDisabled={leaveHideout} onExit={leaveHideout} />
        : <ReadingPlaza key={plazaReturn?.key ?? "teacher-plaza"} classId={classId} user={user} isTeacher characterOn={characterOn} petOn={false} growthXp={null} initialBook={null}
            initialRoom={plazaReturn?.room ?? (ownHideout ? hideoutOrigin : null)} onExit={onExit} classroom={classroom} hideoutOn={canHideout} onEnterHideout={enterHideout} talkOn={talkOn} />}
    </PlazaExitContext.Provider>
  </section>;
}

const ReadingErrorContext = createContext("");
// '함께할 독서 활동'(책과 독서 활동 잇기) — 선생님이 아직 구상 중이라 **잠시 숨깁니다**(선생님 요청 · 2026년 11월). 책 등록 · 고치기 창의
// 칸과 책 상세의 '함께 연결한 독서 활동 · 활동 열기'를 함께 감추고, 이미 이어 둔 값은 지우지 않습니다(칸이 없어도 고칠 때 그대로 저장 —
// BookForm의 form.activityId). 다시 보이게 하려면 true로 — 그때는 지금처럼 책방을 끈 반(activitiesOn)에서만 감춥니다.
const BOOK_ACTIVITY_LINK_READY = false;
const TIER_NAMES = { 1: "초급", 2: "중급", 3: "고급", beginner: "초급", intermediate: "중급", advanced: "고급" };
const FILTERS = [["all", "전체"], ["reading", "읽는 중"], ["completed", "완독"], ["paused", "잠시 멈춤"], ["archived", "보관함"]];
const PERIODS = [["daily", "오늘"], ["weekly", "이번 주"], ["monthly", "이번 달"], ["all-time", "누적"]];
const number = (v) => Number(v || 0).toLocaleString("ko-KR");
const tierName = (v) => TIER_NAMES[v] || String(v ?? "");
const shortDate = (v) => String(v || "").slice(0, 10).replaceAll("-", ".");
const displayName = (u) => [u?.studentId, u?.realName || u?.name || "이름 미설정"].filter(Boolean).join(" ");

function BookIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5c-2-2-6-2-9-1v15c3-1 7-1 9 1m0-15c2-2 6-2 9-1v15c-3-1-7-1-9 1V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

function Modal({ title, onClose, children, wide = false, busy = false }) {
  const titleId = useId();
  const error = useContext(ReadingErrorContext);
  const ref = useRef(null);
  const backdropRef = useRef(null);
  // onClose는 부르는 쪽이 렌더마다 새로 만듭니다. 한때 아래 효과가 그것에 걸려 있어, 책 봄이 다시
  // 그려질 때마다(알림 줄이 뜨고 5초 뒤 사라질 때 등) 다시 돌며 초점을 창의 첫 칸으로 끌어왔습니다 —
  // 감상을 쓰던 커서가 날짜 칸으로 튀고, 그때 위에 뜨던 펫 '자랐어요!' 창(지금은 창이 아닌 폭죽)의 초점을
  // 빼앗아 Esc가 밑의 책 상세 창부터 닫았습니다. 그래서 최신 값은 ref로 들고, 초점 · 키 처리는 창이
  // 열릴 때 한 번만 겁니다.
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    const backdrop = backdropRef.current;
    const items = () => [...el.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    // 위에 다른 창이 이미 떠 있으면 초점을 가져오지 않습니다(lib/modal.js의 hasModalAbove).
    if (!hasModalAbove(backdrop)) (el.querySelector("[data-initial-focus]") || items()[0] || el).focus();
    // Esc는 화면 전체에서 받되 이 창이 맨 위일 때만 닫습니다 — 위에 창이 있으면 비켜 가(preventDefault도
    // 안 부름) 공통 Esc 처리가 그 창부터 닫게 둡니다. 초점이 창 밖(위 창이 닫힌 뒤의 body)에 있어도 닫힙니다.
    function escape(e) {
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return;
      if (busyRef.current || hasModalAbove(backdrop)) return;
      e.preventDefault(); closeRef.current();
    }
    function tab(e) {
      if (e.key !== "Tab") return;
      const nodes = items();
      const first = nodes[0]; const last = nodes.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", escape);
    el.addEventListener("keydown", tab);
    return () => {
      window.removeEventListener("keydown", escape);
      el.removeEventListener("keydown", tab);
      // 닫힐 때 열기 전 자리로 초점을 돌려놓되, 위에 다른 창이 떠 있으면 그대로 둡니다 — 돌려놓으면
      // 초점이 위 창 뒤 화면의 단추로 갑니다(펫 축하가 아직 창이던 때 겪음).
      if (!hasModalAbove(backdrop)) previous?.focus?.();
    };
  }, []);
  return <div className="reading-modal-backdrop" ref={backdropRef} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className={`reading-modal${wide ? " reading-modal--wide" : ""}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="reading-modal-head"><h2 id={titleId}>{title}</h2><button type="button" className="reading-close" aria-label="닫기" onClick={onClose} disabled={busy}>×</button></header>
      {error && <div className="reading-error" role="alert">{error}</div>}
      {children}
    </section>
  </div>;
}

// petOn — 관리자 설정의 '학생 펫'(lib/readingPet.js의 petEnabled). 본인은 '나의 펫', 교사는 고른 학생의 펫 정보를 봅니다.
// plazaOn — 관리자 설정의 '책 광장'(lib/reading.js의 plazaOn). 학생은 책꽂이의 '광장으로 이동'으로 들어갑니다.
// characterOn — 관리자 설정의 '학생 캐릭터'(끄면 광장에서도 기본 캐릭터).
// classroom — 교실(관리자 설정의 '교실' — 책 광장의 둘째 방)에 넘길 묶음. 책방 페이지가 만들어 그대로 무대에 건넵니다
//   (출석 · 자리표는 페이지가 이미 받아 둔 것 — ReadingPlaza.jsx 머리의 설명).
// plazaCall — 선생님의 '모두 이동'이 10초를 다 세고 모두를 데려오는 신호의 '보낸 때'(책방 페이지가 넘김 · 없으면 0).
//   이 값이 **이 화면이 떠 있는 동안 바뀌면** 책 광장 탭으로 넘어갑니다(아래).
// petFeed — 그 반의 펫 먹이 규칙(lib/readingPet.js의 petCareRules — 끈 반이면 on이 거짓) · myFruit — 내가 가진 과일 수(먹이).
// petPreview — 관리자 설정의 '펫 미리보기'(lib/readingPet.js의 petPreviewOn) — 켠 반이면 '나의 펫'에서 키울 펫을 고릅니다.
// activitiesOn — 이 반의 책방이 학생에게 열려 있는가(관리자 설정 · lib/reading.js의 bookActivitiesOn). 끈 반의 학생에게는 책 등록 창의
// '함께할 독서 활동' 칸을 세우지 않습니다(책 상세의 '활동 열기'는 부르는 쪽이 onOpenActivity를 넘기지 않아 사라짐). 이미 이어 둔
// 활동은 지우지 않습니다 — 칸만 감추고 값은 그대로 저장됩니다(다시 켜면 그대로).
// introApart · introSlot — 교사 책 봄(TeacherReadingView)이 소개 카드를 명단 위 맨 윗줄(introSlot)에 띄우게 합니다(선생님 요청 ·
//   2026년 11월). introApart인데 자리가 아직 없으면 카드를 그리지 않습니다(한 번 그렸다가 옮겨 가며 깜빡이지 않게).
export default function ReadingHub({ classId, user, isTeacher = false, bookSearchOn = false, petOn = false, plazaOn = false, hideoutOn = false, talkOn = false, characterOn = true, onDisabled, activities = [], onOpenActivity, activitiesOn = true, initialBookId = null, initialTab = "library", student = null, classroom = null, plazaCall = 0, petFeed = null, myFruit = 0, petPreview = false, teacherTools = null, onOpenOwnHideout = null, onOpenHideoutGallery = null, introApart = false, introSlot = null, classControls = null }) {
  // student가 있으면 교사가 그 학생의 책 봄을 보는 읽기 전용 화면입니다(선생님 결정 — 감상·발자국까지 전부 보임).
  const readOnly = !!student?.uid;
  const viewUid = readOnly ? student.uid : user?.uid;
  // [교사] 읽기 전용 화면에서 하나만 고칩니다 — 학생 책의 정보(제목 · 지은이 · 쪽수 · 출판사 · ISBN · 표지 · 도서 정보 주소,
  // 선생님 요청 · 2026년 11월). 저장은 mutateStudentBook(서버가 담당 교사 · 그 반 학생 · 책 정보만인지 다시 확인).
  const teacherEdit = readOnly && !!isTeacher;
  const ownStudent = !readOnly && !isTeacher && !!user?.uid;
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // '우리 반 랭킹' 탭은 책 봄이 켜져 있으면 늘 섭니다 — 관리자 설정의 '리더보드'를 꺼도 그대로(선생님 요청:
  // 순위 셈은 책 봄과 함께 늘 돌고, 리더보드 스위치는 상단바 리더보드 화면 · 독서 TOP 3만 켜고 끔).
  // 책 광장을 켠 반은 그 자리에 '책 광장'이 섭니다(선생님 요청 — 순위는 상단바 리더보드에서 봄). 끈 반은 지금처럼 '우리 반 랭킹'.
  const thirdTab = plazaOn ? "plaza" : "ranking";
  const canHideout = hideoutOn && (readOnly || (!isTeacher && !!user?.uid));
  // ?tab=growth(분석 리포트의 '성장·뱃지 모두 보기')는 책꽂이를 열고, 떠 있는 동그라미의 성장·뱃지 창을 함께 엽니다(아래 badgeToken).
  const [tab, setTab] = useState(() => (initialTab === "plaza" || initialTab === "ranking" ? thirdTab : initialTab === "hideout" && canHideout && readOnly ? "hideout" : "library"));
  // 선생님이 설정을 바꿔 셋째 탭이 달라지면(광장 ↔ 랭킹) 보던 탭도 따라갑니다.
  useEffect(() => { setTab((current) => (current === "plaza" || current === "ranking" ? thirdTab : current)); }, [thirdTab]);
  // 책꽂이(첫 탭)에서 '광장에서 보기'로 넘어갈 때 곧바로 열 책({ uid, bookId, place, key })
  const [plazaJump, setPlazaJump] = useState(null);
  const [plazaReturn, setPlazaReturn] = useState(null);
  const [hideoutOrigin, setHideoutOrigin] = useState("classroom");
  const returnSequence = useRef(0);
  const enterHideout = useCallback((origin = "classroom") => {
    if (!canHideout || !classroom?.on) return;
    if (readOnly) { onOpenOwnHideout?.(origin); return; }
    setHideoutOrigin(origin === "plaza" ? "plaza" : "classroom");
    setDialog(null);
    setError("");
    setTab("hideout");
  }, [canHideout, readOnly, classroom?.on, onOpenOwnHideout]);
  // to — "plaza"면 들어온 곳과 상관없이 책 광장으로(아지트 머리의 '광장으로'), 아니면 들어온 곳(포털 · 그 밖의 나가기)
  const leaveHideout = useCallback((to) => {
    setPlazaJump(null);
    setDialog(null);
    setError("");
    const room = to !== "plaza" && classroom?.on && hideoutOrigin === "classroom" ? "classroom" : "plaza";
    setPlazaReturn({ room, key: `hideout-return-${++returnSequence.current}` });
    setTab(!readOnly && plazaOn ? "plaza" : "library");
  }, [plazaOn, classroom?.on, readOnly, hideoutOrigin]);
  useEffect(() => {
    if (tab === "hideout" && !canHideout) leaveHideout();
  }, [tab, canHideout, leaveHideout]);
  // 내 광장 목록 한 장 — 내 책에 달린 댓글 수 · 지금 광장에 올라가 있는 모습(학생 본인 화면 · 광장을 켠 반에서만, 읽기 1)
  const [myShelf, setMyShelf] = useState(null);
  const ownPlaza = plazaOn && !readOnly && !isTeacher && !!user?.uid;
  const myUid = user?.uid;
  // 광장의 자료 함수도 광장을 켠 반에서만 내려받습니다(무대와 같은 까닭 — 아래 dynamic 주석).
  useEffect(() => {
    setMyShelf(null);
    if (!ownPlaza || !classId || !myUid) return undefined;
    let alive = true;
    let off = null;
    import("@/lib/data/plaza").then((plaza) => {
      if (alive) off = plaza.subscribeMyPlazaShelf(classId, myUid, setMyShelf, () => setMyShelf(null));
    }).catch(() => {});
    return () => { alive = false; off?.(); };
  }, [ownPlaza, classId, myUid]);
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  // 선생님의 '모두 이동'(모두 교실로 · 모두 광장으로 — 선생님 요청) — 알림과 10초 카운트다운이 끝나면, 책꽂이 · 성장 탭에
  // 있던 학생도 책 광장 탭으로 넘어갑니다(그 방으로 옮기는 것은 무대가 맡음 — ReadingPlaza).
  //   · **처음 받은 값은 기준일 뿐**입니다 — 떠 있는 동안 값이 바뀔 때만 넘어갑니다(한참 전의 신호로 책 봄을 열 때마다
  //     광장으로 끌려가지 않게. 다른 화면에서 막 데려온 학생은 주소의 ?tab=plaza로 처음부터 광장 탭입니다).
  //   · **쓰던 입력 창(책 등록 · 독서 발자국 · 한 권의 책)은 닫지 않습니다** — 창은 그대로 뜬 채 뒤의 화면만 광장이
  //     됩니다(저장하거나 닫으면 광장이 보임 · 쓰던 글이 날아가지 않게). 읽기만 하는 책 상세 창은 닫습니다.
  //   · 이미 광장 탭이면 아무것도 건드리지 않습니다('광장에서 보기'로 연 책 창이 다시 서지 않게).
  //   · 선생님이 학생의 책 봄을 읽는 화면(readOnly)은 넘어가지 않습니다 — 선생님의 광장은 따로 섭니다(TeacherReadingView).
  const tabNow = useRef(tab);
  tabNow.current = tab;
  const seenCall = useRef(plazaCall);
  useEffect(() => {
    if (plazaCall === seenCall.current) return;
    seenCall.current = plazaCall;
    if (!plazaCall || !plazaOn || readOnly || tabNow.current === "plaza") return;
    setPlazaJump(null);
    setPlazaReturn(null);
    setError("");
    setDialog((current) => (current?.type === "detail" || current?.type === "badge" ? null : current));
    setTab("plaza");
  }, [plazaCall, plazaOn, readOnly]);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [day, setDay] = useState(() => kstToday());
  const disabledRef = useRef(onDisabled);
  disabledRef.current = onDisabled;
  const openedLink = useRef(null);

  useEffect(() => {
    if (!raw || !initialBookId || openedLink.current === initialBookId) return;
    openedLink.current = initialBookId;
    if (raw.books?.some((book) => book.id === initialBookId)) {
      setTab("library");
      setDialog({ type: "detail", bookId: initialBookId });
    }
  }, [raw, initialBookId]);

  useEffect(() => {
    setRaw(null); setLoading(true); setError(""); setDialog(null); setConfirm(null);
    if (!classId || !viewUid) { setLoading(false); return undefined; }
    let live = true;
    const off = subscribeReadingState(classId, viewUid,
      (state) => { if (live) { setRaw(state || initialReadingState()); setLoading(false); } },
      (e) => {
        if (!live) return;
        setLoading(false); setError(e?.message || "독서 정보를 불러오지 못했어요.");
        if (isDisabledError(e)) disabledRef.current?.();
      });
    return () => { live = false; off?.(); };
  }, [classId, viewUid, revision]);

  useEffect(() => {
    const timer = setInterval(() => setDay(kstToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const stats = useMemo(() => deriveReading(raw || initialReadingState(), new Date(`${day}T12:00:00+09:00`)), [raw, day]);
  // 성장·뱃지 — 한때 책꽂이 왼쪽에 늘 서던 칸(ReadingGrowthSidebar)을 걷고, 떠 있는 동그라미의 '성장·뱃지' 행성이 메신저처럼
  // 창으로 엽니다(선생님 요청 · 2026년 11월 — 되살리지 마세요). 이 화면이 들고 있는 뱃지를 다리에 걸어 두면 그 창이 그대로
  // 그립니다(서버에 다시 묻지 않음). 뱃지를 누르면 이 화면의 뱃지 상세 창이 뜹니다(대표 뱃지 고르기도 그대로).
  // 교사가 학생을 볼 때는 그 학생의 것(owner) — 다른 학생을 고르면 새 화면이 다시 걸고, 걷을 때는 제 것만 걷습니다(token).
  const badgeToken = useMemo(() => ({}), []);
  const openBadge = useCallback((badgeId) => setDialog({ type: "badge", badgeId }), []);
  const badgeOwner = readOnly ? (student?.name || "학생") : null;
  useEffect(() => {
    publishReadingBadges({ token: badgeToken, state: loading ? "loading" : raw ? "ready" : "error", owner: badgeOwner, stats: raw ? stats : null, onInspect: openBadge });
  }, [badgeToken, loading, raw, stats, badgeOwner, openBadge]);
  useEffect(() => () => withdrawReadingBadges(badgeToken), [badgeToken]);
  const askedBadges = useRef(false);
  useEffect(() => {
    if (askedBadges.current || readOnly || initialTab !== "growth") return;
    askedBadges.current = true;
    requestReadingBadgesPanel();
  }, [initialTab, readOnly]);
  // 레벨 옷이 바뀌는 순간(Lv.7 탐험가 옷 · Lv.10 마스터 옷)의 축하 — 학생 본인 화면에서 옷마다 한 번(이 기기에 기억 —
  // lib/readingOutfitCheer.js · 화면 OutfitCelebration.jsx · 선생님 요청). 이미 Lv.7 · Lv.10인 학생은 처음 열 때 한 번.
  // 같은 저장에서 펫도 자라면(알을 경험치 0에서 받은 학생은 기준표가 같아 늘 함께) 옷 축하가 먼저이고, 끝나면 펫 축하가
  // 이어집니다(PetCard의 holdCheer — 둘이 한꺼번에 겹쳐 뜨지 않게). '레벨 n 달성!' 알림 줄은 옷 축하가 대신 알립니다.
  // 축하가 끝나도 지우지 않고 done만 적어 둡니다 — 뒤이어 뜨는 펫 축하가 같은 '레벨 n 달성!'을 또 말하지 않게(skipLevel).
  const [outfitCheer, setOutfitCheer] = useState(null);
  const outfitShowing = !!outfitCheer && !outfitCheer.done;
  const outfitDue = ownStudent && raw ? outfitCheerFor(readOutfitSeen(user.uid), stats.level) : null;
  const outfitDueKey = outfitDue?.to.key ?? null;
  const outfitDueRef = useRef(null);
  outfitDueRef.current = outfitDue;
  useEffect(() => {
    if (!outfitDueKey || !user?.uid) return;
    const due = outfitCheerFor(readOutfitSeen(user.uid), stats.level);
    if (!due) return;
    markOutfitSeen(user.uid, due.to.key);
    setOutfitCheer({ ...due, level: stats.level, id: `${due.to.key}:${Date.now()}` });
  }, [outfitDueKey, user?.uid, stats.level]);
  const previousLevel = useRef(null);
  // 펫 축하가 함께 알린 레벨 — 같은 저장에서 펫이 자라며 레벨도 오르면 폭죽 한 번에 함께 알리므로
  // 알림 줄은 같은 말을 또 띄우지 않습니다. 펫 카드(자식)의 효과가 아래 효과보다 먼저 돌아 여기에 적습니다.
  const petLevelRef = useRef(null);
  const markPetLevel = useCallback((lv) => { petLevelRef.current = lv; }, []);
  useEffect(() => {
    if (!raw) return;
    const petTold = petLevelRef.current === stats.level;
    petLevelRef.current = null;
    if (!readOnly && !petTold && !outfitDueRef.current && previousLevel.current != null && stats.level > previousLevel.current) setNotice(`레벨 ${stats.level} 달성! 독서의 깊이가 한 단계 더 자랐어요.`);
    previousLevel.current = stats.level;
  }, [raw, stats.level, readOnly]);
  useEffect(() => { previousLevel.current = null; }, [classId, viewUid]);

  // success — 알림 글. 함수면 저장 결과(새 서재)를 보고 고릅니다(한 번에 완독한 발자국 — '한 권의 책'이 함께 남았나).
  async function run(action, success = "저장했어요.") {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const result = readOnly ? await mutateStudentBook(classId, student.uid, action) : await mutateReading(classId, action);
      if (result?.state) setRaw(result.state);
      else if (Array.isArray(result?.books) && Array.isArray(result?.logs)) setRaw(result);
      const done = typeof success === "function" ? success(result?.state ?? result) : success;
      // 펫 먹이 — 이 저장으로 오늘이 '읽은 날'이 됐거나(배부름 유지) 떠난 펫을 부르는 걸음이 됐으면 함께 알립니다
      const news = PET_NEWS[result?.petEvent];
      const petNews = typeof news === "function" ? news(petFeed?.read) : news ?? "";
      if (done || petNews) setNotice(`${done || ""}${done && petNews ? " " : ""}${petNews}`);
      return true;
    } catch (e) {
      setError(e?.message || "저장하지 못했어요. 다시 시도해 주세요.");
      if (isDisabledError(e)) { setDialog(null); disabledRef.current?.(); }
      return false;
    } finally { setBusy(false); }
  }
  function ask(title, action) { setDialog(null); setConfirm({ title, action }); }
  const books = stats.books || [];
  const visibleBooks = books.filter((b) => filter === "archived" ? b.archived : !b.archived && (filter === "all" || b.status === filter));
  const selected = dialog?.bookId ? books.find((b) => b.id === dialog.bookId) : null;
  const inspectedBadge = dialog?.type === "badge" ? stats.badges.find((b) => b.id === dialog.badgeId) : null;
  const featured = (stats.badges || []).find((b) => b.id === (stats.featuredBadge?.id || stats.featuredBadge));
  const showPet = petOn && ownStudent;
  const showCharacter = characterOn && (ownStudent || readOnly);
  const featuredReady = !!raw && !loading;
  const showStudentPet = petOn && readOnly && !!student.pet;
  // 펫 먹이를 켠 반의 학생 — 발자국 창이 '오늘의 읽기'(쪽 · 글자 수)를 보여 줍니다(lib/petCare.js의 readingDayProof)
  const feedOn = showPet && !!petFeed?.on;
  // '읽은 날'의 기준은 그 반의 것(선생님이 관리자 설정에서 정한 쪽수 · 글자 수 — petFeed.read · 결과의 need)
  const readToday = useMemo(() => (feedOn && raw ? readingDayProof(stats, day, petFeed) : null), [feedOn, raw, stats, day, petFeed]);
  // 광장에서 나가기 — 책꽂이로 돌아와 입장 단추에 초점을 둡니다. 학생은 탭 대신 이 단추로 오갑니다.
  const tabsRef = useRef(null);
  const plazaEntryRef = useRef(null);
  const enterPlaza = useCallback(() => {
    setTab("plaza");
    setDialog(null);
    setError("");
    setPlazaJump(null);
    setPlazaReturn(null);
  }, []);
  const leavePlaza = useCallback(() => {
    setTab("library");
    setDialog(null);
    setError("");
    setPlazaJump(null);
    requestAnimationFrame(() => (plazaEntryRef.current ?? tabsRef.current?.querySelector("button"))?.focus({ preventScroll: true }));
  }, []);
  const plazaEntry = ownPlaza && <button type="button" className="btn-primary reading-plaza-entry" ref={plazaEntryRef} onClick={enterPlaza}>광장으로 이동</button>;
  // 발자국 · 한 권의 책 창을 닫거나 저장한 뒤 돌아갈 곳 — **연 곳으로**(선생님 요청 · 2026년 11월). 책 상세 창에서 연 창
  // (from: "detail" — 상세 창의 '독서 발자국' · 발자국의 '고쳐쓰기' · '한 권의 책' · '고쳐쓰기')은 상세 창으로, 책 카드의
  // 단추로 연 창은 책꽂이로 돌아갑니다(상세 창은 카드의 위쪽을 눌렀을 때만 열림). 한때 어디서 열었든 늘 상세 창으로
  // 돌아가, 카드에서 발자국 창을 열었다 취소하면 열지도 않은 상세 창이 떴습니다.
  const formBack = (d) => (d?.from === "detail" && d.bookId ? { type: "detail", bookId: d.bookId } : null);
  // 책 광장 — 이 책이 지금 광장에 올라가 있는지 · 그 반에서 남긴 글(책 상세 창의 가판대 · 책꽂이 단추)
  const plazaInfo = (bookId) => ({
    entry: (Array.isArray(myShelf?.books) ? myShelf.books : []).find((b) => b?.id === bookId) ?? null,
    hasLogs: stats.logs.some((log) => log.bookId === bookId && log.classId === classId),
    hasReview: stats.reviews.some((review) => review.bookId === bookId && review.classId === classId),
  });

  // 소개 카드(통계 · 대표 뱃지 · 캐릭터 · 펫). 교사 화면은 명단 위 맨 윗줄(introSlot)에, 학생 화면은 탭 줄 위 그대로.
  // 학생 본인 화면도 교사가 학생을 볼 때와 같은 모양 — 제목 덩이('책 봄 · 반 이름' 머리줄 · '한 페이지씩…' 문구 · 안내 한 줄)를
  // 그리지 않습니다(선생님 요청 · 2026년 11월 — 교사 쪽을 먼저 걷었고 학생 쪽도 같게. 한때 그 덩이가 카드 높이를 정해 캐릭터 · 펫 카드
  // 아래위가 비었음 · 되살리지 마세요). 학생 책 봄에는 머리말 줄이 없습니다 — '책 봄' 제목은 걷었고(상단바의 '책 봄'이 말함), 반 이름
  // (반 고르개) · '출석하기'만 이 카드의 통계 위 한 줄(classControls)로 섭니다(선생님 요청 · 2026년 11월).
  const intro = (
    <div className={`reading-intro reading-intro--profile ${readOnly ? "reading-intro--teacher" : "reading-intro--student"}${ownStudent ? " has-profile" : ""}${showPet ? " has-pet" : ""}`}>
      <div className="reading-intro-main">
      {/* 학생 본인 — 반 이름(여러 반이면 반 고르개) · '출석하기'가 통계(독서 레벨) 위에 섭니다(책방 페이지가 넘김 · 선생님 요청 · 2026년 11월).
          머리말 줄의 '책 봄' 제목은 걷었습니다. 통계 칸의 남는 높이 안에 서서 카드를 높이지 않습니다(넓은 화면 — 높이는 세 카드가 정함). */}
      {ownStudent && classControls && <div className="reading-intro-class">{classControls}</div>}
      {raw && !loading ? <ReadingSummary stats={stats} compact /> : <p className="reading-intro-loading" role="status">{loading ? "독서 기록을 불러오고 있어요." : "독서 정보를 불러오지 못했어요."}</p>}
      </div>
      {(ownStudent || readOnly) && <div className="reading-intro-side">
        <div className="reading-featured" role="group" aria-label="대표 뱃지">
          {featuredReady && featured?.earned ? <ReadingBadge badge={featured} size={64} /> : <IconTrophy size={64} />}
          <span>대표 뱃지<strong>{featuredReady ? (featured?.earned ? featured.name : "아직 선택하지 않았어요") : loading ? "불러오는 중…" : "확인할 수 없어요"}</strong>{featuredReady && featured?.earned && <em>{tierName(featured.tier)}</em>}</span>
        </div>
        {showCharacter && <ReadingCharacterSummary uid={viewUid} summary={raw && !loading ? stats : null} readOnly={readOnly} active={tab === "library" || tab === "ranking"} />}
        {showStudentPet && <StudentPetSummary mirror={student.pet} growthXp={raw ? petGrowthOfSummary(stats) : null} feed={petFeed} today={day} />}
        {/* 나의 펫 — 단계는 이미 받은 서재로 셉니다(lib/readingPet.js). 서재를 받기 전에는 카드도 기다립니다. */}
        {showPet && <PetCard classId={classId} uid={user.uid} growthXp={raw ? petGrowthOfSummary(stats) : null} level={raw ? stats.level : null} onLevelCheer={markPetLevel}
          holdCheer={!!outfitDue || outfitShowing} skipLevel={outfitCheer?.level ?? (outfitDue ? stats.level : null)}
          feed={petFeed} fruits={myFruit} today={day} preview={petPreview} />}
      </div>}
    </div>
  );
  // 탭 줄 — 학생 화면은 소개 카드 아래 맨 위에, 교사 화면(readOnly)은 책꽂이 카드 맨 위에서 카드 제목 자리를 대신합니다(아래 teacherShelf).
  const tabNav = !ownPlaza && <nav className="reading-tabs" aria-label="책 봄 메뉴" ref={tabsRef}>
    {[["library", "책꽂이"], ...(!readOnly || !plazaOn ? [[thirdTab, plazaOn ? "책 광장" : "우리 반 랭킹"]] : []), ...(readOnly && canHideout ? [["hideout", "아지트 보기"]] : [])].map(([key, label]) => <button type="button" key={key} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} data-reading-hideout-gallery={key === "hideout" && onOpenHideoutGallery ? "true" : undefined} onClick={() => { if (key === "hideout" && readOnly && onOpenHideoutGallery) { onOpenHideoutGallery(); return; } setTab(key); setDialog(null); setError(""); setPlazaJump(null); setPlazaReturn(null); }}>{label}</button>)}
  </nav>;
  const loadingBox = <div className="reading-loading" role="status"><span className="reading-loader" />독서 기록을 불러오고 있어요.</div>;
  const failedBox = <div className="reading-empty"><BookIcon size={40} /><h3>독서 정보를 불러오지 못했어요.</h3><button type="button" className="btn-primary" onClick={() => setRevision((r) => r + 1)}>다시 불러오기</button></div>;
  const libraryFilters = <div className="reading-filters" aria-label="도서 상태 필터">{FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>;
  const libraryBooks = visibleBooks.length ? <div className="reading-library-grid">{visibleBooks.map((b, i) => <BookCard key={b.id} book={b} index={i} busy={busy} readOnly={readOnly} onOpen={() => setDialog({ type: "detail", bookId: b.id })} onReview={() => setDialog({ type: "review", bookId: b.id })} onLog={() => setDialog({ type: "log", bookId: b.id })} onRestore={() => run({ type: "archiveBook", bookId: b.id, archived: false }, "책을 책꽂이로 돌려놓았어요.")} />)}</div> : <div className="reading-empty"><BookIcon size={44} /><h3>{readOnly ? "아직 이곳에 놓인 책이 없어요." : filter === "all" ? "나의 첫 책을 기다리고 있어요." : "아직 이곳에 놓인 책이 없어요."}</h3>{!readOnly && <p>{filter === "all" ? "읽고 싶은 책을 등록하고 오늘 읽은 순간을 남겨 보세요." : "책을 읽고 기록하면 책꽂이의 풍경도 달라져요."}</p>}{filter === "all" && !readOnly && <button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>첫 책 등록하기</button>}</div>;
  // 순위는 탭을 열 때 · 기간을 바꿀 때 · 새로고침을 누를 때만 받습니다(한 번에 반 전체를 읽음).
  // 한때 독서 자료 전체(raw)를 신호로 넘겨, 상태를 다시 물을 때마다(10초) 순위를 다시 받았습니다 —
  // 저장은 다른 탭에서만 하므로, 저장한 뒤 이 탭을 열면 새로 받습니다.
  const rankings = tab === "ranking" && <Rankings key={classId} classId={classId} uid={viewUid} isTeacher={isTeacher} onDisabled={onDisabled} />;
  // [교사] 탭 줄(책꽂이 · 아지트 보기 — 책 광장을 끈 반은 책꽂이 · 우리 반 랭킹)이 책꽂이 카드 맨 위에 서서 카드 제목을 대신하고, 오른쪽 끝에
  // 선생님 단추 셋(teacherTools)이 섭니다(선생님 요청 · 2026년 11월 — 한때 탭 줄이 카드 위에 따로 섰고 카드 안에 '책꽂이 n · 책의 마지막
  // 페이지까지, 나의 속도로.' 제목이 또 섰습니다 · 되살리지 마세요). 학생을 바꿔 서재를 다시 받는 동안에도 카드와 탭 줄은 그대로 서고
  // 안쪽만 '불러오고 있어요'가 됩니다(탭 줄이 사라졌다 돌아오며 화면이 들썩이지 않게). 학생 본인 화면은 그대로입니다.
  const teacherShelf = readOnly && <div className="reading-workspace"><div className="reading-workspace-layout"><div className="reading-workspace-main">
    <div className="reading-library-panel reading-library-panel--tabs">
      <div className="reading-library-toolbar">
        <div className="reading-library-tabsrow">{tabNav}{teacherTools}</div>
        {tab === "library" && raw && !loading && libraryFilters}
      </div>
      {loading ? loadingBox : !raw ? failedBox : tab === "ranking" ? rankings : libraryBooks}
    </div>
  </div></div></div>;
  return <ReadingErrorContext.Provider value={error}><section className={`reading-hub${ownPlaza ? " reading-hub--no-tabs" : ""}${introApart ? " reading-hub--intro-apart" : ""}${tab === "plaza" || tab === "hideout" ? " reading-hub--plaza" : ""}`} aria-label={readOnly ? `${student.name || "학생"}의 책 봄` : "책 봄 성장 기능"} aria-busy={tab === "hideout" ? false : loading || busy}>
    {introApart ? (introSlot && tab !== "plaza" && tab !== "hideout" ? createPortal(intro, introSlot) : null) : intro}
    {!readOnly && tabNav}
    {error && !dialog && !confirm && <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="오류 안내 닫기">×</button></div>}
    {notice && <div className="reading-notice" role="status">{notice}</div>}
    {/* 서재를 기다리거나 못 받은 때도 광장은 독립적으로 열 수 있습니다. */}
    {tab === "library" && ownPlaza && (loading || !raw) && <div className="reading-library-entry">{plazaEntry}</div>}
    {/* 책 광장은 서재(정본)를 기다리지 않습니다 — 반의 공유 사본을 제 손으로 구독합니다. 펫의 단계만 서재에서 받습니다. */}
    {tab === "plaza" ? <PlazaExitContext.Provider value={leavePlaza}><ReadingPlaza key={plazaJump?.key ?? plazaReturn?.key ?? "plaza"} classId={classId} user={user} isTeacher={isTeacher} characterOn={characterOn} petOn={showPet} petFeed={petFeed} growthXp={raw ? petGrowthOfSummary(stats) : null} level={raw ? stats.level : null} fruits={myFruit} initialBook={plazaJump} initialRoom={plazaJump ? null : plazaReturn?.room} onExit={leavePlaza} classroom={classroom} hideoutOn={canHideout && (!readOnly || typeof onOpenOwnHideout === "function")} onEnterHideout={enterHideout} talkOn={plazaOn && talkOn} /></PlazaExitContext.Provider>
    : tab === "hideout" && canHideout ? <PlazaExitContext.Provider value={leaveHideout}><ReadingHideout key={`${classId}:${viewUid}`} classId={classId} user={user} student={student} summary={stats} readOnly={readOnly} characterOn={characterOn} petOn={petOn} petFeed={petFeed} fruits={myFruit} returnRoom={hideoutOrigin} onDisabled={leaveHideout} onExit={leaveHideout} /></PlazaExitContext.Provider>
    : readOnly ? teacherShelf
    : loading ? loadingBox : !raw ? failedBox : <div className="reading-workspace"><div className="reading-workspace-layout">
      {/* 성장·뱃지는 떠 있는 동그라미의 창으로 옮겼습니다(위 badgeToken) — 책꽂이가 가로를 다 씁니다 */}
      <div className="reading-workspace-main">
      {/* 책꽂이 카드 하나 — 제목 · 단추 · 상태 필터와 그 아래 책 카드(빈 안내)가 한 카드 안에 섭니다(선생님 요청 · 2026년 11월 —
          한때 책 카드가 도구 카드 아래 따로 섰습니다). 교사 화면은 위 teacherShelf. */}
      {tab === "library" && <div className="reading-library-panel">
        <div className="reading-library-toolbar">
        <div className="reading-section-head reading-library-head"><div><h3>책꽂이 <span>{books.filter((b) => !b.archived).length}</span></h3><p>책의 마지막 페이지까지, 나의 속도로.</p></div>{ownPlaza ? <div className="reading-library-actions">{plazaEntry}<button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>＋ 책 등록</button></div> : <button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>＋ 책 등록</button>}</div>
        {libraryFilters}
        </div>
        {libraryBooks}
      </div>}
      {rankings}
      </div>
    </div></div>}

    {inspectedBadge && <BadgeDetail badge={inspectedBadge} featured={featured?.id === inspectedBadge.id} busy={busy} readOnly={readOnly} onClose={() => setDialog(null)} onSelect={() => run({ type: "setFeaturedBadge", badgeId: inspectedBadge.id }, "대표 뱃지를 바꿨어요.")} />}
    {dialog?.type === "book" && (!readOnly || (teacherEdit && selected)) && (() => {
      const recorded = !!selected && [...(raw?.logs || []), ...(raw?.reviews || [])].some((r) => r.bookId === selected.id);
      return <BookForm key={selected?.id || "new"} book={selected} searchOn={bookSearchOn} teacherFor={teacherEdit ? (student.name || "학생") : null} recorded={recorded} pagesFloor={selected ? bookPagesFloor(raw, selected.id) : 0} activityPick={!teacherEdit && activitiesOn && BOOK_ACTIVITY_LINK_READY} pagesLocked={!teacherEdit && recorded} activities={activities} busy={busy} onClose={() => setDialog(null)} onSave={async (values) => { const ok = await run({ type: selected ? "updateBook" : "addBook", ...(selected ? { bookId: selected.id } : {}), ...values }, selected ? (teacherEdit ? `${student.name || "학생"}의 책 정보를 고쳤어요.` : "책 정보를 고쳤어요.") : "새 책을 책꽂이에 놓았어요."); if (ok) setDialog(null); }} />;
    })()}
    {dialog?.type === "detail" && selected && <BookDetail book={selected} classId={classId} readOnly={readOnly} teacherEdit={teacherEdit} activity={activities.find((a) => a.id === selected.activityId)} onOpenActivity={BOOK_ACTIVITY_LINK_READY ? onOpenActivity : undefined} logs={(stats.logs || raw?.logs || []).filter((l) => l.bookId === selected.id)} review={(stats.reviews || raw?.reviews || []).find((r) => r.bookId === selected.id)} busy={busy} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: "book", bookId: selected.id })} onLog={(log) => setDialog({ type: "log", bookId: selected.id, log, from: "detail" })} onReview={() => setDialog({ type: "review", bookId: selected.id, from: "detail" })} onDeleteLog={(log) => ask((raw?.reviews || []).some((r) => r.bookId === log.bookId && r.fromLogId === log.id) ? "이 독서 기록을 삭제할까요? 경험치와 달성 기록도 다시 계산해요. 함께 남긴 ‘한 권의 책’은 지워지지 않고 그대로 남아요." : "이 독서 기록을 삭제할까요? 경험치와 달성 기록도 다시 계산해요.", { type: "deleteLog", logId: log.id })} onArchive={() => ask(selected.archived ? "이 책을 책꽂이로 돌려놓을까요?" : "이 책을 보관함으로 옮길까요? 독서 기록은 그대로 남아요.", { type: "archiveBook", bookId: selected.id, archived: !selected.archived })}
      plaza={ownPlaza ? plazaInfo(selected.id) : null}
      onOpenPlaza={(place) => { setDialog(null); setError(""); setPlazaJump({ uid: viewUid, bookId: selected.id, place, key: `jump-${Date.now()}` }); setTab("plaza"); }} />}
    {dialog?.type === "log" && selected && <LogForm key={dialog.log?.id || selected.id} book={selected} log={dialog.log} reviews={raw?.reviews || []} today={day} busy={busy} petRead={readToday} plaza={ownPlaza ? "shown" : null} onClose={() => setDialog(formBack(dialog))} onSave={async (values, plan) => { const bookId = selected.id; const back = formBack(dialog); const ok = await run({ type: dialog.log ? "updateLog" : "addLog", bookId, ...(dialog.log ? { logId: dialog.log.id } : {}), ...values }, (state) => logSavedNotice(plan, state, bookId, !!dialog.log)); if (ok) setDialog(back); }} />}
    {dialog?.type === "review" && selected && <ReviewForm key={selected.id} book={selected} review={(stats.reviews || raw?.reviews || []).find((r) => r.bookId === selected.id)} busy={busy} plaza={ownPlaza ? "shown" : null} onClose={() => setDialog(formBack(dialog))} onSave={async (values) => { const back = formBack(dialog); const ok = await run({ type: "saveReview", bookId: selected.id, ...values }, "책을 읽고 남긴 생각을 저장했어요."); if (ok) setDialog(back); }} />}
    {confirm && <Modal title="기록 확인" busy={busy} onClose={() => setConfirm(null)}><p className="reading-confirm-copy">{confirm.title}</p><div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>취소</button><button type="button" className="reading-danger-button" disabled={busy} onClick={async () => { if (await run(confirm.action, "기록을 정리했어요.")) setConfirm(null); }}>{busy ? "처리 중…" : "확인"}</button></div></Modal>}
      {outfitShowing && <OutfitCelebration key={outfitCheer.id} uid={user.uid} characterOn={characterOn} from={outfitCheer.from} to={outfitCheer.to} level={outfitCheer.level} onDone={() => setOutfitCheer((old) => (old ? { ...old, done: true } : old))} />}
  </section></ReadingErrorContext.Provider>;
}

function ReadingSummary({ stats, compact = false }) {
  return <div className={`reading-summary${compact ? " reading-summary--compact" : ""}`} aria-label="학생 독서 활동 정보">
    <div className="reading-level"><span>독서 레벨</span><strong><small>Lv.</small>{stats.level}</strong><div className="reading-progress" role="progressbar" aria-label={stats.maxLevel ? "최고 레벨" : "다음 레벨까지"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.progress || 0)}><i style={{ width: `${stats.progress || 0}%` }} /></div><span>{stats.maxLevel ? `${number(stats.xp)} EXP · 최고 레벨` : `${number(stats.xp)} / ${number(stats.nextXp)} EXP`}</span></div>
    <div><span>누적 독서량</span><strong>{number(stats.totalPages)}<small>쪽</small></strong><span>기록한 페이지가 경험치로</span></div>
    <div><span>완독한 책</span><strong>{number(stats.totalBooks)}<small>권</small></strong><span>다음 목표는 3권, 그리고 5권</span></div>
    <div><span>지금 이어가는 독서</span><strong>{number(stats.currentStreak)}<small>일</small></strong><span>최장 {number(stats.longestStreak)}일 연속</span></div>
  </div>;
}

// 독서를 저장했을 때의 펫 소식(서버 · 체험반이 돌려주는 petEvent — lib/petCare.js의 planCareReadDay)
const PET_NEWS = {
  kept: "펫의 배부름이 오늘은 줄지 않아요.",
  // 기준은 그 반의 것(선생님이 정한 쪽수 · 글자 수 — 처음 값 5쪽 · 250자)
  unkept: (read) => `오늘의 ‘읽은 날’이 풀렸어요 — ${careReadLabel(read)} 이상이면 다시 유지돼요.`,
  step: "떠난 펫을 부르는 한 걸음을 채웠어요.",
  unstep: "다시 부르기 걸음이 하나 줄었어요.",
  returned: "펫이 돌아왔어요!",
};

function isDisabledError(e) {
  return ["reading-disabled", "reading/disabled", "disabled_feature", "READING_DISABLED"].includes(e?.code) || (e?.status === 403 && /비활성|사용.*중지|사용.*꺼/.test(e.message || ""));
}

// 카드 아래 단추 셋 — 도서 정보 보기 · 한 권의 책(완독했을 때만, 가운데) · 독서 발자국.
// 같은 크기 세 칸으로 못 박아(빈 가운데 칸 포함) 카드마다 단추 자리가 같습니다(선생님 요청).
// 첫 칸은 한때 '기록 살펴보기'(상세 창 열기)였는데, 카드를 누르면 같은 창이 열려 '도서 정보 보기'(새 창 — 도서 검색으로 담은
// 책은 그 책의 정보 쪽, 직접 적어 담은 책은 다음 검색 · lib/reading.js의 bookInfoUrl)로 바꿨습니다(선생님 요청 · 2026년 11월).
function BookCard({ book, index, busy, readOnly = false, onOpen, onLog, onReview, onRestore }) {
  const status = book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중";
  const infoUrl = bookInfoUrl(book);
  const info = infoUrl ? <a className="btn-ghost reading-book-info-link" href={infoUrl} target="_blank" rel="noopener noreferrer" title="새 창에서 열려요" aria-label={`${book.title} 도서 정보 보기 (새 창)`}>도서 정보 보기</a> : <span aria-hidden="true" />;
  return <article className={`reading-book-card reading-book-color-${index % 4}`}>
    {book.status === "completed" && <img className="reading-completion-badge" src="/reading-badges/book-completion.webp" alt="완독 축하 배지" width={50} height={50} />}
    <button type="button" className="reading-book-open" onClick={onOpen} aria-label={`${book.title} 상세 보기`}>
      <BookCover book={book} />
      <div className="reading-book-info">
        <span className={`reading-status reading-status--${book.status}`}>{book.archived ? "보관 중" : status}</span>
        <h4>{book.title}</h4>
        <div className="reading-book-meta">
          <div className="reading-book-byline">
            <p>{book.author}</p>
            <div className="reading-book-pages"><strong>{number(book.pagesRead ?? book.currentPage)}</strong> / {number(book.totalPages)}쪽</div>
          </div>
        </div>
        <div className="reading-progress"><i style={{ width: `${book.progress || 0}%` }} /></div>
        <span className="reading-book-percent">{Math.round(book.progress || 0)}% 읽었어요</span>
      </div>
    </button>
    <div className="reading-book-actions">{readOnly ? info : <>{info}{book.status === "completed" && !book.archived ? <button type="button" className="reading-small-review" disabled={busy} onClick={onReview}>한 권의 책</button> : <span aria-hidden="true" />}<button type="button" className="reading-small-primary" disabled={busy} onClick={book.archived ? onRestore : onLog}>{book.archived ? "책꽂이로 복원" : "독서 발자국"}</button></>}</div>
  </article>;
}

function BookCover({ book }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const image = book.coverImage && failedUrl !== book.coverImage;
  return <div className={`reading-book-cover${image ? " reading-book-cover--image" : ""}`}>
    {image ? <img src={book.coverImage} alt={`${book.title} 표지`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(book.coverImage)} />
      : <><span className="reading-book-cover-line" /><BookIcon size={30} /><span className="reading-book-cover-title">{book.title}</span><small>{book.author}</small></>}
  </div>;
}

// 새 책 등록 — 관리자 설정의 '도서 검색'이 켜져 있으면 맨 위에 '도서 검색' 단추가 서고,
// 누르면 카카오 책 검색 칸이 펼쳐집니다(직접 입력하기로 접힘). 꺼져 있으면 직접 입력만.
// teacherFor — [교사] 학생의 책 정보 고치기(학생 이름 · 선생님 요청 · 2026년 11월). 학생과 다른 점: 기록이 있어도 쪽수를 고치고
// (pagesFloor — 독서 발자국이 닿은 쪽 아래로는 못 줄임 · recorded면 '다시 셈' 안내), 읽기 상태는 학생의 것이라 칸이 없고,
// 도서 검색으로 표지 · ISBN까지 바꿀 수 있습니다(고르면 제목 · 지은이 · 표지가 그 책으로 · 쪽수는 그대로).
function BookForm({ book, searchOn = false, teacherFor = null, recorded = false, pagesFloor = 0, activityPick = true, pagesLocked, activities, busy, onSave, onClose }) {
  const teacher = !!book && !!teacherFor;
  const canSearch = searchOn && (!book || teacher);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ title: book?.title || "", author: book?.author || "", totalPages: book?.totalPages || "", status: book?.status === "paused" ? "paused" : "reading", activityId: book?.activityId || "", publisher: book?.publisher || "", isbn: book?.isbn || "", coverImage: book?.coverImage || "", bookLink: book?.bookLink || "" });
  const [selectedSearch, setSelectedSearch] = useState(false);
  // 표지 · ISBN과 함께 온 제목(검색에서 고른 책 · 이미 저장된 책) — 지금 제목이 다른 책 제목이 되면 '검색 정보 해제' 안내
  // (lib/reading.js의 bookTitleDrifted). 고른 검색 결과에 지은이가 없었는가 — 카카오가 지은이를 주지 않는 책은 직접 적습니다.
  const [metaTitle, setMetaTitle] = useState(book?.title || "");
  const [searchNoAuthor, setSearchNoAuthor] = useState(false);
  const searchHintId = useId();
  const titleRef = useRef(null);
  const authorRef = useRef(null);
  const pagesRef = useRef(null);
  const hasMetadata = !!(form.publisher || form.isbn || form.coverImage || form.bookLink);
  const titleDrift = hasMetadata && bookTitleDrifted(form.title, metaTitle);
  // 제목 · 지은이를 고쳐도 검색 정보(출판사 · ISBN · 표지 · 링크)는 그대로 둡니다(선생님 신고 — 한때 한 글자만 고쳐도 모두 지워져,
  // 지은이 없이 온 책은 지은이를 적는 순간 표지가 사라졌습니다). 다른 책이면 '검색 정보 해제'로 지웁니다(제목이 달라지면 안내).
  function change(key, value) {
    setForm((p) => ({ ...p, [key]: value }));
  }
  function selectSearch(result) {
    // 고치는 중이면(선생님) 쪽수는 그대로 둡니다 — 검색 결과에는 쪽수가 없어요
    setForm((p) => ({ ...p, title: result.title || "", author: result.author || "", totalPages: book ? p.totalPages : "",
      publisher: result.publisher || "", isbn: result.isbn || "", coverImage: result.coverImage || "", bookLink: result.link || "" }));
    setSelectedSearch(true);
    setMetaTitle(result.title || "");
    const noAuthor = !String(result.author || "").trim();
    setSearchNoAuthor(noAuthor);
    // 지은이가 비어 왔으면 지은이 칸으로(채워야 담을 수 있음), 아니면 쪽수 칸으로
    requestAnimationFrame(() => (noAuthor ? authorRef : pagesRef).current?.focus());
  }
  return <Modal title={teacher ? `${teacherFor}의 책 정보 고치기` : book ? "책 정보 고치기" : "새 책 등록"} onClose={onClose} busy={busy}>
    {canSearch && (searching
      ? <BookSearch busy={busy} autoFocus onSelect={(r) => { selectSearch(r); setSearching(false); }} onManual={() => { setSearching(false); requestAnimationFrame(() => titleRef.current?.focus()); }} />
      : <div className="reading-search-start">
          <button type="button" className="reading-search-open" disabled={busy} aria-describedby={teacher || !hasMetadata ? searchHintId : undefined} onClick={() => setSearching(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            {teacher ? "도서 검색으로 책 정보 바꾸기" : "도서 검색으로 책 정보 채우기"}
          </button>
          {/* 선생님 신고(2026년 11월) — 이 단추를 지나쳐 모두 직접 적었습니다. 고르면 무엇이 채워지는지 단추 바로 아래에서 말해
              먼저 검색하게 합니다. 쪽수는 검색 결과에 없어 약속하지 않습니다(고른 뒤 '쪽수는 직접' 안내가 따로 섬). */}
          {teacher
            ? <p className="reading-search-nudge" id={searchHintId}><span>검색에서 책을 고르면 제목&nbsp;·&nbsp;지은이&nbsp;·&nbsp;표지가 그 책으로 바뀌어요.</span> <span>전체 쪽수는 그대로 남아요.</span></p>
            : !hasMetadata && <p className="reading-search-nudge" id={searchHintId}><span><strong>먼저 검색해 보세요.</strong> 고른 책의 제목&nbsp;·&nbsp;지은이&nbsp;·&nbsp;표지가 한 번에 채워져요.</span> <span>찾는 책이 없을 때만 아래에 직접 적어 주세요.</span></p>}
        </div>)}
    {hasMetadata && <div className="reading-selected-book">
      <BookCover book={form} />
      <div><strong>{selectedSearch ? "검색에서 선택한 책" : "도서 정보"}</strong>{form.publisher && <span>{form.publisher}</span>}{form.isbn && <span>ISBN {form.isbn}</span>}
        {titleDrift && <p className="reading-selected-drift" role="status">제목이 바뀌었어요. 다른 책이면 ‘검색 정보 해제’를 눌러 표지와 ISBN을 지워 주세요.</p>}
        <button type="button" className="reading-search-manual" disabled={busy} onClick={() => { setForm((p) => ({ ...p, publisher: "", isbn: "", coverImage: "", bookLink: "" })); setSelectedSearch(false); setSearchNoAuthor(false); }}>검색 정보 해제</button>
      </div>
    </div>}
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, title: form.title.trim(), author: form.author.trim(), totalPages: Number(form.totalPages) }); }}>
      <label>책 제목<input ref={titleRef} data-initial-focus={book ? true : undefined} required maxLength={150} value={form.title} onChange={(e) => change("title", e.target.value)} placeholder="책 제목을 적어 주세요" disabled={busy} /></label>
      <label>지은이<input ref={authorRef} required maxLength={100} value={form.author} onChange={(e) => change("author", e.target.value)} placeholder="저자 이름" disabled={busy} /></label>
      <div className="reading-form-row"><label>전체 쪽수<input ref={pagesRef} required type="number" min={Math.max(1, pagesFloor)} max={100000} step={1} disabled={pagesLocked || busy} value={form.totalPages} onChange={(e) => change("totalPages", e.target.value)} inputMode="numeric" /></label>{book && !teacher && <label>읽기 상태<select value={form.status} onChange={(e) => change("status", e.target.value)} disabled={busy}><option value="reading">읽는 중</option><option value="paused">잠시 멈춤</option></select></label>}</div>
      {selectedSearch && <p className="reading-search-pages-help" role="status">{book
        ? (searchNoAuthor ? "검색 결과에 지은이가 없어 직접 입력해 주세요. 전체 쪽수는 그대로 두었어요." : "전체 쪽수는 그대로 두었어요. 실제 책과 다르면 고쳐 주세요.")
        : (searchNoAuthor ? "검색 결과에 지은이와 쪽수가 없어 직접 입력해 주세요." : "검색 결과에 쪽수가 없어 직접 입력해 주세요.")}</p>}
      {/* [교사] 기록이 있는 책 — 쪽수를 바꾸면 완독 · 경험치 · 뱃지를 새 쪽수로 다시 셉니다(lib/reading.js의 updateBook byTeacher) */}
      {teacher && recorded && <p className="reading-search-pages-help reading-teacher-edit-note">독서 기록이 있는 책이에요. 전체 쪽수를 바꾸면 {teacherFor}의 완독 · 경험치 · 뱃지를 새 쪽수로 다시 셈해요.{pagesFloor > 0 ? ` 독서 발자국이 ${number(pagesFloor)}쪽까지 있어 그보다 적게는 바꿀 수 없어요.` : ""}</p>}
      {pagesLocked && <p className="reading-help">독서 발자국이나 ‘한 권의 책’이 있는 책의 전체 쪽수는 고정돼요. 잘못 입력한 기록은 먼저 정정해 주세요.</p>}
      {activityPick && <label>함께할 독서 활동 <span className="reading-optional">선택</span><select value={form.activityId} onChange={(e) => change("activityId", e.target.value)} disabled={busy}><option value="">연결하지 않음</option>{form.activityId && !activities.some((a) => a.id === form.activityId) && <option value={form.activityId}>이전에 연결한 활동</option>}{activities.filter((a) => !a.deleted).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>}
      <p className="reading-help">{teacher
        ? `선생님이 고친 책 정보는 ${teacherFor}의 책꽂이에 곧바로 반영돼요. 읽기 상태(읽는 중 · 잠시 멈춤)는 학생이 정해요.`
        : "완독 여부는 읽은 페이지 기록으로 확인해요. 같은 책은 중복으로 등록할 수 없어요."}</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn-primary" disabled={busy || !form.title.trim() || !form.author.trim()}>{busy ? "저장 중…" : book ? "변경 저장" : "책꽂이에 담기"}</button></div>
    </form>
  </Modal>;
}

// 발자국을 저장한 뒤의 알림 — 한 번에 완독한 발자국이면 '한 권의 책'이 함께 남았는지 저장 결과(state)로 확인합니다
// (plan은 창이 저장 전에 고른 것 — lib/reading.js의 wholeBookReviewPlan).
function logSavedNotice(plan, state, bookId, editing) {
  const linked = (state?.reviews || []).some((r) => r?.bookId === bookId && r?.fromLogId);
  if (plan === "create" && linked) return "한 번에 끝까지 읽었어요! 완독으로 기록하고, 오늘의 감상을 ‘한 권의 책’에도 함께 남겼어요.";
  if (plan === "sync" && linked) return "독서 발자국을 고쳤어요. 함께 남긴 ‘한 권의 책’도 같은 내용으로 맞췄어요.";
  if (plan === "detach") return "독서 발자국을 고쳤어요. 함께 남긴 ‘한 권의 책’은 그대로 남고, 이제부터는 발자국과 따로예요.";
  return editing ? "독서 발자국을 고쳤어요." : "오늘의 독서를 기록했어요.";
}

// plaza — 책 광장을 켠 반의 학생: 이 발자국을 반 친구들이 함께 읽는다는 것을 쓰는 자리에서 알려 줍니다("shown").
// 학생이 고르는 칸은 없습니다(선생님 결정 — 광장을 켠 반에서는 모두 공개). 한때 선생님이 광장에서 내린 책이면 "blocked"로
// '나와 선생님만 봐요'를 띄웠는데, '광장에서 내리기'를 걷어 그 안내도 없습니다(선생님 요청 — 되살리지 마세요).
// petRead — 펫 먹이를 켠 반의 학생에게만: 저장해 둔 오늘의 발자국 합계 { pages, chars, need }(lib/petCare.js의 readingDayProof —
// need는 선생님이 관리자 설정에서 정한 기준 · 처음 값 5쪽 · 250자). 쓰는 동안 '오늘의 읽기 n쪽 · n자'를 보여 주어, 기준 이상이면
// 오늘은 펫의 배부름이 줄지 않는다는 것을 알립니다.
// reviews — 서재의 '한 권의 책' 목록. 한 번에 완독(1쪽~마지막 쪽 발자국 하나)이면 저장할 때 '한 권의 책'을 어떻게 하는지
// 안내하고(같은 감상으로 함께 남김 · 함께 남긴 글을 맞춤 · 걷음 — 선생님 요청), 새로 남길 때는 그 별점을 여기서 고릅니다.
// 고르는 셈은 저장하는 셈과 같은 lib/reading.js의 wholeBookReviewPlan입니다(둘이 어긋나지 않게).
function LogForm({ book, log, reviews = [], today, busy, plaza = null, petRead = null, onSave, onClose }) {
  const [form, setForm] = useState({ date: log?.date || today, startPage: log?.startPage || Math.min((book.currentPage || 0) + 1, book.totalPages), endPage: log?.endPage || "", notes: log?.notes || "" });
  const [rating, setRating] = useState(5);
  const change = (key, v) => setForm((p) => ({ ...p, [key]: v }));
  const pageRange = { startPage: Number(form.startPage), endPage: Number(form.endPage) };
  const wholePlan = wholeBookReviewPlan({ book, before: log || null, after: pageRange, reviews });
  const ownReview = reviews.some((r) => r?.bookId === book.id);
  // 펫 먹이 — 오늘의 읽기(저장해 둔 오늘 것 + 지금 쓰는 것). 고치는 중인 기록은 제 몫을 빼고 다시 더합니다.
  // 오늘 날짜의 발자국만 셉니다('읽은 날'은 그날 안에 남긴 기록으로 — lib/petCare.js 머리말).
  const mine = log && log.date === today ? { pages: log.endPage - log.startPage + 1, chars: String(log.notes ?? "").trim().length } : { pages: 0, chars: 0 };
  const range = Number(form.startPage) >= 1 && Number(form.endPage) >= Number(form.startPage) ? Number(form.endPage) - Number(form.startPage) + 1 : 0;
  const read = petRead && form.date === today
    ? { pages: Math.max(0, petRead.pages - mine.pages) + range, chars: Math.max(0, petRead.chars - mine.chars) + form.notes.trim().length } : null;
  const need = petRead?.need ?? null;
  const readOk = !!read && !!need && read.pages >= need.pages && read.chars >= need.chars;
  return <Modal title={log ? "독서 발자국 고쳐쓰기" : "오늘의 독서 발자국"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, startPage: Number(form.startPage), endPage: Number(form.endPage), notes: form.notes.trim(), ...(wholePlan === "create" ? { rating: Number(rating) } : {}) }, wholePlan); }}>
      <div className="reading-form-book"><BookIcon /><strong>{book.title}</strong><span>총 {number(book.totalPages)}쪽</span></div>
      <label>읽은 날짜<input data-initial-focus required type="date" max={today} value={form.date} onChange={(e) => change("date", e.target.value)} /></label>
      <div className="reading-form-row"><label>시작 쪽<input required type="number" min={1} max={book.totalPages} step={1} value={form.startPage} onChange={(e) => change("startPage", e.target.value)} inputMode="numeric" /></label><label>마지막 쪽<input required type="number" min={Math.max(1, Number(form.startPage) || 1)} max={book.totalPages} step={1} value={form.endPage} onChange={(e) => change("endPage", e.target.value)} inputMode="numeric" /></label></div>
      <label>오늘의 짧은 감상<textarea required maxLength={2000} rows={4} value={form.notes} onChange={(e) => change("notes", e.target.value)} placeholder="마음에 남은 장면이나 새롭게 떠오른 생각을 적어 보세요." /><span className="reading-field-count">{form.notes.length} / 2,000</span></label>
      {wholePlan === "create" && <div className="reading-whole-note" role="status">
        <p><strong>한 번에 끝까지 읽었어요!</strong> 저장하면 완독으로 기록되고, 오늘의 짧은 감상이 ‘한 권의 책’에도 같은 내용으로 남아요(‘한 권의 책’ 70 EXP도 함께).</p>
        <label>‘한 권의 책’ 별점<select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}점</option>)}</select></label>
      </div>}
      {wholePlan === "sync" && <p className="reading-whole-note" role="status">이 발자국과 함께 남긴 ‘한 권의 책’도 같은 내용으로 맞춰져요.</p>}
      {wholePlan === "detach" && <p className="reading-whole-note" role="status">끝까지 읽은 기록이 아니게 되어도 함께 남긴 ‘한 권의 책’은 그대로 남아요. 이제부터는 발자국과 따로예요.</p>}
      {wholePlan === null && !log && ownReview && coversWholeBook(pageRange, book) && <p className="reading-whole-note" role="status"><strong>한 번에 끝까지 읽었어요!</strong> 저장하면 완독으로 기록돼요. ‘한 권의 책’은 전에 써 둔 글 그대로예요.</p>}
      {petRead && (read
        ? <p className={`pet-read-note${readOk ? " is-ok" : ""}`}>🍊 오늘의 읽기 <b>{number(read.pages)}쪽</b> · <b>{number(read.chars)}자</b>{readOk
          ? " — 오늘은 ‘읽은 날’이에요. 펫의 배부름이 줄지 않아요 ✓"
          : ` — ${careReadLabel(need)} 이상이면 오늘은 펫의 배부름이 줄지 않아요.`}</p>
        : <p className="pet-read-note">🍊 오늘 날짜의 발자국만 펫의 ‘읽은 날’이 돼요.</p>)}
      {plaza === "shown" && <p className="plaza-note">이 발자국은 책 광장에서 반 친구들이 함께 읽어요.</p>}
      <p className="reading-help">1쪽당 1 EXP. 그날 5쪽 이상 읽으면 연속 독서일로 쳐서 하루 한 번 보너스(연속일 × 15, 7일째부터 105)를 받아요. 이미 기록한 페이지는 중복 적립하지 않아요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn-primary" disabled={busy || !form.notes.trim()}>{busy ? "저장 중…" : "독서 발자국 저장"}</button></div>
    </form>
  </Modal>;
}

// plaza — 책 광장을 켠 반의 학생: 이 글을 반 친구들이 함께 읽는다는 것을 알려 줍니다("shown").
// 한때 '광장 책꽂이에 꽂기'를 여기서 골랐습니다 — 걷었습니다(선생님 결정 — 모두 공개. 되살리지 마세요).
function ReviewForm({ book, review, busy, plaza = null, onSave, onClose }) {
  const [text, setText] = useState(review?.text || "");
  const [rating, setRating] = useState(review?.rating || 5);
  return <Modal title={review ? "한 권의 책 고쳐쓰기" : "한 권의 책"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ text: text.trim(), rating: Number(rating) }); }}>
      <div className="reading-form-book"><BookIcon /><strong>{book.title}</strong></div>
      <label>나의 별점<select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}점</option>)}</select></label>
      <label>읽고 남은 생각<textarea data-initial-focus required rows={8} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="이 책이 내게 남긴 것, 친구와 나누고 싶은 생각을 써 보세요." /><span className="reading-field-count">{text.length} / 5,000</span></label>
      {plaza === "shown" && <p className="plaza-note">이 글은 책 광장 책꽂이에서 반 친구들이 함께 읽고 댓글을 남길 수 있어요.</p>}
      {review?.fromLogId && <p className="reading-whole-note">한 번에 완독한 독서 발자국의 감상을 함께 남긴 글이에요. 고쳐 저장하면 그때부터 발자국과 따로 남아요.</p>}
      <p className="reading-help">다 읽은 책을 마무리하는 총평이에요. 서로 다른 책의 첫 ‘한 권의 책’에 70 EXP를 받아요. 고쳐 쓸 때는 중복 지급하지 않아요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>취소</button><button type="submit" className="btn-primary" disabled={busy || !text.trim()}>{busy ? "저장 중…" : "한 권의 책 저장"}</button></div>
    </form>
  </Modal>;
}

function BookDetail({ book, classId, readOnly = false, teacherEdit = false, activity, onOpenActivity, logs, review, busy, onClose, onEdit, onLog, onReview, onDeleteLog, onArchive, plaza = null, onOpenPlaza }) {
  const sorted = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const infoUrl = bookInfoUrl(book);
  // 책 광장 단추 둘 — 광장을 켠 반의 학생 본인 · 그 반에서 남긴 글이 광장에 올라가 있을 때만(plaza.entry), 실제 남긴 글에 맞게.
  // 한때 아래 '책 광장' 안내 상자(설명 · 댓글 수) 안에 있었는데, 상자를 걷고 위 단추 줄의 '보관함으로' 오른쪽으로 옮겼습니다
  // (선생님 요청 · 2026년 11월 — 네 단추가 같은 크기 한 줄). 반 친구들이 함께 읽는다는 안내는 쓰는 창(발자국 창 · 한 권의 책 창)에
  // 그대로 있습니다 — 빼지 마세요. 한때 '광장에 꽂기 · 발자국 보이기' 스위치 · 선생님의 '광장에서 내리기'도 있었습니다(되살리지 마세요).
  const onPlaza = !!(plaza?.entry && !readOnly && !book.archived);
  return <Modal title={book.title} wide busy={busy} onClose={onClose}>
    <div className="reading-detail-overview"><BookCover book={book} /><div className="reading-detail-meta"><span>{book.author}</span>{book.publisher && <span>{book.publisher}</span>}{book.isbn && <span>ISBN {book.isbn}</span>}<span>{number(book.pagesRead ?? book.currentPage)} / {number(book.totalPages)}쪽 읽음</span><span>{book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중"}</span>{infoUrl && <a href={infoUrl} target="_blank" rel="noopener noreferrer">도서 정보 보기 ↗</a>}</div></div>
    {/* [교사] 학생 책의 정보만 고칩니다 — 학생 화면과 같은 자리 · 같은 크기의 단추 하나(보관된 책은 학생처럼 고치지 않음) */}
    {readOnly && teacherEdit && !book.archived && <div className="reading-detail-tools"><button type="button" className="btn-ghost" disabled={busy} onClick={onEdit}>책 정보 고치기</button></div>}
    {!readOnly && <div className="reading-detail-tools"><button type="button" className="btn-ghost" disabled={busy} onClick={onEdit}>책 정보 고치기</button><button type="button" className="btn-ghost" disabled={busy} onClick={onArchive}>{book.archived ? "책꽂이로 복원" : "보관함으로"}</button>{onPlaza && plaza.hasLogs && <button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpenPlaza("stall")}>가판대에서 발자국 보기</button>}{onPlaza && plaza.hasReview && <button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpenPlaza("shelf")}>책꽂이에서 감상 보기</button>}</div>}
    {activity && onOpenActivity && !readOnly && <div className="reading-linked-activity"><div><span>함께 연결한 독서 활동</span><strong>{activity.title}</strong></div><button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpenActivity(activity)}>활동 열기 →</button></div>}
    <section className="reading-detail-section"><header><h3>한 권의 책</h3>{!book.archived && !readOnly && <div className="reading-detail-section-actions">{book.status === "completed" && !review && <button type="button" className="btn-ghost" disabled={busy} onClick={onReview}>한 권의 책</button>}<button type="button" className="btn-primary" disabled={busy} onClick={() => onLog(null)}>독서 발자국</button></div>}</header>{review ? <article className="reading-review"><p className="reading-review-rating">{readOnly ? "별점" : "나의 별점"} {review.rating} / 5</p><p>{review.text}</p>{review.fromLogId && <p className="reading-help reading-review-from">한 번에 완독한 독서 발자국의 감상을 함께 남긴 글이에요.{!readOnly && " ‘고쳐쓰기’로 고치면 그때부터 발자국과 따로 남아요."}</p>}{!readOnly && review.classId !== classId && <p className="reading-help">다른 반에서 작성한 ‘한 권의 책’이에요. 작성한 반에서 고쳐 쓸 수 있어요.</p>}{!readOnly && !book.archived && <button type="button" className="btn-ghost reading-review-edit" disabled={busy || review.classId !== classId} onClick={onReview}>고쳐쓰기</button>}</article> : readOnly ? <p className="reading-muted">아직 ‘한 권의 책’을 남기지 않았어요.</p> : <p className="reading-muted">{book.status === "completed" ? "다 읽은 책에 대한 나의 총평을 ‘한 권의 책’으로 남겨 보세요." : "책을 끝까지 읽으면 총평 ‘한 권의 책’을 쓸 수 있어요. 읽은 날마다 ‘독서 발자국’을 남겨 보세요."}</p>}</section>
    <section className="reading-detail-section"><header><h3>독서의 발자취 <small>{logs.length}</small></h3></header>{sorted.length ? <ol className="reading-log-list">{sorted.map((log) => <li key={log.id}><div className="reading-log-date"><strong>{shortDate(log.date)}</strong><span>{log.startPage}–{log.endPage}쪽 · {number(log.endPage - log.startPage + 1)}쪽</span></div><p>{log.notes}</p>{!readOnly && log.classId !== classId && <p className="reading-help">다른 반에서 작성한 기록 · 작성한 반에서만 수정 가능</p>}{!readOnly && <div className="reading-log-tools"><button type="button" className="reading-log-edit" disabled={busy || log.classId !== classId} onClick={() => onLog(log)}>고쳐쓰기</button><button type="button" className="reading-log-delete" disabled={busy || log.classId !== classId} onClick={() => onDeleteLog(log)}>삭제</button></div>}</li>)}</ol> : <p className="reading-muted">{readOnly ? "아직 독서 기록이 없어요." : "아직 독서 기록이 없어요. 첫 페이지의 생각부터 남겨 보세요."}</p>}</section>
  </Modal>;
}

function BadgeDetail({ badge, featured, busy, readOnly, onClose, onSelect }) {
  return <Modal title={`${badge.name} · ${tierName(badge.tier)}`} busy={busy} onClose={onClose}>
    <div className="reading-badge-preview">
      <span className="reading-preview-status">{badge.earned ? (featured ? "획득 · 대표 뱃지" : "획득한 뱃지") : "미획득 · 디자인 미리보기"}</span>
      <ReadingBadge badge={badge} size={144} earned={true} />
      <h3>{badge.label || `${badge.name} · ${tierName(badge.tier)}`}</h3>
      <p>{badge.description}</p>
      <span className="reading-preview-reward">달성 보상 ＋{badge.expReward} EXP</span>
      <div className="reading-preview-progress"><div className="reading-progress" role="progressbar" aria-label={`${badge.name} 달성 진행`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(badge.progress || 0))}><i style={{ width: `${Math.min(100, badge.progress || 0)}%` }} /></div><span>현재 {number(badge.current)} / {number(badge.threshold)}</span></div>
      {badge.earned ? <p className="reading-help">{badge.earnedAt ? `${shortDate(badge.earnedAt)} 달성` : "달성한 성취"}</p> : <p className="reading-help">앞으로 모을 뱃지의 모습을 미리 보는 화면이에요. 조건을 달성하면 내 컬렉션에 추가돼요.</p>}
    </div>
    <div className="reading-form-actions">
      {!readOnly && badge.earned && <button type="button" className="btn-primary" disabled={busy || featured} onClick={onSelect}>{featured ? "나의 대표 뱃지" : "대표 뱃지로 선택"}</button>}
      <button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>닫기</button>
    </div>
  </Modal>;
}

function Rankings({ classId, uid, isTeacher, onDisabled }) {
  const [period, setPeriod] = useState("weekly");
  const [rows, setRows] = useState([]);
  // 서버가 반 순위를 센 때 — '오후 6:30 기준'
  const [computedAt, setComputedAt] = useState(null);
  const [rowsKey, setRowsKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const disabledRef = useRef(onDisabled); disabledRef.current = onDisabled;
  // 한 번 받으면 네 기간의 경험치가 함께 옵니다(xpBy) — 기간 단추는 서버에 다시 묻지 않고 그 자리에서
  // 다시 세웁니다(lib/readingJourney.js의 rankingsForPeriod, 선생님 요청). 받는 때는 탭을 열 때 · 새로고침뿐입니다.
  // 서버는 순위를 10분에 한 번만 셉니다 — 그 안의 새로고침은 저장해 둔 순위를 그대로 받습니다.
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    Promise.resolve(fetchReadingRankings(classId)).then((result) => {
      if (!live) return;
      setRows(Array.isArray(result) ? result : result?.rankings || []);
      setComputedAt(Array.isArray(result) ? null : result?.computedAt ?? null);
      setRowsKey(classId);
    }).catch((e) => {
      if (!live) return;
      setError(e?.message || "순위를 불러오지 못했어요.");
      if (isDisabledError(e)) disabledRef.current?.();
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [classId, retry]);
  // 받아 둔 순위가 있으면 다시 받는 동안에도 표를 그대로 둡니다.
  const showLoading = loading && rowsKey !== classId;
  const ranked = useMemo(() => rowsKey === classId ? rankingsForPeriod(rows, period) : [], [rows, rowsKey, classId, period]);
  const mine = ranked.find((r) => (r.uid || r.userId) === uid) ?? null;
  const asOf = rowsKey === classId ? rankingAsOf(computedAt) : "";
  return <section className="reading-rankings"><div className="reading-section-head"><div><h3>우리 반의 독서 발자취</h3><p>각자의 속도로 쌓은 기록을 함께 응원해요.</p></div><button type="button" className="btn-ghost" disabled={loading} onClick={() => setRetry((v) => v + 1)}>새로고침</button></div>
    <div className="reading-filters" aria-label="랭킹 기간">{PERIODS.map(([key, label]) => <button key={key} type="button" className={period === key ? "active" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
    <p className="reading-help">한국 시간 기준 · 주간은 월요일 시작 · 같은 점수는 공동 순위 · 현재 반 학생만 표시{asOf ? ` · ${asOf} 기준(10분마다 새로 셈)` : ""}</p>
    {!isTeacher && mine && <div className="reading-my-rank"><span>이번 기간 나의 기록</span><strong>{mine.rank}위</strong><span>{number(mine.xp ?? mine.totalExp ?? mine.score)} EXP</span><span>Lv. {mine.level || 1}</span></div>}
    {showLoading ? <div className="reading-loading" role="status">우리 반 기록을 모으고 있어요.</div> : error ? <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setRetry((v) => v + 1)}>다시 시도</button></div> : !ranked.length ? <div className="reading-empty"><BookIcon size={40} /><h3>새로운 독서의 시작을 기다려요.</h3><p>우리 반 학생이 독서를 기록하면 이곳에서 함께 볼 수 있어요.</p></div> : <div className="reading-ranking-scroll"><table className="reading-ranking-table"><caption className="reading-sr-only">{PERIODS.find(([key]) => key === period)?.[1]} 우리 반 독서 랭킹</caption><thead><tr><th scope="col">순위</th><th scope="col">이름</th><th scope="col">레벨</th><th scope="col">경험치</th><th scope="col">대표 뱃지</th></tr></thead><tbody>{ranked.map((r) => <tr key={r.uid || r.userId} className={(r.uid || r.userId) === uid ? "is-me" : ""}><td><span className={`reading-rank-number${r.rank <= 3 ? " reading-rank-top" : ""}`}>{r.rank}</span></td><th scope="row">{displayName({ ...r, realName: r.realName || r.name || r.userName })}{(r.uid || r.userId) === uid && <span className="reading-me-label">나</span>}</th><td>Lv. {r.level || 1}</td><td className="reading-rank-exp">{number(r.xp ?? r.totalExp ?? r.score)}</td><td>{r.featuredBadge ? <RankBadge badge={r.featuredBadge} /> : <span className="reading-muted">—</span>}</td></tr>)}</tbody></table></div>}
  </section>;
}

function RankBadge({ badge }) {
  const definition = typeof badge === "string" ? READING_BADGES.find((b) => b.id === badge) : badge;
  if (!definition) return <span className="reading-muted">—</span>;
  return <span className="reading-rank-badge"><ReadingBadge badge={definition} size={42} /><span>{definition.label || definition.name}</span></span>;
}
