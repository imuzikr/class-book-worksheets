// =============================================================
// 책 광장 — 셈만 모은 곳 (components/reading/ReadingPlaza.jsx)
// -------------------------------------------------------------
// 책나눔의 셋째 탭. 광장 그림 위를 내 캐릭터가 걸어 다니다가
//   · 가판대  = 반 친구들의 독서 발자국(완독한 책에 남긴 발자국도)
//   · 책꽂이  = 반 친구들의 완독 감상(한 권의 책)
// 을 읽고 댓글을 남깁니다(선생님 요청). 기준 문서는 READING_GROWTH.md의 '책 광장' 절.
//
// 무엇이 반 친구에게 보이나(선생님 결정 — "학생이 선택할 수 있는 옵션을 제거하고 모두 공개")
//   · **선생님이 책 광장을 켠 반에서는 그 반에서 쓴 독서 발자국 · 한 권의 책이 모두 보입니다.** 학생이 고르는 칸은
//     없습니다(한때 발자국은 '광장을 켠 뒤에 쓴 것만' · 책마다 '발자국 보이기'를 끌 수 있었고, 한 권의 책은 학생이
//     '광장 책꽂이에 꽂기'를 누른 것만 보였습니다 — 걷었습니다. **되살리지 마세요.** 그 시절의 표시
//     log.plaza · book.plazaHidden · review.shelved는 서재에 남아 있어도 아무도 읽지 않습니다).
//   · 켜기 전에 쓴 글도 켜는 순간부터 보입니다(서버가 그 반의 사본을 한 번 통째로 맞춤 — PLAZA_SHARE_RULE).
//   · 광장을 끄면 반 친구는 아무것도 못 읽습니다 — 본인과 선생님만 봅니다(규칙이 사본 읽기를 막고 화면도 탭을 걷음).
//   · 안 보이는 것 — 보관함으로 옮긴 책 · 선생님이 광장에서 내린 책 · 다른 반에서 쓴 글.
//   · 서재 정본(users/{uid}/reading/main)은 지금처럼 서버만 읽습니다. 광장에 보이는 것은 서버가
//     저장할 때마다 맞춰 두는 **공유 사본**입니다(plazaProjection → classes/{c}/plazaShelves · plazaBooks).
//
// 이 파일은 서버(lib/server/readingService.js) · 데모(lib/data/plaza.js) · 화면이 함께 씁니다.
// 광장 그림 위의 걷는 길 · 여는 곳(무대만 쓰는 셈)은 lib/readingPlazaMap.js에 따로 둡니다 — 광장 탭을 열 때만
// 내려받는 코드라, 책방 첫 화면이 그만큼 무거워지지 않게.
// =============================================================
import { kstToday, PLAZA_SHARE_RULE, plazaNeedsSync, plazaOn, readingPeriodKey } from "./reading.js";

// 공유 사본의 기준 번호(PLAZA_SHARE_RULE)와 '반 전체를 맞출 일이 있는가'(plazaNeedsSync)는 lib/reading.js에 있습니다 —
// 책방 첫 화면이 쓰는 값이라 그쪽에 두고 여기서 다시 내보냅니다.
export { PLAZA_SHARE_RULE, plazaNeedsSync, plazaOn };

export const PLAZA_COMMENT_MAX = 500;
// 댓글 고치기 — 쓴 사람만, 한 댓글에 20번까지(넘으면 지우고 다시 남김 · 이력이 한없이 길어지지 않게). 고친 댓글에는
// '수정됨'이 붙고, 고치기 전 글 · 지운 글은 담당 선생님만 읽는 이력(classes/{c}/plazaCommentLog — 서버만 씀)에 남습니다
// (선생님 요청 — 친구에게 상처 주는 댓글을 고치거나 지워도 확인할 수 있게. 아래 plazaCommentHistory).
export const PLAZA_COMMENT_EDIT_MAX = 20;
// 책 한 권의 공유 사본에 싣는 발자국 수(가장 최근 것부터) · 글자 수 천장 — 문서 한 장(1MB)을 넘지 않게.
export const PLAZA_LOG_CAP = 60;
export const PLAZA_TEXT_BUDGET = 60000;
// 학생 한 명의 목록에 서는 책 수(가장 최근에 글을 쓴 책부터)
export const PLAZA_BOOK_CAP = 40;
export const PLAZA_PLACES = Object.freeze(["stall", "shelf"]);

