"use client";

// 개인 누적 성장은 월드맵과 상태창에, 학급·기간별 EXP는 순위에만 씁니다.
// 친구의 책 제목이나 감상문은 공개 성장 요약에 포함되지 않습니다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveReading, kstToday, READING_BADGES } from "@/lib/reading";
import { fetchReadingRankings, saveReadingCharacter, subscribeReadingState } from "@/lib/data/reading";
import { journeyNarrative, journeyTitle, badgeHint } from "@/lib/readingJourney";
import { defaultWorldAvatar, worldProgress } from "@/lib/readingWorldMap";
import { backdropClose } from "@/lib/modal";
import ReadingBadge from "./ReadingBadge";
import ReadingWorldMap from "./ReadingWorldMap";
import "./reading.css";

const PERIODS = [["daily", "오늘"], ["weekly", "이번 주"], ["monthly", "이번 달"], ["all-time", "누적"]];
const DISABLED_CODES = new Set(["reading-disabled", "reading/disabled", "disabled_feature", "READING_DISABLED", "reading/ranking-disabled", "reading/forbidden", "reading/unauthenticated", "permission-denied", "unauthenticated"]);
const numeric = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const number = (value) => numeric(value) ? value.toLocaleString("ko-KR") : "—";
const nameOf = (row) => [row?.studentId, row?.name || "이름 미설정"].filter(Boolean).join(" ");
const xpOf = (row) => numeric(row?.totalXp) ? row.totalXp : null;
const orDash = (value, unit = "") => numeric(value) ? `${number(value)}${unit}` : "—";

function growthOf(row) {
  const xp = xpOf(row);
  if (xp === null) return null;
  const growth = worldProgress(xp);
  // 서로 다른 집계의 레벨과 경험치를 섞어 보여 주지 않습니다.
  return row?.level === growth.level ? growth : null;
}

