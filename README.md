# nodality
Simple UI JS library using node-based approach.

## Installation

The easiest way to get up and running is to use **npm**:

```bash
npm create nodality@latest my-app
```

---

## Tutorial

### Step 1: Array of Elements

Define an array of elements you want to display in your user interface:

```javascript
let elements = [
  {
    type: "h1",
    text: "Hello"
  }
];
```

### Step 2: Array of Nodes

Define an array of nodes that will adjust the behavior of the element.  
This node adds a stroked text effect:

```javascript
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
```

### Step 3: Result

Mount the result of the code to the website and display it:

```javascript
new Text("Hello")
  .set({
    index: "0",
    fluidc: "S1",
    font: "Arial",
    stroke: { 
      op: {
        name: "blast", 
        color: "green",
        width: "1px"
      } 
    },
  })
  .render("#mount");
```

---

## Use the Result

```html
<div id="#mount"></div>

<script>
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
