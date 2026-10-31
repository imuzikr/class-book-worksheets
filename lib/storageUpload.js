// =============================================================
// 첨부 업로드 — Firebase Storage
// -------------------------------------------------------------
// 이미지/파일을 Storage에 올리고 다운로드 URL을 반환합니다.
// 그 URL만 Firestore 문서에 저장하므로 문서 용량(1MB 제한)을 아끼고
// 원본 화질을 유지할 수 있습니다.
//
// 데모 모드(Firebase 미설정) 또는 Storage 미초기화 시에는 기존처럼
// data URL(base64)을 반환해 동작이 끊기지 않게 합니다.
//
// 경로 설계
//  · 학생·교사 그림(uploadImage): uploads/{classId}/{uid}/{시각}_{파일명}
//    (이미지 보안 4단계) — 같은 반·담당 교사만 읽을 수 있는 반 폴더.
//    문서에는 다운로드 URL(토큰이 붙어 누구나 열 수 있음) 대신
//    "storage:uploads/…" 경로 표식을 저장하고, 화면은 SecureImage /
//    SecureHtml이 권한을 확인하며 내려받아 보여 줍니다.
//    반 id가 없으면 올리지 않고 오류를 냅니다(옛 개인 폴더로 새지 않게).
//  · 옛 개인 폴더 uploads/{uid}/…(다운로드 URL)는 규칙에 그대로 남아 있습니다
//    (교사 수업 자료용). 지금 앱 코드에는 그 경로로 올리는 곳이 없습니다.
// =============================================================
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { isFirebaseConfigured, storage } from "./firebase";
import { getCurrentUser } from "./user";
import { readImageAsDataUrl } from "./image";

function safeFileName(name) {
  return String(name || "file")
    .replace(/[^\w.\-]/g, "_")
    .slice(-80);
}

// 반 폴더 그림의 경로 표식: storage:uploads/{classId}/{uid}/{파일명}
const STORAGE_REF_RE = /^storage:uploads\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[\w-][\w.-]*$/;

// 반 id는 Firestore 문서 id(영문·숫자·_·-)만 받습니다 — 경로를 벗어나지 못하게.
export const CLASS_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export class NoClassError extends Error {
  constructor() {
    super("반을 고른 뒤에 그림을 올릴 수 있어요.");
    this.code = "upload/no-class";
  }
}

function classImagePath(classId, name) {
  const uid = getCurrentUser()?.uid;
  if (!uid) {
    const err = new Error("로그인한 뒤에 그림을 올릴 수 있어요.");
    err.code = "upload/no-user";
    throw err;
  }
  return `uploads/${classId}/${uid}/${Date.now()}_${safeFileName(name)}`;
}

// 이 크기 미만이면 단순 업로드(uploadBytes) 사용.
// resumable 업로드는 "세션 생성 → 업로드 → 완료" 왕복이 있어 작은 파일엔
// 오히려 느립니다. 압축된 이미지는 대부분 수백 KB라 이 경로로 더 빨라집니다.
const SIMPLE_UPLOAD_MAX = 1024 * 1024; // 1MB

// Blob 업로드 → 다운로드 URL. onProgress(0~1)로 진행률을 전달합니다.
//  · finish(ref) — 다 올린 뒤 돌려줄 값(기본: 다운로드 URL)
function putBlob(blobOrFile, path, onProgress, metadata, finish = getDownloadURL) {
  const r = ref(storage, path);
  const size = blobOrFile?.size ?? 0;

  // 작은 파일: 단일 요청(uploadBytes)으로 빠르게. 진행률은 시작/완료만 표시.
  if (size > 0 && size < SIMPLE_UPLOAD_MAX) {
    if (onProgress) onProgress(0.2);
    return uploadBytes(r, blobOrFile, metadata).then((snap) => {
      if (onProgress) onProgress(1);
      return finish(snap.ref);
    });
  }

  // 큰 파일: resumable + 실시간 진행률
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(r, blobOrFile, metadata);
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress && snap.totalBytes) {
          onProgress(snap.bytesTransferred / snap.totalBytes);
        }
      },
      reject,
      () => Promise.resolve(finish(task.snapshot.ref)).then(resolve, reject)
    );
  });
}

// 이미지를 압축(JPEG)해 업로드 용량을 줄입니다.
//  · createImageBitmap: 파일에서 바로 디코딩(base64 변환 생략, 하드웨어 가속)
//    → 지원 안 되는 구형 브라우저는 FileReader+Image로 폴백.
async function compressImageToBlob(file, maxWidth, quality) {
  const bitmap = await decodeImage(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close(); // ImageBitmap 메모리 해제
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 압축 실패"))),
      "image/jpeg",
      quality
    );
  });
}

// createImageBitmap 우선, 미지원 시 FileReader→Image 폴백.
function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => decodeImageLegacy(file));
  }
  return decodeImageLegacy(file);
}

function decodeImageLegacy(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// 이미지 업로드 → "storage:uploads/{classId}/{uid}/…" 경로 표식. (데모: 압축 data URL)
//  · classId가 꼭 있어야 합니다. 없거나 이상하면 NoClassError(올리지 않음).
//  · maxWidth 1080 / 품질 0.72 — 판서·화면 사진 화질은 유지하며 용량을 크게 절감.
export async function uploadImage(file, { classId, maxWidth = 1080, quality = 0.72, onProgress } = {}) {
  if (!isFirebaseConfigured || !storage) {
    return readImageAsDataUrl(file, 900);
  }
  if (typeof classId !== "string" || !CLASS_ID_RE.test(classId)) throw new NoClassError();
  const path = classImagePath(classId, (file.name || "image").replace(/\.\w+$/, "") + ".jpg");
  const blob = await compressImageToBlob(file, maxWidth, quality);
  return putBlob(blob, path, onProgress, { contentType: "image/jpeg" }, (r) => `storage:${r.fullPath ?? path}`);
}

// Storage에 올라간 파일 1개를 삭제합니다. data URL(데모/구버전)이거나
// 이미 지워진 파일이면 조용히 건너뜁니다 — 게시물 삭제 자체가 실패하면
// 안 되므로, 스토리지 정리는 최선을 다하되(best-effort) 실패해도 무시합니다.
export async function deleteUploadedFile(url) {
  if (!isFirebaseConfigured || !storage) return;
  if (typeof url !== "string") return;
  let target = null;
  if (url.startsWith("https://firebasestorage.googleapis.com/")) target = url;
  else if (STORAGE_REF_RE.test(url)) target = url.slice("storage:".length);
  if (!target) return;
  try {
    await deleteObject(ref(storage, target));
  } catch {
    /* 이미 삭제됨·권한 없음 등 — 무시 */
  }
}
