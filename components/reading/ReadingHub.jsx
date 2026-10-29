"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { deriveReading, initialReadingState, kstToday, READING_BADGES } from "@/lib/reading";
import { subscribeReadingState, mutateReading, fetchReadingRankings } from "@/lib/data/reading";
import ReadingBadge from "./ReadingBadge";
import "./reading.css";

const ReadingErrorContext = createContext("");
const TIER_NAMES = { 1: "초급", 2: "중급", 3: "고급", beginner: "초급", intermediate: "중급", advanced: "고급" };
const FILTERS = [["all", "전체"], ["reading", "읽는 중"], ["completed", "완독"], ["paused", "잠시 멈춤"], ["archived", "보관함"]];
const PERIODS = [["daily", "오늘"], ["weekly", "이번 주"], ["monthly", "이번 달"], ["all-time", "누적"]];
const number = (v) => Number(v || 0).toLocaleString("ko-KR");
const tierName = (v) => TIER_NAMES[v] || String(v ?? "");
const shortDate = (v) => String(v || "").slice(0, 10).replaceAll("-", ".");
const badgeTier = (b) => Number(b.tier) || ({ beginner: 1, intermediate: 2, advanced: 3 }[b.tier]) || 1;
const displayName = (u) => [u?.studentId, u?.realName || u?.name || "이름 미설정"].filter(Boolean).join(" ");

