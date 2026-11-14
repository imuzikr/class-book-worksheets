"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  HIDEOUT_DEFAULT_LAYOUT, HIDEOUT_ITEMS, HIDEOUT_OCCUPANTS, HIDEOUT_SCENE, HIDEOUT_SLOTS,
  hideoutSceneProps, isHideoutItemUnlocked, normalizeHideoutRoom,
} from "@/lib/readingHideout";
import {
  HIDEOUT_RETURN_PORTAL, createHideoutWalkMap, hideoutAtReturnPortal,
} from "@/lib/readingHideoutMap";
import { getHideoutRestPet, hideoutEggRestPosition, hideoutPetRestPosition } from "@/lib/readingHideoutPets";
import { fetchReadingHideout, saveReadingHideout } from "@/lib/data/readingHideout";
import { subscribeMyReadingCharacter, subscribeMyReadingPet } from "@/lib/data/reading";
import { characterImage, characterName, characterOf } from "@/lib/readingCharacterCatalog";
import { petGrowthOfSummary, petProgress } from "@/lib/readingPet";
import { PLAZA_WALK_SPEED, SPRITE_CELL, SPRITE_FOOT, plazaCharacterSheet, plazaFacing, plazaWalkFrame } from "@/lib/readingPlazaSprites";
import { hasModalAbove } from "@/lib/modal";
import PetFigure from "./PetFigure";
import PlazaSprite from "./PlazaSprite";
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
const place = (x, y, width) => ({ left: `${x / HIDEOUT_SCENE.width * 100}%`, top: `${y / HIDEOUT_SCENE.height * 100}%`, width: `${width / HIDEOUT_SCENE.width * 100}%` });
const disabledError = (error) => /disabled|reading-off/.test(String(error?.code || ""));
const themeName = (item) => ({ forest: "숲속", starlight: "별빛", explorer: "탐험", coastal: "바닷가" }[item.theme] || "기본");
const unlockLevel = (item) => item.unlock?.level || item.unlockStage || item.sampleUnlockStage || 0;
const WALK_KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };

// Identity is the editor's lifetime: requests and drafts from a previous student
// must not appear after a teacher changes students or classes.
export default function ReadingHideout(props) {
  const uid = props.student?.uid || props.user?.uid || "";
  const readOnly = !!props.readOnly || !!props.student?.uid;
  return <HideoutRoom key={`${props.classId || ""}:${uid}:${readOnly ? "view" : "own"}`} {...props} viewUid={uid} readOnly={readOnly} />;
}

