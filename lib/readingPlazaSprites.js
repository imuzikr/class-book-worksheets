// =============================================================
// 책 광장의 걷는 그림 — 시트 규격 · 방향 · 그림 차례 · 펫 따라오기 (셈만)
// -------------------------------------------------------------
// 그림은 public/reading-plaza/sprites/{이름}.webp — 선생님이 주신 도트 그림 묶음(캐릭터 30 · 펫 10).
//   · 한 장이 288×288, 한 칸 96px, 3×3칸. 줄 = 방향(앞 down · 오른쪽 right · 뒤 up), 칸 = 정지 · 걷기 A · 걷기 B.
//   · 왼쪽은 오른쪽 줄을 좌우로 뒤집어 씁니다(그림을 따로 두지 않음).
//   · 칸 안에서 발이 닿는 점은 늘 (48, 88) — 360장 모두 같은 높이라 그림이 바뀌어도 자리가 튀지 않습니다.
// 캐릭터의 움직임 · 시점처럼, 방향과 그림 차례도 React 상태가 아니라 걸음 루프(requestAnimationFrame)가
// 이 셈으로 정해 DOM에 곧바로 적습니다(components/reading/ReadingPlaza.jsx · PlazaSprite.jsx).
// 이 파일은 무대만 씁니다 — 광장 탭을 열 때만 내려받습니다(lib/readingPlazaMap.js와 같은 묶음).
// =============================================================
import { PLAZA_BODY, plazaWalkable } from "./readingPlazaMap.js";

// ── 시트 규격 ────────────────────────────────────────────────
export const SPRITE_SHEET = 288;
export const SPRITE_CELL = 96;
export const SPRITE_FOOT = Object.freeze({ x: 48, y: 88 });
// 칸 안에서 몸의 키(px) — 캐릭터 · 펫 모두 이 높이에 맞춰 그려져 있습니다(칸 전체 96px이 키가 아님).
export const SPRITE_BODY = 72;
export const SPRITE_ROWS = Object.freeze({ down: 0, right: 1, up: 2 });
export const SPRITE_IDLE = 0;
// 걷는 동안의 차례 — 걷기 A → 정지 → 걷기 B → 정지(칸 번호)
export const WALK_SEQUENCE = Object.freeze([1, 0, 2, 0]);
export const PLAZA_FACINGS = Object.freeze(["down", "right", "up", "left"]);

// ── 광장에서의 크기(배경 그림 원본 px) ─────────────────────────
// 캐릭터의 키는 PLAZA_BODY(lib/readingPlazaMap.js — 시점의 셈과 함께 씀).
// 펫은 단계에 따라 크기가 다릅니다(선생님 결정 — 묶음의 펫 그림은 다 자란 모습 한 가지라, 크기로 성장을 보임).
export const PLAZA_PET_BODY = 46;
export const PLAZA_PET_SCALE_MIN = 0.62;
// 깨어나기 전의 알 — 종을 드러내지 않는 공통 알(components/reading/PetFigure.jsx)을 그대로 씁니다.
export const PLAZA_EGG_SIZE = 36;

// ── 걸음과 그림 ──────────────────────────────────────────────
// 걷는 빠르기(원본 px/초) — 마당을 가로지르는 데 5초쯤. 걷는 그림을 넣으며 330에서 낮췄습니다 — 캐릭터 키(88px)에
// 견줘 빠르면 발이 미끄러지듯 보여서, 그림 한 장을 넘기는 거리(WALK_STRIDE)와 함께 초당 8장쯤이 되게 맞췄습니다
// (실측 8.0장). 내 캐릭터와 친구들의 캐릭터(lib/readingPlazaLive.js)가 같은 값으로 걷습니다.
export const PLAZA_WALK_SPEED = 260;
// 그림 한 장을 넘기는 걸음 거리(원본 px). 시간으로 넘기면 걷는 빠르기와 어긋나 발이 미끄러져 보이므로
// **걸은 거리**로 넘깁니다(막혀서 제자리면 그림도 멈춤). 캐릭터는 초당 8장쯤 · 펫은 종종걸음.
export const WALK_STRIDE = 32;
export const PET_STRIDE = 22;
// 걷다가 방향을 가를 때 직전 방향 쪽으로 기울이는 정도 — 45도 근처에서 앞모습과 옆모습이 번갈아 깜빡이지 않게.
export const FACING_STICK = 1.3;

const STYLES = new Set(["zodiac", "animal", "fantasy"]);
const PET_SHEETS = new Set(["owl", "hedgehog", "chick", "otter", "fennec", "redpanda", "rabbit", "bear", "cat", "puppy"]);

