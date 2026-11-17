"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  HIDEOUT_DEFAULT_ANCHORS, HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_ITEMS, HIDEOUT_OCCUPANTS, HIDEOUT_PORTAL_UNIT, HIDEOUT_SCENE, HIDEOUT_SLOTS, HIDEOUT_SURFACE_LABELS,
  HIDEOUT_TOP_HOME, HIDEOUT_UNITS,
  hideoutArtBox, hideoutPlaceTargets, hideoutPlaqueLabel, hideoutSceneProps, hideoutUnitCategory, hideoutUnitFlips, hideoutUnitTopOnly, hideoutUnitTops,
  isHideoutItemUnlocked, normalizeHideoutRoom, sameHideoutArrange,
} from "@/lib/readingHideout";
import {
  createHideoutWalkMap, hideoutAtReturnPortal, hideoutReturnPortal,
} from "@/lib/readingHideoutMap";
import {
  HIDEOUT_GRID, hideoutArrangeProblem, hideoutFindSpot, hideoutNudge, hideoutPlacementNow, hideoutSnap, hideoutTopTarget, hideoutUnitPlacement, hideoutWithEntry,
  settleHideoutArrange,
} from "@/lib/readingHideoutArrange";
import { hideoutTurnArt } from "@/lib/readingHideoutTurn";
import { getHideoutRestPet, hideoutEggRestPosition, hideoutPetRestPosition } from "@/lib/readingHideoutPets";
import { fetchReadingHideout, saveReadingHideout } from "@/lib/data/readingHideout";
import { subscribeMyReadingCharacter, subscribeMyReadingPet } from "@/lib/data/reading";
import { characterImage, characterName, characterOf } from "@/lib/readingCharacterCatalog";
import { petGrowthOfSummary, petProgress } from "@/lib/readingPet";
import { careAway, careStatus } from "@/lib/petCare";
import { kstToday, readingLevelProgress } from "@/lib/reading";
import { eulReul, eunNeun, iGa } from "@/lib/korean";
import { PLAZA_WALK_SPEED, SPRITE_BODY, SPRITE_CELL, SPRITE_FOOT, plazaCharacterSheet, plazaFacing, plazaWalkFrame } from "@/lib/readingPlazaSprites";
import { hasModalAbove } from "@/lib/modal";
import PetFigure from "./PetFigure";
import PetInfoModal from "./PetInfoModal";
import PlazaSprite from "./PlazaSprite";
import ReadingCharacterSummary from "./ReadingCharacterSummary";
import "./hideout.css";

// A teacher's class-wide move may unmount this screen. Keep an unfinished
// decoration draft in this tab's memory, never in a server/presence document.
const UNSAVED_DRAFTS = new Map();
function keepDraft(key, value) {
  UNSAVED_DRAFTS.delete(key);
  if (value) UNSAVED_DRAFTS.set(key, value);
  while (UNSAVED_DRAFTS.size > 20) UNSAVED_DRAFTS.delete(UNSAVED_DRAFTS.keys().next().value);
}
const sameLayout = (a, b) => HIDEOUT_SLOTS.every(({ id }) => a?.[id] === b?.[id]);
// 아지트 2단계(2026년 11월 · 선생님 요청) — 꾸미는 동안 소품을 끌어 옮기고(칸에 맞춰 붙음) 방향키로 한 칸씩 옮기며,
// 좌우로 뒤집고 돌립니다. 판정(바닥 · 벽 안 · 겹침 · 창문 · 포털 · 길)은 lib/readingHideoutArrange.js — 서버가 저장할 때 다시 봅니다.
// 끌어 놓은 자리가 안 되면 이 반지름 안의 가까운 빈자리에 놓고(장면 px), 그 안에 없으면 원래 자리로 돌아갑니다.
const DROP_SNAP_RADIUS = 64;
const ARROW_KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
// 따로 옮기지 않는 소품 — 창문을 따라갑니다(꾸미기 패널의 안내). 책 받침대 · 북엔드 · 오르골 · 무드등 · 트로피는 한때 받치는 가구를
// 따라가기만 했는데, 이제 책상 · 책장 · 선반 위로 옮깁니다(2026년 11월 · 선생님 요청 — 아래 '놓을 곳').
const FOLLOW_NOTES = {
  garland: "창문에 걸려 있어 옮길 수 없어요.",
};
// 위에 소품을 올릴 수 있는 가구 — 그 가구를 옮기면 위의 소품도 함께 움직입니다(꾸미기 패널의 안내)
const BEARER_NOTES = { desk: "책상 위의 소품도 함께 움직여요. ", shelf: "책장 위의 소품도 함께 움직여요. ", "wall-shelf": "선반 위의 소품도 함께 움직여요. " };
const placeLabel = (target) => target === "floor" ? "바닥" : HIDEOUT_SURFACE_LABELS[target] ?? "";
const place = (x, y, width) => ({ left: `${x / HIDEOUT_SCENE.width * 100}%`, top: `${y / HIDEOUT_SCENE.height * 100}%`, width: `${width / HIDEOUT_SCENE.width * 100}%` });
const disabledError = (error) => /disabled|reading-off/.test(String(error?.code || ""));
const themeName = (item) => ({ forest: "숲속", starlight: "별빛", explorer: "탐험", coastal: "바닷가" }[item.theme] || "기본");
const unlockLevel = (item) => item.unlock?.level || item.unlockStage || item.sampleUnlockStage || 0;
// 소품 묶음 — 2026년 11월에 작은 소품 여섯을 바닥 가구로 바꾸며 다시 묶었습니다(자리 이름은 예전 그대로):
// 1인 독서 소파(pencil-caddy) · 독서 침대(desk-calendar)는 가구, 독서 텐트(pet-water) · 지구본 스탠드(hourglass)는 독서 도구,
// 스탠드 어항(badge-display)은 펫 소품, 큰 나무 화분(cover-display)은 정원.
// '가구·러그'의 끝 '포털'(2026년 11월 · 선생님 요청 — 포털의 자리도 바꿈)은 고르는 소품이 아니라 돌아가는 포털입니다: 누르면 테마 대신
// 포털 카드(제자리로 · 안내)가 섭니다. 방 그림에서 포털을 누른 때도 이 종류가 열립니다. 본인 방에만(선생님의 학생 방 보기에는 포털이 없음).
const ITEM_GROUPS = [
  { id: "furniture", label: "가구·러그", slots: ["rug", "cushion", "desk", "pencil-caddy", "shelf", "wall-shelf", "desk-calendar", HIDEOUT_PORTAL_UNIT] },
  { id: "reading", label: "독서 도구", slots: ["bookmark-rack", "bookstand", "bookends", "pet-water", "hourglass"] },
  { id: "pet", label: "펫 소품", slots: ["bed", "pet-toys", "badge-display"] },
  { id: "garden", label: "조명·정원", slots: ["lamp", "mood-light", "plant", "cover-display", "terrarium", "hanging-planter"] },
  { id: "wall", label: "벽·시간", slots: ["wall", "memo-board", "clock"] },
  { id: "keepsakes", label: "보물·기념", slots: ["music-box", "chest", "travel-case", "garland", "book-trophy", "door-plaque"] },
];
// 걷는 키는 방향키뿐 — 책 광장 · 교실과 같게(선생님 결정: 그 두 방에서 A는 행동 · S와 C는 고르는 키라, 아지트에서만
// W A S D로 걸면 같은 키가 방마다 다른 일을 합니다. 한때 아지트만 W A S D로도 걸었습니다 — 되살리지 마세요).
const WALK_KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

// Identity is the editor's lifetime: requests and drafts from a previous student
// must not appear after a teacher changes students or classes.
export default function ReadingHideout(props) {
  const uid = props.student?.uid || props.user?.uid || "";
  const readOnly = !!props.readOnly || !!props.student?.uid;
  return <HideoutRoom key={`${props.classId || ""}:${uid}:${readOnly ? "view" : "own"}`} {...props} viewUid={uid} readOnly={readOnly} />;
}

