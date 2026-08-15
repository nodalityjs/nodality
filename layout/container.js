/*!
 * nodality v1.1.4
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

import { toObjectSource } from "../lib/codegen.js";
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

        const objString = toObjectSource(cleanedObj, 2);

        code += `\n${pad}  .set(${objString})`;
    }

    if (this.items?.length) {
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






	set(obj){
		this.obj = obj;

				this.commonMethods(obj);

		obj.onTap && this.onTap(obj.onTap);

		let stra = ".set({";

  //@ isHidden: Hide the element.
		obj.isHidden && this.isHidden(obj.isHidden);
		obj.scale && (this.res.style.scale=obj.scale);
		obj.scale && (stra += `scale: ${obj.scale}`);
		obj.keySet && this.keySet(obj.keySet);
		obj.resprop && this.resprop(obj.resprop);
		obj.position && (this.res.style.position = obj.position);
		obj.top !== undefined && (this.res.style.top = obj.top);
		// ------
		obj.pad && this.pad(obj.pad);
		obj.mar && this.mar(obj.mar);

  //@ gpos: Grid placement — {col, row}, written to grid-column and grid-row.
		obj.gpos && this.gpos(obj.gpos);


		let arr = [];

		// Plain CSS string transforms are handled by commonMethods. Only
		// object-shaped transform descriptors enter the animation pipeline.
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

		if (_hasAnimTransform){
			keep.push("transform");
		}

		if (obj.gradient){
			keep.push("gradient");
		}

		if (obj.blast){
		}

		// console.log("ARA IS " + arr);
		this.options = obj;
			 this.chainReact(arr, this.options.id, keep);
		}

		
	
		obj.centerColumn && this.deprecatedOption("centerColumn", 'center: "x"');

//@deprecated mboth: superseded by `mar: "center"`. Still works, but warns.
	// NOT wired to `center`: on a Wrapper `center` calls toCenter(), which
	// sets display:flex + justify-content:center and centres the wrapper's
	// CHILDREN. `mboth` centres the wrapper ITSELF in its parent via auto
	// margins. Pointing one at the other would relayout every page using it.
	if (obj.mboth) {
		this.deprecatedOption("mboth", 'mar: "center"');
		this.mar("center");
	}

	obj.mar && this.mar(obj.mar); // has to be here

 //@ sticky: Stick to the top of the scroll container (position: sticky; top: 0).
	obj.sticky && this.sticky();

	obj.transition && (this.res.style.transition = obj.transition);

	obj.class && this.res.setAttribute("class", obj.class);

 //@ ga: CSS grid-area, verbatim.
	obj.ga && (this.res.style.gridArea = obj.ga);

		if (obj.opacity) {
			obj.opacity == 0 && (this.res.style.opacity = 0);
			obj.opacity && (this.res.style.opacity = obj.opacity);
		}

		obj.maxHeight && (this.res.style.maxHeight = obj.maxHeight);

		obj.id && this.res.setAttribute("id",  obj.id);

		
		
		//	obj.arrpad && (stra += `arrpad: {sides: ["${obj.arrpad.sides}"], value: "${obj.arrpad.value}"}, `); // 2345 06/03
		
		// COMMENTED OUT 08/01/2025


		obj.simpleCenter && this.deprecatedOption("simpleCenter", 'center: true');
		
		obj.filter && (this.res.style.backdropFilter = "blur(3px)"); // 002506 21/05 002945
		obj.radius && this.corner(obj.radius);

	
		obj.radius && (stra += `\n radius: "${obj.radius}",`);
		obj.border && this.border(obj.border);

  //@ simpleBorder: Border as one CSS shorthand string, e.g. "1px solid #eee".
		obj.simpleBorder && (this.res.style.border = obj.simpleBorder);

		obj.width && this.width(obj.width);
		obj.width && (stra += `\n width: "${obj.width}",`);	


		// Overflow is handled by commonMethods (styleMap) — it now respects
		// the actual value (visible / hidden / auto / scroll / clip), not
		// just hard-coded "hidden". Kept here only for codegen output.
		obj.overflow && (stra += `\n overflow: "${obj.overflow}",`);

		obj.height && this.heightNoAuto(obj.height);
		obj.height && (stra += `\n height: "${obj.height}",`);	

		obj.align && this.flexAlign(obj.align);
		obj.align && (stra += `\n align: "${obj.align}",`);	

	

		if (obj.borderObj){
			this.res.style.border = `${obj.borderObj.width} solid ${obj.borderObj.color}`
			// Only touch borderRadius when caller provided one — otherwise we'd
			// clobber the radius set via styleMap (e.g. `radius: "50%"`).
			if (obj.borderObj.radius !== undefined) {
				this.res.style.borderRadius = obj.borderObj.radius;
			}

			/*borderObj: {
				side: "all",
				width: "3px",
				color: "rgba(236, 227, 215, 0.5)"
			},*/
		}

		// borderObja kept as alias for backwards compatibility
		if (obj.borderObja){
			this.res.style.border = `${obj.borderObja.width} solid ${obj.borderObja.color}`
			if (obj.borderObja.radius !== undefined) {
				this.res.style.borderRadius = obj.borderObja.radius;
			}
		}

		obj.font && this.font(obj.font);
		obj.font && (stra += `font: "${obj.font}",`);	
		obj.maxWidth && this.maxWidth(obj.maxWidth);
		obj.flexCenter && this.deprecatedOption("flexCenter", 'center: "y"');
		obj.color && this.color(obj.color);
		obj.background && this.background(obj.background);
		obj.background && (stra += `background: "${obj.background}",`);	

		obj.weight && this.weight(obj.weight);
  //@ paddings: Padding via the paddingo() form.

		obj.area && this.setArea(obj.area);
		obj.area && (stra += `area: "${obj.area}"`);
		obj.column && this.makeCol();
		obj.column && (stra += `\n column: "${obj.column}",`);


  //@deprecated alignIts: obsolete. Its body sets background:"gray" and hardcodes alignItems/justifyItems to flex-start with the argument commented out — debugging left in. Use `customAlign` / `customJustify`.
		obj.alignIts && (this.res.style.background = "gray");
		obj.alignIts && (this.res.style.alignItems = "flex-start"/*obj.alignIts*/);
		obj.alignIts && (this.res.style.justifyItems = "flex-start"/*obj.alignIts*/);
		
  //@ customAlign: align-items, verbatim — for values `align` does not cover.
		obj.customAlign && (this.res.style.alignItems = obj.customAlign);
  //@ customJustify: justify-items, verbatim.
		obj.customJustify && (this.res.style.justifyItems = obj.customJustify);
  //@ disp: CSS display, verbatim — "block", "grid", "inline-flex".
		obj.disp && (this.res.style.display = obj.disp);
  //@ flexDir: Flex direction. Also sets display:flex, so it is enough on its own.
		obj.flexDir && (this.res.style.flexDirection = obj.flexDir);
		obj.flexDir && (this.res.style.display = "flex");
		obj.flexDir && (stra += `\n flexDir: "${obj.flexDir}",`)

  //@ center: Centres this element's CHILDREN. `true` for both axes, `"x"` horizontal, `"y"` vertical. Axis-aware: in a flex column `"y"` is justify-content, in a row it is align-items. To centre the element itself inside its parent, use `mar: "center"`.
		// After disp and flexDir on purpose: center() reads the layout mode
		// already on the element to decide which property owns which axis,
		// so it has to run once the mode is set. Dispatched earlier it saw a
		// bare element every time and always assumed a flex column.
		obj.center && (stra += `center: ${JSON.stringify(obj.center)},`);

		obj.zIndex && (this.res.style.zIndex = obj.zIndex);
	
		// String transforms are handled by commonMethods. Only object-shaped
		// transform descriptors (with .op / .transform) go to the animation system.
		(obj.transform && typeof obj.transform === "object") && this.reactOnTransform(obj.transform);
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
							this.res.style.border = "3px solid green";
						}

						if (split[i] === "col"){
							this.res.style.flexDirection = "column";
							this.res.style.border = "3px solid purple";
						}

			} else {
				let allQ = window.matchMedia(`(min-width: ${queries[queries.length - 1]})`);
				if (allQ.matches){
				//	alert("OKAY");

				if (split[i] === "row"){
					this.res.style.flexDirection = "row";
					this.res.style.border = "3px solid green";
				}

				if (split[i] === "col"){
					this.res.style.flexDirection = "column";
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


	

	color(cl){
		this.res.style.color = cl;
		return this;
	}

	weight(w){
		this.res.style.fontWeight = w;
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



	heightNoAuto(perc){
		this.res.style.height = perc;
		return this;
	}

	border(obj){ 
         this.res.style.borderRadius = `${obj.radius}px`;
         // No padding here. It used to set 0.25em, which runs after pad()
         // in set() and silently overwrote it: {pad: [{a: 40}], border: {…}}
         // rendered 4px, not 40px. A border has no business sizing the box.
         this.res.style.border = `${obj.width}px solid ${obj.color}`;
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
	
	
	
	
	height(h){
		this.res.style.width = "auto";
		this.res.style.height = `${h}`;
		return this;
	}
	/**
	 * Width and height. Renamed from size(), which collided with the `size`
	 * OPTION — on any component that calls commonMethods, `size:` is the
	 * fluid type scale (S1…S6), so `.size()` meaning width read as the same
	 * word doing two unrelated jobs in one call chain.
	 */
	
	dimensions(w, h) {
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

	//@deprecated size: on this component `size()` set width and height, which collided with the `size` option (fluid type scale). Use `dimensions(w, h)`.
	size(w, h) {
		this.deprecatedOption("size() on this component", "dimensions(w, h)");
		return this.dimensions(w, h);
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


	
apply(arr) {
	const goThroughStyles = () => {
		for (var i = 0; i < arr.length; i++) {
			let el = arr[i];
			
			
			
			let query = window.matchMedia(`(max-width: ${el.width}px)`);
			if (el.device){
				query = window.matchMedia(`(max-device-width: ${el.width}px)`);
							}
			
			
			
			if (query.matches) {
				Object.assign(this.res.style, el.styles);
			} else {
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
