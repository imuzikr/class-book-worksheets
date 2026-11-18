// 떠 있는 동그라미의 '독서로 검색'(학교 도서관 소장 검색) — 서버(/api/library/search)가 로그인한 사용자인지 확인하고 독서로에 묻습니다.
// 체험반(Firebase 미설정)에는 로그인 토큰이 없어 서버가 거절합니다 — 화면은 그때 '원본 검색 결과 열기'를 안내합니다.
import { auth, isFirebaseConfigured } from "../firebase";

export class LibraryClientError extends Error {
  constructor(message, code = "library/failed", status = 0) {
    super(message);
    this.name = "LibraryClientError";
    this.code = code;
    this.status = status;
  }
}

export async function searchSchoolLibrary(keyword, { page = 1, signal } = {}) {
  const headers = {};
  const current = isFirebaseConfigured ? auth?.currentUser : null;
  if (current) headers.Authorization = `Bearer ${await current.getIdToken()}`;
  let response;
  try {
    response = await fetch(`/api/library/search?q=${encodeURIComponent(keyword)}&page=${page}`, { headers, cache: "no-store", signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new LibraryClientError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", "library/network");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body?.code || "library/failed";
    const message = !isFirebaseConfigured && (response.status === 401 || response.status === 503)
      ? "체험반에서는 자동 소장 확인을 쓸 수 없어요. ‘독서로에서 직접 보기’로 확인해 주세요."
      : body?.error || "소장 여부를 확인하지 못했어요.";
    throw new LibraryClientError(message, code, response.status);
  }
  if (!body || !Array.isArray(body.books)) throw new LibraryClientError("검색 결과를 읽지 못했어요.", "library/invalid-response");
  return body;
}

// 표지 보완 — 독서로에 표지가 없는 책만, ISBN-13으로 서버(/api/library/cover — 검색과 같은 로그인 확인 · 모든 사용자)에 묻습니다.
// 무엇이 실패해도 ""(기본 표지)를 돌려주고 던지지 않습니다 — 표지 때문에 소장 결과가 흔들리지 않게.
export async function fetchLibraryCover(isbn13, { signal } = {}) {
  if (!isbn13) return "";
  try {
    const headers = {};
    const current = isFirebaseConfigured ? auth?.currentUser : null;
    if (current) headers.Authorization = `Bearer ${await current.getIdToken()}`;
    const response = await fetch(`/api/library/cover?isbn=${encodeURIComponent(isbn13)}`, { headers, cache: "no-store", signal });
    if (!response.ok) return "";
    const body = await response.json().catch(() => null);
    return typeof body?.cover === "string" && /^https:\/\//.test(body.cover) ? body.cover : "";
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return "";
  }
}
