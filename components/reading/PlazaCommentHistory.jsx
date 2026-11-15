"use client";
// =============================================================
// [교사] 학생 한 명의 책 광장 댓글 이력 — 쓴 댓글 · 받은 댓글(고친 글 · 지운 글까지)
// -------------------------------------------------------------
// 선생님 요청 — 댓글이 친구에게 상처를 줄 수 있으니 학생마다 댓글 이력을 남기고, 나중에 고치거나 지워도 확인할 수 있게.
// 교사 책나눔의 '○○의 독서 여정' 머리에 있는 '댓글 이력' 단추가 엽니다(TeacherReadingView).
//   · 쓴 댓글 — 그 학생이 남긴 것(친구 책 · 제 책) · 받은 댓글 — 그 학생의 책에 친구 · 선생님이 남긴 것
//   · 댓글마다 처음 쓴 글 → 고친 글(때) → 지움(누가 · 때). 지금 반 친구에게 보이는 글에는 '지금 보이는 글'.
//   · 고치기 전 글 · 지운 글은 서버가 classes/{c}/plazaCommentLog에 남기고 **담당 교사만** 읽습니다(규칙 — 반 친구에게는
//     '수정됨'만 보임). 묶는 셈은 lib/readingPlaza.js의 plazaCommentHistory.
//   · 창을 열 때 한 번 읽습니다(구독하지 않음 — '새로 불러오기'로 다시). 읽는 양은 그 학생의 댓글 수 + 그 댓글이 달린 책 수.
//   · 이력을 읽지 못하면(새 규칙을 아직 게시하지 않음 등) 지금 댓글만 보이고 그 까닭을 한 줄 적습니다.
// 이름은 지금 명단(roster)에서 찾고, 없으면 기록에 적힌 이름표를 씁니다(반에서 빠진 학생).
// 닫기는 × · 배경 · Esc(lib/modal.js의 backdropClose).
// =============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { backdropClose } from "@/lib/modal";
import { formatStampMinute } from "@/lib/dates";
import { fetchPlazaCommentHistory } from "@/lib/data/plaza";
import { plazaNameLabel } from "@/lib/readingPlaza";
import { iGa } from "@/lib/korean";

const TABS = [["written", "쓴 댓글"], ["received", "받은 댓글"]];

