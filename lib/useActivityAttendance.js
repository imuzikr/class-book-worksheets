"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeClassStudyAttendance } from "./store";
import { activityAttendance } from "./groupMemberStatus";

export function useActivityAttendance(activity, roster, { enabled = true, classId = null } = {}) {
  const resolvedClassId = classId ?? activity?.classId ?? null;
  const createdAt = activity?.createdAt;
  const date = useMemo(() => activityAttendance({ createdAt }).date, [createdAt]);
  // 날짜·반·사용 여부가 바뀐 첫 렌더에서도 이전 구독의 기록을 쓰지 않습니다.
  // 같은 반으로 돌아와도 새 scope 객체이므로 오래된 응답이 다시 나타나지 않습니다.
  const scope = useMemo(
    () => enabled && resolvedClassId && date ? { classId: resolvedClassId, date } : null,
    [enabled, resolvedClassId, date]
  );
  const [attendance, setAttendance] = useState({ scope: null, records: [] });

  useEffect(() => {
    if (!scope) return undefined;
    let active = true;
    const unsubscribe = subscribeClassStudyAttendance(scope.classId, (records) => {
      if (active) setAttendance({ scope, records });
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [scope]);

  return useMemo(
    () => activityAttendance({ createdAt }, scope && attendance.scope === scope ? attendance.records : [], roster),
    [createdAt, roster, scope, attendance]
  );
}