export const plazaBookKey = (uid, bookId) => `${uid}_${bookId}`;

const clip = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const laterOf = (a, b) => (String(a ?? "") >= String(b ?? "") ? a : b);

// 한 반에서 그 학생의 공유 사본 — 서재 정본(state)과 그 셈(summary = deriveReading)에서 뽑습니다.
// 돌려주는 값 { entries: [목록 한 줄…], books: { [bookId]: 책 한 권의 내용 } } — 이름 · 댓글 수는 서버가 붙입니다.
//   place는 옛 화면과 책 문서의 호환을 위해 책 상태를 유지합니다. 새 목록은 previews를 보고 기록 종류별로 나눕니다.
//   발자국이 있으면 가판대 · 한 권의 책이 있으면 책꽂이 — 둘 다 있으면 두 곳에 보이지만 사본은 책마다 한 장입니다.
//   그 반에서 쓴 글이 하나도 없는 책은 싣지 않습니다.
//   **학생이 고르는 것이 없습니다** — 그 반에서 쓴 발자국 · 한 권의 책을 모두 싣습니다(머리말의 '무엇이 보이나').
//   blocked — 선생님이 광장에서 내린 책 id들(그 책은 사본을 만들지 않음).
export function plazaProjection(summary, classId, { blocked = [] } = {}) {
  const off = new Set(blocked);
  const entries = [];
  const books = {};
  for (const book of summary?.books ?? []) {
    if (!book || book.archived || off.has(book.id)) continue;
    const logs = (summary.logs ?? []).filter((log) => log.bookId === book.id && log.classId === classId);
    const review = (summary.reviews ?? []).find((r) => r.bookId === book.id && r.classId === classId) ?? null;
    if (!logs.length && !review) continue;
    const status = book.status === "completed" ? "completed" : book.status === "paused" ? "paused" : "reading";
    const place = status === "completed" ? "shelf" : "stall";
    // 가장 최근에 '쓴' 때 — 이번 주 판정과 차례에 씁니다(발자국은 쓴 때, 한 권의 책은 고친 때).
    let logLast = "";
    for (const log of logs) logLast = laterOf(logLast, log.createdAt);
    const reviewLast = review?.updatedAt || review?.createdAt || null;
    const last = laterOf(logLast, reviewLast);
    // 최근 것부터 PLAZA_LOG_CAP개 · 글자 천장 안에서(오래된 것부터 빠짐). 보여 줄 때는 화면이 날짜순으로 다시 세웁니다.
    const recent = logs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    const kept = [];
    let budget = PLAZA_TEXT_BUDGET - (review ? String(review.text ?? "").length : 0);
    for (const log of recent) {
      if (kept.length >= PLAZA_LOG_CAP) break;
      const notes = String(log.notes ?? "");
      if (kept.length && budget - notes.length < 0) break;
      budget -= notes.length;
      kept.push({ id: log.id, date: log.date, startPage: log.startPage, endPage: log.endPage, notes, createdAt: log.createdAt ?? null });
    }
    const newest = recent[0] ?? null;
    const base = {
      title: String(book.title ?? ""), author: String(book.author ?? ""),
      cover: typeof book.coverImage === "string" && book.coverImage ? book.coverImage : null,
      total: book.totalPages, read: book.pagesRead ?? 0, status, place,
      rating: review ? review.rating : null, last: last || null,
    };
    entries.push({
      id: book.id, ...base, logs: logs.length,
      lastDate: newest?.date ?? null,
      // 책꽂이(완독)는 한 권의 책이 앞, 아직 안 썼으면 가장 최근 발자국 · 가판대는 가장 최근 발자국이 앞
      excerpt: clip(place === "shelf" ? (review?.text ?? newest?.notes ?? "") : (newest?.notes ?? review?.text ?? ""), 80),
      // 목록만으로 두 곳의 차례·이번 주·글 한 줄을 정합니다. 종류를 나누려고 책마다 추가로 읽지 않습니다.
      previews: {
        stall: logs.length ? { last: logLast || null, excerpt: clip(newest?.notes ?? "", 80) } : null,
        shelf: review ? { last: reviewLast, excerpt: clip(review.text, 80) } : null,
      },
    });
    books[book.id] = {
      bookId: book.id, ...base, logCount: logs.length, logs: kept,
      review: review ? { text: String(review.text ?? ""), rating: review.rating, createdAt: review.createdAt ?? null, updatedAt: review.updatedAt ?? null } : null,
    };
  }
  entries.sort((a, b) => String(b.last ?? "").localeCompare(String(a.last ?? "")) || a.id.localeCompare(b.id));
  const shown = entries.slice(0, PLAZA_BOOK_CAP);
  const keep = new Set(shown.map((e) => e.id));
  for (const id of Object.keys(books)) if (!keep.has(id)) delete books[id];
  return { entries: shown, books };
}

