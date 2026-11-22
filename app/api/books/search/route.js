import { NextResponse } from "next/server";
import { BookSearchError, bookSearchFailure, bookSearchConfigured, createBookSearchLimiter, parseBookSearch, searchBooks } from "@/lib/server/bookSearch";
import { authorizeLibraryUser } from "@/lib/server/libraryAuth";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const allowSearch = createBookSearchLimiter();

// 공개된 서지 정보만 돌려줍니다. 그래도 로그인한 사용자만 부릅니다(아래).
export async function GET(request) {
  try {
    const { query, start } = parseBookSearch(request.nextUrl.searchParams.get("q"), request.nextUrl.searchParams.get("start") ?? 1);
    // Do not consume provider quota or local rate slots while keys are absent.
    if (bookSearchConfigured()) {
      // 로그인한 사용자만(보안 점검 · 2026년 11월) — 한때 로그인 없이도 불러, 누구나 카카오 검색 사용량을 쓸 수 있었습니다.
      // 독서로 검색과 같은 확인(토큰 → 프로필 · 사용 중지는 거절)이고, 횟수 제한도 접속 주소가 아니라 사람마다 셉니다.
      const client = await authorizeLibraryUser(request);
      if (!allowSearch(client)) throw new BookSearchError("검색 요청이 많아요. 1분 후 다시 검색해 주세요.", 429, "book-search/rate-limited");
    }
    return NextResponse.json(await searchBooks({ query, start }), { headers });
  } catch (error) {
    if (error instanceof ReadingHttpError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    const failure = bookSearchFailure(error);
    return NextResponse.json(failure.body, { status: failure.status,
      headers: { ...headers, ...(failure.status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
