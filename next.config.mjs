/** @type {import('next').NextConfig} */

import { DEFAULT_FIREBASE_PROJECT_ID } from "./lib/firebase-defaults.mjs";

// 프로젝트 id: NEXT_PUBLIC_FIREBASE_PROJECT_ID 를 쓰고, 비어 있으면 원작자 기본값(lib/firebase-defaults.mjs)을 씁니다.
// .firebaserc 도 같은 프로젝트를 가리키게 맞춰 주세요.
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
const FIREBASE_APP_HOST = `https://${FIREBASE_PROJECT_ID}.firebaseapp.com`;
// 자리표시자인 동안(데모 모드)은 CSP에 넣지 않습니다 — 밑줄이 든 주소라 브라우저가 경고합니다.
const FIREBASE_FRAME = FIREBASE_PROJECT_ID.startsWith("YOUR_") ? "" : ` ${FIREBASE_APP_HOST}`;

// Content-Security-Policy — 앱이 실제로 쓰는 출처만 허용.
//  · script: Next 하이드레이션(inline) + 구글 로그인 스크립트
//    'unsafe-eval'은 원래 파이썬 실행기(Pyodide)용이었는데, 실행기를 걷은 뒤에도
//    남겨 둡니다 — 개발 서버(React)가 쓰고, 구글 로그인 스크립트가 필요로 하는지
//    실제 로그인으로 확인하기 전에는 걷지 않습니다.
//  · connect: Firebase(Firestore/Auth/Storage/Installations = *.googleapis.com)
//    (서버 함수 · App Check는 쓰지 않음)
//    wss://*.firebaseio.com · wss://*.firebasedatabase.app — 책 광장의 '함께 있는 친구들'(Realtime Database,
//    웹소켓만 씀 — lib/data/plazaLive.js). 앞의 것은 미국 리전, 뒤의 것은 그 밖의 리전(싱가포르 · 벨기에)의 주소입니다.
//  · img: Storage 등 https 이미지 + data/blob(미리보기·그리기)
//  · worker: 앱이 따로 띄우는 Web Worker가 없습니다(파이썬 실행 Worker · jsDelivr
//    CDN · blob 스크립트 허용은 실행기와 함께 걷었습니다).
//  · frame: 구글/Firebase 인증 팝업
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.google.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://www.google.com wss://*.firebaseio.com wss://*.firebasedatabase.app data: blob:",
  "worker-src 'self'",
  `frame-src 'self'${FIREBASE_FRAME} https://apis.google.com https://accounts.google.com https://www.google.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,

  // 린트는 빌드가 아니라 `npm run lint`로 따로 돌립니다(보고만 — 루트
  // eslint.config.mjs 머리말). ESLint는 tools/lint에만 설치돼 있어, 빌드가
  // 루트 설정을 보고 린트를 돌리려 하면 찾지 못해 멈춥니다.
  eslint: { ignoreDuringBuilds: true },

  // 구글 로그인 창을 우리 주소로 띄우기 — /__/auth/* 와 /__/firebase/* 를
  // firebaseapp.com으로 넘겨 줍니다(lib/firebase.js의 authDomain 주석).
  async rewrites() {
    return [
      { source: "/__/auth/:path*", destination: `${FIREBASE_APP_HOST}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `${FIREBASE_APP_HOST}/__/firebase/:path*` },
    ];
  },

  async headers() {
    return [
      {
        // /__/ 아래(넘겨 준 로그인 창)는 빼야 합니다 — 우리 CSP의
        // frame-ancestors 'none'·X-Frame-Options DENY가 붙으면 앱이 같은
        // 주소의 로그인 iframe(/__/auth/iframe)을 못 띄웁니다.
        source: "/:path((?!__/).*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
