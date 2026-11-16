// 학교 도서관 소장 검색의 표지 — 독서로 coverUrl(2026-11-16 실측: 자료 상태 응답 · 알라딘 그림 서버) →
// 없으면 카카오 ISBN 정확 일치 → 기본 표지. 표지는 소장 · 자료 상태와 무관해야 합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isbn13Set, lookupKakaoCoverByIsbn, toIsbn13 } from "@/lib/server/bookSearch";
import {
  assertLibraryUser, createLibraryCache, createLibraryCoverHandler, createLibraryLimiter,
  libraryCoverUrl, normalizeLibraryState, searchSchoolLibrary,
} from "@/lib/server/schoolLibrary";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ALADIN = "https://image.aladin.co.kr/product/100/1/cover500/8936433598_2.jpg";

test("ISBN — 10 · 13자리, 붙임표 · 띄어쓰기 · 소문자 x, 검사 숫자", () => {
  assert.equal(toIsbn13("9788936433598"), "9788936433598");
  assert.equal(toIsbn13("978-89-364-3359-8"), "9788936433598");
  assert.equal(toIsbn13(" 8936433598 "), "9788936433598");          // ISBN-10 → 978
  assert.equal(toIsbn13("898273189x"), "9788982731891");             // 독서로 실제 값(소문자 x)
  assert.equal(toIsbn13("9788936433599"), "");                       // 검사 숫자 틀림
  assert.equal(toIsbn13("8936433597"), "");
  assert.equal(toIsbn13(""), "");
  assert.equal(toIsbn13("abc"), "");
  assert.deepEqual([...isbn13Set("8936433598 9788936433598")], ["9788936433598"]);
  assert.deepEqual([...isbn13Set(" 9788936433598")], ["9788936433598"]);
  assert.equal(isbn13Set("").size, 0);
});

test("독서로 표지 주소 — 알라딘 그림 서버의 https만", () => {
  assert.equal(libraryCoverUrl(ALADIN), ALADIN);
  assert.equal(libraryCoverUrl("http://image.aladin.co.kr/a.jpg"), "");
  assert.equal(libraryCoverUrl("https://evil.example/a.jpg"), "");
  assert.equal(libraryCoverUrl("https://image.aladin.co.kr.evil.example/a.jpg"), "");
  assert.equal(libraryCoverUrl("javascript:alert(1)"), "");
  assert.equal(libraryCoverUrl(""), "");
  assert.equal(normalizeLibraryState({ status: "OK", data: { status: "대출가능", coverUrl: ALADIN } }).cover, ALADIN);
});

const copy = (over = {}) => ({ bookKey: "1", speciesKey: "s1", neisCode: "B100000556", title: "채식주의자", author: "한강",
  publisher: "창비", isbn: "9788936433598", regNo: "0000015784", callNo: "813.6 한12ㅊ", coverUrl: "", ...over });
const upstream = (list, states) => async (url) => {
  if (url.endsWith("/alpasq/api/search")) return json({ status: "OK", data: { allTotalCount: list.length, bookList: list } });
  const key = new URL(url).searchParams.get("bookKey");
  const s = states[key];
  if (s instanceof Error) throw s;
  return json(s ?? { status: "OK", data: { status: "대출가능" } });
};

test("검색 결과 — 독서로 표지(자료 상태 응답)를 책마다 한 장, ISBN-13도 함께", async () => {
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl: upstream([copy()], { 1: { status: "OK", data: { status: "정리중", coverUrl: ALADIN } } }) });
  const [book] = r.books;
  assert.deepEqual([book.cover, book.coverSource, book.isbn13], [ALADIN, "read365", "9788936433598"]);
  assert.equal(book.copies[0].cover, undefined);          // 권마다 싣지 않음
  assert.equal(book.copies[0].status, "정리중");          // 소장 · 상태는 그대로
});

