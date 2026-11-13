// 교실(책 광장의 둘째 방 — 선생님 요청) — 방의 지도 · 포털 · 자리 · 자판 · 출석 확인의 셈.
//   lib/readingPlazaMap.js(방 정의 · 걷는 길) · lib/readingClassroom.js(자리표 · 행동 · 출석 확인) ·
//   lib/readingPlazaLive.js(방 · 자리 칸) · lib/readingPlazaSprites.js(앉은 주인을 기다리는 펫) · lib/reading.js(스위치)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classroomOn, featureValue, plazaOn, teacherFeatureSettings, TEACHER_FEATURES } from "../../lib/reading.js";
import {
  CLASSROOM_SEAT_COUNT, classroomAct, classroomAtBoard, classroomAttendance, classroomBoardAt, classroomBoardMark, classroomBoardStand,
  classroomDesks, classroomNearSeat, classroomRollCall, classroomSeatAround, classroomSeatAt, classroomSeatLabel, classroomSeatOf,
  classroomSeatSide, classroomUnseated, plazaArrowKey, plazaLetterKey,
} from "../../lib/readingClassroom.js";
import {
  CLASSROOM_BOARD, CLASSROOM_COLS, CLASSROOM_DESK, CLASSROOM_PORTAL, CLASSROOM_ROOM, CLASSROOM_ROWS, CLASSROOM_RUG, CLASSROOM_RUG_REACH, CLASSROOM_SEATS,
  CLASSROOM_SIT_HIDE, PLAZA_DOOR_ROOM, PLAZA_H, PLAZA_NEAR, PLAZA_PORTAL, PLAZA_ROOM, PLAZA_SPOTS, PLAZA_W, PORTAL_ART,
  plazaArrival, plazaClear, plazaNearest, plazaPath, plazaPortalAt, plazaPortalClicked, plazaRoomOf, plazaSpotAt, plazaSpotNear, plazaStep, plazaWalkable,
} from "../../lib/readingPlazaMap.js";
import { PLAZA_LIVE_IDLE_MS, PLAZA_LIVE_SEATED_IDLE_MS, plazaLivePos, plazaRemoteEnter, plazaRemoteHear, plazaSpawnFor, readPlazaLivePos } from "../../lib/readingPlazaLive.js";
import { plazaPetFollow, plazaPetStart } from "../../lib/readingPlazaSprites.js";
import { STUDY_SEAT_COUNT } from "../../lib/seats.js";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));
const reach = (from, to, room) => {
  const path = plazaPath(from, to, room);
  if (!path.length) return false;
  const end = path[path.length - 1];
  return Math.hypot(end.x - to.x, end.y - to.y) < 1;
};

test("스위치 — 교실은 책 광장이 켜진 반에서 교사가 켰을 때만(기본 꺼짐)", () => {
  assert.equal(TEACHER_FEATURES.includes("classroomEnabled"), true);
  assert.equal(featureValue({}, "classroomEnabled"), false);
  assert.equal(classroomOn({ readingEnabled: true, plazaEnabled: true, classroomEnabled: true }), true);
  assert.equal(classroomOn({ readingEnabled: true, plazaEnabled: true }), false);
  // 광장을 끄면(또는 책나눔을 끄면 · 보관하면) 교실도 꺼진 것 — 교실은 광장의 포털로만 들어갑니다
  assert.equal(classroomOn({ readingEnabled: true, plazaEnabled: false, classroomEnabled: true }), false);
  assert.equal(classroomOn({ readingEnabled: false, plazaEnabled: true, classroomEnabled: true }), false);
  assert.equal(classroomOn({ readingEnabled: true, plazaEnabled: true, classroomEnabled: true, archived: true }), false);
  assert.equal(plazaOn({ readingEnabled: true, plazaEnabled: true, classroomEnabled: false }), true);
  assert.equal(teacherFeatureSettings([{ id: "a", classroomEnabled: true }, { id: "b" }]).classroomEnabled.on, false);
  assert.equal(teacherFeatureSettings([{ id: "a", classroomEnabled: true }]).classroomEnabled.on, true);
});

test("그림 — 방의 배경 셋과, 따로 놓는 러그 · 책상과 의자 · 의자 앞부분 · 포털 · 도는 빛이 들어 있다", () => {
  for (const room of [PLAZA_ROOM, PLAZA_DOOR_ROOM, CLASSROOM_ROOM]) assert.equal(existsSync(PUBLIC + room.art), true, room.art);
  assert.deepEqual([PLAZA_ROOM.art, PLAZA_DOOR_ROOM.art, CLASSROOM_ROOM.art], ["/reading-plaza/plaza.webp", "/reading-plaza/plaza-door.webp", "/reading-plaza/classroom.webp"]);
  for (const src of [CLASSROOM_RUG.src, CLASSROOM_DESK.src, CLASSROOM_DESK.chair, PORTAL_ART.src, PORTAL_ART.swirl]) {
    assert.match(src, /^\/reading-plaza\/[a-z-]+\.webp$/);
    assert.equal(existsSync(PUBLIC + src), true, src);
  }
});

test("방 고르기 — 교실을 끈 반은 문 없는 광장 하나뿐", () => {
  assert.equal(plazaRoomOf("plaza", false), PLAZA_ROOM);
  assert.equal(plazaRoomOf("classroom", false), PLAZA_ROOM);
  assert.equal(plazaRoomOf("plaza", true), PLAZA_DOOR_ROOM);
  assert.equal(plazaRoomOf("classroom", true), CLASSROOM_ROOM);
  assert.equal(plazaRoomOf("아무거나", true), PLAZA_DOOR_ROOM);
  assert.equal(PLAZA_ROOM.portals.length, 0);
  assert.deepEqual([PLAZA_ROOM.id, PLAZA_DOOR_ROOM.id, CLASSROOM_ROOM.id], ["plaza", "plaza", "classroom"]);
});

