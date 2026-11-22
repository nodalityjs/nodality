# Writing a raster op

Raster ops are Nodality's Houdini surface: your op is spliced into the
same shader as the built-ins, gets masking and drivers for free, and is
listed by the same inspector. Nothing about `halftone` is privileged over
what you write.

> This file is hand-written and is the source of truth for the op
> contract. `API.md` is **generated** from the documentation site — do not
> add this material there by hand, it will be overwritten on the next
> `generate-llms.mjs` run.

```js
import { registerRasterOp } from "nodality/raster";

registerRasterOp("pixelate", {
  stage: "warp",
  decl: (p) => `uniform float ${p}size;`,
  code: (p) => `{ warped = (floor(warped / ${p}size) + 0.5) * ${p}size; }`,
  uniforms: (node, dpr) => ({ size: ["1f", (node.size || 12) * dpr] }),
});
```

Then use it exactly like a built-in:

```js
let nodes = [{ op: "pixelate", size: 16, target: ["#hero"] }];
```

A complete, commented version — with a driver, a doc, and the reasoning
behind each choice — ships as
[`examples/custom-raster-op.js`](examples/custom-raster-op.js).

---

## The contract

| field | required | what it is |
|---|---|---|
| `stage` | yes | which slot of the frame your GLSL is spliced into |
| `decl(p)` | yes | uniform declarations, every name prefixed with `p` |
| `code(p, node)` | yes | the body; reads and writes the stage's variables |
| `uniforms(node, dpr)` | no | `{ name: [setter, value] }`, uploaded every frame |
| `doc` | no | `{ summary, params }` — what the inspector and docs read |
| `structural` | no | params compiled into the GLSL; changing one rebuilds |
| `structuralOnToggle` | no | params that only rebuild when crossing zero |
| `defaultDriver` | no | driver to use when the node does not name one |

All of it is validated at registration. A misspelt `stage` throws and
names the nearest real one rather than registering an op that compiles to
nothing:

```
[nodality] registerRasterOp("x"): Unknown stage "colour".
Did you mean "color"? Valid stages: field, warp, cell, displace, color.
```

### Stages, and what each may touch

Ops run in stage order, and within a stage in nodes-array order.

| stage | variables | typical op |
|---|---|---|
| `field` | *(writes a named scalar for later ops)* | `mask`, `noise` |
| `warp` | `warped` — the coordinate space, in device px | `offset`, `flow` |
| `cell` | `center`, `edge` | `hexalize` |
| `displace` | `sampleP`, `chroma` | `aberration` |
| `color` | `col`, `edgeCol`, `edgeCov`, `ovCol`, `ovA` | `halftone`, `duotone` |

Pick the stage by what you want downstream ops to see. Quantising the
coordinate in `warp` means a later `hexalize` computes its lattice from
your blocky coordinates; doing the same in `displace` moves only the
texture fetch and the two grids disagree.

### Uniform namespacing

`p` is a per-node prefix like `u3_`. The same op may appear twice in one
chain, and two `uniform float size` declarations in one shader is a
compile error. **Prefix every uniform name; never hardcode one.**

### Masking is free, and that is why the stages are a closed list

You do not implement `masked:`. The pipeline snapshots your stage's
variables before your code runs and lerps back toward that snapshot
afterwards, by the field value. So:

- an op that stays inside its stage's variables is maskable the moment it
  is written;
- an op that writes **outside** them silently escapes masking.

The same applies to drivers: declare `uniform vec2 ${p}dpos; uniform
float ${p}damt;` and set `defaultDriver`, and `by: "mouse"` works.
Without `defaultDriver`, the pipeline evaluates no driver for your node
and those uniforms stay at zero.

### `doc` — worth writing

Optional, but without it the inspector has to infer your params from your
uniform names, and those differ for any op that transforms its input.
`duotone` takes `colors: [dark, light]` and uploads uniforms `a` and `b`;
before ops declared their params, the panel offered an "a" and a "b" box
and typing in either wrote a key `duotone` never reads.

```js
doc: {
  summary: "Quantises the coordinate space to a square grid.",
  params: {
    size:   { default: 12, unit: "px",    summary: "block size" },
    amount: { default: 1,  unit: "ratio", summary: "0 is a no-op" },
  },
}
```

Units are a closed vocabulary — `px`, `ratio`, `deg`, `count`, `color`,
`name`, `point`, `range`, `bool`, `seconds` — and pick the control the
inspector renders. A `bool` gets a checkbox even when the caller never
set it; before units, an unset boolean came out as a text box because the
type was inferred from a value that wasn't there.

