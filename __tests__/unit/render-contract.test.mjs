// The render contract: every element type × every node family × two widths,
// rendered through Des as a page does (harness: ./conformance/harness.mjs).
// Written before swapping the render core, so the swap is measured, not hoped.
//
//   1. CONFORMANCE (ratchet). Whenever the validator approves a page, it must
//      render, and survive resizes, without throwing. The crashes that exist
//      today are listed in golden/conformance-known.json. That list must match
//      exactly: a NEW crash fails, and a crash that no longer happens fails too
//      until it is taken off the list, so the list only ever shrinks on purpose.
//   2. GOLDEN HTML. What each case renders, one file per type in golden/render/.
//      The core swap must keep it byte-identical; any intended difference is a
//      bug fix and gets its own commit regenerating that type's file.
//   3. LIFECYCLE TARGETS (todo). What the new core must achieve: resizes add
//      nothing, set() builds no second copy of anything, and a Des can be
//      destroyed back to zero. They run and print today's numbers without
//      failing the suite; each loses its `todo` when the core makes it pass.
//
// Regenerate goldens only on purpose: UPDATE_GOLDEN=1 node --test <this file>

import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allCases, renderCase, caseKey, elementTypes } from "./conformance/harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, "golden");
const KNOWN = path.join(GOLDEN, "conformance-known.json");
const RENDER_DIR = path.join(GOLDEN, "render");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const results = new Map();
before(async () => {
  for (const c of await allCases()) results.set(caseKey(c), { ...c, ...(await renderCase(c.type, c.family, c.width)) });
}, { timeout: 300000 });

const approved = () => [...results.values()].filter((r) => r.valid);
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

test("conformance: a page the validator approves renders and survives resizes", () => {
  const now = {};
  for (const r of approved()) {
    const why = r.error ? `render: ${r.error}` : r.resizeErrors.length ? `resize: ${r.resizeErrors[0]}` : null;
    if (why) now[caseKey(r)] = why;
  }
  if (UPDATE || !fs.existsSync(KNOWN)) {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(KNOWN, JSON.stringify(sorted(now), null, 2) + "\n");
  }
  const known = JSON.parse(fs.readFileSync(KNOWN, "utf8"));
  const added = Object.keys(now).filter((k) => !(k in known));
  const fixed = Object.keys(known).filter((k) => !(k in now));
  assert.deepEqual(added.map((k) => `${k} — ${now[k]}`), [], "NEW crashes on pages the validator approves");
  assert.deepEqual(fixed, [], "these no longer crash: remove them from golden/conformance-known.json");
});

test("golden: each type renders exactly the HTML it rendered before", async (t) => {
  fs.mkdirSync(RENDER_DIR, { recursive: true });
  for (const type of await elementTypes()) {
    await t.test(type, () => {
      const now = {};
      for (const r of approved().filter((x) => x.type === type)) {
        now[`${r.family}@${r.width}`] = r.error ? { error: r.error } : r.html;
      }
      const file = path.join(RENDER_DIR, `${type}.json`);
      if (UPDATE || !fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
      const golden = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.deepEqual(Object.keys(now).sort(), Object.keys(golden).sort(), `${type}: the set of cases changed`);
      for (const k of Object.keys(golden)) assert.deepEqual(now[k], golden[k], `${type} ${k} renders differently`);
    });
  }
});

// ── lifecycle targets ───────────────────────────────────────────────────

const offenders = (pick) => approved().filter((r) => !r.error).map((r) => [caseKey(r), pick(r)]).filter(([, v]) => v);
const summary = (list) => `${list.length} cases, e.g. ${list.slice(0, 4).map(([k, v]) => `${k} (${v})`).join(", ")}`;

test("lifecycle: a resize at the same width attaches nothing",
  { todo: "render core: rebuild only when the active ranges change; release what a rebuild replaces" }, () => {
    const list = offenders((r) => {
      const d = r.afterResize;
      return d.window || d.document || d.theme ? `+${d.window} win, +${d.document} doc, +${d.theme} theme on 3 resizes` : null;
    });
    assert.equal(list.length, 0, summary(list));
  });

test("lifecycle: set() builds no second copy of any component",
  { todo: "render core: mount the components the mapper built instead of re-running their code" }, () => {
    const list = offenders((r) => (r.duringSet.theme > 0 ? `${r.duringSet.theme} components built again in set()` : null));
    assert.equal(list.length, 0, summary(list));
  });

test("lifecycle: a Des can be destroyed back to zero",
  { todo: "render core: Des owns its components and destroy() releases them" }, () => {
    const any = approved().find((r) => !r.error);
    assert.ok(any.hasDestroy, "Des has no destroy()");
    const list = offenders((r) => {
      const d = r.afterDestroy;
      if (!d) return "no destroy()";
      if (d.error) return `destroy threw: ${d.error}`;
      return d.window || d.document || d.theme ? `${d.window} win, ${d.document} doc, ${d.theme} theme left` : null;
    });
    assert.equal(list.length, 0, summary(list));
  });
