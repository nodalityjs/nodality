/*!
 * nodality v1.1.15
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class AreaSwitcher extends Animator{
    constructor() {
		super();
		// Converted from a standalone class; opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour.
		this._noTheme = true;
      
      this.gridContainer = document.createElement("div");
      this.gridContainer.classList.add("grid-container");
      this.gridContainer.style.display = "grid";
    }

    set(obj){
      obj.gap &&  (this.gridContainer.style.gap = obj.gap);
      obj.height && (this.gridContainer.style.height = obj.height);
      obj.width && (this.gridContainer.style.width = obj.width);
      return this;
    }

    /*
    [
                   {
                     at: "default",
                     template: [
                     "abbbbb",
                     "abbbbb",
                     "abbbbb",
                     "cccccc",
                     "cccccc",
                     "dddddd",
                     "eeeeee",
                     "eeeeee"
                   ] 
                   },
    */
    react(arr){
      const reacta = () => {
for (var i = 0; i < arr.length - 1; i++){
 // alert(parseInt(arr[i].at))
 //console.warn("BETWEEN" + parseInt(arr[i].at) + " - " + parseInt(arr[i + 1].at) );

 let from = parseInt(arr[i].at);
 let to = parseInt(arr[i + 1].at);


  if ( window.innerWidth > from && window.innerWidth < to ){
//alert("O")
    let obj = arr[i].template;

     let withSpaceObj = obj.map(str => str.split('').join(' '));
     const outputString = withSpaceObj.map(row => `"${row}"`).join(" ");
     this.gridContainer.style.gridTemplateAreas = outputString;
 
 
    } else if (window.innerWidth > to) {
      //alert("P")
      // This always fires
      let obj = arr[arr.length - 1].template;

      let withSpaceObj = obj.map(str => str.split('').join(' '));
      const outputString = withSpaceObj.map(row => `"${row}"`).join(" ");
      this.gridContainer.style.gridTemplateAreas = outputString;
  
    }


}
      }
      reacta();
     window.addEventListener("resize", reacta);
     return this;
    }
  
     add(items){
  
     // Function to generate alphabetic sequences
  const generateAlphabeticSequence = (count) => {
    const chars = [];
    for (let i = 0; i < count; i++) {
      let str = '';
      let num = i;
      do {
        str = String.fromCharCode(65 + (num % 26)) + str; // Generate character
        num = Math.floor(num / 26) - 1;
      } while (num >= 0);
      chars.push(str);
    }
    return chars;
  };

  // Generate 'els' array dynamically
  let els = generateAlphabeticSequence(items.length); // ['A', 'B', ..., 'Z', 'AA', 'AB', ...]

  for (let i = 0; i < items.length; i++) {
    let e = items[i].render();
    e.style.gridArea = els[i].toLowerCase(); // e.g., 'a', 'b', 'aa', 'ab', ...

    const gridItem = document.createElement("div");
    gridItem.textContent = items[i].text;
    gridItem.style.gridArea = els[i].toLowerCase();
    this.gridContainer.appendChild(e);
  }
  
    return this;
     }


     render(el) {
      el && document.querySelector(el).appendChild(this.gridContainer);
      return this.gridContainer;
    }

      toCode(){
      return `new Simple().set({}).react([])`;
    }
  }
  
  // Usage example:
  
  
  class GridSwitcher extends Animator{
    constructor(){
		super();
		// Converted from a standalone class; opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour.
		this._noTheme = true;
     this.res = document.createElement("div");
     this.gridWrap = document.createElement("div");
    }


  
    items(arr){
      this.items = arr;
      return this;
    }


    switch(breakpoints){
      const innerSwitch = () => {
          for (let i = 0; i < breakpoints.length; i++){
              const val = breakpoints[i];
              let mq = window.matchMedia(`(max-width: ${val.at})`).matches;
              if ((mq || val.at == "default") && mq !== this.lastMq){
                  const update = new Simple().set(val.template, this.dynamicItems).render();
                  this.res = update;
                  this.render(this.domStr);
                  this.lastMq = mq;
              }
          }
      }
      innerSwitch();
      window.addEventListener("resize", innerSwitch);
      return this;
  }
  
    render(div){
      this.gridWrap.innerHTML = "";
      this.gridWrap.appendChild(this.res);

  if (div){
    document.querySelector(div).appendChild(this.gridWrap);
  } 

  return this.gridWrap;

      // Just return this.res it normally
    }
  }
  
  export {AreaSwitcher};
