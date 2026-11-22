import {Animator} from "./animator.js";

import { jsString } from "../lib/codegen.js";
class /*Multi*/Switcher extends Animator {
  constructor(/*it*/) {
    super();
    this.breakpoints = [];
    this.container = null;
    this.currentView = null;
    this.internalDiv = null;
    this.resizeListener = null;
  }

  //@ id: DOM id for the switcher's own box. The views are swapped in and out, so an id belongs here rather than on a view that may not be mounted.
  //@ area: The switcher's grid-area — the name of a cell declared in the parent's `areas`. It goes here because the switcher's box IS the grid item; the views live inside it, so an area set on a view would never reach the grid.
  set({ breakpoints, id, area }) {

    this.options = {breakpoints: breakpoints};
    // Applied in render(): the box does not exist until then.
    this._id = id;
    this._area = area;

    if (!Array.isArray(breakpoints)) {
      throw new Error("Breakpoints should be an array of objects with 'at' and 'view' properties.");
    }

    this.breakpoints = breakpoints.map(bp => {
      if (typeof bp.at !== "string" || !(bp.view.render() instanceof HTMLElement)) {
        throw new Error("Each breakpoint must have 'at' as a string and 'view' as an HTMLElement.");
      }
      return { ...bp, at: parseInt(bp.at, 10) };
    });

    this.breakpoints.sort((a, b) => a.at - b.at);
    return this;
  }


  toCode() {
      const objStringa = JSON.stringify(this.options.breakpoints.map(o => o.view.toCode()).flat(), null,4);
      const objStringas = JSON.stringify(this.options.breakpoints.map(o => o.at), null,4);

      const objString = JSON.stringify(this.options.breakpoints, null,4);
      // console.log("OMHELLOA");
      // console.log(objStringa);
      // console.log(objStringas);


      let str = "";
      for (var i = 0; i < this.options.breakpoints.length; i++){
str += `{ at: ${jsString(this.options.breakpoints[i].at)}, view: ${this.options.breakpoints[i].view.toCode()} }, \n` }

   //   console.log(str);

      // The id is applied in render(), but only if the generated code carries
      // it — and this used to leave it out, so every nav, sideNav and
      // multiswitcher rendered without the id its element declared.
      const idLine = this._id ? `\n        id: ${JSON.stringify(String(this._id))},` : "";
      return [`new Switcher().set({${idLine}
        breakpoints: [
        ${str}
        ]
      })`];
  }


    render(val) {
      // A second render mounts the box the first one built. Building a new
      // box each call left it empty: applyView() saw its view as already
      // current and appended nothing, and every call added another resize
      // listener. Des renders a component once and mounts it later.
      if (this.internalDiv) {
        if (val !== undefined) document.querySelector(val).appendChild(this.internalDiv);
        return this.internalDiv;
      }
      // Create an internal div for switching content
      this.internalDiv = document.createElement("div");
      this.res = this.internalDiv;
      if (this._id) this.internalDiv.setAttribute("id", this._id);
      if (this._area) this.internalDiv.style.gridArea = this._area;

      // Apply the initial view
      this.applyView();
    
      // Set up the resize listener to update views dynamically
      this.resizeListener = this.applyView.bind(this);
      this._on(window, "resize", this.resizeListener);
    

      if (val !== undefined){ // 18/01/2025 13:10:11 Yes!!!
        document.querySelector(val).appendChild(this.internalDiv);
      }
      // Return the internal div so it can be mounted manually
      return this.internalDiv;
    }
    

    createRanges(array, max = 99999) {
      let ranges = [];
      for (let i = 0; i < array.length; i++) {
          ranges.push({
              from: array[i],
              to: (i < array.length - 1 ? array[i + 1] - 1 : max)
          });
      }
      return ranges;
  }

  addRanges(objects, rangeStarts, max = 99999) {
    return objects.map((obj, index) => {
        const from = rangeStarts[index];
        const to = index < rangeStarts.length - 1 ? rangeStarts[index + 1] - 1 : max;
        return { 
            ...obj, 
            range: { from, to }
        };
    });
}

