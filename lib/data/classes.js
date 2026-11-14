// =============================================================
// 반 · 참여 코드 · 전광판 · 소속(memberships)
// -------------------------------------------------------------
// lib/store.js에서 떼어 낸 조각입니다. 화면은 지금까지처럼 "@/lib/store"에서
// 가져갑니다 — store.js가 여기 공개 이름을 그대로 다시 내보냅니다.
// =============================================================
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { toDate, todayDateKey } from "../dates";
import { db, isFirebaseConfigured, sampleMode } from "../firebase";
import { replaceDoc } from "../mockDocs";
import { getCurrentUser, isAdmin, isTeacher, splitWorkspaceName } from "../user";
import { mock, mockListeners, nextMockSeq, notify, sortByClassOrder } from "./shared";
import { buildMockDirectory, directoryEntry } from "./users";
import { DEMO_CLASSES_KEY, readDemoClasses, writeDemoClasses } from "../demoClasses";
import { DEMO_CLASS_ID } from "../demoClassroom";
import { CLASS_LINKED_COLLECTIONS, CLASS_NESTED, CLASS_SUBCOLLECTIONS } from "../classPurge";
import { purgeBookActivity } from "./books";
import { collectStoragePaths, pathsInClass } from "../storagePaths";
import { deleteStoragePaths } from "../storageUpload";
import { isReadingMapTheme } from "../readingMapCatalog";
import { CLASSROOM_MOVE_WAIT_S } from "../classroomMove";
import { normalizeCareRests } from "../petCare";

// -------------------------------------------------------------
// 반 (Classes) — 공부방의 단위. 학생은 참여 코드로 들어옵니다.
// -------------------------------------------------------------
//   classes (컬렉션)
//     └ { name, joinCode, createdBy, createdAt }
// 질문 게시판은 전체 공유 공간이라 반과 무관합니다.
// -------------------------------------------------------------

// 참여 코드에서 제외하는 글자 — 서로 헷갈리기 쉬운 문자들:
//   O·0 (오/영), I·L·1 (아이/엘/일)
// 남는 문자: A B C D E F G H J K M N P Q R S T U V W X Y Z 2 3 4 5 6 7 8 9 (32자)
const JOIN_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// 헷갈리는 글자를 뺀 참여 코드 1개 생성 (6자리)
function makeJoinCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

// 참여 코드 유효기간(일). 유출된 코드의 수명을 제한합니다.
const CODE_TTL_DAYS = 14;
function codeExpiryFromNow() {
  return new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

// 코드가 이미 쓰이고 있는지 확인.
// 보안: 코드는 joinCodes 컬렉션의 "문서 ID"로 저장하고, 규칙이 읽기를 그 코드를
// 로그인한 사람에게 '정확한 코드로 1건 get'만 엽니다(목록은 막음) — 코드를
// 아는 사람만 반을 찾을 수 있습니다. 읽기가 거부되면(규칙이 바뀐 경우 등)
// 안전하게 '이미 쓰임'으로 보고 다른 코드를 뽑습니다.
async function joinCodeExists(code) {
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "joinCodes", code));
      return snap.exists();
    } catch {
      return true;
    }
  }
  return mock.classes.some((c) => c.joinCode === code);
}

// 기존 코드와 겹치지 않는 참여 코드를 생성합니다(충돌 시 재발급).
async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeJoinCode();
    if (!(await joinCodeExists(code))) return code;
  }
  return makeJoinCode(); // 확률적으로 거의 불가능
}

let demoClassesLoaded = false;
// 체험용 샘플 반(교사가 실제 앱 안에서 연 것)에서는 반 설정도 메모리에만
// 둡니다 — 새로고침하면 처음으로 돌아가고, 브라우저에 아무것도 남지 않습니다.
const sampleClassMemory = (() => {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
})();
function demoClassStorage() {
  if (sampleMode) return sampleClassMemory;
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}
function restoreDemoClasses(force = false) {
  if (typeof window === "undefined" || (demoClassesLoaded && !force)) return;
  const saved = readDemoClasses(demoClassStorage());
  if (saved) {
    const existing = new Map(mock.classes.map((c) => [c.id, c]));
    mock.classes = saved.map((c) => {
      const base = { ...existing.get(c.id) };
      // A removed join code (e.g. archived class) must not return from seeds.
      for (const key of ["joinCode", "codeExpiresAt", "order", "createdAt"]) delete base[key];
      return { ...base, ...c };
    });
    // Older browser snapshots predate the new sample class. Add it once while
    // respecting any saved name, archived status, and explicit disabled flag.
    if (!mock.classes.some((c) => c.id === DEMO_CLASS_ID) && existing.has(DEMO_CLASS_ID)) {
      mock.classes.push(existing.get(DEMO_CLASS_ID));
    }
  }
  if (!demoClassesLoaded) {
    window.addEventListener("storage", (event) => {
      if (event.key !== DEMO_CLASSES_KEY) return;
      restoreDemoClasses(true);
      notify(mockListeners.classes, sortByClassOrder(mock.classes));
    });
  }
  demoClassesLoaded = true;
}
function notifyClasses(persist = true) {
  if (!isFirebaseConfigured && persist && typeof window !== "undefined") {
    writeDemoClasses(mock.classes, demoClassStorage());
  }
  notify(mockListeners.classes, sortByClassOrder(mock.classes));
}

// 반 하나만 읽기 — 이름 정도가 필요한 자리에 씁니다(상단바 반 공지 버튼).
// 목록 전체를 구독하면 그 화면과 무관한 반까지 계속 받게 되므로, 반이
// 바뀔 때 한 번만 읽습니다.
export async function fetchClass(classId) {
  if (!classId) return null;
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "classes", classId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch {
      return null;
    }
  }
  restoreDemoClasses();
  return mock.classes.find((c) => c.id === classId) ?? null;
}

