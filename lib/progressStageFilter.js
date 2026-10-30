// Filtering is based on the same saved-answer states as the progress segments.
// Waiting, no assigned group, and a nonexistent turn are never counted as empty.
export const PROGRESS_STAGE_LABELS = {
  empty: "미작성",
  doing: "일부 작성",
  done: "작성 완료",
  locked: "잠김",
  none: "해당 단계 없음",
  unassigned: "모둠 배정 대기",
};

const STATE_ORDER = ["empty", "doing", "done", "locked", "none", "unassigned"];

export function getProgressStageRows(cards = [], { rows = [], rowsOf = null } = {}) {
  if (!rowsOf) return rows;
  const byKey = new Map(rows.map((row) => [String(row.key), row]));
  for (const card of cards) {
    for (const row of rowsOf(card) ?? []) {
      if (!byKey.has(String(row.key))) byKey.set(String(row.key), row);
    }
  }
  return [...byKey.values()];
}

export function getProgressCardStageState(card, stageKey, {
  rows = [], rowsOf = null, cellState,
} = {}) {
  if (card.unassigned) return "unassigned";
  const ownRows = rowsOf ? rowsOf(card) ?? [] : rows;
  const row = ownRows.find((item) => String(item.key) === String(stageKey));
  if (!row) return "none";
  return cellState(row, card.entry?.answers ?? {}, card);
}

export function getProgressStageStates(cards = [], options = {}) {
  if (options.stageKey == null || options.stageKey === "") return [];
  const counts = new Map();
  for (const card of cards) {
    const state = getProgressCardStageState(card, options.stageKey, options);
    if (state) counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return [...counts].map(([state, count]) => ({ state, count })).sort((a, b) => {
    const at = STATE_ORDER.indexOf(a.state);
    const bt = STATE_ORDER.indexOf(b.state);
    return (at < 0 ? STATE_ORDER.length : at) - (bt < 0 ? STATE_ORDER.length : bt);
  });
}

export function filterProgressCards(cards = [], options = {}) {
  const { stageKey = "", state = "" } = options;
  if (stageKey === "" || !state) return cards;
  return cards.filter((card) => getProgressCardStageState(card, stageKey, options) === state);
}
