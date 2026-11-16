# 개인 아지트 그림

**도트 그림(1번 스타일 · 2026년 11월)**입니다. 선생님이 주신 묶음(`bookbom-pixel-style1` — 광장 · 교실과 같은 그림체)의
PNG 원본을 `scripts/import-pixel-art.mjs`로 **같은 이름 · 같은 크기**의 WebP로 구웠습니다(품질 88 · 투명 그림은 알파 무손실).
그 앞의 그림(검토를 거친 수정본 v2)과 크기 · 자리가 같아, 배치(`lib/readingHideoutCatalog.js`)는 그대로입니다.
본품은 30종류 × 네 테마 = 120개이며, 기본 가구 일곱 장과 조합용 빈 벽 선반 네 장은 별도입니다. 작은 벽 선반 아이템은 빈 변형 두 인스턴스로 그려 개별 소품과 장식이 중복되지 않게 합니다.

- `items/{종류}/{테마}.webp`: 120개 본품. 그 가운데 24개(여섯 종류 × 네 테마)는 **바닥 가구**입니다 — 2026년 11월에 작은 소품 여섯(필기구 정리함 · 표지 전시대 · 펫 물그릇 · 모래시계 · 탁상 달력 · 배지 진열대)을 바꾼 1인 독서 소파(`items/reading-chair/`) · 큰 나무 화분(`items/big-tree/`) · 독서 텐트(`items/reading-tent/`) · 지구본 스탠드(`items/globe-stand/`) · 독서 침대(`items/reading-bed/`) · 스탠드 어항(`items/aquarium/`). 선생님이 주신 가구 묶음(`bookbom-hideout-floor-furniture-20261116` — 테마별 시트 네 장)을 `scripts/prepare-hideout-furniture.mjs`가 잘라 구웠습니다(크기는 시트 원래 크기). 자리 이름 · 소품 id는 예전 그대로입니다(저장된 방 — `HIDEOUT.md`의 '바닥 가구 여섯').
- `helpers/empty-wall-shelf/{테마}.webp`: 실제 배치·상세에서 사용하는 빈 선반.
- `desk-basic.webp` 등 기본형 일곱 장: 성장 단계와 관계없이 제공하는 기본 방.
- `pets/rest-{종}.webp`: 열 종의96×96 휴식 전용 도트 그림. 펫은 이 방에서 움직이지 않습니다. 알은 도트 알(`public/reading-pets/egg-pixel.webp` — 카드 · 리더보드 · 독서 맵은 예전 알 `egg.webp`, 선생님 결정)을 씁니다. 쉬는 펫 그림은 도트 묶음에서도 예전 파일 그대로입니다.
- `items/clock/{테마}.webp`: 꾸미기 벽시계 4종은 **숫자 없는 시계**(작은 점 12개 · 10시 10분 바늘)입니다 — 처음 묶음의 굵은 눈금이 로마 숫자 Ⅰ처럼 보여 다시 그린 수정본(`bookbom-numberless-wall-clocks`)을 덧씌웠습니다. 교실 벽시계의 시계판도 이 그림에서 떠냅니다(`scripts/prepare-classroom-clock.mjs`).
- `background.webp`: 1536×1024 아지트 배경. **오른쪽 벽의 문을 지운 그림**입니다(선생님 요청 · 2026년 11월 — 도트 묶음의 무손실 원본에서 `scripts/hideout-furniture-art.mjs`의 `removeHideoutDoor`로 채움, `import-pixel-art.mjs`로 다시 구워도 지움). 문을 다시 그려 넣지 마세요.
- `manifest.json`: 각 파일의 크기·SHA-256(`import-pixel-art.mjs` · `prepare-hideout-furniture.mjs`가 새로 씀 — `tests/unit/readingHideoutPetAssets.test.mjs`가 봄). `floorFurniture`에 가구 묶음의 시트 SHA-256을 적어 둡니다.

승인된 책상·의자 폭288, 러그432, 캐릭터 프레임252, 펫 프레임 최대120을 유지합니다. 보물함은 왼쪽 아래의 `(145,970)`, 폭135입니다. 트로피는 폭72로 오른쪽 전시 선반에 올립니다. 작은 소품은 그림 속 픽셀만 누르게 하지 않고 큰 목록·상세에서 고릅니다.

소품의 책·배지는 장식입니다. 학생이 읽은 실제 책이나 획득 배지를 그 안에 합성한 그림은 아닙니다. 문패의 이름은 앱에서 별도 글자로, 문패 그림의 크림색 칸 안에 맞춰 그립니다(`HIDEOUT_PLAQUE_PANELS` — 문패 그림을 바꾸면 그 띠를 다시 재세요). 책상 위 소품(책 받침대)의 자리는 책상마다 따로입니다(`lib/readingHideout.js`의 `HIDEOUT_TABLETOP` — 책상 그림을 바꾸면 다시 재세요, `HIDEOUT.md`). 방 안 좌표와 미리보기는 서버에 저장하지 않고 선택한 소품 ID만 저장합니다.

카탈로그·고정 배치는 `lib/readingHideoutCatalog.js`, 공통 검증은 `lib/readingHideout.js`에 있습니다.

- **그림을 다시 넣을 때**: 두 ZIP을 한 폴더에 풀고 `node scripts/import-pixel-art.mjs <그 폴더> <넓은 러그 묶음 폴더> <숫자 없는 벽시계 묶음 폴더>`(뒤의 둘은 몇 장만 다시 그린 덧씌울 묶음 — 빼면 처음 묶음의 좁은 러그 · 눈금 있는 시계로 돌아갑니다). 크기가 지금 그림과 다른 파일이 하나라도 있으면 아무것도 쓰지 않고 멈춥니다(배치 · 좌표가 그 크기에 맞춰 있음).
- 옛 그림(refined-v2)의 `scripts/import-hideout-art.mjs`는 배치(카탈로그)를 다시 만들 때만 씁니다 — 그림까지 예전 것으로 되돌리므로, 돌린 뒤에는 `import-pixel-art.mjs`를 다시 돌리세요.
