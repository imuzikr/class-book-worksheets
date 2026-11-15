"use client";

// =============================================================
// 첫 만남 — 참여 코드로 반에 막 들어온 학생에게(선생님 요청)
// -------------------------------------------------------------
//   ① 캐릭터 고르기 — CharacterChooser를 '반에 들어왔어요!' 문구로(닫으면 건너뜀 · 나중에 '내 프로필'에서 고름)
//   ② 책 친구(알) — 펫 미리보기를 켠 반은 고르는 창(PetPreviewModal의 welcome — '○○의 알 받기' · '신비한 알 받기',
//      닫아도 신비한 알), 끈 반은 곧바로 무작위 알(서버가 고름 · 알 단계 동안 비밀)
//   ③ 큰 알 — '책 친구가 함께해요!'와 커다란 알(WelcomeEgg). 닫으면 끝.
// 단계 판정 · 이 기기의 표시는 lib/readingWelcome.js 한 곳이고, 반 문서 · 내 캐릭터 · 내 펫은 상단바(TopNav)가 이미 구독한 값을
// 받아 씁니다(읽기가 늘지 않음). 상단바가 첫 만남이 있을 때만 이 파일을 받습니다(next/dynamic — 첫 화면 무게 그대로).
// 알 그림은 카드 쪽의 예전 알(egg.webp)입니다 — 도트 알은 책 광장 · 아지트만(선생님 결정).
// =============================================================
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { chooseReadingPet, ensureReadingPet } from "@/lib/data/reading";
import { clearWelcome, patchWelcome, welcomeStep } from "@/lib/readingWelcome";
import { PET_HATCH_XP, petSpecies } from "@/lib/readingPet";
import { backdropClose } from "@/lib/modal";
import { iGa } from "@/lib/korean";
import CharacterChooser from "./CharacterChooser";
import PetPreviewModal from "./PetPreview";
import PetFigure from "./PetFigure";
import "./pet.css";

/**
 * uid · classId — 지금 학생과 반 · welcome — 이 기기의 표시(readWelcome) · state — welcomeStep의 둘째 인자(상단바가 든 값)
 * previewOn — 이 반이 펫 미리보기를 켰나 · characterRow — { uid, character }(CharacterChooser의 row)
 * onSaveCharacter(draft) — 상단바의 캐릭터 저장(실패하면 던짐 — 창이 까닭을 적음)
 */
