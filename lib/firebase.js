// =============================================================
// Firebase 초기화
// -------------------------------------------------------------
// Firebase 콘솔(https://console.firebase.google.com)에서
// 프로젝트 생성 → 웹 앱 등록 후 발급받은 설정값을 아래에 붙여넣으세요.
// 설정값을 붙여넣기 전까지는 앱이 자동으로 '데모 모드'(브라우저 메모리
// 저장)로 동작하므로, 먼저 화면과 기능을 확인해 볼 수 있습니다.
// =============================================================
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// ── 새 Firebase 프로젝트의 값을 여기에 붙여 넣으세요 ──────────────────
// 책 나눔은 책 나눔(class-peer-qna)과 **다른 Firebase 프로젝트**를 씁니다.
// 값이 자리표시자(YOUR_...)인 동안은 데모 모드로 돕니다.
// 프로젝트 id는 next.config.mjs(로그인 프록시)와 .firebaserc에도 같은 값을 적습니다.
const FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID";

// 로그인 창의 주소(authDomain) — 실서비스 주소에서는 우리 사이트 자신을 씁니다.
// 학교 와이파이·자녀 보호 앱이 firebaseapp.com만 막는 일이 있어, 실서비스
// 주소에서는 next.config.mjs의 rewrites가 /__/auth/* 를 firebaseapp.com으로
// 넘겨 주고 학생 기기는 우리 주소 하나에만 닿게 합니다. 켜려면
// (1) Google Cloud 콘솔의 OAuth 웹 클라이언트에 'https://<배포 주소>/__/auth/handler'를
// 리디렉션 URI로 넣고 (2) 그 주소를 PROXIED_AUTH_HOSTS에 더하세요.
// 없으면 redirect_uri_mismatch로 로그인이 막힙니다 — 넣기 전에는 비워 두세요.
const FIREBASE_AUTH_DOMAIN = `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
const PROXIED_AUTH_HOSTS = [];
// 처음 켤 때는 false로 두고 ?authproxy=1로 한 기기에서 먼저 확인하세요
// (구글 쪽 반영이 늦어 모든 학생의 로그인이 막힐 수 있습니다).
const AUTH_PROXY_FOR_ALL = false;
function authProxyOn() {
  if (AUTH_PROXY_FOR_ALL) return true;
  try {
    const flag = new URLSearchParams(window.location.search).get("authproxy");
    if (flag === "1") localStorage.setItem("bn_auth_proxy", "1");
    if (flag === "0") localStorage.removeItem("bn_auth_proxy");
    return localStorage.getItem("bn_auth_proxy") === "1";
  } catch {
    return false;
  }
}
const authDomain =
  typeof window !== "undefined" &&
  PROXIED_AUTH_HOSTS.includes(window.location.hostname) &&
  authProxyOn()
    ? window.location.hostname
    : FIREBASE_AUTH_DOMAIN;

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// App Check — Google Cloud에서 발급한 reCAPTCHA Enterprise 키 ID.
// Firebase 콘솔 App Check 메뉴에서도 동일한 키로 웹 앱을 등록해야 함.
// 자리표시자인 동안은 App Check를 켜지 않습니다.
const RECAPTCHA_ENTERPRISE_SITE_KEY = "YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY";

// 설정값이 아직 자리표시자(YOUR_...)이면 데모 모드로 동작합니다.
export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");

let db = null;
let auth = null;
let storage = null;
let functions = null;
let appCheck = null;

if (isFirebaseConfigured) {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  // 첨부 이미지/파일 저장소 (data URL 대신 원본을 Storage에 업로드)
  storage = getStorage(app);
  // Cloud Functions(callable) — 리전은 functions/index.js의 setGlobalOptions와 일치해야 함
  functions = getFunctions(app, "asia-northeast3");

  // App Check는 브라우저 DOM(reCAPTCHA)이 필요해 SSR/정적 빌드 환경에서는 건너뜀
  if (typeof window !== "undefined" && !RECAPTCHA_ENTERPRISE_SITE_KEY.startsWith("YOUR_")) {
    // 로컬 개발(localhost)은 reCAPTCHA Enterprise 심사를 통과할 수 없으므로
    // 디버그 토큰 모드로 전환 — 콘솔에 출력되는 토큰을 Firebase 콘솔 > App Check >
    // 앱 관리 > 디버그 토큰에 등록해야 개발 중 요청이 차단되지 않음.
    if (process.env.NODE_ENV !== "production") {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export { db, auth, storage, functions, appCheck };
