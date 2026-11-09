// One API boundary for authenticated dashboards and the fictional classroom.
import { auth, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin, isTeacher } from "../user";
import { readingEnabled } from "../reading";
import { buildDashboardData, dashboardPeriod } from "../dashboard";
import { overallDashboardData, scopedTeacherPersonalDashboard } from "../dashboardReports";
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
  for (const key of ["classId", "activityId", "period", "start", "end", "view", "studentUid"]) {
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

// 분석 리포트 — 같은 보기(반 · 탭 · 학생 · 활동 · 기간)를 다시 열면 이 탭에서 기억해 둔 것을 씁니다(5분).
// 서버가 한 번에 많게는 6,500건을 읽는 보고서라(lib/server/dashboardService.js의 MAX_DOCUMENTS) 탭 · 반 ·
// 학생을 오갈 때마다 처음부터 다시 읽지 않게. 화면의 '새로고침' · '다시 시도' · 고친 뒤에는 cacheTag(화면의
// refresh 횟수)가 바뀌어 새로 받습니다. 한 번 시작한 요청은 화면을 옮겨도 끝까지 받아 기억합니다 — 끊어도
// 서버는 이미 읽고 있어 아낄 것이 없고, 돌아오면 곧바로 보입니다. 기억은 로그인한 사람마다 따로입니다.
// 한때 탭 · 학생을 바꿀 때마다(돌아갈 때도) 처음부터 다시 읽었습니다.
const REPORT_TTL = 5 * 60 * 1000;
const REPORT_MAX = 40;
const REPORT_KEYS = ["view", "classId", "activityId", "period", "start", "end", "studentUid"];
const reports = new Map(); // key → { at, promise }
function cachedReport(options) {
  const key = JSON.stringify([auth?.currentUser?.uid || "", options.cacheTag ?? 0, ...REPORT_KEYS.map((k) => options[k] || null)]);
  const hit = reports.get(key);
  if (hit && Date.now() - hit.at < REPORT_TTL) return hit.promise;
  const promise = request({ ...options, signal: undefined });
  reports.set(key, { at: Date.now(), promise });
  promise.catch(() => { if (reports.get(key)?.promise === promise) reports.delete(key); });
  while (reports.size > REPORT_MAX) reports.delete(reports.keys().next().value);
  return promise;
}
// 부른 화면이 그 사이 떠났으면(취소) 그 화면에만 취소로 알립니다 — 요청 자체는 위처럼 끝까지 받습니다.
function untilAborted(promise, signal) {
  abortIfNeeded(signal);
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); }
    );
  });
}

function demoClassDashboard({ options, user, classDoc, directory, now }) {
  const teacher = isTeacher(user);
  const memberUids = [...new Set((mock.memberships ?? []).filter((m) => m.classId === classDoc.id).map((m) => m.uid))];
  if (teacher ? !isAdmin(user) && classDoc.createdBy !== user.uid : !memberUids.includes(user.uid)) {
    throw failure("이 반의 대시보드를 볼 권한이 없어요.");
  }
  const classRoster = (teacher ? memberUids : [user.uid]).map((uid) => {
    const p = uid === user.uid ? user : directory.get(uid);
    if (!p || isTeacher(p)) return null;
    return { uid, name: p.realName || p.studentId || "이름 미설정", studentId: p.studentId || "", emoji: p.emoji || "🙂" };
  }).filter(Boolean);
  const target = options.view === "personal" ? classRoster.find((student) => student.uid === options.studentUid) : null;
  if (options.view === "personal" && !target) throw failure("이 반의 학생을 선택해 주세요.");
  const roster = target ? [target] : classRoster;
  const studentView = !teacher || !!target;
  const subjectUid = target?.uid || user.uid;
  const time = (value) => value?.toDate ? value.toDate().getTime() : new Date(value || 0).getTime() || 0;
  const activities = (mock.bookActivities ?? []).filter((a) => a.classId === classDoc.id && !a.deleted)
    .slice().sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id));
  if (options.activityId && !activities.some((a) => a.id === options.activityId)) {
    throw failure("이 반의 독서 활동을 선택해 주세요.", "dashboard/activity-not-found");
  }
  const selected = activities.find((a) => a.id === options.activityId) ?? activities.at(-1);
  const ids = new Set((studentView ? activities : selected ? [selected] : []).map((a) => a.id));
  const groups = (mock.bookGroups ?? []).filter((g) => ids.has(g.activityId) && !g.retired);
  const myGroupKeys = new Set(groups.filter((g) => (g.memberUids ?? g.members?.map((m) => m.uid) ?? []).includes(subjectUid))
    .map((g) => `${g.activityId}:${g.id}`));
  const belongs = (row) => ids.has(row.activityId);
  const mine = (row) => (row.authorId || row.userId || row.uid || row.id) === subjectUid;
  const records = { bookGroups: studentView ? groups.filter((g) => myGroupKeys.has(`${g.activityId}:${g.id}`)) : groups };
  for (const key of ["bookWords", "bookEntries", "bookPeerReviews", "bookOpinionNotes", "bookHashtagPosts", "bookHashtagComments", "bookXwHints", "bookXwBoards", "bookXwSolves", "bookXwProgress", "bookBwNotes", "bookBingoBoards", "bookRaftFeedback"]) {
    records[key] = (mock[key] ?? []).filter((row) => {
      if (!belongs(row)) return false;
      if (!studentView) return true;
      if (key === "bookPeerReviews") return row.toUid === subjectUid;
      if (key === "bookHashtagComments") return row.postUid === subjectUid;
      if (key === "bookRaftFeedback") return row.studentUid === subjectUid;
      if (key === "bookBingoBoards") return myGroupKeys.has(`${row.activityId}:${row.groupId || row.id}`);
      if (key === "bookBwNotes") return myGroupKeys.has(`${row.activityId}:${row.groupId}`) && row.writerUid === subjectUid;
      if (key.startsWith("bookXw")) return myGroupKeys.has(`${row.activityId}:${row.groupId}`);
      if (key === "bookWords") return myGroupKeys.has(`${row.activityId}:${row.groupId}`) && mine(row);
      return mine(row);
    }).map((row) => structuredClone(row));
  }
  const classActivityIds = new Set(activities.map((a) => a.id));
  records.kwl = (mock.kwl ?? []).filter((row) => row.classId === classDoc.id && classActivityIds.has(row.activityId)
    && (!studentView || row.userId === subjectUid)).map((row) => structuredClone(row));
  abortIfNeeded(options.signal);
  const data = buildDashboardData({ role: studentView ? "student" : "teacher", uid: subjectUid,
    classDoc, roster, memberUids, activities, selectedActivityId: selected?.id, records,
    readingStates: readingEnabled(classDoc) ? demoReadingStatesForDashboard(roster.map((p) => p.uid)) : {},
    now,
  }, { ...options, activityReport: !!target });
  return target ? scopedTeacherPersonalDashboard(data, target) : { ...data, reportView: "class", roster };
}

