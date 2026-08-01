# Nodality library audit

Audited: `/Users/filipvabrousek/Desktop/layout/` (`lib/` 12 modules, `layout/` 78 modules).
Read in full: `lib/designer.js`, `lib/element-mapper.js`, `lib/raster-ops.js`, `layout/animator.js`, `lib/theme.js`.
All 58 live (transitively imported) modules examined individually — see §9 for the per-component pass and the depth of inspection each received.
Test suite consulted: `/Users/filipvabrousek/launch/__tests__/e2e/` (47 spec files).
Confidence: **CONFIRMED** = traced end-to-end or verified live · **LIKELY** = strong static evidence · **SUSPECT** = needs runtime check.

---

## 0. Fix status — 2026-08-01

Fixed in the dev source and staged to `/Users/filipvabrousek/launch` (+ `launch/public`), `dist/` rebuilt. **Not published** — version still 1.0.199, registry still 1.0.199.

| ID | Status | Note |
|----|--------|------|
| F1 | **fixed** | 18 live `alert()` sites removed or converted to `console.warn`. One extra was found during the fix that the audit missed: `flex-row.js` `columnAlways` (fired on every use). Guarded by a new test. |
| F2 | **fixed** | `Des.cloneNodes()` per index — same-kind ops no longer alias one object. |
| F3 | **fixed** | `nodes()`/`at()` deep-copy the caller's array. |
| F4 | **fixed** | `_track`/`_on` disposables registry; `destroy()` now releases the raster handle, all window/document listeners, observers and the pending raster retry timer. |
| F5 | **fixed** | `to.min + (to.max - to.min) * percent`. |
| F6 | **fixed** | `mount` threaded through `toTextArea()`, the emit path and `set()`; DOM queries scoped to the instance's own nodes. |
| F7 | **fixed** | `at()` keeps `options`/`protoOptions` in lockstep. |
| F8 | **fixed** | Unused `Des` import removed from element-mapper — cycle broken. |
| F11 | **fixed** | `Animator.viewportWidth()` — one accessor with an `innerWidth` fallback. |
| F12 | **fixed** | `resprop` applies `exact` directly instead of re-entering `set()`. |
| F13 | **fixed** | Raster `destroy()` now reachable (via F4). |
| F14 | **fixed, behaviour note** | Typo corrected. Because the misspelling meant CSSOM discarded the declaration, shipped behaviour was the shorthand default `all`; the original literal (`background, color, transform`) would have *narrowed* it and made `border`/`box-shadow` hovers snap. The emitted list is `background-color, color, border, box-shadow, transform` — every property `hover()` mutates. This is the only change visible in relaysLanding's output. |
| F15 F16 | **fixed** | `mapCopya` / `mapCDiv` removed (both crash-on-call, unreachable). |
| F17 | **fixed** | Canned radio/form items no longer ship profanity. |
| F18 | **fixed** | Write-only `prevStyles` snapshot dropped. |
| F19 | **fixed** | `p` maps to `S6` in both copies of `getElType`. |
| F24 | **fixed** | Example imports now name real files; guarded by a test. |
| F25 | **fixed** | `Base` Proxy `set` trap signature corrected to `(target, prop, value)`. |
| F26 | **fixed for Animator** | All Animator-owned window/document listeners routed through `_on`. Per-component leaks in `text.js` (+12), `keyframe-animation.js` (+7), `dropdown-2025.js` (+4), `transform-anim.js` (+3) are **not** yet routed — they need the same treatment. |
| F9 F10 F20 F22 | **not fixed** | Deliberate: each is a design change (mapper demo content, eval render path, fluidCopy element replacement, per-instance demo strings) rather than a defect, and each is wider than a bug fix. |
| F21 F27 | **not fixed** | Dead-module deletion deferred — see the correction below before acting on it. |

### Corrections to this audit found while fixing

