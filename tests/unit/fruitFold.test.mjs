// 과일 경험치를 '이어서' 세는 셈(lib/reading.js의 readingFruitFold) — 처음부터 전부 센 것과 늘 같아야 합니다.
// 서버는 반 집계에 { 과일 날, 어디까지 셌나 }를 적어 두고 그 뒤의 지급 이력만 읽습니다(lib/server/readingService.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { kstToday, readingFruitBase, readingFruitFold, readingFruitGains, READING_FORMULA } from "../../lib/reading.js";

// 바꾸기 전의 셈 그대로 — 처음부터 센 값이 예전과 같은지 견줍니다.
function oldGains(events = [], now = new Date()) {
  const byClass = new Map();
  for (const e of events) {
    const delta = Math.round(Number(e?.delta));
    const at = e?.at instanceof Date ? e.at : typeof e?.at?.toDate === "function" ? e.at.toDate() : e?.at ? new Date(e.at) : null;
    if (!e?.classId || typeof e.classId !== "string" || !Number.isFinite(delta) || !delta || !at || Number.isNaN(at.getTime())) continue;
    if (!byClass.has(e.classId)) byClass.set(e.classId, []);
    byClass.get(e.classId).push({ delta, at });
  }
  const today = kstToday(now);
  const days = new Map();
  for (const [classId, list] of byClass) {
    list.sort((a, b) => a.at - b.at);
    let total = 0;
    let peak = 0;
    for (const { delta, at } of list) {
      total += delta;
      if (total <= peak) continue;
      const date = kstToday(at);
      if (date > today) continue;
      const key = `${classId}|${date}`;
      days.set(key, { classId, date, count: (days.get(key)?.count ?? 0) + (total - peak) });
      peak = total;
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date) || a.classId.localeCompare(b.classId));
}

// 늘 같은 값을 내는 난수(mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = Date.parse("2026-10-20T00:00:00Z");
const END = new Date("2026-11-03T12:00:00Z");

// 두 반 · 열흘 남짓 · 빼기(−1 · −2)가 섞인 지급 이력. 시각은 모두 다른 ms.
function randomEvents(seed, n = 40) {
  const r = rng(seed);
  const deltas = [-2, -1, 1, 1, 1, 2, 3];
  let t = START;
  const list = [];
  for (let i = 0; i < n; i += 1) {
    t += 1 + Math.floor(r() * 9 * 3600000);
    list.push({ id: `e${String(i).padStart(3, "0")}`, classId: r() < 0.6 ? "c1" : "c2", delta: deltas[Math.floor(r() * deltas.length)], at: new Date(t) });
  }
  return list;
}

const shuffle = (list, seed) => {
  const r = rng(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// 서버의 이어 읽기 질의(at >= cursor의 ms)가 돌려줄 이력 — 이미 센 마지막 것이 다시 섞여 옵니다.
function queryAfter(events, cursor) {
  return events.filter((e) => !cursor[e.classId] || e.at.getTime() >= cursor[e.classId].ms);
}

test("처음부터 셀 때는 예전 셈과 같은 값", () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const events = randomEvents(seed);
    assert.deepEqual(readingFruitGains(events, END), oldGains(events, END), `seed ${seed}`);
    // 받는 차례가 섞여 와도 같음
    assert.deepEqual(readingFruitGains(shuffle(events, seed), END), oldGains(events, END), `shuffled ${seed}`);
  }
});

test("어느 시점에서 끊어 이어 세도 처음부터 센 것과 과일 날 · cursor가 같음", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const events = randomEvents(seed);
    const whole = readingFruitFold(events, null, END);
    for (let k = 0; k <= events.length; k += 1) {
      // 첫 셈 — 그때까지 있던 이력만(그 순간이 '지금')
      const firstNow = k === 0 ? new Date(START) : events[k - 1].at;
      const first = readingFruitFold(events.slice(0, k), null, firstNow);
      // 반 집계에 적었다 읽은 모양(JSON)으로 이어 셈
      const base = JSON.parse(JSON.stringify(first));
      const resumed = readingFruitFold(queryAfter(events, base.cursor), base, END);
      assert.deepEqual(resumed, whole, `seed ${seed} · split ${k}`);
      // 이미 센 것까지 통째로 다시 넘겨도 같음
      assert.deepEqual(readingFruitFold(shuffle(events, k), base, END), whole, `seed ${seed} · split ${k} · overlap`);
    }
  }
});