// 캐릭터의 시트 — { style, number }(lib/readingCharacterCatalog.js의 characterOf가 주는 모양). 모르는 값이면 null.
export function plazaCharacterSheet(character) {
  const number = Number(character?.number);
  if (!STYLES.has(character?.style) || !Number.isInteger(number) || number < 1 || number > 10) return null;
  return `/reading-plaza/sprites/${character.style}-${String(number).padStart(2, "0")}.webp`;
}
// 깨어난 펫의 시트 — 종 열쇠(lib/readingPet.js의 PET_SPECIES_KEYS). 알(종 없음) · 모르는 종이면 null.
export function plazaPetSheet(species) {
  return PET_SHEETS.has(species) ? `/reading-plaza/sprites/pet-${species}.webp` : null;
}
export const PLAZA_PET_SHEET_KEYS = Object.freeze([...PET_SHEETS]);

// 펫의 크기 — 2단계(갓 깨어남)는 작게, 10단계에서 제 크기. 단계가 오를 때마다 같은 폭으로 자랍니다.
export function plazaPetScale(stage) {
  const s = Math.min(10, Math.max(2, Math.round(Number(stage) || 2)));
  return PLAZA_PET_SCALE_MIN + (s - 2) / 8 * (1 - PLAZA_PET_SCALE_MIN);
}

