"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { READING_BADGES } from "@/lib/reading";
import { journeyTitle } from "@/lib/readingJourney";
import {
  WORLD_MAP, WORLD_REGIONS,
  groupWorldTravelers, readingLeaderUids, splitWorldLeaderGroups,
  worldCheckpoints, worldPoint, worldProgress,
} from "@/lib/readingWorldMap";
import ReadingBadge from "./ReadingBadge";
import CharacterChooser, { characterImage, characterOf } from "./CharacterChooser";
import "./reading-world-map.css";

const number = (value) => value.toLocaleString("ko-KR");
const chapterLabel = (chapter) => `제${chapter}여정 · Lv.${(chapter - 1) * 10 + 1}–${Math.min(chapter * 10 + 1, 100)}`;
const growthOf = (row) => {
  const growth = worldProgress(row?.totalXp);
  return growth?.level === row?.level ? growth : null;
};

// Only unfold a mixed leader/peer group. Its layout depends on the map and
// growth data, so choosing another student never moves either character.
function peerSlotOffset(group, scale, offset, canvasWidth) {
  if (typeof group.leaderProgress !== "number") return 0;
  const peer = worldPoint(group.progress);
  const leader = worldPoint(group.leaderProgress);
  if (Math.hypot(peer.x - leader.x, peer.y - leader.y) * scale >= 96) return 0;
  const leaderX = offset.x + leader.x * scale;
  const rightSpace = canvasWidth - 44 - leaderX;
  const leftSpace = leaderX - 44;
  const direction = rightSpace >= 96 || rightSpace >= leftSpace ? 1 : -1;
  const targetX = Math.min(canvasWidth - 44, Math.max(44, leaderX + direction * 96));
  return targetX - (offset.x + peer.x * scale);
}

function LeaderSun() {
  return <span className="rwm-leader-sun" aria-hidden="true" />;
}

