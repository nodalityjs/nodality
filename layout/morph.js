/*!
 * nodality v1.1.10
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// Levenshtein "did you mean" matching, shared with ElementMapper since
// phase P3. Pure, no DOM — importing it does not weaken the purity gate
// below, which is asserted by test rather than trusted.
import { suggest } from "../lib/suggest.js";

// morph.js — the pure core of the `morph` op.
//
// One spec in, ordinary Nodality out:
//
//   import { expand } from "nodality/morph";
//   const { elements, nodes, slots, meta } = expand(spec);
//   new Des().nodes(nodes).add(elements).set({ mount: "#mount" });
//
// Three properties this file exists to hold, all of them testable:
//
//   PURE      — nothing here touches the DOM at import time and nothing
//               imports layout/index.js (which reads `window` at module
//               scope). `node -e "await import('layout/morph.js')"` must
//               exit 0. That purity IS the agent contract and the SSG
//               story: expand() runs in a subprocess, in jsdom, in an MCP
//               server, with no browser anywhere.
//   DETERMINISTIC — no Date.now(), no Math.random(). Variation comes only
//               from mulberry32(seed), the default seed is the constant 1,
//               and every emission walks AXES / REGISTRY / bones in
//               DECLARATION order. Two expand() calls are deep-equal.
//   SEMANTIC  — the expansion emits element OPTIONS, never `keySet` and
//               never a <style> tag. If a style needs an option the
//               element classes do not have, the option gets added to the
//               class (with a `//@` annotation); the generator gets no
//               escape hatch. Users keep `keySet` for themselves.
//
// morphController() at the bottom is the one DOM-touching export. It is a
// function body, so importing this module still executes no DOM code.

// ── Design source ────────────────────────────────────────────────────
// Every mapping is lerp(min, max, t) and MUST remain affine — the closed
// -form inverse ((v - min) / (max - min)) is load-bearing for phase M7
// (lift). If you feel the need for a curve, put the curve in a morph
// PATH, never in the mapping.
const AXES = {
	split:   { css: "--nod-split",   map: { unit: "%",  min: 14, max: 40 }, default: 0.2 },
	density: { css: "--nod-density", map: { unit: "px", min: 8,  max: 48 }, default: 0.5 },   // gap
	radius:  { css: "--nod-radius",  map: { unit: "px", min: 0,  max: 24 }, default: 0.6 },
	motion:  { css: "--nod-motion",  map: { unit: "",   min: 0,  max: 1  }, default: 0.4 },
};

// The rest of the design source: the magnitudes the registry interpolates.
// They live here so no expand() body carries a literal — a px number typed
// inside an expand() is the smell this block removes.
const SCALE = {
	inset: "12px",   // how far a `floating` nav sits off its edges
	layer: 10,       // nav stacking order, above page content
	speed: "0.4s",   // the motion axis multiplies this into transitions
	dense: "24px",   // a `dense` region's padding ceiling — tighter than the
	                 // full density ramp, which is how a sidebar earns its width
	// Height cap for the DESKTOP bar only. A mobile bar must be free to
	// grow: it stacks in a column and the open hamburger adds the whole
	// link list below the brand, so a cap there clips the menu instead of
	// sizing it. (Matching the production Gesos nav, which caps DesktopBar
	// at 100px and passes no height to MobileBar at all.)
	bar: "100px",
	navBreak: "1200px", // where the Switcher swaps MobileBar → DesktopBar
};

// Role → fluid type scale step, and role → semantic tag. Two tables, one
// row per role, so a role's size and its element type are each stated once.
//
// The mapping is GLOBAL, so a role means one size everywhere: `side` uses
// `heading` rather than reusing `title`, which would drag the hero's S1 into
// a 240px column. M4 should move this onto the kind, where it belongs.
const TYPE = { brand: "S5", title: "S1", sub: "S4", button: "S6", heading: "S4", body: "S6", label: "S6" };
const TAG  = { brand: "h3", title: "h1", sub: "p",  button: "a",  heading: "h4", body: "p",  label: "a"  };

// The box the allocator solves against at expand time — the poster values
// baked into prerendered HTML. M6 replaces the width with the measured
// container; until then it is a constant, because a time- or environment-
// derived default would break byte-determinism.
const CONTAINER = { width: 1200, height: 800 };

// Closed set. `required` never yields; the rest yield lowest-first.
const PRIORITY = { required: Infinity, high: 1, low: 0 };
// A track that declares a `min` but no priority yields first: an author who
// did not think about priority should not be the one who blocks the layout.
const DEFAULT_PRIORITY = "low";

const DEFAULT_SEED = 1;

const RESERVED = ["op", "target", "seed", "bones", "axes", "paths", "content"];

// ── PRNG ─────────────────────────────────────────────────────────────
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
return((t^t>>>14)>>>0)/4294967296}}

// ── Axis → CSS ───────────────────────────────────────────────────────
// The ONLY place an axis becomes CSS. Affine by construction: the emitted
// expression is lerp(min, max, t) with t = var(--nod-<axis>). `scale`
// re-bases the same lerp onto a design-source magnitude (a duration, an
// inset) — still lerp(0, scale, t), so M7 can still invert it.
function axisCalc(name, scale){
	const a = AXES[name];
	if (scale != null) return `calc(${scale} * var(${a.css}))`;
	const span = a.map.max - a.map.min;
	return `calc(${a.map.min}${a.map.unit} + ${span}${a.map.unit} * var(${a.css}))`;
}

// The numeric value of an axis at t, in its own unit.
function axisValue(name, t){
	const m = AXES[name].map;
	return m.min + (m.max - m.min) * t;
}

// ── Registry ─────────────────────────────────────────────────────────
// Data, and the single source of truth: the region vocabulary, the token
// vocabulary, the slot roles, and — in M4 — the .d.ts unions and the docs
// token table are all read from here.
//
// Every expand(ctx) returns { options?, children? }. ctx is
// { axes, seed, rng, slotId(role), content }.
const REGISTRY = {
	nav: {
		region: true,
		// `type: "nav"` is a Switcher over a MobileBar / DesktopBar pair —
		// the shape ElementMapper.protoNav already builds and the shape the
		// production Gesos nav uses. The hamburger lives on MobileBar and
		// the breakpoint swap is the Switcher's whole job, so responsive
		// behaviour is inherited rather than reimplemented. (UINavBar was
		// the wrong target: one bar that tries to be both, with a hardcoded
		// 600px query and a one-way show/hide.)
		element: "nav",
		slots: ["brand"],
		expand: () => ({ options: {
			// The width at which the Switcher swaps mobile → desktop.
			breakpoint: SCALE.navBreak,
			maxHeight: SCALE.bar,
		} }),
		// A region's array holds tokens (strings) AND kinds (objects), the
		// same shape `main` uses for its sections. Three links is three
		// `{ kind: "link" }` entries, and §2.5's repeated-kind indexing
		// gives them ids without a `count` concept having to exist.
		kinds: {
			link: {
				slots: ["label"],
				bare: true,
				expand: (ctx) => ({ children: [linkEl(ctx, "label", SCALE.dense)] }),
			},
		},
		tokens: {
			// Detached from the edges — the bars' own `mar` inset.
			floating: {
				conflictsWith: ["pinned"],
				expand: () => ({ options: { mar: [{ a: SCALE.inset }] } }),
			},
			// Flush: no inset at all.
			pinned: {
				conflictsWith: ["floating"],
				expand: () => ({ options: { mar: [{ a: 0 }] } }),
			},
			// MobileBar and DesktopBar both honour `radius`'s VALUE
			// (`obj.radius && (style.borderRadius = obj.radius)`), so the
			// corner really does ride the axis here.
			rounded: {
				expand: () => ({ options: { radius: axisCalc("radius") } }),
			},
		},
	},

	// The column `@split` is actually about. MORPH-PLAN's canonical bones are
	// `areas: ["nav nav", "side main"]` with `cols: ["@split", "1fr"]` — the
	// split sizes the SIDE, not the nav. MORPH-MVP dropped this region while
	// keeping `@split`, which is what left that track with no owner.
	side: {
		region: true,
		tag: "aside",
		slots: ["heading", "body"],
		expand: () => ({ options: { pad: [{ a: axisCalc("density") }] } }),
		tokens: {
			// Rides with the scroll rather than leaving a dead column.
			sticky: { expand: () => ({ options: { sticky: true } }) },
			// Tighter than the content well beside it.
			dense: { expand: () => ({ options: { pad: [{ a: axisCalc("density", SCALE.dense) }] } }) },
			rounded: { expand: () => ({ options: { radius: axisCalc("radius") } }) },
		},
	},

	main: {
		region: true,
		tag: "main",
		sections: true,
	},

	section: {
		kinds: {
			hero: {
				slots: ["title", "sub"],
				expand: (ctx) => ({
					options: { pad: [{ a: axisCalc("density") }] },
					children: [
						textEl(ctx, "title"),
						textEl(ctx, "sub"),
					],
				}),
			},
			cta: {
				slots: ["button"],
				expand: (ctx) => ({
					options: { pad: [{ a: axisCalc("density") }], center: true },
					children: [linkEl(ctx, "button")],
				}),
			},
		},
	},

	effect: {
		// M2 implements the op inside lib/raster-ops.js; the token exists
		// here so a spec can be validated without a GPU anywhere near it.
		tokens: { flow: { drivers: ["mouse", "time"] } },
	},
};

const REGION_NAMES = Object.keys(REGISTRY).filter((k) => REGISTRY[k].region);

// ── Slot elements ────────────────────────────────────────────────────
// Slot ids are `<region>.<kind>.<role>` and are independent of `seed` —
// M7's diffing keys on them, so they are test-pinned. The DOM id is the
// same string with dots swapped for dashes, which keeps it usable as a
// plain CSS selector.
function slotElementId(slotId){
	return "nod-" + slotId.replace(/\./g, "-");
}

// Missing content renders its own id, visibly — never lorem, which hides
// the gap instead of showing it.
function slotText(ctx, role){
	const id = ctx.slotId(role);
	const v = ctx.content[id];
	if (v == null) return `[${id}]`;
	return typeof v === "object" ? String(v.text ?? `[${id}]`) : String(v);
}

function textEl(ctx, role){
	const id = ctx.slotId(role);
	return {
		type: TAG[role],
		id: slotElementId(id),
		size: TYPE[role],
		text: slotText(ctx, role),
	};
}

// `padScale` re-bases the padding onto a smaller design-source magnitude:
// a nav link wants the tight ramp, a page CTA the full one.
function linkEl(ctx, role, padScale){
	const id = ctx.slotId(role);
	const v = ctx.content[id];
	return {
		type: TAG[role],
		id: slotElementId(id),
		size: TYPE[role],
		text: slotText(ctx, role),
		url: (v && typeof v === "object" && v.url != null) ? String(v.url) : "#",
		radius: axisCalc("radius"),
		pad: [{ a: padScale ? axisCalc("density", padScale) : axisCalc("density") }],
	};
}

// ── Errors ───────────────────────────────────────────────────────────
// validate() never throws; expand() throws the first error as prose and
// carries the whole machine-readable report on err.report — that report is
// the repair loop M5's MCP server hands to agents.
const HEADLINE = {
	UNKNOWN_KEY:    (e) => `Unknown top-level key "${e.path}".`,
	UNKNOWN_TOKEN:  (e) => `Unknown token ${q(e.got)} in region "${regionOf(e.path)}".`,
	UNKNOWN_KIND:   (e) => `Unknown section kind ${q(e.got)} in region "${regionOf(e.path)}".`,
	UNKNOWN_SLOT:   (e) => `Unknown content slot ${q(e.got)}.`,
	UNKNOWN_DRIVER: (e) => `Unknown effect driver ${q(e.got)} at ${e.path}.`,
	BAD_AXIS:       (e) => `Bad axis at ${e.path}: ${describe(e.got)}.`,
	TOKEN_CONFLICT: (e) => `Token ${q(e.got)} conflicts with a token already in region "${regionOf(e.path)}".`,
	BAD_BONES:      (e) => `Bad bones at ${e.path || "bones"}: ${describe(e.got)}.`,
};

const VALID_LABEL = {
	UNKNOWN_KEY: "keys", UNKNOWN_TOKEN: "tokens", UNKNOWN_KIND: "kinds",
	UNKNOWN_SLOT: "slots", UNKNOWN_DRIVER: "drivers", BAD_AXIS: "axes",
	TOKEN_CONFLICT: "tokens", BAD_BONES: "values",
};

function regionOf(path){
	return String(path).split(/[.[]/)[0];
}

function describe(v){
	if (v === undefined) return "missing";
	if (typeof v === "string") return `"${v}"`;
	if (v === null || typeof v !== "object") return String(v);
	return Array.isArray(v) ? "an array" : "an object";
}

// `got` is usually the offending string, but a malformed region hands us a
// whole object — quoting that produces "[object Object]".
const q = (v) => (typeof v === "string" ? `"${v}"` : describe(v));

function errorProse(e){
	let out = HEADLINE[e.code](e);
	if (e.suggestions.length) out += `\n  Did you mean "${e.suggestions[0]}"?`;
	if (e.valid.length) out += `\n  Valid ${VALID_LABEL[e.code]}: ${e.valid.join(", ")}.`;
	return `${out}   (${e.code})`;
}

function layoutSpecError(report){
	const err = new Error(errorProse(report.errors[0]));
	err.name = "LayoutSpecError";
	err.report = report;
	return err;
}

// ── validate ─────────────────────────────────────────────────────────
function validate(spec){
	const errors = [];
	const push = (code, path, got, suggestions, valid) => {
		errors.push({ code, path, got, suggestions: suggestions || [], valid: valid || [] });
	};
	const s = (spec && typeof spec === "object" && !Array.isArray(spec)) ? spec : {};

	// --- axes -------------------------------------------------------
	const axisNames = Object.keys(AXES);
	const given = (s.axes && typeof s.axes === "object" && !Array.isArray(s.axes)) ? s.axes : null;
	if (s.axes !== undefined && !given) push("BAD_AXIS", "axes", s.axes, [], axisNames);
	if (given) {
		for (const name in given) {
			if (!(name in AXES)) {
				push("BAD_AXIS", `axes.${name}`, name, suggest(name, axisNames), axisNames);
				continue;
			}
			const v = given[name];
			if (typeof v !== "number" || !isFinite(v) || v < 0 || v > 1) {
				push("BAD_AXIS", `axes.${name}`, v, [], axisNames);
			}
		}
	}

	// --- bones ------------------------------------------------------
	const regions = regionKeys(s);
	checkBones(s.bones, given, regions, push);

	// --- regions ----------------------------------------------------
	const vocabulary = declaredRegions(s.bones);
	const keyVocabulary = RESERVED.concat(vocabulary);
	for (const key of Object.keys(s)) {
		if (RESERVED.includes(key)) continue;
		if (!vocabulary.includes(key)) {
			push("UNKNOWN_KEY", key, key, suggest(key, keyVocabulary), keyVocabulary);
			continue;
		}
		checkRegion(key, s[key], push);
	}

	// --- content ----------------------------------------------------
	if (s.content && typeof s.content === "object" && !Array.isArray(s.content)) {
		const ids = collectSlots(s, regions).map((sl) => sl.id);
		for (const key of Object.keys(s.content)) {
			if (!ids.includes(key)) push("UNKNOWN_SLOT", `content.${key}`, key, suggest(key, ids), ids);
		}
	}

	return { ok: errors.length === 0, errors };
}

// Top-level keys that are not reserved — the regions this page has, in
// declaration order.
function regionKeys(s){
	return Object.keys(s).filter((k) => !RESERVED.includes(k));
}

// The vocabulary a region key must belong to. `bones.areas` names the
// regions explicitly; without it the registry's region entries are the
// vocabulary, and a key outside both is the silently-dead-key bug that
// ground rule 4 exists to stop.
function declaredRegions(bones){
	const areas = (bones && !Array.isArray(bones) && bones.areas);
	if (!Array.isArray(areas)) return REGION_NAMES;
	const out = [];
	for (const row of areas) {
		for (const cell of String(row).trim().split(/\s+/)) {
			if (cell !== "." && !out.includes(cell)) out.push(cell);
		}
	}
	return out;
}

// The kinds a region may hold: its own vocabulary, or the shared `section`
// one. `nav` declares `link`; `main` borrows the section kinds.
function kindsOf(def){
	return def.kinds || (def.sections ? REGISTRY.section.kinds : null);
}

// A region's value is an array whose entries are STRINGS (tokens — how the
// region behaves) or OBJECTS (kinds — what it contains). One shape for
// every region, so `nav: ["floating", { kind: "link" }, { kind: "link" }]`
// needs no syntax that `main` did not already have.
function checkRegion(name, value, push){
	const def = REGISTRY[name];
	if (!def) return; // not a registry region (areas named it); nothing to check
	const tokens = def.tokens ? Object.keys(def.tokens) : [];
	const kinds = kindsOf(def);
	const kindNames = kinds ? Object.keys(kinds) : [];
	if (!Array.isArray(value)) {
		push(tokens.length ? "UNKNOWN_TOKEN" : "UNKNOWN_KIND", name, value, [],
			tokens.length ? tokens : kindNames);
		return;
	}

	const seen = [];
	value.forEach((entry, i) => {
		const path = `${name}[${i}]`;
		if (typeof entry === "string") {
			if (!tokens.length) {
				push("UNKNOWN_KIND", path, entry, suggest(entry, kindNames), kindNames);
				return;
			}
			if (!tokens.includes(entry)) {
				push("UNKNOWN_TOKEN", path, entry, suggest(entry, tokens), tokens);
				return;
			}
			const conflicts = def.tokens[entry].conflictsWith || [];
			if (conflicts.some((c) => seen.includes(c))) {
				// The fix is to drop one of the two, so the useful hint is
				// the tokens that WOULD compose with what is already there.
				const compatible = tokens.filter((v) =>
					v !== entry && !seen.includes(v) &&
					!(def.tokens[v].conflictsWith || []).some((c) => seen.includes(c)));
				push("TOKEN_CONFLICT", path, entry, compatible, tokens);
			}
			seen.push(entry);
			return;
		}

		const kind = entry && entry.kind;
		if (!kindNames.includes(kind)) {
			push("UNKNOWN_KIND", `${path}.kind`, kind, suggest(kind, kindNames), kindNames);
			return;
		}
		checkEffect(entry, path, push);
	});
}

function checkEffect(entry, path, push){
	if (entry.effect === undefined) return;
	const effects = Object.keys(REGISTRY.effect.tokens);
	if (!Array.isArray(entry.effect)) {
		push("UNKNOWN_TOKEN", `${path}.effect`, entry.effect, [], effects);
		return;
	}
	const [token, ...drivers] = entry.effect;
	if (!effects.includes(token)) {
		push("UNKNOWN_TOKEN", `${path}.effect[0]`, token, suggest(token, effects), effects);
		return;
	}
	const valid = REGISTRY.effect.tokens[token].drivers;
	drivers.forEach((d, j) => {
		if (!valid.includes(d)) {
			push("UNKNOWN_DRIVER", `${path}.effect[${j + 1}]`, d, suggest(d, valid), valid);
		}
	});
}

// ── bones ────────────────────────────────────────────────────────────
// A track is a string (`"@split"`, `"1fr"`, `"auto"`, `"240px"`, `"20%"`)
// or `{ size, min, max, priority }`. Any constrained track routes its
// whole dimension through the allocator.
const AXIS_REF = /^@([A-Za-z0-9_]+)$/;
const FR = /^([0-9.]+)fr$/;
const PX = /^(-?[0-9.]+)px$/;
const PCT = /^(-?[0-9.]+)%$/;

function checkBones(bones, axes, regions, push){
	if (bones === undefined) {
		push("BAD_BONES", "bones", undefined, [], ["cols", "rows", "gap", "areas"]);
		return;
	}
	const shape = Array.isArray(bones) ? { cols: bones } : bones;
	if (!shape || typeof shape !== "object") {
		push("BAD_BONES", "bones", bones, [], ["cols", "rows", "gap", "areas"]);
		return;
	}
	const keys = ["cols", "rows", "gap", "areas"];
	if (!Array.isArray(bones)) {
		for (const k of Object.keys(bones)) {
			if (!keys.includes(k)) push("BAD_BONES", `bones.${k}`, k, suggest(k, keys), keys);
		}
	}
	for (const dim of ["cols", "rows"]) {
		const list = shape[dim];
		if (list === undefined) continue;
		if (!Array.isArray(list)) { push("BAD_BONES", `bones.${dim}`, list, [], []); continue; }
		list.forEach((t, i) => checkTrack(t, `bones.${dim}[${i}]`, axes, push));
	}
	if (shape.gap !== undefined) checkTrack(shape.gap, "bones.gap", axes, push);

	if (Array.isArray(shape.areas)) {
		const widths = shape.areas.map((r) => String(r).trim().split(/\s+/).length);
		if (widths.some((w) => w !== widths[0])) {
			push("BAD_BONES", "bones.areas", shape.areas, [], []);
		}
		// A declared grid has to be the shape it says it is.
		if (Array.isArray(shape.cols) && widths[0] !== shape.cols.length) {
			push("BAD_BONES", "bones.areas", shape.areas, [], []);
		}
		if (Array.isArray(shape.rows) && shape.areas.length !== shape.rows.length) {
			push("BAD_BONES", "bones.rows", shape.rows, [], []);
		}
	} else if (regions.length && Array.isArray(shape.rows) && shape.rows.length !== regions.length) {
		// Without `areas`, each region takes a row — so a declared `rows`
		// has to have one track per region. Name the cells in `areas` when
		// the layout is not one-region-per-row.
		push("BAD_BONES", "bones.rows", shape.rows, [], []);
	}
}

function checkTrack(track, path, axes, push){
	const t = (track && typeof track === "object" && !Array.isArray(track)) ? track : { size: track };
	if (track && typeof track === "object" && !Array.isArray(track)) {
		const keys = ["size", "min", "max", "priority"];
		for (const k of Object.keys(track)) {
			if (!keys.includes(k)) push("BAD_BONES", `${path}.${k}`, k, suggest(k, keys), keys);
		}
	}
	if (typeof t.size !== "string") { push("BAD_BONES", `${path}.size`, t.size, [], []); return; }

	const ref = AXIS_REF.exec(t.size);
	if (ref) {
		const name = ref[1];
		const axisNames = Object.keys(AXES);
		if (!(name in AXES)) {
			push("BAD_BONES", `${path}.size`, t.size, suggest(name, axisNames), axisNames);
		} else if (AXES[name].map.unit === "") {
			// A unitless axis is a factor, not a length: it cannot size a track.
			push("BAD_BONES", `${path}.size`, t.size, [], axisNames.filter((n) => AXES[n].map.unit !== ""));
		} else if (!axes || !(name in axes)) {
			// Routing a track through an axis means stating that axis's value.
			push("BAD_AXIS", `axes.${name}`, undefined, [], axisNames);
		}
	} else if (!FR.test(t.size) && !PX.test(t.size) && !PCT.test(t.size) && t.size !== "auto") {
		push("BAD_BONES", `${path}.size`, t.size, [], ["@<axis>", "<n>fr", "<n>px", "<n>%", "auto"]);
	}

	for (const bound of ["min", "max"]) {
		if (t[bound] === undefined) continue;
		if (typeof t[bound] !== "string" || !PX.test(t[bound])) {
			push("BAD_BONES", `${path}.${bound}`, t[bound], [], ["<n>px"]);
		}
	}
	if (t.priority !== undefined && !(t.priority in PRIORITY)) {
		const names = Object.keys(PRIORITY);
		push("BAD_BONES", `${path}.priority`, t.priority, suggest(t.priority, names), names);
	}
}

// Normalize one declared track into the record the allocator and the CSS
// emitter both read.
function normalizeTrack(track, id){
	const t = (track && typeof track === "object" && !Array.isArray(track)) ? track : { size: track };
	const ref = AXIS_REF.exec(t.size);
	const constrained = t.min !== undefined || t.max !== undefined || t.priority !== undefined;
	return {
		id,
		size: t.size,
		axis: ref ? ref[1] : null,
		fr: FR.test(t.size) ? parseFloat(FR.exec(t.size)[1]) : null,
		min: t.min === undefined ? 0 : parseFloat(PX.exec(t.min)[1]),
		max: t.max === undefined ? null : parseFloat(PX.exec(t.max)[1]),
		priority: PRIORITY[t.priority === undefined ? DEFAULT_PRIORITY : t.priority],
		constrained,
	};
}

// Rows a spec did not declare: one per region, content-sized, except the
// last which fills what is left. That is what `["auto", "1fr"]` spells out
// for a nav above a main, so the default and the written form agree.
function defaultRows(regions){
	if (!regions.length) return ["1fr"];
	return regions.map((_, i) => (i === regions.length - 1 ? "1fr" : "auto"));
}

function normalizeBones(bones, regions){
	const shape = Array.isArray(bones) ? { cols: bones } : bones;
	const cols = (shape.cols || ["1fr"]).map((t, i) => normalizeTrack(t, `cols-${i}`));
	const rows = (shape.rows || defaultRows(regions)).map((t, i) => normalizeTrack(t, `rows-${i}`));
	const gap = shape.gap === undefined ? null : normalizeTrack(shape.gap, "gap");
	// `areas` as declared, or synthesized ROW-MAJOR: each region takes a row
	// and spans every column, in declaration order. A nav belongs across the
	// top, not down one side — and it is what MORPH-PLAN's canonical
	// `areas: ["nav nav", "side main"]` does with its first row. To put a
	// region in a single column, name it in `areas` and let `@split` size
	// that column; that is what the `side` region is for.
	const areas = Array.isArray(shape.areas)
		? shape.areas.map((r) => String(r).trim().split(/\s+/).join(" "))
		: regions.map((r) => new Array(cols.length).fill(r).join(" "));
	return { cols, rows, gap, areas };
}

// ── The allocator ────────────────────────────────────────────────────
// Taken verbatim from MORPH-MVP.md's appendix (written and executed
// 2026-08-08; the traces there are real output). `pref` is a track's
// preferred size in px; the solver distributes the container in that
// proportion, freezing any track whose share would break its min or max
// and re-dividing what is left. Freezes at least one track per pass, so
// it terminates.
const REQUIRED = Infinity;

function tryAllocate(container, tracks, relaxed) {
	const minOf = t => (relaxed.has(t.id) ? 0 : (t.min ?? 0));
	if (tracks.reduce((s, t) => s + minOf(t), 0) > container) return null;
	const frozen = new Map();
	for (let pass = 0; pass <= tracks.length; pass++) {  // freezes ≥1/pass → terminates
		const free = tracks.filter(t => !frozen.has(t.id));
		if (!free.length) break;
		const remaining = container - [...frozen.values()].reduce((a, b) => a + b, 0);
		const sumPref = free.reduce((s, t) => s + t.pref, 0) || 1;
		const ideal = t => remaining * t.pref / sumPref;
		const violator = free.find(t => ideal(t) < minOf(t) || ideal(t) > (t.max ?? Infinity));
		if (!violator) { free.forEach(t => frozen.set(t.id, ideal(t))); break; }
		frozen.set(violator.id,
			Math.min(Math.max(ideal(violator), minOf(violator)), violator.max ?? Infinity));
	}
	return Object.fromEntries(frozen);
}

// Integer px with largest-remainder distribution, so Σ sizes === container
// EXACTLY — a browser given tracks that sum to 1199 or 1201 reflows the
// last one, which is visible as a 1px jitter while a slider is dragged.
// Equal remainders go to the first-declared track (Array.prototype.sort is
// stable since ES2019, and `order` is built in declaration order).
function roundSizes(container, tracks, sizes){
	const total = Math.round(container);
	const order = tracks.filter((t) => t.id in sizes);
	if (!order.length) return {};
	const px = order.map((t) => Math.max(0, Math.floor(sizes[t.id])));
	const rem = order.map((t, i) => ({ i, r: Math.max(0, sizes[t.id]) - px[i] }));
	rem.sort((a, b) => b.r - a.r);
	let left = total - px.reduce((a, b) => a + b, 0);
	for (let k = 0; left > 0; k++, left--) px[rem[k % rem.length].i] += 1;
	const out = {};
	order.forEach((t, i) => { out[t.id] = px[i]; });
	return out;
}

function allocate(container, tracks) {
	const relaxed = new Set();
	for (;;) {
		const sizes = tryAllocate(container, tracks, relaxed);
		if (sizes) {
			return { sizes, relaxed: [...relaxed], rounded: roundSizes(container, tracks, sizes) };
		}
		const next = tracks                                // lowest priority yields first
			.filter(t => (t.min ?? 0) > 0 && !relaxed.has(t.id) && t.priority !== REQUIRED)
			.sort((a, b) => a.priority - b.priority)[0];
		if (!next) throw new Error("unsatisfiable: required mins exceed container");
		relaxed.add(next.id);
	}
}

// ── Solving a dimension ──────────────────────────────────────────────
// A track's preferred px at the current axis values. `fr` tracks share
// whatever the sized ones leave over, which is what makes the appendix's
// desktop trace (side 324 + gap 28 + main 848 = 1200) come out exact.
function preferredSizes(tracks, axes, container){
	const pref = new Map();
	let fixed = 0, frSum = 0;
	for (const t of tracks) {
		if (t.fr != null) { frSum += t.fr; continue; }
		let px = 0;
		if (t.axis) {
			const v = axisValue(t.axis, axes[t.axis]);
			px = AXES[t.axis].map.unit === "%" ? (v / 100) * container : v;
		} else if (PX.test(t.size)) {
			px = parseFloat(PX.exec(t.size)[1]);
		} else if (PCT.test(t.size)) {
			px = (parseFloat(PCT.exec(t.size)[1]) / 100) * container;
		}
		px *= t.span || 1;
		pref.set(t.id, px);
		fixed += px;
	}
	const leftover = Math.max(0, container - fixed);
	for (const t of tracks) {
		if (t.fr == null) continue;
		pref.set(t.id, frSum > 0 ? (leftover * t.fr) / frSum : 0);
	}
	return tracks.map((t) => ({ ...t, pref: pref.get(t.id) }));
}

// One solved dimension. The gap joins the dimension as a single track
// carrying all (n-1) gutters, so a 2-column grid reduces exactly to the
// appendix's three-track model and wider grids stay correct.
function solveDimension(dim, tracks, gap, container, axes){
	const span = Math.max(0, tracks.length - 1);
	// The gap's bounds are per-gutter; the track carries all of them, so
	// they scale with the gutter count too.
	const gapTrack = gap && {
		...gap, id: "gap", span,
		min: gap.min * span,
		max: gap.max == null ? null : gap.max * span,
	};
	// Declaration order, gutters sitting between the tracks they separate.
	const list = gapTrack && span > 0
		? [tracks[0], gapTrack, ...tracks.slice(1)]
		: tracks.slice();
	if (list.some((t) => t.size === "auto")) {
		const e = new Error(
			`[nodality] morph: an "auto" track cannot be resolved by the allocator ` +
			`(bones.${dim}); give it a size, or drop the constraints on that dimension.`);
		e.name = "LayoutSpecError";
		throw e;
	}
	const { sizes, relaxed, rounded } = allocate(container, preferredSizes(list, axes, container));
	const vars = {};
	for (const t of list) {
		if (!(t.id in rounded)) continue;
		vars[`--nod-${t.id}`] = t.id === "gap"
			? `${Math.round(rounded[t.id] / t.span)}px`
			: `${rounded[t.id]}px`;
	}
	return { vars, sizes, relaxed, list };
}

// Everything the grid shell needs: the CSS for cols/rows/gap plus, when a
// dimension is constrained, the track model morphController re-solves on
// every axis stroke.
function solveBones(bones, axes){
	const vars = {};
	const tracks = {};
	const cssFor = (dim) => bones[dim].map((t) =>
		(t.axis ? axisCalc(t.axis) : t.size)).join(" ");

	let cols = cssFor("cols");
	let rows = cssFor("rows");
	let gap = bones.gap
		? (bones.gap.axis ? axisCalc(bones.gap.axis) : bones.gap.size)
		: null;

	const constrained = (list) => list.some((t) => t.constrained);
	const gapConstrained = !!(bones.gap && bones.gap.constrained);

	// The gap is one gutter shared by both dimensions, so it is solved with
	// the first dimension that needs solving and read as a fixed size by
	// the second.
	let gapOwner = null;
	for (const dim of ["cols", "rows"]) {
		const needs = constrained(bones[dim]) || (gapConstrained && !gapOwner);
		if (!needs) continue;
		const box = dim === "cols" ? CONTAINER.width : CONTAINER.height;
		const gapForDim = bones.gap && !gapOwner ? bones.gap : null;
		const solved = solveDimension(dim, bones[dim], gapForDim, box, axes);
		Object.assign(vars, solved.vars);
		tracks[dim] = { container: box, list: solved.list };
		if (gapForDim) gapOwner = dim;
		const css = bones[dim].map((t) => `var(--nod-${t.id})`).join(" ");
		if (dim === "cols") cols = css; else rows = css;
	}
	if (gapOwner) gap = "var(--nod-gap)";

	return { cols, rows, gap, vars, tracks };
}

// Re-solve every constrained dimension at the given axis values. Pure, and
// shared by expand() (build-time poster values) and morphController()
// (every stroke) — which is why prerendered and live output agree.
function solveTracks(tracks, axes){
	const vars = {};
	for (const dim in tracks) {
		const { container, list } = tracks[dim];
		const { rounded } = allocate(container, preferredSizes(list, axes, container));
		for (const t of list) {
			if (!(t.id in rounded)) continue;
			vars[`--nod-${t.id}`] = t.id === "gap"
				? `${Math.round(rounded[t.id] / t.span)}px`
				: `${rounded[t.id]}px`;
		}
	}
	return vars;
}

// ── Slots ────────────────────────────────────────────────────────────
// Deterministic and seed-independent: `<region>.<kind>.<role>`, and a kind
// that repeats within a region takes an index from its second occurrence
// on (`main.features1.title`).
function collectSlots(s, regions){
	const out = [];
	for (const region of regions) {
		const def = REGISTRY[region];
		if (!def) continue;
		if (def.slots) {
			for (const role of def.slots) out.push({ id: `${region}.${role}`, kind: region });
		}
		const kinds = kindsOf(def);
		if (!kinds || !Array.isArray(s[region])) continue;
		const seen = {};
		for (const entry of s[region]) {
			if (!entry || typeof entry !== "object") continue;   // a token
			const kind = entry.kind;
			const def2 = kinds[kind];
			if (!def2) continue;
			const n = seen[kind] = (seen[kind] || 0);
			seen[kind] = n + 1;
			const name = n === 0 ? kind : `${kind}${n}`;
			for (const role of def2.slots) {
				out.push({ id: `${region}.${name}.${role}`, kind });
			}
		}
	}
	return out;
}

// ── expand ───────────────────────────────────────────────────────────
function expand(spec){
	const report = validate(spec);
	if (!report.ok) throw layoutSpecError(report);

	const s = spec;
	const seed = s.seed == null ? DEFAULT_SEED : s.seed;
	const rng = mulberry32(seed);
	const content = (s.content && typeof s.content === "object") ? s.content : {};

	// AXES declaration order, spec values overriding the design defaults.
	const axes = {};
	for (const name in AXES) {
		axes[name] = (s.axes && typeof s.axes[name] === "number") ? s.axes[name] : AXES[name].default;
	}

	const regions = regionKeys(s);
	const bones = normalizeBones(s.bones, regions);
	const solved = solveBones(bones, axes);

	const vars = {};
	for (const name in AXES) vars[AXES[name].css] = axes[name];
	Object.assign(vars, solved.vars);

	const slots = collectSlots(s, regions);
	const rootId = "nod-" + s.target;
	const children = regions.map((region) => expandRegion(region, s[region], { axes, seed, rng, content }));

	const root = {
		type: "wrap",
		name: s.target,
		id: rootId,
		disp: "grid",
		cols: solved.cols,
		rows: solved.rows,
		areas: bones.areas.map((r) => `"${r}"`).join(" "),
		vars,
		children,
	};
	if (solved.gap) root.gap = solved.gap;

	return {
		elements: [root],
		nodes: [],
		slots,
		meta: { rootId, vars, tracks: solved.tracks, slots },
	};
}

function expandRegion(region, value, base){
	const def = REGISTRY[region];
	const el = {
		// A region is an ordinary Wrapper unless the registry names a
		// dedicated element for it — `nav` is a UINavBar.
		type: (def && def.element) || "wrap",
		id: `nod-${region}`,
		name: region,
		area: region,
		children: [],
	};
	if (def && def.tag) el.kind = def.tag;
	if (!def) return el;

	// Base options first, so a token always has the last word over them.
	if (def.expand) Object.assign(el, def.expand({ ...base, slotId: (r) => `${region}.${r}` }).options);

	// Region-level slots (nav.brand) come before any tokens touch the box.
	if (def.slots) {
		const ctx = { ...base, slotId: (role) => `${region}.${role}` };
		for (const role of def.slots) el.children.push(textEl(ctx, role));
	}

	const kinds = kindsOf(def);
	if (Array.isArray(value)) {
		const seen = {};
		for (const entry of value) {                       // declaration order
			if (typeof entry === "string") {
				const out = def.tokens[entry].expand({ ...base, slotId: (r) => `${region}.${r}` });
				Object.assign(el, out.options);
				if (out.children) el.children.push(...out.children);
				continue;
			}
			const kind = entry.kind;
			const n = seen[kind] = (seen[kind] || 0);
			seen[kind] = n + 1;
			const name = n === 0 ? kind : `${kind}${n}`;
			el.children.push(expandKind(region, name, kind, entry, base, kinds));
		}
	}
	return el;
}

function expandKind(region, name, kind, section, base, kinds){
	const def = kinds[kind];
	const ctx = { ...base, slotId: (role) => `${region}.${name}.${role}` };
	const out = def.expand(ctx);
	// A `bare` kind IS its single element — a nav link is an <a>, not an <a>
	// inside a section wrapper that exists only because the machinery does.
	if (def.bare) return out.children[0];
	const el = {
		type: "wrap",
		kind: "section",
		id: `nod-${region}-${name}`,
		name: `${region}.${name}`,
		children: out.children || [],
		...out.options,
	};
	// `effect` is not a new element capability — it is the existing
	// `raster:` option, which every class already accepts through
	// commonMethods. One mapping, no wiring.
	if (Array.isArray(section.effect)) {
		const [op, ...drivers] = section.effect;
		const node = { op, seed: Math.floor(base.rng() * 0x100000000) };
		if (drivers.length) node.by = drivers[0];
		el.raster = [node];
	}
	return el;
}

// ── morphController — the only DOM-touching export ───────────────────
// Two call forms, one implementation:
//
//   morphController(spec)           — derives meta by running the pure
//                                     expansion, finds #nod-<target> itself
//   morphController(meta, rootEl)   — for callers that already expanded
//
// Every stroke writes custom properties and nothing else: no DOM
// mutations, no re-render, no style tag. That is the whole claim, and the
// demo page's mutation counter is what proves it.
function morphController(specOrMeta, rootEl){
	const meta = (specOrMeta && specOrMeta.rootId) ? specOrMeta : expand(specOrMeta).meta;
	const root = rootEl ||
		(typeof document !== "undefined" ? document.getElementById(meta.rootId) : null);
	if (!root) {
		throw new Error(`[nodality] morph: no element with id "${meta.rootId}" — ` +
			`mount the expansion before creating the controller, or pass the root element.`);
	}

	// Current axis values, read back out of the vars the expansion emitted.
	const axes = {};
	for (const name in AXES) axes[name] = meta.vars[AXES[name].css];
	const hasTracks = meta.tracks && Object.keys(meta.tracks).length > 0;
	const slotIds = (meta.slots || []).map((sl) => sl.id);

	const write = (name) => {
		root.style.setProperty(AXES[name].css, String(axes[name]));
		if (!hasTracks) return;
		const solved = solveTracks(meta.tracks, axes);
		for (const key in solved) root.style.setProperty(key, solved[key]);
	};

	const api = {
		axis(name, v){
			if (!(name in AXES)) {
				const names = Object.keys(AXES);
				throw new Error(`[nodality] morph: unknown axis "${name}". ` +
					`Valid axes: ${names.join(", ")}.`);
			}
			axes[name] = Math.min(1, Math.max(0, Number(v)));
			write(name);
			return api;
		},
		axes(map){
			for (const name in map) api.axis(name, map[name]);
			return api;
		},
		content(slotId, value){
			if (!slotIds.includes(slotId)) {
				throw new Error(`[nodality] morph: unknown content slot "${slotId}". ` +
					`Valid slots: ${slotIds.join(", ")}.`);
			}
			const id = slotElementId(slotId);
			const node = root.querySelector(`#${id}`) ||
				(typeof document !== "undefined" ? document.getElementById(id) : null);
			if (node) node.textContent = typeof value === "object" && value ? String(value.text) : String(value);
			return api;
		},
		dispose(){ return api; },
	};
	return api;
}

export { expand, validate, allocate, REGISTRY, AXES, morphController, mulberry32 };
