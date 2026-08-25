<h1 align="center">Nodality</h1>

<p align="center">
  <strong>A user interface is two arrays: what exists, and what is done to it.</strong><br>
  Both are plain data – so the pipeline that builds your page is inspectable,
  diffable, and executable at build time <em>and</em> in the browser.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nodality"><img alt="npm" src="https://img.shields.io/npm/v/nodality?color=0f53a8"></a>
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-0-0f53a8">
  <a href="https://github.com/nodalityjs/nodality/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/nodality?color=0f53a8"></a>
  <a href="https://nodalityjs.github.io/"><img alt="docs" src="https://img.shields.io/badge/docs-nodalityjs.github.io-0f53a8"></a>
</p>

---

## A whole navigation graph is one node

<p align="center">
  <img src="https://raw.githubusercontent.com/nodalityjs/nodality/main/media/nodality-chain.gif"
       alt="Three views transitioning into one another, each hop running a different shader effect" width="640">
</p>

```js
{ op: "morph", effect: "t-vhs", duration: 620, back: true,
  chain: [
    { from: "home",   to: { Work: "work", Contact: "contact" } },
    { from: "work",   to: { Aurora: "aurora" },  effect: "t-split" },
    { from: "aurora", to: { Contact: "contact" }, effect: "t-bloom" },
  ] }
```

That is the entire source of the transitions above. The entries are
**edges, not keyframes** – edge two is reachable *from* the state edge one
lands on, so a landed view becomes a source in its turn. Settings on the
node are defaults each edge may override, and `back` unwinds the path the
user actually took rather than looking up an edge.

## Effects run on live DOM, and the DOM stays clickable

<p align="center">
  <img src="https://raw.githubusercontent.com/nodalityjs/nodality/main/media/nodality-effect.gif"
       alt="A warp effect following the pointer across a bar of links, then a link being clicked through it" width="640">
</p>

```js
const nodes = [
  { op: "flow",   target: ["bar"], by: "mouse", amount: 0.32 },
  { op: "dither", target: ["bar"], levels: 10, size: 2, amount: 0.14 },
];
```

Two raster nodes aimed at one element compose into a **single** shader
pass, in array order. The source is your live DOM, not an image you
exported – and the links underneath still work: pointer input is inverted
through the compiled transformation and re-dispatched, so a click lands
where the user aimed rather than where the layout still thinks the link
is. In the recording above, the pointer drives the warp and then clicks
*through* it; the view that follows is the morph firing.

## Install

```bash
npm create nodality@latest my-app
```

Or drop it into a page – no build step, no dependencies:

```html
<div id="mount"></div>

<script type="module">
import { Des } from "https://unpkg.com/nodality/dist/index.esm.js";

const elements = [
  { id: "hero", type: "h1", text: "Hello" },
];

const nodes = [
  { op: { name: "gradient", gradient: "linear-gradient(90deg, #1d6fe0, #7fd1ff)" },
    target: ["hero"] },
  { op: "dither", target: ["hero"], levels: 6, size: 2 },
];

new Des().nodes(nodes).add(elements).set({ mount: "#mount" });
</script>
```

`elements` says what exists. `nodes` says what is done to it. Nothing in
`elements` names an effect and nothing in `nodes` names a component – the
two meet only through `target`, so either can be written, stored or
generated without the other.

## What else it does

