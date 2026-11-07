"use client";

import { useState } from "react";
import Link from "next/link";
import { Empty, asArray, fullDate, stateLabels } from "./DashboardParts";

const filters = [
  ["all", "전체"],
  ["done", "기준 충족"],
  ["doing", "작성 중"],
  ["empty", "미시작"],
  ["waiting", "배정 대기"],
];
const answerText = {
  missing: "아직 적지 않았어요.",
  optional: "없어도 되는 칸이에요.",
  selected: "이 물음을 골랐어요.",
  attached: "그림만 첨부되어 있어요.",
};
const feedbackTypes = new Set(["raft", "opinion", "hashtag"]);

function hasWork(activity) {
  return asArray(activity.sections).some((section) => asArray(section.items).some((item) => (
    item?.state === "written" || item?.state === "selected" || item?.state === "attached"
  )));
}
function anchorId(activity, index) {
  const safe = String(activity?.id || index).replace(/[^A-Za-z0-9_-]/g, "");
  return `bb-act-${safe || index}`;
}
function sectionTone(section) {
  const items = asArray(section.items).filter((item) => item?.state !== "optional");
  const done = items.filter((item) => item?.state === "written" || item?.state === "selected" || item?.state === "attached").length;
  if (!items.length || done === 0) return "empty";
  if (done === items.length) return "filled";
  return "partial";
}

function AnswerList({ items }) {
  return <dl className="bb-report-answers">
    {items.map((item) => <div key={item.id} className={"bb-report-answer is-" + (item.state || "missing")}>
      <dt>{item.label}</dt>
      <dd>
        {item.state === "written" ? <p>{item.text}</p> : <p>{answerText[item.state] || answerText.missing}</p>}
        {item.note && <p className="bb-report-answer-note">{item.note}</p>}
      </dd>
    </div>)}
  </dl>;
}

function ActivityFeedback({ activity, rows }) {
  if (!rows.length && !feedbackTypes.has(activity.type)) return null;
  return <div className="bb-report-feedback">
    <h4>받은 피드백</h4>
    {rows.length ? <ul>
      {rows.map((item) => <li key={item.id}>
        <p className="bb-report-feedback-meta">
          <span className={item.kind === "teacher" ? "is-teacher" : ""}>{item.kind === "teacher" ? "선생님 한마디" : "친구의 피드백"}</span>
          <span>{item.authorName}</span>
          <time dateTime={item.date || undefined}>{fullDate(item.date)}</time>
        </p>
        <p>{item.text}</p>
      </li>)}
    </ul> : <p className="bb-report-feedback-empty">이 기간에 받은 피드백이 없습니다.</p>}
  </div>;
}

