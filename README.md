# 책봄 — 교실 독서 활동 웹 앱

교실에서 함께 책을 읽고 생각을 나누는 독서 활동판입니다.
[배움나눔](https://github.com/imuzikr/class-peer-qna)의 책방을 떼어 따로 세운 앱으로,
닿소리 채우기 · 곁텍스트 읽기 · RAFT 글쓰기 · KWLS · 마인드맵 · 내 생각은요... ·
여섯 개의 해시태그 · 물음표로 책 읽기 · 가로세로 낱말 퀴즈 · 브레인 라이팅 열 가지 활동과
반 관리 · 출석 · 과일(참여 격려) · 학급 방송을 담고 있습니다.

## 라이선스

이 저장소는 [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/)로 제공합니다.
출처를 밝히면 **비상업적** 목적(학교 수업·교내 배포 등)으로 자유롭게 사용·수정·공유할 수 있습니다.
상업적 이용은 허용되지 않습니다. 전문은 [`LICENSE`](LICENSE)를 보세요.

## 빠른 시작 — 나만의 책봄 띄우기

> 이 저장소를 그대로 배포하지 마세요. **내 Firebase 프로젝트**로 바꿔야 합니다.

1. **가져오기**: Fork → `npm install` → `npm run dev` (Node 22)
2. **Firebase**: 새 프로젝트 + 웹 앱 등록. Authentication(Google), Firestore, (그림) Storage
3. **내 값 넣기**: `cp .env.example .env.local` 후 `NEXT_PUBLIC_FIREBASE_*` 채우기. 같은 값을 Vercel에도. `.firebaserc`는 `firebase use --add`
4. **규칙 · 색인 배포**: `npx firebase-tools login` → `npm run deploy` (Storage 권한 질문에는 Y)
   - 이 명령이 **보안 규칙과 색인(`firestore.indexes.json`)을 함께** 올립니다.
   - 콘솔에서 손으로 할 때는 **색인도 꼭 따로 만드세요** — 아래 '터미널 없이 콘솔에서 하기'의 표 두 줄.
5. **Vercel**: Fork Import → Deploy. 주소를 Firebase **승인된 도메인**에 추가
6. **책나눔 서버 열쇠**: Firebase 서비스 계정 키의 세 값을 Vercel에 `FIREBASE_ADMIN_*`로(Production) → Redeploy.
   빠지면 책방은 되는데 **책나눔 · 리더보드 · 독서 TOP 3 · 분석 리포트만** 멈춥니다 — 아래 [책나눔 서버 열쇠](#책나눔-서버-열쇠)
7. **콘솔**: `config/teacherSignup`에 `code`(문자열, 4자 이상), 내 `users/{uid}.role`을 `admin`
8. **확인**: 선생님으로 반 만들기 → 다른 계정으로 참여 → 책나눔 · 리더보드가 열리는지

> **⚠️ 색인을 빠뜨리지 마세요.** Firestore는 필요한 색인이 없는 조회를 **아예 거부**합니다(느려지는 것이
> 아니라 결과가 안 옵니다). 색인이 빠지면 앱은 멀쩡해 보이는데 **학생 알림 벨의 일부 알림만 조용히 안 옵니다.**
> 규칙 붙여넣기만으로는 색인이 생기지 않습니다.

규칙 파일을 바꾸면 `npm run deploy`를 다시 하세요. Vercel만으로는 규칙이 바뀌지 않습니다.
원작 저장소의 새 변경을 받아 왔을 때도 같습니다 — 새 기능이 **규칙이나 색인을 더했을 수 있어** 앱보다 먼저
올려야 합니다(`firestore.rules` · `firestore.indexes.json`이 바뀌었는지 보세요).

### 터미널 없이 콘솔에서 하기

4번을 명령 대신 Firebase 콘솔에서 해도 됩니다. **규칙 붙여넣기만으로는 색인이 안 생기니** 색인 둘을 따로 만드세요.

1. Firestore Database → **규칙** 탭 → 이 저장소의 `firestore.rules` 내용을 통째로 붙여넣고 **게시**
2. Firestore Database → **색인** → **자동** 탭 → **예외 추가**를 두 번(값은 아래 표)
   - 쿼리 범위는 **컬렉션 · 컬렉션 그룹 둘 다** 체크 → 다음
   - 켤 것: 컬렉션 범위 **오름차순 · 내림차순**, 컬렉션 그룹 범위 **오름차순** → 저장

   | 컬렉션 ID | 필드 경로 | 빠지면 |
   |---|---|---|
   | `opinionNotes` | `authorId` | '내 생각은요' 댓글 알림이 안 옴 |
   | `raftFeedback` | `studentUid` | RAFT 선생님 피드백 알림이 안 옴 |

3. Storage → **규칙** 탭 → `storage.rules`를 붙여넣고 게시(그림 첨부를 쓸 때)

몇 분 뒤 색인이 '사용 설정됨'이 되면 끝입니다. **수동(복합) 색인은 만들 것이 없습니다.**
자세한 안내: [docs/공유-시나리오.md](docs/공유-시나리오.md)

## 원본 독서 활동 업데이트

브레인 라이팅의 학생 질문 방식, 생각 메모의 교사 댓글·읽음 알림·이전/다음 보기,
모둠 RAFT의 동료 평가 방송과 스크롤 동기화를 반영했습니다.
비교 기준과 사용법은 [독서 활동 변경 내역](READING_ACTIVITY_UPDATES.md)을 참고하세요.

## 책나눔 성장 기능

교사 상단바의 **관리자 설정**에서 켜면 그 선생님의 모든 반에 내 서재·독서 경험치·단계별 뱃지 18종·우리 반 랭킹을 표시합니다. **독서 광장**을 함께 켜면 책나눔의 셋째 탭이 광장이 되어, 캐릭터로 걸어 다니며 반 친구들의 독서 발자국과 꽂아 둔 감상문을 읽고 댓글을 남깁니다(Firestore 규칙을 먼저 게시).
기본값은 꺼짐이며 기존 독서 활동은 계속 사용할 수 있습니다.
사용법·달성 기준·실서비스 서버 설정은 [책나눔 성장 기능](READING_GROWTH.md)을 참고하세요.

### 책나눔 서버 열쇠

**책나눔을 쓰려면 꼭 필요합니다.** 책나눔 · 리더보드 · 독서 TOP 3 · 펫 · 분석 리포트는 브라우저가
Firestore에 바로 쓰지 않고 **Vercel 서버**(`/api/reading` · `/api/dashboard`)를 거칩니다. 경험치와 순위를
학생이 고칠 수 없게 서버가 대신 계산하기 때문입니다. 그 서버가 Firebase에 들어가는 **관리자 열쇠**
(서비스 계정 비공개 키)의 세 값을 Vercel에 넣어 둡니다. 책방 · 출석 · 메신저는 열쇠 없이도 돕니다.

**넣는 법**

1. **열쇠 파일 받기**: [Firebase 콘솔](https://console.firebase.google.com) → 앱이 쓰는 프로젝트
   (Vercel에 넣은 `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, 비워 두었다면 `lib/firebase-defaults.mjs`의 프로젝트)
   → ⚙ **프로젝트 설정** → **서비스 계정** → **새 비공개 키 생성** → **키 생성**. JSON 파일 하나가 내려받아집니다.
2. **Vercel에 세 개 넣기**: 프로젝트 → **Settings → Environment Variables → Add Environment Variable**.
   값은 JSON에서 따옴표 안쪽만 옮기고, 환경은 **Production**에 체크합니다.
   **Sensitive**를 켜 두면 나중에 값이 다시 보이지 않아 더 안전합니다.

   | Key | Value (JSON에서) | 값의 모양 |
   |---|---|---|
   | `FIREBASE_ADMIN_PROJECT_ID` | `project_id` | `내-프로젝트-id` |
   | `FIREBASE_ADMIN_CLIENT_EMAIL` | `client_email` | `firebase-adminsdk-…@내-프로젝트-id.iam.gserviceaccount.com` |
   | `FIREBASE_ADMIN_PRIVATE_KEY` | `private_key` 전체 | `-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n` |

   - 비공개 키는 `-----BEGIN`부터 `-----END PRIVATE KEY-----\n`까지 끊김 없이 넣습니다. JSON에 보이는 그대로
     `\n`이 섞인 한 줄로 넣어도, 여러 줄로 붙여 넣어도 됩니다.
   - 이름 앞에 `NEXT_PUBLIC_`을 붙이지 마세요. 붙이면 학생 브라우저로 새어 나갑니다. GitHub에도 올리지 마세요.
3. **다시 배포**: **Deployments** → 맨 위 배포의 ⋯ → **Redeploy**. 환경변수는 다음 배포부터 들어갑니다.
4. **확인**: 실제 반에서 책나눔 · 리더보드를 새로고침합니다. 체험용 샘플 반은 서버를 거치지 않아 열쇠가
   없어도 보이므로 확인용이 아닙니다.

내려받은 JSON 파일은 넣은 뒤 지우거나 안전한 곳에 두세요. 그 파일만 있으면 누구나 모든 학생 자료를 읽고 고칠 수 있습니다.

**열쇠가 빠졌을 때 — 화면 문구로 찾기**

책나눔 · 리더보드에 아래 문구가 뜨면 열쇠 문제입니다. 개발자 도구(F12)의 Console · Network 탭에서
`/api/reading…` 요청의 상태 번호도 함께 보면 확실합니다.

| 화면 문구 | 상태 | 뜻 | 할 일 |
|---|---|---|---|
| 책나눔 서버 인증 설정이 필요합니다. 담당 교사에게 문의해 주세요. | 503 | 그 배포에 세 열쇠 가운데 하나 이상이 없음 | 세 개를 Production에 넣고 Redeploy |
| 책나눔 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. | 500 | 열쇠는 있지만 비공개 키가 잘렸거나, 다른 프로젝트의 키 | 앱이 쓰는 프로젝트에서 키를 새로 받아 세 개 모두 다시 넣고 Redeploy |
| 로그인을 다시 확인해 주세요. (모든 사람에게) | 401 | `FIREBASE_ADMIN_PROJECT_ID`가 앱의 Firebase 프로젝트와 다름 | 넣는 법 1번의 프로젝트 id로 고치고 Redeploy |

- **책방은 되는데 책나눔 · 리더보드 · 상단바 독서 TOP 3만 막히면** 거의 늘 첫 줄입니다.
- 열쇠를 지웠거나 바꿔도, 이미 만들어진 배포는 그때 받은 열쇠로 계속 돕니다. 그래서 문제는 **다음 배포**(main에
  push한 때)부터 나타납니다. 갑자기 막혔다면 Vercel의 Activity에서 환경변수 변경 기록을 보세요.
- **미리보기(Preview) 주소**에서만 첫 줄이 뜨는 것은 정상입니다. 열쇠를 Production에만 넣었기 때문이니,
  실제 서비스 주소에서 확인하세요. 미리보기에도 열쇠를 넣으면 합치기 전 코드가 실제 학생 자료를 관리자
  권한으로 다루게 되므로 권하지 않습니다.
- 500이 계속되면 Vercel의 **Logs**에서 `[reading] request failed` 줄에 적힌 코드를 확인하세요.

### 도서 검색 — 카카오 REST API (선택)

내 서재에 책을 담을 때 **카카오(다음) 책 검색 API**로 제목·지은이·출판사·ISBN·표지를 채울 수 있습니다.
전체 쪽수는 API가 주지 않아 학생이 직접 입력합니다. 키가 없어도 책 정보를 직접 입력해 그대로 쓸 수 있습니다.
(네이버 책 검색 API는 2026년 7월 31일에 종료되어 카카오로 옮겼습니다.)

1. [카카오디벨로퍼스](https://developers.kakao.com) → **내 애플리케이션 → 애플리케이션 추가하기** → **앱 키**의 **REST API 키**를 복사합니다(무료).
2. Vercel **Settings → Environment Variables**에 `KAKAO_REST_API_KEY`로 넣고 다시 배포합니다.
   로컬에서 시험할 때는 `.env.local`에 같은 이름으로 적습니다. `NEXT_PUBLIC_`을 붙이지 마세요.
3. 앱의 **관리자 설정 → 도서 검색**을 켭니다(기본 꺼짐). 켜면 '새 책 등록'에 '도서 검색' 단추가 생깁니다.

키는 서버 함수(`/api/books/search` → `lib/server/bookSearch.js`)에서만 읽고 브라우저로 보내지 않습니다.
자세한 내용은 [책나눔 성장 기능의 '도서 검색 (카카오)'](READING_GROWTH.md#도서-검색-카카오)을 참고하세요.

## 실행 방법

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # 프로덕션 빌드
```

Node.js 22 이상을 권장합니다(`.nvmrc` · CI와 같음).

### Firebase 환경변수

웹 설정은 `NEXT_PUBLIC_FIREBASE_*` 환경변수로 넣습니다. 목록과 설명은
[`.env.example`](.env.example)을 보세요.

- **로컬**: `cp .env.example .env.local` 후 값을 채웁니다(`.env.local`은 Git에 안 올립니다).
- **Vercel**: Project Settings → Environment Variables에 같은 이름으로 넣습니다.
- 값을 비워 두면 원작자 프로젝트 기본값(`lib/firebase-defaults.mjs`)으로 돕니다.
  **복제해 쓸 때는 반드시 자기 Firebase 값을 넣으세요.**
- apiKey를 `YOUR_...`로 두면 **데모 모드**로 돕니다.
- `.firebaserc`의 프로젝트 id는 Firebase CLI용이라 환경변수를 못 씁니다.
  `firebase use --add`로 자기 프로젝트를 고르세요.
- 서버 키(`FIREBASE_ADMIN_*`, `KAKAO_REST_API_KEY`)는 Vercel에만 넣고 GitHub에는 올리지 마세요.
  `FIREBASE_ADMIN_*`는 책나눔에 필수입니다 — 넣는 법과 빠졌을 때의 증상은 [책나눔 서버 열쇠](#책나눔-서버-열쇠).

## 동작 모드

상단 **대시보드**에서 교사는 반·활동 진행과 독서 흐름을, 학생은 개인 독서 달력·성장·성찰을 확인합니다. 기간·권한·집계 기준은 [DASHBOARD.md](DASHBOARD.md)를 참고하세요.

앱은 `lib/firebase.js`의 설정 유무에 따라 두 모드로 동작합니다.

- **실서비스 모드** (Firebase 설정됨): Firebase Authentication으로
  실제 로그인/회원가입하고, 데이터는 Firestore에 저장됩니다. 권한은
  Firestore · Storage 보안 규칙이 서버에서 강제합니다(Firebase 서버 함수는 없습니다 — 책나눔 · 리더보드 ·
  분석 리포트만 Vercel 서버가 관리자 열쇠로 처리합니다, [책나눔 서버 열쇠](#책나눔-서버-열쇠)).
- **데모 모드** (apiKey가 `YOUR_...`로 시작): 테스트 유저로 자동 입장합니다.
  **책봄 체험반(학생 15명)**에는 11가지 독서 활동과 학생별 서재 1~2권이 준비됩니다.
  상단 역할 전환과 **체험 학생** 선택으로 교사·각 학생 화면을 확인할 수 있습니다.
  체험 자료의 사용법과 범위는 [DEMO_CLASSROOM.md](DEMO_CLASSROOM.md)를 참고하세요.
  반 정보와 책나눔 활성화 설정은 같은 브라우저의 사이트 저장소에 보관하므로 새로고침해도 유지됩니다.
  개인 독서 기록 등 나머지 데모 자료는 메모리 임시 저장이며 새로고침 시 초기화됩니다.
  여러 기기·학생에게 설정과 기록을 공유하려면 실제 Firebase를 연결해야 합니다. (`lib/user.js`의 `TEST_USER`)

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
- **Vercel 서버**: 책나눔 · 리더보드 · 분석 리포트는 Vercel의 Next.js 서버(`app/api`)가 처리합니다(무료 —
  Firebase 서버 함수가 아님). Vercel에 Firebase 관리자 열쇠 세 개가 있어야 합니다 → [책나눔 서버 열쇠](#책나눔-서버-열쇠).
- **Firebase**: 보안 규칙 · 색인 · Storage 규칙만 올립니다(무료 Spark 요금제로 충분 —
  다만 2024년 10월 이후 새로 만든 프로젝트는 Storage를 쓰려면 Blaze가 필요할 수
  있습니다. 그림 첨부를 안 쓰면 Storage 없이도 돕니다).

```bash
npx firebase-tools login   # 최초 1회
npm run deploy             # 규칙 시험 → firestore(rules·indexes) + storage
```

- **그림 저장 방식(이미지 보안)**: 그림은 반 폴더 `uploads/{반}/{uid}/{파일}`에만 올라가고,
  Firestore에는 다운로드 URL 대신 `storage:uploads/…` 경로만 저장합니다. 화면은 권한을
  확인하며 내려받아 보여 줍니다. 같은 반 학생 · 그 반 담당 교사 · 관리자만 볼 수 있고,
  다른 반 교사는 못 봅니다. 옛 개인 폴더 `uploads/{uid}/…`는 닫혀 있습니다(쓰기·목록 거부).
- `storage.rules`를 바꾸면 **Storage 규칙을 다시 게시**해야 합니다(`npm run deploy` 또는 콘솔
  → Storage → 규칙). GitHub 병합 · Vercel 배포만으로는 규칙이 바뀌지 않습니다.
- Storage 규칙은 반 소속 · 역할을 Firestore에서 읽습니다. 처음 게시할 때 **Firestore 접근
  권한 연결**(서비스 간 권한)을 물으면 허용('Y' · 콘솔은 '권한 연결')하세요. 거부하면 반
  폴더 그림이 전부 막힙니다.
- 콘솔에서 할 일 두 가지: `config/teacherSignup` 문서에 `code`(4자 이상) 적기 ·
  첫 관리자의 `users/{uid}.role`을 `admin`으로 고치기.

## 지우기 — 보관한 반은 앱에서 완전 삭제

- **반**은 먼저 **보관**합니다. 보관된 반은 '반 관리하기' 아래 '보관된 반'에서
  **🗑 완전 삭제**를 누르고 반 이름을 그대로 적으면, 그 반의 독서 활동 · 학생 글 ·
  출석 · 자리표 · 모둠 · 과일 · 메신저 · 손들기 · 돌발 퀴즈 · 공지가 모두 지워집니다
  (되돌릴 수 없음 — 서버 함수 없이 앱이 하나씩 찾아 지웁니다). 지우는 동안 창을 닫지
  마세요. 중간에 멈추면 다시 누르면 남은 것부터 이어서 지웁니다.
- **학생 탈퇴**는 관리자 대시보드에서 합니다 — 왼쪽 사용자 목록에서 학생을 고르고 개인별
  보고서의 학생 이름 옆 **편집**을 누르면 프로필 창이 열리고, 아래 **탈퇴**를 눌러 학생 이름을 그대로 적으면 내 반의 그 학생 기록과
  프로필이 모두 지워집니다(되돌릴 수 없음). 구글 로그인 기록 한 줄만 Firebase 콘솔의
  Authentication 탭에 남습니다(다시 로그인하면 빈 새 학생). 다른 선생님 반에도 있는
  학생은 탈퇴시킬 수 없고, 같은 창의 **이 반에서 빼기**로 지금 보는 반에서만 뺍니다
  (글 · 과일 · 출석 기록은 남고, 참여 코드로 다시 들어오면 이어집니다).
- 학년도가 바뀌어 통째로 비우려면 `npx firebase-tools firestore:delete --all-collections`
  (되돌릴 수 없음)로 비운 뒤 `config/teacherSignup`과 관리자 role만 다시 적으면 됩니다.

## Firestore 데이터 구조 (책봄에서 쓰는 것)

식별 정보(실명·이메일·학번)는 `users/{uid}`에만 저장합니다.

```
users/{uid}                 프로필 (email, realName, displayName, role, requestedRole ...)
classes/{cId}               반 (+ attendanceOpen · 관리자 설정 스위치 등)
  ├ cornellNotes            옛 수업 노트 기록(화면 없음 · 지우지 않고 보존, 반 삭제 · 탈퇴 때 정리)
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

규칙은 책봄 화면이 쓰는 컬렉션만 둡니다. 배움나눔에서 함께 왔던 질문방 · 공부방 카드 ·
수업 노트 등의 규칙은 걷었습니다. 옛 문서가 남은 `studyBoards` · `presence` · `signalEvents`는
읽기 · 지우기만 남겨, 반 완전 삭제 · 학생 탈퇴가 그 옛 문서를 정리합니다(만들기 · 고치기는 닫음).

## 폴더 구조

```
app/page.js          랜딩 + 로그인/회원가입(역할 선택)
app/books/page.js    책방 (활동 목록 → 활동 · 반 관리 · 출석 · 과일 바구니)
app/dashboard/page.js 교사·학생 대시보드 (활동 현황 · 성찰 · 독서 흐름)
lib/firebase.js      Firebase 초기화 (NEXT_PUBLIC_FIREBASE_* · 기본값)
lib/auth.js          인증 (구글) + 프로필/역할
lib/user.js          현재 사용자 캐시 + 역할 헬퍼
lib/store.js         데이터 레이어 입구 (Firestore ↔ 데모 모드 자동 전환)
scripts/admin/       관리용 스크립트 (gcloud 로그인 · REST)
```

자세한 아키텍처·규칙 세부는 `CLAUDE.md`를 참고하세요.
