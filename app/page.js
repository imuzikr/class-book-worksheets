"use client";

// =============================================================
// 메인 랜딩 페이지
//   - 가운데: 디자인 시안 그대로 — 머리 제목 + 흰 카드(함께 책 읽는 일러스트
//     public/landing-reading.webp + '생각 적어보기' → 회원가입 창)
//   - 오른쪽 상단: 로그인 / 회원가입 버튼 (클릭 시 모달)
// -------------------------------------------------------------
// 실서비스 모드: 구글 계정 하나로 로그인/회원가입합니다(lib/auth.js).
// 학교 도메인 제한도 등록 코드도 없습니다 — 반에 들어가는 관문은 로그인 뒤
// 교사가 미리 만든 **참여 코드**입니다(components/ClassEntry.jsx).
// 회원가입은 학생/선생님을 먼저 고르며, 선생님은 관리자 승인 후 권한이
// 부여됩니다(승인 전에는 학생 화면).
// 데모 모드(Firebase 미설정)에서는 임시 사용자로 곧바로 입장합니다.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/lib/authContext";
import { backdropClose } from "@/lib/modal";
import { signInWithGoogle } from "@/lib/auth";
import { becomeTeacherWithCode } from "@/lib/store";
import { isInAppBrowser } from "@/lib/browser";
import SiteFooter from "@/components/SiteFooter";
import { IconLogo } from "@/components/StatusIcons";

