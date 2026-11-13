# 책봄 책 광장 이미지

- `plaza.webp`: 책 광장의 배경(1672 × 941, 약 266KiB). 선생님이 주신 원본 PNG를 같은 크기의 WebP(quality 84)로 바꿨습니다. 캐릭터는 그림에 넣지 않았습니다 — 학생 캐릭터가 그 위를 걸어 다닙니다.
- 그림 속 물건의 자리가 곧 걷는 길입니다: 책꽂이(위 가운데) · 가판대 셋(왼쪽 둘 · 오른쪽 하나) · 분수(가운데) · 그네 · 정자. 걸을 수 있는 바닥의 테두리와 여는 곳의 좌표는 `lib/readingPlazaMap.js`의 방 정의(`PLAZA_ROOM` — 바닥 `floor` · 분수 `ellipses` · 여는 곳 `spots`)에 **이 그림의 원본 px**로 적혀 있습니다.
- **그림을 바꾸면 그 좌표를 함께 다시 재세요.** 크기가 달라지면 `PLAZA_W` · `PLAZA_H`도 고칩니다. `tests/unit/readingPlaza.test.mjs`가 처음 서는 자리에서 여는 곳까지 길이 이어지는지 봅니다.
- 화면에서는 이 그림이 무대(탭 아래부터 화면 바닥까지)를 **빈틈없이 덮도록** 키워지고, 넘치는 쪽은 시점이 캐릭터를 따라가며 보여 줍니다(`plazaView` · `plazaCamera`). 처음 서는 자리(`PLAZA_SPAWN`)는 책꽂이와 분수 사이라 넓은 화면에서도 책꽂이 · 가판대가 처음부터 보입니다 — 그림을 바꿔 책꽂이 · 분수의 자리가 달라지면 그 자리도 함께 옮기세요.

## 교실 · 문 달린 광장 · 포털 (관리자 설정의 '교실'을 켠 반)

책 광장의 둘째 방 '교실'을 위한 그림 세 장입니다(선생님이 주신 묶음의 PNG 세 장 — `classroom-map.png` · `reading-plaza-map.png` · `portal.png`). 약속은 `READING_GROWTH.md`의 '교실' 절에 있습니다.

- `classroom.webp`: 교실의 배경(1672 × 941, 약 126KiB). 칠판 · 책상 30개(6칸 × 5줄 — 두 칸씩 짝지은 세 묶음) · 오른쪽 아래의 문과 포털이 **그림에 그려져** 있습니다.
- `plaza-door.webp`: **왼쪽 아래에 교실로 가는 문과 포털이 그려진** 책 광장의 배경(1672 × 941, 약 277KiB). 교실을 켠 반에서만 씁니다 — 끈 반은 문이 없는 `plaza.webp` 그대로입니다. 문이 선 자리만 다르고 나머지 물건의 자리는 `plaza.webp`와 같습니다.
- `portal-swirl.webp`: 포털 안쪽의 소용돌이만 오려 **동그랗게 편** 그림(256 × 256, 가장자리가 투명하게 풀림 · 약 15KiB). 화면이 이것을 돌리면서 다시 납작하게 눌러, 배경에 그려진 포털 위에 얹습니다 — 비스듬히 본 타원을 그대로 돌리면 접시가 흔들리는 것처럼 보입니다.
- 만드는 법: `python3 -I scripts/prepare-classroom-art.py <풀어 둔 PNG 폴더> <내보낼 폴더>`(Pillow만 씀). 배경 두 장은 같은 크기의 WebP(quality 84)로만 바꾸고, 소용돌이는 오려 내 가장자리를 풉니다.
- **세 배경은 크기가 같아야 합니다**(1672 × 941) — 화면 확대 · 시점의 셈을 방마다 따로 두지 않습니다(스크립트가 크기를 확인함).
- **그림을 바꾸면 좌표를 함께 다시 재세요** — `lib/readingPlazaMap.js`의 책상(`DESK_X` · `DESK_Y` — 책상 윗면의 가운데) · 책상 줄의 못 가는 띠(`DESK_HALF` · `DESK_TOP` · `DESK_BOTTOM`) · 칠판(`CLASSROOM_BOARD`) · 포털(`PLAZA_PORTAL` · `CLASSROOM_PORTAL`) · 두 방의 바닥 테두리 · 문 달린 광장의 왼쪽 아래 모서리(`PLAZA_DOOR_CORNER`)와 둘째 가판대 앞에 서는 자리. 책상 30개의 차례는 **자리표의 30자리**(줄 × 6 + 칸 · 칠판이 위)와 같아야 합니다. `tests/unit/readingClassroom.test.mjs`가 책상 · 복도 · 칠판 앞 · 포털까지 길이 이어지는지 봅니다.
- 앉은 캐릭터의 허리 아래를 가리는 의자는 따로 그림을 두지 않고 **`classroom.webp`에서 그 자리를 오려** 캐릭터 위에 한 번 더 그립니다(`components/reading/PlazaActor.jsx`의 `.plaza-chair`). 의자의 자리(책상 가운데에서 아래로 14~60px)가 달라지면 `CLASSROOM_SEATS`의 `chair` · `sit`도 함께 고칩니다.

