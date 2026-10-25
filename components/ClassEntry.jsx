"use client";

// =============================================================
// 반 입장 화면 (학생) — 책방은 반별 공간이라 참여 코드가 필요합니다.
// -------------------------------------------------------------
// 교사가 미리 만들어 둔 반의 참여 코드를 입력하면 그 반에 소속됩니다.
// 코드가 맞는지는 보안 규칙이 서버에서 다시 확인합니다(joinClassWithCode).
// =============================================================
import { useEffect, useState } from "react";
import { becomeTeacherWithCode, joinClassWithCode } from "@/lib/store";
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
  // 선생님이세요? — 교사 가입 코드로 학생 → 선생님. 가입할 때 코드를 틀렸거나
  // 학생으로 가입해 버린 선생님이 여기서 바로잡습니다.
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [tCode, setTCode] = useState("");
  const [tError, setTError] = useState("");
  const [tBusy, setTBusy] = useState(false);

  // 가입 화면에서 교사 가입 코드가 맞지 않아 학생으로 들어온 경우 —
  // 그 사실을 알리고 칸을 펴 둡니다(?teacherCode=wrong|error).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const why = params.get("teacherCode");
      if (!why) return;
      setTeacherOpen(true);
      setTError(
        why === "wrong"
          ? "교사 가입 코드가 맞지 않아 학생으로 가입됐어요. 코드를 다시 넣어 주세요."
          : "선생님으로 바꾸지 못했어요. 코드를 다시 넣어 주세요."
      );
      params.delete("teacherCode");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    } catch {
      /* 주소를 못 읽어도 입장 화면은 그대로 */
    }
  }, []);

  async function handleTeacher(e) {
    e.preventDefault();
    if (tBusy) return;
    if (tCode.trim().length < 4) {
      setTError("교사 가입 코드를 입력해 주세요.");
      return;
    }
    setTBusy(true);
    setTError("");
    const res = await becomeTeacherWithCode(getCurrentUser()?.uid, tCode);
    if (res.ok) {
      // 역할이 바뀐 사용자로 화면을 다시 그립니다
      window.location.reload();
      return;
    }
    setTBusy(false);
    setTError(
      res.reason === "wrong"
        ? "교사 가입 코드가 맞지 않아요. 이 사이트를 운영하는 분께 확인해 주세요."
        : "선생님으로 바꾸지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
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
        {isFirebaseConfigured && (
          <div className="class-entry-teacher">
            {!teacherOpen ? (
              <button type="button" className="class-entry-teacher-toggle" onClick={() => setTeacherOpen(true)}>
                선생님이세요? 교사 가입 코드 넣기
              </button>
            ) : (
              <form onSubmit={handleTeacher} className="class-entry-form">
                <input
                  type="text"
                  value={tCode}
                  onChange={(e) => { setTCode(e.target.value); setTError(""); }}
                  placeholder="교사 가입 코드"
                  maxLength={40}
                  autoComplete="off"
                  className="class-entry-input"
                  aria-label="교사 가입 코드"
                />
                <button type="submit" className="btn-primary" disabled={tBusy}>
                  {tBusy ? "확인 중..." : "선생님으로"}
                </button>
              </form>
            )}
            {tError && <p className="class-entry-error" role="alert">{tError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