// 반 문서 하나만 구독 — 상단바가 그 반의 기능 스위치(과일 바구니 · 독서 TOP 3 ·
// 캐릭터)를 봅니다. `subscribeClasses`(반 목록 통째로)를 안 쓰는 까닭: 상단바는
// 모든 화면에 늘 떠 있어, 거기서 목록을 구독하면 반이 늘수록 모든 화면이 비싸집니다.
export function subscribeClass(classId, callback) {
  if (!classId) { callback(null); return () => {}; }
  if (isFirebaseConfigured) {
    return onSnapshot(
      doc(db, "classes", classId),
      (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => callback(null)
    );
  }
  restoreDemoClasses();
  demoMoveChannel();
  if (!mockListeners.classes) mockListeners.classes = new Set();
  // 얕은 사본을 넘깁니다 — mock의 다른 쓰기 함수들은 반 객체를 제자리에서
  // 고치는데(`setClassPyTarget` 등), 그러면 같은 참조가 돌아와 React가 다시
  // 그리지 않습니다. Firestore가 스냅샷마다 새 객체를 주는 것과 맞춥니다.
  const emit = () => {
    const c = mock.classes.find((x) => x.id === classId);
    callback(c ? { ...c } : null);
  };
  mockListeners.classes.add(emit);
  emit();
  return () => mockListeners.classes.delete(emit);
}

// 반 목록 실시간 구독 — **보는 사람에게 보이는 반만**입니다.
//   관리자 → 모든 반 · 교사 → 내가 만든 반(where createdBy == 나) ·
//   학생 → 내가 든 반(소속 문서의 반을 한 건씩 onSnapshot).
// 한때 누구에게나 모든 반 문서를 통째로 실어 날랐습니다 — 이 앱을 쓰는 학교 · 선생님이
// 늘수록 화면을 열 때마다 읽기가 늘고, 남의 반 이름 · 설정까지 받았습니다. 지금은
// 규칙도 목록을 좁혀(firestore.rules의 classes `list`) 교사가 남의 반을, 학생이 반 목록을
// 통째로 받지 못합니다. 문서 id로 한 건 읽기(get)는 그대로 열려 있습니다 — 참여 코드로
// 들어갈 때 · 탈퇴 전 다른 선생님 반을 확인할 때 씁니다.
// 차례는 order 필드 순(반 관리하기의 드래그 순서), 없으면 만든 순.
// (Firestore에서 order로 orderBy하면 그 필드가 없는 옛 반이 결과에서
//  통째로 빠지므로, 정렬은 항상 클라이언트에서 합니다)
// viewer: { uid, role } — 보통 로그인한 사용자 객체. 데모 모드는 지금까지처럼 보이는 반 전부.
export function subscribeClasses(viewer, callback) {
  if (isFirebaseConfigured) {
    const uid = viewer?.uid;
    if (!uid) { callback([]); return () => {}; }
    if (isAdmin(viewer)) {
      const q = query(collection(db, "classes"), orderBy("createdAt", "asc"));
      return onSnapshot(
        q,
        (snap) => callback(sortByClassOrder(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
        (e) => { console.warn("[반] 반 목록을 읽지 못했어요:", e?.code, e?.message); callback([]); }
      );
    }
    if (isTeacher(viewer)) return subscribeOwnClasses(uid, callback);
    return subscribeMemberClasses(uid, callback);
  }
  restoreDemoClasses();
  mockListeners.classes.add(callback);
  callback(sortByClassOrder(mock.classes));
  return () => mockListeners.classes.delete(callback);
}

// [교사] 내 프로필의 '내가 만든 반' 목록(users/{uid}.ownedClassIds)에 이 반을 적습니다.
// 규칙이 '내 반 학생인가'를 학생의 classIds와 이 목록이 겹치는지로 봅니다(firestore.rules의
// teachesStudent — 반 문서를 열어 보지 않아 한도에 안 걸림). 반을 만들 때 적고(addClass),
// 이 목록이 생기기 전에 만든 반은 반 목록을 받을 때(subscribeOwnClasses) · 명단을 열 때
// (subscribeClassDirectory) 메웁니다. 규칙이 한 번에 하나씩만 받아 반마다 한 번 씁니다.
// 이미 적힌 반은 쓰지 않습니다 — 로그인할 때 받은 목록(user.ownedClassIds)과 이 세션에서
// 적은 것을 기억합니다. 돌려주는 값: 적혀 있으면 true(실패하면 false).
// 실패한 반은 이 세션에서 다시 쓰지 않습니다(옛 규칙이 남아 있는 동안 반 목록이 올 때마다
// 헛쓰기를 되풀이하지 않게) — 학생 프로필이 막혀 메울 때만 한 번 더 해 봅니다({ retry: true }).
const ownedKnown = new Set();
const ownedFailed = new Set();
let ownedKnownFor = null;
const ownedPending = new Map(); // classId → Promise
export function ensureOwnedClassId(classId, { retry = false } = {}) {
  if (!isFirebaseConfigured || !classId) return Promise.resolve(false);
  const me = getCurrentUser();
  if (!me?.uid || !isTeacher(me)) return Promise.resolve(false);
  // 최고 관리자는 규칙이 모든 프로필을 엽니다 — 남의 반을 열 때 헛쓰기를 하지 않게 건너뜁니다.
  if (isAdmin(me)) return Promise.resolve(true);
  if (ownedKnownFor !== me.uid) {
    ownedKnown.clear();
    ownedFailed.clear();
    ownedPending.clear();
    (me.ownedClassIds ?? []).forEach((id) => ownedKnown.add(id));
    ownedKnownFor = me.uid;
  }
  if (ownedKnown.has(classId)) return Promise.resolve(true);
  if (ownedPending.has(classId)) return ownedPending.get(classId);
  if (ownedFailed.has(classId) && !retry) return Promise.resolve(false);
  const p = updateDoc(doc(db, "users", me.uid), { ownedClassIds: arrayUnion(classId) })
    .then(() => { ownedKnown.add(classId); ownedFailed.delete(classId); return true; })
    .catch((e) => {
      ownedFailed.add(classId);
      console.warn("[반] 내 반 목록에 적지 못했어요:", classId, e?.code, e?.message);
      return false;
    })
    .finally(() => ownedPending.delete(classId));
  ownedPending.set(classId, p);
  return p;
}
function forgetOwnedClassId(classId) {
  ownedKnown.delete(classId);
  ownedFailed.delete(classId);
}

// [교사] 내가 만든 반만(보관된 반 포함) — 등호 하나라 복합 색인이 없습니다(정렬은 화면에서).
// 최고 관리자도 '제 반만' 필요한 자리(떠 있는 동그라미의 메신저 반)는 이것을 씁니다.
export function subscribeOwnClasses(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  if (isFirebaseConfigured) {
    const q = query(collection(db, "classes"), where("createdBy", "==", uid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // 이 목록이 생기기 전에 만든 반을 내 프로필의 반 목록에 메웁니다(이미 적힌 반은 그냥 지나감).
        if (getCurrentUser()?.uid === uid) list.forEach((c) => { ensureOwnedClassId(c.id); });
        callback(sortByClassOrder(list));
      },
      (e) => { console.warn("[반] 내 반 목록을 읽지 못했어요:", e?.code, e?.message); callback([]); }
    );
  }
  restoreDemoClasses();
  mockListeners.classes.add(callback);
  callback(sortByClassOrder(mock.classes));
  return () => mockListeners.classes.delete(callback);
}

// [학생] 내가 든 반 — 소속 문서(memberships, 상단바 · 페이지와 같은 질의라 리스너를 나눠 씀)를
// 따라 반 문서를 한 건씩 구독합니다. 반 수가 보통 하나둘이라 문서도 그만큼만 읽습니다.
// 처음에는 소속의 첫 답과 그 반들의 첫 답이 다 온 뒤에 한 번에 알립니다(하나씩 알리면
// 반이 하나씩 붙었다 떨어지며 화면이 깜빡입니다).
function subscribeMemberClasses(uid, callback) {
  const docs = new Map(); // classId → 반 문서
  const offs = new Map(); // classId → 구독 해제
  const waiting = new Set(); // 첫 답을 기다리는 반
  let membersLoaded = false;
  let timer = null;
  let alive = true;
  const flush = () => {
    timer = null;
    if (!alive || !membersLoaded || waiting.size) return;
    callback(sortByClassOrder([...docs.values()]));
  };
  const schedule = () => { if (!timer) timer = setTimeout(flush, 0); };
  const offMembers = onSnapshot(
    query(collection(db, "memberships"), where("uid", "==", uid)),
    (snap) => {
      const ids = new Set(snap.docs.map((d) => d.data().classId).filter((id) => typeof id === "string" && id));
      for (const [id, off] of offs) {
        if (ids.has(id)) continue;
        off();
        offs.delete(id);
        docs.delete(id);
        waiting.delete(id);
      }
      for (const id of ids) {
        if (offs.has(id)) continue;
        waiting.add(id);
        offs.set(id, onSnapshot(
          doc(db, "classes", id),
          (s) => {
            waiting.delete(id);
            if (s.exists()) docs.set(id, { id, ...s.data() });
            else docs.delete(id);
            schedule();
          },
          () => { waiting.delete(id); docs.delete(id); schedule(); }
        ));
      }
      membersLoaded = true;
      schedule();
    },
    (e) => {
      console.warn("[반] 소속 반을 읽지 못했어요:", e?.code, e?.message);
      membersLoaded = true;
      waiting.clear();
      schedule();
    }
  );
  return () => {
    alive = false;
    clearTimeout(timer);
    offMembers();
    offs.forEach((off) => off());
    offs.clear();
  };
}

// [교사] 반 관리하기에서 드래그로 바꾼 순서를 저장합니다 — orderedIds의
// 배열 위치를 그대로 order로 씁니다(반 개수가 적어 매번 전체를 다시
// 매겨도 비용 문제가 없습니다).
export async function reorderClasses(orderedIds) {
  if (isFirebaseConfigured) {
    const batch = writeBatch(db);
    orderedIds.forEach((id, i) => {
      batch.update(doc(db, "classes", id), { order: i });
    });
    await batch.commit();
    return;
  }
  orderedIds.forEach((id, i) => {
    const cls = mock.classes.find((c) => c.id === id);
    if (cls) cls.order = i;
  });
  notifyClasses();
}

// [교사] 반 만들기 — 참여 코드를 자동 생성해 만든 반을 반환합니다.
// 보안: 코드는 classes 문서가 아니라 joinCodes/{코드} 문서로 저장합니다.
//       (classes를 나열해도 코드가 새지 않음 — 코드 열거 차단)
// (한때 반을 만들 때 공부방의 '선생님 보드'(studyBoards) 한 장을 함께 만들었는데,
//  책봄에는 그것을 읽는 화면이 없어 걷었습니다.)
export async function addClass(user, name, features = null) {
  if (!isFirebaseConfigured) restoreDemoClasses();
  const joinCode = await generateUniqueJoinCode();
  const expiresAt = codeExpiryFromNow();
  if (isFirebaseConfigured) {
    const ref = await addDoc(collection(db, "classes"), {
      name: name.trim(),
      createdBy: user.uid,
      readingEnabled: false,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "joinCodes", joinCode), {
      classId: ref.id,
      createdBy: user.uid,
      expiresAt,
      createdAt: serverTimestamp(),
    });
    // 내 프로필의 '내가 만든 반' 목록에 적습니다 — 규칙이 이 목록으로 '내 반 학생'을 알아봅니다
    // (실패해도 반 목록을 받을 때 다시 메움).
    await ensureOwnedClassId(ref.id);
    // 관리자 설정은 선생님의 모든 반에 한 값 — 새 반도 같은 값으로 맞춥니다. 규칙이
    // 만들 때 readingEnabled를 거짓으로만 받아, 만든 뒤 한 번 더 씁니다(실패해도 반은 그대로).
    const patch = newClassFeaturePatch(features);
    if (patch) await updateDoc(ref, patch).catch((e) => console.warn("[addClass] 기능 설정", e?.code || e));
    return { id: ref.id, name: name.trim(), joinCode, codeExpiresAt: expiresAt, ...(patch || {}) };
  }
  // 데모: 단순화를 위해 코드/만료를 클래스 객체에 함께 보관
  let id;
  do { id = `cl${nextMockSeq()}_m`; } while (mock.classes.some((c) => c.id === id));
  const created = {
    id,
    readingEnabled: false,
    name: name.trim(),
    createdBy: user.uid,
    joinCode,
    codeExpiresAt: expiresAt,
    createdAt: new Date(),
    ...(newClassFeaturePatch(features) || {}),
  };
  mock.classes.push(created);
  notifyClasses();
  return created;
}

// 관리자 설정 화면의 스위치 — 참·거짓 칸 하나만 씁니다(규칙 readingSettingValid).
const CLASS_FEATURES = new Set(["readingEnabled", "rankingEnabled", "readingTopEnabled", "characterEnabled", "bookSearchEnabled", "fruitBasketEnabled", "petEnabled", "petFeedEnabled", "plazaEnabled", "classroomEnabled", "hideoutEnabled"]);
// 스위치 하나가 반 문서에 적는 것 — 펫 먹이(petFeedEnabled)는 **켤 때 '켠 때'(petFeedFrom)를 함께** 적습니다.
// 펫의 배부름은 그날부터 셉니다(lib/petCare.js의 careRules) — 켠 때가 없으면 아무 날도 세지 않고, 껐다 다시 켜면
// 그 사이의 날은 건너뜁니다(방학 동안 꺼 두었다 켜도 펫이 한꺼번에 떠나지 않음).
// 켠 때는 **서버 시각**(serverTimestamp — 규칙이 request.time만 받음)입니다. 한때 이 기기의 시계(Date.now())로 적어,
// 시계가 뒤로 틀린 학교 PC에서 켜면 그 앞의 날이 모두 세어져 펫이 켜자마자 한꺼번에 떠날 수 있었습니다.
// 체험반은 서버가 없어 이 기기의 시각(ms 수)을 적습니다 — 읽는 쪽(msOf)이 둘 다 받습니다.
function featureWrite(key, enabled) {
  if (key !== "petFeedEnabled" || !enabled) return { [key]: enabled };
  return { [key]: true, petFeedFrom: isFirebaseConfigured ? serverTimestamp() : Date.now() };
}
function newClassFeaturePatch(features) {
  if (!features || typeof features !== "object") return null;
  const patch = {};
  for (const key of CLASS_FEATURES) if (typeof features[key] === "boolean") Object.assign(patch, featureWrite(key, features[key]));
  if (isReadingMapTheme(features.readingMapTheme)) patch.readingMapTheme = features.readingMapTheme;
  // 펫 먹이의 '배고파지지 않는 날'(주말 · 기간) — 선생님의 모든 반에 한 값이라 새 반도 따릅니다
  if (features.petRestWeekend === false) patch.petRestWeekend = false;
  const rests = normalizeCareRests(features.petRests);
  if (rests.length) patch.petRests = rests;
  return Object.keys(patch).length ? patch : null;
}

// 관리자 설정 — 한 스위치를 선생님의 운영 중인 반 모두에 한 번에 씁니다(한 묶음).
// 반마다 따로 켜고 끄던 것을 걷었습니다(선생님 요청 — 모든 반에 같은 값).
export async function setTeacherFeature(classIds, key, enabled) {
  const ids = [...new Set((classIds || []).filter(Boolean))];
  if (!ids.length || !CLASS_FEATURES.has(key) || typeof enabled !== "boolean") {
    throw new Error("반과 사용 여부를 확인해 주세요.");
  }
  if (isFirebaseConfigured) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + 400)) batch.update(doc(db, "classes", id), featureWrite(key, enabled));
      await batch.commit();
    }
    return;
  }
  for (const id of ids) await setClassFeature(id, key, enabled);
}

