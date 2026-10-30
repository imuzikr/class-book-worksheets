"use client";

import { groupMemberStatus } from "@/lib/groupMemberStatus";

const MARKS = { done: "✓", doing: "◐", empty: "–", absent: "×", unassigned: "…" };
const STATES = [
  { key: "done", label: "완료" },
  { key: "doing", label: "진행 중" },
  { key: "empty", label: "미시작" },
  { key: "absent", label: "결석" },
];

// 선택 테두리는 작성 상태의 바탕색을 바꾸지 않습니다.
export default function GroupMemberPill({
  member, done, started, absent, unassigned = false, picked = false, onClick, detail = "",
}) {
  const status = groupMemberStatus({ done, started, absent, unassigned });
  const stateText = status.key === "absent"
    ? `${status.label} · ${status.progressLabel}` : status.label;
  const description = `${member.name} — ${stateText}${detail && !stateText.includes(detail) ? ` · ${detail}` : ""}`;
  return (
    <button
      type="button"
      className={`book-rail-chip raft-mate-pill member-status-${status.key}${picked ? " on" : ""}`}
      data-member-status={status.key}
      data-member-uid={member.uid}
      onClick={onClick}
      aria-pressed={picked}
      aria-label={description}
      title={`${member.studentId ? `${member.studentId} ` : ""}${description}`}
    >
      <span className="group-member-status-mark" aria-hidden="true">{MARKS[status.key]}</span>
      <span>{member.name}</span>
    </button>
  );
}

export function GroupMemberStatusLegend({ attendance }) {
  return (
    <div className="group-member-status-legend" aria-label="학생 상태 색상 안내">
      <div className="group-member-status-keys">
        {STATES.map((status) => (
          <span key={status.key} className={`group-member-status-key member-status-${status.key}`}>
            <span className="group-member-status-mark" aria-hidden="true">{MARKS[status.key]}</span>
            {status.label}
          </span>
        ))}
      </div>
      <p className="group-member-attendance-note">
        {attendance.date ? `${attendance.date} 출석 기준` : "활동 시작일 출석 미확인"}
        {!attendance.known && <><br />출석 기록이 없어 결석은 표시하지 않아요.</>}
      </p>
    </div>
  );
}