Do **not** document `by`, `masked`, `target`, `live` or `pointer`. Those
are read off every node whatever the op, and are documented once in
`FRAMEWORK_DOC` — adding a key there is also what registers it with
`describeOps()` and makes `validateNodes()` accept it on every op.

### A driver is a point, not a shape

A driver hands your op `dpos` (a focus point, device px, y down from the
element's top) and `damt` (0..1). What the effect looks like around that
point is entirely the op's business. `by: "scroll"` in particular puts the
point on the element's vertical centre line and moves it from the top
edge (progress 0: the element's top has just entered at the bottom of the
viewport) to the bottom edge (progress 1: its bottom is leaving at the
top), at `damt = 1` throughout. It was once documented as "a band that
travels up the element"; it is neither a band nor travelling up the
element, and `{ op: "halftone", by: "scroll" }` — which screens the whole
element and only coarsens dots near the point — looked broken against
that promise. A travelling stripe is a field:

```js
{ op: "mask", from: "band", as: "band", by: "scroll", radius: 90 },
{ op: "halftone", masked: "band" }
```

If your op uses a driver, say in its `doc.summary` whether the driver
*confines* the effect or only *modulates* it. That is the question the
halftone report came down to.

### Varying a pattern's scale around the focus: magnify, do not re-pitch

`halftone` coarsens its dots near the focus. It first did that by dividing
the fragment position by a pitch that varied with distance from the focus:
`frag / pitch(frag)`. That is a warp whose shear grows with the distance
from the element's *origin*, not from the focus, and it drew the spot as a
moiré swirl. The fix is to scale the coordinates **about the focus** and
keep the pitch constant:

```glsl
float mag = 1.0 + falloff * damt * k;      // 1 outside the spot
vec2 sp = dpos + (frag - dpos) / mag;      // a loupe: identity outside
vec2 grid = rotate(sp) / pitch;            // constant pitch
```

For any `mag` that falls off with distance, `r -> r / mag(r)` is monotonic,
so the grid never folds, and it is the identity outside the spot, so the
rest of the pattern stays put while the focus moves. Any op that wants "a
bigger pattern under the cursor" (dither cells, pixelate blocks) should do
the same.

### Two rules that are about GPUs, not about this library

- **No per-frame allocation in `uniforms()`.** `code()` runs once per
  rebuild; `uniforms()` runs every frame. Build arrays outside it.
- **Hash with polynomials, not `sin(dot(p, k)) * 43758.5453`.** The sin
  trick bands badly on Apple silicon. See `noise` for the pattern.

---

## What the pipeline does to the element it is aimed at

Your op never sees this, but the people using it will ask. Pinned by
`__tests__/e2e/raster-image.spec.js` and
`__tests__/unit/raster-device-gate.test.mjs`.

### When it does not attach at all

`applyRasterPipeline` returns `null` and leaves the element exactly as
authored when:

- `prefers-reduced-motion: reduce` matches — **every** chain, static ones
  included, not only animated drivers;
- every node is dropped by its `pointer:` gate (below), or by a `switch`;
- the target is an `<img>` from another origin loaded without CORS (a
  one-time console warning says so). It used to attach anyway and
  halftone a broken-image icon over the hidden photo;
- there is no WebGL, no layout box yet, or no DOM (prerender).

All of these are evaluated **once, at attach**. A user who turns on
reduced motion mid-session keeps the running effect until the page is
reloaded.

### `pointer:` — device gating

```js
{ op: "hexalize", lift: 0.3, by: "hover", target: ["photo"], pointer: "fine" }
```

`"fine"` keeps the node only where `matchMedia("(pointer: fine)")`
matches; `"coarse"` and `"none"` likewise; `"any"` or absent is no gate.
A failing node is dropped from the chain (inside `merge` and `switch` too)
and the rest still runs; a chain left empty never attaches. An unknown
value fails **closed** with a warning, so a typo cannot attach to the
devices it was meant to exclude. `switch` remains the tool for "this chain
here, that chain there".

### An `<img>` target

An `<img>` cannot host a canvas, so it is moved into a
`<div data-nodality-raster-host="img">` that takes over its inline box.
Then, by backend:

- **Snapshot** (every shipping browser): the `<img>` stays in the DOM at
  `opacity: 0` — still the same element, still in the accessibility tree
  with its `alt`. The canvas is
  `aria-hidden="true"`. (Before this was fixed the canvas carried
  `role="img"` with the host's `textContent` as its label: an `<img>` host
  gained a second, *unnamed* image, and a text host was announced twice.)
- **Live** (HTML-in-Canvas origin trial only): the `<img>` becomes the
  canvas's fallback content, which is the accessible subtree, so the
  canvas is not hidden.

The wrapper takes the image's size as **authored**: its inline style
first, then whatever stylesheets and `width`/`height` attributes give it,
read as computed values (the image is `display: none` for the length of
that one style read, which is what makes `getComputedStyle` report `50%`
as `50%` instead of a frozen pixel width). A fixed width stays fixed, a
percentage stays fluid, a height alone keeps the image's aspect ratio,
and `max-width: 100%` alone means the natural width, capped. Only an image
with no sizing anywhere fills its wrapper (`100%` of the parent). Before
this, only inline sizing moved: a 600x400 image sized by a stylesheet came
out 700x466 in a 700 px column. Pinned by
`__tests__/e2e/raster-image-size.spec.js`.

Limit: the sizing is read once, at attach. A media query that later
changes the image's width in the stylesheet no longer reaches it (the
wrapper carries the value it had then, and a rule like `.col > img` stops
matching once the image is wrapped) — size responsive rastered images
with percentages, or inline.

