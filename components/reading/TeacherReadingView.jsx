"use client";
// =============================================================
// 교사의 책나눔 — 왼쪽 반 학생 명단 · 오른쪽 고른 학생의 책나눔(읽기 전용)
// 선생님 결정: 서재 · 독서 발자국 · 한 권의 책(감상)까지 전부 보입니다.
// 읽기는 /api/reading?uid= — 서버가 담당 교사 · 관리자이고 그 학생이 이 반
// 소속인지 확인합니다(lib/server/readingService.js의 getReading).
// 명단은 페이지가 이미 받아 둔 useClassRoster(학번순)를 그대로 씁니다(읽기 0).
// =============================================================
import ReadingHub from "./ReadingHub";

// 고른 학생은 주소(?student=)가 듭니다 — 리더보드의 '서재로 이동'이 그 학생을 짚어 열고,
// 새로고침해도 그 학생입니다. 명단을 누르면 주소만 바꿉니다(replace).
export default function TeacherReadingView({ classId, user, roster = [], studentUid = null, onPickStudent, ...hubProps }) {
  const student = roster.find((s) => s.uid === studentUid) || roster[0] || null;
  return (
    <div className="reading-teacher">
      <aside className="reading-teacher-rail" aria-label="학생 명단">
        <h3>학생 명단 <span>{roster.length}</span></h3>
        {roster.length === 0 ? <p className="reading-muted">아직 이 반에 들어온 학생이 없어요.</p> : (
          <ol>
            {roster.map((s) => (
              <li key={s.uid}>
                <button type="button" className={student?.uid === s.uid ? "on" : ""} aria-current={student?.uid === s.uid ? "true" : undefined} onClick={() => onPickStudent?.(s.uid)}>
                  {s.studentId && <span className="reading-teacher-sid">{s.studentId}</span>}
                  <span className="reading-teacher-name">{s.name}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </aside>
      <div className="reading-teacher-main">
        {student ? <ReadingHub key={`${classId}:${student.uid}`} classId={classId} user={user} isTeacher student={{ uid: student.uid, name: student.name }} {...hubProps} />
          : <div className="reading-empty"><h3>학생을 기다리고 있어요.</h3><p>학생이 참여 코드로 들어오면 이곳에서 학생마다의 책나눔을 볼 수 있어요.</p></div>}
      </div>
    </div>
  );
}
