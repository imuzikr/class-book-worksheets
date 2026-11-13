import { NextResponse } from "next/server";
import { plazaAction, readingPrincipal, readingErrorResponse } from "@/lib/server/readingService";
import { ReadingHttpError } from "@/lib/server/readingPolicy";

// 책 광장 — 댓글 달기 · 지우기, [교사] 책을 광장에서 내리기 · 다시 올리기, 실시간 입장권 받기(action "enter"),
// 그 반의 공유 사본을 한 번 통째로 맞추기(action "sync" — 광장을 켠 반에서는 모든 글이 공개되므로, 켜기 전에 쓴 글도 맞춤)
// (lib/server/readingService.js의 plazaAction). 광장의 글을 읽는 것은 이 API가 아니라
// 화면이 Firestore의 공유 사본(plazaShelves · plazaBooks · plazaComments)을 곧바로 구독합니다.
// 친구들의 캐릭터 자리는 화면끼리 Realtime Database로 주고받고, 여기서는 그 입장권만 적어 줍니다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request) {
  try {
    const principal = await readingPrincipal(request);
    const raw = await request.text();
    if (raw.length > 5000) throw new ReadingHttpError("입력 내용이 너무 큽니다.", 413, "reading/payload-too-large");
    let body;
    try { body = JSON.parse(raw); } catch { throw new ReadingHttpError("요청 형식이 올바르지 않습니다."); }
    return NextResponse.json(await plazaAction(principal, body), { headers });
  } catch (error) {
    const failure = readingErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status, headers });
  }
}
