"use client";

import "./reading-badge-art.css";

const TIER_NAMES = ["초급", "중급", "고급"];

function tierIndex(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(2, Math.floor(value) - 1));
  if (["advanced", "gold", "고급", "3"].includes(value)) return 2;
  if (["intermediate", "silver", "중급", "2"].includes(value)) return 1;
  return 0;
}

function seriesOf(badge) {
  const key = `${badge?.series ?? ""} ${badge?.id ?? ""}`.toLowerCase();
  if (/complet|finish|완독/.test(key)) return "completion";
  if (/streak|habit|연속|꾸준/.test(key)) return "streak";
  if (/review|thought|감상|생각/.test(key)) return "review";
  if (/page|month|페이지/.test(key)) return "pages";
  if (/level|growth|레벨|성장/.test(key)) return "level";
  return "shelf";
}

/** Shared original 3D artwork for the gallery, dashboard, and journey HUD.
 * Badge IDs, unlock conditions, rewards, and featured-badge selection stay in
 * the reading model; this component only renders their visual identity.
 */
export default function ReadingBadge({ badge, size = 72, earned = true, className = "" }) {
  const tier = tierIndex(badge?.tier);
  const series = seriesOf(badge);
  const title = `${badge?.name || "독서 성취"} · ${TIER_NAMES[tier]}${earned ? "" : " · 도전 중"}`;
  const badgeSize = Number.isFinite(Number(size)) ? Math.max(24, Number(size)) : 72;

  return <img
    className={`reading-badge-art${earned ? " is-earned" : " is-locked"} ${className}`.trim()}
    src={`/reading-badges/v2/${series}_${tier + 1}.webp`}
    alt={title}
    title={title}
    width={badgeSize}
    height={badgeSize * 1.14}
    data-series={series}
    data-tier={tier + 1}
    data-earned={earned ? "true" : "false"}
    draggable={false}
    decoding="async"
    style={{ flexShrink: 0 }}
  />;
}
