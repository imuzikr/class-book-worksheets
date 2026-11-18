"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchReadingHideout } from "@/lib/data/readingHideout";
import { HIDEOUT_SCENE, hideoutSceneProps } from "@/lib/readingHideout";
import { hideoutFloorPerspective, hideoutPerspectiveStyle } from "@/lib/readingHideoutPerspective";
import "./teacher-hideout-gallery.css";

const CONCURRENT_ROOMS = 4;
const studentName = (student) => student.realName || student.name || "학생";

// This overview is loaded only when the teacher asks to see the class's rooms.
// Each existing hideout endpoint validates class ownership and membership. No
// ledger subscriptions, presence channels, profile listeners, or writes are
// started. The endpoint still reads each ledger once to validate decor unlocks.
export default function TeacherHideoutGallery({ classId, user, roster = [], onSelect, onClose, onLoaded, onPlaza = null }) {
  const students = useMemo(() => {
    const seen = new Set();
    return roster.filter((student) => {
      if (!student?.uid || seen.has(student.uid)) return false;
      seen.add(student.uid);
      return true;
    });
  }, [roster]);
  const rosterKey = JSON.stringify(students.map((student) => student.uid));
  const identity = JSON.stringify([classId || "", user?.uid || "", rosterKey]);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [results, setResults] = useState({ identity: null, rooms: new Map() });
  const queueRef = useRef(null);
  const headingRef = useRef(null);
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [identity]);

  useEffect(() => {
    let current = true;
    let active = 0;
    const uids = JSON.parse(rosterKey);
    const queue = [];
    const pending = new Set();
    const update = (uid, value) => {
      if (!current || identityRef.current !== identity) return;
      setResults((previous) => {
        if (previous.identity !== identity) return previous;
        const rooms = new Map(previous.rooms);
        rooms.set(uid, value);
        return { identity, rooms };
      });
    };
    function pump() {
      while (current && identityRef.current === identity && active < CONCURRENT_ROOMS && queue.length) {
        const uid = queue.shift();
        active += 1;
        Promise.resolve().then(() => {
          if (!current || identityRef.current !== identity) return null;
          return fetchReadingHideout(classId, uid);
        }).then((value) => {
          if (current && identityRef.current === identity && value) {
            update(uid, { status: "ready", value });
            loadedRef.current?.(uid, value);
          }
        }).catch((error) => {
          update(uid, { status: "error", message: error?.message || "아지트를 불러오지 못했어요." });
        }).finally(() => {
          pending.delete(uid);
          active -= 1;
          if (current) pump();
        });
      }
    }
    function enqueue(uid) {
      if (!current || pending.has(uid) || !uids.includes(uid)) return;
      pending.add(uid);
      queue.push(uid);
      update(uid, { status: "loading" });
      pump();
    }
    setResults({ identity, rooms: new Map(uids.map((uid) => [uid, { status: "loading" }])) });
    queueRef.current = { identity, enqueue };
    if (classId && user?.uid) uids.forEach(enqueue);
    else uids.forEach((uid) => update(uid, { status: "error", message: "반과 선생님 계정을 확인해 주세요." }));
    return () => {
      current = false;
      queue.length = 0;
      if (queueRef.current?.identity === identity) queueRef.current = null;
    };
  }, [classId, user?.uid, rosterKey, identity]);

  // A class/account change must never flash the preceding class's room cards
  // while React is waiting to clean up the old queue.
  const rooms = results.identity === identity ? results.rooms : new Map();
  const ready = students.filter((student) => rooms.get(student.uid)?.status === "ready").length;
  const loading = students.filter((student) => !rooms.has(student.uid) || rooms.get(student.uid).status === "loading").length;
  const failed = students.length - ready - loading;
  function retry(uid) {
    if (queueRef.current?.identity === identity) queueRef.current.enqueue(uid);
  }

  return <section className="teacher-hideout-gallery" aria-label="우리 반 아지트">
    <header className="teacher-hideout-gallery-heading">
      <div><h2 ref={headingRef} tabIndex={-1}>우리 반 아지트 <span>{students.length}</span></h2><p>학생을 고르면 저장된 아지트를 둘러볼 수 있어요.</p></div>
      {/* '광장으로'(선생님 요청 · 2026년 11월 — 아지트를 보다가 곧바로 책 광장으로) · '학생 서재로' — 같은 크기 두 칸 */}
      {(onPlaza || onClose) && <div className="teacher-hideout-gallery-actions">
        {onPlaza && <button type="button" className="btn-ghost" onClick={onPlaza} title="책 광장으로 가요">광장으로</button>}
        {onClose && <button type="button" className="btn-ghost" onClick={onClose}>학생 서재로</button>}
      </div>}
    </header>
    {students.length ? <>
      <p className="teacher-hideout-gallery-status" role="status" aria-live="polite" aria-atomic="true">
        {loading ? `${students.length}명 중 ${ready}명의 아지트를 불러왔어요.` : failed ? `${ready}명의 아지트를 불러왔어요. ${failed}명은 다시 불러올 수 있어요.` : `${students.length}명의 아지트가 모두 준비됐어요.`}
      </p>
      <div className="teacher-hideout-gallery-grid">
        {students.map((student) => <RoomCard key={student.uid} student={student} result={rooms.get(student.uid)} onSelect={onSelect} onRetry={() => retry(student.uid)} />)}
      </div>
    </> : <div className="teacher-hideout-gallery-empty"><h3>아직 이 반에 들어온 학생이 없어요.</h3><p>학생이 참여하면 이곳에서 아지트를 볼 수 있어요.</p></div>}
  </section>;
}

