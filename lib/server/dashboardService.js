// Server-only source loading. Canonical personal reading data is reduced to the
// dashboard projection here; it is never sent to a teacher's browser as state.
import { buildDashboardData, dashboardPeriod } from "../dashboard.js";
import { overallDashboardData, scopedTeacherPersonalDashboard } from "../dashboardReports.js";
import { ReadingHttpError, readingClassId } from "./readingPolicy.js";

const ACTIVITY_TYPES = new Set(["consonant", "paratext", "raft", "kwls", "mindmap", "opinion", "hashtag", "qmark", "crossword", "brainwrite"]);
const ENTRY_TYPES = new Set(["paratext", "raft", "kwls", "mindmap", "qmark"]);
const RECORD_KEYS = ["bookGroups", "bookWords", "bookEntries", "bookPeerReviews", "bookOpinionNotes", "bookHashtagPosts", "bookHashtagComments", "bookXwHints", "bookXwBoards", "bookXwSolves", "bookXwProgress", "bookBwNotes", "kwl"];
const MAX_ACTIVITIES = 200;
const MAX_MEMBERS = 100;
const MAX_GROUPS = 30;
const MAX_RECORDS = 4000;
const MAX_DOCUMENTS = 6500;
const MAX_CLASSES = 100;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

function forbidden() {
  return new ReadingHttpError("이 반의 대시보드를 볼 권한이 없습니다.", 403, "dashboard/forbidden");
}
function excessive() {
  return new ReadingHttpError("조회할 자료가 너무 많습니다. 담당 교사에게 문의해 주세요.", 413, "dashboard/too-large");
}
function text(value, maximum = 200) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}
function normalize(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}
function record(snapshot, context = {}) {
  return { ...normalize(snapshot.data()), id: snapshot.id, ...context };
}
function profileRow(uid, profile) {
  return { uid, name: text(profile.realName || profile.studentId || "이름 미설정", 40), studentId: text(profile.studentId, 20), emoji: text(profile.emoji || "🙂", 20) };
}
function safeUid(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");
}
function groupHasStudent(group, uid) {
  return (group.memberUids ?? []).includes(uid) || (group.members ?? []).some((member) => member?.uid === uid);
}

function teacherReadingSource(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  const pick = (item, keys) => Object.fromEntries(keys.filter((key) => item?.[key] !== undefined).map((key) => [key, item[key]]));
  return {
    version: 1,
    books: (Array.isArray(state.books) ? state.books : []).map((book) => pick(book, ["id", "title", "author", "totalPages", "status", "archived", "createdAt", "activityId", "isbn"])),
    logs: (Array.isArray(state.logs) ? state.logs : []).map((log) => pick(log, ["id", "bookId", "classId", "date", "startPage", "endPage", "createdAt", "updatedAt"])),
    // The calculator needs to know that a review has content, never the actual
    // private words. Preserve empty/invalid reviews as empty for validation.
    reviews: (Array.isArray(state.reviews) ? state.reviews : []).map((review) => ({
      ...pick(review, ["id", "bookId", "classId", "createdAt", "updatedAt"]), text: String(review?.text || "").trim() ? "작성됨" : "",
    })),
    featuredBadge: null,
  };
}

// Treat the authenticated profile and membership as the source of authority.
// Reading may be disabled: activity reporting is still available in that case.
async function access(tx, db, principal, classId) {
  if (!safeUid(principal?.uid)) throw new ReadingHttpError("로그인이 필요합니다.", 401, "dashboard/unauthenticated");
  const [classSnap, profileSnap, memberSnap] = await tx.getAll(
    db.doc(`classes/${classId}`), db.doc(`users/${principal.uid}`), db.doc(`memberships/${principal.uid}_${classId}`)
  );
  if (!profileSnap.exists) throw forbidden();
  if (!classSnap.exists) throw new ReadingHttpError("반을 찾을 수 없습니다.", 404, "dashboard/class-not-found");
  const classDoc = record(classSnap);
  if (classDoc.archived === true) throw new ReadingHttpError("보관된 반의 대시보드는 열 수 없습니다.", 403, "dashboard/archived");
  const profile = normalize(profileSnap.data());
  const role = principal.roleClaim || profile.role || "student";
  if (role === "admin" || (role === "teacher" && classDoc.createdBy === principal.uid)) return { classDoc, profile, role: "teacher" };
  if (role === "student" && memberSnap.exists) {
    const membership = memberSnap.data();
    if (membership.uid === principal.uid && membership.classId === classId) return { classDoc, profile, role: "student" };
  }
  throw forbidden();
}

