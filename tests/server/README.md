# 책나눔·대시보드 서버 통합 테스트

저장소 루트에서 Node 22와 Java 21을 사용합니다. 루트 및 `tests/rules` 의존성이 설치되어 있어야 합니다.

```bash
FIREBASE_ADMIN_PROJECT_ID=demo-reading-api \
  tests/rules/node_modules/.bin/firebase emulators:exec \
  --config tests/server/firebase.json --only auth,firestore,database \
  --project demo-reading-api 'node --import ./tests/unit/register.mjs --test --test-concurrency=1 tests/server/*.test.mjs'
```

`npm run test:reading-server`가 같은 명령입니다. Auth 9199, Firestore 8181, Realtime Database 9111 포트를 사용합니다. CLI가 에뮬레이터의 접속 변수를 주입하며, 실서비스 실행을 막기 위해 테스트는 에뮬레이터와 `demo-` 프로젝트를 모두 확인합니다. 관리 인증서·개인 키는 필요하지 않습니다.

`plazaLive.test.mjs`(책 광장의 '함께 있는 친구들')만 Realtime Database를 씁니다. 서버가 적는 입장권, 화면끼리 주고받는 통로(`lib/plazaLiveChannel.js`), 언제 잇고 놓는지(`lib/plazaLiveSession.js`)를 **운영 규칙(`database.rules.json`)과 화면과 같은 SDK로** 봅니다. 에뮬레이터 설정은 제 폴더 밖의 규칙 파일을 읽지 못해, 처음에는 모두 막는 `tests/server/database.rules.json`으로 뜨고 시험이 시작할 때 운영 규칙으로 갈아 끼웁니다(시험 하나는 '규칙이 게시되지 않은 때'를 보려고 잠깐 되돌림). 화면(탭이 가려짐 · 누르기)만 가짜로 넣습니다.

실제 Firebase 인증 토큰 검사, 익명 거부, 기본 비활성화, 반 소속 확인, 동시 중복 요청의 원자성, 충돌, 경험치 정정·랭킹 갱신, 비공개 정보 격리와 기능 재활성화 시 데이터 보존을 검증합니다.

대시보드는 담당 반·현재 명부·학생 본인만 조회하는지, 책나눔을 꺼도 활동 분석을 유지하며 독서 정본은 읽지 않는지, 개인 감상 원문·다른 반 자료가 교사에게 나오지 않는지, 학기 설정 권한과 기록 정정이 집계에 즉시 반영되는지를 검증합니다. 기존 독서 시험이 시작할 때 에뮬레이터를 초기화하므로 파일 간 병렬 실행은 끕니다.

이 테스트의 `firestore.rules`는 웹 클라이언트 접근을 모두 거부하는 별도 테스트 설정입니다. 서버 Admin SDK의 인증·업무 권한 검증을 시험하며, 운영 보안 규칙은 `npm run test:rules`에서 따로 검증합니다.
