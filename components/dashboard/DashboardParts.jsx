"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import ReadingBadge from "@/components/reading/ReadingBadge";
import { saveDashboardSemester } from "@/lib/data/dashboard";

export const fmt = (value) => Number(value || 0).toLocaleString("ko-KR");
const shortDate = (date) => date ? date.slice(5).replace("-", ". ") : "날짜 미상";
export const fullDate = (date) => date ? date.replaceAll("-", ". ") : "작성일 미상";
export const stateLabels = { empty: "미시작", doing: "작성 중", done: "기준 충족", waiting: "배정 대기" };
const kwlsLabels = [["know", "K", "이미 알고 있던 것"], ["want", "W", "알고 싶었던 것"], ["learned", "L", "새로 알게 된 것"], ["still", "S", "더 알고 싶은 것"]];
export const asArray = (value) => Array.isArray(value) ? value : [];
export const libraryHref = (id) => "/books?area=reading" + (id ? "&book=" + encodeURIComponent(id) : "");

export function Empty({ children, compact = false }) {
  return <p className={"bb-dash-empty" + (compact ? " is-compact" : "")}>{children}</p>;
}

export function Section({ title, note, action, className = "", children, id }) {
  return <section className={"bb-dash-section " + className} id={id}>
    <div className="bb-dash-section-head"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{action}</div>
    {children}
  </section>;
}

export function Dialog({ title, onClose, children }) {
  const titleId = useId();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    node?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const controls = [...(node?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || [])].filter((element) => element.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="modal-backdrop bb-dash-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="bb-dash-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="bb-dash-icon-button" aria-label="닫기" onClick={onClose}>×</button></header>
      {children}
    </section>
  </div>;
}

export function Metric({ label, value, unit, hint, previous }) {
  const delta = previous == null ? null : Number(value || 0) - Number(previous || 0);
  return <div className="bb-dash-metric">
    <span>{label}</span><strong>{fmt(value)}{unit && <small>{unit}</small>}</strong>
    {hint && <p>{hint}</p>}{delta !== null && <p className={delta > 0 ? "bb-dash-delta is-up" : "bb-dash-delta"}>비교 기간보다 {delta > 0 ? "+" : ""}{fmt(delta)}{unit}</p>}
  </div>;
}

export function Snapshot({ activity, onSelectStudent, showStudents = true }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = asArray(activity?.rows);
  const filtered = rows.filter((row) => (filter === "all" || row.state === filter) && (!query.trim() || (String(row.name) + " " + String(row.studentId)).toLowerCase().includes(query.trim().toLowerCase())));
  const total = rows.length || 1;
  const segments = ["done", "doing", "empty", "waiting"].map((state) => ({ state, count: rows.filter((row) => row.state === state).length }));
  return <Section title="활동 진행 현황" note="현재 저장된 내용으로 확인합니다. 위에서 선택한 기간의 과거 진행률을 뜻하지 않습니다."
    action={activity && <Link className="bb-dash-text-link" href={activity.href}>활동 화면 열기 →</Link>}>
    {!activity ? <Empty>아직 독서 활동이 없습니다. 책방에서 첫 활동을 만들어 보세요.</Empty> : <>
      <div className="bb-dash-snapshot-title"><div><span className="bb-dash-type">{activity.label}</span><h3>{activity.title}</h3></div>
        <span className="bb-dash-scope">현재 진행</span></div>
      <div className="bb-dash-progress-stack" aria-label="학생별 작성 상태">
        {segments.filter((item) => item.count).map((item) => <span key={item.state} className={"is-" + item.state} style={{ width: item.count / total * 100 + "%" }} title={stateLabels[item.state] + " " + item.count + "명"} />)}
      </div>
      <div className="bb-dash-legend">{segments.map((item) => <span key={item.state}><i className={"is-" + item.state} />{stateLabels[item.state]} <b>{item.count}</b></span>)}</div>
      {showStudents && <><div className="bb-dash-table-tools"><label className="bb-dash-search"><span className="sr-only">학생 이름 또는 학번 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 학번 검색" /></label>
        <select aria-label="학생 진행 상태" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">모든 상태</option>{Object.entries(stateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <span>{filtered.length}명</span></div>
      <div className="bb-dash-table-scroll"><table className="bb-dash-table"><caption className="sr-only">{activity.title} 학생별 현재 진행 현황</caption><thead><tr><th scope="col">학생</th><th scope="col">상태</th><th scope="col">작성 현황</th><th scope="col">모둠</th><th scope="col"><span className="sr-only">상세</span></th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.uid}><th scope="row"><span className="bb-dash-student-id">{row.studentId || "—"}</span><button type="button" className="bb-dash-name-button" onClick={() => onSelectStudent(row.uid)}>{row.name}</button></th>
          <td><span className={"bb-dash-state is-" + row.state}>{stateLabels[row.state] || row.label}</span></td>
          <td><span>{row.label || (row.total == null ? fmt(row.filled) + "개 기록" : fmt(row.filled) + " / " + fmt(row.total))}</span>{row.groupProgress && <small className="bb-dash-table-sub">모둠: {row.groupProgress}</small>}</td>
          <td>{row.groupName || "개인 활동"}</td><td><button type="button" className="bb-dash-small-button" aria-label={(row.studentId || "") + " " + row.name + " 기록 보기"} onClick={() => onSelectStudent(row.uid)}>살펴보기</button></td></tr>)}</tbody></table></div>
      {!filtered.length && <Empty compact>조건에 맞는 학생이 없습니다.</Empty>}</>}
      {!activity.completionSupported && <p className="bb-dash-footnote">이 활동은 참여한 내용과 기여를 살펴봅니다. 개인의 완료율은 표시하지 않습니다.</p>}
      {activity.type === "crossword" && <p className="bb-dash-footnote">개인의 기준 충족은 맡은 힌트 작성을 뜻합니다. 모둠의 낱말 풀이 진행은 별도로 표시합니다.</p>}
      {activity.waiting > 0 && <p className="bb-dash-footnote">모둠 배정 대기 {activity.waiting}명은 참여 대상 인원에서 제외합니다.</p>}
    </>}
  </Section>;
}

