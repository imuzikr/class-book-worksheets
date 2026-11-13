// =============================================================
// 책 광장의 지도 — 방(광장 · 교실) · 걷는 길 · 여는 곳 · 포털 · 시점 (components/reading/ReadingPlaza.jsx의 무대만 씀)
// -------------------------------------------------------------
// 공유 사본 · 목록의 셈(lib/readingPlaza.js)과 갈라 둡니다 — 이 파일은 광장 탭을 열 때만 내려받습니다
// (ReadingHub가 무대를 그때 불러옴). 서버는 쓰지 않습니다.
//
// **방이 둘입니다**(선생님 요청 — 교실). 책 광장(마당)과 교실이 같은 크기의 그림 한 장씩이고, 바닥의 포털로 오갑니다.
//   · PLAZA_ROOM       책 광장 — 문이 없는 그림(plaza.webp). 관리자 설정의 '교실'을 끈 반은 이 방 하나뿐입니다.
//   · PLAZA_DOOR_ROOM  책 광장 — 왼쪽 아래에 교실로 가는 문이 그려진 그림(plaza-door.webp)과 그 앞의 포털. '교실'을 켠 반.
//   · CLASSROOM_ROOM   교실 — 칠판 · 책상 30개(자리표의 30자리와 같은 6칸 × 5줄 · 책상마다 동그란 러그) · 오른쪽 아래 문 앞의 포털.
// 걷는 길의 셈(plazaWalkable · plazaPath …)은 모두 마지막 인자로 방을 받습니다(안 주면 문 없는 광장 — 예전 그대로).
// **포털 · 러그 · 책상과 의자는 배경에 그려져 있지 않습니다**(선생님이 주신 분리 그림) — 화면이 이 파일의 좌표대로 따로
// 그립니다. 그래서 자리의 좌표를 바꾸면 그림 · 걷는 길 · '내 자리'의 범위가 함께 바뀝니다.
// =============================================================

// ── 지도 — 걷는 길 ─────────────────────────────────────────────
// 좌표는 배경 그림(public/reading-plaza/*.webp)의 원본 크기(1672×941) 기준 px입니다 — 세 그림이 모두 같은 크기라
// 화면 확대 · 시점의 셈(아래 plazaView · plazaCamera)을 방마다 따로 두지 않습니다. 화면은 %로 바꿔 놓습니다.
// 캐릭터의 자리는 '발'입니다. 캐릭터는 늘 배경과 가구 위에 그려지므로, 키 큰 물건(가판대 · 분수 ·
// 그네 · 책상 줄)의 **뒤쪽**까지 못 가는 곳으로 막아 캐릭터가 지붕 · 책상 위에 올라선 듯 보이지 않게 합니다.
// 배경 그림을 바꾸면 이 값들도 함께 다시 재세요(시험 tests/unit/readingPlaza.test.mjs · readingClassroom.test.mjs가
// 길이 이어지는지 봅니다).
export const PLAZA_W = 1672;
export const PLAZA_H = 941;
export const PLAZA_CELL = 16;
// 그 앞에 섰다고 치는 거리(px) — 이 안이면 '열기' 안내가 뜨고 A(또는 Enter)로 엽니다.
export const PLAZA_NEAR = 96;

// 방 하나 — { id, art(배경 그림의 주소 — 앱에 든 그림), floor(걸을 수 있는 바닥의 테두리 · 시계 방향), ellipses · rects(바닥 안의 못 가는 곳),
//             spawn(처음 서는 자리), spawnArea(여럿이 흩어 설 띠), spots(눌러서 여는 곳), portals(다른 방으로 가는 포털) }
const frozenPoint = (p) => Object.freeze({ x: p.x, y: p.y });
function defineRoom(def) {
  return Object.freeze({
    ...def,
    floor: Object.freeze(def.floor.map((p) => Object.freeze(p))),
    ellipses: Object.freeze((def.ellipses ?? []).map((e) => Object.freeze({ ...e }))),
    rects: Object.freeze((def.rects ?? []).map((r) => Object.freeze([...r]))),
    spawn: frozenPoint(def.spawn),
    spawnArea: Object.freeze({ ...def.spawnArea }),
    spots: Object.freeze((def.spots ?? []).map((s) => Object.freeze({ ...s, stand: frozenPoint(s.stand), sign: frozenPoint(s.sign), rect: Object.freeze([...s.rect]) }))),
    portals: Object.freeze((def.portals ?? []).map((g) => Object.freeze({ ...g, art: Object.freeze({ ...g.art }), sign: frozenPoint(g.sign), rect: Object.freeze([...g.rect]) }))),
  });
}

