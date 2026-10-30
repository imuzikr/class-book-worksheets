export const UNASSIGNED_GROUP_ID = "__none";

// 배정 당시 members 스냅샷 대신 지금 카드의 이름·작성 내용을 사용합니다.
// 구독 순서를 유지하며 한 학생은 먼저 만난 현재 모둠에만 놓습니다.
export function bookGroupRailGroups(groups = [], cards = []) {
  const cardsByUid = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    if (card?.uid && !cardsByUid.has(card.uid)) cardsByUid.set(card.uid, card);
  }

  const placedUids = new Set();
  const rail = [];
  for (const [index, group] of (Array.isArray(groups) ? groups : []).entries()) {
    if (!group || group.retired) continue;
    const memberUids = Array.isArray(group.memberUids)
      ? group.memberUids
      : (Array.isArray(group.members) ? group.members : []).map((member) => member?.uid);
    const members = [];
    for (const uid of memberUids) {
      if (!uid || placedUids.has(uid) || !cardsByUid.has(uid)) continue;
      members.push(cardsByUid.get(uid));
      placedUids.add(uid);
    }
    rail.push({
      id: group.id,
      name: group.groupName || `${group.groupIndex ?? index + 1}모둠`,
      members,
    });
  }

  const unassigned = [...cardsByUid.values()].filter((card) => !placedUids.has(card.uid));
  if (unassigned.length) {
    rail.push({ id: UNASSIGNED_GROUP_ID, name: "모둠 배정 대기", members: unassigned });
  }
  return rail;
}
