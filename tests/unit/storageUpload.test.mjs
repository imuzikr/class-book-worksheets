// 이미지 보안 안전망 — lib/storageUpload.js의 업로드·삭제 동작(4단계: 반 폴더 + 경로 표식).
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
    uploadBytes: async (r, blob, meta) => { calls.push(["uploadBytes", r.path, blob.size, meta?.contentType]); return { ref: { ...r, fullPath: r.path } }; },
    uploadBytesResumable: (r, blob) => {
      calls.push(["resumable", r.path, blob.size]);
      return {
        snapshot: { ref: { ...r, fullPath: r.path } },
        on: (_e, prog, _err, done) => { prog({ bytesTransferred: 1, totalBytes: 2 }); done(); },
      };
    },
    getDownloadURL: async (r) => { calls.push(["getDownloadURL", r.path]); return `https://firebasestorage.googleapis.com/v0/b/x/o/${encodeURIComponent(r.path)}?alt=media&token=t`; },
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
    Promise, String, Math, Error, RegExp,
  };
  runInNewContext(BODY + "\n;globalThis.api = { uploadImage, deleteUploadedFile, classImagePath, safeFileName, CLASS_ID_RE, NoClassError, uploadErrorMessage, isUploadDemoMode };", ctx);
  return { api: ctx.api, calls, ctx };
}

test("데모 모드: uploadImage는 Storage 없이 폭 900 data URL을 돌려줍니다", async () => {
  const { api, calls } = load({ configured: false });
  assert.equal(await api.uploadImage({ name: "a.png" }, { maxWidth: 1280 }), "data:image/jpeg;base64,DEMO");
  assert.deepEqual(calls, [["dataUrl", "a.png", 900]]);
});

test("저장 경로는 uploads/{반}/{uid}/{시각}_{정리된 이름}", () => {
  const { api } = load({ uid: "stu1", now: 42 });
  assert.equal(api.classImagePath("c1", "내 사진 (1).jpg"), "uploads/c1/stu1/42_______1_.jpg"); // 한글도 _로 바뀝니다
  assert.equal(api.classImagePath("c1", ""), "uploads/c1/stu1/42_file");
  assert.equal(api.classImagePath("c1", "x".repeat(100) + ".jpg").length, "uploads/c1/stu1/42_".length + 80);
  assert.equal(api.safeFileName("../../a.jpg"), ".._.._a.jpg");
  // 로그인 안 했으면 올리지 않습니다(옛 코드는 anon 폴더로 보냈음)
  assert.throws(() => load({ uid: null }).api.classImagePath("c1", "a.jpg"), (e) => e.code === "upload/no-user");
});

test("uploadImage: 반 폴더에 JPEG로 올리고, 다운로드 URL 대신 storage: 경로 표식을 돌려줍니다", async () => {
  const { api, calls } = load({ now: 5 });
  const progress = [];
  const ref = await api.uploadImage({ name: "photo.PNG" }, { classId: "c1", maxWidth: 1000, quality: 0.8, onProgress: (p) => progress.push(p) });
  assert.ok(calls.some((c) => c[0] === "toBlob" && c[1] === 1000 && c[2] === 500 && c[3] === "image/jpeg" && c[4] === 0.8));
  assert.ok(calls.some((c) => c[0] === "uploadBytes" && c[1] === "uploads/c1/stu1/5_photo.jpg" && c[3] === "image/jpeg"));
  assert.equal(ref, "storage:uploads/c1/stu1/5_photo.jpg");
  assert.ok(!calls.some((c) => c[0] === "getDownloadURL"), "토큰 붙은 다운로드 URL을 만들지 않습니다");
  assert.deepEqual(progress, [0.2, 1]);
});

