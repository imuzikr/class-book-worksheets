import { NextResponse } from "next/server";
import { handleLibrarySearch } from "@/lib/server/libraryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

// 교사 책 봄의 '학교 도서관 소장 검색'(한성여자고등학교 · 독서로) — 선생님 · 관리자만(학생은 로그인해도 403).
export async function GET(request) {
  const { status, body } = await handleLibrarySearch(request);
  return NextResponse.json(body, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
