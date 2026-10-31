// 이미지 보안 안전망 — 그림을 **올리는 곳 3군데**와 **보여 주는 곳 11군데**를 소스에서 확인합니다.
// 4단계: 올리는 곳은 모두 반 id를 넘기고, 보여 주는 곳은 모두 SecureImage / SecureHtml을 씁니다.
// JSX는 시험 도구가 못 읽으므로(resolve.mjs 참고) 파일 글자를 읽어 확인합니다.
// 새 표시 자리가 몰래 생기거나 맨 <img src={저장값}>으로 되돌아가면 이 시험이 알려 줍니다.
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

function walkFiles(dirs, re) {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx|mjs)$/.test(e.name) && re.test(read(p))) files.push(p);
    }
  };
  dirs.forEach(walk);
  return files.sort();
}

test("업로드 3곳: 모두 반 id를 넘겨 반 폴더로 올립니다", () => {
  const hf = read("components/HashtagForm.jsx");
  assert.match(hf, /import \{ uploadImage, deleteUploadedFile \} from "@\/lib\/storageUpload"/);
  assert.match(hf, /uploadImage\(file, \{ classId: activity\?\.classId, maxWidth: 1280, quality: 0\.8 \}\)/);
  assert.match(hf, /if \(old && old !== url\) deleteUploadedFile\(old\)/);
  const mf = read("components/MindmapForm.jsx");
  assert.match(mf, /uploadImage\(file, \{ classId: activity\?\.classId, maxWidth: 640, quality: 0\.8 \}\)/);
  assert.match(mf, /for \(const url of mindmapImages\(map\)\) if \(!kept\.has\(url\)\) deleteUploadedFile\(url\)/);
  const rte = read("components/RichTextEditor.jsx");
  assert.match(rte, /const uploadClassId = useUploadClassId\(\);/);
  assert.match(rte, /const url = await uploadImage\(file, \{ classId: uploadClassId \}\);/);
  // 받은 경로 표식을 src로 심고, 바로 권한 확인 후 채웁니다
  assert.match(rte, /insertHTML", false, `<img src="\$\{url\}" alt="">`/);
  assert.match(rte, /hydrateSecureImages\(ref\.current, heldImagesRef\.current\);/);
});

test("서식 편집기는 blob: 주소를 저장하지 않습니다 — onChange는 모두 serializeSecureHtml을 거칩니다", () => {
  const rte = read("components/RichTextEditor.jsx");
  assert.equal(/onChange\(ref\.current\.innerHTML\)/.test(rte), false);
  assert.ok((rte.match(/onChange\(serializeSecureHtml\(ref\.current\)\)/g) ?? []).length >= 10);
  assert.match(rte, /return \(\) => releaseSecureImages\(held\);/);
});

test("uploadImage를 부르는 곳은 정해진 파일뿐이고, 모두 classId를 넘깁니다", () => {
  assert.deepEqual(walkFiles(["app", "components", "lib"], /\b(uploadImage|deleteUploadedFile)\(/), [
    "components/HashtagForm.jsx",
    "components/MindmapForm.jsx",
    "components/RichTextEditor.jsx",
    "lib/data/books.js", // 활동 삭제 때 해시태그 대표 이미지 정리
    "lib/storageUpload.js",
  ]);
  for (const f of ["components/HashtagForm.jsx", "components/MindmapForm.jsx", "components/RichTextEditor.jsx"]) {
    for (const call of read(f).match(/uploadImage\([^)]*\)/g) ?? []) assert.match(call, /classId:/, `${f}: ${call}`);
  }
});

test("서식 편집기를 쓰는 화면은 모두 반 id로 감싸져 있습니다(UploadClassProvider)", () => {
  const hosts = {
    "components/CornellNoteDrawer.jsx": "props.classId", // 수업 노트·과제(LessonTaskPanel)·파이썬 셀·노트 고치기
    "components/MessengerWindow.jsx": "props.classId",
    "components/PopQuizStudentModal.jsx": "props.classId",
    "components/RaftForm.jsx": "props.activity?.classId", // 동료 평가(PeerReviewModal)
  };
  for (const [f, expr] of Object.entries(hosts)) {
    assert.ok(read(f).includes(`<UploadClassProvider classId={${expr}}>`), f);
  }
  // 편집기를 직접 쓰는 컴포넌트 목록 — 늘어나면 위 감싸기도 확인해야 합니다
  assert.deepEqual(walkFiles(["app", "components"], /<RichTextEditor\b/), [
    "components/CornellNoteDrawer.jsx",
    "components/CornellNoteEditSheet.jsx",
    "components/LessonTaskPanel.jsx",
    "components/MessengerWindow.jsx",
    "components/PeerReviewModal.jsx",
    "components/PopQuizStudentModal.jsx",
    "components/PyCellEditor.jsx",
  ]);
});

// 저장된 주소를 그리는 5곳 — 모두 SecureImage
const DIRECT = [
  ["components/HashtagForm.jsx", /<SecureImage src=\{post\.image\.url\}/],
  ["components/HashtagSlide.jsx", /<SecureImage src=\{s\.image\.url\}/],
  ["components/HashtagInfographic.jsx", /<SecureImage src=\{s\.image\.url\}/],
  ["components/MindmapCanvas.jsx", /<SecureImage className="mm-node-img" src=\{n\.image\}/],
  ["components/PresentationOverlay.jsx", /<SecureImage\s+className="broadcast-slide-img"\s+src=\{broadcast\.imageUrl\}/],
];
// 정화한 서식 HTML을 그리는 6곳 — 모두 SecureHtml
const RICH = [
  ["components/PeerReviewModal.jsx", /html=\{richHtml\(/, 3],
  ["components/LessonTaskPanel.jsx", /html=\{sanitizeHtml\(/, 2],
  ["components/MessengerWindow.jsx", /html=\{sanitizeHtml\(m\.html\)\}/, 1],
  ["components/PopQuizParts.jsx", /html=\{sanitizeHtml\(/, 1],
  ["components/CornellNoteSheet.jsx", /html=\{notesHtml\}/, 1],
  ["components/PresentationOverlay.jsx", /html=\{html\}/, 1],
];

test("표시 — 저장된 주소를 그리는 5곳은 SecureImage", () => {
  for (const [f, re] of DIRECT) {
    const src = read(f);
    assert.match(src, re, f);
    assert.match(src, /import SecureImage from "\.\/SecureImage";/, f);
  }
});

test("표시 — 서식 HTML 6곳은 SecureHtml(개수까지)", () => {
  for (const [f, re, n] of RICH) {
    const src = read(f);
    assert.equal(src.match(new RegExp(re.source, "g"))?.length ?? 0, n, f);
    assert.equal(src.match(/<SecureHtml\b/g)?.length ?? 0, n, f);
    assert.match(src, /import SecureHtml from "\.\/SecureHtml";/, f);
  }
});

test("dangerouslySetInnerHTML은 SecureHtml 한 곳에만 남습니다(새 자리 감지)", () => {
  // app/layout.js는 로그인 대기용 고정 <script>(사용자 글 아님)
  assert.deepEqual(walkFiles(["components", "app"], /dangerouslySetInnerHTML=\{/), ["app/layout.js", "components/SecureHtml.jsx"]);
  assert.match(read("components/SecureHtml.jsx"), /useSecureHtml\(innerRef, html\);/);
});

test("저장값을 맨 <img src={…}>로 그리는 곳이 다시 생기지 않았습니다", () => {
  // 표지·앱 기본 그림 등 대상이 아닌 자리는 여기 적어 둡니다
  const re = /<img\b[^>]*src=\{[^}]*(image\.url|\.image\b|imageUrl)[^}]*\}/;
  assert.deepEqual(walkFiles(["components", "app"], re), []);
});

test("서식 HTML 표시 경로는 sanitizeHtml(또는 그 위의 richHtml)을 거칩니다", () => {
  assert.match(read("components/PresentationOverlay.jsx"), /const html = sanitizeHtml\(broadcast\.content \|\| ""\)/);
  const cornell = read("components/CornellNoteSheet.jsx");
  assert.match(cornell, /const notesHtml = richHtml\(b\.notes \?\? ""\)/);
  assert.match(read("lib/html.js"), /export function richHtml[\s\S]*?sanitizeHtml\(s\)/);
});
