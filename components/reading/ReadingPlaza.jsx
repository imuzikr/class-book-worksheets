"use client";
// =============================================================
// 책 광장 — 책나눔의 셋째 탭(광장을 켠 반에서 '우리 반 랭킹' 자리에 섬 · 선생님 요청)
// -------------------------------------------------------------
// 광장 그림 위를 내 캐릭터(와 펫)가 걸어 다닙니다 — 누른 곳으로 걸어가고, **방향키**로도 걷습니다.
//   · 가판대(셋) = 반 친구들이 지금 읽고 있는 책(독서 발자국)
//   · 책꽂이    = 반 친구들이 꽂아 둔 완독한 책(한 권의 책)
// 앞에 서면(또는 눌러서) 창이 열려 책을 고르고, 글을 읽고, 댓글을 남깁니다(PlazaPanel).
// 걷는 길 · 여는 곳은 lib/readingPlazaMap.js, 목록의 셈은 lib/readingPlaza.js, 자료는 lib/data/plaza.js.
// 이 화면(과 창 PlazaPanel)은 광장 탭을 열 때만 내려받습니다(ReadingHub의 dynamic import).
//
// **방이 둘입니다 — 책 광장과 교실**(선생님 요청 · 관리자 설정의 '교실'을 켠 반). 광장 왼쪽 아래의 포털에 올라서면
// 교실로, 교실 오른쪽 아래(문 앞)의 포털에 올라서면 광장으로 옮겨 갑니다. 두 그림이 같은 크기라 무대 · 시점의 셈은
// 그대로이고, 방마다 다른 것(바닥 · 여는 곳 · 포털)은 방 정의(lib/readingPlazaMap.js의 plazaRoomOf)가 듭니다.
// 책 광장 탭을 열면 **마지막에 있던 방**에서 시작합니다(이 기기에 기억).
// **포털 · 러그 · 책상과 의자는 배경에 그려져 있지 않습니다**(선생님이 주신 분리 그림) — 방 정의의 좌표대로 따로 그립니다
// (포털은 여기서, 교실의 러그 · 책상은 PlazaClassroom.jsx의 PlazaFurniture가). 겹치는 차례는
// 바닥 → 러그 → 책상·의자 → 캐릭터 → (앉은 캐릭터의) 의자입니다.
// 교실에서는 —
//   · 학생: 자리표('자리 배정하기')의 **제 책상의 러그**에 올라서면 책상 위에 물음표가 뜹니다(러그가 그 자리의 범위 —
//     선생님 요청). A → [앉기(S) · 취소(C)], 앉은 채 A → [다시 서기(S) · 취소(C)]. 앉아 있는 동안은 걷지 않습니다.
//   · 선생님: 칠판 앞에서 A → [출석시작(S) · 출석종료(C)]. **출석시작을 누르는 순간 제자리에 앉아 있던 학생만**
//     출석이 됩니다(셈과 까닭은 lib/readingClassroom.js 머리말 — 앉아 있던 학생의 화면이 스스로 출석을 남김).
// **걷는 키는 방향키뿐입니다**(선생님 결정 — A · S · C가 행동 키가 되어 W · A · S · D로는 걷지 않습니다. 광장에서도 A는
// 앞에 선 책꽂이 · 가판대를 엽니다). 한글 입력 상태에서도 듣게 키의 자리(code)를 함께 봅니다.
//
// 맵이 화면을 가득 채웁니다(선생님 요청) — **상단바 바로 아래부터 화면 바닥 · 좌우 끝까지**가 무대(.plaza-stage = 보이는 창)이고
// (광장 탭에서는 책방 머리말 · 탭 줄 · 옆 패널을 가림 — plaza.css의 '광장 탭'), 나가는 길은 맵 위의 '나가기'입니다.
// 그림(.plaza-world)은 그 창을 빈틈없이 덮도록 키웁니다(셈은 lib/readingPlazaMap.js의 plazaView · plazaCamera).
// 그림과 화면의 비율이 달라 넘치는 쪽은 **시점이 캐릭터를 따라가며** 보여 줍니다(넓은 화면은 위아래로,
// 폰처럼 좁은 화면은 좌우로). 제목과 가판대 · 책꽂이 단추는 줄을 따로 차지하지 않고 맵 위 모서리에 얹습니다(.plaza-hud).
// 한때 제목 줄 · 안내 줄이 따로 있고 그림 전체가 한 화면에 들어오게 줄여, 넓은 화면에서 맵이 가운데에 작게 섰습니다 — 되돌리지 마세요.
//
// 캐릭터와 펫은 **걷는 그림**(도트 · 방향마다 정지 · 걷기 A · 걷기 B)으로 그립니다 — PlazaSprite.jsx(캔버스),
// 방향 · 그림 차례 · 펫이 따라올 자리의 셈은 lib/readingPlazaSprites.js. 걷는 동안 펫은 지나온 길을 조금 뒤에서
// 따라오고(아래쪽으로 걸을 때는 몸에 가리지 않게 옆으로 비켜서), 멈추면 곁자리로 옵니다.
// 펫은 단계가 오를수록 크게 그립니다(선생님 결정). 알은 공통 알 그림 그대로.
//
// **함께 있는 친구들**(선생님 요청) — 광장 탭을 연 반 친구와 선생님의 캐릭터가 서로의 화면에서 함께 걷습니다.
// 자료는 Realtime Database(lib/readingPlazaLive.js 머리말 — 입장권은 서버가, 자리는 본인이), 잇고 놓는 일은
// lib/data/plazaLive.js가 합니다. 걸음마다 올리지 않습니다 — 누른 곳으로 걸을 때는 길을 한 번, 방향키로 걸을 때는
// 0.3초에 한 번, 멈출 때 한 번(아래 tell). 친구의 캐릭터는 받은 소식대로 같은 빠르기로 걷습니다(plazaRemoteStep).
// 자리에는 **어느 방인지 · 어느 책상에 앉았는지**가 함께 실립니다 — 무대는 나와 같은 방에 있는 친구만 세우고,
// 앉은 친구는 그 의자에 앉혀 그립니다(그 책상이 자리표에서 그 친구의 것일 때만).
// 주소(NEXT_PUBLIC_FIREBASE_DATABASE_URL)를 넣지 않은 배포에서는 지금까지처럼 내 캐릭터만 보입니다(앉기 · 출석은 그대로 됨).
//
// 캐릭터 · 펫의 움직임, 바라보는 쪽, 걷는 그림, 시점은 React 상태가 아니라 ref와 requestAnimationFrame으로
// DOM(과 캔버스)에 곧바로 적습니다(프레임마다 다시 그리지 않게 — 캐릭터 한 명의 DOM은 PlazaActor.jsx).
// 어느 방인지 · 어디 앞인지 · 앉았는지 · 무엇을 고르는 중인지 · 갈 곳 표시 · 누가 함께 있는지(이름표)만 상태입니다.
// =============================================================
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { subscribeMyReadingCharacter, subscribeMyReadingPet } from "@/lib/data/reading";
import { subscribePlazaShelves } from "@/lib/data/plaza";
import { joinPlazaLive, plazaLiveConfigured } from "@/lib/data/plazaLive";
import { subscribeStudySeatLayout } from "@/lib/store";
import { todayDateKey } from "@/lib/dates";
import { characterOf } from "@/lib/readingCharacterCatalog";
import { petProgress } from "@/lib/readingPet";
import { plazaItems } from "@/lib/readingPlaza";
import {
  classroomAct, classroomAtBoard, classroomAttendance, classroomBoardAt, classroomBoardMark, classroomBoardStand, classroomDesks,
  classroomMoveCall, classroomMoveSpot,
  classroomNearSeat, classroomRollCall, classroomSeatAt, classroomSeatLabel, classroomSeatOf, classroomSeatSide, classroomUnseated, plazaArrowKey, plazaLetterKey,
} from "@/lib/readingClassroom";
import { PLAZA_LIVE_KEY_MS, plazaRemoteEnter, plazaRemoteHear, plazaRemoteStep, plazaSpawnFor } from "@/lib/readingPlazaLive";
import {
  CLASSROOM_SEATS, PLAZA_H, PLAZA_NEAR, PLAZA_W, PORTAL_ART,
  plazaArrival, plazaCamera, plazaNearest, plazaPath, plazaPortalAt, plazaPortalClicked, plazaRoomOf, plazaSpotAt, plazaSpotNear, plazaStep, plazaView, plazaWalkable,
} from "@/lib/readingPlazaMap";
import { PET_STRIDE, PLAZA_WALK_SPEED, SPRITE_IDLE, plazaFacing, plazaPetFollow, plazaPetStart, plazaShownFrame } from "@/lib/readingPlazaSprites";
import { PLAZA_STAGE_MIN_H, plazaRoom as stageRoom, plazaScroller } from "@/lib/plazaStageRoom";
import PlazaActor from "./PlazaActor";
import PlazaClassroom, { PlazaFurniture } from "./PlazaClassroom";
import PlazaPanel from "./PlazaPanel";
import "./plaza.css";

