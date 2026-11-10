// =============================================================
// 독서 펫 — 셈(순수 함수 · 서버와 화면이 함께 씀)
// -------------------------------------------------------------
// 학생은 알 하나를 받습니다 — 열 종 가운데 하나를 서버가 무작위로 고르고, **알 단계에서는
// 어떤 친구인지 비밀**입니다(선생님 결정). 고른 종은 서버만 읽는 users/{uid}/reading/pet에
// 적어 두고, 학생 프로필(users/{uid}.readingPet — 급우도 읽음)에는 종 없이 적습니다.
// 펫 경험치가 100 모이면 학생이 '알 깨우기'를 눌러 만나고, 그때 프로필에 종이 적힙니다.
//
// 펫 경험치 = 누적 경험치(모두 독서로 얻은 것) − 알을 받을 때의 그 값(baseXp)
//   · 이미 경험치가 있던 학생도 알부터 시작합니다(선생님 결정) — 받을 때의 값을 빼고 셉니다.
//   · 과일은 경험치가 아닙니다(선생님 요청 — 앞으로 펫에게 주는 먹이로만 씀). 한때 과일 1개가
//     10 EXP라 펫은 그만큼을 빼고 셌는데, 과일 경험치를 걷으면서 누적 경험치 그대로가 됐습니다.
// 단계는 캐릭터 레벨과 **같은 표**(lib/reading.js의 getExpForReadingLevel)로 셉니다 —
// 펫 경험치 100이면 2단계, 250 · 500 · 1,000 · 1,500 · 2,250 · 3,375 · 5,063 · 7,595에서
// 3~10단계. 10단계가 끝입니다(캐릭터 레벨도 10이 끝 — lib/reading.js의 READING_LEVEL_MAX).
// 깨어난 펫은 독서 기록을 지워 경험치가 줄어도 **알로 돌아가지 않습니다**(2단계 아래로 안 내려감).
// 선생님 · 관리자는 펫이 없습니다(선생님 결정). 관리자 설정의 '학생 펫'(petEnabled — 값이
// 없으면 켜짐, 책나눔 성장 기능이 켜진 반에서만).
// 시험 tests/unit/readingPet.test.mjs.
// =============================================================
import { getExpForReadingLevel, getReadingLevel, readingEnabled } from "./reading.js";

// 열 종 — 차례가 곧 데모 · 무작위 고르기의 차례입니다. 이름(name)은 종마다 하나로 정해져 있습니다.
// emoji는 그림 파일이 오기 전에 잠깐 쓰는 자리표시(레서판다는 이모지가 없어 이름처럼 단풍잎).
export const PET_SPECIES = Object.freeze([
  { key: "owl", animal: "부엉이", name: "또롱", emoji: "🦉", intro: "동그란 눈을 또롱또롱 뜨고 밤늦게까지 책장을 넘겨요." },
  { key: "hedgehog", animal: "고슴도치", name: "밤톨", emoji: "🦔", intro: "마음에 드는 문장을 가시에 콕콕 꽂아 모아 와요." },
  { key: "chick", animal: "병아리", name: "삐요", emoji: "🐤", intro: "새 책을 펼칠 때마다 제일 먼저 “삐요!” 하고 인사해요." },
  { key: "otter", animal: "수달", name: "달콩", emoji: "🦦", intro: "이야기 물결을 따라 둥실둥실 헤엄치듯 읽어요." },
  { key: "fennec", animal: "사막여우", name: "쫑긋", emoji: "🦊", intro: "커다란 귀를 쫑긋 세우고 이야기 소리에 귀 기울여요." },
  { key: "redpanda", animal: "레서판다", name: "단풍", emoji: "🍁", intro: "읽던 자리에 단풍잎 책갈피를 꼭 끼워 두는 꼼꼼이예요." },
  { key: "rabbit", animal: "토끼", name: "몽실", emoji: "🐰", intro: "재미있는 장면이 나오면 깡총깡총 뛰어올라요." },
  { key: "bear", animal: "곰", name: "곰곰", emoji: "🐻", intro: "다 읽은 책을 곰곰이 되새기는 생각쟁이예요." },
  { key: "cat", animal: "삼색 고양이", name: "콩떡", emoji: "🐱", intro: "햇볕 드는 창가에서 책 읽는 시간을 제일 좋아해요." },
  { key: "puppy", animal: "강아지", name: "보리", emoji: "🐶", intro: "한 권을 다 읽으면 꼬리를 흔들며 다음 책을 물어 와요." },
].map((species) => Object.freeze(species)));
export const PET_SPECIES_KEYS = Object.freeze(PET_SPECIES.map((s) => s.key));

// 열 단계 — 6~10단계 이름은 선생님이 주신 그림의 이름 그대로입니다.
export const PET_STAGES = Object.freeze([
  "신비한 알", "톡톡 깨어남", "아장아장 아기", "호기심 많은 꼬마", "길 떠날 준비",
  "첫 동행", "작은 여행 친구", "길을 익힌 동반자", "든든한 길동무", "독서 여행 완성형",
]);
export const PET_STAGE_MAX = PET_STAGES.length;
export const PET_HATCH_STAGE = 2;
// 알이 깨어날 수 있는 펫 경험치 — 캐릭터 2레벨과 같은 100
export const PET_HATCH_XP = getExpForReadingLevel(PET_HATCH_STAGE);

