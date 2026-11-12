"use client";
// =============================================================
// 독서 광장 — 책나눔의 셋째 탭(광장을 켠 반에서 '우리 반 랭킹' 자리에 섬 · 선생님 요청)
// -------------------------------------------------------------
// 광장 그림 위를 내 캐릭터(와 펫)가 걸어 다닙니다 — 누른 곳으로 걸어가고, 방향키 · WASD로도 걷습니다.
//   · 가판대(셋) = 반 친구들이 지금 읽고 있는 책(독서 발자국)
//   · 책꽂이    = 반 친구들이 꽂아 둔 완독한 책(한 권의 책)
// 앞에 서면(또는 눌러서) 창이 열려 책을 고르고, 글을 읽고, 댓글을 남깁니다(PlazaPanel).
// 걷는 길 · 여는 곳은 lib/readingPlazaMap.js, 목록의 셈은 lib/readingPlaza.js, 자료는 lib/data/plaza.js.
// 이 화면(과 창 PlazaPanel)은 광장 탭을 열 때만 내려받습니다(ReadingHub의 dynamic import).
//
// 지금은 **내 캐릭터만** 보입니다 — 접속한 친구들의 캐릭터가 함께 움직이는 것(실시간)은 다음 단계입니다
// (Realtime Database가 필요 — READING_GROWTH.md '독서 광장').
// 캐릭터의 움직임은 React 상태가 아니라 ref와 requestAnimationFrame으로 DOM에 곧바로 적습니다
// (프레임마다 다시 그리지 않게). 걷는지 · 어느 쪽을 보는지 · 어디 앞인지만 상태입니다.
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeMyReadingCharacter, subscribeMyReadingPet } from "@/lib/data/reading";
import { subscribePlazaShelves } from "@/lib/data/plaza";
import { characterImage, characterOf } from "@/lib/readingCharacterCatalog";
import { petProgress } from "@/lib/readingPet";
import { plazaItems } from "@/lib/readingPlaza";
import {
  PLAZA_H, PLAZA_SPAWN, PLAZA_SPOTS, PLAZA_W,
  plazaNearest, plazaPath, plazaSpotAt, plazaSpotNear, plazaStep,
} from "@/lib/readingPlazaMap";
import PetFigure from "./PetFigure";
import PlazaPanel from "./PlazaPanel";
import "./plaza.css";

