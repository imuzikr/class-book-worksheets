import { NextResponse } from "next/server";
import { getReadingPet, readingPetAction, readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

// 독서 펫 — GET: 내 펫의 지금 모습('내 프로필' 창 · 펫 먹이를 켠 반이면 배부름도)
// POST { classId, action } — "adopt" 알 받기 · "hatch" 알 깨우기 · "feed"(count: 과일 수) 먹이 주기 ·
//   "call" 떠난 펫 다시 부르기의 과일 걸음(과일 2개) · "recall"(uid: 학생) [선생님] 떠난 펫 불러 주기.
// 학생 본인만('recall'은 담당 교사 · 관리자), '학생 펫'이 켜진 반에서만. 먹이 · 다시 부르기는 '펫 먹이'를 켠 반에서만
// (lib/server/readingService.js · 셈은 lib/petCare.js). 과일은 서버가 줄입니다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request) {
  try {
    const principal = await readingPrincipal(request);
    return NextResponse.json(await getReadingPet(principal, request.nextUrl.searchParams.get("classId")), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}

export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    if (raw.length > 500) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "reading/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다."); }
    return NextResponse.json(await readingPetAction(principal, body), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
