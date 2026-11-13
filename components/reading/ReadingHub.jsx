"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { deriveReading, initialReadingState, kstToday, READING_BADGES } from "@/lib/reading";
import { subscribeReadingState, mutateReading, fetchReadingRankings } from "@/lib/data/reading";
import { rankingAsOf, rankingsForPeriod } from "@/lib/readingJourney";
import { petGrowthOfSummary } from "@/lib/readingPet";
import ReadingBadge from "./ReadingBadge";
import BookSearch from "./BookSearch";
import { hasModalAbove } from "@/lib/modal";
import { PLAZA_STAGE_MIN_H, plazaRoom, plazaScroller } from "@/lib/plazaStageRoom";
import PetCard from "./PetCard";
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

// 선생님의 책 광장 — **반 전체의 자리**라 '고른 학생'의 책나눔(아래 ReadingHub) 밖에 따로 섭니다
// (TeacherReadingView의 '책 광장 들어가기'). 한때 선생님이 들어가는 길이 고른 학생 화면의 셋째 탭 하나뿐이라,
// 학생이 한 명도 없는 반에서는 탭 줄 자체가 없어 들어갈 길이 없었고(주소에 ?tab=plaza를 붙여도), 학생이 있는
// 반에서도 '○○의 독서 여정' 안에 섞여 입구로 보이지 않았습니다(선생님 신고). 틀의 클래스(.reading-hub--plaza)가
// 학생 화면과 같아 '광장 탭'의 CSS(머리말 · 명단 · 옆 패널 가리기)가 그대로 듣습니다. 선생님에게는 펫 · 곧바로 열 책이 없습니다.
export function TeacherPlaza({ classId, user, characterOn = true, classroom = null, onExit }) {
  return <section className="reading-hub reading-hub--plaza" aria-label="책 광장">
    <PlazaExitContext.Provider value={onExit}>
      <ReadingPlaza classId={classId} user={user} isTeacher characterOn={characterOn} petOn={false} growthXp={null} initialBook={null} onExit={onExit} classroom={classroom} />
    </PlazaExitContext.Provider>
  </section>;
}

const ReadingErrorContext = createContext("");
const TIER_NAMES = { 1: "초급", 2: "중급", 3: "고급", beginner: "초급", intermediate: "중급", advanced: "고급" };
const FILTERS = [["all", "전체"], ["reading", "읽는 중"], ["completed", "완독"], ["paused", "잠시 멈춤"], ["archived", "보관함"]];
const PERIODS = [["daily", "오늘"], ["weekly", "이번 주"], ["monthly", "이번 달"], ["all-time", "누적"]];
const number = (v) => Number(v || 0).toLocaleString("ko-KR");
const tierName = (v) => TIER_NAMES[v] || String(v ?? "");
const shortDate = (v) => String(v || "").slice(0, 10).replaceAll("-", ".");
const badgeTier = (b) => Number(b.tier) || ({ beginner: 1, intermediate: 2, advanced: 3 }[b.tier]) || 1;
const displayName = (u) => [u?.studentId, u?.realName || u?.name || "이름 미설정"].filter(Boolean).join(" ");

function BookIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5c-2-2-6-2-9-1v15c3-1 7-1 9 1m0-15c2-2 6-2 9-1v15c-3-1-7-1-9 1V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

