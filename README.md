# Nodality

This library works with elements represented as an array of HTML entities, and nodes that control the behavior of elements.  
*Elements* is an array of objects. This array produces the code of elements you can use in your website.  
*Nodes* is another array containing nodes that change the look and behavior of the generated elements.  



## Installation

The easiest way to get up and running is to use **npm**:

```bash
npm create nodality@latest my-app
```

---

## Tutorial
## Step 1

Define an array of elements you want to display in your user interface:

```js
let elements = [
  {
    type: "h1",
    text: "Hello"
  }
];
```

---

## Step 2

Define an array of nodes that will adjust the behaviour of the element.  
This particular node will add the **stroked text** effect:

```js
let nodes = [
  {
    op: "blast"
  }
];
```

---

## Step 3

Add the `nodes` array using the `.nodes()` modifier, and use the `.set()` method to mount the result of the code to the website.  
Use the `code: true` option to also display the source code of the elements:

```js
new Des()
  .nodes(nodes)
  .add(elements)
  .set({
    mount: "#mount",
    code: true
  });
```

Also define a `<div>` with `id="#mount"` that will serve as a root element to render the UI.

---

## Everything Together

Here is the complete working code which uses CDN for convenient testing.

```html

<!-- div for mounting the result -->
<div id="#mount"></div>

<script type="module">
import {Des} from "https://www.unpkg.com/nodality@1.1.10/dist/index.esm.js";

let elements = [
  {
    type: "h1",
    text: "Hello"
  }
];

let nodes = [
  {
    op: "blast"
  }
];

new Des()
  .nodes(nodes)
  .add(elements)
  .set({
    mount: "#mount",
    code: true
  });
</script>
```

---

## Result
<img src="https://nodalityjs.github.io/assets/images/image-2601c982f747c8e3977a2d588f61e040.png">

After running this code:

- You will see an `<h1>` element on the screen.
- When the user resizes the window and hits the **400–600px** breakpoint, a **stroke effect** will appear on the text, thanks to the `blast` modifier.
- The **resulting code** of the UI will also be displayed below the rendered element.

---

## Effects on live elements

Nodes are not limited to design changes. A raster node compiles to a GPU
shader pass over the element it targets, and several nodes aimed at one
element compose into a **single** pass, in array order:

```js
const nodes = [
  { op: "dither", target: ["hero"], levels: 6, size: 2 },
  { op: "flow",   target: ["hero"], by: "mouse" },
];
```

The source is your live DOM, not an image you exported. Two capture
backends sit underneath: a snapshot path that works in any WebGL browser,
and an HTML-in-Canvas path that samples the running element directly
where the browser supports it. The choice is automatic — if the newer API
is absent the pipeline falls back rather than failing.

Effects do not cost you interaction. Pointer input is resolved through
the inverse of the compiled transformation and re-dispatched, so links
and buttons under an effect still work — including where the content is
hosted inside the canvas and the browser's own hit testing cannot reach
it.

## Transitions as data

A `morph` node says which element becomes which, and on what interaction.
There is no timeline to drive and no capture to manage:

```js
const nodes = [
  { op: "morph", from: "topnav",
    to: { About: "about", Services: "offer", Contact: "contact" },
    effect: "t-vhs", duration: 900, back: true },
];
```

`from` and `to` name ids in your elements array; `back: true` wires the
destination's own button to return. Mapping is by link label rather than
position, because a responsive nav renders a different set of links per
breakpoint.

## For AI agents

`nodality mcp` runs a Model Context Protocol server over stdio, so an
agent can write interfaces against the real vocabulary instead of
guessing at it:

```json
{ "mcpServers": { "nodality": { "command": "npx", "args": ["nodality", "mcp"] } } }
```

Three tools: `list_ops` returns the op registry as data — every op with
its stage, parameters, units, defaults; `validate_nodes` checks a node
array and returns a machine-readable report with did-you-mean
suggestions, so `{ op: "dithr" }` comes back as `UNKNOWN_OP` suggesting
`dither` rather than rendering nothing at all; `preview` renders an
`(E, N)` pair to a self-contained HTML file. `preview` needs `jsdom` in
your project (`npm i -D jsdom`) — it is required only for prerendering,
so the library does not bundle it.

The same validator is available directly:

```js
import { validateNodes, describeOps } from "nodality/validate";
```
