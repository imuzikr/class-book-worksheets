// 독서 펫 — 열 종 · 열 단계 · 펫 경험치 · 알 받기 / 알 깨우기 판정(lib/readingPet.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PET_SPECIES, PET_SPECIES_KEYS, PET_STAGES, PET_STAGE_MAX, PET_HATCH_XP,
  normalizePetMirror, normalizePublicPet, petCareRules, petEnabled, petFeedTimesPatch, petGrowthOfSummary, petGrowthXp, petPreviewOn,
  PET_ART_READY, petCheerKind, petImageSrc, petImageSrcSet, petProgress, petSpecies, petStageName, pickPetSpecies,
  planPetAction, rankingPet,
} from "@/lib/readingPet";
import { existsSync, readFileSync } from "node:fs";
import { deriveReading, getExpForReadingLevel, initialReadingState } from "@/lib/reading";
import { createDemoPet } from "@/lib/demoPets";

test("열 종 · 열 단계 — 이름이 모두 다르고, 6~10단계는 선생님이 주신 이름 그대로", () => {
  assert.equal(PET_SPECIES.length, 10);
  assert.equal(new Set(PET_SPECIES_KEYS).size, 10);
  assert.equal(new Set(PET_SPECIES.map((s) => s.name)).size, 10);
  assert.ok(PET_SPECIES.every((s) => s.animal && s.name && s.intro && s.emoji));
  assert.equal(PET_STAGE_MAX, 10);
  assert.deepEqual(PET_STAGES.slice(5), ["첫 동행", "작은 여행 친구", "길을 익힌 동반자", "든든한 길동무", "독서 여행 완성형"]);
  assert.equal(petStageName(1), "신비한 알");
  assert.equal(petStageName(99), "독서 여행 완성형");
  assert.equal(petStageName("x"), "신비한 알");
  assert.equal(petSpecies("owl").name, "또롱");
  assert.equal(petSpecies("dragon"), null);
});

test("학생 펫 스위치 — 책 봄이 켜진 반에서, 값이 없으면 켜짐", () => {
  assert.equal(petEnabled({ readingEnabled: true }), true);
  assert.equal(petEnabled({ readingEnabled: true, petEnabled: false }), false);
  assert.equal(petEnabled({ readingEnabled: false }), false);
  assert.equal(petEnabled({ readingEnabled: true, archived: true }), false);
  assert.equal(petEnabled(null), false);
});

