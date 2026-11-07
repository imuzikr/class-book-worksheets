// =============================================================
// 반 완전 삭제 — 무엇을 지우는가 (lib/data/classes.js의 purgeClass)
// -------------------------------------------------------------
// 브라우저용 Firestore에는 '아래까지 통째로 지우기'가 없어, 앱이 컬렉션
// 이름을 알고 하나씩 찾아 지웁니다. 그래서 **반에 딸린 새 컬렉션을 만들면
// 여기에 이름을 더하세요** — 빠지면 그 기록만 콘솔에 남습니다.
// tests/unit/classPurge.test.mjs가 firestore.rules의 match와 이 목록을
// 견주어, 규칙에는 있는데 목록에 없는 이름을 잡아냅니다.
// =============================================================

// classes/{classId} 아래 하위 컬렉션. 규칙에서 걷은 옛 이름(cornellNotes ·
// lessonMemos · signalReplies)도 넣어 둡니다 — 배움나눔에서 옮겨 온 반에
// 남아 있을 수 있고, 없으면 빈 목록을 한 번 읽을 뿐입니다.
export const CLASS_SUBCOLLECTIONS = [
  "questionSignals",
  "signalMessages",
  "signalEvents",
  "popQuizzes",
  "attendanceRecords",
  "fruitBasket",
  "fruitEvents",
  "rewardEvents",
  "classNotices",
  "seatLayouts",
  "groupAssignments",
  "chatMessages",
  "chatRoomReads",
  "chatReads",
  "readingMembers",
  "cornellNotes",
  "lessonMemos",
  "signalReplies",
];

// 하위 컬렉션의 문서 아래에 한 겹 더 있는 것 — 부모를 지우기 전에 먼저 지웁니다.
export const CLASS_NESTED = {
  popQuizzes: ["submissions"],
};

// 반 바깥에 있으면서 classId 칸으로 반을 가리키는 컬렉션.
// (bookActivities는 활동마다 아래가 깊어 purgeBookActivity로 따로 지웁니다.
//  joinCodes는 보관할 때 이미 지워지고, 남은 것은 만든 교사 기준으로 찾습니다.
//  broadcasts는 문서 id가 곧 반 id입니다.)
export const CLASS_LINKED_COLLECTIONS = [
  "memberships",
  "rewards",
  "presence",
  "studentNotes",
  "studyBoards",
  "kwl",
];

// 반과 상관없는 최상위 컬렉션 — 시험이 '빠뜨린 것'으로 세지 않게 적어 둡니다.
// (users의 학생 프로필은 다른 반에서도 쓰므로 반을 지워도 남깁니다.)
export const NOT_CLASS_COLLECTIONS = ["users", "meta"];
export const CLASS_SPECIAL_COLLECTIONS = ["classes", "bookActivities", "joinCodes", "broadcasts"];

// 반 이름을 그대로 적어야 지워집니다 — 앞뒤 공백만 걷고 견줍니다.
export function purgeNameMatches(typed, name) {
  const a = String(typed ?? "").trim();
  return a.length > 0 && a === String(name ?? "").trim();
}

// 진행 표시 한 줄 — onStep이 넘기는 { stage, done, total }.
export function purgeStepText(step) {
  if (!step) return "";
  const n = (x) => `(${Math.min(x.done + 1, x.total)}/${x.total})`;
  if (step.stage === "activities") return `독서 활동 지우는 중 ${n(step)}`;
  if (step.stage === "records") return `반 기록 지우는 중 ${n(step)}`;
  if (step.stage === "final") return "반을 지우는 중…";
  return "지우는 중…";
}