// 관리자 설정 — 펫 먹이의 '배고파지지 않는 날'을 선생님의 운영 중인 반 모두에 한 번에 씁니다(한 묶음).
//   weekend  주말에는 줄지 않음(참 · 거짓)      rests  줄지 않는 기간들 [{ kind: 방학 · 시험 기간 · 기타, from, to, note? }]
// 기간의 모양은 lib/petCare.js의 normalizeCareRests가 고릅니다(틀린 줄은 버림 · 20개까지). 규칙은 참 · 거짓과
// 목록의 길이만 봅니다(readingSettingValid) — 줄의 모양은 읽을 때마다 다시 고릅니다.
export async function setTeacherPetRests(classIds, { weekend = true, rests = [] } = {}) {
  const ids = [...new Set((classIds || []).filter(Boolean))];
  if (!ids.length || typeof weekend !== "boolean" || !Array.isArray(rests)) throw new Error("반과 쉬는 날을 확인해 주세요.");
  const patch = { petRestWeekend: weekend, petRests: normalizeCareRests(rests) };
  if (isFirebaseConfigured) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + 400)) batch.update(doc(db, "classes", id), patch);
      await batch.commit();
    }
    return;
  }
  restoreDemoClasses(true);
  const user = getCurrentUser();
  const selected = ids.map((id) => mock.classes.find((c) => c.id === id));
  if (!isTeacher(user) || selected.some((c) => !c || c.archived || (!isAdmin(user) && c.createdBy !== user?.uid))) {
    throw new Error("담당 교사만 운영 중인 반의 설정을 바꿀 수 있어요.");
  }
  const targetIds = new Set(ids);
  const next = mock.classes.map((c) => targetIds.has(c.id) ? { ...c, ...patch } : c);
  if (typeof window !== "undefined") writeDemoClasses(next, demoClassStorage());
  mock.classes = next;
  notifyClasses(false);
}

