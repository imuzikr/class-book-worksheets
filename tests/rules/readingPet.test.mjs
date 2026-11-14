// =============================================================
// 독서 펫 — 프로필의 readingPet은 서버만, 알 단계의 종(reading/pet)은 아무도 못 읽음
// -------------------------------------------------------------
// 알 받기 · 깨우기는 서버 API(Admin SDK — 규칙을 우회)가 합니다(lib/server/readingService.js).
// 규칙이 지키는 것:
//  · 학생이 가입해 프로필을 만들 때 readingPet을 끼워 넣지 못함(마음에 드는 종 · 단계를 고르는 길)
//  · 학생 · 교사가 프로필의 readingPet을 고치지 못함(update의 칸 목록에 없음)
//  · 알 단계의 종을 적어 둔 users/{uid}/reading/pet은 학생 본인도 못 읽음(비밀 — 선생님 결정)
//  · 관리자 설정의 '학생 펫'(petEnabled)은 참 · 거짓만, 운영 중인 반에서만
//  · 펫 먹이(lib/petCare.js) — 배부름(readingPet.care)도 서버만 적고(학생이 제 펫을 배부르게 고치지 못함),
//    반 설정 칸(petFeedEnabled · petFeedFrom · petRests)은 모양이 맞을 때만 담당 교사가
//    (켠 때 petFeedFrom은 서버 시각만 — 반을 만들 때 끼워 넣어도 같은 검사). 옛 '주말에는 줄지 않아요'(petRestWeekend)는
//    앱이 더 쓰지 않지만(주말에도 줄어듦 — 선생님 결정) 규칙은 그대로 참 · 거짓만 받습니다(배포 중의 옛 화면 · 남은 값)
//  · 펫 먹이를 껐다 켤 때 — 끈 때(petFeedOffAt) · 다시 켠 때(petFeedOnAt)는 서버 시각만, 쉰 기간 목록(petFeedPauses)은
//    저장된 두 때 그대로만 끝에 덧붙음(그 사이의 날을 세지 않아 끈 순간의 배부름에서 이어짐 — lib/readingPet.js의 petFeedTimesPatch)
//    40줄이 차면 가장 오래된 두 줄을 합침 — 가장 오래된 줄을 빼는 쓰기는 거부(지운 기간이 다시 세어져 펫이 한꺼번에 떠났음)
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { Timestamp, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { makeEnv, asStudent, asTeacher, seed } from "./helpers.mjs";

const signupProfile = (extra = {}) => ({
  email: "s1@example.com", realName: "김학생", displayName: "김학생", role: "student",
  requestedRole: null, studentId: null, createdAt: new Date(), ...extra,
});

describe("독서 펫 — 프로필의 펫과 비밀 문서", () => {
  let env;
  before(async () => { env = await makeEnv("demo-rules-reading-pet"); });
  after(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await seed(env, async (db) => {
      await setDoc(doc(db, "classes", "c1"), { name: "1반", createdBy: "teacherA", archived: false, readingEnabled: true });
      await setDoc(doc(db, "classes", "old"), { name: "보관 반", createdBy: "teacherA", archived: true, readingEnabled: false });
      await setDoc(doc(db, "users", "teacherA"), { role: "teacher", realName: "선생님", ownedClassIds: ["c1", "old"] });
      await setDoc(doc(db, "users", "s2"), {
        role: "student", realName: "이학생", studentId: "10102", classIds: ["c1"],
        readingPet: { species: null, baseXp: 120, assignedAt: 1700000000000, hatchedAt: null },
      });
      await setDoc(doc(db, "memberships", "s2_c1"), { uid: "s2", classId: "c1" });
      await setDoc(doc(db, "users", "s2", "reading", "pet"), { species: "owl", baseXp: 120 });
    });
  });

  it("가입할 때 펫을 끼워 넣을 수 없다(펫이 없으면 그대로 가입됨)", async () => {
    const db = asStudent(env, "s1").firestore();
    await assertFails(setDoc(doc(db, "users", "s1"), signupProfile({ readingPet: { species: "owl", baseXp: 0 } })));
    await assertFails(setDoc(doc(db, "users", "s1"), signupProfile({ readingPet: null })));
    await assertSucceeds(setDoc(doc(db, "users", "s1"), signupProfile()));
  });

  it("학생은 제 프로필의 펫을 고치거나 지울 수 없다", async () => {
    const ref = doc(asStudent(env, "s2").firestore(), "users", "s2");
    await assertFails(updateDoc(ref, { "readingPet.species": "cat" }));
    await assertFails(updateDoc(ref, { readingPet: { species: "cat", baseXp: 0 } }));
    await assertFails(updateDoc(ref, { readingPet: deleteField() }));
    await assertSucceeds(getDoc(ref)); // 제 프로필 읽기는 그대로
  });

  it("담당 교사도 학생 프로필의 펫은 고칠 수 없다(이름 · 학번 고치기는 그대로)", async () => {
    const ref = doc(asTeacher(env, "teacherA").firestore(), "users", "s2");
    await assertFails(updateDoc(ref, { "readingPet.species": "bear" }));
    await assertFails(updateDoc(ref, { realName: "이학생2", readingPet: { species: "bear", baseXp: 0 } }));
    await assertSucceeds(updateDoc(ref, { realName: "이학생2" }));
  });

  it("알 단계의 종(reading/pet)은 학생 본인도 · 교사도 못 읽고 못 쓴다", async () => {
    for (const ctx of [asStudent(env, "s2"), asTeacher(env, "teacherA")]) {
      const ref = doc(ctx.firestore(), "users", "s2", "reading", "pet");
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { species: "cat", baseXp: 0 }));
    }
  });

  it("관리자 설정 '학생 펫'은 참 · 거짓만, 운영 중인 반에서만", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    await assertSucceeds(updateDoc(doc(db, "classes", "c1"), { petEnabled: false }));
    await assertSucceeds(updateDoc(doc(db, "classes", "c1"), { petEnabled: true }));
    await assertFails(updateDoc(doc(db, "classes", "c1"), { petEnabled: "false" }));
    await assertFails(updateDoc(doc(db, "classes", "c1"), { petEnabled: null }));
    await assertFails(updateDoc(doc(db, "classes", "old"), { petEnabled: false }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1"), { petEnabled: false }));
  });

  it("펫 먹이 — 배부름(readingPet.care)은 학생도 교사도 못 고친다(먹이 · 다시 부르기는 서버만)", async () => {
    const care = { full: 100, day: "2026-11-13", kept: "2026-11-13", away: null };
    const mine = doc(asStudent(env, "s2").firestore(), "users", "s2");
    await assertFails(updateDoc(mine, { "readingPet.care": care }));
    await assertFails(updateDoc(mine, { "readingPet.care.full": 100 }));
    await assertFails(updateDoc(mine, { readingPet: { species: null, baseXp: 120, assignedAt: 1700000000000, hatchedAt: null, care } }));
    const teacher = doc(asTeacher(env, "teacherA").firestore(), "users", "s2");
    await assertFails(updateDoc(teacher, { "readingPet.care": care }));
  });

  it("관리자 설정 '펫 먹이' — 스위치 · 켠 때 · 쉬는 기간(옛 주말 칸)은 모양이 맞을 때만, 운영 중인 반의 담당 교사가", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    const c1 = doc(db, "classes", "c1");
    // 켤 때 — 스위치와 켠 때를 한 번에(lib/data/classes.js의 featureWrite). 켠 때는 서버 시각만
    await assertSucceeds(updateDoc(c1, { petFeedEnabled: true, petFeedFrom: serverTimestamp() }));
    await assertSucceeds(updateDoc(c1, { petFeedEnabled: false }));
    // 켠 때를 학생 펫 · 책나눔과 함께 적어도 서버 시각만
    await assertSucceeds(updateDoc(c1, { readingEnabled: true, petFeedFrom: serverTimestamp() }));
    await assertFails(updateDoc(c1, { petEnabled: true, petFeedFrom: Date.now() }));
    await assertFails(updateDoc(c1, { petFeedEnabled: "true" }));
    await assertFails(updateDoc(c1, { petFeedEnabled: null }));
    // 기기의 시각 · 아주 이른 날(켜자마자 펫이 한꺼번에 떠남) · 아주 큰 수(날짜 셈이 멈춤) · 글자 · 지우기는 거부
    await assertFails(updateDoc(c1, { petFeedEnabled: true, petFeedFrom: Date.now() }));
    await assertFails(updateDoc(c1, { petFeedFrom: new Date() }));
    await assertFails(updateDoc(c1, { petFeedFrom: 1 }));
    await assertFails(updateDoc(c1, { petFeedFrom: 1e20 }));
    await assertFails(updateDoc(c1, { petFeedFrom: "2026-11-14" }));
    await assertFails(updateDoc(c1, { petFeedFrom: -1 }));
    await assertFails(updateDoc(c1, { petFeedFrom: deleteField() }));
    // 배고파지지 않는 날 — 기간 목록(20줄까지). 지금 앱은 기간만 씁니다(lib/data/classes.js의 setTeacherPetRests)
    const rest = { kind: "vacation", from: "2026-12-24", to: "2027-02-01", note: "겨울 방학" };
    await assertSucceeds(updateDoc(c1, { petRests: [rest, { kind: "exam", from: "2026-12-08", to: "2026-12-11" }] }));
    // 옛 화면의 '주말에는 줄지 않아요'(참 · 거짓)도 그대로 받음 — 배포 중에 옛 화면에서 저장해도 막히지 않게(앱은 읽지 않음)
    await assertSucceeds(updateDoc(c1, { petRestWeekend: false, petRests: [rest] }));
    await assertSucceeds(updateDoc(c1, { petRestWeekend: true, petRests: [] }));
    await assertFails(updateDoc(c1, { petRestWeekend: "no" }));
    // 남은 옛 값을 지우는 쓰기는 받지 않음(바뀐 칸이면 참 · 거짓을 요구) — 그래서 앱은 그 값을 지우지 않고 그냥 둡니다
    await assertFails(updateDoc(c1, { petRestWeekend: deleteField() }));
    await assertFails(updateDoc(c1, { petRests: "2026-12-24" }));
    await assertFails(updateDoc(c1, { petRests: { 0: rest } }));
    await assertFails(updateDoc(c1, { petRests: Array.from({ length: 21 }, () => rest) }));
    await assertSucceeds(updateDoc(c1, { petRests: Array.from({ length: 20 }, () => rest) }));
    // 보관된 반 · 학생 · 다른 선생님은 못 바꿈
    await assertFails(updateDoc(doc(db, "classes", "old"), { petFeedEnabled: true, petFeedFrom: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, "classes", "old"), { petRests: [] }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1"), { petFeedEnabled: true }));
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1"), { petRests: [] }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "c1"), { petFeedEnabled: true }));
    // 학생은 반 문서의 설정을 읽는다(배부름을 스스로 셈)
    await assertSucceeds(getDoc(doc(asStudent(env, "s2").firestore(), "classes", "c1")));
  });

  it("펫 먹이를 껐다 켤 때 — 끈 때 · 다시 켠 때는 서버 시각만, 쉰 기간은 저장된 두 때 그대로만 목록 끝에", async () => {
    await seed(env, (s) => setDoc(doc(s, "classes", "pf"), { name: "먹이 반", createdBy: "teacherA", archived: false,
      readingEnabled: true, petFeedEnabled: true, petFeedFrom: Timestamp.fromMillis(Date.parse("2026-11-02T09:00:00+09:00")) }));
    const db = asTeacher(env, "teacherA").firestore();
    const pf = doc(db, "classes", "pf");
    const read = async () => (await getDoc(pf)).data();
    // 끔 — 끈 때는 서버 시각만(기기 시계 · 수는 거부)
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: new Date() }));
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: Date.now() }));
    await assertSucceeds(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp() }));
    // 꺼 둔 동안 끈 때를 다시 적지 못함(쉰 기간의 앞이 지워짐)
    await assertFails(updateDoc(pf, { petFeedOffAt: serverTimestamp() }));
    // 다시 켬(학생 펫을 다시 켜도 같음) — 다시 켠 때도 서버 시각만
    await assertFails(updateDoc(pf, { petFeedEnabled: true, petFeedOnAt: new Date() }));
    await assertSucceeds(updateDoc(pf, { petFeedEnabled: true, petEnabled: true, petFeedOnAt: serverTimestamp() }));
    // 다시 켠 때를 덮어쓰거나 그냥 지우지 못함
    await assertFails(updateDoc(pf, { petFeedOnAt: serverTimestamp() }));
    await assertFails(updateDoc(pf, { petFeedOnAt: deleteField() }));
    const { petFeedOffAt: off1, petFeedOnAt: on1 } = await read();
    // 다시 끔 — 지난번 쉰 기간을 옮기지 않으면 · 꾸민 기간이면 · 다시 켠 때를 안 지우면 거부, 저장된 두 때 그대로면 통과
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp() }));
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp(), petFeedPauses: [{ off: Timestamp.fromMillis(1000), on: on1 }], petFeedOnAt: deleteField() }));
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp(), petFeedPauses: [{ off: off1, on: on1 }] }));
    await assertSucceeds(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp(), petFeedPauses: [{ off: off1, on: on1 }], petFeedOnAt: deleteField() }));
    // 목록은 끝에 덧붙이기만 — 지난 줄을 빼거나 바꾸지 못함
    await assertSucceeds(updateDoc(pf, { petFeedEnabled: true, petFeedOnAt: serverTimestamp() }));
    const { petFeedOffAt: off2, petFeedOnAt: on2 } = await read();
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp(), petFeedPauses: [{ off: off2, on: on2 }], petFeedOnAt: deleteField() }));
    await assertFails(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp(), petFeedPauses: [{ off: off2, on: on2 }, { off: off1, on: on1 }], petFeedOnAt: deleteField() }));
    await assertSucceeds(updateDoc(pf, { petFeedEnabled: false, petFeedOffAt: serverTimestamp(), petFeedPauses: [{ off: off1, on: on1 }, { off: off2, on: on2 }], petFeedOnAt: deleteField() }));
    // 학생 · 다른 선생님은 못 씀
    await assertFails(updateDoc(doc(asStudent(env, "s2").firestore(), "classes", "pf"), { petFeedEnabled: true, petFeedOnAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(asTeacher(env, "teacherB").firestore(), "classes", "pf"), { petFeedEnabled: true, petFeedOnAt: serverTimestamp() }));
  });

  it("반을 보관 · 되살릴 때도 끈 때 · 다시 켠 때를 함께, 40줄이 차면 가장 오래된 두 줄을 합치고(빼지 않음) · 만들 때는 받지 않음", async () => {
    const t = (ms) => Timestamp.fromMillis(ms);
    const full = Array.from({ length: 40 }, (_, i) => ({ off: t(1.7e12 + i * 2e8), on: t(1.7e12 + i * 2e8 + 1e8) }));
    await seed(env, (s) => setDoc(doc(s, "classes", "pa"), { name: "보관 반", createdBy: "teacherA", archived: false, readingEnabled: true,
      petFeedEnabled: true, petFeedFrom: t(1.69e12), petFeedOffAt: t(1.71e12), petFeedOnAt: t(1.711e12), petFeedPauses: full }));
    const db = asTeacher(env, "teacherA").firestore();
    const pa = doc(db, "classes", "pa");
    const pair = { off: t(1.71e12), on: t(1.711e12) };
    // 보관하며 끔 — 41줄은 거부, 가장 오래된 줄을 빼는 것도 거부(지운 기간이 다시 '줄어드는 날'로 세어짐)
    const off = (pauses) => updateDoc(pa, { archived: true, petFeedOffAt: serverTimestamp(), petFeedPauses: pauses, petFeedOnAt: deleteField() });
    await assertFails(off([...full, pair]));
    await assertFails(off([...full.slice(1), pair]));
    // 합친 줄을 꾸미면 거부 — 첫째 줄만 남기고 둘째를 버림 · 셋째까지 넓힘 · 끈 때를 앞당김
    await assertFails(off([full[0], ...full.slice(2), pair]));
    await assertFails(off([{ off: full[0].off, on: full[2].on }, ...full.slice(2), pair]));
    await assertFails(off([{ off: t(1.6e12), on: full[1].on }, ...full.slice(2), pair]));
    // 가장 오래된 두 줄을 한 줄로 합치고(첫째의 끈 때 ~ 둘째의 다시 켠 때) 덧붙이면 통과
    await assertSucceeds(off([{ off: full[0].off, on: full[1].on }, ...full.slice(2), pair]));
    // 보관된 반을 되살리며 다시 켬
    await assertSucceeds(updateDoc(pa, { archived: false, petFeedOnAt: serverTimestamp() }));
    // 만들 때는 세 칸을 받지 않음(새 반에는 쉰 기간이 없음)
    for (const extra of [{ petFeedOffAt: serverTimestamp() }, { petFeedOnAt: serverTimestamp() }, { petFeedPauses: [] }]) {
      await assertFails(setDoc(doc(db, "classes", `pnew${Object.keys(extra)[0]}`), { name: "새 반", createdBy: "teacherA", readingEnabled: false, ...extra }));
    }
  });

  it("반을 만들 때도 — 설정 칸은 고칠 때와 같은 모양만(켠 때는 서버 시각만)", async () => {
    const db = asTeacher(env, "teacherA").firestore();
    let n = 0;
    const make = (extra) => setDoc(doc(db, "classes", `new${n += 1}`), { name: "새 반", createdBy: "teacherA", readingEnabled: false, ...extra });
    const rest = { kind: "vacation", from: "2026-12-24", to: "2027-02-01" };
    // 앱이 만드는 모양(설정 없이) · 맞는 모양은 그대로
    await assertSucceeds(make({}));
    await assertSucceeds(make({ petFeedEnabled: true, petFeedFrom: serverTimestamp(), petRestWeekend: false, petRests: [rest] }));
    await assertSucceeds(make({ petRests: Array.from({ length: 20 }, () => rest) }));
    await assertSucceeds(make({ plazaEnabled: false, classroomEnabled: false, hideoutEnabled: true, readingMapTheme: "continent" }));
    // 펫 먹이 — 꾸민 켠 때 · 모양이 틀린 칸
    for (const petFeedFrom of [-1, 0, 1, 1e20, Date.now(), true, "2026-11-14", new Date(), null]) {
      await assertFails(make({ petFeedEnabled: true, petFeedFrom }));
    }
    await assertFails(make({ petRests: Array.from({ length: 21 }, () => rest) }));
    await assertFails(make({ petRests: "2026-12-24" }));
    await assertFails(make({ petFeedEnabled: "true" }));
    await assertFails(make({ petRestWeekend: "no" }));
    // 다른 스위치도 같은 검사(한때 만들 때는 아지트 · 독서 맵만 봄)
    await assertFails(make({ plazaEnabled: "yes" }));
    await assertFails(make({ rankingEnabled: 1 }));
    await assertFails(make({ classroomCallAt: -1 }));
    await assertFails(make({ readingMapTheme: "space" }));
    // 새 반은 기본 꺼짐 — 책나눔을 켠 채로는 못 만듦(지금까지 그대로)
    await assertFails(make({ readingEnabled: true }));
  });
});
