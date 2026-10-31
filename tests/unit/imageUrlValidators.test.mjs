// 이미지 보안 1단계 안전망 — 이미지 주소 검사 함수 3개의 **현재** 동작을 못 박습니다.
//  · lib/hashtag.js  safeImageUrl   (해시태그 대표 이미지)
//  · lib/mindmap.js  safeNodeImage  (마인드맵 노드 이미지) + mindmapImages
//  · lib/html.js     isSafeImageSrc (서식 글 <img> — 내보내지 않는 함수라 vm으로 꺼냅니다)
// 4단계부터 반 폴더 그림의 경로 표식(storage:uploads/{반}/{uid}/{파일})도
// 세 검사를 모두 통과합니다 — 못 통과하면 그림이 조용히 사라집니다.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeImageUrl } from "@/lib/hashtag";
import { safeNodeImage, mindmapImages } from "@/lib/mindmap";
import { stripImgTags, htmlHasImage } from "@/lib/html";

const htmlSrc = readFileSync(new URL("../../lib/html.js", import.meta.url), "utf8");
const start = htmlSrc.indexOf("function isSafeImageSrc(");
const end = htmlSrc.indexOf("\n}\n", start) + 3;
const isSafeImageSrc = runInNewContext(htmlSrc.slice(start, end) + "\nisSafeImageSrc;", {});

const DL = "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/uploads%2Fu1%2F1_a.jpg?alt=media&token=abc";
const DATA_JPEG = "data:image/jpeg;base64,/9j/4AAQ";
const DATA_PNG = "data:image/png;base64,iVBORw0KGgo=";

test("safeImageUrl: https 다운로드 URL과 이미지 data URL은 그대로, 앞뒤 공백은 지웁니다", () => {
  assert.equal(safeImageUrl(DL), DL);
  assert.equal(safeImageUrl(`  ${DL}  `), DL);
  assert.equal(safeImageUrl(DATA_JPEG), DATA_JPEG);
  assert.equal(safeImageUrl(DATA_PNG), DATA_PNG);
  assert.equal(safeImageUrl("data:image/webp;base64,AAA"), "data:image/webp;base64,AAA");
  assert.equal(safeImageUrl("data:image/gif;base64,AAA"), "data:image/gif;base64,AAA");
  // 현재: 아무 https 주소나 통과합니다(파이어베이스 주소로 한정하지 않음)
  assert.equal(safeImageUrl("https://example.com/x.png"), "https://example.com/x.png");
  assert.equal(safeImageUrl("HTTPS://EXAMPLE.COM/x"), "HTTPS://EXAMPLE.COM/x");
});

test("safeImageUrl: 그 밖의 것은 null", () => {
  for (const bad of [null, undefined, "", "   ", "http://example.com/x.png", "javascript:alert(1)",
    "data:image/svg+xml;base64,AAA", "data:text/html;base64,AAA", "data:image/bmp;base64,AAA",
    "storage:uploads/u1/a.jpg", "uploads/u1/a.jpg", "//example.com/x.png", "blob:https://x/y"]) {
    assert.equal(safeImageUrl(bad), null, String(bad));
  }
});

test("safeNodeImage: https·이미지 data URL만, 나머지는 빈 문자열", () => {
  assert.equal(safeNodeImage(DL), DL);
  assert.equal(safeNodeImage(` ${DATA_PNG} `), DATA_PNG);
  assert.equal(safeNodeImage("https://example.com/x"), "https://example.com/x");
  for (const bad of [null, undefined, 42, {}, "", "http://x/y", "javascript:alert(1)",
    "data:image/svg+xml;base64,AAA", "storage:uploads/u1/a.jpg", "uploads/u1/a.jpg"]) {
    assert.equal(safeNodeImage(bad), "", String(bad));
  }
});

test("mindmapImages: 노드의 안전한 이미지만 중복 없이 모읍니다", () => {
  const map = { nodes: [
    { id: "a", image: DL }, { id: "b", image: DL }, { id: "c", image: DATA_PNG },
    { id: "d", image: "javascript:x" }, { id: "e" }, { id: "f", image: "storage:uploads/x" },
  ] };
  assert.deepEqual([...mindmapImages(map)], [DL, DATA_PNG]);
  assert.equal(mindmapImages(null).size, 0);
  assert.equal(mindmapImages({}).size, 0);
});