function BookIcon({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5c-2-2-6-2-9-1v15c3-1 7-1 9 1m0-15c2-2 6-2 9-1v15c-3-1-7-1-9 1V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

function Modal({ title, onClose, children, wide = false, busy = false }) {
  const titleId = useId();
  const error = useContext(ReadingErrorContext);
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    const items = () => [...el.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    (el.querySelector("[data-initial-focus]") || items()[0] || el).focus();
    function key(e) {
      if (e.key === "Escape" && !busy) { e.preventDefault(); onClose(); }
      if (e.key !== "Tab") return;
      const nodes = items();
      const first = nodes[0]; const last = nodes.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    el.addEventListener("keydown", key);
    return () => { el.removeEventListener("keydown", key); previous?.focus?.(); };
  }, [onClose, busy]);
  return <div className="reading-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className={`reading-modal${wide ? " reading-modal--wide" : ""}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="reading-modal-head"><h2 id={titleId}>{title}</h2><button type="button" className="reading-close" aria-label="닫기" onClick={onClose} disabled={busy}>×</button></header>
      {error && <div className="reading-error" role="alert">{error}</div>}
      {children}
    </section>
  </div>;
}

export default function ReadingHub({ classId, user, isTeacher = false, onDisabled, activities = [], onOpenActivity }) {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("library");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [day, setDay] = useState(() => kstToday());
  const disabledRef = useRef(onDisabled);
  disabledRef.current = onDisabled;

  useEffect(() => {
    setRaw(null); setLoading(true); setError(""); setDialog(null); setConfirm(null);
    if (!classId || !user?.uid) { setLoading(false); return undefined; }
    let live = true;
    const off = subscribeReadingState(classId, user.uid,
      (state) => { if (live) { setRaw(state || initialReadingState()); setLoading(false); } },
      (e) => {
        if (!live) return;
        setLoading(false); setError(e?.message || "독서 정보를 불러오지 못했어요.");
        if (isDisabledError(e)) disabledRef.current?.();
      });
    return () => { live = false; off?.(); };
  }, [classId, user?.uid, revision]);

  useEffect(() => {
    const timer = setInterval(() => setDay(kstToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const stats = useMemo(() => deriveReading(raw || initialReadingState(), new Date(`${day}T12:00:00+09:00`)), [raw, day]);
  const previousLevel = useRef(null);
  useEffect(() => {
    if (!raw) return;
    if (previousLevel.current != null && stats.level > previousLevel.current) setNotice(`레벨 ${stats.level} 달성! 독서의 깊이가 한 단계 더 자랐어요.`);
    previousLevel.current = stats.level;
  }, [raw, stats.level]);
  useEffect(() => { previousLevel.current = null; }, [classId, user?.uid]);

  async function run(action, success = "저장했어요.") {
    if (busy) return false;
    setBusy(true); setError("");
    try {
      const result = await mutateReading(classId, action);
      if (result?.state) setRaw(result.state);
      else if (Array.isArray(result?.books) && Array.isArray(result?.logs)) setRaw(result);
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(e?.message || "저장하지 못했어요. 다시 시도해 주세요.");
      if (isDisabledError(e)) { setDialog(null); disabledRef.current?.(); }
      return false;
    } finally { setBusy(false); }
  }
  function ask(title, action) { setDialog(null); setConfirm({ title, action }); }
  const books = stats.books || [];
  const visibleBooks = books.filter((b) => filter === "archived" ? b.archived : !b.archived && (filter === "all" || b.status === filter));
  const selected = dialog?.bookId ? books.find((b) => b.id === dialog.bookId) : null;
  const featured = (stats.badges || []).find((b) => b.id === (stats.featuredBadge?.id || stats.featuredBadge));

  return <ReadingErrorContext.Provider value={error}><section className="reading-hub" aria-label="책나눔 성장 기능" aria-busy={loading || busy}>
    <div className="reading-intro">
      <div><p className="reading-eyebrow">MY READING JOURNEY</p><h2>한 페이지씩, 나의 가능성을 넓히다.</h2><p>읽은 순간을 기록하고 나만의 독서 컬렉션을 완성해 보세요.</p></div>
      {featured?.earned && <div className="reading-featured"><ReadingBadge badge={featured} size={70} /><span>나의 대표 뱃지<strong>{featured.name}</strong></span></div>}
    </div>
    <nav className="reading-tabs" aria-label="책나눔 메뉴">
      {[["library", "내 서재"], ["growth", "성장·뱃지"], ["ranking", "우리 반 랭킹"]].map(([key, label]) => <button type="button" key={key} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => { setTab(key); setDialog(null); setError(""); }}>{label}</button>)}
    </nav>
    {error && !dialog && !confirm && <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="오류 안내 닫기">×</button></div>}
    {notice && <div className="reading-notice" role="status">{notice}</div>}
    {loading ? <div className="reading-loading" role="status"><span className="reading-loader" />독서 기록을 불러오고 있어요.</div> : !raw ? <div className="reading-empty"><BookIcon size={40} /><h3>독서 정보를 불러오지 못했어요.</h3><button type="button" className="btn-primary" onClick={() => setRevision((r) => r + 1)}>다시 불러오기</button></div> : <>
      <div className="reading-summary">
        <div className="reading-level"><span>독서 레벨</span><strong><small>Lv.</small>{stats.level}</strong><div className="reading-progress" role="progressbar" aria-label="다음 레벨까지" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.progress || 0)}><i style={{ width: `${stats.progress || 0}%` }} /></div><span>{number(stats.xp)} / {number(stats.nextXp)} EXP</span></div>
        <div><span>누적 독서량</span><strong>{number(stats.totalPages)}<small>쪽</small></strong><span>기록한 페이지가 경험치로</span></div>
        <div><span>완독한 책</span><strong>{number(stats.totalBooks)}<small>권</small></strong><span>다음 목표는 3권, 그리고 5권</span></div>
        <div><span>지금 이어가는 독서</span><strong>{number(stats.currentStreak)}<small>일</small></strong><span>최장 {number(stats.longestStreak)}일 연속</span></div>
      </div>
      {tab === "library" && <>
        <div className="reading-section-head"><div><h3>내 서재 <span>{books.filter((b) => !b.archived).length}</span></h3><p>책의 마지막 페이지까지, 나의 속도로.</p></div><button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>＋ 책 등록</button></div>
        <div className="reading-filters" aria-label="도서 상태 필터">{FILTERS.map(([key, label]) => <button type="button" key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
        {visibleBooks.length ? <div className="reading-library-grid">{visibleBooks.map((b, i) => <BookCard key={b.id} book={b} index={i} busy={busy} onOpen={() => setDialog({ type: "detail", bookId: b.id })} onLog={() => setDialog({ type: "log", bookId: b.id })} onRestore={() => run({ type: "archiveBook", bookId: b.id, archived: false }, "책을 서재로 돌려놓았어요.")} />)}</div> : <div className="reading-empty"><BookIcon size={44} /><h3>{filter === "all" ? "나의 첫 책을 기다리고 있어요." : "아직 이곳에 놓인 책이 없어요."}</h3><p>{filter === "all" ? "읽고 싶은 책을 등록하고 오늘 읽은 순간을 남겨 보세요." : "책을 읽고 기록하면 서재의 풍경도 달라져요."}</p>{filter === "all" && <button type="button" className="btn-primary" onClick={() => setDialog({ type: "book" })}>첫 책 등록하기</button>}</div>}
      </>}
      {tab === "growth" && <Growth stats={stats} busy={busy} onSelect={(badgeId) => run({ type: "setFeaturedBadge", badgeId }, "대표 뱃지를 바꿨어요.")} />}
      {tab === "ranking" && <Rankings key={classId} classId={classId} uid={user.uid} isTeacher={isTeacher} onDisabled={onDisabled} revision={raw} />}
    </>}

    {dialog?.type === "book" && <BookForm key={selected?.id || "new"} book={selected} pagesLocked={!!selected && [...(raw?.logs || []), ...(raw?.reviews || [])].some((r) => r.bookId === selected.id)} activities={activities} busy={busy} onClose={() => setDialog(null)} onSave={async (values) => { const ok = await run({ type: selected ? "updateBook" : "addBook", ...(selected ? { bookId: selected.id } : {}), ...values }, selected ? "책 정보를 고쳤어요." : "새 책을 서재에 놓았어요."); if (ok) setDialog(null); }} />}
    {dialog?.type === "detail" && selected && <BookDetail book={selected} classId={classId} activity={activities.find((a) => a.id === selected.activityId)} onOpenActivity={onOpenActivity} logs={(stats.logs || raw?.logs || []).filter((l) => l.bookId === selected.id)} review={(stats.reviews || raw?.reviews || []).find((r) => r.bookId === selected.id)} busy={busy} onClose={() => setDialog(null)} onEdit={() => setDialog({ type: "book", bookId: selected.id })} onLog={(log) => setDialog({ type: "log", bookId: selected.id, log })} onReview={() => setDialog({ type: "review", bookId: selected.id })} onDeleteLog={(log) => ask("이 독서 기록을 삭제할까요? 경험치와 달성 기록도 다시 계산해요.", { type: "deleteLog", logId: log.id })} onDeleteReview={() => ask("이 감상문을 삭제할까요? 감상문 보상도 함께 정정해요.", { type: "deleteReview", bookId: selected.id })} onArchive={() => ask(selected.archived ? "이 책을 서재로 돌려놓을까요?" : "이 책을 보관함으로 옮길까요? 독서 기록은 그대로 남아요.", { type: "archiveBook", bookId: selected.id, archived: !selected.archived })} />}
    {dialog?.type === "log" && selected && <LogForm key={dialog.log?.id || selected.id} book={selected} log={dialog.log} today={day} busy={busy} onClose={() => setDialog({ type: "detail", bookId: selected.id })} onSave={async (values) => { const ok = await run({ type: dialog.log ? "updateLog" : "addLog", bookId: selected.id, ...(dialog.log ? { logId: dialog.log.id } : {}), ...values }, "오늘의 독서를 기록했어요."); if (ok) setDialog({ type: "detail", bookId: selected.id }); }} />}
    {dialog?.type === "review" && selected && <ReviewForm key={selected.id} book={selected} review={(stats.reviews || raw?.reviews || []).find((r) => r.bookId === selected.id)} busy={busy} onClose={() => setDialog({ type: "detail", bookId: selected.id })} onSave={async (values) => { const ok = await run({ type: "saveReview", bookId: selected.id, ...values }, "책을 읽고 남긴 생각을 저장했어요."); if (ok) setDialog({ type: "detail", bookId: selected.id }); }} />}
    {confirm && <Modal title="기록 확인" busy={busy} onClose={() => setConfirm(null)}><p className="reading-confirm-copy">{confirm.title}</p><div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>취소</button><button type="button" className="reading-danger-button" disabled={busy} onClick={async () => { if (await run(confirm.action, "기록을 정리했어요.")) setConfirm(null); }}>{busy ? "처리 중…" : "확인"}</button></div></Modal>}
  </section></ReadingErrorContext.Provider>;
}

function isDisabledError(e) {
  return ["reading-disabled", "reading/disabled", "disabled_feature", "READING_DISABLED"].includes(e?.code) || (e?.status === 403 && /비활성|사용.*중지|사용.*꺼/.test(e.message || ""));
}

function BookCard({ book, index, busy, onOpen, onLog, onRestore }) {
  const status = book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중";
  return <article className={`reading-book-card reading-book-color-${index % 4}`}>
    <button type="button" className="reading-book-open" onClick={onOpen} aria-label={`${book.title} 상세 보기`}>
      <div className="reading-book-cover"><span className="reading-book-cover-line" /><BookIcon size={30} /><span className="reading-book-cover-title">{book.title}</span><small>{book.author}</small></div>
      <div className="reading-book-info"><span className={`reading-status reading-status--${book.status}`}>{book.archived ? "보관 중" : status}</span><h4>{book.title}</h4><p>{book.author}</p><div className="reading-book-pages"><strong>{number(book.pagesRead ?? book.currentPage)}</strong> / {number(book.totalPages)}쪽</div><div className="reading-progress"><i style={{ width: `${book.progress || 0}%` }} /></div><span className="reading-book-percent">{Math.round(book.progress || 0)}% 읽었어요</span></div>
    </button>
    <div className="reading-book-actions"><button type="button" className="btn-ghost" onClick={onOpen}>기록 살펴보기</button><button type="button" className="reading-small-primary" disabled={busy} onClick={book.archived ? onRestore : onLog}>{book.archived ? "서재로 복원" : "독서 기록"}</button></div>
  </article>;
}

function BookForm({ book, pagesLocked, activities, busy, onSave, onClose }) {
  const [form, setForm] = useState({ title: book?.title || "", author: book?.author || "", totalPages: book?.totalPages || "", status: book?.status === "paused" ? "paused" : "reading", activityId: book?.activityId || "" });
  const change = (key, v) => setForm((p) => ({ ...p, [key]: v }));
  return <Modal title={book ? "책 정보 고치기" : "새 책 등록"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, title: form.title.trim(), author: form.author.trim(), totalPages: Number(form.totalPages) }); }}>
      <label>책 제목<input data-initial-focus required maxLength={120} value={form.title} onChange={(e) => change("title", e.target.value)} placeholder="책 제목을 적어 주세요" /></label>
      <label>지은이<input required maxLength={80} value={form.author} onChange={(e) => change("author", e.target.value)} placeholder="저자 이름" /></label>
      <div className="reading-form-row"><label>전체 쪽수<input required type="number" min={1} max={100000} step={1} disabled={pagesLocked || busy} value={form.totalPages} onChange={(e) => change("totalPages", e.target.value)} inputMode="numeric" /></label>{book && <label>읽기 상태<select value={form.status} onChange={(e) => change("status", e.target.value)}><option value="reading">읽는 중</option><option value="paused">잠시 멈춤</option></select></label>}</div>
      {pagesLocked && <p className="reading-help">독서 기록이나 감상문이 있는 책의 전체 쪽수는 고정돼요. 잘못 입력한 기록은 먼저 정정해 주세요.</p>}
      <label>함께할 독서 활동 <span className="reading-optional">선택</span><select value={form.activityId} onChange={(e) => change("activityId", e.target.value)}><option value="">연결하지 않음</option>{form.activityId && !activities.some((a) => a.id === form.activityId) && <option value={form.activityId}>이전에 연결한 활동</option>}{activities.filter((a) => !a.deleted).map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
      <p className="reading-help">완독 여부는 읽은 페이지 기록으로 확인해요. 같은 책은 중복으로 등록할 수 없어요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn-primary" disabled={busy || !form.title.trim() || !form.author.trim()}>{busy ? "저장 중…" : book ? "변경 저장" : "서재에 담기"}</button></div>
    </form>
  </Modal>;
}

function LogForm({ book, log, today, busy, onSave, onClose }) {
  const [form, setForm] = useState({ date: log?.date || today, startPage: log?.startPage || Math.min((book.currentPage || 0) + 1, book.totalPages), endPage: log?.endPage || "", notes: log?.notes || "" });
  const change = (key, v) => setForm((p) => ({ ...p, [key]: v }));
  return <Modal title={log ? "독서 기록 고치기" : "오늘의 독서 기록"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, startPage: Number(form.startPage), endPage: Number(form.endPage), notes: form.notes.trim() }); }}>
      <div className="reading-form-book"><BookIcon /><strong>{book.title}</strong><span>총 {number(book.totalPages)}쪽</span></div>
      <label>읽은 날짜<input data-initial-focus required type="date" max={today} value={form.date} onChange={(e) => change("date", e.target.value)} /></label>
      <div className="reading-form-row"><label>시작 쪽<input required type="number" min={1} max={book.totalPages} step={1} value={form.startPage} onChange={(e) => change("startPage", e.target.value)} inputMode="numeric" /></label><label>마지막 쪽<input required type="number" min={Math.max(1, Number(form.startPage) || 1)} max={book.totalPages} step={1} value={form.endPage} onChange={(e) => change("endPage", e.target.value)} inputMode="numeric" /></label></div>
      <label>오늘의 짧은 감상<textarea required maxLength={2000} rows={4} value={form.notes} onChange={(e) => change("notes", e.target.value)} placeholder="마음에 남은 장면이나 새롭게 떠오른 생각을 적어 보세요." /><span className="reading-field-count">{form.notes.length} / 2,000</span></label>
      <p className="reading-help">1쪽당 1 EXP. 연속 독서 보너스는 하루 한 번만 받아요. 이미 기록한 페이지는 중복 적립하지 않아요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="btn-primary" disabled={busy || !form.notes.trim()}>{busy ? "저장 중…" : "독서 기록 저장"}</button></div>
    </form>
  </Modal>;
}

