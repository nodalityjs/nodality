/*!
 * nodality v1.1.7
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

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
str += `{ at: "${this.options.breakpoints[i].at}", view: ${this.options.breakpoints[i].view.toCode()} }, \n` }

   //   console.log(str);

      return [`new Switcher().set({
        breakpoints: [
        ${str}
        ]
      })`];
  }


    render(val) {
      //alert(val)
      // Create an internal div for switching content
      this.internalDiv = document.createElement("div");
      this.res = this.internalDiv;
      if (this._id) this.internalDiv.setAttribute("id", this._id);
      if (this._area) this.internalDiv.style.gridArea = this._area;

      // Apply the initial view
      this.applyView();
    
      // Set up the resize listener to update views dynamically
      this.resizeListener = this.applyView.bind(this);
      window.addEventListener("resize", this.resizeListener);
    

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

  applyView() {

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
    if (this.resizeListener) {
      window.removeEventListener("resize", this.resizeListener);
      this.resizeListener = null;
    }
    if (this.internalDiv && this.container) {
      this.container.removeChild(this.internalDiv);
    }
    this.container = null;
    this.currentView = null;
    this.internalDiv = null;
  }
}

export { /*Multi*/Switcher };
