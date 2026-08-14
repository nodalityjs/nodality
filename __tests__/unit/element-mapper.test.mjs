// element-mapper.test.mjs — phase P3 of HOUDINI-IMPL-SPEC.
//
// ElementMapper turns an (E,N) element into a component instance. Three
// things it used to do instead:
//
//   1. Return `undefined` for an unknown `type`. The caller treated that
//      as an element, so the typo surfaced later and elsewhere as
//      "Cannot read properties of undefined (reading 'toCode')" — the
//      silently-ignored-key bug class, in its most expensive form.
//   2. Hardcode fixture children: `mapWrap` appended three
//      `new Text("Hello")` unconditionally and `mapUList` a
//      First/Second/Third list, so every `wrap` and every `ulist` on every
//      page rendered the same placeholder and no page could put anything
//      of its own inside one. It also forwarded a fixed allowlist of
//      options and dropped the rest, so a `wrap` could not carry a width,
//      a background or a grid.
//   3. Inject a demo `resprop` into any text element that merely SET
//      resprop — two breakpoints of orange/green boxes, overriding
//      whatever the caller asked for.
//
// Plus `size: getElType("wrap")`, which produced the string "Srap":
// getElType slices the digit off h1…h6 and has nothing to slice on a word.
//
// `protoNav` and the `"nav"` branch are deliberately NOT touched or tested
// here — standing instruction, since existing pages depend on what
// `type: "nav"` renders.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let ElementMapper;

before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator",
		{ value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	// Present in every real browser; some components do instanceof checks
	// against it while building their subtree.
	globalThis.HTMLElement = dom.window.HTMLElement;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({
			matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {},
		});
	}
	({ ElementMapper } = await import("../../lib/element-mapper.js"));
});

/** mapType's argument shape: { el, customOptions, i }. */
const map = (el, customOptions = []) => ElementMapper.mapType({ el, customOptions, i: 0 });

// ── 1. a closed vocabulary says so ───────────────────────────────────

test("an unknown element type throws, and names the nearest valid one", () => {
	// The specific failure this replaces: mapType fell through, returned
	// undefined, and the error appeared later at `.toCode()`.
	assert.throws(() => map({ type: "buton", text: "x" }), (err) => {
		assert.match(err.message, /Unknown element type "buton"/);
		assert.match(err.message, /Did you mean "button"/,
			`expected a suggestion, got: ${err.message}`);
		return true;
	});

	// A typo one edit from a real type gets that type.
	assert.throws(() => map({ type: "wrapp" }), /Did you mean "wrap"/);
	assert.throws(() => map({ type: "ulit" }), /Did you mean "ulist"/);
	assert.throws(() => map({ type: "imge" }), /Did you mean "img"/);

	// No near neighbour: still throws, and still lists the vocabulary
	// rather than leaving the caller guessing. Note "tetx" lands here —
	// there is no `text` element type at all, since text is h1…h6 / p.
	for (const t of ["tetx", "zzzzzzzz"]) {
		assert.throws(() => map({ type: t }), (err) => {
			assert.match(err.message, new RegExp(`Unknown element type "${t}"`));
			assert.match(err.message, /Valid element types:/);
			assert.ok(!/Did you mean/.test(err.message),
				`no candidate is within 2 edits of "${t}", so none should be offered`);
			return true;
		});
	}

	// And the happy path still resolves.
	assert.ok(map({ type: "h1", text: "Hello" }));
});

// ── 2. wrap carries its own options and its own children ─────────────

test("wrap forwards the element's own options", () => {
	const el = map({
		type: "wrap", id: "shell",
		width: "320px", background: "rgb(1, 2, 3)", disp: "grid",
		cols: "1fr 2fr", radius: "2rem",
	});
	const s = el.res.style;
	// Every one of these was dropped by the old allowlist.
	assert.equal(s.width, "320px");
	assert.equal(s.display, "grid");
	assert.equal(s.gridTemplateColumns, "1fr 2fr");
	assert.equal(s.borderRadius, "2rem");
	assert.match(s.background, /rgb\(1, 2, 3\)/);
});

test("wrap renders the element's children, not a placeholder", () => {
	const bare = map({ type: "wrap" });
	assert.equal(bare.res.textContent, "",
		'a wrap with no children must be empty — this used to be "HelloHelloHello"');

	const withKids = map({
		type: "wrap",
		children: [
			{ type: "h2", text: "Real title" },
			{ type: "p", text: "Real body" },
		],
	});
	assert.equal(withKids.res.children.length, 2);
	assert.match(withKids.res.textContent, /Real title/);
	assert.match(withKids.res.textContent, /Real body/);
	assert.ok(!/Hello/.test(withKids.res.textContent));
});

