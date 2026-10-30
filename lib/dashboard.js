// Shared, source-only dashboard projections. No authentication, network, writes,
// or raw private reading state belongs in a dashboard response.
import { kstToday, deriveReading, readingEnabled } from "./reading";
import { paratextDoneCount, paratextCharCount } from "./paratext";
import { raftPlanCount, raftDone, raftStarted } from "./raft";
import { kwlsAnswersFromEntry, kwlsFilledCount, kwlsDone, kwlsStarted } from "./kwls";
import { qmarkDone, qmarkStarted, qmarkRows, qmarkCellState, normalizeQmarkAnswers } from "./qmark";
import { hashtagProgress, normalizeHashtagPost } from "./hashtag";
import { normalizeMindmap } from "./mindmap";
import { notesByColumn, writerProgress } from "./brainwrite";
import { CELL_COUNT } from "./consonants";
import { normalizeGroupCrossword, fixedLettersOf, groupSolveProgress, xwHintDone } from "./crossword";

export const DASHBOARD_ACTIVITY_LABELS = Object.freeze({
  consonant: "닿소리 채우기", paratext: "곁텍스트 읽기", raft: "RAFT 글쓰기", kwls: "KWLS로 성찰하기", mindmap: "마인드맵",
  opinion: "내 생각은요…", hashtag: "여섯 개의 해시태그", qmark: "물음표로 책 읽기", crossword: "가로세로 낱말 퀴즈", brainwrite: "브레인 라이팅",
});
const DAY = 86400000;
const KEYS = ["know", "want", "learned", "still"];
const list = (value) => Array.isArray(value) ? value : [];
const plain = (value, max = 3000) => String(value ?? "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim().slice(0, max);
const has = (value) => plain(value).length > 0;
const href = (id) => `/books?activity=${encodeURIComponent(id)}`;
const stamp = (value) => {
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value == null || value === "") return 0;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
};
const validDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const shift = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const distance = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
const inRange = (day, range) => !!range && validDay(day) && day >= range.start && day <= range.end;
const dayOf = (value) => { const n = stamp(value); return n ? kstToday(n) : null; };
const nameOf = (student) => plain(student.name || student.realName || student.studentId || "이름 미설정", 80);
const compareStudents = (a, b) => String(a.studentId || a.name).localeCompare(String(b.studentId || b.name), "ko", { numeric: true }) || a.uid.localeCompare(b.uid);

export function dashboardPeriod(kind = "weekly", now = new Date(), options = {}) {
  const today = kstToday(now);
  let start, end = today, previous = null, label;
  if (kind === "weekly") {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    start = shift(today, -(weekday === 0 ? 6 : weekday - 1));
    previous = { start: shift(start, -7), end: shift(end, -7) };
    label = "이번 주";
  } else if (kind === "monthly") {
    start = today.slice(0, 7) + "-01";
    const lastPrevious = shift(start, -1);
    const previousStart = lastPrevious.slice(0, 7) + "-01";
    previous = { start: previousStart, end: [shift(previousStart, distance(start, end)), lastPrevious].sort()[0] };
    label = "이번 달";
  } else if (kind === "semester") {
    start = options.semesterStart;
    const configuredEnd = options.semesterEnd;
    if (!validDay(start) || !validDay(configuredEnd) || start > configuredEnd || distance(start, configuredEnd) >= 366) throw new Error("학기 시작일과 종료일을 먼저 설정해 주세요. 학기는 366일 이내여야 합니다.");
    if (start > today) throw new Error("아직 시작하지 않은 학기입니다. 다른 기간을 선택해 주세요.");
    end = configuredEnd < today ? configuredEnd : today;
    label = "이번 학기";
  } else if (kind === "custom") {
    start = options.start; end = options.end;
    if (!validDay(start) || !validDay(end) || start > end || distance(start, end) >= 366 || end > today) throw new Error("미래가 아닌 시작일·종료일을 366일 이내로 선택해 주세요.");
    previous = { start: shift(start, -(distance(start, end) + 1)), end: shift(start, -1) };
    label = "직접 선택";
  } else throw new Error("조회 기간을 확인해 주세요.");
  return { key: kind, start, end, label, previous };
}

