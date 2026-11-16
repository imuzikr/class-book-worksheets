// 한성여자고등학교 도서관 소장 도서 검색 — 독서로(read365.edunet.net)의 '우리학교 도서검색'.
//
// 확인한 것(2026-11-16, 실제 요청으로):
//   · 독서로의 공개 화면(PureScreen/SchoolSearchResult)이 로그인하지 않은 방문자에게 쓰는 두 요청을
//     그대로 씁니다 — 로그인 · 토큰 · 쿠키를 보내지 않고, 그 화면과 같은 칸만 보냅니다.
//       POST /alpasq/api/search            (JSON — searchKeyword · searchType TITLE · neisCode[] · provCode · page · display)
//         → { status: "OK", data: { allTotalCount, totalCount, totalPage, bookList: [권(등록번호)마다 한 줄] } }
//       GET  /alpasq/api/search/book/state?bookKey&provCode&neisCode
//         → { status: "OK", data: { status: "대출가능" | "대출중" | "정리중" …, returnPlanDate, rsvtYn, locationName } }
//   · 공식으로 공개된 API는 아닙니다 — 화면이 바뀌면 깨질 수 있어, 모양이 다르면 '조회 실패'로 알립니다(결과 없음으로 꾸미지 않음).
//   · robots.txt는 모두 허용(Allow: /). 그래도 화면에서 '검색'을 누를 때만 묻고, 사람마다 · 서버 전체에 요청 한도를 두며
//     같은 검색은 잠시 기억해 독서로에 다시 묻지 않습니다.
//
// 이 파일은 firebase-admin을 가져오지 않습니다(단위 시험이 그대로 읽게) — 로그인 확인은 route가 넘기는 authorize가 합니다.

import { LIBRARY, libraryResultUrl } from "../schoolLibraryLink.js";
import { BookSearchError, bookSearchConfigured, lookupKakaoCoverByIsbn, toIsbn13 } from "./bookSearch.js";

export { LIBRARY, libraryResultUrl };

export const LIBRARY_KEYWORD_MAX = 50;
export const LIBRARY_PAGE_SIZE = 10;
export const LIBRARY_PAGE_MAX = 50;
const STATE_CONCURRENCY = 4;
// 독서로에서 '대출할 수 있다'는 이 말 하나뿐입니다(독서로 화면도 이 글자로만 가름).
export const LIBRARY_AVAILABLE_STATUS = "대출가능";

export class LibrarySearchError extends Error {
  constructor(message, status = 400, code = "library/invalid-query") {
    super(message);
    this.name = "LibrarySearchError";
    this.status = status;
    this.code = code;
  }
}

// 검색어 — 제목의 일부(1~50자). 제어 문자는 걷고 띄어쓰기는 하나로.
export function parseLibraryQuery(rawKeyword, rawPage = 1) {
  const keyword = typeof rawKeyword === "string"
    ? rawKeyword.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (!keyword) throw new LibrarySearchError("검색할 책 제목을 입력해 주세요.", 400, "library/empty-query");
  if (keyword.length > LIBRARY_KEYWORD_MAX) {
    throw new LibrarySearchError(`검색어는 ${LIBRARY_KEYWORD_MAX}자까지 입력할 수 있어요.`, 400, "library/query-too-long");
  }
  const pageText = String(rawPage ?? 1);
  const page = Number(pageText);
  if (!/^\d{1,3}$/.test(pageText) || page < 1 || page > LIBRARY_PAGE_MAX) {
    throw new LibrarySearchError("검색 결과 페이지를 확인해 주세요.", 400, "library/invalid-page");
  }
  return { keyword, page };
}

// 로그인한 사용자 모두 — 학생 · 교사 · 관리자(선생님 요청 · 2026년 11월 '독서로 검색' — 한때 교사 · 관리자만).
// 앱에 가입한 계정(users/{uid} 프로필이 있음)이어야 하고(익명 · 프로필 없는 토큰은 401), 사용 중지된 계정은 403 —
// 둘 다 독서로에 묻기 전에 거절합니다. 역할은 보지 않습니다(학생도 같은 결과를 받음).
export function assertLibraryUser({ uid, profile }) {
  if (!uid || !profile) throw new LibrarySearchError("로그인이 필요합니다.", 401, "library/unauthenticated");
  if (profile.suspended === true) throw new LibrarySearchError("사용이 중지된 계정입니다.", 403, "library/forbidden");
}

function text(value, max = 200) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, max);
}