// Firebase 인증 오류 코드를 한국어 메시지로
function authErrorMessage(code) {
  const map = {
    "auth/popup-closed-by-user": "구글 로그인 창이 닫혔습니다. 카카오톡 등 앱 안에서 열었다면 브라우저(Chrome·Safari)에서 다시 시도해 주세요.",
    "auth/popup-blocked": "브라우저가 로그인 창을 막았어요. 팝업 차단을 해제한 뒤 다시 시도해 주세요.",
    "auth/cancelled-popup-request": "로그인 창이 중복으로 열려 취소됐어요. 다시 시도해 주세요.",
    "auth/unauthorized-domain": "이 주소에서는 구글 로그인을 쓸 수 없어요. 선생님께 알려 주세요.",
    "auth/operation-not-allowed": "구글 로그인이 꺼져 있어요. 선생님께 알려 주세요.",
    "auth/network-request-failed": "네트워크 연결을 확인하고 다시 시도해 주세요.",
    "auth/too-many-requests": "잠시 후 다시 시도해 주세요.",
    "auth/profile-check-failed":
      "계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    "auth/profile-create-failed":
      "가입 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    // 프로필을 읽지 못해 막힌 경우(주로 보안 규칙 문제) — '비밀번호가 틀렸나'
    // 하고 헤매지 않도록 따로 구분해 줍니다.
    "permission-denied":
      "계정 정보를 읽지 못했습니다. 잠시 후 다시 시도하고, 계속 안 되면 선생님께 알려 주세요.",
  };
  if (map[code]) return map[code];
  // 매핑에 없는 코드는 원인을 짐작할 수 없게 뭉뚱그리지 않고, 코드 값을
  // 그대로 붙여 보여 줍니다 — 화면 문구만으로는 원인을 알 수 없어 학생이
  // 겪은 걸 그대로 전해도 재현·진단이 안 되던 문제(예: 구글 계정만 가끔
  // 가입이 안 된다는 신고)를 다음번엔 코드 값으로 바로 짚을 수 있게 합니다.
  return code ? `로그인에 실패했습니다. (${code})` : "로그인에 실패했습니다. 다시 시도해 주세요.";
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState(null); // null | 'login' | 'signup'
  const [signupRole, setSignupRole] = useState(null); // 회원가입 시 선택: 'student' | 'teacher'
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 선생님으로 가입할 때 넣는 교사 가입 코드(배포한 사람이 알려 줌)
  const [teacherCode, setTeacherCode] = useState("");
  // 선생님으로 바꾸는 동안은 '로그인됨 → /books' 자동 이동을 잠시 멈춥니다 —
  // 먼저 넘어가 버리면 학생으로 읽힌 화면이 남고 코드 결과도 못 알립니다.
  const holdRedirect = useRef(false);
  // 카카오톡 등 인앱 브라우저 — 구글이 이 안에서의 OAuth 로그인 자체를
  // 막습니다. 가입·로그인이 구글 하나뿐이라 여기서 미리 알려야 합니다. 서버에는 navigator가 없어 마운트
  // 후에만 판별합니다.
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  // ── 로그인/회원가입 모달 접근성 ──
  const firstFieldRef = useRef(null);

  // Escape로 닫기 — 마우스로만 닫을 수 있으면 키보드 사용자가 갇힙니다.
  useEffect(() => {
    if (!authMode) return;
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); setAuthMode(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authMode]);

  // 열리면 첫 단추로 포커스를 옮겨 줍니다.
  useEffect(() => {
    if (authMode) firstFieldRef.current?.focus();
  }, [authMode]);

  // 모드 전환 시 역할 선택·오류 초기화
  function switchMode(mode) {
    setAuthMode(mode);
    setSignupRole(null);
    setError("");
  }

  // 이미 로그인되어 있으면 게시판으로
  //
  // 로그인한 사람에게는 이 페이지가 스쳐 지나가는 자리라, 첫 페인트 전에
  // app/layout.js의 스크립트가 랜딩을 숨겨 둡니다(지난 접속에서 남긴 힌트가
  // 있을 때만). 여기서 인증이 확정되면 그 표시를 지웁니다 — 로그인 상태면
  // 어차피 곧 넘어가고, 아니면 랜딩을 바로 보여 줘야 하기 때문입니다.
  // (세션이 만료됐거나 다른 기기에서 로그아웃한 경우가 후자입니다)
  // 판정은 AuthProvider가 한 번만 합니다 — 여기서 따로 구독하면 같은
  // 프로필 조회를 한 번 더 치릅니다(lib/authContext.jsx).
  // status가 아직 "loading"이면 표시를 그대로 둡니다. 로그인 상태로
  // 밝혀지면 어차피 넘어가고, 아니면 그때 지워 랜딩을 보여 줍니다.
  const { status: authStatus } = useAuth();
  useEffect(() => {
    if (!isFirebaseConfigured) {
      document.documentElement.removeAttribute("data-auth-pending");
      return;
    }
    if (authStatus === "in" && !holdRedirect.current) router.replace("/books");
    else if (authStatus === "out") {
      document.documentElement.removeAttribute("data-auth-pending");
    }
  }, [authStatus, router]);

  async function handleGoogle() {
    if (!isFirebaseConfigured) {
      // 데모 모드 — 바로 입장
      router.push("/books");
      return;
    }
    const wantTeacher = authMode === "signup" && signupRole === "teacher";
    if (wantTeacher && teacherCode.trim().length < 4) {
      setError("교사 가입 코드를 입력해 주세요.");
      return;
    }
    setError("");
    setBusy(true);
    holdRedirect.current = wantTeacher;
    try {
      // 모두 학생으로 가입하고, 선생님이면 이어서 교사 가입 코드로 바꿉니다.
      // 대조는 보안 규칙이 합니다(앱은 그 코드를 읽지 못함).
      const user = await signInWithGoogle();
      if (wantTeacher && user?.role === "student") {
        const res = await becomeTeacherWithCode(user.uid, teacherCode);
        // 역할이 바뀐 사용자로 화면을 다시 그리려고 새로 불러옵니다. 코드가
        // 틀렸으면 학생으로 가입된 채 반 입장 화면에서 다시 넣게 안내합니다.
        window.location.assign(res.ok ? "/books" : `/books?teacherCode=${res.reason === "wrong" ? "wrong" : "error"}`);
        return;
      }
      holdRedirect.current = false;
      router.push("/books");
    } catch (err) {
      holdRedirect.current = false;
      setError(authErrorMessage(err?.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    {/* ── 상단 바: 로고(왼쪽) + 로그인/회원가입(오른쪽) — 배경 일러스트 바깥 ── */}
    <header className="landing-top">
      <span className="landing-logo">
        <IconLogo size={26} /> 책으로
      </span>
      <div className="landing-actions">
        <button className="btn-outline" onClick={() => switchMode("login")}>
          로그인
        </button>
        <button className="btn-primary" onClick={() => switchMode("signup")}>
          회원가입
        </button>
      </div>
    </header>

    <main className="landing">
      {/* ── 디자인 시안 그대로: 머리 제목 → 흰 카드(제목 · 그림 · 단추) ── */}
      <section className="hero">
        <h1 className="hero-title">책으로, 함께 읽고 생각을 나누다</h1>

        <div className="hero-card">
          <h2 className="hero-card-title">함께 읽고 생각을 나누는 공간</h2>
          <img
            className="hero-art"
            src="/landing-reading.webp"
            width={1654}
            height={725}
            alt="도서관 책상에 둘러앉은 네 친구가 책을 펼쳐 들고 이야기하고, 뒤에서 두 친구가 책장의 책을 고르는 그림"
          />
          <button
            type="button"
            className="hero-cta"
            onClick={() => switchMode("signup")}
          >
            생각 적어보기 →
          </button>
        </div>
      </section>
    </main>

      {/* ── 푸터: 브랜드 · 정책 및 약관 · 문의 (배경 이미지 영역 밖) ── */}
      <SiteFooter />

      {/* ── 로그인 / 회원가입 모달 ── */}
      {authMode && (
        <div className="modal-backdrop" {...backdropClose(() => setAuthMode(null))}>
          <div
            className="modal modal-auth"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id="auth-modal-title">{authMode === "login" ? "로그인" : "회원가입"}</h3>
              <button
                className="btn-close"
                onClick={() => setAuthMode(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="tab-row">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => switchMode("login")}
              >
                로그인
              </button>
              <button
                type="button"
                className={authMode === "signup" ? "active" : ""}
                onClick={() => switchMode("signup")}
              >
                회원가입
              </button>
            </div>

            {/* 회원가입 1단계 — 역할 선택 (실서비스만; 데모는 바로 입장) */}
            {isFirebaseConfigured && authMode === "signup" && !signupRole ? (
              <div className="signup-role-select">
                <p className="signup-role-q">어떤 역할로 가입하시나요?</p>
                <button
                  ref={firstFieldRef}
                  type="button"
                  className="signup-role-card"
                  onClick={() => setSignupRole("student")}
                >
                  <span className="signup-role-emoji">🎒</span>
                  <span className="signup-role-text">
                    <strong>학생</strong>
                    <small>가입한 뒤 선생님이 알려 준 참여 코드로 반에 들어가요.</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="signup-role-card"
                  onClick={() => setSignupRole("teacher")}
                >
                  <span className="signup-role-emoji">🧑‍🏫</span>
                  <span className="signup-role-text">
                    <strong>선생님</strong>
                    <small>반과 참여 코드를 만들고 독서 활동을 운영해요. (교사 가입 코드 필요)</small>
                  </span>
                </button>
              </div>
            ) : (
            <div className="form-grid">
              {authMode === "signup" && signupRole && (
                <>
                  <div className="signup-role-chosen">
                    <span>
                      {signupRole === "teacher" ? "🧑‍🏫 선생님" : "🎒 학생"}(으)로 가입
                    </span>
                    <button
                      type="button"
                      className="signup-role-change"
                      onClick={() => setSignupRole(null)}
                    >
                      역할 변경
                    </button>
                  </div>
                  {signupRole === "teacher" ? (
                    <>
                      <p className="signup-role-note">
                        이 사이트를 운영하는 분께 받은 <strong>교사 가입 코드</strong>를 넣고
                        구글 계정으로 가입하면 곧바로 선생님이 됩니다. 반과 참여 코드를
                        만들 수 있어요.
                      </p>
                      <input
                        type="text"
                        className="signup-teacher-code"
                        value={teacherCode}
                        onChange={(e) => { setTeacherCode(e.target.value); setError(""); }}
                        placeholder="교사 가입 코드"
                        aria-label="교사 가입 코드"
                        autoComplete="off"
                        maxLength={40}
                      />
                    </>
                  ) : (
                    <p className="signup-role-note">
                      구글 계정으로 가입한 뒤, 선생님이 알려 준 <strong>참여 코드</strong>를
                      입력하면 우리 반에 들어갑니다.
                    </p>
                  )}
                </>
              )}
              {authMode === "login" && (
                <p className="signup-role-note">
                  가입할 때 쓴 <strong>구글 계정</strong>으로 로그인합니다.
                </p>
              )}

              {inApp && isFirebaseConfigured && (
                <p className="auth-inapp-warning" role="alert">
                  ⚠️ 카카오톡 등 앱 안에서 열린 화면이에요. 구글 로그인은
                  여기서 막힐 수 있으니, 우측 상단 메뉴에서 &apos;다른
                  브라우저로 열기&apos;를 눌러 Chrome이나 Safari에서
                  다시 시도해 주세요.
                </p>
              )}

              {error && (
                <p className="auth-error" role="alert">{error}</p>
              )}

              <button
                ref={authMode === "login" ? firstFieldRef : undefined}
                type="button"
                className="btn-google"
                onClick={handleGoogle}
                disabled={busy}
              >
                <GoogleMark />{" "}
                {busy
                  ? "처리 중…"
                  : authMode === "signup"
                    ? "Google 계정으로 가입하기"
                    : "Google 계정으로 로그인"}
              </button>

              {!isFirebaseConfigured && (
                <div className="dev-note">
                  🔧 <strong>데모 모드</strong> — Firebase 미설정 상태라 구글 로그인 없이
                  임시 사용자로 입장합니다.
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
