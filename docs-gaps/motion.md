# Motion options

Five options that work on every element type: `reveal`, `scrub`, `pin`, `count` and `fit`. They go on the element in E, like `loop`, with no stylesheet and no DOM code.

All of them are safe by default:

- **Nothing stays hidden.** A start state (a hidden `reveal`, a `count` starting at 0) is applied only where the motion that undoes it will certainly run: in a browser with IntersectionObserver and Web Animations, for a visitor who has not asked for reduced motion. In the prerender (jsdom) every option does nothing and the page renders as if it were absent.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, `reveal` and `count` show the final content at once, `scrub` shows its last keyframe, and `pin` still pins, because holding still is not motion. The `animation` design node does the same: with `fireAt` it shows the last frame of `keyframesOpen` at once. When it is opened and closed by events instead, it switches between the same two states with no transition.
- **Cleanup.** Everything is released by `destroy()` (and `Des.destroy()`). If an element is set again without an option, what the option attached is taken off.

## reveal

The element comes in once it scrolls into view.

```js
{ type: "h2", id: "lead", text: "Plain data in, page out", reveal: { by: "word" } }
```

| key | default | |
|---|---|---|
| `y`, `x` | `24`, `0` | Starting offset. A number is in px; strings like `"2rem"` also work. |
| `opacity` | `0` | Starting opacity. The element ends at its own opacity. |
| `scale` | none | Starting scale, e.g. `0.96`. |
| `duration`, `delay` | `700`, `0` | In ms. |
| `easing` | `"cubic-bezier(.2,.7,.2,1)"` | Any CSS easing. |
| `stagger` | none | ms between items. On its own it brings the element's **children** in one after another, not the element itself. |
| `by` | none | `"word"` or `"line"`: brings a text's words, or lines, in one after another. The default stagger is 40 ms for words and 120 ms for lines. |
| `once` | `true` | `false` plays it again each time the element comes back up from below. |
| `threshold` | `0.15` | How much of the element has to be above the bottom of the viewport. |

- `reveal: true` uses every default.
- An element the visitor has already scrolled past (an anchor link, the End key) is shown straight away. So is an element that is in view vertically but clipped sideways, for example inside a horizontal scroller.
- `by` keeps the text as it is. Each word is wrapped in place with no copies, so `textContent` does not change and a screen reader reads the same sentence. The wrappers are removed once the words are in.
- Limits: the movement uses the `translate` and `scale` properties, so inline elements (`a` inside a line of text) only fade. With `by`, the words are inline-block while they animate. In cross-origin iframes, where the browser ignores the observer's margin, a backup scroll check catches elements that were scrolled past.
- On `img`, `reveal` is the image's own mask reveal (`{mask: "square", …}`), which is unchanged.

## scrub

The page's scroll position drives CSS keyframes.

```js
{ type: "wrap", id: "hero", children: [/* … */],
  scrub: { keyframes: [{ opacity: 1, scale: "1" }, { opacity: 0, scale: "0.9" }], from: "top", to: "exit" } }
```

`from` and `to` name the scroll points between which the keyframes run, from 0 to 1:

| point | the moment when |
|---|---|
| `"enter"` (default `from`) | the element's top reaches the bottom of the viewport |
| `"full"` | the element is fully in view (its bottom at the viewport bottom, or its top at the viewport top if it is taller) |
| `"top"` | its top reaches the top of the viewport |
| `"exit"` (default `to`) | its bottom reaches the top of the viewport |
| `"page"` | from the top of the document to the bottom |
| `"pin"` | the start and end of the element's `pin` |

`easing` (default `"linear"`) shapes the progress.

- The element also gets a `--progress` custom property (`0`–`1`), which its descendants can use in `calc()`. Components can subscribe to it with `component.onScrubProgress(fn)`, which returns an unsubscribe function. A 3D `model` uses this to drive its camera.
- Responsive: pass an **array** of variants. The first one whose `media` matches is used, and the choice is made again when a query starts or stops matching. A variant with no `media` always matches, so put it last as the fallback.

  ```js
  scrub: [
    { media: "(min-width: 768px)", keyframes: [{ translate: "0 0" }, { translate: "-40% 0" }], from: "pin", to: "pin" },
    { keyframes: [{ opacity: 0.4 }, { opacity: 1 }], to: "full" },
  ]
  ```
- Limits: progress is measured against the window's scroll. A scrub inside a scrolling container (`overflow: auto`) does not follow that container. Nothing runs between scroll events: each scroll event schedules one frame at most.

## pin

The element stays stuck to the top of the viewport for this much extra scroll.

```js
{ type: "wrap", id: "story", children: [
  { type: "wrap", id: "stage", height: "100vh", pin: "150vh",
    scrub: { keyframes: [{ opacity: 0.2 }, { opacity: 1 }], from: "pin", to: "pin" }, children: [/* … */] },
] }
```

How it works: the element gets `position: sticky; top: 0` (a `top` you set yourself is kept), and an empty `aria-hidden` spacer as tall as the pin is placed after it. This is plain CSS, so it also works from prerendered HTML. `parse` ignores the spacer.

Limits, which come from how `sticky` works:

- **It sticks within its parent.** It stays stuck until the parent ends. If the pinned element has siblings after it, they scroll past underneath it while it is stuck. Make the pinned element the last child of a wrap, as in the example.
- An ancestor with `overflow` other than `visible` stops it sticking.
- A flex row that stretches its items gives the element the full height of the row, which leaves it no room to move. Use a column, or `alignSelf: "flex-start"`.
- A bottom margin does not work as the extra room: `sticky` keeps the element's *margin* box inside the parent. That is why a spacer is used.

## count

When the text scrolls into view, its first number counts up.

```js
{ type: "h3", id: "teams", text: "Over 1,200 teams", count: { duration: 1500 } }
```

| key | default | |
|---|---|---|
| `from` | `0` | Where the count starts. |
| `to` | the number in the text | Overrides what is read from the text, e.g. for `"1.2M"`. |
| `duration` | `1200` | In ms, easing out. |
| `decimals` | as written | Decimal places while it counts. |
| `locale` | none | Format with `Intl.NumberFormat`. By default the original's separators are copied. |

- Only the first number moves: `"15×"` counts the 15 and the first 7 of `"7/7/7"` counts. Text with no digits is left alone. `count: true` uses every default.
- The text **ends exactly as written**, with the same text node back in place. While the count runs, the moving figure is `aria-hidden` and a visually hidden copy of the final figure is what screen readers read.
- Groups of three digits after a separator are read as thousands, so `"1.200"` counts to 1200. Use `to` if it is meant otherwise.

## fit

The font is scaled so the text fills the element's width on one line.

```js
{ type: "h1", id: "mark", text: "NODALITY", fit: true }
```

- Uses `white-space: nowrap`, and fits again when the element's width changes and when web fonts finish loading.
- It fits the element's own width. A block heading is as wide as its container. A flex item that shrinks to its content is not, so give it `width: "100%"`.
- `fit` overrides `exact` and `size`.
