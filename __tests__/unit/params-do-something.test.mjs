// params-do-something.test.mjs
//
// A declared parameter must CHANGE something.
//
// The schema is derived from source, which makes it accurate about what the
// code mentions and silent about what the code does. Those are different
// claims, and the gap between them is where this library's most expensive
// defects have lived: `table` advertised `font`, `headStyle`, `cellPadding`,
// `cellAlign`, `borderObj` and `background`, rendered byte-identical markup
// for every one of them, and `validate_nodes` returned ok each time. An agent
// reading the schema is told a page can be styled; the page it writes cannot.
//
// So each parameter is rendered twice — without, then with a value of the
// shape its own annotation declares — and the two DOMs are compared. A
// parameter that changes nothing is inert.
//
// Only parameters whose source declares a `{unit}` are probed, because a
// probe value can only be generated from a declared shape. That is deliberate
// pressure in the right direction: annotating a parameter puts it under test.
//
// KNOWN_INERT is a baseline, not an allowlist. A new inert parameter fails
// here; a baselined one that starts working ALSO fails, so the list cannot
// quietly rot into a list of excuses.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let ElementMapper, ELEMENT_PARAM_UNITS, ELEMENT_PARAMS_BY_TYPE, dom;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = () => 0;
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	}
	({ ElementMapper } = await import("../../lib/element-mapper.js"));
	({ ELEMENT_PARAM_UNITS, ELEMENT_PARAMS_BY_TYPE } = await import("../../lib/element-params.generated.js"));
});

