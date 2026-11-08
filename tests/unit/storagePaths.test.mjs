import { test } from "node:test";
import assert from "node:assert/strict";
import { collectStoragePaths, pathsInClass, pathsOfStudent } from "@/lib/storagePaths";

test("기록 안의 그림 경로 — 서식 글 · 중첩 값 · 옛 다운로드 주소", () => {
  const doc = {
    html: '<p>글</p><img src="storage:uploads/cA/stu1/a1.webp"><img src="storage:uploads/cA/stu2/b.png">',
    answers: { nodes: [{ text: "가", image: "storage:uploads/cA/stu1/node.jpg" }, { text: "나" }] },
    image: { url: "https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/uploads%2FcB%2Fstu1%2Fold.png?alt=media&token=t" },
    when: { toDate: () => new Date() },
    note: "uploads/cA/stu1/plain.png 는 표시 없는 글자라 안 셈",
  };
  const paths = collectStoragePaths(doc);
  assert.deepEqual([...paths].sort(), ["uploads/cA/stu1/a1.webp", "uploads/cA/stu1/node.jpg", "uploads/cA/stu2/b.png", "uploads/cB/stu1/old.png"]);
  assert.deepEqual(pathsInClass(paths, "cA").sort(), ["uploads/cA/stu1/a1.webp", "uploads/cA/stu1/node.jpg", "uploads/cA/stu2/b.png"]);
  assert.deepEqual(pathsOfStudent(paths, "stu1").sort(), ["uploads/cA/stu1/a1.webp", "uploads/cA/stu1/node.jpg", "uploads/cB/stu1/old.png"]);
  assert.deepEqual(pathsOfStudent(paths, "stu1", ["cA"]).sort(), ["uploads/cA/stu1/a1.webp", "uploads/cA/stu1/node.jpg"]);
  assert.equal(collectStoragePaths("storage:uploads/../x/y").size, 0);
  assert.equal(collectStoragePaths(null).size, 0);
});
