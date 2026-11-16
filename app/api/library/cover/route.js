import { NextResponse } from "next/server";
import { handleLibraryCover } from "@/lib/server/libraryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

// 교사 책 봄 '학교 도서관 소장 검색'의 표지 보완 — 독서로에 표지가 없는 책만, ISBN이 정확히 같은 카카오 판본의 표지.
// 선생님 · 관리자만(학생은 로그인해도 403 · 비로그인 401). 키는 서버에서만 씁니다.
export async function GET(request) {
  const { status, body } = await handleLibraryCover(request);
  return NextResponse.json(body, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
