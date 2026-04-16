import {Animator} from "./animator.js";

class /*Multi*/Switcher extends Animator {
  constructor(/*it*/) {
    super();
    this.breakpoints = [];
    this.container = null;
    this.currentView = null;
    this.internalDiv = null;
    this.resizeListener = null;
   // this.internalID = it;
  }

  set({ breakpoints }) {

    this.options = {breakpoints: breakpoints};

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
    //  return ["new Text('A').set({})"];
      const objStringa = JSON.stringify(this.options.breakpoints.map(o => o.view.toCode()).flat(), null,4);
      const objStringas = JSON.stringify(this.options.breakpoints.map(o => o.at), null,4);

      const objString = JSON.stringify(this.options.breakpoints, null,4);
      // console.log("OMHELLOA");
      // console.log(this.options);
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

/*
  render(selector) {
  alert(selector); // undefined


    this.container = document.querySelector(selector);

  //  if (!this.container) { // Why does this condition fire???
   //   alert("APPLY MOUNt"); // undefined
      this.container = document.querySelector(this.internalID "#mount");
    //  throw new Error(`No element found matching selector: ${selector}`);
   // }

    // Create an internal div for switching content
    this.internalDiv = document.createElement("div");
    this.container.appendChild(this.internalDiv);

    this.applyView();

    this.resizeListener = this.applyView.bind(this);
    window.addEventListener("resize", this.resizeListener);

    return this.container;
  }*/

    render(val) {
      //alert(val)
      // Create an internal div for switching content
      this.internalDiv = document.createElement("div");
    
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
    console.log("MAKE RANGES"); // 23:45:30 Thanks GPT!!!!
    
    const width = window.innerWidth;
    console.log(this.breakpoints);
    console.log(this.breakpoints.map(el => el.at));

    let rstart = this.breakpoints.map(el => el.at);

    let mapped = this.breakpoints.map(el => el.at);
    let transformed = this.createRanges(mapped);
    let added = this.addRanges(this.breakpoints, rstart);
    console.log(added);


    added.forEach(r => {
      const query = `(min-width: ${r.range.from}px) and (max-width: ${r.range.to}px)`;
      const mediaQuery = window.matchMedia(query);
  
      console.warn(query);
      if (mediaQuery.matches) {
          console.log(`Viewport width is within the range: ${r.range.from}px to ${r.range.to}px`);
          // Add your logic for this range
     
     

          if (this.currentView !== r.view.render()) {
            this.internalDiv.innerHTML = "";
            this.internalDiv.appendChild(r.view.render());
            this.currentView = r.view.render();
          }
     
     
        }
  });



  //  if (window.matchMedia("(max-width"))
    
   /* const matchingBreakpoint = this.breakpoints.reduce((prev, current) => {
      return width >= current.at ? current : prev;
    }, this.breakpoints[0]);*/

  //  console.log("MB");
  //  console.log(matchingBreakpoint);


//const width = window.innerWidth || document.documentElement.clientWidth;
console.log("MBO");
// Ensure `breakpoints` array is structured correctly
/*this.breakpoints = [
    { at: 0, view: "mobileView" },
    { at: 1200, view: "desktopView" }
];*/

// Find the matching breakpoint
/*const matchingBreakpoint = this.breakpoints.reduce((prev, current) => {
    return width >= current.at ? current : prev;
}, this.breakpoints[0]);
*/
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

/*
// Example usage:
const switcher = new MultiSwitcher()
  .set({
    breakpoints: [
      { at: "0px", view: Object.assign(document.createElement("h1"), { textContent: "Small View" }) },
      { at: "700px", view: Object.assign(document.createElement("h1"), { textContent: "Medium View" }) },
      { at: "800px", view: Object.assign(document.createElement("h1"), { textContent: "Large View" }) },
    ],
  })
  .render("#myDiv");
*/
export { /*Multi*/Switcher };