1. **`layout/index.js` is NOT dead.** It is the package's public barrel: `webpack.config.js` builds it into `dist/index.esm.js`, which `package.json` `exports["."].import` points at — it is what `import { Des } from "nodality"` resolves to. `layout/prerender.js`, `layout/prerender-site.js`, `lib/seo.js` and `lib/data.js` are likewise reachable only through `package.json` `exports`. The §5 dead list was built from *internal* imports and therefore over-reports: **do not delete anything in §5 without checking `exports` and the webpack entry list first.**
2. **`element-mapper.js:585` was a false positive** in the F1 inventory — it sits inside a `/* */` block. `text.js:461` and `:1213` were correctly excluded. The corrected live count is 18, including the `flex-row.js` site the audit missed.
3. **`package.json` `main`/`exports.require` point at `dist/index.js`, which does not exist** (the build emits `index.cjs.js`). ESM consumers resolve fine via `exports.import`; CommonJS `require("nodality")` would fail. Not in the original findings — worth a P2.
4. **`onlyPublish.sh` never rebuilds `dist/`**, so a publish can ship stale bundles even though `lib/`/`layout/` are mirrored. `npm run build` had to be run by hand here.

### New tests

`__tests__/e2e/designer-contract.spec.js` (7 tests, + fixture `public/designerContract.html`) covers audit gaps G2/G3 and the new fixes: nodes-array purity, `at()` lockstep, op-replacement independence, `mount` honoured, `p` sizing, example imports resolve, and a no-`alert()` invariant that walks the real import graph. Suite: **189 passing**.


---

## 1. Executive summary

The raster pipeline (`raster-ops.js`) is the healthiest module: coherent registry design, the only complete teardown path in the library, 46+ tests. The generator layer (`designer.js` + `element-mapper.js`) is the least healthy: it mutates caller data, aliases shared objects across nodes, ignores its own `mount` option, and emits example code referencing files that don't exist. `animator.js` and the component fleet carry the runtime risk: **17 live `alert()` calls**, several in public methods that fire under ordinary conditions (every phone-width visitor, every `colat` column collapse, every non-matching breakpoint), a numerically wrong scroll interpolation, and a listener-leak family — 95 window/document `addEventListener` vs 11 removals — with a `destroy()` that tears down almost none of it, including never destroying the raster pipeline it owns. Fix first: **F1 (alerts)**, **F2 (op aliasing)**, **F4 (destroy)**.

---

## 2. Findings by severity

### P0 — crash / data loss

None found. The library's silent-early-out discipline (jsdom/prerender guards) genuinely prevents the crash class; broken paths degrade to wrong rendering instead.

### P1 — correctness, user-visible

| ID | Location | Summary | Confidence |
|----|----------|---------|------------|
| F1 | 17 sites, 8 live files (detail below) | Live `alert()` calls, several in public component methods that fire under ordinary conditions | CONFIRMED |
| F2 | `lib/designer.js:572–603` | All same-name ops share ONE replacement object — last target/color wins for every node of that kind | CONFIRMED |
| F3 | `lib/designer.js:363–367`, `:398–403`, `:899` | `.nodes(arr)` array mutated in place: entries replaced, `"default"` keys recursively deleted | CONFIRMED |
| F4 | `layout/animator.js:82–91` | `destroy()` removes theme sub + DOM node only — not raster handle, responsive/scroll/window listeners | CONFIRMED |
| F5 | `layout/animator.js:1588–1615` | `smartRange` overshoots whenever `0 < to.min < to.max` (opacity 0.2→1 lands at 1.4) | CONFIRMED |
| F6 | `lib/designer.js:1263`, `:1278–1339` | `set({mount})` ignored — `.render("#mount")` is a hard-coded literal; every Des renders into `#mount` | CONFIRMED |
| F7 | `lib/designer.js:614–615` | `.at()` without `.nodes()` throws (`this.protoOptions[q]` undefined) | CONFIRMED |

### P2 — architecture / API correctness

