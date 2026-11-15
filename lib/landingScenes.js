// =============================================================
// 대문(첫 화면 /)의 그림 — 함께 책 읽는 일러스트와 책 광장 · 교실 · 개인 아지트의 활동 장면
// -------------------------------------------------------------
// 대문은 왼쪽에 제목 · 소개, 오른쪽 무대에 이 그림 넷을 사진처럼 크기 · 기울기를 달리해 겹쳐
// 놓습니다(app/page.js · 배치는 app/styles/01-base-landing-footer.css의 '대문' — 선생님 요청 2026년 11월).
// 차례가 곧 겹치는 차례(뒤 → 앞)이자 화면을 읽는 차례입니다(일러스트 다음).
//   · 장면 그림은 public/landing/에 두 벌 — 1440px(`이름.webp`) · 800px(`이름-800.webp`). 만들기는
//     scripts/prepare-landing-art.mjs, 체험반에서 찍는 법은 public/landing/README.md.
//   · width · height는 큰 그림의 크기입니다(그림이 오기 전에 자리의 비율을 잡는 값). 그림을 다시 구우면 함께
//     맞추세요 — tests/unit/landingArt.test.mjs가 그림 파일과 견줍니다.
//   · 이름은 관리자 설정 · 문서의 낱말 그대로입니다('책 광장' — 옛 이름을 쓰지 마세요).
// =============================================================

export const LANDING_SCENES = Object.freeze([
  Object.freeze({
    key: "plaza", name: "책 광장", width: 1440, height: 810,
    desc: "펫과 함께 광장을 거닐며 친구들의 책 이야기를 읽고 댓글을 남겨요",
    alt: "책 광장 — 분수가 있는 광장에서 학생 캐릭터들이 펫과 함께 거닐며 이야기를 나누고, 가판대와 책꽂이에 친구들의 책이 놓인 장면",
  }),
  Object.freeze({
    key: "classroom", name: "교실", width: 1440, height: 810,
    desc: "내 책상에 앉으면 선생님이 칠판 앞에서 출석을 확인해요",
    alt: "교실 — 출석부가 붙은 칠판 앞에 선생님 캐릭터가 서 있고, 학생 캐릭터 열다섯 명이 펫을 곁에 두고 책상에 앉아 있는 장면",
  }),
  Object.freeze({
    key: "hideout", name: "개인 아지트", width: 1440, height: 953,
    desc: "독서 레벨이 오를수록 열리는 소품으로 나만의 방을 꾸며요",
    alt: "개인 아지트 — 숲속 소품으로 꾸민 방에 학생 캐릭터가 서 있고, 펫이 방석에서 쉬는 장면",
  }),
]);

// 그림 두 벌 중 화면에 놓인 폭에 맞는 쪽만 내려받게(srcset). 조건은 CSS의 @media와 같아야 합니다 —
// 가로 960px 이상 · 가로로 긴 화면은 글과 무대가 나란히(무대가 화면 폭의 절반쯤 · 장면 하나는 그 60%까지),
// 700px 이상은 무대 한 판이 글 아래에, 그보다 좁으면 사진이 한 줄에 하나씩.
export const LANDING_SCENE_SIZES = "(min-width: 960px) and (min-aspect-ratio: 5/4) 36vw, (min-width: 700px) 60vw, 88vw";
export const LANDING_SCENE_WIDTHS = Object.freeze([800, 1440]);

export function landingSceneImage(key) {
  return {
    src: `/landing/${key}.webp`,
    srcSet: `/landing/${key}-800.webp 800w, /landing/${key}.webp 1440w`,
  };
}

// 무대 맨 뒤의 일러스트(지금까지의 대문 그림) — 원본 1654px과 줄인 800px(같은 비율) 두 벌.
export const LANDING_READING = Object.freeze({
  src: "/landing-reading.webp",
  srcSet: "/landing-reading-800.webp 800w, /landing-reading.webp 1654w",
  sizes: "(min-width: 960px) and (min-aspect-ratio: 5/4) 30vw, (min-width: 700px) 48vw, 86vw",
  width: 1654,
  height: 725,
  alt: "도서관 책상에 둘러앉은 네 친구가 책을 펼쳐 들고 이야기하고, 뒤에서 두 친구가 책장의 책을 고르는 그림",
});
