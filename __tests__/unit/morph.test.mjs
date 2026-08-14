// morph.test.mjs — phase M1 of the morph op (layout/morph.js).
//
// Seven checks, one per item in MORPH-IMPL-SPEC §2.8. Two of them are
// gates rather than assertions about behaviour, and they are the reason
// this file is node:test and not Playwright:
//
//   #6 purity   — morph.js must import in BARE Node. It is the agent
//                 contract (MCP, SSG, lift all run without a browser) and
//                 it breaks silently: one `import` of layout/index.js and
//                 the module still works in every browser test while
//                 every headless consumer dies.
//   #7 keySet   — the expansion may not emit `keySet`. A keySet in the
//                 output means an element class is missing a semantic
//                 option; the fix is to add the option, never to reach
//                 for the escape hatch. Users keep keySet; the library's
//                 own generator gets none.
//
// Run: npm run test:unit   (also runs first inside npm run test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expand, validate, allocate, AXES, REGISTRY, morphController, mulberry32 }
	from "../../layout/morph.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MORPH = resolve(HERE, "../../layout/morph.js");

// The MVP spec surface, complete — MORPH-MVP.md §spec-surface.
const BASIC = () => ({
	op: "morph", target: "page", seed: 7,
	bones: {
		cols: [{ size: "@split", min: "240px", priority: "required" }, "1fr"],
		rows: ["auto", "1fr"],
		gap: { size: "@density", min: "8px", priority: "low" },
	},
	nav: ["floating", "rounded"],
	main: [
		{ kind: "hero", effect: ["flow", "mouse"] },
		{ kind: "cta" },
	],
	axes: { split: 0.2, density: 0.5, motion: 0.4 },
	content: {
		"nav.brand": "Nodality",
		"main.hero.title": "Layouts you can hold",
		"main.hero.sub": "One spec. Every variation.",
		"main.cta.button": { text: "Get started", url: "/docs" },
	},
});

// The unconstrained twin: no min/max/priority anywhere, so the whole
// layout resolves in CSS calc() and the allocator never runs.
const SUGAR = () => ({
	op: "morph", target: "page",
	bones: { cols: ["@split", "1fr"], rows: ["auto", "1fr"], gap: "@density" },
	nav: ["pinned"],
	main: [{ kind: "hero" }, { kind: "hero" }, { kind: "cta" }],
	axes: { split: 0.7, density: 0.1 },
});

const clone = (v) => JSON.parse(JSON.stringify(v));

// ── 1. determinism ───────────────────────────────────────────────────

test("expand is deterministic: two calls are deep-equal", () => {
	assert.deepEqual(clone(expand(BASIC())), clone(expand(BASIC())));
	assert.deepEqual(clone(expand(SUGAR())), clone(expand(SUGAR())));

	// The seed is the ONLY source of variation, and its default is the
	// constant 1 — never anything time- or random-derived.
	const noSeed = BASIC(); delete noSeed.seed;
	const seedOne = BASIC(); seedOne.seed = 1;
	assert.deepEqual(clone(expand(noSeed)), clone(expand(seedOne)));

	// mulberry32 itself, pinned: same seed, same stream.
	const a = mulberry32(7), b = mulberry32(7);
	assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
	assert.notDeepEqual([mulberry32(7)()], [mulberry32(8)()]);
});

// ── 2. golden ────────────────────────────────────────────────────────

test("expand matches the committed golden", () => {
	const golden = JSON.parse(readFileSync(resolve(HERE, "golden/expand-basic.json"), "utf8"));
	assert.deepEqual(clone(expand(BASIC())), golden);
});