// ── 책 광장 ──
// 걸을 수 있는 바닥(돌 깔린 마당)의 테두리 — 시계 방향. 왼쪽 아래 모서리만 두 그림이 다릅니다(문이 선 자리).
const PLAZA_FLOOR_HEAD = [
  [352, 196], [1300, 196], [1368, 240], [1492, 264], [1452, 290], [1452, 452], [1596, 456], [1602, 484],
  [1626, 556], [1660, 590], [1392, 596], [1392, 804], [1470, 850], [1432, 926], [244, 926],
];
const PLAZA_FLOOR_TAIL = [[212, 500], [60, 498], [60, 466], [208, 464], [208, 292], [108, 270], [256, 208], [330, 184]];
// 문 없는 그림 — 둘째 가판대 아래(수레바퀴 옆)까지 마당
const PLAZA_CORNER = [[216, 862], [132, 782], [52, 704], [212, 694]];
// 문 있는 그림 — 그 자리에 교실로 가는 문(집)이 섰습니다(x 62~275 · y 620~828). 문 앞(아래)의 좁은 바닥과
// 집 오른쪽 · 위쪽으로 돌아갑니다.
const PLAZA_DOOR_CORNER = [[232, 874], [214, 846], [294, 842], [294, 632], [212, 606]];
// 바닥 안의 못 가는 곳 — 분수(둥근 받침 + 그 뒤의 물줄기 기둥)
const PLAZA_FOUNTAIN = [{ cx: 836, cy: 496, rx: 130, ry: 58 }, { cx: 836, cy: 428, rx: 74, ry: 48 }];
// 처음 서는 자리 — 책꽂이와 분수 사이(마당 위쪽 가운데).
// 맵이 화면을 가득 채우면서 넓은 화면에서는 그림의 위아래 일부만 보이는데(아래 plazaView), 처음에 책꽂이와 가판대가
// 함께 보이려면 위쪽에 서야 합니다. 한때 마당 아래쪽(836, 760)이었고, 그러면 책꽂이가 화면 밖이었습니다.
// 책꽂이 앞(stand)에서는 PLAZA_NEAR보다 멀어, 들어서자마자 '눌러서 열기'가 깜빡이지 않습니다.
export const PLAZA_SPAWN = Object.freeze({ x: 836, y: 330 });
// 여럿이 흩어 설 띠(lib/readingPlazaLive.js의 plazaSpawnFor) — 책꽂이와 분수 사이
const PLAZA_SPAWN_AREA = { cx: 836, halfW: 250, top: 296, h: 68 };
// 눌러서 여는 곳 — rect는 그림에서 그 물건이 차지한 자리(누르는 곳), stand는 그 앞에 서는 자리,
// sign은 이름표 자리(align — 그 점이 이름표의 왼쪽 끝 · 가운데 · 오른쪽 끝인가. 가장자리의 가판대는
// 이름표가 그림 밖으로 잘리지 않게 안쪽으로 뻗습니다).
const PLAZA_SPOT_LIST = [
  { id: "shelf", place: "shelf", label: "책꽂이", rect: [580, 0, 1100, 190], stand: { x: 836, y: 222 }, sign: { x: 836, y: 30 }, align: "center" },
  { id: "stall-1", place: "stall", label: "가판대", rect: [36, 292, 206, 462], stand: { x: 250, y: 436 }, sign: { x: 40, y: 290 }, align: "left" },
  { id: "stall-2", place: "stall", label: "가판대", rect: [24, 500, 210, 690], stand: { x: 254, y: 650 }, sign: { x: 30, y: 498 }, align: "left" },
  { id: "stall-3", place: "stall", label: "가판대", rect: [1456, 282, 1620, 446], stand: { x: 1414, y: 420 }, sign: { x: 1636, y: 278 }, align: "right" },
];
// 포털 — 바닥에 따로 놓는 그림(PORTAL_ART — 두 방이 같은 그림)과 그 안에서 도는 빛. 발이 안쪽 타원(rx · ry)에
// 들어서면 to의 방으로 옮겨 갑니다.
//   x · y  못(안쪽 소용돌이)의 가운데 — 들어서는 타원의 가운데이자 건너와 서는 자리
//   art    포털 그림을 놓을 상자 { x · y(가운데), w, h } — 금빛 테가 아래쪽으로 두꺼워 그림의 가운데는 못보다 3px 아래
//   swirl  도는 빛을 얹을 크기(반지름) · ring 금빛 테까지의 크기(누르면 포털로 걸어감)
//   sign   이름표 자리(이름표의 아랫변) · rect 문 그림의 자리(눌러도 포털로 걸어감)
export const PLAZA_PORTAL = Object.freeze({ x: 382, y: 823 });
export const CLASSROOM_PORTAL = Object.freeze({ x: 1475, y: 855 });
export const PORTAL_ART = Object.freeze({ src: "/reading-plaza/portal.webp", swirl: "/reading-plaza/portal-swirl.webp", w: 230, h: 100, drop: 3 });
const PORTAL_SIZE = { rx: 58, ry: 20, swirl: Object.freeze({ rx: 90, ry: 33 }), ring: Object.freeze({ rx: 112, ry: 46 }) };
// 이름표는 포털 그림의 윗변 바로 위에 답니다(못에서 이만큼 위가 이름표의 아랫변 · 원본 px).
// 그 자리는 포털 한가운데에 선 캐릭터의 머리 높이라, 방을 막 건너온 동안에는 무대가 그 이름표를 잠깐 걷습니다
// (ReadingPlaza의 onGate — 벗어나면 다시 보임). 캐릭터의 머리 위로 올려 띄우는 길은 쓰지 않습니다 — 캐릭터의 키(88px)와
// 이름표(화면 px)를 넘기려면 포털에서 80px 넘게 떨어져, 무엇의 이름표인지 알 수 없게 됩니다.
const PORTAL_SIGN_UP = 53;
const portalAt = (center) => ({
  ...center, ...PORTAL_SIZE,
  art: { x: center.x, y: center.y + PORTAL_ART.drop, w: PORTAL_ART.w, h: PORTAL_ART.h },
  sign: { x: center.x, y: center.y - PORTAL_SIGN_UP },
});