// petFeed — 그 반의 펫 먹이 규칙(lib/readingPet.js의 petCareRules — 그 학생이 반에 들어온 날까지 반영한 것 · 끈 반이면 on이 거짓).
//   먹이를 찾아 떠난 펫은 방석에도 없습니다(책 광장과 같은 판정 — lib/petCare.js의 careAway). 돌아오면 다시 쉽니다.
function HideoutRoom({ classId, user, student = null, viewUid, summary, readOnly, characterOn = true, petOn = false, petFeed = null, fruits = 0, onDisabled, onExit, initialView = null, onLoaded = null, exitLabel = "학생 서재로", hideExitButton = false, hideHeading = false, returnRoom = "classroom" }) {
  // Only the two public map rooms can be return destinations. The parent owns
  // navigation; this private room uses the destination solely for its labels.
  const returnPlace = returnRoom === "plaza" ? "책 광장" : "교실";
  const returnTo = returnRoom === "plaza" ? "책 광장으로" : "교실로";
  const [room, setRoom] = useState(null);
  const [draft, setDraft] = useState(null);
  // 꾸미는 동안의 배치(아지트 2단계 — 소품마다 자리 · 뒤집기 · 돌리기) · 고른 벽 선반(둘 가운데) · 끄는 중인 소품의 자리
  const [arrange, setArrange] = useState(null);
  const [ledge, setLedge] = useState("ledge-left");
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState("rug");
  const [detail, setDetail] = useState(null);
  // 꾸미던 것을 두고 나가려 할 때 되묻는 창 — 어디로 나가려 했나(null: 창 없음 · "origin": 들어온 곳(포털) · "plaza": 머리의 '광장으로')
  const [exitPending, setExitPending] = useState(null);
  const [resetPending, setResetPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [character, setCharacter] = useState(null);
  const [petMirror, setPetMirror] = useState(null);
  // 방 주인의 누적 경험치(서버가 방과 함께 보냄 — petGrowthXp). 책 봄 요약(summary)이 없는 화면 — 선생님이 학생의
  // 방을 볼 때 — 펫이 자란 만큼 그리는 바탕입니다(없으면 다 자란 펫도 2단계 · 경험치 0으로 보였음).
  const [ownerGrowth, setOwnerGrowth] = useState(null);
  // 펫 정보 창(방석의 펫을 누르면 — PetInfoModal · 선생님 요청). 떠 있는 동안은 걷지 않습니다(movement의 enabled)
  const [petOpen, setPetOpen] = useState(false);
  const [spriteMissing, setSpriteMissing] = useState(false);
  const [sceneWidth, setSceneWidth] = useState(0);
  const alive = useRef(true);
  const saveLock = useRef(false);
  const disabledRef = useRef(onDisabled);
  const exitRef = useRef(onExit);
  const requestExitRef = useRef(null);
  // A teacher's gallery has already fetched this exact student's read-only
  // snapshot. Reuse it within that gallery session; explicit reload revalidates.
  const initialViewRef = useRef(initialView);
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  const spriteRef = useRef(null);
  disabledRef.current = onDisabled;
  exitRef.current = onExit;
  const categoryId = useId();
  const draftKey = `${classId || ""}:${viewUid}`;
  const draftSnapshot = useRef(undefined);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setRoom(null); setDraft(null); setArrange(null); setDrag(null); setProgress(null); setOwnerGrowth(null); setError(""); setNotice(""); setEditing(false); setDetail(null);
    if (!classId || !viewUid) { setLoading(false); return undefined; }
    const initial = initialViewRef.current;
    const cached = readOnly && reload === 0 && initial?.classId === classId && initial?.uid === viewUid && initial?.value?.room && initial?.value?.progress ? initial.value : null;
    (cached ? Promise.resolve(cached) : fetchReadingHideout(classId, readOnly ? viewUid : null)).then((value) => {
      if (!current) return;
      loadedRef.current?.(viewUid, value);
      const remembered = !readOnly ? UNSAVED_DRAFTS.get(draftKey) : null;
      const restore = remembered?.revision === value.room.revision;
      const restored = restore ? normalizeHideoutRoom({ ...value.room, layout: remembered.layout, arrange: remembered.arrange }, value.progress) : value.room;
      const restoredArrange = settleHideoutArrange(restored.layout, restored.arrange);
      setRoom(value.room); setDraft(restored.layout); setArrange(restoredArrange); setProgress(value.progress); setLoading(false);
      setOwnerGrowth(Number.isFinite(value.petGrowthXp) ? value.petGrowthXp : null);
      if (restore && (!sameLayout(restored.layout, value.room.layout) || !sameHideoutArrange(restoredArrange, value.room.arrange))) { setEditing(true); setNotice("이 탭에서 꾸미던 모습을 다시 열었어요. 마음에 들면 저장해 주세요."); }
      else if (remembered) { keepDraft(draftKey, null); setNotice("저장된 방이 바뀌어 최신 모습을 열었어요."); }
    }).catch((e) => {
      if (!current) return;
      setError(e?.message || "아지트를 불러오지 못했어요. 다시 시도해 주세요."); setLoading(false);
      if (disabledError(e)) disabledRef.current?.();
    });
    return () => { current = false; };
  }, [classId, viewUid, readOnly, reload, draftKey]);

  useEffect(() => {
    setCharacter(null); setSpriteMissing(false);
    if (!viewUid || !characterOn) return undefined;
    let current = true;
    const off = subscribeMyReadingCharacter(viewUid, (value) => { if (current) setCharacter(value); });
    return () => { current = false; off?.(); };
  }, [viewUid, characterOn]);
  useEffect(() => {
    setPetMirror(null);
    if (!viewUid || !petOn) return undefined;
    let current = true;
    const off = subscribeMyReadingPet(viewUid, (value) => { if (current) setPetMirror(value?.mirror || null); });
    return () => { current = false; off?.(); };
  }, [viewUid, petOn]);

  const teacherOwn = !readOnly && progress?.teacher === true;
  const eligibility = useMemo(() => ({
    level: progress?.level ?? summary?.level ?? 1,
    earnedBadges: progress?.earnedBadgeIds ?? summary?.earnedBadges ?? [],
    teacher: teacherOwn,
  }), [summary?.level, summary?.earnedBadges, progress, teacherOwn]);
  const savedRoom = useMemo(() => normalizeHideoutRoom(room, eligibility), [room, eligibility]);
  const shownRoom = useMemo(() => normalizeHideoutRoom({ ...room, layout: draft, arrange: arrange ?? room?.arrange }, eligibility), [room, draft, arrange, eligibility]);
  // 끄는 동안에는 그 소품만 손가락(마우스)을 따라 그립니다 — 놓을 때 판정해 배치에 넣거나 되돌림. 작은 소품은 책상 · 책장 · 선반의
  // 윗면 가까이 가면 그 윗면에 붙어 보입니다(drag.top — 놓으면 거기 올라감).
  const liveArrange = useMemo(() => {
    if (!drag) return shownRoom.arrange;
    const now = hideoutUnitPlacement(shownRoom.arrange, drag.unit);
    return hideoutWithEntry(shownRoom.arrange, drag.unit, drag.top ? { on: drag.top.on, at: drag.top.at, flip: now.flip } : { ...now, on: null, x: drag.x, y: drag.y });
  }, [drag, shownRoom.arrange]);
  const props = useMemo(() => hideoutSceneProps(shownRoom.layout, liveArrange), [shownRoom.layout, liveArrange]);
  const map = useMemo(() => createHideoutWalkMap(shownRoom.layout, shownRoom.arrange), [shownRoom.layout, shownRoom.arrange]);
  // 돌아가는 포털(학생이 옮길 수 있음 — 배치의 'portal' 칸) — 그릴 때는 끄는 중인 자리까지(liveArrange), 걷기 · 나가기는 정해진 배치를 따릅니다.
  const portal = useMemo(() => hideoutReturnPortal(liveArrange), [liveArrange]);
  const gate = useMemo(() => hideoutReturnPortal(shownRoom.arrange), [shownRoom.arrange]);
  // 포털이 방에 있는가 — 본인 방에만(선생님이 학생의 방을 볼 때는 나가는 길이 아니라 그리지 않음)
  const portalShown = !!onExit && !readOnly;
  const dirty = !!room && (!sameLayout(savedRoom.layout, shownRoom.layout) || !sameHideoutArrange(savedRoom.arrange, shownRoom.arrange));
  draftSnapshot.current = room ? (!readOnly && dirty ? { revision: room.revision, layout: { ...shownRoom.layout }, arrange: { ...shownRoom.arrange } } : null) : undefined;
  useEffect(() => () => { if (!readOnly && draftSnapshot.current !== undefined) keepDraft(draftKey, draftSnapshot.current); }, [draftKey, readOnly]);
  const selectedSlot = HIDEOUT_SLOTS.find((slot) => slot.id === category) || HIDEOUT_SLOTS[0];
  const selectedGroup = ITEM_GROUPS.find((group) => group.slots.includes(category)) || ITEM_GROUPS[0];
  const choices = HIDEOUT_ITEMS.filter((item) => item.slot === selectedSlot.id);
  const detailChoices = detail ? HIDEOUT_ITEMS.filter((item) => item.slot === detail.slot) : [];
  const detailIndex = detailChoices.findIndex((item) => item.id === detail?.id);
  const myName = teacherOwn ? "선생님" : (readOnly ? student?.realName || student?.name : user?.realName || user?.name || user?.displayName) || "나";
  const appearance = characterOf({ uid: viewUid, character: characterOn ? character : null });
  const spriteSrc = plazaCharacterSheet(appearance);
  const petGone = petOn && !!petFeed?.on && careAway(petMirror, petFeed, kstToday());
  const growth = summary ? petGrowthOfSummary(summary) : ownerGrowth;
  // 머리 오른쪽 위의 캐릭터 카드(선생님 요청 · 2026년 11월 — 독서 레벨 알약 대신 책 봄 프로필의 그 카드). 레벨 · 경험치 막대는 방과
  // 함께 온 방 주인의 누적 경험치(petGrowthXp)로 셉니다 — 방의 잠금(progress.level)과 같은 서버 값이라 둘이 어긋나지 않습니다.
  // 선생님 본인의 방(독서 레벨이 없음)과 학생 캐릭터를 끈 반은 지금처럼 알약입니다.
  const cardSummary = useMemo(() => Number.isFinite(ownerGrowth) ? readingLevelProgress(ownerGrowth) : { level: progress?.level ?? summary?.level ?? 1 }, [ownerGrowth, progress?.level, summary?.level]);
  const showCard = characterOn && !teacherOwn && !!viewUid;
  const pet = petOn && !petGone ? petProgress(petMirror, growth) : null;
  const bed = props.find((prop) => prop.category === "bed");
  // ── 아지트 2단계: 꾸미는 동안 소품의 자리 · 방향 바꾸기 ──
  const arranging = !readOnly && editing && !saving && !detail && !exitPending && !resetPending && !petOpen;
  // 패널에서 고른 종류가 가리키는 소품(벽 선반은 둘 가운데 고른 것) — 책상 위 · 선반 위 소품은 받치는 가구를 가리킴. '포털'은 포털.
  const portalPicked = category === HIDEOUT_PORTAL_UNIT;
  const categoryUnit = portalPicked ? HIDEOUT_PORTAL_UNIT : category === "wall-shelf" ? ledge : HIDEOUT_UNITS.includes(category) ? category : null;
  const categoryProp = portalPicked ? null : props.find((prop) => prop.category === category && (category !== "wall-shelf" || prop.unit === ledge));
  const selectedUnit = portalPicked ? (portalShown ? HIDEOUT_PORTAL_UNIT : null) : categoryProp ? (categoryProp.unit ?? categoryProp.parentUnit) : null;
  const movement = useMovement({
    enabled: !!room && !loading && !readOnly && !editing && !saving && !detail && !exitPending && !resetPending && !petOpen,
    map, gate, spriteRef, onPortal: () => requestExitRef.current?.(),
  });
  // 들어오자마자 방향키로 걷게 무대에 초점을 둡니다 — 교실의 포털로 들어오면 광장의 무대가 사라져 초점이 본문으로
  // 떨어지고, 그때는 방을 한 번 눌러야 방향키가 들었습니다(선생님 신고). 꾸미기를 마치거나 거둔 뒤에도(꾸미던 단추가
  // 사라짐). 소품 창 · 되묻는 창을 닫을 때는 그 창이 초점을 돌려주므로 건드리지 않습니다(walkReady가 그대로).
  useEffect(() => { if (!arranging) { dragRef.current = null; setDrag(null); } }, [arranging]);
  const walkReady = !!room && !loading && !readOnly && !editing;
  const { focusStage } = movement;
  useEffect(() => { if (walkReady) focusStage(); }, [walkReady, focusStage]);

  useEffect(() => {
    const scene = movement.stageRef.current;
    if (!scene) return undefined;
    const measure = () => setSceneWidth(scene.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(scene);
    return () => observer.disconnect();
  }, [loading, room, movement.stageRef]);

  useEffect(() => {
    if (!dirty || readOnly) return undefined;
    const leave = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty, readOnly]);

  // 나가기 — to: "origin"(들어온 곳 — 포털 · 선생님의 '학생 서재로') 또는 "plaza"(머리의 '광장으로' — 어디서 왔든 책 광장).
  // 꾸미던 것이 저장 전이면 먼저 되묻습니다(exitPending). 부모의 onExit에는 "plaza"만 건넵니다(없으면 들어온 곳으로).
  function leaveTo(to) { exitRef.current?.(to === "plaza" ? "plaza" : undefined); }
  function requestExit(to = "origin") {
    if (saving) return;
    movement.stop();
    const dest = to === "plaza" ? "plaza" : "origin";
    if (!readOnly && dirty) setExitPending(dest);
    else leaveTo(dest);
  }
  requestExitRef.current = requestExit;

  function showDetail(item) {
    movement.stop(); setDetail(item); setNotice("");
  }
  function browseDetail(direction) {
    if (saving) return;
    setDetail((current) => {
      const items = HIDEOUT_ITEMS.filter((item) => item.slot === current?.slot);
      const index = items.findIndex((item) => item.id === current?.id);
      return index < 0 ? current : items[(index + direction + items.length) % items.length];
    });
  }
  function chooseCategory(id) {
    if (saving) return;
    movement.stop(); setCategory(id);
  }
  function applyItem(item) {
    if (readOnly || saving || !isHideoutItemUnlocked(item, eligibility)) return;
    const layout = { ...shownRoom.layout, [item.slot]: item.id };
    // 옮겨 둔 자리 · 뒤집기는 그대로(돌린 그림이 없는 소품이면 앞모습으로). 그 자리를 다른 가구가 차지했으면(크기가 다른 소품 ·
    // 비어 있던 자리를 옮긴 가구가 차지함) 가까운 빈자리에 놓고, 빈자리가 없으면 놓지 않고 까닭을 알립니다.
    let next = shownRoom.arrange;
    if (HIDEOUT_UNITS.includes(item.slot)) {
      const now = hideoutPlacementNow(shownRoom.layout, next, item.slot);
      const patch = { ...now, turn: now.turn && !!hideoutTurnArt(item.id) };
      // 늘 가구 위에 서는 소품이 처음 자리(칸 없음)면 칸 없이 그대로(정해진 가구 위)
      if (Object.hasOwn(next, item.slot) || !hideoutUnitTopOnly(item.slot)) next = hideoutWithEntry(next, item.slot, patch);
      // 그 소품 자리가 막히면 가까운 빈자리 — 다른 소품의 문제(예: 책상을 바꿨더니 위의 화분이 들어가지 않음)는 아래 맞춤이 제자리로
      const issue = hideoutArrangeProblem(layout, next);
      if (issue && (issue.unit === item.slot || issue.unit == null)) {
        const spot = hideoutFindSpot(layout, shownRoom.arrange, item.slot, { from: now, patch: { flip: patch.flip, turn: patch.turn } });
        if (!spot) { setDetail(null); setNotice(`${eulReul(item.name)} 놓을 빈자리가 없어요. 다른 가구를 옮겨 자리를 만든 뒤 다시 놓아 주세요.`); return; }
        next = hideoutWithEntry(shownRoom.arrange, item.slot, { ...patch, ...spot });
      }
    }
    const settled = settleHideoutArrange(layout, next);
    const returned = Object.keys(next).filter((unit) => unit !== item.slot && !Object.hasOwn(settled, unit));
    setDraft(layout); setArrange(settled); setEditing(true); setDetail(null);
    setNotice(`${eulReul(item.name)} 놓았어요. ${returned.length ? `자리가 모자란 ${eunNeun(returned.map(unitLabel).join(" · "))} 제자리로 옮겼어요. ` : ""}‘꾸미기 완료’를 누르면 저장돼요.`);
  }
  function clearSlot() {
    if (readOnly || saving || HIDEOUT_DEFAULT_LAYOUT[category] != null) return;
    const layout = { ...shownRoom.layout, [category]: null };
    setDraft(layout); setArrange(settleHideoutArrange(layout, hideoutWithEntry(shownRoom.arrange, category, null))); setEditing(true); setNotice("");
  }
  function cancelEditing() {
    if (saving) return;
    setDraft(savedRoom.layout); setArrange(savedRoom.arrange); setEditing(false); setError(""); setNotice("저장된 모습으로 돌아왔어요.");
  }

  const unitLabel = (unit) => unit === "ledge-left" ? "작은 벽 선반" : unit === "ledge-right" ? "아래 진열 선반" : unit === HIDEOUT_PORTAL_UNIT ? "포털"
    : HIDEOUT_SLOTS.find((entry) => entry.id === unit)?.label ?? "소품";
  // 한 소품을 patch(자리 · 뒤집기 · 돌리기 · 가구 위 자리)대로 놓습니다 — 안 되면 radius 안의 가까운 빈자리, 그래도 없으면 그대로
  // 두고 까닭을 알림. full이면 방 전체를 봄(제자리로 — 그 자리를 옮긴 다른 가구가 차지했을 수 있음).
  function placeUnit(unit, patch, { radius = 0, full = false, done = "" } = {}) {
    const layout = shownRoom.layout, current = shownRoom.arrange;
    const candidate = hideoutWithEntry(current, unit, patch);
    const issue = hideoutArrangeProblem(layout, candidate, full ? {} : { only: unit });
    if (!issue) { setArrange(candidate); setNotice(done); return true; }
    // 위에 올린 소품 때문에 막힌 가구(책상 · 책장 · 벽 선반을 돌렸더니 위가 좁아짐) — 가구를 다른 자리로 옮겨도 그대로라 찾지 않음
    if (issue.unit && issue.unit !== unit && props.find((prop) => prop.unit === issue.unit)?.parentUnit === unit) {
      setNotice(`위에 놓인 ${unitLabel(issue.unit)} 때문에 그렇게 할 수 없어요. ${eulReul(unitLabel(issue.unit))} 먼저 옮겨 주세요.`);
      return false;
    }
    const spot = radius > 0 ? hideoutFindSpot(layout, current, unit, { from: patch, patch: { flip: !!patch.flip, turn: !!patch.turn }, radius }) : null;
    if (spot) { setArrange(hideoutWithEntry(current, unit, { ...patch, ...spot })); setNotice(`${done} 그 자리가 막혀 가까운 빈자리에 놓았어요.`); return true; }
    setNotice(issue.message);
    return false;
  }
  function flipUnit(unit) {
    const now = hideoutPlacementNow(shownRoom.layout, shownRoom.arrange, unit);
    placeUnit(unit, { ...now, flip: !now.flip }, { radius: 240, done: `${eulReul(unitLabel(unit))} 좌우로 뒤집었어요.` });
  }
  function turnUnit(unit) {
    const now = hideoutUnitPlacement(shownRoom.arrange, unit);
    placeUnit(unit, { ...now, turn: !now.turn }, { radius: 400, done: `${eulReul(unitLabel(unit))} 돌렸어요.` });
  }
  function homeUnit(unit) {
    const done = `${eulReul(unitLabel(unit))} 제자리로 옮겼어요.`;
    if (!hideoutUnitTopOnly(unit)) {
      placeUnit(unit, { ...HIDEOUT_DEFAULT_ANCHORS[unit], on: null, flip: false, turn: false }, { radius: 720, full: true, done });
      return;
    }
    // 늘 가구 위에 서는 소품 — 처음 자리(정해진 가구 위 · 칸 없음). 그 자리를 다른 소품이 차지했으면 그 가구 위의 가까운 빈자리
    const layout = shownRoom.layout, home = hideoutWithEntry(shownRoom.arrange, unit, null);
    if (!hideoutArrangeProblem(layout, home)) { setArrange(home); setNotice(done); return; }
    const spotAt = hideoutSceneProps(layout, home).find((prop) => prop.unit === unit);
    const spot = spotAt ? hideoutFindSpot(layout, shownRoom.arrange, unit, { from: { x: spotAt.x, y: spotAt.y }, target: HIDEOUT_TOP_HOME[unit], radius: 4000 }) : null;
    if (!spot) { setNotice(`${placeLabel(HIDEOUT_TOP_HOME[unit])}에 빈자리가 없어요. 다른 소품을 옮겨 자리를 만든 뒤 다시 눌러 주세요.`); return; }
    setArrange(hideoutWithEntry(shownRoom.arrange, unit, { ...hideoutUnitPlacement(shownRoom.arrange, unit), ...spot }));
    setNotice(`${done} 처음 자리가 막혀 가까운 빈자리에 놓았어요.`);
  }
  // '놓을 곳'(바닥 · 책상 위 · 책장 위 · 작은 벽 선반 · 아래 진열 선반) — 그곳의 가까운 빈자리로 옮깁니다(작은 소품만).
  function placeOn(unit, target) {
    const now = hideoutPlacementNow(shownRoom.layout, shownRoom.arrange, unit);
    if ((now.on ?? "floor") === target) return;
    const spot = hideoutFindSpot(shownRoom.layout, shownRoom.arrange, unit, { target, radius: target === "floor" ? 720 : 4000 });
    if (!spot) { setNotice(`${placeLabel(target)}에 ${iGa(unitLabel(unit))} 들어갈 빈자리가 없어요. 다른 소품을 옮겨 자리를 만든 뒤 다시 골라 주세요.`); return; }
    setArrange(hideoutWithEntry(shownRoom.arrange, unit, { ...now, ...spot }));
    setNotice(target === "floor" ? `${eulReul(unitLabel(unit))} 바닥에 내려놓았어요.` : `${eulReul(unitLabel(unit))} ${placeLabel(target)}에 올렸어요.`);
  }
  // 방 그림에서 소품을 누르면 그 종류를 고르고(패널이 따라감 — 책상 위 · 선반 위 소품은 그 소품의 종류), 끌면 손가락을
  // 따라 그리다가 놓을 때 판정합니다.
  function pickUnit(unit, picked = hideoutUnitCategory(unit)) {
    if (unit === "ledge-left" || unit === "ledge-right") setLedge(unit);
    setCategory(picked);
  }
  const scenePoint = (e) => {
    const r = movement.stageRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * HIDEOUT_SCENE.width, y: (e.clientY - r.top) / r.height * HIDEOUT_SCENE.height };
  };
  function arrangeDown(e) {
    const target = e.target.closest?.("[data-unit]");
    if (e.button !== 0 || !target) return;
    e.preventDefault();
    const unit = target.dataset.unit;
    pickUnit(unit, target.dataset.category || undefined);
    movement.stageRef.current?.focus({ preventScroll: true });
    // 손가락과 소품의 바닥 가운데 사이(그대로 유지) — 가구 위의 소품은 그려진 자리(받치는 가구를 따라 셈한 자리)에서
    const point = scenePoint(e), at = props.find((prop) => prop.unit === unit) ?? hideoutUnitPlacement(shownRoom.arrange, unit);
    dragRef.current = { unit, id: e.pointerId, ox: at.x - point.x, oy: at.y - point.y, start: point, moved: false, last: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function arrangeMove(e) {
    const current = dragRef.current;
    if (!current || current.id !== e.pointerId) return;
    const point = scenePoint(e);
    if (!current.moved && Math.hypot(point.x - current.start.x, point.y - current.start.y) < 6) return;
    current.moved = true;
    const anchor = { x: Math.min(HIDEOUT_SCENE.width, Math.max(0, point.x + current.ox)), y: Math.min(HIDEOUT_SCENE.height, Math.max(0, point.y + current.oy)) };
    const next = hideoutSnap(anchor);
    // 작은 소품은 책상 · 책장 · 선반의 윗면 가까이 가면 그 윗면에 붙음(놓으면 올라감)
    const top = hideoutUnitTops(current.unit) ? hideoutTopTarget(shownRoom.layout, shownRoom.arrange, current.unit, anchor) : null;
    current.last = { ...next, top };
    setDrag((before) => before?.unit === current.unit && before.x === next.x && before.y === next.y && before.top?.on === top?.on && before.top?.at === top?.at
      ? before : { unit: current.unit, ...next, top });
  }
  function arrangeUp(e) {
    const current = dragRef.current;
    if (!current || current.id !== e.pointerId) return;
    dragRef.current = null; setDrag(null);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!current.moved || !current.last) return;
    const now = hideoutPlacementNow(shownRoom.layout, shownRoom.arrange, current.unit), { top } = current.last;
    const label = unitLabel(current.unit);
    if (top) {
      if (now.on === top.on && now.at === top.at) return;
      placeUnit(current.unit, { on: top.on, at: top.at, flip: now.flip }, { radius: DROP_SNAP_RADIUS,
        done: now.on === top.on ? `${eulReul(label)} 옮겼어요.` : `${eulReul(label)} ${placeLabel(top.on)}에 올렸어요.` });
      return;
    }
    if (!now.on && now.x === current.last.x && now.y === current.last.y) return;
    placeUnit(current.unit, { ...now, on: null, x: current.last.x, y: current.last.y }, { radius: DROP_SNAP_RADIUS,
      done: now.on ? `${eulReul(label)} 바닥에 내려놓았어요.` : `${eulReul(label)} 옮겼어요.` });
  }
  function arrangeCancel() { dragRef.current = null; setDrag(null); }
  // 방향키로 한 칸(8px) · Shift는 네 칸 — 다른 가구에 막히면 그 너머의 빈자리로 건너뜁니다. 가구 위의 작은 소품은 ← → 로 그 위를
  // 따라, ↑ ↓ 로 위아래의 다른 가구 위(바닥에도 서는 소품은 ↓ 로 바닥)로 건너갑니다.
  function arrangeKey(e) {
    const dir = ARROW_KEYS[e.code];
    if (!dir || !selectedUnit || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    e.preventDefault();
    const next = hideoutNudge(shownRoom.layout, shownRoom.arrange, selectedUnit, dir[0], dir[1], e.shiftKey ? HIDEOUT_GRID * 4 : HIDEOUT_GRID);
    if (!next) { setNotice("그쪽으로는 더 옮길 수 없어요."); return; }
    const now = hideoutUnitPlacement(shownRoom.arrange, selectedUnit);
    setArrange(hideoutWithEntry(shownRoom.arrange, selectedUnit, { ...now, ...next }));
    const label = unitLabel(selectedUnit), from = now.on ?? null, to = Object.hasOwn(next, "on") ? next.on : from;
    setNotice(from === to ? `${eulReul(label)} 옮겼어요.` : to ? `${eulReul(label)} ${placeLabel(to)}에 올렸어요.` : `${eulReul(label)} 바닥에 내려놓았어요.`);
  }

  // leave — 저장한 뒤 나갈 곳(false: 머묾 · "origin" · "plaza" — 되묻는 창의 '저장하고 …')
  async function finish(leave = false) {
    if (readOnly || saveLock.current || !room) return false;
    if (!dirty) {
      setEditing(false); setExitPending(null);
      if (leave) leaveTo(leave); else setNotice("꾸미기를 마쳤어요.");
      return true;
    }
    saveLock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveReadingHideout(classId, { version: 2, layout: shownRoom.layout, arrange: shownRoom.arrange, revision: room.revision });
      if (!alive.current) return false;
      setRoom(result.room); setDraft(result.room.layout); setArrange(result.room.arrange ?? {}); setProgress(result.progress); setEditing(false); setExitPending(null);
      draftSnapshot.current = null;
      keepDraft(draftKey, null);
      if (leave) leaveTo(leave); else setNotice("아지트를 저장했어요.");
      return true;
    } catch (e) {
      if (!alive.current) return false;
      const conflict = e?.status === 409 || /conflict|revision|stale/.test(String(e?.code || ""));
      setError(conflict ? "다른 창에서 아지트가 바뀌었어요. 저장된 모습을 다시 불러온 뒤 꾸며 주세요." : e?.message || "저장하지 못했어요. 고른 소품은 그대로 있으니 다시 시도해 주세요.");
      setExitPending(null);
      if (disabledError(e)) disabledRef.current?.();
      return false;
    } finally {
      saveLock.current = false;
      if (alive.current) setSaving(false);
    }
  }

  if (loading) return <div className="reading-loading" role="status"><span className="reading-loader" />나만의 아지트를 열고 있어요.</div>;
  if (!room) return <section className="hideout hideout-empty" aria-label="나의 아지트">
    <p role="alert">{error || "반과 계정을 먼저 확인해 주세요."}</p>
    <div className="hideout-actions"><button type="button" onClick={() => setReload((value) => value + 1)}>다시 불러오기</button>{onExit && <button type="button" onClick={onExit}>돌아가기</button>}</div>
  </section>;

  const actorSize = HIDEOUT_OCCUPANTS.character.width * sceneWidth / HIDEOUT_SCENE.width;
  // 포털 아래 이름표('책 광장으로')가 장면 밖으로 잘리지 않게 — 바닥 아래쪽이면 포털 위에, 양옆 끝이면 그쪽 끝에 맞춰 둡니다.
  const portalLabelY = portal.y > 900 ? "top" : "bottom";
  const portalLabelX = portal.x < 200 ? "start" : portal.x > 1440 ? "end" : "center";
  const portalLit = arranging && selectedUnit === HIDEOUT_PORTAL_UNIT;
  return <section className={`hideout${editing ? " is-editing" : ""}`} aria-label={`${myName}의 아지트`} aria-busy={saving}>
    {!(readOnly && hideHeading) && <header className="hideout-heading">
      <div className="hideout-title"><p className="hideout-eyebrow">이야기가 머무는 작은 방</p><h2>{readOnly || teacherOwn ? `${myName}의 아지트` : "나의 아지트"}</h2></div>
      {/* 오른쪽 — 단추들과 그 오른쪽 끝(화면 오른쪽 위)의 캐릭터 카드(선생님 요청 · 2026년 11월 — 독서 레벨 알약 대신). 한 줄에 다
          안 들어가면 카드는 제목 줄 오른쪽에 남고 단추가 그 아래 줄로 내려갑니다(hideout.css의 .hideout-heading 격자). */}
      {/* 꾸미기를 시작한 그 자리에 마치는 단추가 섭니다(선생님 신고 — 한때 '꾸미기 취소 · 꾸미기 완료'가 오른쪽 패널의 소품 카드
          맨 아래에 있어, 패널을 끝까지 굴려야 보였고 꾸미기를 켜면 저장 · 끝내기가 없는 것처럼 보였음). 그 자리로 되돌리지 마세요. */}
      {(!readOnly || (onExit && !hideExitButton)) && <div className="hideout-actions">
        {/* '아지트 꾸미기' 오른쪽의 '광장으로'(선생님 요청 — 포털만으로는 나가는 길이 안 보였음): 어디서 들어왔든 책 광장으로 갑니다
            (광장의 아지트 포털 아래에 섬 · 교실로는 그 광장에서 · 들어온 곳으로는 방의 포털로). 두 단추는 같은 크기(.hideout-head-buttons). */}
        {!readOnly && !editing && <div className="hideout-head-buttons">
          <button type="button" className="hideout-primary" onClick={() => { movement.stop(); setEditing(true); setNotice(""); }}>아지트 꾸미기</button>
          {onExit && <button type="button" className="hideout-to-plaza" onClick={() => requestExit("plaza")} disabled={saving} title="책 광장으로 돌아가요">광장으로</button>}
        </div>}
        {!readOnly && editing && <>
          <button type="button" onClick={() => setResetPending(true)} disabled={saving}>모든 소품 기본으로</button>
          <button type="button" onClick={cancelEditing} disabled={saving}>꾸미기 취소</button>
          <button type="button" className="hideout-primary" onClick={() => finish()} disabled={saving}>{saving ? "저장 중…" : "꾸미기 완료"}</button>
        </>}
        {onExit && readOnly && !hideExitButton && <button type="button" onClick={() => requestExit()} disabled={saving}>{exitLabel}</button>}
      </div>}
      {showCard
        ? <div className="hideout-character"><ReadingCharacterSummary uid={viewUid} summary={cardSummary} readOnly={readOnly} /></div>
        : <span className="hideout-level">{teacherOwn ? "모든 소품 사용 가능" : <>독서 레벨 <strong>{eligibility.level}</strong></>}</span>}
    </header>}
    {error && <div className="hideout-error" role="alert"><p>{error}</p><button type="button" disabled={saving} onClick={() => { movement.stop(); keepDraft(draftKey, null); draftSnapshot.current = null; setReload((value) => value + 1); }}>저장된 모습 다시 불러오기</button></div>}
    <p className="hideout-status" role="status" aria-live="polite">{notice}</p>
    <div className="hideout-layout">
    <div className="hideout-room">
    <div className={`hideout-scene${arranging ? " is-arranging" : ""}${drag ? " is-dragging" : ""}`} ref={movement.stageRef} style={{ "--hideout-unit": `${sceneWidth / HIDEOUT_SCENE.width}px` }} tabIndex={readOnly ? -1 : 0} role={readOnly ? "group" : "application"}
      aria-label={readOnly ? "학생 아지트 미리보기. 이동하거나 꾸밀 수 없습니다."
        : editing ? "아지트 꾸미기. 소품이나 포털을 끌어 옮기거나, 고른 것을 방향키로 한 칸씩(Shift는 네 칸) 옮깁니다. 작은 소품은 책상 · 책장 · 선반 위에도 올립니다."
        : `나의 아지트. 누른 곳으로 걸어가고 방향키로도 걷습니다. 포털로 ${returnPlace}에 돌아갑니다.`}
      onClick={movement.onClick} onKeyDown={(e) => { if (arranging) { if (e.target === e.currentTarget) arrangeKey(e); } else movement.onKeyDown(e); }} onBlur={movement.stop}
      onPointerDown={arranging ? arrangeDown : movement.onPointerDown} onPointerMove={arranging ? arrangeMove : movement.onPointerMove}
      onPointerUp={arranging ? arrangeUp : movement.onPointerUp} onPointerCancel={arranging ? arrangeCancel : movement.onPointerCancel}>
      <img className="hideout-background" src={HIDEOUT_SCENE.background} width={HIDEOUT_SCENE.width} height={HIDEOUT_SCENE.height} alt="창가와 나무 바닥이 있는 아늑한 독서방" draggable={false} />
      {props.map((prop) => {
        // 꾸미는 동안 고른 소품은 테두리 빛, 끄는 소품은 살짝 비침 — 책상 · 책장 · 선반을 고르면 그 위의 소품도 함께(같이 움직임)
        const lit = arranging && !!selectedUnit && (prop.unit === selectedUnit || prop.parentUnit === selectedUnit);
        const dragging = !!drag && (prop.unit === drag.unit || prop.parentUnit === drag.unit);
        return <img key={prop.id} src={prop.src} className={`hideout-prop${prop.contactShadow ? " is-grounded" : ""}${prop.flip ? " is-flipped" : ""}${lit ? " is-selected" : ""}${dragging ? " is-dragging" : ""}`}
          data-hideout-slot={prop.category || prop.slot} data-hideout-item={prop.itemId || prop.id} alt="" draggable={false}
          style={{ ...place(prop.x, prop.y, prop.width), zIndex: Math.round(prop.z) }} />;
      })}
      {/* 누르는 칸(꾸미는 동안만) — 그림 상자가 아니라 보이는 상자(투명 여백을 뺀 — hideoutArtBox)만 합니다. 그림 상자로 누르면
          옆 소품의 빈 여백을 눌러도 그 소품이 잡혔습니다. 앞뒤 차례는 그림과 같고, 여기서만 touch-action을 꺼서 폰에서도 끌어
          옮기고 빈 바닥을 쓸면 화면이 구릅니다. 책상 · 책장 · 선반 위의 소품은 받치는 가구보다 위라 그 소품 자체가 잡힙니다(따로 옮김). */}
      {arranging && props.map((prop) => {
        const unit = prop.unit;
        if (!unit) return null;
        const box = hideoutArtBox(prop);
        return <span key={`${prop.id}-hit`} className="hideout-hit" data-unit={unit} data-category={prop.category} aria-hidden="true" style={{
          left: `${box.x0 / HIDEOUT_SCENE.width * 100}%`, top: `${box.y0 / HIDEOUT_SCENE.height * 100}%`,
          width: `${(box.x1 - box.x0) / HIDEOUT_SCENE.width * 100}%`, height: `${(box.y1 - box.y0) / HIDEOUT_SCENE.height * 100}%`, zIndex: Math.round(prop.z),
        }} />;
      })}
      {/* 문패 글자는 문패의 크림색 칸 안에만 — 크기는 장면 단위(그림과 함께 커지고 작아짐), 한 줄 · 두 줄 가운데 큰 쪽(hideoutPlaqueLabel) */}
      {props.filter((prop) => prop.category === "door-plaque").map((prop) => {
        const label = hideoutPlaqueLabel(prop, myName);
        return <span key={`${prop.id}-label`} className="hideout-plaque-label" style={{
          left: `${label.x / HIDEOUT_SCENE.width * 100}%`, top: `${label.y / HIDEOUT_SCENE.height * 100}%`,
          width: `${label.width / HIDEOUT_SCENE.width * 100}%`, fontSize: `calc(var(--hideout-unit, 1px) * ${label.fontSize})`,
        }}>{label.lines.map((line) => <span key={line}>{line}</span>)}</span>;
      })}
      {/* 그림 상자와 누르는 단추(보이는 포털 크기 — portal.hit)를 따로 둡니다: 단추가 그림 상자만 하면 포털 옆의 빈 바닥을 눌러도 포털로 걸어갑니다.
          자리는 배치를 따릅니다(꾸미는 동안 끌어 옮김 — 아래 누르는 칸). 고른 포털은 소품과 같은 흰 테 + 살구빛. */}
      {portalShown && <div className={`hideout-return-portal-art${portalLit ? " is-selected" : ""}${drag?.unit === HIDEOUT_PORTAL_UNIT ? " is-dragging" : ""}`} aria-hidden="true"
        style={{ ...place(portal.x, portal.y, portal.width), aspectRatio: `${portal.width}/${portal.height}` }}>
        <img src={portal.src} alt="" draggable={false} /><img className="hideout-portal-swirl" src={portal.swirl} alt="" draggable={false} />
      </div>}
      {portalShown && <button type="button" className="hideout-return-portal" data-label-y={portalLabelY} data-label-x={portalLabelX}
        style={{ ...place(portal.x, portal.y, portal.hit.width), aspectRatio: `${portal.hit.width}/${portal.hit.height}` }}
        aria-label={`포털로 ${returnPlace} 돌아가기`} title={`포털까지 걸어 ${returnTo} 돌아가기`} onClick={(e) => { e.stopPropagation(); movement.walkTo({ x: gate.x, y: gate.y }); }} disabled={saving || editing}>
        <span>{returnTo}</span>
      </button>}
      {/* 꾸미는 동안 포털을 누르는 칸 — 보이는 포털(타원)만 · 걷기 단추(꾸미는 동안은 꺼짐) 위에 둡니다 */}
      {arranging && portalShown && <span className="hideout-hit hideout-hit--portal" data-unit={HIDEOUT_PORTAL_UNIT} data-category={HIDEOUT_PORTAL_UNIT} aria-hidden="true" style={{
        left: `${(portal.x - portal.hit.width / 2) / HIDEOUT_SCENE.width * 100}%`, top: `${(portal.y - portal.hit.height / 2) / HIDEOUT_SCENE.height * 100}%`,
        width: `${portal.hit.width / HIDEOUT_SCENE.width * 100}%`, height: `${portal.hit.height / HIDEOUT_SCENE.height * 100}%`,
      }} />}
      {movement.marker && <span className="hideout-walk-marker" aria-hidden="true" style={{ left: `${movement.marker.x / HIDEOUT_SCENE.width * 100}%`, top: `${movement.marker.y / HIDEOUT_SCENE.height * 100}%` }} />}
      <div className="hideout-resident" ref={movement.avatarRef} style={{ left: `${movement.position.current.x / HIDEOUT_SCENE.width * 100}%`, top: `${movement.position.current.y / HIDEOUT_SCENE.height * 100}%`, zIndex: 100 + Math.round(movement.position.current.y) }} role="img" aria-label={`${myName}, ${characterName(appearance)}`}>
        <span className="hideout-resident-shadow" style={{ width: actorSize * .35, height: actorSize * .05 }} />
        {spriteSrc && !spriteMissing ? <PlazaSprite ref={spriteRef} src={spriteSrc} size={actorSize || 1} style={{ position: "absolute", left: -actorSize / 2, top: -actorSize * SPRITE_FOOT.y / SPRITE_CELL }} onMissing={() => setSpriteMissing(true)} />
          : <img className="hideout-character-fallback" src={characterImage(appearance)} alt="" draggable={false} style={{ width: actorSize, height: actorSize, left: -actorSize / 2, top: -actorSize * .92 }} />}
        <span className="hideout-resident-name" style={{ bottom: Math.round(actorSize * (spriteSrc && !spriteMissing ? SPRITE_BODY / SPRITE_CELL : .92)) + 5 }}>{myName}</span>
      </div>
      {pet && bed && <RestingPet pet={pet} bed={bed} owner={readOnly ? myName : ""} passive={arranging} onOpen={() => { movement.stop(); setPetOpen(true); }} />}
    </div>
    <p className="hideout-walk-help">{readOnly ? "학생 본인만 아지트를 꾸밀 수 있어요." : editing ? `방 그림에서 소품이나 포털을 끌어 옮기거나, 누른 뒤 방향키로 한 칸씩 옮겨요. 작은 소품은 책상 · 책장 · 선반 위에도 올려요. 다 꾸몄으면 위쪽의 ‘꾸미기 완료’나 ‘꾸미기 취소’를 누르면 다시 걷거나 포털로 ${returnPlace}에 돌아갈 수 있어요.` : `빈 바닥을 누르거나 방향키로 걸어요. ${petGone ? "펫은 먹이를 찾아 떠나 있어요(책 봄에서 다시 불러요). " : pet ? "펫은 창가에서 쉬어요. " : ""}${onExit ? (returnRoom === "plaza" ? "포털이나 위의 ‘광장으로’로 책 광장에 돌아가요." : "포털로 교실에, 위의 ‘광장으로’로 책 광장에 돌아가요.") : ""}`}</p>
    </div>

    <section className="hideout-editor" aria-label="아지트 소품">
      <div className="hideout-editor-heading"><div><h3>{readOnly ? "소품 살펴보기" : "아이템 고르기"}</h3><p>{readOnly ? "종류를 고르면 소품을 크게 볼 수 있어요." : "종류를 고르면 아래에 소품이 보여요."}</p></div></div>
      <div className="hideout-item-groups" role="group" aria-label="아이템 그룹">
        {ITEM_GROUPS.map((group) => <button type="button" key={group.id} data-hideout-group={group.id}
          className={selectedGroup.id === group.id ? "is-selected" : ""} aria-pressed={selectedGroup.id === group.id}
          aria-controls={`${categoryId}-types`} disabled={saving} onClick={() => chooseCategory(group.slots[0])}>{group.label}</button>)}
      </div>
      <div className="hideout-item-types" id={`${categoryId}-types`} role="group" aria-label={`${selectedGroup.label} 종류`}>
        {selectedGroup.slots.filter((id) => id !== HIDEOUT_PORTAL_UNIT || portalShown).map((id) => {
          const label = id === HIDEOUT_PORTAL_UNIT ? "포털" : HIDEOUT_SLOTS.find((entry) => entry.id === id).label;
          return <button type="button" key={id} data-hideout-category={id} className={category === id ? "is-selected" : ""} title={label}
            aria-pressed={category === id} aria-controls={`${categoryId}-preview`} disabled={saving} onClick={() => chooseCategory(id)}>{label}</button>;
        })}
      </div>
      <div className="hideout-item-preview" id={`${categoryId}-preview`} role="region" aria-labelledby={`${categoryId}-title`}>
      {portalPicked && portalShown ? <>
        {/* 포털 — 고르는 테마가 없고 자리만 옮깁니다(꾸미는 동안 끌기 · 방향키 · 제자리로) */}
        <div className="hideout-preview-heading"><h4 id={`${categoryId}-title`}>포털</h4><span>{returnTo} 돌아가는 길 · 자리만 옮겨요</span></div>
        {editing ? <ArrangeTools category={HIDEOUT_PORTAL_UNIT} unit={HIDEOUT_PORTAL_UNIT} itemId={HIDEOUT_PORTAL_UNIT}
          placement={hideoutUnitPlacement(shownRoom.arrange, HIDEOUT_PORTAL_UNIT)} moved={Object.hasOwn(shownRoom.arrange, HIDEOUT_PORTAL_UNIT)}
          ledge={ledge} onLedge={setLedge} label="포털" busy={saving} onFlip={flipUnit} onTurn={turnUnit} onHome={homeUnit} />
          : <p className="hideout-arrange-hint">위의 ‘아지트 꾸미기’를 누르면 방 그림에서 포털을 끌어 옮길 수 있어요. 포털 자리도 ‘꾸미기 완료’를 누르면 저장돼요.</p>}
      </> : <>
      <div className="hideout-preview-heading"><h4 id={`${categoryId}-title`}>{selectedSlot.label}</h4><span>네 가지 테마</span>
        {!readOnly && editing && HIDEOUT_DEFAULT_LAYOUT[category] == null && <button type="button" className="hideout-clear-slot" onClick={clearSlot}
          disabled={saving || shownRoom.layout[category] == null}>이 자리 비우기</button>}
      </div>
      {!readOnly && editing && <ArrangeTools category={category} unit={categoryUnit && categoryProp ? categoryUnit : null} itemId={shownRoom.layout[category]}
        placement={categoryUnit ? hideoutUnitPlacement(shownRoom.arrange, categoryUnit) : null} moved={!!categoryUnit && Object.hasOwn(shownRoom.arrange, categoryUnit)}
        ledge={ledge} onLedge={setLedge} label={categoryUnit ? unitLabel(categoryUnit) : ""} busy={saving}
        onFlip={flipUnit} onTurn={turnUnit} onHome={homeUnit} onPlace={placeOn} />}
      <div className="hideout-choices">{choices.map((item) => {
        const chosen = shownRoom.layout[item.slot] === item.id;
        const unlocked = isHideoutItemUnlocked(item, eligibility);
        return <button type="button" key={item.id} data-hideout-item={item.id} className={`hideout-choice${chosen ? " is-chosen" : ""}${!unlocked ? " is-locked" : ""}`}
          aria-haspopup="dialog" aria-label={`${unlocked ? `${item.name} 크게 보기` : `${themeName(item)} ${selectedSlot.label} · 레벨 ${unlockLevel(item)}에 열리는 소품`}${chosen ? " · 현재 배치" : ""}`} onClick={() => showDetail(item)} disabled={saving}>
          {unlocked ? <img src={item.src} alt="" width={80} height={64} loading="lazy" draggable={false} /> : <span className="hideout-mystery" aria-hidden="true">?</span>}
          <strong>{unlocked ? item.name : "미공개 소품"}</strong><span>{themeName(item)}</span>
          <small>{chosen ? "현재 배치" : teacherOwn ? "사용 가능" : unlockLevel(item) ? `레벨 ${unlockLevel(item)}` : "기본 소품"}</small>
        </button>;
      })}</div>
      </>}
      </div>
    </section>
    </div>

    {detail && <ItemDetail item={detail} unlocked={isHideoutItemUnlocked(detail, eligibility)} teacherOwn={teacherOwn} readOnly={readOnly} saving={saving} selected={shownRoom.layout[detail.slot] === detail.id}
      categoryLabel={selectedSlot.label} position={detailIndex + 1} count={detailChoices.length} onBrowse={browseDetail}
      onClose={() => setDetail(null)} onApply={() => applyItem(detail)} />}
    {exitPending && <HideoutDialog title="꾸미던 아지트를 저장할까요?" onClose={() => { if (!saving) setExitPending(null); }} busy={saving} alert>
      <p>고른 소품을 저장하고 {exitPending === "plaza" ? "책 광장으로" : returnTo} 돌아갈 수 있어요.</p><div className="hideout-dialog-actions">
        <button type="button" onClick={() => setExitPending(null)} disabled={saving}>계속 꾸미기</button>
        <button type="button" onClick={() => { const dest = exitPending; draftSnapshot.current = null; keepDraft(draftKey, null); setExitPending(null); leaveTo(dest); }} disabled={saving}>저장하지 않고 돌아가기</button>
        <button type="button" className="hideout-primary" onClick={() => finish(exitPending)} disabled={saving}>{saving ? "저장 중…" : `저장하고 ${exitPending === "plaza" ? "책 광장으로" : returnTo}`}</button>
      </div>
    </HideoutDialog>}
    {/* 펫 정보 창 — 방석의 펫을 누르면. 내 방이면 '나의 펫'(먹이 단추까지), 선생님이 학생의 방을 보면 그 학생의 펫을 읽기만 */}
    {petOpen && pet && <PetInfoModal classId={classId} own={!readOnly} actions={!readOnly} owner={myName} progress={pet}
      care={petFeed?.on ? careStatus(petMirror, petFeed, kstToday(), pet.stage) : null} read={petFeed?.read} fruits={fruits}
      onClose={() => { setPetOpen(false); if (!readOnly) focusStage(); }} />}
    {resetPending && <HideoutDialog title="기본 소품으로 바꿀까요?" onClose={() => setResetPending(false)} alert>
      <p>기본 가구를 놓고 추가 소품은 치워요. 옮긴 자리와 방향도 처음으로 돌아가요(포털도 제자리로). 열린 소품은 다시 고를 수 있어요.</p><div className="hideout-dialog-actions">
        <button type="button" onClick={() => setResetPending(false)}>계속 꾸미기</button><button type="button" className="hideout-primary" onClick={() => { setDraft({ ...HIDEOUT_DEFAULT_LAYOUT }); setArrange({}); setResetPending(false); setNotice("기본 소품을 놓았어요. ‘꾸미기 완료’를 누르면 저장돼요."); }}>기본 소품 놓기</button>
      </div>
    </HideoutDialog>}
  </section>;
}

