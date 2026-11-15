"use client";
// =============================================================
// 관리자 설정 — 펫 먹이의 '읽은 날' 기준 (선생님 요청 · 2026년 11월)
// -------------------------------------------------------------
// 그날 남긴 독서 발자국을 합쳐 **이 쪽수 · 글자 수 이상**이면 그날은 펫의 배부름이 줄지 않습니다(lib/petCare.js의
// readingDayProof). 처음에는 5쪽 · 250자로 못 박혀 있었는데, 학년 · 읽는 책에 맞게 **선생님이 직접 정합니다**.
//   · 쪽수 1~100 · 글자 수 0~2000(정수 — 0이면 글자 수는 보지 않음. 발자국에는 감상이 꼭 있어야 해서 한 줄은 씀).
//     범위는 lib/petCare.js의 CARE_READ_* 와 firestore.rules가 같은 값을 봅니다.
//   · 다른 설정처럼 선생님의 **운영 중인 반 모두에 한 값**이고(setTeacherPetReadRule — 한 묶음), 새 반도 따릅니다.
//   · '저장'을 눌러야 적용됩니다(되돌리기로 고치던 값을 버림) — 칸에 적는 도중의 수(예: '1' 다음 '15')가 저장되지 않게.
//   · 바꾼 기준은 그 뒤에 저장하는 독서 기록부터 셉니다 — 오늘 이미 '읽은 날'이 된 학생은 그대로이고, 다시 저장하면 새 기준으로 셈.
//   · 기준을 미리 정해 둘 수 있습니다(펫 먹이를 켜기 전에도) — 학생 펫이 꺼져 있으면 칸이 쉽니다.
// =============================================================
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { setTeacherPetReadRule } from "@/lib/store";
import {
  CARE_READ_CHARS, CARE_READ_CHARS_MAX, CARE_READ_CHARS_MIN, CARE_READ_PAGES, CARE_READ_PAGES_MAX, CARE_READ_PAGES_MIN,
  careReadLabel, isCareReadChars, isCareReadPages, teacherPetReadSettings,
} from "@/lib/petCare";

// 칸의 글자 → 정수(빈칸 · 숫자가 아닌 것은 NaN). 앞뒤 공백 · 쉼표(1,000)는 받아 줍니다.
const toInt = (text) => {
  const clean = String(text ?? "").replace(/[\s,]/g, "");
  return /^\d+$/.test(clean) ? Number(clean) : NaN;
};

