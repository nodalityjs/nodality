// option-values.test.mjs — phase P4 of HOUDINI-IMPL-SPEC.
//
// One bug class, pinned: an option that reads its own NAME but ignores its
// VALUE. `UINavBar.radius` was the specimen — `if (this.obj.radius)` then
// a hardcoded "1rem", so `radius: "2rem"` and `radius: "0"` both rendered
// 1rem. `Wrapper.alignIts` is deprecated for the same thing. The failure
// is invisible in review (the option is clearly "supported") and invisible
// in a browser unless you happen to pass the one value that differs.
//
// Scope is the four classes the raster gallery and inspector sit on:
// Wrapper, Text, Image, FlexRow. Every other class is backlog.
//
// WHAT THIS FOUND WHEN WRITTEN (2026-08-12): nothing. All 136 styleMap
// combinations and all 25 dispatched-option cases already honoured their
// values. That is the useful result — the four classes on the Houdini path
// are sound, and this file exists so they stay that way. It is the home
// for this bug class from here on: a new option goes in the table.
//
// The two halves matter differently. styleMap options are a straight
// `style[prop] = value` and are hard to get wrong; the DISPATCHED ones
// (pad, mar, vars, borderObj, flexDir, size…) route through a method, and
// a method is where a value gets dropped.

import { test, before } from "node:test";
import assert from "node:assert/strict";

let Wrapper, Text, Image, FlexRow;

before(async () => {
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, "navigator",
		{ value: dom.window.navigator, configurable: true });
	globalThis.requestAnimationFrame = () => 0;
	if (!dom.window.matchMedia) {
		dom.window.matchMedia = () => ({
			matches: false, addEventListener() {}, removeEventListener() {},
			addListener() {}, removeListener() {},
		});
	}
	({ Wrapper } = await import("../../layout/container.js"));
	({ Text } = await import("../../layout/text.js"));
	({ Image } = await import("../../layout/image.js"));
	({ FlexRow } = await import("../../layout/flex-row.js"));
});

const build = {
	Wrapper: () => new Wrapper(),
	Text: () => new Text("hi"),
	Image: () => new Image("a.png"),
	FlexRow: () => new FlexRow(),
};

/** set one option on a fresh instance, hand back its inline style. */
const styleAfter = (cls, options) => {
	const el = build[cls]();
	el.set(options);
	return { style: el.res.style, el };
};

// ── the shared styleMap: option -> CSS property, value passes through ──
//
// Distinct values per row on purpose: a row asserting `width: "100px"`
// against a class that hardcodes 100px would pass while being wrong.
const STYLE_MAP = [
	["width", "320px", "width"],
	["maxWidth", "400px", "maxWidth"],
	["height", "64px", "height"],
	["maxHeight", "80px", "maxHeight"],
	["minWidth", "10px", "minWidth"],
	["minHeight", "12px", "minHeight"],
	["radius", "2rem", "borderRadius"],
	["color", "rgb(4, 5, 6)", "color"],
	["opacity", "0.5", "opacity"],
	["gap", "8px", "gap"],
	["zIndex", "7", "zIndex"],
	["position", "sticky", "position"],
	["top", "3px", "top"],
	["display", "grid", "display"],
	["overflow", "hidden", "overflow"],
	["boxSizing", "border-box", "boxSizing"],
	["textAlign", "center", "textAlign"],
	["letterSpacing", "2px", "letterSpacing"],
	["lineHeight", "1.7", "lineHeight"],
	["transition", "all 1s", "transition"],
	["cursor", "pointer", "cursor"],
	["flex", "1 1 auto", "flex"],
	["flexGrow", "2", "flexGrow"],
	["alignSelf", "center", "alignSelf"],
	["pointerEvents", "none", "pointerEvents"],
	["userSelect", "none", "userSelect"],
	// Added in morph M1 — the grid shell vocabulary.
	["cols", "1fr 2fr", "gridTemplateColumns"],
	["rows", "auto 1fr", "gridTemplateRows"],
	["areas", '"a b"', "gridTemplateAreas"],
	["area", "hero", "gridArea"],
	["font", "Verdana", "fontFamily"],
	["exact", "19px", "fontSize"],
];

for (const cls of Object.keys(build)) {
	test(`${cls}: styleMap options apply their own value`, () => {
		for (const [option, value, prop] of STYLE_MAP) {
			const { style } = styleAfter(cls, { [option]: value });
			assert.equal(style[prop], value,
				`${cls}.set({ ${option}: ${JSON.stringify(value)} }) ` +
				`should write ${prop}=${value}, wrote ${JSON.stringify(style[prop])}`);
		}
	});
}

// ── dispatched options: routed through a method, where values get lost ──

