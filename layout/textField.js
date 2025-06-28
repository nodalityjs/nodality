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


	//	div.style.width = "100%";
		return this;
	}
    

	set(obj){
		this.options = obj;
		this.res.setAttribute("type", obj.type ?? "text");
		obj.placeholder && (this.res.placeholder = obj.placeholder);
		obj.arrayPadding && this.arrayPadding(obj.arrayPadding.sides, obj.arrayPadding.value);
		obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
		obj.pad && this.pad(obj.pad);
        obj.mar && this.mar(obj.mar);
		return this;
	}


    arrayPadding(arr, value) {
		//alert("PP")
		//console.log(arr);
			if (arr.includes("left")){
				this.res.style.paddingLeft = value;
			}
	
			// console.log("PAD");
			// console.log(this.res.style.paddingLeft);
			// console.log(arr);
			// console.log(value);
			
			if (arr.includes("right")){
				this.res.style.paddingRight = value;
			}
			
			if (arr.includes("top")){
				this.res.style.paddingTop = value;
			}
			
			if (arr.includes("bottom")){
				this.res.style.paddingBottom = value;
			}
	
			if (arr.includes("all")){
				this.res.style.padding = value;
					}
				
			
			return this;
		}

		toCode() {
			const objString = JSON.stringify(this.options, null, 4);
			return [`new TextField().set(${objString})`];
		}
	
		arrayMargin(arr, value) {
			//alert("PP")
			//console.log(arr);
				if (arr.includes("left")){
					this.res.style.marginLeft = value;
				}
		
				// console.log("PAD");
				// console.log(this.res.style.paddingLeft);
				// console.log(arr);
				// console.log(value);
				
				if (arr.includes("right")){
					this.res.style.marginRight = value;
				}
				
				if (arr.includes("top")){
					this.res.style.marginTop = value;
				}
				
				if (arr.includes("bottom")){
					this.res.style.marginBottom = value;
				}
		
				if (arr.includes("all")){
					this.res.style.margin = value;
						}
					
				
				return this;
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
	
	listen(value){
		this.res.addEventListener("input", (e) => this.process(e) /*console.log(this.res.value)*/);
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
	
	week(){
		this.res.setAttribute("type", "week");
		return this;
	}
	
	process(e){
		//console.log(this.res.value)
		return this.res.value;
	}
	
	font(font){
		this.res.style.fontFamily = font;
		return this;
	}
	
	size(s){
        this.res.style.fontSize = s;
		return this;
	}
	
	em(e){
		this.res.style.fontSize = `${e}em`;
		return this;
	}
	
	color(color){
		this.res.style.color = color;
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
	
	padding(L, T, R, B){
        
        
        if (L){
           this.res.style.padding = `${L}px`;
        }
        
        else if (L && T && R && B){
            
        
		this.res.style.paddingLeft = L;
		this.res.style.paddingTop = T;
		this.res.style.paddingRight = R;
		this.res.style.paddingBottom = `${B}px`;
        }
		return this;
	}
	
	margin(L, T, R, B){
		this.res.style.marginLeft = L;
		this.res.style.marginTop = T;
		this.res.style.marginLeft = R;
		this.res.style.marginBottom = `${B}px`;
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
	
	
	width(w){
		this.res.style.width = w;
		return this;
	}
	
	round(amount){
		this.res.style.borderRadius = `${amount}px`;
		return this;
	}
	
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