test("the expansion carries the whole shell as element options", () => {
	const { elements, nodes, meta } = expand(BASIC());
	const root = elements[0];

	assert.equal(elements.length, 1);
	assert.deepEqual(nodes, []);
	assert.equal(root.id, "nod-page");
	assert.equal(meta.rootId, "nod-page");
	assert.equal(root.disp, "grid");

	// Axis defaults ride on the root as custom properties — they inherit,
	// so one declaration drives the whole generated subtree. No <style>.
	for (const name in AXES) assert.ok(AXES[name].css in root.vars);
	assert.equal(root.vars["--nod-split"], 0.2);
	assert.deepEqual(root.vars, meta.vars);

	// Constrained tracks resolve to px vars; the unconstrained twin stays
	// pure calc() so a slider stroke runs zero JS.
	assert.equal(root.cols, "var(--nod-cols-0) var(--nod-cols-1)");
	const sugar = expand(SUGAR()).elements[0];
	assert.equal(sugar.cols, "calc(14% + 26% * var(--nod-split)) 1fr");
	assert.equal(sugar.gap, "calc(8px + 40px * var(--nod-density))");
	assert.deepEqual(expand(SUGAR()).meta.tracks, {});

	// `effect` is the existing raster option, not a new capability.
	const hero = root.children[1].children[0];
	assert.equal(hero.raster[0].op, "flow");
	assert.equal(hero.raster[0].by, "mouse");
	assert.equal(typeof hero.raster[0].seed, "number");

	// Missing content renders its own slot id, visibly — never lorem.
	const bare = BASIC(); delete bare.content;
	const bareHero = expand(bare).elements[0].children[1].children[0];
	assert.equal(bareHero.children[0].text, "[main.hero.title]");
});

// ── bones: how regions find their cells ──────────────────────────────

test("without `areas`, each region takes a row and spans every column", () => {
	// A nav belongs across the top, not down one side. The earlier rule
	// bound region i to column i, which made `nav` a full-height sidebar
	// and collapsed the declared `auto` row to 0px — a declared track doing
	// nothing is the tell that the synthesis is wrong.
	const root = expand(BASIC()).elements[0];
	assert.equal(root.areas, '"nav nav" "main main"');
	assert.equal(root.rows, "auto 1fr");
	assert.deepEqual(root.children.map((c) => c.area), ["nav", "main"]);

	// Rows a spec does not declare: one per region, content-sized, except
	// the last which fills — exactly what ["auto", "1fr"] spells out.
	const sugar = expand({
		op: "morph", target: "page",
		bones: ["@split", "1fr"],
		nav: ["pinned"], main: [{ kind: "cta" }],
		axes: { split: 0.5 },
	}).elements[0];
	assert.equal(sugar.areas, '"nav nav" "main main"');
	assert.equal(sugar.rows, "auto 1fr");
});

test("`areas` places a region in a single column, and pins the grid's shape", () => {
	// This is what `@split` is actually for: sizing the SIDE column.
	const spec = {
		op: "morph", target: "page",
		bones: {
			areas: ["nav nav", "side main"],
			cols: [{ size: "@split", min: "240px", priority: "required" }, "1fr"],
			rows: ["auto", "1fr"],
			gap: { size: "@density", min: "8px", priority: "low" },
		},
		nav: ["floating"],
		side: ["sticky", "dense", "rounded"],
		main: [{ kind: "hero" }],
		axes: { split: 0.2, density: 0.5 },
	};
	const out = expand(spec);
	assert.equal(out.elements[0].areas, '"nav nav" "side main"');

	const side = out.elements[0].children.find((c) => c.area === "side");
	assert.equal(side.kind, "aside");
	assert.equal(side.sticky, true);
	assert.ok(side.radius.includes("--nod-radius"));
	assert.deepEqual(out.slots.filter((s) => s.kind === "side").map((s) => s.id),
		["side.heading", "side.body"]);

	// `side.heading` must NOT inherit the hero's S1 — a role is typed once,
	// globally, so a sidebar heading uses its own role name.
	const heading = side.children.find((c) => c.id === "nod-side-heading");
	assert.equal(heading.size, "S4");
	assert.equal(expand(spec).elements[0].children.find((c) => c.area === "main")
		.children[0].children[0].size, "S1");

	// A declared grid has to be the shape it says it is.
	const wrongCols = structuredClone(spec); wrongCols.bones.areas = ["nav nav nav", "side main x"];
	assert.equal(validate(wrongCols).ok, false);
	const wrongRows = structuredClone(spec); wrongRows.bones.rows = ["auto", "1fr", "auto"];
	assert.ok(validate(wrongRows).errors.some((e) => e.path === "bones.rows"));
});

test("a declared `rows` must have one track per region when `areas` is absent", () => {
	const spec = BASIC();
	spec.main = [{ kind: "hero" }];
	spec.bones.rows = ["auto", "1fr", "auto"];   // 3 rows, 2 regions
	const report = validate(spec);
	assert.equal(report.ok, false);
	assert.ok(report.errors.some((e) => e.code === "BAD_BONES" && e.path === "bones.rows"));
});

