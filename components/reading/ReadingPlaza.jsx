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
// 맵이 화면을 가득 채웁니다(선생님 요청) — 탭 바로 아래부터 화면 바닥까지가 무대(.plaza-stage = 보이는 창)이고,
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
// 지금은 **내 캐릭터만** 보입니다 — 접속한 친구들의 캐릭터가 함께 움직이는 것(실시간)은 다음 단계입니다
// (Realtime Database가 필요 — READING_GROWTH.md '책 광장').
// 캐릭터 · 펫의 움직임, 바라보는 쪽, 걷는 그림, 시점은 React 상태가 아니라 ref와 requestAnimationFrame으로
// DOM(과 캔버스)에 곧바로 적습니다(프레임마다 다시 그리지 않게). 어디 앞인지 · 갈 곳 표시 · 첫걸음을 뗐는지만 상태입니다.
// =============================================================
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { subscribeMyReadingCharacter, subscribeMyReadingPet } from "@/lib/data/reading";
import { subscribePlazaShelves } from "@/lib/data/plaza";
import { characterImage, characterOf } from "@/lib/readingCharacterCatalog";
import { petProgress } from "@/lib/readingPet";
import { plazaItems } from "@/lib/readingPlaza";
import {
  PLAZA_H, PLAZA_SPAWN, PLAZA_SPOTS, PLAZA_W,
  plazaCamera, plazaNearest, plazaPath, plazaSpotAt, plazaSpotNear, plazaStep, plazaView,
} from "@/lib/readingPlazaMap";
import {
  PET_STRIDE, PLAZA_EGG_SIZE, SPRITE_IDLE,
  plazaCharacterSheet, plazaCharacterSize, plazaFacing, plazaPetHeel, plazaPetPeek, plazaPetSheet, plazaPetSize, plazaPetStep,
  plazaTrailBehind, plazaTrailPush, plazaWalkFrame,
} from "@/lib/readingPlazaSprites";
import PetFigure from "./PetFigure";
import PlazaPanel from "./PlazaPanel";
import PlazaSprite from "./PlazaSprite";
import "./plaza.css";

// 걷는 빠르기(그림 원본 px/초) — 마당을 가로지르는 데 5초쯤. 걷는 그림을 넣으며 330에서 낮췄습니다 —
// 캐릭터 키(88px)에 견줘 빠르면 발이 미끄러지듯 보여서, 그림 한 장을 넘기는 거리(WALK_STRIDE 32px)와 함께
// 초당 8장쯤이 되게 맞췄습니다(실측 8.0장 — tests/unit/readingPlaza.test.mjs가 이 둘의 짝을 봄).
const SPEED = 260;
// 시점이 캐릭터를 따라붙는 빠르기(초) — 작을수록 바짝 붙습니다. 걸음을 떼고 멈출 때 화면이 덜컥거리지 않게 조금 늦춥니다.
const CAM_EASE = 0.14;
// 무대의 바닥 높이(px) — 창이 아주 낮으면 이만큼은 지키고 화면이 구릅니다.
const STAGE_MIN_H = 300;
// 펫이 이보다 멀리 떨어지면(어딘가에 걸림) 캐릭터 뒤로 곧바로 데려옵니다
const PET_LOST = 320;
const KEY_DIRS = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down",
};
const PLACE_NAME = { stall: "지금 읽는 책", shelf: "완독한 책" };
const pct = (value, whole) => `${(value / whole * 100).toFixed(3)}%`;

