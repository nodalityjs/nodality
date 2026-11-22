// interaction-behaviours.test.mjs — the interaction and accessibility options
// every element takes (layout/behaviours/interaction.js): hover and focus,
// group hover, aria/role/tabIndex/lang/title, semantic tags, list items,
// copy to clipboard, scroll spy and the nav extensions.
//
// Rendered through Des wherever a page would be, because Des runs the
// generated code: an option the component's toCode() leaves out never reaches
// the page, and a test against the mapper's instance would not notice.

import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

let Des, Animator, applyInteraction, dom, width, reduce, observers, clipboard;

before(async () => {
	const { JSDOM } = await import("jsdom");
	dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', { pretendToBeVisual: true });
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
	Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
	globalThis.cancelAnimationFrame = () => {};
	dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
	dom.window.HTMLMediaElement.prototype.pause = () => {};
	dom.window.Element.prototype.animate ||= () => ({ finished: Promise.resolve(), cancel() {}, pause() {}, play() {} });
	// jsdom never matches :focus-visible. A browser matches it for keyboard
	// focus; here every real focus counts as keyboard focus.
	const matches = dom.window.Element.prototype.matches;
	dom.window.Element.prototype.matches = function (sel) {
		if (sel === ":focus-visible") return this === this.ownerDocument.activeElement;
		return matches.call(this, sel);
	};
	({ Des } = await import("../../lib/designer.js"));
	({ Animator } = await import("../../layout/animator.js"));
	({ applyInteraction } = await import("../../layout/behaviours/interaction.js"));
});

const atWidth = (w) => {
	width = w;
	dom.window.matchMedia = (q) => {
		if (/reduced-motion/.test(q)) return { matches: reduce, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
		const min = q.match(/min-width:\s*([\d.]+)px/), max = q.match(/max-width:\s*([\d.]+)px/);
		const matches = (!min || width >= +min[1]) && (!max || width <= +max[1]);
		return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
	};
	Object.defineProperty(dom.window, "innerWidth", { value: w, configurable: true });
};

// An IntersectionObserver the test drives: each instance is recorded with
// its options and the targets it observes, and `fire` calls it back.
class FakeIO {
	constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = []; this.disconnected = false; observers.push(this); }
	observe(t) { this.targets.push(t); }
	unobserve() {}
	disconnect() { this.disconnected = true; }
	fire(list) { this.cb(list.map(([target, isIntersecting]) => ({ target, isIntersecting }))); }
}

beforeEach(() => {
	document.getElementById("mount").innerHTML = "";
	reduce = false;
	observers = [];
	atWidth(1440);
	dom.window.IntersectionObserver = FakeIO;
	clipboard = [];
	Object.defineProperty(dom.window.navigator, "clipboard", {
		value: { writeText: (t) => { clipboard.push(t); return Promise.resolve(); } }, configurable: true,
	});
	Object.defineProperty(dom.window, "scrollY", { value: 0, configurable: true, writable: true });
});

const render = (els) => {
	const d = new Des();
	d.nodes([]).add([].concat(els)).set({ mount: "#mount", code: false, elements: false });
	return d;
};
const $ = (sel) => document.querySelector(sel);
const fire = (el, type, init = {}) => el.dispatchEvent(new dom.window.Event(type, { bubbles: !/^mouse(enter|leave)$/.test(type), ...init }));
const focusIn = (el) => el.focus();
const focusOut = (el) => el.blur();
const key = (el, k) => el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A bare Animator subclass: no commonMethods, no hover of its own. */
const box = () => {
	class Box extends Animator {
		constructor() { super(); this.res = document.createElement("div"); this.res.tabIndex = -1; document.body.appendChild(this.res); }
		set() { return this; }
	}
	return new Box();
};

// ── nothing used, nothing changed ───────────────────────────────────────

