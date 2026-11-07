"use client";

// =============================================================
// 관리자 대시보드 — 학생 프로필 창 (왼쪽 사용자 목록에서 학생을 누르면)
// -------------------------------------------------------------
// users/{uid} 한 건을 읽어 이름 · 학번 · 이메일 · 닉네임 · 소속 반을 보여 주고,
// '편집'으로 이름 · 학번 · 이메일을 고칩니다(updateStudentProfile — 프로필 한 장만),
// 아래 '탈퇴'로 그 학생을 탈퇴시킵니다(lib/data/withdraw.js — 서버 없이).
// 탈퇴는 학생 이름을 그대로 적어야 실행되고, 되돌릴 수 없습니다.
// 다른 선생님 반에도 있는 학생은 탈퇴를 막고 '반에서 빼기'를 안내합니다.
// =============================================================
import { useEffect, useState } from "react";
import { checkWithdraw, fetchStudentProfile, syncStudentName, updateStudentProfile, withdrawStudent } from "@/lib/store";
import { purgeNameMatches } from "@/lib/classPurge";
import { Dialog, fullDate } from "./DashboardParts";

const BLOCK_TEXT = {
  "other-class": (names) => `다른 선생님 반(${names.join(" · ")})에도 있는 학생이라 탈퇴시킬 수 없어요. 내 반에서는 '반 관리하기'의 반에서 빼기를 써 주세요.`,
  "too-many": () => "반이 다섯 개 이상인 학생은 관리자만 탈퇴시킬 수 있어요.",
  "no-class": () => "어느 반 학생인지 확인할 수 없어 탈퇴시킬 수 없어요. 학생이 반에 한 번 더 들어오면 탈퇴시킬 수 있어요.",
  "not-student": () => "학생 계정만 탈퇴시킬 수 있어요.",
  "no-profile": () => "프로필을 찾지 못했어요. 이미 탈퇴한 학생일 수 있어요.",
  self: () => "자기 계정은 탈퇴시킬 수 없어요.",
};
const blockText = (reason, names = []) => (BLOCK_TEXT[reason] || (() => "탈퇴시킬 수 없어요."))(names);