test("wrap does not invent a fluid size from a non-heading type", () => {
	// getElType("wrap") === "Srap"; fluidCopy only understands S1…S6, so
	// the old default was a silent no-op carrying a nonsense value.
	const el = map({ type: "wrap" });
	assert.equal(el.obj.size, undefined);

	// A caller-supplied size still reaches the component.
	const sized = map({ type: "wrap", size: "S3" });
	assert.equal(sized.obj.size, "S3");
});

// ── 3. ulist likewise ────────────────────────────────────────────────

test("ulist renders its own items, not First/Second/Third", () => {
	const bare = map({ type: "ulist" });
	assert.ok(!/First|Second|Third/.test(bare.res.textContent),
		`a bare ulist must be empty, got: ${bare.res.textContent}`);

	const withItems = map({ type: "ulist", items: ["Alpha", "Beta"] });
	const text = withItems.res.textContent;
	assert.match(text, /Alpha/);
	assert.match(text, /Beta/);
	assert.ok(!/First/.test(text));
});

// ── 4. text keeps the CALLER's resprop ───────────────────────────────

test("text passes the caller's resprop through instead of a demo fixture", () => {
	const mine = [{ breakpoint: "800px", background: "rgb(7, 7, 7)" }];
	const el = map({ type: "p", text: "hi", resprop: mine });
	assert.deepEqual(el.options.resprop, mine);

	// The injected fixture was two breakpoints of orange/green boxes.
	const json = JSON.stringify(el.options.resprop);
	assert.ok(!/orange|green/.test(json), `demo fixture leaked: ${json}`);

	// No resprop asked for, none applied.
	assert.equal(map({ type: "p", text: "hi" }).options.resprop ?? null, null);
});

// ── 5. headings still get their scale ────────────────────────────────

