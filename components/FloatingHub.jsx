"use client";

// =============================================================
// 떠 있는 동그라미 — 메신저와 자주 여는 기능을 한 손에
// -------------------------------------------------------------
// 화면 오른쪽 아래의 작은 동그라미(56px). 누르면 **큰 원으로 펼쳐지며**
// 학생은 메신저 · 독서로 검색 · 내 출석부 · 과일 바구니 · 분석 리포트 다섯 개,
// 교사는 공지 보내기 · 출석 관리 · 반 관리가 포함된 일곱 개 기능이 둘레에 섭니다.
// '공지 보내기'(선생님만 — 선생님 요청 · 2026년 11월)는 한때 책 광장 · 교실 맵 위의 '공지사항' 단추였습니다 — 이 동그라미로
// 옮겼습니다(맵 위 단추를 되살리지 마세요).
// '독서로 검색'(학교 도서관 소장 검색 — 선생님 요청 · 2026년 11월)은 한때 돌발 퀴즈가 서던 자리입니다 —
// 돌발 퀴즈는 앱에서 걷었습니다(되살리지 마세요).
// KWLS 차트는 걷었습니다 — KWLS는 책방의 독서 활동으로만 씁니다.
//
// [모양은 행성 궤도]
// 가운데 해(고른 기능의 설명) 둘레의 궤도에 작은 행성(동그라미)들이
// 섭니다. 한때 '피자 조각'과 둘 다 두고 전환으로 오갔는데, 선생님이 궤도로
// 정하셔서 조각 모양과 전환을 걷었습니다. 궤도는 lib/hubPlace.js의 hubOrbit — 일곱까지는 101px · 메신저가 맨 위,
// 여덟(선생님의 책 봄)이면 110px로 넓히고 반 칸 돌려 닫기 동그라미 쪽 대각선을 비웁니다.
//
// [그림은 앱의 아이콘 그대로]
// 이모지 대신 이미 그 기능을 가리키는 그림을 씁니다(components/StatusIcons.jsx)
// — 메신저는 말풍선(IconAnswer — 로고는 가운데 해의 기본 그림), 독서로 검색은
// 책 위의 돋보기(IconLibrarySearch), 공지 보내기는 확성기(IconMegaphone), 반 관리는 IconBlackboard,
// 출석은 IconCheck. 과일 바구니는 바구니 창의 그림
// (`public/fruit-basket.webp`)을 작게 — 원을 펼쳤을 때만 그려 처음 화면에서
// 그림을 받지 않습니다.
//
// [기능은 '그 자리로 데려다 주기']
// 메신저 · 독서로 검색 · 성장·뱃지 · 공지 보내기만 이 자리에서 창을 엽니다 — 넷 다 **메신저처럼 동그라미 자리에서 펼쳐지는 같은
// 틀의 창**(선생님 요청 · 2026년 11월 — 한때 독서로 검색은 화면 가운데 모달, 성장·뱃지는 책 봄 왼쪽 칸, 공지는 책 광장 · 교실
// 맵 위의 단추였음). 틀은 HubPanel · 자리는 CSS의 .hub-panel 한 곳이고, 한 번에 하나만 열립니다(panel). 독서로 검색 ·
// 성장·뱃지 · 공지 보내기 창은 누를 때만 내려받습니다(아래 dynamic).
// 나머지는 이미 책방에 있는 창을 주소로 엽니다(`/books?open=attendance|fruit|classes` — 책방이 열고
// 주소를 지웁니다). 같은 창을 여기에 한 벌 더 만들면 두 곳이 어긋납니다.
// 분석 리포트(교사는 '관리자 대시보드')는 `/dashboard`에서 현재 반·역할에 맞는 통계를 보여 줍니다.
//
// [성장·뱃지 — 책 봄에서만]
// 책 봄이 열려 있을 때만(badgesOn) '독서로 검색' 다음 자리에 '성장·뱃지' 행성이 섭니다. 뱃지 자료는 책 봄이 이미 들고 있는 것을
// 다리(lib/readingBadgeBridge.js)로 받아 그립니다(읽기 0) — 학생은 제 것, 교사는 명단에서 고른 학생의 것. 교사가 아직 학생을
// 안 골랐으면(광장 · 아지트 보기 포함) 그 행성은 흐린 회색입니다.
//
// [끌어 옮기기 — 교사만]
// 학생 화면의 동그라미는 늘 기본 자리(오른쪽 아래)에 고정입니다(선생님 요청) —
// 끌리지 않고, 이 기기에 저장된 자리가 있어도 쓰지 않습니다.
// 교사는 동그라미를 누른 채 끌면 자리를 옮깁니다(6px 넘게 움직였을 때만 — 그 아래는
// 누르기). 자리는 이 기기에 화면 비율로 기억합니다(localStorage `hub_fab_pos`, 셈은
// lib/hubPlace.js). 옮긴 자리가 왼쪽 · 위쪽 절반이면 큰 원과 메신저 창이 화면
// 가운데 쪽으로 펼쳐집니다(`is-left` · `is-top`). 옮긴 뒤에는 교사의 '방송 종료'
// 알약 위로 비키는 것(`lifted`)을 하지 않습니다 — 자리를 고른 것은 선생님입니다.
//
// [책 봄에서는 독서로 검색 · 성장·뱃지(선생님은 공지 보내기도)만 — 선생님 요청 · 2026년 11월]
// 책 봄(?area=reading)에서는 '독서로 검색' · '성장·뱃지' · (선생님의) '공지 보내기' 행성만 켜고, 나머지 행성은 흐린 회색으로 그 자리에 세워 둡니다
// (libraryOnly — aria-disabled · 눌러도 열리지 않고 가운데 해가 까닭을 말함). 안 읽은 말 숫자는 지우지 않고 회색으로
// (와 있다는 것은 알게). 판정은 lib/hubPlace.js의 hubLibraryOnly(상단바가 넘김) — **학생도 교사처럼, 예외 없이**(선생님 결정 ·
// 한때 학생은 책방이 열린 반에서만, 그다음에는 책방과 리더보드를 모두 끈 반의 학생만 그대로 두었음 — 되살리지 마세요).
// 이미 떠 있던 메신저 창 · 손들기 창의 '메신저에서 이어 가기' · '메신저 대화'로 여는 메신저는 막지 않습니다.
//
// [읽는 문서]
// 안 읽은 말 배지 때문에 반을 고른 동안은 늘 구독합니다 — 학생은 제 방 둘
// (등호 질의 둘) + 모둠 문서 + 읽음 표시, 교사는 반의 최근 말 300개 + 모둠
// 문서 + 읽음 표시(+ 교사는 반 목록). 교사의 학생 명단은 **메신저를 열었을
// 때만** 읽습니다. 교사의 배지는 메신저 창에서 고른 반(처음엔 공부방의 반)의 것입니다.
// =============================================================
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { HUB_BADGES_KEY, HUB_DISC, HUB_DRAG_MIN, HUB_LIBRARY_KEY, HUB_NOTICE_KEY, cleanHubPos, hubItemOff, hubOrbit, hubPlacement, hubPosFromPoint } from "@/lib/hubPlace";
import { onReadingBadgesRequest, readingBadgesSnapshot, subscribeReadingBadges, takeReadingBadgesRequest } from "@/lib/readingBadgeBridge";
import {
  subscribeOwnClasses,
  subscribeClassChat,
  subscribeRoomsChat,
  subscribeChatReads,
  subscribeStudyGroupAssignment,
} from "@/lib/store";
import { CHAT_ROOM_LIMIT, dmRoom, groupRoom, totalUnread, MESSENGER_OPEN_EVENT } from "@/lib/messenger";
import { isFirebaseConfigured } from "@/lib/firebase";
import MessengerWindow from "./MessengerWindow";
import HubPanel from "./HubPanel";
import {
  IconLogo,
  IconAnswer,
  IconBlackboard,
  IconCheck,
  IconGrowthBadge,
  IconLibrarySearch,
  IconMegaphone,
  IconReport,
} from "./StatusIcons";

