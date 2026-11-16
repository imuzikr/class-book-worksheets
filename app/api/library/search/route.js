import { NextResponse } from "next/server";
import { handleLibrarySearch } from "@/lib/server/libraryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

// 떠 있는 동그라미의 '독서로 검색'(한성여자고등학교 도서관 · 독서로) — 로그인한 사용자 모두(학생 · 교사 · 관리자).
// 로그인하지 않았거나 프로필이 없으면 401, 사용 중지된 계정은 403(lib/server/libraryAuth.js).
export async function GET(request) {
  const { status, body } = await handleLibrarySearch(request);
  return NextResponse.json(body, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
