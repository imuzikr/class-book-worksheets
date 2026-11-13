// =============================================================
// 책 광장의 실시간 — 함께 있는 친구들의 캐릭터 (셈만)
// -------------------------------------------------------------
// 광장 탭을 연 반 친구(와 선생님)의 캐릭터가 서로의 화면에서 함께 걷습니다(선생님 요청).
// 자료는 Firestore가 아니라 **Realtime Database**에 둡니다 — 자리는 초당 여러 번 바뀌는데 Firestore는
// 읽는 문서마다 세어, 25명이 한 차시 걸으면 수십만 건이 됩니다. Realtime Database는 연결 수와 내려받은
// 양으로 셉니다(READING_GROWTH.md '책 광장'의 '함께 있는 친구들').
//
//   plaza/{반}/who/{uid}  입장권 + 이름표 — **서버만 씁니다**(/api/reading/plaza의 enter가 반 구성원인지 본 뒤).
//                         이름 · 캐릭터 · 펫을 본인이 적게 하면 남의 이름표를 달 수 있어서입니다.
//                         { n 이름, r 1=선생님, c 캐릭터 시트 열쇠, p 펫의 종(깨어난 뒤), ps 펫 단계(0 없음 · 1 알), exp 만료(ms) }
//   plaza/{반}/pos/{uid}  내 자리 — 본인만 씁니다(규칙이 모양 · 범위 · 너무 잦은 쓰기를 막음 — database.rules.json).
//                         { x, y 지금 자리(그림 원본 px), w 걸어갈 길("x,y,x,y…"), m 0 섬 · 1 길을 따라 걷는 중 ·
//                           2 방향키로 걷는 중, f 바라보는 쪽(0 앞 · 1 오른쪽 · 2 뒤 · 3 왼쪽), a 1=글을 읽는 중,
//                           z 1=교실에 있음(없으면 광장), s 앉아 있는 자리 번호(0~29 — 교실에서 앉았을 때만),
//                           g 1=나감, t 서버 시각 }
//                         방(z)과 자리(s)는 '교실'(선생님 요청)과 함께 더한 칸입니다. 광장에 있을 때는 싣지 않으므로
//                         교실을 켜지 않은 반 · 규칙을 아직 새로 게시하지 않은 배포의 광장은 예전 그대로 돕니다.
//
// **걸음마다 올리지 않습니다.** 누른 곳으로 걸을 때는 '어디에서 어느 길로'를 한 번, 방향키로 걸을 때는
// 0.3초에 한 번 지금 자리를, 멈출 때 한 번 올립니다. 그 사이의 움직임은 받는 쪽이 같은 빠르기로 그립니다
// (plazaRemoteStep). 그래서 친구의 캐릭터는 0.3초쯤 늦게 따라옵니다.
//
// 이 파일은 셈만 합니다(서버 · 화면 · 데모 · 시험이 함께 씀). 통로는 lib/plazaLiveChannel.js(Realtime Database) ·
// lib/data/plazaLive.js(언제 잇고 놓나 · 데모), 무대는 components/reading/ReadingPlaza.jsx.
// =============================================================
import { CLASSROOM_SEATS, PLAZA_H, PLAZA_NEAR, PLAZA_ROOM, PLAZA_W, plazaClear, plazaPath, plazaWalkable } from "./readingPlazaMap.js";
import { PLAZA_FACINGS, PLAZA_WALK_SPEED, plazaFacing } from "./readingPlazaSprites.js";

