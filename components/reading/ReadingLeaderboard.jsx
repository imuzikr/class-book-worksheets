"use client";

// =============================================================
// 리더보드 — 상단바 '리더보드'(/books?area=leaderboard)
// -------------------------------------------------------------
// 책나눔(경험치 · 레벨 · 뱃지)을 '독서 여정'으로 보여 줍니다
// (imuzikr/class-read-book의 '독서 여정 현황'을 옮김 — lib/readingJourney.js).
//   ① 여정 트랙 — 누적 경험치 TOP 10이 레벨 눈금 위를 나란히 달립니다.
//   ② 순위 — 오늘 · 이번 주 · 이번 달 · 누적. 줄을 누르면 그 학생의 경험치 · 뱃지 창.
//   ③ 내 여정 정보(학생) — 내 레벨 · 다음 레벨까지 · 뱃지 · '나의 독서 여정' 이야기.
// 읽는 것은 랭킹 API 한 번(반 집계)과 학생 본인의 서재 한 장뿐입니다. 친구의 책 제목 ·
// 감상은 반 집계에 없어 보이지 않습니다.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { deriveReading, kstToday, READING_BADGES } from "@/lib/reading";
import { fetchReadingRankings, subscribeReadingState } from "@/lib/data/reading";
import {
  journeyAvatar, journeyNarrative, journeyPosition, journeyStage, journeyTitle,
  journeyTrackMax, levelProgress, sortJourney,
} from "@/lib/readingJourney";
import { backdropClose } from "@/lib/modal";
import ReadingBadge from "./ReadingBadge";
import "./reading.css";

const PERIODS = [["daily", "오늘"], ["weekly", "이번 주"], ["monthly", "이번 달"], ["all-time", "누적"]];
const TRACK_TOP = 10;
const number = (v) => Number(v || 0).toLocaleString("ko-KR");
const nameOf = (r) => [r?.studentId, r?.name || "이름 미설정"].filter(Boolean).join(" ");
const xpOf = (r) => Number(r?.totalXp ?? r?.allTimeXp ?? 0) || 0;
const orDash = (v, unit = "") => (v === null || v === undefined ? "—" : `${number(v)}${unit}`);

function Medal({ rank, size = 34 }) {
  if (rank === 1) return <span className="rlb-medal" style={{ fontSize: size }} aria-label="1위">🥇</span>;
  if (rank === 2) return <span className="rlb-medal" style={{ fontSize: size }} aria-label="2위">🥈</span>;
  if (rank === 3) return <span className="rlb-medal" style={{ fontSize: size }} aria-label="3위">🥉</span>;
  return <span className="rlb-medal rlb-medal--num" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-label={`${rank}위`}>{rank}</span>;
}

function Bar({ percent, label }) {
  return <span className="rlb-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
    <span style={{ width: `${Math.max(percent > 0 ? 3 : 0, Math.min(100, percent))}%` }} />
  </span>;
}

