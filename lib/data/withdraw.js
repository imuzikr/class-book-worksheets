// =============================================================
// 학생 탈퇴 — 선생님이 학생을 탈퇴시킵니다(관리자 대시보드의 학생 프로필 창)
// -------------------------------------------------------------
// 서버 없이 브라우저가 지웁니다(반 완전 삭제와 같은 방식). 지우는 것:
//   · 내 반들에서 그 학생의 기록 — 소속 · 출석 · 과일 · 손들기 · 메신저 1:1 ·
//     돌발 퀴즈 답 · 독서 활동의 글 · 낱말 · 메모 · 동료 평가 …
//   · 모둠 · 자리표에서 그 학생을 뺍니다(남은 친구들은 그대로)
//   · 개인 서재(users/{uid}/reading/main)와 프로필(users/{uid}) — 맨 마지막
// 남는 것: 구글 로그인 기록(콘솔 Authentication 탭에 이메일 한 줄 — 서버만 지울 수
// 있음). 다시 로그인하면 아무 반에도 없는 새 학생으로 시작합니다.
// 그 학생이 **다른 선생님 반**에도 있으면 탈퇴를 막습니다(그 반 기록은 그 선생님 것 —
// 규칙 teacherMayWithdraw도 같은 것을 봅니다). 그때는 '반에서 빼기'를 씁니다.
// 독서 활동 아래에 학생 기록을 담는 컬렉션을 새로 만들면 여기에도 더하세요.
// =============================================================
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin } from "../user";
import { mock } from "./shared";
import { ensureOwnedClassId, healClassIdsForTeacher } from "./classes";
import { deleteStoragePaths, deleteUploadedFile } from "../storageUpload";
import { collectStoragePaths, pathsOfStudent } from "../storagePaths";

// 탈퇴를 막는 까닭 — 화면이 그대로 알려 줍니다.
export class WithdrawBlocked extends Error {
  constructor(reason, classNames = []) {
    super(reason);
    this.code = reason;
    this.classNames = classNames;
  }
}

const UID_FIELDS = ["uid", "authorId", "fromUid", "toUid", "studentUid", "userId", "writerUid", "ownerUid", "postUid"];

// 한 장씩 지웁니다(20장씩 동시에). 묶음(writeBatch)으로 지우지 않는 까닭: 규칙이
// 기록마다 '탈퇴 중인 학생의 것인가'를 그 기록에 적힌 사람의 프로필로 확인하는데,
// 묶음 하나는 읽을 수 있는 문서 수(20)를 함께 써서 쉽게 넘습니다.
async function deleteRefs(refs) {
  const unique = [...new Map(refs.map((r) => [r.path, r])).values()];
  for (let i = 0; i < unique.length; i += 20) {
    await Promise.all(unique.slice(i, i + 20).map((r) => deleteDoc(r)));
  }
}
// 지우는 기록에서 그림 경로를 모읍니다 — 탈퇴 끝에 그 학생 폴더의 파일만 지웁니다
// (Storage 목록은 규칙이 막아 폴더를 훑을 수 없음 · lib/storagePaths.js).
let sweep = null;
const refsOf = async (q) => (await getDocs(q)).docs.map((d) => { if (sweep) collectStoragePaths(d.data(), sweep); return d.ref; });
const readFiles = async (ref) => {
  const snap = await getDoc(ref).catch(() => null);
  if (sweep && snap?.exists()) collectStoragePaths(snap.data(), sweep);
};

// 프로필 창에 띄울 학생 정보 — users/{uid} 한 건 + 그 학생이 든 반 이름.
// healClassId — 지금 보는 반. 규칙에 막히면(소속은 있는데 그 학생의 classIds에 이 반이 빠짐)
// 교사 쪽에서 한 번 메우고 다시 읽습니다(lib/data/classes.js의 healClassIdsForTeacher).
export async function fetchStudentProfile(uid, classes = [], { healClassId = null } = {}) {
  if (!uid) return null;
  const nameOf = (id) => classes.find((c) => c.id === id)?.name || null;
  if (isFirebaseConfigured) {
    if (healClassId) await ensureOwnedClassId(healClassId);
    const read = () => getDoc(doc(db, "users", uid));
    const snap = await read().catch(async (e) => {
      if (healClassId && e?.code === "permission-denied" && (await healClassIdsForTeacher(uid, healClassId))) return read();
      throw e;
    });
    if (!snap.exists()) return null;
    const d = snap.data();
    return { uid, ...d, classIds: d.classIds ?? [], classNames: (d.classIds ?? []).map(nameOf).filter(Boolean) };
  }
  const u = (mock.demoUsers ?? []).find((x) => x.uid === uid);
  if (!u) return null;
  const classIds = (mock.memberships ?? []).filter((m) => m.uid === uid).map((m) => m.classId);
  return { role: "student", ...u, uid, classIds, classNames: classIds.map(nameOf).filter(Boolean) };
}

