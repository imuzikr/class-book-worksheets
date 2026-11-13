// =============================================================
// 교실(책 광장의 둘째 방)의 셈 — 내 자리 · 러그 위인가 · 자판(A · S · C) · 출석 확인
// -------------------------------------------------------------
// 선생님 요청으로 만든 방입니다. 책 광장의 포털로 들어와, 자리표('자리 배정하기')에 적힌 **제 책상의 러그**에 올라서면
// 책상 위에 물음표가 뜨고, A를 누르면 [앉기(S) · 취소(C)]를 고릅니다. 앉은 채 A를 누르면 [다시 서기(S) · 취소(C)].
// **러그가 곧 '내 자리의 범위'입니다**(선생님 요청 — 책상마다 동그란 러그를 깔아 어디까지가 그 자리인지 눈에 보이게 함).
// 선생님은 칠판 앞에서 A → [출석시작(S) · 출석종료(C)]. **출석시작을 누르는 그 순간 제자리에 앉아 있던 학생만**
// 출석이 됩니다(그때 접속해 있지 않거나 앉아 있지 않으면 출석이 아님 — 선생님 결정).
//
// 누가 출석 기록을 쓰나 — **앉아 있던 학생의 화면이 스스로** 씁니다(머리말의 '출석하기' 단추와 같은 기록 한 장 ·
// 규칙도 그대로 — 출석이 열려 있어야 쓸 수 있음). 선생님의 '출석시작'은 출석을 열면서 반 문서에 '확인한 때'
// (classroomCallAt)를 새로 적고(lib/data/classes.js의 callClassroomRoll), 학생 화면은 그 값이 **바뀌는 것을 본 순간**
// 앉아 있으면 출석을 남깁니다(아래 classroomRollCall). 그래서 출석시작 뒤에 앉은 학생 · 그 뒤에 들어온 학생은
// 출석이 되지 않고, 선생님이 출석시작을 한 번 더 누르면 그때 앉아 있는 학생이 더해집니다.
// **칠판에서 출석을 확인한 날에는 교실 밖(책방 머리말)의 '출석하기' 단추를 그리지 않습니다**(선생님 결정 — 그날은 앉아야만
// 출석). 그 판정(classroomRollToday)은 이 파일이 아니라 lib/reading.js에 있습니다 — 책방 첫 화면이 쓰는데, 이 파일은
// 광장 지도(readingPlazaMap)를 끌어옵니다.
// 자리 · 책상 · 칠판의 좌표는 lib/readingPlazaMap.js(교실 그림에서 잰 값)에 있습니다. 이 파일은 셈만 합니다.
// =============================================================
import { CLASSROOM_BOARD, CLASSROOM_COLS, CLASSROOM_RUG, CLASSROOM_RUG_REACH, CLASSROOM_SEATS, PLAZA_W, plazaRoomOf } from "./readingPlazaMap.js";
import { plazaSpawnFor } from "./readingPlazaLive.js";

// ── 자리표 ───────────────────────────────────────────────────
// 책상마다 앉을 학생(uid 또는 null) 30칸 — 저장된 자리표(classes/{반}/seatLayouts/default의 seats)를 그대로 따릅니다.
// 같은 학생이 두 번 적혀 있으면 앞의 자리만 칩니다(lib/seats.js의 normalizeSeats와 같은 규칙).
// **저장된 자리만** 봅니다 — 선생님 화면의 자리표는 아직 자리가 없는 학생을 빈자리에 채워 보여 주지만(명단이 있어야 하는 셈),
// 학생 화면에는 명단이 없어 같은 셈을 할 수 없습니다. 자리가 없는 학생은 선생님 화면에 따로 알립니다(classroomUnseated).
export function classroomDesks(seats) {
  const seen = new Set();
  return CLASSROOM_SEATS.map((_, i) => {
    const uid = Array.isArray(seats) && typeof seats[i] === "string" && seats[i] ? seats[i] : null;
    if (!uid || seen.has(uid)) return null;
    seen.add(uid);
    return uid;
  });
}
// 그 학생의 자리 번호(0~29). 없으면 null.
export function classroomSeatOf(desks, uid) {
  if (!uid || !Array.isArray(desks)) return null;
  const index = desks.indexOf(uid);
  return index >= 0 && index < CLASSROOM_SEATS.length ? index : null;
}
// 자리표에 아직 없는 학생들(명단의 차례 그대로) — 선생님 화면의 안내
export function classroomUnseated(desks, roster = []) {
  const seated = new Set((desks || []).filter(Boolean));
  return (roster || []).filter((s) => s?.uid && !seated.has(s.uid));
}
// 자리를 말로 — "2번째 줄 · 왼쪽에서 3번째"(칠판 쪽이 첫 줄)
export function classroomSeatLabel(index) {
  const seat = CLASSROOM_SEATS[index];
  return seat ? `${seat.row + 1}번째 줄 · 왼쪽에서 ${seat.col + 1}번째` : "";
}