// 독서 맵은 참·거짓 스위치와 달리 정해진 지도 식별자만 저장합니다.
// 선생님의 운영 중인 반에 함께 적용하고 새 반도 같은 지도를 따릅니다.
export async function setTeacherReadingMapTheme(classIds, theme) {
  if (!Array.isArray(classIds) || !classIds.length || classIds.some((id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
      || !isReadingMapTheme(theme)) throw new Error("반과 독서 맵을 확인해 주세요.");
  const ids = [...new Set(classIds)];
  if (isFirebaseConfigured) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      for (const id of ids.slice(i, i + 400)) batch.update(doc(db, "classes", id), { readingMapTheme: theme });
      await batch.commit();
    }
    return;
  }
  restoreDemoClasses(true);
  const user = getCurrentUser();
  const selected = ids.map((id) => mock.classes.find((c) => c.id === id));
  if (!isTeacher(user) || selected.some((c) => !c || c.archived || (!isAdmin(user) && c.createdBy !== user?.uid))) {
    throw new Error("담당 교사만 운영 중인 반의 독서 맵을 바꿀 수 있어요.");
  }
  const targetIds = new Set(ids);
  const next = mock.classes.map((c) => targetIds.has(c.id) ? { ...c, readingMapTheme: theme } : c);
  // 여러 반 중 일부만 바뀐 성공 상태를 남기지 않도록 한 번에 저장한 뒤 알립니다.
  if (typeof window !== "undefined") writeDemoClasses(next, demoClassStorage());
  mock.classes = next;
  notifyClasses(false);
}

async function setClassFeature(classId, key, enabled) {
  if (!classId || !CLASS_FEATURES.has(key) || typeof enabled !== "boolean") {
    throw new Error("반과 사용 여부를 확인해 주세요.");
  }
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), featureWrite(key, enabled));
    return;
  }
  restoreDemoClasses(true);
  const classroom = mock.classes.find((c) => c.id === classId);
  const user = getCurrentUser();
  if (!classroom || classroom.archived || !isTeacher(user)
      || (!isAdmin(user) && classroom.createdBy !== user?.uid)) {
    throw new Error("담당 교사만 운영 중인 반의 설정을 바꿀 수 있어요.");
  }
  const next = mock.classes.map((c) => c.id === classId ? { ...c, ...featureWrite(key, enabled) } : c);
  // Save before changing the visible state: storage failures must not look like
  // a successful teacher setting that silently disappears on reload.
  if (typeof window !== "undefined") writeDemoClasses(next, demoClassStorage());
  mock.classes = next;
  notifyClasses(false);
}

// Dashboard API owns live writes; this branch preserves demo preferences using
// the same class storage and ownership checks as the reading feature switch.
export async function setDemoDashboardSemester(classId, start, end) {
  if (isFirebaseConfigured) throw new Error("실제 학기 설정은 서버에서 저장해 주세요.");
  restoreDemoClasses(true);
  const classroom = mock.classes.find((c) => c.id === classId);
  const user = getCurrentUser();
  if (!classroom || classroom.archived || !isTeacher(user)
      || (!isAdmin(user) && classroom.createdBy !== user?.uid)) {
    throw new Error("담당 교사만 학기 기간을 설정할 수 있어요.");
  }
  const day = (text) => typeof text === "string" && /^\d{4}-\d{2}-\d{2}$/.test(text)
    && Number.isFinite(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text;
  if (!day(start) || !day(end) || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 >= 366) {
    throw new Error("학기 시작일과 종료일을 366일 이내로 설정해 주세요.");
  }
  const next = mock.classes.map((c) => c.id === classId
    ? { ...c, dashboardSemesterStart: start, dashboardSemesterEnd: end } : c);
  writeDemoClasses(next, demoClassStorage());
  mock.classes = next;
  notifyClasses(false);
}

// [교사] 반 이름 수정
export async function renameClass(classId, name) {
  const trimmed = name.trim();
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { name: trimmed });
    return;
  }
  const cls = mock.classes.find((c) => c.id === classId);
  if (cls) cls.name = trimmed;
  notifyClasses();
}

// [교사] 출석 시작/종료 — 학생의 '출석하기' 버튼은 교사가 그날 '출석 시작'을
// 눌러야만 활성화됩니다. attendanceOpenDate를 함께 저장해 시작한 그날에만
// 유효하게 만듭니다 — 교사가 종료를 깜빡 잊고 넘어가도, 다음 날엔 다시
// '출석 시작'을 눌러야 하도록(전날 값이 자동으로 그날 것처럼 보이지 않도록)
// 하기 위함입니다. 보안 규칙(attendanceRecords create)도 이 두 값을
// 함께 대조합니다.
export async function startClassAttendance(classId, date = todayDateKey()) {
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), {
      attendanceOpen: true,
      attendanceOpenDate: date,
    });
    return;
  }
  const cls = mock.classes.find((c) => c.id === classId);
  replaceDoc(mock.classes, cls, { attendanceOpen: true, attendanceOpenDate: date });
  notifyClasses();
}

export async function stopClassAttendance(classId) {
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { attendanceOpen: false });
    return;
  }
  const cls = mock.classes.find((c) => c.id === classId);
  if (cls) cls.attendanceOpen = false;
  notifyClasses();
}

// [교사] 교실(책 광장의 둘째 방)의 칠판 — '출석시작'. 오늘 출석을 열면서(startClassAttendance와 같은 두 칸)
// **'출석을 확인한 때'(classroomCallAt)를 새로 적습니다.** 교실에서 제자리에 앉아 있는 학생의 화면은 이 값이
// 바뀌는 것을 본 순간 스스로 출석을 남깁니다(lib/readingClassroom.js의 classroomRollCall) — 그래서 그 순간
// 앉아 있지 않았거나 접속해 있지 않은 학생은 출석이 되지 않습니다(선생님 결정).
// 한 번의 쓰기로 세 칸을 함께 적습니다 — 나눠 쓰면 '확인한 때'만 먼저 닿은 학생이 아직 출석이 열리지 않은 것으로
// 보고 지나칩니다. 이미 열려 있을 때 다시 부르면 '확인한 때'만 새로 바뀝니다(나중에 앉은 학생을 더 확인).
// 값은 견줄 표시일 뿐이라 이 기기의 시각(ms)을 씁니다 — 방금 것과 같은 값이 되지 않게만 합니다.
export async function callClassroomRoll(classId, date = todayDateKey()) {
  if (!classId) return null;
  if (isFirebaseConfigured) {
    const at = Date.now();
    await updateDoc(doc(db, "classes", classId), { attendanceOpen: true, attendanceOpenDate: date, classroomCallAt: at });
    return at;
  }
  const cls = mock.classes.find((c) => c.id === classId);
  if (!cls) return null;
  const at = Math.max(Date.now(), (Number(cls.classroomCallAt) || 0) + 1);
  replaceDoc(mock.classes, cls, { attendanceOpen: true, attendanceOpenDate: date, classroomCallAt: at });
  notifyClasses();
  return at;
}

