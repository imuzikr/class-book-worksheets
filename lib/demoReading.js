import { DEMO_ACTIVITY_IDS, DEMO_CLASS_ID, DEMO_STUDENTS } from "./demoClassroom";
import { applyReadingAction, deriveReading, initialReadingState, kstToday } from "./reading";

// All titles, writers, page counts and responses below are fictional examples.
// Store only source records: XP, levels, progress and badges use the real model.
const DAY_MS = 86400000;
const FIRST_BOOK = { title: "바람을 모으는 도서관", author: "책봄 창작팀", totalPages: 160 };
const OTHER_BOOKS = [
  { title: "느린 우체통의 답장", author: "책봄 창작팀", totalPages: 120 },
  { title: "우리 동네 작은 숲", author: "책봄 창작팀", totalPages: 144 },
  { title: "별을 빌려주는 가게", author: "책봄 창작팀", totalPages: 180 },
];
const PERSPECTIVES = [
  "친구의 말을 끝까지 기다려 주는 태도", "낯선 장소에서 용기를 내는 방법", "말로 표현하지 못한 마음을 알아차리는 일",
  "서로 다른 의견을 함께 놓고 생각하는 과정", "작은 약속을 지키는 책임", "실수한 뒤 다시 시도하는 용기",
  "책을 매개로 새로운 관계를 만드는 일", "혼자 있는 시간과 함께하는 시간의 균형", "기억을 기록으로 남기는 이유",
  "도움이 필요할 때 먼저 말하는 태도", "같은 장면을 다르게 해석하는 시선", "동네의 변화를 함께 살피는 마음",
  "결과보다 선택의 과정을 돌아보는 습관", "기다림 속에서 발견하는 변화", "일상의 작은 행동이 만드는 연결",
];
const SCENES = [
  "도서관 문 앞에서 망설이던 인물이 먼저 인사를 건네는 장면",
  "친구들이 같은 책에 서로 다른 제목을 붙여 보는 장면",
  "주인공이 잃어버린 메모를 함께 찾아 주는 장면",
  "창가에 모여 각자의 기억을 나누는 장면",
  "갈등을 피하던 인물이 자신의 생각을 말하는 장면",
  "작은 약속을 다음 만남까지 지켜 내는 장면",
];
const FIRST_PAGES = [160, 40, 160, 70, 160, 95, 160, 120, 160, 55, 160, 85, 160, 130, 160];

export function createDemoReadingStates(now = new Date()) {
  const instant = new Date(now);
  const today = kstToday(instant);
  // Shift date keys in UTC, not the execution host's time zone.
  const day = (back) => new Date(Date.parse(`${today}T00:00:00Z`) - back * DAY_MS).toISOString().slice(0, 10);
  const timestamp = (back) => new Date(Math.min(Date.parse(`${day(back)}T18:00:00+09:00`), instant.getTime())).toISOString();

  return Object.fromEntries(DEMO_STUDENTS.map((student, index) => {
    let state = initialReadingState();
    const run = (action, id, back = 0) => {
      state = applyReadingAction(state, action, {
        uid: student.uid, classId: DEMO_CLASS_ID, id, now: timestamp(back),
      });
    };
    const addBook = (book, suffix, back, activityId) => {
      const id = `${student.uid}_book_${suffix}`;
      run({ type: "addBook", ...book, publisher: "책봄 목 데이터 출판사", activityId }, id, back);
      return id;
    };
    const addLogs = (bookId, pages, offsets, bookTitle) => {
      let previousEnd = 0;
      offsets.forEach((back, logIndex) => {
        const endPage = Math.floor(pages * (logIndex + 1) / offsets.length);
        const scene = SCENES[(index + logIndex) % SCENES.length];
        run({
          type: "addLog", bookId, date: day(back), startPage: previousEnd + 1, endPage,
          notes: `『${bookTitle}』에서 ${scene}이 기억에 남았다. ${PERSPECTIVES[index]}에 대해 생각해 보았다. 다음에는 인물의 말과 행동이 달라지는 이유를 찾아보고 싶다.`,
        }, `${bookId}_log_${logIndex + 1}`, back);
        previousEnd = endPage;
      });
    };
    const addReview = (bookId, title, complete, back) => run({
      type: "saveReview", bookId, rating: 3 + (index % 3),
      text: `『${title}』${complete ? "를 끝까지 읽으며" : "를 지금까지 읽으며"} 특히 '${PERSPECTIVES[index]}'라는 주제가 오래 남았다. 처음에는 주인공의 선택이 이해되지 않았지만, 다른 인물의 입장에서 같은 장면을 다시 보니 이유를 짐작할 수 있었다. ${SCENES[index % SCENES.length]}을 친구와 함께 이야기해 보고 싶다. 내 생활에서도 상대의 생각을 먼저 듣고 판단을 조금 늦추는 연습을 해 보려 한다.`,
    }, `${bookId}_review`, back);

    const firstId = addBook(FIRST_BOOK, "1", 27, DEMO_ACTIVITY_IDS.kwls);
    const firstOffsets = index === 0
      ? Array.from({ length: 14 }, (_, n) => 13 - n)
      : index === 1
        ? [6, 5, 4, 3, 2, 1, 0]
        : index === 2
          ? [14, 12, 10, 8, 6, 4, 2, 0]
          : Array.from({ length: 3 + index % 4 }, (_, n) => 23 - n * 3 - index % 3);
    addLogs(firstId, FIRST_PAGES[index], firstOffsets, FIRST_BOOK.title);
    addReview(firstId, FIRST_BOOK.title, FIRST_PAGES[index] === FIRST_BOOK.totalPages, firstOffsets.at(-1));
    if ([3, 9, 13].includes(index)) run({ type: "updateBook", bookId: firstId, status: "paused" }, `${firstId}_pause`);

    // Nine students have a second book; six have one. Every book has real logs.
    if (index < 9) {
      const second = OTHER_BOOKS[index % OTHER_BOOKS.length];
      const secondId = addBook(second, "2", 11, DEMO_ACTIVITY_IDS.paratext);
      const complete = index === 4;
      const pages = complete ? second.totalPages : 18 + index * 9;
      const offsets = index === 0 ? [6, 4, 2, 0] : [10, 7, 4, index % 3];
      addLogs(secondId, pages, offsets, second.title);
      if (![3, 5, 7].includes(index)) addReview(secondId, second.title, complete, offsets.at(-1));
      if (index === 6) run({ type: "updateBook", bookId: secondId, status: "paused" }, `${secondId}_pause`);
      if (index === 8) run({ type: "archiveBook", bookId: secondId, archived: true }, `${secondId}_archive`);
    }

    const badges = deriveReading(state, instant).earnedBadges;
    const featured = badges.slice().sort((a, b) => b.tier - a.tier || b.threshold - a.threshold)[0];
    if (featured) run({ type: "setFeaturedBadge", badgeId: featured.id }, `${student.uid}_featured`);
    return [student.uid, state];
  }));
}