// 그림 파일이 준비된 종 — public/reading-pets/{종}-{02~10}.webp(+ 작은 그림 -160.webp). 없는 종은
// 자리표시를 그립니다(없는 파일을 학생마다 요청하지 않게). 알 단계의 '비밀 알'은 egg.webp 한 장을
// 모두가 같이 씁니다(1단계는 종마다 그리지 않음). 그림은 scripts/prepare-pet-art.mjs로 다듬어 넣고,
// 넣은 뒤 여기에 종(또는 "egg")을 더합니다 — 시험이 적힌 종의 파일이 다 있는지 봅니다.
export const PET_ART_READY = Object.freeze(new Set(["egg", "owl", "hedgehog", "chick", "otter", "fennec", "redpanda", "rabbit"]));

const finite = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const wholeMs = (v) => {
  const n = finite(v);
  return n !== null && n > 0 ? Math.round(n) : null;
};

/** 관리자 설정 '학생 펫' — 책나눔 성장 기능이 켜진 반에서, 끄지 않았으면 켜짐(값이 없으면 켜짐). */
export function petEnabled(classDoc) {
  return readingEnabled(classDoc) && classDoc?.petEnabled !== false;
}

export function petSpecies(key) {
  return PET_SPECIES.find((s) => s.key === key) ?? null;
}

export function petStageName(stage) {
  const n = Math.floor(Number(stage) || 1);
  return PET_STAGES[Math.min(PET_STAGE_MAX, Math.max(1, n)) - 1];
}

/** 펫이 자라는 바탕 — 누적 경험치(0 아래로는 안 내려감 · 과일은 경험치가 아님). */
export function petGrowthXp(totalXp) {
  return Math.max(0, Math.round(finite(totalXp) ?? 0));
}

/** 책나눔 요약(deriveReading의 결과)에서 펫이 자라는 바탕. */
export function petGrowthOfSummary(summary) {
  return petGrowthXp(summary?.xp);
}

/** 프로필에 적힌 펫(users/{uid}.readingPet)을 고른 모양으로 — 알을 아직 안 받았거나 모양이 틀리면 null. */
export function normalizePetMirror(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const baseXp = finite(raw.baseXp);
  if (baseXp === null || baseXp < 0) return null;
  const species = raw.species == null ? null : petSpecies(raw.species)?.key ?? null;
  // 종을 모르는 값이면(옛 값 · 망가진 값) 알로 봅니다 — 서버가 깨울 때 비밀 문서의 종을 다시 적습니다.
  return {
    species,
    baseXp: Math.round(baseXp),
    assignedAt: wholeMs(raw.assignedAt),
    hatchedAt: species ? wholeMs(raw.hatchedAt) : null,
  };
}

/**
 * 펫 한 마리의 지금 모습 — 단계 · 펫 경험치 · 다음 단계까지.
 * mirror: 프로필의 readingPet, growthXp: 지금의 '독서로 얻은 경험치'(petGrowthXp · petGrowthOfSummary).
 * 알을 아직 안 받았으면 null.
 */
export function petProgress(mirror, growthXp) {
  const m = normalizePetMirror(mirror);
  if (!m) return null;
  const xp = Math.max(0, Math.round(finite(growthXp) ?? 0) - m.baseXp);
  const hatched = !!m.species;
  const stage = hatched ? Math.min(PET_STAGE_MAX, Math.max(PET_HATCH_STAGE, getReadingLevel(xp))) : 1;
  const complete = stage >= PET_STAGE_MAX;
  const lower = getExpForReadingLevel(stage);
  const upper = complete ? lower : getExpForReadingLevel(stage + 1);
  const percent = complete ? 100 : Math.min(100, Math.max(0, Math.round((xp - lower) / (upper - lower) * 100)));
  return {
    species: m.species,
    stage,
    stageName: petStageName(stage),
    hatched,
    ready: !hatched && xp >= PET_HATCH_XP,
    xp,
    lower,
    upper,
    toNext: complete ? 0 : Math.max(0, upper - xp),
    percent,
    complete,
  };
}

/**
 * 축하할 일 — 이 기기에서 지난번에 본 펫(seen — `{ species, stage }`)과 지금 펫(petProgress)을 견줍니다.
 * 'hatch'(알이 깨어남) · 'grow'(단계가 오름) · null(축하할 것 없음).
 * 이 기기에서 처음 보면(seen 없음) 축하하지 않습니다 — 다른 기기에서 지난 성장을 다시 축하하지 않고
 * 지금 단계부터 셉니다. 단계가 그대로이거나 내려갔으면 null.
 */
export function petCheerKind(seen, progress) {
  if (!seen || typeof seen !== "object" || !progress?.hatched) return null;
  if (!seen.species) return "hatch";
  if (seen.species === progress.species && Number(progress.stage) > Number(seen.stage)) return "grow";
  return null;
}