test("펫 먹이가 켜지고 꺼지는 쓰기 — 처음 켬 · 끔 · 다시 켬의 '때'(세 스위치 · 반 보관 모두)", () => {
  const stamps = { stamp: () => "지금", remove: () => "지움" };
  const times = (before, patch) => petFeedTimesPatch(before, patch, stamps);
  const running = { readingEnabled: true, petFeedEnabled: true, petFeedFrom: 1 };
  // 처음 켬 — 켠 때(그날부터 셈)
  assert.deepEqual(times({ readingEnabled: true }, { petFeedEnabled: true }), { petFeedFrom: "지금" });
  // 끔 — 끈 때. 세 스위치 · 반 보관 가운데 무엇으로 꺼도 같음
  for (const patch of [{ petFeedEnabled: false }, { petEnabled: false }, { readingEnabled: false }, { archived: true }]) {
    assert.deepEqual(times(running, patch), { petFeedOffAt: "지금" });
  }
  // 다시 켬 — 다시 켠 때(꺼 둔 동안은 세지 않아 끈 순간의 배부름에서 이어짐 · 켠 때는 그대로)
  const off = { ...running, petFeedEnabled: false, petFeedOffAt: 5 };
  assert.deepEqual(times(off, { petFeedEnabled: true }), { petFeedOnAt: "지금" });
  assert.deepEqual(times({ ...running, petEnabled: false, petFeedOffAt: 5 }, { petEnabled: true }), { petFeedOnAt: "지금" });
  assert.deepEqual(times({ ...running, archived: true, petFeedOffAt: 5 }, { archived: false }), { petFeedOnAt: "지금" });
  // 다시 끔 — 지난번 쉰 기간을 목록 끝으로 옮기고 다시 켠 때를 지움
  const back = { ...running, petFeedOffAt: 5, petFeedOnAt: 9, petFeedPauses: [{ off: 2, on: 3 }] };
  assert.deepEqual(times(back, { petEnabled: false }),
    { petFeedOffAt: "지금", petFeedPauses: [{ off: 2, on: 3 }, { off: 5, on: 9 }], petFeedOnAt: "지움" });
  // 끈 때를 모르는 옛 반을 다시 켰던 반 — 처음 켠 때부터를 쉰 기간으로
  assert.deepEqual(times({ ...running, petFeedOnAt: 9 }, { petFeedEnabled: false }),
    { petFeedOffAt: "지금", petFeedPauses: [{ off: 1, on: 9 }], petFeedOnAt: "지움" });
  // 목록 천장 40 — 가장 오래된 줄을 빼지 않고 가장 오래된 두 줄을 합침(첫째의 끈 때 ~ 둘째의 다시 켠 때)
  const full = Array.from({ length: 40 }, (_, i) => ({ off: i * 2, on: i * 2 + 1 }));
  const merged = times({ ...running, petFeedOffAt: 90, petFeedOnAt: 95, petFeedPauses: full }, { petFeedEnabled: false }).petFeedPauses;
  assert.deepEqual([merged.length, merged[0], merged[1], merged.at(-1)], [40, { off: 0, on: 3 }, { off: 4, on: 5 }, { off: 90, on: 95 }]);
  // 켜짐 · 꺼짐이 그대로인 쓰기는 아무것도 더하지 않음(이미 돌던 반 · 펫 먹이를 안 켠 반 · 학생 펫이 꺼진 반 · 상관없는 스위치)
  assert.deepEqual(times(running, { petFeedEnabled: true }), {});
  assert.deepEqual(times(running, { plazaEnabled: false }), {});
  assert.deepEqual(times({ readingEnabled: false }, { readingEnabled: true }), {});
  assert.deepEqual(times({ readingEnabled: true, petEnabled: false, petFeedEnabled: true, petFeedFrom: 1 }, { readingEnabled: true }), {});
  assert.deepEqual(times(off, { petFeedEnabled: false }), {});
  assert.deepEqual(times(running, null), {});
  // 새 반 — 책 봄이 꺼진 채 만들고 선생님의 설정을 한 번에(addClass)
  assert.deepEqual(times({ readingEnabled: false }, { readingEnabled: true, petEnabled: true, petFeedEnabled: true }), { petFeedFrom: "지금" });
  assert.deepEqual(times({ readingEnabled: false }, { readingEnabled: true, petFeedEnabled: false }), {});
  // 쓰기 전의 반을 모르면 세 스위치 가운데 하나를 켜는 쓰기인가로(켠 때를 새로 — 꺼 둔 날을 세지 않는 쪽)
  assert.deepEqual(times(null, { petEnabled: true }), { petFeedFrom: "지금" });
  assert.deepEqual(times(null, { plazaEnabled: true }), {});
  assert.deepEqual(times(null, { petEnabled: false }), {});
});

test("펫이 자라는 바탕 — 누적 경험치 그대로(과일은 경험치가 아님)", () => {
  assert.equal(petGrowthXp(500), 500);
  assert.equal(petGrowthXp(-20), 0); // 0 아래로 안 내려감
  assert.equal(petGrowthXp(null), 0);
  assert.equal(petGrowthXp("300"), 0); // 숫자가 아니면 0
  // 책 봄 요약에서도 같은 값 — 옛 화면이 과일 날을 실어 보내도 경험치가 아니므로 그대로
  const summary = deriveReading({ ...initialReadingState(), fruits: [{ classId: "c", date: "2026-11-02", count: 4 }] },
    new Date("2026-11-09T12:00:00+09:00"));
  assert.equal(summary.xp, 0);
  assert.equal(petGrowthOfSummary(summary), 0);
  assert.equal(petGrowthOfSummary({ xp: 730 }), 730);
});

