import { NextResponse } from "next/server";
import { getDashboard, saveDashboardSemester } from "@/lib/server/dashboardService";
import { readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request) {
  try {
    const principal = await readingPrincipal(request);
    const query = request.nextUrl.searchParams;
    if (["uid", "userId", "studentUid"].some((key) => query.has(key))) {
      throw new ReadingHttpError("다른 학생을 지정해 조회할 수 없습니다.", 400, "dashboard/invalid-target");
    }
    const options = Object.fromEntries(["classId", "activityId", "period", "start", "end"].map((key) => [key, query.get(key)]));
    return NextResponse.json(await getDashboard(principal, options), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}

export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    if (raw.length > 2000) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "dashboard/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다.", 400, "dashboard/invalid-body"); }
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some((key) => !["classId", "start", "end"].includes(key))) {
      throw new ReadingHttpError("학기 기간 입력 내용을 확인해 주세요.", 400, "dashboard/invalid-body");
    }
    return NextResponse.json(await saveDashboardSemester(principal, body), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