test("a page without these options renders exactly as without the behaviour layer", () => {
	const page = [
		{ type: "wrap", id: "w", children: [{ type: "p", id: "p", text: "Hi" }, { type: "a", id: "l", text: "Go", url: "#x" }] },
		{ type: "ulist", id: "u", items: ["One"] },
		{ type: "h2", id: "h", text: "Title" },
	];
	render(page);
	const html = $("#mount").innerHTML;
	// The same page with every option present but empty: still identical.
	document.getElementById("mount").innerHTML = "";
	render(page.map((e) => ({ ...e, aria: undefined, hover: undefined, spy: false, copy: undefined })));
	assert.equal($("#mount").innerHTML, html);
	assert.doesNotMatch(html, /aria-|role=|tabindex|title=/);
});

test("applyInteraction with no options touches nothing", () => {
	const b = box();
	b.res.setAttribute("style", "color: red;");
	const before = b.res.outerHTML;
	applyInteraction(b, { id: "x", color: "blue" });
	assert.equal(b.res.outerHTML, before);
	assert.equal(b._ix, undefined);
});

// ── 1. hover and focus ──────────────────────────────────────────────────

test("hover works on an element whose own set() knows nothing about it", () => {
	const b = box().set({ hover: { opacity: 0.5, letterSpacing: "2px" } });
	b.res.style.opacity = "0.9";
	fire(b.res, "mouseenter");
	assert.equal(b.res.style.opacity, "0.5");
	assert.equal(b.res.style.letterSpacing, "2px");
	fire(b.res, "mouseleave");
	assert.equal(b.res.style.opacity, "0.9", "the original inline value is restored");
	assert.equal(b.res.style.letterSpacing, "");
});

test("hover applies on keyboard focus inside the element, and stays while focus does", () => {
	render({ type: "wrap", id: "card", hover: { background: "red", opacity: 0.5 }, children: [{ type: "a", id: "in", text: "Go", url: "#go" }] });
	const card = $("#card"), link = $("#in");
	focusIn(link);
	assert.equal(card.style.backgroundColor, "red", "hover()'s own key, through the keyboard");
	assert.equal(card.style.opacity, "0.5", "a key hover() never handled");
	fire(card, "mouseenter");
	fire(card, "mouseleave");
	assert.equal(card.style.opacity, "0.5", "pointer leaving does not clear a focused element");
	focusOut(link);
	assert.equal(card.style.opacity, "");
	assert.equal(card.style.backgroundColor, "");
});

test("a link keeps its own hover() and is not double-applied", () => {
	render({ type: "a", id: "l", text: "Go", url: "#go", hover: { color: "red" } });
	const a = $("#l");
	assert.equal(a.onmouseover, null, "hover()'s handler is taken over, not run beside ours");
	const before = a.style.color;
	fire(a, "mouseenter");
	assert.equal(a.style.color, "red");
	fire(a, "mouseleave");
	assert.equal(a.style.color, before);
	focusIn(a);
	assert.equal(a.style.color, "red", "keyboard focus shows the hover state");
	focusOut(a);
	assert.equal(a.style.color, before);
});

test("a separate `focus` replaces hover for the keyboard", () => {
	const b = box().set({ hover: { opacity: 0.5 }, focus: { outline: "3px solid blue" } });
	focusIn(b.res);
	assert.equal(b.res.style.outline, "3px solid blue");
	assert.equal(b.res.style.opacity, "");
	focusOut(b.res);
	assert.equal(b.res.style.outline, "");
});

test("hover.animation builds the transition; a text whose tag swapped still hovers", () => {
	render({ type: "p", id: "t", text: "Hi", tag: "span", hover: { opacity: 0.4, animation: "0.2s ease" } });
	const t = $("#t");
	assert.equal(t.tagName, "SPAN");
	// hover() already installed the timing on the node the tag swap replaced;
	// the style attribute carried it across.
	assert.match(t.style.transition, /0.2s ease/);
	fire(t, "mouseenter");
	assert.equal(t.style.opacity, "0.4");
});