test("프로필의 펫 — 모양이 틀리면 null, 모르는 종은 알로", () => {
  assert.equal(normalizePetMirror(null), null);
  assert.equal(normalizePetMirror({}), null); // baseXp 없음
  assert.equal(normalizePetMirror({ baseXp: -1 }), null);
  assert.equal(normalizePetMirror([]), null);
  assert.deepEqual(normalizePetMirror({ baseXp: 120.4, species: null, assignedAt: 1700000000000 }),
    { species: null, baseXp: 120, assignedAt: 1700000000000, hatchedAt: null });
  assert.equal(normalizePetMirror({ baseXp: 0, species: "dragon" }).species, null);
  assert.equal(normalizePetMirror({ baseXp: 0, species: "cat", hatchedAt: 5 }).hatchedAt, 5);
});

test("단계 — 알을 받을 때의 경험치를 빼고, 캐릭터 레벨과 같은 표로 셈", () => {
  // 이미 1,800 경험치가 있던 학생도 알부터(선생님 결정)
  const egg = petProgress({ baseXp: 1800, species: null }, 1800);
  assert.equal(egg.stage, 1);
  assert.equal(egg.stageName, "신비한 알");
  assert.equal(egg.xp, 0);
  assert.equal(egg.ready, false);
  assert.equal(egg.toNext, PET_HATCH_XP);
  assert.equal(egg.percent, 0);
  // 100 모이면 깨울 수 있음(아직 알 — 학생이 '알 깨우기'를 눌러야 종이 적힘)
  const ready = petProgress({ baseXp: 1800, species: null }, 1900);
  assert.equal(ready.stage, 1);
  assert.equal(ready.ready, true);
  assert.equal(ready.percent, 100);
  // 깨어나면 같은 표 — 2단계 100 · 3단계 250 … 10단계 7,595
  for (let stage = 2; stage <= 10; stage += 1) {
    const at = getExpForReadingLevel(stage);
    assert.equal(petProgress({ baseXp: 0, species: "owl" }, at).stage, stage, `단계 ${stage}`);
    assert.equal(petProgress({ baseXp: 0, species: "owl" }, at - 1).stage, Math.max(2, stage - 1));
  }
  assert.equal(getExpForReadingLevel(10), 7595);
  const top = petProgress({ baseXp: 0, species: "owl" }, 999999);
  assert.equal(top.stage, 10);
  assert.equal(top.complete, true);
  assert.equal(top.toNext, 0);
  assert.equal(top.percent, 100);
  const mid = petProgress({ baseXp: 0, species: "bear" }, 375); // 3단계(250~500)의 한가운데
  assert.equal(mid.stage, 3);
  assert.equal(mid.percent, 50);
  assert.equal(mid.toNext, 125);
});

test("깨어난 펫은 기록을 지워 경험치가 줄어도 알로 돌아가지 않음", () => {
  const p = petProgress({ baseXp: 500, species: "cat" }, 520);
  assert.equal(p.xp, 20);
  assert.equal(p.stage, 2);
  assert.equal(p.hatched, true);
  assert.equal(p.ready, false);
  assert.equal(p.percent, 0);
  assert.equal(p.toNext, getExpForReadingLevel(3) - 20);
  assert.equal(petProgress(null, 999), null); // 알을 안 받았으면 없음
});

test("리더보드 한 줄 — 반 집계의 누적 경험치로 셈하고, 알은 종을 싣지 않음", () => {
  assert.deepEqual(rankingPet({ baseXp: 100, species: null }, { totalXp: 200 }),
    { species: null, stage: 1, xp: 100, ready: true });
  // 옛 집계에 남은 과일 수(fruitCount)는 안 봅니다 — 과일은 경험치가 아님
  assert.deepEqual(rankingPet({ baseXp: 0, species: "otter" }, { totalXp: 600, fruitCount: 6 }),
    { species: "otter", stage: 4, xp: 600, ready: false });
  assert.deepEqual(rankingPet({ baseXp: 0, species: "otter" }, null), { species: "otter", stage: 2, xp: 0, ready: false });
  assert.equal(rankingPet(undefined, { totalXp: 10 }), null);
});

