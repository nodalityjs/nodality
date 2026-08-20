---
name: nodality
description: Build or edit a page with the Nodality library – declarative static UI from two arrays (elements + nodes), GPU raster effects, morph navigation graphs, prerendering, and agent surfaces. Use when the user asks to create or change a Nodality page, mentions (E, N), Des(), morph/raster/agent-surface nodes, works with imperative Nodality code (new Text(), new Link(), .render()), or asks to draft a landing page with Nodality.
---

# Working with Nodality

Nodality builds static, content-shaped sites from a pair of plain-data
arrays. You do not write components, CSS files, or DOM code. You write
data, and the library compiles it.

```js
import { Des } from "nodality";

const elements = [                       // E – what exists
  { id: "hero", type: "h1", text: "Hello" },
];

const nodes = [                          // N – what is done to it
  { op: { name: "gradient", gradient: "linear-gradient(90deg, #1d6fe0, #7fd1ff)" },
    target: ["hero"] },
  { op: "dither", target: ["hero"], levels: 6, size: 2 },
];

new Des().nodes(nodes).add(elements).set({ mount: "#mount" });
```

Nothing in `elements` names an effect; nothing in `nodes` names a
component. The two arrays meet only through `target`, `from`, and `to`,
each naming an element `id` (bare `"hero"` or selector form `"#hero"`).
Keep that separation absolute: if you find yourself putting styling in E
or content in N, you are writing it wrong.

## The workflow – always in this order

The `nodality` MCP server is the source of truth for the vocabulary.
This skill deliberately contains **no op tables and no element-type
lists**: those come from the live registry via the MCP, so they cannot
drift. If the MCP is not configured, add it:

```json
{ "mcpServers": { "nodality": { "command": "npx", "args": ["nodality", "mcp"] } } }
```

1. **`list_ops` first.** Never guess an op name, a parameter, an easing
   name, a transition preset, or an element type. One call returns all
   of them as data.
2. **Author the pair.** E top-down (page structure), then N (what
   happens to it). Small pages fit in one file.
3. **`validate_nodes` before showing the user anything.** Pass both
   `nodes` AND `elements` – with elements included, targets are checked
   against real ids and E itself is validated. The report never throws;
   repair from its `did-you-mean` suggestions and re-validate until
   clean.
4. **`preview` to render.** It writes a self-contained HTML file through
   the jsdom prerenderer. Know the boundary: the file is prerendered DOM
   and morph scaffolding only and carries no runtime, so raster effects
   and transitions will not run from it. To see them, put the pair in a
   real page with the library loaded (the CDN snippet is enough).

Skipping step 3 is the classic failure: a misspelled op renders
*nothing* rather than erroring, so the page looks plausible and is
silently missing its effects.

## The four node families

Told apart by the shape of `op`:

| Family | Shape | Example |
|---|---|---|
| Design | `op` is an object | `{ op: { name: "shadow" }, target: ["card"] }` |
| Raster | `op` is a string | `{ op: "dither", target: ["hero"], levels: 6 }` |
| Morph | `op: "morph"` | one transition, or a whole graph via `chain` |
| Agent surface | `op: "agent-surface"` | exposes the page to AI agents as tools |

Rules that are not obvious from the schema:

- **Raster ops compose.** Several raster nodes aimed at the same element
  become ONE shader pass, applied in array order. Order matters; do not
  "fix" a wrong-looking result by duplicating nodes.
- **A morph `chain` is a list of EDGES, not keyframes.** Edge two is
  reachable *from* the state edge one lands on – a landed view becomes a
  source. Node-level settings (`effect`, `duration`) are defaults each
  edge may override. `chain` wins outright: node-level `from`/`to` are
  ignored beside it. `back: true` unwinds the path the user actually
  took, not a lookup of a reverse edge.
- **`agent-surface` is opt-in and allow-listed.** No form is exposed
  unless named in `forms`. Do not add it unless the user asks for an
  agent-operable page.

A complete navigation graph is one node:

