// =============================================================
// 사용자 프로필 — users/{uid}
//
// 실명·이메일·학번이 여기에만 있는 단일 출처라, '누가' 쓰는지뿐 아니라
// '어떤 필드를' 쓰는지까지 좁혀야 합니다. 특히 role은 클라이언트가 절대
// 쓸 수 없어야 합니다 — 역할 부여는 관리자만(또는 교사 가입 코드로 학생 →
// 선생님 한 방향 — docRoles.test.mjs).
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, asAdmin, seed } from "./helpers.mjs";

// 교사는 **내가 가르치는 학생**(그 학생의 classIds와 내 프로필의 ownedClassIds — 내가 만든
// 반 목록 — 이 겹침)만 읽고 고칩니다 — 한때 교사 누구나 모든 계정을 읽고 학생이면 누구든
// 고쳤습니다. 목록은 관리자만.
//
// 최고 관리자 — 이 파일은 role 클레임으로 둡니다(users 문서 role은 docRoles.test.mjs).
const asInitialAdmin = (env) => asAdmin(env, "rootAdmin");

describe("사용자 프로필 규칙", () => {
  let env;

  before(async () => {
    env = await makeEnv("demo-rules-users");
  });
  after(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      // cA · cA2(보관됨)는 teacherA의 반, cB는 teacherB의 반. stu1은 teacherA의 학생.
      await setDoc(doc(db, "classes", "cA"), { name: "1반", createdBy: "teacherA" });
      await setDoc(doc(db, "classes", "cA2"), { name: "지난 반", createdBy: "teacherA", archived: true });
      await setDoc(doc(db, "classes", "cB"), { name: "3반", createdBy: "teacherB" });
      await setDoc(doc(db, "memberships", "stu1_cA"), { uid: "stu1", classId: "cA" });
      await setDoc(doc(db, "users", "stu1"), {
        uid: "stu1", role: "student", realName: "학생A", studentId: "30101",
        displayName: "다급한 달팽이", emoji: "🐌", email: "stu1@example.com", classIds: ["cA"],
      });
      await setDoc(doc(db, "users", "teacherA"), {
        uid: "teacherA", role: "teacher", realName: "김선생", displayName: "선생님", emoji: "🧑‍🏫",
        ownedClassIds: ["cA", "cA2"],
      });
      await setDoc(doc(db, "users", "teacherB"), {
        uid: "teacherB", role: "teacher", realName: "박선생", displayName: "선생님", emoji: "🧑‍🏫",
        ownedClassIds: ["cB"],
      });
      await setDoc(doc(db, "users", "rootAdmin"), { uid: "rootAdmin", role: "student" });
    });
  });

  describe("학생 본인", () => {
    it("이메일은 스스로 바꿀 수 있지만 아바타(이모지)는 못 바꾼다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertSucceeds(updateDoc(doc(db, "users", "stu1"), { email: "new@example.com" }));
      await assertFails(updateDoc(doc(db, "users", "stu1"), { emoji: "🐧" }));
    });

    it("예전 닉네임을 저장된 실명으로만 바꿀 수 있다 (자가 치유)", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { displayName: "학생B" }));
      await assertFails(updateDoc(doc(db, "users", "stu1"), { displayName: "학생A", realName: "학생A" , studentId: "1" }));
      await assertSucceeds(updateDoc(doc(db, "users", "stu1"), { displayName: "학생A" }));
    });

    it("탈퇴 신청을 남길 수 있다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertSucceeds(
        updateDoc(doc(db, "users", "stu1"), { withdrawRequested: true, withdrawRequestedAt: new Date() })
      );
    });

    it("자기 역할을 올릴 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { role: "admin" }));
      await assertFails(updateDoc(doc(db, "users", "stu1"), { role: "teacher" }));
    });

    it("자기 실명·학번·닉네임은 바꿀 수 없다 (교사만 수정)", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { realName: "가짜이름" }));
      await assertFails(updateDoc(doc(db, "users", "stu1"), { studentId: "99999" }));
      await assertFails(updateDoc(doc(db, "users", "stu1"), { displayName: "내맘대로" }));
    });

    it("남의 프로필은 건드릴 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(updateDoc(doc(db, "users", "teacherA"), { realName: "변조" }));
    });

    it("남의 프로필을 읽을 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(getDoc(doc(db, "users", "teacherA")));
      await assertSucceeds(getDoc(doc(db, "users", "stu1")));
    });
  });

  describe("교사", () => {
    it("학생의 실명·학번을 고칠 수 있다 (학생 정보 수정 화면)", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(
        updateDoc(doc(db, "users", "stu1"), {
          displayName: "느긋한 판다", emoji: "🐼", realName: "홍길동",
          email: "stu1@example.com", studentId: "30102",
        })
      );
    });

    it("대시보드 프로필 창 — 이름 · 학번 · 이메일을 merge로 고치고, 학번을 비울 수 있다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(setDoc(doc(db, "users", "stu1"),
        { displayName: "홍길동", realName: "홍길동", email: "hong@example.com", studentId: null }, { merge: true }));
      await assertFails(setDoc(doc(db, "users", "stu1"), { role: "teacher" }, { merge: true }));
    });

    it("학생의 탈퇴 신청을 거절(해제)할 수 있다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(updateDoc(doc(db, "users", "stu1"), { withdrawRequested: false }));
    });

    it("본인 실명은 스스로 고칠 수 있다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(updateDoc(doc(db, "users", "teacherA"), { realName: "김선생님" }));
    });

    // ── 핵심 회귀 테스트 ──
    // 예전 규칙은 isTeacher()면 아무 user 문서에 아무 필드나 쓸 수 있었습니다.
    it("학생의 역할을 바꿀 수 없다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { role: "admin" }));
    });

    it("자기 역할을 스스로 올릴 수 없다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertFails(updateDoc(doc(db, "users", "teacherA"), { role: "admin" }));
    });

    it("다른 교사의 프로필을 고칠 수 없다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertFails(updateDoc(doc(db, "users", "teacherB"), { realName: "변조" }));
      await assertFails(updateDoc(doc(db, "users", "teacherB"), { role: "student" }));
    });

    it("허용 목록에 없는 필드를 끼워 넣을 수 없다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { fcmTokens: ["훔친토큰"] }));
      await assertFails(updateDoc(doc(db, "users", "stu1"), { 임의필드: "값" }));
    });

    it("정상 필드에 역할을 섞어 넣어도 통째로 거부된다", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { realName: "홍길동", role: "admin" }));
    });

    it("내 반 학생 프로필은 읽을 수 있다 (실명 확인)", async () => {
      const db = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(getDoc(doc(db, "users", "stu1")));
    });
  });

  describe("교사 — 내가 가르치는 학생만", () => {
    beforeEach(async () => {
      await seed(env, async (db) => {
        // stu5 — teacherB 반 학생 · stuNone — 반이 없는 학생 · stuOld — 보관된 내 반 학생
        await setDoc(doc(db, "users", "stu5"), { uid: "stu5", role: "student", realName: "학생E", classIds: ["cB"] });
        await setDoc(doc(db, "memberships", "stu5_cB"), { uid: "stu5", classId: "cB" });
        await setDoc(doc(db, "users", "stuNone"), { uid: "stuNone", role: "student", realName: "학생F" });
        await setDoc(doc(db, "users", "stuOld"), { uid: "stuOld", role: "student", realName: "학생G", classIds: ["cA2"] });
        // stuMany — 반 여섯째 자리에 내 반(규칙이 여섯 자리까지 펼쳐 봄)
        await setDoc(doc(db, "users", "stuMany"), {
          uid: "stuMany", role: "student", realName: "학생H", classIds: ["x1", "x2", "x3", "x4", "cB", "cA"],
        });
        // stuGap — 내 반 소속인데 프로필의 classIds에 반이 빠진 학생(동기화 실패 · 옛 계정)
        await setDoc(doc(db, "users", "stuGap"), { uid: "stuGap", role: "student", realName: "학생I", classIds: [] });
        await setDoc(doc(db, "memberships", "stuGap_cA"), { uid: "stuGap", classId: "cA" });
        await setDoc(doc(db, "memberships", "stuGap_cB"), { uid: "stuGap", classId: "cB" });
      });
    });

    it("다른 선생님 반 학생 · 반이 없는 학생의 프로필은 읽을 수 없다", async () => {
      const a = asTeacher(env, "teacherA").firestore();
      await assertFails(getDoc(doc(a, "users", "stu5")));
      await assertFails(getDoc(doc(a, "users", "stuNone")));
      await assertFails(getDoc(doc(asTeacher(env, "teacherB").firestore(), "users", "stu1")));
    });

    it("다른 교사의 프로필은 읽을 수 없다", async () => {
      await assertFails(getDoc(doc(asTeacher(env, "teacherA").firestore(), "users", "teacherB")));
      await assertSucceeds(getDoc(doc(asTeacher(env, "teacherA").firestore(), "users", "teacherA")));
    });

    it("보관된 내 반 학생 · 여섯째 자리의 내 반 학생도 읽는다", async () => {
      const a = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(getDoc(doc(a, "users", "stuOld")));
      await assertSucceeds(getDoc(doc(a, "users", "stuMany")));
      await assertSucceeds(getDoc(doc(asTeacher(env, "teacherB").firestore(), "users", "stuMany")));
    });

    it("교사는 사용자 목록을 통째로 받지 못하고, 관리자는 받는다", async () => {
      await assertFails(getDocs(collection(asTeacher(env, "teacherA").firestore(), "users")));
      await assertFails(getDocs(collection(asStudent(env, "stu1").firestore(), "users")));
      await assertSucceeds(getDocs(collection(asInitialAdmin(env).firestore(), "users")));
    });

    it("다른 선생님 반 학생의 프로필 · 탈퇴 표시 · classIds는 고칠 수 없다", async () => {
      const b = asTeacher(env, "teacherB").firestore();
      await assertFails(updateDoc(doc(b, "users", "stu1"), { realName: "변조" }));
      await assertFails(setDoc(doc(b, "users", "stu1"), { realName: "변조", displayName: "변조" }, { merge: true }));
      await assertFails(updateDoc(doc(b, "users", "stu1"), { withdrawingBy: "teacherB" }));
      await assertFails(updateDoc(doc(b, "users", "stu1"), { classIds: [] }));
    });

    it("내 반 학생에게는 탈퇴 표시 · classIds 줄이기를 한다", async () => {
      const a = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(updateDoc(doc(a, "users", "stu1"), { withdrawingBy: "teacherA" }));
      await assertSucceeds(updateDoc(doc(a, "users", "stu1"), { classIds: [] }));
    });

    it("소속은 있는데 classIds에 반이 빠진 학생 — 교사가 그 반 하나를 이으면 읽힌다", async () => {
      const a = asTeacher(env, "teacherA").firestore();
      await assertFails(getDoc(doc(a, "users", "stuGap")));
      await assertSucceeds(updateDoc(doc(a, "users", "stuGap"), { classIds: ["cA"] }));
      await assertSucceeds(getDoc(doc(a, "users", "stuGap")));
    });

    it("다른 선생님 반 다섯에 든 학생도 읽고 고친다(규칙 한도 안)", async () => {
      await seed(env, async (db) => {
        for (const id of ["cB2", "cB3", "cB4", "cB5"]) await setDoc(doc(db, "classes", id), { name: id, createdBy: "teacherB" });
        await setDoc(doc(db, "users", "stuWide"), {
          uid: "stuWide", role: "student", realName: "학생J", classIds: ["cB", "cB2", "cB3", "cB4", "cB5", "cA"],
        });
        await setDoc(doc(db, "users", "stuWide2"), {
          uid: "stuWide2", role: "student", realName: "학생K", classIds: ["cB", "cB2", "cB3", "cB4", "cB5"],
        });
        await setDoc(doc(db, "memberships", "stuWide2_cA"), { uid: "stuWide2", classId: "cA" });
      });
      const a = asTeacher(env, "teacherA").firestore();
      await assertSucceeds(getDoc(doc(a, "users", "stuWide")));
      await assertSucceeds(updateDoc(doc(a, "users", "stuWide"), { realName: "학생J2" }));
      await assertSucceeds(updateDoc(doc(a, "users", "stuWide"), { withdrawingBy: "teacherA" }));
      await assertSucceeds(updateDoc(doc(a, "users", "stuWide"), { classIds: ["cB", "cB2", "cB3", "cB4", "cB5"] }));
      // 다섯 반이 다 남의 반인 학생 — 내 반 소속이면 메워서 읽음
      await assertFails(getDoc(doc(a, "users", "stuWide2")));
      await assertSucceeds(updateDoc(doc(a, "users", "stuWide2"), { classIds: ["cB", "cB2", "cB3", "cB4", "cB5", "cA"] }));
      await assertSucceeds(getDoc(doc(a, "users", "stuWide2")));
      // 반이 없는 교사는 못 읽음
      await assertFails(getDoc(doc(asTeacher(env, "teacherC").firestore(), "users", "stuWide")));
    });

    it("내 반 목록(ownedClassIds)에 없는 반은 가르치는 반으로 치지 않는다", async () => {
      // teacherA가 만든 반이어도 내 목록에 아직 안 적혔으면(옛 반) 그 반 학생은 막힘 — 앱이 메움
      await seed(env, async (db) => {
        await setDoc(doc(db, "classes", "cA3"), { name: "새 반", createdBy: "teacherA" });
        await setDoc(doc(db, "users", "stuNew"), { uid: "stuNew", role: "student", realName: "학생L", classIds: ["cA3"] });
      });
      const a = asTeacher(env, "teacherA").firestore();
      await assertFails(getDoc(doc(a, "users", "stuNew")));
      await assertSucceeds(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "cA3"] }));
      await assertSucceeds(getDoc(doc(a, "users", "stuNew")));
    });

    it("내 반 목록은 내가 만든 반 하나씩만 늘리고, 줄이기는 늘 된다", async () => {
      const a = asTeacher(env, "teacherA").firestore();
      // 남의 반 · 없는 반 · 한 번에 둘 · 다른 칸과 함께는 거부
      await assertFails(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "cB"] }));
      await assertFails(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "nope"] }));
      await seed(env, (db) => setDoc(doc(db, "classes", "cA4"), { name: "넷째", createdBy: "teacherA" }));
      await seed(env, (db) => setDoc(doc(db, "classes", "cA5"), { name: "다섯째", createdBy: "teacherA" }));
      await assertFails(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "cA4", "cA5"] }));
      await assertFails(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "cA4"], realName: "변조" }));
      await assertSucceeds(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "cA4"] }));
      // 그대로(같은 반을 다시 적기) · 줄이기
      await assertSucceeds(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA", "cA2", "cA4"] }));
      await assertSucceeds(updateDoc(doc(a, "users", "teacherA"), { ownedClassIds: ["cA"] }));
      // 남의 목록은 못 고침 · 학생은 늘리지 못함
      await assertFails(updateDoc(doc(a, "users", "teacherB"), { ownedClassIds: ["cB", "cA"] }));
      await seed(env, (db) => setDoc(doc(db, "classes", "cS"), { name: "학생이 만든?", createdBy: "stu1" }));
      await assertFails(updateDoc(doc(asStudent(env, "stu1").firestore(), "users", "stu1"), { ownedClassIds: ["cS"] }));
    });

    it("이어붙이기는 내 반 · 소속이 있는 반 · 하나만 · classIds만", async () => {
      const a = asTeacher(env, "teacherA").firestore();
      // 남의 반(소속은 있어도)
      await assertFails(updateDoc(doc(a, "users", "stuGap"), { classIds: ["cB"] }));
      // 소속이 없는 학생
      await assertFails(updateDoc(doc(a, "users", "stuNone"), { classIds: ["cA"] }));
      // 한 번에 둘
      await assertFails(updateDoc(doc(a, "users", "stuGap"), { classIds: ["cA", "cA2"] }));
      // 다른 칸과 함께
      await assertFails(updateDoc(doc(a, "users", "stuGap"), { classIds: ["cA"], realName: "변조" }));
      // 교사 계정에는
      await seed(env, (db) => setDoc(doc(db, "memberships", "teacherB_cA"), { uid: "teacherB", classId: "cA" }));
      await assertFails(updateDoc(doc(a, "users", "teacherB"), { classIds: ["cA"] }));
      // 학생은 남의 classIds를 잇지 못함(내 반 · 소속이 있어도)
      await assertFails(updateDoc(doc(asStudent(env, "stu1").firestore(), "users", "stuGap"), { classIds: ["cA"] }));
    });
  });

  describe("급우(같은 반) — 공부방 명단 공개", () => {
    // classIds가 겹치는 학생끼리는 서로 프로필을 읽을 수 있어야 하고(공부방
    // 프로젝트에서 아직 카드를 안 쓴 급우도 이름표를 미리 보여주기 위함),
    // 다른 반 학생끼리는 여전히 막혀야 합니다. classIds 자체도 아무렇게나
    // 못 바꾸고, joinClass가 실제로 하는 것과 똑같은 모양(반에 실제로
    // 가입한 뒤 그 classId 한 개만 이어붙이기)만 통과해야 합니다.
    beforeEach(async () => {
      await seed(env, async (db) => {
        await setDoc(doc(db, "classes", "classA"), { name: "1반", archived: false });
        await setDoc(doc(db, "classes", "classB"), { name: "2반", archived: false });
        await updateDoc(doc(db, "users", "stu1"), { classIds: ["classA"] });
        await setDoc(doc(db, "users", "stu2"), {
          uid: "stu2", role: "student", realName: "학생B", studentId: "30102",
          displayName: "느긋한 판다", emoji: "🐼", classIds: ["classA"],
        });
        await setDoc(doc(db, "users", "stu3"), {
          uid: "stu3", role: "student", realName: "학생C", studentId: "30201",
          displayName: "씩씩한 여우", emoji: "🦊", classIds: ["classB"],
        });
        await setDoc(doc(db, "memberships", "stu1_classA"), { uid: "stu1", classId: "classA" });
        await setDoc(doc(db, "memberships", "stu2_classA"), { uid: "stu2", classId: "classA" });
        await setDoc(doc(db, "memberships", "stu3_classB"), { uid: "stu3", classId: "classB" });
        // stu4 — 같은 반(classA) 소속이지만, 이 기능이 배포된 뒤 아직 한 번도
        // 접속하지 않아 classIds가 비어 있는 학생(자가 치유 전 상태를 흉내).
        await setDoc(doc(db, "users", "stu4"), {
          uid: "stu4", role: "student", realName: "학생D", studentId: "30103",
          displayName: "용감한 토끼", emoji: "🐰",
        });
        await setDoc(doc(db, "memberships", "stu4_classA"), { uid: "stu4", classId: "classA" });
      });
    });

    it("같은 반 급우 프로필을 읽을 수 있다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertSucceeds(getDoc(doc(db, "users", "stu2")));
    });

    // ── 핵심 회귀 테스트 ──
    // 예전 설계(classIds 교집합만으로 판정)는 대상도 classIds를 채워 둬야
    // 해서, 새 기능 배포 뒤 아직 접속 안 한 급우는 계속 안 보였습니다.
    it("상대가 아직 classIds를 동기화하지 않았어도 같은 반이면 읽을 수 있다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertSucceeds(getDoc(doc(db, "users", "stu4")));
    });

    it("다른 반 학생 프로필은 읽을 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(getDoc(doc(db, "users", "stu3")));
    });

    it("실제로 가입한 반의 classId 한 개를 이어붙일 수 있다 (joinClass)", async () => {
      // stu1이 classB에도 새로 가입한 상황을 흉내: memberships 문서부터
      // (규칙 우회로) 만들어 두고, 그 다음 본인 classIds에 이어붙입니다 —
      // lib/store.js의 joinClass가 실제로 하는 순서와 같습니다.
      await seed(env, (db) =>
        setDoc(doc(db, "memberships", "stu1_classB"), { uid: "stu1", classId: "classB" })
      );
      const db = asStudent(env, "stu1").firestore();
      await assertSucceeds(
        updateDoc(doc(db, "users", "stu1"), { classIds: ["classA", "classB"] })
      );
    });

    it("가입하지 않은(memberships 문서가 없는) 반의 classId는 끼워 넣을 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(
        updateDoc(doc(db, "users", "stu1"), { classIds: ["classA", "classB"] })
      );
    });

    it("한 번에 두 개 이상 이어붙일 수 없다", async () => {
      await seed(env, (db) =>
        setDoc(doc(db, "memberships", "stu1_classB"), { uid: "stu1", classId: "classB" })
      );
      const db = asStudent(env, "stu1").firestore();
      await assertFails(
        updateDoc(doc(db, "users", "stu1"), { classIds: ["classA", "classB", "classC"] })
      );
    });

    it("기존 값을 지우거나 바꿀 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { classIds: [] }));
    });

    it("classIds를 다른 필드와 한 요청에 같이 바꿀 수 없다", async () => {
      await seed(env, (db) =>
        setDoc(doc(db, "memberships", "stu2_classB"), { uid: "stu2", classId: "classB" })
      );
      const db = asStudent(env, "stu2").firestore();
      await assertFails(
        updateDoc(doc(db, "users", "stu2"), { classIds: ["classA", "classB"], realName: "위조" })
      );
    });

    it("다른 학생의 classIds는 바꿀 수 없다", async () => {
      const db = asStudent(env, "stu1").firestore();
      await assertFails(
        updateDoc(doc(db, "users", "stu2"), { classIds: ["classA", "classB"] })
      );
    });
  });

  describe("최고 관리자", () => {
    // 예전 최고 관리자 이메일이라도 클레임이 없으면 관리자가 아닙니다.
    it("이메일만으로는 관리자가 아니다", async () => {
      const db = env
        .authenticatedContext("someone", {
          email: "iseoul72@gmail.com",
          email_verified: true,
          firebase: { sign_in_provider: "google.com" },
        })
        .firestore();
      await assertFails(updateDoc(doc(db, "users", "stu1"), { role: "teacher" }));
    });

    it("역할을 부여할 수 있다", async () => {
      const db = asInitialAdmin(env).firestore();
      await assertSucceeds(updateDoc(doc(db, "users", "stu1"), { role: "teacher" }));
    });

    it("자기 문서를 admin으로 맞출 수 있다 (클레임에 맞춘 자가 치유)", async () => {
      const db = asInitialAdmin(env).firestore();
      await assertSucceeds(
        updateDoc(doc(db, "users", "rootAdmin"), {
          role: "admin", displayName: "선생님", emoji: "🧑‍🏫",
        })
      );
    });

    it("선생님 신청을 승인·거절할 수 있다", async () => {
      const db = asInitialAdmin(env).firestore();
      await assertSucceeds(
        updateDoc(doc(db, "users", "stu1"), {
          requestedRole: null, displayName: "선생님", emoji: "🧑‍🏫",
        })
      );
    });
  });
});