export const PLAZA_ROOM = defineRoom({
  id: "plaza", name: "책 광장", art: "/reading-plaza/plaza.webp",
  floor: [...PLAZA_FLOOR_HEAD, ...PLAZA_CORNER, ...PLAZA_FLOOR_TAIL], ellipses: PLAZA_FOUNTAIN,
  spawn: PLAZA_SPAWN, spawnArea: PLAZA_SPAWN_AREA, spots: PLAZA_SPOT_LIST,
});
export const PLAZA_DOOR_ROOM = defineRoom({
  id: "plaza", name: "책 광장", art: "/reading-plaza/plaza-door.webp",
  floor: [...PLAZA_FLOOR_HEAD, ...PLAZA_DOOR_CORNER, ...PLAZA_FLOOR_TAIL], ellipses: PLAZA_FOUNTAIN,
  spawn: PLAZA_SPAWN, spawnArea: PLAZA_SPAWN_AREA,
  // 둘째 가판대 — 서던 자리(254, 650)에 문이 서서, 가판대 오른쪽 위로 옮겼습니다. 누르는 자리도 문 위쪽까지만.
  spots: PLAZA_SPOT_LIST.map((s) => (s.id === "stall-2" ? { ...s, rect: [24, 500, 210, 640], stand: { x: 252, y: 584 } } : s)),
  portals: [{ id: "to-classroom", to: "classroom", ...portalAt(PLAZA_PORTAL), label: "교실로", rect: [100, 640, 280, 832] }],
});
// 책 광장의 여는 곳(책꽂이 하나 · 가판대 셋) — 문 없는 그림의 것. 방에 따라 서는 자리가 다르므로 무대는 room.spots를 씁니다.
export const PLAZA_SPOTS = PLAZA_ROOM.spots;