// 표지 — 독서로가 자료 상태 응답(과 coverYn: "Y" 검색)에 싣는 coverUrl. 2026-11-16 실측으로 모두 알라딘 그림 서버
// (https://image.aladin.co.kr/product/…/cover500/…)였습니다. 그 서버의 https 주소만 받고, 다른 곳 · 이상한 값은 ""
// (화면이 카카오 ISBN 보완 → 기본 표지로 넘어감). 공식 공개 API가 아니라 칸이 없어질 수 있어 빈 값도 정상입니다.
export const LIBRARY_COVER_HOSTS = ["image.aladin.co.kr"];
export function libraryCoverUrl(value) {
  if (typeof value !== "string" || !value || value.length > 1000) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (!LIBRARY_COVER_HOSTS.includes(url.hostname)) return "";
    return url.href;
  } catch { return ""; }
}

// 한 권(등록번호 한 줄) — 독서로 검색 결과에 이 학교의 등록번호로 나오면 '소장'입니다(대출 가능 여부와 별개).
export function normalizeLibraryCopy(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.neisCode && raw.neisCode !== LIBRARY.neisCode) return null;   // 다른 학교 책은 싣지 않음
  const title = text(raw.title, 200);
  if (!title) return null;
  return {
    bookKey: /^\d{1,20}$/.test(String(raw.bookKey ?? "")) ? String(raw.bookKey) : "",
    speciesKey: text(raw.speciesKey, 40),
    title,
    author: text(raw.author, 120),
    publisher: text(raw.publisher, 120),
    pubYear: text(raw.pubYear, 10),
    isbn: /^[\dX]{10,13}$/i.test(String(raw.isbn ?? "")) ? String(raw.isbn) : "",
    isbn13: toIsbn13(String(raw.isbn ?? "")),
    cover: libraryCoverUrl(raw.coverUrl),
    regNo: text(raw.regNo, 30),
    callNo: text(raw.callNo, 60),
    volume: text(raw.volume || raw.volumeTitle, 60),
    location: text(raw.locationName, 60),
    form: text(raw.pubFormCodeDesc, 30),
  };
}

// 자료 상태 — 받아 온 그대로 적고, '대출 가능'은 그 말일 때만. 상태를 못 받았으면 unknown(소장은 그대로).
export function normalizeLibraryState(body) {
  const data = body?.status === "OK" && body?.data && typeof body.data === "object" ? body.data : null;
  if (!data) return { status: "", available: null, returnPlanDate: "", reservable: null, location: "", known: false, cover: "" };
  const status = text(data.status, 30);
  return {
    status,
    available: status ? status === LIBRARY_AVAILABLE_STATUS : null,
    returnPlanDate: /^\d{4}[-.]?\d{2}[-.]?\d{2}/.test(String(data.returnPlanDate ?? "")) ? text(data.returnPlanDate, 20) : "",
    reservable: data.rsvtYn === "Y" ? true : data.rsvtYn === "N" ? false : null,
    location: text(data.locationName, 60),
    known: !!status,
    cover: libraryCoverUrl(data.coverUrl),
  };
}

