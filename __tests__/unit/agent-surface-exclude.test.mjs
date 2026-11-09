// agent-surface-exclude.test.mjs: excluded views are refused at runtime.
//
// Architecture scan 8 Nov 2026, §3: `exclude` was enforced only in the
// schema. An agent naming an excluded view reached it whenever a graph edge
// led there, and refusals listed every view, excluded ones included.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body><div id=\"mount\"></div></body>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const tools = {};
dom.window.document.modelContext = {
	registerTool(t) { tools[t.name] = t; },
	unregisterTool(name) { delete tools[name]; },
};

const { installAgentSurface } = await import("../../lib/webmcp-adapter.js");

const CHAIN = {
	op: "morph", effect: "t-vhs", duration: 620, back: true,
	chain: [
		{ from: "home", to: { Work: "work", Contact: "contact" } },
		{ from: "work", to: { Aurora: "aurora" } },
		{ from: "aurora", to: { Contact: "contact" } },
	],
};

// A morph controller stand-in: four views, edges from the chain.
function fakeMorph() {
	const view = (id) => {
		const el = dom.window.document.createElement("section");
		el.textContent = `secret text of ${id}`;
		return el;
	};
	const edges = { home: ["work", "contact"], work: ["aurora"], aurora: ["contact"], contact: [] };
	return {
		states: new Map(["home", "work", "aurora", "contact"].map((id) => [id, view(id)])),
		current: "home",
		history: [],
		async goToState(id) {
			if (edges[this.current].includes(id)) { this.history.push(this.current); this.current = id; }
		},
		async goBack() { if (this.history.length) this.current = this.history.pop(); },
	};
}

function install(morph) {
	for (const k of Object.keys(tools)) delete tools[k];
	installAgentSurface({
		mount: dom.window.document.querySelector("#mount"),
		elements: [],
		nodes: [CHAIN, { op: "agent-surface", exclude: ["aurora"] }],
		morphs: [morph],
	});
	return Object.values(tools).find((t) => /navigate/.test(t.name));
}

test("navigating to an excluded view is refused even when an edge leads there", async () => {
	const morph = fakeMorph();
	const nav = install(morph);
	assert.ok(nav, "a navigate tool is registered");
	await nav.execute({ destination: "work" });
	assert.equal(morph.current, "work");
	const r = await nav.execute({ destination: "aurora" });
	assert.equal(r.ok, false);
	assert.equal(r.code, "EXCLUDED_VIEW");
	assert.equal(morph.current, "work", "the transition never ran");
	assert.ok(!r.valid.includes("aurora"));
});

test("refusals never list an excluded view", async () => {
	const nav = install(fakeMorph());
	const unknown = await nav.execute({ destination: "nowhere" });
	assert.equal(unknown.code, "UNKNOWN_VIEW");
	assert.ok(!unknown.valid.includes("aurora"), JSON.stringify(unknown.valid));
});

test("content of an excluded view is never returned, even if a person navigated there", async () => {
	const morph = fakeMorph();
	install(morph);
	morph.current = "aurora";
	const read = Object.values(tools).find((t) => /read/.test(t.name));
	if (read) {
		const r = await read.execute({});
		assert.equal(r.ok, false);
		assert.equal(r.code, "EXCLUDED_VIEW");
		assert.ok(!JSON.stringify(r).includes("secret text of aurora"));
	}
	morph.history = ["aurora"];
	morph.current = "contact";
	const back = Object.values(tools).find((t) => /back/.test(t.name));
	if (back) {
		const r = await back.execute({});
		assert.equal(r.view, "aurora");
		assert.equal(r.excluded, true);
		assert.ok(!JSON.stringify(r).includes("secret text of aurora"));
	}
});
