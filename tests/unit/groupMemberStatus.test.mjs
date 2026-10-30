import { test } from "node:test";
import assert from "node:assert/strict";
import { activityAttendance, groupMemberStatus } from "@/lib/groupMemberStatus";

const activity = { createdAt: new Date(2026, 8, 25, 14, 30) };
const roster = [{ uid: "present" }, { uid: "absent" }];

test("모둠원 완료·진행 중·미시작을 구분하며 완료는 시작 여부보다 우선한다", () => {
  assert.deepEqual(groupMemberStatus(), { key: "empty", label: "미시작", progressLabel: "미시작" });
  assert.deepEqual(groupMemberStatus({ started: true }), { key: "doing", label: "진행 중", progressLabel: "진행 중" });
  assert.deepEqual(groupMemberStatus({ done: true, started: false }), { key: "done", label: "완료", progressLabel: "완료" });
});

test("결석은 완료·진행·미배정보다 우선하지만 실제 작성 상태를 남긴다", () => {
  for (const [progress, progressLabel] of [[{}, "미시작"], [{ started: true }, "진행 중"], [{ done: true }, "완료"]]) {
    assert.deepEqual(groupMemberStatus({ ...progress, absent: true, unassigned: true }), {
      key: "absent", label: "결석", progressLabel,
    });
  }
  assert.deepEqual(groupMemberStatus({ unassigned: true }), {
    key: "unassigned", label: "모둠 배정 대기", progressLabel: "미시작",
  });
});

test("활동 생성일의 현재 명단 출석으로만 결석을 판단한다", () => {
  const result = activityAttendance(activity, [
    { date: "2026-09-25", uid: "present" },
    { date: "2026-09-25", uid: "present" },
    { date: "2026-09-24", uid: "absent" },
    { date: "2026-09-25", uid: "former-student" },
  ], roster);
  assert.equal(result.date, "2026-09-25");
  assert.equal(result.known, true);
  assert.deepEqual([...result.absentUids], ["absent"]);
});

test("출석 기록이 없거나 다른 날짜·명단 밖 기록뿐이면 모두를 결석으로 만들지 않는다", () => {
  for (const records of [undefined, null, [], [{ date: "2026-09-24", uid: "present" }], [{ date: "2026-09-25", uid: "former-student" }]]) {
    const result = activityAttendance(activity, records, roster);
    assert.equal(result.known, false);
    assert.equal(result.absentUids.size, 0);
  }
  assert.equal(activityAttendance(activity, [{ date: "2026-09-25", uid: "present" }], []).known, false);
});

test("서버 Timestamp의 날짜를 쓰며 없는 날짜·잘못된 날짜에는 결석을 판단하지 않는다", () => {
  const records = [{ date: "2026-09-25", uid: "present" }];
  assert.equal(activityAttendance({ createdAt: { toDate: () => new Date(2026, 8, 25) } }, records, roster).known, true);
  for (const value of [undefined, null, "", "invalid", new Date(NaN), { toDate: () => { throw new Error("invalid timestamp"); } }, { toDate: () => null }]) {
    const result = activityAttendance({ createdAt: value }, records, roster);
    assert.equal(result.date, null);
    assert.equal(result.known, false);
    assert.equal(result.absentUids.size, 0);
  }
});

test("빠진 uid는 제외하고 원본 명단·기록은 바꾸지 않는다", () => {
  const students = Object.freeze([Object.freeze({ uid: "present" }), Object.freeze({ uid: "absent" }), null, Object.freeze({})]);
  const records = Object.freeze([Object.freeze({ date: "2026-09-25", uid: "present" }), null, Object.freeze({ date: "2026-09-25" })]);
  assert.deepEqual([...activityAttendance(activity, records, students).absentUids], ["absent"]);
});