test("서버가 보낸 펫을 그리기 전에 거름 — 알은 늘 1단계, 모르는 종은 버림", () => {
  assert.deepEqual(normalizePublicPet({ species: null, stage: 7, xp: 50, ready: true }), { species: null, stage: 1, xp: 50, ready: true });
  assert.deepEqual(normalizePublicPet({ species: "rabbit", stage: 12, xp: 9000 }), { species: "rabbit", stage: 10, xp: 9000, ready: false });
  assert.deepEqual(normalizePublicPet({ species: "rabbit", stage: 1 }), { species: "rabbit", stage: 2, xp: 0, ready: false });
  assert.equal(normalizePublicPet({ species: "<img>", stage: 3 }), null);
  assert.equal(normalizePublicPet("owl"), null);
});

test("무작위 고르기 — 열 종 모두 나올 수 있고 범위 밖은 접음", () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => pickPetSpecies(i)), PET_SPECIES_KEYS);
  assert.equal(pickPetSpecies(10), PET_SPECIES_KEYS[0]);
  assert.equal(pickPetSpecies(-1), PET_SPECIES_KEYS[9]);
  assert.equal(pickPetSpecies("x"), PET_SPECIES_KEYS[0]);
});

test("그림 주소 — 파일이 준비된 종만, 알은 늘 '비밀 알'", () => {
  assert.equal(petImageSrc("cat", 3, new Set(["owl", "egg"])), null); // 그림이 없는 종 → 자리표시
  assert.equal(petImageSrc("cat", 3), "/reading-pets/cat-03.webp"); // 지금은 열 종 모두 그림이 있음
  const ready = new Set(["owl", "egg"]);
  assert.equal(petImageSrc("owl", 3, ready), "/reading-pets/owl-03.webp");
  assert.equal(petImageSrc("owl", 10, ready), "/reading-pets/owl-10.webp");
  assert.equal(petImageSrc(null, 1, ready), "/reading-pets/egg.webp");
  assert.equal(petImageSrc("owl", 1, ready), "/reading-pets/egg.webp"); // 알 단계는 종을 드러내지 않음
  // 책 광장 · 아지트만 도트 알 — 카드 · 리더보드 · 독서 맵은 예전 알(선생님 결정). 깨어난 펫은 상관없음
  assert.equal(petImageSrc(null, 1, ready, { pixelEgg: true }), "/reading-pets/egg-pixel.webp");
  assert.equal(petImageSrc("owl", 1, ready, { pixelEgg: true }), "/reading-pets/egg-pixel.webp");
  assert.equal(petImageSrc("owl", 3, ready, { pixelEgg: true }), "/reading-pets/owl-03.webp");
  assert.equal(petImageSrc(null, 1, new Set(["owl"]), { pixelEgg: true }), null);
  assert.equal(petImageSrc("cat", 4, ready), null);
  assert.equal(petImageSrc("../x", 4, new Set(["../x"])), null);
  // 작은 그림(160px)을 함께 적은 srcset — 자리 크기로 브라우저가 고름
  assert.equal(petImageSrcSet("/reading-pets/owl-03.webp"), "/reading-pets/owl-03-160.webp 160w, /reading-pets/owl-03.webp 640w");
  assert.equal(petImageSrcSet("/reading-pets/egg.webp"), "/reading-pets/egg-160.webp 160w, /reading-pets/egg.webp 640w");
  assert.equal(petImageSrcSet("/reading-pets/egg-pixel.webp"), "/reading-pets/egg-pixel-160.webp 160w, /reading-pets/egg-pixel.webp 640w");
  assert.equal(petImageSrcSet(null), undefined);
});

