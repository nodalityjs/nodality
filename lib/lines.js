/*!
 * nodality v1.5.6
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * lines.js: a compact line syntax for the (elements, nodes) pair.
 *
 * One statement per line, so a model's output streams, an error points at a
 * line, and an edit replaces a line. It is parsed, never evaluated: page text
 * stays data. print() and parse() round-trip any pair, so the JSON form stays
 * the stored and validated one.
 *
 *   h1 #hero "Ship it" color=#1d6fe0      an element: type, #id, "text", key=value
 *   row #features                         children are indented two spaces
 *     h2 "Plain data in"
 *   + shadow() hero                       a node: {op:{name:"shadow"}, target:["hero"]}
 *   + gradient(gradient="linear-gradient(90deg, #000, #fff)") hero
 *   + dither hero levels=6 size=2         {op:"dither", target:["hero"], levels:6, size:2}
 *   + arrange(mode=column) features @0-424
 *   { "$ref": "card" }                    any element as raw JSON
 *   + { "op": "morph", "chain": [] }      any node as raw JSON
 *   // a comment
 *
 * Values are bare when unambiguous (3px, #fff, column, 6, true) and JSON
 * otherwise ("two words", [1,2], {"a":1}). A bare number or true/false/null
 * means the number or literal; the string "6" prints as "6".
 *
 * Pure module: no DOM at import.
 */

const BARE = /^[A-Za-z0-9#._%/:+-]+$/;
const NUM = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;
const KEY = /^[A-Za-z_$][\w$-]*$/;
const ID = /^[A-Za-z0-9_-]+$/;
const OP = /^[A-Za-z][\w-]*$/;

// ── printing ─────────────────────────────────────────────────────────

function value(v) {
    if (typeof v === "string" && v.length && BARE.test(v) && !NUM.test(v)
        && !["true", "false", "null"].includes(v) && !v.startsWith("@") && !v.startsWith("+")) return v;
    return JSON.stringify(v);
}

const key = (k) => (KEY.test(k) ? k : JSON.stringify(k));
const pairs = (obj, skip) => Object.keys(obj)
    .filter((k) => !skip.includes(k) && obj[k] !== undefined)
    .map((k) => `${key(k)}=${value(obj[k])}`);

function printElement(el, depth, out) {
    const pad = "  ".repeat(depth);
    if (!el || typeof el !== "object" || Array.isArray(el) || typeof el.type !== "string" || !OP.test(el.type)) {
        out.push(pad + JSON.stringify(el));
        return;
    }
    const parts = [el.type];
    const skip = ["type"];
    if (typeof el.id === "string" && ID.test(el.id)) { parts.push(`#${el.id}`); skip.push("id"); }
    if (typeof el.text === "string") { parts.push(JSON.stringify(el.text)); skip.push("text"); }
    const kids = Array.isArray(el.children) && el.children.length
        && el.children.every((c) => c && typeof c === "object" && !Array.isArray(c));
    if (kids) skip.push("children");
    parts.push(...pairs(el, skip));
    out.push(pad + parts.join(" "));
    if (kids) for (const c of el.children) printElement(c, depth + 1, out);
}

function printNode(node, out) {
    if (!node || typeof node !== "object" || Array.isArray(node)) { out.push("+ " + JSON.stringify(node)); return; }
    const op = node.op;
    let head;
    if (typeof op === "string" && OP.test(op)) head = op;
    else if (op && typeof op === "object" && !Array.isArray(op) && typeof op.name === "string" && OP.test(op.name)) {
        head = `${op.name}(${pairs(op, ["name"]).join(", ")})`;
    } else { out.push("+ " + JSON.stringify(node)); return; }
    const parts = [head];
    const skip = ["op"];
    if (Array.isArray(node.target) && node.target.length
        && node.target.every((t) => typeof t === "string" && BARE.test(t) && !NUM.test(t) && !t.startsWith("@"))) {
        parts.push(...node.target);
        skip.push("target");
    }
    const r = node.range;
    if (Array.isArray(r) && r.length === 2 && Number.isInteger(r[0]) && Number.isInteger(r[1]) && r[0] >= 0 && r[1] >= 0) {
        parts.push(`@${r[0]}-${r[1]}`);
        skip.push("range");
    }
    parts.push(...pairs(node, skip));
    out.push("+ " + parts.join(" "));
}

/** The pair as lines. */
export function printLines({ elements = [], nodes = [] } = {}) {
    const out = [];
    for (const el of elements) printElement(el, 0, out);
    for (const n of nodes) printNode(n, out);
    return out.join("\n") + (out.length ? "\n" : "");
}

// ── parsing ──────────────────────────────────────────────────────────

/** Length of a JSON string literal starting at i (s[i] === '"'), or -1. */
function stringEnd(s, i) {
    for (let j = i + 1; j < s.length; j++) {
        if (s[j] === "\\") { j++; continue; }
        if (s[j] === '"') return j + 1;
    }
    return -1;
}

/** End index of a balanced [..], {..} or (..) starting at i. */
function balancedEnd(s, i) {
    const open = s[i];
    const close = { "[": "]", "{": "}", "(": ")" }[open];
    let depth = 0;
    for (let j = i; j < s.length; j++) {
        const c = s[j];
        if (c === '"') { const e = stringEnd(s, j); if (e < 0) return -1; j = e - 1; continue; }
        if (c === "[" || c === "{" || c === "(") depth++;
        else if (c === "]" || c === "}" || c === ")") { depth--; if (depth === 0) return c === close ? j + 1 : -1; }
    }
    return -1;
}

/** Split a line into raw tokens: strings, bracketed groups and words, keeping key=value together. */
function tokens(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
        if (/\s|,/.test(s[i])) { i++; continue; }
        let j = i;
        while (j < s.length && !/\s|,/.test(s[j])) {
            if (s[j] === '"') { const e = stringEnd(s, j); if (e < 0) throw new Error("unterminated string"); j = e; continue; }
            if (s[j] === "[" || s[j] === "{" || s[j] === "(") {
                const e = balancedEnd(s, j);
                if (e < 0) throw new Error(`unbalanced ${s[j]}`);
                j = e;
                continue;
            }
            j++;
        }
        out.push(s.slice(i, j));
        i = j;
    }
    return out;
}

