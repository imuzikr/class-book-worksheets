"use client";

// =============================================================
// 인증 (Firebase Authentication) — 구글 계정만
// -------------------------------------------------------------
// · 가입·로그인은 구글 계정 하나로 합니다(이메일·비밀번호 가입은 없습니다).
//   공개로 운영하는 앱이라 특정 학교 도메인이나 관리자 이메일을 코드에 박아
//   두지 않습니다 — 누구나 구글 계정으로 들어올 수 있고, **반에 들어가는
//   관문은 교사가 미리 만들어 둔 참여 코드**입니다(보안 규칙이 코드와
//   만료를 서버에서 확인합니다 — lib/data/classes.js의 joinClassWithCode).
// · 로그인 시 users/{uid} 프로필 문서를 보장(없으면 생성).
// · 역할(role)은 users/{uid}.role에서 읽습니다(서버 함수 · 커스텀 클레임 없음).
//   선생님은 교사 가입 코드로 스스로 바뀌고(lib/data/users.js의
//   becomeTeacherWithCode), 첫 관리자는 배포한 사람이 Firebase 콘솔에서 제
//   users 문서의 role을 'admin'으로 고쳐 지정합니다. (예전 배포처럼 role
//   클레임이 있으면 그것을 먼저 봅니다.)
// · 앱 전역의 동기 getCurrentUser()를 위해, 인증 상태가 바뀌면
//   lib/user.js의 _setAuthUser()로 현재 사용자 캐시를 갱신합니다.
// =============================================================
import { auth, db } from "./firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  _setAuthUser,
  splitWorkspaceName,
} from "./user";

// 프로필 만들기 + 실패 시 계정 되돌리기.
// 계정만 만들어지고 프로필이 없으면 로그인해도 프로필이 없어 막히는
// 어정쩡한 상태가 됩니다. 그래서 프로필 저장이 실패하면 방금 만든 계정을
// 지워, 다음 시도가 처음부터 다시 되게 풀어 줍니다.
async function createProfileOrRollback(fbUser, extra) {
  try {
    return await ensureUserProfile(fbUser, extra);
  } catch (err) {
    console.error("[가입] 프로필 저장 실패 — 계정을 되돌립니다:", err?.code, err?.message);
    try {
      await fbUser.delete();
    } catch {
      /* 삭제 실패해도 로그아웃은 진행 */
    }
    try {
      await signOut(auth);
    } catch {
      /* 이미 삭제되어 세션이 끊겼을 수 있음 */
    }
    throw Object.assign(
      new Error("가입 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."),
      { code: "auth/profile-create-failed", cause: err }
    );
  }
}

