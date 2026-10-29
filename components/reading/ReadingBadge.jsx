"use client";

import { useId } from "react";

const TIER_NAMES = ["초급", "중급", "고급"];
const PALETTES = [
  { ink: "#216762", field: "#e7f5ef", inner: "#f8fff9", edge: "#a0bcb6", metal: "#dbe8e3", ribbon: "#789e95" },
  { ink: "#31599c", field: "#e9f0fd", inner: "#fbfdff", edge: "#8fa9cf", metal: "#e5edf9", ribbon: "#5279b4" },
  { ink: "#403a7b", field: "#f0ecfc", inner: "#fffaf0", edge: "#bc9651", metal: "#f6dfa3", ribbon: "#57508e" },
];
const LOCKED = { ink: "#8c9599", field: "#f1f3f2", inner: "#fafbf9", edge: "#c4cbca", metal: "#e0e5e1", ribbon: "#b4bfbc" };

function tierIndex(value) {
  if (typeof value === "number") return Math.max(0, Math.min(2, value - 1));
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

function BadgeSymbol({ series }) {
  switch (series) {
    case "completion":
      return <>
        <path d="M26 34c9-4 16-2 22 2 6-4 13-6 22-2v29c-9-4-16-3-22 1-6-4-13-5-22-1Z" />
        <path d="M48 36v28M32 41c4-1 7 0 10 1m-10 7c4-1 7 0 10 1m12-8c4-2 7-2 10-1" />
        <circle cx="66" cy="60" r="11" fill="var(--reading-badge-inner)" />
        <path d="m60 60 4 4 8-9" strokeWidth="3" />
      </>;
    case "streak":
      return <>
        <path d="M48 24c2 9 12 13 12 23 0 2 0 4-1 6 4-2 7-6 7-11 8 8 10 20 2 28-5 5-11 7-18 6-13-1-22-9-21-21 0-10 9-16 10-24 3 3 4 7 4 12 6-5 7-12 5-19Z" />
        <path d="M49 49c2 6 9 10 8 16-1 5-4 8-9 8-6 0-10-4-10-10 0-6 6-10 11-14Z" fill="currentColor" opacity=".17" />
        <path d="M36 81h26" />
      </>;
    case "review":
      return <>
        <path d="M28 35h21m-21 8h16m-16 8h12m-12 8h9M25 29h30v43H25Z" />
        <path d="m40 68 5-14 22-26a5 5 0 0 1 8 7L53 61l-13 7Z" fill="var(--reading-badge-inner)" />
        <path d="m45 54 8 7m9-28 8 7M41 67l5-2" />
        <path d="M55 75h16" />
      </>;
    case "pages":
      return <>
        <path d="M27 34h34v41H27Zm7-6h34v40m-27-47h34v40" />
        <circle cx="46" cy="53" r="13" fill="var(--reading-badge-inner)" />
        <path d="m51 46-2 11-10 3 3-11 9-3Z" fill="currentColor" opacity=".22" />
        <path d="m51 46-2 11-10 3 3-11 9-3Z" />
        <path d="M46 37v3m0 26v3M30 53h3m26 0h3" />
      </>;
    case "level":
      return <>
        <path d="m48 24 7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2 7-15Z" />
        <path d="m41 50 7-7 7 7m-7-7v15" strokeWidth="3" />
        <path d="M33 79h30m-24-7h18" />
      </>;
    default:
      return <>
        <path d="M25 31h13v43H25Zm15 6h13v37H40Zm17-8 12-2 8 43-13 2-7-43Z" />
        <path d="M28 40h7m-7 23h7m8-17h7m-7 17h7m11-25 6-1m-3 25 6-1M22 79h55" />
        <path d="M29 31v9l3-2 3 2v-9" fill="currentColor" opacity=".18" />
      </>;
  }
}

/** Original vector collection: the same emblem gains a ribbon, border and ornaments by tier. */
export default function ReadingBadge({ badge, size = 72, earned = true, className = "" }) {
  const id = useId().replace(/:/g, "");
  const tier = tierIndex(badge?.tier);
  const palette = earned ? PALETTES[tier] : LOCKED;
  const title = `${badge?.name || "독서 성취"} · ${TIER_NAMES[tier]}${earned ? "" : " · 도전 중"}`;
  const badgeSize = Number.isFinite(Number(size)) ? Math.max(24, Number(size)) : 72;

  return (
    <svg
      className={`reading-badge-art ${className}`.trim()}
      width={badgeSize}
      height={badgeSize * 1.14}
      viewBox="0 0 96 110"
      role="img"
      aria-labelledby={`${id}-title`}
      focusable="false"
      style={{ "--reading-badge-inner": palette.inner, flexShrink: 0, overflow: "visible" }}
    >
      <title id={`${id}-title`}>{title}</title>
      <defs>
        <linearGradient id={`${id}-field`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={palette.inner} />
          <stop offset="1" stopColor={palette.field} />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={palette.metal} />
          <stop offset=".55" stopColor={palette.edge} />
          <stop offset="1" stopColor={palette.metal} />
        </linearGradient>
      </defs>
      {tier > 0 && <g fill={palette.ribbon}>
        <path d="m27 73-9 26 14-5 8 10 9-27Z" />
        <path d="m69 73 9 26-14-5-8 10-9-27Z" />
        <path d="m27 76-6 18 11-4 7 8 6-19m24-3 6 18-11-4-7 8-6-19" fill="none" stroke={palette.metal} strokeWidth="1" opacity=".65" />
      </g>}
      <path d="m48 5 25 8 15 21v28L74 84l-26 14-26-14L8 62V34l15-21Z" fill={palette.ink} opacity=".08" transform="translate(0 3)" />
      <path d="m48 4 25 8 15 21v28L74 83l-26 14-26-14L8 61V33l15-21Z" fill={`url(#${id}-edge)`} />
      <path d="m48 9 22 7 13 19v25L70 80 48 92 26 80 13 60V35l13-19Z" fill={`url(#${id}-field)`} stroke={palette.ink} strokeOpacity=".18" />
      {tier > 0 && <path d="m48 14 19 6 10 16v22L66 76 48 86 30 76 19 58V36l10-16Z" fill="none" stroke={palette.edge} strokeWidth="1.25" />}
      <g color={palette.ink} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <BadgeSymbol series={seriesOf(badge)} />
      </g>
      {tier === 2 && <g fill={palette.edge} stroke={palette.edge} strokeWidth=".6">
        <path d="m14 34 2 4 4 1-4 2-2 4-1-4-4-2 4-1Zm68 0 1 4 4 1-4 2-1 4-2-4-4-2 4-1Z" />
        <path d="m38 13 3 1m14 0 3-1M30 19l3 2m30 0 3-2" fill="none" strokeWidth="2" strokeLinecap="round" />
      </g>}
      <g transform="translate(48 88)">
        <rect x="-13" y="-7" width="26" height="14" rx="7" fill={palette.ink} />
        {Array.from({ length: tier + 1 }, (_, index) => (
          <path key={index} d={`M${(index - tier / 2) * 5} -3v6`} stroke={palette.inner} strokeWidth="2" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}