function normalizedAnswers(entry) {
  return Object.fromEntries(Object.entries(entry?.answers ?? {}).map(([key, value]) => [key, typeof value === "string" ? plain(value, 10000) : value]));
}
function groupOf(activity, student, records) {
  return list(records.bookGroups).find((group) => group.activityId === activity.id && !group.retired
    && (list(group.memberUids).includes(student.uid) || list(group.members).some((m) => m?.uid === student.uid))) ?? null;
}
function grouped(activity) {
  return ["consonant", "crossword"].includes(activity.type) ? activity.groupMode !== "solo"
    : activity.type === "brainwrite" || activity.grouped === true;
}
function needsBoard(activity) { return grouped(activity) || ["consonant", "crossword"].includes(activity.type); }
function activityProgress(activity, student, records, memberIds) {
  const own = (key) => list(records[key]).filter((record) => record.activityId === activity.id);
  const group = groupOf(activity, student, records);
  const base = { uid: student.uid, name: nameOf(student), studentId: plain(student.studentId, 30), emoji: plain(student.emoji || "🙂", 20),
    state: "empty", label: "미시작", filled: 0, total: null, groupName: group ? plain(group.groupName || group.name || `${group.groupIndex || ""}모둠`, 100) : null,
    groupProgress: null, preview: "", href: href(activity.id) };
  if (needsBoard(activity) && !group) return { ...base, state: "waiting", label: "모둠 배정 대기" };
  const entry = own("bookEntries").find((record) => record.authorId === student.uid || record.id === student.uid);
  const answers = normalizedAnswers(entry);
  let started = false, done = false;
  switch (activity.type) {
    case "paratext":
      base.filled = paratextDoneCount(answers); base.total = 8; started = paratextCharCount(answers) > 0; done = base.filled === 8;
      base.preview = Object.values(answers).filter((v) => typeof v === "string" && has(v)).join(" · ");
      break;
    case "raft":
      base.filled = raftPlanCount(answers) + Number(has(answers.writing)); base.total = 5; started = raftStarted(answers); done = raftDone(answers);
      base.preview = [answers.role, answers.audience, answers.format, answers.topic, answers.writing].filter(has).join(" · ");
      break;
    case "kwls": {
      const stream = own("kwl").find((record) => record.userId === student.uid || record.authorId === student.uid);
      const normalized = Object.fromEntries(Object.entries(kwlsAnswersFromEntry(stream ?? entry ?? {})).map(([k, v]) => [k, plain(v)]));
      base.filled = kwlsFilledCount(normalized); base.total = 4; started = kwlsStarted(normalized); done = kwlsDone(normalized);
      base.preview = KEYS.filter((key) => has(normalized[key])).map((key) => `${({ know: "K", want: "W", learned: "L", still: "S" })[key]}: ${normalized[key]}`).join(" · ");
      break;
    }
    case "qmark": {
      const normalized = normalizeQmarkAnswers(answers);
      base.filled = qmarkRows().filter((row) => qmarkCellState(row, normalized) === "done").length; base.total = 3;
      started = qmarkStarted(normalized); done = qmarkDone(normalized);
      base.preview = [...normalized.asks.map((ask) => [ask.question, ask.reason].filter(has).join(" — ")), normalized.thought].filter(has).join(" · ");
      break;
    }
    case "hashtag": {
      const post = own("bookHashtagPosts").find((record) => record.authorId === student.uid || record.id === student.uid);
      const normalized = normalizeHashtagPost(post); const progress = hashtagProgress(normalized);
      base.filled = progress.done; base.total = 6; started = progress.tagged > 0 || progress.done > 0 || has(normalized.summary); done = progress.complete;
      base.preview = normalized.tags.filter((tag) => has(tag.tag) || has(tag.insight)).map((tag) => `#${tag.tag} ${tag.insight}`).join(" · ");
      break;
    }
    case "mindmap": {
      const map = normalizeMindmap(answers, activity.topic);
      const branches = map.nodes.filter((node) => node.parentId !== null && (has(node.text) || has(node.image)));
      started = branches.length > 0; base.filled = branches.length; base.preview = branches.map((node) => plain(node.text) || "이미지 가지").join(" · ");
      break;
    }
    case "opinion": {
      const notes = own("bookOpinionNotes").filter((record) => record.authorId === student.uid && !record.byTeacher && has(record.text));
      started = notes.length > 0; base.filled = notes.length; base.preview = notes.map((record) => plain(record.text)).join(" · ");
      break;
    }
    case "consonant": {
      const words = own("bookWords").filter((record) => record.groupId === group.id && has(record.text));
      const mine = words.filter((record) => record.authorId === student.uid);
      const cells = new Set(words.map((record) => record.cellKey).filter((key) => /^c([0-9]|1[0-3])$/.test(key)));
      base.filled = new Set(mine.map((record) => record.cellKey).filter((key) => /^c([0-9]|1[0-3])$/.test(key))).size;
      started = mine.length > 0; base.preview = mine.map((record) => plain(record.text)).join(" · ");
      if (activity.groupMode === "solo") { base.total = CELL_COUNT; done = cells.size === CELL_COUNT; }
      else base.groupProgress = `모둠 ${cells.size}/${CELL_COUNT}칸 · 내 낱말 ${mine.length}개`;
      break;
    }
    case "brainwrite": {
      const members = list(group.members).filter((member) => memberIds.has(member.uid));
      const notes = own("bookBwNotes").filter((record) => record.groupId === group.id && memberIds.has(record.writerUid) && memberIds.has(record.ownerUid));
      const rows = writerProgress(members, student.uid, notesByColumn(notes));
      base.total = rows.length; base.filled = rows.filter((row) => row.done).length; started = base.filled > 0; done = base.total > 0 && base.filled === base.total;
      base.preview = notes.filter((record) => record.writerUid === student.uid && has(record.text)).map((record) => plain(record.text)).join(" · ");
      break;
    }
    case "crossword": {
      const hints = own("bookXwHints").filter((record) => record.groupId === group.id);
      const mine = hints.filter((record) => record.writerUid === student.uid);
      base.total = mine.length || null; base.filled = mine.filter(xwHintDone).length; started = mine.some((record) => has(record.hint));
      done = mine.length > 0 && base.filled === mine.length;
      base.preview = mine.map((hint) => `${plain(hint.word)}: ${plain(hint.hint)}`).join(" · ");
      const puzzle = normalizeGroupCrossword(activity.crossword);
      const board = own("bookXwBoards").find((record) => record.groupId === group.id);
      if (puzzle) {
        const progress = groupSolveProgress(puzzle, group.id, board?.cells ?? {}, fixedLettersOf(puzzle, hints));
        base.groupProgress = `모둠 풀이 ${progress.solved.size}/${progress.total}개`;
      }
      if (!mine.length) return { ...base, state: "waiting", label: "힌트 담당 배정 대기", preview: plain(base.preview) };
      break;
    }
    default: break;
  }
  base.preview = plain(base.preview);
  base.state = done ? "done" : started ? "doing" : "empty";
  const unit = activity.type === "crossword" ? "힌트" : activity.type === "brainwrite" ? "작성" : "";
  base.label = base.total != null ? `${unit ? `${unit} ` : ""}${base.filled}/${base.total} · ${done ? "기준 충족" : started ? "작성 중" : "미시작"}`
    : activity.type === "mindmap" && started ? `가지 ${base.filled}개 · 작성 중`
      : activity.type === "opinion" && started ? `메모 ${base.filled}장`
        : activity.type === "consonant" && started ? `참여 · ${base.filled}칸` : "미시작";
  return base;
}