// users/{uid} 프로필 보장 — 없으면 생성하고 데이터를 반환합니다.
// 가입 흐름(signInWithGoogleInner)에서만 부릅니다 — 프로필을 읽기만 할
// 자리에서는 getDoc을 직접 쓰세요.
export async function ensureUserProfile(fbUser, extra = {}) {
  const ref = doc(db, "users", fbUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const emailPrefix = (fbUser.email || "").split("@")[0];
  // 학교 워크스페이스 계정 이름("21031홍길동")이면 학번·이름을 자동 분리
  const rawName =
    extra.realName || fbUser.displayName || emailPrefix || "이름 미설정";
  const ws = splitWorkspaceName(rawName);
  const realName = ws ? ws.realName : rawName;
  const profile = {
    email: fbUser.email ?? "",
    realName,
    displayName: realName, // 표시 이름 = 실명(닉네임 기능 없음)
    role: "student", // 기본 역할 — 선생님은 교사 가입 코드로, 그 밖은 관리자가 바꿈
    // 옛 '선생님 승인 신청' 표시(권한 아님) — 지금 화면은 넘기지 않습니다.
    requestedRole: extra.requestedRole === "teacher" ? "teacher" : null,
    studentId: ws ? ws.studentId : null,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

// Firebase 사용자 → 앱 사용자 객체(역할/프로필 포함)
async function buildAppUser(fbUser) {
  let role;
  try {
    const tokenResult = await fbUser.getIdTokenResult();
    role = tokenResult.claims.role;
  } catch {
    /* 토큰 조회 실패 시 프로필/기본값 사용 */
  }
  // 프로필은 '읽기'만 합니다 — 여기서 만들려 들면 안 됩니다.
  // 이 함수는 onAuthChange(로그인 상태 변화)에서도 불리는데, 구글 팝업이
  // 닫히는 순간 가입 흐름(signInWithGoogleInner)보다 먼저 실행됩니다. 여기서도
  // 만들면 두 곳이 같은 프로필을 겨루고, '선생님 신청' 표시(requestedRole)를
  // 모르는 쪽이 먼저 이기면 그 표시가 사라집니다. 프로필 생성은 가입 경로
  // (createProfileOrRollback) 한 곳만 합니다.
  const snap = await getDoc(doc(db, "users", fbUser.uid));
  if (!snap.exists()) {
    throw Object.assign(new Error("프로필이 아직 없습니다."), {
      code: "auth/profile-missing",
    });
  }
  const profile = snap.data();
  const finalRole = role || profile.role || "student";
  const isTeacherRole = finalRole === "admin" || finalRole === "teacher";

  // 예전 가입 계정: 실명 칸에 "21031홍길동"이 통째로 저장되어 있고 학번이
  // 비어 있으면, 표시 시점에 학번·이름으로 분리(규칙상 본인은 저장 불가 —
  // 저장값 정리는 교사가 학생 수정 모달에서).
  const rawRealName = profile.realName || fbUser.displayName || "이름 미설정";
  const ws = !profile.studentId ? splitWorkspaceName(rawRealName) : null;
  const realName = ws ? ws.realName : rawRealName;
  // 표시 이름 = 실명. 선생님은 실명이 비어 있으면 '선생님'.
  const shownName =
    isTeacherRole && (!profile.realName || realName === "이름 미설정")
      ? "선생님"
      : realName;

  // 자가 치유 — 예전 랜덤 닉네임('꿈꾸는 여우')이 저장된 계정은 표시 이름을
  // 실명으로 바꿉니다. 규칙은 본인이 displayName을 '저장된 realName과 같게'
  // 바꾸는 것만 허용합니다(실명이 저장된 경우에만 시도).
  if (profile.realName && profile.displayName !== profile.realName) {
    try {
      await updateDoc(doc(db, "users", fbUser.uid), { displayName: profile.realName });
    } catch {
      /* 규칙 미반영 등은 무시 — 화면에는 아래에서 실명을 씁니다 */
    }
  }

  return {
    uid: fbUser.uid,
    email: fbUser.email ?? "",
    role: finalRole,
    displayName: shownName,
    emoji: null,
    realName,
    studentId: profile.studentId ?? (ws ? ws.studentId : null),
    withdrawRequested: profile.withdrawRequested ?? false,
    // 지금 소속된 반 id 목록(공부방 급우 명단 공개 판정용) — lib/store.js의
    // joinClass가 반에 들어갈 때마다 이어붙입니다. 없으면 빈 배열.
    classIds: profile.classIds ?? [],
  };
}

// 인증 상태 구독 — 사용자 객체(또는 null)를 콜백으로 전달.
// 캐시(_setAuthUser)도 함께 갱신해 동기 getCurrentUser()가 동작하게 합니다.
//
// [재접속 실패 진단]
// fbUser가 있다는 건 Firebase Auth 로그인 자체는 이미 성공했다는 뜻입니다.
// 그런데도 buildAppUser(프로필 조회 등)가 실패하면 예전엔 조용히 appUser를
// null로 만들어 버려서, useRequireAuth가 "로그인 안 됨"으로 보고 랜딩으로
// 튕겨 보냈습니다 — 정작 원인(App Check 토큰 발급 지연, 일시적 네트워크
// 오류 등)은 콘솔에조차 남지 않아 "로그인은 됐는데 자꾸 튕긴다"는 신고를
// 받아도 추적할 방법이 없었습니다. 그래서 (1) 실패 원인을 콘솔에 남기고
// (2) 첫 시도가 일시적 오류일 수 있으니 한 번 더 시도한 뒤에만 포기합니다.
//
// 가장 흔한 '일시적 오류'는 가입 직후의 순서 문제입니다. 구글 팝업이 닫히면
// 이 리스너가 가입 흐름(signInWithGoogleInner)보다 먼저 깨어나는데, 그 찰나엔
// users 프로필이 아직 없습니다. 그래서 재시도 전에 잠깐 기다립니다 — 그 사이
// 가입 흐름이 프로필을 만들어 두면 두 번째 시도가 성공합니다.
// 이 브라우저에 로그인 세션이 있(었)는지 — 랜딩 깜빡임을 막는 힌트입니다.
// -------------------------------------------------------------
// Firebase는 세션을 IndexedDB에 두고 비동기로 복원합니다. 그래서 첫 화면이
// 그려지는 시점에는 "로그인 상태인지"를 알 방법이 없고, / 로 들어오면
// 랜딩이 먼저 보였다가 뒤늦게 /board로 넘어갑니다.
// 로그인할 때 이 표시를 남겨 두면, 다음 접속 때 첫 페인트 전에(app/layout.js의
// 인라인 스크립트) "곧 넘어갈 참"임을 알 수 있어 랜딩을 아예 그리지 않습니다.
//
// 이건 화면 힌트일 뿐 권한이 아닙니다 — 지어내서 넣어도 로그인이 되지 않고,
// 진짜 판정은 Firebase 인증과 보안 규칙이 합니다. 지워져 있어도(시크릿 창,
// 저장소 정리) 랜딩이 한 번 깜빡일 뿐 동작은 그대로입니다.
export const SESSION_HINT_KEY = "bn_had_session";
function setSessionHint(on) {
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* 저장소를 막아 둔 브라우저 — 깜빡임만 남고 기능엔 지장 없음 */
  }
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, async (fbUser) => {
    // 프로필을 못 읽어 appUser가 null이 되는 경우와 구분해, 인증 세션이
    // 있었는지(fbUser)만 기준으로 남깁니다.
    setSessionHint(!!fbUser);
    let appUser = null;
    if (fbUser) {
      try {
        appUser = await buildAppUser(fbUser);
      } catch (err) {
        console.error(
          "[인증] 로그인은 됐지만 프로필을 불러오지 못했어요 — 한 번 더 시도합니다:",
          err?.code,
          err?.message
        );
        // 잠깐 기다렸다 한 번 더 — 가입 직후라면 이 사이에 가입 흐름이
        // 프로필을 만들어 둡니다. 지연 없이 곧바로 다시 부르면 (프로필이
        // 아직 없는 그 찰나에) 같은 실패를 반복할 뿐이라 재시도가 무의미했습니다.
        await new Promise((r) => setTimeout(r, 800));
        try {
          appUser = await buildAppUser(fbUser);
        } catch (retryErr) {
          console.error(
            "[인증] 재시도에도 실패 — 로그인 화면으로 돌아갑니다:",
            retryErr?.code,
            retryErr?.message
          );
          appUser = null;
        }
      }
    }
    _setAuthUser(appUser);
    cb(appUser);
  });
}

export async function signInWithGoogle(requestedRole = null) {
  try {
    return await signInWithGoogleInner(requestedRole);
  } catch (err) {
    console.error("[구글 가입/로그인 실패]", err?.code, err?.message, err?.cause ?? err);
    throw err;
  }
}

// 가입과 로그인이 한 길입니다 — 프로필이 있으면 로그인, 없으면 그 자리에서
// 만듭니다. requestedRole('teacher')은 **새로 가입할 때만** 반영됩니다
// (이미 가입한 사람이 '선생님으로 시작'을 눌러도 역할이 바뀌지 않음).
async function signInWithGoogleInner(requestedRole) {
  const provider = new GoogleAuthProvider();
  // 학교·집에서 여러 구글 계정을 쓰는 일이 잦아, 늘 계정을 고르게 합니다.
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);

  // getAdditionalUserInfo().isNewUser는 'Auth 계정'이 방금 생겼는지만 알려
  // 줄 뿐 'Firestore 프로필'이 있는지는 모릅니다. 이전 시도에서 계정만
  // 남은 경우까지 살리려고 '프로필이 실제로 있는지'로 판단합니다.
  let hasProfile;
  try {
    hasProfile = (await getDoc(doc(db, "users", cred.user.uid))).exists();
  } catch (err) {
    await signOut(auth);
    throw Object.assign(new Error("계정 정보를 확인하지 못했습니다."), {
      code: "auth/profile-check-failed",
      cause: err,
    });
  }
  if (!hasProfile) {
    await createProfileOrRollback(cred.user, { requestedRole });
  }
  const appUser = await buildAppUser(cred.user);
  _setAuthUser(appUser);
  return appUser;
}

export async function signOutUser() {
  await signOut(auth);
  _setAuthUser(null);
  // 로그아웃한 사람이 다음에 / 로 오면 랜딩이 바로 보여야 합니다.
  setSessionHint(false);
  // 새로고침 없이 / 로 돌아가는 경우까지 — 힌트는 다음 접속용이라, 지금
  // 화면에 걸려 있는 표시는 따로 걷어 줘야 랜딩이 곧바로 보입니다.
  try {
    document.documentElement.removeAttribute("data-auth-pending");
  } catch {
    /* 브라우저 밖(서버)에서 불릴 일은 없지만 방어 */
  }
}