// 독서로 검색 · 성장·뱃지 · 공지 보내기 창 — 누를 때만 내려받습니다(창의 CSS도 함께 — 모든 화면의 첫 묶음에 안 실리게).
// 내려받는 동안에도 같은 자리에 같은 틀의 창이 서고 닫힙니다(dynamic의 loading은 props를 못 받아 닫기는 context로).
const PanelCloseContext = createContext(() => {});
function PanelLoading({ title }) {
  const onClose = useContext(PanelCloseContext);
  return (
    <HubPanel title={title} onClose={onClose} busy>
      <p className="hub-panel-note" role="status">{title} 창을 여는 중…</p>
    </HubPanel>
  );
}
function LibraryLoading() {
  return <PanelLoading title="독서로 검색" />;
}
function BadgesLoading() {
  return <PanelLoading title="성장·뱃지" />;
}
function NoticeLoading() {
  return <PanelLoading title="공지 보내기" />;
}
const SchoolLibraryPanel = dynamic(() => import("./reading/SchoolLibrarySearch"), { ssr: false, loading: LibraryLoading });
const ReadingBadgePanel = dynamic(() => import("./reading/ReadingBadgePanel"), { ssr: false, loading: BadgesLoading });
const NoticeSendPanel = dynamic(() => import("./NoticeSendPanel"), { ssr: false, loading: NoticeLoading });

