"use client";
// =============================================================
// 교사의 책 봄 — 왼쪽 반 학생 명단 · 오른쪽 고른 학생의 책 봄(읽기 전용)
// 선생님 결정: 책꽂이(한때 이름이 '서재') · 독서 발자국 · 한 권의 책(감상)까지 전부 보입니다.
// 읽기는 /api/reading?uid= — 서버가 담당 교사 · 관리자이고 그 학생이 이 반
// 소속인지 확인합니다(lib/server/readingService.js의 getReading).
// 명단은 페이지가 이미 받아 둔 useClassRoster(학번순)를 그대로 씁니다(읽기 0).
//
// **책 광장의 입구는 명단 위의 '책 광장 들어가기'입니다**(광장을 켠 반 — 선생님 신고로 세움).
// 책 광장은 반 전체의 자리라 고른 학생과 무관하게, **학생이 한 명도 없는 반에서도** 들어갑니다.
// 한때 길이 고른 학생 화면(ReadingHub)의 셋째 탭 하나뿐이라 학생이 없는 반에서는 탭 줄 자체가 없었고
// (주소에 ?tab=plaza를 붙여도 안 열림), 학생이 있는 반에서도 '○○의 독서 여정' 안에 섞여 입구로 보이지 않았습니다.
// 학생 상세의 중복 책 광장 탭은 없애고 왼쪽 입구를 사용합니다.
//
// **펫 먹이**(관리자 설정의 '펫 먹이'를 켠 반 — lib/petCare.js): 명단의 이름 옆에 그 학생 펫의 배부름이 섭니다
// (배고픔은 살구 · 오늘이 고비면 붉게 · 먹이를 찾아 떠났으면 '떠남'), 명단 위에는 '배고픈 펫 n · 떠난 펫 n'.
// 떠난 펫의 학생을 고르면 그 화면 위에 **'불러 주기'**가 섭니다 — 긴 병결 같은 예외에 선생님이 걸음과 상관없이
// 곧바로 불러 줍니다(서버가 담당 교사인지 확인 · recallReadingPet). 배부름은 명단이 이미 받아 둔 학생 프로필의
// 펫으로 셉니다(읽기 0 — lib/roster.js의 pet · 학생마다 이 반에 들어온 날 joinedAt부터).
//
// **댓글 이력**(선생님 요청): 고른 학생의 책꽂이 제목 옆 '댓글 이력' — 그 학생이 책 광장에 쓴 댓글 · 받은 댓글을
// 고친 글 · 지운 글까지 봅니다(PlazaCommentHistory · 담당 교사만 읽는 classes/{c}/plazaCommentLog). 광장을 꺼 둔 반에서도
// 섭니다 — 일이 생긴 뒤 광장을 꺼도 지난 이력은 봐야 하므로.
// 그 창은 **누를 때만 내려받습니다**(아래 dynamic) — 책 광장의 자료 함수(lib/data/plaza.js)를 함께 끌어와, 곧바로 import하면
// 책방 첫 화면 묶음이 그만큼 커집니다(광장의 코드는 쓸 때만 — CLAUDE.md). 내려받는 동안에도 같은 자리에 창이 서고 닫힙니다.
// **광장 대화**(선생님 결정 — 대화 기록을 남기고 담당 교사 · 관리자가 봄): 같은 머리에 '광장 대화' — 그 학생이 책 광장 · 교실에서
// 든 대화의 말 전체(PlazaTalkHistory · 서버가 담당 교사인지 확인). 댓글 이력과 같은 약속으로 광장 대화를 꺼 둔 반에서도 섭니다.
// **프로필 편집**(선생님 요청 · 2026년 11월 — "학생 프로필 편집 버튼이 없는 것 같은데요?"): 같은 줄의 셋째 단추. 관리자 대시보드의
// 학생 프로필 창을 그대로 엽니다(이름 · 학번 · 이메일 편집 · 이 반에서 빼기 · 사용 중지 · 탈퇴 — StudentProfileFromBooks · 누를 때만
// 내려받음). 반 목록은 책방 페이지의 내 반(보관된 반 포함 — 대시보드와 같은 범위)을 ownClasses로 받습니다. 이름 · 학번을 고치면
// 명단(useClassRoster — 학생 프로필을 구독)이 저절로 따라오고, 빼거나 탈퇴시키면 창을 닫고 알림 한 줄 · 명단의 첫 학생으로 돌아갑니다.
//
// **학교 도서관 소장 검색**은 한때 명단 위의 작은 칸이었습니다 — 모든 사용자의 떠 있는 동그라미 '독서로 검색'으로
// 옮기며(선생님 요청 · 2026년 11월) 이 칸은 걷었습니다(components/FloatingHub.jsx · reading/SchoolLibrarySearch.jsx).
// =============================================================
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ReadingHub, { TeacherPlaza } from "./ReadingHub";
import { IconAnswer, IconStudent } from "@/components/StatusIcons";
import { backdropClose } from "@/lib/modal";
import { recallReadingPet, subscribeRosterPets } from "@/lib/data/reading";
import { careRulesFor, careStatus } from "@/lib/petCare";
import { petSpecies } from "@/lib/readingPet";
import { kstToday } from "@/lib/reading";
import { iGa } from "@/lib/korean";

