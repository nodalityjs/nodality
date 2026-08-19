# Nodality API reference

Generated from the documentation site — do not edit by hand.
Run `node scripts/generate-llms.mjs` in the docs repo to refresh.

This file ships inside the npm package so that a coding agent reading
`node_modules/nodality/` has the API to hand without fetching a website.

## The shape of everything

```js
import { Des } from "nodality";

const elements = [
  { type: "h1", text: "Hello" }   // elements take `text`, never `value`
];

const nodes = [
  { op: "blast" }                 // nodes carry an `op`
];

new Des()
  .nodes(nodes)
  .add(elements)
  .set({ mount: "#mount" });
```

Full documentation: https://nodalityjs.github.io
Machine-readable index: https://nodalityjs.github.io/llms.txt

## Pages

### api

- **Button** — `button.js`
  https://nodalityjs.github.io/docs/api/button
- **Center** — `center.js`
  https://nodalityjs.github.io/docs/api/center
- **FlexGrid** — `flex-grid.js`
  https://nodalityjs.github.io/docs/api/flexgrid
- **FlexRow** — `flex-row.js`
  https://nodalityjs.github.io/docs/api/flexrow
- **Image** — `image.js`
  https://nodalityjs.github.io/docs/api/image
- **Link** — `link.js`
  https://nodalityjs.github.io/docs/api/link
- **Picker** — `picker.js`
  https://nodalityjs.github.io/docs/api/picker
- **Text** — `text.js`
  https://nodalityjs.github.io/docs/api/text
- **TextField** — `text-field.js`
  https://nodalityjs.github.io/docs/api/textfield
- **UList** — `ulist.js`
  https://nodalityjs.github.io/docs/api/ulist
- **Wrapper** — `container.js`
  https://nodalityjs.github.io/docs/api/wrapper

### basics

- **Basics** — This library employs an unique approach to building static websites using declarative UI components and nodes that will style them.
  https://nodalityjs.github.io/docs/basics/README
- **Animation** — Create striking animations using JS responsive API.
  https://nodalityjs.github.io/docs/basics/animation
- **CDN** — To use Nodality with CDN, use this code:
  https://nodalityjs.github.io/docs/basics/cdn
- **Custom elements** — To create a custom element using Nodality library, you extend the  class.
  https://nodalityjs.github.io/docs/basics/customElements
- **Designer** — Designer instance accepts nodes and elements arrays.
  https://nodalityjs.github.io/docs/basics/designer
- **Nodes** — Nodes allow you to simply you to modify the elements.
  https://nodalityjs.github.io/docs/basics/nodes
- **Getting started** — This library works with *elements* represented as an array of HTML entities, and *nodes* that control the behavior of elements.
  https://nodalityjs.github.io/docs/basics/start

### elements

- **Card** — Create  elements containing ,  and  elements.
  https://nodalityjs.github.io/docs/elements/cards
- **Circle** — You can use the  element to display a simple circle.
  https://nodalityjs.github.io/docs/elements/circle
- **Code** — You can use the  element to display a block of code.
  https://nodalityjs.github.io/docs/elements/code
- **Dropdown** — Dropdown is used to create expand area upon click or hover.
  https://nodalityjs.github.io/docs/elements/dropdown
- **Free** — Create free alement to use in conjuction with [Layout](/library/nodes/layout) node.
  https://nodalityjs.github.io/docs/elements/free
- **AreaGrid** — The `grid` creates an instance of the `AreaGrid` element, designed to organize child elements in a grid layout.
  https://nodalityjs.github.io/docs/elements/grid
- **HScroller** — You can use the  to make a horizontally scrolling gallery.
  https://nodalityjs.github.io/docs/elements/hscroller
- **Image** — Image allows you to create simple image
  https://nodalityjs.github.io/docs/elements/image
- **Keyset** — Keyset allows you to set custom CSS properties on elements.
  https://nodalityjs.github.io/docs/elements/keyset
- **Link** — To create a simple link use the following element.
  https://nodalityjs.github.io/docs/elements/link
- **Modal** — To create a simple modal.
  https://nodalityjs.github.io/docs/elements/modal
- **Navigation** — To create a simple navigation use  element
  https://nodalityjs.github.io/docs/elements/navigation
- **Offcanvas** — To create a simple navigation use  element.
  https://nodalityjs.github.io/docs/elements/offcanvas
- **Polygon** — You can use the  element to display a block of code.
  https://nodalityjs.github.io/docs/elements/polygon
- **Elements** — Elements are used to create UI.
  https://nodalityjs.github.io/docs/elements/readme
- **Responsive wrapper** — The `Wrapper` class allows you to create a responsive element that can dynamically switch its layout between row and column orientations based on specified…
  https://nodalityjs.github.io/docs/elements/responsive-wrapper
- **Complex** — The `Wrapper` class allows you to create a responsive element that can dynamically switch its layout between row and column orientations based on specified…
  https://nodalityjs.github.io/docs/elements/responsive
- **Row** — Row creates a simple  element to allow you to organise children in a row.
  https://nodalityjs.github.io/docs/elements/row
- **SideNavigation** — To create side navigation use the  structure.
  https://nodalityjs.github.io/docs/elements/sidenavigation
- **Slider** — To create a simple slider, use  structure
  https://nodalityjs.github.io/docs/elements/slider
- **Stack** — To create a simple stack, use  object.
  https://nodalityjs.github.io/docs/elements/stack
- **Switcher** — Switcher allows you to display different views at different breakpoints.
  https://nodalityjs.github.io/docs/elements/switcher
- **Table** — To create a simple modal.
  https://nodalityjs.github.io/docs/elements/table
- **Text** — Headers are used to display text.
  https://nodalityjs.github.io/docs/elements/text
