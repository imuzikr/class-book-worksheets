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
// =============================================================
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ensureReadingPet, fetchMyReadingPet, hatchReadingPet, subscribeMyReadingPet } from "@/lib/data/reading";
import { getExpForReadingLevel } from "@/lib/reading";
import { PET_HATCH_XP, PET_STAGES, petCheerKind, petProgress, petSpecies } from "@/lib/readingPet";
import { iGa } from "@/lib/korean";
import { backdropClose } from "@/lib/modal";
import RewardCelebration from "@/components/RewardCelebration";
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

// level · onLevelCheer — 책나눔의 캐릭터 레벨. 같은 저장에서 펫이 자라며 레벨도 오르면(알을 경험치 0에서
// 받은 학생은 둘의 기준표가 같아 늘 함께 오름) 축하 한 번에 함께 알리고, 책나눔에 그 레벨을 알려
// 알림 줄이 같은 말('레벨 n 달성!')을 또 띄우지 않게 합니다.
export default function PetCard({ classId, uid, growthXp, level = null, onLevelCheer = null }) {
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

  // 단계가 오르면 한 번 축하합니다 — 이 기기에서 본 단계와 견줌(처음이면 적어 두기만 — petCheerKind)
  // 이 효과는 책나눔(부모)의 레벨 알림 효과보다 먼저 돕니다(React는 자식의 효과부터) — 그래서
  // onLevelCheer로 알린 레벨을 책나눔이 같은 차례 안에서 보고 알림 줄을 거릅니다.
  useEffect(() => {
    const before = prevLevel.current;
    if (Number.isInteger(level)) prevLevel.current = level;
    if (!progress || !uid || typeof window === "undefined" || hatching.current) return;
    const kind = petCheerKind(readSeen(uid), progress);
    if (kind) {
      const levelUp = kind === "grow" && Number.isInteger(level) && before != null && level > before ? level : null;
      if (levelUp) levelCheerRef.current?.(levelUp);
      cheerSeq.current += 1;
      setCheer({ id: cheerSeq.current, kind, progress, level: levelUp });
    }
    writeSeen(uid, progress);
  }, [progress, uid, level]);

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
  return <>
    <div className={`reading-pet${shown.ready ? " is-ready" : ""}`}>
      <button type="button" className="reading-pet-open" onClick={() => setOpen(true)} aria-label={`나의 펫 — ${petTitle(shown)}, ${petStatusLine(shown)}. 자세히 보기`}>
        <PetFigure species={shown.species} stage={shown.stage} ready={shown.ready} size={60} />
        <span className="reading-pet-text">
          <small>나의 펫</small>
          <strong>{petTitle(shown)}</strong>
          <em>{petStatusLine(shown)}</em>
          <Bar percent={shown.percent} label={shown.hatched ? "다음 단계까지" : "알이 깨어나기까지"} />
        </span>
      </button>
      {shown.ready && <button type="button" className="btn-primary reading-pet-hatch" disabled={busy || !!frozen} onClick={hatch}>{busy || frozen ? "깨우는 중…" : "알 깨우기"}</button>}
    </div>
    {error && !open && <p className="reading-pet-error" role="alert">{error}</p>}
    {open && <PetDetailModal progress={shown} busy={busy} error={error} onHatch={hatch} onClose={() => setOpen(false)} />}
    {cheer && <PetCelebration key={cheer.id} kind={cheer.kind} progress={cheer.progress} level={cheer.level} onDone={() => { setCheer(null); setFrozen(null); }} />}
  </>;
}

/** 펫 자세히 보기 — 큰 그림 · 소개 · 열 단계 · 다음 단계까지. */
export function PetDetailModal({ progress, busy = false, error = "", onHatch = null, onClose, ownerLabel = "나의 펫" }) {
  const titleId = useId();
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
          <PetFigure species={progress.species} stage={progress.stage} ready={progress.ready} size={132} />
          <div>
            <p className="pet-modal-eyebrow">{ownerLabel}</p>
            <h3 id={titleId}>{sp ? sp.name : "신비한 알"}{sp && <small>{sp.animal}</small>}</h3>
            <p>{sp ? sp.intro : "어떤 친구가 들어 있을까요? 책을 읽으면 알이 조금씩 따뜻해져요."}</p>
          </div>
        </div>
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
        {onHatch && progress.ready && <div className="pet-modal-actions">
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
          <strong>{hatch ? `${iGa(sp.name)} 깨어났어요!` : `${iGa(sp.name)} 자랐어요!`}</strong>
          <span className="pet-burst-sub">{hatch ? `${sp.animal} 친구예요. ${sp.intro}` : `${progress.stage}단계 · ${progress.stageName}`}</span>
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
  const line = progress
    ? progress.complete ? `${petStatusLine(progress)} · 독서 여행 완성!`
      : progress.ready ? "알이 깨어나려 해요! 책나눔에서 깨워 주세요."
        : progress.hatched ? `${petStatusLine(progress)} · 다음 단계까지 ${number(progress.toNext)} EXP`
          : petStatusLine(progress)
    : failed ? "펫 정보를 불러오지 못했어요." : "펫 정보를 불러오는 중…";
  return <div className="profile-pet">
    <PetFigure species={shown.species} stage={shown.stage} ready={shown.ready} size={56} />
    <div className="profile-pet-text">
      <strong>{petTitle(shown)}</strong>
      <small>{line}</small>
      {progress && <Bar percent={progress.percent} label={progress.hatched ? "다음 단계까지" : "알이 깨어나기까지"} />}
    </div>
  </div>;
}