function parseValue(raw) {
    if (raw === "") throw new Error("empty value");
    if (raw[0] === '"' || raw[0] === "[" || raw[0] === "{") return JSON.parse(raw);
    if (NUM.test(raw)) return Number(raw);
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === "null") return null;
    return raw;
}

/** "k=v" -> [k, v], or null when the token is not a pair. */
function pair(tok) {
    let k, rest;
    if (tok[0] === '"') {
        const e = stringEnd(tok, 0);
        if (e < 0 || tok[e] !== "=") return null;
        k = JSON.parse(tok.slice(0, e));
        rest = tok.slice(e + 1);
    } else {
        const m = /^([A-Za-z_$][\w$-]*)=(.*)$/s.exec(tok);
        if (!m) return null;
        k = m[1];
        rest = m[2];
    }
    return [k, parseValue(rest)];
}

function parseNodeLine(body) {
    if (body[0] === "{") return JSON.parse(body);
    const toks = tokens(body);
    if (!toks.length) throw new Error("empty node");
    const m = /^([A-Za-z][\w-]*)(\(.*\))?$/s.exec(toks[0]);
    if (!m) throw new Error(`not an op: ${toks[0]}`);
    const node = {};
    if (m[2] !== undefined) {
        const op = { name: m[1] };
        for (const t of tokens(m[2].slice(1, -1))) {
            const p = pair(t);
            if (!p) throw new Error(`op parameter is not key=value: ${t}`);
            op[p[0]] = p[1];
        }
        node.op = op;
    } else node.op = m[1];
    const target = [];
    for (const t of toks.slice(1)) {
        const p = pair(t);
        if (p) { node[p[0]] = p[1]; continue; }
        const r = /^@(\d+)-(\d+)$/.exec(t);
        if (r) { node.range = [Number(r[1]), Number(r[2])]; continue; }
        if (t[0] === '"') { target.push(JSON.parse(t)); continue; }
        target.push(t);
    }
    if (target.length) {
        // Keep `target` right after `op`, as written.
        const { op, ...rest } = node;
        return { op, target, ...rest };
    }
    return node;
}

function parseElementLine(body) {
    if (body[0] === "{") return JSON.parse(body);
    const toks = tokens(body);
    if (!OP.test(toks[0] || "")) throw new Error(`not an element type: ${toks[0]}`);
    const el = { type: toks[0] };
    for (const t of toks.slice(1)) {
        const p = pair(t);
        if (p) { el[p[0]] = p[1]; continue; }
        if (t[0] === "#" && ID.test(t.slice(1)) && el.id === undefined) { el.id = t.slice(1); continue; }
        if (t[0] === '"' && el.text === undefined) { el.text = JSON.parse(t); continue; }
        throw new Error(`unexpected ${t}`);
    }
    return el;
}

/**
 * Lines -> { elements, nodes, errors }. A line that cannot be read is
 * reported with its number and skipped; the rest still parses, so a stream
 * cut mid-line loses only that line.
 */
export function parseLines(text) {
    const elements = [];
    const nodes = [];
    const errors = [];
    const stack = []; // [{ depth, el }]
    String(text == null ? "" : text).split("\n").forEach((raw, i) => {
        const line = i + 1;
        if (!raw.trim() || raw.trim().startsWith("//")) return;
        const indent = raw.length - raw.trimStart().length;
        const body = raw.trim();
        try {
            if (body.startsWith("+")) {
                nodes.push(parseNodeLine(body.slice(1).trim()));
                return;
            }
            if (indent % 2) throw new Error("indent by two spaces");
            const depth = indent / 2;
            const el = parseElementLine(body);
            while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
            if (depth === 0) elements.push(el);
            else {
                const parent = stack[stack.length - 1];
                if (!parent || parent.depth !== depth - 1) throw new Error("indented with no parent one level up");
                if (!Array.isArray(parent.el.children)) parent.el.children = [];
                parent.el.children.push(el);
            }
            stack.push({ depth, el });
        } catch (e) {
            errors.push({ line, message: e.message, text: raw });
        }
    });
    return { elements, nodes, errors };
}