test("여러 번에 나눠 이어 세도 같음", () => {
  for (let seed = 100; seed <= 130; seed += 1) {
    const events = randomEvents(seed, 60);
    const r = rng(seed);
    let base = null;
    let i = 0;
    while (i < events.length) {
      const step = 1 + Math.floor(r() * 7);
      const upto = Math.min(events.length, i + step);
      const now = events[upto - 1].at;
      const cursor = base?.cursor ?? {};
      base = JSON.parse(JSON.stringify(readingFruitFold(queryAfter(events.slice(0, upto), cursor), base, now)));
      i = upto;
    }
    assert.deepEqual(readingFruitFold(queryAfter(events, base.cursor), base, END), readingFruitFold(events, null, END), `seed ${seed}`);
  }
});

test("−1로 되돌린 뒤의 +1은 다음 날 이어 셀 때도 두 번 세지 않음 — '오늘 것만' 세면 틀리는 경우", () => {
  const at = (iso) => new Date(iso);
  const yesterday = [
    { id: "a", classId: "c", delta: 3, at: at("2026-10-27T01:00:00Z") },
    { id: "b", classId: "c", delta: -1, at: at("2026-10-27T02:00:00Z") },
  ];
  const today = [
    { id: "c", classId: "c", delta: 1, at: at("2026-10-28T01:00:00Z") },
    { id: "d", classId: "c", delta: 2, at: at("2026-10-28T02:00:00Z") },
  ];
  const now = new Date("2026-10-28T03:00:00Z");
  const first = readingFruitFold(yesterday, null, new Date("2026-10-27T03:00:00Z"));
  assert.deepEqual(first.cursor.c, { total: 2, peak: 3, ms: Date.parse("2026-10-27T02:00:00Z"), ns: 0, id: "b" });
  const resumed = readingFruitFold(today, first, now);
  // 누계 2 → 3(최고치 3을 못 넘음 · 0개) → 5(최고치를 2 넘음 · 2개)
  assert.deepEqual(resumed.days, [
    { classId: "c", date: "2026-10-27", count: 3 },
    { classId: "c", date: "2026-10-28", count: 2 },
  ]);
  assert.deepEqual(resumed.days, readingFruitGains([...yesterday, ...today], now));
  // 오늘 것만 처음부터 세면 +1도 세어 3개가 됩니다(틀린 값)
  assert.equal(readingFruitGains(today, now)[0].count, 3);
});

test("아직 오지 않은 날의 이력(시계 차이)은 세지 않고, cursor도 그 앞에 멈춰 다음에 셈", () => {
  const events = [
    { id: "a", classId: "c", delta: 1, at: new Date("2026-10-27T10:00:00Z") },
    { id: "b", classId: "c", delta: 2, at: new Date("2026-10-28T15:30:00Z") }, // 서울 10-29
  ];
  const now = new Date("2026-10-28T14:00:00Z"); // 서울 10-28 23:00
  const early = readingFruitFold(events, null, now);
  assert.deepEqual(early.days, [{ classId: "c", date: "2026-10-27", count: 1 }]);
  assert.equal(early.cursor.c.id, "a");
  const later = readingFruitFold(events, JSON.parse(JSON.stringify(early)), new Date("2026-10-29T01:00:00Z"));
  assert.deepEqual(later, readingFruitFold(events, null, new Date("2026-10-29T01:00:00Z")));
  assert.equal(later.days.at(-1).count, 2);
});

