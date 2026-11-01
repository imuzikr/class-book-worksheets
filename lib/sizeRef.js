// 붙을 때마다 크기를 재는 ref 콜백 — 요소가 새로 붙으면(다시 그려져 다른 DOM이
// 되어도) 그 자리에서 재고 ResizeObserver를 새로 걸고, 떨어지면 풉니다.
// useEffect(…, [deps])로 재면 같은 컴포넌트 안에서 요소만 바뀔 때(예: 내 생각은요
// 판의 목록 ↔ 메모판 전환) 옛 요소를 계속 보거나 아예 다시 재지 않습니다.
// onSize({ w, h }) — 떨어질 때는 { w: 0, h: 0 }을 한 번 알립니다.
export function sizeRef(onSize, RO = globalThis.ResizeObserver) {
  let ro = null;
  let current = null;
  return (el) => {
    if (el === current) return;
    if (ro) { ro.disconnect(); ro = null; }
    current = el;
    if (!el) { onSize({ w: 0, h: 0 }); return; }
    const measure = () => onSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (RO) { ro = new RO(measure); ro.observe(el); }
  };
}