export default function StudentWelcome({ uid, classId, welcome, state, previewOn = false, characterRow, onSaveCharacter }) {
  const router = useRouter();
  const computed = welcomeStep(welcome, state);
  // 펫 단계 — 한 번 들어서면 큰 알 화면까지 이어 갑니다. 알을 받는 사이 구독으로 알이 먼저 보여도
  // '물을 것 없음'으로 끝나 큰 알 화면을 건너뛰지 않게(null | "choose" | "receiving" | "failed").
  const [pet, setPet] = useState(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickError, setPickError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const egg = welcome?.egg ?? null;
  const phase = egg ? "egg" : pet ?? computed;

  useEffect(() => {
    if (computed === "pet" && pet === null) setPet(previewOn ? "choose" : "receiving");
  }, [computed, pet, previewOn]);

  // 물을 것이 없으면(다른 반에서 이미 고른 학생 · 책나눔을 끈 반) 창 없이 표시만 지웁니다
  useEffect(() => {
    if (computed === "done" && pet === null && !egg) clearWelcome(uid);
  }, [computed, pet, egg, uid]);

  // 신비한 알 — 미리보기를 끈 반은 곧바로, 켠 반은 고르는 창을 닫거나 '신비한 알 받기'를 눌렀을 때.
  // ensureReadingPet은 상단바 · 펫 카드와 같은 약속이라 겹쳐 불러도 요청은 하나입니다.
  useEffect(() => {
    if (pet !== "receiving" || !classId || !uid) return undefined;
    let live = true;
    ensureReadingPet(classId, uid)
      .then(() => { if (live) patchWelcome(uid, { egg: { species: null } }); })
      .catch((e) => {
        console.warn("[첫 만남] 알을 받지 못했어요:", e?.code || e?.message);
        if (live) setPet("failed");
      });
    return () => { live = false; };
  }, [pet, classId, uid, attempt]);

  async function saveCharacter(draft) {
    await onSaveCharacter(draft);
    patchWelcome(uid, { character: true });
  }
  async function choosePet(species) {
    if (pickBusy) return;
    setPickBusy(true);
    setPickError("");
    try {
      await chooseReadingPet(classId, species);
      patchWelcome(uid, { egg: { species } });
    } catch (e) {
      setPickError(e?.message || "알을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      setPickBusy(false);
    }
  }
  function mysteryEgg() {
    if (!pickBusy) setPet("receiving");
  }
  function retry() {
    setPet("receiving");
    setAttempt((n) => n + 1);
  }
  function finish() {
    clearWelcome(uid);
  }
  function meet() {
    clearWelcome(uid);
    router.push("/books?area=reading");
  }

  if (phase === "character") {
    return (
      <CharacterChooser
        row={characterRow}
        eyebrow="반에 들어왔어요!"
        title="함께 걸을 캐릭터를 골라요"
        lead="책나눔 · 리더보드 · 책 광장에서 나를 대신할 캐릭터예요. 나중에 ‘내 프로필’에서 언제든 바꿀 수 있어요."
        cancelLabel="나중에 고를게요"
        onClose={() => patchWelcome(uid, { character: true })}
        onSave={saveCharacter}
      />
    );
  }
  if (phase === "choose") {
    return <PetPreviewModal welcome current={null} busy={pickBusy} error={pickError} onChoose={choosePet} onSkip={mysteryEgg} onClose={mysteryEgg} />;
  }
  if (phase === "receiving" || phase === "failed" || phase === "egg") {
    return <WelcomeEgg status={phase === "egg" ? "ready" : phase} species={egg?.species ?? null} previewOn={previewOn}
      onRetry={retry} onClose={finish} onMeet={meet} />;
  }
  return null;
}

// 큰 알 — '책 친구가 함께해요!'. status: "receiving"(알을 받는 중) | "ready" | "failed"
function WelcomeEgg({ status, species, previewOn, onRetry, onClose, onMeet }) {
  const titleId = useId();
  const leadId = useId();
  const sp = petSpecies(species);
  const ready = status === "ready";
  const failed = status === "failed";
  // 받는 동안은 닫지 않습니다(닫으면 끝 — 받은 알을 보여 줄 자리가 없어짐)
  const close = () => { if (status !== "receiving") onClose(); };
  const lead = failed
    ? "책 친구 알을 받지 못했어요. 잠시 뒤 다시 받아 주세요."
    : !ready ? "책 친구 알을 받고 있어요…"
      : sp ? `알 속에서 ${iGa(sp.name)} 깨어날 날을 기다리고 있어요.`
        : "어떤 친구가 깨어날지는 알이 깨어나는 날까지 비밀이에요.";
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop pet-layer" {...backdropClose(close)}>
      <div className="modal pet-modal pet-welcome" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={leadId}
        aria-busy={status === "receiving"} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn-close modal-close-float" onClick={close} disabled={status === "receiving"} aria-label="닫기">×</button>
        <div className={`pet-welcome-stage${ready ? " is-ready" : ""}${failed ? " is-failed" : ""}`} aria-hidden="true">
          <span className="pet-welcome-glow" />
          <span className="pet-welcome-spark s1">✦</span>
          <span className="pet-welcome-spark s2">✦</span>
          <span className="pet-welcome-spark s3">✦</span>
          <span className="pet-welcome-spark s4">✦</span>
          <span className="pet-welcome-egg"><PetFigure size={210} /></span>
        </div>
        <p className="pet-modal-eyebrow">새 책 친구</p>
        <h3 id={titleId}>책 친구가 함께해요!</h3>
        <p id={leadId} className="pet-welcome-lead" role={failed ? "alert" : undefined}>{lead}</p>
        {ready && sp && <p className="pet-welcome-friend"><b>{sp.name}</b> · {sp.animal} — {sp.intro}</p>}
        {!failed && (
          <p className="pet-welcome-how">
            책을 읽고 독서 발자국을 남길수록 알이 따뜻해져요. 펫 경험치 {PET_HATCH_XP}이 모이면 책나눔에서 알을 깨울 수 있어요.
          </p>
        )}
        {ready && (sp
          ? <p className="pet-welcome-note">반 친구들에게는 깨어날 때까지 ‘신비한 알’로 보여요.</p>
          : previewOn && <p className="pet-welcome-note">알일 때는 책나눔의 ‘펫 미리보기’에서 깨어날 친구를 고를 수도 있어요.</p>)}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={close} disabled={status === "receiving"}>닫기</button>
          {failed
            ? <button type="button" className="btn-primary" onClick={onRetry}>다시 받기</button>
            : <button type="button" className="btn-primary" onClick={onMeet} disabled={!ready}>책나눔에서 만나기</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
