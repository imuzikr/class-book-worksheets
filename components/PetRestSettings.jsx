"use client";
// =============================================================
// 관리자 설정 — 펫 먹이의 '배고파지지 않는 날' (선생님 요청)
// -------------------------------------------------------------
// 펫의 배부름은 날마다 10씩 줄어듭니다(lib/petCare.js). 방학 · 시험 기간 · 기타(명절 · 예외적인 연휴)를
// **셀지 말지는 선생님이 여기서 정합니다** — 기간을 넣어 두면 그 날들은 줄지 않습니다. 주말도 스위치 하나로
// 쉬게 하거나 세게 합니다(끄지 않았으면 쉼).
//   · 다른 스위치처럼 선생님의 **운영 중인 반 모두에 한 값**입니다(setTeacherPetRests — 한 묶음으로 씀).
//   · 날짜를 고치는 동안에는 저장하지 않습니다 — 시작일만 바꾼 순간의 '끝이 시작보다 앞선 기간'이 저장되지 않게,
//     '저장'을 눌러야 적용됩니다(되돌리기로 고치던 것을 버림).
//   · 기간은 미리 넣어 둘 수 있습니다(펫 먹이를 켜기 전에도). 이미 지나간 날의 배부름은, 그 학생의 펫이 그 뒤로
//     먹이를 먹거나 책을 읽어 셈이 적힌 뒤라면 되돌아가지 않습니다 — 방학 **전에** 넣어 두세요.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { setTeacherPetRests } from "@/lib/store";
import { kstToday, teacherPetRestSettings } from "@/lib/reading";
import { CARE_REST_KINDS, CARE_REST_NOTE_MAX, CARE_RESTS_MAX, careRestLabel, careRestOf, isCareRestDay, normalizeCareRests } from "@/lib/petCare";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
let rowSeq = 0;
const withId = (rest) => ({ id: `rest-${(rowSeq += 1)}`, kind: rest.kind, from: rest.from, to: rest.to, note: rest.note ?? "" });
const plain = (rows) => rows.map(({ kind, from, to, note }) => ({ kind, from, to, ...(note.trim() ? { note: note.trim() } : {}) }));
// 한 줄이 저장할 수 있는 모양인가 — 날짜 둘이 있고 끝이 시작보다 앞서지 않음
const rowProblem = (row) => (!DAY.test(row.from) || !DAY.test(row.to) ? "날짜를 정해 주세요" : row.to < row.from ? "끝나는 날이 시작하는 날보다 앞이에요" : "");

