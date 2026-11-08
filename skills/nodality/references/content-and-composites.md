# Content: HTML names and composite slots

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

## HTML's names are accepted

`src` and `href` both mean `url`; `options` means `items`. Write either — the
canonical names are `url` and `items`, and that is what `get_schema` reports.
Giving both with **different** values is reported as `CONFLICTING_ALIAS`,
because one of them would be ignored.

A table's rows may also be written as arrays with the header row first, the way
a CSV is:

```js
{ type: "table", items: [["date", "race"], ["29/08", "Krusnoman"]] }
```

## Composites carry their content in a slot

A composite is not empty scaffolding – you give it content, and **which
key you use is part of the type**:

| slot | types |
|---|---|
| `items` | `cards`, `nav`, `sideNav`, `table`, `ulist`, `dropdown`, `picker`, `radio` |
| `children` | `row`, `form`, `stack`, `wrap` |

And **what an entry may be depends on the type**, because an element spec is
not accepted everywhere:

| type | an entry is |
|---|---|
| `cards` | `{ title, link, img }`, or an **array** of element specs |
| `nav`, `sideNav` | `{ title, link }`, or a string |
| `table` | `{ title, link }` / `{ text, url }`, a `[value, text]` pair, or an element spec |
| `ulist` | an element spec, or a string |
| `dropdown`, `picker` | a string, or a `[value, text]` pair |
| `radio` | a string |

Writing `items: [{ type: "h2", text: "…" }]` on `cards` or `nav` is the one
mistake worth naming, because it is well-formed and does nothing: `cards`
renders an empty card and `nav` drops the entry. Wrap it — `items: [[{ type:
"h2", … }]]` — and `cards` builds a card containing it. `validate_nodes`
reports this as `WRONG_ITEM_SHAPE` and hands back the corrected entry.

```js
{ type: "cards", items: [                       // shorthand
    { img: "a.jpg", title: "Alpha", link: "#a" },
    [{ type: "h2", text: "Beta" }],             // or nested specs
]}
```

`items` takes either shorthand entries or a nested list of element
specs, and one array may mix both. Use nested specs when the cards
differ from one another – that is the case where a data format wins by
the widest margin, and where writing it as code costs *more* than
hand-written JSX.

**Declaring content in the wrong slot renders the placeholders.** A
composite given nothing falls back to sample content, so
`{type:"table", children:[…]}` produces a plausible-looking table of
someone else's data rather than an error. `validate_nodes` reports this
as `WRONG_CONTENT_SLOT` and names the slot that carries content – which
is another reason step 3 is not optional. `get_schema` names it too.
