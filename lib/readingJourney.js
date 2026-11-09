// =============================================================
// 리더보드 · 독서 여정 — 셈만 모은 곳 (components/reading/ReadingLeaderboard.jsx)
// -------------------------------------------------------------
// imuzikr/class-read-book의 '독서 여정 현황'(경주 트랙 · 순위 · 내 여정 이야기)을
// 책봄의 책나눔 계산(lib/reading.js)에 맞춰 옮겼습니다. 경험치 · 레벨 · 뱃지는
// 새로 세지 않고 deriveReading과 반 집계(readingMembers)의 값을 씁니다.
// =============================================================
import { getExpForReadingLevel, getReadingLevel, READING_BADGES, STREAK_MIN_PAGES } from "./reading.js";

const DAY_MS = 86400000;
const BADGE_IDS = new Set(READING_BADGES.map((b) => b.id));

// 레벨에 따른 길 위의 모습 — 뱃지 '독서 성장'이 레벨 3 · 5 · 7이라 그 자리에서 바뀝니다.
export function journeyAvatar(level) {
  const n = Number(level) || 1;
  if (n >= 10) return "👑";
  if (n >= 8) return "🧙";
  if (n >= 7) return "🦉";
  if (n >= 5) return "🏃";
  if (n >= 3) return "📚";
  if (n >= 2) return "🌿";
  return "🌱";
}

export function journeyTitle(level) {
  const n = Number(level) || 1;
  if (n >= 10) return "독서 마스터";
  if (n >= 7) return "독서 탐험가";
  if (n >= 5) return "열정적인 독서가";
  if (n >= 3) return "성실한 독서가";
  return "새싹 독서가";
}

const STAGES = ["시작의 마을", "독서의 숲", "지식의 언덕", "상상의 바다", "지혜의 산", "탐험의 계곡", "발견의 섬", "성장의 평원", "완성의 성", "마스터의 궁전"];
// 레벨 하나가 길 위의 한 곳입니다(10레벨 넘으면 마지막 곳).
export function journeyStage(level) {
  const n = Math.max(1, Number(level) || 1);
  return STAGES[Math.min(n, STAGES.length) - 1];
}

// 경험치 → 레벨 안에서 얼마나 왔나(0~100)
export function levelProgress(xp) {
  const v = Math.max(0, Number(xp) || 0);
  const level = getReadingLevel(v);
  const from = getExpForReadingLevel(level);
  const to = getExpForReadingLevel(level + 1);
  return { level, from, to, toNext: Math.max(0, to - v), percent: to > from ? Math.min(100, Math.round((v - from) / (to - from) * 100)) : 100 };
}

// 트랙 끝 레벨 — 레벨 7(마지막 성장 뱃지)까지는 늘 보이고, 앞선 학생이 있으면 한 칸 더.
export function journeyTrackMax(rows = []) {
  const top = Math.max(1, ...rows.map((r) => Number(r?.level) || 1));
  return Math.max(7, top + 1);
}

// 트랙 위 자리(%) — 레벨 1 시작이 4%, 끝 레벨이 96%. 레벨 안 진행만큼 다음 칸 쪽으로.
export function journeyPosition(xp, maxLevel) {
  const { level, percent } = levelProgress(xp);
  const span = Math.max(1, maxLevel - 1);
  const raw = (level - 1 + percent / 100) / span;
  return Math.round((4 + Math.min(1, Math.max(0, raw)) * 92) * 10) / 10;
}

