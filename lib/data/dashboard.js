// One API boundary for authenticated dashboards and the fictional classroom.
import { auth, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin, isTeacher } from "../user";
import { readingEnabled } from "../reading";
import { buildDashboardData } from "../dashboard";
import { mock } from "./shared";
import { buildMockDirectory } from "./users";
import { fetchClass, setDemoDashboardSemester } from "./classes";
import { demoReadingStatesForDashboard } from "./reading";

function failure(message, code = "dashboard/forbidden") {
  return Object.assign(new Error(message), { code });
}

async function request(options, body) {
  const current = auth?.currentUser;
  if (!current) throw failure("로그인을 다시 확인해 주세요.", "dashboard/unauthenticated");
  const token = await current.getIdToken();
  const query = new URLSearchParams();
  for (const key of ["classId", "activityId", "period", "start", "end"]) {
    if (options[key]) query.set(key, options[key]);
  }
  const response = await fetch(`/api/dashboard${body ? "" : `?${query}`}`, {
    method: body ? "POST" : "GET", cache: "no-store", signal: options.signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw failure(result.error || "대시보드를 불러오지 못했어요.", result.code);
  return result;
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException("요청이 취소되었습니다.", "AbortError");
}

export async function fetchDashboard(options = {}) {
  if (isFirebaseConfigured) return request(options);
  abortIfNeeded(options.signal);
  if (["uid", "userId", "studentUid"].some((key) => options[key] != null)) {
    throw failure("다른 학생을 지정해 조회할 수 없습니다.", "dashboard/invalid-target");
  }
  const user = getCurrentUser();
  const classDoc = await fetchClass(options.classId);
  if (!user?.uid || !classDoc || classDoc.archived) throw failure("선택한 반을 확인해 주세요.");
  const teacher = isTeacher(user);
  const memberUids = [...new Set((mock.memberships ?? []).filter((m) => m.classId === classDoc.id).map((m) => m.uid))];
  if (teacher ? !isAdmin(user) && classDoc.createdBy !== user.uid : !memberUids.includes(user.uid)) {
    throw failure("이 반의 대시보드를 볼 권한이 없어요.");
  }
  const directory = new Map(buildMockDirectory().map((p) => [p.uid, p]));
  const roster = (teacher ? memberUids : [user.uid]).map((uid) => {
    const p = uid === user.uid ? user : directory.get(uid);
    if (!p || isTeacher(p)) return null;
    return { uid, name: p.realName || p.studentId || "이름 미설정", studentId: p.studentId || "", emoji: p.emoji || "🙂" };
  }).filter(Boolean);
  const time = (value) => value?.toDate ? value.toDate().getTime() : new Date(value || 0).getTime() || 0;
  const activities = (mock.bookActivities ?? []).filter((a) => a.classId === classDoc.id && !a.deleted)
    .slice().sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id));
  if (options.activityId && !activities.some((a) => a.id === options.activityId)) {
    throw failure("이 반의 독서 활동을 선택해 주세요.", "dashboard/activity-not-found");
  }
  const selected = activities.find((a) => a.id === options.activityId) ?? activities.at(-1);
  const ids = new Set((teacher ? selected ? [selected] : [] : activities).map((a) => a.id));
  const groups = (mock.bookGroups ?? []).filter((g) => ids.has(g.activityId) && !g.retired);
  const myGroupKeys = new Set(groups.filter((g) => (g.memberUids ?? g.members?.map((m) => m.uid) ?? []).includes(user.uid))
    .map((g) => `${g.activityId}:${g.id}`));
  const belongs = (row) => ids.has(row.activityId);
  const mine = (row) => (row.authorId || row.userId || row.uid || row.id) === user.uid;
  const records = { bookGroups: teacher ? groups : groups.filter((g) => myGroupKeys.has(`${g.activityId}:${g.id}`)) };
  for (const key of ["bookWords", "bookEntries", "bookPeerReviews", "bookOpinionNotes", "bookHashtagPosts", "bookHashtagComments", "bookXwHints", "bookXwBoards", "bookXwSolves", "bookXwProgress", "bookBwNotes"]) {
    records[key] = (mock[key] ?? []).filter((row) => {
      if (!belongs(row)) return false;
      if (teacher) return true;
      if (key === "bookPeerReviews") return row.fromUid === user.uid || row.toUid === user.uid;
      if (key === "bookHashtagComments") return row.postUid === user.uid || row.authorId === user.uid;
      if (key === "bookBwNotes") return myGroupKeys.has(`${row.activityId}:${row.groupId}`) && row.writerUid === user.uid;
      if (key.startsWith("bookXw")) return myGroupKeys.has(`${row.activityId}:${row.groupId}`);
      if (key === "bookWords") return myGroupKeys.has(`${row.activityId}:${row.groupId}`) && mine(row);
      return mine(row);
    }).map((row) => structuredClone(row));
  }
  const classActivityIds = new Set(activities.map((a) => a.id));
  records.kwl = (mock.kwl ?? []).filter((row) => row.classId === classDoc.id && classActivityIds.has(row.activityId)
    && (teacher || row.userId === user.uid)).map((row) => structuredClone(row));
  abortIfNeeded(options.signal);
  return buildDashboardData({ role: teacher ? "teacher" : "student", uid: user.uid,
    classDoc, roster, memberUids, activities, selectedActivityId: selected?.id, records,
    readingStates: readingEnabled(classDoc) ? demoReadingStatesForDashboard(roster.map((p) => p.uid)) : {},
    now: new Date(),
  }, options);
}

export async function saveDashboardSemester({ classId, start, end, signal } = {}) {
  if (isFirebaseConfigured) return request({ signal }, { classId, start, end });
  abortIfNeeded(signal);
  await setDemoDashboardSemester(classId, start, end);
  return { classId, semesterStart: start, semesterEnd: end };
}