function HideoutRoom({ classId, user, student = null, viewUid, summary, readOnly, characterOn = true, petOn = false, onDisabled, onExit }) {
  const [room, setRoom] = useState(null);
  const [draft, setDraft] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState("rug");
  const [detail, setDetail] = useState(null);
  const [exitPending, setExitPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [character, setCharacter] = useState(null);
  const [petMirror, setPetMirror] = useState(null);
  const [spriteMissing, setSpriteMissing] = useState(false);
  const [sceneWidth, setSceneWidth] = useState(0);
  const alive = useRef(true);
  const saveLock = useRef(false);
  const disabledRef = useRef(onDisabled);
  const exitRef = useRef(onExit);
  const requestExitRef = useRef(null);
  const spriteRef = useRef(null);
  disabledRef.current = onDisabled;
  exitRef.current = onExit;
  const categoryId = useId();
  const draftKey = `${classId || ""}:${viewUid}`;
  const draftSnapshot = useRef(undefined);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setRoom(null); setDraft(null); setProgress(null); setError(""); setNotice(""); setEditing(false); setDetail(null);
    if (!classId || !viewUid) { setLoading(false); return undefined; }
    fetchReadingHideout(classId, readOnly ? viewUid : null).then((value) => {
      if (!current) return;
      const remembered = !readOnly ? UNSAVED_DRAFTS.get(draftKey) : null;
      const restore = remembered?.revision === value.room.revision;
      const restored = restore ? normalizeHideoutRoom({ ...value.room, layout: remembered.layout }, value.progress) : value.room;
      setRoom(value.room); setDraft(restored.layout); setProgress(value.progress); setLoading(false);
      if (restore && !sameLayout(restored.layout, value.room.layout)) { setEditing(true); setNotice("이 탭에서 꾸미던 모습을 다시 열었어요. 마음에 들면 저장해 주세요."); }
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

  const eligibility = useMemo(() => ({
    level: progress?.level ?? summary?.level ?? 1,
    earnedBadges: progress?.earnedBadgeIds ?? summary?.earnedBadges ?? [],
  }), [summary?.level, summary?.earnedBadges, progress]);
  const savedRoom = useMemo(() => normalizeHideoutRoom(room, eligibility), [room, eligibility]);
  const shownRoom = useMemo(() => normalizeHideoutRoom({ ...room, layout: draft }, eligibility), [room, draft, eligibility]);
  const props = useMemo(() => hideoutSceneProps(shownRoom.layout), [shownRoom.layout]);
  const map = useMemo(() => createHideoutWalkMap(shownRoom.layout), [shownRoom.layout]);
  const dirty = !!room && !sameLayout(savedRoom.layout, shownRoom.layout);
  draftSnapshot.current = room ? (!readOnly && dirty ? { revision: room.revision, layout: { ...shownRoom.layout } } : null) : undefined;
  useEffect(() => () => { if (!readOnly && draftSnapshot.current !== undefined) keepDraft(draftKey, draftSnapshot.current); }, [draftKey, readOnly]);
  const selectedSlot = HIDEOUT_SLOTS.find((slot) => slot.id === category) || HIDEOUT_SLOTS[0];
  const choices = HIDEOUT_ITEMS.filter((item) => item.slot === selectedSlot.id && unlockLevel(item) > 0);
  const baselineChoice = HIDEOUT_ITEMS.find((item) => item.slot === selectedSlot.id && unlockLevel(item) === 0);
  const myName = (readOnly ? student?.realName || student?.name : user?.realName || user?.name || user?.displayName) || "나";
  const appearance = characterOf({ uid: viewUid, character: characterOn ? character : null });
  const spriteSrc = plazaCharacterSheet(appearance);
  const pet = petOn ? petProgress(petMirror, petGrowthOfSummary(summary)) : null;
  const bed = props.find((prop) => prop.category === "bed");
  const movement = useMovement({
    enabled: !!room && !loading && !readOnly && !editing && !saving && !detail && !exitPending && !resetPending,
    map, spriteRef, onPortal: () => requestExitRef.current?.(),
  });

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

  function requestExit() {
    if (saving) return;
    movement.stop();
    if (!readOnly && dirty) setExitPending(true);
    else exitRef.current?.();
  }
  requestExitRef.current = requestExit;

  function showDetail(item) {
    movement.stop(); setDetail(item); setNotice("");
  }
  function applyItem(item) {
    if (readOnly || saving || !isHideoutItemUnlocked(item, eligibility)) return;
    setDraft({ ...shownRoom.layout, [item.slot]: item.id }); setEditing(true); setDetail(null); setNotice(`${item.name}을 놓았어요. 꾸미기를 마치면 저장돼요.`);
  }
  function clearSlot() {
    if (readOnly || saving || HIDEOUT_DEFAULT_LAYOUT[category] != null) return;
    setDraft({ ...shownRoom.layout, [category]: null }); setEditing(true); setNotice("");
  }
  function cancelEditing() {
    if (saving) return;
    setDraft(savedRoom.layout); setEditing(false); setError(""); setNotice("저장된 모습으로 돌아왔어요.");
  }

  async function finish(leave = false) {
    if (readOnly || saveLock.current || !room) return false;
    if (!dirty) {
      setEditing(false); setExitPending(false);
      if (leave) exitRef.current?.(); else setNotice("꾸미기를 마쳤어요.");
      return true;
    }
    saveLock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const result = await saveReadingHideout(classId, { version: 2, layout: shownRoom.layout, revision: room.revision });
      if (!alive.current) return false;
      setRoom(result.room); setDraft(result.room.layout); setProgress(result.progress); setEditing(false); setExitPending(false);
      draftSnapshot.current = null;
      keepDraft(draftKey, null);
      if (leave) exitRef.current?.(); else setNotice("아지트를 저장했어요.");
      return true;
    } catch (e) {
      if (!alive.current) return false;
      const conflict = e?.status === 409 || /conflict|revision|stale/.test(String(e?.code || ""));
      setError(conflict ? "다른 창에서 아지트가 바뀌었어요. 저장된 모습을 다시 불러온 뒤 꾸며 주세요." : e?.message || "저장하지 못했어요. 고른 소품은 그대로 있으니 다시 시도해 주세요.");
      setExitPending(false);
      if (disabledError(e)) disabledRef.current?.();
      return false;
    } finally {
      saveLock.current = false;
      if (alive.current) setSaving(false);
    }
  }

  if (loading) return <div className="reading-loading" role="status"><span className="reading-loader" />나만의 아지트를 열고 있어요.</div>;
  if (!room) return <section className="hideout hideout-empty" aria-label="나의 아지트">
    <p role="alert">{error || "학생과 반을 먼저 선택해 주세요."}</p>
    <div className="hideout-actions"><button type="button" onClick={() => setReload((value) => value + 1)}>다시 불러오기</button>{onExit && <button type="button" onClick={onExit}>돌아가기</button>}</div>
  </section>;

  const actorSize = HIDEOUT_OCCUPANTS.character.width * sceneWidth / HIDEOUT_SCENE.width;
  const portal = HIDEOUT_RETURN_PORTAL;
  return <section className={`hideout${editing ? " is-editing" : ""}`} aria-label={`${myName}의 아지트`} aria-busy={saving}>
    <header className="hideout-heading">
      <div><p className="hideout-eyebrow">이야기가 머무는 작은 방</p><h2>{readOnly ? `${myName}의 아지트` : "나의 아지트"}</h2></div>
      <div className="hideout-actions">
        <span className="hideout-level">독서 레벨 <strong>{eligibility.level}</strong></span>
        {!readOnly && !editing && <button type="button" className="hideout-primary" onClick={() => { movement.stop(); setEditing(true); setNotice(""); }}>아지트 꾸미기</button>}
        {onExit && <button type="button" onClick={requestExit} disabled={saving}>{readOnly ? "학생 서재로" : "교실로 돌아가기"}</button>}
      </div>
    </header>
    {error && <div className="hideout-error" role="alert"><p>{error}</p><button type="button" disabled={saving} onClick={() => { movement.stop(); keepDraft(draftKey, null); draftSnapshot.current = null; setReload((value) => value + 1); }}>저장된 모습 다시 불러오기</button></div>}
    <p className="hideout-status" role="status" aria-live="polite">{notice}</p>
    <div className="hideout-scene" ref={movement.stageRef} style={{ "--hideout-unit": `${sceneWidth / HIDEOUT_SCENE.width}px` }} tabIndex={readOnly || editing ? -1 : 0} role="group" aria-label="아지트 이동 공간"
      onClick={movement.onClick} onKeyDown={movement.onKeyDown} onBlur={movement.stop}
      onPointerDown={movement.onPointerDown} onPointerMove={movement.onPointerMove} onPointerUp={movement.onPointerUp} onPointerCancel={movement.onPointerCancel}>
      <img className="hideout-background" src={HIDEOUT_SCENE.background} width={HIDEOUT_SCENE.width} height={HIDEOUT_SCENE.height} alt="창가와 나무 바닥이 있는 아늑한 독서방" draggable={false} />
      {props.map((prop) => <img key={prop.id} src={prop.src} className={`hideout-prop${prop.contactShadow ? " is-grounded" : ""}`}
        data-hideout-slot={prop.category || prop.slot} data-hideout-item={prop.itemId || prop.id} alt="" draggable={false}
        style={{ ...place(prop.x, prop.y, prop.width), zIndex: prop.z }} />)}
      {props.filter((prop) => prop.category === "door-plaque").map((prop) => <span key={`${prop.id}-label`} className="hideout-plaque-label" style={{ left: `${prop.x / HIDEOUT_SCENE.width * 100}%`, top: `${(prop.y - prop.height * .46) / HIDEOUT_SCENE.height * 100}%` }}>{myName}의 아지트</span>)}
      {onExit && !readOnly && <button type="button" className="hideout-return-portal" style={{ ...place(portal.x, portal.y, portal.width), aspectRatio: `${portal.width}/${portal.height}` }}
        aria-label="포털로 교실 돌아가기" title="포털까지 걸어 교실로 돌아가기" onClick={(e) => { e.stopPropagation(); movement.walkTo({ x: portal.x, y: portal.y }); }} disabled={saving || editing}>
        <img src="/reading-plaza/portal.webp" alt="" draggable={false} /><img className="hideout-portal-swirl" src="/reading-plaza/portal-swirl.webp" alt="" draggable={false} />
        <span>교실로</span>
      </button>}
      {movement.marker && <span className="hideout-walk-marker" aria-hidden="true" style={{ left: `${movement.marker.x / HIDEOUT_SCENE.width * 100}%`, top: `${movement.marker.y / HIDEOUT_SCENE.height * 100}%` }} />}
      <div className="hideout-resident" ref={movement.avatarRef} style={{ left: `${movement.position.current.x / HIDEOUT_SCENE.width * 100}%`, top: `${movement.position.current.y / HIDEOUT_SCENE.height * 100}%`, zIndex: 100 + Math.round(movement.position.current.y) }} role="img" aria-label={`${myName}, ${characterName(appearance)}`}>
        <span className="hideout-resident-shadow" style={{ width: actorSize * .35, height: actorSize * .05 }} />
        {spriteSrc && !spriteMissing ? <PlazaSprite ref={spriteRef} src={spriteSrc} size={actorSize || 1} style={{ position: "absolute", left: -actorSize / 2, top: -actorSize * SPRITE_FOOT.y / SPRITE_CELL }} onMissing={() => setSpriteMissing(true)} />
          : <img className="hideout-character-fallback" src={characterImage(appearance)} alt="" draggable={false} style={{ width: actorSize, height: actorSize, left: -actorSize / 2, top: -actorSize * .92 }} />}
        <span className="hideout-resident-name">{myName}</span>
      </div>
      {pet && bed && <RestingPet pet={pet} bed={bed} />}
    </div>
    <p className="hideout-walk-help">{readOnly ? "학생 본인만 아지트를 꾸밀 수 있어요." : editing ? "이름과 큰 그림으로 소품을 골라 보세요. 마음에 들면 ‘꾸미기 완료’를 눌러요." : "빈 바닥을 누르거나 방향키 · W A S D로 걸어요. 펫은 창가에서 쉬고, 오른쪽 포털로 교실에 돌아가요."}</p>

    <section className="hideout-editor" aria-label="아지트 소품">
      <div className="hideout-editor-heading"><div><h3>{editing ? "오늘은 어떻게 꾸밀까요?" : "독서로 만나는 소품"}</h3><p>종류마다 네 가지 테마를 골라 섞을 수 있어요.</p></div>
        <label htmlFor={categoryId}>소품 종류<select id={categoryId} value={category} onChange={(e) => { movement.stop(); setCategory(e.target.value); }} disabled={saving}>
          {HIDEOUT_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
        </select></label>
      </div>
      {baselineChoice && <button type="button" className={`hideout-baseline-choice${shownRoom.layout[category] === baselineChoice.id ? " is-chosen" : ""}`} disabled={saving}
        aria-label={`${baselineChoice.name} 크게 보기`} onClick={() => showDetail(baselineChoice)}>
        <img src={baselineChoice.src} alt="" width={64} height={56} /><span><strong>{baselineChoice.name}</strong><small>처음부터 사용할 수 있는 기본 소품{shownRoom.layout[category] === baselineChoice.id ? " · 현재 배치" : ""}</small></span><span aria-hidden="true">살펴보기</span>
      </button>}
      <div className="hideout-choices">{choices.map((item) => {
        const chosen = shownRoom.layout[item.slot] === item.id;
        const unlocked = isHideoutItemUnlocked(item, eligibility);
        return <button type="button" key={item.id} className={`hideout-choice${chosen ? " is-chosen" : ""}${!unlocked ? " is-locked" : ""}`}
          aria-label={`${item.name} 크게 보기`} onClick={() => showDetail(item)} disabled={saving}>
          <img src={item.src} alt="" width={180} height={160} loading="lazy" draggable={false} />
          <strong>{item.name}</strong><span>{themeName(item)}{chosen ? " · 현재 배치" : ""}</span>
          <small>{unlocked ? (unlockLevel(item) ? `레벨 ${unlockLevel(item)}부터 사용할 수 있어요` : "처음부터 사용할 수 있어요") : `레벨 ${unlockLevel(item)}에 열려요`}</small>
        </button>;
      })}</div>
      {!readOnly && editing && <div className="hideout-edit-actions">
        <p className="hideout-draft-status">{dirty ? "아직 저장하지 않은 모습이에요." : "저장된 모습과 같아요."}</p>
        <div className="hideout-actions">
          {HIDEOUT_DEFAULT_LAYOUT[category] == null && <button type="button" onClick={clearSlot} disabled={saving || shownRoom.layout[category] == null}>이 자리 비우기</button>}
          <button type="button" onClick={() => setResetPending(true)} disabled={saving}>모든 소품 기본으로</button>
          <button type="button" onClick={cancelEditing} disabled={saving}>꾸미기 취소</button>
          <button type="button" className="hideout-primary" onClick={() => finish()} disabled={saving}>{saving ? "저장 중…" : "꾸미기 완료"}</button>
        </div>
      </div>}
    </section>

    {detail && <ItemDetail item={detail} unlocked={isHideoutItemUnlocked(detail, eligibility)} readOnly={readOnly} saving={saving} selected={shownRoom.layout[detail.slot] === detail.id}
      onClose={() => setDetail(null)} onApply={() => applyItem(detail)} />}
    {exitPending && <HideoutDialog title="꾸미던 아지트를 저장할까요?" onClose={() => { if (!saving) setExitPending(false); }} busy={saving} alert>
      <p>고른 소품을 저장하고 교실로 돌아갈 수 있어요.</p><div className="hideout-dialog-actions">
        <button type="button" onClick={() => setExitPending(false)} disabled={saving}>계속 꾸미기</button>
        <button type="button" onClick={() => { draftSnapshot.current = null; keepDraft(draftKey, null); setExitPending(false); exitRef.current?.(); }} disabled={saving}>저장하지 않고 돌아가기</button>
        <button type="button" className="hideout-primary" onClick={() => finish(true)} disabled={saving}>{saving ? "저장 중…" : "저장하고 교실로"}</button>
      </div>
    </HideoutDialog>}
    {resetPending && <HideoutDialog title="기본 소품으로 바꿀까요?" onClose={() => setResetPending(false)} alert>
      <p>기본 가구를 놓고 추가 소품은 치워요. 열린 소품은 다시 고를 수 있어요.</p><div className="hideout-dialog-actions">
        <button type="button" onClick={() => setResetPending(false)}>계속 꾸미기</button><button type="button" className="hideout-primary" onClick={() => { setDraft({ ...HIDEOUT_DEFAULT_LAYOUT }); setResetPending(false); setNotice("기본 소품을 놓았어요. 꾸미기를 마치면 저장돼요."); }}>기본 소품 놓기</button>
      </div>
    </HideoutDialog>}
  </section>;
}

function ItemDetail({ item, unlocked, readOnly, saving, selected, onApply, onClose }) {
  const [celebrate, setCelebrate] = useState(false);
  return <HideoutDialog title={item.name} onClose={onClose} busy={saving}>
    <p className="hideout-item-tag">{themeName(item)} · {unlockLevel(item) ? `독서 레벨 ${unlockLevel(item)}` : "기본 소품"}</p>
    <img className="hideout-detail-image" src={item.src} alt={item.name} width={360} height={280} />
    <p>{item.description || "좋아하는 테마를 골라 나만의 독서방을 꾸며 보세요."}</p>
    {!unlocked && <p className="hideout-locked-note">독서 레벨 {unlockLevel(item)}이 되면 놓을 수 있어요. 지금은 그림을 미리 살펴보세요.</p>}
    <div className="hideout-dialog-actions">
      {!readOnly && <button type="button" className="hideout-primary" onClick={onApply} disabled={!unlocked || saving}>{selected ? "현재 소품으로 꾸미기" : "방에 놓기"}</button>}
      {unlockLevel(item) >= 9 && <button type="button" onClick={() => setCelebrate(true)}>받는 순간 미리 보기</button>}
    </div>
    {celebrate && <div className="hideout-reveal" role="status"><img src={item.src} width={130} height={130} alt="" /><strong>{item.name}</strong><span>독서 여행에 새로운 기념이 더해져요.</span></div>}
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

function RestingPet({ pet, bed }) {
  const rest = getHideoutRestPet(pet), egg = pet.hatched !== true || pet.stage === 1;
  const [missing, setMissing] = useState(null);
  const placement = egg ? hideoutEggRestPosition(bed, bed.itemId || bed.id) : hideoutPetRestPosition(bed, bed.itemId || bed.id, rest?.contentBox);
  if (!placement) return null;
  return <div className={`hideout-pet${egg ? " hideout-pet--egg" : " hideout-pet--resting"}`} data-pet-pose={egg ? "egg" : "rest"} data-resting-pet={egg ? undefined : rest?.species}
    style={{ ...place(placement.x, placement.y, placement.width), aspectRatio: "1", zIndex: 102 + bed.y }} role="img" aria-label={egg ? "창가 방석에서 쉬는 신비한 알" : "창가 방석에 앉아 쉬는 펫"}>
    {egg ? <PetFigure species={null} stage={1} ready={false} size={placement.width} /> : rest && missing !== rest.src ? <img src={rest.src} alt="" width={rest.cell || 96} height={rest.cell || 96} draggable={false} onError={() => setMissing(rest.src)} />
      : <PetFigure species={pet.species} stage={pet.stage} ready={false} size={placement.width} />}
  </div>;
}

// Position is a ref and animation is painted into the existing plaza sprite. No
// position, direction, frame, or portal movement is ever written to Firebase.
function useMovement({ enabled, map, spriteRef, onPortal }) {
  const stageRef = useRef(null), avatarRef = useRef(null);
  const position = useRef({ ...map.spawn });
  const [marker, setMarker] = useState(null);
  const enabledRef = useRef(enabled), mapRef = useRef(map), portalRef = useRef(onPortal);
  enabledRef.current = enabled; mapRef.current = map; portalRef.current = onPortal;
  const path = useRef([]), held = useRef(new Set()), blocked = useRef(new Set());
  const pointer = useRef(null), dragged = useRef(false), raf = useRef(0), previous = useRef(0);
  const distance = useRef(0), facing = useRef("down"), tickRef = useRef(null), armed = useRef(false), portalBusy = useRef(false);
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
    if (!hideoutAtReturnPortal(position.current, 15)) { armed.current = true; portalBusy.current = false; }
    if (armed.current && !portalBusy.current && hideoutAtReturnPortal(position.current)) {
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
    if (!enabledRef.current || e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || hasModalAbove(stageRef.current)) return;
    if (e.code === "Escape") { e.preventDefault(); stop(); return; }
    if (!WALK_KEYS[e.code]) return;
    e.preventDefault();
    if (blocked.current.has(e.code) && e.repeat) return;
    blocked.current.delete(e.code); held.current.add(e.code); setMarker(null); wake();
  }
  return { stageRef, avatarRef, position, marker, stop, walkTo, onClick, onKeyDown,
    onPointerDown(e) { if (e.button !== 0 || e.target.closest?.("button")) return; pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; dragged.current = false; stop(); },
    onPointerMove(e) { if (pointer.current?.id === e.pointerId && Math.hypot(e.clientX - pointer.current.x, e.clientY - pointer.current.y) > 8) dragged.current = true; },
    onPointerUp() { pointer.current = null; }, onPointerCancel() { pointer.current = null; dragged.current = true; },
  };
}