function Character({ row, uid, className }) {
  const fallback = defaultWorldAvatar(row?.uid || uid || "");
  const chosen = row?.character;
  const avatarNumber = Number.isInteger(chosen?.number) && chosen.number >= 1 && chosen.number <= 10 ? chosen.number : fallback;
  const style = ["intermediate", "advanced"].includes(chosen?.style) ? chosen.style : "intermediate";
  return <span className={className} aria-hidden="true"><img className="rlb-character-image"
    src={`/reading-journey/${style}-${String(avatarNumber).padStart(2, "0")}.webp`} alt="" draggable={false} loading="lazy" /></span>;
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

export default function ReadingLeaderboard({ classId, user, isTeacher = false, characterOn = true, onDisabled }) {
  const uid = user?.uid;
  const scope = `${classId || ""}:${uid || ""}`;
  const [period, setPeriod] = useState("weekly");
  const [rows, setRows] = useState(null);
  const [rowsScope, setRowsScope] = useState("");
  const [request, setRequest] = useState(null);
  const [retry, setRetry] = useState(0);
  const [mineState, setMineState] = useState(null);
  const [pickedUid, setPickedUid] = useState(null);
  const disabledRef = useRef(onDisabled); disabledRef.current = onDisabled;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const requestKey = `${scope}:${period}:${retry}`;
  const requestCurrent = request?.key === requestKey;
  const loading = !requestCurrent || request.status === "loading";
  const error = requestCurrent && request.status === "error" ? request.error : "";

  useEffect(() => {
    let live = true;
    setRequest({ key: requestKey, status: "loading" });
    Promise.resolve(fetchReadingRankings(classId, period)).then((result) => {
      if (!live) return;
      setRows(Array.isArray(result) ? result : result?.rankings || []);
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
  }, [classId, period, requestKey, scope]);

  useEffect(() => {
    setPickedUid(null);
  }, [scope]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setRetry((value) => value + 1); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    // 상단바 '내 프로필'에서 캐릭터를 바꾸면 곧바로 다시 읽습니다(TopNav)
    const changed = () => setRetry((value) => value + 1);
    window.addEventListener("reading-character-change", changed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("reading-character-change", changed);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [scope]);

  // 본인 서재의 과일 이력을 포함한 정본은 개인 이야기 생성에만 사용합니다.
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
      });
    return () => { live = false; unsubscribe(); };
  }, [classId, uid, isTeacher, scope]);

  const today = kstToday();
  const mine = useMemo(() => mineState?.scope === scope ? deriveReading(mineState.value, new Date()) : null, [mineState, scope]);
  const hasSnapshot = rowsScope === scope && rows !== null;
  const list = useMemo(() => hasSnapshot ? rows : [], [hasSnapshot, rows]);
  const myRow = list.find((row) => row.uid === uid);
  const picked = list.find((row) => row.uid === pickedUid);
  const periodLabel = PERIODS.find(([key]) => key === period)?.[1];
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

  return <div className="reading-hub rlb">
    <header className="rlb-head">
      <div><h2>우리 반 독서 여정</h2><p>우리 반 친구들이 각자의 속도로 걸어온 길을 한눈에 봐요. 맵은 개인 누적 경험치 · 레벨 · 뱃지를 보여 줍니다.</p></div>
      <div className="rlb-head-side">
        {!isTeacher && myRow && !loading && !error && <div className="rlb-myrank"><span>{periodLabel} 내 순위</span><Medal rank={myRow.rank} size={40} /></div>}
        <button type="button" className="btn-ghost" disabled={loading} onClick={() => setRetry((value) => value + 1)}>새로고침</button>
      </div>
    </header>

    {error && <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>}
    {!hasSnapshot ? !error && <div className="reading-loading" role="status">우리 반 여정을 모으고 있어요.</div>
      : <>
        {(loading || error) && <p className="reading-help" role="status">{loading ? "순위를 새로 불러오는 중이에요. 맵과 성장 정보는 마지막으로 확인한 누적 기록입니다." : "맵과 성장 정보는 마지막으로 확인한 누적 기록입니다. 새로고침해 주세요."}</p>}
        <ReadingWorldMap key={classId} rows={list} uid={uid} isTeacher={isTeacher} onOpenDetails={selectStudent} onSaveCharacter={characterOn ? saveCharacter : null} />

        {!list.length ? <div className="reading-empty"><h3>아직 함께 걸을 친구가 없어요.</h3><p>반에 학생이 들어오면 이곳에서 독서 여정을 확인할 수 있어요.</p></div>
          : <div className={"rlb-cols" + (isTeacher ? " is-teacher" : "")}>
            <section className="rlb-card" aria-labelledby="rlb-rank-title" aria-busy={loading}>
              <div className="rlb-card-head"><h3 id="rlb-rank-title">독서 여정 순위</h3></div>
              <div className="reading-filters" aria-label="순위 기간">{PERIODS.map(([key, label]) => <button key={key} type="button" className={period === key ? "active" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
              <p className="reading-help">순위는 고른 기간에 이 반에서 얻은 경험치로 · 한국 시간 · 주간은 월요일 시작 · 같은 점수는 공동 순위</p>
              {loading ? <div className="reading-loading" role="status">{periodLabel} 순위를 불러오는 중이에요.</div>
                : error ? <p className="reading-help">순위를 갱신하지 못했어요. 다시 시도해 주세요.</p>
                  : <ul className="rlb-list">{list.map((row) => {
                    const me = row.uid === uid;
                    const progress = growthOf(row);
                    return <li key={row.uid}>
                      <button type="button" className={"rlb-row" + (me ? " is-me" : "")} onClick={() => selectStudent(row.uid)}>
                        <Medal rank={row.rank} />
                        <Character row={row} className="rlb-row-face" />
                        <span className="rlb-row-main">
                          <span className="rlb-row-name">{nameOf(row)}{me && <span className="reading-me-label">나</span>}</span>
                          <span className="rlb-row-sub">{progress ? `Lv.${progress.level} ${journeyTitle(progress.level)} · ${period === "all-time" ? progress.level === 100 ? "최고 레벨에 도착했어요" : `다음 레벨까지 ${number(progress.toNext)} EXP` : `누적 ${number(xpOf(row))} EXP`}` : "누적 성장 정보 집계 중 · —"}</span>
                          {progress && <Bar percent={progress.percent} label={`${row.name} 다음 레벨까지 진행률`} />}
                        </span>
                        <span className="rlb-row-side"><span>{periodLabel} {orDash(row.xp, " EXP")}</span><span>{orDash(row.totalPages, "쪽")} · 뱃지 {orDash(row.badgeCount, "개")}</span></span>
                      </button>
                    </li>;
                  })}</ul>}
            </section>
            {isTeacher ? <ClassSummary rows={list} /> : <MyJourney mine={mine} row={myRow} uid={uid} today={today} />}
          </div>}
      </>}

    {picked && <StudentJourneyModal row={picked} me={picked.uid === uid} onClose={closeStudent} />}
  </div>;
}

function MyJourney({ mine, row, uid, today }) {
  const progress = growthOf(row);
  const earned = Array.isArray(row?.badges) ? READING_BADGES.filter((badge) => row.badges.includes(badge.id)) : null;
  const lines = mine ? journeyNarrative(mine, today) : null;
  return <section className="rlb-card rlb-mine" aria-labelledby="rlb-mine-title">
    <div className="rlb-card-head"><h3 id="rlb-mine-title">내 여정 정보</h3></div>
    <div className="rlb-mine-top">
      <Character row={row} uid={uid} className="rlb-mine-face" />
      <strong>{progress ? journeyTitle(progress.level) : "성장 정보 집계 중"}</strong>
      {progress && <span className="rlb-stage">📍 제{progress.chapter}여정 · {progress.region.name}</span>}
    </div>
    <dl className="rlb-facts">
      <div><dt>레벨</dt><dd>{progress ? `Lv.${progress.level}` : "—"}</dd></div>
      <div><dt>누적 경험치</dt><dd>{orDash(xpOf(row), " EXP")}</dd></div>
      <div><dt>다음 레벨까지</dt><dd>{progress ? progress.level === 100 ? "최고 레벨 도착" : `${number(progress.toNext)} EXP` : "—"}</dd></div>
      <div><dt>읽은 쪽수</dt><dd>{orDash(row?.totalPages, "쪽")}</dd></div>
      <div><dt>완독</dt><dd>{orDash(row?.completedBooks, "권")}</dd></div>
      <div><dt>연속 독서</dt><dd>{orDash(row?.currentStreak, "일")}</dd></div>
      <div><dt>받은 과일</dt><dd>{orDash(row?.fruitCount, "개")}</dd></div>
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

function StudentJourneyModal({ row, me, onClose }) {
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
        <Character row={row} className="rlb-mine-face" />
        <div><h3 id="rlb-modal-title">{nameOf(row)}{me && <span className="reading-me-label">나</span>}</h3><p>{progress ? `Lv.${progress.level} ${journeyTitle(progress.level)} · 📍 제${progress.chapter}여정 · ${progress.region.name}` : "누적 성장 정보 집계 중"}</p></div>
        <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
      </div>
      <dl className="rlb-facts">
        <div><dt>누적 경험치</dt><dd>{orDash(xpOf(row), " EXP")}</dd></div>
        <div><dt>다음 레벨까지</dt><dd>{progress ? progress.level === 100 ? "최고 레벨 도착" : `${number(progress.toNext)} EXP` : "—"}</dd></div>
        <div><dt>읽은 쪽수</dt><dd>{orDash(row.totalPages, "쪽")}</dd></div>
        <div><dt>완독</dt><dd>{orDash(row.completedBooks, "권")}</dd></div>
        <div><dt>감상문</dt><dd>{orDash(row.reviewCount, "편")}</dd></div>
        <div><dt>연속 독서</dt><dd>{orDash(row.currentStreak, "일")}</dd></div>
        <div><dt>가장 긴 연속</dt><dd>{orDash(row.longestStreak, "일")}</dd></div>
        <div><dt>받은 과일</dt><dd>{orDash(row.fruitCount, "개")}</dd></div>
        <div><dt>뱃지</dt><dd>{known ? `${earned.size} / ${READING_BADGES.length}개` : "—"}</dd></div>
      </dl>
      {progress && <Bar percent={progress.percent} label="다음 레벨까지 진행률" />}
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
