/*!
 * custom-raster-op.js — a raster op written from outside the library.
 *
 * The claim this file exists to make good on: an op you write is not a
 * second-class citizen. It is the same shape as `halftone`, it is masked
 * by the same `masked:` key, it is steered by the same drivers, it is
 * listed by the same inspector, and it composes with first-party ops in
 * either order. Nothing here reaches into the library's internals — the
 * whole surface is `registerRasterOp` plus the contract below.
 *
 *     import "nodality/examples/custom-raster-op";
 *
 * `nodality`, `nodality/raster` and `nodality/inspect` share one op
 * registry — the ESM builds import lib/raster-ops.js rather than bundling
 * a second copy of its module state. See RASTER-OPS-AUTHORING.md; the CJS
 * and UMD builds are deliberate exceptions.
 *
 *     let nodes = [
 *         { op: "pixelate", size: 14, target: ["#hero"] },
 *         // ...and because it declared stage "warp", it masks for free:
 *         { op: "mask", as: "spot", from: "radial", by: "mouse", radius: 260 },
 *         { op: "pixelate", size: 22, masked: "spot", target: ["#hero"] },
 *     ];
 *
 * ── The contract ─────────────────────────────────────────────────────
 *
 * `stage`   which of the frame's five slots your GLSL is spliced into.
 *           This is the only field whose value you cannot get wrong
 *           quietly — registerRasterOp checks it against the vocabulary.
 * `decl(p)` uniform declarations. EVERY name must be prefixed with `p`.
 * `code(p)` the body. Read and write the stage's variables (below).
 * `uniforms(node, dpr)` what to upload, as `{ name: [setter, value] }`.
 *           Runs every frame, so it allocates nothing it does not have to.
 * `doc`     summary + params. Optional — but without it the inspector has
 *           to guess your param list from your uniform names, which is
 *           wrong for any op whose two differ.
 *
 * `p` is a per-node prefix like `u3_`. It exists because the same op may
 * appear twice in one chain, and two copies of `uniform float size` in
 * one shader is a compile error. Prefix everything; never hardcode a
 * uniform name.
 *
 * Stage variables, and what each stage may touch:
 *
 *     field     — write a scalar for later ops to read. Draws nothing.
 *     warp      — `warped`: the coordinate space itself, in device px
 *     cell      — `center`, `edge`: the sampling cell and its border
 *     displace  — `sampleP`, `chroma`: where the texture is fetched
 *     color     — `col`, `edgeCol`, `edgeCov`, `ovCol`, `ovA`
 *
 * Masking is applied by the pipeline, not by you: it snapshots the
 * stage's variables before your code runs and lerps back toward that
 * snapshot afterwards. So an op that stays inside its stage's variables
 * is maskable the moment it is written, and an op that writes outside
 * them silently escapes masking. That is the whole reason the stages are
 * a closed list.
 *
 * Two rules that are about GPUs rather than about this library:
 *   - No per-frame allocation in `code()`. It runs once per rebuild, but
 *     `uniforms()` runs every frame — build arrays outside it.
 *   - Hash with polynomials, not `sin(dot(...)) * 43758.5453`. The sin
 *     trick banded badly on Apple silicon; see `noise` for the pattern.
 */

import { registerRasterOp } from "../lib/raster-ops.js";

/**
 * pixelate — quantise the coordinate space to a grid.
 *
 * Warp stage rather than displace, and that choice is the interesting
 * part. Displace would move only the texture lookup, so a `hexalize`
 * later in the chain would still compute its lattice from smooth
 * coordinates and the two grids would disagree. Warping the space itself
 * means every downstream op — cell, displace, colour — sees the blocky
 * coordinates too, so `pixelate` composes with the built-ins instead of
 * merely running near them.
 *
 * Snapping to the CENTRE of each block (the `+ 0.5`) rather than its
 * corner keeps the image from creeping half a block up-left as `size`
 * grows.
 */
