# Raster effects: scroll, devices, and what happens to your image

## `by: "scroll"` moves a point, not a band

`by:` picks what steers an effect. `"scroll"` gives the effect a **focus
point** on the element's vertical centre line. As the element crosses the
viewport — entering at the bottom, leaving at the top — the point moves
from the element's **top edge to its bottom edge**. It is always on.

What happens around that point depends on the op:

| op | with `by: "scroll"` |
|---|---|
| `halftone` | the **whole** image is screened; near the point the dots are magnified, like a loupe held over the print |
| `offset`, `flow` | the image is pushed around near the point |
| `mask` | writes a field around the point — this is how you make a shape |

So this halftones everything, and is working as intended:

```js
{ op: "halftone", target: ["photo"], by: "scroll" }
```

For a halftone **stripe that travels down the photo** as you scroll, write
a band and mask the halftone with it:

```js
{ op: "mask", from: "band", as: "band", target: ["photo"], by: "scroll", radius: 90 },
{ op: "halftone", target: ["photo"], masked: "band" },
```

`radius` is the stripe's half-height in CSS px. Use `from: "radial"` (the
default) for a moving spot instead.

While a short image sits fully in view, the point only travels through the
middle of it. The full top-to-bottom sweep spans the whole time the image
is anywhere on screen.

The halftone loupe used to look like a moiré swirl: the dot pitch was
varied in place, which shears the grid more the further it is from the
element's corner. The grid is now magnified about the point instead — a
clean lens, with the rest of the screen still while the point moves.
`dither` with a driver had the same swirl and the same fix. Parameters
and defaults are unchanged; the magnification at the centre is still
2.8× (`1 + 1.8`), and its rim compresses the dots slightly, as a loupe's
edge does.

## Only on mouse/trackpad devices: `pointer`

```js
{ op: "hexalize", target: ["photo"], by: "hover", lift: 0.3, pointer: "fine" }
```

| `pointer` | node kept when |
|---|---|
| `"fine"` | a mouse or trackpad is the primary pointer |
| `"coarse"` | touch is the primary pointer |
| `"none"` | there is no pointer |
| `"any"` / omitted | always |

A node that does not match is dropped; the rest of the chain still runs.
If nothing is left, the effect does not attach and the image is left
exactly as you wrote it. Checked once, when the page loads. A misspelt
value drops the node and logs a warning.

## Reduced motion

With **prefers-reduced-motion: reduce** on, no raster effect attaches at
all — static ones included. The page shows the plain image or text.

## What happens to the original `<img>`

- It **stays in the page**: same element, same `alt`, still announced by
  screen readers. Nodality wraps it in a
  `<div data-nodality-raster-host="img">`, makes it transparent, and draws
  the effect on a canvas behind it. The canvas is hidden from assistive
  technology, so the image is announced once, by its `alt`.
- It **is shown first**. The effect takes over about two frames after the
  image has loaded and painted, so the photo still counts as your
  Largest Contentful Paint.
- **Cross-origin images** (a CDN on another domain) need
  `crossorigin="anonymous"` plus an `Access-Control-Allow-Origin` header on
  the server. Without that the GPU cannot read them, so the effect is
  skipped (with a console warning) and the image is shown as-is.
- **It keeps its size**, however it was given: inline, a stylesheet rule,
  or `width`/`height` attributes. A fixed width stays fixed, a percentage
  stays fluid, a height alone keeps the aspect ratio, `max-width: 100%`
  alone means the natural width, capped. (Before this, only inline sizing
  was kept: a 600x400 image sized by a stylesheet came out 700x466 in a
  700 px column.) An image with no sizing at all fills its parent.
  Limit: the size is read once, when the effect attaches, so a media query
  that later changes the image's width in a stylesheet no longer reaches
  it — size responsive rastered images with percentages, or inline.

## Cost

Each rastered element uses one WebGL context and redraws every frame while
it is on screen (it pauses off-screen). Cost grows with element area and
with the square of the screen's pixel density; a 600x400 image on a 2x
display holds about 8 MB of GPU memory. Browsers allow only a limited
number of WebGL contexts per page (often 16) — keep raster effects to a
few hero elements, and use `pointer: "fine"` or a `switch` to keep heavy
chains off phones.
