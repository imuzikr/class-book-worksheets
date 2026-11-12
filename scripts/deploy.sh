#!/usr/bin/env bash
# =============================================================
# Firestore 규칙 · 색인 + Storage 규칙 배포
# -------------------------------------------------------------
# 책 나눔은 서버 함수(Cloud Functions)를 쓰지 않습니다 — 올릴 것은 보안
# 규칙과 색인뿐입니다. 앱 자체(Next.js)는 Vercel이 따로 배포합니다.
#
# 사용법:
#   npm run deploy                 # 규칙 시험 → Firestore 규칙·색인 + Storage 규칙
#   npm run deploy -- --rules-only # Firestore 규칙만
#   npm run deploy -- --indexes-only
#   npm run deploy -- --database-only # Realtime Database 규칙만(책 광장의 '함께 있는 친구들' — 아래)
#   npm run deploy -- --skip-tests # 규칙 시험을 건너뜀 (권장하지 않음)
#
# Realtime Database 규칙(database.rules.json)은 **저절로 올리지 않습니다** — 책 광장의 '함께 있는 친구들'을
# 쓰는 곳만 올리는 선택 기능이고, 데이터베이스를 아직 안 만든 프로젝트에서는 배포가 실패하기 때문입니다.
# 콘솔에서 Realtime Database를 만든 뒤 --database-only로 따로 올리세요(READING_GROWTH.md '함께 있는 친구들').
#
# 최초 1회 준비:
#   npx firebase-tools login       # 브라우저로 Google 계정 로그인
#
# Storage 규칙은 역할을 Firestore에서 읽습니다(서비스 간 규칙). 처음 올릴 때
# 권한을 허용할지 물으면 'Y'로 답하세요.
#
# firebase-tools는 npx로 그때그때 받아 씁니다(Vercel 빌드가 쓰지 않는 패키지라
# 루트 의존성에 넣지 않았습니다).
# =============================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

TARGET="firestore,storage"
SKIP_TESTS=0

for arg in "$@"; do
  case "$arg" in
    --rules-only) TARGET="firestore:rules" ;;
    --indexes-only) TARGET="firestore:indexes" ;;
    --database-only) TARGET="database" ;;
    --skip-tests) SKIP_TESTS=1 ;;
    *)
      echo "알 수 없는 옵션: $arg" >&2
      echo "사용법: npm run deploy -- [--rules-only|--indexes-only|--database-only] [--skip-tests]" >&2
      exit 1
      ;;
  esac
done

if [[ "$TARGET" != "firestore:indexes" && "$SKIP_TESTS" -ne 1 ]]; then
  echo "▶ 배포 전 규칙 시험을 먼저 돌립니다 (건너뛰려면 --skip-tests)"
  if [ ! -d tests/rules/node_modules ]; then
    echo "  tests/rules/node_modules가 없어 먼저 설치합니다..."
    npm --prefix tests/rules install
  fi
  npm run test:rules
  echo "✔ 규칙 시험 통과"
  echo ""
fi

echo "▶ 배포 대상: $TARGET"
echo "  (최초 1회는 'npx firebase-tools login'으로 먼저 로그인해야 합니다)"
npx firebase-tools deploy --only "$TARGET"