// 내려받는 동안의 창 — 닫기 · 제목은 context로 받습니다(dynamic의 loading은 props를 받지 못함 · ReadingHub의 PlazaLoading과 같은 길)
const HistoryCloseContext = createContext({ onClose: () => {}, title: "댓글 이력" });
function HistoryLoading() {
  const { onClose, title } = useContext(HistoryCloseContext);
  return (
    <div className="modal-backdrop plaza-history-backdrop" {...backdropClose(onClose)}>
      <div className="modal plaza-history" role="dialog" aria-modal="true" aria-label={title}>
        <div className="plaza-history-head">
          <div><h3>{title}</h3><p role="status">{title} 창을 여는 중이에요.</p></div>
          <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
        </div>
      </div>
    </div>
  );
}
const PlazaCommentHistory = dynamic(() => import("./PlazaCommentHistory"), { ssr: false, loading: HistoryLoading });
const TeacherHideoutBrowser = dynamic(() => import("./TeacherHideoutBrowser"), { ssr: false, loading: () => <p className="reading-loading" role="status">학생들의 아지트를 펼치고 있어요.</p> });
const PlazaTalkHistory = dynamic(() => import("./PlazaTalkHistory"), { ssr: false, loading: HistoryLoading });
// 학생 프로필 창(관리자 대시보드와 같은 창) — 누를 때만 내려받습니다(대시보드의 CSS를 함께 끌어옴). 내려받는 동안에는 같은 자리에 한 줄.
function ProfileLoading() {
  const { onClose } = useContext(HistoryCloseContext);
  return (
    <div className="modal-backdrop" {...backdropClose(onClose)}>
      <div className="modal reading-teacher-profile-loading" role="dialog" aria-modal="true" aria-label="학생 프로필">
        <p role="status">학생 프로필 창을 여는 중이에요.</p>
        <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
const StudentProfileDialog = dynamic(() => import("./StudentProfileFromBooks"), { ssr: false, loading: ProfileLoading });

// 고른 학생은 주소(?student=)가 듭니다 — 리더보드의 '책꽂이로 이동'이 그 학생을 짚어 열고,
// 새로고침해도 그 학생입니다. 명단을 누르면 주소만 바꿉니다(replace).
// plazaCall — 선생님의 '모두 이동'이 10초를 다 세고 모두를 데려오는 신호의 '보낸 때'(책방 페이지가 넘김 · 없으면 0).
//   누른 선생님이 세는 동안 광장에서 나와 명단을 보고 있었으면, 다 셌을 때 선생님도 광장으로 돌아갑니다('모두'에는
//   선생님도 듭니다). 떠 있는 동안 값이 바뀔 때만입니다(처음 받은 값은 기준일 뿐).
// petOn · petFeed — 학생 펫과 펫 먹이의 규칙(책방 페이지가 넘김 — 끈 반이면 배부름을 그리지 않음) · onToast — 알림 한 줄.
export default function TeacherReadingView({ classId, user, roster = [], ownClasses = [], studentUid = null, onPickStudent, plazaOn = false, initialTab = "library", plazaCall = 0, petOn = false, petFeed = null, onToast = null, introHeading = null, ...hubProps }) {
  const student = roster.find((s) => s.uid === studentUid) || roster[0] || null;
  // 펫 먹이 — 학생마다의 배부름(명단이 싣고 온 프로필의 펫으로 셈 · 체험반은 이 브라우저 안의 펫)
  const feedOn = petOn && !!petFeed?.on;
  const [pets, setPets] = useState(() => new Map());
  useEffect(() => {
    if (!petOn) { setPets(new Map()); return undefined; }
    return subscribeRosterPets(roster, setPets);
  }, [petOn, roster]);
  const today = kstToday();
  const careOf = useMemo(() => {
    const map = new Map();
    if (!feedOn) return map;
    // 학생마다 이 반에 들어온 날부터 셉니다(명단의 joinedAt — 학생 화면 · 서버와 같은 셈)
    const joined = new Map(roster.map((s) => [s.uid, s.joinedAt ?? null]));
    for (const [uid, mirror] of pets) if (mirror) map.set(uid, { mirror, status: careStatus(mirror, careRulesFor(petFeed, joined.get(uid)), today) });
    return map;
  }, [feedOn, pets, petFeed, today, roster]);
  const hungryCount = [...careOf.values()].filter((c) => c.status?.hungry).length;
  const awayCount = [...careOf.values()].filter((c) => c.status?.away).length;
  const [historyFor, setHistoryFor] = useState(null);   // 댓글 이력 · 광장 대화 창을 연 학생과 창({ student, kind: "comments" | "talk" })
  const closeHistory = () => setHistoryFor(null);
  // 학생 프로필 창을 연 학생(대시보드의 명단 한 줄과 같은 모양 — 지금 보는 반을 맨 앞에: 그 반에서 빼기 · 이름 맞추기의 기준)
  const [profileFor, setProfileFor] = useState(null);
  const closeProfile = () => setProfileFor(null);
  const thisClass = ownClasses.find((c) => c.id === classId) || null;
  function openProfile(target) {
    setHistoryFor(null);
    setProfileFor({ uid: target.uid, name: target.name, studentId: target.studentId || "", classes: [{ id: classId, name: thisClass?.name || "" }] });
  }
  function profileGone(message) {
    setProfileFor(null);
    onToast?.(message);
    onPickStudent?.(null); // 빠진 학생 대신 명단의 첫 학생으로(주소의 ?student=를 지움)
  }
  const [recalling, setRecalling] = useState(false);
  const [recallError, setRecallError] = useState("");
  useEffect(() => { setRecallError(""); }, [student?.uid]);
  async function recall(target) {
    if (recalling) return;
    setRecalling(true);
    setRecallError("");
    try {
      await recallReadingPet(classId, target.uid);
      onToast?.(`${target.name}의 펫을 불러 주었어요. 배부름 60에서 다시 시작해요.`);
    } catch (e) {
      setRecallError(e?.message || "펫을 불러 주지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setRecalling(false);
    }
  }
  const picked = student ? careOf.get(student.uid) : null;
  // 고른 학생의 화면('아지트 보기' 탭의 쉬는 펫)에 넘길 먹이 규칙 — 그 학생이 반에 들어온 날부터 셉니다
  const studentJoined = student?.joinedAt ?? null;
  const studentFeed = useMemo(() => (feedOn ? careRulesFor(petFeed, studentJoined) : null), [feedOn, petFeed, studentJoined]);
  // 책 광장에 들어가 있는가 — 주소의 ?tab=plaza로 열었으면 처음부터(학생 화면과 같은 주소). 나가면 명단으로 돌아옵니다.
  const [plazaOpen, setPlazaOpen] = useState(initialTab === "plaza");
  const [startInHideout, setStartInHideout] = useState(false);
  const [startInHideoutRoom, setStartInHideoutRoom] = useState("classroom");
  const [galleryOpen, setGalleryOpen] = useState(initialTab === "hideout");
  const galleryAvailable = !!hubProps.hideoutOn;
  const galleryActive = galleryOpen && galleryAvailable;
  // 책 봄 머리말(반 고르개 줄 · '책 봄' 줄) 오른쪽 끝 빈자리 — 학생 아지트 보기가 그 학생의 캐릭터 카드를 여기에 띄웁니다(선생님 요청 ·
  // 2026년 11월 · createPortal). 늘 그려 두고 비어 있으면 자리를 차지하지 않습니다(reading.css의 .books-head-aside).
  const [headAside, setHeadAside] = useState(null);
  // 고른 학생의 소개 카드(통계 · 대표 뱃지 · 캐릭터 · 펫) 자리 — 명단 칸까지 가로를 다 쓰는 맨 윗줄(선생님 요청 · 2026년 11월 —
  // 명단 오른쪽 칸에만 서서 좁았음). ReadingHub가 카드를 여기에 띄우고(createPortal), 명단 · 탭 줄은 그 아래에서 같은 높이로 시작합니다.
  // 학생을 고른 동안은 '책 봄 · 반 이름' 머리말이 어디에도 서지 않습니다 — 카드 안의 제목 덩이도 걷어 카드가 낮아졌습니다(선생님 요청).
  const [introSlot, setIntroSlot] = useState(null);
  const mainRef = useRef(null);
  const restoreGalleryFocus = useRef(false);
  const galleryIdentity = `${classId || ""}:${user?.uid || ""}`;
  const galleryIdentityRef = useRef(galleryIdentity);
  function closeGallery() {
    restoreGalleryFocus.current = true;
    setGalleryOpen(false);
  }
  // 책 광장으로 — 명단 위 '책 광장 들어가기'와 아지트 보기의 '광장으로'(선생님 요청 · 2026년 11월)가 같은 길. 나오면 명단으로.
  function openPlaza() {
    setGalleryOpen(false);
    setStartInHideout(false);
    setPlazaOpen(true);
  }
  useEffect(() => { if (!galleryAvailable) setGalleryOpen(false); }, [galleryAvailable]);
  useEffect(() => {
    if (galleryIdentityRef.current === galleryIdentity) return;
    galleryIdentityRef.current = galleryIdentity;
    setGalleryOpen(false);
  }, [galleryIdentity]);
  useEffect(() => {
    if (!galleryActive && restoreGalleryFocus.current) {
      restoreGalleryFocus.current = false;
      mainRef.current?.querySelector("[data-reading-hideout-gallery]")?.focus({ preventScroll: true });
    }
  }, [galleryActive]);
  const seenCall = useRef(plazaCall);
  useEffect(() => {
    if (plazaCall === seenCall.current) return;
    seenCall.current = plazaCall;
    if (plazaCall && plazaOn) { setGalleryOpen(false); setStartInHideout(false); setPlazaOpen(true); }
  }, [plazaCall, plazaOn]);
  useEffect(() => {
    // Consume the initial navigation request after the wrapper mounts. Keeping
    // it would reopen the room on a later class switch after leaving by portal.
    if (!plazaOn || !hubProps.hideoutOn || (plazaOpen && startInHideout)) setStartInHideout(false);
  }, [plazaOn, hubProps.hideoutOn, plazaOpen, startInHideout]);
  if (plazaOn && plazaOpen) {
    return (
      <>
      {introHeading && <div className="books-head">{introHeading}</div>}
      <div className="reading-teacher">
        <TeacherPlaza key={classId} classId={classId} user={user} characterOn={hubProps.characterOn} classroom={hubProps.classroom} hideoutOn={hubProps.hideoutOn} initialHideout={startInHideout} initialHideoutRoom={startInHideoutRoom} plazaCall={plazaCall} talkOn={plazaOn && !!hubProps.talkOn}
          onExit={() => { setStartInHideout(false); setPlazaOpen(false); }} />
      </div>
      </>
    );
  }
  // 광장에서 나온 뒤 서는 학생 화면은 첫 탭부터 — 주소에 tab=plaza가 남아 있어도 그 화면이 다시 광장을 열지 않게.
  const hubTab = (plazaOn && initialTab === "plaza") || initialTab === "hideout" ? "library" : initialTab;
  return (
    <>
    {introHeading && (galleryActive || !student) && <div className="books-head">{introHeading}</div>}
    <div className="books-head-aside" ref={setHeadAside} />
    <div className={`reading-teacher${galleryActive ? " reading-teacher--hideouts" : ""}`}>
      {/* 소개 카드 자리 — 늘 그려 두고 비어 있으면 자리를 차지하지 않습니다(reading.css의 .reading-teacher-intro). */}
      <div className="reading-teacher-intro" ref={setIntroSlot} />
      <aside className="reading-teacher-rail" aria-label="책 광장 입구와 학생 명단">
        {plazaOn && (
          <button type="button" className="reading-teacher-plaza" onClick={openPlaza}>
            <strong>책 광장 들어가기 <span aria-hidden="true">→</span></strong>
            <small>{hubProps.classroom?.on ? "광장의 포털로 교실에도 가요" : "학생들의 책과 글을 함께 봐요"}</small>
          </button>
        )}
        <h3>학생 명단 <span>{roster.length}</span></h3>
        {feedOn && careOf.size > 0 && (
          <p className={`reading-teacher-care${hungryCount || awayCount ? " is-alert" : ""}`}>
            펫 먹이 · {hungryCount || awayCount ? <>배고픈 펫 <b>{hungryCount}</b> · 떠난 펫 <b>{awayCount}</b></> : "모두 든든해요"}
          </p>
        )}
        {roster.length === 0 ? <p className="reading-muted">아직 이 반에 들어온 학생이 없어요.</p> : (
          <ol>
            {roster.map((s) => (
              <li key={s.uid}>
                <button type="button" className={student?.uid === s.uid ? "on" : ""} aria-current={student?.uid === s.uid ? "true" : undefined} onClick={() => { setGalleryOpen(false); onPickStudent?.(s.uid); }}>
                  {s.studentId && <span className="reading-teacher-sid">{s.studentId}</span>}
                  <span className="reading-teacher-name">{s.name}</span>
                  {careOf.get(s.uid)?.status && <PetCareChip status={careOf.get(s.uid).status} />}
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>
      <div className="reading-teacher-main" ref={mainRef}>
        {!galleryActive && student && picked?.status?.away && (
          <div className="reading-teacher-recall" role="status">
            <span>
              <strong>{student.name}의 {picked.mirror.species ? `펫 ${iGa(petSpecies(picked.mirror.species)?.name ?? "펫")}` : "알이"} {picked.mirror.species ? "먹이를 찾아" : "따뜻한 곳을 찾아"} 떠나 있어요.</strong>
              <small>학생이 책을 읽고 발자국을 남기면(하루 한 걸음) 돌아와요 — 지금까지 {picked.status.care.away.days.length + picked.status.care.away.fruit}걸음. 병결처럼 사정이 있으면 선생님이 곧바로 불러 줄 수 있어요.</small>
              {recallError && <small className="reading-teacher-recall-error" role="alert">{recallError}</small>}
            </span>
            <button type="button" className="btn-primary" disabled={recalling} onClick={() => recall(student)}>{recalling ? "불러 주는 중…" : "불러 주기"}</button>
          </div>
        )}
        {galleryActive ? <TeacherHideoutBrowser key={`${classId}:${user?.uid}`} classId={classId} user={user} roster={roster} characterOn={hubProps.characterOn} petOn={petOn} petFeed={petFeed} onClose={closeGallery} onPlaza={plazaOn ? openPlaza : null} cardSlot={headAside} />
          : student ? <ReadingHub key={`${classId}:${student.uid}`} classId={classId} user={user} isTeacher student={{ uid: student.uid, name: student.name, pet: pets.get(student.uid) ?? null }} plazaOn={plazaOn} petOn={petOn} petFeed={studentFeed} initialTab={hubTab} introApart introSlot={introSlot} {...hubProps}
          onOpenHideoutGallery={() => { setHistoryFor(null); setGalleryOpen(true); }}
          onOpenOwnHideout={(origin) => { setStartInHideoutRoom(origin === "plaza" ? "plaza" : "classroom"); setStartInHideout(true); setPlazaOpen(true); }}
          teacherTools={(
            <div className="reading-teacher-tools">
              {/* 설명 글(small)은 책꽂이 칸이 좁으면 감춥니다 — 그때는 마우스를 올리면 뜨는 title이 같은 말을 합니다. */}
              <button type="button" className="reading-teacher-history" title="댓글 이력 — 책 광장 · 고친 글 · 지운 글까지" onClick={() => setHistoryFor({ student, kind: "comments" })}>
                <IconAnswer size={17} /><span>댓글 이력</span><small>책 광장 · 고친 글 · 지운 글까지</small>
              </button>
              <button type="button" className="reading-teacher-history" title="광장 대화 — 친구들과 나눈 말" onClick={() => setHistoryFor({ student, kind: "talk" })}>
                <IconAnswer size={17} /><span>광장 대화</span><small>친구들과 나눈 말</small>
              </button>
              <button type="button" className="reading-teacher-history" title="프로필 편집 — 이름 · 학번 · 이메일" aria-haspopup="dialog" onClick={() => openProfile(student)}
                aria-label={`${student.name} 프로필 편집 — 이름 · 학번 · 이메일, 이 반에서 빼기 · 사용 중지 · 탈퇴`}>
                <IconStudent size={17} /><span>프로필 편집</span><small>이름 · 학번 · 이메일</small>
              </button>
            </div>
          )} />
          : <div className="reading-empty"><h3>학생을 기다리고 있어요.</h3><p>학생이 참여 코드로 들어오면 이곳에서 학생마다의 책 봄을 볼 수 있어요.{plazaOn ? " 책 광장은 지금도 ‘책 광장 들어가기’로 둘러볼 수 있어요." : ""}</p></div>}
      </div>
      {historyFor && (
        <HistoryCloseContext.Provider value={{ onClose: closeHistory, title: historyFor.kind === "talk" ? "광장 대화" : "댓글 이력" }}>
          {historyFor.kind === "talk"
            ? <PlazaTalkHistory classId={classId} student={historyFor.student} onClose={closeHistory} />
            : <PlazaCommentHistory classId={classId} student={historyFor.student} roster={roster} onClose={closeHistory} />}
        </HistoryCloseContext.Provider>
      )}
      {profileFor && (
        <HistoryCloseContext.Provider value={{ onClose: closeProfile, title: "학생 프로필" }}>
          <StudentProfileDialog key={profileFor.uid} student={profileFor} myClasses={ownClasses} onClose={closeProfile}
            onWithdrawn={(name) => profileGone(`${name || "학생"}을(를) 탈퇴시켰어요. 기록과 프로필이 지워졌습니다.`)}
            onRemoved={(name, className) => profileGone(`${name || "학생"}을(를) ${className || "이 반"}에서 뺐어요. 남긴 글 · 과일 · 출석 기록은 그대로입니다.`)} />
        </HistoryCloseContext.Provider>
      )}
    </div>
    </>
  );
}

// 명단의 이름 옆 — 그 학생 펫의 배부름(떠났으면 '떠남'). 색만으로 가르지 않게 글자를 함께 적습니다.
function PetCareChip({ status }) {
  const label = status.away ? "떠남" : `배부름 ${status.full}`;
  const tone = status.away ? " is-away" : status.low ? " is-low" : status.hungry ? " is-hungry" : "";
  const title = status.away ? "펫이 먹이를 찾아 떠나 있어요" : status.low ? "오늘 먹이를 못 먹으면 떠나요" : status.hungry ? "펫이 배고파해요" : "펫의 배부름";
  return <span className={`reading-teacher-chip${tone}`} title={title}>{label}</span>;
}
