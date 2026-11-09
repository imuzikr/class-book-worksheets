"use client";

// =============================================================
// 돌발 퀴즈 — 학생 창
// -------------------------------------------------------------
// 선생님이 퀴즈를 보내면 **처음 한 번** 저절로 뜨고(PopQuizButton), 그 뒤로는
// 상단바의 메모지를 눌러 엽니다. 닫아도 됩니다 — 쓰던 글은 이 기기에 남겨
// 두었다가 다시 열면 이어 씁니다.
//
//  · 글 퀴즈는 서식 에디터. 예전에 보낸 '코드' 퀴즈가 아직 열려 있으면 고정폭
//    글자 칸에 코드를 적어 보냅니다 — 파이썬 실행(▶)과 코드 편집기는 걷었습니다
//    (책봄은 독서 전용 · 코드 퀴즈는 더 만들 수 없음 · 모든 화면이 그만큼 가벼워짐).
//  · '선생님께 보내기'를 누르면 선생님이 확인할 때까지 못 고칩니다.
//  · 반송되면 선생님 한 마디와 앞의 답이 '선생님과 나눈 말'에 남고, 입력칸은
//    빈 채로 열립니다.
//  · 과일을 받거나 '완료'되면 그 퀴즈는 끝입니다.
//  · 아래 '지난 퀴즈'는 다 펼친 목록 — 퀴즈마다 내 답을 한 건씩 읽습니다.
// =============================================================
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { backdropClose } from "@/lib/modal";
import {
  fetchMyPopQuizAnswer,
  fetchPopQuizzes,
  submitPopQuizAnswer,
} from "@/lib/store";
import {
  QUIZ_ANSWER_MAX,
  canSubmitQuiz,
  quizAnswerFilled,
  quizKindOf,
} from "@/lib/popQuiz";
import RichTextEditor from "./RichTextEditor";
import { PopQuizQuestion, PopQuizStatus, PopQuizThread } from "./PopQuizParts";
import { IconQuizMemo } from "./StatusIcons";
import { UploadClassProvider } from "@/lib/uploadClass";

const TEXT_TOOLS = ["bold", "underline", "insertUnorderedList", "insertOrderedList", "codeBlock"];

// 쓰던 답 — 이 기기에 남겨 두어 창을 닫았다 열어도 이어 씁니다. 보내면 지웁니다.
const draftKey = (quizId, uid) => `popquiz_draft:${quizId}:${uid}`;
function readDraft(quizId, uid) {
  try {
    const v = JSON.parse(localStorage.getItem(draftKey(quizId, uid)) || "null");
    return v && typeof v.text === "string" ? v : null;
  } catch { return null; }
}
function writeDraft(quizId, uid, v) {
  try {
    if (v) localStorage.setItem(draftKey(quizId, uid), JSON.stringify(v));
    else localStorage.removeItem(draftKey(quizId, uid));
  } catch { /* 저장소가 막힌 브라우저 — 창을 닫으면 쓰던 글만 사라짐 */ }
}

// 이미지 보안 4단계 — 이 화면의 서식 편집기에 붙여 넣는 그림은 이 반 폴더로 올립니다.
export default function PopQuizStudentModal(props) {
  return (
    <UploadClassProvider classId={props.classId}>
      <PopQuizStudentModalBody {...props} />
    </UploadClassProvider>
  );
}

