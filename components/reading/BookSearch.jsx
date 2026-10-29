"use client";

import { useEffect, useId, useRef, useState } from "react";

function SearchCover({ src, title }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <img src={src} alt={`${title} 표지`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="reading-search-cover-fallback" aria-label="표지 이미지 없음">책</span>;
}

export default function BookSearch({ busy = false, onSelect, onManual }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const requestRef = useRef(null);
  const generationRef = useRef(0);
  const resultId = useId();
  const helpId = useId();

  useEffect(() => () => {
    generationRef.current += 1;
    requestRef.current?.abort();
  }, []);

  function editQuery(value) {
    generationRef.current += 1;
    requestRef.current?.abort();
    setQuery(value);
    setData(null);
    setLoading(false);
    setError("");
  }

  async function search(start = 1) {
    if (busy) return;
    const term = query.trim();
    if (!term) { setError("제목, 저자 또는 ISBN을 입력해 주세요."); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    setLoading(true); setError(""); setData(null);
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(term)}&start=${start}`, {
        signal: controller.signal, cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (generation !== generationRef.current) return;
      if (!response.ok) throw new Error(body.code === "book-search/not-configured"
        ? "도서 검색을 준비 중이에요. 지금은 아래에서 책 정보를 직접 입력해 주세요."
        : body.error || "검색하지 못했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.");
      if (!Array.isArray(body.items)) throw new Error("검색 결과를 읽지 못했어요. 직접 입력하거나 다시 검색해 주세요.");
      setData(body);
      setSearchedQuery(term);
    } catch (e) {
      if (e.name !== "AbortError" && generation === generationRef.current) setError(e.message || "검색 연결을 확인해 주세요. 책 정보는 직접 입력할 수 있어요.");
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }

  return <section className="reading-book-search" aria-label="네이버 도서 검색">
    <div className="reading-search-head"><strong>네이버에서 책 찾기</strong><button type="button" className="reading-search-manual" onClick={onManual} disabled={busy}>직접 입력하기</button></div>
    <form className="reading-search-form" onSubmit={(e) => { e.preventDefault(); search(1); }}>
      <label htmlFor={`${resultId}-query`} className="reading-sr-only">도서 검색어</label>
      <input id={`${resultId}-query`} data-initial-focus value={query} onChange={(e) => editQuery(e.target.value)}
        placeholder="책 제목, 저자, ISBN으로 검색" maxLength={100} disabled={busy} aria-describedby={helpId} aria-controls={resultId} />
      <button type="submit" className="reading-small-primary" disabled={busy || loading || !query.trim()}>{loading ? "검색 중…" : "검색"}</button>
    </form>
    <p className="reading-help" id={helpId}>검색한 책을 선택한 뒤 전체 쪽수를 확인해 주세요. 검색 없이 직접 입력해도 돼요.</p>
    <div id={resultId} aria-busy={loading}>
      {loading && <p className="reading-search-status" role="status">책을 찾고 있어요.</p>}
      {error && <p className="reading-search-error" role="alert">{error}</p>}
      {data && <>
        <p className="reading-search-status" role="status">{data.items.length ? `‘${searchedQuery}’ 검색 결과 ${Number(data.total || data.items.length).toLocaleString("ko-KR")}건` : "검색 결과가 없어요. 다른 검색어를 사용하거나 책 정보를 직접 입력해 주세요."}</p>
        {data.items.length > 0 && <ul className="reading-search-results">
          {data.items.map((book, i) => <li key={`${book.isbn || book.title}-${data.start || 1}-${i}`}>
            <div className="reading-search-cover"><SearchCover key={book.coverImage || "none"} src={book.coverImage} title={book.title} /></div>
            <div className="reading-search-book"><strong>{book.title}</strong><span>{book.author || "저자 정보 없음"}</span>{book.publisher && <span>{book.publisher}</span>}{book.isbn && <small>ISBN {book.isbn}</small>}</div>
            <button type="button" className="reading-small-primary" onClick={() => onSelect(book)} disabled={busy || loading} aria-label={`${book.title} 선택`}>선택</button>
          </li>)}
        </ul>}
        {data.items.length > 0 && <nav className="reading-search-pages" aria-label="도서 검색 결과 페이지">
          <button type="button" className="btn-ghost" disabled={busy || loading || Number(data.start || 1) <= 1} onClick={() => search(Math.max(1, Number(data.start || 1) - 10))}>이전</button>
          <span>{Math.floor((Number(data.start || 1) - 1) / 10) + 1} 페이지</span>
          <button type="button" className="btn-ghost" disabled={busy || loading || !data.hasMore} onClick={() => search(Number(data.start || 1) + 10)}>다음</button>
        </nav>}
      </>}
    </div>
  </section>;
}
