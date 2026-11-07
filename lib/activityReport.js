// One student's saved reading-activity answers, arranged by the activity's own
// fields. This is a projection of records the dashboard already loaded. It does
// not score the work, fill in missing words, or include another student's text.
import { PARATEXT_SECTIONS, safeBookUrl } from "./paratext";
import { RAFT_COLUMNS, RAFT_WRITING } from "./raft";
import { KWLS_COLUMNS, kwlsAnswersFromEntry } from "./kwls";
import { QMARK_PROMPTS, normalizeQmarkAnswers } from "./qmark";
import { normalizeHashtagPost, sourceKindLabel } from "./hashtag";
import { normalizeMindmap } from "./mindmap";
import { sortMembers } from "./brainwrite";
import { CONSONANT_LABELS } from "./consonants";

const list = (value) => Array.isArray(value) ? value : [];

export function readableAnswer(value, max = 10000) {
  const text = String(value ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
  return text.slice(0, max);
}

const line = (value, max = 160) => readableAnswer(value, max).replace(/\s+/g, " ").trim();
const has = (value) => readableAnswer(value).length > 0;
const asSet = (value) => value instanceof Set ? value : new Set(list(value).filter(Boolean));

function piece(id, label, state, text = "", note = "") {
  const row = { id: String(id), label: line(label) || "내용", state, text: state === "written" ? readableAnswer(text) : "" };
  const extra = readableAnswer(note, 2000);
  if (extra) row.note = extra;
  return row;
}
const written = (id, label, text, note = "") => has(text) ? piece(id, label, "written", text, note) : piece(id, label, "missing");
const missing = (id, label) => piece(id, label, "missing");
const optional = (id, label) => piece(id, label, "optional");
const selected = (id, label) => piece(id, label, "selected");
const attached = (id, label, note) => piece(id, label, "attached", "", note);
const section = (id, label, items) => ({ id, label: line(label) || "내용", items });

function needsGroup(activity) {
  const grouped = ["consonant", "crossword"].includes(activity.type) ? activity.groupMode !== "solo"
    : activity.type === "brainwrite" || activity.grouped === true;
  return grouped || activity.type === "consonant" || activity.type === "crossword";
}
function rowsOf(records, key, activityId) {
  return list(records?.[key]).filter((record) => record?.activityId === activityId);
}
function groupOf(activity, student, records) {
  return rowsOf(records, "bookGroups", activity.id).find((group) => group.retired !== true
    && (list(group.memberUids).includes(student.uid) || list(group.members).some((member) => member?.uid === student.uid))) ?? null;
}
function entryOf(activity, student, records) {
  return rowsOf(records, "bookEntries", activity.id).find((record) => record.authorId === student.uid || record.id === student.uid) ?? null;
}
function answersOf(entry) {
  const answers = entry?.answers;
  return answers && typeof answers === "object" ? answers : {};
}
function imageNote(hasImage, text) {
  if (!hasImage) return "";
  return has(text) ? "그림이 함께 있어요." : "";
}

function paratextSections(answers) {
  return PARATEXT_SECTIONS.map((part) => section(`${part.letter}-${part.key}`, `${part.letter} · ${part.ko}`, part.fields.map((field) => {
    const label = field.label || part.ko;
    if (has(answers[field.key])) return written(field.key, label, answers[field.key]);
    return field.optional ? optional(field.key, label) : missing(field.key, label);
  })));
}

function raftSections(answers) {
  return [
    section("plan", "글의 역할", RAFT_COLUMNS.map((column) => (
      has(answers[column.key]) ? written(column.key, `${column.letter} · ${column.ko}`, answers[column.key]) : missing(column.key, `${column.letter} · ${column.ko}`)
    ))),
    section("writing", RAFT_WRITING.ko, [
      has(answers.writing) ? written("writing", "쓴 글", answers.writing) : missing("writing", "쓴 글"),
    ]),
  ];
}

function kwlsSections(entry, stream) {
  const answers = kwlsAnswersFromEntry(stream ?? entry ?? {});
  return KWLS_COLUMNS.map((column) => section(column.key, `${column.letter} · ${column.ko}`, [
    has(answers[column.key]) ? written(column.key, column.prompt, answers[column.key]) : missing(column.key, column.prompt),
  ]));
}

function qmarkSections(answers) {
  const normalized = normalizeQmarkAnswers(answers);
  const picked = new Set(normalized.picks);
  return [
    section("asks", "나의 물음표", normalized.asks.flatMap((ask, index) => {
      const number = index + 1;
      return [
        has(ask.question) ? written(`question-${number}`, `궁금증 ${number}`, ask.question) : missing(`question-${number}`, `궁금증 ${number}`),
        has(ask.reason) ? written(`reason-${number}`, `이유 ${number}`, ask.reason) : missing(`reason-${number}`, `이유 ${number}`),
      ];
    })),
    section("picks", "고른 길잡이 물음", QMARK_PROMPTS.map((prompt) => (
      picked.has(prompt.key) ? selected(prompt.key, prompt.text) : missing(prompt.key, prompt.text)
    ))),
    section("thought", "나의 생각", [
      has(normalized.thought) ? written("thought", "정리한 생각", normalized.thought) : missing("thought", "정리한 생각"),
    ]),
  ];
}

function httpText(value) {
  const text = line(value, 500);
  return /^https?:\/\//i.test(text) ? text : "";
}

function hashtagSections(record) {
  const post = normalizeHashtagPost(record ?? {});
  const source = post.source || {};
  const sourceStarted = [source.title, source.author, source.date, source.url].some(has);
  const sourceItems = [
    sourceStarted ? written("kind", "종류", sourceKindLabel(source.kind)) : missing("kind", "종류"),
    has(source.title) ? written("title", "제목", source.title) : missing("title", "제목"),
    has(source.author) ? written("author", "지은이", source.author) : missing("author", "지은이"),
  ];
  if (has(source.date)) sourceItems.push(written("date", "날짜", source.date));
  const url = httpText(source.url);
  if (url) sourceItems.push(written("url", "주소", url));
  const tags = post.tags.map((tag, index) => {
    const label = tag.tag ? `#${tag.tag}` : `해시태그 ${index + 1}`;
    const quote = has(tag.quote) ? `옮겨 둔 문장: ${readableAnswer(tag.quote, 600)}` : "";
    if (has(tag.insight)) return written(`tag-${index + 1}`, label, tag.insight, quote);
    if (quote) return piece(`tag-${index + 1}`, label, "written", readableAnswer(tag.quote, 600));
    return missing(`tag-${index + 1}`, label);
  });
  const sections = [section("source", "읽은 글", sourceItems), section("tags", "여섯 개의 해시태그", tags)];
  if (has(post.summary)) sections.push(section("summary", "이전에 적은 요약", [written("summary", "요약", post.summary)]));
  const caption = readableAnswer(post.image?.caption, 300);
  if (caption) sections.push(section("image", "그림 설명", [written("caption", "그림 설명", caption)]));
  else if (post.image?.url) sections.push(section("image", "그림", [attached("image", "첨부한 그림", "그림이 첨부되어 있어요.")]));
  return { sections, sourceLabel: [sourceStarted ? sourceKindLabel(source.kind) : "", source.title, source.author].filter(has).map((part) => line(part, 150)).join(" · ") };
}

function mindmapSections(answers, topic) {
  const map = normalizeMindmap(answers, topic);
  const root = map.nodes.find((node) => node.parentId === null) ?? null;
  const rootText = readableAnswer(root?.text);
  const topicText = readableAnswer(topic);
  const sections = [];
  const rootIsTopic = !rootText || rootText === topicText || rootText === "주제";
  if (root && !rootIsTopic) {
    sections.push(section("center", "중심 생각", [
      written("center", "중심 생각", root.text, imageNote(!!root.image, root.text)),
    ]));
  } else if (root?.image) {
    sections.push(section("center", "중심 그림", [attached("center", "중심", "그림이 첨부되어 있어요.")]));
  }
  const branches = map.nodes.filter((node) => node.parentId !== null && (has(node.text) || node.image));
  sections.push(section("branches", "가지", branches.length ? branches.map((node, index) => {
    const label = line(node.edgeLabel, 80) || "가지";
    if (has(node.text)) return written(node.id || `branch-${index + 1}`, label, node.text, imageNote(!!node.image, node.text));
    return attached(node.id || `branch-${index + 1}`, label, "그림만 첨부되어 있어요.");
  }) : [missing("branch", "가지")]));
  return sections;
}

function opinionSections(activity, student, records) {
  const zones = new Map(list(activity.zones).map((zone) => [zone?.key, line(zone?.name, 80)]));
  const notes = rowsOf(records, "bookOpinionNotes", activity.id)
    .filter((note) => note.authorId === student.uid && note.byTeacher !== true && has(note.text))
    .slice()
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a.id).localeCompare(String(b.id)));
  if (!notes.length) return [section("notes", "생각 메모", [missing("note", "생각 메모")])];
  return notes.map((note, index) => {
    const label = zones.get(note.zone) || "생각 메모";
    return section(note.id || `note-${index + 1}`, label, [written(note.id || `note-${index + 1}`, label, note.text)]);
  });
}

