// =============================================================
// 데모 모드의 메모리 자료(mock) · 구독자 목록 · 모듈끼리 나눠 쓰는 작은 도우미
// -------------------------------------------------------------
// 영역 파일(lib/data/*)끼리 나눠 쓰는 비공개 도우미라 lib/store.js에 올리지 않습니다.
// =============================================================
import { toDate } from "../dates";
import { isFirebaseConfigured } from "../firebase";
import { createDemoClassroom } from "../demoClassroom";
import { createDemoBookActivities } from "../demoBookActivities";

// -------------------------------------------------------------
// 데모 모드용 임시 데이터 (새로고침하면 초기화됩니다)
// -------------------------------------------------------------
export const mock = {
  // 반(클래스) — 학생은 참여 코드로 들어옵니다. 데모의 반 고르개에 함께 섭니다
  // (독서 활동 데모 반은 아래 createDemoClassroom이 맨 앞에 더합니다).
  classes: [
    {
      id: "cl1",
      name: "3학년 1반",
      joinCode: "MATH31",
      createdBy: "user_01",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    },
    {
      id: "cl2",
      name: "3학년 2반",
      joinCode: "INFO32",
      createdBy: "user_01",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
    },
    {
      id: "cl3",
      name: "3학년 3반",
      joinCode: "BOND33",
      createdBy: "user_01",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
    },
  ],
  // KWLS 활동의 kwl 기록(lib/data/kwl.js)
  kwl: [],
  attendanceRecords: [],
  seatLayouts: [],
  groupAssignments: [],
};

// A fictional classroom for reviewing every reading activity. Never write these
// records to a live Firebase project or replace persisted class preferences.
if (!isFirebaseConfigured) {
  const demoNow = new Date();
  const classroom = createDemoClassroom(demoNow);
  mock.classes = [classroom.classDoc, ...mock.classes];
  mock.demoUsers = classroom.students;
  for (const key of ["memberships", "seatLayouts", "groupAssignments", "attendanceRecords", "rewards", "rewardEvents"]) {
    mock[key] = [...(mock[key] ?? []), ...classroom[key]];
  }
  for (const [key, rows] of Object.entries(createDemoBookActivities(demoNow))) {
    mock[key] = [...(mock[key] ?? []), ...rows];
  }
}

let mockSeq = 1;
// 다른 모듈은 이 값을 ++ 할 수 없습니다(ES 모듈의 import는 읽기 전용) — 이 함수로 올립니다.
export function nextMockSeq() {
  return ++mockSeq;
}
export const mockListeners = {
  classes: new Set(),
  kwl: new Map(),        // `act_${activityId}` -> Set(callback)
  questionSignals: new Map(), // classId -> Set(callback)
  attendanceRecords: new Map(), // classId -> Set(callback)
  seatLayouts: new Map(), // `${classId}_${layoutId}` -> Set(callback)
  groupAssignments: new Map(), // classId -> Set(callback)
};

export function notify(set, data) {
  set.forEach((cb) => cb([...data]));
}

// 반 목록 정렬 — 교사가 '반 관리하기'에서 드래그로 정한 순서(order)를 따르고,
// order가 없는(드래그로 손댄 적 없는 옛 반) 반은 만든 순으로 뒤에 붙습니다.
export function sortByClassOrder(arr) {
  return [...arr].sort((a, b) => {
    const ao = a.order;
    const bo = b.order;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return toDate(a.createdAt) - toDate(b.createdAt);
  });
}
