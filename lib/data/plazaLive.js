// =============================================================
// 책 광장의 실시간 — 함께 있는 친구들 (components/reading/ReadingPlaza.jsx가 부름)
// -------------------------------------------------------------
// joinPlazaLive(반, { uid, teacher }, handlers) → { publish(내 자리), close() }
//   handlers — current() 지금 내 자리 · onJoin(uid, 입장권, 자리, 소식의 나이 ms) · onWho(uid, 입장권) ·
//              onMove(uid, 자리) · onLeave(uid) · onStatus(상태, 까닭)   (lib/plazaLiveSession.js 머리말)
//
// 여기는 진짜 것을 이어 붙이는 자리입니다 — 언제 잇고 놓는지는 lib/plazaLiveSession.js, 통로는 lib/plazaLiveChannel.js,
// 자료의 모양 · 규칙은 lib/readingPlazaLive.js 머리말.
//   · 주소(NEXT_PUBLIC_FIREBASE_DATABASE_URL)가 없으면 아무것도 안 합니다 — 광장은 지금까지처럼 내 캐릭터만.
//   · 입장권은 서버(/api/reading/plaza의 enter)가 반 구성원인지 본 뒤 적어 줍니다.
//   · Realtime Database SDK는 광장에서 실시간을 실제로 쓸 때만 내려받습니다(책방 첫 화면 · 광장 탭 묶음에 넣지 않음).
//   · 데모(체험반)는 서버가 없어 가상 친구와 같은 브라우저의 다른 탭으로 흉내 냅니다(lib/data/plazaLiveDemo.js).
// =============================================================
import { app, isFirebaseConfigured } from "../firebase";
import { createPlazaLiveSession } from "../plazaLiveSession";
import { plazaLiveDatabaseUrl } from "../readingPlazaLive";
import { readingRequest } from "./reading";

// Next.js가 빌드할 때 이 글자 그대로를 값으로 바꿉니다(동적 키로 읽지 않음). 값을 넣거나 바꾼 뒤에는 다시 배포해야
// 화면에 닿습니다. 서버(lib/server/readingService.js)도 같은 변수를 읽습니다.
const DATABASE_URL = plazaLiveDatabaseUrl(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
const NOOP = Object.freeze({ publish() {}, close() {} });

/** 이 배포에서 광장의 실시간을 쓰는가 — 데모는 늘(가상 친구), 실서비스는 주소를 넣었을 때. */
export function plazaLiveConfigured() {
  return !isFirebaseConfigured || (!!DATABASE_URL && !!app);
}

// ── 연결(이 탭에 하나) ───────────────────────────────────────
// 광장을 나갔다 곧바로 다시 들어오면(반 바꾸기 · 개발 모드의 두 번 마운트) 앞 화면의 '나감' 표시가 서버에 닿는 사이
// 새 화면이 이미 이어 쓰고 있습니다 — 쓰는 화면 수를 세어, 0이 될 때만 연결을 놓습니다.
let modules = null;
let liveDb = null;
let holders = 0;

function loadLive() {
  modules ??= Promise.all([import("firebase/database"), import("../plazaLiveChannel")]).then(([database, channel]) => {
    // 웹소켓으로만 잇습니다 — 긴 폴링은 보안 헤더(CSP)가 허용하지 않는 주소 · 방식을 씁니다. 웹소켓이 막힌 망에서는
    // 실시간만 조용히 빠지고 광장은 그대로 씁니다.
    database.forceWebSockets();
    return { database, openPlazaChannel: channel.openPlazaChannel };
  }).catch((error) => { modules = null; throw error; });
  return modules;
}
async function connect() {
  const { database, openPlazaChannel } = await loadLive();
  liveDb ??= database.getDatabase(app, DATABASE_URL);
  holders += 1;
  if (holders === 1) database.goOnline(liveDb);
  let released = false;
  return {
    open: (handlers) => openPlazaChannel(liveDb, handlers),
    release() {
      if (released) return;
      released = true;
      holders = Math.max(0, holders - 1);
      if (!holders) database.goOffline(liveDb);
    },
  };
}

// 이 화면을 쓰고 있는가 — 누르기 · 움직이기 · 자판 · 굴리기를 '쓰는 중'으로 봅니다(창을 열어 글을 읽는 동안도 포함)
const INPUTS = ["pointerdown", "pointermove", "keydown", "wheel"];
const browserPage = {
  hidden: () => document.hidden,
  watch(onInput, onVisibility) {
    const options = { capture: true, passive: true };
    INPUTS.forEach((type) => window.addEventListener(type, onInput, options));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      INPUTS.forEach((type) => window.removeEventListener(type, onInput, options));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  },
};

// 데모 — 가상 친구 · 다른 탭(그 파일은 데모에서만 내려받습니다)
function demoSession(classId, me, handlers) {
  let closed = false;
  let inner = null;
  import("./plazaLiveDemo").then((demo) => {
    if (closed) return;
    inner = demo.openDemoPlazaLive(classId, me, handlers);
    const now = handlers.current?.();
    if (now) inner.publish(now);
  }).catch(() => { if (!closed) handlers.onStatus?.("off", "server"); });
  return {
    publish(next) { inner?.publish(next); },
    close() { closed = true; inner?.close(); inner = null; },
  };
}

export function joinPlazaLive(classId, me, handlers = {}) {
  if (!classId || !me?.uid || typeof window === "undefined") return NOOP;
  if (!isFirebaseConfigured) return demoSession(classId, me, handlers);
  if (!DATABASE_URL || !app) return NOOP;
  return createPlazaLiveSession({
    classId, me, handlers, connect, page: browserPage,
    enter: () => readingRequest("/api/reading/plaza", { method: "POST", body: JSON.stringify({ classId, action: "enter" }) }),
  });
}
