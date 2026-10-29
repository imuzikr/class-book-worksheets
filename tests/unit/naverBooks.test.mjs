import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BookSearchError, bookSearchFailure, bookSearchText, bookIsbn, normalizeNaverBook,
  parseBookSearch, searchNaverBooks, createBookSearchLimiter, naverSearchConfigured,
} from "@/lib/server/naverBooks";

const credentials = { clientId: "private-client-id", clientSecret: "private-client-secret" };
const item = (patch = {}) => ({
  title: "<b>동물</b> 농장 &amp; 생각",
  author: "조지 오웰^번역가", publisher: "출판사",
  isbn: "0306406152 9780306406157",
  image: "http://shopping-phinf.pstatic.net/main/test.jpg?type=w300",
  link: "https://search.shopping.naver.com/book/catalog/1234",
  description: "&lt;b&gt;함께&lt;/b&gt; 읽어요. &quot;생각&quot;",
  ...patch,
});
const success = (items = [item()], total = 1) => ({ ok: true, status: 200, json: async () => ({ items, total }) });

test("naver books: query and page validation reject blank, overlong and malformed input", () => {
  assert.deepEqual(parseBookSearch("  동물 농장  "), { query: "동물 농장", start: 1 });
  assert.deepEqual(parseBookSearch("ISBN", "11"), { query: "ISBN", start: 11 });
  for (const query of [undefined, null, "", " ", true, "가".repeat(101)]) assert.throws(() => parseBookSearch(query), (e) => e.status === 400);
  for (const start of [0, -1, 1001, "1.5", "1e2", true, null, ""]) assert.throws(() => parseBookSearch("책", start), (e) => e.code === "book-search/invalid-page");
});

test("naver books: missing credentials never call the provider and return a distinguishable503", async () => {
  let called = false;
  assert.equal(naverSearchConfigured({ NAVER_CLIENT_ID: " ", NAVER_CLIENT_SECRET: "x" }), false);
  assert.equal(naverSearchConfigured({ NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" }), true);
  await assert.rejects(() => searchNaverBooks({ query: "책" }, { clientId: "", clientSecret: "", fetchImpl: async () => { called = true; } }),
    (e) => e.status === 503 && e.code === "book-search/not-configured" && e.message.includes("직접 입력"));
  assert.equal(called, false);
});

test("naver books: request has fixed authoritative destination and secret headers only upstream", async () => {
  let request;
  const data = await searchNaverBooks({ query: "책 & ISBN?", start: 11 }, { ...credentials,
    fetchImpl: async (url, init) => { request = { url: new URL(url), init }; return success([item()], 50); },
  });
  assert.equal(request.url.origin, "https://openapi.naver.com");
  assert.equal(request.url.pathname, "/v1/search/book.json");
  assert.equal(request.url.searchParams.get("query"), "책 & ISBN?");
  assert.equal(request.url.searchParams.get("start"), "11");
  assert.equal(request.url.searchParams.get("display"), "10");
  assert.equal(request.url.searchParams.get("sort"), "sim");
  assert.equal(request.init.headers["X-Naver-Client-Id"], credentials.clientId);
  assert.equal(request.init.headers["X-Naver-Client-Secret"], credentials.clientSecret);
  assert.equal(request.init.cache, "no-store");
  assert.equal(data.start, 11); assert.equal(data.hasMore, true);
  assert.equal(JSON.stringify(data).includes(credentials.clientSecret), false);
  assert.equal(JSON.stringify(data).includes(credentials.clientId), false);
});

test("naver books: plain bibliographic text has no provider HTML and respects limits", () => {
  const book = normalizeNaverBook(item());
  assert.equal(book.title, "동물 농장 & 생각");
  assert.equal(book.author, "조지 오웰, 번역가");
  assert.equal(book.description, '함께 읽어요. "생각"');
  assert.equal(bookSearchText("<script>bad()</script>&#xAC00;&#32;&#45208;&nbsp;글"), "가 나 글");
  assert.equal(bookSearchText("가".repeat(151), 150).length, 150);
  assert.ok(normalizeNaverBook(item({ author: "가^".repeat(100) })).author.length <= 100);
  assert.equal(bookSearchText({ html: "<b>책</b>" }), "");
  assert.equal(normalizeNaverBook({ title: "<b></b>" }), null);
});

test("naver books: URLs only accept official HTTPS destinations and upgrade historical HTTP", () => {
  const normalized = normalizeNaverBook(item());
  assert.ok(normalized.coverImage.startsWith("https://shopping-phinf.pstatic.net/"));
  for (const url of ["javascript:alert(1)", "https://naver.com.evil.test/a", "https://evil.test/naver.com", "https://user:pass@book.naver.com/x", "//book.naver.com/x", "https://book.naver.com:444/x"]) {
    assert.equal(normalizeNaverBook(item({ link: url })).link, "");
  }
  assert.equal(normalizeNaverBook(item({ image: "https://example.org/image.jpg" })).coverImage, "");
  assert.equal(normalizeNaverBook(item({ link: "http://book.naver.com/bookdb/book_detail.nhn?bid=12" })).link, "https://book.naver.com/bookdb/book_detail.nhn?bid=12");
});

test("naver books: ISBN prefers a valid13, accepts valid10, and never guesses page counts", () => {
  assert.equal(bookIsbn("0-306-40615-2 978-0-306-40615-7"), "9780306406157");
  assert.equal(bookIsbn("0306406152"), "0306406152");
  for (const value of [null, "", "9780306406158", "1234567890", "123"]) assert.equal(bookIsbn(value), "");
  const book = normalizeNaverBook(item({ description: "책 설명에는500페이지라고 쓰여 있어요", totalPages: 500, pageCount: 500 }));
  assert.equal("totalPages" in book, false);
  assert.equal("pageCount" in book, false);
});

test("naver books: empty results and provider pagination end are explicit", async () => {
  const empty = await searchNaverBooks({ query: "없음" }, { ...credentials, fetchImpl: async () => success([], 0) });
  assert.deepEqual(empty, { items: [], total: 0, start: 1, display: 0, hasMore: false });
  const last = await searchNaverBooks({ query: "책", start: 991 }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 10 }, () => item()), 5000) });
  assert.equal(last.items.length, 10); assert.equal(last.hasMore, false);
  const bounded = await searchNaverBooks({ query: "책" }, { ...credentials, fetchImpl: async () => success(Array.from({ length: 50 }, () => item()), 50) });
  assert.equal(bounded.items.length, 10);
});