test("문 없는 광장 — 방을 안 주면 예전 그대로(문이 선 자리도 마당)", () => {
  // 둘째 가판대 앞의 옛 자리 · 그 아래 마당
  assert.equal(plazaWalkable(254, 650), true);
  assert.equal(plazaWalkable(180, 760), true);
  assert.equal(plazaWalkable(254, 650, PLAZA_ROOM), true);
  assert.equal(PLAZA_SPOTS, PLAZA_ROOM.spots);
  assert.deepEqual(PLAZA_SPOTS.find((s) => s.id === "stall-2").stand, { x: 254, y: 650 });
  assert.equal(plazaPortalAt(PLAZA_PORTAL, PLAZA_ROOM), null);
});

test("문 달린 광장 — 문이 선 자리는 못 가고, 여는 곳 · 포털까지 길이 이어진다", () => {
  const room = PLAZA_DOOR_ROOM;
  // 문(집)이 선 자리 — 옛 둘째 가판대 앞 · 그 아래
  for (const [x, y] of [[254, 650], [180, 760], [150, 700], [260, 800]]) assert.equal(plazaWalkable(x, y, room), false, `${x},${y}`);
  // 문 앞의 좁은 바닥 · 집 오른쪽 · 포털 위
  for (const [x, y] of [[250, 858], [310, 740], [381, 823], [330, 600]]) assert.equal(plazaWalkable(x, y, room), true, `${x},${y}`);
  // 문이 없는 쪽은 두 그림이 같다(분수 · 마당 한가운데 · 오른쪽 가판대 앞)
  for (const [x, y] of [[836, 330], [836, 496], [1414, 420], [700, 700], [1500, 700], [40, 40]]) {
    assert.equal(plazaWalkable(x, y, room), plazaWalkable(x, y, PLAZA_ROOM), `${x},${y}`);
  }
  // 둘째 가판대는 서는 자리를 옮겼다 — 그 자리에서 '열기'가 뜬다
  const stall2 = room.spots.find((s) => s.id === "stall-2");
  assert.deepEqual(stall2.stand, { x: 252, y: 584 });
  assert.equal(plazaSpotNear(stall2.stand, PLAZA_NEAR, room)?.id, "stall-2");
  assert.equal(plazaSpotAt(120, 560, room)?.id, "stall-2");
  assert.equal(plazaSpotAt(150, 700, room), null, "문은 가판대가 아니다");
  for (const spot of room.spots) {
    assert.equal(plazaWalkable(spot.stand.x, spot.stand.y, room), true, spot.id);
    assert.equal(reach(room.spawn, spot.stand, room), true, spot.id);
    assert.equal(reach(PLAZA_PORTAL, spot.stand, room), true, `포털 → ${spot.id}`);
  }
  assert.equal(reach(room.spawn, PLAZA_PORTAL, room), true);
  // 포털 한가운데는 여는 곳(가판대 · 책꽂이) 앞이 아니다 — 건너오자마자 '열기'가 깜빡이지 않게
  assert.equal(plazaSpotNear(PLAZA_PORTAL, PLAZA_NEAR, room), null);
});

test("포털 — 안쪽에 들어서면 다른 방으로, 건너온 포털의 한가운데에 선다", () => {
  const gate = PLAZA_DOOR_ROOM.portals[0];
  const door = CLASSROOM_ROOM.portals[0];
  assert.deepEqual([gate.to, door.to], ["classroom", "plaza"]);
  assert.deepEqual({ x: gate.x, y: gate.y }, PLAZA_PORTAL);
  assert.deepEqual({ x: door.x, y: door.y }, CLASSROOM_PORTAL);
  // 포털은 배경에 그려져 있지 않다 — 그림을 놓을 상자(선생님이 주신 배치 자료의 자리 · 크기)가 따로 있고,
  // 들어서는 타원 · 도는 빛은 그 그림 안에 든다
  assert.deepEqual(gate.art, { x: 382, y: 826, w: 230, h: 100 });
  assert.deepEqual(door.art, { x: 1475, y: 858, w: 230, h: 100 });
  for (const g of [gate, door]) {
    assert.ok(g.rx < g.swirl.rx && g.swirl.rx < g.art.w / 2 && g.ry < g.swirl.ry && g.swirl.ry < g.art.h / 2, g.id);
    assert.ok(g.ring.rx <= g.art.w / 2 && g.ring.ry <= g.art.h / 2, g.id);
    assert.ok(g.sign.y < g.art.y - g.art.h / 2, `${g.id} 이름표는 포털 그림 위`);
    // 이름표는 포털의 가운데 줄 · 그림 윗변에 붙여서(멀리 띄우면 무엇의 이름표인지 모름 — 건너온 직후에는 무대가 잠깐 걷음)
    assert.ok(g.sign.x === g.x && g.art.y - g.art.h / 2 - g.sign.y <= 8, `${g.id} 이름표는 포털 그림에 붙어 있다`);
  }
  assert.equal(plazaPortalAt(PLAZA_PORTAL, PLAZA_DOOR_ROOM)?.to, "classroom");
  assert.equal(plazaPortalAt({ x: gate.x + gate.rx - 2, y: gate.y }, PLAZA_DOOR_ROOM)?.to, "classroom");
  assert.equal(plazaPortalAt({ x: gate.x + gate.rx + 3, y: gate.y }, PLAZA_DOOR_ROOM), null);
  assert.equal(plazaPortalAt({ x: gate.x, y: gate.y + gate.ry + 3 }, PLAZA_DOOR_ROOM), null);
  // 넉넉히 키워 보면(건너온 뒤 '벗어났는가') 가장자리 바로 밖도 안이다
  assert.equal(plazaPortalAt({ x: gate.x + gate.rx + 3, y: gate.y }, PLAZA_DOOR_ROOM, 22)?.to, "classroom");
  assert.equal(plazaPortalAt({ x: gate.x + gate.rx + 30, y: gate.y }, PLAZA_DOOR_ROOM, 22), null);
  // 건너가 서는 자리 — 저쪽 포털의 한가운데(거기도 포털 안이라, 벗어날 때까지는 다시 건너지 않게 무대가 막음)
  assert.deepEqual(plazaArrival(CLASSROOM_ROOM, "plaza"), CLASSROOM_PORTAL);
  assert.deepEqual(plazaArrival(PLAZA_DOOR_ROOM, "classroom"), PLAZA_PORTAL);
  assert.deepEqual(plazaArrival(PLAZA_ROOM, "classroom"), { ...PLAZA_ROOM.spawn }, "포털이 없는 방이면 처음 서는 자리");
  for (const [room, at] of [[PLAZA_DOOR_ROOM, PLAZA_PORTAL], [CLASSROOM_ROOM, CLASSROOM_PORTAL]]) {
    assert.equal(plazaWalkable(at.x, at.y, room), true);
    // 포털에서 걸어 나올 수 있다(네 방향 가운데 적어도 둘)
    const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => plazaClear(at, { x: at.x + dx * 90, y: at.y + dy * 60 }, room));
    assert.ok(ways.length >= 2, `${room.id} 포털에서 나오는 길 ${ways.length}`);
  }
  // 누르기 — 포털의 금빛 테 안 · 문 그림을 누르면 포털로 걸어간다(그 둘레의 바닥은 아님)
  assert.equal(plazaPortalClicked(gate.x + 100, gate.y, PLAZA_DOOR_ROOM)?.to, "classroom");
  assert.equal(plazaPortalClicked(180, 740, PLAZA_DOOR_ROOM)?.to, "classroom", "문 그림");
  assert.equal(plazaPortalClicked(gate.x + 140, gate.y, PLAZA_DOOR_ROOM), null);
  assert.equal(plazaPortalClicked(gate.x, gate.y - 70, PLAZA_DOOR_ROOM), null);
  assert.equal(plazaPortalClicked(1640, 800, CLASSROOM_ROOM)?.to, "plaza", "교실의 문");
  assert.equal(plazaPortalClicked(1300, 800, CLASSROOM_ROOM), null);
});

