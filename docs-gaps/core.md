# Core gaps closed

Five changes to the core. Pages that use none of them render the same on first
render; the only change on resize is the stuck-value fix described in section 3.

## 1. Design-op parameters are listed and checked

`list_ops` (`describeOps()`) now returns `designOps`: every design op, with each
parameter's `unit`, a summary and, where the key is read but changes nothing,
`inert` with the reason. It also returns `designFields` (the top-level keys of a
design node) and `transformStyles`. The table lives in `lib/design-ops.js`. A
test scans the code that reads each `op.<key>` and fails if a key is read but
not registered, or registered but never read.

`validate_nodes` now checks the keys inside `op`. Each finding is a warning, so
the page still renders:

| code | when |
|---|---|
| `UNKNOWN_OP_PARAM` | no code reads this key for this op. Suggestions come from this op's parameters first, then from other design ops' parameters. |
| `BAD_PARAM_VALUE` | the reading code cannot use the value: `fireAt: "onview"`, `movements: [3, 3]`, `colors: "#000"`, a link-style token that does not exist. |
| `PARAM_INERT` | the key is read but changes nothing. Examples: keys inside a transform node's `op` (see below), `color` on a gradient shorthand, `style` on a non-transform node. |

```js
{ op: { name: "shadow", colours: ["#000"] }, target: ["card"] }
// warning UNKNOWN_OP_PARAM nodes[0].op.colours, suggestions ["colors"]
```

**Animation on scroll-in.** This already worked but was not documented.
`fireAt: "inview"` puts the element in the last frame of `keyframesClose` at
once. The first time the element intersects the viewport, `keyframesOpen` plays
with `openOptions` (once only). `fireAt: "400px"` does the same when
`window.scrollY` passes 400. Without `fireAt`, the keyframes play on the
`sidebar:open` / `sidebar:closed` window events.

```js
{ op: { name: "animation", fireAt: "inview",
    keyframesClose: [{ opacity: 1 }, { opacity: 0, transform: "translateY(24px)" }],
    keyframesOpen:  [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
    openOptions: { duration: 500, easing: "ease-out", fill: "forwards" } },
  target: ["hero"] }
```

Without `fill: "forwards"`, the element snaps back to the close state when the
animation ends.

**Transform nodes.** Des replaces a transform node's `op` with the preset named
by the node's top-level `style` (and its `duration`). Whatever was written
inside `op` (`values`, `on`, `keep`, …) is dropped. The validator therefore
reports those keys as `PARAM_INERT`, and reports an unknown `style` as
`BAD_PARAM_VALUE` with the nearest preset.

```js
{ op: { name: "transform" }, target: ["badge"], style: "JELLY-WOBBLE", duration: "fast" }
```

## 2. More CSS-named options

Every element that runs `commonMethods` now accepts these options (they are
also listed in `get_schema`):

- `flexDirection`
- scroll snapping: `scrollSnapType`, `scrollSnapAlign`, `scrollSnapStop`
- scroll margin: `scrollMargin`, `scrollMarginTop` / `Right` / `Bottom` / `Left`
- scroll padding: `scrollPadding`, `scrollPaddingTop` / `Right` / `Bottom` / `Left`
- scrolling behaviour: `overscrollBehavior`, `overscrollBehaviorX` / `Y`, `scrollBehavior`
- multi-column: `columns`, `columnWidth`, `columnCount`, `columnFill`, `columnRule`
- breaks: `breakInside`, `breakBefore`, `breakAfter`
- typography: `textWrap`, `fontVariantNumeric`, `textUnderlineOffset`, `textDecorationThickness`
- compositing: `mixBlendMode`, `isolation`, `clipPath`, `cssFilter`
- outlines: `outline`, `outlineOffset`

```js
{ type: "wrap", id: "rail", display: "flex", overflowX: "auto",
  scrollSnapType: "x mandatory", children: [ { type: "img", url: "a.jpg", scrollSnapAlign: "start" } ] }
```

Some names already had a meaning on certain types. Each was checked against
the schema:

