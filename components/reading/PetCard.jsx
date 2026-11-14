"use client";

// =============================================================
// 책나눔의 '나의 펫' 카드 — 머리말 오른쪽(대표 뱃지 옆)
// -------------------------------------------------------------
// 단계는 내 프로필의 readingPet(subscribeMyReadingPet)과 지금의 '독서로 얻은 경험치'
// (책나눔이 이미 받은 서재 — 부르는 쪽이 growthXp로 넘김)로 셉니다(lib/readingPet.js — 읽기 0).
// · 알: 경험치 100이 모이면 흔들리며 '알 깨우기' 단추가 섭니다 → 서버가 종을 알려 주고
//   깨어나는 장면(PetCelebration)이 뜹니다. 그 전에는 어떤 친구인지 비밀입니다.
// · 깨어난 펫: 단계가 오르면 '자랐어요!'가 한 번 뜹니다. 본 단계는 이 기기에 적어 둡니다
//   (localStorage — 다른 기기에서 처음 열면 지난 성장은 축하하지 않고 지금 단계부터 셈).
// · 축하는 창이 아닙니다(선생님 요청) — 과일 축포와 같은 폭죽 위에 새 모습을 띄웠다가 저절로
//   사라지고, 그동안에도 화면을 그대로 누를 수 있습니다. 한때 '좋아요'를 눌러 닫는 창이었습니다.
// 알이 아직 없으면(가입 직후 · 이 기능이 생긴 뒤 처음) 상단바와 같은 길로 알을 받습니다
// (ensureReadingPet — 한 번만 보냄).
//
// **펫 먹이**(관리자 설정의 '펫 먹이'를 켠 반 — lib/petCare.js · 선생님 요청)
// · 배부름(0~100)은 프로필의 펫(care)과 반 설정 · 오늘 날짜로 이 화면이 스스로 셉니다(읽기 0). 날마다 10씩 줄고,
//   과일 1개에 +10(자세히 보기의 '먹이 주기' — 과일이 펫에게 날아감), 오늘 발자국을 5쪽 · 250자 이상 남기면 유지.
// · 30 이하면 펫이 말풍선으로 배고프다고 말합니다. 0이 되면 먹이를 찾아 떠나고, 카드가 '다시 부르기'가 됩니다 —
//   읽은 날마다 한 걸음 · 과일 2개로도 한 걸음, 다 채우면 **같은 펫**이 돌아와 폭죽이 한 번 터집니다.
// · 알은 과일을 먹지 않습니다(책을 읽어 지킴).
// =============================================================
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { callReadingPet, ensureReadingPet, feedReadingPet, fetchMyReadingPet, hatchReadingPet, subscribeMyReadingPet } from "@/lib/data/reading";
import { getExpForReadingLevel, kstToday } from "@/lib/reading";
import { PET_HATCH_XP, PET_STAGES, petCheerKind, petProgress, petSpecies } from "@/lib/readingPet";
import { CARE_DAY_DROP, CARE_FRUIT, CARE_MAX, CARE_READ_CHARS, CARE_READ_PAGES, CARE_RETURN, CARE_STEP_FRUIT, careStatus } from "@/lib/petCare";
import { iGa } from "@/lib/korean";
import { backdropClose } from "@/lib/modal";
import RewardCelebration from "@/components/RewardCelebration";
import { flyFruits } from "@/components/fruitFly";
import PetFigure from "./PetFigure";
import "./pet.css";

const number = (v) => Number(v || 0).toLocaleString("ko-KR");
const seenKey = (uid) => `bookbom.pet.seen.v1:${encodeURIComponent(uid)}`;
function readSeen(uid) {
  try { return JSON.parse(window.localStorage.getItem(seenKey(uid)) || "null"); } catch { return null; }
}
function writeSeen(uid, progress) {
  try { window.localStorage.setItem(seenKey(uid), JSON.stringify({ species: progress.species ?? null, stage: progress.stage })); } catch { /* 저장이 막힌 기기 — 축하가 한 번 더 뜰 뿐 */ }
}

