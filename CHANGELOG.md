# Changelog

Generated per release from the source diff.

## 1.2.7 — 2026-08-20

### Fixed

- `gradient` operation no longer renders the target element invisible when a design node names the `gradient` op but supplies no gradient string (no `op.gradient` and no `op.direction`). The gradient effect is now skipped entirely rather than applying a transparent text-fill with nothing behind it.
- `validateNodes` now checks design nodes instead of skipping them outright. It reports:
  - `UNKNOWN_DESIGN_OP` for an object-form design op whose `name` isn't recognized.
  - `UNKNOWN_PARAM` for top-level keys a design node doesn't read, with a hint pointing inside `op.*` when the key is likely misplaced there instead of a typo.
  - `MISSING_FIELD` for an object-form `gradient` op that has neither `op.gradient` nor `op.direction`.
- Bare-string design ops (e.g. `"gradient"`, `"blast"`, `"shadow"`) are now recognized as the `"design"` family instead of being misclassified as `"raster"` and flagged as unknown.

### Changed

- Internal: added `BARE_DESIGN_OPS`, `DESIGN_OP_NAMES`, `DESIGN_FIELDS`, and `BARE_DESIGN_FIELDS` tables in `lib/validate-nodes.js` to drive the new design-node validation. No public API surface.

## 1.2.3 — 2026-08-18

### Added

- `list_ops` returns `presets` and `elementTypes`. The transition effects a morph's `effect` may name were never published, so an agent had to guess them from an example in the tool description; the element vocabulary of `E` was likewise undiscoverable. Both halves of the pair can now be learned from one call.
- `validateNodes` checks the `E` array when it is given one. An element whose `type` names nothing is not a silent no-op but a THROW from the mapper at render time, which reaches a generator as a stack trace rather than as a report it can repair from. Reported as `UNKNOWN_ELEMENT_TYPE`, with children walked.
- `{ op: "agent-surface" }` is described in the MCP tool schema. It shipped in 1.2.0 but was invisible to a generator — the same gap that hid `chain` until 1.1.15.

### Fixed

- A morph `effect` naming no preset now reports `UNKNOWN_EFFECT` with a suggestion. `chainFor` swallows the failed lookup and returns an empty chain, so `effect: "t-vhss"` validated clean, rendered, and did nothing: the exact silent omission the validator exists to remove, sitting in its own blind spot.
- A node with both a misspelled op and a misspelled parameter now reports both in one call. Parameter checking used to stop dead at an unknown op, so the op error hid the parameter error until it was fixed and the repair took two round-trips. Where the op is a near miss its parameters are checked against the op that was MEANT and reported with an `assuming` field naming that assumption; where there is no near miss, only the op is reported and nothing is invented.

## 1.2.2 — 2026-08-18

### Fixed

- Placing a morph destination no longer imposes `box-sizing: border-box` on it. That is not positioning — it relaid the author's element out: a card written as `width: min(560px, 92vw)` with padding renders 612px wide in normal flow and 560px once the morph owned it, so the two ends of a transition were different sizes and the handover from the shader to real DOM snapped by the padding. Measured on the chain demo by differencing consecutive frames: the handover frame carried a mean delta of 17.61 against ~1–3 for the animation around it, and 1.46 after the fix, with the frames following it at 0.00.

## 1.2.1 — 2026-08-18

### Fixed

- `read_view` on a derived agent surface returned empty content on precisely the pages that use the live capture backend. Content hosted inside the canvas is deliberately `visibility: hidden` because the canvas is what paints it, so a readback that asked which elements were visible found none while navigation worked perfectly. The current view is now known from the controller rather than inferred from paint.

## 1.2.0 — 2026-08-18

### Added

- `{ op: "agent-surface" }` — one node exposes the page to an AI agent as callable tools: traversing the morph graph, submitting a form named in `forms`, and reading what is on screen. The tools are DERIVED from the pair rather than authored a second time, so they cannot drift from the interface they describe. Opt-in, and no form is exposed unless it is listed, because a derived submit tool is an agent acting.
- Tool registration through the WebMCP browser API where it exists, feature-detecting both `document.modelContext` and the older `navigator.modelContext`. Where the API is absent nothing registers, nothing warns, and the page behaves identically.
- A static declaration either way: prerendering writes the surface into each page as `<script type="application/json" id="nodality-agent-manifest">` and gathers every page's declaration into `agent-manifest.json`. A consumer that executes no JavaScript can read what the site can do — which no script-based registration can offer.
- Validation for the new family (`UNKNOWN_FORM`, `UNKNOWN_STATE`, `EMPTY_SURFACE`), and `preview` now reports the surface a pair would give an operating agent, so a model writing the page sees the tools a model using the page will get.