| ID | Location | Summary | Confidence |
|----|----------|---------|------------|
| F8 | `lib/designer.js:6` ↔ `lib/element-mapper.js:52` | Circular import Des ⇄ ElementMapper; the `Des` import is unused | CONFIRMED |
| F9 | `lib/element-mapper.js` (10+ methods, §3) | Mapper returns canned demo content for most types; only h1–h6/p/img/a honour user data | CONFIRMED |
| F10 | `lib/designer.js:1243`, `:1336` | Codegen-then-`eval`/`new Function` render path; CSP-incompatible, breakage surfaces at eval time | CONFIRMED |
| F11 | `layout/animator.js:2408` vs `:723` | Two viewport-width sources (`visualViewport.width` vs `innerWidth`); crashes where visualViewport undefined | LIKELY |
| F12 | `layout/animator.js:757–760` | `resprop` breakpoint containing `exact` re-enters full `set()` on every resize | LIKELY |
| F13 | `lib/raster-ops.js:2691` | Raster teardown correct but unreachable — zero callers repo-wide | CONFIRMED |
| F24 | `lib/designer.js:1012`, `:1015` | Generated example code imports `../layout/modal2025.js` and `../layout/flexrow.js` — **neither file exists**; copy-pasted examples fail | CONFIRMED |
| F25 | `layout/base.js:25–27` | `Base` reactive-state Proxy `set` trap has wrong signature — `set(target, prop, key, value)` then `target[key] = value` writes the *value* as the property name | CONFIRMED |
| F26 | 21 live files (§9 table) | Window/document listeners added with no removal path per component: `text.js` +12/−0, `keyframe-animation.js` +7/−0, `dropdown-2025.js` +4/−0 (document-level), `transform-anim.js` +3/−0, … | CONFIRMED |

### P3 — hygiene / maintainability

| ID | Location | Summary | Confidence |
|----|----------|---------|------------|
| F14 | `layout/animator.js:378` | Typo `transionProperty` — transition-property never set | CONFIRMED |
| F15 | `lib/element-mapper.js:403` | `mapCopya` references undefined `radius` → ReferenceError if called (dead) | CONFIRMED |
| F16 | `lib/element-mapper.js:1602–1630` | `mapCDiv` references undefined `rta`/`el`/`i` → crash if wired (dead, dispatch commented) | CONFIRMED |
| F17 | `lib/element-mapper.js:462`, `:1690` | Profanity in canned form/radio items shipped to user pages | CONFIRMED |
| F18 | `layout/animator.js:698–703` | `prevStyles` captured on every `resprop` call, never read | CONFIRMED |
| F19 | `lib/element-mapper.js:1379` + `animator.js:1626–1707` | `p` elements map to size `"S"`, which `fluidCopy` silently ignores | LIKELY |
| F20 | `layout/animator.js:1644–1704` | `fluidCopy` S1–S5 replace `this.res` (drop listeners/attrs); S6 mutates in place — asymmetric | CONFIRMED |
| F21 | 31 unimported files (§5) | ~5,900 lines of dead modules, several crash-on-import | CONFIRMED |
| F22 | `lib/designer.js:77–351` | ~275 lines of demo-code strings allocated in every `Des` instance | CONFIRMED |
| F23 | known issues re-verified | Snapshot pre-layout race still present; shared mount = F6; no GLSL `__`/backtick regressions | CONFIRMED |
| F27 | `layout/audio.js` + `layout/audionew.js`; `lib/seo.js`, `lib/data.js` | Two audio implementations both referenced; seo/data reachable only via dead `index.js` (possibly public API — verify before delete) | CONFIRMED |

---

## 3. Finding details

### F1 — Live `alert()` inventory (P1)
Every site below is in live (uncommented) code in a module reachable from `Des`; block-comment context checked per site.

