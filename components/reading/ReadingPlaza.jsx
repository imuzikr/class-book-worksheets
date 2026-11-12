"use client";
// =============================================================
// 책 광장 — 책나눔의 셋째 탭(광장을 켠 반에서 '우리 반 랭킹' 자리에 섬 · 선생님 요청)
// -------------------------------------------------------------
// 광장 그림 위를 내 캐릭터(와 펫)가 걸어 다닙니다 — 누른 곳으로 걸어가고, 방향키 · WASD로도 걷습니다.
//   · 가판대(셋) = 반 친구들이 지금 읽고 있는 책(독서 발자국)
//   · 책꽂이    = 반 친구들이 꽂아 둔 완독한 책(한 권의 책)
// 앞에 서면(또는 눌러서) 창이 열려 책을 고르고, 글을 읽고, 댓글을 남깁니다(PlazaPanel).
// 걷는 길 · 여는 곳은 lib/readingPlazaMap.js, 목록의 셈은 lib/readingPlaza.js, 자료는 lib/data/plaza.js.
// 이 화면(과 창 PlazaPanel)은 광장 탭을 열 때만 내려받습니다(ReadingHub의 dynamic import).
//
// 맵이 화면을 가득 채웁니다(선생님 요청) — **상단바 바로 아래부터 화면 바닥 · 좌우 끝까지**가 무대(.plaza-stage = 보이는 창)이고
// (광장 탭에서는 책방 머리말 · 탭 줄 · 옆 패널을 가림 — plaza.css의 '광장 탭'), 나가는 길은 맵 위의 '나가기'입니다.
// 그림(.plaza-world)은 그 창을 빈틈없이 덮도록 키웁니다(셈은 lib/readingPlazaMap.js의 plazaView · plazaCamera).
// 그림과 화면의 비율이 달라 넘치는 쪽은 **시점이 캐릭터를 따라가며** 보여 줍니다(넓은 화면은 위아래로,
// 폰처럼 좁은 화면은 좌우로). 제목 '책 광장'과 가판대 · 책꽂이 단추는 줄을 따로 차지하지 않고 맵 위 모서리에 얹습니다(.plaza-hud).
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
// 주소(NEXT_PUBLIC_FIREBASE_DATABASE_URL)를 넣지 않은 배포에서는 지금까지처럼 내 캐릭터만 보입니다.
//
// 캐릭터 · 펫의 움직임, 바라보는 쪽, 걷는 그림, 시점은 React 상태가 아니라 ref와 requestAnimationFrame으로
// DOM(과 캔버스)에 곧바로 적습니다(프레임마다 다시 그리지 않게 — 캐릭터 한 명의 DOM은 PlazaActor.jsx).
// 어디 앞인지 · 갈 곳 표시 · 첫걸음을 뗐는지 · 누가 함께 있는지(이름표)만 상태입니다.
// =============================================================
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { subscribeMyReadingCharacter, subscribeMyReadingPet } from "@/lib/data/reading";
import { subscribePlazaShelves } from "@/lib/data/plaza";
import { joinPlazaLive, plazaLiveConfigured } from "@/lib/data/plazaLive";
import { characterOf } from "@/lib/readingCharacterCatalog";
import { petProgress } from "@/lib/readingPet";
import { plazaItems } from "@/lib/readingPlaza";
import { PLAZA_LIVE_KEY_MS, plazaRemoteEnter, plazaRemoteHear, plazaRemoteStep, plazaSpawnFor } from "@/lib/readingPlazaLive";
import {
  PLAZA_H, PLAZA_SPAWN, PLAZA_SPOTS, PLAZA_W,
  plazaCamera, plazaNearest, plazaPath, plazaSpotAt, plazaSpotNear, plazaStep, plazaView,
} from "@/lib/readingPlazaMap";
import { PET_STRIDE, PLAZA_WALK_SPEED, SPRITE_IDLE, plazaFacing, plazaPetFollow, plazaPetStart, plazaWalkFrame } from "@/lib/readingPlazaSprites";
import { PLAZA_STAGE_MIN_H, plazaRoom, plazaScroller } from "@/lib/plazaStageRoom";
import PlazaActor from "./PlazaActor";
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
const KEY_DIRS = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down",
};
const PLACE_NAME = { stall: "지금 읽는 책", shelf: "완독한 책" };
const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;
// 함께 보기를 잇지 못했을 때 선생님께만 보이는 한 줄(학생에게는 광장이 지금까지처럼 보일 뿐)
const LIVE_NOTES = {
  server: "친구들의 캐릭터를 함께 보지 못하고 있어요 — Realtime Database를 만들었는지, 주소(환경변수)가 맞는지 확인해 주세요.",
  denied: "친구들의 캐릭터를 함께 보지 못하고 있어요 — Realtime Database 규칙이 게시되었는지 확인해 주세요.",
};
// 입장권의 펫({ species, stage } · 알이면 species가 없음)을 PlazaActor가 받는 모양으로
const friendPet = (pet) => (pet ? { species: pet.species, stage: pet.stage, hatched: !!pet.species, ready: false } : null);
const friendRow = (uid, who, reading) => ({
  uid, name: who.name, teacher: who.teacher, character: characterOf({ uid, character: who.character }), pet: friendPet(who.pet), reading: !!reading,
});

