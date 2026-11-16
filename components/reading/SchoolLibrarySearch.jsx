"use client";
// =============================================================
// 독서로 검색 — 학교 도서관 소장 검색(한성여자고등학교 · 독서로 우리학교 도서검색)
// 떠 있는 동그라미(FloatingHub)의 '독서로 검색' 행성이 이 창을 엽니다 — **모든 사용자**(학생 · 교사 · 관리자,
// 선생님 요청 · 2026년 11월). 창 맨 위 칸에 제목 일부를 적고 '검색'(또는 Enter) → 같은 창에 결과.
// 한때 교사 책 봄 명단 위의 작은 칸에서만 열었습니다(그 칸은 걷음 — 입구는 동그라미 하나).
// 이 파일은 누를 때만 내려받습니다(FloatingHub의 dynamic) — 창의 CSS(school-library.css)도 함께 옵니다.
// 서버(/api/library/search)는 로그인한 사용자 모두를 받고, 사용 중지 · 로그인 안 함은 독서로에 닿기 전에 막습니다.
//
// 가르는 것:
//   · 소장 — 독서로 검색 결과에 이 학교의 등록번호로 나오면 소장(권마다 한 줄)
//   · 자료 상태 — 그 권의 지금 상태(대출가능 · 대출중 · 정리중 …, 받아 온 말 그대로). '대출가능'일 때만 빌릴 수 있음
//   · 조회 실패는 '미소장'이 아닙니다 — 실패하면 실패라고만 말하고, 독서로 원본 화면을 여는 길(자동 확인 아님)을 둡니다.
// =============================================================
import "./school-library.css";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { backdropClose } from "@/lib/modal";
import { fetchLibraryCover, searchSchoolLibrary } from "@/lib/data/schoolLibrary";
import { LIBRARY, libraryResultUrl } from "@/lib/schoolLibraryLink";

const KEYWORD_MAX = 50;
const COVER_LOOKUPS = 2;   // 카카오 표지 보완은 한 번에 둘까지(독서로에 표지가 없는 책만)

// 표지 — 독서로(알라딘 그림 서버) → 없으면 카카오(ISBN 정확히 일치) → 그래도 없거나 그림이 안 열리면 기본 표지.
// 비율은 그림 그대로(object-fit: contain) · 자리는 늘 같은 크기라 그림이 늦게 와도 줄이 흔들리지 않습니다.
// 부르는 쪽이 key={src}로 다시 그려, 주소가 바뀌면 '못 열림' 표시도 새로 시작합니다.
function LibraryCover({ title, src }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span className="lib-cover">
        <img src={src} alt={`${title} 표지`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className="lib-cover is-fallback" role="img" aria-label={`${title} — 표지 이미지 없음`}>
      <span aria-hidden="true">책</span>
    </span>
  );
}

function StatusBadge({ copy }) {
  if (!copy.stateKnown) return <span className="lib-state is-unknown" title="자료 상태를 받아 오지 못했어요 — 소장은 확인됐어요">상태 확인 실패</span>;
  const tone = copy.available ? " is-available" : /대출중|예약/.test(copy.status) ? " is-loaned" : "";
  return <span className={`lib-state${tone}`}>{copy.status}</span>;
}

function SearchForm({ value, onChange, onSubmit, busy, inputRef, id }) {
  return (
    <form className="lib-search-form" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <label htmlFor={id} className="sr-only">책 제목(일부)</label>
      {/* data-esc-ignore — 글이 든 칸이 있어도 Esc로 창을 닫습니다(검색어는 다시 적기 쉬운 값 · lib/modal.js) */}
      <input id={id} ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} maxLength={KEYWORD_MAX}
        placeholder="책 제목의 일부" autoComplete="off" enterKeyHint="search" data-esc-ignore />
      <button type="submit" disabled={busy}>{busy ? "검색 중…" : "검색"}</button>
    </form>
  );
}

