/*!
 * nodality v1.0.222
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


import { toObjectSource } from "../lib/codegen.js";
import { keyPattern } from "../lib/codegen.js";
class Link extends Animator {
	constructor(text, link, stopEM){
		super();
		this.link = link;
		this.text = text;
		this.code = [];
		this.css = [];
		this.elCSS = [];
		this.html = [];

	//	alert(link);
		// // // console.log(link); // 
		
		this.res = null;
		this.stopEM = stopEM; // DEVELOPMENT
		this.setup();
		this.inlineBlock(); // auto set ??


this.res.addEventListener("click", (e) => {
      const raw = this.link || this.res.getAttribute("href");
      if (!raw) return;

      // ✅ normalize again just in case
      const url = new URL(raw, window.location.href).href;


const isExternal = /^https?:\/\//i.test(url);
const isAnchor = url.startsWith("#");
const isScheme = /^[a-zA-Z]+:/.test(url); // matches mailto:, tel:, etc.

if (isExternal || isAnchor || url.endsWith(".html") || isScheme) {
  return; // Let browser handle
}

      // ✅ Otherwise SPA route
      e.preventDefault();
      if ("navigation" in window) {
        navigation.navigate(url);
      } else {
        history.pushState({}, "", url);
        document.dispatchEvent(new PopStateEvent("popstate"));
      }
    });


	


	}



	toElCSS(){
		this.preffersId ? this.elCSS.unshift(this.res.id + " { \n") : (this.elCSS.unshift("." + this.class + " { \n"));
		this.elCSS.push(" } \n \n");
		// // console.warn("OI")
		return this.elCSS; 
	}

	getType(){ // 114145
		return "HTMLAnchorElement";
	}

	toCode(){
		if (this.excludeFromCodeTrue){
			return [""];
		}

		const cleanedObj = Object.fromEntries(
   		 Object.entries(this.options).filter(([key, value]) => value !== null)
		);

		const objString = toObjectSource(cleanedObj, 4);

        return [`new Link().set(${objString})`];
	}


	
	setup(){
		let el = document.createElement("a");
		el.setAttribute("href", this.link);
		el.style.textDecoration = "none";
		el.style.color = "black";
		el.style.fontFamily = "Arial";
		
		var text = document.createTextNode(this.text);
		el.appendChild(text);
		
		this.res = el;

		if (this.stopEM === false){
			this.em(1);
		}
		
		return this;
	}

	appendImageAsChild(options, margin){


// // console.log(options);


		let link = document.createElement("a");
		options.options.vtn && (link.style.viewTransitionName = options.options.vtn);
		
		link.setAttribute("href", options.options.url);
		let img = document.createElement("img");

		if (options.options) {
			img.style.width = options.options.size;
			options.options.radius && (img.style.borderRadius = options.options.radius);
			img.setAttribute("src", options.options.img);
			// `pad` here is a raw CSS shorthand string, not the array-of-sides
			// spec `pad` means everywhere else. Left as it is: changing the
			// shape would break any caller passing a string.
			options.options.pad && (this.res.style.padding = options.options.pad);
			link.appendChild(img);
		}


		
		// Clears styles
		this.res = link; // 10:00:39
		

	if (margin){
		this.res.style.marginLeft = margin;
	}

	
	//	alert("K")
		return this;
	} // jquery wrap 9:41:49 18/04/23
	
	addIcon(obj){
		//alert("PPP")
		let img = document.createElement("img");
		img.style.width = "20px";
		img.style.height = "auto";
		img.style.marginLeft = obj.padding ? obj.padding : "10px";
		img.setAttribute("src", obj.url);
		this.res.appendChild(img);
		return this;
	}
	

	removeQuotesFromFirstWord(jsonString) {
		if (!jsonString){
			return;
		}
		const modifiedJSON = jsonString.replace(keyPattern(), "$1:");
		return modifiedJSON;
	  }



	set(obj){ // make it like I would like it

// push at all times
true && (this.elCSS.push(`text-decoration: none; \n`));
this.options = obj;

let stra = "";

obj.onTap && this.onTap(obj.onTap);


obj.tags && super.setTags(obj.tags); // Has to be in both

obj.id && this.res.setAttribute("id",  obj.id);
obj.id && super.setID(obj.id);

this.commonMethods(obj);

obj.flex && (this.res.style.display = "flex");


//@ fixMobileTap: Suppress the mobile tap highlight and its 300ms delay.
obj.fixMobileTap && this.fixMobileTap(obj.fixMobileTap);


let rempad = this.removeQuotesFromFirstWord(JSON.stringify(obj.pad));
obj.pad && (stra += `\n pad: ${rempad},`);

		obj.preffersId && (this.preffersId = obj.preffersId);
		(obj.preffersId != undefined) && (stra += `\n preffersId: ${obj.preffersId},`);

		obj.class && super.setClass(obj.class);
		obj.class && (stra += `\n class: "${obj.class}",`);
		//alert(obj.class);

		if (obj.borderObj){
			//alert(`${obj.borderObj.width}px solid ${obj.borderObj.color}`);
			this.res.style.border = `${obj.borderObj.width} solid ${obj.borderObj.color}`;
			this.res.style.borderRadius = `${obj.borderObj.radius}`;
			

			let rem = this.removeQuotesFromFirstWord(JSON.stringify(obj.borderObj));
			stra += `\n borderObj: ${rem},`;
		}

		if (this.options.preffersId === false) {
			this.html.push(`<a class="${obj.class}" href="#hello">${obj.text}</a> \n \n`);
		} else if (obj.id) {
			this.html.push(`<a id="${obj.id.substr(1)}" href="#hello">${obj.text}</a> \n \n`);
		}

		if (obj.blastData != undefined) {
			let rem = this.removeQuotesFromFirstWord(JSON.stringify(obj.blastData));
			super.setAny({ globalBlast: `1px ${obj.blastData.color}` }); // pass this color
			obj.blastData && (stra += `\n blastData: ${rem},`);
		}

  //@ nowrap: Keep the label on one line (white-space: nowrap).
		obj.nowrap && (this.res.style.whiteSpace = "nowrap");
		obj.font && this.font(obj.font);
		obj.font && (stra += `\n font: "${obj.font}",`);
		obj.font && (this.elCSS.push(`font-family: "${obj.font}"; \n`));
		
	   obj.fluidc && this.fluidCopy(obj.fluidc);
		obj.fluidc && (stra += `\n fluidc: "${obj.fluidc}",`);

	//	obj.size && (stra += `\n size: "${obj.size}",`);


		obj.clampc && this.clampCopy(obj.clampc);


		this.options.id && (stra += `\n id: "${this.options.id}",`);


		obj.align && this.leftAlign(obj.align); // 1145 WOW
		obj.align && (stra += `\n align: "${obj.align}",`);


		obj.type && (this.res.style.display = "block");
		obj.color && this.color(obj.color);
		obj.color && (stra += `\n color: "${obj.color}",`);
		obj.color && (this.elCSS.push(`color: "${obj.color}"; \n`));

		obj.background && this.background(obj.background);
		let stro = this.removeQuotesFromFirstWord(JSON.stringify(obj.background))
		obj.background && (stra += `\n background: ${stro},`);

		obj.hover && this.hover(obj.hover); // 23:20:51 Wow!
		let stre = this.removeQuotesFromFirstWord(JSON.stringify(obj.hover))
		obj.hover && (stra += `\n hover: ${stre},`);


		
	

		obj.blast && (this.blastData = obj.blast);

		// Wasn't there !!!
		obj.bold && (stra += `\n bold: ${obj.bold},`);

  //@ block: Render as a block-level element rather than inline.
		obj.block && this.toBlock();
		obj.block && (stra += `\n block: ${obj.block},`);


		obj.radius && (stra += `\n radius: "${obj.radius}",`);

		obj.width && (stra += `\n width: "${obj.width}",`);

		

		obj.maxWidth && this.maxWidth(obj.maxWidth);
		// // // console.log(obj.arrayMargin);


		


		obj.url && this.res.setAttribute("href", obj.url);
		stra += `\n url: "${obj.url}",`;

		obj.text && (this.res.textContent = obj.text);
		stra += `\n text: "${obj.text}",`;

		
		// stra += `\n text: "${obj.text}",`;


		if (obj.data){
		obj.data && this.appendImageAsChild(obj.data, "20px");
 
		let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.data));
		obj.data && (stra += `\n data: ${stringified}`);
		}

		if (obj.icon) {
			this.addIcon(obj.icon);
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.icon));
			(stra += `\n icon: ${stringified},`);
		}

		if (obj.shadow){
			let noiseObject = obj.shadow;
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(noiseObject));
			 (stra += `\n shadow: ${stringified},`);
		}

		if (obj.stroke) {
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.stroke));
			obj.stroke && (stra += `\n stroke: ${stringified},`);
		}

		if (obj.backgroundOp) {
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.backgroundOp));
			stra += `\n backgroundOp: ${stringified},`;
		}

		if (obj.marginOp) {
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.marginOp));
			stra += `\n marginOp: ${stringified},`;
		}

		if (obj.gradient) {
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.gradient));
			(stra += `\n gradient: ${stringified},`);
		}

		if (obj.animation) { // This does not fire for nasa link with id #swimoa
			// alert("PPP" + obj.id);
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.animation));
			(stra += `\n animation: ${stringified},`);
		}

		if (obj.transform) { // This does not fire for nasa link with id #swimoa
			// alert("PPP" + obj.id);
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.transform));
			(stra += `\n transform: ${stringified},`);
		}

		if (obj.blast) { // This does not fire for nasa link with id #swimoa
			// alert("PPP" + obj.id);
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.blast));
			(stra += `\n blast: ${stringified},`);
		}

		//obj.keySet && (stra += `\n keySet: ${stringified},`);

		let str = `new Link().set({${stra}}) \n`;

		this.code.push(str);
		obj.color && this.color(obj.color);


  //@ rounded: Apply the default corner radius. Use `radius` for a specific value.
		obj.rounded && this.round();

  //@ new: Open in a new tab — sets target="_blank" and rel="noopener noreferrer".
		if (obj.new){
			this.res.setAttribute("target", "_blank");
   			this.res.setAttribute("rel", "noopener noreferrer"); // security best practice
		}
		
	//---


	
	//---

	
// 504-711 REACT ON TRANSFORM

obj.transform && this.reactOnTransform(obj.transform);


	


	let arr = [];
	// // console.log("....obj");

	// alert("O")

	let ft = [obj.border, obj.blast, obj.gradient, obj.animation, obj.span, obj.shadow, obj.backgroundOp, obj.animation, obj.transform]//obj.gradient.filter(el => el.op.name !== "layout");
		// // // console.log(ft);

		// // console.log("hawai");
		// // console.warn(ft);

		ft = ft.filter(el => el != undefined);

	
if (ft.length > 0){


		if (obj.gradient){
				this.globalGradient = obj.gradient.op.gradient;
			
				if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}
			
			
			}

		
			if (obj.stroke){
				super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
			}


		// // console.log("LATA")
		// // console.log(ft);
		// // console.log(obj.shadow);

		for (var i = 0; i < ft.length; i++){
			// // // console.log("Hello");
			arr.push({
				range: ft[i].range,
				log: ft[i].op.name,
				target: ft[i].target,
				op: ft[i].op
			});
		}

		

		// THIS GETS OWERWRITTEN

		//alert(obj.hover && obj.hover.border);
		let keep = [];
		if (obj.borderObj /*|| (obj.hover && obj.hover.border)*/){
			keep.push("border");
		}

		if (obj.background){
			keep.push("background");
		}

		if (obj.mar){
			keep.push("margin");
		}
		
		if (obj.animation){
			// alert("PP")
			keep.push("animation");
			
		}

 // alert(obj.id);