// ── 교실 ──
// 책상 30개 — 6칸 × 5줄이 **한 줄씩 떨어져** 놓입니다(선생님 요청 — 한때 두 칸씩 짝지은 세 묶음이었음). **자리표의 30자리와
// 같은 차례**입니다(자리 번호 i = 줄 × 6 + 칸 · '학생 보기' — 칠판이 위).
// 책상마다 **동그란 러그**가 깔려 있고, 그 러그가 곧 '내 자리에서 무엇을 할 수 있는 범위'입니다(선생님 요청 — 러그 위에
// 서면 책상 위에 물음표가 뜸 · 판정은 lib/readingClassroom.js의 classroomNearSeat).
// 값은 선생님이 주신 배치 자료(layout.json)의 것입니다 — 러그의 가운데(가로 6 · 세로 5).
export const CLASSROOM_COLS = 6;
export const CLASSROOM_ROWS = 5;
const DESK_X = [355, 550, 748, 945, 1144, 1332];
const RUG_Y = [339, 430, 522, 614, 704];
// 러그 — 그림(rug.webp · 투명한 가장자리가 있음)을 놓는 상자(w × h)와 그 안에서 **실제로 보이는** 타원의 반지름(rx · ry).
export const CLASSROOM_RUG = Object.freeze({ src: "/reading-plaza/rug.webp", w: 190, h: 84, rx: 84, ry: 37 });
// 러그에 '올라섰다'고 치는 여유(원본 px) — 발이 닿는 점은 한 점이지만 캐릭터의 발은 폭이 있어, 가장자리를 밟으면 올라선 것으로 봅니다.
// 옆 책상의 러그와는 20~31px(복도 한가운데의 맨바닥), 앞뒤 줄의 러그와는 16~18px 떨어져 있어 여유를 두어도 겹치지 않습니다.
export const CLASSROOM_RUG_REACH = 5;
// 책상과 의자 한 세트 — 그림(desk-chair.webp)을 놓는 상자(w × h). 상자의 위쪽은 러그 가운데보다 lift만큼 위입니다.
// chair는 같은 상자에 겹쳐 그리는 '의자만'의 그림 — 앉은 캐릭터 위에 한 번 더 그려 등받이가 몸을 가리게 합니다
// (바닥 → 러그 → 책상·의자 → 캐릭터 → 의자). scripts/prepare-classroom-art.py의 DESK_W · DESK_H와 같아야 합니다.
export const CLASSROOM_DESK = Object.freeze({ src: "/reading-plaza/desk-chair.webp", chair: "/reading-plaza/chair-front.webp", w: 90, h: 78, lift: 59 });
// 책상 줄(세로 띠)은 통째로 못 가는 곳입니다 — 앞뒤 줄 사이(13px)로는 다니지 않습니다. 다니는 길은 띠 사이의 복도(80~91px)와
// 칠판 앞 · 교실 뒤쪽입니다. 러그는 책상보다 넓어 **양옆 복도로 30px 남짓씩** 나와 있고(맨 뒷줄은 의자 뒤로도 조금),
// 거기에 서면 러그 위입니다. 복도 한가운데는 어느 러그도 아닌 맨바닥입니다.
const DESK_HALF = 54;        // 책상의 보이는 반폭(41) + 옆에 선 몸(반폭 25쯤)이 책상에 깊이 겹치지 않을 여유
const DESK_TOP = 274;        // 첫 줄 책상(위쪽 280)의 바로 위
const DESK_BOTTOM = 727;     // 맨 뒷줄 의자(아래쪽 723)의 바로 아래
// 자리 하나 —
//   rug    러그의 가운데 · box 책상·의자 그림을 놓는 상자 [x0, y0, x1, y1]
//   desk   책상 윗면의 가운데(이름표 자리) · mark 물음표가 뜨는 자리(책상 윗면 — 말풍선의 아래 끝이 윗면의 앞쪽 가장자리.
//          책상 위쪽 허공에 띄우면 줄 사이가 좁아 앞줄 친구의 의자 · 이름표를 가립니다)
//   sit    앉았을 때 발이 닿는 점(의자) · chair 의자의 상자(등받이 위부터 다리까지 — 앉은 캐릭터의 이름표를 등받이에 답니다)
//   sides  책상 양옆의 러그 귀 — [왼쪽, 오른쪽] 저마다 { side(−1 · 1), stand(걸어와 서는 자리 · 일어섰을 때 서는 자리),
//          pet(주인이 앉아 있는 동안 펫이 기다리는 자리) }. 책상이 한 줄씩이라 어느 쪽 복도로든 다가옵니다.
//   stand · pet  오른쪽 귀의 것(어느 쪽인지 모를 때 쓰는 기본값)
const SEAT_STAND = 72;
const SEAT_PET = 70;
export const CLASSROOM_SEATS = Object.freeze(Array.from({ length: CLASSROOM_COLS * CLASSROOM_ROWS }, (_, index) => {
  const col = index % CLASSROOM_COLS;
  const row = (index - col) / CLASSROOM_COLS;
  const x = DESK_X[col];
  const rugY = RUG_Y[row];
  const top = rugY - CLASSROOM_DESK.lift;
  const sides = Object.freeze([-1, 1].map((side) => Object.freeze({
    side,
    stand: frozenPoint({ x: x + side * SEAT_STAND, y: rugY }),
    pet: frozenPoint({ x: x + side * SEAT_PET, y: rugY + 12 }),
  })));
  return Object.freeze({
    index, col, row,
    rug: frozenPoint({ x, y: rugY }),
    box: Object.freeze([x - CLASSROOM_DESK.w / 2, top, x + CLASSROOM_DESK.w / 2, top + CLASSROOM_DESK.h]),
    desk: frozenPoint({ x, y: top + 19 }),
    mark: frozenPoint({ x, y: top + 34 }),
    sit: frozenPoint({ x, y: top + 62 }),
    chair: Object.freeze([x - 24, top + 35, x + 24, top + 76]),
    sides,
    stand: sides[1].stand,
    pet: sides[1].pet,
  });
}));
// 앉은 캐릭터 — 뒷모습(칠판 쪽)으로 의자에 내려앉고, 의자 등받이 위쪽만 보입니다. 발에서 이만큼 위까지를 가립니다(원본 px —
// 가린 선이 등받이의 윗선(책상 상자의 위에서 35px)과 맞아, 등받이 옆으로 몸이 삐져나오지 않습니다).
export const CLASSROOM_SIT_HIDE = 26;
// 칠판 — 선생님이 그 앞(칠판 아래 벽과 첫 줄 책상 사이 · 복도의 맨 위)에 서면 출석을 시작하고 끝냅니다.
// markY는 칠판의 물음표가 뜨는 높이 — 그 앞에 선 선생님의 이름표(머리 위)보다 위라 서로 가리지 않습니다.
export const CLASSROOM_BOARD = Object.freeze({ rect: Object.freeze([490, 60, 1182, 226]), x0: 440, x1: 1232, y: 300, standY: 252, markY: 132 });

