/*!
 * nodality v1.3.23
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class Switcher extends Animator {
    constructor(obj){
		super();
		// Converted from a standalone class. Opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour; opt in per component.
		this._noTheme = true;
      this.res = null;
      this.obj = obj;
      this.code = [];

      if (obj.first.toCode && obj.second.toCode){

      
          this.code.push(`, new Switcher({breakpoint: "${this.obj.breakpoint}", first: ${this.obj.first.toCode()}, second: ${this.obj.second.toCode()}})`);
     
      }
  
      // (A debug <textarea> holding the generated code used to be appended
      // to the page body here, visible on every page that used this.)

  this.codeArr  = [...this.code];
  
     this.code =  this.code.toString().replaceAll(", .", ".")
     .replaceAll(",.", ".")
     .replaceAll(",,.", ".")
     .replaceAll("{,", "{")
     .replaceAll("[,", "[")
     .replace(/,+/g, ',');
  
  
     
      /* {
        breakpoint: 700px,
        first: element,
        second: element,
  
      }*/
  
     this.switchElements();
    }
  
   
  switchElements(){


    this.res = document.createElement("div"); // move out of the loop
    // 17:27:15 29/09/23
   
    // Rebuild only when the matched view CHANGES. This emptied the box and
    // rendered the view again on every resize event, and on a phone the
    // address bar fires one per scroll gesture: the content was torn down
    // and put back (a flash), losing focus, scroll and a playing video.
    let current = null;
    const innerSwitch = () => {
      const mq = window.matchMedia(`(max-width: ${this.obj.breakpoint})`).matches;
      const view = mq ? this.obj.first : this.obj.second;
      if (view === current) return;
      current = view;
      this.res.innerHTML = "";
      this.res.appendChild(view.render());
    };

  innerSwitch();

  window.addEventListener("resize", innerSwitch);
  // 17:30:22 Nice


  }
  
    toCode(){
     // alert("IO0")
      return this.codeArr;
    }
  
  
    render(div){
       document.querySelector(div).appendChild(this.res);
      return this.res;
    }
  }
export { Switcher };
