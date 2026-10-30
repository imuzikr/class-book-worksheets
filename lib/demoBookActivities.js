// Fictional reading work for inspecting the existing ten book activity screens.
// No Firebase, authentication, storage or network calls belong in this fixture.
import { DEMO_ACTIVITY_IDS, DEMO_CLASS_ID, DEMO_STUDENTS, DEMO_TEACHER_UID } from "./demoClassroom";
import { emptyParatextAnswers } from "./paratext";
import { emptyRaftAnswers } from "./raft";
import { emptyKwlsAnswers } from "./kwls";
import { emptyQmarkAnswers } from "./qmark";
import { emptyHashtagPost } from "./hashtag";
import { cellIndexOfWord } from "./consonants";
import { bwNoteId, columnOrder } from "./brainwrite";
import { buildGroupCrossword, entryCellKeys, fixedLettersOf, groupSolveProgress, soloBoardSummary } from "./crossword";

export const DEMO_ACTIVITY_BOOK = "바람을 모으는 도서관";
export const DEMO_ACTIVITY_AUTHOR = "책봄 창작팀";
const DAY_MS = 86400000;

// Each student has a different interpretation, rather than fifteen copies of a
// placeholder sentence. All text describes an invented book and is original.
const perspectives = [
  ["경청", "조용한 친구의 말을 끝까지 기다려 주는 장면", "말수가 적으면 생각도 적다고 여겼던 내 판단", "도서관에 말 대신 그림으로 의견을 남기는 칸을 만들고 싶다"],
  ["용기", "새로 전학 온 아이가 자기 이름을 소개하는 장면", "용기는 두려움이 없는 상태라는 생각", "발표가 어려운 친구에게 먼저 짧은 질문을 건네고 싶다"],
  ["공감", "같은 사건을 서로 다른 일기로 읽게 되는 장면", "내가 본 장면만으로 상대의 마음을 안다고 믿었던 태도", "친구의 이야기를 들은 뒤 내가 이해한 뜻이 맞는지 확인하고 싶다"],
  ["선택", "빌려 온 책을 친구에게 먼저 건네는 장면", "좋은 선택에는 언제나 하나의 정답이 있다는 생각", "결정을 내리기 전에 내가 지키고 싶은 가치를 적어 보고 싶다"],
  ["배려", "높은 책장 아래에 작은 발판을 놓는 장면", "도움을 주는 사람이 방법까지 모두 정해야 한다는 생각", "도움이 필요한 사람에게 어떤 방식이 편한지 먼저 물어보고 싶다"],
  ["관계", "다툰 두 아이가 함께 찢어진 지도를 고치는 장면", "사과 한마디면 관계가 바로 원래대로 돌아온다는 기대", "함께 할 수 있는 작은 일을 찾아 관계를 다시 시작하고 싶다"],
  ["기억", "책갈피 뒤에 남아 있던 오래된 약속을 발견하는 장면", "기억은 언제나 사실과 똑같이 남는다는 생각", "같은 추억을 친구와 서로 다른 말로 적어 비교해 보고 싶다"],
  ["변화", "규칙을 지키던 아이가 새로운 규칙을 제안하는 장면", "규칙은 한 번 정하면 바꾸면 안 된다는 생각", "모두에게 불편한 규칙이 있는지 학급 회의에서 살펴보고 싶다"],
  ["공동체", "비가 새는 도서관을 마을 사람들이 함께 고치는 장면", "많은 사람이 모이면 저절로 협력이 된다는 기대", "작업을 나누기 전에 각자 잘할 수 있는 일을 먼저 묻고 싶다"],
  ["질문", "주인공이 정답 대신 새로운 물음을 책갈피에 쓰는 장면", "읽기는 답을 찾으면 끝난다는 생각", "책을 덮은 뒤에도 남는 질문 하나를 친구와 나누고 싶다"],
  ["다양성", "각자 다른 끝맺음을 붙여 한 이야기를 완성하는 장면", "서로 다른 의견은 꼭 하나로 합쳐야 한다는 생각", "모둠 글에 다른 의견을 지우지 않고 나란히 남기고 싶다"],
  ["책임", "실수로 젖게 한 책을 주인공이 직접 수선하는 장면", "실수를 숨기면 문제가 작아질 수 있다는 생각", "내가 한 일을 설명하고 해결에 필요한 도움을 요청하고 싶다"],
  ["희망", "텅 빈 책장에 첫 번째 책을 올리는 장면", "결과가 확실할 때만 시작해야 한다는 생각", "작은 변화라도 오늘 시작할 수 있는 행동부터 정하고 싶다"],
  ["상상", "바람에 실린 이야기로 새로운 지도를 그리는 장면", "상상은 현실의 문제를 해결하는 데 도움이 안 된다는 생각", "우리 학교의 빈 공간을 어떻게 바꿀지 그림으로 제안하고 싶다"],
  ["연결", "서로 모르는 사람들의 책갈피가 한 줄로 이어지는 장면", "책 읽기는 혼자 하는 활동이라는 생각", "내가 좋아한 책을 다음 독자에게 소개하는 쪽지를 남기고 싶다"],
];

