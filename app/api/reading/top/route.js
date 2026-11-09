import { NextResponse } from "next/server";
import { getReadingTop, readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

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

// [교사] 학생을 사용 중지하거나 다시 사용하게 한 뒤 — 그 반의 이번 주 TOP 3를 지금 다시 셉니다
// (lib/data/reading.js의 refreshReadingTop · 담당 교사 · 관리자만). 사용 중지된 학생은 TOP 3에 서지 않는데,
// TOP 3는 한 주에 한 번만 세므로 다시 세지 않으면 다음 월요일 07:00까지 그대로 남습니다.
export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    if (raw.length > 1000) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "reading/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다."); }
    return NextResponse.json(await getReadingTop(principal, body?.classId, { refresh: true }), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
