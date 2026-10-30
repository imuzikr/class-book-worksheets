// Report projections consume already authorized, class-scoped dashboards. They
// never accept private reading state or decide which classes a teacher can see.
const list = (value) => Array.isArray(value) ? value : [];
const count = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
const compareStudents = (a, b) => String(a.studentId || a.name).localeCompare(String(b.studentId || b.name), "ko", { numeric: true }) || a.uid.localeCompare(b.uid);
const emptyReading = () => ({ pages: 0, days: 0, readers: 0, completed: 0, reviews: 0, books: 0 });
const readingSummary = (reading) => Object.fromEntries(Object.keys(emptyReading()).map((key) => [key, count(reading?.summary?.[key])]));

function classRoster(dashboard) {
  if (!Array.isArray(dashboard.roster)) throw new Error("전체 보고서에는 모든 반의 학생 명단이 필요합니다.");
  const students = new Map();
  for (const student of dashboard.roster) {
    if (typeof student?.uid !== "string" || !student.uid) throw new Error("학생 명단을 확인해 주세요.");
    if (!students.has(student.uid)) students.set(student.uid, {
      uid: student.uid, name: String(student.name || student.studentId || "이름 미설정"), studentId: String(student.studentId || ""),
    });
  }
  return [...students.values()].sort(compareStudents);
}

function compatiblePeriod(a, b) {
  return a?.start === b?.start && a?.end === b?.end;
}