export default function PetRestSettings({ classes = [], feedOn = false, ready = true, onToast }) {
  const ids = useMemo(() => classes.map((c) => c.id), [classes]);
  const saved = useMemo(() => {
    const s = teacherPetRestSettings(classes);
    return { weekend: s.weekend, rests: normalizeCareRests(s.rests), mixed: s.mixed };
  }, [classes]);
  const savedKey = JSON.stringify([saved.weekend, saved.rests]);
  const [weekend, setWeekend] = useState(saved.weekend);
  const [rows, setRows] = useState(() => saved.rests.map(withId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draftKey = JSON.stringify([weekend, normalizeCareRests(plain(rows))]);
  const problems = rows.map(rowProblem);
  // 날짜가 덜 찬 줄이 있으면 '고치는 중'입니다(normalize가 그 줄을 버려 저장된 것과 같아 보이더라도)
  const dirty = draftKey !== savedKey || problems.some(Boolean);
  // 저장된 값이 바뀌면(저장 뒤 · 다른 창에서 고침) 고치던 것이 없을 때만 따라갑니다
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    const [savedWeekend, savedRests] = JSON.parse(savedKey);
    setWeekend(savedWeekend);
    setRows(savedRests.map(withId));
  }, [savedKey]);

  const today = kstToday();
  const savedRules = { weekend: saved.weekend, rests: saved.rests };
  const restNow = careRestOf(today, savedRules);
  const todayLine = restNow ? `오늘은 ‘${restNow.note || careRestLabel(restNow.kind)}’ 기간이라 배부름이 줄지 않아요.`
    : isCareRestDay(today, savedRules) ? "오늘은 주말이라 배부름이 줄지 않아요."
      : "오늘은 배부름이 줄어드는 날이에요(책을 읽고 발자국을 남긴 학생은 그대로).";

  const change = (id, patch) => setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  function add() {
    if (rows.length >= CARE_RESTS_MAX) return;
    setRows((list) => [...list, withId({ kind: "vacation", from: today, to: today })]);
  }
  function revert() {
    setWeekend(saved.weekend);
    setRows(saved.rests.map(withId));
    setError("");
  }
  async function save() {
    if (busy || problems.some(Boolean)) return;
    setBusy(true);
    setError("");
    try {
      await setTeacherPetRests(ids, { weekend, rests: plain(rows) });
      onToast?.(`펫이 배고파지지 않는 날을 저장했어요.${ids.length > 1 ? ` (반 ${ids.length}개 모두)` : ""}`);
    } catch (e) {
      setError(e?.message || "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`adm-group adm-rest-group${ready ? "" : " is-off"}`} aria-labelledby="adm-rest-title">
      <header className="adm-group-head">
        <h3 id="adm-rest-title">펫이 배고파지지 않는 날</h3>
        <span>주말 · 방학 · 시험 기간 · 명절 같은 날을 셀지 정해요</span>
      </header>
      <div className="adm-rest">
        <p className="adm-rest-hint">
          {ready ? (feedOn ? todayLine : "펫 먹이를 켜면 적용돼요. 기간은 미리 넣어 둘 수 있어요.") : "학생 펫을 먼저 켜 주세요."}
          {saved.mixed && <strong> 반마다 다르게 저장되어 있어요 — 저장하면 모든 반을 같게 맞춰요.</strong>}
        </p>
        <label className="adm-rest-weekend">
          <input type="checkbox" checked={weekend} disabled={!ready || busy} onChange={(e) => setWeekend(e.target.checked)} />
          <span><strong>주말에는 줄지 않아요</strong><small>끄면 토요일 · 일요일에도 배부름이 10씩 줄어요.</small></span>
        </label>
        {rows.length > 0 && (
          <ul className="adm-rest-rows" aria-label="배부름이 줄지 않는 기간">
            {rows.map((row, i) => (
              <li key={row.id} className={`adm-rest-row${problems[i] ? " is-bad" : ""}`}>
                <select aria-label="기간의 종류" value={row.kind} disabled={!ready || busy} onChange={(e) => change(row.id, { kind: e.target.value })}>
                  {CARE_REST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <span className="adm-rest-dates">
                  <input type="date" aria-label="시작하는 날" value={row.from} disabled={!ready || busy} onChange={(e) => change(row.id, { from: e.target.value })} />
                  <span aria-hidden="true">~</span>
                  <input type="date" aria-label="끝나는 날" value={row.to} min={row.from || undefined} disabled={!ready || busy} onChange={(e) => change(row.id, { to: e.target.value })} />
                </span>
                <input type="text" className="adm-rest-note" aria-label="메모" maxLength={CARE_REST_NOTE_MAX} value={row.note} disabled={!ready || busy}
                  placeholder={row.kind === "other" ? "예: 추석 연휴" : row.kind === "exam" ? "예: 2학기 기말" : "예: 겨울 방학"} onChange={(e) => change(row.id, { note: e.target.value })} />
                <button type="button" className="adm-rest-remove" disabled={!ready || busy} onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))} aria-label={`${careRestLabel(row.kind)} 기간 빼기`}>빼기</button>
                {problems[i] && <small className="adm-rest-problem" role="alert">{problems[i]}</small>}
              </li>
            ))}
          </ul>
        )}
        <div className="adm-rest-tools">
          <button type="button" className="btn-ghost adm-rest-add" disabled={!ready || busy || rows.length >= CARE_RESTS_MAX} onClick={add}>＋ 기간 더하기</button>
          {dirty && (
            <span className="adm-rest-save">
              <button type="button" className="btn-ghost" disabled={busy} onClick={revert}>되돌리기</button>
              <button type="button" className="btn-primary" disabled={!ready || busy || problems.some(Boolean)} onClick={save}>{busy ? "저장 중…" : "저장"}</button>
            </span>
          )}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="adm-rest-foot">기간에 든 날과 (쉬게 한) 주말에는 펫의 배부름이 줄지 않아요. 방학 · 시험 기간이 시작되기 전에 넣어 두세요.</p>
      </div>
    </section>
  );
}