function Modal({ title, onClose, children, wide = false, busy = false }) {
  const titleId = useId();
  const error = useContext(ReadingErrorContext);
  const ref = useRef(null);
  const backdropRef = useRef(null);
  // onClose는 부르는 쪽이 렌더마다 새로 만듭니다. 한때 아래 효과가 그것에 걸려 있어, 책나눔이 다시
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

// petOn — 관리자 설정의 '학생 펫'(lib/readingPet.js의 petEnabled). 학생 본인 화면에만 '나의 펫' 카드가 섭니다.
// plazaOn — 관리자 설정의 '책 광장'(lib/reading.js의 plazaOn). 켠 반은 셋째 탭이 '우리 반 랭킹' 대신 '책 광장'입니다.
// characterOn — 관리자 설정의 '학생 캐릭터'(끄면 광장에서도 기본 캐릭터).
// classroom — 교실(관리자 설정의 '교실' — 책 광장의 둘째 방)에 넘길 묶음. 책방 페이지가 만들어 그대로 무대에 건넵니다
//   (출석 · 자리표는 페이지가 이미 받아 둔 것 — ReadingPlaza.jsx 머리의 설명).
export default function ReadingHub({ classId, user, isTeacher = false, bookSearchOn = false, petOn = false, plazaOn = false, characterOn = true, onDisabled, activities = [], onOpenActivity, initialBookId = null, initialTab = "library", student = null, classroom = null }) {
  // student가 있으면 교사가 그 학생의 책나눔을 보는 읽기 전용 화면입니다(선생님 결정 — 감상·발자국까지 전부 보임).
  const readOnly = !!student?.uid;
  const viewUid = readOnly ? student.uid : user?.uid;
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // '우리 반 랭킹' 탭은 책나눔이 켜져 있으면 늘 섭니다 — 관리자 설정의 '리더보드'를 꺼도 그대로(선생님 요청:
  // 순위 셈은 책나눔과 함께 늘 돌고, 리더보드 스위치는 상단바 리더보드 화면 · 독서 TOP 3만 켜고 끔).
  // 책 광장을 켠 반은 그 자리에 '책 광장'이 섭니다(선생님 요청 — 순위는 상단바 리더보드에서 봄). 끈 반은 지금처럼 '우리 반 랭킹'.
  const thirdTab = plazaOn ? "plaza" : "ranking";
  const [tab, setTab] = useState(() => (initialTab === "plaza" || initialTab === "ranking" ? thirdTab : ["library", "growth"].includes(initialTab) ? initialTab : "library"));
  // 선생님이 설정을 바꿔 셋째 탭이 달라지면(광장 ↔ 랭킹) 보던 탭도 따라갑니다.
  useEffect(() => { setTab((current) => (current === "plaza" || current === "ranking" ? thirdTab : current)); }, [thirdTab]);
  // 책꽂이(첫 탭)에서 '광장에서 보기'로 넘어갈 때 곧바로 열 책({ uid, bookId, place, key })
  const [plazaJump, setPlazaJump] = useState(null);
  // 내 광장 목록 한 장 — 선생님이 내린 책 · 내 책에 달린 댓글 수(학생 본인 화면 · 광장을 켠 반에서만, 읽기 1)
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
  const previousLevel = useRef(null);
  // 펫 축하가 함께 알린 레벨 — 같은 저장에서 펫이 자라며 레벨도 오르면 폭죽 한 번에 함께 알리므로
  // 알림 줄은 같은 말을 또 띄우지 않습니다. 펫 카드(자식)의 효과가 아래 효과보다 먼저 돌아 여기에 적습니다.
  const petLevelRef = useRef(null);
  const markPetLevel = useCallback((lv) => { petLevelRef.current = lv; }, []);
  useEffect(() => {
    if (!raw) return;
    const petTold = petLevelRef.current === stats.level;
    petLevelRef.current = null;
    if (!readOnly && !petTold && previousLevel.current != null && stats.level > previousLevel.current) setNotice(`레벨 ${stats.level} 달성! 독서의 깊이가 한 단계 더 자랐어요.`);
    previousLevel.current = stats.level;
  }, [raw, stats.level, readOnly]);
  useEffect(() => { previousLevel.current = null; }, [classId, viewUid]);

  async function run(action, success = "저장했어요.") {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const result = await mutateReading(classId, action);
      if (result?.state) setRaw(result.state);
      else if (Array.isArray(result?.books) && Array.isArray(result?.logs)) setRaw(result);
      if (success) setNotice(success);
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
  const featured = (stats.badges || []).find((b) => b.id === (stats.featuredBadge?.id || stats.featuredBadge));
  const showPet = petOn && !readOnly && !isTeacher && !!user?.uid;
  // 광장에서 나가기(맵 위의 '나가기') — 첫 탭(책꽂이)으로 돌아갑니다. 광장 탭에서는 책방 머리말과 탭 줄을 가리므로
  // (plaza.css의 '광장 탭') 나가는 길은 이 단추입니다. 나온 뒤에는 초점을 그 탭에 둡니다 — 광장이 사라지며 초점이 길을 잃지 않게.
  const tabsRef = useRef(null);
  const leavePlaza = useCallback(() => {
    setTab("library");
    setDialog(null);
    setError("");
    setPlazaJump(null);
    requestAnimationFrame(() => tabsRef.current?.querySelector("button")?.focus({ preventScroll: true }));
  }, []);
  // 책 광장 — 이 책이 지금 광장에 어떻게 올라가 있는지(책 상세 창)
  const plazaInfo = (bookId) => ({
    blocked: Array.isArray(myShelf?.blocked) && myShelf.blocked.includes(bookId),
    comments: Math.max(0, Number(myShelf?.counts?.[bookId]) || 0),
    entry: (Array.isArray(myShelf?.books) ? myShelf.books : []).find((b) => b?.id === bookId) ?? null,
  });

  return <ReadingErrorContext.Provider value={error}><section className={`reading-hub${tab === "plaza" ? " reading-hub--plaza" : ""}`} aria-label="책나눔 성장 기능" aria-busy={loading || busy}>
    <div className="reading-intro">
      {readOnly ? <div><p className="reading-eyebrow">READING JOURNEY</p><h2>{student.name || "학생"}의 독서 여정</h2><p>학생이 남긴 책꽂이 · 독서 발자국 · 한 권의 책을 읽기만 합니다.</p></div> : <div><p className="reading-eyebrow">MY READING JOURNEY</p><h2>한 페이지씩, 나의 가능성을 넓히다.</h2><p>읽은 순간을 기록하고 나만의 독서 컬렉션을 완성해 보세요.</p></div>}
      {(featured?.earned || showPet) && <div className="reading-intro-side">
        {featured?.earned && <div className="reading-featured"><ReadingBadge badge={featured} size={70} /><span>{readOnly ? "대표 뱃지" : "나의 대표 뱃지"}<strong>{featured.name}</strong></span></div>}
        {/* 나의 펫 — 단계는 이미 받은 서재로 셉니다(lib/readingPet.js). 서재를 받기 전에는 카드도 기다립니다. */}
        {showPet && <PetCard classId={classId} uid={user.uid} growthXp={raw ? petGrowthOfSummary(stats) : null} level={raw ? stats.level : null} onLevelCheer={markPetLevel} />}
      </div>}
    </div>
    <nav className="reading-tabs" aria-label="책나눔 메뉴" ref={tabsRef}>
      {[["library", "책꽂이"], ["growth", "성장·뱃지"], [thirdTab, plazaOn ? "책 광장" : "우리 반 랭킹"]].map(([key, label]) => <button type="button" key={key} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => { setTab(key); setDialog(null); setError(""); setPlazaJump(null); }}>{label}</button>)}
    </nav>
    {error && !dialog && !confirm && <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="오류 안내 닫기">×</button></div>}
    {notice && <div className="reading-notice" role="status">{notice}</div>}
    {/* 책 광장은 서재(정본)를 기다리지 않습니다 — 반의 공유 사본을 제 손으로 구독합니다. 펫의 단계만 서재에서 받습니다. */}
    {tab === "plaza" ? <PlazaExitContext.Provider value={leavePlaza}><ReadingPlaza key={plazaJump?.key ?? "plaza"} classId={classId} user={user} isTeacher={isTeacher} characterOn={characterOn} petOn={showPet} growthXp={raw ? petGrowthOfSummary(stats) : null} initialBook={plazaJump} onExit={leavePlaza} classroom={classroom} /></PlazaExitContext.Provider>
    : loading ? <div className="reading-loading" role="status"><span className="reading-loader" />독서 기록을 불러오고 있어요.</div> : !raw ? <div className="reading-empty"><BookIcon size={40} /><h3>독서 정보를 불러오지 못했어요.</h3><button type="button" className="btn-primary" onClick={() => setRevision((r) => r + 1)}>다시 불러오기</button></div> : <>
      <div className="reading-summary">
        <div className="reading-level"><span>독서 레벨</span><strong><small>Lv.</small>{stats.level}</strong><div className="reading-progress" role="progressbar" aria-label={stats.maxLevel ? "최고 레벨" : "다음 레벨까지"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.progress || 0)}><i style={{ width: `${stats.progress || 0}%` }} /></div><span>{stats.maxLevel ? `${number(stats.xp)} EXP · 최고 레벨` : `${number(stats.xp)} / ${number(stats.nextXp)} EXP`}</span></div>
        <div><span>누적 독서량</span><strong>{number(stats.totalPages)}<small>쪽</small></strong><span>기록한 페이지가 경험치로</span></div>
        <div><span>완독한 책</span><strong>{number(stats.totalBooks)}<small>권</small></strong><span>다음 목표는 3권, 그리고 5권</span></div>
        <div><span>지금 이어가는 독서</span><strong>{number(stats.currentStreak)}<small>일</small></strong><span>최장 {number(stats.longestStreak)}일 연속</span></div>
      </div>
      {tab === "library" && <>
        <div className="reading-section-head"><div><h3>책꽂이 <span>{books.filter((b) => !b.archived).length}</span></h3><p>책의 마지막 페이지까지, 나의 속도로.</p></div>{!readOnly && <button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>＋ 책 등록</button>}</div>
        <div className="reading-filters" aria-label="도서 상태 필터">{FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
        {visibleBooks.length ? <div className="reading-library-grid">{visibleBooks.map((b, i) => <BookCard key={b.id} book={b} index={i} busy={busy} readOnly={readOnly} onOpen={() => setDialog({ type: "detail", bookId: b.id })} onReview={() => setDialog({ type: "review", bookId: b.id })} onLog={() => setDialog({ type: "log", bookId: b.id })} onRestore={() => run({ type: "archiveBook", bookId: b.id, archived: false }, "책을 책꽂이로 돌려놓았어요.")} />)}</div> : <div className="reading-empty"><BookIcon size={44} /><h3>{readOnly ? "아직 이곳에 놓인 책이 없어요." : filter === "all" ? "나의 첫 책을 기다리고 있어요." : "아직 이곳에 놓인 책이 없어요."}</h3>{!readOnly && <p>{filter === "all" ? "읽고 싶은 책을 등록하고 오늘 읽은 순간을 남겨 보세요." : "책을 읽고 기록하면 책꽂이의 풍경도 달라져요."}</p>}{filter === "all" && !readOnly && <button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>첫 책 등록하기</button>}</div>}
      </>}
      {tab === "growth" && <Growth stats={stats} busy={busy} readOnly={readOnly} onSelect={(badgeId) => run({ type: "setFeaturedBadge", badgeId }, "대표 뱃지를 바꿨어요.")} />}
      {/* 순위는 탭을 열 때 · 기간을 바꿀 때 · 새로고침을 누를 때만 받습니다(한 번에 반 전체를 읽음).
          한때 독서 자료 전체(raw)를 신호로 넘겨, 상태를 다시 물을 때마다(10초) 순위를 다시 받았습니다 —
          저장은 다른 탭에서만 하므로, 저장한 뒤 이 탭을 열면 새로 받습니다. */}
      {tab === "ranking" && <Rankings key={classId} classId={classId} uid={viewUid} isTeacher={isTeacher} onDisabled={onDisabled} />}
    </>}

    {dialog?.type === "book" && <BookForm key={selected?.id || "new"} book={selected} searchOn={bookSearchOn} pagesLocked={!!selected && [...(raw?.logs || []), ...(raw?.reviews || [])].some((r) => r.bookId === selected.id)} activities={activities} busy={busy} onClose={() => setDialog(null)} onSave={async (values) => { const ok = await run({ type: selected ? "updateBook" : "addBook", ...(selected ? { bookId: selected.id } : {}), ...values }, selected ? "책 정보를 고쳤어요." : "새 책을 책꽂이에 놓았어요."); if (ok) setDialog(null); }} />}
    {dialog?.type === "detail" && selected && <BookDetail book={selected} classId={classId} readOnly={readOnly} activity={activities.find((a) => a.id === selected.activityId)} onOpenActivity={onOpenActivity} logs={(stats.logs || raw?.logs || []).filter((l) => l.bookId === selected.id)} review={(stats.reviews || raw?.reviews || []).find((r) => r.bookId === selected.id)} busy={busy} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: "book", bookId: selected.id })} onLog={(log) => setDialog({ type: "log", bookId: selected.id, log })} onReview={() => setDialog({ type: "review", bookId: selected.id })} onDeleteLog={(log) => ask("이 독서 기록을 삭제할까요? 경험치와 달성 기록도 다시 계산해요.", { type: "deleteLog", logId: log.id })} onDeleteReview={() => ask("이 ‘한 권의 책’을 삭제할까요? 받은 보상도 함께 정정해요.", { type: "deleteReview", bookId: selected.id })} onArchive={() => ask(selected.archived ? "이 책을 책꽂이로 돌려놓을까요?" : "이 책을 보관함으로 옮길까요? 독서 기록은 그대로 남아요.", { type: "archiveBook", bookId: selected.id, archived: !selected.archived })}
      plaza={ownPlaza ? plazaInfo(selected.id) : null}
      onPlazaHide={(hidden) => run({ type: "setBookPlaza", bookId: selected.id, hidden }, hidden ? "이 책의 독서 발자국을 광장에서 내렸어요." : "이 책의 독서 발자국을 광장에 보이게 했어요.")}
      onShelve={(shelved) => run({ type: "shelveReview", bookId: selected.id, shelved }, shelved ? "광장 책꽂이에 꽂았어요." : "광장 책꽂이에서 뺐어요.")}
      onOpenPlaza={(place) => { setDialog(null); setError(""); setPlazaJump({ uid: viewUid, bookId: selected.id, place, key: `jump-${Date.now()}` }); setTab("plaza"); }} />}
    {dialog?.type === "log" && selected && <LogForm key={dialog.log?.id || selected.id} book={selected} log={dialog.log} today={day} busy={busy} plaza={ownPlaza ? (plazaInfo(selected.id).blocked ? "blocked" : selected.plazaHidden ? "hidden" : "shown") : null} onClose={() => setDialog({ type: "detail", bookId: selected.id })} onSave={async (values) => { const ok = await run({ type: dialog.log ? "updateLog" : "addLog", bookId: selected.id, ...(dialog.log ? { logId: dialog.log.id } : {}), ...values }, "오늘의 독서를 기록했어요."); if (ok) setDialog({ type: "detail", bookId: selected.id }); }} />}
    {dialog?.type === "review" && selected && <ReviewForm key={selected.id} book={selected} review={(stats.reviews || raw?.reviews || []).find((r) => r.bookId === selected.id)} busy={busy} plaza={ownPlaza && selected.status === "completed" && !plazaInfo(selected.id).blocked} onClose={() => setDialog({ type: "detail", bookId: selected.id })} onSave={async (values) => { const ok = await run({ type: "saveReview", bookId: selected.id, ...values }, "책을 읽고 남긴 생각을 저장했어요."); if (ok) setDialog({ type: "detail", bookId: selected.id }); }} />}
    {confirm && <Modal title="기록 확인" busy={busy} onClose={() => setConfirm(null)}><p className="reading-confirm-copy">{confirm.title}</p><div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>취소</button><button type="button" className="reading-danger-button" disabled={busy} onClick={async () => { if (await run(confirm.action, "기록을 정리했어요.")) setConfirm(null); }}>{busy ? "처리 중…" : "확인"}</button></div></Modal>}
  </section></ReadingErrorContext.Provider>;
}

