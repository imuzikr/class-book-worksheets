# 책나눔 서버 통합 테스트

저장소 루트에서 Node 22와 Java 21을 사용합니다. 루트 및 `tests/rules` 의존성이 설치되어 있어야 합니다.

```bash
FIREBASE_ADMIN_PROJECT_ID=demo-reading-api \
  tests/rules/node_modules/.bin/firebase emulators:exec \
  --config tests/server/firebase.json --only auth,firestore \
  --project demo-reading-api 'node --test tests/server/reading.test.mjs'
```

Auth 9199, Firestore 8181 포트를 사용합니다. CLI가 두 에뮬레이터의 접속 변수를 주입하며, 실서비스 실행을 막기 위해 테스트는 두 에뮬레이터와 `demo-` 프로젝트를 모두 확인합니다. 관리 인증서·개인 키는 필요하지 않습니다.

실제 Firebase 인증 토큰 검사, 익명 거부, 기본 비활성화, 반 소속 확인, 동시 중복 요청의 원자성, 충돌, 경험치 정정·랭킹 갱신, 비공개 정보 격리와 기능 재활성화 시 데이터 보존을 검증합니다.

이 테스트의 `firestore.rules`는 웹 클라이언트 접근을 모두 거부하는 별도 테스트 설정입니다. 서버 Admin SDK의 인증·업무 권한 검증을 시험하며, 운영 보안 규칙은 `npm run test:rules`에서 따로 검증합니다.
