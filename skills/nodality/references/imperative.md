# The imperative layer

Part of the `nodality` skill. Read it when the task needs it; the
workflow and house rules in `../SKILL.md` always apply.

## The imperative layer – direct instantiation

The component classes behind E are public API, exported from the package
root. An agent can instantiate them directly instead of writing the
pair:

```js
import { Text, Link, FlexRow } from "nodality";

new Text("Hello").set({ fluidc: "S3", color: "#f97316" }).render("#mount");
```

This is exactly the code the codegen panel emits, so the two forms are
equivalent and interchangeable: `.set()` returns the instance, and
`.render(selector)` mounts it. Reach for it when adding a few elements
to an existing page or adapting generated code; prefer the (E, N) pair
for whole pages, because only the pair gets `validate_nodes`, morphs,
prerendering, and the agent surface – imperative code is not validated.

One naming caution: `Text` and `Image` collide with DOM constructor
names. Always use the module import; on a page using the CDN globals,
never assume `window.Text` / `window.Image` are still the DOM's own.