## 걷는 그림 — `sprites/` (캐릭터 30 · 펫 10)

광장을 걸어 다니는 캐릭터와 펫의 도트 그림입니다. 선생님이 주신 묶음(`reading-plaza-all-sprites.zip`)의 시트 40장을 그대로 넣었습니다.

- 이름: 캐릭터 `zodiac-01`~`10` · `animal-01`~`10` · `fantasy-01`~`10`(책봄 캐릭터의 묶음 · 번호 그대로 — `lib/readingCharacterCatalog.js`의 `characterOf`가 주는 `{ style, number }`), 펫 `pet-owl` · `pet-hedgehog` · `pet-chick` · `pet-otter` · `pet-fennec` · `pet-redpanda` · `pet-rabbit` · `pet-bear` · `pet-cat` · `pet-puppy`(`lib/readingPet.js`의 종 열쇠).
- 규격: 한 장이 **288 × 288px**, 한 칸 **96px**, 3 × 3칸.

  | 줄 / 칸 | 0칸 | 1칸 | 2칸 |
  |---|---|---|---|
  | 0줄 · 앞(아래로 걸을 때) | 정지 | 걷기 A | 걷기 B |
  | 1줄 · 오른쪽 | 정지 | 걷기 A | 걷기 B |
  | 2줄 · 뒤(위로 걸을 때) | 정지 | 걷기 A | 걷기 B |

  **왼쪽은 오른쪽 줄을 좌우로 뒤집어** 씁니다. 칸 안에서 **발이 닿는 점은 (48, 88)**, 몸의 키는 72px입니다(360장 모두 발끝이 같은 높이 — 그래서 그림이 바뀌어도 자리가 튀지 않습니다). 발 그림자 · 이름표는 그림에 없고 화면이 그립니다.
- 넣을 때 한 일: 묶음의 PNG를 **무손실 WebP**로 다시 인코딩했습니다(완전히 투명한 점의 색 값만 0으로 — 보이는 점은 한 점도 다르지 않음). 40장 합쳐 1.9MB, 한 장 34~66KB. 학생은 제 캐릭터 한 장과 제 펫 한 장만 받습니다.
- 펫 그림은 **다 자란 모습 한 가지**입니다 — 광장은 단계에 따라 **크기**로 성장을 보입니다(2단계 62% → 10단계 100%, 선생님 결정). 깨어나기 전의 알은 `public/reading-pets/egg.webp`(공통 알)를 그대로 씁니다. 펫 카드 · 리더보드의 단계별 그림(`public/reading-pets/`)과는 따로입니다.
- 셈(방향 · 그림 차례 · 크기 · 펫이 따라올 자리)은 `lib/readingPlazaSprites.js`, 그리기는 `components/reading/PlazaSprite.jsx`입니다. **규격이 다른 그림으로 바꾸면 그 파일 맨 위의 값을 함께 고치세요.**
- **캐릭터 · 펫을 새로 더하면 시트도 함께 넣으세요.** `tests/unit/readingPlaza.test.mjs`가 캐릭터 30 · 펫 10의 시트가 모두 있는지 봅니다. 시트가 없으면 그 캐릭터는 광장에서 예전 그림(`public/reading-journey/` · `public/reading-pets/`)으로 섭니다.
- 저작권: 묶음에 함께 온 표시대로 이 저장소와 같은 CC BY-NC 4.0입니다.
