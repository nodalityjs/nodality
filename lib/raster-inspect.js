/*!
 * nodality v1.3.0
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * raster-inspect.js — a dev overlay for running raster pipelines.
 *
 * Open a page that uses raster ops, call inspectRaster(), and every
 * attached pipeline appears as a Houdini-style stack: ops in chain order,
 * the stage each contributes to, its params as live controls, and the
 * field wiring drawn as matching colour chips. Drag a value and the pixels
 * change on the next frame.
 *
 *     import { inspectRaster } from "nodality/inspect";
 *     inspectRaster();
 *
 * NOT a node editor. It reads the chain the page already built and lets
 * you tune it; it does not let you add ops or rewire fields. That is
 * roughly a fifth of an editor's work for most of its value, and it
 * doubles as documentation — the panel IS the op reference, generated from
 * the registry rather than written twice.
 *
 * Two properties it must hold, both e2e-tested:
 *
 *   - Tuning a uniform param NEVER mutates the host subtree. The whole
 *     library claim is that these effects sit beside your DOM rather than
 *     rewriting it, and a dev tool that quietly re-rendered the page while
 *     you dragged would make that claim untestable.
 *   - Copy-as-code emits the nodes array, not a screenshot of it. Raster
 *     nodes are plain data, so what you copy is what you paste.
 *
 * This file styles itself inline. That is the one sanctioned exception to
 * the no-raw-DOM-styling rule: the panel is a dev tool, not library
 * output, and it must look the same on a page whose CSS it has never seen.
 * Nothing here ships in a user's render tree.
 *
 * DOM-touching by nature, so unlike the rest of lib/ it does nothing at
 * import time — inspectRaster() is the only entry point.
 */

import {
	activeRasterPipelines, isStructuralChange, REGISTRY, RASTER_PARAM_EVENT,
	FRAMEWORK_DOC,
} from "./raster-ops.js";

const STAGE_OF = (op) => {
	const s = (REGISTRY[op] || {}).stage;
	return Array.isArray(s) ? s.join("+") : (s || "?");
};

// Field chips: a producer and its consumers share a colour, so the wiring
// is readable without drawing wires.
const CHIP_COLORS = ["#7dd3fc", "#4ade80", "#fbbf24", "#f472b6", "#c4b5fd", "#fb923c"];

const css = (el, styles) => { for (const k in styles) el.style[k] = styles[k]; return el; };
const mk = (tag, styles, text) => {
	const el = document.createElement(tag);
	if (styles) css(el, styles);
	if (text != null) el.textContent = text;
	return el;
};

const PANEL = {
	position: "fixed", top: "12px", right: "12px", width: "340px",
	maxHeight: "calc(100vh - 24px)", overflowY: "auto", zIndex: "2147483600",
	background: "rgba(11, 20, 32, 0.96)", color: "#e8eef5",
	font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
	border: "1px solid #1e2f44", borderRadius: "12px",
	boxShadow: "0 18px 50px rgba(0,0,0,0.5)", padding: "0 0 10px",
};

/**
 * The params of an op, as `{ key, meta, value, defaulted }`.
 *
 * This used to guess, by calling `def.uniforms(node, 1)` and taking the
 * keys. That is the UNIFORM list, which is not the param list, and the
 * gap is not academic: `duotone` takes `colors: [dark, light]` and uploads
 * it as two uniforms `a` and `b`, so the panel offered an "a" and a "b"
 * box, and typing in either wrote a key duotone never reads. It also had
 * no way to know a param the caller had not set — every such field
 * rendered empty, and an unset boolean (`mask.invert`) came out as a text
 * box, because the type was inferred from a value that wasn't there.
 *
 * With `doc.params` (phase H4) the op states its own contract: the real
 * names, their defaults, and a unit that picks the control. Ops without a
 * doc — anyone's op, registered at runtime — keep the old introspection,
 * so this degrades rather than breaks.
 */