  /**
   * Prerender: the saved HTML is rendered at ONE width, so with one view in
   * it a desktop visitor saw the phone view (a nav's hamburger) until the
   * page hydrated and swapped it — a flash. Every view goes into the saved
   * HTML instead, each hidden outside its own width range by an @media rule
   * outside its own width range by a data-nod-sw marker and its range
   * (collected with resprop's values; layout/prerender.js writes them into
   * the page as a small inline script that shows the right view while the
   * page parses — no stylesheet). Without JavaScript the view this render
   * matched shows: the others are saved with display:none. The live page
   * renders one view as always; its elements carry no marker.
   * An id repeated across views is kept on the view this render matched
   * and dropped from the others, so the saved HTML has no duplicate ids.
   */
  _prerenderAllViews() {
    const store = window.__NODALITY_PRERENDER_RULES__ || (window.__NODALITY_PRERENDER_RULES__ = []);
    const n = (window.__NODALITY_SW_N__ = (window.__NODALITY_SW_N__ || 0) + 1);
    const added = this.addRanges(this.breakpoints, this.breakpoints.map((b) => b.at));
    const width = window.innerWidth || 0;
    this.internalDiv.innerHTML = "";
    const roots = added.map((r, i) => {
      const el = r.view.render();
      el.setAttribute("data-nod-sw", `${n}-${i}`);
      store.push({ sw: `${n}-${i}`, lo: r.range.from > 0 ? r.range.from : 0,
        hi: r.range.to < 99999 ? r.range.to : null, display: el.style.display || "" });
      this.internalDiv.appendChild(el);
      return { el, current: width >= r.range.from && width <= r.range.to };
    });
    const primary = roots.find((r) => r.current) || roots[roots.length - 1];
    if (!primary) return;
    for (const r of roots) if (r !== primary) r.el.style.display = "none";
    this.currentView = primary.el;
    const keep = new Set([...primary.el.querySelectorAll("[id]")].map((e) => e.id));
    if (primary.el.id) keep.add(primary.el.id);
    for (const r of roots) {
      if (r === primary) continue;
      for (const e of [r.el, ...r.el.querySelectorAll("[id]")]) if (e.id && keep.has(e.id)) e.removeAttribute("id");
    }
  }

  applyView() {
    if (typeof window !== "undefined" && window.__NODALITY_PRERENDER__ && this.internalDiv) {
      if (!this.internalDiv.hasAttribute("data-nod-sw-all")) {
        this.internalDiv.setAttribute("data-nod-sw-all", "");
        this._prerenderAllViews();
      }
      return;
    }

    // No matchMedia at all (a bare jsdom — the prerenderer installs its own,
    // other hosts may not): show the widest view rather than an empty box.
    // The browser re-runs this with real queries when it rebuilds the page.
    if (typeof window.matchMedia !== "function") {
      const widest = this.breakpoints.reduce((a, b) => (parseFloat(b.at) > parseFloat(a.at) ? b : a), this.breakpoints[0]);
      if (widest && this.currentView !== widest.view.render()) {
        this.internalDiv.innerHTML = "";
        this.internalDiv.appendChild(widest.view.render());
        this.currentView = widest.view.render();
      }
      return;
    }

// check if we are in range

    const width = window.innerWidth;

    let rstart = this.breakpoints.map(el => el.at);

    let mapped = this.breakpoints.map(el => el.at);
    let transformed = this.createRanges(mapped);
    let added = this.addRanges(this.breakpoints, rstart);


    added.forEach(r => {
      const query = `(min-width: ${r.range.from}px) and (max-width: ${r.range.to}px)`;
      const mediaQuery = window.matchMedia(query);
  
      if (mediaQuery.matches) {
          // Add your logic for this range
     
     

          if (this.currentView !== r.view.render()) {
            this.internalDiv.innerHTML = "";
            this.internalDiv.appendChild(r.view.render());
            this.currentView = r.view.render();
          }
     
     
        }
  });


  //  if (window.matchMedia("(max-width"))
    

  //  console.log("MB");
  //  console.log(matchingBreakpoint);


// Ensure `breakpoints` array is structured correctly

// Find the matching breakpoint
//console.log(matchingBreakpoint);


 
  }

  destroy() {
    super.destroy();
    this.resizeListener = null;
    if (this.internalDiv && this.container) {
      this.container.removeChild(this.internalDiv);
    }
    this.container = null;
    this.currentView = null;
    this.internalDiv = null;
  }
}

export { /*Multi*/Switcher };
