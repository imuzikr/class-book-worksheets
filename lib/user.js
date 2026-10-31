// =============================================================
// 현재 로그인 사용자 + 역할(role)
// -------------------------------------------------------------
// 실서비스 모드(isFirebaseConfigured): 인증 리스너(lib/auth.js)가 로그인
// 상태가 바뀔 때마다 _setAuthUser()로 현재 사용자 객체를 갱신하고,
// getCurrentUser()는 그 캐시를 동기 반환합니다. 역할은 users/{uid}.role에서
// 오며, 진짜 권한 강제는 Firestore 보안 규칙이 같은 칸을 읽어 검사하는 것으로
// 완성됩니다. isAdmin()은 UI 노출용.
//
// 데모 모드(Firebase 미설정): 아래 TEST_USER를 로그인된 것으로 가정합니다.
// 접속한 탭마다 세션 uid를 만들어 내 글과 남의 글을 구분하고, RoleSwitcher로
// 관리자/학생 화면을 미리 볼 수 있습니다. (실서비스에는 영향 없음)
// =============================================================
import { isFirebaseConfigured } from "./firebase";
import { DEMO_STUDENTS, getDemoStudent } from "./demoClassroom";

// 인증 사용자 캐시 — lib/auth.js의 인증 리스너가 채웁니다(동기 접근용).
let _authUser = null;
export function _setAuthUser(u) {
  _authUser = u;
}

export const TEST_USER = {
  uid: "user_01",
  displayName: "테스트 유저",
  role: "admin",
  // 데모용 학번 — Google Workspace 연동 시 account.familyName(성)으로 교체됩니다.
  studentId: "30105",
};

// 데모 모드의 탭(세션)별 uid 저장 키 — 예전 이름 그대로 둡니다.
const NICK_KEY = "anon_profile";
const ROLE_KEY = "dev_role_override";
export const DEMO_STUDENT_KEY = "bookbom.demo.student.v1";
const DEMO_ROLES = new Set(["admin", "teacher", "student"]);

// -------------------------------------------------------------
// [개발용] 역할(보기) 전환
// -------------------------------------------------------------
// 상단바의 토글로 관리자/학생 화면을 오가며 기능을 확인할 수 있습니다.
// sessionStorage에 저장되므로 탭을 닫으면 원래 역할로 돌아갑니다.
// 실제 인증을 붙이면 이 오버라이드는 제거하면 됩니다.

export function getRoleOverride() {
  if (isFirebaseConfigured || typeof window === "undefined") return null;
  try {
    const role = sessionStorage.getItem(ROLE_KEY);
    return DEMO_ROLES.has(role) ? role : null;
  } catch { return null; }
}

export function setRoleOverride(role) {
  if (isFirebaseConfigured || typeof window === "undefined" || !DEMO_ROLES.has(role)) return false;
  try {
    sessionStorage.setItem(ROLE_KEY, role);
  } catch { return false; }
  // 화면 전체가 새 역할로 다시 그려지도록 알림 (board 페이지가 구독)
  window.dispatchEvent(new Event("role-change"));
  return true;
}

// Demo students are fixed fictional identities, separate from the teacher's
// session profile. Neither these selectors nor stored role values affect auth.
export function getDemoStudentSelection() {
  if (isFirebaseConfigured || typeof window === "undefined") return null;
  try {
    return getDemoStudent(sessionStorage.getItem(DEMO_STUDENT_KEY)) ?? DEMO_STUDENTS[0];
  } catch { return DEMO_STUDENTS[0]; }
}

export function setDemoStudentSelection(uid) {
  if (isFirebaseConfigured || typeof window === "undefined" || !getDemoStudent(uid)) return false;
  try {
    sessionStorage.setItem(DEMO_STUDENT_KEY, uid);
    sessionStorage.setItem(ROLE_KEY, "student");
  } catch { return false; }
  window.dispatchEvent(new Event("role-change"));
  return true;
}

function makeSessionUid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `session_${crypto.randomUUID()}`;
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

let demoAnonFallback = null;

// 데모 모드: 이번 탭(세션)의 uid { uid }를 반환합니다(내 글 구분용).
// 서버 렌더링 중에는 null을 반환하므로, 화면 표시는 useEffect에서 하세요.
export function getAnonProfile() {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(NICK_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.uid) return parsed;
      const migrated = { ...parsed, uid: makeSessionUid() };
      sessionStorage.setItem(NICK_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    /* 저장값이 손상된 경우 새로 생성 */
  }
  const profile = demoAnonFallback ?? { uid: makeSessionUid() };
  try { sessionStorage.setItem(NICK_KEY, JSON.stringify(profile)); }
  catch { demoAnonFallback = profile; }
  return profile;
}

export function getCurrentUser() {
  // 실서비스(Firebase 설정됨): 인증 리스너가 채운 캐시를 반환.
  // 로그인 전/로딩 중에는 null일 수 있으므로, 보호 페이지는 가드로 막습니다.
  if (isFirebaseConfigured) {
    return _authUser;
  }
  // 데모 모드: 테스트 유저(표시 이름은 실명)
  const role = getRoleOverride() ?? TEST_USER.role; // 개발용 보기 전환 반영
  if (role === "student") {
    const student = getDemoStudentSelection();
    if (student) return { ...student, classIds: [...student.classIds] };
  }
  const anon = getAnonProfile();
  return {
    ...TEST_USER,
    uid: anon?.uid ?? TEST_USER.uid,
    role,
    // 닉네임 기능 없음 — 표시 이름은 실명
    displayName: TEST_USER.displayName,
    emoji: null,
    realName: TEST_USER.displayName,
    studentId: TEST_USER.studentId ?? null,
  };
}

// 학교 구글 워크스페이스 계정 이름을 학번과 이름으로 분리합니다.
//   "21031홍길동"  → { studentId: "21031", realName: "홍길동" }
//   "30105 홍길동" → { studentId: "30105", realName: "홍길동" }
// 앞 5자리 숫자가 학번, 그 뒤 전체가 이름입니다. 학교 계정은 대부분 공백 없이
// 붙여 쓰므로 사이 공백은 있어도 되고 없어도 됩니다.
// 형식이 다르면 null을 반환해, 호출부가 원래 이름을 그대로 쓰게 합니다.
export function splitWorkspaceName(raw) {
  const m = /^(\d{5})\s*(\S.*)$/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const realName = m[2].trim();
  // 이름이 숫자뿐이면 학번을 잘못 자른 것(예: 학번 9자리 오입력)이므로
  // 분리하지 않습니다. 지나치게 긴 값도 이름으로 보지 않습니다.
  if (!realName || realName.length > 20 || !/\D/.test(realName)) return null;
  return { studentId: m[1], realName };
}

// 최고 관리자 — users/{uid}.role이 'admin'. 코드에 박아 둔 이메일은 없습니다
// (공개 운영) — 첫 관리자는 Firebase 콘솔에서 그 문서의 role을 고쳐 지정합니다.
// 최고 관리자는 모든 반의 데이터·기능에 접근합니다(반 소유 제한의 예외).
export function isAdmin(user) {
  return !!user && user.role === "admin";
}

// 교사(최고 관리자 포함) — 교사용 기능 접근 관문.
// 일반 교사는 자신이 개설한 반에 한해 권한을 가지고, 최고 관리자는 전체를 관리합니다.
export function isTeacher(user) {
  return !!user && (user.role === "teacher" || user.role === "admin");
}
