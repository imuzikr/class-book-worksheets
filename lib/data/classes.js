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
import { db, isFirebaseConfigured } from "../firebase";
import { replaceDoc } from "../mockDocs";
import { getCurrentUser, isAdmin, isTeacher, splitWorkspaceName } from "../user";
import { mock, mockListeners, nextMockSeq, notify, sortByClassOrder } from "./shared";
import { ensureDefaultStudyBoard } from "./study";
import { buildMockDirectory } from "./users";
import { DEMO_CLASSES_KEY, readDemoClasses, writeDemoClasses } from "../demoClasses";
import { DEMO_CLASS_ID } from "../demoClassroom";

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
function demoClassStorage() {
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

// ── 전광판 (meta/marquee) ──────────────────────────────────
// 교사가 학생을 칭찬·격려하는 짧은 글. 상단바에 돌아가며 섭니다
// ('이달의 주니어 개발자 10101 홍길동').
//
// **책 나눔 전체에 하나입니다 — 반마다 따로가 아닙니다.** 상단바는 반을
// 고르지 않은 화면(질문방·리포트)에도 떠 있고, 교사가 반을 옮길 때마다 건
// 글이 갈리면 '지금 무엇이 걸려 있나'를 반마다 따로 기억해야 합니다. 칭찬은
// 학교 전체에 알리는 것이라 한 자리에 두고 모두가 같은 것을 봅니다.
//
// **`meta/marquee` 문서 하나**입니다. 이 컬렉션은 읽기가 이미 `signedIn()`,
// 쓰기가 `isTeacher()`로 열려 있어(원래 `meta/keywordsSeeded` 플래그가 쓰던
// 자리) **규칙을 한 줄도 안 건드립니다** — 반 문서에 담았던 까닭과 같은
// 이유이고, 전역으로 옮기면서도 그 성질을 그대로 지킵니다.
//
// 배열 한 필드에 통째로 담는 까닭: 글이 열 개 남짓이라 하위 컬렉션을 둘
// 만큼이 아니고, 상단바가 **문서 하나만 구독**하면 되기 때문입니다.
// 시각은 `Date.now()`입니다 — `serverTimestamp()`는 배열 안에 못 넣습니다
// (Firestore가 배열 속 센티널 값을 거부합니다).
//
// **`setDoc(merge)`로 씁니다** — `updateDoc`은 문서가 없으면 실패하는데,
// `meta/marquee`는 교사가 처음 글을 걸 때 비로소 생깁니다.
export const MARQUEE_MAX = 10;      // 글 개수
export const MARQUEE_TEXT_MAX = 80; // 한 줄 길이 — 상단바 한 줄에 서는 만큼

export function marqueeOf(src) {
  return Array.isArray(src?.marquee)
    ? src.marquee.filter((m) => m && String(m.text ?? "").trim())
    : [];
}

export async function setAppMarquee(list) {
  const value = (list ?? [])
    .map((m) => ({
      id: String(m?.id ?? `mq${Date.now()}${Math.random().toString(36).slice(2, 6)}`),
      text: String(m?.text ?? "").trim().slice(0, MARQUEE_TEXT_MAX),
      at: Number(m?.at) || Date.now(),
    }))
    .filter((m) => m.text)
    .slice(0, MARQUEE_MAX);
  if (isFirebaseConfigured) {
    await setDoc(doc(db, "meta", "marquee"), { marquee: value }, { merge: true });
    return;
  }
  // 문서를 **갈아 끼웁니다**(제자리에서 고치지 않고). Firestore는 스냅샷마다
  // 새 객체를 주는데, mock이 같은 객체를 고쳐 두면 문서 하나를 구독하는 쪽이
  // 늘 같은 참조를 받아 React가 다시 그리지 않습니다 — 데모 모드에서만 화면이
  // 안 바뀌는 일이 실제로 났습니다.
  mock.appMarquee = { marquee: value };
  mockListeners.appMarquee?.forEach((cb) => cb(mock.appMarquee));
}

// 전광판 문서 하나만 구독 — 상단바가 씁니다(반과 무관).
export function subscribeAppMarquee(callback) {
  if (isFirebaseConfigured) {
    return onSnapshot(
      doc(db, "meta", "marquee"),
      (snap) => callback(snap.exists() ? snap.data() : null),
      () => callback(null)
    );
  }
  if (!mock.appMarquee) mock.appMarquee = { marquee: [] };
  if (!mockListeners.appMarquee) mockListeners.appMarquee = new Set();
  const emit = () => callback(mock.appMarquee);
  mockListeners.appMarquee.add(emit);
  emit();
  return () => mockListeners.appMarquee.delete(emit);
}

// 반 문서 하나만 구독 — 상단바 전광판이 씁니다. `subscribeClasses`(학교의
// 반을 통째로)를 안 쓰는 까닭: 상단바는 다섯 화면에 늘 떠 있어, 거기서
// 전체 목록을 구독하면 반이 늘수록 모든 화면이 그만큼 비싸집니다.
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

// 반 목록 실시간 구독 — order 필드 순(반 관리하기의 드래그 순서), 없으면 만든 순.
// (Firestore에서 order로 orderBy하면 그 필드가 없는 옛 반이 결과에서
//  통째로 빠지므로, 정렬은 항상 클라이언트에서 합니다)
export function subscribeClasses(callback) {
  if (isFirebaseConfigured) {
    const q = query(collection(db, "classes"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      callback(sortByClassOrder(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
  }
  restoreDemoClasses();
  mockListeners.classes.add(callback);
  callback(sortByClassOrder(mock.classes));
  return () => mockListeners.classes.delete(callback);
}

// [교사] 파이썬 실행기가 '활동으로 보내기'를 할 목적지 — 반 문서에 적습니다.
// -------------------------------------------------------------
// { boardId, actIndex } 하나뿐이고, 반마다 하나입니다. 교사가 여기를 정해
// 두면 그 반 학생의 실행기가 모두 그 활동으로 보냅니다(학생은 못 바꿉니다).
//
// [왜 반 문서인가]
//  · 방송 문서(broadcasts)에 두면 안 됩니다 — LessonMode가 **일시정지에도**
//    그 문서를 지우므로, 잠깐 멈출 때마다 목적지가 사라집니다(수업 노트
//    서랍을 방송 바깥에 둔 것과 같은 이유).
//  · 반 문서는 읽기가 이미 `signedIn()`이고 교사 수정에 필드 화이트리스트가
//    없어, **규칙을 한 줄도 안 건드립니다.**
//  · `subscribeClasses`가 반 문서를 통째로 실어 나르고 공부방·질문방이 이미
//    그것을 구독하고 있어, **새로 읽는 문서도 없습니다.**
//
// null을 주면 지웁니다(= 아무 데도 안 보냄).
export async function setClassPyTarget(classId, target) {
  if (!classId) return;
  const value =
    target && target.boardId
      ? { boardId: String(target.boardId), actIndex: Math.max(0, Number(target.actIndex) || 0) }
      : null;
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { pyTarget: value });
    return;
  }
  const c = mock.classes.find((x) => x.id === classId);
  if (c) c.pyTarget = value;
  mockListeners.classes?.forEach((cb) => cb(sortByClassOrder(mock.classes)));
}

// [교사] 수업 중에 학생에게 내보내는 활동 — 반 문서의 `task` 한 필드입니다.
// -------------------------------------------------------------
// 교사가 수업 모드에서 하나를 내보내면 그 반 학생의 수업 노트 서랍에
// '오늘의 활동' 탭이 서고, 학생이 거기서 씁니다. 담을 수 있는 것은 둘입니다.
//
//   공부방 — { kind: 'study', boardId, actIndex, at }
//   책방   — { kind: 'book',  activityId, sectionKey, at }
//
// **`kind`가 없는 옛 값은 공부방으로 읽습니다** — 이미 나가 있는 것이 그대로
// 굴러가야 하고, 학생 화면이 그 값을 보고 있을 수도 있습니다.
//
// **한 번에 하나뿐입니다.** 새로 내보내면 앞의 것이 내려갑니다 — 수업 중에
// 학생에게 시키는 일은 한 번에 하나라는 뜻이고, 필드가 하나라 그렇게만
// 됩니다.
//
// **`pyTarget`과 같은 길입니다** — 방송 문서에 두면 일시정지마다 지워지고,
// 반 문서는 규칙을 한 줄도 안 건드립니다. 상단바가 전광판 때문에 이미 반
// 문서를 구독하고 있어(subscribeClass) **새로 읽는 문서도 없습니다.**
//
// `at`(내보낸 시각)이 필요한 이유: 학생이 서랍을 닫아 둔 뒤에도 **새로 내보낸
// 것**은 다시 열려야 합니다. 같은 활동을 두 번 내보내는 일도 있어 (가리키는
// 곳이 그대로라) 시각이 없으면 두 번째를 알아채지 못합니다. 하루가 지났는지도
// 이 값으로 봅니다(아래 `classTaskOf`).
//
// null을 주면 내림(= 지금 내보낸 활동 없음).
export async function setClassTask(classId, target) {
  if (!classId) return;
  // 배열이 아니라 필드라 serverTimestamp()를 쓸 수는 있지만, 학생 화면이
  // '새로 온 것인가'를 곧바로 견주어야 해서 서버 답을 기다리지 않는 값으로
  // 둡니다(전광판의 `at`과 같은 이유).
  const at = Date.now();
  let value = null;
  if (target?.kind === "book" && target.activityId && target.sectionKey) {
    value = {
      kind: "book",
      activityId: String(target.activityId),
      sectionKey: String(target.sectionKey),
      at,
    };
  } else if (target?.boardId) {
    value = {
      kind: "study",
      boardId: String(target.boardId),
      actIndex: Math.max(0, Number(target.actIndex) || 0),
      at,
    };
  }
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { task: value });
    return;
  }
  // mock은 **갈아 끼웁니다** — 제자리에서 고치면 문서 하나를 구독하는 쪽
  // (subscribeClass)이 늘 같은 참조를 받아 React가 다시 안 그립니다.
  const i = mock.classes.findIndex((x) => x.id === classId);
  if (i >= 0) mock.classes[i] = { ...mock.classes[i], task: value };
  mockListeners.classes?.forEach((cb) => cb(sortByClassOrder(mock.classes)));
}

// 반 문서에서 내보낸 활동을 읽습니다 — 모양이 어긋난 값은 '없음'으로 봅니다.
//
// **오늘 보낸 것만 삽니다.** 내보낸 것은 교사가 '그만 보내기'를 눌러야
// 내려가는데, 수업을 마치고 발표만 끄면 반 문서에 그대로 남습니다. 그러면
// 다음 날 학생이 접속할 때 어제 것이 다시 서고 서랍이 저절로 열립니다 —
// 화면에 '오늘의 활동'이라 적힌 채로요. 이어서 할 활동이면 교사가 그날
// 다시 보내면 되고, 학생이 어제 쓰던 글은 공부방·책방에 그대로 있습니다.
//
// 판정을 **여기 한 곳**에 둡니다. 학생 화면에서만 걸러 내면, 다음 날 교사
// 줄에는 '내보내는 중'이라 적혀 있는데 학생 화면에는 아무것도 없습니다
// (교사는 LessonMode, 학생은 TopNav — 둘 다 이 함수를 거칩니다).
//
// `at`이 없는 옛 값도 여기서 함께 떨어집니다(오늘일 리가 없으므로).
export function classTaskOf(cls) {
  const t = cls?.task;
  if (!t) return null;
  const at = Number(t.at) || 0;
  if (!at || todayDateKey(new Date(at)) !== todayDateKey()) return null;
  // 책방 — 독서 활동 하나의 단계 하나
  if (t.kind === "book") {
    if (!t.activityId || !t.sectionKey) return null;
    return {
      kind: "book",
      activityId: String(t.activityId),
      sectionKey: String(t.sectionKey),
      at,
    };
  }
  // 공부방 — kind가 없는 옛 값도 이쪽입니다
  if (!t.boardId) return null;
  return {
    kind: "study",
    boardId: String(t.boardId),
    actIndex: Math.max(0, Number(t.actIndex) || 0),
    at,
  };
}

// 프로젝트 한 건 — 배포된 활동의 이름·안내를 읽는 데 씁니다(문서 1건).
// `subscribeStudyBoards`(반의 프로젝트 전부)를 서랍에서 쓰지 않는 이유는,
// 여기서 필요한 것이 **그 프로젝트 하나**뿐이기 때문입니다.
export async function fetchStudyBoard(boardId) {
  if (!boardId) return null;
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(db, "studyBoards", boardId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  return (mock.studyBoards ?? []).find((b) => b.id === boardId) ?? null;
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
// 반 생성과 동시에 '선생님 보드'(type: notice, 교사 전용 쓰기)를 항상 함께
// 만듭니다 — 다른 보드보다 먼저 생성되므로 항상 첫 번째 보드가 됩니다.
export async function addClass(user, name) {
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
    await ensureDefaultStudyBoard(user, ref.id);
    return { id: ref.id, name: name.trim(), joinCode, codeExpiresAt: expiresAt };
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
  };
  mock.classes.push(created);
  notifyClasses();
  await ensureDefaultStudyBoard(user, created.id);
  return created;
}

// 새 독서 성장 기능만 반별로 켭니다. 기존 독서 활동은 이 설정과 무관합니다.
// 누락된 값은 꺼짐이며, 보관 중인 반에서는 변경하지 않습니다.
export async function setClassReadingEnabled(classId, enabled) {
  if (!classId || typeof enabled !== "boolean") {
    throw new Error("반과 사용 여부를 확인해 주세요.");
  }
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "classes", classId), { readingEnabled: enabled });
    return;
  }
  restoreDemoClasses(true);
  const classroom = mock.classes.find((c) => c.id === classId);
  const user = getCurrentUser();
  if (!classroom || classroom.archived || !isTeacher(user)
      || (!isAdmin(user) && classroom.createdBy !== user?.uid)) {
    throw new Error("담당 교사만 운영 중인 반의 설정을 바꿀 수 있어요.");
  }
  const next = mock.classes.map((c) => c.id === classId ? { ...c, readingEnabled: enabled } : c);
  // Save before changing the visible state: storage failures must not look like
  // a successful teacher setting that silently disappears on reload.
  if (typeof window !== "undefined") writeDemoClasses(next, demoClassStorage());
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

