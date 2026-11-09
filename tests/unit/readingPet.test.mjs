// 독서 펫 — 열 종 · 열 단계 · 펫 경험치 · 알 받기 / 알 깨우기 판정(lib/readingPet.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PET_SPECIES, PET_SPECIES_KEYS, PET_STAGES, PET_STAGE_MAX, PET_HATCH_XP,
  normalizePetMirror, normalizePublicPet, petEnabled, petGrowthOfSummary, petGrowthXp,
  petImageSrc, petProgress, petSpecies, petStageName, pickPetSpecies, planPetAction, rankingPet,
} from "@/lib/readingPet";
import { FRUIT_XP, deriveReading, getExpForReadingLevel, initialReadingState } from "@/lib/reading";
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

test("학생 펫 스위치 — 책나눔이 켜진 반에서, 값이 없으면 켜짐", () => {
  assert.equal(petEnabled({ readingEnabled: true }), true);
  assert.equal(petEnabled({ readingEnabled: true, petEnabled: false }), false);
  assert.equal(petEnabled({ readingEnabled: false }), false);
  assert.equal(petEnabled({ readingEnabled: true, archived: true }), false);
  assert.equal(petEnabled(null), false);
});

test("펫이 자라는 바탕 — 누적 경험치에서 과일 경험치를 뺀 값", () => {
  assert.equal(petGrowthXp(500, 3), 500 - 3 * FRUIT_XP);
  assert.equal(petGrowthXp(20, 5), 0); // 0 아래로 안 내려감
  assert.equal(petGrowthXp(null, null), 0);
  assert.equal(petGrowthXp("300", 0), 0); // 숫자가 아니면 0
  // 책나눔 요약에서도 같은 값 — 과일 날이 있어도 과일 경험치만 빠짐
  const state = initialReadingState();
  const summary = deriveReading(state, new Date("2026-11-09T12:00:00+09:00"), {
    fruits: [{ classId: "c", date: "2026-11-02", count: 4 }],
  });
  assert.equal(summary.fruitXp, 4 * FRUIT_XP);
  assert.equal(petGrowthOfSummary(summary), summary.xp - summary.fruitXp);
  assert.equal(petGrowthOfSummary(summary), petGrowthXp(summary.xp, summary.fruitCount));
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

test("리더보드 한 줄 — 반 집계(누적 · 과일)로 셈하고, 알은 종을 싣지 않음", () => {
  assert.deepEqual(rankingPet({ baseXp: 100, species: null }, { totalXp: 260, fruitCount: 6 }),
    { species: null, stage: 1, xp: 100, ready: true });
  assert.deepEqual(rankingPet({ baseXp: 0, species: "otter" }, { totalXp: 600, fruitCount: 0 }),
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
  assert.equal(petImageSrc("owl", 3), null); // 아직 그림 없음 → 자리표시
  const ready = new Set(["owl", "egg"]);
  assert.equal(petImageSrc("owl", 3, ready), "/reading-pets/owl-03.webp");
  assert.equal(petImageSrc("owl", 10, ready), "/reading-pets/owl-10.webp");
  assert.equal(petImageSrc(null, 1, ready), "/reading-pets/egg.webp");
  assert.equal(petImageSrc("owl", 1, ready), "/reading-pets/egg.webp"); // 알 단계는 종을 드러내지 않음
  assert.equal(petImageSrc("cat", 4, ready), null);
  assert.equal(petImageSrc("../x", 4, new Set(["../x"])), null);
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
