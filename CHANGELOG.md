# Changelog

Generated per release from the source diff.

## 1.0.208 — 2026-08-02

### Changed
- Documentation-only update: inline `//@` comments were added throughout `animator.js`, `container.js`, `text-field.js`, and `text.js` describing existing options (e.g. `pad`, `mar`, `respad`, `borderObj`, `keySet`, `raster`, `isHidden`, `gpos`, `sticky`, `ga`, `simpleCenter`, `simpleBorder`, `flexCenter`, `multipad`, `multimargin`, `paddings`, `customAlign`, `customJustify`, `disp`, `flexDir`, `type`, `placeholder`, `arrayPadding`, `arrayMargin`, `exact`, `radius`, `bold`, `theme`, `cursor`, `preffersId`, `breakWord`). No functional or behavioral changes.

## 1.0.207 — 2026-08-02

### Fixed
- `set()` now applies the `borderObj` option directly when given the `{ width, color }` form, instead of silently ignoring it on components without their own handler (e.g. TextField, Picker, Button, Image, Center) or requiring it to be chained separately via `.borderObj(...)`. The shorthand `{ a: "..." }` form is still left to components that implement it themselves.

## 1.0.206 — 2026-08-02

### Fixed
- `commonMethods` in `Animator` now maps `color` → `color`, so `.set({ color: ... })` works consistently across components. Previously `color` was missing while `background` was present, meaning components that style themselves purely through `commonMethods` (e.g. `Picker`) silently ignored a `color` option and did not update text colour.
- Containers that never handled `color` before (`FlexGrid`, `FlexRow`, `Center`, `UList`) now support it instead of silently no-oping.

### Changed
- All other files: comment/header changes only (copyright year), no functional changes.
