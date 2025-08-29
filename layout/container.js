/*!
 * nodality v1.0.6
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

class Wrapper extends Animator { // 12:10:02 found grep 06/03
	constructor(obj) {
        super();
		this.res = null;
		this.setup(obj); // 21:29:32 09/03/2024 Take on me!
		this.code = [];
		this.isLast = false;
		this.constrObj = obj;

		this.code.push("\n new Wrapper() \n");
	}

	isLasta(){
		this.isLast = true;
		return this;
	}


	
	toCode(indent = 0){
		this.code = [];

	if (this.excludeFromCodeTrue) {
        return [""];
    }

    const pad = " ".repeat(indent);

    let code = `${pad}new Wrapper("${this.constrObj}")`;

	if (!this.constrObj){
code = `${pad}new Wrapper()`;
	}

    if (Object.keys(this.obj).length) {
        const cleanedObj = Object.fromEntries(
            Object.entries(this.obj).filter(([key, value]) => value !== null)
        );

        const objString = JSON
            .stringify(cleanedObj, null, 2)
            .replace(/"([^"]+)":/g, '$1:');

        code += `\n${pad}  .set(${objString})`;
    }

    if (this.items.length) {
        code += `\n${pad}  .add([\n` +
            this.items.map(c => c.toCode(indent + 4)).join(",\n") +
            `\n${pad}  ])`;
    }

    code += `\n${pad}`;
    return [code];
	}


	getType(){
		return "LayoutWrapperElement"; // 224647
	}
// 220543§§§§§§§§§§§§§§§§§§§§¨ú
	setArea(area){
		this.res.style.gridArea = area;
		return this;
	}
	
	removeQuotesFromFirstWord(jsonString) {
		const modifiedJSON = jsonString.replace(/"([^"]+)":/g, '$1:');
		return modifiedJSON;
	  }

	  clicked(handler){
		this.res.addEventListener("click", handler);
		return this;
	  }

	  gpos(obj){
		//alert(obj.col);
		this.res.style.gridColumn = obj.col;
		this.res.style.gridRow = obj.row;
		//this.res.style.border = "1px solid green";
		return this;
	  }

	set(obj){
		this.obj = obj;
		let stra = ".set({";

		obj.scale && (this.res.style.scale=obj.scale);
		obj.scale && (stra += `scale: ${obj.scale}`);
		obj.keySet && this.keySet(obj.keySet);

		// ------
		//obj.mc && (this.res.style.height = "minmax(400px, 1fr)");
		//obj.mc && (this.res.style.height = "fit-content");
		//obj.mc && (this.res.style.height = "max-content");
		//obj.mc && (this.res.style.minHeight = "400px");
		obj.pad && this.pad(obj.pad);
		obj.mar && this.mar(obj.mar);
			//	obj.mar && (stra += `mar: {sides: [${obj.mar.sides.map(x => `"${x}"`).join(", ")}], value: "${obj.arrpad.value}"}, `);
		obj.arrpad && (stra += `pad: {sides: [${obj.arrpad.sides.map(x => `"${x}"`).join(", ")}], value: "${obj.arrpad.value}"}, `); // 2345 06/03

		obj.gpos && this.gpos(obj.gpos);


		//const obj = options;
	/*	if (obj && obj.id && obj.stroke || obj && obj.id &&  obj.gradient || obj && obj.id && obj.span || obj && obj.id && obj.layout ){


			// use obj.range and obj.op
			
					
			
						let first = obj.gradient;
			
						if (obj.gradient){
			
						

						this.globalGradient = obj.gradient.op.gradient;
						// console.log(obj.gradient);
						}
			
						
						if (obj.stroke){
						super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
						}
			
						// Filter just the elements with layout element
						let ft = [obj.stroke, obj.gradient, obj.animation, obj.span, obj.layout]//obj.gradient.filter(el => el.op.name !== "layout");
						// console.log(ft);
			
						ft = ft.filter(el => el != undefined);
			
			
			
			
						let arr = [];
			
						for (var i = 0; i < ft.length; i++){
							// console.log("Hello");
							arr.push({
								range: ft[i].range,
								log: ft[i].op.name,
								target: ft[i].target
							});
						}
			
						this.res.setAttribute("id", obj.id);
					//	this.betaReact(arr, obj.id);
					}*/



		let arr = [];

		if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform){
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

		if (obj.transform){
			keep.push("transform");
		}

		if (obj.gradient){
			keep.push("gradient");
		}

		if (obj.blast){
			//keep.push("blast");
		}

		// console.log("ARA IS " + arr);
		console.log("CARA IS ");
		console.log(arr);
		this.options = obj;
			 this.chainReact(arr, this.options.id, keep);
		}

		
	
		if (obj.centerColumn){ // was obj.socenter
			this.res.style.display = "flex";
			this.res.style.flexDirection = "column";
			this.res.style.alignItems = "center";

			obj.centerColumn && (stra += `centerColumn: ${obj.centerColumn},`); // 2345 06/03
	   }

	obj.mboth && (this.res.style.marginRight = "auto") && (this.res.style.marginLeft = "auto" );

	obj.mar && this.mar(obj.mar); // has to be here

	obj.sticky && this.sticky();

	obj.transition && (this.res.style.transition = obj.transition);

	obj.class && this.res.setAttribute("class", obj.class);

	obj.ga && (this.res.style.gridArea = obj.ga);

		if (obj.opacity) {
			obj.opacity == 0 && (this.res.style.opacity = 0);
			obj.opacity && (this.res.style.opacity = obj.opacity);
		}

		obj.maxHeight && (this.res.style.maxHeight = obj.maxHeight);

		obj.id && this.res.setAttribute("id",  obj.id);

		
		obj.arrpad && this.arrayPadding(obj.arrpad.sides, obj.arrpad.value);
		obj.arrpad && (stra += `arrpad: {sides: [${obj.arrpad.sides.map(x => `"${x}"`).join(", ")}], value: "${obj.arrpad.value}"}, `); // 2345 06/03
		
		obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
	    obj.arrayMargin && (stra += `\n arrayMargin: {sides: ["${obj.arrayMargin.sides}"], value: "${obj.arrayMargin.value}"},`); // 2345 06/03
		//	obj.arrpad && (stra += `arrpad: {sides: ["${obj.arrpad.sides}"], value: "${obj.arrpad.value}"}, `); // 2345 06/03
		
		// COMMENTED OUT 08/01/2025
		// obj.grow && (this.res.style.flexGrow = 1);

		obj.center && this.toCenter(obj.center);
		obj.center && (stra += `center: "${obj.center}",`);

		obj.simpleCenter && this.simpleCenter();
		obj.simpleCenter && (stra += `center: "${obj.simpleCenter}",`);
		
		obj.filter && (this.res.style.backdropFilter = "blur(3px)"); // 002506 21/05 002945
		obj.radius && this.corner(obj.radius);

	
		obj.radius && (stra += `\n radius: "${obj.radius}",`);
		obj.border && this.border(obj.border);

		obj.simpleBorder && (this.res.style.border = obj.simpleBorder);

		obj.width && this.width(obj.width);
		obj.width && (stra += `\n width: "${obj.width}",`);	


		obj.overflow && (this.res.style.overflow = "hidden");
		obj.overflow && (stra += `\n overflow: "${obj.overflow}",`);

		obj.height && this.heightNoAuto(obj.height);
		obj.height && (stra += `\n height: "${obj.height}",`);	

		obj.align && this.flexAlign(obj.align);
		obj.align && (stra += `\n align: "${obj.align}",`);	

	

		if (obj.borderObj){
			this.res.style.borderRight = `${obj.borderObj.width} solid ${obj.borderObj.color}`
			this.res.style.borderRadius = obj.borderObj.radius; 
			
			/*borderObj: {
				side: "all",
				width: "3px",
				color: "rgba(236, 227, 215, 0.5)"
			},*/
		}

		if (obj.borderObja){
			this.res.style.border = `${obj.borderObja.width} solid ${obj.borderObja.color}`
			this.res.style.borderRadius = obj.borderObja.radius; 
		}

		obj.font && this.font(obj.font);
		obj.font && (stra += `font: "${obj.font}",`);	
		obj.maxWidth && this.maxWidth(obj.maxWidth);
		obj.flexCenter && this.flexc(obj.flexCenter);
		obj.multipad && this.makeMultiPad(obj.multipad);
		obj.multimargin && this.makeMultiMargin(obj.multimargin);
		obj.color && this.color(obj.color);
		obj.background && this.background(obj.background);
		obj.background && (stra += `background: "${obj.background}",`);	

		obj.weight && this.weight(obj.weight);
		obj.paddings && this.paddingo(obj.paddings);

		obj.area && this.setArea(obj.area);
		obj.area && (stra += `area: "${obj.area}"`);
		obj.column && this.makeCol();
		obj.column && (stra += `\n column: "${obj.column}",`);


		obj.alignIts && (this.res.style.background = "gray");
		obj.alignIts && (this.res.style.alignItems = "flex-start"/*obj.alignIts*/);
		obj.alignIts && (this.res.style.justifyItems = "flex-start"/*obj.alignIts*/);
		
		obj.customAlign && (this.res.style.alignItems = obj.customAlign);
		obj.customJustify && (this.res.style.justifyItems = obj.customJustify);
		obj.disp && (this.res.style.display = obj.disp);
		obj.flexDir && (this.res.style.flexDirection = obj.flexDir);
		obj.flexDir && (this.res.style.display = "flex");
		obj.flexDir && (stra += `\n flexDir: "${obj.flexDir}",`)

		obj.zIndex && (this.res.style.zIndex = obj.zIndex);
	
		obj.transform && this.reactOnTransform(obj.transform); 
		// obj.makeResponsiveBehaviour && obj.makeResponsiveBehaviour !== "undefined" && this.makeResponsiveBehaviour(obj.makeResponsiveBehaviour);
		obj.name && (this.name = obj.name)
		obj.responsive && this.rsp(obj.responsive);

		/*if (obj.makeResponsiveBehaviour){
			stra += `\n makeResponsiveBehaviour: "${obj.makeResponsiveBehaviour}",`
		}*/ // 08/01/2025 COMEMMENTED OUT

		if (obj.stretch){
			obj.stretch && this.stretch(obj.stretch);
			let stringified = this.removeQuotesFromFirstWord(JSON.stringify(obj.stretch));
			stra += `\n stretch: ${stringified},`;
		}




		for (let prop in obj) {
            if (prop === 'margin') {
                let paddingValues = obj[prop];
                if (Array.isArray(paddingValues) && paddingValues.length > 0) {
                   
					for (let pado of paddingValues){

					
					let paddingObject = pado;// paddingValues[0]; // Assuming only one object in the array
                    if (paddingObject.hasOwnProperty('top')) {
                        this.res.style.marginTop = paddingObject['top'];
                    }
                    if (paddingObject.hasOwnProperty('right')) {
						//alert("P")
                        this.res.style.marginRight = paddingObject['right'];
                    }
                    if (paddingObject.hasOwnProperty('bottom')) {
                      // alert("P")
						this.res.style.marginBottom = paddingObject['bottom'];
                    }
                    if (paddingObject.hasOwnProperty('left')) {
                        this.res.style.marginLeft = paddingObject['left'];
                    }
				}



                }
            }
        }
		

		stra += "})\n";

		if (stra.length === 8){
			stra = "";
		}
		
		this.code.push(stra);
		return this;
	}

	rsp(obj){
		
		this.res.style.display = "flex";
		
		let split = obj.sequence.split("-"); // obj.split("-"); 
		

		// They should switch colours
		const react = () => { // 22/03/2024 21:34:11 Nice!!!
		let queries = obj.ranges; //["0px", "700px", "1200px", "1400px"];
		

		if (queries[0] !== "0px"){
			queries.unshift("0px");
		}

			for (var i = 0; i < queries.length - 1; i++) { // this has two elements 
				let mq = window.matchMedia(`(min-width: ${queries[i]}) and (max-width: ${queries[i + 1]})`).matches;
	
				if (mq) {    
					//	console.log("AFTER REFRESH MATCH " + split[i] + "AT: " + queries[i] + " - " + queries[i + 1]);

						if (split[i] === "row"){
							this.res.style.flexDirection = "row";
							///this.res.style.alignItems = "flex-end";
							this.res.style.border = "3px solid green";
						}

						if (split[i] === "col"){
							this.res.style.flexDirection = "column";
						//	this.res.style.justifyContent = "flex-start";
							this.res.style.border = "3px solid purple";
						}

			} else {
				let allQ = window.matchMedia(`(min-width: ${queries[queries.length - 1]})`);
				if (allQ.matches){
				//	alert("OKAY");

				if (split[i] === "row"){
					this.res.style.flexDirection = "row";
					///this.res.style.alignItems = "flex-end";
					this.res.style.border = "3px solid green";
				}

				if (split[i] === "col"){
					this.res.style.flexDirection = "column";
				//	this.res.style.justifyContent = "flex-start";
					this.res.style.border = "3px solid purple";
				}
			 }
			}
		}
		return this;
	}

	window.addEventListener("resize", react);
	react();
}

	sticky(){ // keep both!
		this.res.style.position = "sticky";
		this.res.style.top = 0;
		return this;
	}

	toSticky(){ // keep both!
        this.res.style.position = "sticky";
        this.res.style.top = "0";
        return this;
    }

	stretch(obj){


		const match = () => {
			
			let query = window.matchMedia(`(max-width: ${obj.at})`);
			if (query.matches){
				//alert("IN");
				this.res.style.width = "auto";
			} else {

				let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);

				if (mobileMedia.matches){
					this.res.style.width = "100%"; //"30%"; // 120446 back
					// Okay 14:43:30 
				} else {
					this.res.style.width = obj.backTo; //"30%"; // 120446 back
				}
				
			}
		}

		match();
		window.addEventListener("resize", match);
		// last 	
	}


	makeCol(){
		this.res.style.display = "flex";
		this.res.style.flexDirection = "column";
		this.res.style.alignItems = "flex-start";
		return this;
	}

	paddingo(el){
		this.res.style.padding = el;
		return this;
	}


	toCenter(dir){
		this.res.style.display = "flex";
		this.res.style.flexDirection = "column";
		this.res.style.justifyContent = "center";

		if (dir === "both"){
			this.res.style.alignItems = "center";
		}
	
		return this;
	}

	simpleCenter(){
		this.res.style.justifyContent = "center";
		this.res.style.justifyItems = "center";
		this.res.style.alignContent = "center";
		this.res.style.alignItems = "center";
		return this;
	}

	

	color(cl){
		this.res.style.color = cl;
		return this;
	}

	weight(w){
		this.res.style.fontWeight = w;
		return this;
	}

	makeMultiPad(obj){
	
		for (var i = 0; i < obj.length; i++){
			if (obj[i].side === "left"){
				
				this.res.style.paddingLeft = obj[i].value;
			}

			if (obj[i].side === "right"){
				this.res.style.paddingRight = obj[i].value;
			}
		}
		
		return this;
	}

	makeMultiMargin(obj){ // 11:22:52
		this.res.style.zIndex = "1";

		for (var i = 0; i < obj.length; i++){
			if (obj[i].side === "left"){
				this.res.style.marginLeft = obj[i].value;
			}

			if (obj[i].side === "right"){
				this.res.style.marginRight = obj[i].value;
			}

			if (obj[i].side === "top"){
				this.res.style.marginTop = obj[i].value;
			}

			if (obj[i].side === "bottom"){
				this.res.style.marginBottom = obj[i].value;
			}
		}
		
		return this;
	}

	flexc(obj){
		this.res.style.display = "flex";
		this.res.style.flexDirection = "column";
		this.res.style.justifyContent = "center";
		return this;
	}

	maxWidth(w){
		this.res.style.maxWidth = w;
		return this;
	}

	font(font){
		this.res.style.fontFamily = font;
		return this;
	}

	flexAlign(perc){
		this.res.style.display = "flex";
		this.res.style.justifyContent = "flex-start";
		this.res.style.alignItems = "flex-start";


		if (perc === "center"){
			
			this.res.style.display = "flex";
			this.res.style.flexDirection = "column";
			this.res.style.alignItems = "center";
			return this;

		}
		return this;
	}

	width(perc){
		this.res.style.width = perc;
		return this;
	}

	heightNoAuto(perc){
		this.res.style.height = perc;
		return this;
	}

	border(obj){ 
         this.res.style.borderRadius = `${obj.radius}px`;
         this.res.style.padding = "0.25em";
         this.res.style.border = `${obj.width}px solid ${obj.color}`;
         return this;
    }


	toCol(){
		this.res.style.display = "flex";
		this.res.style.flexDirection = "column";
		this.res.style.justifyContent = "center";
		this.res.style.alignItems = "center";
		return this;
	}

    
	add(els){
		this.items = els;
		this.code.push(".add([ \n");

		let finalCode = els//finalCodea
   		 .map((el, i) => el
				 .toCode()
				 .flatMap(l => l)
				 .join("") + (i < els.length - 1 ? "," : ""))
				 
         .join("");

		 this.code.push(finalCode);

		 for (var i = 0; i < els.length; i++){
			if (els[i] !== undefined && els[i].toCode !== undefined){
				let item = els[i].render();//.render();
				this.res.appendChild(item);
			}
		 }

		//122616 06/03 Houdini M2 chip
		this.code.push("])");
		return this;
	}

	

	arrayPadding(arr, value) {

		if (arr.includes("left")){
			this.res.style.paddingLeft = value;
		}
		
		if (arr.includes("right")){
			this.res.style.paddingRight = value;
		}
		
		if (arr.includes("top")){
			this.res.style.paddingTop = value;
		}
		
		if (arr.includes("bottom")){

			this.res.style.paddingBottom = value;
		}
			
		
		return this;
	}



	arrayMargin(arr, value) {


		if (!value){ // LTRB
			this.res.style.marginLeft = `${arr[0]}px`;
			this.res.style.marginTop = `${arr[1]}px`;
			this.res.style.marginRight = `${arr[2]}px`;
			this.res.style.marginBottom = `${arr[3]}px`;
		}



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
			
		
		return this;
	}

    
    
    setWidth(w){
        this.res.style.width = "100vw";
    }

	setHeight(w){
        this.res.style.height = `${w}`;
		return this;
    }
    
	setup(options) {

		let container = null;

		if (options){

			if (options.isLink){
				container = document.createElement("a") 
			}

			if (options === "aside"){
				container = document.createElement("aside");
			}

			if (options === "article"){
				container = document.createElement("article");
			}

			if (options === "main"){
				container = document.createElement("main");
			}

			if (options === "section"){
				container = document.createElement("section");
			}

			if (options === "header"){
				container = document.createElement("header");
			}

			if (options === "footer"){
				container = document.createElement("footer");
			}


		} else {
				container = document.createElement("div");
		}

		// let container = options ? document.createElement(options.isLink ? "a" : "div") :document.createElement("div") ;
		


		
		if (options && options.isLink){
			 container.style.textDecoration = "none";
			 container.setAttribute("href", options.child);	 
		}
		
		this.res = container;
		this.res.style.margin = 0;
		this.res.style.padding = 0;
        
        if (options && options.hideOverflow === true){
            this.res.style.overflow = "hidden";
             this.res.style.overflowY = "scroll";
        }
        
        if (options && options.center === true){
            this.res.style.display = "flex";
            this.res.style.flexDirection = "column";
            this.res.style.justifyContent = "center";
            this.res.style.alignItems = "center";
        }

        if (options && options.align === "left"){
             this.res.style.alignItems = "flex-start";
        }
        
         if (options && options.align === "right"){
             this.res.style.alignItems = "flex-end";
        }
        
         if (options && options.height){
            this.res.style.height = options.height;
         }
        
        
		if (options && options.width) {
			this.res.style.width = options.width;
			this.res.style.marginLeft = "auto";
			this.res.style.marginRight = "auto";

			let phone = window.matchMedia("(max-device-width: 415px)");

			if (phone.matches) {
				this.res.style.width = "95%";
			}
		}
        
		return this;
	}
	
	
	// 22:39:02 15/03/2024 window.addEveventListener("resize", () => {}, "immediatelly");
	
	
	height(h){
		this.res.style.width = "auto";
		this.res.style.height = `${h}`;
		return this;
	}
	
	size(w, h){
		this.w = w;
		this.h = h;
		
		if (this.w){
			this.res.style.width = this.w;
		} else {
			this.res.style.width = window.innerWidth;
		}
		
	if (this.h){
			this.res.style.height = this.h;
		} else {
			this.res.style.height = window.innerHeight;
		}
		
		
		return this;
	}

	background(color) {
		this.res.style.background = color;
		return this;
	}

	corner(corner) {
		// alert("Corner!");
		this.res.style.borderRadius = corner;
		return this;
	}
	
	padding(L, T, R, B){
		this.res.style.paddingLeft = L;
		this.res.style.paddingTop = T;
		this.res.style.paddingRight = R;
		this.res.style.paddingBottom = B;
		return this;
	}
	
	margin(L, T, R, B){
		this.res.style.marginLeft = L;
		this.res.style.marginTop = T;
		this.res.style.marginRight = R;
		this.res.style.marginBottom = B;
		return this;
	}
    
    itemWidth(w){
		for (var i = 0; i < this.res.childNodes.length; i++){
			let el = this.res.childNodes[i];
			el.style.width = w;
		}
		
		return this;
	}

	