test("naver books: provider rejection, quotas and errors do not reveal provider bodies or keys", async () => {
  for (const [status, expected, code] of [[401, 503, "credentials"], [403, 503, "credentials"], [429, 429, "rate-limited"], [500, 502, "upstream"]]) {
    await assert.rejects(() => searchNaverBooks({ query: "책" }, { ...credentials, fetchImpl: async () => ({ ok: false, status,
      json: async () => { throw new Error(credentials.clientSecret); },
      text: async () => { throw new Error(credentials.clientSecret); },
    }) }), (e) => e.status === expected && e.code === `book-search/${code}` && !e.message.includes(credentials.clientSecret));
  }
});

test("naver books: malformed provider JSON and network errors have safe errors", async () => {
  for (const response of [{ ok: true, status: 200, json: async () => { throw new Error("secret detail"); } }, success(null)]) {
    await assert.rejects(() => searchNaverBooks({ query: "책" }, { ...credentials, fetchImpl: async () => response }),
      (e) => e.status === 502 && e.code === "book-search/invalid-response" && !e.message.includes("secret"));
  }
  await assert.rejects(() => searchNaverBooks({ query: "책" }, { ...credentials, fetchImpl: async () => { throw new Error(credentials.clientSecret); } }),
    (e) => e.code === "book-search/unavailable" && !e.message.includes(credentials.clientSecret));
});

test("naver books: fetch timeout aborts request and reports504", async () => {
  let signal;
  await assert.rejects(() => searchNaverBooks({ query: "책" }, { ...credentials, timeoutMs: 5,
    fetchImpl: async (_url, init) => { signal = init.signal; return new Promise((_resolve, reject) => { signal.addEventListener("abort", () => reject(new Error("abort"))); }); },
  }), (e) => e.status === 504 && e.code === "book-search/timeout");
  assert.equal(signal.aborted, true);
});

test("naver books: slow response body shares the request timeout", async () => {
  await assert.rejects(() => searchNaverBooks({ query: "책" }, { ...credentials, timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => ({ ok: true, status: 200, json: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("abort")))) }),
  }), (e) => e.status === 504 && e.code === "book-search/timeout");
});

test("naver books: local provider quota protection is per client and resets after its window", () => {
  const allow = createBookSearchLimiter({ limit: 2, windowMs: 60, maxClients: 2 });
  assert.equal(allow("school-a", 0), true); assert.equal(allow("school-a", 1), true);
  assert.equal(allow("school-a", 2), false); assert.equal(allow("school-b", 2), true);
  assert.equal(allow("school-a", 61), true);
});

test("naver books: unexpected failures have a generic safe response", () => {
  assert.deepEqual(bookSearchFailure(new Error(credentials.clientSecret)), {
    status: 500, body: { error: "도서 검색을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", code: "book-search/internal" },
  });
  assert.equal(bookSearchFailure(new BookSearchError("검색어 확인", 400)).status, 400);
});
