/*!
 * nodality v1.1.14
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * raster-presets.js — named, COMPOSABLE raster op chains.
 *
 * A preset is data: an array of raster nodes, exactly what you would have
 * written by hand. `preset("liquid-hero")` is a shortcut, not a wrapper —
 * the value it returns is plain nodes, and once you have it the preset has
 * no further existence. Nothing at runtime depends on this module.
 *
 *     new Text("Hold").set({ raster: preset("liquid-hero") })
 *
 * COMBINING is the point (the Houdini part). Chains already compose in the
 * pipeline — stages run field → warp → cell → displace → color whatever
 * order the nodes are written in — but two chains concatenated naively can
 * still collide, in one specific way: FIELDS ARE GLOBAL. If two presets
 * both write `as: "mask"`, the second silently overwrites the first and
 * both look subtly wrong. `compose()` renames each preset's private fields
 * so that cannot happen:
 *
 *     compose("liquid-hero", "print-shop")        // fluid, then screened
 *     compose("spotlight", ["ripple", { strength: 40 }])
 *
 * A field a preset CONSUMES but does not PRODUCE is left untouched, so
 * deliberate cross-wiring still works: produce a field in one preset, read
 * it in the next.
 *
 * Pure — no DOM, no imports beyond the op vocabulary it validates against.
 */

import { RASTER_OP_NAMES, DRIVER_NAMES } from "./raster-ops.js";
import { didYouMean } from "./suggest.js";