function reflectionProjection(activities, roster, records, range, view) {
  const kwls = new Map(activities.filter((activity) => activity.type === "kwls").map((activity) => [activity.id, activity]));
  const students = new Map(roster.map((student) => [student.uid, student]));
  const canonical = new Map();
  for (const entry of list(records.bookEntries)) {
    const uid = entry.authorId || entry.id;
    if (kwls.has(entry.activityId) && students.has(uid)) canonical.set(`${entry.activityId}:${uid}`, { ...entry, uid, date: null });
  }
  for (const entry of list(records.kwl)) {
    const uid = entry.userId || entry.authorId;
    if (!kwls.has(entry.activityId) || !students.has(uid)) continue;
    const key = `${entry.activityId}:${uid}`;
    const previous = canonical.get(key);
    if (!previous || !previous.canonical || stamp(entry.updatedAt || entry.createdAt) >= stamp(previous.updatedAt || previous.createdAt)) {
      canonical.set(key, { ...entry, uid, canonical: true, date: validDay(entry.date) ? entry.date : null });
    }
  }
  const counts = Object.fromEntries(KEYS.map((key) => [key, new Set()]));
  const rows = [];
  for (const entry of canonical.values()) {
    const answers = Object.fromEntries(Object.entries(kwlsAnswersFromEntry(entry)).map(([key, value]) => [key, plain(value)]));
    if (!Object.values(answers).some(has)) continue;
    if (entry.date && !inRange(entry.date, range)) continue;
    const student = students.get(entry.uid); const activity = kwls.get(entry.activityId);
    if (entry.date) for (const key of KEYS) if (has(answers[key])) counts[key].add(view === "student" ? `${entry.activityId}:${entry.uid}` : entry.uid);
    rows.push({ id: `${entry.activityId}:${entry.uid}`, activityId: activity.id, activityTitle: plain(activity.title, 200), uid: entry.uid,
      name: nameOf(student), studentId: plain(student.studentId, 30), date: entry.date, answers, href: href(activity.id) });
  }
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || "") || compareStudents(a, b));
  const numbers = Object.fromEntries(KEYS.map((key) => [key, counts[key].size]));
  return { eligible: view === "student" ? kwls.size : kwls.size ? roster.length : 0, learned: numbers.learned, still: numbers.still, counts: numbers, records: rows };
}

