// =============================================================
// 책 광장 — 무대가 쓸 수 있는 높이 (화면에서 재는 셈)
// -------------------------------------------------------------
// 책방 본문은 제 안에서 구르는 칸(.books-main)이라 CSS만으로는 '남은 높이'를 모릅니다. 무대 칸의 위쪽부터
// 그 구르는 칸의 바닥까지를 잽니다. 두 곳이 같은 셈을 씁니다 —
//   · 진짜 무대(components/reading/ReadingPlaza.jsx의 measure — 여기에 무대 아래 남는 것을 더 뺌)
//   · 광장을 내려받는 동안의 자리(components/reading/ReadingHub.jsx의 PlazaLoading)
// 둘이 다르게 재면 다 받는 순간 높이가 덜컥 바뀝니다.
// =============================================================

/** 창이 아주 낮아도 무대는 이만큼은 섭니다(나머지는 화면이 구름). */
export const PLAZA_STAGE_MIN_H = 300;

/** 그 요소를 품은 '구르는 칸'(overflow-y가 auto · scroll인 가장 가까운 조상) — 없으면(문서가 구름) null. */
export function plazaScroller(el) {
  let scroller = el?.parentElement ?? null;
  while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  return scroller && scroller !== document.body ? scroller : null;
}

/**
 * 그 요소의 위쪽부터 구르는 칸의 바닥까지(px).
 * 구르는 칸이 굴러가 있어도 같은 값입니다 — 화면 자리(rect.top)에 굴린 만큼(scrollTop)을 도로 더해 '내용 안의 자리'로 셉니다.
 * 탭을 바꾸는 순간에는 앞 화면에서 굴린 값이 아직 남아 있을 수 있어, 화면 자리만 보면 그만큼 크게 나옵니다.
 */
export function plazaRoom(el, scroller) {
  const rect = el.getBoundingClientRect();
  return scroller
    ? scroller.clientHeight - (rect.top - scroller.getBoundingClientRect().top + scroller.scrollTop)
    : window.innerHeight - (rect.top + window.scrollY);
}
