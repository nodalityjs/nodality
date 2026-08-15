/*!
 * nodality v1.1.12
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * codegen.js — options object -> JavaScript source, for toCode().
 *
 * Every toCode() in the library used to hand-roll the same two steps:
 *
 *     JSON.stringify(obj, null, 4).replace(/"([^"]+)":/g, '$1:')
 *
 * The replace unquotes EVERY key. That is correct for `radius` and wrong
 * for any key that is not a bare identifier — and the library emits those
 * now: `vars: { --nod-split: 0.9 }` from the morph expansion, and content
 * slots like `"main.hero.title"`. Neither parses as JavaScript, so the
 * emitted code could not be run, pasted, or ejected. Fourteen copies of
 * the bad spelling had drifted across twelve files, while the correct one
 * (`/"(\w+)"\s*:/g`) already sat in image.js, table.js, button.js and
 * side-nav-bar.js — the same rule, written both ways, in one codebase.
 *
 * This module is the one place that rule lives now. It is pure: no DOM, no
 * imports, safe to load anywhere (see __tests__/unit/import-inert).
 *
 *   toObjectSource(obj, 4)   // an object -> "{\n    radius: \"2px\"\n}"
 *   unquoteKeys(jsonString)  // already have the JSON? just fix the keys
 *   IDENT_KEY                // the pattern, for call sites that chain
 *                            // further replaces onto the same string
 */

// A quoted JSON key whose bare form is a valid JS identifier. Anything
// else — "--nod-split", "main.hero.title", "kebab-case", "0" — is left
// quoted, because unquoting it would produce a syntax error.
//
// Not global-flagged at the source: a /g regex carries mutable lastIndex,
// and a module-level constant shared by a dozen callers must not. Each
// consumer gets a fresh copy via keyPattern().
const IDENT_KEY_SOURCE = '"([A-Za-z_$][A-Za-z0-9_$]*)"\\s*:';

/** A fresh global regex matching unquotable keys. */
function keyPattern() {
	return new RegExp(IDENT_KEY_SOURCE, "g");
}

/** Unquote the identifier-shaped keys of an already-stringified object. */
function unquoteKeys(jsonString) {
	if (typeof jsonString !== "string") return jsonString;
	return jsonString.replace(keyPattern(), "$1:");
}

/**
 * Serialize an options object as JavaScript source.
 *
 * `indent` matches JSON.stringify's third argument; call sites historically
 * used 2 or 4 and both are kept so emitted code keeps its existing shape.
 */
function toObjectSource(value, indent = 4) {
	return unquoteKeys(JSON.stringify(value, null, indent));
}

export { toObjectSource, unquoteKeys, keyPattern };
