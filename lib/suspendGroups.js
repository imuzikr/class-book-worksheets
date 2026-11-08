// =============================================================
// 사용 중지 — 모둠에서 빼고(다시 사용하면 돌려놓음) 계산하는 순수 함수
// -------------------------------------------------------------
// · 독서 활동의 모둠(bookActivities/{aId}/groups/{gId}) — memberUids · members에서 빼고
//   suspendedUids · suspendedMembers로 옮깁니다. 규칙의 mateReadsEntry가 suspendedUids를
//   보아 모둠 친구가 그 학생의 글을 그대로 읽습니다. 혼자 쓰던 판(개별 활동)은 건드리지
//   않습니다(빼면 판이 빕니다).
// · 반의 기본 모둠(classes/{cId}/groupAssignments/default) — groups의 명단에서 빼고,
//   돌려놓을 자리를 suspendedPlacements에 적어 둡니다.
// 시험 tests/unit/suspendGroups.test.mjs.
// =============================================================
const list = (v) => (Array.isArray(v) ? v : []);
const memberOf = (members, uid) => list(members).find((m) => m?.uid === uid) || { uid };

/** 활동 모둠에서 뺄 때의 변경 — 뺄 것이 없거나 혼자 쓰던 판이면 null. */
export function suspendInGroup(group, uid) {
  const uids = list(group?.memberUids);
  if (!uids.includes(uid) || uids.length <= 1) return null;
  return {
    memberUids: uids.filter((x) => x !== uid),
    members: list(group.members).filter((m) => m?.uid !== uid),
    suspendedUids: [...list(group.suspendedUids).filter((x) => x !== uid), uid],
    suspendedMembers: [...list(group.suspendedMembers).filter((m) => m?.uid !== uid), memberOf(group.members, uid)],
  };
}

/** 다시 사용 — 옮겨 둔 학생을 모둠에 돌려놓는 변경. 없으면 null. */
export function resumeInGroup(group, uid) {
  if (!list(group?.suspendedUids).includes(uid)) return null;
  const uids = list(group.memberUids);
  const saved = list(group.suspendedMembers).find((m) => m?.uid === uid) || { uid };
  return {
    memberUids: uids.includes(uid) ? uids : [...uids, uid],
    members: list(group.members).some((m) => m?.uid === uid) ? list(group.members) : [...list(group.members), saved],
    suspendedUids: list(group.suspendedUids).filter((x) => x !== uid),
    suspendedMembers: list(group.suspendedMembers).filter((m) => m?.uid !== uid),
  };
}

/** 기본 모둠에서 뺄 때의 변경(문서 전체 groups + suspendedPlacements). 없으면 null. */
export function suspendInBase(doc, uid) {
  const groups = list(doc?.groups);
  const index = groups.findIndex((g) => list(g?.memberUids).includes(uid));
  if (index < 0) return null;
  const g = groups[index];
  return {
    groups: groups.map((x, i) => (i !== index ? x : {
      ...x,
      memberUids: list(x.memberUids).filter((u) => u !== uid),
      members: list(x.members).filter((m) => m?.uid !== uid),
    })),
    suspendedPlacements: [...list(doc.suspendedPlacements).filter((p) => p?.uid !== uid),
      { uid, groupIndex: index, member: memberOf(g.members, uid) }],
  };
}

/** 다시 사용 — 적어 둔 자리(그 모둠이 아직 있으면)로 돌려놓습니다. 없으면 null. */
export function resumeInBase(doc, uid) {
  const placement = list(doc?.suspendedPlacements).find((p) => p?.uid === uid);
  if (!placement) return null;
  const groups = list(doc.groups);
  const rest = list(doc.suspendedPlacements).filter((p) => p?.uid !== uid);
  const already = groups.some((g) => list(g?.memberUids).includes(uid));
  const index = placement.groupIndex;
  if (already || !(index >= 0 && index < groups.length)) return { groups, suspendedPlacements: rest };
  return {
    groups: groups.map((x, i) => (i !== index ? x : {
      ...x,
      memberUids: [...list(x.memberUids), uid],
      members: [...list(x.members), placement.member || { uid }],
    })),
    suspendedPlacements: rest,
  };
}
