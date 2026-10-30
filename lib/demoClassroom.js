// Fictional identities shared by the book activity and personal library demos.
// These are fixtures, never accounts to create in Firebase Authentication.
export const DEMO_CLASS_ID = "bookbom_demo_class";
export const DEMO_CLASS_NAME = "책봄 체험반 (15명)";
export const DEMO_TEACHER_UID = "bookbom_demo_teacher";

const names = ["김민준", "이서연", "박지후", "최하린", "정도윤", "강지우", "윤서준", "한수아", "오시우", "임예린", "장하준", "신채원", "조유진", "배건우", "송다은"];
const emojis = ["🌱", "🌷", "🌿", "🌼", "🍀", "🌻", "🌳", "🪴", "🌸", "🌾", "🌺", "🍃", "🌹", "🌲", "💐"];
export const DEMO_STUDENTS = Object.freeze(names.map((name, index) => Object.freeze({
  uid: `bookbom_demo_student_${String(index + 1).padStart(2, "0")}`,
  role: "student", realName: name, displayName: name, name,
  studentId: String(30101 + index), emoji: emojis[index],
  classIds: Object.freeze([DEMO_CLASS_ID]),
})));

export const DEMO_ACTIVITY_IDS = Object.freeze(Object.fromEntries([
  "consonant", "paratext", "raft", "kwls", "mindmap", "opinion", "hashtag", "qmark", "crossword", "brainwrite",
].map((type) => [type, `bookbom_demo_${type}`])));

export function getDemoStudent(uid) {
  return DEMO_STUDENTS.find((student) => student.uid === uid) ?? null;
}

export function createDemoClassroom(now = new Date()) {
  const createdAt = new Date(new Date(now).getTime() - 28 * 86400000);
  const groups = ["새싹 모둠", "바람 모둠", "햇살 모둠"].map((name, index) => {
    const members = DEMO_STUDENTS.slice(index * 5, index * 5 + 5).map((student) => ({
      uid: student.uid, name: student.realName, studentId: student.studentId, emoji: student.emoji,
    }));
    return { id: `bookbom_demo_group_${index + 1}`, index: index + 1, name,
      color: ["#72a98f", "#d49b73", "#b298c6"][index], memberUids: members.map((m) => m.uid), members };
  });
  const attendanceRecords = [];
  for (const back of [0, 2, 4, 7, 9, 11, 14, 16, 18, 21]) {
    const at = new Date(new Date(now).getTime() - back * 86400000);
    const date = new Date(at.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    DEMO_STUDENTS.forEach((student, index) => {
      if ((index + back) % 11 === 3) return;
      attendanceRecords.push({ id: `${date}_${student.uid}`, classId: DEMO_CLASS_ID,
        uid: student.uid, date, name: student.realName, studentId: student.studentId,
        emoji: student.emoji, attendedAt: new Date(at), createdAt: new Date(at) });
    });
  }
  const rewards = DEMO_STUDENTS.map((student, index) => ({
    id: `${DEMO_CLASS_ID}_${student.uid}`, classId: DEMO_CLASS_ID, uid: student.uid,
    count: 3 + index % 9, name: student.realName, emoji: student.emoji,
  }));
  return {
    classDoc: {
      id: DEMO_CLASS_ID, name: DEMO_CLASS_NAME, createdBy: DEMO_TEACHER_UID,
      createdAt, order: -1, joinCode: "BOOK15", readingEnabled: true, archived: false,
    },
    students: DEMO_STUDENTS.map((student) => ({ ...student, classIds: [...student.classIds] })),
    memberships: DEMO_STUDENTS.map((student) => ({
      id: `${student.uid}_${DEMO_CLASS_ID}`, uid: student.uid, classId: DEMO_CLASS_ID, joinedAt: new Date(createdAt),
    })),
    seatLayouts: [{ id: "default", layoutId: "default", classId: DEMO_CLASS_ID,
      seats: DEMO_STUDENTS.map((student) => student.uid), updatedBy: DEMO_TEACHER_UID, updatedAt: new Date(now) }],
    groupAssignments: [{ id: "default", classId: DEMO_CLASS_ID, groups,
      updatedBy: DEMO_TEACHER_UID, updatedAt: new Date(now) }],
    attendanceRecords, rewards,
    rewardEvents: rewards.map((reward, index) => ({
      id: `bookbom_demo_reward_${index + 1}`, classId: DEMO_CLASS_ID, uid: reward.uid,
      delta: reward.count, count: reward.count, byUid: DEMO_TEACHER_UID, at: new Date(now),
    })),
  };
}