// 오늘 기준 연속 독서일 — 마지막으로 읽은 날이 오늘이나 어제면 그 줄을 잇습니다.
export function currentStreakOf(streakRun, lastReadDate, today) {
  if (!lastReadDate || !today || !(Number(streakRun) > 0)) return 0;
  const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastReadDate}T00:00:00Z`)) / DAY_MS);
  return gap >= 0 && gap <= 1 ? Number(streakRun) : 0;
}

// 반 집계에 함께 적어 둘 값 — 책 제목 · 감상 글은 넣지 않습니다(친구에게 보이는 자리).
export function memberSnapshot(summary) {
  return {
    totalXp: Math.max(0, Number(summary?.xp) || 0),
    badges: (summary?.earnedBadges ?? []).map((b) => b.id).filter((id) => BADGE_IDS.has(id)),
    totalPages: Math.max(0, Number(summary?.totalPages) || 0),
    completedBooks: Math.max(0, Number(summary?.totalBooks) || 0),
    reviewCount: Math.max(0, Number(summary?.reviewCount) || 0),
    longestStreak: Math.max(0, Number(summary?.longestStreak) || 0),
    streakRun: Math.max(0, Number(summary?.streakRun) || 0),
    lastReadDate: typeof summary?.lastReadDate === "string" ? summary.lastReadDate : null,
    fruitCount: Math.max(0, Number(summary?.fruitCount) || 0),
    xpReachedOn: xpReachedOn(summary?.events),
    // 날마다 얻은 경험치(모든 반 합) — '독서 TOP 3'가 그 주 월요일 전날까지를 셀 때 씁니다(readingTopAsOf).
    xpDays: dailyXp(summary?.events),
  };
}

// 경험치 기록 → 날짜마다 한 줄 [{ date, xp }](날짜 차례). 경험치가 0인 날은 뺍니다.
export function dailyXp(events) {
  const byDate = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    const xp = Number(e?.xp) || 0;
    if (typeof e?.date !== "string" || !xp) continue;
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + xp);
  }
  return [...byDate].filter(([, xp]) => xp > 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, xp]) => ({ date, xp }));
}

// 지금의 누적 경험치에 이른 날 — 경험치가 붙은 마지막 기록의 날짜(없으면 null).
// 상단바 '독서 TOP 3'에서 레벨 · 경험치가 같을 때 먼저 이른 학생을 앞에 둡니다.
export function xpReachedOn(events) {
  let last = null;
  for (const e of Array.isArray(events) ? events : []) {
    if (typeof e?.date !== "string" || !(Number(e.xp) > 0)) continue;
    if (!last || e.date > last) last = e.date;
  }
  return last;
}

// 상단바 '독서 TOP 3' 차례 — 레벨 → 누적 경험치 → 그 경험치에 먼저 이른 학생
// (날짜가 없으면 뒤) → 학번. 경험치가 0인 학생은 빼고 셋까지만.
export function topReaders(rows = [], n = 3) {
  const xpOf = (r) => Number(r.totalXp ?? r.allTimeXp) || 0;
  return rows.filter((r) => xpOf(r) > 0).sort((a, b) =>
    (Number(b.level) || 1) - (Number(a.level) || 1)
    || xpOf(b) - xpOf(a)
    || (a.xpReachedOn ? 0 : 1) - (b.xpReachedOn ? 0 : 1)
    || String(a.xpReachedOn || "").localeCompare(String(b.xpReachedOn || ""))
    || String(a.studentId || "").localeCompare(String(b.studentId || ""), "ko", { numeric: true })
    || String(a.uid || "").localeCompare(String(b.uid || ""))).slice(0, n);
}

// '독서 TOP 3'는 한 주 내내 같은 셋입니다(서울 시각 월요일 07:00에 바뀜 — lib/reading.js의
// readingTopWeek). 그 주가 시작한 월요일(week) **전날까지**의 기록으로 셉니다 — 반 집계
// (readingMembers)의 이 반 기록(events: { date, xp })에서 그 월요일과 그 뒤의 몫을 덜어 냅니다.
// 그래서 그 주에 처음 셈한 때가 월요일 아침이든 수요일이든 같은 셋이 나옵니다.
// 셈의 바탕은 집계의 xpDays(날마다의 경험치 — **모든 반 합**)입니다. 누적 경험치 · 레벨이 모든 반을
// 합친 값이라, 이번 주에 다른 반에서 얻은 몫도 함께 덜어야 맞습니다.
// xpDays가 생기기 전의 옛 집계는 누적(totalXp)에서 이 반 기록의 이번 주 몫만 덜어 냅니다 — 두 반에 든
// 학생이 이번 주에 다른 반에서 얻은 몫은 못 덜지만, 그 학생이 책을 한 번 저장하면 집계가 새로 적힙니다.
export function readingTopAsOf(snapshot, week) {
  const sum = (list) => list.reduce((total, e) => total + (Number(e.xp) || 0), 0);
  const dated = (list) => (Array.isArray(list) ? list : []).filter((e) => typeof e?.date === "string");
  if (Array.isArray(snapshot?.xpDays)) {
    const before = dated(snapshot.xpDays).filter((d) => d.date < week);
    const totalXp = Math.max(0, sum(before));
    return { totalXp, level: getReadingLevel(totalXp), xpReachedOn: xpReachedOn(before) };
  }
  const events = dated(snapshot?.events);
  const before = events.filter((e) => e.date < week);
  const total = typeof snapshot?.totalXp === "number" && Number.isFinite(snapshot.totalXp) ? snapshot.totalXp : sum(events);
  const totalXp = Math.max(0, total - sum(events.filter((e) => e.date >= week)));
  return { totalXp, level: getReadingLevel(totalXp), xpReachedOn: xpReachedOn(before) };
}

// 반 집계 한 장 → 리더보드 한 줄에 덧붙일 값. 옛 집계(이 칸들이 생기기 전)는 null로.
export function memberStats(snapshot, today) {
  const has = (k) => snapshot && Object.prototype.hasOwnProperty.call(snapshot, k);
  const num = (k) => (has(k) && typeof snapshot[k] === "number" && Number.isFinite(snapshot[k]) && snapshot[k] >= 0 ? snapshot[k] : null);
  const badges = has("badges") && Array.isArray(snapshot.badges) ? [...new Set(snapshot.badges.filter((id) => BADGE_IDS.has(id)))] : null;
  return {
    totalXp: num("totalXp"),
    badges,
    badgeCount: badges ? badges.length : null,
    totalPages: num("totalPages"),
    completedBooks: num("completedBooks"),
    reviewCount: num("reviewCount"),
    longestStreak: num("longestStreak"),
    currentStreak: has("streakRun") ? currentStreakOf(snapshot.streakRun, snapshot.lastReadDate, today) : null,
    lastReadDate: has("lastReadDate") && typeof snapshot.lastReadDate === "string" ? snapshot.lastReadDate : null,
    fruitCount: num("fruitCount"),
    // 옛 집계(이 칸이 생기기 전)는 그 반의 기록 날짜로 셉니다.
    xpReachedOn: has("xpReachedOn") && typeof snapshot.xpReachedOn === "string" ? snapshot.xpReachedOn : xpReachedOn(snapshot?.events),
  };
}

// 순위에 서는 학생인가 — 리더보드 · 책나눔 '우리 반 랭킹' · 상단바 '독서 TOP 3'가 함께 씁니다(서버 · 데모 모두).
// 교사 · 관리자 계정과 **사용 중지된 학생**(전학 등 — users/{uid}.suspended)은 뺍니다(선생님 요청).
// 사용 중지된 학생은 로그인을 못 해 더 읽지 않는데 누적 경험치는 남아, 빼지 않으면 TOP 3에 계속 섰습니다.
// 빼는 것은 순위에 서는 자리뿐이고, 그 학생의 독서 기록 · 경험치 · 반 집계는 그대로 둡니다.
export function isRankedStudent(profile) {
  return !!profile && (profile.role || "student") === "student" && profile.suspended !== true;
}

// 순위 기간 — 리더보드 · 책나눔 '우리 반 랭킹' 표의 단추 넷(서버 readingPeriodBounds가 받는 값과 같음).
export const RANKING_PERIODS = ["daily", "weekly", "monthly", "all-time"];

// 순위 매기기 — 경험치가 많은 차례, 같으면 학번(숫자로) · uid 차례이고 같은 경험치는 공동 순위.
// 서버(lib/server/readingPolicy.js가 다시 내보냄)와 화면이 같은 셈을 씁니다.
export function sortReadingRankings(items) {
  const ordered = items.slice().sort((a, b) =>
    b.xp - a.xp || String(a.studentId || "").localeCompare(String(b.studentId || ""), "ko", { numeric: true }) || String(a.uid || "").localeCompare(String(b.uid || ""))
  );
  let lastXp;
  let rank = 0;
  return ordered.map((item, index) => {
    if (index === 0 || item.xp !== lastXp) rank = index + 1;
    lastXp = item.xp;
    return { ...item, rank };
  });
}

// 고른 기간의 순위 — 순위 한 번 받기에 줄마다 네 기간의 경험치(xpBy)가 함께 옵니다(서버 getReadingRankings).
// 기간 단추를 누르면 서버에 다시 묻지 않고 여기서 다시 세웁니다(선생님 요청 — 한때 단추마다 반 인원의 세 배쯤 읽음).
// xpBy가 없는 줄(옛 서버)은 받아 온 그 기간의 xp를 그대로 씁니다.
export function rankingsForPeriod(rows = [], period = "weekly") {
  return sortReadingRankings((Array.isArray(rows) ? rows : []).map((row) => {
    if (!row?.xpBy || typeof row.xpBy !== "object") return { ...row, xp: Number(row?.xp) || 0 };
    const xp = Number(row.xpBy[period]);
    return { ...row, xp: Number.isFinite(xp) && xp >= 0 ? xp : 0 };
  }));
}

// 트랙 순서 — 누적 경험치 → 최근에 읽은 학생 → 학번.
export function sortJourney(rows = []) {
  return rows.slice().sort((a, b) =>
    (Number(b.totalXp) || 0) - (Number(a.totalXp) || 0)
    || String(b.lastReadDate || "").localeCompare(String(a.lastReadDate || ""))
    || String(a.studentId || "").localeCompare(String(b.studentId || ""), "ko", { numeric: true }));
}

function agoPhrase(days) {
  if (days < 7) return "이번 주에";
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}
const dayGap = (a, b) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS));
// 받침이 있으면 '을', 없으면 '를'
function objectParticle(word) {
  const ch = String(word || "").trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "을(를)";
  return code % 28 ? "을" : "를";
}

// 나의 독서 여정 — deriveReading의 결과로 짓는 몇 문장(본인 화면에서만 씁니다).
export function journeyNarrative(summary, today) {
  const logs = summary?.logs ?? [];
  const books = summary?.books ?? [];
  if (!logs.length) return ["아직 독서 여정이 시작되지 않았어요. 내 서재에 첫 책을 등록하고 읽은 쪽을 기록해 보세요. 📚"];
  const first = logs[0];
  const firstBook = books.find((b) => b.id === first.bookId);
  const since = dayGap(first.date, today) + 1;
  const lines = [];
  const title = firstBook?.title ? `「${firstBook.title}」${objectParticle(firstBook.title)} 펼치며` : "첫 책을 펼치며";
  lines.push(`${agoPhrase(since - 1)} ${title} 독서 여정을 시작했어요.`);
  const pages = Number(summary.totalPages) || 0;
  lines.push(summary.totalBooks > 0
    ? `그로부터 ${since}일 동안 ${summary.totalBooks}권을 완독하며 모두 ${pages.toLocaleString("ko-KR")}쪽을 읽었어요.`
    : `${since}일 동안 ${pages.toLocaleString("ko-KR")}쪽을 읽으며 꾸준히 나아가고 있어요.`);
  const perDay = Math.round(pages / since);
  if (perDay >= 30) lines.push(`하루 평균 ${perDay}쪽, 놀라운 속도로 책의 바다를 항해하고 있어요.`);
  else if (perDay >= 10) lines.push(`하루 평균 ${perDay}쪽씩 차근차근 자라고 있어요.`);
  else if (perDay > 0) lines.push(`하루 평균 ${perDay}쪽, 천천히 그러나 확실하게 나아가고 있어요.`);
  if (summary.currentStreak >= 7) lines.push(`🔥 ${summary.currentStreak}일 연속 독서! 불타는 열정이 느껴져요.`);
  else if (summary.currentStreak >= 2) lines.push(`${summary.currentStreak}일 연속으로 책과 함께하고 있어요.`);
  if (summary.reviewCount > 0) lines.push(`감상문 ${summary.reviewCount}편으로 생각의 흔적도 남겼어요.`);
  if (summary.fruitCount > 0) lines.push(`선생님께 받은 과일 ${summary.fruitCount}개도 ${(Number(summary.fruitXp) || 0).toLocaleString("ko-KR")} 경험치가 되었어요. 🍊`);
  const level = Number(summary.level) || 1;
  lines.push(`지금까지 ${(Number(summary.xp) || 0).toLocaleString("ko-KR")} 경험치를 모아 ${level > 1 ? `${level - 1}번 레벨업하고 ` : ""}레벨 ${level}, '${journeyTitle(level)}'가 되었어요.`);
  const earned = summary.earnedBadges?.length || 0;
  if (earned) lines.push(`그 길에서 뱃지 ${earned}개를 모았어요.`);
  const reading = books.filter((b) => b.status === "reading" && b.pagesRead > 0 && !b.archived);
  if (reading.length === 1) lines.push(`지금은 「${reading[0].title}」${objectParticle(reading[0].title)} 읽고 있어요.`);
  else if (reading.length > 1) lines.push(`지금은 ${reading.length}권을 함께 읽고 있어요.`);
  return lines;
}

// 뱃지 툴팁 — 어떤 조건에서 받는지(리더보드의 뱃지 칸에 마우스를 올리면).
// 조건 숫자는 READING_BADGES의 threshold, 셈 방식은 deriveReading과 같아야 합니다.
export function badgeHint(badge) {
  if (!badge) return [];
  const n = badge.threshold;
  const how = {
    shelf: [`책을 등록하고 실제로 읽은 쪽을 기록한 책이 ${n}권이 되면 받아요.`, "책을 등록만 해서는 세지 않아요."],
    completion: [`전체 쪽수를 기록으로 모두 채운 책이 ${n}권이 되면 받아요.`, "마지막 쪽까지 기록하면 저절로 완독이 돼요."],
    streak: [`하루 ${STREAK_MIN_PAGES}쪽 이상 읽은 날이 ${n}일 연속되면 받아요.`, `${STREAK_MIN_PAGES}쪽이 안 된 날이 있으면 다시 1일부터 세요. 가장 길게 이어 간 기록으로 판정해요.`],
    review: [`서로 다른 책 ${n}권에 감상문을 쓰면 받아요.`, "한 책에 여러 번 고쳐 써도 한 권으로 세요."],
    pages: [`한 달(1일~말일) 동안 ${n}쪽을 읽으면 받아요.`, "가장 많이 읽은 달로 판정해서, 다음 달이 되어도 사라지지 않아요."],
    level: [`레벨 ${n}에 닿으면 받아요.`, "독서 · 감상문 · 뱃지 · 과일로 얻은 경험치가 모두 들어가요."],
  }[badge.series] ?? [badge.description];
  return [...how, `받으면 +${badge.expReward} EXP`];
}
