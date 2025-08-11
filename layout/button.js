import {Animator} from "./animator.js";

class Button extends Animator {
	constructor(text, val){
		super();
		this.text = text;
		this.res = null;
		this.val = val;
		this.setup();
	}
	
	setup(obj){
		return this;
	}

	


	hover(obj){
        this.prevColor = this.res.style.backgroundColor;
		this.foreColor = this.res.style.color;
        
        if (obj.animation){
           
        this.res.style.transition = `${obj.animation}s ease-in-out`; // stop resize ???
		this.res.style.transionProperty = `background, color`;
          //  this.transition(obj.animation);
        }
      
        
        this.res.onmouseout = () => {
			this.res.style.backgroundColor = `${this.prevColor}`;
			this.res.style.color = `${this.foreColor}`;
		}
        
        this.res.onmouseover = () => {
			this.res.style.backgroundColor = obj.background;
			this.res.style.color = obj.color;
		}
        
        return this;
    }

	

	set(obj){
this.options = obj;
		let btn = document.createElement("button");
		btn.style.background = "transparent";

		if (obj.url){
			let node = document.createElement("img");
			node.setAttribute("src", obj.url);
			node.style.width = obj.frame.width;
			node.style.height = obj.frame.height;
			btn.appendChild(node);
		} else {
			let node = document.createTextNode(this.text.replace("$", this.val));
			btn.appendChild(node);
		}

		
		this.res = btn;
        
		if (obj){

		
        if (obj.type === "submit"){
            btn.setAttribute("type", obj.type);
        }
	}


		let stra = "";
		this.border("none");

		this.res.style.display = "block";

		if (obj.background){
			this.background(obj.background);
		}

		if (obj.padding){
			this.padding(obj.padding);
		}

		if (obj.margin){
			 this.margin(obj.margin);
		}

		obj.mar && (this.mar(obj.mar));
		obj.pad && (this.pad(obj.pad));

	//this.pad([{"b": "3rem"}]); // add)
		

		if (obj.centered){
			// alert(this.res.width / 2);
			  this.res.style.marginRight = "auto";
			this.res.style.marginLeft = "auto"; //`${this.res.style.width / 2}px`;
			
			this.res.style.backgroundColor = "black";
		}

		if (obj.border){
			this.border(obj.border);
		}

		if (obj.radius){
			this.borderRadius(obj.radius);
		}

		if (obj.class){
			this.setClass(obj.class);
		}

		if (obj.color){
			this.color(obj.color);
		}

		if (obj.auto){
			this.auto();
		}

        
        if (obj.weight){
			this.res.style.fontWeight = obj.weight;
		}

		obj.fluidc && this.fluidButtonCopy(obj.fluidc);
		obj.fluidc && (stra += `\n fluidc: "${obj.fluidc}",`); // 233559, correct collon 23:35:35 06/03

		obj.onTap && (this.onTap(obj.onTap))//this.onTap(obj.onTap);


		obj.frame  && this.frame(obj.frame);
		obj.frame && (stra += `\n frame: "${obj.frame}",`);

		obj.arrpad && this.arrayPadding(obj.arrpad.sides, obj.arrpad.value);
		obj.arrpad && (stra += `\n arrpad: {sides: ["${obj.arrpad.sides}"], value: "${obj.arrpad.value}"},`); // 2345 06/03

		obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
		obj.arrayMargin && (stra += `\n arrayMargin: {sides: ["${obj.arrayMargin.sides}"], value: "${obj.arrayMargin.value}"},`); // 2345 06/03

		obj.keySet && this.keySet(obj.keySet); // 165411 22/01/25 Nice!
		// Before S25 Ultra redesign!

		/*.background("#1abc9c")
        .padding("10px")
        .margin("10px")
        .border("none")
        .borderRadius("7px")*/

		return this;
	}
	
    

	
	arrayPadding(arr, value) {
	
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

		if (!value){
			this.res.style.paddingBottom = arr;
				}
			
		
		return this;
	}

	arrayMargin(arr, value) { // 224857 redefined earlier

		if (!value){ // LTRB
			this.res.style.marginLeft = `${arr[0]}px`;
			this.res.style.marginTop = `${arr[1]}px`;
			this.res.style.marginRight = `${arr[2]}px`;
			this.res.style.marginBottom = `${arr[3]}px`;
		}

		
		if (value === "7rem"){
			// The text does not react to margin changes
			// alert(arr);
			// alert(value);
		}
		
		
		
		// // console.log(arr);
		if (arr.includes("left")){
			this.res.style.marginLeft = value;
		}
		
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

		if (!value){
			this.res.style.marginBottom = arr;
		}
		
		return this;
	}
    

