"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import MindmapCanvas from "../MindmapCanvas";
import SecureImage from "../SecureImage";
import { RaftFeedbackText } from "../RaftFeedback";
import { placeFeedbackNotes } from "@/lib/raftFeedback";
import { CONSONANT_LABELS, GRID_SLOTS } from "@/lib/consonants";
import "./ActivityReportContent.css";

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" || typeof value === "number" ? String(value) : "";
const hasText = (value) => text(value).trim().length > 0;
const number = (value) => typeof value === "number" && Number.isFinite(value) ? String(value) : "—";

// Pair adjacent short sections without changing reading order. A long section
// or an unpaired last card uses the full row, keeping the two sides balanced.
function pairedWidths(items, compact) {
  const widths = items.map(() => " is-wide");
  for (let index = 0; index < items.length - 1; index += 1) {
    if (compact(items[index]) && compact(items[index + 1])) {
      widths[index] = widths[index + 1] = "";
      index += 1;
    }
  }
  return widths;
}

function shortEntries(entries, limit = 320) {
  return list(entries).reduce((length, entry) => length + text(entry.text).length, 0) <= limit
    && list(entries).every((entry) => text(entry.text).split("\n").length <= 5);
}

function compactSection(section, type) {
  if (!shortEntries(section.entries)) return false;
  if (type === "paratext") return list(section.entries).length <= 2;
  if (type === "hashtag") return section.id?.startsWith("tag-");
  if (type === "qmark") return section.id?.startsWith("question-");
  if (type === "brainwrite") return section.id?.startsWith("contribution-") && section.title !== "내가 만든 질문";
  if (type === "opinion") return section.id?.startsWith("note-");
  return type === "crossword";
}

function AnswerRows({ entries, kind = "" }) {
  const items = list(entries);
  const columns = ["plan", "source", "paired"].includes(kind);
  const widths = columns ? pairedWidths(items, (entry) => shortEntries([entry], 240)) : [];
  const wideKwls = kind === "kwls" && !items.every((entry) => shortEntries([entry], 400));
  return <dl className={`bb-ar-answer-rows${kind ? ` is-${kind}` : ""}${wideKwls ? " is-long" : ""}`}>
    {items.map((entry, index) => <div className={`bb-ar-answer-row${widths[index] || ""}`} key={entry.id || entry.label || index}>
      {hasText(entry.label) && <dt>{text(entry.label)}</dt>}
      <dd className={hasText(entry.text) ? "" : "is-empty"}>{hasText(entry.text) ? text(entry.text) : "작성하지 않음"}</dd>
    </div>)}
  </dl>;
}

function ConsonantWords({ entries, topic }) {
  const items = list(entries);
  return <dl className="bb-ar-word-grid">
    {GRID_SLOTS.map((slot) => slot === null
      ? <div key="topic" className="bb-ar-word-topic"><dt>도서·주제</dt><dd>{topic || "내가 모은 낱말"}</dd></div>
      : <div key={slot} className={`bb-ar-answer-row bb-ar-word-cell${hasText(items[slot]?.text) ? " is-filled" : " is-blank"}`}>
        <dt>{text(items[slot]?.label) || CONSONANT_LABELS[slot]}</dt>
        <dd className={hasText(items[slot]?.text) ? "" : "is-empty"}>{hasText(items[slot]?.text) ? text(items[slot].text) : "작성하지 않음"}</dd>
      </div>)}
  </dl>;
}

function MindmapDialog({ map, fitKey, studentName, onClose }) {
  const ref = useRef(null);
  const downOutside = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    const previouslyFocused = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  function outside(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }

  return <dialog
    ref={ref}
    className="bb-ar-map-dialog"
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { downOutside.current = event.target === event.currentTarget && outside(event); }}
    onClick={(event) => {
      if (event.target === event.currentTarget && downOutside.current && outside(event)) onClose();
      downOutside.current = false;
    }}
  >
    <header className="bb-ar-map-dialog-head">
      <div><span>학생이 작성한 생각의 관계도</span><h2 id={titleId}>{studentName ? `${studentName}의 마인드맵` : "마인드맵 크게 보기"}</h2></div>
      <button type="button" className="btn-close" aria-label="마인드맵 크게 보기 닫기" onClick={onClose}>×</button>
    </header>
    <div className="bb-ar-content-map bb-ar-content-map-large">
      <MindmapCanvas map={map} fitKey={`${fitKey}:large`} />
    </div>
    <p className="bb-ar-map-help">확대·축소하거나 판을 끌어 자세히 살펴보세요. 작성한 내용은 바뀌지 않습니다.</p>
  </dialog>;
}

function ReportMindmap({ map, fitKey, studentName }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="bb-ar-map-block">
    <div className="bb-ar-map-caption">
      <p>학생이 작성한 노드와 연결 관계를 앱의 배치 그대로 보여 줍니다.</p>
      <button type="button" className="btn-ghost bb-ar-map-open" onClick={() => setExpanded(true)}>마인드맵 크게 보기</button>
    </div>
    <div className="bb-ar-content-map"><MindmapCanvas map={map} fitKey={fitKey} /></div>
    {expanded && <MindmapDialog map={map} fitKey={fitKey} studentName={studentName} onClose={() => setExpanded(false)} />}
  </div>;
}