function ReviewForm({ book, review, busy, onSave, onClose }) {
  const [text, setText] = useState(review?.text || "");
  const [rating, setRating] = useState(review?.rating || 5);
  return <Modal title={review ? "감상문 고치기" : "책 한 권, 나의 생각"} onClose={onClose} busy={busy}>
    <form className="reading-form" onSubmit={(e) => { e.preventDefault(); onSave({ text: text.trim(), rating: Number(rating) }); }}>
      <div className="reading-form-book"><BookIcon /><strong>{book.title}</strong></div>
      <label>나의 별점<select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}점</option>)}</select></label>
      <label>읽고 남은 생각<textarea data-initial-focus required rows={8} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="이 책이 내게 남긴 것, 친구와 나누고 싶은 생각을 써 보세요." /><span className="reading-field-count">{text.length} / 5,000</span></label>
      <p className="reading-help">서로 다른 책의 첫 감상문에 70 EXP를 받아요. 고쳐 쓸 때는 중복 지급하지 않아요.</p>
      <div className="reading-form-actions"><button type="button" className="btn-ghost" disabled={busy} onClick={onClose}>취소</button><button type="submit" className="btn-primary" disabled={busy || !text.trim()}>{busy ? "저장 중…" : "감상문 저장"}</button></div>
    </form>
  </Modal>;
}

