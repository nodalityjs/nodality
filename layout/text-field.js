/*!
 * nodality v1.3.2
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

class TextField extends Animator {
	constructor(text){
		super();
		this.text = text;
		this.res = null;
        this.valid = false;
		this.setup();
	}
	
	setup(){
		let el = document.createElement("input");
		
		this.res = el;
		this.res.style.padding = 0;
		this.res.style.margin = 0;
		this.res.style.padding = ".4rem .75rem";
		
		this.res.style.fontSize = "1rem";

		let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.width = "100%";
			
			} else {
				
			}


		return this;
	}
    

	set(obj){
		this.options = obj;
		//@ type: Input type attribute. Defaults to "text"; "search" adds the native clear button.
		this.res.setAttribute("type", obj.type ?? "text");
		//@ placeholder: Placeholder text shown while the field is empty.
		obj.placeholder && (this.res.placeholder = obj.placeholder);

		// width:100% plus horizontal padding is 100% PLUS the padding under
		// the default content-box, so a full-width field pushed the page 20px
		// wider than the viewport — the overflow measured exactly the padding.
		this.res.style.boxSizing = "border-box";

		//@ label: Accessible name for the field.
		// A placeholder is NOT an accessible name: it disappears the moment
		// anyone types, and assistive technology is not required to announce
		// it. Take a real label where there is one and fall back to the
		// placeholder, which is better than nothing at all.
		if (!this.res.getAttribute("aria-label")) {
			const name = obj.label ?? obj.title ?? obj.placeholder;
			name && this.res.setAttribute("aria-label", String(name));
		}
		//@ name: Form field name. What a submitted form actually SENDS.
		//@ id: DOM id on the input.
		//@ required: Marks the field required for native validation.
		// These were dropped, and `name` is not cosmetic: a field without
		// one contributes nothing to FormData, so every text input in
		// every Nodality form submitted an empty payload — for a human
		// filling it in, not only for an agent. Forwarded here rather
		// than through the style map because they are attributes, not
		// styles.
		obj.name && this.res.setAttribute("name", obj.name);
		obj.id && this.res.setAttribute("id", obj.id);
		obj.required && this.res.setAttribute("required", "");
		//@ arrayPadding: Padding on named sides. {sides: ["left","top"], value: "1rem"}.
		//@ arrayMargin: Margin on named sides. {sides: ["left"], value: "1rem"}.
		obj.pad && this.pad(obj.pad);
        obj.mar && this.mar(obj.mar);
		obj.maxWidth && (this.res.style.maxWidth = obj.maxWidth);
		//@ exact: Font size as an exact CSS length, e.g. "0.875rem".
		obj.exact && (this.res.style.fontSize = obj.exact);
		//@ radius: Corner radius in pixels. A bare number, not a CSS length.
		obj.radius && this.round(obj.radius);
		obj.color && (this.res.style.color = obj.color);
		obj.background && (this.res.style.background = obj.background);
		obj.font && (this.res.style.fontFamily = obj.font);
		obj.weight && (this.res.style.fontWeight = obj.weight);
		//@ bold: Shorthand for font-weight bold. Overrides `weight` if both are given.
		obj.bold && (this.res.style.fontWeight = "bold");
		//@ theme: Light/dark colour overrides. {light: {...}, dark: {...}}.
		obj.theme && this.theme(obj.theme);

		// Dispatch to the shared style map (height, boxSizing, minWidth,
		// cursor, borderObj, …) the way Text and Wrapper do. Without this a
		// caller could not give a TextField a height or a border through
		// set() and had to reach for the element, which is exactly what the
		// component API exists to avoid. Runs last so the explicit options
		// above stay authoritative where the two overlap.
		this.commonMethods(obj);
		return this;
	}


		toCode() {
			const objString = JSON.stringify(this.options, null, 4);
			return [`new TextField().set(${objString})`];
		}
	
			
    
    setValid(valid, value){
        
        
        
        if (valid){
          this.res.style.border = "6px solid green";
        } else {
             this.res.style.border = "6px solid red";
        }
        
        if (value.length === 0){
             this.res.style.border = "none";
        }
        
        return this;
        
    }
    
     auto() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = '3rem';
		
			} else {
				this.res.style.fontSize = '1rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}


	
	value(val){
		 this.res.setAttribute("value", val);
		return this;
	}
	
	password(){
		this.res.setAttribute("type", "password");
		return this;
	}
	
	number(){
		this.res.setAttribute("type", "number");
		return this;
	}


	
	process(e){
		//console.log(this.res.value)
		return this.res.value;
	}


	
	size(s){
        this.res.style.fontSize = s;
		return this;
	}
	
	em(e){
		this.res.style.fontSize = `${e}em`;
		return this;
	}


	
	weight(weight){
		this.res.style.fontWeight = weight;
		return this;
	}
	
	bold(){
		this.res.style.fontWeight = "bold";
		return this;
	}
	
	italic(){
		this.res.style.fontStyle = "italic";
		return this;
	}
	
	
	
    
    placeholder(text){
        this.res.setAttribute("placeholder", text);
        return this;
    }
    
	border(color, w){
		this.res.style.border = `${w}px solid ${color}`;
		return this;
	}


	/**
	 * Corner radius. A number is pixels; a string is passed through, so
	 * `radius("50%")` and `radius(12)` both work.
	 */



	
	onChange(action){
		var value = this.res.value;
		this.res.addEventListener("input", e => { action(this.res.value); /*this.res.value = value*/ });
		// this.res.value = 
		return this;
	}
	
	render(div){
		if (div){
			document.querySelector(div).appendChild(this.res);
		} else {
			return this.res;
		}
			return this.res;
	}
}
	
export { TextField };
