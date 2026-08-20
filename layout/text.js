/*!
 * nodality v1.2.7
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

import { toObjectSource } from "../lib/codegen.js";
import { keyPattern } from "../lib/codegen.js";
// 13:28 07/04/2020 - BEGIN NOTHING GONNA STOP US NOW  Lets go!

// 22:29:11


class Text extends Animator {
	constructor(text, obj) {
		super();
		this.text = text;
		this.res = null;
		this.setup(obj);
		this.code = [];
		this.elCSS = [];
		this.html = [];
		this.react = [];
		this.code.push(`new Text("${this.text}")`);
		//console.log("15/12/25 cool");
	}




	toCode(){
		if (this.excludeFromCodeTrue){
			return [""];
		}

		const cleanedObj = Object.fromEntries(
   		 Object.entries(this.options).filter(([key, value]) => value !== null)
		);

		const objString = toObjectSource(cleanedObj, 4);

        return [`new Text("${this.text}").set(${objString})`];
	}



	toElCSS(){
		this.elCSS = this.elCSS.map(el => "    " + el);
		this.preffersId ? this.elCSS.unshift(this.res.id + " { \n") : (this.elCSS.unshift("." + this.class + " { \n"));
		this.elCSS.push(" } \n \n");
		// console.warn("OI")
		return this.elCSS; 
	}

	getType(){ // 114145


		// if (this.opt)


		
		if (this.options.fluidc === "S1"){
			return "HTMLHeaderElement";
		}

		return "HTMLParagraphElement";
	}


	// 11:10:22

	// 22:56:40 yes!


	stroke(){
		this.res.style['-webkit-text-stroke'] = '3px orange';
		return this; // 02/03/23
	}

	fill(){
		this.res.style['-webkit-text-fill-color'] = 'transparent';
		return this;
		// 235326 02/03/23
	}


	
	setClass(name){
		this.res.setAttribute("class", name);
		return this;
	}


	styled(obj) {
		this.set(obj);
		return this;
	}

	 removeQuotesFromFirstWord(jsonString) {
		const modifiedJSON = jsonString.replace(keyPattern(), "$1:");
		return modifiedJSON;
	  }
	  

	   looksLikeMarkdown(str) {
    return /(\*\*.*\*\*|\*.*\*|`[^`]+`|\[.*?\]\(.*?\)|^# )/m.test(str);
  }

  // Minimal Markdown parser
  parseMarkdown(mdString) {
    let html = mdString;

    // Headers: # H1, ## H2, ### H3
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic: *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }
	
	set(obj){
		this.resCopy = this.res;
		this.options = obj;
		super.setPrevText(this.text);
		// Text.set does not route through Animator.commonMethods, so
		// react to element-level raster ops (lib/raster-ops.js) here.
		obj.raster && this.rasterize(obj.raster);
		let stra = "";


		

		this.commonMethods(obj);


		//alert(obj.top);
		obj.left && (this.res.style.left = obj.left);

		obj.flex && (this.res.style.display = "flex");
		
		if (obj.left || obj.top){
this.res.style.position = "absolute";
		}
		

		obj.maxWidth && (this.res.style.maxWidth = obj.maxWidth);

  //@ cursor: Show a pointer cursor. Any truthy value; the cursor style itself is fixed.
		obj.cursor && (this.res.style.cursor = "hand");
		
  //@ gpos: Grid placement — {col, row}, written to grid-column and grid-row.
		obj.gpos && this.gpos(obj.gpos);

		obj.vtn && (this.res.style.viewTransitionName = obj.vtn);
		
		obj.index && super.setIndex(obj.index);
		obj.index && (this.index = obj.index);
		
  //@ preffersId: Prefer this id when the Designer emits code for the element.
		obj.preffersId && (this.preffersId = obj.preffersId);
	
		super.setPref(obj.preffersId);

		obj.removeDecoration && (this.res.style.textDecoration = "none");
		obj.block && (this.res.style.display = "block");
		obj.area && this.setArea(obj.area);
		
		if (obj.icon){
		this.addIcon(obj.icon);
		}

		obj.color && this.color(obj.color);
		obj.color &&(this.elCSS.push(`color: ${obj.color}; \n`));

		obj.class && this.setClass(obj.class);
		
		obj.size && this.fluidCopy(obj.size);
		obj.fluidc && this.fluidCopy(obj.fluidc);
		//obj.fluidc && (stra += `\n fluidc: "${obj.fluidc}",`); // 233559, correct collon 23:35:35 06/03

		// ID HAS TO BE HERE AFTER SIZE
		this.options.id && this.res.setAttribute("id",  this.options.id);
		super.setID(this.options.id);

		obj.initLetter && this.initLetter(obj.initLetter);

		obj.onTap && (this.onTap(obj.onTap)); //this.onTap(obj.onTap);

		if (obj.fluidc === "S6"){
			obj.fluidc && (this.elCSS.push(`font-size: calc(1.1rem + 2.075vw); \n`));
		} else {
			obj.fluidc && (this.elCSS.push(`font-size: calc(1.625rem + 5.075vw); \n`));
		}
		
	
		
		this.options.class && this.res.setAttribute("class",  this.options.class);
	
		super.setClass(this.options.class);
		obj.clampc && this.clampCopy(obj.clampc);

// stra +=  // 2345 06/03
	
 
		obj.absolute && (this.res.style.position = "absolute");
		

		obj.em && this.em(obj.em); 

		if (obj.fluid){
			this.fluid(obj.fluid);
		}

		obj.fluidc && (this.elCSS.push(`font-family: ${obj.font}; \n`));
		obj.align && (this.res.style.textAlign = obj.align);
		
  //@ breakWord: Allow long words to wrap mid-word (word-wrap: break-word).
		obj.breakWord && (this.res.style.wordWrap = "break-word");
		// `center` used to set auto margins here, i.e. centre the Text
		// ITSELF — the opposite of what it means on every other component
		// now. That is `mar: "center"`.
		obj.center && this.deprecatedOption("center on Text", 'mar: "center"');
// width, height, background, radius, resprop, keySet, maxHeight
		obj.italic && this.italic();
		// stra += 17:01:43 11/11/24

		obj.responsive && this.responsive(); // Where I solve blast, make full width?

		obj.border && (this.res.style.border = `${obj.border}`);

		obj.onScroll && this.onScroll(obj.onScroll);

		obj.keySet && this.keySet(obj.keySet);


		// Done by commonMethods
		

		
		
		this.callReact(obj);

		   


		return this;
	} // 114522 you can hit tab 


	callReact(obj){

		let arr = [];

		const _hasAnimTransform = obj.transform && typeof obj.transform === "object";
		if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.shadow || obj.animation || obj.filtera || _hasAnimTransform){
			if (obj.gradient){
				this.globalGradient = obj.gradient.op.gradient;
				if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}
			}


			if (obj.stroke){
				super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
			}

			if (obj.span){
				obj.span.prevText = this.text;
			}


			let ft = [obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp, obj.layout, obj.marginOp, obj.shadow, /*obj.animation || obj.filtera*/obj.animation, obj.filtera, _hasAnimTransform ? obj.transform : undefined];
			ft = ft.filter(el => el != undefined);

		

			for (var i = 0; i < ft.length; i++){
				arr.push({
					range: ft[i].range,
					log: ft[i].op.name,
					target: ft[i].target,
					op: ft[i].op
				});
			}

			let keep = [];

		if (obj.borderObj){
			keep.push("border");
		}

		if (obj.background){
			keep.push("background");
		}

		if (obj.mar){
			keep.push("margin");
		}

		if (obj.animation){
			keep.push("animation");
		}

		if (obj.span){
			keep.push("span");
		}


		// console.log("ARA IS " + arr);

			this.chainReact(arr, this.options.id, keep);
		}
	}