function BookDetail({ book, classId, activity, onOpenActivity, logs, review, busy, onClose, onEdit, onLog, onReview, onDeleteLog, onDeleteReview, onArchive }) {
  const sorted = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  return <Modal title={book.title} wide busy={busy} onClose={onClose}>
    <div className="reading-detail-meta"><span>{book.author}</span><span>{number(book.pagesRead ?? book.currentPage)} / {number(book.totalPages)}쪽 읽음</span><span>{book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중"}</span></div>
    <div className="reading-detail-tools"><button type="button" className="btn-ghost" disabled={busy} onClick={onEdit}>책 정보 고치기</button><button type="button" className="btn-ghost" disabled={busy} onClick={onArchive}>{book.archived ? "서재로 복원" : "보관함으로"}</button>{!book.archived && <button type="button" className="btn-primary" disabled={busy} onClick={() => onLog(null)}>＋ 독서 기록</button>}</div>
    {activity && onOpenActivity && <div className="reading-linked-activity"><div><span>함께 연결한 독서 활동</span><strong>{activity.title}</strong></div><button type="button" className="btn-ghost" disabled={busy} onClick={() => onOpenActivity(activity)}>활동 열기 →</button></div>}
    <section className="reading-detail-section"><header><h3>책 한 권, 나의 생각</h3><button type="button" className="btn-ghost" disabled={busy || (review && review.classId !== classId)} onClick={onReview}>{review ? "감상문 고치기" : "감상문 쓰기"}</button></header>{review ? <article className="reading-review"><p className="reading-review-rating">나의 별점 {review.rating} / 5</p><p>{review.text}</p>{review.classId !== classId && <p className="reading-help">다른 반에서 작성한 감상문이에요. 작성한 반에서 고치거나 삭제할 수 있어요.</p>}<button type="button" className="reading-text-danger" disabled={busy || review.classId !== classId} onClick={onDeleteReview}>감상문 삭제</button></article> : <p className="reading-muted">한 권을 읽고 떠오른 생각을 담아 보세요.</p>}</section>
    <section className="reading-detail-section"><header><h3>독서의 발자취 <small>{logs.length}</small></h3></header>{sorted.length ? <ol className="reading-log-list">{sorted.map((log) => <li key={log.id}><div className="reading-log-date"><strong>{shortDate(log.date)}</strong><span>{log.startPage}–{log.endPage}쪽 · {number(log.endPage - log.startPage + 1)}쪽</span></div><p>{log.notes}</p>{log.classId !== classId && <p className="reading-help">다른 반에서 작성한 기록 · 작성한 반에서만 수정 가능</p>}<div className="reading-log-tools"><button type="button" className="btn-ghost" disabled={busy || log.classId !== classId} onClick={() => onLog(log)}>고치기</button><button type="button" className="reading-text-danger" disabled={busy || log.classId !== classId} onClick={() => onDeleteLog(log)}>삭제</button></div></li>)}</ol> : <p className="reading-muted">아직 독서 기록이 없어요. 첫 페이지의 생각부터 남겨 보세요.</p>}</section>
  </Modal>;
}

function Growth({ stats, busy, onSelect }) {
  const [preview, setPreview] = useState(null);
  const series = useMemo(() => {
    const grouped = new Map();
    for (const badge of stats.badges || []) { const group = grouped.get(badge.series) || []; group.push(badge); grouped.set(badge.series, group); }
    return [...grouped.entries()].map(([key, badges]) => ({ key, badges: badges.sort((a, b) => badgeTier(a) - badgeTier(b)) }));
  }, [stats.badges]);
  const earned = (stats.badges || []).filter((b) => b.earned);
  const featuredId = stats.featuredBadge?.id || stats.featuredBadge;
  return <div className="reading-growth">
    <div className="reading-section-head"><div><h3>나의 성취 컬렉션 <span>{earned.length} / {(stats.badges || []).length}</span></h3><p>같은 뱃지의 다음 모습까지. 초급에서 고급으로 한 단계씩 모아 보세요.</p></div></div>
    <div className="reading-tier-guide">{[[1, "초급", "첫 발걸음"], [2, "중급", "깊어지는 독서"], [3, "고급", "나만의 성취"]].map(([tier, name, text]) => <span key={tier}><i className={`reading-tier-dot reading-tier-dot-${tier}`} /><strong>{name}</strong>{text}</span>)}</div>
    {series.map(({ key, badges }) => { const next = badges.find((b) => !b.earned); return <section key={key} className="reading-badge-series"><header><div><h4>{badges[0]?.seriesName || badges[0]?.name?.replace(/\s*(초급|중급|고급)$/, "") || key}</h4><p>{next ? `${next.description} · ${number(next.current)} / ${number(next.threshold)}` : "세 단계의 성취를 모두 모았어요."}</p></div>{next && <span className="reading-next-goal">다음 목표 · {tierName(next.tier)}</span>}</header><div className="reading-badge-grid">{badges.map((badge) => <article key={badge.id} className={`reading-badge-card${badge.earned ? " is-earned" : ""}${featuredId === badge.id ? " is-featured" : ""}`}>
      <div className="reading-badge-visual"><ReadingBadge badge={badge} size={100} earned={badge.earned} />{badge.earned && <span className="reading-earned-label">획득</span>}</div>
      <span className={`reading-tier-label reading-tier-label-${badgeTier(badge)}`}>{tierName(badge.tier)}</span><h5>{badge.name}</h5><p>{badge.description}</p><span className="reading-badge-exp">＋{badge.expReward} EXP</span>
      {badge.earned ? <><span className="reading-earned-date">{badge.earnedAt ? `${shortDate(badge.earnedAt)} 달성` : "달성한 성취"}</span><button type="button" className="reading-feature-button" disabled={busy || featuredId === badge.id} onClick={() => onSelect(badge.id)}>{featuredId === badge.id ? "나의 대표 뱃지" : "대표 뱃지로 선택"}</button></> : <><div className="reading-progress" role="progressbar" aria-label={`${badge.name} 달성 진행`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(badge.progress || 0))}><i style={{ width: `${Math.min(100, badge.progress || 0)}%` }} /></div><span className="reading-unearned">{number(badge.current)} / {number(badge.threshold)}</span><button type="button" className="reading-preview-button" onClick={() => setPreview(badge)}>디자인 미리보기</button></>}
    </article>)}</div></section>; })}
    <p className="reading-help">모든 단계는 한 번씩 받을 수 있어요. 기록을 고치거나 삭제하면 경험치와 성취 조건도 함께 다시 계산해요.</p>
    {preview && <Modal title={`${preview.name} · ${tierName(preview.tier)}`} onClose={() => setPreview(null)}>
      <div className="reading-badge-preview">
        <span className="reading-preview-status">미획득 · 디자인 미리보기</span>
        <ReadingBadge badge={preview} size={180} earned={true} />
        <h3>{preview.label || `${preview.name} · ${tierName(preview.tier)}`}</h3>
        <p>{preview.description}</p>
        <span className="reading-preview-reward">달성 보상 ＋{preview.expReward} EXP</span>
        <div className="reading-preview-progress"><div className="reading-progress" role="progressbar" aria-label={`${preview.name} 달성 진행`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(preview.progress || 0))}><i style={{ width: `${Math.min(100, preview.progress || 0)}%` }} /></div><span>현재 {number(preview.current)} / {number(preview.threshold)}</span></div>
        <p className="reading-help">앞으로 모을 뱃지의 모습을 미리 보는 화면이에요. 조건을 달성하면 내 컬렉션에 추가돼요.</p>
      </div>
      <div className="reading-form-actions"><button type="button" className="btn-primary" onClick={() => setPreview(null)}>확인</button></div>
    </Modal>}
  </div>;
}