function FruitBasketPic({ show }) {
  if (!show) return <span className="hub-basket-pic" />;
  return <img className="hub-basket-pic" src="/fruit-basket.webp" alt="" width={36} height={24} />;
}
const ICONS = {
  // 메신저는 상단바 '질문방'의 말풍선(IconAnswer) — 로고(말풍선 둘)는 가운데 해의
  // 기본 그림이라, 같은 그림을 쓰면 메신저 행성과 해가 구별되지 않았습니다(선생님 요청).
  msg: () => <IconAnswer size={28} />,
  attend: () => <IconCheck size={24} className="hub-icon-check" />,
  classes: () => <IconBlackboard size={27} />,
  library: () => <IconLibrarySearch size={28} />,
  badges: () => <IconGrowthBadge size={28} />,
  notice: () => <IconMegaphone size={28} />,
  fruit: ({ show }) => <FruitBasketPic show={show} />,
  report: () => <IconReport size={26} />,
};

const STUDENT_ITEMS = [
  { key: "msg", label: "메신저", hint: "선생님 · 우리 모둠과 대화해요" },
  // 독서로 검색 — 학생 · 교사 같은 행성(이 자리에서 창을 엶). 한때 돌발 퀴즈가 서던 자리입니다.
  { key: "library", label: "독서로 검색", hint: "우리 학교 도서관에 있는 책인지 찾아봐요" },
  { key: "attend", label: "내 출석부", hint: "내 출석 기록을 봐요", href: "/books?open=attendance" },
  { key: "fruit", label: "과일 바구니", hint: "과일을 담고 이벤트에 응모해요", href: "/books?open=fruit" },
  { key: "report", label: "분석 리포트", hint: "나의 독서 활동과 성장 통계를 봐요", href: "/dashboard" },
];
const TEACHER_ITEMS = [
  { key: "msg", label: "메신저", hint: "학생 · 모둠과 대화해요" },
  // 공지 보내기 — 선생님만(이 자리에서 창을 엶). 한때 책 광장 · 교실 맵 위의 '공지사항' 단추였습니다(선생님 요청으로 옮김).
  { key: HUB_NOTICE_KEY, label: "공지 보내기", hint: "반 학생 모두의 화면 가운데에 공지를 띄워요" },
  { key: "library", label: "독서로 검색", hint: "우리 학교 도서관에 있는 책인지 찾아봐요" },
  { key: "attend", label: "출석 관리", hint: "출석을 시작하고 기록을 봐요", href: "/books?open=attendance" },
  { key: "classes", label: "반 관리", hint: "반 · 참여 코드 · 자리와 모둠", href: "/books?open=classes" },
  { key: "fruit", label: "과일 바구니", hint: "바구니 합계와 이벤트 현황", href: "/books?open=fruit" },
  { key: "report", label: "대시보드", hint: "관리자 대시보드 — 학생·학급 분석과 학생 프로필", href: "/dashboard" },
];

// 성장·뱃지 — 책 봄이 열려 있을 때만 '독서로 검색' 다음 자리에 섭니다(badgesOn). 창은 메신저처럼(ReadingBadgePanel).
const BADGE_ITEM_STUDENT = { key: HUB_BADGES_KEY, label: "성장·뱃지", hint: "모은 뱃지와 다음 목표를 봐요" };
const BADGE_ITEM_TEACHER = { key: HUB_BADGES_KEY, label: "성장·뱃지", hint: "고른 학생이 모은 뱃지와 다음 목표를 봐요" };
function withBadgeItem(list, item) {
  const at = list.findIndex((it) => it.key === HUB_LIBRARY_KEY);
  return at < 0 ? [...list, item] : [...list.slice(0, at + 1), item, ...list.slice(at + 1)];
}

// 창 이름 — 동그라미(창이 떠 있는 동안 ×)의 '○○ 닫기'
const PANEL_NAMES = { msg: "메신저", library: "독서로 검색", badges: "성장·뱃지", notice: "공지 보내기" };
// 바깥 빈 곳을 누르면 닫히는 창 — 메신저만 빼고(대화를 띄워 둔 채 뒤 화면을 보며 답하는 창). 공지 보내기의 쓰던 글은 창을
// 닫아도 남습니다(NoticeSendPanel의 drafts).
const OUTSIDE_CLOSE_PANELS = [HUB_LIBRARY_KEY, HUB_BADGES_KEY, HUB_NOTICE_KEY];
// 독서로 검색 · 성장·뱃지 · 공지 보내기 창을 바깥 누르기로 닫을 때 '바깥이 아닌 것' — 그 위에 뜬 창(뱃지 상세 · 펫 창 · 캐릭터 창 …)과
// 그 창의 배경입니다. 배경을 눌러 뱃지 상세만 닫았는데 그 아래의 성장·뱃지 창까지 함께 닫히면 안 됩니다.
const PANEL_OUTSIDE_KEEP = ".modal-backdrop, .reading-modal-backdrop, dialog, [role='dialog'], [role='alertdialog']";