// initialBook — 서재에서 '광장에서 보기'로 넘어올 때 곧바로 열 책({ uid, bookId, place })
export default function ReadingPlaza({ classId, user, isTeacher = false, characterOn = true, petOn = false, growthXp = null, initialBook = null }) {
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
  // 걷는 그림(시트)을 못 받았을 때 — 캐릭터는 예전 그림, 펫은 단계 그림으로 섭니다
  const [spriteMissing, setSpriteMissing] = useState(false);
  const [petSpriteMissing, setPetSpriteMissing] = useState(false);

  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const worldRef = useRef(null);
  const avatarRef = useRef(null);
  const petRef = useRef(null);
  const charSprite = useRef(null);
  const petSprite = useRef(null);
  const pos = useRef({ ...PLAZA_SPAWN });
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
  // 펫 — 자리 · 바라보는 쪽 · 걸은 거리 · 캐릭터가 지나온 길 · 멈췄을 때 설 곁자리
  const petPos = useRef(plazaPetHeel(PLAZA_SPAWN, null));
  const petFacing = useRef("down");
  const petStride = useRef(0);
  const petMoving = useRef(false);
  const trail = useRef([]);
  const heel = useRef(null);
  const hasPet = useRef(false);
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

  // 캐릭터 · 펫의 자리를 DOM에 적습니다(자리 = 발이 닿는 점). 아래쪽에 선 것이 앞에 그려집니다.
  const place = useCallback(() => {
    const el = avatarRef.current;
    if (!el) return;
    el.style.left = pct(pos.current.x, PLAZA_W);
    el.style.top = pct(pos.current.y, PLAZA_H);
    el.style.zIndex = String(10 + Math.round(pos.current.y));
  }, []);
  const placePet = useCallback(() => {
    const el = petRef.current;
    if (!el) return;
    el.style.left = pct(petPos.current.x, PLAZA_W);
    el.style.top = pct(petPos.current.y, PLAZA_H);
    el.style.zIndex = String(10 + Math.round(petPos.current.y));
  }, []);
  // 시점을 DOM에 적습니다 — 그림을 통째로 밉니다(transform이라 다시 칠하지 않음)
  const look = useCallback(() => {
    const el = worldRef.current;
    if (el) el.style.transform = `translate3d(${-cam.current.x}px, ${-cam.current.y}px, 0)`;
  }, []);

  const openSpot = useCallback((spot) => {
    pendingSpot.current = null;
    path.current = [];
    keys.current = { left: false, right: false, up: false, down: false };
    // 여는 곳을 바라봅니다 — 책꽂이 앞에서는 뒷모습, 가판대 앞에서는 옆모습
    facingRef.current = plazaFacing(null, (spot.rect[0] + spot.rect[2]) / 2 - pos.current.x, (spot.rect[1] + spot.rect[3]) / 2 - pos.current.y);
    charSprite.current?.show(facingRef.current, SPRITE_IDLE);
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
    place();
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
        heel.current = null;
        // 다시 걷기 시작 — 펫이 선 자리에서 캐릭터 자리까지를 '지나온 길'의 첫머리로 둡니다(펫이 뒷걸음질하지 않게)
        if (hasPet.current) {
          trail.current = [];
          plazaTrailPush(trail.current, petPos.current);
          plazaTrailPush(trail.current, from);
        }
      } else setMarker(null);
    }
    // 걷는 그림 — 걸은 거리로 넘깁니다. 멈추면 그쪽을 본 채 선 그림.
    stride.current = walking ? stride.current + moved : 0;
    charSprite.current?.show(facingRef.current, walking && !calm.current ? plazaWalkFrame(stride.current) : SPRITE_IDLE);
    if (!path.current.length && pendingSpot.current && !dx && !dy) {
      const spot = pendingSpot.current;
      pendingSpot.current = null;
      if (plazaSpotNear(pos.current)?.id === spot.id) openSpot(spot);
    }

    // 펫 — 걷는 동안은 캐릭터가 지나온 길을 조금 뒤에서, 멈추면 곁자리로 옵니다.
    let petBusy = false;
    if (hasPet.current) {
      if (moved > 0.01) plazaTrailPush(trail.current, pos.current);
      const was = petPos.current;
      // 아래쪽(앞)으로 걸을 때는 캐릭터 몸에 가리지 않게 옆으로 비켜 따라옵니다(plazaPetPeek)
      const target = active
        ? plazaPetPeek(plazaTrailBehind(trail.current) ?? was, pos.current, was)
        : heel.current ?? (heel.current = plazaPetHeel(pos.current, was));
      let next = plazaPetStep(was, target, dt);
      if (Math.hypot(pos.current.x - next.x, pos.current.y - next.y) > PET_LOST) next = { x: target.x, y: target.y };
      const px = next.x - was.x;
      const py = next.y - was.y;
      const petWalking = Math.hypot(px, py) > 0.01;
      if (petWalking) {
        petPos.current = next;
        petFacing.current = plazaFacing(petFacing.current, px, py);
        petStride.current += Math.hypot(px, py);
      } else {
        petStride.current = 0;
        // 곁에 와서 서면 캐릭터와 같은 쪽을 봅니다
        if (!active) petFacing.current = facingRef.current;
      }
      // 이번에 걸었으면 한 프레임 더 — 다 와서 선 자세(정지 그림 · 캐릭터와 같은 쪽)로 바꿔 그린 뒤에 쉽니다.
      // 막혀서 못 가는 중이면(걸음이 0) 기다리지 않습니다.
      petBusy = petWalking || (dt === 0 && Math.hypot(target.x - petPos.current.x, target.y - petPos.current.y) > 0.01);
      placePet();
      petSprite.current?.show(petFacing.current, petWalking && !calm.current ? plazaWalkFrame(petStride.current, PET_STRIDE) : SPRITE_IDLE);
      // 알(과 걷는 그림이 없는 펫)은 걷는 동안 통통 뜁니다 — CSS
      if (petWalking !== petMoving.current) {
        petMoving.current = petWalking;
        petRef.current?.classList.toggle("is-moving", petWalking);
      }
    }

    // 시점 — 따라붙는 중이면 한 프레임 더. 다 왔으면 정수 px에 맞춰 멈춥니다(이름표 글자가 흐려지지 않게).
    const goal = plazaCamera(view.current, pos.current);
    const ease = calm.current ? 1 : 1 - Math.exp(-dt / CAM_EASE);
    cam.current = { x: cam.current.x + (goal.x - cam.current.x) * ease, y: cam.current.y + (goal.y - cam.current.y) * ease };
    const trailing = Math.abs(goal.x - cam.current.x) > 0.5 || Math.abs(goal.y - cam.current.y) > 0.5;
    if (active || trailing || petBusy) raf.current = requestAnimationFrame(tick);
    else {
      cam.current = { x: Math.round(goal.x), y: Math.round(goal.y) };
      raf.current = 0;
      lastTick.current = 0;
    }
    look();
  }, [look, openSpot, place, placePet]);

  const wake = useCallback(() => {
    if (!raf.current) { lastTick.current = 0; raf.current = requestAnimationFrame(tick); }
  }, [tick]);

  useEffect(() => {
    place();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [place]);

  // 무대의 크기 — 탭 바로 아래부터 화면 바닥까지를 맵이 채웁니다(선생님 요청).
  // 책방 본문은 제 안에서 구르는 칸(.books-main)이라 CSS만으로는 '남은 높이'를 모릅니다. 그 칸의 높이에서 무대 위쪽까지의
  // 거리와 무대 아래에 남는 것(책나눔 틀 · 본문 칸의 아래 여백 — 무대 크기와 무관한 값)을 빼서 정합니다.
  // 창이 아주 낮으면 STAGE_MIN_H까지만 줄고 나머지는 구릅니다. 그리기 전에 재야 처음부터 제 크기로 섭니다(useLayoutEffect).
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    let scroller = wrap.parentElement;
    while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (scroller === document.body) scroller = null;
    // 구르는 칸(없으면 본문 main)의 바로 아래 자식 가운데 무대를 품은 것 — 책나눔 틀(교사 화면은 명단까지 품은 틀)
    const frame = scroller ?? wrap.closest("main") ?? document.body;
    let top = wrap;
    while (top.parentElement && top.parentElement !== frame && top.parentElement !== document.body) top = top.parentElement;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const room = scroller
        ? scroller.clientHeight - (rect.top - scroller.getBoundingClientRect().top + scroller.scrollTop)
        : window.innerHeight - (rect.top + window.scrollY);
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
    wake();
  }, [wake]);

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
  const petOnStage = !!pet;
  hasPet.current = petOnStage;
  // 펫이 (늦게) 나타나면 지금 캐릭터 곁에 세웁니다 — 펫 자료가 늦게 와 그사이 걸어 나갔을 수 있습니다.
  // 그리기 전에 맞춥니다(useLayoutEffect) — 처음 자리에 한 번 보였다가 옮겨 가지 않게.
  useLayoutEffect(() => {
    if (!petOnStage) return;
    petPos.current = plazaPetHeel(pos.current, null);
    petFacing.current = facingRef.current;
    petMoving.current = false;
    heel.current = null;
    trail.current = [];
    placePet();
  }, [petOnStage, placePet]);

  const world = size ? plazaView(size.w, size.h) : null;
  const who = useMemo(() => characterOf({ uid: myUid || "", character: characterOn ? character : null }), [myUid, characterOn, character]);
  const sheet = plazaCharacterSheet(who);
  const body = world ? plazaCharacterSize(world.scale) : null;
  // 깨어난 펫은 걷는 그림(단계가 오를수록 크게), 알은 종을 드러내지 않는 공통 알
  const petSheet = pet?.hatched && !petSpriteMissing ? plazaPetSheet(pet.species) : null;
  const petBody = world && pet ? plazaPetSize(world.scale, pet.stage) : null;
  const petFigure = world && pet ? Math.round(pet.hatched ? petBody.body * 1.3 : Math.max(24, PLAZA_EGG_SIZE * world.scale)) : 0;
  const myName = isTeacher ? "선생님" : user?.realName || user?.displayName || "나";

  return (
    <section className="plaza" aria-label="책 광장">
      <div className="plaza-stage-wrap" ref={wrapRef}>
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
              {/* 캐릭터 · 펫 — 닻(크기 0)이 발이 닿는 점에 서고, 그림 · 이름표 · 그림자가 그 점을 기준으로 놓입니다.
                  자리는 걷는 동안 DOM에 곧바로 적습니다(place · placePet) — 다시 그릴 때도 지금 자리를 그대로 적어 튀지 않게 */}
              {pet && (
                <div ref={petRef} className="plaza-pet" aria-hidden="true"
                  style={{ left: pct(petPos.current.x, PLAZA_W), top: pct(petPos.current.y, PLAZA_H), zIndex: 10 + Math.round(petPos.current.y) }}>
                  <span className="plaza-avatar-shadow" style={{ width: petBody.body * 0.62, height: petBody.body * 0.2 }} />
                  {petSheet
                    ? <PlazaSprite ref={petSprite} src={petSheet} size={petBody.cell} style={{ left: -petBody.footX, top: -petBody.footY }} onMissing={() => setPetSpriteMissing(true)} />
                    : <span className="plaza-pet-figure" style={{ left: -petFigure / 2, top: -petFigure * 0.93 }}><PetFigure species={pet.species} stage={pet.stage} ready={pet.ready} size={petFigure} /></span>}
                </div>
              )}
              <div ref={avatarRef} className="plaza-avatar is-me" aria-hidden="true"
                style={{ left: pct(pos.current.x, PLAZA_W), top: pct(pos.current.y, PLAZA_H), zIndex: 10 + Math.round(pos.current.y) }}>
                <span className="plaza-avatar-shadow" style={{ width: body.body * 0.5, height: body.body * 0.15 }} />
                {sheet && !spriteMissing
                  ? <PlazaSprite ref={charSprite} src={sheet} size={body.cell} style={{ left: -body.footX, top: -body.footY }} onMissing={() => setSpriteMissing(true)} />
                  : <img className="plaza-avatar-img" src={characterImage(who)} alt="" draggable={false}
                      style={{ width: body.body * 1.3, height: body.body * 1.3, left: -body.body * 0.65, top: -body.body * 1.24 }} />}
                <span className="plaza-avatar-name" style={{ bottom: Math.round(body.body) + 5 }}>{myName}</span>
              </div>
            </div>
          )}
        </div>
        {/* 맵 위에 얹는 것 — 제목(왼쪽 위) · 가판대/책꽂이 단추(오른쪽 위) · 걷는 법(아래, 첫걸음 전까지).
            무대 밖(형제)에 두어 여기를 눌러도 캐릭터가 걷지 않습니다. */}
        <div className="plaza-hud">
          <h3 className="plaza-title">책 광장</h3>
          <div className="plaza-hud-actions">
            <button type="button" onClick={() => setPanel({ place: "stall" })}>가판대 <small>{PLACE_NAME.stall}</small> <b>{counts.stall}</b></button>
            <button type="button" onClick={() => setPanel({ place: "shelf" })}>책꽂이 <small>{PLACE_NAME.shelf}</small> <b>{counts.shelf}</b></button>
          </div>
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
