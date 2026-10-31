// 이미지 보안 1단계 안전망 — 그림을 **올리는 곳 3군데**와 **보여 주는 곳 10군데**의
// 현재 모습을 소스에서 확인합니다. JSX는 시험 도구가 못 읽으므로(resolve.mjs 참고)
// 파일 글자를 읽어 확인합니다. 4단계에서 표시 방식을 바꿀 때 한 곳도 빠뜨리지 않았는지,
// 새 표시 자리가 몰래 생기지 않았는지 이 목록이 알려 줍니다.
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("업로드 3곳: HashtagForm·MindmapForm·RichTextEditor가 lib/storageUpload.js의 uploadImage를 씁니다", () => {
  const hf = read("components/HashtagForm.jsx");
  assert.match(hf, /import \{ uploadImage, deleteUploadedFile \} from "@\/lib\/storageUpload"/);
  assert.match(hf, /uploadImage\(file, \{ maxWidth: 1280, quality: 0\.8 \}\)/);
  assert.match(hf, /if \(old && old !== url\) deleteUploadedFile\(old\)/);
  const mf = read("components/MindmapForm.jsx");
  assert.match(mf, /import \{ uploadImage, deleteUploadedFile \} from "@\/lib\/storageUpload"/);
  assert.match(mf, /uploadImage\(file, \{ maxWidth: 640, quality: 0\.8 \}\)/);
  assert.match(mf, /for \(const url of mindmapImages\(map\)\) if \(!kept\.has\(url\)\) deleteUploadedFile\(url\)/);
  const rte = read("components/RichTextEditor.jsx");
  assert.match(rte, /import \{ uploadImage \} from "@\/lib\/storageUpload"/);
  assert.match(rte, /const url = await uploadImage\(file\);/);
  // 서식 글에는 받은 주소를 src로 그대로 심습니다(지금은 다운로드 URL이 HTML에 남음)
  assert.match(rte, /insertHTML", false, `<img src="\$\{url\}" alt="">`/);
});

test("uploadImage·deleteUploadedFile을 부르는 곳은 정해진 파일뿐입니다", () => {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx|mjs)$/.test(e.name) && /\b(uploadImage|deleteUploadedFile)\(/.test(read(p))) files.push(p);
    }
  };
  ["app", "components", "lib"].forEach(walk);
  assert.deepEqual(files.sort(), [
    "components/HashtagForm.jsx",
    "components/MindmapForm.jsx",
    "components/RichTextEditor.jsx",
    "lib/data/books.js", // 활동 삭제 때 해시태그 대표 이미지 정리
    "lib/storageUpload.js",
  ]);
});

// 저장된 주소를 <img src>로 바로 그리는 4곳
const DIRECT = [
  ["components/HashtagForm.jsx", /<img src=\{post\.image\.url\}/],
  ["components/HashtagSlide.jsx", /<img src=\{s\.image\.url\}/],
  ["components/HashtagInfographic.jsx", /<img src=\{s\.image\.url\}/],
  ["components/MindmapCanvas.jsx", /<img className="mm-node-img" src=\{n\.image\}/],
];
// 정화한 서식 HTML(그 안의 <img>)을 dangerouslySetInnerHTML로 그리는 6곳
const RICH = [
  ["components/PeerReviewModal.jsx", /dangerouslySetInnerHTML=\{\{ __html: richHtml\(/, 3],
  ["components/LessonTaskPanel.jsx", /dangerouslySetInnerHTML=\{\{ __html: sanitizeHtml\(/, 2],
  ["components/MessengerWindow.jsx", /dangerouslySetInnerHTML=\{\{ __html: sanitizeHtml\(m\.html\) \}\}/, 1],
  ["components/PopQuizParts.jsx", /dangerouslySetInnerHTML=\{\{ __html: sanitizeHtml\(/, 1],
  ["components/CornellNoteSheet.jsx", /dangerouslySetInnerHTML=\{\{ __html: notesHtml \}\}/, 1],
  ["components/PresentationOverlay.jsx", /dangerouslySetInnerHTML=\{\{ __html: html \}\}/, 1],
];

test("표시 10곳 — 직접 <img> 4곳", () => {
  for (const [f, re] of DIRECT) assert.match(read(f), re, f);
});

test("표시 10곳 — 서식 HTML 6곳(개수까지)", () => {
  for (const [f, re, n] of RICH) {
    const g = new RegExp(re.source, "g");
    assert.equal(read(f).match(g)?.length ?? 0, n, f);
  }
});

test("dangerouslySetInnerHTML을 쓰는 컴포넌트는 이 6곳뿐입니다(새 자리 감지)", () => {
  const dir = new URL("../../components/", import.meta.url);
  const found = [];
  const walk = (base, rel = "") => {
    for (const e of readdirSync(new URL(rel, base), { withFileTypes: true })) {
      const p = rel + e.name;
      if (e.isDirectory()) walk(base, p + "/");
      else if (/\.jsx?$/.test(e.name) && /dangerouslySetInnerHTML=\{/.test(read(`components/${p}`))) found.push(`components/${p}`);
    }
  };
  walk(dir);
  assert.deepEqual(found.sort(), RICH.map((r) => r[0]).sort());
});

test("서식 HTML 표시 경로는 sanitizeHtml(또는 그 위의 richHtml)을 거칩니다", () => {
  assert.match(read("components/PresentationOverlay.jsx"), /const html = sanitizeHtml\(broadcast\.content \|\| ""\)/);
  const cornell = read("components/CornellNoteSheet.jsx");
  assert.match(cornell, /const notesHtml = richHtml\(b\.notes \?\? ""\)/);
  assert.match(read("lib/html.js"), /export function richHtml[\s\S]*?sanitizeHtml\(s\)/);
});
