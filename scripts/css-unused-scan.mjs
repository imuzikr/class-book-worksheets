#!/usr/bin/env node
// CSS 정리 도우미 — 읽기만 하고 아무것도 고치지 않습니다.
//  1) app/styles/*.css의 클래스 중 소스(JS/JSX/TS/TSX/MJS/CJS)에서 0회 쓰인 것을 찾습니다.
//     - '-'도 이름의 일부로 봅니다: `xw`는 `xw-clue`에 걸리지 않습니다.
//     - 소스의 주석(// …, /* … */)은 빼고 셉니다: 주석 속 `xw*` 같은 글자는 사용이 아닙니다.
//     - 동적 이름(`rte-${variant}`, "is-" + x 같은 것)은 자동으로 알 수 없으니,
//       결과에 `name-${`·"name-" + 패턴과 겹치는 클래스를 [동적?]으로 표시합니다 — 사람이 확인하세요.
//  2) 안이 빈 @media / @supports / @container / @layer 블록을 찾습니다.
// 사용: node scripts/css-unused-scan.mjs [--empty-only]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib", "hooks", "tests", "scripts"];
const EXT = /\.(m?js|cjs|jsx|tsx?)$/;
const walk = (d, out = []) => {
  let ents = [];
  try { ents = readdirSync(d); } catch { return out; }
  for (const e of ents) {
    if (e === "node_modules" || e === ".next" || e === "baseline") continue;
    const p = join(d, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXT.test(e)) out.push(p);
  }
  return out;
};
const stripJsComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cssDir = "app/styles";
const cssFiles = readdirSync(cssDir).filter((f) => f.endsWith(".css")).sort();

// 2) 빈 at-rule 블록
const emptyRe = /@(media|supports|container|layer)\b[^{;]*\{\s*\}/g;
let emptyCount = 0;
for (const f of cssFiles) {
  const css = stripCssComments(readFileSync(join(cssDir, f), "utf8"));
  for (const m of css.matchAll(emptyRe)) {
    emptyCount++;
    console.log(`EMPTY ${f}: ${m[0].replace(/\s+/g, " ").slice(0, 80)}`);
  }
}
if (process.argv.includes("--empty-only")) {
  console.log(`빈 블록 ${emptyCount}개`);
  process.exit(0);
}

// 1) 0회 클래스
const src = ROOTS.flatMap((r) => walk(r)).map((p) => stripJsComments(readFileSync(p, "utf8")));
const all = src.join("\n");
const dyn = [
  ...all.matchAll(/([A-Za-z0-9_-]+-)\$\{[^}]*\}([A-Za-z0-9_-]*)/g),
].map((m) => [m[1], m[2]]);
for (const m of all.matchAll(/["']([A-Za-z0-9_-]+-)["']\s*\+/g)) dyn.push([m[1], ""]);

let unused = 0;
for (const f of cssFiles) {
  const css = stripCssComments(readFileSync(join(cssDir, f), "utf8")).replace(/\{[^{}]*\}/g, "{}");
  const names = [...new Set([...css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]))].sort();
  for (const c of names) {
    const re = new RegExp(`(?<![\\w-])${esc(c)}(?![\\w-])`);
    if (re.test(all)) continue;
    unused++;
    const d = dyn.find(([pre, suf]) => c.startsWith(pre) && c.endsWith(suf) && c.length > pre.length + suf.length);
    console.log(`UNUSED ${f} ${c}${d ? `  [동적? ${d[0]}\${…}${d[1]}]` : ""}`);
  }
}
console.log(`안 쓰는 클래스 ${unused}개 · 빈 블록 ${emptyCount}개`);