// ── 때 ─────────────────────────────────────────────────────
// 입장권의 수명 — 그 안에는 다시 묻지 않습니다. 반에서 빠진 학생의 입장권은 선생님이 뺄 때 서버가 걷고
// (resetReadingRankings), 못 걷어도 이만큼 지나면 죽습니다.
export const PLAZA_LIVE_TTL_MS = 2 * 60 * 60 * 1000;
// 만료가 이만큼 남으면 새로 받습니다(광장을 오래 켜 둔 화면)
export const PLAZA_LIVE_RENEW_MS = 15 * 60 * 1000;
// 내 자리를 올리는 가장 짧은 간격 — 규칙의 천장(0.1초)보다 넉넉히 길게(와이파이가 몰아 보내도 안 걸리게)
export const PLAZA_LIVE_SEND_MS = 220;
// 방향키로 걷는 동안 지금 자리를 올리는 간격
export const PLAZA_LIVE_KEY_MS = 300;
// 아무것도 안 누른 채 이만큼 지나면 연결을 놓습니다(무료 요금제는 동시 연결 100개 — 켜 두고 자리를 뜬 화면이
// 자리를 차지하지 않게). 다시 누르면 곧바로 잇습니다.
export const PLAZA_LIVE_IDLE_MS = 10 * 60 * 1000;
// 교실에서 제자리에 앉아 있는 동안에는 이만큼까지 가만히 있어도 놓지 않습니다 — 앉아서 선생님의 출석 확인을 기다리는
// 학생이 10분 만에 선생님 화면에서 사라지지 않게(한 차시 남짓). 그보다 오래 켜 둔 채 자리를 뜬 화면은 놓습니다.
export const PLAZA_LIVE_SEATED_IDLE_MS = 60 * 60 * 1000;
// 탭이 가려진 채 이만큼 지나면 연결을 놓습니다
export const PLAZA_LIVE_HIDDEN_MS = 45 * 1000;

// ── 어디에 ─────────────────────────────────────────────────
// Realtime Database의 주소(환경변수 NEXT_PUBLIC_FIREBASE_DATABASE_URL — 화면과 서버가 같은 값을 씀).
// 비어 있거나 모양이 틀리면 ""(실시간을 쓰지 않음 — 광장은 지금까지처럼 내 캐릭터만).
const DATABASE_URL = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/;
export function plazaLiveDatabaseUrl(raw) {
  const url = String(raw ?? "").trim();
  return DATABASE_URL.test(url) ? url.replace(/\/$/, "") : "";
}

// ── 입장권(who) ──────────────────────────────────────────────
const SHEET_KEY = /^(zodiac|animal|fantasy)-(0[1-9]|10)$/;
const PET_KEY = /^[a-z]{2,12}$/;
const clampInt = (value, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));

/** 서버가 적을 입장권 — character는 { style, number }(lib/readingCharacterCatalog.js의 characterOf),
 *  pet은 { species(알이면 null), stage }(lib/readingPet.js의 rankingPet) 또는 null. */
export function plazaLiveWho({ name, teacher = false, character = null, pet = null, exp }) {
  const number = Number(character?.number);
  const sheet = `${character?.style}-${String(number).padStart(2, "0")}`;
  const who = {
    n: String(name || "이름 미설정").slice(0, 40),
    c: SHEET_KEY.test(sheet) ? sheet : "",
    ps: 0,
    exp: Math.round(Number(exp) || 0),
  };
  if (teacher) who.r = 1;
  if (pet) {
    const species = typeof pet.species === "string" && PET_KEY.test(pet.species) ? pet.species : "";
    // 알 단계의 종은 싣지 않습니다(비밀 — 선생님 결정). 깨어난 펫만 종과 단계를 싣습니다.
    who.p = species;
    who.ps = species ? clampInt(pet.stage, 2, 10) : 1;
  }
  return who;
}

/** 받은 입장권을 그릴 수 있는 모양으로 — 모양이 틀리거나 만료됐으면 null(now는 서버 시각 ms). */
export function readPlazaLiveWho(raw, now) {
  if (!raw || typeof raw !== "object") return null;
  const exp = Number(raw.exp);
  if (!(exp > now)) return null;
  const sheet = typeof raw.c === "string" ? raw.c.match(SHEET_KEY) : null;
  const stage = clampInt(raw.ps, 0, 10);
  const species = typeof raw.p === "string" && PET_KEY.test(raw.p) ? raw.p : null;
  return {
    name: String(raw.n || "이름 미설정").slice(0, 40),
    teacher: raw.r === 1,
    character: sheet ? { style: sheet[1], number: Number(sheet[2]) } : null,
    // 펫 — 없음(null) · 알({ species: null, stage: 1 }) · 깨어남({ species, stage 2~10 })
    pet: stage < 1 ? null : species && stage >= 2 ? { species, stage } : { species: null, stage: 1 },
    exp,
  };
}

// ── 자리(pos) ────────────────────────────────────────────────
// 길의 점 수 천장 — 광장의 길 찾기는 곧게 갈 수 있는 구간을 한 번에 이어 대개 1~4점입니다.
export const PLAZA_LIVE_PATH_MAX = 12;
const xOf = (v) => clampInt(v, 0, PLAZA_W);
const yOf = (v) => clampInt(v, 0, PLAZA_H);

