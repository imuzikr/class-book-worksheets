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
//
// **펫 먹이**(lib/petCare.js — 체험반은 켜 둠)의 여러 모습도 미리 정해 둡니다 — 배부름은 '어제까지 셈한 값'으로
// 적어, 체험반을 여는 날이 언제든 같은 모습으로 시작합니다(그 뒤로는 실서비스처럼 날마다 10씩 줄어듦).
//   · 30101 배부름 70(넉넉함) · 30102 배부름 30(배고프다고 말함) · 30103 배부름 10(오늘이 고비)
//   · 30104 **먹이를 찾아 떠남**(사흘 전 · 다시 부르기 1걸음) · 30105 배부름 100 · 나머지는 50~90
//   · 알 둘도 배부름이 있습니다(알은 과일을 먹지 않고 책을 읽어 지킴) — 30113 80 · 30114 40
// =============================================================
import { PET_SPECIES } from "./readingPet.js";
import { readingDayKey, readingDayNumber } from "./reading.js";

// 학생 차례 → 배부름(어제까지 셈한 값). 없는 차례는 50~90을 돌려 씁니다.
const DEMO_FULL = new Map([[0, 70], [1, 30], [2, 10], [4, 100], [12, 80], [13, 40]]);
// 먹이를 찾아 떠난 펫의 학생 차례
const DEMO_AWAY = new Set([3]);
function demoCare(index, today) {
  if (!today) return null;
  const n = readingDayNumber(today);
  const day = readingDayKey(n - 1);
  if (DEMO_AWAY.has(index)) {
    return { full: 0, day, kept: null, away: { on: readingDayKey(n - 3), days: [readingDayKey(n - 1)], fruit: 0 }, back: 0, fed: null };
  }
  return { full: DEMO_FULL.get(index) ?? 50 + (index % 5) * 10, day, kept: null, away: null, back: 0, fed: null };
}

// 학생 차례(0부터) → 알인 채로 둘 펫 경험치
const DEMO_EGGS = new Map([[12, 60], [13, 130]]);
// 아직 알을 받지 않은 학생의 차례
const DEMO_NO_PET = new Set([14]);

/** 체험 학생 한 명의 펫 — index: 데모 명단의 차례, growthXp: 그 학생의 지금 '독서로 얻은 경험치'.
 *  알을 아직 안 받은 학생이면 null. */
// today — 서울 날짜('YYYY-MM-DD'). 주면 펫 먹이의 배부름(care)을 그날 기준으로 함께 적습니다.
export function createDemoPet(index, growthXp, now = Date.UTC(2026, 8, 1), today = null) {
  if (DEMO_NO_PET.has(index)) return null;
  const species = PET_SPECIES[((index % PET_SPECIES.length) + PET_SPECIES.length) % PET_SPECIES.length].key;
  const growth = Math.max(0, Math.round(Number(growthXp) || 0));
  const care = demoCare(index, today);
  if (DEMO_EGGS.has(index)) {
    const baseXp = Math.max(0, growth - DEMO_EGGS.get(index));
    return { mirror: { species: null, baseXp, assignedAt: now, hatchedAt: null, ...(care ? { care } : {}) }, secret: species };
  }
  return { mirror: { species, baseXp: 0, assignedAt: now, hatchedAt: now, ...(care ? { care } : {}) }, secret: species };
}
