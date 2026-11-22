# Motion and interaction: options on the element

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

These go on the element in E, beside its own options, on **every** type.
None needs a node, a stylesheet or DOM code, and each is the answer to a
request that used to end in `keySet` or a `<script>`. `get_schema` lists
them; `validate_nodes` checks them.

## Motion

| option | does | e.g. |
|---|---|---|
| `reveal` | comes in once, when scrolled into view | `reveal: { by: "word" }`, `reveal: true` |
| `scrub` | scroll position drives keyframes, 0→1 between two points | `scrub: { keyframes: [{opacity: 1}, {opacity: 0}], from: "top", to: "exit" }` |
| `pin` | sticks to the top for this much extra scroll | `pin: "150vh"` |
| `count` | the text's first number counts up when in view | `count: { duration: 1500 }` |
| `fit` | font scaled so the text fills the width on one line | `fit: true` |
| `loop` | keyframes forever (Web Animations) | `loop: { keyframes: [{…}, {…}], duration: 4000 }` |

- `reveal`: `y` (24), `x`, `opacity` (0), `scale`, `duration` (700),
  `delay`, `easing`, `stagger` (ms between **children**), `by: "word" |
  "line"` (text stays one text node for screen readers), `once` (true),
  `threshold` (0.15).
- `scrub` points: `enter` (default from), `full`, `top`, `exit` (default
  to), `page`, `pin`. `easing` shapes progress. Pass an **array** of
  variants with `media` for per-width scrubs, the fallback (no `media`)
  last. Descendants can read `--progress` in `calc()`.
- `pin` + `scrub from: "pin", to: "pin"` is the "sticky stage" pattern:
  make the pinned element the **last** child of its wrap.
- `count`: `from` (0), `to` (overrides the text, e.g. for `"1.2M"`),
  `decimals`, `locale`. The text ends exactly as written.
- `fit` needs a width to fill: a shrink-to-content flex item needs
  `width: "100%"`. Overrides `exact`/`size`.

Safe by default: a start state (hidden, 0) is applied only where the
motion that undoes it will certainly run. Prerendered HTML and
`prefers-reduced-motion` show the final state (`pin` still pins: holding
still is not motion). Everything is released by `destroy()`.

For the same scroll-in reveal as a **node** (several elements, or
keyframes you already have), the `animation` design op takes
`fireAt: "inview"` (once, when first visible) or `fireAt: "400px"`
(once `scrollY` passes 400), with `keyframesClose` (its last frame is the
start state, applied at once), `keyframesOpen` and `openOptions` —
give `openOptions` `fill: "forwards"` or it snaps back. All registered:
`list_ops` → `designOps.animation`.

## Interaction and accessibility

| option | does |
|---|---|
| `hover` | CSS while hovered **and** while it, or a link inside it, has keyboard focus; `animation: "0.2s ease"` is the timing |
| `focus` | keyboard state, when it should differ from `hover` |
| `group: true` / `groupHover` | a descendant changes while its nearest group is hovered or focused |
| `aria`, `role`, `tabIndex`, `lang`, `title` | `aria: { label, describedBy }` → `aria-*`; arrays of ids space-joined; `null` removes |
| `as` (wrap) / `tag` (text) | semantic tag: `as: "article"`, `tag: "blockquote"` |
| `copy`, `copied` | click / Enter / Space copies; announces `copied` |
| `spy` | on a container: its `#…` links get `aria-current` and `activeStyle` while their section is in view; `offset` = fixed-header px |
| `hideOnScroll` | a fixed or sticky element slides away scrolling down, back scrolling up |

`nav` also takes `spy`, `actions` (element specs after the links, inside
the menu on a phone), `hideOnScroll` and `aria`. `ulist` items are real
`<li>`; `ordered: true` makes an `<ol>`.

## Known limits

Surfaced on purpose. Work around them; do not patch the DOM.

- `scrub` follows the **window's** scroll only, not a scrolling
  container's.
- `pin` sticks **within its parent** (it is `position: sticky`): siblings
  after it scroll underneath, an ancestor with `overflow` stops it, a
  stretching flex row leaves it no room.
- `reveal` moves with `translate`/`scale`, so inline elements (an `a`
  inside a line) only fade.
- `spy` lights the topmost section in the upper half of the viewport, so
  a **short last section** that never reaches that half may never
  activate.
- `count` reads `"1.200"` as 1200; give `to` when it means otherwise.
- `hideOnScroll` does nothing unless the bar (or its wrapper) is fixed or
  sticky.
- Container `resprop` (`{ container: { min, max } }`) that changes the
  parent's own width can **oscillate**.
- The new element types have their own limits:
  `content-and-composites.md`.
