// =============================================================
// 책 광장의 대화 — 셈만 (선생님 요청 · READING_GROWTH.md의 '광장 대화')
// -------------------------------------------------------------
// 광장 · 교실에서 친구 캐릭터를 누르고 A → [대화 초대(S) · 취소(C)] → 상대 화면에 '○○님이 대화를 요청합니다'와
// [승인(S) · 취소(C)] → 승인하면 요청한 캐릭터가 상대 곁으로 걸어가 마주 서고, 두 사람 머리 위에 말풍선(내용 없음)이 뜨고,
// 화면 오른쪽에 대화창이 열립니다. 대화 중에 다른 친구를 초대하면 여럿(4명까지)이 함께 이야기합니다.
//
// 자료는 캐릭터 자리와 같은 Realtime Database입니다(말 한 마디마다 Firestore 쓰기를 쓰지 않게 — 무료 한도 하루 2만 건).
//   plazaAsk/{반}/{받는 사람}/{보낸 사람}  요청 { t 보낸 때, i 요청 번호, k?(초대한 대화) } — 보낸 사람이 씀. 받는 사람은 no(거절),
//                                          보낸 사람은 x(거둠)만 더하고, 승인은 서버가 ok(대화 번호)를 적습니다.
//   plazaTalk/{반}/{대화}                  { a 만든 때, m/{uid}: { n 이름, j 들어온 때, r? 선생님 } 지금 든 사람(서버가 넣고 본인이 뺌),
//                                          n/{uid}: 이름(든 적이 있는 모든 사람 — 서버만), l/{번호}: { u, x 글 | s "join"·"leave", t } 말,
//                                          e/{uid}: 마지막으로 말한 때(0.5초에 한 마디 — 규칙) }
//   plazaTalkBy/{반}/{uid}/{대화}          그 사람이 든 대화와 들어온 때 — 서버만 씀(선생님의 '광장 대화' 기록 · 내 대화 되찾기)
//   plaza/{반}/pos/{uid}의 k               지금 든 대화 번호 — 반 친구 화면이 머리 위 말풍선을 그립니다(내용 없음)
// 규칙은 database.rules.json, 서버(승인 · 기록 · 정리)는 lib/server/readingService.js의 plazaTalk*, 통로는 lib/plazaTalkChannel.js,
// 무대는 components/reading/ReadingPlaza.jsx · PlazaTalkPanel.jsx.
// 이 파일은 셈만 합니다(서버 · 화면 · 데모 · 시험이 함께 씀 — 시험 tests/unit/readingPlazaTalk.test.mjs).
// =============================================================
import { PLAZA_ROOM, plazaNearest, plazaPortalAt, plazaWalkable } from "./readingPlazaMap.js";
import { PLAZA_AVATAR_SEPARATION } from "./readingPlazaAvoidance.js";
import { plazaFacing } from "./readingPlazaSprites.js";
import { classroomSeatSide } from "./readingClassroom.js";

// ── 선생님과 정한 숫자 ───────────────────────────────────────
export const TALK_MAX = 4;                       // 한 대화에 든 사람의 천장(선생님 결정)
export const TALK_ASK_MS = 20 * 1000;            // 요청이 살아 있는 시간 — 그 안에 승인하지 않으면 저절로 닫힘
export const TALK_ASK_AGAIN_MS = 15 * 1000;      // 같은 친구에게 다시 요청하려면 앞 요청을 보낸 때에서 이만큼(선생님 결정)
export const TALK_TEXT_MAX = 200;                // 한 마디의 글자 수
export const TALK_SEND_GAP_MS = 500;             // 한 사람이 말하는 가장 짧은 사이(도배 막기 — 규칙이 막음)
export const TALK_STALE_MS = 30 * 60 * 1000;     // 이만큼 아무 말이 없던 대화는 다시 들어올 때 이어 가지 않고 나감
// 서버가 승인을 받아 줄 때 요청의 나이에 더 봐주는 시간(와이파이로 늦게 닿은 승인)
export const TALK_ASK_GRACE_MS = 3000;
// 요청한 캐릭터가 상대 곁에 설 거리(그림 원본 px) — 묶음의 규격이 90~120을 권하고(spec/INTEGRATION.md), 이름표 · 펫이
// 서로 겹치지 않는 값을 체험반에서 재어 정했습니다.
export const TALK_GAP = 104;
// 곁에 설 자리가 다른 사람과 이보다 가까우면 피합니다 — 캐릭터끼리 비켜 걷는 간격(lib/readingPlazaAvoidance.js의
// PLAZA_AVATAR_SEPARATION)보다 조금 넓게. 그보다 가까운 자리를 고르면 걷는 길이 그 사람을 비켜 곁이 아닌 곳에 멈춥니다.
const TALK_ROOM = PLAZA_AVATAR_SEPARATION + 6;

