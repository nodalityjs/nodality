# nodality
Simple UI JS library using node-based approach.

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
import {Des} from "https://www.unpkg.com/nodality@1.0.0-beta.4/dist/index.esm.js";

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