export function ReflectionAnswers({ answers }) {
  return <dl className="bb-dash-kwls-answers">{kwlsLabels.map(([key, letter, label]) => <div key={key}><dt><b>{letter}</b>{label}</dt><dd>{answers?.[key] || <span className="bb-dash-muted">아직 기록하지 않았어요.</span>}</dd></div>)}</dl>;
}

export function Reflections({ data, teacher, countUnit = teacher ? "명" : "건" }) {
  const records = asArray(data?.records);
  return <Section title={teacher ? "생각의 기록 · KWLS" : "나의 생각 모음 · KWLS"} note="처음 기록한 날짜로 기간을 나누며, 내용은 현재 저장된 기록을 보여줍니다.">
    <div className="bb-dash-kwls-counts">{kwlsLabels.map(([key, letter, label]) => <div key={key}><b>{letter}</b><span>{label}</span><strong>{fmt(data?.counts?.[key])}<small>{countUnit}</small></strong></div>)}</div>
    {records.length ? <div className="bb-dash-record-list">{records.map((record) => <details className="bb-dash-record" key={record.id}><summary><span>{teacher && <b>{record.studentId} {record.name}</b>}<strong>{record.activityTitle || "KWLS로 성찰하기"}</strong><small>{fullDate(record.date)}</small></span><span className="bb-dash-record-caret" aria-hidden="true">⌄</span></summary>
      <ReflectionAnswers answers={record.answers} /><Link className="bb-dash-text-link" href={record.href}>원래 활동 열기 →</Link></details>)}</div> : <Empty>이 기간에 처음 작성한 KWLS 기록이 없습니다.</Empty>}
    {records.some((record) => !record.date) && <p className="bb-dash-footnote">작성일을 알 수 없는 이전 기록은 날짜별 집계에 포함하지 않습니다.</p>}
  </Section>;
}

