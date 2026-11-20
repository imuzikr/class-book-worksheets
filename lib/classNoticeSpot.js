// =============================================================
// 공지사항을 학생 화면 가운데에 글자만 잠시 — 어떤 공지를 띄울지 고르는 셈 (화면은 components/reading/ClassNoticeSpotlight.jsx)
// -------------------------------------------------------------
// 선생님이 떠 있는 동그라미의 '공지 보내기'로 보낸 반 공지(classes/{c}/classNotices — 그 공지 그대로)를,
// 학생이 어느 공간에 있든(광장 · 교실 · 아지트 · 책꽂이 · 책방) 화면 가운데에 큰 글자로 잠시 띄웠다가 거둡니다
// (선생님 요청 · 2026년 11월 — 배움나눔의 '해설 띄우기' 모양. 한때 '확인'을 눌러 닫는 큰 글씨 카드였습니다).
//
//   · '여기까지 봤다'는 알림 벨과 같은 표시입니다(chatReads.rooms.notice — 그 공지의 서버 시각). 벨에서 읽은 공지는 다시 뜨지
//     않습니다(다른 기기에서도). 띄운 공지는 이 기기에도 적어 두어 다시 띄우지 않고, 학생이 눌러서 먼저 닫은 공지만 벨에서도
//     읽은 것으로 적습니다 — 저절로 사라진 공지는 벨에 안 읽은 채 남아 놓친 학생이 다시 읽습니다.
//   · **화면을 연 뒤에 온 공지는 기기 시계를 보지 않고 띄웁니다** — 처음 받은 목록에 없던 공지면 '방금 온 것'입니다.
//     시계가 틀린 학교 PC에서도 선생님이 보내는 순간 뜹니다('모두 이동'의 신호와 같은 생각 — lib/classroomMove.js).
//   · **화면을 열 때 이미 있던 공지는 한 시간 안의 것만**(NOTICE_SPOT_FRESH_MS — 기기 시계로) 띄웁니다. 수업에 늦게 들어온
//     학생은 그 수업의 공지를 보고, 어제 공지가 오늘 화면을 가리지는 않습니다. 시계가 뒤로 틀린 기기(공지가 '앞날'로 보임)도 띄웁니다.
//   · 여러 개면 새것 셋까지(NOTICE_SPOT_MAX)를 **보낸 차례대로 하나씩**(nextNoticeFlash) — 한 공지는 글 길이에 따라
//     5 ~ 30초(noticeFlashMs) 머뭅니다.
// =============================================================

export const NOTICE_SPOT_FRESH_MS = 60 * 60 * 1000;
export const NOTICE_SPOT_MAX = 3;
// 벨 · 메신저와 같은 열쇠(chatReads.rooms의 칸 이름 — 방 열쇠 dm_ · grp_와 안 겹침)
export const NOTICE_SEEN_ROOM = "notice";

/** 공지의 서버 시각(ms) — 아직 서버가 답하지 않은 시각 · 알 수 없는 값은 0(띄울 판정에 쓰지 않음) */
export function noticeMs(notice) {
  const raw = notice?.sentAt;
  if (!raw) return 0;
  let ms = 0;
  if (typeof raw.toMillis === "function") ms = raw.toMillis();
  else if (typeof raw.toDate === "function") ms = raw.toDate().getTime();
  else if (raw instanceof Date) ms = raw.getTime();
  else if (typeof raw === "number") ms = raw;
  else if (typeof raw.seconds === "number") ms = raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
  // 범위 밖 값(1970년 이전 · 아주 큰 수)은 버립니다 — 날짜로 바꾸다 화면이 멈추지 않게
  return Number.isFinite(ms) && ms > 0 && ms < 8.64e15 ? ms : 0;
}

/**
 * 학생 화면에 크게 띄울 공지 — 새것부터(맨 앞이 가장 새것), 없으면 [].
 *   notices  반 공지(차례 상관없음)
 *   seenMs   여기까지 봤다(벨의 표시 · 이 기기에서 확인한 것 · 지금 화면에서 닫은 것 가운데 가장 늦은 것)
 *   baseIds  화면을 열고 처음 받은 공지의 id들 — 여기에 없으면 화면을 연 뒤에 온 공지(시계를 보지 않고 띄움)
 *   nowMs    기기 시계(처음부터 있던 공지의 '한 시간 안'에만 씀)
 */
export function pickNoticeSpot({ notices = [], seenMs = 0, baseIds = null, nowMs = Date.now(), freshMs = NOTICE_SPOT_FRESH_MS, max = NOTICE_SPOT_MAX } = {}) {
  const seen = Number(seenMs) || 0;
  const base = baseIds instanceof Set ? baseIds : new Set(baseIds || []);
  const picked = [];
  for (const notice of Array.isArray(notices) ? notices : []) {
    const text = typeof notice?.text === "string" ? notice.text.trim() : "";
    const ms = noticeMs(notice);
    if (!notice?.id || !text || !ms || ms <= seen) continue;
    const live = !base.has(notice.id);
    const fresh = nowMs - ms <= freshMs;
    if (!live && !fresh) continue;
    picked.push({ ...notice, text, ms });
  }
  picked.sort((a, b) => b.ms - a.ms);
  return picked.slice(0, Math.max(1, max));
}

/** 띄운 뒤의 '여기까지 봤다' — 앞으로만 옮깁니다(더 옛 공지를 띄워도 이미 본 새 공지가 되살아나지 않게) */
export function noticeSeenAfter(seenMs, shown) {
  const seen = Number(seenMs) || 0;
  const latest = Math.max(0, ...(Array.isArray(shown) ? shown : []).map((n) => Number(n?.ms) || noticeMs(n)));
  return Math.max(seen, latest);
}

// 글자만 띄운 공지가 머무는 시간 — 빈칸을 뺀 글자마다 0.15초에 3초를 더해, 짧아도 5초 · 길어도 30초
// (짧은 공지 '여러분 안녕하세요.'는 5초 · 60자쯤이면 12초 · 180자 넘으면 30초. 더 길면 학생은 알림 벨 · 메신저 '공지' 탭에서 다시 읽음)
export const NOTICE_FLASH_MIN_MS = 5000;
export const NOTICE_FLASH_MAX_MS = 30000;
const NOTICE_FLASH_BASE_MS = 3000;
const NOTICE_FLASH_PER_CHAR_MS = 150;

/** 공지 글을 화면 가운데에 띄워 둘 시간(ms) */
export function noticeFlashMs(text) {
  const chars = Array.from(String(text ?? "").replace(/\s+/g, "")).length;
  const ms = NOTICE_FLASH_BASE_MS + chars * NOTICE_FLASH_PER_CHAR_MS;
  return Math.min(NOTICE_FLASH_MAX_MS, Math.max(NOTICE_FLASH_MIN_MS, ms));
}

/** 다음에 띄울 공지 — 띄울 것들(pickNoticeSpot의 결과) 가운데 가장 먼저 보낸 것(선생님이 보낸 차례대로 읽히게), 없으면 null */
export function nextNoticeFlash(pending) {
  let first = null;
  for (const notice of Array.isArray(pending) ? pending : []) {
    const ms = Number(notice?.ms) || noticeMs(notice);
    if (!notice?.id || !ms) continue;
    if (!first || ms < first.ms) first = { ...notice, ms };
  }
  return first;
}
