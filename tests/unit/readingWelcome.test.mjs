// 첫 만남(lib/readingWelcome.js) — 참여 코드로 반에 들어온 학생에게 캐릭터 → 책 친구(알) → 큰 알 화면을 차례로
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WELCOME_TTL_MS, clearWelcome, parseWelcome, patchWelcome, readWelcome, startWelcome, welcomeKey, welcomePending, welcomeStep,
} from "@/lib/readingWelcome";

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}
const NOW = Date.UTC(2026, 10, 15, 3, 0, 0);
// 반 문서 · 캐릭터 · 펫의 첫 답이 모두 온, 아무것도 고르지 않은 새 학생
const fresh = {
  classId: "c1", classLoaded: true,
  characterOn: true, characterLoaded: true, hasCharacter: false,
  petOn: true, petLoaded: true, hasPet: false,
};

test("표시 — 반에 들어온 순간 남기고, 단계를 마칠 때 더해 적고, 끝나면 지운다", () => {
  const store = memoryStorage();
  assert.equal(readWelcome("u1", store, NOW), null);
  assert.equal(startWelcome("u1", "c1", store, NOW), true);
  assert.deepEqual(readWelcome("u1", store, NOW), { classId: "c1", at: NOW, character: false, egg: null });
  assert.equal(welcomePending("u1", "c1", store, NOW), true);
  assert.equal(welcomePending("u1", "c2", store, NOW), false, "다른 반의 표시면 진행 중이 아님");
  assert.equal(welcomePending("u2", "c1", store, NOW), false, "학생마다 따로");
  patchWelcome("u1", { character: true }, store, NOW);
  patchWelcome("u1", { egg: { species: "cat" } }, store, NOW);
  assert.deepEqual(readWelcome("u1", store, NOW), { classId: "c1", at: NOW, character: true, egg: { species: "cat" } });
  clearWelcome("u1", store);
  assert.equal(readWelcome("u1", store, NOW), null);
  assert.equal(store.map.size, 0);
  assert.equal(patchWelcome("u1", { character: true }, store, NOW), false, "표시가 없으면 새로 만들지 않음");
  assert.equal(store.map.size, 0);
});

test("표시 — 다른 반에 새로 들어오면 갈아 끼우고, 무작위 알은 종 없이 적는다", () => {
  const store = memoryStorage();
  startWelcome("u1", "c1", store, NOW);
  patchWelcome("u1", { character: true }, store, NOW);
  startWelcome("u1", "c2", store, NOW + 1000);
  assert.deepEqual(readWelcome("u1", store, NOW + 1000), { classId: "c2", at: NOW + 1000, character: false, egg: null });
  patchWelcome("u1", { egg: { species: null } }, store, NOW);
  assert.deepEqual(readWelcome("u1", store, NOW + 1000).egg, { species: null });
});

test("표시 — 틀린 값 · 한 달 넘게 묵은 값 · 미래의 값은 버리고 지운다", () => {
  const store = memoryStorage();
  for (const raw of ["", "{", "null", "[]", '{"v":2,"classId":"c1","at":1}', '{"v":1,"classId":"","at":1}', '{"v":1,"classId":"c1"}', '{"v":1,"classId":"c1","at":-5}']) {
    assert.equal(parseWelcome(raw, NOW), null, raw);
  }
  assert.equal(parseWelcome(JSON.stringify({ v: 1, classId: "c1", at: NOW - WELCOME_TTL_MS - 1 }), NOW), null, "묵은 값");
  assert.equal(parseWelcome(JSON.stringify({ v: 1, classId: "c1", at: NOW + WELCOME_TTL_MS + 1 }), NOW), null, "시계가 틀린 기기의 먼 미래");
  assert.deepEqual(parseWelcome(JSON.stringify({ v: 1, classId: "c1", at: NOW - 1000, egg: { species: 42 } }), NOW).egg, { species: null },
    "알의 종이 이상하면 신비한 알로");
  store.setItem(welcomeKey("u1"), JSON.stringify({ v: 1, classId: "c1", at: NOW - WELCOME_TTL_MS - 1 }));
  assert.equal(readWelcome("u1", store, NOW), null);
  assert.equal(store.map.size, 0, "묵은 표시는 읽으면서 지움");
});