export const CLASSROOM_ROOM = defineRoom({
  id: "classroom", name: "교실", art: "/reading-plaza/classroom.webp",
  // 바닥 — 교탁(왼쪽 위) · 책장과 사물함 · 화분(오른쪽 위)을 돌아, 오른쪽 벽과 열린 문, 왼쪽 창가의 낮은 책장 앞까지
  floor: [
    [192, 276], [410, 276], [410, 238], [1220, 238], [1220, 268], [1522, 268], [1522, 306], [1584, 312],
    [1600, 440], [1606, 560], [1592, 640], [1592, 876], [1650, 928], [1650, 932], [16, 932], [16, 905], [48, 885],
  ],
  rects: DESK_X.map((x) => [x - DESK_HALF, DESK_TOP, x + DESK_HALF, DESK_BOTTOM]),
  // 교실 뒤쪽 가운데 — 책 광장 탭을 교실에서 시작할 때(마지막에 있던 방) 서는 자리
  spawn: { x: 836, y: 806 }, spawnArea: { cx: 836, halfW: 430, top: 772, h: 96 },
  portals: [{ id: "to-plaza", to: "plaza", ...portalAt(CLASSROOM_PORTAL), label: "책 광장으로", rect: [1598, 645, 1672, 941] }],
});

// 방 고르기 — id("plaza" · "classroom")와 그 반이 교실을 켰는가로. 교실을 끈 반은 문 없는 광장 하나뿐입니다.
export function plazaRoomOf(id, classroom = false) {
  if (!classroom) return PLAZA_ROOM;
  return id === "classroom" ? CLASSROOM_ROOM : PLAZA_DOOR_ROOM;
}