export const TALK_ID = /^[A-Za-z0-9_-]{6,40}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;

// ── 그림(선생님이 주신 도트 대화 묶음 — scripts/prepare-talk-art.mjs가 표시 크기의 두 배로 구움) ─────────
// w · h는 화면에 그리는 크기(px — 묶음 manifest.json의 display), size는 묶음 원본의 크기, anchor는 그림 안에서 발 · 머리에
// 닿는 점의 비율(말풍선은 아래 꼬리의 끝 — 묶음이 실제 픽셀로 잰 값). 창 틀 · 단추 바탕은 나인슬라이스(slice — 구운 그림의
// 자르는 선 px, border — 화면의 테두리 px).
const ART = "/reading-plaza/talk";
const marker = (id, w, h, size, ax, ay) => ({ from: `markers/${id}.png`, src: `${ART}/marker-${id}.webp`, w, h, size, anchor: { x: ax, y: ay } });
const frame = (id, size) => ({ from: `frames/${id}.png`, src: `${ART}/frame-${id}.webp`, size, slice: 32, border: 16 });
const button = (id) => ({ from: `buttons/${id}.png`, src: `${ART}/button-${id}.webp`, size: [279, 148], slice: 20, border: 10 });
const icon = (id, size) => ({ from: `icons/${id}.png`, src: `${ART}/icon-${id}.webp`, w: 24, h: 24, size });
export const TALK_ART = Object.freeze({
  ring: marker("selection-ring", 64, 36, [281, 158], 0.5, 0.5),
  ready: marker("action-ready", 34, 30, [241, 214], 0.497925, 0.976636),
  incoming: marker("request-incoming", 34, 30, [244, 214], 0.494308, 0.976636),
  waiting: marker("request-waiting", 34, 29, [252, 218], 0.496032, 0.972477),
  talking: marker("talking", 34, 30, [248, 217], 0.5, 0.976959),
  group: marker("group-talking", 34, 28, [274, 225], 0.368613, 0.977778),
  invite: marker("invite-person", 34, 30, [248, 217], 0.489919, 0.976959),
  unavailable: marker("unavailable", 34, 29, [256, 221], 0.496094, 0.977376),
  accepted: marker("accepted", 34, 34, [222, 224], 0.495495, 0.977679),
  declined: marker("declined", 34, 35, [215, 219], 0.5, 0.977169),
  expired: marker("expired", 34, 35, [223, 229], 0.504484, 0.982533),
  unread: marker("unread", 34, 31, [246, 224], 0.485772, 0.977679),
  frameMenu: frame("action-menu", [418, 270]),
  frameDialog: frame("request-dialog", [436, 347]),
  framePanel: frame("chat-panel", [428, 830]),
  primaryDefault: button("primary-default"),
  primaryHover: button("primary-hover"),
  primaryPressed: button("primary-pressed"),
  primaryDisabled: button("primary-disabled"),
  secondaryDefault: button("secondary-default"),
  secondaryHover: button("secondary-hover"),
  secondaryPressed: button("secondary-pressed"),
  secondaryDisabled: button("secondary-disabled"),
  iconChat: icon("chat", [216, 192]),
  iconInvite: icon("invite", [209, 160]),
  iconSend: icon("send", [208, 184]),
  iconLeave: icon("leave", [217, 208]),
  iconClose: icon("close", [153, 154]),
  iconMinimize: icon("minimize", [190, 62]),
  iconExpand: icon("expand", [198, 193]),
  iconParticipants: icon("participants", [221, 171]),
});
/** 표시 상자 — 그림의 비율 그대로(폭 w 기준, 세로가 더 긴 그림은 높이 h 기준). 닻이 (0,0)에 오게 할 left · top도 함께. */
export function talkArtBox(art) {
  const [sw, sh] = art.size;
  const tall = sh > sw;
  const w = tall ? Math.round(art.h * sw / sh) : art.w;
  const h = tall ? art.h : Math.round(art.w * sh / sw);
  const ax = art.anchor?.x ?? 0;
  const ay = art.anchor?.y ?? 0;
  return { w, h, left: -Math.round(w * ax), top: -Math.round(h * ay) };
}

