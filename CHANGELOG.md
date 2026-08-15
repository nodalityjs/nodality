# Changelog

Generated per release from the source diff.

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
