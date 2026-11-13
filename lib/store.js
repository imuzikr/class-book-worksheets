// =============================================================
// 데이터 레이어 (Firestore ↔ 데모 모드 자동 전환)
// -------------------------------------------------------------
// 화면(컴포넌트)은 이 파일의 이름만 가져다 씁니다.
// - Firebase 설정이 있으면 → Firestore에 실시간 저장/구독
// - 설정이 없으면           → 브라우저 메모리에 임시 저장(데모 모드)
//
// [파일 나누기] 한 파일이 7천 줄을 넘어 lib/data/ 아래 영역별 파일로
// 나눴습니다. 이 파일은 **다시 내보내기만** 합니다 — 화면은 지금까지처럼
// `import { … } from "@/lib/store"`로 씁니다. 새 함수는 알맞은 영역 파일에
// 두고 **여기 목록에도 한 줄 더하세요**(안 더하면 화면에서 안 보입니다).
// 영역 파일끼리 나눠 쓰는 비공개 도우미는 일부러 여기 올리지 않습니다.
// =============================================================

// 날짜·시각 순수 함수(lib/dates.js) — 예전부터 여기서 가져가던 이름
export { toDate, todayDateKey, formatTime, formatClockMs, formatStampMs } from "./dates";
// 자리 수(lib/seats.js)
export { STUDY_SEAT_COUNT } from "./seats";

export {
  fetchClass, subscribeClass, subscribeClasses, subscribeOwnClasses, setTeacherFeature, setTeacherReadingMapTheme,
  reorderClasses, addClass, renameClass, startClassAttendance,
  stopClassAttendance, callClassroomRoll, moveClassroomAll, archiveClass, unarchiveClass, purgeClass, regenerateJoinCode,
  subscribeJoinCodes, joinClassWithCode, ensureClassIdSynced,
  fetchClassRosterProfiles, subscribeClassDirectory, subscribeMyMemberships,
} from "./data/classes";
export {
  WithdrawBlocked, fetchStudentProfile, checkWithdraw, withdrawStudent,
} from "./data/withdraw";
export { setStudentSuspended, fetchUserSuspended } from "./data/suspend";
export { removeStudentFromClass } from "./data/removeFromClass";
export { syncStudentName } from "./data/nameSync";
export {
  REWARD_MAX, subscribeClassMembers, subscribeClassRewards,
  subscribeMyClassRewardCount, setStudentReward, addStudentReward,
  subscribeStudentRewardEvents, subscribeStudentRewardEventsForClasses,
  subscribeTodayRewardEvents,
  subscribeFruitBasket, subscribeFruitEvents, enterFruitEvent,
  declineFruitEvent, cancelFruitEventChoice, receiveFruitEvent, cancelFruitEvent,
} from "./data/rewards";
export {
  sendClassNotice, subscribeClassNotices,
} from "./data/notifications";
export {
  markStudyAttendance, setStudyAttendanceByTeacher, subscribeMyStudyAttendance, subscribeClassStudyAttendance,
  subscribeClassAttendanceOn, subscribeMyAttendanceOn,
  dailySeatLayoutId, saveStudySeatLayout, subscribeStudySeatLayout,
  saveStudyGroupAssignment, subscribeStudyGroupAssignment,
} from "./data/attendance";
export {
  subscribeStudentNotes, addStudentNote, updateStudentNote,
  deleteStudentNote,
} from "./data/studentNotes";
export { saveKwlsActivityEntry, subscribeActivityKwl } from "./data/kwl";
export {
  subscribeUserDirectory, updateMyProfile,
  updateStudentProfile, assignUserRole, approveTeacherRequest, dismissTeacherRequest,
  becomeTeacherWithCode,
} from "./data/users";
export {
  subscribeBroadcast, startBroadcast, stopBroadcast, setBroadcastScroll, castScrollKey,
} from "./data/lessons";
export {
  sendPopQuiz, closePopQuiz, deletePopQuiz, subscribeOpenPopQuiz, subscribePopQuizzes, fetchPopQuizzes,
  subscribePopQuizAnswers, subscribeMyPopQuizAnswer, fetchMyPopQuizAnswer,
  submitPopQuizAnswer, returnPopQuizAnswer, rewardPopQuizAnswer, completePopQuizAnswer,
} from "./data/popQuiz";
export {
  subscribeQuestionSignals, subscribeMyQuestionSignal, setQuestionSignal,
  confirmQuestionSignal, dismissQuestionSignal,
  subscribeSignalThreads, subscribeMySignalThread, fetchSignalHistory, sendSignalMessage, markSignalSeen,
} from "./data/signals";
export {
  BOOK_GROUP_MODES, BOOK_ACTIVITY_TYPES, BOOK_SOLO_TYPES, BOOK_GROUPABLE_TYPES, BOOK_SHARED_TYPES,
  subscribeOpinionNotes, addOpinionNote, updateOpinionNote, moveOpinionNote, deleteOpinionNote, setOpinionReply,
  subscribeMyOpinionReplies, markOpinionReplySeen,
  subscribeMyHashtagPost, subscribeHashtagPosts, saveHashtagPost, markHashtagCommentsSeen,
  subscribeHashtagComments, addHashtagComment, deleteHashtagComment, setHashtagPublished,
  BOOK_STUDENT_TOPIC_TYPES, subscribeBookActivities, addBookActivity, renameBookActivity,
  updateBookActivity, deleteBookActivity, restoreBookActivity, purgeBookActivity,
  subscribeBookGroups, fetchBookGroupCount, composeBookGroups, addSoloBookBoards, joinBookGroup, leaveBookGroup,
  setBookGroupTopic, subscribeGroupWords, addConsonantWord, deleteConsonantWord,
  subscribeParatextEntries, fetchBookActivity,
  subscribeMyParatextEntry, saveParatextTopic, saveParatextEntry, peerReviewId,
  saveParatextEntryGroup, subscribeMateEntry,
  subscribeMyPeerReviews, subscribeReceivedPeerReviews, subscribeAllPeerReviews, subscribeGroupPeerReviews,
  savePeerReview, deletePeerReview, setPeerReviewLocked,
  fetchActivityWords, subscribeXwHints, subscribeXwBoard, createGroupCrossword,
  clearGroupCrossword, setXwHintWriter, saveXwHint, writeXwBoard, subscribeXwSolves, recordXwSolve,
  subscribeXwProgress, saveXwProgress, subscribeBwNotes, saveBwNote,
  subscribeBingoBoards, writeBingoCells, updateBingoState, refreshBingoWords, callBingoTurn,
  subscribeRaftFeedback, addRaftFeedback, updateRaftFeedback, deleteRaftFeedback,
  markRaftFeedbackSeen, subscribeMyNewRaftFeedback,
} from "./data/books";
export {
  subscribeClassChat, subscribeRoomsChat, sendChatMessage, deleteChatMessage,
  subscribeChatReads, markChatRoomSeen, subscribeRoomReads, markRoomRead,
} from "./data/messenger";
