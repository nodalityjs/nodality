# Building more than one page

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

## Building more than one page

Declare shared chrome once and reference it. **`.defs()` must come before
`.add()`** — `add` renders as it goes, so definitions arriving later cannot be
used, and the wrong order is refused with a message saying so.

```js
const shared = {                      // one file, imported by every page
  nav:    { type: "nav", items: [{ title: "Home", link: "/" }] },
  footer: { type: "wrap", children: [{ type: "p", text: "Acme" }] },
};

new Des().defs(shared).nodes(N)
  .add([{ $ref: "nav" }, { type: "h1", text: "Pricing" }, { $ref: "footer" }])
  .set({ mount: "#mount" });
```

Keys written beside a reference **override** the definition, which is how one
nav serves every page:

```js
{ $ref: "nav", id: "topnav" }                       // adds an id
{ $ref: "nav", items: [{ title: "Docs", link: "/d" }] }   // replaces the list
```

The merge is shallow: an override replaces a slot, it does not extend it.

Worth it from **two pages up**: on a single page a reference costs more than
writing the thing, so do not reach for it before then. On a real site's nav and
footer it is 1.7x at four pages and about 2x at ten — measured, because 61% of
every token in that site was the same chrome repeated.

A name with no definition is refused at render and reported by
`validate_nodes` as `DANGLING_REF` with a did-you-mean, so pass `defs` as the
third argument when you validate a page that uses references.