/** Aggregate every supplied class, or fail rather than present a partial total. */
export function overallDashboardData(classDashboards, options = {}) {
  if (!Array.isArray(classDashboards)) throw new Error("전체 반의 보고서를 확인해 주세요.");
  const period = options.period ?? classDashboards[0]?.period ?? null;
  const classes = [], students = new Map(), classIds = new Set();
  const eligibleReaders = new Set(), readers = new Set(), days = new Set();
  const daily = new Map(), weekly = new Map(), books = new Map();
  const selectedActivity = { scope: "selected-per-class", classes: 0, eligible: 0, started: 0, done: 0, waiting: 0, completionEligible: 0, completionSupportedClasses: 0 };
  const reading = { enabledClasses: 0, eligibleStudents: 0, readerMemberships: 0, ...emptyReading() };
  let memberships = 0, activityCount = 0;

  for (const dashboard of classDashboards) {
    if (!dashboard || dashboard.view !== "teacher" || !dashboard.class?.id) throw new Error("일부 반의 보고서를 불러오지 못했습니다. 전체 보고서를 다시 조회해 주세요.");
    if (classIds.has(dashboard.class.id)) throw new Error("같은 반의 보고서를 중복하여 합칠 수 없습니다.");
    if (!period || !compatiblePeriod(period, dashboard.period)) throw new Error("같은 조회 기간의 반 보고서만 합칠 수 있습니다.");
    classIds.add(dashboard.class.id);
    const roster = classRoster(dashboard);
    const classInfo = { id: dashboard.class.id, name: dashboard.class.name };
    memberships += roster.length;
    activityCount += list(dashboard.activities).length;
    for (const student of roster) {
      const entry = students.get(student.uid) ?? { ...student, classes: [] };
      entry.classes.push({ ...classInfo });
      students.set(student.uid, entry);
    }

    const activity = dashboard.activity;
    if (activity) {
      selectedActivity.classes += 1;
      for (const key of ["eligible", "started", "done", "waiting"]) selectedActivity[key] += count(activity[key]);
      if (activity.completionSupported === true) {
        selectedActivity.completionEligible += count(activity.eligible);
        selectedActivity.completionSupportedClasses += 1;
      }
    }

    const enabled = dashboard.class.readingEnabled === true;
    if (enabled && !dashboard.reading) throw new Error("일부 반의 독서 보고서가 없습니다. 전체 보고서를 다시 조회해 주세요.");
    const classReading = enabled ? readingSummary(dashboard.reading) : null;
    classes.push({
      classId: classInfo.id, name: classInfo.name, students: roster.length, activityCount: list(dashboard.activities).length,
      selectedActivity: activity ? {
        id: activity.id, title: activity.title, type: activity.type, label: activity.label, href: activity.href,
        eligible: count(activity.eligible), started: count(activity.started), done: count(activity.done), waiting: count(activity.waiting),
        completionSupported: activity.completionSupported === true,
      } : null,
      eligible: count(activity?.eligible), started: count(activity?.started), done: count(activity?.done), waiting: count(activity?.waiting),
      readingEnabled: enabled, reading: classReading,
    });
    if (!enabled) continue;
    reading.enabledClasses += 1;
    for (const student of roster) eligibleReaders.add(student.uid);
    for (const key of ["pages", "completed", "reviews"]) reading[key] += classReading[key];
    reading.readerMemberships += classReading.readers;
    const rosterIds = new Set(roster.map((student) => student.uid));
    for (const member of list(dashboard.reading.members)) if (rosterIds.has(member.uid) && count(member.pages) > 0) readers.add(member.uid);
    for (const day of list(dashboard.reading.daily)) {
      const row = daily.get(day.date) ?? { date: day.date, pages: 0, readerMemberships: 0 };
      row.pages += count(day.pages); row.readerMemberships += count(day.readers);
      daily.set(day.date, row);
      if (count(day.pages) > 0) days.add(day.date);
    }
    // Per-class projections expose counts, not reader IDs for each bucket.
    // Adding these gives reader memberships, never unique overall readers.
    for (const week of list(dashboard.reading.weekly)) {
      const row = weekly.get(week.start) ?? { start: week.start, label: week.label, pages: 0, readerMemberships: 0 };
      row.pages += count(week.pages); row.readerMemberships += count(week.readers);
      weekly.set(week.start, row);
    }
    for (const book of list(dashboard.reading.books)) {
      if (typeof book.key !== "string" || !book.key) throw new Error("도서 종류를 합산할 식별 정보가 없습니다.");
      const row = books.get(book.key) ?? { key: book.key, title: book.title, author: book.author, pages: 0, readerMemberships: 0 };
      row.pages += count(book.pages); row.readerMemberships += count(book.readers);
      books.set(book.key, row);
    }
  }
  reading.eligibleStudents = eligibleReaders.size;
  reading.readers = readers.size; reading.days = days.size; reading.books = books.size;
  const generatedAt = options.generatedAt ?? classDashboards.map((dashboard) => dashboard.generatedAt).filter(Boolean).sort().at(-1) ?? new Date().toISOString();
  const directory = [...students.values()].sort(compareStudents).map((student) => ({ ...student,
    classes: student.classes.sort((a, b) => String(a.name).localeCompare(String(b.name), "ko", { numeric: true }) || a.id.localeCompare(b.id)),
  }));
  return {
    view: "teacher", reportView: "overall", period: period ? { ...period, previous: period.previous ? { ...period.previous } : null } : null, generatedAt,
    summary: { classes: classes.length, students: students.size, memberships, activityCount, selectedActivity, reading: { ...reading } },
    classes, students: directory,
    reading: { summary: { ...reading }, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      weekly: [...weekly.values()].sort((a, b) => a.start.localeCompare(b.start)),
      books: [...books.values()].sort((a, b) => b.readerMemberships - a.readerMemberships || b.pages - a.pages || String(a.title).localeCompare(String(b.title), "ko")) },
  };
}

/** Keep the target student's class work, without personal library or growth. */
export function scopedTeacherPersonalDashboard(studentDashboard, subject) {
  if (studentDashboard?.view !== "student" || typeof subject?.uid !== "string" || !subject.uid) throw new Error("개인 보고서의 학생을 확인해 주세요.");
  const rows = [...list(studentDashboard.activity?.rows), ...list(studentDashboard.reading?.members),
    ...list(studentDashboard.reflections?.records), ...list(studentDashboard.feedback)];
  if (rows.some((row) => row.uid !== subject.uid)) throw new Error("다른 학생의 자료를 개인 보고서에 포함할 수 없습니다.");
  const student = { uid: subject.uid, name: String(subject.name || subject.studentId || "이름 미설정"), studentId: String(subject.studentId || "") };
  return { ...studentDashboard, reportView: "personal", subject: student, roster: [{ ...student }],
    reading: studentDashboard.reading ? { ...studentDashboard.reading, personal: null, dayRecords: [] } : null };
}
