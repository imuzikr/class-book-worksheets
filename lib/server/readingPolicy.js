// Server-side reading access and period calculations. Pure so the policy can be
// exercised without credentials or a running Firebase service.
const DAY_MS = 86400000;
const KST_OFFSET = 9 * 3600000;

export class ReadingHttpError extends Error {
  constructor(message, status = 400, code = "reading/invalid-request") {
    super(message);
    this.name = "ReadingHttpError";
    this.status = status;
    this.code = code;
  }
}

export function readingClassId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new ReadingHttpError("반을 먼저 선택해 주세요.");
  }
  return value;
}

export function assertReadingAccess({ uid, roleClaim, profile, classDoc, membership }) {
  if (!uid || !profile) throw new ReadingHttpError("로그인이 필요합니다.", 401, "reading/unauthenticated");
  if (!classDoc || classDoc.archived === true || classDoc.readingEnabled !== true) {
    throw new ReadingHttpError("이 반에서는 책나눔 성장 기능을 사용하지 않습니다.", 403, "reading/disabled");
  }
  const role = roleClaim || profile.role || "student";
  if (role === "admin") return;
  if (role === "teacher") {
    if (classDoc.createdBy === uid) return;
  } else if (role === "student" && membership?.uid === uid && membership?.classId === classDoc.id) {
    return;
  }
  throw new ReadingHttpError("이 반의 책나눔을 사용할 권한이 없습니다.", 403, "reading/forbidden");
}

export function readingPeriodBounds(period = "weekly", now = new Date()) {
  if (!["daily", "weekly", "monthly", "all-time"].includes(period)) {
    throw new ReadingHttpError("올바른 랭킹 기간을 선택해 주세요.");
  }
  const shifted = new Date(new Date(now).getTime() + KST_OFFSET);
  const day = Math.floor(shifted.getTime() / DAY_MS);
  const today = shifted.toISOString().slice(0, 10);
  let start = null;
  if (period === "daily") start = today;
  if (period === "weekly") {
    const weekday = shifted.getUTCDay();
    const monday = day - (weekday === 0 ? 6 : weekday - 1);
    start = new Date(monday * DAY_MS).toISOString().slice(0, 10);
  }
  if (period === "monthly") start = today.slice(0, 7) + "-01";
  return { start, end: today };
}

export function readingPeriodXp(events, period, now = new Date()) {
  const { start, end } = readingPeriodBounds(period, now);
  return (Array.isArray(events) ? events : []).reduce((sum, event) => {
    if (typeof event?.date !== "string" || event.date > end || (start && event.date < start)) return sum;
    const xp = Number(event.xp);
    return Number.isFinite(xp) && xp >= 0 ? sum + xp : sum;
  }, 0);
}

export function sortReadingRankings(items) {
  const ordered = items.slice().sort((a, b) =>
    b.xp - a.xp || String(a.studentId || "").localeCompare(String(b.studentId || ""), "ko", { numeric: true }) || a.uid.localeCompare(b.uid)
  );
  let lastXp;
  let rank = 0;
  return ordered.map((item, index) => {
    if (index === 0 || item.xp !== lastXp) rank = index + 1;
    lastXp = item.xp;
    return { ...item, rank };
  });
}