/** 길(점들)을 "x,y,x,y…"로 — 규칙이 글자 하나로 모양을 볼 수 있게. */
export function plazaPathEncode(points) {
  const list = Array.isArray(points) ? points.slice(0, PLAZA_LIVE_PATH_MAX) : [];
  return list.map((p) => `${xOf(p?.x)},${yOf(p?.y)}`).join(",");
}
export function plazaPathDecode(text) {
  if (typeof text !== "string" || !text || text.length > 160 || !/^[0-9,]+$/.test(text)) return [];
  const nums = text.split(",").map(Number);
  const points = [];
  for (let i = 0; i + 1 < nums.length && points.length < PLAZA_LIVE_PATH_MAX; i += 2) {
    if (!Number.isFinite(nums[i]) || !Number.isFinite(nums[i + 1])) return [];
    points.push({ x: xOf(nums[i]), y: yOf(nums[i + 1]) });
  }
  return points;
}

// 자리 번호(교실의 책상 — 0~29). 아니면 null.
const seatOf = (v) => (Number.isInteger(v) && v >= 0 && v < CLASSROOM_SEATS.length ? v : null);

/** 내가 올릴 자리 — t(서버 시각)는 통로가 붙입니다. mode 0 섬 · 1 길을 따라 · 2 방향키.
 *  room "classroom"이면 교실(z: 1), seat가 있으면 그 책상에 앉아 있습니다(s — 교실에서만 · 앉으면 걷지 않음). */
export function plazaLivePos({ x, y, path = [], mode = 0, facing = "down", reading = false, room = "plaza", seat = null }) {
  const sitting = room === "classroom" ? seatOf(seat) : null;
  const m = sitting !== null ? 0 : mode === 1 || mode === 2 ? mode : 0;
  const pos = { x: xOf(x), y: yOf(y), m, f: Math.max(0, PLAZA_FACINGS.indexOf(facing)) };
  const w = m === 1 ? plazaPathEncode(path) : "";
  if (w) pos.w = w;
  else if (m === 1) pos.m = 0;      // 갈 길이 없으면 선 것
  if (reading) pos.a = 1;
  if (room === "classroom") pos.z = 1;
  if (sitting !== null) pos.s = sitting;
  return pos;
}
/** 연결이 끊길 때(나갈 때) 남기는 표시 — 같은 자리에 g: 1. */
export function plazaLiveGone(last) {
  return { x: xOf(last?.x), y: yOf(last?.y), m: 0, f: 0, g: 1 };
}

/** 받은 자리를 쓸 수 있는 모양으로 — 모양이 틀리면 null. gone이면 나간 사람입니다. */
export function readPlazaLivePos(raw) {
  if (!raw || typeof raw !== "object") return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > PLAZA_W || y > PLAZA_H) return null;
  const room = raw.z === 1 ? "classroom" : "plaza";
  const seat = room === "classroom" ? seatOf(raw.s) : null;
  const mode = seat !== null ? 0 : raw.m === 1 || raw.m === 2 ? raw.m : 0;
  const path = mode === 1 ? plazaPathDecode(raw.w) : [];
  return {
    x, y, path,
    mode: mode === 1 && !path.length ? 0 : mode,
    facing: PLAZA_FACINGS[clampInt(raw.f, 0, 3)] ?? "down",
    reading: raw.a === 1,
    room, seat,
    gone: raw.g === 1,
    t: Number.isFinite(Number(raw.t)) ? Number(raw.t) : 0,
  };
}

// ── 친구 캐릭터의 걸음 ───────────────────────────────────────
// 받은 소식대로 걷는 캐릭터 한 명 — { x, y, queue(앞으로 갈 점들), mode, facing, reading, stride(걸은 거리),
// heardAt(마지막 소식을 들은 때), rest(다 와서 바라볼 쪽), seat(앉아 있는 자리 번호 · 서 있으면 null) }.
// 무대가 프레임마다 plazaRemoteStep으로 움직입니다. 무대는 **나와 같은 방에 있는 친구만** 세웁니다(소식의 room) —
// 길을 찾는 셈은 그 방(room — lib/readingPlazaMap.js)을 받습니다.
export const REMOTE_SNAP = 420;       // 이보다 멀리 떨어졌으면 걸어가지 않고 곧바로 옮깁니다(오래 끊겼다 이어진 때)
export const REMOTE_LAG = 78;         // 방향키 걸음을 따라갈 때 두는 거리 — 올리는 간격(0.3초) 동안 걷는 거리
export const REMOTE_STALE_MS = 1300;  // 방향키 걸음 소식이 이만큼 끊기면 선 것으로 봅니다
const REMOTE_AGE_MAX = 120000;
const copy = (p) => ({ x: p.x, y: p.y });