const fixture = (type) => {
	const el = { type, id: "probe" };
	if (["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "code", "copy", "simple"].includes(type)) el.text = "Probe";
	if (["img", "video", "audio", "a"].includes(type)) el.url = "/probe.mp4";
	if (["cards", "nav", "sideNav", "table", "ulist", "dropdown", "picker", "radio"].includes(type)) el.items = ["One", "Two"];
	if (["row", "form", "stack", "wrap", "free"].includes(type)) el.children = [{ type: "p", id: "kid", text: "Kid" }];
	if (type === "multiswitcher") el.breakpoints = [{ at: "600px", view: { type: "p", id: "v", text: "View" } }];
	if (type === "simple") el.react = [{ at: 600, template: "text-above-image" }];
	// Companions: a parameter that styles content needs content to style.
	// gridOverlay's font, size and casing apply to its readouts, so without a
	// readout there is nothing for them to change — an absence of effect that
	// says nothing about the parameter.
	if (type === "gridOverlay") {
		el.readouts = [{ id: "r", col: 1, row: 1, text: "readout" }];
		el.mobile = { columns: 1 };
	}
	return el;
};
const nodesFor = (type) => type === "free" ? [{ op: { name: "layout", value: "text-above-image" } }] : [];

/** A value of the declared shape, chosen so its effect is visible if read. */
const probeFor = (unit) => {
	const en = /^enum\(([^)]*)\)$/.exec(unit);
	// The LAST listed value, so it differs from a default that is usually first.
	if (en) return en[1].split("|").map((s) => s.trim()).filter(Boolean).pop();
	return {
		"css-length": "37px",
		"px-number": 13,
		color: "#ff00ff",
		ratio: 0.42,
		count: 3,
		bool: true,
		url: "/probe-value.png",
		text: "PROBEVALUE",
		"scale-step": "S2",
		sides: [{ a: 41 }],
		"css-cursor": "pointer",
		"css-transform": "rotate(3deg)",
		"css-track-list": "repeat(2, 1fr)",
		"css-areas": '"a b" "a b"',
		"px-or-length": 13,
		"css-aspect-ratio": "16 / 9",
		keyset: [{ key: "outline", value: "3px dashed magenta" }],
	}[unit];
};

const render = (el, nodes) => {
	const mount = document.getElementById("mount");
	mount.innerHTML = "";
	const built = ElementMapper.mapType({ el, customOptions: nodes, i: 0 });
	if (typeof built === "string") return built;
	const node = built && (built.res || built.formElement || built.el || built.container
		|| (typeof built.render === "function" ? built.render() : null));
	if (node && node.outerHTML !== undefined) mount.appendChild(node);
	return mount.innerHTML;
};

// Parameters known to be declared and ignored, with the reason. Shrinking this
// list is the point; adding to it should need an argument.
// Parameters whose effect is real but cannot appear in a single static
// render. Not defects — the probe simply cannot see them.
const NOT_OBSERVABLE = new Set([
	"video.lazy",            // schedules playback through an IntersectionObserver
	"video.autoplay",        // playback state, not markup
	"video.muted",           // a property, set before the attribute exists in jsdom
	"gridOverlay.breakpoint", // only matters at another viewport width
	"gridOverlay.mobile",     // ditto
]);

const KNOWN_INERT = new Set([
	// The mapper builds its own options and never consults the element, so
	// the component's vocabulary is unreachable however faithfully it reads.
	// Fixing one means changing how every existing page of that type renders,
	// so each is recorded here rather than quietly patched.
	// Text elements: the element TYPE picks the fluid step, because in Text
	// the step also picks the tag — honouring `size` here turned an h2 into an
	// h3 and changed the document outline. `tag` is the settable option.
	"h1.size", "h2.size", "h3.size", "h4.size", "h5.size", "h6.size", "p.size",
	// a
	"a.transform",
	// checkbox
	"checkbox.area",
	"checkbox.background",
	"checkbox.color",
	"checkbox.cursor",
	"checkbox.height",
	"checkbox.keySet",
	"checkbox.mar",
	"checkbox.maxWidth",
	"checkbox.pad",
	"checkbox.transform",
	"checkbox.width",
	// circle
	"circle.transform",
	// code
	"code.transform",
	// filePicker
	"filePicker.radius",
	// labelInput
	"labelInput.color",
	"labelInput.exact",
	// nav
	"nav.area",
	"nav.background",
	"nav.color",
	"nav.cursor",
	"nav.height",
	"nav.keySet",
	"nav.mar",
	"nav.maxHeight",
	"nav.maxWidth",
	"nav.opacity",
	"nav.pad",
	"nav.radius",
	"nav.size",
	"nav.transform",
	"nav.width",
	"nav.zIndex",
	// polygon
	"polygon.transform",
	// radio
	"radio.color",
	"radio.exact",
	// sideNav
	"sideNav.area",
	"sideNav.background",
	"sideNav.color",
	"sideNav.cursor",
	"sideNav.height",
	"sideNav.keySet",
	"sideNav.mar",
	"sideNav.maxHeight",
	"sideNav.maxWidth",
	"sideNav.opacity",
	"sideNav.pad",
	"sideNav.radius",
	"sideNav.size",
	"sideNav.transform",
	"sideNav.width",
	"sideNav.zIndex",
	// table
	"table.transform",
]);

test("every parameter with a declared shape changes the rendered DOM", () => {
	const inert = [];
	const recovered = [];

	for (const [type, names] of Object.entries(ELEMENT_PARAMS_BY_TYPE)) {
		let baseline;
		try { baseline = render(fixture(type), nodesFor(type)); } catch { continue; }

		for (const name of names) {
			if (name === "type" || name === "id") continue;
			const unit = ELEMENT_PARAM_UNITS[`${type}.${name}`];
			const key = `${type}.${name}`;
			if (NOT_OBSERVABLE.has(key)) continue;
			const value = probeFor(unit);
			if (value === undefined) continue;   // no declared shape: not probed

			// Some shapes are probed with more than one value, because a single
			// probe can collide with the default and look inert: every boolean
			// has one, and `size: "S2"` is what an h2 derives anyway.
			const values = unit === "bool" ? [true, false]
				: unit === "scale-step" ? ["S1", "S6"]
				: [value];
			let changed = false;
			for (const v of values) {
				let out;
				try { out = render({ ...fixture(type), [name]: v }, nodesFor(type)); } catch { continue; }
				if (out !== baseline) { changed = true; break; }
			}
			if (!changed && !KNOWN_INERT.has(key)) inert.push(key);
			if (changed && KNOWN_INERT.has(key)) recovered.push(key);
		}
	}

	assert.deepEqual(inert, [],
		"these parameters are advertised by the schema and ignored by the component");
	assert.deepEqual(recovered, [],
		"these are listed in KNOWN_INERT but now work — remove them from the list");
});

test("the probe can fail", () => {
	// A check that cannot fail is not a check. `keySet` on a `table` is the
	// real case this suite was written for: a name the union knows, a type
	// that never reads it, and a page that renders without it.
	const before = render(fixture("table"), []);
	const after = render({ ...fixture("table"), keySet: [{ key: "outline", value: "3px dashed magenta" }] }, []);
	assert.equal(after, before, "table still ignores keySet; if this fails the fixture is wrong");
});