// 돌리기 단추의 말 — 돌린 모습의 종류마다(lib/readingHideoutTurn.js의 look) [돌리기 전, 돌린 뒤]
const TURN_LABELS = { side: ["옆모습으로 돌리기", "앞모습으로 돌리기"], "chair-front": ["의자를 앞으로", "의자를 옆으로"], lengthwise: ["세로로 놓기", "가로로 놓기"] };
// 꾸미기 패널 — 고른 종류의 자리 · 방향(아지트 2단계). 같은 크기의 단추들(좌우 뒤집기 · 돌리기 · 제자리로)과 한 줄 안내.
// 따로 옮기지 않는 소품(창가 장식)은 안내만 섭니다. 작은 소품(책 받침대 · 북엔드 · 오르골 · 무드등 · 트로피 · 화분 · 테라리움 ·
// 펫 장난감 바구니 · 여행 가방)에는 '놓을 곳'(바닥 · 책상 위 · 책장 위 · 작은 벽 선반 · 아래 진열 선반 — 같은 크기)이 위에 섭니다.
function ArrangeTools({ category, unit, itemId, placement, moved, ledge, onLedge, label, busy, onFlip, onTurn, onHome, onPlace }) {
  // 포털 — 자리만 옮깁니다(뒤집기 · 돌리기 없음). 놓이는 곳: 바닥의 빈 곳 · 캐릭터가 들어오는 방 가운데와 떨어진 곳(lib/readingHideoutArrange.js)
  if (unit === HIDEOUT_PORTAL_UNIT) return <div className="hideout-arrange" role="group" aria-label="포털의 자리">
    <div className="hideout-arrange-tools" style={{ "--tools": 1 }}><button type="button" onClick={() => onHome(unit)} disabled={busy || !moved}>제자리로</button></div>
    <p className="hideout-arrange-hint">방 그림에서 포털을 끌어 옮기거나, 방 그림을 누른 뒤 방향키로 한 칸씩(Shift는 네 칸) 옮겨요. 바닥의 빈 곳에만 놓이고, 캐릭터가 들어오는 방 가운데와는 조금 떨어져야 해요.</p>
  </div>;
  if (!itemId) return null;
  if (!unit) return FOLLOW_NOTES[category] ? <p className="hideout-arrange-hint">{FOLLOW_NOTES[category]}</p> : null;
  const turn = hideoutTurnArt(itemId);
  const labels = turn ? TURN_LABELS[turn.look] ?? TURN_LABELS.side : null;
  const buttons = [
    hideoutUnitFlips(unit) && <button type="button" key="flip" aria-pressed={placement.flip} onClick={() => onFlip(unit)} disabled={busy}>좌우 뒤집기</button>,
    labels && <button type="button" key="turn" aria-pressed={placement.turn} onClick={() => onTurn(unit)} disabled={busy}>{labels[placement.turn ? 1 : 0]}</button>,
    <button type="button" key="home" onClick={() => onHome(unit)} disabled={busy || !moved}>제자리로</button>,
  ].filter(Boolean);
  const targets = hideoutPlaceTargets(unit), here = placement?.on ?? "floor";
  return <div className="hideout-arrange" role="group" aria-label={`${label}의 자리와 방향`}>
    {category === "wall-shelf" && <div className="hideout-arrange-tools" role="group" aria-label="옮길 선반" style={{ "--tools": 2 }}>
      {["ledge-left", "ledge-right"].map((side) => <button type="button" key={side} aria-pressed={ledge === side} className={ledge === side ? "is-selected" : ""}
        onClick={() => onLedge(side)} disabled={busy}>{side === "ledge-left" ? "작은 벽 선반" : "아래 진열 선반"}</button>)}
    </div>}
    {targets.length > 0 && <div className="hideout-place" role="group" aria-label={`${label}을 놓을 곳`}>
      <span className="hideout-place-label" aria-hidden="true">놓을 곳</span>
      <div className="hideout-arrange-tools hideout-place-tools">
        {targets.map((target) => <button type="button" key={target} data-place={target} aria-pressed={here === target} className={here === target ? "is-selected" : ""}
          onClick={() => onPlace(unit, target)} disabled={busy} title={placeLabel(target)}>{placeLabel(target)}</button>)}
      </div>
    </div>}
    <div className="hideout-arrange-tools" style={{ "--tools": buttons.length }}>{buttons}</div>
    <p className="hideout-arrange-hint">{targets.length === 0
      ? `${BEARER_NOTES[category] ?? ""}방 그림에서 끌어 옮기거나, 방 그림을 누른 뒤 방향키로 한 칸씩(Shift는 네 칸) 옮겨요.`
      : here === "floor"
        ? "방 그림에서 끌어 옮기거나, 책상 · 책장 · 선반의 윗면 가까이 끌어 그 위에 올려요(위의 ‘놓을 곳’으로도 돼요). 방 그림을 누른 뒤 방향키로 한 칸씩(Shift는 네 칸) 옮겨요."
        : `방 그림에서 끌어 다른 곳으로 옮기거나 위의 ‘놓을 곳’을 골라요. 방향키 ← →는 그 위에서 한 칸씩, ↑ ↓는 위아래의 ${targets.includes("floor") ? "다른 가구 위나 바닥으로" : "다른 가구 위로"} 옮겨요.`}</p>
  </div>;
}

