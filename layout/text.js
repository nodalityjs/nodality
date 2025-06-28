import {Animator} from "./animator.js";

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
		// this.setRandom();
	}



	flexOne(){
		this.res.style.flex = "1";
		return this;
	}





	// Just for visual 
	setGridWithoutCode(){
		this.res.style.border = "1px solid white";
		return this;
	}

	


	setArea(area){
		this.res.style.gridArea = area;
		return this;
	}


	


	toCodea(){ // 163953
		if (this.excludeFromCodeTrue){
			// this.code = ["new Text('').set({})"];
			this.code = [""];
		}
		return this.code;
	}

	toCode(){

		if (this.excludeFromCodeTrue){
			// this.code = ["new Text('').set({})"];
			return [""];
		}

		const cleanedObj = Object.fromEntries(
   		 Object.entries(this.options).filter(([key, value]) => value !== null)
		);

		const objString = JSON
			.stringify(cleanedObj, null, 4)
			.replace(/"([^"]+)":/g, '$1:');

			console.log("OCO")
console.log(objString);
        return [`new Text("${this.text}").set(${objString})`];
	}

	toCSS(){
		return this.css; 
	}

	toHTMLA(){
		return this.html;
	}

	toElCSS(){
		this.elCSS = this.elCSS.map(el => "    " + el);
		this.preffersId ? this.elCSS.unshift(this.res.id + " { \n") : (this.elCSS.unshift("." + this.class + " { \n"));
		this.elCSS.push(" } \n \n");
		// console.warn("OI")
		// console.log(this.elCSS);
		return this.elCSS; 
	}

	getType(){ // 114145


		// if (this.opt)


		
		if (this.options.fluidc === "S1"){
			return "HTMLHeaderElement";
		}

		return "HTMLParagraphElement";
	}
	


	gradientOptions(optsa) {

		//// console.log(optsa);
		if (optsa.length === 0) {
			return this;
		}

		const opts = optsa.filter(el => el.op.name === "gradient")[0];
		// Work here in Berlin ----------------------------

		//// console.log(opts);
		if (opts === undefined) {
			return this;
		}

		const options = opts.op;
		const breakpoint = opts.point;

		if (breakpoint) {
			//// console.log(breakpoint);

			const check = () => {
				// 22:59:59 Yes!!!
				// 02/10/23
			//	let matches = window.matchMedia(`(max-width: ${opts.point})`).matches;
			let matches = window.matchMedia(`(min-width: ${opts.range[0]}) and (max-width: ${opts.range[1]})`).matches;
				if (matches) {
				//	// console.log(this.res.style.color.toString());
					//	alert();

					this.prevBackground = this.res.style.color.toString();
					this.res.style.background = options.gradient; //`linear-gradient(to right, ${color1}, ${color2})`;
					this.res.style.WebkitBackgroundClip = 'text';
				}/* else {
				//	this.res.style['-webkit-text-fill-color'] = 'transparent';
//alert("O")
					// Do not remove stroke, after gradient disappears here
					
				//	alert("Hello");
					// console.log(this.res.style.color.toString());
					//this.res.style.color = "transparent"; //this.prevBackground;
					//this.res.style['-webkit-text-stroke'] = `1px orange`;
					// 17:53:44 Nice!
				}*/
			}

			check();
			window.addEventListener("resize", check);
		} 
	}


	strokeOptions(optsa) { // 22:55:04 21/08/23

		// console.log(optsa);
		if (optsa.length === 0) {
			return this;
		}

		const opts = optsa.filter(el => el.op.name === "blast")[0];
		// Work here in Berlin ----------------------------

		if (opts === undefined) {
			return this;
		}
console.log("DEL");
		const options = opts.op;
		const breakpoint = opts.point;

		if (breakpoint) {
		//	// console.log(breakpoint);

			const check = () => {

			//	let matches = window.matchMedia(`(max-width: ${opts.point})`).matches;

			let matches = window.matchMedia(`(min-width: ${opts.range[0]}) and (max-width: ${opts.range[1]})`).matches;
				if (matches) {

					// console.log(opts);
					if (options.color) {
						this.res.style['-webkit-text-stroke'] = `${options.width ? options.width : "1px"} ${options.color}`;
					} else {
						this.res.style['-webkit-text-stroke'] = `1px orange`;
					}
					
					// Not working, gradient modifier prevents this
					this.res.style['-webkit-text-fill-color'] = 'transparent';
				} /*else {
					//this.res.style.color = "transparent";
					//this.res.style['-webkit-text-fill-color'] = 'transparent';
					//alert("removes stroke")
					//this.res.style['-webkit-text-stroke'] = "";
					this.res.style['-webkit-text-fill-color'] = ""; // ""
					// 17:53:44 Nice!
				}*/
			}

			check();
			window.addEventListener("resize", check);
		} else {
			// console.log(opts);
			if (options.color) {
				this.res.style['-webkit-text-stroke'] = `${options.width ? options.width : "1px"} ${options.color}`;
			} /*else if (this.options.color){
		this.res.style['-webkit-text-stroke'] = `1px ${this.options.color}`;
	}*/
			this.res.style['-webkit-text-fill-color'] = 'transparent';
		}
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
	
	rowCol(row, col){
		this.res.style.gridRow = row;
		this.res.style.gridColumn = col;
		return this;
	}

	setGridRow(row){
		this.res.style.gridRow = row;
		return this;
	}

	setGridCol(col){
		this.res.style.gridColumn = col;
		return this;
	}

	toHTML(){
		return this.res;
	}


	onTap(e){
		this.res.addEventListener("click", e);
		return this;
	}
	
	setClass(name){
		this.res.setAttribute("class", name);
		return this;
	}

	setRandom(){

		
    var result = "LAYOUT-";
    var chars =  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    
    for (var i = 90; i > 0; --i) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }

    result += new Date().getTime();
	this.res.setAttribute("class", result);

    return this;

	}

	styled(obj) {
		this.set(obj);
		return this;
	}

	 removeQuotesFromFirstWord(jsonString) {
		const modifiedJSON = jsonString.replace(/"([^"]+)":/g, '$1:');
		return modifiedJSON;
	  }
	  
	
	set(obj){ 
		this.resCopy = this.res;
		this.options = obj;
		super.setPrevText(this.text);
		let stra = "";

		obj.maxWidth && (this.res.style.maxWidth = obj.maxWidth);

		obj.cursor && (this.res.style.cursor = "hand");
		
		obj.gpos && this.gpos(obj.gpos);

		obj.vtn && (this.res.style.viewTransitionName = obj.vtn);
		
		obj.index && super.setIndex(obj.index);
		obj.index && (this.index = obj.index);
		
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

		obj.initLetter && this.initLetter(obj.initLetter);

		obj.onTap && (this.onTap(obj.onTap)); //this.onTap(obj.onTap);

		if (obj.fluidc === "S6"){
			obj.fluidc && (this.elCSS.push(`font-size: calc(1.1rem + 2.075vw); \n`));
		} else {
			obj.fluidc && (this.elCSS.push(`font-size: calc(1.625rem + 5.075vw); \n`));
		}
		
		this.options.id && this.res.setAttribute("id",  this.options.id);
		super.setID(this.options.id);
		
		this.options.class && this.res.setAttribute("class",  this.options.class);
	
		super.setClass(this.options.class);
		obj.clampc && this.clampCopy(obj.clampc);
		obj.arrpad && this.arrayPadding(obj.arrpad.sides, obj.arrpad.value);
		obj.pad && this.pad(obj.pad);
		obj.respad && this.respad(obj.respad);
		obj.resmar && this.resmar(obj.resmar);

// stra +=  // 2345 06/03
		obj.mar && this.mar(obj.mar);
	
 
		obj.exact && (this.res.style.fontSize = obj.exact);
		obj.zIndex && (this.res.style.zIndex = obj.zIndex);
		obj.absolute && (this.res.style.position = "absolute");
		

		obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
		obj.em && this.em(obj.em); 

		if (obj.fluid){
			this.fluid(obj.fluid);
		}

		obj.font && this.font(obj.font);
		obj.fluidc && (this.elCSS.push(`font-family: ${obj.font}; \n`));
		obj.align && (this.res.style.textAlign = obj.align);
		
		obj.weight && (this.res.style.fontWeight = obj.weight);
		obj.padding && this.padding(obj.padding);
		obj.breakWord && (this.res.style.wordWrap = "break-word");
		obj.center && (this.res.style.marginRight = "auto");
		obj.center && (this.res.style.marginLeft = "auto");
		obj.width && (this.res.style.width = obj.width);
		obj.height && (this.res.style.height = obj.height);
		obj.background && (this.res.style.backgroundColor = obj.background);
		obj.radius && (this.res.style.borderRadius = obj.radius);


		obj.italic && this.italic();
		// stra += 17:01:43 11/11/24

		obj.responsive && this.responsive(); // Where I solve blast, make full width?

		obj.border && (this.res.style.border = `${obj.border}`);

		obj.onScroll && this.onScroll(obj.onScroll);

		obj.keySet && this.keySet(obj.keySet);

		obj.maxHeight && (this.res.style.maxHeight = obj.maxHeight);

		obj.transform && this.reactOnTransform(obj.transform); // remove obj.op.duration
		
		/*if (obj.transform.op.values){
			alert("P");
		}*/

		console.log("OGA");
		console.log(obj);
		
		
		
		let arr = [];

		if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform){
			if (obj.gradient){
				this.globalGradient = obj.gradient.op.gradient;
			}

		
			if (obj.stroke){
				super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
			}

			if (obj.span){
				obj.span.prevText = this.text;
			}


			let ft = [obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp, obj.layout, obj.marginOp, obj.shadow, /*obj.animation || obj.filtera*/obj.animation, obj.filtera, obj.transform];
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

	/*	if (obj.transform){
			keep.push("transform");
		}*/

			this.chainReact(arr, this.options.id, keep);
		}


		//this.code.push(str); // 14:04:10 06/03

		return this;
	} // 114522 you can hit tab 





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