### Fixed

- `TextField` forwards `name`, `id` and `required` to the input. `name` is not cosmetic: a field without one contributes nothing to `FormData`, so every text input in every Nodality form submitted an empty value — for a person filling it in, not only for an agent.
- `Form` forwards its `id` to the rendered `<form>`, so the element a descriptor named can be found again from outside.

## 1.1.15 — 2026-08-17

### Added

- Element ids may be written bare (`"work"`) or in selector form (`"#work"`) anywhere a morph names one. Both are reduced to one key before anything is resolved, so a chain whose first edge writes `"#home"` and whose second writes `"home"` arrives at ONE state rather than two.

### Fixed

- `validateNodes` learns the `chain` form. It had rejected the multi-edge node the library documents — `UNKNOWN_PARAM` on `chain`, plus `MISSING_FIELD` for the `from`/`to` a chain node correctly does not have — so an agent following the reference was told the reference was wrong. Each edge is now validated at its own path, so a typo reports as `nodes[0].chain[0].duraton → duration`.
- The validator accepted `"#home"` while the runtime resolved only `"home"`, so it passed a node that silently never morphed. The two now agree.
- `from`/`to` written beside a `chain` report `IGNORED_FIELD`. The runtime reads the chain and ignores them, so the page works while the dead pair looks as though it took effect.
- A flag written as a string is caught. `live: "true"` is not `=== true`, so the live backend silently stayed off while the snapshot backend rendered a perfectly good transition.

## 1.1.14 — 2026-08-16

### Fixed

- A live chain hands the DOM back when a reversal lands. The pipeline was left alive after `back` reached its endpoint, so the canvas kept presenting a state the document had already taken over, and the interface went blank part-way through a chain on Chrome 151. Landing now destroys the pipelines the stage owns, which IS the handover.

## 1.1.13 — 2026-08-15

### Fixed

- Reversal geometry and state bookkeeping in a chain: a rebuilt reversal is constructed with the sides swapped so the effect plays backwards rather than playing forwards into an earlier state, and the pipeline is reused only when it is exactly the hop being unwound.

## 1.1.12 — 2026-08-15

### Added

- `chain` on a morph node: one node describes a whole navigation graph. The entries are EDGES, not keyframes — edge two is reachable FROM the state edge one lands on, so a landed state becomes a source in its turn. Settings on the node are defaults each edge may override, and `back` unwinds the path actually traversed rather than looking up an edge. The single-hop form is normalised into a chain of length one, so there is one code path and the older form is not a special case of anything.

## 1.1.11 — 2026-08-15

Documentation only. Identical to 1.1.10 in library code; the release carries a README and changelog update.

## 1.1.10 — 2026-08-15

### Fixed

- `validateNodes`: a misspelled parameter on a `{ op: "morph" }` node is now reported. Unknown keys were checked on raster nodes but not on morph nodes, so `duraton: 900` produced a transition at the default duration and reported nothing — the silent failure the validator exists to remove, in the node most likely to be hand-written.
- MCP server: every tool result is now JSON in the standard report shape. A thrown error — a missing `jsdom` in the consuming project, most commonly — previously returned a prose stack trace where every other result returns an object, which breaks any caller that parses results uniformly. A missing peer dependency now returns `MISSING_PEER_DEPENDENCY` with the install command in `suggestions`.

## 1.1.9 — 2026-08-15

### Added

