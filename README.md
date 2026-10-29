# 책으로 — 교실 독서 활동 웹 앱

교실에서 함께 책을 읽고 생각을 나누는 독서 활동판입니다.
[배움나눔](https://github.com/imuzikr/class-peer-qna)의 책방을 떼어 따로 세운 앱으로,
닿소리 채우기 · 곁텍스트 읽기 · RAFT 글쓰기 · KWLS · 마인드맵 · 내 생각은요... ·
여섯 개의 해시태그 · 물음표로 책 읽기 · 가로세로 낱말 퀴즈 아홉 가지 활동과
반 관리 · 출석 · 과일(참여 격려) · 수업 노트 · 학급 방송을 담고 있습니다.

> 지금은 Firebase 설정값이 자리표시자라 **데모 모드**로 돕니다.
> 새 Firebase 프로젝트를 연결하는 차례는 `CLAUDE.md`의 '새 Firebase 프로젝트 연결'을 보세요.

## 원본 독서 활동 업데이트

브레인 라이팅의 학생 질문 방식, 생각 메모의 교사 댓글·읽음 알림·이전/다음 보기,
모둠 RAFT의 동료 평가 방송과 스크롤 동기화를 반영했습니다.
비교 기준과 사용법은 [독서 활동 변경 내역](READING_ACTIVITY_UPDATES.md)을 참고하세요.

## 책나눔 성장 기능

반 관리에서 켠 반에만 내 서재·독서 경험치·단계별 뱃지 18종·우리 반 랭킹을 표시합니다.
기본값은 꺼짐이며 기존 독서 활동은 계속 사용할 수 있습니다.
사용법·달성 기준·실서비스 서버 설정은 [책나눔 성장 기능](READING_GROWTH.md)을 참고하세요.

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
  Firestore · Storage 보안 규칙이 서버에서 강제합니다(서버 함수는 없습니다).
- **데모 모드** (Firebase 미설정 · 현재 상태): 브라우저 메모리에 임시 저장(새로고침 시
  초기화)되고, 테스트 유저로 자동 입장합니다. 화면·기능을 빠르게 확인할 때만
  쓰입니다. (`lib/user.js`의 `TEST_USER`)

## 인증과 권한

- **로그인**: 구글 계정만 (`lib/auth.js`의 `signInWithGoogle`). 로그인 시
  `users/{uid}` 프로필을 보장하고, 학생은 접속 세션마다 새 익명 닉네임을 받습니다.
- **역할 구조**: 관리자 → 선생님 → 학생. 역할은 **`users/{uid}.role` 한 칸**이고,
  보안 규칙이 그 문서를 읽어 판정합니다(서버 함수 · 커스텀 클레임 없음).
  - **학생**: 기본 역할. 참여 코드로 반에 들어갑니다.
  - **선생님**: 가입 때(또는 반 입장 화면의 '선생님이세요?') **교사 가입 코드**를
    넣으면 스스로 선생님이 됩니다. 코드는 Firestore의 `config/teacherSignup` 문서
    `code` 칸에 운영자가 콘솔에서 적어 두고, 앱에서는 아무도 그 문서를 읽을 수
    없습니다 — 규칙만 견주어 봅니다. 코드를 바꾸면 그때부터 새 코드만 통합니다.
  - **관리자**: 콘솔에서 그 사람의 `users/{uid}.role`을 `admin`으로 고칩니다.
    관리자는 앱 안 역할 관리 창에서 남의 역할을 바꿀 수 있습니다.
- 학생은 스스로 역할을 못 올립니다(코드 없이는). 화면의 `isAdmin(user)`는 노출용일
  뿐이고 실제 강제는 규칙입니다.

## 배포 — 서버 함수 · App Check 없음

- **프론트엔드**: Vercel — `main`에 push하면 자동 배포됩니다.
- **Firebase**: 보안 규칙 · 색인 · Storage 규칙만 올립니다(무료 Spark 요금제로 충분 —
  다만 2024년 10월 이후 새로 만든 프로젝트는 Storage를 쓰려면 Blaze가 필요할 수
  있습니다. 그림 첨부를 안 쓰면 Storage 없이도 돕니다).

```bash
npx firebase-tools login   # 최초 1회
npm run deploy             # 규칙 시험 → firestore(rules·indexes) + storage
```

- Storage 규칙은 역할을 Firestore에서 읽습니다. 처음 올릴 때 서비스 간 권한을
  허용할지 물으면 'Y'로 답하세요.
- 콘솔에서 할 일 두 가지: `config/teacherSignup` 문서에 `code`(4자 이상) 적기 ·
  첫 관리자의 `users/{uid}.role`을 `admin`으로 고치기.

## 지우기 — 앱 안에서는 보관까지

- **반**은 앱에서 지우지 않고 **보관**합니다. 학생은 '반에서 빼기'로 명단에서만 뺍니다.
- 완전히 지우려면 Firebase 콘솔을 씁니다 — Firestore에서 `classes/{반}` 문서를
  지우면 그 아래 하위 컬렉션(그 반의 노트 · 과일 · 메신저 등)까지 함께 지워집니다.
  CLI로는 `npx firebase-tools firestore:delete classes/<반 id> --recursive`가 같은
  일을 합니다. 앱 코드(웹 SDK)의 문서 삭제는 그 문서 한 장만 지우고 하위 기록은
  남기므로, 이 일은 앱 안에 두지 않았습니다.
  반 바깥에 있는 것(`bookActivities` · `memberships` · `attendanceRecords` ·
  `kwl` · `joinCodes`)은 `classId`로 따로 지웁니다. 로그인 계정은
  Authentication 탭에서 지우고, 그 사람의 `users/{uid}` 문서도 함께 지웁니다.
- 학년도가 바뀌어 통째로 비우려면 `npx firebase-tools firestore:delete --all-collections`
  (되돌릴 수 없음)로 비운 뒤 `config/teacherSignup`과 관리자 role만 다시 적으면 됩니다.

## Firestore 데이터 구조 (책으로에서 쓰는 것)

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

배움나눔에서 가져온 규칙에는 질문(`questions`) · 공부방(`studyBoards`) 같은
컬렉션도 남아 있지만 책으로 화면은 쓰지 않습니다.

## 폴더 구조

```
app/page.js          랜딩 + 로그인/회원가입(역할 선택)
app/books/page.js    책방 (활동 목록 → 활동 · 반 관리 · 출석 · 과일 바구니)
lib/firebase.js      Firebase 초기화 (config — 지금은 자리표시자)
lib/auth.js          인증 (구글) + 프로필/역할
lib/user.js          현재 사용자 캐시 + 역할 헬퍼
lib/store.js         데이터 레이어 입구 (Firestore ↔ 데모 모드 자동 전환)
scripts/admin/       관리용 스크립트 (gcloud 로그인 · REST)
```

자세한 아키텍처·규칙 세부는 `CLAUDE.md`를 참고하세요.