// 걷는 빠르기(그림 원본 px/초) — 마당을 가로지르는 데 5초쯤
const SPEED = 330;
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
  const [stageW, setStageW] = useState(0);
  // 무대가 화면에 다 들어오는 높이(px) — 무대 위쪽부터 화면(구르는 칸) 바닥까지 남은 높이를 재서 정합니다.
  const [fitH, setFitH] = useState(null);
  const [moving, setMoving] = useState(false);
  const [facing, setFacing] = useState(1);
  const [nearId, setNearId] = useState(null);
  const [marker, setMarker] = useState(null);

  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const avatarRef = useRef(null);
  const pos = useRef({ ...PLAZA_SPAWN });
  const path = useRef([]);
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const pendingSpot = useRef(null);
  const raf = useRef(0);
  const lastTick = useRef(0);
  const movingRef = useRef(false);
  const facingRef = useRef(1);
  const nearRef = useRef(null);
  const panelOpen = useRef(false);
  panelOpen.current = !!panel;

  useEffect(() => {
    setShelves(null); setError("");
    if (!classId) return undefined;
    return subscribePlazaShelves(classId, (rows) => { setShelves(rows); setError(""); },
      (e) => setError(e?.code === "permission-denied"
        ? "독서 광장을 불러오지 못했어요. 선생님께 규칙이 게시되었는지 확인을 부탁해 주세요."
        : e?.message || "독서 광장을 불러오지 못했어요."));
  }, [classId]);
  useEffect(() => (myUid ? subscribeMyReadingCharacter(myUid, setCharacter) : undefined), [myUid]);
  useEffect(() => {
    if (!myUid || !petOn || isTeacher) { setPetState(null); return undefined; }
    return subscribeMyReadingPet(myUid, setPetState);
  }, [myUid, petOn, isTeacher]);

  const counts = useMemo(() => {
    const stall = plazaItems(shelves ?? [], { place: "stall" });
    const shelf = plazaItems(shelves ?? [], { place: "shelf" });
    return { stall: stall.week.length + stall.earlier.length, shelf: shelf.week.length + shelf.earlier.length, stallWeek: stall.week.length, shelfWeek: shelf.week.length };
  }, [shelves]);

  const place = useCallback(() => {
    const el = avatarRef.current;
    if (!el) return;
    el.style.left = pct(pos.current.x, PLAZA_W);
    el.style.top = pct(pos.current.y, PLAZA_H);
    el.style.zIndex = String(10 + Math.round(pos.current.y));
  }, []);

  const openSpot = useCallback((spot) => {
    pendingSpot.current = null;
    path.current = [];
    keys.current = { left: false, right: false, up: false, down: false };
    setPanel({ place: spot.place });
  }, []);

  // 한 프레임 — 방향키가 눌려 있으면 그쪽으로, 아니면 정해 둔 길을 따라 걷습니다. 멈추면 되풀이를 쉽니다.
  const tick = useCallback((time) => {
    const dt = Math.min(0.05, Math.max(0, (time - (lastTick.current || time)) / 1000));
    lastTick.current = time;
    const k = keys.current;
    const dx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    let walking = false;
    let turn = 0;
    if (dx || dy) {
      path.current = [];
      pendingSpot.current = null;
      const len = Math.hypot(dx, dy);
      const next = plazaStep(pos.current, dx / len * SPEED * dt, dy / len * SPEED * dt);
      walking = next.x !== pos.current.x || next.y !== pos.current.y;
      pos.current = next;
      turn = dx;
    } else if (path.current.length) {
      const target = path.current[0];
      const distance = Math.hypot(target.x - pos.current.x, target.y - pos.current.y);
      const step = SPEED * dt;
      if (Math.abs(target.x - pos.current.x) > 2) turn = target.x - pos.current.x;
      if (distance <= step) {
        pos.current = { x: target.x, y: target.y };
        path.current.shift();
      } else {
        pos.current = { x: pos.current.x + (target.x - pos.current.x) / distance * step, y: pos.current.y + (target.y - pos.current.y) / distance * step };
      }
      walking = true;
    }
    place();
    if (turn && Math.sign(turn) !== facingRef.current) { facingRef.current = Math.sign(turn); setFacing(facingRef.current); }
    const near = plazaSpotNear(pos.current)?.id ?? null;
    if (near !== nearRef.current) { nearRef.current = near; setNearId(near); }
    const active = walking || dx !== 0 || dy !== 0 || path.current.length > 0;
    if (active !== movingRef.current) { movingRef.current = active; setMoving(active); }
    if (!path.current.length && pendingSpot.current && !dx && !dy) {
      const spot = pendingSpot.current;
      pendingSpot.current = null;
      if (plazaSpotNear(pos.current)?.id === spot.id) openSpot(spot);
    }
    if (active) raf.current = requestAnimationFrame(tick);
    else { raf.current = 0; lastTick.current = 0; setMarker(null); }
  }, [openSpot, place]);

  const wake = useCallback(() => {
    if (!raf.current) { lastTick.current = 0; raf.current = requestAnimationFrame(tick); }
  }, [tick]);

  useEffect(() => {
    place();
    return () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [place]);

  // 무대 폭 — 캐릭터 · 펫 그림 크기를 그림에 맞춰 정합니다(그림은 %로 놓이지만 펫 그림은 px 크기를 받음).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => setStageW(Math.round(entries[0].contentRect.width)));
    observer.observe(el);
    setStageW(Math.round(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  // 무대가 한 화면에 들어오게 — 책방 본문은 제 안에서 구르는 칸(.books-main)이라 그 칸의 높이를 기준으로 잽니다.
  // 화면이 낮으면 CSS의 바닥 폭까지만 줄고 나머지는 구릅니다.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    let scroller = wrap.parentElement;
    while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (scroller === document.body) scroller = null;
    const hub = wrap.closest(".reading-hub") ?? wrap.parentElement;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const room = scroller
        ? scroller.clientHeight - (rect.top - scroller.getBoundingClientRect().top + scroller.scrollTop)
        : window.innerHeight - (rect.top + window.scrollY);
      // 무대 아래에 남는 것(안내 한 줄 · 책나눔의 아래 여백 · 구르는 칸의 아래 여백)만큼 뺍니다 — 무대 크기와 무관한 값
      const below = Math.max(0, hub.getBoundingClientRect().bottom - rect.bottom)
        + (scroller ? parseFloat(getComputedStyle(scroller).paddingBottom) || 0 : 16);
      setFitH(Math.max(240, Math.floor(room - below - 2)));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = scroller && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(scroller);
    return () => { window.removeEventListener("resize", measure); observer?.disconnect(); };
  }, []);

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
  function onStageClick(e) {
    if (e.target.closest?.("button")) return;
    const rect = stageRef.current.getBoundingClientRect();
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

  const pet = petOn && !isTeacher ? petProgress(petState?.mirror ?? null, growthXp ?? 0) : null;
  const avatarSize = Math.max(44, Math.round(stageW * 0.078));
  const petSize = Math.max(22, Math.round(stageW * 0.036));
  const myName = isTeacher ? "선생님" : user?.realName || user?.displayName || "나";
  const src = characterImage(characterOf({ uid: myUid || "", character: characterOn ? character : null }));

  return (
    <section className="plaza" aria-label="독서 광장">
      <div className="plaza-head">
        <h3>독서 광장 <small>친구들의 독서 발자국과 한 권의 책을 읽고 댓글을 남겨요</small></h3>
        <div className="plaza-head-actions">
          <button type="button" className="btn-ghost" onClick={() => setPanel({ place: "stall" })}>가판대 <small>{PLACE_NAME.stall}</small> <b>{counts.stall}</b></button>
          <button type="button" className="btn-ghost" onClick={() => setPanel({ place: "shelf" })}>책꽂이 <small>{PLACE_NAME.shelf}</small> <b>{counts.shelf}</b></button>
        </div>
      </div>
      {error && <div className="reading-error" role="alert">{error}</div>}
      <div className="plaza-stage-wrap" ref={wrapRef} style={fitH ? { "--plaza-fit-h": `${fitH}px` } : undefined}>
        <div className="plaza-stage" ref={stageRef} tabIndex={0} role="application"
          aria-label="독서 광장 마당. 방향키로 걷고, 책꽂이나 가판대 앞에서 Enter로 엽니다."
          onClick={onStageClick} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={stopKeys}>
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
          {/* 자리는 걷는 동안 DOM에 곧바로 적습니다(place) — 다시 그릴 때도 지금 자리를 그대로 적어 튀지 않게 */}
          <div ref={avatarRef} className={`plaza-avatar is-me${moving ? " is-moving" : ""}`} aria-hidden="true"
            style={{ width: avatarSize, height: avatarSize, left: pct(pos.current.x, PLAZA_W), top: pct(pos.current.y, PLAZA_H), zIndex: 10 + Math.round(pos.current.y) }}>
            <span className="plaza-avatar-shadow" />
            {pet && <span className="plaza-avatar-pet" style={{ [facing > 0 ? "right" : "left"]: "78%" }}><PetFigure species={pet.species} stage={pet.stage} ready={pet.ready} size={petSize} /></span>}
            <img className="plaza-avatar-img" src={src} alt="" draggable={false} style={{ transform: facing < 0 ? "scaleX(-1)" : undefined }} />
            <span className="plaza-avatar-name">{myName}</span>
          </div>
        </div>
      </div>
      <p className="plaza-help">마당을 누르면 그곳으로 걸어가요. 방향키(W · A · S · D)로도 걷고, 책꽂이나 가판대 앞에서 Enter를 누르면 열려요.</p>
      {panel && (
        <PlazaPanel classId={classId} user={user} isTeacher={isTeacher} shelves={shelves ?? []} loading={shelves === null}
          place={panel.place} friendUid={panel.friendUid ?? null} book={panel.book ?? null}
          onNavigate={(next) => setPanel((current) => ({ ...current, ...next }))}
          onClose={() => { setPanel(null); stageRef.current?.focus({ preventScroll: true }); }} />
      )}
    </section>
  );
}
