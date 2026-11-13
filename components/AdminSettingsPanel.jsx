"use client";
// =============================================================
// 관리자 설정 — /books?area=settings (교사만)
// 선생님의 **모든 운영 중인 반에 같은 값**으로 켜고 끕니다(선생님 요청 — 한때 반마다
// 한 줄씩 따로였음). 값은 지금처럼 반 문서마다 적습니다 — 서버 API · 규칙 · 학생 화면이
// 반 문서를 읽기 때문입니다(setTeacherFeature가 한 묶음으로 씀). 새 반은 만들 때
// 같은 값을 따릅니다(addClass의 features · lib/reading.js featuresForNewClass).
//   · 책나눔 성장 기능(readingEnabled — 기본 꺼짐)
//   · 도서 검색(bookSearchEnabled — 기본 꺼짐, 카카오 REST API 키가 있어야 씀. 끄면 책꽂이
//     새 책 등록이 직접 입력만, 켜면 '도서 검색' 단추가 섬)
//   · 리더보드(rankingEnabled — 값이 없으면 켜짐). 상단바 리더보드 화면만 켜고 끕니다(선생님 요청 — 한때 이름이
//     '랭킹 시스템'). 경험치 · 레벨 · 순위 집계와 책나눔의 '우리 반 랭킹' 탭은 책나눔만 켜지면 늘 돕니다.
//   · 독서 TOP 3(readingTopEnabled — 값이 없으면 켜짐, 책나눔이 켜져 있어야 씀). 상단바 가운데의 이번 주 TOP 3를
//     보이고 숨깁니다(선생님 요청 — 한때 리더보드 스위치를 함께 따랐음 · 판정 lib/reading.js의 readingTopOn).
//   · 학생 캐릭터(characterEnabled — 값이 없으면 켜짐, 책나눔이 켜져 있어야 씀. 리더보드를 꺼도 '내 프로필'에서 고름)
//   · 과일 바구니(fruitBasketEnabled — 값이 없으면 켜짐, 끄면 떠 있는 동그라미에서도 가림)
//   · 학생 펫(petEnabled — 값이 없으면 켜짐, 책나눔이 켜져 있어야 씀 · lib/readingPet.js)
//   · 책 광장(plazaEnabled — 기본 꺼짐, 책나눔이 켜져 있어야 씀 · lib/readingPlaza.js). 켜면 책나눔의 셋째 탭이
//     '우리 반 랭킹' 대신 '책 광장'이 되고, 켠 뒤에 쓴 독서 발자국 · 꽂은 한 권의 책이 반 친구에게 보입니다.
//   · 교실(classroomEnabled — 기본 꺼짐, 책 광장이 켜져 있어야 씀 · lib/readingClassroom.js). 켜면 책 광장에 교실로 가는
//     문과 포털이 생기고, 학생이 자리표의 제 책상에 앉아 있으면 선생님이 칠판에서 출석을 확인합니다(선생님 요청).
//   · 독서 맵(readingMapTheme — 모험 · 대륙)
// 쓰기는 반 문서의 설정 칸이고, 규칙이 값과 보관 안 된 반만 받습니다.
// =============================================================
import { Fragment, useId, useMemo, useState } from "react";
import { setTeacherFeature, setTeacherReadingMapTheme } from "@/lib/store";
import { teacherFeatureSettings } from "@/lib/reading";
import { READING_MAP_THEMES, readingMapThemeSettings } from "@/lib/readingMapCatalog";

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
  { key: "readingEnabled", label: "책나눔 성장 기능", hint: "책꽂이 · 경험치 · 레벨업 · 뱃지 · 우리 반 랭킹이 함께 켜져요. 꺼도 독서 활동은 그대로예요.",
    on: "책나눔 성장 기능을 켰어요.", off: "책나눔 성장 기능을 껐어요. 기존 기록은 보관됩니다." },
  { key: "bookSearchEnabled", label: "도서 검색", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "책꽂이에 책을 담을 때 카카오 책 검색으로 표지 · 정보를 채워요. 카카오 REST API 키가 있어야 써요. 끄면 직접 입력만 해요.",
    on: "도서 검색을 켰어요. 책꽂이의 새 책 등록에 '도서 검색' 단추가 생겨요.", off: "도서 검색을 껐어요. 책 정보는 직접 입력해요." },
  { key: "rankingEnabled", label: "리더보드", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "상단바 리더보드(독서 맵 · 독서 랭킹)를 보여요. 꺼도 경험치 · 레벨과 책나눔의 '우리 반 랭킹'은 그대로예요.",
    on: "리더보드를 켰어요. 그동안 쌓인 순위가 곧바로 보여요.", off: "리더보드를 껐어요. 상단바 리더보드만 숨고, '우리 반 랭킹'과 경험치 · 레벨은 그대로예요." },
  { key: "readingTopEnabled", label: "독서 TOP 3", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "상단바 가운데에 이번 주 우리 반 독서 TOP 3(캐릭터 · 레벨 · 이름)를 보여요. 월요일 아침마다 바뀌어요.",
    on: "독서 TOP 3를 켰어요. 상단바 가운데에 이번 주 TOP 3가 보여요.", off: "독서 TOP 3를 껐어요. 상단바에서만 숨고, 순위 셈은 그대로예요." },
  { key: "characterEnabled", label: "학생 캐릭터", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "학생이 캐릭터를 골라요(리더보드 · 내 프로필). 끄면 모두 기본 캐릭터예요.",
    on: "학생이 캐릭터를 고를 수 있어요.", off: "캐릭터 고르기를 껐어요. 모두 기본 캐릭터로 보이고, 고른 캐릭터는 보관됩니다." },
  { key: "fruitBasketEnabled", label: "과일 바구니",
    hint: "학생이 받은 과일을 바구니에 담아 이벤트에 응모해요. 끄면 오른쪽 아래 동그라미 메뉴에서도 가려져요.",
    on: "과일 바구니를 켰어요.", off: "과일 바구니를 껐어요. 담긴 과일과 응모 기록은 보관됩니다." },
  { key: "petEnabled", label: "학생 펫", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "학생마다 알을 하나씩 받아 독서 경험치로 키워요. 책나눔 · 리더보드 · 내 프로필에 보여요. 선생님은 펫이 없어요.",
    on: "학생 펫을 켰어요. 학생마다 알을 하나씩 받아요.", off: "학생 펫을 껐어요. 키우던 펫은 보관되고, 다시 켜면 그대로 이어져요." },
  { key: "plazaEnabled", label: "책 광장", needs: ["readingEnabled"], needsText: "책나눔 성장 기능을 먼저 켜 주세요",
    hint: "책나눔의 셋째 탭이 ‘우리 반 랭킹’ 대신 ‘책 광장’이 돼요. 켠 뒤에 쓰는 독서 발자국과 학생이 광장 책꽂이에 꽂은 ‘한 권의 책’을 반 친구들이 읽고 댓글을 남겨요. 순위는 상단바 리더보드에서 봐요.",
    on: "책 광장을 켰어요. 지금부터 쓰는 독서 발자국이 광장에 보여요.", off: "책 광장을 껐어요. 광장의 글과 댓글은 보관되고, 책나눔에는 ‘우리 반 랭킹’ 탭이 다시 서요." },
  { key: "classroomEnabled", label: "교실", needs: ["readingEnabled", "plazaEnabled"], needsText: "책 광장을 먼저 켜 주세요",
    hint: "책 광장에 교실로 가는 문과 포털이 생겨요. 학생이 ‘자리 배정하기’의 제 책상 옆에서 A → 앉기(S)로 앉고, 선생님이 칠판 앞에서 A → 출석시작(S)을 누르면 그 순간 앉아 있던 학생만 출석으로 확인돼요.",
    on: "교실을 켰어요. 책 광장 왼쪽 아래의 포털로 교실에 들어가요.", off: "교실을 껐어요. 책 광장의 문과 포털이 사라지고, 출석 기록은 그대로예요." },
];

