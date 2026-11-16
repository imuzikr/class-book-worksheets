// 독서로 검색(학교 도서관 소장 검색)의 로그인 확인 — route(GET /api/library/search · /api/library/cover)가 쓰는 처리기 그대로
// (handleLibrarySearch · 표지 보완 handleLibraryCover)를
// Auth · Firestore 에뮬레이터의 진짜 ID 토큰으로 부릅니다. 로그인한 사용자 모두(학생 · 교사 · 관리자)가 검색하고,
// 익명 · 토큰 없음 · 프로필 없음 · 사용 중지는 독서로에 닿기 전에 거절되어야 합니다(global fetch를 지켜봄). 독서로 대신 가짜 응답을 받습니다.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { handleLibraryCover, handleLibrarySearch } from "../../lib/server/libraryAuth.js";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "demo-reading-api";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !projectId.startsWith("demo-")) {
  throw new Error("Use both emulators and a demo- project; production execution is forbidden.");
}
const app = initializeApp({ projectId }, "library-api-test-seed");
const db = getFirestore(app);
const realFetch = globalThis.fetch;
let upstream = [];
const tokens = {};

async function signUp(body) {
  const response = await realFetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, returnSecureToken: true }),
  });
  assert.equal(response.ok, true);
  return response.json();
}
const call = async (token, q = "채식") => {
  const { status, body } = await handleLibrarySearch(new Request(`http://test/api/library/search?q=${encodeURIComponent(q)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {}));
  return { status, json: async () => body };
};

before(async () => {
  for (const [kind, role] of [["teacher", "teacher"], ["admin", "admin"], ["student", "student"], ["suspendedTeacher", "teacher"], ["suspendedStudent", "student"]]) {
    const who = await signUp({ email: `library-${kind}-${Date.now()}@example.com`, password: "valid-test-password" });
    await db.doc(`users/${who.localId}`).set({ role, realName: kind, ...(kind.startsWith("suspended") ? { suspended: true } : {}) });
    tokens[kind] = who.idToken;
  }
  tokens.anonymous = (await signUp({})).idToken;
  // 앱에 가입하지 않은 계정 — 토큰은 진짜지만 users/{uid} 프로필이 없음
  tokens.noProfile = (await signUp({ email: `library-noprofile-${Date.now()}@example.com`, password: "valid-test-password" })).idToken;
  // 독서로 대신 — 에뮬레이터로 가는 요청은 그대로, read365로 가는 요청만 기록하고 가짜로 답함
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    if (href.startsWith("https://dapi.kakao.com/")) { upstream.push(href); return new Response("{}", { status: 500 }); }
    if (!href.startsWith("https://read365.edunet.net/")) return realFetch(url, init);
    upstream.push(href);
    const body = href.endsWith("/alpasq/api/search")
      ? { status: "OK", data: { allTotalCount: 1, bookList: [{ bookKey: "1", speciesKey: "s1", neisCode: "B100000556", title: "채식주의자", author: "한강 지음", publisher: "창비", regNo: "0000015784", callNo: "813.6 한12ㅊ" }] } }
      : { status: "OK", data: { status: "대출가능" } };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
});
after(async () => { globalThis.fetch = realFetch; await deleteApp(app); });

test("토큰 없음 · 익명 · 프로필 없음 · 사용 중지(교사 · 학생)는 거절되고 독서로에 닿지 않는다", async () => {
  upstream = [];
  for (const [token, status] of [[null, 401], [tokens.anonymous, 401], ["not-a-token", 401], [tokens.noProfile, 401], [tokens.suspendedTeacher, 403], [tokens.suspendedStudent, 403]]) {
    const response = await call(token);
    assert.equal(response.status, status, `token ${String(token).slice(0, 12)}`);
    const body = await response.json();
    assert.equal(Array.isArray(body.books), false);
  }
  assert.deepEqual(upstream, []);
});

test("사용 중지된 학생이 빈 검색어 · 긴 검색어로 불러도 입력 오류가 아니라 권한 거절", async () => {
  assert.equal((await call(tokens.suspendedStudent, "")).status, 403);
  assert.equal((await call(tokens.suspendedStudent, "가".repeat(80))).status, 403);
});

test("학생도 검색 결과를 받는다(선생님 요청 — 떠 있는 동그라미의 '독서로 검색') · 빈 검색어는 입력 오류", async () => {
  upstream = [];
  const response = await call(tokens.student, "주의자");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.books[0].copies[0].status, "대출가능");
  assert.equal(upstream.length, 2);
  assert.equal((await call(tokens.student, "")).status, 400);
  assert.equal((await call(tokens.student, "가".repeat(80))).status, 400);
});

test("교사 · 관리자는 검색 결과를 받는다(소장 · 자료 상태)", async () => {
  upstream = [];
  const response = await call(tokens.teacher);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.books[0].copies[0].status, "대출가능");
  assert.equal(body.books[0].copies[0].callNo, "813.6 한12ㅊ");
  assert.equal(upstream.length, 2);
  const admin = await call(tokens.admin, "소년");
  assert.equal(admin.status, 200);
  assert.equal((await call(tokens.teacher, "")).status, 400);
});

const cover = async (token, isbn = "9788936433598") => handleLibraryCover(new Request(`http://test/api/library/cover?isbn=${encodeURIComponent(isbn)}`,
  token ? { headers: { Authorization: `Bearer ${token}` } } : {}));

test("표지 보완 — 토큰 없음 · 익명 · 프로필 없음 · 사용 중지(교사 · 학생)는 거절, 카카오에 닿지 않음", async () => {
  upstream = [];
  for (const [token, status] of [[null, 401], [tokens.anonymous, 401], ["not-a-token", 401], [tokens.noProfile, 401], [tokens.suspendedTeacher, 403], [tokens.suspendedStudent, 403]]) {
    const r = await cover(token);
    assert.equal(r.status, status, `token ${String(token).slice(0, 12)}`);
    assert.equal(r.body.cover, undefined);
  }
  assert.equal((await cover(tokens.suspendedStudent, "abc")).status, 403);   // 입력 오류보다 권한 거절이 먼저
  assert.deepEqual(upstream, []);
});

test("표지 보완 — 학생 · 교사 · 관리자는 받는다(검색 창이 모든 사용자 · 키가 없으면 묻지 않고 기본 표지 · 틀린 ISBN 400)", async () => {
  const saved = process.env.KAKAO_REST_API_KEY;
  delete process.env.KAKAO_REST_API_KEY;
  upstream = [];
  try {
    const r = await cover(tokens.teacher);
    assert.deepEqual([r.status, r.body.cover, r.body.reason], [200, "", "not-configured"]);
    const s = await cover(tokens.student, "9788932028705");
    assert.deepEqual([s.status, s.body.cover, s.body.reason], [200, "", "not-configured"]);
    assert.equal((await cover(tokens.admin, "8936433598")).status, 200);
    assert.equal((await cover(tokens.teacher, "123")).status, 400);
    assert.equal((await cover(tokens.student, "abc")).status, 400);
    assert.deepEqual(upstream, []);
  } finally { if (saved !== undefined) process.env.KAKAO_REST_API_KEY = saved; }
});

test("표지 보완 — 키가 있어도 카카오 실패는 502(화면은 기본 표지), 소장 검색과 무관", async () => {
  process.env.KAKAO_REST_API_KEY = "test-key";
  upstream = [];
  try {
    const r = await cover(tokens.teacher, "9788932028705");
    assert.deepEqual([r.status, r.body.code], [502, "library/cover-unavailable"]);
    assert.equal(upstream.length, 1);
    assert.equal((await call(tokens.teacher, "봄")).status, 200);
  } finally { delete process.env.KAKAO_REST_API_KEY; }
});
