import {Animator} from "./animator.js";

class SideBar {
	constructor(els, obj){
		this.ele = null;
        this.width = "16em";
        this.height = "100vh";
        
        this.els = els;
       
		// this.setup(obj);
		
		
	}
	
    
    

    
   
    
	setup(obj){
        
        
        
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
        
        //alert(this.width);
        
        
		let el = document.createElement("div");
        
        el.style.position = "absolute";
		el.style.backgroundColor = "#fff";
        el.style.flexDirection = "column";
		el.style.display = "flex";
		// el.style.justifyContent = "space-around";
		el.style.alignItems = "center";
		el.style.margin = 0;
        
        
		el.style.padding = 0;
		el.style.width = this.width;  //"16em";
        
		//-------------DEFAULT STYLING----------
		el.style.margin = 0;
       // el.style.zIndex = -1;
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
                    // el.style.display = "flex";
                } else {
                  //  el.style.display = "none";
                     el.style.transform = `translateX(-${this.width})`;
                }
                     
                 }
             }
        })
        
        
		this.ele = outer;
        
     
		// window.addEventListener("resize", this.adjust.bind(this));
        
        
        
        if (this.els){
			this.items(this.els);
		}
        
		return this;
	}
    

    
 
    
    // DO NOT CHANGE WIDTH AFTER
    
    background(obj){
            this.ele.children[1].style.backgroundColor = obj.color;
              this.ele.children[1].style.opacity = obj.opacity;
            return this;
        }
	
	items(items){
		this.itemCount = items.length;
		for (var i = 0; i < items.length; i++){
			this.ele.children[1].appendChild(items[i].render());
		}
		
		// this.adjust();
		return this;
	}
	
	
/*--------------------------------------------------ADJUST--------------------------------------------------*/	
	render(div){
		if (div){
			document.querySelector(div).style.padding = 0;
			document.querySelector(div).style.margin = 0;
			document.querySelector(div).appendChild(this.ele);
		} else {
			return this.ele;
		}
			return this.ele;
	}
}
	
export { SideBar };
