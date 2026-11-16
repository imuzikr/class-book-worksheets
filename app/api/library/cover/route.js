import { NextResponse } from "next/server";
import { handleLibraryCover } from "@/lib/server/libraryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

// '독서로 검색'(떠 있는 동그라미의 검색 창)의 표지 보완 — 독서로에 표지가 없는 책만, ISBN이 정확히 같은 카카오 판본의 표지.
// 검색과 같은 로그인 확인 — 로그인한 사용자 모두(학생 포함 · 비로그인 · 프로필 없음 401 · 사용 중지 403). 키는 서버에서만 씁니다.
export async function GET(request) {
  const { status, body } = await handleLibraryCover(request);
  return NextResponse.json(body, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
