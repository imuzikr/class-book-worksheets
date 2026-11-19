// =============================================================
// 공지사항을 학생 화면에 크게 — 어떤 공지를 띄울지 고르는 셈 (화면은 components/ClassNoticeSpotlight.jsx)
// -------------------------------------------------------------
// 선생님이 책 광장 · 교실의 '공지사항'(또는 상단바 📢)으로 보낸 반 공지(classes/{c}/classNotices — 그 공지 그대로)를,
// 학생이 어느 공간에 있든(광장 · 교실 · 아지트 · 책꽂이 · 책방) 큰 글씨로 한 번 보여 줍니다(선생님 요청 · 2026년 11월).
//
//   · '여기까지 봤다'는 알림 벨과 같은 표시입니다(chatReads.rooms.notice — 그 공지의 서버 시각). 큰 글씨 공지를 '확인'하면
//     벨의 공지도 읽은 것이 되고, 벨에서 읽은 공지는 크게 다시 뜨지 않습니다(다른 기기에서도).
//   · **화면을 연 뒤에 온 공지는 기기 시계를 보지 않고 띄웁니다** — 처음 받은 목록에 없던 공지면 '방금 온 것'입니다.
//     시계가 틀린 학교 PC에서도 선생님이 보내는 순간 뜹니다('모두 이동'의 신호와 같은 생각 — lib/classroomMove.js).
//   · **화면을 열 때 이미 있던 공지는 한 시간 안의 것만**(NOTICE_SPOT_FRESH_MS — 기기 시계로) 띄웁니다. 수업에 늦게 들어온
//     학생은 그 수업의 공지를 보고, 어제 공지가 오늘 화면을 가리지는 않습니다. 시계가 뒤로 틀린 기기(공지가 '앞날'로 보임)도 띄웁니다.
//   · 여러 개면 새것부터 셋까지(NOTICE_SPOT_MAX) — 맨 위 하나를 크게, 나머지는 작게.
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

/** '확인'을 누른 뒤의 '여기까지 봤다' — 앞으로만 옮깁니다(더 옛 공지를 확인해도 이미 본 새 공지가 되살아나지 않게) */
export function noticeSeenAfter(seenMs, shown) {
  const seen = Number(seenMs) || 0;
  const latest = Math.max(0, ...(Array.isArray(shown) ? shown : []).map((n) => Number(n?.ms) || noticeMs(n)));
  return Math.max(seen, latest);
}
