"use client";

import { useMemo } from "react";
import ReadingBadge from "./ReadingBadge";
import "./reading-growth-sidebar.css";

const TIER_NAMES = ["초급", "중급", "고급"];
const SERIES_ORDER = ["shelf", "completion", "streak", "review", "pages", "level"];
const badgeTier = (badge) => Number(badge.tier) || ({ beginner: 1, intermediate: 2, advanced: 3 }[badge.tier]) || 1;
const number = (value) => Number(value || 0).toLocaleString("ko-KR");
const seriesName = (badges, key) => badges[0]?.seriesName || badges[0]?.name?.replace(/\s*(초급|중급|고급)$/, "") || key;

// The reading hub already has these derived badges. This rail only opens the
// parent's detail dialog; it never subscribes to records or changes a badge.
export default function ReadingGrowthSidebar({ stats, onInspect }) {
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
  const earned = (badges || []).filter((badge) => badge.earned).length;
  const featuredId = stats?.featuredBadge?.id || stats?.featuredBadge;

  return <aside className="reading-growth-rail" aria-label="성장·뱃지">
    <header className="reading-growth-summary">
      <h3 className="reading-growth-title">성장·뱃지</h3>
      <span className="reading-growth-count" aria-label={`${badges?.length || 0}개 중 ${earned}개 획득`}>{earned} / {badges?.length || 0}</span>
    </header>
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
                <ReadingBadge badge={badge} size={44} earned={!!badge.earned} className="reading-growth-art" />
                <span className="reading-growth-tier">{tier}</span>
                <span className="reading-growth-status">{status}</span>
              </button>;
            })}
          </div>
        </section>;
      })}
      {!series.length && <p className="reading-growth-empty">독서 기록을 불러오면 성취를 볼 수 있어요.</p>}
    </div>
  </aside>;
}
