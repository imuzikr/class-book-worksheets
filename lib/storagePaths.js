// =============================================================
// 기록 안에 적힌 그림 파일 경로 찾기 — 반 완전 삭제 · 학생 탈퇴 때 함께 지울 파일
// -------------------------------------------------------------
// 그림은 Storage의 반 폴더(uploads/{classId}/{uid}/{파일})에 올리고, 문서에는
// "storage:uploads/…" 경로를 적습니다(서식 글 안의 <img src>, 마인드맵 노드의 image,
// 해시태그 대표 이미지 …). Storage 목록(list)은 규칙이 막아 두어 폴더를 훑을 수
// 없으므로, **지우기 전에 읽은 문서들에서 경로를 모아** 지웁니다. 옛 다운로드 주소
// (https://firebasestorage.googleapis.com/v0/b/…/o/…)도 경로로 풀어 함께 셉니다.
// 순수 함수 — 시험 tests/unit/storagePaths.test.mjs.
// =============================================================
const SEGMENT = "[A-Za-z0-9_-]+";
const FILE = "[\\w-][\\w.-]*";
const REF_RE = new RegExp(`storage:(uploads/${SEGMENT}/${SEGMENT}/${FILE})`, "g");
const URL_RE = /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/\s"'<>]+\/o\/([^?\s"'<>)#]+)/g;
const PATH_RE = new RegExp(`^uploads/${SEGMENT}/${SEGMENT}/${FILE}$`);

function scanText(text, out) {
  for (const m of text.matchAll(REF_RE)) out.add(m[1]);
  for (const m of text.matchAll(URL_RE)) {
    let path;
    try { path = decodeURIComponent(m[1]); } catch { continue; }
    if (PATH_RE.test(path)) out.add(path);
  }
}

/** 값(문서 데이터 · 배열 · 글) 안의 모든 그림 경로를 out(Set)에 모읍니다. */
export function collectStoragePaths(value, out = new Set(), depth = 0) {
  if (value == null || depth > 12) return out;
  if (typeof value === "string") { if (value.includes("uploads")) scanText(value, out); return out; }
  if (Array.isArray(value)) { for (const v of value) collectStoragePaths(v, out, depth + 1); return out; }
  if (typeof value === "object") {
    // Firestore Timestamp · DocumentReference 같은 것은 건너뜁니다
    if (typeof value.toDate === "function" || typeof value.path === "string" && typeof value.id === "string") return out;
    for (const v of Object.values(value)) collectStoragePaths(v, out, depth + 1);
  }
  return out;
}

/** 그 반 폴더의 파일만(반 완전 삭제). */
export function pathsInClass(paths, classId) {
  return [...paths].filter((p) => p.split("/")[1] === classId);
}

/** 그 학생 폴더의 파일만(학생 탈퇴) — classIds가 있으면 그 반들 안에서만. */
export function pathsOfStudent(paths, uid, classIds = null) {
  const allowed = classIds ? new Set(classIds) : null;
  return [...paths].filter((p) => {
    const [, cId, owner] = p.split("/");
    return owner === uid && (!allowed || allowed.has(cId));
  });
}
