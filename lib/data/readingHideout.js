// 개인 아지트는 열 때 한 번 읽고 '꾸미기 완료'에서 한 번 저장합니다.
// 미리보기·소품 선택은 로컬 상태만 바꾸며 실시간 위치나 독서 정본을 쓰지 않습니다.
import { isFirebaseConfigured } from "../firebase";
import { demoSuspendedSet, isTeacher } from "../user";
import { deriveReading, hideoutOn } from "../reading";
import { hideoutProgress, normalizeHideoutRoom, validateHideoutLayout } from "../readingHideout";
import { mock } from "./shared";
import { demoReadingAccess, demoReadingState, readingRequest } from "./reading";

const demoRooms = new Map();
const demoQueues = new Map();
const demoEpochs = new Map();
const memoryOnlyUids = new Set();
const storageKey = (uid) => `bookbom.reading.hideout.v2:${encodeURIComponent(uid)}`;
const legacyStorageKey = (uid) => `bookbom.reading.hideout.v1:${encodeURIComponent(uid)}`;
const fail = (message, code = "reading/invalid-hideout") => Object.assign(new Error(message), { code });

function demoGate(classId, targetUid = null) {
  if (typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(classId)) throw fail("반을 먼저 선택해 주세요.");
  if (targetUid != null && (typeof targetUid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(targetUid))) {
    throw fail("학생을 확인해 주세요.");
  }
  const user = demoReadingAccess(classId, targetUid);
  if (!hideoutOn(mock.classes.find((cls) => cls.id === classId))) {
    throw fail("이 반에서는 개인 아지트를 사용하지 않습니다.", "reading/hideout-disabled");
  }
  const uid = targetUid || user.uid;
  if (uid !== user.uid) {
    const target = mock.demoUsers?.find((profile) => profile.uid === uid);
    if (!target || (target.role || "student") !== "student") throw fail("이 반의 학생이 아닙니다.", "reading/not-member");
  }
  if (!isTeacher(user) && (user.suspended === true || demoSuspendedSet().has(user.uid))) {
    throw fail("사용이 중지된 계정입니다.", "reading/suspended");
  }
  if (uid === user.uid && (user.role || "student") !== "student") {
    throw fail("학생의 아지트에서 확인해 주세요.", "reading/hideout-students-only");
  }
  return { user, uid };
}

function storedRoom(uid) {
  // 할당량 초과처럼 쓰기만 막힌 저장소에는 이전 값이 남아 있을 수 있습니다.
  // 이 경우에는 방금 저장한 메모리가 정본이며, 다시 쓰기에 성공할 때 저장소로 돌아갑니다.
  if (memoryOnlyUids.has(uid)) return demoRooms.get(uid) ?? null;
  try {
    if (typeof window !== "undefined") {
      const value = window.localStorage.getItem(storageKey(uid)) ?? window.localStorage.getItem(legacyStorageKey(uid));
      return value == null ? null : JSON.parse(value);
    }
  } catch { /* 차단되거나 손상된 체험 환경에서는 이번 탭의 메모리만 씁니다. */ }
  return demoRooms.get(uid) ?? null;
}

function validateRoomInput(room) {
  if (!room || typeof room !== "object" || Array.isArray(room)
    || Reflect.ownKeys(room).some((key) => !["version", "layout", "revision"].includes(key))
    || room.version !== 2 || !Number.isSafeInteger(room.revision) || room.revision < 0 || room.revision >= Number.MAX_SAFE_INTEGER) {
    throw fail("아지트 저장 형식을 확인해 주세요.");
  }
}

export async function fetchReadingHideout(classId, targetUid = null) {
  if (isFirebaseConfigured) {
    return readingRequest(`/api/reading/hideout?classId=${encodeURIComponent(classId)}${targetUid ? `&uid=${encodeURIComponent(targetUid)}` : ""}`);
  }
  const { uid } = demoGate(classId, targetUid);
  const summary = deriveReading(demoReadingState(uid), new Date());
  return { room: normalizeHideoutRoom(storedRoom(uid), summary), progress: hideoutProgress(summary) };
}

export async function saveReadingHideout(classId, room) {
  validateRoomInput(room);
  if (isFirebaseConfigured) {
    return readingRequest("/api/reading/hideout", { method: "POST", body: JSON.stringify({ classId, room }) });
  }
  const { uid } = demoGate(classId);
  const input = structuredClone(room);
  const epoch = demoEpochs.get(uid) ?? 0;
  const previous = demoQueues.get(uid) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(() => {
    // 체험 학생을 바꾼 동안 기다리던 저장은 새 학생의 방에 적용하지 않습니다.
    if (demoGate(classId).uid !== uid || (demoEpochs.get(uid) ?? 0) !== epoch) {
      throw fail("사용자가 바뀌었어요. 아지트를 다시 열어 주세요.", "reading/unauthenticated");
    }
    const summary = deriveReading(demoReadingState(uid), new Date());
    const layout = validateHideoutLayout(input.layout, summary);
    const current = normalizeHideoutRoom(storedRoom(uid), summary);
    if (current.revision !== input.revision) {
      throw fail("다른 창에서 아지트가 바뀌었어요. 다시 불러온 뒤 꾸며 주세요.", "reading/hideout-conflict");
    }
    const changed = JSON.stringify(current.layout) !== JSON.stringify(layout);
    const saved = { version: 2, layout, revision: current.revision + (changed ? 1 : 0) };
    if (changed) {
      demoRooms.set(uid, structuredClone(saved));
      try {
        window.localStorage.setItem(storageKey(uid), JSON.stringify(saved));
        memoryOnlyUids.delete(uid);
      } catch { memoryOnlyUids.add(uid); }
    }
    return { room: saved, progress: hideoutProgress(summary) };
  });
  demoQueues.set(uid, operation);
  try { return await operation; }
  finally { if (demoQueues.get(uid) === operation) demoQueues.delete(uid); }
}

// 교사의 학생 탈퇴 절차에서만 부릅니다. 반 소속 제거·반 삭제 때는 개인 방을 보존합니다.
export function clearDemoReadingHideout(uid) {
  if (isFirebaseConfigured) return;
  demoRooms.delete(uid);
  demoEpochs.set(uid, (demoEpochs.get(uid) ?? 0) + 1);
  memoryOnlyUids.delete(uid);
  try {
    window.localStorage.removeItem(storageKey(uid));
    window.localStorage.removeItem(legacyStorageKey(uid));
  } catch { /* 메모리도 이미 지웠습니다. */ }
}
