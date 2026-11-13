// =============================================================
// 모두 이동의 10초 알림 — 셈 (순수 함수 · 시험 tests/unit/classroomMove.test.mjs)
// -------------------------------------------------------------
// 선생님이 책 광장 · 교실의 '모두 교실로 · 모두 광장으로'를 누르면 **곧바로 옮기지 않습니다.** 반의 모든 화면 위쪽에
// 알림과 10초 카운트다운을 띄우고, 다 세면 학생 모두(다른 화면에 있던 학생도 책 광장 탭으로)와 선생님을 그 방으로
// 옮깁니다(선생님 요청). 한때는 책 광장 탭을 열어 둔 학생만 곧바로 옮겼습니다 — 다른 화면의 학생은 쓰던 글이
// 날아갈까 봐 그대로 두었는데, 미리 알리고 10초를 주면 하던 일을 마무리할 수 있습니다.
//
// 신호는 반 문서의 세 칸입니다(lib/data/classes.js의 moveClassroomAll · cancelClassroomMove — 한 번의 쓰기).
//   classroomMoveTo    어느 방으로("plaza" · "classroom"). 방이 아닌 값(null)은 **취소**
//   classroomMoveAt    보낸 때(선생님 기기의 시각 ms) — 늘 앞 신호보다 크게 적습니다. 새 신호인지는 이 값이 '지금까지
//                      본 것보다 큰가'로만 가립니다(기기 시계와 견주지 않음 — 시계가 틀린 기기에서 눌러도 듣게)
//   classroomMoveWait  옮기기 전에 셀 시간(초 — 10). 없거나 0이면 이 칸이 생기기 전의 화면이 보낸 신호라, 그때처럼
//                      책 광장 탭을 열어 둔 화면만 곧바로 옮깁니다(알림도, 다른 화면에서 데려오기도 없음)
//
// **화면마다 제 시계로 셉니다** — 신호가 그 화면에 닿은 때부터 wait초(선생님 화면은 누른 순간부터, 학생 화면은 그 값이
// 닿은 순간부터라 1초 안팎 어긋날 수 있습니다). 여기서 '때(tick)'는 모두 **그 기기 안에서의 차이**로만 쓰는
// Date.now()입니다 — 기기의 시각이 틀려 있어도 상관없습니다.
//
// 상태(반마다 하나 — lib/classroomMoveStore.js가 들고 있음):
//   seen      지금까지 본 '보낸 때' 가운데 가장 큰 값(처음 보기 전이면 undefined)
//   pending   세는 중 { to, at, wait, since, until } 또는 null
//   released  따를 신호 { to, at, live, pull, tick } 또는 null — 무대(ReadingPlaza)는 이것만 봅니다
//               live  이 화면이 지켜보는 동안 온 신호(무대가 기기 시계를 보지 않고 따름). false면 '화면을 열었을 때
//                     이미 있던 신호' — 한 시간 안 · 아직 안 따른 것만(lib/readingClassroom.js의 classroomMoveCall)
//               pull  다른 화면에 있던 사람도 책 광장 탭으로 데려옵니다(10초를 다 세고 제때 옮길 때만)
//               tick  이 화면이 그 신호를 내놓은 때
//   dropped   방금 취소된 카운트다운 { to, at, tick } 또는 null — 알림 띠가 '취소됐어요'를 잠깐 띄웁니다
//
// **언제 보낸 것인지 알 수 없는 신호는 세지 않습니다** — 화면을 열고 처음 본 값, 잠들었다 깬 기기에 밀려 온 값(stale).
// 그런 신호로 알림을 띄우면 어제 누른 '모두 교실로'가 오늘 노트북을 여는 순간 "선생님이 부르고 있어요"로 뜹니다.
// 그런 신호는 '이미 있던 신호'로만 둡니다(책 광장 탭을 열면 한 시간 안의 것만 따름 — 지금까지와 같음).
// =============================================================

// 선생님이 누른 뒤 옮기기까지(초) — 선생님 요청
export const CLASSROOM_MOVE_WAIT_S = 10;
// 자료에 적힌 값의 천장(초) — 모양이 틀린 값 · 지나치게 큰 값으로 알림이 한없이 떠 있지 않게
export const CLASSROOM_MOVE_WAIT_MAX_S = 60;
// 다 센 때보다 이만큼(ms) 넘게 늦게 옮기게 됐으면(잠든 기기 · 얼린 탭) 다른 화면에서 데려오지 않습니다 —
// 한참 뒤에 돌아온 학생의 화면이 알림도 없이 바뀌면 안 됩니다. 가려 둔 탭의 느린 타이머(1분에 한 번)는 제때로 칩니다.
export const CLASSROOM_MOVE_LATE_PULL_MS = 90 * 1000;
// '취소됐어요'를 띄워 두는 시간(ms)
export const CLASSROOM_MOVE_DROP_MS = 2600;
// 기기 시계가 이만큼(ms) 넘게 뒤로 갔으면 세던 것을 곧바로 끝냅니다(영영 기다리지 않게)
const CLOCK_BACK_MS = 2000;

const isRoom = (id) => id === "plaza" || id === "classroom";

export const CLASSROOM_MOVE_IDLE = Object.freeze({ seen: undefined, pending: null, released: null, dropped: null });

