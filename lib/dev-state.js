/*!
 * nodality v1.4.3
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * dev-state.js — what the person is looking at, and what they asked for.
 *
 * `nodality dev` writes two files in the project's `.nodality/` folder (the
 * project root, never the upload folder, so neither is ever deployed):
 *
 *   current.json   the page, viewport and element the person last picked
 *                  in the inspector — a live cursor, overwritten on every
 *                  pick, read by an agent at the start of every turn that
 *                  says "this".
 *   comments.json  notes left on rendered elements, addressed by element
 *                  id. A comment is resolved, never deleted, so what was
 *                  asked and what was done stay side by side.
 *
 * An element id is the address because it is the one handle that survives
 * edits: `target` already names elements by it, and a note pinned to
 * `#hero` still means `#hero` after anything else on the page changes.
 *
 * Node only (fs). Imported by the dev server, `check` and the MCP tools —
 * never by the browser bundle.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { suggest } from "./suggest.js";

export const STATE_DIR = ".nodality";
export const MAX_NOTE = 2000;
export const MAX_TEXT = 120;

export const stateDir = (root = process.cwd()) => path.join(root, STATE_DIR);
const file = (root, name) => path.join(stateDir(root), name);

function readJson(p, fallback) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

// Write to a temp file and rename: a reader never sees half a file, and two
// quick picks cannot interleave into invalid JSON.
function writeJson(p, value) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
    fs.renameSync(tmp, p);
}

// A source pointer as the dev snippet writes it: pages/index.js:60:5.
const SRC_RE = /^[\w./-]{1,300}:\d{1,7}:\d{1,5}$/;
const src = (v) => (typeof v === "string" && SRC_RE.test(v) && !v.includes("..") ? v : null);

/**
 * The line a source pointer names, read from the upload folder (never taken
 * from the browser): { file, line, col, code }, or null when the file or line
 * is not there. `code` is what a comment is anchored to: when lines move, the
 * code is how `check` finds the note's place again.
 */
export function codeAt(uploadDir, pointer) {
    const s = src(pointer);
    if (!s || !uploadDir) return null;
    const [, file, line, col] = /^(.*):(\d+):(\d+)$/.exec(s);
    const base = path.resolve(uploadDir);
    const abs = path.resolve(base, file);
    if (!abs.startsWith(base + path.sep)) return null;
    let text;
    try { text = fs.readFileSync(abs, "utf8"); } catch { return null; }
    const lines = text.split("\n");
    const n = Number(line);
    if (n < 1 || n > lines.length) return null;
    return { file, line: n, col: Number(col), code: lines[n - 1].trim().slice(0, 200) };
}

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : undefined);
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length <= 200).slice(0, 50) : []);
const int = (v) => (Number.isFinite(v) ? Math.round(v) : undefined);

/** A page path as the dev server serves it: relative, forward slashes, no leading slash. */
export function normalizePage(p) {
    if (typeof p !== "string") return "index.html";
    let s = p.split("?")[0].split("#")[0].replace(/\\/g, "/").replace(/^\/+/, "");
    if (s === "" || s.endsWith("/")) s += "index.html";
    return s;
}

// ── current.json ──────────────────────────────────────────────────

/**
 * Keep only the fields an agent reads, each bounded. The body comes from the
 * browser, so nothing in it is trusted to be the shape it claims.
 */
export function sanitizeCurrent(body = {}, { uploadDir } = {}) {
    const vp = body.viewport || {};
    const sel = body.selection;
    return {
        page: normalizePage(body.page),
        viewport: { width: int(vp.width) ?? null, height: int(vp.height) ?? null },
        selection: sel && typeof sel === "object" ? {
            ids: ids(sel.ids),
            source: codeAt(uploadDir, sel.src),
            type: str(sel.type, 40) ?? null,
            tag: str(sel.tag, 20) ?? null,
            text: str(sel.text, MAX_TEXT) ?? "",
            nodesTargeting: Array.isArray(sel.nodesTargeting) ? sel.nodesTargeting.filter(Number.isInteger).slice(0, 100) : [],
            activeRanges: Array.isArray(sel.activeRanges)
                ? sel.activeRanges.filter((r) => r && Number.isInteger(r.node) && Array.isArray(r.range))
                    .slice(0, 50).map((r) => ({ node: r.node, range: r.range.slice(0, 2).map(int) }))
                : [],
        } : null,
        updatedAt: new Date().toISOString(),
    };
}

export const readCurrent = (root) => readJson(file(root, "current.json"), null);

export function writeCurrent(root, body, opts = {}) {
    const value = sanitizeCurrent(body, opts);
    writeJson(file(root, "current.json"), value);
    return value;
}

// ── comments.json ─────────────────────────────────────────────────

export const readComments = (root) => {
    const list = readJson(file(root, "comments.json"), []);
    return Array.isArray(list) ? list : [];
};