/** 펫의 이름 줄 — 알이면 '신비한 알'(종은 비밀). */
export function petTitle(progress) {
  const sp = progress?.hatched ? petSpecies(progress.species) : null;
  return sp ? `${sp.name} · ${sp.animal}` : "신비한 알";
}

/** 펫의 상태 한 줄 — 단계와 다음 단계까지. */
export function petStatusLine(progress) {
  if (!progress) return "";
  if (!progress.hatched) {
    return progress.ready ? "알이 깨어나려 해요!" : `알이 따뜻해지는 중 · ${number(progress.xp)} / ${number(PET_HATCH_XP)}`;
  }
  return `${progress.stage}단계 ${progress.stageName}`;
}

function Bar({ percent, label }) {
  return <span className="pet-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
    <i style={{ width: `${Math.max(percent > 0 ? 4 : 0, Math.min(100, percent))}%` }} />
  </span>;
}

// ── 펫 먹이(lib/petCare.js) ──────────────────────────────────────
/** 펫을 부르는 이름 — 깨어난 펫은 제 이름(또롱 …), 알은 '알'. */
export function petCallName(mirrorOrProgress) {
  return petSpecies(mirrorOrProgress?.species)?.name ?? "알";
}
/**
 * 펫이 건네는 말 — 배부름이 30 이하일 때만(care: careStatus의 결과 · hatched: 깨어났는가). 할 말이 없으면 "".
 * 알은 과일을 먹지 않으므로 책을 읽어 달라고만 합니다.
 */
