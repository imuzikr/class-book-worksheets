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
import { characterImage, characterName } from "./reading/CharacterChooser";
import { PetProfileField } from "./reading/PetCard";

// character: 학생 캐릭터를 쓰는 반이면 지금 캐릭터({ number, style }), 아니면 null.
// onChangeCharacter: '바꾸기' — 이 창을 닫고 고르기 창을 엽니다(UserProfile).
// pet: 학생 펫을 쓰는 반이고 알을 받았으면 { classId, mirror } — 단계는 열 때 한 번 서버에 묻습니다.
export default function ProfileModal({ user, onClose, character = null, onChangeCharacter = null, pet = null }) {
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
          {!teacherRole && character && (
            <div className="student-edit-field">
              <span>내 캐릭터</span>
              <div className="profile-character">
                <img src={characterImage(character)} alt="" width={56} height={56} />
                <span className="profile-character-name">{characterName(character)}</span>
                {onChangeCharacter && (
                  <button type="button" className="btn-ghost profile-character-change" onClick={onChangeCharacter}>
                    바꾸기
                  </button>
                )}
              </div>
            </div>
          )}
          {!teacherRole && pet?.mirror && (
            <div className="student-edit-field">
              <span>내 펫</span>
              <PetProfileField classId={pet.classId} mirror={pet.mirror} />
            </div>
          )}
        </div>

        {!teacherRole && (
          <p className="profile-modal-hint">
            실명·학번은 선생님만 수정할 수 있어요. 게시물과 채팅에는 실명이
            표시됩니다.{character && " 캐릭터는 언제든 바꿀 수 있고, 리더보드의 독서 여정 지도에서도 함께 걸어요."}
            {pet?.mirror && " 펫은 독서로 얻은 경험치로 자라요(과일 경험치는 빼고)."}
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