// [교사] 책 광장 · 교실 — '모두 교실로 / 모두 광장으로'(선생님 요청). 반 문서에 **어느 방으로(classroomMoveTo) ·
// 보낸 때(classroomMoveAt) · 옮기기 전에 셀 시간(classroomMoveWait — 초)**을 한 번의 쓰기로 적습니다. 반의 화면들
// (학생 · 선생님 자신)이 그 값이 바뀌는 것을 보고 **알림과 카운트다운을 띄운 뒤** 스스로 그 방으로 옮깁니다
// (셈 lib/classroomMove.js · 상태 lib/classroomMoveStore.js · 무대가 따를지는 lib/readingClassroom.js의 classroomMoveCall)
// — 출석 확인(위)과 같은 길이라 서버도 Realtime Database도 필요 없고, 규칙도 그대로입니다(반 문서는 담당 교사만 고침).
// 셋을 나눠 쓰면 '보낸 때'만 먼저 닿은 화면이 옛 방으로 옮기거나, 셀 시간 없이 곧바로 옮깁니다.
// after — 지금 반 문서에 적힌 '보낸 때'. **늘 그보다 큰 값을 적습니다** — 화면들은 '지금까지 본 것보다 큰가'로 새 신호를
// 가리므로(기기 시계를 보지 않음), 시계가 늦은 기기에서 눌러도 · 같은 순간에 다시 눌러도 새 신호가 됩니다.
export async function moveClassroomAll(classId, to, after = 0, wait = CLASSROOM_MOVE_WAIT_S) {
  if (!classId || (to !== "plaza" && to !== "classroom")) return null;
  return writeClassroomMove(classId, to, after, wait);
}
// [교사] 세는 중인 '모두 이동'을 거둡니다(알림 띠의 '취소') — **방이 아닌 값(null)을 새 신호로** 적습니다. 화면들이
// 세던 것을 걷고 '취소됐어요'를 잠깐 띄웁니다. 이미 옮긴 뒤에 닿은 취소는 아무것도 되돌리지 않습니다.
export async function cancelClassroomMove(classId, after = 0) {
  if (!classId) return null;
  return writeClassroomMove(classId, null, after, 0);
}
async function writeClassroomMove(classId, to, after, wait, relayed = false) {
  const seconds = to && Number(wait) > 0 ? Number(wait) : 0;
  if (isFirebaseConfigured) {
    const at = Math.max(Date.now(), (Number(after) || 0) + 1);
    await updateDoc(doc(db, "classes", classId), { classroomMoveTo: to, classroomMoveAt: at, classroomMoveWait: seconds });
    return at;
  }
  const cls = mock.classes.find((c) => c.id === classId);
  if (!cls) return null;
  const at = Math.max(Date.now(), (Number(after) || 0) + 1, (Number(cls.classroomMoveAt) || 0) + 1);
  replaceDoc(mock.classes, cls, { classroomMoveTo: to, classroomMoveAt: at, classroomMoveWait: seconds });
  notifyClasses();
  if (!relayed) demoMoveChannel()?.postMessage({ classId, to, wait: seconds });
  return at;
}
// 체험반 — 같은 브라우저의 다른 탭에도 '모두 이동' 신호를 전합니다. 체험반의 자료는 탭마다 따로라(반 문서의 이 칸들은
// 저장소에 남기지 않음 — lib/demoClasses.js), 한 탭은 선생님 · 다른 탭은 학생으로 열어 보면 학생 탭에는 신호가 닿지
// 않습니다. 받은 탭은 제 반 문서에 같은 신호를 적습니다(다시 전하지 않음). 통로는 반 문서를 구독할 때 엽니다 —
// 상단바가 모든 화면에서 구독하므로, 책 광장이 아닌 화면에 있는 탭도 받습니다(다른 화면에서 데려오는 것을 보려고).
let demoMoveBus;
function demoMoveChannel() {
  if (demoMoveBus !== undefined || typeof window === "undefined") return demoMoveBus ?? null;
  demoMoveBus = null;
  try {
    if (typeof BroadcastChannel === "undefined") return null;
    demoMoveBus = new BroadcastChannel("bookbom.demo.classmove.v1");
    demoMoveBus.onmessage = (event) => {
      const message = event.data;
      if (!message || typeof message !== "object" || typeof message.classId !== "string") return;
      const to = message.to === "plaza" || message.to === "classroom" ? message.to : null;
      writeClassroomMove(message.classId, to, 0, Number(message.wait) || 0, true).catch(() => {});
    };
  } catch { demoMoveBus = null; }
  return demoMoveBus;
}

// [교사] 반 보관 — 목록에서 숨기고, 참여 코드를 폐기해 학생 접근을 차단합니다.
// 데이터(보드·카드·과일 등)는 그대로 남지만, 보안 규칙상 보관 중엔 교사도
// 읽기만 가능하고 쓰기는 막힙니다(보관 해제해야 다시 편집 가능).
export async function archiveClass(classId) {
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { archived: true });
    const codesSnap = await getDocs(
      query(collection(db, "joinCodes"), where("classId", "==", classId))
    );
    await Promise.all(codesSnap.docs.map((d) => deleteDoc(d.ref)));
    return;
  }
  const cls = mock.classes.find((c) => c.id === classId);
  replaceDoc(mock.classes, cls, { archived: true, joinCode: null, codeExpiresAt: null });
  notifyClasses();
}