test("reduced motion: the change is applied with the transition off", () => {
	reduce = true;
	const b = box().set({ hover: { opacity: 0.5, animation: "0.3s ease" } });
	const seen = [];
	Object.defineProperty(b.res, "offsetWidth", { get() { seen.push(b.res.style.transition); return 0; } });
	fire(b.res, "mouseenter");
	assert.deepEqual(seen, ["none"], "flushed while the transition was off");
	assert.equal(b.res.style.opacity, "0.5");
	assert.match(b.res.style.transition, /opacity/, "and put back afterwards");
});

test("a second set() replaces the hover instead of stacking it", () => {
	const b = box();
	b.set({ hover: { opacity: 0.5 } });
	b.set({ hover: { opacity: 0.7 } });
	fire(b.res, "mouseenter");
	assert.equal(b.res.style.opacity, "0.7");
	fire(b.res, "mouseleave");
	assert.equal(b.res.style.opacity, "");
});

// ── 2. group hover ──────────────────────────────────────────────────────

test("groupHover descendants follow their group's hover and keyboard focus", () => {
	render({ type: "wrap", id: "g", group: true, children: [
		{ type: "p", id: "label", text: "Read", groupHover: { color: "red" } },
		{ type: "a", id: "go", text: "Go", url: "#go" },
	] });
	const g = $("#g"), label = $("#label");
	fire(g, "mouseenter");
	assert.equal(label.style.color, "red");
	fire(g, "mouseleave");
	assert.equal(label.style.color, "");
	focusIn($("#go"));
	assert.equal(label.style.color, "red");
	focusOut($("#go"));
	assert.equal(label.style.color, "");
});

test("a member answers to its nearest group only", () => {
	render({ type: "wrap", id: "outer", group: true, children: [
		{ type: "wrap", id: "inner", group: true, children: [{ type: "p", id: "m", text: "x", groupHover: { color: "red" } }] },
	] });
	fire($("#outer"), "mouseenter");
	assert.equal($("#m").style.color, "");
	fire($("#inner"), "mouseenter");
	assert.equal($("#m").style.color, "red");
});

// ── 3. accessibility attributes ─────────────────────────────────────────

