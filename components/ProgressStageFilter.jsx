"use client";

import { PROGRESS_STAGE_LABELS } from "@/lib/progressStageFilter";
import "./ProgressStageFilter.css";

export default function ProgressStageFilter({
  rows = [], states = [], labels = null, stageKey = "", state = "",
  onStageChange, onStateChange, total = 0, shown = total, onReset,
}) {
  const choices = state && !states.some((item) => item.state === state)
    ? [...states, { state, count: 0 }]
    : states;
  return (
    <div className="progress-stage-filter" aria-label="단계별 학생 필터">
      <label>
        <span>단계</span>
        <select value={stageKey} onChange={(event) => onStageChange?.(event.target.value)}>
          <option value="">전체 단계</option>
          {rows.map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}
        </select>
      </label>
      <label>
        <span>작성 상태</span>
        <select value={state} disabled={!stageKey} onChange={(event) => onStateChange?.(event.target.value)}>
          <option value="">전체 상태</option>
          {choices.map((item) => (
            <option key={item.state} value={item.state}>
              {labels?.[item.state] ?? PROGRESS_STAGE_LABELS[item.state] ?? item.state} {item.count}명
            </option>
          ))}
        </select>
      </label>
      <span className="progress-stage-filter-count" role="status">표시 {shown} / 전체 {total}명</span>
      {(stageKey || state) && <button type="button" className="progress-stage-filter-reset" onClick={onReset}>필터 초기화</button>}
    </div>
  );
}
