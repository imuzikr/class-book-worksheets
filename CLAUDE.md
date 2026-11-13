# 책나눔 성장 기능 추가 안내

교사 화면의 단계별 원문 이동·전체 학생 진행·브레인라이팅 미배정 표시는 `TEACHER_MONITORING.md`를 참고하세요. 모든 독서 활동의 단계·작성 상태 필터는 제거했습니다. 조각은 저장 상태 기준을 사용하며, 모둠 완성·개인 기여·실시간 접속을 혼합하지 않습니다.

플로팅 메뉴의 분석 리포트(`/dashboard` — 교사 화면 이름은 **관리자 대시보드**, 학생 프로필 창 · 탈퇴)는 `DASHBOARD.md`가 현재 기준입니다. 상단 대시보드 버튼은 없으며, 학생은 개인 화면, 교사는 개인별·학급별·전체 탭과 왼쪽 사용자 목록을 사용합니다. `lib/dashboard.js`와 `lib/dashboardReports.js`가 공통 집계를 담당하고 `/api/dashboard`가 반·학생 조회 권한을 검사합니다. 질문방 자료를 사용하지 않으며, 책나눔 OFF에서도 수업 활동 분석은 유지합니다. 대시보드 응답에는 개인 서재 정본·권한 없는 반 자료·사적인 독서 감상을 내려주지 마세요 — 학생의 서재·독서 발자국·한 권의 책 원문은 **교사 책나눔의 학생 명단**(`TeacherReadingView` · `/api/reading?uid=`, 읽기 전용, 선생님 결정)에서만 봅니다. 전체 분석은 조회 가능한 운영 반만 합산하고 개인별 분석은 선택 반의 현재 학생만 허용합니다. 학기 설정은 `classes`의 `dashboardSemesterStart`/`dashboardSemesterEnd`에 저장합니다.

교사 개인별 분석의 **활동 보고서**는 참여한 11종 활동의 문항별 원문을 펼쳐 표시합니다(`ActivityReport`, `ActivityReportContent`, `lib/activityReport.js`). 본문을 요약·절단하지 말고 줄바꿈을 유지하세요. RAFT 원문과 공개 피드백 인용 위치를 보존하고, 마인드맵은 실제 `MindmapCanvas`를 읽기 전용으로 사용합니다. 모둠 활동의 개인 기여와 빙고 공동 결과를 구분하세요. 확장된 `report` 필드는 서버에서 권한을 확인한 교사 개인별 요청에만 포함하며 학생 본인·학급별·전체 응답에는 추가하지 않습니다. 미시작·배정 대기는 별도 접는 목록입니다. 조회 기간은 독서 통계에 적용하며 활동은 현재 저장 상태입니다.

수업 노트(Cornell) 기능은 코드까지 걷었습니다(서랍 · 크게 보기 · KWLS 노트 탭 · 오늘의 활동 내보내기 · PDF). 상단바에 노트 서랍 · 손잡이를 다시 달지 마세요. 발표 화면은 노트 서랍 폭만큼 줄이지 않습니다. **저장된 옛 노트(`classes/*/cornellNotes`)는 지우지 마세요** — 반 완전 삭제 · 학생 탈퇴 때만 함께 지웁니다. 자리표 팝오버의 누가기록(`StudentNotesModal`)과 독서 활동 자체의 성찰 입력은 별도 기능입니다.

학생 15명·독서 활동 11종·서재 24권의 데모 자료와 신원 전환은 `DEMO_CLASSROOM.md`를 참고하세요. `lib/demoClassroom.js`, `lib/demoBookActivities.js`, `lib/demoReading.js`가 공유 식별자와 목 데이터의 출처입니다. Firebase 미설정일 때만 사용하며 실제 데이터베이스에 시드하지 않습니다. 학생 전환 시 개인 편집 상태가 섞이지 않도록 `app/books/page.js`의 사용자별 `TopNav` 및 본문 key를 유지하세요.

교사 상단바의 **관리자 설정**(`/books?area=settings`, 리더보드 오른쪽 · 교사만)이 **선생님의 모든 반에 한 값으로**(반마다 따로가 아님 · `setTeacherFeature`, 새 반도 따름) 과일 바구니(`fruitBasketEnabled` — 없으면 켜짐, 판정은 `lib/reading.js`의 `fruitBasketOn`, 끄면 떠 있는 동그라미의 '과일 바구니' 행성과 `?open=fruit` 창을 가림 · 담긴 과일은 보관) · 책나눔 성장 기능(`readingEnabled` — 켜면 경험치 · 레벨업 · 뱃지 · 순위 집계가 함께 돎) · 도서 검색(`bookSearchEnabled` — 기본 꺼짐, 켜면 책꽂이 새 책 등록에 카카오 도서 검색 단추)과 리더보드(`rankingEnabled` — 칸 이름은 옛 그대로 · 없으면 켜짐, 판정은 `rankingEnabled()` 한 곳. **상단바 리더보드 화면만** 켜고 끄고, 꺼 둔 동안에도 경험치 · 반 집계와 책나눔의 '우리 반 랭킹' 탭은 그대로 — 선생님 요청, 한때 이름이 '랭킹 시스템') · 독서 TOP 3(`readingTopEnabled` — 없으면 켜짐, 판정은 `lib/reading.js`의 `readingTopOn`, 상단바 가운데의 TOP 3만 — 리더보드와 따로) · 학생 캐릭터(`characterEnabled` — 없으면 켜짐, 판정은 `lib/readingCharacter.js`의 `characterChoiceEnabled`, 리더보드를 꺼도 '내 프로필'에서 고름) · 학생 펫(`petEnabled` — 없으면 켜짐, 판정은 `lib/readingPet.js`의 `petEnabled`) · 책 광장(`plazaEnabled` — **기본 꺼짐**, 판정은 `lib/reading.js`의 `plazaOn`) · 교실(`classroomEnabled` — **기본 꺼짐** · 책 광장이 켜져 있어야 켬, 판정은 `lib/reading.js`의 `classroomOn`)을 켜고 끕니다. 기준은 `READING_GROWTH.md`의 '관리자 설정' 절입니다.

**책 광장**(책나눔의 셋째 탭 — 광장을 켠 반에서 '우리 반 랭킹' 자리에 섬 · 선생님 요청 · 한때 이름이 '독서 광장' — 옛 이름을 화면 · 문서에 다시 쓰지 마세요)은 `READING_GROWTH.md`의 '책 광장' 절이 기준입니다. 광장 그림 위를 내 캐릭터가(펫을 데리고) 걸어 가판대(지금 읽는 책 — 독서 발자국)와 책꽂이(완독한 책 — 한 권의 책)에서 반 친구의 글을 읽고 댓글을 남깁니다. 셈은 `lib/readingPlaza.js`, 화면은 `components/reading/ReadingPlaza.jsx` · `PlazaPanel.jsx` · `PlazaSprite.jsx`. **반 친구에게 보이는 것은 서버가 맞춰 두는 공유 사본뿐입니다**(`classes/{c}/plazaShelves` · `plazaBooks` · `plazaComments` — 서버만 쓰고 규칙은 읽기만 엶). 발자국은 기본이 공유이되 **광장을 켠 반에서 쓴(고친) 것만**(도장 `log.plaza`) 보이고, 한 권의 책은 학생이 **'책꽂이에 꽂기'**를 누른 것만 보입니다(선생님과 정함) — 광장을 켜기 전의 글을 한꺼번에 공개하거나, 서재 정본을 반 친구가 읽게 열지 마세요. 발자국마다 '나만 보기'를 고르는 칸은 두지 않습니다(선생님 결정 — 책마다 '발자국 보이기'만 끔). **함께 있는 친구들**(선생님 요청 — 광장 탭을 연 반 친구와 선생님의 캐릭터 · 펫이 서로의 화면에서 함께 걷고, 이름표 · '읽는 중' · '지금 n명'이 섬)은 `READING_GROWTH.md`의 '함께 있는 친구들' 절이 기준입니다. 자료는 Firestore가 아니라 **Realtime Database**입니다(`plaza/{반}/who` — 입장권 + 이름표 · **서버만 씀**, `plaza/{반}/pos` — 내 자리 · 본인만 씀, 규칙 `database.rules.json`). 주소(`NEXT_PUBLIC_FIREBASE_DATABASE_URL`)를 넣은 배포에서만 켜지고 없으면 내 캐릭터만 보입니다(관리자 설정에 스위치를 따로 두지 않음 — 책 광장 스위치를 따름). 자리를 Firestore로 옮기거나, 이름표 · 캐릭터 · 펫을 본인이 적게 하거나, 알 단계의 종을 입장권에 싣지 마세요. **걸음마다 올리지 않습니다** — 누른 곳으로 걸을 때 길을 한 번 · 방향키는 0.3초에 한 번 · 멈출 때 한 번(내려받는 양이 보내는 사람 × 듣는 사람으로 늘어남 — 간격을 줄이지 마세요). 연결은 광장 탭을 연 동안만 잇고, 가려진 탭(45초)과 가만히 둔 학생 화면(10분)은 놓습니다(무료 요금제의 동시 연결 100개 — 선생님 화면은 가만히 두어도 놓지 않음). Realtime Database SDK는 실제로 이을 때만 내려받습니다(`lib/data/plazaLive.js`의 `import()` — 다른 파일에서 `firebase/database`를 곧바로 import하지 마세요). 서버는 Realtime Database를 **REST로만** 읽고 씁니다(`lib/server/plazaLiveStore.js` — `firebase-admin/database`의 연결은 서버 인스턴스마다 하나씩 열려 학생 몫의 동시 연결을 먹습니다. 되돌리지 마세요). **이 규칙은 `npm run deploy`가 저절로 올리지 않습니다**(`-- --database-only` 또는 콘솔의 Realtime Database → 규칙). 학생을 반에서 빼거나 사용 중지 · 탈퇴시키면 서버가 그 학생의 입장권 · 자리를 걷고(`resetReadingRankings(…, uid)`), 반을 완전히 지우면 그 반의 실시간 자료를 걷습니다(`clearPlazaLive`). 셈 `lib/readingPlazaLive.js` · 잇고 놓기 `lib/plazaLiveSession.js` · 통로 `lib/plazaLiveChannel.js` · 캐릭터 한 명의 조각 `components/reading/PlazaActor.jsx` · 데모(가상 친구 · 같은 브라우저의 다른 탭) `lib/data/plazaLiveDemo.js`. **맵이 화면을 가득 채웁니다 — 상단바만 남기고 그 아래 전부**(선생님 요청). 광장 탭에서는 상단바 바로 아래부터 화면 바닥 · 좌우 끝까지가 무대이고(여백 · 둥근 모서리 없음), 그림은 그 무대를 빈틈없이 덮게 키워 넘치는 쪽을 시점이 캐릭터를 따라가며 보여 줍니다(`plazaView` · `plazaCamera`). 이 탭에서만 체험반 안내 띠 · 책방 머리말(문구 · 제목 · 반 고르개 · 단추) · 책나눔의 머리띠와 탭 줄 · [교사] 왼쪽 학생 명단과 오른쪽 '멋진 순간'을 **가립니다**(떼어 내지 않음 — `plaza.css`의 '광장 탭', `:has(.reading-hub--plaza)`). 제목 '책 광장' · **'나가기'** · 가판대 · 책꽂이 단추는 줄을 따로 차지하지 않고 맵 위에 얹습니다(`.plaza-hud`). 탭 줄이 없으므로 **나가는 길은 '책 광장' 팻말 옆의 '나가기'**(같은 모양 · 같은 크기 — 책나눔의 첫 탭 '책꽂이'로, `ReadingHub`의 `leavePlaza`)입니다. **선생님이 들어가는 입구는 책나눔 학생 명단 위의 '책 광장 들어가기'**입니다(`TeacherReadingView` · `ReadingHub.jsx`의 `TeacherPlaza` — 책 광장은 반 전체의 자리라 고른 학생과 무관하게, **학생이 한 명도 없는 반에서도** 들어감 · 나가면 명단으로). 한때 길이 고른 학생 화면('○○의 독서 여정')의 셋째 탭 하나뿐이라 학생이 없는 반에서는 탭 줄 자체가 없어 들어갈 길이 없었고(주소 `?tab=plaza`도 안 열림), 학생이 있는 반에서도 입구로 보이지 않았습니다(선생님 신고) — 그 탭은 그대로 두었지만 **입구를 다시 그 탭 하나로 줄이지 마세요**(`READING_GROWTH.md`의 '교사의 책나눔'). 광장의 코드를 내려받는 동안에도 그 팻말 둘이 같은 자리에 섭니다(`ReadingHub`의 `PlazaLoading` — 안내 한 줄만 띄우던 옛 모습으로 되돌리면 느린 와이파이에서 나갈 길이 없습니다 · 높이는 진짜 무대와 같은 셈 `lib/plazaStageRoom.js`). **무대에는 초점 테를 두지 않습니다**(선생님 결정 — 마당을 누른 뒤 방향키로 걸으면 화면 가장자리에 파란 테가 떠서 걷음. 무대 칸 위에 얹는 테 · 바깥 테 · 안쪽 `outline` 어느 것도 되살리지 마세요). 머리말 · 탭 줄을 남기고 그 아래에만 맵을 깔거나, 제목 줄 · 안내 줄을 따로 세우거나, 그림 전체가 한 화면에 들어오게 줄이는 옛 배치로 되돌리지 마세요. 배경 그림(`public/reading-plaza/plaza.webp`)을 바꾸면 `lib/readingPlazaMap.js`의 걷는 길 좌표도 함께 다시 재세요. **캐릭터와 펫은 걷는 그림(도트 시트)으로 걷습니다** — 선생님이 주신 묶음(`public/reading-plaza/sprites/` — 캐릭터 30 · 펫 10, 한 장 288px · 3×3칸 · 발점 (48, 88) · 왼쪽은 오른쪽을 뒤집음), 셈은 `lib/readingPlazaSprites.js`(방향 `plazaFacing` · 걸은 **거리**로 넘기는 그림 `plazaWalkFrame` · 펫이 지나온 길을 따라오는 자리), 그리기는 `components/reading/PlazaSprite.jsx`(캔버스 — 정수 배로 키운 뒤 줄여 그려 어떤 배율에서도 또렷하게. `<img>` · `image-rendering`으로 되돌리지 마세요). **펫은 단계가 오를수록 크게 그립니다**(선생님 결정 — 묶음의 펫은 다 자란 모습 한 가지, 2단계 62% → 10단계 100% · 알은 공통 알 그대로). 아래쪽으로 걸을 때 펫이 몸에 가리지 않게 옆으로 비켜 따라오는 것(`plazaPetPeek`)과 걷는 빠르기 260 · 한 장 32px의 짝(초당 8장쯤)은 실측으로 맞춘 값입니다. 캐릭터 · 펫을 새로 더하면 걷는 그림 시트도 함께 넣으세요(시험이 봄). **걷는 모습은 기기의 '애니메이션(동작) 줄이기' 설정과 상관없이 늘 보입니다**(선생님 신고 — 한때 그 설정이 켜진 기기에서는 걷는 그림을 넘기지 않아 캐릭터가 발을 안 움직이고 미끄러져 다녔습니다 · 학교 PC에 흔한 설정 · 셈 `plazaShownFrame`). 그 설정은 시점이 따라붙는 움직임과 꾸밈 효과(깜빡임 · 포털의 빛 …)에만 듣습니다 — 걷는 그림 · 알의 통통 뛰기에 다시 걸지 마세요(시험이 봄). 무대 · 창 · 걷는 길 · 걷는 그림의 코드는 광장 탭을 열 때만 내려받습니다(`ReadingHub`의 `dynamic`) — 책방 첫 화면에 곧바로 import하지 마세요.

**교실**(책 광장의 둘째 방 — 관리자 설정의 '교실'을 켠 반 · 선생님 요청)은 `READING_GROWTH.md`의 '교실' 절이 기준입니다. 책 광장 왼쪽 아래의 포털로 교실에 들어가고(교실 오른쪽 아래 포털로 돌아옴), 책 광장 탭을 열면 **마지막에 있던 방**에서 시작합니다. 셈은 `lib/readingClassroom.js`, 방 · 책상과 러그 · 칠판 · 포털의 좌표는 `lib/readingPlazaMap.js`(방 정의 `plazaRoomOf` — 걷는 길의 셈은 모두 마지막 인자로 방을 받음), 러그와 책상 · 그림 위에 얹는 것은 `components/reading/PlazaClassroom.jsx`, 책방 페이지가 넘기는 묶음은 `app/books/page.js`의 `classroomProps`. **선생님과 정한 것 — 되돌리려면 먼저 여쭙니다**: ① 책상의 주인은 **'자리 배정하기'의 자리표**(저장된 `seatLayouts/default` — 광장에서 따로 고르지 않음 · 자리표에 없는 학생은 책상이 없고 선생님 화면에 '자리표에 없는 학생 n명'이 섬) ② **걷는 키는 방향키뿐**(W A S D로 걷기를 되살리지 마세요 — **A는 행동 · S는 첫 단추 · C는 둘째 단추**, 한글 입력 상태의 ㅁ · ㄴ · ㅊ도 들음 `plazaLetterKey`). **내 책상의 러그에 올라서면** 책상 위에 물음표 → A → `앉기(S) · 취소(C)`, 앉은 채 A → `다시 서기(S) · 취소(C)` ③ 선생님은 **칠판 앞에서 A → `출석시작(S) · 출석종료(C)`**이고 **출석시작을 누르는 그 순간 제자리에 앉아 있던 학생만** 출석입니다(그때 접속하지 않았거나 앉아 있지 않으면 아님 · 다시 누르면 그때 앉아 있는 학생이 더해짐) ④ 스위치는 책 광장과 따로 ⑤ 마지막 방은 이 기기에 기억 ⑥ **책상은 짝짓지 않고 한 줄씩**(6칸 × 5줄)이고 책상마다 깔린 **동그란 러그가 그 자리의 범위**(러그 위에 서야 물음표 — 판정 `classroomNearSeat` · 복도 한가운데는 맨바닥. 두 칸씩 짝지은 옛 배치 · '책상 옆' 네모 범위를 되살리지 마세요) ⑦ **칠판에서 출석을 확인한 날에는 교실을 나간 학생에게 출석이 보이지 않습니다** — 그날은 제자리에 앉아야만 출석이라 책방 머리말의 '출석하기' 단추(이미 출석한 학생의 '✓ 출석 완료'도)를 그리지 않습니다(판정 `lib/reading.js`의 `classroomRollToday` — 교실을 켠 반 · `classroomCallAt`의 날짜가 오늘 · 그날 하루 내내. '출석 관리' 창으로만 받은 날과 교실을 끈 반은 지금처럼 단추. 한때 그 단추가 그대로 떠서 앉지 않은 학생이 교실을 나가 단추로 출석했습니다 — 되살리지 마세요. 가리는 것은 화면이고 규칙은 그대로 · 이 판정은 책방 첫 화면이 쓰므로 광장 지도를 끌어오는 `lib/readingClassroom.js`에 두지 않습니다) ⑧ **선생님의 맵 위 왼쪽 팻말은 둘 — 광장에서는 `모두 교실로 · 나가기`, 교실에서는 `모두 광장으로 · 나가기`**이고 앞의 단추(`.plaza-gather`)가 **책 광장 탭을 열어 둔 학생 모두와 선생님을 그 방으로 옮깁니다**(선생님 요청 — 학생과 교실을 끈 반의 선생님은 지금처럼 방 이름 팻말 · '나가기'는 누른 사람만 나감. 반 문서에 `classroomMoveTo` · `classroomMoveAt`을 한 번의 쓰기로 적고(`moveClassroomAll`) 화면들이 그 값을 보고 스스로 옮김 — 출석 확인과 같은 길이라 **규칙 · Realtime Database를 건드리지 않습니다**. **보는 동안 온 새 신호는 기기 시계를 보지 않고 따릅니다**('지금까지 본 것보다 큰가'로 가림 · 보낸 때는 늘 앞 신호보다 크게 적음 — 시계 창을 되살리지 마세요: 시계가 틀린 선생님 기기에서 누르면 학생이 아무도 안 움직입니다). 화면을 열 때 이미 있던 신호는 한 시간 안 · 이 기기가 아직 안 따른 것만(늦게 들어온 학생). 설 자리는 `classroomMoveSpot` — 선생님은 칠판 앞 · 학생은 제 러그의 귀 · 나머지는 흩어 섬. 이미 그 방이면 그대로(앉은 채). 쓰던 댓글이 있는 창은 닫지 않습니다. 두 번 눌러도 한 번만(`GATHER_GAP_MS` — 시간으로 막음). **책 광장 탭을 열어 두지 않은 학생은 옮기지 않습니다**(쓰던 글이 날아감 — 넓히려면 선생님께 먼저 여쭙니다). 기준은 `READING_GROWTH.md`의 '모두 이동'). **출석 기록은 앉아 있던 학생의 화면이 스스로 남깁니다** — 선생님의 출석시작(`callClassroomRoll`)이 반 문서에 출석 열기 두 칸과 '확인한 때'(`classroomCallAt`)를 **한 번의 쓰기로** 적고, 학생 화면이 그 값이 바뀌는 것을 본 순간 앉아 있으면 '출석하기' 단추와 같은 기록(`markStudyAttendance`)을 남깁니다(`classroomRollCall` — 화면을 열고 처음 본 값은 기준일 뿐). **출석 · 자리표의 화면과 규칙은 건드리지 않습니다**(교실은 그 자료를 읽고 같은 기록을 남기기만 함 — 선생님이 대신 쓰는 길 · 새 출석 컬렉션으로 바꾸지 마세요. 하나만 예외 — ⑦의 '출석하기' 단추를 그날 그리지 않는 것, 선생님 결정). 세 배경 그림(`plaza.webp` · `plaza-door.webp` · `classroom.webp`)은 **같은 크기**(1672×941)여야 합니다. **책상 · 의자 · 러그 · 포털은 배경에 그려져 있지 않습니다**(선생님이 주신 분리 그림 — `rug.webp` · `desk-chair.webp` · 의자만 남긴 `chair-front.webp` · `portal.webp`) — 화면이 자리 좌표대로 따로 그리고(`PlazaClassroom.jsx`의 `PlazaFurniture` · 포털은 무대), 겹치는 차례는 바닥 → 러그 → 책상·의자 → 캐릭터 → 앉은 캐릭터의 의자입니다. 배경에 다시 그려 넣지 마세요. **그림 · 배치를 바꾸면 러그의 가운데(`DESK_X` · `RUG_Y`) · 책상 줄의 못 가는 띠 · 칠판 · 포털 · 바닥의 좌표를 함께 다시 재세요**(책상 30개의 차례 = 자리표의 30자리 · 다듬기 `scripts/prepare-classroom-art.py`). 앉은 주인을 기다리는 펫은 **펫이 있는 쪽 러그 귀**에 섭니다(`classroomSeatSide` — 곧게만 걸어 책상 줄을 못 건넘). **칠판의 고르는 단추 상자는 선생님 옆(칠판 위)**에 뜹니다 — 머리 위에는 자리가 모자라 상자가 화면 밖으로 잘렸습니다(되돌리지 마세요 · 좁은 무대에서는 발 아래). 포털의 이름표는 방을 막 건너와 그 위에 서 있는 동안 걷습니다(얼굴을 가림). 함께 보기(Realtime Database)의 자리에는 `z`(교실에 있음) · `s`(앉은 책상 번호)가 실리고 무대는 같은 방의 친구만 세우며, 앉았다는 친구는 그 책상이 자리표에서 그 친구의 것일 때만 앉혀 그립니다 — **`database.rules.json`을 다시 게시한 뒤에 교실을 켜야** 교실의 친구가 서로 보입니다(앉기 · 출석은 Firestore만 써서 그 전에도 됨). 앉아 있는 학생은 가만히 있어도 한 시간까지 연결을 놓지 않습니다(`PLAZA_LIVE_SEATED_IDLE_MS`).

**독서 맵**은 관리자 설정에서 **대륙**(`continent`, 기존 맵)과 **모험**(`cloud-islands`, 기본값) 중 고릅니다. `lib/readingMapCatalog.js`가 이름·허용값·이미지·기본값의 기준이고 `classes.readingMapTheme`에 저장합니다. `setTeacherReadingMapTheme`가 운영 중인 모든 반에 함께 적용하며 새 반도 따릅니다. 두 맵은 각자 다른 길과 레벨 거점을 `lib/readingWorldMap.js`에서 사용합니다. 그림만 바꾸고 기존 좌표를 재사용하지 마세요. 경험치·레벨·펫 성장은 바뀌지 않습니다.

**독서 펫**(학생마다 알 하나 → 10단계 · 리더보드와 '내 프로필'에 캐릭터와 함께)은 `READING_GROWTH.md`의 '독서 펫' 절이 기준이고, 셈은 `lib/readingPet.js` 한 곳 · 알 받기와 깨우기는 서버(`/api/reading/pet`)만 합니다. **알 단계의 종은 서버만 읽는 `users/{uid}/reading/pet`에만 두세요** — 급우도 읽는 프로필의 `readingPet`에 미리 적으면 비밀(선생님 결정)이 샙니다. 펫 경험치는 알을 받은 뒤에 쌓인 누적 경험치(모두 독서로 얻은 것)이고, 이미 경험치가 있던 학생도 알부터입니다. 선생님 · 관리자는 펫이 없습니다.

**책나눔의 첫 탭 이름은 '책꽂이'입니다**(선생님 요청 — 한때 '내 서재', 교사가 학생 것을 볼 때는 '서재'). 화면 글자(탭 · 제목 · 단추 · 알림 · 관리자 설정 · 리더보드의 '책꽂이로 이동' · 대시보드)에 옛 이름을 다시 쓰지 마세요. 책 광장에도 '책꽂이'(완독한 책을 꽂아 두는 자리)가 있어 이름이 겹칩니다 — 첫 탭 쪽 화면에서 광장의 것을 말할 때는 늘 **'광장 책꽂이'**라고 적습니다('광장 책꽂이에 꽂기'). 문서 · 주석의 '서재(정본)' · '개인 서재'는 화면 이름이 아니라 그 탭이 보여 주는 자료(`users/{uid}/reading/main`)를 가리키는 말로 남겨 두었습니다. 읽기 시작한 책 수의 뱃지도 '서재의 시작'에서 **'독자의 길'**로 바꿨습니다(선생님 결정 — 뱃지 번호 `shelf_*`와 그림은 그대로 · 옛 이름을 화면에 다시 쓰지 마세요).

`READING_GROWTH.md`가 새 개인 서재·경험치·18종 뱃지·반 랭킹의 현재 기준입니다. 상단바 **리더보드**(`/books?area=leaderboard` — 독서 맵 · 독서 랭킹 · 학생별 경험치/뱃지 창 · 나의 독서 여정)도 같은 문서의 '리더보드' 절이 기준이며, 셈은 `lib/readingJourney.js`입니다. 친구에게는 수와 뱃지만, 책 제목 · 감상은 보이지 않게 두세요(리더보드 · 순위는 그대로 — 책 제목과 글이 반 친구에게 보이는 자리는 책 광장 하나뿐입니다). 경험치 셈(연속 보너스 7일 상한 · 하루 5쪽 이상)은 같은 문서의 '경험치와 정정'이 기준이고, 셈을 바꾸면 `READING_FORMULA`를 올리세요(옛 반 집계를 다시 셈). **과일은 경험치가 아닙니다**(선생님 요청 — 과일은 앞으로 펫 먹이로만 · 한때 1개에 10 EXP였고 그 셈 · 지급 이력 읽기 · `/api/reading/refresh`를 모두 걷음, `READING_FORMULA` 3). 과일 경험치를 되살리지 마세요. **레벨은 10이 끝입니다**(선생님 결정 — 한 학기 수업 · 펫 10단계와 짝, `lib/reading.js`의 `READING_LEVEL_MAX` · `READING_FORMULA` 4) — 독서 맵도 Lv.1 출발 → Lv.10 도착 한 바퀴입니다. 상한을 다시 올리지 마세요. 반별 `readingEnabled === true`일 때만 활성화하며 기본 꺼짐입니다. 기존 독서 활동은 이 스위치와 무관하게 유지합니다. 책나눔 · 리더보드가 서버에 다시 묻는 때(책나눔은 화면이 보일 때만 60초 · 리더보드는 10분, 탭으로 돌아오면 5분 넘었을 때만 — `lib/visiblePoll.js`, 순위의 기간 단추는 다시 묻지 않음 · 과일이 바뀌어도 다시 묻지 않음)는 같은 문서의 '서버에 다시 묻는 때'가 기준입니다. **반 순위는 서버가 10분에 한 번만 셈해 `classes/{c}/readingRank/current` 한 장에 저장하고 여럿이 그대로 씁니다**(선생님 요청 — 10분 안의 조회는 4건만 읽음 · 아무도 안 보면 안 셈 · 여럿이 한꺼번에 와도 한 요청만 셈). **학생도 교사처럼 반 전체를 받습니다**(선생님 결정 — 한때 상위 10명과 본인만 보냈는데 읽기는 저장한 한 장 그대로라 줄지 않아 되돌림 · `lib/readingJourney.js`의 `rankingResponse`). 학생을 사용 중지 · 반에서 빼기 · 탈퇴시키면 그 장을 지웁니다(`resetReadingRankings`). 저장 시간 · 묻는 주기를 다시 짧게 하지 마세요.
새 영역은 Next.js Node API와 Firebase Admin SDK에서 인증·반 권한·보상 트랜잭션을 검증합니다. 기존 문서의 “서버 함수 없음”은 Cloud Functions/App Check를 추가하지 않는다는 뜻이며, 새 성장 기능에는 Vercel 서버 API 및 서버 전용 Admin 인증 설정이 필요합니다. 클라이언트에서 경험치·랭킹 정본에 직접 접근하지 마세요. 데모/서버는 `lib/reading.js`의 같은 계산·검증 로직을 사용합니다.

# class-book-worksheets — 책 나눔

교실에서 함께 책을 읽고 생각을 나누는 **독서 활동 웹앱**입니다.
[배움나눔(imuzikr/class-peer-qna)](https://github.com/imuzikr/class-peer-qna)의
**책방(`/books`)** 을 떼어 따로 세운 앱이고, 책방 화면에 함께 붙어 있던 것
('멋진 순간' 자리표와 과일 · 돌발 퀴즈 · 손들기 · 메신저 · 학급 방송)은 그대로
가져왔습니다. 함께 가져왔던 '오늘' 패널 · KWLS 차트 · 성장 기록 · 수업 노트 서랍은
걷었습니다(아래).

## 배움나눔과 무엇이 다른가

- **Firebase 프로젝트가 따로입니다.** 계정 · 반 · 기록을 배움나눔과 나누지
  않습니다. 기본값은 원작자 프로젝트(`book-sheets-19fd2`, `lib/firebase-defaults.mjs`)이며,
  `NEXT_PUBLIC_FIREBASE_*` 환경변수로 덮어씁니다(apiKey를 `YOUR_...`로 두면 **데모 모드**).
  실서비스로 바꾸려면 아래 '새 Firebase 프로젝트 연결'.
- **기본 화면은 `/`(랜딩) · `/books`(책방) · `/dashboard` · `/privacy` · `/terms`**입니다.
  `/dashboard`는 책봄 전용 교사·학생 분석입니다. 질문방(`/board`) · 공부방(`/study`) · 원본 관리자 대시보드(`/admin`) · 학습 리포트
  (`/report`) · 파이썬 실행기 · 수업 관리(수업 모드)는 없습니다. 로고와 로그인 뒤
  첫 화면은 `/books`입니다.
  - **파이썬 실행기는 코드까지 걷었습니다** — 실행 엔진(Pyodide · `lib/pyRun.js`) ·
    코드 편집기(CodeMirror 패키지) · 셀 창(`PyCellEditor` · `PyCellModal`) · 그 CSS,
    CSP의 jsDelivr · blob 스크립트 · Worker 허용까지. 돌발 퀴즈 학생 창이 이것들을
    미리 불러와 모든 화면이 무거웠습니다 — 걷고 나서 책방 첫 화면 728 → 574KB ·
    분석 리포트 628 → 474KB(빌드 표의 First Load JS).
    예전에 보낸 '코드' 돌발 퀴즈가 아직 열려 있으면 고정폭 글자 칸에 코드를 적어
    보냅니다(실행 없음 — 규칙 · 자료 모양은 그대로). **되살리지 마세요.**
- **공부방 머리말에 있던 창을 책방에서 엽니다**(`app/books/page.js`):
  - 머리말 단추 — 교사 **'반 관리하기'**(`ClassManagerModal` → '자리 배정하기'로
    `SeatGroupSetupModal`) · **'출석 관리'**(`StudyAttendanceModal`), 학생
    **'출석하기'**(선생님이 오늘 출석을 열었을 때만 — 교실의 칠판에서 출석을 확인한
    날에는 서지 않습니다: 그날은 제자리에 앉아야만 출석 · 위 '교실'의 ⑦).
  - 반이 하나도 없는 교사에게는 목록 자리에 **'＋ 반 만들기'**가 섭니다.
  - 떠 있는 동그라미(`FloatingHub`)의 행성은 `/books?open=attendance|fruit|classes`
    로 이 화면의 창을 엽니다(연 뒤 `open`만 지움). '분석 리포트'(교사는 '대시보드')는
    `/dashboard`로 갑니다.
- **KWLS 차트 · 왼쪽 '오늘' 패널 · 성장 기록은 걷었습니다**(선생님 요청).
  - **KWLS는 책방의 'KWLS로 성찰하기' 활동으로만** 씁니다. 머리말의 'KWLS 차트'
    단추와 그 패널(`TeacherKwlPanel` · `KwlPanel` · `KwlFullscreenModal`), 동그라미의
    KWLS 행성을 지웠습니다. 활동의 저장(`saveKwlsActivityEntry` — entries와 `kwl`
    둘에 씀)과 교사 화면(`KwlsBoard` — `kwl`에서 읽음)은 그대로입니다. 학생의 지난
    KWLS를 넘겨 보던 'KWLS 노트' 탭(`MyKwlsNotes`)은 수업 노트 서랍과 함께 걷었습니다.
  - 왼쪽 '📌 오늘' 패널(`StudyActivityPanel` · `StudyTodayFeed`)을 지웠습니다.
    `.books-body`에는 본문과 오른쪽 '멋진 순간'만 섭니다. 출석 기록 구독은
    출석 관리 · '출석하기' · 자리표가 쓰므로 남겼습니다.
  - 교사의 '성장 기록' 단추와 창(`ClassNotesTools` · `ClassNotesManagerModal` —
    누가기록 · 수업 노트 · 수업 메모 탭)과 거기에만 쓰이던 조각(`CornellNotesPanel` ·
    `CornellNoteReadModal` · `LessonMemoPanel`)을 지웠습니다. 보드들의 `classTools`
    prop도 함께 걷었습니다. **자리표 팝오버의 '누가기록 열기'는 남아 있습니다**
    (학생 한 명의 기록을 적고 보는 자리 — `StudentNotesModal`).
  - 그 바람에 아무도 안 부르게 된 `StudyActivityWall` · `StudyProgressBoard` ·
    `KwlSemesterHeatmap` · `UploadProgress`도 지웠습니다.
- 알림 벨은 반 공지 · '내 생각은요' 댓글 · RAFT 피드백을 받습니다(질문 답변 · 모둠 메모로 옮겨 갈 화면이 없음).
- **배움나눔에서 따라온 코드 중 화면이 안 쓰는 것은 걷었습니다**(2026년 11월 정리) — 수업 노트(코넬)
  서랍 일체 · 질문방 · 공부방(프로젝트 · 카드 · 선생님 보드 만들기) · 수업 메모 · 모둠 메모 · 키워드 ·
  옛 상단 전광판 · KWLS 차트의 자료 함수와 CSS, 데모 자료의 화학 수업 예시, 아무도 안 읽던 기록
  (수업 화면을 띄우는 동안 20초마다 쓰던 접속 표시 `presence` · 손들기 '확인' 이력 `signalEvents`).
  **되살리지 마세요** — 되살리려면 선생님께 먼저 여쭙니다(배움나눔 저장소와 git 기록에 그대로 있습니다).
  이미 쌓인 옛 문서는 지우지 않고, 반 완전 삭제 · 학생 탈퇴 때 함께 지웁니다.
- **규칙(`firestore.rules`)은 지금 화면이 쓰는 컬렉션만 남겼습니다**(2,006 → 1,600줄 남짓).
  걷은 것: 질문방(`questions` · `answers` · `notices` · `keywords`) · 모둠 메모(`groupMemos`) ·
  수업 자료(`lessons`) · 프로젝트 원본(`studyTemplates`) · 공부방 카드(`studyBoards/*/cards`) ·
  수업 메모(`lessonMemos`) · 수업 노트(`classes/*/cornellNotes`), 그 규칙만 쓰던 도우미와 시험.
  - match가 없으면 아무도 못 읽고 못 씁니다 — **문서는 지워지지 않습니다**(옛 수업 노트 등은
    그대로 남아 콘솔에서 보입니다).
  - **`studyBoards` · `presence` · `signalEvents`는 읽기 · 지우기만 남깁니다** — 앱이 더는 만들지
    않고, 반 완전 삭제 · 학생 탈퇴가 옛 문서를 찾아 지울 길만 둡니다(만들기 · 고치기는 닫음).
    시험 `tests/rules/studyBoards.test.mjs` · `presence.test.mjs` · `signalEvents.test.mjs`.
  - 옛 전광판이 쓰던 `meta` 규칙도 걷었습니다(아무도 안 씀).
  - 화면이 부르는 함수에서 위 컬렉션을 다시 쓰게 되면 규칙을 되살리고 배포한 뒤에 올리세요.
  - 아래 원본 기록에 나오는 `tests/rules/` 시험 가운데 `questions` · `answerEdit` ·
    `answerReactions` · `cardReactions` · `studyCards` · `studyTemplates` · `groupMemos` ·
    `lessonMemos` · `cornellNotes`는 함께 걷었습니다(배움나눔 저장소에 그대로 있습니다).
- **서버 함수(Cloud Functions)와 App Check가 없습니다** — 비전공 선생님도 무료 요금제로
  배포하게(선생님 요청). 아래 '서버 함수 없이 돌리기' 절.
- 아래 '첫 화면'부터의 절은 원본 앱의 기록에서 **이 앱에 있는 화면만** 남긴 것입니다(공부방 ·
  질문방 · 파이썬 실행기 · 수업 모드 · 수업 노트 이야기는 걷었습니다 — 배움나눔 저장소에 그대로
  있습니다). 본문에 '공부방' 등이 나오면 그 약속이 생겨난 내력입니다.

## 기술 스택

- **프레임워크**: Next.js 15.5 App Router, React 19 (Client Components)
- **DB**: Firebase Firestore (실서비스) / 브라우저 인메모리 Mock (데모 모드)
- **스타일**: `app/globals.css`는 입구일 뿐이고, 실제 규칙은 `app/styles/`의 46개 파일(01~44 번호 순, 큰 조각은 14b·28a·28b처럼 a·b로 나눔)에 있습니다. globals.css의 `@import` 순서가 곧 적용 순서이니 바꾸지 마세요. 옮기기·정리 뒤에는 `npm run css:fingerprint`로 빌드 CSS가 그대로인지(SAME) 확인합니다. 화면이 안 쓰는 규칙을 걷을 때는 지우기 전후로 데모 화면의 계산된 스타일을 견주었습니다(2026년 11월 정리 — 바뀐 것 0). (CSS Variables + Flexbox) 파일별 안내는 `app/styles/README.md`를 보세요.
- **배포**: Vercel (앱) · Firebase (규칙 · 색인 · 함수 · Storage 규칙)

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000) — 데모 모드면 /books로 바로
npm run build      # 프로덕션 빌드
npm run test:unit  # lib/ 순수 함수 시험 (설치 없음 — node --test)
npm run test:rules # Firestore 보안 규칙 시험 (에뮬레이터, Java 필요, 최초 1회 npm ci --prefix tests/rules)
npm run lint       # ESLint 훅 규칙 (보고만, 최초 1회 npm ci --prefix tools/lint)
```

**단위 시험**(`tests/unit/`)은 앱 코드를 **그대로 import**합니다 —
`tests/unit/resolve.mjs`가 `@/` 별칭과 확장자 없는 import를 풀어 줍니다. **JSX는 못
읽으니** 컴포넌트 안의 셈을 시험하려면 lib/의 함수로 빼내세요. Firebase를 import하는
`lib/store.js`·`lib/data/*`도 못 읽습니다 — 순수 함수는 제 파일에 두세요.

**날짜 셈은 `lib/dates.js` 한 곳입니다** — 날짜 열쇠가 곧 문서 ID(`uid_날짜`)라 한
글자만 달라져도 지난 기록을 못 찾으므로 컴포넌트에 새로 짜지 마세요.

**린트**는 설치물만 `tools/lint/`에, 설정은 루트 `eslint.config.mjs`. 지금 **경고 0개**
입니다. **까닭 없는 끄기 주석은 달지 마세요.**

**CI**(`.github/workflows/ci.yml`)가 main과 `claude/**` 푸시, PR에서 위 셋과 빌드를 돌립니다.

## 새 Firebase 프로젝트 연결

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고 웹 앱을 등록합니다.
   Authentication(**Google만**) · Firestore · Storage를 켭니다. Functions · App Check는 안 씁니다.
   (2024년 10월 이후 만든 프로젝트는 Storage에 Blaze가 필요할 수 있습니다 — 그림 첨부만 막힙니다.)
2. Firebase 웹 설정은 **환경변수**로 넣습니다(`.env.example` 참고).
   로컬은 `.env.local`, Vercel은 Project Settings → Environment Variables.
   `NEXT_PUBLIC_FIREBASE_API_KEY` · `AUTH_DOMAIN` · `PROJECT_ID` · `STORAGE_BUCKET` ·
   `MESSAGING_SENDER_ID` · `APP_ID`를 채우면 `lib/firebase.js`와 `next.config.mjs`가
   그 값을 씁니다(비우면 원작자 기본값). `.firebaserc`는 CLI용이라 `firebase use --add`로
   자기 프로젝트를 고르세요. 관리 스크립트는 `FIREBASE_PROJECT_ID` 또는
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`를 읽습니다.
3. 배포 차례는 **색인 · 규칙 → 앱**입니다.

   ```bash
   npx firebase-tools login
   npm run deploy     # 규칙 시험 → firestore(rules·indexes) + storage 규칙
   ```

   `npm run deploy -- --rules-only` / `--indexes-only` / `--skip-tests`로 좁힐 수 있습니다
   (`scripts/deploy.sh`). Storage 규칙이 반 소속·역할을 Firestore에서 읽으므로(서비스 간 규칙)
   처음 올릴 때 권한을 물으면 'Y'(콘솔은 'Firestore 접근 권한 연결' → 허용). `storage.rules`를
   바꾼 뒤에는 Storage 규칙을 꼭 다시 게시합니다 — Vercel 배포로는 바뀌지 않습니다.
   - **그림은 반 폴더만**(이미지 보안 1~5단계): `uploads/{classId}/{uid}/{파일}`에 올리고(`uploadImage`
     — `classId` 필수), 문서에는 `storage:uploads/…` 경로를 저장하며, `SecureImage`/`SecureHtml`이
     `getBlob`으로 내려받아 보여 줍니다. 읽기는 같은 반 학생 · 담당 교사(`createdBy`) · 관리자,
     목록은 아무도 못 봅니다. 옛 개인 폴더 `uploads/{uid}/…`는 쓰기·목록이 닫혀 있습니다.
4. **콘솔에서 두 가지를 손으로 적습니다.**
   - `config/teacherSignup` 문서에 `code`(4자 이상 글자) — 선생님 가입 코드. 바꾸면 그때부터 새
     코드만 통합니다. 이 문서가 없거나 코드가 짧으면 아무도 선생님이 될 수 없습니다.
   - 첫 관리자 — 그 사람이 앱에 구글로 가입한 뒤 `users/{uid}`의 `role`을 `admin`으로.
     새로고침하면 반영됩니다.

## 가입 · 반 입장 — 공개 운영 (배움나눔과 다른 점)

공개로 배포하는 앱이라 **관리자 이메일과 학교 도메인을 코드에 두지 않습니다.**
배움나눔에 있던 `iseoul72@gmail.com` 부트스트랩 관리자 · `@hansung.hs.kr` 가입 제한 ·
등록 코드(`registrationCodes`) · 손님 계정(`homeClassId`)은 모두 걷었습니다.

- **가입은 구글 계정만**입니다(`lib/auth.js`의 `signInWithGoogle` — 가입과 로그인이 한 길,
  프로필이 없으면 만듦). 규칙이 `request.auth.token.firebase.sign_in_provider == 'google.com'`을
  봅니다. 이메일·비밀번호 가입은 없습니다.
- **역할 = `users/{uid}.role` 한 칸**(`isAdmin` — `lib/user.js` · 규칙의 `userRole()`).
  규칙이 그 문서를 `get()`해 판정하고, 토큰에 `role` 클레임이 있으면 그것을 먼저 봅니다
  (옛 계정 대비). 프로필이 없으면 학생입니다. Storage 규칙도 `firestore.get`으로 같은 칸을 읽습니다.
- **선생님은 교사 가입 코드로 스스로 됩니다**(`becomeTeacherWithCode` — 랜딩의 '선생님'
  가입 · 반 입장 화면의 '선생님이세요?'). 규칙의 `teacherCodeOk`가 `config/teacherSignup.code`와
  견주고, 그 문서는 앱에서 아무도 못 읽고 못 씁니다(`match`가 없음). 학생→선생님 한 번뿐이고
  관리자는 코드로 못 됩니다 · 다른 칸(실명 등)을 끼워 바꿀 수 없습니다. 시험
  `tests/rules/docRoles.test.mjs`. 관리자는 역할 관리 창(`RoleManagerModal`)에서 문서 role을
  곧바로 고칩니다(`assignUserRole`). 선생님이 반을 만들면 참여 코드가 함께 생깁니다.
- **학생은 가입 뒤 참여 코드로 반에 들어갑니다**(`ClassEntry` → `lib/data/classes.js`의
  `joinClassWithCode` — 이름만 남은 **앱 안 함수**이고 서버 함수가 아닙니다).
  - 앱이 `joinCodes/{코드}`를 한 건 읽어 반을 찾고, `memberships/{uid}_{classId}`를 **코드와
    함께** 씁니다. 규칙이 `joinCodes`를 `get()`해 **그 반의 코드인지 · 만료 전인지** 서버에서
    다시 확인하므로, 화면을 거치지 않고 써도 맞는 코드 없이는 못 들어옵니다. 이어서
    `ensureClassIdSynced`가 `users.classIds`를 채웁니다.
  - `joinCodes`는 로그인한 사람이면 **정확한 코드로 1건 get**만 됩니다(목록은 개설 교사 ·
    관리자만). 코드를 모르면 반을 찾을 수 없습니다.
  - **틀린 횟수 잠금은 없습니다.** 한때 서버 함수(`joinClassWithCode`)가 '3번 틀리면 5분'을
    셌는데, 그러려면 Cloud Functions(Blaze) · App Check 배포가 필요해 비전공 선생님이 이
    앱을 따로 배포하기 어려워 걷었습니다(선생님 요청). 코드가 6자리(32글자, 10억 가지)이고
    14일이면 만료되어, 맞혀 들어오기는 사실상 어렵습니다. 되살리려면 학생의 소속 생성 ·
    `joinCodes` 읽기를 규칙에서 다시 닫고 서버 함수로 옮겨야 합니다 — 선생님께 먼저 여쭙니다.
  - 시험 `tests/rules/memberships.test.mjs`('학생이 참여 코드로 들어가기') · `signup.test.mjs`.
- 화면 글자는 '입장 코드'가 아니라 **'참여 코드'**입니다(코드 · 주석의 `joinCode` 이름은 그대로).
- 바닥글 · 개인정보처리방침의 **문의 이메일**(`SiteFooter.jsx` · `PrivacyContent.jsx`)은 접근
  권한과 무관한 연락처라 남겨 두었습니다 — 운영자가 바뀌면 그 두 곳만 고치면 됩니다.

### 반 목록 · 학생 프로필은 '내 반'만 읽습니다

한때 화면을 열 때마다 **모든 반**(`subscribeClasses`)과 **모든 계정**(교사 —
`subscribeUserDirectory`)을 통째로 받았습니다. 이 앱을 쓰는 학교 · 선생님이 늘수록 읽기가
늘고, 교사 누구나 다른 선생님 반 · 다른 학교 학생의 실명 · 학번 · 이메일까지 받았습니다.

- **반 목록**은 `subscribeClasses(viewer, callback)`(사용자를 받음) — 관리자는 모든 반, 교사는
  내가 만든 반만(`subscribeOwnClasses` — `where createdBy == 나`), 학생은 내가 든 반만(소속
  `memberships`를 따라 반 문서를 한 건씩 — 첫 답이 다 모인 뒤 한 번에 알림).
  - 규칙: `classes`의 `get`(문서 id로 한 건)은 로그인한 사람 — 참여 코드로 들어갈 때 ·
    탈퇴 전 다른 선생님 반을 확인할 때 씁니다. `list`는 관리자와 `createdBy == 나` 질의만.
    시험 `tests/rules/classesRead.test.mjs`.
- **학생 프로필**(`users/{uid}`) 읽기는 본인 · 관리자 · **그 학생을 가르치는 교사** · 같은 반
  급우입니다. 통째로 받는 목록은 관리자만(역할 관리 창 — `subscribeUserDirectory`).
  - 교사 화면의 명단은 `useClassRoster` → `subscribeClassDirectory`(소속을 따라 그 반 학생
    문서만 한 건씩). 메신저 명단 · 대시보드 프로필 창도 그 반 학생만 한 건씩 읽습니다.
  - **'가르치는 교사'는 학생의 `classIds`와 교사 프로필의 `ownedClassIds`(내가 만든 반
    목록)가 겹치는가**입니다(규칙 `teachesStudent` — `hasAny`). 교사가 학생 프로필을 고치는
    일(이름 · 학번 · 이메일 · 탈퇴 표시 · classIds 줄이기)도 같은 판정입니다.
  - **반 문서를 열어 보는 판정으로 되돌리지 마세요.** 처음에는 학생의 반마다 반 문서를
    `exists` · `get`으로 열어 '내가 만든 반인가'를 봤는데, 그 한 번이 규칙 식 50~100개를 쓰고
    `exists`와 `get`이 따로 세어져, 학생이 반 대여섯에 들어 있으면 요청 하나의 한도(식
    1000개 · 문서 읽기 10번)를 넘어 **정상적인 교사 요청이 거부**됐습니다(실측). 같은 실험으로
    확인한 것 — 규칙의 `let`은 쓰이지 않아도 **미리 계산**되고, `&&` · `||`는 앞에서 정해지면
    뒤를 계산하지 않습니다. 무거운 판정은 `let`에 담지 말고 값싼 칸 검사 뒤에 두세요.
  - `ownedClassIds`는 반을 만들 때 적고(`addClass` → `ensureOwnedClassId`), 이 칸이 생기기
    전에 만든 반은 **반 목록을 받을 때 · 명단을 열 때 저절로 메웁니다**(규칙이 한 번에 하나만
    받아 반마다 한 번 · 이미 적힌 반은 안 씀 — 로그인 때 받은 `user.ownedClassIds`와 이 세션에
    적은 것을 기억). 반을 완전히 지우면 뺍니다(`purgeClass`). 규칙(`isOwnedClassIdsChange`)은
    본인만 · 그대로 · 줄이기 · **내가 만든 반 하나** 늘리기(반 문서의 `createdBy`를 봄)만 받습니다.
  - 소속은 있는데 학생 프로필의 `classIds`에 반이 빠진 학생(동기화 실패 · 옛 계정)은 교사가
    한 번 메웁니다(`healClassIdsForTeacher` — 규칙 `isTeacherClassIdsAppend`: 내 반 목록에 있는
    반 · 그 학생의 소속 문서가 있음 · 하나만). 학생이 스스로 할 수 있는 일(제 소속 반 잇기)
    그대로라 권한이 넓어지지 않습니다. 교사가 학생을 반에 넣을 때도 함께 잇습니다.
  - 시험 `tests/rules/users.test.mjs`('교사 — 내가 가르치는 학생만') · `docRoles` ·
    `memberships` · `withdraw`. **규칙 시험의 교사 프로필에는 `ownedClassIds`를 적어 두세요.**
- **이 변경의 배포 차례는 '앱 → 규칙'입니다**(평소와 반대). 새 앱은 옛 규칙에서도 그대로
  돕니다(교사의 내 반 질의 · 학생의 반 문서 읽기 · 학생 프로필 읽기가 옛 규칙에서도 열려 있고,
  반 목록 메우기 쓰기만 조용히 실패). 거꾸로 규칙을 먼저 올리면 옛 앱이 반 목록과 사용자
  목록을 통째로 받으려다 막혀 **반이 하나도 안 보입니다.** 규칙을 올린 뒤 선생님이 화면을
  열면 반 목록이 저절로 메워집니다.

### 구글 로그인 창을 우리 주소로 띄우기 (`authDomain`)

학교 와이파이·자녀 보호 앱이 `*.firebaseapp.com`만 막아 구글 로그인 창이 안 뜨는
일이 배움나눔에서 있었습니다. 그래서 `next.config.mjs`의 `rewrites`가
`/__/auth/*`·`/__/firebase/*`를 firebaseapp.com으로 넘겨 주고, `lib/firebase.js`가
`PROXIED_AUTH_HOSTS`에 든 주소에서만 `authDomain`을 그 주소 자신으로 둡니다.

- **지금은 꺼져 있습니다**(`PROXIED_AUTH_HOSTS = []` · `AUTH_PROXY_FOR_ALL = false`).
- 켜려면 **먼저** Google Cloud 콘솔 → API 및 서비스 → 사용자 인증 정보 → OAuth 웹
  클라이언트에 `https://<배포 주소>/__/auth/handler`를 리디렉션 URI로 넣고, 그 주소를
  `PROXIED_AUTH_HOSTS`에 더한 뒤 `?authproxy=1`로 한 기기에서 확인하고 나서
  `AUTH_PROXY_FOR_ALL`을 켜세요. URI가 없으면 `redirect_uri_mismatch`로 **모든 학생의**
  로그인이 막힙니다(구글 쪽 반영에 5분~몇 시간).
- **`/__/` 아래에는 보안 헤더를 안 붙입니다**(`headers`의 `source`) — 로그인 iframe이 막힙니다.
- 데모 모드인 동안은 CSP `frame-src`에 firebaseapp.com을 넣지 않습니다(`FIREBASE_FRAME`).

### 서버 함수 없이 돌리기 — 무엇이 바뀌었나

- **반 완전 삭제는 보관된 반에서만**입니다(반 관리하기 → 보관된 반 → '🗑 완전 삭제',
  `ClassPurgeModal` — 반 이름을 그대로 적어야 지워짐). 웹 SDK에는 '아래까지 통째로
  지우기'가 없어, 앱이 컬렉션마다 찾아 지웁니다(`lib/data/classes.js`의 `purgeClass`).
  - 차례: 독서 활동(`purgeBookActivity` — 학생 글 · 낱말 · 메모 …) → 반 아래 기록 →
    반 바깥 기록(`memberships` · `rewards` · `presence` · `studentNotes` · `studyBoards` ·
    `kwl` · 참여 코드 · 방송) → **반 문서는 맨 마지막**. 규칙 판정(`canPurgeClass`)이 반
    문서를 읽고, 중간에 끊겨도 반이 남아 다시 누르면 남은 것부터 이어 지웁니다.
  - **지울 목록은 `lib/classPurge.js` 한 곳**입니다. **반에 딸린 컬렉션을 새로 만들면
    거기 더하세요** — 빠지면 그 기록만 콘솔에 남습니다. `tests/unit/classPurge.test.mjs`가
    `firestore.rules`의 match와 목록을 견주어 빠진 이름을 잡습니다(반 아래 · 최상위).
    독서 활동 아래에 새 컬렉션을 더하면 `purgeBookActivity`에도 더합니다.
  - 규칙: `canPurgeClass(cId)` = 보관된 반 + (담당 교사 또는 관리자). `classes/{cId}/{rest=**}`와
    `bookActivities/{aId}/{rest=**}`에 읽기 · 지우기를, 반 바깥 컬렉션에는 지우기 갈래를
    더했습니다. **쓰기 · 고치기는 그대로 막힙니다**, 운영 중인 반은 먼저 보관해야 합니다.
    시험 `tests/rules/classPurge.test.mjs`.
  - **학생 계정(Authentication)과 프로필(`users`)은 안 지웁니다** — 다른 반에서도 쓰고,
    남의 로그인 계정은 서버 함수 없이는 못 지웁니다. 콘솔에서 지웁니다.
  - **그림 파일(Storage)도 지웁니다**(선생님 요청) — Storage 목록은 규칙이 막아 폴더를 훑을 수
    없어, **지우기 전에 읽은 문서에서 `storage:uploads/…` 경로를 모아**(`lib/storagePaths.js`)
    그 반 폴더의 것만 지웁니다(`deleteStoragePaths`, 활동은 `purgeBookActivity`가). 어느 기록에도
    적히지 않은 파일(올리다 만 그림)은 찾을 길이 없어 남습니다.
- **학생 프로필 편집도 같은 창에서** — '편집'으로 이름 · 학번 · 이메일(`updateStudentProfile`,
  users/{uid} 한 장 · displayName도 이름과 같게). 이름 · 학번이 바뀌면 이어서
  **내 반 기록의 옛 이름표도 맞춥니다**(`lib/data/nameSync.js`의 `syncStudentName`, 셈은
  `lib/nameFields.js`) — 모둠 명단 · 학생 기록 · 낱말 · 가로세로 힌트/맞힌 기록 ·
  브레인 라이팅 · 실명 메모 · 해시태그 글/댓글 · 동료 평가 · 손들기 · 메신저 · KWLS.
  - 책봄의 많은 화면이 쓸 때 이름을 기록에 적어 두고 그것을 보여 줘서(학생 화면은
    명단을 안 읽음), 프로필만 고치면 옛 이름이 남았습니다. '화면이 늘 명단을 읽게'
    바꾸는 길 대신 '고칠 때 한 번 맞추기'를 골랐습니다(선생님 결정 — 이름은 드물게
    바뀜). **이름을 기록에 적어 두는 자리를 새로 만들면 `nameSync.js`에도 더하세요.**
  - 규칙 `isNameSync`(반 아래 · 독서 활동 아래 와일드카드의 update): 운영 중인 내 반,
    바뀌는 칸은 이름표(authorName · fromName · toName · writerName · name · studentId)만,
    새 값은 그 기록이 가리키는 학생의 **지금 프로필**과 같아야 합니다. 보관된 반 ·
    다른 선생님 반은 그대로입니다. 시험 `tests/rules/nameSync.test.mjs`.
  - 학생 이모지는 늘 🙂입니다 — 익명 시절의 동물 이모지가 프로필에 남아 있어도 명단이
    쓰지 않고(`subscribeClassDirectory` · `fetchClassRosterProfiles` · 대시보드), 이름을
    맞출 때 모둠 명단의 이모지도 🙂로 돌립니다.
- **학생 탈퇴는 관리자 대시보드의 학생 프로필 창에서**(`StudentProfileDialog` →
  `lib/data/withdraw.js`의 `withdrawStudent`, 학생 이름을 그대로 적어야 실행). 서버 없이
  브라우저가 지웁니다 — 내 반들의 그 학생 기록(소속 · 출석 · 과일 · 손들기 · 메신저 1:1 ·
  퀴즈 답 · 독서 활동의 글 · 낱말 · 메모 · 동료 평가 …) → 모둠 · 자리표에서 빼기 → 개인
  서재(`users/{uid}/reading/main`) → **프로필(`users/{uid}`)은 맨 마지막**.
  - **구글 로그인 기록만 남습니다**(남의 계정은 서버만 지움 — Authentication 탭에서).
    다시 로그인하면 아무 반에도 없는 새 학생으로 시작합니다. 그 학생이 올린 **그림 파일도
    지웁니다** — 지우는 기록에서 모은 경로 가운데 내 반 폴더 안의 그 학생 폴더 것만.
  - 규칙: 먼저 프로필에 `withdrawingBy`(내 uid)를 적고, 반 아래 · 독서 활동 아래의
    와일드카드 규칙이 **그 학생을 가리키는 기록만**(`isWithdrawnRecord` — uid · authorId ·
    fromUid … 칸, 혼자 쓰던 판) 담당 교사에게 지우기를 엽니다. 그래서 '이력은 못 지운다'는
    다른 학생 기록에는 그대로입니다. 프로필 삭제는 `teacherMayWithdraw` — classIds의 반이
    **모두 내 반이거나 없는 반**(넷까지)일 때만. 다른 선생님 반에도 있으면 화면이 막고
    '이 반에서 빼기'를 안내합니다. 기록 삭제는 한 장씩(묶음은 규칙의 읽기 한도 20을 넘김).
    시험 `tests/rules/withdraw.test.mjs`.
  - 독서 활동 아래에 학생 기록을 담는 컬렉션을 새로 만들면 `withdraw.js`에도 더하세요.
  - 모둠 · 자리표에서 빼는 셈은 '이 반에서 빼기'와 같은 곳입니다(`lib/removeFromClass.js`).
- **이 반에서 빼기 — 학생을 반 하나에서만 뺄 때**(같은 창 · 편집 다음 자리 · `lib/data/removeFromClass.js`의
  `removeStudentFromClass`, 선생님 요청). 탈퇴 · 사용 중지는 계정 전체를 다루고 그 학생의 반이 모두 내 반일
  때만 되는데, 이것은 **지금 보는 반 하나**만 다룹니다 — 다른 선생님 반에도 있는 학생, 참여 코드를 잘못
  넣어 엉뚱한 반에 들어온 학생, 내 반 사이에서 옮기는 학생. 한때는 반에서 빼는 길이 화면 어디에도 없어
  (탈퇴 · 사용 중지 · 반 삭제뿐) 그런 학생이 명단 · 자리표 · '출석 n/N'에 계속 남았습니다.
  - 하는 일: 기본 모둠 · 독서 활동 모둠 · 자리표에서 빼고(셈은 `lib/removeFromClass.js` — 탈퇴와 같은 셈,
    사용 중지로 적어 둔 돌려놓을 자리까지) → 올려 둔 손 내리기 → 프로필의 `classIds`에서 이 반 줄이기 →
    **소속(`memberships/{uid}_{cId}`)은 맨 마지막**(중간에 멈춰도 명단에 남아 다시 누르면 이어 감).
  - **남는 것**: 글 · 그림 · 과일 · 출석 · 메신저 · 혼자 쓰던 판 · 반 집계(`readingMembers`). 학생이 참여
    코드로 다시 들어오면 그대로 이어집니다(모둠 · 자리는 다시 정함). 되돌릴 수 있는 일이라 확인은 한 번
    (탈퇴처럼 이름을 적게 하지 않음).
  - 리더보드 · 독서 TOP 3는 소속으로 명단을 세므로 저절로 빠지고, 이번 주 TOP 3는 그 자리에서 다시 셉니다
    (`refreshReadingTops` — 사용 중지와 같은 길).
  - **보관된 반에서는 못 뺍니다**(모둠 · 자리표를 고칠 수 없어 앱이 막음 — 대시보드에는 운영 중인 반만 섬).
  - **규칙은 새로 열지 않았습니다** — 담당 교사의 소속 지우기 · `classIds` 줄이기(`classIdsShrinks`) ·
    모둠 · 자리표 고치기 · 손 내리기가 이미 열려 있습니다. 시험 `tests/rules/removeFromClass.test.mjs`(앱과
    같은 차례로) · `tests/unit/removeFromClass.test.mjs`.
  - 단추 넷(편집 · 이 반에서 빼기 · 사용 중지 · 탈퇴)은 한 줄에 같은 크기이고, 700px 아래에서는 두 줄 두
    칸입니다(`.bb-profile-buttons`). 실측(데모): 1440 · 768px 한 줄 145px씩 · 420px 두 줄 174px씩 ·
    '다시 사용하게 하기'도 안 잘림 · 빼면 창이 닫히고 알림 한 줄 · 목록 15 → 14명.
- **학생 사용 중지 — 전학 등으로 더 안 쓰지만 남긴 글은 둘 때**(같은 창, 편집 · 이 반에서 빼기 · 탈퇴와 한 줄 · `lib/data/suspend.js`의
  `setStudentSuspended`, 탈퇴와 같은 조건 — 그 학생의 반이 모두 내 반).
  - `users/{uid}.suspended`(+ `suspendedAt` · `suspendedBy`). 규칙의 `signedIn()` · `isClassMember()`가
    `isSuspendedMe()`를 보아 **그 계정의 모든 읽기 · 쓰기를 막습니다**(휴면) — 본인 프로필 읽기만 열림.
    Storage 규칙 · 서버 API(`assertReadingAccess` · 대시보드)도 막습니다. 학생 화면은 `AuthGate` ·
    대시보드가 안내만 띄웁니다(`components/SuspendedScreen.jsx`, 데모는 '선생님 화면으로' 단추).
  - **반 친구는 그대로 읽습니다** — 각자 소속으로 판정되므로 글 · 그림이 보입니다. 모둠 RAFT 글은
    `suspendedUids`로 옮긴 친구 것도 읽힙니다(규칙 `mateReadsEntry`).
  - **모둠에서 뺍니다** — 기본 모둠은 `suspendedPlacements`에 자리를 적어 두고, 활동 모둠은
    `suspendedUids` · `suspendedMembers`로 옮깁니다(`lib/suspendGroups.js`, 혼자 쓰던 판은 그대로).
    **다시 사용하면 그 자리로 돌려놓습니다.**
  - 그 학생의 해시태그 글에 친구가 댓글을 달려 하면 '입력할 수 없습니다.' 한 줄만(`HashtagComments`, 규칙
    `isSuspendedUser`도 막음). 동료 평가 · 브레인 라이팅은 모둠에서 빠져 칸 자체가 안 섭니다.
  - 소속 · 과일 · 출석 기록은 그대로입니다(선생님 화면의 명단에 남음).
  - **리더보드 · 독서 TOP 3 순위에서는 빠집니다**(선생님 요청 — `lib/readingJourney.js`의 `isRankedStudent`,
    독서 기록 · 경험치는 그대로). TOP 3는 한 주에 한 번 세므로 사용 중지 · 다시 사용을 누를 때 그 반의 TOP 3를
    다시 셉니다(`READING_GROWTH.md`의 '독서 TOP 3').
  - 시험 `tests/rules/suspend.test.mjs` · `storage.test.mjs` · `tests/unit/suspendGroups.test.mjs`.
    **코드보다 규칙(Firestore · Storage)을 먼저 게시하세요.**
- **반 공지는 교사가 곧바로 씁니다** — `classes/{cId}/classNotices`에 한 장(`sendClassNotice`,
  500자 · 고치기 · 지우기 없음). 학생 알림함에 나눠 쓰지 않고, 알림
  벨이 그 반의 최근 5장을 구독해 안 읽은 것을 셉니다 — 읽음 표시는 `chatReads.rooms.notice`
  (서버 시각 ms). 시험 `tests/rules/classNotices.test.mjs`.
- **개인 알림함(`users/{uid}/notifications`)은 걷었습니다** — 배움나눔에서 서버 함수가 새 답변 ·
  채택 알림을 쓰던 자리라 늘 비어 있었습니다. 벨의 그 구독 · 정리 질의, 데이터 함수, 규칙의
  `match`, 색인 둘을 함께 지웠습니다. 벨은 모둠 메모도 더는 구독하지 않습니다(쓰는 화면이 없음).
- 공부중 전광판의 학생 정보창에서 **'질문방 질문 · 답변 수'** 줄과 그 구독을 걷었습니다(질문방이
  없어 늘 0이던 값). 아래 원본 기록 가운데 개인 알림함 · 질문방 집계 함수를 다루는 대목은 이
  저장소에 없는 이야기입니다.
- 관리용 스크립트는 `scripts/admin/`(gcloud 로그인 + REST — 설치 없음).

## 주요 페이지

| 경로 | 설명 |
|------|------|
| `/` | 랜딩 — 로그인 · 회원가입 (로그인되어 있으면 `/books`로) |
| `/books` | 책방 — 활동 목록 → 활동(`?activity=`) · 책나눔(`?area=reading`) · 리더보드(`?area=leaderboard`) · 관리자 설정(`?area=settings`) · 반 관리 · 출석 · 과일 바구니 |
| `/dashboard` | 분석 리포트(교사 화면 이름은 관리자 대시보드) — `DASHBOARD.md` |
| `/privacy` · `/terms` | 개인정보처리방침 · 이용약관 |

## 핵심 파일 (책 나눔)

| 파일 | 역할 |
|------|------|
| `app/books/page.js` | 책방 한 화면 — 활동 목록 · 열한 활동의 보드/폼 · 반 관리 · 출석 · 동그라미 바로가기 |
| `components/TopNav.jsx` | 상단바(로고 · 책방 · 책나눔 · 리더보드 · 관리자 설정 · 독서 TOP 3 · 손들기 · 돌발 퀴즈 · 공지 · 알림 · 프로필) + 방송 오버레이 · 축포 · 동그라미 |
| `components/BookActivityForm.jsx` · `BookActivityEditModal.jsx` | 독서 활동 만들기 · 고치기 |
| `components/ClassManagerModal.jsx` · `SeatGroupSetupModal.jsx` | 반 만들기 · 입장 코드 · 보관 / 자리 배정 · 기본 모둠 |
| `components/StudyRewardPanel.jsx` | 오른쪽 '멋진 순간'(자리표 · 과일 · 모둠 현황) |
| `lib/store.js` · `lib/data/*.js` | 데이터 함수의 입구 · 영역별 Firestore CRUD + Mock |
| `lib/firebase.js` | Firebase 초기화 — 자리표시자면 데모 모드 |
| `components/BrainWriteForm.jsx` · `BrainWriteBoard.jsx` | 독서 활동 '브레인 라이팅'(`type: 'brainwrite'` — 늘 모둠) — 학생: 우리 모둠 칸 목록 ｜ 고른 컬럼에 이어 쓰기 / 교사: 모둠 카드 ｜ 고른 학생의 컬럼 ｜ 학생별 조각 바, 셈은 `lib/brainwrite.js` |

책방 활동 열한 가지(닿소리 채우기 · 곁텍스트 읽기 · RAFT 글쓰기 · KWLS로 성찰하기 ·
마인드맵 · 내 생각은요... · 여섯 개의 해시태그 · 물음표로 책 읽기 · 가로세로 낱말 퀴즈 ·
브레인 라이팅 · 낱말 빙고)의 자세한 약속은 아래 '데이터 모델'과 활동별 절에 있습니다.

## 책방 화면의 약속 (원본에서 옮김)

책방(`/books`)은 **활동 목록 → 활동** 두 단계입니다(URL은 `?activity=`).
예전에는 '활동 종류 그리드 → 그 종류의 목록 → 활동' 세 단계였는데, 가운데
화면이 하는 일이 종류를 고르는 것뿐이라 만들기 창의 종류 고르기와 겹쳤습니다.
지금은 반의 활동을 종류 섞어 한 목록에 **만든 차례**(오래된 것이 앞)로
늘어놓고 카드마다 종류를 적습니다. 옛 주소의 `?kind=`는 무시됩니다.
한때 최신순이었는데, 활동을 하나 만들 때마다 목록이 통째로 한 칸씩 밀려
어제 열던 활동이 매번 다른 자리에 있었습니다. 그래서 '가장 최근 활동'이
필요한 곳은 목록의 **끝**을 봅니다.

활동을 연 화면(다섯 보드)의 머리말 둘째 줄에도 **반 고르개**를 답니다
(`classPicker` prop — 페이지에서 **한 번 만들어** 내려 줍니다). 예전에는 반
이름 배지뿐이라 옆 반을 보려면 '← 활동 목록'으로 나갔다 다시 골라야 했습니다.
**반을 바꾸면 그 반의 활동 목록으로 갑니다** — 지금 연 활동은 이 반의 것이라
반만 바꾸고 화면을 두면 남의 반 활동을 보게 됩니다. 고를 반이 하나뿐이면
지금까지처럼 이름 배지입니다. 높이는 옆 배지(27px)에 맞추는데 세로 여백이
4px인 것은 `<select>`가 `line-height`를 듣지 않아서입니다(실측).

'＋ 독서 활동 만들기'는 제목 줄이 아니라 **활동 목록의 오른쪽, 첫 카드와 같은
높이**에 둡니다(`.book-activity-top` — `minmax(0,1fr) auto` 격자, 단추는
`.book-activity-make`). 제목 줄에 함께 두었을 때는 반 고르개·KWLS 차트·기록
관리 사이에 섞여 '보는 단추'와 '새로 만드는 단추'가 구분되지 않았고, 한때 제목 줄
아래 제 줄(`.books-head-make`, 걷음)에 두었을 때는 그 줄만큼 카드가 내려앉았습니다
(선생님 요청). 단추가 머리말 밖이라 38px 크기 규칙을 `.book-activity-make`에 따로
줍니다. 768px 아래에서는 목록 위 오른쪽으로 올라갑니다.
실측(데모 1440px): 첫 카드 · 단추 top 모두 155 · 빈 목록 안내도 같은 높이 ·
700px 가로 넘침 0 · 학생 화면은 단추 없이 격자가 가로를 다 씀.

한때 이 아래에 성장 기록 메뉴(`ClassNotesTools`) · 왼쪽 '📌 오늘' 패널 ·
'KWLS 차트' 패널의 약속이 있었는데, 셋 다 걷었습니다(위 '배움나눔과 무엇이
다른가'). **되살리지 마세요** — 되살리려면 선생님께 먼저 여쭙니다.

## 첫 화면 — '아직 모름'과 '없음'을 가릅니다

로그인 직후 책방은 학생에게 **참여 코드 화면이 번쩍 스쳤습니다.**
`memberships`가 `[]`로 시작하는데 그 값만으로 '소속 없음'을 판정했기 때문입니다
— 서버 답이 오기까지 몇백 밀리초 동안은 '소속이 없는' 것이 아니라 '아직
모르는' 것입니다. 첫 화면이라 학생이 접속할 때마다 겪습니다.

페이지가 `membershipsLoaded`(첫 답이 왔는가)를 따로 들고,
**그 전에는 입장 화면도 본문도 그리지 않고** AuthGate와 같은 모습의 스피너
(`.auth-gate.auth-gate--inline`)를 둡니다. 학생 눈에는 로그인 스피너가
이어지다 제 화면이 뜨는 것으로 보입니다. 교사·비로그인은 물어볼 것이 없어
곧바로 `true`로 둡니다.

`--inline`이 따로 있는 이유: `.auth-gate`는 `min-height: 100vh`라 상단바
아래에 놓으면 56px만큼 넘쳐 스크롤 막대가 생깁니다.

**같은 함정을 조심하세요** — 구독 결과의 빈 배열은 '없다'가 아니라 '아직
안 왔다'일 수 있습니다. 빈 값으로 화면을 통째로 갈아 끼우는 자리라면
'답이 왔는가'를 따로 들어야 합니다.

**상단바의 `activeClassId`도 같은 함정입니다**(`TopNav`). 이 값은 학생
소속(`memberships`)에서 나오는데, 그 배열은 `[]`로 시작하고 **구독을 다시 걸
때도 잠깐 빕니다**. 그때 `null`로 떨어뜨리면 이 값에 걸린 것들(손들기 · 돌발 퀴즈 ·
떠 있는 동그라미 · 독서 TOP 3)이 함께 빠졌다 다시 나타납니다 — 한때는 그 아래 수업 노트
서랍이 언마운트되어 자동 저장 전의 글자가 날아갔습니다.

- 그래서 **마지막으로 알던 반을 ref에 붙들어 둡니다**. 답을 기다리는 동안은
  그것을 씁니다.
- **놓는 조건은 '이번 구독의 첫 답이 왔는데도 비어 있을 때'**입니다
  (`membershipsLoaded` — 구독을 다시 걸 때마다 거짓으로 되돌립니다).
  붙들기만 하면 교사가 반 편성에서 뺀 학생이 없는 반을 계속 가리켜, 규칙에
  막힌 읽기가 조용히 실패합니다.
- **`membershipsLoaded` 하나만으로는 못 막습니다** — 중간에 다시 구독할 때는
  그 값이 이미 참입니다. 둘을 함께 봐야 합니다.

## 역할 구분

- **교사**(`isTeacher`): 반 · 독서 활동을 만들고, 학생 기록을 보고, 과일 · 출석 · 모둠을 관리합니다.
- **학생**: 반에 참여 코드로 들어와 독서 활동에 참여합니다.
- **관리자**(`isAdmin`): 역할 관리 창(`RoleManagerModal`)에서 계정의 역할을 고칩니다.

역할 전환(개발 · 데모용): `RoleSwitcher` 컴포넌트(`role-switch` CSS 클래스, 모바일에서 숨김)

## 데이터 모델 (Firestore 컬렉션)

- `studyBoards` — 배움나눔 공부방의 **옛 기록**입니다. 책봄에는 공부방 화면이 없고, 한때 반을 만들 때
  '선생님 보드' 한 장을 함께 만들던 길(`addClass` → `ensureDefaultStudyBoard`)도 걷었습니다.
  규칙은 읽기 · 지우기만 남겨, 반 완전 삭제가 옛 문서를 지웁니다(`lib/classPurge.js`).
- `kwl` — **KWLS 기록** (classId, userId, date, answers{know,want,learned,still} + 옛 K/W/L/S 칸)
  - 책방 'KWLS로 성찰하기' 활동의 학생 글: ID = `uid_classId_act_활동id` + `activityId` · `topic`.
    활동의 `entries/{uid}`에도 함께 적고(`saveKwlsActivityEntry`), 교사 화면(`KwlsBoard`)은
    여기서 읽습니다(`subscribeActivityKwl`). 날짜(`date`)는 처음 쓴 날로 고정입니다(규칙이 그대로일 것을 요구).
  - 배움나눔에서 옮겨 온 '공부방 하루 성찰'(ID = `uid_classId_date`) 문서가 남아 있을 수 있는데, 읽는 화면은 없습니다.
- `bookActivities/{id}.sectionLocks` — **곁텍스트의 단계별 열기(걷었습니다)**
  - 한때 교사가 여덟 단계를 한 칸씩 열어 주었습니다(`{ [단계 key]: true }`,
    키가 없으면 잠김, 만들 때 1단계만 열림 · 머리말의 '단계 열기' 칩 줄 ·
    수업 모드 내보내기가 함께 열기 · 전광판의 잠김 칸). 선생님 요청으로
    **통째로 걷어 여덟 단계가 늘 다 열려** 있습니다 — 학생 카드 · 서랍의
    오늘의 활동 · 전광판 어디에도 '잠김'이 없습니다.
  - **옛 활동 문서의 `sectionLocks`는 그대로 두었습니다** — 읽는 곳이 없어
    해가 없고, 지우려면 문서마다 쓰기가 듭니다. 새 활동에는 적지 않습니다.
  - 활동 전체를 잠그는 `locked`는 그대로입니다(규칙이 막습니다).
  - **되살리지 마세요** — 되살리려면 선생님께 먼저 여쭙니다.
- `bookActivities/{id}.deleted` · `.deletedAt` · `.deletedBy` — **휴지통**
  활동 삭제는 곧바로 지우지 않고 이 표시만 찍습니다(`deleteBookActivity`).
  목록·학생 화면·통계에서 사라지지만 자료는 그대로라 `restoreBookActivity`로
  돌아옵니다. 진짜로 없애는 것은 `purgeBookActivity` — 휴지통 안에서 한 번 더
  확인하고 부릅니다.
  - **휴지통 비우기**는 머리줄 오른쪽 끝(`.book-trash-empty`). 되묻는 창에
    개수와 '무엇이 함께 지워지는가'를 밝히고, 동의하면 `purgeBookActivity`를
    **한 건씩 차례로** 부릅니다(`Promise.all` 아님) — 활동 하나가 하위
    컬렉션까지 훑는 일이라 스무 개를 한꺼번에 던지면 쓰기가 한 순간에
    몰립니다. 중간에 멈추면 앞의 것은 지워진 채이므로 '몇 개까지 지웠는지'를
    알림에 적습니다.
  - 접혀 있어도 그 단추는 보입니다 — 되묻는 창이 몇 개를 지우는지 먼저
    말하므로, 안 펴 봤다고 잘못 지워지지 않습니다.
  - 예전에는 여기서 낱말·모둠·기록을 곧바로 지웠는데, 손이 미끄러져 한 반의
    활동이 통째로 날아간 일이 있었습니다. 앱 안에 되돌릴 길이 없어 Firestore
    시점 복구까지 갔지만 PITR이 꺼져 있어 보존 창이 1시간뿐이었고, 그 사이에
    지난 뒤라 못 살렸습니다. (그 뒤 PITR을 켜 두어 지금은 7일입니다.
    급할 때 쓰는 도구: `npm run books:rescue` — `scripts/admin/rescue-activity.mjs`)
  - **mock은 활동 문서를 갈아 끼웁니다**(제자리에서 고치지 않고 —
    `updateBookActivity`·`deleteBookActivity`·`restoreBookActivity`).
    Firestore는 읽을 때마다 새 객체를 주는데 mock이 같은 객체를 고쳐 두면,
    그 문서를 들고 있는 쪽이 늘 같은 참조를 받아 React가 다시 그리지
    않습니다(반 문서에서 겪은 그 함정과 같습니다).
  - **판정은 `deleted`(참·거짓)로 하세요.** `deletedAt`은 '언제'만 적어 둔
    것입니다 — `serverTimestamp()`는 서버가 답하기 전까지 화면에 null로 와서,
    그것만 보고 거르면 지운 활동이 한 박자 되살아났다가 사라집니다.
  - 거르는 자리는 화면입니다(질의에 조건을 붙이면 복합 색인이 필요).
    `app/books/page.js`.
- `bookActivities/{id}/groups/{gId}/words` — 책방 닿소리 낱말
  - `groupMode: 'solo'`(개별 활동)는 **구성원이 한 명뿐인 판**을 학생마다 하나씩
    둡니다. 새 컬렉션을 만들지 않아 학생 화면·교사 전체 보기·낱말 권한
    (`isMyBookGroup`)이 그대로 쓰입니다.
  - **활동을 시작한 뒤 들어온 학생에게는 판이 없습니다.** 판은 만들 때의
    명단으로 한 번에 찍히기 때문입니다(`createBookActivity`의 `soloRows`).
    교사 화면 왼쪽 목록 맨 위에 `판이 없는 학생 n명`이 뜨고, 눌러서 만듭니다
    (`.book-rail-missing`).
    - **저절로 만들지 않습니다.** 교사가 화면을 열 때마다 쓰기가 일어나고,
      반 편성을 손보는 동안 빈 판이 조용히 쌓입니다. 드문 일이라 교사가 보고
      누르는 편이 '언제 무엇이 생겼는지' 분명합니다.
    - **`composeBookGroups`를 쓰지 마세요 — `addSoloBookBoards`가 따로 있습니다.**
      그 함수는 넘긴 목록이 곧 전부라 목록에 없는 판을 물리고(retired), 문서
      id를 **`group_{index}`로 가정해** 씁니다. 그런데 `npm run books:to-solo`로
      옮긴 활동의 판은 id가 **`solo_<uid>`**입니다 — 거기서 그 함수를 부르면
      빈 `group_N`들이 새로 생기고 멀쩡한 `solo_*` 판이 전부 물러나, 학생들의
      낱말이 화면에서 통째로 사라집니다(문서가 지워지는 것은 아니지만 앱
      안에 되돌릴 길이 없습니다). 실제로 그렇게 짰다가 고쳤습니다.
    - `addSoloBookBoards`는 **있는 판을 건드리지 않고 없는 것만 더합니다** —
      물릴 일도, 남의 id를 넘겨짚을 일도 없습니다. 새 판 id는 `solo_<uid>`라
      `group_N`과도 서로와도 안 부딪히고, 그 id가 이미 있으면(반에서 뺐다가
      다시 넣은 학생) **되살립니다** — 새로 만들면 그 학생이 전에 넣은 낱말이
      묻힙니다. 번호는 **물린 판까지 세어** 매깁니다(살아 있는 것만 세면 물린
      판과 같은 번호가 나와 되살릴 때 겹칩니다).
      실측: `solo_*` 활동에서 판 4 → 6개, 낱말이 있던 두 판은 그대로.
    - 판이 **하나도 없을 때도** 같은 줄이 뜹니다 — 활동을 만든 뒤 반이 통째로
      들어온 경우에는 목록 자체가 안 그려지는데 그때가 가장 필요합니다.
    - **규칙은 안 건드립니다** — `groups`의 create가 이미 담당 교사에게
      열려 있습니다(`ownsBookActivityEditable`).
  - 이미 모둠으로 진행한 활동을 개별로 바꾸려면 `npm run books:to-solo`
    (인자 없이 실행하면 활동 목록, `<활동id>`로 미리보기, `--apply`로 실제).
    낱말 생성 규칙이 `authorId == 본인`이라 교사가 남의 낱말을 옮겨 적을 수
    없어서, 앱이 아니라 admin SDK 스크립트로 처리합니다.
  - **모둠원 이름 칩 줄 맨 앞에 낱말 입력칸 하나**(`.consonant-quick`,
    학생만). 적으면 **첫 글자의 초성**으로 갈 칸을 스스로 골라 넣습니다 —
    열네 칸을 눈으로 훑어 ＋를 찾는 일이 낱말마다 되풀이되던 것이 한 번으로
    줄어듭니다.
    - **제 줄을 두지 마세요.** 판(`.consonant-grid`)이 남는 높이를 다 쓰므로
      줄이 하나 늘면 그만큼 판이 낮아집니다. 이미 있는 이름 칩 줄
      (`.canvas-legend`)에 얹습니다. 개별 활동은 이름 칩이 없는데, 그때도
      이 줄이 뜨도록 렌더 조건이 `legend.length > 0 || canWrite`입니다.
    - 입력칸 너비는 **판의 한 칸과 같습니다** — `.consonant-quick`에
      `calc((100% - 32px) / 5 + 91px)`. 판이 5칸 gap 8px이고 이 줄은 판과
      폭이 같으므로 한 칸이 `(100% - 32px)/5`이고(이 묶음이 flex 아이템이라
      100%가 줄 폭으로 풀립니다), 91px은 입력칸이 아닌 부분입니다
      (→ 슬롯 30 + gap 6·6 + '넣기' 49 — 실측). 창 크기가 달라져도 아래
      첫 칸과 좌우 끝이 딱 맞습니다(1400/1100/900px에서 오차 0~1px).
      단추 글자나 여백을 고치면 이 91px도 함께 재세요.
    - 못 넣은 까닭은 줄 **아래에 떠서**(absolute) 잠깐 머물다 사라집니다.
      줄 안에 두면 글자가 길어 이름 칩이 다음 줄로 밀리고, 그만큼 판이
      내려앉습니다(`--canvas-lead-h`가 곧 판이 시작하는 자리입니다).
    - 셈은 `lib/korean.js`의 `initialJamoOf`(음절 코드 ÷ 588 = 초성 차례,
      조사 고르기와 같은 셈) → `lib/consonants.js`의 `cellIndexOfWord`
      (자모 → 칸). **쌍자음은 제 칸이 없고 홑자음 칸에** 담깁니다
      (까치→ㄱ · 땅→ㄷ · 쓰레기→ㅅ · 짜장→ㅈ) — 격자가 원래 그렇습니다.
    - **칸마다 있는 ＋를 없애지 마세요.** 한글로 시작하지 않는 낱말
      (AI·CO₂)과 '고른 칸이 마음에 안 들 때'는 그 길로만 넣습니다.
    - 넣기 전에 `→ ㄱ 칸`을 미리 보여 주고, 넣은 뒤에는 그 칸이 잠깐
      밝아집니다(`.consonant-cell.flash`). 판이 3×5라 낱말이 어디에
      떨어졌는지 눈으로 좇기 어렵습니다. 같은 칸에 연달아 넣어도 다시
      밝아지도록 `{ i, n }`으로 번호를 함께 듭니다(같은 값이면 상태가
      안 바뀌어 타이머가 다시 안 걸립니다).
    - 한글로 시작하지 않으면 **넣지 않고** 까닭을 적습니다 — 엉뚱한 칸에
      넣는 것보다 낫습니다. 같은 낱말을 두 번 넣는 것도 여기서만 막습니다
      (빠르게 적는 칸이라 실제로 잦고, 칸을 눌러 넣던 때보다 알아채기
      어렵습니다).
  - 개별 활동은 **주제어를 판(group)마다 따로** 둡니다(`groups/{gId}.topic`).
    읽는 책이 저마다 다를 수 있어 교사는 활동의 `topic`을 비워 두고, 학생이
    자기 판 한가운데를 두 번 눌러 적습니다. 화면은 `group.topic || activity.topic`
    순으로 씁니다. 규칙은 개별 활동에 한해 그 판의 구성원에게 `topic` **한
    필드만** 허용합니다(`changedOnly(['topic'])` · 40자 · 잠기면 불가).
  - **한 학생만 보기는 판 위의 모둠원 칩과 왼쪽 모둠 카드의 이름 알약**으로
    고릅니다. 누르면 그 학생 낱말만 남고('내 판'의 거르기와 같은 방식),
    위의 '모둠 전체 보기'로 돌아옵니다. 한 사람만 보는 중에는 **칩 줄을 통째로
    감춥니다** — 무엇을 보는 중인지는 위 한 줄이 말합니다.
    왼쪽 모둠 이름·카드 여백은 모둠 전체를 고릅니다. 이름 알약과 자음 진행
    조각은 `focusRequest`로 학생·자음 선택을 전달하고, 캔버스는 `onFocusChange`로
    현재 선택을 알립니다(이름 알약과 오른쪽 진행의 선택 표시를 맞춥니다).
  - **'모둠원별 진행'의 14칸은 진하기를 쓰지 않습니다** — 채웠으면 사람 색,
    안 채웠으면 회색 하나뿐입니다. 낱말 수를 진하기로 나타내면 한 개 넣은
    칸이 옅어 안 채운 칸과 헷갈립니다. 14칸을 다 채우면 마지막 칸에 붉은
    점(`.dash-heat-cell.is-done`) — 손들기 표시(`.question-signal-dot`)와 같은
    색·크기라 '여기 봐 달라'는 신호가 화면이 달라도 하나로 읽힙니다.
    **모둠별 진행 대시보드(`ConsonantDashboard`)는 그대로 진하기를 씁니다** —
    거기서는 '어디에 얼마나 모였나'가 그 패널의 주제라 뜻이 다릅니다.
  - 개별 활동의 판은 한 사람짜리라 '모둠 안 자리'로 색을 매기면 모두 첫 색
    하나가 됩니다. 그래서 낱말에는 사람 색을 입히지 않고(범례도 없음),
    '학생별 진행' 패널만 줄 번호로 색을 줍니다(`lib/bookColors.js`의
    `ROW_COLORS` 10색 되풀이 — 붙어 있는 줄끼리만 다르면 충분).
  - 학생이 채우는 판(`.canvas-main:not(.dash-root)` / `.canvas-embed` 안의
    `.consonant-*`)은 연한 초록. 전체 보기 집계(ConsonantDashboard)도 뿌리가
    `.canvas-main`이라 `:not(.dash-root)`로 빼 둡니다 — 거기는 낱말마다 '넣은
    사람 색'이 붙는 화면이고, 끼워 넣은 형태(`.dash-embed`)와 색이 갈리면 같은
    화면이 두 얼굴이 됩니다. 중계 화면(`.cast-grid`)도 그대로. 판 색을 건드릴
    땐 **반드시 이 두 뿌리 아래로 한정**할 것.
  - **'전체 보기' 격자는 칸마다 낱말 다섯 개만** 보여 줍니다(`TopWords`).
    예전에는 모든 낱말을 나온 횟수만큼 반복해 늘어놓아 '줄 길이 = 언급 횟수'로
    읽혔는데, 낱말이 500개가 되자 폭 62px 고정 때문에 글자가 잘리고 칸마다
    안쪽 스크롤이 생겨 대부분이 안 보였습니다(칠판에서는 굴릴 수도 없습니다).
    지금은 반복 대신 `×3` 배지를 쓰고, 순서는 **많이 나온 순 → 같으면 먼저
    채운 순**입니다(가나다순은 수업 흐름과 무관해 씁니다). 나머지는 '+29개'로
    접고, 칸을 누르면 뜨는 크게 보기에 모둠 색과 함께 전부 있습니다.
    중계 화면(`PresentationOverlay`의 `CastTopWords`)도 같은 모습으로 맞춥니다 —
    한쪽만 바꾸면 교사 화면과 학생 화면이 달라집니다.
  - **'전체 보기'는 잔디 / 격자 / 낱말 구름 세 얼굴**입니다(`components/DashViewTabs.jsx`
    — 알약은 `.dash-view-tabs`). 줄은 머리말의 **'수업 시작' 바로 뒤**에 섭니다(선생님
    요청). 보던 얼굴은 **페이지가 듭니다**(`dashView` → `initialView`·`onViewChange`).
    - **한때 넷째 알약 '가로세로'가 있었습니다**(학생 '내 판'에도 '가로세로' 단추).
      가로세로 낱말 퀴즈가 제 독서 활동이 되면서 둘 다 걷었습니다(선생님 요청 —
      아래 '가로세로 낱말 퀴즈' 절). **되살리지 마세요.**
    - 탭이 선 차례는 **수업 중에 자주 여는 것부터**입니다 — 잔디('누가 어디까지
    채웠나')가 맨 앞이고, 낱말을 보는 둘이 뒤에 섭니다. 차례와 **처음 여는
    얼굴은 별개**입니다(`view`의 첫 값은 그대로 `grid`).
    `.dash-view-tab`에는 자리로 거는 규칙(`:first-child` 따위)이 없어 —
    탭마다 제 알약입니다 — 차례를 바꿀 때 CSS는 안 건드립니다.
    격자는 첫 글자로 나뉜 자리라 '어떤 낱말이 많이 나왔나'를 보려면 칸을
    하나씩 짚어야 합니다. 구름은 칸을 지우고 낱말만 남겨 그것을 한 화면에
    보여 줍니다. **이미 만든 `merged`를 다시 펴는 것뿐이라 읽는 문서가 하나도
    안 늡니다.**
    - 자리 잡기는 `lib/wordCloud.js`(순수 계산) — 큰 낱말부터 가운데에 놓고
      나선으로 밀려 나가며 빈틈을 찾습니다. 라이브러리를 쓰지 않습니다.
      판 넓이에 맞춰 글자 크기를 통째로 정하고, 하나라도 자리를 못 찾으면
      조금 줄여 다시 합니다 — 그래서 **판이 넓을수록 글자가 커집니다**.
    - **크기는 나온 횟수로만** 정합니다(넓이가 횟수에 비례하도록 제곱근).
      순위로 정하면 다 한 번씩 나온 낱말 사이에도 크기 차이가 생겨, 없는
      차이를 있는 것처럼 보여 줍니다. 다 같이 한 번씩이면 다 같은 크기가
      맞습니다.
    - **상위 70개**(`CLOUD_TOP_N`). 500개를 다 그리면 대부분이 읽을 수 없는
      점이 됩니다. 고르는 순서는 격자와 **같아야 합니다** — 다르면 격자에
      큰 낱말이 구름에 없는 일이 생깁니다.
    - **색은 위 다섯에만**(`accentCount`), 나머지는 먹빛으로 크기에 따라
      짙기를 줍니다(`restGray`). 낱말마다 모둠 색을 입혀 봤더니 일흔 개가
      저마다 다른 색이라 '어느 색이 많은가'를 눈이 먼저 세게 되어, 정작
      '무엇이 많이 나왔나'가 묻혔습니다. 모둠은 격자와 크게 보기가 색으로
      말해 줍니다. 다섯을 그냥 앞에서 세지 않고 **6위보다 확실히 많이 나온
      낱말에만** 칠합니다 — 다 한 번씩 나온 판에서 아무 낱말 다섯에 색이
      붙으면 없는 사실을 말하게 됩니다(다 같으면 하나도 안 칠함).
    - 글자 굵기는 `WordCloud.jsx`의 `WEIGHT`와 `.cloud-word`의 `font-weight`가
      **반드시 같아야** 합니다 — 폭을 재는 canvas와 실제 글자가 어긋나면
      낱말끼리 겹칩니다(`letter-spacing`은 음수만 — 좁아지는 쪽은 안전).
    - 중계할 때는 **고른 70개를 그대로 실어 보냅니다**(`cloud`·`cloudRest`).
      학생 쪽에서 다시 고르게 하면, 정렬에 쓰는 `firstAt`이 방송 문서에 없어
      다른 70개가 뽑힙니다. `view`로 격자/구름을 함께 바꿉니다.
    - **놓은 뒤 묶음을 판 한가운데로 옮깁니다**(`centered`). 나선이 오른쪽
      (각도 0)부터 돌아, 낱말이 몇 개뿐이면 묶음이 오른쪽으로 쏠렸습니다.
      테두리 상자째로 밀어 낱말끼리의 자리는 그대로이고 판 밖으로 안 나갑니다
      (시험 `tests/unit/wordCloud.test.mjs`).
    - 낱말이 들어올 때마다 다시 짜면 화면이 쉬지 않고 뒤척입니다 — 처음
      한 번은 곧바로, 그 뒤로는 0.9초 모았다가 한 번만(자리 이동은 CSS
      transition으로 미끄러지게).
  - **잔디**(`ConsonantGrassView`)는 앞의 둘과 묻는 것이 다릅니다 — 격자·구름이
    '무슨 낱말이 나왔나'라면 여기는 **'누가 어디까지 채웠나'**입니다.
    한 줄이 닿소리 하나, 한 칸이 학생 한 명입니다(세로 14줄 × 가로 반 전체).
    - **전광판의 격자를 그대로 씁니다**(`.progress-grass`·`.grass-*`) — 공부방
      전광판 · 책방 전광판과 같은 모양이라 교사가 세 번 익히지 않습니다.
      다만 **모달이 아니라 그 자리에** 그립니다: 낱말을 넣는 학생 화면과
      나란히 두고 수업 내내 보는 자리라, 열고 닫는 동작이 끼면 그때마다
      격자가 사라집니다.
    - **칸 색은 둘뿐 — 진하기를 쓰지 않습니다.** 채웠으면 초록, 안 채웠으면
      회색입니다. 낱말 수를 진하기로 나타내면 한 개 넣은 칸이 옅어 안 채운
      칸과 헷갈립니다('모둠원별 진행'의 14칸에서 이미 같은 이유로 걷어 냈습니다).
      몇 개 넣었는지는 툴팁이 말합니다. 같은 화면의 '모둠별 진행'이 진하기를
      그대로 쓰는 것과 어긋나지 않습니다 — 거기서 묻는 것은 '어디에 얼마나
      모였나'라 뜻이 다릅니다.
    - **14칸을 다 채운 학생은 이름 위에 붉은 점**(`.grass-name.is-done`).
      다 채운 줄은 초록이 열넷이라 옆줄과 잘 안 갈려, 세로 줄을 하나씩 눈으로
      훑어야 '누가 끝냈나'를 알 수 있었습니다. 색은 손들기 표시
      (`.question-signal-dot`) · '모둠원별 진행'의 완료 점
      (`.dash-heat-cell.is-done`)과 **같은 값**입니다 — 화면이 달라도
      '여기 봐 달라'는 신호가 하나로 읽혀야 합니다.
      - **자리는 이 화면의 모든 이름이 비워 둡니다**(`.dash-grass .grass-name`의
        `padding-top`). 점이 붙는 이름에만 여백을 주면 그 이름만 내려앉아
        스물몇 개가 늘어선 줄이 들쭉날쭉해집니다.
      - **`.grass-name`에 직접 주지 마세요** — 책방 전광판
        (`BookProgressBoard`)이 같은 클래스를 씁니다. 거기는 '다 채움'이라는
        개념이 없어(줄마다 제 상태가 따로) 점이 영영 안 붙는데 이름만
        내려앉고 글자 자리가 줄어듭니다.
      - **흰 테두리를 두르지 않습니다.** 저 둘은 색칠한 칸 위에 얹히는 점이라
        흰 고리가 '띄운 자리'로 읽히지만, 여기는 크림색 바탕 위라 고리가
        그대로 흰 무리로 보입니다.
      - **`position: relative`를 덧대지 마세요.** `.grass-name`은 `sticky`라
        그것만으로 이미 점의 기준입니다. 덧대면 sticky가 풀려 세로로 구를 때
        이름 줄이 위에 안 붙습니다.
      - 세는 기준은 머리말의 '다 채운 학생 n/N'과 **같은 칸 기준**입니다
        (낱말 수가 아니라 '몇 칸을 채웠나').
    - **학생 화면에 중계하지 않습니다.** 방송 꾸러미에서 `view`가 `grass`이면
      `grid`로 바꿔 보냅니다 — 그 격자는 '누가 아직 안 했나'를 이름과 함께
      내거는 것이라 칠판에 띄우면 못 따라온 학생이 그대로 드러납니다.
    - **범례와 격자는 한 덩이로 가운데에 섭니다**(`.dash-grass-inner` — 선생님 요청).
      격자가 학생 수만큼만 넓어 왼쪽에 붙여 두면 넓은 화면에서 오른쪽이 통째로
      비었습니다. 범례는 덩이 안에서 격자의 왼쪽 끝에 맞춰 서고, 격자가 칸보다
      넓으면 덩이가 칸 폭을 다 쓰고 격자만 옆으로 구릅니다(실측: 26명 · 1080px 칸에서
      좌우 162px씩 · 8명이면 396px씩 · 600px 칸이면 왼쪽 0에서 옆으로 구름).
    - 차례는 **학번순**입니다(자리표·출석부와 같은 기준). 모둠끼리 붙여
      세우면 색 띠는 고와지지만, 여기서 찾는 것은 '누가 안 했나'라 이름으로
      짚는 편이 빠릅니다.
    - **읽는 문서가 안 늡니다** — 이미 구독해 둔 모둠·낱말로 셉니다. 머리말의
      '다 채운 학생 n/N'도 **같은 `students` 배열에서** 셉니다(따로 세면
      한쪽만 고쳤을 때 격자는 다 찼는데 머리말은 덜 찼다고 말합니다).
    - 뿌리 클래스는 **`.dash-grass`**입니다. `.consonant-progress`·
      `.book-progress`로 짓지 마세요 — 앞의 것은 활동 만들기 창들과 학생
      카드의 진행 배지가, 뒤의 것은 `-legend`·`-done`·`-sum`이 이미 쓰고
      있습니다(책방 전광판이 `.bookboard`로 이름을 바꾼 것과 같은 까닭).

- `bookActivities/{id}.grouped` — **곁텍스트·RAFT를 모둠으로 진행**
  - 닿소리만 모둠 활동이던 것을 곁텍스트 읽기·RAFT 글쓰기로 넓혔습니다.
    **글은 모둠으로 묶여도 학생마다 한 장 그대로**(`entries/{uid}`)이고,
    모둠이 정하는 것은 '누구와 함께 보는가' — 화면의 흐름과 동료 평가의
    범위입니다. 그래서 저장 위치도 규칙(entries)도 안 건드립니다.
  - **판정은 `grouped === true`로**(`lib/bookGroups.js`의 `isGroupedActivity`).
    `groupMode`로 판정하면 예전에 만든 개인 활동이 전부 모둠 활동으로
    둔갑합니다 — 그때도 방식과 상관없이 'teacher'가 적혀 있었습니다.
    닿소리는 원래 모둠 활동이라 이 표시를 안 씁니다(`groupMode !== 'solo'`).
  - 교사 화면은 `GroupFilterRow`(한 줄)로 카드를 모둠으로 좁힙니다. 닿소리처럼
    왼쪽 세로 목록을 두지 않은 이유는, 이 화면들은 카드 격자가 주인공이라
    왼쪽에 판을 두면 카드가 좁아져 학생 이름이 잘리기 때문입니다.
  - **모둠을 다시 짜는 길은 머리말의 '활동 모둠'**입니다(`ParatextBoard` ·
    `RaftBoard` · `BookGroupBoard` 셋 다 — `GroupComposer`를 **같은 인자로**
    부릅니다). 곁텍스트·RAFT는 짜는 길이 만들기 창에만 있어, 한 번 만들고
    나면 교사가 모둠을 고칠 수 없었습니다(전학·결석·모둠 갈등 어느 것도
    반영할 수 없었습니다).
    - 자리는 `.books-head-main`의 **맨 앞**, 말은 `활동 모둠`, 그림은
      `IconPeople` — 닿소리와 같아야 합니다. 네 화면의 머리말이 같은 차례인
      까닭과 같습니다.
    - 조건은 **`grouped && !freeMode`**입니다. '학생이 고르기'는 학생이 스스로
      드는 방식이라 교사가 짤 것이 없고, 개인 활동은 모둠 자체가 없습니다.
      닿소리의 같은 단추와 판정이 **같아야** 합니다.
    - 두 보드는 `app/books/page.js`에서 **`admin`일 때만** 그려지므로
      `isTeacher` prop이 없습니다 — 조건에 넣지 마세요(늘 참입니다).
      대신 `baseGroupAssignment`·`onToast`를 페이지에서 내려 줍니다.
    - **저장되는 자리도 규칙도 안 건드립니다.** 글은 모둠으로 묶여도 학생마다
      한 장이라(`entries/{uid}`), 여기서 바뀌는 것은 '누구와 함께 보는가'와
      동료 평가의 범위뿐입니다.
    - `composeBookGroups`는 **문서 id가 `group_{index}`라고 가정하고**, 넘긴
      목록에 없는 모둠은 물러난 것으로 표시합니다(`retired`). 그 index는
      **1부터**입니다 — 0부터 세면 첫 모둠이 물러나고 이름이 한 칸씩 밀립니다.
  - 학생 화면은 `GroupMatesRow`(우리 모둠 명단 칩) — 자기가 쓰는 칸 바로 위.
    '자유 구성'인데 아직 모둠이 없으면 `GroupJoinRow`가 대신 뜹니다(고르기
    전에도 글은 쓸 수 있습니다 — 어차피 각자 한 장이라서).
  - **만들기 창은 모둠을 세 번에 나눠 묻습니다**(`BookActivityForm`).
    한 줄에 다섯 갈래를 늘어놓았더니 '기본 모둠'과 '활동 모둠'이 나란히 있어
    무엇이 무엇인지 알기 어려웠습니다. 이제 묻는 차례대로 갈라 둡니다.
    ① 진행 방식 — 모둠 활동 / 개별 활동
    ② 모둠 구성 — 기본 모둠 그대로 / 이 활동만의 모둠
    ③ 모둠 짜는 방법 — 교사 배정 / 무작위 / 학생이 고르기 (②가 '이 활동만'일 때)
    저장되는 `groupMode`는 지금까지와 같은 다섯(solo·base·teacher·random·free)
    이라 **자료도 규칙도 그대로**입니다 — 묻는 방법만 바뀝니다.
  - **만들기 창은 위아래 두 덩이**입니다(`.book-form-cols`, 900px) — 위는
    '무엇을 할까'(활동 종류를 **두 열 격자**로, `.book-type-seg`), 아래는
    '어떻게 할까'(이름·주제어·주소·모둠). 선생님 요청으로 바꿨습니다.
    - 한때 왼쪽에 종류를 세로로 세우고 오른쪽에 설정을 뒀는데, 종류가 여덟이
      되자 왼쪽 목록만 길고 오른쪽 아래가 통째로 비었습니다. 그보다 전에는
      480px 한 줄에 전부 쌓아 세로로 넘쳤습니다.
    - **종류 설명은 한 줄에 드는 길이로**(`TYPES`의 `desc`). 한 칸이라도 두 줄이면
      그 줄이 통째로 높아져 아래 단추가 화면 밖으로 밀립니다. 칸 여백도 8px로
      줄였습니다(한 칸 56px).
    - **첫 줄에 활동 이름 · 주제어 · 도서 정보 사이트 셋**이 섭니다(입력칸이라
      셋이 들어갑니다 — 아래 버튼 줄의 '셋을 넣지 마세요'와는 다른 이야기).
      주소가 제 줄을 차지하면 종류를 위로 올린 만큼 창이 넘칩니다.
    - 창 높이 천장은 이 창만 `94vh`입니다(보통 모달 85vh). 종류마다 설정이
      달라 내용 높이는 다릅니다(실측 1600px: 닿소리 768 · 곁텍스트 · RAFT 792 ·
      내 생각은요 840 · 해시태그 646 · KWLS · 마인드맵 · 물음표 553px).
    - **그래도 창 크기는 종류와 상관없이 하나입니다**(`.book-form--fixed` —
      `height: min(94vh, 908px)` — 아홉째 종류 '가로세로 낱말 퀴즈'로 종류 격자가 한 줄
      늘어 840에서 올렸습니다. 실측 1600×1200에서 아홉 종류 모두 가운데 757/757px), 선생님 요청). 종류를 누를 때마다 창이
      553 ↔ 840px로 늘었다 줄었다 하며 아래 단추가 오르내렸습니다. 가장 긴
      '내 생각은요'에 맞춰 못 박아, 짧은 종류는 가운데가 빈 채 단추가 늘
      바닥에 섭니다. 화면이 낮으면 **가운데 칸(`.book-form-cols`)만** 구르고
      머리줄·단추는 제자리입니다. 설정 칸을 늘려 908px을 넘기면 그 종류만
      안에서 구르므로, 늘릴 때는 이 값을 함께 재 보세요.
      실측: 여덟 종류 모두 1600×1200 · 1600×900에서 900×840 · 1280×720에서
      900×677 · 820px에서 771×840 · 420px에서 395×752(안에서 구름), 단추는
      늘 바닥에서 28px.
    - 그 아래는 물음을 짝지어 한 줄에 둘씩 놓습니다(진행 방식 ｜ 모둠 구성 ·
      모둠 짜는 방법 ｜ 모둠 수). **버튼 줄 한 줄에 셋을 넣지 마세요** — 버튼
      줄이 두 줄로 접힙니다(‘모둠당 최대’를 ‘모둠 짜는 방법’ 줄에 끼웠다가
      그렇게 됐고, 지금은 ‘모둠 이름’ 옆입니다).
    - 768px 이하에서는 짝짓기가 한 줄에 하나씩, 560px 이하에서는 종류도 한 열.
  - **고르는 도중에 창 크기가 변하지 않습니다.** 모둠 설정의 아랫부분
    (`.book-group-detail`)은 고른 갈래에 따라 내용이 통째로 바뀌는데
    ('이 활동만의 모둠'은 줄 둘 + 안내, 나머지는 안내문 한 덩이), 가장 큰
    갈래에 맞춰 `min-height: 166px`로 자리를 미리 잡아 둡니다. 166인 것은
    '학생이 고르기'의 고르개가 글자 칸보다 1.3px 높아서입니다 — 164로 두면
    그 갈래에서만 창이 자랍니다. 여기에 안내문을 더 길게 쓰면 그 갈래만
    커지므로, 고칠 때는 네 갈래의 높이를 함께 재 보세요. 768px 이하에서는
    이 자리 잡기를 풉니다(줄이 세로로 풀려 어차피 넘고, 짧은 갈래에는 빈
    자리만 크게 남습니다).
  - **기본값은 셋 다 '모둠 활동 + 기본 모둠'**입니다(닿소리·곁텍스트·RAFT).
    수업이 대체로 늘 같은 모둠으로 돌아가는데 활동마다 다시 짜면 같은 일을
    되풀이하게 됩니다. 반에 기본 모둠이 없으면 만들기를 막고 그 자리에서
    안내합니다(빈 모둠만 생겨 '이 활동만의 모둠'과 같아지므로).
  - **'이 활동에 판이 있는가'는 종류로 판정하지 마세요.** 곁텍스트·RAFT가
    모둠이 될 수 있게 되면서, 종류만 보는 곳은 전부 어긋납니다(활동 카드가
    모둠 RAFT를 '개인 활동'으로 적던 실제 버그). 판정은
    `type === 'consonant' || isGroupedActivity(activity)` — 닿소리는 늘 판이
    있고(개별 활동이면 1인 판), 곁텍스트·RAFT는 `grouped`일 때만입니다.
    닿소리 통계처럼 **낱말을 세는 화면은 종류로 직접**
    거릅니다(`type === 'consonant'`) — '모둠이 있는 활동'으로 거르면 낱말이
    없는 모둠 RAFT까지 들어와 빈 격자가 뜹니다.
- `bookActivities/{id}/peerReviews/{받는사람_쓴사람}` — **동료 평가**
  (activityId, groupId, toUid, toName, fromUid, fromName, html, updatedAt)
  - 모둠 친구의 발표를 들으며 남기는 한 마디(감상·질문·평가). 문서 ID가
    `받는사람_쓴사람`이라 **한 친구에게 한 장**이고 그 장을 고쳐 씁니다 —
    여러 장이 쌓이면 무엇이 마지막 생각인지 알 수 없습니다.
  - **읽기는 받은 학생·쓴 학생·담당 교사 + 같은 모둠 친구**(기본값 — 선생님 요청).
    A의 글에 B · C · D가 남긴 평가를 B · C · D도 서로 봅니다. 다른 모둠 · 반 전체는
    못 봅니다. 쓴 사람 이름은 남깁니다 — 익명이면 함부로 씁니다.
    - 판정은 문서의 `groupId` 명단에 **읽는 내가** 들어 있는가(규칙
      `reviewGroupHas(groupId, 나, 나)`) — 남의 모둠 id로 질의해도 그 명단에 내가
      없으면 거부됩니다. 학생 질의는 `where('groupId','==',우리 모둠)` 하나
      (`subscribeGroupPeerReviews`, 단일 필드라 색인 없음).
    - **늘 그렇습니다 — 끄는 단추가 없습니다**(선생님 요청). 한때 머리말 '동료 평가
      열림' 옆에 '모둠끼리 보기 켜짐/꺼짐'(`peerReviewShared`)이 있어 끄면 받은 학생 ·
      쓴 학생 · 교사만 봤는데, 단추와 규칙의 그 갈래(`peerReviewShared()`) ·
      `isPeerReviewShared` · `setPeerReviewShared`를 함께 걷었습니다. 옛 활동 문서에
      남은 `peerReviewShared: false`는 읽는 곳이 없습니다(규칙도 안 봄 — 시험으로 박아 둠).
      **되살리지 마세요.**
    - 보는 자리는 **친구 글을 읽고 감상 쓰는 창**(`PeerReviewModal`) — 고른 친구가
      받은 것 가운데 내 것을 뺀 나머지가 쓰는 칸 아래 '다른 친구들이 ○○에게 남긴
      한 마디'로 섭니다. 내 글 아래의 '받은 한 마디'는 그대로입니다.
    - **코드보다 규칙을 먼저 배포하세요** — 안 그러면 학생의 모둠 질의가 권한
      오류라 그 칸이 늘 비어 있습니다(다른 기능은 그대로).
    - 시험 `tests/rules/peerReviews.test.mjs`(같은 모둠 친구 읽기 · 모둠 질의 통과 ·
      다른 모둠 거부 · 옛 `false`가 있어도 봄).
  - **쓰기는 같은 모둠에만.** 규칙은 모둠을 뒤져 찾을 수 없어서 문서에 적힌
    `groupId` 한 번의 get으로 판정합니다 — 그 모둠 명단에 **쓴 사람과 받는
    사람이 둘 다** 있어야 통과하므로, 남의 모둠 id를 적어도 소용없습니다.
  - **잠금은 `peerReviewLocked` 하나로만 — 활동 전체 잠금(`locked`)과 독립.**
    '이제 그만 쓰고 이야기하자'로 닫는 자리라 글쓰기까지 함께 잠기면 안 되고,
    거꾸로 **활동을 잠가도 동료 평가가 열려 있으면 쓰고 고칩니다**(배움나눔과 같음 —
    글쓰기를 잠가 둔 채 발표를 듣고 한 마디를 남기는 수업). 규칙(`peerReviews`의
    create · update)과 학생 화면(`RaftForm`의 `peerLocked`)이 활동 잠금을 안 봅니다.
  - **표시가 없으면 잠김입니다**(기본 잠김). 활동을 만들자마자 열려 있으면
    아직 아무도 발표하지 않았는데 코멘트가 쌓입니다 — 동료 평가는 '발표를
    듣는 시간'에만 여는 것이라, 교사가 머리말 단추로 한 번 열어야
    (`peerReviewLocked: false`) 시작합니다. 판정은 `lib/bookGroups.js`의
    `isPeerReviewOpen` 한 곳과 규칙의 `peerReviewOpen()` **둘이 같아야**
    합니다 — 한쪽만 고치면 화면은 쓸 수 있다고 하는데 저장이 거부됩니다.
  - 받은 한 마디를 보는 자리는 **둘**입니다: 학생은 자기 RAFT 글 아래
    (`PeerReviewList`), 교사는 학생 카드를 열었을 때 그 학생의 글 아래.
    한때 모둠 줄에 '💬 받은 한 마디 n' 바로가기 단추가 있었는데 걷었습니다(선생님
    요청 — 내려 보면 곧바로 보입니다). **되살리지 마세요.**
  - 학생 쪽 질의는 `where('fromUid','==',나)`와 `where('toUid','==',나)` 둘로
    나눕니다. 조건 없이 통째로 받으면 남의 평가까지 읽는 일이라 규칙이 막습니다
    (그 사실을 `tests/rules/peerReviews.test.mjs`에 시험으로 박아 두었습니다).
  - **모둠 RAFT — 친구 이름을 누르면 그 친구의 글을 읽고 이어서 감상을 씁니다**
    (선생님 요청). 같은 동료 평가 창(`PeerReviewModal`의 `renderWork`)이 넓어져
    **왼쪽에 친구의 글**(RAFT 한 문장 · 네 요소 · 글쓰기 — `RaftForm`의
    `MateRaftWork`), **오른쪽에 나의 감상**(지금까지의 한 마디 칸 그대로 —
    `peerReviews`에 저장)이 섭니다. 760px 아래에서는 위아래.
    - 글쓰기도 네 요소처럼 **흰 칸 하나**(`.mate-raft-write`, 선생님 요청) — 칸 없이
      바탕에 흘러 있을 때는 다른 덩이로 안 읽혔습니다.
    - 이름은 **동료 평가가 잠겨 있어도 단추**입니다 — 글은 읽히고 감상 칸만
      잠깁니다(창이 그 사실을 적음).
    - 친구 글은 고른 친구의 기록 **한 장만** 구독합니다(`subscribeMateEntry`).
      아직 안 썼거나 읽을 수 없으면 '아직 볼 수 있는 글이 없어요'(둘이 같은 모습).
    - **규칙을 열었습니다**(entries의 `mateReadsEntry`): 기록이 적어 둔 모둠
      `groupId`에 **읽는 나와 글쓴이가 둘 다** 있어야 읽힙니다 — 동료 평가의
      `reviewGroupHas`와 같은 생각이라 남의 모둠 id를 적어도 소용이 없습니다.
      모둠 활동(`grouped`)이고 `type == 'raft'`일 때만, 물러난 모둠(`retired`)은
      뺍니다. 곁텍스트 · 개인 활동의 기록은 지금까지처럼 본인 · 교사만.
      시험 `tests/rules/mateEntries.test.mjs`. **코드보다 규칙을 먼저 배포하세요**
      — 안 그러면 친구 글이 늘 '아직 볼 수 있는 글이 없어요'입니다.
    - 그래서 학생 기록에 **`groupId`**를 적습니다 — 저장할 때마다
      (`saveParatextEntry`의 넷째 인자), 그리고 화면을 열 때 적힌 값이 지금
      모둠과 다르면 맞춥니다(`saveParatextEntryGroup` — 이미 있는 기록에만,
      잠기면 못 씀). 모둠을 다시 짰거나 이 칸이 생기기 전에 쓴 글은 **글쓴이가
      활동을 한 번 열어야** 친구에게 보입니다.
- `classes/{classId}/cornellNotes/{uid}_{날짜}` — **옛 수업 노트(코넬)**. 서랍 · 크게 보기 · 교사 열람 화면과
  그 코드를 모두 걷었고, 규칙에서도 걷어 아무도 읽고 쓰지 못합니다. **저장된 노트는 지우지 마세요** —
  반 완전 삭제(`lib/classPurge.js`의 `CLASS_SUBCOLLECTIONS`)와 학생 탈퇴(`lib/data/withdraw.js`)가 함께 지웁니다.
- `classes/{classId}/rewardEvents` — **과일 지급 이력** (uid, delta, count, byUid, at)
  - **어느 화면에서 줬는지는 안 남습니다.** 출처가 필요해지면 이력을 넓게
    훑지 말고 그 대상 문서에 도장을 찍으세요(한때 수업 노트가 `rewardedAt`으로 그렇게 했습니다) —
    이력에 `source`를 더하면 '그 학생의 그날 이력'을 넓게 훑어야 해서 읽기가 늡니다.
  - `rewards`는 누적 총계뿐이라 '언제 몇 개 받았나'가 없습니다. 참여의 변화를
    보려면 시계열이 필요해 지급할 때마다 한 건 적습니다(`setStudentReward`가
    총계와 **한 트랜잭션**으로 씁니다 — 동시 지급 유실도 이때 함께 막힙니다).
  - 이력이라 수정·삭제 불가. 반 완전 삭제(`purgeClass`) · 학생 탈퇴(`withdrawStudent`) 때만 지웁니다.
  - **＋1·−1 단추는 반드시 `addStudentReward`(델타)로.** `setStudentReward`는
    '몇 개로 맞춰라'는 절대값이라, 화면에 보이는 개수로 `count + 1`을 만들어
    보내면 **빨리 두 번 누를 때 두 번째가 묻힙니다** — 첫 번째 결과가 구독으로
    돌아오기 전이라 두 번 다 같은 값을 보내고, 서버는 `before === safe`로 보아
    아무 일도 안 합니다(이력도 안 남습니다). 실제로 이 증상이 있었습니다.
    지금은 누르는 자리가 `onAward(uid, 개수, delta)`로 델타를 함께 넘기고,
    페이지의 `awardReward`가 델타가 오면 `addStudentReward`로 보냅니다
    (트랜잭션 안에서 읽은 값에 더하므로 한 번도 안 묻힙니다).
    절대값 경로는 '개수를 직접 맞추는' 자리에만 남겨 둡니다.
- `users` — 사용자 프로필 (uid, email, displayName(익명), realName, studentId, role)
  - **식별 정보(실명·이메일·학번)는 여기에만** 저장. 게시물·카드엔 익명 정보만 넣음.
  - 읽기 규칙: 본인 · 관리자 · 그 학생을 가르치는 교사(`classIds` ∩ 교사의 `ownedClassIds`) ·
    급우. 교사 화면은 그 반 학생만 한 건씩 읽습니다(`subscribeClassDirectory` — 위 '반 목록 ·
    학생 프로필은 내 반만 읽습니다' 절). 통째로 받는 `subscribeUserDirectory`는 관리자 전용.
- `users/{uid}/notifications` — 배움나눔의 개인 알림함입니다. 책봄에서는 걷었습니다(위 '서버 함수 없이
  돌리기'). 남은 문서는 읽는 곳이 없습니다.

## 화면별 약속

### 과일 바구니 — 떠 있는 동그라미에서 엽니다 (교사·학생)

- 떠 있는 동그라미(`FloatingHub`)의 **'과일 바구니'**가 `/books?open=fruit`로
  커다란 바구니 그림 창을 엽니다(`components/FruitBasketModal.jsx`).
- 한때 공부방 제목 줄의 마지막 단추였는데, 동그라미로 같은 창을 열 수 있게 되어
  **걷었습니다**(선생님 요청 — 교사·학생 둘 다). 창과 `?open=fruit` 처리는
  그대로입니다. 단추를 되살리지 마세요.
- **그림은 선생님이 주신 색연필 그림**(`public/fruit-basket.webp`)입니다. 처음에는
  SVG로 컴포넌트 안에서 그렸는데 주신 그림으로 바꿨습니다(그리던 SVG는 걷음).
  - 원본(1536×1024 · 462KB)을 **1200px · WebP 품질 82**로 줄였습니다(약 280KB) —
    창에서 그림 칸이 600px 남짓이라 고해상도 화면에서도 모자라지 않습니다.
  - **종이 바탕을 흰색으로 밀었습니다**(sharp로 한 번 — 밝고(최솟값 222~238)
    색이 거의 없는(채도 차 22 미만) 픽셀만 부드럽게 흰색 쪽으로). 원본의 종이는
    회백색(245)이라 흰 창 위에서 **회색 상자**로 보였습니다. 과일과 바구니 밑의
    보랏빛 그림자는 색이 있어 그대로입니다. CSS의 `mix-blend-mode: multiply`는
    남은 옅은 결을 창에 녹이는 덤입니다.
  - 그림을 바꿀 때도 같은 셈을 한 번 거치세요 — 안 거치면 회색 상자가 돌아옵니다.
  - `<img>`에 `width`·`height`(1200·800)를 적어 그림이 오기 전에도 자리를 잡고,
    `object-fit: contain`이라 높이에 걸려 줄어도 찌그러지지 않습니다.
- **창 크기는 못 박습니다** — `min(840px, 96vw)` × `min(560px, 94vh)`(선생님
  요청 — 한때 960×680이었는데, 아래로 열리는 이벤트 기록이 화면 밖으로 밀려
  여백을 줄여 작게 했습니다: 안쪽 여백 14/18 · 칸 사이 14 · 카드 여백 10/12 ·
  그림 360px · 오른쪽 칸 330px). 오른쪽 칸은 안내·결과 한 줄이 생겼다 사라지고(목표 도달 · 내놓은 결과 ·
  오류 · 접수 결과) 교사·학생 내용도 달라, 내용에 맞춰 두면 누를 때마다 창이
  늘었다 줄었습니다. 모자라면 **오른쪽 칸만** 제 안에서 구릅니다. 720px 아래에서는
  못 박기를 풀고 위아래로(창 전체가 구름).
- **그림은 왼쪽 칸 가운데**(`width: min(100%, 360px)`)에 섭니다.
- 실측(데모): 1440×900에서 열 때 · ＋ · 내놓기 · 응모 · 안내 줄이 떠도 창 960×680
  그대로 · 그림 410×273 · 1280×620에서 960×583 · 600px에서 한 열 · 가로 넘침 0.
- 닫기는 `backdropClose`(Esc·배경·×). 창은 **왼쪽 그림 · 오른쪽 칸**
  (`.fruit-basket-body`, 오른쪽 300px · 720px 아래에서 위아래)입니다.

**과일 담기 · 이벤트 응모**(`classes/{cId}/fruitBasket/{학생 uid}`)

- 학생 창은 **−/＋ 개수 칸 하나와 이벤트 두 단추**뿐입니다(선생님 요청).
  **응모하기**를 누르면 정한 개수만큼 제 과일이 반의 바구니에 담기며 응모하고,
  **응모하지 않기**를 누르면 담아 둔 과일을 모두 돌려받습니다. 문서는
  `{ classId, uid, donated(지금 바구니에 든 내 몫), entered, declined?,
  decidedAt?, receivedAt?, receivedBy?, updatedAt }`, 바구니 = 문서들의 합.
  - **'과일 내놓기 · 과일 거두기' 단추는 걷었습니다**(선생님 요청 — −/＋가 곧
    수량이고, 담고 돌려받는 것은 두 선택이 합니다). 한때 그 두 단추가 개수 칸
    아래 반씩 섰고(`.fb-give` — 이름만 남음), 응모는 '내놓아 둔 과일이 1개 이상'일
    때 따로 눌렀습니다. **되살리지 마세요.** 그 단추만 쓰던 `donateFruits` ·
    `donationAmount` · `withdrawAmount`, 그리고 '적게 골라 응모하기'가 쓰던
    `withdrawFruits`도 걷었습니다(칸이 '이번에 담을 수'가 되며 줄이는 길이
    없어졌습니다 — 아래).
- **담은 만큼 `rewards.count`에서 실제로 뺍니다** — 학생은 나머지만
  가집니다(선생님 요청). 그래서 상단바 🍊 · 교사의 '누적' · ⭐ 접기가 모두
  남은 과일로 보입니다. 교사가 다시 줄 수 있는 천장(100)도 그만큼 열립니다.
  - 두 쓰기는 **한 트랜잭션**이고, 규칙이 **`getAfter`로 서로 맞대어** 봅니다 —
    과일만 빼거나 바구니만 늘리거나 개수가 안 맞는 쓰기는 거부됩니다
    (`fruitDonationMatches` · `fruitBasketGainMatches`). 학생에게 `rewards`의
    update가 열린 것은 **`count`·`updatedAt`만 · 제 문서만 · 천장 100 안에서 ·
    바구니가 같은 묶음에서 반대로 움직일 때만**입니다.
  - **지급 이력(`rewardEvents`)에는 안 적습니다** — 교사가 준 것의 기록이고
    규칙도 교사만 쓰게 잠가 두었습니다. 그래서 이력의 `count`와 지금의
    `rewards.count`가 담은 뒤로는 다를 수 있습니다.
- **응모하기 = 담으며 응모**(`enterFruitEvent(classId, uid, add)`).
  - **개수 칸은 '이번에 담을 수'입니다**(선생님 요청). 응모하기를 누를 때마다
    그만큼 담기고 칸은 **0으로 돌아갑니다**. 그래서 **응모한 뒤에 더 담기도 같은
    단추 하나**입니다 — 다시 개수를 정하면 응모하기가 **`＋n개 더 응모하기`**
    (살구 — 누를 수 있음을 보임)로 살아나고, 누르면 그만큼 더 담깁니다(날아가는
    과일도 그 수만큼). 정하지 않았으면 `✓ 응모하기`(진한 살구 · 눌러도 아무 일
    없음)입니다.
    - 한때 칸이 '바구니에 담긴 총수'였습니다. 그러면 응모한 뒤 더 담으려면
      총수를 늘리고, 줄이려고 칸을 낮추면 '줄일 수 없다'고 막혀 무엇을 적는 칸인지
      헷갈렸습니다(선생님 제안으로 바꿈).
  - **더할 수(델타)를 보냅니다** — 트랜잭션이 지금 담긴 수를 읽어 거기에 더하고,
    같은 트랜잭션에서 제 과일을 그만큼 덜어 냅니다(규칙이 `getAfter`로 두 쓰기를
    맞대어 봄). 총수를 보내면 화면이 들고 있던 옛 값으로 셈해 엉뚱한 수가
    담길 수 있습니다(과일 ＋1 단추가 델타인 것과 같은 까닭). 바구니 문서가 없어도
    됩니다(create 규칙이 같은 셈을 봄). 돌려주는 값은 `{ left, donated }`.
  - **처음 응모한 시각(`decidedAt`)은 그대로 둡니다** — 더 담기는 새 응모가 아닙니다.
  - **0개로 응모하는 때가 하나** — 응모 안 했는데 바구니에 이미 과일이 든
    학생(옛 화면에서 내놓기만 해 둔 경우)은 그 과일 그대로 응모합니다(과일 문서를
    안 건드림 — 규칙이 `count`가 그대로인 학생 쓰기를 거부하므로).
  - **줄이는 길은 없습니다** — 응모하지 않기로 모두 돌려받고 다시 응모합니다.
    규칙도 응모한 동안 바구니가 주는 쓰기를 막습니다.
  - 판정은 `lib/fruitBasket.js`의 `entryAmount(raw, have)`(가진 과일 안에서 1개
    이상) · `entryMax(have)` · `canEnterEvent(mine, add)`.
  - **규칙을 안 건드립니다**(응모한 동안 바구니가 느는 쓰기는 원래 받습니다).
    시험 `tests/rules/fruitBasketTx.test.mjs`에 앱과 같은 모양의 트랜잭션으로
    여섯(문서 없을 때 · 담아 둔 것에 더 담으며 · 0개 더 · 응모한 뒤 더 담기 ·
    응모한 동안 줄여 돌려받기는 거부 · 줄이며 응모는 거부).
- **개수 칸**(`.fb-stepper` — 36px 정사각형 −/＋ 사이에 숫자 칸, 칸에 직접 적어도
  됨 · 숫자만 남김 · Enter는 응모하기와 같음).
  - **늘 0에서 시작**하고, 담은 수가 바뀌면(응모 · 더 담기 · 돌려받기) 0으로
    돌아갑니다. 1로 시작하면 창을 열자마자 응모하기 한 번에 과일이 나갑니다
    (선생님 요청으로 0에서 시작).
  - 범위는 0부터 **가진 과일**까지(`entryMax`). 넘게 적으면 '가진 과일 n개 안에서
    정해 주세요'.
  - **접수된 뒤 · 가진 과일이 없으면 잠깁니다.**
  - **Esc를 막지 않습니다**(`data-esc-ignore`). 늘 숫자가 든 칸이라, '글이 든
    칸이 있으면 Esc로 안 닫는다'(`lib/modal.js`)에 걸려 창이 Esc로 영영 안
    닫혔습니다. 그 표시가 달린 칸은 그 판정에서 빠집니다 — 쓰는 글이 아니라
    **값이 늘 든 설정 칸**을 창에 새로 둘 때 함께 다세요.
  - 머리 줄은 `내가 가진 과일 🍊 n · 바구니에 담은 과일 m`, 아래 한 줄이 지금
    할 일을 말합니다(응모했으면 '더 담으려면 −/＋로 개수를 정하고 응모하기를 다시
    누르세요').
  - 실측(데모 1440px, 과일 8): 3 → 응모하기(바구니 3 · 가진 5 · 칸 0 · ✓) → ＋2 →
    `＋2개 더 응모하기` → 바구니 5 · 가진 3 · 칸 0 → 9를 적으면 안내 → 응모하지 않기로
    5개 돌려받아 8.
- **저장 실패 문구는 우리말로**(`fruitErrorText`). 규칙 거부가 Firebase의
  영어 문구('Missing or insufficient permissions.')로 그대로 떠 학생이 읽을 수
  없었습니다(실제 신고). 원인 단서(`code`)는 콘솔에 남깁니다. 그 신고는
  **규칙 쪽이 아니었습니다** — 앱과 똑같은 트랜잭션을 에뮬레이터에 보낸 시험이
  통과합니다(`fruitBasketTx.test.mjs`). 다시 나면 그 학생 콘솔의 `code`와
  **배포된 규칙**부터 보세요(콘솔에 옛 규칙이 붙어 있던 일이 실제로 있었습니다).
- **이벤트 칸은 늘 섭니다** — 제목 '이벤트' 아래 **응모하기 · 응모하지 않기**가
  반씩(`.fb-choice`). 꺼진 까닭은 아래 한 줄이 말합니다.
  - **응모하기**는 담을 과일을 **1개 이상 정했으면** 켜집니다(`canEnterEvent(mine,
    add)` — 응모한 뒤에도 같음, 그때는 '더 담기'). **반 바구니 100개와는 별개입니다**(선생님 요청 — 한때 100개에 닿아야
    켜져, 과일이 있어도 단추가 꺼져 있었습니다). 규칙도 `entered`가 참이면
    `donated >= 1`만 봅니다(합계는 규칙이 셀 수 없음).
  - **응모하지 않기**는 늘 누를 수 있고, 담아 둔 과일을 **모두 자동으로 돌려받습니다**
    (`declineFruitEvent` — 한 트랜잭션, 돌려받아 100을 넘으면 넘지 않는 만큼만).
    응모한 상태에서 누르면 응모를 먼저 거두고 돌려받습니다(규칙이 응모한 동안의
    과일 감소를 막아 두 번에 나눠 씀 — 규칙은 안 바꿈).
  - **둘 중 하나를 고르는 단추입니다**(선생님 요청 — `role="radio"`). 고른 쪽은
    **진한 살구(`--primary-dark`) + ✓**, 고르지 않은 쪽은 **살구(`--primary`)**
    입니다(선생님 요청 — 한때 고르지 않은 쪽을 연한 살구 `--primary-light`로 옅게
    두었는데 꺼진 단추처럼 보였습니다). 아직 아무것도 안 골랐으면 둘 다 살구.
    **다른 쪽을 누르면 바뀌고, 고른 쪽은 다시 눌러도 아무 일이 없습니다**
    (응모한 뒤 개수를 정한 때만 예외 — 응모하기가 '더 담기'로 다시 살아납니다)
    (`.fb-choice-on` — hover에도 같은 색 · 손 모양 없음). 한때 고른 쪽을 다시
    누르면 거두는 토글이었는데 걷었습니다 — '응모 취소' 단추를 따로 만들지도
    마세요(선생님 확인: 이름은 응모하기 · 응모하지 않기 둘뿐).
  - `entered`와 `declined`는 둘 중 하나만 참입니다(규칙).
  - 이벤트 두 단추는 `btn-primary`에 높이 40px — `.btn-primary`의 위아래 여백
    12px이 못 박은 높이에 안 들어가 글자가 아래로 밀렸으므로 여백을 걷고 flex로
    한가운데에 둡니다(`.fb-enter-btn`). 높이를 못 박은 단추에 `.btn-primary`를
    쓸 때는 이 여백을 함께 걷으세요.
  - 실측(데모 1440px): 처음 0 · 응모하기 꺼짐 → ＋3 → 응모하기 ✓(진한 살구
    rgb 184,92,63 · 가진 6 → 3, 바구니 3 · 개수 칸 잠김) → 다시 눌러도 그대로 →
    응모하지 않기 ✓(3개 돌려받음 · 개수 0) → ＋2 → 응모하기 ✓(바구니 2) · 옛 상태
    (5개 담김 · 응모 안 함)에서 2로 줄여 응모 → 3개 돌려받고 바구니 2 · 내놓기 ·
    거두기 단추 0개 · 600px 가로 넘침 0.
- **과일이 날아가는 효과**(학생, `components/fruitFly.js`의 `flyFruits`, 선생님 요청).
  응모하기는 '내가 가진 과일' 숫자 자리 → 바구니 그림으로 과일이 포물선을 그리며
  하나씩(85ms 간격 · 한 알 0.76초) 떨어져 담기고, 마지막 알이 닿을 즈음 바구니가
  한 번 출렁입니다. 응모하지 않기는 거꾸로 바구니에서 튀어나와 숫자 자리로 돌아옵니다.
  - **저장이 끝난 뒤에** 날립니다(`run`의 넷째 인자) — 실패했는데 담기는 그림을
    보여 주면 거짓말입니다. 날리는 수는 담은 · 돌려받은 수, 많아도 **10알**까지.
  - 과일은 React가 아니라 **body에 붙인 span**(`.fb-fly`, fixed · z-index 3200)이고
    끝나면 스스로 지웁니다 — 구독으로 숫자가 바뀌며 창이 다시 그려져도 날던
    과일이 끊기지 않게. 움직임은 transform · opacity뿐(Web Animations API).
  - 과일 그림은 `RewardFruits`의 `FRUITS`를 씁니다(🍎를 새로 적지 말라는 약속).
  - 움직임을 줄여 달라고 한 기기에서는 날리지 않습니다(숫자만 바뀜).
  - 실측(데모 1440px): 6개 응모 → 6알이 바구니로 · 1.2초 뒤 span 0개 · 응모하지
    않기 → 6알이 숫자 자리로 · 과일 8로 돌아옴.
- **이벤트 접수(교사)** — 교사 창의 '이벤트' 칸: 응모 n/N · 응모하지 않기 n ·
  아직 n(수만 — 이름 목록은 걷었습니다, 선생님 요청: 초록 점이 꺼진 자리가
  곧 안 고른 학생), 그 아래 **'이벤트 접수 (응모 n명 · 과일 m개)'**
  (`receiveFruitEvent`). **접수하면 응모한 과일을 100개까지만 처리하고(돌려주지
  않음) 넘친 것은 바구니에 남겨 새 이벤트로 잇습니다**(선생님 요청). 되돌릴 수
  없어 **되묻는 창**(`ConfirmModal`)을 거칩니다 — 처리할 수와 남는 수를 미리 적습니다.
  - 나눔은 `lib/fruitBasket.js`의 **`planFruitReceipt` 한 곳**(시험 있음). **먼저 응모한
    학생부터**(`decidedAt`, 서버 시각 전은 맨 뒤) 100개를 채웁니다 — 다 처리된 응모
    문서는 지우고, 걸친 한 학생은 남는 수만큼 `donated`를 줄여 **응모한 채로** 두고
    (다음 이벤트에 그대로 들어감), 차례가 안 온 응모는 그대로입니다. 과일 없는
    선택 문서(응모하지 않기 · 안 고름)는 지워 새 이벤트에서 다시 고르게 하고, 과일이
    든 미응모 문서(옛 화면)는 건드리지 않습니다. 100개 아래면 응모한 것이 모두 처리되어
    바구니가 빕니다.
  - 처리하기 전에 **기록 한 장**을 남깁니다 — `classes/{cId}/fruitEvents/{auto}`
    `{ classId, byUid, at, total(처리한 수), entrants:[{uid,donated(처리한 수)}], declined:[uid] }`
    (같은 writeBatch). 바구니 문서가 사라지면 누가 응모했는지 알 길이 없어서요.
    **담당 교사만 읽습니다.**
  - **지난 이벤트 기록**(선생님 요청 — `FruitEventHistory`, 교사 창의 '이벤트' 칸 맨 아래)이
    그 기록을 보여 줍니다. 오른쪽 칸에는 **한 줄씩만**(`n회 · 날짜 시각 · 응모 n명 · 🍊 m개`)
    섭니다. 줄을 누르면 **창 아래에 같은 폭의 서랍이 붙어 창 뒤에서 빠져나옵니다**
    (`EventDoor` · `.fb-door`, 선생님 요청 — 보내 주신 '한눈에 보는 일정' 화면 모양).
    서랍은 옅은 크림 바탕이고, 위쪽에 창이 드리운 그늘(안쪽 그림자)이 있으며, 서랍이 서
    있는 동안 창의 아래 모서리를 펴(`.fb-stack.has-door`) 둘이 한 장으로 읽힙니다. 여는
    움직임은 아래로 펴지는 clip-path + 살짝 내려오기(0.42초), 내용은 조금 늦게 떠오릅니다.
    누가 몇 개를 냈나(처리한 수 · 여러 칸 격자)와 응모하지 않은 학생이 섭니다(한때 줄
    안에서 펼쳐 좁은 칸이 한없이 길어졌습니다). 같은 줄을 다시 누르거나 × · Esc면 창 뒤로
    도로 들어가고(Esc는 서랍만 — `preventDefault`), 다른 줄을 누르면 그 회로 다시 열립니다.
    - **한때 노트북 덮개처럼 경첩에서 젖혀 열렸습니다**(`rotateX` · 경첩 표시 · 안쪽 그늘
      걷힘) — 서랍 모양으로 바꿨습니다(선생님 요청). 되살리지 마세요.
    - **교사 창은 처음부터 가운데보다 90px 위**에 섭니다(`.fb-backdrop--teacher`, 선생님
      요청) — 서랍이 열릴 자리를 미리 비워 둡니다. 화면이 낮으면 배경 위 여백까지만
      올라갑니다. 학생 창은 서랍이 없어 가운데 그대로.
    - 서랍은 **창 레이아웃에 안 낍니다**(absolute, 위 22px은 창 뒤에 숨어 이음매가 안 보임)
      — 창이 제자리에 있습니다. 화면 아래가 모자라면 배경이 구르도록 배경을 위에서부터
      쌓고(`.fb-backdrop`) 창 묶음(`.fb-stack`)을 auto 여백으로 가운데에 둡니다.
    - 서랍이 보이게 굴리는 것은 **다 열린 뒤**(`animationend` — 서랍 자신의 것만)입니다.
    - 닫는 시간 `DOOR_MS`(360)는 CSS `.fb-door.is-closing`의 길이와 같아야 합니다.
    - 실측(데모 1440×900): 창 840px · 서랍도 840px로 같은 x · 창 바닥 730 · 서랍 바닥 856 ·
      닫으면 0.36초 뒤 사라짐 · 가로 넘침 0.
    - 이름은 지금 명단에서 찾고 없으면 '반에서 빠진 학생'(기록에는 uid만). 읽기는
    `subscribeFruitEvents`(at 내림차순 · 최근 30장 — 단일 필드라 색인 없음). **학생
    화면에는 없습니다** — TeacherPanel 안에만 서고 규칙도 학생 읽기를 막습니다(규칙은
    안 건드림). 이 기능 전의 접수(바구니만 지우던 때)는 기록이 없습니다.
  - 단추의 수(`이벤트 접수 (응모 n명 · 과일 m개)`)는 **이번에 처리될 것**(plan)입니다 —
    명단 밖 학생 포함, 100을 넘지 않음. 응모한 과일이 없으면 꺼집니다.
  - 한때 접수는 `receivedAt`·`receivedBy`만 찍어 그 학생의 선택을 굳혔습니다
    (학생 쓰기를 규칙이 막음). 그 칸과 규칙은 **옛 문서 때문에 남겨 두었고**,
    새 흐름에서는 문서가 지워지므로 그 상태가 생기지 않습니다.
  - **규칙을 열었습니다**(`fruitEvents` — 만들기 · 읽기 · 지우기는 담당 교사,
    고치기 없음, 칸을 못 박음). 바구니 지우기는 원래 담당 교사에게 열려 있었습니다.
    바구니에는 **교사가 응모 문서의 `donated`를 줄이는 갈래**를 더했습니다(100개를 넘을
    때 걸친 학생 — `changedOnly(['donated','updatedAt'])` · 응모한 문서만 · 줄이기만 ·
    1개 이상 남게). 시험 `tests/rules/fruitBasket.test.mjs`(앱과 같은 묶음 · 남의 이름 ·
    낯선 칸 · 학생 · 다른 반 교사 거부 · 학생은 기록 못 읽음 · 줄이기 갈래의 통과와
    거부). **코드보다 규칙을 먼저 배포하세요** — 안 그러면 접수가 권한 오류입니다.
- **바구니는 100개까지입니다**(`basketRoom` — 선생님 요청). 학생이 담으려는 수가
  남은 자리를 넘으면 응모하기가 꺼지고 '바구니는 과일 100개까지 담을 수 있어요.
  지금은 n개까지만 담을 수 있어요.'가 섭니다(`entryAmount`의 셋째 인자 ·
  `enterFruitEvent`의 넷째 인자도 같은 것을 막음). 다 차면 개수 칸이 잠기고
  '바구니에 과일 100개가 다 찼어요. 선생님이 접수하면 새 이벤트가 시작돼요.'
  - 합계는 여러 문서의 합이라 **규칙이 못 막습니다** — 화면이 센 값을 믿으므로
    두 학생이 같은 순간에 담으면 조금 넘을 수 있습니다(접수는 100개만 처리하고
    넘친 것은 바구니에 남김).
  - 실측(데모 1440px): 96개에서 6 → 안내 + 응모하기 꺼짐 · 4 → 응모 → 100/100 ·
    개수 칸 잠김 · 교사 접수 → 기록 1장(응모 8명 · 97개) · 바구니 0/100.
  - 실측(데모, 넘칠 때): 60 · 30 · 20개 응모 + 응모 안 함 1 → 단추 '응모 3명 · 과일 100개' ·
    되묻는 창 '남는 과일 10개' → 접수 → 기록 100개(60 · 30 · 10) · 바구니에 셋째 학생 10개가
    응모한 채 남음 · 단추 '응모 1명 · 과일 10개'.
- **이벤트 취소(교사)** — 접수 아래 옅은 단추(`.fb-cancel-event`, 붉은 글자)가
  되묻는 창(`ConfirmModal`, body에 포털)을 거쳐 **바구니에 든 과일을 학생마다
  모두 돌려주고 바구니를 0개로 비웁니다**(`cancelFruitEvent`, 선생님 요청).
  바구니 문서를 지우므로 응모 선택 · 접수 표시 · 초록 점도 함께 걷히고,
  **접수한 학생의 과일도 돌아갑니다**(이벤트를 통째로 없던 일로 — 규칙상 교사는
  접수된 문서도 지울 수 있음).
  - **한 트랜잭션**입니다 — 학생마다 '돌려주기 + 지우기'가 짝이라, 반쯤 되다
    멈추면 과일은 돌아왔는데 바구니에도 남는(두 번 받는) 일이 생깁니다. 학생 수
    × 2 쓰기라 한도(500)에 안 닿습니다. 바구니 목록은 트랜잭션 앞에서 한 번 읽고
    안에서 문서마다 다시 읽습니다.
  - 돌려받아 **과일 천장(100)을 넘는 몫은 사라집니다**(규칙이 100을 넘는 과일을
    막음) — 결과 줄에 그 개수를 적습니다.
  - **지급 이력(`rewardEvents`)에는 안 적습니다** — 새로 준 것이 아니라 맡겨 둔
    것을 돌려주는 일입니다.
  - **학생 화면에 축포가 안 터집니다**(선생님 요청 — 반납이지 새로 받은 것이
    아니라 개수만 다시 셈). 교사 화면에서 쓰는 일이라 학생 브라우저가 미리 몫을
    적어 둘 수 없어(`expectSelfGain`은 같은 브라우저 안에서만 통함), 과일 문서에
    **반납 표시** `fruitReturn: { id, n }`(취소마다 새 id)를 함께 적습니다.
    `subscribeMyClassRewardCount`가 그 표시를 둘째 값으로 넘기고, 축포 훅이
    **표시가 새로 바뀐 답**에서 n만큼을 덜어 냅니다(`returnedGain`). 같은 순간
    교사가 준 몫만 남습니다. 처음 받은 값의 표시는 기준점일 뿐입니다 — 지난
    반납을 다시 덜면 그 뒤 교사가 준 과일이 묻힙니다.
    - 표시는 그대로 남아 있어도 해가 없습니다 — 교사의 과일 쓰기는 merge라
      표시를 안 건드리고(id가 같으니 다시 안 덜어 냄), 학생의 바구니 쓰기는
      `changedOnly(['count','updatedAt'])`라 그대로 통과합니다(시험으로 박아 둠).
    - 시험 `tests/unit/selfFruitGain.test.mjs` · `tests/ui/rewardCelebration.test.mjs`.
  - **규칙을 안 건드립니다** — 담당 교사는 rewards를 고치고(천장 100 · 칸을
    못 박지 않음) 바구니 문서를 지울 수 있습니다. 시험
    `tests/rules/fruitBasket.test.mjs`(담당 교사 통과 · 다른 반 교사 · 학생 거부).
  - 바구니에 문서가 하나도 없으면 단추가 꺼집니다.
- **'멋진 순간' 자리표의 초록 점**(`.attend-seat-event`, 오른쪽 위) = **응모하기 ·
  응모하지 않기 어느 쪽이든 골랐는데 아직 접수 안 됨**(`isEventPending` —
  `receivedBy`로 판정해 서버 시각 전에도 곧바로 꺼짐). **점이 꺼져 있으면 아직
  아무것도 안 고른 학생**입니다. 교사가 접수하면 꺼집니다.
  - 한 번 '응모에만' 켜도록 바꿨다가 되돌렸습니다 — 선생님이 점의 뜻을 '골랐나'로
    다시 정하셨습니다(과일을 다 돌려받은 '응모 안 함' 학생 자리에 불이 남는 것이
    맞습니다 — 접수하면 꺼집니다). **또 바꾸지 마세요.**
  같은 자리의 손바닥은 점 왼쪽으로 비켜 섭니다(`.attend-seat--event`).
  `StudyRewardPanel`이 바구니를 구독해 패널과 확대 창의 자리표에 넘깁니다
  (`eventChoiceByUid` — 읽기는 그 반의 바구니 문서뿐). **다른 자리표(수업 중
  자리표 · 참여 전광판 등)에는 아직 없습니다.**
- **스스로 되찾은 과일에는 축포가 안 터집니다**(`lib/selfFruitGain.js`). 축포는
  제 과일 수가 늘어난 순간을 잡는데, 응모하지 않기로
  돌려받아도 같은 값이 늘어 선물처럼 터졌습니다. 되찾는 쪽이 쓰기 **전에** 몫을
  적어 두고(`expectSelfGain`, 실패하면 `dropSelfGain`), 축포 훅이 늘어난 만큼에서
  먼저 덜어 냅니다(`takeSelfGain` — 같은 순간 교사가 준 몫만 남음, 30초 지난 몫은
  버림). 같은 브라우저 안에서만 통합니다. 시험 `tests/unit/selfFruitGain.test.mjs`.
- **목표는 100개**(`FRUIT_GOAL`). 닿으면 교사·학생 모두에게 '🎉 우리 반 바구니에
  과일 100개가 모였습니다.'가 뜹니다(응모 조건은 아닙니다 — 위). 합계는 여러 문서의
  합이라 **규칙이 셀 수 없어 목표 판정은 화면이** 합니다.
- **교사 화면은 합계 + 이벤트 현황**, 반 학생이 모두 응모하면 '전체 학생이
  이벤트에 응모했습니다.', 모두 골랐으면(응모 안 함 섞임) '전체 학생이 응모
  여부를 골랐습니다.' 아직 안 고른 학생은 이름으로 적습니다. 응모는
  **지금 명단(`roster`)에 있는 학생만** 세고, 합계는 반에서 빠진 학생이
  낸 것도 셉니다(이미 바구니에 든 과일). 셈은 `lib/fruitBasket.js`
  (`basketSummary` · 시험 `tests/unit/fruitBasket.test.mjs`).
- **읽는 문서는 그 반의 바구니 문서들뿐**입니다(학생 수만큼). 내 과일 수는
  페이지가 이미 구독해 둔 반 `rewards`에서 넘깁니다(`myFruit`).
- 규칙: 읽기는 반 학생·담당 교사, 쓰기는 본인 문서만, 지우기는 담당 교사
  (다시 모을 때 — 아직 그 화면은 없습니다). 시험
  `tests/rules/fruitBasket.test.mjs` · `fruitBasketTx.test.mjs`. **코드보다 규칙을
  먼저 배포하세요** — 옛 규칙이 남아 있으면 응모하지 않기 · 이벤트 접수가 권한 오류로
  실패합니다(옛 규칙은 `declined` · `receivedAt` 칸을 모릅니다).
- 반 삭제는 `purgeClass`가 하위 컬렉션째 정리합니다. 문서에 이름이 없어
  탈퇴 정리 대상은 아닙니다(uid와 개수뿐).
- 데모 모드에서 확인하려면 학생에게 과일이 있어야 하는데 데모 반에는 줄
  길이 없어, 확인하는 동안만 `mock`을 창에 내놓고 과일을 넣었습니다(걷음).

### 반 관리하기의 입장 코드 — 카드 한 장에 두 줄

- 반 카드는 **머리줄과 코드 줄 둘**입니다. 머리줄이
  `⠿ 반 이름 …… [✏][🔄 재발급][보관]`, 아래 줄이
  `입장 코드 · ABC123 · 유효기간 …… [전체 화면]`.
  예전에는 코드 칸이 이름표·코드·안내·유효기간·재발급 단추를 **세로로
  쌓아** 카드 하나가 232px이었습니다 — 반이 여섯이면 목록만 1,423px이라
  아래 반을 보려면 모달을 한참 굴려야 했습니다(실측 → 98px · 618px).
- **재발급은 코드 줄이 아니라 머리줄의 편집(✏) 옆**입니다. 반에 하는 일
  (이름 고치기 · 코드 새로 내기 · 보관)이 한자리에 모이고, 아래 줄은
  보기만 하는 줄이 됩니다.
  - 그래서 **재발급 상태는 `ClassManagerModal`이 듭니다**
    (`regeneratingCodeIds` · `handleRegenerateCode`). 단추가 머리줄과 전체
    화면 **두 곳**에 있어, 한쪽에서 누르는 동안 다른 쪽도 함께 잠겨야
    합니다. 보관 단추도 이 값을 봅니다(재발급 도중에 보관하면 코드가
    어긋납니다). `ClassJoinCode`는 이제 `onRegenerate`·`regenerating`만
    받아 그리기만 합니다.
  - 실패 안내도 모달 위쪽 `form-error` 한 곳으로 모읍니다 — 이름 바꾸기·
    보관 실패가 이미 서는 자리입니다.
- **'학생은 책방 입장 화면에서 아래 참여 코드를 입력합니다'는 목록 위에 한 번만**
  (`.class-mgr-section-hint`). 카드마다 적으면 반 수만큼 되풀이되는데,
  한 번 읽으면 그만인 말입니다. **전체 화면에는 그대로 둡니다** — 거기는
  칠판에 띄워 학생이 보는 화면이라 그 한 줄이 곧 할 일 안내입니다.
- **쌓인 배치는 전체 화면에 그대로 남습니다.** 두 화면이 `.joincode-*`
  클래스를 함께 쓰므로, 한 줄로 만드는 규칙은 **전부 `.class-joincode`
  아래로 한정**했습니다(그 껍데기는 카드 안에만 있습니다). 같은 클래스에
  직접 손대면 칠판 화면의 큰 글씨가 함께 무너집니다.
- **유효기간은 말줄임으로 자르지 않습니다** — 줄이 모자라면 제 줄로
  내려갑니다(`flex-wrap: wrap`). 한때 `text-overflow: ellipsis`로 두었다가
  480~640px에서 `⚠️ 만료된 코드예요 — 재발급해 주세요`가 **'⚠️ 만료된
  코드…'로 잘렸습니다**(실측) — 잘린 경고는 경고가 아닙니다.
- `.joincode-expand`('전체 화면')는 `position: absolute`를 걷고 **줄의 항목**
  이 되어 `margin-left: auto`로 오른쪽 끝에 섭니다.
- 480px 아래에서는 재발급 단추의 **글자만 접습니다**
  (`.class-mgr-regen-label`) — 단추가 셋이 되며 반 이름이 밀려 잘렸습니다
  (실측 340px 모달에서 '인공지능 기초 A'가 접힘 → 고친 뒤 온전함).
  `aria-label`은 그대로라 읽어 주는 기기에서는 달라지지 않습니다.
- 실측(모달 720px): 카드 98px · 코드 줄 43px · '전체 화면'이 줄 끝에서
  12px · 가로 넘침 0. 400px 모달에서는 유효기간이 제 줄로 내려가 149px.

### 책방 교사 화면은 다섯 다 세 칸입니다

- 닿소리 채우기(`BookGroupBoard`)의 **왼쪽 목록 · 가운데 판 · 오른쪽 진행**을
  곁텍스트·RAFT·KWLS·물음표로 책 읽기도 그대로 씁니다 — 뼈대도 CSS도 같은
  것입니다(`.book-workspace` · `.book-group-rail` · `.book-workspace-center` ·
  `.dash-side`). 다섯 활동의 교사 화면이 서로 다른 모양이면 교사가 화면마다
  다시 익혀야 합니다.
- **예전에는 셋이 학생 카드를 가로 격자로 깔았습니다.** 카드를 누르면 화면이
  통째로 그 학생의 상세로 바뀌어서, (ㄱ) 옆 학생으로 옮기려면 '← 학생 목록'
  으로 나갔다 다시 들어가야 했고 (ㄴ) 상세를 보는 동안 반의 진행 상황이
  화면에서 사라졌습니다. 목록을 왼쪽에 세우면 둘 다 풀립니다.
- 공용 조각은 둘입니다 — `BookStudentRail`(왼쪽) · `EntryProgressPanel`
  (오른쪽). **오른쪽 패널은 모둠 RAFT에만 섭니다**(`grouped` — KWLS · 물음표는
  모둠이 없어 늘 두 칸). 한때 늘 섰는데, 왼쪽 카드와 오른쪽 줄에 같은 뜻의
  조각 바가 두 벌 서 있어 오른쪽 것을 왼쪽 카드로 옮기고(선생님 요청)
  오른쪽은 '모둠으로 좁혀도 반 전체를 견주는' 일이 있을 때만 남겼습니다.
  - **곁텍스트는 모둠 활동이어도 오른쪽 패널이 없습니다**(선생님 요청 —
    왼쪽 카드의 조각 바로 상태를 이미 읽습니다). 두 칸입니다.
  - 왼쪽 카드의 조각 바는 **오른쪽 패널의 것을 클래스째 그대로** 씁니다
    (`.dash-heat` · `.dash-heat-cell` · `.entry-heat-cell--*` — 14칸 격자 ·
    높이 15px · 틈 2px · 칸 이름 툴팁 · 다 쓴 칸은 줄 색, 쓰는 중 주황, 잠김
    빗금, 다 채우면 마지막 칸에 붉은 점). **이 자리에만 덧대는 CSS를 두지
    마세요** — 한때 칸을 카드 폭에 늘여(flex) 그렸다가 오른쪽과 다른 모양이
    되어 되돌렸습니다(선생님 지적). 카드 전체가 여는 단추라 네모 줄은 span. 줄 색은 **반 전체
    차례**(`allCards`)로 매깁니다 — 모둠으로 좁힌 목록의 차례로 매기면 같은
    학생이 왼쪽과 오른쪽에서 다른 색이 됩니다.
  - **카드 한 장의 생김새도 오른쪽 패널의 한 줄 그대로**입니다(선생님 요청) —
    `● 학번 이름 …… n/N칸 · 글자 수`, 그 아래 **막대**(`.dash-progress-bar`,
    다 쓴 칸의 비율 · 줄 색을 옅게 푼 `barTint`), 그 아래 조각 바. 조각 바만
    옮겼을 때는 막대가 빠져 '얼마나 왔나'가 한눈에 안 들어왔습니다.
    - 격자는 `.book-rail-progress`(`minmax(0,1fr) auto`) — 오른쪽의
      `.dash-progress-list li`와 같은 두 칸입니다. 긴 이름은 말줄임.
    - `n/N칸`은 오른쪽과 같이 **'다 씀'만** 셉니다. 글자 수는 `extra`로
      넘깁니다(곁텍스트 ` · 436자` · RAFT/KWLS ` · 글 n자` — 오른쪽 패널과
      같은 말). 예전의 아래 줄(`n / N칸 · n자`, '아직 시작 전')은 머리 줄과
      같은 말이라 걷었습니다. **물음표 · 해시태그만** 칸 수로 못 하는 말이
      있어 아래 줄(`meta`)을 그대로 둡니다.
  - 활동이 넘기는 것은 **단계 정의(`rows`)와 칸 색(`cellState`)**
  뿐이고, 그 둘은 **전광판과 같은 것**을 씁니다(`lib/paratext.js`의
  `paratextRows`·`paratextCellState`, `lib/raft.js`, `lib/kwls.js`).
  한쪽만 고치면 같은 학생이 두 화면에서 다른 상태로 보입니다.
- **머리말 둘째 줄은 한 줄에 다 섭니다** — 주제어 배지 · 반 고르개 ·
  진행 요약(`시작 n명 · 완성 n명 / 전체 N명`) · (전광판) · (잠김 안내) ·
  동료 평가 여닫기. 배지 두어 개뿐이라 오른쪽이 늘 비어 있는데 진행 요약이
  아래에 제 줄을 차지하고 있었습니다(곁텍스트만 처음부터 이 줄이었고
  나머지 셋이 어긋나 있었습니다). 줄 하나가 줄면 그만큼 카드가 위로
  올라옵니다.
  - **전광판은 서는 자리가 둘입니다** — 모둠 칩이 있으면 그 줄 끝(모둠을
    다 지나온 자리), **칩이 없으면 이 머리말의 진행 요약 옆**입니다.
    KWLS는 모둠이 없고 곁텍스트·RAFT도 개인 활동이면 칩이 없는데, 그때
    단추 하나를 세우려고 줄 하나를 통째로 쓰고 있었습니다. 칩이 없으면
    `GroupFilterRow`를 아예 안 그립니다.
  - 이 줄에 설 때는 크기를 옆 배지에 맞춥니다(13px · padding 6/12) —
    제 줄에서 쓰던 12.5px · 6/14로 두면 2px 높아 줄이 어긋납니다.
- **제목은 늘 활동 이름입니다.** 예전에는 학생을 열면 제목이 학생 이름으로
  바뀌었는데, 그러면 지금 어느 활동인지 화면에 없습니다. 학생 이름은 가운데
  칸의 머리(`.entry-detail-head`)가 말합니다 — 왼쪽 목록의 켜진 카드만으로는
  약합니다.
- **구르는 것은 가운데 칸 하나**입니다(`.book-workspace-center`의
  `overflow-y`). 페이지가 통째로 구르면 왼쪽 목록과 오른쪽 패널이 함께 밀려
  올라가, 학생을 바꾸려면 도로 올라와야 합니다. 그래서 세 칸 안에서는 KWLS
  네 칸의 `min-height: 100vh`도 풉니다(안 풀면 늘 스크롤이 생깁니다).
- **가운데 칸 안의 배치는 `@container`로 접습니다** — 화면 폭 기준 미디어
  쿼리는 여기서 안 듣습니다. 창이 1900px이어도 양옆에 '오늘' 패널·학생
  목록·진행 패널·'멋진 순간'이 서면 가운데는 600px밖에 안 남는데, 미디어
  쿼리는 창만 보고 '넓다'고 판단합니다. 실제로 KWLS 네 칸이 130px씩으로
  짜부라져 '이미 알고 있는 것'이 한 글자씩 세로로 쪼개지고 가로 스크롤이
  생겼습니다. `.book-workspace-center`에 `container-type: inline-size`를 주고
  `@container (max-width: …)`로 접습니다(KWLS는 1000px에서 두 칸, 620px에서
  한 칸). 이 칸 안에 새로 여러 칸짜리 배치를 넣을 때는 **미디어 쿼리 말고
  컨테이너 질의**를 쓰세요.
- **RAFT의 다섯 칸은 두 칸 고정**입니다(`.raft-detail-grid`) — R·A 한 줄,
  F·T 한 줄, 글쓰기가 아래 한 줄(`.wide`). `.entry-detail-grid`의 `auto-fill`을
  그대로 두면 가운데 칸 폭에 따라 한 줄에 셋이 서다 둘이 서다 하고, 셋이 서는
  화면에서는 R·A·F 다음에 T 하나만 덩그러니 남아 네 요소가 한 묶음으로 안
  읽힙니다. RAFT는 개수가 넷으로 못 박힌 틀이라 폭에 맡길 것이 아닙니다.
  900px 이하에서는 한 줄에 하나(두 칸을 우겨 넣으면 글이 자꾸 접힙니다).
- 오른쪽 패널(모둠 활동)은 **모둠으로 좁혀 봐도 반 전체**를 셉니다(한
  모둠만 보면 견줄 대상이 없습니다). 왼쪽 목록만 모둠으로 좁힙니다.
- 색은 **줄 번호로**(`ROW_COLORS` 10색 되풀이). 이 학생들은 모둠 안 자리가
  없어 모둠 색을 쓸 수 없고, 붙어 있는 줄끼리만 달라도 충분합니다.
- **읽는 문서가 늘지 않습니다** — 보드가 이미 구독해 둔 `entries`를 그대로
  나눠 씁니다(닿소리 패널은 판마다 낱말을 따로 구독해야 했지만, 이쪽은 학생
  한 명이 문서 한 장이라 셀 것이 이미 손에 있습니다).

### 모둠 RAFT 교사 화면 — 왼쪽은 모둠 카드 (`RaftBoard`)

- **모둠 활동이면 왼쪽이 학생 카드가 아니라 모둠 카드**입니다(선생님 요청 — 학생마다의
  진행은 오른쪽 '학생별 진행'이 말합니다). 카드 하나에 모둠 이름 · `시작 n/N` · 모둠원
  **이름 알약**(`.raft-mate-pill`, 한 줄에 셋 — 닿소리 모둠 카드의 `.book-rail-chip` 그대로)이고,
  **알약을 누르면 가운데에 그 학생의 글**이 섭니다. 카드 자체는 누르는 자리가 아닙니다(div).
  알약은 다 쓴 학생 초록 · 지금 연 학생 살구.
- **모둠 칩으로 한 모둠을 골라 좁히면 알약 아래에 그 학생의 진행이 섭니다**(선생님 요청 —
  `.raft-mate-cell`): R·A·F·T 네 칸(쓴 칸 초록 · 빈 칸 회색 — 학생 카드의 네모
  `.paratext-mark`와 같은 값, 칸 이름은 툴팁) · 그 아래 `글 n자`(`raftWritingChars`).
  '전체'일 때는 안 답니다 — 모둠 여섯이 다 펼쳐진 목록이 그만큼 길어집니다. 읽기 0.
  그때는 **한 줄에 한 명**입니다(`.raft-mate-list` — 학생마다 흰 칸 하나에 이름 · R·A·F·T ·
  RAFT 한 문장(`raftSentence`, 한 칸도 안 정했으면 '아직 정한 요소가 없어요') · 글자 수가 한 줄씩,
  선생님 요청). 한 줄에 셋이면 네 칸 줄이 이름 폭에 끼어 옆 학생의 것과 이어져 보였습니다.
- 물러난 모둠은 빼고, 어느 모둠에도 없는 학생은 맨 뒤 **'모둠 없음'** 카드로 모읍니다.
  처음에는 아무도 안 고른 채 '왼쪽 모둠 카드에서 학생 이름을 눌러 주세요'.
- **모둠 칩 줄(전체 · n모둠 · 전광판)은 가운데 머리의 이름 · 학번 · 주제 옆**입니다(한때
  머리말 아래 제 줄). 학생을 고르기 전에도 그 머리는 칩만 담고 섭니다. 칩은 왼쪽 모둠
  카드를 그 모둠으로 좁힙니다(`shownRail`). **다른 모둠을 고르면, 가운데에 연 학생이 그 모둠에 없을 때 가운데를
  비웁니다**(`pickGroup`, 선생님 요청 — 왼쪽은 새 모둠인데 가운데에 옛 모둠 학생의 글이 남으면
  헷갈림). '전체'로 돌아갈 때는 그대로 둡니다.
- **입력 상황(`n / 4칸 · 글 n자`)은 '한 눈에 보기' 오른쪽**이고 둘은 한 덩이
  (`.entry-detail-tools`, 줄이 모자라면 함께 내려감).
- 한 눈에 보기 · 수업 화면 창의 '다음 학생' 차례는 **왼쪽 모둠 카드의 차례 그대로**입니다
  (`shownCards` = 모둠 카드의 모둠원을 차례로 이은 것).
- 개인 RAFT는 지금까지대로 학생 카드(`BookStudentRail`)입니다.
- **머리말 둘째 줄의 차례는 주제어(도서명) · 활동 열림/잠김 · 반 · 활동 모둠 · 동료 평가 · 진행 요약**
  (선생님 요청 — 무엇을 읽는 활동이고 지금 열려 있나가 맨 앞). 다른 활동의 교사 머리말도 같은
  차례로 맞췄습니다(주제어 배지가 없는 해시태그 · 가로세로 · 빙고는 열림/잠김이 맨 앞).
- 실측(임시 페이지, 3모둠 9명): 1440 · 1100px 가로 넘침 0 · 알약을 누르면 가운데에 그 학생 ·
  1100px에서 '한 눈에 보기 · 입력 상황'이 함께 다음 줄 오른쪽으로.

### RAFT 학생 화면 — 머리 한 줄 · 저장 상태는 카드마다 (`RaftForm`)

- 제목 아래 둘째 줄이 **주제어 배지 · 진행(`n / 4칸 · n자`) · 네 요소 문장**을 한 줄에
  담습니다(`.raft-summary`, 선생님 요청). 문장이 남는 가로를 받고, 좁으면 문장만 다음
  줄로 내려갑니다. 오른쪽 끝은 그대로 '도서 정보'. 한때 세 줄로 쌓여 카드가 그만큼
  내려앉았습니다.
- **'저장됨'은 머리줄이 아니라 고친 카드 머리에** 섭니다(`cardStatus` · `SaveMark`) —
  손댄 칸만 '저장 중…' → '저장됨'(실패하면 '저장 못 함'). 저장은 지금처럼 문서 한 장을
  통째로 쓰고(0.9초 모아서), 그 저장에 실린 칸들만 표시가 바뀝니다. 저장하는 사이에
  다시 고친 칸은 다음 저장이 정합니다.
- 잠긴 활동의 '잠김'은 머리 줄에 그대로 둡니다(저장 상태가 아니라 활동의 상태).
- 곁텍스트 · KWLS · 물음표 · 해시태그 학생 화면의 머리줄 저장 표시는 아직 그대로입니다.

### RAFT 교사 피드백 메모 — 형광펜 + 「피드백 n개」 목록 (`entries/{uid}/raftFeedback`)

배움나눔(class-peer-qna `eaa1900` · `ca1dc62` · `0bb7da8`)에서 가져왔습니다. 교사가 학생 글쓰기 칸에서 **피드백할 부분을 드래그하면 형광펜이 칠해지고 메모 창**이
열립니다. 저장한 메모는 **박스 바깥 위쪽, `글 n자` 알약 바로 왼쪽의 「피드백 n개」 단추 하나**가 셉니다
(`RaftFeedbackButton` · `IconQuizMemo`, `.raft-outside-tools`, 교사 · 학생 같은 자리). 누르면 **메모 목록**
(`RaftFeedbackList` — 팝오버, 줄마다 번호 · 칠한 부분 한 줄 · 메모 글 전부)이 열립니다. 글 위에 떠 있지
않아 내용을 가리지 않습니다. 학생은 **읽기만** 합니다.
  - 목록에서 한 줄을 누르면 — **교사**: 목록이 닫히고 그 형광펜으로 굴러가 그 메모의 창(고치기 · 지우기)이
    열림(형광펜이 없으면 단추 옆) · **학생**: 목록은 그대로, 그 형광펜을 짚어 줌(짙은 노랑 · 그리로 굴러감).
  - 한때 메모마다 번호 붙은 아이콘(📝1 📝2 …)을 늘어놓았는데, 많아지면 줄이 넘쳐 위 칸(F · T)에 얹혀
    단추 하나로 모았습니다(선생님 요청). 그보다 전에는 그 아이콘들이 칸 머리 '수업 시작' 왼쪽이었습니다.
  - 칸 머리에는 제목 · '수업 시작'(학생은 '새 피드백' 알약 · 저장 표시)만 남습니다.
  - 조각은 `components/RaftFeedback.jsx`(`RaftFeedbackText` · `RaftFeedbackButton` · `RaftFeedbackList` ·
    `RaftFeedbackPopover`), 셈은 `lib/raftFeedback.js`(시험 `tests/unit/raftFeedback.test.mjs`).

- **피드백을 남길 때 교사가 활동을 잠가** 학생이 글을 못 고치게 하는 것이 약속입니다(선생님 결정 —
  그래서 '고친 글에 자리 맞추기'는 두지 않음). 교사 칸 아래 안내 줄도 그렇게 말합니다. 그래도
  자리 찾기는 한 번 봅니다(`locateFeedback` — 그대로면 거기, 아니면 같은 글을 가장 가까운 데서,
  없으면 형광펜 없이 메모만).
- **글자 차례(start · end)는 다듬지 않은 원문의 차례**입니다 — 교사 칸도 원문을 그립니다(예전에는
  `trim()`한 글을 그려 앞 빈칸만큼 어긋났을 것). 드래그한 범위는 `Range.toString()` 길이로 셉니다 —
  형광펜(`<mark>`)이 섞여 있어도 글자만 잇고, 번호는 `::after`라 셈에 안 섞입니다. 앞뒤 빈칸은
  걷습니다(`trimFeedbackRange`).
- **겹쳐 칠하지 못합니다**(`feedbackOverlaps` — '이미 메모가 있는 부분이에요'). 맞닿는 것은 됩니다.
- 메모 창(팝오버, `lib/popover.js` · body에 포털 · z 320): 위에 칠한 부분(인용) · 교사는 글 칸 ·
  저장 · 취소 · '메모 지우기'(되묻기는 창 안에서). **고쳐 쓰던 글이 있으면 바깥 · Esc로 안 닫힙니다**
  (취소 · ×로 닫음). 형광펜을 누르면 그 메모로 옮겨 갑니다. Ctrl/⌘+Enter = 저장.
  새 범위는 형광펜(`mark[data-fid="__new"]`)이 그려진 뒤 그 요소에 창을 붙입니다.
- 번호는 글 차례(`placeFeedbackNotes`) — 앞에 메모를 더하면 뒤 번호가 밀립니다.
- **학생 화면**: 피드백이 있고 활동이 잠겼으면 글이 형광펜과 함께 읽기 화면(형광펜을 눌러도 메모가
  열림), 잠기지 않았으면 지금처럼 쓰는 칸이고 메모는 「피드백 n개」 목록으로 읽습니다. 모둠 친구가 내 글을 읽는
  창 · 수업 화면 방송에는 피드백을 싣지 않습니다(학생 한 명에게 남기는 말).
- **새 피드백** — 메모마다 `rev`(교사가 저장할 때마다 +1, 처음 1)와 `seenRev`(학생이 마지막으로 본 rev).
  `rev > seenRev`면 새것(`isRaftFeedbackNew`): 학생 칸 머리에 빨간 알약 `새 피드백 n` · 「피드백 n개」
  단추에 빨간 `새 n` · **상단바 알림 벨**(`raft_feedback` — '내 글'(칠한 부분) · '선생님 피드백' 칸, 누르면
  `/books?activity=<id>`). 학생이 **목록을 열면 모든 메모가** `seenRev = rev`(메모 글이 다 보이므로 — 다만
  그 목록 안에서는 새것이던 줄에 '새 피드백' 표시를 남겨 둠), 형광펜으로 메모 하나를 열면 그 하나, 벨의
  '읽음'도 그 하나. 교사가 고치면 다시 새것.
  '읽은 때'를 학생 기록(`entries`)에 두지 않은 까닭: 잠긴 활동에서는 학생이 그 문서를 못 씁니다.
- 자료 `bookActivities/{aId}/entries/{학생 uid}/raftFeedback/{자동 id}`
  `{ activityId, studentUid, start, end, quote, text(500), rev, seenRev, byUid, createdAt, updatedAt }`.
  규칙: 읽기는 그 학생 · 담당 교사, 만들기 · 고치기 · 지우기는 담당 교사(모양 못 박음 · rev 1로 시작 ·
  고칠 때 +1 · seenRev는 못 건드림 · `byUid`는 제 uid), 학생은 `seenRev = rev` 한 칸만(잠긴 활동에서도).
  알림 벨은 `collectionGroup('raftFeedback') where studentUid == 나` — 컬렉션 그룹 읽기 규칙과
  색인(`firestore.indexes.json`의 `raftFeedback.studentUid`)이 있습니다. 시험 `tests/rules/raftFeedback.test.mjs`.
  **색인 → 규칙 → 앱 차례로 배포하세요** — 규칙이 없으면 교사 저장이 권한 오류, 색인이 없으면 알림 벨의
  피드백만 빈 채입니다(나머지 알림은 그대로).
- 교사는 가운데에 연 학생 하나의 메모만, 학생은 제 것만 구독합니다. 휴지통의 완전 삭제가 메모도 지웁니다
  (학생 기록을 지우기 전에 — 하위 컬렉션은 함께 안 지워짐). 학생 탈퇴(`withdrawStudent`)도 그 학생의
  RAFT 기록을 지울 때 메모를 먼저 지웁니다.
- 실측(데모 1440px, 임시 페이지): 드래그 → 노란 형광펜 · 창 → 저장 · 둘째 메모를 앞에 달면 번호 1 · 2로
  다시 매김 · 고침 · 지우기 · 겹치는 드래그는 안내만 · 여러 마디에 걸친 드래그도 인용이 그 글 그대로 ·
  학생(잠김): `새 피드백 1` · 벨 1 → 메모를 열면 0 · 메모 창에 글 칸 없음 · 1440 · 420px 넘침 0.
  목록(메모 넷 · 둘이 새것): 교사 '피드백 4개' → 목록 넷 → 셋째 줄 → 목록 닫히고 '유리 덮개' 형광펜에 창 ·
  학생 '피드백 4개 새 2' → 목록에 '새 피드백' 둘 · 단추 · 머리 알약은 곧바로 꺼짐 → 줄을 누르면 그 형광펜이
  짙어지고 목록은 그대로 → Esc로 닫고 다시 열면 '새 피드백' 0 · 420px에서 목록 360px · 넘침 0.
- **책봄에서 다른 것**:
  - 글자 수 알약(`글 n자`)도 함께 박스 바깥 위쪽으로 옮겼습니다 — 책봄 학생 화면은 칸 머리에 `n자`,
    교사 화면은 칸 머리에 글자 수가 없었습니다. 둘 다 `[피드백 n개][글 n자]` 한 줄(`.raft-outside-tools`)입니다.
  - 스타일은 `app/styles/42a-raft-crossword-signup.css` 끝(배움나눔 `37-raft.css`의 같은 규칙).
  - 알림 벨은 책봄도 반 공지 · '내 생각은요' 댓글과 함께 피드백 줄을 받습니다. 다만 책봄의 벨은 **실서비스에서만**
    섭니다(`TopNav`의 `isFirebaseConfigured`) — 데모 반에서는 단추의 '새 n' · 칸 머리 알약으로 확인하세요.
  - 분석 리포트의 '받은 피드백'에 선생님 피드백 메모가 한 줄씩 듭니다(`lib/dashboard.js`의 `feedbackProjection`,
    서버는 RAFT 활동의 학생 기록마다 `entries/{uid}/raftFeedback`를 읽음 — `lib/server/dashboardService.js`).
  - 데모 반 — 첫 학생(30101)의 RAFT 글에 메모 둘(하나는 새 피드백, `makeRaftFeedback`). 데모 RAFT는 잠기지 않아
    학생 화면은 쓰는 칸 그대로이고, 메모는 「피드백 n개」 목록으로 읽습니다.

### 한 눈에 보기 — 한 학생이 쓴 것을 큰 창에서 (`EntryOverviewModal`)

- 곁텍스트 · RAFT · KWLS · 물음표 교사 화면의 가운데 칸 머리(`.entry-detail-head`)
  **오른쪽 끝의 '한 눈에 보기'**(선생님 요청). 고른 학생이 쓴 것을 **영역마다 카드
  한 장**으로 큰 창(1120 × 840px)에 펼치고, 아래 **← 이전 학생 · 다음 학생 →**
  (키보드 ← →)로 **왼쪽 목록의 차례 그대로** 넘깁니다(모둠으로 좁혀 두었으면 그 안에서).
- **읽기만 합니다** — 방송 · 과일은 없습니다(그것은 수업 화면 창의 일). 넘기면 뒤의
  화면도 따라와(`onPick` = `setOpenUid`) 창을 닫으면 그 학생이 열려 있습니다.
- 카드 내용은 **보드의 방송 꾸러미(`buildPayload`)를 그대로** 받습니다 — 칸 이름 ·
  물음 · 글이 칠판에 뜨는 것과 같아야 해서입니다. 보드가 넘기는 것은 `sectionsOf`
  (영역마다 꾸러미 + `wide`) · `summaryOf`(머리줄 요약) · `leadOf`(RAFT 문장)뿐.
  - 두 열 격자, `wide`인 카드(RAFT 글쓰기 · 물음표 두 영역 · 곁텍스트 제목 단계 — 칸이 다섯이라)는 가로를 다 씁니다.
    꾸러미의 `columns: 2`(물음표)는 칸을 둘씩 나란히.
  - **RAFT는 카드가 글쓰기 하나뿐**입니다(선생님 요청) — 네 요소는 위의 한 문장
    (`leadOf` → `raftSentence`)이 담으므로 R·A·F·T 네 칸 격자를 걷었습니다(같은 말의
    되풀이). 카드가 하나라 바로가기 칩 줄도 안 섭니다.
  - **모둠 RAFT는 글쓰기 카드 아래에 '모둠 친구들이 남긴 한 마디'**가 섭니다(선생님 요청 —
    `footOf` → `PeerReviewRow`). 카드는 **한 줄에 나란히 같은 폭**이고, 많으면 줄을 접지 않고
    옆으로 구릅니다(카드 바닥 220px). 보드가 이미 구독한 동료 평가(`subscribeAllPeerReviews`)를
    그 학생이 받은 것만 걸러 씁니다(읽기 0).
    - **모둠 친구마다 자리를 미리 깝니다**(선생님 요청) — 그 학생이 든 모둠(물러난 모둠
      제외)의 친구(지금 명단에 있는 사람 · 본인 제외)마다 이름이 선 카드 한 장, 아직 안
      썼으면 점선 빈 카드에 '아직 남기지 않았어요'. 머리의 수는 `쓴 n / 친구 N`. 모둠에서
      빠진 친구가 남긴 것은 뒤에 붙습니다(`PeerReviewRow`의 `mates`).
    실측(임시 페이지): 1440px에서 세 장 352px씩 같은 y · 420px에서 220px씩 옆으로 구름 · 문서 넘침 0.
  - 위의 칩 줄은 영역 바로가기(쓴 칸 초록) — 곁텍스트처럼 칸이 많을 때 굴리지 않고 짚습니다.
  - 760px 아래에서는 창이 화면을 다 쓰고 카드가 한 줄에 하나.
- **읽는 문서가 안 늡니다** — 보드가 이미 구독한 `entries`로 그립니다. 해시태그는
  가운데가 이미 슬라이드 한 장이라 이 단추가 없습니다.
- 실측(임시 페이지 1440 · 420px): 창 1120 × 828 · → 로 다음 학생 · Esc로 닫힘 ·
  빈 칸은 '비어 있음' · 가로 넘침 0.

### 수업 화면 창 — 지금 띄우는 것을 교사도 (`CastStageModal`)

- 영역의 **'수업 시작'을 누르면 큰 창이 함께 열립니다.** 지금 학생 화면에
  떠 있는 그 내용을 교사도 보고, **같은 영역을 학생별로** 넘기며 그 자리에서
  과일을 줍니다. 곁텍스트·RAFT·KWLS 셋이 **같은 창 하나**를 씁니다 — 방송
  배관(`castCard`·`castIndex`·`step`)이 셋 다 같은 모양이라서요.
- **왜**: 교사 화면에 있던 것은 머리말의 방송 막대 한 줄(`CastBar`)뿐이라,
  칠판에 무엇이 떠 있는지 볼 수 없었고 **다음 학생의 같은 항목으로 넘길 길이
  아예 없었습니다** — 학생을 바꾸려면 왼쪽 목록에서 고른 뒤 그 영역의
  '수업 시작'을 다시 눌러야 했습니다(실제 신고).
- **축이 둘이고 주인이 다릅니다.**
  - **학생 축**(주인공) — 같은 영역을 학생별로. 창 아래 큰 단추 둘 + 키보드
    ← →. 툴팁이 **갈 학생을 미리** 적습니다(KWLS 크게 보기의 화살표와 같은
    방식).
  - **영역 축**(딸림) — 같은 학생의 다른 영역. `CastBar`가 하던 그것인데,
    창이 그 막대를 덮으므로 여기에도 작게 둡니다(12.5px).
  - **키보드는 학생 축에만** 겁니다. 한 번 눌러 둘이 함께 움직이면 어느 쪽을
    넘긴 것인지 알 수 없습니다(수업 화면의 슬라이드 넘기기와 같은 까닭).
- **넘기면 학생 화면도 함께 바뀝니다.** 이 창이 보여 주는 것이 곧 '지금
  띄우는 것'이라, 창에서만 넘어가면 창이 거짓말을 합니다. '미리보기'로
  갈라 두는 길도 있었지만, 그러면 지금 뜬 것과 고른 것을 수업 중에 둘 다
  머리에 둬야 합니다.
- **닫기(×·Esc·배경)는 수업을 끝내지 않습니다** — 창만 걷고 방송은 그대로
  둡니다. 닫아 둔 창은 지금 띄우는 자리의 단추(`수업 화면 보기`)로 다시
  엽니다. 창을 닫은 채 끝내려면 상단바 오른쪽 아래의 **'방송 종료' 알약**
  입니다(아래).
- **영역만 옮길 때는 창 상태를 안 건드립니다**(`castSection(card, i, openStage)`
  의 셋째 인자 — `step()`이 지금 상태를 그대로 물려줍니다). 닫아 둔 창이
  '다음 영역 →'에 되살아나면 닫은 뜻이 없어집니다.
- **끄는 단추는 둘입니다 — 창 안 오른쪽 아래 '수업 종료'와, 창이 떠 있든
  닫혀 있든 늘 상단바의 '방송 종료' 알약**(화면 오른쪽 아래, 창 바깥).
  한때 창이 떠 있는 동안 알약을 감춰 '늘 한 화면에 하나만' 두었는데
  (`lib/castPresence.js` — 걷음), 늘 그 자리에서 끄던 손이 창만 뜨면 길을
  잃었습니다(선생님 요청으로 되돌림). 알약은 z-index 3000이라 창의 배경
  (100) 위에 떠 곧바로 눌립니다 — 끄면 보드가 따라 내리고(아래)
  창도 함께 닫힙니다(실측).
  - 지금 띄우는 자리를 다시 누르면 **끄지 않고 이 창을 엽니다** — 그 단추는
    띄우는 동안 `수업 화면 보기`로 적힙니다(네 보드의 `castSection`·
    `castRegion`·`castStudent`가 `isCasting`이면 `setStageOpen(true)`만).
    예전에는 `useEntryCast`의 토글로 꺼졌습니다(훅의 토글은 그대로 두었지만
    네 보드는 이제 그 길로 안 들어갑니다).
  - **네 보드에는 방송 막대(`CastBar`)가 없습니다**('누구의 무엇을 띄우는
    중' 한 줄 — 걷음, 선생님 요청). 무엇이 떠 있는지는 창과 그 자리 단추의
    방송 점이 말합니다. **창이 없는 마인드맵만 그 막대를 그대로 씁니다.**
  - **알약을 다시 감추지 마세요.** 창이 떠 있는 동안이든, 방송 막대가 떠 있는
    동안이든 — 막대를 걷고 나서 감추는 표시만 남았을 때는 **창을 닫은 교사가
    끌 길이 없었습니다**(선생님 지적). 알약은 어느 화면에서든 방송을 푸는
    안전장치입니다.
  - **알약으로 끄면 보드도 따라 내립니다**(`useEntryCast`가 방송 문서를
    구독 — 문서가 있는 것을 한 번 본 뒤 없어지면 `target`을 비움). 알약은
    그 훅을 거치지 않고 문서를 곧바로 지우므로, 안 따라가면 보드가 여전히
    '띄우는 중'으로 보이고 **학생이 글을 고치는 순간 `useLiveUpdate`가 방송을
    다시 켭니다**. 실측: 켜기 → 창 닫기(알약 다시 섬) → 알약으로 끄기 →
    보드 `off`.
- 넘길 때 **뒤의 화면도 따라옵니다**(`setOpenUid`) — 창을 닫았을 때 그 학생이
  열려 있어야 방금 본 답을 이어서 읽습니다.
- **학생 축의 차례는 왼쪽 목록에 보이는 그대로**입니다(모둠으로 좁혀 놓았으면
  그 모둠 안에서). 지금 띄우는 학생이 그 목록에 없으면(다른 모둠을 띄운 채
  좁혔을 때) 반 전체로 되돌아갑니다 — 안 그러면 넘길 곳이 없습니다.
- **본문은 학생 화면과 같은 것**을 씁니다(`.entry-cast-body` ·
  `.paratext-read-field`). 교사가 보는 것이 곧 칠판에 뜬 것이어야 하므로 글자
  크기(19px)도 그쪽 것을 그대로 물려받습니다. 칠판용 `data-size` 클램프는
  **안 붙입니다** — 그것은 `.entry-cast[data-size]` 아래에만 걸려 있어
  창에서는 안 커집니다.
- 과일은 **그 학생 문서 한 건**만 구독합니다(`subscribeMyClassRewardCount`).
  반 전체 `rewards`를 받으면 학생을 넘길 때마다 스물몇 건이 따라옵니다.
  주는 길은 **델타**(`addStudentReward(+1)`) — 자리표의 낱개 주기와 같습니다.
- **`.modal`이 `max-width: 640px`으로 못 박아 두어** width만 키우면 안
  넓어집니다(실측 640 그대로였음). `max-width: 960px`을 함께 올리고,
  `.modal`의 `overflow-y`도 꺼서 **구르는 것은 본문 한 칸**뿐입니다 —
  머리줄과 학생 넘기는 줄은 늘 제자리에 있어야 손이 같은 곳을 짚습니다.
- **과일은 받는 학생 이름 바로 옆, 닫기(×)만 오른쪽 끝**입니다
  (`.cast-stage-close`의 `margin-left: auto`). 한때 둘을 한 묶음으로 오른쪽
  끝에 붙였는데, 창을 닫으려다 과일이 나갈 수 있었습니다(선생님 지적) —
  **둘을 다시 붙이지 마세요.** 이름 옆이라 누구에게 주는 단추인지도 곧바로
  읽힙니다.
- 닫기는 다른 창들과 같은 **`btn-close`**입니다. 한때 정의가 없는 `modal-x`를
  달아 브라우저 기본 단추(흰 상자 + 테두리)로 그려졌습니다.
- 실측(1280·700px): 창 960/700px · 과일은 `1 / 3` 바로 뒤 10px · 닫기는 창 끝
  · 가로 넘침 0.
- **창 크기는 영역과 상관없이 하나입니다** — 폭 960px · 높이 `min(780px, 88vh)`
  (선생님 요청). 영역마다 글 양이 달라 넘길 때마다 창이 늘었다 줄었다 했습니다.
  가장 긴 RAFT 글쓰기에 맞춘 높이이고, 모자라면 본문만 구릅니다. 같은 창을 쓰는
  곁텍스트 · KWLS · 물음표 · 해시태그도 함께 고정됩니다.
- **RAFT 글쓰기는 '한 눈에 보기' 카드 모양으로 띄웁니다**(선생님 요청) — 꾸러미에
  `look: "card"`를 싣고(`RaftBoard`의 `buildPayload`), 학생 방송 화면
  (`PresentationOverlay`)과 이 창이 둘 다 `components/EntryCastCard.jsx`를 그립니다:
  RAFT 문장 한 줄 → 카드(이름 · 글자 수 · 안내 · 글 칸). 클래스는 한 눈에 보기와 같은
  `.eov-*`이고, 글자 크기는 방송의 `data-size` 단계가 그대로 키웁니다(글 칸이
  `.entry-cast-body`를 함께 달고 있음). 동료 평가 한 마디는 **방송에 싣지 않습니다** —
  모둠 안에서만 읽는 글이라 반 전체 칠판에 띄우면 안 됩니다. R·A·F·T 네 칸은 그대로입니다.
  `look`을 모르는 옛 화면은 지금까지의 모양으로 그립니다(`mode`는 그대로 `entry`).
  실측(임시 페이지): 창 960×780(글쓰기 · R 둘 다) · 방송 1920 · 420px 가로 넘침 0.
  - **학생 방송 화면은 글 전체가 한 화면에 들도록 글자 크기를 잽니다**
    (`EntryCastCard`의 `fit` — 선생님 요청). 처음에는 다른 방송처럼 글 양으로 단계
    (`data-size`)를 정했는데, 433자 편지가 md(40px)로 잡혀 화면 아래로 잘렸습니다(실제
    신고). 지금은 카드가 방송 칸의 높이를 다 쓰고(`.entry-cast--fit`), 글 칸이 넘치지
    않는 가장 큰 크기를 16~64px 사이에서 반씩 좁혀 찾습니다(`--fit-size` · 창 크기가
    바뀌면 다시 잼). 16px에서도 넘치면(작은 화면) 글 칸 안에서 구릅니다.
    교사의 수업 화면 창은 fit 없이 그대로(창 본문이 구름).
    실측(임시 페이지, 433자): 1900×916 26px · 1280×720 17px · 넘침 0 · 짧은 글 64px ·
    1024×600 · 420px은 16px에 글 칸 안에서 구름 · 페이지 스크롤 0.

### 책방 전광판 — 곁텍스트 · RAFT · KWLS (교사)

- 세 활동 화면의 **모둠 고르는 줄 끝**(마지막 모둠 뒤)에 `전광판`.
  KWLS는 모둠이 없는 활동이라 그 줄에 단추 하나만 섭니다.
  **여러 단계 × 반 전체**를 한 격자로 엽니다 — 한 줄이 단계 하나, 한 칸이
  학생 한 명(가로 배치). 공부방의 `StudyProgressBoard`를 옮긴 것이라
  **격자도 CSS도 그대로** 씁니다(`.progress-grass`·`.grass-*`·
  `.progress-tip`) — 두 방의 전광판이 다른 모양이면 교사가 같은 것을 두 번
  익혀야 합니다.
- **껍데기는 `BookProgressBoard` 하나**입니다. 무엇이 한 줄인가와 칸 색을
  어떻게 고르는가만 활동이 넘깁니다 — `ParatextProgressBoard`(여덟 단계,
  '읽는중 전광판') · `RaftProgressBoard`(R·A·F·T + 글쓰기 다섯 줄,
  '글쓰는중 전광판') · `KwlsProgressBoard`(K·W·L·S 네 줄, '성찰중 전광판').
  활동이 늘어도 껍데기는 안 고칩니다.
- **RAFT는 다섯 줄 — 글쓰기를 빼지 마세요.** 넷은 계획이고 글쓰기가 결과물이라,
  넷만 보여 주면 '다 정해 놓고 아직 안 쓴 학생'이 다 한 것처럼 보입니다
  (학생 카드의 네모 넷이 실제로 그렇습니다 — 거기서는 아래 '글 n자'가 그것을
  말해 주지만 격자에는 그럴 자리가 없습니다). 글쓰기 줄만 '쓰는 중'이 있고,
  기준은 공부방이 이미 쓰는 `DONE_MIN_CHARS`를 그대로 씁니다 — 이 앱에서
  '충분히 썼다'는 선은 한 곳에만 있어야 합니다.
- **이름은 '모아 보기'가 아닙니다.** `모아보기`는 이미 다른 뜻입니다 —
  '한 칸에 대한 반 전체의 답을 한 화면에'(`StudyActivityWall`, 공부방 활동
  줄·`TeacherKwlPanel`·발표 오버레이·책방 모아보기 화면들). 띄어쓰기만 다른
  이름을 붙이면 두 기능이 섞입니다. 공부방과 같은 낱말인 **전광판**으로 뒀고,
  창 제목은 `공부중 전광판`과 짝이 되게 `읽는중 전광판`입니다.
- **반 전체를 보여 줍니다**(`cards`, `shownCards` 아님). 모둠을 다 지나온
  자리에 단추를 두는 까닭이 그것입니다. 모둠이 없는 활동에서는 칩 줄 없이
  그 단추만 섭니다(`GroupFilterRow`의 `trailing`).
- **단계 이름표는 한 줄입니다**(이름 · 상태 · 진행률). 아래에 물음(`prompt`)을
  한 줄 더 깔았었는데, 여덟 줄이 모두 말줄임으로 잘려 '무엇을 묻는지'는 어차피
  안 보이면서 격자만 두 배로 길어졌습니다. 물음은 마우스를 올리면 뜹니다.
  세 칸은 **px로 못 박습니다**(`17px 1fr 58px 38px`) — 줄마다 따로 선 격자라
  `auto`로 두면 `0/29`와 `26/29`, `표지`와 `참고문헌`이 저마다 다른 자리에
  섭니다. 이름 칸 폭은 활동마다 달라 `--head-w`로 넘깁니다(곁텍스트 168px ·
  RAFT 176px — 가장 긴 이름에 맞춘 실측값이라 이름을 늘리면 다시 재세요).
- **`.bookboard--nolock`(배지 없는 세 칸 — RAFT · 곁텍스트 · KWLS …)은 반드시 기본 규칙 뒤에.**
  특이도가 같아(0,2,0) 앞에 두면 기본의 네 칸이 이겨, 없는 배지 칸이 96px을
  차지한 채 이름 칸만 28px로 짜부라집니다(실제로 그랬습니다).
- **칸 색은 학생 카드의 네모(`.paratext-mark`)와 같은 값**입니다 —
  초록(다 씀)·주황(쓰는 중)·회색(시작 전)(곁텍스트의 빗금 '잠김'은 단계별
  열기와 함께 걷었습니다). 같은 화면에서 카드를
  보다가 격자를 여는데 색이 다르면 두 번 익혀야 합니다. 공부방에 없는
  '쓰는 중'이 여기 있는 까닭은 한 단계가 여러 칸인 것이 셋(제목 5칸 ·
  목차 3칸 · 머리말 2칸)이라 '반쯤 쓴' 상태가 실제로 자주 생겨서입니다.
  칸 상태를 고르는 차례는 공부방과 같습니다 — **쓴 것이 가장 세고**,
  그다음이 잠김.
- **학생 이름을 세로쓰기로 적습니다**(`.grass-name`). 공부방 전광판은 이름을
  아예 안 적고 툴팁에 맡기는데, 여기는 줄이 여덟뿐이라 이름 줄 하나를 얹을
  자리가 남고, 칠판에 띄워 함께 보는 자리라(마우스를 못 올립니다) 누구인지가
  화면에 적혀 있어야 합니다. 칸이 22px이라 가로로는 못 적습니다.
- **붙어 있는 칸(sticky)의 바탕은 그 모달의 바탕과 같아야 합니다.** 공부방의
  `.grass-act`는 크림색(`--bg`)인데, 이름 줄이 스물아홉 칸으로 늘어서니 그
  색이 칸마다 끊겨 머리줄이 아니라 **알약 스물아홉 개**로 보였습니다. 뿌리
  클래스 `.bookboard` 아래에서 흰색으로 덮습니다.
- **뿌리 클래스를 `.paratext-progress`로 짓지 마세요.** 그 이름은 이미 활동
  만들기 창들(`ParatextForm`·`RaftForm`·`KwlsForm`·`MindmapForm`)과 학생
  카드의 진행 배지가 쓰고 있어, 모달에 붙이면 창 전체가 `--primary-light`로
  물듭니다(실제로 겪었습니다 — 모둠 메모의 `.memo-list` 충돌과 같은 함정).
  `.book-progress`도 피했습니다 — `.book-progress-legend`·`-done`·`-sum`이
  이미 따로 있어, 뿌리로 쓰면 그것들이 이 모달의 자식처럼 읽힙니다.
- **출석은 안 봅니다.** 공부방 전광판의 '오늘 결석' 색을 여기 두려면 이
  화면이 출석 기록을 새로 구독해야 하고, 곁텍스트는 여러 차시에 걸쳐 채우는
  활동이라 '오늘 결석'이 빈칸의 이유가 되지도 않습니다.
- **읽는 문서가 늘지 않습니다** — 단계별 인원도 완성 인원도 두 보드가 이미
  구독해 둔 `entries`로 셉니다.

### 마인드맵 — 노드마다 글자 · 이미지

- 노드 하나에 **글자(`text`)와 그림 한 장(`image`)**을 둘 수 있습니다. 둘 다,
  글자만, 그림만 모두 됩니다(그림만 있으면 '내용을 적어 주세요'를 안 그립니다).
  자료는 `bookActivities/{id}/entries/{uid}.answers.nodes[]` 그대로이고
  `image`는 **주소 한 줄**입니다 — 파일은 Storage(`uploadImage`, 폭 640px ·
  품질 0.8), 데모 모드는 data URL. **규칙을 안 건드립니다**(entries는 필드
  목록을 못 박아 두지 않았습니다 — 확인함).
- **미리보기는 어느 층이든 같은 크기 120×90**입니다(`.mm-node-img`,
  `object-fit: cover`로 가득 채워 자름). 층마다 글자 크기가 달라도 그림
  크기까지 달라지면 그림이 중요도처럼 읽힙니다. 값은
  `lib/mindmap.js`의 `MINDMAP_IMAGE_W`·`_H`와 **같아야** 합니다.
- **방사형·계층형 모두 실제 노드 크기로 가지의 공간을 확보합니다.**
  `MindmapCanvas`가 확대 배율과 무관한 `offsetWidth`/`offsetHeight`를 재고
  `layoutPositions(map, { nodeSizes })`에 전달합니다. 실측 전에는
  `mindmapNodeSize`가 글 줄바꿈·그림 크기를 추정합니다. 계층형은 깊이별 열을
  맞추고, 방사형의 하위 형제는 같은 바깥쪽 열에 위아래로 놓습니다. 자식의
  y를 부모와 같게 강제하거나 같은 자리에 새 형제를 만들지 마세요.
  기존 저장 좌표는 그릴 때 안전하게 보정하며, 열람만으로 다시 저장하지
  않습니다. 크기·줄바꿈·겹침 회귀 시험은 `tests/unit/mindmap.test.mjs`입니다.
- **간격은 개별 노드를 위아래로 끌어 조절합니다.** 일괄 세로 간격 슬라이더는
  사용하지 않습니다. 노드별 `radialOffsetY`·`treeOffsetY`에 형태별 조절량을
  저장하며 부모의 이동은 자손에게 이어집니다. 형제의 순서만 바꾸거나 전부
  같은 간격으로 다시 정렬하면 안 됩니다. 겹치지 않는 이웃의 위치는 유지하고
  충돌한 가지에만 최소한의 보정을 적용합니다. 드래그 시작의 조절량에
  `화면 이동량 / zoom`을 더해야 첫 움직임이 튀지 않습니다. 방송 꾸러미와
  `PresentationOverlay`의 지도 서명에도 두 조절량을 포함합니다. 이전 기록의
  `verticalGap`은 호환용으로 읽되 편집 UI로 다시 노출하지 않습니다.
  손을 뗄 때 충돌 보정으로 바뀐 표시 위치를 조절량에 정착시켜야, 다음에
  다시 끌 때 보이지 않는 이전 좌표에 붙잡히지 않습니다. 이때 원문·그림·
  관계·다른 형태의 조절량과 화면상의 위치는 유지합니다.
- 연결선은 `lib/mindmapEdges.js`에서 실제 상자의 측면 중앙을 잇는 완만한
  곡선으로 계산합니다. 왼쪽 자식은 오른쪽 면, 오른쪽 자식은 왼쪽 면에
  연결하고 부모도 자식을 향한 측면을 사용합니다. 중심끼리 선을 그려
  상자에 가리는 방식은 위아래 이동 시 위·아래 모서리로 선이 붙으므로
  사용하지 않습니다. 모든 깊이에서 같은 계산을 쓰며 라벨도 보이는 곡선의
  길이 기준 가운데에 둡니다.
- 노드 입력칸의 키 이벤트는 바깥 노드의 선택 단축키로 올리지 않습니다.
  입력칸에서 누른 Space를 부모가 `preventDefault`하면 띄어쓰기가 사라집니다.
  바깥 노드는 `target === currentTarget`일 때만 Enter/Space를 처리하고,
  입력칸은 한글 조합 중 Enter/Escape(`isComposing` 또는 229)로 닫지 않습니다.
  표시 글자는 `white-space: pre-wrap`으로 저장된 공백을 유지합니다.
- 넣는 길은 셋입니다 — **고른 노드 모서리의 그림 단추**(`.mm-node-imgbtn`) ·
  **아래 막대의 '이미지 넣기'**(있으면 '바꾸기 · 빼기') · **글자 칸에 그림을
  붙여넣기**.
  - 모서리 단추가 있는 까닭: 판이 화면 높이를 거의 다 써서(`100vh - 300px`)
    **막대가 화면 밖에 있기 쉽습니다** — '노드를 눌러도 이미지 넣기가 안
    생긴다'는 신고가 그것이었습니다(실측 1400×900에서 막대가 900px 아래).
    단추는 노드 **안에** 두어 판을 옮기고 키워도 따라가고, 누름이 노드의
    끌기·더블클릭으로 번지지 않게 막습니다(`onNodePointerDown`이 비켜 감). 올리는 동안은 그 노드에 같은
  크기의 점선 틀('올리는 중…')이 서고, 끝나면 **그 순간의 판**(`mapRef`)에
  붙습니다 — 올리는 사이에 학생이 가지를 더해도 날아가지 않습니다.
  이미지가 아닌 파일은 막대에 까닭을 적고 올리지 않습니다.
- 그림은 `pointer-events: none`입니다 — 그림 위에서도 노드의 더블클릭·
  우클릭·끌기가 그대로 먹어야 합니다(안 끄면 끌 때 그림만 끌려 나옵니다).
- **노드 끌기는 왼쪽 단추로만**입니다(`onNodePointerDown`의 `e.button !== 0`).
  맥의 Ctrl+클릭도 우클릭이라(단추 값은 왼쪽 0으로 옵니다) `e.ctrlKey`로 함께 거릅니다.
  한때 오른쪽 단추(우클릭 = 글자 고치기)도 끌기를 시작해 포인터를 붙잡았고,
  누르는 사이 손이 조금만 움직여도 노드가 딸려 오며 그때마다 판을 다시
  저장했습니다(실측 — 오른쪽 단추로 60px 끌면 노드가 옮겨 감 → 고친 뒤 제자리).
- **그림 고르기 창의 `accept`는 `IMAGE_ACCEPT`**(`lib/image.js`)입니다 —
  `image/*`로 적지 마세요. 윈도 크롬은 와일드카드를 받으면 등록된 이미지
  확장자를 레지스트리에서 전부 훑어 파일 형식 목록을 만드느라 창이 뜨기까지
  몇 초씩 걸립니다('이미지 단추를 누르면 화면이 죽은 것 같다'는 신고). 앱 안의
  그림 고르기(마인드맵 · 해시태그 대표 이미지)가 이 값을 함께 씁니다. 이 컨테이너(리눅스)에서는 그 지연이 재현되지 않습니다.
- **학생 판 위의 한 줄**(`.mindmap-toolbar`) — 방사형 · 계층형 · 그 형태의
  설명 · `방사형 · 가지 n개 · n단계`(+ 저장 상태)가 **한 줄**입니다. 가지 수
  줄(`statusLine`)은 카드 화면에서는 머리말에, 판을 연 뒤에는 이 줄 끝에
  섭니다 — 머리말에 따로 한 줄을 차지하던 만큼 판이 위로 올라옵니다.
  `.book-seg`는 접히는 줄(`flex-wrap`)이라 그대로 두면 두 단추가 위아래로
  쌓였습니다(실제 신고) — `.mindmap-layout-seg`에서 `nowrap`으로 막습니다.
  실측: 700~1920px 한 줄(36px) · 가지 수는 줄 오른쪽 끝 · 420px에서만 가지
  수가 둘째 줄로 내려감 · 가로 넘침 0.
- **빠진 그림은 Storage에서도 치웁니다**(`MindmapForm`의 `edit` — 고치기
  전후의 `mindmapImages`를 견주어 `deleteUploadedFile`). 빼기 · 바꾸기 · 그
  노드(와 딸린 가지)를 지우기가 다 여기로 옵니다. 서버에서 들어온 값으로
  판을 갈아 끼울 때는 안 지웁니다.
- **교사 화면(`MindmapBoard`)도 이미지를 넣지만 Storage에 올리지 않습니다** —
  그 판의 편집은 저장되지 않는 임시라, 올리면 파일만 주인 없이 남습니다.
  그래서 `readImageAsDataUrl(file, 480)`로 **이 화면 안에서만** 읽어 씁니다.
  방송 문서에 실려 가므로 폭 480px(JPEG)로 줄여 문서 한도(1MB)를 비켜 갑니다.
  한때 교사에게는 이 길을 아예 안 줬는데, 교사가 시험해 보다 '안 된다'로
  읽혔습니다. 학생이 넣은 그림은 교사 판·방송 화면에 그대로 보입니다.
- 방송 꾸러미에도 `image`를 싣고(주소뿐), 학생 쪽 오버레이는 글자 없이
  그림만 있는 노드도 '보여줄 내용'으로 셉니다.
- 저장된 주소는 `safeNodeImage`로 거릅니다 — https 주소와 이미지 data URL만.
  방송으로 남의 화면에 그려지는 값이라서요.

### 내 생각은요... — 영역 위에 붙이는 메모판 (`opinionNotes`)

- 책방의 여섯째 독서 활동(`type: 'opinion'`). 교사가 판을 **영역 1~5개**로
  나누고(찬성 · 반대 · 잘 모르겠어요…) 학생이 포스트잇 같은 메모에 제 생각을
  적어 붙입니다. **반 전체가 서로 다 읽습니다** — 그것이 이 활동의 전부라,
  개인 활동(`entries` — 본인·교사만)과 갈라 `BOOK_SHARED_TYPES`로 둡니다.
  모둠도 entries도 없습니다(`groupCount` 0, `groupMode` 'solo').
- **만들기 창은 '영역 개수'(1 · 2 · 3 · 4 · 5, `OPINION_ZONE_COUNTS`)를 먼저 고르고, 그
  아래 이름 칸이 그 수만큼 섭니다**(선생님 요청 — 한때 ＋/× 로 하나씩 더하고
  뺐습니다). 늘리면 빈 칸이 뒤에 붙고 줄이면 뒤 칸이 빠집니다(앞의 이름은 그대로).
  개수 고르개는 '학생 메모'와 한 줄(`book-field-row`), 이름 칸은 **고른 수가 한 줄에
  같은 폭**(`.opinion-zone-inputs--row` — 판의 영역 차례와 같게, 768px 아래에서는
  한 줄에 하나). 천장은 `OPINION_ZONE_MAX`(5) 한 곳이고 빈 이름은 'A~E 영역'.
  한때 천장이 4였는데 선생님 요청으로 5로 올렸습니다 — **다섯도 한 줄**입니다.
  **규칙을 안 건드립니다**(zones 개수를 규칙이 안 봄). 편집 창은 이름만 고칩니다.
  - **한때 2~6개로 늘리고 판을 두 줄(4개 2×2 · 5개 2/3 · 6개 3×2)로 짰다가
    되돌렸습니다**(선생님 요청 — 판은 늘 한 줄). **두 줄 판을 되살리지 마세요.**
    그 사이(배포된 동안)에 5~6개로 만든 활동은 지금 앞의 다섯이 보이고, z6에 붙은
    메모는 첫 영역으로 갑니다(`normalizeZones` · `zoneOfNote`).
  - 실측(데모 1600px): 2 · 3 · 4개 이름 칸이 같은 y 한 줄(418 · 276 · 205px) · 넘침 0.
  - **영역 하나도 됩니다**(선생님 요청 — `OPINION_ZONE_MIN` 1). 영역 구분 없이 반 전체가
    한 판에 붙이는 메모판입니다. 빈 값을 손질할 때도 이제 한 칸만 채웁니다.
  - **'영역 개수' 다섯 단추는 아래 줄 '판 모양'과 같은 폭**입니다(`.book-seg--zones` —
    다섯 칸 격자 · 천장 `180px × 2 + 6px`, 판 모양 단추 둘의 천장과 같은 셈 · 선생님 요청).
    한때 그 규칙이 CSS에만 있고 화면에 연결되지 않아 `.book-seg--tight`(단추마다 72px)로
    짧게 끝났습니다(2026년 11월에 연결). **모둠 수 줄은 그대로 tight**입니다 — 그쪽은 옆
    칸이 접히지 않는 것이 먼저라서요. `.book-seg-btn`의 천장(180px)을 고치면 이 값도 함께.
    실측(데모): 1600 · 1280 · 420px에서 두 줄 모두 366px · 820px(두 칸 나란히)에서만 영역
    개수가 칸 폭 351px로 조금 짧음 · 가로 넘침 0.
- 활동 문서에 `zones: [{ key, name }]` · `prompt`(함께 생각할 물음, 80자).
  메모는 `bookActivities/{id}/opinionNotes/{noteId}`(자동 id — 한 학생이 여러
  장) `{ authorId, authorName, authorEmoji, anon, studentId(null), byTeacher,
  text, zone, x, y, color, createdAt, updatedAt, movedAt }`. 셈은 전부 `lib/opinion.js`(시험
  `tests/unit/opinion.test.mjs`).
  - **영역은 key로 짚습니다**(z1·z2…). 이름으로 짚으면 교사가 이름을 고치는
    순간 메모가 갈 곳을 잃습니다. '편집' 창은 **이름만** 고치고 개수는 못
    바꿉니다(영역을 없애면 거기 붙은 메모가 갈 곳이 없습니다).
  - **자리는 영역 안의 비율(0~1)**입니다 — 픽셀로 적으면 칠판에서 붙인
    메모가 크롬북에서 영역 밖으로 나갑니다. 영역은 **메모지의 가운데**가
    든 칸으로 정합니다(`placeFromPixels` · 거꿀셈 `pixelsFromPlace`).
  - 메모지 크기 176×142는 `OpinionBoard.jsx`의 `NOTE_W`·`NOTE_H`와 CSS의
    `.opinion-note`가 **같아야** 합니다(자리 셈이 그 값을 씁니다).
- **누가 무엇을 만지나** — 붙이기: 학생(잠기기 전) · 교사('선생님' 메모,
  `byTeacher`). 글·색 고치기: 쓴 사람만(잠기기 전). 옮기기: 쓴 사람 · **교사는
  아무 메모나**(칠판 앞에서 모아 정리). 떼어 내기: 쓴 사람(잠기기 전) · 교사.
  읽기: 반 전체. **교사 화면과 학생 화면이 한 컴포넌트**이고 갈리는 것은 이
  권한과 머리말(교사: `쓴 학생 n / N` — 지금 명단에 있는 학생만 셈)뿐입니다.
- **누르기와 끌기는 한 손짓** — 4px 넘게 움직이면 끌기, 아니면 크게 보기.
  못 옮기는 메모(남의 것)를 끌면 제자리에 두고 **창도 안 엽니다**(끌던 손을
  놓는 순간 창이 뜨면 이상합니다). 놓은 자리는 저장이 돌아올 때까지
  `pending`으로 붙들어 튀지 않게 합니다. 겹침 차례는 `movedAt`(방금 옮긴 것이
  위, 서버 시각 전의 null은 맨 위).
- **이름표는 늘 실명입니다**('30105 홍길동' — 책봄은 모든 활동이 실명, 선생님 결정).
  한때 익명 닉네임 + 동물 이모지였고 교사만 이름표를 눌러 실명을 봤는데(`NoteWho`의
  🔓 토글), 익명 기능과 그 토글을 모두 걷었습니다. **되살리지 마세요.**
  - 새 메모는 `real: true` · 학번 · 실명을 적습니다. 교사 메모는 '선생님'.
  - **익명 시절의 예전 메모**(`anon` · 표시 없음)는 적힌 닉네임을 쓰지 않고 **지금
    명단의 실명**으로 보여 줍니다(`noteAuthorLabel(note, profile)`) — 교사는 반 명단,
    학생은 명단이 없어 그 메모를 쓴 친구의 프로필만 한 번 읽습니다
    (`fetchClassRosterProfiles` — 급우 프로필 읽기는 규칙이 엶). 못 찾으면 '반에서 빠진 학생'.
  - 규칙(`noteIdentityOk`): 학생 메모는 `real: true`에 **제 학번 · 제 실명**이어야
    합니다(익명 · 닉네임 · 남의 이름 거부). 프로필에 학번이 없고 실명 칸이
    '20512김하윤'처럼 학번을 품은 계정은 앱이 둘로 갈라 적으므로 그 모양도 받습니다.
- **규칙을 새로 열었습니다**(`opinionNotes`) — 시험
  `tests/rules/opinionNotes.test.mjs`(17개). 글 500자(`OPINION_TEXT_MAX`와
  **같아야**) · 자리 0~1 · 교사는 `changedOnly(['zone','x','y','movedAt'])` ·
  학생은 `byTeacher`를 못 씀.
- **탈퇴 정리**: 학생 탈퇴(`withdrawStudent` — `lib/data/withdraw.js`)가 활동마다
  그 학생의 메모(`authorId ==`)를 지웁니다(메모에 학번·실명). 색인
  `opinionNotes.authorId`(COLLECTION_GROUP)는 알림 벨의 '내 생각은요' 댓글 알림이
  씁니다(`firestore.indexes.json`). 휴지통의 '완전 삭제'(`purgeBookActivity`)도 메모를
  함께 지웁니다.
- 판(`.opinion-board`)은 영역 하나에 **최소 200px**을 주고 모자라면 옆으로
  구릅니다. 창이 넓어도 양옆에 '오늘'·'멋진 순간' 패널이 서면 가운데가
  300px대로 줄어, 그대로 두면 메모가 옆 영역까지 걸쳤습니다(실측 1024px).
- **영역 바탕은 또렷한 색 다섯**입니다(선생님이 주신 그림의 색 — `ZONE_TINTS`
  차례 민트 #d5faf1 · 분홍 #f9dbdb · 연두 #e4fee0 · 살구 #fbeacc, 다섯째 하늘
  #ddedfc는 영역 다섯을 열 때 더함). 머리줄과 몸통이 같은 바탕이고, 영역 사이 · 머리줄 아래는 그 영역의
  진한 선(`--tint-line`, 2px 실선)입니다. 이름 알약은 흰 바탕에 그 선 색 테두리.
  한때 흰색에 가까운 위쪽 띠(`--tint-wash`)와 베이지 점선뿐이라 영역이 눈에 잘
  안 들어왔습니다(선생님 지적). 메모지는 그 위에 그림자로 떠 그대로 읽힙니다.
- 색은 파스텔 여섯(`OPINION_COLORS` — 버터·복숭아·딸기우유·민트·하늘·라벤더),
  이름표·핀·창의 짙은 글자는 같은 색의 `ink`. 메모마다 id로 정한 기울기
  (±2.4°, `noteTilt` — 난수면 구독이 올 때마다 흔들림)와 반투명 테이프 ·
  접힌 귀. 크게 보기 창은 **창 자체가 그 메모의 색**이고, 새로 쓸 때도 같은
  창입니다(쓰던 메모가 그대로 판에 붙는 것으로 보이게).
  - 바탕은 **흰색에 가깝게 옅습니다**(#fffae0 · #fff0e7 …). 처음 값
    (#fff4b8 · #ffdcc8 …)은 스무 장이 붙으면 판 전체를 물들여 글보다 색이
    먼저 읽혔습니다(실제 신고). 같은 key라 이미 붙은 메모도 저절로 옅어집니다.
- **학생 메모 수 — 영역마다 한 장 / 여러 장**(활동 문서의 `noteMode`,
  `single`·`multi`). `single`은 **영역마다** 한 장이라 다른 영역에는 또 씁니다
  (선생님 요청 — 한때 활동 전체에 한 장뿐이었습니다). 만들기 창과 '편집' 창에서 고릅니다(새로 만들 때 기본은
  한 장). 표시가 없는 옛 활동은 `multi`로 읽습니다(`opinionNoteMode`).
  - **한 장 모드의 학생 메모는 문서 id가 `uid_영역`입니다**(`addOpinionNote`의
    `single` → `setDoc(opinionNotes/{uid}_{zone})`). 한때 id가 uid 하나였고, 그때
    붙인 메모(id = uid)는 그대로 남아 제 영역 한 장으로 셉니다. 두 번 붙이면(두 번 누르기 ·
    창 두 개) 둘째가 같은 문서의 덮어쓰기가 되고, 그것이 작성자 update의
    `changedOnly`에 걸려 거부됩니다 — **규칙을 안 고치고** 한 장이 지켜집니다
    (시험 `tests/rules/opinionNotes.test.mjs`). 교사 메모는 늘 자동 id입니다.
  - 여러 장 → 한 장으로 바꿔도 **이미 붙은 메모는 그대로**이고, 메모가 있는 영역에는
    더 붙이지만 못 합니다. 판정은 `canAddOpinionNote` + `myZoneCount`(그 영역의 내
    학생 메모 수, 교사 메모는 안 셈). 쓰기 창의 영역 칩도 이미 쓴 영역은 꺼집니다.
  - **학생은 제 메모를 다른 영역으로 못 옮깁니다**(한 장 모드 — 끌어 놓으면 제자리로
    돌아가고 안내 한 줄, 고치기 창의 영역 칩도 지금 영역만). 옮긴 뒤 빈 영역에 또
    붙이면 한 영역에 두 장이 되고, id가 겹쳐 저장이 거부되기도 합니다. 교사는 그대로
    아무 메모나 옮깁니다. 그 영역에 붙인 학생에게는 그 영역 머리의 ＋가 **꺼진 채** 서고
    까닭은 툴팁입니다 — 단추만 사라지면 고장으로 보입니다.
- **판 위의 안내 줄은 걷었습니다**(선생님 요청) — '메모를 누르면 크게…'
  안내 · '학생 메모: 여러 장 자유롭게' · '＋ 메모 붙이기'. 붙이는 길은 영역
  머리의 ＋ 하나이고(그것이 어느 영역인지까지 정합니다), 메모 수 방식은 편집
  창에 있습니다. 교사가 **함께 생각할 물음**(`prompt`)을 적었을 때만 그 한
  줄이 판 위에 섭니다.
- **영역 이름은 비워 두고 예시는 안내 글로만**(`OPINION_ZONE_EXAMPLES` →
  placeholder '예: 찬성'). 한때 '찬성·반대'를 값으로 채워 두어, 다른 판을
  만들 때마다 지우고 다시 써야 했습니다(실제 신고). 비어 있으면 만들기가
  막힙니다.
- **판 모양 — 메모지 / 목록**(활동 문서의 `layout`, 만들기 창 · '편집' 창에서
  고름 · 표시가 없는 옛 활동은 메모지 — `opinionLayout`). 목록이면 **영역 머리의
  ＋가 쓰기 창**(메모지와 같은 `OpinionNoteModal` — 색 고르기만 감추고 단추가
  '제출')을 열고, 그 창에서 닉네임 · 글을 적어 제출하면 글이 그 영역 칸에 **올린
  차례대로** 한 줄씩 쌓입니다(`opinionListByZone` — `createdAt` 오름차순, 서버 시각
  전의 글은 맨 뒤). 줄을 누르면 같은 크게 보기 창이 뜹니다.
  - **판 위에 입력창을 따로 두지 않습니다**(선생님 요청 — 한때 `OpinionListComposer`가
    판 위 한 줄을 차지했습니다. 걷음).
  - **목록 판은 창 바닥까지 늘어납니다**(선생님 요청 — 고정 높이로는 영역이 중간에서
    끊긴 듯 보였습니다). `OpinionBoard`가 판이 선 자리를 재어 `--list-h`로 주고
    (판 테두리 · 페이지 아래 여백만큼 빼서 페이지 스크롤이 안 생김), 글이 더 많으면
    그만큼 더 깁니다. 실측(임시 페이지): 1440×900 · 1280×720 모두 문서 높이 = 창 높이.
  - **자료는 같은 `opinionNotes`**라 두 모양을 오가도 글이 그대로입니다 —
    목록에서 쓴 글도 자리(x·y)와 색(무작위)을 함께 적습니다. 줄의 왼쪽 선이 그 색.
  - 영역과 닉네임은 그대로 두고 글만 비웁니다(잇달아 쓰기 편하게).
- **이름표 방식 고르기(`nameMode` 익명/실명)는 걷었습니다** — 늘 실명이고 활동 문서의
  `nameMode`는 언제나 `real`입니다(위 '이름표는 늘 실명'). 쓰기 창의 닉네임 칸도 없습니다.
- 아직 없는 것(선생님께 제안함): 학급 화면 띄우기(방송) ·
  '아직 안 쓴 학생' 목록 · 영역별 모아 읽기 · 메모에 과일 주기.

### 물음표로 책 읽기 — 물음표 다섯 쌍 + 체크 + 나의 생각 한 칸 (`type: 'qmark'`)

- 책방의 여덟째 독서 활동. 종이 활동지를 옮겼습니다 — 학생이 책을 읽으며
  궁금한 곳에 물음표(?)를 붙여 두고(그 일은 화면 밖, 책 여백에서),
  ① 그 가운데 **중요한 물음을 다섯 칸까지**(`QMARK_ASK_COUNT` 5) 골라 쌍마다
  **궁금증 · 이유는**을 쓰고, ② 다섯 물음 가운데 **두 개 이상** 체크한 뒤,
  ③ 체크한 물음을 길잡이 삼아 **나의 생각을 한 칸에** 정리합니다. 다섯 물음 —
  나의 지식을 어떻게 넓혀 주었는가 · 읽은 내용을 어떻게 활용할 수 있을까 ·
  깨달은 나의 편견 · 가장 흥미로운 점과 그 이유 · 읽기 전·후 나의 생각은
  어떻게 달라졌는가(`QMARK_PROMPTS`, 선생님이 주신 글 그대로).
- **처음에는 물음 하나 · 체크한 물음마다 칸이 따로**였습니다. 선생님 요청으로
  물음표를 여럿 적게 하고, 생각은 물음마다 조각내지 않고 한 칸에 이어 쓰게
  바꿨습니다.
- **개인 활동이라 자리는 곁텍스트 · RAFT와 같은 `entries/{uid}.answers`**
  입니다(`saveParatextEntry` · `subscribeParatextEntries` 그대로) — **규칙 ·
  색인 · 저장 함수를 한 줄도 안 건드립니다**(모양 바꾸기도 마찬가지 — entries는
  필드를 못 박아 두지 않았습니다). 모둠은 없습니다(`BOOK_GROUPABLE_TYPES`에 안 듦).
  - `answers = { asks: [{ question, reason }], picks: [key…], thought }`.
    셈은 전부 `lib/qmark.js`(시험 `tests/unit/qmark.test.mjs`).
  - **옛 모양도 읽습니다**(`normalizeQmarkAnswers`) — `asks`가 없으면 옛
    `question`·`reason`을 첫 쌍으로, `thought`가 **문자열로 없으면** 체크해 둔
    물음마다 쓴 글(`knowledge`·`use`…)을 '물음 + 글'로 이어 붙입니다. **자료를
    미리 옮기지 않습니다** — 저장이 merge라 옛 칸은 문서에 남지만, 한 번
    저장하면 `asks`·`thought`가 생겨 그 뒤로는 옛 칸을 안 봅니다(학생이 생각을
    다 지워 빈 글이 되어도 옛 글이 되살아나지 않게 `typeof … === "string"`으로
    판정).
  - 물음표는 **처음부터 늘 다섯 쌍**입니다(선생님 요청 — 학생은 내용만
    적습니다). `normalizeQmarkAnswers`가 모자란 만큼 빈 쌍으로 채우고(옛 기록의
    한두 쌍도 제자리 그대로 + 뒤를 채움), 넘치면 자릅니다. **더하기 · 빼기
    단추가 없습니다** — 한때 '＋ 물음표 더하기'와 쌍마다 ✕(글이 든 쌍은
    되묻기)가 있었는데, 다섯 개를 다 만들면 왼쪽 열만 그 단추 줄만큼 길어
    오른쪽과 어긋났고, 늘리고 빼는 일 자체가 학생에게 할 일을 하나 더 얹었습니다.
    비워 둔 쌍은 어디서도 안 셉니다(완성 · 진행 칸 · 방송 · 교사 화면).
  - **쌍은 접었다 폅니다**(`openAsk` — 펼친 것은 하나, 선생님 요청). 접힌 줄은
    `▸ 물음표 n · 궁금증 한 줄 · 상태(비어 있음/쓰는 중/완성)`이고 **머리줄
    전체가 여닫는 단추**입니다. 처음에는 **아직 다 안 쓴 첫 쌍**을 펴고(다
    썼으면 모두 접힘), 머리의 개수는 **글이 든 쌍 수 / 5**입니다.
  - **왼쪽 접힌 줄과 오른쪽 물음 줄은 같은 높이**(`--qmark-row-h` 46px,
    테두리 포함)라 다섯 줄씩 나란히 맞고, 두 장은 `align-items: stretch`로
    바닥이 같습니다(쌍을 펴면 오른쪽 장도 함께 늘어납니다).
    - **두 열의 제목 줄은 한 줄로 못 박습니다**(`nowrap` + 딸림글 말줄임 ·
      전체는 툴팁). 왼쪽 딸림글이 길어 접히면 그 열만 줄이 내려앉고, 한글은
      글자마다 줄이 바뀔 수 있어 `white-space: nowrap` 없이는 제목('나의
      물음표')까지 두 줄로 쪼개졌습니다(실측 1100px에서 16~23px 어긋남).
  - 체크한 물음은 누른 차례가 아니라 **정해 둔 차례**로 저장합니다.
  - **완성**(`qmarkDone`) = 글이 든 물음표마다 궁금증 · 이유가 **둘 다** 있고
    (비워 둔 쌍은 안 셈), 두 개 이상 체크하고, 나의 생각을 쓴 것.
  - 글자 천장: 칸마다 2000(`QMARK_TEXT_MAX`), 나의 생각 6000(`QMARK_THOUGHT_MAX`).
- **학생 화면**(`QmarkForm`)은 ①｜② 두 열 — 왼쪽 ① 나의 물음표(쌍마다 옅은
  상자, 다 쓰면 초록), 오른쪽 ② 물음 고르기(체크 목록만 — 칸이 열리지 않음).
  ③ 나의 생각 정리는 **두 열 아래 가로를 다 쓰는 한 줄**입니다(선생님 요청 —
  두 열 어느 쪽에도 속하지 않는 마무리 자리). 체크한 물음을 위에 한 줄씩
  되풀이하고 그 아래 큰 칸. 접는 기준은 `.qmark-wrap`의 폭(`@container`
  860px). 체크는 진짜 `<input type="checkbox">`입니다.
  - **두 열은 같은 폭**입니다(`1fr 1fr` — 선생님 요청, 한때 `1 : 1.25`).
    실측(데모): 1600·1280·1100px에서 두 장 612·604·514px로 같고 높이도 같음 ·
    900px 아래 한 열 · 가로 넘침 0.
  - 위 안내 줄 ②의 말은 **'5개의 체크리스트에서 2개 이상 선택하세요'**
    (선생님이 고른 말 — 개수는 `QMARK_PROMPTS.length` · `QMARK_MIN_PICKS`에서).
    교사 화면·방송의 설명 글('다섯 물음 가운데 …')은 그대로입니다.
- **교사 화면**(`QmarkBoard`)은 곁텍스트 · RAFT · KWLS와 같은 뼈대(왼쪽
  `BookStudentRail` · 가운데 — 모둠이 없어 두 칸). 가운데는 두 장이 위아래로
  가로를 다 씁니다: '나의 물음표'(쌍마다 번호) · '나의 생각'(다섯 물음 가운데
  체크한 것은 ☑ 또렷하게, 안 고른 것은 ☐ 옅게 + 정리 글).
  - '나의 물음표'는 **한 쌍이 한 줄 — 궁금증 왼쪽 · 이유는 오른쪽**입니다
    (`.qmark-read-ask` 두 칸 격자, 가운데 세로선 — 선생님 요청). 위아래로
    쌓으면 다섯 쌍이 열 칸으로 늘어서 어느 이유가 어느 궁금증의 것인지 다시
    짝지어야 했습니다. 가운데 칸이 **560px 아래면**(`@container` — 창 폭 아님)
    위아래로 풉니다.
  - '나의 생각'도 **두 칸 — 왼쪽 체크한 물음(☑/☐ 다섯) · 오른쪽 정리 글**
    입니다(`.qmark-read-thought`, 같은 세로선 · 같은 560px에서 풂).
  - 실측(데모 1600px): 쌍마다 두 칸 279 · 279px가 같은 y · 나의 생각 두 칸
    292 · 292px · 가로 넘침 0.
- **수업 화면 창 · 학급 방송도 두 칸입니다** — 방송 꾸러미에 **`columns: 2`**를
  싣고(`buildPayload`), 두 화면이 그 값을 보고 칸 목록을 둘씩 한 줄로 그립니다
  (`.entry-cast-body--cols` — 한 규칙을 두 화면이 함께 씀). 물음표는 '궁금증 |
  이유는'이 한 줄, 나의 생각은 '고른 물음 | 나의 생각'이 한 줄입니다. 칸
  목록(`qmarkRegionFields`)의 모양은 그대로라 **그 값을 모르는 옛 화면은
  위아래로 그대로** 그립니다(`KNOWN_MODES`도 안 건드림).
  - **두 칸 방송의 글자 크기는 `md`가 천장**입니다(`PresentationOverlay`).
    짧은 답(`111`)을 글자 수만 보고 xl(120px)로 키웠더니 한 화면에 한 칸밖에
    안 들어와 무엇에 대한 글인지 알 수 없었습니다(실제 신고). 한 줄뿐이면
    (나의 생각) `md`, 여러 줄이면(물음표 다섯 쌍) `sm` — 두 칸 `sm`만 따로
    `clamp(17px, min(1.8vw, 3.1vh), 28px)`로 잡아 **다섯 줄이 한 화면에** 섭니다.
  - 상자는 `data-cols="2"`면 가장 작은 단계에서도 1300px(880px을 반으로 나누면
    한 칸이 400px 남짓이라 글이 자꾸 접힙니다). 760px 아래에서는 한 칸으로 풉니다.
  - 실측(임시 페이지, 1920×943): 물음표 다섯 쌍 620 · 620px · 28px · 스크롤 0 ·
    나의 생각 40px 한 줄 · 700px에서 한 칸 · 가로 넘침 0. 수업 화면 창(960px)은
    462 · 462px로 같은 모양.
- **진행 줄은 셋**입니다 — 궁금증 · 이유 · 나의 생각(`qmarkRows`). 물음표가
  여럿이어도 줄은 늘리지 않습니다(학생마다 개수가 달라 격자가 안 맞음).
  궁금증 · 이유 칸은 **글이 든 쌍 가운데** 다 채웠으면 초록 · 일부면 주황,
  나의 생각은 두 개 이상 체크 + 글이면 초록 · 하나라도 손댔으면 주황.
  전광판(`QmarkProgressBoard`)도 같은 줄이고 개수는 툴팁이 말합니다.
- **방송 영역은 둘로 못 박습니다**(`QMARK_REGIONS` — 나의 물음표 · 나의 생각).
  학생마다 물음표 개수가 달라도 '다음 학생 →'이 같은 자리를 짚어야 해서입니다.
  물음표 칸은 쌍을 모두(`궁금증 1 · 이유는 · 궁금증 2 …`), 나의 생각 칸은
  고른 물음 + 정리 글이고, 그 학생의 첫 물음을 `note`로 싣습니다(`외 n개`).
  방송 모양은 `mode: "entry"` 그대로이고, 두 칸으로 그리라는 `columns: 2`만
  덧붙습니다(위 교사 화면 절).
- **수업 중 내보내기(서랍)는 아직 없습니다**(`PUSHABLE_BOOK_TYPES`에 안 듦).
- 실측(데모 — 다섯 쌍으로 바꾼 뒤): 새 기록에 쌍 5 · 첫 쌍 펼침 · 단추 0 ·
  모두 접으면 1280 · 1100 · 960px에서 좌우 다섯 줄이 **y 좌표까지 같음**(46px씩) ·
  두 장 높이 같음(펼쳐도) · 셋째 쌍만 적으면 `1 / 5`.
- 실측(데모, 처음 만들 때 1600px): 둘 체크 + 생각 → `완성` ·
  두 열 544/680px(지금은 같은 폭) + 아래 한 줄 1240px, 820px에서 세 덩이 한 열 · 다시 열면
  덜 쓴 둘째 쌍만 펼침 · 가로 넘침 0(1600·820·420) → 교사: 두 장 모두 초록 · 목록
  `물음표 2개 · 고른 물음 2 / 2 · 글 70자` · 수업 시작 → 창에 고른 물음 ·
  생각 · `나의 물음 — “…” 외 1개`.

### 여섯 개의 해시태그 — 태그 목록 → 태그별 글 → 슬라이드 방송 (`hashtagPosts` · `hashtagComments`)

- 책방의 일곱째 독서 활동(`type: 'hashtag'`). 학생이 책·기사·잡지·뉴스레터를
  읽고 **해시태그를 최대 여섯 개** 뽑습니다. 한 칸에 둘 — 태그 · **생각
  표현하기**(해시태그를 활용한 나의 생각 — 자료 칸 이름은 예전 그대로
  `insight`). 셈은 전부 `lib/hashtag.js`(시험 `tests/unit/hashtag.test.mjs`).
- **원문 문장 칸은 거뒀습니다**(선생님 요청). 한때 태그와 생각 사이에 '그
  낱말이 쓰인 원문 문장'(`quote`)을 옮겨 적는 인용 상자가 있었습니다.
  - **저장된 `quote`는 지우지 않습니다** — 읽고(`normalizeHashtagPost`) 그대로
    다시 저장합니다. 보고서의 `title`·`summary`를 남겨 둔 것과 같은 까닭입니다.
    규칙도 안 건드립니다(칸 모양을 못 박아 두지 않았습니다).
  - 보이는 자리는 **어디에도 없습니다** — 폼 · 슬라이드 · 인포그래픽. 방송
    꾸러미(`normalizeHashtagSlide`)에서도 빠져 칠판에 실려 가지 않습니다.
  - **완성은 태그 + 생각**입니다(`isEntryDone`). 원문이 옛 기록에 남아 있어도
    판정과 무관합니다. 다만 '글이 든 칸'(`isEntryStarted`)은 원문도 셉니다 —
    그것으로 칸 수를 늘려 두므로, 빼면 원문만 남은 옛 칸이 다음 저장에서
    잘립니다. 칩을 뺄 때 되묻는 판정도 원문까지 봅니다(안 보여도 지워지는
    글이라서).
  - 원문에 태그가 들었나 보던 `quoteHasTag`는 부르는 화면이 없어 시험과 함께 걷었습니다.
  - 인포그래픽의 숫자는 **둘**(해시태그 · 나의 생각)입니다.
- **처음에는 '열 개의 해시태그'였습니다**(최대 열 개). 선생님 요청으로 여섯이
  됐습니다 — `HASHTAG_COUNT` 6.
  - **이미 만든 활동의 제목은 그대로입니다** — 제목은 활동 문서에 저장된 글이라
    바뀌는 것은 종류 이름('여섯 개의 해시태그')과 새로 만들 때의 기본 제목뿐.
  - **열 개이던 때 여섯 넘게 적은 기록은 안 지웁니다.** `normalizeHashtagPost`가
    글이 든 마지막 칸까지 칸을 늘려 두고(천장 `HASHTAG_SLOT_MAX` 10 — 규칙의
    `tags.size() <= 10`과 같은 값), 잘라 내지 않습니다(잘라 내면 다음 저장에서
    그 글이 지워집니다). 더하는 것만 막습니다 — `addTagsTo`는 **글이 든 칸
    수**로 세어, 칸 사이 빈자리가 있어도 여섯을 넘겨 들어가지 않습니다.
    여섯 아래로 빼야 다시 더할 수 있습니다(시험으로 박아 둠).
  - **규칙을 안 건드립니다** — 여섯은 열 이하라 그대로 통과합니다.
- **보고서는 거뒀습니다**(선생님 결정). 한때 폼 아래에서 학술 보고서 모양
  (제목 · Keywords · 요약 · 그림 1 · 본문 · 참고문헌)으로 곧바로 짜 보여 주고
  PDF로 뽑았는데, `HashtagReport.jsx`·`lib/exportHashtag.js`와 보고서 제목·요약
  입력칸을 함께 걷었습니다. 저장 문서의 `title`·`summary`는 **그대로 둡니다** —
  지난 기록을 지우지 않으려고요(쓰는 화면이 없을 뿐, 규칙·모양은 그대로).
  **보고서를 되살리지 마세요** — 되살리려면 선생님께 먼저 여쭙니다.
- 자료: 활동 문서에 `guide`(안내, 200자) · **`published`**(친구 해시태그 공개).
  학생 기록 `bookActivities/{id}/hashtagPosts/{uid}`(문서 id = uid, 한 사람에 한 장)
  `{ authorId, authorName, studentId, title, source{kind,title,author,date,url},
  image{url,caption,credit}, tags[10]{tag,quote,insight}, summary, seenCommentsAt }`.
  댓글 `hashtagComments/{자동 id}` `{ postUid, authorId, authorName, studentId,
  byTeacher, kind('like'|'ask'|'suggest'), text }`.
  모둠도 entries도 없어 `BOOK_SHARED_TYPES`에 듭니다.
- **학생 폼은 위아래 세 덩이입니다**(선생님 요청).
  1. **두 열** — 이 글의 공통 정보: 왼쪽 ① 읽은 글 ｜ 오른쪽 ② 대표 이미지
     (`.ht-common`).
  2. **두 열** — 왼쪽 ③ 내가 찾은 해시태그(칩) ｜ 오른쪽 ④ 해시태그별 생각
     표현하기 카드(`.ht-form`). 칩을 더하면 옆 열에 카드가 생기는 것이
     한눈에 보입니다.
  3. **한 열** — ⑤ 댓글.
  - **두 덩이 모두 `1fr 1fr` 같은 폭**이고 서로 독립된 격자입니다(선생님
    요청). 위 덩이는 한때 한 열로 쌓여 있었고, 아래 덩이는 `1 : 1.15`였습니다.
  - **한 줄의 두 장은 늘 같은 높이**입니다(`align-items: stretch`). ④의 카드를
    펴고 접으면 오른쪽만 늘었다 줄었다 하며 왼쪽 장의 바닥이 어긋났습니다 —
    이제 두 장이 함께 커지고 작아집니다(물음표로 책 읽기의 두 장과 같은 방식).
    **`start`로 되돌리지 마세요.**
  - 두 열이 되며 ② 칸이 좁아져, 그림 미리보기가 칸의 42%까지 줄어듭니다
    (`clamp(160px, 42%, 240px)`) — 고정 240px이면 옆 입력칸이 눌립니다.
  - 한때 왼쪽 열에 칩 · 읽은 글 · 이미지를 함께 쌓았는데(열 상자
    `.ht-col--gather` · `.ht-col--write`), 읽은 글과 이미지는 태그와 무관한
    '이 글에 대한 정보'라 맨 위로 올리고 열 상자를 걷었습니다. 번호도
    화면 차례대로 다시 매겼습니다(읽은 글 1 · 이미지 2 · 태그 3 · 생각 4).
  - **접는 기준은 창이 아니라 `.ht-wrap`의 폭**(`@container`, 900px) — 책방은
    양옆에 패널이 서서 창 폭으로는 모릅니다. 두 덩이가 함께 접혀 ① ② ③ ④가
    차례로 섭니다(DOM 차례 그대로라 `order`가 필요 없습니다).
  - 입력칸 모양(`.ht-input`)은 `.ht-form` 아래에 한정돼 있지 않아 위로 옮긴
    두 칸에도 그대로 걸립니다. `.ht-form textarea`로 한정된 규칙은 ④의
    생각 칸뿐입니다 — ①②에 여러 줄 칸을 더하면 그 규칙을 넓히세요.
  - 실측(데모): 1600·1280·1100px — 네 장 모두 651·603·513px로 같은 폭 · 위
    두 장 263px · 아래 두 장 581px(카드 하나 펼침) → 모두 접으면 **두 장 함께**
    374px · 900·420px에서 한 열 · 가로 넘침 0.
- **펼친 카드의 칩을 따로 도드라지게 하지 않습니다.** 한때 `.ht-chip.on`이
  굵은 고리를 둘러 방금 넣은 태그가 튀어 보였습니다(걷음 — 선생님 요청).
  어느 카드가 펴졌는지는 오른쪽 열이 말합니다.
- **③ 내가 찾은 해시태그**(`.ht-chips`) — 낱말을 적고 Enter(또는 쉼표 · '추가'). 여러 개를
  한꺼번에 붙여 넣어도 낱말마다 칩이 됩니다(`splitTags` — 띄어쓰기·쉼표·#로
  가름. 그래서 **태그 안에 띄어쓰기는 못 둡니다** — 붙여 씁니다).
  - **세로로 쌓습니다**(선생님 요청) — 맨 위에 적는 칸, 그 아래 안내 한 줄,
    그 아래 모은 태그가 **한 줄에 하나씩**(`.ht-chip-list`). 한때 알약을
    가로로 흘리고 적는 칸을 마지막 알약 자리에 두었는데, 몇 개 모였는지와
    어느 카드와 짝인지가 한눈에 안 들어왔습니다.
  - 줄마다 **옆 열 카드와 같은 번호**(`01`…)와 상태(완성 · 쓰는 중 — 카드의
    말과 같음)를 답니다. 번호는 `chips`가 아니라 **`entries`의 차례**로 매깁니다
    (`entryNo`) — 카드가 태그 없는 옛 칸까지 세므로, 칩 차례로 매기면 번호가
    어긋납니다.
  - 여섯이 차면 적는 칸이 사라지고 안내 줄이 그 자리에 섭니다. 클래스 이름
    (`.ht-chip` · `-go` · `-x` · `-add`)은 알약이던 때 그대로입니다.
  - 실측(데모): 1400px에서 적는 칸 542px · 줄 542×37px · 줄 번호와 카드 번호
    01~06 일치 · 줄을 누르면 그 카드의 생각 칸에 커서 · 420px 넘침 0.
  - **저장 모양은 칸 배열(여섯 칸)이고 칩 하나가 칸 하나**입니다 — 규칙도 자료도
    안 바뀌었습니다. 더하면 **비어 있는 첫 칸**에(`addTagsTo`), 빼면 그 칸이
    **쓴 생각째로** 빠지고 뒤 칸이 당겨집니다(`removeTagAt` — 빈 칸이 가운데
    남으면 다음 칩이 엉뚱한 자리에 들어갑니다).
  - 같은 태그(대소문자 무시)는 넣지 않고, 여섯 칸이 차면 넘친 것을 안 넣습니다 —
    까닭은 칩 줄 아래에 4초 동안 적습니다.
  - 글이 든 칩을 빼면 **되묻습니다**(`ConfirmModal`) — 쓴 생각이 함께
    지워지므로. 빈 칩은 곧바로 빠집니다.
  - 칩을 누르면 그 카드가 펴지고 **생각 칸으로 커서가 갑니다**(`ht-insight-<칸>`). 칩을 더할 때는
    커서를 칩 입력칸에 그대로 둡니다(태그를 잇달아 적는 중이라서) — 카드만
    방금 더한 것으로 펴 둡니다.
  - 한글 조합 중의 Enter는 칩을 맺지 않습니다(`isComposing`) — 안 거르면 마지막
    글자가 떨어져 두 칩이 됩니다.
  - 적는 칸도 알약 안이라 **앱 전체의 입력칸 모양을 걷습니다**
    (`.ht-chip-add input`) — 태그 알약에서 겪은 '잔상'(아래)과 같은 까닭.
- **④ 카드** — 칩 하나에 한 장, **펼친 카드 하나만** 열고 나머지는 한 줄
  (번호 · 태그 · 생각 한 줄 · 상태, 같은 태그면 `!`)로 접습니다. 처음에는
  **아직 다 안 쓴 첫 카드**가 펴집니다.
  - 카드 안에도 태그 알약이 있습니다('고칠 때만') — 칩을 빼고 다시 넣으면 쓴
    글이 함께 빠지므로, 잘못 적은 태그는 여기서 고칩니다. 편 카드는 태그를
    다 지워도 **사라지지 않습니다**(지우고 다시 적는 사이에 카드가 없어지면
    안 됩니다 — `entries`가 `openIdx`를 함께 봅니다).
  - 태그 없이 글만 있는 옛 칸(칩이 생기기 전 기록)도 카드로 섭니다('태그
    없음') — 빼면 그 글이 화면 어디에도 안 보입니다. 칩 더하기는 그런 칸을
    건너뜁니다.
- **입력칸 둘은 모양이 다릅니다** — 태그는 살구 알약(`#` 붙음), 생각
  표현하기는 흰 바탕 + 초록 왼쪽 선. **슬라이드의 카드도 같은 모양**이라
  (`.hts-insight`) 입력칸이 곧 슬라이드의 어느 자리인지 보입니다.
  - 알약 **안쪽 입력칸에는 앱 전체의 입력칸 모양을 다 걷습니다**
    (`.ht-tag-input input` — 테두리·둥근 모서리·포커스 고리). 안 걷으면
    `input:focus`의 고리가 알약 안에 상자 하나를 더 그려 '잔상'으로
    보였습니다(실제 신고). 포커스 고리는 알약(`:focus-within`)이 맡습니다.
- **화면은 가운데 한 기둥**입니다(`.ht-wrap` — 폭 1320px · `margin: 0 auto`).
- 칸 판정: 태그는 `#`·띄어쓰기를 걷고(`normalizeTag`), 같은 태그는 뒤 칸이
  걸립니다(슬라이드에 한 번만 — `hashtagEntries`가 뺌). 완성 n/6은 **태그와
  생각이 다 찬 칸**만 세고, '완성'(`complete`)은 여섯 칸이 다 찼을 때입니다.
- **슬라이드 한 장**(`HashtagSlide`) — 학생 한 명의 것: 머리(이름 · 읽은 글 한 줄
  `hashtagSourceLine` · 태그 칩 줄 · 대표 이미지) + 태그마다 카드(#태그 ·
  생각). 카드가 한 장이면 한 줄에 1, 넷까지 2, 그 위로 3(`--hts-cols`, 좁은
  자리는 `maxCols`로 2까지). **세 곳이 같은 컴포넌트**입니다 — 학급 방송 ·
  교사의 수업 화면 창 · 교사 가운데. 교사가 보는 것이 곧 칠판에 뜬 것이어야
  합니다(친구 보기는 인포그래픽 장표 — 아래 '공개하기').
  - 실어 보낼 모양은 `hashtagSlide(post, { writerName, activityTitle })` 한 곳에서
    짓고, 그리는 쪽은 늘 `normalizeHashtagSlide`로 한 번 더 거릅니다(방송은 남이
    쓴 값 — 길이 자르기 · 그림 주소는 https·data 이미지만).
  - 칠판(`variant="cast"`)은 화면 폭을 따라 커지고, 글이 적을수록 한 단계 더
    (`hashtagSlideSize` → `data-size` lg/md/sm — 곁텍스트·KWLS 방송과 같은 생각).
  - **칠판의 칸 크기는 못 박습니다**(선생님 요청) — 세 칸 × 두 줄(여섯
    자리)이 늘 같은 크기로 서고, 카드가 적으면 빈 자리가 남습니다. 학생을
    넘길 때마다 카드 수에 따라 칸이 커졌다 작아졌다 하면 같은 화면으로 안
    읽혔습니다. 슬라이드가 화면 높이를 다 쓰고(`.hts--cast`가 세로 flex),
    머리(이름·읽은 글·태그·그림)도 높이가 고정(`clamp(120px, 21vh, 230px)`)이라
    카드 자리가 학생마다 같습니다. 넘치는 글은 **그 카드 안에서** 구릅니다.
    - 여섯을 넘는 옛 기록만 줄이 늘어납니다(`--hts-rows`).
    - 칸이 고정이라 글이 적을 때(lg)도 본문 글자를 크게 키우지 않습니다 —
      태그만 커집니다.
    - 900px 아래(학생 폰)에서는 못 박기를 풉니다 — 한 줄에 한 장씩, 페이지가 구릅니다.
    - 화면 안의 한 칸(`hts--page` — 교사 가운데 · 수업 화면 창)도 **한 장 안의
      카드는 같은 높이**입니다(`grid-auto-rows: 1fr`).
    - 실측(임시 페이지): 1920×900에서 카드 2·5·6장 모두 507×279 · 1366×768에서
      408×234 · 옛 기록 8장은 507×179(세 줄) · 가로 넘침 0.
- **수업 시작**(교사) — 가운데 머리(학생을 골랐을 때)의 단추가 그 학생의
  슬라이드를 학급 화면에 띄웁니다(`broadcasts/{classId}`의 `mode: "hashtag"`).
  배관은 곁텍스트·RAFT·KWLS와 **같은 것**입니다 — `useEntryCast`(방송 대상의
  '영역' 열쇠는 `slide` 하나로 못 박음) · `CastStageModal`.
  - 수업 화면 창이 함께 열려 **다음 학생 →** · 키보드 ← →로 넘깁니다. 차례는
    왼쪽 목록 그대로이되 **태그를 하나도 안 찾은 학생은 건너뜁니다**(빈
    슬라이드를 띄울 까닭이 없습니다). 찾은 것이 없는 학생은 단추가 꺼집니다.
  - `CastStageModal`에 **`body`**(본문을 통째로 갈음) · `stepTo`('홍길동의
    슬라이드로') · `hint`를 더했습니다. 꾸러미에 `label`이 없으면 영역 줄(단계
    축)을 안 그립니다 — 학생마다 한 장이라 넘길 영역이 없습니다. 다른 셋은
    지금까지 그대로입니다.
  - 방송 중인 학생이 글을 고치면 칠판도 따라갑니다(`useLiveUpdate`, 0.6초 모음).
  - `PresentationOverlay`의 `KNOWN_MODES`에 `hashtag`를 더했습니다 — **배포
    직후 옛 화면을 연 학생**은 '새로고침' 안내가 뜹니다(원래 그렇게 짠 자리).
  - **규칙을 안 건드립니다** — `broadcasts`는 담당 교사가 쓰고 반 구성원이
    읽으며, 필드를 못 박아 두지 않았습니다. 공개(`published`)와는 **별개**라
    공개 전에도 교사는 띄울 수 있습니다(칠판에 띄우는 것은 교사의 판단).
  - 데모 모드에서는 학생 화면의 방송이 원래 안 뜹니다(상단바가 데모에서 소속을
    안 읽음). 방송 화면은 임시 페이지에 꾸러미를 넣어 확인했습니다.
- **공개하기**(교사 머리말 단추)가 친구 해시태그를 여닫습니다.
  - 공개 전: 학생은 **제 것만**(+ 제 것에 달린 선생님 댓글). 학생 댓글은 못 답니다.
  - 공개 뒤: 학생 화면에 '내 해시태그 / 친구 해시태그' 탭 — 친구 목록은
    **태그를 하나라도 찾은 학생만**(`hasHashtagEntries`), 학번순. 친구를 누르면
    그 친구의 슬라이드 + 댓글. 위에 반의 해시태그 구름(`hashtagCloud` → 닿소리와
    **같은** `cloudWords`·`WordCloud`, 한 학생 안의 같은 태그는 한 번).
    구름의 낱말에는 **`#`을 안 붙입니다**(선생님 요청) — 낱말마다 같은 글자가
    앞에 서면 크기 차이보다 `#`이 먼저 읽힙니다. 칩·슬라이드의 태그는 그대로 `#`.
  - **친구를 누르면 인포그래픽 장표 한 장**입니다(`HashtagInfographic`, 접두사
    `.htg`) — 선생님 요청. 머리띠(읽은 글 제목 큰 글씨 · 종류 · 지은이 · 정리한
    학생 + 대표 이미지) · 숫자 둘(해시태그 · 나의 생각) · 태그 리본 ·
    번호 카드 · 바닥줄. 칩과 카드가 **같은 번호 · 같은 색**(`ROW_COLORS`를 카드
    차례로)이라 리본에서 카드를 눈으로 찾습니다. 카드가 홀수면 마지막 장이 줄을
    다 씁니다. 접는 기준은 장표 폭(`@container` 720 · 600px).
    - **받는 자료는 슬라이드와 같습니다**(`hashtagSlide()` → `normalizeHashtagSlide`).
      모양만 다르고, 한쪽에만 있는 칸이 생기지 않습니다.
    - **칠판 방송 · 교사 가운데 · 수업 화면 창은 그대로 `HashtagSlide`**입니다 —
      거기는 뒷자리에서 읽혀야 해 글자 크기를 폭에 맞춰 키우는 뼈대가 따로
      있습니다. 두 모양의 규칙이 섞이지 않게 접두사를 갈랐습니다(`.hts` ↔ `.htg`).
    - 실측(임시 페이지, 1400 · 820 · 420px): 두 칸 510 · 346px → 420px에서 한 칸 ·
      머리띠 세로로 · 가로 넘침 0.
  - 공개를 거둬도 **댓글은 그대로**이고, 주인은 제 것에 달린 댓글을 계속
    읽습니다(`postUid == 나` 질의).
- **댓글** — 말머리를 고릅니다(좋아요 · 궁금해요 · 제안합니다). 실명(학번 +
  이름), 선생님은 '선생님'. **고치기는 없고**(지우고 다시), 지우기는 **쓴 사람과
  선생님만 — 주인은 못 지웁니다.** 500자.
- **'새 댓글 n'** — 알림 벨에 넣지 않았습니다(알림함은 본인만 쓰게 잠가 둔
  자리). 학생 기록의 `seenCommentsAt`과 견주어 활동 카드(`HashtagCardBadge`)와
  폼 머리에 띄우고, 댓글 칸이 화면에 들어오는 순간 읽음으로 적습니다.
  남이 단 것만 셉니다 — **데모 모드는 교사·학생 uid가 같아** 이 배지가 안
  뜹니다(시험으로 확인).
- **교사 화면은 두 칸입니다**(`HashtagBoard` — 왼쪽 학생 목록 · 가운데 슬라이드
  + 댓글). 오른쪽 '학생별 진행'을 **일부러 뺐습니다** — 양옆에 '오늘'·'멋진
  순간'이 서면 세 칸일 때 가운데가 150px 남짓입니다(실측 1400px). 진행은 왼쪽
  목록의 네모 열 개(칸마다)와 `태그 n개 · 완성 n · 댓글 n`이 말합니다. 아무도 안
  고르면 가운데가 반의 해시태그 구름.
  - 그 구름 판은 **가운데 칸의 남는 높이를 다 씁니다**(`.ht-teacher-cloud`가
    세로 flex, 바닥 260px). 높이를 240px로 못 박았을 때는 낱말이 몇 개뿐이면
    판 아래가 통째로 비어 구름이 위쪽 띠에 갇혀 보였습니다(선생님 요청). 판이
    커지면 글자도 함께 커집니다(천장 96px).
    실측(데모): 1600×900에서 판 632×552 · 1280×720에서 312×355 · 넘침 0.
  - **학생 '친구 해시태그'의 구름(`.ht-cloud`)은 창 높이를 따릅니다** —
    `clamp(300px, 56vh, 580px)`. 260px 띠에 두었을 때는 낱말 몇 개가 띠를 꽉
    채워 잘린 듯 보였고 아래 절반은 비었습니다(선생님 지적 — 위 교사 구름과
    같은 문제). 폼은 통째로 구르는 페이지라 '남는 높이'가 없어 vh로 잡고,
    아래 친구 목록이 한참 밀리지 않게 천장을 둡니다.
    - **`flex: none`을 빼지 마세요.** `.cloud-box`의 `flex: 1`(기준 0)이
      높이가 안 정해진 부모 안에서 height를 버리고 min-height로 내려앉아,
      적어 둔 260px이 실은 240px으로 그려지고 있었습니다(실측).
    - 실측(임시 페이지, 낱말 다섯): 1914×952에서 판 1280×533 · 1280×720에서
      1240×403 · 420×800에서 380×448 · 낱말이 모두 판 안(가장자리 여유 27px 이상).
  - 좁을 때는 `@container`로 슬라이드를 한
  칸으로 접습니다.
- **규칙을 새로 열었습니다**(처음 만들 때 — 이번 개편은 규칙을 안 건드림) —
  시험 `tests/rules/hashtag.test.mjs`(11개). 학생 기록: get은 id로(아직 없는 제
  것도 열림) · list는 교사 또는 **공개 뒤** 반 구성원 · 쓰기는 제 자리 · 제 이름
  (`hashtagIdentityOk`, 메모와 같은 검사) · 잠기면 막힘(단 `seenCommentsAt` 한
  칸은 늘) · 지우기는 교사만. 칸 열 개 · 요약 5000자 · 그림 주소 2000자. 댓글:
  읽기는 교사 · 주인(`postUid`) · 쓴 사람 · 공개 뒤 구성원, 학생 쓰기는 공개 뒤 ·
  잠기기 전만, 교사는 공개 전에도. 길이 천장은 `lib/hashtag.js`의
  `HASHTAG_*_MAX`와 **같아야** 합니다.
- **탈퇴 정리** — 학생 탈퇴(`withdrawStudent`)가 활동마다 학생 기록 · 거기 달린 남의
  댓글(`postUid ==`) · 제 댓글(`authorId ==`) · 대표 그림을 지웁니다(활동 안의 등호
  질의라 색인이 따로 필요 없습니다). 휴지통의 '완전 삭제'도 기록·댓글·그림을 함께 지웁니다.
- 아직 없는 것(뒤로 미룸): 전광판 · 학생이 제 슬라이드를 미리 보는 자리.
- 실측(데모, 1600px): 칩 셋을 한 번에 붙여 넣기 → 칩 3 · 카드 3 · 마지막 카드
  펼침 · 커서는 칩 입력칸 · 같은 태그 막힘 안내 · 칩 누르면 그 카드의 생각 칸에
  커서 · 빈 칩은 곧바로, 글 든 칩은 되묻고 빠짐 · 교사 가운데 슬라이드 →
  수업 시작 → 수업 화면 창(영역 줄 없음 · 다음 학생 꺼짐) → 수업 종료 ·
  가로 넘침 0(1600·420px).

### 가로세로 낱말퀴즈 — 닿소리 채우기의 낱말로 (`activity.crossword` · `groups/{gId}/xwHints` · `xwBoard` · `xwProgress`)

**제 독서 활동입니다**(`type: 'crossword'` — 선생님 요청). '독서 활동 만들기'의 아홉째
종류 **가로세로 낱말 퀴즈**를 고르면 **어느 닿소리 채우기의 낱말로 만들지**를 고르는
칸 하나가 섭니다(이 반의 닿소리 채우기, 휴지통 제외 · 처음엔 가장 최근 것 · 이름 뒤에
모둠/개별 활동). 주제어 · 도서 주소 · 모둠 설정은 받지 않습니다. 닿소리가 없으면
만들기가 꺼지고 그 까닭을 적습니다.

- **한때 닿소리 채우기 안의 화면이었습니다** — 교사 '전체 보기'의 넷째 알약
  '가로세로', 학생 '내 판'의 '가로세로' 단추, 주소 `?view=cross`. 셋 다 걷었습니다
  (옛 주소의 `cross`는 전체 보기로 읽습니다). 그 시절 닿소리 활동 문서에 적힌
  `crossword`는 **읽는 곳이 없어졌습니다**(지우지 않음 — 그 퀴즈를 이어 하려면 새
  가로세로 활동을 만들어 다시 생성해야 합니다).
- **만들 때 고른 닿소리의 판(모둠) 문서를 같은 id로 베껴 옵니다**(`addCrosswordActivity`
  in `lib/data/books.js` — 물러난 판은 뺌). 그래서 힌트 · 판 · 맞힌 기록
  (`groups/{gId}/xw*`)과 개별 활동의 요약(`xwProgress`)이 **지금 규칙 그대로** 이 활동
  아래에서 돕니다(`isMyBookGroup`이 경로의 모둠 id로 판정 — 규칙에 종류 검사가 없음).
  **규칙을 안 건드립니다.**
  - 모둠 방식(`groupMode`)도 그 활동의 것 — 개별 활동이면 1인 판이 학생마다. 다만
    '학생이 고르기'(free)는 '임시 모둠'(teacher)으로 둡니다(학생이 모둠을 옮기면 맡은
    낱말이 엉뚱한 모둠에 남음). 주제어도 그 활동의 것을 적어 둡니다.
  - 활동 문서에 `sourceActivityId`·`sourceTitle`을 적고, **낱말은 베끼지 않습니다** —
    '가로세로 낱말 퀴즈 생성'을 누를 때 그 활동에서 한 번 읽습니다
    (`fetchActivityWords(sourceActivityId, 판 id들)`). 그 사이 닿소리에 더 넣은 낱말도
    들어갑니다. 원래 활동을 완전 삭제하면 재료가 없어 생성이 '낱말이 모자라' 안내로 끝납니다.
  - 베낀 모둠은 **그 순간의 명단**입니다 — 그 뒤 닿소리 쪽 모둠을 고쳐도 퀴즈에는
    안 번집니다.
  - 퀴즈마다 제 활동이라 **한 닿소리로 퀴즈를 여럿** 만들 수 있고, 잠금 · 휴지통도
    따로입니다. 완전 삭제는 퀴즈의 힌트 · 풀이만 지웁니다(닿소리 낱말은 그대로).
- 열면 교사는 `CrosswordGroupBoard`(머리 `활동 이름 · ← 활동 목록 · 반 고르개 ·
  낱말: 닿소리 이름 · 모둠 n개 · 학생 n명`), 학생은 `CrosswordGroupStudent`(`← 활동 목록`).
  학생이 맡은 판이 없으면(닿소리에 함께하지 않음) 안내 한 줄입니다.
- 카드 · 모둠 판정: 목록 카드는 닿소리처럼 '모둠 n개 · 방식'(개별이면 '학생 n명'),
  `isGroupedActivity`도 닿소리와 같은 판정입니다. 편집 창에서 주제어는 선택.

**모둠 활동이든 개별 활동이든 같은 흐름 · 같은 화면입니다**(`CrosswordGroupBoard` ·
`CrosswordGroupStudent` — `activity.groupMode === 'solo'`면 말만 바꿉니다). 흐름은
아래 '모둠 활동의 가로세로' 절(생성 → 힌트 쓰기 → 낱말 채우기)이고, 개별 활동은
판(group)이 한 사람짜리라 **'모둠마다 구성원 수만큼' = 한 사람에 낱말 하나**가
됩니다(선생님 요청 — 그것이 모둠 활동과의 차이 전부).

- **닿소리의 '전체 보기'는 URL이 듭니다** — `?activity=<id>&view=all`.
  `app/books/page.js`의 `setBooksView`가 `?activity=`를 그대로 둔 채
  `view`만 바꿔 `router.push`합니다. 한때 `useState`(`crossView` · `allView`)라
  **새로고침하면 닿소리 판으로 돌아갔습니다**(실제 신고). push라 브라우저 '뒤로
  가기'도 한 단계씩 돕니다. 다른 활동을 열면 `view`가 빠져 저절로 접힙니다.
  보던 얼굴(잔디 · 격자 · 구름 — `dashView`)도 `&face=grass | cloud`로 듭니다(격자는
  기본이라 안 적음 · `DASH_FACES`가 `DashViewTabs`의 key와 같아야 함). 알약을 오가는
  것은 `router.replace`라 '뒤로 가기' 기록이 안 쌓이고, 전체 보기를 닫아도 face는
  남아 다시 열면 보던 얼굴입니다.
- **한때 개별 활동은 따로였습니다** — 학생이 제 낱말 셋을 골라 뜻을 쓰고
  (`entries/{uid}.answers.crossword`), 교사가 반 전체 풀이로 판 하나(정답이 활동
  문서에 그대로)를 짜 학생이 기기 안에서만 풀었습니다(`CrosswordStudent` ·
  `CrosswordBoard` · `CrosswordPuzzle` — 걷음). 옛 퍼즐(`mode`가 없는 것)은 이 화면이
  읽지 않아 '아직 만든 퀴즈가 없어요'로 보이고, 교사가 다시 만들면 됩니다. 옛 풀이
  기록은 지우지 않았습니다(읽는 곳이 없을 뿐).
- **개별 활동의 쓸 사람은 만들 때 정해 둡니다**(`createGroupCrossword`의 hints에
  `writerUid`·`writerName` — 판의 주인). 그래서 학생 화면에 알약이 없고 곧바로
  힌트를 씁니다. 비어 있으면(예외) 처음 적을 때 나로 정합니다.
- 화면의 말: 학생 '나의 낱말 · 나의 판 · 혼자 채워요', 교사 '학생별 풀이 · 학생마다'
  (머리 `가로세로 · 개별 활동 · 학생 n명`). 교사 왼쪽 힌트 제출은 모둠 묶음 없이 한
  줄 목록(`.xwg-solo-list`), 오른쪽 낱말 힌트도 한 목록(`.xwg-hint-list--solo`).

**개별 활동 학생의 왼쪽 칸은 위에서부터 — 나의 판 미니맵(맞힌 n/N · 막대) · 나의
낱말 · 가장 많이 채운 친구의 미니맵**(선생님 요청, 낱말 채우기 단계에서. 힌트 쓰기
단계에는 나의 낱말만).

- **순위는 맞힌 낱말 수, 같으면 글자 수 = 채운 칸 + 제가 쓴 힌트 글자 수**
  (`rankSoloProgress` · `soloScoreLetters` — 띄어쓰기는 안 셈). '글자 수는 자신의
  힌트까지 포함'(선생님 요청)을 **제가 쓴 힌트 글**로 읽었습니다. 제 낱말(열쇠 칸)은
  칸 수에 안 넣습니다. 그래도 같으면 요약이 먼저 온 차례.
- **친구의 판은 못 읽습니다**(xwBoard는 정답 글자가 든 문서 — 그 판의 주인과 교사만).
  그래서 학생마다 제 판의 **요약**을 적습니다 — `bookActivities/{aId}/xwProgress/{판 id}`
  `{ groupId, uid, solved, total, cells, hintChars, filled:[칸], solvedIdx:[차례] }`,
  **글자 없이 자리만**(`soloBoardSummary`). 미니맵은 그 요약으로 그립니다
  (`summaryMinimap` — 칸에 '·'만, 그 친구 낱말은 글자 없는 열쇠 칸).
  - 쓰는 때: 낱말 채우기 단계 · 힌트와 판의 첫 답이 둘 다 온 뒤 · 값이 바뀌었을 때만,
    1.2초 모아서(`PROGRESS_SAVE_MS`). 첫 답 전에 쓰면 0개짜리 요약이 한 번 나갑니다.
  - 나와 1위를 견줄 때 내 쪽은 **화면에서 센 값**을 씁니다(저장이 한 박자 늦어도 안
    흔들림). 내가 앞서면 '지금은 내가 앞서요!'. 1위 카드는 **나를 뺀 친구** 가운데입니다.
  - 학생이 제 요약을 부풀려 적을 수는 있습니다(수업용 놀이라 감수 — 규칙은 모양 ·
    주인 · 범위만 봅니다).
- **교사의 '학생별 풀이'도 이 요약으로 셉니다**(구독 1건). 판(글자)은 **가운데에 크게
  볼 학생 하나만** 구독합니다 — 스물몇 명의 판을 다 걸지 않게(`useGroupXw`의 `boardIds`).
  아직 요약이 없는 학생은 '아직'. 모둠 활동은 지금까지대로 모둠마다 판을 구독합니다.
- **규칙을 새로 열었습니다**(`xwProgress`) — 읽기는 반 구성원 · 담당 교사, 쓰기는 그
  판의 구성원이 제 uid로 · 잠기기 전 · 칸 목록을 못 박음(숫자 범위 · `filled` 600 ·
  `solvedIdx` 200), 지우기는 담당 교사. 시험 `tests/rules/crosswordGroup.test.mjs`(9개).
  **코드보다 규칙을 먼저 배포하세요** — 안 그러면 요약 쓰기가 권한 오류라 친구 1위
  카드와 교사 순위가 빈 채입니다(풀기 자체는 됩니다). 퍼즐 생성 · 내리기 · 휴지통의
  완전 삭제가 요약도 함께 지웁니다.
- 실측(데모 1440px, 개별 활동 21명 · 재료 97개): 생성 → 21개 · 학생마다 1개 · 쓸
  사람 미리 정해짐 · 학생 알약 0개 → 힌트 '제출' → 낱말 채우기 → 친구 요약 셋(2개 ·
  칸 9 · 힌트 5 / 2개 · 칸 6 · 힌트 12 / 1개) → 교사 순위 학생5 · 학생3 · 학생7(동률을
  글자 수로) → 학생 왼쪽 '나의 판 한눈에 · 나의 낱말 · 가장 많이 채운 친구(학생5 ·
  글자 18자)' → 낱말 하나 맞히면 1/20 · 요약 `solved 1 · cells 3 · hintChars 8` · 넘침 0.

#### 모둠 활동의 가로세로 — 힌트 쓰기 → 함께 채우기 (`groups/{gId}/xwHints` · `xwBoard`)

닿소리 활동을 모둠으로 만들었으면 가로세로도 모둠 활동입니다(선생님 요청).
흐름은 셋이고, 지금 단계는 활동 문서의 `crossword.stage`가 듭니다.

1. **생성**(교사) — 이 활동에 나온 **낱말 전부**(`fetchActivityWords` — '생성'을 누를
   때 한 번만 읽음)로 **참여 학생 수만큼** 이어 판을 짜고, 놓인 낱말을 무작위로
   **모둠마다 구성원 수만큼** 나눠 줍니다(`buildGroupCrossword` ·
   `assignEntriesToGroups` — 낱말이 모자라면 모둠을 돌아가며 하나씩이라 모자람이
   한 모둠에 몰리지 않음). 판 천장은 21×21(`CROSSWORD_GROUP_MAX_SIZE`).
   - 실측: 서로 다른 낱말 **100개 남짓이면 21명분이 매번** 다 놓입니다(0.1초 안팎).
     70개 안팎이면 10개 남짓 — 그때는 안내 줄이 '학생 수보다 적다'고 말하고, 쓸
     사람이 다 정해진 모둠의 남는 학생은 교사 목록에 '맡은 낱말 없음'으로 섭니다.
2. **힌트 쓰기**(`stage: 'hint'`) — 학생 왼쪽 칸에 우리 모둠 낱말이 섭니다. 낱말마다
   **모둠원 알약**(`role="radio"`)으로 쓸 사람을 정하고, **알약이 가리키는 그 학생만**
   힌트를 씁니다(저절로 저장 0.7초). 교사 왼쪽 칸은 모둠별 학생 목록에 **제출 ·
   쓰는 중 · 미제출 · 맡은 낱말 없음**, 가운데는 정답이 보이는 판, **떠 있는 패널이
   모둠별 '낱말 · 힌트 · 쓴 사람'**입니다(아래 '교사 화면의 낱말 힌트는 떠 있는 패널'). 교사와 그
   모둠원이 누가 썼는지 봅니다.
   - 알약은 **힌트가 비어 있을 때, 또는 지금 쓰는 사람 자신만** 바꿉니다(규칙) —
     남이 쓴 힌트의 이름표를 갈아 끼우면 '누가 썼나'가 거짓이 됩니다.
3. **낱말 채우기**(`stage: 'solve'`) — 교사가 '낱말 채우기'를 누르면 힌트가 활동 문서의
   `entries[].clue`로 복사되고(힌트 없는 낱말이 있으면 되묻고 '(힌트 없음)'으로),
   모둠마다 판 하나를 **모둠원이 함께** 채웁니다. '힌트 쓰기로 돌아가기'로 되돌릴 수
   있고, 다시 시작하면 그때의 힌트로 다시 복사합니다.
   - **학생 화면은 세 칸** — 왼쪽 **'우리 모둠 판 한눈에'(미니맵)** · '우리 모둠 풀이'(맞힌 n / N · 막대) + 우리 낱말 ·
     가운데 판(직접 적기) · **오른쪽 힌트 목록(가로 · 세로)**(선생님 요청). 1180px 아래에서는
     힌트 목록이 아래로, 860px 아래에서는 한 열.
   - **학생 미니맵**(`.xwg-mymap`, 선생님 요청)은 왼쪽 칸 맨 위입니다 — 풀이 · 낱말
     카드는 그 아래로. 교사 미니맵과 **같은 `CrosswordGrid mini`**이고, 우리 모둠 판을
     판 모양 그대로 색으로만 보여 줍니다(우리 모둠 낱말 베이지 · 채우는 중 회색 ·
     맞힌 낱말 **초록** — 교사 화면은 모둠 색이지만 학생 화면은 가운데 판 · 풀이
     막대와 같은 초록 `#6fbf8a`). 지금 고른 낱말은 살구 테두리. 칸은 카드 폭 안에서
     **5px까지** 커지고(22px → 15px → 10px → 5px — 선생님 요청, 가장 많이 채운 친구의
     미니맵 · 교사 미니맵도 같은 크기) 큰 판(21칸)이면 함께 줄어듭니다. 읽는 문서가 안 늡니다
     (이미 구독한 판 · 힌트로 그림).
   - 교사 화면 왼쪽에 **모둠별 미니맵**(판 모양 그대로 ·
     칸 5px — 학생 미니맵과 같은 크기, 한때 11px · 글자 없이 색만 — 그 모둠 낱말은 베이지, 채우는 중 회색, 맞힌 낱말은
     **모둠 색**)이 **맞힌 순서로** 서고(`rankGroupProgress` — 맞힌 수 → 비율), 누르면
     가운데에 그 모둠의 판이 크게 섭니다.
   - **학생 화면의 세 칸은 같은 높이이고, 힌트 목록은 스크롤 없이 다 펼칩니다**
     (선생님 요청). 줄 높이는 셋 가운데 가장 긴 것이 정하고(`.xwg:not(.xwg--teacher)`의
     `align-items: stretch`), 나머지 둘은 아래가 비더라도 그 높이까지 늘어납니다 —
     가운데 판 카드 · 오른쪽 힌트 카드(`flex: 1`) · 왼쪽은 **맨 아래 카드**가 늘어남.
     한때 힌트 목록을 판 높이에 맞춰 잘라(`contain: size`) 안에서 굴렸는데, 판을
     보며 힌트를 찾느라 두 곳을 오갔습니다. **`contain: size`나 max-height를
     되살리지 마세요.** 1180px 아래(힌트가 판 아래로 내려감)에서는 왼쪽과 판만 맞춥니다.
   - **교사 화면의 낱말 힌트는 떠 있는 패널**(`components/FloatingPanel.jsx` —
     선생님 요청). 화면 위에 떠 있어 뒤 화면을 막지 않고(모달이 아님), **머리줄을
     끌어 옮기고 ▾로 접었다 폅니다**. 그래서 교사 화면은 두 칸(왼쪽 미니맵 · 가운데
     판)이고 판이 그만큼 넓어졌습니다(실측 1440px 294 → 520px). 힌트 쓰기 · 낱말 채우기
     두 단계 모두 같은 패널이고, 모둠별로 낱말 · 힌트 · 쓴 사람을 적습니다(채우는
     중이면 고른 모둠이 맞힌 낱말에 표시).
     - 한때 오른쪽 셋째 칸이었고(그 전에는 판 아래 카드), 판과 바닥을 맞추려고
       `.xwg-pair`로 묶었습니다 — 걷었습니다.
     - 자리와 접힘은 이 기기에 기억합니다(localStorage `xw_hint_float` — 한 선생님은
       대개 늘 같은 자리에 둡니다). 처음에는 화면 오른쪽 위(top 132).
     - **화면 밖으로 안 나갑니다** — 끌 때 · 창 크기가 바뀔 때 붙잡고, 펼친 동안은
       몸통이 200px은 보이게 위로 붙잡습니다(바닥에 접어 둔 것을 펴면 위로 올라옴).
       몸통은 **480px이 천장**이고(`maxBody` — 한 모둠 남짓, 선생님 요청) 그보다 화면
       바닥이 가까우면 바닥까지입니다. 넘치면 **몸통 안에서** 구릅니다. 한때 화면 바닥까지
       늘 늘어났는데, 어차피 구르는 창이 판을 위아래로 다 덮고 있었습니다.
     - body에 포털 · z-index 90(모달 배경 100 · 되묻는 창 200 아래). 끌기는 왼쪽
       단추로 머리줄을 누를 때만(접기 단추는 비켜 감), `setPointerCapture`.
     - 이름은 **떠 있는 패널**입니다 — 모달(뒤를 막음) · 팝오버(누른 것 옆에 붙음)와 갈라
       둡니다. 다른 화면에 같은 것이 필요하면 이 조각을 그대로 쓰세요(`storageKey`만 다르게).
     - 실측(데모 1440px): 처음 340×754(오른쪽 위) · 끌어 옮김 · 왼쪽 아래로 끌면
       x 8 · 접으면 48px · 다른 화면에 다녀와도 자리 · 접힘 그대로 · 바닥에 접힌 것을
       펴면 y 846 → 646 · 가로 넘침 0.
     - **모둠 카드를 누르면 마우스 옆에 그 모둠의 낱말 · 힌트 팝오버**가 뜹니다
       (`components/XwGroupHintPopover.jsx`, 선생님 요청 — 낱말 채우기 단계의 모둠
       활동만). 가운데 판도 그 모둠으로 바뀌는 것은 그대로입니다. **사람별로** 묶어
       (모둠원 차례 · 모둠에서 빠진 학생 · '쓸 사람 안 정함'은 맨 뒤) 누가 어떤 낱말에
       어떤 힌트를 썼나를 보여 줍니다 — 떠 있는 패널은 모든 모둠이 한 목록이라 한 모둠을
       짚으려면 굴려 찾아야 했습니다.
       - 자리는 **누른 점**입니다(`pointAnchor` — 카드 안에서 누른 자리를 기억해 카드와
         함께 따라감 · 키보드로 누르면 카드 옆).
         자리를 고르는 높이는 어림값이 아니라 **그려질 높이를 잰 값**입니다(`natH` — 몸통이
         안에서 구르기 전의 내용 높이, 탭 천장까지). 어림값 360px로 고를 때는 아래쪽 모둠에서
         연 정답 탭(판이 커서 600px 남짓)이 화면 아래로 잘렸습니다(실제 신고). 실측: 화면 아래
         카드에서 열어도 1440×900 · 1280×720 · 420×800 모두 창 바닥이 화면 끝 8px 안. 자리 잡기 · 닫기는 `lib/popover.js`
         (바깥 · Esc · ×, 다른 카드를 누르면 그 모둠으로 옮겨 감 — `keep`이 `.xwg-rank`,
         같은 카드를 다시 누르면 닫힘). body에 포털 · z 320.
       - 힌트 탭은 **읽는 문서가 안 늡니다** — 보드가 이미 구독한 모둠별 힌트(`hintsOf`)로 그립니다.
       - 실측(임시 페이지 1440 · 420px): 누른 점 오른쪽 14px · 340px · Esc로 닫힘 · 넘침 0.
       - **탭 둘 — 힌트 · 정답**(선생님 요청, 같은 크기 두 칸 `.xwg-hintpop-tabs`).
         정답 탭은 **그 모둠의 퀴즈판 그림**입니다(선생님 요청 — 글자 목록을 걷음).
         맞힌 낱말의 칸을 **맞힌 학생의 색**(`ROW_COLORS`를 모둠원 차례로, 옅은 바탕보다
         한 단계 짙게 `color-mix` 42%)으로 칠하고, 우리 모둠 낱말(열쇠 칸)은 **연한 회색**,
         기록이 생기기 전에 맞힌 낱말은 잿빛 파랑('기록 없음'). 두 낱말이 엇갈리는 칸은
         **먼저 맞힌 사람**의 색. 판 **위**에 범례(색 · 이름 · 맞힌 수, 두 칸 격자) — 판이
         길면 아래 범례가 구르는 밖으로 밀려서입니다. 머리는 `맞힘 n / N`. 고른 탭은 다른
         모둠 카드로 옮겨도 그대로. 칠하기는 `CrosswordGrid`의 **`paint`**(칸 → `{ bg,
         border }`, 인라인 색)이고, 판은 팝오버 폭(420px — 두 탭 같은 폭)에 맞춰 칸이
         줄어듭니다(`.xwg-hintpop-board`, 글자는 `cqw`). 판 글자 · 열쇠 칸은 보드가 이미
         구독한 것을 넘깁니다(`boardsBy` · `progressList[].fixed`, 읽기 0).
         실측(임시 페이지 1100 · 420px): 칸 25 · 24px · 가로 넘침 0.
         - 기록은 `groups/{gId}/xwSolves/{idx}` = `{ idx, uid, name, at }` — 학생이
           낱말을 끝까지 채운 쓰기로 그 낱말이 **새로 맞으면** 그 학생이 제 이름으로
           한 장 만듭니다(`CrosswordGroupStudent`의 `writeCells` → `recordXwSolve`,
           모둠 활동만). 교차 칸으로 덤으로 맞은 낱말도 그 쓰기를 한 사람의 것입니다.
         - **create만 열렸습니다** — 고치기가 없어 먼저 맞힌 사람이 남고, 같은 순간
           둘이 맞히면 둘째는 규칙이 거부해 조용히 넘어갑니다. 규칙은 그 모둠원 · 제
           uid · 문서 id = idx · 서버 시각 · 잠기기 전, 읽기는 그 모둠 · 담당 교사,
           지우기는 담당 교사. 시험 `tests/rules/crosswordGroup.test.mjs`.
         - 교사는 **팝오버를 연 모둠 하나만** 구독합니다. 맞힌 낱말 자체는 판(지문)으로
           세므로, 기록이 생기기 전에 맞힌 낱말은 '기록 없음'으로 섭니다.
         - 퍼즐 생성 · 내리기 · 휴지통의 완전 삭제가 이 기록도 함께 걷습니다.
         - **코드보다 규칙을 먼저 배포하세요** — 안 그러면 기록이 안 남아 모두
           '기록 없음'입니다(풀기 자체는 됩니다).
     - 왼쪽 모둠별 · 학생별 미니맵은 카드 **가운데**입니다(`.xwg-rank .xw-grid--mini`의
       `align-self: center`, 선생님 요청).
     - **접는 기준은 창 폭이 아니라 화면(`.xw-main`)의 폭**입니다(`container: xwmain`
       → `@container xwmain`). 책방 교사 화면은 양옆에 '오늘' · '멋진 순간' 패널이
       서서, 1440px 창에서도 이 화면은 740px 남짓입니다. 창 폭으로 세 칸을 두었더니
       가운데 판이 84px로 짜부라졌습니다(실측).
     - 왼쪽 칸은 **%로 두고 바닥을 둡니다**(`minmax(200px, min(24%, 300px))`) — 고정
       폭이면 남는 가로를 왼쪽이 먼저 가져갑니다. 520px 아래에서는 한 열.
     - **'아직 만든 퀴즈가 없어요.'는 카드 제목 오른쪽**(`.xw-card-head-note`),
       **안내 글이 앞 · 단추 묶음이 그 오른쪽**(`.xw-gen-inner`)입니다. 안내 옆에
       180px이 안 남으면 단추 묶음이 다음 줄 오른쪽 끝으로, 줄 폭이 360px 아래면
       한 줄에 하나씩(접는 기준은 그 줄의 폭 — `@container xwgen`).
     - **단추는 모두 같은 크기**(격자 `minmax(0, 1fr)` — 가장 긴 글자에 맞춘 폭 ·
       높이 40px)이고 **색으로만** 가릅니다: 만들기 · 다시 만들기 = 진한 살구
       (`--primary-dark`) · 다음 단계(낱말 채우기 / 힌트 쓰기로 돌아가기) = 살구
       (`--primary`) · 퀴즈 내리기 = 연한 살구(`--primary-light`, 글자 진한 살구).
     - 실측(데모, 양옆 패널 섬, 힌트가 셋째 칸이던 때): 1920 · 1600 · 1440px에서 단추 셋
       119 × 40px로 같음 · 1440px에서는 한 줄에 하나씩 256 × 40px · 가로 넘침 0.
     - 학생 쪽(`.xwg`)의 `@media` 규칙에 지지 않게 교사 규칙은 `.xwg.xwg--teacher`로
       특이도를 올립니다.
     - 왼쪽 학생 줄은 칸이 좁으면 **이름을 줄이지 않고** 상태 알약이 다음 줄로
       내려갑니다(`.xwg-stu` wrap) — 200px 칸에서 '학…'으로 잘렸습니다.
     - 실측(데모, 양옆 패널 섬, 힌트가 셋째 칸이던 때): 1920 · 1600 · 1440px에서 세 칸(판 576 · 416 ·
       294px) · 그보다 좁으면 한 열 · 가로 넘침 0.

**정답을 반 전체 문서에 안 적습니다.** 활동 문서(반 전체가 읽음)의 `crossword`에는
판 모양 · 번호 · 길이(`len`) · 맡은 모둠(`groupId`) · **지문**(`hash` — `xwHash`,
FNV-1a 32비트 + 퍼즐마다 다른 `salt`) · 힌트만 있고 낱말이 없습니다. 낱말은 그 모둠의
힌트 문서에만 있어(그 모둠과 교사만 읽음) 개발자 도구로 활동 문서를 열어도 답이
안 보입니다. 학생 화면은 칸 글자를 이어 낸 지문을 견주어 '맞았나'만 압니다.
지문은 암호 강도가 아닙니다 — 사전을 들고 하나씩 대 보는 것까지는 못 막습니다.

**우리 모둠 낱말은 열쇠 칸입니다** — 힌트를 쓴 모둠은 답을 알므로, 판이 열릴 때
미리 채워진 베이지 칸으로 두고(고칠 수 없음) **점수에서 뺍니다**. 칸이 전부 열쇠
칸인 낱말(우리 낱말 둘 사이에 낀 두 글자 낱말 등)도 풀 것이 없어 안 셉니다 — 그래서
모둠마다 분모가 조금씩 다릅니다(`groupSolveProgress`).

**맞힌 낱말만 초록, 틀린 것은 칠하지 않습니다.** 빨강을 보여 주면 글자를 하나씩
바꿔 대 보는 놀이가 됩니다. '정답 확인' 단추도 없습니다 — 맞히는 순간 칠해집니다.

**동시 편집** — 판은 `groups/{gId}/xwBoard/main`의 `cells: { "r,c": 글자 }` 하나이고
`writeXwBoard`가 **칸 하나씩 merge**(지울 칸은 `deleteField`)로 씁니다. 모둠원이
동시에 다른 낱말을 적어도 서로 덮지 않습니다.

**판에는 낱말을 끝까지 채웠을 때만, 그 낱말을 통째로 올립니다**(`xwWordSave` —
선생님 제안). 예전에는 덜 채운 낱말도 1.2초 쉬거나 다른 칸을 누르면 그때까지 적은
칸만 저장해, 두 사람이 같은 낱말을 동시에 적으면 칸마다 저장 시점이 엇갈려 글자가
섞였습니다. 지금은
- 적은 글자는 먼저 그 기기의 **초안**(`CrosswordTyping`의 `drafts`, 낱말마다)에
  담기고, 판 글자와 합쳐 낱말의 칸이 모두 차는 순간 **모든 칸을 한 번의 쓰기로**
  올립니다(바뀐 칸만이 아니라). 그래서 나중에 다 채운 사람의 낱말이 칸 전체를
  덮고 섞이지 않습니다. 판과 똑같으면 안 올립니다.
- **쓰다 만 글자는 판에 안 올라가** 모둠원에게 안 보입니다. 다른 낱말로 갔다 와도
  그 화면 안에서는 초안이 남고(`typingKeys` — '적는 중' 모양), 새로고침하면 사라집니다.
- **지우기(Backspace · Delete)도 초안**입니다 — 판에 바로 안 올립니다. 지우고 다시
  끝까지 적으면 그 낱말이 통째로 올라가 틀린 글자를 덮습니다. 지우기만 하고 떠나면
  판에는 옛 글자가 남습니다(틀린 낱말은 칠해지지 않아 점수와 무관 — 선생님 확인).
- 맞힌 낱말 · 열쇠 칸은 지금처럼 잠겨 건너뛰므로, 늦게 다 채운 사람이 정답을 덮는
  일은 없습니다. 엇갈리는 낱말의 초안에 방금 올린 칸이 있으면 그 칸은 걷습니다.
- 개별 활동 판도 같은 규칙이라 요약(`xwProgress`)의 '채운 칸'은 다 채운 낱말의
  칸만 셉니다.
- 실측(임시 페이지에 화면 둘 · 판 하나): A가 두 칸 적고 쉼 → 쓰기 0 · B가 네 칸 →
  B의 네 칸 · A가 이어 채움 → A의 네 칸이 통째로 덮음 · B가 Backspace → 쓰기 없음,
  B 화면만 빈칸 · 다시 적으면 낱말 통째로 · 세로 낱말 한 칸만 적고 쉼 → 쓰기 없음.
**열쇠 칸과 이미 맞힌 낱말의 칸은 건너뜁니다**(`lockedKeys`) — 교차하는 칸을 실수로
고쳐 맞힌 낱말이 깨지지 않게. (`xwCommitPlan`은 예전 입력칸이 쓰던 셈이라 시험에만
남아 있습니다.)

**판에 직접 적기**(`components/CrosswordTyping.jsx` — 모둠 활동 · 개별 활동 공용).
한때 판 아래에 입력칸을 두고 낱말을 적어 '넣기'를 눌렀는데, 두 가지가 나빴습니다.
- **한글로 적고 Enter를 누르면 아무 일도 없었습니다**(실제 신고 — '입력했는데 판에
  안 들어간다'). 낱말의 마지막 글자는 늘 **조합 중**인 채로 Enter를 누르게 되고, 그
  Enter는 keydown에서 `isComposing: true`로 옵니다. 그것을 걸러 내기만 하고(흔한
  처리) 조합이 끝난 뒤 다시 처리하지 않아, 첫 Enter가 통째로 먹혔습니다. Playwright의
  `fill()`은 조합을 안 거쳐 시험에서 안 잡혔습니다.
- 판과 입력칸을 눈으로 오가야 했습니다(선생님 요청 — 판에 바로 적기).

지금은 **숨은 입력칸 하나**(`.xw-typing-input`, 투명 · 지금 칸 위에 얹힘)가 고른
낱말의 글자를 받고, 그 값을 칸에 나눠 그립니다(조합 중인 글자도 칸에 곧바로 보임).
- **칸마다 입력칸을 두지 마세요** — '산호'의 ㄴ은 ㅗ가 와서야 받침이 아니라고
  정해지는데, 칸이 갈리면 그 가름이 칸 경계에서 끊깁니다.
- **조합 중 Enter · Tab은 표시만 하고 `compositionend`에서** 처리합니다
  (`pendingKey`). 맥 크롬은 그 뒤 같은 Enter를 조합 없이 한 번 더 보내는데, Enter가
  넣기만 하므로 두 번째는 빈 값이라 아무 일도 안 합니다.
- **네모 칸(`.cur`)은 '방금 적은 글자'에 섭니다**(선생님 요청). 칸을 누르면 그 칸,
  치는 동안에는 지금 치는(조합 중인) 글자의 칸, 넣은 뒤에는 **마지막 글자의 칸**에
  그대로입니다(`typing.mark`). 처음에는 '다음 글자가 들어갈 칸'에 서서 한 글자
  칠 때마다 네모가 옆 빈칸으로 뛰어, 무엇을 적었는지 좇기 어려웠습니다.
  다음 글자는 그 뒤 칸에 들어갑니다(글자 칸의 커서가 글자 뒤에 서는 것과 같음).
- **Enter와 '칸을 다 채움'은 넣기만 하고 다른 낱말로 안 갑니다**(선생님 요청).
  한때 둘 다 곧바로 다음 낱말로 건너가 네모가 판의 엉뚱한 곳으로 사라졌습니다.
  다른 낱말로는 칸 · 힌트를 누르거나 Tab · Shift+Tab으로 갑니다. 낱말을 다 채운
  뒤 더 치면 아무것도 안 들어갑니다(고치려면 Backspace 또는 칸을 누름).
- **막 맞혀 잠긴 낱말(모둠 판)에서도 네모와 입력칸이 남습니다**(`active` —
  글자는 `typeable`일 때만 받음). 안 그러면 맞히는 순간 입력칸이 사라져 초점이
  빠지고 Tab이 안 듣습니다. 네모가 맞힌 칸 · 열쇠 칸에 서면 테두리만 두르고
  바탕은 그 칸의 색(초록 · 베이지) 그대로입니다.
- **조합 중에는 저장하지 않습니다** — 입력칸 값을 비우면 조합이 깨집니다.
- 칸은 `onMouseDown`에서 기본 동작을 막아 **포커스를 안 가져갑니다** — 입력칸이
  흐려지면 휴대폰 자판이 내려갔다 올라옵니다. 같은 칸을 한 번 더 누르면 가로 ↔ 세로.
- **판 어디를 눌러도 초점이 숨은 입력칸에 남습니다**(`onWrapMouseDown` — `.xw-typing`).
  빈자리(`.xw-cell--void`)와 칸 사이 틈은 버튼이 아니라 span이라, 누르면 브라우저가
  초점을 body로 옮겨 **그 뒤의 화살표가 네모가 아니라 화면을 굴렸습니다**(실제 신고).
  지금은 그 누름의 기본 동작을 막고 입력칸에 초점을 줍니다. 칸 버튼은 제
  `onMouseDown` · `onClick`이 맡으므로 건너뜁니다. 실측: 빈자리 누름 → 초점이 입력칸 ·
  ↓ → 로 네모가 옮겨 감 · 페이지 scrollY 그대로.
- **아이패드 · 아이폰에서는 누르는 그 처리기 안에서 곧바로 초점을 줘야 자판이
  올라옵니다**(iOS Safari). 예전에는 (ㄱ) 초점을 `setTimeout` 뒤에 주고, (ㄴ) 낱말을
  고르기 전에는 숨은 입력칸이 아예 없었고, (ㄷ) 힌트 목록은 효과(`focusTick`)로 초점을
  줘 **태블릿에서 눌러도 아무것도 안 적혔습니다**(실제 신고). 지금은
  - 숨은 입력칸을 **늘 그려 둡니다**(고른 낱말이 없으면 판 왼쪽 위 1px 자리 —
    `REST_POS`, 그때 키는 안 받음).
  - 칸 누르기 · 판 누르기는 `focusInput()`이 **곧바로** `focus()`합니다.
  - 힌트 목록은 부르는 쪽이 `focusRef`로 받은 함수를 **클릭 처리기 안에서** 부릅니다
    (`CrosswordGroupStudent`의 `pickEntry(i, true)`). **`focusTick` 같은 효과 방식으로
    되돌리지 마세요** — 데스크톱에서는 멀쩡해 보여 다시 깨져도 모릅니다.
  - **화면을 열 때는 초점을 안 줍니다** — 휴대폰에서 자판이 판을 가립니다.
  - 실측(iPad 흉내, 크로미움): 칸을 누른 같은 틱에 초점이 입력칸 · 처음 고를 때도 ·
    힌트 단추도 같음 · 적은 글자가 판에 들어감. 진짜 iOS 기기에서는 아직 확인 못 함
    (이 컨테이너에 WebKit이 없음).
- 입력칸 글자는 16px — 그 아래면 iOS가 누를 때 화면을 확대합니다.
- Backspace(빈 입력칸) = 네모 칸에 글자가 있으면 그것을, 비어 있으면 앞 칸을
  지우고 네모도 그리로 · **Delete = 네모 칸의 글자만 지우고 네모는 제자리**(적던
  글자가 있으면 먼저 넣고 그 마지막 글자를 지움 · 다음 글자는 그 칸에 들어감 ·
  열쇠 칸 · 맞힌 칸은 안 지움 — 선생님 요청. 한때 Delete를 안 받아, 비어 있는
  숨은 입력칸에서 브라우저가 아무것도 안 했습니다) · Tab / Shift+Tab = 다음 · 앞 낱말.
- **화살표는 판 위를 네 방향 모두 움직입니다**(`stepCell` · `entryForCell` —
  `lib/crossword.js`, 시험 있음). 네모 칸에서 그 방향으로 가며 **판에 있는 다음
  칸**에 서고, 사이의 빈자리는 건너뜁니다. 옮겨 간 칸을 지나는 낱말 가운데
  **화살표 방향과 같은 낱말**(←→ 가로 · ↑↓ 세로)을 고르고, 없으면 그 칸의 낱말을
  고릅니다. 그 줄에 칸이 더 없으면 제자리입니다. 적던 글자는 옮기기 전에 넣습니다.
  - 예전에는 **낱말 방향의 두 키만, 그 낱말 안에서만, 적을 수 있는 낱말에서만**
    들었습니다 — 가로 낱말에서 ↓가 안 먹고, 낱말 끝에서 멈추고, 맞힌 낱말에서는
    아무 화살표도 안 먹어 '작동 안 할 때가 있다'는 신고가 나왔습니다. 지금은
    맞힌 낱말 · 열쇠 칸에 서 있어도 옮겨 갑니다(글자는 여전히 안 받음).
  - 열쇠 칸 · 맞힌 칸에도 네모가 섭니다. 거기서 치면 그 낱말의 다음 빈칸부터
    들어갑니다(`startAt`).
  - 실측(데모): 같은 줄의 (2,0) → (2,2)로 빈자리 건너뜀 · (1,1) ↓ (3,1) · 가로
    낱말에서 ↓로 아래 세로 낱말 · 줄 끝에서는 제자리 · 열쇠 칸으로 옮겨 감.
- 실측(네모, 데모): '이산화탄소'를 조합으로 칠 때 네모가 글자마다 그 칸(2,0 → 2,4) ·
  조합 중 Enter → 판에 다섯 칸 · 네모는 2,4 그대로 · 같은 낱말 · Tab → 다음 낱말 ·
  '가나' → 네모 4,2 → 4,3 · 1.2초 뒤 저장해도 4,3 · Backspace → 4,3 지우고 그 자리 ·
  한 번 더 → 4,2 지우고 4,2로.
- 실측(데모, CDP로 한글 조합을 흉내 — `Input.imeSetComposition` → `insertText`):
  힌트 누름 → 초점 · 두 글자 조합 · 마지막 글자 조합 중 Enter → 판에 두 칸 · 1 / 7개 · 조합 없이 두 글자 → 1.2초 뒤 저장 · Backspace 두 번에 두 칸
  지움 · 칸 누름 → 그 낱말로 · 교사 미니맵에 맞힌 수 · 1100 · 820 · 420px 넘침 0.
  (개별 활동의 옛 판 — 정답 확인 초록 · 빨강 — 은 걷었습니다.)

**실시간 집계** — 교사는 모둠마다 힌트(컬렉션)와 판(문서 하나)을 구독합니다(모둠
여섯이면 리스너 열둘). 학생은 우리 모둠의 둘. 낱말 문서(words)는 구독하지 않습니다.

**저장 자리는 모둠 아래** — 규칙이 경로의 모둠 id로 곧바로 '내 모둠인가'
(`isMyBookGroup`)를 봅니다. 문서에 groupId를 적고 질의로 거르면 규칙이 질의를
증명해야 해서 까다롭습니다(모둠 메모에서 겪은 것).

- `xwHints/{idx}` — `{ idx, word, num, dir, len, writerUid, writerName, hint }`. 읽기는
  그 모둠 · 담당 교사, 만들기 · 지우기는 교사. 학생은 알약(위 조건 · 모둠원만) 또는
  힌트 글(쓰는 사람만 · 100자 — `CROSSWORD_HINT_MAX`와 **같아야**)만.
- `xwBoard/main` — 그 모둠원만 쓰고(`cells`·`updatedAt`만 · 600칸), 교사는 읽기 · 걷기.
- 생성 · 내리기(`createGroupCrossword` · `clearGroupCrossword`)는 **한 묶음**(writeBatch)
  — 지난 힌트 · 판을 걷고 새것을 깔고 활동 문서를 고칩니다. 반쯤 걸린 퍼즐이 안 남습니다.
- 휴지통의 '완전 삭제'도 두 하위 컬렉션을 함께 지웁니다.
- 시험 `tests/rules/crosswordGroup.test.mjs`(8개) · `tests/unit/crossword.test.mjs`.
- **코드보다 규칙을 먼저 배포하세요** — 옛 규칙에는 두 컬렉션이 없어 생성부터
  권한 오류입니다.
- 실측(데모 1440px, 5모둠 21명, 서로 다른 낱말 70개 남짓): 생성 → 10개(학생 수보다
  적다는 안내) · 활동 문서에 낱말 0 · 모둠마다 2개 · 학생 알약 넷 · 나를 고르면 내
  힌트 칸만 열림 · 남의 이름을 고르면 그 칸은 '○○이(가) 쓰는 중' · 교사 '제출 3 /
  10명' · 낱말 채우기 → 맞게 넣으면 그 칸 초록 · '1 / 8개' · 틀리게 넣으면 그대로 ·
  다른 모둠이 셋 맞히자 교사 미니맵 순위 1위로 · 1440 · 1100 · 820 · 420px 넘침 0.
- 아직 없는 것: 학급 화면에 띄우기(방송) · 모둠 판을 한꺼번에 비우기.

### 낱말 빙고 — 닿소리 채우기의 낱말로 4×4 · 5×5 빙고 (`activity.bingo` · `bingoBoards/{판 id}`)

**제 독서 활동입니다**(`type: 'bingo'`, 열한째 종류 — 배움나눔(class-peer-qna)에서 가져왔고, 2026년 11월에
배움나눔 `62387d1`까지의 고침을 다시 옮겼습니다). 가로세로 낱말 퀴즈처럼 '독서 활동 만들기'에서 **어느
닿소리 채우기의 낱말로 할지**를 고릅니다. 주제어 · 도서 주소는 받지 않습니다(주제어는 그 닿소리의 것을 적어
둠). 화면의 생김(카드 · 세 칸 · 왼쪽 미니맵 순위 · 단추 줄)은 가로세로의 클래스를 그대로 쓰고
(`.xw-card` · `.xwg` · `.xwg-rank` · `.xw-gen-*`), 빙고판 · 낱말 칩 · 낱말 목록 · 부르는 차례만
`app/styles/43-bingo.css`에 있습니다. 셈은 전부 `lib/bingo.js`(시험 `tests/unit/bingo.test.mjs`).

- **만들기 창** — '진행 방식'(모둠 활동 · 개별 활동 — 처음엔 고른 닿소리의 방식)이 한 줄, 그 아래
  **'판 크기'(4×4 · 5×5) ｜ '낱말 부르기'(선생님이 진행 · 학생이 진행)**가 나란히(선생님 요청 — 배움나눔과
  같은 짜임). 세 고르개의 단추는 칸을 꽉 채웁니다(`.book-seg--fill` — 다른 활동의 두 갈래 줄은 180px
  천장 그대로). 크기는 만든 뒤 바꾸지 않고(칸 자리가 뒤섞임), 누가 부를지는 교사 화면에서도 바꿉니다.
  - 판 크기는 활동 문서의 `bingo.size`(없으면 5 — 옛 활동). 4×4는 16칸 · 10줄, 칸 열쇠 "0"~"15"라
    규칙은 그대로("0"~"24"의 부분). 판은 `BingoGrid`의 `size` → CSS `--bingo-n`.
- **판(모둠 문서)** — `addBingoActivity`(`lib/data/books.js`)
  - 개별 활동: **반 명단의 학생마다** 1인 판(id `solo_<uid>` — `addSoloBookBoards`와 같은 모양이라, 만든
    뒤 반에 들어온 학생은 교사 왼쪽 카드의 '판이 없는 학생 n명 — 판 만들기'로 더합니다. 저절로 만들지
    않는 까닭은 닿소리와 같음).
  - 모둠 활동: 닿소리가 모둠 활동이면 **그 모둠을 같은 id로 베껴** 오고(가로세로와 같음 — '학생이
    고르기'는 '임시 모둠'으로), 개별 활동이었으면 **반의 기본 모둠**을 씁니다(기본 모둠이 없으면
    만들기가 꺼지고 까닭을 적음).
- **낱말 상자** — 만들 때 한 번 그 닿소리에서 읽어(`fetchActivityWords`) 활동 문서의 `bingo.words`에
  적습니다(겹친 것 · 20자 넘는 것 뺌, 400개 천장). **많이 쓴 차례**로 적습니다(`bingoWordPool` —
  닿소리에서 그 낱말을 쓴 판 수, `ranked: true`). 빙고에는 숨길 정답이 없어 반 전체가 읽는 문서에 적어도
  됩니다(가로세로와 다른 점). 그 뒤 닿소리에 더 들어온 낱말은 교사의 **'낱말 새로 가져오기'**로 들입니다
  (`refreshBingoWords`).
  - **학생이 고르는 낱말은 많이 쓴 앞의 몇 개만**입니다(`bingo.box` — 4×4는 22개 · 5×5는 35개,
    `BINGO_BOX`, 배움나눔 선생님 요청). 상자 전부(수십~수백 개)에서 고르면 판마다 낱말이 흩어져 빙고가
    한참 늘어졌습니다. 판 채우기 동안 교사가 '낱말 상자: 많이 쓴 n개 · 전체 n개'로 바꿉니다(상자가 그
    수보다 클 때만 섬). `box: 0`은 전부, 표시가 없는 옛 활동도 전부입니다 — 많이 쓴 차례로 적기 전의
    활동에서 '많이 쓴 n개'를 고르면 닿소리에서 다시 읽어 정렬합니다. 학생에게는 ㄱ~ㅎ 차례로 보입니다
    (`bingoBoxWords`).
- 자료
  - 활동 문서 `bingo: { stage: 'fill' | 'play', size, lead: 'teacher' | 'student', words, called: [부른 낱말
    차례대로], by: [그 낱말을 부른 차례의 학생 uid — 선생님이 진행이면 ""], goal: 1~5, order: [부르는 차례
    — 학번순 uid], turn: 지금 차례(order의 몇 번째), box, ranked }`(셈 `normalizeBingo` — 칸이 없는 옛
    활동은 기본값으로 읽음).
  - **교사의 고치기는 모두 `updateBingoState`(트랜잭션)**입니다 — 저장된 상태를 읽어 고쳐 씁니다. 한때 화면의
    상태를 통째로 적었는데(`saveBingoState` — 걷음), 학생이 같은 문서에 부름을 이어 쓰므로 그사이 학생이
    부른 낱말이 지워지거나 차례가 되감겼습니다(배움나눔 검토에서 찾음).
  - `bookActivities/{aId}/bingoBoards/{판 id}` `{ groupId, cells: { "0": 낱말, … "24": 낱말 }, updatedAt }`
    — 판 id = 모둠(판) 문서 id. **칸 하나씩 merge**(`writeBingoCells`, 지울 칸은 `deleteField`)라
    모둠원이 동시에 다른 칸을 채워도 서로 덮지 않습니다.
  - 규칙: 판 읽기는 반 구성원 · 담당 교사(친구 판을 미니맵으로 봄 — 정답이 없음), 쓰기는 **그 판의
    구성원만 · 잠기기 전 · `bingo.stage == 'fill'`일 때만**, 칸 열쇠는 "0"~"24"(`BINGO_CELL_KEYS`와 같아야),
    `groupId`는 경로와 같아야. 지우기는 담당 교사. 활동 문서는 담당 교사가 고치고, 학생은 아래
    `bingoTurnCall`만. 시험 `tests/rules/bingo.test.mjs`.
  - 휴지통의 완전 삭제가 판도 함께 지웁니다.
- **두 단계**(교사 단추)
  1. **판 채우기**(`fill`, 만들자마자) — 학생이 **판을 직접 짭니다**(선생님 요청). 오른쪽 낱말 상자에서
     **낱말을 누르고 → 판에서 넣을 칸을 누르면** 그 칸이 채워집니다(집어 든 낱말은 살구 칩 · 판의 칸에
     살구 점선, 같은 낱말을 다시 누르면 내려놓음 · 채운 칸을 누르면 새 낱말로 바뀜). 칸을 먼저 누르고
     낱말을 눌러도 됩니다. 판에 넣은 낱말은 상자에서 흐려져 다시 못 넣습니다. 단추는 차례대로 **빈칸
     무작위로 채우기**(`bingoRandomFill` — 판에 없는 낱말만) · **한 칸 비우기**(고른 칸 하나 — Delete ·
     Backspace도) · **판 모두 비우기**(되물음). 교사 왼쪽은 채운 칸이 많은 차례(`rankBingoFill`), 머리
     배지 '다 채움 n / N'. **빙고 목표**(1~5줄) · **낱말 부르기** · **낱말 상자**를 여기서 정합니다.
  2. **빙고**(`play`) — '빙고 시작'(다 못 채운 판이 있으면 되묻고, 빈칸은 표시 안 됨 — 차례를 학번순으로
     새로 짬, `bingoStartPatch`). 판이 굳습니다(규칙도). '하나 되돌리기'(누를 때 보이던 마지막 낱말만 —
     그사이 다음 학생이 불렀으면 지우지 않음, `bingoUndo`의 둘째 인자) · '부른 낱말 모두 지우기'(같은
     판으로 다시) · '판 채우기로 돌아가기'(부른 낱말 · 차례를 지우고 판을 다시 열기 — 되물음). 목표 줄
     수 · 누가 부를지는 진행 중에도 바꿉니다.
- **누가 부르나**(`bingo.lead`, 배움나눔 선생님 요청)
  - **선생님이 진행**(기본 · 표시가 없는 옛 활동도) — 교사가 판 오른쪽 '판에 놓인 낱말' 목록에서 누르거나
    **'무작위로 부르기'**. 무작위는 **판에 놓인 안 부른 낱말에서만**(`nextBingoCall` — 아무 판에도 없는 낱말을 부르면
    수업이 늘어짐).
  - **학생이 진행** — **학번 차례대로 한 번씩** 학생이 **제 판의 아직 안 불린 칸을 눌러 고르고 '부르기'**를
    누릅니다(`callBingoTurn` — 트랜잭션, `called` · `by` · `turn` 세 칸만 씀). 마지막 번호 다음은 처음부터.
    모둠 활동이면 모둠 판에서 고르고, 모둠원이 저마다 제 차례를 가집니다.
    - 교사 화면 판 위에 **부르는 차례**(학번순 알약 — 지금 차례 살구 · 이번 바퀴에 부른 학생 옅게 · 결석
      점선 + '결석'), 왼쪽 그 판 카드에 '차례 · 이름'. 학생 화면은 '내 차례예요!'(누를 수 있는 칸에 살구
      테두리) / '지금은 ○○의 차례예요 — 내 앞에 n명', 오른쪽은 불린 낱말 대신 부르는 차례입니다.
    - **결석한 학생의 차례는 선생님이 대신 고릅니다** — 목록에서 누르면 그 학생 몫으로 적히고 다음
      차례로 넘어갑니다. 결석은 **출석을 마친 날에만** 압니다(출석을 받는 중이거나 기록이 없으면 모름 —
      '멋진 순간' 패널 · 닿소리와 같은 기준, 출석 코드는 안 건드리고 페이지의 `todayPresentUids` ·
      `attendanceOpenToday`를 받아 씀). 결석 · 그 학생 판에 부를 낱말이 없음 · 활동이 잠김이면 **되묻지
      않고 곧바로**(안내 줄이 진하게, 목록이 살구 테두리 — `.bingo-callbox.proxy`), 그 밖에는 한
      번 되묻습니다(학생이 고르는 중일 수 있음). '무작위로 대신 고르기'는 그 학생의 판에 남은 낱말에서.
    - **규칙**(`bingoTurnCall`): 학생이 활동 문서를 고치는 것은 **빙고 활동 · 빙고 중 · 학생이 진행 · 안
      잠김 · `order[turn]`이 나 · `called` 끝에 상자의 안 부른 낱말 하나 · `by` 끝에 나 · `turn`은 다음
      번호(정수) · 다른 칸은 그대로**일 때만(반 구성원 판정은 값싼 검사 뒤에). 시험
      `tests/rules/bingo.test.mjs`('학생이 진행' · '책봄에서 더 못 박는 것' — 옛 아무나 부르기 모양 거부).
    - **한때 책봄은 차례 없이 반 학생 누구나 제 판의 칸을 한 번 누르면 곧바로 불렀습니다**(`callBingoWord` ·
      규칙 `bingoStudentCall` — 걷음, 2026년 11월). 여럿이 동시에 눌러 수업이 어수선했고 누가 불렀는지
      남지 않아, 배움나눔의 '학생이 진행'(학번 차례 · '부르기'로 한 번 더 확인)으로 바꿨습니다.
  - 빙고가 아직 시작 전이면 차례는 빙고 시작 때 짭니다. 진행 중에 '학생이 진행'으로 바꾸면 지금 차례였던
    학생부터 이어 갑니다(`bingoLeadPatch`).
- **낱말 목록은 판 오른쪽**입니다(`.bingo-stage` — 판 왼쪽 · `.bingo-callbox` 오른쪽, 배움나눔과 같은 짜임).
  - 빙고 중에는 **'판에 놓인 낱말'**(ㄱ~ㅎ, `bingoBoardWords`)만 줄 모양으로 — 동그라미(부른 차례) · 낱말 ·
    'n판'(놓인 판 수). 부른 줄은 초록, 방금 부른 줄은 살구 테두리. 머리 배지 '부름 n / 판에 놓인 낱말 수'.
  - 판 채우기 동안은 같은 자리에 **낱말 상자**(학생이 고르는 낱말 · 보기만 — 'n판'은 지금 그 낱말을 놓은 판 수).
  - 줄 모양은 학생 화면 '불린 낱말'과 같습니다(`.bingo-wordlist` · `.bingo-wordrow` — 한때 알약 칩).
  - **열 수는 창 폭이 아니라 목록 폭**이 정합니다(한 열 140px 이상). 판과 목록이 한 줄에 서면 목록은 판
    높이만큼만 서고 넘치면 안에서 굴러가며, 줄이 좁으면 목록이 판 아래로 내려갑니다(`@container
    bingostage`). **목록의 기준 폭은 두 열**(318px)이고 판은 320px부터 — 배움나눔 값(판 340 · 목록 260 ·
    문턱 620)을 그대로 쓰면 1440px 창('멋진 순간' 펼침)에서 목록이 두 열에 1px 모자라 한 열로 섰습니다
    (실측). 문턱은 320 + 간격 20 + 318 = **658px**이고 셋을 함께 고쳐야 합니다.
  - 실측(데모, 낱말 35개): 1366px 펼침 판 330 · 두 열 · 1440px 펼침 판 358 · 두 열(목록 안에서 굴림) ·
    1440px 접음 판 488 · **세 열** · 1536~1680px 펼침 두 열 · 1920px 펼침 판 520 · 네 열(굴림 없음) ·
    1280px 이하 목록이 판 아래 세 열 · 420px 판 아래 두 열 · 가로 넘침 0.
  - **한때 떠 있는 패널이었습니다**(`FloatingPanel` · `storageKey` `bingo_call_float` — 끌어 옮기고 접던 창,
    책봄 선생님 요청). 배움나눔처럼 판 오른쪽 목록으로 바꾸며 걷었습니다(선생님 요청, 2026년 11월).
    떠 있는 패널 조각은 가로세로 퀴즈의 '낱말 힌트'가 그대로 씁니다.
- **표시는 저절로** — 부른 낱말이 든 칸은 모든 판에서 옅은 초록, **완성된 줄은 그 줄을 따라 붉은
  직선**(판 바깥까지 조금 더 · 미니맵에도 — `BingoGrid`의 `lines`, 배움나눔 선생님 요청). 한때 줄의 칸을
  짙은 초록으로 칠했는데 줄이 여럿이면 어느 줄인지 안 보였습니다. 방금 부른 낱말의 칸은 살구 테두리.
  셈은 `bingoProgress`.
- **순위**(`rankBingo`) — **완성한 줄이 많은 차례 · 같으면 학번순**(모둠 판은 원래 차례), 0줄끼리는 가로 ·
  세로로 이어진 칸이 긴 차례(`bingoLongestRun`). '몇 번째 낱말에서 빙고'(`bingoAt`)는 보여 주기만 합니다.
  교사 왼쪽 미니맵(칸 12px · 4×4는 15px, 모둠 색 — 불린 칸은 옅게, 빙고 줄은 붉은 직선)이 이 차례로 서고,
  누르면 가운데에 그 판이 크게 섭니다.
  - **카드 머리줄은 빙고 화면에서만 격자**입니다(`.bingo-main .xwg-rank-head` — 번호 · 이름 · 진행 배지가 한
    줄, '차례 · 이름'은 이름 아래 둘째 줄). 책봄은 왼쪽 칸이 좁아(1440px 창에서 카드 210px 안팎) 한 줄에
    두면 모둠 이름이 한 글자씩 세로로 쪼개졌습니다(실측). 가로세로 퀴즈의 같은 카드는 그대로입니다.
- **학생 화면 세 칸**(가로세로 학생 화면과 같은 `.xwg`) — 왼쪽 '나의(우리 모둠) 빙고 한눈에'(미니맵 ·
  막대 — 판 채우기는 채운 칸, 빙고 중에는 줄 수 / 목표) + 판 채우기 동안은 '이렇게 해요', 빙고 중에는
  **'가장 앞선 친구(모둠)'의 미니맵**(나를 뺀 1위 · 같은 순위 셈 · '지금은 내가 앞서요!') ｜ 가운데 판
  (빙고 중에는 방금 불린 낱말을 크게 · 빙고하면 '🎉 빙고!') ｜ 오른쪽 판 채우기는 낱말 상자, 빙고 중에는
  선생님이 진행이면 **불린 낱말**(최근 것이 위 · 내 판에 있으면 '내 판'), 학생이 진행이면 **부르는 차례**.
- **실시간** — 교사 · 학생 모두 판 컬렉션 하나(`subscribeBingoBoards`)와 모둠 목록만 구독합니다. 부른
  낱말 · 차례는 활동 문서(이미 구독 중)에 들어 읽기가 안 늡니다. 두 구독의 **첫 답이 오기 전에는**
  차례를 짜거나(빈 차례가 저장됨) '판이 없는 학생'을 세지 않습니다(`groupsFor` · `boardsFor`).
- 학생이 맡은 판이 없으면(개별 활동인데 만든 뒤 들어옴 · 모둠에 없음) 안내 한 줄입니다.
- **배포 차례 — 규칙을 먼저**: 새 규칙(`bingoTurnCall`)이 없으면 학생이 진행에서 학생의 '부르기'가 권한
  오류이고, 거꾸로 새 규칙에 옛 앱이 남아 있으면 옛 화면의 '칸 한 번 눌러 부르기'가 권한 오류입니다
  (선생님이 진행 · 판 채우기는 둘 다 그대로 됨).
- 실측(데모 1440px, 모둠 셋 · 15명): 빙고 중 붉은 직선 2줄(가로 · 대각선, 미니맵에도) · 판 옆 목록 35줄 중 부름
  9 → '학생이 진행' → 차례 15명(데모 출석의 결석 둘 '결석') · 대신 부르기 되물음 → 2번째로 · 되돌리기 →
  1번째로 · 학생 30101 '내 차례예요!'(누를 수 있는 칸 16) → 고르고 '부르기' → 교사 화면 '바람길 · 김민준
  차례' · 30103 '다음이 내 차례예요!' · 4번째(결석) 차례에 목록 강조 · 되묻지 않고 곧바로 → 5번째 · 판
  채우기 '낱말 상자 35개 / 전체 58개' · 만들기 창 → 개별 활동 4×4 학생이 진행(상자 22개) · 420px 가로
  넘침 0 · 오류 0.
- **책봄에서 더한 것**(배움나눔에는 없는 화면이라):
  - 분석 리포트 — `lib/dashboard.js`의 `case "bingo"`(진행 = 채운 칸 n/25, 빙고 중이면 모둠 진행 자리에
    `n줄 / 목표 n줄` · `빙고! n줄`)와 서버 읽기(`lib/server/dashboardService.js`의 `ACTIVITY_TYPES` ·
    `bookBingoBoards` — 모둠(판)마다 판 문서 하나). 개별 활동도 판(1인 모둠)이 있어 `needsBoard`입니다.
    활동 보고서(`lib/activityReport.js`)는 `bingoProgress`의 `total`(판 칸 수)을 씁니다 — 배움나눔에는 없는
    칸이라 옮길 때 더해 두었습니다.
  - 데모 반 — `lib/demoBookActivities.js`의 `makeBingo`: 닿소리 데모 낱말을 많이 쓴 차례로 상자(앞의 35개로
    판을 채움), 세 모둠 판(둘은 25칸 · 하나는 18칸), '빙고 중' · 선생님이 진행 · 목표 2줄(첫 모둠이 2줄
    빙고) · 차례는 학번순 15명. 시험 `tests/unit/demoBookActivities.test.mjs`.
  - 학생 화면의 잠김 안내는 `components/BookHeadParts.jsx`의 `BookLockedNote`, 교사 머리말은 다른 독서
    활동과 같은 짜임(`BookLockToggle` · 반 고르개 · 진행 요약 — 배움나눔의 `BookBoardHead`는 안 들임).
  - 교사 화면에는 '기록 관리'(classTools) 자리가 없습니다(책봄에서 걷은 기능).

### 브레인 라이팅 — 모둠원마다 세로 칸, 앞 사람의 글에 이어 쓰기 (`groups/{gId}/bwNotes`)

책방의 열째 독서 활동(`type: 'brainwrite'`, 선생님 요청). 교사가 **질문 하나**를 적어
만들면(`prompt`, 200자 · 필수), 모둠원마다 **세로 칸(컬럼)** 하나가 생깁니다. 컬럼 맨 위는
그 주인이고 주인이 첫 줄에 제 생각이나 질문을 남기며, 그 아래로 모둠원이 **학번순으로 주인
다음부터 돌아가며**(`columnOrder`) 앞 사람의 글에 이어 질문하거나 생각을 보탭니다. 5명
모둠이면 컬럼 5개 × 줄 5개 — 저마다 다섯 컬럼에 한 줄씩. 셈은 전부 `lib/brainwrite.js`
(시험 `tests/unit/brainwrite.test.mjs`).

- **늘 모둠 활동입니다** — 개별이면 이을 앞 사람이 없습니다. 만들 때 `grouped: true`를
  적고(`addBookActivity`), 만들기 창은 '진행 방식' 자리에 **질문 칸**이 섭니다(개별
  활동을 고를 수 없으므로 그 물음 대신 — 제 줄을 두면 창이 46px 넘쳤습니다, 실측).
  모둠 구성(기본 모둠 / 이 활동만의 모둠)은 다른 모둠 활동과 같습니다. **주제어 · 도서명
  칸은 받지 않습니다**(질문이 그 자리 — 선생님 요청, 만들기 · 편집 창 둘 다 감춤, 저장은
  빈 `topic`). 도서 주소는 선택. 편집 창에서 질문을 고칩니다(비우면 막음).
- **저장** — `bookActivities/{aId}/groups/{gId}/bwNotes/{주인uid}_{쓴사람uid}` =
  `{ ownerUid, writerUid, writerName, text(1000자), updatedAt }`. 한 사람이 한 컬럼에
  한 줄(문서 id가 못 박음). 모둠 아래라 규칙이 경로의 모둠 id로 곧바로 '내 모둠인가'를
  봅니다(가로세로 힌트와 같은 길).
- **학생 화면**(`BrainWriteForm`) — 위에 질문, 왼쪽 '우리 모둠 칸'(학번순 · 내 칸에 '나' ·
  그 칸에 내 줄을 썼으면 '✓ 씀'), 가운데 고른 컬럼. **내 이름이 있는 줄만 쓰는 칸**이고
  나머지는 읽기만. 처음엔 내 컬럼.
  - **앞 사람이 써야 내 줄이 열립니다**(선생님 요청 — `rowWritable`). 첫 줄(주인)은 늘,
    그 밖은 바로 앞 줄이 채워졌을 때만 입력칸이 서고, 아니면 그 자리에 점선 안내 '앞
    사람(○○)이 글을 남기면 이어 쓸 수 있어요.'(`.bw-row-wait`). 이미 써 둔 줄(쓰는 중
    포함)은 앞 사람이 나중에 지워도 계속 고칩니다. 왼쪽 목록의 상태도 '✓ 씀 · 내 차례 ·
    기다림'(`writerSlots`의 `done` · `ready`).
  - **막는 것은 화면뿐입니다** — 규칙은 학번 차례를 셀 수 없어 그대로입니다(옛 화면이나
    직접 쓰기는 막지 못함).
  - 저장은 0.8초 모아 저절로
  (컬럼마다 따로 · 다른 칸으로 옮길 때와 칸을 벗어날 때 곧바로), 줄 머리에 저장 상태.
  모둠이 없으면 안내('학생이 고르기'면 `GroupJoinRow`).
- **교사 화면**(`BrainWriteBoard`) — 세 칸(`.book-workspace`). 왼쪽 **모둠 카드**(RAFT 모둠
  카드와 같은 이름 알약 — 다 쓴 학생 초록), 가운데 **고른 학생의 컬럼**(읽기만 — 가운데 칸
  안에서 **가운데 정렬**, 폭 720px `.bw-col-wrap`), 오른쪽 **학생별 진행 조각 바**
  (`EntryProgressPanel`) — 칸 k가 'k번째로 이어 쓰는 줄'(`writerSlots`)이고 다 씀 초록 ·
  내 차례 주황 · 기다림 회색입니다.
  - **컬럼 머리 오른쪽 위에 '수업 시작'**(방송) — 누르면 그 학생의 컬럼을 학급 화면에
    띄우고 수업 화면 창(`CastStageModal`)이 열립니다. 꾸러미는 `mode: "entry"`(label
    `○○의 칸` · labelEn 모둠 이름 · prompt 질문 · 칸마다 `n · 쓴 사람` / 글 — 방송 열쇠
    `col`)라 학생 쪽 `PresentationOverlay`를 안 건드립니다. **이전 · 다음 학생**(키보드
    ← →)은 왼쪽 모둠 카드의 차례 그대로(모둠 없는 학생은 뺌), 넘기면 가운데도 따라옵니다.
    띄우는 중이면 단추가 '수업 화면 보기'. 글이 바뀌면 `useLiveUpdate`로 칠판도 따라갑니다.
    페이지가 `classId` · `user`를 내려 줍니다.
  - **전광판 — '이어쓰는중 전광판'**(`BrainWriteProgressBoard`, 머리말 진행 요약 옆).
    껍데기는 `BookProgressBoard` 그대로, 한 줄 = k번째 줄(`내 칸 · 첫 줄` · `2번째 줄` …),
    한 칸 = 학생. 상태 넷 — 다 씀 · 내 차례 · 기다림 · **자리 없음**(점선 — 모둠이 작아
    그 차례가 없음, `BookProgressBoard`에 `none` 상태와 범례 말을 바꾸는 `labels` prop을
    더함 — 다른 전광판은 그대로). '내 차례'에 오래 머무는 학생이 흐름을 막는 학생입니다. 모둠 크기가 달라 칸 수가 학생마다 달라서
  - **오른쪽 진행은 왼쪽에서 고른 학생의 모둠만** 섭니다(선생님 요청 — 반 전체는 전광판). 아직 아무도 안
    골랐으면 안내 한 줄. 제목은 `n모둠 진행`. 빈 목록의 말은 `EntryProgressPanel`의 `emptyText`.
  `EntryProgressPanel`에 **`rowsOf`**(학생마다의 칸 정의, `cellState`는 셋째 인자로 카드)를
  더했습니다 — 다른 활동은 그대로입니다. 머리말에 '활동 모둠'(GroupComposer)과 진행 요약.
  모둠에 없는 학생은 왼쪽 맨 아래 '모둠 없음'.
- **읽기** — 학생은 우리 모둠 하나, 교사는 모둠마다 구독(모둠 여섯이면 리스너 여섯).
  페이지는 모둠을 구독하지 않습니다(`isSolo`에 듦 — 화면이 스스로 구독).
- **규칙을 새로 열었습니다**(`match /bwNotes/{nId}`) — 읽기는 그 모둠 · 담당 교사, 쓰기는
  그 모둠원이 **제 줄만**(`writerUid == 나` · id = `주인_나` · 주인도 이 모둠원) · 잠기기
  전 · 칸을 못 박음 · 1000자(`BW_TEXT_MAX`와 같아야), 지우기는 담당 교사. 시험
  `tests/rules/brainwrite.test.mjs`. **코드보다 규칙을 먼저 배포하세요** — 안 그러면 학생
  저장이 권한 오류입니다. 휴지통의 완전 삭제가 `bwNotes`도 지웁니다.
- 실측(데모 1440 · 420px, 5명 · 4명 두 모둠): 학생2의 컬럼 차례 학생2 · 3 · 4 · 5 · 1 ·
  학생1 컬럼에서 내 줄만 쓰는 칸 · 학생4가 학생3 칸에 쓰면 '저장됨' · '✓ 씀' · 교사 진행
  `3/5칸 · 61자` · 4명 모둠은 `0/4칸` · 만들기 창 1600×1200에서 908px 안에서 안 구름 ·
  가로 넘침 0.
- 실측(방송 · 전광판 · 차례, 데모 1440px): 컬럼 좌우 여백 같음(62px씩) · 수업 시작 →
  창 `1 / 9` · 칸 다섯 · → 로 학생2 · 전광판 다섯 줄 · 범례 넷 · 학생3은 학생1 · 학생2의
  컬럼에서 입력칸, 학생4의 컬럼에서는 '앞 사람(학생2)이 …' · 만들기 창 넘침 0.
- 아직 없는 것: 한 눈에 보기 · 모둠의 컬럼을 한 화면에 나란히 보기.

### 상단바 가운데 — 반별 '독서 TOP 3' (`ClassTopReaders`)

- 지금 반(교사는 고른 반, 학생은 소속 반)에서 **레벨 → 누적 경험치 → 그 경험치에 먼저 이른 날
  (`xpReachedOn` — 경험치가 붙은 마지막 기록의 날짜) → 학번** 차례로 셋을 캐릭터 · 레벨 · 이름으로
  보여 줍니다(셈은 `lib/readingJourney.js`의 `topReaders`, 0 EXP · 사용 중지된 학생은 뺌). 책나눔 성장 기능이
  켜지고 관리자 설정의 '독서 TOP 3'를 끄지 않은 반에서만 섭니다(선생님 요청 — 리더보드와 따로 켜고 끔, `readingTopOn`).
- **한 주 내내 같은 셋입니다** — 서울 시각 월요일 오전 7시에 바뀌고, 지난 일요일까지의 기록으로 셉니다
  (서버가 반마다 한 주에 한 번 셈해 `classes/{c}/readingTop/current`에 적음 · `READING_GROWTH.md`의
  '서버에 다시 묻는 때'). 한때 2분마다 다시 물었습니다 — **주기적으로 묻게 되돌리지 마세요.**
- 칸이 좁으면 이름표 → 메달 → 레벨 차례로 접습니다(`@container topmq`).
- **이 자리는 한때 옛 전광판(교사가 건 칭찬 한 줄 — `meta/marquee`)이었습니다.** 그 코드 · 규칙 · CSS는
  걷었습니다(되살리지 마세요). 아래 배치 약속은 그때 정한 것이 그대로 이어집니다.

**상단바 배치**

- **감싼 칸 `.topbar-mq-slot`을 없애지 마세요.** 왼쪽 묶음(로고 · 이동 메뉴)과 오른쪽 묶음(아이콘)
  사이의 남는 가로를 이 칸(`flex: 1 1 0`)이 받고, 내용은 그 안에서 가운데에 섭니다 — 그래서 좌우 여백이
  늘 같습니다. 내용이 직접 `flex-basis: auto`로 서면 **그 글자 폭이 그대로 줄바꿈을 부릅니다**(769px에서
  로고 아래로 떨어져 상단바가 네 줄이 된 일이 있었음 — 줄을 나누는 셈은 줄인 뒤가 아니라 기준 폭으로
  합니다). 768px 이하에서는 **내용이 아니라 이 칸을** 접어야 합니다.
- **손바닥 자리를 비워 두는 것은 그대로입니다**(`.question-signal-hold`). 손이 오르내릴 때마다 아이콘 줄이
  28px씩 들썩이면 가운데 칸도 함께 움직입니다. 손바닥은 늘 28px 고정 — 교사 화면의 인원수 숫자는 **불
  자리에 떠 있어**(absolute) 폭을 안 바꿉니다. **돌발 퀴즈 메모지는 늘 섭니다**(반이 있으면, 손바닥 오른쪽).
- 넓은 화면은 한 줄이고, 좁아지면 이동 메뉴만 2행으로 내려갑니다(줄을 가르는 빈 칸 `.topbar-gap` —
  폭 100% · 높이 0). **아이콘은 첫 줄 오른쪽 끝에 그대로** 둡니다 — 메뉴와 함께 내렸을 때 첫 줄 오른쪽이
  통째로 비어 가운데 칸이 화면 중심에서 어긋났습니다. `TopNav.jsx`에 적힌 차례가 넓은 화면의 보이는 차례이자
  탭 이동 차례입니다(CSS의 order는 탭 순서를 안 바꿈).
- 좁아지면 **단추를 줄이는 대신 메뉴 줄이 옆으로 구릅니다**(`overflow-x` + 단추의 `flex-shrink: 0`).
  예전에는 브라우저가 글자를 쪼개 메뉴 이름이 세로로 섰습니다. 이동 메뉴 단추의 좌우 여백이 기본
  `.btn-ghost`(6/12)보다 좁은 것은 그대로 둡니다 — **`.btn-ghost` 자체를 고치지 마세요**(앱 전체가 씀).
- **'작은 변화로 시작하는 성장의 기록' 문구는 상단바가 아니라 책방 제목 바로 위**입니다(`PageTagline` —
  글자는 `components/PageTagline.jsx`의 `PAGE_TAGLINE` 한 곳, 세리프 15px/700 · `--text-sub`).
- **로그아웃은 프로필 메뉴 안**, 마지막에 선으로 갈라 둡니다(`.profile-menu-item--out`) — 위의 것은
  '여는 것'이고 이것은 '나가는 것'이라 나란히 두면 잘못 눌러 로그아웃됩니다.
- **mock은 반 문서를 갈아 끼웁니다**(제자리에서 고치지 않고). 문서 하나를 구독하는 쪽이 늘 같은 참조를
  받아 React가 다시 그리지 않습니다 — `subscribeClass`도 얕은 사본을 넘깁니다.

### 서식 에디터 — 전송 버튼은 박스 아래 제 줄

- `variant="chat"`은 **두 덩이**를 내놓습니다 — 박스(`.rte`)와 그 아래
  전송 줄(`.rte-sendrow`, 오른쪽 끝). 감싸는 칸을 새로 두지 않고
  **형제로** 내보내므로, 쓰는 자리가 **세로 flex**라야 줄이 제대로 섭니다
  (지금 쓰는 곳은 메신저의 쓰는 칸 — 세로 flex입니다).
  바깥에 칸을 하나 더 두면 `.rte`를 겨냥해 둔 규칙들이 한 겹 어긋납니다.
- **왜 옮겼나**: 예전에는 채팅 툴바 오른쪽 끝에 `margin-left: auto`로
  붙어 있었는데, 그 줄에 도구가 아홉(첨부·그리기 · B·I·U · 글머리·번호·
  체크 · 코드)이라 좁은 칸에서 줄이 넘쳐 **전송 버튼이 세로로 잘렸습니다**
  (`.rte`가 `overflow: hidden`이라 그대로 깎입니다 — 실제 신고).
  실측: 박스가 **378px 아래로 내려가면** 잘리기 시작해 366px에서 24/34px,
  346px에서 4/34px, 316px에서 아예 안 보였습니다.
- 줄을 따로 두니 **폭에 안 걸리고**(실측 316~386px에서 94px 온전히 보임)
  글자를 달 자리가 생겨 `✈ 보내기`가 됐습니다 — 그림 하나로 짐작하던
  자리에 할 일이 적힙니다. 대가는 세로 **약 42px**(줄 34 + 여백 8).
- **툴바는 넘치면 옆으로 구릅니다**(`overflow-x: auto` + 단추의
  `flex-shrink: 0`, 스크롤바는 감춤). 상단바 이동 메뉴와 같은 방식입니다 —
  아이콘을 쭈그려 알아보기 어렵게 만드는 것보다 낫습니다. 전송이 빠져
  실제로 구르는 것은 박스가 340px 아래일 때뿐입니다(실측).
- `toolbarTop`(메신저)은 **툴바만** 위로 갑니다 — 전송 줄은 어느 쪽이든
  맨 아래입니다.
- 모바일(768px 이하)에서는 단추만 조금 줄입니다(34 → 32px). 그 자리의
  `.rte-send { width: 30px }`는 **걷어 냈습니다** — 글자가 든 알약이라
  폭을 못 박으면 '보내기'가 잘립니다.

### 서식 에디터 — '- '로 글머리 기호

- 줄 맨 앞에 붙임표 하나를 적고 **띄어쓰기**를 누르면 그 줄이 글머리 기호가
  됩니다(`RichTextEditor`의 `dashToBullet`). 마크다운을 쓰는 손이 그대로
  통해, 여러 줄을 잇달아 적을 때 툴바를 짚으러 가느라 흐름이 안 끊깁니다.
  `RichTextEditor`를 쓰는 자리 전부에 걸립니다(메신저 · 동료 평가 · 돌발 퀴즈…).
- **툴바에 글머리 기호가 있는 에디터에서만** 합니다(`canBullet`) — `tools`로
  좁혀 둔 자리에서 저절로 목록이 생기면 되돌릴 단추가 없습니다.
- 안 걸리는 자리 셋: 이미 목록 안(`isInList`) · 코드 블록 안(거기 '-'는 진짜
  붙임표) · 줄 가운데(`a - b`). 판정은 **커서 앞 같은 줄의 글자가 정확히
  '-' 하나**일 때뿐입니다.
- **줄은 블록에서도, `<br>`에서도 새로 시작합니다.** `Range.toString()`은
  `<br>`을 없는 셈 쳐서 앞줄까지 이어 붙이므로(`<div>가나<br>-|</div>` →
  `가나-`), `linePrefix`가 조각을 떠서 직접 훑고 `<br>`을 만나면 지금까지
  모은 것을 버립니다. 그래서 Shift+Enter로 접은 줄에서도 앞줄을 안 건드리고
  그 줄만 목록이 됩니다(실측 `가나<br><ul><li>다</li></ul>`).
- 붙임표는 `execCommand('delete')`로 지웁니다 — 커서 앞 한 글자라 범위를 손으로
  잡을 것 없이 정확하고, **Ctrl+Z 두 번이면 '- '로 돌아옵니다**(한 번은 목록,
  한 번은 붙임표). 진짜로 붙임표를 적고 싶을 때 빠져나갈 길입니다.
- `'* '`는 안 걸립니다 — 붙임표 하나로 충분하고, 문 하나에 판정도 하나입니다.

### 서식 에디터 — '```'로 코드 블록

- 줄 맨 앞에 **백틱 셋**을 적으면 그 줄이 코드 블록이 됩니다
  (`RichTextEditor`의 `ticksToCode`). `- `로 글머리 기호를 만드는 것과 **같은
  결·같은 판정**입니다 — 툴바의 `</>`를 짚으러 가지 않아도 마크다운을 쓰는
  손이 그대로 통합니다.
- **셋째 백틱을 칠 때** 바뀝니다(넷째가 아니라). 앞의 둘은 이미 화면에 있어
  '한 번 더 치면 되겠다'가 보이고, 마크다운 편집기들도 그렇습니다.
- **툴바에 코드 블록이 있는 에디터에서만**(`canCode`) — `tools`로 좁혀 둔
  자리에서 저절로 블록이 생기면 되돌릴 단추가 없습니다(`canBullet`과 같은 까닭).
- 안 걸리는 자리 둘: **코드 블록 안**(거기 백틱은 진짜 백틱입니다 — 가로채면
  블록 안에 블록이 생기고 파이썬 문자열에 백틱을 적을 길도 막힙니다) ·
  **줄 가운데**(`값은 a```). 판정은 **커서 앞 같은 줄의 글자가 정확히 '``'
  둘**일 때뿐이고, `linePrefix`를 그대로 나눠 씁니다.
- 넣는 것은 **`insertCodeBlock` 그 함수**입니다 — 툴바 단추와 한 곳을 쓰므로
  빈 블록의 공백 한 칸과 그 **앞**에 서는 커서까지 그대로 따라옵니다(둘이
  갈리면 단축키로 만든 블록에서만 첫 줄이 한 칸 들여쓰기됩니다).
- 앞의 백틱 둘은 `execCommand('delete')`로 지웁니다 — **Ctrl+Z 두 번이면
  '``'로 돌아옵니다**(실측: 한 번은 블록, 한 번은 지운 백틱). 진짜로 백틱을
  적고 싶을 때 빠져나갈 길입니다.
- 실측으로 확인한 자리: 줄 맨 앞 · Enter로 넘긴 둘째 줄 · Shift+Enter로 접은
  줄(`<br>` 뒤) · 글머리 기호 줄 맨 앞 — 넷 다 걸리고, 블록 안 · 줄 가운데 ·
  `` `x ``는 그대로 글자로 남습니다.

### 코드 블록은 한 번에 사라집니다

- 안을 다 지워도 **빈 검은 블록이 한 줄 남아** backspace를 한 번 더 눌러야
  했습니다. 마지막 글자를 지우는 그 backspace가 블록까지 함께 걷어 가야,
  지우는 사람 눈에 '다 지웠다'와 '사라졌다'가 한 동작이 됩니다
  (`preWillEmpty` → `dropPre`, 자리에는 빈 줄 하나를 둡니다).
- **판정은 글자 수가 아니라 `trim()` 뒤의 길이로.** 코드 블록은 만들 때
  빈칸 하나로 시작해서(`escapeHtml(...) || " "`), 글자 수로 세면 보이는 것을
  다 지운 뒤에도 공백 하나가 남아 **고치려던 그 증상이 그대로 납니다**
  (실측 — `" ab"`에서 두 번 지우면 `" "`가 남음). 커서만 있을 때는
  `text.trim().length <= 1`, 골라 놓고 지울 때는 고른 것이 블록의 전부인가.
- 블록 위아래의 글은 건드리지 않습니다 — 블록만 빈 줄로 바뀝니다.
- **되돌릴 때는 Ctrl+Z가 아니라 '```'입니다.** `dropPre`는 `replaceWith`로
  DOM을 직접 고치는데 그건 브라우저의 되돌리기 목록에 안 올라가, 블록이
  사라진 뒤 Ctrl+Z를 눌러도 안 돌아옵니다(실측). 고치려고 지우다 블록까지
  걷힌 학생은 그 자리에서 백틱 셋을 다시 치면 됩니다 — 위 단축키를 둔
  까닭의 절반이 이것입니다. **되돌리기로 살리려면** `dropPre`를 execCommand
  경로로 다시 짜야 하는데, 그러면 '빈 블록이 한 줄 남는' 원래 증상이 도로
  살아날 위험이 있어 지금은 안 건드립니다.

### 손들기 — 태그와 메모를 함께

- 손바닥 하나로는 '질문이 있다'까지만 전해집니다. 학생이 손바닥을 누르면
  **그 옆에 작은 창**(`.question-signal-ask`)이 열려 태그 하나와 짧은 메모를
  함께 보냅니다. 교사는 다가가기 전에 무엇인지 압니다.
- 태그는 셋으로 못 박습니다(`lib/questionTags.js`) — 선생님, 질문이요! ·
  이런 기능 어때요? · 으악! 오류 발견!. 고르는 데 시간이 들면 손드는 일
  자체가 부담이 되어서요. **저장에는 key만** 들어가므로 나중에 말을 다듬어도
  지난 기록이 따라옵니다.
- **셋은 같은 크기**입니다(한 줄 3칸 격자 `1fr`). 창을 400px로 잡아야 한 칸이
  121px이 되어 아홉 글자가 한 줄에 섭니다(340px이면 101px이라 잘립니다 —
  실측). 학생 창의 알약에는 **이모지를 안 답니다**(그만큼 글자가 잘립니다).
  교사 목록은 알약이 하나뿐이라 자리가 남아 이모지를 답니다.
  - `.question-signal-ask`의 폭은 `.question-signal-dropdown`(330px)과
    특이도가 같고 뒤에 오므로, **이름을 겹쳐 써서**(`.question-signal-dropdown.question-signal-ask`)
    이깁니다 — 순서에 기대지 않게.
- 단추 둘(**내용 없이 손들기 · 내용과 함께 손들기**)은 **한 줄에 반씩**입니다
  (`.modal-actions`와 같은 `grid-template-columns: 1fr 1fr` — `flex: 1 1 0`으로
  두면 테두리가 있는 `.btn-ghost`가 2px 넓어집니다). 둘 다 손을 드는 단추이고,
  적은 내용이 있는 쪽만 채운 색입니다. 창이 400px이라 한 칸이 184px이고 긴
  쪽도 한 줄에 섭니다(실측) — 말을 늘리면 다시 재 보세요.
- 이미 손을 들었으면 창이 **대화**가 됩니다 — 아래 '대화(스레드)' 절. (한때 그
  값이 채워진 채 열려 고쳐 보냈는데, 대화가 생기며 '이어 적기'로 바뀌었습니다.)
- 교사 목록은 이름 줄 아래에 그 학생의 **대화**(첫 물음의 태그 → 메모, 이어서
  오간 말)를 답니다. 🍊 확인 · 닫기는 지금까지대로 이름 줄에 있습니다.
- **교사 손바닥의 불에 손든 인원이 숫자로 섭니다**(`.question-signal-count`, 선생님
  요청 — 질문이 아니어도 '아는 사람 손!'처럼 **투표로도** 쓰려고). 불 자리 그대로
  숫자만 담은 뱃지이고, 손바닥 위로 올려 손가락 끝만 걸칩니다(높이 14px · 글자 9px — 선생님 요청으로 17px에서 줄임 · top −5 · right −4 —
  옆 메모지와의 틈이 4px이라 오른쪽으로 더 내밀지 마세요). 답을 기다리는 학생이
  있으면 빨강, 다 답했으면 회색(`is-quiet` — 손은 올라가 있으니 숫자는 남김).
  - **손바닥 옆 칸에 따로 세우지 마세요** — 한때 그렇게 했더니 불과 숫자가 둘로
    나뉘어 보였습니다(선생님 지적). 그보다 전에는 손바닥이 34px일 때 귀퉁이 뱃지가
    손바닥을 덮어 걷은 적도 있습니다 — 지금은 28px 상자 밖으로 반쯤 걸쳐 앉힙니다.
  - 학생 화면은 그대로 숫자 없는 점 하나입니다.
- **'모두 손 내리기'**(교사 목록 머리줄, 자리확인 오른쪽 — 손든 학생이 있을 때만) —
  투표를 센 뒤 다음 물음으로 넘어갈 때 한꺼번에 내립니다. '닫기'와 같은 길
  (`dismissQuestionSignal` — 과일 없음, 주고받은 말은 이력에 남음). 되묻는 창 대신
  **한 번 더 누르게** 합니다(`n명 내릴까요?` — 4초 뒤 되돌아감, 목록 창 위에 창을 또
  안 띄우려고). 학생마다 문서를 지우는 일이라 **규칙을 안 건드립니다**(담당 교사의
  손들기 지우기는 원래 열려 있음).
  - 실측(데모 1440px, 3명 · 25명): 손바닥 폭 28px 그대로 · 뱃지 '3' · '25' · 한 번
    누르면 'n명 내릴까요?' · 한 번 더 누르면 손바닥이 사라지고 빈 상자만.
- **규칙에 길이를 못 박았습니다**(`questionSignalSaid` — tag 20자 · note
  1000자). 메모는 교사 화면에 그대로 뿌려지는 글이라서요. 둘 다 없어도 손은
  올라갑니다(그냥 부르는 손). 시험은 `tests/rules/questionSignals.test.mjs`.

**대화(스레드) — 교사가 닫기 전까지 주고받은 말이 모두 보이고, 이력으로 남습니다**
(`classes/{cId}/signalMessages/{자동 id}`, 셈은 `lib/signalThread.js`)

- **대화 한 줄기 = 같은 `threadId`의 말들.** 학생이 손을 **새로** 들 때 화면이
  줄기 id를 지어 손들기 문서(`threadId`)에 적고, 첫 물음(태그·메모)을 `kind:
  'first'` 말로도 남깁니다(`setQuestionSignal`). 그 뒤 오간 말이 같은 id로
  쌓입니다. `threadId`가 생기기 전에 든 손은 손든 시각으로 열쇠를 짓습니다
  (`threadKeyOf` — 교사·학생이 같은 값을 얻도록 서버 시각만 씀).
- 학생 창과 교사 목록이 **같은 줄기를 시간순으로** 그립니다(`SignalThread` —
  `components/SignalThread.jsx`, 이력 창도 같은 것. 보는 사람의 말이 오른쪽·
  살구빛, 선생님 말은 연한 초록, 학생 말은 회색). 손이 올라가 있는 동안 첫 줄은
  손들기 문서의 값, 손이 내려간 뒤(닫힌 대화 · 이력)에는 첫 물음 말입니다.
- **학생**: 손이 올라가 있으면 창이 '질문 대화' — 대화 + 이어 적는 칸 +
  `해결됐어요 · 손 내리기` ｜ `보내기`(Ctrl+Enter). 손이 내려가 있으면 손들기 칸.
- **교사**: 학생 줄마다 대화 + `💬 답하기`(답한 뒤로는 `이어서 답하기`). 답을
  기다리는 학생 줄은 왼쪽에 빨간 띠와 '· 답을 기다려요'. `🍊 확인` · `닫기`가
  **대화를 끝냅니다**(손이 내려감 — 말은 이력으로 남음).
- **불**
  - 교사: 빨간 불 = 마지막 말이 학생의 것인 대화가 있다(`awaitsTeacher`). 다 답했으면
    손바닥은 남되 불이 꺼지고 기울기도 풀립니다.
  - 학생: 빨간 불 = 내 말이 답을 기다림 · 초록 불 = 안 본 선생님 말. **손바닥을
    눌러 창을 열면 빨강이든 초록이든 불이 모두 꺼집니다**(`studentLight` ·
    `seenLast`, 선생님 요청 — 답을 확인하려고 눌렀는데 빨간 불이 남는다는 신고).
    그 뒤 새 말이 와야 다시 켜집니다: 선생님 말 → 초록, 학생이 창에서 이어 적은
    말 → 창을 닫으면 빨강(이어 적은 말은 '봤다'로 치지 않음). 창이 열린 채 선생님
    말이 오면 곧바로 봄.
  - '봤다'는 손들기 문서의 `seenAt`(서버 시각) + 이 기기에서 방금 본 마지막 말 id
    (`seenLocal`).
- **말은 지우지 않습니다 — 이력.** 교사가 자리표의 과일 창(`StudentToolsPopover`)
  에서 **`🖐️ 손들고 대화한 이력`**을 누르면 `SignalHistoryModal`이 그 학생이 이
  반에서 손들고 나눈 대화를 줄기마다(최근 것이 위, 줄기 안은 시간순, 날짜·시각)
  보여 줍니다(`fetchSignalHistory` — 열 때 한 번 읽음 · `groupHistory`).
  **교사만** — 그 팝오버가 교사 화면에만 뜹니다(규칙상 학생도 제 말은 읽지만
  앱에 그 화면이 없습니다).
  - 창은 body에 포털, z-index 340(과일 팝오버 320 위). 창이 떠 있는 동안 팝오버의
    '바깥 누르면 닫기'·Esc를 쉽니다(`usePopoverDismiss(!historyOpen, …)`) — 안
    쉬면 창을 누르는 순간 팝오버가 닫히며 창도 함께 사라집니다. Esc는 창만 닫음.
  - **줄기마다 접고 폅니다**(선생님 요청) — 머리줄(▸ 날짜·시각 · 접힌 동안 첫
    물음 한 줄(말줄임, 글이 없으면 '내용 없이 손들기') · 말 n개) 전체가 여닫는
    단추이고(`aria-expanded`), 처음에는 **가장 최근 대화만** 펴 둡니다. 삼각형은
    반별 현황처럼 선 그림(SVG). 실측(데모): 줄기 셋 · 둘째를 펴고 첫째를 접으면
    그 둘만 바뀜 · 가로 넘침 0.
  - **이 기능 전의 대화는 없습니다** — 한때 대화를 끝낼 때 말을 지웠습니다.
- **읽는 범위** — 교사는 **지금 손든 학생들의 줄기만** 늘 듣습니다
  (`subscribeSignalThreads` — `threadId in [...]`, 30개씩 나눔). 이력이 쌓여도
  읽는 양이 손든 학생 수만큼입니다. 학생은 제 줄기 하나(`subscribeMySignalThread`
  — `uid ==` · `threadId ==` 등호 둘이라 복합 색인 없음).
- **닫힌 대화** — 교사가 답하고 곧바로 '확인'을 누르는 일이 흔해, 학생이 그 답을
  못 본 채 손이 내려갈 수 있습니다. 학생 화면은 마지막 줄기를 **이 기기에**
  적어 두고(`localStorage` `qsig_thread:{반}:{uid}` = `{ key, seen }`), 손이
  내려갔는데 그 줄기에 안 본 선생님 말이 있으면 초록 불 → 열면 '질문 대화 · 닫힘'
  으로 한 번 보여 주고 봤다고 적습니다. 아래 '새로 질문하기'로 손들기 칸.
  - 손이 올라가 있는 동안 본 선생님 말도 `seen`에 적어, 닫힌 뒤 다시 알리지 않습니다.
  - **다른 기기에서는 닫힌 대화 알림이 안 뜹니다**(줄기 id가 그 기기에만 있음).
  - 손 문서의 첫 답이 오기 전에는 판정을 안 합니다(`mineLoaded`).
- **규칙**(`signalMessageOk` · `match /signalMessages`): 칸은 `classId · uid(그 학생) ·
  threadId(1~40자) · from · kind?('first'만, 학생만) · tag?(20자) · text(1~1000자 —
  첫 물음만 빈 글 허용) · byUid(본인) · at(서버 시각)`. 학생은 **제 대화에, 손이
  올라가 있을 때만**(`exists(questionSignals/{나})`), 교사는 담당 반(보관된 반 불가).
  고치기 없음 · **지우기는 담당 교사만**(학생은 못 지움 — 이력). 읽기는 그 학생과
  담당 교사 — 학생의 목록은 `where uid == 나`여야 통과. 학생 '봤음'(`seenAt`)은
  손들기 문서의 학생 update 그대로. 시험 `tests/rules/signalMessages.test.mjs`.
- **코드보다 규칙을 먼저 배포하세요** — 안 그러면 손들기의 첫 물음 기록 · 답하기 ·
  이어 적기가 권한 오류입니다(손 자체는 올라갑니다 — 첫 물음 기록 실패는 넘어감).
- **한때 `signalReplies`(학생마다 마지막 답 한 장)였습니다.** 답이 덮여 대화가 남지
  않아 걷었습니다(남은 문서는 읽는 곳이 없음 — 반 삭제 때 `purgeClass`가 정리).
- 학생 탈퇴(`withdrawStudent`)가 그 학생의 말(`uid ==`)을 함께 지웁니다. 반 완전 삭제
  때는 `purgeClass`가 정리합니다(말에는 이름이 없습니다 — uid · 글).
- 실측(데모 1440px): 손들기 빨강 → 손바닥 누르면 꺼짐 → 교사 답(교사 불 꺼짐 ·
  학생 초록) → 열면 꺼짐 → 이어 묻기 후 닫으면 빨강 → 다시 열면 꺼짐 → 교사가 답하고
  곧바로 '확인' → 학생 초록 · '질문 대화 · 닫힘'(넷이 시간순) → 꺼짐 · 다음엔
  '질문하기' → 새 손은 빈 대화로 시작 → 교사 자리표 → 이력 창에 줄기 둘(최근 것
  위) · 창 Esc는 창만 · 가로 넘침 0. 셈의 시험 `tests/unit/signalThread.test.mjs`.

- **손들기와 돌발 퀴즈는 함께 섭니다.** 한때 손들기를 통째로 걷고 돌발 퀴즈로
  바꿨는데(커밋 `2999723`), 그러면 **학생이 수업 중에 먼저 물을 길**이
  없어졌습니다 — 돌발 퀴즈는 교사가 묻고 학생이 답하는 쪽이라 방향이 반대입니다.
  선생님 요청으로 되살렸습니다. 상단바에서는 **손바닥이 맨 왼쪽, 그다음
  메모지(돌발 퀴즈) · 확성기 …**이고 **교사·학생이 같은 차례**, 수업 화면 머리말도
  같은 차례입니다(선생님 요청). 교사의 손바닥은 손든 학생이 있을 때만 그림이
  서고 없으면 같은 크기의 빈 상자(`.question-signal-hold`)가 자리를 지켜, 손이
  오르내려도 메모지·확성기가 제자리입니다. 되살린 직후 한때 메모지가 손바닥
  왼쪽이었습니다.
  **다시 걷지 마세요** — 걷으려면 선생님께 먼저 여쭙니다.
  - 자리표 부품(`SeatCell` · `SeatPickGrid`)은 그동안 `components/SeatPickGrid.jsx`로
    옮겨 와 손든 학생 자리 확인 창(`QuestionSeatModal`)이 거기서 가져다 씁니다.
    손바닥 표시는 `raisedUids`를 넘긴 자리표에만 그려지므로, 돌발 퀴즈 창의
    자리표(메모지 · 초록 바탕)와 같은 모서리가 겹치지 않습니다.

### 돌발 퀴즈 — 교사가 묻는 한 문제 (`classes/{cId}/popQuizzes`)

교사가 수업 중에 갑자기 묻는 한 문제. 학생 모두에게 창이 뜨고, 학생은 글이나
코드(▶ 실행 결과 포함)로 답해 '선생님께 보내기'를 누르고, 교사는 자리표에서 그
답을 열어 과일을 주거나 '반송'합니다(선생님 요청). 손들기(학생이 묻는 쪽)와
**함께** 씁니다 — 위 절.

- **자료** — 셈은 `lib/popQuiz.js`(시험 `tests/unit/popQuiz.test.mjs`), 읽고 쓰기는
  `lib/data/popQuiz.js`(실서비스·데모 둘 다).
  - 퀴즈 `classes/{cId}/popQuizzes/{qId}` = `{ classId, kind('text'|'code'), title(1~200),
    desc(0~5000), boardId, boardTitle, byUid, open, createdAt, closedAt }`.
  - 답 `…/popQuizzes/{qId}/submissions/{학생 uid}` = `{ classId, quizId, uid, kind,
    text(1~20000), output(≤10000), status, submittedAt, history?, returnNote?, reviewedAt?,
    reviewedBy? }`. status는 `submitted`(보냄 · 확인 전) · `returned`(반송) ·
    `completed`(완료 — 과일 없이 인정, 끝) · `rewarded`(과일 받음 — 끝).
  - **하위 컬렉션 이름을 `answers`로 짓지 마세요.** 배움나눔 규칙에는 질문방 그룹 규칙
    (`match /{path=**}/answers/{aId}` — 로그인만 하면 읽기)이 있어, 그 이름이면 학생이 반
    친구의 퀴즈 답을 다 읽게 됩니다(규칙 시험이 실제로 잡았습니다). 두 앱의 규칙을 함께 고칠 때 걸립니다.
  - **반마다 열린 퀴즈는 하나** — 보내면 앞의 것을 닫는 일과 새것을 여는 일을 한
    묶음(writeBatch)으로 씁니다(`sendPopQuiz`). 규칙은 개수를 셀 수 없어 화면도
    `pickOpenQuiz`(열린 것 중 최근 것)로 하나만 봅니다.
  - '퀴즈 마치기'(`closePopQuiz`)를 누르기 전까지 열려 있고, 그동안 늦게 들어온
    학생도 받습니다.
  - 어느 프로젝트에서 보냈는지(`boardId`·`boardTitle`)를 적습니다 — 카드에서 보내면
    그 프로젝트, 상단바에서 보내면 비어 있습니다.
- **상단바 메모지는 알림만, 창은 떠 있는 동그라미에서**(선생님 요청). 상단바의
  메모지(`PopQuizButton indicator`)는 불로 받고 보낸 것을 알리기만 하고 **눌러도
  창을 열지 않습니다**(단추가 아니라 `role="status"` 표시 — 툴팁이 여는 곳을 말함).
  창은 동그라미의 **'돌발 퀴즈'** 행성이 창 이벤트 `popquiz:open`
  (`POPQUIZ_OPEN_EVENT`)으로 엽니다 — 퀴즈 · 답을 이미 들고 있는 상단바 조각이 그
  이벤트를 받아 창을 띄웁니다(듣는 것은 `indicator`인 조각뿐 — 수업 화면의 단추까지
  들으면 창이 둘 뜸). 새 퀴즈가 오면 저절로 뜨는 것은 그대로. **수업 화면 머리말의
  메모지는 지금처럼 눌러서 엽니다**(그 화면이 동그라미를 덮음).
- **학생 — 상단바 메모지**(`PopQuizButton`, 손바닥 오른쪽)는
  **늘 보입니다**. 불은 `studentQuizLight` 하나:
  빨강 = 열린 퀴즈에 아직 안 보냄 · 초록 = 반송됨 · 그 밖(보냄 · 과일 받음 · 열린
  퀴즈 없음)에는 불 없음. 불이 켜지면 메모지가 살짝 기웁니다.
  - **창은 처음 한 번만 저절로 뜹니다**(`shouldAutoOpenQuiz` — 이 기기에 본 퀴즈 id를
    `popquiz_seen:{반}:{uid}`로 적음). 반송은 초록 불로만 알립니다(선생님 요청).
    내 답이 도착한 **뒤에** 판정합니다 — 안 그러면 이미 보낸 학생에게도 새로 고칠
    때마다 한 번 뜹니다.
  - 창(`PopQuizStudentModal`, body 포털 · z-index 3010)은
    닫을 수 있습니다. 쓰던 글은 이 기기에 남겨 두었다가(`popquiz_draft:{퀴즈}:{uid}`)
    다시 열면 이어 씁니다. 보내면 지웁니다.
  - 글 퀴즈는 서식 에디터(굵게·밑줄·목록·코드 블록). 예전에 보낸 코드 퀴즈가 아직
    열려 있으면 **고정폭 글자 칸**(`.pq-code-text`)에 코드를 적어 보냅니다 — 한때 셀 창과
    같은 코드 칸 + ▶ 실행(실행 결과도 함께)이었는데, 파이썬 실행기와 함께 걷었습니다
    (실행 결과 칸은 빈 채로 보냄 · 지난 답의 실행 결과는 그대로 보임).
  - 보낸 뒤에는 선생님이 확인할 때까지 **못 고칩니다**. 반송되면 **입력칸은 빈 채로**
    열립니다(선생님 요청 — 한때 보냈던 답을 다시 채워 두었는데, 위 대화에 같은 글이
    두 번 서서 헷갈렸습니다). 앞의 답은 대화에서 봅니다. 과일을 받으면 끝.
  - **오간 말이 대화로 남습니다**(`PopQuizThread` — 교사 답 창 · 학생 창 · 지난
    퀴즈 공용, 선생님 요청). 한때 이력을 안 남겨, 반송 → 다시 보내기를 몇 번 오가면
    앞의 답과 한 마디가 사라졌습니다.
    - 다시 보낼 때 **지난 차례**(보냈던 답 · 결과 · 반송 한 마디 · 두 시각)를 답 문서의
      `history` 끝에 붙입니다(`nextQuizHistory`, 최대 20 — 넘치면 맨 앞이 밀려남).
      그리는 차례는 `quizThread`(지난 차례 + 지금 답). 보는 사람의 말이 오른쪽(학생은
      살구빛), 선생님 말은 연한 초록.
    - **규칙**(`popHistoryOk`): 앞의 이력은 그대로, 붙이는 한 줄은 **고치기 전 문서의
      값 그대로**여야 합니다(학생이 지난 답을 꾸며 넣지 못함). 처음 보낼 때 · 교사는
      이력을 못 씀. 이력을 안 건드리는 쓰기(옛 화면)도 받습니다. `nw[0:0]`(빈 자르기)는
      평가 오류라 첫 차례를 따로 봅니다(실측). 시험 `tests/rules/popQuiz.test.mjs`.
    - **코드보다 규칙을 먼저 배포하세요** — 안 그러면 반송된 답을 다시 보낼 때 권한
      오류입니다.
    - 이 기능 전에 오간 차례는 남아 있지 않습니다(지금 답과 마지막 한 마디만).
  - 아래 **지난 퀴즈**는 **접지 않고 다 펼칩니다**(선생님 요청) — 퀴즈마다 물음
    (프로젝트 · 날짜 · '마침')과 '선생님과 나눈 말'(대화)이 차례로 섭니다. 창을 열 때
    목록을 한 번, 퀴즈마다 내 답을 한 건씩 읽습니다. 한때 목록 · 줄마다 여닫는
    단추였습니다.
  - **창 높이는 못 박습니다** — `min(860px, 92vh)`(선생님 요청 — 지난 퀴즈가 쌓여도
    넉넉하게). 넘치면 몸통이 구릅니다.
  - 상단바 퀴즈 조각과 동그라미는 **같은 반 값**(`TopNav`의 `quizClassId`)을 씁니다 —
    데모 학생은 소속을 안 읽어 상단바 조각이 없었고, 그러면 동그라미의 '돌발 퀴즈'가
    아무 창도 못 열었습니다(실서비스는 원래 같은 값).
- **교사 — 창은 떠 있는 동그라미의 '돌발 퀴즈'가 엽니다**(`PopQuizTeacherModal` — 창 이벤트
  `popquiz:open`을 상단바의 퀴즈 조각이 받아 띄움). 배움나눔에서는 공부방 카드 머리 · 수업 화면
  머리말에서도 열었습니다.
  - **두 칸** — 왼쪽 관리(새 퀴즈: 제목 · 설명 → 보내기 — **'코드' 퀴즈는 걷었습니다**(책봄은 독서 전용, 선생님 요청 — 늘 글 퀴즈, 예전에 보낸 코드 퀴즈는 학생 창 · 지난 퀴즈에 그대로) /
    지금 퀴즈: 보낸 학생 n/N · 확인 전 · 반송 · 🍊 · 퀴즈 마치기 /
    퀴즈 목록(늘 펼침 — 한때 여닫는 단추였음, 선생님 요청) — 누르면 그 퀴즈의 자리표·답으로), 오른쪽 자리표.
  - **위 칸은 고른 퀴즈, 없으면 진행 중인 퀴즈뿐**입니다. 둘 다 없으면 '대기' 칸
    (＋ 새 퀴즈 · 안내)이 섭니다. **마친 퀴즈를 저절로 위 칸에
    올리지 마세요** — 한때 가장 최근 것을 올렸더니 그 퀴즈가 목록에서 빠져 지울
    길이 없었습니다(선생님 지적). '퀴즈 마치기'를 누른 퀴즈는 고른 것으로 남아
    그대로 봅니다(이미 온 답에 과일을 줘야 하므로).
  - **목록은 이 반의 퀴즈 전부**(진행 중 포함, 최근 것부터)이고 지금 위 칸에서 보는
    줄은 살구빛(`li.on`)입니다. 줄을 누르면 목록은 펴진 채로 둡니다.
  - **마친 퀴즈는 줄마다 🗑로 지웁니다** — 진행 중인 줄의 🗑는 흐리게 자리만
    지킵니다(`.pq-past-del--off`, 마친 뒤 지움 — 답을 쓰던 학생 창이 사라지지
    않게)(`deletePopQuiz` — 학생 답 하위 컬렉션까지
    한 묶음으로, **이미 준 과일은 그대로**). 되묻기는 **그 줄 안에서** 펼칩니다 —
    `ConfirmModal`은 이 창(z 3010) 아래에 깔려 안 보입니다. 규칙은 원래 담당 교사에게
    지우기를 열어 두어 **안 건드렸습니다**(시험 — 앱과 같은 한 묶음 · 남의 반 거부).
  - 자리표(`SeatPickGrid`의 `quizStateByUid`): 보냈는데 확인 전 = 오른쪽 위
    **메모지**, 과일 줌 = **초록 바탕**(`.attend-seat--quizdone`, 출석 초록과 같은 값),
    반송 · 안 보냄 = **표시 없음**(선생님 요청 — 반송은 '미제출처럼').
  - 자리를 누르면 **그 자리 옆에 팝오버**로 그 학생의 답 + **🍊 과일 주기 · 반송**
    (+ 선택 한 마디)이 뜹니다(`AnswerPopover`, 선생님 요청 — 한때 왼쪽 칸 아래에 섰는데
    자리표와 멀어 눈이 오갔습니다). 자리 잡기 · 닫기는 `lib/popover.js` 그대로(바깥 ·
    Esc · ×, 옆자리를 누르면 그리로 옮겨 감 — `keep`이 `.attend-seat--pick`). body에
    포털 · z 3020(이 창 위) · 폭 380px(좁으면 화면 폭 − 16) · 긴 답은 제 안에서 구름.
    과일은 **1개**이고 지급 이력에도 그대로 남습니다(`rewardPopQuizAnswer` →
    `addStudentReward` 다음에 상태).
  - **단추는 셋 — 반송 · ✓ 완료 · 🍊 과일 주기**(한 줄 같은 크기, 선생님 요청).
    **완료**는 과일 없이 답을 인정하고 대화를 끝냅니다(`completePopQuizAnswer` →
    `status: 'completed'`). 확인 전 답이 아니게 되어 **교사 · 학생 알림 불이 모두
    꺼지고**, 자리표는 과일과 같은 초록, 학생 창은 '선생님이 답을 확인하고
    완료했어요'. 보낸 답(`submitted`)에서만 켜지고, 색은 초록(#3f8f5c — '됐다').
    규칙은 담당 교사 · 보낸 답 · 상태 칸만(시험 `tests/rules/popQuiz.test.mjs`).
    대화 말풍선 안의 글 답은 안쪽 상자 테두리를 걷었습니다(말풍선이 이미 테두리).
  - **반송 · 과일 주기 두 단추는 늘 함께 서고, 학생이 '보낸'(`submitted`) 상태에서만
    켜집니다**(선생님 요청). 반송한 뒤에는 학생이 고쳐 다시 보낼 때까지 **둘 다
    꺼지고** '반송했어요 — 학생이 고쳐 다시 보내면 두 단추가 다시 켜져요'가 섭니다.
    아직 안 보낸 학생도 둘 다 꺼짐 · 마친 퀴즈의 보낸 답은 과일만 켜짐(학생이 다시
    보낼 길이 없어 반송은 꺼짐) · 과일을 받았으면 단추 대신 '과일을 줬어요'.
    꺼진 까닭은 툴팁이 말합니다. 한때 반송할 수 없으면 반송 단추를 아예 안 그리고
    반송한 답에도 과일을 줄 수 있었는데 바꿨습니다.
    - 켜진 두 단추는 **반송 = 진한 살구(`--primary-dark`) · 과일 주기 = 살구
      (`--primary`)**, 둘 다 흰 글자입니다(선생님 요청 — 흰 바탕 테두리 단추와 살구
      단추를 나란히 두니 어울리지 않았습니다).
    - 꺼진 두 단추는 **같은 회색 바탕 · 옅은 글자**(`.pq-review-btns button:disabled`)
      — 테두리 단추가 옅어지기만 하면 빈 입력칸처럼 보였습니다(실측).
    - 규칙은 반송한 답에 과일 주는 쓰기도 받아 줍니다 — 막는 것은 화면입니다(규칙을
      안 바꿈).
  - 900px 아래에서는 두 칸이 위아래로 서는데, **격자가 아니라 세로 flex**입니다 —
    높이가 정해진 몸통 안의 한 열 격자는 행이 줄어 자리표가 왼쪽 칸 위에 겹쳤고,
    `1fr`이 코드 블록의 최소 폭을 따라 창 밖으로 밀렸습니다(실측 420px). 자리표
    (6칸)만 폰에서 29px 넘쳐 그 칸만 옆으로 구릅니다.
  - 실측(팝오버 · 지우기, 데모 1440px): 자리 584~693px → 답 창 703~1083px(옆 10px) ·
    Esc는 답 창만 · 왼쪽 칸 누르면 답 창만 닫힘 · 1024px에서 563~943 · 420px에서 8~388 ·
    지난 퀴즈 🗑 → 줄 안 되묻기 → 지우기 → 목록에서 빠짐.
  - 실측(데모): 1440 · 1024px 두 칸(왼쪽 400px), 700 · 420px 한 열 · 문서 가로
    넘침 0 · 글 퀴즈 보내기 → 학생 창 저절로 → 보냄 → 교사 빨간 불 · 메모지 →
    반송(한 마디) → 학생 초록 불 · 한 마디 · 보냈던 답 그대로 → 다시 보냄 → 과일 →
    초록 자리 · 코드 퀴즈 `input()` 21 → 42가 결과와 함께 보내짐 · 새 퀴즈가 앞의
    것을 마침 · 지난 퀴즈 목록(양쪽).
- **규칙**(`popQuizShapeOk` · `popAnswerShapeOk`, 시험 `tests/rules/popQuiz.test.mjs`):
  퀴즈 읽기는 반 학생·담당 교사, 만들기·닫기·지우기는 담당 교사, 고치기는 닫기
  (open → false) 하나. 답은 학생이 **제 자리에 · 열린 퀴즈에만 · 처음이거나 반송됐을
  때만**(종류는 퀴즈와 같아야), 교사는 상태 칸만. 읽기는 그 학생(아직 없는 제 자리도
  — 문서 id가 곧 uid)과 담당 교사(목록은 교사만). 길이 천장은 `QUIZ_*_MAX`와 **같아야**
  합니다.
- **코드보다 규칙을 먼저 배포하세요**(`npm run deploy -- --rules-only`) — 안 그러면
  보내기 · 답하기가 권한 오류입니다. 손들기 규칙(`questionSignals` · `signalMessages`)도
  같습니다 — 손들기를 고친 코드를 올릴 때는 **규칙을 먼저** 배포합니다.

### 자리표 '선생님 보기'
- **자리표가 서는 화면이 한 값을 함께 씁니다**(`lib/seatView.js`의 `useSeatView`,
  단추는 `components/SeatViewToggle.jsx`): '멋진 순간' 패널(`StudyRewardPanel`) · 자리 배정 창
  (`SeatGroupSetupModal`) · 출석 관리의 좌석형(`AttendanceSeatView`) · 손든 학생 자리 확인
  (`QuestionSeatModal`) · 돌발 퀴즈 교사 창(`PopQuizTeacherModal`). 화면마다 따로 기억하면 한 곳에서 뒤집어 놓고
  옮겼을 때 방향이 달라, 같은 반의 자리표가 두 얼굴이 됩니다. 같은 탭 안의
  다른 패널도 곧바로 따라오도록 창 이벤트로 알립니다 — `storage` 이벤트는
  **다른 탭에만** 오기 때문입니다.
- 기본은 학생 보기(학생이 앉아 칠판을 보는 방향), 누르면 교탁에서 본 방향.
- **자리표는 그림을 돌리지 않고 차례를 거꾸로 세웁니다**(`seatOrder` —
  자리표를 그리는 세 곳 `SeatPickGrid` · `AttendanceSeatView` ·
  `SeatGroupSetupModal`이 함께 씁니다). 한 줄 6칸 격자에서 배열을 통째로
  거꾸로 세우면 곧 180도 돌린 그림입니다.
  - **한때 CSS로 그림을 돌렸습니다**(격자 `rotate(180deg)` + 칸마다 도로
    180도). 모양은 같았지만 **돌린 층의 글자가 흐려졌습니다** — 격자 크기가
    소수점 픽셀인 반은 늘 흐리고, 멀쩡한 반도 마우스를 얹어 칸이 움직이는
    동안 흐려졌습니다(실제 신고 — 반마다 명단 수·패널 폭이 달라 한 반은
    늘, 다른 반은 hover 때만). **자리표에 transform 회전을 되살리지 마세요.**
  - 되돌려 주는 것은 **자리 번호**라 빈 칸은 제자리를 지키고, 끌어 옮기기·
    자리 누르기·놓기·비우기는 그 번호를 그대로 씁니다(그림을 돌리던 까닭이
    '배열을 뒤집으면 번호가 어긋난다'였는데, 번호를 들고 차례만 바꾸면 그
    걱정이 없습니다). 칸의 hover 이동(`translateY(-1px)`)도 이제 따로 적을
    것 없이 그대로 맞습니다.
  - 마지막 줄이 덜 차면 모자란 칸을 `null`로 채워 돌립니다(`.attend-seat-pad`,
    `visibility: hidden`) — 자리 수 30이 6의 배수라 지금은 안 생깁니다.
  - DOM 차례도 화면 차례와 같아져 Tab 이동이 보이는 대로 갑니다.
  - 실측(임시 페이지, 22명·빈자리 섞음): 선생님 보기에서 22명 모두 (줄 r,
    칸 c) → (4 − r, 5 − c) · 격자와 칸의 transform `none` · hover 중에도
    `translateY(-1px)`뿐. 시험은 `tests/unit/roster.test.mjs`.
- 패널과 '확대' 창이 **같은 방향**을 씁니다 — 한 자리표가 두 얼굴이면 안 됩니다.
  **단추도 두 곳 다 있습니다.** 확대 창은 방향만 따라가고 돌리는 단추가
  없어서, 교실에 띄워 놓고 보다가 방향을 바로잡으려면 창을 닫고 패널
  머리줄까지 갔다가 다시 열어야 했습니다 — 크게 띄운 그 순간이 방향을
  바꾸고 싶은 때입니다. 두 단추가 `teacherView` **하나**를 함께 쥐므로
  어느 쪽에서 돌려도 나머지가 같이 돌아갑니다.
  - 자리는 **손바닥 뱃지 바로 왼쪽**입니다(`.reward-zoom-lead`가 남는 폭을
    받아 오른쪽으로 붙임). 패널 머리줄(`.reward-seat-head-btns`)의 차례와
    같게 — 왼쪽 끝에 두면 같은 단추를 화면마다 다른 데서 찾게 됩니다.
  - 그 칸에 **`aria-hidden`을 다시 붙이지 마세요.** 뱃지를 밀어내기만 하던
    빈 칸이라 붙어 있던 것인데, 누를 수 있는 단추가 들어온 뒤로는 읽어 주는
    기기에서 그 단추가 통째로 사라집니다.
  - **손든 학생 자리 확인**(`QuestionSeatModal`)도 같은 값을 씁니다. 한때
    `flipped`를 아예 안 넘겨 늘 학생 보기였는데, 패널에서 선생님 보기로
    돌려 두고 그 창을 열면 같은 교실이 반대로 보였습니다 — **자리로 사람을
    찾으려고 여는 창이라** 방향이 어긋나면 그 창의 쓸모 자체가 없어집니다
    (손바닥 표시는 자리 칸 안에 있어 늘 그 학생과 함께 움직입니다 —
    어긋나던 것은 판을 어느 쪽에서 본 그림인가뿐입니다).

**'칠판' 표시는 교사 자리표에서 걷어 냈습니다.** 교실 앞쪽이 어디인지 알려
주던 띠인데, 같은 머리줄의 '학생 보기 / 선생님 보기' 단추가 이미 방향을 글자로
말합니다 — 한 줄에 같은 뜻이 둘이면 자리만 먹고 판이 그만큼 내려앉습니다.
방향을 바꿀 수 있게 된 뒤로는 띠를 위아래로 옮기는 일(학생 보기는 판 위,
선생님 보기는 판 아래)까지 따라붙어, 지킬 것이 하나 더 느는 값이기도 했습니다.

- 칠판이 서던 머리줄의 그 자리는 **빈 칸(`.attend-seatmap-gap`)이 지킵니다**
  — `flex: 1`로 남는 폭을 받아 손바닥 뱃지를 오른쪽 끝으로 밀어내던 칸이라,
  그냥 빼면 뱃지가 줄 가운데로 들어옵니다.
- 단추를 끼우는 자리가 둘입니다 — `headLead`(줄 맨 앞) ·
  **`headTrail`(손바닥 뱃지 바로 왼쪽)**. 보기 방향 단추는 늘 뒤쪽입니다.
  `headLead`는 '멋진 순간' 패널과 확대 창이 이미 쓰고 있습니다.

- 고른 방향은 localStorage(`reward_seat_view`)에 기억합니다. 한 선생님은 대개
  늘 같은 쪽에서 봅니다.
- 자리 배정 창(`.seat-slot`)은 **정사각형이 아니라 3:2**입니다. 정사각형이면
  한 줄 6칸 × 5줄이 세로로 넘쳐 창에 스크롤 막대가 생겼습니다(실측 944px →
  710px). 칸에 드는 것은 자리 번호·학번·이름 세 줄뿐이라 3:2면 넉넉합니다.
- **켜짐 색을 두지 않습니다.** 글자가 '선생님 보기'/'학생 보기'로 바뀌어 지금
  어느 쪽인지 그대로 말합니다. 색까지 얹으면 옆의 손바닥 뱃지처럼 '켜져 있으니
  봐 달라'는 신호로 읽혀 눈길을 뺏습니다.
- **'멋진 순간' 패널의 설명 줄은 `과일 20개마다 ⭐ · 출석 20/22 · 🖐️ 0`**
  입니다(`.reward-sub`, 한 줄 — `nowrap`). 자리표 머리의 단추 줄에는 **단추
  셋만** 섭니다(`🍊 다 함께 · 학생/선생님 보기 · ⤢ 확대`).
  - **'출석 21/25'**(`.reward-seat-att`)는 **출석을 끝낸 뒤에만** 띄웁니다
    (`presentUids`가 있고 `attendanceOpen`이 아닐 때). 받는 중에 띄우면 아직
    오는 중인 학생이 결석 수처럼 읽힙니다. 세는 대상은 **지금 명단에 있는
    학생**뿐입니다 — 반에서 빠진 학생의 옛 기록이 섞이면 분자가 분모를 넘습니다.
  - **손바닥 인원**(`.reward-sub-hands`)도 여기입니다. 이 패널만 자리표 머리의
    손바닥 뱃지를 끕니다(`SeatPickGrid`의 **`showHands={false}`** — 다른
    자리표와 확대 창은 그대로 뱃지를 답니다). 손을 들면 예전 뱃지의 켜짐과
    같은 살구빛 알약이 됩니다.
  - '자리를 눌러 과일 주기·누가기록'은 **툴팁으로 내렸습니다** — 한 번 알면
    그만인 말이라서요.
  - **여기까지 두 번 넘쳤습니다(실제 신고).** 처음에는 '출석 n/N'이 단추 줄
    맨 앞이라 출석을 마치면 넷이 되어 '⤢ 확대'가 둘째 줄로 밀렸고, 그것을 긴
    설명 줄 끝으로 옮기자 이번에는 설명 줄이 두 줄이 되고 단추 줄도 손바닥
    뱃지와 '선생님 보기'가 함께 서서 여전히 넘쳤습니다. **두 줄 어디에든 칸을
    더하면 다시 접힙니다** — 더할 것이 있으면 이 패널이 아닌 자리를 찾고,
    '선생님 보기'(가장 긴 상태)로 재 보세요.
  - 실측(임시 페이지, 컨테이너의 넓은 대체 폰트, 선생님 보기): 설명 줄 한 줄
    190px · 단추 셋이 같은 y, 왼쪽에 61px 남음 · 가로 넘침 0.

### 모둠 현황 — 모둠마다 과일 한 번에 (`.reward-group-award`)

- '멋진 순간' 패널의 모둠 현황에서 **모둠 이름 아래 `🍊 +1`**을 누르면 그 모둠원
  모두에게 과일이 하나씩 갑니다(선생님 요청). 받은 학생 화면에는 지금처럼 폭죽이
  터집니다(상단바 축포가 제 과일 수가 늘어난 것을 잡음 — 따로 할 일 없음).
- **'🍊 다 함께'와 같은 길**입니다(`sendAwards` — 델타 `onAward(uid, 개수, +1)` ·
  여섯 줄 · 천장(100) 거르기 · 더블클릭은 ref로). 한쪽만 고치지 마세요.
- 대상은 **지금 명단에 있는 모둠원**뿐입니다(점선 `stale` 칩에게는 안 줌). 출석은 안 봅니다.
- 다 갔으면 결과 창 없이 단추가 2초 동안 초록 `✓ n명` — 수업 중 모둠마다 누르는 단추라
  매번 창이 뜨면 손이 바쁩니다. **못 준 학생 · 가득 찬 학생이 있으면** 그때는
  '다 함께'와 같은 결과 창(`AwardAllResultModal`, 제목 '○모둠에게 주기')이 뜹니다.
- 이름 칸은 52px로 못 박아(`.reward-group-lead`) 모둠마다 칩이 같은 자리에서 시작합니다.
- 규칙을 안 건드립니다(낱개 주기와 같은 쓰기).

### 모둠 현황 — 명단에 없는 사람 지우기
- 모둠에 저장된 `members`는 **배정하던 때의 스냅샷**이라, 반에서 빠지거나
  지운 계정(샘플 계정 등)이 그대로 남습니다.
- 예전에는 `moveToGroup`이 맨 앞에서 `roster.find(...)`가 없으면 그냥
  돌아가, **그 칩을 눌러도 아무 일이 없었습니다** — 화면에서 지울 길이 아예
  없었습니다(실제로 '학생강현수'가 그랬습니다). 지금은 **빼는 것**
  (`targetIndex == null`)은 명단에 없어도 되고, **넣는 것**만 막습니다
  (이름·학번을 명단에서 가져와야 하므로).
- 그런 칩은 `.reward-chip.stale`(점선·옅은 글자)로 표시합니다. 명단을 아직
  받는 중일 수 있어 `roster.length > 0`일 때만 봅니다.
- **자동으로 걷어 내지 않습니다** — 명단을 받는 중(roster가 빈 순간)에
  저장되면 모둠이 통째로 비워집니다. 지우는 것은 선생님이 눌러서.
  ('자리 배정 · 모둠 설정' — 반 관리하기의 창 · 수업 관리의 '자리 배치' 탭 —
  은 열 때 명단으로 걸러 두어, 거기서
  저장해도 정리됩니다 — 다만 그 화면에서는 보이지 않아 '지워야 할 게 있다'는
  것을 알 수 없습니다.)

### 모둠 설정 카드의 테두리는 연하게

- '모둠 설정하기'(`SeatGroupSetupPanel`)의 모둠 카드는 테두리를 **모둠 색을
  흰색에 40% 풀어** 2px로 그립니다(`.group-setup-card`의 `color-mix`). 3px
  원색 여섯 개가 흰 바탕에 나란히 서니 테두리가 이름·학생보다 먼저 눈을 잡아
  화면이 무거웠습니다(선생님 요청).
- **저장하는 색(`g.color`)은 그대로**입니다 — 자리표의 모둠 보기·활동 모둠 등
  같은 색을 쓰는 다른 화면은 안 바뀌고, 카드 옆 색 고르개도 진짜 색을 보여
  줍니다. 연하게 하는 것은 이 카드의 테두리 한 곳뿐입니다.

### 출석 찍힌 시각 — 밀리초까지

- 화면 셋이 `09:03:07.048`까지 적습니다 — 출석 목록 표(날짜까지 함께
  `2026. 09. 22. 09:03:07.048`) · 자리표 칸(시각만 — 날짜는 머리줄이 이미
  말합니다) · 학생 본인의 출석 기록 목록.
- **저장은 안 건드렸습니다.** `markStudyAttendance`가 쓰는
  `serverTimestamp()`는 처음부터 `{seconds, nanoseconds}` 두 칸이라
  **1/1000초는 이미 들어 있었습니다.** 잘리던 곳은 둘입니다 —
  (ㄱ) `toDate()`가 주는 JS `Date`가 밀리초까지만 담아 **나노초는 거기서
  버려지고**(실측: `Timestamp(1758500096, 789123456)` → `.789`, 뒤 여섯
  자리 소실), (ㄴ) 화면이 시·분만 찍고 있었습니다. 그래서 규칙도 자료도
  그대로이고 **읽어서 그리는 자리만** 고쳤습니다.
- **셈은 `lib/dates.js`의 `formatClockMs`·`formatStampMs` 두 곳**입니다
  (store.js가 같은 이름으로 다시 내보냅니다).
  세 화면이 저마다 만들면 한 곳만 고쳤을 때 같은 기록이 화면마다 다른
  자릿수로 보입니다.
- **`Intl`의 `fractionalSecondDigits`를 쓰지 마세요.** ES2021 옵션이라
  모르는 기기에서는 **조용히 무시되어** 그 화면에서만 밀리초가 사라집니다.
  `String(d.getMilliseconds()).padStart(3, "0")`으로 손수 붙이면 어디서나
  같은 글자가 나옵니다.
- **값이 없으면 빈 문자열입니다** — `toDate(null)`은 '지금'을 돌려주는데,
  방금 찍은 기록은 서버가 답할 때까지 이 칸이 null이라(`serverTimestamp()`
  의 그 함정) 그대로 두면 **지어낸 밀리초**가 화면에 찍힙니다. 부르는 쪽은
  빈 값을 받아 `-`를 그리거나 아예 줄을 안 그립니다.
- 글꼴은 `--font-mono` + `font-variant-numeric: tabular-nums`입니다 —
  자리마다 숫자 폭이 다르면 표에서 밀리초 열이 들쭉날쭉해 세로로 훑을 때
  자릿수가 어긋나 보입니다. `white-space: nowrap`으로 한 줄에 붙듭니다.
- **`.study-attendance-table-wrap`에 `overflow-x: auto`가 필요합니다** —
  칸이 길어지며 좁은 화면에서 표가 그 테두리 밖으로 삐져나갔습니다(실측
  400px에서 48px). 지금은 그 안에서 옆으로 구릅니다(상단바 이동 메뉴와 같은
  방식 — 글자를 줄이는 대신 구르게).
- 실측: 자리표 칸 96~108px에 시각 83px이라 400·600·780·1280px 어디서도
  한 줄에 들어가고, 문서 가로 넘침은 0입니다.
- **엑셀 출석부에는 시각이 없습니다** — `lib/exportAttendance.js`는 명단 ×
  날짜 격자에 `○`만 찍습니다. 시각을 넣으려면 그 한눈에 보는 격자를 다시
  짜야 해서(칸마다 열한 글자) 일부러 두었습니다.

### 출석 기록 — 늘 받는 것은 그날 것뿐입니다

- 책방 화면은 **오늘 기록만** 구독합니다 — 교사는 그날 반 전체(`subscribeClassAttendanceOn` — `date ==`),
  학생은 그날 제 것 한 건(`subscribeMyAttendanceOn` — `uid ==` · `date ==`, 등호뿐이라 색인 없음).
  오늘 출석 n/N · 자리표 · '출석하기' 단추가 쓰는 것이 그것뿐입니다.
- **학기 전체는 '출석 관리'(교사) · '내 출석부'(학생) 창을 연 동안만** 받습니다(달력 · 지난 날 · 출석부
  내려받기). 첫 답이 오기 전에는 오늘 기록으로 그립니다.
- 활동 화면의 결석 표시(`BookGroupBoard` · `useActivityAttendance`)는 **활동을 연 날**의 기록만 받습니다.
- 학생은 없는 출석 문서를 `get`할 수 없어(읽기 규칙이 `resource.data.uid`를 봄) 오늘 것도 **질의로** 묻습니다.
  시험 `tests/rules/attendance.test.mjs`('그날 것만 받기').
- 한때 화면이 뜰 때마다 학기 전체(학생 수 × 수업일 — 학기 말이면 수천 건)를 받았고, 학생도 제 기록을 학기분
  모두 받았습니다. **하루치만 쓰는 자리에 `subscribeClassStudyAttendance`를 다시 쓰지 마세요.**

### 출결 수정 — 좌석형에서 자리를 눌러 출석 ↔ 결석 (교사)

- '출석 관리' 머리줄, 내려받기 오른쪽의 **'✎ 출결 수정'**(`.study-attendance-edit`).
  **좌석형에서만 켜집니다**(목록형 · 캘린더형에서는 꺼짐 — 누를 자리가 없음,
  다른 보기로 옮기면 저절로 꺼짐). 켜면 '✓ 수정 끝내기'(살구)가 되고, 자리 칸이
  단추가 되어(점선 테두리) **누르면 곧바로 저장**됩니다. 되묻지 않습니다 — 켜는
  단추 하나가 '일부러 고치는 중'이라는 표시입니다.
- **왜**: 학생 기기가 막혀(학교 와이파이가 firebaseapp.com을 막던 날) '출석하기'를
  못 누른 학생을 선생님이 바로잡을 길이 없었습니다(규칙이 출석 기록을 학생 본인
  · 출석을 연 동안으로만 열어 둠).
- 기준 날짜는 **좌석형의 날짜 칸**입니다 — 지난 날짜도 고칩니다. 출석을 열었는지와
  상관없습니다.
- **결석 = 기록 없음**이라, 출석 → 결석은 그날 기록을 **지웁니다**. 결석 → 출석은
  학생이 남길 때와 **같은 문서 ID(`날짜_uid`)**로 만들고 `manualBy`(교사 uid)를
  적습니다(`setStudyAttendanceByTeacher`). 화면은 그 기록을 **'출석 · 수정'**
  (좌석형) · 시각 앞 '수정'(목록형 표)으로 가립니다. 시각 줄에 붙이면 칸 폭을
  넘쳤습니다(실측).
- 같은 자리를 빨리 두 번 누르면 만들기 · 지우기가 엇갈리므로 **저장이 끝날 때까지
  그 자리만 잠급니다**(`busyUids`). 실패하면 자리표 위에 한 줄.
- **규칙을 열었습니다**(`attendanceRecords`): create에 담당 교사 갈래(`ownsClassEditable`
  · ID = `날짜_학생uid` · `manualBy == 나` · 서버 시각), delete를 담당 교사에게.
  학생 갈래는 `manualBy`를 못 씁니다. update는 그대로 막힘. 시험
  `tests/rules/attendance.test.mjs`(일곱 개 더). **코드보다 규칙을 먼저 배포하세요** —
  안 그러면 누를 때마다 '바꾸지 못했어요'입니다.
- 실측(데모, 가짜 명단 12명 — 데모 반에 학생이 없어 확인하는 동안만 넣음): 목록형에서
  꺼짐 · 좌석형에서 켜짐 → 누르면 '출석 1 / 12' · '출석 · 수정' → 다시 누르면
  '기록 없음' · 목록형으로 옮기면 꺼짐 · 1440 · 420px 가로 넘침 0.

### 출석부 내려받기 (교사)
- '출석 관리' 모달 머리줄의 **⬇ 출석부 내려받기** — 명단 × 수업한 날짜의
  표 한 장을 엑셀로(`lib/exportAttendance.js`). 학기말에 학교 시스템으로
  옮겨 적거나 보관하려면 화면이 아니라 파일이 필요합니다.
- 누르면 **범위 고르기 창**이 먼저 뜹니다(전체 기간 / 하루 / 기간).
  예전에는 곧바로 학기 전체가 받아졌는데, 실제로는 '오늘 하루'나 '이번 달'로
  좁혀 뽑는 일이 더 잦아 받아 놓고 엑셀에서 열을 지워야 했습니다.
  - 날짜는 **자유 입력이 아니라 수업한 날 중에서** 고릅니다 — 달력에서 아무
    날이나 집으면 수업이 없던 날을 고르고도 '왜 비었지' 하게 됩니다.
  - 기간은 시작·끝이 뒤집혀 있어도 받아 줍니다(누르는 차례까지 강요하면
    고르다 막힙니다). 거르기는 `filterRecordsByRange` — 양 끝을 포함하고,
    ISO 날짜 문자열은 사전순이 곧 시간순이라 그대로 견줍니다.
  - 갈래를 바꿔도 창 높이가 안 흔들립니다(`.attend-export-when`의 min-height)
    — 고르는 도중에 단추가 움직이면 누르려던 곳이 어긋납니다.
  - 파일 이름에 실제로 담긴 범위를 적습니다(하루면 그 날짜, 여러 날이면
    `처음~끝`). 여러 개 받아 두었을 때 열지 않고 고르려면 필요합니다.
  - 출석률은 **고른 범위 안에서** 다시 셉니다 — '이 기간에 며칠 왔나'가
    그 표의 뜻이라서요.
- 열은 **기록이 있는 날짜만** 세웁니다. 달력의 모든 날을 세우면 수업이 없던
  날의 빈 칸이 결석과 구분되지 않습니다.
- 표 마지막 줄의 '출석 인원'은 **지금 명단에 있는 학생만** 셉니다 — 기록에는
  반에서 빠진 학생도 남아 있어, 그대로 세면 위 ○ 개수와 아래 합계가
  어긋납니다.
- 만드는 법은 활동 자료 내보내기와 같은 `downloadWorkbook`. 열이 날짜 수에
  따라 달라져 열 이름을 인자로 받습니다(`lib/exportWorkbook.js`).
- 같은 줄에 서는 것들(단추 둘·상태 알약·내려받기·'출석 n / N')은 **높이를
  하나로**(`height: 30px`) 맞춥니다. 세로 padding으로 저마다 정하면 글자
  크기가 다른 만큼(13 · 12.5 · 12px) 줄이 들쭉날쭉해집니다.

### 엑셀 내보내기는 진짜 `.xlsx`입니다
- `lib/exportWorkbook.js`의 `downloadWorkbook`이 **OOXML 몇 장을 zip으로 묶어**
  만듭니다(`buildXlsxParts` + `lib/zip.js`). 라이브러리(SheetJS·JSZip)는
  여전히 안 씁니다.
- 예전에는 SpreadsheetML 2003(XML 한 장)을 `.xls` 이름으로 내려 주었는데,
  엑셀이 열 때마다 **'파일 형식 및 확장명이 일치하지 않습니다'** 경고를
  띄웠습니다 — 속은 XML인데 이름은 옛 이진 형식이라서입니다. 이름만
  `.xml`로 바꾸면 경고는 사라져도 더블클릭으로 안 열립니다.
- `lib/zip.js`는 **압축하지 않습니다**(store, method 0). deflate를 구현하거나
  비동기 `CompressionStream`을 쓸 만큼 파일이 크지 않습니다(표 한 장 = 수십 KB).
- 셀은 전부 `t="inlineStr"` — `sharedStrings.xml`을 두면 조금 작아지지만
  부품이 하나 늘고 어긋날 자리도 하나 늡니다.
- 열 이름은 `colName`이 만듭니다(0→A … 26→AA). **출석부는 날짜만큼 열이
  늘어 26칸을 쉽게 넘습니다** — Z 다음을 잘못 세면 엑셀이 파일을 통째로
  거부합니다.
- `xmlEscape`는 XML 1.0이 금지하는 제어문자도 걷어 냅니다. 학생 글에 섞여
  들어오면 '읽을 수 없는 파일'이 됩니다.

### 잠김 / 열림은 늘 자물쇠 한 쌍으로

- 그림은 `components/StatusIcons.jsx`의 **`IconLock`(닫힌 고리) ·
  `IconUnlock`(열린 고리 + 반짝임)** 둘뿐이고, 상태로 고르는 자리는
  **`IconLockState({ locked })`** 한 곳을 거칩니다. 두 화면이 서로 다른
  그림을 쓰는 일을 막으려고요.
- 이모지(🔒/🔓)는 **쓰지 않습니다.** 기기마다 굵기·색이 달라 교실 화면에
  띄우면 두 그림이 잘 갈리지 않았고, 고리가 열린 쪽이 오히려 작아 보였습니다.
- **색만으로 상태를 가르지 마세요.** 열린 칩(연한 살구)과 잠긴 칩(연한 회색)은
  둘 다 옅어 빔프로젝터에서 차이가 좁아집니다. 자물쇠를 함께 답니다.
- **누르면 상태가 바뀌는 것에는 그림, 할 일을 적은 단추에는 글자만.**
  칩·토글처럼 그 자리가 곧 상태인 것(활동을 연 화면의 `활동 열림 / 활동 잠김` ·
  동료 평가 여닫기)은 그림이 지금 상태를 말하고 툴팁이 할 일을 말합니다. 반대로 글자가
  이미 할 일인 단추(책방 활동의 `활동 시작하기`/`활동 잠그기`)에는
  **자물쇠를 달지 않습니다** — 상태 배지의 자물쇠와 방향이 어긋나, 잠긴 활동
  하나에 열린 자물쇠와 닫힌 자물쇠가 같이 뜹니다. 상태는 배지가, 할 일은 단추가.
- **책봄: 활동을 연 화면에서도 여닫습니다**(`components/BookHeadParts.jsx`의
  `BookLockToggle`, 선생님 요청). 교사 머리말의 **맨 앞, 주제어(도서명) 배지 바로 다음**
  (주제어 배지가 없는 해시태그 · 가로세로 · 빙고는 맨 앞)에 `활동 열림 /
  활동 잠김` 단추가 섭니다 — 그 자리가 곧 상태라 자물쇠 그림 + 상태 말, 할 일은
  툴팁(동료 평가 여닫기와 같은 모양 `.peer-lock-btn`). 고치는 값은 목록 카드의
  '활동 잠그기 / 활동 시작하기'와 **같은 `activity.locked`** 이고, 동료 평가 잠금과는
  따로입니다. 열한 활동 모두에 있습니다(실측: 데모 1440px, 넘침 0).
- 그 단추의 말은 **`활동 시작하기` / `활동 잠그기`** 입니다. `잠금 해제`·
  `잠그기`만 적었을 때는 바로 옆 `편집`(이름·주제어 고치기) 단추와 섞여
  무엇을 잠그는 것인지 흐렸습니다. 여는 쪽이 '잠금 해제'가 아닌 까닭:
  선생님이 그 단추를 누르는 순간은 자물쇠를 푸는 때가 아니라 **이 활동을
  시키는 때**이고, 잠갔다 다시 여는 것도 그 반에게는 새로 시작하는 일입니다.
- **상태 배지는 한쪽 상태에만 달지 마세요.** 잠겼을 때만 배지를 두면 배지
  없는 카드가 '열려 있다'가 아니라 '아직 안 봤다'로도 읽힙니다. 책방 활동
  카드(`.book-activity-state`)는 늘 달고, 말과 색은 진행 대시보드의 같은
  알약(`.progress-act-state`)과 맞춥니다 — **잠김 / 열림**.
  ('편집'이었는데, 옆에 선 `편집` 단추(이름 고치기)와 같은 낱말이라 상태를
  말하는 자리인지 할 일을 말하는 자리인지 헷갈렸습니다. 말을 바꿀 때는
  **두 화면을 함께** — 한쪽만 고치면 같은 상태가 두 이름을 갖습니다.)
- 두 아이콘 다 **밝은 바탕에 맞춘 두 색**(먹빛 `#3A312E`, 무늬 `#8A6258`,
  몸통 `#FFF7ED`)입니다. 어두운 바탕 위에서는 `mono` 옵션으로 두 색을
  글자색으로 갈음하고 몸통을 비웁니다.
- 지금 붙어 있는 자리: 책방 활동 카드의 상태 배지 · 활동을 연 화면의 `활동 열림 / 활동 잠김`
  (`BookLockToggle`) · 학생 화면의 잠김 안내(`BookLockedNote`) · 동료 평가 여닫기 · 전광판(`BookProgressBoard`).

### 저장된 서식 글이 뿌려지는 자리는 서식 규칙에 선택자를 더합니다

- 코드 블록(어두운 `pre`)과 글머리 기호 들여쓰기(`ul`/`ol`)는 한 규칙에
  **선택자를 늘어놓아** 정합니다(`app/styles/08a-image-editor-richtext-chat.css`) —
  지금은 `.rte-area`(에디터) · `.msgr-bubble`(메신저) · `.study-card-content`(돌발 퀴즈 답 등) ·
  `.study-card-body`(발표 화면). 이름에 `study-`가 남은 것은 배움나눔 공부방 카드에서 온 클래스라서입니다.
- 한때 공부방 카드가 이 목록에서 빠져, 에디터에서는 검은 코드 블록이던 것이 저장하고 보면 밋밋한
  글이 되고 목록도 들여쓰기가 풀렸습니다(실제 신고). **글이 뿌려지는 자리를 새로 만들면 이 두 규칙에
  선택자를 더하세요.** 안 그러면 그 화면에서만 서식이 풀립니다.

### 스크롤 칸 안의 `.sr-only`는 위치 기준을 함께 줘야 합니다

- `.sr-only`는 `position: absolute`입니다. **조상 중에 위치 기준(`relative`)이
  하나도 없으면 기준이 문서 전체가 되어**, 그 요소를 품은 칸의 `overflow`에
  잘리지 않고 문서 바깥으로 삐져나갑니다. 눈에는 안 보이는데 **문서 높이만
  늘어나** 페이지에 세로 스크롤바가 하나 더 생깁니다.
- 실제로 겪은 것(배움나눔 관리자 화면): 과일 지급 격자 안 `<caption class="sr-only">`이
  학생 26명짜리 표에서 **851px**을 넘겨, 화면 높이에 못 박아 둔 대시보드에 페이지 스크롤바가
  생겼습니다. 교사 화면에 막대가 셋(카드 안 · 본문 · 페이지)으로 보였습니다.
- **찾는 법**은 '가장 아래까지 뻗은 요소'를 짚는 것입니다. 껍데기 높이가
  화면과 같은데 문서가 넘치면, 넘치는 것은 껍데기 **바깥**에 있습니다.

  ```js
  let m=0,w=null;for(const e of document.querySelectorAll('body *')){
    const b=e.getBoundingClientRect().bottom+scrollY; if(b>m){m=b;w=e} }
  console.log(Math.round(m), w.tagName, w.className)
  ```
- 고치는 법은 **감싼 칸에 `position: relative`** 한 줄입니다. 껍데기에
  `overflow: hidden`을 둘러 덮지 마세요 — 증상만 가리고 진짜 넘치는 것은
  그대로 남습니다.

### 안내·예시 글자는 `--text-faint`

글자 짙기는 세 단계입니다 — 본문 `--text` · 딸림글 `--text-sub` · **안내·예시
`--text-faint`(#a09f96)**. 안내는 읽을 것이 아니라 참고할 것이라 살짝 보이면
됩니다. `--text-faint`가 바닥입니다(`--bg-deep` 위에서 대비 2.4:1).

- **입력칸의 예시 글(placeholder)은 `app/styles/01-base-landing-footer.css` 맨 위 한 곳**에서 정합니다
  (`input::placeholder, textarea::placeholder`). 정해 두지 않으면 브라우저
  기본색(크롬 #757575쯤)이라 본문만큼 짙어, 학생이 '이미 쓰여 있는 글'로
  읽습니다. `opacity: 1`을 함께 두세요 — 파이어폭스는 기본 opacity가 0.54라
  색만 정하면 한 번 더 옅어집니다.
  제 색을 따로 정한 입력칸(마인드맵 노드 입력칸 `.mm-node-input` 등)은 제 규칙이 아래에 있어
  그것이 이깁니다 — **이 규칙을 그 아래로 옮기지 마세요.**
- **쓰기 시작하면 안내가 사라져야 합니다.** placeholder는 저절로 그렇고,
  칸마다 붙는 힌트(`.paratext-hint`)는 CSS로 그렇게 했습니다
  (`.raft-col.filled` · `.kwls-col.filled`에서 `display: none`). 자기 글과
  예시가 나란히 서면 어느 것이 자기 글인지 헷갈립니다.
- **RAFT 안내 문장**(`.raft-sentence`)은 빈칸이 남은 동안은 '채워 갈 틀'이라
  가장 옅고, 네 칸을 다 정하면 그때 비로소 **학생이 만든 문장**이 되어
  한 단계 또렷해집니다(굵게까지는 안 합니다 — 제목처럼 읽힙니다).
  교사 화면(`RaftBoard`)이 늘 `done`으로 그려, 한 칸도 안 쓴 카드에도
  '다 정했다'는 짙은 알림줄이 떴습니다. **판정을 학생 화면과 같게 두세요.**

### 모둠 그림은 `IconGroup` 하나

- `IconGroup`(나란히 선 두 사람)을 씁니다 — 모둠 줄(`GroupMatesRow` · `GroupJoinRow`) · 모둠 짜기 창
  제목 · 발표 화면의 모둠 아바타. 이모지(👥)는 기기마다 사람 · 피부색 · 머리 모양이 제각각이라 걷었습니다.
- 한때 '가운데 한 사람 + 좌우로 반쯤 걸친 두 사람'이었는데, 배지에 붙는 15px로 줄면 옆의 둘이 가운데
  몸통에 붙어 덩어리 하나로 뭉쳤습니다. 지금은 둘이 떨어져 서고 오른쪽 사람만 **초록(`#3F704B`)** 입니다 —
  둘 다 먹빛이면 작은 크기에서 한 사람처럼 읽힙니다. (짝이던 개별 그림 `IconIndividual`은 쓰는 곳이 없어 걷었습니다.)

### 상태 알약의 크기는 한 곳에서

- 책방 활동 카드의 상태 배지(`.book-activity-state`)와 진행 알약(`.progress-act-state`)은
  **같은 것을 말하는 알약**이라, 글자 크기·여백·모서리를 `app/styles/20-study-today-attend.css`의 한 규칙에서 함께 정합니다
  (색만 저마다의 규칙에 남습니다). 한쪽만 키우면 같은 뜻이 화면마다 다른
  크기로 보입니다.
- **13px / padding 4px 11px / 높이 28px.** 11.5px였는데, 카드에서 가장 먼저
  훑는 줄인데도 카드 안에서 제일 작은 글자였습니다. 글자만 키우면 알약이
  글자에 끼어 답답해지니 여백도 함께 키우세요. 안에 드는 아이콘은 15px.

### 이어 놓인 단추는 늘 같은 크기

- **한 줄(또는 한 묶음)에 나란히 선 단추 · 탭은 크기를 똑같이** 맞춥니다(선생님 요청 —
  균형감). 글자 길이대로 폭을 주거나 한 칸만 좁히지 마세요(한때 메신저 학생 탭이
  `1fr 1fr 0.7fr`라 '공지'만 좁았습니다).
- 방법은 격자 `repeat(n, minmax(0, 1fr))` — `1fr`만 쓰면 배지 · 긴 이름이 붙은 칸이
  제 내용만큼 넓어질 수 있고, `flex: 1 1 0`은 테두리 있는 단추가 2px 넓어집니다(아래 절).
  높이도 같은 값으로 못 박습니다.
- 콘텐츠 칸의 폭 비율(예: KWLS의 L 칸을 넓게, 셀 창의 두 열)은 단추 줄이 아니라 이
  약속의 대상이 아닙니다.

### 모달 아래 두 단추는 늘 균등 두 칸

- `.modal-actions`는 `grid-template-columns: 1fr 1fr` — 창 폭이 얼마든 취소와
  실행이 **같은 크기로 아래를 채웁니다**. `flex: 1 1 0`으로 두면 테두리가
  있는 `.btn-ghost`가 없는 `.btn-primary`보다 2px 넓어집니다(flex-basis를
  content box로 재기 때문 — 실측 190 : 188). 격자는 정확히 반씩 나눕니다.
- **900px짜리 '독서 활동 만들기' 창도 그대로 균등입니다.** 취소가 417px라
  두 글자에 비해 넓어 보여 '긴 쪽 글자에 맞춰 오른쪽에 붙이자'고 제안했는데,
  선생님이 균등을 고르셨습니다 — 좌우 대칭이 안정적이고, 오른쪽 단추 문구가
  모둠 설정에 따라 길어지므로(`기본 모둠 5개로 만들기`) 글자가 잘릴 걱정이
  없습니다. **이 창만 예외를 두지 마세요.**

### 과일 주기 — 주는 단추의 과일은 '다음에 붙을 과일'

- 나열은 `RewardFruits`의 **`FRUITS` 열 가지 고정 순서**입니다(🍎🍊🍋🍇🍓🍑🍈🍉🍒🥝).
- 주는 단추가 늘 🍎였더니, 화면에는 열 가지가 줄지어 있는데 누르는 자리만
  사과라 '사과를 준다'로 읽혔습니다. 지금은 **`nextFruit(count)`**(다음에
  붙을 것) · **`lastFruit(count)`**(빼면 없어질 것)로 그립니다.
- **셈은 `RewardFruits.jsx` 한 곳에서만.** 나열이 i번째를 `FRUITS[i % 10]`으로
  그리므로 count개를 가진 사람의 다음은 `FRUITS[count % 10]`이고, 별로 접히는
  20개 주기와도 어긋나지 않습니다(`(count % 20) % 10 === count % 10`).
  다른 데서 따로 세면 단추와 줄이 다른 과일을 가리킵니다.
- **이름표 자리의 과일은 🍊입니다** — `누적 🍊 12` · `🍊 멋진 순간` ·
  `🍊 확인` · 축포의 `🍊 +1`처럼 특정 과일이 아니라 '과일'이라는 말을
  대표하는 자리입니다. **`FRUITS`의 차례(🍎부터)는 건드리지 마세요** —
  거기를 돌리면 이미 과일을 받은 학생의 뱃지 줄이 통째로 한 칸씩 밀려,
  어제까지 사과였던 것이 오늘 오렌지로 보입니다. 그래서 대표 그림만
  오렌지로 바꾸고 나열은 그대로 두었습니다. `RewardFruits.jsx` 말고 다른
  곳에 🍎를 새로 적지 마세요(이름표는 🍊, 주는 단추는 `nextFruit`).
- `RewardTally`도 그대로입니다 — '멋진 순간' 패널의 접이 제목 `🍎 궁금한 순간`. 아래 막대가 세는 것은
  실제로 `rewards` 누적 총계라 🍎가 내용과 어긋나지 않습니다. (배움나눔에서는 수업 중 자리표의 탭으로도
  떠서 이름이 둘이었습니다.)
### 팝오버 — 모달과 가려 쓰세요

- **모달**은 뒤를 덮고 다른 조작을 막습니다(`.modal-backdrop`). 닫기 전에는
  못 지나가므로 화면 한가운데 섭니다. **팝오버**는 누른 것 **옆에 붙어** 뜨고
  뒤가 그대로 살아 있어, 바깥을 누르거나 Esc·×로 닫힙니다. 툴팁은 올려놓기만
  해도 뜨는 글자뿐인 것, 드롭다운은 그중 '고르는 목록'입니다.
- 지금 팝오버인 것: 손들기 목록(`.question-signal-dropdown`) · 프로필 메뉴
  (`.profile-menu`) · **궁금한 순간의 이력**(`.tally-pop`) ·
  **자리표의 과일 주기·누가기록**(`.attend-tools-pop`).
- **자리 잡기와 닫기는 `lib/popover.js` 한 곳**에 있습니다
  (`usePopoverAnchor` · `usePopoverDismiss`). 화면마다 따로 적으면 어떤
  팝오버는 화면 밖으로 나가고 어떤 것은 Esc가 안 듣습니다.
- **구르는 목록 안의 팝오버는 `position: fixed`로 띄우세요.** 줄 안에 절대
  배치로 넣으면 목록의 `overflow`에 잘립니다(`.reward-tally-list`는
  `max-height: 320px`). 자리는 누른 것의 `getBoundingClientRect()`로 재서
  인라인으로 줍니다 — 오른쪽 → 왼쪽 → (좌우가 다 좁으면) 아래 → 위, 어느
  쪽이든 화면 안으로 끌어당깁니다.
- **누른 것을 따라다닙니다**(스크롤·창 크기). 열 때 한 번만 재면 뒤가
  구르는 동안 창만 제자리에 남아 엉뚱한 것을 가리킵니다. **구를 때 닫는
  방법을 쓰지 마세요** — 화면 가장자리의 것을 누르면 브라우저가 그것을
  화면 안으로 밀어 넣느라 클릭 **직후에** 스크롤이 한 번 일어나(실측:
  pointerdown 30ms 뒤) 누르자마자 닫히는 것처럼 보입니다.
- 바깥 클릭으로 닫을 때는 **`if (!e.target.isConnected) return;`**을 함께
  두세요(아래 '바깥을 눌러 닫기' 절). 그리고 **같은 목록의 다른 줄, 자리표의
  다른 자리를 누른 것은 '바깥'이 아닙니다** — 그리로 옮겨 가는 중이라,
  걸러 두지 않으면 닫혔다 다시 열리며 한 번 깜빡입니다(`keep` 인자).
- **자리표의 과일 창**(`StudentToolsPopover`)은 자리표가 서는 화면이 함께 씁니다 —
  '멋진 순간' · 손들기 자리 확인(`QuestionSeatModal`) · 돌발 퀴즈 교사 창. 모달이던
  것을 옮긴 까닭은, 과일은 여러 학생에게 잇달아 주는 것인데 그때마다
  자리표가 통째로 가려져 **다음에 누를 자리가 화면에서 사라졌기** 때문입니다.
  - 자리 칸은 누른 요소를 함께 넘깁니다(`onPick(student, e.currentTarget)`) — 창이
    어디에 설지 정하는 값입니다.
    **자리표를 새로 만들면 이것을 빠뜨리지 마세요**(안 넘기면 화면
    한가운데 섭니다).
  - '선생님 보기'에서도 그대로 맞습니다 — 차례만 바뀐 것이라 누른 칸의
    `getBoundingClientRect()`가 곧 화면의 자리입니다.
  - z-index는 `320`입니다 — 손들기 자리 확인 · '멋진 순간' 확대 창이 **모달 안**이라
    그 위로 올려야 합니다.

- 주는 단추의 과일 그림(`nextFruit` · `lastFruit`)이 붙어 있는 자리: 자리표 과일 창의 ±1 ·
  수업 화면 창(`CastStageModal`)의 '과일 주기'. (배움나눔에서는 수업 노트 · 공부방 카드에도 있었습니다.)
- **자리 칸의 🍎 뱃지(오늘치)와 창의 '누적'(총계)은 출처가 다릅니다** —
  뱃지는 `rewardEvents`(`useTodayRewardCounts`), 누적은 `rewards`
  (`roster[].count`). 자리표를 띄우는 페이지가 **`rewards`도 함께 구독해
  `roster`에 `count`를 실어 줘야** 합니다. 책방 페이지가 이것을 안 받고
  있어서, 뱃지는 4인데 창은 '누적 0'으로 보이고 **'−1'이 영영 꺼져
  있었습니다**(0개면 뺄 것이 없다고 판단하므로). '가득 찼어요' 판정도 같이
  어긋납니다. 자리표를 새 화면에 달 때는 이 한 가지를 꼭 확인하세요.
- **축포(`RewardCelebration`)는 `TopNav`에 한 번만 답니다.** 한때 페이지마다
  달고 있었는데, 과일을 주는 자리는 그 화면뿐이 아닙니다 — 상단바 손바닥의
  '🍎 확인'은 어느 화면에서든 눌리고 학생은 다른 화면에 있을 수 있어, 받고도
  아무 일 없는 일이 잦았습니다. 상단바는 모든 화면에 떠 있어 여기 하나면 어디서
  받아도 터집니다. **페이지에 다시 달지 마세요** —
  구독이 둘이 되어 축포가 겹칩니다. 반은 `activeClassId`(옆 과일 뱃지와 같은
  값)를 봅니다.
  - **펫이 깨어나고 자랄 때도 같은 폭죽입니다** — 책나눔의 펫 카드가 이 조각을 가운데 그림만
    바꿔(`children` — 과일 뱃지 대신 펫) 따로 띄웁니다(`PetCelebration`). 과일을 지켜보는 구독은
    없으므로 위 '한 번만'과 부딪히지 않습니다(`READING_GROWTH.md`의 '독서 펫' — 자람).
- **연달아 주면 폭죽이 이어서 터집니다.** 교사는 한 학생에게 ＋1을 서너 번
  누르는데, 예전에는 **첫 지급에만** 폭죽이 돌고 그 뒤로는 뱃지 숫자만
  올라갔습니다 — 캔버스 effect가 `[active]`(개수가 0인가 아닌가) 하나만 보고
  있어 처음 한 번만 실행됐고, 프레임 루프도 `start + LIFE_MS`에 스스로
  멈췄습니다. 2초 간격으로 다섯 번 주면 3.2초 뒤부터 **밤하늘도 불티도 없이
  뱃지만 떠 있는** 화면을 7초 더 봤습니다(실제 신고).
  - 지금은 루프를 계속 돌려 두고 지급할 때마다 **발사만 덧붙입니다**
    (`launch`). 끝나는 시각도 `endAt`(마지막 발사 + `LIFE_MS`)로 밀려,
    캔버스·밤하늘·뱃지·사라지는 타이머가 한 시각에 맞습니다.
  - **'지급마다 처음부터 다시'로 짜지 마세요.** effect를 `[amount]`로 다시
    걸면 정리(cleanup)가 돌며 `resize()`가 `canvas.width`를 다시 넣어 **화면이
    통째로 지워지고**, 새 불씨가 바닥에서 올라오는 0.5초 동안 아무것도
    없습니다 — 빨리 누를수록 터지는 장면이 오히려 줄어듭니다.
  - 캔버스 effect가 **발사 effect보다 먼저 선언돼 있어야** 합니다. React는 같은
    렌더에서 선언 순서대로 실행하므로, 뒤에 두면 첫 지급 때 `launchRef`가 아직
    비어 있어 아무것도 안 터집니다.
  - **밤하늘은 key로 다시 마운트하지 마세요** — 들어오는 키프레임이 다시 돌아
    지급할 때마다 어둠이 0.26초씩 깜빡입니다. 들어오는 것만 키프레임이고 걷는
    것은 `.is-out` 클래스라, 늦게 온 지급에는 다시 짙어집니다. 그 0.64초는
    컴포넌트의 `FADE_MS`와 **같은 값이어야** 합니다.
  - 발수는 첫 발사만 예전 그대로(`9 + n*2`, 최대 16)이고 이어지는 발사는 작게
    잡습니다(`5 + n*2`, 최대 10). 한 발이 불티를 60~116개 만들어, 올라가는 중인
    발에 천장(`MAX_LIVE_SHELLS` 22)을 둡니다 — 천장에 닿아도 **한 발은 반드시**
    쏩니다(누른 만큼 무언가는 터져야 하므로).
  - 실측(1280×800, 1초 간격 다섯 번): 0.7초부터 6.9초까지 캔버스가 **한 번도
    비지 않고**(가장 긴 빈 구간 104ms, 그마저 다 사그라드는 끝자락), 밤하늘이
    6.9초에 걷히기 시작해 7.5초에 사라짐 — 마지막 지급(4.4초) + 3.2초와 맞음.
    (이 실측은 `LIFE_MS`가 3.2초이던 때입니다 — 아래.)
- **한 번의 폭죽은 4.2초입니다**(`LIFE_MS`, 3.2초에서 1초 늘림 — 선생님 요청).
  뱃지의 사라지는 동작(`.reward-cheer-badge`의 `4.2s`)이 **같은 값**이어야 합니다.
  - **시간만 늘리면 끝 1초가 빈 밤하늘입니다.** 한 발사의 불티는 3초 남짓에 다
    져서, 늘린 만큼 어두운 화면만 남습니다. 그래서 발사마다 **뒤풀이**를 함께
    쏩니다 — 본 발사의 절반을 `ENCORE_MS`(1.8초) 뒤에. 1.0초로 두었을 때는
    뒤풀이가 첫 발사에 겹쳐 3.4초에 불티가 다 졌습니다(실측). 뒤풀이도 천장
    (`MAX_LIVE_SHELLS`)을 넘기지 않습니다.
  - 실측(프로덕션 빌드, 1280×800, 한 번 지급): 0.4초부터 4.07초까지 불티가
    이어지고 밤하늘과 함께 걷힘 · 끝 4.2초.
  - **개발 서버(`next dev`)에서는 첫 발사가 안 보입니다** — StrictMode가 effect를
    두 번 돌려 첫 캔버스가 치워지고, 둘째 발사 effect는 '이미 쏜 개수'를 보고
    쏘지 않습니다. 실서비스와 무관하니, 폭죽을 잴 때는 `next build && next start`로.

### '🍊 다 함께' — 출석한 학생 모두에게 한 개씩 (교사)

- '멋진 순간' 패널 자리표 머리줄, **'선생님 보기' 왼쪽**의 단추. 누르면 되묻지
  않고 바로 **오늘 출석한 학생 전원**에게 과일이 하나씩 가고(학생 화면에서는
  저마다 폭죽이 터집니다), 끝나면 **결과 창**이 뜹니다. 반이 통째로 잘한
  순간에 자리를 스물몇 번 누르던 것을 한 번으로 줄이는 자리입니다.
- **주는 대상은 '오늘 출석을 찍은 학생'입니다**(`awardTargets`). 보는 것은
  **'오늘 찍힌 기록이 있는가' 하나뿐** — 한 명이라도 있으면 그 사람들 모두에게
  하나씩 가고, 한 명도 없으면 단추가 꺼집니다.
  - **출석을 시작했나·끝냈나는 안 봅니다.** 받는 중에도 이미 온 학생들에게
    줄 수 있습니다(그때는 지금 찍힌 사람까지만 갑니다 — 툴팁의 인원수가
    그것을 말합니다).
  - **설명 줄의 '출석 n/N'과는 기준이 다릅니다.** 그 라벨은 출석을 **끝낸
    뒤에만** 뜨는데(받는 중에 띄우면 오는 중인 학생이 결석으로 읽힙니다),
    단추는 받는 중에도 삽니다. 한때 둘을 같은 배열에서 뽑았고, 그 탓에 단추가
    라벨의 사정을 물려받아 죽었습니다 — **다시 묶지 마세요.**
  - **반 전체로 넘어가지 않습니다.** 출석 기록이 없는 날 명단 전원에게 주는
    길을 한 번 뒀다가 걷었습니다 — 결석한 학생까지 받게 되고, 같은 단추가
    날에 따라 다른 사람들에게 가서 '누구에게 주는 단추인가'가 흐려집니다.
  - **꺼져 있을 때는 무엇을 하면 켜지는지까지 적습니다**(`awardAllBlocked` →
    툴팁). `오늘 출석한 학생이 아직 없어요 — 학생이 '출석하기'를 누르면
    켜집니다`. 회색 알약만 놓아 두면 고장으로 보입니다: **'출석 종료'와
    '출석 기록 있음'은 다른 것**이라, 출석을 시작했다 아무도 안 찍은 채 끝낸
    날에도 꺼지는데 그때 '종료했는데 왜 꺼져 있냐'는 신고를 받았습니다.
  - 켜져 있을 때의 툴팁은 `awardWho`가 짓습니다(`오늘 출석한 21명에게 과일을
    하나씩 줍니다`) — 되묻는 창이 없으므로 **누르기 전에 인원을 말해 주는
    것은 이 한 줄뿐**입니다.
- **반드시 델타로 보냅니다** — `onAward(uid, 개수, +1)`. 화면에 보이는 개수로
  절대값을 만들면 구독으로 돌아오기 전의 옛 값이라 방금 다른 데서 받은 과일이
  묻히는데(위 '＋1·−1 단추' 절), 여기는 한 번에 스물몇 명이라 그 위험이 훨씬
  큽니다. 낱개 주기와 **같은 함수**를 그대로 되풀이해 부릅니다.
- **여섯 줄로 나눠 보냅니다**(`AWARD_ALL_LANES`). 학생마다 다른 문서라
  트랜잭션끼리 부딪히지는 않지만 스물몇 건을 한 순간에 던지지는 않고, 한 건씩
  차례로 가기에는 느립니다(한 반이 4초쯤). 여섯이면 네 번에 끝나 학생 화면의
  폭죽이 거의 동시에 터집니다. `queue.shift()`가 `await` **앞에서** 끝나므로
  같은 학생을 두 번 집는 일이 없습니다(실측: 26·60명에서 호출 수 = 인원 수,
  빠진 사람 0, 동시 실행 최대 6).
- **되묻는 창이 없습니다 — 누르면 바로 나갑니다.** 수업 중에 한 단계가
  거추장스럽다는 판단입니다(선생님 요청). 그 대신 둘을 함께 두었습니다.
  - **더블클릭은 ref로 막습니다**(`awardBusyRef`). 한 번의 실수가 곧
    스물몇 건의 쓰기인데, `awardingAll`은 상태라 같은 프레임의 두 번째
    클릭이 아직 옛 값(0)을 보고 지나갑니다.
  - 되돌리는 길은 자리를 하나씩 눌러 −1 하는 것뿐입니다. 창을 되살리려면
    `ConfirmModal`을 다시 부르면 되는데, 그때는 붉은 동그라미(`#fef2f2`)가
    '되돌릴 수 없다'는 뜻으로 읽히므로 **살구빛으로 바꿀 길을 함께** 내야
    합니다(한때 `iconTone` 프롭을 뒀다가 창과 함께 걷었습니다).

**끝나면 결과 창이 뜹니다**(`components/AwardAllResultModal.jsx`).
되묻는 창을 걷어 내 **무슨 일이 있었는지 말해 주는 자리가 여기 하나뿐**이라,
'몇 명에게 갔다'만이 아니라 **안 간 사람까지** 적습니다.

- **아무 일 없이 끝났을 때도 엽니다.** 폭죽은 학생 화면에서만 터지므로,
  확인할 자리가 없으면 교사는 눌린 것인지조차 알 수 없습니다.
- **안 간 까닭이 둘이라 칸도 둘입니다.**
  - **주지 못함** — 쓰기가 실패한 경우(연결 끊김 등). **이름이 곧
    단추**여서, 누르면 그 학생에게만 다시 보냅니다(`onRetry` →
    `onAward(uid, 개수, +1)` — 낱개 주기와 **같은 델타 경로**). 성공하면
    그 자리에서 초록 체크로 바뀌고 **위 인원수와 머리의 '남은 n명'도 함께**
    움직입니다 — 창을 닫았다 다시 열 필요가 없습니다.
    - 토스트였을 때는 이름만 읽고 자리표에서 그 자리를 **다시 찾아야**
      했고, 글자는 몇 초 뒤 사라졌습니다. 그래서 창으로 옮겼습니다.
    - 이름을 늘어놓는 한도(한때의 `FAILED_NAMES_MAX`)가 **없어졌습니다** —
      창은 길어져도 스크롤될 뿐이고, 스물몇 명이 실패한 날에도 하나씩
      짚어 다시 줄 수 있어야 합니다.
  - **이미 가득 참** — 누적이 천장(`REWARD_MAX` 100)에 닿아 더 안 올라가는
    학생. **글자로만 적고 누를 수 없게 둡니다** — 다시 보내도 값이 그대로라,
    눌리는데 아무 일도 안 일어나면 고장으로 보입니다.
    - **보내기 전에 미리 갈라냅니다.** `addStudentReward`는 천장에서 값도
      안 올리고 이력도 안 남기는데 **오류를 던지지도 않아**, 그냥 보내면
      '줬다'로 세어집니다. 누적은 명단이 이미 들고 있어(`roster[].count`)
      읽기가 늘지 않습니다.
- `lane()`의 `catch`는 **이름이 아니라 학생을 통째로** 담습니다 — 그 이름을
  눌러 다시 보내려면 uid가 있어야 합니다.
- **폭은 `width`와 `max-width`를 함께** 줍니다(`.award-result-modal`, 460px).
  `.modal`이 `width: 100%; max-width: 640px`이라 한쪽만 내리면 안 좁아집니다.
- 실측(1280×800): 창 460px · 가로 넘침 0 · 다시 주기 한 번에 `21명 → 22명`과
  `주지 못한 학생 2명 · 다시 준 1명`이 함께 바뀜 · 실패한 이름을 한 번 더
  눌러 성공 · 이미 다시 준 이름은 눌러도 호출이 안 늚(disabled).
- **`onToast`는 더 이상 안 받습니다**(패널에서 걷었습니다) — 토스트 시절에는 책방에서
  결과가 아무 데도 안 떴습니다.
- **규칙을 한 줄도 안 건드립니다** — 낱개 주기가 이미 쓰는 그 길입니다
  (`rewards` 총계 + `rewardEvents` 한 건, 담당 교사에게 열려 있음).
- 머리줄의 단추 묶음은 **셋**입니다 — `🍊 다 함께 · 학생/선생님 보기 · ⤢ 확대`.
  손바닥 인원과 '출석 n/N'은 패널 설명 줄에 섭니다(위 '자리표 선생님 보기'
  절). 패널 안쪽이 312px로 못 박혀 있어, 모자랄 때만 **패널 밖으로 삐져나가는
  대신** 둘째 줄로 접힙니다(`.reward-seat-head-btns`의 `flex-wrap: wrap` +
  `justify-content: flex-end`). **이 줄에 칸을 더하면 다시 접힙니다.**
  - **이 저장소의 컨테이너에서 잰 px을 그대로 믿지 마세요.** 한글 폰트가
    `WenQuanYi`(중국어 폰트) 하나뿐이라 Pretendard보다 글자가 훨씬 넓게
    측정됩니다. 한때 그 값으로 '머리줄이 늘 두 줄'이라고 적었다가, 다시
    '실제 화면은 한 줄'로 고쳤는데 **둘 다 반쪽이었습니다** — 실제로 갈린 것은
    폰트가 아니라 출석 라벨·보기 방향 글자('선생님 보기'가 더 김)였습니다.
    반대로 **여기서 한 줄이면 실제 화면에서도 한 줄**입니다(이 폰트가 더
    넓으므로) — 넘치는지 볼 때는 여기서 재도 됩니다. `getComputedStyle`의 `fontFamily`도 선언한 목록의 첫
    이름(`Pretendard`)을 그대로 돌려주므로 대체 여부를 알려 주지 않습니다.
    폰트 폭이 걸린 자리는 여기서 재지 말고 실제 화면으로 확인하세요.
- **이 단추만 색이 있습니다**(`.reward-seat-all`, `--primary-light`).
  `.reward-seat-head-btns` 주석의 '하나만 달라 보이면 나머지가 눌리는 줄
  모른다'는 셋이 **같은 종류**일 때의 이야기입니다 — 옆의 둘은 보는 방법을
  바꿀 뿐이고 이것은 스물몇 명의 기록을 건드리므로, 눈에 띄는 편이 맞습니다.
  크기는 `.reward-seat-flip` 규칙을 함께 받아 저절로 맞습니다(따로 적으면
  글자 크기·여백이 어긋나 줄이 들쭉날쭉해집니다).
- **이름은 패널 제목과 갈라 둡니다.** 처음에는 단추도 '🍊 멋진 순간'이었는데,
  패널 제목이 이미 그 말이라 한 화면에 같은 글자가 60px 간격으로 두 번 서서
  무엇을 누르는 자리인지 흐렸습니다. 지금은 **`🍊 다 함께`** — 하는 일(반
  전체에게 한 개씩)을 그대로 말하고 제목과도 안 겹칩니다.
  - 이름을 또 바꾸게 되면 **단추 글자만** 고치세요. 패널 제목
    ('멋진 순간')은 접힌 슬림 바·`aria-label`까지 다섯 군데가 함께 쓰는 값이라
    따로 둡니다.

### 모달은 Esc로 닫힙니다 — `backdropClose` 한 줄이 맡습니다

- 모달 마흔여 개 가운데 Esc로 닫히는 것이 열댓 개뿐이었습니다(출석 관리 ·
  질문 상세 · 성장 기록도 안 닫혔습니다). 저마다 keydown을 걸게 하지 않고,
  배경에 이미 붙어 있던 `{...backdropClose(onClose)}`가 **배경을 등록**하고
  창에 건 처리기 **하나**가 맨 위 모달만 닫습니다(`lib/modal.js`).
- **맨 위**는 안에 든 것 → z-index → 문서에서 뒤의 것 순으로 가립니다. 맨 위가
  등록 안 한 `.modal-backdrop`이면(제 Esc를 따로 다루는 창) 손대지 않습니다.
- **Esc를 스스로 다루는 곳은 `e.preventDefault()`를 부르세요.** 공통 처리가
  그것을 보고 비켜 갑니다 — 팝오버만 닫기(`lib/popover.js`) · 달력만 닫기 ·
  고치던 칸 취소 · 확대 이미지 닫기. 안 부르면 한 번 눌러 둘이 함께 닫힙니다.
  공통 처리는 **다른 처리기가 모두 돈 뒤에**(setTimeout 0) 판정하므로 등록
  차례와 상관없습니다. 지금 Esc를 다루는 스무여 곳은 모두 부르게 맞춰 두었습니다.
- **제 Esc를 다루는 창은 맨 위일 때만 닫고, 초점도 그때만 가져오세요** — `hasModalAbove(배경)`
  (`lib/modal.js`, 공통 처리와 같은 셈)이 참이면 비켜 갑니다(preventDefault도 안 부름). 책나눔의 창
  (ReadingHub `Modal`)이 이것을 안 보고 Esc를 가로채, 독서 발자국을 저장하면 뜨던 펫 '자랐어요!' 창(그때는 창 —
  지금은 폭죽)은 두고 그 밑에 가려진 책 상세 창부터 닫았습니다. **그런 창의 초점 효과를 `onClose`에 걸지
  마세요** — 부르는 쪽이 렌더마다 새 함수를 넘겨, 다시 그려질 때마다 초점을 첫 칸으로 끌어왔고 감상을 쓰던
  커서가 날짜 칸으로 튀었습니다(최신 값은 ref로 · 효과는 열릴 때 한 번). 시험 `tests/unit/modalStack.test.mjs`.
- **창 안에 글이 든 칸이 하나라도 있으면 닫지 않습니다**(초점 칸만이 아니라
  창 전체 — 질문 쓰기는 제목이 비어도 본문에 글이 있습니다). 그래서 값이 이미
  채워진 편집 창(프로필 · 원본 편집)은 Esc로 안 닫히는데, 그것이 안전한
  쪽입니다. 한글 조합 중의 Esc도 그대로 둡니다.
- 칸이 아닌 곳에 쓰는 창은 `backdropClose(onClose, { esc: false })`로 뺍니다 —
  지금 책봄에는 그런 창이 없습니다(배움나눔의 그림판이 그 자리였습니다).
- 이 한 줄이 `ref`를 함께 돌려줍니다. **배경 요소에 `ref`를 따로 달지 마세요** —
  뒤에 적은 쪽이 이겨 한쪽이 조용히 빠집니다(지금은 그런 곳이 없습니다).
- 실측: 질문 상세에 답을 적는 중 Esc → 그대로, 비우고 Esc → 닫힘 · 출석 관리 ·
  성장 기록 닫힘 · 편집 창 위 확인 창에서 Esc → 확인 창만 · '멋진 순간' 확대
  창의 과일 팝오버 → 팝오버만, 한 번 더 → 창 · KWLS 크게 보기 한 번에 하나.
- 공통 `<Modal>` 껍데기는 아직 없습니다. 창마다 머리줄·폭·포털 여부가 달라
  한 번에 옮기면 모양이 흔들리므로, 동작(Esc)만 먼저 모았습니다.
- **Ctrl(⌘)+A도 같은 자리가 맡습니다** — 맨 위 모달이 있으면 그 창 본체
  (`.modal`)의 내용만 고릅니다(`installSelectAll`). 브라우저 기본은 모달이
  떠 있어도 뒤의 페이지·서랍까지 통째로 골라, 창 안의 코드와 결과만 복사하려던
  것이 한꺼번에 딸려 왔습니다(실제 신고). 판정은 Esc와 같은 `topBackdrop`.
  - **글자 칸 안에서는 손대지 않습니다**(입력칸 · 여러 줄 칸 · 서식 에디터 ·
    코드 칸) — 거기서는 '그 칸의 글 모두'가 맞고 브라우저가 이미 그렇게 합니다.
  - 한글 입력 상태에서는 `e.key`가 'ㅁ'으로 올 수 있어 `e.code`('KeyA')도 봅니다.
  - 실측: 모달 없음 → 페이지 전체(그대로) · 모달 빈 곳 → 창 글만(상단바 글
    섞임 없음) · 창 안 입력칸 → 그 칸의 글만.

### 창의 스크롤바 — 둥근 모서리를 깎지 않게 (`.modal::-webkit-scrollbar`)

- 브라우저 기본 스크롤바는 창의 `border-radius`에 **안 잘립니다** — 회색 궤도와
  위아래 화살표(▲▼)가 오른쪽 두 모서리를 네모로 채웠습니다(선생님 지적 —
  원본 편집 · 반 관리하기 창).
- 지금은 궤도가 투명하고, **위아래를 18px 띄워**(창 둥글기 20px) 손잡이가
  모서리에 안 닿으며, 화살표를 걷고, 손잡이는 12px 칸 안의 둥근 알약입니다.
  `.modal` 하나에 걸어 두어 모든 창이 같습니다.
- **`.modal`(과 그 하위 클래스)에 `scrollbar-width`·`scrollbar-color`를 주지
  마세요.** 크롬(121~)은 둘 중 하나라도 있으면 `::-webkit-scrollbar` 규칙을
  통째로 무시해 모서리가 다시 깎입니다. 파이어폭스만 `@supports not
  selector(::-webkit-scrollbar)` 안에서 표준 속성을 받습니다.
- 헤드리스 크로미움은 스크롤바를 감추므로 확인할 때는
  `ignoreDefaultArgs: ["--hide-scrollbars"]`로 띄웁니다(실측: 1280×620에서
  새 프로젝트 창 — 위아래 모서리 둥근 채 · 손잡이 둥근 알약 · 화살표 없음).

### 바깥을 눌러 닫기 — 사라진 것은 '바깥'이 아닙니다

- 바깥 클릭으로 닫는 창은 `document`의 `mousedown`을 듣다가 창에 안 담긴 곳을
  누르면 닫습니다. 여기에 **누른 것이 이미 사라진 경우**가 걸립니다.
- 배움나눔의 파이썬 실행기(책봄에서는 걷음)에서 겪었습니다. 자동 완성 목록의
  항목을 마우스로 누르면 편집기가 **그 mousedown이 `document`까지 올라오기
  전에** 완성을 넣고 목록을 통째로 DOM에서 걷어 냅니다. 우리 차례가 왔을 때
  `e.target`은 문서에서 떨어져 나간 뒤라 `contains`가 false — '바깥을 눌렀다'로
  읽혀 **창이 통째로 닫혔습니다**(키보드로 고를 때는 멀쩡해 마우스로만 났음).
- 막는 것은 `if (!e.target.isConnected) return;` 한 줄입니다. 누르는 순간
  사라진 것은 '바깥'이 아니라 **그것을 없앤 쪽의 일**이라, 어디였는지 따질
  것 없이 지나갑니다. 지금 이 줄이 있는 곳: `lib/popover.js`의
  `usePopoverDismiss` · `FloatingHub`.
- **바깥 클릭으로 닫는 것을 새로 만들 때는 이 한 줄을 함께 두세요.** 누르면
  스스로 사라지는 것(드롭다운·툴팁·메뉴)이 그 안에 하나라도 있으면 같은 일이
  납니다.

### 떠 있는 동그라미 · 간편 메신저 (`FloatingHub` · `MessengerWindow`)

- 화면 오른쪽 아래의 작은 동그라미(56px)입니다. `TopNav`가 달아 화면마다
  뜹니다(반이 있을 때 — 교사는 고른 반, 학생은 소속 반, 데모 학생은 고른 반).
  누르면 **큰 원(300px)으로 펼쳐지며** 학생 기능 다섯·교사 기능 여섯이 둘레에 섭니다.
  참고한 것은 `imuzikr/class-peer-messenger`('다정' 메신저)입니다.
  - 학생: 메신저 · 돌발 퀴즈 · 내 출석부 · 과일 바구니 · 분석 리포트
  - 교사: 메신저 · 돌발 퀴즈 · 출석 관리 · 반 관리 · 과일 바구니 · 분석 리포트
  - 분석 리포트는 `/dashboard`로 이동합니다. 현재 반을 유지하고 교사는 학급·학생
    통계, 학생은 본인의 독서 활동·성장 통계를 확인합니다.
- **모양은 행성 궤도입니다** — 가운데 해(살구빛 원, 고른 기능의 설명) 둘레에
  작은 행성(70px 동그라미)이 역할에 따라 다섯·여섯 개 섭니다. 한때 '피자 조각'과 둘 다
  두고 전환으로 오갔는데 선생님이 궤도로 정하셔서 조각 모양 · 전환을 걷었습니다.
  - **원판 안에 선을 긋지 않습니다**(선생님 요청) — 한때 행성을 잇는 점선 궤도와
    그 바깥 실선 고리를 SVG로 그렸는데, 선이 행성 사이를 가로질러 어수선했습니다.
  - **바탕 원판도 없습니다**(선생님 요청) — 큰 원은 배경 · 테두리 · 그림자 없이
    투명한 자리 틀(300px)만 남아, 행성과 해가 페이지 위에 곧바로 뜹니다. 틀을
    지우지 않는 까닭은 행성 자리(%)와 펼치는 움직임(scale)의 기준이라서입니다.
    틀은 `pointer-events: none`이라 행성 사이 빈자리를 누르면 뒤 화면이 눌리고
    원이 접힙니다(행성 · 해만 누름을 받음). 행성 그림자는 그만큼 조금 짙게 했습니다.
- **그림은 앱의 아이콘 그대로**(이모지 아님, `StatusIcons.jsx`) — 메신저는 말풍선
  `IconAnswer`(한때 로고 `IconLogo`였는데 가운데 해의 기본 그림과 같아 구별되지 않았습니다 —
  선생님 요청) · 돌발 퀴즈 메모지 `IconQuizMemo` · 출석 `IconCheck`(초록) · 반 관리
  `IconBlackboard` · 분석 리포트 `IconReport` · 과일 바구니는 바구니 창의 그림(`fruit-basket.webp`)을
  작게. 바구니 그림은 **처음 펼칠 때부터** 받습니다(첫 화면에서 280KB를 안 받게).
  작은 동그라미 자체는 살구 바탕에 흰 말풍선이라 두 색 아이콘인 로고를 못 써
  제 그림(`ChatIcon`)을 씁니다.
- **가운데 해에도 그림이 섭니다**(`.hub-center-badge` — 흰 동그라미 30px, 선생님 요청).
  기본은 **로고 + '책 나눔 · 무엇을 열까요?'**, 행성에 마우스를 올리면 그
  행성의 그림 · 이름 · 설명. 앱 아이콘은 먹빛 선이라 살구빛 해 위에 그대로 두면 안
  보여 흰 동그라미에 담습니다. 해는 116px이고 바깥 빛 고리는 6 + 4px — 행성(궤도
  101px · 70px)에 안 닿게.
  - 큰 원은 동그라미의 가운데를 기준점으로 0.19 → 1배로 자랍니다. 원의 오른쪽
    아래 모서리가 동그라미의 오른쪽 아래와 같은 자리라 동그라미는 원 **바깥
    모서리에 남아** 닫기(×)가 됩니다.
  - 원판 300px은 `FloatingHub.jsx`의 `DISC`와 CSS `.hub-disc`가 **같아야** 합니다.
  - 바깥 누르기 · Esc로 닫힙니다(사라진 것은 바깥이 아님 — `isConnected`).
- **교사만 끌어서 옮깁니다**(선생님 요청). 학생 화면의 동그라미는 늘 기본 자리
  (오른쪽 아래)에 고정이고 끌리지 않으며, 이 기기에 저장된 자리가 있어도 쓰지
  않습니다(`canDrag` — 교사 · 학생이 한 기기를 나눠 써도 학생 화면은 그대로).
  `touch-action: none`도 교사 동그라미(`.can-drag`)에만 겁니다.
  교사는 동그라미를 누른 채 6px 넘게 움직이면 끌기,
  그 아래는 누르기입니다(`HUB_DRAG_MIN`). 놓을 때 따라오는 click은 펼치기로 안 셉니다.
  - 자리는 **이 기기에 화면 비율로** 기억합니다(localStorage `hub_fab_pos` =
    `{ fx, fy }` — 동그라미 가운데의 폭 · 높이 비율). px로 적으면 큰 화면에서 오른쪽
    아래에 둔 것이 작은 화면에서 밖으로 나갑니다. 화면 가장자리에서 8px 안으로
    붙잡습니다(`hubPlacement`, 시험 `tests/unit/hubPlace.test.mjs`).
  - 컴포넌트가 네 변 거리(`--hub-left/top/right/bottom`)를 `.hub-root`에 인라인으로
    주고, **왼쪽 · 위쪽 절반이면** 큰 원과 메신저 창이 화면 가운데 쪽으로 펼쳐집니다
    (`.is-left` · `.is-top` — 원은 `--hub-ox/oy`로 자라는 기준점도 옮김). 메신저
    창 높이는 동그라미에서 화면 끝까지 남은 만큼에서 멈춥니다.
  - **누르는 순간 포인터를 붙잡습니다**(`setPointerCapture`). 6px을 넘긴 뒤에 붙잡으면
    빠르게 끌 때 첫 움직임이 벌써 단추 밖이라 끌기가 안 시작됐습니다(실측).
    교사 동그라미는 `touch-action: none`이라 손가락으로 끌어도 화면이 대신 구르지 않습니다.
  - 옮긴 뒤에는 '방송 종료' 알약 위로 비키는 것(`lifted`)을 하지 않습니다 — 자리를
    고른 것은 사용자입니다. 끄는 동안은 움직임(transition)을 끕니다(`.is-dragging`).
  - 기본 자리로 되돌리는 단추는 아직 없습니다(오른쪽 아래로 끌어다 두면 됨).
  - 실측(데모 1440×900): 누르기는 펼침 · 왼쪽 위로 끌면 원 · 메신저가 오른쪽 아래로
    펼침 · 새로고침해도 그 자리 · 화면 밖으로 끌면 가장자리 8px · 400px로 줄이면 비율대로
    화면 안 · 가로 넘침 0.
- **메신저만 이 자리에서 창을 엽니다.** 돌발 퀴즈는 창 이벤트(`popquiz:open`)로, 나머지는 책방의
  **이미 있는 창을 주소로** 엽니다 — `/books?open=attendance|fruit|classes`(책방이 열고 `open`만
  지움), 분석 리포트는 `/dashboard`로. 같은 창을 여기에 한 벌 더 만들면 두 곳이 어긋납니다.
- **z-index는 90대 — 모달 배경(100) 아래**입니다. 이 동그라미로 연 창(과일
  바구니 등)이 뜨면 그 뒤로 가려 창의 단추를 덮지 않습니다. 교사 화면에 '방송
  종료' 알약이 뜨면 그 위로 비켜 섭니다(`lifted`), 768px 아래에서는 한 칸 위(76px)입니다.
- 반이나 역할이 바뀌면 메뉴 · 메신저를 접습니다(열린 방은 앞 반의 것).

**메신저 — 방은 둘: 선생님 ↔ 학생 1:1 · 기본 모둠**(셈 `lib/messenger.js`,
읽고 쓰기 `lib/data/messenger.js`, 시험 `tests/unit/messenger.test.mjs` ·
`tests/rules/messenger.test.mjs`)

- 말 `classes/{cId}/chatMessages/{자동 id}` = `{ classId, room, fromUid, fromName,
  fromRole('teacher'|'student'), text(1~1000), at }`. 방 열쇠는 `dm_<학생 uid>` ·
  `grp_<모둠 id>` — 모둠 id(`group_1` …)는 모둠을 다시 짜도 그대로라 방이 안 섞입니다.
- **학생끼리의 1:1은 없습니다**(배움나눔에서는 교사도 못 읽는 모둠 메모가 그 자리였는데,
  책봄에서는 모둠 메모를 걷었습니다). 메신저는 **선생님이 모든 방을 봅니다** — 대화 맨 위에
  '대화 기록 안내'를 적어 둡니다(참고한 '다정'과 같은 약속).
- 읽기: 교사는 반의 **최근 300개**(`orderBy at desc · limit` — 단일 필드라 복합 색인
  없음) 한 리스너, 학생은 **제 방마다 등호 하나**(선생님 1:1 · 우리 모둠). list
  규칙은 질의로 판정하므로 `where room ==`가 '내 방'을 증명해야 통과합니다(모둠 메모와
  같은 까닭). 배지 때문에 반이 있는 동안 늘 구독하고, 교사의 학생 명단만 창이
  떠 있을 때 읽습니다.
  - **학생 방은 최근 60개만**(`CHAT_ROOM_LIMIT` — `room ==` · `at` 내림차순 · 한도, 하나 더 물어 앞의 말이
    남았는지 앎). 앞의 말은 대화 맨 위 **'이전 대화 더 보기'**(`.msgr-older`)가 그 방만 60개씩 더 받고,
    누르는 동안 보던 자리를 지킵니다. 한때 방의 말을 통째로 받아, 화면이 뜰 때마다 학기 내내 쌓인 대화를
    처음부터 읽었습니다.
  - 이 질의는 **복합 색인** `chatMessages(room ↑, at ↓)`가 있어야 합니다(`firestore.indexes.json`).
    색인이 아직 없으면(`failed-precondition`) 그 방을 통째로 받는 예전 질의로 돌아가, 배포 차례가 어긋나도
    메신저가 깨지지 않습니다 — 색인을 올리면 저절로 최근 60개로 바뀝니다. 시험 `tests/rules/messenger.test.mjs`
    ('학생은 제 방의 최근 말만…').
- 안 읽은 수는 `classes/{cId}/chatReads/{uid}`의 `rooms: { [방]: ms }`와 견줍니다.
  표시는 **그 방 마지막 말의 서버 시각**(`roomSeenMark`)이지 내 시계가 아닙니다 —
  기기 시계가 틀려도 새 말이 '읽음'으로 묻히지 않게. 방을 열면 적습니다.
- 교사 목록은 모둠 대화(모둠 차례) → 학생 대화(학번순)이고, **명단 · 모둠에 없는데
  말이 남은 방**(반에서 빠진 학생 · 다시 짠 모둠의 옛 방)도 끝에 섭니다 — 기록이
  화면에서 사라지지 않게. 최근 말 차례로 다시 세우지 않습니다(늘 누르던 줄이 자리를
  바꾸면 다시 찾아야 함).
- **교사는 창 맨 위에서 반을 고릅니다**(`.msgr-classbar` — 내가 만든 보관 안 된 반,
  이름순 · 반이 하나면 이름만). 책방에서 고른 반과 **따로**라 어느 화면에서든
  원하는 반과 대화하고, 책방의 반은 안 바뀝니다(선생님 요청).
  - 처음엔 책방의 반(없으면 첫 반) — 책방에서 반을 한 번도 안 고른 채 다른 화면에
    있어도 동그라미가 섭니다. 창이 닫혀 있는 동안은 책방의 반을 따라가고, 창에서
    고른 반은 창이 떠 있는 동안 지킵니다(`chatClassId` · `msgOpenRef`).
  - 배지 · 안 읽은 수는 **창에서 고른 반**의 것입니다. 반마다 따로 세려면 반 수만큼
    리스너(각 300개)가 늘어 일부러 안 했습니다.
  - 창은 고른 방을 **반과 짝으로** 듭니다(`roomSel = { cls, room }`) — 반을 바꾸는
    순간 앞 반의 방이 한 박자 남아 읽음 표시가 엉뚱한 반에 적히지 않게.
  - 규칙이 반을 만든 교사에게만 열려 있어 최고 관리자도 제 반만 섭니다. 데모 모드만
    보이는 반 전부(접속마다 uid가 새로 나와 '내가 만든 반'이 없음).
- **학생은 목록 대신 탭 둘 — 선생님 · 우리 모둠**(`.msgr-tabs`, 선생님 요청). 처음엔
  안 읽은 말이 있는 쪽, 없으면 선생님. 모둠이 없으면 '우리 모둠' 탭이 꺼지고 툴팁이
  까닭을 말합니다. 안 보는 탭에 안 읽은 수를 답니다. 학생의 Esc는 곧바로 닫기.
- 보내기는 **Ctrl(⌘)+Enter**, Enter는 줄바꿈(앱의 채팅 칸과 같음). 쓰던 글이
  있으면 Esc로 안 닫습니다. 교사는 말에 마우스를 올리면 '지우기'(두 번 눌러 확정).
- **서식 — 쓰는 칸은 앱의 서식 에디터**(`RichTextEditor variant="chat" toolbarTop`,
  모둠 메모와 같은 것). 굵게 · 기울임 · 밑줄 · 글머리 · 번호 · 코드 블록과
  `- ` · ```` ``` ```` 단축키가 그대로입니다(참고한 '다정'의 서식 도구를 옮김).
  - 말에 **`html`(정화한 서식 글, 4000자)과 `text`(글자만, 1000자)** 둘을 적습니다.
    `text`는 목록 미리보기 · 안 읽은 줄 · 옛 화면이 씁니다(`chatPlainText` — 태그를
    걷고 엔티티를 풂). 옛 말과 서식 없는 말은 `html`이 없고 `text`로 그립니다.
  - 말풍선은 `html`을 **그릴 때 한 번 더 정화**합니다(남이 쓴 값). 코드 블록 · 목록
    모양은 서식 공용 규칙(`.rte-area pre` 줄 — 위 '저장된 서식 글이 뿌려지는 자리' 절)에
    `.msgr-bubble`을 더해 같습니다.
  - **체크 줄은 툴바에서 뺐습니다**(`tools={CHAT_TOOLS}`). 말은 못 고쳐 말풍선의
    네모를 켜고 끌 길이 없고('다정'은 눌러 켜고 끄지만 옮기지 않음), 누를 것처럼
    보이는 그림만 남아 받는 사람을 헷갈리게 합니다. 켜고 끄게 하려면 말 문서의
    update를 열어야 해서(지금은 아무도 못 고침) 그만한 값이 없습니다. 이미 체크
    줄로 보낸 옛 말은 네모가 그대로 그려지되 누르는 것이 아닙니다(커서도 기본).
  - 에디터는 비제어라 보낸 뒤 **열쇠를 바꿔 새 칸으로** 갈아 끼웁니다(`composeSeq`).
    쓰는 칸은 글만큼 늘다 132px에서 안에서 구릅니다(창이 580px라).
- **인용 답장 — 말풍선의 문장을 끌어 고르면 입력칸 위에 인용으로 붙습니다**(선생님
  요청 — 문장 드래그 피드백). 그것을 단 채 보통 답장을 보내면 새 말에
  `quote: { id, name, text }`가 붙고, 말풍선 위에 왼쪽 살구 선의 옅은 한 덩이
  (`.msgr-quote`, 두 줄에서 접힘)로 섭니다. 누르면 원문으로 굴러가 1.4초 밝아집니다.
  - **원문 말은 고치지 않습니다** — 인용은 새 말에 붙는 사본이라, 말 문서의 update를
    닫아 둔 그대로입니다(원문이 지워져도 무엇에 답했는지가 남음). 원문이 지금
    목록에 없으면(지워짐 · 교사의 최근 300개 밖) 인용은 꺼진 채 글만 보입니다.
  - 판정(`captureQuote`): 선택의 **양 끝이 같은 말풍선 안**일 때만 — 이름 · 시각 ·
    다른 말풍선에 걸친 선택은 무시. 두 글자 아래(`CHAT_QUOTE_MIN`)도 무시라 그냥
    누르기는 안 걸립니다(더블클릭으로 낱말을 고르면 걸립니다). 붙이면 선택을 풀고
    쓰는 칸 끝으로 커서를 옮깁니다. 마우스는 `pointerup` 한 박자 뒤, 손가락은
    손잡이로 늘였다 줄이므로 `selectionchange`가 0.7초 멎은 뒤, 키보드는
    Shift+방향키를 놓을 때.
  - **학생도 똑같이 씁니다** — 학생에게는 '답장'보다 선생님 말의 그 대목을 짚어 **다시
    묻는 자리**라(선생님 요청), 학생 화면만 말을 바꿉니다: 입력칸 위 '선생님 말에 대해
    질문'(내 말이면 '내 말에 덧붙여 질문') · 아래 안내 '궁금한 문장을 끌어 고르면 그 부분을 짚어 물어봐요'. 자료 · 규칙은 같습니다.
  - 인용 빼기는 ×, 또는 글이 빈 채 Esc(창보다 인용이 먼저 닫힘). 방을 바꾸면 빠집니다.
  - 이름표는 원문이 내 말이면 **'내 말'**, 아니면 원문의 이름(`fromName`) — 학생이
    받은 선생님의 인용은 제 말을 짚은 것이라 '내 말'로 읽힙니다.
  - 셈은 `chatQuoteText`(공백을 하나로 · 200자에서 '…') · `cleanChatQuote`(보낼 때와
    그릴 때 둘 다 — 남이 쓴 값). **규칙을 열었습니다**: `quote`는 선택, 칸은
    `id`(1~40) · `text`(1~200) · `name`(선택 · 40) 뿐. 천장은 `CHAT_QUOTE_MAX`와
    같아야 합니다. 시험 `tests/rules/messenger.test.mjs`. **코드보다 규칙을 먼저
    배포하세요** — 안 그러면 인용을 단 답장이 '낯선 칸'으로 거부됩니다.
  - 실측(데모 1440 · 400px): 끌어 고르면 '내 말에 답장 / 고른 문장' + 쓰는 칸에 커서 ·
    보내면 말풍선 위 인용 · 누르면 원문이 밝아짐 · 그냥 누르기는 안 붙음 · Esc로 빼기 ·
    좁은 화면에서 두 줄로 접힘 · 가로 넘침 0.
- **읽음 — 1:1은 '읽음 · 안 읽음', 모둠은 '읽음 n/N'**(선생님 요청). 시각 옆에 옅게,
  모두 읽었으면 진한 살구.
  - **1:1은 내 말에만** 섭니다(받은 말은 내가 읽은 것이니 적을 것이 없음). **모둠은
    모든 말에** — N은 그 방 참여자(모둠원 + 선생님)에서 **보낸 사람을 뺀** 수, n은 그
    가운데 읽은 사람. '읽음 n/N'을 누르면 아래에 '읽음 · 안 읽음' 이름을 펼칩니다
    (한 번에 하나 · 펼친 목록이 보이게 굴림). 내가 들면 이름 대신 '나'.
  - 자료는 **방마다 문서 하나** `classes/{cId}/chatRoomReads/{방}` = `{ [uid]: ms }` —
    그 사람이 본 마지막 말의 **서버 시각**(`roomSeenMark`). 말의 시각 이하이면 읽은
    것으로 봅니다(`chatReceipt`). 창은 **연 방 하나만** 구독합니다(문서 1건).
  - **`chatReads`(안 읽은 수)와 따로 둔 까닭**: 그 문서는 내 모든 방의 표시라 모둠
    친구에게 열면 선생님과의 1:1을 언제 봤는지까지 드러납니다. 쓰기도 따로 —
    한쪽이 실패해도 다음에 그쪽만 따라잡습니다(제 칸 값과 견줌). 방 문서의 첫 답이
    오기 전에는 제 칸을 안 씁니다(`roomReads` null).
  - 참여자는 `roomParticipants` — 모둠원의 이름은 모둠 문서의 `members`, 선생님은 교사
    화면이면 나, 학생 화면이면 **반 문서의 `createdBy`**(`fetchClass`, 반이 바뀔 때 1건).
    모둠에서 빠진 학생은 N에 안 듭니다(지금 모둠원 기준).
  - **이 기능 전에 오간 말**은 읽은 표시가 없어 '안 읽음'으로 시작합니다 — 상대가 그
    방을 다시 열면(새 말이 오면) 채워집니다.
  - **규칙을 열었습니다**(`chatRoomReads` · `chatRoomOpen`): 그 방을 읽을 수 있는
    사람(담당 교사 · 1:1의 학생 · 그 모둠원)이 읽고, 쓰기는 **제 칸 하나만**
    (`diff().affectedKeys().hasOnly([uid()])` · 숫자 · 60칸 천장), 지우기는 없음(반
    삭제는 `purgeClass`). 시험 `tests/rules/messenger.test.mjs`. **코드보다 규칙을 먼저
    배포하세요** — 안 그러면 읽음이 늘 '안 읽음 · 0/N'입니다(말 · 안 읽은 수는 그대로).
  - 실측(데모, 다른 사람의 읽음을 mock에 넣어): 1:1 '안 읽음' → 선생님이 읽자 '읽음' ·
    모둠 세 말 3/3 · 2/3 · 0/3 → 펼치면 '안 읽음 3 이도윤 · 박서준 · 선생님' → 둘이
    읽자 2/3 · 400px 가로 넘침 0.
- **공지 — 반 공지(상단바 확성기)의 최근 3건**(`CHAT_NOTICE_LIMIT`). 학생은 탭 셋째
  '공지', 교사는 대화 목록 맨 위 '최근 공지'. 카드는 세 줄까지, 누르면 펼침.
  - 읽는 것은 **발송 기록 `classes/{cId}/classNotices`**(최신순 · limit 3). 학생 알림함
    (`users/{uid}/notifications`)이 아닌 까닭: 읽은 알림은 정리 함수가 지우고, 교사 ·
    학생이 같은 자료를 보게 하려고요. **규칙을 한 줄 열었습니다** — 그 반 학생 읽기
    (`isClassMember`). 같은 글을 이미 제 알림으로 받아 새로 드러나는 것이 없습니다.
    쓰기는 그대로 서버 함수만.
  - '다정'의 **마감일**은 옮기지 않았습니다 — 반 공지에 그 칸이 없어 쓰는 창과 서버
    함수를 함께 고쳐야 합니다(따로 정할 일).
- **규칙**: 학생은 제 1:1 방 · 제가 든 모둠 방만 읽고 쓰기(모둠 여섯을 펼쳐 봄),
  `fromRole`은 학생이면 'student'만. 담당 교사는 반의 모든 방. 말은 못 고치고 지우는
  것은 담당 교사만. 읽음 표시는 본인만. **코드보다 규칙을 먼저 배포하세요** — 안
  그러면 보내기 · 읽기가 권한 오류입니다.
- 실측(데모 1440 · 400px): 원 안에 행성 여섯 · 가운데에 고른 기능 설명 ·
  바로가기가 책방의 그 창을 엶 · 학생 보내기(Ctrl+Enter · 단추) ·
  교사 목록에 그 학생 · 답장 · 가로 넘침 0.
- **손들기와 메신저는 용도로 가릅니다 — 손바닥은 '지금 수업 중 바로 도움', 메신저는
  '언제든 · 천천히'**(선생님과 정함). 한쪽을 없애지 않고 둘을 잇습니다.
  - **1:1 방에 그 학생의 손들기 대화가 접힌 카드로 섭니다**(`SignalCard` —
    `🖐️ 손들기 오후 5:22 · 질문이요 · 첫 물음 한 줄 · 말 n개`, 누르면 손바닥 창과 같은
    말풍선 `SignalThread`). 섞는 셈은 `lib/messenger.js`의 `dmTimeline`(시험 있음).
    - **복사하지 않고 읽어서 그리기만** 합니다 — 1:1 방을 열 때 `fetchSignalHistory`로
      한 번 읽습니다(`where uid ==` 하나 — 학생도 제 것을 읽는 규칙 그대로, **규칙을 안
      건드림**). 두 곳에 같은 글을 적으면 지우기 · 길이 · 규칙이 어긋납니다.
    - **읽기 전용**이고 **안 읽은 수 · 읽음 · 인용에 안 듭니다** — 손바닥 불이 이미 알린
      말이라 알림이 두 번 가지 않게. 이어서 쓰는 글은 아래 메신저 칸에 씁니다.
    - 글도 태그도 없는 손들기(그냥 부른 손)는 카드를 안 세웁니다(방이 빈 조각으로
      어지러워짐). 방을 연 뒤에 오간 손들기 말은 방을 다시 열어야 들어옵니다.
    - 방 맨 위 '대화 기록 안내'에 '손들고 나눈 대화(🖐️)도 여기 함께 남아요'를 덧붙입니다.
  - **잇는 단추 둘** — 학생의 닫힌 손들기 대화에 **'메신저에서 이어 가기'**(새로 질문하기
    옆), 교사 손든 학생 목록의 줄마다 **'✉ 메신저 대화'**(답하기 옆). 둘 다
    `openMessenger(classId, dmRoom(uid))` → 창 이벤트 `messenger:open` → `FloatingHub`가
    교사면 그 반으로 옮긴 뒤 그 1:1 방을 엽니다(`initialRoom`). 요청은 창을 닫을 때 비웁니다
    (남으면 다음에 동그라미로 열 때 또 그 방으로 감).
  - 학생 손바닥의 툴팁도 '질문하기 — 수업 중 바로 도움이 필요할 때(천천히 이야기할 것은
    메신저로)'입니다.
  - 실측(데모 1440px): 1:1 방에 메신저 말 · 손들기 카드가 시간순으로 섞임 · 빈 손들기는
    카드 없음 · 카드를 펴면 말 둘 · 새로 보낸 말에도 안 읽은 배지 0 · 교사 목록의 '✉ 메신저
    대화'를 누르면 그 학생의 1:1 방이 열림 · 가로 넘침 0.
- 반 완전 삭제는 `purgeClass`가 정리합니다 — 지울 목록
  `CLASS_SUBCOLLECTIONS`(`lib/classPurge.js`)에 `chatMessages` · `chatReads` · `chatRoomReads`를 적어 두었습니다.
  학생 탈퇴(`withdrawStudent`)는 그 학생의 1:1 방 말과 그 학생이 보낸 말(모둠 방 포함)을 지웁니다.
- 아직 없는 것: 그림 · 파일 보내기, 알림 벨과 잇기, '다정'의 새 대화(주제별 스레드).

## 주의 사항

- `lib/data/*`의 Mock 구현과 Firebase 구현을 **항상 동기화**할 것
  (함수 추가 시 두 분기 모두 작성)
- **반 명단은 `useClassRoster`로 받으세요**(`lib/useClassRoster.js`, 셈은
  `lib/roster.js`의 `buildClassRoster`). 같은 셈이 화면마다 따로 있었는데 **손든 학생
  자리 확인 창만 학번순 정렬이 빠져**, 자리표에 없는 학생을 빈자리에 채울 때
  (`normalizeSeats`는 명단 차례를 씁니다) 그 창에서만 다른 자리에 앉았습니다. 소속 uid만
  필요하면 `useClassMembers`.
  - 이 훅은 첫 답 전에도 빈 배열이라 '없다'와 '아직 모른다'를 못 가립니다(위 '첫 화면' 절) —
    그 둘을 갈라야 하는 자리는 따로 셉니다.
  - 디렉터리·과일은 **받아서** 씁니다. 페이지가 이미 다른 데 쓰려고 구독해
    두어, 훅이 또 구독하면 같은 컬렉션에 리스너가 둘입니다.
- **데이터 함수는 영역 파일(`lib/data/*.js`)에 두고, 화면에 보일 것은
  `lib/store.js`의 목록에 한 줄 더합니다.** `store.js`는 7천 줄이 넘던
  한 파일을 영역별로 나눈 뒤 남은 입구라 다시 내보내기만 합니다 — 화면은
  지금까지처럼 `@/lib/store`에서 가져가고, 목록에 안 올리면 화면에서
  안 보입니다. 영역끼리 나눠 쓰는 비공개 도우미(`mock` · `notify…` ·
  `nextMockSeq`)는 일부러 목록에 올리지 않습니다.
  - 데모 문서 id의 일련번호는 `nextMockSeq()`로 올립니다. `mockSeq`는 `let`이라
    다른 파일에서 `++` 할 수 없습니다(ES 모듈의 import는 읽기 전용).
  - **영역 파일끼리 서로 가져올 때 최상위에서 곧바로 쓰지 마세요**(함수 안에서만).
    서로 가져오는 고리가 생기면 먼저 읽힌 쪽에서 아직 정해지지 않은 값을 봅니다.
    `shared.js`는 어느 영역 파일도 가져오지 않습니다 — 그래서 모두가 기댈 수 있습니다.
- **mock 문서는 `replaceDoc(목록, 문서, 고칠 값…)`으로만 고칩니다**
  (`lib/mockDocs.js`). `Object.assign(문서, …)`이나 `문서.필드 = 값`처럼
  제자리에서 고치면 구독하는 쪽이 같은 참조를 받아 React가 다시 그리지
  않습니다 — 반 문서·독서 활동 등에서 따로 네 번 겪은 그 함정입니다
  (위 절들의 '갈아 끼웁니다'가 모두 이것). 한때 이 모양이 store.js에 34곳
  남아 있어 한꺼번에 옮겼습니다. 인자가 Object.assign과 같아 앞에 목록만
  붙이면 되고, 고칠 값 자리에 함수를 주면 지금 문서를 보고 셉니다
  (`(q) => ({ answerCount: q.answerCount + 1 })`). 새 객체는 **목록의 같은
  자리**에 들어갑니다 — 빼고 뒤에 다시 넣으면 화면 차례가 바뀝니다.
- KWLS 기록의 자료 함수는 둘뿐입니다 — `saveKwlsActivityEntry`(활동 저장) · `subscribeActivityKwl`(교사 화면).
- CSS `@media (max-width: 760px)` 블록이 별도 존재함 — 768px 블록에서 필요 시 덮어쓸 것
- 채팅 입력: Enter 단독은 줄바꿈, **Ctrl/⌘+Enter는 전송** (전송 버튼도 유지)
- pdf.js(수업 슬라이드)는 이 앱에 없습니다. 되들인다면 배움나눔의 약속(`legacy` 빌드 · 워커를
  `public/`에 복사)을 그대로 따르세요.

## 읽기 비용 — 활동 목록 화면

**활동 목록 카드의 '모둠 n개 · 학생 n명'은 개수만 묻습니다**(`fetchBookGroupCount` — 전체 − 물러난 것,
`getCountFromServer` 두 번 · 카드 한 장에 2건 남짓, 이 탭에서 5분 기억, 모둠을 다시 짜거나 판을 더하면 그 활동의
기억을 지움). 한때 카드마다 모둠 문서를 통째로 구독해, 개별 활동은 카드 한 장이 학생 수만큼 읽었습니다.
**카드에 모둠 구독을 되살리지 마세요.** 시험 `tests/rules/bookSoloTopic.test.mjs`('활동 카드 — 판(모둠) 수').

**'14칸을 다 채운 학생 n/N'을 활동 목록 카드에 두지 마세요.** 이 값을 내려면
그 활동의 낱말을 전부 읽어야 하는데(활동 하나에 400건 안팎), 목록은 카드가
계속 쌓이는 곳이라 카드마다 그 계산을 돌리면 활동 수에 정비례합니다 — 활동
20개면 목록을 한 번 열 때 7천여 건에 동시 조회 500여 개입니다. 한때 카드에
뒀다가 이 이유로 뺐습니다.

지금은 **작업 화면과 전체 보기**에만 있습니다. 두 화면은 이미 그 활동의 낱말을
구독하고 있어 읽기가 1건도 안 늡니다. 세는 범위가 화면마다 다른 점에 주의:
전체 보기는 모든 판을 받으므로 반 전체, 작업 화면은 개별 활동이면 반 전체이고
**모둠 활동이면 고른 모둠 하나뿐**입니다(그 화면이 그 모둠만 구독). 모둠
활동에서 반 전체를 보려면 '전체 보기'로 갑니다.

세는 단위는 낱말이 아니라 **칸**입니다(13칸에 낱말 14개면 13칸). 표시를
평균에서 완료 인원으로 바꿔도 읽는 양은 같습니다 — '그 칸을 채웠나'는 낱말
문서에만 있어서, 무엇을 세든 전부 읽어야 합니다. 목록에서도 싸게 보려면
낱말을 넣을 때 집계 문서를 함께 갱신하는 수밖에 없는데(Cloud Function),
활동이 스무 개를 넘겨 목록이 느려질 때까지는 하지 마세요 — 얻는 것 없이
어긋날 수 있는 실패 지점만 늡니다.

새 색인을 늘리지 않으려고 `where`만 쓰고 정렬은 화면에서 합니다(등호 필터와
다른 필드 정렬을 함께 걸면 복합 색인이 필요해집니다). 결과가 수백 건 이하인
질의에서만 통하는 방법이니, 범위가 커지는 곳에는 그대로 쓰지 마세요.
