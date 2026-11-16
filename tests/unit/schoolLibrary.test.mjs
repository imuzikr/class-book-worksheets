// 학교 도서관 소장 검색(lib/server/schoolLibrary.js) — 독서로 응답 모양은 2026-11-16 실제 요청에서 받은 그대로 줄인 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertLibraryTeacher, createLibraryCache, createLibraryLimiter, createLibrarySearchHandler, LIBRARY,
  libraryResultUrl, normalizeLibraryState, parseLibraryQuery, searchSchoolLibrary,
} from "@/lib/server/schoolLibrary";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const copy = (over = {}) => ({
  bookKey: "54870299", speciesKey: "54692878", provCode: "B10", neisCode: "B100000556", schoolName: "한성여자고등학교",
  title: "채식주의자", author: "한강 지음", publisher: "창비", pubYear: "2007", isbn: "9788936433598",
  regNo: "0000015784", callNo: "813.6 한12ㅊ", locationName: "도서관", volume: "", pubFormCodeDesc: "단행본",
  highlightTitle: "<span class='highlight'>채식주의자</span>", ...over,
});
const searchBody = (list, total = list.length) => ({ status: "OK", message: "SUCCESS", data: { allTotalCount: total, totalCount: total, bookList: list } });
const stateBody = (status, extra = {}) => ({ status: "OK", message: "SUCCESS", data: { status, returnPlanDate: "", rsvtYn: "N", locationName: "도서관", ...extra } });

function fakeUpstream({ search, states = {}, calls = [] }) {
  return async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/alpasq/api/search")) return typeof search === "function" ? search(url, init) : search;
    const key = new URL(url).searchParams.get("bookKey");
    const s = states[key];
    if (s instanceof Error) throw s;
    return s ?? json(stateBody("대출가능"));
  };
}

test("검색어 확인 — 빈 값 · 너무 긴 값 · 틀린 쪽은 거절, 띄어쓰기는 하나로", () => {
  assert.throws(() => parseLibraryQuery("   "), (e) => e.code === "library/empty-query" && e.status === 400);
  assert.throws(() => parseLibraryQuery(undefined), (e) => e.code === "library/empty-query");
  assert.throws(() => parseLibraryQuery("가".repeat(51)), (e) => e.code === "library/query-too-long");
  assert.throws(() => parseLibraryQuery("봄", "0"), (e) => e.code === "library/invalid-page");
  assert.throws(() => parseLibraryQuery("봄", "1; drop"), (e) => e.code === "library/invalid-page");
  assert.deepEqual(parseLibraryQuery("  채식\n  주의자 "), { keyword: "채식 주의자", page: 1 });
});

test("선생님 · 관리자만 — 학생 · 사용 중지 · 프로필 없음은 거절", () => {
  assert.doesNotThrow(() => assertLibraryTeacher({ uid: "t", profile: { role: "teacher" } }));
  assert.doesNotThrow(() => assertLibraryTeacher({ uid: "a", roleClaim: "admin", profile: { role: "student" } }));
  assert.throws(() => assertLibraryTeacher({ uid: "s", profile: { role: "student" } }), (e) => e.status === 403);
  assert.throws(() => assertLibraryTeacher({ uid: "s", profile: {} }), (e) => e.status === 403);
  assert.throws(() => assertLibraryTeacher({ uid: "t", profile: { role: "teacher", suspended: true } }), (e) => e.status === 403);
  assert.throws(() => assertLibraryTeacher({ uid: "x", profile: null }), (e) => e.status === 401);
});

test("검색 성공 — 독서로에 보내는 요청 모양과 소장 · 자료 상태를 가른 결과", async () => {
  const calls = [];
  const fetchImpl = fakeUpstream({
    calls,
    search: json(searchBody([copy(), copy({ bookKey: "60000001", regNo: "0000016001", callNo: "813.6 한12ㅊ c.2" })])),
    states: { 54870299: json(stateBody("정리중")), 60000001: json(stateBody("대출중", { returnPlanDate: "2026-11-20" })) },
  });
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl });
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual([sent.searchKeyword, sent.searchType, sent.neisCode, sent.provCode, sent.display], ["채식", "TITLE", [LIBRARY.neisCode], "B10", 10]);
  assert.equal(calls[0].init.headers.Authorization, undefined);   // 로그인 토큰을 보내지 않음
  assert.equal(r.total, 2);
  assert.equal(r.books.length, 1);                                 // 같은 종(speciesKey)은 한 묶음
  const [a, b] = r.books[0].copies;
  assert.deepEqual([r.books[0].title, r.books[0].author, r.books[0].publisher], ["채식주의자", "한강 지음", "창비"]);
  assert.deepEqual([a.callNo, a.regNo, a.status, a.available, a.stateKnown], ["813.6 한12ㅊ", "0000015784", "정리중", false, true]);
  assert.deepEqual([b.status, b.available, b.returnPlanDate], ["대출중", false, "2026-11-20"]);
  assert.match(r.source.url, /SchoolSearchResult\?searchKeyword=%EC%B1%84%EC%8B%9D&searchType=TITLE&provCode=B10&neisCode=B100000556/);
});

test("'대출가능'만 대출 가능 — 소장 여부와 따로", () => {
  assert.equal(normalizeLibraryState(stateBody("대출가능")).available, true);
  assert.equal(normalizeLibraryState(stateBody("정리중")).available, false);
  assert.deepEqual(normalizeLibraryState({ status: "FAIL" }), { status: "", available: null, returnPlanDate: "", reservable: null, location: "", known: false });
});