// ── 번호 ─────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** 대화 · 요청 · 말의 번호(겹치지 않을 만큼 긴 무작위 글자 — 서버 · 화면 · 데모가 함께 씀) */
export function talkNewId(length = 20) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
export const talkIdOk = (value) => typeof value === "string" && TALK_ID.test(value);
export const talkUidOk = (value) => typeof value === "string" && UID.test(value);

// ── 요청 ─────────────────────────────────────────────────
// 요청 하나(plazaAsk/{반}/{받는 사람}/{보낸 사람})를 쓸 수 있는 모양으로. now는 서버 시각(ms).
//   state — "waiting" 대답을 기다림 · "accepted" 승인(talk = 대화 번호) · "declined" 거절 · "cancelled" 보낸 사람이 거둠 ·
//           "expired" 20초가 지남
export function readTalkAsk(raw, now) {
  if (!raw || typeof raw !== "object") return null;
  const t = Number(raw.t);
  if (!Number.isFinite(t) || t <= 0 || !talkIdOk(raw.i)) return null;
  const k = talkIdOk(raw.k) ? raw.k : null;
  const talk = talkIdOk(raw.ok) ? raw.ok : null;
  const state = talk ? "accepted" : raw.no === 1 ? "declined" : raw.x === 1 ? "cancelled" : now - t > TALK_ASK_MS ? "expired" : "waiting";
  return { t, i: raw.i, k, talk, state, left: state === "waiting" ? Math.max(0, TALK_ASK_MS - (now - t)) : 0 };
}
/** 나에게 온 요청 가운데 대답을 기다리는 것 — 먼저 온 것부터(승인창은 하나씩 띄움). map: { 보낸 사람 uid: 요청 } */
export function talkIncoming(map, now) {
  const out = [];
  for (const [from, raw] of Object.entries(map && typeof map === "object" ? map : {})) {
    if (!talkUidOk(from)) continue;
    const ask = readTalkAsk(raw, now);
    if (ask?.state === "waiting") out.push({ from, ...ask });
  }
  return out.sort((a, b) => a.t - b.t || a.from.localeCompare(b.from));
}
/** 같은 친구에게 다시 요청할 수 있을 때까지 남은 시간(ms) — 앞 요청을 보낸 때에서 15초(선생님 결정). 없으면 0. */
export function talkAskAgainIn(lastAt, now) {
  const t = Number(lastAt);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, TALK_ASK_AGAIN_MS - (now - t));
}
/** 서버가 승인을 받아 줄 요청인가 — 그 번호(i)의 요청이 아직 대답을 기다리는 중(늦게 닿은 승인이 끝난 요청으로 대화를 열지 않게) */
export function talkAskAcceptable(raw, askId, now) {
  const ask = readTalkAsk(raw, now - TALK_ASK_GRACE_MS);
  return !!ask && ask.i === askId && ask.state === "waiting";
}

// ── 이름 ─────────────────────────────────────────────────
/** 부르는 이름 — 선생님은 '선생님', 학생은 '○○님'(요청 창 · 안내 한 줄). */
export function talkCallName(name, teacher = false) {
  if (teacher) return "선생님";
  const plain = String(name || "").trim();
  return plain ? `${plain}님` : "친구";
}
/** 요청 창의 첫 줄 — 새 대화는 '대화를 요청합니다', 이미 이야기하는 무리로 부르는 것은 '대화에 초대합니다'. */
export function talkAskTitle(name, teacher = false, invite = false) {
  const who = talkCallName(name, teacher);
  // '○○님' · '선생님'은 받침이 있어 '이', 이름을 모를 때의 '친구'는 '가'
  const subject = who === "친구" ? "친구가" : `${who}이`;
  return `${subject} ${invite ? "대화에 초대합니다." : "대화를 요청합니다."}`;
}

// ── 고르는 상자(A) — 지금 이 친구에게 대화 초대를 할 수 있는가 ────────────────────
// friendTalk 그 친구가 든 대화(말풍선) · myTalk 내가 든 대화 · myCount 내 대화의 사람 수 · outgoing 대답을 기다리는 내 요청 ·
// againIn 이 친구에게 다시 요청할 수 있을 때까지(ms) · friendSeated는 상관없음(앉은 친구에게도 갈 수 있음)
// 돌려줌 { kind: "invite" } 또는 { kind, text }(대화 초대 단추를 끄고 그 까닭을 한 줄로)
export function talkChoice({ friendTalk = null, myTalk = null, myCount = 0, outgoing = null, againIn = 0 } = {}) {
  if (friendTalk && myTalk && friendTalk === myTalk) return { kind: "same", text: "이미 함께 이야기하고 있어요." };
  if (friendTalk) return { kind: "busy", text: "다른 친구와 이야기하고 있어요." };
  if (myTalk && myCount >= TALK_MAX) return { kind: "full", text: `대화는 ${TALK_MAX}명까지 함께할 수 있어요.` };
  if (outgoing) return { kind: "pending", text: "보낸 요청의 대답을 기다리고 있어요." };
  if (againIn > 0) return { kind: "again", text: `${Math.ceil(againIn / 1000)}초 뒤에 다시 초대할 수 있어요.` };
  return { kind: "invite" };
}