test("그림 파일 — PET_ART_READY에 적은 종은 2~10단계 그림이 두 크기로 다 있음(알은 egg · 도트 알 egg-pixel)", () => {
  const dir = new URL("../../public/reading-pets/", import.meta.url);
  const missing = [];
  for (const key of PET_ART_READY) {
    const names = key === "egg" ? ["egg", "egg-pixel"] : Array.from({ length: 9 }, (_, i) => `${key}-${String(i + 2).padStart(2, "0")}`);
    for (const name of names) {
      for (const file of [`${name}.webp`, `${name}-160.webp`]) if (!existsSync(new URL(file, dir))) missing.push(file);
    }
  }
  assert.deepEqual(missing, [], "빠진 그림 — scripts/prepare-pet-art.mjs로 넣으세요");
  // 선생님이 주신 그림으로 알과 열 종이 모두 들어갔습니다(2026년 11월)
  assert.ok(PET_ART_READY.has("egg"));
  assert.deepEqual(PET_SPECIES_KEYS.filter((key) => !PET_ART_READY.has(key)), [], "그림이 없는 종");
  // 두 알은 다른 그림 — 카드 쪽(egg)에 도트 알을 다시 넣으면 카드 · 리더보드 · 독서 맵의 알이 도트가 됩니다(선생님 결정과 어긋남)
  for (const suffix of ["", "-160"]) {
    const card = readFileSync(new URL(`egg${suffix}.webp`, dir)), pixel = readFileSync(new URL(`egg-pixel${suffix}.webp`, dir));
    assert.notDeepEqual(card, pixel, `egg${suffix}.webp와 egg-pixel${suffix}.webp가 같은 그림`);
  }
});

test("알 받기 — 처음 한 번만, 받을 때의 경험치가 바탕이 되고 종은 비밀 문서에만", () => {
  const first = planPetAction({ action: "adopt", mirror: null, growthXp: 1793, randomIndex: 4, now: 1700000000000 });
  assert.equal(first.event, "adopted");
  assert.deepEqual(first.mirror, { species: null, baseXp: 1793, assignedAt: 1700000000000, hatchedAt: null });
  assert.deepEqual(first.secret, { species: "fennec", baseXp: 1793 });
  assert.equal(first.pet.stage, 1);
  assert.equal(first.pet.xp, 0);
  // 이미 있으면 아무것도 안 씀(두 번 눌러도 · 두 기기에서 동시에 불러도 하나)
  const again = planPetAction({ action: "adopt", mirror: first.mirror, growthXp: 1900, randomIndex: 0 });
  assert.equal(again.event, null);
  assert.equal(again.mirror, null);
  assert.equal(again.secret, null);
  assert.equal(again.pet.xp, 107);
});

test("알 깨우기 — 100이 모여야, 비밀 문서의 종으로, 한 번만", () => {
  const egg = { species: null, baseXp: 300, assignedAt: 1, hatchedAt: null };
  const early = planPetAction({ action: "hatch", mirror: egg, secretSpecies: "owl", growthXp: 399 });
  assert.equal(early.error.code, "reading/pet-not-ready");
  assert.equal(early.error.status, 409);
  const hatched = planPetAction({ action: "hatch", mirror: egg, secretSpecies: "owl", growthXp: 400, randomIndex: 9, now: 1700000000999 });
  assert.equal(hatched.event, "hatched");
  assert.deepEqual(hatched.mirror, { species: "owl", baseXp: 300, assignedAt: 1, hatchedAt: 1700000000999 });
  assert.equal(hatched.secret, null); // 비밀 문서는 그대로
  assert.equal(hatched.pet.stage, 2);
  assert.equal(hatched.pet.species, "owl");
  // 이미 깨어났으면 그대로
  const twice = planPetAction({ action: "hatch", mirror: hatched.mirror, secretSpecies: "owl", growthXp: 400 });
  assert.equal(twice.event, null);
  assert.equal(twice.mirror, null);
  // 비밀 문서가 없으면 이번에 골라 고쳐 적음
  const repaired = planPetAction({ action: "hatch", mirror: egg, secretSpecies: null, growthXp: 400, randomIndex: 2 });
  assert.equal(repaired.mirror.species, "chick");
  assert.deepEqual(repaired.secret, { species: "chick", baseXp: 300 });
  // 알이 없으면 깨울 수 없음 · 모르는 요청
  assert.equal(planPetAction({ action: "hatch", mirror: null, growthXp: 999 }).error.code, "reading/pet-missing");
  assert.equal(planPetAction({ action: "feed" }).error.status, 400);
});

