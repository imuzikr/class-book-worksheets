import { NextResponse } from "next/server";
import { getReadingHideout, saveReadingHideout, readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request) {
  try {
    const principal = await readingPrincipal(request);
    const query = request.nextUrl.searchParams;
    return NextResponse.json(await getReadingHideout(principal, query.get("classId"), query.get("uid")), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}

export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    // Only the thirty fixed slot IDs and a revision travel here. Coordinates,
    // image URLs and reading/achievement data are never accepted in this route.
    if (Buffer.byteLength(raw, "utf8") > 8192) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "reading/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다."); }
    return NextResponse.json(await saveReadingHideout(principal, body), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