export default function ReadingLeaderboard({ classId, user, isTeacher = false, onDisabled }) {
  const uid = user?.uid;
  const [period, setPeriod] = useState("weekly");
  const [rows, setRows] = useState(null); // null = 아직 모름
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mineState, setMineState] = useState(null);
  const [picked, setPicked] = useState(null);
  const disabledRef = useRef(onDisabled); disabledRef.current = onDisabled;

  useEffect(() => {
    let live = true;
    setError("");
    Promise.resolve(fetchReadingRankings(classId, period)).then((result) => {
      if (live) setRows(Array.isArray(result) ? result : result?.rankings || []);
    }).catch((e) => {
      if (!live) return;
      setError(e?.message || "리더보드를 불러오지 못했어요.");
      if (["reading-disabled", "reading/disabled", "disabled_feature", "READING_DISABLED"].includes(e?.code)) disabledRef.current?.();
    });
    return () => { live = false; };
  }, [classId, period, retry]);

  // 학생 본인의 서재 — '나의 독서 여정' 이야기에만 씁니다.
  useEffect(() => {
    if (isTeacher || !classId || !uid) return undefined;
    return subscribeReadingState(classId, uid, setMineState, () => {});
  }, [classId, uid, isTeacher]);

  const today = kstToday();
  const mine = useMemo(() => (mineState ? deriveReading(mineState, new Date()) : null), [mineState]);
  const list = useMemo(() => rows ?? [], [rows]);
  const journey = useMemo(() => sortJourney(list).slice(0, TRACK_TOP), [list]);
  const trackMax = journeyTrackMax(list);
  const myRow = list.find((r) => r.uid === uid);
  const periodLabel = PERIODS.find(([k]) => k === period)?.[1];
  const leaderUid = journey[0] && xpOf(journey[0]) > 0 ? journey[0].uid : null;

  return <div className="reading-hub rlb">
    <header className="rlb-head">
      <div>
        <h2>우리 반 독서 여정</h2>
        <p>우리 반 친구들이 각자의 속도로 걸어온 길을 한눈에 봐요. 경험치 · 레벨 · 뱃지는 책나눔 기록으로 셉니다.</p>
      </div>
      <div className="rlb-head-side">
        {!isTeacher && myRow && <div className="rlb-myrank"><span>{periodLabel} 내 순위</span><Medal rank={myRow.rank} size={40} /></div>}
        <button type="button" className="btn-ghost" disabled={rows === null && !error} onClick={() => setRetry((v) => v + 1)}>새로고침</button>
      </div>
    </header>

    {error ? <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setRetry((v) => v + 1)}>다시 시도</button></div>
      : rows === null ? <div className="reading-loading" role="status">우리 반 여정을 모으고 있어요.</div>
        : !list.length ? <div className="reading-empty"><h3>아직 함께 달릴 친구가 없어요.</h3><p>반에 학생이 들어오고 책나눔에 독서를 기록하면 이곳에 여정이 그려져요.</p></div>
          : <>
            <section className="rlb-card" aria-labelledby="rlb-track-title">
              <div className="rlb-card-head"><h3 id="rlb-track-title">독서 여정 트랙</h3><span className="rlb-pill">TOP {Math.min(TRACK_TOP, list.length)}</span><span className="rlb-card-note">누적 경험치 순 · 레벨 {trackMax}까지</span></div>
              <div className="rlb-track-scale" aria-hidden="true">
                {Array.from({ length: trackMax }, (_, i) => i + 1).map((lv) => <span key={lv} style={{ left: `${4 + ((lv - 1) / (trackMax - 1)) * 92}%` }}>Lv.{lv}</span>)}
              </div>
              <ol className="rlb-track" aria-label="누적 경험치 상위 학생의 레벨 위치">
                {Array.from({ length: trackMax }, (_, i) => <span key={i} className="rlb-track-line" style={{ left: `${4 + (i / (trackMax - 1)) * 92}%` }} aria-hidden="true" />)}
                {journey.map((r) => {
                  const xp = xpOf(r);
                  const pos = journeyPosition(xp, trackMax);
                  const me = r.uid === uid;
                  return <li key={r.uid} className={"rlb-lane" + (me ? " is-me" : "")}>
                    {xp > 0 && <span className="rlb-lane-bar" style={{ width: `${pos - 4}%` }} aria-hidden="true" />}
                    <button type="button" className={"rlb-runner" + (pos > 70 ? " is-right" : "")} style={{ left: `${pos}%` }} onClick={() => setPicked(r)}
                      title={`${nameOf(r)} · Lv.${r.level || 1} · ${number(xp)} EXP`}>
                      <span className="rlb-runner-face" aria-hidden="true">{journeyAvatar(r.level)}</span>
                      <span className="rlb-runner-name">{r.name}{me && " (나)"}{r.uid === leaderUid && <span className="rlb-star" aria-label="누적 1위"> ⭐</span>}</span>
                    </button>
                  </li>;
                })}
              </ol>
              <p className="rlb-foot">길 위의 모습은 레벨에 따라 바뀌어요 — 🌱 1 · 🌿 2 · 📚 3 · 🏃 5 · 🦉 7 · 🧙 8 · 👑 10. 이름을 누르면 경험치와 뱃지를 볼 수 있어요.</p>
            </section>

            <div className={"rlb-cols" + (isTeacher ? " is-teacher" : "")}>
              <section className="rlb-card" aria-labelledby="rlb-rank-title">
                <div className="rlb-card-head"><h3 id="rlb-rank-title">독서 여정 순위</h3></div>
                <div className="reading-filters" aria-label="순위 기간">{PERIODS.map(([key, label]) => <button key={key} type="button" className={period === key ? "active" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
                <p className="reading-help">순위는 고른 기간에 이 반에서 얻은 경험치로 · 한국 시간 · 주간은 월요일 시작 · 같은 점수는 공동 순위</p>
                <ul className="rlb-list">
                  {list.map((r) => {
                    const me = r.uid === uid;
                    const p = levelProgress(xpOf(r));
                    return <li key={r.uid}>
                      <button type="button" className={"rlb-row" + (me ? " is-me" : "")} onClick={() => setPicked(r)}>
                        <Medal rank={r.rank} />
                        <span className="rlb-row-face" aria-hidden="true">{journeyAvatar(r.level)}</span>
                        <span className="rlb-row-main">
                          <span className="rlb-row-name">{nameOf(r)}{me && <span className="reading-me-label">나</span>}</span>
                          <span className="rlb-row-sub">Lv.{r.level || 1} {journeyTitle(r.level)} · {period === "all-time" ? `다음 레벨까지 ${number(p.toNext)} EXP` : `누적 ${number(xpOf(r))} EXP`}</span>
                          <Bar percent={p.percent} label={`${r.name} 다음 레벨까지 진행률`} />
                        </span>
                        <span className="rlb-row-side">
                          <span>{periodLabel} {number(r.xp)} EXP</span>
                          <span>{orDash(r.totalPages, "쪽")} · 뱃지 {orDash(r.badgeCount, "개")}</span>
                        </span>
                      </button>
                    </li>;
                  })}
                </ul>
              </section>

              {isTeacher ? <ClassSummary rows={list} /> : <MyJourney mine={mine} row={myRow} today={today} />}
            </div>
          </>}

    {picked && <StudentJourneyModal row={picked} me={picked.uid === uid} onClose={() => setPicked(null)} />}
  </div>;
}

function MyJourney({ mine, row, today }) {
  if (!mine) return <section className="rlb-card rlb-mine"><div className="rlb-card-head"><h3>내 여정 정보</h3></div><div className="reading-loading" role="status">내 서재를 불러오는 중이에요.</div></section>;
  const p = levelProgress(mine.xp);
  const lines = journeyNarrative(mine, today);
  return <section className="rlb-card rlb-mine" aria-labelledby="rlb-mine-title">
    <div className="rlb-card-head"><h3 id="rlb-mine-title">내 여정 정보</h3></div>
    <div className="rlb-mine-top">
      <span className="rlb-mine-face" aria-hidden="true">{journeyAvatar(mine.level)}</span>
      <strong>{journeyTitle(mine.level)}</strong>
      <span className="rlb-stage">📍 {journeyStage(mine.level)}</span>
      {row && <span className="rlb-mine-rank">이번 순위 <b>{row.rank}위</b></span>}
    </div>
    <dl className="rlb-facts">
      <div><dt>레벨</dt><dd>Lv.{mine.level}</dd></div>
      <div><dt>누적 경험치</dt><dd>{number(mine.xp)} EXP</dd></div>
      <div><dt>다음 레벨까지</dt><dd>{number(p.toNext)} EXP</dd></div>
      <div><dt>읽은 쪽수</dt><dd>{number(mine.totalPages)}쪽</dd></div>
      <div><dt>완독</dt><dd>{number(mine.totalBooks)}권</dd></div>
      <div><dt>연속 독서</dt><dd>{number(mine.currentStreak)}일</dd></div>
      <div><dt>받은 과일</dt><dd>🍊 {number(mine.fruitCount)}개</dd></div>
      <div><dt>뱃지</dt><dd>{mine.earnedBadges.length} / {READING_BADGES.length}개</dd></div>
    </dl>
    <Bar percent={p.percent} label="다음 레벨까지 진행률" />
    <div className="rlb-story">
      <h4>📖 나의 독서 여정</h4>
      {lines.map((t, i) => <p key={i}>{t}</p>)}
    </div>
    {mine.earnedBadges.length > 0 && <div className="rlb-badges-mini" aria-label="모은 뱃지">
      {mine.earnedBadges.map((b) => <span key={b.id} title={b.label}><ReadingBadge badge={b} size={36} /></span>)}
    </div>}
  </section>;
}

function ClassSummary({ rows }) {
  const readers = rows.filter((r) => xpOf(r) > 0);
  const avg = rows.length ? rows.reduce((s, r) => s + (Number(r.level) || 1), 0) / rows.length : 0;
  const pages = rows.reduce((s, r) => s + (Number(r.totalPages) || 0), 0);
  const badges = rows.reduce((s, r) => s + (Number(r.badgeCount) || 0), 0);
  return <section className="rlb-card" aria-labelledby="rlb-class-title">
    <div className="rlb-card-head"><h3 id="rlb-class-title">우리 반 여정 요약</h3></div>
    <dl className="rlb-facts">
      <div><dt>여정을 시작한 학생</dt><dd>{readers.length} / {rows.length}명</dd></div>
      <div><dt>평균 레벨</dt><dd>Lv.{avg.toFixed(1)}</dd></div>
      <div><dt>함께 읽은 쪽수</dt><dd>{number(pages)}쪽</dd></div>
      <div><dt>모은 뱃지</dt><dd>{number(badges)}개</dd></div>
    </dl>
    <p className="reading-help">선생님 계정은 순위에 들지 않아요. 학생 이름을 누르면 그 학생의 경험치와 뱃지를 볼 수 있어요. 책 제목과 감상 글은 이곳에 보이지 않아요.</p>
  </section>;
}

function StudentJourneyModal({ row, me, onClose }) {
  const xp = xpOf(row);
  const p = levelProgress(xp);
  const earned = new Set(row.badges ?? []);
  const known = Array.isArray(row.badges);
  return <div className="modal-backdrop" {...backdropClose(onClose)}>
    <div className="modal reading-modal rlb-modal" role="dialog" aria-modal="true" aria-labelledby="rlb-modal-title">
      <div className="rlb-modal-head">
        <span className="rlb-mine-face" aria-hidden="true">{journeyAvatar(row.level)}</span>
        <div>
          <h3 id="rlb-modal-title">{nameOf(row)}{me && <span className="reading-me-label">나</span>}</h3>
          <p>Lv.{row.level || 1} {journeyTitle(row.level)} · 📍 {journeyStage(row.level)}</p>
        </div>
        <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
      </div>
      <dl className="rlb-facts">
        <div><dt>누적 경험치</dt><dd>{number(xp)} EXP</dd></div>
        <div><dt>다음 레벨까지</dt><dd>{number(p.toNext)} EXP</dd></div>
        <div><dt>읽은 쪽수</dt><dd>{orDash(row.totalPages, "쪽")}</dd></div>
        <div><dt>완독</dt><dd>{orDash(row.completedBooks, "권")}</dd></div>
        <div><dt>감상문</dt><dd>{orDash(row.reviewCount, "편")}</dd></div>
        <div><dt>연속 독서</dt><dd>{orDash(row.currentStreak, "일")}</dd></div>
        <div><dt>가장 긴 연속</dt><dd>{orDash(row.longestStreak, "일")}</dd></div>
        <div><dt>받은 과일</dt><dd>{row.fruitCount === null || row.fruitCount === undefined ? "—" : `🍊 ${number(row.fruitCount)}개`}</dd></div>
        <div><dt>뱃지</dt><dd>{known ? `${earned.size} / ${READING_BADGES.length}개` : "—"}</dd></div>
      </dl>
      <Bar percent={p.percent} label="다음 레벨까지 진행률" />
      <h4 className="rlb-modal-sub">뱃지</h4>
      {known ? <ul className="rlb-badge-grid">
        {READING_BADGES.map((b) => <li key={b.id} className={earned.has(b.id) ? "is-earned" : ""}>
          <ReadingBadge badge={b} size={48} earned={earned.has(b.id)} />
          <span>{b.name}<small>{b.tierName} · {b.description}</small></span>
        </li>)}
      </ul> : <p className="reading-help">이 학생이 다음에 독서를 기록하면 뱃지가 이곳에 나타나요(리더보드가 생기기 전의 기록이라 아직 모아 두지 않았어요).</p>}
    </div>
  </div>;
}