// A connected word pool supports a real, reproducible crossword, including
// clues that do not reveal the answer. Some initial-consonant cells remain open.
const wordClues = [
  ["도서관", "책을 빌리고 서로의 이야기를 나누는 이 이야기의 중심 공간"],
  ["독서", "글을 읽으며 자신의 경험과 생각을 연결하는 활동"],
  ["독서모임", "같은 책을 읽은 사람들이 생각을 나누려고 만나는 자리"],
  ["모임", "여러 사람이 한 가지 일을 위해 함께 만나는 자리"],
  ["마음", "겉으로 바로 보이지 않지만 말과 행동에 담기는 생각과 느낌"],
  ["마음나누기", "친구가 느끼는 것을 듣고 자신의 느낌도 솔직하게 전하는 일"],
  ["나누기", "혼자 가진 것을 다른 사람과 함께 쓰거나 전하는 행동"],
  ["나눔", "내가 가진 것을 조금 내어 다른 사람과 함께하는 일"],
  ["이야기", "사건과 인물의 경험을 말이나 글로 엮어 전한 것"],
  ["이야기꽃", "여럿이 즐겁게 말을 주고받는 모습을 꽃에 빗댄 말"],
  ["꽃잎", "봄날 도서관 창가에서 바람을 타고 내려오는 꽃의 조각"],
  ["책방", "책을 고르고 만날 수 있는 작은 가게"],
  ["책봄", "이 독서 활동을 담은 앱의 이름"],
  ["봄바람", "추위가 누그러진 계절에 불어오는 따뜻한 공기의 움직임"],
  ["바람", "책갈피를 넘기며 보이지 않는 이야기를 이어 주는 자연의 움직임"],
  ["바람길", "공기가 막히지 않고 지나갈 수 있게 이어진 자리"],
  ["길목", "여러 방향으로 가는 길이 만나거나 갈라지는 자리"],
  ["목소리", "사람이 말을 할 때 내는 소리, 작품에서는 각자의 의견을 뜻하기도 함"],
  ["소리", "귀로 들을 수 있는 공기의 떨림"],
  ["다리", "떨어진 두 곳을 건너갈 수 있도록 이어 주는 구조물"],
  ["다정함", "상대를 따뜻하게 대하고 작은 마음까지 헤아리는 태도"],
  ["친구", "즐거움과 고민을 함께 나누는 가까운 사람"],
  ["친구사이", "서로를 알고 가까이 지내는 두 사람의 관계"],
  ["사이", "둘이 맺고 있는 관계 또는 떨어져 있는 틈"],
  ["연결", "서로 떨어져 있던 것들이 하나의 흐름으로 이어지는 일"],
  ["경청", "상대의 말을 끊지 않고 뜻을 이해하며 듣는 태도"],
  ["공감", "상대의 처지에서 그 감정을 이해하려고 하는 마음"],
  ["배려", "상대에게 필요한 것이 무엇인지 생각하며 행동하는 태도"],
  ["선택", "여러 가능성 가운데 자신이 할 일을 고르는 것"],
  ["약속", "앞으로 어떤 일을 하겠다고 서로 정해 두는 말"],
  ["희망", "앞으로 더 나아질 수 있다고 기대하며 품는 마음"],
  ["함께", "혼자 떨어져 있지 않고 여럿이 같은 일을 하는 모습을 뜻하는 말"],
  ["리듬", "같이 낭독할 때 말의 빠르기와 멈춤이 만드는 흐름"],
  ["커튼", "책에 햇빛이 너무 세게 들지 않도록 창가에 드리운 천"],
  ["터전", "사람들이 머물며 삶과 관계를 가꾸는 바탕이 되는 곳"],
  ["평화", "다름을 없애지 않고도 서로를 해치지 않으며 지내는 상태"],
  ["이야기책", "인물과 사건이 이어지는 글을 모아 엮은 읽을거리"],
  ["책갈피", "읽던 곳을 표시하려고 종이 사이에 끼우는 작은 물건"],
  ["책장", "읽을거리를 가지런히 세워 두는 가구"],
  ["책상", "읽거나 글을 쓸 때 앞에 놓고 사용하는 가구"],
  ["학교", "친구들과 함께 배우고 생활하는 곳"],
  ["학교도서관", "학생들이 수업과 쉬는 시간에 책을 만나는 교내 공간"],
  ["교실", "한 반의 학생들이 모여 수업하는 방"],
  ["교실문", "학생들이 배우는 방을 드나들 때 여닫는 것"],
  ["문장", "생각을 완결된 말로 나타낸 글의 단위"],
  ["질문", "모르거나 더 알고 싶은 것을 상대에게 묻는 말"],
  ["대답", "다른 사람이 물은 내용에 대해 해 주는 말"],
  ["답장", "먼저 받은 편지에 자신의 생각을 적어 보내는 글"],
  ["그림책", "글과 시각 자료가 함께 이야기를 전하는 읽을거리"],
  ["그림자", "햇빛을 가린 물체 뒤쪽에 생기는 어두운 모양"],
  ["자유", "자신의 생각과 행동을 스스로 선택할 수 있는 상태"],
  ["유리창", "방 안으로 햇빛이 들어오게 하는 투명한 창"],
  ["창문", "빛과 공기가 드나들도록 벽에 낸 구멍에 달아 놓은 것"],
  ["문학", "사람의 삶과 감정을 언어로 표현하는 예술"],
  ["문학작품", "시나 소설처럼 언어로 사람의 삶과 감정을 표현한 결과물"],
  ["작품", "작가가 생각과 표현을 담아 완성한 창작물"],
  ["작가", "자신의 생각과 상상을 글로 쓰는 사람"],
  ["학급", "같은 담임 선생님과 함께 생활하는 학생들의 단위"],
];

