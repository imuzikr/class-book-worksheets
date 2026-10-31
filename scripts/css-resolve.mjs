// =============================================================
// CSS 변수 풀어 쓰기 — "색을 변수로 바꿨을 뿐 실제 값은 그대로인지" 확인용.
// -------------------------------------------------------------
// 원본 CSS(globals.css의 @import 순서대로 app/styles/ 49개 + 컴포넌트가 직접
// 불러오는 CSS)를 이어 붙인 뒤, 맨 바깥 `:root { … }`에 **딱 한 번만** 정의된 변수를 찾아,
// 모든 `var(--이름)`을 그 값으로 바꾸고 `:root`의 그 정의 줄은 지웁니다.
// 이렇게 풀어 쓴 결과가 같으면, 변수로 바꾸거나 새 변수 이름을 붙여도
// 화면에 쓰이는 실제 값은 하나도 안 바뀐 것입니다.
// 다른 곳(특정 선택자, @media 안)에서 다시 정의되는 변수는 위치에 따라 값이
// 달라질 수 있어 풀지 않고 그대로 둡니다.
// 마지막에 Next와 같은 계열의 압축기(cssnano-simple)로 줄여 띄어쓰기·색 표기
// 차이(예: 0.12 / .12)를 없앤 뒤 md5를 냅니다. 빌드 결과를 쓰지 않는 까닭:
// Next는 CSS를 크기에 따라 여러 묶음으로 나누는데, 글자 수가 조금만 바뀌어도
// 묶음 경계가 옮겨져 압축 결과(규칙 합치기)가 달라집니다 — 화면과 무관한 차이.
// =============================================================
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// 맨 바깥 블록을 [선택자, 시작, 본문시작, 끝] 으로 나눕니다(문자열·주석 고려).
function topLevelBlocks(css) {
  const out = [];
  let depth = 0, selStart = 0, bodyStart = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") { i = skipString(css, i); continue; }
    if (c === "/" && css[i + 1] === "*") { i = css.indexOf("*/", i + 2) + 1; continue; }
    if (c === "{") { if (depth === 0) bodyStart = i + 1; depth++; }
    else if (c === "}") {
      depth--;
      if (depth === 0) { out.push({ sel: css.slice(selStart, bodyStart - 1).trim(), start: selStart, bodyStart, end: i }); selStart = i + 1; }
    } else if (c === ";" && depth === 0) selStart = i + 1;
  }
  return out;
}
function skipString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) { if (s[i] === "\\") i++; else if (s[i] === q) return i; }
  return i;
}
// 괄호·문자열 바깥의 ';'로 선언을 나눕니다.
function splitDecls(body) {
  const parts = []; let depth = 0, last = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'") { i = skipString(body, i); continue; }
    if (c === "(") depth++; else if (c === ")") depth--;
    else if (c === ";" && depth === 0) { parts.push(body.slice(last, i)); last = i + 1; }
  }
  parts.push(body.slice(last));
  return parts.filter((p) => p.trim());
}
function substitute(text, map) {
  let out = "", i = 0;
  while (i < text.length) {
    const j = text.indexOf("var(", i);
    if (j < 0) { out += text.slice(i); break; }
    // 짝이 맞는 닫는 괄호 찾기
    let depth = 0, k = j + 3;
    for (; k < text.length; k++) { if (text[k] === "(") depth++; else if (text[k] === ")" && --depth === 0) break; }
    const inner = text.slice(j + 4, k);
    const comma = inner.indexOf(",");
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    out += text.slice(i, j);
    out += name in map ? map[name] : "var(" + substitute(inner, map) + ")";
    i = k + 1;
  }
  return out;
}

export function resolveCss(css) {
  const counts = {};
  for (const m of css.matchAll(/(?<![\w-])(--[\w-]+)\s*:/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  const roots = topLevelBlocks(css).filter((b) => b.sel === ":root");
  const map = {};
  for (const b of roots) for (const d of splitDecls(css.slice(b.bodyStart, b.end))) {
    const m = d.match(/^\s*(--[\w-]+)\s*:([\s\S]*)$/);
    if (m && counts[m[1]] === 1) map[m[1]] = m[2].trim();
  }
  for (let n = 0; n < 20; n++) for (const k in map) map[k] = substitute(map[k], map);
  // :root 안의 풀린 정의를 지우고(블록이 비면 통째로), 나머지에 변수를 대입
  let out = "", last = 0;
  for (const b of roots) {
    const kept = splitDecls(css.slice(b.bodyStart, b.end)).filter((d) => {
      const m = d.match(/^\s*(--[\w-]+)\s*:/); return !(m && m[1] in map);
    });
    out += css.slice(last, b.start);
    if (kept.length) out += ":root{" + kept.join(";") + "}";
    last = b.end + 1;
  }
  out += css.slice(last);
  return substitute(out, map);
}

// globals.css의 @import 순서 + 컴포넌트 CSS(경로 순)를 풀어 쓰고 압축한 지문 한 줄
export async function resolvedSourceLine(root) {
  const require = createRequire(path.join(root, "package.json"));
  const postcss = require("postcss");
  const nano = require("next/dist/compiled/cssnano-simple");
  const globals = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const files = [...globals.matchAll(/@import\s+"([^"]+)"/g)].map((m) => path.join(root, "app", m[1]));
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".css") ? [path.join(d, e.name)] : []);
  files.push(...walk(path.join(root, "components")).sort());
  const src = files.map((f) => readFileSync(f, "utf8")).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = (await postcss([nano]).process(resolveCss(src), { from: undefined })).css;
  const md5 = createHash("md5").update(out).digest("hex");
  return `resolved(${files.length} files): bytes=${Buffer.byteLength(out)} md5=${md5}`;
}