function ItemDetail({ item, unlocked, teacherOwn = false, readOnly, saving, selected, categoryLabel, position, count, onBrowse, onApply, onClose }) {
  const [celebrate, setCelebrate] = useState(false);
  function browse(direction) {
    if (saving || count < 2) return;
    setCelebrate(false); onBrowse(direction);
  }
  return <HideoutDialog title={unlocked ? item.name : "아직 열리지 않은 소품"} onClose={onClose} busy={saving}>
    <p className="hideout-item-tag">{themeName(item)} · {teacherOwn ? "제한 없이 사용 가능" : unlockLevel(item) ? `독서 레벨 ${unlockLevel(item)}` : "기본 소품"}</p>
    <nav className="hideout-detail-nav" aria-label={`${categoryLabel} 소품 둘러보기`}>
      <button type="button" onClick={() => browse(-1)} disabled={saving || count < 2} aria-label={`이전 ${categoryLabel} 보기`}>이전</button>
      <span role="status" aria-live="polite" aria-atomic="true">{categoryLabel} · {position} / {count}</span>
      <button type="button" onClick={() => browse(1)} disabled={saving || count < 2} aria-label={`다음 ${categoryLabel} 보기`}>다음</button>
    </nav>
    {unlocked ? <><img className="hideout-detail-image" src={item.src} alt={item.name} width={360} height={280} />
      <p>{item.description || "좋아하는 테마를 골라 나만의 독서방을 꾸며 보세요."}</p></>
      : <><div className="hideout-detail-mystery" aria-hidden="true">?</div>
        <p className="hideout-locked-note">독서 레벨 {unlockLevel(item)}이 되면 소품의 모습을 확인하고 방에 놓을 수 있어요.</p></>}
    <div className="hideout-dialog-actions">
      {!readOnly && <button type="button" className="hideout-primary" onClick={onApply} disabled={!unlocked || saving}>{selected ? "현재 소품으로 꾸미기" : "방에 놓기"}</button>}
      {unlocked && unlockLevel(item) >= 9 && <button type="button" onClick={() => setCelebrate(true)}>받는 순간 미리 보기</button>}
    </div>
    {unlocked && celebrate && <div className="hideout-reveal" role="status"><img src={item.src} width={130} height={130} alt="" /><strong>{item.name}</strong><span>독서 여행에 새로운 기념이 더해져요.</span></div>}
  </HideoutDialog>;
}