- **`cssFilter`, not `filter`.** On a `wrap`, `filter: true` already means
  frosted glass (`backdrop-filter: blur(3px)`), and `filter` is also the name of
  a design op. So the CSS `filter` property is the `cssFilter` option.
- **`clipPath`.** An `img` reads `clipPath` as SVG path data, and keeps doing
  so. A value that is valid CSS (`circle(50%)`, `inset(…)`, `polygon(…)`, …) is
  now applied as written. On a `checkbox`, `clipPath` is still the checkmark's
  shape (that type does not run `commonMethods`).
- **`columns`.** On `gridOverlay`, `columns` is still its own cell count (that
  type does not run `commonMethods`).
- **`flexDirection`.** On a `wrap` this is `flexDir` under its CSS name, so it
  also sets `display: flex`, unless the element sets `display` or `disp`.

## 3. Responsive values by pixel range and by container width

`resprop` entries can now be placed in two more ways, besides a named
`breakpoint`:

- `{ min, max, …css }`: a viewport range in px, inclusive at both ends. Either
  bound may be left out.
- `{ container: { min, max }, …css }`: the content-box width of the element's
  parent, measured with `ResizeObserver`.

`respad` and `resmar` take the same forms, with the value in `values`.

```js
{ type: "wrap", id: "bar", children: [],
  resprop: [{ min: 900, position: "sticky", top: "0px" }] }   // below 900: the element's own position
{ type: "p", id: "cap", text: "…",
  resprop: [{ container: { max: 479 }, fontSize: "14px" }, { container: { min: 480 }, fontSize: "18px" }] }
```

**Where no entry applies.** The element gets back its base option, or else its
own value, so `position` and every other property can be reset. Named
breakpoints mean exactly what they did before: a bare `"800px"` is a maximum
width in `resprop` and a minimum width in `respad` / `resmar`, while `min` /
`max` read the same in all three.

**Container entries.**

- They override viewport entries for the keys they name.
- Where nothing can be measured (no `ResizeObserver`, as in jsdom and the
  prerenderer), they do not apply.
- Limit: a container entry that changes the parent's own width can oscillate.

**Two stuck-value bugs fixed along the way.**

- Wrapper, Image and Code registered the same `resprop` twice. The second
  registration took the first one's value as the element's own, so a value
  that applied at the first width stuck at every width.
- `respad` / `resmar` without a base `pad` / `mar` kept the last breakpoint's
  value after the window left its range. They now hand the sides back.

**Validator.** `validate_nodes` reports an entry that matches no width as
`BAD_PARAM_VALUE`. That covers an entry that is not placed at all, has
`min: "900px"` instead of a number, has `min` greater than `max`, or has
`container: 600` instead of an object.

## 4. `onScroll` and reduced motion

Under `prefers-reduced-motion: reduce`, `onScroll` writes nothing and attaches
no scroll listener. The element keeps its own style.

This is deliberate: it does not apply the end state. Either end of a scroll
effect can hide or displace content (a fade-out ends at opacity 0, a fade-in
starts there), and the element's own style is the one state that is always
readable.

## 5. Page defaults

```js
new Des()
  .defaults({ font: "Inter, system-ui, sans-serif", color: "#111" })   // before .add()
  .nodes(N).add(E).set({ mount: "#mount" });
```

How defaults are applied:

- A default fills a key that an element leaves `undefined`. An explicit value
  always wins, even `null`.
- Defaults reach `children` and spec-shaped `items` (element entries, and the
  arrays inside `cards`). Data items such as nav's `{ title, link }` are left
  alone.
- A default is applied only to types whose schema lists the key and that are
  not known to ignore it. So a page-wide `color` puts no `PARAM_NOT_ON_TYPE` or
  `PARAM_INERT` warnings on a checkbox.

**Order matters.** `.defaults()` throws if it is called after `.add()`, because
`add()` has already built the page. `set({ defaults })` does nothing and logs a
warning saying so.

**Validation.** Call `validateNodes(N, E, defs, { defaults })`, or pass
`defaults` to the MCP `validate_nodes` / `preview` tools. The elements are then
checked as they will render. The defaults object is checked too: an unknown key
gets `UNKNOWN_ELEMENT_PARAM` at `defaults.<key>`, with a suggestion.
