"use client";

// =============================================================
// 내 프로필 모달 — 상단바 프로필 메뉴에서 열림
// -------------------------------------------------------------
// · 학생: 모두 읽기 전용(실명·학번은 선생님만 수정 — 서버 규칙에서도 강제).
// · 교사: 실명만 수정. 표시 이름도 실명이라 함께 바꿉니다.
// (닉네임·아바타 이모지 기능은 없앴습니다 — 화면 이름은 늘 실명)
// =============================================================
import { backdropClose } from "@/lib/modal";
import { useState } from "react";
import { updateMyProfile } from "@/lib/store";
import { isTeacher } from "@/lib/user";

export default function ProfileModal({ user, onClose }) {
  const teacherRole = isTeacher(user);
  const [realName, setRealName] = useState(user.realName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = teacherRole && realName.trim() !== (user.realName || "");

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateMyProfile(
        user.uid,
        { realName: realName.trim(), displayName: realName.trim() || "선생님" }
      );
      setSaved(true);
      setTimeout(onClose, 700);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" {...backdropClose(onClose)}>
      <div className="modal student-edit-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="btn-close modal-close-float"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>

        <h2 className="student-edit-title">내 프로필</h2>

        <div className="student-edit-fields">
          <div className="student-edit-field">
            <span>실명</span>
            {teacherRole ? (
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="실명"
                maxLength={30}
              />
            ) : (
              <div className="student-edit-value">{user.realName || "—"}</div>
            )}
          </div>
          {!teacherRole && (
            <>
              <div className="student-edit-field">
                <span>학번</span>
                <div className="student-edit-value">{user.studentId || "—"}</div>
              </div>
            </>
          )}
          <div className="student-edit-field">
            <span>이메일</span>
            <div className="student-edit-value">{user.email || "—"}</div>
          </div>
        </div>

        {!teacherRole && (
          <p className="profile-modal-hint">
            실명·학번은 선생님만 수정할 수 있어요. 게시물과 채팅에는 실명이
            표시됩니다.
          </p>
        )}

        <div className="student-edit-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            닫기
          </button>
          {teacherRole && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saved ? "저장했어요 ✓" : saving ? "저장 중…" : "저장"}
          </button>
          )}
        </div>

      </div>

    </div>
  );
}
