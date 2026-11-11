// =============================================================
// 반에서 빼기 — 학생 한 명을 내 반 하나에서만 뺍니다(관리자 대시보드의 학생 프로필 창)
// -------------------------------------------------------------
// 탈퇴 · 사용 중지는 그 학생의 반이 모두 내 반일 때만 되고 계정 전체를 다룹니다. 이것은
// 반 하나만 다룹니다 — 다른 선생님 반에도 있는 학생, 참여 코드를 잘못 넣어 엉뚱한 반에
// 들어온 학생, 내 반 사이에서 옮기는 학생.
//   · 빼는 것: 기본 모둠 · 독서 활동 모둠 · 자리표(셈은 lib/removeFromClass.js — 탈퇴와 같은
//     셈) · 올려 둔 손(questionSignals)
//   · 줄이는 것: 그 학생 프로필의 classIds에서 이 반(급우 프로필 읽기 판정의 기준 —
//     규칙 classIdsShrinks)
//   · 지우는 것: 그 반의 소속(memberships/{uid}_{cId}) — **맨 마지막**. 중간에 멈춰도
//     명단에 남아 있어 다시 누르면 이어 갑니다.
//   · 남기는 것: 글 · 그림 · 과일 · 출석 · 메신저 · 혼자 쓰던 판 · 반 집계(readingMembers).
//     학생이 참여 코드로 다시 들어오면 그대로 이어집니다. 리더보드 · 독서 TOP 3는 소속으로
//     명단을 세므로 저절로 빠집니다(이번 주 TOP 3는 그 자리에서 다시 셉니다).
// 규칙은 새로 열지 않았습니다 — 담당 교사의 소속 지우기 · classIds 줄이기 · 모둠 · 자리표
// 고치기 · 손 내리기는 이미 열려 있습니다(시험 tests/rules/removeFromClass.test.mjs).
// 보관된 반은 고칠 수 없어 못 뺍니다(규칙 ownsClassEditable).
// =============================================================
import {
  arrayRemove,
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
import { mock, mockListeners, notify } from "./shared";
import { activityGroupWithout, baseGroupsWithout, seatsWithout } from "../removeFromClass";
import { ensureOwnedClassId } from "./classes";
import { dismissQuestionSignal } from "./signals";
import { refreshReadingTops, resetReadingRankings } from "./reading";
import { WithdrawBlocked } from "./withdraw";

// [교사] 학생을 반 하나에서 뺍니다. cls = 그 반 문서(내가 맡은 반 — 관리자는 아무 반).
// 막히면 WithdrawBlocked(self · not-mine · archived)를 던집니다.
export async function removeStudentFromClass(uid, cls) {
  const me = getCurrentUser();
  if (!uid || !cls?.id) return;
  if (uid === me?.uid) throw new WithdrawBlocked("self");
  if (!isAdmin(me) && cls.createdBy !== me?.uid) throw new WithdrawBlocked("not-mine");
  if (cls.archived) throw new WithdrawBlocked("archived");
  const cId = cls.id;

  if (isFirebaseConfigured) {
    // 기본 모둠
    const ga = await getDoc(doc(db, "classes", cId, "groupAssignments", "default"));
    const bp = ga.exists() ? baseGroupsWithout(ga.data(), uid) : null;
    if (bp) await updateDoc(ga.ref, bp);
    // 자리표 — 그 학생이 앉아 있는 것만 찾아 읽습니다(기본 · 그날그날의 자리표)
    const seatSnaps = await getDocs(query(collection(db, "classes", cId, "seatLayouts"), where("seats", "array-contains", uid)));
    for (const s of seatSnaps.docs) {
      const seats = seatsWithout(s.data().seats, uid);
      if (seats) await updateDoc(s.ref, { seats });
    }
    // 독서 활동 모둠 — 활동마다 그 학생이 든 모둠만(단일 필드 색인 — 새 색인 없음)
    const acts = await getDocs(query(collection(db, "bookActivities"), where("classId", "==", cId)));
    for (const a of acts.docs) {
      const found = new Map();
      for (const field of ["memberUids", "suspendedUids"]) {
        const snaps = await getDocs(query(collection(a.ref, "groups"), where(field, "array-contains", uid)));
        for (const g of snaps.docs) found.set(g.id, g);
      }
      for (const g of found.values()) {
        const p = activityGroupWithout(g.data(), uid);
        if (p) await updateDoc(g.ref, p);
      }
    }
    // 올려 둔 손 — 그대로 두면 손든 목록에 명단 밖 학생이 남습니다(없으면 아무 일 없음)
    await dismissQuestionSignal(cId, uid).catch(() => {});
    // 프로필의 반 목록 — 이 반이 적혀 있을 때만(규칙은 줄어드는 쓰기만 받음).
    // 실패해도 소속은 아래에서 빠집니다 — 급우 이름표를 읽는 권한만 한 박자 늦게 정리됩니다.
    const prof = await getDoc(doc(db, "users", uid)).catch(() => null);
    if (prof?.exists() && (prof.data().classIds ?? []).includes(cId)) {
      await ensureOwnedClassId(cId);
      await updateDoc(prof.ref, { classIds: arrayRemove(cId) }).catch((e) =>
        console.warn("[반에서 빼기] classIds 정리 실패:", e?.code, e?.message)
      );
    }
    // 소속 — 맨 마지막
    await deleteDoc(doc(db, "memberships", `${uid}_${cId}`));
    refreshReadingTops([cls], "반에서 빼기");
    // 저장해 둔 반 순위(10분)도 지웁니다 — 다음 조회가 이 학생 없이 다시 셉니다
    resetReadingRankings([cls], "반에서 빼기");
    return;
  }

  // 데모 — 같은 셈으로 체험 자료를 고칩니다
  mock.groupAssignments = (mock.groupAssignments ?? []).map((ga) => {
    if (ga.classId !== cId) return ga;
    const bp = baseGroupsWithout(ga, uid);
    return bp ? { ...ga, ...bp } : ga;
  });
  mock.seatLayouts = (mock.seatLayouts ?? []).map((s) => {
    if (s.classId !== cId) return s;
    const seats = seatsWithout(s.seats, uid);
    return seats ? { ...s, seats } : s;
  });
  const actIds = new Set((mock.bookActivities ?? []).filter((a) => a.classId === cId).map((a) => a.id));
  mock.bookGroups = (mock.bookGroups ?? []).map((g) => {
    if (!actIds.has(g.activityId)) return g;
    const p = activityGroupWithout(g, uid);
    return p ? { ...g, ...p } : g;
  });
  await dismissQuestionSignal(cId, uid).catch(() => {});
  mock.memberships = (mock.memberships ?? []).filter((m) => !(m.uid === uid && m.classId === cId));
  const mine = mockListeners.memberships?.get(uid);
  if (mine) notify(mine, mock.memberships.filter((m) => m.uid === uid));
  mockListeners.classMembers?.forEach((emit) => emit());
  refreshReadingTops([cls], "반에서 빼기");
}
