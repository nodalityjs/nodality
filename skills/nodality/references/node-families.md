# The four node families

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

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
- **`arrange` switches a group's arrangement inside a width range.**
  `{ op: { name: "arrange", mode: "column" }, target: ["hero"], range: [0, 640] }`
  stacks a `row` or `cards` grid at 0–640 px, and `mode: "row"` keeps it
  side by side; on a `nav`, `mode: "collapse"` shows the menu button up to
  the range's end and `mode: "expand"` the full bar. Ranges are inclusive
  CSS px. Do not guess them: `nodality/responsive`'s `respond()` measures
  the page in a browser and emits one node per interval, covering every
  width, switching exactly where a group stops fitting (experimental). Of
  two overlapping ranges on one element, the first declared wins.

A complete navigation graph is one node:

```js
{ op: "morph", effect: "t-vhs", duration: 620, back: true,
  chain: [
    { from: "home",   to: { Work: "work", Contact: "contact" } },
    { from: "work",   to: { Aurora: "aurora" },   effect: "t-split" },
    { from: "aurora", to: { Contact: "contact" }, effect: "t-bloom" },
  ] }
```