- **UList** — You can use the  element to display a list of items.
  https://nodalityjs.github.io/docs/elements/ulist
- **WeightLayout** — WeightLayout allows you to create flexible layout using attraction weights inside  element.
  https://nodalityjs.github.io/docs/elements/weightLayout
- **Wrap** — Creates a simple wrapper that wraps other elements.
  https://nodalityjs.github.io/docs/elements/wrap
- **ZoomCard** — To use image as background for the entire card use the  element with a background.
  https://nodalityjs.github.io/docs/elements/zoom-card

### forms

- **Button** — Creates a simple button.
  https://nodalityjs.github.io/docs/forms/button
- **Checkbox** — A checkbox is used to to select a single option, akin to answering yes or no.
  https://nodalityjs.github.io/docs/forms/checkbox
- **Complex form** — In this example, the complete form will be shown.
  https://nodalityjs.github.io/docs/forms/complex-form
- **FilePicker** — Creates a simple filepicker.
  https://nodalityjs.github.io/docs/forms/filepicker
- **LabelField** — LabelField allows you to create textfield that turns placeholder text into a label.
  https://nodalityjs.github.io/docs/forms/labelfield
- **Picker** — To create the picker, use the the  delcaration in the elements array.
  https://nodalityjs.github.io/docs/forms/picker
- **Radio** — The `radio` element creates a group of radio buttons for user selection.
  https://nodalityjs.github.io/docs/forms/radio
- **Basics** — You can create forms easily with this library.
  https://nodalityjs.github.io/docs/forms/readme
- **TextField** — To create a simple textfield, use the  element.
  https://nodalityjs.github.io/docs/forms/textfield
- **Usage with PHP** — You can use the form with PHP.
  https://nodalityjs.github.io/docs/forms/usewithphp

### guides

- **Guides** — Guides provide simple cookbooks.
  https://nodalityjs.github.io/docs/guides/README
- **Deploy** — To deploy your project, first create new Nodality application by running the following command:
  https://nodalityjs.github.io/docs/guides/deploy
- **Integration** — You can easily integrate this library with React.js and Vue.js libraries.
  https://nodalityjs.github.io/docs/guides/integration
- **Testing** — Nodality uses Playwright for testing.
  https://nodalityjs.github.io/docs/guides/testing
- **Tooling** — Create Nodality package allows you to quickly bootstrap a new Nodality application.
  https://nodalityjs.github.io/docs/guides/tooling
- **Transitions** — This library supports the **CSS View Transition API** to enable smooth animations when navigating between pages.\ For example, you can build a carousel where…
  https://nodalityjs.github.io/docs/guides/transitions

### nodes

- **Animation** — Animation allows you to animate elements.
  https://nodalityjs.github.io/docs/nodes/animation
- **Blast** — Blast allows user to create outline around element contents.
  https://nodalityjs.github.io/docs/nodes/blast
- **Copy** — To use the copy operation, we use these nodes:
  https://nodalityjs.github.io/docs/nodes/copy
- **Filter** — To use the filter, we use this:
  https://nodalityjs.github.io/docs/nodes/filter
- **Gradient** — To add gradient to an element, use the following object:
  https://nodalityjs.github.io/docs/nodes/gradient
- **Layout** — To quickly generate common layout variation, we can use the following:
  https://nodalityjs.github.io/docs/nodes/layout
- **LinkStyle** — Link style operation allows you to style links ( elements.).
  https://nodalityjs.github.io/docs/nodes/linkStyle
- **Nodes** — Nodes allow you to edit design of the elements.
  https://nodalityjs.github.io/docs/nodes/nodes
- **Nodes** — Nodes modify beahaviour of the elements.
  https://nodalityjs.github.io/docs/nodes/readme
- **Shadow** — To use the default shadow, we use the  op.
  https://nodalityjs.github.io/docs/nodes/shadow
- **Span** — Span is a part of text that can have different contents and design from the rest of your text.
  https://nodalityjs.github.io/docs/nodes/span
- **Transform** — To use the filter, we use this node:
  https://nodalityjs.github.io/docs/nodes/transform

### raster

- **Agent surface – the page, as tools** — An `agent-surface` node lets an AI agent operate the page: move between morph views, submit a form you have allowed, and read what is on screen.
  https://nodalityjs.github.io/docs/raster/agent-surface
- **Raster basics** — Raster ops run your element through a WebGL shader.
  https://nodalityjs.github.io/docs/raster/basics
- **Composing a pipeline** — A chain is not a list of passes.
  https://nodalityjs.github.io/docs/raster/composition
- **Morph – transitions as nodes** — A morph node describes which element *becomes* which, and on what interaction.
  https://nodalityjs.github.io/docs/raster/morph
- **Raster ops** — Every node has an `op` and a set of options.
  https://nodalityjs.github.io/docs/raster/ops

### scrollanimation

- **Basics** — To create smooth scroll animations you can use the following:
  https://nodalityjs.github.io/docs/scrollanimation/basics
- **Scroll Animation** — Create engaging scroll animation Continue to [Basics](basics.md) to get started.
  https://nodalityjs.github.io/docs/scrollanimation/index
- **ScrollVideo** — Play video as you scroll.
  https://nodalityjs.github.io/docs/scrollanimation/scrollvideo
- **Together** — Here is how you can combine the elements using the  element.
  https://nodalityjs.github.io/docs/scrollanimation/together
- **TransformAnimation** — Transform element as you scroll down.
  https://nodalityjs.github.io/docs/scrollanimation/transformanimation

### ssg

- **Prerender API** — The CLI covers the common case.
  https://nodalityjs.github.io/docs/ssg/api
- **Prerendering** — Nodality builds your page in the browser.
  https://nodalityjs.github.io/docs/ssg/prerender