function validateOptions(options = {}) {
  const view = options.view || "class";
  if (!["class", "personal", "overall"].includes(view)) {
    throw new ReadingHttpError("분석 보기를 확인해 주세요.", 400, "dashboard/invalid-view");
  }
  const classId = view === "overall" && !options.classId ? null : readingClassId(options.classId);
  if (options.uid != null || options.userId != null || (options.studentUid != null && (view !== "personal" || !safeUid(options.studentUid)))) {
    throw new ReadingHttpError("다른 학생을 지정해 조회할 수 없습니다.", 400, "dashboard/invalid-target");
  }
  if (view === "personal" && !safeUid(options.studentUid)) {
    throw new ReadingHttpError("분석할 학생을 선택해 주세요.", 400, "dashboard/invalid-target");
  }
  if (options.activityId != null && options.activityId !== "" && (typeof options.activityId !== "string" || !IDENTIFIER.test(options.activityId))) {
    throw new ReadingHttpError("활동을 확인해 주세요.", 400, "dashboard/invalid-activity");
  }
  if (view === "overall" && options.activityId) {
    throw new ReadingHttpError("전체 분석에서는 각 반의 최근 활동을 조회합니다.", 400, "dashboard/invalid-activity");
  }
  return { classId, view, studentUid: options.studentUid || null, activityId: options.activityId || null,
    period: options.period || "weekly", start: options.start || undefined, end: options.end || undefined };
}

function readers(tx, initialCount = 3) {
  let count = initialCount;
  const account = (amount) => { count += amount; if (count > MAX_DOCUMENTS) throw excessive(); };
  return {
    async list(query, maximum = MAX_RECORDS) {
      const remaining = Math.max(0, MAX_DOCUMENTS - count);
      const limit = Math.min(maximum, remaining);
      if (!limit) throw excessive();
      const snapshot = await tx.get(query.limit(limit + 1));
      account(snapshot.size);
      if (snapshot.size > limit) throw excessive();
      return snapshot.docs;
    },
    async one(ref) { account(1); return tx.get(ref); },
    async many(refs) { account(refs.length); return refs.length ? tx.getAll(...refs) : []; },
  };
}

async function classRoster(read, db, classId, role, uid, profile) {
  const memberships = await read.list(db.collection("memberships").where("classId", "==", classId), MAX_MEMBERS);
  const uids = [...new Set(memberships.map((snapshot) => snapshot.data().uid).filter(safeUid))];
  if (role === "student") return { roster: [profileRow(uid, profile)], memberUids: uids };
  const profiles = await read.many(uids.map((uid) => db.doc(`users/${uid}`)));
  const roster = profiles.filter((snapshot) => snapshot.exists && (snapshot.data().role || "student") === "student")
    .map((snapshot) => profileRow(snapshot.id, snapshot.data()));
  return { roster, memberUids: roster.map((member) => member.uid) };
}