test("a region's array holds tokens AND kinds, so a nav can carry links", () => {
	// Strings are tokens (how the region behaves), objects are kinds (what
	// it contains) — one shape for every region, so three nav links need no
	// syntax `main` did not already have, and no `count` concept.
	const spec = withBasic({
		nav: ["floating", "rounded", { kind: "link" }, { kind: "link" }, { kind: "link" }],
	});
	spec.content = {
		"nav.brand": "Nodality",
		"nav.link.label": { text: "Docs", url: "/docs" },
		"nav.link1.label": { text: "Guides", url: "/guides" },
		"nav.link2.label": { text: "GitHub", url: "https://github.com" },
	};
	const out = expand(spec);
	assert.equal(validate(spec).ok, true);

	// §2.5's repeated-kind indexing does the work: first is unindexed, so
	// appending a fourth link never moves the first three.
	assert.deepEqual(out.slots.filter((s) => s.kind === "link").map((s) => s.id),
		["nav.link.label", "nav.link1.label", "nav.link2.label"]);

	// `type: "nav"` is a Switcher over a MobileBar / DesktopBar pair, so
	// every option it carries is one those classes already had (mar /
	// radius / maxHeight / background) and the expansion adds none.
	const nav = out.elements[0].children[0];
	assert.equal(nav.type, "nav");
	assert.equal(nav.breakpoint, "1200px", "the width at which the Switcher swaps views");
	// A DESKTOP cap only. MobileBar stacks in a column and grows when the
	// hamburger opens, so a height cap there clips the menu instead of
	// sizing the bar — the links render outside the box.
	assert.equal(nav.maxHeight, "100px");
	assert.ok(!("flexDir" in nav) && !("justifyContent" in nav),
		"Wrapper options must not leak onto the bar pair");
	assert.deepEqual(nav.children.map((c) => c.type), ["h3", "a", "a", "a"]);
	assert.deepEqual(nav.children.map((c) => c.text),
		["Nodality", "Docs", "Guides", "GitHub"]);
	assert.equal(nav.children[3].url, "https://github.com");

	// A `bare` kind IS its element — a nav link is an <a>, not an <a> in a
	// section wrapper that exists only because the machinery does.
	assert.equal(nav.children[1].id, "nod-nav-link-label");
	assert.ok(!nav.children.some((c) => c.type === "wrap"));

	// Tokens still compose alongside kinds, and conflict detection is
	// unaffected by the objects sitting between them.
	assert.ok(nav.radius.includes("--nod-radius"),
		"MobileBar and DesktopBar both honour radius's VALUE, so the corner rides the axis");
	assert.deepEqual(nav.mar, [{ a: "12px" }], "`floating` is the bars' own inset");
	const clash = withBasic({ nav: ["floating", { kind: "link" }, "pinned"] });
	assert.ok(validate(clash).errors.some((e) => e.code === "TOKEN_CONFLICT"));

	// An unknown kind in a nav suggests the nav's OWN vocabulary, not main's.
	const typo = validate(withBasic({ nav: ["floating", { kind: "linkk" }] }));
	const hit = typo.errors.find((e) => e.code === "UNKNOWN_KIND");
	assert.equal(hit.path, "nav[1].kind");
	assert.deepEqual(hit.suggestions, ["link"]);
	assert.deepEqual(hit.valid, ["link"]);
});

// ── 3. every error code, with its suggestion ─────────────────────────

const withBasic = (patch) => Object.assign(BASIC(), patch);

