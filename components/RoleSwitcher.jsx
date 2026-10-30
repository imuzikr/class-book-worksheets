"use client";

// =============================================================
// [개발용] 관리자/학생 보기 전환 토글
// -------------------------------------------------------------
// 실제 로그인을 붙이기 전, 두 역할의 화면 차이(공지 작성 버튼,
// 실명 확인 등)를 바로 확인하기 위한 도구입니다.
// 운영 배포 시 이 컴포넌트만 상단바에서 빼면 됩니다.
// =============================================================
import { useEffect, useState } from "react";
import { getCurrentUser, getDemoStudentSelection, setDemoStudentSelection, setRoleOverride } from "@/lib/user";
import { isFirebaseConfigured } from "@/lib/firebase";
import { DEMO_STUDENTS } from "@/lib/demoClassroom";
import { IconTeacher, IconStudent } from "./StatusIcons";
import "./role-switcher.css";

const ROLES = [
  { id: "admin", Icon: IconTeacher, label: "교사" },
  { id: "student", Icon: IconStudent, label: "학생" },
];

export default function RoleSwitcher() {
  // 하이드레이션 오류 방지를 위해 마운트 후에 현재 역할을 읽습니다
  const [role, setRole] = useState(null);
  const [studentUid, setStudentUid] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isFirebaseConfigured) return undefined;
    const sync = () => {
      const currentRole = getCurrentUser()?.role;
      setRole(currentRole === "teacher" ? "admin" : currentRole);
      setStudentUid(getDemoStudentSelection()?.uid ?? "");
    };
    sync();
    window.addEventListener("role-change", sync);
    return () => window.removeEventListener("role-change", sync);
  }, []);

  function choose(r) {
    setError(setRoleOverride(r) ? "" : "체험 화면을 전환하려면 브라우저의 사이트 저장을 허용해 주세요.");
  }

  if (isFirebaseConfigured) return null;

  return (
    <div className="demo-role-preview">
      <div className="role-switch" role="group" aria-label="체험 화면 전환">
        {ROLES.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            className={role === id ? "active" : ""}
            aria-pressed={role === id}
            onClick={() => choose(id)}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <select
        className="demo-student-select"
        aria-label="체험 학생"
        title="학생을 선택하면 해당 학생의 활동과 내 서재를 볼 수 있어요"
        value={role === "student" ? studentUid : ""}
        onChange={(event) => setError(setDemoStudentSelection(event.target.value) ? "" : "체험 학생을 전환하지 못했어요. 브라우저의 사이트 저장을 확인해 주세요.")}
      >
        <option value="" disabled>체험 학생 선택</option>
        {DEMO_STUDENTS.map((student) => <option key={student.uid} value={student.uid}>{student.studentId} {student.realName}</option>)}
      </select>
      {error && <span className="demo-preview-error" role="alert">{error}</span>}
    </div>
  );
}
