import { NextResponse } from "next/server";
import { getReadingTop, readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";

// 상단바 '독서 TOP 3' — 서울 시각 월요일 07:00에 한 주가 바뀌고, 그 주 내내 같은 셋입니다
// (lib/server/readingService.js의 getReadingTop).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request) {
  try {
    const principal = await readingPrincipal(request);
    return NextResponse.json(await getReadingTop(principal, request.nextUrl.searchParams.get("classId")), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
