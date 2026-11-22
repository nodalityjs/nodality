# Five new element types

`model`, `disclosure`, `tabs`, `scroller`, `marquee`. Each takes the CSS-named
style options every element takes (`width`, `height`, `position`, `inset`,
`background`, `pad`, `mar`, `resprop`, …), carries an `id`, accepts the design
nodes a `wrap` accepts, and releases everything it attached on `destroy()`.

| type | content slot | required |
|---|---|---|
| `model` | — | `url` (or `src`); `alt` is warned about when missing |
| `disclosure` | `children` | — |
| `tabs` | `items`: `{ label, children }` or a string | `items` |
| `scroller` | `children` | — |
| `marquee` | `children` | — |

## `model` — a 3D model (glTF / GLB)

Renders Google's `<model-viewer>`. Nodality stays zero-dependency, so the page
serves the script: give `loader` (loaded once per page as a module script, only
if `<model-viewer>` is not defined yet), or include the script yourself.

| option | |
|---|---|
| `url` / `src` | the `.glb` / `.gltf` file (required) |
| `alt` | what it shows — the accessible name (always give one) |
| `loader` | URL of `model-viewer.min.js` |
| `decoderLocation` | URL of the meshopt decoder, for `gltfpack -c` models; set before the model loads |
| `poster`, `posterColor` | image until loaded; colour behind it (default `transparent`) |
| `exposure`, `environment`, `shadow` | `exposure`, `environment-image`, `shadow-intensity` (`true` = 1) |
| `loading` | `"auto"` \| `"lazy"` \| `"eager"` |
| `interpolationDecay` | how fast the camera catches up (model-viewer default 50) |
| `interactive` | `true`: orbit/zoom, keyboard arrows. Default `false`: no controls, no prompt, `pointer-events: none` |
| `camera` | static camera `{ theta, phi, radius, fov, target: [x, y, z], shift }` |
| `cameraScrub` | scroll-driven camera, below |
| `attributes` | any other `<model-viewer>` attribute, verbatim, applied last |

**Camera units.** `theta` (azimuth) and `phi` (polar) in degrees, `radius` in
metres, `fov` in degrees, `target` in model metres, `shift` a horizontal
screen-space offset in model units — positive moves the model **right** on
screen (the target moves by `-shift × (cos θ, 0, −sin θ)`; needs a numeric
`target`).

**`cameraScrub`** is `{ keyframes, easing, media?, trigger? }`, or an array of
those (the first whose `media` matches wins, re-checked on resize).

- Progress runs from **0** when the trigger's top reaches the bottom of the
  viewport to **1** when the trigger is fully in view (or its top reaches the
  top of the viewport, if it is taller). The trigger is the model itself, or
  `trigger: "parent"`, or a selector.
- Keyframes are spread evenly (or placed with `at: 0…1`); a keyframe only
  needs the components that change — the rest carry forward. Every component
  interpolates numerically.
- `easing`: `"linear"`, `"smooth"` (smoothstep), `"easeIn"`, `"easeOut"`,
  `"easeInOut"`, or per component `{ default, theta, phi, radius, fov, target, shift }`.
- `prefers-reduced-motion`: the **last** keyframe, and no scroll listener.
- `fov` limits are widened automatically: model-viewer clamps the field of
  view to 25°–45° unless told otherwise.
- The component exposes `onScrubProgress(fn)` and `_scrubProgress` (0–1), the
  same shape as the `scrub` behaviour.

### Example: the bike

The bike section of petr-new-web, previously a hand-written shell script, as
data. The bike starts turned and mostly past the right edge, turns side-on
(linearly) while the camera zooms (on a smoothstep) onto the front wheel; on
phones it ends wider and does not shift.

```js
const START = { theta: -55, phi: 74, radius: 40, fov: 22, target: [0, 3.15, 0.22] };
const END   = { theta: -90, phi: 82, target: [0, 2.07, -2.85] };
const EASE  = { default: "smooth", theta: "linear" };

{ type: "wrap", kind: "section", id: "bike",
  position: "relative", overflow: "hidden", background: "#FFFFFF",
  children: [
    { type: "model", id: "bike-model",
      url: "models/bike.glb",
      alt: "Karbonové silniční kolo s aero nástavci, pomalu se otáčí",
      loader: "vendor/model-viewer.min.js",
      decoderLocation: "vendor/meshopt_decoder.js",
      exposure: 1.05, environment: "neutral", shadow: 0,
      loading: "lazy", interpolationDecay: 80,
      position: "absolute", inset: "0", width: "auto", height: "auto",
      resprop: [{ breakpoint: "767px", top: "38%" }],
      cameraScrub: [
        { media: "(min-width: 768px)", trigger: "parent", easing: EASE,
          keyframes: [{ ...START, shift: 9 }, { ...END, fov: 8, shift: 2.3 }] },
        { trigger: "parent", easing: EASE,
          keyframes: [START, { ...END, fov: 10.5 }] },
      ] },
    // … the section's text, above the model (position: relative; zIndex: 1)
  ] }
```