// ── 무대 — 그림이 화면(보이는 창)을 가득 덮게 ───────────────────────
// 광장에서 캐릭터의 키(그림 원본 px) — 무대가 그리는 크기(lib/readingPlazaSprites.js)와 시점의 셈이 함께 씁니다.
// 걷는 그림 묶음의 기준(72px)보다 조금 크게 잡았습니다 — 맵을 키운 배율을 따라 노트북 화면에서는 65~75px,
// 큰 화면에서는 100px 가까이, 폰에서는 47px쯤으로 섭니다(실측). 한때 그림 폭의 7.8%짜리 네모(PLAZA_AVATAR)였습니다(걷는 그림을 넣기 전).
export const PLAZA_BODY = 88;
// 보이는 창(w×h, 화면 px)을 빈틈없이 덮는 그림의 크기 — 가로 · 세로 가운데 더 크게 키워야 하는 쪽에 맞춥니다.
// 그림(16:9)보다 넓적한 창은 폭에 맞아 위아래가, 길쭉한 창(폰)은 높이에 맞아 좌우가 창 밖으로 넘칩니다.
// 돌려주는 값 { w, h, scale(그림 원본 px → 화면 px), worldW, worldH }
export function plazaView(w, h) {
  const width = Math.max(0, Number(w) || 0);
  const height = Math.max(0, Number(h) || 0);
  const scale = Math.max(width / PLAZA_W, height / PLAZA_H);
  return { w: width, h: height, scale, worldW: PLAZA_W * scale, worldH: PLAZA_H * scale };
}
// 시점 — 그림의 어느 자리가 창의 왼쪽 위에 오는가(화면 px). 캐릭터의 몸 가운데(발에서 그림 키의 절반 위)를
// 창 가운데에 두되, 그림 바깥이 보이지 않게 가장자리에서 멈춥니다. pos는 그림 원본 px(발).
export function plazaCamera(view, pos) {
  if (!view || !(view.scale > 0)) return { x: 0, y: 0 };
  const maxX = Math.max(0, view.worldW - view.w);
  const maxY = Math.max(0, view.worldH - view.h);
  const bodyY = (pos.y - PLAZA_BODY * 0.5) * view.scale;
  return {
    x: Math.min(maxX, Math.max(0, pos.x * view.scale - view.w / 2)),
    y: Math.min(maxY, Math.max(0, bodyY - view.h / 2)),
  };
}

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inEllipse = (e, x, y) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 <= 1;
const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
export function plazaWalkable(x, y, room = PLAZA_ROOM) {
  if (!(x >= 0 && y >= 0 && x <= PLAZA_W && y <= PLAZA_H) || !inPolygon(x, y, room.floor)) return false;
  for (const e of room.ellipses) if (inEllipse(e, x, y)) return false;
  for (const r of room.rects) if (inRect(r, x, y)) return false;
  return true;
}

const COLS = Math.ceil(PLAZA_W / PLAZA_CELL);
const ROWS = Math.ceil(PLAZA_H / PLAZA_CELL);
// 방마다 한 번만 만드는 칸 지도(걸을 수 있으면 1)
const grids = new WeakMap();
function grid(room) {
  let cells = grids.get(room);
  if (cells) return cells;
  cells = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (plazaWalkable((c + 0.5) * PLAZA_CELL, (r + 0.5) * PLAZA_CELL, room)) cells[r * COLS + c] = 1;
    }
  }
  grids.set(room, cells);
  return cells;
}
const cellOf = (x, y) => [Math.min(COLS - 1, Math.max(0, Math.floor(x / PLAZA_CELL))), Math.min(ROWS - 1, Math.max(0, Math.floor(y / PLAZA_CELL)))];
const centerOf = (c, r) => ({ x: (c + 0.5) * PLAZA_CELL, y: (r + 0.5) * PLAZA_CELL });
const opener = (room) => {
  const cells = grid(room);
  return (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && cells[r * COLS + c] === 1;
};

// 그 점에서 가장 가까운 걸을 수 있는 자리 — 가판대나 꽃밭 · 책상을 눌러도 그 앞까지 걸어갑니다.
export function plazaNearest(x, y, room = PLAZA_ROOM) {
  if (plazaWalkable(x, y, room)) return { x, y };
  const open = opener(room);
  const [c0, r0] = cellOf(x, y);
  let best = null;
  let bestD = Infinity;
  const reach = Math.max(COLS, ROWS);
  for (let ring = 1; ring <= reach; ring += 1) {
    // 이미 찾은 자리보다 가까운 칸이 이 고리에는 없으면 그만
    if (best && (ring - 1) * PLAZA_CELL > bestD) break;
    for (let dc = -ring; dc <= ring; dc += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring || !open(c0 + dc, r0 + dr)) continue;
        const p = centerOf(c0 + dc, r0 + dr);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
  }
  return best ?? { ...room.spawn };
}

// 두 점 사이를 곧게 걸을 수 있는가(6px마다 짚어 봄)
export function plazaClear(a, b, room = PLAZA_ROOM) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (!plazaWalkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, room)) return false;
  }
  return true;
}