// 책 봄에서 꺼진 행성의 말(libraryOnly) — 가운데 해 · 행성 툴팁 · 아무것도 안 가리킬 때의 해
const OFF_HINT = "책 봄에서는 쓸 수 없어요";
const OFF_TITLE = "책 봄에서는 쓸 수 없어요 — 책 봄 밖의 화면(책방 · 리더보드 등)에서 열 수 있어요";
const LIBRARY_ONLY_HINT = "책 봄에서는 독서로 검색 · 성장·뱃지만 열려요";
// 선생님은 '공지 보내기'까지 셋 — 이름을 다 적으면 가운데 해(116px)에서 넘쳐, 회색이 아닌 행성이 열린다고 말합니다
const LIBRARY_ONLY_HINT_TEACHER = "책 봄에서는 색이 있는 것만 열려요";
// 동그라미의 이름(읽어 주는 기기 · 툴팁) — 책 봄에서 열리는 것
const READING_OPEN_STUDENT = "독서로 검색 · 성장·뱃지";
const READING_OPEN_TEACHER = "독서로 검색 · 성장·뱃지 · 공지 보내기";
// 성장·뱃지 자료가 아직 없을 때(교사가 학생을 안 고름 · 학생 화면은 잠깐 불러오는 중)
const BADGES_WAIT_TEACHER = "학생 명단에서 학생을 고르면 열려요";
const BADGES_WAIT_STUDENT = "책 봄을 불러오는 중이에요";
// 공지 보내기 — 선생님이 아직 반을 고르지 않았을 때(엉뚱한 반에 보내지 않게 열지 않음)
const NOTICE_WAIT = "책방에서 반을 고르면 열려요";

// 원판 크기(px) — CSS의 `.hub-disc` 폭·높이와 같아야 합니다(lib/hubPlace.js의 HUB_DISC). 궤도는 hubOrbit(행성 수).
const C = HUB_DISC / 2;

// 끌어 옮긴 자리 — 이 기기에만(화면 비율)
const POS_KEY = "hub_fab_pos";
function loadHubPos() {
  try {
    return cleanHubPos(JSON.parse(window.localStorage.getItem(POS_KEY) || "null"));
  } catch {
    return null;
  }
}

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))];

function ChatIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5C4 7.36 7.58 4 12 4s8 3.36 8 7.5S16.42 19 12 19c-1.02 0-2-.18-2.9-.5L5 20l1.2-3.4C4.83 15.27 4 13.47 4 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8.6" cy="11.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1.1" fill="currentColor" />
      <circle cx="15.4" cy="11.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

