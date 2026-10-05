/*!
 * nodality v1.3.22
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

// known-inert.js — parameters the schema advertises for a type and the type
// ignores.
//
// One list, read by two things: the conformance test (which fails if a new
// inert parameter appears, or if one listed here starts working) and
// validate_nodes (which warns a page author who uses one, as PARAM_INERT).
// It used to live only in the test, so the suite knew a parameter did nothing
// while the validator told the author the page was fine.
//
// A baseline, not an allowlist: each entry is a known defect.

export const KNOWN_INERT = new Set([
	// The mapper builds its own options and never consults the element, so
	// the component's vocabulary is unreachable however faithfully it reads.
	// Fixing one means changing how every existing page of that type renders,
	// so each is recorded here rather than quietly patched.
	// Text elements: the element TYPE picks the fluid step, because in Text
	// the step also picks the tag — honouring `size` here turned an h2 into an
	// h3 and changed the document outline. `tag` is the settable option.
	"h1.size", "h2.size", "h3.size", "h4.size", "h5.size", "h6.size", "p.size",
	// a
	"a.transform",
	// checkbox
	// `exact` (1.3.21): Text now reads it, so the scan credits it to every type
	// built with a Text; checkbox uses Text only for its label and sends the
	// element's options to Checkbox, which does not size its text.
	"checkbox.exact",
	"checkbox.area",
	"checkbox.background",
	"checkbox.color",
	"checkbox.cursor",
	"checkbox.height",
	"checkbox.keySet",
	"checkbox.mar",
	"checkbox.maxWidth",
	"checkbox.pad",
	"checkbox.transform",
	"checkbox.width",
	// circle
	"circle.transform",
	// code
	"code.transform",
	// filePicker
	"filePicker.radius",
	// labelInput
	"labelInput.color",
	"labelInput.exact",
	// nav
	"nav.size",
	"nav.transform",
	// polygon
	"polygon.transform",
	// radio
	"radio.color",
	"radio.exact",
	// sideNav
	// `exact` (1.3.21): as on checkbox — sideNav renders Text for its labels
	// and builds its root, SideNav, without the element's options.
	"sideNav.exact",
	"sideNav.area",
	"sideNav.background",
	"sideNav.color",
	"sideNav.cursor",
	"sideNav.height",
	"sideNav.keySet",
	"sideNav.mar",
	"sideNav.maxHeight",
	"sideNav.maxWidth",
	"sideNav.opacity",
	"sideNav.pad",
	"sideNav.radius",
	"sideNav.size",
	"sideNav.transform",
	"sideNav.width",
	"sideNav.zIndex",
	// table
	"table.transform",
]);