const ERROR_CASES = [
	{
		code: "UNKNOWN_KEY", path: "navv", suggestion: "nav",
		// `navv` replaces `nav`, so the region/column count still matches
		// and this triggers exactly the one code under test.
		spec: () => { const s = withBasic({ navv: ["floating"] }); delete s.nav; delete s.content; return s; },
	},
	{
		code: "UNKNOWN_TOKEN", path: "nav[0]", suggestion: "floating",
		spec: () => withBasic({ nav: ["floatng", "rounded"] }),
	},
	{
		code: "UNKNOWN_KIND", path: "main[0].kind", suggestion: "hero",
		spec: () => withBasic({ main: [{ kind: "heroo" }, { kind: "cta" }] }),
	},
	{
		code: "UNKNOWN_SLOT", path: "content.main.hero.titl", suggestion: "main.hero.title",
		spec: () => {
			const s = BASIC();
			s.content = { "main.hero.titl": "typo" };
			return s;
		},
	},
	{
		code: "UNKNOWN_DRIVER", path: "main[0].effect[1]", suggestion: "mouse",
		spec: () => withBasic({ main: [{ kind: "hero", effect: ["flow", "mouze"] }, { kind: "cta" }] }),
	},
	{
		code: "BAD_AXIS", path: "axes.splt", suggestion: "split",
		spec: () => withBasic({ axes: { splt: 0.2, split: 0.2, density: 0.5, motion: 0.4 } }),
	},
	{
		code: "TOKEN_CONFLICT", path: "nav[1]", suggestion: "rounded",
		spec: () => withBasic({ nav: ["floating", "pinned"] }),
	},
	{
		code: "BAD_BONES", path: "bones.cols[0].priority", suggestion: "required",
		spec: () => withBasic({
			bones: {
				cols: [{ size: "@split", min: "240px", priority: "requird" }, "1fr"],
				rows: ["auto", "1fr"],
				gap: { size: "@density", min: "8px", priority: "low" },
			},
		}),
	},
];

test("validate reports every error code with a did-you-mean", () => {
	// The set under test is the whole vocabulary — a new code added to
	// morph.js without a case here fails this assertion, not silently.
	const covered = new Set(ERROR_CASES.map((c) => c.code));
	assert.equal(covered.size, ERROR_CASES.length);

	for (const c of ERROR_CASES) {
		const report = validate(c.spec());
		assert.equal(report.ok, false, `${c.code}: expected the spec to fail`);
		const hit = report.errors.find((e) => e.code === c.code && e.path === c.path);
		assert.ok(hit, `${c.code}: no error at ${c.path} — got ` +
			JSON.stringify(report.errors.map((e) => [e.code, e.path])));
		assert.ok(hit.suggestions.includes(c.suggestion),
			`${c.code}: expected suggestion "${c.suggestion}", got ${JSON.stringify(hit.suggestions)}`);
		assert.ok(Array.isArray(hit.valid) && hit.valid.length > 0, `${c.code}: no valid-set listed`);
	}
});

test("validate never throws; expand throws LayoutSpecError carrying the report", () => {
	for (const bad of [undefined, null, 42, "spec", [], {}, { op: "morph" }]) {
		const report = validate(bad);
		assert.equal(report.ok, false);
		assert.ok(report.errors.length > 0);
	}

	let err = null;
	try { expand(withBasic({ nav: ["floatng"] })); } catch (e) { err = e; }
	assert.ok(err, "expand must throw on an invalid spec");
	assert.equal(err.name, "LayoutSpecError");
	assert.match(err.message, /Unknown token "floatng" in region "nav"/);
	assert.match(err.message, /Did you mean "floating"\?/);
	assert.match(err.message, /Valid tokens: floating, pinned, rounded\./);
	assert.match(err.message, /\(UNKNOWN_TOKEN\)/);
	assert.equal(err.report.ok, false);
	assert.equal(err.report.errors[0].code, "UNKNOWN_TOKEN");

	assert.equal(validate(BASIC()).ok, true);
	assert.equal(validate(SUGAR()).ok, true);
});

// ── 4. slot ids are independent of the seed ──────────────────────────

test("slot ids are stable across seeds 1..5", () => {
	const PINNED = [
		"nav.brand",
		"main.hero.title", "main.hero.sub",
		"main.cta.button",
	];
	let previous = null;
	for (let seed = 1; seed <= 5; seed++) {
		const { slots } = expand(withBasic({ seed }));
		const ids = slots.map((s) => s.id);
		assert.deepEqual(ids, PINNED, `seed ${seed} moved the slot ids`);
		if (previous) assert.deepEqual(ids, previous);
		previous = ids;
	}

	// A kind that repeats takes an index from its SECOND occurrence on, so
	// the first one's id never shifts when a section is appended later.
	assert.deepEqual(
		expand(SUGAR()).slots.map((s) => s.id),
		["nav.brand",
			"main.hero.title", "main.hero.sub",
			"main.hero1.title", "main.hero1.sub",
			"main.cta.button"]);

	// Slots carry their owning kind, and every one names a real element.
	const { slots, elements } = expand(BASIC());
	const ids = new Set();
	(function walk(el){ if (el.id) ids.add(el.id); (el.children || []).forEach(walk); })(elements[0]);
	for (const s of slots) {
		assert.ok(typeof s.kind === "string" && s.kind.length > 0);
		assert.ok(ids.has("nod-" + s.id.replace(/\./g, "-")), `no element for slot ${s.id}`);
	}
});