### Timing and LCP

The pipeline attaches on a `setTimeout` after the element renders
(retried every 50 ms for up to 4 s until it has a layout box). In snapshot
mode an `<img>` host then waits for the image to load **and for two more
frames** before the canvas takes over, so the photo is presented at least
once. That is what keeps it the page's LCP element: LCP ignores canvases
and anything at opacity 0, and when the capture finished inside the frame
the image decoded in, the page reported no LCP entry at all. Expect the
original photo for ~2 frames after it loads, then the effect.

The live backend moves the `<img>` into the canvas at attach; if that
happens before the image's first paint, LCP will not count it.

### Cost

- One WebGL context per rastered element. Browsers cap live contexts
  (commonly 16) and drop the oldest past that — keep it to a handful per
  page.
- The draw loop runs every animation frame while the element intersects
  the viewport (paused off-screen), even for a static chain: one
  full-element fragment pass at `devicePixelRatio` up to 3, so cost is
  quadratic in DPR. Stateful ops (`stir`, `echo`) add their own passes.
- Memory: the source texture plus the canvas backbuffer, roughly
  `2 x w x h x dpr² x 4` bytes — about 7.7 MB for a 600x400 image at DPR 2.
- An `<img>` host is uploaded directly (cheap); any other host is
  serialised through an SVG `foreignObject` snapshot on attach and on
  every resize.

---

## Packaging: one registry, whichever door you come through

These all reach the **same** module instance, so an op you register is
visible to the `Des` that does the rendering, and the inspector lists the
pipelines that actually exist:

```js
import { Des } from "nodality";                     // ESM bundle
import { registerRasterOp } from "nodality/raster"; // source module
import { inspectRaster } from "nodality/inspect";   // source module
```

That is not free. `lib/raster-ops.js` owns two module-scoped singletons —
the op `REGISTRY`, and the `ACTIVE` set of attached pipelines — so a
second bundled copy duplicates *state*, not just code. It previously did:
every ESM entry that transitively imported it inlined its own registry,
and an op registered through `nodality/raster` was accepted and then
never ran, while `nodality/inspect` reported "No raster pipelines
attached" on a page full of them. Both failures were silent.

The ESM builds now mark `lib/raster-ops.js` **external**, so they import
it instead. Guarded from both sides:

- `__tests__/unit/bundle-shares-registry.test.mjs` — the config still
  asks for the external, the built artefact actually has it, and an op
  registered through the source surface reaches the bundled mapper
- `__tests__/e2e/bundle.spec.js` — the same, in a real browser

### Two deliberate exceptions

**CJS builds still inline.** `lib/raster-ops.js` is ESM source in a
package with no `"type": "module"`, so `require("../lib/raster-ops.js")`
would depend on Node's `require(esm)` support — a runtime version
dependency with nothing to gain. Nothing observable is lost: the subpaths
that could disagree with it (`nodality/raster`, `nodality/inspect`) are
ESM-only, so a `require()` consumer cannot hold a second instance.

**`bundle.umd.js` and `finalresult.esm.js` still inline.** A script-tag
bundle is meant to be one self-contained file, and having no second
instance to disagree with, it has nothing to share.
