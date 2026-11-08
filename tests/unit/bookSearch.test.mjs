import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BookSearchError, bookSearchFailure, bookSearchText, bookIsbn, normalizeKakaoBook,
  parseBookSearch, searchBooks, createBookSearchLimiter, bookSearchConfigured,
} from "@/lib/server/bookSearch";

const credentials = { apiKey: "private-kakao-rest-key" };
const item = (patch = {}) => ({
  title: "<b>동물</b> 농장 &amp; 생각",
  authors: ["조지 오웰", "번역가"], publisher: "출판사",
  isbn: "0306406152 9780306406157",
  thumbnail: "http://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F1",
  url: "https://search.daum.net/search?w=bookpage&bookId=1234",
  contents: "&lt;b&gt;함께&lt;/b&gt; 읽어요. &quot;생각&quot;",
  ...patch,
});
const success = (documents = [item()], total = 1, meta = {}) => ({ ok: true, status: 200,
  json: async () => ({ documents, meta: { total_count: total, pageable_count: total, is_end: false, ...meta } }) });

test("book search: query and page validation reject blank, overlong and malformed input", () => {
  assert.deepEqual(parseBookSearch("  동물 농장  "), { query: "동물 농장", start: 1 });
  assert.deepEqual(parseBookSearch("ISBN", "11"), { query: "ISBN", start: 11 });
  for (const query of [undefined, null, "", " ", true, "가".repeat(101)]) assert.throws(() => parseBookSearch(query), (e) => e.status === 400);
  assert.deepEqual(parseBookSearch("책", 491), { query: "책", start: 491 });
  for (const start of [0, -1, 501, 1001, 12, "1.5", "1e2", true, null, ""]) assert.throws(() => parseBookSearch("책", start), (e) => e.code === "book-search/invalid-page");
});

test("book search: missing credentials never call the provider and return a distinguishable503", async () => {
  let called = false;
  assert.equal(bookSearchConfigured({ KAKAO_REST_API_KEY: " " }), false);
  assert.equal(bookSearchConfigured({ NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" }), false);
  assert.equal(bookSearchConfigured({ KAKAO_REST_API_KEY: "key" }), true);
  await assert.rejects(() => searchBooks({ query: "책" }, { apiKey: "", fetchImpl: async () => { called = true; } }),
    (e) => e.status === 503 && e.code === "book-search/not-configured" && e.message.includes("직접 입력"));
  assert.equal(called, false);
});

test("book search: request has fixed authoritative destination and secret headers only upstream", async () => {
  let request;
  const data = await searchBooks({ query: "책 & ISBN?", start: 11 }, { ...credentials,
    fetchImpl: async (url, init) => { request = { url: new URL(url), init }; return success([item()], 50); },
  });
  assert.equal(request.url.origin, "https://dapi.kakao.com");
  assert.equal(request.url.pathname, "/v3/search/book");
  assert.equal(request.url.searchParams.get("query"), "책 & ISBN?");
  assert.equal(request.url.searchParams.get("page"), "2");
  assert.equal(request.url.searchParams.get("size"), "10");
  assert.equal(request.url.searchParams.get("sort"), "accuracy");
  assert.deepEqual(request.init.headers, { Authorization: `KakaoAK ${credentials.apiKey}` });
  assert.equal(request.init.cache, "no-store");
  assert.equal(data.start, 11); assert.equal(data.hasMore, true);
  assert.equal(JSON.stringify(data).includes(credentials.apiKey), false);
});

test("book search: plain bibliographic text has no provider HTML and respects limits", () => {
  const book = normalizeKakaoBook(item());
  assert.equal(book.title, "동물 농장 & 생각");
  assert.equal(book.author, "조지 오웰, 번역가");
  assert.equal(book.description, '함께 읽어요. "생각"');
  assert.equal(bookSearchText("<script>bad()</script>&#xAC00;&#32;&#45208;&nbsp;글"), "가 나 글");
  assert.equal(bookSearchText("가".repeat(151), 150).length, 150);
  assert.ok(normalizeKakaoBook(item({ authors: Array(100).fill("가") })).author.length <= 100);
  assert.equal(normalizeKakaoBook(item({ authors: "조지 오웰" })).author, "");
  assert.equal(bookSearchText({ html: "<b>책</b>" }), "");
  assert.equal(normalizeKakaoBook({ title: "<b></b>" }), null);
});

test("book search: URLs only accept official HTTPS destinations and upgrade historical HTTP", () => {
  const normalized = normalizeKakaoBook(item());
  assert.ok(normalized.coverImage.startsWith("https://search1.kakaocdn.net/"));
  assert.equal(normalized.link, "https://search.daum.net/search?w=bookpage&bookId=1234");
  for (const url of ["javascript:alert(1)", "https://daum.net.evil.test/a", "https://evil.test/daum.net", "https://user:pass@search.daum.net/x", "//search.daum.net/x", "https://search.daum.net:444/x", "https://book.naver.com/x"]) {
    assert.equal(normalizeKakaoBook(item({ url })).link, "");
  }
  for (const thumbnail of ["https://example.org/image.jpg", "https://shopping-phinf.pstatic.net/a.jpg", "https://evilkakaocdn.net/a.jpg"]) {
    assert.equal(normalizeKakaoBook(item({ thumbnail })).coverImage, "");
  }
  assert.equal(normalizeKakaoBook(item({ thumbnail: "" })).coverImage, "");
  assert.equal(normalizeKakaoBook(item({ url: "http://search.daum.net/search?q=1" })).link, "https://search.daum.net/search?q=1");
});

test("book search: ISBN prefers a valid13, accepts valid10, and never guesses page counts", () => {
  assert.equal(bookIsbn("0-306-40615-2 978-0-306-40615-7"), "9780306406157");
  assert.equal(bookIsbn("0306406152"), "0306406152");
  for (const value of [null, "", "9780306406158", "1234567890", "123"]) assert.equal(bookIsbn(value), "");
  const book = normalizeKakaoBook(item({ contents: "책 설명에는500페이지라고 쓰여 있어요", totalPages: 500, pageCount: 500 }));
  assert.equal("totalPages" in book, false);
  assert.equal("pageCount" in book, false);
});

test("book search: empty results and provider pagination end are explicit", async () => {
  const empty = await searchBooks({ query: "없음" }, { ...credentials, fetchImpl: async () => success([], 0) });
  assert.deepEqual(empty, { items: [], total: 0, start: 1, display: 0, hasMore: false });
  const last = await searchBooks({ query: "책", start: 491 }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 10 }, () => item()), 5000) });
  assert.equal(last.items.length, 10); assert.equal(last.hasMore, false);
  const ended = await searchBooks({ query: "책" }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 10 }, () => item()), 5000, { is_end: true }) });
  assert.equal(ended.hasMore, false); assert.equal(ended.total, 5000);
  const capped = await searchBooks({ query: "책", start: 11 }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 10 }, () => item()), 900, { pageable_count: 20 }) });
  assert.equal(capped.hasMore, false);
  const more = await searchBooks({ query: "책", start: 11 }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 10 }, () => item()), 900, { pageable_count: 21 }) });
  assert.equal(more.hasMore, true);
  const bounded = await searchBooks({ query: "책" }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 50 }, () => item()), 50) });
  assert.equal(bounded.items.length, 10);
});

