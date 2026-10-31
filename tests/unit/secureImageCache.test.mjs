// 이미지 보안 3단계 — lib/secureImageCache.js (getBlob·URL 함수는 가짜)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSecureImageCache, createUserChangeWatcher, toStoragePath, errorReason, MAX_ENTRIES, MAX_BYTES,
} from "../../lib/secureImageCache.js";

function setup(opts = {}) {
  const fetched = [];
  const revoked = [];
  let n = 0;
  const sizes = opts.sizes || {};
  const cache = createSecureImageCache({
    fetchBlob: opts.fetchBlob || (async (p) => { fetched.push(p); return { size: sizes[p] ?? 100 }; }),
    createObjectURL: () => `blob:fake/${++n}`,
    revokeObjectURL: (u) => revoked.push(u),
    ...(opts.limits || {}),
  });
  return { cache, fetched, revoked };
}

test("기본 한도는 40장·30MB", () => {
  assert.equal(MAX_ENTRIES, 40);
  assert.equal(MAX_BYTES, 30 * 1024 * 1024);
});

test("경로 해석: storage: 접두어·맨 경로는 Storage, https·data·blob은 통과", () => {
  assert.equal(toStoragePath("storage:uploads/c/u/a.png"), "uploads/c/u/a.png");
  assert.equal(toStoragePath("uploads/c/u/a.png"), "uploads/c/u/a.png");
  assert.equal(toStoragePath("https://firebasestorage.googleapis.com/x"), null);
  assert.equal(toStoragePath("data:image/png;base64,AA"), null);
  assert.equal(toStoragePath("uploads/../x"), null);
  assert.equal(toStoragePath(""), null);
});

test("옛 다운로드 URL·data URL은 내려받지 않고 그대로 돌려줌", async () => {
  const { cache, fetched } = setup();
  const u = "https://firebasestorage.googleapis.com/v0/b/x/o/a?alt=media&token=t";
  assert.deepEqual(await cache.acquire(u), { status: "ready", url: u });
  assert.deepEqual(await cache.acquire("data:image/png;base64,AA"), { status: "ready", url: "data:image/png;base64,AA" });
  assert.equal(fetched.length, 0);
  assert.equal(cache.stats().entries, 0);
});

test("같은 경로 동시 요청은 getBlob 한 번", async () => {
  const { cache, fetched } = setup();
  const [a, b, c] = await Promise.all([
    cache.acquire("uploads/c/u/a.png"), cache.acquire("storage:uploads/c/u/a.png"), cache.acquire("uploads/c/u/a.png"),
  ]);
  assert.equal(fetched.length, 1);
  assert.equal(a.url, b.url);
  assert.equal(b.url, c.url);
  await cache.acquire("uploads/c/u/a.png");
  assert.equal(fetched.length, 1, "다시 볼 때도 캐시에서");
});

test("장수 한도: 넘치면 오래된 것부터 revoke", async () => {
  const { cache, revoked } = setup({ limits: { maxEntries: 3 } });
  const urls = [];
  for (const k of ["a", "b", "c"]) { const r = await cache.acquire(`p/${k}`); urls.push(r.url); cache.release(`p/${k}`); }
  await cache.acquire("p/a"); cache.release("p/a"); // a를 최근으로
  await cache.acquire("p/d"); cache.release("p/d");
  assert.deepEqual(revoked, [urls[1]], "가장 오래 안 본 b가 해제");
  assert.equal(cache.stats().entries, 3);
});

test("용량 한도: 합계가 넘치면 오래된 것부터 해제", async () => {
  const { cache, revoked } = setup({ limits: { maxBytes: 250 } });
  const a = await cache.acquire("p/a"); cache.release("p/a");
  await cache.acquire("p/b"); cache.release("p/b");
  await cache.acquire("p/c"); cache.release("p/c");
  assert.deepEqual(revoked, [a.url]);
  assert.equal(cache.stats().bytes, 200);
});

test("쓰는 화면이 있는 그림은 한도를 넘어도 지우지 않고, 화면이 닫히면 해제", async () => {
  const { cache, revoked } = setup({ limits: { maxEntries: 1 } });
  const a = await cache.acquire("p/a"); // 화면이 아직 씀
  const b = await cache.acquire("p/b");
  assert.deepEqual(revoked, []);
  assert.equal(cache.stats().entries, 2);
  cache.release("p/a"); // a 화면 닫힘
  assert.deepEqual(revoked, [a.url]);
  cache.release("p/b");
  assert.equal(cache.stats().entries, 1);
  assert.ok(!revoked.includes(b.url));
});

test("두 화면이 함께 쓰면 둘 다 닫혀야 해제 후보", async () => {
  const { cache, revoked } = setup({ limits: { maxEntries: 1 } });
  await cache.acquire("p/a"); await cache.acquire("p/a");
  await cache.acquire("p/b"); cache.release("p/b");
  cache.release("p/a");
  assert.equal(revoked.length, 1, "b만 해제");
  cache.release("p/a");
  cache.release("p/a"); // 넘친 release는 무시
  assert.equal(cache.stats().entries, 1);
});

test("로그아웃(clear)하면 전부 revoke하고 비움, 진행 중 결과도 버림", async () => {
  let resolveSlow;
  const { cache, revoked } = setup({
    fetchBlob: (p) => (p === "p/slow" ? new Promise((r) => { resolveSlow = r; }) : Promise.resolve({ size: 10 })),
  });
  const a = await cache.acquire("p/a");
  const b = await cache.acquire("p/b");
  const slow = cache.acquire("p/slow");
  await new Promise((r) => setImmediate(r));
  cache.clear();
  assert.deepEqual(revoked.sort(), [a.url, b.url].sort());
  assert.deepEqual(cache.stats(), { entries: 0, bytes: 0 });
  resolveSlow({ size: 10 });
  assert.equal((await slow).status, "error");
  assert.equal(cache.stats().entries, 0, "이전 사용자의 그림이 다시 들어오지 않음");
});

test("권한 거부·없음은 대체 표시 상태로, 실패는 기억하지 않음", async () => {
  let deny = true;
  const cache = createSecureImageCache({
    fetchBlob: async () => {
      if (deny) { const e = new Error("x"); e.code = "storage/unauthorized"; throw e; }
      return { size: 1 };
    },
    createObjectURL: () => "blob:ok",
    revokeObjectURL: () => {},
  });
  assert.deepEqual(await cache.acquire("p/a"), { status: "error", reason: "denied" });
  assert.equal(cache.stats().entries, 0);
  deny = false;
  assert.deepEqual(await cache.acquire("p/a"), { status: "ready", url: "blob:ok" });
  assert.deepEqual(await cache.acquire(""), { status: "error", reason: "invalid" });
  assert.equal(errorReason({ code: "storage/object-not-found" }), "missing");
  assert.equal(errorReason({ code: "secure-image/unconfigured" }), "unavailable");
  assert.equal(errorReason(new Error("net")), "error");
});

test("사용자 감시: 로그아웃·다른 사용자로 바뀔 때 비움, 같은 사용자 재확인은 그대로", () => {
  let n = 0;
  const w = createUserChangeWatcher(() => { n += 1; });
  w({ uid: "s1" }); assert.equal(n, 0);
  w({ uid: "s1" }); assert.equal(n, 0);
  w(null); assert.equal(n, 1);
  w({ uid: "s2" }); assert.equal(n, 2);
  w({ uid: "s3" }); assert.equal(n, 3);
});