// 길 찾기 — from에서 to까지 걸어갈 점들(from은 빼고, 마지막이 도착점). 길이 없으면 빈 배열.
// 칸(16px) 위의 A*로 찾고, 곧게 갈 수 있는 구간은 한 번에 잇습니다(지그재그로 걷지 않게).
export function plazaPath(from, to, room = PLAZA_ROOM) {
  const start = plazaNearest(from.x, from.y, room);
  const goal = plazaNearest(to.x, to.y, room);
  if (plazaClear(start, goal, room)) return [goal];
  const open = opener(room);
  const [sc, sr] = cellOf(start.x, start.y);
  const [gc, gr] = cellOf(goal.x, goal.y);
  if (!open(sc, sr) || !open(gc, gr)) return [];
  const total = COLS * ROWS;
  const cost = new Float64Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const done = new Uint8Array(total);
  const startIdx = sr * COLS + sc;
  const goalIdx = gr * COLS + gc;
  const h = (c, r) => Math.hypot(c - gc, r - gr);
  cost[startIdx] = 0;
  // 작은 판(6천 칸 남짓)이라 열린 목록을 배열로 두고 가장 싼 것을 훑어 고릅니다.
  const openList = [startIdx];
  const score = new Float64Array(total).fill(Infinity);
  score[startIdx] = h(sc, sr);
  while (openList.length) {
    let at = 0;
    for (let i = 1; i < openList.length; i += 1) if (score[openList[i]] < score[openList[at]]) at = i;
    const current = openList[at];
    openList[at] = openList[openList.length - 1];
    openList.pop();
    if (current === goalIdx) break;
    if (done[current]) continue;
    done[current] = 1;
    const c = current % COLS;
    const r = (current - c) / COLS;
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (!dc && !dr) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (!open(nc, nr)) continue;
        // 모서리를 가로질러 막힌 칸을 스치지 않게
        if (dc && dr && (!open(c + dc, r) || !open(c, r + dr))) continue;
        const next = nr * COLS + nc;
        const g = cost[current] + (dc && dr ? Math.SQRT2 : 1);
        if (g >= cost[next]) continue;
        cost[next] = g;
        prev[next] = current;
        score[next] = g + h(nc, nr);
        openList.push(next);
      }
    }
  }
  if (prev[goalIdx] === -1 && goalIdx !== startIdx) return [];
  const cells = [];
  for (let at = goalIdx; at !== -1 && at !== startIdx; at = prev[at]) cells.push(at);
  cells.reverse();
  const points = cells.map((idx) => centerOf(idx % COLS, Math.floor(idx / COLS)));
  if (points.length) points[points.length - 1] = goal;
  else points.push(goal);
  // 곧게 갈 수 있는 가장 먼 점까지 한 번에
  const path = [];
  let here = start;
  let i = 0;
  while (i < points.length) {
    let far = i;
    for (let j = points.length - 1; j > i; j -= 1) {
      if (plazaClear(here, points[j], room)) { far = j; break; }
    }
    path.push(points[far]);
    here = points[far];
    i = far + 1;
  }
  return path;
}