const groupNames = ["새싹 모둠", "바람 모둠", "햇살 모둠"];
const labels = {
  consonant: "책 속 낱말을 함께 모아요", paratext: "표지에서 시작하는 이야기",
  raft: "책 속 인물이 보내는 편지", kwls: "읽기 전과 후의 나의 생각",
  mindmap: "관계의 지도를 그려요", opinion: "다른 의견과 함께 살아가기",
  hashtag: "여섯 낱말로 남기는 독서", qmark: "책을 덮어도 남는 물음",
  crossword: "우리가 만든 독서 낱말 퀴즈", brainwrite: "친구의 생각에 한 줄 더하기",
};

function dayKey(date) {
  return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

function createGroups(activityId, createdAt) {
  return groupNames.map((name, index) => {
    const members = DEMO_STUDENTS.slice(index * 5, index * 5 + 5).map((s) => ({ uid: s.uid, name: s.realName, studentId: s.studentId, emoji: s.emoji }));
    return { id: `group_${index + 1}`, activityId, groupIndex: index + 1, groupName: name,
      groupSetName: `${DEMO_ACTIVITY_BOOK} 활동 모둠`, members,
      memberUids: members.map((s) => s.uid), leaderUid: members[0].uid, retired: false, createdAt: new Date(createdAt) };
  });
}

function paratextAnswers(index) {
  const [word, scene, bias, action] = perspectives[index];
  const full = {
    covers: `작은 창문과 바람에 흔들리는 책갈피가 보인다. 닫혀 있던 공간이 사람들의 이야기로 열리는 내용을 예상했다. ${scene}과도 연결될 것 같다.`,
    author: `이 체험을 위해 만든 가상 저자는 '${DEMO_ACTIVITY_AUTHOR}'이다. 서로 다른 독자가 책을 통해 만나는 이야기를 썼다고 설정했다.`,
    titleMain: DEMO_ACTIVITY_BOOK, titleSub: "", titleKnown: `눈에 보이지 않는 바람을 모은다는 표현이 '${word}'에 관한 사람들의 생각을 모으는 일처럼 느껴진다.`,
    predictClaim: `나는 이 책이 '${word}'에 관한 경험을 통해 마을의 관계가 달라지는 이야기라고 예측한다.`,
    predictReason: "표지의 책갈피들이 서로 다른 방향에서 하나의 책장으로 모이기 때문이다.",
    audience: "함께 읽은 친구는 다투던 사람들이 한 번에 화해하지 않고 천천히 가까워지는 점이 좋았다고 했다.",
    chapterTitle: `${word}: 마음을 담은 책갈피`, chapterReason: `${scene}이 왜 중요한지 더 알고 싶어서 골랐다.`,
    chapterGuess: "주인공이 상대의 처지를 새롭게 알아차리고 작은 행동을 바꾸는 내용일 것 같다.",
    scope: "작은 도서관을 함께 지키는 사람들의 관계와 선택을 다루는 이야기다.",
    purpose: "다른 생각을 가진 사람들도 서로의 이야기를 들으며 함께 살아갈 수 있음을 보여 주려는 것 같다.",
    reference: "가상 소설의 체험 자료이므로 실제 참고문헌 목록은 없다. 책을 읽을 때는 작품과 배경 설명의 출처를 구분해서 확인하고 싶다.",
    visuals: `서로 다른 길이 도서관으로 이어지는 지도가 인상적이다. 읽기 전 생각: '${bias}'. 이 생각을 돌아보면서 ${action}.`,
  };
  const keys = Object.keys(full);
  const count = index < 9 ? keys.length : index < 13 ? 8 : 3;
  return { ...emptyParatextAnswers(), ...Object.fromEntries(keys.slice(0, count).map((key) => [key, full[key]])) };
}

function raftAnswers(index) {
  const [word, scene, , action] = perspectives[index];
  const answers = { ...emptyRaftAnswers(), role: index % 2 ? "도서관의 오래된 책갈피" : "마을 도서관을 지키는 아이", audience: "아직 도서관에 오지 않은 친구", format: index % 3 ? "편지" : "일기", topic: `${word}에서 시작하는 우리 마을의 변화` };
  if (index < 11) answers.writing = `친구에게. 오늘 나는 ${scene}을 보았어. 처음에는 그 행동이 너무 작아서 아무것도 바뀌지 않을 줄 알았어. 그런데 한 사람이 마음을 열자 다른 사람도 자기 이야기를 꺼내기 시작했어. 내가 고른 낱말: '${word}'. 책 속 문제는 한 사람이 모두 해결하지 않았고, 서로의 속도를 기다렸다는 점이 좋았어. 나도 ${action}. 네가 생각하는 좋은 도서관은 어떤 곳인지 들려줄래? 다음에 함께 책을 고르자. 보낸 사람: ${DEMO_STUDENTS[index].realName}.`;
  else if (index < 14) answers.writing = `나는 ${scene}을 다른 인물의 눈으로 다시 써 보려고 한다. 그 인물이 왜 망설였는지부터 생각해 보았다.`;
  else { answers.format = ""; answers.topic = ""; }
  return answers;
}

function kwlsAnswers(index) {
  const [word, scene, bias, action] = perspectives[index];
  return { ...emptyKwlsAnswers(), know: `나는 좋은 관계를 만드는 데 필요한 '${word}'의 중요성에 관해 알고 있었다.`,
    want: `${scene}에서 주인공은 왜 바로 답을 정하지 않고 기다렸을까?`,
    learned: index < 13 ? `읽기 전 나는 '${bias}'에 익숙했다. 그러나 ${scene}을 보며 다른 사람의 입장을 묻는 과정 자체가 변화를 만들 수 있음을 알았다.` : "",
    still: index < 9 ? `${action}. 그런 작은 실천이 오래 이어지려면 우리 반에서 어떤 약속이 필요할까?` : "" };
}

function mindmapAnswers(index) {
  const [word, scene, bias, action] = perspectives[index];
  const nodes = [
    { id: "root", parentId: null, text: DEMO_ACTIVITY_BOOK, x: 0, y: 0 },
    { id: "scene", parentId: "root", text: scene, edgeLabel: "인상 깊은 장면", x: 260, y: -120 },
    { id: "theme", parentId: "root", text: word, edgeLabel: "핵심 낱말", x: -260, y: -120 },
    { id: "before", parentId: "theme", text: bias, edgeLabel: "읽기 전 생각", x: -440, y: 80 },
    { id: "after", parentId: "theme", text: "다름을 판단하기 전에 이유를 듣기", edgeLabel: "읽은 뒤 변화", x: -180, y: 190 },
    { id: "action", parentId: "scene", text: action, edgeLabel: "생활 속 실천", x: 330, y: 160 },
  ];
  return { layout: index % 2 ? "tree" : "radial", nodes: nodes.slice(0, index < 10 ? 6 : index < 14 ? 4 : 2) };
}

function qmarkAnswers(index) {
  const [word, scene, bias, action] = perspectives[index];
  const answers = emptyQmarkAnswers();
  answers.asks[0] = { question: `${scene}에서 다른 선택을 했다면 관계는 어떻게 달라졌을까?`, reason: index < 14 ? `핵심 낱말 '${word}'의 뜻을 행동의 결과와 연결해 보고 싶기 때문이다.` : "" };
  if (index < 11) {
    answers.asks[1] = { question: "같은 사건을 다른 인물의 시점으로 읽으면 누구의 마음이 더 잘 보일까?", reason: `읽기 전 생각인 '${bias}'에 관해 다시 살펴보고 싶기 때문이다.` };
    answers.asks[2] = { question: "우리 학교에 이런 도서관이 생긴다면 첫 번째로 어떤 약속을 만들까?", reason: "책 속 이야기를 내 생활에 연결하고 싶기 때문이다." };
    answers.picks = ["bias", "change", "use"];
    answers.thought = `읽기 전 나는 '${bias}'에 익숙했다. ${scene}은 내 생각을 멈추고 상대의 이유를 묻게 했다. 이제는 '${word}'의 뜻을 말로만 설명하기보다 행동으로 보여 주는 것이 중요하다고 생각한다. 나도 ${action}. 다만 내가 생각한 도움이 상대에게도 편한 방식인지 먼저 확인해야 한다.`;
  } else if (index < 14) answers.picks = ["interest"];
  return answers;
}

function makeCrossword(data, at) {
  // Stable pseudo-random ordering is used only to lay out the puzzle. Fixture
  // identities, progress and text do not vary between refreshes.
  let seed = 20261030;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const groups = data.bookGroups.filter((g) => g.activityId === DEMO_ACTIVITY_IDS.crossword);
  const sourceWords = [...new Set(data.bookWords.map((w) => w.text))];
  const built = buildGroupCrossword(sourceWords, groups.map((g) => ({ id: g.id, size: g.members.length })), { salt: "bookbom-demo-classroom-v1", rng, attempts: 80 });
  if (!built) throw new Error("체험용 낱말 퀴즈를 만들 수 없습니다.");
  const clueOf = new Map(wordClues);
  // The real teacher screen publishes each group's hint into entries.clue
  // when switching to solve. Students read that public field for other groups.
  const clueByIdx = new Map(built.hints.map((hint) => [hint.idx, clueOf.get(hint.word)]));
  const puzzle = { ...built.puzzle, stage: "solve", createdAt: at(5),
    entries: built.puzzle.entries.map((entry, index) => ({ ...entry, clue: clueByIdx.get(index) ?? "" })) };
  data.bookActivities.find((a) => a.type === "crossword").crossword = puzzle;
  for (const group of groups) {
    const own = built.hints.filter((hint) => hint.groupId === group.id);
    own.forEach((hint, index) => {
      const writer = group.members[index % group.members.length];
      data.bookXwHints.push({ id: String(hint.idx), activityId: DEMO_ACTIVITY_IDS.crossword, ...hint,
        writerUid: writer.uid, writerName: writer.name, hint: clueOf.get(hint.word), updatedAt: at(4, index) });
    });
    const letters = {};
    const others = built.hints.filter((hint) => hint.groupId !== group.id);
    const count = group.groupIndex === 1 ? others.length : group.groupIndex === 2 ? 4 : 2;
    others.slice(0, count).forEach((hint) => entryCellKeys(puzzle.entries[hint.idx]).forEach((key, index) => { letters[key] = hint.word[index]; }));
    data.bookXwBoards.push({ id: "main", activityId: DEMO_ACTIVITY_IDS.crossword, groupId: group.id, cells: letters, updatedAt: at(1) });
    const fixed = fixedLettersOf(puzzle, built.hints.filter((hint) => hint.groupId === group.id));
    const progress = groupSolveProgress(puzzle, group.id, letters, fixed);
    [...progress.solved].forEach((idx, index) => {
      const solver = group.members[index % group.members.length];
      data.bookXwSolves.push({ id: String(idx), activityId: DEMO_ACTIVITY_IDS.crossword, groupId: group.id, idx, uid: solver.uid, name: solver.name, at: at(1, index) });
    });
    data.bookXwProgress.push({ id: group.id, activityId: DEMO_ACTIVITY_IDS.crossword, groupId: group.id, uid: group.members[0].uid,
      ...soloBoardSummary(puzzle, group.id, letters, fixed, data.bookXwHints.filter((hint) => hint.groupId === group.id)), updatedAt: at(1) });
  }
}

export function createDemoBookActivities(now = new Date()) {
  const clock = new Date(now);
  if (!Number.isFinite(clock.getTime())) throw new Error("체험 데이터의 기준 날짜를 확인해 주세요.");
  // Subtract minutes for ordering instead of adding hours that could run into a
  // future date when the fixture is opened shortly before midnight.
  const at = (back, order = 0) => new Date(clock.getTime() - back * DAY_MS - (40 - order) * 60000);
  const data = Object.fromEntries(["bookActivities", "bookGroups", "bookWords", "bookEntries", "bookPeerReviews", "bookOpinionNotes", "bookHashtagPosts", "bookHashtagComments", "bookXwHints", "bookXwBoards", "bookXwSolves", "bookXwProgress", "bookBwNotes", "kwl"].map((key) => [key, []]));
  Object.entries(DEMO_ACTIVITY_IDS).forEach(([type, id], index) => {
    const grouped = ["consonant", "paratext", "raft", "crossword", "brainwrite"].includes(type);
    const activity = { id, classId: DEMO_CLASS_ID, type, title: labels[type], topic: DEMO_ACTIVITY_BOOK,
      bookUrl: "", groupMode: grouped ? "teacher" : "solo", maxPerGroup: 5,
      groupSetName: `${DEMO_ACTIVITY_BOOK} 활동 모둠`, locked: false, createdBy: DEMO_TEACHER_UID, createdAt: at(25 - index * 2), demoFixture: true };
    if (["paratext", "raft", "brainwrite"].includes(type)) activity.grouped = true;
    if (type === "raft") activity.peerReviewLocked = false;
    if (type === "brainwrite") { activity.questionMode = "student"; activity.prompt = ""; }
    if (type === "opinion") Object.assign(activity, { zones: [{ key: "z1", name: "공감하는 생각" }, { key: "z2", name: "다르게 본 생각" }, { key: "z3", name: "더 궁금한 생각" }],
      prompt: "좋은 공동체를 만들려면 같은 생각을 해야 할까요?", noteMode: "single", layout: "memo", nameMode: "real" });
    if (type === "hashtag") Object.assign(activity, { published: true, guide: "직접 고른 여섯 낱말로 책에서 발견한 생각을 설명하고, 친구의 해석에 질문을 남겨 보세요." });
    if (type === "crossword") Object.assign(activity, { sourceActivityId: DEMO_ACTIVITY_IDS.consonant, sourceTitle: labels.consonant });
    data.bookActivities.push(activity);
    if (grouped) data.bookGroups.push(...createGroups(id, activity.createdAt));
  });

  const consonantGroups = data.bookGroups.filter((g) => g.activityId === DEMO_ACTIVITY_IDS.consonant);
  consonantGroups.forEach((group, groupIndex) => {
    const selected = wordClues.filter(([word]) => cellIndexOfWord(word) >= 0).slice(0, wordClues.length - groupIndex * 6);
    selected.forEach(([text], index) => {
      const writer = group.members[index % 5];
      data.bookWords.push({ id: `demo_word_${group.id}_${index}`, activityId: group.activityId, groupId: group.id,
        cellKey: `c${cellIndexOfWord(text)}`, text, authorId: writer.uid, authorName: writer.name, createdAt: at(22, index) });
    });
  });

  DEMO_STUDENTS.forEach((student, index) => {
    const [word, scene, bias, action] = perspectives[index];
    const groupId = `group_${Math.floor(index / 5) + 1}`;
    const entryFor = { paratext: paratextAnswers(index), raft: raftAnswers(index), kwls: kwlsAnswers(index), mindmap: mindmapAnswers(index), qmark: qmarkAnswers(index) };
    Object.entries(entryFor).forEach(([type, answers]) => {
      const entry = { id: student.uid, activityId: DEMO_ACTIVITY_IDS[type], authorId: student.uid,
        authorName: student.realName, answers, topic: DEMO_ACTIVITY_BOOK, updatedAt: at(1 + index % 6, index) };
      if (["paratext", "raft"].includes(type)) entry.groupId = groupId;
      data.bookEntries.push(entry);
      if (type === "kwls") data.kwl.push({ id: `${student.uid}_${DEMO_CLASS_ID}_act_${entry.activityId}`, classId: DEMO_CLASS_ID,
        userId: student.uid, activityId: entry.activityId, activityTitle: labels.kwls, topic: DEMO_ACTIVITY_BOOK, answers: { ...answers },
        K: answers.know, W: answers.want, L: answers.learned, S: answers.still,
        date: dayKey(at(2 + index % 18)), authorName: student.realName, authorEmoji: student.emoji,
        createdAt: at(2 + index % 18), updatedAt: entry.updatedAt });
    });

    const recipient = DEMO_STUDENTS[Math.floor(index / 5) * 5 + ((index + 1) % 5)];
    data.bookPeerReviews.push({ id: `${recipient.uid}_${student.uid}`, activityId: DEMO_ACTIVITY_IDS.raft,
      groupId, fromUid: student.uid, fromName: student.realName, toUid: recipient.uid, toName: recipient.realName,
      html: `<p>${recipient.realName}의 편지에서 인물의 망설임을 설명한 부분이 좋았어. 내 글에서는 '${word}'에 초점을 맞췄는데, 다른 인물의 관점과도 연결할 수 있을 것 같아.</p><p>마지막 문단에 상대가 어떤 답장을 보낼지도 한 줄 덧붙이면 이야기가 더 살아날 것 같아.</p>`, updatedAt: at(1, index) });

    const zone = `z${index % 3 + 1}`;
    const note = { id: `${student.uid}_${zone}`, activityId: DEMO_ACTIVITY_IDS.opinion,
      authorId: student.uid, authorName: student.realName, studentId: student.studentId, authorEmoji: null,
      anon: false, real: true, byTeacher: false, zone, color: ["butter", "mint", "sky"][index % 3],
      x: index % 2 * 0.52, y: Math.floor(index / 3) * 0.19,
      text: `나는 '${word}'의 중요성을 생각했다. ${scene}을 보면 서로 다른 생각을 먼저 들을 때 함께할 방법이 생긴다. 나도 ${action}.`,
      createdAt: at(4, index), updatedAt: at(2, index), movedAt: at(2, index) };
    if (index % 3 === 0) Object.assign(note, { reply: `${student.realName}, 책 속 장면과 실천을 연결한 점이 좋네요. '${word}'의 의미가 서로 다른 선택을 존중하는 데 어떻게 도움이 되는지 친구의 생각과도 비교해 보세요.`, replyBy: DEMO_TEACHER_UID, replyAt: at(1, index) });
    if (index % 6 === 0) note.replySeenAt = at(0, index);
    data.bookOpinionNotes.push(note);

    const post = emptyHashtagPost();
    post.source = { kind: "book", title: DEMO_ACTIVITY_BOOK, author: DEMO_ACTIVITY_AUTHOR, date: "2026", url: "" };
    const tags = [word, "책갈피", "도서관", "다른시선", "작은실천", "함께읽기"];
    const insights = [`${scene}을 통해 '${word}'의 뜻은 상대의 처지를 묻는 것에서 시작됨을 느꼈다.`, "책갈피는 읽기를 멈추는 표시이면서 다음 만남을 약속하는 물건으로 보였다.", "도서관은 책을 두는 건물에서 서로의 말을 듣는 공간으로 바뀌었다.", `읽기 전 생각인 '${bias}'에 관해 다른 인물의 입장에서 다시 생각했다.`, `독서 후 나는 ${action}.`, "친구들이 고른 낱말을 함께 읽으니 혼자 발견하지 못한 장면이 보였다."];
    const count = index < 10 ? 6 : index < 13 ? 4 : 2;
    post.tags = tags.map((tag, atIndex) => ({ tag: atIndex < count ? tag : "", insight: atIndex < count ? insights[atIndex] : "", quote: "" }));
    data.bookHashtagPosts.push({ id: student.uid, activityId: DEMO_ACTIVITY_IDS.hashtag, authorId: student.uid,
      authorName: student.realName, studentId: student.studentId, ...post, createdAt: at(6, index), updatedAt: at(2, index) });
    data.bookHashtagComments.push({ id: `demo_comment_${index}`, activityId: DEMO_ACTIVITY_IDS.hashtag,
      postUid: recipient.uid, authorId: student.uid, authorName: student.realName, studentId: student.studentId,
      byTeacher: false, kind: ["like", "ask", "suggest"][index % 3], text: [`장면과 낱말을 연결한 설명이 좋아. 나도 '${word}'에 주목하면서 이 장면을 다시 읽게 됐어.`, "주인공과 다른 선택을 한 인물의 입장에서도 이 해시태그가 어울릴지 궁금해.", "우리 반에서 해 볼 수 있는 행동을 한 가지 더 붙이면 생각이 더 구체적으로 전해질 것 같아."][index % 3], createdAt: at(1, index) });
    if (index % 4 === 0) data.bookHashtagComments.push({ id: `demo_teacher_comment_${index}`, activityId: DEMO_ACTIVITY_IDS.hashtag,
      postUid: student.uid, authorId: DEMO_TEACHER_UID, authorName: "선생님", studentId: null, byTeacher: true,
      kind: "suggest", text: `고른 낱말의 뜻을 잘 설명했어요. '${word}'의 의미를 보여 주는 행동을 책 속 장면에서 한 가지 더 찾아 연결해 보세요.`, createdAt: at(1, index + 16) });
  });

  const bwGroups = data.bookGroups.filter((g) => g.activityId === DEMO_ACTIVITY_IDS.brainwrite);
  bwGroups.forEach((group, groupIndex) => group.members.forEach((owner, ownerIndex) => {
    const count = groupIndex === 0 ? 5 : groupIndex === 1 ? 3 + ownerIndex % 3 : ownerIndex + 1;
    columnOrder(group.members, owner.uid).slice(0, count).forEach((writer, rowIndex) => {
      const writerIndex = DEMO_STUDENTS.findIndex((student) => student.uid === writer.uid);
      const [word, scene, , action] = perspectives[writerIndex];
      data.bookBwNotes.push({ id: bwNoteId(owner.uid, writer.uid), activityId: DEMO_ACTIVITY_IDS.brainwrite,
        groupId: group.id, ownerUid: owner.uid, writerUid: writer.uid, writerName: writer.name,
        text: rowIndex === 0 ? `${scene}처럼 친구의 생각이 나와 다를 때, 좋은 관계를 이어 가려면 어떻게 해야 할까?`
          : `앞 친구의 생각에 '${word}'의 의미도 더하고 싶어. 상대가 왜 그렇게 느꼈는지 먼저 물으면 작은 실천을 함께 정할 수 있어. 나는 ${action}.`,
        updatedAt: at(1, ownerIndex * 5 + rowIndex) });
    });
  }));
  makeCrossword(data, at);
  return data;
}