// ── 말 ───────────────────────────────────────────────────
/** 보낼 글 — 앞뒤 빈칸을 걷고(줄바꿈은 남김 · 빈 줄은 둘까지), 200자를 넘으면 까닭을 돌려줍니다. */
export function talkTextOf(raw) {
  const text = String(raw ?? "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { text: "", error: "" };
  if ([...text].length > TALK_TEXT_MAX) return { text, error: `한 마디는 ${TALK_TEXT_MAX}자까지 쓸 수 있어요.` };
  return { text, error: "" };
}
/** 받은 말 한 줄 — { id, uid, kind("say" · "join" · "leave"), text, t } · 모양이 틀리면 null */
export function readTalkLine(id, raw) {
  if (!raw || typeof raw !== "object" || !talkUidOk(raw.u)) return null;
  const t = Number(raw.t);
  if (!Number.isFinite(t) || t <= 0) return null;
  if (raw.s === "join" || raw.s === "leave") return { id: String(id), uid: raw.u, kind: raw.s, text: "", t };
  if (typeof raw.x !== "string" || !raw.x) return null;
  return { id: String(id), uid: raw.u, kind: "say", text: raw.x.slice(0, TALK_TEXT_MAX * 2), t };
}
/** 말들을 때 차례로(같은 때면 번호 차례) */
export function sortTalkLines(lines) {
  return [...lines].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
/** 대화에 든 사람 — m(지금 든 사람) · n(든 적이 있는 사람의 이름)으로 [{ uid, name, teacher, joinedAt }](들어온 차례) */
export function readTalkMembers(rawMembers, rawNames = null) {
  const names = rawNames && typeof rawNames === "object" ? rawNames : {};
  const out = [];
  for (const [uid, raw] of Object.entries(rawMembers && typeof rawMembers === "object" ? rawMembers : {})) {
    if (!talkUidOk(uid) || !raw || typeof raw !== "object") continue;
    out.push({ uid, name: String(raw.n || names[uid] || "친구").slice(0, 40), teacher: raw.r === 1, joinedAt: Number(raw.j) || 0 });
  }
  return out.sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));
}
/** 접은 대화창에 띄울 새 말 수 — 내가 마지막으로 본 때(seenAt) 뒤에 남이 한 말 */
export function talkUnread(lines, me, seenAt) {
  return lines.filter((l) => l.kind === "say" && l.uid !== me && l.t > (Number(seenAt) || 0)).length;
}
/** 오래 쉰 대화인가 — 마지막 말(없으면 들어온 때)이 30분 넘게 지났으면 다시 들어올 때 이어 가지 않습니다. */
export function talkStale(lastAt, now) {
  const t = Number(lastAt) || 0;
  return !(t > 0) || now - t > TALK_STALE_MS;
}

// ── 머리 위 말풍선 ──────────────────────────────────────────
/** 같은 방에 보이는 사람들({ uid, talk })의 말풍선 — 같은 대화 번호가 셋 이상 보이면 여럿이 이야기하는 말풍선.
 *  돌려줌 Map(uid → "talking" | "group"). 대화 번호는 내용이 없는 표시뿐이라 반 친구 누구에게나 보입니다. */
export function talkBubbles(people) {
  const count = new Map();
  for (const p of people) if (p && talkIdOk(p.talk)) count.set(p.talk, (count.get(p.talk) ?? 0) + 1);
  const out = new Map();
  for (const p of people) if (p && talkIdOk(p.talk)) out.set(p.uid, count.get(p.talk) >= 3 ? "group" : "talking");
  return out;
}

