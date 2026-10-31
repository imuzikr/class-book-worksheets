// =============================================================
// 공부방 프로젝트(studyBoards) · 개인 카드 · 프로젝트 원본(studyTemplates)
// -------------------------------------------------------------
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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { examplesFor } from "../activityExamples";
import { db, isFirebaseConfigured } from "../firebase";
import { replaceDoc } from "../mockDocs";
import { mock, mockListeners, nextMockSeq, notify, personalizeCards, sortByOldest } from "./shared";

// -------------------------------------------------------------
// 공부방 (Study) — 수업의 연장. 보드(컬럼) + 카드.
// -------------------------------------------------------------
//   studyBoards (컬렉션)
//     └ { title, type('notice'|'student'), description,
//         viewMode('shared'|'private'), editMode('open'|'locked'),
//         keyword(연계 키워드|null), order, createdAt, createdBy }
//   studyCards (컬렉션)
//     └ { boardId, content(HTML), imageUrl, authorId, authorName,
//         authorEmoji, authorRealName, createdAt, updatedAt }
//
// [설계] 학생은 한 보드에 카드 1개만 만듭니다(화면에서 제어).
//   viewMode='private'(기본)면 학생은 자기 카드만, 교사는 전부 봅니다.
//   editMode='locked'면 작성/수정이 막히고 보기 전용이 됩니다.
// -------------------------------------------------------------

export function notifyStudyBoards() {
  notify(
    mockListeners.studyBoards,
    [...mock.studyBoards].sort((a, b) => a.order - b.order)
  );
}

export function notifyStudyCards(boardId) {
  const list = personalizeCards(
    sortByOldest(mock.studyCards.filter((c) => c.boardId === boardId))
  );
  notify(mockListeners.studyCards.get(boardId) ?? new Set(), list);
  // 내 카드 구독자(리포트)도 갱신
  if (mockListeners.myCards) mockListeners.myCards.forEach((cb) => cb());
}

