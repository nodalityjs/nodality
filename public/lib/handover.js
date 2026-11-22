// Handover — the moment the live page takes over from the prerendered copy.
//
// The static copy is on screen before the bundle arrives. When Des swaps in
// the live tree, every entrance (reveal, count, the image mask) would hide
// what the visitor is already looking at and play it in again: content,
// gone, content. During the handover an element that is on screen or
// already scrolled past is therefore left as it is — it was seen; only
// content further down keeps its entrance.
//
// Des raises the flag in the task that swaps the trees (lib/designer.js) and
// lowers it in the next task, after the microtasks in which the entrances
// decide (they run after the page's add().set() chain, with the live tree
// mounted and measurable).

const KEY = "__NODALITY_HANDOVER__";
const win = () => (typeof window !== "undefined" ? window : null);

/** Called by Des when it replaces a prerendered mount. */
export function beginHandover() {
	const w = win();
	if (!w) return;
	w[KEY] = true;
	setTimeout(() => { w[KEY] = false; }, 0);
}

/** Is the live tree taking over from a prerendered copy right now? */
export function handingOver() {
	const w = win();
	return !!(w && w[KEY]);
}

/**
 * True when the handover is under way and `el` is on screen or above it —
 * content the visitor has already seen in the static copy.
 */
export function seenAtHandover(el) {
	const w = win();
	if (!handingOver() || !el || !el.isConnected || typeof el.getBoundingClientRect !== "function") return false;
	const r = el.getBoundingClientRect();
	if (!r.width && !r.height) return false;
	return r.top < (w.innerHeight || 0);
}