test("표지가 없거나 상태 조회가 실패해도 소장 결과는 그대로 · 표지는 빈 값", async () => {
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl: upstream(
    [copy(), copy({ bookKey: "2", speciesKey: "s2", title: "다른 책", isbn: "" , regNo: "2" })],
    { 1: { status: "OK", data: { status: "대출중", coverUrl: "" } }, 2: new TypeError("reset") }) });
  assert.deepEqual(r.books.map((b) => [b.title, b.cover, b.isbn13]), [["채식주의자", "", "9788936433598"], ["다른 책", "", ""]]);
  assert.equal(r.books[0].copies[0].status, "대출중");
  assert.equal(r.books[1].copies[0].stateKnown, false);
});

// ── 카카오 ISBN 정확 일치 ──
const kakao = (docs, status = 200) => async (url, init) => {
  assert.match(url, /^https:\/\/dapi\.kakao\.com\/v3\/search\/book\?/);
  assert.equal(new URL(url).searchParams.get("target"), "isbn");
  assert.match(init.headers.Authorization, /^KakaoAK /);
  return json({ documents: docs, meta: {} }, status);
};
const KCOVER = "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x";

test("카카오 — ISBN이 같은 판본의 표지만(10자리로만 적힌 것도), 다른 ISBN · 비공식 주소는 버림", async () => {
  const opt = (docs) => ({ apiKey: "k", fetchImpl: kakao(docs) });
  assert.deepEqual(await lookupKakaoCoverByIsbn("9788936433598", opt([{ isbn: "8936433598 9788936433598", thumbnail: KCOVER }])), { isbn: "9788936433598", cover: KCOVER });
  assert.equal((await lookupKakaoCoverByIsbn("9788936433598", opt([{ isbn: "8936433598", thumbnail: KCOVER }]))).cover, KCOVER);
  // 제목이 같아도 ISBN이 다르면 안 붙임
  assert.equal((await lookupKakaoCoverByIsbn("9788936433598", opt([{ title: "채식주의자", isbn: "9788936434595", thumbnail: KCOVER }]))).cover, "");
  assert.equal((await lookupKakaoCoverByIsbn("9788936433598", opt([{ isbn: "9788936433598", thumbnail: "https://evil.example/x.jpg" }]))).cover, "");
  assert.equal((await lookupKakaoCoverByIsbn("9788936433598", opt([{ isbn: "9788936433598", thumbnail: "" }]))).cover, "");
  assert.equal((await lookupKakaoCoverByIsbn("9788936433598", opt([]))).cover, "");
});

test("카카오 — 잘못된 ISBN · 키 없음 · 실패 · 시간 초과는 오류로", async () => {
  await assert.rejects(() => lookupKakaoCoverByIsbn("123", { apiKey: "k", fetchImpl: kakao([]) }), (e) => e.code === "book-search/invalid-isbn");
  await assert.rejects(() => lookupKakaoCoverByIsbn("9788936433598", { apiKey: "", fetchImpl: kakao([]) }), (e) => e.code === "book-search/not-configured");
  await assert.rejects(() => lookupKakaoCoverByIsbn("9788936433598", { apiKey: "k", fetchImpl: kakao([], 500) }), (e) => e.code === "book-search/upstream");
  await assert.rejects(() => lookupKakaoCoverByIsbn("9788936433598", { apiKey: "k", fetchImpl: async () => { throw new TypeError("x"); } }), (e) => e.code === "book-search/unavailable");
  const hang = (u, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("a"), { name: "AbortError" }))));
  await assert.rejects(() => lookupKakaoCoverByIsbn("9788936433598", { apiKey: "k", fetchImpl: hang, timeoutMs: 20 }), (e) => e.code === "book-search/timeout");
});

// ── 표지 보완 처리기(/api/library/cover) ──
const req = (isbn) => ({ url: `http://x/api/library/cover?isbn=${encodeURIComponent(isbn)}` });
const signedIn = async () => "u1";