// 같은 책(종)의 여러 권을 한 묶음으로 — 이 쪽 안에서만 묶습니다(쪽이 넘어가면 따로 섬).
export function groupLibraryCopies(copies) {
  const groups = [];
  const byKey = new Map();
  for (const copy of copies) {
    const key = copy.speciesKey || `${copy.title}|${copy.author}|${copy.publisher}|${copy.pubYear}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, title: copy.title, author: copy.author, publisher: copy.publisher, pubYear: copy.pubYear, isbn: copy.isbn,
        isbn13: copy.isbn13 || "", form: copy.form, cover: "", coverSource: "", copies: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    // 표지는 책(종) 한 장 — 권마다의 표지 중 처음 것(같은 종이라 판본이 같음)
    if (!group.cover && copy.cover) { group.cover = copy.cover; group.coverSource = "read365"; }
    if (!group.isbn13 && copy.isbn13) group.isbn13 = copy.isbn13;
    const { bookKey: _b, speciesKey: _s, title: _t, author: _a, publisher: _p, pubYear: _y, isbn: _i, isbn13: _i13, form: _f, cover: _c, ...rest } = copy;
    group.copies.push(rest);
  }
  return groups;
}

async function upstreamJson(fetchImpl, url, init, timeoutMs, { retries = 1 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...init, cache: "no-store", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; school-reading-app)", ...init.headers },
      });
      if (response.status === 429) throw new LibrarySearchError("독서로가 지금 요청을 받지 않아요. 잠시 후 다시 검색해 주세요.", 503, "library/upstream-busy");
      if (!response.ok) throw new LibrarySearchError(`독서로 도서검색이 응답하지 않았어요(HTTP ${response.status}).`, 502, "library/upstream-status");
      try { return await response.json(); }
      catch {
        if (controller.signal.aborted) throw new LibrarySearchError("독서로 응답이 늦어 확인하지 못했어요.", 504, "library/timeout");
        throw new LibrarySearchError("독서로 응답을 읽지 못했어요(형식이 바뀌었을 수 있어요).", 502, "library/invalid-response");
      }
    } catch (error) {
      if (error instanceof LibrarySearchError) throw error;
      if (controller.signal.aborted) throw new LibrarySearchError("독서로 응답이 늦어 확인하지 못했어요.", 504, "library/timeout");
      // 연결이 끊기는 일이 가끔 있어(실측) 한 번만 다시 묻습니다.
      if (attempt < retries) continue;
      throw new LibrarySearchError("독서로에 연결하지 못했어요.", 502, "library/unreachable");
    } finally { clearTimeout(timer); }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// 소장 검색 — 검색 1회 + (결과의 권마다) 자료 상태 1회. 검색이 실패하면 오류(결코 '결과 없음'이 아님),
// 자료 상태만 실패하면 그 권은 '상태 확인 실패'로 싣습니다(소장은 확인된 것이므로).
export async function searchSchoolLibrary(input, { fetchImpl = fetch, timeoutMs = 8000, stateTimeoutMs = 5000 } = {}) {
  const { keyword, page } = parseLibraryQuery(input?.keyword, input?.page ?? 1);
  const body = await upstreamJson(fetchImpl, `${LIBRARY.origin}/alpasq/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchKeyword: keyword, searchType: "TITLE", page, display: LIBRARY_PAGE_SIZE,
      neisCode: [LIBRARY.neisCode], provCode: LIBRARY.provCode, schoolName: LIBRARY.schoolName,
      // coverYn "Y" — 결과(실측 소년 99권 · 채식주의자 1권)는 "N"과 같고 권마다 coverUrl이 함께 옵니다.
      // 자료 상태 조회가 끊겨도 표지가 남게(상태 응답의 coverUrl이 있으면 그것을 먼저 씀).
      coverYn: "Y", facet: "N",
    }),
  }, timeoutMs);
  const data = body?.status === "OK" ? body.data : null;
  if (!data || typeof data !== "object" || !Array.isArray(data.bookList)) {
    throw new LibrarySearchError("독서로 응답을 읽지 못했어요(형식이 바뀌었을 수 있어요).", 502, "library/invalid-response");
  }
  const totalRaw = Number(data.allTotalCount ?? data.totalCount);
  const copies = data.bookList.slice(0, LIBRARY_PAGE_SIZE).map(normalizeLibraryCopy).filter(Boolean);
  const total = Number.isSafeInteger(totalRaw) && totalRaw >= 0 ? totalRaw : copies.length;
  const states = await mapLimit(copies, STATE_CONCURRENCY, async (copy) => {
    if (!copy.bookKey) return normalizeLibraryState(null);
    const url = new URL("/alpasq/api/search/book/state", LIBRARY.origin);
    url.searchParams.set("bookKey", copy.bookKey);
    url.searchParams.set("provCode", LIBRARY.provCode);
    url.searchParams.set("neisCode", LIBRARY.neisCode);
    try { return normalizeLibraryState(await upstreamJson(fetchImpl, url.href, { method: "GET" }, stateTimeoutMs, { retries: 0 })); }
    catch { return normalizeLibraryState(null); }
  });
  const withState = copies.map((copy, i) => {
    const state = states[i];
    return { ...copy, cover: state.cover || copy.cover, location: state.location || copy.location, status: state.status, available: state.available,
      returnPlanDate: state.returnPlanDate, reservable: state.reservable, stateKnown: state.known };
  });
  const totalPage = Math.min(LIBRARY_PAGE_MAX, Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE)));
  return {
    keyword, page, total, copyCount: withState.length,
    hasMore: withState.length > 0 && page < totalPage,
    books: groupLibraryCopies(withState),
    source: { name: "독서로 우리학교 도서검색", school: LIBRARY.schoolName, url: libraryResultUrl(keyword) },
    checkedAt: new Date().toISOString(),
  };
}

