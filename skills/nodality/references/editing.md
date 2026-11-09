# Editing a page that already exists

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

## Editing a page that already exists

Editing is the common case in production, and it does not mean
regenerating. Read the page back to data, change the one thing, render
again:

```js
import { parseSpec } from "nodality/parse";

const { elements, nodes } = parseSpec(html);  // or the parse_html MCP tool
elements[0].items[1].title = "Gamma";          // change one card
new Des().nodes(nodes).add(elements).set({ mount: "#mount", annotate: true });
```

**Render with `{annotate: true}` if the page will ever be edited.** It
writes each descriptor onto the node it produced, and that is what makes
the read exact – every type, every option, nothing inferred. It also
appends the page's nodes as one `<script type="application/json"
data-nod-nodes>` after the elements, so they come back too (`nodesExact`). It is
opt-in and off by default because it puts attributes in the output.

Without annotation only what the tag settles comes back: headings,
paragraphs, links, images, lists. Thirteen composite types render as a
bare `<div>` with nothing to tell them apart, so those are reported
**unrecovered rather than guessed** – a wrong guess would silently
become a different page. Use `parseReport` (or the `parse_html` tool)
rather than `parseHTML` when you need to know which you got:

```js
const { ok, exact, spec, nodes, nodesExact, unrecovered, errors } = parseReport(html);
```

`ok` is false if anything was unrecovered *or* the recovered spec fails
validation. Check it before re-rendering: a descriptor read out of a
document is untrusted input.
