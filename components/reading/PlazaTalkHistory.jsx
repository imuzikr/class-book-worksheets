"use client";
// =============================================================
// [교사] 학생 한 명의 광장 대화 기록 — 책 광장 · 교실에서 나눈 대화(선생님 결정 — 대화 기록을 남기고 선생님이 봄)
// -------------------------------------------------------------
// 교사 책 봄의 '○○의 독서 여정' 머리에 있는 '광장 대화' 단추가 엽니다(TeacherReadingView — 댓글 이력 옆).
//   · 그 학생이 든 대화(최근 40개)를 최근 것부터 — 대화마다 함께한 사람 · 말 수, 펴면 말 전체(들어옴 · 나감 줄까지).
//     그 학생이 들어오기 전의 말도 보입니다(선생님은 대화 전체를 봄 — 학생은 제가 들어온 뒤의 말만 봄).
//   · 자료는 Realtime Database(plazaTalk · plazaTalkBy)이고 서버가 담당 교사 · 관리자인지 본 뒤 내려 줍니다
//     (lib/server/readingService.js의 plazaTalkHistory). 묶는 셈은 lib/readingPlazaTalk.js의 plazaTalkHistory.
//   · 창을 열 때 한 번 읽습니다(구독하지 않음 — '새로 불러오기'로 다시).
//   · 대화 지우기(선생님 요청 · 2026년 11월) — 줄마다 '지우기' · 머리의 '모두 지우기', 누르면 그 자리에 확인 띠(창을 하나 더
//     띄우지 않음 · Esc는 띠만 닫음). 지운 대화는 함께한 친구들의 기록에서도 사라지고 되돌릴 수 없습니다. 지금 이야기하는 중인
//     대화(ongoing — lib/readingPlazaTalk.js의 talkInProgress)는 '이야기하는 중'을 달고 지우기를 쉽니다(학생의 대화창이 갑자기
//     비지 않게 — 끝난 뒤에). 지우는 일은 서버가 담당 교사인지 본 뒤 합니다(lib/server/readingService.js의 plazaTalkDelete).
//   · 이 배포가 실시간 데이터베이스를 쓰지 않으면(주소 없음) 대화도 없어 그 사실을 적습니다.
// 이름은 대화에 적힌 이름표(서버가 입장권에서 옮김)를 그대로 씁니다. 닫기는 × · 배경 · Esc(lib/modal.js의 backdropClose).
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { backdropClose } from "@/lib/modal";
import { formatStampMinute } from "@/lib/dates";
import { deletePlazaTalks, fetchPlazaTalkHistory } from "@/lib/data/plazaLive";
import { plazaTalkHistory } from "@/lib/readingPlazaTalk";
import { iGa, withJosa } from "@/lib/korean";

function clockOf(t) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 지우기 확인 띠 — 그 줄(또는 머리) 바로 아래. 처음 초점은 '취소'(Enter를 잘못 눌러 지워지지 않게).
function DeleteConfirm({ text, yes, busy, onYes, onNo }) {
  return (
    <div className="talk-history-confirm" role="group" aria-label="지우기 확인">
      <p>{text}</p>
      <div className="talk-history-confirm-btns">
        <button type="button" className="is-danger" disabled={busy} onClick={onYes}>{busy ? "지우는 중…" : yes}</button>
        <button type="button" autoFocus disabled={busy} onClick={onNo}>취소</button>
      </div>
    </div>
  );
}

