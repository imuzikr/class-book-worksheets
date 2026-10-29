import { NextResponse } from "next/server";
import { getReadingRankings, readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";

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