const DISPATCHED = [
	["pad, bare number is px", { pad: [{ a: 40 }] },
		(s) => assert.equal(s.padding, "40px")],
	["pad, string passes through", { pad: [{ a: "2rem" }] },
		(s) => assert.equal(s.padding, "2rem")],
	["pad, calc() survives", { pad: [{ a: "calc(8px + 2vw)" }] },
		(s) => assert.match(s.padding, /calc\(/)],
	["pad, sides combine", { pad: [{ tb: 12 }] },
		(s) => { assert.equal(s.paddingTop, "12px"); assert.equal(s.paddingBottom, "12px"); }],
	["mar, bare number is px", { mar: [{ a: 10 }] },
		(s) => assert.equal(s.margin, "10px")],
	["mar: center is auto sides", { mar: "center" },
		(s) => { assert.equal(s.marginLeft, "auto"); assert.equal(s.marginRight, "auto"); }],
	// The morph axes ride on this one: style["--x"] = v is a silent no-op,
	// only setProperty reaches a custom property.
	["vars writes a custom property", { vars: { "--nod-x": "0.4" } },
		(s, el) => assert.equal(el.res.style.getPropertyValue("--nod-x"), "0.4")],
	["vars value is calc-consumable", { vars: { "--a": "3px" }, width: "calc(var(--a) * 2)" },
		(s) => assert.match(s.width, /var\(--a\)/)],
	["hide", { hide: true }, (s) => assert.equal(s.display, "none")],
	["borderObj uses its width AND colour", { borderObj: { width: "3px", color: "rgb(9, 9, 9)" } },
		(s) => { assert.match(s.border, /3px/); assert.match(s.border, /9/); }],
	["transform string applies verbatim", { transform: "rotate(4deg)" },
		(s) => assert.equal(s.transform, "rotate(4deg)")],
];

for (const cls of Object.keys(build)) {
	test(`${cls}: dispatched options honour their value`, () => {
		for (const [name, options, check] of DISPATCHED) {
			const { style, el } = styleAfter(cls, options);
			try { check(style, el); }
			catch (e) { throw new Error(`${cls} — ${name}: ${e.message}`); }
		}
	});
}

test("Wrapper: its own dispatched options honour their value", () => {
	const cases = [
		[{ disp: "grid" }, (s) => assert.equal(s.display, "grid")],
		[{ flexDir: "column" }, (s) => {
			assert.equal(s.flexDirection, "column");
			assert.equal(s.display, "flex", "flexDir implies display:flex");
		}],
		[{ customAlign: "center" }, (s) => assert.equal(s.alignItems, "center")],
		[{ customJustify: "end" }, (s) => assert.equal(s.justifyItems, "end")],
		[{ ga: "hero" }, (s) => assert.equal(s.gridArea, "hero")],
		[{ sticky: true }, (s) => assert.equal(s.position, "sticky")],
		[{ simpleBorder: "1px solid rgb(2, 2, 2)" }, (s) => assert.match(s.border, /1px/)],
		[{ weight: 700 }, (s) => assert.equal(s.fontWeight, "700")],
		[{ scale: 1.2 }, (s) => assert.equal(String(s.scale), "1.2")],
	];
	for (const [options, check] of cases) check(styleAfter("Wrapper", options).style);
});

test("Text: its own dispatched options honour their value", () => {
	const cases = [
		// S1…S6 are the fluid scale — a calc(), not a fixed size.
		[{ size: "S1" }, (s) => assert.match(s.fontSize, /calc\(/)],
		[{ italic: true }, (s) => assert.equal(s.fontStyle, "italic")],
		[{ block: true }, (s) => assert.equal(s.display, "block")],
		[{ breakWord: true }, (s) => assert.equal(s.wordWrap, "break-word")],
		[{ align: "center" }, (s) => assert.equal(s.textAlign, "center")],
	];
	for (const [options, check] of cases) check(styleAfter("Text", options).style);
});

test("a distinct value produces a distinct result (the anti-hardcode check)", () => {
	// The shape of the UINavBar.radius bug: two different inputs, one
	// output. Any option whose result does not track its input fails here
	// even if it looks supported.
	for (const cls of Object.keys(build)) {
		const a = styleAfter(cls, { radius: "4px" }).style.borderRadius;
		const b = styleAfter(cls, { radius: "40px" }).style.borderRadius;
		assert.notEqual(a, b, `${cls}: radius ignores its value`);

		const p1 = styleAfter(cls, { pad: [{ a: 4 }] }).style.padding;
		const p2 = styleAfter(cls, { pad: [{ a: 40 }] }).style.padding;
		assert.notEqual(p1, p2, `${cls}: pad ignores its value`);
	}
});