// 문서 참조 목록을 400장씩 묶어 지웁니다(한 묶음 천장 500).
async function deleteRefs(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

// [교사] 반 완전 삭제 — **보관된 반만**, 되돌릴 수 없습니다.
// 브라우저용 Firestore에는 '아래까지 통째로 지우기'가 없어 컬렉션마다 찾아
// 지웁니다(목록은 lib/classPurge.js). 차례: 독서 활동 → 반 아래 기록 →
// 반 바깥 기록 → 반 문서. **반 문서를 맨 마지막에** 지웁니다 — 규칙의 판정
// (canPurgeClass)이 반 문서를 읽고, 중간에 끊겨도 반이 목록에 남아 다시
// 누르면 남은 것부터 이어 지웁니다. 학생 계정(Authentication)과 프로필
// (users)은 다른 반에서도 쓰므로 건드리지 않습니다.
// onStep({ stage, done, total })로 진행을 알립니다.
export async function purgeClass(classId, onStep = () => {}) {
  if (!classId) return;
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "classes", classId));
    if (!snap.exists()) return;
    if (snap.data().archived !== true) throw new Error("not-archived");
    const user = getCurrentUser();

    const acts = await getDocs(
      query(collection(db, "bookActivities"), where("classId", "==", classId))
    );
    for (let i = 0; i < acts.docs.length; i++) {
      onStep({ stage: "activities", done: i, total: acts.docs.length });
      await purgeBookActivity(acts.docs[i].id);
    }

    // 그림 파일 — 지울 문서에서 경로를 모아 반 문서를 지우기 직전에 그 반 폴더의 파일을
    // 지웁니다(독서 활동의 파일은 purgeBookActivity가 이미 지움).
    const files = new Set();
    const seen = (list) => { list.forEach((d) => collectStoragePaths(d.data(), files)); return list; };
    const total = CLASS_SUBCOLLECTIONS.length + CLASS_LINKED_COLLECTIONS.length + 2;
    let done = 0;
    const step = () => onStep({ stage: "records", done: done++, total });
    for (const name of CLASS_SUBCOLLECTIONS) {
      step();
      const docs = seen((await getDocs(collection(db, "classes", classId, name))).docs);
      for (const sub of CLASS_NESTED[name] ?? []) {
        for (const d of docs) {
          await deleteRefs(seen((await getDocs(collection(d.ref, sub))).docs).map((x) => x.ref));
        }
      }
      await deleteRefs(docs.map((d) => d.ref));
    }
    for (const name of CLASS_LINKED_COLLECTIONS) {
      step();
      const docs = await getDocs(
        query(collection(db, name), where("classId", "==", classId))
      );
      await deleteRefs(seen(docs.docs).map((d) => d.ref));
    }
    // 참여 코드 — 규칙이 '만든 교사' 질의만 받아, 내 코드에서 이 반 것을 고릅니다.
    step();
    if (user?.uid) {
      const codes = await getDocs(
        query(collection(db, "joinCodes"), where("createdBy", "==", user.uid))
      );
      await deleteRefs(codes.docs.filter((d) => d.data().classId === classId).map((d) => d.ref));
    }
    step();
    await deleteDoc(doc(db, "broadcasts", classId));

    onStep({ stage: "final", done: 0, total: 1 });
    await deleteStoragePaths(pathsInClass(files, classId)).catch(() => {});
    // 책 광장의 실시간 자료(Realtime Database)는 서버가 걷습니다 — 반 문서가 있을 때(누가 만든 반인지 서버가 봄)
    const { clearPlazaLive } = await import("./reading");
    await clearPlazaLive(classId);
    await deleteDoc(doc(db, "classes", classId));
    // 내가 만든 반이면 내 프로필의 반 목록에서도 뺍니다(남아 있으면 그 반에 있던 학생의 프로필을
    // 계속 읽을 수 있음 — 줄이기는 규칙이 늘 받음).
    if (user?.uid && snap.data().createdBy === user.uid) {
      forgetOwnedClassId(classId);
      await updateDoc(doc(db, "users", user.uid), { ownedClassIds: arrayRemove(classId) }).catch(() => {});
    }
    return;
  }
  // 데모 — 활동은 purgeBookActivity로, 나머지는 classId가 이 반인 줄을 모두 걷습니다.
  const cls = mock.classes.find((c) => c.id === classId);
  if (!cls) return;
  if (cls.archived !== true) throw new Error("not-archived");
  const acts = (mock.bookActivities ?? []).filter((a) => a.classId === classId);
  for (let i = 0; i < acts.length; i++) {
    onStep({ stage: "activities", done: i, total: acts.length });
    await purgeBookActivity(acts[i].id);
  }
  onStep({ stage: "records", done: 0, total: 1 });
  for (const [key, rows] of Object.entries(mock)) {
    if (key === "classes" || !Array.isArray(rows)) continue;
    if (rows.some((r) => r && r.classId === classId)) {
      mock[key] = rows.filter((r) => !(r && r.classId === classId));
    }
  }
  onStep({ stage: "final", done: 0, total: 1 });
  mock.classes = mock.classes.filter((c) => c.id !== classId);
  notifyClasses();
}

// [교사] 반 보관 해제 — 다시 활성화하고 새 참여 코드를 발급합니다.
export async function unarchiveClass(classId, user) {
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { archived: false });
  } else {
    const cls = mock.classes.find((c) => c.id === classId);
    if (cls) cls.archived = false;
    notifyClasses();
  }
  await regenerateJoinCode(classId, user);
}

// [교사] 참여 코드 재발급 — 기존 코드를 폐기하고 새 코드+만료일을 만듭니다.
export async function regenerateJoinCode(classId, user) {
  const joinCode = await generateUniqueJoinCode();
  const expiresAt = codeExpiryFromNow();
  if (isFirebaseConfigured) {
    // 한 반에 활성 코드 1개만 유지 — 기존 코드 문서 삭제 후 새로 발급
    const old = await getDocs(
      query(collection(db, "joinCodes"), where("classId", "==", classId))
    );
    await Promise.all(old.docs.map((d) => deleteDoc(d.ref)));
    await setDoc(doc(db, "joinCodes", joinCode), {
      classId,
      createdBy: user.uid,
      expiresAt,
      createdAt: serverTimestamp(),
    });
    return { joinCode, codeExpiresAt: expiresAt };
  }
  const cls = mock.classes.find((c) => c.id === classId);
  replaceDoc(mock.classes, cls, { joinCode, codeExpiresAt: expiresAt });
  notifyClasses();
  return { joinCode, codeExpiresAt: expiresAt };
}

// [교사] 반별 참여 코드/만료일 구독 — 교사 화면에서 코드 표시·재발급 안내용.
// 반환: { [classId]: { code, expiresAt } }. 규칙상 list는 교사만 허용됩니다.
// ownerUid를 주면 그 교사가 만든 코드만 구독합니다(규칙상 교사는 소유 코드만
// 나열 가능). null이면 전체(최고 관리자 전용).
export function subscribeJoinCodes(callback, ownerUid = null) {
  if (isFirebaseConfigured) {
    const ref = ownerUid
      ? query(collection(db, "joinCodes"), where("createdBy", "==", ownerUid))
      : collection(db, "joinCodes");
    return onSnapshot(
      ref,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[data.classId] = { code: d.id, expiresAt: data.expiresAt ?? null };
        });
        callback(map);
      },
      () => callback({})
    );
  }
  const emit = () => {
    const map = {};
    mock.classes.forEach((c) => {
      if (c.joinCode) map[c.id] = { code: c.joinCode, expiresAt: c.codeExpiresAt ?? null };
    });
    callback(map);
  };
  const wrapper = () => emit();
  mockListeners.classes.add(wrapper);
  emit();
  return () => mockListeners.classes.delete(wrapper);
}

// -------------------------------------------------------------
//   memberships (서버 소속) — 기기·캐시·코드만료와 무관하게 소속 유지
//     문서 ID = `{uid}_{classId}`,  { uid, classId, joinedAt }
// -------------------------------------------------------------
function ensureMockMemberships() {
  if (!mock.memberships) mock.memberships = [];
  if (!mockListeners.memberships) mockListeners.memberships = new Map();
}
function notifyMemberships(uid) {
  ensureMockMemberships();
  const set = mockListeners.memberships.get(uid);
  if (set) notify(set, mock.memberships.filter((m) => m.uid === uid));
}