test("isSafeImageSrc(서식 글): http·https 모두, data:image/는 종류 상관없이 통과", () => {
  assert.equal(isSafeImageSrc(DL), true);
  // 현재: 다른 두 검사와 달리 http://도 통과합니다
  assert.equal(isSafeImageSrc("http://example.com/x.png"), true);
  assert.equal(isSafeImageSrc(DATA_JPEG), true);
  // 현재: svg를 포함해 data:image/ 로 시작하면 모두 통과합니다
  assert.equal(isSafeImageSrc("data:image/svg+xml;base64,AAA"), true);
  for (const bad of ["", undefined, "javascript:alert(1)", "data:text/html,x", "storage:uploads/x",
    "uploads/u1/a.jpg", "//example.com/x", " https://x/y"]) {
    assert.equal(isSafeImageSrc(bad), false, String(bad));
  }
});

test("stripImgTags / htmlHasImage: 서식 글의 그림 감지·제거", () => {
  const html = `<p>글</p><img src="${DL}" alt=""><IMG src="${DATA_PNG}"/>`;
  assert.equal(htmlHasImage(html), true);
  assert.equal(htmlHasImage("<p>그림 없음</p><imgx>"), false);
  assert.equal(stripImgTags(html), "<p>글</p>");
  // data-storage-path를 쓰는 미래 모양도 지금은 '그림 있음'으로 봅니다
  assert.equal(htmlHasImage('<img data-storage-path="uploads/c/u/a.jpg" alt="">'), true);
});

// ── 4단계: 반 폴더 경로 표식 ─────────────────────────────────
const REF = "storage:uploads/class_A-1/stuUid9/1700000000000_photo.jpg";
const BAD_REFS = [
  "storage:uploads/u1/a.jpg",            // 반 칸 없음(옛 개인 폴더 모양)
  "storage:uploads/c/u/sub/a.jpg",       // 한 칸 더 깊음
  "storage:uploads/c/u/..",              // 위로 벗어나기
  "storage:uploads/../u/a.jpg",
  "storage:uploads/c/u/.hidden",
  "storage:uploads/c d/u/a.jpg",         // 공백
  "storage:uploads/c/u/a.jpg?x=1",
  "storage:other/c/u/a.jpg",             // uploads 밖
  "storage:/uploads/c/u/a.jpg",
  "STORAGE:uploads/c/u/a.jpg",
  "uploads/c/u/a.jpg",                   // 표식 없는 맨 경로
];

test("4단계: 세 검사 모두 반 폴더 경로 표식을 그대로 통과시킵니다", () => {
  assert.equal(safeImageUrl(REF), REF);
  assert.equal(safeImageUrl(`  ${REF} `), REF);
  assert.equal(safeNodeImage(REF), REF);
  assert.equal(isSafeImageSrc(REF), true);
});

test("4단계: 모양이 어긋난 경로 표식은 세 검사 모두 거부합니다", () => {
  for (const bad of BAD_REFS) {
    assert.equal(safeImageUrl(bad), null, bad);
    assert.equal(safeNodeImage(bad), "", bad);
    assert.equal(isSafeImageSrc(bad), false, bad);
  }
});

test("4단계: 마인드맵 그림 모으기(지울 때 씀)에 경로 표식도 들어갑니다", () => {
  const map = { nodes: [{ id: "a", image: REF }, { id: "b", image: DL }, { id: "c", image: "storage:uploads/x" }] };
  assert.deepEqual([...mindmapImages(map)], [REF, DL]);
});

test("4단계: 옛 https 주소와 data 그림은 예전처럼 통과합니다", () => {
  assert.equal(safeImageUrl(DL), DL);
  assert.equal(safeNodeImage(DATA_PNG), DATA_PNG);
  assert.equal(isSafeImageSrc(DL), true);
});

test("4단계: sanitizeHtml은 data-storage-path가 있으면 blob: 대신 경로 표식으로 되돌립니다", () => {
  assert.match(htmlSrc, /const sp = el\.getAttribute\("data-storage-path"\);/);
  assert.match(htmlSrc, /const src = sp \? `storage:\$\{sp\}` : el\.getAttribute\("src"\) \|\| "";/);
  // blob: 주소 자체는 여전히 안전하지 않은 주소입니다(저장되면 안 됨)
  assert.equal(isSafeImageSrc("blob:https://app/1234"), false);
});
