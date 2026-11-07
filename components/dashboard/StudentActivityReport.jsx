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
const answerText = { selected: "선택", attached: "그림 첨부" };
const EXCERPT = 150;

function hasWork(activity) {
  return asArray(activity.sections).some((section) => asArray(section.items).some((item) => shownStates.has(item?.state)));
}
function anchorId(activity, index) {
  const safe = String(activity?.id || index).replace(/[^A-Za-z0-9_-]/g, "");
  return `bb-act-${safe || index}`;
}
function clip(text) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT) return "";
  const slice = flat.slice(0, EXCERPT);
  const sentence = slice.match(/^[\s\S]{70,}?[.!?。](?=\s|$)/);
  const cut = sentence ? sentence[0] : (slice.slice(0, slice.lastIndexOf(" ") > 90 ? slice.lastIndexOf(" ") : EXCERPT));
  return cut.trim() + "…";
}
function isWide(activity) {
  return asArray(activity.sections).some((section) => asArray(section.items).some((item) => item?.state === "written" && String(item.text || "").length > 320));
}

function AnswerValue({ item }) {
  const full = item.state === "written" ? item.text : answerText[item.state] || "";
  const excerpt = item.state === "written" ? clip(item.text) : "";
  if (!excerpt) return <span>{full}{item.note ? <small className="bb-sheet-note">{item.note}</small> : null}</span>;
  return <details className="bb-sheet-more">
    <summary>
      <span className="bb-sheet-excerpt">{excerpt}</span>
      <span className="bb-sheet-toggle">전체</span>
    </summary>
    <span className="bb-sheet-full">{full}{item.note ? <small className="bb-sheet-note">{item.note}</small> : null}</span>
  </details>;
}

function ActivityCard({ activity, comments, index }) {
  const id = anchorId(activity, index);
  const status = [activity.labelStatus || stateLabels[activity.state] || "", activity.locked ? "잠김" : ""].filter(Boolean).join(" · ");
  const meta = [
    activity.topic && activity.topic !== activity.title ? activity.topic : "",
    activity.sourceLabel,
    activity.groupName,
    activity.groupProgress,
  ].filter(Boolean).join(" · ");
  const blanks = [];
  const filled = asArray(activity.sections).map((section) => {
    const items = asArray(section.items).filter((item) => shownStates.has(item?.state));
    asArray(section.items).forEach((item) => { if (item?.state === "missing" && item.label) blanks.push(item.label); });
    return items.length ? { ...section, items } : null;
  }).filter(Boolean);

  return <article id={id} className={"bb-sheet-card" + (isWide(activity) ? " is-wide" : "") + (!hasWork(activity) ? " is-empty" : "")}>
    <header>
      <p className="bb-sheet-kicker">
        <span>{index + 1}. {activity.label}</span>
        <em>{status}</em>
        <Link href={activity.href || "/books"}>열기</Link>
      </p>
      <h3>{activity.title || "제목 미설정"}</h3>
      {meta && <p className="bb-sheet-meta">{meta}</p>}
    </header>
    {(activity.prompt || filled.length > 0) && <div className="bb-sheet-fields">
      {activity.prompt && <div className={"bb-sheet-row" + (activity.prompt.length > 18 ? " is-long" : "")}>
        <span className="bb-sheet-q">{activity.type === "hashtag" ? "안내" : "질문"}</span>
        <div className="bb-sheet-a"><AnswerValue item={{ state: "written", text: activity.prompt }} /></div>
      </div>}
      {filled.map((section) => <div key={section.id} className="bb-sheet-group">
        <p className="bb-sheet-part">{section.label}</p>
        {section.items.map((item) => <div key={item.id} className={"bb-sheet-row" + ((item.label || "").length > 12 ? " is-long" : "")}>
          <span className="bb-sheet-q">{item.label}</span>
          <div className="bb-sheet-a"><AnswerValue item={item} /></div>
        </div>)}
      </div>)}
    </div>}
    {blanks.length > 0 && <p className="bb-sheet-missing">미작성 · {blanks.slice(0, 8).join(" · ")}{blanks.length > 8 ? ` 외 ${blanks.length - 8}` : ""}</p>}
    {!hasWork(activity) && blanks.length === 0 && <p className="bb-sheet-missing">{activity.state === "waiting" ? status : "미제출"}</p>}
    {comments.length > 0 && <details className="bb-sheet-feedback">
      <summary>피드백 {comments.length}</summary>
      <ul>
        {comments.map((item) => <li key={item.id}>
          <span>{item.kind === "teacher" ? "선생님" : item.authorName} · <time dateTime={item.date || undefined}>{fullDate(item.date)}</time></span>
          <p>{item.text}</p>
        </li>)}
      </ul>
    </details>}
  </article>;
}

export default function StudentActivityReport({ activities, feedback }) {
  const rows = asArray(activities);
  const notes = asArray(feedback);
  const [filter, setFilter] = useState("all");
  const visible = rows.filter((activity) => filter === "all" || activity.state === filter);
  const counts = Object.fromEntries(filters.map(([id]) => [id, id === "all" ? rows.length : rows.filter((activity) => activity.state === id).length]));

  return <div className="bb-sheet">
    <div className="bb-sheet-tools">
      <p>활동 {counts.all} · 충족 {counts.done} · 작성 중 {counts.doing}{counts.empty ? ` · 미시작 ${counts.empty}` : ""}{counts.waiting ? ` · 대기 ${counts.waiting}` : ""}</p>
      <label className="bb-sheet-filter">
        <span className="bb-sheet-sr">활동 상태</span>
        <select aria-label="활동 상태" value={filter} onChange={(event) => setFilter(event.target.value)}>
          {filters.map(([id, label]) => <option key={id} value={id}>{label} {counts[id]}</option>)}
        </select>
      </label>
    </div>
    {visible.length > 0 && <nav className="bb-sheet-jump" aria-label="활동으로 이동">
      {visible.map((activity) => <a key={activity.id} href={"#" + anchorId(activity, rows.indexOf(activity))}>{activity.label}</a>)}
    </nav>}
    {visible.length ? <div className="bb-sheet-grid">
      {visible.map((activity) => <ActivityCard key={activity.id} activity={activity} comments={notes.filter((item) => item.activityId === activity.id)} index={rows.indexOf(activity)} />)}
    </div> : <Empty>{rows.length ? "이 상태의 활동이 없습니다." : "아직 이 반에 독서 활동이 없습니다."}</Empty>}
  </div>;
}