// 방향키로 한 걸음 — 막히면 벽을 따라 미끄러집니다(가로만 · 세로만 차례로 시도).
// 분수에 막혔으면 그 둘레를 따라 돌아갑니다(plazaRound) — 처음 서는 자리가 분수 바로 위라, 아래 방향키 하나만
// 눌러도 분수를 돌아 내려가야 합니다(안 그러면 몇 걸음 만에 멈춰 섬).
// memo — 걷는 쪽이 들고 있는 작은 기억({ turn, key }). 분수를 어느 쪽으로 돌고 있는지 적어 둡니다. 분수는 타원 둘
// (받침 · 기둥)이 겹친 모양이라, 프레임마다 새로 고르면 둘이 만나는 오목한 자리에서 오도 가도 못합니다(실측).
// 곧게 걸을 수 있게 되거나 방향키가 바뀌면 지웁니다. 안 넘기면 그때그때 고릅니다.
export function plazaStep(from, dx, dy, memo = null, room = PLAZA_ROOM) {
  const key = `${Math.sign(dx)},${Math.sign(dy)}`;
  if (memo && memo.key !== key) { memo.key = key; memo.turn = 0; }
  const free = (x, y) => {
    if (!plazaWalkable(x, y, room)) return null;
    if (memo) memo.turn = 0;
    return { x, y };
  };
  const straight = free(from.x + dx, from.y + dy);
  if (straight) return straight;
  // 분수가 막았으면 둘레를 돕니다 — 대각선 걸음도 '가로만 · 세로만'보다 이것이 먼저입니다(그 둘을 번갈아 쓰면
  // 받침과 기둥이 만나는 오목한 자리에서 제자리걸음을 합니다 — 실측).
  const round = plazaRound(from, dx, dy, memo, room);
  if (round) return round;
  const slide = dx && dy ? free(from.x + dx, from.y) ?? free(from.x, from.y + dy) : null;
  if (slide) return slide;
  if (memo) memo.turn = 0;
  return { x: from.x, y: from.y };
}
// 분수(둥근 것) 둘레를 따라 한 걸음 — 같은 빠르기로 걷습니다. 도는 쪽(turn: 1 = 화면에서 시계 방향 · -1 = 반대)은
// 가려던 쪽에 가까운 접선으로 정하고, 정면으로 부딪혔으면 지금 치우쳐 있는 쪽으로(한가운데면 시계 방향) 정합니다.
// 한 조각의 둘레를 따라가다 다른 조각에 막히면 같은 쪽으로 그 조각의 둘레로 갈아탑니다.
// 둥근 것이 아닌 것(마당 가장자리 · 가판대 · 책상 줄)에 막혔으면 null — 거기서는 멈춰 섭니다.
function plazaRound(from, dx, dy, memo, room) {
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  const hit = room.ellipses.filter((b) => inEllipse(b, from.x + dx, from.y + dy));
  if (!hit.length) return null;
  let turn = memo?.turn || 0;
  for (const e of [...hit, ...room.ellipses.filter((b) => !hit.includes(b))]) {
    // 타원의 바깥 법선 ∝ ((x−cx)/rx², (y−cy)/ry²), 접선은 그것을 90° 돌린 것(화면에서 시계 방향)
    let nx = (from.x - e.cx) / (e.rx * e.rx);
    let ny = (from.y - e.cy) / (e.ry * e.ry);
    const n = Math.hypot(nx, ny);
    if (!n) continue;
    nx /= n; ny /= n;
    const sx = -ny;
    const sy = nx;
    if (!turn) {
      let along = sx * dx + sy * dy;
      if (Math.abs(along) < len * 0.08) along = sx * (from.x - e.cx) + sy * (from.y - e.cy);
      turn = along < 0 ? -1 : 1;
    }
    // 둘레가 굽어 있어 접선으로 가면 살짝 안으로 파고들 수 있습니다 — 그때는 바깥으로 조금 밀어 냅니다.
    for (const push of [0, 0.5, 1, 2, 4]) {
      const x = from.x + turn * sx * len + nx * push;
      const y = from.y + turn * sy * len + ny * push;
      if (plazaWalkable(x, y, room)) {
        if (memo) memo.turn = turn;
        return { x, y };
      }
    }
  }
  return null;
}

// 그 자리에서 열 수 있는 곳(가장 가까운 것) — 없으면 null
export function plazaSpotNear(point, near = PLAZA_NEAR, room = PLAZA_ROOM) {
  let best = null;
  let bestD = near;
  for (const spot of room.spots) {
    const d = Math.hypot(point.x - spot.stand.x, point.y - spot.stand.y);
    if (d <= bestD) { bestD = d; best = spot; }
  }
  return best;
}
// 그 점이 어느 물건(책꽂이 · 가판대) 위인가 — 눌렀을 때
export function plazaSpotAt(x, y, room = PLAZA_ROOM) {
  return room.spots.find((s) => inRect(s.rect, x, y)) ?? null;
}

// ── 포털 ─────────────────────────────────────────────────────
// 발이 포털 안쪽(타원)에 들어섰는가 — 들어선 포털을 돌려줍니다(없으면 null). grow는 타원을 그만큼 키워 봅니다
// (옮겨 온 뒤 '포털 밖으로 나갔는가'를 볼 때 — 가장자리에서 들락날락하지 않게 조금 넉넉히).
export function plazaPortalAt(point, room = PLAZA_ROOM, grow = 0) {
  return room.portals.find((g) => ((point.x - g.x) / (g.rx + grow)) ** 2 + ((point.y - g.y) / (g.ry + grow)) ** 2 <= 1) ?? null;
}
// 그 점이 포털로 가는 물건(문 그림 · 포털의 금빛 테 안) 위인가 — 눌렀을 때 포털 한가운데로 걸어갑니다
export function plazaPortalClicked(x, y, room = PLAZA_ROOM) {
  return room.portals.find((g) => inRect(g.rect, x, y) || ((x - g.x) / g.ring.rx) ** 2 + ((y - g.y) / g.ring.ry) ** 2 <= 1) ?? null;
}
// 그 방에 들어설 때 서는 자리 — 건너온 포털(from: 떠나온 방의 id)의 한가운데. 포털이 없으면 처음 서는 자리.
export function plazaArrival(room, from) {
  const gate = room.portals.find((g) => g.to === from);
  return gate ? { x: gate.x, y: gate.y } : { ...room.spawn };
}