// 반 문서 → 신호 { to, at, wait } — 모양이 틀린 값은 비운 값으로 읽습니다(규칙은 값의 모양을 보지 않음)
export function classroomMoveSignal(classDoc) {
  const at = Number(classDoc?.classroomMoveAt);
  const wait = Number(classDoc?.classroomMoveWait);
  return {
    to: isRoom(classDoc?.classroomMoveTo) ? classDoc.classroomMoveTo : null,
    at: Number.isFinite(at) && at > 0 ? at : 0,
    wait: Number.isFinite(wait) && wait > 0 ? Math.min(CLASSROOM_MOVE_WAIT_MAX_S, wait) : 0,
  };
}

// 새로 본 신호를 상태에 먹입니다 — 바뀐 것이 없으면 **같은 객체**를 돌려줍니다(화면이 다시 그리지 않게).
//   tick   이 기기의 지금(Date.now()) · stale  잠들었다 깬 기기라 밀린 값일 수 있음(lib/classroomMoveStore.js가 가림)
export function classroomMoveFeed(state, signal, tick, { stale = false } = {}) {
  const s = state ?? CLASSROOM_MOVE_IDLE;
  const when = Number(signal?.at) > 0 ? Number(signal.at) : 0;
  const to = isRoom(signal?.to) ? signal.to : null;
  const wait = Number(signal?.wait) > 0 ? Math.min(CLASSROOM_MOVE_WAIT_MAX_S, Number(signal.wait)) : 0;
  const first = s.seen === undefined;
  // 새 신호가 아님 — 같은 값 · 옛 값 · 잠깐 비었다 돌아온 값
  if (!first && !(when > s.seen)) return s;
  if (first || stale) {
    // 언제 보낸 것인지 알 수 없는 신호 — 세지도, 데려오지도 않고 '이미 있던 신호'로 둡니다
    return {
      seen: when,
      pending: null,
      released: to && when > 0 ? { to, at: when, live: false, pull: false, tick } : first ? null : s.released,
      dropped: null,
    };
  }
  if (!to) {
    // 취소 — 세던 것을 걷습니다(이미 옮긴 뒤에 온 취소는 아무것도 되돌리지 않음)
    return { ...s, seen: when, pending: null, dropped: s.pending ? { to: s.pending.to, at: when, tick } : s.dropped };
  }
  if (wait > 0) {
    return { ...s, seen: when, pending: { to, at: when, wait, since: tick, until: tick + wait * 1000 }, dropped: null };
  }
  // 셀 시간이 없는 신호(이 칸이 생기기 전의 화면이 보낸 것) — 그때처럼 책 광장 탭의 화면만 곧바로
  return { ...s, seen: when, pending: null, dropped: null, released: { to, at: when, live: true, pull: false, tick } };
}

// 다 셌으면 내놓습니다 — 아직이면 **같은 객체**. 너무 늦게 내놓게 됐으면(잠든 기기) 데려오지 않고 '이미 있던 신호'로.
export function classroomMoveDue(state, tick) {
  const p = state?.pending;
  if (!p) return state;
  const back = tick < p.since - CLOCK_BACK_MS;
  if (!back && tick < p.until) return state;
  const late = !back && tick - p.until > CLASSROOM_MOVE_LATE_PULL_MS;
  return { ...state, pending: null, released: { to: p.to, at: p.at, live: !late, pull: !late, tick } };
}

// 무대에 넘길 신호 — 다 센 뒤에 내놓인 것(state.released). 다만 **반 문서를 막 받아 아직 상태에 먹이기 전**(같은 렌더 —
// 먹이는 것은 효과라 한 박자 늦음)이면 그 문서의 값을 '이미 있던 신호'로 돌려줍니다. 그 사이에 선 무대가 '신호 없음'을
// 기준으로 삼으면, 곧이어 오는 진짜 값(어제의 신호일 수도)을 지켜보는 동안 온 새 신호로 읽어 엉뚱한 방으로 옮깁니다.
export function classroomMoveShown(state, classDoc, tick = 0) {
  if (state && state.seen !== undefined) return state.released;
  const { to, at } = classroomMoveSignal(classDoc);
  return to && at > 0 ? { to, at, live: false, pull: false, tick } : null;
}

// 알림 띠에 적을 남은 시간(초) — 10 … 1(다 세면 0)
export function classroomMoveLeft(pending, tick) {
  if (!pending) return 0;
  return Math.max(0, Math.min(Math.ceil(pending.wait), Math.ceil((pending.until - tick) / 1000)));
}

// 알림 띠의 막대가 얼마나 남았나(0~1)
export function classroomMoveShare(pending, tick) {
  if (!pending || !(pending.until > pending.since)) return 0;
  return Math.max(0, Math.min(1, (pending.until - tick) / (pending.until - pending.since)));
}

// '취소됐어요'를 아직 띄울 때인가
export function classroomMoveDropShown(dropped, tick) {
  if (!dropped) return false;
  const age = tick - dropped.tick;
  return age >= -CLOCK_BACK_MS && age < CLASSROOM_MOVE_DROP_MS;
}

// 다른 화면에 있던 사람을 데려갈 주소 — 지금 주소가 책방이면 고른 학생(student)은 남기고, 활동 · 창을 여는 칸은 뺍니다.
export function classroomMoveUrl(pathname = "", search = "") {
  const params = new URLSearchParams(pathname === "/books" ? search : "");
  for (const key of ["activity", "view", "face", "open", "book"]) params.delete(key);
  params.set("area", "reading");
  params.set("tab", "plaza");
  return `/books?${params.toString()}`;
}