function isDisabledError(e) {
  return ["reading-disabled", "reading/disabled", "disabled_feature", "READING_DISABLED"].includes(e?.code) || (e?.status === 403 && /비활성|사용.*중지|사용.*꺼/.test(e.message || ""));
}

// 카드 아래 단추 셋 — 기록 살펴보기 · 한 권의 책(완독했을 때만, 가운데) · 독서 발자국.
// 같은 크기 세 칸으로 못 박아(빈 가운데 칸 포함) 카드마다 단추 자리가 같습니다(선생님 요청).
function BookCard({ book, index, busy, readOnly = false, onOpen, onLog, onReview, onRestore }) {
  const status = book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중";
  return <article className={`reading-book-card reading-book-color-${index % 4}`}>
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
          {book.status === "completed" && <img className="reading-completion-badge" src="/reading-badges/book-completion.webp" alt="완독 축하 배지" width={50} height={50} />}
        </div>
        <div className="reading-progress"><i style={{ width: `${book.progress || 0}%` }} /></div>
        <span className="reading-book-percent">{Math.round(book.progress || 0)}% 읽었어요</span>
      </div>
    </button>
    <div className="reading-book-actions">{readOnly ? <button type="button" className="btn-ghost" onClick={onOpen}>기록 살펴보기</button> : <><button type="button" className="btn-ghost" onClick={onOpen}>기록 살펴보기</button>{book.status === "completed" && !book.archived ? <button type="button" className="reading-small-review" disabled={busy} onClick={onReview}>한 권의 책</button> : <span aria-hidden="true" />}<button type="button" className="reading-small-primary" disabled={busy} onClick={book.archived ? onRestore : onLog}>{book.archived ? "책꽂이로 복원" : "독서 발자국"}</button></>}</div>
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
function BookForm({ book, searchOn = false, pagesLocked, activities, busy, onSave, onClose }) {
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ title: book?.title || "", author: book?.author || "", totalPages: book?.totalPages || "", status: book?.status === "paused" ? "paused" : "reading", activityId: book?.activityId || "", publisher: book?.publisher || "", isbn: book?.isbn || "", coverImage: book?.coverImage || "", bookLink: book?.bookLink || "" });
  const [selectedSearch, setSelectedSearch] = useState(false);
  const titleRef = useRef(null);
  const pagesRef = useRef(null);
  const hasMetadata = !!(form.publisher || form.isbn || form.coverImage || form.bookLink);
  function change(key, value) {
    if (key === "title" || key === "author") {
      setSelectedSearch(false);
      setForm((p) => ({ ...p, [key]: value, publisher: "", isbn: "", coverImage: "", bookLink: "" }));
    } else setForm((p) => ({ ...p, [key]: value }));
  }
  function selectSearch(result) {
    setForm((p) => ({ ...p, title: result.title || "", author: result.author || "", totalPages: "",
      publisher: result.publisher || "", isbn: result.isbn || "", coverImage: result.coverImage || "", bookLink: result.link || "" }));
    setSelectedSearch(true);
    requestAnimationFrame(() => pagesRef.current?.focus());
  }
  return <Modal title={book ? "책 정보 고치기" : "새 책 등록"} onClose={onClose} busy={busy}>
    {!book && searchOn && (searching
      ? <BookSearch busy={busy} autoFocus onSelect={(r) => { selectSearch(r); setSearching(false); }} onManual={() => { setSearching(false); requestAnimationFrame(() => titleRef.current?.focus()); }} />
      : <button type="button" className="reading-search-open" disabled={busy} onClick={() => setSearching(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          도서 검색으로 책 정보 채우기
        </button>)}
    {hasMetadata && <div className="reading-selected-book">
      <BookCover book={form} />
      <div><strong>{selectedSearch ? "검색에서 선택한 책" : "도서 정보"}</strong>{form.publisher && <span>{form.publisher}</span>}{form.isbn && <span>ISBN {form.isbn}</span>}
        <button type="button" className="reading-search-manual" disabled={busy} onClick={() => { setForm((p) => ({ ...p, publisher: "", isbn: "", coverImage: "", bookLink: "" })); setSelectedSearch(false); }}>검색 정보 해제</button>
      </div>
    </div>}
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, title: form.title.trim(), author: form.author.trim(), totalPages: Number(form.totalPages) }); }}>
      <label>책 제목<input ref={titleRef} data-initial-focus={book ? true : undefined} required maxLength={150} value={form.title} onChange={(e) => change("title", e.target.value)} placeholder="책 제목을 적어 주세요" disabled={busy} /></label>
      <label>지은이<input required maxLength={100} value={form.author} onChange={(e) => change("author", e.target.value)} placeholder="저자 이름" disabled={busy} /></label>
      <div className="reading-form-row"><label>전체 쪽수<input ref={pagesRef} required type="number" min={1} max={100000} step={1} disabled={pagesLocked || busy} value={form.totalPages} onChange={(e) => change("totalPages", e.target.value)} inputMode="numeric" /></label>{book && <label>읽기 상태<select value={form.status} onChange={(e) => change("status", e.target.value)} disabled={busy}><option value="reading">읽는 중</option><option value="paused">잠시 멈춤</option></select></label>}</div>
      {selectedSearch && <p className="reading-search-pages-help" role="status">검색 결과에 쪽수가 없어 직접 입력해 주세요.</p>}
      {pagesLocked && <p className="reading-help">독서 발자국이나 ‘한 권의 책’이 있는 책의 전체 쪽수는 고정돼요. 잘못 입력한 기록은 먼저 정정해 주세요.</p>}
      <label>함께할 독서 활동 <span className="reading-optional">선택</span><select value={form.activityId} onChange={(e) => change("activityId", e.target.value)} disabled={busy}><option value="">연결하지 않음</option>{form.activityId && !activities.some((a) => a.id === form.activityId) && <option value={form.activityId}>이전에 연결한 활동</option>}{activities.filter((a) => !a.deleted).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
      <p className="reading-help">완독 여부는 읽은 페이지 기록으로 확인해요. 같은 책은 중복으로 등록할 수 없어요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn-primary" disabled={busy || !form.title.trim() || !form.author.trim()}>{busy ? "저장 중…" : book ? "변경 저장" : "책꽂이에 담기"}</button></div>
    </form>
  </Modal>;
}