test("aria, role, tabIndex, lang and title become attributes, safely", () => {
	render({ type: "wrap", id: "w", role: "region", tabIndex: 0, lang: "cs", title: "Tip",
		aria: { label: 'Say "hi"><script>x</script>', hidden: false, describedBy: ["a", "b"], live: "polite", "bad-name": 1 },
		children: [] });
	const w = $("#w");
	assert.equal(w.getAttribute("role"), "region");
	assert.equal(w.getAttribute("tabindex"), "0");
	assert.equal(w.getAttribute("lang"), "cs");
	assert.equal(w.getAttribute("title"), "Tip");
	assert.equal(w.getAttribute("aria-label"), 'Say "hi"><script>x</script>');
	assert.equal(w.getAttribute("aria-hidden"), "false");
	assert.equal(w.getAttribute("aria-describedby"), "a b");
	assert.equal(w.getAttribute("aria-live"), "polite");
	assert.equal(document.querySelectorAll("script").length, 0, "the value stayed text");
	assert.match($("#mount").innerHTML, /aria-label="Say &quot;hi&quot;>/, "the quote cannot close the attribute");
});

test("aria and role reach elements of other types too", () => {
	render([
		{ type: "img", id: "i", url: "/x.png", aria: { hidden: true } },
		{ type: "button", id: "b", text: "Go", aria: { pressed: false } },
		{ type: "h2", id: "h", text: "x", lang: "en" },
	]);
	assert.equal($("#i").getAttribute("aria-hidden"), "true");
	assert.equal(document.querySelector("[aria-pressed]").getAttribute("aria-pressed"), "false");
	assert.equal($("#h").getAttribute("lang"), "en");
});

test("title is not added where it is already the visible text", () => {
	const b = box();
	b.res.textContent = "Menu";
	b.set({ title: "Menu" });
	assert.equal(b.res.hasAttribute("title"), false);
});

// ── 4. semantic tags ────────────────────────────────────────────────────

test("wrap `as` renders an allowed semantic tag and ignores anything else", () => {
	const warn = console.warn; const said = [];
	console.warn = (m) => said.push(String(m));
	try {
		render([
			{ type: "wrap", id: "s", as: "section", background: "red", hover: { opacity: 0.5 }, children: [{ type: "p", id: "k", text: "Kid" }] },
			{ type: "wrap", id: "bad", as: "script", children: [] },
		]);
	} finally { console.warn = warn; }
	const s = $("#s");
	assert.equal(s.tagName, "SECTION");
	assert.equal(s.style.background, "red");
	assert.equal(s.querySelector("#k").textContent, "Kid");
	fire(s, "mouseenter");
	assert.equal(s.style.opacity, "0.5", "hover attached to the swapped node");
	assert.equal($("#bad").tagName, "DIV");
	assert.ok(said.some((m) => /wrap\.as/.test(m)));
});

test("text `tag` takes the text-level allowlist", () => {
	render([
		{ type: "p", id: "q", text: "Quote", tag: "blockquote" },
		{ type: "p", id: "c", text: "Author", tag: "cite" },
		{ type: "h3", id: "h", text: "Still h3", tag: "marquee" },
	]);
	assert.equal($("#q").tagName, "BLOCKQUOTE");
	assert.equal($("#c").tagName, "CITE");
	assert.equal($("#h").tagName, "H3");
});

// ── 5. lists ────────────────────────────────────────────────────────────

test("ulist wraps each item in an <li> that leaves the layout alone", () => {
	render({ type: "ulist", id: "u", items: ["One", { type: "a", id: "x", text: "Two", url: "#t" }] });
	const u = $("#u");
	assert.equal(u.tagName, "UL");
	assert.equal(u.children.length, 2);
	for (const li of u.children) {
		assert.equal(li.tagName, "LI");
		assert.equal(li.style.display, "contents");
	}
	assert.equal(u.querySelector("li > a").textContent, "Two");
});

test("ulist `ordered` renders an <ol>", () => {
	render({ type: "ulist", id: "o", ordered: true, items: ["One", "Two"] });
	assert.equal($("#o").tagName, "OL");
	assert.equal($("#o").querySelectorAll(":scope > li").length, 2);
});

test("an item that already is an <li> is not wrapped twice", () => {
	render({ type: "ulist", id: "u", items: [{ type: "p", id: "x", text: "One", tag: "li" }] });
	assert.equal($("#u").querySelector("li li"), null);
	assert.equal($("#u").children[0].id, "x");
});

// ── 6. copy ─────────────────────────────────────────────────────────────

test("copy: click copies, the label shows, it is announced and goes back", async () => {
	mock.timers.enable({ apis: ["setTimeout"] });
	try {
		render({ type: "p", id: "c", text: "npm i nodality", copy: "npm i nodality", copied: "Zkopírováno" });
		const c = $("#c");
		assert.equal(c.getAttribute("role"), "button");
		assert.equal(c.getAttribute("tabindex"), "0");
		c.click();
		await Promise.resolve(); await Promise.resolve();
		assert.deepEqual(clipboard, ["npm i nodality"]);
		assert.equal(c.textContent, "Zkopírováno");
		mock.timers.tick(40);
		const live = document.querySelector('[aria-live="polite"]');
		assert.ok(live && live.textContent === "Zkopírováno", "announced politely");
		assert.ok(!c.contains(live), "outside the button, so not part of its name");
		mock.timers.tick(1500);
		assert.equal(c.textContent, "npm i nodality");
	} finally { mock.timers.reset(); }
});

test("copy: Enter and Space work from the keyboard; `true` copies the element's text", async () => {
	render([{ type: "p", id: "c", text: "abc-123", copy: true }, { type: "p", id: "d", text: "x", copy: "def" }]);
	const c = $("#c");
	key(c, "Enter");
	await flush();
	assert.deepEqual(clipboard, ["abc-123"]);
	key(c, " ");
	await flush();
	assert.deepEqual(clipboard, ["abc-123"], "while the label shows, `true` does not copy the label itself");
	const space = new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
	$("#d").dispatchEvent(space);
	await flush();
	assert.deepEqual(clipboard, ["abc-123", "def"]);
	assert.equal(space.defaultPrevented, true, "Space does not scroll the page");
});

test("copy: falls back to execCommand without the Clipboard API", async () => {
	Object.defineProperty(dom.window.navigator, "clipboard", { value: undefined, configurable: true });
	const calls = [];
	document.execCommand = (c) => { calls.push(c); return true; };
	try {
		render({ type: "p", id: "c", text: "x", copy: "secret" });
		const areas = document.querySelectorAll("textarea").length; // Des keeps a code panel
		$("#c").click();
		await flush();
		assert.deepEqual(calls, ["copy"]);
		assert.equal($("#c").textContent, "Copied", "the default label");
		assert.equal(document.querySelectorAll("textarea").length, areas, "the helper textarea is gone");
	} finally { delete document.execCommand; }
});

test("copy on a native button adds no role or tabindex", () => {
	render({ type: "button", id: "b", text: "Copy", copy: "x" });
	const b = document.querySelector("button");
	assert.equal(b.hasAttribute("role"), false);
	assert.equal(b.hasAttribute("tabindex"), false);
});

// ── 7. spy ──────────────────────────────────────────────────────────────

const sections = (ids) => ids.map((id) => ({ type: "wrap", id, children: [{ type: "p", id: `${id}-t`, text: id }] }));

test("spy marks the link whose section crosses the reading line — one at a time", async () => {
	render([
		{ type: "wrap", id: "toc", spy: { activeStyle: { color: "red" } }, children: [
			{ type: "a", id: "la", text: "A", url: "#a" },
			{ type: "a", id: "lb", text: "B", url: "#b" },
			{ type: "a", id: "lx", text: "Out", url: "https://example.com" },
		] },
		...sections(["a", "b"]),
	]);
	await flush();
	assert.equal(observers.length, 1);
	const io = observers[0];
	assert.equal(io.opts.root, null, "the document scroll");
	assert.deepEqual(io.targets.map((t) => t.id).sort(), ["a", "b"]);
	const a = $("#a"), b = $("#b");
	// jsdom's view is 768px tall: the reading line sits at 30%, ~230px.
	const at = (el, top, bottom) => { el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 100, height: bottom - top, width: 100 }); };
	at(a, -50, 100); at(b, 200, 600);
	io.fire([[b, true]]);
	assert.equal($("#lb").getAttribute("aria-current"), "true");
	assert.equal($("#lb").style.color, "red");
	assert.equal($("#la").hasAttribute("aria-current"), false);
	at(a, -50, 400); at(b, 400, 800);
	io.fire([[a, true]]);
	assert.equal($("#la").getAttribute("aria-current"), "true", "the one at the line wins");
	assert.equal($("#lb").hasAttribute("aria-current"), false);
	assert.notEqual($("#lb").style.color, "red", "the style is restored");
	at(a, -400, 200); at(b, 500, 900);
	io.fire([[a, false], [b, false]]);
	assert.equal($("#la").getAttribute("aria-current"), "true", "just past a section, it stays lit");
	at(a, 300, 700); at(b, 800, 1200);
	io.fire([[a, true]]);
	assert.equal($("#la").hasAttribute("aria-current"), false, "above the first section nothing is lit");
	assert.equal($("#lb").hasAttribute("aria-current"), false);
});

