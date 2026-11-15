"use client";
// =============================================================
// 펫 정보 창 — 책 광장 · 교실 · 개인 아지트에서 펫을 누르면 뜨는 큰 창 (선생님 요청 · 2026년 11월)
// -------------------------------------------------------------
// 책 봄 '나의 펫' 카드의 자세히 보기와 **같은 창**(PetCard.jsx의 PetDetailModal)입니다 — 큰 그림 · 이름 · 소개 ·
// 지금 단계 · 열 단계. 누구의 펫인지에 따라 싣는 것이 다릅니다.
//   · 내 펫(학생 본인) — 펫 경험치 · 다음 단계까지의 막대, 펫 먹이를 켠 반이면 배부름과 '먹이 주기' · '다시 부르기'까지
//     ('나의 펫'과 같은 길 — usePetCareActions · 과일은 서버가 줄임). 알이 깨어날 때가 되면 깨우기는 책꽂이 탭의
//     '나의 펫'에서 합니다(깨어나는 장면이 거기 있음 — 창은 그곳을 알려 줌). 펫 미리보기로 고른 알이면 고른 친구를 보여 줍니다
//     (본인에게만 — 연 동안 한 번 물어봄 · fetchMyReadingPet의 chosen).
//   · 친구의 펫(선생님이 광장에서 보는 학생의 펫도) — 광장 입장권에 실린 **종 · 단계만**(lib/readingPet.js의
//     publicPetProgress — 읽기 0). 경험치 · 배부름은 싣지 않고, 알이면 어떤 친구인지 비밀입니다(선생님 결정).
//   · 선생님이 학생의 아지트를 볼 때 — 그 학생의 펫을 경험치 · 배부름까지 **읽기만**(먹이 단추 없음 · actions=false).
// 열면 창으로 초점을 옮깁니다 — 무대에 초점이 남으면 창이 떠 있는 동안 방향키로 캐릭터가 걸었습니다.
// 닫으면 부르는 쪽이 무대로 초점을 되돌립니다(onClose).
// =============================================================
import { useEffect, useState } from "react";
import { fetchMyReadingPet } from "@/lib/data/reading";
import { PetDetailModal, usePetCareActions } from "./PetCard";

// owner — 펫 주인의 이름(친구 · 학생 — 창 머리의 '○○의 펫') · own — 내 펫인가 · actions — 먹이 단추를 둘까(내 펫일 때만)
// progress — 내 펫이면 lib/readingPet.js의 petProgress, 친구면 publicPetProgress · care — 펫 먹이를 켠 반의 배부름(careStatus)
// read — 그 반의 '읽은 날' 기준(선생님이 정함) · fruits — 내가 가진 과일 수(먹이)
export default function PetInfoModal({ classId, owner = "", own = false, actions = true, progress, care = null, read = null, fruits = 0, onClose }) {
  const { busy, error, act } = usePetCareActions(classId);
  const [chosen, setChosen] = useState(null);
  const egg = !!progress && !progress.hatched;
  useEffect(() => {
    setChosen(null);
    if (!own || !egg || !classId) return undefined;
    let live = true;
    fetchMyReadingPet(classId).then((pet) => { if (live) setChosen(pet?.chosen ?? null); }).catch(() => {});
    return () => { live = false; };
  }, [own, egg, classId]);
  if (!progress) return null;
  const canAct = own && actions;
  return (
    <PetDetailModal progress={progress} ownerLabel={own ? "나의 펫" : `${owner || "친구"}의 펫`} onClose={onClose} takeFocus mine={own}
      care={care} read={read} fruits={fruits} careBusy={busy} careError={error}
      onFeed={canAct ? (count, fly) => act("feed", count, fly) : null}
      onCall={canAct ? (fly) => act("call", 0, fly) : null}
      chosen={own ? chosen : null} />
  );
}
