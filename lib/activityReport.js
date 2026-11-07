// A class-scoped, read-only projection of a student's activity artifacts.
// Only explicit fields are returned; private profiles and reading state never
// belong in this report. Text keeps paragraphs and is rendered as text by React.
import { PARATEXT_SECTIONS } from "./paratext";
import { RAFT_COLUMNS } from "./raft";
import { KWLS_COLUMNS, kwlsAnswersFromEntry } from "./kwls";
import { normalizeQmarkAnswers, QMARK_PROMPTS } from "./qmark";
import { normalizeHashtagPost, safeImageUrl, sourceKindLabel } from "./hashtag";
import { normalizeMindmap } from "./mindmap";
import { columnOrder } from "./brainwrite";
import { CONSONANT_LABELS, cellKey } from "./consonants";
import { BINGO_CELLS, bingoProgress, normalizeBingo } from "./bingo";

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function activityReportText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|pre)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s[^>]*)?\s*\/?>/gi, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, raw) => {
      const n = raw[0].toLowerCase() === "x" ? parseInt(raw.slice(1), 16) : Number(raw);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : match;
    })
    .replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isoDate(raw) {
  const value = raw?.toDate ? raw.toDate() : raw && typeof raw.seconds === "number" ? raw.seconds * 1000 : raw;
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function grouped(activity) {
  return ["consonant", "crossword", "bingo"].includes(activity.type)
    ? activity.groupMode !== "solo"
    : activity.type === "brainwrite" || activity.grouped === true;
}

export function activityReport(activity, student, records = {}, memberIds = null) {
  const text = activityReportText;
  const uid = student?.uid;
  const rows = (key) => list(records[key]).filter((record) => record?.activityId === activity.id
    && (!record.classId || record.classId === activity.classId));
  const own = (record) => typeof uid === "string" && !!uid && (record.authorId || record.userId || record.id) === uid;
  const group = typeof uid === "string" && uid ? rows("bookGroups").find((item) => !item.retired &&
    (list(item.memberUids).includes(uid) || list(item.members).some((member) => member?.uid === uid))) : null;
  const entry = rows("bookEntries").find(own);
  const answers = object(entry?.answers);
  const sections = [];
  const dates = [entry?.updatedAt];
  const report = {
    topic: text(activity.topic || entry?.topic),
    grouped: grouped(activity),
    groupName: group ? text(group.groupName || group.name || `${group.groupIndex || ""}모둠`) : null,
    updatedAt: null,
    sections,
  };
  const section = (id, title, entries) => sections.push({ id, title, entries });
  const answer = (label, value) => ({ label, text: text(value) });

  switch (activity.type) {
    case "paratext":
      for (const item of PARATEXT_SECTIONS) {
        section(item.key, item.ko, item.fields.map((field) => answer(field.label || item.prompt, answers[field.key])));
      }
      break;
    case "raft": {
      section("plan", "글쓰기 계획", RAFT_COLUMNS.map((column) => answer(column.ko, answers[column.key])));
      // RAFT offsets refer to this exact plain-text value in the writing UI.
      // React text rendering escapes it; transforming entities or whitespace here
      // would detach public feedback from the student's original words.
      section("writing", "학생이 쓴 글", [{ label: "학생이 쓴 글", text: typeof answers.writing === "string" ? answers.writing : "" }]);
      report.feedback = rows("bookRaftFeedback").filter((note) => note.studentUid === uid)
        .map((note) => ({ id: typeof note.id === "string" ? note.id : "", quote: typeof note.quote === "string" ? note.quote : "", text: text(note.text),
          start: Number.isInteger(note.start) && note.start >= 0 ? note.start : 0,
          end: Number.isInteger(note.end) && note.end >= 0 ? note.end : 0 }))
        .filter((note) => note.text)
        .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
      break;
    }
    case "kwls": {
      const stream = rows("kwl").find(own);
      const values = kwlsAnswersFromEntry(stream || entry || {});
      section("reflection", "읽기 전과 후의 생각", KWLS_COLUMNS.map((column) => answer(`${column.letter} · ${column.ko}`, values[column.key])));
      dates.push(stream?.updatedAt, stream?.createdAt);
      break;
    }
    case "mindmap":
      // normalizeMindmap explicitly selects node keys, including saved positions,
      // per-layout offsets and safe image references used by the real canvas.
      report.map = normalizeMindmap(answers, report.topic);
      break;
    case "opinion": {
      if (text(activity.prompt)) section("prompt", "활동의 질문", [answer("질문", activity.prompt)]);
      const zones = new Map(list(activity.zones).map((zone) => [zone.key, text(zone.name)]));
      rows("bookOpinionNotes").filter((note) => note.authorId === uid && !note.byTeacher && text(note.text)).forEach((note, index) => {
        section(`note-${index}`, zones.get(note.zoneKey || note.zone) || "내 생각", [answer("내가 쓴 내용", note.text)]);
        dates.push(note.updatedAt, note.createdAt);
      });
      break;
    }
    case "hashtag": {
      const post = rows("bookHashtagPosts").find(own);
      const value = normalizeHashtagPost(post);
      const source = value.source;
      const imageUrl = safeImageUrl(value.image.url);
      if (imageUrl) report.image = { url: imageUrl, caption: text(value.image.caption), credit: text(value.image.credit) };
      if (value.title) section("heading", "내가 붙인 제목", [answer("제목", value.title)]);
      if (source.title || source.author || source.date || source.url) {
        section("source", "읽은 자료", [answer("자료 종류", sourceKindLabel(source.kind)), answer("제목", source.title),
          answer("지은이", source.author), answer("발행 정보", source.date), answer("출처", source.url)]);
      }
      value.tags.forEach((tag, index) => {
        section(`tag-${index}`, `${index + 1}번째 해시태그`, [answer("해시태그", tag.tag ? `#${tag.tag}` : ""),
          ...(tag.quote ? [answer("기록한 인용문", tag.quote)] : []), answer("생각 표현하기", tag.insight)]);
      });
      if (value.summary) section("summary", "전체 정리", [answer("내가 쓴 내용", value.summary)]);
      if (!report.topic) report.topic = text(source.title);
      dates.push(post?.updatedAt, post?.createdAt);
      break;
    }
    case "qmark": {
      const value = normalizeQmarkAnswers(answers);
      value.asks.forEach((ask, index) => {
        if (text(ask.question) || text(ask.reason)) section(`question-${index}`, `${index + 1}번째 궁금증`, [answer("궁금한 것", ask.question), answer("궁금한 이유", ask.reason)]);
      });
      section("prompts", "선택한 생각거리", value.picks.map((key) => answer("길잡이 물음", QMARK_PROMPTS.find((prompt) => prompt.key === key)?.text)));
      section("thought", "나의 생각", [answer("내가 쓴 내용", value.thought)]);
      break;
    }
    case "consonant": {
      if (!group) break;
      const mine = rows("bookWords").filter((word) => word.groupId === group.id && word.authorId === uid);
      section("words", "내가 모은 낱말", CONSONANT_LABELS.map((label, index) => answer(label,
        mine.filter((word) => word.cellKey === cellKey(index)).map((word) => text(word.text)).filter(Boolean).join(" · "))));
      dates.push(...mine.map((word) => word.createdAt));
      break;
    }
    case "brainwrite": {
      if (!group) break;
      const active = memberIds instanceof Set ? memberIds : new Set(list(group.members).map((member) => member.uid));
      const members = list(group.members).filter((member) => active.has(member.uid));
      if (activity.questionMode !== "student" && text(activity.prompt)) section("prompt", "시작 질문", [answer("질문", activity.prompt)]);
      rows("bookBwNotes").filter((note) => note.groupId === group.id && note.writerUid === uid && active.has(note.ownerUid) && text(note.text))
        .forEach((note, index) => {
          const owner = members.find((member) => member.uid === note.ownerUid);
          const turn = columnOrder(members, note.ownerUid).findIndex((member) => member.uid === uid) + 1;
          const name = text(owner?.name || owner?.realName || owner?.studentId) || "친구";
          const title = note.ownerUid === uid ? (activity.questionMode === "student" ? "내가 만든 질문" : "내가 시작한 생각") : `${name}의 칸에 보탠 생각${turn > 0 ? ` · ${turn}번째 줄` : ""}`;
          section(`contribution-${index}`, title, [answer("내가 쓴 내용", note.text)]);
          dates.push(note.updatedAt);
        });
      break;
    }
    case "crossword": {
      if (!group) break;
      rows("bookXwHints").filter((hint) => hint.groupId === group.id && hint.writerUid === uid).forEach((hint, index) => {
        section(`hint-${index}`, "내가 맡은 낱말과 힌트", [answer("낱말", hint.word), answer("내가 쓴 힌트", hint.hint)]);
        dates.push(hint.updatedAt);
      });
      break;
    }
    case "bingo": {
      if (!group) break;
      const board = rows("bookBingoBoards").find((item) => (item.groupId || item.id) === group.id);
      const bingo = normalizeBingo(activity.bingo);
      const progress = bingoProgress(board?.cells ?? {}, bingo?.called ?? [], bingo?.goal);
      report.bingo = { filled: progress.filled, total: BINGO_CELLS, goal: bingo?.goal ?? 3, lines: progress.count,
        words: progress.cells.map(text), groupResult: report.grouped };
      dates.push(board?.updatedAt);
      break;
    }
    default: break;
  }
  report.updatedAt = dates.map(isoDate).filter(Boolean).sort().at(-1) || null;
  return report;
}