/** 길(points — 첫 점이 출발)을 따라 distance만큼 간 자리 · 남은 길 · 마지막에 향하던 쪽. */
export function plazaAlong(points, distance) {
  let left = Math.max(0, Number(distance) || 0);
  let at = copy(points[0]);
  let heading = null;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - at.x;
    const dy = points[i].y - at.y;
    const seg = Math.hypot(dx, dy);
    if (seg > 0) heading = { dx, dy };
    if (left < seg) {
      const k = left / seg;
      return { x: at.x + dx * k, y: at.y + dy * k, rest: points.slice(i).map(copy), heading };
    }
    left -= seg;
    at = copy(points[i]);
  }
  return { x: at.x, y: at.y, rest: [], heading };
}

/** 처음 본 친구 — 소식이 ageMs 전의 것이면 그동안 걸었을 만큼 길을 따라가 있는 자리에 세웁니다
 *  (광장에 들어섰을 때 친구가 이미 다 걸어간 길을 처음부터 다시 걷지 않게). */
export function plazaRemoteEnter(state, ageMs = 0, nowMs = 0) {
  const age = Math.min(REMOTE_AGE_MAX, Math.max(0, Number(ageMs) || 0));
  const actor = {
    x: state.x, y: state.y, queue: [], mode: state.mode, facing: state.facing, reading: state.reading, seat: state.seat ?? null,
    // 소식이 오래된 것이면 그만큼 전에 들은 셈 — 방향키로 걷다 끊긴 친구가 제자리걸음으로 서 있지 않게
    stride: 0, heardAt: nowMs - age, rest: null, walking: false,
  };
  if (state.mode === 1 && state.path.length) {
    const along = plazaAlong([copy(state), ...state.path], PLAZA_WALK_SPEED * age / 1000);
    actor.x = along.x;
    actor.y = along.y;
    actor.queue = along.rest;
    if (along.heading) actor.facing = plazaFacing(null, along.heading.dx, along.heading.dy);
    if (!actor.queue.length) actor.mode = 0;
  }
  return actor;
}

// 지금 선 자리에서 소식의 자리까지 — 곧게 갈 수 있으면 곧게, 막혔으면 길을 찾아 돌아갑니다. 방향키로 분수 둘레를 도는
// 친구는 0.3초마다의 자리만 알려 오는데, 그 사이를 곧게 이으면 캐릭터가 분수 가장자리를 가로지르고 뒤따르는 펫이
// 거기에 걸립니다(펫은 바닥 밖으로 못 나감 — 실측).
function legTo(actor, state, room) {
  if (plazaClear(actor, state, room)) return [copy(state)];
  const route = plazaPath(actor, state, room);
  return route.length ? route.map(copy) : [copy(state)];
}

/** 새 소식 — 지금 선 자리에서 소식의 자리로 가고, 길이 있으면 이어서 그 길을 걷습니다.
 *  자리에 앉거나 일어선 소식이면 걸어가지 않고 곧바로 옮깁니다(의자는 걸어서 닿는 바닥이 아님). */
export function plazaRemoteHear(actor, state, nowMs = 0, room = PLAZA_ROOM) {
  const gap = Math.hypot(state.x - actor.x, state.y - actor.y);
  const seat = state.seat ?? null;
  if (gap > REMOTE_SNAP || seat !== null || (actor.seat ?? null) !== null) {
    actor.x = state.x;
    actor.y = state.y;
    actor.queue = [];
  } else {
    actor.queue = gap > 1 ? legTo(actor, state, room) : [];
  }
  actor.seat = seat;
  if (state.mode === 1) actor.queue.push(...state.path.map(copy));
  // 방향키를 누르고 있지만 막혀서 제자리인 친구(소식의 자리가 이미 선 자리)는 선 것으로 봅니다 — 제자리걸음하지 않고 누른 쪽을 봄
  const standing = state.mode === 0 || (state.mode === 2 && !actor.queue.length);
  actor.mode = standing ? 0 : state.mode;
  actor.reading = state.reading;
  actor.heardAt = nowMs;
  // 멈춘 소식이면 다 와서 그쪽을 봅니다(책꽂이를 열어 뒷모습을 보인 것까지 그대로)
  actor.rest = standing ? state.facing : null;
  if (standing && !actor.queue.length) { actor.facing = state.facing; actor.rest = null; }
  return actor;
}