function toDateText(v) {
  if (!v) return "";
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return fullDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PROFILE_NAME_MAX = 30;
export const PROFILE_ID_MAX = 20;

// 고친 값이 저장할 만한가 — 막히면 그 까닭(빈 문자열이면 저장 가능)
function draftProblem(d) {
  if (!d.realName.trim()) return "이름을 적어 주세요.";
  if (d.realName.trim().length > PROFILE_NAME_MAX) return `이름은 ${PROFILE_NAME_MAX}자까지 적을 수 있어요.`;
  if (d.studentId.trim().length > PROFILE_ID_MAX) return `학번은 ${PROFILE_ID_MAX}자까지 적을 수 있어요.`;
  if (d.email.trim() && !EMAIL_RE.test(d.email.trim())) return "이메일 주소 모양을 확인해 주세요.";
  return "";
}

export default function StudentProfileDialog({ student, myClasses, onClose, onWithdrawn, onUpdated }) {
  const [profile, setProfile] = useState(undefined); // undefined = 읽는 중, null = 없음
  const [check, setCheck] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null); // null = 보기, 객체 = 편집 중
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(""); // 저장한 뒤 한 줄 안내
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchStudentProfile(student.uid, myClasses)
      .then(async (p) => {
        if (!alive) return;
        setProfile(p);
        const c = await checkWithdraw(p, myClasses);
        if (alive) setCheck(c);
      })
      .catch(() => { if (alive) { setProfile(null); setCheck({ ok: false, reason: "no-profile" }); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 학생이 바뀔 때만 다시 읽습니다(반 목록 구독이 바뀌어도 그대로)
  }, [student.uid]);

  const name = profile?.realName || student.name || "";
  const ok = purgeNameMatches(typed, name);

  async function run() {
    if (!ok || running) return;
    setRunning(true);
    setError("");
    try {
      await withdrawStudent(student.uid, myClasses, setStep);
      onWithdrawn?.(name);
    } catch (e) {
      console.warn("[탈퇴] 멈췄어요:", e?.code, e?.message);
      setError(e?.classNames || BLOCK_TEXT[e?.code]
        ? blockText(e.code, e.classNames)
        : "탈퇴 처리 도중에 멈췄어요. 남은 기록은 그대로이니 다시 누르면 이어서 지웁니다.");
      setRunning(false);
      setStep(null);
    }
  }

  function startEdit() {
    setDraft({ realName: profile.realName || student.name || "", studentId: profile.studentId || student.studentId || "", email: profile.email || "" });
    setSaveError("");
    setSaved("");
  }
  const problem = draft ? draftProblem(draft) : "";
  async function save() {
    if (!draft || problem || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const before = { name: profile.realName || "", sid: profile.studentId ?? null };
      const patch = await updateStudentProfile(student.uid, draft);
      setProfile((p) => ({ ...p, ...patch }));
      setDraft(null);
      onUpdated?.();
      // 이름 · 학번이 바뀌었으면 내 반 기록에 적혀 있던 옛 이름표도 맞춥니다
      if (patch.realName !== before.name || (patch.studentId ?? null) !== before.sid) {
        setSaved("저장했어요. 내 반 기록의 이름도 맞추는 중…");
        setSyncing(true);
        const r = await syncStudentName(student.uid, patch, myClasses).catch(() => ({ updated: 0, failed: 1 }));
        setSyncing(false);
        setSaved(r.failed
          ? `저장했어요. 기록 ${r.updated}곳의 이름을 바꿨고, ${r.failed}곳은 바꾸지 못했어요.`
          : `저장했어요. 내 반 기록 ${r.updated}곳의 이름도 바꿨어요.`);
        onUpdated?.();
      } else {
        setSaved("저장했어요.");
      }
    } catch (e) {
      console.warn("[학생 프로필] 저장 실패:", e?.code, e?.message);
      setSaveError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const rows = profile ? [
    ["이름", profile.realName || student.name],
    ["학번", profile.studentId || student.studentId],
    ["이메일", profile.email],
    ["닉네임", profile.displayName],
    ["소속 반", profile.classNames?.join(" · ")],
    ["가입일", toDateText(profile.createdAt)],
  ].filter(([, v]) => v) : [];

  return <Dialog title="학생 프로필" onClose={running || syncing ? () => {} : onClose}>
    <div className="bb-profile-head">
      <span className="bb-profile-avatar" aria-hidden="true">{profile?.emoji || student.emoji || "📖"}</span>
      <div>
        <strong>{name || "이름 미등록"}</strong>
        <span>{profile?.studentId || student.studentId || "학번 미등록"}</span>
      </div>
      {profile?.withdrawRequested && <span className="bb-profile-flag">탈퇴 신청함</span>}
    </div>

    {profile === undefined ? <p className="bb-profile-note" role="status">프로필을 불러오는 중입니다.</p>
      : profile === null ? <p className="bb-profile-note">프로필을 찾지 못했어요. 이미 탈퇴한 학생일 수 있어요.</p>
        : draft ? <form className="bb-profile-edit" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <dl className="bb-profile-rows">
            {[["realName", "이름", "text", PROFILE_NAME_MAX], ["studentId", "학번", "text", PROFILE_ID_MAX], ["email", "이메일", "email", 120]].map(([key, label, type, max]) => <div key={key}>
              <dt><label htmlFor={`bb-profile-${key}`}>{label}</label></dt>
              <dd><input
                id={`bb-profile-${key}`}
                type={type}
                value={draft[key]}
                maxLength={max}
                autoFocus={key === "realName"}
                autoComplete="off"
                disabled={saving}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              /></dd>
            </div>)}
          </dl>
          <p className="bb-profile-note">저장하면 내 반 기록(모둠 · 글 · 메모 · 댓글 · 메신저 …)에 적혀 있던 이름도 새 이름으로 맞춥니다. 다른 선생님 반 · 보관된 반의 기록은 그대로예요.</p>
          {(problem || saveError) && <p className="bb-profile-block" role="alert">{saveError || problem}</p>}
          <div className="bb-profile-actions">
            <button type="button" className="bb-dash-secondary" disabled={saving} onClick={() => { setDraft(null); setSaveError(""); }}>취소</button>
            <button type="submit" className="bb-dash-primary" disabled={!!problem || saving}>{saving ? "저장 중…" : "저장"}</button>
          </div>
        </form>
          : <>
            <dl className="bb-profile-rows">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <div className="bb-profile-edit-row">
              {saved && <span role="status">{saved}</span>}
              <button type="button" className="bb-dash-secondary" onClick={startEdit} disabled={running || syncing}>편집</button>
            </div>
          </>}

    {profile && !draft && <section className="bb-profile-danger" aria-label="탈퇴">
      {!confirming ? <>
        <p>탈퇴하면 내 반에 남은 이 학생의 글 · 기록 · 과일 · 출석과 프로필이 모두 지워지고 되돌릴 수 없습니다.</p>
        {check && !check.ok && <p className="bb-profile-block">{blockText(check.reason, check.classNames)}</p>}
        <button type="button" className="bb-profile-withdraw" disabled={!check?.ok || syncing} onClick={() => setConfirming(true)}>탈퇴</button>
      </> : <>
        <label htmlFor="bb-withdraw-name">확인하려면 학생 이름 <b>{name}</b>을(를) 그대로 적어 주세요.</label>
        <input
          id="bb-withdraw-name"
          type="text"
          value={typed}
          autoFocus
          autoComplete="off"
          placeholder={name}
          disabled={running}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) run(); }}
        />
        <p className="bb-profile-note">구글 로그인 기록만 Firebase 콘솔(Authentication)에 남습니다. 다시 로그인하면 아무 반에도 없는 새 학생으로 시작해요.</p>
        {running && <p className="bb-profile-step" role="status">지우는 중 ({Math.min((step?.done ?? 0) + 1, step?.total ?? 1)}/{step?.total ?? 1}) — 창을 닫지 말고 기다려 주세요.</p>}
        {error && <p className="bb-profile-block" role="alert">{error}</p>}
        <div className="bb-profile-actions">
          <button type="button" className="bb-dash-secondary" disabled={running} onClick={() => { setConfirming(false); setTyped(""); setError(""); }}>취소</button>
          <button type="button" className="bb-profile-withdraw" disabled={!ok || running} onClick={run}>{running ? "탈퇴 처리 중…" : "탈퇴시키기"}</button>
        </div>
      </>}
    </section>}
  </Dialog>;
}