// 탈퇴할 수 있는지 미리 봅니다 — { ok, reason, classNames }. myClasses는 내가 맡은 반.
export async function checkWithdraw(profile, myClasses = []) {
  if (!profile) return { ok: false, reason: "no-profile" };
  if ((profile.role ?? "student") !== "student") return { ok: false, reason: "not-student" };
  const mine = new Set(myClasses.map((c) => c.id));
  const ids = profile.classIds ?? [];
  if (!ids.length) return { ok: false, reason: "no-class" };
  if (ids.length > 4) return { ok: false, reason: "too-many" };
  const others = [];
  for (const id of ids) {
    if (mine.has(id)) continue;
    if (!isFirebaseConfigured) { others.push(id); continue; }
    const c = await getDoc(doc(db, "classes", id)).catch(() => null);
    if (c?.exists()) others.push(c.data().name || id);
  }
  if (others.length) return { ok: false, reason: "other-class", classNames: others };
  return { ok: true };
}

// 한 반에서 그 학생의 기록을 지웁니다.
async function purgeStudentInClass(uid, cls) {
  const cId = cls.id;
  const sub = (name) => collection(db, "classes", cId, name);
  const byUid = (name, field = "uid") => refsOf(query(sub(name), where(field, "==", uid)));
  const refs = [
    doc(db, "classes", cId, "fruitBasket", uid),
    doc(db, "classes", cId, "questionSignals", uid),
    doc(db, "classes", cId, "chatReads", uid),
    doc(db, "classes", cId, "readingMembers", uid),
    ...(await byUid("attendanceRecords")),
    ...(await byUid("rewardEvents")),
    ...(await byUid("signalMessages")),
    ...(await byUid("signalEvents")),
    ...(await refsOf(query(sub("chatMessages"), where("room", "==", `dm_${uid}`)))),
    ...(await byUid("chatMessages", "fromUid")),
  ];
  for (const q of (await getDocs(sub("popQuizzes"))).docs) {
    refs.push(doc(q.ref, "submissions", uid));
  }
  // 소속(memberships)은 이 반의 맨 뒤에 지웁니다 — 중간에 멈췄을 때 명단에 남아
  // 있어야 다시 탈퇴를 눌러 이어 갈 수 있습니다.
  // 반 바깥 문서는 규칙이 문서의 classId를 보므로 **있는 것만** 지웁니다(없는 문서를
  // 지우려 하면 규칙이 거부해 같은 묶음이 통째로 실패합니다)
  for (const ref of [doc(db, "rewards", `${cId}_${uid}`), doc(db, "presence", `${uid}_${cId}`)]) {
    if ((await getDoc(ref).catch(() => null))?.exists()) refs.push(ref);
  }
  refs.push(...(await refsOf(query(collection(db, "studentNotes"), where("classId", "==", cId), where("studentUid", "==", uid)))));
  refs.push(...(await refsOf(query(collection(db, "kwl"), where("classId", "==", cId), where("userId", "==", uid)))));
  await deleteRefs(refs);

  // 독서 활동
  const acts = await getDocs(query(collection(db, "bookActivities"), where("classId", "==", cId)));
  for (const a of acts.docs) await purgeStudentInActivity(uid, a.ref, !cls.archived);

  // 모둠 · 자리표에서 빼기 — 보관된 반은 고칠 수 없어 건너뜁니다(반을 지우면 함께 사라짐)
  if (!cls.archived) {
    const ga = await getDoc(doc(db, "classes", cId, "groupAssignments", "default"));
    if (ga.exists() && (ga.data().groups ?? []).some((g) => (g.memberUids ?? []).includes(uid))) {
      const groups = (ga.data().groups ?? []).map((g) => ({
        ...g,
        memberUids: (g.memberUids ?? []).filter((x) => x !== uid),
        members: (g.members ?? []).filter((m) => m?.uid !== uid),
      }));
      await updateDoc(ga.ref, { groups });
    }
    for (const s of (await getDocs(sub("seatLayouts"))).docs) {
      const seats = s.data().seats;
      if (Array.isArray(seats) && seats.includes(uid)) {
        await updateDoc(s.ref, { seats: seats.map((x) => (x === uid ? null : x)) });
      }
    }
  }
  await deleteDoc(doc(db, "memberships", `${uid}_${cId}`));
}

