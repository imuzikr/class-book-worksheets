"use client";

// 개인 누적 성장은 월드맵과 상태창에, 학급·기간별 EXP는 순위에만 씁니다.
// 친구의 책 제목이나 감상문은 공개 성장 요약에 포함되지 않습니다.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { deriveReading, kstToday, READING_BADGES } from "@/lib/reading";
import { fetchReadingRankings, saveReadingCharacter, subscribeReadingState } from "@/lib/data/reading";
import { startVisiblePoll, RANKING_POLL_MS, RANKING_WAKE_GAP_MS } from "@/lib/visiblePoll";
import { journeyNarrative, journeyTitle, badgeHint, rankingAsOf, rankingsForPeriod } from "@/lib/readingJourney";
import { worldProgress } from "@/lib/readingWorldMap";
import { getReadingMapTheme } from "@/lib/readingMapCatalog";
import { characterOf, characterImage } from "@/lib/readingCharacterCatalog";
import { backdropClose } from "@/lib/modal";
import { normalizePublicPet, PET_HATCH_XP, petSpecies, petStageName } from "@/lib/readingPet";
import ReadingBadge from "./ReadingBadge";
import ReadingWorldMap from "./ReadingWorldMap";
import PetFigure from "./PetFigure";
import "./reading.css";
import "./pet.css";

const PERIODS = [["daily", "오늘"], ["weekly", "이번 주"], ["monthly", "이번 달"], ["all-time", "누적"]];
const VIEWS = [{ key: "map", label: "독서 맵" }, { key: "ranking", label: "독서 랭킹" }];
const DISABLED_CODES = new Set(["reading-disabled", "reading/disabled", "disabled_feature", "READING_DISABLED", "reading/ranking-disabled", "reading/forbidden", "reading/unauthenticated", "permission-denied", "unauthenticated"]);
const numeric = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const number = (value) => numeric(value) ? value.toLocaleString("ko-KR") : "—";
const nameOf = (row) => [row?.studentId, row?.name || "이름 미설정"].filter(Boolean).join(" ");
const xpOf = (row) => numeric(row?.totalXp) ? row.totalXp : null;
const orDash = (value, unit = "") => numeric(value) ? `${number(value)}${unit}` : "—";
// 리더보드가 서버에 다시 묻는 주기 — 10분마다 · 탭으로 돌아오면 5분 넘었을 때만(lib/visiblePoll.js, 선생님 요청)
const RANKING_POLL = { intervalMs: RANKING_POLL_MS, wakeGapMs: RANKING_WAKE_GAP_MS };

function growthOf(row) {
  const xp = xpOf(row);
  if (xp === null) return null;
  const growth = worldProgress(xp);
  // 서로 다른 집계의 레벨과 경험치를 섞어 보여 주지 않습니다.
  return row?.level === growth.level ? growth : null;
}

function Character({ row, uid, className }) {
  const character = characterOf({ uid: row?.uid || uid || "", character: row?.character });
  return <span className={className} aria-hidden="true"><img className="rlb-character-image"
    src={characterImage(character)} alt="" draggable={false} loading="lazy" /></span>;
}

// 캐릭터 옆의 독서 펫(lib/readingPet.js) — 서버가 줄마다 실어 줍니다(알이면 종 없이). 관리자 설정에서 끈 반은 null.
const petOf = (row, petOn) => (petOn ? normalizePublicPet(row?.pet) : null);
function petName(pet) {
  const sp = pet?.species ? petSpecies(pet.species) : null;
  return sp ? `${sp.name} · ${sp.animal}` : pet?.ready ? "곧 깨어날 알" : "신비한 알";
}
function petLine(pet, mine = false) {
  if (!pet) return "";
  if (!pet.species) {
    return pet.ready ? (mine ? "알이 깨어나려 해요! 책나눔에서 깨워 주세요." : "알이 곧 깨어나요.")
      : `${mine ? "알이 따뜻해지는 중" : "어떤 친구일지 아직 비밀"} · ${number(Math.min(pet.xp, PET_HATCH_XP))} / ${number(PET_HATCH_XP)}`;
  }
  return `${pet.stage}단계 ${petStageName(pet.stage)} · 펫 경험치 ${number(pet.xp)}`;
}
// 캐릭터와 펫을 한 덩이로 — 펫은 캐릭터의 오른쪽 아래(발치)에 작게
function Face({ row, uid, className, pet, petSize = 26 }) {
  return <span className="rlb-face-pair">
    <Character row={row} uid={uid} className={className} />
    {pet && <span className="rlb-face-pet" title={petName(pet)}><PetFigure species={pet.species} stage={pet.stage} ready={pet.ready} size={petSize} /></span>}
  </span>;
}

