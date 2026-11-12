// 책 광장의 실시간 자료를 서버가 읽고 쓰는 길(REST — lib/server/plazaLiveStore.js).
// 진짜 Realtime Database(에뮬레이터)와의 왕복은 tests/server/plazaLive.test.mjs가 봅니다. 여기서는 운영에서 쓰는 갈래 —
// 어느 주소로 · 어떤 토큰으로 보내는지, 토큰을 기억해 두는지 — 를 가짜 fetch로 봅니다.
import test from "node:test";
import assert from "node:assert/strict";
import { plazaLiveStore } from "../../lib/server/plazaLiveStore.js";

const URL_SG = "https://bookbom-default-rtdb.asia-southeast1.firebasedatabase.app";

function withFetch(reply, run) {
  const calls = [];
  const savedFetch = globalThis.fetch;
  const savedHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method, auth: options.headers?.Authorization, type: options.headers?.["Content-Type"], body: options.body, cache: options.cache, timed: !!options.signal });
    const { status = 200, json = null } = reply(calls.length) ?? {};
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return Promise.resolve(run(calls)).finally(() => {
    globalThis.fetch = savedFetch;
    if (savedHost === undefined) delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    else process.env.FIREBASE_DATABASE_EMULATOR_HOST = savedHost;
  });
}
function fakeApp(expiresIn = 3600) {
  const app = { minted: 0, options: { credential: { getAccessToken: async () => { app.minted += 1; return { access_token: `token-${app.minted}`, expires_in: expiresIn }; } } } };
  return app;
}

test("운영 — 데이터베이스 주소로, 관리자 토큰을 실어 보낸다(토큰은 기억해 둠)", () => withFetch((n) => ({ json: n === 1 ? { who: { a: { exp: 1 } } } : {} }), async (calls) => {
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const app = fakeApp();
  const store = plazaLiveStore(app, URL_SG, "class-1");
  assert.deepEqual(await store.read(), { who: { a: { exp: 1 } } });
  await store.update({ "who/u1": { n: "가", exp: 5 }, "pos/old": null });
  await store.remove();
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [
    ["GET", `${URL_SG}/plaza/class-1.json`], ["PATCH", `${URL_SG}/plaza/class-1.json`], ["DELETE", `${URL_SG}/plaza/class-1.json`],
  ]);
  assert.deepEqual(calls.map((c) => c.auth), ["Bearer token-1", "Bearer token-1", "Bearer token-1"]);
  assert.equal(app.minted, 1, "세 번을 불러도 토큰은 한 번만 받는다");
  // 여러 자리를 한 번에 — 지울 자리는 null
  assert.deepEqual(JSON.parse(calls[1].body), { "who/u1": { n: "가", exp: 5 }, "pos/old": null });
  assert.equal(calls[1].type, "application/json");
  assert.equal(calls[0].body, undefined);
  // 기억해 두지 않고(캐시 없이), 느린 응답은 끊는다
  assert.ok(calls.every((c) => c.cache === "no-store" && c.timed));
  // 다른 반은 다른 자리
  await plazaLiveStore(app, URL_SG, "class-2").read();
  assert.equal(calls.at(-1).url, `${URL_SG}/plaza/class-2.json`);
}));

test("운영 — 거절(401)된 토큰은 버리고 다음에 새로 받는다 · 곧 만료될 토큰은 다시 쓰지 않는다", () => withFetch((n) => (n === 2 ? { status: 401 } : { json: {} }), async (calls) => {
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const app = fakeApp();
  const store = plazaLiveStore(app, URL_SG, "class-1");
  await store.read();
  await assert.rejects(() => store.read(), (e) => e.code === "database/http-401");
  await store.read();
  assert.deepEqual(calls.map((c) => c.auth), ["Bearer token-1", "Bearer token-1", "Bearer token-2"]);
  // 만료가 1분도 안 남은 토큰은 기억해 두지 않는다(부를 때마다 새로)
  const brief = fakeApp(60);
  const hurried = plazaLiveStore(brief, URL_SG, "class-1");
  await hurried.read();
  await hurried.read();
  assert.equal(brief.minted, 2);
}));

test("운영 — 서버가 못 받으면 오류로 알리고(부르는 쪽이 실시간만 끔), 열쇠가 없으면 보내지 않는다", () => withFetch(() => ({ status: 503 }), async (calls) => {
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  await assert.rejects(() => plazaLiveStore(fakeApp(), URL_SG, "class-1").update({ "who/a": null }), (e) => e.code === "database/http-503");
  calls.length = 0;
  await assert.rejects(() => plazaLiveStore({ options: {} }, URL_SG, "class-1").read(), (e) => e.code === "database/no-credential");
  await assert.rejects(() => plazaLiveStore({ options: { credential: { getAccessToken: async () => ({}) } } }, URL_SG, "class-1").read(), (e) => e.code === "database/no-token");
  assert.equal(calls.length, 0, "토큰이 없으면 요청을 보내지 않는다");
}));

test("에뮬레이터 — 그 주소로 보내고 데이터베이스는 이름(ns)으로 가린다 · 토큰은 받지 않는다", () => withFetch(() => ({ json: null }), async (calls) => {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9111";
  const app = fakeApp();
  assert.equal(await plazaLiveStore(app, URL_SG, "class-1").read(), null);
  assert.deepEqual([calls[0].url, calls[0].auth], ["http://127.0.0.1:9111/plaza/class-1.json?ns=bookbom-default-rtdb", "Bearer owner"]);
  assert.equal(app.minted, 0);
}));