function FeedbackNotes({ notes }) {
  if (!notes.length) return null;
  return <section className="bb-ar-feedback" aria-label="선생님이 남긴 피드백">
    <h4>선생님이 남긴 피드백</h4>
    <ol>{notes.map((note, index) => <li key={note.id || index}>
      <span className="bb-ar-feedback-number" aria-hidden="true">{note.no || index + 1}</span>
      <div>{hasText(note.quote) && <blockquote>{text(note.quote)}</blockquote>}<p>{text(note.text)}</p></div>
    </li>)}</ol>
  </section>;
}

function BingoResult({ result }) {
  const group = result.groupResult === true;
  return <div className="bb-ar-bingo">
    <p className="bb-ar-bingo-caption">{group ? "모둠이 함께 만든 판의 결과입니다." : "학생이 작성한 빙고판의 결과입니다."}</p>
    <dl className="bb-ar-bingo-facts">
      <div><dt>판 채우기</dt><dd>{number(result.filled)} / {number(result.total)}<span>칸</span></dd></div>
      <div><dt>빙고 목표</dt><dd>{number(result.goal)}<span>줄</span></dd></div>
      <div><dt>{group ? "모둠 결과" : "나의 결과"}</dt><dd>{number(result.lines)}<span>줄</span></dd></div>
    </dl>
    {list(result.words).some(hasText) && <div className="bb-ar-bingo-words"><h4>판에 담긴 낱말</h4><p>{result.words.filter(hasText).map(text).join(" · ")}</p></div>}
  </div>;
}

export default function ActivityReportContent({ activity, studentName = "", scopeKey = "" }) {
  const report = activity?.report;
  const sections = list(report?.sections);
  const writing = sections.find((section) => section.id === "writing");
  const writingText = list(writing?.entries).map((entry) => text(entry.text)).join("\n\n");
  const notes = useMemo(() => placeFeedbackNotes(writingText, list(report?.feedback)), [writingText, report?.feedback]);
  const hasMap = report?.map && list(report.map.nodes).length > 0;
  const sectionWidths = pairedWidths(sections, (section) => compactSection(section, activity.type));

  if (!report) return null;

  return <div className={`bb-ar-content is-${activity.type || "activity"}`}>
    {hasMap && <ReportMindmap key={`${scopeKey}:${activity.id}`} map={report.map} fitKey={`${scopeKey}:${activity.id}`} studentName={studentName} />}
    {hasText(report.image?.url) && <figure className="bb-ar-report-image">
      <SecureImage src={report.image.url} alt={text(report.image.caption) || "학생이 선택한 활동 대표 이미지"} className="bb-ar-report-image-media" />
      {(hasText(report.image.caption) || hasText(report.image.credit)) && <figcaption>
        {hasText(report.image.caption) && <span>{text(report.image.caption)}</span>}
        {hasText(report.image.credit) && <small>출처: {text(report.image.credit)}</small>}
      </figcaption>}
    </figure>}
    {report.bingo && <BingoResult result={report.bingo} />}
    <div className="bb-ar-section-grid">{sections.map((section, index) => {
      const plan = activity.type === "raft" && section.id === "plan";
      const prose = activity.type === "raft" && section.id === "writing";
      const words = activity.type === "consonant";
      const tag = activity.type === "hashtag" && section.id?.startsWith("tag-");
      const tagEntry = tag ? list(section.entries).find((entry) => entry.label === "해시태그" && hasText(entry.text)) : null;
      const kind = plan ? "plan" : activity.type === "kwls" ? "kwls"
        : activity.type === "hashtag" && section.id === "source" ? "source"
          : activity.type === "crossword" && sections.length === 1 ? "paired" : "";
      return <section key={section.id || index} className={`bb-ar-content-section${sectionWidths[index]}${plan ? " is-plan" : ""}${prose ? " is-prose" : ""}${words ? " is-word-board" : ""}${tag ? " is-tag" : ""}${kind === "kwls" ? " is-reflection" : ""}${section.id === "prompt" ? " is-prompt" : ""}`}>
        {hasText(section.title) && <h4>{tagEntry ? <><span className="bb-ar-tag-number">{text(section.title)}</span><span className="bb-ar-tag-name">{text(tagEntry.text)}</span></> : text(section.title)}</h4>}
        {words ? <ConsonantWords entries={section.entries} topic={report.topic} />
          : prose ? <RaftFeedbackText text={writingText} notes={notes} emptyText="작성하지 않음" />
            : <AnswerRows entries={tagEntry ? section.entries.filter((entry) => entry !== tagEntry) : section.entries} kind={kind} />}
      </section>;
    })}</div>
    <FeedbackNotes notes={notes} />
  </div>;
}