registerRasterOp("pixelate", {
	stage: "warp",

	// Whether a driver steers this op changes the GLSL, not just a value:
	// with `by` the block size falls off around the focus, without it the
	// whole element is quantised. Declaring `by` structural is what tells
	// the pipeline to rebuild the shader when it changes, and the
	// inspector to mark the control "↻" before you touch it.
	structural: ["by"],

	// Without this, `dpos`/`damt` are declared but never uploaded, because
	// the pipeline only evaluates a driver for nodes that name one. They
	// would read 0 and the op would do nothing. "static" means the focus
	// is the element centre at full amount.
	defaultDriver: "static",

	doc: {
		summary: "Quantises the coordinate space to a square grid, so the " +
			"element renders as blocks. Warp stage, so everything downstream " +
			"— cell grids, colour ops — sees the blocky coordinates too.",
		params: {
			size: { default: 12, unit: "px", summary: "block size" },
			amount: {
				default: 1, unit: "ratio",
				summary: "blend between the smooth and quantised coordinates; " +
					"0 is a no-op, so it is safe to animate to nothing",
			},
			radius: {
				default: 240, unit: "px",
				summary: "falloff around the driver focus. Only used when `by` " +
					"names a driver; without one the whole element is quantised.",
			},
		},
	},

	decl: (p) => `
		uniform float ${p}size;
		uniform float ${p}amount;
		uniform float ${p}radius;
		uniform vec2 ${p}dpos;
		uniform float ${p}damt;`,

	// `warped` is in device pixels, which is why `size` is scaled by dpr
	// in uniforms() rather than here: the shader should not have to know
	// what a CSS pixel is.
	//
	// The `node.by` branch is resolved at COMPILE time, so a chain that
	// never names a driver compiles to exactly the shader it would have
	// without any driver support at all — no dead distance computation
	// per fragment. That is the same trade `halftone` and `duotone` make.
	code: (p, node) => `
	{
		vec2 blocky = (floor(warped / ${p}size) + 0.5) * ${p}size;
		${node.by
		? `float fall = (1.0 - smoothstep(0.0, ${p}radius,
			   length(warped - ${p}dpos))) * ${p}damt;`
		: `float fall = 1.0;`}
		warped = mix(warped, blocky, ${p}amount * fall);
	}`,

	// Phase I2: the CPU twin of code(), so a hit-test over this effect
	// costs no GPU readback. Optional — an op without one still works,
	// its queries just take the slower exact path. Declaring one is a
	// promise the library CHECKS: the twin is compared against the GPU
	// oracle across the parameter space, so drift is caught rather than
	// believed.
	map: (pt, node, ctx) => {
		const size = Math.max(1, node.size != null ? node.size : 12) * ctx.dpr;
		const amount = node.amount != null ? node.amount : 1;
		let fall = 1;
		if (node.by) {
			const radius = (node.radius != null ? node.radius : 240) * ctx.dpr;
			const d = Math.hypot(pt[0] - ctx.dpos[0], pt[1] - ctx.dpos[1]);
			const t = Math.min(1, Math.max(0, d / (radius || 1e-6)));
			fall = (1 - t * t * (3 - 2 * t)) * ctx.damt;
		}
		const k = amount * fall;
		const bx = (Math.floor(pt[0] / size) + 0.5) * size;
		const by = (Math.floor(pt[1] / size) + 0.5) * size;
		return [pt[0] + (bx - pt[0]) * k, pt[1] + (by - pt[1]) * k];
	},

	uniforms: (node, dpr) => ({
		// max() rather than a bare default: a size of 0 is a divide-by-zero
		// in the shader, and the resulting NaN propagates to every op after
		// this one — a whole-element black rectangle with no error anywhere.
		size: ["1f", Math.max(1, node.size != null ? node.size : 12) * dpr],
		amount: ["1f", node.amount != null ? node.amount : 1],
		radius: ["1f", (node.radius != null ? node.radius : 240) * dpr],
	}),
});

export {};
