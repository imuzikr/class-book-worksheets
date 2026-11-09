// =============================================================
// 데모 반의 독서 펫 — 체험 학생 15명에게 미리 정해 둔 펫(실서비스는 서버가 무작위로 줌)
// -------------------------------------------------------------
// 열 종이 모두 보이게 학생 차례대로 종을 돌려 줍니다. 대부분은 알을 받은 뒤 독서 경험치가
// 그대로 펫 경험치가 된 모습(이미 깨어남)이고, 둘은 아직 알입니다 — 하나는 곧 깨어날 알
// (펫 경험치 130 — '알 깨우기'를 눌러 볼 수 있음), 하나는 아직 따뜻해지는 중인 알(60).
// 마지막 학생(30115)은 **아직 알을 받지 않았습니다** — 그 학생으로 바꾸면 상단바가 알을 주고
// '알을 받았어요' 알림이 뜹니다(실서비스에서 처음 들어온 학생이 겪는 그 순간).
// 알의 종은 화면에 안 보이는 secret에만 적습니다(실서비스의 users/{uid}/reading/pet과 같은 자리).
// 셈은 lib/readingPet.js. 시험 tests/unit/readingPet.test.mjs.
// =============================================================
import { PET_SPECIES } from "./readingPet.js";

// 학생 차례(0부터) → 알인 채로 둘 펫 경험치
const DEMO_EGGS = new Map([[12, 60], [13, 130]]);
// 아직 알을 받지 않은 학생의 차례
const DEMO_NO_PET = new Set([14]);

/** 체험 학생 한 명의 펫 — index: 데모 명단의 차례, growthXp: 그 학생의 지금 '독서로 얻은 경험치'.
 *  알을 아직 안 받은 학생이면 null. */
export function createDemoPet(index, growthXp, now = Date.UTC(2026, 8, 1)) {
  if (DEMO_NO_PET.has(index)) return null;
  const species = PET_SPECIES[((index % PET_SPECIES.length) + PET_SPECIES.length) % PET_SPECIES.length].key;
  const growth = Math.max(0, Math.round(Number(growthXp) || 0));
  if (DEMO_EGGS.has(index)) {
    const baseXp = Math.max(0, growth - DEMO_EGGS.get(index));
    return { mirror: { species: null, baseXp, assignedAt: now, hatchedAt: null }, secret: species };
  }
  return { mirror: { species, baseXp: 0, assignedAt: now, hatchedAt: now }, secret: species };
}
