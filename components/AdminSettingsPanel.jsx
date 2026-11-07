"use client";
// =============================================================
// 관리자 설정 — /books?area=settings (교사만)
// 반마다 켜고 끄는 기능을 한 화면에 모읍니다. 지금은 셋:
//   · 책나눔 성장 기능(readingEnabled — 기본 꺼짐)
//   · 랭킹 시스템(rankingEnabled — 값이 없으면 켜짐, 책나눔이 켜져 있어야 의미가 있음)
//   · 학생 캐릭터(characterEnabled — 값이 없으면 켜짐, 리더보드의 '캐릭터 꾸미기'라
//     랭킹이 켜져 있어야 의미가 있음 · lib/readingCharacter.js)
// 쓰기는 반 문서 한 칸이고, 규칙(readingSettingValid)이 참·거짓과 보관 안 된 반만 받습니다.
// =============================================================
import { useMemo, useState } from "react";
import { setClassReadingEnabled, setClassRankingEnabled, setClassCharacterEnabled } from "@/lib/store";
import { characterChoiceEnabled } from "@/lib/readingCharacter";
import { readingEnabled, rankingEnabled } from "@/lib/reading";

const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko", { numeric: true });

function Switch({ on, disabled, busy, label, describedBy, onClick }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} aria-describedby={describedBy}
      className={`adm-switch ${on ? "on" : ""}`} disabled={disabled || busy} onClick={onClick}>
      <span className="adm-switch-track" aria-hidden="true"><span className="adm-switch-knob" /></span>
      <span className="adm-switch-text">{busy ? "저장 중…" : on ? "켜짐" : "꺼짐"}</span>
    </button>
  );
}

export default function AdminSettingsPanel({ classes = [], onToast }) {
  const rows = useMemo(() => classes.filter((c) => !c.archived).slice().sort(byName), [classes]);
  const [busy, setBusy] = useState({}); // { "반id:key": true }
  const [error, setError] = useState("");

  async function toggle(c, key) {
    const k = `${c.id}:${key}`;
    if (busy[k]) return;
    const reading = key === "readingEnabled";
    const enabled = reading ? !readingEnabled(c) : key === "rankingEnabled" ? !rankingEnabled(c) : !characterChoiceEnabled(c);
    setBusy((b) => ({ ...b, [k]: true }));
    setError("");
    try {
      if (reading) await setClassReadingEnabled(c.id, enabled);
      else if (key === "rankingEnabled") await setClassRankingEnabled(c.id, enabled);
      else await setClassCharacterEnabled(c.id, enabled);
      onToast?.(key === "characterEnabled"
        ? (enabled ? `'${c.name}' 반 학생이 리더보드에서 캐릭터를 고를 수 있어요.` : `'${c.name}' 반의 캐릭터 고르기를 껐어요. 모두 기본 캐릭터로 보이고, 고른 캐릭터는 보관됩니다.`)
        : reading
        ? (enabled ? `'${c.name}' 반의 책나눔 성장 기능을 켰어요.` : `'${c.name}' 반의 책나눔 성장 기능을 껐어요. 기존 기록은 보관됩니다.`)
        : (enabled ? `'${c.name}' 반의 랭킹 시스템을 켰어요.` : `'${c.name}' 반의 랭킹 시스템을 껐어요. 리더보드와 우리 반 랭킹이 숨겨져요.`));
    } catch (e) {
      setError(e?.message || "설정을 저장하지 못했어요.");
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[k]; return n; });
    }
  }

  return (
    <section className="adm-settings" aria-label="관리자 설정">
      <p className="adm-settings-lead">반마다 기능을 켜고 끕니다. 바꾸면 그 반의 학생 화면에 곧바로 반영돼요.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {rows.length === 0 ? (
        <p className="adm-settings-empty">운영 중인 반이 없어요. 반 관리하기에서 반을 만들어 주세요.</p>
      ) : (
        <div className="adm-table" role="table" aria-label="반별 기능 설정">
          <div className="adm-row adm-head" role="row">
            <span role="columnheader">반</span>
            <span role="columnheader">책나눔 성장 기능
              <small id="adm-hint-reading">내 서재 · 경험치 · 뱃지 · 랭킹. 꺼도 독서 활동은 그대로예요.</small></span>
            <span role="columnheader">랭킹 시스템
              <small id="adm-hint-ranking">상단바 리더보드 · 우리 반 랭킹. 책나눔이 켜져 있어야 써요.</small></span>
            <span role="columnheader">학생 캐릭터
              <small id="adm-hint-character">리더보드에서 학생이 동물 캐릭터를 골라요. 끄면 모두 기본 캐릭터예요. 랭킹이 켜져 있어야 써요.</small></span>
          </div>
          {rows.map((c) => {
            const readOn = readingEnabled(c);
            const rankOn = readOn && rankingEnabled(c);
            return (
              <div className="adm-row" role="row" key={c.id}>
                <span className="adm-class" role="cell">{c.name}</span>
                <span role="cell">
                  <Switch on={readOn} busy={busy[`${c.id}:readingEnabled`]} describedBy="adm-hint-reading"
                    label={`${c.name} 책나눔 성장 기능`} onClick={() => toggle(c, "readingEnabled")} />
                </span>
                <span role="cell" title={readOn ? undefined : "책나눔 성장 기능을 먼저 켜 주세요"}>
                  <Switch on={readOn && rankingEnabled(c)} disabled={!readOn} busy={busy[`${c.id}:rankingEnabled`]}
                    describedBy="adm-hint-ranking" label={`${c.name} 랭킹 시스템`} onClick={() => toggle(c, "rankingEnabled")} />
                </span>
                <span role="cell" title={rankOn ? undefined : "책나눔과 랭킹 시스템을 먼저 켜 주세요"}>
                  <Switch on={rankOn && characterChoiceEnabled(c)} disabled={!rankOn} busy={busy[`${c.id}:characterEnabled`]}
                    describedBy="adm-hint-character" label={`${c.name} 학생 캐릭터`} onClick={() => toggle(c, "characterEnabled")} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="adm-settings-foot">보관된 반은 바꿀 수 없어 목록에서 뺐어요. 설정은 앞으로 이 화면에 더해 갑니다.</p>
    </section>
  );
}