// 고정 창 한도(사람마다 · 서버 전체) — bookSearch.js의 limiter와 같은 모양.
export function createLibraryLimiter({ limit = 20, windowMs = 60000, maxClients = 2000 } = {}) {
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

// 성공한 검색만 잠시 기억합니다(실패는 기억하지 않음 — 다시 누르면 곧바로 다시 물음).
export function createLibraryCache({ ttlMs = 5 * 60000, max = 200 } = {}) {
  const store = new Map();
  return {
    get(key, now = Date.now()) {
      const hit = store.get(key);
      if (!hit) return null;
      if (now >= hit.expires) { store.delete(key); return null; }
      return hit.value;
    },
    set(key, value, now = Date.now(), ttl = ttlMs) {
      if (store.size >= max && !store.has(key)) store.delete(store.keys().next().value);
      store.set(key, { value, expires: now + ttl });
    },
  };
}

export function libraryFailure(error) {
  if (error instanceof LibrarySearchError || (error && typeof error.status === "number" && typeof error.code === "string")) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  return { status: 500, body: { error: "도서관 소장 검색을 처리하지 못했어요.", code: "library/internal" } };
}

// route가 쓰는 처리기 — 로그인 확인(authorize) → 입력 확인 → 한도 → 기억 → 독서로.
// 입력이 틀린 요청은 한도를 세기 전에 거절하되, 로그인부터 확인해 로그인하지 않았거나 사용 중지된 계정은
// 검색어를 보내도 아무것도 받지 못합니다.
export function createLibrarySearchHandler({ authorize, search = searchSchoolLibrary,
  userLimiter = createLibraryLimiter({ limit: 20 }), globalLimiter = createLibraryLimiter({ limit: 120, maxClients: 1 }),
  cache = createLibraryCache() } = {}) {
  return async function handle(request) {
    try {
      const uid = await authorize(request);
      const params = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
      const { keyword, page } = parseLibraryQuery(params.get("q"), params.get("page") ?? 1);
      const key = `${keyword.toLowerCase()}|${page}`;
      if (!userLimiter(uid)) throw new LibrarySearchError("검색 요청이 많아요. 1분 후 다시 검색해 주세요.", 429, "library/rate-limited");
      const cached = cache.get(key);
      if (cached) return { status: 200, body: { ...cached, cached: true } };
      if (!globalLimiter("all")) throw new LibrarySearchError("지금 검색하는 사람이 많아요. 1분 후 다시 검색해 주세요.", 429, "library/rate-limited");
      const result = await search({ keyword, page });
      cache.set(key, result);
      return { status: 200, body: result };
    } catch (error) {
      return libraryFailure(error);
    }
  };
}

// ── 표지 보완(카카오 · ISBN 정확히 일치) ──────────────────────────────────────────
// 독서로에 표지가 없는 책만 화면이 하나씩 묻습니다(/api/library/cover?isbn=). 소장 검색과 따로라 표지가 늦거나
// 실패해도 결과 · 소장 · 자료 상태는 그대로 섭니다. 키는 서버에서만(lib/server/bookSearch.js).
// 맞는 표지(24시간) · 맞는 표지 없음(6시간)만 기억하고, 실패는 기억하지 않습니다.
export function parseLibraryCoverIsbn(raw) {
  const isbn13 = toIsbn13(typeof raw === "string" ? raw.slice(0, 40) : "");
  if (!isbn13) throw new LibrarySearchError("ISBN을 확인해 주세요.", 400, "library/invalid-isbn");
  return isbn13;
}

export function createLibraryCoverHandler({ authorize, lookup = lookupKakaoCoverByIsbn, configured = () => bookSearchConfigured(),
  userLimiter = createLibraryLimiter({ limit: 60 }), globalLimiter = createLibraryLimiter({ limit: 300, maxClients: 1 }),
  cache = createLibraryCache({ ttlMs: 24 * 3600000, max: 1000 }), missTtlMs = 6 * 3600000, timeoutMs = 4000 } = {}) {
  return async function handle(request) {
    try {
      const uid = await authorize(request);
      const params = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
      const isbn13 = parseLibraryCoverIsbn(params.get("isbn"));
      const cached = cache.get(isbn13);
      if (cached) return { status: 200, body: { ...cached, cached: true } };
      // 키가 없으면 묻지 않고 '없음'(기본 표지) — 한도도 세지 않음
      if (!configured()) return { status: 200, body: { isbn: isbn13, cover: "", source: "none", reason: "not-configured" } };
      if (!userLimiter(uid) || !globalLimiter("all")) {
        throw new LibrarySearchError("표지 요청이 많아요. 잠시 후 다시 시도해 주세요.", 429, "library/cover-rate-limited");
      }
      let found;
      try { found = await lookup(isbn13, { timeoutMs }); }
      catch (error) {
        if (error instanceof BookSearchError && error.code === "book-search/not-configured") {
          return { status: 200, body: { isbn: isbn13, cover: "", source: "none", reason: "not-configured" } };
        }
        throw new LibrarySearchError("표지를 가져오지 못했어요.", error?.status === 504 ? 504 : 502, "library/cover-unavailable");
      }
      const body = found?.cover
        ? { isbn: isbn13, cover: found.cover, source: "kakao" }
        : { isbn: isbn13, cover: "", source: "none", reason: "no-match" };
      cache.set(isbn13, body, Date.now(), found?.cover ? undefined : missTtlMs);
      return { status: 200, body };
    } catch (error) {
      return libraryFailure(error);
    }
  };
}
