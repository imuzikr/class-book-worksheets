// =============================================================
// 사용자 디렉터리 · 프로필 · 역할
// -------------------------------------------------------------
// lib/store.js에서 떼어 낸 조각입니다. 화면은 지금까지처럼 "@/lib/store"에서
// 가져갑니다 — store.js가 여기 공개 이름을 그대로 다시 내보냅니다.
// =============================================================
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { makeAnonName, splitWorkspaceName } from "../user";
import { mock, mockListeners, notifyQuestions } from "./shared";

// ─── 사용자 디렉터리 (실명·이메일) — 교사/관리자 전용 조회 ──────────
// 실명·이메일 같은 식별 정보(PII)는 게시물 문서에 넣지 않고 users/{uid}에만
// 둡니다(게시물은 모든 학생이 읽으므로). 교사 화면은 이 디렉터리로
// uid→실명/이메일을 조회합니다. 보안 규칙이 users 읽기를 "본인+교사"로
// 제한하므로, 학생이 호출하면 거부됩니다(그래서 학생 화면에선 호출하지 않음).
const _userDirectory = new Map(); // uid -> { uid, realName, email, displayName, emoji, studentId }

// 동기 조회용 — AuthorBadge·StudyCard 등이 렌더 시점에 실명을 찾습니다.
export function getDirectoryUser(uid) {
  return uid ? _userDirectory.get(uid) ?? null : null;
}
export function getDirectoryRealName(uid) {
  return getDirectoryUser(uid)?.realName || null;
}

function setDirectory(list) {
  _userDirectory.clear();
  list.forEach((e) => e.uid && _userDirectory.set(e.uid, e));
}

// 데모 모드: 단일 출처(users)가 없으므로 게시물의 author 정보로 디렉터리를 흉내냅니다.
export function buildMockDirectory() {
  const map = new Map((mock.demoUsers ?? []).map((profile) => [profile.uid, { ...profile }]));
  const add = (item) => {
    if (!item?.authorId) return;
    const prev = map.get(item.authorId) ?? { uid: item.authorId };
    map.set(item.authorId, {
      ...prev,
      realName: item.authorRealName ?? prev.realName ?? "",
      email: item.authorEmail ?? prev.email ?? "",
      displayName: item.authorName ?? prev.displayName ?? "",
      emoji: item.authorEmoji ?? prev.emoji ?? "🙂",
      studentId: item.authorStudentId ?? prev.studentId ?? null,
    });
  };
  mock.questions.forEach(add);
  Object.values(mock.answers).forEach((arr) => arr.forEach(add));
  (mock.studyCards ?? []).forEach(add);
  return [...map.values()];
}

// 교사 전용: users 컬렉션을 구독해 uid→프로필 디렉터리를 만듭니다.
export function subscribeUserDirectory(callback) {
  if (isFirebaseConfigured) {
    return onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          // 예전 가입 계정: 실명 칸에 "21031홍길동"(워크스페이스 계정 이름)이
          // 통째로 남아 있으면 표시 시점에 학번·이름으로 분리
          const ws = !data.studentId ? splitWorkspaceName(data.realName) : null;
          return {
            uid: d.id,
            realName: ws ? ws.realName : data.realName ?? "",
            email: data.email ?? "",
            displayName: data.displayName ?? "",
            emoji: data.emoji ?? "🙂",
            studentId: data.studentId ?? (ws ? ws.studentId : null),
            role: data.role ?? "student",
            requestedRole: data.requestedRole ?? null, // '선생님' 승인 대기 표시
            withdrawRequested: data.withdrawRequested ?? false, // 탈퇴 신청 대기 표시
          };
        });
        setDirectory(list);
        callback(list);
      },
      () => callback([]) // 권한 거부 등은 빈 목록으로 (학생이 잘못 구독한 경우)
    );
  }
  const list = buildMockDirectory();
  setDirectory(list);
  callback(list);
  return () => {};
}

// ─── 본인 프로필 수정 (프로필 메뉴) ─────────────────────────────
// 규칙상 학생 본인은 email·emoji·fcmTokens·requestedRole만 변경 가능
// (닉네임·실명·학번은 교사만 수정). 교사는 본인 실명 수정에 사용합니다.
export async function updateMyProfile(uid, patch) {
  if (isFirebaseConfigured) {
    await setDoc(doc(db, "users", uid), patch, { merge: true });
    return;
  }
  // 데모 모드: 세션 기반 테스트 유저라 저장할 프로필 문서가 없음 — 생략
}