// `live` records what the HTML-in-Canvas backend buys a preset:
//   undefined  — snapshot is the whole effect; live changes nothing visible
//   "enhanced" — works on snapshot, better live (a static field vs a live one)
//   "required" — needs live capture; on snapshot it correctly does nothing
//
// The gallery badges from this. It is documentation, not a gate: the
// pipeline decides the backend itself and degrades silently either way.
const PRESETS = {
	// ── transitions (phase T3) ───────────────────────────────────────
	// Chains meant for transition mode: every param keyframed so the
	// effect is absent at both ends and peaks in the middle. They are
	// ordinary nodes — no transition-specific authoring language — which
	// is why compose() and every third-party op still work here.
	"t-vhs": {
		summary: "Tape-glitch morph: chroma splits and the image tears, " +
			"strongest at the midpoint, gone at both ends.",
		nodes: [
			{ op: "aberration", amount: [0, 18, 0] },
			// Windowed so the tear starts after the split has opened —
			// staggering inside one preset rather than needing a timeline.
			{ op: "flow", strength: [0, 34, 0], scale: 60, speed: 0,
				window: [0.15, 0.95], ease: "in-out" },
		],
	},
	"t-dissolve": {
		summary: "Ordered-dither dissolve — the old state breaks into " +
			"pixels before the new one resolves.",
		nodes: [
			// Identity at BOTH ends. A transition preset that still shows
			// its effect at t=0 or t=1 pops when the canvas hands the
			// frame back to the real element.
			{ op: "dither", levels: [8, 2, 8], size: [1, 7, 1], amount: [0, 1, 0],
				ease: "in-out" },
		],
	},
	// The first preset that treats the two halves of a morph as separate
	// things: the outgoing state burns to ink while the incoming one
	// resolves out of a screen. A crossfade decorated after the blend
	// cannot express this — both ends would get the same treatment.
	"t-split": {
		summary: "Per-side morph: the old state posterises to duotone while " +
			"the new one resolves through a halftone screen.",
		nodes: [
			{ op: "duotone", side: "old", amount: [0, 1, 1],
				dark: "#0B1B2B", light: "#1abc9c" },
			{ op: "halftone", side: "new", size: [10, 6, 2], amount: [1, 1, 0],
				softness: 0.35, angle: 15 },
		],
	},

	"t-bloom": {
		summary: "A soft halftone bloom through the middle of the morph.",
		nodes: [
			{ op: "halftone", size: [2, 9, 2], amount: [0, 1, 0], softness: 0.4, angle: 15,
				window: [0.1, 0.9] },
		],
	},

	// ── fluid ────────────────────────────────────────────────────────
	// The two `stir` numbers are the PROVEN values from
	// designerTest/raster-spot.html, not fresh guesses: radius 0.055 is
	// the splat width at which consecutive pointer samples overlap into a
	// stroke rather than a wash, and resolution 256 is where the
	// deformation reads as soft instead of faceted.
	"liquid-hero": {
		summary: "A ripple that trails the pointer, then relaxes back in ~1.5s.",
		live: "enhanced",
		nodes: [{ op: "stir", by: "mouse", radius: 0.055, force: 2.2,
			strength: 16, curl: 0.8, resolution: 256, decay: 0.988 }],
	},
	linger: {
		summary: "The same current, held for four or five seconds. Only `decay` differs.",
		live: "enhanced",
		nodes: [{ op: "stir", by: "mouse", radius: 0.055, force: 2.2,
			strength: 7, curl: 0.8, resolution: 256, decay: 0.9985,
			dye: 0, sheen: 0 }],
	},
	// Divergence-free by construction, so it looks fluid with no solver —
	// and unlike `stir` it needs no float render targets.
	"flow-field": {
		summary: "A standing current across the whole element. No solver, runs anywhere.",
		nodes: [{ op: "flow", strength: 18, scale: 120, speed: 0.25 }],
	},
	"flow-pointer": {
		summary: "The same current, but only around the pointer.",
		nodes: [{ op: "flow", by: "mouse", strength: 26, scale: 100, radius: 320 }],
	},

	// ── print ────────────────────────────────────────────────────────
	"print-shop": {
		summary: "Offset-litho dot screen with white seams under the glyphs.",
		nodes: [{ op: "halftone", size: 6, angle: 15 },
			{ op: "edges", color: "#FFFFFF" }],
	},
	newsprint: {
		summary: "One-bit ordered dither — ink on paper, no greys.",
		nodes: [{ op: "dither", mono: true, ink: "#0B1B2B" }],
	},
	crt: {
		summary: "Posterised to a few levels, with a lens-like colour split.",
		nodes: [{ op: "dither", levels: 3 }, { op: "aberration", amount: 6 }],
	},

	// ── glass and lenses ─────────────────────────────────────────────
	glass: {
		summary: "Refractive metaball lens over untouched content.",
		nodes: [{ op: "blobs", refract: 70, dispersion: 1, frost: 0.25 }],
	},
	"hex-lens": {
		summary: "Hex cells rise toward the pointer; flush and invisible at rest.",
		nodes: [{ op: "hexalize", size: 26, lift: 0.3, by: "hover", radius: 220 }],
	},
	ripple: {
		summary: "The coordinate space pushes away from the pointer.",
		nodes: [{ op: "offset", by: "mouse", strength: 22, radius: 280 }],
	},

	// ── masked ───────────────────────────────────────────────────────
	// A field producer plus a consumer: the screen exists only inside a
	// disc that rides with the pointer. `compose()` renames "spot" when
	// this is combined with anything else that produces a field.
	spotlight: {
		summary: "A duotone disc that travels with the pointer; the rest is untouched.",
		nodes: [{ op: "mask", from: "radial", as: "spot", by: "mouse", radius: 200 },
			{ op: "duotone", masked: "spot", colors: ["#104B87", "#E8FF00"] }],
	},
	turbulent: {
		summary: "Animated noise drives the displacement, so the warp breathes.",
		nodes: [{ op: "noise", as: "turbulence", scale: 3, speed: 0.4 },
			{ op: "offset", masked: "turbulence", by: "static", strength: 30 }],
	},

	// ── temporal ─────────────────────────────────────────────────────
	echoes: {
		summary: "Changing content leaves a fading trail behind it.",
		live: "required",
		nodes: [{ op: "echo", decay: 0.92, strength: 0.85 }],
	},
	// The clearest live-only demonstration in the set, and the reason it is
	// worth having a second one: a long tinted trail over content that is
	// CHANGING. `echo` accumulates the texture into a persistent buffer, so
	// on the snapshot backend — one frozen image, re-uploaded never — the
	// accumulation converges to that same still frame and you see nothing
	// at all. That is not a bug to work around; it is the honest signal
	// that this effect needs per-frame capture of live DOM.
	//
	// Run it with the origin trial off and the content simply sits there.
	// Turn on chrome://flags/#canvas-draw-element and it smears.
	comet: {
		summary: "A long, tinted comet tail. Needs live capture — on snapshot you see nothing move.",
		live: "required",
		nodes: [{ op: "echo", decay: 0.975, strength: 0.95,
			tint: "#7FD4FF", tintAmount: 0.65 }],
	},
};

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Preset names, in declaration order. */
function presetNames() {
	return Object.keys(PRESETS);
}

/** `{ summary, live }` for a preset — what the gallery badges from. */
function presetInfo(name) {
	const def = PRESETS[name];
	if (!def) throw new Error("[nodality] " + didYouMean(name, presetNames(), "raster preset"));
	return { summary: def.summary, live: def.live };
}

/**
 * A preset's nodes, as a fresh array.
 *
 * `overrides` is applied to EVERY node in the chain, shallowly — which is
 * what you want for the single-node presets and for cross-cutting knobs
 * like `by:`; reach for the raw array when a multi-node chain needs
 * per-node control.
 *
 * Deep-cloned, so a caller mutating the result cannot corrupt the registry
 * for the next caller. That matters more than it sounds: the pipeline
 * writes to node objects (solver state, discovered uniform forms).
 */
