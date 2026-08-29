#!/usr/bin/env node
/**
 * Stage 2 of AGENTIC-FIRST-PLAN.md — the machine-readable schema, DERIVED.
 *
 * A schema maintained beside the code drifts from it; the op registry did
 * exactly that until 1.2.8, when `copy` turned out to read a parameter it
 * never declared. So nothing here is hand-written. Every entry is recovered
 * from the source that will actually run:
 *
 *   types        ELEMENT_TYPES in lib/element-mapper.js — the same list the
 *                validator checks against, so the two cannot disagree.
 *   dispatch     the `obj.el.type === "x"` chain in mapType(), giving the
 *                mapper method for each type.
 *   components   the `new X(` calls inside that method, resolved to files
 *                through element-mapper's own import statements.
 *   parameters   `obj.<name>` reads in those files, comments stripped —
 *                the technique already proven in the docs repo's
 *                audit-options.mjs, which exists because a fifth of the
 *                `obj.*` references in these files are commented out.
 *   descriptions `//@ name: text` annotations, and `//@deprecated name: why`.
 *
 * What it will NOT do is guess. A type whose component cannot be resolved is
 * emitted with `"resolved": false` and an empty parameter list rather than a
 * plausible-looking one, because a schema that is confidently wrong is worse
 * for an agent than a schema that admits a gap: the agent trusts it either
 * way.
 *
 *     node scripts/generate-schema.mjs              # write schema.json
 *     node scripts/generate-schema.mjs --check      # exit 1 if it would change
 *     node scripts/generate-schema.mjs --type cards # print one type
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MAPPER = join(ROOT, "lib", "element-mapper.js");
const OUT = join(ROOT, "schema.json");

const src = readFileSync(MAPPER, "utf8");

/** Strip comments line-wise, the way audit-options.mjs does. */
function liveLines(text) {
  const out = [];
  let inBlock = false;
  for (let line of text.split("\n")) {
    const t = line.trim();
    if (inBlock) { if (t.includes("*/")) inBlock = false; continue; }
    if (t.startsWith("/*")) { if (!t.includes("*/")) inBlock = true; continue; }
    if (t.startsWith("//") || t.startsWith("*")) continue;
    out.push(line.replace(/\/\/.*$/, ""));
  }
  return out;
}

// ── 1. the authoritative type list ───────────────────────────────────
const typesBlock = src.slice(src.indexOf("const ELEMENT_TYPES = ["));
const TYPES = [...typesBlock.slice(0, typesBlock.indexOf("]")).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]);
if (!TYPES.length) { console.error("could not read ELEMENT_TYPES"); process.exit(1); }

// ── 2. type -> mapper method, from the dispatch chain ────────────────
const mapperLive = liveLines(src).join("\n");
const DISPATCH = {};
{
  // `obj.el.type === "x"` … `return this.mapY(obj)` — take the first return
  // after each comparison, which is how the chain is written throughout.
  const re = /obj\.el\.type\s*===\s*"([a-zA-Z0-9]+)"[\s\S]{0,200}?return\s+this\.([a-zA-Z0-9_]+)\(/g;
  let m;
  while ((m = re.exec(mapperLive))) if (!DISPATCH[m[1]]) DISPATCH[m[1]] = m[2];

  // The text family is not dispatched by comparison but by membership:
  //   let headings = ["h1", … , "p"]; if (headings.includes(obj.el.type))
  // Missing this left the seven most-used types unresolved, which would
  // have been the schema's largest and least excusable hole.
  const grp = /let\s+(\w+)\s*=\s*\[([^\]]+)\][\s\S]{0,120}?\1\.includes\(obj\.el\.type\)[\s\S]{0,120}?return\s+this\.([a-zA-Z0-9_]+)\(/g;
  while ((m = grp.exec(mapperLive))) {
    const method = m[3];
    for (const t of [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])) {
      if (!DISPATCH[t]) DISPATCH[t] = method;
    }
  }
}

// ── 3. mapper method -> component classes it constructs ──────────────
function methodBody(name) {
  const at = mapperLive.indexOf(`static ${name}(`);
  if (at < 0) return "";
  // Balance braces from the method's opening brace.
  let i = mapperLive.indexOf("{", at), depth = 0;
  for (let j = i; j < mapperLive.length; j++) {
    if (mapperLive[j] === "{") depth++;
    else if (mapperLive[j] === "}") { depth--; if (!depth) return mapperLive.slice(i, j); }
  }
  return mapperLive.slice(i);
}
const classesIn = (body) =>
  [...new Set([...body.matchAll(/new\s+([A-Z][A-Za-z0-9]*)\s*\(/g)].map((m) => m[1]))];

// ── 4. class -> file, from element-mapper's own imports ──────────────
const IMPORTS = {};
for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
  const file = m[2];
  for (const raw of m[1].split(",")) {
    const name = raw.trim().split(/\s+as\s+/).pop().trim();
    if (name) IMPORTS[name] = file;
  }
}
function fileFor(cls) {
  const rel = IMPORTS[cls];
  if (!rel) return null;
  const p = join(ROOT, "lib", rel);
  return existsSync(p) ? p : null;
}