/** Add one note. Returns the stored comment, or an error report. */
export function addComment(root, body = {}, { uploadDir } = {}) {
    const note = str(body.note, MAX_NOTE)?.trim();
    const target = ids(body.target);
    const source = codeAt(uploadDir, body.src);
    if (!note) return { ok: false, error: { code: "MISSING_FIELD", path: "note" } };
    // An element is addressed by its id, or — on a page written with the
    // imperative layer, where it has none — by the line that created it.
    if (!target.length && !source) return { ok: false, error: { code: "MISSING_FIELD", path: "target" } };
    const r = body.rect;
    const comment = {
        id: `c-${crypto.randomBytes(4).toString("hex")}`,
        page: normalizePage(body.page),
        target,
        source,
        rect: r && [r.x, r.y, r.w, r.h].every(Number.isFinite)
            ? { x: int(r.x), y: int(r.y), w: int(r.w), h: int(r.h) } : null,
        viewport: body.viewport && Number.isFinite(body.viewport.width)
            ? { width: int(body.viewport.width), height: int(body.viewport.height) ?? null } : null,
        note,
        ts: new Date().toISOString(),
        status: "open",
    };
    const list = readComments(root);
    list.push(comment);
    writeJson(file(root, "comments.json"), list);
    return { ok: true, comment };
}

/** Mark one comment resolved, with what was done. Never deletes. */
export function resolveComment(root, id, summary) {
    const list = readComments(root);
    const c = list.find((x) => x.id === id);
    if (!c) {
        return { ok: false, error: { code: "UNKNOWN_COMMENT", path: "id", got: id,
            suggestions: suggest(String(id), list.map((x) => x.id)) } };
    }
    const s = str(summary, MAX_NOTE)?.trim();
    if (!s) return { ok: false, error: { code: "MISSING_FIELD", path: "summary" } };
    c.status = "resolved";
    c.resolution = s;
    c.resolvedAt = new Date().toISOString();
    writeJson(file(root, "comments.json"), list);
    return { ok: true, comment: c };
}

/**
 * The page path a file is served at: relative to the upload folder, the same
 * key the dev server writes. Comparing by suffix instead would let a note on
 * `index.html` match `en/index.html` too.
 */
export function pageOfFile(filePath, uploadDir) {
    const rel = path.relative(path.resolve(uploadDir), path.resolve(filePath));
    return normalizePage(rel.startsWith("..") ? path.basename(filePath) : rel);
}

/**
 * What `check` reports about the comments on one page, given the element ids
 * that page actually rendered:
 *   STALE_COMMENT_TARGET  (error)   a target id is gone — the note now
 *                                   points at nothing, and applying it would
 *                                   mean guessing. The likeliest new id rides
 *                                   along as the suggestion.
 *   UNRESOLVED_COMMENT    (warning) the note is still open.
 */
export function commentFindings(comments, { page, ids: present = [], uploadDir } = {}) {
    const key = normalizePage(page);
    const have = new Set(present);
    const errors = [];
    const warnings = [];
    for (const c of comments) {
        if (c.status !== "open" || normalizePage(c.page) !== key) continue;
        if (!c.target.length && c.source) {
            const r = sourceFinding(c, uploadDir);
            (r.level === "error" ? errors : warnings).push(r.finding);
            continue;
        }
        const gone = c.target.filter((t) => !have.has(t));
        if (gone.length) {
            errors.push({ code: "STALE_COMMENT_TARGET", path: c.id, got: gone.join(", "),
                detail: `comment ${untrusted("note", c.note)} targets ${gone.map((g) => "#" + g).join(", ")}, which this page no longer renders`,
                suggestions: gone.flatMap((g) => suggest(g, [...have])).slice(0, 3) });
        } else {
            warnings.push({ code: "UNRESOLVED_COMMENT", path: c.id, got: c.target.join(", "),
                detail: `open comment on ${c.target.map((g) => "#" + g).join(", ")}: ${untrusted("note", c.note)}`, suggestions: [] });
        }
    }
    return { errors, warnings };
}

/**
 * A note anchored to code, not an id. Its line is checked against the code
 * it was written at: unchanged → still open; found on another line → moved
 * (a warning naming the new line, so the agent edits the right place);
 * found nowhere → stale, because applying it would mean guessing.
 */
function sourceFinding(c, uploadDir) {
    const { file, line, code } = c.source;
    const now = codeAt(uploadDir, `${file}:${line}:1`);
    if (now && now.code === code) {
        return { level: "warning", finding: { code: "UNRESOLVED_COMMENT", path: c.id, got: `${file}:${line}`,
            detail: `open comment on ${file}:${line} (${code}): ${untrusted("note", c.note)}`, suggestions: [] } };
    }
    let lines = [];
    try { lines = fs.readFileSync(path.resolve(uploadDir || ".", file), "utf8").split("\n"); } catch {}
    const at = lines.findIndex((l) => l.trim().slice(0, 200) === code);
    if (at >= 0) {
        return { level: "warning", finding: { code: "COMMENT_SOURCE_MOVED", path: c.id, got: `${file}:${line}`,
            detail: `the code this comment was written on moved: ${untrusted("note", c.note)}`, suggestions: [`${file}:${at + 1}`] } };
    }
    return { level: "error", finding: { code: "STALE_COMMENT_SOURCE", path: c.id, got: `${file}:${line}`,
        detail: `comment ${untrusted("note", c.note)} was written on code that is no longer in ${file}: ${code}`, suggestions: [] } };
}

// ── handing it to an agent ────────────────────────────────────────

/**
 * Text a person typed or a page contains, wrapped so it reads as data. `<`
 * is escaped so the text cannot close its own tag and continue as if it
 * were part of the surrounding instructions.
 */
export function untrusted(tag, text) {
    return `<${tag}>${String(text ?? "").replace(/</g, "&lt;")}</${tag}>`;
}
