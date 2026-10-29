// Browser-only persistence for demo class metadata, including the teacher's
// opt-in setting. Production settings continue to live in Firestore.
export const DEMO_CLASSES_KEY = "bookbom.demo.classes.v1";
const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;

function metadata(value) {
  if (!value || typeof value.id !== "string" || !IDENTIFIER.test(value.id) || typeof value.name !== "string" || !value.name.trim()
      || value.name.length > 200 || typeof value.createdBy !== "string" || !value.createdBy || value.createdBy.length > 128
      || (value.readingEnabled !== undefined && typeof value.readingEnabled !== "boolean")
      || (value.archived !== undefined && typeof value.archived !== "boolean")) return null;
  const result = { id: value.id, name: value.name, createdBy: value.createdBy,
    readingEnabled: value.readingEnabled === true, archived: value.archived === true };
  if (typeof value.joinCode === "string" && value.joinCode.length <= 20) result.joinCode = value.joinCode;
  if (Number.isFinite(value.order)) result.order = value.order;
  for (const key of ["createdAt", "codeExpiresAt"]) {
    if (value[key] == null) continue;
    const date = new Date(value[key]);
    if (!Number.isFinite(date.getTime())) return null;
    result[key] = date;
  }
  return result;
}

export function readDemoClasses(storage) {
  try {
    if (!storage) return null;
    const value = JSON.parse(storage.getItem(DEMO_CLASSES_KEY));
    if (value?.version !== 1 || !Array.isArray(value.classes) || value.classes.length > 100) return null;
    const classes = value.classes.map(metadata);
    if (classes.some((c) => !c) || new Set(classes.map((c) => c.id)).size !== classes.length) return null;
    return classes;
  } catch { return null; }
}

export function writeDemoClasses(classes, storage) {
  const safe = Array.isArray(classes) ? classes.map(metadata) : null;
  if (!safe || safe.length > 100 || safe.some((c) => !c) || new Set(safe.map((c) => c.id)).size !== safe.length) {
    throw new Error("저장할 반 정보를 확인해 주세요.");
  }
  try {
    if (!storage) throw new Error("Storage unavailable");
    storage.setItem(DEMO_CLASSES_KEY, JSON.stringify({ version: 1, classes: safe }));
  } catch {
    throw new Error("브라우저에 반 설정을 저장하지 못했어요. 사이트 저장소를 허용한 뒤 다시 시도해 주세요.");
  }
}