function HideoutDialog({ title, onClose, busy = false, alert = false, children }) {
  const ref = useRef(null), titleId = useId();
  const closeRef = useRef(onClose), busyRef = useRef(busy);
  closeRef.current = onClose; busyRef.current = busy;
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    if (!dialog) return undefined;
    dialog.showModal();
    dialog.querySelector("button:not([disabled])")?.focus();
    return () => { dialog.close(); if (previous?.isConnected && !hasModalAbove(previous)) previous.focus?.(); };
  }, []);
  function keys(e) {
    if (e.key !== "Tab") return;
    const controls = [...ref.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length);
    if (!controls.length) { e.preventDefault(); ref.current.focus(); return; }
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    if (e.shiftKey && (active === first || !ref.current.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !ref.current.contains(active))) { e.preventDefault(); first.focus(); }
  }
  return <dialog className="hideout-dialog" ref={ref} aria-labelledby={titleId} role={alert ? "alertdialog" : "dialog"} onKeyDown={keys}
    onCancel={(e) => { e.preventDefault(); if (!busyRef.current) closeRef.current(); }}
    onMouseDown={(e) => { if (e.target === e.currentTarget) e.currentTarget.dataset.downSelf = "1"; else delete e.currentTarget.dataset.downSelf; }}
    onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downSelf === "1" && !busyRef.current) { delete e.currentTarget.dataset.downSelf; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeRef.current(); } }}>
    <div className="hideout-dialog-heading"><h3 id={titleId}>{title}</h3><button type="button" onClick={onClose} disabled={busy} aria-label="상세 닫기">닫기</button></div>{children}
  </dialog>;
}