export default function PlazaTalkHistory({ classId, student, onClose }) {
  const [data, setData] = useState(null);       // null 불러오는 중 · { talks, live }
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [openId, setOpenId] = useState(null);
  // 지우기 — confirm: 확인을 묻는 대화 번호(모두는 "all") · busy: 지우는 중 · note: 지운 결과 한 줄
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    let alive = true;
    setData(null); setError(""); setConfirm(null); setNote("");
    fetchPlazaTalkHistory(classId, student.uid)
      .then((value) => { if (alive) setData(value ?? { talks: [], live: false }); })
      .catch((e) => { if (alive) { setData({ talks: [], live: true }); setError(e?.message || "광장 대화 기록을 불러오지 못했어요."); } });
    return () => { alive = false; };
  }, [classId, student.uid, reload]);
  const rows = useMemo(() => plazaTalkHistory(data?.talks ?? [], student.uid), [data, student.uid]);
  // 처음에는 가장 최근 대화만 펴 둡니다(지운 뒤에는 펴 둔 대화를 그대로 — 그 대화를 지웠으면 가장 최근 것)
  useEffect(() => { setOpenId((cur) => (cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? null)); }, [rows]);
  const name = student.name || "학생";
  const says = rows.reduce((n, row) => n + row.lines.filter((l) => l.kind === "say" && l.mine).length, 0);
  const deletable = rows.filter((row) => !row.ongoing);
  const talkingNow = rows.length - deletable.length;

  async function remove(ids) {
    setBusy(true); setNote(""); setError("");
    try {
      const result = await deletePlazaTalks(classId, ids);
      const gone = new Set([...(result?.deleted ?? []), ...(result?.missing ?? [])]);
      const still = new Set(result?.ongoing ?? []);
      setData((d) => (d ? { ...d, talks: d.talks.filter((t) => !gone.has(t.id)).map((t) => (still.has(t.id) ? { ...t, ongoing: true } : t)) } : d));
      const n = result?.deleted?.length ?? 0;
      setNote(still.size
        ? `${n ? `대화 ${n}개를 지웠어요. ` : ""}지금 이야기하는 중인 대화 ${still.size}개는 끝난 뒤에 지울 수 있어요.`
        : `대화 ${n}개를 지웠어요.`);
    } catch (e) {
      setError(e?.message || "광장 대화를 지우지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  // Esc는 확인 띠부터 닫습니다(창은 그대로 — lib/modal.js가 preventDefault를 보고 비켜 감)
  function onKeyDown(e) {
    if (e.key !== "Escape" || !confirm || busy) return;
    e.preventDefault();
    setConfirm(null);
  }

  return (
    <div className="modal-backdrop plaza-history-backdrop" {...backdropClose(onClose)}>
      <div className="modal plaza-history" role="dialog" aria-modal="true" aria-labelledby="plaza-talk-history-title" onKeyDown={onKeyDown}>
        <div className="plaza-history-head">
          <div>
            <h3 id="plaza-talk-history-title">{name}의 광장 대화</h3>
            <p>책 광장 · 교실에서 {iGa(name)} 든 대화예요. 함께한 친구들의 말도 함께 보여요(선생님만 볼 수 있어요).</p>
          </div>
          <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <div className="plaza-history-tools">
          <span>{data ? <>대화 <b>{rows.length}</b>개 · {name}의 말 <b>{says}</b>마디</> : " "}</span>
          <div className="talk-history-tools-btns">
            <button type="button" className="btn-ghost" disabled={!data || busy || !deletable.length}
              title={talkingNow && !deletable.length ? "지금 이야기하는 중인 대화는 끝난 뒤에 지울 수 있어요" : "이 학생의 광장 대화를 모두 지워요"}
              onClick={() => { setNote(""); setConfirm("all"); }}>모두 지우기</button>
            <button type="button" className="btn-ghost" disabled={!data || busy} onClick={() => setReload((n) => n + 1)}>새로 불러오기</button>
          </div>
        </div>
        {confirm === "all" && (
          <DeleteConfirm busy={busy} yes="모두 지우기" onYes={() => remove(deletable.map((row) => row.id))} onNo={() => setConfirm(null)}
            text={`${name}의 광장 대화 ${deletable.length}개를 모두 지울까요? 함께한 친구들의 기록에서도 사라지고, 되돌릴 수 없어요.${talkingNow ? ` 지금 이야기하는 중인 대화 ${talkingNow}개는 남아요.` : ""}`} />
        )}
        {note && <p className="plaza-history-note" role="status">{note}</p>}
        {error && <p className="plaza-history-alert" role="alert">{error}</p>}
        {data && data.live === false && (
          <p className="plaza-history-alert" role="status">이 배포는 실시간 데이터베이스(함께 있는 친구들)를 쓰지 않아 광장 대화가 없어요.</p>
        )}
        <div className="plaza-history-body">
          {!data ? <p className="reading-muted">광장 대화 기록을 불러오고 있어요.</p>
            : rows.length === 0 ? <p className="reading-muted">{iGa(name)} 나눈 광장 대화가 아직 없어요.</p>
              : (
                <ol className="plaza-history-list">
                  {rows.map((row) => {
                    const open = openId === row.id;
                    const others = row.people.filter((p) => p.uid !== student.uid).map((p) => p.name);
                    return (
                      <li key={row.id} className={`plaza-history-item talk-history-item${open ? " is-open" : ""}`}>
                        <div className="talk-history-row">
                          <button type="button" className="talk-history-head" aria-expanded={open} onClick={() => setOpenId(open ? null : row.id)}>
                            <svg className="talk-history-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2.5 8 6l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span className="talk-history-when">{row.at ? formatStampMinute(row.at) : "때를 모름"}</span>
                            <span className="talk-history-who">{others.length ? `${withJosa(others.join(" · "), "과", "와")} 함께` : "혼자 남은 대화"}</span>
                            {row.ongoing && <span className="talk-history-live">이야기하는 중</span>}
                            <span className="talk-history-count">말 {row.says}개</span>
                          </button>
                          <button type="button" className="talk-history-del" disabled={busy || row.ongoing}
                            title={row.ongoing ? "지금 이야기하는 중인 대화예요 — 끝난 뒤에 지울 수 있어요" : "이 대화를 지워요"}
                            aria-label={`${row.at ? formatStampMinute(row.at) : ""} 대화 지우기`}
                            onClick={() => { setNote(""); setConfirm(row.id); }}>지우기</button>
                        </div>
                        {confirm === row.id && (
                          <DeleteConfirm busy={busy} yes="지우기" onYes={() => remove([row.id])} onNo={() => setConfirm(null)}
                            text="이 대화를 지울까요? 함께한 친구들의 기록에서도 사라지고, 되돌릴 수 없어요." />
                        )}
                        {open && (
                          <ol className="talk-history-lines">
                            {row.lines.length === 0 && <li className="is-system">남은 말이 없어요.</li>}
                            {row.lines.map((line) => (line.kind === "say" ? (
                              <li key={line.id} className={line.mine ? "is-mine" : ""}>
                                <b>{line.name}</b>
                                <span className="talk-history-text">{line.text}</span>
                                <time>{clockOf(line.t)}</time>
                              </li>
                            ) : (
                              <li key={line.id} className="is-system">{line.name} {line.kind === "join" ? "들어옴" : "나감"} · {clockOf(line.t)}</li>
                            )))}
                          </ol>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
        </div>
        <p className="plaza-history-foot">최근 대화 40개까지 보여요. 지운 대화는 함께한 친구들의 기록에서도 사라져요. 반을 완전히 지우면 그 반의 대화가, 학생이 탈퇴하면 그 학생의 말이 함께 지워져요.</p>
      </div>
    </div>
  );
}
