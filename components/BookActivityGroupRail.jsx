"use client";

import { groupMemberStatus } from "@/lib/groupMemberStatus";
import { GroupMemberStatusLegend } from "./GroupMemberPill";
import "./BookActivityGroupRail.css";

const MARKS = { done: "✓", doing: "◐", empty: "–", absent: "×" };
const EMPTY_ATTENDANCE = { date: null, known: false, absentUids: new Set() };

export default function BookActivityGroupRail({
  groups = [],
  pickedGroupId = null,
  onPickGroup,
  isStarted = () => false,
  isDone = () => false,
  attendance = EMPTY_ATTENDANCE,
}) {
  return (
    <aside className="book-group-rail book-activity-group-rail" aria-label="모둠">
      {groups.length === 0 && <p className="book-group-empty">아직 모둠이 없어요.</p>}
      {groups.map((group) => {
        const members = group.members ?? [];
        const picked = group.id === pickedGroupId;
        const started = members.filter(isStarted).length;
        return (
          <button
            key={group.id}
            type="button"
            className={`book-rail-card${picked ? " on" : ""}`}
            onClick={() => onPickGroup?.(group.id)}
            aria-pressed={picked}
            aria-label={`${group.name} 학생 ${members.length}명 모둠 선택`}
          >
            <span className="book-rail-head">
              <strong>{group.name}</strong>
              <span className="book-group-count">시작 {started}/{members.length}</span>
            </span>
            {members.length === 0 ? (
              <span className="book-group-empty">아직 모둠원이 없어요</span>
            ) : (
              <span className="book-rail-chips">
                {members.map((card) => {
                  const status = groupMemberStatus({
                    done: isDone(card),
                    started: isStarted(card),
                    absent: attendance.absentUids.has(card.uid),
                  });
                  const stateText = status.key === "absent"
                    ? `${status.label} · ${status.progressLabel}` : status.label;
                  const description = `${card.name} — ${stateText}`;
                  return (
                    <span
                      key={card.uid}
                      className={`book-rail-chip group-member-status-key member-status-${status.key}`}
                      data-member-status={status.key}
                      data-member-uid={card.uid}
                      aria-label={description}
                      title={`${card.studentId ? `${card.studentId} ` : ""}${description}`}
                    >
                      <span className="group-member-status-mark" aria-hidden="true">{MARKS[status.key]}</span>
                      <span>{card.name}</span>
                    </span>
                  );
                })}
              </span>
            )}
          </button>
        );
      })}
      <GroupMemberStatusLegend attendance={attendance} />
    </aside>
  );
}
