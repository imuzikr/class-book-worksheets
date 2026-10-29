import { NextResponse } from "next/server";
import { BookSearchError, bookSearchFailure, createBookSearchLimiter, naverSearchConfigured, parseBookSearch, searchNaverBooks } from "@/lib/server/naverBooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const allowSearch = createBookSearchLimiter();

// Only public bibliography is returned. Reading records, rewards and class
// settings remain protected by the separate authenticated reading API.
export async function GET(request) {
  try {
    const { query, start } = parseBookSearch(request.nextUrl.searchParams.get("q"), request.nextUrl.searchParams.get("start") ?? 1);
    // Do not consume provider quota or local rate slots while keys are absent.
    if (naverSearchConfigured()) {
      const client = (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 100);
      if (!allowSearch(client)) throw new BookSearchError("검색 요청이 많아요. 1분 후 다시 검색해 주세요.", 429, "book-search/rate-limited");
    }
    return NextResponse.json(await searchNaverBooks({ query, start }), { headers });
  } catch (error) {
    const failure = bookSearchFailure(error);
    return NextResponse.json(failure.body, { status: failure.status,
      headers: { ...headers, ...(failure.status === 429 ? { "Retry-After": "60" } : {}) } });
  }
}