| Site | Fires when | Weight |
|------|-----------|--------|
| `layout/button.js:454` in `large()` | `matchMedia("(max-device-width: 415px)")` matches — i.e. **every phone visitor** to a page using `Button.large()` | worst |
| `layout/flex-row.js:492` in `toColumn(at)` | whenever the documented `colat` column-collapse feature runs | worst |
| `layout/text.js:1687`, `:1697` in `apply(arr)` | on **every breakpoint evaluation that does not match** — routine resize traffic | worst |
| `layout/base.js:26` (Proxy set trap), `:59` (`load`), `:141` | every reactive-state write / load on the `Base` component | worst |
| `layout/animator.js:3095` (`alert("OPE")`), `:3189` | transform with only non-geometric values; malformed transform descriptor | high |
| `layout/center.js:91`, `:138` | margin helper called with only `L` provided | medium |
| `layout/container.js:950` (`alert(el.device)`) | responsive query with `device` flag | medium |
| `lib/designer.js:857`, `lib/element-mapper.js:585`, `layout/side-nav-bar.js:181`, `layout/multiswitcher.js` | inside commented/rare branches — verify then delete with the rest | low |

(`text.js:461`, `:1213`, `beta-desktop-bar.js:105` are inside block comments — not live, excluded.)
**Fix:** delete or `console.warn`; add `no-alert` lint to the publish gate.

### F2 — Same-name ops alias one shared object (P1)
`lib/designer.js:557–603`: for each op kind all matching node indices receive **the same object**:
```js
let as = replacementObjects[q];
as.target = target;            // overwrites previous iteration's target
...
customOptions[index] = as;     // every index points at the SAME `as`
```
**Failure:** `.nodes([{op:"blast", color:"red", target:["#a"]}, {op:"blast", color:"blue", target:["#b"]}])` → both entries become one object; last write wins; both elements styled identically. Applies to `blast/gradient/shadow/filter/animation/transform/span` (`:425`). **Fix:** clone per index.

### F3 — Caller's nodes array mutated (P1)
`designer.js:364` stores by reference; `:398–403` writes `item.gradient` into user objects; `:603` replaces user entries; `replaceMedium` (`:877–899`) rewrites `"medium"/"fast"/"slow"` and **deletes** keys valued `"default"` recursively. **Failure:** reusing a nodes array (second `Des`, React state) behaves differently the second time. **Fix:** deep-copy on entry.

### F4 — `destroy()` doesn't destroy (P1)
`animator.js:82–91` removes only the theme subscription and the DOM node. Never torn down: `this._rasterHandle` (complete `destroy()` exists at `raster-ops.js:2691` — WebGL programs, textures, FBOs, RO/IO, listeners — but **zero callers repo-wide**); `_responsiveHandler` resize listener (`:615`); `onScroll` window listener (`:522`); `chainReact` resize listener (`:2933`); per-element `window.addEventListener("sidebar:open"/"sidebar:closed")` (`:2796–2804`). Library-wide: **95 window/document adds vs 11 removes** (per-file distribution in §9). **Fix:** disposables array; `destroy()` drains it and calls `_rasterHandle?.destroy()`.

### F5 — `smartRange` interpolation overshoots (P1)
`animator.js:1607–1611`:
```js
let sm = to.max + Math.abs(to.min);   // WRONG: should be to.max - to.min
toRange = to.min + sm * percent;
```
`onScroll` opacity `0.2→1` yields `0.2 + 1.2p` → **1.4** at p=1. Correct only when `to.min ≤ 0`, which is why 0→1 demos look fine. **Fix:** `to.min + (to.max - to.min) * percent`.