/** The map consumes the same public snapshot as the rankings, never a peer's library. */
export default function ReadingWorldMap({ rows, uid, isTeacher, onOpenDetails, onSaveCharacter }) {
  const viewport = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const [selectedUid, setSelectedUid] = useState(uid);
  const [selectionPulse, setSelectionPulse] = useState(0);
  const [chapter, setChapter] = useState(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [routeVisible, setRouteVisible] = useState(true);
  const [clusterId, setClusterId] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(true);
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
  const leaderUids = useMemo(() => readingLeaderUids(rows), [rows]);
  const leaderSet = useMemo(() => new Set(leaderUids), [leaderUids]);
  const selected = travelers.find((row) => row.uid === selectedUid)
    || travelers.find((row) => row.uid === uid) || travelers[0];
  const growth = selected?.world;
  const selectedIsLeader = selected && leaderSet.has(String(selected.uid));
  const activeChapter = chapter ?? growth?.chapter ?? 1;
  const checkpoints = useMemo(() => worldCheckpoints(activeChapter), [activeChapter]);
  const scale = Math.min(size.width / WORLD_MAP.width, size.height / WORLD_MAP.height) * zoom;
  const canvasWidth = Math.max(size.width, WORLD_MAP.width * scale);
  const canvasHeight = Math.max(size.height, WORLD_MAP.height * scale);
  const offset = { x: (canvasWidth - WORLD_MAP.width * scale) / 2, y: (canvasHeight - WORLD_MAP.height * scale) / 2 };
  // Unfold nearby travelers as the user zooms in. Grouping never changes XP or
  // combines students on distant parts of the winding route.
  const tolerance = Math.min(0.08, 85 / (WORLD_MAP.length * scale));
  const groups = useMemo(() => splitWorldLeaderGroups(
    groupWorldTravelers(travelers.filter((row) => row.world), { chapter: activeChapter, selectedUid: selected?.uid, epsilon: tolerance }),
    leaderUids, selected?.uid,
  ), [travelers, activeChapter, selected?.uid, tolerance, leaderUids]);
  const cluster = groups.find((group) => group.id === clusterId);
  const shownCount = groups.reduce((sum, group) => sum + group.members.length, 0);
  const pendingCount = travelers.filter((row) => !row.world).length;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      // Hidden tabs have no layout. Keep the last visible canvas and viewport.
      if (width > 0 && height > 0) setSize({ width, height });
    });
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
    // Ordinary selection keeps the first loaded chapter. Explicit navigation
    // and actual progress can still change the chapter being viewed.
    if (growth && chapter === null) {
      setChapter(growth.chapter);
    } else if (growth && previous?.uid === selected.uid && previous.chapter !== growth.chapter
      && chapter === previous.chapter) {
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
    setSelectionPulse((value) => value + 1);
    setClusterId(null);
    if (!center) return;
    const next = growthOf(row);
    if (next) {
      pendingCenter.current = { progress: next.progress, zoom };
      setChapter(next.chapter);
      if (viewport.current && next.chapter === activeChapter) {
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

  return <section className="rwm" aria-label="우리 반 독서 여정 지도">
    {/* 제목 줄(영문 머리 · 큰 제목 · 설명 · '개인 누적 성장 기준')은 걷었습니다 — 지도를
        최대한 크게 보이게, 위에는 이 한 줄(여정 지도 · 인원 · 단추)만 둡니다(선생님 요청). */}
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

    <div className="rwm-layout">
      <div className="rwm-map-panel">
        <div ref={viewport} className="rwm-viewport" tabIndex={0} aria-label="독서 여정 지도. 확대 후 드래그하거나 방향키로 지도를 이동하세요." onPointerDown={startPan} onPointerMove={movePan} onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
          <div className="rwm-canvas" style={{ width: canvasWidth, height: canvasHeight }}>
            <div className="rwm-terrain" style={{ left: offset.x, top: offset.y, width: WORLD_MAP.width * scale, height: WORLD_MAP.height * scale }}>
              <img className="rwm-background" src="/reading-journey/map.webp" alt="울창한 숲에서 사막과 급류 계곡, 설산과 폭풍 해안으로 이어지는 독서 여정 지도" width={WORLD_MAP.width} height={WORLD_MAP.height} draggable={false} onError={() => setImageError(true)} />
              {routeVisible && <svg className="rwm-route" viewBox={`0 0 ${WORLD_MAP.width} ${WORLD_MAP.height}`} aria-hidden="true"><path d={WORLD_MAP.path} /></svg>}
            </div>
            {checkpoints.map((stop) => <span key={stop.level} className="rwm-checkpoint" style={{ left: offset.x + stop.x * scale, top: offset.y + stop.y * scale }} title={`${number(stop.xp)} EXP`}><span>Lv.{stop.level}</span></span>)}
            {groups.map((group) => <TravelerToken key={group.id} group={group} selectedUid={selected?.uid} selectionPulse={selectionPulse} scale={scale} offset={offset} peerOffset={peerSlotOffset(group, scale, offset, canvasWidth)} chapter={activeChapter} onClick={() => {
              const row = group.representative;
              selectTraveler(row);
              if (group.members.length > 1) setClusterId(group.id);
            }} />)}
          </div>
        </div>
        {cluster && cluster.members.length > 1 && <div className="rwm-cluster" role="group" aria-label="같은 구간의 학생 선택"><span>함께 걷는 {cluster.members.length}명</span>{cluster.members.map((row) => <button key={row.uid} type="button" onClick={() => selectTraveler(row)} aria-pressed={selected?.uid === row.uid}>{row.name} <small>{number(row.totalXp)} EXP</small></button>)}<button className="rwm-cluster-close" type="button" onClick={() => setClusterId(null)} aria-label="학생 선택 닫기">×</button></div>}
        {imageError && <p className="rwm-map-message" role="alert">지도 이미지를 불러오지 못했어요. 오른쪽 학생 목록에서 성장 기록을 확인할 수 있어요.</p>}
        {!shownCount && !imageError && <p className="rwm-map-message">이 여정에 있는 학생은 아직 없어요. 학생을 고른 뒤 ‘선택 학생 위치’를 눌러 현재 여정을 확인하세요.</p>}
        <div className="rwm-zoom" role="group" aria-label="지도 크기 조절"><button type="button" onClick={() => zoomTo(zoom - 0.5)} disabled={zoom <= 1} aria-label="지도 축소">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => zoomTo(zoom + 0.5)} disabled={zoom >= 4} aria-label="지도 확대">+</button><button type="button" onClick={() => { zoomRef.current = 1; pendingScroll.current = null; setZoom(1); viewport.current?.scrollTo({ left: 0, top: 0 }); }}>전체 보기</button></div>
        <p className="rwm-map-hint">캐릭터를 누르면 오른쪽에 성장 정보가 나타나요. + · − 로 확대하고, 드래그해서 둘러보세요.</p>
      </div>

      {/* 오른쪽 칸 — 위: 고른 학생의 성장 정보(처음엔 나, 목록 · 지도에서 고르면 그 학생으로 바뀜),
          아래: 함께 걷는 친구들. 한때 지도 위에 가로로 펼쳐 지도가 그만큼 아래로 밀렸습니다(선생님 요청). */}
      <aside className="rwm-side" aria-label="선택한 학생과 함께 걷는 친구들">
        {selected && <div className="rwm-hud" aria-label="선택한 학생의 성장 정보">
          <div className={`rwm-portrait${selectedIsLeader ? " is-leader" : ""}`}>{selectedIsLeader && <LeaderSun />}<img src={characterImage(characterOf(selected))} alt="" width={110} height={110} /></div>
          <div className="rwm-identity"><span>선택한 여행자 {selected.uid === uid && <b>나</b>} {selectedIsLeader && <b className="rwm-leader-tag">{leaderUids.length > 1 ? "공동 독서 대장" : "독서 대장"}</b>}</span><strong data-testid="journey-selected-name">{selected.name || "이름 미설정"}</strong><small>{selected.studentId || "학번 미설정"} · {growth ? journeyTitle(growth.level) : "성장 정보 확인 중"}</small></div>
          <div className="rwm-growth">
            <div className="rwm-growth-values"><span><small>독서 레벨</small><strong data-testid="journey-selected-level">{growth ? `Lv.${growth.level}` : "—"}</strong></span><span><small>누적 경험치</small><strong data-testid="journey-selected-xp">{growth ? number(growth.xp) : "—"}<em> EXP</em></strong></span></div>
            {growth ? <><div className="rwm-exp-bar" role="progressbar" aria-label="현재 레벨 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={growth.percent}><span style={{ width: `${growth.percent}%` }} /></div><p>{growth.complete ? "모든 여정을 완주했어요" : <>다음 레벨까지 <b>{number(growth.toNext)} EXP</b><span>{growth.percent}%</span></>}</p></> : <p>집계가 완료되면 위치가 표시돼요.</p>}
          </div>
          <div className="rwm-hud-badges">
            <span>모은 뱃지</span><div>{READING_BADGES.filter((badge) => selected.badges?.includes(badge.id)).slice(-3).map((badge) => <span key={badge.id} title={badge.label}><ReadingBadge badge={badge} size={30} /></span>)}<strong>{Array.isArray(selected.badges) ? `${selected.badges.length}개` : "—"}</strong></div>
            <button type="button" onClick={() => onOpenDetails?.(selected)}>성장 기록·뱃지 보기 <span aria-hidden="true">↗</span></button>
          </div>
        </div>}
      {/* <details>는 크롬 일부에서 flex 높이를 안 따라 목록이 칸 밖으로 넘쳐, 단추 + 상태로 접고 폅니다. */}
      <div className="rwm-roster">
        <button type="button" className="rwm-roster-head" aria-expanded={rosterOpen} onClick={() => setRosterOpen((v) => !v)}>
          <span aria-hidden="true">{rosterOpen ? "▼" : "▶"}</span> 함께 걷는 친구들 <b>{travelers.length}</b>
        </button>
        {rosterOpen && <div className="rwm-roster-list" aria-label="우리 반 전체 학생">
          {travelers.map((row) => <button type="button" className={`rwm-person${leaderSet.has(String(row.uid)) ? " is-leader" : ""}`} key={row.uid} aria-pressed={row.uid === selected?.uid} onClick={() => selectTraveler(row)}>
            <div className="rwm-person-avatar">{leaderSet.has(String(row.uid)) && <LeaderSun />}<img src={characterImage(characterOf(row))} alt="" width={47} height={52} loading="lazy" /></div><span><strong>{row.name || "이름 미설정"}{row.uid === uid && <i>나</i>}{leaderSet.has(String(row.uid)) && <b className="rwm-leader-tag">독서 대장</b>}</strong><small>{row.studentId}{row.world ? ` · 제${row.world.chapter}여정` : " · 집계 대기"}</small><em>{row.world ? `Lv.${row.world.level} · ${number(row.world.xp)} EXP` : "성장 정보 확인 중"}</em></span>
          </button>)}
        </div>}
      </div>
      </aside>
    </div>

    <div className="rwm-footer"><div className="rwm-regions" aria-label="지도 지형 순서">{WORLD_REGIONS.map((region, index) => <span key={region.id} className={growth?.region?.id === region.id && growth.chapter === activeChapter ? "is-current" : ""}><small>0{index + 1}</small>{region.name}</span>)}</div><p>독서 경험치가 쌓이면 길을 따라 나아가요. 캐릭터와 의상은 자유롭게 고를 수 있어요.</p></div>

    {choosing && selected?.uid === uid && <CharacterChooser row={selected} onClose={() => setChoosing(false)} onSave={async (character) => { await onSaveCharacter(character); setChoosing(false); }} />}
  </section>;
}

function TravelerToken({ group, selectedUid, selectionPulse, scale, offset, peerOffset, chapter, onClick }) {
  const row = group.representative;
  // A different representative must not move a group along the route.
  const target = group.progress;
  const image = useRef(null);
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
  useEffect(() => {
    if (!selected || selectionPulse === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const animation = image.current?.animate([
      { transform: "scale(1)" },
      { transform: "scale(1.12)" },
      { transform: "scale(1)" },
    ], { duration: 450, easing: "ease-in-out" });
    return () => animation?.cancel();
  }, [selected, selectionPulse]);
  return <button type="button" className={`rwm-token${selected ? " is-selected" : ""}${group.isLeader ? " is-leader" : ""}`} style={{ left: offset.x + point.x * scale, top: offset.y + point.y * scale, "--rwm-slot-x": `${peerOffset}px` }} onClick={onClick} aria-pressed={selected} data-uid={row.uid} data-progress={target} data-peer-offset={peerOffset}
    aria-label={`${row.name} · Lv.${row.world.level} · ${number(row.totalXp)} EXP${group.isLeader ? " · 독서 대장" : ""}${group.members.length > 1 ? ` · ${group.isLeader ? "공동 대장" : "같은 구간"} ${group.members.length}명, 눌러서 선택` : ""}`}>
    {peerOffset !== 0 && <span className="rwm-slot-link" style={{ width: Math.abs(peerOffset), left: peerOffset > 0 ? `calc(50% - ${peerOffset}px)` : "50%" }} aria-hidden="true" />}
    {group.isLeader && <LeaderSun />}
    <img ref={image} src={characterImage(characterOf(row))} alt="" width={82} height={82} draggable={false} />
    {group.members.length > 1 && <span className="rwm-token-count">{group.members.length}</span>}
    <span className="rwm-token-label">{group.isLeader && <b className="rwm-token-role">독서 대장</b>}{row.name}<small>Lv.{row.world.level}</small></span>
  </button>;
}

