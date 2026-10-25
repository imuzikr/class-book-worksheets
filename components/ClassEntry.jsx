"use client";

// =============================================================
// 반 입장 화면 (학생) — 책방은 반별 공간이라 참여 코드가 필요합니다.
// -------------------------------------------------------------
// 교사가 미리 만들어 둔 반의 참여 코드를 입력하면 그 반에 소속됩니다.
// 코드가 맞는지는 보안 규칙이 서버에서 다시 확인합니다(joinClassWithCode).
// =============================================================
import { useState } from "react";
import { joinClassWithCode } from "@/lib/store";
import { setSelectedClassId } from "@/lib/classroom";
import { getCurrentUser } from "@/lib/user";
import { isFirebaseConfigured } from "@/lib/firebase";

function messageOf(res) {
  switch (res.reason) {
    case "wrong":
      return "참여 코드가 맞지 않아요. 선생님이 알려 준 코드를 다시 확인해 주세요.";
    case "expired":
      return "만료된 참여 코드예요. 선생님께 새 코드를 받아 주세요.";
    case "archived":
      return "지금은 들어갈 수 없는 반이에요. 선생님께 확인해 주세요.";
    case "invalid":
      return "참여 코드를 입력해 주세요.";
    default:
      return "참여 코드를 확인하지 못했어요. 잠시 후 다시 시도하고, 계속 안 되면 선생님께 알려 주세요.";
  }
}

export default function ClassEntry() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || checking) return;
    setChecking(true);
    setError("");
    try {
      const res = await joinClassWithCode(code, getCurrentUser());
      if (res.ok) {
        // 소속은 서버에 기록됐습니다 — 기기를 바꿔도 로그인하면 그대로 입장.
        setSelectedClassId(res.classId);
        return;
      }
      setError(messageOf(res));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="class-entry">
      <div className="class-entry-card">
        <div className="class-entry-emoji" aria-hidden="true">🧩</div>
        <h2>우리 반에 들어가기</h2>
        <p>선생님이 알려 준 우리 반 참여 코드를 입력해 주세요.</p>
        <form onSubmit={handleSubmit} className="class-entry-form">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            placeholder="예: MATH31"
            maxLength={12}
            autoFocus
            className="class-entry-input"
            aria-label="참여 코드"
            aria-describedby="class-entry-msg"
          />
          <button type="submit" className="btn-primary" disabled={checking}>
            {checking ? "확인 중..." : "입장"}
          </button>
        </form>
        <div id="class-entry-msg" aria-live="polite">
          {error && <p className="class-entry-error">{error}</p>}
        </div>
        {!isFirebaseConfigured && (
          <p className="class-entry-hint">
            데모 코드 — <code>MATH31</code> (3학년 1반) · <code>INFO32</code>{" "}
            (3학년 2반) · <code>BOND33</code> (3학년 3반)
          </p>
        )}
      </div>
    </div>
  );
}