test("book search: provider rejection, quotas and errors do not reveal provider bodies or keys", async () => {
  for (const [status, expected, code] of [[401, 503, "credentials"], [403, 503, "credentials"], [429, 429, "rate-limited"], [500, 502, "upstream"]]) {
    await assert.rejects(() => searchBooks({ query: "책" }, { ...credentials, fetchImpl: async () => ({ ok: false, status,
      json: async () => { throw new Error(credentials.apiKey); },
      text: async () => { throw new Error(credentials.apiKey); },
    }) }), (e) => e.status === expected && e.code === `book-search/${code}` && !e.message.includes(credentials.apiKey));
  }
});

test("book search: malformed provider JSON and network errors have safe errors", async () => {
  for (const response of [{ ok: true, status: 200, json: async () => { throw new Error("secret detail"); } }, success(null)]) {
    await assert.rejects(() => searchBooks({ query: "책" }, { ...credentials, fetchImpl: async () => response }),
      (e) => e.status === 502 && e.code === "book-search/invalid-response" && !e.message.includes("secret"));
  }
  await assert.rejects(() => searchBooks({ query: "책" }, { ...credentials, fetchImpl: async () => { throw new Error(credentials.apiKey); } }),
    (e) => e.code === "book-search/unavailable" && !e.message.includes(credentials.apiKey));
});

test("book search: fetch timeout aborts request and reports504", async () => {
  let signal;
  await assert.rejects(() => searchBooks({ query: "책" }, { ...credentials, timeoutMs: 5,
    fetchImpl: async (_url, init) => { signal = init.signal; return new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("abort"))); }); },
  }), (e) => e.status === 504 && e.code === "book-search/timeout");
  assert.equal(signal.aborted, true);
});

test("book search: slow response body shares the request timeout", async () => {
  await assert.rejects(() => searchBooks({ query: "책" }, { ...credentials, timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => ({ ok: true, status: 200, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("abort")))) }),
  }), (e) => e.status === 504 && e.code === "book-search/timeout");
});

test("book search: local provider quota protection is per client and resets after its window", () => {
  const allow = createBookSearchLimiter({ limit: 2, windowMs: 60, maxClients: 2 });
  assert.equal(allow("school-a", 0), true); assert.equal(allow("school-a", 1), true);
  assert.equal(allow("school-a", 2), false); assert.equal(allow("school-b", 2), true);
  assert.equal(allow("school-a", 61), true);
});

test("book search: unexpected failures have a generic safe response", () => {
  assert.deepEqual(bookSearchFailure(new Error(credentials.apiKey)), {
    status: 500, body: { error: "도서 검색을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", code: "book-search/internal" },
  });
  assert.equal(bookSearchFailure(new BookSearchError("검색어 확인", 400)).status, 400);
});
