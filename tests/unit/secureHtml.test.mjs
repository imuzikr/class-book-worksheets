// 이미지 보안 4단계 — 서식 HTML 안의 반 폴더 그림 채우기·저장 되돌리기
// (lib/secureImage.js의 hydrateSecureImages·releaseSecureImages·serializeSecureHtml).
// 파일이 firebase·React를 불러오므로 그 부분만 떼어 vm에서 가짜 DOM·캐시로 돌립니다.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";

const SRC = readFileSync(new URL("../../lib/secureImage.js", import.meta.url), "utf8");
const BODY = SRC.slice(SRC.indexOf("const FAIL_TEXT"), SRC.indexOf("// dangerouslySetInnerHTML로")).replace(/^export /gm, "");

class FakeImg {
  constructor(attrs) { this.attrs = { ...attrs }; }
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  removeAttribute(n) { delete this.attrs[n]; }
}
function fakeRoot(imgs) {
  const html = () => imgs.map((i) => `<img ${Object.entries(i.attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}>`).join("");
  const root = {
    imgs,
    querySelectorAll(sel) {
      if (sel === 'img[src^="storage:"]') return imgs.filter((i) => (i.getAttribute("src") || "").startsWith("storage:"));
      if (sel === "img[data-storage-path]") return imgs.filter((i) => i.getAttribute("data-storage-path") != null);
      throw new Error(sel);
    },
    querySelector(sel) { return root.querySelectorAll(sel)[0] ?? null; },
    cloneNode() { return fakeRoot(imgs.map((i) => new FakeImg(i.attrs))); },
    get innerHTML() { return html(); },
  };
  return root;
}
function load(results = {}) {
  const log = [];
  const cache = {
    acquire: (src) => { log.push(["acquire", src]); return Promise.resolve(results[src] ?? { status: "ready", url: `blob:x/${log.length}` }); },
    release: (src) => log.push(["release", src]),
  };
  const ctx = { getSecureImageCache: () => cache, cache };
  runInNewContext(BODY + "\n;globalThis.api = { hydrateSecureImages, releaseSecureImages, serializeSecureHtml };", ctx);
  return { api: ctx.api, log };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const REF = "storage:uploads/c1/stu1/1_a.jpg";

test("storage: 그림만 골라 권한 확인 후 blob 주소로 채우고, 원래 경로를 남깁니다", async () => {
  const { api, log } = load();
  const a = new FakeImg({ src: REF, alt: "" });
  const old = new FakeImg({ src: "https://firebasestorage.googleapis.com/x" });
  const data = new FakeImg({ src: "data:image/png;base64,AA" });
  const held = [];
  api.hydrateSecureImages(fakeRoot([a, old, data]), held);
  assert.equal(a.getAttribute("src"), null); // 기다리는 동안 깨진 그림 대신 빈칸
  assert.equal(a.getAttribute("data-storage-path"), "uploads/c1/stu1/1_a.jpg");
  await tick();
  assert.match(a.getAttribute("src"), /^blob:x\//);
  assert.equal(a.getAttribute("aria-busy"), null);
  assert.equal(old.getAttribute("src"), "https://firebasestorage.googleapis.com/x"); // 옛 주소는 그대로
  assert.equal(data.getAttribute("src"), "data:image/png;base64,AA");
  assert.deepEqual(held, [REF]);
  assert.deepEqual(log, [["acquire", REF]]);
});

test("권한이 없으면 조용히 사라지지 않고 표시와 안내 글을 답니다", async () => {
  const { api } = load({ [REF]: { status: "error", reason: "denied" } });
  const a = new FakeImg({ src: REF });
  api.hydrateSecureImages(fakeRoot([a]), []);
  await tick();
  assert.equal(a.getAttribute("data-secure-image-error"), "denied");
  assert.equal(a.getAttribute("alt"), "볼 수 있는 권한이 없는 그림이에요");
  assert.equal(a.getAttribute("src"), null);
});

test("화면이 닫히면 빌린 그림을 모두 돌려주고 목록을 비웁니다", () => {
  const { api, log } = load();
  const held = [];
  api.hydrateSecureImages(fakeRoot([new FakeImg({ src: REF }), new FakeImg({ src: REF })]), held);
  api.releaseSecureImages(held);
  assert.deepEqual(log.filter((l) => l[0] === "release"), [["release", REF], ["release", REF]]);
  assert.deepEqual(held, []);
});

test("저장할 HTML: blob 주소를 경로 표식으로 되돌리고 원본 화면은 건드리지 않습니다", async () => {
  const { api } = load();
  const a = new FakeImg({ src: REF, alt: "" });
  const root = fakeRoot([a]);
  api.hydrateSecureImages(root, []);
  await tick();
  const out = api.serializeSecureHtml(root);
  assert.ok(out.includes(`src="${REF}"`), out);
  assert.ok(!out.includes("blob:"), out);
  assert.ok(!out.includes("data-storage-path"), out);
  assert.match(a.getAttribute("src"), /^blob:/); // 화면의 그림은 그대로
});

test("반 폴더 그림이 없으면 innerHTML 그대로, root가 없으면 빈 문자열", () => {
  const { api } = load();
  const root = fakeRoot([new FakeImg({ src: "https://x/y.png" })]);
  assert.equal(api.serializeSecureHtml(root), root.innerHTML);
  assert.equal(api.serializeSecureHtml(null), "");
  assert.doesNotThrow(() => api.hydrateSecureImages(null, []));
});