test("교실 — 책상 30개가 자리표의 30자리와 같은 차례(6칸 × 5줄 · 칠판 쪽이 첫 줄)", () => {
  assert.equal(CLASSROOM_SEATS.length, 30);
  assert.equal(CLASSROOM_SEATS.length, STUDY_SEAT_COUNT, "자리표의 자리 수와 같아야 한다");
  assert.equal(CLASSROOM_SEAT_COUNT, 30);
  assert.deepEqual([CLASSROOM_COLS, CLASSROOM_ROWS], [6, 5]);
  CLASSROOM_SEATS.forEach((seat, i) => {
    assert.equal(seat.index, i);
    assert.deepEqual([seat.row, seat.col], [Math.floor(i / 6), i % 6]);
  });
  // 왼쪽 → 오른쪽, 위(칠판) → 아래
  for (let i = 1; i < 6; i += 1) assert.ok(CLASSROOM_SEATS[i].desk.x > CLASSROOM_SEATS[i - 1].desk.x);
  for (let r = 1; r < 5; r += 1) assert.ok(CLASSROOM_SEATS[r * 6].desk.y > CLASSROOM_SEATS[(r - 1) * 6].desk.y);
  // 선생님이 주신 배치 자료의 값 — 첫 자리 · 끝 자리의 러그 가운데와 책상·의자 그림의 상자
  assert.deepEqual(CLASSROOM_SEATS[0].rug, { x: 355, y: 339 });
  assert.deepEqual(CLASSROOM_SEATS[29].rug, { x: 1332, y: 704 });
  assert.deepEqual(CLASSROOM_SEATS[0].box, [310, 280, 400, 358]);
  assert.deepEqual(CLASSROOM_SEATS[29].box, [1287, 645, 1377, 723]);
  // 책상이 한 줄씩 — 가로 간격이 고르다(두 칸씩 짝지은 묶음이 아님)
  const gaps = [1, 2, 3, 4, 5].map((i) => CLASSROOM_SEATS[i].rug.x - CLASSROOM_SEATS[i - 1].rug.x);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 12, `가로 간격 ${gaps}`);
});

test("러그 — 책상마다 한 장, 책상보다 넓어 양옆 복도로 나오고 옆 · 앞뒤 자리의 러그와 겹치지 않는다", () => {
  assert.ok(CLASSROOM_RUG.rx * 2 < CLASSROOM_RUG.w && CLASSROOM_RUG.ry * 2 < CLASSROOM_RUG.h, "보이는 타원은 그림 상자보다 작다(투명한 가장자리)");
  assert.ok(CLASSROOM_RUG.rx > CLASSROOM_DESK.w / 2 + 30, "책상 양옆으로 넉넉히 나온다");
  assert.ok(CLASSROOM_RUG_REACH > 0 && CLASSROOM_RUG_REACH <= 8);
  for (const seat of CLASSROOM_SEATS) {
    // 책상·의자의 상자 — 러그 가운데가 상자 안(앞다리 쯤)에 온다
    assert.deepEqual([seat.box[2] - seat.box[0], seat.box[3] - seat.box[1]], [CLASSROOM_DESK.w, CLASSROOM_DESK.h]);
    assert.equal(seat.box[1], seat.rug.y - CLASSROOM_DESK.lift);
    assert.ok(seat.rug.y > seat.box[1] && seat.rug.y < seat.box[3] && seat.rug.x === (seat.box[0] + seat.box[2]) / 2);
    // 옆 자리 · 뒷자리와는 여유를 두어도 떨어져 있다
    const right = seat.col < CLASSROOM_COLS - 1 ? CLASSROOM_SEATS[seat.index + 1] : null;
    const behind = seat.row < CLASSROOM_ROWS - 1 ? CLASSROOM_SEATS[seat.index + CLASSROOM_COLS] : null;
    if (right) assert.ok(right.rug.x - seat.rug.x > (CLASSROOM_RUG.rx + CLASSROOM_RUG_REACH) * 2 + 6, `자리 ${seat.index} 옆`);
    if (behind) assert.ok(behind.rug.y - seat.rug.y > (CLASSROOM_RUG.ry + CLASSROOM_RUG_REACH) * 2 + 4, `자리 ${seat.index} 뒤`);
  }
  // 어느 점도 두 러그에 함께 걸치지 않는다(교실을 8px마다 훑음)
  for (let x = 200; x < 1500; x += 8) {
    for (let y = 250; y < 780; y += 8) {
      const on = CLASSROOM_SEATS.filter((seat) => classroomNearSeat({ x, y }, seat.index));
      assert.ok(on.length <= 1, `${x},${y}가 러그 ${on.map((s) => s.index)}에 함께`);
    }
  }
});