// plaza — 책 광장을 켠 반의 학생: 이 발자국이 반 친구에게 보이는지 알려 줍니다("shown" · "hidden" · "blocked").
function LogForm({ book, log, today, busy, plaza = null, onSave, onClose }) {
  const [form, setForm] = useState({ date: log?.date || today, startPage: log?.startPage || Math.min((book.currentPage || 0) + 1, book.totalPages), endPage: log?.endPage || "", notes: log?.notes || "" });
  const change = (key, v) => setForm((p) => ({ ...p, [key]: v }));
  return <Modal title={log ? "독서 발자국 고치기" : "오늘의 독서 발자국"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, startPage: Number(form.startPage), endPage: Number(form.endPage), notes: form.notes.trim() }); }}>
      <div className="reading-form-book"><BookIcon /><strong>{book.title}</strong><span>총 {number(book.totalPages)}쪽</span></div>
      <label>읽은 날짜<input data-initial-focus required type="date" max={today} value={form.date} onChange={(e) => change("date", e.target.value)} /></label>
      <div className="reading-form-row"><label>시작 쪽<input required type="number" min={1} max={book.totalPages} step={1} value={form.startPage} onChange={(e) => change("startPage", e.target.value)} inputMode="numeric" /></label><label>마지막 쪽<input required type="number" min={Math.max(1, Number(form.startPage) || 1)} max={book.totalPages} step={1} value={form.endPage} onChange={(e) => change("endPage", e.target.value)} inputMode="numeric" /></label></div>
      <label>오늘의 짧은 감상<textarea required maxLength={2000} rows={4} value={form.notes} onChange={(e) => change("notes", e.target.value)} placeholder="마음에 남은 장면이나 새롭게 떠오른 생각을 적어 보세요." /><span className="reading-field-count">{form.notes.length} / 2,000</span></label>
      {plaza === "shown" && <p className="plaza-note">이 발자국은 책 광장 가판대에서 반 친구들이 함께 읽어요.</p>}
      {plaza === "hidden" && <p className="plaza-note plaza-note--off">이 책은 광장에 보이지 않게 해 두어, 이 발자국은 나와 선생님만 봐요.</p>}
      {plaza === "blocked" && <p className="plaza-note plaza-note--off">선생님이 이 책을 광장에서 내려, 이 발자국은 나와 선생님만 봐요.</p>}
      <p className="reading-help">1쪽당 1 EXP. 그날 5쪽 이상 읽으면 연속 독서일로 쳐서 하루 한 번 보너스(연속일 × 15, 7일째부터 105)를 받아요. 이미 기록한 페이지는 중복 적립하지 않아요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn-primary" disabled={busy || !form.notes.trim()}>{busy ? "저장 중…" : "독서 발자국 저장"}</button></div>
    </form>
  </Modal>;
}