test("spy observes a section inside a horizontal scroller against that scroller", async () => {
	render([
		{ type: "wrap", id: "toc", spy: true, children: [{ type: "a", id: "l1", text: "1", url: "#s1" }] },
		{ type: "wrap", id: "track", overflowX: "auto", children: sections(["s1"]) },
	]);
	await flush();
	const io = observers.find((o) => o.targets.some((t) => t.id === "s1"));
	assert.equal(io.opts.root, $("#track"));
	assert.match(io.opts.rootMargin, /-50%/);
	io.fire([[$("#s1"), true]]);
	assert.equal($("#l1").getAttribute("aria-current"), "true");
	assert.equal($("#l1").style.textDecoration, "underline", "the default style");
});

test("spy in a sideways row: the run that has reached the leading edge is active, and center keeps its link centred", async () => {
	render([
		{ type: "wrap", id: "rail", overflowX: "auto", spy: { center: true }, children: [
			{ type: "a", id: "l1", text: "2026", url: "#y1" },
			{ type: "a", id: "l2", text: "2025", url: "#y2" },
			{ type: "a", id: "l3", text: "2024", url: "#y3" },
		] },
		{ type: "wrap", id: "tape", overflowX: "auto", children: sections(["y1", "y2", "y3"]) },
	]);
	const at = (el, left, width = 100) => { el.getBoundingClientRect = () => ({ left, right: left + width, width, top: 0, bottom: 50, height: 50 }); };
	let shift = 0;
	at($("#tape"), 0, 400);
	for (const [i, id] of ["y1", "y2", "y3"].entries()) $(`#${id}`).getBoundingClientRect = () => ({ left: i * 300 - shift, right: i * 300 - shift + 280, width: 280, top: 0, bottom: 50, height: 50 });
	const rail = $("#rail");
	Object.defineProperty(rail, "scrollWidth", { value: 600, configurable: true });
	Object.defineProperty(rail, "clientWidth", { value: 200, configurable: true });
	at(rail, 0, 200);
	["l1", "l2", "l3"].forEach((id, i) => at($(`#${id}`), i * 200, 60));
	const scrolls = [];
	rail.scrollBy = (o) => scrolls.push(o.left);
	await flush();
	const io = observers.find((o) => o.targets.some((t) => t.id === "y1"));
	io.fire([[$("#y1"), true]]);
	assert.equal($("#l1").getAttribute("aria-current"), "true", "at the start: the first year, not the second at 30%");
	shift = 300;
	io.fire([[$("#y2"), true]]);
	assert.equal($("#l2").getAttribute("aria-current"), "true", "scrolled one run on: the next year");
	assert.equal($("#l1").hasAttribute("aria-current"), false);
	assert.equal(scrolls[scrolls.length - 1], 200 + 30 - 100, "the rail scrolled to centre 2025");
});