// classId — 지금 보는 반(교사는 공부방에서 고른 반, 학생은 소속 반).
// libraryOnly — 책 봄 화면이면 참(상단바가 hubLibraryOnly로 셈) — '독서로 검색' · '성장·뱃지' 말고는 흐린 회색으로 꺼 둡니다.
// badgesOn — 책 봄 화면이면 참 — '성장·뱃지' 행성을 세웁니다(자료는 책 봄이 다리에 건 것).
// noticeClassName · noticeMemberCount — [교사] 공지를 보낼 반(= classId, 선생님이 고른 반)의 이름과 학생 수(TopNav가 넘김).
// 공지는 메신저 창에서 고른 반이 아니라 늘 이 반으로 갑니다. 반 공지를 보내는 길은 이 행성 하나입니다(상단바 📢는 걷음).
// 교사의 메신저는 이와 따로 **창 맨 위에서 반을 고릅니다**(chatClassId) —
// 어느 화면에서든 원하는 반과 대화하고, 공부방의 반은 안 바뀝니다.
export default function FloatingHub({ classId: pageClassId, user, isTeacher, fruitOn = true, lifted = false, libraryOnly = false, badgesOn = false, noticeClassName = "", noticeMemberCount = 0 }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // 동그라미 자리에서 펼쳐진 창 — "msg"(메신저) · "library"(독서로 검색) · "badges"(성장·뱃지) · "notice"(공지 보내기) · null. 한 번에 하나.
  const [panel, setPanel] = useState(null);
  const msgOpen = panel === "msg";
  const [hover, setHover] = useState(null);
  // 책 봄이 다리에 건 뱃지(학생 본인 · 교사가 고른 학생) — 없으면 null
  const badgeEntry = useSyncExternalStore(subscribeReadingBadges, readingBadgesSnapshot, () => null);
  // 한 번이라도 펼쳤나 — 바구니 그림은 그때부터 받습니다(닫히는 동안에도 남게).
  const [opened, setOpened] = useState(false);
  const rootRef = useRef(null);
  const fabRef = useRef(null);
  const myUid = user?.uid;

  // ── 끌어 옮기기 — 자리(화면 비율) · 화면 크기 · 끄는 중 ──
  const [pos, setPos] = useState(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const draggedRef = useRef(false); // 방금 끌었나 — 놓을 때 따라오는 click을 누르기로 안 셈
  useEffect(() => {
    setPos(loadHubPos());
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // 다 끌고 놓았을 때만 적습니다(끄는 동안 매 프레임 적지 않게).
  useEffect(() => {
    if (dragging || !pos) return;
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* 저장소를 못 쓰는 창 — 이번 화면에서만 그 자리 */
    }
  }, [pos, dragging]);
  // 학생은 늘 기본 자리(끌기 없음 · 저장된 자리도 안 씀)
  const canDrag = !!isTeacher;
  const place = canDrag ? hubPlacement(pos, view.w, view.h) : null;

  function onFabPointerDown(e) {
    draggedRef.current = false;
    if (!canDrag || e.button !== 0) return;
    const r = fabRef.current?.getBoundingClientRect();
    if (!r) return;
    dragRef.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      // 누른 곳과 동그라미 가운데의 차이 — 끄는 내내 손 밑의 같은 자리가 따라옵니다
      dx: r.left + r.width / 2 - e.clientX,
      dy: r.top + r.height / 2 - e.clientY,
      moving: false,
    };
    // 누르는 순간 붙잡습니다 — 빠르게 끌면 첫 움직임이 벌써 단추 밖이라, 6px을 넘긴
    // 뒤에 붙잡으면 그 움직임을 놓칩니다. 붙잡아도 놓을 때의 click은 그대로 옵니다.
    try {
      fabRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      /* 붙잡지 못해도 단추 위에서의 끌기는 됩니다 */
    }
  }
  function onFabPointerMove(e) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moving) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < HUB_DRAG_MIN) return;
      d.moving = true;
      setDragging(true);
    }
    const next = hubPosFromPoint(e.clientX + d.dx, e.clientY + d.dy, window.innerWidth, window.innerHeight);
    if (next) setPos(next);
  }
  function onFabPointerEnd(e) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (d.moving) {
      draggedRef.current = true;
      setDragging(false);
    }
  }

  // ── 교사 — 내가 맡은 반(보관 안 된 것, 이름순) ──
  // 규칙이 메신저를 **반을 만든 교사**에게만 열어 두어(ownsClass) 최고 관리자도
  // 제 반만 셉니다 — 그래서 '내가 만든 반'만 구독합니다(where createdBy == 나, 반 수만큼만 읽음).
  // 데모 모드는 접속마다 uid가 새로 나와 '내가 만든 반'이 없으므로 보이는 반 전부.
  const [teacherClasses, setTeacherClasses] = useState([]);
  useEffect(() => {
    if (!isTeacher || !myUid) { setTeacherClasses([]); return undefined; }
    return subscribeOwnClasses(myUid, (list) =>
      setTeacherClasses(
        list
          .filter((c) => !c.archived && (!isFirebaseConfigured || c.createdBy === myUid))
          .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "ko", { numeric: true }))
      )
    );
  }, [isTeacher, myUid]);

  // 교사의 메신저 반 — 처음엔 공부방에서 고른 반(없으면 첫 반). 창이 닫혀 있는
  // 동안은 공부방의 반을 따라가고, 창에서 고른 반은 창이 떠 있는 동안 지킵니다.
  const [chatClassId, setChatClassId] = useState(null);
  const msgOpenRef = useRef(false);
  useEffect(() => {
    if (!isTeacher) return;
    const valid = (id) => id && teacherClasses.some((c) => c.id === id);
    setChatClassId((cur) => {
      if (msgOpenRef.current && valid(cur)) return cur;
      if (valid(pageClassId)) return pageClassId;
      if (valid(cur)) return cur;
      return teacherClasses[0]?.id ?? pageClassId ?? null;
    });
  }, [isTeacher, pageClassId, teacherClasses]);
  const classId = isTeacher ? chatClassId : pageClassId;

  // ── 모둠 · 말 · 읽음 표시 ──
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    if (!classId) { setGroups([]); return undefined; }
    return subscribeStudyGroupAssignment(classId, (d) => setGroups(d?.groups ?? []));
  }, [classId]);

  const myGroup = useMemo(
    () => (isTeacher ? null : groups.find((g) => (g.memberUids ?? []).includes(myUid)) ?? null),
    [groups, isTeacher, myUid]
  );
  // 학생의 방 — 선생님 1:1 · 우리 모둠(있으면). 열쇠를 글자로 묶어 의존성에 씁니다.
  const studentRoomsKey = !isTeacher && myUid
    ? [dmRoom(myUid), myGroup?.id ? groupRoom(myGroup.id) : null].filter(Boolean).join("|")
    : "";

  const [messages, setMessages] = useState([]);
  // 학생 — 방마다 최근 CHAT_ROOM_LIMIT개만 받고, 창의 '이전 대화 더 보기'가 그 방의 수를 늘립니다.
  // moreRooms — 그보다 앞의 말이 남은 방. 반 · 방이 바뀌면 처음 수로 돌아갑니다.
  const [roomLimits, setRoomLimits] = useState({});
  const [moreRooms, setMoreRooms] = useState({});
  const roomLimitsKey = JSON.stringify(roomLimits);
  useEffect(() => { setRoomLimits({}); }, [classId, studentRoomsKey]);
  useEffect(() => {
    setMessages([]); // 앞 반의 말이 새 반 목록에 한 박자 남지 않게
    setMoreRooms({});
    if (!classId || !myUid) return undefined;
    if (isTeacher) return subscribeClassChat(classId, setMessages);
    return subscribeRoomsChat(classId, studentRoomsKey.split("|").filter(Boolean), (list, more) => {
      setMessages(list);
      setMoreRooms(more ?? {});
    }, JSON.parse(roomLimitsKey));
  }, [classId, myUid, isTeacher, studentRoomsKey, roomLimitsKey]);
  const loadOlder = (room) =>
    setRoomLimits((prev) => ({ ...prev, [room]: (prev[room] ?? CHAT_ROOM_LIMIT) + CHAT_ROOM_LIMIT }));

  const [seen, setSeen] = useState({});
  useEffect(() => {
    if (!classId || !myUid) { setSeen({}); return undefined; }
    return subscribeChatReads(classId, myUid, setSeen);
  }, [classId, myUid]);

  // 배지 — 교사는 반의 모든 방, 학생은 제 방들.
  const unread = useMemo(() => {
    if (!myUid) return 0;
    const rooms = isTeacher
      ? [...new Set(messages.map((m) => m.room))]
      : studentRoomsKey.split("|").filter(Boolean);
    return totalUnread(messages, rooms, myUid, seen);
  }, [messages, seen, myUid, isTeacher, studentRoomsKey]);

  // 과일 바구니를 끄면(관리자 설정) 그 행성을 빼고 남은 것으로 원을 다시 나눕니다. 책 봄이면 '성장·뱃지'를 더합니다.
  const baseItems = (isTeacher ? TEACHER_ITEMS : STUDENT_ITEMS).filter((it) => fruitOn || it.key !== "fruit");
  const items = badgesOn ? withBadgeItem(baseItems, isTeacher ? BADGE_ITEM_TEACHER : BADGE_ITEM_STUDENT) : baseItems;
  // 꺼진 행성 — 책 봄에서 막힌 것(libraryOnly) · 자료가 아직 없는 성장·뱃지 · 반을 아직 안 고른 선생님의 공지 보내기
  const waitOf = (key) => {
    if (hubItemOff(key, libraryOnly)) return "";
    if (key === HUB_BADGES_KEY && !badgeEntry) return isTeacher ? BADGES_WAIT_TEACHER : BADGES_WAIT_STUDENT;
    if (key === HUB_NOTICE_KEY && !pageClassId) return NOTICE_WAIT;
    return "";
  };
  const itemOff = (key) => hubItemOff(key, libraryOnly) || !!waitOf(key);
  const offHintOf = (key) => waitOf(key) || OFF_HINT;
  const offTitleOf = (key) => waitOf(key) || OFF_TITLE;
  // 궤도 — 일곱까지는 첫 행성(메신저)이 맨 위, 여덟이면 넓히고 반 칸 돌림(lib/hubPlace.js의 hubOrbit)
  const orbit = hubOrbit(items.length);
  const angleOf = (i) => orbit.start + i * orbit.step;

  // ── 닫기 — 바깥 누르기 · Esc ──
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDown(e) {
      // 누르는 순간 사라진 것은 '바깥'이 아닙니다(프로젝트 문서 '바깥을 눌러 닫기').
      if (!e.target.isConnected) return;
      if (rootRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setMenuOpen(false);
      fabRef.current?.focus();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) setHover(null);
    else setOpened(true);
  }, [menuOpen]);

  useEffect(() => {
    msgOpenRef.current = msgOpen;
  }, [msgOpen]);

  // 독서로 검색 · 성장·뱃지 · 공지 보내기 창은 바깥 빈 곳을 누르면 닫힙니다(선생님 요청 · 2026년 11월 — 한때 × · Esc · 동그라미로만
  // 닫혀 빈 곳을 눌러도 그대로 떠 있었습니다). 메신저는 그대로 둡니다 — 대화를 띄워 둔 채 뒤 화면을 보며 답하는 창이라서요.
  // 공지 보내기의 쓰던 글은 닫아도 남습니다(NoticeSendPanel의 drafts).
  // 바깥이 아닌 것: 동그라미 · 창 안, 누르는 순간 사라진 것(isConnected — 프로젝트 문서 '바깥을 눌러 닫기'), 그 위에 뜬 창
  // (PANEL_OUTSIDE_KEEP). 초점은 옮기지 않습니다 — 누른 곳으로 갑니다.
  useEffect(() => {
    if (!OUTSIDE_CLOSE_PANELS.includes(panel)) return undefined;
    function onDown(e) {
      const t = e.target;
      if (!(t instanceof Element) || !t.isConnected) return;
      if (rootRef.current?.contains(t)) return;
      if (t.closest(PANEL_OUTSIDE_KEEP)) return;
      setPanel(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [panel]);

  // 공지를 보낼 반이 없어지면(선생님의 반 고르기가 풀림) 공지 보내기 창을 접습니다 — 엉뚱한 반에 보내지 않게
  useEffect(() => {
    if (!pageClassId) setPanel((p) => (p === HUB_NOTICE_KEY ? null : p));
  }, [pageClassId]);

  // 책 봄을 떠나면 성장·뱃지 창을 접습니다(그 자료는 책 봄의 것).
  useEffect(() => {
    if (!badgesOn) setPanel((p) => (p === "badges" ? null : p));
  }, [badgesOn]);

  // 분석 리포트의 '성장·뱃지 모두 보기'(?tab=growth)로 책 봄에 오면 그 창을 곧바로 엽니다 — 책 봄이 부탁합니다.
  useEffect(() => {
    if (!badgesOn) return undefined;
    const take = () => {
      if (!takeReadingBadgesRequest()) return;
      setMenuOpen(false);
      setPanel("badges");
    };
    take();
    return onReadingBadgesRequest(take);
  }, [badgesOn]);

  // 밖에서 메신저를 그 방으로 — 손들기 창의 '메신저에서 이어 가기' · '메신저 대화'
  // (lib/messenger.js의 openMessenger). 교사면 그 반으로 먼저 옮깁니다. 요청은 창을
  // 닫을 때 비웁니다 — 남아 있으면 다음에 동그라미로 열 때 또 그 방으로 갑니다.
  const [openReq, setOpenReq] = useState(null);
  useEffect(() => {
    function onOpen(e) {
      const d = e.detail || {};
      if (isTeacher && d.classId && teacherClasses.some((c) => c.id === d.classId)) {
        msgOpenRef.current = true; // 공부방의 반을 따라가는 효과가 덮지 않게
        setChatClassId(d.classId);
      }
      setMenuOpen(false);
      setOpenReq({ classId: d.classId ?? null, room: d.room ?? null, n: Date.now() });
      setPanel("msg");
    }
    window.addEventListener(MESSENGER_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(MESSENGER_OPEN_EVENT, onOpen);
  }, [isTeacher, teacherClasses]);

  // 학생의 반(이나 역할)이 바뀌면 접습니다 — 열려 있던 방은 앞 반의 것입니다.
  // 교사는 창 안에서 반을 바꾸므로 접지 않습니다(창이 방을 반과 짝으로 듭니다).
  useEffect(() => {
    if (isTeacher) return;
    setPanel((p) => (p === "msg" ? null : p));
    setMenuOpen(false);
  }, [pageClassId, isTeacher]);

  function pick(item) {
    setMenuOpen(false);
    if (item.key === "msg") {
      setOpenReq(null);
      setPanel("msg");
      return;
    }
    if (item.key === HUB_LIBRARY_KEY || item.key === HUB_BADGES_KEY || item.key === HUB_NOTICE_KEY) { setPanel(item.key); return; }
    if (item.href) router.push(item.href);
  }

  function onFab() {
    // 끌어 옮기고 놓은 것은 누르기가 아닙니다
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    // 창이 떠 있는 동안 동그라미는 그 창의 닫기(×)
    if (panel) { setPanel(null); setOpenReq(null); return; }
    setMenuOpen((v) => !v);
  }

  // 창 안의 × · Esc — 닫고 초점을 동그라미로 돌려놓습니다
  function closePanel() {
    setPanel(null);
    setOpenReq(null);
    fabRef.current?.focus();
  }

  if (!user || !classId) return null;

  const shown = hover != null ? items[hover] : null;
  const readingOpenNames = isTeacher ? READING_OPEN_TEACHER : READING_OPEN_STUDENT;
  const shownOff = !!shown && itemOff(shown.key);
  const fabOpen = menuOpen || !!panel;

  return (
    <div
      ref={rootRef}
      className={[
        "hub-root",
        canDrag ? "can-drag" : "",
        place ? "is-placed" : lifted ? "is-lifted" : "",
        place?.isLeft ? "is-left" : "",
        place?.isTop ? "is-top" : "",
        dragging ? "is-dragging" : "",
      ].filter(Boolean).join(" ")}
      style={
        place
          ? {
              "--hub-left": `${place.left}px`,
              "--hub-top": `${place.top}px`,
              "--hub-right": `${place.right}px`,
              "--hub-bottom": `${place.bottom}px`,
            }
          : undefined
      }
    >
      {/* 큰 원 — 접혀 있을 때도 그려 두고 크기만 0에 가깝게(펼침 움직임) */}
      <div
        className={`hub-disc${menuOpen ? " is-open" : ""}`}
        // 접힌 동안은 CSS가 visibility: hidden으로 감춰 안의 단추에 초점이 안 갑니다
        aria-hidden={!menuOpen}
      >
        {items.map((it, i) => {
          const [x, y] = pt(orbit.radius, angleOf(i));
          const Icon = ICONS[it.key];
          // 꺼진 행성(책 봄에서 막힌 것 · 자료가 아직 없는 성장·뱃지) — 회색으로 서 있고, 누르면 열지 않고 가운데 해가
          // 까닭을 말합니다(손가락으로 눌러도 보이게)
          const off = itemOff(it.key);
          return (
            <button
              key={it.key}
              type="button"
              className={`hub-item${hover === i ? " is-hover" : ""}${off ? " is-disabled" : ""}`}
              style={{ left: x, top: y, "--i": i }}
              aria-disabled={off || undefined}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
              onClick={() => (off ? setHover(i) : pick(it))}
              title={off ? offTitleOf(it.key) : it.hint}
            >
              <span className="hub-item-icon" aria-hidden="true">{Icon ? <Icon show={opened} /> : null}</span>
              <span className="hub-item-label">{it.label}</span>
              {it.key === "msg" && unread > 0 && (
                <span className={`hub-item-badge${off ? " is-muted" : ""}`} aria-label={`안 읽은 말 ${unread}개`}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}

        {/* 가운데 — 고른 기능의 그림 · 이름 · 설명. 아무것도 안 고르면 책나눔
            로고와 이름(선생님 요청). 그림은 흰 동그라미에 담습니다 — 앱 아이콘은
            먹빛 선이라 살구빛 해 위에 그대로 두면 안 보입니다. */}
        <div className={`hub-center${shownOff ? " is-off" : ""}`}>
          <span className="hub-center-badge" aria-hidden="true">
            {shown && ICONS[shown.key] ? ICONS[shown.key]({ show: opened }) : <IconLogo size={22} />}
          </span>
          <strong>{shown ? shown.label : "책나눔"}</strong>
          <span>{shown ? (shownOff ? offHintOf(shown.key) : shown.hint) : libraryOnly ? (isTeacher ? LIBRARY_ONLY_HINT_TEACHER : LIBRARY_ONLY_HINT) : "무엇을 열까요?"}</span>
        </div>
      </div>

      {/* 작은 동그라미 — 펼친 동안은 닫기(×) */}
      <button
        ref={fabRef}
        type="button"
        className={`hub-fab${fabOpen ? " is-open" : ""}`}
        onClick={onFab}
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={onFabPointerEnd}
        onPointerCancel={onFabPointerEnd}
        aria-expanded={menuOpen}
        aria-label={panel ? `${PANEL_NAMES[panel]} 닫기` : menuOpen ? "메뉴 닫기" : libraryOnly ? `바로가기 열기(책 봄에서는 ${readingOpenNames}만)` : "메신저와 바로가기 열기"}
        title={
          panel
            ? `${PANEL_NAMES[panel]} 닫기`
            : menuOpen
              ? "닫기"
              : `${libraryOnly ? `${readingOpenNames} · 바로가기` : "메신저 · 바로가기"}${canDrag ? " (끌어서 옮길 수 있어요)" : ""}`
        }
      >
        <span className="hub-fab-icon" aria-hidden="true">
          {fabOpen ? <span className="hub-fab-x">×</span> : <ChatIcon />}
        </span>
        {!fabOpen && unread > 0 && (
          <span className={`hub-fab-badge${libraryOnly ? " is-muted" : ""}`} aria-label={`안 읽은 말 ${unread}개`}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {msgOpen && (
        <MessengerWindow
          classId={classId}
          classes={isTeacher ? teacherClasses : []}
          onClassChange={setChatClassId}
          user={user}
          isTeacher={isTeacher}
          groups={groups}
          messages={messages}
          moreRooms={isTeacher ? {} : moreRooms}
          onLoadOlder={isTeacher ? null : loadOlder}
          seen={seen}
          initialRoom={openReq}
          onClose={closePanel}
        />
      )}

      {/* 독서로 검색 · 성장·뱃지 · 공지 보내기 — 메신저와 같은 자리 · 같은 틀(.hub-panel)의 창 */}
      {OUTSIDE_CLOSE_PANELS.includes(panel) && (
        <PanelCloseContext.Provider value={closePanel}>
          {panel === HUB_LIBRARY_KEY ? (
            <SchoolLibraryPanel onClose={closePanel} />
          ) : panel === HUB_BADGES_KEY ? (
            <ReadingBadgePanel entry={badgeEntry} isTeacher={!!isTeacher} onClose={closePanel} />
          ) : (
            // 공지는 메신저 창에서 고른 반(chatClassId)이 아니라 선생님이 고른 반(pageClassId)으로 — 손들기 · 방송과 같은 반
            <NoticeSendPanel classId={pageClassId} className={noticeClassName} memberCount={noticeMemberCount} onClose={closePanel} />
          )}
        </PanelCloseContext.Provider>
      )}
    </div>
  );
}
