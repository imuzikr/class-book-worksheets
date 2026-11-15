"use client";

// =============================================================
// 펫 미리보기 — 열 친구가 알에서 10단계까지 자라는 모습(관리자 설정의 '펫 미리보기' · 선생님 요청)
// -------------------------------------------------------------
// 위에 열 종(같은 단계의 모습으로 나란히 — 단계를 바꾸면 모두 그 단계로 바뀌어 견줘 보기 좋게), 가운데에 고른 종의
// 큰 그림 · 이름 · 소개, 아래에 그 종이 자라는 열 단계(알 → 10단계 · 그 단계에 닿는 펫 경험치)가 섭니다.
// 단계를 누르면 큰 그림이 그 단계로 바뀝니다.
//   · mode "student" — 책나눔의 '나의 펫'에서 엽니다. **알일 때만** 아래 '○○ 키우기'로 깨어날 친구를 고릅니다(서버가 적음 —
//       chooseReadingPet · 반 친구에게는 깨어날 때까지 '신비한 알'). **이미 깨어난 펫은 바꾸지 않습니다**(선생님 결정 — 고르는
//       단추 없이 보기만. 한때 깨어난 펫도 모습과 이름을 바꿀 수 있었음 — 되살리지 마세요). 먹이를 찾아 떠나 있으면(펫 먹이) 고를 수 없습니다.
//   · mode "teacher" — 관리자 설정의 '펫 미리보기' 카드에서 선생님이 미리 봅니다(고르는 단추 없음 · 펫이 없음).
//   · welcome — 참여 코드로 반에 막 들어온 학생의 '첫 만남'(StudentWelcome — 아직 알이 없음). 머리말이 '함께 자랄 책 친구를
//       골라요'로, 단추가 '○○의 알 받기'로 바뀌고 옆에 '신비한 알 받기'(onSkip — 무작위 알)가 섭니다. 이어 놓인 두 단추는 같은 크기.
// 그림은 public/reading-pets(PetFigure — 작은 자리는 160px 그림). 창을 열 때만 받습니다(열 종 + 열 단계 ≈ 20장).
// =============================================================
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { getExpForReadingLevel } from "@/lib/reading";
import { PET_SPECIES, PET_STAGES, PET_STAGE_MAX, petSpecies } from "@/lib/readingPet";
import { backdropClose } from "@/lib/modal";
import { iGa } from "@/lib/korean";
import PetFigure from "./PetFigure";
import "./pet.css";

const number = (v) => Number(v || 0).toLocaleString("ko-KR");

/**
 * current — 학생의 지금 펫 { species: 깨어난 펫의 종 · 고른 알의 종 | null, hatched, stage, away } (선생님 · 펫이 없으면 null)
 * onChoose(species) — 학생이 고를 때(돌려주는 약속이 끝날 때까지 busy). error — 고르지 못한 까닭 한 줄.
 */
