/*!
 * nodality v1.2.5
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
  
      let area = document.createElement("textarea");
      area.style.fontWeight = "bold";
      area.style.height = 1000;
      area.style.width = 1000;
  
  
  
     /* te.value = te.value.replace(".mount('#mount');,", ".mount('#mount');");
      te.value = te.value.replace(" ,new Wrapper", "new Wrapper");
  */
  
  this.codeArr  = [...this.code];
  
     this.code =  this.code.toString().replaceAll(", .", ".")
     .replaceAll(",.", ".")
     .replaceAll(",,.", ".")
     .replaceAll("{,", "{")
     .replaceAll("[,", "[")
     .replace(/,+/g, ',');
  
      area.value = this.code;
      document.body.appendChild(area);
  
     
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
   
    const innerSwitch = () => {


  // alert("LK")


this.res.innerHTML = "";
   // this.code.push(` \n .switchElements()`)
    let mq = window.matchMedia(`(max-width: ${this.obj.breakpoint})`).matches;

    if (mq){
    //  alert("O")
    
      this.res.appendChild(this.obj.first.render());
    } else {
    
      this.res.appendChild(this.obj.second.render());
    }
  }

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