`__tests__/unit/new-elements.test.mjs` checks this configuration against the
original script at several progress values, at both widths.

**Limits.** `decoderLocation` is applied when the page builds. A prerendered
page already contains the `<model-viewer>` and the loader script, which can
start the model before the rebuild sets it — on a prerendered page, also set
`self.ModelViewerElement = { meshoptDecoderLocation }` in the shell before the
loader. `interactive: true` together with `cameraScrub` lets scrolling
overwrite the visitor's camera.

## `disclosure` — native `<details>`/`<summary>`

```js
{ type: "disclosure", summary: "Shipping", open: false,
  summaryStyle: { fontWeight: 600, padding: "0.5em 0" },
  children: [{ type: "p", text: "Two to four working days." }] }
```

`summary` is a string or an element spec. Closed content stays in the page, so
find-in-page opens it on a match and search engines see it.

## `tabs` — WAI-ARIA tabs

```js
{ type: "tabs", label: "Results by season", selected: 0,
  tabStyle: { color: "#555" }, activeTabStyle: { color: "#c2410c", borderBottomColor: "#c2410c" },
  items: [
    { label: "2025", children: [{ type: "table", items: [ … ] }] },
    { label: "2024", children: [{ type: "table", items: [ … ] }] },
  ] }
```

`tablist` / `tab` / `tabpanel` with `aria-controls` / `aria-labelledby`, one
tab stop (roving `tabindex`), ←/→ (wrapping), Home, End; selection follows
focus. Inactive panels are `hidden="until-found"` — find-in-page reveals the
match and selects its tab (`beforematch`); browsers without it get plain
`hidden`. Tab changes dispatch `nodality:tabchange` (`detail.index`). An
element spec written straight into `items` is reported as `WRONG_ITEM_SHAPE`
with the wrapped `{ label, children }` as the fix.

## `scroller` — horizontal scroller

```js
{ type: "scroller", label: "Race calendar", itemWidth: "min(320px, 85vw)",
  gap: "16px", snap: "start", controls: true, progress: true, jump: true,
  prevLabel: "Předchozí", nextLabel: "Další",
  children: [ /* one card per race */ ] }
```

- The scrolling box is focusable (`tabIndex 0`) and, with `label`, a named
  region. ←/→ page by 90% of its width, Home/End go to the ends.
- `snap`: `"start"` (default), `"center"`, or `false`.
- `controls`: prev/next buttons (named, `aria-disabled` at the ends).
  `progress`: a thin bar (decorative, `aria-hidden`).
- `jump`: a link to `#id` of anything inside scrolls the page to the scroller,
  scrolls the scroller so the target starts at its left edge, focuses the
  target, and records the hash. Also on load and on `hashchange`.
- `flow: { height, columnWidth, gap }` pours the children into fixed-height
  CSS columns that run on sideways — the layout for a long list:

```js
{ type: "scroller", label: "Results 1994–2025", jump: true,
  flow: { height: "70vh", columnWidth: "280px", gap: "2rem" },
  children: [
    { type: "h3", id: "y2025", text: "2025" }, /* results… */
    { type: "h3", id: "y2024", text: "2024", breakBefore: true }, /* … */
  ] }
```

Children never split across columns; `breakBefore: true` on a child starts a
new column. Limits: left-to-right only (`dir="rtl"` pages would page the wrong
way).

## `marquee` — endlessly scrolling row

```js
{ type: "marquee", label: "Sponsors", speed: 40, direction: "left", gap: "3rem",
  children: [{ type: "img", url: "/logos/a.svg", alt: "Alpha" }, /* … */] }
```

- The children are copied as often as the width needs; copies are
  `aria-hidden="true"` and `inert` and carry no ids, so assistive technology
  and the Tab key meet each item once.
- Pauses on hover (`pauseOnHover: false` to keep moving), while focus is
  inside, and while off screen. `pause()` / `play()` from code.
- A pause / play button (WCAG 2.2.2) sits at the row's inline end while it
  moves: a real `<button>`, reached with Tab, toggled with Enter or Space,
  named for what it will do. `controls: false` removes it; `pauseLabel` /
  `playLabel` translate it (default "Pause" / "Play"); `controlsStyle`
  restyles it. It is overlaid, so it appearing once the loop starts moves
  nothing, and it is never copied. No motion (reduced motion, prerender),
  no button.

  ```js
  { type: "marquee", label: "Partneři", pauseLabel: "Pozastavit", playLabel: "Přehrát",
    controlsStyle: { background: "#111", color: "#fff" }, children: [ … ] }
  ```
- `prefers-reduced-motion`: a static row that wraps, no copies.
- Headless (prerender) it renders the static row; the loop is built once the
  browser has laid it out, and rebuilt when either width changes.

Limits: clicks on a visible *copy* do nothing (copies are inert by design —
only the originals are interactive). The button overlays the last few
pixels of the row; give the row `pad` at its end if items must never pass
under it.