// 걷는 빠르기(그림 원본 px/초) — 내 캐릭터와 친구들의 캐릭터가 같은 값으로 걷습니다(lib/readingPlazaSprites.js).
const SPEED = PLAZA_WALK_SPEED;
// 시점이 캐릭터를 따라붙는 빠르기(초) — 작을수록 바짝 붙습니다. 걸음을 떼고 멈출 때 화면이 덜컥거리지 않게 조금 늦춥니다.
const CAM_EASE = 0.14;
// 무대의 바닥 높이(px) — 창이 아주 낮으면 이만큼은 지키고 화면이 구릅니다. 재는 셈과 함께 lib/plazaStageRoom.js에
// 있습니다(광장을 내려받는 동안의 자리 — ReadingHub의 PlazaLoading — 가 같은 셈으로 같은 높이에 섭니다).
const STAGE_MIN_H = PLAZA_STAGE_MIN_H;
// 방향키를 누르고 있지만 이만큼(초) 제자리면 막힌 것 — 친구들에게는 '섰다'고 한 번만 알립니다
// (막힌 채 누르고 있는 동안 0.3초마다 같은 자리를 올리지 않게).
const STUCK_S = 0.25;
// 포털에서 나온 뒤(옮겨 온 직후에는 포털 한가운데에 섭니다) 이만큼 벗어나야 다시 들어설 수 있습니다(원본 px)
const PORTAL_REARM = 22;
// 맵 아래쪽에 잠깐 뜨는 한 줄(왜 안 되는지 · 어떻게 하는지)이 머무는 시간
const NOTE_MS = 4600;
const PLACE_NAME = { stall: "지금 읽는 책", shelf: "완독한 책" };
const ROOM_NAME = { plaza: "책 광장", classroom: "교실" };
// 모두 이동(선생님의 '모두 교실로 · 모두 광장으로') — 선생님 단추의 글자 · 옮겨진 학생에게 뜨는 한 줄
const GATHER_LABEL = { classroom: "모두 교실로", plaza: "모두 광장으로" };
const GATHER_NOTE = { classroom: "선생님이 모두를 교실로 불렀어요.", plaza: "선생님이 모두를 책 광장으로 불렀어요." };
// 누른 선생님에게 뜨는 한 줄 — 누가 함께 옮겨 오는지(책 광장 탭을 열어 둔 학생)를 말합니다
const GATHER_DONE = {
  classroom: "모두 교실로 불렀어요. 책 광장을 열어 둔 학생이 함께 옮겨 와요.",
  plaza: "모두 책 광장으로 불렀어요. 교실에 있던 학생이 함께 옮겨 와요.",
};
// 선생님이 '모두 이동'을 누른 뒤 다시 누를 수 있을 때까지(ms) — 두 번 눌려 반 전체가 갔다가 곧바로 되돌아오지 않게
const GATHER_GAP_MS = 1500;
const NO_KEYS = () => ({ left: false, right: false, up: false, down: false });
const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;
// 함께 보기를 잇지 못했을 때 선생님께만 보이는 한 줄(학생에게는 광장이 지금까지처럼 보일 뿐)
const LIVE_NOTES = {
  server: "친구들의 캐릭터를 함께 보지 못하고 있어요 — Realtime Database를 만들었는지, 주소(환경변수)가 맞는지 확인해 주세요.",
  denied: "친구들의 캐릭터를 함께 보지 못하고 있어요 — Realtime Database 규칙이 게시되었는지 확인해 주세요.",
};
const SIT_HELP = "앉아 있어요. 일어서려면 A를 누르거나 내 자리를 누른 뒤 ‘다시 서기(S)’를 골라요.";
// 마지막에 있던 방(이 기기 — 다음에 책 광장 탭을 열면 그 방에서 시작) · 앉아 있던 자리(이 탭 — 새로고침해도 앉은 채로) ·
// 이 기기가 마지막으로 따른 '모두 이동' 신호의 보낸 때(같은 신호를 화면을 열 때마다 다시 따르지 않게)
const roomKey = (classId, uid) => `bookbom.plaza.room:${classId}:${uid}`;
const seatKey = (classId, uid) => `bookbom.plaza.seat:${classId}:${uid}`;
const moveKey = (classId, uid) => `bookbom.plaza.move:${classId}:${uid}`;
function recall(store, key) {
  try { return window[store].getItem(key); } catch { return null; }
}
function remember(store, key, value) {
  try {
    if (value == null) window[store].removeItem(key);
    else window[store].setItem(key, value);
  } catch { /* 저장소를 못 쓰는 창(사생활 보호 모드 등) — 기억하지 않을 뿐입니다 */ }
}
// 입장권의 펫({ species, stage } · 알이면 species가 없음)을 PlazaActor가 받는 모양으로
const friendPet = (pet) => (pet ? { species: pet.species, stage: pet.stage, hatched: !!pet.species, ready: false } : null);
const friendRow = (uid, who, friend) => ({
  uid, name: who.name, teacher: who.teacher, character: characterOf({ uid, character: who.character }), pet: friendPet(who.pet),
  reading: !!friend.reading, room: friend.room, seat: friend.seat,
});