test("spy without IntersectionObserver does nothing and throws nothing", async () => {
	dom.window.IntersectionObserver = undefined;
	render([{ type: "wrap", id: "toc", spy: true, children: [{ type: "a", id: "l", text: "A", url: "#a" }] }, ...sections(["a"])]);
	await flush();
	assert.equal($("#l").hasAttribute("aria-current"), false);
});

// ── 8. nav ──────────────────────────────────────────────────────────────

const NAV = { type: "nav", id: "nav", items: [{ title: "A", link: "#a" }, { title: "B", link: "#b" }],
	actions: [{ type: "a", id: "cta", text: "Book", url: "#contact", background: "#111", color: "#fff" }] };

test("nav.actions render after the links on desktop", () => {
	render(NAV);
	const bar = $("nav");
	const texts = [...bar.querySelectorAll("a")].map((a) => a.textContent.trim());
	assert.deepEqual(texts.slice(-3), ["A", "B", "Book"]);
});

test("nav.actions sit inside the phone's menu panel", () => {
	atWidth(390);
	render(NAV);
	const panel = $(".navbar-content");
	assert.ok([...panel.querySelectorAll("a")].some((a) => a.textContent.trim() === "Book"));
});

test("nav.spy highlights the nav's links; nav.aria names the nav", async () => {
	render([{ ...NAV, spy: { activeStyle: { color: "red" } }, aria: { label: "Main" } }, ...sections(["a", "b"])]);
	await flush();
	assert.equal($("nav").getAttribute("aria-label"), "Main");
	// One observer per bar: the phone's bar keeps its own state while the
	// desktop one is on screen.
	const ios = observers.filter((o) => o.targets.some((t) => t.id === "b"));
	assert.equal(ios.length, 2);
	$("#b").getBoundingClientRect = () => ({ top: 10, bottom: 500, left: 0 });
	for (const io of ios) io.fire([[$("#b"), true]]);
	const lit = [...$("nav").querySelectorAll('a[aria-current="true"]')];
	assert.deepEqual(lit.map((a) => a.textContent.trim()), ["B"]);
	assert.equal(lit[0].style.color, "red");
});