test("교실 — 책상 줄은 못 가고, 자리마다 양옆의 러그 귀(서는 자리 · 펫 자리)가 바닥이며 길이 이어진다", () => {
  const room = CLASSROOM_ROOM;
  assert.equal(plazaWalkable(room.spawn.x, room.spawn.y, room), true);
  for (const seat of CLASSROOM_SEATS) {
    const tag = `자리 ${seat.index}`;
    // 책상 윗면 · 의자(앉는 점) · 책상·의자 그림의 네 귀는 걷는 바닥이 아니다
    assert.equal(plazaWalkable(seat.desk.x, seat.desk.y, room), false, tag);
    assert.equal(plazaWalkable(seat.sit.x, seat.sit.y, room), false, tag);
    for (const [x, y] of [[seat.box[0] + 4, seat.box[1] + 4], [seat.box[2] - 4, seat.box[1] + 4], [seat.box[0] + 4, seat.box[3] - 2], [seat.box[2] - 4, seat.box[3] - 2]]) {
      assert.equal(plazaWalkable(x, y, room), false, `${tag} 그림 ${x},${y}`);
    }
    // 의자 바로 뒤 — 뒷줄의 책상이 이어져 못 가고, 맨 뒷줄만 교실 뒤쪽 바닥(거기도 러그 위)
    const back = { x: seat.rug.x, y: seat.box[3] + 8 };
    assert.equal(plazaWalkable(back.x, back.y, room), seat.row === CLASSROOM_ROWS - 1, `${tag} 뒤`);
    if (seat.row === CLASSROOM_ROWS - 1) assert.equal(classroomNearSeat(back, seat.index), true, `${tag} 뒤도 러그 위`);
    // 양옆의 서는 자리 · 펫 자리는 복도 바닥이고 러그 위다(물음표가 뜸)
    assert.deepEqual(seat.sides.map((side) => side.side), [-1, 1]);
    for (const side of seat.sides) {
      assert.equal(Math.sign(side.stand.x - seat.rug.x), side.side, tag);
      assert.equal(plazaWalkable(side.stand.x, side.stand.y, room), true, `${tag} 서는 자리`);
      assert.equal(plazaWalkable(side.pet.x, side.pet.y, room), true, `${tag} 펫 자리`);
      assert.equal(classroomNearSeat(side.stand, seat.index), true, tag);
      assert.equal(classroomNearSeat(side.pet, seat.index), true, tag);
      assert.equal(classroomSeatAround(side.stand), seat.index, tag);
      assert.equal(reach(room.spawn, side.stand, room), true, tag);
      assert.equal(reach(CLASSROOM_PORTAL, side.stand, room), true, `포털 → ${tag}`);
    }
    assert.equal(seat.stand, seat.sides[1].stand, "기본은 오른쪽");
    assert.equal(seat.pet, seat.sides[1].pet);
    // 의자의 상자는 앉는 점을 품고, 책상·의자 그림 안에 있다
    assert.ok(seat.chair[0] < seat.sit.x && seat.sit.x < seat.chair[2] && seat.chair[1] < seat.sit.y && seat.sit.y <= seat.chair[3], tag);
    assert.ok(seat.chair[0] >= seat.box[0] && seat.chair[2] <= seat.box[2] && seat.chair[1] > seat.box[1] && seat.chair[3] <= seat.box[3], tag);
    // 앉으면 가리는 선(발에서 CLASSROOM_SIT_HIDE 위)이 의자 등받이의 윗선과 맞는다
    assert.ok(Math.abs(seat.sit.y - CLASSROOM_SIT_HIDE - seat.chair[1]) <= 2, tag);
    // 물음표는 책상 윗면에(말풍선의 아래 끝이 윗면의 앞쪽 가장자리 — 의자 등받이 바로 위)
    assert.ok(seat.mark.x === seat.rug.x && seat.mark.y > seat.desk.y && seat.mark.y <= seat.chair[1], tag);
  }
  // 책상 줄 사이의 복도(한가운데 · 러그의 귀) · 칠판 앞 · 교실 뒤쪽 · 양쪽 벽 옆은 다닌다
  for (const [x, y] of [[452, 400], [649, 400], [1044, 500], [836, 252], [836, 800], [260, 500], [1450, 500], [410, 339], [300, 339]]) assert.equal(plazaWalkable(x, y, room), true, `${x},${y}`);
  // 교탁 · 책장 · 벽 · 창가의 책장 · 열린 문은 못 간다
  for (const [x, y] of [[300, 220], [1300, 200], [836, 150], [60, 500], [1640, 760], [1660, 400]]) assert.equal(plazaWalkable(x, y, room), false, `${x},${y}`);
  assert.equal(reach(room.spawn, CLASSROOM_PORTAL, room), true);
  // 책상을 눌러도 그 옆 바닥까지 걸어간다
  const near = plazaNearest(CLASSROOM_SEATS[14].desk.x, CLASSROOM_SEATS[14].desk.y, room);
  assert.equal(plazaWalkable(near.x, near.y, room), true);
  // 방향키로 책상 줄에 막히면 멈춘다(뚫고 지나가지 않음) — 왼쪽 귀에서 오른쪽으로 · 오른쪽 귀에서 왼쪽으로
  const first = CLASSROOM_SEATS[0];
  let at = { ...first.sides[0].stand };
  for (let i = 0; i < 60; i += 1) at = plazaStep(at, 6, 0, null, room);
  assert.ok(at.x < first.box[0] && classroomNearSeat(at, 0), `책상 왼쪽에서 멈춤 ${at.x} — 러그 위`);
  at = { ...first.sides[1].stand };
  for (let i = 0; i < 60; i += 1) at = plazaStep(at, -6, 0, null, room);
  assert.ok(at.x > first.box[2] && classroomNearSeat(at, 0), `책상 오른쪽에서 멈춤 ${at.x} — 러그 위`);
});

