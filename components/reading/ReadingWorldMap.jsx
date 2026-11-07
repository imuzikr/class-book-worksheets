"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { READING_BADGES } from "@/lib/reading";
import { journeyTitle } from "@/lib/readingJourney";
import {
  WORLD_MAP, WORLD_CHARACTERS, WORLD_REGIONS, defaultWorldAvatar,
  groupWorldTravelers, worldCheckpoints, worldPoint, worldProgress,
} from "@/lib/readingWorldMap";
import ReadingBadge from "./ReadingBadge";
import "./reading-world-map.css";

const number = (value) => value.toLocaleString("ko-KR");
const characterOf = (row) => ({
  number: Number.isInteger(row?.character?.number) && row.character.number >= 1 && row.character.number <= 10
    ? row.character.number : defaultWorldAvatar(row?.uid || ""),
  style: row?.character?.style === "advanced" ? "advanced" : "intermediate",
});
const characterImage = (character) => `/reading-journey/${character.style}-${String(character.number).padStart(2, "0")}.webp`;
const chapterLabel = (chapter) => `제${chapter}여정 · Lv.${(chapter - 1) * 10 + 1}–${Math.min(chapter * 10 + 1, 100)}`;
const growthOf = (row) => {
  const growth = worldProgress(row?.totalXp);
  return growth?.level === row?.level ? growth : null;
};

