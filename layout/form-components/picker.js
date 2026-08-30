/*!
 * nodality v1.3.1
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

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
            // An item is a [value, text] PAIR, or a plain string that is
            // both. The string form was not handled and did not fail: a
            // string is indexable, so `obj[i][0]` and `obj[i][1]` were its
            // first two CHARACTERS. `items: ["Sales", "Support"]` rendered
            // two options both valued "S", reading "a" and "u".
            //
            // It stayed hidden because the two halves of the library
            // disagreed in opposite directions. `deriveSurface` builds a
            // picker's enum from `items.filter(i => typeof i === "string")`
            // — it requires the STRING form, and a unit test pins it — while
            // this loop required the PAIR form, so no value of `items`
            // satisfied both. The agent-facing manifest therefore advertised
            // `enum: ["Sales", "Support"]` over a control whose only
            // selectable values were "S" and "S", and an agent submitting
            // "Sales" had the field silently dropped from the payload.
            const it = obj[i];
            const pair = (typeof it === "string" || typeof it === "number")
                ? [String(it), String(it)]
                : [it && it[0], it && it[1]];
            card.appendChild(this.addNode(pair[0], pair[1]));
        }
        
  /*card.appendChild(this.addNode("audi", "Audi"));
         card.appendChild(this.addNode("audi", "Audi"));
         card.appendChild(this.addNode("audi", "Audi"));
        */
        
        this.el = card;
        // Animator's inherited helpers (pad, mar, commonMethods, hover, …)
        // all write to `this.res`, which this class never assigned — so
        // `pad` and `mar` below were silently doing nothing. Point `res` at
        // the same node so the inherited half of the API works.
        this.res = card;
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

        // A <select> with no adjacent text has no accessible name, and this
        // component had no way to be given one. `label` already reached here
        // — `elOpts` forwards it — and nothing read it, so every picker on
        // every page reported CONTROL_WITHOUT_LABEL from `check_page` and the
        // finding was UNREPAIRABLE through the descriptor vocabulary: there
        // was no spelling of the fix. Declared and ignored, which is the
        // failure this library spent six stages removing.
        //
        // `label` is the accessible name here, as it is on `input`; `title`
        // is accepted too, since FloatingInput calls it that and a caller
        // moving between the two form types should not have to notice.
        const named = obj.label !== undefined ? obj.label : obj.title;
        if (named !== undefined && named !== null && !this.el.getAttribute("aria-label")) {
            this.el.setAttribute("aria-label", String(named));
        }

        // Same dispatch Text and Wrapper use, so a Picker can be given a
        // border, height, font size or cursor through set() instead of the
        // caller styling the <select> by hand.
        this.commonMethods(obj);
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







if (typeof window !== "undefined") window.Picker = Picker;
export { Picker };