function consonantSections(activity, student, records, group) {
  const words = rowsOf(records, "bookWords", activity.id)
    .filter((word) => word.groupId === group?.id && word.authorId === student.uid && has(word.text))
    .slice()
    .sort((a, b) => String(a.cellKey).localeCompare(String(b.cellKey), "en", { numeric: true }) || String(a.id).localeCompare(String(b.id)));
  if (activity.groupMode === "solo") {
    const items = CONSONANT_LABELS.flatMap((label, index) => {
      const mine = words.filter((word) => word.cellKey === `c${index}`);
      if (!mine.length) return [missing(`c${index}`, label)];
      return mine.map((word, wordIndex) => written(`${word.id || index}-${wordIndex}`, label, word.text));
    });
    return [section("cells", "내가 넣은 낱말", items)];
  }
  if (!words.length) return [section("words", "내가 넣은 낱말", [missing("words", "넣은 낱말")])];
  return [section("words", "내가 넣은 낱말", words.map((word, index) => {
    const cell = Number(String(word.cellKey || "").slice(1));
    const label = CONSONANT_LABELS[cell] || "낱말";
    return written(word.id || `word-${index + 1}`, label, word.text);
  }))];
}

function brainwriteSections(student, records, group, memberIds) {
  const members = sortMembers(list(group?.members).filter((member) => member?.uid && memberIds.has(member.uid)));
  if (!members.length) return [];
  const notes = rowsOf(records, "bookBwNotes", group.activityId).filter((note) => note.groupId === group.id && note.writerUid === student.uid);
  return [section("lines", "내가 이어 쓴 줄", members.map((member) => {
    const label = member.uid === student.uid ? "내 칸" : `${line(member.name || member.studentId, 40) || "모둠원"}의 칸`;
    const note = notes.find((item) => item.ownerUid === member.uid);
    return has(note?.text) ? written(member.uid, label, note.text) : missing(member.uid, label);
  }))];
}

