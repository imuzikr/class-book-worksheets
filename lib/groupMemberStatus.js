import { toDate, todayDateKey } from "./dates";

// 결석·미배정 여부와 실제 작성 상태를 함께 보관합니다. 결석으로 표시해도
// 이미 작성한 내용은 제목 등에서 설명할 수 있도록 progressLabel을 남깁니다.
export function groupMemberStatus({ done = false, started = false, absent = false, unassigned = false } = {}) {
  const progressKey = done ? "done" : started ? "doing" : "empty";
  const progressLabel = done ? "완료" : started ? "진행 중" : "미시작";
  if (absent) return { key: "absent", label: "결석", progressLabel };
  if (unassigned) return { key: "unassigned", label: "모둠 배정 대기", progressLabel };
  return { key: progressKey, label: progressLabel, progressLabel };
}

// 출석은 활동을 연 날을 기준으로 봅니다. 날짜가 없거나 읽을 수 없을 때는
// 오늘로 바꾸지 않습니다 — 지난 활동에 오늘의 결석을 붙일 수 있기 때문입니다.
function activityDate(activity) {
  if (!activity?.createdAt) return null;
  try {
    const date = toDate(activity.createdAt);
    return date instanceof Date && !Number.isNaN(date.getTime()) ? todayDateKey(date) : null;
  } catch {
    return null;
  }
}

// 그날 현재 반 학생의 출석이 한 건이라도 있어야 결석 여부를 판단합니다.
// 다른 반으로 간 학생의 기록만 남아 있으면 현재 반 전체를 결석으로 칠하지 않습니다.
export function activityAttendance(activity, records = [], roster = []) {
  const date = activityDate(activity);
  const absentUids = new Set();
  if (!date) return { date, known: false, absentUids };

  const rosterUids = new Set((roster ?? []).map((student) => student?.uid).filter(Boolean));
  const presentUids = new Set();
  (records ?? []).forEach((record) => {
    if (record?.date === date && rosterUids.has(record.uid)) presentUids.add(record.uid);
  });
  const known = presentUids.size > 0;
  if (known) {
    rosterUids.forEach((uid) => { if (!presentUids.has(uid)) absentUids.add(uid); });
  }
  return { date, known, absentUids };
}
