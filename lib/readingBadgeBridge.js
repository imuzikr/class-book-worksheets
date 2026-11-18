// =============================================================
// 성장·뱃지 창의 자료 다리 — 책 봄(ReadingHub) → 떠 있는 동그라미(FloatingHub)
// -------------------------------------------------------------
// 책 봄 왼쪽에 서던 성장·뱃지 칸을 걷고, 동그라미의 '성장·뱃지' 행성이 메신저처럼 창으로 엽니다(선생님 요청 ·
// 2026년 11월). 뱃지 자료(서재에서 셈한 stats)는 책 봄이 이미 들고 있으므로 동그라미가 서버에 따로 묻지 않고
// 여기에 걸어 둔 것을 그대로 씁니다(읽기 0). 뱃지를 누르면 책 봄의 뱃지 상세 창이 뜹니다(onInspect — 대표 뱃지
// 고르기도 그 창 그대로).
//
// 걸리는 것은 늘 하나 — 지금 보이는 책 봄(학생 본인, 또는 교사가 명단에서 고른 학생)입니다. 책 봄이 닫히거나
// 교사가 다른 학생을 고르면 그 화면이 걷어 갑니다. 걷을 때는 **내가 건 것만** 걷습니다(token) — 학생을 바꿀 때
// 새 화면이 먼저 건 것을 옛 화면의 정리가 지우지 않게.
// Firebase를 안 가져와 tests/unit이 그대로 읽습니다.
// =============================================================

let current = null;
const listeners = new Set();

function emit() {
  for (const fn of [...listeners]) fn();
}

// entry — { token, state: "loading" | "ready" | "error", owner(교사가 본 학생 이름 — 본인이면 null), stats, onInspect(badgeId) }
export function publishReadingBadges(entry) {
  current = entry && typeof entry === "object" ? entry : null;
  emit();
}

export function withdrawReadingBadges(token) {
  if (!current || current.token !== token) return;
  current = null;
  emit();
}

// useSyncExternalStore에 그대로 넘기는 두 함수
export function subscribeReadingBadges(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function readingBadgesSnapshot() {
  return current;
}

// 창 머리의 둘째 줄 — '18개 중 9개를 모았어요' · 교사는 '김민준 · 18개 중 9개'
export function readingBadgeSummary(entry) {
  if (!entry) return "";
  const badges = Array.isArray(entry.stats?.badges) ? entry.stats.badges : [];
  const earned = badges.filter((b) => b?.earned).length;
  if (entry.state !== "ready" || !badges.length) {
    if (entry.state === "error") return entry.owner ? `${entry.owner} · 독서 기록을 불러오지 못했어요` : "독서 기록을 불러오지 못했어요";
    return entry.owner ? `${entry.owner} · 불러오는 중` : "불러오는 중";
  }
  return entry.owner ? `${entry.owner} · ${badges.length}개 중 ${earned}개` : `${badges.length}개 중 ${earned}개를 모았어요`;
}

// 창 열기 부탁 — 분석 리포트의 '성장·뱃지 모두 보기'(주소 ?area=reading&tab=growth)로 책 봄에 오면 그 창을 곧바로 엽니다.
// 책 봄이 부탁하고 책 봄의 동그라미가 가져갑니다. 동그라미가 아직 서기 전일 수 있어 잠깐(OPEN_WAIT_MS) 들고 있고,
// 그 뒤의 부탁은 버립니다(한참 뒤 엉뚱한 때에 창이 저절로 열리지 않게).
export const READING_BADGES_OPEN_WAIT_MS = 8000;
let openAskedAt = 0;
const openListeners = new Set();

export function requestReadingBadgesPanel(now = Date.now()) {
  openAskedAt = now;
  for (const fn of [...openListeners]) fn();
}
// 부탁이 있으면 참을 돌려주고 비웁니다(한 번만 엶)
export function takeReadingBadgesRequest(now = Date.now()) {
  const asked = openAskedAt > 0 && now - openAskedAt <= READING_BADGES_OPEN_WAIT_MS;
  openAskedAt = 0;
  return asked;
}
export function onReadingBadgesRequest(fn) {
  openListeners.add(fn);
  return () => openListeners.delete(fn);
}