```js
{ op: "morph", effect: "t-vhs", duration: 620, back: true,
  chain: [
    { from: "home",   to: { Work: "work", Contact: "contact" } },
    { from: "work",   to: { Aurora: "aurora" },   effect: "t-split" },
    { from: "aurora", to: { Contact: "contact" }, effect: "t-bloom" },
  ] }
```

## House rules – violations are bugs even when the page looks right

- **Never touch the DOM to style or fix a Nodality page.** No
  `el.style.*`, no `createElement` in page code, no post-render DOM
  patching. If the library cannot express something, the fix is a custom
  element/op (extend the library), or the `keySet` option on an element
  (`keySet: { key, value }`) for one custom CSS property. Note the
  spelling: `keySet`, capital S.
- **Elements take `text`, never `value`.**
- **Every element that a node targets needs an `id`.** Short and stable
  (`"hero"`, `"topnav"`); ids are the joint between the two arrays and
  appear in generated code.
- **Do not invent options.** An unknown option is silently ignored, not
  an error. If `list_ops` does not name it, it does not exist. And know
  where options live: raster-op options sit on the node (`levels: 6`),
  but design-node options sit INSIDE the `op` object
  (`op: { name: "gradient", gradient: "linear-gradient(...)" }`). As of
  1.2.5 the validator checks raster options, targets and element types
  but NOT design-node options, so a misplaced design option fails
  silently – the gradient renders its target invisible, for instance.
- **Codegen:** the on-page panel showing the imperative equivalent of
  the pair is on by default; pass `code: false` (and `elements: false`)
  to `.set()` to hide it on a production page. From the CLI,
  `npx nodality compile src/<file>.js` emits the same code as a
  companion file without rendering anything.

## The imperative layer – direct instantiation

The component classes behind E are public API, exported from the package
root. An agent can instantiate them directly instead of writing the
pair:

```js
import { Text, Link, FlexRow } from "nodality";

new Text("Hello").set({ fluidc: "S3", color: "#f97316" }).render("#mount");
```

This is exactly the code the codegen panel emits, so the two forms are
equivalent and interchangeable: `.set()` returns the instance, and
`.render(selector)` mounts it. Reach for it when adding a few elements
to an existing page or adapting generated code; prefer the (E, N) pair
for whole pages, because only the pair gets `validate_nodes`, morphs,
prerendering, and the agent surface – imperative code is not validated.

One naming caution: `Text` and `Image` collide with DOM constructor
names. Always use the module import; on a page using the CDN globals,
never assume `window.Text` / `window.Image` are still the DOM's own.

## Verifying your work

- **Verify a morph by progress, not by DOM presence.** The destination
  view is inserted before capture begins, so "the element exists" passes
  even when the transition hangs. Assert that the animation *progressed*
  (or landed state + painted output), and unwind with `back`/`go_back`
  to check the reverse path.
- **Add a negative control.** When you write a check, break the thing
  once and confirm the check fails; a check that cannot fail is not a
  check.
- **Prerender caveat:** the jsdom build silently drops CSS `min()` /
  `clamp()`. If the design depends on them, verify in a real browser,
  not in the preview file.

## Static site generation

`npx nodality prerender` interprets the same pair at build time: it
emits crawlable HTML, a sitemap, `hreflang` alternates, and JSON-LD. The
browser then re-reads the pair and rebuilds on top – the pair is
*shipped, not consumed*. `jsdom` must be present in the project
(deliberately not bundled). Builds are deterministic: the same pair
yields byte-identical output, so diffing two builds is a valid check.

## When NOT to use Nodality

Static, content-shaped sites: marketing pages, storefronts,
documentation, brochures. It is not a component framework with
client-side state management. If the user needs an app (auth, live
data, complex client state), say so and recommend an app framework
instead of stretching Nodality.

## References

- Docs: https://nodalityjs.github.io – machine index at
  https://nodalityjs.github.io/llms.txt
- `node_modules/nodality/API.md` ships in the package: the full page
  index with one-line summaries, readable offline.
- Copy-paste-ready full morph page:
  https://nodalityjs.github.io/docs/raster/morph (section "A complete
  page you can paste").
- Validator without MCP:
  `import { validateNodes, describeOps } from "nodality/validate"`.