async function loadActivity(read, db, activity, role, uid, records, rosterIds) {
  const activityId = activity.id;
  const source = db.doc(`bookActivities/${activityId}`);
  const own = role === "student";
  const context = { activityId };
  const appendList = async (key, query, extra = {}, filter = () => true, maximum = MAX_RECORDS) => {
    const snapshots = await read.list(query, maximum);
    records[key].push(...snapshots.map((snapshot) => record(snapshot, { ...context, ...extra })).filter(filter));
  };
  const appendOne = async (key, ref, extra = {}) => {
    const snapshot = await read.one(ref);
    if (snapshot.exists) records[key].push(record(snapshot, { ...context, ...extra }));
  };

  if (ENTRY_TYPES.has(activity.type)) {
    if (own) await appendOne("bookEntries", source.collection("entries").doc(uid), { authorId: uid });
    else {
      const snapshots = await read.list(source.collection("entries"));
      records.bookEntries.push(...snapshots.filter((snapshot) => rosterIds.has(snapshot.id))
        .map((snapshot) => record(snapshot, { ...context, authorId: snapshot.id })));
    }
  }

  if (activity.type === "raft") {
    const query = own ? db.collection(`bookActivities/${activityId}/peerReviews`).where("toUid", "==", uid) : db.collection(`bookActivities/${activityId}/peerReviews`);
    await appendList("bookPeerReviews", query, {}, (item) => own ? item.toUid === uid : rosterIds.has(item.toUid));
  }
  if (activity.type === "opinion") {
    const collection = db.collection(`bookActivities/${activityId}/opinionNotes`);
    await appendList("bookOpinionNotes", own ? collection.where("authorId", "==", uid) : collection, {}, (item) => own ? item.authorId === uid : rosterIds.has(item.authorId));
  }
  if (activity.type === "hashtag") {
    const posts = db.collection(`bookActivities/${activityId}/hashtagPosts`);
    if (own) await appendOne("bookHashtagPosts", posts.doc(uid), { authorId: uid });
    else await appendList("bookHashtagPosts", posts, {}, (item) => rosterIds.has(item.authorId || item.id));
    const comments = db.collection(`bookActivities/${activityId}/hashtagComments`);
    await appendList("bookHashtagComments", own ? comments.where("postUid", "==", uid) : comments, {}, (item) => own ? item.postUid === uid : rosterIds.has(item.postUid));
  }

  const withGroups = ["consonant", "crossword", "brainwrite"].includes(activity.type)
    || (["paratext", "raft"].includes(activity.type) && activity.grouped === true);
  if (!withGroups) return;
  const groupSnaps = await read.list(db.collection(`bookActivities/${activityId}/groups`), MAX_GROUPS);
  const groups = groupSnaps.map((snapshot) => record(snapshot, context)).filter((group) => group.retired !== true && (!own || groupHasStudent(group, uid)));
  records.bookGroups.push(...groups);
  // Spend the bounded read budget as groups are loaded, rather than issuing a
  // large set of independent high-limit queries before the budget is checked.
  for (const group of groups) {
    const extra = { groupId: group.id };
    const base = `bookActivities/${activityId}/groups/${group.id}`;
    if (activity.type === "consonant") await appendList("bookWords", db.collection(`${base}/words`), extra);
    if (activity.type === "brainwrite") await appendList("bookBwNotes", db.collection(`${base}/bwNotes`), extra);
    if (activity.type === "crossword") {
      await appendList("bookXwHints", db.collection(`${base}/xwHints`), extra);
      await appendOne("bookXwBoards", db.doc(`${base}/xwBoard/main`), extra);
      await appendList("bookXwSolves", db.collection(`${base}/xwSolves`), extra);
      await appendOne("bookXwProgress", db.doc(`bookActivities/${activityId}/xwProgress/${group.id}`), extra);
    }
  }
}

function periodFor(options, now, classDoc) {
  try {
    return dashboardPeriod(options.period, now, { start: options.start, end: options.end,
      semesterStart: classDoc?.dashboardSemesterStart, semesterEnd: classDoc?.dashboardSemesterEnd });
  } catch (error) {
    throw new ReadingHttpError(error?.message || "조회 기간을 확인해 주세요.", 400, "dashboard/invalid-period");
  }
}

async function loadClassDashboard({ read, db, uid, classDoc, profile, role, options, now, readingCache = new Map() }) {
  periodFor(options, now, classDoc);
  const [activitySnaps, membership] = await Promise.all([
    read.list(db.collection("bookActivities").where("classId", "==", classDoc.id), MAX_ACTIVITIES),
    classRoster(read, db, classDoc.id, role, uid, profile),
  ]);
  const target = options.view === "personal" ? membership.roster.find((member) => member.uid === options.studentUid) : null;
  if (options.view === "personal" && !target) throw forbidden();
  const studentView = role === "student" || options.view === "personal";
  const subjectUid = target?.uid || uid;
  const roster = target ? [target] : membership.roster;
  const { memberUids } = membership;
  const activities = activitySnaps.map((snapshot) => record(snapshot))
    .filter((activity) => activity.deleted !== true && ACTIVITY_TYPES.has(activity.type));
  if (options.activityId && !activities.some((activity) => activity.id === options.activityId)) {
    throw new ReadingHttpError("이 반의 활동을 찾을 수 없습니다.", 404, "dashboard/activity-not-found");
  }
  const selected = options.activityId
    ? activities.find((activity) => activity.id === options.activityId)
    : activities.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || a.id.localeCompare(b.id))[0];
  const records = Object.fromEntries(RECORD_KEYS.map((key) => [key, []]));
  const rosterIds = new Set(roster.map((member) => member.uid));
  const targetActivities = studentView ? activities : (selected ? [selected] : []);
  const kwlQuery = db.collection("kwl").where("classId", "==", classDoc.id);
  const kwlSnaps = await read.list(studentView ? kwlQuery.where("userId", "==", subjectUid) : kwlQuery);
  const activityIds = new Set(activities.filter((activity) => activity.type === "kwls").map((activity) => activity.id));
  records.kwl = kwlSnaps.map((snapshot) => record(snapshot)).filter((item) => rosterIds.has(item.userId) && activityIds.has(item.activityId));
  for (const activity of targetActivities) await loadActivity(read, db, activity, studentView ? "student" : "teacher", subjectUid, records, rosterIds);
  const readingStates = Object.create(null);
  if (classDoc.readingEnabled === true) {
    const missing = roster.filter((member) => !readingCache.has(member.uid));
    const snapshots = await read.many(missing.map((member) => db.doc(`users/${member.uid}/reading/main`)));
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      const state = snapshot.exists ? normalize(snapshot.data().state) : undefined;
      readingCache.set(missing[index].uid, role === "teacher" ? teacherReadingSource(state) : state);
    }
    for (const member of roster) readingStates[member.uid] = readingCache.get(member.uid);
  }
  const data = buildDashboardData({ role: studentView ? "student" : "teacher", uid: subjectUid, classDoc, roster, memberUids, activities, selectedActivityId: selected?.id,
    records, readingStates, now }, { ...options, activityId: selected?.id });
  if (target) return scopedTeacherPersonalDashboard(data, target);
  return { ...data, reportView: "class", roster };
}

