"use client";

import { useId, useMemo, useRef, useState } from "react";
import "./TeacherReportShell.css";

const reportTabs = [
  { id: "personal", label: "개인별 분석 리포트" },
  { id: "class", label: "학급별 분석 리포트" },
  { id: "overall", label: "전체 분석 리포트" },
];

function mergeStudents(students) {
  const users = new Map();
  for (const student of Array.isArray(students) ? students : []) {
    if (student?.uid == null || student.uid === "") continue;
    const previous = users.get(student.uid);
    const classes = new Map();
    for (const classroom of [...(previous?.classes || []), ...(Array.isArray(student.classes) ? student.classes : [])]) {
      if (!classroom || (!classroom.id && !classroom.name)) continue;
      const key = classroom.id || classroom.name;
      if (!classes.has(key)) classes.set(key, { ...classroom });
    }
    users.set(student.uid, {
      ...student,
      ...previous,
      name: previous?.name || student.name || "",
      studentId: previous?.studentId || student.studentId || "",
      emoji: previous?.emoji || student.emoji || "",
      classes: [...classes.values()],
    });
  }
  return [...users.values()];
}

/** Report content and class scope are supplied by the parent dashboard. */
export default function TeacherReportShell({
  tab = "class",
  onTabChange,
  students = [],
  selectedUid = null,
  onSelectStudent,
  loading = false,
  children,
}) {
  const id = useId();
  const tabRefs = useRef([]);
  const [query, setQuery] = useState("");
  const activeTab = reportTabs.find((item) => item.id === tab) || reportTabs[1];
  const users = useMemo(() => mergeStudents(students), [students]);
  const search = query.trim().toLocaleLowerCase("ko");
  const visibleUsers = users.filter((student) => !search || [
    student.name,
    student.studentId,
    ...student.classes.map((classroom) => classroom.name),
  ].filter(Boolean).join(" ").toLocaleLowerCase("ko").includes(search));
  const panelId = `${id}-report-panel`;
  const directoryId = `${id}-directory-heading`;
  const countId = `${id}-directory-count`;

  function handleTabKeyDown(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % reportTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index + reportTabs.length - 1) % reportTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = reportTabs.length - 1;
    else return;
    event.preventDefault();
    tabRefs.current[nextIndex]?.focus();
    onTabChange?.(reportTabs[nextIndex].id);
  }

  return <div className="bb-report-shell">
    <div className="bb-report-tabs" role="tablist" aria-label="분석 리포트 유형">
      {reportTabs.map((item, index) => <button
        key={item.id}
        ref={(node) => { tabRefs.current[index] = node; }}
        type="button"
        role="tab"
        id={`${id}-tab-${item.id}`}
        aria-selected={activeTab.id === item.id}
        aria-controls={panelId}
        tabIndex={activeTab.id === item.id ? 0 : -1}
        className="bb-report-tab"
        onClick={() => onTabChange?.(item.id)}
        onKeyDown={(event) => handleTabKeyDown(event, index)}
      >{item.label}</button>)}
    </div>

    <div className="bb-report-layout">
      <aside className="bb-report-directory" aria-labelledby={directoryId} aria-busy={loading}>
        <div className="bb-report-directory-heading">
          <h2 id={directoryId}>사용자 목록</h2>
          <span id={countId} className="bb-report-directory-count" role="status">
            {loading && !users.length ? "불러오는 중" : `${visibleUsers.length} / ${users.length}명`}
          </span>
        </div>
        <label className="bb-report-search">
          <span className="bb-report-visually-hidden">이름, 학번 또는 학급 검색</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름 · 학번 · 학급 검색"
            aria-describedby={countId}
          />
        </label>
        <p className="bb-report-directory-hint">사용자를 선택해 개인별 기록을 살펴보세요.</p>
        <div className="bb-report-directory-scroll">
          {visibleUsers.length ? <ul className="bb-report-user-list">
            {visibleUsers.map((student) => <li key={student.uid}>
              <button
                type="button"
                className="bb-report-user"
                aria-pressed={selectedUid === student.uid}
                onClick={() => onSelectStudent?.(student)}
              >
                <span className="bb-report-user-avatar" aria-hidden="true">{student.emoji || "📖"}</span>
                <span className="bb-report-user-info">
                  <span className="bb-report-user-name">{student.name || "이름 미등록"}</span>
                  <span className="bb-report-user-meta">{student.studentId || "학번 미등록"}</span>
                  {student.classes.length > 0 && <span className="bb-report-user-classes">{student.classes.map((classroom) => classroom.name).filter(Boolean).join(" · ")}</span>}
                </span>
                {selectedUid === student.uid && <span className="bb-report-user-selected">선택</span>}
              </button>
            </li>)}
          </ul> : <p className="bb-report-directory-empty" role="status">
            {loading ? "사용자 목록을 불러오고 있어요." : users.length ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
          </p>}
        </div>
        {loading && users.length > 0 && <p className="bb-report-directory-updating" role="status">사용자 목록을 갱신하고 있어요.</p>}
      </aside>

      <div className="bb-report-content" role="tabpanel" id={panelId} aria-labelledby={`${id}-tab-${activeTab.id}`} tabIndex={0}>
        {children}
      </div>
    </div>
  </div>;
}
