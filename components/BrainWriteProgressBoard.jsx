"use client";

// =============================================================
// 이어쓰는중 전광판 — 브레인 라이팅 (교사 전용)
// -------------------------------------------------------------
// 격자와 껍데기는 `BookProgressBoard`(곁텍스트 · RAFT와 같은 것)입니다.
//
//   한 줄 = '몇 번째로 이어 쓰는 칸인가'(1 = 제 칸의 첫 줄, 2 = 바로 앞 친구의
//           칸에 두 번째로 …)   한 칸 = 학생 한 명
//
// 작성 완료 · 내 차례 · 앞 차례 대기 · 해당 차례 없음 · 모둠 배정 대기를
// 구분합니다. 모둠에 들지 않은 학생도 반 전체 명부에서 빠지지 않습니다.
//
// 셈은 보드가 이미 만든 학생마다의 `slots`(lib/brainwrite.js의 writerSlots)를
// 그대로 씁니다 — 읽는 문서가 늘지 않습니다.
// =============================================================
import { useCallback, useMemo } from "react";
import { brainwriteSlotState } from "@/lib/brainwrite";
import BookProgressBoard from "./BookProgressBoard";

const LABELS = { done: "작성 완료", doing: "내 차례", empty: "앞 차례 대기", none: "해당 차례 없음", unassigned: "모둠 배정 대기" };

export default function BrainWriteProgressBoard({ activity, cards = [], onOpenStudent, onClose }) {
  const depth = Math.max(0, ...cards.map((c) => c.slots?.length ?? 0));
  const rows = useMemo(
    () =>
      Array.from({ length: depth }, (_, k) => ({
        key: `k${k}`,
        k,
        letter: "",
        label: k === 0 ? (activity.questionMode === "student" ? "나의 질문" : "내 칸 · 첫 줄") : `${k + 1}번째 줄`,
        hint: k === 0 ? (activity.questionMode === "student" ? "친구들에게 던지는 나의 질문" : "제 칸 맨 위에 남기는 첫 생각 · 질문") : `친구의 칸에 ${k + 1}번째로 이어 쓰는 줄`,
        locked: null,
      })),
    [depth, activity.questionMode]
  );

  // 껍데기는 entry.answers를 넘겨 주므로, 학생마다의 칸 정보를 거기 실어 둡니다.
  const boardCards = useMemo(
    () => cards.map((c) => ({ ...c, entry: { answers: { slots: c.slots ?? [] } } })),
    [cards]
  );

  const cellState = useCallback((row, _answers, card) => brainwriteSlotState(card, row.k), []);

  const cellTip = useCallback((row, card, answers) => {
    const slot = answers?.slots?.[row.k];
    const who = `${card.studentId ? `${card.studentId} ` : ""}${card.name}`;
    if (card.unassigned) return `${who} — 모둠 배정 대기`;
    if (!slot) return `${who} · ${row.label} — 모둠이 작아 이 차례가 없어요`;
    const where = row.k === 0 ? "제 칸" : `${slot.owner.name}의 칸`;
    const st = slot.done ? "다 씀" : slot.ready ? "내 차례(앞 사람이 썼어요)" : "기다림(앞 사람이 아직)";
    return `${who} · ${where} — ${st}`;
  }, []);

  const doneAll = cards.filter((c) => c.slots?.length && c.slots.every((s) => s.done)).length;

  return (
    <BookProgressBoard
      title="이어쓰는중 전광판"
      activity={activity}
      cards={boardCards}
      rows={rows}
      cellState={cellState}
      cellTip={cellTip}
      states={["done", "doing", "empty", "none", ...(cards.some((c) => c.unassigned) ? ["unassigned"] : [])]}
      labels={LABELS}
      summary={`모든 칸에 쓴 학생 ${doneAll} / ${cards.length}명`}
      headWidth={150}
      onOpenStudent={onOpenStudent}
      onClose={onClose}
    />
  );
}