// 방석에서 쉬는 펫 — 누르면 펫 정보 창(onOpen · 선생님 요청). 단추라 바닥을 누른 것으로 읽히지 않습니다(useMovement의 onClick이
// 단추를 비켜 감) · owner — 선생님이 학생의 방을 볼 때 그 학생의 이름(읽어 주는 이름에 씀).
function RestingPet({ pet, bed, owner = "", passive = false, onOpen }) {
  const rest = getHideoutRestPet(pet), egg = pet.hatched !== true || pet.stage === 1;
  const [missing, setMissing] = useState(null);
  const placement = egg ? hideoutEggRestPosition(bed, bed.itemId || bed.id) : hideoutPetRestPosition(bed, bed.itemId || bed.id, rest?.contentBox);
  if (!placement) return null;
  const whose = owner ? `${owner}의 ` : "";
  return <button type="button" className={`hideout-pet${egg ? " hideout-pet--egg" : " hideout-pet--resting"}${passive ? " is-passive" : ""}`} tabIndex={passive ? -1 : undefined} data-pet-pose={egg ? "egg" : "rest"} data-resting-pet={egg ? undefined : rest?.species}
    style={{ ...place(placement.x, placement.y, placement.width), aspectRatio: "1", zIndex: 102 + bed.y }} onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
    aria-label={egg ? `창가 방석에서 쉬는 ${whose}신비한 알 — 펫 정보 보기` : `창가 방석에 앉아 쉬는 ${whose}펫 — 펫 정보 보기`} title="펫 정보 보기">
    {egg ? <PetFigure species={null} stage={1} ready={false} size={placement.width} pixelEgg /> : rest && missing !== rest.src ? <img src={rest.src} alt="" width={rest.cell || 96} height={rest.cell || 96} draggable={false} onError={() => setMissing(rest.src)} />
      : <PetFigure species={pet.species} stage={pet.stage} ready={false} size={placement.width} />}
  </button>;
}

