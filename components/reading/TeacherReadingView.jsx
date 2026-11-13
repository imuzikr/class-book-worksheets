"use client";
// =============================================================
// 교사의 책나눔 — 왼쪽 반 학생 명단 · 오른쪽 고른 학생의 책나눔(읽기 전용)
// 선생님 결정: 책꽂이(한때 이름이 '서재') · 독서 발자국 · 한 권의 책(감상)까지 전부 보입니다.
// 읽기는 /api/reading?uid= — 서버가 담당 교사 · 관리자이고 그 학생이 이 반
// 소속인지 확인합니다(lib/server/readingService.js의 getReading).
// 명단은 페이지가 이미 받아 둔 useClassRoster(학번순)를 그대로 씁니다(읽기 0).
//
// **책 광장의 입구는 명단 위의 '책 광장 들어가기'입니다**(광장을 켠 반 — 선생님 신고로 세움).
// 책 광장은 반 전체의 자리라 고른 학생과 무관하게, **학생이 한 명도 없는 반에서도** 들어갑니다.
// 한때 길이 고른 학생 화면(ReadingHub)의 셋째 탭 하나뿐이라 학생이 없는 반에서는 탭 줄 자체가 없었고
// (주소에 ?tab=plaza를 붙여도 안 열림), 학생이 있는 반에서도 '○○의 독서 여정' 안에 섞여 입구로 보이지 않았습니다.
// 그 탭은 그대로 두었습니다(같은 광장으로 감) — 입구를 다시 그 탭 하나로 줄이지 마세요.
// =============================================================
import { useState } from "react";
import ReadingHub, { TeacherPlaza } from "./ReadingHub";

// 고른 학생은 주소(?student=)가 듭니다 — 리더보드의 '책꽂이로 이동'이 그 학생을 짚어 열고,
// 새로고침해도 그 학생입니다. 명단을 누르면 주소만 바꿉니다(replace).
export default function TeacherReadingView({ classId, user, roster = [], studentUid = null, onPickStudent, plazaOn = false, initialTab = "library", ...hubProps }) {
  const student = roster.find((s) => s.uid === studentUid) || roster[0] || null;
  // 책 광장에 들어가 있는가 — 주소의 ?tab=plaza로 열었으면 처음부터(학생 화면과 같은 주소). 나가면 명단으로 돌아옵니다.
  const [plazaOpen, setPlazaOpen] = useState(initialTab === "plaza");
  if (plazaOn && plazaOpen) {
    return (
      <div className="reading-teacher">
        <TeacherPlaza key={classId} classId={classId} user={user} characterOn={hubProps.characterOn} classroom={hubProps.classroom} onExit={() => setPlazaOpen(false)} />
      </div>
    );
  }
  // 광장에서 나온 뒤 서는 학생 화면은 첫 탭부터 — 주소에 tab=plaza가 남아 있어도 그 화면이 다시 광장을 열지 않게.
  const hubTab = plazaOn && initialTab === "plaza" ? "library" : initialTab;
  return (
    <div className="reading-teacher">
      <aside className="reading-teacher-rail" aria-label="책 광장 입구와 학생 명단">
        {plazaOn && (
          <button type="button" className="reading-teacher-plaza" onClick={() => setPlazaOpen(true)}>
            <strong>책 광장 들어가기 <span aria-hidden="true">→</span></strong>
            <small>{hubProps.classroom?.on ? "광장의 포털로 교실에도 가요" : "학생들의 책과 글을 함께 봐요"}</small>
          </button>
        )}
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
        {student ? <ReadingHub key={`${classId}:${student.uid}`} classId={classId} user={user} isTeacher student={{ uid: student.uid, name: student.name }} plazaOn={plazaOn} initialTab={hubTab} {...hubProps} />
          : <div className="reading-empty"><h3>학생을 기다리고 있어요.</h3><p>학생이 참여 코드로 들어오면 이곳에서 학생마다의 책나눔을 볼 수 있어요.{plazaOn ? " 책 광장은 지금도 ‘책 광장 들어가기’로 둘러볼 수 있어요." : ""}</p></div>}
      </div>
    </div>
  );
}
