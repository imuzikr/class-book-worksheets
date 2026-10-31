// =============================================================
// 체험용 샘플 반 — 교사·관리자만 들어가는 브라우저 안의 연습 반
// -------------------------------------------------------------
// 들어가면 이 탭(sessionStorage)에 표시를 남기고 페이지를 새로 엽니다.
// lib/firebase.js가 그 표시를 읽어 isFirebaseConfigured를 false로 만들므로,
// 앱 전체가 예전 데모 자료(lib/mockDocs.js 등, 브라우저 메모리)로 돕니다.
//  · Firestore·Storage를 읽거나 쓰지 않습니다 — 고친 것은 새로고침하면 처음으로.
//  · 상단의 '교사 / 학생' 전환(RoleSwitcher)으로 두 화면을 오갑니다.
//  · 나가기·로그아웃하면 표시와 체험용 세션 값을 모두 지우고 다시 엽니다
//    → 실제 반의 화면·구독과 섞이지 않습니다(공용 크롬북 대비).
// 표시는 sessionStorage라 탭을 닫아도 사라집니다.
// =============================================================
import { SAMPLE_CLASS_KEY, sampleMode, firebaseReady, auth, db } from "./firebase";
import { DEMO_CLASS_ID } from "./demoClassroom";

export { SAMPLE_CLASS_KEY, sampleMode };
export const SAMPLE_CLASS_ID = DEMO_CLASS_ID;

// 샘플 반 안에서만 쓰는 세션 값 — 나갈 때 함께 지웁니다.
const CLASS_KEY = "study_class_id";
const PREV_CLASS_KEY = "bookbom.sampleClass.prevClass";
export const SAMPLE_SESSION_KEYS = [
  SAMPLE_CLASS_KEY,
  "dev_role_override",
  "bookbom.demo.student.v1",
  "anon_profile",
];

// 교사·관리자만 샘플 반을 볼 수 있습니다.
export function canUseSampleClass(user) {
  return !!firebaseReady && (user?.role === "teacher" || user?.role === "admin");
}

// 들어가기 — 지금 고른 실제 반을 기억해 두고, 샘플 반을 고른 채 엽니다.
export function markSampleClass(storage) {
  const prev = storage.getItem(CLASS_KEY);
  if (prev && prev !== SAMPLE_CLASS_ID) storage.setItem(PREV_CLASS_KEY, prev);
  else storage.removeItem(PREV_CLASS_KEY);
  storage.setItem(SAMPLE_CLASS_KEY, "1");
  storage.setItem("dev_role_override", "admin");
  storage.setItem(CLASS_KEY, SAMPLE_CLASS_ID);
}

// 나가기 · 로그아웃 — 체험용 값을 지우고 원래 반을 되돌립니다.
// restore=false(로그아웃)이면 원래 반도 되돌리지 않습니다.
export function clearSampleClass(storage, { restore = true } = {}) {
  if (!storage) return;
  try {
    const prev = storage.getItem(PREV_CLASS_KEY);
    for (const key of SAMPLE_SESSION_KEYS) storage.removeItem(key);
    storage.removeItem(PREV_CLASS_KEY);
    if (storage.getItem(CLASS_KEY) === SAMPLE_CLASS_ID) storage.removeItem(CLASS_KEY);
    if (restore && prev) storage.setItem(CLASS_KEY, prev);
  } catch {
    /* 막힌 저장소 — 지울 것도 없습니다 */
  }
}

function session() {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}

export function enterSampleClass() {
  const s = session();
  if (!s) return false;
  try { markSampleClass(s); } catch { return false; }
  window.location.assign("/books");
  return true;
}

export function exitSampleClass(to = "/books") {
  clearSampleClass(session());
  window.location.assign(to);
}

// 로그아웃 때 부릅니다(샘플 반이 아니어도 안전).
export function clearSampleClassOnLogout() {
  clearSampleClass(session(), { restore: false });
}

// 샘플 반 안에서 실제 로그인 상태를 지켜봅니다 — 로그아웃되었거나 학생
// 계정이면 곧바로 샘플 반을 닫습니다(주소를 알아도 학생은 못 머뭅니다).
// 본인 users 문서의 role 한 칸만 읽습니다(체험 자료는 읽지 않음).
export function watchSampleClassAccess() {
  if (!sampleMode || !auth) return () => {};
  let stop = () => {};
  let cancelled = false;
  Promise.all([import("firebase/auth"), import("firebase/firestore")]).then(
    ([{ onAuthStateChanged }, { doc, getDoc }]) => {
      if (cancelled) return;
      stop = onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) { exitSampleClass("/"); return; }
        try {
          const snap = await getDoc(doc(db, "users", fbUser.uid));
          const role = snap.exists() ? snap.data()?.role : null;
          if (!canUseSampleClass({ role })) exitSampleClass("/books");
        } catch {
          exitSampleClass("/books");
        }
      });
    },
  );
  return () => { cancelled = true; stop(); };
}
