"use client";

import GroupMemberPill, { GroupMemberStatusLegend } from "./GroupMemberPill";
import "./BookActivityGroupRail.css";

const EMPTY_ATTENDANCE = { date: null, known: false, absentUids: new Set() };

export default function BookActivityGroupRail({
  groups = [],
  pickedGroupId = null,
  pickedUid = null,
  onPickGroup,
  onPickStudent,
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
          <div
            key={group.id}
            className={`book-rail-card book-activity-group-card${picked ? " on" : ""}`}
          >
            <button
              type="button"
              className="book-activity-group-select"
              onClick={() => onPickGroup?.(group.id)}
              aria-pressed={picked}
              aria-label={`${group.name} 학생 ${members.length}명 모둠 선택`}
            >
              <span className="book-rail-head">
                <strong>{group.name}</strong>
                <span className="book-group-count">시작 {started}/{members.length}</span>
              </span>
            </button>
            {members.length === 0 ? (
              <span className="book-group-empty">아직 모둠원이 없어요</span>
            ) : (
              <span className="book-rail-chips">
                {members.map((card) => (
                  <GroupMemberPill
                    key={card.uid}
                    member={card}
                    done={isDone(card)}
                    started={isStarted(card)}
                    absent={attendance.absentUids.has(card.uid)}
                    picked={pickedUid === card.uid}
                    onClick={() => onPickStudent?.(card.uid)}
                  />
                ))}
              </span>
            )}
          </div>
        );
      })}
      <GroupMemberStatusLegend attendance={attendance} />
    </aside>
  );
}
