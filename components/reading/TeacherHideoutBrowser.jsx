"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { careRulesFor } from "@/lib/petCare";
import { readingLevelProgress } from "@/lib/reading";
import ReadingCharacterSummary from "./ReadingCharacterSummary";
import ReadingHideout from "./ReadingHideout";
import TeacherHideoutGallery from "./TeacherHideoutGallery";
import "./teacher-hideout-browser.css";

// Local browsing only: changing rooms does not move a teacher's plaza avatar,
// change the selected library student, or subscribe to each student's ledger.
// onPlaza — 아지트를 보다가 곧바로 책 광장으로(선생님 요청 · 2026년 11월). 광장을 끈 반에서는 없음.
// cardSlot — 책 봄 머리말 오른쪽 끝 빈자리(TeacherReadingView의 .books-head-aside). 고른 학생의 캐릭터 카드를 거기에 띄웁니다
// (선생님 요청 · 2026년 11월 — 아지트 제목 줄이 카드 높이만큼 높아져 그림까지 여백이 컸음). 없으면 제목 줄 오른쪽 끝에.
export default function TeacherHideoutBrowser({ classId, user, roster = [], characterOn = true, petOn = false, petFeed = null, onClose, onPlaza = null, cardSlot = null }) {
  const [viewingUid, setViewingUid] = useState(null);
  const [snapshots, setSnapshots] = useState(() => new Map());
  const heading = useRef(null);
  const gallery = useRef(null);
  const focusCard = useRef(null);
  const focusRoomHeading = useRef(false);
  const index = roster.findIndex((student) => student.uid === viewingUid);
  const student = index >= 0 ? roster[index] : null;
  const viewedUid = student?.uid;
  const joinedAt = student?.joinedAt ?? null;
  const feed = useMemo(() => petOn && petFeed?.on ? careRulesFor(petFeed, joinedAt) : null, [petOn, petFeed, joinedAt]);
  // 받아 둔 방(목록 · 상세가 함께 씀)에 실린 누적 경험치로 카드의 레벨 · 막대를 셉니다. 아직 못 받았으면 카드가 '불러오는 중'.
  const snapshot = viewedUid ? snapshots.get(viewedUid) : null;
  const cardSummary = useMemo(() => Number.isFinite(snapshot?.petGrowthXp) ? readingLevelProgress(snapshot.petGrowthXp)
    : snapshot?.progress?.level != null ? { level: snapshot.progress.level } : null, [snapshot]);
  useEffect(() => { if (viewingUid && index < 0) setViewingUid(null); }, [viewingUid, index]);
  const remember = useCallback((uid, value) => {
    setSnapshots((current) => current.get(uid) === value ? current : new Map(current).set(uid, value));
  }, []);
  const select = useCallback((uid, value) => {
    if (value) remember(uid, value);
    focusCard.current = uid;
    focusRoomHeading.current = true;
    setViewingUid(uid);
  }, [remember]);
  function browse(direction) {
    if (roster.length < 2 || index < 0) return;
    const next = roster[(index + direction + roster.length) % roster.length];
    focusCard.current = next.uid;
    setViewingUid(next.uid);
  }
  useEffect(() => {
    if (viewedUid && focusRoomHeading.current) {
      focusRoomHeading.current = false;
      heading.current?.focus({ preventScroll: true });
    } else if (!viewedUid && focusCard.current) {
      const button = [...(gallery.current?.querySelectorAll("button[data-hideout-student]") || [])]
        .find((node) => node.dataset.hideoutStudent === focusCard.current);
      (button || gallery.current?.querySelector("h2"))?.focus({ preventScroll: true });
    }
  }, [viewedUid]);

  // 고른 학생의 캐릭터 카드(독서 레벨 · 경험치 — 목록에서 받아 둔 방의 누적 경험치로 셈, 읽기 0). 캐릭터를 끈 반은 레벨 알약.
  const card = !student ? null : characterOn
    ? <div className="hideout-character"><ReadingCharacterSummary uid={student.uid} summary={cardSummary} readOnly /></div>
    : snapshot?.progress?.level != null ? <span className="hideout-level">독서 레벨 <strong>{snapshot.progress.level}</strong></span> : null;

  return <section className={`teacher-hideout-browser${student ? " is-viewing" : ""}`} aria-label="학생 아지트 열람">
    <div ref={gallery} hidden={!!student}>
      <TeacherHideoutGallery classId={classId} user={user} roster={roster} onSelect={select} onLoaded={remember} onClose={onClose} onPlaza={onPlaza} />
    </div>
    {student && <div className="teacher-hideout-view">
      {/* 머리 한 줄(선생님 요청 · 2026년 11월) — 제목 바로 오른쪽에 이전 · 다음, 같은 줄 오른쪽 끝에 광장으로 · 학생 서재로.
          '전체 아지트'는 걷었습니다(선생님 요청 — 학생 아지트를 보는 동안에는 필요 없음 · 목록은 학생 서재로 → '아지트 보기').
          캐릭터 카드는 이 줄이 아니라 책 봄 머리말 오른쪽 끝 빈자리(cardSlot)에 섭니다 — 줄이 카드 높이만큼 높아지지 않게.
          제목 위의 '이야기가 머무는 작은 방 · 학번' 줄은 걷었습니다(선생님 요청 · 2026년 11월 — 되살리지 마세요). */}
      <header className="teacher-hideout-heading">
        <div className="teacher-hideout-title">
          <h2 ref={heading} tabIndex={-1} aria-live="polite">{student.realName || student.name || "학생"}의 아지트</h2>
        </div>
        <div className="teacher-hideout-sequence" role="group" aria-label="다른 학생의 아지트 보기">
          <button type="button" aria-label="이전 학생 아지트" onClick={() => browse(-1)} disabled={roster.length < 2}>← 이전</button>
          <span aria-live="polite" aria-label={`${index + 1}번째 학생, 전체 ${roster.length}명`}>{index + 1} / {roster.length}</span>
          <button type="button" aria-label="다음 학생 아지트" onClick={() => browse(1)} disabled={roster.length < 2}>다음 →</button>
        </div>
        <nav className="teacher-hideout-navigation" aria-label="아지트 보기 메뉴">
          {onPlaza && <button type="button" onClick={onPlaza} title="책 광장으로 가요">광장으로</button>}
          <button type="button" onClick={onClose}>학생 서재로</button>
        </nav>
        {!cardSlot && card}
      </header>
      {cardSlot && card && createPortal(card, cardSlot)}
      <ReadingHideout key={`${classId}:${student.uid}`} classId={classId} user={user} student={student} readOnly
        initialView={snapshots.has(student.uid) ? { classId, uid: student.uid, value: snapshots.get(student.uid) } : null}
        onLoaded={remember} characterOn={characterOn} petOn={petOn} petFeed={feed}
        onDisabled={onClose} onExit={() => setViewingUid(null)} hideExitButton hideHeading />
    </div>}
  </section>;
}