export function Feedback({ rows, teacher, note }) {
  return <Section title={teacher ? "함께 나눈 피드백" : "내가 받은 피드백"} note={note || (teacher ? "선택한 활동에서 실제로 주고받은 답글과 동료평가입니다." : "선생님과 친구가 남긴 말을 원래 활동에서 다시 살펴보세요.")}>
    {rows.length ? <div className="bb-dash-feedback-list">{rows.map((item) => <article key={item.id} className="bb-dash-feedback"><div><span className={"bb-dash-feedback-kind" + (item.kind === "teacher" ? " is-teacher" : "")}>{item.kind === "teacher" ? "선생님 한마디" : "친구의 피드백"}</span><time>{shortDate(item.date)}</time></div>
      <h3>{teacher && item.name ? item.name + " · " : ""}{item.activityTitle}</h3><p>{item.text}</p><Link className="bb-dash-text-link" href={item.href}>활동에서 보기 →</Link></article>)}</div> : <Empty>아직 표시할 피드백이 없습니다.</Empty>}
  </Section>;
}

export function WeeklyChart({ rows, daily = false }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.pages || 0)));
  return <figure className="bb-dash-weekly"><figcaption>{daily ? "날짜별 읽은 쪽수" : "주별 읽은 쪽수"}</figcaption>
    {rows.length ? <><div className="bb-dash-chart-scroll"><div className="bb-dash-bars" style={{ gridTemplateColumns: "repeat(" + rows.length + ", minmax(44px, 1fr))" }}>
      {rows.map((row) => <div className="bb-dash-bar-col" key={row.start || row.date}><span>{fmt(row.pages)}</span><div className="bb-dash-bar-track"><i style={{ height: Number(row.pages || 0) / max * 100 + "%" }} /></div><span className="bb-dash-bar-label">{shortDate(row.start || row.date)}</span></div>)}
    </div></div><p className="bb-dash-footnote">{daily ? "각 날짜에 읽었다고 기록한 쪽수입니다." : "막대 아래는 주 시작일입니다. 선택 기간에 해당하는 날짜만 합산합니다."}</p></> : <Empty compact>표시할 독서 기록이 없습니다.</Empty>}
  </figure>;
}

export function TeacherReading({ reading, onSelectStudent, showStudents = true }) {
  const days = asArray(reading.daily);
  const dailyChart = days.length > 0 && days.length <= 7;
  return <>
    <div className="bb-dash-two-columns">
      <Section title="우리 반 독서 흐름"><div className="bb-dash-reading-totals"><span>읽은 도서 <strong>{fmt(reading.summary?.books)}종</strong></span><span>완독 기록 <strong>{fmt(reading.summary?.completed)}건</strong></span><span>감상문 <strong>{fmt(reading.summary?.reviews)}건</strong></span></div><WeeklyChart rows={dailyChart ? days : asArray(reading.weekly)} daily={dailyChart} /></Section>
      <Section title="우리 반이 읽은 책" note="이 반에서 선택 기간에 독서 기록을 남긴 도서입니다.">
        {asArray(reading.books).length ? <div className="bb-dash-book-list">{reading.books.map((book) => <article key={book.key}><span className="bb-dash-book-mark" aria-hidden="true">▤</span><div><h3>{book.title}</h3><p>{book.author}</p></div><span><strong>{fmt(book.readers)}명</strong><small>{fmt(book.pages)}쪽</small></span></article>)}</div> : <Empty>아직 이 기간에 기록한 도서가 없습니다.</Empty>}
      </Section>
    </div>
    {showStudents && <Section title="학생별 독서 기록" note="선택한 반과 기간에 속하는 독서 기록만 합산합니다.">
      <div className="bb-dash-table-scroll"><table className="bb-dash-table"><caption className="sr-only">선택 기간 학생별 독서 기록</caption><thead><tr><th scope="col">학생</th><th scope="col">읽은 쪽수</th><th scope="col">독서한 날짜</th><th scope="col">완독 기록</th><th scope="col">감상문</th></tr></thead><tbody>{asArray(reading.members).map((row) => <tr key={row.uid}><th scope="row"><span className="bb-dash-student-id">{row.studentId || "—"}</span><button className="bb-dash-name-button" type="button" onClick={() => onSelectStudent(row.uid)}>{row.name}</button></th><td>{fmt(row.pages)}쪽</td><td>{fmt(row.days)}일</td><td>{fmt(row.completed)}건</td><td>{fmt(row.reviews)}건</td></tr>)}</tbody></table></div>
      {!asArray(reading.members).length && <Empty compact>이 반에 소속된 학생이 없습니다.</Empty>}
    </Section>}
  </>;
}

