// =============================================================
// 이름 맞추기의 셈(lib/data/nameSync.js) — 기록 한 장 · 모둠 명단에서 바꿀 이름표를
// 고릅니다. Firebase 없이 시험할 수 있게 따로 둡니다(tests/unit/nameFields.test.mjs).
// 규칙(isNameSync)이 받는 칸과 같아야 합니다: authorName · fromName · toName ·
// writerName · name · studentId.
// =============================================================

// 기록의 칸 → 그 칸이 가리키는 학생 칸
export const NAME_FIELDS = [
  ["authorName", "authorId"],
  ["fromName", "fromUid"],
  ["toName", "toUid"],
  ["writerName", "writerUid"],
  ["name", "uid"],
  ["authorName", "userId"], // KWLS 기록
];

// 한 기록에서 바꿀 칸만 고릅니다(같으면 빈 객체). withSid면 학번도 맞춥니다.
export function namePatchFor(data, uid, realName, studentId, { withSid = false } = {}) {
  const patch = {};
  if (!data || data.byTeacher || data.fromRole === "teacher") return patch;
  for (const [nameKey, uidKey] of NAME_FIELDS) {
    if (data[uidKey] === uid && nameKey in data && data[nameKey] !== realName && !(nameKey in patch)) patch[nameKey] = realName;
  }
  if (withSid && "studentId" in data && (data.authorId === uid || data.uid === uid) && (data.studentId ?? null) !== (studentId ?? null)) {
    patch.studentId = studentId ?? null;
  }
  return patch;
}

// 모둠 명단(members[])에서 그 학생의 이름 · 학번을 바꾼 새 배열 — 바꿀 것이 없으면 null
export function membersPatched(members, uid, realName, studentId) {
  if (!Array.isArray(members)) return null;
  let changed = false;
  const next = members.map((m) => {
    if (m?.uid !== uid) return m;
    const sid = studentId ?? null;
    if (m.name === realName && (m.studentId ?? null) === sid && (m.emoji ?? "🙂") === "🙂") return m;
    changed = true;
    return { ...m, name: realName, studentId: sid, emoji: "🙂" };
  });
  return changed ? next : null;
}

