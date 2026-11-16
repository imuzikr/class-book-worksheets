// 학교 도서관 소장 검색의 로그인 확인 — 책 봄 API와 같은 길(Firebase ID 토큰 검증 → users/{uid}의 역할).
// 선생님 · 관리자만 통과하고, 학생 · 익명 · 토큰 없음은 독서로에 묻기 전에 거절합니다.
import { readingPrincipal } from "./readingService.js";
import { assertLibraryTeacher, createLibrarySearchHandler } from "./schoolLibrary.js";

export async function authorizeLibraryTeacher(request) {
  const principal = await readingPrincipal(request);
  const snap = await principal.db.doc(`users/${principal.uid}`).get();
  assertLibraryTeacher({ uid: principal.uid, roleClaim: principal.roleClaim, profile: snap.exists ? snap.data() : null });
  return principal.uid;
}

// route(app/api/library/search)가 그대로 쓰는 처리기 — 서버 시험(tests/server/library.test.mjs)도 같은 것을 부릅니다.
// 교사마다 1분에 20번 · 서버 전체 1분에 120번 · 같은 검색은 5분 기억(lib/server/schoolLibrary.js).
export const handleLibrarySearch = createLibrarySearchHandler({ authorize: authorizeLibraryTeacher });
