import { NextResponse } from "next/server";
import { readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";
import { finishStudentWithdrawal } from "@/lib/server/accountService";

// [교사] 학생 탈퇴의 마무리 — 로그인 계정과 프로필 아래의 모든 문서를 지웁니다
// (lib/data/withdraw.js가 반의 기록을 다 지운 뒤 부름 · lib/server/accountService.js).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    if (raw.length > 1000) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "reading/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다."); }
    return NextResponse.json(await finishStudentWithdrawal(principal, body?.uid), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