// ── 어디에 서 있나 ───────────────────────────────────────────
// 그 자리의 러그 위인가 — 발이 러그(보이는 타원)에 닿았으면 그 자리에 온 것입니다(가장자리를 밟아도 되게 조금 넉넉히).
// 책상 줄은 걷는 바닥이 아니므로 실제로 서게 되는 곳은 **책상 양옆 복도로 나온 러그의 귀**(맨 뒷줄은 의자 뒤쪽도)입니다.
// 복도 한가운데는 어느 러그도 아닌 맨바닥이라, 옆 책상 · 앞뒤 줄의 자리와 헷갈리지 않습니다.
const RUG_RX = CLASSROOM_RUG.rx + CLASSROOM_RUG_REACH;
const RUG_RY = CLASSROOM_RUG.ry + CLASSROOM_RUG_REACH;
const onRug = (point, seat) => ((point.x - seat.rug.x) / RUG_RX) ** 2 + ((point.y - seat.rug.y) / RUG_RY) ** 2 <= 1;
export function classroomNearSeat(point, index) {
  const seat = CLASSROOM_SEATS[index];
  return !!seat && !!point && onRug(point, seat);
}
// 지금 밟고 있는 러그의 자리 번호 — 남의 러그 위에서 A를 눌렀을 때 알려 주려고. 러그 위가 아니면 null.
// (러그끼리 겹치지 않아 하나뿐이지만, 여유 때문에 둘에 걸치면 가까운 쪽입니다.)
export function classroomSeatAround(point) {
  if (!point) return null;
  let best = null;
  let bestD = Infinity;
  for (const seat of CLASSROOM_SEATS) {
    if (!onRug(point, seat)) continue;
    const d = Math.hypot(point.x - seat.rug.x, point.y - seat.rug.y);
    if (d < bestD) { bestD = d; best = seat.index; }
  }
  return best;
}
// 그 점이 어느 책상(과 의자) 위인가 — 눌렀을 때. 책상·의자 그림의 상자 안이면 그 자리, 없으면 null.
// (러그의 귀는 걷는 바닥이라 눌러도 '책상을 누른 것'이 아닙니다 — 그리로 걸어가 올라섭니다.)
export function classroomSeatAt(x, y) {
  const seat = CLASSROOM_SEATS.find((s) => x >= s.box[0] && x <= s.box[2] && y >= s.box[1] && y <= s.box[3]);
  return seat ? seat.index : null;
}
// 그 자리의 어느 쪽 귀로 다가갈까 — from(지금 선 곳 · 펫이 있는 곳)에서 가까운 쪽 { side, stand, pet }.
// 책상이 한 줄씩이라 양쪽 복도 어디서든 다가옵니다. from을 모르면 오른쪽.
export function classroomSeatSide(index, from = null) {
  const seat = CLASSROOM_SEATS[index];
  if (!seat) return null;
  const [left, right] = seat.sides;
  if (!from || !Number.isFinite(from.x) || !Number.isFinite(from.y)) return right;
  const toLeft = Math.hypot(from.x - left.stand.x, from.y - left.stand.y);
  const toRight = Math.hypot(from.x - right.stand.x, from.y - right.stand.y);
  return toLeft < toRight ? left : right;
}
// 칠판 앞인가(선생님) — 칠판 아래 벽과 첫 줄 책상 사이, 복도의 맨 위
export function classroomAtBoard(point) {
  return !!point && point.y <= CLASSROOM_BOARD.y && point.x >= CLASSROOM_BOARD.x0 && point.x <= CLASSROOM_BOARD.x1;
}
// 그 점이 칠판 위인가 — 눌렀을 때
export function classroomBoardAt(x, y) {
  const [x0, y0, x1, y1] = CLASSROOM_BOARD.rect;
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}
// 칠판 앞에 설 자리 — 누른 곳(x) 바로 아래
export function classroomBoardStand(x) {
  const [x0, , x1] = CLASSROOM_BOARD.rect;
  return { x: Math.min(x1 - 20, Math.max(x0 + 20, Number(x) || 0)), y: CLASSROOM_BOARD.standY };
}
// 칠판의 물음표가 뜰 자리 — 선생님이 선 곳 위(칠판 가로 안에서). 60px마다 옮겨 걸음마다 다시 그리지 않습니다.
export function classroomBoardMark(point) {
  const [x0, , x1] = CLASSROOM_BOARD.rect;
  const x = Math.round((Number(point?.x) || 0) / 60) * 60;
  return { x: Math.min(x1 - 50, Math.max(x0 + 50, x)), y: CLASSROOM_BOARD.markY };
}