export default function StudentActivityReport({ activities, feedback }) {
  const rows = asArray(activities);
  const notes = asArray(feedback);
  const [filter, setFilter] = useState("all");
  const [closed, setClosed] = useState(() => new Set(rows.filter((activity) => !hasWork(activity)).map((activity) => activity.id)));
  const visible = rows.filter((activity) => filter === "all" || activity.state === filter);
  const counts = Object.fromEntries(filters.map(([id]) => [id, id === "all" ? rows.length : rows.filter((activity) => activity.state === id).length]));

  function toggle(id, event) {
    const open = event.currentTarget.open;
    setClosed((current) => {
      const isClosed = current.has(id);
      if ((open && !isClosed) || (!open && isClosed)) return current;
      const next = new Set(current);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return <>
    <div className="bb-report-overview">
      <div className="bb-report-filters" role="group" aria-label="활동 상태">
        {filters.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
          {label}<strong>{counts[id]}</strong>
        </button>)}
      </div>
      <p className="bb-report-filter-status" role="status">{filter === "all" ? `활동 ${counts.all}개를 모두 보여 줍니다.` : `${filters.find(([id]) => id === filter)?.[1]} 활동 ${visible.length}개를 보여 줍니다.`}</p>
      <div className="bb-report-tools">
        <button type="button" onClick={() => setClosed(new Set())}>모두 펼치기</button>
        <button type="button" onClick={() => setClosed(new Set(visible.map((activity) => activity.id)))}>보이는 활동 접기</button>
      </div>
    </div>
    {visible.length > 0 && <nav className="bb-report-jump" aria-label="활동으로 이동">
      {visible.map((activity, index) => <a key={activity.id} href={"#" + anchorId(activity, index)}>{activity.label}<span>{activity.title || "제목 미설정"}</span></a>)}
    </nav>}
    {visible.length ? <div className="bb-report-activity-list">
      {visible.map((activity, index) => {
        const id = anchorId(activity, index);
        const sections = asArray(activity.sections);
        const comments = notes.filter((item) => item.activityId === activity.id);
        const open = !closed.has(activity.id);
        return <details key={activity.id} id={id} className={"bb-report-activity-row is-" + activity.state} open={open} onToggle={(event) => toggle(activity.id, event)}>
          <summary className="bb-report-activity-summary">
            <span className="bb-dash-type">{activity.label}</span>
            <span className="bb-report-activity-title">{activity.title || "제목 미설정"}</span>
            <span className="bb-report-activity-indicators">
              <span className={"bb-dash-state is-" + activity.state}>{activity.labelStatus || stateLabels[activity.state]}</span>
              {activity.locked && <span className="bb-report-activity-lock">잠김</span>}
              <span className="bb-report-activity-chevron" aria-hidden="true" />
            </span>
          </summary>
          <div className="bb-report-activity-body">
            <ul className="bb-report-facts">
              {activity.topic && activity.topic !== activity.title && <li><span>도서·주제</span><strong>{activity.topic}</strong></li>}
              {activity.sourceLabel && <li><span>출처</span><strong>{activity.sourceLabel}</strong></li>}
              {activity.groupName && <li><span>모둠</span><strong>{activity.groupName}</strong></li>}
              {activity.groupProgress && <li><span>모둠 진행</span><strong>{activity.groupProgress}</strong></li>}
              {activity.prompt && <li><span>{activity.type === "hashtag" ? "안내" : "활동 질문"}</span><strong>{activity.prompt}</strong></li>}
            </ul>
            {activity.bookUrl && <p className="bb-report-book-link"><a className="bb-dash-text-link" href={activity.bookUrl} target="_blank" rel="noreferrer">도서 정보 사이트 열기</a></p>}
            {activity.type === "crossword" && activity.groupProgress && <p className="bb-report-aside-note">개인 상태는 맡은 힌트를 기준으로 하고, 모둠이 푼 낱말 수는 따로 보여 줍니다.</p>}
            {activity.type === "consonant" && activity.groupProgress && <p className="bb-report-aside-note">모둠 칸을 채운 정도와 이 학생이 넣은 낱말은 따로 보여 줍니다.</p>}
            {(activity.type === "mindmap" || activity.type === "opinion") && <p className="bb-report-aside-note">이 활동은 완료 기준 없이, 저장된 내용을 그대로 보여 줍니다.</p>}
            {sections.length ? sections.map((part) => {
              const tone = sectionTone(part);
              return <section key={part.id} className={"bb-report-part is-" + tone}>
                <div className="bb-report-part-head">
                  <h4>{part.label}</h4>
                  {tone === "partial" && <span>일부만 적음</span>}
                  {tone === "empty" && <span>아직 비어 있음</span>}
                </div>
                <AnswerList items={asArray(part.items)} />
              </section>;
            }) : <p className="bb-report-activity-empty">{activity.state === "waiting"
              ? `${activity.labelStatus || stateLabels.waiting}입니다. 배정된 뒤에 답을 이 자리에서 볼 수 있습니다.`
              : activity.preview || "표시할 답안이 없습니다."}</p>}
            <ActivityFeedback activity={activity} rows={comments} />
            <Link className="bb-dash-text-link" href={activity.href || "/books"}>원래 활동 열기</Link>
          </div>
        </details>;
      })}
    </div> : <Empty>{rows.length ? "이 상태의 활동이 없습니다." : "아직 이 반에 독서 활동이 없습니다."}</Empty>}
  </>;
}
