// =============================================================
// 반 공지 (classes/{cId}/classNotices)
// -------------------------------------------------------------
// 배움나눔에 있던 개인 알림함(users/{uid}/notifications)은 서버 함수가
// 쓰던 자리라 책 나눔에서는 걷었습니다(읽고 쓰는 함수 · 규칙 · 색인 모두).
//
// lib/store.js에서 떼어 낸 조각입니다. 화면은 지금까지처럼 "@/lib/store"에서
// 가져갑니다 — store.js가 여기 공개 이름을 그대로 다시 내보냅니다.
// =============================================================
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { toDate } from "../dates";
import { db, isFirebaseConfigured } from "../firebase";
import { getCurrentUser } from "../user";
import { mock, mockListeners, nextMockSeq } from "./shared";

// [교사] 반 공지 보내기 — classes/{cId}/classNotices에 한 장
// -------------------------------------------------------------
// 서버 함수 없이 교사가 곧바로 씁니다. 학생 한 명 한 명의 알림함에 넣지
// 않고(그 자리는 본인만 쓰게 잠겨 있음), 그 반 학생의 알림 벨과 간편
// 메신저 '공지' 탭이 이 문서를 읽습니다(subscribeClassNotices).
// '내 반인지'·글 길이는 보안 규칙이 확인합니다. sentCount는 보낼 때의
// 반 인원(화면에 적힌 수)을 기록으로만 남깁니다.
export async function sendClassNotice(classId, text, memberCount = 0) {
  const body = String(text ?? "").trim();
  if (!classId || !body) throw new Error("공지 내용을 입력해 주세요.");
  if (body.length > CLASS_NOTICE_MAX) throw new Error(`공지는 ${CLASS_NOTICE_MAX}자까지 쓸 수 있어요.`);
  if (!isFirebaseConfigured) {
    // 데모 모드는 알림을 받을 학생 계정이 없습니다. 대신 발송 이력만
    // 남겨 교사 화면(이력 목록)이 실제와 같게 동작하도록 합니다.
    if (!mock.classNotices) mock.classNotices = [];
    mock.classNotices.push({
      id: `cn${nextMockSeq()}_m`,
      classId,
      text: body,
      sentCount: memberCount,
      senderUid: getCurrentUser()?.uid ?? null,
      senderName: getCurrentUser()?.displayName ?? "선생님",
      sentAt: new Date(),
    });
    mockListeners.classNotices?.forEach((cb) => cb());
    return { ok: true, sent: memberCount };
  }
  const me = getCurrentUser();
  try {
    await addDoc(collection(db, "classes", classId, "classNotices"), {
      classId,
      text: body,
      sentCount: Number.isInteger(memberCount) ? memberCount : 0,
      senderUid: me?.uid ?? "",
      senderName: String(me?.realName || me?.displayName || "선생님").slice(0, 40),
      sentAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[반 공지] 보내기 실패:", err?.code, err?.message);
    throw new Error(
      err?.code === "permission-denied"
        ? "이 반에 공지를 보낼 수 없어요(보관된 반이거나 담당 반이 아니에요)."
        : "보내지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  }
  return { ok: true, sent: memberCount };
}

// 반 공지 글자 수 천장 — firestore.rules의 classNotices(500)와 같아야 합니다.
export const CLASS_NOTICE_MAX = 500;

// [교사] 반 공지 발송 이력 구독 → [{ text, sentCount, senderName, sentAt }] (최신순)
// -------------------------------------------------------------
// 교사가 보낸 공지 그 자체입니다 — 학생 알림 벨 · 메신저 '공지' 탭이 읽고,
// 교사에게는 무엇을 언제 보냈는지 보는 자리입니다.
//
// 최근 것만 봅니다 — 이 목록은 '방금 보낸 게 맞나', '아까 그거 보냈던가'를
// 확인하는 자리라 옛것까지 다 내려받을 이유가 없습니다.
const CLASS_NOTICE_HISTORY = 20;

// max — 몇 건까지(기본 20). 메신저의 '공지'는 최근 3건만 받습니다.
export function subscribeClassNotices(classId, callback, max = CLASS_NOTICE_HISTORY) {
  if (!classId) {
    callback([]);
    return () => {};
  }
  if (isFirebaseConfigured) {
    return onSnapshot(
      query(
        collection(db, "classes", classId, "classNotices"),
        orderBy("sentAt", "desc"),
        limit(max)
      ),
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => callback([])
    );
  }
  if (!mock.classNotices) mock.classNotices = [];
  if (!mockListeners.classNotices) mockListeners.classNotices = new Set();
  const emit = () =>
    callback(
      mock.classNotices
        .filter((n) => n.classId === classId)
        .sort((a, b) => toDate(b.sentAt) - toDate(a.sentAt))
        .slice(0, max)
    );
  mockListeners.classNotices.add(emit);
  emit();
  return () => mockListeners.classNotices.delete(emit);
}