// ------------------------------------------INDIVIDUAL METHODS-------------------------------
excludeFromCode(){
	this.excludeFromCodeTrue = true;
	return this;
}


// Works, but allow overlaps


addIcon(obj){
	//alert("PPP")
	let img = document.createElement("img");
	img.style.width = "20px";
	img.style.marginLeft = "10px";
	img.style.height = "auto";
	img.setAttribute("src", obj.url);
	this.res.appendChild(img);
	return this;
}


    
    
    
    between(name){
        
        
        if (name === "S1"){
             this.res.style.fontSize = "clamp(2rem, 8vw, 2.5rem)";
        }
        
        if (name === "S2"){
             this.res.style.fontSize = "clamp(4rem, 8vw, 5rem)";
        }
        
        if (name === "S3"){
             this.res.style.fontSize = "clamp(2rem, 5vw, 2.5rem)";
        }


		if (name === "S4"){
			this.res.style.fontSize = "clamp(1.5rem, 2vw, 1.6rem)";
	   }
        
         if (name === "S5"){
             this.res.style.fontSize = "clamp(1.2rem, 2vw, 1.3rem)";
        }

		if (name === "S6"){
			this.res.style.fontSize = "clamp(1rem, 2vw, 1.3rem)";
	   }
		
        
        return this;
    }


    
    
     stringGen(len) {
  var text = "";
  
  var charset = "abcdefghijklmnopqrstuvwxyz";
  
  for (var i = 0; i < len; i++)
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  
  return text;
}
    
    initLetter(n){
        let el  = document.createElement("style");
        document.body.appendChild(el);
        
       // let rand = new Rans
      //  this.res.
        
        
        
        let randID = Math.random();
        
        let str = this.stringGen(1000); //randID.toString().substr(3, 6);
        this.res.setAttribute("id", str);
        // // console.log();
        
        document.styleSheets[0].insertRule(`#${str}::first-letter { color: green; font-size: 3em; padding: 0.1em }`, 0);
        return this;
    }

 
    

	minusMargin(){
		this.res.style.marginRight = "-3.1em";
		return this;
	}
   
	
	
	
	fluid(name){
        
        const display1 = "calc(1.625rem + 4.3vw)";
        
        if (name === "S1"){
			this.res = document.createElement("h1");
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display1;
        }
        
         
        const display2 = "calc(1.525rem + 3.525vw)";
        
        if (name === "S2"){
			this.res = document.createElement("h2");
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display2;
        }
        
        
        const display3 = "calc(1.375rem + 2.75vw)";
        
        if (name === "S3"){
			this.res = document.createElement("h3");
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display3;
        }

		const display4 = "calc(1.275rem + 1.975vw)";
        
        if (name === "S4"){
			this.res = document.createElement("h4");
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display4;
        }

		const display5 = "calc(1.1rem + 1.2vw)";
        
        if (name === "S5"){
	//	alert("K")
             this.res.style.fontSize = display5;
        }
        
              return this;
    } 
    

	

	getClampValue(name){
		if (name === "S7"){
			//alert("NEOM")
			return "clamp(1.45rem, 2vw + 1.5rem, 1.69rem)";
		} 

		if (name === "S6"){
			return "clamp(2.25rem, 2vw+1.5rem, 3.25rem)";
		} 

		if (name === "S5"){
			return "clamp(2.75rem, 2vw + 1.5rem, 3.25rem)";
		} 

		if (name === "S4"){
			return "clamp(3.5rem, 2vw + 1.5rem, 3.25rem)";
		} 

		if (name === "S3"){
			return "clamp(4.25rem, 2vw + 1.5rem, 3.25rem)";
		} 

		if (name === "S2"){
			return "clamp(5rem, 2vw + 1.5rem, 3.25rem)";
		} 

		if (name === "S1"){
			return "clamp(6rem, 2vw + 1.5rem, 3.25rem)";
		} 
	}

	clampCopy(name){
		this.res.style.fontSize = this.getClampValue(name)
		return this;
	}


	
	
	large() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = '7rem';
			} else {
				this.res.style.fontSize = '5rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	


	frame(obj){
		this.res.style.width = obj.width;
		this.res.style.height = obj.height;
		return this;
	}


	
	
	
	responsive(base){		
			this.set = false;
		this.setB = false;
		
		
		const adapt = () => {
			
			
			
		if (window.innerWidth < base.minw){
			this.setB = false;
			
			
			// CONVERT CURRENT base.VW to pixels
			
			if (!this.set){
			
			this.res.style.color = "#3498db";
			this.res.style.fontSize = `${base.baseVW / 100 * window.innerWidth}px`;
				this.set = true;
			}
		} else if (window.innerWidth > base.maxw){
			this.set = false;
			if (!this.setB){
					//alert("ON REFRESH");
				this.res.style.color = "orange";
				this.res.style.fontSize = `${base.baseVW / 100 * base.maxw}px`;
				this.setB = true;
			}
			
			
			
		} else {
			this.set = false;
			this.setB = false;
		    this.res.style.color = "black";
			this.res.style.fontSize = `${base.baseVW}vw`;
		}
		}
		
	
		

		adapt();
		
		
		
	
		
		
		window.addEventListener("resize", adapt);
		
		
		
		
		return this;
	}


	
	medium() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");

			if (query.matches) {
				this.res.style.fontSize = '2.25rem';
			} else {
				this.res.style.fontSize = '1.5em';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
    
    auto() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = '2rem';
			} else {
				this.res.style.fontSize = '1rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	
	small() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");

			if (query.matches) {
				this.res.style.fontSize = '1.5em';
			} else {
				this.res.style.fontSize = '1em';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	
	sizes(arra) {
		this.res.style.fontSize = `${arra[0].size}rem`;
		
		const adj = () => {
			
			for (var i = 0; i < arra.length; i++) {
				if (arra[i].width) {
					let mq = window.matchMedia(`(min-width: ${arra[i].width}px)`);
					if (mq.matches) {
						// alert("Matches");
						// console.warn(`----------${arra[i].size}`);
						this.res.style.fontSize = `${arra[i].size}`;
					}
				}
			}
			
			
			let isMobile = window.matchMedia(`(max-device-width: 415px)`);

			if (isMobile.matches) {
				this.res.style.fontSize = `${arra[arra.length - 1].mobile}`;
			}

		}
		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	
	setup(obj) {
		let el;
		
		if (obj){
			// alert(obj.type);
			el = document.createElement(obj.type);
			if (obj.id !== undefined && obj.id !== null) el.setAttribute("id", obj.id);


			if (obj.type === "span"){


				if (obj.animation){
			
				el.style.position = "relative";
				el.style.display = "block";
				}

				
				
			}

		} else {
			el = document.createElement("p");
		}
		
		
		let node = document.createTextNode( /*this.text.replace("$", obj)*/ this.text);
		el.appendChild(node);

		this.res = el;
		this.res.style.padding = 0;
		this.res.style.margin = 0;

		
		return this;
	}

	hide() {
		this.res.style.visibility = "hidden";
		return this;
	}

	font(font) {
		this.res.style.fontFamily = font;
		return this;
	}


	em(e) {
		this.res.style.fontSize = `${e}em`;
		//alert("h")
		return this;
	}

	color(color) {
		this.res.style.color = color;
		return this;
	}

	align(direction) {
		this.res.style.textAlign = `${direction}`;
		return this;
	}

	weight(weight) {
		this.res.style.fontWeight = weight;
		return this;
	}

	bold() {
		this.res.style.fontWeight = "bold";
		return this;
	}

	italic() {
		this.res.style.fontStyle = "italic";
		return this;
	}


	
		width(w, shouldCenter){
		this.res.style.width = w;
		
		if (shouldCenter){
		this.res.style.marginLeft = "auto";
		this.res.style.marginRight = "auto";
		}
		return this;
	}


	offset(obj){

		
		this.res.style.gridRow = 2;
		this.res.style.gridColumn = 2;

		this.res.style.marginLeft = "-60px";

		return this;
	}


	border(color, w) {
		this.res.style.border = `${w}px solid ${color}`;
		return this;
	}


	updating(obj, key) {

		var copy = this.res;
		var txt = this.text;

		Object.defineProperty(obj, key, {
			set(newVal) {
				// 22:01


				// this.text
				let node = document.createTextNode(txt.replace("$", newVal))
				copy.replaceChild(node, copy.childNodes[0]);
			}
		});

		return this;
	}


	
	
	
	
	apply(arr) {
		
		var initStyle = this.res.styles;
		
	const goThroughStyles = () => {
		for (var i = 0; i < arr.length; i++) {
			let el = arr[i];
			
			
			if (el.min && el.max){
				let query = window.matchMedia(`(min-width: ${el.min}px) and (max-width: ${el.max}px)`);
			if (query.matches) {
				Object.assign(this.res.style, el.styles);
			} else {
								Object.assign(this.res.style, initStyle);
			}
				
			} else {
				let query = window.matchMedia(`(max-width: ${el.max}px)`);
			if (query.matches) {
				Object.assign(this.res.style, el.styles);
			} else {
				//alert("nij")
									Object.assign(this.res.style, initStyle);
			}
		}	
	  }
	}
	
	// setFirst
	
	goThroughStyles();
	window.addEventListener("resize", goThroughStyles);  // never use "on" here. Will get overrwritten !
	return this;
}
	
	render(div) {

		/*console.log("FINAL CSS");
	*/

		


		
		
		if (div) {
			if (this.options && this.options.id){
				this.res.setAttribute("id", this.options.id);
			}
			
			
			if (this.options && !this.options.span){
			//	alert("P")
			this.res.textContent = this.text;
			}

			if (this.looksLikeMarkdown(this.text)) {
      this.res.innerHTML = this.parseMarkdown(this.text);
    } 


			document.querySelector(div).appendChild(this.res);
		} else {
			if (this.options && !this.options.span){
			this.res.textContent = this.text;
			}

			if (this.looksLikeMarkdown(this.text)) {
      this.res.innerHTML = this.parseMarkdown(this.text);
    } 
			return this.res;
		}


		
	}
	
}
export { Text };
