"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { careRulesFor } from "@/lib/petCare";
import { readingLevelProgress } from "@/lib/reading";
import ReadingCharacterSummary from "./ReadingCharacterSummary";
import ReadingHideout from "./ReadingHideout";
import TeacherHideoutGallery from "./TeacherHideoutGallery";
import "./teacher-hideout-browser.css";

// Local browsing only: changing rooms does not move a teacher's plaza avatar,
// change the selected library student, or subscribe to each student's ledger.
// onPlaza — 아지트를 보다가 곧바로 책 광장으로(선생님 요청 · 2026년 11월 — '전체 아지트' 옆 '광장으로'). 광장을 끈 반에서는 없음.
export default function TeacherHideoutBrowser({ classId, user, roster = [], characterOn = true, petOn = false, petFeed = null, onClose, onPlaza = null }) {
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

  return <section className={`teacher-hideout-browser${student ? " is-viewing" : ""}`} aria-label="학생 아지트 열람">
    <div ref={gallery} hidden={!!student}>
      <TeacherHideoutGallery classId={classId} user={user} roster={roster} onSelect={select} onLoaded={remember} onClose={onClose} onPlaza={onPlaza} />
    </div>
    {student && <div className="teacher-hideout-view">
      {/* 머리(선생님 요청 · 2026년 11월) — 왼쪽은 제목과 그 오른쪽의 이전 · 다음(아지트 그림 위), 오른쪽은 전체 아지트 · 광장으로 ·
          학생 서재로와 그 오른쪽 끝(화면 오른쪽 위)의 캐릭터 카드(독서 레벨 · 경험치 — 목록에서 받아 둔 방의 누적 경험치로 셈, 읽기 0).
          칸이 좁으면 카드는 제목 줄 오른쪽에 남고 단추 셋이 그 아래 줄로 내려갑니다(teacher-hideout-browser.css의 격자). */}
      <header className="teacher-hideout-heading">
        <div className="teacher-hideout-lead">
          <div className="teacher-hideout-title">
            <p className="hideout-eyebrow">이야기가 머무는 작은 방{student.studentId ? ` · ${student.studentId}` : ""}</p>
            <h2 ref={heading} tabIndex={-1} aria-live="polite">{student.realName || student.name || "학생"}의 아지트</h2>
          </div>
          <div className="teacher-hideout-sequence" role="group" aria-label="다른 학생의 아지트 보기">
            <button type="button" aria-label="이전 학생 아지트" onClick={() => browse(-1)} disabled={roster.length < 2}>← 이전</button>
            <span aria-live="polite" aria-label={`${index + 1}번째 학생, 전체 ${roster.length}명`}>{index + 1} / {roster.length}</span>
            <button type="button" aria-label="다음 학생 아지트" onClick={() => browse(1)} disabled={roster.length < 2}>다음 →</button>
          </div>
        </div>
        <nav className="teacher-hideout-navigation" aria-label="아지트 보기 메뉴">
          <button type="button" onClick={() => setViewingUid(null)}>전체 아지트</button>
          {onPlaza && <button type="button" onClick={onPlaza} title="책 광장으로 가요">광장으로</button>}
          <button type="button" onClick={onClose}>학생 서재로</button>
        </nav>
        {characterOn
          ? <div className="hideout-character"><ReadingCharacterSummary uid={student.uid} summary={cardSummary} readOnly /></div>
          : snapshot?.progress?.level != null && <span className="hideout-level">독서 레벨 <strong>{snapshot.progress.level}</strong></span>}
      </header>
      <ReadingHideout key={`${classId}:${student.uid}`} classId={classId} user={user} student={student} readOnly
        initialView={snapshots.has(student.uid) ? { classId, uid: student.uid, value: snapshots.get(student.uid) } : null}
        onLoaded={remember} characterOn={characterOn} petOn={petOn} petFeed={feed}
        onDisabled={onClose} onExit={() => setViewingUid(null)} exitLabel="전체 아지트" hideExitButton hideHeading />
    </div>}
  </section>;
}