export default function PetReadSettings({ classes = [], feedOn = false, ready = true, onToast }) {
  const id = useId();
  const ids = useMemo(() => classes.map((c) => c.id), [classes]);
  const saved = useMemo(() => teacherPetReadSettings(classes), [classes]);
  const savedKey = `${saved.pages}/${saved.chars}`;
  const [pages, setPages] = useState(() => String(saved.pages));
  const [chars, setChars] = useState(() => String(saved.chars));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = { pages: toInt(pages), chars: toInt(chars) };
  const pagesProblem = isCareReadPages(draft.pages) ? "" : `쪽수는 ${CARE_READ_PAGES_MIN}~${CARE_READ_PAGES_MAX} 사이의 정수로 적어 주세요`;
  const charsProblem = isCareReadChars(draft.chars) ? "" : `글자 수는 ${CARE_READ_CHARS_MIN}~${CARE_READ_CHARS_MAX.toLocaleString("ko-KR")} 사이의 정수로 적어 주세요`;
  const valid = !pagesProblem && !charsProblem;
  const dirty = `${pages.trim()}/${chars.trim()}` !== savedKey;
  // 저장된 값이 바뀌면(저장 뒤 · 다른 창에서 고침) 고치던 것이 없을 때만 따라갑니다
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (dirtyRef.current) return;
    const [p, c] = savedKey.split("/");
    setPages(p);
    setChars(c);
  }, [savedKey]);

  const isDefault = draft.pages === CARE_READ_PAGES && draft.chars === CARE_READ_CHARS;
  const shown = valid ? careReadLabel(draft) : careReadLabel(saved);
  const hint = !ready ? "학생 펫을 먼저 켜 주세요."
    : `그날 남긴 독서 발자국을 합쳐 ${shown} 이상이면 그날은 펫의 배부름이 줄지 않아요.${feedOn ? "" : " 펫 먹이를 켜면 적용돼요."}`;

  function revert() {
    setPages(String(saved.pages));
    setChars(String(saved.chars));
    setError("");
  }
  function useDefault() {
    setPages(String(CARE_READ_PAGES));
    setChars(String(CARE_READ_CHARS));
    setError("");
  }
  async function save() {
    if (busy || !valid || !ready) return;
    setBusy(true);
    setError("");
    try {
      await setTeacherPetReadRule(ids, draft);
      onToast?.(`펫의 ‘읽은 날’ 기준을 ${careReadLabel(draft)} 이상으로 저장했어요.${ids.length > 1 ? ` (반 ${ids.length}개 모두)` : ""}`);
    } catch (e) {
      setError(e?.message || "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); save(); }
  };

  return (
    <section className={`adm-group adm-rest-group adm-read-group${ready ? "" : " is-off"}`} aria-labelledby={`${id}-title`}>
      <header className="adm-group-head">
        <h3 id={`${id}-title`}>배부름이 줄지 않는 독서량</h3>
        <span>그날 독서 발자국의 쪽수와 글자 수를 정해요</span>
      </header>
      <div className="adm-rest">
        <p className="adm-rest-hint" id={`${id}-hint`}>
          {hint}
          {saved.mixed && <strong> 반마다 다르게 저장되어 있어요 — 저장하면 모든 반을 같게 맞춰요.</strong>}
        </p>
        <div className="adm-read-fields">
          <label className={`adm-read-field${pagesProblem ? " is-bad" : ""}`}>
            <span className="adm-read-label">읽은 쪽수</span>
            <span className="adm-read-input">
              <input type="number" inputMode="numeric" min={CARE_READ_PAGES_MIN} max={CARE_READ_PAGES_MAX} step={1} value={pages}
                disabled={!ready || busy} aria-invalid={!!pagesProblem} aria-describedby={`${id}-hint`}
                onChange={(e) => setPages(e.target.value)} onKeyDown={onKeyDown} />
              <span>쪽 이상</span>
            </span>
          </label>
          <label className={`adm-read-field${charsProblem ? " is-bad" : ""}`}>
            <span className="adm-read-label">감상 글자 수</span>
            <span className="adm-read-input">
              <input type="number" inputMode="numeric" min={CARE_READ_CHARS_MIN} max={CARE_READ_CHARS_MAX} step={10} value={chars}
                disabled={!ready || busy} aria-invalid={!!charsProblem} aria-describedby={`${id}-hint`}
                onChange={(e) => setChars(e.target.value)} onKeyDown={onKeyDown} />
              <span>자 이상</span>
            </span>
          </label>
        </div>
        {(pagesProblem || charsProblem) && <p className="adm-rest-problem" role="alert">{pagesProblem || charsProblem}</p>}
        <div className="adm-rest-tools">
          <button type="button" className="btn-ghost adm-rest-add" disabled={!ready || busy || isDefault} onClick={useDefault}>
            처음 값으로 ({CARE_READ_PAGES}쪽 · {CARE_READ_CHARS}자)
          </button>
          {dirty && (
            <span className="adm-rest-save">
              <button type="button" className="btn-ghost" disabled={busy} onClick={revert}>되돌리기</button>
              <button type="button" className="btn-primary" disabled={!ready || busy || !valid} onClick={save}>{busy ? "저장 중…" : "저장"}</button>
            </span>
          )}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="adm-rest-foot">여러 번에 나눠 남겨도 그날 것을 합쳐서 세요. 쪽수는 새로 읽은 쪽만 셉니다(이미 기록한 쪽은 빼고). 글자 수를 0으로 두면 쪽수만 봐요. 바꾼 기준은 그 뒤에 남기는 독서 발자국부터 적용돼요.</p>
      </div>
    </section>
  );
}
