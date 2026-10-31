// =============================================================
// 이미지 보안 3단계 — 그림 메모리 캐시(순수 로직, Firebase 없음)
// -------------------------------------------------------------
// Storage 경로를 받아 Blob으로 내려받고 object URL(blob:…)로 바꿔 줍니다.
//  · 최대 40장·합계 30MB(LRU). 넘치면 '지금 아무 화면도 안 쓰는' 그림부터
//    오래된 순으로 URL.revokeObjectURL 하고 지웁니다.
//  · 화면마다 acquire/release로 사용 수를 셉니다. 쓰는 화면이 있는 그림은
//    지우지 않습니다(화면이 닫혀 0이 되면 지울 수 있는 후보가 됩니다).
//  · 같은 경로를 동시에 여러 번 요청해도 내려받기는 한 번만 합니다.
//  · clear()는 전부 비웁니다(로그아웃·사용자 바뀜 — 공용 크롬북 대비).
//  · 옛 다운로드 URL(https:)·data:·blob: 주소는 캐시 없이 그대로 돌려줍니다.
//  · 권한 거부/파일 없음은 조용히 사라지지 않고 { status: "error", reason }.
// Firebase·브라우저 함수는 밖에서 넣어 줍니다(lib/secureImage.js) — 시험 가능.
// =============================================================

export const MAX_ENTRIES = 40;
export const MAX_BYTES = 30 * 1024 * 1024;

const PASS_RE = /^(https?:|data:|blob:)/i;

// "storage:uploads/c/u/a.png" 또는 "uploads/c/u/a.png" → Storage 경로. 아니면 null.
export function toStoragePath(src) {
  if (typeof src !== "string") return null;
  const s = src.trim();
  if (!s || PASS_RE.test(s)) return null;
  const p = s.startsWith("storage:") ? s.slice("storage:".length) : s;
  const clean = p.replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return null;
  return clean;
}

export function isPassthroughSrc(src) {
  return typeof src === "string" && PASS_RE.test(src.trim());
}

// Firebase Storage 오류 코드 → 화면이 고를 대체 표시 종류
export function errorReason(err) {
  const code = (err && err.code) || "";
  if (code === "storage/unauthorized" || code === "storage/unauthenticated") return "denied";
  if (code === "storage/object-not-found") return "missing";
  if (code === "secure-image/unconfigured") return "unavailable";
  return "error";
}

export function createSecureImageCache({
  fetchBlob,
  createObjectURL,
  revokeObjectURL,
  maxEntries = MAX_ENTRIES,
  maxBytes = MAX_BYTES,
} = {}) {
  // path → { url, size, refs, promise, ready }  (Map 순서 = 최근 사용 순)
  const entries = new Map();
  let totalBytes = 0;
  let generation = 0;

  function touch(path, e) {
    entries.delete(path);
    entries.set(path, e);
  }

  function drop(path, e) {
    entries.delete(path);
    if (e.ready) {
      totalBytes -= e.size;
      try { revokeObjectURL(e.url); } catch { /* 이미 해제됨 */ }
    }
  }

  function evict() {
    for (const [path, e] of entries) {
      if (entries.size <= maxEntries && totalBytes <= maxBytes) return;
      if (e.ready && e.refs === 0) drop(path, e);
    }
  }

  function load(path) {
    const gen = generation;
    const e = { url: null, size: 0, refs: 0, ready: false, promise: null };
    e.promise = Promise.resolve()
      .then(() => fetchBlob(path))
      .then(
        (blob) => {
          // 내려받는 사이 로그아웃(clear)됐거나 지워졌으면 결과를 버립니다
          if (gen !== generation || entries.get(path) !== e) {
            return { status: "error", reason: "cancelled" };
          }
          e.url = createObjectURL(blob);
          e.size = (blob && blob.size) || 0;
          e.ready = true;
          totalBytes += e.size;
          evict();
          return { status: "ready", url: e.url };
        },
        (err) => {
          // 실패는 기억하지 않습니다(권한이 생기면 다시 시도할 수 있게)
          if (entries.get(path) === e) entries.delete(path);
          return { status: "error", reason: errorReason(err) };
        },
      );
    entries.set(path, e);
    return e;
  }

  // 화면이 그림을 쓰기 시작할 때. 같은 화면은 끝날 때 release(src)를 꼭 부릅니다.
  function acquire(src) {
    if (isPassthroughSrc(src)) return Promise.resolve({ status: "ready", url: src.trim() });
    const path = toStoragePath(src);
    if (!path) return Promise.resolve({ status: "error", reason: "invalid" });
    let e = entries.get(path);
    if (e) touch(path, e);
    else e = load(path);
    e.refs += 1;
    return e.promise;
  }

  function release(src) {
    const path = toStoragePath(src);
    if (!path) return;
    const e = entries.get(path);
    if (!e || e.refs === 0) return;
    e.refs -= 1;
    if (e.refs === 0) evict();
  }

  function clear() {
    generation += 1;
    for (const [path, e] of [...entries]) drop(path, e);
    totalBytes = 0;
  }

  function stats() {
    return { entries: entries.size, bytes: totalBytes };
  }

  return { acquire, release, clear, stats };
}

// 로그아웃·사용자 바뀜 감지: 처음 확정된 사용자와 다른 값(없음 포함)이 오면 onChange.
export function createUserChangeWatcher(onChange) {
  let known = false;
  let lastUid = null;
  return (user) => {
    const uid = (user && user.uid) || null;
    if (known && uid !== lastUid) onChange();
    if (!uid && !known) onChange(); // 처음부터 로그아웃 상태여도 비워 둡니다
    known = true;
    lastUid = uid;
  };
}