export function Calendar({ days, onSelectDay }) {
  const first = days[0]?.date;
  const weekday = first ? (new Date(first + "T12:00:00+09:00").getUTCDay() + 6) % 7 : 0;
  return <Section title="나의 독서 달력" note="기록을 입력한 시각이 아니라, 내가 적은 독서 날짜를 기준으로 보여줍니다.">
    {days.length ? <><div className="bb-dash-calendar" role="group" aria-label="날짜별 독서 기록">
      {["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day} className="bb-dash-calendar-weekday">{day}</span>)}
      {Array.from({ length: weekday }, (_, index) => <span key={"blank-" + index} aria-hidden="true" />)}
      {days.map((day, index) => <button type="button" key={day.date} className={"bb-dash-calendar-day level-" + (day.pages > 40 ? "3" : day.pages > 20 ? "2" : day.pages > 0 ? "1" : "0")} aria-label={fullDate(day.date) + " · " + fmt(day.pages) + "쪽"} onClick={() => onSelectDay(day)}>
        <span>{day.date.slice(8) === "01" || index === 0 ? Number(day.date.slice(5, 7)) + "/" + Number(day.date.slice(8)) : Number(day.date.slice(8))}</span><b>{day.pages ? fmt(day.pages) : "—"}</b></button>)}
    </div><div className="bb-dash-calendar-legend"><span><i className="level-0" />0쪽</span><span><i className="level-1" />1~20쪽</span><span><i className="level-2" />21~40쪽</span><span><i className="level-3" />41쪽 이상</span></div></> : <Empty>이 기간에 표시할 날짜가 없습니다.</Empty>}
  </Section>;
}

export function NextActions({ activities, personal }) {
  const pending = activities.filter((activity) => !activity.locked && (activity.state === "empty" || (activity.state === "doing" && activity.total != null))).slice(0, 4);
  const books = asArray(personal?.library).filter((book) => !book.archived && book.status !== "completed").slice(0, 3);
  const reviews = asArray(personal?.library).filter((book) => !book.archived && book.status === "completed" && book.hasReview === false).slice(0, 2);
  return <Section title="이어서 해 볼 일">
    {(books.length > 0 || reviews.length > 0) && <div className="bb-dash-next-books">{books.map((book) => <article key={book.id}><div><span>{book.status === "paused" ? "잠시 멈춘 책" : "읽던 책"}</span><h3>{book.title}</h3><p>{fmt(book.pagesRead)} / {fmt(book.totalPages)}쪽</p></div><Link className="bb-dash-small-button" href={libraryHref(book.id)}>{book.status === "paused" ? "살펴보기 →" : "이어 읽기 →"}</Link></article>)}{reviews.map((book) => <article key={book.id}><div><span>완독한 책</span><h3>{book.title}</h3><p>책을 읽고 남은 생각을 기록해 보세요.</p></div><Link className="bb-dash-small-button" href={libraryHref(book.id)}>감상 남기기 →</Link></article>)}</div>}
    {pending.length > 0 && <div className="bb-dash-action-list">{pending.map((activity) => <Link key={activity.id} href={activity.href}><span><small>{activity.label}</small><strong>{activity.title}</strong></span><span>{activity.labelStatus || stateLabels[activity.state]} <b aria-hidden="true">→</b></span></Link>)}</div>}
    {!books.length && !reviews.length && !pending.length && <Empty>이어 쓸 활동이 없습니다. 새로운 책이나 활동을 만나 보세요.</Empty>}
    {activities.some((activity) => activity.state === "waiting") && <p className="bb-dash-footnote">모둠 배정 대기인 활동은 선생님의 안내를 기다려 주세요.</p>}
  </Section>;
}

export function PersonalGrowth({ personal }) {
  return <Section title="나의 누적 성장" note="이 영역의 레벨과 뱃지는 여러 반에서 이어 온 개인 누적 기록입니다." action={<Link className="bb-dash-text-link" href="/books?area=reading&tab=growth">성장·뱃지 모두 보기 →</Link>}>
    <div className="bb-dash-personal-level"><div><span>독서 레벨</span><strong>Lv. {fmt(personal.level)}</strong></div><div className="bb-dash-level-track"><div className="bb-dash-level-label"><span>{fmt(personal.xp)} EXP</span><span>다음 레벨까지 {fmt(personal.expToNextLevel)} EXP</span></div><div className="bb-dash-level-bar" role="progressbar" aria-label="다음 독서 레벨까지" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, Math.round(personal.progress || 0)))}><i style={{ width: Math.min(100, Math.max(0, personal.progress || 0)) + "%" }} /></div></div></div>
    <div className="bb-dash-growth-facts"><span>누적 완독 <strong>{fmt(personal.totalBooks)}권</strong></span><span>현재 연속 독서 <strong>{fmt(personal.currentStreak)}일</strong></span><span>최장 연속 독서 <strong>{fmt(personal.longestStreak)}일</strong></span></div>
    {asArray(personal.nextBadges).length > 0 ? <div className="bb-dash-next-badges">{personal.nextBadges.map((badge) => <article key={badge.id}><ReadingBadge badge={badge} earned={false} size={60} /><div><h3>{badge.label || badge.name}</h3><p>{badge.description}</p><span>{fmt(badge.current)} / {fmt(badge.threshold)}</span><div className="bb-dash-badge-track"><i style={{ width: Math.min(100, Math.max(0, badge.progress || 0)) + "%" }} /></div></div></article>)}</div> : <Empty compact>모든 뱃지를 달성했어요. 나의 독서 기록을 계속 이어가 보세요.</Empty>}
  </Section>;
}

