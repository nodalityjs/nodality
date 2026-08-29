---
name: nodality
description: Build or edit a page with the Nodality library – declarative static UI from two arrays (elements + nodes), GPU raster effects, morph navigation graphs, prerendering, and agent surfaces. Use when the user asks to create or change a Nodality page, mentions (E, N), Des(), morph/raster/agent-surface nodes, works with imperative Nodality code (new Text(), new Link(), .render()), asks to draft a landing page with Nodality, or asks to EDIT an already-rendered Nodality page (parse it back to data, change it, re-render).
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
1b. **`get_schema` for the element you are about to write.** `list_ops`
   gives the vocabulary of N; `get_schema` gives the vocabulary of E,
   one type at a time – its parameters, recovered from the source the
   components actually read. Ask for the type, not the whole schema:
   that is the difference between paying for a schema once and paying
   for it in every request.
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

## Composites carry their content in a slot

A composite is not empty scaffolding – you give it content, and **which
key you use is part of the type**:

| slot | types |
|---|---|
| `items` | `cards`, `nav`, `sideNav`, `table`, `ulist` |
| `children` | `row`, `form`, `wrap` |

```js
{ type: "cards", items: [                       // shorthand
    { img: "a.jpg", title: "Alpha", link: "#a" },
    [{ type: "h2", text: "Beta" }],             // or nested specs
]}
```

`items` takes either shorthand entries or a nested list of element
specs, and one array may mix both. Use nested specs when the cards
differ from one another – that is the case where a data format wins by
the widest margin, and where writing it as code costs *more* than
hand-written JSX.

**Declaring content in the wrong slot renders the placeholders.** A
composite given nothing falls back to sample content, so
`{type:"table", children:[…]}` produces a plausible-looking table of
someone else's data rather than an error. `validate_nodes` reports this
as `WRONG_CONTENT_SLOT` and names the slot that carries content – which
is another reason step 3 is not optional. `get_schema` names it too.

## The four node families

Told apart by the shape of `op`:

| Family | Shape | Example |
|---|---|---|
| Design | `op` is an object, or one of seven shorthand strings | `{ op: { name: "shadow" }, target: ["card"] }` |
| Raster | `op` is any other string | `{ op: "dither", target: ["hero"], levels: 6 }` |
| Morph | `op: "morph"` | one transition, or a whole graph via `chain` |
| Agent surface | `op: "agent-surface"` | exposes the page to AI agents as tools |

**The design family has two shapes.** The object form takes its options
inside `op`. The seven shorthand names – `blast`, `gradient`, `shadow`,
`filter`, `animation`, `transform`, `span` – expand against a table of
defaults, so `{ op: "gradient" }` is a whole valid node. Only the
shorthand accepts `gradient`, `filter`, `color` and `width` as top-level
keys, because its expansion lifts them into the op it substitutes. Any
other string is a raster op.

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
- **Know where options live.** Raster-op options sit on the node
  (`levels: 6`); design-node options sit INSIDE the `op` object
  (`op: { name: "gradient", gradient: "linear-gradient(...)" }`).
  Putting a design option at the top level is the single most common
  mistake with this library – the project's own README shipped
  `colors: [...]` there and rendered its headline invisible. Since 1.2.7
  `validate_nodes` reports it and tells you where it belongs, so run the
  validator rather than trusting the shape by eye.
- **Do not invent options.** An option that no op declares is ignored in
  silence rather than reported. If `list_ops` does not name it, it does
  not exist.
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

## Editing a page that already exists

Editing is the common case in production, and it does not mean
regenerating. Read the page back to data, change the one thing, render
again:

```js
import { parseHTML } from "nodality/parse";

const spec = parseHTML(html);      // or the parse_html MCP tool
spec[0].items[1].title = "Gamma";  // change one card
new Des().nodes([]).add(spec).set({ mount: "#mount", annotate: true });
```

**Render with `{annotate: true}` if the page will ever be edited.** It
writes each descriptor onto the node it produced, and that is what makes
the read exact – every type, every option, nothing inferred. It is
opt-in and off by default because it puts attributes in the output.

Without annotation only what the tag settles comes back: headings,
paragraphs, links, images, lists. Thirteen composite types render as a
bare `<div>` with nothing to tell them apart, so those are reported
**unrecovered rather than guessed** – a wrong guess would silently
become a different page. Use `parseReport` (or the `parse_html` tool)
rather than `parseHTML` when you need to know which you got:

```js
const { ok, exact, spec, unrecovered, errors } = parseReport(html);
```

`ok` is false if anything was unrecovered *or* the recovered spec fails
validation. Check it before re-rendering: a descriptor read out of a
document is untrusted input.

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