// ── 5. parameters a file actually reads ──────────────────────────────
const paramCache = new Map();
function paramsOf(file) {
  if (paramCache.has(file)) return paramCache.get(file);
  const text = readFileSync(file, "utf8");
  const found = new Set();
  for (const line of liveLines(text)) {
    for (const m of line.matchAll(/\bobj\.([a-zA-Z][a-zA-Z0-9]*)/g)) found.add(m[1]);
    for (const m of line.matchAll(/\bthis\.options\.([a-zA-Z][a-zA-Z0-9]*)/g)) found.add(m[1]);
  }
  for (const junk of ["options", "el", "customOptions", "storage", "i"]) found.delete(junk);
  paramCache.set(file, found);
  return found;
}

// ── 6. descriptions from //@ annotations, wherever they live ─────────
const DESCRIPTIONS = {}, DEPRECATED = {};
{
  const files = new Set(Object.values(IMPORTS)
    .map((rel) => join(ROOT, "lib", rel)).filter(existsSync));
  files.add(MAPPER);
  for (const f of files) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      let m = line.match(/\/\/@deprecated\s+([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
      if (m) { DEPRECATED[m[1]] ??= m[2].trim(); continue; }
      m = line.match(/\/\/@\s+([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
      if (m) DESCRIPTIONS[m[1]] ??= m[2].trim();
    }
  }
}

// ── 7. assemble ──────────────────────────────────────────────────────
const schema = { generated: "scripts/generate-schema.mjs", types: {} };
let resolved = 0;
for (const type of TYPES) {
  const method = DISPATCH[type] || null;
  // A mapper's helpers are part of the mapper: `mapGrid` reads `items` only
  // through `gridItemsSource`, so scanning the dispatched method alone
  // reported that `cards` has no content slot. Follow `this.x(` one level.
  const bodyOf = (name, seen = new Set()) => {
    if (!name || seen.has(name)) return "";
    seen.add(name);
    const b = methodBody(name);
    let out = b;
    for (const m of b.matchAll(/\bthis\.([a-zA-Z][a-zA-Z0-9_]*)\s*\(/g)) {
      if (seen.size < 12) out += "\n" + bodyOf(m[1], seen);
    }
    return out;
  };
  const body = method ? bodyOf(method) : "";
  const classes = body ? classesIn(body) : [];
  const files = classes.map(fileFor).filter(Boolean);

  const params = new Set();
  for (const f of files) for (const p of paramsOf(f)) params.add(p);

  // The mapper's OWN `el.<name>` reads. Scanning components alone missed
  // these, because a mapper often passes an element field as a constructor
  // argument rather than an option — `new Text(el.text)`. That left `text`
  // off every heading, which would have been the single worst error the
  // schema could contain: the most-used parameter of the most-used type.
  for (const m of body.matchAll(/\bel\.([a-zA-Z][a-zA-Z0-9]*)/g)) params.add(m[1]);

  // Read off the element by every mapper regardless of component.
  for (const p of ["type", "id"]) params.add(p);

  const ok = files.length > 0;
  if (ok) resolved++;
  schema.types[type] = {
    resolved: ok,
    mapper: method,
    components: classes,
    params: [...params].sort().map((name) => ({
      name,
      ...(DESCRIPTIONS[name] ? { description: DESCRIPTIONS[name] } : {}),
      ...(DEPRECATED[name] ? { deprecated: DEPRECATED[name] } : {}),
    })),
  };
}
schema.summary = { types: TYPES.length, resolved, unresolved: TYPES.length - resolved };

// ── 8. modes ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const json = JSON.stringify(schema, null, 2) + "\n";

if (args.includes("--type")) {
  const t = args[args.indexOf("--type") + 1];
  const entry = schema.types[t];
  if (!entry) { console.error(`unknown type "${t}"`); process.exit(1); }
  console.log(JSON.stringify({ type: t, ...entry }, null, 2));
  process.exit(0);
}

if (args.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== json) {
    console.error("schema.json is out of date — run: node scripts/generate-schema.mjs");
    process.exit(1);
  }
  console.log(`schema.json current (${resolved}/${TYPES.length} types resolved)`);
  process.exit(0);
}

if (args.includes("--stdout")) { process.stdout.write(json); process.exit(0); }

// The validator's vocabulary, emitted as a module so it ships in the bundle.
//
// The UNION of every type's parameters, not a per-type table. Per-type would
// be 20 kB in a zero-dependency bundle, and — worse — it would produce false
// positives: several mappers spread the whole element (`...el`) into their
// component, so they genuinely accept names no static scan can enumerate.
// Rejecting one of those would stop `preview` from rendering a page that
// works, which 1.2.7 established is the costlier direction to be wrong in.
//
// The union is used for NEAR-MISS detection only: `itms` is reported because
// it is one edit from `items`, while an unrecognised name with no close
// match is left alone. Per-type vocabularies are served on demand by
// `npx nodality schema <type>` — which is the point of Stage 2's property 2,
// schema on demand rather than schema in context.
{
  const union = new Set();
  for (const t of Object.values(schema.types)) for (const p of t.params) union.add(p.name);
  const names = [...union].sort();
  const mod = `// GENERATED by scripts/generate-schema.mjs — do not edit.
// Every parameter name any element type reads, recovered from source.
// Used for near-miss typo detection in validate-nodes.js. A drift test
// regenerates this and fails if it differs, so it cannot rot silently.
export const ELEMENT_PARAM_NAMES = ${JSON.stringify(names)};
`;
  writeFileSync(join(ROOT, "lib", "element-params.generated.js"), mod);
}

writeFileSync(OUT, json);
console.log(`schema.json written: ${TYPES.length} types, ${resolved} resolved, ` +
            `${TYPES.length - resolved} unresolved`);
