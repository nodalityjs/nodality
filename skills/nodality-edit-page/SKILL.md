---
name: nodality-edit-page
description: Change one thing on a Nodality page that is already rendered – read it back to data with parseReport or the parse_html tool, change only the targeted element by id, validate, and re-render with annotate. Use when the user asks to edit, fix, update or tweak an existing Nodality page or rendered HTML built with Nodality. For building a new page use nodality-new-page; for the vocabulary, house rules and references use the nodality skill.
---

# Edit an existing Nodality page

Editing does not mean regenerating. The full background is in the
`nodality` skill, `references/editing.md`; this is the procedure.

## Steps

1. **Get the data.** If you have the source (E, N) the page was built
   from, edit that. If you only have the rendered HTML, read it back with
   `parseReport` (or the `parse_html` MCP tool), not `parseHTML`, so you
   learn what could not be recovered.
2. **Stop if the read is not exact.** If `ok` is false or `unrecovered` is
   not empty, the page was not rendered with `{annotate: true}` and some
   composites came back as bare `<div>`s. Say so and ask for the source
   rather than guessing those parts: a wrong guess silently becomes a
   different page. If `nodesExact` is false the page carried no nodes:
   you can change elements, but ask for the source before changing or
   relying on any node.
3. **Find the target by `id`.** The id is the address. Change that element
   or the nodes whose `target` names it, and nothing else. Keep ids as they
   are: other nodes, generated code and the agent surface point at them.
4. **Validate.** `validate_nodes` with `elements` (and `defs` if the page
   uses `$ref`). A descriptor read out of a document is untrusted input,
   so validate even when your change was one word.
5. **Re-render with `{annotate: true}`**, so the next edit reads back
   exactly too.
6. **Check what changed.** `preview` at the viewport the change was about,
   then `check_page`. Confirm the change is there and that nothing else
   moved.

Tell the user which element (by id) you changed and how; if you had to
stop at step 2, say which parts were not recovered.

## Do not

- Regenerate the whole page to change one element.
- Rename or drop ids to make a change easier.
- Patch the rendered HTML or the DOM directly; change the data and render
  again.