// 참여 코드 다듬기 — 대문자로, 글자·숫자만 남기고 12자에서 자릅니다.
function normalizeJoinCode(raw) {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

// 참여 코드로 반에 들어가기 — 학생 입장 화면(ClassEntry)에서 씁니다.
//
// 서버 함수 없이 앱이 곧바로 합니다: joinCodes/{코드}를 한 건 읽어 반을 찾고,
// memberships/{uid}_{classId}를 코드와 함께 씁니다. 보안 규칙이 그 코드가
// 정말 그 반의 것이고 만료되지 않았는지를 서버에서 다시 확인하므로, 화면을
// 거치지 않고 소속 문서를 써도 맞는 코드 없이는 못 들어옵니다.
// (틀린 횟수 잠금은 없습니다 — 그것을 하려면 Cloud Functions가 필요해
// 배포가 어려워져 걷었습니다. 코드가 6자리 · 32글자라 맞혀 들어오기는
// 사실상 어렵고, 14일이면 만료됩니다.)
//
// 결과는 늘 같은 모양으로 돌려줍니다(던지지 않음 — 화면이 갈래마다 문구를 고름):
//   { ok: true, classId, name }
//   { ok: false, reason: 'wrong' | 'expired' | 'archived' | 'invalid' | 'error' }
export async function joinClassWithCode(rawCode, user) {
  const code = normalizeJoinCode(rawCode);
  if (!code) return { ok: false, reason: "invalid" };
  if (!user?.uid) return { ok: false, reason: "error" };
  if (isFirebaseConfigured) {
    try {
      const snap = await getDoc(doc(db, "joinCodes", code));
      if (!snap.exists()) return { ok: false, reason: "wrong" };
      const { classId, expiresAt } = snap.data();
      if (expiresAt && toDate(expiresAt) < new Date()) return { ok: false, reason: "expired" };
      const classSnap = await getDoc(doc(db, "classes", classId));
      if (!classSnap.exists()) return { ok: false, reason: "wrong" };
      const cls = classSnap.data();
      if (cls.archived) return { ok: false, reason: "archived" };
      const mRef = doc(db, "memberships", `${user.uid}_${classId}`);
      // 문서가 없으면 규칙 평가가 거부로 떨어질 수 있어 catch → 새로 만들기로 진행
      const existing = await getDoc(mRef).catch(() => null);
      if (!existing?.exists()) {
        await setDoc(mRef, { uid: user.uid, classId, code, joinedAt: serverTimestamp() });
      }
      await ensureClassIdSynced(user, classId);
      return { ok: true, classId, name: cls.name };
    } catch (err) {
      console.error("[반 입장] 참여 코드 확인 실패:", err?.code, err?.message);
      return { ok: false, reason: "error", message: err?.message || "" };
    }
  }
  const cls = mock.classes.find((c) => c.joinCode === code);
  if (!cls) return { ok: false, reason: "wrong" };
  if (cls.codeExpiresAt && toDate(cls.codeExpiresAt) < new Date()) {
    return { ok: false, reason: "expired" };
  }
  if (cls.archived) return { ok: false, reason: "archived" };
  ensureMockMemberships();
  const uid = user.uid;
  if (!mock.memberships.some((m) => m.uid === uid && m.classId === cls.id)) {
    mock.memberships.push({ id: `${uid}_${cls.id}`, uid, classId: cls.id, joinedAt: new Date() });
  }
  notifyMemberships(uid);
  return { ok: true, classId: cls.id, name: cls.name };
}

// users/{uid}.classIds에 이 반을 이어붙입니다 — 공부방에서 급우 이름표를
// 서로 읽을 수 있게 하는 판정 기준(firestore.rules의 isClassmateOf)입니다.
// 이미 들어 있으면 건너뜁니다: 보안 규칙이 "정확히 한 개만 새로 추가"하는
// 쓰기만 허용해서, 중복 시도는 그대로 거부당해 매번 콘솔에 경고가 찍힙니다.
// 반에 새로 들어갈 때(joinClassWithCode)와, 이미 소속된 예전 계정의
// 자가 치유(책방 페이지의 useEffect) 양쪽에서 부릅니다.
export async function ensureClassIdSynced(user, classId) {
  if (!user?.uid || user.classIds?.includes(classId)) return;
  if (!isFirebaseConfigured) return; // 데모 모드: users 문서가 없어 생략
  try {
    await updateDoc(doc(db, "users", user.uid), { classIds: arrayUnion(classId) });
    user.classIds = [...(user.classIds ?? []), classId]; // 캐시된 user 객체도 함께 갱신
  } catch (e) {
    console.warn("[공부방] 급우 명단 동기화(classIds) 실패:", e?.code, e?.message);
  }
}

// [교사] 내 반 학생의 프로필이 규칙에 막혔을 때 — 소속(memberships)은 있는데 그 학생의
// users.classIds에 이 반이 빠진 경우입니다(반에 들어올 때 동기화가 실패했거나 예전 계정).
// 교사는 '학생의 classIds와 내가 만든 반 목록이 겹치는 학생'만 읽으므로(firestore.rules의
// teachesStudent) 교사 쪽에서 이 반을 한 번 이어붙입니다 — 규칙이 '내 반 목록에 있는 반 ·
// 그 학생의 소속 문서가 있음 · 정확히 하나만 늘림'일 때만 받습니다(users update의 교사
// classIds 갈래). 부르기 전에 내 반 목록에 이 반이 적혀 있어야 합니다(ensureOwnedClassId —
// 부르는 자리가 먼저 기다림). 세션마다 학생 · 반 하나에 한 번만 시도합니다.
// 돌려주는 값: 다시 읽어 볼 만하면 true.
const healTried = new Set();
export async function healClassIdsForTeacher(uid, classId) {
  const key = `${classId}:${uid}`;
  if (!uid || !classId || healTried.has(key)) return false;
  healTried.add(key);
  if (!(await ensureOwnedClassId(classId, { retry: true }))) return false;
  try {
    await updateDoc(doc(db, "users", uid), { classIds: arrayUnion(classId) });
    return true;
  } catch (e) {
    console.warn("[반 명단] 학생 프로필을 읽을 수 없어요:", uid, e?.code, e?.message);
    return false;
  }
}

// [교사] 한 반의 학생 명단 — 소속(memberships)을 따라 그 학생들의 users 문서를 한 건씩
// 구독합니다(그 반 학생 수만큼만 읽음). callback({ uids, profiles, joined }) — uids는 소속 uid,
// profiles는 읽힌 학생의 디렉터리 줄(lib/data/users.js의 directoryEntry), joined는 학생마다 이 반에
// 들어온 때({ uid: ms } — 소속 문서의 joinedAt · 모르면 그 칸이 없음. 펫 먹이가 그날부터 셈 — lib/petCare.js).
// 소속의 첫 답과 그 학생들의 첫 답이 다 온 뒤에 한 번에 알립니다 — 한 명씩 알리면 명단이
// 한 줄씩 붙으며 깜빡입니다.
// 한때 교사 화면 셋이 users 컬렉션을 통째로 구독해(subscribeUserDirectory — 이제 관리자
// 전용) 교사 누구나 이 앱의 모든 계정을 받았습니다. 규칙도 이제 '내 반 학생'만 엽니다.
// [uid, joinedAt] 쌍들 → { uid: ms }. 때를 모르는 학생(옛 소속 문서)은 칸을 두지 않습니다.
function joinedByUid(pairs) {
  const out = {};
  for (const [uid, at] of pairs) {
    if (typeof uid !== "string" || !uid || at == null) continue;
    const ms = toDate(at).getTime();
    if (Number.isFinite(ms) && ms > 0) out[uid] = ms;
  }
  return out;
}

export function subscribeClassDirectory(classId, callback) {
  if (!classId) { callback({ uids: [], profiles: [], joined: {} }); return () => {}; }
  if (!isFirebaseConfigured) {
    if (!mock.memberships) mock.memberships = [];
    if (!mockListeners.classMembers) mockListeners.classMembers = new Set();
    const emit = () => {
      const members = mock.memberships.filter((m) => m.classId === classId);
      const uids = members.map((m) => m.uid);
      const dir = new Map(buildMockDirectory().map((d) => [d.uid, d]));
      callback({ uids, profiles: uids.map((u) => dir.get(u)).filter(Boolean), joined: joinedByUid(members.map((m) => [m.uid, m.joinedAt])) });
    };
    mockListeners.classMembers.add(emit);
    emit();
    return () => mockListeners.classMembers.delete(emit);
  }
  const profiles = new Map(); // uid → 디렉터리 줄
  const offs = new Map(); // uid → 구독 해제
  const waiting = new Set(); // 첫 답을 기다리는 학생(메우는 중 포함)
  const denied = new Set(); // 메워도 읽지 못한 학생 — 소속이 바뀌기 전에는 다시 열지 않음
  let uids = null; // 소속의 첫 답 전에는 null
  let joined = {}; // uid → 이 반에 들어온 때(ms)
  // 이 반이 내 프로필의 반 목록(ownedClassIds)에 적혀 있는지 확인이 끝났나 — 안 적혀 있으면
  // 규칙이 학생 프로필을 모두 막으므로 그 전에는 학생 문서를 열지 않습니다(이미 적혀 있으면 곧바로).
  let ready = false;
  let timer = null;
  let alive = true;
  const flush = () => {
    timer = null;
    if (!alive || uids === null || !ready || waiting.size) return;
    callback({ uids: [...uids], profiles: uids.map((u) => profiles.get(u)).filter(Boolean), joined });
  };
  const schedule = () => { if (!timer) timer = setTimeout(flush, 0); };
  const listen = (uid) => {
    waiting.add(uid);
    offs.set(uid, onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        waiting.delete(uid);
        if (snap.exists()) profiles.set(uid, directoryEntry(uid, snap.data()));
        else profiles.delete(uid);
        schedule();
      },
      async (e) => {
        offs.delete(uid);
        profiles.delete(uid);
        const healed = e?.code === "permission-denied" && (await healClassIdsForTeacher(uid, classId));
        if (healed && alive && uids?.includes(uid) && !offs.has(uid)) { listen(uid); return; }
        waiting.delete(uid);
        denied.add(uid);
        schedule();
      }
    ));
  };
  const sync = () => {
    if (!alive || uids === null || !ready) return;
    for (const uid of uids) if (!offs.has(uid) && !waiting.has(uid) && !denied.has(uid)) listen(uid);
    schedule();
  };
  ensureOwnedClassId(classId).finally(() => { ready = true; sync(); schedule(); });
  const offMembers = onSnapshot(
    query(collection(db, "memberships"), where("classId", "==", classId)),
    (snap) => {
      const next = [...new Set(snap.docs.map((d) => d.data().uid).filter((u) => typeof u === "string" && u))];
      const keep = new Set(next);
      for (const [uid, off] of offs) {
        if (keep.has(uid)) continue;
        off();
        offs.delete(uid);
        profiles.delete(uid);
      }
      for (const uid of [...waiting]) if (!keep.has(uid)) waiting.delete(uid);
      for (const uid of [...denied]) if (!keep.has(uid)) denied.delete(uid);
      uids = next;
      joined = joinedByUid(snap.docs.map((d) => {
        const data = d.data({ serverTimestamps: "estimate" });
        return [data.uid, data.joinedAt];
      }));
      sync();
      schedule();
    },
    (e) => {
      console.warn("[반 명단] 소속을 읽지 못했어요:", e?.code, e?.message);
      uids = [];
      joined = {};
      waiting.clear();
      schedule();
    }
  );
  return () => {
    alive = false;
    clearTimeout(timer);
    offMembers();
    offs.forEach((off) => off());
    offs.clear();
  };
}

