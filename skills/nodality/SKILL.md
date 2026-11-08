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

Or let the CLI write it: `npx nodality mcp --register` in the project, or
`--root=<folder>` when sessions start in a folder above it — the tools only
appear in sessions started where `.mcp.json` lives.

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
4. **`preview` to render.** Pass `viewport: "desktop"` to see the wide side of anything chosen by width (the default is a phone); the report lists ids that rendered `empty` instead of leaving a blank page to look finished.
    It writes a self-contained HTML file through
   the jsdom prerenderer. Know the boundary: the file is prerendered DOM
   and morph scaffolding only and carries no runtime, so raster effects
   and transitions will not run from it. To see them, put the pair in a
   real page with the library loaded (the CDN snippet is enough).

Skipping step 3 is the classic failure: a misspelled op renders
*nothing* rather than erroring, so the page looks plausible and is
silently missing its effects.

**Read `warnings`, not just `errors`.** The report has both. `errors`
mean the page will not render as a page; `warnings` mean it renders and
does not do what you wrote:

| code | what it means |
|---|---|
| `BAD_PARAM_VALUE` | the value is not the shape the parameter takes — `width: 7` is not a CSS length, `mar: 7` is not `[{a: 7}]`. As an *error* where the value is provably inert; as a warning otherwise. |
| `PARAM_NOT_ON_TYPE` | a real parameter name that THIS type does not read, so it is accepted and dropped — `keySet` on a `table`. |
| `PARAM_INERT` | a parameter the type DOES list, and is known to ignore (the library's conformance baseline) — `size` on a `p`, `color` on a `checkbox`. The hint says what to use instead. |
| `STORE_AFTER_PRODUCT` / `NO_STORE` | a commerce `product` placed before the page's `store`, or with none: it renders empty. |

`get_schema <type>` carries a `unit` on every parameter whose shape the
source declares, which is where those checks come from, and a
`forwardsElement` flag: when it is false the type's vocabulary is only
what its mapper reads by name, because the mapper builds its own options
rather than passing yours on.

## House rules – violations are bugs even when the page looks right

- **Never touch the DOM to style or fix a Nodality page.** No
  `el.style.*`, no `createElement` in page code, no post-render DOM
  patching. If the library cannot express something, the fix is a custom
  element/op (extend the library).
- **Style with options, not keySet.** Elements take styling as options:
  the library's own names (`exact` for font size, `weight`, `pad`, `mar`,
  `radius`, `gpos`, `borderObj`) and the CSS-named options every element
  accepts (`lineHeight`, `letterSpacing`, `textTransform`, `gap`,
  `alignContent`, `justifyContent`, `boxShadow`, `backdropFilter`,
  `borderTop`, …). `get_schema <type>` lists them. Responsive values go in
  `resprop`, which takes CSS names. `keySet: [{ key, value }]` is the escape
  hatch for a property no option names — reach for it last, and if the same
  property keeps needing it, extend the library instead.
- **No CSS in the page either.** No `<style>` rules, no `@keyframes`, no
  stylesheet files. Anything that moves on its own takes `loop` on the element —
  `loop: { keyframes: [{…}, {…}], duration }` runs forever through the Web
  Animations API and holds still for reduced motion. If something cannot be
  expressed, extend the library.
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

## Where to read more

Read only what the task needs. Each file is short and stands alone.

| When you are | Read |
|---|---|
| filling a composite (`cards`, `nav`, `table`, `row`, …) or using HTML names like `src`, `href`, `options` | `references/content-and-composites.md` |
| writing nodes: design, raster, morph, agent surface, `arrange` | `references/node-families.md` |
| adding a few elements to existing code with `new Text()` and `.render()` | `references/imperative.md` |
| building a site with shared nav and footer (`.defs()`, `$ref`) | `references/multi-page.md` |
| changing a page that is already rendered | `references/editing.md` |
| checking a page before you call it done | `references/verifying.md` |
| prerendering a static site | `references/prerender.md` |

Four task skills sit beside this one and carry the step-by-step procedure:

- **`nodality-new-page`**: building a page from a brief, in small validated
  steps.
- **`nodality-edit-page`**: changing one thing on a rendered page without
  regenerating it.
- **`nodality-current`**: finding the element the person means by "this":
  what they picked in `npx nodality dev`, read fresh every turn.
- **`nodality-apply-comments`**: applying the notes they left on the page
  in `npx nodality dev`, by element id, then resolving them.

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