// plaza — 책 광장을 켠 반에서 완독한 책이면 '광장 책꽂이에 꽂기'를 함께 고릅니다(기본은 안 꽂음 — 학생이 고름).
function ReviewForm({ book, review, busy, plaza = false, onSave, onClose }) {
  const [text, setText] = useState(review?.text || "");
  const [rating, setRating] = useState(review?.rating || 5);
  const [shelved, setShelved] = useState(review?.shelved === true);
  return <Modal title={review ? "한 권의 책 고치기" : "한 권의 책"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ text: text.trim(), rating: Number(rating), ...(plaza ? { shelved } : {}) }); }}>
      <div className="reading-form-book"><BookIcon /><strong>{book.title}</strong></div>
      <label>나의 별점<select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}점</option>)}</select></label>
      <label>읽고 남은 생각<textarea data-initial-focus required rows={8} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="이 책이 내게 남긴 것, 친구와 나누고 싶은 생각을 써 보세요." /><span className="reading-field-count">{text.length} / 5,000</span></label>
      {plaza && <label className="plaza-check"><input type="checkbox" checked={shelved} onChange={(e) => setShelved(e.target.checked)} />광장 책꽂이에 꽂기 — 반 친구들이 이 글을 읽고 댓글을 남길 수 있어요.</label>}
      <p className="reading-help">다 읽은 책을 마무리하는 총평이에요. 서로 다른 책의 첫 ‘한 권의 책’에 70 EXP를 받아요. 고쳐 쓸 때는 중복 지급하지 않아요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>취소</button><button type="submit" className="btn-primary" disabled={busy || !text.trim()}>{busy ? "저장 중…" : "한 권의 책 저장"}</button></div>
    </form>
  </Modal>;
}