- `nodality mcp`: a Model Context Protocol server over stdio, exposing the two-array API to agent IDEs. Three tools — `list_ops` (the op registry as data: stages, parameters, units, drivers, easings), `validate_nodes` (a machine-readable report with did-you-mean suggestions), and `preview` (render an `(E, N)` pair to a self-contained HTML file through the prerenderer). Zero dependencies: the JSON-RPC framing is hand-rolled rather than taking the MCP SDK.
- `nodality/validate` → `validateNodes(nodes, elements)` and `describeOps()`. The library validated an op *definition* at registration but never a node *instance*, so an unknown op, an unknown parameter, or a target naming an element that does not exist were all silent no-ops.

### Fixed

- MCP server: all console output is redirected to stderr before serving. In a stdio server stdout carries the protocol, and the component layer prints while rendering — a single log line landed mid-frame and killed the connection with a JSON parse error that named JSON rather than the component that spoke.

## 1.1.8 — 2026-08-15

### Fixed

- Live-backend transitions now hand the source back at `t = 0`. The pipeline stood the canvas down only when it hosted no content, which is right at the end of a morph (the canvas hosts the destination) but wrong at the start (the source is the caller's own element, outside the canvas). A live morph therefore kept the canvas up at both ends: the source layer stayed `display: none`, its links measured 0×0, and what remained on screen was the shader's frozen first frame — a convincing picture of a working interface that ignored every click.

## 1.1.7 — 2026-08-15

### Added

- Pointer retargeting now reaches content hosted inside a canvas. `document.elementFromPoint` cannot see canvas fallback content — it is laid out but never painted, so the browser's hit test walks past it — which left every control inside a live pipeline dead, including a morph's own back button. Hit testing is reconstructed from the layout the engine still computes, deepest match winning.

### Fixed

- Retargeting no longer takes its "nothing moved, defer to the browser" shortcut when the content is canvas-hosted. A settled morph presents 1:1, so the displacement is zero and every event took that early return.

## 1.1.6 — 2026-08-15

No library changes. Identical to 1.1.5 apart from the version banner: an interrupted release had already tagged 1.1.5, and the retry tagged 1.1.6. Both published.

## 1.1.5 — 2026-08-15

### Fixed

- Both foreground capture paths — `morph-node.js` and `raster-ops.js` `toImage()` — now use `document.createElement("img")` instead of `new Image()`. The package exports a component named `Image`, and the documented globals bridge (`Object.assign(globalThis, N)`, which `npm create nodality` scaffolds) replaces the DOM constructor with it page-wide. `new Image()` then returned a component whose `onload` and `src` were inert, so the capture promise never settled and the caller hung with no error and nothing to log. This disabled the snapshot raster backend, not only morphs, on every site using the globals bridge.

## 1.1.4 — 2026-08-14

### Added

- The scaffold CI job launches the generated project in a real browser and asserts that it renders — that the mount refills, the text is correct, and the outline is actually applied. A bundler does not evaluate its output and prerender runs against sources, so a bundle that fails on load passed every prior check.

## 1.1.3 / 1.1.2 — 2026-08-14

Tagged during CI iteration on the scaffold browser check; neither reached npm.

## 1.1.1 — 2026-08-14

### Fixed

- The ESM bundle no longer declares exported bindings that shadow browser globals. It ended with `export const Image=…`, `Text` and `Range`; a consumer's bundler concatenates the module, renames the colliding declaration, and the emitted export clause still names the original, so every scaffolded site died on load with `Export 'Image' is not defined in module`. A post-build pass now routes each export through a private binding, leaving the public names unchanged.

## 1.1.0 — 2026-08-14

### Added

- Per-side effects for transitions: `side: "old" | "new"` scopes a raster op to one half of a morph, so the outgoing and incoming states can be art-directed separately. Colour-stage ops only — both sides share one sampling coordinate, so a sided warp has no meaning.

## 1.0.221 — 2026-08-06

### Changed

- Many previously standalone layout classes (`Base`, `AreaSwitcher`, `GridSwitcher`, `Grid`, `List`, `Cell`, `MetaAdder`, `Modal`, `NavBar`, `Progress`, `Row`, `ScrollVideo`, `SideBar`, `Spacer`, `Stack`, `Switcher`, `Wrap`) now extend `Animator`, inheriting its shared methods. Each sets `this._noTheme = true` so existing rendering behaviour is preserved.
- Common methods `round()`, `toCSS()`, `toHTMLA()`, and `background()` are now defined once on `Animator` and removed from `button.js`, `flex-card.js`, `link.js`, `text.js`, `flex-row.js` — behaviour is unchanged since these duplicated the same implementation.
- `NavBar` and `SideBar` now store their root element on `this.res` instead of `this.ele`.
- `Base` now stores its root element on `this.res` instead of `this.el`.
- `GridSwitcher` (in `grid-switcher.js`) now stores its element on `this.res` instead of `this.el`.

### Removed

- `onTap()` removed from `button.js`, `flex-row.js`, and `text.js` (duplicated the same logic; no longer defined on these classes and not present on `Animator` either).
- `width()` removed from `container.js`, `flex-grid.js`, and `text-field.js` (no equivalent added to `Animator`).

### Breaking

- Code relying on `NavBar.ele` or `SideBar.ele` directly will break — these are now `NavBar.res` / `SideBar.res`.
- Code relying on `Base.el` (set by `mount()`) will break — now set as `Base.res`.
- Calling `.onTap()` on `Button`, `FlexRow`, or `Text` instances will now throw, since the method has been removed from these classes without replacement.
- Calling `.width()` on `Container`, `FlexGrid`, or `TextField` instances will now throw, since the method has been removed from these classes without replacement.

## 1.0.220 — 2026-08-05

### Changed
- `color`, `onTap`, `setArea`, `font`, `radius`, `width`, and `scale` are now defined once on the shared `Animator` base class instead of being duplicated in `Button`, `Card`, `FlexGrid`, `FlexRow`, `Image`, `Link`, `Text`, and `TextField`. Behavior of these methods is unchanged; they are simply inherited now.
- `Checkbox` now stores its root element on `this.res` instead of `this.el`, matching the convention used by other elements.

### Removed
- `Image.getHeight()` and `Image.getWidth()` have been removed.
- `Image.setFilter()` has been removed.

### Breaking
- Code relying on `Image.getHeight()`, `Image.getWidth()`, or `Image.setFilter()` will break, as these methods no longer exist.
- Code accessing `Checkbox.el` directly will break, since the property is now named `res`.

## 1.0.219 — 2026-08-05

### Changed
- `Animator`: internal cleanup only — removed dead/commented-out code and stray console/debug statements. No behavioural changes for consumers.
- `Base`: removed unused `toHTML(el)` method and unused `toNode(htmlString)` helper.
- `Text`: removed `toHTML()` method.
- `Text`: removed `jumbotron()` method.
- `Audio`, `MetaAdder`, `Modal`, `Progress`, `Row`, `SideBar`, `Stack`, `Switcher`, `Grid`, `HScroller`, `List`, `NavBar`, `Slider`, `Spacer`, `ScrollVideo`: removed unused `Animator` imports and other dead code; internal only, no behavioural change.
- `FlexRow`: BOTH `toColumn` definitions removed. The class had two — a 92-line breakpoint version that was silently shadowed, and a 3-line unconditional one that won. Only `toColumnAt(at)` remains, which is what the documented `colat` option uses.
- `prerender-site.js`, `prerender.js`: comment cleanup only.

### Breaking
- `FlexRow.set`: the `toColumn` option no longer collapses the row to a column responsively — it now triggers a deprecation warning via `deprecatedOption("toColumn", "colat")`. Use `colat` instead to get breakpoint-based column collapsing.

## 1.0.218 — 2026-08-04

### Fixed

- Fixed a broken build in `layout/list.js` where malformed syntax left `window.List` and `Cell` incorrectly assigned; now properly sets `window.List` and `window.Cell`, and exports `List, Cell` correctly.
- Fixed a broken build in `layout/nav-bar.js` where malformed syntax referenced a non-existent `Spacer` export; now correctly sets `window.NavBar` and exports only `NavBar`.

### Breaking

- The `Spacer` export from `layout/nav-bar.js` no longer exists (it was never valid due to the prior syntax error, but any workaround relying on it will no longer apply).

## 1.0.217 — 2026-08-04

A dead-code release: 85 files changed, 4,734 lines removed. No feature work, no
behavioural change intended anywhere.

### Breaking
- Removed 75 never-called methods from exported components — `text` (26), `image` (14), `circle` (5), `flex-row` (4), `grid` (4), `animator` (3), `container` (3), `nav-bar` (3), `new-nav-bar` (3), `grid-switcher` (2), `text-field` (2), `ulist` (2), and one each on `base`, `beta-mobile-bar`, `center` and `link`. These were chainable methods on classes the package exports, so this is a public surface reduction even though nothing in this repo or the maintained sites called them.
- Notable names, in case they are in your code: `allRound`, `headline`, `caption`, `square`, `borderAround`, `clipShape`, `autoW`, `fillAvailable`, `toBack`, `flexOne`, `rowCol`, `setGridRow`, `setGridCol`, `openSymbol`, `transluescent`, `keepItem`, `detailView`, `stretchFit`, `freeAreas`, `setAreas`.
- `allRound(v)` was the only one with real-world callers found (8, in frozen legacy pages that vendor their own copy of the library and never load this package). It was `borderRadius = v` — a third alias for `radius()`. Use `radius()`.
- Each name was checked against the four maintained sites, `__tests__/`, `public/` fixtures, the docs, `lib/`, `bin/`, every other `layout/` file, codegen strings, and bare option keys before removal. That last check matters: `animator.js` dispatches `this[key](value)` inside `resprop`, so any method is also reachable as an option key.

### Removed
- Deleted 12 unused component files: `base-2`, `cards`, `external-stylesheet`, `footer`, `group`, `label`, `list-OLD`, `navBar-OLD`, `new-flat-adder`, `offset-container`, `saved-new-nav-bar`, `without-new`. None were in `index.js`, none were webpack entries, and `index.js` is unchanged in this release — so nothing that resolved through the package `exports` map can break.

### Changed
- Stripped ~1,600 lines of commented-out code from `animator.js` (3,717 → 2,134 lines before the method removals). Method count, `//@` annotations and generated docs output were all byte-identical afterwards.
- `container` and `image` no longer redefine `removeQuotesFromFirstWord`, `maxWidth`, or (on `container`) `gpos`. Their bodies were byte-identical to `Animator`'s, so the calls now resolve one level up with no behavioural change.

### Notes
- Verified before release: all 50 remaining `layout/` files parse, the webpack build is clean, 221/221 Playwright tests pass, and the generated docs are byte-identical — confirming nothing removed here was documented.
- Two pre-existing orphans were found but **not** fixed in this release: `list.js` and `nav-bar.js` do not parse. An earlier global rename split identifiers across lines (`window.List\nCell = List\nCell;`). Neither is imported by `index.js` nor is a webpack entry, so neither ships as a module.

## 1.0.216 — 2026-08-04

### Added
- `dimensions(w, h)` — new method on `Container`/`Wrapper` and `Image` for setting width/height (replaces the old `size(w, h)` on these components).
- `radius(v)` — new method on `FlexCard`, `Link`, and `TextField` for corner radius; accepts a number (px) or a string (e.g. `"50%"`), replacing `round()`.
- `background(c)` — new method on `Circle` to set background colour (previously `color()` did this).

### Changed
- `size(w, h)` on `Container`/`Wrapper` and `Image` is now deprecated: it still works but calls `dimensions(w, h)` internally and logs a deprecation notice, since `size` collided with the `size` fluid-type-scale option.
- `round()` on `FlexCard`, `Link`, and `TextField` is deprecated in favour of `radius()`; it still works but logs a deprecation notice.
- `Button`'s `padding`/`margin` set-options are deprecated in favour of `pad`/`mar`; they still work but now log a deprecation notice and are implemented via `pad()`/`mar()`.
- `Polygon`'s `margin`/`padding` set-options now go through `mar()`/`pad()` instead of dedicated `margin()`/`padding()` methods.
- Internal: `Text.headline()` now sets top spacing via `pad([{t: 20}])` instead of `padding("top", 20)`.

### Breaking
- Per-component `padding()`/`margin()` methods have been removed from: `Audio`, `Button`, `Center`, `Checkbox`, `Container`/`Wrapper`, `FlexGrid`, `FlexRow`, `Group`, `Image`, `Link`, `OffsetContainer`, `Polygon`, `TextField`, `Text`, and `UList`. Use `pad()`/`mar()` instead.
- `background()` on `Card`, `FlexCard`, `Group`, and `Link` now sets the `background` shorthand instead of `backgroundColor`. It now clears any previously-set gradient/background-image, whereas before it left it in place.
- `Circle.color()` now sets text colour (`style.color`) instead of background colour. Use the new `Circle.background()` for the old behaviour.
- `Polygon.color()` now sets text colour (`style.color`) instead of background colour.
- Removed exports/classes entirely: `Box`, `CleanRow`, `Header`, `ExactImage`/`Imager`, `Modal`, `GridNew`, `ModernWrap`, `MultiSwitcherBeta`, `Empty`, `DropdownOld`, `AspectImage`, and the demo classes `TopBar`, `NewsHeader`, `ImageRow`, `CenterRow`.

## 1.0.214 — 2026-08-03

### Breaking
- Removed the spacing options `arrayMargin`, `arrayPadding`, `arrpad`, `paddings`, `multipad`, `multimargin`, and Text's `padding`. `mar` and `pad` are now the only options that set margin and padding. Migration: `arrayMargin: {sides: ["top","bottom"], value: "10px"}` becomes `mar: [{tb: "10px"}]`.
- Removed the centering methods `toCenter()`, `flexc()`, `toCol()` and `simpleCenter()`, and the options `centerColumn`, `flexCenter` and `simpleCenter`. Use `center`.
- `center` now means the same thing on every component: centre this element's CHILDREN. On Text it previously set auto margins, centring the element itself — that is now `mar: "center"`.
- `center: true` centres both axes. It previously centred one.
- Removed `layout/styler.js` (the `Style` class) along with `Text.style()` and `Link.style()`. Nothing imported it and it was unreachable through the package `exports` map.
- Removed `padRight` from Link's nested image options. Use `pad`.

### Added
- `center: true | "x" | "y"` — defined once on `Animator` and dispatched from `commonMethods`, so every component accepts it. Axis-aware: in a flex column `"y"` is `justify-content` and `"x"` is `align-items`; a row reverses them; a grid uses `justify-items`/`align-items` without being converted to a flexbox.

### Fixed
- `border` no longer sets `padding: 0.25em`. It ran after `pad()` and silently overwrote it, so `{pad: [{a: 40}], border: {...}}` rendered 4px instead of 40px.
- Wrapper's code export emitted `arrpad` under a `pad:` key in one branch and `arrpad:` in another, and interpolated the sides array into a single string (`sides: ["left,top"]`), so exported code lost its margins.
- Bare numbers now apply. The removed array forms assigned values such as `20` directly to `style.paddingTop`, which is invalid CSS the browser discarded; `mar`/`pad` treat a number as pixels. Calls that silently did nothing will now render — check any layout that passed unitless numbers.

### Changed
- `mboth` is deprecated in favour of `mar: "center"`. It still centres, and now logs a deprecation notice via `Animator.deprecatedOption()`. Removed options log the same way rather than failing silently.

## 1.0.213 — 2026-08-03

### Changed
- Internal: added inline documentation comments for existing `set` options (`resmar`, `hover`, `size`, `resprop`, `noTheme`, `theme`, `hide`) in `Animator`. No behavioral change.

## 1.0.212 — 2026-08-02

### Changed
- Added inline documentation comments for existing `link` options: `fixMobileTap`, `nowrap`, `block`, `rounded`, and `new`. No behavioral changes.

## 1.0.207 — 2026-08-02

### Fixed
- `set()` now applies the `borderObj` option directly when given the `{ width, color }` form, instead of silently ignoring it on components without their own handler (e.g. TextField, Picker, Button, Image, Center) or requiring it to be chained separately via `.borderObj(...)`. The shorthand `{ a: "..." }` form is still left to components that implement it themselves.

## 1.0.206 — 2026-08-02

### Fixed
- `commonMethods` in `Animator` now maps `color` → `color`, so `.set({ color: ... })` works consistently across components. Previously `color` was missing while `background` was present, meaning components that style themselves purely through `commonMethods` (e.g. `Picker`) silently ignored a `color` option and did not update text colour.
- Containers that never handled `color` before (`FlexGrid`, `FlexRow`, `Center`, `UList`) now support it instead of silently no-oping.

### Changed
- All other files: comment/header changes only (copyright year), no functional changes.
