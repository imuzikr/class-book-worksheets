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
  const snapshots = useRef(new Map());
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
  const remember = useCallback((uid, value) => { snapshots.current.set(uid, value); }, []);
  const select = useCallback((uid, value) => {
    if (value) snapshots.current.set(uid, value);
    focusCard.current = uid;
    focusRoomHeading.current = true;
    setViewingUid(uid);
  }, []);
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
      <nav className="teacher-hideout-navigation" aria-label="학생 아지트 둘러보기">
        <button type="button" onClick={() => setViewingUid(null)}>전체 아지트</button>
        <div className="teacher-hideout-sequence">
          <button type="button" aria-label="이전 학생 아지트" onClick={() => browse(-1)} disabled={roster.length < 2}>← 이전</button>
          <p ref={heading} tabIndex={-1} aria-live="polite"><strong>{student.studentId ? `${student.studentId} ` : ""}{student.name || "학생"}</strong><span>{index + 1} / {roster.length}</span></p>
          <button type="button" aria-label="다음 학생 아지트" onClick={() => browse(1)} disabled={roster.length < 2}>다음 →</button>
        </div>
        <button type="button" onClick={onClose}>학생 서재로</button>
      </nav>
      <ReadingHideout key={`${classId}:${student.uid}`} classId={classId} user={user} student={student} readOnly
        initialView={snapshots.current.has(student.uid) ? { classId, uid: student.uid, value: snapshots.current.get(student.uid) } : null}
        onLoaded={remember} characterOn={characterOn} petOn={petOn} petFeed={feed}
        onDisabled={onClose} onExit={() => setViewingUid(null)} exitLabel="전체 아지트" hideExitButton />
    </div>}
  </section>;
}