// 성격이 같은 것끼리 묶습니다(선생님 요청 — 2 · 4 · 1, 2026년 11월 '함께 읽기'(책 광장) 한 묶음을 더함). 리더보드 옆에 독서 TOP 3(보이는 화면 둘), 그 아래 줄에
// 학생 캐릭터 · 학생 펫(꾸미기 둘)이 섭니다. 학생 펫은 캐릭터 옆에 함께 서는 꾸미기라
// '리더보드 · 꾸미기'(한때 '랭킹 · 꾸미기')에 둡니다(선생님 요청 — 한때 과일 바구니 옆 '교실 보상'에 두어 2 · 2 · 2였음).
// 카드 칸은 늘 두 칸 격자라 이 묶음만 카드가 두 줄로 섭니다.
const GROUPS = [
  { key: "reading", title: "독서 기록", desc: "학생의 책꽂이와 책 정보", keys: ["readingEnabled", "bookSearchEnabled"] },
  { key: "growth", title: "리더보드 · 꾸미기", desc: "반 친구와 함께 보는 성장 · 캐릭터와 펫", keys: ["rankingEnabled", "readingTopEnabled", "characterEnabled", "petEnabled"] },
  { key: "share", title: "함께 읽기", desc: "반 친구와 나누는 독서 발자국 · 한 권의 책 · 함께 앉는 교실", keys: ["plazaEnabled", "classroomEnabled"] },
  { key: "reward", title: "교실 보상", desc: "과일 모으기와 이벤트", keys: ["fruitBasketEnabled"] },
];