test("교실 — 칠판 앞(선생님이 출석을 시작하는 자리)", () => {
  const room = CLASSROOM_ROOM;
  assert.equal(classroomAtBoard({ x: 836, y: CLASSROOM_BOARD.standY }), true);
  assert.equal(classroomAtBoard({ x: 500, y: 290 }), true);
  assert.equal(classroomAtBoard({ x: 836, y: 420 }), false, "복도 아래쪽");
  assert.equal(classroomAtBoard({ x: 300, y: 250 }), false, "교탁 쪽");
  assert.equal(classroomAtBoard(null), false);
  assert.equal(classroomBoardAt(836, 150), true);
  assert.equal(classroomBoardAt(836, 300), false);
  // 칠판의 어디를 눌러도 그 아래 바닥에 선다(걸어갈 수 있는 자리 · 칠판 앞)
  for (const x of [400, 500, 836, 1170, 1400]) {
    const stand = classroomBoardStand(x);
    assert.equal(plazaWalkable(stand.x, stand.y, room), true, `x ${x}`);
    assert.equal(classroomAtBoard(stand), true, `x ${x}`);
    assert.equal(reach(room.spawn, stand, room), true, `x ${x}`);
  }
  // 물음표는 선생님이 선 곳 위(칠판 가로 안에서) — 선생님의 머리(이름표)보다 위
  const mark = classroomBoardMark({ x: 836, y: 252 });
  assert.ok(Math.abs(mark.x - 836) <= 30 && mark.y === CLASSROOM_BOARD.markY);
  assert.ok(CLASSROOM_BOARD.markY < CLASSROOM_BOARD.standY - 88 - 20, "서 있는 캐릭터의 이름표보다 위");
  assert.ok(classroomBoardMark({ x: 100 }).x >= CLASSROOM_BOARD.rect[0] && classroomBoardMark({ x: 1600 }).x <= CLASSROOM_BOARD.rect[2]);
});

test("자리표 — 저장된 자리만, 같은 학생이 두 번 있으면 앞의 자리", () => {
  const seats = ["u1", null, "u3", "", "u1", "u6", 7, undefined];
  const desks = classroomDesks(seats);
  assert.equal(desks.length, 30);
  assert.deepEqual(desks.slice(0, 8), ["u1", null, "u3", null, null, "u6", null, null]);
  assert.deepEqual(classroomDesks(null), Array(30).fill(null));
  assert.deepEqual(classroomDesks([...Array(40).keys()].map((i) => `s${i}`)).length, 30, "서른 자리까지만");
  assert.equal(classroomSeatOf(desks, "u1"), 0);
  assert.equal(classroomSeatOf(desks, "u3"), 2);
  assert.equal(classroomSeatOf(desks, "u6"), 5);
  assert.equal(classroomSeatOf(desks, "없는 학생"), null);
  assert.equal(classroomSeatOf(desks, ""), null);
  assert.equal(classroomSeatOf(null, "u1"), null);
  // 자리표에 없는 학생 — 명단의 차례 그대로
  const roster = [{ uid: "u1" }, { uid: "u2" }, { uid: "u3" }, { uid: "u9" }];
  assert.deepEqual(classroomUnseated(desks, roster).map((s) => s.uid), ["u2", "u9"]);
  assert.deepEqual(classroomUnseated(classroomDesks(null), roster).length, 4, "자리표를 저장한 적이 없으면 모두");
  assert.deepEqual(classroomUnseated(desks, []), []);
  assert.equal(classroomSeatLabel(0), "1번째 줄 · 왼쪽에서 1번째");
  assert.equal(classroomSeatLabel(8), "2번째 줄 · 왼쪽에서 3번째");
  assert.equal(classroomSeatLabel(29), "5번째 줄 · 왼쪽에서 6번째");
  assert.equal(classroomSeatLabel(30), "");
});

