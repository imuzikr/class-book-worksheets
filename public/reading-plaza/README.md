# 책봄 독서 광장 이미지

- `plaza.webp`: 독서 광장의 배경(1672 × 941, 약 266KiB). 선생님이 주신 원본 PNG를 같은 크기의 WebP(quality 84)로 바꿨습니다. 캐릭터는 그림에 넣지 않았습니다 — 학생 캐릭터가 그 위를 걸어 다닙니다.
- 그림 속 물건의 자리가 곧 걷는 길입니다: 책꽂이(위 가운데) · 가판대 셋(왼쪽 둘 · 오른쪽 하나) · 분수(가운데) · 그네 · 정자. 걸을 수 있는 바닥의 테두리와 여는 곳의 좌표는 `lib/readingPlazaMap.js`(`FLOOR` · `BLOCK_ELLIPSES` · `PLAZA_SPOTS`)에 **이 그림의 원본 px**로 적혀 있습니다.
- **그림을 바꾸면 그 좌표를 함께 다시 재세요.** 크기가 달라지면 `PLAZA_W` · `PLAZA_H`도 고칩니다. `tests/unit/readingPlaza.test.mjs`가 처음 서는 자리에서 여는 곳까지 길이 이어지는지 봅니다.
- 캐릭터 그림은 `public/reading-journey/`, 펫 그림은 `public/reading-pets/`의 것을 그대로 씁니다.