function feedbackProjection(activities, roster, records, range, allowedMembers) {
  const byActivity = new Map(activities.map((activity) => [activity.id, activity]));
  const students = new Map(roster.map((student) => [student.uid, student]));
  const rows = [];
  const add = (record, uid, text, kind, authorName, date, suffix = "") => {
    const activity = byActivity.get(record.activityId);
    const student = students.get(uid);
    if (!activity || !student || !has(text) || (date && !inRange(date, range))) return;
    rows.push({ id: `${activity.id}:${record.id || uid}:${suffix || kind}`, activityId: activity.id, activityTitle: plain(activity.title, 200), uid,
      name: nameOf(student), authorName: plain(authorName || (kind === "teacher" ? "선생님" : "친구"), 80), kind, text: plain(text), date, href: href(activity.id) });
  };
  for (const note of list(records.bookOpinionNotes)) if (has(note.reply)) add(note, note.authorId, note.reply, "teacher", "선생님", dayOf(note.replyAt));
  for (const review of list(records.bookPeerReviews)) {
    if (!allowedMembers.has(review.fromUid)) continue;
    add(review, review.toUid, review.html || review.text, "peer", review.fromName, dayOf(review.createdAt));
  }
  for (const comment of list(records.bookHashtagComments)) {
    if (!comment.byTeacher && !allowedMembers.has(comment.authorId)) continue;
    add(comment, comment.postUid, comment.text, comment.byTeacher ? "teacher" : "peer", comment.authorName, dayOf(comment.createdAt));
  }
  return rows.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id));
}