test("러그 위인가 — 내 자리의 러그에 올라서야 하고, 복도 한가운데 · 옆 자리 · 앞뒤 줄과는 가린다", () => {
  const mine = CLASSROOM_SEATS[8];   // 2번째 줄 3번째
  const [left, right] = mine.sides;
  assert.equal(classroomNearSeat(left.stand, 8), true);
  assert.equal(classroomNearSeat(right.stand, 8), true);
  // 러그의 가장자리 — 살짝 밟아도 올라선 것(여유), 그보다 밖은 아님
  assert.equal(classroomNearSeat({ x: mine.rug.x + CLASSROOM_RUG.rx + CLASSROOM_RUG_REACH - 1, y: mine.rug.y }, 8), true);
  assert.equal(classroomNearSeat({ x: mine.rug.x + CLASSROOM_RUG.rx + CLASSROOM_RUG_REACH + 3, y: mine.rug.y }, 8), false);
  assert.equal(classroomNearSeat({ x: mine.rug.x + 60, y: mine.rug.y + 30 }, 8), true, "귀의 아래쪽");
  assert.equal(classroomNearSeat({ x: mine.rug.x + 60, y: mine.rug.y + 37 }, 8), false, "러그 밖(뒷줄과의 사이)");
  // 복도 한가운데(옆 자리와의 사이)는 어느 러그도 아니다
  const aisle = { x: (mine.rug.x + CLASSROOM_SEATS[9].rug.x) / 2, y: mine.rug.y };
  assert.equal(plazaWalkable(aisle.x, aisle.y, CLASSROOM_ROOM), true);
  assert.equal(classroomNearSeat(aisle, 8), false);
  assert.equal(classroomNearSeat(aisle, 9), false);
  assert.equal(classroomSeatAround(aisle), null);
  // 옆 자리 · 뒷줄 · 앞줄의 러그는 내 자리가 아니다
  assert.equal(classroomNearSeat(CLASSROOM_SEATS[9].sides[0].stand, 8), false, "옆 자리의 왼쪽 귀(같은 복도)");
  assert.equal(classroomNearSeat(CLASSROOM_SEATS[14].stand, 8), false, "뒷줄의 서는 자리");
  assert.equal(classroomNearSeat(CLASSROOM_SEATS[2].stand, 8), false, "앞줄의 서는 자리");
  assert.equal(classroomNearSeat(CLASSROOM_ROOM.spawn, 8), false);
  assert.equal(classroomNearSeat(mine.stand, null), false);
  assert.equal(classroomNearSeat(null, 8), false);
  // 칠판 앞 복도는 첫 줄의 러그가 아니다(러그는 책상 아래쪽에 깔려 있음)
  assert.equal(classroomNearSeat({ x: CLASSROOM_SEATS[2].rug.x, y: 262 }, 2), false);
  assert.equal(classroomSeatAround(right.stand), 8);
  assert.equal(classroomSeatAround(left.stand), 8);
  assert.equal(classroomSeatAround(CLASSROOM_ROOM.spawn), null);
  assert.equal(classroomSeatAround(null), null);
  // 누르기 — 책상 윗면 · 의자를 누르면 그 자리, 러그의 귀(걷는 바닥)는 아님
  assert.equal(classroomSeatAt(mine.desk.x, mine.desk.y), 8);
  assert.equal(classroomSeatAt(mine.sit.x, mine.sit.y), 8);
  assert.equal(classroomSeatAt(right.stand.x, right.stand.y), null);
  assert.equal(classroomSeatAt(mine.desk.x, mine.box[3] + 20), 14, "뒷줄 책상");
  // 다가갈 쪽 — 지금 선 곳에서 가까운 귀(모르면 오른쪽)
  assert.equal(classroomSeatSide(8, { x: mine.rug.x - 120, y: 600 }), left);
  assert.equal(classroomSeatSide(8, { x: mine.rug.x + 120, y: 300 }), right);
  assert.equal(classroomSeatSide(8, null), right);
  assert.equal(classroomSeatSide(8, { x: NaN, y: 1 }), right);
  assert.equal(classroomSeatSide(99), null);
});

test("A를 누르면 — 학생: 내 책상 옆이면 앉기 · 앉아 있으면 다시 서기 / 선생님: 칠판 앞이면 출석", () => {
  const mine = CLASSROOM_SEATS[8];
  assert.deepEqual(classroomAct({ point: mine.stand, seat: 8, sitting: null }), { kind: "sit", seat: 8 });
  assert.deepEqual(classroomAct({ point: mine.sit, seat: 8, sitting: 8 }), { kind: "stand", seat: 8 });
  // 남의 책상 옆 — 내 자리가 어디인지 알려 준다
  assert.deepEqual(classroomAct({ point: CLASSROOM_SEATS[20].stand, seat: 8, sitting: null }), { kind: "other", seat: 8, at: 20 });
  // 책상에서 멀다
  assert.deepEqual(classroomAct({ point: CLASSROOM_ROOM.spawn, seat: 8, sitting: null }), { kind: "far", seat: 8 });
  // 자리표에 없는 학생
  assert.deepEqual(classroomAct({ point: mine.stand, seat: null, sitting: null }), { kind: "noseat" });
  // 학생은 칠판 앞에서도 출석을 시작하지 못한다
  assert.equal(classroomAct({ point: { x: 836, y: 252 }, seat: 8, sitting: null }).kind, "far");
  // 선생님 — 칠판 앞에서만, 책상 옆에서는 앉지 않는다
  assert.deepEqual(classroomAct({ teacher: true, point: { x: 836, y: 252 } }), { kind: "board" });
  assert.deepEqual(classroomAct({ teacher: true, point: mine.stand, seat: 8 }), { kind: "far" });
  assert.deepEqual(classroomAct({ teacher: true, point: CLASSROOM_ROOM.spawn }), { kind: "far" });
});

test("자판 — A · S · C는 한글 입력 상태에서도 듣고, 걷는 키는 방향키뿐", () => {
  for (const [event, want] of [
    [{ key: "a", code: "KeyA" }, "a"], [{ key: "A", code: "KeyA" }, "a"], [{ key: "s", code: "KeyS" }, "s"], [{ key: "C", code: "KeyC" }, "c"],
    // 한글 입력 상태 — 글자가 한글 자모로 오거나, 조합 중이라 'Process'로 온다
    [{ key: "ㅁ", code: "KeyA" }, "a"], [{ key: "ㄴ", code: "KeyS" }, "s"], [{ key: "ㅊ", code: "KeyC" }, "c"],
    [{ key: "Process", code: "KeyA" }, "a"], [{ key: "Unidentified", code: "KeyS" }, "s"], [{ key: "ㅁ" }, "a"],
    // 자판 배열이 달라 그 자리에서 다른 영문 글자가 오면 그 글자를 따른다(자리로 넘겨짚지 않음)
    [{ key: "q", code: "KeyA" }, null], [{ key: "a", code: "KeyQ" }, "a"], [{ key: "1", code: "KeyS" }, null],
    [{ key: "d", code: "KeyD" }, null], [{ key: "w", code: "KeyW" }, null], [{ key: "Enter", code: "Enter" }, null], [{ key: " ", code: "Space" }, null],
    [{}, null], [null, null],
  ]) assert.equal(plazaLetterKey(event), want, JSON.stringify(event));
  assert.deepEqual(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map((key) => plazaArrowKey({ key })), ["left", "right", "up", "down"]);
  // W · A · S · D로는 걷지 않는다(선생님 결정 — A · S가 행동 키)
  for (const key of ["a", "A", "s", "d", "w", "ㅁ", "Enter"]) assert.equal(plazaArrowKey({ key }), null, key);
});