// 독서로 검색은 로그인한 사용자 모두(학생 포함 — 선생님 요청 · 떠 있는 동그라미)라 표지 보완도 같은 확인입니다.
test("처리기 — 사용 중지 · 프로필 없음은 카카오에 닿기 전에 거절, 학생은 받음", async () => {
  let calls = 0;
  const as = (profile) => createLibraryCoverHandler({ authorize: async () => { assertLibraryUser({ uid: "s", profile }); return "s"; },
    configured: () => true, cache: createLibraryCache(), lookup: async () => { calls += 1; return { cover: KCOVER }; } });
  const suspended = await as({ role: "student", suspended: true })(req("9788936433598"));
  assert.deepEqual([suspended.status, suspended.body.code, calls], [403, "library/forbidden", 0]);
  const none = await as(null)(req("9788936433598"));
  assert.deepEqual([none.status, none.body.code, calls], [401, "library/unauthenticated", 0]);
  const student = await as({ role: "student" })(req("9788936433598"));
  assert.deepEqual([student.status, student.body.cover, calls], [200, KCOVER, 1]);
});

test("처리기 — 맞는 표지 · 맞는 표지 없음은 기억, 실패는 기억하지 않음", async () => {
  let calls = 0; let mode = "ok";
  const handle = createLibraryCoverHandler({ authorize: signedIn, configured: () => true,
    lookup: async () => { calls += 1; if (mode === "fail") { const e = new Error("x"); e.status = 502; throw e; } return { cover: mode === "ok" ? KCOVER : "" }; } });
  assert.deepEqual((await handle(req("978-89-364-3359-8"))).body, { isbn: "9788936433598", cover: KCOVER, source: "kakao" });
  assert.equal((await handle(req("8936433598"))).body.cached, true);    // 같은 책(ISBN-10)은 기억에서
  mode = "none";
  assert.deepEqual((await handle(req("9788932028705"))).body, { isbn: "9788932028705", cover: "", source: "none", reason: "no-match" });
  assert.equal((await handle(req("9788932028705"))).body.cached, true);
  mode = "fail";
  const f = await handle(req("9788954636025"));
  assert.deepEqual([f.status, f.body.code], [502, "library/cover-unavailable"]);
  mode = "ok";
  assert.equal((await handle(req("9788954636025"))).body.cover, KCOVER);   // 실패는 기억 안 함
  assert.equal(calls, 4);
});

test("처리기 — 틀린 ISBN 400 · 키 없으면 묻지 않고 '없음' · 사람마다 한도", async () => {
  let calls = 0;
  const off = createLibraryCoverHandler({ authorize: signedIn, configured: () => false, lookup: async () => { calls += 1; return { cover: KCOVER }; } });
  assert.equal((await off(req("abc"))).body.code, "library/invalid-isbn");
  assert.deepEqual((await off(req("9788936433598"))).body, { isbn: "9788936433598", cover: "", source: "none", reason: "not-configured" });
  assert.equal(calls, 0);
  const limited = createLibraryCoverHandler({ authorize: signedIn, configured: () => true, userLimiter: createLibraryLimiter({ limit: 1 }),
    cache: createLibraryCache(), lookup: async () => ({ cover: "" }) });
  assert.equal((await limited(req("9788936433598"))).status, 200);
  const r = await limited(req("9788932028705"));
  assert.deepEqual([r.status, r.body.code], [429, "library/cover-rate-limited"]);
});

test("검색 응답의 표지(coverYn Y)는 자료 상태 조회가 끊겨도 남는다 · 상태 응답의 표지가 있으면 그것이 먼저", async () => {
  const OTHER = "https://image.aladin.co.kr/product/1/1/cover500/other.jpg";
  let sent;
  const base = upstream([copy({ coverUrl: ALADIN }), copy({ bookKey: "2", speciesKey: "s2", regNo: "2", coverUrl: ALADIN })],
    { 1: new TypeError("reset"), 2: { status: "OK", data: { status: "대출가능", coverUrl: OTHER } } });
  const r = await searchSchoolLibrary({ keyword: "채식" }, { fetchImpl: async (url, init) => { if (init?.body) sent = JSON.parse(init.body); return base(url, init); } });
  assert.equal(sent.coverYn, "Y");
  assert.deepEqual(r.books.map((b) => b.cover), [ALADIN, OTHER]);
  assert.equal(r.books[0].copies[0].stateKnown, false);
});