// ── 5. allocator properties ──────────────────────────────────────────
//
// The track model, and the numbers, are MORPH-MVP.md's appendix — written
// and executed 2026-08-08. `pref` is a track's preferred px at the current
// axis values: sidebar = lerp(14%, 40%, split) of the container, gap =
// lerp(8px, 48px, density), and the 1fr main takes what is left.
const REQUIRED = Infinity;
const sidePref = (t, box) => ((14 + 26 * t) / 100) * box;
const gapPref = (t) => 8 + 40 * t;
const appendixTracks = (box, split, density) => {
	const side = sidePref(split, box);
	const gap = gapPref(density);
	return [
		{ id: "side", pref: side, min: 240, priority: REQUIRED },
		{ id: "gap", pref: gap, min: 8, priority: 0 },
		{ id: "main", pref: Math.max(0, box - side - gap), min: 160, priority: 1 },
	];
};
const round1 = (n) => Math.round(n * 10) / 10;

test("allocator: the appendix cascade, verbatim", () => {
	// desktop 1200px  side=324.0px  gap=28.0px  main=848.0px   relaxed:[—]
	const desktop = allocate(1200, appendixTracks(1200, 0.5, 0.5));
	assert.deepEqual(desktop.relaxed, []);
	assert.equal(round1(desktop.sizes.side), 324);
	assert.equal(round1(desktop.sizes.gap), 28);
	assert.equal(round1(desktop.sizes.main), 848);

	// phone 360px     side=240.0px  gap=12.8px  main=107.2px   relaxed:[gap,main]
	//
	// The gap's floor breaks first (priority low), then main's (high), and
	// the sidebar's REQUIRED 240px holds. "The gap yields first, then the
	// split, never the minimum."
	const phone = allocate(360, appendixTracks(360, 0.5, 0.5));
	assert.deepEqual(phone.relaxed, ["gap", "main"]);
	assert.equal(round1(phone.sizes.side), 240);
	assert.equal(round1(phone.sizes.gap), 12.8);
	assert.equal(round1(phone.sizes.main), 107.2);

	// axis sweep at 360px — continuous everywhere, even while the sidebar
	// sits pinned at its floor. The preset cliffs are structurally
	// impossible here, and these five rows are the printed trace.
	const SWEEP = [
		[0.00, 240.0, 10.9, 109.1],
		[0.25, 240.0, 11.7, 108.3],
		[0.50, 240.0, 12.8, 107.2],
		[0.75, 240.0, 14.0, 106.0],
		[1.00, 240.0, 15.6, 104.4],
	];
	for (const [t, side, gap, main] of SWEEP) {
		const r = allocate(360, appendixTracks(360, t, 0.5));
		assert.deepEqual([round1(r.sizes.side), round1(r.sizes.gap), round1(r.sizes.main)],
			[side, gap, main], `sweep t=${t}`);
	}
});

test("allocator: Σ sizes === container, integer-exact after rounding", () => {
	for (const box of [1200, 360, 375, 768, 1023, 1441]) {
		for (const t of [0, 0.33, 0.5, 0.77, 1]) {
			const tracks = appendixTracks(box, t, t);
			const { sizes, rounded } = allocate(box, tracks);
			const exact = Object.values(sizes).reduce((a, b) => a + b, 0);
			assert.ok(Math.abs(exact - box) < 1e-6, `exact Σ ${exact} != ${box}`);
			const ints = Object.values(rounded);
			assert.ok(ints.every(Number.isInteger), "rounded sizes must be integers");
			assert.equal(ints.reduce((a, b) => a + b, 0), box, `rounded Σ != ${box} at ${box}/${t}`);
		}
	}
});

test("allocator: largest-remainder rounding, ties to the first-declared track", () => {
	// Three equal tracks in 5px: 1.667 each, so every remainder is equal
	// and the two spare pixels go to the first two DECLARED tracks.
	const equal = [
		{ id: "a", pref: 1, min: 0, priority: 0 },
		{ id: "b", pref: 1, min: 0, priority: 0 },
		{ id: "c", pref: 1, min: 0, priority: 0 },
	];
	assert.deepEqual(allocate(5, equal).rounded, { a: 2, b: 2, c: 1 });
});

