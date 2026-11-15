// =============================================================
// 첫 만남 — 참여 코드로 반에 막 들어온 학생에게 '캐릭터 고르기 → 책 친구(알) 받기 → 큰 알 화면'(선생님 요청)
// -------------------------------------------------------------
// 참여 코드가 맞아 반에 들어온 순간(components/ClassEntry.jsx) 이 기기에 표시를 남기고, 상단바
// (components/TopNav.jsx → components/reading/StudentWelcome.jsx)가 그 반의 설정과 학생의 지금 상태를 보고
// 차례로 창을 띄웁니다.
//   ① 캐릭터 — 그 반이 학생 캐릭터를 쓰고(책 봄 · 학생 캐릭터) 아직 고른 캐릭터가 없을 때. 닫으면 건너뜀(기본 캐릭터).
//   ② 펫 — 그 반이 학생 펫을 쓰고 아직 알이 없을 때. 펫 미리보기를 켠 반은 고르는 창(고른 친구의 알 · 닫으면 신비한 알),
//      아니면 곧바로 무작위 알(서버가 고름 · 알 단계 동안 비밀).
//   ③ 큰 알 — '책 친구가 함께해요'와 커다란 알. 닫으면 끝(표시를 지움).
// 이미 고른 캐릭터 · 이미 받은 알은 다시 묻지 않습니다(다른 반에서 이미 고른 학생). 묻을 것이 없으면 아무 창도 없이 표시만 지웁니다.
// 표시는 이 기기에만 둡니다(localStorage) — 다른 기기에서 처음 연 학생은 지금처럼(상단바가 알을 무작위로 주고 알림 한 줄).
// 표시가 있는 동안은 상단바 · 펫 카드가 알을 스스로 받지 않습니다(고르는 창보다 무작위 알이 먼저 오지 않게 — welcomePending).
// 이 파일은 순수한 셈 · 저장소 읽고 쓰기만 합니다(시험 tests/unit/readingWelcome.test.mjs).
// =============================================================

// 표시가 바뀌면(남김 · 고침 · 지움) 창 이벤트로 알립니다 — 상단바가 다시 읽습니다.
export const WELCOME_EVENT = "bookbom:welcome-change";
// 오래 묵은 표시는 버립니다(반에 들어온 뒤 한 달 — 그 사이 다른 기기로만 들어온 학생의 옛 표시가 남지 않게)
export const WELCOME_TTL_MS = 30 * 24 * 3600 * 1000;
const VERSION = 1;

export const welcomeKey = (uid) => `bookbom.welcome.v${VERSION}:${encodeURIComponent(String(uid ?? ""))}`;

function storageOf(storage) {
  if (storage) return storage;
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // 사이트 저장을 막은 기기
  }
}
function announce() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try { window.dispatchEvent(new Event(WELCOME_EVENT)); } catch { /* 알리지 못해도 다음에 읽을 때 맞춰짐 */ }
}

const cleanSpecies = (v) => (typeof v === "string" && v.length > 0 && v.length <= 20 ? v : null);

/** 저장된 글자 → 표시 { classId, at, character(캐릭터 단계를 마쳤나), egg: { species } | null } · 틀리거나 묵었으면 null */
export function parseWelcome(raw, now = Date.now()) {
  if (typeof raw !== "string" || !raw) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value) || value.v !== VERSION) return null;
  const classId = typeof value.classId === "string" && value.classId.length > 0 && value.classId.length <= 200 ? value.classId : null;
  const at = typeof value.at === "number" && Number.isFinite(value.at) && value.at > 0 ? value.at : null;
  if (!classId || !at) return null;
  if (now - at > WELCOME_TTL_MS || at - now > WELCOME_TTL_MS) return null;
  const egg = value.egg && typeof value.egg === "object" && !Array.isArray(value.egg) ? { species: cleanSpecies(value.egg.species) } : null;
  return { classId, at, character: value.character === true, egg };
}

function save(uid, welcome, storage) {
  const store = storageOf(storage);
  if (!uid || !store) return false;
  try {
    if (welcome) {
      const value = { v: VERSION, classId: welcome.classId, at: welcome.at };
      if (welcome.character) value.character = true;
      if (welcome.egg) value.egg = { species: cleanSpecies(welcome.egg.species) };
      store.setItem(welcomeKey(uid), JSON.stringify(value));
    } else {
      store.removeItem(welcomeKey(uid));
    }
  } catch {
    return false; // 저장이 막힌 기기 — 첫 만남 없이 지금처럼(알은 상단바가 무작위로)
  }
  announce();
  return true;
}

/** 지금 이 학생의 첫 만남 표시(없거나 묵었으면 null — 묵은 것은 지움) */
export function readWelcome(uid, storage, now = Date.now()) {
  const store = storageOf(storage);
  if (!uid || !store) return null;
  let raw = null;
  try { raw = store.getItem(welcomeKey(uid)); } catch { return null; }
  const welcome = parseWelcome(raw, now);
  if (!welcome && raw) {
    try { store.removeItem(welcomeKey(uid)); } catch { /* 지우지 못해도 읽을 때마다 버림 */ }
  }
  return welcome;
}

/** 참여 코드로 반에 들어온 순간 — 그 반의 첫 만남을 새로 엽니다(앞의 표시가 있으면 갈아 끼움). */
export function startWelcome(uid, classId, storage, now = Date.now()) {
  if (!uid || !classId) return false;
  return save(uid, { classId: String(classId), at: now, character: false, egg: null }, storage);
}

/** 단계를 마칠 때 — { character: true } · { egg: { species } } 를 더해 적습니다(표시가 없으면 아무 일 없음). */
export function patchWelcome(uid, patch, storage, now = Date.now()) {
  const current = readWelcome(uid, storage, now);
  if (!current) return false;
  return save(uid, { ...current, ...patch }, storage);
}

/** 첫 만남을 마치거나 건너뛸 때 */
export function clearWelcome(uid, storage) {
  return save(uid, null, storage);
}

/** 상단바 · 펫 카드가 알을 스스로 받기 전에 — 이 반의 첫 만남이 진행 중이면 참(그동안은 첫 만남이 알을 줌) */
export function welcomePending(uid, classId, storage, now = Date.now()) {
  if (!uid || !classId) return false;
  return readWelcome(uid, storage, now)?.classId === classId;
}

/**
 * 지금 띄울 단계.
 * welcome — 표시(readWelcome) · state — 상단바가 이미 들고 있는 값:
 *   classId(지금 반) · classLoaded(반 문서의 첫 답이 왔나) · characterOn · characterLoaded · hasCharacter
 *   petOn · petLoaded(서버에서 확인된 답이 왔나) · hasPet
 * 돌려줌 null(이 반의 첫 만남이 아님) | "wait"(아직 모름 — 아무것도 안 띄움) | "character" | "pet" | "egg" | "done"(물을 것이 없음 — 표시를 지움)
 * 빈 값은 '없다'가 아니라 '아직 안 왔다'일 수 있어, 첫 답이 오기 전에는 늘 "wait"입니다(프로젝트 문서 '첫 화면' 절의 함정).
 */
export function welcomeStep(welcome, state = {}) {
  if (!welcome || !state.classId || welcome.classId !== state.classId) return null;
  if (welcome.egg) return "egg";
  if (!state.classLoaded) return "wait";
  if (state.characterOn && !welcome.character) {
    if (!state.characterLoaded) return "wait";
    if (!state.hasCharacter) return "character";
  }
  if (state.petOn) {
    if (!state.petLoaded) return "wait";
    if (!state.hasPet) return "pet";
  }
  return "done";
}