// 책 광장 — 이 책을 반 친구들과 어떻게 나누는지(책 상세 창 · 광장을 켠 반의 학생 본인에게만).
//   · 발자국 보이기(기본 켜짐) — 끄면 이 책의 독서 발자국이 광장에 안 보입니다.
//   · 책꽂이에 꽂기(완독한 책 · 기본 꺼짐) — '한 권의 책'을 쓴 뒤에 꽂습니다.
// info — { blocked(선생님이 내림), comments(달린 댓글 수), entry(지금 광장에 올라가 있는 모습) }
function PlazaOwn({ book, review, classId, info, busy, onHide, onShelve, onOpen }) {
  if (info.blocked) return <div className="plaza-own"><div className="plaza-own-text"><strong>책 광장</strong><span>선생님이 이 책을 광장에서 내렸어요. 이 책의 글은 나와 선생님만 봐요.</span></div></div>;
  const completed = book.status === "completed";
  const otherClass = !!review && review.classId !== classId;
  const text = completed
    ? (!review ? "‘한 권의 책’을 쓰면 광장 책꽂이에 꽂을 수 있어요."
      : review.shelved ? "이 책의 ‘한 권의 책’이 광장 책꽂이에 꽂혀 있어요. 반 친구들이 읽고 댓글을 남길 수 있어요."
        : "‘광장 책꽂이에 꽂기’를 켜면 반 친구들이 광장에서 이 책의 ‘한 권의 책’을 읽을 수 있어요.")
    : (book.plazaHidden ? "이 책의 독서 발자국은 광장에 보이지 않아요. 나와 선생님만 봐요."
      : "이 책에 남기는 독서 발자국을 반 친구들이 광장 가판대에서 함께 읽어요(광장이 열린 뒤에 쓴 발자국부터).");
  return <div className="plaza-own">
    <div className="plaza-own-text"><strong>책 광장</strong><span>{text}</span></div>
    <div className="plaza-own-actions">
      {completed && <button type="button" role="switch" aria-checked={review?.shelved === true} className="plaza-switch" disabled={busy || !review || otherClass} onClick={() => onShelve(review?.shelved !== true)}><i aria-hidden="true" />광장 책꽂이에 꽂기</button>}
      {(!completed || review?.shelved === true) && <button type="button" role="switch" aria-checked={book.plazaHidden !== true} className="plaza-switch" disabled={busy} onClick={() => onHide(book.plazaHidden !== true)}><i aria-hidden="true" />발자국 보이기</button>}
      {info.entry && <button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpen(info.entry.place)}>광장에서 보기{info.comments ? ` · 댓글 ${number(info.comments)}` : ""}</button>}
    </div>
  </div>;
}

