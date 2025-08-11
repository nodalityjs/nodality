
import {Animator} from "../animator.js";

 class FloatingInput extends Animator {
        constructor(){
            super();
            this.el = null;
           // this.setup();
        }
        
        
        
        set(obj){        
    this.options = obj;
let div =  document.createElement("div");
    
let label =  document.createElement("label");
    label.style.position = "relative";
label.style.display = "block";
    
let node = document.createTextNode(obj.title);
label.appendChild(node);
label.style.opacity = 0;
    
    
var input = document.createElement("input");
            
            
            if (obj.type === "textarea"){
               input = document.createElement("textarea");
            }
            
            
            
            
    input.style.position = "relative";
    input.placeholder = obj.title;

            
            
            input.style.fontSize = "1rem";
            input.style.padding = ".4rem .75rem";

           
    
div.appendChild(label);
div.appendChild(input);

this.res = div;
obj.mar && this.mar(obj.mar);
obj.pad && this.pad(obj.pad);
            
    
input.addEventListener("focus", () => {
    label.style.transition = "transform ease 0.2s";
    label.style.transform = "scale(0.80)";
    label.style.textTransform = "uppercase";
    label.style.transformOrigin = "left top";
    label.style.fontWeight = "bold";
    input.placeholder = "";
    label.style.opacity = "1.0"; // 220654

    if (obj.font){
        label.style.fontFamily = obj.font;
    }

    if (obj.color){
        label.style.color = obj.color;
    }

    if (obj.exact){
        label.style.fontSize = obj.exact;
    }

});
    
input.addEventListener("focusout", () => {
     label.style.transform = "scale(1.0)";
     input.placeholder = obj.title;
     label.style.opacity = "0.0";
});

obj.name && input.setAttribute("name", obj.name);            
            
            
            
             let query = window.matchMedia("(max-device-width: 415px)");
           
            // window.matchMedia(query)
            if (query.matches){
              //  input.style.fontSize = "1rem";
         
                //input.style.width = "100%";
             //  input.style.fontSize = "3em";
              //  label.style.fontSize = "1.20em";
              input.style.width = "100%";
              div.style.width = "100%";
                
            }
            
            // saviour
         //   input.style.width = "100%";
          //  div.style.width = "100%";
            input.style.fontSize = "1rem"

            
            
            this.el = div;
            
            
            
             
            
          //  this.responsive();
            
            
            return this;
        }

        getValue(){
            return this.el.children[1].value;
        }

        toCode() {
            let objString = JSON.stringify(this.options, null, 4);
            objString = objString.replace(/"(\w+)"(?=\s*:)/g, '$1');
            return [`new FloatingInput().set(${objString})`];
        }
     
     
     margin(amount){
         this.el.style.margin = amount;
         return this;
     }
     
     
   /* responsive(){ HANDLED ABOVE
            let query = window.matchMedia("(max-device-width: 415px)");
           
            // window.matchMedia(query)
            if (query.matches){
                this.el.style.fontSize = "2rem";
            }
            
            return this;
        } */
     
     
     
        
        render(div){
		if (div){
			document.querySelector(div).appendChild(this.el);
           
		} else {
			return this.el;
		}	
	   }
    }
    
    // 31/01/25 22:06:50 works
window.FloatingInput = FloatingInput;
export { FloatingInput };