function crosswordSections(student, records, group) {
  const hints = rowsOf(records, "bookXwHints", group.activityId)
    .filter((hint) => hint.groupId === group.id && hint.writerUid === student.uid)
    .slice()
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0) || (Number(a.idx) || 0) - (Number(b.idx) || 0));
  if (!hints.length) return [];
  return [section("hints", "맡은 힌트", hints.map((hint, index) => {
    const direction = hint.dir === "down" ? "세로" : "가로";
    const word = line(hint.word, 40);
    const label = `${hint.num ? `${hint.num}. ` : ""}${direction}${word ? ` · ${word}` : ""}`;
    const id = hint.id || `hint-${index + 1}`;
    return has(hint.hint) ? written(id, label, hint.hint) : missing(id, label);
  }))];
}

export function activityReportContent(activity, student, records = {}, memberIds = []) {
  const safeActivity = activity && typeof activity === "object" ? activity : {};
  const person = student?.uid ? student : { uid: "", name: "" };
  const group = person.uid ? groupOf(safeActivity, person, records) : null;
  const entry = person.uid ? entryOf(safeActivity, person, records) : null;
  const topic = line(group?.topic || entry?.topic || safeActivity.topic, 150);
  const prompt = line(safeActivity.type === "hashtag" ? safeActivity.guide : safeActivity.prompt, 500);
  const bookUrl = safeBookUrl(safeActivity.bookUrl) || "";
  const base = { topic, prompt, sourceLabel: "", bookUrl, sections: [] };
  if (!safeActivity.type || !person.uid) return base;
  if (needsGroup(safeActivity) && !group) return base;
  const members = asSet(memberIds);
  const answers = answersOf(entry);
  if (safeActivity.type === "paratext") return { ...base, sections: paratextSections(answers) };
  if (safeActivity.type === "raft") return { ...base, sections: raftSections(answers) };
  if (safeActivity.type === "kwls") {
    const stream = rowsOf(records, "kwl", safeActivity.id).find((record) => record.userId === person.uid || record.authorId === person.uid) ?? null;
    return { ...base, sections: kwlsSections(entry, stream) };
  }
  if (safeActivity.type === "qmark") return { ...base, sections: qmarkSections(answers) };
  if (safeActivity.type === "hashtag") {
    const post = rowsOf(records, "bookHashtagPosts", safeActivity.id).find((record) => record.authorId === person.uid || record.id === person.uid) ?? null;
    const report = hashtagSections(post);
    return { ...base, sourceLabel: report.sourceLabel, sections: report.sections };
  }
  if (safeActivity.type === "mindmap") return { ...base, sections: mindmapSections(answers, topic) };
  if (safeActivity.type === "opinion") return { ...base, sections: opinionSections(safeActivity, person, records) };
  if (safeActivity.type === "consonant") return { ...base, sections: consonantSections(safeActivity, person, records, group) };
  if (safeActivity.type === "brainwrite") return { ...base, sections: brainwriteSections(person, records, group, members) };
  if (safeActivity.type === "crossword") {
    return { ...base, sourceLabel: has(safeActivity.sourceTitle) ? `낱말 출처 · ${line(safeActivity.sourceTitle, 150)}` : "", sections: crosswordSections(person, records, group) };
  }
  return base;
}
