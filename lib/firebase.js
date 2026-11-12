// =============================================================
// Firebase 초기화
// -------------------------------------------------------------
// 설정값은 NEXT_PUBLIC_FIREBASE_* 환경변수에서 읽습니다.
// 비어 있으면 lib/firebase-defaults.mjs의 원작자 기본값을 씁니다
// (운영 사이트 withbooks.vercel.app이 환경변수 없이도 그대로 돕니다).
//
// 저장소를 복제해 쓸 때는 .env.local 또는 Vercel Environment Variables에
// 자기 Firebase 값을 넣으세요(.env.example 참고).
// apiKey를 YOUR_... 로 두면 데모 모드(브라우저 메모리)로 돕니다.
// =============================================================
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  DEFAULT_FIREBASE_API_KEY,
  DEFAULT_FIREBASE_AUTH_DOMAIN,
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIREBASE_STORAGE_BUCKET,
  DEFAULT_FIREBASE_MESSAGING_SENDER_ID,
  DEFAULT_FIREBASE_APP_ID,
} from "./firebase-defaults.mjs";

// Next.js는 NEXT_PUBLIC_ 값을 빌드 때 인라인합니다 — process.env.NEXT_PUBLIC_X
// 를 직접 적어야 합니다(동적 키 접근 금지).
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_AUTH_DOMAIN;
const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULT_FIREBASE_API_KEY;
const FIREBASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  DEFAULT_FIREBASE_STORAGE_BUCKET;
const FIREBASE_MESSAGING_SENDER_ID =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
  DEFAULT_FIREBASE_MESSAGING_SENDER_ID;
const FIREBASE_APP_ID =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULT_FIREBASE_APP_ID;

// 로그인 창의 주소(authDomain) — 실서비스 주소에서는 우리 사이트 자신을 씁니다.
// 학교 와이파이·자녀 보호 앱이 firebaseapp.com만 막는 일이 있어, 실서비스
// 주소에서는 next.config.mjs의 rewrites가 /__/auth/* 를 firebaseapp.com으로
// 넘겨 주고 학생 기기는 우리 주소 하나에만 닿게 합니다. 켜려면
// (1) Google Cloud 콘솔의 OAuth 웹 클라이언트에 'https://<배포 주소>/__/auth/handler'를
// 리디렉션 URI로 넣고 (2) 그 주소를 PROXIED_AUTH_HOSTS에 더하세요.
// 없으면 redirect_uri_mismatch로 로그인이 막힙니다 — 넣기 전에는 비워 두세요.
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
  apiKey: FIREBASE_API_KEY,
  authDomain,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
};

// 서버 함수(Cloud Functions)와 App Check는 쓰지 않습니다 — Firebase 무료
// 요금제 + 보안 규칙만으로 돕니다(배포가 쉽도록). 권한은 전부 firestore.rules가
// 지킵니다.

// 설정값이 아직 자리표시자(YOUR_...)이면 데모 모드로 동작합니다.
export const firebaseReady = !firebaseConfig.apiKey.startsWith("YOUR_");

// ── 체험용 샘플 반(교사 전용) ─────────────────────────────────────
// 선생님이 '체험용 샘플 반'에 들어가면 이 탭의 sessionStorage에 표시를 남기고
// 페이지를 새로 엽니다. 그러면 아래 isFirebaseConfigured가 false가 되어 앱
// 전체가 예전 데모 자료(브라우저 메모리)로 돕니다 — Firestore·Storage를 읽거나
// 쓰지 않고, 고친 것은 새로고침하면 사라집니다. 나가기·로그아웃 때 표시를
// 지우고 다시 엽니다(lib/sampleClass.js). 들어가고 나갈 때 늘 새로 열기
// 때문에, 실제 반의 구독·자료와 섞이지 않습니다.
export const SAMPLE_CLASS_KEY = "bookbom.sampleClass.v1";
export function readSampleFlag(storage) {
  try {
    return !!storage && storage.getItem(SAMPLE_CLASS_KEY) === "1";
  } catch {
    return false;
  }
}
export const sampleMode =
  firebaseReady &&
  typeof window !== "undefined" &&
  readSampleFlag(window.sessionStorage);

// 실제 Firebase 자료를 쓰는가 — 샘플 반 안에서는 false(데모 자료).
export const isFirebaseConfigured = firebaseReady && !sampleMode;

let app = null;
let db = null;
let auth = null;
let storage = null;

// 샘플 반 안에서도 로그인 상태 확인·로그아웃을 위해 초기화는 해 둡니다.
if (firebaseReady) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  // 첨부 이미지/파일 저장소 (data URL 대신 원본을 Storage에 업로드)
  storage = getStorage(app);
}

// app — 책 광장의 실시간(Realtime Database)이 광장 탭을 열 때 이 앱으로 잇습니다(lib/data/plazaLive.js).
// Realtime Database SDK는 여기서 불러오지 않습니다(첫 화면이 무거워짐) — 그 주소(NEXT_PUBLIC_FIREBASE_DATABASE_URL)도
// 거기서 읽습니다.
export { app, db, auth, storage };
