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
  };
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
  };
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