/** The map consumes the same public snapshot as the rankings, never a peer's library. */
export default function ReadingWorldMap({ rows, uid, isTeacher, onOpenDetails, onSaveCharacter }) {
  const titleId = useId();
  const viewport = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const [selectedUid, setSelectedUid] = useState(uid);
  const [chapter, setChapter] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [routeVisible, setRouteVisible] = useState(true);
  const [clusterId, setClusterId] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const pendingCenter = useRef(null);
  // 확대 · 축소 — 지금 배율과 맞출 스크롤 자리를 ref로 들고, 그린 직후
  // (useLayoutEffect)에 스크롤을 맞춥니다. 마우스 휠로는 확대하지 않습니다 —
  // 휠은 지도(확대했을 때)와 페이지를 굴립니다(선생님 요청).
  const zoomRef = useRef(1);
  const pendingScroll = useRef(null);

  const initialView = useRef(false);
  const previousGrowth = useRef(null);

  const travelers = useMemo(() => rows.slice().sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || ""), "ko")
    || a.uid.localeCompare(b.uid)).map((row) => ({ ...row, world: growthOf(row) })), [rows]);
  const selected = travelers.find((row) => row.uid === selectedUid)
    || travelers.find((row) => row.uid === uid) || travelers[0];
  const growth = selected?.world;
  const activeChapter = chapter ?? growth?.chapter ?? 1;
  const checkpoints = useMemo(() => worldCheckpoints(activeChapter), [activeChapter]);
  const scale = Math.min(size.width / WORLD_MAP.width, size.height / WORLD_MAP.height) * zoom;
  const canvasWidth = Math.max(size.width, WORLD_MAP.width * scale);
  const canvasHeight = Math.max(size.height, WORLD_MAP.height * scale);
  const offset = { x: (canvasWidth - WORLD_MAP.width * scale) / 2, y: (canvasHeight - WORLD_MAP.height * scale) / 2 };
  // Unfold nearby travelers as the user zooms in. Grouping never changes XP or
  // combines students on distant parts of the winding route.
  const tolerance = Math.min(0.08, 85 / (WORLD_MAP.length * scale));
  const groups = useMemo(() => groupWorldTravelers(travelers.filter((row) => row.world), { chapter: activeChapter, selectedUid: selected?.uid, epsilon: tolerance }), [travelers, activeChapter, selected?.uid, tolerance]);
  const cluster = groups.find((group) => group.id === clusterId);
  const shownCount = groups.reduce((sum, group) => sum + group.members.length, 0);
  const pendingCount = travelers.filter((row) => !row.world).length;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!initialView.current && size.width > 1) {
      initialView.current = true;
      if (size.width < 600 && growth) {
        pendingCenter.current = { progress: growth.progress, zoom: 2 };
        setZoom(2);
      }
    }
  }, [size.width, growth]);

  useEffect(() => {
    const previous = previousGrowth.current;
    if (growth && previous?.uid === selected.uid && previous.chapter !== growth.chapter
      && (chapter === null || chapter === previous.chapter)) {
      pendingCenter.current = { progress: growth.progress, zoom };
      setChapter(growth.chapter);
    }
    previousGrowth.current = growth ? { uid: selected.uid, chapter: growth.chapter } : null;
  }, [growth, selected?.uid, chapter, zoom]);

  useEffect(() => {
    if (pendingCenter.current === null || pendingCenter.current.zoom !== zoom || !viewport.current) return;
    const point = worldPoint(pendingCenter.current.progress);
    pendingCenter.current = null;
    viewport.current.scrollTo({ left: offset.x + point.x * scale - size.width / 2, top: offset.y + point.y * scale - size.height / 2 });
  }, [zoom, activeChapter, scale, size.width, size.height, offset.x, offset.y]);

  function selectTraveler(row, center = false) {
    setSelectedUid(row.uid);
    setClusterId(null);
    const next = growthOf(row);
    if (next) {
      if (center) pendingCenter.current = { progress: next.progress, zoom };
      setChapter(next.chapter);
      if (center && viewport.current && next.chapter === activeChapter) {
        const point = worldPoint(next.progress);
        viewport.current.scrollTo({ left: offset.x + point.x * scale - size.width / 2, top: offset.y + point.y * scale - size.height / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        pendingCenter.current = null;
      }
    }
  }

  // anchor는 지도 칸 안의 한 점(px) — 확대해도 그 점 아래의 지형이 제자리에 남습니다.
  // 단추는 가운데, 휠은 마우스가 있는 자리를 씁니다.
  function zoomTo(next, anchor = null) {
    const current = zoomRef.current;
    const bounded = Math.round(Math.min(4, Math.max(1, next)) * 100) / 100;
    if (bounded === current) return;
    const element = viewport.current;
    if (element) {
      const fit = Math.min(size.width / WORLD_MAP.width, size.height / WORLD_MAP.height);
      const ax = anchor?.x ?? size.width / 2;
      const ay = anchor?.y ?? size.height / 2;
      const from = pendingScroll.current ?? { left: element.scrollLeft, top: element.scrollTop };
      const curScale = fit * current;
      const curX = Math.max(0, size.width - WORLD_MAP.width * curScale) / 2;
      const curY = Math.max(0, size.height - WORLD_MAP.height * curScale) / 2;
      const x = (from.left + ax - curX) / curScale;
      const y = (from.top + ay - curY) / curScale;
      const nextScale = fit * bounded;
      const nextX = Math.max(0, size.width - WORLD_MAP.width * nextScale) / 2;
      const nextY = Math.max(0, size.height - WORLD_MAP.height * nextScale) / 2;
      const maxLeft = Math.max(0, WORLD_MAP.width * nextScale - size.width);
      const maxTop = Math.max(0, WORLD_MAP.height * nextScale - size.height);
      pendingScroll.current = {
        left: Math.min(maxLeft, Math.max(0, nextX + x * nextScale - ax)),
        top: Math.min(maxTop, Math.max(0, nextY + y * nextScale - ay)),
      };
    }
    zoomRef.current = bounded;
    setZoom(bounded);
  }
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const element = viewport.current;
    const target = pendingScroll.current;
    if (!element || !target) return;
    pendingScroll.current = null;
    element.scrollLeft = target.left;
    element.scrollTop = target.top;
  }, [zoom]);


  function startPan(event) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moving: false };
    suppressClick.current = false;
  }

  function movePan(event) {
    const down = pointer.current;
    if (!down || down.id !== event.pointerId) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    if (!down.moving && Math.hypot(dx, dy) > 5) {
      down.moving = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (down.moving) {
      event.preventDefault();
      event.currentTarget.scrollLeft = down.left - dx;
      event.currentTarget.scrollTop = down.top - dy;
    }
  }

  return <section className="rwm" aria-labelledby={titleId}>
    <div className="rwm-heading">
      <div><span className="rwm-eyebrow">BOOKBOM · READING ODYSSEY</span><h3 id={titleId}>한 장씩, 더 넓은 세상으로</h3><p>숲에서 폭풍 너머까지, 우리 반의 독서 여정</p></div>
      <span className="rwm-basis">개인 누적 성장 기준</span>
    </div>

    {selected && <div className="rwm-hud" aria-label="선택한 학생의 성장 정보">
      <div className="rwm-portrait"><img src={characterImage(characterOf(selected))} alt="" width={110} height={110} /></div>
      <div className="rwm-identity"><span>선택한 여행자 {selected.uid === uid && <b>나</b>}</span><strong data-testid="journey-selected-name">{selected.name || "이름 미설정"}</strong><small>{selected.studentId || "학번 미설정"} · {growth ? journeyTitle(growth.level) : "성장 정보 확인 중"}</small></div>
      <div className="rwm-growth">
        <div className="rwm-growth-values"><span><small>독서 레벨</small><strong data-testid="journey-selected-level">{growth ? `Lv.${growth.level}` : "—"}</strong></span><span><small>누적 경험치</small><strong data-testid="journey-selected-xp">{growth ? number(growth.xp) : "—"}<em> EXP</em></strong></span></div>
        {growth ? <><div className="rwm-exp-bar" role="progressbar" aria-label="현재 레벨 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={growth.percent}><span style={{ width: `${growth.percent}%` }} /></div><p>{growth.complete ? "모든 여정을 완주했어요" : <>다음 레벨까지 <b>{number(growth.toNext)} EXP</b><span>{growth.percent}%</span></>}</p></> : <p>집계가 완료되면 위치가 표시돼요.</p>}
      </div>
      <div className="rwm-hud-badges">
        <span>모은 뱃지</span><div>{READING_BADGES.filter((badge) => selected.badges?.includes(badge.id)).slice(-3).map((badge) => <span key={badge.id} title={badge.label}><ReadingBadge badge={badge} size={30} /></span>)}<strong>{Array.isArray(selected.badges) ? `${selected.badges.length}개` : "—"}</strong></div>
        <button type="button" onClick={() => onOpenDetails?.(selected)}>성장 기록·뱃지 보기 <span aria-hidden="true">↗</span></button>
      </div>
    </div>}

    <div className="rwm-toolbar">
      <label className="rwm-chapter"><span>여정 지도</span><select aria-label="여정 지도" value={activeChapter} onChange={(event) => { setChapter(Number(event.target.value)); setClusterId(null); setZoom(1); }}>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>{chapterLabel(value)}</option>)}
      </select></label>
      <span className="rwm-count">이 지도 <b>{shownCount}</b>명 / 전체 {travelers.length}명{pendingCount > 0 && ` · 집계 대기 ${pendingCount}명`}</span>
      <div className="rwm-map-actions">
        {!isTeacher && selected?.uid === uid && onSaveCharacter && <button type="button" onClick={() => setChoosing(true)}>캐릭터 꾸미기</button>}
        {selected && <button type="button" onClick={() => selectTraveler(selected, true)} disabled={!growth}>선택 학생 위치</button>}
        <button type="button" aria-pressed={routeVisible} onClick={() => setRouteVisible((value) => !value)}>길 표시</button>
      </div>
    </div>

    {cluster && cluster.members.length > 1 && <div className="rwm-cluster" role="group" aria-label="같은 구간의 학생 선택"><span>함께 걷는 {cluster.members.length}명</span>{cluster.members.map((row) => <button key={row.uid} type="button" onClick={() => selectTraveler(row)} aria-pressed={selected?.uid === row.uid}>{row.name} <small>{number(row.totalXp)} EXP</small></button>)}<button className="rwm-cluster-close" type="button" onClick={() => setClusterId(null)} aria-label="학생 선택 닫기">×</button></div>}

    <div className="rwm-layout">
      <div className="rwm-map-panel">
        <div ref={viewport} className="rwm-viewport" tabIndex={0} aria-label="독서 여정 지도. 확대 후 드래그하거나 방향키로 지도를 이동하세요." onPointerDown={startPan} onPointerMove={movePan} onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
          <div className="rwm-canvas" style={{ width: canvasWidth, height: canvasHeight }}>
            <div className="rwm-terrain" style={{ left: offset.x, top: offset.y, width: WORLD_MAP.width * scale, height: WORLD_MAP.height * scale }}>
              <img className="rwm-background" src="/reading-journey/map.webp" alt="울창한 숲에서 사막과 급류 계곡, 설산과 폭풍 해안으로 이어지는 독서 여정 지도" width={WORLD_MAP.width} height={WORLD_MAP.height} draggable={false} onError={() => setImageError(true)} />
              {routeVisible && <svg className="rwm-route" viewBox={`0 0 ${WORLD_MAP.width} ${WORLD_MAP.height}`} aria-hidden="true"><path d={WORLD_MAP.path} /></svg>}
            </div>
            {checkpoints.map((stop) => <span key={stop.level} className="rwm-checkpoint" style={{ left: offset.x + stop.x * scale, top: offset.y + stop.y * scale }} title={`${number(stop.xp)} EXP`}><span>Lv.{stop.level}</span></span>)}
            {groups.map((group) => <TravelerToken key={group.id} group={group} selectedUid={selected?.uid} scale={scale} offset={offset} chapter={activeChapter} onClick={() => {
              const row = group.representative;
              selectTraveler(row);
              if (group.members.length > 1) setClusterId(group.id);
            }} />)}
          </div>
        </div>
        {imageError && <p className="rwm-map-message" role="alert">지도 이미지를 불러오지 못했어요. 오른쪽 학생 목록에서 성장 기록을 확인할 수 있어요.</p>}
        {!shownCount && !imageError && <p className="rwm-map-message">이 여정에 있는 학생은 아직 없어요. 학생 목록에서 친구의 현재 여정으로 이동해 보세요.</p>}
        <div className="rwm-zoom" role="group" aria-label="지도 크기 조절"><button type="button" onClick={() => zoomTo(zoom - 0.5)} disabled={zoom <= 1} aria-label="지도 축소">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => zoomTo(zoom + 0.5)} disabled={zoom >= 4} aria-label="지도 확대">+</button><button type="button" onClick={() => { zoomRef.current = 1; pendingScroll.current = null; setZoom(1); viewport.current?.scrollTo({ left: 0, top: 0 }); }}>전체 보기</button></div>
        <p className="rwm-map-hint">캐릭터를 누르면 상단에 성장 정보가 나타나요. + · − 로 확대하고, 드래그해서 둘러보세요.</p>
      </div>

      <details className="rwm-roster" open>
        <summary>함께 걷는 친구들 <span>{travelers.length}</span></summary>
        <div className="rwm-roster-list" aria-label="우리 반 전체 학생">
          {travelers.map((row) => <button type="button" className="rwm-person" key={row.uid} aria-pressed={row.uid === selected?.uid} onClick={() => selectTraveler(row, true)}>
            <img src={characterImage(characterOf(row))} alt="" width={47} height={52} loading="lazy" /><span><strong>{row.name || "이름 미설정"}{row.uid === uid && <i>나</i>}</strong><small>{row.studentId}{row.world ? ` · 제${row.world.chapter}여정` : " · 집계 대기"}</small><em>{row.world ? `Lv.${row.world.level} · ${number(row.world.xp)} EXP` : "성장 정보 확인 중"}</em></span>
          </button>)}
        </div>
      </details>
    </div>

    <div className="rwm-footer"><div className="rwm-regions" aria-label="지도 지형 순서">{WORLD_REGIONS.map((region, index) => <span key={region.id} className={growth?.region?.id === region.id && growth.chapter === activeChapter ? "is-current" : ""}><small>0{index + 1}</small>{region.name}</span>)}</div><p>독서 경험치가 쌓이면 길을 따라 나아가요. 캐릭터와 의상은 자유롭게 고를 수 있어요.</p></div>

    {choosing && selected?.uid === uid && <CharacterChooser row={selected} onClose={() => setChoosing(false)} onSave={async (character) => { await onSaveCharacter(character); setChoosing(false); }} />}
  </section>;
}