const bookKey = (book) => plain(book.isbn, 30).replace(/[\s-]/g, "") || `${plain(book.title, 150).normalize("NFKC").toLowerCase()}|${plain(book.author, 100).normalize("NFKC").toLowerCase()}`;
function sourceReading(state, now) {
  const derived = deriveReading(state, now);
  const books = new Map(derived.books.map((book) => [book.id, book]));
  const totals = new Map(); const complete = new Set();
  const pages = [], completions = [], reviews = [];
  for (const event of derived.events) {
    const book = books.get(event.bookId);
    if (event.kind === "pages" && book && event.xp > 0) {
      pages.push({ id: String(event.id).slice("pages:".length), date: event.date, classId: event.classId, bookId: book.id, pages: event.xp });
      const count = (totals.get(book.id) || 0) + event.xp;
      totals.set(book.id, count);
      if (count >= book.totalPages && !complete.has(book.id)) {
        complete.add(book.id); completions.push({ date: event.date, classId: event.classId, bookId: book.id });
      }
    } else if (event.kind === "review" && book) reviews.push({ date: event.date, classId: event.classId, bookId: book.id });
  }
  return { derived, books, pages, completions, reviews };
}
function scopedReading(sources, roster, classId, range) {
  const days = new Set(), readers = new Set(), books = new Set();
  const daily = new Map(); const aggregates = new Map(); const members = [];
  let pages = 0, completed = 0, reviews = 0;
  for (const student of roster) {
    const source = sources.get(student.uid);
    const row = { uid: student.uid, name: nameOf(student), studentId: plain(student.studentId, 30), pages: 0, days: 0, completed: 0, reviews: 0, books: 0 };
    const mineDays = new Set(), mineBooks = new Set();
    for (const record of source?.pages ?? []) {
      if (record.classId !== classId || !inRange(record.date, range)) continue;
      const book = source.books.get(record.bookId); const key = bookKey(book);
      row.pages += record.pages; pages += record.pages; mineDays.add(record.date); mineBooks.add(record.bookId);
      days.add(record.date); readers.add(student.uid); books.add(key);
      const day = daily.get(record.date) ?? { date: record.date, pages: 0, users: new Set() };
      day.pages += record.pages; day.users.add(student.uid); daily.set(record.date, day);
      const aggregate = aggregates.get(key) ?? { key, title: plain(book.title, 150), author: plain(book.author, 100), pages: 0, users: new Set() };
      aggregate.pages += record.pages; aggregate.users.add(student.uid); aggregates.set(key, aggregate);
    }
    row.days = mineDays.size; row.books = mineBooks.size;
    row.completed = (source?.completions ?? []).filter((record) => record.classId === classId && inRange(record.date, range)).length;
    row.reviews = (source?.reviews ?? []).filter((record) => record.classId === classId && inRange(record.date, range)).length;
    completed += row.completed; reviews += row.reviews; members.push(row);
  }
  const dayRows = [];
  const weeks = new Map();
  for (let date = range.start; date <= range.end; date = shift(date, 1)) {
    const day = daily.get(date);
    dayRows.push({ date, pages: day?.pages ?? 0, readers: day?.users.size ?? 0 });
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const start = shift(date, -(weekday === 0 ? 6 : weekday - 1));
    const week = weeks.get(start) ?? { start, label: `${Number(start.slice(5, 7))}.${Number(start.slice(8))}`, pages: 0, users: new Set() };
    week.pages += day?.pages ?? 0;
    for (const uid of day?.users ?? []) week.users.add(uid);
    weeks.set(start, week);
  }
  return {
    summary: { pages, days: days.size, readers: readers.size, completed, reviews, books: books.size },
    members, daily: dayRows, weekly: [...weeks.values()].map((week) => ({ start: week.start, label: week.label, pages: week.pages, readers: week.users.size })),
    books: [...aggregates.values()].map((book) => ({ key: book.key, title: book.title, author: book.author, pages: book.pages, readers: book.users.size }))
      .sort((a, b) => b.readers - a.readers || b.pages - a.pages || a.title.localeCompare(b.title, "ko")),
  };
}
function personalReading(source, activities) {
  const summary = source.derived;
  const available = new Set(activities.map((activity) => activity.id));
  const reviewedBooks = new Set(summary.reviews.map((review) => review.bookId));
  const nextBySeries = new Map();
  for (const badge of summary.badges) if (!badge.earned && !nextBySeries.has(badge.series)) nextBySeries.set(badge.series, badge);
  return {
    level: summary.level, xp: summary.xp, nextXp: summary.nextXp, expToNextLevel: summary.expToNextLevel, progress: summary.progress,
    totalBooks: summary.totalBooks, totalPages: summary.totalPages, currentStreak: summary.currentStreak, longestStreak: summary.longestStreak,
    badges: summary.badges.map((badge) => ({ ...badge })),
    nextBadges: [...nextBySeries.values()].sort((a, b) => b.progress - a.progress || a.threshold - b.threshold).slice(0, 3).map((badge) => ({ ...badge })),
    library: summary.books.map((book) => ({ id: book.id, title: plain(book.title, 150), author: plain(book.author, 100), status: book.status,
      progress: book.progress, pagesRead: book.pagesRead, totalPages: book.totalPages, archived: book.archived === true, hasReview: reviewedBooks.has(book.id), activityId: available.has(book.activityId) ? book.activityId : null })),
  };
}