test("펫 미리보기 스위치 — 학생 펫이 켜진 반에서, 켠 것만(기본 꺼짐)", () => {
  assert.equal(petPreviewOn({ readingEnabled: true, petPreviewEnabled: true }), true);
  assert.equal(petPreviewOn({ readingEnabled: true }), false); // 기본 꺼짐
  assert.equal(petPreviewOn({ readingEnabled: true, petPreviewEnabled: false }), false);
  assert.equal(petPreviewOn({ readingEnabled: true, petEnabled: false, petPreviewEnabled: true }), false); // 학생 펫을 끄면 함께
  assert.equal(petPreviewOn({ readingEnabled: false, petPreviewEnabled: true }), false); // 책 봄을 끄면 함께
  assert.equal(petPreviewOn({ readingEnabled: true, petPreviewEnabled: true, archived: true }), false);
  assert.equal(petPreviewOn(null), false);
});

test("펫 고르기(미리보기) — 알일 때만 깨어날 친구를 바꾸고(프로필은 그대로), 깨어난 펫은 바꾸지 않음(선생님 결정)", () => {
  // 알이 아직 없으면 고른 종의 알을 받음(바탕은 그때의 누적 경험치)
  const fresh = planPetAction({ action: "choose", species: "fennec", mirror: null, growthXp: 420, now: 1700000000000 });
  assert.equal(fresh.event, "chosen");
  assert.deepEqual(fresh.mirror, { species: null, baseXp: 420, assignedAt: 1700000000000, hatchedAt: null }); // 프로필에는 종 없음(비밀)
  assert.deepEqual(fresh.secret, { species: "fennec", baseXp: 420, chosen: true });
  assert.equal(fresh.chosen, "fennec");
  // 알 — 비밀 문서의 종만 바꾸고, 프로필은 쓰지 않음(반 친구에게는 깨어날 때까지 '신비한 알')
  const egg = { species: null, baseXp: 300, assignedAt: 1, hatchedAt: null };
  const picked = planPetAction({ action: "choose", species: "otter", mirror: egg, secretSpecies: "owl", growthXp: 350 });
  assert.equal(picked.event, "chosen");
  assert.equal(picked.mirror, null);
  assert.deepEqual(picked.secret, { species: "otter", baseXp: 300, chosen: true });
  assert.equal(picked.pet.stage, 1);
  // 무작위 종과 우연히 같아도 '고른 것'으로 적음(본인에게 알려 주려고) · 이미 고른 종을 다시 고르면 아무것도 안 씀
  assert.deepEqual(planPetAction({ action: "choose", species: "owl", mirror: egg, secretSpecies: "owl", secretChosen: false, growthXp: 350 }).secret,
    { species: "owl", baseXp: 300, chosen: true });
  const same = planPetAction({ action: "choose", species: "owl", mirror: egg, secretSpecies: "owl", secretChosen: true, growthXp: 350 });
  assert.equal(same.event, null);
  assert.equal(same.secret, null);
  // 고른 알이 깨어나면 고른 친구로(알 깨우기는 비밀 문서의 종을 씀)
  const hatchedEgg = planPetAction({ action: "hatch", mirror: egg, secretSpecies: picked.secret.species, growthXp: 400 });
  assert.equal(hatchedEgg.mirror.species, "otter");
  // 깨어난 펫은 바꾸지 않음 — 다른 종이든 같은 종이든 막히고 아무것도 안 씀(선생님 결정 · 한때 모습과 이름을 바꿀 수 있었음)
  const pet = { species: "owl", baseXp: 0, assignedAt: 1, hatchedAt: 2, care: { full: 70, day: "2026-11-14", kept: null, away: null, back: 0, fed: null } };
  for (const species of ["cat", "owl"]) {
    const blocked = planPetAction({ action: "choose", species, mirror: pet, secretSpecies: "owl", growthXp: 1600 });
    assert.equal(blocked.error.code, "reading/pet-hatched");
    assert.equal(blocked.error.status, 409);
    assert.equal(blocked.mirror, undefined);
    assert.equal(blocked.secret, undefined);
  }
  // 모르는 종 · 빈 값은 막힘
  assert.equal(planPetAction({ action: "choose", species: "dragon", mirror: pet }).error.status, 400);
  assert.equal(planPetAction({ action: "choose", mirror: pet }).error.code, "reading/invalid-request");
});