test("출석 확인 — 선생님이 출석시작을 누른 순간 제자리에 앉아 있던 학생만", () => {
  const base = { prev: 100, call: 200, openToday: true, seated: true, attended: false };
  assert.equal(classroomRollCall(base), true);
  // 앉아 있지 않으면 · 이미 출석했으면 · 출석이 열려 있지 않으면 아님
  assert.equal(classroomRollCall({ ...base, seated: false }), false);
  assert.equal(classroomRollCall({ ...base, attended: true }), false);
  assert.equal(classroomRollCall({ ...base, openToday: false }), false);
  // 값이 그대로면(다른 까닭으로 다시 그려짐 · 출석종료) 아님
  assert.equal(classroomRollCall({ ...base, call: 100 }), false);
  // 화면을 열고 처음 본 값은 기준일 뿐 — 출석시작 뒤에 들어온 학생은 '그때 접속하지 않은' 학생
  assert.equal(classroomRollCall({ ...base, prev: undefined }), false);
  // 오늘 처음 부르는 출석(앞의 값이 없음 · null)은 새 확인이다
  assert.equal(classroomRollCall({ ...base, prev: null }), true);
  assert.equal(classroomRollCall({ ...base, prev: 0 }), true);
  // 값이 지워지거나 모양이 틀리면 아님
  for (const call of [null, undefined, 0, "", "abc", NaN]) assert.equal(classroomRollCall({ ...base, call }), false, String(call));
  // 다시 누르면(값이 또 바뀜) 그때 앉아 있는 학생이 더해진다
  assert.equal(classroomRollCall({ ...base, prev: 200, call: 201 }), true);
  assert.equal(classroomRollCall(), false);
});

test("선생님 화면 — 오늘 출석한 수는 지금 명단에 있는 학생만 센다", () => {
  const roster = [{ uid: "a" }, { uid: "b" }, { uid: "c" }];
  assert.deepEqual(classroomAttendance(roster, new Set(["a", "c", "반에서 빠진 학생"])), { present: 2, total: 3 });
  assert.deepEqual(classroomAttendance(roster, null), { present: 0, total: 3 });
  assert.deepEqual(classroomAttendance([], new Set(["a"])), { present: 0, total: 0 });
});

test("함께 보기 — 자리에 어느 방 · 어느 책상인지 싣는다(광장에 있을 때는 싣지 않음)", () => {
  // 광장 — 예전 그대로(규칙을 새로 게시하지 않은 배포의 광장도 그대로 돌게)
  assert.deepEqual(plazaLivePos({ x: 836, y: 330, mode: 0, facing: "down" }), { x: 836, y: 330, m: 0, f: 0 });
  assert.deepEqual(plazaLivePos({ x: 836, y: 330, mode: 0, facing: "down", room: "plaza", seat: 3 }), { x: 836, y: 330, m: 0, f: 0 }, "광장에서는 자리를 싣지 않는다");
  // 교실에 서 있음 · 걷는 중
  assert.deepEqual(plazaLivePos({ x: 600, y: 800, mode: 0, facing: "left", room: "classroom" }), { x: 600, y: 800, m: 0, f: 3, z: 1 });
  assert.deepEqual(plazaLivePos({ x: 600, y: 800, mode: 1, path: [{ x: 640, y: 500 }], facing: "up", room: "classroom" }), { x: 600, y: 800, m: 1, f: 2, w: "640,500", z: 1 });
  // 앉음 — 걷지 않는다(걸음 · 길을 실어 와도 선 것으로)
  const seat = CLASSROOM_SEATS[8];
  assert.deepEqual(plazaLivePos({ ...seat.sit, mode: 2, path: [{ x: 1, y: 1 }], facing: "up", room: "classroom", seat: 8 }), { x: seat.sit.x, y: seat.sit.y, m: 0, f: 2, z: 1, s: 8 });
  // 모양이 틀린 자리 번호는 싣지 않는다
  for (const bad of [-1, 30, 1.5, "3", NaN, true]) assert.equal("s" in plazaLivePos({ x: 1, y: 1, room: "classroom", seat: bad }), false, String(bad));
  // 받기
  assert.deepEqual({ room: readPlazaLivePos({ x: 1, y: 2, m: 0, f: 0 }).room, seat: readPlazaLivePos({ x: 1, y: 2, m: 0, f: 0 }).seat }, { room: "plaza", seat: null });
  const sat = readPlazaLivePos({ x: seat.sit.x, y: seat.sit.y, m: 2, f: 2, z: 1, s: 8, w: "1,1", t: 5 });
  assert.deepEqual({ room: sat.room, seat: sat.seat, mode: sat.mode, path: sat.path }, { room: "classroom", seat: 8, mode: 0, path: [] });
  assert.equal(readPlazaLivePos({ x: 1, y: 2, m: 0, f: 0, z: 1 }).seat, null);
  assert.equal(readPlazaLivePos({ x: 1, y: 2, m: 0, f: 0, s: 8 }).seat, null, "광장인데 자리가 실려 오면 버린다");
  for (const s of [-1, 30, 2.5, "8", null]) assert.equal(readPlazaLivePos({ x: 1, y: 2, m: 0, f: 0, z: 1, s }).seat, null, String(s));
  for (const z of [0, 2, true, "1"]) assert.equal(readPlazaLivePos({ x: 1, y: 2, m: 0, f: 0, z }).room, "plaza", String(z));
});