// ── 지금 A를 누르면 ──────────────────────────────────────────
// 돌려주는 값 — 무엇을 물을지("sit" 앉기 · "stand" 다시 서기 · "board" 출석) 또는 왜 안 되는지("noseat" 자리표에 없음 ·
// "other" 남의 러그 위(seat에 내 자리 번호 · at에 그 러그의 자리 번호) · "far" 내 러그 · 칠판에서 멂). 교실에서만 부릅니다.
export function classroomAct({ teacher = false, point, seat = null, sitting = null } = {}) {
  if (teacher) return classroomAtBoard(point) ? { kind: "board" } : { kind: "far" };
  if (sitting !== null) return { kind: "stand", seat: sitting };
  if (seat === null) return { kind: "noseat" };
  if (classroomNearSeat(point, seat)) return { kind: "sit", seat };
  const around = classroomSeatAround(point);
  return around !== null ? { kind: "other", seat, at: around } : { kind: "far", seat };
}

// ── 자판 ─────────────────────────────────────────────────────
// 광장 · 교실의 글자 키 — A(행동) · S(고르기) · C(취소). 한글 입력 상태에서는 key가 'ㅁ' · 'ㄴ' · 'ㅊ'이거나
// 'Process'로 오므로 자리(code)도 봅니다. 영문 글자가 그대로 오면 그것을 먼저 씁니다(자판 배열이 다른 기기).
const BY_CODE = { KeyA: "a", KeyS: "s", KeyC: "c" };
const BY_HANGUL = { "ㅁ": "a", "ㄴ": "s", "ㅊ": "c" };
export function plazaLetterKey(event) {
  const key = typeof event?.key === "string" ? event.key : "";
  if (key.length === 1) {
    const low = key.toLowerCase();
    if (low === "a" || low === "s" || low === "c") return low;
    if (BY_HANGUL[key]) return BY_HANGUL[key];
    // 다른 영문 글자 · 숫자는 그 글자입니다(자리로 넘겨짚지 않음)
    if (/[a-z0-9]/.test(low)) return null;
  }
  return BY_CODE[event?.code] ?? null;
}
const ARROWS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
// 걷는 키 — 방향키만(선생님 결정 — A · S · C가 행동 키가 되어 W · A · S · D로는 걷지 않습니다)
export function plazaArrowKey(event) {
  return ARROWS[event?.key] ?? null;
}

// ── 출석 확인 ────────────────────────────────────────────────
// 학생 화면 — 선생님의 '출석 확인'(반 문서의 classroomCallAt)을 본 순간 출석을 남겨야 하는가.
//   prev   지금까지 보던 값(화면을 열고 처음 보는 것이면 undefined — 그 값은 기준일 뿐, 출석이 아님:
//          출석시작 뒤에 들어온 학생은 '그때 접속하지 않은' 학생입니다)
//   call   새로 본 값 · openToday 오늘 출석이 열려 있나 · seated 지금 제자리에 앉아 있나 · attended 이미 출석했나
export function classroomRollCall({ prev, call, openToday = false, seated = false, attended = false } = {}) {
  if (prev === undefined) return false;
  const now = Number(call) || 0;
  if (!(now > 0) || now === (Number(prev) || 0)) return false;
  return !!openToday && !!seated && !attended;
}
// 선생님 화면 — 오늘 출석한 수 / 명단의 수(명단에 있는 학생만 셉니다 — 반에서 빠진 학생의 기록이 섞이지 않게)
export function classroomAttendance(roster = [], presentUids = null) {
  const total = (roster || []).length;
  if (!presentUids) return { present: 0, total };
  let present = 0;
  for (const s of roster || []) if (s?.uid && presentUids.has(s.uid)) present += 1;
  return { present, total };
}