checkForAnimation(queries){

	// Sort the queries based on the starting range value in ascending order
	queries.sort((a, b) => parseInt(a.range[0]) - parseInt(b.range[0]));

	const screenSize = window.innerWidth;

	for (const query of queries) {
	const [startRange, endRange] = query.range;
		const startSize = parseInt(startRange);
		const endSize = parseInt(endRange);
  
		if (screenSize >= startSize && screenSize <= endSize) {
			if (query.log === "animation"){ // 23:18:48 Nice!!! 31/10/2023

				// Create a keyframes object
				const keyframes = [
					{ opacity: 0, transform: 'translateY(100px)' }, // Starting position
					{ opacity: 1, transform: 'translateY(0)' } // Ending position
				];
	
			this.res.animate(keyframes, {
				duration: 1000, // Animation duration in milliseconds
				easing: 'ease' // Easing function
			});
		}
		
		}
	}
}




	// Do reset text, even when ranges may overlap
	// reset all => apply relevant, => .....



	resetSmall(){ // reset to default properties, allow overlaps
		//this.res.style.color = "gray";
		this.res.style['-webkit-text-stroke'] = "";
		this.res.style['-webkit-text-fill-color'] = "";
	}


	resetGradient(){
		this.res.style.WebkitBackgroundClip = "text";
		this.res.style.background = "transparent";
		return this;
	}


	resetStroke(){ // was commented out
		this.res.style['-webkit-text-stroke'] = "";
		this.res.style['-webkit-text-fill-color'] = "";
	//	this.res.style.color = "orange";

		//this.res.style['-webkit-text-stroke'] = "3px yellow";
		//this.res.style['-webkit-text-fill-color'] = "transparent";
		//this.res.style.color = "orange";
	}

	innerStroke(options){
		if (options.color) {
			this.res.style['-webkit-text-stroke'] = `${options.width ? options.width : "1px"} ${options.color}`;
		} else {
			this.res.style['-webkit-text-stroke'] = `1px orange`;
		}
		
		// Not working, gradient modifier prevents this
		this.res.style['-webkit-text-fill-color'] = 'transparent';
	}


	innerGradient(options){

		//// console.log(options.gradient);
		//alert(options.gradient);
	//	this.res.style['-webkit-text-fill-color'] = '';
		this.res.style.background = `linear-gradient(45deg, #ff0000, #00ff00)`;//options.gradient;
		this.res.style['-webkit-background-clip'] = 'text';
		//	this.res.style.WebkitBackgroundClip = 'text';
		//this.res.style.color = "transparent";
		// // console.log(options);
		
		/*this.prevBackground = this.res.style.color.toString();
					this.res.style.background = options.gradient; //`linear-gradient(to right, ${color1}, ${color2})`;
					this.res.style.WebkitBackgroundClip = 'text';*/

					//this.res.style.color = "green";

		
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

		if (!value){
			this.res.style.marginBottom = arr;
		}
		
		return this;
	}
    
	clampExperiment(){

		this.res.style.fontSize = "clamp(1rem, calc(1rem * 10rem), 3rem)";
		// this.res.style.fontSize = "clamp(1.125rem, calc(1.125rem + (1.25 - 1.125) * ((100vw - 20rem) / (96 - 20))), 1.25rem)"; // "clamp(1rem, 4rem * 20vw, 7rem)";
		return this;
	}
    
    
	/*
	
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
	
	
	*/
    
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



	betweenCopy(name){
        
        
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
       // this.res.style.initialLetter = n;
        return this;
    }



	


	constant(name){
		const display1 = "1.625rem";
        
        if (name === "S1"){
            this.jumbotron();
        }

        if (name === "S2"){
             this.large();
        }
        
        if (name === "S3"){
             this.medium();
        }

		/*const display4= "1.200rem";
        
        if (name === "S4"){
             this.res.style.fontSize = display4;
        }

		const display5= "1.000rem";
        
        if (name === "S5"){
             this.res.style.fontSize = display5;
        }
*/

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
			//this.res = document.createElement("p");
			//let node = document.createTextNode(this.text);
		//	this.res.appendChild(node);
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

	fluidCopy(name){


		if (name instanceof Object){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h1");
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
			this.res = document.createElement("h1");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display1;

			/* if (this.options.preffersId === false){
				this.html.push(`<h1 class="${this.options.class}">${this.text}</h1> \n \n`);
			 } else if (this.options.id) {
				this.html.push(`<h1 id="${this.options.id.substr(1)}">${this.text}</h1> \n \n`);
			 }*/
		
        }
         
        const display2 = "calc(1.500rem + 4.3vw)";
        
        if (name === "S2"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h2");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display2;
        }
        
        
        const display3 = "calc(1.375rem + 3.525vw)";
        
        if (name === "S3"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h3");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display3;
        }

		const display4 = "calc(1.250rem + 2.75vw)";
        
        if (name === "S4"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h4");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
             this.res.style.fontSize = display4;
        }

		const display5 = "calc(1.125rem + 1.975vw)";
        
        if (name === "S5"){
			this.prevStylex = this.res.style;
			this.res = document.createElement("h5");
			this.res.style.cssText = this.prevStylex.cssText;
			let node = document.createTextNode(this.text);
			this.res.appendChild(node);
            this.res.style.fontSize = display5;
        }



		const display6 = "calc(1rem + 0.5vw)"; // calc(1rem + 1.2vw)
        
        if (name === "S6"){
			if (this.options && this.options.preffersId === false){
				this.html.push(`<p class="${this.options.class}">${this.text}</p> \n \n`);
			 } else if (this.options && this.options.id) {
				this.html.push(`<p id="${this.options.id.substr(1)}">${this.text}</p> \n \n`);
			 }
             this.res.style.fontSize = display6;
        }
        
              return this;
    }
    
    
    toReactComponent(){
		this.react.push("function Godzilla() { \n");
		//if (this.options.preffersId === false){
			this.react.push(`return <h1 class="${this.options.class}">${this.text}</h1> \n`);
		// } else {
		//	this.react.push(`return <h1 id="${this.options.id.substr(1)}">${this.text}</h1> \n`);
		// }
		 this.react.push("} \n \n");

		// console.warn("i...")
		// console.log(this.react.join(""));
		return this.react;
	}
    
    
    
    
    



	
	
	

	myself(obj) {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = obj.desktop;
			} else {
				this.res.style.fontSize = obj.phone;
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
    

	
	jumbotron() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = '8rem';
			} else {
				this.res.style.fontSize = '6rem';
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

	
	
	vw(val, o, maxMin){
		
	}
	
	
	
	responsive(base){		
			this.set = false;
		this.setB = false;
		
		
		const adapt = () => {
			
			
			
		if (window.innerWidth < base.minw){
			this.setB = false;
			
			
			// *Â window.innerWidth);
			// // console.log(base.baseVW / 100 * window.innerWidth);
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
			//this.res.style.fontSize = `${base.maxFont}px`;
				this.setB = true;
			}
			
			
			
		} else {
			this.set = false;
			this.setB = false;
		    this.res.style.color = "black";
			this.res.style.fontSize = `${base.baseVW}vw`;
		}
		}
		
	
		/*let query = window.matchMedia(`(max-device-width: ${o.w}px)`);
			if (query.matches) {
				alert("joa")
				this.res.style.fontSize = `${o.size}vw`;
			}*/
		

		adapt();
		
		
		
	
		
		
		window.addEventListener("resize", adapt);
		
		
		
		
		// this.res.style.fontSize = `calc(${base}px + 1vw)`;
		return this;
	}
	
	xlarge() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
				this.res.style.fontSize = '6.5rem';
			} else {
				this.res.style.fontSize = '8.5rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	
	medium() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			/* let query = window.matchMedia("(max-device-width: 415px)");
			if (window.innerWidth < h || query.matches) {
			} */

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
			/* let query = window.matchMedia("(max-device-width: 415px)");
			if (window.innerWidth < h || query.matches) {
			} */

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
		//	alert(obj.type);
			el = document.createElement(obj.type);
el.setAttribute("id", obj.id);
			if (obj.type === "span"){
				//el.style.display = "block";
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

	center() {
		this.res.style.textAlign = "center";
		return this;
	}

	size(s) {
		this.res.style.fontSize = s;
		return this;
	}

	em(e) {
		this.res.style.fontSize = `${e}em`;
		//alert("h")
		return this;
	}

	color(color) {
		this.res.style.color = color;
		//this.code.push(`.color(${color}),`);
		//this.code.push(`.color(${color})`);
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

	/*padding(val){
		this.res.style.padding = val;
		return this;
	}*/


	
		width(w, shouldCenter){
		this.res.style.width = w;
		
		if (shouldCenter){
		this.res.style.marginLeft = "auto";
		this.res.style.marginRight = "auto";
		}
		return this;
	}


	offset(obj){
		/*this.res.style.marginLeft = "-390px";
		this.res.style.marginTop = "-360px";
		this.res.style.color = "green";*/

		
		this.res.style.gridRow = 2;
		this.res.style.gridColumn = 2;

		this.res.style.marginLeft = "-60px";

		return this;
	}


	border(color, w) {
		this.res.style.border = `${w}px solid ${color}`;
		return this;
	}

	padding(L, T, R, B) {
		if (L || T || R || B){ // CAUGHT MYSELF
		this.res.style.paddingLeft = L;
		this.res.style.paddingTop = T;
		this.res.style.paddingRight = R;
		this.res.style.paddingBottom = B;
		} 
		
		if (!T && !R && !B){
			//alert("j")
		this.res.style.padding = L;	
		}
		
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

		if (!value){
			this.res.style.paddingBottom = arr;
		}
			
		
		return this;
	}
	
	margin(L, T, R, B) {
		if (L || T || R || B){ // CAUGHT MYSELF
		this.res.style.marginLeft = L;
		this.res.style.marginTop = T;
		this.res.style.marginRight = R;
		this.res.style.marginBottom = B;
		} 
		
		if (!T && !R && !B){
			// alert("j")
		this.res.style.margin = L;	
		}
		
		return this;
	}
	
	
	margin(direction, value){
		if (direction == "top"){
			this.res.style.marginTop = value;
		} else if (direction == "bottom"){
			this.res.style.marginBottom = value;
		}else if (direction == "left"){
			this.res.style.marginLeft = value;
		}else if (direction == "right"){
			this.res.style.marginRight = value;
		}
		
		return this;
	}

	headline() {
		this.em(4)
		this.font("Arial")
		this.bold()
		return this;
	}

	caption() {
		this.bold();
		this.res.style.fontFamily = "Arial";
		this.color("gray");
		this.padding("top", 20);
		
		this.res.style.fontSize = "1em";
		
		// responsive font size
		
		let mq = window.matchMedia("(max-device-width: 415px)");
		
		if (mq.matches){
		this.res.style.fontSize = "2em";
		} else {
		this.res.style.fontSize = "1em";
		}	
		
		
		return this;
	}

	updating(obj, key) {

		var copy = this.res;
		var txt = this.text;

		Object.defineProperty(obj, key, {
			set(newVal) {
				// 22:01


				// this.text
				// let node = document.createTextNode(`Pressed ${newVal}`);
				let node = document.createTextNode(txt.replace("$", newVal))
				copy.replaceChild(node, copy.childNodes[0]);
			}
		});

		return this;
	}


	style(st) {
		this.res.style.color = st.styles.color;
		this.res.style.fontWeight = st.styles.fontWeight;

		this.res.style.paddingLeft = st.styles.padding[0];
		this.res.style.paddingTop = st.styles.padding[1];
		this.res.style.paddingRight = st.styles.padding[2];
		this.res.style.paddingBottom = st.styles.padding[3];

		this.res.style.marginLeft = st.styles.margin[0];
		this.res.style.paddingTop = st.styles.margin[1];
		this.res.style.paddingRight = st.styles.margin[2];
		this.res.style.paddingBottom = st.styles.margin[3];

		this.res.style.opacity = st.styles.opacity;


		return this;
	}
	
	
	applyStyle(w, style){
		
	let query = window.matchMedia(`(max-width: ${w}px)`);
		if (query.matches){
		  Object.assign(this.res.style, style.styles);
		}

		// // console.log(style.styles);
		return this;
	}
	
	
	
	
	
	nextApply(arr){
		let queries = [];
		
		let initStyle = this.res.style;
		
		const change = (query) => {
			
			if (queries[0].matches){
				//alert("FIRST")
				Object.assign(this.res.style, arr[0].styles);
				// // console.log("FIRST !");
			} else if (queries[1].matches){
				//alert("SECOND")
				Object.assign(this.res.style, arr[1].styles);
				// // console.log("SECOND !");
			} else {
			//	alert("NO QUERY")
				Object.assign(this.res.style, arr[arr.length - 1].styles);
				// // console.log("NO MATCH !");
			}
		}
		
		
		for (var i = 0; i < arr.length; i++) {
			let el = arr[i];
			
			let query = window.matchMedia(`(min-width: ${el.min}px) and (max-width: ${el.max}px)`);
			queries.push(query);
			
			queries[i].addListener(change)
		}
		
		
		change();
		
		
		
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
				alert("YES min max, but does not match");
				Object.assign(this.res.style, initStyle);
			}
				
			} else {
				let query = window.matchMedia(`(max-width: ${el.max}px)`);
			if (query.matches) {
				Object.assign(this.res.style, el.styles);
			} else {
				//alert("nij")
					alert("NO min max, and does not match");
				Object.assign(this.res.style, initStyle);
			}
		}	
	  }
	}
	
	// setFirst
	/*let query = window.matchMedia(`(max-width: ${arr[0].width}px)`);
		if (!query.matches){
				Object.assign(this.res.style, arr[0].styles);
		}*/
	
	goThroughStyles();
	window.addEventListener("resize", goThroughStyles);  // never use "on" here. Will get overrwritten !
	return this;
}
	
	render(div) {

		/*console.log("FINAL CSS");
		console.log(this.css[0].range);
		console.log(this.css[0].rules);
		console.log(this.elCSS);
	*/

		
		/*
		render(el) {
		Array.from(this.res.children).forEach(e => e.style.padding = 0);
		Array.from(this.res.children).forEach(e => e.style.margin = 0);
		
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
		*/


		
		//Array.from(this.res.children).forEach(e => e.style.padding = 0);
		//Array.from(this.res.children).forEach(e => e.style.margin = 0);
		
		if (div) {
			if (this.options && this.options.id){
				this.res.setAttribute("id", this.options.id);
			}
			
			document.querySelector(div).appendChild(this.res);
		} else {

			return this.res;
		}




		
	}
	
}
export { Text };
