"use client";
// =============================================================
// 책 광장의 창 — 가판대(독서 발자국) · 책꽂이(완독 감상)의 목록과, 책 한 권 보기 · 댓글
// -------------------------------------------------------------
// 연 장소 안에서 목록 ↔ 책 한 권(← 목록으로)을 오갑니다. 다른 장소는 창을 닫고 광장에서 엽니다.
//   · 목록 — '이번 주'에 글이 있는 책이 앞, 그전 책이 뒤(lib/readingPlaza.js의 plazaItems). '친구별'로 한 친구만.
//   · 가판대는 발자국만, 책꽂이는 한 권의 책만. '○○의 다른 책'도 같은 장소의 기록만 보여 줍니다.
//   · 완독해도 발자국은 가판대에 남고, 한 권의 책을 쓰면 그 감상이 책꽂이에 더해집니다.
// 목록은 광장이 이미 구독해 둔 것(shelves)을 받아 쓰고, 책 한 권 · 댓글은 그 책을 연 동안만 구독합니다.
// 댓글: 실명(학번 이름 · 선생님은 '선생님') · 고치기는 쓴 사람만('수정' → 저장 · 취소, 고친 댓글에는 '수정됨') ·
// 지우기는 쓴 사람과 선생님만(책 주인은 못 지움). 고치기 전 글과 지운 글은 담당 선생님만 읽는 이력에 남고
// (선생님 요청 — 교사 책나눔의 '댓글 이력'), 학생 화면의 입력칸 아래에 '모든 댓글은 선생님이 확인할 수 있습니다.'가 섭니다.
// Enter는 줄바꿈, Ctrl/⌘+Enter가 보내기 · 저장(앱의 다른 채팅 칸과 같음). 고치는 칸의 Esc는 고치기만 접습니다.
// Esc · 배경 누르기로 닫힙니다 — 쓰던 댓글이 있으면 Esc로는 안 닫힙니다(lib/modal.js).
// =============================================================
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { backdropClose } from "@/lib/modal";
import { formatTime } from "@/lib/dates";
import { addPlazaComment, deletePlazaComment, editPlazaComment, setPlazaBlocked, subscribePlazaBook, subscribePlazaComments } from "@/lib/data/plaza";
import { PLAZA_COMMENT_MAX, plazaCommentEdited, plazaDayLabel, plazaEntryForPlace, plazaFriends, plazaItems, plazaLogsNewestFirst, plazaNameLabel } from "@/lib/readingPlaza";

const PLACES = { stall: { name: "가판대", description: "독서 발자국" }, shelf: { name: "책꽂이", description: "완독 감상" } };
const number = (v) => Number(v || 0).toLocaleString("ko-KR");
const percent = (item) => Math.min(100, Math.max(0, Math.round((Number(item.read) || 0) / Math.max(1, Number(item.total) || 1) * 100)));

function Cover({ item, small = false }) {
  const [failed, setFailed] = useState(null);
  const image = item.cover && failed !== item.cover;
  // 표지가 없는 책은 제목으로 색을 정한 책등(네 가지 색 — 서재의 책 카드와 같은 생각)
  const tone = [...String(item.title || "")].reduce((sum, ch) => sum + ch.codePointAt(0), 0) % 4;
  return (
    <span className={`plaza-cover plaza-cover--${tone}${small ? " plaza-cover--small" : ""}${image ? " has-image" : ""}`} aria-hidden="true">
      {image ? <img src={item.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(item.cover)} />
        : <span className="plaza-cover-title">{item.title}</span>}
    </span>
  );
}

function Stars({ rating }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  return <span className="plaza-stars" role="img" aria-label={`별점 ${n} / 5`}>{"★".repeat(n)}<i>{"★".repeat(5 - n)}</i></span>;
}

