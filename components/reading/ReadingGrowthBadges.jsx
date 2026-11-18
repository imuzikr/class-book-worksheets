"use client";

import { useMemo } from "react";
import ReadingBadge from "./ReadingBadge";
import "./reading-growth-badges.css";

const TIER_NAMES = ["초급", "중급", "고급"];
const SERIES_ORDER = ["shelf", "completion", "streak", "review", "pages", "level"];
const badgeTier = (badge) => Number(badge.tier) || ({ beginner: 1, intermediate: 2, advanced: 3 }[badge.tier]) || 1;
const number = (value) => Number(value || 0).toLocaleString("ko-KR");
const seriesName = (badges, key) => badges[0]?.seriesName || badges[0]?.name?.replace(/\s*(초급|중급|고급)$/, "") || key;

// 성장·뱃지 — 여섯 묶음 · 18개 뱃지와 묶음마다 다음 목표. 책 봄이 이미 셈해 둔 뱃지(stats)를 그리기만 하고,
// 뱃지를 누르면 책 봄의 뱃지 상세 창을 엽니다(onInspect) — 기록을 따로 구독하거나 뱃지를 바꾸지 않습니다.
// 떠 있는 동그라미의 '성장·뱃지' 창(ReadingBadgePanel) 안에서만 그립니다 — 머리줄(제목 · n개 중 m개)은 창 머리가 말하고,
// 창 몸통이 구릅니다. 한때 책 봄 왼쪽에 늘 서던 칸(ReadingGrowthSidebar)이었는데 선생님 요청(2026년 11월)으로 동그라미의
// 창으로 옮겼습니다 — 책 봄에 그 칸을 되살리지 마세요(책꽂이가 가로를 다 씁니다).
export default function ReadingGrowthBadges({ stats, onInspect }) {
  const badges = stats?.badges;
  const series = useMemo(() => {
    const grouped = new Map();
    for (const badge of badges || []) {
      const group = grouped.get(badge.series) || [];
      group.push(badge);
      grouped.set(badge.series, group);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => {
        const ai = SERIES_ORDER.indexOf(a), bi = SERIES_ORDER.indexOf(b);
        return (ai < 0 ? SERIES_ORDER.length : ai) - (bi < 0 ? SERIES_ORDER.length : bi);
      })
      .map(([key, items]) => ({ key, badges: items.sort((a, b) => badgeTier(a) - badgeTier(b)) }));
  }, [badges]);
  const featuredId = stats?.featuredBadge?.id || stats?.featuredBadge;

  return <div className="reading-growth">
    <div className="reading-growth-body">
      {series.map(({ key, badges: items }) => {
        const next = items.find((badge) => !badge.earned);
        return <section key={key} className="reading-growth-series" aria-label={seriesName(items, key)}>
          <header className="reading-growth-series-heading">
            <h4>{seriesName(items, key)}</h4>
            <p>{next ? `${next.description} · ${number(next.current)} / ${number(next.threshold)}` : "세 단계의 성취를 모두 모았어요."}</p>
          </header>
          <div className="reading-growth-grid">
            {items.map((badge) => {
              const tier = TIER_NAMES[badgeTier(badge) - 1] || badge.tierName || "초급";
              const featured = !!badge.earned && featuredId === badge.id;
              const status = featured ? "대표" : badge.earned ? "획득" : "도전 중";
              const label = badge.label || `${badge.name || seriesName(items, key)} · ${tier}`;
              return <button type="button" key={badge.id} className={`reading-growth-badge${badge.earned ? " reading-growth-badge--earned" : ""}${featured ? " reading-growth-badge--featured" : ""}`}
                title={`${label} · ${status}`} aria-label={`${label} · ${status} · 자세히 보기`} onClick={() => onInspect?.(badge.id)}>
                <ReadingBadge badge={badge} size={54} earned={!!badge.earned} className="reading-growth-art" />
                <span className="reading-growth-tier">{tier}</span>
                <span className="reading-growth-status">{status}</span>
              </button>;
            })}
          </div>
        </section>;
      })}
      {!series.length && <p className="reading-growth-empty">독서 기록을 불러오면 성취를 볼 수 있어요.</p>}
    </div>
  </div>;
}
