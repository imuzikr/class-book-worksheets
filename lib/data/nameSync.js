// =============================================================
// 이름 맞추기 — 교사가 학생 프로필의 이름 · 학번을 고친 뒤(관리자 대시보드의 학생
// 프로필 창), 내 반 기록에 적혀 있던 옛 이름표를 새 값으로 바꿉니다.
// -------------------------------------------------------------
// 책봄의 많은 화면이 글을 쓸 때(또는 모둠에 들 때) 이름을 기록 안에 적어 두고 그것을
// 보여 줍니다. 그래서 프로필만 고치면 옛 이름이 남습니다 — 그 자리를 여기서 고칩니다.
//   · 반 아래: 기본 모둠 · 손들기 · 손들기 이력 · 메신저(학생이 보낸 말) · 책 광장(목록 · 책 · 댓글)
//   · 반 바깥: KWLS
//   · 독서 활동 아래: 모둠 명단 · 학생 기록 · 낱말 · 가로세로 힌트/맞힌 기록 ·
//     브레인 라이팅 · '내 생각은요' 실명 메모 · 해시태그 글/댓글 · 동료 평가
// 운영 중인 **내 반**만 고칩니다(보관된 반 · 다른 선생님 반은 규칙이 막음). 규칙
// (isNameSync)은 이름표 칸만, 그 학생의 지금 프로필 값으로만 바꾸게 합니다.
// 이름을 적어 두는 기록을 새로 만들면 여기에도 더하세요.
// =============================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase";
import { mock } from "./shared";
import { membersPatched, namePatchFor } from "../nameFields";

// [교사] 내 반들에서 그 학생의 이름표를 맞춥니다. 돌려주는 값 { updated, failed }.
export async function syncStudentName(uid, { realName, studentId }, myClasses = [], onStep = () => {}) {
  const name = String(realName ?? "").trim();
  const sid = String(studentId ?? "").trim() || null;
  if (!uid || !name) return { updated: 0, failed: 0 };
  let updated = 0;
  let failed = 0;
  const live = myClasses.filter((c) => !c.archived);

  if (!isFirebaseConfigured) {
    // 데모 — 그 학생을 가리키는 모든 줄의 이름표 · 모둠 명단을 고칩니다
    for (const [key, rows] of Object.entries(mock)) {
      if (!Array.isArray(rows) || key === "classes") continue;
      let touched = false;
      const next = rows.map((r) => {
        if (!r || typeof r !== "object") return r;
        const patch = namePatchFor(r, uid, name, sid, { withSid: true });
        const members = membersPatched(r.members, uid, name, sid);
        if (members) patch.members = members;
        const groups = Array.isArray(r.groups)
          ? r.groups.map((g) => { const m = membersPatched(g?.members, uid, name, sid); return m ? { ...g, members: m } : g; })
          : null;
        if (groups && groups.some((g, i) => g !== r.groups[i])) patch.groups = groups;
        if (!Object.keys(patch).length) return r;
        touched = true;
        updated += 1;
        return { ...r, ...patch };
      });
      if (touched) mock[key] = next;
    }
    return { updated, failed };
  }

  // 기록 하나씩 고칩니다 — 묶음으로 쓰면 규칙이 기록마다 읽는 프로필이 한도(20)를 넘깁니다.
  const fix = async (ref, patch) => {
    if (!Object.keys(patch).length) return;
    try { await updateDoc(ref, patch); updated += 1; } catch (e) {
      failed += 1;
      console.warn("[이름 맞추기] 건너뜀:", ref.path, e?.code);
    }
  };
  const fixDocs = async (snap, opts) => {
    for (const d of snap.docs) await fix(d.ref, namePatchFor(d.data(), uid, name, sid, opts));
  };
  const read = (q) => getDocs(q).catch(() => ({ docs: [] }));

  for (let i = 0; i < live.length; i++) {
    const cId = live[i].id;
    onStep({ done: i, total: live.length });
    const member = await getDoc(doc(db, "memberships", `${uid}_${cId}`)).catch(() => null);
    if (!member?.exists()) continue;
    const sub = (n) => collection(db, "classes", cId, n);

    const ga = await getDoc(doc(db, "classes", cId, "groupAssignments", "default")).catch(() => null);
    if (ga?.exists()) {
      let changed = false;
      const groups = (ga.data().groups ?? []).map((g) => {
        const m = membersPatched(g.members, uid, name, sid);
        if (!m) return g;
        changed = true;
        return { ...g, members: m };
      });
      if (changed) await fix(ga.ref, { groups });
    }
    const sig = await getDoc(doc(db, "classes", cId, "questionSignals", uid)).catch(() => null);
    if (sig?.exists()) await fix(sig.ref, namePatchFor(sig.data(), uid, name, sid, { withSid: true }));
    await fixDocs(await read(query(sub("chatMessages"), where("fromUid", "==", uid))));
    await fixDocs(await read(query(collection(db, "kwl"), where("classId", "==", cId), where("userId", "==", uid))));
    // 책 광장의 공유 사본 · 댓글 — 서버가 그 학생의 다음 저장 때 다시 적지만, 그 전에도 이름이 맞게 고칩니다.
    const plazaShelf = await getDoc(doc(db, "classes", cId, "plazaShelves", uid)).catch(() => null);
    if (plazaShelf?.exists()) await fix(plazaShelf.ref, namePatchFor(plazaShelf.data(), uid, name, sid, { withSid: true }));
    await fixDocs(await read(query(sub("plazaBooks"), where("uid", "==", uid))), { withSid: true });
    await fixDocs(await read(query(sub("plazaComments"), where("uid", "==", uid))), { withSid: true });

    const acts = await read(query(collection(db, "bookActivities"), where("classId", "==", cId)));
    for (const a of acts.docs) {
      const aSub = (n) => collection(a.ref, n);
      const groups = await read(aSub("groups"));
      for (const g of groups.docs) {
        const m = membersPatched(g.data().members, uid, name, sid);
        if (m) await fix(g.ref, { members: m });
        const gq = (n, f) => read(query(collection(g.ref, n), where(f, "==", uid)));
        await fixDocs(await gq("words", "authorId"));
        await fixDocs(await gq("xwHints", "writerUid"));
        await fixDocs(await gq("xwSolves", "uid"));
        await fixDocs(await gq("bwNotes", "writerUid"));
      }
      const entry = await getDoc(doc(a.ref, "entries", uid)).catch(() => null);
      if (entry?.exists()) await fix(entry.ref, namePatchFor(entry.data(), uid, name, sid));
      const post = await getDoc(doc(a.ref, "hashtagPosts", uid)).catch(() => null);
      if (post?.exists()) await fix(post.ref, namePatchFor(post.data(), uid, name, sid, { withSid: true }));
      // '내 생각은요'는 실명 메모만 — 익명 시절의 메모는 화면이 명단의 실명으로 보여 줍니다
      const notes = await read(query(aSub("opinionNotes"), where("authorId", "==", uid)));
      for (const n of notes.docs) if (n.data().real) await fix(n.ref, namePatchFor(n.data(), uid, name, sid, { withSid: true }));
      await fixDocs(await read(query(aSub("hashtagComments"), where("authorId", "==", uid))), { withSid: true });
      await fixDocs(await read(query(aSub("peerReviews"), where("fromUid", "==", uid))));
      await fixDocs(await read(query(aSub("peerReviews"), where("toUid", "==", uid))));
    }
  }
  return { updated, failed };
}