/** 한 프레임 — 갈 점들을 차례로 걸어갑니다. 돌려주는 값 { moved(걸은 거리), walking(걷는 자세인가), busy(더 그릴 것이 남았나) }.
 *  방향키로 걷는 친구는 다음 소식을 기다리는 동안에도 걷는 자세를 둡니다(소식 사이마다 섰다 걷지 않게). */
export function plazaRemoteStep(actor, dt, nowMs = 0) {
  let moved = 0;
  let dx = 0;
  let dy = 0;
  if (actor.queue.length && dt > 0) {
    let rem = 0;
    let px = actor.x;
    let py = actor.y;
    for (const p of actor.queue) { rem += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
    // 빠르기 — 길을 따라 걷는 친구는 조금 빠르게(소식이 오는 사이 앞서간 만큼 따라잡게), 방향키로 걷는 친구는
    // 한 박자 뒤(REMOTE_LAG)를 지키게(바짝 붙으면 소식마다 섰다 걷고, 처지면 따라잡게).
    const pace = actor.mode === 1 ? 1.1 : Math.min(1.6, Math.max(actor.mode === 2 ? 0.8 : 1, rem / REMOTE_LAG));
    let step = PLAZA_WALK_SPEED * pace * dt;
    while (step > 0 && actor.queue.length) {
      const target = actor.queue[0];
      const tx = target.x - actor.x;
      const ty = target.y - actor.y;
      const d = Math.hypot(tx, ty);
      if (d <= step) {
        actor.x = target.x; actor.y = target.y;
        dx += tx; dy += ty; moved += d; step -= d;
        actor.queue.shift();
      } else {
        const k = step / d;
        actor.x += tx * k; actor.y += ty * k;
        dx += tx * k; dy += ty * k; moved += step; step = 0;
      }
    }
  }
  if (moved > 0.01) {
    actor.facing = plazaFacing(actor.facing, dx, dy);
    actor.stride += moved;
  }
  const waiting = actor.mode === 2 && nowMs - actor.heardAt < REMOTE_STALE_MS;
  const walking = actor.queue.length > 0 || moved > 0.01 || waiting;
  if (!walking) {
    actor.stride = 0;
    if (actor.rest) { actor.facing = actor.rest; actor.rest = null; }
  }
  actor.walking = walking;
  return { moved, walking, busy: actor.queue.length > 0 || waiting };
}

// ── 지금 광장에 있는 사람 ────────────────────────────────────
// 입장권(who)과 자리(pos)는 따로 옵니다(어느 쪽이 먼저 올지 모름). 둘이 다 있고 나가지 않은 사람만 무대에 세웁니다.
// 통로(Realtime Database · 데모)가 받은 것을 그대로 넣으면, 무대가 쓸 네 가지 소식으로 바꿔 줍니다 —
//   onJoin(uid, 입장권, 자리, 소식의 나이 ms) · onWho(uid, 입장권 — 펫이 자랐을 때 등) · onMove(uid, 자리) · onLeave(uid)
// now는 서버 시각(ms). 내 것(selfUid)은 흘려보냅니다.
export function plazaRoster(selfUid, { onJoin, onWho, onMove, onLeave } = {}) {
  const tickets = new Map();
  const places = new Map();
  const here = new Set();
  const settle = (uid, now, moved) => {
    const who = tickets.get(uid);
    const pos = places.get(uid);
    const present = !!who && !!pos && !pos.gone;
    if (present && !here.has(uid)) {
      here.add(uid);
      onJoin?.(uid, who, pos, pos.t ? Math.max(0, now - pos.t) : 0);
    } else if (present && moved) onMove?.(uid, pos);
    else if (!present && here.has(uid)) {
      here.delete(uid);
      onLeave?.(uid);
    }
  };
  return {
    who(uid, raw, now) {
      if (!uid || uid === selfUid) return;
      const who = readPlazaLiveWho(raw, now);
      if (who) tickets.set(uid, who); else tickets.delete(uid);
      const was = here.has(uid);
      settle(uid, now, false);
      if (was && who && here.has(uid)) onWho?.(uid, who);
    },
    whoGone(uid, now) { if (tickets.delete(uid)) settle(uid, now, false); },
    pos(uid, raw, now) {
      if (!uid || uid === selfUid) return;
      const pos = readPlazaLivePos(raw);
      if (pos) places.set(uid, pos); else places.delete(uid);
      settle(uid, now, true);
    },
    posGone(uid, now) { if (places.delete(uid)) settle(uid, now, false); },
    // 만료된 입장권을 걷습니다 — 새로 받지 못한 채(와이파이가 끊긴 화면) 시간이 다 된 사람
    sweep(now) {
      for (const [uid, who] of [...tickets]) if (!(who.exp > now)) { tickets.delete(uid); settle(uid, now, false); }
    },
    // 연결을 놓을 때 — 무대의 친구를 모두 내립니다
    clear() {
      const gone = [...here];
      here.clear(); tickets.clear(); places.clear();
      gone.forEach((uid) => onLeave?.(uid));
    },
    get size() { return here.size; },
  };
}

// ── 처음 서는 자리 ───────────────────────────────────────────
// 모두가 같은 점(room.spawn)에 서면 스물몇 명이 한 덩이로 겹칩니다. 그 둘레(책꽂이와 분수 사이)에 흩어 세웁니다 —
// 사람마다 늘 같은 자리(uid로 정함)라 '내 자리'가 생깁니다. 여는 곳(책꽂이 · 가판대) 바로 앞은 피합니다
// (들어서자마자 '눌러서 열기'가 깜빡이지 않게).
function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function spawnOk(x, y, room) {
  // 발 둘레까지 바닥이어야(가장자리 · 분수에 붙어 서지 않게)
  for (const [ox, oy] of [[0, 0], [-26, 0], [26, 0], [0, -14], [0, 18]]) if (!plazaWalkable(x + ox, y + oy, room)) return false;
  return !room.spots.some((s) => Math.hypot(x - s.stand.x, y - s.stand.y) <= PLAZA_NEAR + 10);
}
// 흩어 설 띠는 방마다 다릅니다(room.spawnArea — 광장은 책꽂이와 분수 사이, 교실은 뒤쪽 가운데).
export function plazaSpawnFor(seed, room = PLAZA_ROOM) {
  const area = room.spawnArea;
  let h = hash32(String(seed ?? ""));
  for (let i = 0; i < 24; i += 1) {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
    const x = Math.round(area.cx + ((h & 0xffff) / 0xffff - 0.5) * 2 * area.halfW);
    const y = Math.round(area.top + ((h >>> 16) / 0xffff) * area.h);
    if (spawnOk(x, y, room)) return { x, y };
  }
  return { ...room.spawn };
}

// ── 서버의 정리 ──────────────────────────────────────────────
// 입장할 때마다 서버가 그 반의 자료를 한 번 훑어 죽은 것을 걷습니다 — 만료된 입장권과 그 자리, 입장권 없는 자리,
// 나간 지 오래된 자리. 돌려주는 값은 plaza/{반} 아래 한 번에 지울 길들({ "who/uid": null, … }).
export const PLAZA_LIVE_GONE_KEEP_MS = 10 * 60 * 1000;
const SAFE_KEY = /^[A-Za-z0-9_-]{1,128}$/;
export function plazaLivePrune(tree, now) {
  const who = tree && typeof tree.who === "object" && tree.who ? tree.who : {};
  const pos = tree && typeof tree.pos === "object" && tree.pos ? tree.pos : {};
  const updates = {};
  for (const [uid, ticket] of Object.entries(who)) {
    if (!SAFE_KEY.test(uid)) continue;
    if (!(Number(ticket?.exp) > now)) updates[`who/${uid}`] = null;
  }
  for (const [uid, place] of Object.entries(pos)) {
    if (!SAFE_KEY.test(uid)) continue;
    const alive = who[uid] && updates[`who/${uid}`] !== null;
    const longGone = place?.g === 1 && now - (Number(place?.t) || 0) > PLAZA_LIVE_GONE_KEEP_MS;
    if (!alive || longGone) updates[`pos/${uid}`] = null;
  }
  return updates;
}
