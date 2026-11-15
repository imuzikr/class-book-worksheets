import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSROOM_HIDEOUT_PORTAL, CLASSROOM_HIDEOUT_RETURN, CLASSROOM_HIDEOUT_ROOM, CLASSROOM_PORTAL, CLASSROOM_ROOM, CLASSROOM_SEATS,
  PLAZA_DOOR_ROOM, PLAZA_H, PLAZA_HIDEOUT_PORTAL, PLAZA_HIDEOUT_RETURN, PLAZA_HIDEOUT_ROOM, PLAZA_NEAR, PLAZA_PORTAL, PLAZA_ROOM, PLAZA_W, PORTAL_ART,
  plazaArrival, plazaClear, plazaPath, plazaPortalAt, plazaPortalClicked, plazaRoomOf, plazaSpotNear, plazaWalkable,
} from "../../lib/readingPlazaMap.js";
import { classroomSeatAround } from "../../lib/readingClassroom.js";

function assertRoute(from, to, room) {
  const route = plazaPath(from, to, room);
  assert.ok(route.length, `길 없음: ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  let previous = from;
  for (const point of route) {
    assert.equal(plazaClear(previous, point, room), true, `장애물을 통과함: ${JSON.stringify(previous)} → ${JSON.stringify(point)}`);
    previous = point;
  }
  assert.ok(Math.hypot(previous.x - to.x, previous.y - to.y) < 1, "목적지까지 걸어감");
}

test("개인 아지트 입구 — 교실과 아지트가 모두 켜진 교실·광장 변형에만 나타남", () => {
  assert.equal(plazaRoomOf("classroom", true, true), CLASSROOM_HIDEOUT_ROOM);
  assert.equal(plazaRoomOf("classroom", true, false), CLASSROOM_ROOM);
  assert.equal(plazaRoomOf("classroom", true), CLASSROOM_ROOM);
  assert.equal(plazaRoomOf("classroom", false, true), PLAZA_ROOM);
  assert.equal(plazaRoomOf("plaza", true, true), PLAZA_HIDEOUT_ROOM);
  assert.equal(plazaRoomOf("plaza", true, false), PLAZA_DOOR_ROOM);
  assert.equal(plazaRoomOf("plaza", true), PLAZA_DOOR_ROOM);
  assert.equal(plazaRoomOf("plaza", false, true), PLAZA_ROOM);
  assert.deepEqual(PLAZA_ROOM.portals, [], "교실을 끄면 광장 아지트 포털도 없음");
  assert.deepEqual(PLAZA_DOOR_ROOM.portals.map((gate) => gate.to), ["classroom"], "아지트를 끄면 교실 포털만 남음");
  assert.deepEqual(PLAZA_HIDEOUT_ROOM.portals.map((gate) => gate.to), ["classroom", "hideout"]);
  assert.deepEqual(CLASSROOM_ROOM.portals.map((gate) => gate.to), ["plaza"], "기본 공용 교실은 바뀌지 않음");
  assert.deepEqual(CLASSROOM_HIDEOUT_ROOM.portals.map((gate) => gate.to), ["plaza", "hideout"]);
  assert.equal(CLASSROOM_HIDEOUT_ROOM.id, "classroom", "개인 방을 공용 실시간 방에 추가하지 않음");
  assert.equal(PLAZA_HIDEOUT_ROOM.id, "plaza", "광장 아지트 입구도 공용 실시간 방을 추가하지 않음");
  assert.equal(Object.isFrozen(CLASSROOM_HIDEOUT_ROOM.portals), true);
});

test("광장 — 문 없는 배경의 왼쪽 아래는 교실 포털, 책꽂이 오른쪽 빈 가장자리는 아지트 포털", () => {
  const room = PLAZA_HIDEOUT_ROOM;
  const classroomGate = room.portals.find((gate) => gate.to === "classroom");
  const hideoutGate = room.portals.find((gate) => gate.to === "hideout");
  assert.equal(room.art, "/reading-plaza/plaza.webp");
  assert.deepEqual(room.floor, PLAZA_ROOM.floor, "사라진 문의 장애물도 제거");
  assert.deepEqual(room.spots, PLAZA_ROOM.spots, "둘째 가판대 앞을 포함해 원래 클릭 영역과 서는 위치 복원");
  assert.deepEqual({ x: classroomGate.x, y: classroomGate.y }, PLAZA_PORTAL);
  assert.deepEqual({ x: hideoutGate.x, y: hideoutGate.y }, PLAZA_HIDEOUT_PORTAL);
  assert.ok(classroomGate.x < PLAZA_W / 4 && classroomGate.y > PLAZA_H * .8, "교실은 왼쪽 아래");
  assert.ok(hideoutGate.x > PLAZA_W * .7 && hideoutGate.y < PLAZA_H / 3, "아지트는 오른쪽 위");
  assert.ok(hideoutGate.art.x - hideoutGate.art.w / 2 >= 1125 && hideoutGate.art.y - hideoutGate.art.h / 2 > 205, "책꽂이 앞면에 포털을 겹치지 않음");
  for (const gate of [classroomGate, hideoutGate]) {
    assert.equal(plazaWalkable(gate.x, gate.y, room), true);
    assert.equal(plazaSpotNear(gate, PLAZA_NEAR, room), null, "도착 즉시 책꽂이·가판대 상호작용이 뜨지 않음");
    assertRoute(room.spawn, gate, room);
    for (const spot of room.spots) assertRoute(spot.stand, gate, room);
    // 그림의 실제 금빛 테 전체가 걷는 마당 안에 있어 가장자리로 다가가도 화단을 밟지 않는다.
    for (let degree = 0; degree < 360; degree += 1) {
      const angle = degree * Math.PI / 180;
      assert.equal(plazaWalkable(gate.x + Math.cos(angle) * gate.ring.rx, gate.y + Math.sin(angle) * gate.ring.ry, room), true, `${gate.id} 금빛 테 ${degree}도`);
    }
  }
  assertRoute(classroomGate, hideoutGate, room);
  assertRoute(hideoutGate, classroomGate, room);
  assert.equal(plazaPortalAt(room.spawn, room, 22), null, "광장 처음 위치는 어느 포털도 아님");
});

test("광장 — 포털의 보이는 테만 눌리며 옛 문과 옛 포털 위치에는 보이지 않는 클릭 상자가 없다", () => {
  const room = PLAZA_HIDEOUT_ROOM;
  for (const gate of room.portals) {
    assert.equal(gate.rect, null, "문 그림이 없는 바닥 포털은 별도 사각형 클릭 영역 없음");
    assert.equal(plazaPortalAt(gate, room)?.id, gate.id);
    assert.equal(plazaPortalClicked(gate.x + gate.ring.rx - 1, gate.y, room)?.id, gate.id);
    assert.equal(plazaPortalClicked(gate.x + gate.ring.rx + 1, gate.y, room), null);
    assert.equal(plazaPortalClicked(gate.x, gate.y - gate.ring.ry - 1, room), null);
  }
  for (const [x, y] of [[169, 720], [180, 740], [254, 650], [382, 823]]) {
    assert.equal(plazaWalkable(x, y, room), true, `빈 마당 ${x},${y}`);
    assert.equal(plazaPortalClicked(x, y, room), null, `옛 문·포털 ${x},${y}`);
  }
  assert.equal(plazaPortalAt(PLAZA_HIDEOUT_PORTAL, PLAZA_DOOR_ROOM), null, "아지트를 끄면 그 자리는 빈 바닥");
  assert.equal(plazaPortalClicked(PLAZA_HIDEOUT_PORTAL.x, PLAZA_HIDEOUT_PORTAL.y, PLAZA_DOOR_ROOM), null);
});

test("아지트에서 광장으로 돌아오면 원래 광장의 포털 아래 안전한 바닥에 선다", () => {
  for (const room of [PLAZA_HIDEOUT_ROOM, PLAZA_DOOR_ROOM, PLAZA_ROOM]) {
    const arrival = plazaArrival(room, "hideout");
    assert.deepEqual(arrival, PLAZA_HIDEOUT_RETURN);
    assert.notEqual(arrival, PLAZA_HIDEOUT_RETURN, "공유 상수를 수정하지 않는 새 좌표");
    assert.equal(plazaWalkable(arrival.x, arrival.y, room), true);
    assert.equal(plazaPortalAt(arrival, room, 22), null, "재진입 여유 타원 밖");
    assert.equal(plazaSpotNear(arrival, PLAZA_NEAR, room), null, "귀환 위치에서 가판대·책꽂이 메뉴가 열리지 않음");
    assertRoute(arrival, room.spawn, room);
    for (const spot of room.spots) assertRoute(arrival, spot.stand, room);
  }
  assertRoute(PLAZA_HIDEOUT_RETURN, PLAZA_HIDEOUT_PORTAL, PLAZA_HIDEOUT_ROOM);
  assertRoute(PLAZA_HIDEOUT_RETURN, PLAZA_PORTAL, PLAZA_HIDEOUT_ROOM);
  assert.deepEqual(plazaArrival(PLAZA_HIDEOUT_ROOM, "classroom"), PLAZA_PORTAL, "교실에서는 왼쪽 아래 교실 포털로 도착");
});

test("교실 왼쪽은 광장 · 오른쪽은 아지트 — 바닥 위, 책상 자리에서 떨어져 있고 모든 자리에서 도달", () => {
  const room = CLASSROOM_HIDEOUT_ROOM;
  const gate = room.portals.find((entry) => entry.to === "hideout");
  const plazaGate = room.portals.find((entry) => entry.to === "plaza");
  assert.deepEqual({ x: gate.x, y: gate.y }, CLASSROOM_HIDEOUT_PORTAL);
  assert.deepEqual({ x: plazaGate.x, y: plazaGate.y }, CLASSROOM_PORTAL);
  assert.ok(plazaGate.x < PLAZA_W / 4 && plazaGate.y > PLAZA_H * 0.8, "왼쪽 아래는 광장");
  assert.ok(gate.x > PLAZA_W * 0.75 && gate.y > PLAZA_H * 0.8, "오른쪽 아래는 아지트");
  assert.ok(Math.hypot(gate.x - CLASSROOM_PORTAL.x, gate.y - CLASSROOM_PORTAL.y) > 1000);
  for (const portal of [plazaGate, gate]) {
    assert.equal(plazaWalkable(portal.x, portal.y, room), true);
    assert.equal(classroomSeatAround(portal), null, "의자 상호작용 범위와 겹치지 않음");
    assertRoute(room.spawn, portal, room);
    for (const seat of CLASSROOM_SEATS) {
      for (const side of seat.sides) assertRoute(side.stand, portal, room);
    }
  }
  assertRoute(CLASSROOM_HIDEOUT_RETURN, CLASSROOM_PORTAL, room);
});

test("아지트 포털의 클릭과 발 판정은 같은 분리 그림과 위치를 사용", () => {
  const room = CLASSROOM_HIDEOUT_ROOM;
  const gate = room.portals.find((entry) => entry.to === "hideout");
  assert.equal(plazaPortalAt(gate, room)?.id, "to-hideout");
  assert.equal(plazaPortalClicked(gate.x + 70, gate.y, room)?.id, "to-hideout", "금빛 테 클릭");
  assert.equal(plazaPortalClicked(gate.x + 100, gate.y, room), null, "포털과 문 사이 맨바닥은 아지트 입구 아님");
  assert.equal(plazaPortalClicked(1640, 800, room)?.id, "to-hideout", "오른쪽 문 클릭도 아지트로");
  assert.equal(plazaPortalClicked(295, 903, room)?.id, "to-plaza", "왼쪽 입구 누름 영역은 광장으로");
  assert.equal(plazaPortalAt(CLASSROOM_PORTAL, room)?.id, "to-plaza");
  assert.equal(plazaPortalAt(gate, CLASSROOM_ROOM), null, "끄면 기존 좌표를 밟아도 들어가지 않음");
  assert.equal(plazaPortalClicked(gate.x, gate.y, CLASSROOM_ROOM), null);
  assert.equal(plazaPortalClicked(1640, 800, CLASSROOM_ROOM), null, "아지트를 끄면 오른쪽 문도 작동하지 않음");
  assert.equal(plazaPortalClicked(CLASSROOM_PORTAL.x, CLASSROOM_PORTAL.y, CLASSROOM_ROOM)?.id, "to-plaza", "아지트를 꺼도 왼쪽 광장 포털은 유지");
  assert.equal(gate.art.w, PORTAL_ART.w);
  assert.equal(gate.art.h, PORTAL_ART.h);
  assert.ok(gate.art.x - gate.art.w / 2 > 0 && gate.art.x + gate.art.w / 2 < PLAZA_W);
  assert.ok(gate.art.y + gate.art.h / 2 < PLAZA_H);
});

test("아지트에서 교실로 돌아오면 포털 밖 안전한 바닥에 서서 다시 빨려 들어가지 않음", () => {
  for (const room of [CLASSROOM_ROOM, CLASSROOM_HIDEOUT_ROOM]) {
    const arrival = plazaArrival(room, "hideout");
    assert.deepEqual(arrival, CLASSROOM_HIDEOUT_RETURN);
    assert.notEqual(arrival, CLASSROOM_HIDEOUT_RETURN, "공유 상수를 수정하지 않는 새 좌표");
    assert.equal(plazaWalkable(arrival.x, arrival.y, room), true);
    assert.equal(plazaPortalAt(arrival, room, 22), null, "재진입 여유 타원 밖");
    assert.equal(classroomSeatAround(arrival), null, "자동으로 의자에 앉을 자리 아님");
    assert.ok(arrival.x > PLAZA_W / 2 && arrival.x < CLASSROOM_HIDEOUT_PORTAL.x, "오른쪽 아지트 포털의 안쪽 바닥으로 귀환");
    assertRoute(arrival, room.spawn, room);
  }
  assertRoute(CLASSROOM_HIDEOUT_RETURN, CLASSROOM_HIDEOUT_PORTAL, CLASSROOM_HIDEOUT_ROOM);
  assert.deepEqual(plazaArrival(CLASSROOM_ROOM, "plaza"), CLASSROOM_PORTAL, "광장에서는 새 왼쪽 포털로 도착");
});
