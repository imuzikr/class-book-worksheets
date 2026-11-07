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
const shownStates = new Set(["written", "selected", "attached"]);
const answerText = {
  selected: "이 물음을 골랐어요.",
  attached: "그림만 첨부되어 있어요.",
};

function hasWork(activity) {
  return asArray(activity.sections).some((section) => asArray(section.items).some((item) => shownStates.has(item?.state)));
}
function anchorId(activity, index) {
  const safe = String(activity?.id || index).replace(/[^A-Za-z0-9_-]/g, "");
  return `bb-act-${safe || index}`;
}
function contextLine(activity) {
  return [
    activity.topic && activity.topic !== activity.title ? activity.topic : "",
    activity.sourceLabel,
    activity.groupName ? `모둠 ${activity.groupName}` : "",
    activity.groupProgress,
  ].filter(Boolean);
}

function AnswerBlocks({ items }) {
  const list = asArray(items);
  const shown = list.filter((item) => shownStates.has(item?.state));
  const blank = list.filter((item) => item?.state === "missing").map((item) => item.label).filter(Boolean);
  if (!shown.length && !blank.length) return <p className="bb-report-blank">이 부분은 아직 적지 않았습니다.</p>;
  return <>
    {shown.map((item) => <div key={item.id} className="bb-report-qa">
      <p className="bb-report-q">{item.label}</p>
      <p className="bb-report-a">{item.state === "written" ? item.text : answerText[item.state]}</p>
      {item.note && <p className="bb-report-note">{item.note}</p>}
    </div>)}
    {!shown.length && <p className="bb-report-blank">이 부분은 아직 적지 않았습니다.</p>}
    {shown.length > 0 && blank.length > 0 && <p className="bb-report-blank">아직 비어 있는 칸: {blank.join(", ")}</p>}
  </>;
}

function ActivityFeedback({ rows }) {
  if (!rows.length) return null;
  return <section className="bb-report-feedback">
    <h4>받은 피드백</h4>
    {rows.map((item) => <div key={item.id} className="bb-report-qa">
      <p className="bb-report-q">{item.kind === "teacher" ? "선생님 한마디" : "친구의 피드백"} · {item.authorName} · <time dateTime={item.date || undefined}>{fullDate(item.date)}</time></p>
      <p className="bb-report-a">{item.text}</p>
    </div>)}
  </section>;
}

function ActivityArticle({ activity, comments, index }) {
  const id = anchorId(activity, index);
  const sections = asArray(activity.sections);
  const status = activity.labelStatus || stateLabels[activity.state] || "";
  const facts = contextLine(activity);
  const note = activity.type === "crossword" && activity.groupProgress
    ? "개인 상태는 맡은 힌트이고, 모둠이 푼 낱말 수는 따로입니다."
    : activity.type === "consonant" && activity.groupProgress
      ? "모둠 칸을 채운 정도와 이 학생이 넣은 낱말은 따로입니다."
      : activity.type === "mindmap" || activity.type === "opinion"
        ? "완료 기준 없이, 저장된 내용을 그대로 적습니다."
        : "";

  if (!hasWork(activity)) {
    return <details className="bb-report-activity is-quiet" id={id}>
      <summary>
        <span className="bb-report-activity-index" aria-hidden="true">{index + 1}</span>
        <span className="bb-report-activity-quiet-title"><small>{activity.label}</small><strong>{activity.title || "제목 미설정"}</strong></span>
        <em>{activity.state === "waiting" ? status : "아직 제출한 답이 없습니다"}</em>
      </summary>
      <div className="bb-report-prose">
        <p className="bb-report-blank">{activity.state === "waiting"
          ? `${status}입니다. 배정된 뒤에 답을 이 자리에서 볼 수 있습니다.`
          : "저장된 답이 없습니다."}</p>
        <Link className="bb-report-activity-link" href={activity.href || "/books"}>원래 활동 열기</Link>
      </div>
    </details>;
  }

  return <article className={"bb-report-activity is-" + activity.state} id={id} aria-labelledby={id + "-title"}>
    <header className="bb-report-activity-head">
      <p className="bb-report-kicker"><span className="bb-report-activity-index">{index + 1}</span>{activity.label}<em>{status}</em>{activity.locked && <em>잠김</em>}</p>
      <h3 id={id + "-title"}>{activity.title || "제목 미설정"}</h3>
      {facts.length > 0 && <p className="bb-report-meta">{facts.join(" · ")}</p>}
      {activity.bookUrl && <p className="bb-report-meta"><a href={activity.bookUrl} target="_blank" rel="noreferrer">도서 정보 사이트</a></p>}
      {note && <p className="bb-report-meta">{note}</p>}
    </header>
    <div className="bb-report-prose">
      {activity.prompt && <div className="bb-report-qa">
        <p className="bb-report-q">{activity.type === "hashtag" ? "안내" : "활동 질문"}</p>
        <p className="bb-report-a">{activity.prompt}</p>
      </div>}
      {sections.length ? sections.map((part) => <section key={part.id} className="bb-report-part">
        <h4>{part.label}</h4>
        <AnswerBlocks items={part.items} />
      </section>) : <p className="bb-report-blank">{activity.preview || "표시할 답안이 없습니다."}</p>}
      <ActivityFeedback rows={comments} />
      <p className="bb-report-activity-link-row"><Link className="bb-report-activity-link" href={activity.href || "/books"}>원래 활동 열기</Link></p>
    </div>
  </article>;
}

export default function StudentActivityReport({ activities, feedback }) {
  const rows = asArray(activities);
  const notes = asArray(feedback);
  const [filter, setFilter] = useState("all");
  const visible = rows.filter((activity) => filter === "all" || activity.state === filter);
  const counts = Object.fromEntries(filters.map(([id]) => [id, id === "all" ? rows.length : rows.filter((activity) => activity.state === id).length]));
  const summary = [
    ["done", "기준 충족"],
    ["doing", "작성 중"],
    ["empty", "미시작"],
    ["waiting", "배정 대기"],
  ].filter(([id]) => counts[id] > 0).map(([id, label]) => `${label} ${counts[id]}`).join(", ");

  return <div className="bb-report-sheet">
    <div className="bb-report-overview">
      <p>활동 {counts.all}개{summary ? ` 가운데 ${summary}` : ""}입니다. 답은 지금 저장된 글이고, 피드백은 선택한 기간의 기록입니다.</p>
      <label>모아 보기
        <select aria-label="활동 상태" value={filter} onChange={(event) => setFilter(event.target.value)}>
          {filters.map(([id, label]) => <option key={id} value={id}>{label} {counts[id]}</option>)}
        </select>
      </label>
    </div>
    {visible.length > 0 && <nav className="bb-report-toc" aria-label="활동 목차">
      <h3>목차</h3>
      <ol>
        {visible.map((activity) => <li key={activity.id}>
          <a href={"#" + anchorId(activity, rows.indexOf(activity))}>
            <span>{activity.label}</span>
            {activity.title || "제목 미설정"}
          </a>
        </li>)}
      </ol>
    </nav>}
    {visible.length ? <div className="bb-report-activities">
      {visible.map((activity) => <ActivityArticle key={activity.id} activity={activity} comments={notes.filter((item) => item.activityId === activity.id)} index={rows.indexOf(activity)} />)}
    </div> : <Empty>{rows.length ? "이 상태의 활동이 없습니다." : "아직 이 반에 독서 활동이 없습니다."}</Empty>}
  </div>;
}
