/**
 * Render a model-written React component to HTML, so the same four gates can
 * be applied to it.
 *
 * THE GATES, TRANSLATED. Each has to mean the same thing on both sides or the
 * comparison is theatre:
 *
 *   valid    Nodality: `validateNodes` accepts the spec.
 *            React:    the JSX parses. That is the analogous "would this be
 *                      rejected before anything ran" check, and it is the
 *                      strongest one available — React has no schema to check
 *                      a component against, which is itself the point Chapter 7
 *                      is making rather than a gap in this harness.
 *   renders  produces non-empty output without throwing. Same both sides.
 *   content  required strings present in the RENDERED output. Same both sides.
 *   quality  `check_page` at the same two viewports. Tailwind is loaded from
 *            its CDN, because a Tailwind page measured without Tailwind has no
 *            layout to fail — it would score a free pass.
 */
import { transformSync } from "@babel/core";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Strip what a single self-contained module cannot have. */
const clean = (jsx) => String(jsx || "")
  .replace(/^\s*import\s+[^;]+;?\s*$/gm, "")
  .replace(/^\s*export\s+default\s+/m, "const __Component = ")
  .replace(/^\s*export\s+/gm, "");

export function compileJSX(jsx) {
  const src = clean(jsx);
  const { code } = transformSync(src + "\n;return __Component;", {
    presets: [[require.resolve("@babel/preset-react"), { runtime: "classic" }]],
    parserOpts: { allowReturnOutsideFunction: true },
    configFile: false, babelrc: false,
  });
  return code;
}

/** true if it parses at all — the `valid` gate. */
export function parsesJSX(jsx) {
  try { compileJSX(jsx); return true; } catch { return false; }
}

export async function renderJSX(jsx) {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const code = compileJSX(jsx);
  // eslint-disable-next-line no-new-func
  const Component = new Function("React", code)(React);
  if (typeof Component !== "function") throw new Error("no default-exported component");
  return renderToStaticMarkup(React.createElement(Component));
}

/** A full document, so the CDN stylesheet is actually present when measured. */
export const withTailwind = (markup) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8">` +
  `<script src="https://cdn.tailwindcss.com"></script></head>` +
  `<body>${markup}</body></html>`;
