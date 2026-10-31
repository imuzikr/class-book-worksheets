"use client";

// =============================================================
// 이미지 보안 3단계 — 앱 전체가 함께 쓰는 그림 캐시 하나 + React 훅
// -------------------------------------------------------------
// 셈은 lib/secureImageCache.js(시험됨)에 있고, 여기서는 Firebase getBlob과
// 브라우저 URL 함수를 이어 주고 로그인 상태를 지켜봅니다.
// 아직 어떤 화면에도 연결하지 않았습니다(4단계에서 연결).
//
//   const img = useSecureImage(src);
//   // img.status: "idle" | "loading" | "ready" | "error"
//   // img.url   : <img src>에 넣을 주소(ready일 때)
//   // img.reason: "denied" | "missing" | "unavailable" | "invalid" | "error"
// =============================================================
import { useEffect, useState } from "react";
import { ref, getBlob } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth, storage, isFirebaseConfigured } from "./firebase";
import { createSecureImageCache, createUserChangeWatcher } from "./secureImageCache";

let cache = null;

export function getSecureImageCache() {
  if (cache) return cache;
  cache = createSecureImageCache({
    fetchBlob: async (path) => {
      if (!isFirebaseConfigured || !storage) {
        const err = new Error("Storage가 설정되지 않았습니다");
        err.code = "secure-image/unconfigured";
        throw err;
      }
      return getBlob(ref(storage, path));
    },
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  });
  // 로그아웃하거나 다른 학생으로 바뀌면 기억해 둔 그림을 전부 비웁니다
  if (typeof window !== "undefined" && isFirebaseConfigured && auth) {
    onAuthStateChanged(auth, createUserChangeWatcher(() => cache.clear()));
  }
  return cache;
}

export function clearSecureImageCache() {
  if (cache) cache.clear();
}

export function useSecureImage(src) {
  const [state, setState] = useState({ status: src ? "loading" : "idle", url: null, reason: null });
  useEffect(() => {
    if (!src) {
      setState({ status: "idle", url: null, reason: null });
      return undefined;
    }
    let alive = true;
    const c = getSecureImageCache();
    setState({ status: "loading", url: null, reason: null });
    c.acquire(src).then((r) => {
      if (!alive) return;
      setState(r.status === "ready"
        ? { status: "ready", url: r.url, reason: null }
        : { status: "error", url: null, reason: r.reason });
    });
    // 화면이 닫히거나 src가 바뀌면 이 화면의 사용 표시를 돌려줍니다
    return () => {
      alive = false;
      c.release(src);
    };
  }, [src]);
  return state;
}
