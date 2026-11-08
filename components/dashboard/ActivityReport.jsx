"use client";

import { useId, useState } from "react";
import Link from "next/link";
import ActivityReportContent from "./ActivityReportContent";
import { stateLabels } from "./DashboardParts";
import "./ActivityReport.css";

const ACTIVITY_ORDER = ["consonant", "paratext", "raft", "kwls", "mindmap", "opinion", "hashtag", "qmark", "crossword", "brainwrite", "bingo"];
const array = (value) => Array.isArray(value) ? value : [];
const number = (value) => String(value + 1).padStart(2, "0");

function updatedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) : "";
}

export default function ActivityReport({ activities = [], subject, classroom }) {
  const id = useId();
  const scopeKey = `${classroom?.id || ""}:${subject?.uid || ""}`;
  const ordered = array(activities).map((activity, index) => ({ activity, index })).sort((a, b) => {
    const first = ACTIVITY_ORDER.indexOf(a.activity.type);
    const second = ACTIVITY_ORDER.indexOf(b.activity.type);
    return (first < 0 ? ACTIVITY_ORDER.length : first) - (second < 0 ? ACTIVITY_ORDER.length : second) || a.index - b.index;
  }).map(({ activity }) => activity);
  const participated = ordered.filter((activity) => activity.state === "doing" || activity.state === "done");
  const pending = ordered.filter((activity) => activity.state !== "doing" && activity.state !== "done");
  const anchor = (index) => `${id}-activity-${index}`;
  const topics = [...new Set(participated.map((activity) => activity.report?.topic).filter(Boolean))];
  // 분량이 많아 활동마다 탭으로 하나씩 보고, '모아 보기'로 전체를 한 번에 봅니다(선생님 요청).
  // view: 고른 활동 id 또는 "all". 고른 활동이 목록에서 빠지면 첫 활동으로.
  const [view, setView] = useState(null);
  const showAll = view === "all";
  const current = showAll ? null : participated.find((a) => a.id === view) || participated[0] || null;
  const shown = showAll ? participated : current ? [current] : [];
  const indexOf = (activity) => participated.indexOf(activity);

  function moveToActivity(event, index) {
    const section = document.getElementById(anchor(index));
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: "instant", block: "start" });
    section.focus({ preventScroll: true });
  }

  return <section className="bb-activity-report" aria-labelledby={`${id}-title`}>
    <header className="bb-ar-header">
      <div className="bb-ar-title-row">
        <div><span className="bb-ar-eyebrow">학생의 독서 활동 기록</span><h2 id={`${id}-title`}>활동 보고서</h2></div>
        <span className="bb-ar-participation">참여한 활동 <strong>{participated.length}개</strong></span>
      </div>
      <dl className="bb-ar-metadata">
        <div><dt>학생</dt><dd>{subject?.name || "학생"}</dd></div>
        {subject?.studentId && <div><dt>학번</dt><dd>{subject.studentId}</dd></div>}
        {classroom?.name && <div><dt>학급</dt><dd>{classroom.name}</dd></div>}
        {topics.length === 1 && <div className="bb-ar-book"><dt>도서·주제</dt><dd>{topics[0]}</dd></div>}
      </dl>
      <p className="bb-ar-context">선택한 반에서 현재 저장된 활동 내용을 보여줍니다. 위의 조회 기간은 독서 통계에 적용됩니다.</p>
    </header>

    {participated.length > 0 && <div className="bb-ar-tabbar">
      <div className="bb-ar-tabs" role="tablist" aria-label="참여한 활동">
        {participated.map((activity, index) => <button key={activity.id} type="button" role="tab"
          aria-selected={!showAll && current?.id === activity.id} className={`bb-ar-tab${!showAll && current?.id === activity.id ? " on" : ""}`}
          title={activity.title || activity.label} onClick={() => setView(activity.id)}>
          <span className="bb-ar-tab-no" aria-hidden="true">{number(index)}</span>
          <span className="bb-ar-tab-text"><strong>{activity.label}</strong><small>{activity.title || "제목 미설정"}</small></span>
        </button>)}
      </div>
      <button type="button" className={`bb-ar-all${showAll ? " on" : ""}`} aria-pressed={showAll} onClick={() => setView(showAll ? null : "all")}>
        {showAll ? "하나씩 보기" : `모아 보기 (${participated.length})`}
      </button>
    </div>}

    {participated.length ? <div className={`bb-ar-layout${showAll ? "" : " is-single"}`}>
      {showAll && <nav className="bb-ar-index" aria-label="활동 보고서 목차">
        <h3>참여한 활동</h3>
        <ol>{participated.map((activity, index) => <li key={activity.id}>
          <a href={`#${anchor(index)}`} onClick={(event) => moveToActivity(event, index)}>
            <span className="bb-ar-index-number" aria-hidden="true">{number(index)}</span>
            <span><strong>{activity.label}</strong><small>{activity.title || "제목 미설정"}</small></span>
          </a>
        </li>)}</ol>
      </nav>}
      <div className="bb-ar-activities">
        {shown.map((activity) => { const index = indexOf(activity); return <article id={anchor(index)} key={activity.id} className="bb-ar-activity" tabIndex={-1} aria-labelledby={`${anchor(index)}-title`}>
          <header className="bb-ar-activity-head">
            <div className="bb-ar-activity-title">
              <span className="bb-ar-number" aria-hidden="true">{number(index)}</span>
              <div><span className="bb-ar-kind">{activity.label}</span><h3 id={`${anchor(index)}-title`}>{activity.title || activity.label}</h3></div>
            </div>
            <span className={`bb-ar-state is-${activity.state}`}>{activity.labelStatus || stateLabels[activity.state] || "작성 중"}</span>
          </header>
          <div className="bb-ar-activity-meta">
            <span>{activity.report?.grouped ? "모둠 활동" : "개인 활동"}</span>
            {activity.report?.groupName && <span>{activity.report.groupName}</span>}
            {activity.report?.topic && <span className="bb-ar-topic">{activity.report.topic}</span>}
            {updatedDate(activity.report?.updatedAt) && <span>마지막 작성 {updatedDate(activity.report.updatedAt)}</span>}
          </div>
          <ActivityReportContent activity={activity} studentName={subject?.name || "학생"} scopeKey={scopeKey} />
          <footer className="bb-ar-activity-foot"><Link href={activity.href} className="bb-ar-original-link">원래 활동 열기 <span aria-hidden="true">→</span></Link></footer>
        </article>; })}
      </div>
    </div> : <div className="bb-ar-empty">
      <h3>{ordered.length ? "아직 참여한 활동이 없습니다" : "아직 등록된 활동이 없습니다"}</h3>
      <p>{ordered.length ? "학생이 활동 내용을 작성하면 이곳에 문항별 기록과 결과물이 모입니다." : "이 반에 독서 활동을 만들면 학생의 참여 기록을 확인할 수 있습니다."}</p>
    </div>}

    {pending.length > 0 && <details className="bb-ar-pending">
      <summary>미시작·배정 대기 활동 <span>{pending.length}개</span></summary>
      <p>아직 작성한 내용이 없거나 모둠·담당 배정을 기다리는 활동입니다.</p>
      <ul>{pending.map((activity) => <li key={activity.id}>
        <div><span>{activity.label}</span><strong>{activity.title || "제목 미설정"}</strong></div>
        <span className="bb-ar-pending-status">{activity.labelStatus || stateLabels[activity.state] || "미시작"}</span>
        <Link href={activity.href}>활동 열기 <span aria-hidden="true">→</span></Link>
      </li>)}</ul>
    </details>}
  </section>;
}