// onClose — 창을 닫을 때(동그라미가 받아 초점을 돌려줌). 열리자마자 검색 칸에 초점이 갑니다.
export default function SchoolLibraryModal({ onClose }) {
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState("idle");   // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);     // { message, keyword, rateLimited }
  const [hint, setHint] = useState("");         // 입력값 없음
  const [page, setPage] = useState(1);
  const requestRef = useRef(null);
  const generation = useRef(0);
  const inputRef = useRef(null);
  const formId = useId();
  // 카카오로 보완한 표지(ISBN-13 → 주소, ""는 '맞는 표지 없음 · 실패') — 이 창이 떠 있는 동안만 기억
  const [extraCovers, setExtraCovers] = useState({});
  const askedCovers = useRef(new Set());

  // 결과가 오면 독서로에 표지가 없는 책만 하나씩 묻습니다(소장 결과는 이미 화면에 섬 — 기다리지 않음)
  useEffect(() => {
    if (phase !== "done" || !result?.books?.length) return undefined;
    const asked = askedCovers.current;
    const queue = [...new Set(result.books.filter((b) => !b.cover && b.isbn13).map((b) => b.isbn13))]
      .filter((isbn) => !asked.has(isbn));
    if (!queue.length) return undefined;
    queue.forEach((isbn) => asked.add(isbn));
    const controller = new AbortController();
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const isbn = queue.shift();
        try {
          const cover = await fetchLibraryCover(isbn, { signal: controller.signal });
          setExtraCovers((m) => ({ ...m, [isbn]: cover }));
        } catch {
          asked.delete(isbn);   // 중간에 닫힘 — 다음에 다시 물을 수 있게
        }
      }
    };
    Array.from({ length: Math.min(COVER_LOOKUPS, queue.length) }, worker);
    return () => {
      controller.abort();
      queue.forEach((isbn) => asked.delete(isbn));
    };
  }, [phase, result]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    return () => { generation.current += 1; requestRef.current?.abort(); };
  }, []);

  async function run(nextPage = 1) {
    const keyword = draft.replace(/\s+/g, " ").trim();
    if (!keyword) { setHint("검색할 책 제목을 입력해 주세요."); inputRef.current?.focus(); return; }
    setHint("");
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const gen = ++generation.current;
    setPhase("loading"); setError(null); setPage(nextPage);
    try {
      const body = await searchSchoolLibrary(keyword, { page: nextPage, signal: controller.signal });
      if (gen !== generation.current) return;
      setResult(body); setPhase("done");
    } catch (e) {
      if (e?.name === "AbortError" || gen !== generation.current) return;
      setResult(null);
      setError({ message: e?.message || "소장 여부를 확인하지 못했어요.", keyword, rateLimited: e?.status === 429 });
      setPhase("error");
    }
  }

  function close() {
    generation.current += 1;
    requestRef.current?.abort();
    onClose?.();
  }

  const keywordShown = phase === "error" ? error?.keyword : result?.keyword;
  const copyTotal = result?.books?.reduce((n, b) => n + b.copies.length, 0) ?? 0;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop lib-backdrop" {...backdropClose(close)}>
      <div className="modal lib-modal" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`}>
        <div className="lib-head">
          <div>
            <h3 id={`${formId}-title`}>독서로 검색</h3>
            <p>{LIBRARY.schoolName} 도서관 · 제목(서명) 일부로 찾아요</p>
          </div>
          <button type="button" className="btn-close" aria-label="닫기" onClick={close}>×</button>
        </div>
        <SearchForm id={formId} inputRef={inputRef} value={draft} onChange={(v) => { setDraft(v); setHint(""); }} onSubmit={() => run(1)} busy={phase === "loading"} />
        {hint && <p className="lib-hint" role="alert">{hint}</p>}
        <div className="lib-body" aria-busy={phase === "loading"} aria-live="polite">
          {phase === "idle" && (
            <div className="lib-idle">
              <strong>찾고 싶은 책의 제목을 적어 보세요</strong>
              <p>제목의 일부만 적어도 돼요(저자 · 출판사로는 찾지 않아요). 우리 학교 도서관에 있는 책인지, 지금 빌릴 수 있는지(자료 상태) 알려 드려요.</p>
            </div>
          )}
          {phase === "loading" && <p className="lib-status" role="status">독서로에서 소장 도서를 찾고 있어요…</p>}
          {phase === "error" && error && (
            <div className="lib-error" role="alert">
              <strong>{error.rateLimited ? "잠시 후 다시 검색해 주세요" : "소장 여부를 확인하지 못했어요"}</strong>
              <p>{error.message}</p>
              <p className="lib-error-note">조회에 실패한 것이며, 소장하지 않는다는 뜻이 아니에요.</p>
              <div className="lib-error-actions">
                <button type="button" className="btn-primary" onClick={() => run(page)}>다시 시도</button>
                <a className="lib-origin" href={libraryResultUrl(error.keyword)} target="_blank" rel="noopener noreferrer">독서로에서 직접 보기 ↗</a>
              </div>
            </div>
          )}
          {phase === "done" && result && (result.books.length === 0 ? (
            <div className="lib-empty" role="status">
              <strong>제목에 ‘{keywordShown}’ 글자가 들어간, 일치하는 소장 도서가 없습니다.</strong>
              <p>제목 일부로만 찾아요(저자 · 출판사는 찾지 않음). 띄어쓰기나 다른 낱말로도 찾아보세요.</p>
              <a className="lib-origin" href={libraryResultUrl(keywordShown)} target="_blank" rel="noopener noreferrer">독서로에서 직접 보기 ↗</a>
            </div>
          ) : (
            <>
              <p className="lib-status" role="status">
                ‘{keywordShown}’ 소장 자료 <b>{Number(result.total).toLocaleString("ko-KR")}권</b>
                {result.total > copyTotal ? ` 가운데 ${(result.page - 1) * 10 + 1}~${(result.page - 1) * 10 + copyTotal}번째` : ""}
                <span className="lib-status-note"> · 소장 = 이 도서관에 등록된 책 · 대출 가능은 자료 상태로 따로 확인</span>
              </p>
              <ul className="lib-results">
                {result.books.map((book) => (
                  <li key={book.key} className="lib-book">
                    <LibraryCover key={book.cover || extraCovers[book.isbn13] || "none"} title={book.title} src={book.cover || extraCovers[book.isbn13] || ""} />
                    <div className="lib-book-info">
                      <div className="lib-book-head">
                        <strong className="lib-book-title">{book.title}</strong>
                        <span className="lib-own">소장 {book.copies.length}권</span>
                      </div>
                      <p className="lib-book-meta">{[book.author, book.publisher, book.pubYear].filter(Boolean).join(" · ") || "저자 · 출판사 정보 없음"}{book.isbn ? ` · ISBN ${book.isbn}` : ""}</p>
                      <table className="lib-copies">
                        <thead><tr><th scope="col">청구기호</th><th scope="col">등록번호</th><th scope="col">위치</th><th scope="col">자료 상태</th></tr></thead>
                        <tbody>
                          {book.copies.map((copy, i) => (
                            <tr key={copy.regNo || i}>
                              <td data-label="청구기호">{copy.callNo || "-"}{copy.volume ? <span className="lib-vol"> {copy.volume}</span> : null}</td>
                              <td data-label="등록번호" className="lib-mono">{copy.regNo || "-"}</td>
                              <td data-label="위치">{copy.location || "-"}</td>
                              <td data-label="자료 상태"><StatusBadge copy={copy} />{copy.returnPlanDate ? <small className="lib-return"> 반납 예정 {copy.returnPlanDate}</small> : null}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                ))}
              </ul>
              {(result.page > 1 || result.hasMore) && (
                <div className="lib-pager">
                  <button type="button" className="btn-ghost" disabled={result.page <= 1} onClick={() => run(result.page - 1)}>← 이전</button>
                  <span>{result.page}쪽</span>
                  <button type="button" className="btn-ghost" disabled={!result.hasMore} onClick={() => run(result.page + 1)}>다음 →</button>
                </div>
              )}
            </>
          ))}
        </div>
        {/* 아직 검색 전(처음 연 창)에는 받아 온 것이 없어 이 줄을 두지 않습니다 — 위 안내 상자가 할 일을 말함 */}
        {phase !== "idle" && (
          <p className="lib-foot">
            자동 확인 — 독서로 ‘우리학교 도서검색’에서 받아 왔어요{result?.cached && phase === "done" ? "(5분 안의 같은 검색은 잠시 기억한 결과)" : ""}. 표지는 독서로가 주는 그림이고, 없으면 ISBN이 같은 판본의 표지(카카오)를 붙여요. 정확한 내용은{" "}
            <a href={libraryResultUrl(keywordShown || draft.trim())} target="_blank" rel="noopener noreferrer">독서로 원본 검색 결과</a>에서 확인할 수 있어요.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