function BookCard({ item, mine, onOpen }) {
  return (
    <li>
      <button type="button" className="plaza-card" onClick={onOpen}>
        <Cover item={item} />
        <span className="plaza-card-body">
          <span className="plaza-card-who">{plazaNameLabel(item)}{mine && <em>나</em>}</span>
          <strong className="plaza-card-title">{item.title}</strong>
          <span className="plaza-card-author">{item.author}</span>
          {item.place !== "shelf"
            ? <span className="plaza-card-progress"><span className="reading-progress"><i style={{ width: `${percent(item)}%` }} /></span>{number(item.read)} / {number(item.total)}쪽</span>
            // 완독한 책 — 한 권의 책을 썼으면 별점, 아직이면 '완독'(별 0개로 보이지 않게)
            : item.rating ? <Stars rating={item.rating} /> : <span className="plaza-card-progress">완독 · {number(item.total)}쪽</span>}
          {item.excerpt && <span className="plaza-card-excerpt">{item.excerpt}</span>}
          <span className="plaza-card-meta">
            {item.logs > 0 && <span>발자국 {number(item.logs)}</span>}
            <span className={item.comments ? "has" : ""}>댓글 {number(item.comments)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

function BookList({ place, shelves, loading, friendUid, myUid, onNavigate }) {
  const friends = useMemo(() => plazaFriends(shelves).filter((f) => f[place] > 0), [shelves, place]);
  // 고른 친구가 이쪽(가판대/책꽂이)에 책이 없으면 모두 보기로
  const friend = friendUid && friends.some((f) => f.uid === friendUid) ? friendUid : null;
  const { week, earlier } = useMemo(() => plazaItems(shelves, { place, friendUid: friend }), [shelves, place, friend]);
  const open = (item) => onNavigate({ book: { uid: item.uid, bookId: item.id } });
  const empty = !week.length && !earlier.length;
  return (
    <div className="plaza-list">
      <div className="plaza-list-tools">
        <label className="plaza-friend">친구별
          <select value={friend ?? ""} onChange={(e) => onNavigate({ friendUid: e.target.value || null })}>
            <option value="">친구 모두</option>
            {friends.map((f) => <option key={f.uid} value={f.uid}>{plazaNameLabel(f)} · {f[place]}권</option>)}
          </select>
        </label>
        <p>{place === "stall" ? "책을 누르면 친구들이 남긴 독서 발자국을 읽을 수 있어요. 완독한 책의 발자국도 이곳에 남아요." : "책을 누르면 친구들이 쓴 완독 감상 ‘한 권의 책’을 읽을 수 있어요."}</p>
      </div>
      {loading ? <div className="reading-loading" role="status"><span className="reading-loader" />광장의 책을 모으고 있어요.</div>
        : empty ? (
          <div className="reading-empty plaza-empty">
            <h3>{place === "stall" ? "아직 가판대에 놓인 책이 없어요." : "아직 책꽂이에 놓인 책이 없어요."}</h3>
            <p>{place === "stall" ? "독서 발자국을 남기면 그 기록이 이곳 가판대에 놓여요." : "‘한 권의 책’을 쓰면 완독 감상이 이곳 책꽂이에 놓여요."}</p>
          </div>
        ) : (
          <>
            <section className="plaza-group" aria-label="이번 주">
              <h4>이번 주 <span>{week.length}</span></h4>
              {week.length ? <ul className="plaza-grid">{week.map((item) => <BookCard key={item.key} item={item} mine={item.uid === myUid} onOpen={() => open(item)} />)}</ul>
                : <p className="reading-muted">이번 주에 새로 쓴 글이 아직 없어요. 아래에서 그전 책을 볼 수 있어요.</p>}
            </section>
            {earlier.length > 0 && (
              <section className="plaza-group" aria-label="그전">
                <h4>그전 <span>{earlier.length}</span></h4>
                <ul className="plaza-grid">{earlier.map((item) => <BookCard key={item.key} item={item} mine={item.uid === myUid} onOpen={() => open(item)} />)}</ul>
              </section>
            )}
          </>
        )}
    </div>
  );
}

function Comments({ classId, owner, bookId, myUid, isTeacher }) {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [editing, setEditing] = useState(null);   // 고치는 중인 내 댓글 { id, text }
  const [saving, setSaving] = useState(false);
  const inputId = useId();
  useEffect(() => {
    setRows(null); setEditing(null);
    return subscribePlazaComments(classId, owner, bookId, setRows, () => setRows([]));
  }, [classId, owner, bookId]);
  // 고치던 댓글이 지워지면(다른 화면 · 선생님) 고치기를 접습니다
  useEffect(() => {
    if (editing && rows && !rows.some((c) => c.id === editing.id)) setEditing(null);
  }, [rows, editing]);
  useEffect(() => {
    if (!confirmId) return undefined;
    const timer = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  async function submit() {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true); setError("");
    try {
      await addPlazaComment(classId, owner, bookId, clean);
      setText("");
    } catch (e) {
      setError(e?.message || "댓글을 남기지 못했어요.");
    } finally { setBusy(false); }
  }
  async function remove(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null); setError("");
    try { await deletePlazaComment(classId, id); } catch (e) { setError(e?.message || "댓글을 지우지 못했어요."); }
  }
  function startEdit(c) {
    setConfirmId(null); setError("");
    setEditing({ id: c.id, text: c.text });
  }
  async function saveEdit() {
    if (!editing || saving) return;
    const clean = editing.text.trim();
    if (!clean) { setError("댓글을 적어 주세요. 지우려면 ‘지우기’를 눌러 주세요."); return; }
    setSaving(true); setError("");
    try {
      await editPlazaComment(classId, editing.id, clean);
      setEditing(null);
    } catch (e) {
      setError(e?.message || "댓글을 고치지 못했어요.");
    } finally { setSaving(false); }
  }
  return (
    <section className="plaza-comments" aria-label="댓글">
      <h4>댓글 <span>{rows?.length ?? 0}</span></h4>
      {rows === null ? <p className="reading-muted">댓글을 불러오고 있어요.</p>
        : rows.length === 0 ? <p className="reading-muted">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>
          : (
            <ol className="plaza-comment-list">
              {rows.map((c) => {
                const mine = c.uid === myUid;
                const editingThis = editing?.id === c.id;
                return (
                  <li key={c.id} className={c.byTeacher ? "by-teacher" : mine ? "by-me" : ""}>
                    <div className="plaza-comment-head">
                      <strong>{plazaNameLabel(c)}</strong>
                      <span>{c.at ? formatTime(c.at) : "방금 전"}</span>
                      {plazaCommentEdited(c) && <span className="plaza-comment-edited" title={c.editedAt ? `${formatTime(c.editedAt)} 고침` : "고친 댓글"}>수정됨</span>}
                      {(isTeacher || mine) && !editingThis && (
                        <span className="plaza-comment-tools">
                          {/* 고치기는 쓴 사람만(선생님도 학생 댓글은 지우기만) */}
                          {mine && <button type="button" className="plaza-comment-edit-btn" onClick={() => startEdit(c)}>수정</button>}
                          <button type="button" className="reading-text-danger" onClick={() => remove(c.id)}>{confirmId === c.id ? "한 번 더 누르면 지워요" : "지우기"}</button>
                        </span>
                      )}
                    </div>
                    {editingThis ? (
                      <div className="plaza-comment-edit">
                        <label className="reading-sr-only" htmlFor={`${inputId}-edit`}>댓글 고치기</label>
                        {/* autoFocus — '수정'을 누른 그 칸에서 곧바로 고쳐 쓰게(누른 사람이 연 칸이라 초점을 옮겨도 놀라지 않음) */}
                        <textarea id={`${inputId}-edit`} rows={2} maxLength={PLAZA_COMMENT_MAX} value={editing.text} disabled={saving} autoFocus
                          onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            // Esc는 고치기만 접습니다(창은 그대로 — lib/modal.js가 preventDefault를 보고 비켜 감)
                            if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
                            else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
                          }} />
                        <div className="plaza-comment-send">
                          <span className="reading-field-count">{editing.text.length} / {PLAZA_COMMENT_MAX} · Ctrl+Enter로 저장</span>
                          <span className="plaza-comment-edit-actions">
                            <button type="button" className="btn-ghost" disabled={saving} onClick={() => setEditing(null)}>취소</button>
                            <button type="button" className="btn-primary" disabled={saving || !editing.text.trim() || editing.text.trim() === c.text} onClick={saveEdit}>{saving ? "저장 중…" : "저장"}</button>
                          </span>
                        </div>
                      </div>
                    ) : <p>{c.text}</p>}
                  </li>
                );
              })}
            </ol>
          )}
      {error && <div className="reading-error" role="alert">{error}</div>}
      <div className="plaza-comment-form">
        <label className="reading-sr-only" htmlFor={inputId}>댓글 쓰기</label>
        <textarea id={inputId} rows={2} maxLength={PLAZA_COMMENT_MAX} value={text} disabled={busy}
          placeholder="읽고 든 생각이나 궁금한 점을 남겨 보세요."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        {/* 학생에게 — 고치거나 지운 댓글도 선생님이 볼 수 있다는 것을 미리 알립니다(선생님이 정한 말) */}
        {!isTeacher && <p className="plaza-comment-notice">모든 댓글은 선생님이 확인할 수 있습니다.</p>}
        <div className="plaza-comment-send">
          <span className="reading-field-count">{text.length} / {PLAZA_COMMENT_MAX} · Ctrl+Enter로 보내기</span>
          <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={submit}>{busy ? "보내는 중…" : "댓글 남기기"}</button>
        </div>
      </div>
    </section>
  );
}

function BookView({ classId, shelves, target, place, myUid, isTeacher, onNavigate }) {
  const [book, setBook] = useState(undefined);   // undefined 아직 · null 광장에 없음
  const [blocking, setBlocking] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setBook(undefined); setError(""); setConfirmBlock(false);
    return subscribePlazaBook(classId, target.uid, target.bookId, setBook, () => setBook(null));
  }, [classId, target.uid, target.bookId]);
  useEffect(() => {
    if (!confirmBlock) return undefined;
    const timer = setTimeout(() => setConfirmBlock(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmBlock]);
  const owner = shelves.find((s) => s.uid === target.uid);
  const others = (owner?.books ?? []).filter((b) => b.id !== target.bookId).map((b) => plazaEntryForPlace(b, place)).filter(Boolean);
  const logs = useMemo(() => plazaLogsNewestFirst(book?.logs ?? []), [book]);

  async function block() {
    if (!confirmBlock) { setConfirmBlock(true); return; }
    setConfirmBlock(false); setBlocking(true); setError("");
    try {
      await setPlazaBlocked(classId, target.uid, target.bookId, true);
      onNavigate({ book: null });
    } catch (e) {
      setError(e?.message || "광장에서 내리지 못했어요.");
    } finally { setBlocking(false); }
  }

  if (book === undefined) return <div className="reading-loading" role="status"><span className="reading-loader" />책을 펼치고 있어요.</div>;
  if (!book || (place === "shelf" ? !book.review : logs.length === 0)) {
    return (
      <div className="reading-empty plaza-empty">
        <h3>{!book ? "광장에서 내려간 책이에요." : `이 책의 ${PLACES[place].description}이 없어요.`}</h3>
        <p>지금은 이곳에서 볼 기록이 없어요. 목록에서 다른 책을 골라 보세요.</p>
        <button type="button" className="btn-primary" onClick={() => onNavigate({ book: null })}>목록으로</button>
      </div>
    );
  }
  const mine = book.uid === myUid;
  return (
    <div className="plaza-book">
      <div className="plaza-book-top">
        <Cover item={book} />
        <div className="plaza-book-info">
          <span className="plaza-card-who">{plazaNameLabel(book)}{mine && <em>나</em>}</span>
          <h3>{book.title}</h3>
          <p>{book.author}</p>
          <span className="plaza-card-progress"><span className="reading-progress"><i style={{ width: `${percent(book)}%` }} /></span>{number(book.read)} / {number(book.total)}쪽 · {book.status === "completed" ? "완독" : book.status === "paused" ? "잠시 멈춤" : "읽는 중"}</span>
          {isTeacher && (
            <button type="button" className="reading-text-danger plaza-block" disabled={blocking} onClick={block}>
              {blocking ? "내리는 중…" : confirmBlock ? "한 번 더 누르면 광장에서 내려요" : "광장에서 내리기"}
            </button>
          )}
        </div>
      </div>
      {error && <div className="reading-error" role="alert">{error}</div>}
      {place === "shelf" && book.review && (
        <section className="plaza-review" aria-label="한 권의 책">
          <h4>한 권의 책 <Stars rating={book.review.rating} /></h4>
          <p>{book.review.text}</p>
        </section>
      )}
      {place === "stall" && (
        <section className="plaza-logs" aria-label="독서 발자국">
          <h4>독서 발자국 <span>{number(book.logCount ?? logs.length)}</span></h4>
          {logs.length ? (
            <ol>
              {logs.map((log) => (
                <li key={log.id}>
                  <div className="plaza-log-date"><strong>{plazaDayLabel(log.date)}</strong><span>{log.startPage}–{log.endPage}쪽</span></div>
                  <p>{log.notes}</p>
                </li>
              ))}
            </ol>
          ) : <p className="reading-muted">아직 남긴 발자국이 없어요.</p>}
          {(book.logCount ?? 0) > logs.length && <p className="reading-help">최근 발자국 {logs.length}개만 보여요.</p>}
        </section>
      )}
      {others.length > 0 && (
        <section className="plaza-others" aria-label="다른 책">
          <h4>{mine ? "광장에 있는 나의 다른 책" : `${book.name || "이 친구"}의 다른 책`}</h4>
          <ul>
            {others.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => onNavigate({ book: { uid: target.uid, bookId: b.id } })}>
                  <Cover item={b} small />
                  <span><strong>{b.title}</strong><small>{PLACES[place].description} · {PLACES[place].name}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Comments classId={classId} owner={target.uid} bookId={target.bookId} myUid={myUid} isTeacher={isTeacher} />
    </div>
  );
}

export default function PlazaPanel({ classId, user, isTeacher = false, shelves, loading = false, place, friendUid, book, onNavigate, onClose }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const myUid = user?.uid;
  // 열릴 때 창으로 초점을 옮기고, 닫히면 광장이 무대로 되돌립니다(ReadingPlaza의 onClose).
  useEffect(() => { panelRef.current?.focus({ preventScroll: true }); }, []);
  // 책을 바꾸거나 목록으로 돌아오면 창 맨 위부터
  useEffect(() => { if (panelRef.current) panelRef.current.scrollTop = 0; }, [book?.uid, book?.bookId, place]);
  return (
    <div className="plaza-panel-backdrop" {...backdropClose(onClose)}>
      <section className="plaza-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <header className="plaza-panel-head">
          {book ? <button type="button" className="btn-ghost plaza-back" onClick={() => onNavigate({ book: null })}>← 목록</button> : null}
          <h2 id={titleId}>{PLACES[place].name}<small>{PLACES[place].description}</small></h2>
          <button type="button" className="reading-close plaza-close" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        {book
          ? <BookView classId={classId} shelves={shelves} target={book} place={place} myUid={myUid} isTeacher={isTeacher} onNavigate={onNavigate} />
          : <BookList place={place} shelves={shelves} loading={loading} friendUid={friendUid} myUid={myUid} onNavigate={onNavigate} />}
      </section>
    </div>
  );
}
