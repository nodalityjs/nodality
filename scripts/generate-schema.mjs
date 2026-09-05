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
    // A bare `options.` too, not just `this.options.`. Several components
    // name the argument of `set()` `options` rather than `obj` — image.js,
    // link.js, container.js, the two flex layouts — and every read in them
    // was invisible to this scan. The cost was concrete and in the
    // accessibility path: `alt` was missing from `img`, so the per-type
    // vocabulary an agent is pointed at by `npx nodality schema img` did not
    // mention the parameter that makes an image describable, while the
    // renderer read it perfectly well.
    for (const m of line.matchAll(/\boptions\.([a-zA-Z][a-zA-Z0-9]*)/g)) found.add(m[1]);
  }
  for (const junk of ["options", "el", "customOptions", "storage", "i"]) found.delete(junk);
  paramCache.set(file, found);
  return found;
}

// ── 6. descriptions from //@ annotations, wherever they live ─────────
//
// Keyed by the FILE the annotation was found in, not by parameter name alone.
// A flat name->text map with first-writer-wins looks harmless while every
// parameter name means one thing across the library, and stops being harmless
// the moment two components read the same name differently. `items` is that
// name: the picker documents it as "the choices, each a [value, text] pair",
// the picker's file was scanned first, and so every composite in the schema --
// cards, nav, sideNav, table, ulist -- advertised the picker's contract. The
// MCP `get_schema` tool serves this file, so the on-demand path that §7.4
// argues for was the path that lied.
//
// Params are already resolved per file by paramsOf(); only the descriptions
// were global. Now both are scoped the same way, and a `//@ <type>.<param>:`
// annotation overrides for one element type where the mapper, not the
// component, decides what the slot means.
const DESC_BY_FILE = new Map(), DEPR_BY_FILE = new Map();
const DESC_BY_TYPE = {};
// Names whose meaning depends on the element type, declared with `//@scoped
// <name>`. For these a description is never BORROWED from a file that does not
// contribute the parameter: `items` is documented once, in picker.js, and is
// correct there and wrong for every composite; `type` is documented once, in
// text-field.js, and means the input's type there and the element's type
// everywhere else. Neither is ambiguous by the usual test of two files
// disagreeing -- each has exactly one annotation -- which is why the test has
// to be declared rather than inferred.
const SCOPED = new Set();
// Every annotation, first writer winning, exactly as before this change. Names
// outside SCOPED still resolve through it, so a parameter documented once in a
// shared helper -- `mar`, `pad`, `transform` in animator.js -- keeps its
// description on every type that accepts it.
const DESC_GLOBAL = {}, DEPR_GLOBAL = {};
{
  const files = new Set(Object.values(IMPORTS)
    .map((rel) => join(ROOT, "lib", rel)).filter(existsSync));
  files.add(MAPPER);
  for (const f of files) {
    const desc = {}, depr = {};
    for (const line of readFileSync(f, "utf8").split("\n")) {
      let m = line.match(/\/\/@scoped\s+([a-zA-Z][a-zA-Z0-9]*)\s*$/);
      if (m) { SCOPED.add(m[1]); continue; }
      m = line.match(/\/\/@deprecated\s+([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
      if (m) { depr[m[1]] ??= m[2].trim(); DEPR_GLOBAL[m[1]] ??= m[2].trim(); continue; }
      // Qualified first: `//@ cards.items: …` binds to one type only.
      m = line.match(/\/\/@\s+([a-zA-Z][a-zA-Z0-9]*)\.([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
      if (m) { (DESC_BY_TYPE[m[1]] ??= {})[m[2]] ??= m[3].trim(); continue; }
      m = line.match(/\/\/@\s+([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
      if (m) { desc[m[1]] ??= m[2].trim(); DESC_GLOBAL[m[1]] ??= m[2].trim(); }
    }
    DESC_BY_FILE.set(f, desc); DEPR_BY_FILE.set(f, depr);
  }
}

/**
 * Look a parameter's annotation up along the chain that actually built the
 * type: the type's own qualified override, then the files of the components it
 * assembles, then the mapper. A parameter no component of this type documents
 * gets no description, which is the honest answer and strictly better than
 * another type's.
 */
function annotationFor(table, name, from, type, qualified) {
  if (qualified && DESC_BY_TYPE[type] && DESC_BY_TYPE[type][name]) {
    return DESC_BY_TYPE[type][name];
  }
  for (const f of from) {
    const got = table.get(f);
    if (got && got[name]) return got[name];
  }
  if (SCOPED.has(name)) return undefined;
  return (qualified ? DESC_GLOBAL : DEPR_GLOBAL)[name];
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
      // NOT through mapType. It is the dispatcher: a composite calls it to
      // build its CHILDREN, which are separate elements with their own types
      // and their own schema entries. Following it made every composite
      // inherit the whole library -- which is why `nav` advertised 157
      // parameters for a component that has no `set()` at all, and `cards`
      // 141. Those were its children's parameters, and its children's
      // children's, reported as its own.
      if (m[1] === "mapType") continue;
      if (seen.size < 12) out += "\n" + bodyOf(m[1], seen);
    }
    return out;
  };
  const body = method ? bodyOf(method) : "";
  const classes = body ? classesIn(body) : [];
  const files = classes.map(fileFor).filter(Boolean);

  // Which file contributed each parameter. The description lookup walks this
  // rather than the whole component list, so a parameter is documented by the
  // file that actually reads it and by nothing else. Scoping to the type's
  // components alone was not enough: `alt` is contributed to `img` by
  // image.js, and an annotation living in any other file would have been
  // dropped -- which cost `img.alt` its description on the first attempt at
  // this fix, the one parameter the comment in paramsOf() exists to protect.
  const params = new Set();
  const from = new Map();
  const contributed = (name, file) => {
    params.add(name);
    if (!from.has(name)) from.set(name, []);
    if (!from.get(name).includes(file)) from.get(name).push(file);
  };
  for (const f of files) for (const p of paramsOf(f)) contributed(p, f);

  // The mapper's OWN `el.<name>` reads. Scanning components alone missed
  // these, because a mapper often passes an element field as a constructor
  // argument rather than an option — `new Text(el.text)`. That left `text`
  // off every heading, which would have been the single worst error the
  // schema could contain: the most-used parameter of the most-used type.
  for (const m of body.matchAll(/\bel\.([a-zA-Z][a-zA-Z0-9]*)/g)) contributed(m[1], MAPPER);

  // Read off the element by every mapper regardless of component.
  for (const p of ["type", "id"]) contributed(p, MAPPER);

  // NOTE. A `settable` flag was attempted here and removed. The question it
  // was meant to answer -- which of these parameters an AUTHOR can set on the
  // element, as opposed to which the components READ -- is real and still
  // open, but no static rule tried here agreed with what rendering shows. The
  // heuristic marked 151 of nav's parameters settable for a component that
  // accepts none, and a schema that states a falsehood in a new field is worse
  // than one that states less. What IS fixed below is the largest part of the
  // over-claim: composites no longer inherit their children's vocabulary.
  const ok = files.length > 0;
  if (ok) resolved++;
  schema.types[type] = {
    resolved: ok,
    mapper: method,
    components: classes,
    params: [...params].sort().map((name) => {
      const where = from.get(name) || [];
      const description = annotationFor(DESC_BY_FILE, name, where, type, true);
      const deprecated = annotationFor(DEPR_BY_FILE, name, where, type, false);
      return {
        name,
        ...(description ? { description } : {}),
        ...(deprecated ? { deprecated } : {}),
      };
    }),
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
