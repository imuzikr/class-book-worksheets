"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { careRulesFor } from "@/lib/petCare";
import ReadingHideout from "./ReadingHideout";
import TeacherHideoutGallery from "./TeacherHideoutGallery";
import "./teacher-hideout-browser.css";

// Local browsing only: changing rooms does not move a teacher's plaza avatar,
// change the selected library student, or subscribe to each student's ledger.
export default function TeacherHideoutBrowser({ classId, user, roster = [], characterOn = true, petOn = false, petFeed = null, onClose }) {
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
      <TeacherHideoutGallery classId={classId} user={user} roster={roster} onSelect={select} onLoaded={remember} onClose={onClose} />
    </div>
    {student && <div className="teacher-hideout-view">
      <header className="teacher-hideout-heading">
        <div className="teacher-hideout-title">
          <p className="hideout-eyebrow">이야기가 머무는 작은 방{student.studentId ? ` · ${student.studentId}` : ""}</p>
          <h2 ref={heading} tabIndex={-1} aria-live="polite">{student.realName || student.name || "학생"}의 아지트</h2>
        </div>
        <nav className="teacher-hideout-navigation" aria-label="학생 아지트 둘러보기">
          <button type="button" onClick={() => setViewingUid(null)}>전체 아지트</button>
          <div className="teacher-hideout-sequence">
            <button type="button" aria-label="이전 학생 아지트" onClick={() => browse(-1)} disabled={roster.length < 2}>← 이전</button>
            <span aria-live="polite" aria-label={`${index + 1}번째 학생, 전체 ${roster.length}명`}>{index + 1} / {roster.length}</span>
            <button type="button" aria-label="다음 학생 아지트" onClick={() => browse(1)} disabled={roster.length < 2}>다음 →</button>
          </div>
          <button type="button" onClick={onClose}>학생 서재로</button>
        </nav>
        {snapshots.get(student.uid)?.progress?.level != null && <span className="hideout-level">독서 레벨 <strong>{snapshots.get(student.uid).progress.level}</strong></span>}
      </header>
      <ReadingHideout key={`${classId}:${student.uid}`} classId={classId} user={user} student={student} readOnly
        initialView={snapshots.has(student.uid) ? { classId, uid: student.uid, value: snapshots.get(student.uid) } : null}
        onLoaded={remember} characterOn={characterOn} petOn={petOn} petFeed={feed}
        onDisabled={onClose} onExit={() => setViewingUid(null)} exitLabel="전체 아지트" hideExitButton hideHeading />
    </div>}
  </section>;
}