// Position is a ref and animation is painted into the existing plaza sprite. No
// position, direction, frame, or portal movement is ever written to Firebase.
// gate — 돌아가는 포털(학생이 옮긴 자리 · lib/readingHideoutMap.js의 hideoutReturnPortal). 발이 그 타원에 들어서면 onPortal.
function useMovement({ enabled, map, gate, spriteRef, onPortal }) {
  const stageRef = useRef(null), avatarRef = useRef(null);
  const position = useRef({ ...map.spawn });
  const [marker, setMarker] = useState(null);
  const enabledRef = useRef(enabled), mapRef = useRef(map), portalRef = useRef(onPortal), gateRef = useRef(gate);
  enabledRef.current = enabled; mapRef.current = map; portalRef.current = onPortal; gateRef.current = gate;
  const path = useRef([]), held = useRef(new Set()), blocked = useRef(new Set());
  const pointer = useRef(null), dragged = useRef(false), raf = useRef(0), previous = useRef(0);
  const distance = useRef(0), facing = useRef("down"), tickRef = useRef(null), armed = useRef(false), portalBusy = useRef(false);
  // 포털이 옮겨 가면(꾸미기를 마치거나 거둠) 다시 무장합니다 — 옮긴 포털이 캐릭터 발밑이어도 곧바로 건너가지 않고,
  // 한 번 벗어났다가 다시 들어서야 건너갑니다(꾸미기를 마치고 처음 누른 방향키에 방을 나가 버리지 않게).
  useEffect(() => { armed.current = false; portalBusy.current = false; }, [gate.x, gate.y]);
  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0; previous.current = 0; path.current = [];
    for (const code of held.current) blocked.current.add(code);
    held.current.clear(); setMarker(null); spriteRef.current?.show(facing.current, 0);
  }, [spriteRef]);
  const draw = useCallback(() => {
    if (!avatarRef.current) return;
    const point = position.current;
    avatarRef.current.style.left = `${point.x / HIDEOUT_SCENE.width * 100}%`;
    avatarRef.current.style.top = `${point.y / HIDEOUT_SCENE.height * 100}%`;
    avatarRef.current.style.zIndex = String(100 + Math.round(point.y));
  }, []);
  const tick = useCallback((time) => {
    if (!enabledRef.current || document.hidden || hasModalAbove(stageRef.current)) { stop(); return; }
    const dt = Math.min(.05, Math.max(0, (time - (previous.current || time)) / 1000)); previous.current = time;
    const dirs = new Set([...held.current].map((code) => WALK_KEYS[code]));
    const dx = Number(dirs.has("right")) - Number(dirs.has("left")), dy = Number(dirs.has("down")) - Number(dirs.has("up"));
    const before = position.current;
    if (dx || dy) {
      path.current = [];
      const length = Math.hypot(dx, dy);
      position.current = mapRef.current.step(before, dx / length * PLAZA_WALK_SPEED * dt, dy / length * PLAZA_WALK_SPEED * dt);
    } else if (path.current.length) {
      const target = path.current[0], length = Math.hypot(target.x - before.x, target.y - before.y), amount = PLAZA_WALK_SPEED * dt;
      if (length <= amount) { position.current = { ...target }; path.current.shift(); }
      else position.current = { x: before.x + (target.x - before.x) / length * amount, y: before.y + (target.y - before.y) / length * amount };
    }
    const movedX = position.current.x - before.x, movedY = position.current.y - before.y, moved = Math.hypot(movedX, movedY), walking = moved > .001;
    if (walking) { facing.current = plazaFacing(facing.current, movedX, movedY); distance.current += moved; }
    spriteRef.current?.show(facing.current, walking ? plazaWalkFrame(distance.current) : 0); draw();
    if (!hideoutAtReturnPortal(position.current, 15, gateRef.current)) { armed.current = true; portalBusy.current = false; }
    if (armed.current && !portalBusy.current && hideoutAtReturnPortal(position.current, 0, gateRef.current)) {
      portalBusy.current = true; armed.current = false; stop(); portalRef.current?.(); return;
    }
    if (walking || dx || dy || path.current.length) raf.current = requestAnimationFrame(tickRef.current);
    else { raf.current = 0; previous.current = 0; setMarker(null); }
  }, [draw, spriteRef, stop]);
  tickRef.current = tick;
  const wake = useCallback(() => { if (!raf.current) { previous.current = 0; raf.current = requestAnimationFrame(tickRef.current); } }, []);
  useEffect(() => {
    if (!enabled) stop();
    if (!map.walkable(position.current.x, position.current.y)) position.current = map.nearest(position.current.x, position.current.y);
    draw();
  }, [map, enabled, draw, stop]);
  const focusStage = useCallback(() => { stageRef.current?.focus({ preventScroll: true }); }, []);
  // 방향키 하나를 누름 — 걸을 수 있을 때만. 처리했으면 참.
  const pressRef = useRef(null);
  pressRef.current = (e) => {
    if (!enabledRef.current || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || hasModalAbove(stageRef.current)) return false;
    if (e.code === "Escape") { e.preventDefault(); stop(); return true; }
    if (!WALK_KEYS[e.code]) return false;
    e.preventDefault();   // 방향키가 페이지를 굴리지 않게
    if (blocked.current.has(e.code) && e.repeat) return true;
    blocked.current.delete(e.code); held.current.add(e.code); setMarker(null); wake();
    return true;
  };
  // 아무 칸에도 초점이 없을 때(본문) 누른 방향키도 걷기로 받고 무대에 초점을 옮깁니다 — 들어오는 길에 초점이 무대에
  // 닿지 못했거나, 누르던 단추가 사라지며 초점이 본문으로 떨어진 때. 다른 칸(소품 종류 고르기 · 단추)에 초점이 있으면
  // 그 칸의 키라 건드리지 않습니다. 무대에 초점이 있으면 무대의 onKeyDown이 받습니다(여기서는 넘어감).
  useEffect(() => {
    const loose = (e) => {
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      if (e.defaultPrevented || !WALK_KEYS[e.code] || !stageRef.current || !enabledRef.current) return;
      if (pressRef.current?.(e)) stageRef.current.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", loose);
    return () => window.removeEventListener("keydown", loose);
  }, []);
  useEffect(() => {
    const heldSet = held.current;
    const release = (e) => { held.current.delete(e.code); blocked.current.delete(e.code); };
    const hidden = () => { if (document.hidden) stop(); };
    window.addEventListener("keyup", release); window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("keyup", release); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", hidden); if (raf.current) cancelAnimationFrame(raf.current); heldSet.clear(); };
  }, [stop]);
  function onClick(e) {
    if (!enabledRef.current || dragged.current || e.target.closest?.("button") || hasModalAbove(stageRef.current)) { dragged.current = false; return; }
    const r = stageRef.current.getBoundingClientRect();
    const target = { x: (e.clientX - r.left) / r.width * HIDEOUT_SCENE.width, y: (e.clientY - r.top) / r.height * HIDEOUT_SCENE.height };
    walkTo(target);
  }
  function walkTo(target) {
    if (!enabledRef.current) return;
    const route = mapRef.current.path(position.current, target);
    if (!route.length) return;
    stageRef.current.focus({ preventScroll: true }); path.current = route; setMarker(route.at(-1)); wake();
  }
  function onKeyDown(e) {
    if (e.target === e.currentTarget) pressRef.current?.(e);
  }
  return { stageRef, avatarRef, position, marker, stop, walkTo, focusStage, onClick, onKeyDown,
    onPointerDown(e) { if (e.button !== 0 || e.target.closest?.("button")) return; pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; dragged.current = false; stop(); },
    onPointerMove(e) { if (pointer.current?.id === e.pointerId && Math.hypot(e.clientX - pointer.current.x, e.clientY - pointer.current.y) > 8) dragged.current = true; },
    onPointerUp() { pointer.current = null; }, onPointerCancel() { pointer.current = null; dragged.current = true; },
  };
}