// initialBook — 책꽂이에서 '광장에서 보기'로 넘어올 때 곧바로 열 책({ uid, bookId, place })
// onExit — 맵 위의 '나가기'(광장에서 나가 책나눔의 첫 탭 '책꽂이'로 — 광장 탭에서는 탭 줄을 가리므로 나가는 길은 이 단추)
// classroom — 교실(관리자 설정의 '교실'을 켠 반 · 책방 페이지가 넘김):
//   { on, openToday(오늘 출석이 열려 있나), attended([학생] 오늘 출석했나), presentUids([선생님] 오늘 출석한 uid들),
//     rollCall(반 문서의 classroomCallAt — 선생님이 출석을 확인한 때), roster([선생님] 명단), seatLayout([선생님] 자리표),
//     moveTo · moveAt(반 문서의 classroomMoveTo · classroomMoveAt — 선생님의 '모두 이동' 신호: 어느 방으로 · 보낸 때),
//     onAttend([학생] 출석 남기기) · onRollCall([선생님] 출석시작) · onStop([선생님] 출석종료) · onSeatSetup([선생님] 자리 배정하기 열기) ·
//     onMoveAll([선생님] 모두 이동 — 방 id를 받아 신호를 적음) }
export default function ReadingPlaza({ classId, user, isTeacher = false, characterOn = true, petOn = false, growthXp = null, initialBook = null, onExit = null, classroom = null }) {
  const myUid = user?.uid;
  const classroomOn = !!classroom?.on;
  const [shelves, setShelves] = useState(null);
  const [error, setError] = useState("");
  const [character, setCharacter] = useState(null);
  const [petState, setPetState] = useState(null);
  // 무대(보이는 창)의 크기 { w, h } — 폭은 본문 칸의 폭, 높이는 무대 위쪽부터 화면(구르는 칸) 바닥까지 남은 만큼(아래 measure)
  const [size, setSize] = useState(null);
  const [nearId, setNearId] = useState(null);
  const [marker, setMarker] = useState(null);
  // 걷는 법 안내(맵 아래쪽에 얹은 한 줄) — 그 방에서 첫걸음을 떼면 사라집니다
  const [walked, setWalked] = useState(false);
  // 함께 있는 친구들 — 이름표 · 캐릭터 · 펫 · 어느 방 · 어느 자리(그릴 것만. 자리와 걸음은 cast에) · 연결 상태
  const [friends, setFriends] = useState([]);
  const [live, setLive] = useState({ status: "off", why: "" });
  // 방 — 교실을 켠 반은 마지막에 있던 방에서 시작합니다. 책꽂이에서 '광장에서 보기'로 넘어왔으면 광장에서.
  const [roomId, setRoomId] = useState(() => (!initialBook && classroomOn && myUid && recall("localStorage", roomKey(classId, myUid)) === "classroom" ? "classroom" : "plaza"));
  const here = classroomOn && roomId === "classroom" ? "classroom" : "plaza";
  const room = plazaRoomOf(here, classroomOn);
  const [panel, setPanel] = useState(() => initialBook ? { place: initialBook.place || "stall", book: { uid: initialBook.uid, bookId: initialBook.bookId } } : null);
  // 교실 — [학생] 자리표(아직 못 받았으면 undefined · 없으면 null) · 앉아 있는 자리 · 고르는 중인 것 · 지금 A를 누르면 물을 것 ·
  // 칠판의 물음표 자리 · 잠깐 뜨는 한 줄 · 방을 옮길 때의 반짝임
  const [layout, setLayout] = useState(undefined);
  const [sitting, setSitting] = useState(null);
  const [menu, setMenu] = useState(null);
  const [hint, setHint] = useState(null);
  const [boardMark, setBoardMark] = useState(() => classroomBoardMark({ x: PLAZA_W / 2 }));
  const [note, setNote] = useState(null);
  const [warp, setWarp] = useState(0);
  // 방을 막 건너와 서 있는 포털(그 id) — 벗어날 때까지 그 포털의 이름표를 걷습니다(이름표가 내 캐릭터의 얼굴 높이라 가림)
  const [onGate, setOnGate] = useState(null);

  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  // 내 캐릭터(와 펫)의 DOM — PlazaActor가 내어 준 손잡이(place · show · placePet · showPet)
  const meRef = useRef(null);
  // 지금 방(걸음 루프가 봄) — 방을 옮길 때는 다시 그려지기 전에 먼저 바꿔 둡니다(enterRoom)
  const roomRef = useRef(room);
  roomRef.current = room;
  const hereRef = useRef(here);
  hereRef.current = here;
  const classroomOnRef = useRef(classroomOn);
  classroomOnRef.current = classroomOn;
  // 처음 서는 자리 — 함께 보는 광장에서는 사람마다 조금씩 다른 자리(모두 한 점에 겹치지 않게), 아니면 늘 같은 자리
  const pos = useRef(null);
  if (pos.current === null) pos.current = myUid && plazaLiveConfigured() ? plazaSpawnFor(myUid, room) : { ...room.spawn };
  // 그림을 얼마나 키웠나(plazaView) · 시점(그림의 어느 자리가 창의 왼쪽 위인가, 화면 px)
  const view = useRef(plazaView(0, 0));
  const cam = useRef({ x: 0, y: 0 });
  const path = useRef([]);
  const keys = useRef(NO_KEYS());
  // 방향키로 걷다 분수에 막혔을 때 어느 쪽으로 돌고 있는지(lib/readingPlazaMap.js의 plazaStep이 적음)
  const round = useRef({ turn: 0, key: "" });
  const pendingSpot = useRef(null);
  // 걸어가서 물을 것("seat" 내 책상을 눌렀음 · "board" 칠판을 눌렀음)
  const pendingAct = useRef(null);
  const raf = useRef(0);
  const lastTick = useRef(0);
  const movingRef = useRef(false);
  // 바라보는 쪽(down · right · up · left)과 걸은 거리 — 걷는 그림은 거리로 넘깁니다(lib/readingPlazaSprites.js)
  const facingRef = useRef("down");
  const stride = useRef(0);
  // 내 펫의 걸음(자리 · 바라보는 쪽 · 걸은 거리 · 지나온 길 — lib/readingPlazaSprites.js의 plazaPetStart). 펫이 없으면 null
  const myPet = useRef(null);
  // 함께 있는 친구들 — uid → { actor(받은 소식대로 걷는 캐릭터), pet(펫의 걸음 · 없으면 null), handle(PlazaActor), dirty,
  //   reading, room(어느 방) · seat(앉은 자리 · 자리표와 맞을 때만), heard(받은 소식 그대로) · heardAt(들은 때) }
  const cast = useRef(new Map());
  const castRefs = useRef(new Map());
  const session = useRef(null);
  // 지금 걸음(0 섬 · 1 길을 따라 · 2 방향키) · 방향키를 누른 채 제자리인 시간(초) · 친구들에게 마지막으로 알린 걸음과 그때
  const walkMode = useRef(0);
  const stuck = useRef(0);
  const told = useRef(0);
  const toldAt = useRef(0);
  const nearRef = useRef(null);
  const calm = useRef(false);
  const panelOpen = useRef(false);
  panelOpen.current = !!panel;
  // 교실 — 걸음 루프와 자판이 보는 값들
  const sittingRef = useRef(null);
  const menuRef = useRef(null);
  menuRef.current = menu;
  const hintRef = useRef(null);
  const boardX = useRef(boardMark.x);
  const portalArmed = useRef(true);
  const sitFrom = useRef(null);
  const noteTimer = useRef(0);
  const seatRestored = useRef(false);
  const seenCall = useRef(undefined);
  // 모두 이동(선생님의 '모두 교실로 · 모두 광장으로') — 지금까지 본 신호의 '보낸 때' 가운데 가장 큰 값(화면을 열고 처음이면
  // undefined) · 옮겨 온 까닭을 알리는 한 줄을 붙들어 둘 때까지(그사이 물음표가 떠도 걷지 않음) ·
  // 쓰던 댓글이 있어 창을 닫지 않고 옮겼을 때, 창을 닫으면 띄울 한 줄 · [선생님] 단추를 다시 들을 때(그 전에 누른 것은 흘림)
  const seenMove = useRef(undefined);
  const noteHold = useRef(0);
  const lateNote = useRef("");
  const movingAll = useRef(0);
  // [학생] 자리표를 아직 못 받은 채 교실로 옮겨져 뒤쪽에 서 있는 자리({ x, y }) — 자리표가 오면 제 러그로 옮겨 세웁니다(아래)
  const seatOwed = useRef(null);

  // 자리표 — 선생님은 책방 페이지가 이미 받아 둔 것을, 학생은 여기서 한 장 구독합니다(반 학생에게 읽기가 열려 있음)
  useEffect(() => {
    setLayout(undefined);
    if (!classroomOn || isTeacher || !classId) return undefined;
    return subscribeStudySeatLayout(classId, "default", (doc) => setLayout(doc ?? null));
  }, [classroomOn, isTeacher, classId]);
  const seats = isTeacher ? classroom?.seatLayout?.seats : layout?.seats;
  const desks = useMemo(() => classroomDesks(seats), [seats]);
  const mySeat = isTeacher || !classroomOn ? null : classroomSeatOf(desks, myUid);
  const desksRef = useRef(desks);
  desksRef.current = desks;
  const mySeatRef = useRef(mySeat);
  mySeatRef.current = mySeat;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const openToday = !!classroom?.openToday;
  const attended = !isTeacher && !!classroom?.attended;
  const openTodayRef = useRef(openToday);
  openTodayRef.current = openToday;
  const attendedRef = useRef(attended);
  attendedRef.current = attended;
  const classroomRef = useRef(classroom);
  classroomRef.current = classroom;

  useEffect(() => {
    setShelves(null); setError("");
    if (!classId) return undefined;
    return subscribePlazaShelves(classId, (rows) => { setShelves(rows); setError(""); },
      (e) => setError(e?.code === "permission-denied"
        ? "책 광장을 불러오지 못했어요. 선생님께 규칙이 게시되었는지 확인을 부탁해 주세요."
        : e?.message || "책 광장을 불러오지 못했어요."));
  }, [classId]);
  useEffect(() => (myUid ? subscribeMyReadingCharacter(myUid, setCharacter) : undefined), [myUid]);
  useEffect(() => {
    if (!myUid || !petOn || isTeacher) { setPetState(null); return undefined; }
    return subscribeMyReadingPet(myUid, setPetState);
  }, [myUid, petOn, isTeacher]);
  // 움직임을 줄여 달라고 한 기기에서는 시점이 미끄러지지 않고 캐릭터에 바로 붙습니다.
  // **걷는 그림은 이 설정과 상관없이 넘깁니다**(선생님 신고 — 한때 여기서 걷는 그림도 껐더니, 그 설정이 켜진 기기에서
  // 캐릭터가 발을 안 움직이고 미끄러져 다녔습니다. lib/readingPlazaSprites.js의 plazaShownFrame). calm을 걷는 그림에 다시 걸지 마세요.
  useEffect(() => {
    const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!query) return undefined;
    const sync = () => { calm.current = query.matches; };
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  // 다른 방의 그림을 미리 받아 둡니다 — 포털에 올라섰을 때 빈 화면이 스치지 않게
  useEffect(() => {
    if (!classroomOn || typeof Image === "undefined") return;
    for (const id of ["plaza", "classroom"]) new Image().src = plazaRoomOf(id, true).art;
  }, [classroomOn]);

  const counts = useMemo(() => {
    const stall = plazaItems(shelves ?? [], { place: "stall" });
    const shelf = plazaItems(shelves ?? [], { place: "shelf" });
    return { stall: stall.week.length + stall.earlier.length, shelf: shelf.week.length + shelf.earlier.length, stallWeek: stall.week.length, shelfWeek: shelf.week.length };
  }, [shelves]);

  // 맵 아래쪽에 잠깐 뜨는 한 줄(빈 값이면 곧바로 걷음 — 앉고 일어서고 방을 옮기면 앞의 안내는 지난 말입니다)
  const say = useCallback((text) => {
    clearTimeout(noteTimer.current);
    if (!text) { setNote(null); return; }
    setNote({ text, key: Date.now() });
    noteTimer.current = setTimeout(() => setNote(null), NOTE_MS);
  }, []);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  // 지금 내 걸음 — 친구들에게 알릴 모양(lib/readingPlazaLive.js의 plazaLivePos가 받음). 길을 따라 걷는 중이면
  // '지금 자리에서 남은 길'을 줍니다(연결이 끊겼다 이어져 다시 알릴 때도 처음부터 다시 걷지 않게).
  const liveState = useCallback(() => {
    const mode = walkMode.current;
    return {
      x: pos.current.x, y: pos.current.y, path: mode === 1 ? path.current.slice() : [], mode, facing: facingRef.current,
      reading: panelOpen.current, room: hereRef.current, seat: sittingRef.current,
    };
  }, []);
  // 친구들에게 알립니다 — 걸음마다가 아니라 걸음이 바뀔 때만(아래 tick · walkTo · 창을 여닫을 때 · 앉고 일어설 때 · 방을 옮길 때)
  const tell = useCallback((time = performance.now()) => {
    const state = liveState();
    told.current = state.mode;
    toldAt.current = time;
    session.current?.publish(state);
  }, [liveState]);
  // 시점을 DOM에 적습니다 — 그림을 통째로 밉니다(transform이라 다시 칠하지 않음)
  const look = useCallback(() => {
    const el = worldRef.current;
    if (el) el.style.transform = `translate3d(${-cam.current.x}px, ${-cam.current.y}px, 0)`;
  }, []);
  // 걸음을 멈춥니다(길 · 누르고 있던 방향키 · 걸어가서 하려던 일을 모두 걷음)
  const halt = useCallback(() => {
    path.current = [];
    pendingSpot.current = null;
    pendingAct.current = null;
    keys.current = NO_KEYS();
    walkMode.current = 0;
  }, []);

  const openSpot = useCallback((spot) => {
    halt();
    // 여는 곳을 바라봅니다 — 책꽂이 앞에서는 뒷모습, 가판대 앞에서는 옆모습
    facingRef.current = plazaFacing(null, (spot.rect[0] + spot.rect[2]) / 2 - pos.current.x, (spot.rect[1] + spot.rect[3]) / 2 - pos.current.y);
    meRef.current?.show(facingRef.current, SPRITE_IDLE);
    setPanel({ place: spot.place });
  }, [halt]);

  // 걸음 루프를 깨우는 함수는 tick보다 먼저 쓰여야 해서(방을 옮기는 enterRoom이 부름) ref로 둡니다
  const wakeRef = useRef(() => {});
  const wake = useCallback(() => wakeRef.current(), []);

  // ── 방을 옮깁니다(포털 · 선생님의 '모두 이동') ──
  // 포털로 건너왔으면 건너온 포털의 한가운데에 서고, 그 포털을 벗어날 때까지는 다시 들어서지 않습니다.
  // 선생님이 모두를 옮겼으면(forced — { at: 설 자리 { x, y, facing }, note: 알릴 한 줄, settle: 같은 방에서 자리만 고쳐 섬 })
  // 포털이 아니라 사람마다 다른 자리에 섭니다(lib/readingClassroom.js의 classroomMoveSpot — 한 점에 모두 겹치지 않게).
  // 친구들에게는 새 방 · 새 자리를 알립니다.
  const enterRoom = useCallback((nextId, forced = null) => {
    const from = hereRef.current;
    const next = plazaRoomOf(nextId, classroomOnRef.current);
    const id = next.id;
    const spot = forced?.at && plazaWalkable(forced.at.x, forced.at.y, next) ? forced.at : null;
    halt();
    hereRef.current = id;
    roomRef.current = next;
    pos.current = spot ? { x: spot.x, y: spot.y } : plazaArrival(next, from);
    // 서 있는 포털(있으면) — 포털로 건너왔으면 그 포털, 옮겨진 자리가 마침 포털 위면 그 포털
    const gate = spot ? plazaPortalAt(pos.current, next, PORTAL_REARM) : next.portals.find((g) => g.to === from) ?? null;
    portalArmed.current = spot ? !gate : false;
    sitFrom.current = null;
    sittingRef.current = null;
    stride.current = 0;
    round.current = { turn: 0, key: "" };
    facingRef.current = spot?.facing ?? "down";
    hintRef.current = null;
    nearRef.current = null;
    if (myPet.current) myPet.current = plazaPetStart(pos.current, facingRef.current, next);
    // 새 방에 있는 친구들은 마지막 소식에서 그동안 걸었을 만큼 가 있는 자리에 세웁니다
    const now = performance.now();
    for (const friend of cast.current.values()) {
      if (friend.room !== id) continue;
      friend.actor = plazaRemoteEnter(friend.state, now - friend.heardAt, now);
      if (friend.pet) friend.pet = plazaPetStart(friend.actor, friend.actor.facing, next);
      friend.dirty = true;
    }
    const goal = plazaCamera(view.current, pos.current);
    cam.current = { x: Math.round(goal.x), y: Math.round(goal.y) };
    look();
    meRef.current?.place(pos.current.x, pos.current.y);
    meRef.current?.show(facingRef.current, SPRITE_IDLE);
    if (myPet.current) meRef.current?.placePet(myPet.current.x, myPet.current.y);
    setRoomId(id);
    setSitting(null);
    setMenu(null);
    setHint(null);
    setNearId(null);
    setMarker(null);
    setWalked(false);
    setOnGate(gate?.id ?? null);
    // 같은 방 안에서 자리만 고쳐 설 때(settle — 늦게 온 자리표로 제 러그에 옮겨 섬)는 반짝임 · 떠 있는 한 줄을 그대로 둡니다
    if (!forced?.settle) {
      // 선생님이 옮겼으면 그 까닭을 한 줄로 — 옮겨 선 자리가 내 러그라 곧바로 물음표가 떠도 이 한 줄은 잠시 붙들어 둡니다
      noteHold.current = forced?.note ? now + NOTE_MS : 0;
      say(forced?.note ?? "");
      setWarp((n) => n + 1);
    }
    if (myUid) {
      remember("localStorage", roomKey(classId, myUid), id);
      remember("sessionStorage", seatKey(classId, myUid), null);
    }
    tell(now);
    wake();
  }, [classId, myUid, halt, look, say, tell, wake]);

  // ── 앉기 · 다시 서기(교실) ──
  const sitDown = useCallback((quiet = false) => {
    const index = mySeatRef.current;
    if (index === null || hereRef.current !== "classroom" || sittingRef.current !== null) return;
    const seat = CLASSROOM_SEATS[index];
    // 일어설 때 돌아갈 자리 — 앉기 전에 서 있던 복도 자리
    sitFrom.current = plazaWalkable(pos.current.x, pos.current.y, roomRef.current) ? { x: pos.current.x, y: pos.current.y } : null;
    halt();
    pos.current = { x: seat.sit.x, y: seat.sit.y };
    stride.current = 0;
    facingRef.current = "up";
    sittingRef.current = index;
    setSitting(index);
    setMenu(null);
    setMarker(null);
    meRef.current?.place(seat.sit.x, seat.sit.y);
    meRef.current?.show("up", SPRITE_IDLE);
    if (myUid) remember("sessionStorage", seatKey(classId, myUid), `${todayDateKey()}:${index}`);
    tell();
    wake();
    // 출석이 이미 열려 있는데 아직 출석 전이면 — 확인하는 순간이 지난 뒤입니다
    say(!quiet && openTodayRef.current && !attendedRef.current ? "지금은 출석 확인이 지난 뒤예요. 선생님이 ‘출석시작’을 한 번 더 누르면 출석이 돼요." : "");
  }, [classId, myUid, halt, say, tell, wake]);
  const standUp = useCallback(() => {
    const index = sittingRef.current;
    if (index === null) return;
    const seat = CLASSROOM_SEATS[index];
    // 앉기 전에 서 있던 러그 위로 돌아갑니다(모르면 — 새로고침으로 앉은 채 시작했으면 — 펫이 기다리는 쪽 귀)
    const back = sitFrom.current && plazaWalkable(sitFrom.current.x, sitFrom.current.y, roomRef.current) ? sitFrom.current : classroomSeatSide(index, myPet.current).stand;
    sitFrom.current = null;
    pos.current = { x: back.x, y: back.y };
    // 일어서면 책상 쪽을 봅니다
    facingRef.current = seat.rug.x >= back.x ? "right" : "left";
    // 펫이 책상 줄 건너편에서 기다리고 있었으면 곁으로 데려옵니다(곧게만 걸어 건너오지 못함)
    if (myPet.current && (myPet.current.x - seat.rug.x) * (back.x - seat.rug.x) < 0) {
      myPet.current = plazaPetStart(pos.current, facingRef.current, roomRef.current);
      meRef.current?.placePet(myPet.current.x, myPet.current.y);
    }
    sittingRef.current = null;
    setSitting(null);
    setMenu(null);
    meRef.current?.place(back.x, back.y);
    meRef.current?.show(facingRef.current, SPRITE_IDLE);
    if (myUid) remember("sessionStorage", seatKey(classId, myUid), null);
    say("");
    tell();
    wake();
  }, [classId, myUid, say, tell, wake]);

  // 한 프레임 — 방향키가 눌려 있으면 그쪽으로, 아니면 정해 둔 길을 따라 걷습니다. 걸은 쪽 · 걸은 거리로 걷는 그림을
  // 고르고, 펫은 지나온 길을 따라오며, 시점은 캐릭터를 조금 늦게 따라붙습니다.
  // 멈추고 펫이 곁에 서고 시점도 다 따라붙으면 되풀이를 쉽니다.
  const tick = useCallback((time) => {
    const place = roomRef.current;
    const inClass = hereRef.current === "classroom";
    const seated = sittingRef.current !== null;
    const dt = Math.min(0.05, Math.max(0, (time - (lastTick.current || time)) / 1000));
    lastTick.current = time;
    const k = keys.current;
    const dx = seated ? 0 : (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const dy = seated ? 0 : (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const from = pos.current;
    let walking = false;
    if (dx || dy) {
      path.current = [];
      pendingSpot.current = null;
      pendingAct.current = null;
      const len = Math.hypot(dx, dy);
      pos.current = plazaStep(from, dx / len * SPEED * dt, dy / len * SPEED * dt, round.current, place);
    } else if (path.current.length && !seated) {
      const target = path.current[0];
      const distance = Math.hypot(target.x - from.x, target.y - from.y);
      const step = SPEED * dt;
      if (distance <= step) {
        pos.current = { x: target.x, y: target.y };
        path.current.shift();
      } else {
        pos.current = { x: from.x + (target.x - from.x) / distance * step, y: from.y + (target.y - from.y) / distance * step };
      }
      walking = true;
    }
    const mx = pos.current.x - from.x;
    const my = pos.current.y - from.y;
    const moved = Math.hypot(mx, my);
    if (moved > 0.01) walking = true;
    const me = meRef.current;
    if (moved > 0.01 || dt === 0) me?.place(pos.current.x, pos.current.y);
    // 바라보는 쪽 — 움직인 쪽으로. 방향키를 눌렀는데 막혀서 못 움직였으면 누른 쪽을 봅니다. 앉아 있으면 칠판 쪽.
    if (seated) facingRef.current = "up";
    else if (moved > 0.01) facingRef.current = plazaFacing(facingRef.current, mx, my);
    else if (dx || dy) facingRef.current = plazaFacing(facingRef.current, dx, dy);

    // 포털 — 발이 안쪽에 들어서면 그 방으로 옮겨 갑니다. 방금 건너온 포털은 벗어난 뒤에야 다시 듣습니다.
    if (!seated && place.portals.length) {
      if (!portalArmed.current) {
        if (!plazaPortalAt(pos.current, place, PORTAL_REARM)) { portalArmed.current = true; setOnGate(null); }
      } else {
        const gate = plazaPortalAt(pos.current, place);
        if (gate) {
          raf.current = 0;
          lastTick.current = 0;
          movingRef.current = false;
          enterRoom(gate.to);
          return;
        }
      }
    }

    const near = plazaSpotNear(pos.current, PLAZA_NEAR, place)?.id ?? null;
    if (near !== nearRef.current) { nearRef.current = near; setNearId(near); }
    // 교실 — 지금 A를 누르면 물을 것이 있는가(내 자리의 러그 위 · 앉아 있음 · 칠판 앞)
    let ask = null;
    if (inClass) {
      if (isTeacher) ask = classroomAtBoard(pos.current) ? "board" : null;
      else if (seated || (mySeatRef.current !== null && classroomNearSeat(pos.current, mySeatRef.current))) ask = "seat";
    }
    if (ask !== hintRef.current) {
      hintRef.current = ask;
      setHint(ask);
      // 물을 것이 생겼으면(러그에 올라섬 · 칠판 앞에 섬) '어디로 가라'던 한 줄은 걷습니다.
      // 선생님이 방금 옮겨 놓아 뜬 한 줄('선생님이 모두를 교실로 불렀어요')은 잠시 그대로 둡니다 — 옮겨 선 자리가 내 러그입니다.
      if (ask && time >= noteHold.current) say("");
    }
    if (ask === "board") {
      const mark = classroomBoardMark(pos.current);
      if (mark.x !== boardX.current) { boardX.current = mark.x; setBoardMark(mark); }
    }
    // 고르는 중에 걸어 나가면(또는 물을 것이 없어지면) 단추를 걷습니다
    if (menuRef.current && (!ask || (moved > 0.5 && !seated))) setMenu(null);

    const active = walking || dx !== 0 || dy !== 0 || (path.current.length > 0 && !seated);
    if (active !== movingRef.current) {
      movingRef.current = active;
      if (active) {
        setWalked(true);
        stride.current = 0;
      } else setMarker(null);
    }
    // 걷는 그림 — 걸은 거리로 넘깁니다. 멈추면 그쪽을 본 채 선 그림.
    stride.current = walking ? stride.current + moved : 0;
    me?.show(facingRef.current, plazaShownFrame(walking, stride.current));
    if (!path.current.length && !dx && !dy && !seated) {
      if (pendingSpot.current) {
        const spot = pendingSpot.current;
        pendingSpot.current = null;
        if (plazaSpotNear(pos.current, PLAZA_NEAR, place)?.id === spot.id) openSpot(spot);
      } else if (pendingAct.current) {
        // 내 책상 · 칠판을 눌러 걸어왔습니다 — 다 왔으면 고르는 단추를 엽니다
        const want = pendingAct.current;
        pendingAct.current = null;
        if (want === ask) setMenu(want === "board" ? { kind: "board", x: pos.current.x } : { kind: "sit" });
      }
    }

    // 친구들에게 알리기 — 방향키로 걷는 동안은 0.3초에 한 번 지금 자리를, 멈추면 한 번(누른 곳으로 걷기는 walkTo가 알림).
    // 방향키를 누른 채 막혀 있으면 선 것으로 봅니다(누른 쪽을 본 채 — 받는 쪽도 그렇게 그림).
    if (dx || dy) stuck.current = moved > 0.01 ? 0 : stuck.current + dt;
    else stuck.current = 0;
    const mode = dx || dy ? (stuck.current > STUCK_S ? 0 : 2) : path.current.length && !seated ? 1 : 0;
    walkMode.current = mode;
    if (mode === 2 ? told.current !== 2 || time - toldAt.current >= PLAZA_LIVE_KEY_MS : mode === 0 && told.current !== 0) tell(time);

    // 펫 — 걷는 동안은 캐릭터가 지나온 길을 조금 뒤에서, 멈추면 곁자리로 옵니다(lib/readingPlazaSprites.js의 plazaPetFollow).
    // 주인이 자리에 앉아 있는 동안에는 그 책상의 러그 귀에서 기다립니다(책상이 한 줄씩이라 양옆이 복도 — 펫이 있는 쪽으로.
    // 반대쪽은 책상 줄에 막혀 못 갑니다).
    let petBusy = false;
    const pet = myPet.current;
    if (pet) {
      const stay = seated ? classroomSeatSide(sittingRef.current, pet).pet : null;
      const step = plazaPetFollow(pet, { x: pos.current.x, y: pos.current.y, facing: facingRef.current }, dt, { active, moved, from, room: place, stay });
      petBusy = step.busy;
      if (step.walking || dt === 0) me?.placePet(pet.x, pet.y);
      // 알(과 걷는 그림이 없는 펫)은 걷는 동안 통통 뜁니다 — PlazaActor가 CSS로
      me?.showPet(pet.facing, plazaShownFrame(step.walking, pet.stride, PET_STRIDE), step.walking);
    }

    // 함께 있는 친구들(나와 같은 방에 있는 사람만) — 받은 소식대로 걷습니다. 펫은 내 펫과 같은 셈으로 그 뒤를 따릅니다.
    let castBusy = false;
    for (const friend of cast.current.values()) {
      if (friend.room !== hereRef.current) continue;
      const actor = friend.actor;
      const handle = friend.handle;
      const fresh = friend.dirty && !!handle;
      const was = { x: actor.x, y: actor.y };
      const sat = friend.seat !== null;
      // 앉아 있는 친구는 걷지 않습니다(의자에 앉아 칠판 쪽을 봄)
      const step = sat ? { moved: 0, walking: false, busy: false } : plazaRemoteStep(actor, dt, time);
      if (handle && (fresh || step.moved > 0.01)) handle.place(actor.x, actor.y);
      handle?.show(sat ? "up" : actor.facing, plazaShownFrame(step.walking, actor.stride));
      // 이번에 걸었으면 한 프레임 더 — 다 와서 선 자세로 바꿔 그린 뒤에 쉽니다
      if (step.busy || step.moved > 0.01) castBusy = true;
      if (friend.pet) {
        const hop = plazaPetFollow(friend.pet, actor, dt, { active: step.walking, moved: step.moved, from: was, room: place, stay: sat ? classroomSeatSide(friend.seat, friend.pet).pet : null });
        if (handle && (fresh || hop.walking)) handle.placePet(friend.pet.x, friend.pet.y);
        handle?.showPet(friend.pet.facing, plazaShownFrame(hop.walking, friend.pet.stride, PET_STRIDE), hop.walking);
        if (hop.busy) castBusy = true;
      }
      if (fresh) friend.dirty = false;
    }

    // 시점 — 따라붙는 중이면 한 프레임 더. 다 왔으면 정수 px에 맞춰 멈춥니다(이름표 글자가 흐려지지 않게).
    const goal = plazaCamera(view.current, pos.current);
    const ease = calm.current ? 1 : 1 - Math.exp(-dt / CAM_EASE);
    cam.current = { x: cam.current.x + (goal.x - cam.current.x) * ease, y: cam.current.y + (goal.y - cam.current.y) * ease };
    const trailing = Math.abs(goal.x - cam.current.x) > 0.5 || Math.abs(goal.y - cam.current.y) > 0.5;
    if (active || trailing || petBusy || castBusy) raf.current = requestAnimationFrame(tick);
    else {
      cam.current = { x: Math.round(goal.x), y: Math.round(goal.y) };
      raf.current = 0;
      lastTick.current = 0;
    }
    look();
  }, [isTeacher, enterRoom, look, openSpot, say, tell]);

  useLayoutEffect(() => {
    wakeRef.current = () => {
      if (!raf.current) { lastTick.current = 0; raf.current = requestAnimationFrame(tick); }
    };
  }, [tick]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; }, []);

  // ── 함께 있는 친구들 ──
  // 광장 탭을 연 동안만 잇습니다(나가면 놓음). 소식은 네 가지 — 들어옴 · 이름표가 바뀜(펫이 자람) · 걸음 · 나감.
  // 자리와 걸음은 cast(ref)에 두고 걸음 루프가 그리며, 상태(friends)는 누가 어느 방 · 어느 자리에 있는지 · 이름표만 듭니다.
  // 앉았다는 소식은 **그 책상이 자리표에서 그 친구의 것일 때만** 믿습니다(남의 의자에 앉아 보이지 않게) — 믿으면 의자의 자리로 고쳐 둡니다.
  const settle = useCallback((uid, state) => {
    const seat = state.room === "classroom" && state.seat !== null && desksRef.current[state.seat] === uid ? state.seat : null;
    const fixed = seat !== null
      ? { ...state, x: CLASSROOM_SEATS[seat].sit.x, y: CLASSROOM_SEATS[seat].sit.y, mode: 0, path: [], facing: "up", seat }
      : { ...state, seat: null };
    return { seat, fixed };
  }, []);
  useEffect(() => {
    if (!classId || !myUid) return undefined;
    const members = cast.current;
    const attaches = castRefs.current;
    const roomFor = (id) => plazaRoomOf(id, classroomOnRef.current);
    const joined = joinPlazaLive(classId, { uid: myUid, teacher: isTeacher, classroom: classroomOn }, {
      current: liveState,
      // 자리에 앉아 있는 동안은 가만히 있어도 연결을 놓지 않습니다(선생님이 출석을 확인할 때 앉아 있는 모습이 보여야 함)
      keep: () => sittingRef.current !== null,
      onJoin(uid, who, state, ageMs) {
        const now = performance.now();
        const { seat, fixed } = settle(uid, state);
        const actor = plazaRemoteEnter(fixed, ageMs, now);
        const friend = {
          actor, pet: who.pet ? plazaPetStart(actor, actor.facing, roomFor(state.room)) : null, handle: members.get(uid)?.handle ?? null, dirty: true,
          reading: state.reading, room: state.room, seat, state: fixed, heard: state, heardAt: now - ageMs,
        };
        members.set(uid, friend);
        setFriends((list) => [...list.filter((f) => f.uid !== uid), friendRow(uid, who, friend)]);
        wake();
      },
      onWho(uid, who) {
        const friend = members.get(uid);
        if (!friend) return;
        if (!who.pet) friend.pet = null;
        else if (!friend.pet) friend.pet = plazaPetStart(friend.actor, friend.actor.facing, roomFor(friend.room));
        friend.dirty = true;
        setFriends((list) => list.map((f) => (f.uid === uid ? friendRow(uid, who, friend) : f)));
        wake();
      },
      onMove(uid, state) {
        const friend = members.get(uid);
        if (!friend) return;
        const now = performance.now();
        const { seat, fixed } = settle(uid, state);
        const moved = friend.room !== state.room;
        friend.state = fixed;
        friend.heard = state;
        friend.heardAt = now;
        if (!moved && state.room === hereRef.current) plazaRemoteHear(friend.actor, fixed, now, roomRef.current);
        else {
          // 방을 옮겼거나, 내가 보지 않는 방에 있습니다 — 걸어가지 않고 그 자리에 곧바로 세웁니다
          friend.actor = plazaRemoteEnter(fixed, 0, now);
          if (moved && friend.pet) friend.pet = plazaPetStart(friend.actor, friend.actor.facing, roomFor(state.room));
          friend.dirty = true;
        }
        // 자리에서 일어선 친구 — 펫이 책상 줄 건너편에서 기다리고 있었으면 곁으로 데려옵니다(곧게만 걸어 건너오지 못함)
        if (!moved && friend.seat !== null && seat === null && friend.pet) {
          const desk = CLASSROOM_SEATS[friend.seat].rug.x;
          if ((friend.pet.x - desk) * (friend.actor.x - desk) < 0) { friend.pet = plazaPetStart(friend.actor, friend.actor.facing, roomRef.current); friend.dirty = true; }
        }
        if (moved || friend.seat !== seat || friend.reading !== state.reading) {
          friend.room = state.room;
          friend.seat = seat;
          friend.reading = state.reading;
          setFriends((list) => list.map((f) => (f.uid === uid ? { ...f, reading: state.reading, room: state.room, seat } : f)));
        }
        wake();
      },
      onLeave(uid) {
        members.delete(uid);
        attaches.delete(uid);
        setFriends((list) => list.filter((f) => f.uid !== uid));
      },
      onStatus(status, why) { setLive({ status, why: why || "" }); },
    });
    session.current = joined;
    return () => {
      session.current = null;
      joined.close();
      members.clear();
      attaches.clear();
      setFriends([]);
      setLive({ status: "off", why: "" });
    };
  }, [classId, myUid, isTeacher, classroomOn, liveState, settle, wake]);
  // 자리표가 (늦게) 오거나 바뀌면 — 친구들이 앉았다는 소식을 다시 맞춰 봅니다
  useEffect(() => {
    const now = performance.now();
    const changed = new Map();
    for (const [uid, friend] of cast.current) {
      const { seat, fixed } = settle(uid, friend.heard);
      if (seat === friend.seat) continue;
      friend.seat = seat;
      friend.state = fixed;
      friend.actor = plazaRemoteEnter(fixed, 0, now);
      friend.dirty = true;
      changed.set(uid, seat);
    }
    if (!changed.size) return;
    setFriends((list) => list.map((f) => (changed.has(f.uid) ? { ...f, seat: changed.get(f.uid) } : f)));
    wake();
  }, [desks, settle, wake]);
  // 친구 캐릭터의 DOM이 서면(PlazaActor의 손잡이) 지금 자리에 놓습니다 — 사람마다 늘 같은 함수(다시 그릴 때마다 뗐다 붙이지 않게)
  const castRef = useCallback((uid) => {
    let attach = castRefs.current.get(uid);
    if (!attach) {
      attach = (handle) => {
        const friend = cast.current.get(uid);
        if (!friend) return;
        friend.handle = handle;
        if (handle) { friend.dirty = true; wake(); }
      };
      castRefs.current.set(uid, attach);
    }
    return attach;
  }, [wake]);
  // 창(가판대 · 책꽂이)을 여닫으면 '글을 읽는 중'이 바뀝니다 — 친구들에게 알립니다
  const reading = !!panel;
  useEffect(() => { tell(); }, [reading, tell]);

  // ── 교실의 사정이 바뀌면 ──
  // 교실을 끈 반이 되었는데 교실에 있으면 광장으로 나옵니다.
  useEffect(() => {
    if (!classroomOn && roomId === "classroom") enterRoom("plaza");
  }, [classroomOn, roomId, enterRoom]);
  // 방의 바닥이 달라졌으면(교실을 켜고 꺼 광장의 문이 생기고 사라짐) 바닥이 아닌 곳에 서 있지 않게 옮깁니다.
  useEffect(() => {
    if (sittingRef.current !== null || plazaWalkable(pos.current.x, pos.current.y, room)) return;
    pos.current = plazaNearest(pos.current.x, pos.current.y, room);
    path.current = [];
    meRef.current?.place(pos.current.x, pos.current.y);
    wake();
  }, [room, wake]);
  // 내 자리가 (늦게) 정해지거나 바뀌면 — 앉아 있던 자리가 더는 내 자리가 아니면 일어서고, 이 탭에서 앉아 있었으면 다시 앉습니다.
  useEffect(() => {
    if (isTeacher || !classroomOn || layout === undefined) return;
    if (sittingRef.current !== null && sittingRef.current !== mySeat) standUp();
    if (!seatRestored.current) {
      seatRestored.current = true;
      if (here === "classroom" && mySeat !== null && myUid && recall("sessionStorage", seatKey(classId, myUid)) === `${todayDateKey()}:${mySeat}`) sitDown(true);
    }
    // 선생님이 모두를 교실로 불렀는데 자리표를 아직 못 받아 교실 뒤쪽에 세워 둔 학생(화면을 막 연 학생 — 아래 '모두 이동')
    // — 자리표가 왔으니 제 러그로 옮겨 세웁니다. 그사이 걸음을 뗐으면 그대로 둡니다(걷는 학생을 다시 끌어오지 않음).
    const owed = seatOwed.current;
    seatOwed.current = null;
    if (owed && here === "classroom" && mySeat !== null && sittingRef.current === null && !path.current.length
      && pos.current.x === owed.x && pos.current.y === owed.y) {
      enterRoom("classroom", { at: classroomMoveSpot({ to: "classroom", seat: mySeat, uid: myUid }), settle: true });
    }
    wake();
  }, [isTeacher, classroomOn, layout, mySeat, here, classId, myUid, sitDown, standUp, wake, enterRoom]);
  // 선생님의 '모두 이동'(모두 교실로 · 모두 광장으로) — 반 문서의 신호(어느 방으로 · 보낸 때)를 보고 그 방으로 옮깁니다.
  // 학생 화면도, 단추를 누른 선생님 자신의 화면도 같은 길입니다(lib/readingClassroom.js의 classroomMoveCall).
  //   · 보는 동안 새 신호가 오면 곧바로(기기 시계를 보지 않음). 이미 그 방이면 그대로(앉아 있던 학생도 앉은 채).
  //   · 화면을 열었을 때 이미 있던 신호는 한 시간 안의 것이고 이 기기가 아직 따르지 않았을 때만(늦게 들어온 학생).
  //     책꽂이에서 '광장에서 보기'로 넘어온 화면(initialBook)은 그 책을 보러 온 것이라 처음에는 옮기지 않습니다.
  //   · 가판대 · 책꽂이 창을 열어 둔 학생 — 쓰던 댓글이 없으면 창을 닫고, 있으면 창은 둔 채 방만 옮깁니다(글이 날아가지 않게.
  //     창을 닫으면 옮겨 온 방이 보이고 그때 한 줄이 뜹니다).
  // 그리기 전에 맞춥니다(useLayoutEffect) — 화면을 열 때 옛 방이 한 번 보였다가 바뀌지 않게.
  const moveTo = classroom?.moveTo ?? null;
  const moveAt = Number(classroom?.moveAt) || 0;
  useLayoutEffect(() => {
    // 지금까지 본 '보낸 때' 가운데 가장 큰 값을 기억합니다 — 값이 잠깐 비었다 돌아와도 새 신호로 보지 않게
    const prev = seenMove.current;
    seenMove.current = Math.max(prev ?? 0, moveAt);
    if (!classroomOn || !myUid) return;
    if (prev === undefined && initialBook) return;
    const seen = prev === undefined ? Number(recall("localStorage", moveKey(classId, myUid))) || 0 : 0;
    const target = classroomMoveCall({ prev, to: moveTo, at: moveAt, seen, now: Date.now() });
    if (!target) return;
    remember("localStorage", moveKey(classId, myUid), String(moveAt));
    if (target === hereRef.current) return;
    // 알리는 한 줄 — 학생에게는 옮겨 온 까닭을, 선생님에게는(방금 눌렀을 때만) 누가 함께 옮겨 오는지를
    const note = !isTeacher ? GATHER_NOTE[target] : prev !== undefined ? GATHER_DONE[target] : "";
    // 쓰던 댓글이 있는 창은 닫지 않습니다(창 안의 글 칸에 글이 들어 있는가 — 창은 이 화면에 하나뿐)
    const drafting = panelOpen.current && typeof document !== "undefined"
      && [...document.querySelectorAll(".plaza-panel textarea")].some((el) => el.value.trim());
    if (panelOpen.current && !drafting) setPanel(null);
    lateNote.current = drafting ? note : "";
    enterRoom(target, {
      at: classroomMoveSpot({ to: target, teacher: isTeacher, seat: mySeatRef.current, uid: myUid }),
      note: drafting ? "" : note,
    });
    // 자리표를 아직 못 받았으면(화면을 막 연 학생) 지금은 교실 뒤쪽에 섰습니다 — 자리표가 오면 제 러그로 옮겨 세웁니다(위)
    seatOwed.current = !isTeacher && target === "classroom" && layoutRef.current === undefined ? { ...pos.current } : null;
  }, [moveTo, moveAt, classroomOn, classId, myUid, isTeacher, initialBook, enterRoom]);
  // [선생님] 맵 위의 '모두 교실로 · 모두 광장으로' — 신호를 적습니다(선생님 자신도 그 신호를 따라 옮겨 감 — 위).
  //   · 누른 뒤 잠깐(GATHER_GAP_MS)은 다시 눌러도 듣지 않습니다. 단추는 누르는 순간 저쪽 방의 것으로 바뀌므로,
  //     두 번 눌리면(더블클릭 · Enter를 누른 채) 반 전체가 갔다가 곧바로 되돌아옵니다. 저장이 끝나기를 기다리는
  //     잠금이 아니라 시간으로 막습니다 — 연결이 끊긴 동안에는 저장이 끝나지 않아 단추가 죽은 채 남습니다.
  //   · 누르고 나면 초점을 무대로 돌려 곧바로 방향키 · A로 움직일 수 있게 합니다(단추에 초점이 남으면 Enter · Space가
  //     다시 단추를 누릅니다).
  const moveAll = useCallback(() => {
    const send = classroomRef.current?.onMoveAll;
    const now = performance.now();
    if (!send || now < movingAll.current) return;
    movingAll.current = now + GATHER_GAP_MS;
    stageRef.current?.focus({ preventScroll: true });
    Promise.resolve(send(hereRef.current === "classroom" ? "plaza" : "classroom")).catch(() => {});
  }, []);
  // [학생] 선생님의 출석 확인 — 반 문서의 '확인한 때'가 바뀌는 것을 본 순간 제자리에 앉아 있으면 출석을 남깁니다.
  // 화면을 열고 처음 본 값은 기준일 뿐입니다(그 뒤에 들어온 학생은 그때 접속하지 않은 학생 — lib/readingClassroom.js).
  const rollCall = classroom?.rollCall ?? null;
  useEffect(() => {
    const prev = seenCall.current;
    seenCall.current = rollCall;
    if (isTeacher || !classroomOn) return;
    if (classroomRollCall({ prev, call: rollCall, openToday: openTodayRef.current, seated: sittingRef.current !== null, attended: attendedRef.current })) {
      classroomRef.current?.onAttend?.();
    }
  }, [rollCall, isTeacher, classroomOn]);

  // 무대의 크기 — 탭 바로 아래부터 화면 바닥까지를 맵이 채웁니다(선생님 요청).
  // 책방 본문은 제 안에서 구르는 칸(.books-main)이라 CSS만으로는 '남은 높이'를 모릅니다. 그 칸의 높이에서 무대 위쪽까지의
  // 거리와 무대 아래에 남는 것(책나눔 틀 · 본문 칸의 아래 여백 — 무대 크기와 무관한 값)을 빼서 정합니다.
  // 창이 아주 낮으면 STAGE_MIN_H까지만 줄고 나머지는 구릅니다. 그리기 전에 재야 처음부터 제 크기로 섭니다(useLayoutEffect).
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const scroller = plazaScroller(wrap);
    // 구르는 칸(없으면 본문 main)의 바로 아래 자식 가운데 무대를 품은 것 — 책나눔 틀(교사 화면은 명단까지 품은 틀)
    const frame = scroller ?? wrap.closest("main") ?? document.body;
    let top = wrap;
    while (top.parentElement && top.parentElement !== frame && top.parentElement !== document.body) top = top.parentElement;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const left = stageRoom(wrap, scroller);
      const below = Math.max(0, top.getBoundingClientRect().bottom - rect.bottom) + (parseFloat(getComputedStyle(frame).paddingBottom) || 0);
      const next = { w: Math.ceil(rect.width), h: Math.max(STAGE_MIN_H, Math.floor(left - below)) };
      setSize((current) => (current && current.w === next.w && current.h === next.h ? current : next));
    };
    measure();
    window.addEventListener("resize", measure);
    // 옆 패널을 접고 펴면 폭이, 위에 알림 줄이 생기면 무대의 자리가 바뀝니다 — 틀 · 무대 칸 · 구르는 칸을 함께 지켜봅니다.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) {
      observer.observe(wrap);
      if (top !== wrap) observer.observe(top);
      if (scroller) observer.observe(scroller);
    }
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, []);

  // 무대 크기가 정해지면(바뀌면) 그림 크기와 시점을 맞춥니다 — 이때는 미끄러지지 않고 곧바로.
  useLayoutEffect(() => {
    if (!size) return;
    view.current = plazaView(size.w, size.h);
    const goal = plazaCamera(view.current, pos.current);
    cam.current = { x: Math.round(goal.x), y: Math.round(goal.y) };
    look();
  }, [size, look]);

  // 그곳으로 걸어갑니다 — spot(다 와서 열 곳) · act(다 와서 물을 것 — "seat" · "board")
  const walkTo = useCallback((point, spot = null, act = null) => {
    const place = roomRef.current;
    const goal = plazaNearest(point.x, point.y, place);
    const route = plazaPath(pos.current, goal, place);
    if (!route.length) return;
    path.current = route;
    pendingSpot.current = spot;
    pendingAct.current = act;
    setMarker(spot || act ? null : { x: goal.x, y: goal.y, key: Date.now() });
    // 어디에서 어느 길로 걷는지를 한 번 알립니다(걸음마다 올리지 않음 — 친구 화면이 같은 빠르기로 그림)
    walkMode.current = 1;
    tell();
    wake();
  }, [tell, wake]);

  // 책꽂이 · 가판대로 — 이미 그 앞이면 곧바로 열고, 아니면 걸어가서 엽니다.
  // 이름표(단추)를 눌러도 초점은 무대에 둡니다 — 이어서 방향키로 걸을 수 있게.
  const goSpot = useCallback((spot) => {
    stageRef.current?.focus({ preventScroll: true });
    if (plazaSpotNear(pos.current, PLAZA_NEAR, roomRef.current)?.id === spot.id) { openSpot(spot); return; }
    walkTo(spot.stand, spot);
  }, [openSpot, walkTo]);
  // 포털로 — 한가운데로 걸어가면 옮겨 갑니다
  const goPortal = useCallback((gate) => {
    stageRef.current?.focus({ preventScroll: true });
    if (sittingRef.current !== null) { say(SIT_HELP); return; }
    walkTo({ x: gate.x, y: gate.y });
  }, [say, walkTo]);

  // ── A(행동) · S · C ──
  // A — 광장에서는 앞에 선 책꽂이 · 가판대를 열고, 교실에서는 고르는 단추를 엽니다(다시 누르면 닫음).
  const act = useCallback(() => {
    if (hereRef.current !== "classroom") {
      const spot = roomRef.current.spots.find((s) => s.id === nearRef.current);
      if (spot) openSpot(spot);
      return !!spot;
    }
    if (menuRef.current) { setMenu(null); return true; }
    const what = classroomAct({ teacher: isTeacher, point: pos.current, seat: mySeatRef.current, sitting: sittingRef.current });
    if (what.kind === "sit" || what.kind === "stand" || what.kind === "board") {
      halt();
      setMarker(null);
      // 칠판의 고르는 단추는 선생님 옆에 뜹니다 — 선 자리(x)를 함께 듭니다(단추가 떠 있는 동안에는 걷지 않음 · 걸으면 닫힘)
      setMenu(what.kind === "board" ? { kind: "board", x: pos.current.x } : { kind: what.kind });
      return true;
    }
    if (what.kind === "noseat") say("아직 내 자리가 없어요. 선생님께 자리 배정을 부탁해 주세요.");
    else if (what.kind === "other") say(`여기는 ${desksRef.current[what.at] ? "다른 친구의 자리" : "빈자리"}예요. 내 자리는 ${classroomSeatLabel(what.seat)}예요.`);
    else if (isTeacher) say("칠판 앞에 서서 A를 누르면 출석시작(S) · 출석종료(C)를 고를 수 있어요.");
    else say(`내 자리의 러그에 올라서서 A를 누르면 앉을 수 있어요. 내 자리는 ${classroomSeatLabel(what.seat)}예요.`);
    return true;
  }, [isTeacher, halt, openSpot, say]);
  // S(첫 단추) · C(둘째 단추)
  const choose = useCallback((primary) => {
    const kind = menuRef.current?.kind;
    if (!kind) return;
    stageRef.current?.focus({ preventScroll: true });
    if (kind === "sit") { if (primary) sitDown(); else setMenu(null); return; }
    if (kind === "stand") { if (primary) standUp(); else setMenu(null); return; }
    // 칠판 — 출석시작은 열려 있어도 다시 누를 수 있고(한 번 더 확인), 출석종료는 열려 있을 때만(아니면 그냥 닫음)
    setMenu(null);
    if (primary) classroomRef.current?.onRollCall?.();
    else if (openTodayRef.current) classroomRef.current?.onStop?.();
  }, [sitDown, standUp]);
  const pressAct = useCallback(() => {
    stageRef.current?.focus({ preventScroll: true });
    act();
  }, [act]);

  // 누르기(click)에만 걷습니다 — pointerdown에 걸면 손가락으로 화면을 굴리려던 것도 걷기로 읽힙니다.
  // 누른 자리는 그림(.plaza-world)의 화면 자리로 셉니다 — 시점이 옮겨 가 있어도 그대로 맞습니다.
  function onStageClick(e) {
    if (e.target.closest?.("button")) return;
    const world = worldRef.current;
    if (!world) return;
    const rect = world.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) / rect.width * PLAZA_W;
    const y = (e.clientY - rect.top) / rect.height * PLAZA_H;
    stageRef.current.focus({ preventScroll: true });
    if (sittingRef.current !== null) {
      // 앉아 있는 동안 — 내 자리를 누르면 다시 서기를 묻고(자판이 없는 기기), 다른 곳을 누르면 어떻게 일어서는지 알려 줍니다
      if (classroomSeatAt(x, y) === sittingRef.current) setMenu((current) => (current ? null : { kind: "stand" }));
      else say(SIT_HELP);
      return;
    }
    if (menuRef.current) setMenu(null);
    const spot = plazaSpotAt(x, y, room);
    if (spot) { goSpot(spot); return; }
    if (here === "classroom") {
      // 내 책상을 누르면 그 러그로(지금 선 곳에서 가까운 쪽 귀) 가서 앉기를 묻고, 선생님이 칠판을 누르면 그 앞으로 가서 출석을 묻습니다
      if (mySeat !== null && classroomSeatAt(x, y) === mySeat) {
        if (classroomNearSeat(pos.current, mySeat)) { halt(); setMenu({ kind: "sit" }); } else walkTo(classroomSeatSide(mySeat, pos.current).stand, null, "seat");
        return;
      }
      if (isTeacher && classroomBoardAt(x, y)) {
        if (classroomAtBoard(pos.current)) { halt(); setMenu({ kind: "board", x: pos.current.x }); } else walkTo(classroomBoardStand(x), null, "board");
        return;
      }
    }
    const gate = plazaPortalClicked(x, y, room);
    walkTo(gate ? { x: gate.x, y: gate.y } : { x, y });
  }
  function onKeyDown(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // 무대 자체, 또는 무대 안의 고르는 단추(.plaza-act) · 물음표에 초점이 있을 때만 듣습니다
    const onButton = e.target !== e.currentTarget;
    if (onButton && !e.target.closest?.(".plaza-act, .plaza-mark")) return;
    const dir = plazaArrowKey(e);
    if (dir) {
      e.preventDefault();   // 방향키가 페이지를 굴리지 않게
      if (sittingRef.current !== null) { if (!e.repeat) say(SIT_HELP); return; }
      keys.current[dir] = true;
      wake();
      return;
    }
    if (e.key === "Escape") {
      // 고르는 단추만 닫습니다(preventDefault — 공통 Esc 처리가 이 키를 또 쓰지 않게)
      if (menuRef.current) { e.preventDefault(); setMenu(null); }
      return;
    }
    if (e.repeat) return;
    const letter = plazaLetterKey(e);
    if (menuRef.current && (letter === "s" || letter === "c")) {
      e.preventDefault();
      choose(letter === "s");
      return;
    }
    // A — 행동. Enter · Space도 같은 일을 합니다(단추에 초점이 있으면 그 단추를 누르는 키라 건드리지 않음).
    if (letter === "a" || (!onButton && (e.key === "Enter" || e.key === " "))) {
      if (act() || letter === "a") e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const dir = plazaArrowKey(e);
    if (dir) keys.current[dir] = false;
  }
  function stopKeys() {
    keys.current = NO_KEYS();
  }
  // 창 밖에 있는 이름표에 Tab으로 초점이 가면 브라우저가 무대를 굴려 보여 주려 합니다 — 시점은 transform이 맡으므로 되돌립니다.
  function keepStill(e) {
    const el = e.currentTarget;
    if (el.scrollTop) el.scrollTop = 0;
    if (el.scrollLeft) el.scrollLeft = 0;
  }

  const pet = petOn && !isTeacher ? petProgress(petState?.mirror ?? null, growthXp ?? 0) : null;
  // 펫이 (늦게) 나타나면 지금 캐릭터 곁에 세웁니다 — 펫 자료가 늦게 와 그사이 걸어 나갔을 수 있습니다.
  // 그리면서 맞춥니다(한 번) — 처음 자리에 한 번 보였다가 옮겨 가지 않게.
  if (!pet) myPet.current = null;
  else if (!myPet.current) myPet.current = plazaPetStart(pos.current, facingRef.current, room);

  const world = size ? plazaView(size.w, size.h) : null;
  const who = useMemo(() => characterOf({ uid: myUid || "", character: characterOn ? character : null }), [myUid, characterOn, character]);
  const myName = isTeacher ? "선생님" : user?.realName || user?.displayName || "나";
  const liveNote = live.status === "off" && isTeacher ? LIVE_NOTES[live.why] : "";
  // 나와 같은 방에 있는 친구들 · 의자에 앉아 있는 자리들(그 책상의 이름표는 몸에 가려 걷습니다)
  const mates = friends.filter((f) => f.room === here);
  const inClass = here === "classroom";
  // [선생님] 모두 이동 단추가 서는가 · 옮길 저쪽 방
  const canGather = isTeacher && classroomOn && !!classroom?.onMoveAll;
  const other = inClass ? "plaza" : "classroom";
  const roster = isTeacher ? classroom?.roster ?? null : null;
  const names = useMemo(() => new Map((roster ?? []).map((s) => [s.uid, s])), [roster]);
  const seated = useMemo(() => {
    const set = new Set(friends.filter((f) => f.room === "classroom" && f.seat !== null).map((f) => f.seat));
    if (sitting !== null) set.add(sitting);
    return set;
  }, [friends, sitting]);
  const presentUids = isTeacher ? classroom?.presentUids ?? null : null;
  const roll = useMemo(() => (roster ? classroomAttendance(roster, presentUids) : null), [roster, presentUids]);
  const unseated = useMemo(() => (inClass && roster ? classroomUnseated(desks, roster) : []), [inClass, roster, desks]);
  const stageLabel = !inClass
    ? "책 광장 마당. 누른 곳으로 걸어가고 방향키로도 걷습니다. 책꽂이나 가판대 앞에서 A 또는 Enter로 엽니다."
    : isTeacher ? "교실. 누른 곳으로 걸어가고 방향키로도 걷습니다. 칠판 앞에서 A를 누르면 출석시작(S)과 출석종료(C)를 고릅니다."
      : "교실. 누른 곳으로 걸어가고 방향키로도 걷습니다. 내 자리의 러그에 올라서서 A를 누르면 앉기(S)와 취소(C)를 고르고, 앉은 채 A를 누르면 다시 서기(S)를 고릅니다.";

  return (
    <section className="plaza" aria-label={ROOM_NAME[here]}>
      <div className={`plaza-stage-wrap${live.status !== "off" || liveNote ? " has-live" : ""}${canGather ? " has-gather" : ""}`} ref={wrapRef}>
        <div className={`plaza-stage plaza-stage--${here}`} ref={stageRef} tabIndex={0} role="application" aria-label={stageLabel}
          style={size ? { height: size.h } : undefined}
          onClick={onStageClick} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={stopKeys} onScroll={keepStill}>
          {/* 그림 — 무대를 빈틈없이 덮게 키운 크기. 자리(transform)는 시점이 DOM에 곧바로 적습니다(look) */}
          {world && (
            <div className="plaza-world" ref={worldRef} style={{ width: world.worldW, height: world.worldH }}>
              <img className="plaza-bg" src={room.art} alt="" width={PLAZA_W} height={PLAZA_H} draggable={false} />
              {/* 교실 — 러그와 책상·의자(배경에는 없음). 자리 좌표대로 서른 벌 */}
              {inClass && <PlazaFurniture />}
              {/* 포털 — 바닥에 놓는 그림 위에 도는 빛을 얹고, 어디로 가는지 이름표를 답니다 */}
              {room.portals.map((gate) => (
                <Fragment key={gate.id}>
                  <img className="plaza-portal-base" src={PORTAL_ART.src} alt="" draggable={false}
                    style={{ left: pct(gate.art.x - gate.art.w / 2, PLAZA_W), top: pct(gate.art.y - gate.art.h / 2, PLAZA_H), width: pct(gate.art.w, PLAZA_W), height: pct(gate.art.h, PLAZA_H) }} />
                  <span className="plaza-portal" aria-hidden="true"
                    style={{ left: pct(gate.x - gate.swirl.rx, PLAZA_W), top: pct(gate.y - gate.swirl.ry, PLAZA_H), width: pct(gate.swirl.rx * 2, PLAZA_W), height: pct(gate.swirl.ry * 2, PLAZA_H), "--portal-k": (gate.swirl.ry / gate.swirl.rx).toFixed(4) }}>
                    <img src={PORTAL_ART.swirl} alt="" draggable={false} />
                  </span>
                  {/* 이름표 — 포털에 선 캐릭터(발이 못 안쪽)보다 뒤 층에 두어 얼굴을 덮지 않고, 내가 막 건너와 서 있는 동안에는 걷습니다 */}
                  <button type="button" className={`plaza-sign plaza-sign--portal${onGate === gate.id ? " is-under" : ""}`}
                    style={{ left: pct(gate.sign.x, PLAZA_W), top: pct(gate.sign.y, PLAZA_H), zIndex: 9 + Math.floor(gate.y - gate.ry) }}
                    tabIndex={onGate === gate.id ? -1 : undefined} aria-hidden={onGate === gate.id || undefined}
                    onClick={() => goPortal(gate)} aria-label={`${gate.label} — 포털로 걸어가기`}>{gate.label}</button>
                </Fragment>
              ))}
              {room.spots.map((spot) => (
                <button key={spot.id} type="button" className={`plaza-sign plaza-sign--${spot.place} plaza-sign--${spot.align}${nearId === spot.id ? " is-near" : ""}`}
                  style={{ left: pct(spot.sign.x, PLAZA_W), top: pct(spot.sign.y, PLAZA_H) }}
                  onClick={() => goSpot(spot)}
                  aria-label={`${spot.label} — ${PLACE_NAME[spot.place]} ${counts[spot.place]}권${nearId === spot.id ? " · 열기" : " · 걸어가기"}`}>
                  <span className="plaza-sign-name">{PLACE_NAME[spot.place]}</span>
                  <b>{counts[spot.place]}</b>
                  {counts[`${spot.place}Week`] > 0 && <i>이번 주 {counts[`${spot.place}Week`]}</i>}
                  {nearId === spot.id && <em>눌러서 열기</em>}
                </button>
              ))}
              {inClass && (
                <PlazaClassroom teacher={isTeacher} desks={desks} names={names} mySeat={mySeat} sitting={sitting} hint={hint} boardMark={boardMark} menu={menu}
                  present={presentUids} attended={attended} openToday={openToday} roll={roll} seated={seated} onAct={pressAct} onChoose={choose} />
              )}
              {marker && <span key={marker.key} className="plaza-marker" style={{ left: pct(marker.x, PLAZA_W), top: pct(marker.y, PLAZA_H) }} aria-hidden="true" />}
              {/* 캐릭터 · 펫(PlazaActor) — 닻(크기 0)이 발이 닿는 점에 서고, 그림 · 이름표 · 그림자가 그 점을 기준으로 놓입니다.
                  자리는 걷는 동안 DOM에 곧바로 적습니다 — 다시 그릴 때도 지금 자리(at · petAt)를 그대로 적어 튀지 않게.
                  함께 있는 친구들이 먼저, 내 캐릭터가 나중(같은 높이에 겹치면 내가 앞) */}
              {mates.map((friend) => {
                const member = cast.current.get(friend.uid);
                if (!member) return null;
                return (
                  <PlazaActor key={friend.uid} ref={castRef(friend.uid)} character={friend.character} pet={member.pet ? friend.pet : null}
                    name={friend.name} teacher={friend.teacher} reading={friend.reading} scale={world.scale} at={member.actor} petAt={member.pet}
                    seat={friend.seat !== null ? CLASSROOM_SEATS[friend.seat] : null} checked={inClass && !friend.teacher && !!presentUids?.has(friend.uid)} />
                );
              })}
              <PlazaActor ref={meRef} me character={who} pet={pet} name={myName} reading={reading} scale={world.scale} at={pos.current} petAt={myPet.current}
                seat={inClass && sitting !== null ? CLASSROOM_SEATS[sitting] : null} checked={inClass && attended} />
            </div>
          )}
          {/* 방을 옮길 때의 반짝임 — 옮길 때마다 새로 그려 한 번 돕니다 */}
          {warp > 0 && <span key={warp} className="plaza-warp" aria-hidden="true" />}
        </div>
        {/* 맵 위에 얹는 것 — 제목과 '나가기'(왼쪽 위) · 가판대/책꽂이 단추 또는 교실의 알림(오른쪽 위) · 걷는 법(아래, 첫걸음 전까지).
            무대 밖(형제)에 두어 여기를 눌러도 캐릭터가 걷지 않습니다. */}
        <div className="plaza-hud">
          <div className="plaza-hud-lead">
            {/* 선생님(교실을 켠 반) — 방 이름 팻말 자리에 '모두 교실로 · 모두 광장으로'(선생님 요청). 지금 책 광장 탭을 열어 둔
                학생과 선생님 자신을 저쪽 방으로 옮깁니다. 학생과 교실을 끈 반은 지금처럼 방 이름입니다. */}
            {canGather
              ? <button type="button" className="plaza-title plaza-gather" onClick={moveAll}
                  title={`지금 책 광장 탭을 열어 둔 학생과 선생님을 모두 ${ROOM_NAME[other]}${other === "classroom" ? "로" : "으로"} 옮깁니다`}
                  aria-label={`${GATHER_LABEL[other]} — 지금은 ${ROOM_NAME[here]}. 책 광장 탭을 열어 둔 학생과 선생님을 모두 옮깁니다`}>{GATHER_LABEL[other]}</button>
              : <h3 className="plaza-title">{ROOM_NAME[here]}</h3>}
            {onExit && <button type="button" className="plaza-exit" onClick={onExit} aria-label={`${ROOM_NAME[here]}에서 나가기`}>나가기</button>}
          </div>
          {!inClass ? (
            <div className="plaza-hud-actions">
              <button type="button" onClick={() => setPanel({ place: "stall" })}>가판대 <small>{PLACE_NAME.stall}</small> <b>{counts.stall}</b></button>
              <button type="button" onClick={() => setPanel({ place: "shelf" })}>책꽂이 <small>{PLACE_NAME.shelf}</small> <b>{counts.shelf}</b></button>
            </div>
          ) : (
            <div className="plaza-hud-room">
              {/* 선생님 — 오늘 출석(받는 중이면 그 사실) · 자리표에 없는 학생 */}
              {isTeacher && roll && (openToday || roll.present > 0) && (
                <p className={`plaza-roll${openToday ? " is-open" : ""}`} role="status">
                  <i aria-hidden="true" />{openToday ? "출석 받는 중" : "오늘 출석"}<span><b>{roll.present}</b>/{roll.total}</span>
                </p>
              )}
              {isTeacher && unseated.length > 0 && (
                <p className="plaza-roll plaza-roll--warn" role="status">
                  <span>자리표에 없는 학생 <b>{unseated.length}</b>명</span>
                  {classroom?.onSeatSetup && <button type="button" onClick={classroom.onSeatSetup}>자리 배정하기</button>}
                </p>
              )}
              {/* 학생 — 내 자리가 어디인지(없으면 그 사실) · 오늘 출석했는지 */}
              {!isTeacher && layout !== undefined && (
                mySeat === null
                  ? <p className="plaza-roll plaza-roll--warn" role="status">아직 내 자리가 없어요 — 선생님께 자리 배정을 부탁해 주세요</p>
                  : <p className={`plaza-roll${attended ? " is-done" : ""}`} role="status">
                      {attended ? <><i aria-hidden="true" />오늘 출석 완료</> : <>내 자리 · {classroomSeatLabel(mySeat)}</>}
                    </p>
              )}
            </div>
          )}
          {/* 함께 있는 사람 — 이어졌으면 '지금 n명'(나 포함 · 이 방에 있는 사람), 쉬는 화면이면 그 사실. 잇지 못했을 때의 까닭은 선생님께만 */}
          {live.status === "live" && <p className="plaza-live" role="status" title={`지금 ${ROOM_NAME[here]}에 함께 있는 사람(나 포함)`}><i aria-hidden="true" /><span>지금 <b>{mates.length + 1}</b>명</span></p>}
          {live.status === "connecting" && <p className="plaza-live plaza-live--connecting" role="status"><i aria-hidden="true" />친구들을 찾는 중…</p>}
          {live.status === "resting" && <p className="plaza-live plaza-live--resting" role="status"><i aria-hidden="true" />쉬는 중 — 움직이면 친구들이 다시 보여요</p>}
          {liveNote && <p className="plaza-live plaza-live--note" role="status">{liveNote}</p>}
          {error && <div className="plaza-hud-error" role="alert">{error}</div>}
          {note
            ? <p key={note.key} className="plaza-hint plaza-hint--note" role="status">{note.text}</p>
            : !walked && (
              !inClass ? <p className="plaza-hint" aria-hidden="true">마당을 누르면 그곳으로 걸어가요<span> · 방향키로도 걷고, 책꽂이와 가판대 앞에서 A(또는 눌러서)로 열어요{classroomOn ? " · 왼쪽 아래 포털은 교실로 가요" : ""}</span></p>
                : isTeacher ? <p className="plaza-hint" aria-hidden="true">칠판 앞에서 A를 누르면<span> 출석시작(S) · 출석종료(C)를 골라요 · 방향키나 누르기로 걸어요</span></p>
                  : sitting !== null ? <p className="plaza-hint" aria-hidden="true">자리에 앉아 있어요<span> · 일어서려면 A를 누르고 다시 서기(S)를 골라요</span></p>
                    : <p className="plaza-hint" aria-hidden="true">내 자리의 러그에 올라서면 물음표가 떠요<span> · A를 누르고 앉기(S)를 골라요 · 방향키나 누르기로 걸어요</span></p>
            )}
        </div>
      </div>
      {panel && (
        <PlazaPanel classId={classId} user={user} isTeacher={isTeacher} shelves={shelves ?? []} loading={shelves === null}
          place={panel.place} friendUid={panel.friendUid ?? null} book={panel.book ?? null}
          onNavigate={(next) => setPanel((current) => ({ ...current, ...next }))}
          onClose={() => {
            setPanel(null);
            stageRef.current?.focus({ preventScroll: true });
            // 창을 열어 둔 사이(쓰던 댓글이 있어 닫지 않음) 선생님이 방을 옮겨 놓았으면 이제 알립니다
            if (lateNote.current) {
              noteHold.current = performance.now() + NOTE_MS;
              say(lateNote.current);
              lateNote.current = "";
            }
          }} />
      )}
    </section>
  );
}