function preset(name, overrides = {}) {
	const def = PRESETS[name];
	if (!def) throw new Error("[nodality] " + didYouMean(name, presetNames(), "raster preset"));
	return clone(def.nodes).map((node) => Object.assign(node, overrides));
}

// Which fields a chain writes (`as:`, defaulting to "mask") and which it
// reads (`masked:`, where `true` means the default field).
const producedField = (n) => (n.op === "mask" || n.op === "noise" ? (n.as || "mask") : null);
const consumedField = (n) =>
	n.masked === true ? "mask" : (typeof n.masked === "string" ? n.masked : null);

/**
 * Concatenate presets into one chain, safe against field collisions.
 *
 * Accepts names, `[name, overrides]` pairs, or raw node arrays:
 *
 *     compose("liquid-hero", "print-shop")
 *     compose(["ripple", { strength: 40 }], "newsprint")
 *     compose("spotlight", [{ op: "halftone" }])
 *
 * A field that a preset both produces and consumes is PRIVATE and gets
 * renamed (`spot` → `c0_spot`), so two presets that happen to use the same
 * field name cannot overwrite each other. A field consumed but not
 * produced within the same preset is left alone, so you can still wire one
 * preset's field into the next deliberately.
 *
 * Order is preserved and matters within a stage; across stages the
 * pipeline's own field→warp→cell→displace→color ordering applies, so
 * `compose("print-shop", "ripple")` and the reverse render the same.
 */
function compose(...parts) {
	const out = [];
	parts.forEach((part, i) => {
		const nodes = Array.isArray(part) && part.length && typeof part[0] === "object"
			? clone(part)                                     // raw node array
			: Array.isArray(part)
				? preset(part[0], part[1] || {})              // [name, overrides]
				: preset(part);                               // name

		// A field is PRIVATE to this part only if the part both produces
		// AND consumes it — that is a self-contained subgraph, and its
		// name is an implementation detail nobody outside should see.
		//
		// Produced-but-not-consumed is EXPOSED: the part is publishing a
		// field for a later part to read, so renaming it would break the
		// wiring. Consumed-but-not-produced is likewise left alone: the
		// part is reading someone else's field. Renaming either is how the
		// first draft of this broke deliberate cross-wiring.
		const produced = new Set(nodes.map(producedField).filter(Boolean));
		const consumed = new Set(nodes.map(consumedField).filter(Boolean));
		const isPrivate = (f) => produced.has(f) && consumed.has(f);
		const rename = (f) => `c${i}_${f}`;
		for (const node of nodes) {
			const p = producedField(node);
			if (p && isPrivate(p)) node.as = rename(p);
			const c = consumedField(node);
			if (c && isPrivate(c)) node.masked = rename(c);
		}
		out.push(...nodes);
	});
	return out;
}

/**
 * Every op name, driver and field reference in a chain, checked against the
 * live vocabulary. Returns `{ ok, errors }` — never throws, so a gallery
 * can render what is valid and report what is not.
 *
 * The field check is the one worth having: a `masked:` naming a field
 * nothing produces is not an error in the pipeline — the shader declares
 * every referenced field at 1.0, so the op simply renders unmasked. That
 * is a silent no-op, which is the bug class this library is least willing
 * to tolerate.
 */
function validateChain(nodes) {
	const errors = [];
	if (!Array.isArray(nodes)) return { ok: false, errors: ["chain must be an array"] };

	const produced = new Set();
	nodes.forEach((node, i) => {
		if (!node || typeof node !== "object" || typeof node.op !== "string") {
			errors.push(`[${i}] every node needs a string \`op\``);
			return;
		}
		if (!RASTER_OP_NAMES.includes(node.op)) {
			errors.push(`[${i}] ` + didYouMean(node.op, RASTER_OP_NAMES, "raster op"));
		}
		if (node.by != null && !DRIVER_NAMES.includes(node.by)) {
			errors.push(`[${i}] ` + didYouMean(node.by, DRIVER_NAMES, "driver"));
		}
		const p = producedField(node);
		if (p) produced.add(p);
	});

	// Second pass: a consumer may legitimately precede its producer in the
	// array, because fields resolve in the field stage before any other.
	nodes.forEach((node, i) => {
		const c = node && consumedField(node);
		if (c && !produced.has(c)) {
			errors.push(`[${i}] \`masked: ${JSON.stringify(node.masked)}\` names a field ` +
				`nothing in this chain produces, so the op renders unmasked. ` +
				`Fields produced here: ${[...produced].join(", ") || "(none)"}.`);
		}
	});

	return { ok: errors.length === 0, errors };
}

export { PRESETS, presetNames, presetInfo, preset, compose, validateChain };
