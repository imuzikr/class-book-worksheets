// Public book metadata proxy (카카오 · 다음 책 검색). The REST API key is read only
// on the server and is never included in responses, error messages or logs.
// 네이버 책 검색 API는 2026-07-31에 끝나 카카오로 옮겼습니다. 응답 모양
// ({ items, total, start, display, hasMore })은 그대로라 화면은 안 바뀝니다.
const KAKAO_BOOKS_URL = "https://dapi.kakao.com/v3/search/book";
const PAGE_SIZE = 10;
// 카카오는 page 1~50까지만 줍니다 — start(1, 11, 21 …)로 치면 491이 끝입니다.
export const BOOK_SEARCH_MAX_START = 1 + PAGE_SIZE * 49;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export class BookSearchError extends Error {
  constructor(message, status = 400, code = "book-search/invalid-query") {
    super(message);
    this.name = "BookSearchError";
    this.status = status;
    this.code = code;
  }
}

export function parseBookSearch(query, start = 1) {
  if (typeof query !== "string" || !query.trim() || query.trim().length > 100) {
    throw new BookSearchError("검색어를 1~100자로 입력해 주세요.");
  }
  if (!["string", "number"].includes(typeof start) || !/^\d+$/.test(String(start))
      || !Number.isSafeInteger(Number(start)) || Number(start) < 1 || Number(start) > BOOK_SEARCH_MAX_START
      || (Number(start) - 1) % PAGE_SIZE !== 0) {
    throw new BookSearchError("검색 결과 페이지를 확인해 주세요.", 400, "book-search/invalid-page");
  }
  return { query: query.trim(), start: Number(start) };
}

export function bookSearchConfigured(env = process.env) {
  return typeof env.KAKAO_REST_API_KEY === "string" && !!env.KAKAO_REST_API_KEY.trim();
}

export function bookSearchText(value, max = 1000) {
  if (typeof value !== "string") return "";
  const decoded = value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    const key = entity.toLowerCase();
    if (!key.startsWith("#")) return ENTITIES[key] || "";
    const number = key.startsWith("#x") ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : "";
  });
  return decoded.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, max);
}

const hostIn = (host, domains) => domains.some((d) => host === d || host.endsWith(`.${d}`));
// 표지는 카카오 · 다음 그림 서버, 책 링크는 다음 · 카카오 페이지만 받습니다.
export const COVER_DOMAINS = ["kakaocdn.net", "daumcdn.net"];
export const LINK_DOMAINS = ["daum.net", "kakao.com"];

function officialUrl(value, image = false) {
  if (typeof value !== "string" || value.length > 1000) return "";
  try {
    const url = new URL(value);
    const allowed = hostIn(url.hostname, image ? COVER_DOMAINS : LINK_DOMAINS);
    if (!allowed || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return "";
    url.protocol = "https:";
    return url.href;
  } catch { return ""; }
}

export function bookIsbn(value) {
  if (typeof value !== "string") return "";
  const values = value.trim().split(/\s+/).map((item) => item.replace(/-/g, "").toUpperCase());
  const valid13 = values.find((item) => /^\d{13}$/.test(item)
    && [...item].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10 === 0);
  if (valid13) return valid13;
  return values.find((item) => /^\d{9}[\dX]$/.test(item)
    && [...item].reduce((sum, digit, i) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - i), 0) % 11 === 0) || "";
}

export function normalizeKakaoBook(item) {
  if (!item || typeof item !== "object") return null;
  const title = bookSearchText(item.title, 150);
  if (!title) return null;
  const authors = Array.isArray(item.authors) ? item.authors.filter((a) => typeof a === "string") : [];
  return {
    title,
    author: bookSearchText(authors.join(", "), 100),
    publisher: bookSearchText(item.publisher, 100),
    isbn: bookIsbn(item.isbn),
    coverImage: officialUrl(item.thumbnail, true),
    link: officialUrl(item.url),
    description: bookSearchText(item.contents, 1000),
  };
}

export async function searchBooks(input, options = {}) {
  const { query, start } = parseBookSearch(input?.query, input?.start ?? 1);
  const apiKey = options.apiKey ?? process.env.KAKAO_REST_API_KEY;
  if (!bookSearchConfigured({ KAKAO_REST_API_KEY: apiKey })) {
    throw new BookSearchError("도서 검색을 준비 중이에요. 지금은 책 정보를 직접 입력할 수 있어요.", 503, "book-search/not-configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const url = new URL(KAKAO_BOOKS_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("page", String((start - 1) / PAGE_SIZE + 1));
    url.searchParams.set("size", String(PAGE_SIZE));
    url.searchParams.set("sort", "accuracy");
    const response = await (options.fetchImpl ?? fetch)(url.href, {
      headers: { Authorization: `KakaoAK ${apiKey.trim()}` },
      cache: "no-store", signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new BookSearchError("도서 검색 연결을 확인하고 있어요. 책 정보를 직접 입력해 주세요.", 503, "book-search/credentials");
    }
    if (response.status === 429) {
      throw new BookSearchError("도서 검색 요청이 많아요. 잠시 후 다시 검색하거나 직접 입력해 주세요.", 429, "book-search/rate-limited");
    }
    if (!response.ok) throw new BookSearchError("도서 검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", 502, "book-search/upstream");
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      throw new BookSearchError("검색 결과를 읽지 못했어요. 잠시 후 다시 시도해 주세요.", 502, "book-search/invalid-response");
    }
    if (!Array.isArray(data?.documents)) throw new BookSearchError("검색 결과를 읽지 못했어요. 잠시 후 다시 시도해 주세요.", 502, "book-search/invalid-response");
    const items = data.documents.slice(0, PAGE_SIZE).map(normalizeKakaoBook).filter(Boolean);
    const meta = data.meta || {};
    const total = Number.isSafeInteger(meta.total_count) && meta.total_count >= 0 ? meta.total_count : items.length;
    // 카카오는 넘겨 볼 수 있는 건수(pageable_count)와 끝 여부(is_end)를 따로 줍니다.
    const pageable = Number.isSafeInteger(meta.pageable_count) && meta.pageable_count >= 0 ? meta.pageable_count : total;
    return { items, total, start, display: items.length,
      hasMore: items.length > 0 && meta.is_end !== true && start + PAGE_SIZE <= Math.min(pageable, BOOK_SEARCH_MAX_START) };
  } catch (error) {
    if (error instanceof BookSearchError) throw error;
    if (controller.signal.aborted) throw new BookSearchError("검색 시간이 길어지고 있어요. 잠시 후 다시 시도해 주세요.", 504, "book-search/timeout");
    throw new BookSearchError("도서 검색에 연결하지 못했어요. 직접 입력하거나 다시 시도해 주세요.", 502, "book-search/unavailable");
  } finally { clearTimeout(timer); }
}

export function createBookSearchLimiter({ limit = 60, windowMs = 60000, maxClients = 2000 } = {}) {
  const clients = new Map();
  return (client, now = Date.now()) => {
    for (const [key, value] of clients) if (now >= value.expires) clients.delete(key);
    let entry = clients.get(client);
    if (!entry) {
      if (clients.size >= maxClients) clients.delete(clients.keys().next().value);
      entry = { count: 0, expires: now + windowMs };
      clients.set(client, entry);
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

export function bookSearchFailure(error) {
  if (error instanceof BookSearchError) return { status: error.status, body: { error: error.message, code: error.code } };
  return { status: 500, body: { error: "도서 검색을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", code: "book-search/internal" } };
}
