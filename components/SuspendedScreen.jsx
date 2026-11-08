"use client";
// =============================================================
// 사용 중지된 계정의 화면 — 선생님이 '사용 중지'한 학생(전학 등)
// -------------------------------------------------------------
// 규칙이 그 계정의 읽기 · 쓰기를 모두 막으므로(firestore.rules의 isSuspendedMe) 본문을
// 그리지 않고 이 안내만 둡니다. 남긴 글과 그림은 지워지지 않고 반 친구들이 읽습니다.
// 선생님이 '다시 사용'을 누르면 다음 로그인부터 원래대로 돌아옵니다.
// =============================================================
import { signOutUser } from "@/lib/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import { setRoleOverride } from "@/lib/user";
import "./SuspendedScreen.css";

export function isSuspendedUser(user) {
  return !!user && user.suspended === true && user.role !== "teacher" && user.role !== "admin";
}

export default function SuspendedScreen({ user }) {
  return (
    <main className="suspended-screen" role="alert">
      <div className="suspended-card">
        <span className="suspended-badge">사용 중지</span>
        <h1>이 계정은 사용이 중지되었어요</h1>
        <p>
          {user?.realName ? `${user.realName} 학생의 ` : ""}계정을 선생님이 사용 중지했어요. 지금은 책방에
          들어가거나 글을 입력할 수 없습니다.
        </p>
        <p className="suspended-sub">그동안 남긴 글과 그림은 지워지지 않고 그대로 보관됩니다. 다시 쓰려면 선생님께 말씀해 주세요.</p>
        {isFirebaseConfigured
          ? <button type="button" className="btn-primary" onClick={() => signOutUser().then(() => { window.location.href = "/"; })}>로그아웃</button>
          : <button type="button" className="btn-primary" onClick={() => { setRoleOverride("teacher"); window.location.reload(); }}>체험: 선생님 화면으로 돌아가기</button>}
      </div>
    </main>
  );
}
