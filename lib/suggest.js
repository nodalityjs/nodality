/*!
 * nodality v1.0.222
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

/*!
 * suggest.js — "did you mean …?" over a closed vocabulary.
 *
 * The library's most expensive historical bug class is the silently
 * ignored key: a typo'd option or element type that does nothing, reports
 * nothing, and is found minutes later by eye. Everywhere a vocabulary is
 * closed — morph's tokens/kinds/axes, ElementMapper's element types — the
 * rule is the same: throw, and name the nearest valid word.
 *
 * Extracted from layout/morph.js (phase M1) so the mapper can use the same
 * matching, and so the ~15-line DP exists once. No dependency: writing it
 * is cheaper than owning one, which is the same call the allocator made.
 *
 * Pure — no DOM, safe to import anywhere.
 */

/**
 * Levenshtein edit distance, iterative two-row DP.
 */
function levenshtein(a, b) {
	if (a === b) return 0;
	let prev = new Array(b.length + 1);
	for (let j = 0; j <= b.length; j++) prev[j] = j;
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
		}
		prev = row;
	}
	return prev[b.length];
}

/**
 * Candidates within `max` edits of `word`.
 *
 * Returned in the candidate list's own (declaration) order, so ties never
 * depend on an unordered walk — the same determinism rule the rest of the
 * expansion follows.
 */
function suggest(word, candidates, max = 2) {
	const w = String(word);
	return candidates.filter((c) => levenshtein(w, c) <= max);
}

/**
 * The prose half: "Unknown x "y". Did you mean "z"? Valid …".
 * Callers that need a machine-readable report build it themselves; this is
 * for the throw sites where a human is the only consumer.
 */
function didYouMean(word, candidates, label = "value") {
	const near = suggest(word, candidates);
	let msg = `Unknown ${label} "${word}".`;
	if (near.length) msg += ` Did you mean "${near[0]}"?`;
	if (candidates.length) msg += ` Valid ${label}s: ${candidates.join(", ")}.`;
	return msg;
}

export { levenshtein, suggest, didYouMean };