// 같은 반 급우(학생) · 내 반 학생(교사 — 메신저 명단)의 이름표(실명·학번·이모지)를 uid
// 목록으로 하나씩 조회합니다. users는 관리자 말고는 통째로 나열할 수 없습니다(보안 규칙이
// 문서별로만 판정 가능해 Firestore가 목록 조회 자체를 거부합니다) — 그래서 uid를 이미
// 아는 사람(=급우 uid, subscribeClassMembers로 얻음)만 한 명씩 읽습니다.
// classIds가 아직 동기화되지 않은 uid(예: 막 반에 들어와 반영 전인 친구)는
// 규칙이 막아 조용히 건너뜁니다.
//
// healClassId — [교사] 내 반 명단을 읽을 때 그 반 id를 주면, 규칙에 막힌 학생(소속은 있는데
// classIds에 이 반이 빠진 학생)의 classIds를 한 번 메우고 다시 읽습니다(healClassIdsForTeacher).
export async function fetchClassRosterProfiles(uids, { healClassId = null } = {}) {
  if (!uids?.length) return [];
  if (isFirebaseConfigured) {
    if (healClassId) await ensureOwnedClassId(healClassId);
    const snaps = await Promise.all(
      uids.map(async (uid) => {
        const read = () => getDoc(doc(db, "users", uid));
        try {
          return await read();
        } catch (e) {
          if (healClassId && e?.code === "permission-denied" && (await healClassIdsForTeacher(uid, healClassId))) {
            return read().catch(() => null);
          }
          return null;
        }
      })
    );
    return snaps
      .filter((s) => s?.exists())
      .map((s) => {
        const data = s.data();
        const ws = !data.studentId ? splitWorkspaceName(data.realName) : null;
        return {
          uid: s.id,
          name: (ws ? ws.realName : data.realName) || data.displayName || "이름 미설정",
          studentId: data.studentId ?? (ws ? ws.studentId : null),
          // 학생은 늘 🙂 — 익명 시절의 동물 이모지는 쓰지 않습니다(실명 원칙)
          emoji: (data.role ?? "student") === "student" ? "🙂" : data.emoji ?? "🙂",
        };
      });
  }
  const dir = buildMockDirectory();
  return uids
    .map((uid) => dir.find((d) => d.uid === uid))
    .filter(Boolean)
    .map((d) => ({
      uid: d.uid,
      name: d.realName || d.displayName || "이름 미설정",
      studentId: d.studentId ?? null,
      emoji: d.emoji ?? "🙂",
    }));
}

// 내 소속 반 목록 실시간 구독 — 어느 기기에서 로그인하든 같은 uid로 따라옵니다.
export function subscribeMyMemberships(uid, callback) {
  if (isFirebaseConfigured) {
    const q = query(collection(db, "memberships"), where("uid", "==", uid));
    return onSnapshot(
      q,
      // joinedAt(서버 시각)은 방금 들어온 순간 서버가 답하기 전까지 null로 옵니다 — 어림값(이 기기의 시각)으로 받습니다.
      // 펫 먹이가 '이 반에 들어온 날'부터 세는데(lib/petCare.js의 careRulesFor), null이면 그 한 박자 동안
      // 반을 만든 날부터 센 것처럼 보여 옮겨 온 학생의 펫이 배고프다고 잘못 알립니다.
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
      // 소속 목록을 못 읽으면 상단바의 손들기 버튼 등 반 정보가 통째로
      // 사라지는데, 지금까지는 아무 흔적 없이 조용히 빈 배열로 바뀌어
      // 원인을 알 수 없었습니다. 콘솔에라도 남겨 둡니다.
      (e) => {
        console.warn("[소속] 반 소속 목록을 읽지 못했어요:", e?.code, e?.message);
        callback([]);
      }
    );
  }
  ensureMockMemberships();
  if (!mockListeners.memberships.has(uid)) mockListeners.memberships.set(uid, new Set());
  mockListeners.memberships.get(uid).add(callback);
  callback(mock.memberships.filter((m) => m.uid === uid));
  return () => mockListeners.memberships.get(uid)?.delete(callback);
}