// 움직인 쪽(dx, dy)으로 바라볼 방향. 좌우로 더 많이 가면 옆모습, 아니면 앞 · 뒷모습.
// 직전 방향(prev)이 있으면 그쪽으로 기울여(FACING_STICK) 판정합니다 — 누른 곳으로 비스듬히 걸을 때 그림이 깜빡이지 않게.
// 안 움직였으면 직전 방향 그대로(처음이면 앞).
export function plazaFacing(prev, dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (!(ax > 1e-6) && !(ay > 1e-6)) return PLAZA_FACINGS.includes(prev) ? prev : "down";
  const wasSide = prev === "left" || prev === "right";
  const wasFront = prev === "down" || prev === "up";
  const side = wasSide ? ax * FACING_STICK >= ay : wasFront ? ax > ay * FACING_STICK : ax > ay;
  if (side) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

// 시트에서 그릴 칸 — { row, col, mirror }. 왼쪽은 오른쪽 줄을 뒤집습니다.
export function plazaSpriteCell(facing, frame = SPRITE_IDLE) {
  const mirror = facing === "left";
  const row = SPRITE_ROWS[mirror ? "right" : facing] ?? SPRITE_ROWS.down;
  const col = frame === 1 || frame === 2 ? frame : SPRITE_IDLE;
  return { row, col, mirror };
}

// 걸은 거리(원본 px) → 지금 보여 줄 칸(0 정지 · 1 걷기 A · 2 걷기 B). 걸음을 떼는 순간 걷기 A부터.
export function plazaWalkFrame(distance, stride = WALK_STRIDE) {
  const d = Math.max(0, Number(distance) || 0);
  return WALK_SEQUENCE[Math.floor(d / stride) % WALK_SEQUENCE.length];
}

// ── 펫 따라오기 ──────────────────────────────────────────────
// 걷는 동안 펫은 캐릭터가 **지나온 길**을 조금 뒤에서 따라옵니다(그래야 분수 같은 것을 가로지르지 않음).
// 멈추면 캐릭터 곁(옆자리)으로 와서 섭니다 — 바로 뒤에 서면 아래로 걸어 내려왔을 때 캐릭터에 가려 안 보입니다.
export const PET_GAP = 52;            // 걷는 동안 길을 따라 떨어지는 거리(원본 px) — 따라붙는 늦음(PET_EASE)까지 더해 실제로는 80px쯤 뒤
export const PET_TRAIL_KEEP = 140;    // 기억해 두는 길의 길이
export const PET_EASE = 0.1;          // 따라붙는 빠르기(초) — 작을수록 바짝
export const PET_MAX_SPEED = 430;     // 뒤처졌을 때 따라잡는 가장 빠른 걸음(원본 px/초)
export const PET_MIN_SPEED = 70;      // 거의 다 왔을 때도 이만큼은 걸어 제자리에 섬

// 지나온 길에 한 점을 더합니다(제자리면 안 더함). 길이는 keep까지만 기억합니다. 길은 [{ x, y, s(누적 거리) }].
export function plazaTrailPush(trail, point, keep = PET_TRAIL_KEEP) {
  const last = trail[trail.length - 1];
  if (!last) { trail.push({ x: point.x, y: point.y, s: 0 }); return trail; }
  const d = Math.hypot(point.x - last.x, point.y - last.y);
  if (d < 0.5) return trail;
  trail.push({ x: point.x, y: point.y, s: last.s + d });
  const head = trail[trail.length - 1].s;
  while (trail.length > 2 && trail[1].s < head - keep) trail.shift();
  return trail;
}
// 길의 맨 앞(캐릭터)에서 gap만큼 뒤의 자리. 길이 그보다 짧으면 가장 오래된 자리.
export function plazaTrailBehind(trail, gap = PET_GAP) {
  if (!trail.length) return null;
  const head = trail[trail.length - 1];
  const want = head.s - gap;
  for (let i = trail.length - 1; i > 0; i -= 1) {
    const a = trail[i - 1];
    const b = trail[i];
    if (a.s <= want) {
      const t = b.s > a.s ? (want - a.s) / (b.s - a.s) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return { x: trail[0].x, y: trail[0].y };
}
// 캐릭터가 화면 아래쪽(앞)으로 걸으면 뒤따르는 펫이 캐릭터 몸 뒤에 가려 안 보입니다(실측 — 키가 88px이라 바로 뒤는 몸에 덮임).
// 따라갈 자리(target)가 캐릭터의 위(뒤)이면서 좌우로 가까우면, 펫이 지금 있는 쪽 옆으로 비켜 세웁니다.
// 위로 갈수록(완전히 뒤일수록) 더 비켜서고, 옆 · 아래에서 따라올 때는 그대로입니다. 비켜 설 자리가 바닥 밖이면 그대로.
export const PET_PEEK = 44;           // 가려지지 않게 옆으로 비켜 서는 거리(원본 px)
export const PET_PEEK_RISE = 30;      // 이만큼 위(뒤)에 있으면 다 비켜 섬
export const PET_PEEK_BACK = 6;       // 비켜 설 때는 거의 옆에(따라붙는 늦음만큼 저절로 뒤처짐) — 더 뒤면 머리 옆에 떠 보이고 이름표와 겹칩니다(실측)
export function plazaPetPeek(target, character, pet) {
  const rise = character.y - target.y;
  if (!(rise > 0)) return target;
  const want = PET_PEEK * Math.min(1, rise / PET_PEEK_RISE);
  const dx = target.x - character.x;
  if (Math.abs(dx) >= want) return target;
  // 펫이 지금 있는 쪽으로(오가며 캐릭터 뒤를 가로지르지 않게). 딱 뒤에 있으면 길이 굽은 쪽, 그것도 없으면 오른쪽.
  const lean = pet ? pet.x - character.x : 0;
  const side = Math.abs(lean) > 2 ? Math.sign(lean) : dx < 0 ? -1 : 1;
  const x = character.x + side * want;
  // 딱 뒤일수록 앞으로 당겨 옵니다(옆으로 벗어나 있을수록 원래 자리 그대로 — 비스듬히 걸을 때 튀지 않게)
  const y = target.y + Math.max(0, rise - PET_PEEK_BACK) * (1 - Math.abs(dx) / want);
  return plazaWalkable(x, y) ? { x, y } : target;
}
// 멈춘 캐릭터 곁에 펫이 설 자리 — 지금 펫이 있는 쪽의 옆자리부터, 걸을 수 있는 첫 자리. 없으면 지금 자리 그대로.
export function plazaPetHeel(character, pet) {
  const side = pet && pet.x > character.x ? 1 : -1;
  const spots = [[side * 50, 8], [-side * 50, 8], [side * 50, -14], [-side * 50, -14], [0, 44], [0, -44]];
  for (const [dx, dy] of spots) {
    const x = character.x + dx;
    const y = character.y + dy;
    if (plazaWalkable(x, y)) return { x, y };
  }
  return pet ? { x: pet.x, y: pet.y } : { x: character.x, y: character.y };
}
// 펫의 한 걸음 — 갈 자리(target)로 다가갑니다. 멀면 빨리, 가까우면 천천히(따라붙는 느낌), 다 오면 그 자리에 섭니다.
// 바닥 밖으로는 안 나갑니다(막히면 가로만 · 세로만 차례로, 그래도 막히면 제자리).
export function plazaPetStep(pet, target, dt) {
  const dx = target.x - pet.x;
  const dy = target.y - pet.y;
  const dist = Math.hypot(dx, dy);
  if (!(dt > 0) || dist < 0.01) return { x: pet.x, y: pet.y };
  const eased = dist * (1 - Math.exp(-dt / PET_EASE));
  const step = Math.min(dist, Math.max(Math.min(eased, PET_MAX_SPEED * dt), PET_MIN_SPEED * dt));
  const sx = dx / dist * step;
  const sy = dy / dist * step;
  if (plazaWalkable(pet.x + sx, pet.y + sy)) return { x: pet.x + sx, y: pet.y + sy };
  if (sx && plazaWalkable(pet.x + sx, pet.y)) return { x: pet.x + sx, y: pet.y };
  if (sy && plazaWalkable(pet.x, pet.y + sy)) return { x: pet.x, y: pet.y + sy };
  return { x: pet.x, y: pet.y };
}

// ── 펫 한 마리의 걸음(상태 하나) ─────────────────────────────
// 무대가 캐릭터마다(내 캐릭터 · 함께 있는 친구들) 펫 상태를 하나씩 들고, 프레임마다 plazaPetFollow로 움직입니다 —
// { x, y, facing, stride(걸은 거리), trail(주인이 지나온 길), heel(멈췄을 때 설 곁자리), following, walking }.
// 펫이 이보다 멀리 떨어지면(어딘가에 걸림 · 주인이 멀리 옮겨짐) 곧바로 데려옵니다.
export const PET_LOST = 320;
// 곁자리는 주인에게서 50px 안팎(plazaPetHeel) — 이보다 멀면 옛 자리입니다
const PET_HEEL_REACH = 90;
export function plazaPetStart(owner, facing = "down") {
  const at = plazaPetHeel(owner, null);
  return { x: at.x, y: at.y, facing, stride: 0, trail: [], heel: null, following: false, walking: false };
}
/** 한 프레임. owner — 주인의 지금 자리와 바라보는 쪽 { x, y, facing }.
 *  active — 주인이 걷는 중인가 · moved — 이번 프레임에 주인이 걸은 거리 · from — 주인이 이번 프레임에 떠난 자리.
 *  자리 · 방향 · 걸은 거리는 pet에 적고, { walking(펫이 이번에 걸었나), busy(더 그릴 것이 남았나) }를 돌려줍니다. */
export function plazaPetFollow(pet, owner, dt, { active = false, moved = 0, from = owner } = {}) {
  if (active && !pet.following) {
    // 다시 걷기 시작 — 펫이 선 자리에서 주인 자리까지를 '지나온 길'의 첫머리로 둡니다(펫이 뒷걸음질하지 않게)
    pet.trail = [];
    plazaTrailPush(pet.trail, pet);
    plazaTrailPush(pet.trail, from);
    pet.heel = null;
  }
  pet.following = active;
  if (moved > 0.01) plazaTrailPush(pet.trail, owner);
  // 잡아 둔 곁자리가 주인에게서 멀어졌으면(서 있던 친구가 멀리 옮겨짐 — 오래 끊겼다 이어진 때) 다시 잡습니다
  if (pet.heel && Math.hypot(pet.heel.x - owner.x, pet.heel.y - owner.y) > PET_HEEL_REACH) pet.heel = null;
  const was = { x: pet.x, y: pet.y };
  // 걷는 동안은 지나온 길을 조금 뒤에서(아래쪽으로 걸을 때는 몸에 가리지 않게 옆으로 비켜 — plazaPetPeek), 멈추면 곁자리로
  const target = active
    ? plazaPetPeek(plazaTrailBehind(pet.trail) ?? was, owner, was)
    : pet.heel ?? (pet.heel = plazaPetHeel(owner, was));
  let next = plazaPetStep(was, target, dt);
  if (Math.hypot(owner.x - next.x, owner.y - next.y) > PET_LOST) next = { x: target.x, y: target.y };
  const px = next.x - was.x;
  const py = next.y - was.y;
  const step = Math.hypot(px, py);
  const walking = step > 0.01;
  if (walking) {
    pet.x = next.x;
    pet.y = next.y;
    pet.facing = plazaFacing(pet.facing, px, py);
    pet.stride += step;
  } else {
    pet.stride = 0;
    // 곁에 와서 서면 주인과 같은 쪽을 봅니다
    if (!active) pet.facing = owner.facing;
  }
  pet.walking = walking;
  // 이번에 걸었으면 한 프레임 더 — 다 와서 선 자세(정지 그림 · 주인과 같은 쪽)로 바꿔 그린 뒤에 쉽니다.
  // 막혀서 못 가는 중이면(걸음이 0) 기다리지 않습니다.
  return { walking, busy: walking || (dt === 0 && Math.hypot(target.x - pet.x, target.y - pet.y) > 0.01) };
}

// 화면에 그릴 크기(px) — 그림을 키운 배율(scale = 원본 px → 화면 px)에서 한 칸의 한 변과 몸의 키.
//   캐릭터: body = PLAZA_BODY × scale. 펫: 다 자란 키 × 단계별 크기 × scale(너무 작아지지 않게 바닥을 둠).
export function plazaSpriteSize(scale, body, floor = 0) {
  const bodyPx = Math.max(floor, body * Math.max(0, Number(scale) || 0));
  const unit = bodyPx / SPRITE_BODY;
  return { unit, cell: SPRITE_CELL * unit, body: bodyPx, footX: SPRITE_FOOT.x * unit, footY: SPRITE_FOOT.y * unit };
}
export const plazaCharacterSize = (scale) => plazaSpriteSize(scale, PLAZA_BODY, 40);
export const plazaPetSize = (scale, stage) => plazaSpriteSize(scale, PLAZA_PET_BODY * plazaPetScale(stage), 18);