// ── 마주 설 자리 ─────────────────────────────────────────
// 승인되면 걸어가는 사람(mover — 새 대화는 요청한 사람, 이미 이야기하는 무리로의 초대는 초대받은 사람 · 선생님 결정)이
// 상대(target) 곁의 **걸을 수 있는 자리**에 가서 마주 봅니다. 상대는 옮기지 않습니다(돌아서기만).
//   · 먼저 상대의 왼쪽 · 오른쪽(가로로 나란히 — 걷는 그림의 옆모습이 가장 '마주 봄'으로 읽힘), 그다음 비스듬히 · 아래 · 위.
//     걸어오는 사람에게 가까운 쪽부터 고릅니다.
//   · 바닥 밖 · 포털 위 · 다른 사람과 46px 안은 피합니다(others — 같은 방에 선 사람들 · 무리의 다른 사람).
//   · 상대가 교실에서 앉아 있으면 그 책상의 러그 귀(걸어오는 쪽)로 갑니다 — 의자 둘레는 책상이 막고 있습니다.
// 돌려줌 { x, y, facing(걸어간 사람이 볼 쪽), back(상대가 돌아설 쪽 · 앉아 있으면 null) } — 설 곳이 없으면 가장 가까운 바닥.
export function plazaTalkSpot({ target, mover, room = PLAZA_ROOM, others = [], seat = null, gap = TALK_GAP } = {}) {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return null;
  if (Number.isInteger(seat)) {
    const side = classroomSeatSide(seat, mover);
    if (side) return { x: side.stand.x, y: side.stand.y, facing: side.stand.x <= target.x ? "right" : "left", back: null };
  }
  const near = (p) => others.some((o) => o && Math.hypot(o.x - p.x, o.y - p.y) < TALK_ROOM);
  const free = (p) => plazaWalkable(p.x, p.y, room) && !plazaPortalAt(p, room, 8) && !near(p);
  const offsets = [
    [-gap, 0], [gap, 0],
    [-gap * 0.82, gap * 0.42], [gap * 0.82, gap * 0.42], [-gap * 0.82, -gap * 0.42], [gap * 0.82, -gap * 0.42],
    [0, gap * 0.72], [0, -gap * 0.72],
    [-gap * 1.4, 0], [gap * 1.4, 0],
  ];
  const from = mover && Number.isFinite(mover.x) ? mover : target;
  const choices = offsets
    .map(([dx, dy], order) => ({ x: Math.round(target.x + dx), y: Math.round(target.y + dy), order, ring: Math.abs(dx) > gap * 1.2 ? 1 : 0 }))
    .filter(free)
    // 가까운 고리(곁) 먼저, 같은 고리에서는 가로로 나란한 자리 → 걸어오는 사람에게 가까운 자리
    .sort((a, b) => a.ring - b.ring || (b.order < 2) - (a.order < 2) || Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y));
  const spot = choices[0] ?? plazaNearest(Math.round(target.x + (from.x <= target.x ? -gap : gap)), Math.round(target.y), room);
  return {
    x: spot.x, y: spot.y,
    facing: plazaFacing(null, target.x - spot.x, target.y - spot.y),
    back: plazaFacing(null, spot.x - target.x, spot.y - target.y),
  };
}

// ── 선생님의 '광장 대화' 기록 ─────────────────────────────────
// 서버가 내려준 대화들({ id, at, names: { uid: 이름 }, lines: [{ u, x?, s?, t }] })을 한 학생의 기록으로 —
// 최근 대화가 위, 대화 안은 때 차례. 그 학생이 들어오기 전의 말도 함께 보입니다(선생님은 대화 전체를 봄).
export function plazaTalkHistory(talks, studentUid) {
  const rows = [];
  for (const talk of Array.isArray(talks) ? talks : []) {
    if (!talk || !talkIdOk(talk.id)) continue;
    const names = talk.names && typeof talk.names === "object" ? talk.names : {};
    const lines = sortTalkLines((Array.isArray(talk.lines) ? talk.lines : [])
      .map((raw, index) => readTalkLine(raw?.id ?? index, raw)).filter(Boolean))
      .map((line) => ({ ...line, name: String(names[line.uid] || "이름 없음"), mine: line.uid === studentUid }));
    const people = Object.keys(names).filter(talkUidOk);
    const at = Number(talk.at) || lines[0]?.t || 0;
    const last = lines.length ? lines[lines.length - 1].t : at;
    rows.push({ id: talk.id, at, last, people: people.map((uid) => ({ uid, name: String(names[uid] || "이름 없음") })), lines, says: lines.filter((l) => l.kind === "say").length });
  }
  return rows.sort((a, b) => b.last - a.last || (a.id < b.id ? -1 : 1));
}
