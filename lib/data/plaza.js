// =============================================================
// 책 광장의 자료 함수 (components/reading/ReadingPlaza.jsx)
// -------------------------------------------------------------
// 읽기 — 서버가 맞춰 둔 공유 사본을 Firestore에서 곧바로 구독합니다(규칙: 같은 반 학생 · 담당 교사).
//   · subscribePlazaShelves  반의 목록(학생마다 한 장 — 책 제목 · 쪽수 · 최근 글 한 줄 · 댓글 수)
//   · subscribePlazaBook     책 한 권(독서 발자국 · 한 권의 책) — 그 책을 연 동안만
//   · subscribePlazaComments 그 책의 댓글 — 그 책을 연 동안만
//   · subscribeMyPlazaShelf  내 목록 한 장(서재 쪽 — 선생님이 내린 책 · 내 책의 댓글 수)
// 쓰기 — 서버 API(/api/reading/plaza)만: 댓글 달기 · 고치기(쓴 사람만) · 지우기, [교사] 책을 광장에서 내리기 · 다시 올리기.
// 댓글 이력 — [교사] 학생 한 명이 쓴 · 받은 댓글을 고친 글 · 지운 글까지(fetchPlazaCommentHistory). 고치기 전 글과 지운 글은
//   서버가 classes/{c}/plazaCommentLog에 남기고 **담당 교사만** 읽습니다(규칙 · 반 친구에게는 '수정됨'만 보임).
// 광장을 켠 반에서는 그 반에서 쓴 발자국 · 한 권의 책이 **모두** 보입니다(학생이 고르는 것이 없음 — lib/readingPlaza.js).
// 사본은 서재의 저장(mutateReading)이 그때마다 맞추고, 켜기 전에 쓴 글은 서버가 반 전체를 한 번 맞춥니다(syncPlazaClass).
//
// 데모는 서버가 없으므로 메모리 서재(lib/data/reading.js)에서 같은 셈(plazaProjection)으로 그 자리에서 만듭니다.
// 댓글 · 댓글 이력 · 선생님이 내린 책은 이 브라우저 탭 안에서만 남습니다(새로고침하면 처음으로).
// =============================================================
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { demoSuspendedSet, isAdmin, isTeacher } from "../user";
import { deriveReading, plazaOn } from "../reading";
import { PLAZA_COMMENT_EDIT_MAX, PLAZA_PLACES, plazaBookKey, plazaCommentHistory, plazaCommentText, plazaProjection } from "../readingPlaza";
import { mock, mockListeners } from "./shared";
import { buildMockDirectory } from "./users";
import { demoReadingAccess, demoReadingState, onDemoReadingChange, readingRequest } from "./reading";