// ─── 관리자 전용: 학생 프로필 수정 ───────────────────────────────
// 실명·이메일은 users/{uid}(단일 출처)에만 저장하고, 게시물에는 비식별
// 정보(닉네임·이모지)만 전파합니다. 카드는 collectionGroup("cards")로 조회.
export async function updateStudentProfile(uid, { name, emoji, realName, email, studentId }) {
  if (isFirebaseConfigured) {
    // 식별 정보(실명·이메일·학번)는 users/{uid}에만 — 이 저장이 핵심이며,
    // 아래 게시물 닉네임 동기화는 best-effort(부분 실패 허용)로 진행합니다.
    const profilePatch = { displayName: name, emoji, realName, email: email ?? "" };
    if (studentId !== undefined) profilePatch.studentId = studentId || null;
    await setDoc(doc(db, "users", uid), profilePatch, { merge: true });

    // 게시물에는 비식별 정보만 갱신 (피드 닉네임/아바타 동기화용).
    // batch(전부-아니면-실패) 대신 개별 갱신 — 규칙상 일부 문서(타 교사 반
    // 카드 등)가 거부되어도 나머지 동기화와 프로필 저장은 유지됩니다.
    const patch = { authorName: name, authorEmoji: emoji };
    const updates = [];
    try {
      const qSnap = await getDocs(query(collection(db, "questions"), where("authorId", "==", uid)));
      qSnap.docs.forEach((d) => updates.push(updateDoc(d.ref, patch)));
    } catch (e) {
      console.warn("[updateStudentProfile] 질문 동기화 건너뜀:", e?.message);
    }
    try {
      const aSnap = await getDocs(query(collectionGroup(db, "answers"), where("authorId", "==", uid)));
      aSnap.docs.forEach((d) => updates.push(updateDoc(d.ref, patch)));
    } catch (e) {
      console.warn("[updateStudentProfile] 답변 동기화 건너뜀:", e?.message);
    }
    try {
      const cSnap = await getDocs(query(collectionGroup(db, "cards"), where("authorId", "==", uid)));
      cSnap.docs.forEach((d) => updates.push(updateDoc(d.ref, patch)));
    } catch (e) {
      console.warn("[updateStudentProfile] 카드 동기화 건너뜀:", e?.message);
    }
    await Promise.allSettled(updates);
    return;
  }
  // 데모: PII 분리가 의미 없으므로 게시물에 함께 갱신(디렉터리도 여기서 파생)
  mock.demoUsers = (mock.demoUsers ?? []).map((profile) => profile.uid === uid
    ? { ...profile, displayName: name, name: realName, emoji, realName, email: email ?? "", ...(studentId !== undefined ? { studentId: studentId || null } : {}) }
    : profile);
  const patch = { authorName: name, authorEmoji: emoji, authorRealName: realName, authorEmail: email ?? "" };
  if (studentId !== undefined) patch.authorStudentId = studentId || null;
  mock.questions = mock.questions.map((q) =>
    q.authorId === uid ? { ...q, ...patch } : q
  );
  Object.keys(mock.answers).forEach((qid) => {
    mock.answers[qid] = mock.answers[qid].map((a) =>
      a.authorId === uid ? { ...a, ...patch } : a
    );
  });
  mock.studyCards = (mock.studyCards ?? []).map((c) =>
    c.authorId === uid ? { ...c, ...patch } : c
  );
  notifyQuestions();
}

// ─── 관리자 전용: 역할(교사/관리자) 부여 ──────────────────────────
// users/{uid}.role을 곧바로 고칩니다(서버 함수 없이). 보안 규칙이 role
// 변경을 관리자에게만 열어 두어, 다른 사람이 부르면 거부됩니다.
// 대상은 새로고침(다시 접속)하면 바뀐 역할로 보입니다.
// (데모 모드에는 실제 계정이 없어 지원하지 않습니다)
export async function assignUserRole(uid, role) {
  if (!isFirebaseConfigured) return;
  const toTeacher = role === "teacher" || role === "admin";
  const patch = { role, requestedRole: null };
  if (toTeacher) {
    // 교사는 익명 닉네임 대신 늘 '선생님'으로 보입니다
    patch.displayName = "선생님";
    patch.emoji = "🧑‍🏫";
  } else {
    const anon = makeAnonName();
    patch.displayName = anon.name;
    patch.emoji = anon.emoji;
  }
  await setDoc(doc(db, "users", uid), patch, { merge: true });
}

// ─── 관리자 전용: 선생님 가입 신청 승인/거절 ─────────────────────
// 옛 '선생님 신청' 표시(requestedRole)가 남아 있는 계정을 위한 것입니다.
// 지금은 교사 가입 코드로 스스로 선생님이 됩니다(becomeTeacherWithCode).
export async function approveTeacherRequest(uid) {
  await assignUserRole(uid, "teacher");
}
export async function dismissTeacherRequest(uid) {
  if (isFirebaseConfigured) {
    await setDoc(doc(db, "users", uid), { requestedRole: null }, { merge: true });
  }
}

// ─── 본인: 교사 가입 코드로 선생님 되기 ────────────────────────────
// 배포한 사람이 Firebase 콘솔의 config/teacherSignup 문서에 적어 둔 코드와
// 같아야 합니다 — 대조는 보안 규칙이 합니다(앱은 그 코드를 읽지 못함).
// 맞지 않으면 규칙이 거부해 { ok: false }를 돌려줍니다.
export async function becomeTeacherWithCode(uid, rawCode) {
  const code = String(rawCode ?? "").trim();
  if (!uid || code.length < 4) return { ok: false, reason: "invalid" };
  if (!isFirebaseConfigured) return { ok: false, reason: "demo" };
  try {
    await updateDoc(doc(db, "users", uid), {
      role: "teacher",
      teacherCode: code,
      teacherAt: serverTimestamp(),
      displayName: "선생님",
      emoji: "🧑‍🏫",
      requestedRole: null,
    });
    return { ok: true };
  } catch (err) {
    if (err?.code === "permission-denied") return { ok: false, reason: "wrong" };
    console.error("[교사 가입 코드] 저장 실패:", err?.code, err?.message);
    return { ok: false, reason: "error" };
  }
}
