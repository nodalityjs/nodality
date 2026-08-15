/*!
 * nodality v1.1.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class Modal extends Animator {
    constructor(){
		super();
		// Converted from a standalone class. Opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour; opt in per component.
		this._noTheme = true;
        this.el = null;
        this.obj = null;
    }
    
    
    set(obj){
        let el = document.createElement("div");
        el.style.width = "100vw";
        el.style.height = "100vh";
        el.style.backgroundColor = obj.background;//"rgba(70,157,115,0.8)";
        el.style.zIndex = "1";
        el.style.position = "absolute";
        el.style.overflowY = "scroll";
      
       
        this.obj = obj;
        this.res = el;
        obj.close && this.close();
        return this;
    }
    
    
    
    
    close(){
        this.res.style.display = "none";
        return this;
    }
    
    show(){
         this.res.style.display = "block";
        return this;
    }
    
    
    
    add(els){
        
        
        
        
        let el = document.createElement("div");
        el.style.width = this.obj.width; 
        el.style.height = "auto";
        el.style.marginLeft = "auto";
        el.style.marginRight = "auto";
        el.style.backgroundColor = "white";


        let mq = window.matchMedia("(max-device-width: 415px)");
        if (mq.matches){
            el.style.marginTop = "200px";
             el.style.width = "100%";
        }

        
     
     
        
        
            
        
       
        for (var i = 0; i < els.length; i++){
            el.appendChild(els[i].render());
        }
        
        
        
        
          this.res.appendChild(el);
        
        
        
        
        return this;
        
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


export { Modal };