test("표시 — 사이트 저장이 막힌 기기에서도 오류 없이 '없음'", () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(startWelcome("u1", "c1", blocked, NOW), false);
  assert.equal(readWelcome("u1", blocked, NOW), null);
  assert.equal(welcomePending("u1", "c1", blocked, NOW), false, "막힌 기기는 지금처럼 상단바가 알을 줌");
  assert.equal(clearWelcome("u1", blocked), false);
  assert.equal(startWelcome("", "c1", memoryStorage(), NOW), false);
  assert.equal(startWelcome("u1", "", memoryStorage(), NOW), false);
});

test("단계 — 새 학생: 캐릭터 → 펫 → 큰 알 → 끝", () => {
  const w = { classId: "c1", at: NOW, character: false, egg: null };
  assert.equal(welcomeStep(w, fresh), "character");
  assert.equal(welcomeStep({ ...w, character: true }, fresh), "pet", "캐릭터를 고르거나 건너뛰면 펫");
  assert.equal(welcomeStep(w, { ...fresh, hasCharacter: true }), "pet", "저장되어 캐릭터가 생기면 펫");
  assert.equal(welcomeStep({ ...w, character: true, egg: { species: null } }, fresh), "egg", "알을 받았으면 큰 알 화면");
  assert.equal(welcomeStep({ ...w, egg: { species: "owl" } }, { ...fresh, hasPet: true }), "egg", "큰 알 화면은 펫이 생긴 뒤에도 그대로");
  assert.equal(welcomeStep({ ...w, character: true }, { ...fresh, hasPet: true }), "done");
});

test("단계 — 첫 답이 오기 전에는 아무것도 띄우지 않는다(빈 값은 '아직 모름')", () => {
  const w = { classId: "c1", at: NOW, character: false, egg: null };
  assert.equal(welcomeStep(w, { ...fresh, classLoaded: false }), "wait");
  assert.equal(welcomeStep(w, { ...fresh, characterLoaded: false }), "wait");
  assert.equal(welcomeStep({ ...w, character: true }, { ...fresh, petLoaded: false }), "wait");
  assert.equal(welcomeStep(w, { ...fresh, characterOn: false, petLoaded: false }), "wait");
});

test("단계 — 반이 쓰지 않는 것 · 이미 있는 것은 건너뛴다", () => {
  const w = { classId: "c1", at: NOW, character: false, egg: null };
  assert.equal(welcomeStep(w, { ...fresh, characterOn: false }), "pet", "캐릭터를 끈 반은 곧바로 펫");
  assert.equal(welcomeStep(w, { ...fresh, characterOn: false, characterLoaded: false }), "pet", "끈 반은 캐릭터 답을 기다리지 않음");
  assert.equal(welcomeStep(w, { ...fresh, petOn: false }), "character", "펫을 끈 반은 캐릭터만");
  assert.equal(welcomeStep({ ...w, character: true }, { ...fresh, petOn: false, petLoaded: false }), "done");
  assert.equal(welcomeStep(w, { ...fresh, hasCharacter: true, hasPet: true }), "done", "다른 반에서 이미 고른 학생");
  assert.equal(welcomeStep(w, { ...fresh, characterOn: false, petOn: false }), "done", "책나눔을 끈 반");
});

test("단계 — 이 반의 표시가 아니면 첫 만남이 아니다", () => {
  const w = { classId: "c1", at: NOW, character: false, egg: null };
  assert.equal(welcomeStep(null, fresh), null);
  assert.equal(welcomeStep(w, { ...fresh, classId: "c2" }), null);
  assert.equal(welcomeStep(w, { ...fresh, classId: null }), null);
});