function BookDetail({ book, classId, readOnly = false, activity, onOpenActivity, logs, review, busy, onClose, onEdit, onLog, onReview, onDeleteLog, onDeleteReview, onArchive, plaza = null, onPlazaHide, onShelve, onOpenPlaza }) {
  const sorted = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  return <Modal title={book.title} wide busy={busy} onClose={onClose}>
    <div className="reading-detail-overview"><BookCover book={book} /><div className="reading-detail-meta"><span>{book.author}</span>{book.publisher && <span>{book.publisher}</span>}{book.isbn && <span>ISBN {book.isbn}</span>}<span>{number(book.pagesRead ?? book.currentPage)} / {number(book.totalPages)}쪽 읽음</span><span>{book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중"}</span>{book.bookLink && <a href={book.bookLink} target="_blank" rel="noopener noreferrer">도서 정보 보기 ↗</a>}</div></div>
    {!readOnly && <div className="reading-detail-tools"><button type="button" className="btn-ghost" disabled={busy} onClick={onEdit}>책 정보 고치기</button><button type="button" className="btn-ghost" disabled={busy} onClick={onArchive}>{book.archived ? "책꽂이로 복원" : "보관함으로"}</button></div>}
    {activity && onOpenActivity && !readOnly && <div className="reading-linked-activity"><div><span>함께 연결한 독서 활동</span><strong>{activity.title}</strong></div><button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpenActivity(activity)}>활동 열기 →</button></div>}
    {plaza && !readOnly && !book.archived && <PlazaOwn book={book} review={review} classId={classId} info={plaza} busy={busy} onHide={onPlazaHide} onShelve={onShelve} onOpen={onOpenPlaza} />}
    <section className="reading-detail-section"><header><h3>한 권의 책</h3>{!book.archived && !readOnly && <div className="reading-detail-section-actions">{book.status === "completed" && <button type="button" className="btn-ghost" disabled={busy || (review && review.classId !== classId)} onClick={onReview}>{review ? "한 권의 책 고치기" : "한 권의 책"}</button>}<button type="button" className="btn-primary" disabled={busy} onClick={() => onLog(null)}>독서 발자국</button></div>}</header>{review ? <article className="reading-review"><p className="reading-review-rating">{readOnly ? "별점" : "나의 별점"} {review.rating} / 5</p><p>{review.text}</p>{!readOnly && review.classId !== classId && <p className="reading-help">다른 반에서 작성한 ‘한 권의 책’이에요. 작성한 반에서 고치거나 삭제할 수 있어요.</p>}{!readOnly && <button type="button" className="reading-text-danger" disabled={busy || review.classId !== classId} onClick={onDeleteReview}>한 권의 책 삭제</button>}</article> : readOnly ? <p className="reading-muted">아직 ‘한 권의 책’을 남기지 않았어요.</p> : <p className="reading-muted">{book.status === "completed" ? "다 읽은 책에 대한 나의 총평을 ‘한 권의 책’으로 남겨 보세요." : "책을 끝까지 읽으면 총평 ‘한 권의 책’을 쓸 수 있어요. 읽은 날마다 ‘독서 발자국’을 남겨 보세요."}</p>}</section>
    <section className="reading-detail-section"><header><h3>독서의 발자취 <small>{logs.length}</small></h3></header>{sorted.length ? <ol className="reading-log-list">{sorted.map((log) => <li key={log.id}><div className="reading-log-date"><strong>{shortDate(log.date)}</strong><span>{log.startPage}–{log.endPage}쪽 · {number(log.endPage - log.startPage + 1)}쪽</span></div><p>{log.notes}</p>{!readOnly && log.classId !== classId && <p className="reading-help">다른 반에서 작성한 기록 · 작성한 반에서만 수정 가능</p>}{!readOnly && <div className="reading-log-tools"><button type="button" className="btn-ghost" disabled={busy || log.classId !== classId} onClick={() => onLog(log)}>고치기</button><button type="button" className="reading-text-danger" disabled={busy || log.classId !== classId} onClick={() => onDeleteLog(log)}>삭제</button></div>}</li>)}</ol> : <p className="reading-muted">{readOnly ? "아직 독서 기록이 없어요." : "아직 독서 기록이 없어요. 첫 페이지의 생각부터 남겨 보세요."}</p>}</section>
  </Modal>;
}

