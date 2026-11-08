---
name: nodality-new-page
description: Build a new Nodality page from a brief in small validated steps – element skeleton first, then content section by section, then nodes one family at a time, validating after every step. Use when the user asks to create, draft or scaffold a new Nodality page, landing page or site section. For changing a page that already exists use nodality-edit-page; for the vocabulary, house rules and references use the nodality skill.
---

# Build a new Nodality page

The `nodality` skill holds the workflow, the house rules and the
references. This skill is the order to work in when the page does not
exist yet. Read `nodality` first if you have not in this session.

## The rule: the page is never invalid for long

Write the page in steps, and run `validate_nodes` (with `elements`, and
`defs` if the page uses `$ref`) after **every** step. Fix what it reports
before writing the next step.

Why steps and not one big write:

- A misspelled op or a wrong slot renders *nothing* instead of failing, so
  a whole page written at once can look finished and be missing half its
  effects. A small step keeps every finding next to the change that caused
  it.
- If the person is watching the page while you work, they see it grow in
  the order they would build it themselves, and can stop you early.

## Steps

1. **Vocabulary.** `list_ops` once. `get_schema <type>` for each element
   type you are about to use, one type at a time, not the whole schema.
2. **Skeleton.** Write E as structure only: the sections in page order,
   their types, and an `id` on every element a node will target. Leave
   composites empty for now. Validate.
3. **Content, one section at a time.** Fill one section: text, then the
   composite content in its slot (`items` or `children`; see
   `references/content-and-composites.md` in the `nodality` skill).
   Validate. Next section.
4. **Nodes, one family at a time.** Design nodes first, then raster, then
   morph. Add `agent-surface` only if the user asked for an agent-operable
   page. Validate after each family. See `references/node-families.md`.
5. **Look at it.** `preview` once with the default phone viewport and once
   with `viewport: "desktop"`. Read the ids the report lists as `empty`.
6. **Check it.** Put the pair in a real page and run `check_page` (or
   `npx nodality check`). Read `warnings` and `FAINT_TEXT`, not only
   `errors`. See `references/verifying.md`.

Report to the user what the page contains and anything a check flagged
that you left as it is, with the reason.

## Do not

- Write E and N in one pass and validate at the end.
- Add effects the brief did not ask for to make the page look busier.
- Touch the DOM or add CSS to fix something the data cannot express; that
  is a library extension, and the `nodality` house rules say so.
