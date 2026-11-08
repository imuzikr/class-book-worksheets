// 개인별 분석 리포트 맨 아래 '날마다 쌓인 독서량' 선 그래프의 셈(선생님 요청).
// 조회 기간의 **모든 날**(독서하지 않은 날 포함 — reading.daily가 이미 빈날을 0으로 채워 줌)을
// 차례로 지나며 읽은 쪽수를 더해 갑니다. 쉬는 날은 선이 평평하게 이어집니다.
export function cumulativeDaily(daily = []) {
  let total = 0;
  return (Array.isArray(daily) ? daily : [])
    .filter((d) => typeof d?.date === "string")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const pages = Math.max(0, Number(d.pages) || 0);
      total += pages;
      return { date: d.date, pages, total };
    });
}

// 가로축에 적을 날짜 — 처음 · 끝은 늘, 사이는 고르게 많아야 max개.
export function cumulativeTicks(length, max = 7) {
  if (length <= 0) return [];
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const out = new Set([0, length - 1]);
  const step = (length - 1) / (max - 1);
  for (let k = 1; k < max - 1; k++) out.add(Math.round(k * step));
  return [...out].sort((a, b) => a - b);
}

// 세로축 눈금 — 0부터 보기 좋은 단위(1 · 2 · 5 × 10ⁿ)로 4칸 남짓.
export function niceCeiling(value) {
  const v = Math.max(1, Number(value) || 0);
  const raw = v / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  // 쪽수는 정수라 한 칸이 1보다 작지 않게(기록이 없으면 0 ~ 4)
  const unit = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((u) => u >= raw) ?? 10 * pow);
  return { unit, top: Math.max(4, Math.ceil(v / unit) * unit) };
}
