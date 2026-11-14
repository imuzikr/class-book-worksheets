import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSROOM_HIDEOUT_PORTAL, CLASSROOM_HIDEOUT_RETURN, CLASSROOM_HIDEOUT_ROOM, CLASSROOM_PORTAL, CLASSROOM_ROOM, CLASSROOM_SEATS,
  PLAZA_DOOR_ROOM, PLAZA_H, PLAZA_ROOM, PLAZA_W, PORTAL_ART,
  plazaArrival, plazaClear, plazaPath, plazaPortalAt, plazaPortalClicked, plazaRoomOf, plazaWalkable,
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

test("개인 아지트 입구 — 교실과 아지트가 모두 켜진 교실 변형에만 나타남", () => {
  assert.equal(plazaRoomOf("classroom", true, true), CLASSROOM_HIDEOUT_ROOM);
  assert.equal(plazaRoomOf("classroom", true, false), CLASSROOM_ROOM);
  assert.equal(plazaRoomOf("classroom", true), CLASSROOM_ROOM);
  assert.equal(plazaRoomOf("classroom", false, true), PLAZA_ROOM);
  assert.equal(plazaRoomOf("plaza", true, true), PLAZA_DOOR_ROOM);
  assert.deepEqual(CLASSROOM_ROOM.portals.map((gate) => gate.to), ["plaza"], "기본 공용 교실은 바뀌지 않음");
  assert.deepEqual(CLASSROOM_HIDEOUT_ROOM.portals.map((gate) => gate.to), ["plaza", "hideout"]);
  assert.equal(CLASSROOM_HIDEOUT_ROOM.id, "classroom", "개인 방을 공용 실시간 방에 추가하지 않음");
  assert.equal(Object.isFrozen(CLASSROOM_HIDEOUT_ROOM.portals), true);
});

test("교실 왼쪽 아래 포털 — 바닥 위, 책상 자리와 광장 입구에서 떨어져 있고 모든 자리에서 도달", () => {
  const room = CLASSROOM_HIDEOUT_ROOM;
  const gate = room.portals.find((entry) => entry.to === "hideout");
  assert.deepEqual({ x: gate.x, y: gate.y }, CLASSROOM_HIDEOUT_PORTAL);
  assert.ok(gate.x < PLAZA_W / 4 && gate.y > PLAZA_H * 0.8, "왼쪽 아래 구석");
  assert.equal(plazaWalkable(gate.x, gate.y, room), true);
  assert.equal(classroomSeatAround(gate), null, "의자 상호작용 범위와 겹치지 않음");
  assert.ok(Math.hypot(gate.x - CLASSROOM_PORTAL.x, gate.y - CLASSROOM_PORTAL.y) > 1000);
  assertRoute(room.spawn, gate, room);
  for (const seat of CLASSROOM_SEATS) {
    for (const side of seat.sides) assertRoute(side.stand, gate, room);
  }
  assertRoute(CLASSROOM_HIDEOUT_RETURN, CLASSROOM_PORTAL, room);
});

test("아지트 포털의 클릭과 발 판정은 같은 분리 그림과 위치를 사용", () => {
  const room = CLASSROOM_HIDEOUT_ROOM;
  const gate = room.portals.find((entry) => entry.to === "hideout");
  assert.equal(plazaPortalAt(gate, room)?.id, "to-hideout");
  assert.equal(plazaPortalClicked(gate.x + 100, gate.y, room)?.id, "to-hideout");
  assert.equal(plazaPortalClicked(295, 903, room)?.id, "to-hideout", "가장자리의 별도 누름 영역");
  assert.equal(plazaPortalAt(gate, CLASSROOM_ROOM), null, "끄면 기존 좌표를 밟아도 들어가지 않음");
  assert.equal(plazaPortalClicked(gate.x, gate.y, CLASSROOM_ROOM), null);
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
    assertRoute(arrival, room.spawn, room);
  }
  assertRoute(CLASSROOM_HIDEOUT_RETURN, CLASSROOM_HIDEOUT_PORTAL, CLASSROOM_HIDEOUT_ROOM);
  assert.deepEqual(plazaArrival(CLASSROOM_ROOM, "plaza"), CLASSROOM_PORTAL, "기존 광장 왕복은 그대로");
});
