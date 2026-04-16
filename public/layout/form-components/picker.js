import {Animator} from "../animator.js";


class Picker extends Animator {
    constructor(){
        super();
        this.el = null;
        this.file = null;
        this.selected = "";
    }
    
    
  
    
    
    
    setup(obj, name){
        let wrap = document.createElement("div");
        
		let card = document.createElement("select");
	     card.setAttribute("type", "file");
         card.setAttribute("name", name);
        
        
        
        card.addEventListener("change", () => {
         
            let picked = card.options[card.selectedIndex].value;
          //  console.log(picked);
        });
        
 
        /*var z = document.createElement("option");
  z.setAttribute("value", "volvocar");
  var t = document.createTextNode("Volvo");
  z.appendChild(t);
      */  
        
        
        
        
        
        
        
        
        
        
        for (var i = 0; i < obj.length; i++){
             card.appendChild(this.addNode(obj[i][0], obj[i][1]));
        }
        
  /*card.appendChild(this.addNode("audi", "Audi"));
         card.appendChild(this.addNode("audi", "Audi"));
         card.appendChild(this.addNode("audi", "Audi"));
        */
        
        this.el = card;
        return this;
    }
    
    set(obj){
        this.options = obj;
        obj.items && this.setup(obj.items, obj.name);
        obj.arrayPadding && this.arrayPadding(obj.arrayPadding.sides, obj.arrayPadding.value);
        obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
        obj.pad && this.pad(obj.pad);
        obj.mar && this.mar(obj.mar);

        obj.radius && (this.el.style.borderRadius = obj.radius);
        obj.background && (this.el.style.background = obj.background);
        return this;
    }

    arrayPadding(arr, value) {
	//alert("PP")
    //console.log(arr);
		if (arr.includes("left")){
			this.el.style.paddingLeft = value;
		}

		// console.log("PAD");
		// console.log(this.res.style.paddingLeft);
		// console.log(arr);
		// console.log(value);
		
		if (arr.includes("right")){
			this.el.style.paddingRight = value;
		}
		
		if (arr.includes("top")){
			this.el.style.paddingTop = value;
		}
		
		if (arr.includes("bottom")){
			this.el.style.paddingBottom = value;
		}

		if (arr.includes("all")){
			this.el.style.padding = value;
				}
			
		
		return this;
	}

    arrayMargin(arr, value) {
        //alert("PP")
      //  console.log(arr);
            if (arr.includes("left")){
                this.el.style.marginLeft = value;
            }
    
            // console.log("PAD");
            // console.log(this.res.style.paddingLeft);
            // console.log(arr);
            // console.log(value);
            
            if (arr.includes("right")){
                this.el.style.marginRight = value;
            }
            
            if (arr.includes("top")){
                this.el.style.marginTop = value;
            }
            
            if (arr.includes("bottom")){
                this.el.style.marginBottom = value;
            }
    
            if (arr.includes("all")){
                this.el.style.margin = value;
                    }
                
            
            return this;
        }
        
    
    
addNode(value, text){
  var z = document.createElement("option");
  z.setAttribute("value", value);
  var t = document.createTextNode(text);
  z.appendChild(t);
    return z;
    }
    
    padding(val){
        this.el.style.padding = val;
        return this;
    }
    
    
    font(font){
        this.el.style.fontFamily = font;
        return this;
    }
    
    margin(val){
        this.el.style.margin = val;
        return this;
    }

    toCode() {
        let objString = JSON.stringify(this.options, null, 4);
        objString = objString.replace(/"(\w+)"(?=\s*:)/g, '$1');
        return [`new Picker().set(${objString})`];
    }
    
    
    rounded(el){
        this.el.style.borderRadius = "4px";
        return this;
    }
    
     auto() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.el.style.fontSize = '3rem';
			} else {
				this.el.style.fontSize = '1rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
    
     render(div){
		if (div){
			document.querySelector(div).appendChild(this.el);
           
		} else {
			return this.el;
		}	
	}
}







window.Picker = Picker;
export { Picker };
