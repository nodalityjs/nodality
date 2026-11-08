# Verifying your work

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

## Verifying your work

- **`check_page` works without the MCP too:** `npx nodality check
  upload/*.html --base=http://localhost:4000/` (or `import { checkPage }
  from "nodality/check"`). Pass `--base` for a prerendered site, or its fonts
  and `/assets/` do not load and text is measured in a fallback face. It exits
  1 on findings, and on a shop page reports `LOADING_LAYOUT_SHIFT` when the
  product's loading copy sits somewhere other than the loaded element.
- **Read `FAINT_TEXT` from `check_page`.** It reports small text that passes
  WCAG and still reads faint (APCA), the usual case on mid-tone backgrounds.
  Fix with weight, a lighter or darker ground, or size; not by ignoring it.
- **Verify a morph by progress, not by DOM presence.** The destination
  view is inserted before capture begins, so "the element exists" passes
  even when the transition hangs. Assert that the animation *progressed*
  (or landed state + painted output), and unwind with `back`/`go_back`
  to check the reverse path.
- **Add a negative control.** When you write a check, break the thing
  once and confirm the check fails; a check that cannot fail is not a
  check.
- **Prerender caveat:** the jsdom build silently drops CSS `min()` /
  `clamp()`. If the design depends on them, verify in a real browser,
  not in the preview file.
