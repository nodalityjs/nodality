# Interaction and accessibility options

Options every element takes, beside its own. They go on the element in E, like
any other option; none of them needs a node, CSS or DOM code.

## hover and focus

`hover` styles the element while the pointer is over it **and** while it, or a
link or button inside it, has keyboard focus. Any CSS property in camelCase;
`animation` is the transition timing. The original inline styles come back on
leave. Under `prefers-reduced-motion` the change is instant.

```js
{ type: "wrap", id: "card", pad: [{ a: 24 }], radius: 12,
  hover: { background: "#f4f1ea", transform: "translateY(-2px)", animation: "0.2s ease" },
  children: [{ type: "a", id: "more", text: "Read more", url: "/story" }] }
```

Give `focus` when the keyboard state should differ from the pointer one:

```js
{ type: "a", id: "cta", text: "Book", url: "#book",
  hover: { color: "#b83a0b" }, focus: { outline: "2px solid #b83a0b", outlineOffset: "3px" } }
```

`transition: "color 0.3s ease"` sets the transition verbatim instead.

## group and groupHover

`group: true` on a container; `groupHover` on anything inside it. The
descendant changes while the group is hovered or holds keyboard focus.

```js
{ type: "wrap", id: "row", group: true, children: [
  { type: "p", id: "label", text: "Our process" },
  { type: "p", id: "arrow", text: "→", groupHover: { transform: "translateX(4px)", animation: "0.2s ease" } },
] }
```

Groups nest: a descendant follows its nearest group.

## aria, role, tabIndex, lang, title

```js
{ type: "wrap", id: "note", role: "note", lang: "cs",
  aria: { label: "Poznámka", describedBy: "fine-print" }, children: [] }
```

`aria` keys become `aria-*` attributes (`describedBy` → `aria-describedby`).
Booleans become `"true"`/`"false"`, arrays of ids are space-joined, `null`
removes the attribute. `tabIndex` is a whole number. `title` is not added where
it is already the element's visible text.

## Semantic tags: `as` on wrap, `tag` on text

```js
{ type: "wrap", id: "story", as: "article", children: [
  { type: "p", id: "q", tag: "blockquote", text: "It still closes like the first day." },
  { type: "p", id: "who", tag: "cite", text: "— a customer" },
] }
```

`as`: section, article, aside, header, footer, main, nav, figure, figcaption,
blockquote, ul, ol, li, dl, dt, dd, address, time, details, summary.
`tag` (text elements): h1–h6, p, blockquote, figcaption, li, dt, dd, cite, time,
small, strong, em, span, q, address, label. Anything else is ignored with a
console warning.

## Lists

`ulist` items are now real `<li>` elements (they used to sit directly in the
`<ul>`). The rendering does not change. `ordered: true` makes it an `<ol>`.

```js
{ type: "ulist", id: "steps", ordered: true, items: ["Measure", "Cut", "Sew"] }
```

## copy

Click, Enter or Space copies the text; the element shows `copied` for 1.5 s and
screen readers hear it. A non-button element becomes a keyboard-operable
button. `copy: true` copies the element's own text.

```js
{ type: "p", id: "install", text: "npm i nodality", copy: "npm i nodality", copied: "Zkopírováno" }
```

## spy

On any container: its in-page links (`href="#…"`) get `aria-current="true"`
and `activeStyle` while their section is the one in view. One at a time, the
topmost visible section wins. Sections inside a horizontal scroller are
watched against that scroller.

```js
{ type: "wrap", id: "toc", spy: { activeStyle: { color: "#b83a0b" }, offset: 72 }, children: [
  { type: "a", id: "t1", text: "Material", url: "#material" },
  { type: "a", id: "t2", text: "Process", url: "#process" },
] }
```

`spy: true` underlines the active link. `offset` is the height of a fixed
header, in px.

Limit: a section counts as in view while it overlaps the upper half of the
viewport (below `offset`). A short last section that the page cannot scroll
that far up may never become active; between two short sections the last
active link stays lit.

## nav: spy, actions, hideOnScroll, aria

```js
{ type: "nav", id: "nav", items: [{ title: "Material", link: "#material" }, { title: "Process", link: "#process" }],
  spy: true,
  actions: [{ type: "a", id: "cta", text: "Book a call", url: "#contact",
              background: "#111", color: "#fff", radius: 999, pad: [{ tb: 8, lr: 16 }] }],
  hideOnScroll: true,
  aria: { label: "Main" } }
```

- `actions` render after the links on desktop and inside the menu panel on a
  phone.
- `hideOnScroll` slides the bar away while scrolling down and back on scrolling
  up. It acts only when the bar, or the wrapper holding it, is
  `position: fixed` or `sticky`; under reduced motion the bar stays. Keyboard
  focus entering the bar brings it back.
- `hideOnScroll` also works on any other fixed or sticky element.
