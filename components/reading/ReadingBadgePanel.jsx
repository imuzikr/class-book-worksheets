"use client";
// =============================================================
// 성장·뱃지 창 — 떠 있는 동그라미의 '성장·뱃지' 행성이 메신저처럼 엽니다(선생님 요청 · 2026년 11월)
// -------------------------------------------------------------
// 한때 책 봄 왼쪽에 늘 서던 칸(ReadingGrowthSidebar — 지금 ReadingGrowthBadges)을 이 창으로 옮겼습니다 — 책꽂이가 가로를
// 다 씁니다(되살리지 마세요).
// 자료는 책 봄이 이미 들고 있는 뱃지(lib/readingBadgeBridge.js — 학생 본인, 또는 교사가 명단에서 고른 학생)이고
// 서버에 따로 묻지 않습니다(읽기 0). 뱃지를 누르면 책 봄의 뱃지 상세 창이 뜹니다(대표 뱃지 고르기도 그 창 그대로).
// 이 파일은 누를 때만 내려받습니다(FloatingHub의 dynamic) — 뱃지 그림 · CSS가 첫 화면에 안 실리게.
// =============================================================
import HubPanel from "@/components/HubPanel";
import ReadingGrowthBadges from "./ReadingGrowthBadges";
import { readingBadgeSummary } from "@/lib/readingBadgeBridge";

// entry — 다리에 걸린 지금의 뱃지(없으면 null — 교사가 아직 학생을 안 골랐거나 책 봄을 떠남)
export default function ReadingBadgePanel({ entry, isTeacher = false, onClose }) {
  const state = entry?.state;
  const sub = entry ? readingBadgeSummary(entry) : isTeacher ? "학생 명단에서 학생을 고르면 볼 수 있어요" : "책 봄에서 볼 수 있어요";
  return (
    <HubPanel title="성장·뱃지" sub={sub} className="badge-panel" onClose={onClose} closeLabel="성장·뱃지 닫기" busy={state === "loading"} autoFocus>
      <div className="hub-panel-body badge-panel-body">
        {!entry ? (
          <p className="hub-panel-note">{isTeacher ? "책 봄의 학생 명단에서 학생을 고르면 그 학생이 모은 뱃지와 다음 목표가 여기에 섭니다." : "책 봄을 열면 내가 모은 뱃지와 다음 목표를 볼 수 있어요."}</p>
        ) : state === "ready" ? (
          <ReadingGrowthBadges stats={entry.stats} onInspect={entry.onInspect} />
        ) : state === "error" ? (
          <p className="hub-panel-note" role="alert">독서 기록을 불러오지 못했어요. 책 봄을 새로 열어 주세요.</p>
        ) : (
          <p className="hub-panel-note" role="status">독서 기록을 불러오고 있어요…</p>
        )}
      </div>
    </HubPanel>
  );
}