function paramsOf(node) {
	const def = REGISTRY[node.op] || {};
	const declared = def.doc && def.doc.params;
	const seen = new Set();
	const out = [];
	const push = (key, meta) => {
		if (seen.has(key) || key === "op") return;
		seen.add(key);
		const value = node[key];
		out.push({
			key, meta: meta || null, value,
			// Nothing was written for this key, so what the panel shows is
			// the op's own fallback rather than the caller's choice.
			defaulted: value === undefined,
		});
	};

	if (declared) {
		for (const [k, meta] of Object.entries(declared)) push(k, meta);
	} else {
		try { for (const k in (def.uniforms ? def.uniforms(node, 1) : {})) push(k, null); }
		catch (e) { /* an op whose uniforms() needs more than a bare node */ }
		for (const k of def.structural || []) push(k, null);
		for (const k of def.structuralOnToggle || []) push(k, null);
	}

	// Shared params live on every node whatever the op, so they are
	// defined once in raster-ops and merged in here rather than repeated
	// in fifteen docs. Only shown when the node actually carries one —
	// otherwise every op grows five rows nobody set.
	for (const [k, meta] of Object.entries(FRAMEWORK_DOC)) {
		if (node[k] !== undefined) push(k, meta);
	}
	// And anything else the caller set: an undocumented extension, or a
	// typo. Showing it is how you find out which.
	for (const k of Object.keys(node)) push(k, null);
	return out;
}

const isNum = (v) => typeof v === "number";
const isBool = (v) => typeof v === "boolean";
const isColor = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

// What control a param gets, and how it reads back. Driven by the
// declared unit when there is one, and by the value's own type otherwise
// — which is all the old code had, and why an unset boolean became a
// text box.
const KIND_BY_UNIT = {
	bool: "bool", color: "color",
	px: "num", ratio: "num", deg: "num", count: "num", seconds: "num",
	name: "text", point: "text", range: "text",
};
const STEP_BY_UNIT = { ratio: "0.01", seconds: "0.01", count: "1", px: "1", deg: "1" };

function kindOf(meta, value) {
	if (meta && meta.unit && KIND_BY_UNIT[meta.unit]) return KIND_BY_UNIT[meta.unit];
	const v = value !== undefined ? value : (meta ? meta.default : undefined);
	if (isBool(v)) return "bool";
	if (isColor(v)) return "color";
	if (isNum(v)) return "num";
	return "text";
}

/**
 * Open the inspector.
 *
 * @param {object} [opts]
 * @param {HTMLElement} [opts.mount] where to attach the panel (default body)
 * @returns {{ refresh(): void, close(): void }}
 */