function TravelerToken({ group, selectedUid, scale, offset, chapter, onClick }) {
  const row = group.representative;
  const target = row.world.progress;
  const [point, setPoint] = useState(() => worldPoint(target));
  const current = useRef({ progress: target, chapter });
  useEffect(() => {
    const from = current.current;
    if (from.chapter !== chapter || window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(from.progress - target) < 0.000001) {
      current.current = { progress: target, chapter };
      setPoint(worldPoint(target));
      return undefined;
    }
    let frame;
    const start = performance.now();
    const animate = (now) => {
      const t = Math.min(1, (now - start) / 1100);
      const eased = t * t * (3 - 2 * t);
      const progress = from.progress + (target - from.progress) * eased;
      current.current = { progress, chapter };
      setPoint(worldPoint(progress));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, chapter]);
  const selected = group.members.some((member) => member.uid === selectedUid);
  return <button type="button" className={`rwm-token${selected ? " is-selected" : ""}`} style={{ left: offset.x + point.x * scale, top: offset.y + point.y * scale }} onClick={onClick} aria-pressed={selected} data-uid={row.uid} data-progress={target}
    aria-label={`${row.name} · Lv.${row.world.level} · ${number(row.totalXp)} EXP${group.members.length > 1 ? ` · 같은 구간 ${group.members.length}명, 눌러서 선택` : ""}`}>
    <img src={characterImage(characterOf(row))} alt="" width={82} height={82} draggable={false} />
    {group.members.length > 1 && <span className="rwm-token-count">{group.members.length}</span>}
    <span className="rwm-token-label">{row.name}<small>Lv.{row.world.level}</small></span>
  </button>;
}

function CharacterChooser({ row, onClose, onSave }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [draft, setDraft] = useState(() => characterOf(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try { await onSave(draft); }
    catch (e) { setError(e?.message || "캐릭터를 저장하지 못했어요. 다시 시도해 주세요."); setBusy(false); }
  }
  return <dialog ref={dialog} className="rwm-character-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="rwm-character-head"><div><span>나의 독서 동반자</span><h3 id={titleId}>함께 걸을 캐릭터를 골라요</h3></div><button type="button" aria-label="캐릭터 선택 닫기" disabled={busy} onClick={onClose}>×</button></div>
    <p>모든 캐릭터와 의상을 자유롭게 선택할 수 있어요.</p>
    <fieldset className="rwm-outfits" disabled={busy}><legend>스타일 선택</legend>{[["intermediate", "모험 스타일"], ["advanced", "무술복 스타일"]].map(([value, label]) => <label key={value}><input type="radio" name={titleId} checked={draft.style === value} onChange={() => setDraft((old) => ({ ...old, style: value }))} />{label}</label>)}</fieldset>
    <div className="rwm-character-grid" role="group" aria-label="캐릭터 선택">{WORLD_CHARACTERS.map((character) => <button key={character.number} type="button" disabled={busy} aria-pressed={draft.number === character.number} onClick={() => setDraft((old) => ({ ...old, number: character.number }))}>
      <img src={characterImage({ number: character.number, style: draft.style })} alt="" width={100} height={100} /><span>{character.name}</span>
    </button>)}</div>
    {error && <p className="rwm-save-error" role="alert">{error}</p>}
    <div className="rwm-character-footer"><button type="button" disabled={busy} onClick={onClose}>취소</button><button type="button" disabled={busy} onClick={save}>{busy ? "저장 중…" : "이 캐릭터로 함께하기"}</button></div>
  </dialog>;
}
