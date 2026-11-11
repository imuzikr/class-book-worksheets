import { NextResponse } from "next/server";
import { getReadingRankings, readingPrincipal, readingErrorResponse, resetReadingRankings } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

// 반 순위 — 10분에 한 번 셈해 저장하고 그대로 씁니다. 학생에게는 상위 10명과 본인만
// (lib/server/readingService.js의 getReadingRankings).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request) {
  try {
    const principal = await readingPrincipal(request);
    const query = request.nextUrl.searchParams;
    return NextResponse.json(await getReadingRankings(principal, query.get("classId"), query.get("period") || "weekly"), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}

// [교사] 저장해 둔 반 순위를 지웁니다 — 학생을 사용 중지 · 반에서 빼기 · 탈퇴시킨 뒤
// (lib/data/reading.js의 resetReadingRankings · 담당 교사 · 관리자만). 다음 조회가 지금 명단으로 다시 셉니다.
export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    if (raw.length > 1000) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "reading/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다."); }
    return NextResponse.json(await resetReadingRankings(principal, body?.classId), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