function Medal({ rank, size = 34 }) {
  if (rank === 1) return <span className="rlb-medal" style={{ fontSize: size }} aria-label="1위">🥇</span>;
  if (rank === 2) return <span className="rlb-medal" style={{ fontSize: size }} aria-label="2위">🥈</span>;
  if (rank === 3) return <span className="rlb-medal" style={{ fontSize: size }} aria-label="3위">🥉</span>;
  return <span className="rlb-medal rlb-medal--num" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-label={numeric(rank) ? `${rank}위` : "순위 집계 중"}>{number(rank)}</span>;
}

function Bar({ percent, label }) {
  return <span className="rlb-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
    <span style={{ width: `${Math.max(percent > 0 ? 3 : 0, Math.min(100, percent))}%` }} />
  </span>;
}

export default function ReadingLeaderboard({ classId, user, isTeacher = false, mapTheme, characterOn = true, petOn = true, onDisabled, onOpenLibrary }) {
  const selectedMap = getReadingMapTheme(mapTheme).id;
  const viewId = useId();
  const tabRefs = useRef([]);
  const [view, setView] = useState("map");
  const uid = user?.uid;
  const scope = `${classId || ""}:${uid || ""}`;
  const [period, setPeriod] = useState("weekly");
  const [rows, setRows] = useState(null);
  // 서버가 반 순위를 센 때 — '오후 6:30 기준'. 서버는 10분에 한 번만 세고 그 안의 조회는 저장해 둔 것을 줍니다.
  const [computedAt, setComputedAt] = useState(null);
  const [rowsScope, setRowsScope] = useState("");
  const [request, setRequest] = useState(null);
  const [retry, setRetry] = useState(0);
  const [mineState, setMineState] = useState(null);
  const [pickedUid, setPickedUid] = useState(null);
  const disabledRef = useRef(onDisabled); disabledRef.current = onDisabled;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const pollRef = useRef(null);
  // 기간은 받을 열쇠에 넣지 않습니다 — 한 번 받으면 네 기간의 경험치가 함께 와서(xpBy) 단추를 눌러도 다시 안 받습니다.
  const requestKey = `${scope}:${retry}`;
  const requestCurrent = request?.key === requestKey;
  const loading = !requestCurrent || request.status === "loading";
  const error = requestCurrent && request.status === "error" ? request.error : "";

  useEffect(() => {
    let live = true;
    // 어느 길로 받든(처음 · 새로고침 · 주기) 방금 받았다고 적어 둡니다 — 곧이어 오는 주기는 건너뜁니다.
    pollRef.current?.mark();
    setRequest({ key: requestKey, status: "loading" });
    Promise.resolve(fetchReadingRankings(classId)).then((result) => {
      if (!live) return;
      setRows(Array.isArray(result) ? result : result?.rankings || []);
      setComputedAt(Array.isArray(result) ? null : result?.computedAt ?? null);
      setRowsScope(scope);
      setRequest({ key: requestKey, status: "ready" });
    }).catch((error) => {
      if (!live) return;
      setRequest({ key: requestKey, status: "error", error: error?.message || "리더보드를 불러오지 못했어요." });
      if (DISABLED_CODES.has(error?.code)) {
        setRows(null);
        setPickedUid(null);
        disabledRef.current?.();
      }
    });
    return () => { live = false; };
  }, [classId, requestKey, scope]);

  useEffect(() => {
    setPickedUid(null);
  }, [scope]);

  // 순위는 화면이 보일 때만 10분마다, 탭으로 돌아오면 마지막으로 받은 지 5분이 넘었을 때만(lib/visiblePoll.js).
  // 한때 30초마다 + 돌아올 때 두 번씩, 그 뒤 60초마다 받았습니다(한 번에 반 인원의 세 배쯤 읽기).
  useEffect(() => {
    const poll = startVisiblePoll(() => setRetry((value) => value + 1), RANKING_POLL);
    // 처음 받기는 위 효과가 이미 했습니다(효과는 적힌 차례대로 돕니다).
    poll.mark();
    pollRef.current = poll;
    // 상단바 '내 프로필'에서 캐릭터를 바꾸면 곧바로 다시 읽습니다(TopNav)
    const changed = () => setRetry((value) => value + 1);
    window.addEventListener("reading-character-change", changed);
    return () => {
      poll.stop();
      if (pollRef.current === poll) pollRef.current = null;
      window.removeEventListener("reading-character-change", changed);
    };
  }, [scope]);

  // 본인 서재의 정본은 개인 이야기 생성에만 사용합니다.
  useEffect(() => {
    let live = true;
    setMineState(null);
    if (isTeacher || !classId || !uid) return undefined;
    const unsubscribe = subscribeReadingState(classId, uid,
      (value) => { if (live) setMineState({ scope, value }); },
      (error) => {
        if (!live) return;
        setMineState(null);
        if (DISABLED_CODES.has(error?.code)) disabledRef.current?.();
      },
      // 이 화면의 순위와 같은 주기 — 내가 저장하면 지금처럼 곧바로 다시 받습니다.
      RANKING_POLL);
    return () => { live = false; unsubscribe(); };
  }, [classId, uid, isTeacher, scope]);

  const today = kstToday();
  // 상태는 내용이 바뀔 때만 오므로(같으면 안 넘김) 날짜가 바뀌면 오늘 기준으로 다시 셉니다(ReadingHub와 같은 셈).
  const mine = useMemo(() => mineState?.scope === scope ? deriveReading(mineState.value, new Date(`${today}T12:00:00+09:00`)) : null, [mineState, scope, today]);
  const hasSnapshot = rowsScope === scope && rows !== null;
  // 받아 둔 순위가 있으면 다시 받는 동안에도 그대로 둡니다(주기마다 깜빡이지 않게). 기간 단추는 받아 둔 네 기간의
  // 경험치로 그 자리에서 다시 세웁니다(lib/readingJourney.js의 rankingsForPeriod) — 서버에 다시 묻지 않습니다.
  const list = useMemo(() => hasSnapshot ? rankingsForPeriod(rows, period) : [], [hasSnapshot, rows, period]);
  const myRow = list.find((row) => row.uid === uid);
  const picked = list.find((row) => row.uid === pickedUid);
  const periodLabel = PERIODS.find(([key]) => key === period)?.[1];
  const asOf = hasSnapshot ? rankingAsOf(computedAt) : "";
  const selectStudent = useCallback((rowOrUid) => setPickedUid(typeof rowOrUid === "string" ? rowOrUid : rowOrUid?.uid || null), []);
  const closeStudent = useCallback(() => setPickedUid(null), []);
  const saveCharacter = useCallback(async (character) => {
    const savedScope = scope;
    const result = await saveReadingCharacter(classId, character);
    if (scopeRef.current === savedScope) {
      setRows((previous) => previous?.map((row) => row.uid === uid ? { ...row, character: result.character } : row));
      setRetry((value) => value + 1);
    }
    return result.character;
  }, [classId, scope, uid]);

  function handleViewKeys(event, index) {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % VIEWS.length;
    else if (event.key === "ArrowLeft") next = (index + VIEWS.length - 1) % VIEWS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = VIEWS.length - 1;
    else return;
    event.preventDefault();
    setView(VIEWS[next].key);
    tabRefs.current[next]?.focus();
  }

  return <div className="reading-hub rlb">
    <header className="rlb-head">
      <div className="reading-tabs rlb-tabs" role="tablist" aria-label="리더보드 보기">
      {VIEWS.map((item, index) => <button
        key={item.key}
        ref={(element) => { tabRefs.current[index] = element; }}
        type="button"
        role="tab"
        id={`${viewId}-tab-${item.key}`}
        aria-controls={`${viewId}-panel-${item.key}`}
        aria-selected={view === item.key}
        tabIndex={view === item.key ? 0 : -1}
        className={view === item.key ? "active" : ""}
        onClick={() => setView(item.key)}
        onKeyDown={(event) => handleViewKeys(event, index)}
      >{item.label}</button>)}
      </div>
      <div className="rlb-head-side">
        {view === "ranking" && !isTeacher && myRow && !error && <div className="rlb-myrank"><span>{periodLabel} 내 순위</span><Medal rank={myRow.rank} size={40} /></div>}
        <button type="button" className="btn-ghost" disabled={loading} onClick={() => setRetry((value) => value + 1)}>새로고침</button>
      </div>
    </header>

    {error && <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>}
    {hasSnapshot && error && <p className="reading-help" role="status">성장 정보는 마지막으로 확인한 누적 기록입니다. 새로고침해 주세요.</p>}
    <section className="rlb-panel" id={`${viewId}-panel-map`} role="tabpanel" aria-labelledby={`${viewId}-tab-map`} hidden={view !== "map"} tabIndex={0}>
      {!hasSnapshot ? !error && <div className="reading-loading" role="status">우리 반 여정을 모으고 있어요.</div>
        : <ReadingWorldMap key={`${classId}:${selectedMap}`} mapTheme={selectedMap} rows={list} uid={uid} isTeacher={isTeacher} petOn={petOn} onOpenDetails={selectStudent} onSaveCharacter={characterOn ? saveCharacter : null} />}
    </section>

    <section className="rlb-panel" id={`${viewId}-panel-ranking`} role="tabpanel" aria-labelledby={`${viewId}-tab-ranking`} hidden={view !== "ranking"} tabIndex={0}>
      {!hasSnapshot ? !error && <div className="reading-loading" role="status">우리 반 순위를 모으고 있어요.</div>
        : !list.length ? <div className="reading-empty"><h3>아직 함께 걸을 친구가 없어요.</h3><p>반에 학생이 들어오면 이곳에서 독서 여정을 확인할 수 있어요.</p></div>
          : <div className={"rlb-cols" + (isTeacher ? " is-teacher" : "")}>
            <section className="rlb-card" aria-labelledby="rlb-rank-title" aria-busy={loading}>
              <div className="rlb-card-head"><h3 id="rlb-rank-title">독서 랭킹</h3></div>
              <div className="reading-filters" aria-label="순위 기간">{PERIODS.map(([key, label]) => <button key={key} type="button" className={period === key ? "active" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
              <p className="reading-help">순위는 고른 기간에 이 반에서 얻은 경험치로 · 한국 시간 · 주간은 월요일 시작 · 같은 점수는 공동 순위</p>
              {asOf && <p className="reading-help rlb-asof">{asOf} 기준 · 순위는 10분마다 새로 세요</p>}
              {error ? <p className="reading-help">순위를 갱신하지 못했어요. 다시 시도해 주세요.</p>
                  : <ul className="rlb-list">{list.map((row) => {
                    const me = row.uid === uid;
                    const progress = growthOf(row);
                    return <li key={row.uid}>
                      <button type="button" className={"rlb-row" + (me ? " is-me" : "")} onClick={() => selectStudent(row.uid)}>
                        <Medal rank={row.rank} />
                        <Face row={row} className="rlb-row-face" pet={petOf(row, petOn)} />
                        <span className="rlb-row-main">
                          <span className="rlb-row-name">{nameOf(row)}{me && <span className="reading-me-label">나</span>}</span>
                          <span className="rlb-row-sub">{progress ? `Lv.${progress.level} ${journeyTitle(progress.level)} · ${period === "all-time" ? progress.complete ? "최고 레벨에 도착했어요" : `다음 레벨까지 ${number(progress.toNext)} EXP` : `누적 ${number(xpOf(row))} EXP`}` : "누적 성장 정보 집계 중 · —"}</span>
                          {progress && <Bar percent={progress.percent} label={`${row.name} 다음 레벨까지 진행률`} />}
                        </span>
                        <span className="rlb-row-side"><span>{periodLabel} {orDash(row.xp, " EXP")}</span><span>{orDash(row.totalPages, "쪽")} · 뱃지 {orDash(row.badgeCount, "개")}</span></span>
                      </button>
                    </li>;
                  })}</ul>}
            </section>
            {isTeacher ? <ClassSummary rows={list} /> : <MyJourney mine={mine} row={myRow} uid={uid} today={today} pet={petOf(myRow, petOn)} />}
          </div>}
    </section>

    {picked && <StudentJourneyModal row={picked} me={picked.uid === uid} pet={petOf(picked, petOn)} onClose={closeStudent} onOpenLibrary={isTeacher && onOpenLibrary && picked.uid !== uid ? () => onOpenLibrary(picked.uid) : null} />}
  </div>;
}

function MyJourney({ mine, row, uid, today, pet = null }) {
  const progress = growthOf(row);
  const earned = Array.isArray(row?.badges) ? READING_BADGES.filter((badge) => row.badges.includes(badge.id)) : null;
  const lines = mine ? journeyNarrative(mine, today) : null;
  return <section className="rlb-card rlb-mine" aria-labelledby="rlb-mine-title">
    <div className="rlb-card-head"><h3 id="rlb-mine-title">내 여정 정보</h3></div>
    <div className="rlb-mine-top">
      <Face row={row} uid={uid} className="rlb-mine-face" pet={pet} petSize={40} />
      <strong>{progress ? journeyTitle(progress.level) : "성장 정보 집계 중"}</strong>
      {progress && <span className="rlb-stage">📍 {progress.region.name}</span>}
    </div>
    {pet && <div className="rlb-mine-pet"><PetFigure species={pet.species} stage={pet.stage} ready={pet.ready} size={44} /><span><strong>나의 펫 · {petName(pet)}</strong><small>{petLine(pet, true)}</small></span></div>}
    <dl className="rlb-facts">
      <div><dt>레벨</dt><dd>{progress ? `Lv.${progress.level}` : "—"}</dd></div>
      <div><dt>누적 경험치</dt><dd>{orDash(xpOf(row), " EXP")}</dd></div>
      <div><dt>다음 레벨까지</dt><dd>{progress ? progress.complete ? "최고 레벨 도착" : `${number(progress.toNext)} EXP` : "—"}</dd></div>
      <div><dt>읽은 쪽수</dt><dd>{orDash(row?.totalPages, "쪽")}</dd></div>
      <div><dt>완독</dt><dd>{orDash(row?.completedBooks, "권")}</dd></div>
      <div><dt>감상문</dt><dd>{orDash(row?.reviewCount, "편")}</dd></div>
      <div><dt>연속 독서</dt><dd>{orDash(row?.currentStreak, "일")}</dd></div>
      <div><dt>뱃지</dt><dd>{earned ? `${earned.length} / ${READING_BADGES.length}개` : "—"}</dd></div>
    </dl>
    {progress && <Bar percent={progress.percent} label="다음 레벨까지 진행률" />}
    <div className="rlb-story"><h4>📖 나의 독서 여정</h4>{lines ? lines.map((text, index) => <p key={index}>{text}</p>) : <p role="status">내 서재에서 여정 이야기를 모으고 있어요.</p>}</div>
    {earned?.length > 0 && <div className="rlb-badges-mini" aria-label="모은 뱃지">{earned.map((badge) => <span key={badge.id} title={badge.label}><ReadingBadge badge={badge} size={36} /></span>)}</div>}
  </section>;
}

function ClassSummary({ rows }) {
  const known = rows.filter((row) => growthOf(row));
  const readers = known.filter((row) => xpOf(row) > 0);
  const complete = known.length === rows.length;
  const avg = complete && rows.length ? known.reduce((sum, row) => sum + row.level, 0) / rows.length : null;
  const total = (key) => rows.every((row) => numeric(row[key])) ? rows.reduce((sum, row) => sum + row[key], 0) : null;
  return <section className="rlb-card" aria-labelledby="rlb-class-title">
    <div className="rlb-card-head"><h3 id="rlb-class-title">우리 반 여정 요약</h3></div>
    <dl className="rlb-facts">
      <div><dt>여정을 시작한 학생</dt><dd>{complete ? `${readers.length} / ${rows.length}명` : "—"}</dd></div>
      <div><dt>평균 레벨</dt><dd>{avg === null ? "—" : `Lv.${avg.toFixed(1)}`}</dd></div>
      <div><dt>함께 읽은 쪽수</dt><dd>{orDash(total("totalPages"), "쪽")}</dd></div>
      <div><dt>모은 뱃지</dt><dd>{orDash(total("badgeCount"), "개")}</dd></div>
    </dl>
    {!complete && <p className="reading-help">성장 정보 확인 {known.length} / {rows.length}명 · 누락된 집계는 0으로 계산하지 않아요.</p>}
    <p className="reading-help">선생님 계정은 순위에 들지 않아요. 학생 이름을 누르면 그 학생의 경험치와 뱃지를 볼 수 있어요. 책 제목과 감상 글은 이곳에 보이지 않아요.</p>
  </section>;
}

function StudentJourneyModal({ row, me, pet = null, onClose, onOpenLibrary = null }) {
  const modalRef = useRef(null);
  const progress = growthOf(row);
  const earned = new Set(row.badges ?? []);
  const known = Array.isArray(row.badges);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const handleKeys = (event) => {
    if (event.key === "Escape" && !event.isComposing) { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const elements = [...(modalRef.current?.querySelectorAll("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])") ?? [])];
    if (!elements.length) { event.preventDefault(); return; }
    const first = elements[0]; const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="modal-backdrop" {...backdropClose(onClose)}>
    <div ref={modalRef} className="modal reading-modal rlb-modal" role="dialog" aria-modal="true" aria-labelledby="rlb-modal-title" onKeyDown={handleKeys}>
      <div className="rlb-modal-head">
        <Face row={row} className="rlb-mine-face" pet={pet} petSize={36} />
        <div><h3 id="rlb-modal-title">{nameOf(row)}{me && <span className="reading-me-label">나</span>}</h3><p>{progress ? `Lv.${progress.level} ${journeyTitle(progress.level)} · 📍 ${progress.region.name}` : "누적 성장 정보 집계 중"}</p></div>
        {/* 교사: 그 학생의 책나눔(읽기 전용 서재)으로 — 선생님 요청 */}
        {onOpenLibrary && <button type="button" className="btn-ghost rlb-to-library" onClick={onOpenLibrary}>서재로 이동</button>}
        <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
      </div>
      <dl className="rlb-facts">
        <div><dt>누적 경험치</dt><dd>{orDash(xpOf(row), " EXP")}</dd></div>
        <div><dt>다음 레벨까지</dt><dd>{progress ? progress.complete ? "최고 레벨 도착" : `${number(progress.toNext)} EXP` : "—"}</dd></div>
        <div><dt>읽은 쪽수</dt><dd>{orDash(row.totalPages, "쪽")}</dd></div>
        <div><dt>완독</dt><dd>{orDash(row.completedBooks, "권")}</dd></div>
        <div><dt>감상문</dt><dd>{orDash(row.reviewCount, "편")}</dd></div>
        <div><dt>연속 독서</dt><dd>{orDash(row.currentStreak, "일")}</dd></div>
        <div><dt>가장 긴 연속</dt><dd>{orDash(row.longestStreak, "일")}</dd></div>
        <div><dt>뱃지</dt><dd>{known ? `${earned.size} / ${READING_BADGES.length}개` : "—"}</dd></div>
      </dl>
      {progress && <Bar percent={progress.percent} label="다음 레벨까지 진행률" />}
      {pet && <div className="rlb-modal-pet"><PetFigure species={pet.species} stage={pet.stage} ready={pet.ready} size={44} /><span><strong>{me ? "나의 펫" : "함께하는 펫"} · {petName(pet)}</strong><small>{petLine(pet, me)}</small></span></div>}
      <h4 className="rlb-modal-sub">뱃지</h4>
      {known ? <ul className="rlb-badge-grid">{READING_BADGES.map((badge, index) => {
        const got = earned.has(badge.id);
        const tipClass = ["rlb-tip", index < 3 ? "is-below" : "", index % 3 === 0 ? "is-start" : index % 3 === 2 ? "is-end" : ""].filter(Boolean).join(" ");
        return <li key={badge.id} className={got ? "is-earned" : ""} tabIndex={0} aria-describedby={`rlb-tip-${badge.id}`}>
          <ReadingBadge badge={badge} size={48} earned={got} />
          <span>{badge.name}<small>{badge.tierName} · {badge.description}</small></span>
          <span role="tooltip" id={`rlb-tip-${badge.id}`} className={tipClass}><b>{badge.label}</b>{badgeHint(badge).map((text, part) => <span key={part}>{text}</span>)}<em className={got ? "is-got" : ""}>{got ? "✓ 받았어요" : "아직 도전 중"}</em></span>
        </li>;
      })}</ul> : <p className="reading-help">획득 뱃지를 아직 확인하지 못했어요. 집계가 갱신되면 여기에 표시됩니다.</p>}
    </div>
  </div>;
}
