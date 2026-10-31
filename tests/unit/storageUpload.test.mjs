// 이미지 보안 1단계 안전망 — lib/storageUpload.js의 **현재** 업로드·삭제 동작.
// firebase/storage·DOM이 필요한 파일이라, popoverWindow 시험처럼 원본을 읽어
// import 줄만 떼고 vm에서 가짜 도구를 끼워 돌립니다(앱 코드는 그대로).
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";

const SRC = readFileSync(new URL("../../lib/storageUpload.js", import.meta.url), "utf8");
const BODY = SRC.replace(/^import[^;]+;\s*$/gm, "").replace(/^export /gm, "");

function load({ configured = true, uid = "stu1", now = 1700000000000 } = {}) {
  const calls = [];
  const storage = { name: "fake-storage" };
  const ctx = {
    calls,
    isFirebaseConfigured: configured,
    storage: configured ? storage : null,
    getCurrentUser: () => (uid ? { uid } : null),
    readImageAsDataUrl: async (file, w) => { calls.push(["dataUrl", file.name, w]); return "data:image/jpeg;base64,DEMO"; },
    ref: (s, path) => { calls.push(["ref", path]); return { path }; },
    uploadBytes: async (r, blob, meta) => { calls.push(["uploadBytes", r.path, blob.size]); return { ref: r }; },
    uploadBytesResumable: (r, blob) => {
      calls.push(["resumable", r.path, blob.size]);
      return {
        snapshot: { ref: r },
        on: (_e, prog, _err, done) => { prog({ bytesTransferred: 1, totalBytes: 2 }); done(); },
      };
    },
    getDownloadURL: async (r) => `https://firebasestorage.googleapis.com/v0/b/x/o/${encodeURIComponent(r.path)}?alt=media&token=t`,
    deleteObject: async (r) => { calls.push(["delete", r.path]); },
    createImageBitmap: async () => ({ width: 2000, height: 1000, close() {} }),
    document: {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ drawImage() {} }),
        toBlob(cb, type, q) { calls.push(["toBlob", this.width, this.height, type, q]); cb({ size: ctx.blobSize ?? 1000 }); },
      }),
    },
    Date: { now: () => now },
    blobSize: 1000,
    Promise, String, Math, Error,
  };
  runInNewContext(BODY + "\n;globalThis.api = { uploadImage, deleteUploadedFile, storagePath };", ctx);
  return { api: ctx.api, calls, ctx };
}

test("데모 모드: uploadImage는 Storage 없이 폭 900 data URL을 돌려줍니다", async () => {
  const { api, calls } = load({ configured: false });
  assert.equal(await api.uploadImage({ name: "a.png" }, { maxWidth: 1280 }), "data:image/jpeg;base64,DEMO");
  assert.deepEqual(calls, [["dataUrl", "a.png", 900]]);
});

test("저장 경로는 uploads/{uid}/{시각}_{정리된 이름} — 반 구분이 없습니다", () => {
  const { api } = load({ uid: "stu1", now: 42 });
  assert.equal(api.storagePath("내 사진 (1).jpg"), "uploads/stu1/42_______1_.jpg"); // 한글도 _로 바뀝니다
  assert.equal(api.storagePath(""), "uploads/stu1/42_file");
  assert.equal(api.storagePath("x".repeat(100) + ".jpg").length, "uploads/stu1/42_".length + 80);
  assert.equal(load({ uid: null, now: 7 }).api.storagePath("a.jpg"), "uploads/anon/7_a.jpg");
});

test("uploadImage: JPEG로 압축해 .jpg 이름으로 올리고, 토큰 붙은 다운로드 URL을 돌려줍니다", async () => {
  const { api, calls } = load({ now: 5 });
  const progress = [];
  const url = await api.uploadImage({ name: "photo.PNG" }, { maxWidth: 1000, quality: 0.8, onProgress: (p) => progress.push(p) });
  assert.ok(calls.some((c) => c[0] === "toBlob" && c[1] === 1000 && c[2] === 500 && c[3] === "image/jpeg" && c[4] === 0.8));
  assert.ok(calls.some((c) => c[0] === "uploadBytes" && c[1] === "uploads/stu1/5_photo.jpg"));
  assert.match(url, /^https:\/\/firebasestorage\.googleapis\.com\/.*uploads%2Fstu1%2F5_photo\.jpg\?alt=media&token=/);
  assert.deepEqual(progress, [0.2, 1]);
});

test("uploadImage 기본값: 폭 1080·품질 0.72, 작은 그림은 확대하지 않음", async () => {
  const { api, calls, ctx } = load();
  ctx.createImageBitmap = async () => ({ width: 500, height: 400 });
  await api.uploadImage({ name: "s.jpg" });
  assert.ok(calls.some((c) => c[0] === "toBlob" && c[1] === 500 && c[2] === 400 && c[4] === 0.72));
});

test("1MB 이상 압축본은 resumable 업로드로 진행률을 보냅니다", async () => {
  const { api, calls, ctx } = load({ now: 9 });
  ctx.blobSize = 1024 * 1024;
  const progress = [];
  await api.uploadImage({ name: "big.jpg" }, { onProgress: (p) => progress.push(p) });
  assert.ok(calls.some((c) => c[0] === "resumable" && c[1] === "uploads/stu1/9_big.jpg"));
  assert.ok(!calls.some((c) => c[0] === "uploadBytes"));
  assert.deepEqual(progress, [0.5]);
});

test("deleteUploadedFile: 파이어베이스 다운로드 URL만 지우고, 나머지는 조용히 건너뜁니다", async () => {
  const { api, calls } = load();
  const dl = "https://firebasestorage.googleapis.com/v0/b/x/o/uploads%2Fstu1%2F1_a.jpg?alt=media&token=t";
  await api.deleteUploadedFile(dl);
  assert.deepEqual(calls, [["ref", dl], ["delete", dl]]);
  calls.length = 0;
  for (const u of [null, "", "data:image/jpeg;base64,x", "https://example.com/a.jpg", "storage:uploads/c/u/a.jpg", "uploads/stu1/a.jpg"]) {
    await api.deleteUploadedFile(u);
  }
  assert.deepEqual(calls, []);
});

test("deleteUploadedFile: 삭제 실패는 삼키고, 데모 모드는 아무것도 안 합니다", async () => {
  const { api, ctx } = load();
  ctx.deleteObject = async () => { throw new Error("storage/unauthorized"); };
  await assert.doesNotReject(api.deleteUploadedFile("https://firebasestorage.googleapis.com/v0/b/x/o/a"));
  const demo = load({ configured: false });
  await demo.api.deleteUploadedFile("https://firebasestorage.googleapis.com/v0/b/x/o/a");
  assert.deepEqual(demo.calls, []);
});
