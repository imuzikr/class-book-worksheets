// =============================================================
// 책 광장의 실시간(함께 있는 친구들의 캐릭터) — Realtime Database 규칙
//   plaza/{반}/who/{uid} (입장권 — 서버만 씀) · plaza/{반}/pos/{uid} (내 자리 — 본인만 씀)
// -------------------------------------------------------------
// 진짜 database.rules.json을 에뮬레이터에 올려 봅니다. 이 규칙은 Firestore를 읽지 못해 '이 반 구성원인가'를
// 스스로 알 수 없으므로, 서버(/api/reading/plaza의 enter)가 구성원인지 본 뒤 적어 준 **입장권**으로 판정합니다.
//
// 여기서 지키려는 것:
//  · 입장권(만료 전)이 있는 사람만 그 반의 광장을 읽는다 — 없는 사람 · 만료된 사람 · 다른 반 입장권 · 로그인 안 한 사람은 못 읽는다
//  · 입장권은 앱에서 아무도 못 쓴다(본인도 — 이름표를 바꾸거나 만료를 늘리지 못하게)
//  · 자리는 **제 것만**, 입장권이 살아 있을 때만, 정해진 모양 · 범위로만 쓴다(낯선 칸 · 그림 밖 · 꾸민 시각 거부)
//  · 자리를 지우지는 못한다(나갈 때는 '나감' 표시 g: 1) — 지웠다 쓰기를 되풀이해 잦은 쓰기 천장을 비켜 가지 못하게
//  · 0.1초 안에 다시 쓰지 못한다(누군가 쏟아부어 반 전체의 내려받는 양을 불리지 못하게). '나감' 표시만 곧바로 된다.
// =============================================================
import { describe, it, before, after, beforeEach } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { get, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { makeDatabaseEnv, asStudent, asTeacher } from "./helpers.mjs";

const HOUR = 3600 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const place = (extra = {}) => ({ x: 836, y: 330, m: 0, f: 0, t: serverTimestamp(), ...extra });

describe("책 광장 실시간 규칙 (Realtime Database)", () => {
  let env;
  before(async () => { env = await makeDatabaseEnv("demo-rules-plazalive"); });
  after(async () => { await env.cleanup(); });

  beforeEach(async () => {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.database();
      const now = Date.now();
      await set(ref(db, "plaza/c1/who"), {
        s1: { n: "김하나", c: "zodiac-01", p: "owl", ps: 3, exp: now + 2 * HOUR },
        s2: { n: "이두리", c: "animal-02", ps: 1, p: "", exp: now + 2 * HOUR },
        late: { n: "늦은 학생", c: "zodiac-03", ps: 0, exp: now - 1000 },
        teacherA: { n: "선생님", r: 1, c: "fantasy-04", ps: 0, exp: now + 2 * HOUR },
      });
      await set(ref(db, "plaza/c1/pos/s2"), { x: 700, y: 400, m: 0, f: 1, t: now - 5000 });
      await set(ref(db, "plaza/c2/who/other"), { n: "다른 반", c: "zodiac-05", ps: 0, exp: now + 2 * HOUR });
    });
  });

  const dbOf = (ctx) => ctx.database();

  describe("읽기 — 입장권이 있는 사람만", () => {
    it("입장권이 있는 학생 · 선생님은 그 반의 입장권 목록과 자리를 읽는다", async () => {
      for (const ctx of [asStudent(env, "s1"), asTeacher(env, "teacherA")]) {
        const snap = await assertSucceeds(get(ref(dbOf(ctx), "plaza/c1")));
        const tree = snap.val();
        if (tree.who.s2.n !== "이두리" || tree.pos.s2.x !== 700) throw new Error("받은 자료가 다릅니다");
        await assertSucceeds(get(ref(dbOf(ctx), "plaza/c1/pos")));
        await assertSucceeds(get(ref(dbOf(ctx), "plaza/c1/who/s2")));
      }
    });
    it("입장권이 없으면 못 읽는다 — 다른 반 학생 · 입장권을 안 받은 학생 · 로그인 안 한 사람", async () => {
      await assertFails(get(ref(dbOf(asStudent(env, "other")), "plaza/c1")));
      await assertFails(get(ref(dbOf(asStudent(env, "nobody")), "plaza/c1/pos")));
      await assertFails(get(ref(dbOf(env.unauthenticatedContext()), "plaza/c1")));
      // 다른 반 학생은 제 반은 읽는다
      await assertSucceeds(get(ref(dbOf(asStudent(env, "other")), "plaza/c2")));
    });
    it("만료된 입장권으로는 못 읽는다", async () => {
      await assertFails(get(ref(dbOf(asStudent(env, "late")), "plaza/c1")));
      await assertFails(get(ref(dbOf(asStudent(env, "late")), "plaza/c1/who/late")));
    });
    it("광장 바깥 · 반들의 목록은 아무도 못 읽는다", async () => {
      const db = dbOf(asStudent(env, "s1"));
      await assertFails(get(ref(db, "plaza")));
      await assertFails(get(ref(db, "/")));
      await assertFails(get(ref(db, "other/path")));
      await assertFails(get(ref(db, "plaza/c2")));
    });
  });

  describe("입장권 — 앱에서는 아무도 못 쓴다", () => {
    it("본인도 제 입장권을 만들거나 고치지 못한다(이름표 · 만료 늘리기)", async () => {
      const db = dbOf(asStudent(env, "s1"));
      await assertFails(set(ref(db, "plaza/c1/who/s1/n"), "선생님"));
      await assertFails(update(ref(db, "plaza/c1/who/s1"), { exp: Date.now() + 99 * HOUR }));
      await assertFails(set(ref(db, "plaza/c1/who/s1"), { n: "선생님", r: 1, c: "zodiac-01", ps: 0, exp: Date.now() + HOUR }));
      await assertFails(remove(ref(db, "plaza/c1/who/s1")));
    });
    it("입장권 없는 사람이 스스로 입장권을 만들지 못한다 · 남의 입장권도 못 건드린다", async () => {
      await assertFails(set(ref(dbOf(asStudent(env, "nobody")), "plaza/c1/who/nobody"), { n: "몰래", c: "zodiac-01", ps: 0, exp: Date.now() + HOUR }));
      await assertFails(set(ref(dbOf(asStudent(env, "late")), "plaza/c1/who/late/exp"), Date.now() + HOUR));
      await assertFails(remove(ref(dbOf(asStudent(env, "s1")), "plaza/c1/who/s2")));
      // 선생님도 앱에서는 못 씁니다(서버만)
      await assertFails(remove(ref(dbOf(asTeacher(env, "teacherA")), "plaza/c1/who/s2")));
      await assertFails(set(ref(dbOf(asTeacher(env, "teacherA")), "plaza/c1"), null));
    });
  });

  describe("자리 — 제 것만, 정해진 모양으로", () => {
    it("입장권이 있으면 제 자리를 쓴다 — 선 자리 · 길을 따라 걷기 · 방향키 걷기 · 글 읽는 중", async () => {
      const db = dbOf(asStudent(env, "s1"));
      await assertSucceeds(set(ref(db, "plaza/c1/pos/s1"), place()));
      await sleep(140);
      await assertSucceeds(set(ref(db, "plaza/c1/pos/s1"), place({ m: 1, f: 1, w: "900,420,1010,455" })));
      await sleep(140);
      await assertSucceeds(set(ref(db, "plaza/c1/pos/s1"), place({ x: 0, y: 941, m: 2, f: 3 })));
      await sleep(140);
      await assertSucceeds(set(ref(db, "plaza/c1/pos/s1"), place({ x: 1672, y: 0, m: 0, f: 2, a: 1 })));
      // 선생님도 같은 길
      await assertSucceeds(set(ref(dbOf(asTeacher(env, "teacherA")), "plaza/c1/pos/teacherA"), place()));
    });
    it("남의 자리는 못 쓴다 — 친구 것도, 선생님 것도", async () => {
      await assertFails(set(ref(dbOf(asStudent(env, "s1")), "plaza/c1/pos/s2"), place()));
      await assertFails(set(ref(dbOf(asStudent(env, "s1")), "plaza/c1/pos/teacherA"), place()));
      await assertFails(set(ref(dbOf(asTeacher(env, "teacherA")), "plaza/c1/pos/s2"), place()));
      await assertFails(update(ref(dbOf(asStudent(env, "s1")), "plaza/c1/pos"), { s1: place(), s2: place() }));
    });
    it("입장권이 없거나 만료됐으면 못 쓴다 · 다른 반 입장권으로도 못 쓴다", async () => {
      await assertFails(set(ref(dbOf(asStudent(env, "nobody")), "plaza/c1/pos/nobody"), place()));
      await assertFails(set(ref(dbOf(asStudent(env, "late")), "plaza/c1/pos/late"), place()));
      await assertFails(set(ref(dbOf(asStudent(env, "other")), "plaza/c1/pos/other"), place()));
      await assertFails(set(ref(dbOf(env.unauthenticatedContext()), "plaza/c1/pos/s1"), place()));
    });
    it("모양이 틀리면 거부한다 — 그림 밖 · 글자 · 낯선 칸 · 빠진 칸 · 꾸민 시각", async () => {
      const db = dbOf(asStudent(env, "s1"));
      const at = ref(db, "plaza/c1/pos/s1");
      const bad = [
        place({ x: -1 }), place({ x: 1673 }), place({ y: 942 }), place({ x: "836" }),
        place({ m: 3 }), place({ m: -1 }), place({ f: 4 }), place({ f: "left" }),
        place({ m: 1, w: "900;420" }), place({ m: 1, w: "<b>1</b>" }), place({ m: 1, w: "1,".repeat(90) }), place({ m: 1, w: 12 }),
        place({ a: 2 }), place({ a: true }), place({ g: 0 }),
        place({ name: "선생님" }), place({ n: "몰래" }), place({ exp: 1 }),
        place({ t: Date.now() + 60000 }), place({ t: 1 }),
        { x: 1, y: 1, m: 0, f: 0 }, { x: 1, m: 0, f: 0, t: serverTimestamp() }, { y: 1, m: 0, f: 0, t: serverTimestamp() },
        { x: 1, y: 1, f: 0, t: serverTimestamp() }, { x: 1, y: 1, m: 0, t: serverTimestamp() },
        "여기", 42,
      ];
      for (const value of bad) await assertFails(set(at, value));
      // 그 뒤에도 바른 모양은 그대로 쓴다
      await assertSucceeds(set(at, place()));
    });
    it("자리를 지우지는 못한다 — 나갈 때는 '나감' 표시를 남긴다", async () => {
      const db = dbOf(asStudent(env, "s1"));
      const at = ref(db, "plaza/c1/pos/s1");
      await assertSucceeds(set(at, place()));
      await assertFails(remove(at));
      await assertFails(set(at, null));
      // '나감' 표시는 방금 쓴 뒤에도 곧바로 된다(탭을 닫는 순간)
      await assertSucceeds(set(at, place({ g: 1 })));
      // 남의 자리에 '나감'을 적지는 못한다
      await assertFails(set(ref(db, "plaza/c1/pos/s2"), place({ g: 1 })));
    });
  });

  describe("잦은 쓰기 — 0.1초 안에는 다시 못 쓴다", () => {
    it("연달아 쓰면 둘째가 거부되고, 조금 쉬면 다시 된다", async () => {
      const db = dbOf(asStudent(env, "s1"));
      const at = ref(db, "plaza/c1/pos/s1");
      await assertSucceeds(set(at, place()));
      await assertFails(set(at, place({ x: 840 })));
      await sleep(140);
      await assertSucceeds(set(at, place({ x: 840 })));
    });
    it("'나감' 표시를 되풀이하거나, 나감 → 다시 쓰기를 번갈아 해도 천장을 넘지 못한다", async () => {
      const db = dbOf(asStudent(env, "s1"));
      const at = ref(db, "plaza/c1/pos/s1");
      await assertSucceeds(set(at, place()));
      await assertSucceeds(set(at, place({ g: 1 })));
      await assertFails(set(at, place({ g: 1 })), "나감 다음의 나감은 곧바로 안 된다");
      await assertFails(set(at, place()), "나감 바로 뒤에 다시 쓰기도 곧바로는 안 된다");
      await sleep(140);
      // 조금 쉬면 다시 들어온다(탭을 다시 열었을 때)
      await assertSucceeds(set(at, place()));
    });
    it("남이 써 둔 지 오래된 자리에는 곧바로 쓴다(처음 들어설 때)", async () => {
      // s2의 자리는 5초 전에 적힌 것
      await assertSucceeds(set(ref(dbOf(asStudent(env, "s2")), "plaza/c1/pos/s2"), place({ x: 705 })));
    });
  });
});