test("uploadImage: 반 id가 없거나 이상하면 올리지 않고 NoClassError", async () => {
  for (const classId of [undefined, null, "", "a/b", "../c", "c 1", 42]) {
    const { api, calls } = load();
    await assert.rejects(api.uploadImage({ name: "a.jpg" }, { classId }), (e) => e.code === "upload/no-class", String(classId));
    assert.ok(!calls.some((c) => c[0] === "uploadBytes" || c[0] === "resumable" || c[0] === "ref"), String(classId));
  }
});

test("데모 모드는 반 id가 없어도 data URL(예전 그대로)", async () => {
  const { api } = load({ configured: false });
  assert.equal(await api.uploadImage({ name: "a.png" }), "data:image/jpeg;base64,DEMO");
});

test("uploadImage 기본값: 폭 1080·품질 0.72, 작은 그림은 확대하지 않음", async () => {
  const { api, calls, ctx } = load();
  ctx.createImageBitmap = async () => ({ width: 500, height: 400 });
  await api.uploadImage({ name: "s.jpg" }, { classId: "c1" });
  assert.ok(calls.some((c) => c[0] === "toBlob" && c[1] === 500 && c[2] === 400 && c[4] === 0.72));
});

test("1MB 이상 압축본은 resumable 업로드로 진행률을 보내고, 역시 경로 표식을 돌려줍니다", async () => {
  const { api, calls, ctx } = load({ now: 9 });
  ctx.blobSize = 1024 * 1024;
  const progress = [];
  const out = await api.uploadImage({ name: "big.jpg" }, { classId: "c1", onProgress: (p) => progress.push(p) });
  assert.ok(calls.some((c) => c[0] === "resumable" && c[1] === "uploads/c1/stu1/9_big.jpg"));
  assert.ok(!calls.some((c) => c[0] === "uploadBytes"));
  assert.equal(out, "storage:uploads/c1/stu1/9_big.jpg");
  assert.deepEqual(progress, [0.5]);
});

test("deleteUploadedFile: 옛 다운로드 URL과 반 폴더 경로 표식을 지우고, 나머지는 건너뜁니다", async () => {
  const { api, calls } = load();
  const dl = "https://firebasestorage.googleapis.com/v0/b/x/o/uploads%2Fstu1%2F1_a.jpg?alt=media&token=t";
  await api.deleteUploadedFile(dl);
  assert.deepEqual(calls, [["ref", dl], ["delete", dl]]);
  calls.length = 0;
  await api.deleteUploadedFile("storage:uploads/c1/stu1/1_a.jpg");
  assert.deepEqual(calls, [["ref", "uploads/c1/stu1/1_a.jpg"], ["delete", "uploads/c1/stu1/1_a.jpg"]]);
  calls.length = 0;
  for (const u of [null, "", 42, "data:image/jpeg;base64,x", "https://example.com/a.jpg", "storage:uploads/u/a.jpg",
    "storage:uploads/c/../a.jpg", "uploads/stu1/a.jpg"]) {
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

test("마인드맵 버그 조사: 체험 모드는 Storage에 아무것도 올리지 않습니다(버킷이 비는 이유)", async () => {
  const { api, calls } = load({ configured: false });
  assert.equal(api.isUploadDemoMode(), true);
  await api.uploadImage({ name: "a.png" }, { classId: "c1" });
  assert.ok(!calls.some(([k]) => k === "uploadBytes" || k === "resumable"));
  assert.equal(load().api.isUploadDemoMode(), false);
});

test("업로드 실패 문구 — 이유마다 학생에게 보이는 안내가 다릅니다", async () => {
  const { api } = load();
  await assert.rejects(api.uploadImage({ name: "a.png" }, {}), (e) => {
    assert.equal(api.uploadErrorMessage(e), "반을 고른 뒤에 그림을 올릴 수 있어요.");
    return true;
  });
  assert.match(api.uploadErrorMessage({ code: "storage/unauthorized" }), /권한이 없어요/);
  assert.match(api.uploadErrorMessage({ code: "storage/retry-limit-exceeded" }), /인터넷/);
  assert.match(api.uploadErrorMessage(new Error("x")), /이미지를 올리지 못했어요/);
});
