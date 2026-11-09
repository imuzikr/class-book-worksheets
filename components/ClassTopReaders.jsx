"use client";
// =============================================================
// 상단바 가운데 — 우리 반 독서 TOP 3 (선생님 요청 · 한때 학교 전체 전광판 자리)
// 지금 반에서 레벨 → 누적 경험치 → 그 경험치에 먼저 이른 학생 차례로 셋을
// 캐릭터 · 레벨 · 이름으로 보여 줍니다(셈은 lib/readingJourney.js의 topReaders).
// 반마다 따로입니다 — 교사는 고른 반, 학생은 소속 반.
//   · 책나눔 성장 기능과 랭킹 시스템이 켜진 반에서만 섭니다(아니면 빈 칸 —
//     상단바 가운데 자리가 그대로 남아 오른쪽 아이콘이 안 흔들림).
//   · **한 주 내내 같은 셋입니다**(선생님 요청) — 서울 시각 월요일 오전 7시에 바뀌고,
//     그 주의 셋은 지난 일요일까지의 기록으로 셉니다(lib/reading.js의 readingTopWeek ·
//     lib/readingJourney.js의 readingTopAsOf). 서버가 반마다 한 주에 한 번 셈해 적어 두고
//     (getReadingTop), 이 화면은 그 주의 것을 한 번 받아 탭 안에서 기억해 둡니다.
//     그 주 안에서는 다시 묻지 않고, 화면을 연 채 월요일 07:00을 지나면 그때 한 번 묻습니다.
//   · 한때 2분마다 다시 물었습니다(화면마다 · 학생마다 — 25명 반 한 차시에 2만 건 남짓).
//     **주기적으로 다시 묻게 되돌리지 마세요.**
//   · 캐릭터도 그 주에 셀 때의 것입니다. 내 캐릭터만은 바꾸면 곧바로 내 화면에 보이고
//     (myCharacter — 상단바가 이미 구독), 친구 화면에는 다음 주에 바뀝니다.
//     반이 캐릭터를 끄면 기본 캐릭터로 그립니다(charactersOn).
//   · 사용 중지된 학생은 서지 않습니다. 선생님이 학생을 사용 중지하거나 다시 사용하게 하면 그 반의
//     TOP 3를 다시 세고(lib/data/reading.js의 refreshReadingTop) 그 결과를 여기서 곧바로 씁니다
//     (READING_TOP_EVENT — 묻지 않음). 다른 사람의 화면은 다음에 앱을 열 때 바뀝니다.
// =============================================================
import { useEffect, useState } from "react";
import { fetchReadingTop, READING_TOP_EVENT } from "@/lib/data/reading";
import { nextReadingTopRefresh, readingTopWeek } from "@/lib/reading";
import { dateKeyLabel } from "@/lib/dates";
import { characterImage, characterOf } from "./reading/CharacterChooser";

const WEEK_MS = 7 * 86400000;
// 기기 시계가 조금 빨라 서버가 아직 지난주를 돌려줄 때 — 그 사이에 거듭 묻지 않게
const SKEW_RETRY_MS = 10 * 60 * 1000;
// 반마다 받은 주 — 상단바는 화면을 옮길 때마다 새로 뜨므로 탭 안에서 나눠 씁니다.
const cache = new Map(); // classId → { week, rows, at }

// 선생님이 다시 센 TOP 3(refreshReadingTop) — 지금 보이지 않는 반의 것도 기억해 둔 것을 갈아 둡니다
// (그 반으로 옮기면 곧바로 새것). 지금 보이는 반이면 아래 화면이 함께 바꿉니다.
function remember(detail) {
  if (!detail?.classId || !Array.isArray(detail.rows)) return null;
  const entry = { week: detail.week || readingTopWeek(new Date()), rows: detail.rows, at: Date.now() };
  cache.set(detail.classId, entry);
  return entry;
}
if (typeof window !== "undefined") window.addEventListener(READING_TOP_EVENT, (e) => remember(e.detail));