test("Firestore 시각(초 · 나노초) — 같은 ms 안의 두 건도 차례를 가려 이어 셈", () => {
  // 같은 ms(…000.5ms · …000.7ms): −1 다음 +1 → 최고치를 못 넘음(0개)
  const ts = (ns) => ({ seconds: 1793000000, nanoseconds: ns });
  const plus = { id: "z", classId: "c", delta: 1, at: ts(700000) };
  const minus = { id: "y", classId: "c", delta: -1, at: ts(500000) };
  const seed = { id: "x", classId: "c", delta: 1, at: ts(100000) };
  const now = new Date(1793000000 * 1000 + 60000);
  const all = readingFruitFold([plus, seed, minus], null, now);
  assert.deepEqual(all.days.map((d) => d.count), [1]);
  assert.deepEqual(all.cursor.c, { total: 1, peak: 1, ms: 1793000000000, ns: 700000, id: "z" });
  // '−1'까지 센 뒤 끊고, 같은 ms의 셋을 다시 받아 이어 셈 — 이미 센 둘은 거르고 +1만
  const first = readingFruitFold([seed, minus], null, now);
  assert.equal(first.cursor.c.ns, 500000);
  assert.deepEqual(readingFruitFold([plus, seed, minus], JSON.parse(JSON.stringify(first)), now), all);
  // toDate()만 있는 시각도 받음
  const dated = { id: "w", classId: "c", delta: 2, at: { toDate: () => new Date(1793000000 * 1000 + 1000) } };
  assert.equal(readingFruitFold([dated], null, now).days[0].count, 2);
});

test("이력 모양이 틀린 것 — 반 · 시각이 없으면 건너뛰고, 개수가 틀리면 세지 않되 cursor는 넘어감", () => {
  const now = new Date("2026-10-28T03:00:00Z");
  const events = [
    { id: "a", classId: "c", delta: 2, at: new Date("2026-10-27T01:00:00Z") },
    { id: "b", classId: "c", delta: "x", at: new Date("2026-10-27T02:00:00Z") },
    { id: "c", classId: "", delta: 5, at: new Date("2026-10-27T02:30:00Z") },
    { id: "d", classId: "c", delta: 5, at: null },
  ];
  const fold = readingFruitFold(events, null, now);
  assert.deepEqual(fold.days, [{ classId: "c", date: "2026-10-27", count: 2 }]);
  assert.equal(fold.cursor.c.id, "b");
  assert.deepEqual(Object.keys(fold.cursor), ["c"]);
});

test("반 집계에서 이어 셀 바탕 — 지금 든 반 · 온전한 cursor만, 옛 집계는 처음부터", () => {
  const cursor = { c1: { total: 2, peak: 3, ms: 1, ns: 0, id: "e1" }, c2: { total: 1, peak: 1, ms: 2, ns: 0, id: "e2" } };
  const allFruits = [
    { classId: "c1", date: "2026-10-27", count: 3 },
    { classId: "c2", date: "2026-10-27", count: 1 },
  ];
  const saved = { formula: READING_FORMULA, allFruits, fruitCursor: cursor };
  // 둘 다 든 반
  assert.deepEqual(readingFruitBase(saved, ["c1", "c2"]), { days: allFruits, cursor });
  // c2에서 빠짐 — c2의 과일 날도 버림(처음부터 셀 때도 c2는 세지 않음)
  assert.deepEqual(readingFruitBase(saved, ["c1"]), { days: [allFruits[0]], cursor: { c1: cursor.c1 } });
  // cursor가 없거나 · 계산 기준이 바뀌었거나 · 과일 날이 없으면 처음부터
  const empty = { days: [], cursor: {} };
  assert.deepEqual(readingFruitBase({ formula: READING_FORMULA, allFruits }, ["c1"]), empty);
  assert.deepEqual(readingFruitBase({ ...saved, formula: READING_FORMULA - 1 }, ["c1"]), empty);
  assert.deepEqual(readingFruitBase({ formula: READING_FORMULA, fruitCursor: cursor }, ["c1"]), empty);
  assert.deepEqual(readingFruitBase(null, ["c1"]), empty);
  // 망가진 cursor 칸은 그 반만 처음부터
  const broken = { ...saved, fruitCursor: { c1: { ...cursor.c1, total: 9 }, c2: cursor.c2 } };
  assert.deepEqual(readingFruitBase(broken, ["c1", "c2"]), { days: [allFruits[1]], cursor: { c2: cursor.c2 } });
});

test("바탕에 cursor가 없는 반의 과일 날은 버리고 그 반은 넘겨받은 이력으로 처음부터", () => {
  const now = new Date("2026-10-28T03:00:00Z");
  const base = { days: [{ classId: "gone", date: "2026-10-20", count: 9 }], cursor: {} };
  const events = [{ id: "a", classId: "new", delta: 1, at: new Date("2026-10-27T01:00:00Z") }];
  assert.deepEqual(readingFruitFold(events, base, now).days, [{ classId: "new", date: "2026-10-27", count: 1 }]);
});