function Rankings({ classId, uid, isTeacher, onDisabled, revision }) {
  const [period, setPeriod] = useState("weekly");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const disabledRef = useRef(onDisabled); disabledRef.current = onDisabled;
  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    Promise.resolve(fetchReadingRankings(classId, period)).then((result) => {
      if (live) setRows(Array.isArray(result) ? result : result?.rankings || []);
    }).catch((e) => {
      if (!live) return;
      setError(e?.message || "순위를 불러오지 못했어요.");
      if (isDisabledError(e)) disabledRef.current?.();
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [classId, period, retry, revision]);
  const mine = rows.find((r) => (r.uid || r.userId) === uid);
  return <section className="reading-rankings"><div className="reading-section-head"><div><h3>우리 반의 독서 발자취</h3><p>각자의 속도로 쌓은 기록을 함께 응원해요.</p></div><button type="button" className="btn-ghost" disabled={loading} onClick={() => setRetry((v) => v + 1)}>새로고침</button></div>
    <div className="reading-filters" aria-label="랭킹 기간">{PERIODS.map(([key, label]) => <button key={key} type="button" className={period === key ? "active" : ""} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
    <p className="reading-help">한국 시간 기준 · 주간은 월요일 시작 · 같은 점수는 공동 순위 · 현재 반 학생만 표시</p>
    {!isTeacher && mine && <div className="reading-my-rank"><span>이번 기간 나의 기록</span><strong>{mine.rank}위</strong><span>{number(mine.xp ?? mine.totalExp ?? mine.score)} EXP</span><span>Lv. {mine.level || 1}</span></div>}
    {loading ? <div className="reading-loading" role="status">우리 반 기록을 모으고 있어요.</div> : error ? <div className="reading-error" role="alert">{error}<button type="button" onClick={() => setRetry((v) => v + 1)}>다시 시도</button></div> : !rows.length ? <div className="reading-empty"><BookIcon size={40} /><h3>새로운 독서의 시작을 기다려요.</h3><p>우리 반 학생이 독서를 기록하면 이곳에서 함께 볼 수 있어요.</p></div> : <div className="reading-ranking-scroll"><table className="reading-ranking-table"><caption className="reading-sr-only">{PERIODS.find(([key]) => key === period)?.[1]} 우리 반 독서 랭킹</caption><thead><tr><th scope="col">순위</th><th scope="col">이름</th><th scope="col">레벨</th><th scope="col">경험치</th><th scope="col">대표 뱃지</th></tr></thead><tbody>{rows.map((r) => <tr key={r.uid || r.userId} className={(r.uid || r.userId) === uid ? "is-me" : ""}><td><span className={`reading-rank-number${r.rank <= 3 ? " reading-rank-top" : ""}`}>{r.rank}</span></td><th scope="row">{displayName({ ...r, realName: r.realName || r.name || r.userName })}{(r.uid || r.userId) === uid && <span className="reading-me-label">나</span>}</th><td>Lv. {r.level || 1}</td><td className="reading-rank-exp">{number(r.xp ?? r.totalExp ?? r.score)}</td><td>{r.featuredBadge ? <RankBadge badge={r.featuredBadge} /> : <span className="reading-muted">—</span>}</td></tr>)}</tbody></table></div>}
  </section>;
}

function RankBadge({ badge }) {
  const definition = typeof badge === "string" ? READING_BADGES.find((b) => b.id === badge) : badge;
  if (!definition) return <span className="reading-muted">—</span>;
  return <span className="reading-rank-badge"><ReadingBadge badge={definition} size={42} /><span>{definition.label || definition.name}</span></span>;
}
