/*!
 * nodality v1.0.0-beta.56
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";



class Label {
    constructor(){
        this.el = null;
    }
    
    setup(obj){
        var el = document.createElement("div");
        el.style.display = "flex";
        
      
        
         let image = document.createElement("img");
        image.setAttribute("src", obj.image);
        image.style.width = "30";
        image.style.height = "auto";
        el.appendChild(image);
        
        
          let node = document.createElement("p");
        let textNode = document.createTextNode(obj.text);
         el.appendChild(textNode);
        
        this.el = el;
        return this;
    }
   
render(el) {
    if (el) {
        document.querySelector("body").style.margin = 0;
        document.querySelector("body").style.padding = 0;
        document.querySelector(el).appendChild(this.el);
    } else {
        return this.el;
    }
}
    
    
    
    
    
    
    
    
}

export { Label };
