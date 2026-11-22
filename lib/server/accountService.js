// Imported exclusively by Next.js route handlers. Never import from client code.
// =============================================================
// 학생 탈퇴의 마무리 — 로그인 계정(Authentication)과 프로필 아래의 모든 문서를 지웁니다
// (선생님 요청 · 2026년 11월 — "탈퇴를 눌렀을 때 완전히 탈퇴되면서 해당 유저의 모든 데이터가 삭제").
// -------------------------------------------------------------
// 반 안의 기록(글 · 출석 · 과일 · 모둠 …)은 지금까지처럼 선생님의 브라우저가 규칙 아래에서 지우고
// (lib/data/withdraw.js), 그 끝에 이 서버를 부릅니다. 브라우저가 못 하는 두 가지를 여기서 합니다.
//   · 남의 로그인 계정 지우기 — 한때 '구글 로그인 기록만 남는다'고 안내하던 것
//   · 서버만 읽고 쓰는 문서(users/{uid}/readingRequests …) — 규칙이 막아 브라우저는 못 지움
// 누가 부를 수 있나:
//   · 담당 교사 — 그 학생 프로필의 withdrawingBy가 제 uid일 때만. 이 표시는 규칙이 '그 학생을 가르치는
//     교사가 제 uid로만' 적게 하므로(firestore.rules의 teacherUpdatesStudent) 서버가 따로 반을 뒤지지 않습니다.
//   · 관리자 — 표시 없이도.
// 학생 계정만 지웁니다(프로필의 role · 로그인 계정의 role 클레임 둘 다 봄). 자기 자신은 못 지웁니다.
// 아직 어느 반에 소속이 남아 있으면 멈춥니다 — 브라우저가 그 반 기록을 다 못 지웠거나(다시 누르면 이어 감)
// 다른 선생님 반의 학생입니다. 없는 반을 가리키는 소속만은 여기서 걷습니다.
// 차례: 로그인 계정 → 프로필과 그 아래. 중간에 멈춰도 프로필(과 탈퇴 표시)이 남아 다시 부를 수 있습니다.
// =============================================================
import { ReadingHttpError } from "./readingPolicy.js";

const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const roleOf = (principal, profile) => principal.roleClaim || profile?.role || "student";

export async function finishStudentWithdrawal(principal, targetUid) {
  const { db, auth } = principal;
  if (typeof targetUid !== "string" || !SAFE_UID.test(targetUid)) {
    throw new ReadingHttpError("탈퇴시킬 학생을 확인할 수 없습니다.", 400, "account/bad-request");
  }
  if (targetUid === principal.uid) throw new ReadingHttpError("자기 계정은 탈퇴시킬 수 없습니다.", 403, "account/self");

  const [meSnap, targetSnap] = await db.getAll(db.doc(`users/${principal.uid}`), db.doc(`users/${targetUid}`));
  const me = meSnap.exists ? meSnap.data() : null;
  const role = roleOf(principal, me);
  if (!me || me.suspended === true || !["teacher", "admin"].includes(role)) {
    throw new ReadingHttpError("담당 교사만 학생을 탈퇴시킬 수 있습니다.", 403, "account/forbidden");
  }
  const target = targetSnap.exists ? targetSnap.data() : null;
  // 프로필이 이미 없으면 권한을 확인할 길이 없습니다 — 관리자만 남은 로그인 계정을 지웁니다.
  if (!target && role !== "admin") throw new ReadingHttpError("프로필을 찾지 못했습니다. 이미 탈퇴한 학생일 수 있습니다.", 404, "account/no-profile");
  if (target && (target.role ?? "student") !== "student") {
    throw new ReadingHttpError("학생 계정만 탈퇴시킬 수 있습니다.", 403, "account/not-student");
  }
  if (target && role !== "admin" && target.withdrawingBy !== principal.uid) {
    throw new ReadingHttpError("이 학생을 탈퇴시킬 수 없습니다.", 403, "account/forbidden");
  }

  // 로그인 계정의 역할 클레임(옛 계정 대비) — 교사 · 관리자 계정은 어떤 경우에도 지우지 않습니다.
  let account = null;
  try { account = await auth.getUser(targetUid); } catch (e) { if (e?.code !== "auth/user-not-found") throw e; }
  if (["teacher", "admin"].includes(account?.customClaims?.role)) {
    throw new ReadingHttpError("학생 계정만 탈퇴시킬 수 있습니다.", 403, "account/not-student");
  }

  // 남은 소속 — 있는 반을 가리키면 멈추고, 없는 반을 가리키는 것만 걷습니다.
  const left = await db.collection("memberships").where("uid", "==", targetUid).get();
  const dangling = [];
  for (const m of left.docs) {
    const classId = m.data()?.classId;
    const cls = typeof classId === "string" && classId ? await db.doc(`classes/${classId}`).get() : null;
    if (cls?.exists) throw new ReadingHttpError("아직 반에 남아 있는 학생입니다. 반의 기록을 먼저 지워 주세요.", 409, "account/still-member");
    dangling.push(m.ref);
  }
  await Promise.all(dangling.map((ref) => ref.delete()));

  let authDeleted = false;
  if (account) { await auth.deleteUser(targetUid); authDeleted = true; }
  // 프로필과 그 아래 전부(reading/main · pet · hideout · readingRequests … 뒤에 생길 것까지)
  await db.recursiveDelete(db.doc(`users/${targetUid}`));
  return { ok: true, authDeleted };
}