test("펫 고르기 — 알이 따뜻한 곳을 찾아 떠나 있으면(펫 먹이) 먼저 다시 불러야 함", () => {
  const rules = petCareRules({ readingEnabled: true, petFeedEnabled: true, petFeedFrom: Date.UTC(2026, 8, 1) });
  assert.equal(rules.on, true);
  const awayCare = { full: 0, day: "2026-11-13", kept: null, away: { on: "2026-11-13", days: [], fruit: 0 }, back: 0, fed: null };
  const goneEgg = planPetAction({ action: "choose", species: "cat", mirror: { species: null, baseXp: 0, assignedAt: 1, hatchedAt: null, care: awayCare },
    growthXp: 30, care: rules, today: "2026-11-15" });
  assert.equal(goneEgg.error.code, "reading/pet-away");
  assert.equal(goneEgg.error.status, 409);
  assert.match(goneEgg.error.message, /알이 따뜻한 곳을 찾아/);
});

test("데모 반의 펫 — 열 종이 모두 나오고, 알 둘(곧 깨어남 · 따뜻해지는 중)과 아직 알이 없는 학생 하나", () => {
  const pets = Array.from({ length: 15 }, (_, i) => createDemoPet(i, 300 + i * 10));
  assert.equal(pets[14], null); // 30115 — 상단바가 알을 줌
  assert.equal(new Set(pets.filter(Boolean).map((p) => p.secret)).size, 10);
  const hatched = pets.filter((p) => p?.mirror.species);
  assert.equal(hatched.length, 12);
  assert.ok(hatched.every((p) => p.mirror.species === p.secret && p.mirror.baseXp === 0));
  // 알의 종은 프로필(mirror)에 없고 secret에만
  assert.equal(pets[12].mirror.species, null);
  assert.equal(pets[13].mirror.species, null);
  assert.ok(pets[12].secret && pets[13].secret);
  assert.deepEqual(petProgress(pets[12].mirror, 300 + 12 * 10).xp, 60);
  assert.equal(petProgress(pets[13].mirror, 300 + 13 * 10).ready, true);
  assert.equal(petProgress(pets[12].mirror, 300 + 12 * 10).ready, false);
});

test("축하할 일 — 깨어남 · 자람만, 이 기기에서 처음 보면 축하하지 않음", () => {
  const egg = petProgress({ baseXp: 0, species: null }, 50);
  const owl2 = petProgress({ baseXp: 0, species: "owl" }, 120);
  const owl3 = petProgress({ baseXp: 0, species: "owl" }, 300);
  assert.equal(petCheerKind(null, owl3), null); // 이 기기에서 처음 — 지금 단계부터 셈
  assert.equal(petCheerKind({ species: null, stage: 1 }, egg), null); // 아직 알
  assert.equal(petCheerKind({ species: null, stage: 1 }, owl2), "hatch"); // 다른 기기에서 깨운 펫도 한 번
  assert.equal(petCheerKind({ species: "owl", stage: 2 }, owl3), "grow");
  assert.equal(petCheerKind({ species: "owl", stage: 3 }, owl3), null); // 그대로
  assert.equal(petCheerKind({ species: "owl", stage: 4 }, owl3), null); // 내려감(기록을 지움)
  assert.equal(petCheerKind({ species: "cat", stage: 2 }, owl3), null); // 다른 펫의 기록
  assert.equal(petCheerKind({ species: "owl" }, owl3), null); // 단계가 없는 옛 값
  assert.equal(petCheerKind("owl", owl3), null);
  assert.equal(petCheerKind({ species: "owl", stage: 2 }, null), null);
});