// initialBook — 책꽂이에서 '광장에서 보기'로 넘어올 때 곧바로 열 책({ uid, bookId, place })
// onExit — 맵 위의 '나가기'(광장에서 나가 책나눔의 첫 탭 '책꽂이'로 — 광장 탭에서는 탭 줄을 가리므로 나가는 길은 이 단추)
export default function ReadingPlaza({ classId, user, isTeacher = false, characterOn = true, petOn = false, growthXp = null, initialBook = null, onExit = null }) {
  const myUid = user?.uid;
  const [shelves, setShelves] = useState(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState(() => initialBook ? { place: initialBook.place || "stall", book: { uid: initialBook.uid, bookId: initialBook.bookId } } : null);
  const [character, setCharacter] = useState(null);
  const [petState, setPetState] = useState(null);
  // 무대(보이는 창)의 크기 { w, h } — 폭은 본문 칸의 폭, 높이는 무대 위쪽부터 화면(구르는 칸) 바닥까지 남은 만큼(아래 measure)
  const [size, setSize] = useState(null);
  const [nearId, setNearId] = useState(null);
  const [marker, setMarker] = useState(null);
  // 걷는 법 안내(맵 아래쪽에 얹은 한 줄) — 첫걸음을 떼면 사라집니다
  const [walked, setWalked] = useState(false);
  // 함께 있는 친구들 — 이름표 · 캐릭터 · 펫(그릴 것만. 자리와 걸음은 cast에) · 연결 상태
  const [friends, setFriends] = useState([]);
  const [live, setLive] = useState({ status: "off", why: "" });

  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  // 내 캐릭터(와 펫)의 DOM — PlazaActor가 내어 준 손잡이(place · show · placePet · showPet)
  const meRef = useRef(null);
  // 처음 서는 자리 — 함께 보는 광장에서는 사람마다 조금씩 다른 자리(모두 한 점에 겹치지 않게), 아니면 늘 같은 자리
  const pos = useRef(null);
  if (pos.current === null) pos.current = myUid && plazaLiveConfigured() ? plazaSpawnFor(myUid) : { ...PLAZA_SPAWN };
  // 그림을 얼마나 키웠나(plazaView) · 시점(그림의 어느 자리가 창의 왼쪽 위인가, 화면 px)
  const view = useRef(plazaView(0, 0));
  const cam = useRef({ x: 0, y: 0 });
  const path = useRef([]);
  const keys = useRef({ left: false, right: false, up: false, down: false });
  // 방향키로 걷다 분수에 막혔을 때 어느 쪽으로 돌고 있는지(lib/readingPlazaMap.js의 plazaStep이 적음)
  const round = useRef({ turn: 0, key: "" });
  const pendingSpot = useRef(null);
  const raf = useRef(0);
  const lastTick = useRef(0);
  const movingRef = useRef(false);
  // 바라보는 쪽(down · right · up · left)과 걸은 거리 — 걷는 그림은 거리로 넘깁니다(lib/readingPlazaSprites.js)
  const facingRef = useRef("down");
  const stride = useRef(0);
  // 내 펫의 걸음(자리 · 바라보는 쪽 · 걸은 거리 · 지나온 길 — lib/readingPlazaSprites.js의 plazaPetStart). 펫이 없으면 null
  const myPet = useRef(null);
  // 함께 있는 친구들 — uid → { actor(받은 소식대로 걷는 캐릭터), pet(펫의 걸음 · 없으면 null), handle(PlazaActor), dirty, reading }
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
  // 움직임을 줄여 달라고 한 기기에서는 시점이 미끄러지지 않고 캐릭터에 바로 붙고, 걷는 그림도 번갈아 바꾸지 않습니다
  // (바라보는 쪽의 정지 그림으로 옮겨 감).
  useEffect(() => {
    const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (!query) return undefined;
    const sync = () => { calm.current = query.matches; };
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  const counts = useMemo(() => {
    const stall = plazaItems(shelves ?? [], { place: "stall" });
    const shelf = plazaItems(shelves ?? [], { place: "shelf" });
    return { stall: stall.week.length + stall.earlier.length, shelf: shelf.week.length + shelf.earlier.length, stallWeek: stall.week.length, shelfWeek: shelf.week.length };
  }, [shelves]);

  // 지금 내 걸음 — 친구들에게 알릴 모양(lib/readingPlazaLive.js의 plazaLivePos가 받음). 길을 따라 걷는 중이면
  // '지금 자리에서 남은 길'을 줍니다(연결이 끊겼다 이어져 다시 알릴 때도 처음부터 다시 걷지 않게).
  const liveState = useCallback(() => {
    const mode = walkMode.current;
    return { x: pos.current.x, y: pos.current.y, path: mode === 1 ? path.current.slice() : [], mode, facing: facingRef.current, reading: panelOpen.current };
  }, []);
  // 친구들에게 알립니다 — 걸음마다가 아니라 걸음이 바뀔 때만(아래 tick · walkTo · 창을 여닫을 때)
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

  const openSpot = useCallback((spot) => {
    pendingSpot.current = null;
    path.current = [];
    keys.current = { left: false, right: false, up: false, down: false };
    walkMode.current = 0;
    // 여는 곳을 바라봅니다 — 책꽂이 앞에서는 뒷모습, 가판대 앞에서는 옆모습
    facingRef.current = plazaFacing(null, (spot.rect[0] + spot.rect[2]) / 2 - pos.current.x, (spot.rect[1] + spot.rect[3]) / 2 - pos.current.y);
    meRef.current?.show(facingRef.current, SPRITE_IDLE);
    setPanel({ place: spot.place });
  }, []);

  // 한 프레임 — 방향키가 눌려 있으면 그쪽으로, 아니면 정해 둔 길을 따라 걷습니다. 걸은 쪽 · 걸은 거리로 걷는 그림을
  // 고르고, 펫은 지나온 길을 따라오며, 시점은 캐릭터를 조금 늦게 따라붙습니다.
  // 멈추고 펫이 곁에 서고 시점도 다 따라붙으면 되풀이를 쉽니다.
  const tick = useCallback((time) => {
    const dt = Math.min(0.05, Math.max(0, (time - (lastTick.current || time)) / 1000));
    lastTick.current = time;
    const k = keys.current;
    const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const from = pos.current;
    let walking = false;
    if (dx || dy) {
      path.current = [];
      pendingSpot.current = null;
      const len = Math.hypot(dx, dy);
      pos.current = plazaStep(from, dx / len * SPEED * dt, dy / len * SPEED * dt, round.current);
    } else if (path.current.length) {
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
    // 바라보는 쪽 — 움직인 쪽으로. 방향키를 눌렀는데 막혀서 못 움직였으면 누른 쪽을 봅니다.
    if (moved > 0.01) facingRef.current = plazaFacing(facingRef.current, mx, my);
    else if (dx || dy) facingRef.current = plazaFacing(facingRef.current, dx, dy);

    const near = plazaSpotNear(pos.current)?.id ?? null;
    if (near !== nearRef.current) { nearRef.current = near; setNearId(near); }
    const active = walking || dx !== 0 || dy !== 0 || path.current.length > 0;
    if (active !== movingRef.current) {
      movingRef.current = active;
      if (active) {
        setWalked(true);
        stride.current = 0;
      } else setMarker(null);
    }
    // 걷는 그림 — 걸은 거리로 넘깁니다. 멈추면 그쪽을 본 채 선 그림.
    stride.current = walking ? stride.current + moved : 0;
    me?.show(facingRef.current, walking && !calm.current ? plazaWalkFrame(stride.current) : SPRITE_IDLE);
    if (!path.current.length && pendingSpot.current && !dx && !dy) {
      const spot = pendingSpot.current;
      pendingSpot.current = null;
      if (plazaSpotNear(pos.current)?.id === spot.id) openSpot(spot);
    }

    // 친구들에게 알리기 — 방향키로 걷는 동안은 0.3초에 한 번 지금 자리를, 멈추면 한 번(누른 곳으로 걷기는 walkTo가 알림).
    // 방향키를 누른 채 막혀 있으면 선 것으로 봅니다(누른 쪽을 본 채 — 받는 쪽도 그렇게 그림).
    if (dx || dy) stuck.current = moved > 0.01 ? 0 : stuck.current + dt;
    else stuck.current = 0;
    const mode = dx || dy ? (stuck.current > STUCK_S ? 0 : 2) : path.current.length ? 1 : 0;
    walkMode.current = mode;
    if (mode === 2 ? told.current !== 2 || time - toldAt.current >= PLAZA_LIVE_KEY_MS : mode === 0 && told.current !== 0) tell(time);

    // 펫 — 걷는 동안은 캐릭터가 지나온 길을 조금 뒤에서, 멈추면 곁자리로 옵니다(lib/readingPlazaSprites.js의 plazaPetFollow).
    let petBusy = false;
    const pet = myPet.current;
    if (pet) {
      const step = plazaPetFollow(pet, { x: pos.current.x, y: pos.current.y, facing: facingRef.current }, dt, { active, moved, from });
      petBusy = step.busy;
      if (step.walking || dt === 0) me?.placePet(pet.x, pet.y);
      // 알(과 걷는 그림이 없는 펫)은 걷는 동안 통통 뜁니다 — PlazaActor가 CSS로
      me?.showPet(pet.facing, step.walking && !calm.current ? plazaWalkFrame(pet.stride, PET_STRIDE) : SPRITE_IDLE, step.walking);
    }

    // 함께 있는 친구들 — 받은 소식대로 걷습니다. 펫은 내 펫과 같은 셈으로 그 뒤를 따릅니다.
    let castBusy = false;
    for (const friend of cast.current.values()) {
      const actor = friend.actor;
      const was = { x: actor.x, y: actor.y };
      const step = plazaRemoteStep(actor, dt, time);
      const handle = friend.handle;
      const fresh = friend.dirty && !!handle;
      if (handle && (fresh || step.moved > 0.01)) handle.place(actor.x, actor.y);
      handle?.show(actor.facing, step.walking && !calm.current ? plazaWalkFrame(actor.stride) : SPRITE_IDLE);
      // 이번에 걸었으면 한 프레임 더 — 다 와서 선 자세로 바꿔 그린 뒤에 쉽니다
      if (step.busy || step.moved > 0.01) castBusy = true;
      if (friend.pet) {
        const hop = plazaPetFollow(friend.pet, actor, dt, { active: step.walking, moved: step.moved, from: was });
        if (handle && (fresh || hop.walking)) handle.placePet(friend.pet.x, friend.pet.y);
        handle?.showPet(friend.pet.facing, hop.walking && !calm.current ? plazaWalkFrame(friend.pet.stride, PET_STRIDE) : SPRITE_IDLE, hop.walking);
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
  }, [look, openSpot, tell]);

  const wake = useCallback(() => {
    if (!raf.current) { lastTick.current = 0; raf.current = requestAnimationFrame(tick); }
  }, [tick]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; }, []);

  // ── 함께 있는 친구들 ──
  // 광장 탭을 연 동안만 잇습니다(나가면 놓음). 소식은 네 가지 — 들어옴 · 이름표가 바뀜(펫이 자람) · 걸음 · 나감.
  // 자리와 걸음은 cast(ref)에 두고 걸음 루프가 그리며, 상태(friends)는 누가 있는지 · 이름표만 듭니다.
  useEffect(() => {
    if (!classId || !myUid) return undefined;
    const members = cast.current;
    const attaches = castRefs.current;
    const joined = joinPlazaLive(classId, { uid: myUid, teacher: isTeacher }, {
      current: liveState,
      onJoin(uid, who, state, ageMs) {
        const actor = plazaRemoteEnter(state, ageMs, performance.now());
        members.set(uid, { actor, pet: who.pet ? plazaPetStart(actor, actor.facing) : null, handle: members.get(uid)?.handle ?? null, dirty: true, reading: state.reading });
        setFriends((list) => [...list.filter((f) => f.uid !== uid), friendRow(uid, who, state.reading)]);
        wake();
      },
      onWho(uid, who) {
        const friend = members.get(uid);
        if (!friend) return;
        if (!who.pet) friend.pet = null;
        else if (!friend.pet) friend.pet = plazaPetStart(friend.actor, friend.actor.facing);
        friend.dirty = true;
        setFriends((list) => list.map((f) => (f.uid === uid ? friendRow(uid, who, f.reading) : f)));
        wake();
      },
      onMove(uid, state) {
        const friend = members.get(uid);
        if (!friend) return;
        plazaRemoteHear(friend.actor, state, performance.now());
        if (friend.reading !== state.reading) {
          friend.reading = state.reading;
          setFriends((list) => list.map((f) => (f.uid === uid ? { ...f, reading: state.reading } : f)));
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
  }, [classId, myUid, isTeacher, liveState, wake]);
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
      const room = plazaRoom(wrap, scroller);
      const below = Math.max(0, top.getBoundingClientRect().bottom - rect.bottom) + (parseFloat(getComputedStyle(frame).paddingBottom) || 0);
      const next = { w: Math.ceil(rect.width), h: Math.max(STAGE_MIN_H, Math.floor(room - below)) };
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

  const walkTo = useCallback((point, spot = null) => {
    const goal = plazaNearest(point.x, point.y);
    const route = plazaPath(pos.current, goal);
    if (!route.length) return;
    path.current = route;
    pendingSpot.current = spot;
    setMarker(spot ? null : { x: goal.x, y: goal.y, key: Date.now() });
    // 어디에서 어느 길로 걷는지를 한 번 알립니다(걸음마다 올리지 않음 — 친구 화면이 같은 빠르기로 그림)
    walkMode.current = 1;
    tell();
    wake();
  }, [tell, wake]);

  // 책꽂이 · 가판대로 — 이미 그 앞이면 곧바로 열고, 아니면 걸어가서 엽니다.
  // 이름표(단추)를 눌러도 초점은 무대에 둡니다 — 이어서 방향키로 걸을 수 있게.
  const goSpot = useCallback((spot) => {
    stageRef.current?.focus({ preventScroll: true });
    if (plazaSpotNear(pos.current)?.id === spot.id) { openSpot(spot); return; }
    walkTo(spot.stand, spot);
  }, [openSpot, walkTo]);

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
    const spot = plazaSpotAt(x, y);
    if (spot) goSpot(spot);
    else walkTo({ x, y });
  }
  function onKeyDown(e) {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const dir = KEY_DIRS[e.key];
    if (dir) {
      e.preventDefault();   // 방향키가 페이지를 굴리지 않게
      keys.current[dir] = true;
      wake();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const spot = PLAZA_SPOTS.find((s) => s.id === nearRef.current);
      if (spot) { e.preventDefault(); openSpot(spot); }
    }
  }
  function onKeyUp(e) {
    const dir = KEY_DIRS[e.key];
    if (dir) keys.current[dir] = false;
  }
  function stopKeys() {
    keys.current = { left: false, right: false, up: false, down: false };
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
  else if (!myPet.current) myPet.current = plazaPetStart(pos.current, facingRef.current);

  const world = size ? plazaView(size.w, size.h) : null;
  const who = useMemo(() => characterOf({ uid: myUid || "", character: characterOn ? character : null }), [myUid, characterOn, character]);
  const myName = isTeacher ? "선생님" : user?.realName || user?.displayName || "나";
  // 함께 있는 사람(나 포함) — 이어졌을 때만 셉니다
  const liveNote = live.status === "off" && isTeacher ? LIVE_NOTES[live.why] : "";

  return (
    <section className="plaza" aria-label="책 광장">
      <div className={`plaza-stage-wrap${live.status !== "off" || liveNote ? " has-live" : ""}`} ref={wrapRef}>
        <div className="plaza-stage" ref={stageRef} tabIndex={0} role="application"
          aria-label="책 광장 마당. 누른 곳으로 걸어가고 방향키로도 걷습니다. 책꽂이나 가판대 앞에서 Enter로 엽니다."
          style={size ? { height: size.h } : undefined}
          onClick={onStageClick} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={stopKeys} onScroll={keepStill}>
          {/* 그림 — 무대를 빈틈없이 덮게 키운 크기. 자리(transform)는 시점이 DOM에 곧바로 적습니다(look) */}
          {world && (
            <div className="plaza-world" ref={worldRef} style={{ width: world.worldW, height: world.worldH }}>
              <img className="plaza-bg" src="/reading-plaza/plaza.webp" alt="" width={PLAZA_W} height={PLAZA_H} draggable={false} />
              {PLAZA_SPOTS.map((spot) => (
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
              {marker && <span key={marker.key} className="plaza-marker" style={{ left: pct(marker.x, PLAZA_W), top: pct(marker.y, PLAZA_H) }} aria-hidden="true" />}
              {/* 캐릭터 · 펫(PlazaActor) — 닻(크기 0)이 발이 닿는 점에 서고, 그림 · 이름표 · 그림자가 그 점을 기준으로 놓입니다.
                  자리는 걷는 동안 DOM에 곧바로 적습니다 — 다시 그릴 때도 지금 자리(at · petAt)를 그대로 적어 튀지 않게.
                  함께 있는 친구들이 먼저, 내 캐릭터가 나중(같은 높이에 겹치면 내가 앞) */}
              {friends.map((friend) => {
                const member = cast.current.get(friend.uid);
                if (!member) return null;
                return (
                  <PlazaActor key={friend.uid} ref={castRef(friend.uid)} character={friend.character} pet={member.pet ? friend.pet : null}
                    name={friend.name} teacher={friend.teacher} reading={friend.reading} scale={world.scale} at={member.actor} petAt={member.pet} />
                );
              })}
              <PlazaActor ref={meRef} me character={who} pet={pet} name={myName} reading={reading} scale={world.scale} at={pos.current} petAt={myPet.current} />
            </div>
          )}
        </div>
        {/* 맵 위에 얹는 것 — 제목과 '나가기'(왼쪽 위) · 가판대/책꽂이 단추(오른쪽 위) · 걷는 법(아래, 첫걸음 전까지).
            무대 밖(형제)에 두어 여기를 눌러도 캐릭터가 걷지 않습니다. */}
        <div className="plaza-hud">
          <div className="plaza-hud-lead">
            <h3 className="plaza-title">책 광장</h3>
            {onExit && <button type="button" className="plaza-exit" onClick={onExit} aria-label="책 광장에서 나가기">나가기</button>}
          </div>
          <div className="plaza-hud-actions">
            <button type="button" onClick={() => setPanel({ place: "stall" })}>가판대 <small>{PLACE_NAME.stall}</small> <b>{counts.stall}</b></button>
            <button type="button" onClick={() => setPanel({ place: "shelf" })}>책꽂이 <small>{PLACE_NAME.shelf}</small> <b>{counts.shelf}</b></button>
          </div>
          {/* 함께 있는 사람 — 이어졌으면 '지금 n명'(나 포함), 쉬는 화면이면 그 사실. 잇지 못했을 때의 까닭은 선생님께만 */}
          {live.status === "live" && <p className="plaza-live" role="status" title="지금 책 광장에 함께 있는 사람(나 포함)"><i aria-hidden="true" /><span>지금 <b>{friends.length + 1}</b>명</span></p>}
          {live.status === "connecting" && <p className="plaza-live plaza-live--connecting" role="status"><i aria-hidden="true" />친구들을 찾는 중…</p>}
          {live.status === "resting" && <p className="plaza-live plaza-live--resting" role="status"><i aria-hidden="true" />쉬는 중 — 움직이면 친구들이 다시 보여요</p>}
          {liveNote && <p className="plaza-live plaza-live--note" role="status">{liveNote}</p>}
          {error && <div className="plaza-hud-error" role="alert">{error}</div>}
          {!walked && <p className="plaza-hint" aria-hidden="true">마당을 누르면 그곳으로 걸어가요<span> · 방향키(W · A · S · D)로도 걷고, 책꽂이와 가판대는 눌러서 열어요</span></p>}
        </div>
      </div>
      {panel && (
        <PlazaPanel classId={classId} user={user} isTeacher={isTeacher} shelves={shelves ?? []} loading={shelves === null}
          place={panel.place} friendUid={panel.friendUid ?? null} book={panel.book ?? null}
          onNavigate={(next) => setPanel((current) => ({ ...current, ...next }))}
          onClose={() => { setPanel(null); stageRef.current?.focus({ preventScroll: true }); }} />
      )}
    </section>
  );
}