// ── 모두 이동 — 선생님의 '모두 교실로 · 모두 광장으로' ─────────
// 선생님 요청. 선생님 화면의 맵 위 왼쪽 단추가 반 문서에 '어느 방으로(classroomMoveTo) · 보낸 때(classroomMoveAt)'를
// 한 번의 쓰기로 적고(lib/data/classes.js의 moveClassroomAll), **책 광장 탭을 열어 둔 화면들이 그 값을 보고 스스로 그 방으로
// 옮깁니다** — 출석 확인(classroomCallAt)과 같은 길이라 Realtime Database가 없어도 되고, 규칙도 새로 열지 않습니다.
// 선생님 자신의 화면도 같은 신호를 따라 옮깁니다(쓰기에 실패하면 아무도 안 움직임).
//   · **보는 동안 새 신호가 오면 곧바로 따릅니다 — 시계를 보지 않습니다.** '보낸 때'는 선생님 기기의 시각이라, 선생님이나
//     학생의 기기 시계가 틀려 있어도 단추가 듣게 하려는 것입니다. 새 신호인지는 '지금까지 본 어느 신호보다 큰가'로 가립니다
//     (보낸 때는 늘 앞 신호보다 크게 적습니다 — moveClassroomAll). 값이 잠깐 비었다 돌아오는 것은 새 신호가 아닙니다.
//     이미 그 방에 있으면 그대로입니다(앉아 있던 학생도 앉은 채).
//   · 화면을 열었을 때 이미 있던 신호는 **한 시간 안의 것이고 이 기기가 아직 따르지 않았을 때만** 따릅니다 — 그 수업 중에
//     늦게 들어온 학생이 반이 모인 방에서 시작하게. 더 오래된 신호는 지난 수업의 것이라 '마지막에 있던 방'이 이깁니다.
//     (여기만 기기 시계를 봅니다 — 시계가 한 시간 넘게 틀린 기기는 마지막에 있던 방에서 시작할 뿐입니다.)
//   · 다른 화면(책방의 활동 · 책꽂이 탭 …)에 있는 학생은 옮기지 않습니다 — 쓰던 글이 날아갑니다. 광장 탭을 열면 위 규칙대로.
export const CLASSROOM_MOVE_LATE_MS = 60 * 60 * 1000;
const isRoom = (id) => id === "plaza" || id === "classroom";
// 이 신호를 따를 것인가 — 따를 방("plaza" · "classroom") 또는 null. 이미 그 방에 있는지는 부르는 쪽이 봅니다
// (따르기로 한 신호는 그 방에 있었어도 '따른 것'으로 적어 둬야 다음에 다시 묻지 않습니다).
//   prev  이 화면이 지금까지 본 '보낸 때' 가운데 가장 큰 값(화면을 열고 처음 보는 것이면 undefined)
//   to · at  새로 본 신호 · seen  이 기기가 마지막으로 따른 신호의 '보낸 때' · now  이 기기의 지금(ms) — 뒤의 둘은 처음 볼 때만 씀
export function classroomMoveCall({ prev, to, at, seen = 0, now = 0 } = {}) {
  const when = Number(at) || 0;
  if (!isRoom(to) || !(when > 0)) return null;
  // 보는 동안 — 지금까지 본 것보다 새 신호면 따릅니다
  if (prev !== undefined) return when > (Number(prev) || 0) ? to : null;
  // 화면을 열었을 때 이미 있던 신호
  if (when <= (Number(seen) || 0)) return null;
  return Math.abs((Number(now) || 0) - when) <= CLASSROOM_MOVE_LATE_MS ? to : null;
}
// 모두 이동으로 그 방에 설 자리 — 한 점(포털)에 모두 겹쳐 서지 않게 사람마다 다른 자리입니다.
//   교실 — 선생님은 칠판 앞 가운데(곧바로 A로 출석을 시작할 수 있게), 자리가 있는 학생은 **제 책상의 러그 귀**
//          (책상 위에 물음표가 떠 A · S로 곧바로 앉음), 자리가 없는 학생은 교실 뒤쪽에 흩어 섭니다.
//   광장 — 책꽂이와 분수 사이에 흩어 섭니다(처음 들어올 때와 같은 띠).
// 돌려주는 값 { x, y, facing }. seat는 그 학생의 자리 번호(없으면 null) · uid는 흩어 설 자리의 씨앗.
export function classroomMoveSpot({ to, teacher = false, seat = null, uid = "" } = {}) {
  const room = plazaRoomOf(to === "classroom" ? "classroom" : "plaza", true);
  if (to === "classroom") {
    if (teacher) return { ...classroomBoardStand(PLAZA_W / 2), facing: "down" };
    const side = Number.isInteger(seat) ? classroomSeatSide(seat) : null;
    // 책상 쪽을 보고 섭니다(오른쪽 귀에 서면 왼쪽을 봄)
    if (side) return { x: side.stand.x, y: side.stand.y, facing: side.side === -1 ? "right" : "left" };
  }
  return { ...plazaSpawnFor(uid, room), facing: "down" };
}

export const CLASSROOM_SEAT_COUNT = CLASSROOM_SEATS.length;
export const CLASSROOM_SEAT_COLS = CLASSROOM_COLS;