apply(arr) {
	const goThroughStyles = () => {
		for (var i = 0; i < arr.length; i++) {
			let el = arr[i];
			
			
			
			let query = window.matchMedia(`(max-width: ${el.width}px)`);
			if (el.device){
				query = window.matchMedia(`(max-device-width: ${el.width}px)`);
				alert(el.device);
			}
			
			
			
			if (query.matches) {
				Object.assign(this.res.style, el.styles);
				// alert(el.style.styles.color);
			} else {
					//Object.assign(this.res.style, arr[0].styles);
			}
		}
	}
	
	// setFirst
	let query = window.matchMedia(`(max-width: ${arr[0].width}px)`);
	
	if (arr[0].device){
				query = window.matchMedia(`(max-device-width: ${arr[0].width}px)`);
		
			}
	
		if (!query.matches){
				Object.assign(this.res.style, arr[0].styles);
		}
	
	goThroughStyles();
	window.addEventListener("resize", goThroughStyles); 
	return this;
}
    
	mount(el){
		document.querySelector(el).appendChild(this.res);
	}
    
	render(el) {
		if (el) {
			let r = document.querySelector("#mount");
	
			document.querySelector(el).appendChild(this.res);
			return this;
		} else {
			return this.res;
		}
	}
}












export { Wrapper };
