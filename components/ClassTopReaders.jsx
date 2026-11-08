"use client";
// =============================================================
// 상단바 가운데 — 우리 반 독서 TOP 3 (선생님 요청 · 한때 학교 전체 전광판 자리)
// 지금 반에서 레벨 → 누적 경험치 → 그 경험치에 먼저 이른 학생 차례로 셋을
// 캐릭터 · 레벨 · 이름으로 보여 줍니다(셈은 lib/readingJourney.js의 topReaders).
// 반마다 따로입니다 — 교사는 고른 반, 학생은 소속 반.
//   · 책나눔 성장 기능과 랭킹 시스템이 켜진 반에서만 섭니다(아니면 빈 칸 —
//     상단바 가운데 자리가 그대로 남아 오른쪽 아이콘이 안 흔들림).
//   · 순위는 리더보드와 같은 서버 API(all-time)를 씁니다 — 경험치 정본은
//     클라이언트가 직접 못 읽습니다. 화면마다 상단바가 새로 뜨므로 반마다
//     2분 동안 기억해 두고(CACHE_MS) 그 사이에는 다시 묻지 않습니다.
// =============================================================
import { useEffect, useState } from "react";
import { fetchReadingRankings } from "@/lib/data/reading";
import { topReaders } from "@/lib/readingJourney";
import { characterImage, characterOf } from "./reading/CharacterChooser";

const CACHE_MS = 120000;
const cache = new Map(); // classId → { at, rows }

async function loadTop(classId, force = false) {
  const hit = cache.get(classId);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.rows;
  const result = await fetchReadingRankings(classId, "all-time");
  const rows = topReaders(Array.isArray(result) ? result : result?.rankings || []);
  cache.set(classId, { at: Date.now(), rows });
  return rows;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ClassTopReaders({ classId, enabled }) {
  const [state, setState] = useState(null); // { classId, rows }

  useEffect(() => {
    if (!classId || !enabled) return undefined;
    let live = true;
    const run = (force) => loadTop(classId, force)
      .then((rows) => { if (live) setState({ classId, rows }); })
      .catch(() => { if (live) setState({ classId, rows: [] }); });
    run(false);
    const tick = () => { if (document.visibilityState === "visible") run(false); };
    const timer = setInterval(tick, CACHE_MS);
    // 캐릭터를 바꾸면 곧바로(리더보드와 같은 알림)
    const changed = () => run(true);
    window.addEventListener("reading-character-change", changed);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("reading-character-change", changed);
    };
  }, [classId, enabled]);

  if (!classId || !enabled) return null;
  const rows = state?.classId === classId ? state.rows : null;
  if (!rows) return null; // 처음 답을 기다리는 동안은 비워 둠(번쩍임 없게)

  return (
    <div className="top-readers" aria-label="우리 반 독서 TOP 3">
      <span className="top-readers-label">독서 TOP 3</span>
      {rows.length === 0 ? (
        <span className="top-readers-empty">아직 독서 기록이 없어요</span>
      ) : (
        <ol className="top-readers-list">
          {rows.map((row, i) => (
            <li key={row.uid} className="top-readers-item" title={`${i + 1}위 · Lv.${row.level || 1} ${row.name} · ${Number(row.totalXp ?? row.allTimeXp) || 0} EXP`}>
              <span className="top-readers-medal" aria-hidden="true">{MEDALS[i]}</span>
              <img className="top-readers-avatar" src={characterImage(characterOf(row))} alt="" width={26} height={26} />
              <span className="top-readers-level">Lv.{row.level || 1}</span>
              <span className="top-readers-name">{row.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