// 학생 전용 — 같은 반 급우들의 이름표(실명·학번·이모지)를 uid 목록으로 하나씩
// 조회합니다. subscribeUserDirectory(교사 전용, users 컬렉션을 통째로 구독)와
// 달리, 학생은 users를 통째로 나열할 수 없습니다(보안 규칙이 문서별로만
// 판정 가능해 Firestore가 목록 조회 자체를 거부합니다) — 그래서 uid를 이미
// 아는 사람(=급우 uid, subscribeClassMembers로 얻음)만 한 명씩 읽습니다.
// classIds가 아직 동기화되지 않은 uid(예: 막 반에 들어와 반영 전인 친구)는
// 규칙이 막아 조용히 건너뜁니다.
export async function fetchClassRosterProfiles(uids) {
  if (!uids?.length) return [];
  if (isFirebaseConfigured) {
    const snaps = await Promise.all(
      uids.map((uid) => getDoc(doc(db, "users", uid)).catch(() => null))
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
          emoji: data.emoji ?? "🙂",
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

// ─── 교사가 고치는 반 편성 ──────────────────────────────────────
// 학기 초에 학생이 코드를 잘못 눌러 옆 반에 들어가는 일이 잦습니다. 지금까지는
// 고칠 길이 없었습니다 — 규칙이 소속 생성을 '본인 + 유효한 참여 코드'로만
// 열어 두어, 교사는 빼지도 넣지도 못했습니다(넣으려면 학생에게 코드를 다시
// 알려 주고 직접 들어오게 해야 했습니다). 이제 **자기가 개설한 반에 한해**
// 교사가 직접 넣고 뺍니다(firestore.rules의 memberships create/delete).
//
// [소속을 빼도 그 학생의 글은 지워지지 않습니다] 카드·노트·과일은 그대로
// 남고, 명단에서만 빠집니다. 잘못 뺐으면 다시 넣으면 그대로 돌아옵니다.

// 이 학생이 '내 반들' 중 어디에 속해 있는지 — 반마다 문서 1건씩 확인합니다.
// `where('uid','==',학생)` 한 방으로 받을 수 없는 까닭: 그 질의는 남의 반
// 소속까지 함께 집어 오는 일이라 규칙이 통째로 거부합니다(교사는 자기 반의
// 소속만 읽을 수 있습니다). 반 수는 보통 두어 개라 이 편이 쌉니다.
export async function fetchStudentClassIds(uid, classIds = []) {
  if (!uid || classIds.length === 0) return [];
  if (isFirebaseConfigured) {
    const snaps = await Promise.all(
      classIds.map((cid) =>
        getDoc(doc(db, "memberships", `${uid}_${cid}`)).catch(() => null)
      )
    );
    return classIds.filter((_, i) => snaps[i]?.exists());
  }
  ensureMockMemberships();
  return classIds.filter((cid) =>
    mock.memberships.some((m) => m.uid === uid && m.classId === cid)
  );
}

// [교사] 학생을 내 반에 넣기. 이미 있으면 아무 일도 하지 않습니다.
export async function addStudentToClass(uid, classId) {
  if (!uid || !classId) return;
  if (isFirebaseConfigured) {
    await setDoc(doc(db, "memberships", `${uid}_${classId}`), {
      uid,
      classId,
      joinedAt: serverTimestamp(),
      // 참여 코드로 들어온 것이 아니라 교사가 넣었다는 표시. 규칙은 이 값을
      // 보지 않지만, 나중에 '왜 이 학생이 이 반에 있지'를 되짚을 때 씁니다.
      addedBy: getCurrentUser()?.uid ?? null,
    });
    // users.classIds는 여기서 못 채웁니다 — 규칙이 교사에게 '줄이는 쪽'만
    // 열어 두었습니다. 학생이 다음에 공부방을 열 때 스스로 채웁니다
    // (ensureClassIdSynced). 그 전까지 늦어지는 것은 급우 이름표 하나뿐입니다.
    return;
  }
  ensureMockMemberships();
  if (!mock.memberships.some((m) => m.uid === uid && m.classId === classId)) {
    mock.memberships.push({ id: `${uid}_${classId}`, uid, classId, joinedAt: new Date() });
  }
  notifyMemberships(uid);
}

// [교사] 학생을 내 반에서 빼기. 소속 문서를 지우고, 그 학생의 classIds에서도
// 이 반을 덜어 냅니다 — 그 값이 남아 있으면 명단에서 빠진 뒤에도 그 반 급우의
// 이름·학번을 계속 읽을 수 있습니다(규칙의 isClassmateOf 판정 기준).
export async function removeStudentFromClass(uid, classId) {
  if (!uid || !classId) return;
  if (isFirebaseConfigured) {
    await deleteDoc(doc(db, "memberships", `${uid}_${classId}`));
    // 실패해도 소속은 이미 빠졌습니다 — 읽기 권한만 한 박자 늦게 정리됩니다.
    await updateDoc(doc(db, "users", uid), { classIds: arrayRemove(classId) }).catch(
      (e) => console.warn("[반 편성] classIds 정리 실패:", e?.code, e?.message)
    );
    return;
  }
  ensureMockMemberships();
  mock.memberships = mock.memberships.filter(
    (m) => !(m.uid === uid && m.classId === classId)
  );
  notifyMemberships(uid);
}

// 내 소속 반 목록 실시간 구독 — 어느 기기에서 로그인하든 같은 uid로 따라옵니다.
export function subscribeMyMemberships(uid, callback) {
  if (isFirebaseConfigured) {
    const q = query(collection(db, "memberships"), where("uid", "==", uid));
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
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

