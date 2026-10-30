"use client";

// =============================================================
// 오른쪽 '학생별 진행' 패널 — 곁텍스트 · RAFT · KWLS 교사 화면 공용
// -------------------------------------------------------------
// 닿소리 채우기의 오른쪽 패널(`BookGroupBoard`의 `GroupProgress`)과 **같은
// 생김새**입니다. CSS도 그대로 씁니다(`.dash-side`·`.dash-progress-*`·
// `.dash-heat*`) — 네 활동의 교사 화면이 서로 다른 모양이면 교사가 화면마다
// 다시 익혀야 합니다.
//
// 한 줄이 학생 한 명입니다: 학번·이름 · `n/N칸` · 막대 · 단계별 네모.
// 줄을 누르면 가운데가 그 학생의 화면으로 바뀝니다(왼쪽 목록과 같은 일).
//
// [읽는 문서가 늘지 않습니다] 보드가 이미 구독해 둔 `entries`를 그대로
// 받습니다 — 닿소리 패널은 판마다 낱말을 따로 구독해야 했지만, 이쪽은 학생
// 한 명이 문서 한 장이라 셀 것이 이미 손에 있습니다.
//
// [색은 줄 번호로] 닿소리의 개별 활동과 같습니다(`ROW_COLORS` 10색 되풀이).
// 여기 학생들은 모둠 안 자리가 없어 '모둠 색'을 쓸 수 없고, 붙어 있는 줄끼리만
// 달라도 목록을 훑는 데 충분합니다.
// =============================================================
import { useMemo, useState } from "react";
import { barTint, rowColor } from "@/lib/bookColors";
import { PROGRESS_STAGE_LABELS, filterProgressCards, getProgressStageRows, getProgressStageStates } from "@/lib/progressStageFilter";
import ProgressStageFilter from "./ProgressStageFilter";

export default function EntryProgressPanel({
  title = "학생별 진행",
  cards = [],
  rows = [],      // 단계 정의
  cellState,      // (row, answers) => 'done' | 'doing' | 'empty' | 'locked'
  pickedUid = null,
  onPick = null,
  extra = null,   // 줄 오른쪽 끝에 덧붙일 것 (예: '· 글 120자')
  // 학생마다 칸이 다를 때(브레인 라이팅 — 모둠 크기만큼) 그 학생의 칸 정의.
  // 주면 rows 대신 이것을 쓰고, cellState는 (row, answers, card)로 부릅니다.
  rowsOf = null,
  // 목록이 빌 때의 말 — 모둠 하나로 좁혀 보이는 화면은 '고르기 전'이 빈 까닭입니다.
  emptyText = "아직 이 반에 들어온 학생이 없어요.",
  labels = null,
}) {
  const total = rows.length;
  const [filterStage, setFilterStage] = useState("");
  const [filterState, setFilterState] = useState("");
  const filterRows = getProgressStageRows(cards, { rows, rowsOf });
  const stageKey = filterRows.some((row) => String(row.key) === filterStage) ? filterStage : "";
  const filterOptions = { rows, rowsOf, cellState, stageKey, state: filterState };
  const shownUids = new Set(filterProgressCards(cards, filterOptions).map((card) => card.uid));
  const filterStates = getProgressStageStates(cards, filterOptions);

  const list = useMemo(
    () =>
      cards.map((c, i) => {
        const answers = c.entry?.answers ?? {};
        const own = rowsOf ? rowsOf(c) ?? [] : rows;
        const states = own.map((r) => cellState(r, answers, c));
        return {
          ...c,
          rows: own,
          total: own.length,
          states,
          // '다 씀'만 셉니다 — '쓰는 중'까지 세면 한 글자 쓴 칸이 다 쓴 칸과
          // 같아져, 진행률이 실제보다 앞서 보입니다.
          filled: states.filter((s) => s === "done").length,
          color: rowColor(i),
        };
      }),
    [cards, rows, cellState, rowsOf]
  );

  const doneCount = list.filter((m) => m.filled >= m.total && m.total > 0).length;

  return (
    <aside className="dash-side book-group-progress" aria-label={title}>
      <h3>
        {title}
        {list.length > 0 && (
          <b
            className="book-progress-done"
            title={`${rowsOf ? "제 칸" : `${total}칸`}을 다 채운 학생 ${doneCount}명 / ${list.length}명`}
          >
            다 채움 {doneCount} / {list.length}
          </b>
        )}
      </h3>
      <ProgressStageFilter
        rows={filterRows} states={filterStates} labels={labels} stageKey={stageKey}
        state={stageKey ? filterState : ""} total={list.length} shown={shownUids.size}
        onStageChange={(key) => { setFilterStage(key); setFilterState(""); }}
        onStateChange={setFilterState}
        onReset={() => { setFilterStage(""); setFilterState(""); }}
      />
      {list.length === 0 ? (
        <p className="dash-side-empty">{emptyText}</p>
      ) : (
        <>
        {shownUids.size === 0 && <p className="progress-stage-empty">조건에 맞는 학생이 없습니다. 필터를 바꾸거나 초기화해 주세요.</p>}
        <ul className="dash-progress-list">
          {list.filter((m) => shownUids.has(m.uid)).map((m) => (
            <li key={m.uid} className={m.uid === pickedUid ? "is-picked" : ""}>
              <button type="button" className="dash-progress-name progress-stage-name-button" onClick={() => onPick?.(m.uid)} aria-label={`${m.name} 화면 열기`}>
                <i className="dash-dot" style={{ background: m.color.border }} />
                {m.studentId && <em className="dash-progress-sid">{m.studentId}</em>}
                <span className="dash-progress-who">{m.name}</span>
              </button>
              <span className="dash-progress-num">
                {m.unassigned ? "모둠 배정 대기" : `${m.filled}/${m.total}칸`}
                {extra && <span className="dash-progress-words">{extra(m)}</span>}
              </span>
              <span className="dash-progress-bar">
                <b
                  style={{
                    width: m.total > 0 ? `${(m.filled / m.total) * 100}%` : 0,
                    background: barTint(m.color.border),
                  }}
                />
              </span>
              <div
                className="dash-heat entry-heat"
                aria-label={`${m.name} 단계별 답안`}
              >
                {m.states.map((st, i) => (
                  <button
                    key={m.rows[i].key}
                    type="button"
                    className={`dash-heat-cell entry-heat-cell progress-stage-button entry-heat-cell--${st}${
                      m.filled >= m.total && i === m.total - 1 ? " is-done" : ""
                    }`}
                    style={st === "done" ? { background: m.color.border } : undefined}
                    onClick={() => onPick?.(m.uid, m.rows[i].key)}
                    title={`${m.rows[i].label} · ${labels?.[st] ?? PROGRESS_STAGE_LABELS[st] ?? st}`}
                    aria-label={`${m.name} · ${m.rows[i].label} · ${labels?.[st] ?? PROGRESS_STAGE_LABELS[st] ?? st} — 답안 열기`}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </aside>
  );
}