function inspectRaster(opts = {}) {
	if (typeof document === "undefined") {
		throw new Error("[nodality] inspectRaster() needs a DOM");
	}
	const mount = opts.mount || document.body;
	const panel = css(document.createElement("div"), PANEL);
	panel.setAttribute("data-nodality-inspector", "");

	const header = css(mk("div"), {
		display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px",
		borderBottom: "1px solid #1e2f44", position: "sticky", top: "0",
		background: "rgba(11, 20, 32, 0.98)",
	});
	const title = mk("strong", { color: "#7dd3fc", letterSpacing: "0.04em" }, "RASTER");
	const count = mk("span", { color: "#6b7d91" }, "");
	const closeBtn = css(mk("button", null, "✕"), {
		marginLeft: "auto", background: "transparent", color: "#93a3b5",
		border: "1px solid #1e2f44", borderRadius: "6px", cursor: "pointer",
		font: "inherit", padding: "2px 7px",
	});
	header.append(title, count, closeBtn);
	panel.appendChild(header);

	const body = mk("div", { padding: "4px 0" });
	panel.appendChild(body);

	// Every control this render built, so a value written from ANYWHERE else
	// — the page's own UI, the console, another panel — can pull the matching
	// field straight. Without this the panel shows whatever was true when it
	// opened, which is the one thing a live inspector must never do.
	let controls = [];

	const render = () => {
		body.textContent = "";
		controls = [];
		const pipelines = activeRasterPipelines();
		count.textContent = `${pipelines.length} pipeline${pipelines.length === 1 ? "" : "s"}`;

		if (!pipelines.length) {
			body.appendChild(css(mk("div", null,
				"No raster pipelines attached. They register on attach, so open this after the page renders."),
				{ padding: "14px 12px", color: "#6b7d91" }));
			return;
		}

		pipelines.forEach((pipe, pi) => {
			const group = mk("div", { borderBottom: "1px solid #16243550", padding: "8px 12px" });

			// The backend badge is the first thing worth knowing: half the
			// ops behave differently, and `echo` does nothing at all, on
			// snapshot capture.
			const live = pipe.backend === "live";
			const bar = mk("div", { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" });
			bar.append(
				mk("span", { color: "#93a3b5" }, `#${pi}`),
				css(mk("span", null, live ? "live" : "snapshot"), {
					fontSize: "10px", fontWeight: "700", letterSpacing: "0.06em",
					textTransform: "uppercase", padding: "2px 6px", borderRadius: "999px",
					color: live ? "#4ade80" : "#93a3b5",
					background: live ? "rgba(74,222,128,0.12)" : "rgba(147,163,181,0.1)",
				}),
				css(mk("span", null, `${pipe.nodes.length} op${pipe.nodes.length === 1 ? "" : "s"}`),
					{ color: "#6b7d91", marginLeft: "auto" }),
			);
			group.appendChild(bar);

			// Assign a colour per field name so producer and consumers match.
			const fields = new Map();
			const chipFor = (name) => {
				if (!fields.has(name)) fields.set(name, CHIP_COLORS[fields.size % CHIP_COLORS.length]);
				return fields.get(name);
			};
			for (const n of pipe.nodes) {
				if (n.op === "mask" || n.op === "noise") chipFor(n.as || "mask");
				if (n.masked) chipFor(n.masked === true ? "mask" : n.masked);
			}

			pipe.nodes.forEach((node, ni) => {
				const row = mk("div", {
					borderLeft: "2px solid #1e2f44", paddingLeft: "8px", margin: "6px 0 8px",
				});
				const head = mk("div", { display: "flex", alignItems: "baseline", gap: "6px" });
				const opName = mk("b", { color: "#c4b5fd" }, node.op);
				const summary = (REGISTRY[node.op] || {}).doc?.summary;
				if (summary) opName.title = summary;
				head.append(
					opName,
					mk("span", { color: "#6b7d91", fontSize: "11px" }, STAGE_OF(node.op)),
				);
				// The wiring, as chips.
				const produces = (node.op === "mask" || node.op === "noise") ? (node.as || "mask") : null;
				const consumes = node.masked ? (node.masked === true ? "mask" : node.masked) : null;
				for (const [label, name] of [["→", produces], ["←", consumes]]) {
					if (!name) continue;
					head.appendChild(css(mk("span", null, `${label} ${name}`), {
						fontSize: "10px", padding: "1px 5px", borderRadius: "999px",
						color: chipFor(name), background: chipFor(name) + "1f",
					}));
				}
				row.appendChild(head);

				for (const { key, meta, value, defaulted } of paramsOf(node)) {
					// The value the op is ACTUALLY using: what the caller set,
					// or the documented fallback. Showing the fallback is the
					// point — an empty box told you a param existed and
					// nothing else.
					const shown = defaulted && meta ? meta.default : value;
					// Objects and arrays (merge branches, copy points, a
					// mask's `at`) are structure, not a knob. Show the value
					// read-only rather than faking a control OR hiding the
					// param — the panel doubles as the op reference, and a
					// param you cannot see is one you will never use.
					const isStructure =
						shown !== undefined && shown !== null && typeof shown === "object";

					const kind = isStructure ? "text" : kindOf(meta, value);
					const structural = (meta && meta.structural) ||
						isStructuralChange(node.op, key, value, value === 0 ? 1 : 0);
					const line = mk("label", {
						display: "flex", alignItems: "center", gap: "6px",
						margin: "3px 0", fontSize: "11px",
					});
					const label = css(mk("span", null, key), {
						color: "#93a3b5", minWidth: "92px",
					});
					// The doc, where a doc is the natural place for it: the
					// panel IS the op reference, so the summary rides along
					// rather than living in a manual nobody has open.
					if (meta && meta.summary) label.title = meta.summary;
					line.appendChild(label);

					let input;
					if (kind === "bool") {
						input = mk("input"); input.type = "checkbox"; input.checked = !!shown;
					} else if (kind === "color") {
						input = mk("input"); input.type = "color";
						input.value = isColor(shown) ? shown : "#000000";
					} else if (kind === "num") {
						input = mk("input"); input.type = "number";
						input.step = (meta && STEP_BY_UNIT[meta.unit]) ||
							(Math.abs(Number(shown)) < 2 ? "0.01" : "1");
						input.value = shown == null ? "" : String(shown);
					} else {
						input = mk("input"); input.type = "text";
						input.value = isStructure ? JSON.stringify(shown)
							: (shown == null ? "" : String(shown));
						if (isStructure) {
							input.readOnly = true;
							input.title = "structure — edit this in the nodes array";
						}
					}
					css(input, {
						flex: "1", minWidth: "0", background: "#0b1420", color: "#e8eef5",
						border: "1px solid #1e2f44", borderRadius: "6px", padding: "2px 6px",
						font: "inherit", fontSize: "11px",
						// Dimmed while it is showing the op's fallback, so an
						// inherited value is distinguishable from one this page
						// chose. It stops being dim the moment you edit it.
						opacity: defaulted ? "0.55" : "1",
					});
					input.oninput = () => {
						if (isStructure) return;   // read-only; nothing to write
						const next = kind === "bool" ? input.checked
							: kind === "num" ? Number(input.value)
								: input.value;
						input.style.opacity = "1";
						const how = pipe.setParam(ni, key, next);
						// A rebuild replaces the pipeline object, so the panel
						// has to re-read the world rather than keep pointing at
						// a handle that is now destroyed.
						if (how === "rebuild") setTimeout(render, 0);
					};
					line.appendChild(input);
					controls.push({ pipe, ni, key, input });

					if (structural) {
						line.appendChild(css(mk("span", null, "↻"), {
							color: "#fbbf24", fontSize: "10px",
							title: "changing this recompiles the shader",
						}));
					}
					row.appendChild(line);
				}
				group.appendChild(row);
			});

			// Copy the chain as the array it is. No toCode() — raster nodes
			// are data, so this round-trips by construction.
			const copy = css(mk("button", null, "copy chain"), {
				background: "transparent", color: "#7dd3fc", border: "1px solid #1e2f44",
				borderRadius: "6px", cursor: "pointer", font: "inherit",
				fontSize: "11px", padding: "3px 8px",
			});
			copy.onclick = async () => {
				const src = JSON.stringify(pipe.nodes, null, 2);
				try { await navigator.clipboard.writeText(src); copy.textContent = "copied"; }
				catch (e) { copy.textContent = "clipboard blocked"; }
				setTimeout(() => (copy.textContent = "copy chain"), 1200);
			};
			group.appendChild(copy);
			body.appendChild(group);
		});
	};

	const onKey = (e) => { if (e.key === "Escape") api.close(); };

	// setParam announces every write, whoever made it. Update the one field
	// it names rather than re-rendering: a full re-render mid-drag would drop
	// focus and the caret. The field being typed into is skipped — it already
	// holds the value that caused this event, and writing to it would fight
	// the user (and rewrite "0.2" to "0.2" as they reach for the 5).
	const onParam = (e) => {
		const { pipeline, index, key, value } = e.detail;
		for (const f of controls) {
			if (f.pipe !== pipeline || f.ni !== index || f.key !== key) continue;
			if (f.input === document.activeElement) continue;
			if (f.input.type === "checkbox") f.input.checked = !!value;
			else f.input.value = value == null ? "" : String(value);
		}
	};

	const api = {
		refresh: render,
		close() {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener(RASTER_PARAM_EVENT, onParam);
			panel.remove();
		},
	};
	closeBtn.onclick = api.close;
	document.addEventListener("keydown", onKey);
	document.addEventListener(RASTER_PARAM_EVENT, onParam);

	render();
	mount.appendChild(panel);
	return api;
}

/**
 * Open the inspector only when the page asks for it via the URL:
 * `?nodality-inspect=1`. Opt-in per page — nothing auto-injects a dev tool.
 */
function auto(opts) {
	if (typeof location === "undefined") return null;
	const on = new URLSearchParams(location.search).get("nodality-inspect");
	return on && on !== "0" ? inspectRaster(opts) : null;
}

export { inspectRaster, auto };