// obj.id is undefined why ???

		// it isn't in ID

		// // console.log("Keeper");
		// // console.log(keep); // add animation code
	

	
// animation: "[]"
		this.chainReact(arr, obj.id, keep, obj.isNavA); // pass el name in argument ???
		this.res.style.zIndex = 1;
	}


	


		// 211518 you know howf
	
	//---

		return this;
	}

	fixMobileTap(obj){
		 this.res.style.pointerEvents = "auto";     // allow clicks/taps
  		 this.res.style.touchAction = "manipulation"; // prevent Safari gesture quirks
  		 this.res.style.cursor = "pointer";         // good for desktop UX
  		 this.res.style.zIndex = "1";               // bring above clipping parent
  		 this.res.style.position = "relative";      // create stacking context
	}



	maxWidth(mw){
		this.res.style.maxWidth = mw;  // 121339 in flex
		return this; // 121550 pbends
	}



	leftAlign(alg){
		this.res.style.textAlign = alg;
		return this;
	}
	
// 22:27:47 //22155 snap to change phone screen
 


	getClampValue(name){
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

	fluidCopy(name){
        
        const display1 = "calc(1.625rem + 5.075vw)";
        
        if (name === "S1"){
		
             this.res.style.fontSize = display1;
        }
         
        const display2 = "calc(1.500rem + 4.3vw)";
        
        if (name === "S2"){
			
             this.res.style.fontSize = display2;
        }
        
        
        const display3 = "calc(1.375rem + 3.525vw)";
        
        if (name === "S3"){
			
             this.res.style.fontSize = display3;
        }

		const display4 = "calc(1.250rem + 2.75vw)";
        
        if (name === "S4"){
			
             this.res.style.fontSize = display4;
        }

		const display5 = "calc(1.125rem + 1.975vw)";
        
        if (name === "S5"){
			
            this.res.style.fontSize = display5;
        }


		const display6 = "calc(1rem + 0.5vw)"; // calc(1rem + 1.2vw)
        
        if (name === "S6"){
             this.res.style.fontSize = display6;
        }
        
              return this;
    }


	inlineBlock(){
		this.res.style.display = "inline-block";
		return this;
	}
    

	toBlock(){
		this.res.style.display = "block";
		return this;
	}


	
	
	
	color(c){
		this.res.style.color = c;
		return this;
	}
	


	newWindow() {
		this.res.target = "_new";
		return this;
	}
    
	/**
	 * Corner radius. A number is pixels; a string is passed through, so
	 * `radius("50%")` and `radius(12)` both work.
	 */




 // 220812 la olympics 2028


	
	
	transition(duration){
		this.res.style.transition = `${duration}s ease-in-out`; // stop resize ???
		this.res.style.transionProperty = `background, color`;
		return this;
	}



	italic(){
		this.res.style.fontStyle = "italic";
		return this;
	}
	
	
    
    medium() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");

			if (query.matches) {
				this.res.style.fontSize = '2rem';
			} else {
				this.res.style.fontSize = '1.5em';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	
    opacity(o){
        this.res.style.opacity = o;
        return this;
    }
    

	/**/
	
    
   
    
    
    
    
	
	em(n){
		let query = window.matchMedia("(max-device-width: 415px)");	
		
		const res = () => {
			if (query.matches) {
				this.res.style.fontSize = `2em`;
			} else {
				this.res.style.fontSize = `1em`;
				//alert("ONE 1 EMA!")
			}
		}
		
		
	
		
		
	
		res();
		
	
		
		window.addEventListener("resize", res);
		
		
		
		return this;
	}
	
	
	font(family){
		this.res.style.fontFamily = family;
		return this;
	} 
	
	
	render(div){

		

		if (div){
			document.querySelector(div).appendChild(this.res);
		} else {
			return this.res;
		}
	
		return this;
	}
}

export { Link };