**Static site generation.** The same pair is interpreted at build time in
a simulated DOM, so `npx nodality prerender` emits crawlable HTML that a
consumer running no JavaScript can read, plus a sitemap, `hreflang`
alternates and JSON-LD. The browser then re-reads the same pair and
rebuilds on top – the pair is shipped, not consumed.
[Docs →](https://nodalityjs.github.io/docs/ssg/prerender/)

**Transitions and navigation graphs.** `{ op: "morph" }` in one hop or a
whole chain, with per-edge effects, history-based `back`, and two capture
backends chosen automatically.
[Docs →](https://nodalityjs.github.io/docs/raster/morph/)

**Composable GPU effects.** Fifteen first-party raster ops, driveable by
pointer, scroll or time, composed into one pass.
[Docs →](https://nodalityjs.github.io/docs/raster/ops/)

**An agent-operable surface, derived.** One node exposes your page to an
AI agent as callable tools – traversing views, submitting a form you
allowed, reading what is on screen – derived from the graph you already
wrote rather than authored a second time, and also written into the
prerendered HTML as a static manifest.
[Docs →](https://nodalityjs.github.io/docs/raster/agent-surface/)

## For AI agents

One command sets up an agent IDE end to end:

```bash
npx nodality skill
```

It installs the `/nodality` skill – the authoring workflow, the node
families, and the house rules the schema cannot encode – into Claude
Code (`.claude/skills/`) and Cursor (`.cursor/rules/`), and registers
the MCP server below in the project's config. Flags: `--claude`,
`--cursor`, `--global`, `--dir=<path>` for any other agent, `--no-mcp`.
Re-run it after upgrading nodality to refresh the skill in place.

`nodality mcp` runs a Model Context Protocol server over stdio, so a
generator writes against the real vocabulary instead of guessing at it:

```json
{ "mcpServers": { "nodality": { "command": "npx", "args": ["nodality", "mcp"] } } }
```

Three tools. `list_ops` returns the op registry as data – every op with
its stage, parameters, units and defaults. `validate_nodes` checks a node
array and returns a machine-readable report with did-you-mean
suggestions, so `{ op: "dithr" }` comes back as `UNKNOWN_OP` suggesting
`dither` rather than rendering nothing at all. `preview` renders an
`(E, N)` pair to a self-contained HTML file (needs `jsdom` in your
project; it is required only for prerendering, so the library does not
bundle it).

The validator is available directly too:

```js
import { validateNodes, describeOps } from "nodality/validate";
```

## What this is not

Nodality targets **static, content-shaped sites** – marketing pages,
storefronts, documentation, brochure sites. It is not a replacement for a
component framework with client-side state management, and it does not
try to be one.

Two honest caveats. The HTML-in-Canvas capture backend is **experimental
and flag-gated**: where it is unavailable the pipeline falls back to
snapshot capture on its own, so a page authored against it degrades to
stills rather than breaking. And determinism is a property of the
compiled artefact – the same pair always produces the same output – not
of the pixels a particular GPU eventually paints.

## Requirements

Nodality has **zero runtime dependencies**. What you need depends on how you use it.

**The preferred way to start is the scaffolder**, which creates a working project
with the pipeline, the prerender step and the example pair already wired up:

```bash
npm create nodality@latest my-app
```

It needs only Node.js 20 or newer. Everything below is for adding Nodality to
something that already exists.

| Use | Requires |
|---|---|
| In a browser | Any browser with ES modules. No build step, no bundler. |
| `npm install nodality` | Node.js 20 or newer. TypeScript declarations ship in `dist/index.d.ts`. |
| `npx nodality prerender` (static generation) | Node.js 20 or newer. The prerender path runs the same pipeline inside `jsdom`. |
| Running the test suite | `npm install` (pulls Playwright, jsdom, webpack, Babel as dev dependencies), then `npx playwright install`. |

The published measurements were produced on Node.js v25.6.0.

## Code information

| Path | Contains |
|---|---|
| `layout/` | Element definitions — the *what exists* half of the pair. |
| `lib/` | Transformation nodes and the pipeline — the *what is done to it* half. |
| `dist/` | Built bundles: `index.cjs.js` (CommonJS), `index.esm.js` (ES module), `index.d.ts`. |
| `bin/` | The command-line entry points, including `prerender`. |
| `__tests__/` | Playwright regression tests that assert deterministic output. |
| `examples/` | Runnable pairs, smallest first. |
| `API.md` | Full API reference. |
| `CHANGELOG.md` | Version history. |

## Reproducing the published measurements

The quantitative results are **not** in this repository. Harnesses, raw data and
per-measurement READMEs are deposited separately under CC0:

- **Repository:** [github.com/nodalityjs/benchmarks](https://github.com/nodalityjs/benchmarks)
- **Archived deposit:** [10.5281/zenodo.21610251](https://doi.org/10.5281/zenodo.21610251)

That deposit covers authoring cost in language-model tokens, compiler scaling
from 10 to 1 000 elements, crawlability and first-paint timing, model
properties, determinism, accessibility, and WHATWG validity. Each has its own
README and run command. The benchmark harnesses pin `nodality` to an exact
version rather than a range, so a fresh install reproduces the published figures
against the artefact that produced them.

## Methodology

Nodality compiles two plain arrays — `elements` (what exists) and `nodes` (what
is done to it) — into rendered output. The two meet only through `target`, so
neither names the other and either can be authored, stored or generated
independently. The same pair is interpreted twice: at build time inside a
simulated DOM to emit crawlable static HTML, and in the browser to attach
behaviour. Determinism is a property of the compiled artefact: the same pair
always compiles to a byte-identical result, which is asserted by the regression
suite rather than proved formally.

## Citing

If you use Nodality in research, please cite the paper rather than this
repository:

> Vabroušek, F. Nodality: a node-based declarative transformation pipeline for
> static UI generation. *PeerJ Computer Science*. (Under review.)

For the measurements specifically, cite the data deposit:

> Vabroušek, F. 2026. *Nodality benchmarks*. Zenodo. DOI 10.5281/zenodo.21610251.

## License and contributing

Nodality is released under the [MIT License](LICENSE). The benchmark deposit is
released separately under CC0 1.0.

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup and the expectations for a pull request.

## Links

- **Docs** – [nodalityjs.github.io](https://nodalityjs.github.io/)
- **Live demos** – [a navigation graph](http://www.gesos.cz/chain-demo.html) · [a morph in production](http://www.gesos.cz/morph.html)
- **Built with it** – [blue70.cz](https://www.blue70.cz) · [sls3.cz](https://www.sls3.cz) · [gesos.cz](http://www.gesos.cz) · [relays.app](https://relays.app)
- **Releases** – [changelog and release notes](https://github.com/nodalityjs/nodality/releases)

MIT © Filip Vabroušek
