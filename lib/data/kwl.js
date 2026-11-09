// =============================================================
// KWLS 기록 — 독서 활동 'KWLS로 성찰하기'
// -------------------------------------------------------------
// 학생 글은 그 활동의 entries/{uid}와 kwl/{uid_classId_act_활동id} 두 곳에
// 함께 적고(saveKwlsActivityEntry), 교사 화면(KwlsBoard)은 kwl에서 읽습니다
// (subscribeActivityKwl). 화면은 "@/lib/store"에서 가져갑니다.
// =============================================================
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { todayDateKey } from "../dates";
import { db, isFirebaseConfigured } from "../firebase";
import { emptyKwlsAnswers, kwlsAnswersFromEntry } from "../kwls";
import { replaceDoc } from "../mockDocs";
import { saveParatextEntry } from "./books";
import { mock, mockListeners } from "./shared";

// 데모 — 활동 단위 구독자(act_<활동 id>)를 깨웁니다. 저마다 자기 조건으로
// 다시 걸러 내므로 인자 없이 깨우기만 하면 됩니다.
function notifyKwl() {
  for (const [k, set] of mockListeners.kwl) {
    if (k.startsWith("act_")) set.forEach((cb) => cb());
  }
}

// KWLS 활동 저장 — 그 활동의 기록(entries)과 kwl에 함께 적습니다.
// -------------------------------------------------------------
// entries는 곁텍스트·RAFT·마인드맵이 함께 쓰는 저장소라 학생 화면 · 분석 리포트가
// 그것을 읽고, 교사 화면(KwlsBoard)은 kwl을 읽습니다(배움나눔에서 옮겨 온 길).
// 문서 ID에 act_를 넣어 활동마다 한 장입니다.
// topic — 교사가 활동에 주제어를 정해 두었으면 그것, 비워 두었으면 학생이
// 자기 화면에서 적은 것.
export async function saveKwlsActivityEntry(activity, user, answers, topic = "") {
  await saveParatextEntry(activity.id, user, answers);
  if (!activity.classId) return; // 반이 없는 활동은 kwl 스트림에 넣을 수 없음

  const id = `${user.uid}_${activity.classId}_act_${activity.id}`;
  const base = {
    classId: activity.classId,
    userId: user.uid,
    answers: { ...emptyKwlsAnswers(), ...answers },
    activityId: activity.id,
    activityTitle: activity.title ?? "",
    topic: (activity.topic ?? "").trim() || String(topic ?? "").trim(),
    authorName: user.displayName ?? "나",
    authorEmoji: user.emoji ?? "🙂",
  };
  base.K = base.answers.know;
  base.W = base.answers.want;
  base.L = base.answers.learned;
  base.S = base.answers.still;

  if (isFirebaseConfigured) {
    const ref = doc(db, "kwl", id);
    // date · createdAt은 처음 쓴 날로 고정합니다. 규칙(kwl update)이 date가
    // 그대로일 것을 요구해서, 다음 날 고치며 오늘 날짜를 다시 실어 보내면 거부됩니다.
    const existing = await getDoc(ref).catch(() => null);
    const first = !existing?.exists();
    await setDoc(
      ref,
      first
        ? { ...base, date: todayDateKey(), createdAt: serverTimestamp() }
        : base,
      { merge: true }
    );
    return;
  }
  const found = mock.kwl.find((e) => e.id === id);
  if (found) replaceDoc(mock.kwl, found, base);
  else mock.kwl.push({ id, ...base, date: todayDateKey(), createdAt: new Date() });
  notifyKwl();
}

// [교사] KWLS 활동 한 개의 제출물 — kwl에서 읽습니다.
// -------------------------------------------------------------
// classId까지 함께 거는 이유는 두 가지입니다. 규칙이 문서마다
// ownsClass(classId) 로 판정하므로 반을 명시하면 통과가 분명해지고,
// 등식 조건 두 개는 색인을 따로 만들 필요가 없습니다.
//
// 반환 모양은 entries 쪽(authorId·authorName·answers)에 맞춰 둡니다 —
// 부르는 화면(KwlsBoard)이 그 모양을 이미 쓰고 있어서, 저장소가 바뀐 것을
// 화면이 알 필요가 없습니다.
export function subscribeActivityKwl(classId, actId, callback) {
  if (!classId || !actId) { callback([]); return () => {}; }
  const shape = (d) => ({
    id: d.id,
    authorId: d.userId,
    authorName: d.authorName ?? "",
    answers: kwlsAnswersFromEntry(d),
    // 교사가 활동에 주제어를 비워 두면 학생이 각자 적습니다. 교사 화면이
    // '누가 무엇을 다루는지'를 보여 주려면 이 값이 여기까지 와야 합니다.
    topic: d.topic ?? "",
    updatedAt: d.createdAt ?? null,
  });
  if (isFirebaseConfigured) {
    const q = query(
      collection(db, "kwl"),
      where("classId", "==", classId),
      where("activityId", "==", actId)
    );
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map((doc) => shape({ id: doc.id, ...doc.data() }))),
      (e) => {
        console.warn("[KWLS] 활동 제출물을 읽지 못했어요:", e?.code, e?.message);
        callback([]);
      }
    );
  }
  const key = `act_${actId}`;
  if (!mockListeners.kwl.has(key)) mockListeners.kwl.set(key, new Set());
  const cb = () =>
    callback(
      mock.kwl
        .filter((e) => e.classId === classId && e.activityId === actId)
        .map(shape)
    );
  mockListeners.kwl.get(key).add(cb);
  cb();
  return () => mockListeners.kwl.get(key)?.delete(cb);
}
