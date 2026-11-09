// =============================================================
// 반에서 빼기 — 모둠 · 자리표에서 학생 한 명을 빼는 셈(순수 함수)
// -------------------------------------------------------------
// 학생 프로필 창의 '이 반에서 빼기'(lib/data/removeFromClass.js)와 학생 탈퇴
// (lib/data/withdraw.js)가 함께 씁니다 — 두 곳이 따로 세면 한쪽만 고쳤을 때
// 같은 모둠이 화면마다 다르게 남습니다. 시험 tests/unit/removeFromClass.test.mjs.
//   · 기본 모둠(classes/{cId}/groupAssignments/default) — groups의 명단에서 빼고,
//     사용 중지 때 적어 둔 돌려놓을 자리(suspendedPlacements)도 지웁니다(다시 사용해도
//     이 반 모둠으로 돌아오지 않게 — lib/suspendGroups.js의 resumeInBase).
//   · 독서 활동 모둠(bookActivities/{aId}/groups/{gId}) — memberUids · members와 사용
//     중지로 옮겨 둔 suspendedUids · suspendedMembers에서 뺍니다. **혼자 쓰던 판(개별
//     활동)은 건드리지 않습니다** — 그 학생의 기록이라, 빼면 판만 비고 다시 들어왔을 때
//     이어 쓸 판이 없습니다(탈퇴는 이 판을 따로 통째로 지웁니다).
//   · 자리표(classes/{cId}/seatLayouts/*) — 그 자리를 빈자리(null)로. 다른 자리는 그대로.
// =============================================================
const list = (v) => (Array.isArray(v) ? v : []);
const hasUid = (members, uid) => list(members).some((m) => m?.uid === uid);

/** 기본 모둠 문서에서 뺄 때의 변경 { groups, suspendedPlacements? } — 뺄 것이 없으면 null. */
export function baseGroupsWithout(doc, uid) {
  if (!uid) return null;
  const groups = list(doc?.groups);
  const placed = list(doc?.suspendedPlacements);
  const inGroup = (g) => list(g?.memberUids).includes(uid) || hasUid(g?.members, uid);
  const inPlaced = placed.some((p) => p?.uid === uid);
  if (!groups.some(inGroup) && !inPlaced) return null;
  const patch = {
    groups: groups.map((g) => (!inGroup(g) ? g : {
      ...g,
      memberUids: list(g.memberUids).filter((x) => x !== uid),
      members: list(g.members).filter((m) => m?.uid !== uid),
    })),
  };
  if (inPlaced) patch.suspendedPlacements = placed.filter((p) => p?.uid !== uid);
  return patch;
}

/** 독서 활동 모둠에서 뺄 때의 변경 — 뺄 것이 없거나 혼자 쓰던 판이면 null. */
export function activityGroupWithout(group, uid) {
  if (!uid) return null;
  const uids = list(group?.memberUids);
  const susp = list(group?.suspendedUids);
  const inMembers = uids.includes(uid) || hasUid(group?.members, uid);
  const inSuspended = susp.includes(uid) || hasUid(group?.suspendedMembers, uid);
  if (!inMembers && !inSuspended) return null;
  // 혼자 쓰던 판 — 그 학생의 기록이라 그대로 둡니다
  if (uids.length === 1 && uids[0] === uid) return null;
  const patch = {};
  if (inMembers) {
    patch.memberUids = uids.filter((x) => x !== uid);
    patch.members = list(group.members).filter((m) => m?.uid !== uid);
  }
  if (inSuspended) {
    patch.suspendedUids = susp.filter((x) => x !== uid);
    patch.suspendedMembers = list(group.suspendedMembers).filter((m) => m?.uid !== uid);
  }
  return patch;
}

/** 자리표에서 그 학생의 자리를 비운 새 배열 — 앉아 있지 않으면 null. */
export function seatsWithout(seats, uid) {
  if (!uid || !Array.isArray(seats) || !seats.includes(uid)) return null;
  return seats.map((x) => (x === uid ? null : x));
}