export default function AdminSettingsPanel({ classes = [], onToast }) {
  const rows = useMemo(() => classes.filter((c) => !c.archived).slice().sort(byName), [classes]);
  const settings = useMemo(() => teacherFeatureSettings(rows), [rows]);
  const mapSetting = useMemo(() => readingMapThemeSettings(rows), [rows]);
  const mapId = useId();
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

  async function chooseMap(theme) {
    if (busy || (!mapSetting.mixed && mapSetting.value === theme.id)) return;
    setBusy(`readingMapTheme:${theme.id}`);
    setError("");
    try {
      await setTeacherReadingMapTheme(rows.map((c) => c.id), theme.id);
      onToast?.(`독서 맵을 ‘${theme.name}’으로 바꿨어요.${rows.length > 1 ? ` (반 ${rows.length}개 모두)` : ""}`);
    } catch (e) {
      setError(e?.message || "독서 맵을 저장하지 못했어요.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="adm-settings" aria-label="관리자 설정">
      <p className="adm-settings-lead">
        선택한 설정은 선생님의 <strong>모든 반</strong>에 같이 적용되고, 학생 화면에 곧바로 반영돼요.
        {rows.length > 0 && <span className="adm-settings-classes"> 적용되는 반: {rows.map((c) => c.name).join(" · ")}</span>}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {rows.length === 0 ? (
        <p className="adm-settings-empty">운영 중인 반이 없어요. 반 관리하기에서 반을 만들어 주세요.</p>
      ) : (
        <div className="adm-groups">
          {GROUPS.map((g) => (
            <Fragment key={g.key}>
            <section className={`adm-group adm-group--${g.keys.length}`} aria-labelledby={`adm-group-${g.key}`}>
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
                <Switch on={ready && st.on} disabled={!ready || !!busy} busy={busy === f.key} describedBy={`adm-hint-${f.key}`}
                  label={f.label} onClick={() => toggle(f)} />
              </li>
            );
          })}
              </ul>
            </section>
            {g.key === "growth" && (
              <section className="adm-group adm-map-group" aria-labelledby={`${mapId}-title`}>
                <header className="adm-group-head">
                  <h3 id={`${mapId}-title`}>독서 맵</h3>
                  <span>캐릭터와 함께 걸을 지도</span>
                </header>
                <div className="adm-map-picker" role="radiogroup" aria-labelledby={`${mapId}-title`}
                  aria-describedby={`${mapId}-hint`} aria-busy={busy.startsWith("readingMapTheme:")}>
                  <p className="adm-map-picker-hint" id={`${mapId}-hint`}>
                    {settings.readingEnabled.on && settings.rankingEnabled.on
                      ? "선택한 지도는 리더보드의 ‘독서 맵’에 보여요."
                      : "지도를 미리 골라 두세요. 책나눔 성장 기능과 리더보드를 켜면 보여요."}
                  </p>
                  {mapSetting.mixed && <p className="adm-map-picker-mixed">반마다 지도가 달라요. 하나를 고르면 모든 반에 같이 적용돼요.</p>}
                  <div className="adm-map-options">
                    {READING_MAP_THEMES.map((theme) => {
                      const selected = !mapSetting.mixed && mapSetting.value === theme.id;
                      const saving = busy === `readingMapTheme:${theme.id}`;
                      const descriptionId = `${mapId}-${theme.id}-description`;
                      const previewSrc = theme.preview || theme.image;
                      return (
                        <label key={theme.id} className={`adm-map-option${selected ? " is-selected" : ""}${busy ? " is-busy" : ""}`}>
                          <img src={previewSrc} alt={theme.alt} width={384} height={256} loading="lazy" decoding="async" />
                          <span className="adm-map-option-body">
                            <span className="adm-map-option-head">
                              <input type="radio" name={`${mapId}-theme`} value={theme.id} checked={selected} disabled={!!busy}
                                aria-label={theme.name} aria-describedby={descriptionId} onChange={() => chooseMap(theme)} />
                              <strong>{theme.name}</strong>
                              <span className="adm-map-option-state">{saving ? "저장 중…" : selected ? "선택됨" : "선택하기"}</span>
                            </span>
                            <span className="adm-map-option-description" id={descriptionId}>{theme.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
            </Fragment>
          ))}
        </div>
      )}
      <p className="adm-settings-foot">보관된 반은 바꿀 수 없어 빼고 적용해요. 새로 만드는 반도 지금 설정을 따라요.</p>
    </section>
  );
}