export function buildDashboardData(input, options = {}) {
  const now = new Date(input.now ?? new Date());
  if (!Number.isFinite(now.getTime())) throw new Error("기준 날짜를 확인해 주세요.");
  const classDoc = input.classDoc;
  if (!classDoc?.id || classDoc.archived === true) throw new Error("운영 중인 반을 선택해 주세요.");
  const view = input.role === "teacher" ? "teacher" : "student";
  const roster = list(input.roster).filter((student) => student?.uid && (!student.role || student.role === "student") && (view === "teacher" || student.uid === input.uid))
    .map((student) => ({ ...student, name: nameOf(student) })).filter((student, index, all) => all.findIndex((row) => row.uid === student.uid) === index).sort(compareStudents);
  const activities = list(input.activities).filter((activity) => activity.classId === classDoc.id && !activity.deleted && DASHBOARD_ACTIVITY_LABELS[activity.type]);
  const ids = new Set(activities.map((activity) => activity.id));
  const records = Object.fromEntries(Object.entries(input.records ?? {}).map(([key, rows]) => [key, list(rows).filter((record) => ids.has(record.activityId) && (!record.classId || record.classId === classDoc.id))]));
  const members = new Set(view === "teacher" ? roster.map((student) => student.uid) : list(input.memberUids).length ? input.memberUids
    : [...roster.map((student) => student.uid), ...list(records.bookGroups).flatMap((group) => [...list(group.memberUids), ...list(group.members).map((member) => member.uid)])]);
  const period = dashboardPeriod(options.period || "weekly", now, { start: options.start, end: options.end, semesterStart: classDoc.dashboardSemesterStart, semesterEnd: classDoc.dashboardSemesterEnd });
  const selectedId = options.activityId || input.selectedActivityId;
  const selected = activities.find((activity) => activity.id === selectedId) ?? activities.slice().sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt))[0] ?? null;
  let activity = null;
  if (selected) {
    const rows = roster.map((student) => activityProgress(selected, student, records, members));
    activity = { id: selected.id, type: selected.type, title: plain(selected.title, 200), label: DASHBOARD_ACTIVITY_LABELS[selected.type], href: href(selected.id),
      eligible: rows.filter((row) => row.state !== "waiting").length, started: rows.filter((row) => ["doing", "done"].includes(row.state)).length,
      done: rows.filter((row) => row.state === "done").length, waiting: rows.filter((row) => row.state === "waiting").length,
      completionSupported: !["mindmap", "opinion"].includes(selected.type) && !(selected.type === "consonant" && selected.groupMode !== "solo"), rows };
  }
  let reading = null;
  if (readingEnabled(classDoc)) {
    const sources = new Map(roster.map((student) => [student.uid, sourceReading(input.readingStates?.[student.uid], now)]));
    reading = scopedReading(sources, roster, classDoc.id, period);
    reading.previous = period.previous ? scopedReading(sources, roster, classDoc.id, period.previous).summary : null;
    reading.personal = view === "student" && sources.has(input.uid) ? personalReading(sources.get(input.uid), activities) : null;
    reading.dayRecords = [];
    if (view === "student" && sources.has(input.uid)) {
      const source = sources.get(input.uid);
      const events = new Map(source.pages.filter((event) => event.classId === classDoc.id && inRange(event.date, period)).map((event) => [event.id, event]));
      reading.dayRecords = source.derived.logs.filter((record) => typeof record.id === "string" && record.classId === classDoc.id && events.has(record.id)).map((record) => ({
        id: record.id, date: record.date, bookId: record.bookId, title: plain(source.books.get(record.bookId)?.title, 150),
        startPage: record.startPage, endPage: record.endPage, pages: events.get(record.id).pages, notes: plain(record.notes, 2000),
      }));
    }
  }
  return {
    view, class: { id: classDoc.id, name: plain(classDoc.name, 200), readingEnabled: readingEnabled(classDoc), semesterStart: validDay(classDoc.dashboardSemesterStart) ? classDoc.dashboardSemesterStart : null, semesterEnd: validDay(classDoc.dashboardSemesterEnd) ? classDoc.dashboardSemesterEnd : null },
    period, generatedAt: now.toISOString(), activities: activities.map((activity) => ({ id: activity.id, type: activity.type, title: plain(activity.title, 200), topic: plain(activity.topic, 150), label: DASHBOARD_ACTIVITY_LABELS[activity.type], href: href(activity.id) })),
    selectedActivityId: selected?.id ?? null, activity,
    reflections: reflectionProjection(activities, roster, records, period, view),
    feedback: feedbackProjection(view === "teacher" ? (selected ? [selected] : []) : activities, roster, records, period, members),
    studentActivities: view === "student" ? activities.map((current) => {
      const row = activityProgress(current, roster[0] ?? { uid: input.uid, name: "나" }, records, members);
      return { id: current.id, type: current.type, title: plain(current.title, 200), label: DASHBOARD_ACTIVITY_LABELS[current.type], href: href(current.id), state: row.state, labelStatus: row.label, filled: row.filled, total: row.total, locked: current.locked === true, preview: row.preview };
    }) : [], reading,
  };
}