test("함께 보기 — 앉고 일어서는 친구는 걸어가지 않고 곧바로 옮겨 그린다", () => {
  const room = CLASSROOM_ROOM;
  const seat = CLASSROOM_SEATS[8];
  const standing = { x: seat.stand.x, y: seat.stand.y, path: [], mode: 0, facing: "right", reading: false, room: "classroom", seat: null };
  const actor = plazaRemoteEnter(standing, 0, 0);
  assert.equal(actor.seat, null);
  // 앉음 — 의자는 걸어서 닿는 바닥이 아니므로 길을 찾지 않고 그 자리에
  plazaRemoteHear(actor, { ...standing, x: seat.sit.x, y: seat.sit.y, facing: "up", seat: 8 }, 100, room);
  assert.deepEqual({ x: actor.x, y: actor.y, queue: actor.queue.length, seat: actor.seat, facing: actor.facing }, { x: seat.sit.x, y: seat.sit.y, queue: 0, seat: 8, facing: "up" });
  // 일어섬 — 복도의 그 자리에 곧바로
  plazaRemoteHear(actor, standing, 200, room);
  assert.deepEqual({ x: actor.x, y: actor.y, queue: actor.queue.length, seat: actor.seat }, { x: seat.stand.x, y: seat.stand.y, queue: 0, seat: null });
  // 그 뒤로는 걸어간다 — 책상 줄을 가로지르지 않고 돌아서
  const across = CLASSROOM_SEATS[9].stand;
  plazaRemoteHear(actor, { ...standing, x: across.x, y: across.y }, 300, room);
  assert.ok(actor.queue.length >= 2, "책상 줄을 돌아가는 길");
  let from = { x: actor.x, y: actor.y };
  for (const point of actor.queue) { assert.equal(plazaClear(from, point, room), true); from = point; }
  // 처음 본 친구가 이미 앉아 있으면 그 자리에
  assert.equal(plazaRemoteEnter({ ...standing, x: seat.sit.x, y: seat.sit.y, seat: 8 }, 5000, 0).seat, 8);
});

test("흩어 서기 — 방마다 제 띠에(교실은 뒤쪽 · 책상 옆이 아닌 곳)", () => {
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const at = plazaSpawnFor(`학생-${i}`, CLASSROOM_ROOM);
    assert.equal(plazaWalkable(at.x, at.y, CLASSROOM_ROOM), true);
    assert.ok(at.y > 740, `교실 뒤쪽 ${at.y}`);
    assert.equal(plazaPortalAt(at, CLASSROOM_ROOM, 22), null, "포털 위에 서지 않는다");
    assert.equal(classroomSeatAround(at), null, "책상 옆에 서지 않는다");
    assert.deepEqual(plazaSpawnFor(`학생-${i}`, CLASSROOM_ROOM), at, "사람마다 늘 같은 자리");
    seen.add(`${at.x},${at.y}`);
    // 광장(문이 있든 없든)은 책꽂이와 분수 사이
    const out = plazaSpawnFor(`학생-${i}`, PLAZA_DOOR_ROOM);
    assert.deepEqual(out, plazaSpawnFor(`학생-${i}`), "문이 없는 광장과 같은 자리");
    assert.ok(out.y < 380);
  }
  assert.ok(seen.size > 30, "흩어진다");
});

test("펫 — 주인이 앉아 있는 동안은 그 책상의 러그 귀(가까운 쪽)에서 기다린다", () => {
  const room = CLASSROOM_ROOM;
  const seat = CLASSROOM_SEATS[8];
  const owner = { x: seat.sit.x, y: seat.sit.y, facing: "up" };
  // 주인을 따라 복도에 서 있다가 — 주인이 앉으면 기다릴 자리(러그의 귀)로 걸어간다(책상 줄 밖으로만)
  const pet = plazaPetStart({ x: seat.stand.x, y: seat.stand.y + 40 }, "down", room);
  for (let i = 0; i < 200; i += 1) {
    plazaPetFollow(pet, owner, 1 / 60, { room, stay: seat.pet });
    assert.equal(plazaWalkable(pet.x, pet.y, room), true, `펫이 바닥 밖으로 ${pet.x},${pet.y}`);
  }
  assert.ok(Math.hypot(pet.x - seat.pet.x, pet.y - seat.pet.y) < 2, "기다릴 자리에 섬");
  assert.equal(pet.facing, "up", "주인과 같은 쪽(칠판)을 본다");
  // 처음 본 친구가 이미 앉아 있으면 — 펫은 의자 옆 바닥에서 시작해 **가까운 쪽** 기다릴 자리로 간다
  // (책상이 한 줄씩이라 양옆이 모두 복도 — 반대쪽으로는 책상 줄에 막혀 못 가므로 무대는 늘 가까운 쪽을 고른다)
  for (const index of [0, 8, 17, 29]) {
    const at = CLASSROOM_SEATS[index];
    const sitter = { x: at.sit.x, y: at.sit.y, facing: "up" };
    const fresh = plazaPetStart(sitter, "up", room);
    const side = classroomSeatSide(index, fresh);
    for (let i = 0; i < 120; i += 1) plazaPetFollow(fresh, sitter, 1 / 60, { room, stay: side.pet });
    assert.ok(Math.hypot(fresh.x - side.pet.x, fresh.y - side.pet.y) < 2, `자리 ${index} — 가까운 쪽 기다릴 자리에 섬`);
    assert.equal(classroomNearSeat(fresh, index), true, "주인의 러그 위에서 기다린다");
  }
  // 바닥이 아닌 곳에서 시작하면(의자 자리) 기다릴 자리로 곧바로
  const lost = { ...plazaPetStart(owner, "up", room), x: seat.sit.x, y: seat.sit.y };
  plazaPetFollow(lost, owner, 1 / 60, { room, stay: seat.pet });
  assert.deepEqual({ x: lost.x, y: lost.y }, { x: seat.pet.x, y: seat.pet.y });
  // 주인이 일어서면 곁자리로 다시 온다
  const up = { x: seat.stand.x, y: seat.stand.y, facing: "right" };
  for (let i = 0; i < 200; i += 1) plazaPetFollow(pet, up, 1 / 60, { room });
  assert.ok(Math.hypot(pet.x - up.x, pet.y - up.y) < 70, "일어선 주인 곁");
  assert.equal(plazaWalkable(pet.x, pet.y, room), true);
});

test("앉아 있는 학생은 가만히 있어도 더 오래 이어 둔다(한 차시 남짓)", () => {
  assert.ok(PLAZA_LIVE_SEATED_IDLE_MS > PLAZA_LIVE_IDLE_MS);
  assert.ok(PLAZA_LIVE_SEATED_IDLE_MS >= 45 * 60 * 1000 && PLAZA_LIVE_SEATED_IDLE_MS <= 90 * 60 * 1000);
  // 그림의 크기는 세 방이 같다 — 시점 · 규칙(x 0~1672 · y 0~941)을 방마다 따로 두지 않는다
  assert.deepEqual([PLAZA_W, PLAZA_H], [1672, 941]);
});