async function loadOverallDashboard(tx, principal, options, now) {
  const { db, uid } = principal;
  if (!safeUid(uid)) throw new ReadingHttpError("로그인이 필요합니다.", 401, "dashboard/unauthenticated");
  const read = readers(tx, 0);
  const profileSnap = await read.one(db.doc(`users/${uid}`));
  if (!profileSnap.exists) throw forbidden();
  const profile = normalize(profileSnap.data());
  const role = principal.roleClaim || profile.role || "student";
  if (!["teacher", "admin"].includes(role)) throw forbidden();
  const query = role === "admin" ? db.collection("classes") : db.collection("classes").where("createdBy", "==", uid);
  const classes = (await read.list(query, MAX_CLASSES)).map((snapshot) => record(snapshot)).filter((classDoc) => classDoc.archived !== true);
  const selectedClass = classes.find((classDoc) => classDoc.id === options.classId);
  if (options.classId && !selectedClass) throw forbidden();
  // A common range makes totals comparable even when individual classes have
  // different semester settings. The selected class supplies that range.
  const period = periodFor(options, now, selectedClass);
  const classOptions = options.period === "semester" ? { ...options, period: "custom", start: period.start, end: period.end } : options;
  const readingCache = new Map();
  const dashboards = [];
  for (const classDoc of classes) {
    const dashboard = await loadClassDashboard({ read, db, uid, classDoc, profile, role: "teacher", options: classOptions, now, readingCache });
    dashboards.push({ ...dashboard, period });
  }
  return { ...overallDashboardData(dashboards, { period, generatedAt: now.toISOString() }),
    semesterAnchor: period.key === "semester" ? { id: selectedClass.id, name: text(selectedClass.name) } : null };
}

export async function getDashboard(principal, requestedOptions = {}) {
  const options = validateOptions(requestedOptions);
  const { db, uid } = principal;
  const now = new Date();
  return db.runTransaction(async (tx) => {
    if (options.view === "overall") return loadOverallDashboard(tx, principal, options, now);
    const { classDoc, profile, role } = await access(tx, db, principal, options.classId);
    if (role === "student" && options.view !== "class") throw forbidden();
    return loadClassDashboard({ read: readers(tx), db, uid, classDoc, profile, role, options, now });
  }, { readOnly: true });
}

function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function saveDashboardSemester(principal, payload = {}) {
  const classId = readingClassId(payload.classId);
  const { start, end } = payload;
  if (!day(start) || !day(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 >= 366) {
    throw new ReadingHttpError("시작일과 종료일을 366일 이내의 올바른 학기 기간으로 설정해 주세요.", 400, "dashboard/invalid-semester");
  }
  const { db } = principal;
  return db.runTransaction(async (tx) => {
    const { role } = await access(tx, db, principal, classId);
    if (role !== "teacher") throw forbidden();
    tx.update(db.doc(`classes/${classId}`), { dashboardSemesterStart: start, dashboardSemesterEnd: end });
    return { classId, semesterStart: start, semesterEnd: end };
  });
}
