"use client";
// =============================================================
// 관리자 설정 — /books?area=settings (교사만)
// 선생님의 **모든 운영 중인 반에 같은 값**으로 켜고 끕니다(선생님 요청 — 한때 반마다
// 한 줄씩 따로였음). 값은 지금처럼 반 문서마다 적습니다 — 서버 API · 규칙 · 학생 화면이
// 반 문서를 읽기 때문입니다(setTeacherFeature가 한 묶음으로 씀). 새 반은 만들 때
// 같은 값을 따릅니다(addClass의 features · lib/reading.js featuresForNewClass).
//   · 책나눔 성장 기능(readingEnabled — 기본 꺼짐)
//   · 도서 검색(bookSearchEnabled — 기본 꺼짐, 카카오 REST API 키가 있어야 씀. 끄면 내 서재
//     새 책 등록이 직접 입력만, 켜면 '도서 검색' 단추가 섬)
//   · 랭킹 시스템(rankingEnabled — 값이 없으면 켜짐)
//   · 학생 캐릭터(characterEnabled — 값이 없으면 켜짐, 랭킹이 켜져 있어야 의미가 있음)
//   · 과일 바구니(fruitBasketEnabled — 값이 없으면 켜짐, 끄면 떠 있는 동그라미에서도 가림)
// 쓰기는 반 문서 한 칸씩이고, 규칙(readingSettingValid)이 참·거짓과 보관 안 된 반만 받습니다.
// =============================================================
import { useMemo, useState } from "react";
import { setTeacherFeature } from "@/lib/store";
import { teacherFeatureSettings } from "@/lib/reading";

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

const FEATURES = [
  { key: "readingEnabled", label: "책나눔 성장 기능", hint: "내 서재 · 경험치 · 뱃지 · 랭킹. 꺼도 독서 활동은 그대로예요.",
    on: "책나눔 성장 기능을 켰어요.", off: "책나눔 성장 기능을 껐어요. 기존 기록은 보관됩니다." },
  { key: "bookSearchEnabled", label: "도서 검색", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "내 서재에 책을 담을 때 카카오 책 검색으로 표지 · 정보를 채워요. 카카오 REST API 키가 있어야 써요. 끄면 직접 입력만 해요.",
    on: "도서 검색을 켰어요. 내 서재 새 책 등록에 '도서 검색' 단추가 생겨요.", off: "도서 검색을 껐어요. 책 정보는 직접 입력해요." },
  { key: "rankingEnabled", label: "랭킹 시스템", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "상단바 리더보드 · 우리 반 랭킹. 책나눔이 켜져 있어야 써요.",
    on: "랭킹 시스템을 켰어요.", off: "랭킹 시스템을 껐어요. 리더보드와 우리 반 랭킹이 숨겨져요." },
  { key: "characterEnabled", label: "학생 캐릭터", needs: ["readingEnabled", "rankingEnabled"], needsText: "책나눔과 랭킹 시스템을 먼저 켜 주세요",
    hint: "리더보드에서 학생이 동물 캐릭터를 골라요. 끄면 모두 기본 캐릭터예요. 랭킹이 켜져 있어야 써요.",
    on: "학생이 리더보드에서 캐릭터를 고를 수 있어요.", off: "캐릭터 고르기를 껐어요. 모두 기본 캐릭터로 보이고, 고른 캐릭터는 보관됩니다." },
  { key: "fruitBasketEnabled", label: "과일 바구니",
    hint: "학생이 받은 과일을 바구니에 담아 이벤트에 응모해요. 끄면 오른쪽 아래 동그라미 메뉴에서도 가려져요.",
    on: "과일 바구니를 켰어요.", off: "과일 바구니를 껐어요. 담긴 과일과 응모 기록은 보관됩니다." },
];

// 성격이 같은 것끼리 세 묶음(선생님 요청 — 2 · 2 · 1).
const GROUPS = [
  { key: "reading", title: "독서 기록", desc: "학생의 서재와 책 정보", keys: ["readingEnabled", "bookSearchEnabled"] },
  { key: "growth", title: "랭킹 · 꾸미기", desc: "반 친구와 함께 보는 성장", keys: ["rankingEnabled", "characterEnabled"] },
  { key: "reward", title: "교실 보상", desc: "과일 모으기와 이벤트", keys: ["fruitBasketEnabled"] },
];

export default function AdminSettingsPanel({ classes = [], onToast }) {
  const rows = useMemo(() => classes.filter((c) => !c.archived).slice().sort(byName), [classes]);
  const settings = useMemo(() => teacherFeatureSettings(rows), [rows]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function toggle(f) {
    if (busy) return;
    // 반마다 달랐으면(mixed) 켜짐이 아닌 것으로 보이므로 누르면 모두 켭니다.
    const enabled = !settings[f.key].on;
    setBusy(f.key);
    setError("");
    try {
      await setTeacherFeature(rows.map((c) => c.id), f.key, enabled);
      onToast?.(`${enabled ? f.on : f.off}${rows.length > 1 ? ` (반 ${rows.length}개 모두)` : ""}`);
    } catch (e) {
      setError(e?.message || "설정을 저장하지 못했어요.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="adm-settings" aria-label="관리자 설정">
      <p className="adm-settings-lead">
        기능을 켜고 끄면 선생님의 <strong>모든 반</strong>에 같이 적용되고, 학생 화면에 곧바로 반영돼요.
        {rows.length > 0 && <span className="adm-settings-classes"> 적용되는 반: {rows.map((c) => c.name).join(" · ")}</span>}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {rows.length === 0 ? (
        <p className="adm-settings-empty">운영 중인 반이 없어요. 반 관리하기에서 반을 만들어 주세요.</p>
      ) : (
        <div className="adm-groups">
          {GROUPS.map((g) => (
            <section key={g.key} className={`adm-group adm-group--${g.keys.length}`} aria-labelledby={`adm-group-${g.key}`}>
              <header className="adm-group-head"><h3 id={`adm-group-${g.key}`}>{g.title}</h3><span>{g.desc}</span></header>
              <ul className="adm-features">
          {g.keys.map((k) => FEATURES.find((f) => f.key === k)).map((f) => {
            const ready = (f.needs || []).every((k) => settings[k].on);
            const st = settings[f.key];
            return (
              <li key={f.key} className={`adm-feature${ready ? "" : " is-off"}`} title={ready ? undefined : f.needsText}>
                <div className="adm-feature-text">
                  <strong>{f.label}</strong>
                  <small id={`adm-hint-${f.key}`}>{f.hint}</small>
                  {st.mixed && <small className="adm-feature-mixed">반마다 다르게 켜져 있어요 — 누르면 모든 반을 같게 맞춰요.</small>}
                </div>
                <Switch on={ready && st.on} disabled={!ready} busy={busy === f.key} describedBy={`adm-hint-${f.key}`}
                  label={f.label} onClick={() => toggle(f)} />
              </li>
            );
          })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="adm-settings-foot">보관된 반은 바꿀 수 없어 빼고 적용해요. 새로 만드는 반도 지금 설정을 따라요.</p>
    </section>
  );
}