export default function PetPreviewModal({ mode = "student", current = null, busy = false, error = "", onChoose = null, onClose, welcome = false, onSkip = null }) {
  const titleId = useId();
  const teacher = mode === "teacher";
  const mine = petSpecies(current?.species)?.key ?? null;
  const [pick, setPick] = useState(mine ?? PET_SPECIES[0].key);
  // 처음 보는 단계 — 깨어난 나의 펫이면 지금 단계, 아니면 다 자란 모습(10단계)
  const [stage, setStage] = useState(current?.hatched && mine ? Math.max(2, Math.min(PET_STAGE_MAX, current.stage || 2)) : PET_STAGE_MAX);
  const sp = petSpecies(pick) ?? PET_SPECIES[0];
  // 열 종을 늘어놓는 작은 그림 — 고른 단계 그대로(알 단계면 모두 같은 알이라 다 자란 모습으로)
  const thumbStage = stage <= 1 ? PET_STAGE_MAX : stage;
  const isMine = !!mine && mine === sp.key;
  const away = !!current?.away;
  const hatched = !!current?.hatched;
  // 고르기는 알일 때만(선생님 결정) — 깨어난 펫이면 고르는 단추 없이 보기만
  const canChoose = !teacher && !!onChoose && !hatched;
  const note = teacher
    ? "학생은 알일 때 이 창에서 깨어날 친구를 골라요. 이미 깨어난 펫은 바꾸지 않고, 자라는 모습을 보기만 해요."
    : welcome
      ? "고른 친구의 알을 받아요. 깨어난 뒤에는 바꿀 수 없고, 반 친구들에게는 깨어날 때까지 ‘신비한 알’로 보여요."
    : hatched
      ? "펫은 알일 때만 고를 수 있어요. 지금 펫과 함께 자라면서, 열 친구가 자라는 모습은 언제든 볼 수 있어요."
      : away
        ? "알이 따뜻한 곳을 찾아 떠나 있어요. 먼저 다시 불러 주세요."
        : "고르면 알에서 이 친구가 깨어나요. 깨어나면 바꿀 수 없어요. 반 친구들에게는 깨어날 때까지 ‘신비한 알’로 보여요.";
  const action = welcome
    ? (busy ? "알을 받는 중…" : `${sp.name}의 알 받기`)
    : busy ? "고르는 중…" : isMine ? "이 친구로 골랐어요" : `${sp.name} 키우기`;
  // 알을 받는 동안은 닫지 않습니다(첫 만남 — 닫으면 신비한 알을 받으러 가므로 두 요청이 겹침)
  const close = () => { if (!busy) onClose(); };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop pet-layer" {...backdropClose(close)}>
      <div className="modal pet-modal petpv" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn-close modal-close-float" onClick={close} disabled={busy} aria-label="닫기">×</button>
        <header className="petpv-head">
          <p className="pet-modal-eyebrow">{welcome ? "책 친구 고르기" : "펫 미리보기"}</p>
          <h3 id={titleId}>{welcome ? "함께 자랄 책 친구를 골라요" : "열 친구가 자라는 모습"}</h3>
          <p>{welcome ? "알에서 깨어날 친구를 골라요. 단계를 누르면 알에서 10단계까지 자라는 모습을 미리 볼 수 있어요." : teacher ? "학생이 알일 때 고를 수 있는 열 친구예요. 단계를 누르면 그 단계의 모습으로 바뀌어요." : hatched ? "열 친구가 알에서 10단계까지 자라는 모습이에요. 단계를 누르면 그 단계의 모습을 볼 수 있어요." : "마음에 드는 친구를 골라 키워요. 단계를 누르면 그 단계의 모습을 볼 수 있어요."}</p>
        </header>
        <div className="petpv-species" aria-label="펫 종류">
          {PET_SPECIES.map((s) => {
            const own = mine === s.key;
            return <button type="button" key={s.key} className={`petpv-kind${pick === s.key ? " is-on" : ""}${own ? " is-mine" : ""}`}
              aria-pressed={pick === s.key} onClick={() => setPick(s.key)}
              aria-label={`${s.name} · ${s.animal}${own ? (current?.hatched ? " — 지금 나의 펫" : " — 고른 알") : ""}`}>
              <PetFigure species={s.key} stage={thumbStage} size={48} />
              <strong>{s.name}</strong>
              <small>{s.animal}</small>
              {own && <em className="petpv-mine">{current?.hatched ? "나의 펫" : "고른 알"}</em>}
            </button>;
          })}
        </div>
        <div className="petpv-hero">
          <span className="petpv-figure"><PetFigure species={sp.key} stage={stage} size={150} /></span>
          <div>
            <p className="pet-modal-eyebrow">{stage}단계 · {PET_STAGES[stage - 1]}</p>
            <h4>{sp.name}<small>{sp.animal}</small></h4>
            <p>{sp.intro}</p>
            <p className="petpv-xp">{stage === 1 ? "알을 받으면 여기서 시작해요." : `펫 경험치 ${number(getExpForReadingLevel(stage))}에 이 모습이 돼요.`}</p>
          </div>
        </div>
        <ol className="petpv-line" aria-label={`${iGa(sp.name)} 자라는 열 단계`}>
          {PET_STAGES.map((name, i) => {
            const n = i + 1;
            const now = isMine && current?.hatched && current.stage === n;
            return <li key={name}>
              <button type="button" className={`${n === stage ? "is-on" : ""}${now ? " is-now" : ""}`} aria-pressed={n === stage} onClick={() => setStage(n)}
                aria-label={`${n}단계 ${name}${now ? " — 지금 단계" : ""}`}>
                <PetFigure species={sp.key} stage={n} size={46} />
                <b>{n}</b>
                <span>{name}</span>
                <small>{n === 1 ? "알" : number(getExpForReadingLevel(n))}</small>
              </button>
            </li>;
          })}
        </ol>
        <div className="petpv-foot">
          <p className="petpv-note">{note}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {canChoose && welcome && onSkip ? (
            <div className="petpv-actions">
              <button type="button" className="btn-ghost petpv-skip" disabled={busy} onClick={onSkip}
                title="어떤 친구가 깨어날지 모르는 알을 받아요">신비한 알 받기</button>
              <button type="button" className="btn-primary petpv-choose" disabled={busy} onClick={() => onChoose(sp.key)}>{action}</button>
            </div>
          ) : canChoose && <button type="button" className="btn-primary petpv-choose" disabled={busy || isMine || away} onClick={() => onChoose(sp.key)}>{action}</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