async function purgeStudentInActivity(uid, aRef, editable) {
  const sub = (name) => collection(aRef, name);
  const by = (name, field) => refsOf(query(sub(name), where(field, "==", uid)));
  const entry = doc(aRef, "entries", uid);
  await readFiles(entry);
  const post = await getDoc(doc(aRef, "hashtagPosts", uid)).catch(() => null);
  if (sweep && post?.exists()) collectStoragePaths(post.data(), sweep);
  const imageUrl = post?.exists() ? post.data()?.image?.url : null;
  const refs = [
    ...(await refsOf(collection(entry, "raftFeedback"))),
    entry,
    doc(aRef, "hashtagPosts", uid),
    ...(await by("hashtagComments", "authorId")),
    ...(await by("hashtagComments", "postUid")),
    ...(await by("opinionNotes", "authorId")),
    ...(await by("peerReviews", "fromUid")),
    ...(await by("peerReviews", "toUid")),
    ...(await by("xwProgress", "uid")),
  ];
  for (const g of (await getDocs(sub("groups"))).docs) {
    const members = g.data().memberUids ?? [];
    if (members.length === 1 && members[0] === uid) {
      // 혼자 쓰던 판(개별 활동) — 판째로 지웁니다
      for (const name of ["words", "xwHints", "xwBoard", "xwSolves", "bwNotes"]) {
        refs.push(...(await refsOf(collection(g.ref, name))));
      }
      refs.push(doc(aRef, "bingoBoards", g.id), doc(aRef, "xwProgress", g.id), g.ref);
      continue;
    }
    const gsub = (name, field) => refsOf(query(collection(g.ref, name), where(field, "==", uid)));
    refs.push(...(await gsub("words", "authorId")), ...(await gsub("xwSolves", "uid")),
      ...(await gsub("bwNotes", "writerUid")), ...(await gsub("bwNotes", "ownerUid")));
    if (editable && members.includes(uid)) {
      await updateDoc(g.ref, {
        memberUids: members.filter((x) => x !== uid),
        members: (g.data().members ?? []).filter((m) => m?.uid !== uid),
      });
    }
  }
  await deleteRefs(refs);
  if (imageUrl) await deleteUploadedFile(imageUrl).catch(() => {});
}

// [교사] 학생 탈퇴 — 되돌릴 수 없습니다. myClasses = 내가 맡은 반(보관된 반 포함).
// onStep({ done, total })으로 진행을 알립니다. 막히면 WithdrawBlocked를 던집니다.
export async function withdrawStudent(uid, myClasses, onStep = () => {}) {
  const me = getCurrentUser();
  if (!uid || uid === me?.uid) throw new WithdrawBlocked("self");
  const profile = await fetchStudentProfile(uid, myClasses);
  const check = await checkWithdraw(profile, myClasses);
  if (!check.ok && !(isAdmin(me) && check.reason !== "not-student" && check.reason !== "no-profile")) {
    throw new WithdrawBlocked(check.reason, check.classNames);
  }
  const ids = new Set(profile.classIds);
  if (isFirebaseConfigured) {
    // 탈퇴 중 표시 — 규칙이 이것을 보고 내 반에 있는 그 학생의 기록 지우기를 엽니다
    // (isWithdrawnRecord). 프로필을 맨 마지막에 지우므로 표시도 함께 사라집니다.
    await updateDoc(doc(db, "users", uid), { withdrawingBy: me.uid });
    // classIds에 없어도 소속이 있는 내 반(교사가 직접 넣은 학생 등)까지 찾습니다
    const targets = [];
    for (const c of myClasses) {
      if (ids.has(c.id)) { targets.push(c); continue; }
      const m = await getDoc(doc(db, "memberships", `${uid}_${c.id}`)).catch(() => null);
      if (m?.exists()) targets.push(c);
    }
    sweep = new Set();
    try {
      for (let i = 0; i < targets.length; i++) {
        onStep({ done: i, total: targets.length + 1 });
        await purgeStudentInClass(uid, targets[i]);
      }
      // 그 학생이 올린 그림 — 내 반 폴더 안의 그 학생 폴더 것만
      await deleteStoragePaths(pathsOfStudent(sweep, uid, targets.map((c) => c.id))).catch(() => {});
    } finally {
      sweep = null;
    }
    onStep({ done: targets.length, total: targets.length + 1 });
    await deleteDoc(doc(db, "users", uid, "reading", "main")).catch(() => {});
    await deleteDoc(doc(db, "users", uid));
    return;
  }
  // 데모 — 그 학생을 가리키는 줄을 모두 걷고, 모둠에서 뺍니다
  onStep({ done: 0, total: 1 });
  const hits = (r) =>
    r && (UID_FIELDS.some((f) => r[f] === uid) || r.id === uid || (typeof r.id === "string" && r.id.startsWith(`${uid}_`)));
  for (const [key, rows] of Object.entries(mock)) {
    if (!Array.isArray(rows) || key === "classes") continue;
    let next = rows.filter((r) => !hits(r));
    next = next.map((r) =>
      Array.isArray(r?.memberUids) && r.memberUids.includes(uid)
        ? { ...r, memberUids: r.memberUids.filter((x) => x !== uid), members: (r.members ?? []).filter((m) => m?.uid !== uid) }
        : r
    );
    if (next.length !== rows.length || next.some((r, i) => r !== rows[i])) mock[key] = next;
  }
}