export default function PlazaCommentHistory({ classId, student, roster = [], onClose }) {
  const [tab, setTab] = useState("written");
  const [data, setData] = useState(null);       // null 불러오는 중 · { written, received, logError }
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setError("");
    fetchPlazaCommentHistory(classId, student.uid)
      .then((value) => { if (alive) setData(value); })
      .catch((e) => { if (alive) { setData({ written: [], received: [], logError: null }); setError(e?.message || "댓글 이력을 불러오지 못했어요."); } });
    return () => { alive = false; };
  }, [classId, student.uid, reload]);

  // 이름표 — 지금 명단이 먼저, 없으면 기록에 적힌 이름표(반에서 빠진 학생)
  const people = useMemo(() => new Map(roster.map((s) => [s.uid, s])), [roster]);
  const labelOf = useCallback((uid, fallback = null) => {
    const s = people.get(uid);
    if (s) return s.studentId ? `${s.studentId} ${s.name}` : s.name;
    return fallback ? plazaNameLabel(fallback) : "반에서 빠진 학생";
  }, [people]);

  const rows = data?.[tab] ?? [];
  const count = (key) => data?.[key]?.length ?? 0;
  const edited = rows.filter((t) => t.edits > 0).length;
  const deleted = rows.filter((t) => t.deleted).length;
  const name = student.name || "학생";

  return (
    <div className="modal-backdrop plaza-history-backdrop" {...backdropClose(onClose)}>
      <div className="modal plaza-history" role="dialog" aria-modal="true" aria-labelledby="plaza-history-title">
        <div className="plaza-history-head">
          <div>
            <h3 id="plaza-history-title">{name}의 댓글 이력</h3>
            <p>책 광장에 남긴 댓글과 받은 댓글이에요. 고친 글과 지운 글도 함께 보여요(선생님만 볼 수 있어요).</p>
          </div>
          <button type="button" className="btn-close" aria-label="닫기" onClick={onClose}>×</button>
        </div>
        <div className="plaza-history-tabs" role="tablist" aria-label="댓글 이력">
          {TABS.map(([key, label]) => (
            <button type="button" role="tab" key={key} aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
              {label} <span>{data ? count(key) : "…"}</span>
            </button>
          ))}
        </div>
        <div className="plaza-history-tools">
          <span>{data ? <>고친 댓글 <b>{edited}</b> · 지운 댓글 <b>{deleted}</b></> : " "}</span>
          <button type="button" className="btn-ghost" disabled={!data} onClick={() => setReload((n) => n + 1)}>새로 불러오기</button>
        </div>
        {error && <p className="plaza-history-alert" role="alert">{error}</p>}
        {data?.logError && (
          <p className="plaza-history-alert" role="status">
            고친 글 · 지운 글 기록을 읽지 못해 지금 보이는 댓글만 보여 드려요. Firestore 규칙을 새로 게시했는지 확인해 주세요.
          </p>
        )}
        <div className="plaza-history-body">
          {!data ? <p className="reading-muted">댓글 이력을 불러오고 있어요.</p>
            : rows.length === 0 ? <p className="reading-muted">{tab === "written" ? `${iGa(name)} 남긴 댓글이 아직 없어요.` : `${name}의 책에 달린 댓글이 아직 없어요.`}</p>
              : (
                <ol className="plaza-history-list">
                  {rows.map((t) => <HistoryItem key={t.id} thread={t} tab={tab} labelOf={labelOf} />)}
                </ol>
              )}
        </div>
        <p className="plaza-history-foot">고치기 전 글과 지운 글은 이 기능이 생긴 뒤부터 남아요. 반을 완전히 지우거나 학생이 탈퇴하면 함께 지워져요.</p>
      </div>
    </div>
  );
}

function HistoryItem({ thread: t, tab, labelOf }) {
  const author = t.byTeacher ? "선생님" : labelOf(t.uid, t);
  const owner = labelOf(t.ownerUid);
  const title = t.title ? `『${t.title}』` : "광장에서 내려간 책";
  const last = t.versions.length - 1;
  const deletedBy = !t.deleted ? "" : t.deleted.byTeacher ? "선생님이 지움" : t.deleted.by && t.deleted.by === t.uid ? "쓴 사람이 지움" : "지움";
  return (
    <li className={`plaza-history-item${t.deleted ? " is-deleted" : ""}`}>
      <div className="plaza-history-item-head">
        <span className="plaza-history-where">
          {tab === "written" ? <>{t.ownerUid === t.uid ? "내 책" : `${owner}의 책`} <strong>{title}</strong></> : <><strong>{author}</strong> → {title}</>}
        </span>
        <span className="plaza-history-tags">
          {t.edits > 0 && <span className="plaza-history-tag is-edited">고침 {t.edits}번</span>}
          {t.deleted && <span className="plaza-history-tag is-deleted">{deletedBy}</span>}
        </span>
      </div>
      <ol className="plaza-history-versions">
        {t.versions.map((v, i) => (
          <li key={i} className={i === last && !t.deleted ? "is-current" : ""}>
            <span className="plaza-history-when">
              {v.kind === "first" ? "처음 쓴 글" : v.kind === "latest" ? "지금 글" : `고친 글 ${i}`}
              {v.at ? ` · ${formatStampMinute(v.at)}` : ""}
              {i === last && !t.deleted && <em>지금 보이는 글</em>}
            </span>
            <p>{v.text}</p>
          </li>
        ))}
        {t.deleted && (
          <li className="is-gone">
            <span className="plaza-history-when">{deletedBy}{t.deleted.at ? ` · ${formatStampMinute(t.deleted.at)}` : ""}</span>
            <p>반 친구들에게는 더 이상 보이지 않아요.</p>
          </li>
        )}
      </ol>
      {t.gap && <p className="plaza-history-gap">고치기 전 글을 기록에서 찾지 못했어요.</p>}
    </li>
  );
}