### F6 — `mount` option ignored (P1)
`designer.js:1263` hard-codes `.render("#mount")`; `set()` (`:1278–1339`) never reads `obj.mount`. This is the sharper form of the known "shared mount" issue. Also: `:1295` `document.querySelector("pre")` grabs the first `<pre>` on the page (possibly the user's); each `set()` appends another `id="elements"` textarea → duplicate IDs.

### F7 — `.at()` is dead API (P1)
`:358–361` pushes to `options` without setting `protoOptions`; `add()` reads `this.protoOptions[q].style` unconditionally at `:614` → TypeError unless `.nodes()` was also called.

### F9 — Mapper types that ignore user data (P2)
Honour input: h1–h6/p (`mapText:1365`), img (`:1402`), a (`:1419`), wrap, ulist, circle/polygon (partially). Fixed demo content regardless of input: `mapTable:148` (Czech grades), `mapRow:194`, `button:416` (`onTap: alert("Nice")`), `radio:458`, `input:467`, `picker:499`, `video:450`, `audio:454`, `form:1665`, `protoNav:617–984` (368 hard-coded lines), `sideNav:989`, `mapGrid:1491` (Wikipedia URLs). The API shape implies `{type:"table", rows:[…]}` works; it silently doesn't.

### F24 — Generated examples import nonexistent files (P2)
`designer.js:1012` emits `import {Modal} from "../layout/modal2025.js"` and `:1015` `import {FlexRow} from "../layout/flexrow.js"` inside the modal example template. Verified: **neither file exists** (real names: `modal-2025.js`, `flex-row.js`). The `code:true` panel's flagship example fails on paste. Same template hardcodes `.render("#res")`.

### F25 — `Base` Proxy trap signature wrong (P2)
`base.js:25–27`:
```js
return new Proxy(a, {
    set(target, prop, key, value) {      // real signature: (target, prop, value, receiver)
        alert(`Setting ${key} to ${value}`);
        target[key] = value;             // writes the VALUE as a property name
```
Reactive state writes store `target[<newValue>] = <receiver>` instead of `target[<prop>] = <newValue>` — state is silently corrupted, plus an alert per write (F1). `Base` is in Des's `formComponents` map, so this is reachable API. **Fix:** correct the parameter list; return `true` from the trap.

### F26 — Per-component window/document listener leaks (P2)
Extends F4 beyond Animator with per-file data (§9): worst offenders `text.js` (+12/−0 — includes per-instance resize handlers in the responsive pathways), `keyframe-animation.js` (+7/−0 — scroll/resize per animation), `dropdown-2025.js` (+4/−0 — document-level click-outside handlers per dropdown, never removed on close/removal), `transform-anim.js` (+3/−0). Element-level listeners are GC-safe; window/document-level ones pin the component forever.

### Remaining P2/P3 briefs
- **F8:** delete unused `Des` import in element-mapper → cycle gone. The duplicated ~60-line import block belongs in one registry module.
- **F10:** `ready2Render` already holds live instances — render from them; keep codegen for the display panel only.
- **F11:** one accessor: `window.visualViewport?.width ?? window.innerWidth`.
- **F12:** apply `fontSize` directly instead of re-entering `set()`.
- **F14:** `transionProperty` → hover transitions animate everything.
- **F19:** `"p".substr(1)` → `"S"`; `fluidCopy` has no `"S"` branch → paragraphs get no sizing.
- **F20:** S1–S5 replace `this.res` (listeners/attrs lost), S6 styles in place.
- **F22:** move `this.stor` (incl. the 500-word seal essay at `:271`) to module scope.
- **F27:** `audio.js` (Des path) and `audionew.js` (other importers) are parallel implementations; `seo.js`/`data.js` reachable only via dead `index.js` — likely public-API modules, confirm before deleting.

---

## 4. Duplication map

| What | Copies | Divergence |
|------|--------|-----------|
| `filtero()` | `designer.js:374–388`, `element-mapper.js:1878–1892` | identical today; will drift |
| `getElType()` | `designer.js:369–371`, `element-mapper.js:1874–1876` | none |
| ~60-line component import block | `designer.js:5–66`, `element-mapper.js:1–63` | element-mapper adds unused `Des`; groupings differ |
| Fluid font formula `calc(1.625rem + 5.075vw)` | `animator.js:1642`, `text.js:396`, `text.js:1002`, `link.js:356`, `:839`, `button.js:312` (+ comment ref `raster-ops.js:1563`) | `text.js:896` uses `4.3vw` for the same role — **already drifted** |
| Breakpoint table `{xs:[0,575]…xxl:[1400,100000]}` | `animator.js:633`, `:796`, `:1011`, `:1368` | consistent today; 4 live copies |
| Range-matching loop | `resprop:722`, `respad:836`, `resmar:1405`, `_applyResponsive:1037` | same algorithm 4×; the abstraction has zero callers |
| `filtero(...)` 9-property block | 10 mapper methods (`element-mapper.js:167, 195, 233, 1320, 1348, 1383, 1410, 1446, 1808, 1844`) | mapImage/mapLink apply subsets — unclear if intentional |
| GLSL uniform boilerplate | 8 raster registry entries | acceptable idiom; defaults drift (§6) |

---

## 5. Dead code

**Unimported modules (31 files, ~5,900 lines)** — no importer in `lib/`/`layout/` (both quote styles checked; some referenced only by old demo HTML):
`base-2.js` (91), `box.js` (29), `cards.js` (137), `clean-row.js` (766), `custom.js` (289), `div-image.js` (209), `dropdown.js` (152 — superseded by `dropdown-2025.js`), `empty-element.js` (21), `external-stylesheet.js` (19), `footer.js` (83), `grid-new.js` (295), `grid.js` (187), `group.js` (163), `header.js` (175), `image-old.js` (487), `index.js` (267 — sole importer of `seo.js`/`data.js`), `label.js` (50), `list-OLD.js` (0 bytes), `list.js` (127), `modernwrap.js` (91), `multiswitcherBeta.js` (63), `nav-bar.js` (365), `navBar-OLD.js` (260), `new-flat-adder.js` (41), `offset-container.js` (395), `prerender-site.js` (469 — verify against `bin/` first), `row.js` (209), `saved-new-nav-bar.js` (431), `styler.js` (113), `switcher.js` (99), `without-new.js` (60).

**Dead functions in live files:** `animator.js:1009 _applyResponsive` (zero callers), `:550 getPX` (callers only in comments), commented masses `:565–590`, `:876–1007`, `:1073–1355`, `:1446–1479`, `:1728–1930`, `:1945–2217`, `:2227–2377`, `:3236–3541` (≈1,570 lines, ~44% of the file); `element-mapper.js:376 mapCopya`, `:1602 mapCDiv` (both unreachable and crash-on-call); `designer.js:1272–1275` `preo` element created, never appended. `raster-ops.js`: no dead functions found.

---

## 6. Raster-op parameter consistency matrix

Live registry: 15 ops incl. `switch` and the recently added `dither` (`raster-ops.js:337`). dpr = × devicePixelRatio.

| op | `radius` | `strength` | `size` | driver `by:` | notes |
|----|----------|-----------|--------|--------------|-------|
| hexalize | ✓ px·dpr **200** | — | ✓ px·dpr 24 | ✓ | radius = driver falloff |
| offset | ✓ px·dpr **260** | ✓ px·dpr **20** | — | ✓ mouse | strength = displacement px |
| duotone | ✓ px·dpr **220** | — | — | ✓ | |
| edges | — | ✓ scalar **1.0** | — | — | strength = opacity-ish |
| halftone | ✓ px·dpr **220** | — | ✓ px·dpr | ✓ | size = dot pitch |
| dither | ✓ px·dpr **220** | — | ✓ px·dpr **1** | ✓ | size = Bayer cell ≠ halftone's meaning |
| aberration | ✓ px·dpr **240** | — | — | ✓ | `amount` = split px |
| mask | ✓ px·dpr **260** | — | — | ✓ static | + `at:` fraction |
| copy | ✓ px·dpr **110** | — | — | ✓ static | radius = ring radius |
| echo | — | ✓ scalar **0.85** | — | — | + `decay`/frame |
| stir | ✓ **fraction of longer side, 0.1** | ✓ px·dpr **26** | — | mouse | **the unit collision** |
| blobs | ✓ px·dpr **46** | — | — | pointer | |
| merge | — | — | — | — | `mix` runs A→blend; direction easy to misread |
| noise | — | — | — | — | `amount` ≠ dither's `amount` |

**Collisions:** (1) `stir.radius` fraction vs px everywhere else — bit this session twice; (2) radius defaults 110/200/220/240/260 with no rationale; (3) `strength` = px (offset, stir) vs scalar (edges, echo); (4) `decay` = velocity dissipation (stir) vs trail persistence (echo); (5) `size` = tile / dot pitch / Bayer cell.

---

## 7. Test-coverage gaps (top 5)

Raster: 46+ focused tests. Most component specs are single smoke tests.

| # | Gap | Failure it would catch |
|---|-----|------------------------|
| G1 | No teardown/leak test | F4/F13/F26 — the whole leak family |
| G2 | No two-same-op-different-target test | F2 aliasing |
| G3 | No `.nodes(arr)` purity test | F3 mutation |
| G4 | No numeric endpoint test for `onScroll`/`smartRange` (min>0) | F5 overshoot |
| G5 | `dither` has fixture chains (`rasterOps.html:43–45`) but no spec, and the registry-surface test omits it | newest op ships untested |

---

## 8. Prioritized actions

1. Delete/`console.warn` all 17 live `alert()`s; add `no-alert` to the publish gate (F1).
2. Clone per-index in the op-replacement loop (F2).
3. Deep-copy the nodes array in `nodes()` (F3).
4. Wire `destroy()` to raster handle + a disposables array of every listener (F4, F13, F26).
5. Fix `smartRange` to `min + (max−min)·p` (F5).
6. Thread `mount` through codegen; stop page-global `pre`/`#elements` queries (F6).
7. Fix `Base`'s Proxy trap signature (F25).
8. Fix the example-code imports `modal2025.js`/`flexrow.js` → real filenames (F24).
9. Fix or remove `.at()` (F7); remove unused `Des` import (F8).
10. Fix `transionProperty` (F14); map `p` to a real size preset (F19).
11. Add the §7 tests — G2/G3 are cheap.
12. Delete the 31 unimported modules (verify `prerender-site.js`, `seo.js`, `data.js` against `bin/`/public API first) (F21, F27).
13. Excise the ~1,570 commented lines in animator.js (F18).
14. Deduplicate: one `filtero`, one breakpoint table, one width accessor, one fluid-size table (§4, F11).
15. Document the §6 semantics table in the raster README.

---

## 9. Component-by-component pass

Depth key: **FULL** = read line-by-line · **TARGET** = key methods read + full pattern sweep · **SWEEP** = full pattern sweep (alerts, listener balance, eval, innerHTML, console noise, hardcoded content probes) — a sweep-clean verdict means no pattern hits, not a line-by-line guarantee.
Listener column = window/document adds−removes only (element-level listeners are GC-safe and excluded).

### lib/

| Module | Lines | Depth | Win/doc listeners | Verdict |
|--------|------:|-------|------------------|---------|
| designer.js | 1342 | FULL | 0 | F2 F3 F6 F7 F8 F10 F22 F24 |
| element-mapper.js | 1908 | FULL | 0 | F8 F9 F15 F16 F17 F19 |
| raster-ops.js | 2723 | FULL | +1/−1 | cleanest large module; F13 (orphaned destroy), §6 param drift |
| theme.js | 91 | FULL | ±paired | **clean** — subscribe returns a working unsubscriber |
| keyframe-animation.js | 781 | SWEEP | **+7/−0** | F26 |
| transform-anim.js | 510 | SWEEP | **+3/−0** | F26 |
| scroll-video.js | 125 | SWEEP | +1/−0 | minor F26 |
| link-getter.js | 208 | SWEEP | 0 | clean by sweep |
| card-getter.js | 76 | SWEEP | 0 | clean by sweep |
| stacker.js | 35 | SWEEP | 0 | clean by sweep |
| seo.js | 219 | SWEEP | 0 | unreachable internally (F27) |
| data.js | 77 | SWEEP | 0 | unreachable internally (F27) |

### layout/ — core

| Module | Lines | Depth | Win/doc | Verdict |
|--------|------:|-------|---------|---------|
| animator.js | 3544 | FULL | **+19/−5** | F1 F4 F5 F11 F12 F14 F18 F20; 44% commented |
| text.js | 1774 | TARGET | **+12/−0** | F1 (`apply()` alerts ×2), F26; fluid-size drift (`:896` 4.3vw) |
| link.js | 1148 | TARGET | +3/−0 | display1 dup ×2; F26 |
| image.js | 1071 | SWEEP | +2/−0 | F26 |
| new-nav-bar.js | 1032 | SWEEP | +2/−0 | F26 |
| container.js (Wrapper) | 1008 | TARGET | +3/−0 | F1 (`:950` alert(el.device)); F26 |
| flex-row.js | 1000 | TARGET | +4/−0 | F1 (`toColumn:492` — fires on documented `colat`); F26 |
| button.js | 571 | TARGET | +2/−0 | F1 (`large():454` — fires on every ≤415px device); display1 dup |
| slider-2025.js | 472 | SWEEP | +2/−3 | one of two components that remove more than they add — likely OK |
| side-nav-bar.js | 366 | TARGET | 0 | alert at `:181` in rare branch (F1-low) |
| table.js | 237 | SWEEP | 0 | clean by sweep (canned data lives in mapper, not here) |
| ulist.js | 232 | SWEEP | 0 | clean by sweep |
| multiswitcher.js | 217 | SWEEP | +2/−1 | partial cleanup; alert in commented branch |
| base.js | 161 | TARGET | 0 | **F25 (broken Proxy trap) + 3 live alerts** |
| code.js | 158 | SWEEP | 0 | clean by sweep |
| modal-2025.js | 141 | SWEEP | 0 | clean by sweep; twin name `modal2025.js` only exists in broken example code (F24) |
| wrap.js | 140 | SWEEP | 0 | clean by sweep |
| center.js | 174 | TARGET | 0 | F1 (alerts `:91`, `:138` in margin fallback) |
| circle.js / polygon.js | 173/177 | SWEEP | 0 | clean by sweep |
| free.js | 223 | SWEEP | 0 | clean by sweep |
| zoom-card.js | 216 | SWEEP | 0 | clean by sweep |
| horizontal-scroller.js | 220 | SWEEP | 0 | clean by sweep |
| flex-card.js / flex-grid.js | 284/288 | SWEEP | 0 / +2−0 | flex-grid: F26 minor |
| grid-switcher.js | 183 | SWEEP | +2/−0 | F26 minor |
| stack.js / spacer.js / video.js / meta-adder.js / simple-bar.js | ≤76 | SWEEP | 0 | clean by sweep |
| audio.js / audionew.js | 145/70 | SWEEP | 0 | duplicate implementations (F27) |
| beta-desktop-bar.js / beta-mobile-bar.js | 131/278 | SWEEP | 0 | alert at desktop-bar:105 is commented; mobile-bar console noise ×2 |
| side-bar.js / progress.js / checkbox.js / text-field.js | ≤366 | SWEEP | ≤+1/−0 | minor F26 |
| dropdown-2025.js | 244 | SWEEP | **+4/−0** | document-level click-outside handlers never removed (F26) |
| nav-factor/custom-div.js | 60 | SWEEP | 0 | clean by sweep |

### layout/form-components/

| Module | Lines | Depth | Win/doc | Verdict |
|--------|------:|-------|---------|---------|
| floating-input.js | 163 | SWEEP | 0 | clean by sweep |
| radio.js | 225 | SWEEP | 0 | clean by sweep (canned items live in mapper) |
| picker.js | 218 | SWEEP | +1/−0 | minor F26 |
| image-picker.js | 266 | SWEEP | +1/−0 | minor F26 |
| range.js / data-list.js / form.js | ≤180 | SWEEP | 0 | clean by sweep |

**Fleet summary:** 58 live modules examined. 5 read FULL, 8 TARGET, 45 SWEEP. 24 modules clean by their inspection depth; the defect mass concentrates in `animator.js`, the two generator modules, `text.js`, and `base.js`.

---

*Method: every CONFIRMED finding traced through the full call path or verified live this session. Alert liveness was checked against block-comment context per site; three previously-reported sites were excluded as commented. `launch/` mirror confirmed in sync with dev source at audit time.*