test("검색 결과 없음 — 0권은 빈 결과(오류 아님)", async () => {
  const r = await searchSchoolLibrary({ keyword: "없는책" }, { fetchImpl: fakeUpstream({ search: json(searchBody([], 0)) }) });
  assert.deepEqual([r.total, r.books.length, r.hasMore], [0, 0, false]);
});

test("다른 학교 책은 싣지 않음", async () => {
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl: fakeUpstream({ search: json(searchBody([copy({ neisCode: "B100000001" })])) }) });
  assert.equal(r.books.length, 0);
});

test("외부 조회 실패는 오류 — 결코 '결과 없음'으로 바뀌지 않음", async () => {
  const cases = [
    [fakeUpstream({ search: json({}, 500) }), "library/upstream-status", 502],
    [fakeUpstream({ search: json({}, 429) }), "library/upstream-busy", 503],
    [fakeUpstream({ search: json({ status: "FAIL", data: null }) }), "library/invalid-response", 502],
    [fakeUpstream({ search: json({ status: "OK", data: { allTotalCount: 0 } }) }), "library/invalid-response", 502],
    [fakeUpstream({ search: { ok: true, status: 200, json: async () => { throw new SyntaxError("html"); } } }), "library/invalid-response", 502],
    [async () => { throw new TypeError("fetch failed"); }, "library/unreachable", 502],
  ];
  for (const [fetchImpl, code, status] of cases) {
    await assert.rejects(() => searchSchoolLibrary({ keyword: "채식" }, { fetchImpl }), (e) => e.code === code && e.status === status);
  }
});

test("연결이 한 번 끊기면 한 번 다시 묻는다", async () => {
  let n = 0;
  const fetchImpl = fakeUpstream({ search: () => { n += 1; if (n === 1) throw new TypeError("reset"); return json(searchBody([copy()])); } });
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl });
  assert.equal(n, 2);
  assert.equal(r.books.length, 1);
});

test("시간 초과 — 504", async () => {
  const fetchImpl = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  await assert.rejects(() => searchSchoolLibrary({ keyword: "채식" }, { fetchImpl, timeoutMs: 20 }), (e) => e.code === "library/timeout" && e.status === 504);
});

test("자료 상태만 실패하면 소장은 그대로, 그 권은 '상태 확인 실패'", async () => {
  const fetchImpl = fakeUpstream({ search: json(searchBody([copy()])), states: { 54870299: new TypeError("reset") } });
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl });
  const c = r.books[0].copies[0];
  assert.deepEqual([c.stateKnown, c.available, c.regNo], [false, null, "0000015784"]);
});

const req = (q, page) => ({ url: `http://x/api/library/search?q=${encodeURIComponent(q)}${page ? `&page=${page}` : ""}` });

test("처리기 — 학생(인증 거절)은 독서로에 닿지 않는다", async () => {
  let searched = 0;
  const handle = createLibrarySearchHandler({
    authorize: async () => { assertLibraryTeacher({ uid: "s", profile: { role: "student" } }); },
    search: async () => { searched += 1; return {}; },
  });
  const r = await handle(req("채식"));
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "library/forbidden");
  assert.equal(searched, 0);
});

test("처리기 — 교사 검색 · 같은 검색은 기억 · 교사마다 한도", async () => {
  let searched = 0;
  const handle = createLibrarySearchHandler({
    authorize: async () => "teacher-1",
    search: async ({ keyword }) => { searched += 1; return { keyword, page: 1, total: 1, books: [{ title: "채식주의자", copies: [] }] }; },
    userLimiter: createLibraryLimiter({ limit: 3 }),
  });
  assert.equal((await handle(req("채식"))).status, 200);
  const again = await handle(req(" 채식 "));
  assert.equal(again.body.cached, true);
  assert.equal(searched, 1);
  assert.equal((await handle(req(""))).body.code, "library/empty-query");
  assert.equal((await handle(req("소년"))).status, 200);
  const limited = await handle(req("봄"));
  assert.deepEqual([limited.status, limited.body.code], [429, "library/rate-limited"]);
});

test("처리기 — 외부 실패는 기억하지 않고 다시 누르면 다시 묻는다", async () => {
  let n = 0;
  const handle = createLibrarySearchHandler({
    authorize: async () => "t",
    search: async () => { n += 1; if (n === 1) { const e = new Error("x"); e.status = 502; e.code = "library/unreachable"; throw e; } return { books: [] }; },
  });
  assert.equal((await handle(req("채식"))).status, 502);
  assert.equal((await handle(req("채식"))).status, 200);
});

test("기억 · 한도의 만료", () => {
  const cache = createLibraryCache({ ttlMs: 10 });
  cache.set("a", 1, 0);
  assert.equal(cache.get("a", 5), 1);
  assert.equal(cache.get("a", 11), null);
  const allow = createLibraryLimiter({ limit: 1, windowMs: 10 });
  assert.equal(allow("u", 0), true);
  assert.equal(allow("u", 1), false);
  assert.equal(allow("u", 11), true);
});

test("원본 결과 주소는 독서로 · 이 학교로만", () => {
  const url = new URL(libraryResultUrl("소년"));
  assert.equal(url.origin, "https://read365.edunet.net");
  assert.equal(url.searchParams.get("neisCode"), "B100000556");
  assert.equal(url.searchParams.get("schoolName"), "한성여자고등학교");
});
