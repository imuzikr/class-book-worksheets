// =============================================================
// 빌드된 CSS 지문(md5) 확인 — CSS를 '옮기기만' 했는지 기계로 확인합니다.
// -------------------------------------------------------------
// next build 결과에서 페이지마다 <link rel="stylesheet"> 순서대로 CSS를
// **구분자 없이** 이어 붙여 md5·바이트 수를 냅니다. Next가 CSS를 몇 개의
// 묶음 파일로 나누는지는 바뀔 수 있어 비교하지 않습니다(내용만 비교).
//
//   node scripts/check-css-fingerprint.mjs            지금 값 출력(빌드 포함)
//   node scripts/check-css-fingerprint.mjs --save     기준으로 저장
//   node scripts/check-css-fingerprint.mjs --check    기준과 비교(SAME / DIFFERENT)
//   --no-build                                         이미 빌드된 .next를 그대로 사용
//
// 기준 파일: scripts/baseline/css-fingerprint.txt
// =============================================================
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const BASELINE = path.join(ROOT, "scripts/baseline/css-fingerprint.txt");
const PAGES = ["index", "books", "dashboard"];
const args = new Set(process.argv.slice(2));

if (!args.has("--no-build")) {
  execSync("npx next build", { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
}

const lines = [];
for (const page of PAGES) {
  const htmlPath = path.join(ROOT, ".next/server/app", `${page}.html`);
  if (!existsSync(htmlPath)) {
    lines.push(`${page}: (빌드 결과 없음)`);
    continue;
  }
  const html = readFileSync(htmlPath, "utf8");
  const hrefs = [...html.matchAll(/<link rel="stylesheet" href="\/_next\/([^"]+)"/g)].map((m) => m[1]);
  const css = hrefs.map((h) => readFileSync(path.join(ROOT, ".next", h.split("?")[0]), "utf8")).join("");
  const md5 = createHash("md5").update(css).digest("hex");
  lines.push(`${page}: bytes=${Buffer.byteLength(css)} md5=${md5}`);
}
const result = lines.join("\n") + "\n";
process.stdout.write(result);

if (args.has("--save")) {
  writeFileSync(BASELINE, result);
  console.log(`기준을 저장했습니다: ${path.relative(ROOT, BASELINE)}`);
} else if (args.has("--check")) {
  if (!existsSync(BASELINE)) {
    console.error("기준 파일이 없습니다. 먼저 --save로 만들어 주세요.");
    process.exit(2);
  }
  const same = readFileSync(BASELINE, "utf8") === result;
  console.log(same ? "SAME — 빌드된 CSS가 기준과 글자 하나까지 같습니다." : "DIFFERENT — 빌드된 CSS가 기준과 다릅니다.");
  process.exit(same ? 0 : 1);
}