export function StudentPortfolio({ activities, title = "나의 독서 활동 모음" }) {
  return <Section title={title} note="진행 상태는 현재 저장된 내용을 기준으로 합니다.">
    {activities.length ? <div className="bb-dash-portfolio">{activities.map((activity) => <article key={activity.id}><div><span className="bb-dash-type">{activity.label}</span><span className={"bb-dash-state is-" + activity.state}>{activity.labelStatus || stateLabels[activity.state]}</span></div><h3>{activity.title}</h3>{activity.preview && <p>{activity.preview}</p>}<Link className="bb-dash-text-link" href={activity.href}>활동 열기 →</Link></article>)}</div> : <Empty>아직 이 반에 독서 활동이 없습니다.</Empty>}
  </Section>;
}

export function SemesterDialog({ classId, className, start, end, onSaved, onClose }) {
  const [first, setFirst] = useState(start || "");
  const [last, setLast] = useState(end || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await saveDashboardSemester({ classId, start: first, end: last });
      if (alive.current) onSaved();
    } catch (failure) { if (alive.current) setError(failure?.message || "학기 기간을 저장하지 못했습니다."); }
    finally { if (alive.current) setBusy(false); }
  }
  return <Dialog title="학기 기간 설정" onClose={() => { if (!busy) onClose(); }}><form onSubmit={save} className="bb-dash-semester-form"><p><strong>{className}</strong>의 ‘이번 학기’ 집계 기간을 정합니다.</p><label>학기 시작일<input type="date" required value={first} max={last || undefined} onChange={(event) => setFirst(event.target.value)} /></label><label>학기 종료일<input type="date" required min={first || undefined} value={last} onChange={(event) => setLast(event.target.value)} /></label><p className="bb-dash-footnote">현재까지의 기록만 집계합니다. 교사만 이 반의 학기 기간을 바꿀 수 있습니다.</p>{error && <p className="bb-dash-error" role="alert">{error}</p>}<div className="bb-dash-dialog-actions"><button type="button" className="bb-dash-secondary" disabled={busy} onClick={onClose}>취소</button><button type="submit" className="bb-dash-primary" disabled={busy || !first || !last}>{busy ? "저장 중…" : "학기 기간 저장"}</button></div></form></Dialog>;
}