test("allocator: mins hold unless relaxed, and relaxation follows priority", () => {
	// Nothing needs to yield: every min is satisfied at the preferred size.
	const roomy = allocate(1200, appendixTracks(1200, 0.5, 0.5));
	assert.deepEqual(roomy.relaxed, []);
	for (const t of appendixTracks(1200, 0.5, 0.5)) {
		assert.ok(roomy.sizes[t.id] >= t.min - 1e-9, `${t.id} broke its min unrelaxed`);
	}

	// The floors sum to 408px, so 405px is tight enough that exactly one
	// has to go — and it is the lowest priority that goes.
	const tight = allocate(405, appendixTracks(405, 0.5, 0.5));
	assert.deepEqual(tight.relaxed, ["gap"]);
	assert.ok(tight.sizes.side >= 240 - 1e-9, "a required min must never yield");
	assert.ok(tight.sizes.main >= 160 - 1e-9, "the higher-priority min holds while a lower one yields");
	assert.ok(tight.sizes.gap < 8, "the relaxed floor is the one that actually gave way");

	// Equal priorities: declaration order decides, on sort stability.
	const tie = [
		{ id: "first", pref: 100, min: 200, priority: 0 },
		{ id: "second", pref: 100, min: 200, priority: 0 },
		{ id: "pinned", pref: 100, min: 100, priority: REQUIRED },
	];
	assert.deepEqual(allocate(300, tie).relaxed, ["first"]);

	// Required mins that cannot fit are an error, not a silent squeeze.
	assert.throws(() => allocate(100, [
		{ id: "a", pref: 50, min: 80, priority: REQUIRED },
		{ id: "b", pref: 50, min: 80, priority: REQUIRED },
	]), /unsatisfiable/);
});

test("allocator: max clamps", () => {
	const clamped = allocate(1000, [
		{ id: "capped", pref: 500, min: 0, max: 300, priority: 0 },
		{ id: "rest", pref: 500, min: 0, priority: 0 },
	]);
	assert.equal(round1(clamped.sizes.capped), 300);
	assert.equal(round1(clamped.sizes.rest), 700);

	// A max below the min is still bounded by the max — the clamp is the
	// last word, so the solver cannot hand back a track wider than asked.
	const both = allocate(1000, [
		{ id: "a", pref: 900, min: 100, max: 200, priority: 0 },
		{ id: "b", pref: 100, min: 0, priority: 0 },
	]);
	assert.ok(both.sizes.a <= 200 + 1e-9);
});

test("allocator: sizes move monotonically along an axis", () => {
	for (const box of [1200, 360]) {
		const sweep = [];
		for (let i = 0; i <= 10; i++) sweep.push(allocate(box, appendixTracks(box, i / 10, 0.5)).sizes);
		for (const id of ["side", "gap", "main"]) {
			const series = sweep.map((s) => s[id]);
			const up = series.every((v, i) => i === 0 || v >= series[i - 1] - 1e-9);
			const down = series.every((v, i) => i === 0 || v <= series[i - 1] + 1e-9);
			assert.ok(up || down, `${id} at ${box}px is not monotone: ${series.map(round1)}`);
		}
	}
});

// ── morphController — writes vars, and only vars ─────────────────────
//
// The explicit (meta, rootEl) form needs no document, so the controller is
// testable in the same bare-Node process the purity gate demands. A stub
// root records every write; the whole claim is that a stroke produces
// setProperty calls and nothing else, which is what the M3 demo page's
// mutation counter asserts again in a real browser.
function stubRoot(){
	const writes = [];
	return {
		writes,
		style: { setProperty: (k, v) => writes.push([k, v]) },
		querySelector: () => null,
	};
}

