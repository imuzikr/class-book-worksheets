// =============================================================
// 대문(첫 화면 /)의 2 · 3 · 4분면 — 책 광장 · 교실 · 개인 아지트의 활동 장면
// -------------------------------------------------------------
// 대문은 화면을 넷으로 나눠 1분면(오른쪽 위)에 지금까지의 대문을 줄여 담고, 나머지 세 칸에 이 장면을 둡니다
// (app/page.js · 배치는 app/styles/01-base-landing-footer.css). 차례가 곧 화면을 읽는 차례(1분면 다음)입니다.
//   · 그림은 public/landing/에 두 벌 — 1440px(`이름.webp`) · 800px(`이름-800.webp`). 만들기는
//     scripts/prepare-landing-art.mjs, 체험반에서 찍는 법은 public/landing/README.md.
//   · width · height는 큰 그림의 크기입니다(그림이 오기 전에 칸의 비율을 잡는 값). 그림을 다시 구우면 함께
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
    alt: "교실 — 칠판 앞에 선생님 캐릭터가 서 있고, 학생 캐릭터 열다섯 명이 펫을 곁에 두고 책상에 앉아 있는 장면",
  }),
  Object.freeze({
    key: "hideout", name: "개인 아지트", width: 1440, height: 954,
    desc: "독서 레벨이 오를수록 열리는 소품으로 나만의 방을 꾸며요",
    alt: "개인 아지트 — 숲속 소품으로 꾸민 방에 학생 캐릭터가 서 있고, 펫이 방석에서 쉬는 장면",
  }),
]);

// 그림 두 벌 중 칸 폭에 맞는 쪽만 내려받게(srcset). 넷으로 나눈 화면에서는 한 칸이 화면 폭의 절반입니다 —
// 그 조건은 CSS의 넷으로 나누는 @media(가로 900px 이상 · 가로가 세로의 1.25배 이상)와 같아야 합니다.
export const LANDING_SCENE_SIZES = "(min-width: 900px) and (min-aspect-ratio: 5/4) 50vw, 100vw";
export const LANDING_SCENE_WIDTHS = Object.freeze([800, 1440]);

export function landingSceneImage(key) {
  return {
    src: `/landing/${key}.webp`,
    srcSet: `/landing/${key}-800.webp 800w, /landing/${key}.webp 1440w`,
  };
}