export function petSay(care, hatched) {
  if (!care || care.away || !care.hungry) return "";
  if (!hatched) return care.low ? "알이 차갑게 식어 가요… 오늘 책을 읽어 주세요!" : "알이 조금 식었어요. 책을 읽어 따뜻하게 해 주세요.";
  if (care.low) return "오늘 아무것도 못 먹으면 먹이를 찾아 떠나야 할 것 같아요…";
  return care.full <= CARE_DAY_DROP * 2 ? "꼬르륵… 배가 많이 고파요." : "배가 고파요… 과일 하나만 주세요!";
}
/** 상단바가 하루에 한 번 띄우는 알림 한 줄 — 배고픔 · 떠남(할 말이 없으면 ""). mirror: 프로필의 펫. */
export function petCareNotice(care, mirror) {
  if (!care) return "";
  const name = petCallName(mirror);
  const hatched = !!mirror?.species;
  if (care.away) return hatched ? `${iGa(name)} 먹이를 찾아 떠났어요. 책나눔에서 다시 불러 주세요.` : "알이 따뜻한 곳을 찾아 떠났어요. 책나눔에서 다시 불러 주세요.";
  if (!care.hungry) return "";
  return hatched ? `🍊 ${name}: “${petSay(care, true)}” (배부름 ${care.full})` : `🥚 ${petSay(care, false)} (배부름 ${care.full})`;
}
/** 배부름 한 줄 — 카드 · '내 프로필'. */
export function petCareLine(care, hatched) {
  if (!care) return "";
  if (care.away) return `다시 부르기 ${care.steps.done} / ${care.steps.need}걸음`;
  const tail = care.keptToday ? " · 오늘은 읽은 날" : care.restToday ? " · 오늘은 쉬는 날" : care.low ? " · 오늘이 고비" : care.hungry ? (hatched ? " · 배고파요" : " · 식어 가요") : "";
  return `배부름 ${care.full}${tail}`;
}
// 배부름 눈금 — 열 칸(한 칸 = 과일 1개 = 하루치)
function Fullness({ care, label = "배부름" }) {
  const cells = Math.round(care.full / CARE_FRUIT);
  return <span className={`pet-full${care.hungry ? " is-hungry" : ""}${care.low ? " is-low" : ""}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={CARE_MAX} aria-valuenow={care.full}>
    {Array.from({ length: CARE_MAX / CARE_FRUIT }, (_, i) => <i key={i} className={i < cells ? "on" : ""} />)}
  </span>;
}
function Steps({ steps }) {
  return <span className="pet-steps" role="meter" aria-label="다시 부르기 걸음" aria-valuemin={0} aria-valuemax={steps.need} aria-valuenow={steps.done}>
    {Array.from({ length: steps.need }, (_, i) => <i key={i} className={i < steps.done ? "on" : ""}>🐾</i>)}
  </span>;
}

// level · onLevelCheer — 책나눔의 캐릭터 레벨. 같은 저장에서 펫이 자라며 레벨도 오르면(알을 경험치 0에서
// 받은 학생은 둘의 기준표가 같아 늘 함께 오름) 축하 한 번에 함께 알리고, 책나눔에 그 레벨을 알려
// 알림 줄이 같은 말('레벨 n 달성!')을 또 띄우지 않게 합니다.
// feed — 그 반의 먹이 규칙(lib/readingPet.js의 petCareRules — 펫 먹이를 끈 반이면 on이 거짓) · fruits — 내가 가진 과일 수 ·
// today — 서울 날짜(책나눔이 1분마다 다시 봄 — 자정을 넘기면 배부름이 따라 줄어듦).
export default function PetCard({ classId, uid, growthXp, level = null, onLevelCheer = null, feed = null, fruits = 0, today = null }) {
  const [state, setState] = useState({ loaded: false, mirror: null, fromCache: false, failed: false });
  const [open, setOpen] = useState(false);
  const [cheer, setCheer] = useState(null);
  const cheerSeq = useRef(0);
  const prevLevel = useRef(null);
  const levelCheerRef = useRef(onLevelCheer);
  levelCheerRef.current = onLevelCheer;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adoptFailed, setAdoptFailed] = useState(false);
  const hatching = useRef(false);
  // 깨어나는 장면이 끝날 때까지 카드는 알 모습 그대로 — 창 뒤의 카드가 종을 먼저 알려 주지 않게
  const [frozen, setFrozen] = useState(null);

  useEffect(() => {
    setState({ loaded: false, mirror: null, fromCache: false, failed: false });
    if (!uid) return undefined;
    return subscribeMyReadingPet(uid, setState);
  }, [uid]);

  // 알이 아직 없으면 받습니다(서버에서 확인된 답일 때만 — 기기에 남은 옛 값으로 보내지 않게)
  const needsEgg = state.loaded && !state.failed && !state.fromCache && !state.mirror;
  useEffect(() => {
    if (!needsEgg || !classId || !uid) return;
    let live = true;
    setAdoptFailed(false);
    ensureReadingPet(classId, uid).catch(() => { if (live) setAdoptFailed(true); });
    return () => { live = false; };
  }, [needsEgg, classId, uid]);

  const progress = useMemo(() => (growthXp == null ? null : petProgress(state.mirror, growthXp)), [state.mirror, growthXp]);
  // 펫 먹이 — 지금 배부름 · 떠났는가(펫 먹이를 끈 반이면 null — 지금까지처럼 늘 곁에 있음)
  const day = today || kstToday();
  const stage = progress?.stage ?? 1;
  const care = useMemo(() => (progress && feed?.on ? careStatus(state.mirror, feed, day, stage) : null), [state.mirror, feed, day, stage, progress]);
  const [careBusy, setCareBusy] = useState(false);
  const [careError, setCareError] = useState("");
  // 떠났던 펫이 돌아오면 한 번 축하합니다(이 화면이 떠 있는 동안 '떠남 → 곁에'로 바뀔 때만 — 처음 본 값은 기준)
  const away = care ? care.away : null;
  const wasAway = useRef(null);
  // 돌아오는 순간의 모습 — 효과는 '떠남 → 곁에'가 바뀔 때만 돌고, 그때의 최신 모습을 여기서 읽습니다
  const progressNow = useRef(progress);
  progressNow.current = progress;
  useEffect(() => {
    const before = wasAway.current;
    wasAway.current = away;
    const now = progressNow.current;
    if (before === true && away === false && now?.hatched) {
      cheerSeq.current += 1;
      setCheer({ id: cheerSeq.current, kind: "return", progress: now, level: null });
    }
  }, [away]);

  // 먹이 주기 · 과일로 한 걸음 — 저장이 끝난 뒤에 과일을 날립니다(실패했는데 먹는 그림을 보여 주지 않게)
  async function careAct(kind, count, fly) {
    if (careBusy) return;
    setCareBusy(true);
    setCareError("");
    try {
      const result = kind === "feed" ? await feedReadingPet(classId, count) : await callReadingPet(classId);
      fly?.(result?.used ?? 0);
    } catch (e) {
      setCareError(e?.message || (kind === "feed" ? "먹이를 주지 못했어요. 잠시 뒤 다시 해 볼까요?" : "걸음을 내지 못했어요. 잠시 뒤 다시 해 볼까요?"));
    } finally {
      setCareBusy(false);
    }
  }

  // 단계가 오르면 한 번 축하합니다 — 이 기기에서 본 단계와 견줌(처음이면 적어 두기만 — petCheerKind)
  // 이 효과는 책나눔(부모)의 레벨 알림 효과보다 먼저 돕니다(React는 자식의 효과부터) — 그래서
  // onLevelCheer로 알린 레벨을 책나눔이 같은 차례 안에서 보고 알림 줄을 거릅니다.
  useEffect(() => {
    const before = prevLevel.current;
    if (Number.isInteger(level)) prevLevel.current = level;
    if (!progress || !uid || typeof window === "undefined" || hatching.current) return;
    // 먹이를 찾아 떠나 있는 동안에는 자라도 축하하지 않습니다(곁에 없는 펫 — 본 단계만 적어 둠)
    const kind = away ? null : petCheerKind(readSeen(uid), progress);
    if (kind) {
      const levelUp = kind === "grow" && Number.isInteger(level) && before != null && level > before ? level : null;
      if (levelUp) levelCheerRef.current?.(levelUp);
      cheerSeq.current += 1;
      setCheer({ id: cheerSeq.current, kind, progress, level: levelUp });
    }
    writeSeen(uid, progress);
  }, [progress, uid, level, away]);

  async function hatch() {
    if (busy) return;
    setBusy(true);
    setError("");
    hatching.current = true;
    setFrozen(progress);
    try {
      const result = await hatchReadingPet(classId);
      if (result?.pet?.hatched) {
        writeSeen(uid, result.pet);
        setOpen(false);
        cheerSeq.current += 1;
        setCheer({ id: cheerSeq.current, kind: "hatch", progress: result.pet, level: null });
      } else {
        setFrozen(null);
      }
    } catch (e) {
      setFrozen(null);
      setError(e?.message || "알을 깨우지 못했어요. 잠시 뒤 다시 해 볼까요?");
    } finally {
      hatching.current = false;
      setBusy(false);
    }
  }

  if (!state.loaded || growthXp == null) return null;
  const shown = frozen ?? progress;
  if (!shown) {
    return <div className="reading-pet reading-pet--waiting" role="status">
      <PetFigure size={52} />
      <span className="reading-pet-text"><small>나의 펫</small><strong>{adoptFailed ? "알을 받지 못했어요" : "알을 받는 중…"}</strong>
        {adoptFailed && <em>잠시 뒤 새로고침해 주세요.</em>}</span>
    </div>;
  }
  // 깨어나는 장면 동안에는 배부름도 감춥니다(카드는 알 모습 그대로)
  const shownCare = frozen ? null : care;
  const say = petSay(shownCare, shown.hatched);
  const gone = !!shownCare?.away;
  const who = petCallName(shown);
  return <>
    <div className={`reading-pet${shown.ready && !gone ? " is-ready" : ""}${gone ? " is-away" : ""}${say ? " is-hungry" : ""}`}>
      {say && <span className="pet-say" role="status">{say}</span>}
      <button type="button" className="reading-pet-open" onClick={() => setOpen(true)}
        aria-label={`나의 펫 — ${petTitle(shown)}, ${gone ? `먹이를 찾아 떠났어요. ${petCareLine(shownCare, shown.hatched)}` : `${petStatusLine(shown)}${shownCare ? `, ${petCareLine(shownCare, shown.hatched)}` : ""}`}. 자세히 보기`}>
        <PetFigure species={shown.species} stage={shown.stage} ready={shown.ready && !gone} size={60} className={gone ? "is-away" : ""} />
        <span className="reading-pet-text">
          <small>나의 펫</small>
          <strong>{petTitle(shown)}</strong>
          {gone ? <>
            <em className="reading-pet-gone">{shown.hatched ? `${iGa(who)} 먹이를 찾아 떠났어요` : "알이 따뜻한 곳을 찾아 떠났어요"}</em>
            <span className="reading-pet-care"><Steps steps={shownCare.steps} /><b>{shownCare.steps.done} / {shownCare.steps.need}걸음</b></span>
          </> : <>
            <em>{petStatusLine(shown)}</em>
            <Bar percent={shown.percent} label={shown.hatched ? "다음 단계까지" : "알이 깨어나기까지"} />
            {shownCare && <span className="reading-pet-care"><Fullness care={shownCare} /><b>{petCareLine(shownCare, shown.hatched)}</b></span>}
          </>}
        </span>
      </button>
      {shown.ready && !gone && <button type="button" className="btn-primary reading-pet-hatch" disabled={busy || !!frozen} onClick={hatch}>{busy || frozen ? "깨우는 중…" : "알 깨우기"}</button>}
      {gone && <button type="button" className="btn-primary reading-pet-hatch" onClick={() => setOpen(true)}>다시 부르기</button>}
      {!gone && shownCare?.hungry && shown.hatched && !shown.ready && <button type="button" className="btn-primary reading-pet-hatch" onClick={() => setOpen(true)}>먹이 주기</button>}
    </div>
    {error && !open && <p className="reading-pet-error" role="alert">{error}</p>}
    {open && <PetDetailModal progress={shown} busy={busy} error={error} onHatch={hatch} onClose={() => { setOpen(false); setCareError(""); }}
      care={shownCare} fruits={fruits} careBusy={careBusy} careError={careError} onFeed={(count, fly) => careAct("feed", count, fly)} onCall={(fly) => careAct("call", 0, fly)} />}
    {cheer && <PetCelebration key={cheer.id} kind={cheer.kind} progress={cheer.progress} level={cheer.level} onDone={() => { setCheer(null); setFrozen(null); }} />}
  </>;
}

// 자세히 보기의 '펫 먹이' 칸 — 배부름 · 먹이 주기 / 떠났으면 다시 부르기. figureRef: 과일이 날아갈 펫 그림.
function PetCareSection({ progress, care, fruits, busy, error, onFeed, onCall, figureRef }) {
  const fruitRef = useRef(null);
  const who = petCallName(progress);
  const have = Math.max(0, Math.floor(Number(fruits) || 0));
  const fly = (n) => flyFruits({ from: fruitRef.current, basket: figureRef.current, n, dir: "in" });
  const readRule = `독서 발자국을 ${CARE_READ_PAGES}쪽 이상 · ${CARE_READ_CHARS}자 이상`;
  if (care.away) {
    const left = care.steps.need - care.steps.done;
    return <section className="pet-care is-away" aria-label="떠난 펫 다시 부르기">
      <div className="pet-care-head"><strong>{progress.hatched ? `${iGa(who)} 먹이를 찾아 떠났어요` : "알이 따뜻한 곳을 찾아 떠났어요"}</strong><span ref={fruitRef} className="pet-care-fruit">가진 과일 🍊 {number(have)}</span></div>
      <div className="pet-care-steps"><Steps steps={care.steps} /><b>다시 부르기 {care.steps.done} / {care.steps.need}걸음</b></div>
      <ul className="pet-care-how">
        <li>오늘 날짜로 {readRule} 남긴 날마다 <b>한 걸음</b>(하루에 한 걸음)</li>
        <li>과일 {CARE_STEP_FRUIT}개로도 <b>한 걸음</b></li>
      </ul>
      <p className="pet-care-note">{left}걸음을 더 채우면 {progress.hatched ? iGa(who) : "알이"} 배부름 {CARE_RETURN}으로 돌아와요. 새 {progress.hatched ? "펫" : "알"}이 아니라 같은 {progress.hatched ? "펫" : "알"}이에요.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="pet-care-actions pet-care-actions--one">
        <button type="button" className="btn-primary" disabled={busy || have < CARE_STEP_FRUIT} onClick={() => onCall(fly)}
          title={have < CARE_STEP_FRUIT ? `과일 ${CARE_STEP_FRUIT}개가 있어야 해요` : undefined}>{busy ? "걸음을 내는 중…" : `🍊 과일 ${CARE_STEP_FRUIT}개로 한 걸음`}</button>
      </div>
    </section>;
  }
  const today = care.keptToday ? "오늘은 ‘읽은 날’이라 배부름이 줄지 않아요 ✓"
    : care.restToday ? "오늘은 쉬는 날이라 배부름이 줄지 않아요."
      : `오늘 날짜로 ${readRule} 남기면 오늘은 배부름이 줄지 않아요.`;
  const fill = Math.min(care.room, have);
  const why = !progress.hatched ? "" : care.room < 1 ? "지금은 배가 불러요." : have < 1 ? "줄 과일이 없어요. 수업 활동으로 과일을 모아 보세요." : "";
  const say = petSay(care, progress.hatched);
  return <section className={`pet-care${care.hungry ? " is-hungry" : ""}`} aria-label="펫 먹이">
    <div className="pet-care-head"><strong>배부름 {care.full} <small>/ {CARE_MAX}</small></strong>{progress.hatched && <span ref={fruitRef} className="pet-care-fruit">가진 과일 🍊 {number(have)}</span>}</div>
    <Fullness care={care} />
    {say && <p className="pet-care-say">“{say}”</p>}
    <p className="pet-care-note">날마다 {CARE_DAY_DROP}씩 줄어요{care.daysLeft > 0 ? ` — 지금대로면 ${care.daysLeft}일 버텨요` : ""}. {today}</p>
    {progress.hatched ? <>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className={`pet-care-actions${fill > 1 ? "" : " pet-care-actions--one"}`}>
        <button type="button" className="btn-primary" disabled={busy || care.room < 1 || have < 1} onClick={() => onFeed(1, fly)} title={why || undefined}>{busy ? "먹이는 중…" : `🍊 과일 1개 주기 (+${CARE_FRUIT})`}</button>
        {fill > 1 && <button type="button" className="btn-ghost" disabled={busy} onClick={() => onFeed(fill, fly)}>{care.room <= have ? `배부르게 주기 (${fill}개)` : `가진 과일 모두 주기 (${fill}개)`}</button>}
      </div>
      {why && <p className="pet-care-why">{why}</p>}
    </> : <p className="pet-care-why">알은 과일을 먹지 않아요. 책을 읽고 발자국을 남긴 날에는 따뜻하게 지켜져요.</p>}
  </section>;
}

/** 펫 자세히 보기 — 큰 그림 · 소개 · 열 단계 · 다음 단계까지. */
// care — 펫 먹이의 지금 배부름(없으면 그 칸을 그리지 않음 · 펫 먹이를 끈 반) · fruits · onFeed · onCall은 그 칸의 것.
export function PetDetailModal({ progress, busy = false, error = "", onHatch = null, onClose, ownerLabel = "나의 펫",
  care = null, fruits = 0, careBusy = false, careError = "", onFeed = null, onCall = null }) {
  const titleId = useId();
  const figureRef = useRef(null);
  const gone = !!care?.away;
  const sp = progress.hatched ? petSpecies(progress.species) : null;
  const note = progress.complete ? "독서 여행을 완성했어요! 가장 든든한 길동무가 되었어요."
    : progress.ready ? "알이 깨어나려 해요! 아래 단추를 눌러 깨워 주세요."
      : progress.hatched ? `다음 단계까지 ${number(progress.toNext)} EXP`
        : `알이 깨어나기까지 ${number(progress.toNext)} EXP`;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop pet-layer" {...backdropClose(onClose)}>
      <div className="modal pet-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn-close modal-close-float" onClick={onClose} aria-label="닫기">×</button>
        <div className="pet-modal-hero">
          <span ref={figureRef} className="pet-modal-figure"><PetFigure species={progress.species} stage={progress.stage} ready={progress.ready && !gone} size={132} className={gone ? "is-away" : ""} /></span>
          <div>
            <p className="pet-modal-eyebrow">{ownerLabel}</p>
            <h3 id={titleId}>{sp ? sp.name : "신비한 알"}{sp && <small>{sp.animal}</small>}</h3>
            <p>{sp ? sp.intro : "어떤 친구가 들어 있을까요? 책을 읽으면 알이 조금씩 따뜻해져요."}</p>
          </div>
        </div>
        {care && <PetCareSection progress={progress} care={care} fruits={fruits} busy={careBusy} error={careError} onFeed={onFeed} onCall={onCall} figureRef={figureRef} />}
        <div className="pet-modal-progress">
          <div className="pet-modal-progress-head"><strong>{progress.stage}단계 · {progress.stageName}</strong><span>펫 경험치 {number(progress.xp)}</span></div>
          <Bar percent={progress.percent} label={progress.hatched ? "다음 단계까지" : "알이 깨어나기까지"} />
          <p>{note}</p>
        </div>
        <ol className="pet-stages" aria-label="펫의 열 단계">
          {PET_STAGES.map((name, i) => {
            const stage = i + 1;
            const cls = stage === progress.stage ? "is-now" : stage < progress.stage ? "is-done" : "";
            return <li key={name} className={cls} aria-current={stage === progress.stage ? "step" : undefined}>
              <b>{stage}</b><span>{name}</span><small>{stage === 1 ? "알" : `${number(getExpForReadingLevel(stage))}`}</small>
            </li>;
          })}
        </ol>
        <p className="pet-modal-note">펫은 알을 받은 뒤부터 <b>독서로 얻은 경험치</b>로 자라요. 깨어난 펫은 다시 알로 돌아가지 않아요.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {onHatch && progress.ready && !gone && <div className="pet-modal-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={onHatch}>{busy ? "깨우는 중…" : "알 깨우기"}</button>
        </div>}
      </div>
    </div>,
    document.body,
  );
}

// 깨어날 때 알이 흔들리다 터지기까지(CSS의 .pet-burst.is-hatch — 펫은 1.05초에 튀어나옴). 그 순간
// 폭죽을 한 번 더 쏘므로 축포가 그만큼(4.2초 → 5.2초) 길어집니다 — CSS의 깨어남 길이(5.2s)와 맞물립니다.
const HATCH_REVEAL_MS = 1000;

/**
 * 알이 깨어남 · 펫이 자람 — 창이 아니라 과일 축포와 같은 폭죽(RewardCelebration) 위에 새 모습을
 * 띄웠다가 저절로 사라집니다(자람 4.2초 · 깨어남 5.2초). 누를 단추가 없고, 그동안에도 아래 화면을
 * 그대로 누를 수 있습니다(축포는 클릭을 가로채지 않음). level이 있으면 '레벨 n 달성!'도 함께.
 */
export function PetCelebration({ kind, progress, level = null, onDone }) {
  const hatch = kind === "hatch";
  // 먹이를 찾아 떠났던 펫이 돌아옴(펫 먹이 — 같은 펫이 돌아옵니다)
  const back = kind === "return";
  const sp = petSpecies(progress?.species);
  const [shots, setShots] = useState(1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!hatch) return undefined;
    const timer = setTimeout(() => setShots(2), HATCH_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [hatch]);
  // 그릴 수 없는 펫(종을 모름)이면 곧바로 끝냅니다 — 안 그러면 카드가 알 모습에 묶여 있습니다.
  useEffect(() => { if (!sp) doneRef.current?.(); }, [sp]);
  if (!sp || typeof document === "undefined") return null;
  return createPortal(
    <RewardCelebration amount={shots} onDone={onDone}>
      <div className={`pet-burst${hatch ? " is-hatch" : " is-grow"}`} role="status">
        <span className="pet-burst-stage" aria-hidden="true">
          <span className="pet-burst-glow" />
          {hatch && <span className="pet-burst-egg"><PetFigure size={150} /></span>}
          <span className="pet-burst-reveal"><PetFigure species={progress.species} stage={progress.stage} size={180} /></span>
        </span>
        <span className="pet-burst-note">
          {level && <span className="pet-burst-level">레벨 {level} 달성!</span>}
          <strong>{hatch ? `${iGa(sp.name)} 깨어났어요!` : back ? `${iGa(sp.name)} 돌아왔어요!` : `${iGa(sp.name)} 자랐어요!`}</strong>
          <span className="pet-burst-sub">{hatch ? `${sp.animal} 친구예요. ${sp.intro}` : back ? `다시 만나서 기뻐요. 배부름 ${CARE_RETURN}에서 다시 시작해요.` : `${progress.stage}단계 · ${progress.stageName}`}</span>
        </span>
      </div>
    </RewardCelebration>,
    document.body,
  );
}

/**
 * '내 프로필' 창의 펫 한 줄 — 단계는 열 때 한 번 서버에 묻습니다(/api/reading/pet — 접근 확인 3 + 반 집계 1).
 * 묻는 동안 · 못 받았을 때는 프로필에 적힌 것(알인가 · 어떤 종인가)만 보여 줍니다.
 */
export function PetProfileField({ classId, mirror }) {
  const [progress, setProgress] = useState(null);
  const [failed, setFailed] = useState(false);
  const species = mirror?.species ?? null;
  const baseXp = mirror?.baseXp ?? 0;
  useEffect(() => {
    let live = true;
    setProgress(null);
    setFailed(false);
    fetchMyReadingPet(classId)
      .then((value) => { if (live) setProgress(value); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [classId, species, baseXp]);
  const shown = progress ?? { species, stage: species ? 2 : 1, hatched: !!species, ready: false };
  const careLine = progress?.care ? (progress.care.away ? "먹이를 찾아 떠났어요 — 책나눔에서 다시 불러 주세요" : petCareLine(progress.care, progress.hatched)) : "";
  const line = progress?.care?.away ? careLine : progress
    ? progress.complete ? `${petStatusLine(progress)} · 독서 여행 완성!`
      : progress.ready ? "알이 깨어나려 해요! 책나눔에서 깨워 주세요."
        : progress.hatched ? `${petStatusLine(progress)} · 다음 단계까지 ${number(progress.toNext)} EXP`
          : petStatusLine(progress)
    : failed ? "펫 정보를 불러오지 못했어요." : "펫 정보를 불러오는 중…";
  return <div className="profile-pet">
    <PetFigure species={shown.species} stage={shown.stage} ready={shown.ready && !progress?.care?.away} size={56} className={progress?.care?.away ? "is-away" : ""} />
    <div className="profile-pet-text">
      <strong>{petTitle(shown)}</strong>
      <small>{line}</small>
      {careLine && !progress.care.away && <small>{careLine}</small>}
      {progress && <Bar percent={progress.percent} label={progress.hatched ? "다음 단계까지" : "알이 깨어나기까지"} />}
    </div>
  </div>;
}