// 그 서재에 이 반에서 쓴 글(발자국 · 한 권의 책)이 하나라도 있는가 — 광장을 꺼 둔 반에서도, 이미 만들어 둔 사본은
// 고치기 · 삭제를 따라가야 하므로 서버가 '사본을 살펴볼 일이 있는가'를 이것으로 봅니다(있으면 목록 한 장을 읽어 봄).
export function plazaHasContent(state, classId) {
  return (state?.logs ?? []).some((log) => log?.classId === classId)
    || (state?.reviews ?? []).some((r) => r?.classId === classId);
}

// 바뀐 책만 다시 쓰도록 견주는 값(칸 차례가 달라도 같게)
export function plazaStable(value) {
  if (Array.isArray(value)) return `[${value.map(plazaStable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${plazaStable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

// 목록 한 줄을 여는 곳의 기록 종류에 맞춥니다. 해당 글이 없으면 null입니다.
// 옛 사본은 한 번 맞춰지기 전까지 logs · rating으로 존재 여부만 복구합니다. 반대 종류의 글 한 줄과 시각은
// 옛 excerpt · last에서 가를 수 없으므로 비웁니다 — 완독 감상이 가판대에 잠깐 나타나지 않게.
export function plazaEntryForPlace(entry, place) {
  if (!entry || typeof entry.id !== "string" || !PLAZA_PLACES.includes(place)) return null;
  const logs = Number(entry.logs);
  const logCount = Number.isFinite(logs) ? Math.max(0, Math.floor(logs)) : 0;
  let preview;
  if (entry.previews && typeof entry.previews === "object" && !Array.isArray(entry.previews)) {
    preview = entry.previews[place];
    if (!preview || typeof preview !== "object" || Array.isArray(preview)) return null;
  } else {
    const rating = Number(entry.rating);
    const hasReview = Number.isInteger(rating) && rating >= 1 && rating <= 5;
    if (place === "stall" ? !logCount : !hasReview) return null;
    const samePlace = entry.place === place;
    preview = {
      // 옛 last는 발자국·감상 중 최신 시각이어서 둘 다 있으면 어느 종류의 시각인지 알 수 없습니다.
      last: samePlace && !(logCount && hasReview) ? entry.last : null,
      excerpt: samePlace ? entry.excerpt : "",
    };
  }
  return {
    ...entry, place, last: typeof preview.last === "string" ? preview.last : null, excerpt: clip(preview.excerpt, 80),
    logs: place === "stall" ? logCount : 0, rating: place === "shelf" ? entry.rating : null,
  };
}

// ── 이번 주 ──────────────────────────────────────────────────
// 한 주는 서울 시각 월요일 0시에 시작합니다(반 순위의 '이번 주'와 같은 주 — lib/reading.js의 readingPeriodKey).
export function plazaWeekStart(now = new Date()) {
  return `${readingPeriodKey("weekly", now)}T00:00:00+09:00`;
}
export function plazaThisWeek(iso, now = new Date()) {
  const at = Date.parse(iso ?? "");
  return Number.isFinite(at) && at >= Date.parse(plazaWeekStart(now));
}

// 목록 문서들(학생마다 한 장 — plazaShelves) → 화면에 늘어놓을 책들.
//   place로 가판대/책꽂이를, friendUid로 한 친구를 고릅니다. 최근에 쓴 차례.
//   돌려주는 값 { week: 이번 주에 글이 있는 책, earlier: 그전 책 } — 줄마다 주인의 uid · name · studentId가 붙습니다.
export function plazaItems(shelves = [], { place = "stall", friendUid = null, now = new Date() } = {}) {
  const rows = [];
  for (const shelf of shelves) {
    if (!shelf?.uid || (friendUid && shelf.uid !== friendUid)) continue;
    for (const entry of Array.isArray(shelf.books) ? shelf.books : []) {
      const item = plazaEntryForPlace(entry, place);
      if (!item) continue;
      // 댓글 수는 목록 문서의 counts.{bookId}(서버가 댓글을 달고 지울 때 셈)
      rows.push({ ...item, key: plazaBookKey(shelf.uid, item.id), uid: shelf.uid, name: shelf.name || "이름 미설정", studentId: shelf.studentId || "", comments: Math.max(0, Number(shelf.counts?.[item.id]) || 0) });
    }
  }
  rows.sort((a, b) => String(b.last ?? "").localeCompare(String(a.last ?? "")) || a.key.localeCompare(b.key));
  return { week: rows.filter((r) => plazaThisWeek(r.last, now)), earlier: rows.filter((r) => !plazaThisWeek(r.last, now)) };
}

// 친구별 보기의 명단 — 광장에 책이 있는 친구만, 학번순. { uid, name, studentId, stall, shelf }
export function plazaFriends(shelves = []) {
  return shelves.filter((s) => s?.uid && Array.isArray(s.books) && s.books.length).map((s) => ({
    uid: s.uid, name: s.name || "이름 미설정", studentId: s.studentId || "",
    stall: s.books.filter((b) => plazaEntryForPlace(b, "stall")).length,
    shelf: s.books.filter((b) => plazaEntryForPlace(b, "shelf")).length,
  })).sort((a, b) => String(a.studentId).localeCompare(String(b.studentId), "ko", { numeric: true }) || a.name.localeCompare(b.name, "ko") || a.uid.localeCompare(b.uid));
}

// 이름표 — '30105 홍길동'(학번이 없으면 이름만). 선생님 댓글은 '선생님'.
export function plazaNameLabel(row) {
  if (row?.byTeacher) return "선생님";
  const name = row?.name || "이름 미설정";
  return row?.studentId ? `${row.studentId} ${name}` : name;
}

// 댓글 글 — 앞뒤 공백을 걷고 1~500자. 아니면 던집니다(서버 · 데모가 같은 검사).
export function plazaCommentText(value) {
  if (typeof value !== "string") throw new Error("댓글을 확인해 주세요.");
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > PLAZA_COMMENT_MAX) throw new Error(`댓글은 ${PLAZA_COMMENT_MAX}자 이내로 적어 주세요.`);
  return text;
}

// 고친 적이 있는 댓글인가 — '수정됨' 표시(쓴 글의 옛 모습은 반 친구에게 보내지 않음 · 이력은 선생님만)
export function plazaCommentEdited(row) {
  return (Number(row?.edits) || 0) > 0;
}

// 학생 한 명의 댓글 이력 — 지금 있는 댓글(plazaComments)과 고치기 · 지우기 기록(plazaCommentLog)을 댓글마다 묶습니다.
//   comments  [{ id, uid, name, studentId, byTeacher, ownerUid, bookId, book, text, at, edits, editedAt }] — 때는 ms
//   logs      [{ id, commentId, kind: "edit" | "delete", uid, name, studentId, byTeacher, ownerUid, bookId, book, title,
//                text(고치기 전 글 · 지운 글), after(고친 글), at(처음 쓴 때), doneAt, doneBy, doneByTeacher }]
//   titles    Map(책 열쇠 → 지금 광장에 있는 책의 제목) — 기록에는 그때의 제목이 함께 있습니다
// 돌려줌 { written, received } — 줄기마다
//   { id, uid, name, studentId, byTeacher, ownerUid, bookId, book, title, at(처음 쓴 때), editedAt,
//     versions: [{ text, at, kind: "first" | "edit" | "latest" }], current(지금 보이는 글 · 지웠으면 null),
//     deleted: null | { text, at, by, byTeacher }, edits(고친 횟수), gap(고친 횟수만큼의 기록을 못 찾음) }
//   · 쓴 댓글 = 그 학생이 쓴 것(제 책에 단 것 포함) · 받은 댓글 = 그 학생의 책에 친구 · 선생님이 단 것
//   · 처음 쓴 때가 최근인 줄기가 위(서버 시각이 아직 안 온 방금 것은 맨 위)
//   · gap — 댓글은 고친 횟수를 알지만 그만큼의 기록이 없을 때(이력을 읽지 못함). 그때 versions는 지금 글 하나('latest')입니다.
export function plazaCommentHistory({ uid, comments = [], logs = [], titles = new Map() } = {}) {
  const ms = (v) => (Number.isFinite(v) ? v : null);
  const threads = new Map();
  const base = (row, id) => ({
    id, uid: row.uid ?? null, name: row.name || "", studentId: row.studentId || "", byTeacher: row.byTeacher === true,
    ownerUid: row.ownerUid ?? null, bookId: row.bookId ?? null, book: row.book ?? null,
    title: (row.book && titles.get(row.book)) || row.title || "", at: ms(row.at), editedAt: null,
    current: null, edits: 0, editLog: [], deleted: null,
  });
  for (const c of comments) {
    if (!c?.id) continue;
    const t = base(c, c.id);
    t.current = String(c.text ?? "");
    t.edits = Math.max(0, Number(c.edits) || 0);
    t.editedAt = ms(c.editedAt);
    threads.set(c.id, t);
  }
  const ordered = logs.filter((l) => l?.commentId && (l.kind === "edit" || l.kind === "delete"))
    .slice().sort((a, b) => (ms(a.doneAt) ?? Infinity) - (ms(b.doneAt) ?? Infinity) || String(a.id ?? "").localeCompare(String(b.id ?? "")));
  for (const l of ordered) {
    let t = threads.get(l.commentId);
    if (!t) { t = base(l, l.commentId); threads.set(l.commentId, t); }
    if (!t.title && l.title) t.title = l.title;
    if (t.at == null && ms(l.at) != null) t.at = ms(l.at);
    if (l.kind === "edit") t.editLog.push({ before: String(l.text ?? ""), after: String(l.after ?? ""), at: ms(l.doneAt) });
    else t.deleted = { text: String(l.text ?? ""), at: ms(l.doneAt), by: l.doneBy ?? null, byTeacher: l.doneByTeacher === true };
  }
  const rows = [];
  for (const { editLog, ...t } of threads.values()) {
    const edits = Math.max(t.edits, editLog.length);
    const gap = edits > editLog.length;
    const versions = editLog.length
      ? [{ text: editLog[0].before, at: t.at, kind: "first" }, ...editLog.map((e) => ({ text: e.after, at: e.at, kind: "edit" }))]
      : gap ? [{ text: t.current ?? t.deleted?.text ?? "", at: t.editedAt, kind: "latest" }]
        : [{ text: t.current ?? t.deleted?.text ?? "", at: t.at, kind: "first" }];
    rows.push({ ...t, versions, edits, gap });
  }
  rows.sort((a, b) => (b.at ?? Infinity) - (a.at ?? Infinity) || String(b.id).localeCompare(String(a.id)));
  return {
    written: rows.filter((t) => t.uid === uid),
    received: rows.filter((t) => t.ownerUid === uid && t.uid !== uid),
  };
}

// 발자국을 읽기 좋은 차례로(최근 날짜가 위)
export function plazaLogsNewestFirst(logs = []) {
  return logs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export function plazaDayLabel(dateKey, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey ?? ""))) return "";
  const today = kstToday(now);
  if (dateKey === today) return "오늘";
  const [, m, d] = dateKey.split("-").map(Number);
  return `${m}월 ${d}일`;
}