function fail(message, code = "permission-denied") {
  return Object.assign(new Error(message), { code });
}
const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : typeof value === "number" ? value : value ? Date.parse(value) || null : null);
// 댓글은 단 차례로(서버 시각이 아직 안 온 방금 것은 맨 뒤)
const byTime = (a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || String(a.id).localeCompare(String(b.id));
const commentRow = (id, data) => ({
  id, book: data.book, ownerUid: data.ownerUid, bookId: data.bookId, uid: data.uid,
  name: data.name || "이름 미설정", studentId: data.studentId || "", byTeacher: data.byTeacher === true,
  text: String(data.text ?? ""), at: millis(data.at),
  edits: Math.max(0, Number(data.edits) || 0), editedAt: millis(data.editedAt),
});
// 댓글 이력 한 장(서버의 plazaLogRow와 같은 칸 — 때는 ms로)
const logRow = (id, data) => ({
  id, commentId: data.commentId, kind: data.kind, uid: data.uid ?? null, name: data.name || "", studentId: data.studentId || "",
  byTeacher: data.byTeacher === true, book: data.book ?? null, ownerUid: data.ownerUid ?? null, bookId: data.bookId ?? null,
  title: String(data.title ?? ""), text: String(data.text ?? ""), after: String(data.after ?? ""),
  at: millis(data.at), doneAt: millis(data.doneAt), doneBy: data.doneBy ?? null, doneByTeacher: data.doneByTeacher === true,
});

// ── 데모 ─────────────────────────────────────────────────────
const demoComments = [];          // 댓글 줄들
const demoCommentLog = [];        // 댓글 이력(고치기 · 지우기 — 서버의 plazaCommentLog와 같은 모양)
let logSeq = 0;
const nextLogSeq = () => { logSeq += 1; return logSeq; };
const demoBlocked = new Map();    // 주인 uid → Set(선생님이 내린 책 id)
const demoListeners = new Set();
let demoSeeded = false;
const demoEmit = () => demoListeners.forEach((fn) => fn());

function demoGate(classId) {
  const user = demoReadingAccess(classId);
  if (!plazaOn(mock.classes.find((c) => c.id === classId))) throw fail("이 반에서는 책 광장을 사용하지 않습니다.", "reading/plaza-disabled");
  return user;
}
function demoMembers(classId) {
  return [...new Set((mock.memberships ?? []).filter((m) => m.classId === classId).map((m) => m.uid))];
}
function demoShelf(classId, uid, dir) {
  const profile = dir.find((p) => p.uid === uid) ?? {};
  const blocked = [...(demoBlocked.get(uid) ?? [])];
  const projection = plazaProjection(deriveReading(demoReadingState(uid), new Date()), classId, { blocked });
  const counts = {};
  for (const c of demoComments) if (c.ownerUid === uid) counts[c.bookId] = (counts[c.bookId] ?? 0) + 1;
  return {
    shelf: { id: uid, uid, name: profile.realName || "이름 미설정", studentId: profile.studentId || "", books: projection.entries, blocked, counts },
    projection,
  };
}
function demoShelves(classId) {
  const dir = buildMockDirectory();
  return demoMembers(classId).map((uid) => demoShelf(classId, uid, dir).shelf);
}
// 체험반에 미리 달아 둔 댓글 — 처음 광장을 열 때 한 번. 책마다 다른 친구가 한두 마디씩.
const DEMO_LINES = [
  "이 장면 나도 기억에 남았어!", "다음 내용이 궁금해져서 나도 읽어 보려고.", "나는 그 인물이 조금 답답했는데, 네 생각을 읽으니 달리 보여.",
  "같은 책을 읽는 중이야. 끝까지 읽고 다시 이야기하자.", "마지막 문장이 좋다. 어떤 장면이었는지 더 알려 줘.", "나도 비슷한 경험이 있어서 공감했어.",
];
function ensureDemoPlaza(classId) {
  if (demoSeeded) return;
  demoSeeded = true;
  const shelves = demoShelves(classId).filter((s) => s.books.length);
  let n = 0;
  shelves.forEach((shelf, i) => {
    shelf.books.slice(0, 1).forEach((entry) => {
      const count = i % 3 === 2 ? 0 : 1 + (i % 2);
      for (let k = 0; k < count; k += 1) {
        const writer = shelves[(i + 1 + k * 3) % shelves.length];
        if (!writer || writer.uid === shelf.uid) continue;
        demoComments.push({
          id: `demo_plaza_comment_${n}`, book: plazaBookKey(shelf.uid, entry.id), ownerUid: shelf.uid, bookId: entry.id,
          uid: writer.uid, name: writer.name, studentId: writer.studentId, byTeacher: false,
          text: DEMO_LINES[n % DEMO_LINES.length], at: Date.now() - (shelves.length - i) * 3600000 - k * 600000,
        });
        n += 1;
      }
    });
  });
  const first = shelves[0];
  if (first?.books[0]) {
    demoComments.push({
      id: "demo_plaza_comment_teacher", book: plazaBookKey(first.uid, first.books[0].id), ownerUid: first.uid, bookId: first.books[0].id,
      uid: "bookbom_demo_teacher", name: "선생님", studentId: "", byTeacher: true,
      text: "꾸준히 남긴 발자국이 보기 좋아요. 인물의 마음이 달라진 까닭도 한번 적어 볼까요?", at: Date.now() - 1800000,
    });
  }
  // 선생님의 '댓글 이력' 창에서 보이게 — 첫 학생 댓글 하나는 한 번 고친 것, 같은 학생이 같은 책에 달았다 지운 것 하나
  const at = demoComments.findIndex((c) => !c.byTeacher);
  if (at >= 0) {
    const c = demoComments[at];
    const title = shelves.find((s) => s.uid === c.ownerUid)?.books.find((b) => b.id === c.bookId)?.title ?? "";
    const base = { uid: c.uid, name: c.name, studentId: c.studentId, byTeacher: false, book: c.book, ownerUid: c.ownerUid, bookId: c.bookId, title };
    demoCommentLog.push({ id: `demo_plaza_log_${nextLogSeq()}`, commentId: "demo_plaza_comment_gone", kind: "delete", ...base,
      text: "그 장면은 솔직히 별로였어. 왜 그걸 골랐는지 모르겠다.", after: "", at: c.at - 900000, doneAt: c.at - 600000, doneBy: c.uid, doneByTeacher: false });
    demoCommentLog.push({ id: `demo_plaza_log_${nextLogSeq()}`, commentId: c.id, kind: "edit", ...base,
      text: "이 장면 나도 기억에 남았어! 근데 글이 좀 짧다", after: c.text, at: c.at, doneAt: c.at + 120000, doneBy: c.uid, doneByTeacher: false });
    demoComments[at] = { ...c, edits: 1, editedAt: c.at + 120000 };
  }
}
// 데모 구독 — 서재 저장 · 댓글 · 내리기 · 반 설정이 바뀔 때마다 다시 셉니다.
function demoSubscribe(compute, onValue, onError) {
  let alive = true;
  let last = null;
  const run = () => {
    if (!alive) return;
    try {
      const value = compute();
      const json = JSON.stringify(value);
      if (json === last) return;
      last = json;
      onValue(value);
    } catch (error) {
      last = null;
      onError?.(error);
    }
  };
  demoListeners.add(run);
  mockListeners.classes.add(run);
  const offReading = onDemoReadingChange(run);
  run();
  return () => {
    alive = false;
    demoListeners.delete(run);
    mockListeners.classes.delete(run);
    offReading();
  };
}

// ── 읽기 ─────────────────────────────────────────────────────
// 반의 목록 — [{ uid, name, studentId, books: [목록 한 줄…], blocked, counts }] (lib/readingPlaza.js의 plazaItems가 받음)
export function subscribePlazaShelves(classId, onValue, onError = () => {}) {
  if (!classId) { onValue([]); return () => {}; }
  if (isFirebaseConfigured) {
    return onSnapshot(collection(db, "classes", classId, "plazaShelves"),
      (snap) => onValue(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  }
  return demoSubscribe(() => { demoGate(classId); ensureDemoPlaza(classId); return demoShelves(classId); }, onValue, onError);
}

// 내 목록 한 장 — 서재 쪽이 '선생님이 내린 책'과 내 책의 댓글 수를 보려고 구독합니다(없으면 null).
export function subscribeMyPlazaShelf(classId, uid, onValue, onError = () => {}) {
  if (!classId || !uid) { onValue(null); return () => {}; }
  if (isFirebaseConfigured) {
    return onSnapshot(doc(db, "classes", classId, "plazaShelves", uid),
      (snap) => onValue(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
  }
  return demoSubscribe(() => {
    demoGate(classId);
    ensureDemoPlaza(classId);
    return demoMembers(classId).includes(uid) ? demoShelf(classId, uid, buildMockDirectory()).shelf : null;
  }, onValue, onError);
}

// 책 한 권 — { uid, name, studentId, bookId, title, author, cover, total, read, status, place, logs, logCount, review, comments }
// 광장에서 내려갔으면(place가 없음) null을 줍니다.
export function subscribePlazaBook(classId, ownerUid, bookId, onValue, onError = () => {}) {
  if (!classId || !ownerUid || !bookId) { onValue(null); return () => {}; }
  if (isFirebaseConfigured) {
    return onSnapshot(doc(db, "classes", classId, "plazaBooks", plazaBookKey(ownerUid, bookId)), (snap) => {
      const data = snap.exists() ? snap.data() : null;
      onValue(data && PLAZA_PLACES.includes(data.place) ? { id: snap.id, ...data, comments: Math.max(0, Number(data.comments) || 0) } : null);
    }, onError);
  }
  return demoSubscribe(() => {
    demoGate(classId);
    ensureDemoPlaza(classId);
    const { shelf, projection } = demoShelf(classId, ownerUid, buildMockDirectory());
    const content = projection.books[bookId];
    return content ? { id: plazaBookKey(ownerUid, bookId), uid: ownerUid, name: shelf.name, studentId: shelf.studentId, ...content, comments: shelf.counts[bookId] ?? 0 } : null;
  }, onValue, onError);
}

// 그 책의 댓글 — 단 차례로. [{ id, uid, name, studentId, byTeacher, text, at(ms) }]
export function subscribePlazaComments(classId, ownerUid, bookId, onValue, onError = () => {}) {
  if (!classId || !ownerUid || !bookId) { onValue([]); return () => {}; }
  const key = plazaBookKey(ownerUid, bookId);
  if (isFirebaseConfigured) {
    // 등호 하나라 색인이 따로 필요 없습니다. 책 한 권의 댓글은 많아야 수백 건이라 차례는 화면에서 세웁니다.
    return onSnapshot(query(collection(db, "classes", classId, "plazaComments"), where("book", "==", key)),
      (snap) => onValue(snap.docs.map((d) => commentRow(d.id, d.data())).sort(byTime)), onError);
  }
  return demoSubscribe(() => {
    demoGate(classId);
    ensureDemoPlaza(classId);
    return demoComments.filter((c) => c.book === key).map((c) => ({ ...c })).sort(byTime);
  }, onValue, onError);
}

// ── 쓰기 ─────────────────────────────────────────────────────
function send(classId, body) {
  return readingRequest("/api/reading/plaza", { method: "POST", body: JSON.stringify({ classId, ...body }) });
}

// 댓글 달기 — 이름표는 서버가 프로필에서 붙입니다(학번 · 실명, 선생님은 '선생님').
export async function addPlazaComment(classId, ownerUid, bookId, text, requestId = globalThis.crypto.randomUUID()) {
  const clean = plazaCommentText(text);
  if (isFirebaseConfigured) return send(classId, { action: "comment", ownerUid, bookId, text: clean, requestId });
  const user = demoGate(classId);
  ensureDemoPlaza(classId);
  const { projection } = demoShelf(classId, ownerUid, buildMockDirectory());
  if (!projection.books[bookId]) throw fail("광장에서 내려간 책이에요.", "reading/plaza-gone");
  if (demoSuspendedSet().has(ownerUid)) throw fail("입력할 수 없습니다.", "reading/plaza-suspended");
  if (demoComments.some((c) => c.id === requestId)) return { comment: demoComments.find((c) => c.id === requestId), replayed: true };
  const byTeacher = isTeacher(user) || isAdmin(user);
  const comment = {
    id: requestId, book: plazaBookKey(ownerUid, bookId), ownerUid, bookId, uid: user.uid,
    name: byTeacher ? "선생님" : user.realName || "이름 미설정", studentId: byTeacher ? "" : user.studentId || "",
    byTeacher, text: clean, at: Date.now(),
  };
  demoComments.push(comment);
  demoEmit();
  return { comment, replayed: false };
}

// 댓글 지우기 — 쓴 사람과 선생님만(책 주인은 못 지움).
export async function deletePlazaComment(classId, commentId) {
  if (isFirebaseConfigured) return send(classId, { action: "deleteComment", commentId });
  const user = demoGate(classId);
  const at = demoComments.findIndex((c) => c.id === commentId);
  if (at < 0) return { deleted: false };
  const byTeacher = isTeacher(user) || isAdmin(user);
  if (!byTeacher && demoComments[at].uid !== user.uid) throw fail("내가 쓴 댓글만 지울 수 있어요.", "reading/forbidden");
  const [gone] = demoComments.splice(at, 1);
  demoLog(classId, gone, { kind: "delete", before: gone.text, by: user.uid, byTeacher });
  demoEmit();
  return { deleted: true };
}

// 댓글 고치기 — 쓴 사람만(선생님도 학생 댓글은 지우기만). 같은 글이면 그대로이고, 한 댓글에 PLAZA_COMMENT_EDIT_MAX번까지.
// 고칠 때마다 서버가 고치기 전 글을 선생님만 읽는 이력에 남기고, 반 친구에게는 '수정됨'만 보입니다.
export async function editPlazaComment(classId, commentId, text) {
  const clean = plazaCommentText(text);
  if (isFirebaseConfigured) return send(classId, { action: "editComment", commentId, text: clean });
  const user = demoGate(classId);
  const at = demoComments.findIndex((c) => c.id === commentId);
  if (at < 0) throw fail("이미 지워진 댓글이에요.", "reading/plaza-comment-gone");
  const comment = demoComments[at];
  if (comment.uid !== user.uid) throw fail("내가 쓴 댓글만 고칠 수 있어요.", "reading/forbidden");
  if (comment.text === clean) return { edited: false, comment: { ...comment } };
  const edits = Math.max(0, Number(comment.edits) || 0);
  if (edits >= PLAZA_COMMENT_EDIT_MAX) throw fail(`댓글은 ${PLAZA_COMMENT_EDIT_MAX}번까지 고칠 수 있어요. 지우고 다시 남겨 주세요.`, "reading/plaza-edit-limit");
  const { projection } = demoShelf(classId, comment.ownerUid, buildMockDirectory());
  if (!projection.books[comment.bookId]) throw fail("광장에서 내려간 책이에요.", "reading/plaza-gone");
  if (demoSuspendedSet().has(comment.ownerUid)) throw fail("입력할 수 없습니다.", "reading/plaza-suspended");
  demoLog(classId, comment, { kind: "edit", before: comment.text, after: clean, by: user.uid, byTeacher: isTeacher(user) || isAdmin(user) });
  // 제자리에서 고치지 않고 갈아 끼웁니다(구독하는 쪽이 새 값을 받게 — lib/mockDocs.js와 같은 생각)
  const next = { ...comment, text: clean, edits: edits + 1, editedAt: Date.now() };
  demoComments[at] = next;
  demoEmit();
  return { edited: true, comment: { ...next } };
}

// 데모의 댓글 이력 한 장 — 그때의 책 제목을 함께(내려간 책이면 빈 글)
function demoLog(classId, comment, { kind, before, after = "", by, byTeacher }) {
  let title = "";
  try { title = demoShelf(classId, comment.ownerUid, buildMockDirectory()).projection.books[comment.bookId]?.title ?? ""; } catch { title = ""; }
  demoCommentLog.push({
    id: `demo_plaza_log_${nextLogSeq()}`, commentId: comment.id, kind,
    uid: comment.uid, name: comment.name, studentId: comment.studentId, byTeacher: comment.byTeacher === true,
    book: comment.book, ownerUid: comment.ownerUid, bookId: comment.bookId, title,
    text: String(before ?? ""), after: kind === "edit" ? String(after ?? "") : "",
    at: comment.at ?? null, doneAt: Date.now(), doneBy: by, doneByTeacher: byTeacher === true,
  });
}
// [교사] 학생 한 명의 댓글 이력 — { written: 쓴 댓글, received: 받은 댓글, logError }(줄기의 모양은 lib/readingPlaza.js의
// plazaCommentHistory). 지금 댓글 둘(쓴 것 · 받은 것)과 이력 둘을 등호 질의로 읽고(색인 없음), 지금 댓글이 달린 책의 제목은
// 그 책의 사본에서 한 번씩 읽습니다 — 창을 열 때 한 번(구독하지 않음). 읽는 양은 그 학생의 댓글 수 + 책 수만큼.
// logError — 이력을 읽지 못했을 때(새 규칙을 아직 게시하지 않음 등) 그 까닭. 그때도 지금 댓글은 그대로 보여 줍니다.
export async function fetchPlazaCommentHistory(classId, studentUid) {
  if (!classId || !studentUid) return { written: [], received: [], logError: null };
  if (isFirebaseConfigured) {
    const col = (name) => collection(db, "classes", classId, name);
    const unique = (snaps) => [...new Map(snaps.flatMap((s) => s.docs).map((d) => [d.id, d])).values()];
    const [mine, theirs] = await Promise.all([
      getDocs(query(col("plazaComments"), where("uid", "==", studentUid))),
      getDocs(query(col("plazaComments"), where("ownerUid", "==", studentUid))),
    ]);
    const comments = unique([mine, theirs]).map((d) => commentRow(d.id, d.data()));
    let logs = [];
    let logError = null;
    try {
      const [wrote, got] = await Promise.all([
        getDocs(query(col("plazaCommentLog"), where("uid", "==", studentUid))),
        getDocs(query(col("plazaCommentLog"), where("ownerUid", "==", studentUid))),
      ]);
      logs = unique([wrote, got]).map((d) => logRow(d.id, d.data()));
    } catch (error) {
      logError = error?.code || "unknown";
    }
    const titles = new Map();
    await Promise.all([...new Set(comments.map((c) => c.book).filter(Boolean))].map(async (key) => {
      const snap = await getDoc(doc(db, "classes", classId, "plazaBooks", key)).catch(() => null);
      if (snap?.exists() && typeof snap.data().title === "string") titles.set(key, snap.data().title);
    }));
    return { ...plazaCommentHistory({ uid: studentUid, comments, logs, titles }), logError };
  }
  const user = demoReadingAccess(classId);
  if (!(isTeacher(user) || isAdmin(user))) throw fail("담당 교사만 댓글 이력을 볼 수 있어요.", "reading/forbidden");
  ensureDemoPlaza(classId);
  const dir = buildMockDirectory();
  const comments = demoComments.filter((c) => c.uid === studentUid || c.ownerUid === studentUid).map((c) => ({ ...c }));
  const logs = demoCommentLog.filter((l) => l.uid === studentUid || l.ownerUid === studentUid).map((l) => ({ ...l }));
  const titles = new Map();
  for (const c of comments) {
    if (titles.has(c.book)) continue;
    try {
      const title = demoShelf(classId, c.ownerUid, dir).projection.books[c.bookId]?.title;
      if (title) titles.set(c.book, title);
    } catch { /* 내려간 책 */ }
  }
  return { ...plazaCommentHistory({ uid: studentUid, comments, logs, titles }), logError: null };
}

// 그 반의 공유 사본을 지금 기준으로 한 번 통째로 맞춰 달라고 서버에 부탁합니다 — 광장을 켜기 전에 쓴 글도 켜는 순간부터
// 모두 보이게(선생님 결정). 책방 화면이 반 문서의 plazaSynced를 보고 필요할 때만 부릅니다(lib/reading.js의 plazaNeedsSync).
// 여럿이 함께 불러도 서버는 한 번만 맞춥니다. 데모는 사본을 그 자리에서 셈하므로 맞출 것이 없습니다.
export async function syncPlazaClass(classId) {
  if (!classId) return { synced: false, ran: false };
  if (!isFirebaseConfigured) return { synced: true, ran: false };
  return send(classId, { action: "sync" });
}

// [교사] 책을 광장에서 내리기 · 다시 올리기 — 내린 책은 학생이 다시 써도 올라오지 않습니다.
export async function setPlazaBlocked(classId, ownerUid, bookId, blocked) {
  if (isFirebaseConfigured) return send(classId, { action: "block", ownerUid, bookId, blocked: blocked === true });
  const user = demoGate(classId);
  if (!(isTeacher(user) || isAdmin(user))) throw fail("담당 교사만 책을 광장에서 내릴 수 있습니다.", "reading/forbidden");
  const set = new Set(demoBlocked.get(ownerUid) ?? []);
  if (blocked) set.add(bookId); else set.delete(bookId);
  demoBlocked.set(ownerUid, set);
  demoEmit();
  return { blocked: [...set] };
}