	fluidButtonCopy(name){

		if (name instanceof Object){
			this.prevStylex = this.res.style;
			this.res = document.createElement("button");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = name.exact;

			 // alert(name.exact);

			return this;
		}
        
        const display1 = "calc(1.625rem + 5.075vw)";
        
        if (name === "S1"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("button");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display1;
        }
         
        const display2 = "calc(1.500rem + 4.3vw)";
        
        if (name === "S2"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("button");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display2;
        }
        
        
        const display3 = "calc(1.375rem + 3.525vw)";
        
        if (name === "S3"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("button");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display3;
        }

		const display4 = "calc(1.250rem + 2.75vw)";
        
        if (name === "S4"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("button");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display4;
        }

		const display5 = "calc(1.125rem + 1.975vw)";
        
        if (name === "S5"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("button");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
            this.res.style.fontSize = display5;
        }



		const display6 = "calc(1rem + 0.5vw)"; // calc(1rem + 1.2vw)
        
        if (name === "S6"){
             this.res.style.fontSize = display6;
        }
        
              return this;
    }

	
    setClass(classa){
        this.res.setAttribute("class", classa);
        return this;
    }
    
    color(color){
        this.res.style.color = color;
        return this;
    }
    
	background(color){
		this.res.style.background = color;
		return this;
	}
	
	width(percentage){
		this.res.style.width = percentage;
		return this;
	}
    
    
   borderRadius(radius){
        this.res.style.borderRadius = radius;
       // console.warn(this.res);
        return this;
    }
	
	padding(L, T, R, B){
		if (L && T && R && B){
		this.res.style.paddingLeft = L;
		this.res.style.paddingTop = T;
		this.res.style.paddingRight = R;
		this.res.style.paddingBottom = B;
		} else {
			this.res.style.padding = L;
		}
		
		return this;
	}
	
	margin(L, T, R, B){
		
		if (L && T && R && B){
		this.res.style.marginLeft = L;
		this.res.style.marginTop = T;
		this.res.style.marginRight = R;
		this.res.style.marginBottom = B;
		} else {
			this.res.style.margin = L;
		}
		
		return this;
	}
	
     auto() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = '2.2rem';
			} else {
				this.res.style.fontSize = '1rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
    
    
    large() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
                alert("WOW")
				this.res.style.fontSize = '6rem';
			} else {
				this.res.style.fontSize = '3rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
    
    
    
	border(color, w){        

        if (color === "none"){
            this.res.style.border = "none";
        }
        
        
		this.res.style.border = `${color} solid ${w}px`;
        return this;
	}
    
    frame(obj){
        this.res.style.width = obj.width;
        this.res.style.height = obj.height;
        return this;
    }
	
	updating(obj, key){
		
		var copy = this.res;
		var txt = this.text;
		
		Object.defineProperty(obj, key, {
			set(newVal){	
				// 22:01 - Reactivness
				let node = document.createTextNode(txt.replace("$", newVal))
				copy.replaceChild(node, copy.childNodes[0]);
			}
		});
		
		return this;
	}
	
	onTap(e){
		this.res.addEventListener("click", e);
		return this;
	}

	toCode() {
		//console.log("OPTIONS ARE");
		//console.log(this.options);

       // const objString = JSON.stringify(this.options, null, 4);

	   const objString = JSON.stringify(this.options, (key, value) => {
        if (typeof value === "function") {
            return value.toString(); // Convert functions to their string representation
        }
        return value;
    }, 4);

	const formattedString = objString
	.replace(/"(\w+)":/g, '$1:') // Remove quotes from keys
	.replace(/"(\(\)\s*=>\s*{[^}]*})"/gs, '$1') // Handle arrow functions correctly
	.replace(/\\n/g, '') // Remove escaped newlines
	.replace(/\\"/g, '"'); // Remove escaped quotes within the function

        return [`new Button("${this.text}").set(${formattedString})`];

		// 22/01/25 09:10:50 thanks for amazing RegEx ChatGPT!
    }

/*	toCoder() {
		// Initialize the code string with the constructor
		let code = `new Button("${this.text}", ${this.val})`;

		// Collect the styles applied to the button
		const style = this.res.style;
		const setArgs = {};
		if (style.background) setArgs.background = style.background;
		if (style.color) setArgs.color = style.color;
		if (style.padding) setArgs.padding = style.padding;
		if (style.margin) setArgs.margin = style.margin;
		if (style.border) setArgs.border = style.border;
		if (style.borderRadius) setArgs.radius = style.borderRadius;
		if (style.fontWeight) setArgs.weight = style.fontWeight;

		// Add `set` call if any style properties exist
		if (Object.keys(setArgs).length > 0) {
			code += `.set(${JSON.stringify(setArgs)})`;
		}

		// Add event listeners if they exist
		if (this.res.onclick) {
			code += `.onTap(${this.res.onclick.toString()})`;
		}

		// Add rendering call
		//code += `.render()`;

		return [code];
	}*/
	
	render(el){
		if (el){
		   document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
	
	
export { Button };
