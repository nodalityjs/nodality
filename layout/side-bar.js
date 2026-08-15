/*!
 * nodality v1.1.10
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class SideBar extends Animator{
	constructor(els, obj){
		super();
		// Converted from a standalone class; opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour.
		this._noTheme = true;
		this.res = null;
        this.width = "16em";
        this.height = "100vh";
        
        this.els = els;
       
		
		
	}
	
    
    

    
   
    
	setup(obj){
        
        
        obj.tags && super.setTags(obj.tags);
        
        if (obj.width){
            this.width = obj.width;
        }
        
         if (obj.height){
            this.height = obj.height;
        }
        
        
       
        
        let outer = document.createElement("div");
       
        outer.style.position = "absolute";
        
        let btn = document.createElement("button");
        btn.style.position = "absolute";
        btn.style.background = "white";
        btn.style.opacity = 0.80;
        btn.style.border = "none";
        btn.width = "1.5em";
        btn.height = "1.5em";
        btn.style.borderRadius = "50%";
        btn.style.zIndex = 2;
        
        
        
        
      
        
        let node = document.createTextNode("☰");
        btn.appendChild(node);
        
        
         btn.style.fontSize = "2em";
        
        if (window.matchMedia("(max-device-width: 400px)").matches){
             btn.style.fontSize = "6em";
        }
        
        
         if (window.matchMedia("(max-device-width: 400px)").matches){
            
        
         if (obj.fullMobile){
            this.width = "100vw";
        }  
     }
        
        outer.appendChild(btn);
        
        
        
		let el = document.createElement("div");
        
        el.style.position = "absolute";
		el.style.backgroundColor = "#fff";
        el.style.flexDirection = "column";
		el.style.display = "flex";
		el.style.alignItems = "center";
		el.style.margin = 0;
        
        
		el.style.padding = 0;
		el.style.width = this.width;  //"16em";
        
		//-------------DEFAULT STYLING----------
		el.style.margin = 0;
         el.style.marginTop = "-10px";
		el.style.paddingTop = "1em";
		el.style.paddingBottom = "1em";
        el.style.height = `${this.height}`;
        el.style.transform = `translateX(-${this.width})`;
        el.style.transition = "all 0.80s";
        
        
        outer.appendChild(el);
        
        
        
      
        
        
        this.hidden = false;
        
                 btn.addEventListener("click", () => {
                     this.hidden = !this.hidden;
                     
             for (var i = 0; i < el.children.length; i++){
                 if (el.textContent !== "☰"){
                     
                if (this.hidden){
                     el.style.transform = "translateX(0em)";
                } else {
                     el.style.transform = `translateX(-${this.width})`;
                }
                     
                 }
             }
        })
        
        
		this.res = outer;
        
     
        
        
        
        if (this.els){
			this.items(this.els);
		}
        
		return this;
	}
    

    
 
    
    // DO NOT CHANGE WIDTH AFTER
    
    background(obj){
            this.res.children[1].style.backgroundColor = obj.color;
              this.res.children[1].style.opacity = obj.opacity;
            return this;
        }
	
	items(items){
		this.itemCount = items.length;
		for (var i = 0; i < items.length; i++){
			this.res.children[1].appendChild(items[i].render());
		}
		
		return this;
	}
	
	
/*--------------------------------------------------ADJUST--------------------------------------------------*/	
	render(div){
		if (div){
			document.querySelector(div).style.padding = 0;
			document.querySelector(div).style.margin = 0;
			document.querySelector(div).appendChild(this.res);
		} else {
			return this.res;
		}
			return this.res;
	}
}
	
export { SideBar };