async function loadTop(classId) {
  const now = Date.now();
  const week = readingTopWeek(new Date(now));
  const weekStart = nextReadingTopRefresh(new Date(now)) - WEEK_MS;
  const hit = cache.get(classId);
  if (hit && (hit.week === week || (hit.at >= weekStart && now - hit.at < SKEW_RETRY_MS))) return hit;
  const result = await fetchReadingTop(classId);
  const entry = { week: result?.week || week, rows: Array.isArray(result?.rows) ? result.rows : [], at: Date.now() };
  cache.set(classId, entry);
  return entry;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ClassTopReaders({ classId, enabled, charactersOn = true, myUid = null, myCharacter = null }) {
  const [state, setState] = useState(null); // { classId, week, rows }

  useEffect(() => {
    if (!classId || !enabled) return undefined;
    let live = true;
    let timer = null;
    const run = () => loadTop(classId)
      .then((entry) => { if (live) setState({ classId, week: entry.week, rows: entry.rows }); })
      // 못 받았으면 보이던 것을 그대로 둡니다(처음이면 빈 목록)
      .catch(() => { if (live) setState((prev) => (prev?.classId === classId ? prev : { classId, week: null, rows: [] })); });
    // 화면을 연 채 월요일 07:00을 지나면 그때 한 번 — 여러 화면이 한 순간에 묻지 않게 1분 안에서 흩습니다.
    const schedule = () => {
      clearTimeout(timer);
      const wait = Math.max(1000, nextReadingTopRefresh() - Date.now()) + Math.floor(Math.random() * 60000);
      timer = setTimeout(() => { if (document.visibilityState === "visible") run(); schedule(); }, wait);
    };
    run();
    schedule();
    // 탭으로 돌아왔을 때 — 그 사이 주가 바뀌었으면 받고, 같은 주면 기억해 둔 것을 씁니다(묻지 않음).
    // 잠든 노트북이 깨어나면 타이머가 늦게 돌 수 있어 여기서도 봅니다.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      run();
      schedule();
    };
    // 선생님이 이 반의 TOP 3를 다시 셌을 때(학생 사용 중지 · 다시 사용) — 받은 것을 곧바로 씁니다.
    const onRefreshed = (e) => {
      if (!live || e.detail?.classId !== classId) return;
      const entry = remember(e.detail);
      if (entry) setState({ classId, week: entry.week, rows: entry.rows });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(READING_TOP_EVENT, onRefreshed);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(READING_TOP_EVENT, onRefreshed);
    };
  }, [classId, enabled]);

  if (!classId || !enabled) return null;
  const rows = state?.classId === classId ? state.rows : null;
  if (!rows) return null; // 처음 답을 기다리는 동안은 비워 둠(번쩍임 없게)
  const characterFor = (row) => {
    if (!charactersOn) return characterOf({ uid: row.uid });
    if (myUid && row.uid === myUid && myCharacter) return characterOf({ uid: row.uid, character: myCharacter });
    return characterOf(row);
  };
  const weekNote = state.week
    ? `${dateKeyLabel(state.week)} 오전 7시에 정한 이번 주 TOP 3 — 지난 일요일까지의 기록이에요. 매주 월요일 오전 7시(서울)에 바뀝니다.`
    : "매주 월요일 오전 7시(서울)에 바뀝니다.";

  return (
    <div className="top-readers" aria-label="우리 반 독서 TOP 3">
      <span className="top-readers-label" title={weekNote}>독서 TOP 3</span>
      {rows.length === 0 ? (
        <span className="top-readers-empty" title={weekNote}>아직 독서 기록이 없어요</span>
      ) : (
        <ol className="top-readers-list">
          {rows.map((row, i) => (
            <li key={row.uid} className="top-readers-item" title={`${i + 1}위 · Lv.${row.level || 1} ${row.name} · ${Number(row.totalXp ?? row.allTimeXp) || 0} EXP (지난 일요일까지)`}>
              <span className="top-readers-medal" aria-hidden="true">{MEDALS[i]}</span>
              <img className="top-readers-avatar" src={characterImage(characterFor(row))} alt="" width={28} height={28} />
              <span className="top-readers-level">Lv.{row.level || 1}</span>
              <span className="top-readers-name">{row.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
