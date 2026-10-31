import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCss } from "../../scripts/css-resolve.mjs";

test("값이 같은 색을 변수로 바꿔도 풀어 쓴 결과는 같다", () => {
  const before = ":root{--border:#e8e5dd}.a{color:#e8e5dd}";
  const after = ":root{--border:#e8e5dd}.a{color:var(--border)}";
  assert.equal(resolveCss(before), resolveCss(after));
});

test("새 변수 정의를 더하고 이름만 붙여도 같다", () => {
  const before = ":root{--a:1px}.a{color:#e8f7ed;margin:var(--a)}";
  const after = ":root{--a:1px;--green-50:#e8f7ed}.a{color:var(--green-50);margin:var(--a)}";
  assert.equal(resolveCss(before), resolveCss(after));
});

test("값이 다르면 다르게 나온다", () => {
  assert.notEqual(resolveCss(":root{--b:#000}.a{color:var(--b)}"), resolveCss(":root{--b:#000}.a{color:#111}"));
});

test("다른 곳에서 다시 정의되는 변수는 풀지 않는다", () => {
  const css = ":root{--c:red}.x{--c:blue}.a{color:var(--c)}";
  assert.equal(resolveCss(css), css);
});

test("겹친 변수와 기본값(fallback)도 푼다", () => {
  assert.equal(resolveCss(":root{--a:#111;--b:var(--a)}.a{color:var(--b, red)}"), ".a{color:#111}");
});
