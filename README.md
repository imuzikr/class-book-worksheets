# 책 나눔 — 교실 독서 활동 웹 앱

교실에서 함께 책을 읽고 생각을 나누는 독서 활동판입니다.
[배움나눔](https://github.com/imuzikr/class-peer-qna)의 책방을 떼어 따로 세운 앱으로,
닿소리 채우기 · 곁텍스트 읽기 · RAFT 글쓰기 · KWLS · 마인드맵 · 내 생각은요... ·
여섯 개의 해시태그 · 물음표로 책 읽기 · 가로세로 낱말 퀴즈 아홉 가지 활동과
반 관리 · 출석 · 과일(참여 격려) · 수업 노트 · 학급 방송을 담고 있습니다.

> 지금은 Firebase 설정값이 자리표시자라 **데모 모드**로 돕니다.
> 새 Firebase 프로젝트를 연결하는 차례는 `CLAUDE.md`의 '새 Firebase 프로젝트 연결'을 보세요.

## 실행 방법

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # 프로덕션 빌드
```

## 동작 모드

앱은 `lib/firebase.js`의 설정 유무에 따라 두 모드로 동작합니다.

- **실서비스 모드** (Firebase 설정됨): Firebase Authentication으로
  실제 로그인/회원가입하고, 데이터는 Firestore에 저장됩니다. 권한은
  Firestore 보안 규칙과 Cloud Functions가 서버에서 강제합니다.
- **데모 모드** (Firebase 미설정 · 현재 상태): 브라우저 메모리에 임시 저장(새로고침 시
  초기화)되고, 테스트 유저로 자동 입장합니다. 화면·기능을 빠르게 확인할 때만
  쓰입니다. (`lib/user.js`의 `TEST_USER`)

## 인증과 권한

- **로그인**: 이메일/비밀번호 + Google 로그인 (`lib/auth.js`). 로그인 시
  `users/{uid}` 프로필을 보장하고, 학생은 접속 세션마다 새 익명 닉네임을 받습니다.
- **역할 구조**: 최고 관리자(1명) → 선생님(중간 관리자) → 학생.
  - **최고 관리자**: 부트스트랩 이메일로 지정(코드에 하드코딩). 역할 부여·
    선생님 승인/탈퇴 등 최상위 권한.
  - **선생님**: 회원가입 시 "선생님"으로 신청 → 최고 관리자 승인 시 부여.
    대시보드·공지·학생 관리 등 대부분의 관리 권한.
  - **학생**: 기본 역할. 반에 입장해 독서 활동 · KWLS · 수업 노트 작성.
- **권한 부여**: 클라이언트가 스스로 못 바꾸며, Cloud Functions `setUserRole`이
  커스텀 클레임으로만 부여합니다. 보안 규칙은 `request.auth.token.role`을
  검사합니다. 화면의 `isAdmin(user)`는 UI 노출용일 뿐, 실제 강제는 규칙입니다.

## 배포

- **프론트엔드**: Vercel — `main`에 push하면 자동 배포됩니다.
- **Firebase(규칙·색인·함수·Storage 규칙)**: 저장소 파일을 원본으로 삼아
  CLI로 배포합니다(콘솔에서 직접 수정하지 마세요).

```bash
firebase deploy --only firestore,storage,functions
# 또는 개별: firestore:rules / firestore:indexes / storage / functions
```

- `firestore.rules` / `storage.rules` — 보안 규칙
- `firestore.indexes.json` — 복합 색인 + collectionGroup 필드 오버라이드
- `functions/index.js` — Cloud Functions (아래)
- Cloud Functions 배포에는 **Blaze(종량제)** 요금제가 필요합니다(대부분 무료 한도 내).

## Cloud Functions (`functions/index.js`)

- `setUserRole` — 역할(커스텀 클레임) 부여 (관리자만 호출)
- `deleteAuthUser` — 탈퇴 시 로그인 계정 삭제 (관리자/교사)
- `deleteStudentAccount` · `deleteClass` — 학생 탈퇴 정리 · 반 삭제(하위 기록까지)
- `sendClassNotice` — 반 공지(학생 알림함에 보냄)
- `onAnswerCreated` / `onAnswerUnderstood` / `onAnswerDeleted` — 배움나눔 질문방용(책 나눔에서는 깨어나지 않음)
- 모든 callable은 `enforceAppCheck: true` — App Check 키를 넣어야 동작합니다.

## Firestore 데이터 구조 (책 나눔이 쓰는 것)

식별 정보(실명·이메일·학번)는 `users/{uid}`에만 저장합니다.

```
users/{uid}                 프로필 (email, realName, displayName, role, requestedRole ...)
classes/{cId}               반 (+ attendanceOpen, marquee 등)
  ├ cornellNotes            학생 수업 노트
  ├ rewards · rewardEvents  과일 누적 · 지급 이력
  ├ fruitBasket · fruitEvents  과일 바구니 · 이벤트 기록
  ├ popQuizzes              돌발 퀴즈
  └ chatMessages …          메신저
joinCodes · memberships     입장 코드 · 반 소속
seatLayouts · groupAssignments  자리표 · 기본 모둠
attendanceRecords           출석 기록
bookActivities/{id}         독서 활동
  ├ groups/{gId}/words      닿소리 낱말 (+ xwHints · xwBoard · xwSolves 가로세로)
  ├ entries/{uid}           학생 기록 (곁텍스트 · RAFT · KWLS · 마인드맵 · 물음표)
  ├ peerReviews             동료 평가
  ├ opinionNotes            '내 생각은요...' 메모
  └ hashtagPosts · hashtagComments  해시태그
kwl                         KWLS 기록 (책방 KWLS 활동이 함께 적음)
broadcasts/{cId}            학급 화면 방송
```

배움나눔에서 가져온 규칙 · 함수에는 질문(`questions`) · 공부방(`studyBoards`) 같은
컬렉션도 남아 있지만 책 나눔 화면은 쓰지 않습니다.

## 폴더 구조

```
app/page.js          랜딩 + 로그인/회원가입(역할 선택)
app/books/page.js    책방 (활동 목록 → 활동 · 반 관리 · 출석 · 과일 바구니)
lib/firebase.js      Firebase 초기화 (config — 지금은 자리표시자)
lib/auth.js          인증 (이메일/구글) + 프로필/역할
lib/user.js          현재 사용자 캐시 + 역할 헬퍼
lib/store.js         데이터 레이어 입구 (Firestore ↔ 데모 모드 자동 전환)
functions/index.js   Cloud Functions (서버 코드)
```

자세한 아키텍처·규칙 세부는 `CLAUDE.md`를 참고하세요.
