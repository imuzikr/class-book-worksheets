"use client";

// =============================================================
// 이미지 보안 3단계 — 앱 전체가 함께 쓰는 그림 캐시 하나 + React 훅
// -------------------------------------------------------------
// 셈은 lib/secureImageCache.js(시험됨)에 있고, 여기서는 Firebase getBlob과
// 브라우저 URL 함수를 이어 주고 로그인 상태를 지켜봅니다.
// 4단계부터 해시태그·마인드맵·방송 그림(SecureImage)과 서식 글 6곳(SecureHtml)이 씁니다.
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

// ── 서식 HTML 안의 그림 (이미지 보안 4단계) ─────────────────────
// 저장된 HTML에는 <img src="storage:uploads/…">가 들어 있습니다. 브라우저는
// 이 주소를 못 읽으므로, 그린 뒤 찾아서 권한을 확인하며 내려받아 채웁니다.
//  · 원래 경로는 data-storage-path에 남겨 둡니다 — sanitizeHtml·편집기 저장이
//    이 표시를 보고 blob: 주소 대신 경로 표식으로 되돌립니다.
//  · held 배열에 빌린 그림을 적어 두고, 화면이 닫힐 때 releaseSecureImages로 돌려줍니다.
const FAIL_TEXT = {
  denied: "볼 수 있는 권한이 없는 그림이에요",
  missing: "그림을 찾을 수 없어요",
};

export function hydrateSecureImages(root, held) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const c = getSecureImageCache();
  root.querySelectorAll('img[src^="storage:"]').forEach((img) => {
    const src = img.getAttribute("src");
    const path = src.slice("storage:".length);
    img.setAttribute("data-storage-path", path);
    img.removeAttribute("src"); // 깨진 그림 표시 대신 빈칸으로 기다립니다
    img.setAttribute("aria-busy", "true");
    held.push(src);
    c.acquire(src).then((r) => {
      if (img.getAttribute("data-storage-path") !== path) return;
      img.removeAttribute("aria-busy");
      if (r.status === "ready") {
        img.setAttribute("src", r.url);
      } else {
        img.setAttribute("data-secure-image-error", r.reason || "error");
        img.setAttribute("alt", FAIL_TEXT[r.reason] || "그림을 불러오지 못했어요");
      }
    });
  });
}

export function releaseSecureImages(held) {
  if (!cache) return;
  for (const src of held.splice(0)) cache.release(src);
}

// 편집기 내용 → 저장할 HTML: 채워 둔 blob: 주소를 경로 표식으로 되돌립니다.
export function serializeSecureHtml(root) {
  if (!root) return "";
  if (!root.querySelector || !root.querySelector("img[data-storage-path]")) return root.innerHTML;
  const copy = root.cloneNode(true);
  copy.querySelectorAll("img[data-storage-path]").forEach((img) => {
    img.setAttribute("src", `storage:${img.getAttribute("data-storage-path")}`);
    img.removeAttribute("data-storage-path");
    img.removeAttribute("aria-busy");
    img.removeAttribute("data-secure-image-error");
  });
  return copy.innerHTML;
}

// dangerouslySetInnerHTML로 그린 상자(ref) 안의 그림을 채웁니다.
export function useSecureHtml(containerRef, html) {
  useEffect(() => {
    const held = [];
    hydrateSecureImages(containerRef.current, held);
    return () => releaseSecureImages(held);
  }, [containerRef, html]);
}