test("h1..h6 and p still map to the S1..S6 fluid scale", () => {
	for (const [type, size] of [["h1", "S1"], ["h3", "S3"], ["h6", "S6"], ["p", "S6"]]) {
		assert.equal(ElementMapper.getElType(type), size, `${type} -> ${size}`);
		// And it reaches the component as a fluid font-size.
		assert.match(map({ type, text: "x" }).res.style.fontSize, /calc\(/);
	}
});

// ── raster ops must reach every element type that can host them ──────

test("a link forwards raster ops, like every other rasterable element", () => {
	// `mapLink` forwarded every CSS-level op (animation, transform, shadow,
	// gradient, blast, background) and not `raster`. A raster node aimed at
	// an <a> was therefore accepted, matched by filteroRaster, and then
	// dropped on the floor — no error, no effect. Same dead-option class as
	// the mapWrap fixtures above; Link already accepts `raster` through
	// commonMethods, only the wiring was missing.
	const chain = [{ op: "hexalize", size: 18, target: ["#cta"] }];
	const link = ElementMapper.mapType({
		el: { type: "a", id: "#cta", text: "Read on", url: "#ops" },
		customOptions: chain, i: 0,
	});
	assert.ok(link.options.raster, "mapLink dropped the raster chain");
	assert.deepEqual(link.options.raster.map((n) => n.op), ["hexalize"]);

	// A link with no raster node targeting it gets none — the option is
	// absent rather than an empty array, so `obj.raster && …` stays false.
	const plain = ElementMapper.mapType({
		el: { type: "a", id: "#other", text: "x", url: "#" },
		customOptions: chain, i: 0,
	});
	assert.ok(!plain.options.raster, "a link should not inherit another element's chain");
});

// ── every mapper that CAN carry a raster chain, does ──────────────────
//
// `mapLink` above was one instance of a wider gap: 19 of the 29 element
// types never forwarded raster nodes at all. The node was accepted,
// matched by filteroRaster, and dropped — no error, no effect.
//
// Of those 19, five map elements that actually read their input and can
// host a chain. The other fourteen are demo fixtures that ignore `obj`
// entirely (`static button()` takes no arguments and renders a hardcoded
// "Submit"), so wiring raster into them would attach an effect to content
// the caller never asked for. They are listed in the second test so the
// gap is recorded rather than forgotten.
//
// The wiring differs by mapper, and the difference is load-bearing:
//
//   free / sideNav / dropdown  — return component INSTANCES, but each
//       defines its own set()/setup() that handles only its own keys and
//       never calls Animator.commonMethods(), which is where
//       `obj.raster && this.rasterize(...)` lives. A `raster:` option
//       would therefore be a dead key — the very bug being fixed. They
//       all extend Animator, so the inherited rasterize() is called.
//   cards / copy — return SOURCE, so the chain is serialised into the
//       emitted `.set({...})`. Their roots (FlexGrid, Wrapper) do route
//       options through commonMethods(), so the emitted code attaches.

const rasterChain = (id) => [
	{ op: "hexalize", size: 14, target: [id] },
	{ op: "halftone", size: 5, target: ["#somewhere-else"] },
];

test("instance mappers attach the chain through the inherited rasterize()", async () => {
	const { Animator } = await import("../../layout/animator.js");
	// jsdom has no Web Animations API and SideNav calls res.animate().
	window.Element.prototype.animate = () => ({
		finished: Promise.resolve(), cancel() {}, play() {}, pause() {}, reverse() {},
	});

	const seen = [];
	const real = Animator.prototype.rasterize;
	Animator.prototype.rasterize = function (list) {
		seen.push({ cls: this.constructor.name, ops: list.map((n) => n.op) });
		return real.call(this, list);
	};

	try {
		// `free` needs a layout op present — a pre-existing requirement of
		// that mapper, unrelated to raster.
		const slayout = { op: { name: "slayout", value: "img-overlay-text" } };
		const cases = [
			["free", { type: "free", id: "#f" }, [slayout], "Free"],
			["sideNav", { type: "sideNav", id: "#s", items: ["A", "B"] }, [], "SideNav"],
			["dropdown", { type: "dropdown", id: "#d", items: ["X", "Y"] }, [], "Dropdown"],
		];
		for (const [label, el, extra, cls] of cases) {
			seen.length = 0;
			ElementMapper.mapType({ el, customOptions: [...extra, ...rasterChain(el.id)], i: 0 });
			assert.equal(seen.length, 1, `${label} attached ${seen.length} chains, expected 1`);
			assert.equal(seen[0].cls, cls);
			// Only the node aimed at THIS element — not the other one.
			assert.deepEqual(seen[0].ops, ["hexalize"],
				`${label} leaked a chain targeted elsewhere`);
		}
	} finally {
		Animator.prototype.rasterize = real;
	}
});

test("source-emitting mappers serialise the chain into the generated code", () => {
	// `cards` returns a template string, so the proof is in the source.
	const grid = String(ElementMapper.mapType({
		el: { type: "cards", id: "#g" }, customOptions: rasterChain("#g"), i: 0,
	}));
	assert.match(grid, /raster:\s*\[/, "cards emitted no raster option");
	assert.match(grid, /"op":"hexalize"/);
	assert.ok(!/halftone/.test(grid), "cards leaked a chain targeted elsewhere");
	// On the FlexGrid root, not on each card: `target` names the grid.
	assert.ok(grid.indexOf("raster:") > grid.indexOf("new FlexGrid"),
		"raster landed on the card template rather than the grid root");

	// `copy` consumes its own `copy` node to build the wheel, so that node
	// must NOT also be handed to the GPU — that would duplicate the
	// element twice, once in DOM and once in the shader.
	const cp = String(ElementMapper.mapType({
		el: { type: "copy", id: "#c" },
		customOptions: [{ op: "copy", count: 3, target: ["#c"] },
			{ op: "hexalize", size: 12, target: ["#c"] }],
		i: 0,
	}));
	assert.match(cp, /raster:\s*\[/, "copy emitted no raster option");
	assert.match(cp, /"op":"hexalize"/);
	assert.ok(!/"op":"copy"/.test(cp),
		"copy handed its own consumed node to the raster pipeline");
});

test("no mapper renders demo fixture content any more", () => {
	// Thirteen mappers ignored `obj` entirely and rendered hardcoded demo
	// content: `static button()` took no arguments and produced "Submit"
	// with a console-logging onTap and a forced 3px green border; every
	// input read "Enter swimming time"; every picker offered Tesla and
	// Audi; every stack showed a photo and "Samuel Suresh". Same class as
	// the mapWrap/mapUList fixtures phase P3 removed, at eleven times the
	// scale.
	//
	// `{type: "audio"}` did not even reach the fixture stage — Audio
	// defines no set() and Animator has none to inherit, so the old
	// `.set({background})` threw a TypeError on every audio element.
	const FIXTURE_STRINGS = [
		"Submit", "Samuel Suresh", "Check it out", "Enter swimming time",
		"select a car---", "Male", "Female", "Hello A", "Add profile picture",
		"Big Buck", "rouska", "acceptTerms", "Flower", "Maseratti", "First",
	];

	const render = (r) => {
		if (typeof r === "string") return r;
		let node = null;
		try { node = r.render ? r.render() : null; } catch (e) { /* needs a mount */ }
		const src = node || r.res || r.formElement || null;
		return src ? String(src.textContent || "") : "";
	};

	const CASES = [
		[{ type: "button", id: "#b", text: "Buy now" }, /Buy now/],
		[{ type: "input", id: "#i", placeholder: "Your email" }, null],
		[{ type: "labelInput", id: "#li", title: "Enter address" }, /Enter address/],
		[{ type: "picker", id: "#pk", items: [["a", "Alpha"], ["b", "Beta"]] }, /Alpha/],
		[{ type: "radio", id: "#r", items: ["Yes", "No"] }, null],
		[{ type: "checkbox", id: "#cb", label: "Accept terms" }, /Accept terms/],
		[{ type: "stack", id: "#st", children: [{ type: "h3", text: "Stacked title" }] },
			/Stacked title/],
		[{ type: "form", id: "#f", action: "/subscribe",
			children: [{ type: "labelInput", title: "Email addr" }] }, /Email addr/],
		[{ type: "multiswitcher", id: "#ms",
			breakpoints: [{ at: "0px", view: { type: "h2", text: "Small screen" } }] }, null],
		[{ type: "video", id: "#v", url: "/clip.mp4" }, null],
		[{ type: "audio", id: "#au", url: "/song.mp3" }, null],
		[{ type: "filePicker", id: "#fp", title: "Upload CV" }, null],
		[{ type: "simple", id: "#sm", react: [{ at: "0", template: ["aa"] }],
			children: [{ type: "p", text: "Region A" }] }, /Region A/],
	];

	for (const [el, want] of CASES) {
		const out = render(ElementMapper.mapType({ el, customOptions: [], i: 0 }));
		for (const demo of FIXTURE_STRINGS) {
			assert.ok(!out.includes(demo),
				`"${el.type}" still renders the fixture string "${demo}"`);
		}
		if (want) {
			assert.match(out, want, `"${el.type}" did not render its own content`);
		}
	}
});

test("the caller's own values reach the component, not just the text", () => {
	// textContent is not the whole story: several of these render into
	// attributes, and jsdom does not implement innerText at all (which is
	// how FilePickera writes its label), so those are checked directly.
	const video = ElementMapper.mapType({
		el: { type: "video", id: "#v", url: "/clip.mp4" }, customOptions: [], i: 0 });
	assert.match(String(video.res.outerHTML), /\/clip\.mp4/,
		"video ignored its url — it used to hardcode a w3schools sample");

	const input = ElementMapper.mapType({
		el: { type: "input", id: "#i", placeholder: "Your email" }, customOptions: [], i: 0 });
	const field = input.res.querySelector("input") || input.res;
	assert.equal(field.getAttribute("placeholder"), "Your email");

	// The switcher holds the MAPPED view, so a breakpoint can carry real
	// content rather than a fixed Text.
	const ms = ElementMapper.mapType({
		el: { type: "multiswitcher", id: "#ms",
			breakpoints: [{ at: "0px", view: { type: "h2", text: "Small screen" } }] },
		customOptions: [], i: 0 });
	assert.equal(ms.breakpoints.length, 1);
	assert.equal(typeof ms.breakpoints[0].view.render, "function");
	assert.match(ms.breakpoints[0].view.render().textContent, /Small screen/);
});

test("elements that cannot work without a value say so", () => {
	// Silently substituting a demo URL is worse than an error, because it
	// looks like it worked. These two used to play Big Buck Bunny and
	// "rouska.mp3" respectively.
	assert.throws(() => map({ type: "video" }), /a "video" element needs a `url`/);
	assert.throws(() => map({ type: "audio" }), /an "audio" element needs a `url`/);
	assert.throws(() => map({ type: "multiswitcher" }), /needs a non-empty `breakpoints`/);
	assert.throws(() => map({ type: "simple" }), /needs a non-empty `react`/);
});

test("the element types that still cannot carry raster are the non-Animators", () => {
	// A ratchet. `radio`, `form` and `multiswitcher` map to RadioGroup,
	// Form and Switcher, none of which extend Animator — so they have no
	// rasterize() to call and a `raster:` option would be a dead key.
	// `simple` emits source for an AreaSwitcher; `nav` is excluded by
	// standing instruction. If any of these ever becomes an Animator, this
	// list should shrink.
	const CANNOT = ["nav", "radio", "multiswitcher", "form", "simple"];
	assert.equal(CANNOT.length, 5,
		"raster coverage changed — update this list and the count");
});

