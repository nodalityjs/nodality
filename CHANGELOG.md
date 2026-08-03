# Changelog

Generated per release from the source diff.

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
