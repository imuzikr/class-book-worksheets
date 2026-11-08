// =============================================================
// 학생 사용 중지 · 다시 사용 — 전학 등으로 더 쓰지 않지만 남긴 글은 남겨 둘 때
// -------------------------------------------------------------
// 관리자 대시보드의 학생 프로필 창에서 담당 교사가 누릅니다(탈퇴와 같은 조건 — 그
// 학생의 반이 모두 내 반일 때만, 규칙 teacherMayWithdraw).
//   · users/{uid}.suspended = true(+ suspendedAt · suspendedBy) — 규칙의 isSuspendedMe가
//     그 계정의 모든 읽기 · 쓰기를 막아 휴면이 됩니다(본인 프로필 읽기만 열림).
//   · 내 운영 중인 반들의 기본 모둠과 독서 활동 모둠에서 뺍니다(lib/suspendGroups.js).
//     활동 모둠에서는 suspendedUids로 옮겨, 모둠 친구가 그 학생의 글을 계속 읽습니다.
//   · 글 · 그림 · 소속 · 과일 · 출석 기록은 그대로 둡니다(반 친구 · 선생님이 계속 봄).
// 다시 사용하면 표시를 거두고, 적어 둔 모둠 자리로 돌려놓습니다.
// =============================================================
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { getCurrentUser, isAdmin } from "../user";
import { mock } from "./shared";
import { checkWithdraw, fetchStudentProfile, WithdrawBlocked } from "./withdraw";
import { resumeInBase, resumeInGroup, suspendInBase, suspendInGroup } from "../suspendGroups";
import { demoSuspendedSet, setDemoSuspended } from "../demoSuspended";

export async function setStudentSuspended(uid, myClasses, suspended) {
  const me = getCurrentUser();
  if (!uid || uid === me?.uid) throw new WithdrawBlocked("self");
  const profile = await fetchStudentProfile(uid, myClasses);
  const check = await checkWithdraw(profile, myClasses);
  if (!check.ok && !(isAdmin(me) && check.reason !== "not-student" && check.reason !== "no-profile")) {
    throw new WithdrawBlocked(check.reason, check.classNames);
  }
  const groupPatch = suspended ? suspendInGroup : resumeInGroup;
  const basePatch = suspended ? suspendInBase : resumeInBase;
  const live = myClasses.filter((c) => !c.archived);

  if (isFirebaseConfigured) {
    // 표시를 먼저 — 모둠을 옮기다 멈춰도 계정은 이미 휴면(또는 다시 사용)입니다.
    await updateDoc(doc(db, "users", uid), { suspended: !!suspended, suspendedAt: serverTimestamp(), suspendedBy: me.uid });
    for (const c of live) {
      const m = await getDoc(doc(db, "memberships", `${uid}_${c.id}`)).catch(() => null);
      if (!m?.exists()) continue;
      const ga = await getDoc(doc(db, "classes", c.id, "groupAssignments", "default"));
      const bp = ga.exists() ? basePatch(ga.data(), uid) : null;
      if (bp) await updateDoc(ga.ref, bp);
      const acts = await getDocs(query(collection(db, "bookActivities"), where("classId", "==", c.id)));
      for (const a of acts.docs) {
        for (const g of (await getDocs(collection(a.ref, "groups"))).docs) {
          const p = groupPatch(g.data(), uid);
          if (p) await updateDoc(g.ref, p);
        }
      }
    }
    return;
  }
  // 데모 — 체험 학생 표시 + 모둠 옮기기(브라우저 저장소에 표시만 남깁니다)
  setDemoSuspended(uid, !!suspended);
  mock.demoUsers = (mock.demoUsers ?? []).map((u) => (u.uid === uid ? { ...u, suspended: !!suspended } : u));
  const liveIds = new Set(live.map((c) => c.id));
  mock.groupAssignments = (mock.groupAssignments ?? []).map((ga) => {
    if (!liveIds.has(ga.classId)) return ga;
    const bp = basePatch(ga, uid);
    return bp ? { ...ga, ...bp } : ga;
  });
  const actIds = new Set((mock.bookActivities ?? []).filter((a) => liveIds.has(a.classId)).map((a) => a.id));
  mock.bookGroups = (mock.bookGroups ?? []).map((g) => {
    if (!actIds.has(g.activityId)) return g;
    const p = groupPatch(g, uid);
    return p ? { ...g, ...p } : g;
  });
}

// 그 학생이 사용 중지되었나 — 반 친구가 그 학생의 글에 댓글을 달려 할 때 미리 막습니다
// (규칙도 막음 — isSuspendedUser). 급우 프로필 읽기는 이미 열려 있습니다(isClassmateOf).
export async function fetchUserSuspended(uid) {
  if (!uid) return false;
  if (!isFirebaseConfigured) {
    return demoSuspendedSet().has(uid) || !!(mock.demoUsers ?? []).find((u) => u.uid === uid)?.suspended;
  }
  const snap = await getDoc(doc(db, "users", uid)).catch(() => null);
  return snap?.exists() ? snap.data().suspended === true : false;
}
