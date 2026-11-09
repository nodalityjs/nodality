// lines.test.mjs: the line syntax round-trips any pair and never evaluates.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { printLines, parseLines } from "../../lib/lines.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = join(ROOT, "evals", ".cache");

const roundTrip = (pair) => {
	const text = printLines(pair);
	const back = parseLines(text);
	assert.deepEqual(back.errors, [], text);
	assert.deepEqual({ elements: back.elements, nodes: back.nodes }, pair, text);
	return text;
};

test("every agent-generated spec in the eval cache round-trips", () => {
	const files = readdirSync(CACHE).filter((f) => f.endsWith(".json") && !f.startsWith("react--"));
	let n = 0;
	for (const f of files) {
		const d = JSON.parse(readFileSync(join(CACHE, f), "utf8"));
		if (!d || !Array.isArray(d.elements)) continue;
		roundTrip({ elements: d.elements, nodes: Array.isArray(d.nodes) ? d.nodes : [] });
		n++;
	}
	assert.ok(n >= 40, `only ${n} cached specs found`);
});

test("the documented forms read as intended", () => {
	const { elements, nodes, errors } = parseLines([
		'h1 #hero "Ship it" color=#1d6fe0',
		"row #features",
		'  h2 "Plain data in"',
		'  h2 "Checked before it renders"',
		"+ shadow() hero",
		'+ gradient(gradient="linear-gradient(90deg, #000, #fff)") hero',
		"+ dither hero levels=6 size=2",
		"+ arrange(mode=column) features @0-424",
		"// a comment",
	].join("\n"));
	assert.deepEqual(errors, []);
	assert.deepEqual(elements, [
		{ type: "h1", id: "hero", text: "Ship it", color: "#1d6fe0" },
		{ type: "row", id: "features", children: [{ type: "h2", text: "Plain data in" }, { type: "h2", text: "Checked before it renders" }] },
	]);
	assert.deepEqual(nodes, [
		{ op: { name: "shadow" }, target: ["hero"] },
		{ op: { name: "gradient", gradient: "linear-gradient(90deg, #000, #fff)" }, target: ["hero"] },
		{ op: "dither", target: ["hero"], levels: 6, size: 2 },
		{ op: { name: "arrange", mode: "column" }, target: ["features"], range: [0, 424] },
	]);
});

test("ambiguous values survive: strings that look like numbers, odd keys, raw JSON lines", () => {
	roundTrip({
		elements: [
			{ type: "p", id: "a", text: "6", size: "6", n: 6, flag: "true", t: true, z: null, big: 1e21, s: "1e3", lead: "007" },
			{ type: "p", text: 'quote " and\nnewline', "weird key": "x y", list: [1, "2"], obj: { a: 1 } },
			{ $ref: "card" },
			{ type: "row", children: [] },
			{ type: "wrap", children: [{ type: "row", children: [{ type: "h2", text: "deep" }] }] },
		],
		nodes: [
			{ op: "gradient" },
			{ op: { name: "gradient" } },
			{ op: "morph", chain: [{ from: "home", to: { Work: "work" } }], back: true },
			{ op: { name: "shadow" }, target: ["#first", "@odd", "two words"] },
			{ op: { name: "arrange", mode: "row" }, target: ["f"], range: [425, 99999], by: "mouse" },
			{ op: "agent-surface", name: "studio", forms: ["contact-form"] },
		],
	});
});

test("text is never evaluated", () => {
	const { elements } = parseLines('p "${globalThis.pwned = 1}" onclick="alert(1)"');
	assert.equal(globalThis.pwned, undefined);
	assert.equal(elements[0].text, "${globalThis.pwned = 1}");
});

test("a stream cut mid-line loses only that line, and errors point at it", () => {
	const r = parseLines('h1 #a "Hi"\n+ shadow() a\n+ gradient(gradient="linear');
	assert.equal(r.elements.length, 1);
	assert.equal(r.nodes.length, 1);
	assert.equal(r.errors.length, 1);
	assert.equal(r.errors[0].line, 3);
});