function PopQuizStudentModalBody({ classId, user, quiz, answer, onClose }) {
  const uid = user?.uid;
  const open = !!quiz?.open;
  const editable = canSubmitQuiz(quiz, answer);
  const kind = quizKindOf(quiz?.kind);

  return createPortal(
    <div className="modal-backdrop pq-backdrop" {...backdropClose(onClose)}>
      <div
        className="modal pq-student-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pq-student-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3 id="pq-student-title" className="head-icon">
            <IconQuizMemo size={22} /> 돌발 퀴즈
          </h3>
          <button className="btn-close" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="pq-student-body">
          {open ? (
            <section className="pq-current">
              {answer?.status === "returned" && (
                <div className="pq-returned-note" role="status">
                  <strong>선생님이 답을 돌려보냈어요 — 아래 한 마디를 보고 고쳐서 다시 보내 주세요.</strong>
                </div>
              )}
              <PopQuizQuestion quiz={quiz} />
              {/* 반송된 뒤 고쳐 쓰는 중이면, 오간 말이 입력칸 위에 이어집니다. */}
              {editable && answer && (
                <div className="pq-mine">
                  <div className="pq-mine-head"><span>선생님과 나눈 말</span></div>
                  <PopQuizThread answer={answer} viewer="student" />
                </div>
              )}
              {editable ? (
                <AnswerEditor
                  key={`${quiz.id}:${answer?.status ?? "new"}`}
                  classId={classId}
                  uid={uid}
                  quiz={quiz}
                  kind={kind}
                  answer={answer}
                />
              ) : (
                <div className="pq-mine">
                  <div className="pq-mine-head">
                    <span>선생님과 나눈 말</span>
                    <PopQuizStatus answer={answer} />
                  </div>
                  <PopQuizThread answer={answer} viewer="student" />
                  <p className="pq-mine-foot">
                    {answer?.status === "rewarded"
                      ? "선생님이 과일을 주셨어요. 이 퀴즈는 끝났어요."
                      : answer?.status === "completed"
                      ? "선생님이 답을 확인하고 완료했어요. 이 퀴즈는 끝났어요."
                      : "선생님께 보냈어요 — 확인을 기다리는 중이에요. 그동안은 고칠 수 없어요."}
                  </p>
                </div>
              )}
            </section>
          ) : (
            <p className="pq-empty">지금 열린 돌발 퀴즈가 없어요.</p>
          )}

          <PastQuizzes classId={classId} uid={uid} currentId={open ? quiz.id : null} />
        </div>
      </div>
    </div>,
    document.body
  );
}