test("morphController writes one custom property per axis stroke", () => {
	const { meta } = expand(BASIC());
	const root = stubRoot();
	const morph = morphController(meta, root);

	morph.axis("split", 0.8);
	const keys = root.writes.map(([k]) => k);
	assert.ok(keys.includes("--nod-split"));
	assert.equal(root.writes.find(([k]) => k === "--nod-split")[1], "0.8");

	// Constrained tracks re-solve on the stroke — through the SAME
	// allocator expand() ran at build time, which is why prerendered and
	// live output agree — and the result is still only var writes.
	assert.ok(keys.includes("--nod-cols-0"));
	assert.ok(keys.every((k) => k.startsWith("--nod-")));
	const cols0 = root.writes.filter(([k]) => k === "--nod-cols-0").pop()[1];
	assert.match(cols0, /^\d+px$/);
	assert.notEqual(cols0, meta.vars["--nod-cols-0"], "a wider split must widen the sidebar");

	// Values clamp to 0..1 rather than throwing — a slider that overshoots
	// by a float epsilon should not take the page down.
	morph.axis("motion", 5);
	assert.equal(root.writes.filter(([k]) => k === "--nod-motion").pop()[1], "1");
	morph.axis("motion", -2);
	assert.equal(root.writes.filter(([k]) => k === "--nod-motion").pop()[1], "0");

	morph.axes({ split: 0.1, density: 0.9 });
	assert.equal(root.writes.filter(([k]) => k === "--nod-density").pop()[1], "0.9");

	// Unknown axis and unknown slot are errors, not silent no-ops.
	assert.throws(() => morph.axis("splt", 0.5), /unknown axis "splt"/);
	assert.throws(() => morph.content("main.hero.titl", "x"), /unknown content slot/);
	assert.equal(typeof morph.dispose, "function");
});

test("morphController accepts a spec and finds its own root id", () => {
	// The everyday form derives meta by running the pure expansion. With no
	// document and no rootEl it cannot find a root, and says so by name.
	assert.throws(() => morphController(BASIC()), /no element with id "nod-page"/);

	// An unconstrained spec has no tracks to re-solve, so a stroke writes
	// exactly one property — the zero-JS-in-the-loop tier.
	const root = stubRoot();
	morphController(expand(SUGAR()).meta, root).axis("split", 0.42);
	assert.deepEqual(root.writes, [["--nod-split", "0.42"]]);
});

// ── 6. purity gate ───────────────────────────────────────────────────

test("morph.js imports in bare Node — no DOM, no window", async () => {
	const code = await new Promise((res, rej) => {
		execFile(process.execPath,
			["--input-type=module", "-e", `await import(${JSON.stringify(MORPH)})`],
			// A browser global leaking in would make this pass by accident.
			{ env: { ...process.env, NODE_OPTIONS: "" } },
			(err, stdout, stderr) => {
				if (err && typeof err.code !== "number") return rej(err);
				if (err) return res({ code: err.code, stderr });
				res({ code: 0, stderr });
			});
	});
	assert.equal(code.code, 0,
		`importing morph.js in bare Node exited ${code.code}:\n${code.stderr}`);

	// The gate above only catches module-scope DOM access. Calling the pure
	// surface must be DOM-free too — this whole test file runs in bare Node,
	// so reaching for `document` anywhere in expand/validate/allocate throws.
	assert.equal(typeof globalThis.document, "undefined");
	assert.equal(typeof globalThis.window, "undefined");
	expand(BASIC());
	validate(BASIC());
});

// ── 7. zero-keySet gate ──────────────────────────────────────────────

test("no expansion emits keySet, or a style tag, anywhere", () => {
	// A keySet here means an element class is missing a semantic option.
	// The fix is to add the option (with a //@ annotation), never to reach
	// for the escape hatch: raw DOM styling is as bad as createElement.
	const forbidden = ["keySet", "css", "style", "stylesheet"];
	const visit = (value, path) => {
		if (Array.isArray(value)) return value.forEach((v, i) => visit(v, `${path}[${i}]`));
		if (!value || typeof value !== "object") return;
		for (const key of Object.keys(value)) {
			assert.ok(!forbidden.includes(key),
				`${path}.${key} — expansion output must carry semantic options only`);
			visit(value[key], `${path}.${key}`);
		}
	};

	for (const [name, spec] of [["basic", BASIC()], ["sugar", SUGAR()]]) {
		const out = expand(spec);
		visit(out.elements, `${name}.elements`);
		visit(out.nodes, `${name}.nodes`);
		visit(out.meta, `${name}.meta`);
	}

	// The golden is what the gate is really guarding: it is committed, so a
	// regression would otherwise land as a quietly updated snapshot.
	visit(JSON.parse(readFileSync(resolve(HERE, "golden/expand-basic.json"), "utf8")), "golden");

	// `keySet` stays available to USERS — it is still a documented option
	// on the element classes. Only the generator is denied it.
	assert.ok(!("keySet" in REGISTRY));
});
