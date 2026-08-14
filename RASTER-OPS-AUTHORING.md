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

Do **not** document `by`, `masked`, `target` or `live`. Those are read off
every node whatever the op, and are documented once in `FRAMEWORK_DOC`.

### Two rules that are about GPUs, not about this library

- **No per-frame allocation in `uniforms()`.** `code()` runs once per
  rebuild; `uniforms()` runs every frame. Build arrays outside it.
- **Hash with polynomials, not `sin(dot(p, k)) * 43758.5453`.** The sin
  trick bands badly on Apple silicon. See `noise` for the pattern.

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