/** 리더보드 한 줄에 실을 펫 — 프로필의 readingPet과 반 집계의 누적(totalXp)으로. 알을 안 받았으면 null. */
export function rankingPet(mirror, snapshot) {
  const p = petProgress(mirror, petGrowthXp(snapshot?.totalXp));
  return p ? { species: p.species, stage: p.stage, xp: p.xp, ready: p.ready } : null;
}

/** 서버가 보낸 리더보드의 펫을 그릴 수 있는 모양으로 — 알(species 없음)은 늘 1단계. */
export function normalizePublicPet(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const species = raw.species == null ? null : petSpecies(raw.species)?.key ?? null;
  if (raw.species != null && !species) return null;
  const stageRaw = Math.floor(finite(raw.stage) ?? 1);
  const stage = species ? Math.min(PET_STAGE_MAX, Math.max(PET_HATCH_STAGE, stageRaw)) : 1;
  return { species, stage, xp: Math.max(0, Math.round(finite(raw.xp) ?? 0)), ready: !species && raw.ready === true };
}

/** 무작위 고르기 — index는 0 이상 10 미만의 정수(서버는 crypto.randomInt). 범위 밖이면 나머지로 접습니다. */
export function pickPetSpecies(index) {
  const n = PET_SPECIES.length;
  const i = ((Math.floor(Number(index) || 0) % n) + n) % n;
  return PET_SPECIES[i].key;
}

/** 그림 주소 — 그림 파일이 아직 없으면 null(자리표시를 그림). 알 단계는 종과 상관없이 '비밀 알'. */
/**
 * 큰 그림(640px)과 작은 그림(160px — 이름에 -160)을 함께 적은 srcset. 브라우저가 자리 크기(sizes)로
 * 고릅니다 — 순위표 · 독서 맵처럼 작게 여러 장 뜨는 자리는 작은 그림만 받습니다(한 장 4~10KB).
 */
export function petImageSrcSet(src) {
  if (typeof src !== "string" || !src.endsWith(".webp")) return undefined;
  return `${src.slice(0, -".webp".length)}-160.webp 160w, ${src} 640w`;
}

export function petImageSrc(species, stage, ready = PET_ART_READY) {
  const n = Math.floor(Number(stage) || 1);
  if (!species || n <= 1) return ready.has("egg") ? "/reading-pets/egg.webp" : null;
  if (!petSpecies(species) || !ready.has(species)) return null;
  return `/reading-pets/${species}-${String(Math.min(PET_STAGE_MAX, n)).padStart(2, "0")}.webp`;
}

/**
 * 서버의 '알 받기(adopt) · 알 깨우기(hatch)' 판정(lib/server/readingService.js의 readingPetAction).
 * 읽은 것(프로필의 펫 · 비밀 문서의 종 · 지금의 독서 경험치)을 받아, 무엇을 쓸지와 돌려줄 모습을 정합니다.
 * 돌려줌: { mirror: 프로필에 적을 값 | null, secret: 비밀 문서에 적을 값 | null, pet, event: "adopted" | "hatched" | null }
 *         막히면 { error: { message, status, code } }.
 */
export function planPetAction({ action, mirror: rawMirror = null, secretSpecies = null, growthXp = 0, randomIndex = 0, now = Date.now() } = {}) {
  const mirror = normalizePetMirror(rawMirror);
  const growth = Math.max(0, Math.round(finite(growthXp) ?? 0));
  const at = wholeMs(now) ?? Date.now();
  if (action === "adopt") {
    if (mirror) return { mirror: null, secret: null, pet: petProgress(mirror, growth), event: null };
    const species = pickPetSpecies(randomIndex);
    const next = { species: null, baseXp: growth, assignedAt: at, hatchedAt: null };
    return { mirror: next, secret: { species, baseXp: growth }, pet: petProgress(next, growth), event: "adopted" };
  }
  if (action === "hatch") {
    if (!mirror) return { error: { message: "아직 받은 알이 없어요.", status: 404, code: "reading/pet-missing" } };
    if (mirror.species) return { mirror: null, secret: null, pet: petProgress(mirror, growth), event: null };
    if (!petProgress(mirror, growth).ready) {
      return { error: { message: "알이 아직 깨어날 준비가 안 됐어요. 책을 조금 더 읽어 볼까요?", status: 409, code: "reading/pet-not-ready" } };
    }
    const known = petSpecies(secretSpecies)?.key ?? null;
    const species = known ?? pickPetSpecies(randomIndex);
    const next = { ...mirror, species, hatchedAt: at };
    return {
      mirror: next,
      // 비밀 문서가 없거나 망가졌으면 이번에 고른 종으로 고쳐 적습니다
      secret: known ? null : { species, baseXp: mirror.baseXp },
      pet: petProgress(next, growth),
      event: "hatched",
    };
  }
  return { error: { message: "펫 요청을 확인해 주세요.", status: 400, code: "reading/invalid-request" } };
}