// [교사] 모둠 구성 저장 — 모둠 수만큼 카드를 만들고(문서 ID = group_순번),
// 이미 있는 순번의 카드는 작성 내용(제목·본문·첨부)을 유지한 채 모둠
// 명단·이름·대표만 갱신합니다(재구성). 모둠 수가 줄면 남는 카드는
// retired 처리(교사만 표시, 학생 구독에선 제외 — memberUids 비움).
// groups: [{ index(1부터), name, memberUids[], members[{uid,name,emoji}], leaderUid }]
export async function composeStudyGroups(user, boardId, groups, options = {}) {
  const groupSetName = options.groupSetName || groups[0]?.groupSetName || "활동 모둠";
  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(db, "studyBoards", boardId, "cards"));
    const existingGroupCardIds = snap.docs
      .filter((d) => d.data().groupId)
      .map((d) => d.id);
    const batch = writeBatch(db);
    groups.forEach((g) => {
      const id = `group_${g.index}`;
      const ref = doc(db, "studyBoards", boardId, "cards", id);
      // 모둠명은 title(학생도 수정 가능)로 저장. 구성 시 교사가 정한 이름을
      // title에도 반영(재구성 시 편집기에 현재 title을 미리 불러오므로 학생
      // 변경분도 보존됨). groupName은 참고용으로 함께 저장.
      const groupFields = {
        groupId: `g${g.index}`,
        groupIndex: g.index,
        groupName: g.name,
        groupSetName,
        title: g.name,
        memberUids: g.memberUids,
        members: g.members,
        leaderUid: g.leaderUid ?? null,
        retired: false,
        updatedAt: serverTimestamp(),
      };
      if (existingGroupCardIds.includes(id)) {
        batch.set(ref, groupFields, { merge: true }); // 본문·첨부는 유지
      } else {
        batch.set(ref, {
          boardId,
          content: "",
          imageUrl: null,
          attachments: [],
          authorId: user.uid,
          authorName: "선생님",
          authorEmoji: "🧑‍🏫",
          createdAt: serverTimestamp(),
          ...groupFields,
        });
      }
    });
    // 줄어든 순번의 기존 모둠 카드 → 보관(retired)
    existingGroupCardIds.forEach((id) => {
      const idx = Number(id.replace("group_", ""));
      if (!groups.some((g) => g.index === idx)) {
        batch.set(
          doc(db, "studyBoards", boardId, "cards", id),
          { retired: true, memberUids: [], members: [], leaderUid: null, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    });
    await batch.commit();
    return;
  }
  // 데모 모드
  groups.forEach((g) => {
    const id = `group_${g.index}`;
    const groupFields = {
      groupId: `g${g.index}`,
      groupIndex: g.index,
      groupName: g.name,
      groupSetName,
      title: g.name,
      memberUids: g.memberUids,
      members: g.members,
      leaderUid: g.leaderUid ?? null,
      retired: false,
    };
    const existing = mock.studyCards.find(
      (c) => c.boardId === boardId && c.id === id
    );
    if (existing) replaceDoc(mock.studyCards, existing, groupFields);
    else
      mock.studyCards.push({
        id,
        boardId,
        title: g.name,
        content: "",
        imageUrl: null,
        attachments: [],
        authorId: user.uid,
        authorName: "선생님",
        authorEmoji: "🧑‍🏫",
        createdAt: new Date(),
        ...groupFields,
      });
  });
  mock.studyCards.forEach((c) => {
    if (
      c.boardId === boardId &&
      c.groupId &&
      !groups.some((g) => `group_${g.index}` === c.id)
    ) {
      replaceDoc(mock.studyCards, c, { retired: true, memberUids: [], members: [], leaderUid: null });
    }
  });
  mockListeners.studyCards.get(boardId)?.forEach((cb) => cb());
}

// 카드 **한 장** 구독 — 수업 노트 서랍의 활동 칸이 씁니다.
// 서랍 뒤에 그 카드가 함께 열려 있을 수 있어(공부방 프로젝트 화면에서
// '파이썬 실행기' 단추로 연 경우) 한 번 읽고 끝내면, 카드 화면에서 고친
// 칸을 서랍이 옛 값으로 되써 버립니다. 문서 하나라 읽기는 늘 1건입니다.
// 없으면 null — 아직 한 번도 안 쓴 카드입니다(규칙이 반 학생의 개별
// 프로젝트 카드 get을 허용해, 없는 문서도 거부되지 않습니다).
export function subscribeStudyCard(boardId, cardId, callback) {
  if (!boardId || !cardId) {
    callback(null);
    return () => {};
  }
  if (isFirebaseConfigured) {
    return onSnapshot(
      doc(db, "studyBoards", boardId, "cards", cardId),
      (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => callback(null)
    );
  }
  if (!mockListeners.studyCards.has(boardId)) {
    mockListeners.studyCards.set(boardId, new Set());
  }
  // mock은 카드를 제자리에서 고치므로 **얕은 사본**을 넘깁니다 — 같은 참조를
  // 받으면 React가 다시 그리지 않습니다(반 문서에서 겪은 그 함정).
  // 작성자로도 찾습니다 — 데모에서 역할 전환으로 된 학생은 카드가 교사식 자동
  // ID로 생겨(`addStudyCard`의 역할 판정) uid로는 못 찾습니다. 실서비스는 규칙이
  // 학생 카드 ID를 uid로 못 박아 이 갈래가 필요 없습니다.
  const emit = () => {
    const c =
      mock.studyCards.find((x) => x.boardId === boardId && x.id === cardId) ??
      mock.studyCards.find((x) => x.boardId === boardId && x.authorId === cardId);
    callback(c ? { ...c } : null);
  };
  mockListeners.studyCards.get(boardId).add(emit);
  emit();
  return () => mockListeners.studyCards.get(boardId)?.delete(emit);
}

// [교사] 보드(프로젝트) 추가 (맨 뒤 순서로)
// -------------------------------------------------------------
// activities: 학생 개인 카드에 제시할 활동 이름 목록. 프로젝트를 만들 때
// 함께 정합니다(만든 뒤 '활동 설정'에서 언제든 고칠 수 있음).
//
// **첫 활동만 열린 채로 시작합니다** — 책방의 곁텍스트 읽기와 같은 모양입니다
// (거기도 만들면 1단계만 열립니다). 한때 전부 열어 두었는데, 같은 '한 칸씩
// 열어 주는' 진행인데 두 방이 서로 다르게 시작해 교사가 화면마다 다시
// 익혀야 했습니다. 수업 도중 더하는 활동은 지금까지처럼 nextActivityLocks가
// 잠근 채로 시작시킵니다.
export async function addStudyBoard(
  user,
  {
    title,
    type = "student",
    description = "",
    keywords = [],
    classId = null,
    activityType = "individual", // 'individual'(개별) | 'group'(모둠)
    activities = [],
    // 프로젝트 원본(studyTemplates)에서 시작한 복사본이면 그 원본의 id.
    // 가져오기 목록이 이 값으로 복사본을 숨기고 원본 하나만 세웁니다.
    templateId = null,
    // 파이썬 실행기와 연계 — 켜면 학생 카드의 활동 칸을 셀 창에서 씁니다.
    pyLinked = false,
    // 활동 예시 코드 { [활동 이름]: 코드 } — lib/activityExamples.js
    activityExamples = null,
  }
) {
  const acts = (activities ?? []).filter((a) => String(a).trim().length > 0);
  const examples = examplesFor(acts, activityExamples);
  const data = {
    classId: classId ?? null,
    title,
    type,
    description,
    keywords: keywords ?? [],
    activityType,
    activities: acts,
    activityLocks: acts.map((_, i) => i > 0), // 첫 활동만 열림
    pyLinked: !!pyLinked,
    // 예시가 없는 보드에는 칸 자체를 안 둡니다 — 지금까지의 모양 그대로.
    ...(Object.keys(examples).length ? { activityExamples: examples } : {}),

    viewMode: type === "notice" ? "shared" : "private", // notice는 학생 전체 공지, 학생 보드는 기본 비공개
    editMode: "open",
    createdBy: user.uid,
    // 원본 없이 만든 보드에는 칸 자체를 안 둡니다 — 지금까지의 모양 그대로.
    ...(templateId ? { templateId } : {}),
  };
  // 만든 보드의 id를 돌려줍니다 — 수업 준비에서 '수업 보드 추가'로 만든 뒤
  // 바로 그 보드를 수업 자료에 연결하려면 id가 필요합니다.
  if (isFirebaseConfigured) {
    const ref = await addDoc(collection(db, "studyBoards"), {
      ...data,
      order: Date.now(),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
  const maxOrder = Math.max(0, ...mock.studyBoards.map((b) => b.order));
  const id = `b${nextMockSeq()}_m`;
  mock.studyBoards.push({
    id,
    ...data,
    order: maxOrder + 1,
    createdAt: new Date(),
  });
  notifyStudyBoards();
  return id;
}

export async function ensureDefaultStudyBoard(user, classId) {
  if (!user || !classId) return null;
  if (isFirebaseConfigured) {
    const existing = await getDocs(
      query(
        collection(db, "studyBoards"),
        where("classId", "==", classId),
        where("type", "==", "notice"),
        limit(1)
      )
    );
    if (!existing.empty) return existing.docs[0].id;
  } else {
    const existing = mock.studyBoards.find((b) => b.classId === classId && b.type === "notice");
    if (existing) return existing.id;
  }

  return addStudyBoard(user, {
    title: "선생님 보드",
    type: "notice",
    description: "수업 안내와 자료를 올려 주세요.",
    classId,
  });
}

// 카드 추가. content는 서식(HTML), imageUrl은 첨부 이미지(선택), attachments는 파일 첨부 목록
export async function addStudyCard(user, boardId, { title = "", content, imageUrl = null, attachments = [] }) {
  const data = {
    boardId,
    title: title ?? "",
    content,
    imageUrl: imageUrl ?? null,
    attachments: attachments ?? [],
    authorId: user.uid,
    authorName: user.displayName,
    authorEmoji: user.emoji ?? null,
    // 실명·이메일·학번 등 식별 정보는 카드에 저장하지 않음
    // — 교사는 사용자 디렉터리(users/{uid})로 확인
  };
  // 교사는 한 보드에 카드를 여러 개 올릴 수 있음(예시·자료 등) → 자동 ID.
  // 학생은 문서 ID=uid로 고정해 "보드당 1개"를 문서 수준에서 보장(중복 제출 방지).
  const isTeacherUser = user.role === "admin" || user.role === "teacher";
  if (isFirebaseConfigured) {
    if (isTeacherUser) {
      // 교사는 자동 ID → 생성된 카드 ID를 돌려줍니다(자동저장이 이후 갱신에 사용).
      const ref = await addDoc(collection(db, "studyBoards", boardId, "cards"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    }
    // 학생은 문서 ID=uid로 고정 → uid가 곧 카드 ID입니다.
    await setDoc(doc(db, "studyBoards", boardId, "cards", user.uid), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return user.uid;
  }
  // mock: 교사는 매번 새 카드, 학생은 기존 카드 교체(없으면 추가)
  const existing = isTeacherUser
    ? null
    : mock.studyCards.find((c) => c.boardId === boardId && c.authorId === user.uid);
  if (existing) {
    replaceDoc(mock.studyCards, existing, data, { updatedAt: new Date() });
    notifyStudyCards(boardId);
    return existing.id;
  }
  const newId = isTeacherUser ? `card${nextMockSeq()}_m` : user.uid;
  mock.studyCards.push({
    id: newId,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  notifyStudyCards(boardId);
  return newId;
}

// 카드 수정 — 작성자 본인(또는 교사)만 호출하도록 화면에서 제어
// 넘어온 필드만 갱신합니다(부분 수정).
// -------------------------------------------------------------
// 예전에는 네 필드를 늘 함께 덮어썼습니다. 그래서 제목만 바꾸려고
// { title }만 넘기면 content가 undefined가 되어 Firestore가 문서 수정을
// 통째로 거부했고(=제목도 안 바뀜), 데모 모드에서는 본문·이미지·첨부가
// 빈 값으로 지워졌습니다. 보드 제목을 바꿀 때 학생 카드 제목을 따라
// 맞추는 자리(StudyProjectView.commitTitle)가 정확히 이 경우입니다.
export async function updateStudyCard(boardId, cardId, fields = {}) {
  const patch = {};
  if (fields.title !== undefined) patch.title = fields.title ?? "";
  if (fields.content !== undefined) patch.content = fields.content ?? "";
  if (fields.imageUrl !== undefined) patch.imageUrl = fields.imageUrl ?? null;
  if (fields.attachments !== undefined) patch.attachments = fields.attachments ?? [];
  if (Object.keys(patch).length === 0) return;
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "studyBoards", boardId, "cards", cardId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const target = mock.studyCards.find(
    (c) => c.boardId === boardId && c.id === cardId
  );
  if (target) replaceDoc(mock.studyCards, target, patch, { updatedAt: new Date() });
  notifyStudyCards(boardId);
}
