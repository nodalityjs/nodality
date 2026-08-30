// The baseline: the same briefs, the same model, emitting React + Tailwind.
//
// Without this, "22/24" is a number with nothing to compare it to. The claim
// Chapter 7 actually makes is that a bounded specification is a BETTER target
// for a probabilistic generator than direct code generation — and that is a
// comparison, not an absolute.
//
// ON FAIRNESS. The Nodality solver is given `SKILL.md`, because that ships
// with the library and is what a developer would have. This solver is given no
// equivalent, because React needs none: it is one of the most heavily
// represented frameworks in any model's training data, and handing it a
// tutorial would be inventing a handicap. If the asymmetry favours anything it
// favours React, which is the right direction for a baseline to lean — a
// result that survives a biased-against-us comparison is worth more than one
// that needs a fair fight.
//
//   ANTHROPIC_API_KEY=... node evals/run.mjs --solver=react --quality

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, "..", ".cache");

const MODEL = process.env.EVAL_MODEL || "claude-sonnet-5";
export const name = `react+tailwind (${MODEL})`;

const SYSTEM = `You write React components styled with Tailwind CSS.

Reply with JSON and nothing else. No prose, no code fences.

Single-page briefs:  { "jsx": "export default function Page() { return (...) }" }
Multi-page briefs:   { "pages": { "<pageId>": { "jsx": "..." }, ... } }

The JSX must be a single self-contained module: one default-exported function
component, no imports, no external component libraries. Tailwind utility classes
are available. Anything the brief asks to be visible must be in the rendered
output.`;

const ask = async (brief) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const user = brief.pages
    ? `${brief.task}\n\nProduce these pages, by id: ${brief.pages.map((p) => p.id).join(", ")}.`
    : brief.task;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key,
               "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM,
                           messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return (body.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
};

const parseJson = (text) => {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = (fenced ? fenced[1] : text).trim();
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(raw.slice(a, b + 1));
  throw new Error("no JSON in the reply");
};

export async function solve(brief) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `react--${MODEL}--${brief.id}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));

  let answer;
  try { answer = parseJson(await ask(brief)); }
  catch (e) { answer = { jsx: "", _error: String(e.message).slice(0, 120) }; }
  writeFileSync(file, JSON.stringify(answer, null, 2));
  return answer;
}
