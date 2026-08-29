// A real model, given what a real agent is given.
//
// Tier 2's whole rationale was: "given a brief, does the agent produce a
// correct page, first try?" Every number before this one was produced by the
// hand-written `reference` solver, which measures whether the FORMAT can
// express these pages. It says nothing about whether a model DOES. This is
// the solver that asks the actual question.
//
//   ANTHROPIC_API_KEY=... node evals/run.mjs --solver=model --quality
//
// Fairness matters more than convenience here, so the system prompt is built
// from the artifacts that actually ship — `skills/nodality/SKILL.md` verbatim,
// the live `ELEMENT_TYPES`, and the content-slot table the validator uses.
// Inventing a better prompt than the one we publish would measure a library
// nobody has.
//
// Responses are cached under evals/.cache so a re-run costs nothing and the
// numbers are reproducible. Delete the directory to re-ask.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const CACHE = path.join(HERE, "..", ".cache");

const MODEL = process.env.EVAL_MODEL || "claude-sonnet-5";
export const name = `model (${MODEL})`;

const { ELEMENT_TYPES } = await import(path.join(ROOT, "lib", "element-mapper.js"));
const { CONTENT_SLOT } = await import(path.join(ROOT, "lib", "validate-nodes.js"));
const SKILL = readFileSync(path.join(ROOT, "skills", "nodality", "SKILL.md"), "utf8");

const SYSTEM = `You author Nodality pages as data. Below is the skill that ships
with the library, followed by the live vocabulary.

${SKILL}

--- LIVE VOCABULARY ---

Element types: ${ELEMENT_TYPES.join(", ")}

Which key carries a composite's content:
${Object.entries(CONTENT_SLOT).map(([t, k]) => `  ${t}: ${k}`).join("\n")}
Types not listed take neither.

--- OUTPUT CONTRACT ---

Reply with JSON and nothing else. No prose, no code fences.

Single-page briefs:      { "elements": [ ... ], "nodes": [] }
Multi-page briefs:       { "defs": { ... }, "pages": { "<pageId>": { "elements": [ ... ] }, ... } }

For a multi-page brief, put shared chrome in "defs" once and reference it from
each page as { "$ref": "<name>" }. Keys written beside a $ref override the
definition.`;

const ask = async (brief) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const user = brief.pages
    ? `${brief.task}\n\nProduce these pages, by id: ${brief.pages.map((p) => p.id).join(", ")}.`
    : brief.task;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return (body.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
};

/** Models sometimes wrap JSON in a fence despite being asked not to. */
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
  const file = path.join(CACHE, `${MODEL}--${brief.id}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));

  let answer;
  try {
    answer = parseJson(await ask(brief));
  } catch (e) {
    // A refusal, a timeout or unparseable output is an ANSWER, and a failing
    // one. Returning an empty spec scores it through the same gates as any
    // other wrong answer rather than crashing the run and losing the result.
    answer = { elements: [], _error: String(e.message).slice(0, 120) };
  }
  writeFileSync(file, JSON.stringify(answer, null, 2));
  return answer;
}