function RoomCard({ student, result, onSelect, onRetry }) {
  const name = studentName(student);
  const label = <span className="teacher-hideout-gallery-student">{student.studentId && <small>{student.studentId}</small>}<strong>{name}</strong></span>;
  if (result?.status === "ready") return <article className="teacher-hideout-gallery-card">
    <button type="button" className="teacher-hideout-gallery-open" data-hideout-student={student.uid} onClick={() => onSelect?.(student.uid, result.value)} aria-label={`${name}의 아지트 보기`}>
      <RoomPreview room={result.value.room} name={name} />
      <span className="teacher-hideout-gallery-caption">{label}<span aria-hidden="true">보기 →</span></span>
    </button>
  </article>;
  return <article className="teacher-hideout-gallery-card" aria-label={`${name}의 아지트`}>
    <div className={`teacher-hideout-gallery-placeholder${result?.status === "error" ? " is-error" : ""}`}>
      {result?.status === "error" ? <><p>{result.message}</p><button type="button" onClick={onRetry} aria-label={`${name}의 아지트 다시 불러오기`}>다시 불러오기</button></> : <span>불러오는 중…</span>}
    </div>
    <div className="teacher-hideout-gallery-caption">{label}</div>
  </article>;
}

function RoomPreview({ room, name }) {
  // 학생이 옮긴 자리 · 뒤집기 · 돌리기(아지트 2단계)까지 그대로 — 서버가 맞춰 보낸 배치(room.arrange). 세로로 놓은 침대는 아지트 무대처럼
  // 원근을 입혀(lib/readingHideoutPerspective.js — 장면 1px의 길이는 이 그림 칸의 폭으로 셈: teacher-hideout-gallery.css의 --hideout-unit)
  const props = useMemo(() => hideoutSceneProps(room.layout, room.arrange), [room.layout, room.arrange]);
  return <span className="teacher-hideout-gallery-scene" role="img" aria-label={`${name}이 꾸민 아지트 미리보기`}>
    <img className="teacher-hideout-gallery-background" src={HIDEOUT_SCENE.background} width={HIDEOUT_SCENE.width} height={HIDEOUT_SCENE.height} alt="" loading="lazy" draggable={false} />
    {props.map((prop) => <img key={prop.id} className={`teacher-hideout-gallery-prop${prop.flip ? " is-flipped" : ""}`} src={prop.src} alt="" loading="lazy" draggable={false}
      style={{ left: `${prop.x / HIDEOUT_SCENE.width * 100}%`, top: `${prop.y / HIDEOUT_SCENE.height * 100}%`, width: `${prop.width / HIDEOUT_SCENE.width * 100}%`, zIndex: prop.z,
        ...hideoutPerspectiveStyle(hideoutFloorPerspective(prop), prop.flip) }} />)}
  </span>;
}
