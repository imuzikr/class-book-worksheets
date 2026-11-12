// =============================================================
// 책 광장의 실시간 자료(Realtime Database) — 서버가 읽고 쓰는 길 (REST)
// -------------------------------------------------------------
// 서버는 Realtime Database를 **REST로만** 읽고 씁니다(입장할 때 한 번 읽고 한 번 씀 — lib/server/readingService.js).
//
// 관리자 SDK의 데이터베이스 클라이언트(firebase-admin/database)를 쓰지 않는 까닭: 그 클라이언트는 연결(웹소켓)을 열어
// 둡니다. 서버 인스턴스마다 하나씩이라 한 반이 한꺼번에 들어오면 수십 개가 잠깐 열리고, 그것도 무료 요금제의
// **동시 연결 100개**에 듭니다 — 학생들이 이을 자리를 서버가 먹습니다. REST 요청은 동시 연결로 세지 않습니다
// (Firebase 문서: Connections는 WebSocket · long polling · server-sent events만 셈 — "It does not include RESTful requests").
//
//   · 인증 — 관리자 열쇠(서비스 계정)로 받은 OAuth 토큰. 규칙을 거치지 않습니다(관리자). 토큰은 만료 전까지 기억해 둡니다.
//   · 에뮬레이터(FIREBASE_DATABASE_EMULATOR_HOST)에서는 그 주소로 보내고 토큰은 'owner'(에뮬레이터의 관리자).
//   · 느린 응답은 6초에 끊습니다 — 광장에 들어오는 요청이 여기에 매달리지 않게(못 적으면 실시간만 빠짐).
// =============================================================
const TIMEOUT_MS = 6000;
// 한 서버 인스턴스가 기억해 두는 토큰 { token, until(ms) } — 앱(열쇠)마다 하나
const tokens = new WeakMap();

async function accessToken(app) {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) return "owner";
  const now = Date.now();
  const kept = tokens.get(app);
  if (kept && kept.until > now + 60 * 1000) return kept.token;
  const credential = app?.options?.credential;
  if (typeof credential?.getAccessToken !== "function") throw Object.assign(new Error("관리자 열쇠가 없습니다."), { code: "database/no-credential" });
  const got = await credential.getAccessToken();
  if (!got?.access_token) throw Object.assign(new Error("관리자 토큰을 받지 못했습니다."), { code: "database/no-token" });
  tokens.set(app, { token: got.access_token, until: now + Math.max(60, Number(got.expires_in) || 300) * 1000 });
  return got.access_token;
}

/** 그 반의 실시간 자료(plaza/{반}) — read() 통째로 읽기 · update({ "who/uid": 값 | null, … }) 여러 자리를 한 번에 · remove() 통째로 지우기.
 *  app은 관리자 앱, databaseUrl은 확인을 거친 주소(lib/readingPlazaLive.js의 plazaLiveDatabaseUrl), classId는 확인을 거친 반 id. */
export function plazaLiveStore(app, databaseUrl, classId) {
  const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  // 에뮬레이터는 주소 대신 이름(ns)으로 데이터베이스를 가립니다 — 주소의 첫 마디가 그 이름
  const target = emulator
    ? `http://${emulator}/plaza/${encodeURIComponent(classId)}.json?ns=${encodeURIComponent(new URL(databaseUrl).hostname.split(".")[0])}`
    : `${databaseUrl}/plaza/${encodeURIComponent(classId)}.json`;
  async function call(method, body) {
    const token = await accessToken(app);
    const response = await fetch(target, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      // 토큰이 거절됐으면 다음에는 새로 받습니다
      if (response.status === 401) tokens.delete(app);
      throw Object.assign(new Error(`Realtime Database ${method} ${response.status}`), { code: `database/http-${response.status}` });
    }
    return response.json();
  }
  return {
    read: () => call("GET"),
    update: (changes) => call("PATCH", changes),
    remove: () => call("DELETE"),
  };
}
