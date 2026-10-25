"use client";

// =============================================================
// 반 입장 화면 (학생) — 책방은 반별 공간이라 참여 코드가 필요합니다.
// -------------------------------------------------------------
// 교사가 미리 만들어 둔 반의 참여 코드를 입력하면 그 반에 소속됩니다.
// 코드 확인은 서버 함수(joinClassWithCode)가 하고, **연달아 3번 틀리면
// 5분 동안** 입력을 받지 않습니다(셈은 lib/joinLockout.js). 화면은 서버가
// 돌려준 남은 기회 · 풀리는 시각을 적기만 합니다 — 화면에서 센 값은
// 새로고침이면 풀리므로 잠금의 근거가 될 수 없습니다.
// =============================================================
import { useEffect, useState } from "react";
import { joinClassWithCode } from "@/lib/store";
import { setSelectedClassId } from "@/lib/classroom";
import { getCurrentUser } from "@/lib/user";
import { isFirebaseConfigured } from "@/lib/firebase";
import { JOIN_MAX_FAILS } from "@/lib/joinLockout";

// 남은 시간 'm분 s초' — 잠금은 5분이라 분·초면 충분합니다.
function leftLabel(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${String(s).padStart(2, "0")}초` : `${s}초`;
}

function messageOf(res) {
  switch (res.reason) {
    case "wrong":
      return res.triesLeft > 0
        ? `참여 코드가 맞지 않아요. 앞으로 ${res.triesLeft}번 더 틀리면 5분 동안 입력할 수 없어요.`
        : "참여 코드가 맞지 않아요.";
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
  // 잠긴 동안 풀리는 시각(ms) — 0이면 잠기지 않음.
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // 잠긴 동안만 1초마다 남은 시간을 다시 그립니다.
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(0);
        setError("");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil > now;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || checking || locked) return;
    setChecking(true);
    setError("");
    try {
      const res = await joinClassWithCode(code, getCurrentUser());
      if (res.ok) {
        // 소속은 서버에 기록됐습니다 — 기기를 바꿔도 로그인하면 그대로 입장.
        setSelectedClassId(res.classId);
        return;
      }
      if (res.reason === "locked") {
        setNow(Date.now());
        setLockedUntil(res.lockedUntil || Date.now() + 5 * 60 * 1000);
        setCode("");
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
            disabled={locked}
            className="class-entry-input"
            aria-label="참여 코드"
            aria-describedby="class-entry-msg"
          />
          <button type="submit" className="btn-primary" disabled={checking || locked}>
            {checking ? "확인 중..." : "입장"}
          </button>
        </form>
        <div id="class-entry-msg" aria-live="polite">
          {locked ? (
            <p className="class-entry-error">
              참여 코드를 {JOIN_MAX_FAILS}번 틀려 잠시 입력할 수 없어요.{" "}
              <strong>{leftLabel(lockedUntil - now)}</strong> 뒤에 다시 입력해 주세요.
            </p>
          ) : (
            error && <p className="class-entry-error">{error}</p>
          )}
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