// 답 쓰기 — 글이면 서식 에디터, (예전) 코드 퀴즈면 고정폭 글자 칸.
// key가 (퀴즈 · 상태)라 반송되면 새로 그려집니다(입력칸은 빈 채로).
function AnswerEditor({ classId, uid, quiz, kind, answer }) {
  const saved = readDraft(quiz.id, uid);
  // 처음 채울 글 — 이 기기에 쓰던 것이 있으면 그것, 없으면 빈 칸.
  // 반송된 답을 다시 채워 두지 않습니다(선생님 요청) — 앞의 답은 위의
  // '선생님과 나눈 말'에 그대로 있어, 입력칸에도 있으면 같은 글이 두 번 서서
  // 무엇을 새로 쓰는 칸인지 헷갈렸습니다.
  const [text, setText] = useState(() => saved?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const initialRef = useRef(saved?.text ?? "");

  function update(next) {
    setText(next);
    writeDraft(quiz.id, uid, { text: next });
  }

  const filled = quizAnswerFilled(kind, text);
  const tooLong = text.length > QUIZ_ANSWER_MAX;

  async function send() {
    if (!filled || busy || tooLong) return;
    setBusy(true);
    setErr(null);
    try {
      await submitPopQuizAnswer(classId, quiz.id, uid, { kind, text }, answer);
      writeDraft(quiz.id, uid, null);
    } catch (e) {
      console.error("[돌발 퀴즈] 답을 보내지 못했어요:", e?.code, e?.message);
      setErr(
        e?.code === "permission-denied"
          ? "보낼 수 없어요 — 선생님이 퀴즈를 마쳤거나 이미 보낸 답이에요."
          : "보내지 못했어요. 다시 눌러 주세요."
      );
      setBusy(false);
    }
  }

  return (
    <div className="pq-editor">
      <span className="pq-editor-label">{kind === "code" ? "코드로 답하기" : "답 쓰기"}</span>
      {kind === "code" ? (
        // 실행은 없습니다 — 적은 코드를 그대로 보냅니다(실행 결과 칸은 빈 채로).
        <textarea
          className="pq-code-text"
          value={text}
          onChange={(e) => update(e.target.value)}
          placeholder="코드를 그대로 적어 주세요."
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={10}
          autoFocus
        />
      ) : (
        <RichTextEditor
          className="pq-rte"
          tools={TEXT_TOOLS}
          initialHtml={initialRef.current}
          onChange={(html) => update(html)}
          placeholder="여기에 답을 적어 주세요."
          autoFocus
        />
      )}
      {err && <p className="form-error">{err}</p>}
      {tooLong && <p className="form-error">답이 너무 길어요 — 조금 줄여 주세요.</p>}
      <div className="pq-send-row">
        <span className="pq-send-hint">
          {filled ? "보내면 선생님이 확인할 때까지 고칠 수 없어요." : "답을 적으면 보낼 수 있어요."}
        </span>
        <button
          type="button"
          className="btn-primary pq-send"
          onClick={send}
          disabled={!filled || busy || tooLong}
        >
          {busy ? "보내는 중…" : "선생님께 보내기"}
        </button>
      </div>
    </div>
  );
}

// 지난 퀴즈 — 접고 펴는 목록(선생님 요청). 창을 열 때 목록을 한 번 읽고,
// 한 줄을 펼칠 때 그 퀴즈의 내 답을 한 건 읽습니다(펴 본 것은 기억).
function PastQuizzes({ classId, uid, currentId }) {
  // 접지 않고 다 펼칩니다(선생님 요청) — 퀴즈마다 물음과 오간 말이 한눈에.
  // 목록은 창을 열 때 한 번, 내 답은 퀴즈마다 한 건씩 읽습니다(퀴즈는 수업마다
  // 한두 개라 몇 건 안 됩니다).
  const [list, setList] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    let alive = true;
    fetchPopQuizzes(classId)
      .then((l) => { if (alive) setList(l); })
      .catch((e) => {
        console.warn("[돌발 퀴즈] 지난 퀴즈를 읽지 못했어요:", e?.code, e?.message);
        if (alive) setList([]);
      });
    return () => { alive = false; };
  }, [classId]);

  const past = (list ?? []).filter((q) => q.id !== currentId);
  const pastKey = past.map((q) => q.id).join(",");

  useEffect(() => {
    if (!pastKey || !uid) return;
    let alive = true;
    pastKey.split(",").forEach((id) => {
      fetchMyPopQuizAnswer(classId, id, uid)
        .then((a) => { if (alive) setAnswers((m) => ({ ...m, [id]: a })); })
        .catch(() => { if (alive) setAnswers((m) => ({ ...m, [id]: null })); });
    });
    return () => { alive = false; };
  }, [classId, uid, pastKey]);

  return (
    <section className="pq-past pq-past--open">
      <h4 className="pq-past-title-row">
        지난 퀴즈
        <span className="pq-past-count">{list ? past.length : "…"}</span>
      </h4>
      {list === null ? (
        <p className="pq-past-empty">불러오는 중…</p>
      ) : past.length === 0 ? (
        <p className="pq-past-empty">지난 퀴즈가 없어요.</p>
      ) : (
        <ul className="pq-past-list">
          {past.map((q) => {
            const a = answers[q.id];
            return (
              <li key={q.id} className="open">
                <div className="pq-past-body">
                  {/* 물음의 아래 줄이 프로젝트 · 날짜 · '마침'을 적습니다 */}
                  <PopQuizQuestion quiz={q} />
                  {a === undefined ? (
                    <p className="pq-past-empty">불러오는 중…</p>
                  ) : (
                    <div className="pq-mine">
                      <div className="pq-mine-head">
                        <span>선생님과 나눈 말</span>
                        <PopQuizStatus answer={a} quizOpen={!!q.open} />
                      </div>
                      {a ? <PopQuizThread answer={a} viewer="student" /> : null}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