function Growth({ stats, busy, readOnly = false, onSelect }) {
  const [preview, setPreview] = useState(null);
  const series = useMemo(() => {
    const grouped = new Map();
    for (const badge of stats.badges || []) { const group = grouped.get(badge.series) || []; group.push(badge); grouped.set(badge.series, group); }
    return [...grouped.entries()].map(([key, badges]) => ({ key, badges: badges.sort((a, b) => badgeTier(a) - badgeTier(b)) }));
  }, [stats.badges]);
  const earned = (stats.badges || []).filter((b) => b.earned);
  const featuredId = stats.featuredBadge?.id || stats.featuredBadge;
  return <div className="reading-growth">
    <div className="reading-section-head"><div><h3>{readOnly ? "성취 컬렉션" : "나의 성취 컬렉션"} <span>{earned.length} / {(stats.badges || []).length}</span></h3><p>같은 뱃지의 다음 모습까지. 초급에서 고급으로 한 단계씩 모아 보세요.</p></div></div>
    <div className="reading-tier-guide">{[[1, "초급", "첫 발걸음"], [2, "중급", "깊어지는 독서"], [3, "고급", "나만의 성취"]].map(([tier, name, text]) => <span key={tier}><i className={`reading-tier-dot reading-tier-dot-${tier}`} /><strong>{name}</strong>{text}</span>)}</div>
    {series.map(({ key, badges }) => { const next = badges.find((b) => !b.earned); return <section key={key} className="reading-badge-series"><header><div><h4>{badges[0]?.seriesName || badges[0]?.name?.replace(/\s*(초급|중급|고급)$/, "") || key}</h4><p>{next ? `${next.description} · ${number(next.current)} / ${number(next.threshold)}` : "세 단계의 성취를 모두 모았어요."}</p></div>{next && <span className="reading-next-goal">다음 목표 · {tierName(next.tier)}</span>}</header><div className="reading-badge-grid">{badges.map((badge) => <article key={badge.id} className={`reading-badge-card${badge.earned ? " is-earned" : ""}${featuredId === badge.id ? " is-featured" : ""}`}>
      <div className="reading-badge-visual"><ReadingBadge badge={badge} size={100} earned={badge.earned} />{badge.earned && <span className="reading-earned-label">획득</span>}</div>
      <span className={`reading-tier-label reading-tier-label-${badgeTier(badge)}`}>{tierName(badge.tier)}</span><h5>{badge.name}</h5><p>{badge.description}</p><span className="reading-badge-exp">＋{badge.expReward} EXP</span>
      {badge.earned ? <><span className="reading-earned-date">{badge.earnedAt ? `${shortDate(badge.earnedAt)} 달성` : "달성한 성취"}</span>{readOnly ? (featuredId === badge.id && <span className="reading-feature-button" aria-disabled="true">대표 뱃지</span>) : <button type="button" className="reading-feature-button" disabled={busy || featuredId === badge.id} onClick={() => onSelect(badge.id)}>{featuredId === badge.id ? "나의 대표 뱃지" : "대표 뱃지로 선택"}</button>}</> : <><div className="reading-progress" role="progressbar" aria-label={`${badge.name} 달성 진행`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(badge.progress || 0))}><i style={{ width: `${Math.min(100, badge.progress || 0)}%` }} /></div><span className="reading-unearned">{number(badge.current)} / {number(badge.threshold)}</span><button type="button" className="reading-preview-button" onClick={() => setPreview(badge)}>디자인 미리보기</button></>}
    </article>)}</div></section>; })}
    <p className="reading-help">모든 단계는 한 번씩 받을 수 있어요. 기록을 고치거나 삭제하면 경험치와 성취 조건도 함께 다시 계산해요.</p>
    {preview && <Modal title={`${preview.name} · ${tierName(preview.tier)}`} onClose={() => setPreview(null)}>
      <div className="reading-badge-preview">
        <span className="reading-preview-status">미획득 · 디자인 미리보기</span>
        <ReadingBadge badge={preview} size={180} earned={true} />
        <h3>{preview.label || `${preview.name} · ${tierName(preview.tier)}`}</h3>
        <p>{preview.description}</p>
        <span className="reading-preview-reward">달성 보상 ＋{preview.expReward} EXP</span>
        <div className="reading-preview-progress"><div className="reading-progress" role="progressbar" aria-label={`${preview.name} 달성 진행`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(preview.progress || 0))}><i style={{ width: `${Math.min(100, preview.progress || 0)}%` }} /></div><span>현재 {number(preview.current)} / {number(preview.threshold)}</span></div>
        <p className="reading-help">앞으로 모을 뱃지의 모습을 미리 보는 화면이에요. 조건을 달성하면 내 컬렉션에 추가돼요.</p>
      </div>
      <div className="reading-form-actions"><button type="button" className="btn-primary" onClick={() => setPreview(null)}>확인</button></div>
    </Modal>}
  </div>;
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
