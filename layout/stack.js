/*!
 * nodality v1.5.10
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
import { optionsSource } from "./element-kit.js";
class Stack extends Animator {
    constructor(st){
		super();
		// Converted from a standalone class. Opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour; opt in per component.
		this._noTheme = true;
       this.res = null;

     this.st = st;
    }
    
    setup(){
        let grid = document.createElement("div");
        grid.style.display = "grid";
        this.res = grid;

        if (this.st){
            this.sticky();
           }


        return this;
    }
    
    set(obj){
        this.options = obj || {};
        this.setup();
        obj.height && (this.res.style.height = obj.height);
        obj.sticky && this.sticky();
        return this;
    }

    sticky(){
        this.res.style.position = "sticky";
        this.res.style.top = 0;
        return this;
    }

    add(els){
        this.children = els;
        this._adopt(els); // destroy() releases the children too
        for (var i = 0; i < els.length; i++){
            let el = els[i].render();
            el.style.gridColumn = 1;
            el.style.gridRow = 1;
            this.res.appendChild(el);
        }
        
        
        return this;
    }   

    toCode() {
        // Every option the stack was given — height, sticky, resprop and the
        // behaviour options (reveal, pin, …) the base class applies. It used
        // to write `set({id})` only, so the code panel and the code Des runs
        // lost all of them.
        let code = `new Stack(${this.st ? "true" : ""}).set(${optionsSource(this.options || {})})`;
        
        // Add child elements
        if (Array.isArray(this.children) && this.children.length > 0) {
            const childrenCode = this.children.map(child => child.toCode()).join(",\n");
            code += `.add([\n \n ${childrenCode} \n \n])`;
        }
        
        // Return the final code
        return [code];
    }
   
render(el) {
    if (el) {
        document.querySelector("body").style.margin = 0;
        document.querySelector("body").style.padding = 0;
        document.querySelector(el).appendChild(this.res);
    } else {
        return this.res;
    }
}
}



export { Stack };
