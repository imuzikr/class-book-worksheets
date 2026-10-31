# 책봄 화면 모양(CSS) 안내

책봄의 화면 모양 규칙은 모두 이 폴더(`app/styles/`)의 CSS 파일 49개에 있습니다.
`app/globals.css`는 이 파일들을 **정해진 순서대로 불러오는 입구**일 뿐입니다.

> 한 줄 요약: **파일 순서를 바꾸지 말고, 고친 뒤에는 `npm run css:fingerprint`로 확인하세요.**

---

## 1. 어느 화면이 어느 파일인가요?

파일 이름 앞의 번호는 불러오는 순서입니다. 한 화면의 모양이 여러 파일에 나뉘어 있는 경우가 많으니,
찾을 때는 아래 2번 표(접두사)와 함께 보세요.

| 화면 | 주로 보는 파일 |
|---|---|
| 공통 바탕(색 변수 `:root`, 버튼, 첫 화면, 푸터) | 01-base-landing-footer |
| 게시판 틀 · 메모 · 공지 | 02-board-layout-notes, 03-teacher-memo-notice |
| 알림 · 손들기 신호 | 04-notification-signal |
| 프로필 · 피드 | 05-profile-insight-feed, 11-confirm-profile-roles |
| 공통 창(모달) · 질문 · 반 관리 | 06-modal-question-class, 07-joincode-detail-attach |
| 서식 입력 에디터 · 채팅 입력 | 08a-image-editor-richtext-chat |
| 파이썬 실행 패널 | 08b-python-panel, 36-lesson-material-pycell |
| 관리자 대시보드 · 학생 보고서 | 09-admin-dashboard |
| 공부방 | 12-study-room, 20~25번, 31-study-activity-panel |
| 수업 중계 · 수업 준비 | 13-lesson-broadcast, 14a-activity-view-lesson-prep, 16·17번, 33-lesson-window-report |
| 공부중 · 읽는중 전광판(잔디) | 14b-studying-board |
| 출석 · 자리표 · 열매 | 15-attend-board, 20-study-today-attend, 21-seat-fruit, 32-fruit-celebration-dash |
| KWL · KWLS | 17-lesson-create-kwlfs, 18-group-memo-tkwl, 19-kwl-kwls-summary, 29-paratext-raft-kwls |
| **휴대폰(768px) 화면 묶음** | 26-keyword-kwlfab-mobile768 ⚠ 자리를 옮기지 마세요 |
| 책방 목록 · 닿소리 활동 | 27-books-list-consonant |
| 책방 교사 3칸 작업 화면 · 집계 | 28a-books-teacher-workspace |
| 모둠 고르기 · 동료 평가 · 낱말 구름 | 28b-group-peer-review-wordcloud |
| 곁텍스트 · RAFT | 29-paratext-raft-kwls, 42a-raft-crossword-signup |
| 마인드맵 · 칠판 중계(cast) | 30-mindmap-cast |
| 코넬 노트 | 34-cornell-drawer, 35-cornell-modal-report |
| 의견 게시판 | 37-opinion-board |
| 해시태그 | 38a-hashtag-form-slides, 38b-hashtag-infographic-teacher |
| 물음표(qmark) · 활동 예시 코드 | 39a-qmark-activity-examples |
| 돌발 퀴즈 | 39b-popquiz (일부는 13번) |
| 가로세로 퀴즈 | 40-crossword, 42a-raft-crossword-signup |
| 떠 있는 메신저 | 41-floating-messenger |
| 회원가입 교사 코드 칸 | 42a-raft-crossword-signup |
| 브레인 라이팅 · 선생님 댓글 · 체험용 샘플 반 | 42b-brainwrite-comments-sample |

이 폴더 밖에도 **컴포넌트가 직접 불러오는 CSS**가 몇 개 있습니다(예: `components/dashboard/dashboard.css`,
`components/reading/reading.css`, `components/demo-classroom.css`). 이것들은 이 폴더와 따로 움직입니다.

## 2. 클래스 이름 앞부분(접두사)으로 찾기

같은 기능의 클래스는 보통 같은 앞부분을 씁니다. 아래는 그 앞부분이 나오는 파일입니다.

| 접두사 | 기능 | 나오는 파일 |
|---|---|---|
| `xw-`, `xwg-` | 가로세로 퀴즈 | 40, 42a, 42b |
| `ht-`, `hts-` | 해시태그 | 38a, 38b, 42b |
| `pq-` | 돌발 퀴즈 | 13, 39b |
| `mm-` | 마인드맵 | 30 |
| `bw-` | 브레인 라이팅 | 42b |
| `cornell-` | 코넬 노트 | 34, 35, 36 |
| `qmark-` | 물음표 활동 | 39a, 42b |
| `opinion-` | 의견 게시판 | 37, 42b |
| `msgr-` | 메신저 | 08a, 41 |
| `qsig-` | 손들기 신호 | 04, 41 |
| `pycell-` | 파이썬 셀 | 36, 37, 39a |
| `sample-` | 체험용 샘플 반 | 42b |
| `raft-`, `paratext-`, `kwl-`, `kwls-`, `study-`, `lesson-`, `modal-` | 여러 화면 공통 | 많은 파일에 흩어져 있음 |

흩어진 접두사는 검색이 가장 빠릅니다: `rg "\.raft-" app/styles`

⚠ **화면 코드(JS)가 이름을 조립하는 클래스가 있습니다.** 예를 들어 `` `pad-${색}` ``, `` `ht-insight-${종류}` ``,
`grass-cell--…`, `reading-status--…`처럼요. 이런 이름은 소스에서 통째로 검색해도 안 나오므로,
"검색해서 안 나오니 안 쓰는 CSS"라고 판단해 지우면 안 됩니다.

## 3. 파일을 고치거나 더할 때 지킬 것

1. **순서가 곧 규칙입니다.** 같은 선택자가 두 번 나오면 뒤의 것이 이깁니다(그런 곳이 45곳).
   `globals.css`의 `@import` 줄 순서를 바꾸지 마세요.
2. **새 규칙은 관련 파일의 알맞은 자리에** 넣으세요. 새 파일이 꼭 필요하면 관련 번호 바로 뒤에
   `@import` 한 줄을 끼워 넣습니다.
3. **이름 규칙:** `번호-내용.css`. 큰 파일을 둘로 나눌 때는 번호를 그대로 두고 `08a`·`08b`처럼
   a·b를 붙여 순서를 지킵니다(번호를 다시 매기지 않습니다).
4. **이 폴더의 파일을 컴포넌트(.jsx)에서 `import` 하지 마세요.** Next.js는 컴포넌트가 불러온 CSS를
   페이지마다 다른 순서로 묶어서, 겹치는 규칙의 승패가 바뀔 수 있습니다. 반드시 `globals.css`로만 불러옵니다.
5. **26번(휴대폰 768px 묶음)은 자리를 옮기지 마세요.** 앞뒤 파일 사이에서 덮는 관계가 맞춰져 있습니다.
6. **확인:** 옮기기·나누기만 했다면 `npm run css:fingerprint` 결과가 `SAME`이어야 합니다.
   모양을 바꿨다면 `DIFF`가 정상이고, 이때는 화면을 눈으로 비교합니다.