export async function fetchDashboard(options = {}) {
  abortIfNeeded(options.signal);
  const view = options.view || "class";
  if (!["class", "personal", "overall"].includes(view)) throw failure("분석 보기를 확인해 주세요.", "dashboard/invalid-view");
  if (["uid", "userId"].some((key) => options[key] != null)
    || (options.studentUid != null && (view !== "personal" || typeof options.studentUid !== "string" || !options.studentUid || options.studentUid.length > 128 || options.studentUid.includes("/")))
    || (view === "personal" && !options.studentUid)) {
    throw failure("분석할 학생을 확인해 주세요.", "dashboard/invalid-target");
  }
  if (view === "overall" && options.activityId) throw failure("전체 분석에서는 각 반의 최근 활동을 조회합니다.", "dashboard/invalid-activity");
  if (isFirebaseConfigured) return untilAborted(cachedReport(options), options.signal);
  const user = getCurrentUser();
  if (!user?.uid) throw failure("로그인을 다시 확인해 주세요.", "dashboard/unauthenticated");
  if (!isTeacher(user) && view !== "class") throw failure("분석 보고서를 볼 권한이 없어요.");
  const classDoc = await fetchClass(options.classId || (view === "overall" ? mock.classes[0]?.id : undefined));
  abortIfNeeded(options.signal);
  const directory = new Map(buildMockDirectory().map((profile) => [profile.uid, profile]));
  const now = new Date();
  if (view !== "overall") {
    if (!classDoc || classDoc.archived) throw failure("선택한 반을 확인해 주세요.");
    return demoClassDashboard({ options: { ...options, view }, user, classDoc, directory, now });
  }
  const classes = mock.classes.filter((current) => !current.archived && (isAdmin(user) || current.createdBy === user.uid));
  const anchor = classes.find((current) => current.id === options.classId);
  if (options.classId && !anchor) throw failure("학기 기준 반을 확인해 주세요.");
  let period;
  try {
    period = dashboardPeriod(options.period || "weekly", now, { start: options.start, end: options.end,
      semesterStart: anchor?.dashboardSemesterStart, semesterEnd: anchor?.dashboardSemesterEnd });
  } catch (error) { throw failure(error.message, "dashboard/invalid-period"); }
  const commonOptions = period.key === "semester" ? { ...options, period: "custom", start: period.start, end: period.end } : options;
  const dashboards = classes.map((current) => ({ ...demoClassDashboard({ options: commonOptions, user, classDoc: current, directory, now }), period }));
  abortIfNeeded(options.signal);
  const result = overallDashboardData(dashboards, { period, generatedAt: now.toISOString() });
  return { ...result, semesterAnchor: period.key === "semester" ? { id: anchor.id, name: anchor.name } : null };
}

export async function saveDashboardSemester({ classId, start, end, signal } = {}) {
  if (isFirebaseConfigured) return request({ signal }, { classId, start, end });
  abortIfNeeded(signal);
  await setDemoDashboardSemester(classId, start, end);
  return { classId, semesterStart: start, semesterEnd: end };
}