const scrollTo = (y) => { dom.window.scrollY = y; dom.window.dispatchEvent(new dom.window.Event("scroll")); };

test("nav.hideOnScroll: hides scrolling down, returns scrolling up — only when fixed", () => {
	render({ type: "wrap", id: "top", position: "fixed", children: [{ ...NAV, hideOnScroll: true }] });
	const top = $("#top");
	top.getBoundingClientRect = () => ({ top: 0, bottom: 80, height: 80, left: 0 });
	scrollTo(400);
	assert.match(top.style.transform, /translateY\(-82px\)/);
	scrollTo(300);
	assert.equal(top.style.transform, "");
});

test("nav.hideOnScroll: a bar in the flow is left alone; reduced motion never hides", () => {
	render({ ...NAV, hideOnScroll: true });
	scrollTo(400);
	assert.equal($("nav").style.transform, "");
	document.getElementById("mount").innerHTML = "";
	reduce = true;
	render({ type: "wrap", id: "top", position: "fixed", children: [{ ...NAV, hideOnScroll: true }] });
	scrollTo(800);
	assert.equal($("#top").style.transform, "");
});

test("nav.hideOnScroll: keyboard focus entering the hidden bar brings it back", () => {
	render({ type: "wrap", id: "top", position: "fixed", children: [{ ...NAV, hideOnScroll: true }] });
	const top = $("#top");
	top.getBoundingClientRect = () => ({ top: 0, bottom: 80, height: 80, left: 0 });
	scrollTo(400);
	assert.notEqual(top.style.transform, "");
	focusIn($("nav a"));
	assert.equal(top.style.transform, "");
});

// ── destroy ─────────────────────────────────────────────────────────────

test("destroy() releases listeners, observers and the live region, and restores styles", async () => {
	const d = render([
		{ type: "wrap", id: "w", hover: { opacity: 0.5 }, children: [] },
		{ type: "p", id: "c", text: "x", copy: "x" },
		{ type: "wrap", id: "toc", spy: true, children: [{ type: "a", id: "l", text: "A", url: "#a" }] },
		...sections(["a"]),
	]);
	const w = $("#w"), c = $("#c");
	const regions = () => document.querySelectorAll('[aria-live="polite"]').length;
	const before = regions();
	c.click();
	await flush();
	assert.equal(regions(), before + 1);
	await flush();
	fire(w, "mouseenter");
	assert.equal(w.style.opacity, "0.5");
	d.destroy();
	assert.equal(w.style.opacity, "", "the hover style is taken back");
	fire(w, "mouseenter");
	assert.equal(w.style.opacity, "", "and the listener is gone");
	assert.equal(regions(), before, "the live region is removed");
	assert.ok(observers.length && observers.every((o) => o.disconnected));
});

test("destroy() on a bare component releases its window scroll listener", () => {
	const b = box();
	const added = [], removed = [];
	const add = dom.window.addEventListener, rem = dom.window.removeEventListener;
	dom.window.addEventListener = function (t, ...r) { added.push(t); return add.call(this, t, ...r); };
	dom.window.removeEventListener = function (t, ...r) { removed.push(t); return rem.call(this, t, ...r); };
	try {
		b.set({ hideOnScroll: true });
		b.destroy();
	} finally { dom.window.addEventListener = add; dom.window.removeEventListener = rem; }
	assert.deepEqual(added.filter((t) => t === "scroll"), ["scroll"]);
	assert.deepEqual(removed.filter((t) => t === "scroll"), ["scroll"]);
});
