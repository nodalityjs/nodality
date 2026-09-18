/*!
 * nodality v1.3.12
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


class Image extends Animator {
	constructor(url, type, mode, gcs) {
		super();
		this.url = url;
		this.res = null;
		this.code = [];

		
	}


	setType({url, type, mode}){
		//alert("Thrice?");

		this.code = [];

		if (type === "exact"){ // Has to be there
			const str = `new Image("${this.url}", "exact")`;
			this.code.push(str);
		} else if (type === "uncover"){ // Has to be there
			const str = `new Image("${this.url}", "uncover")`;
			this.code.push(str);
		} else {
			this.code.push(`new Image('${this.url}')`);
		}

		this.image(this.url, mode, type);

		return this;
	}


	hand(){
		this.res.style.cursor = "hand";
		return this;
	}



	getType(){ // 114145 anchor
		return "HTMLImageElement";
	}


	toCode() {
        // Capture the style properties applied to the image
        let styles = this.options;
        if (this.res.style.border) {
            styles.border = this.res.style.border;
        }

		const cleanedObj = Object.fromEntries(
   		 Object.entries(styles).filter(([key, value]) => value !== null)
		);

        // Generate the code representation (was styles)
        return [`new Image().set(${JSON.stringify(cleanedObj, null, 2).replace(/"(\w+)"\s*:/g, '$1:')})`];
    }
	
	// Utility method to format object strings and remove quotes from keys
	formatObj(obj) {
		// Use JSON.stringify to get a string with indentation
		let jsonString = JSON.stringify(obj, null, 2);
		
		// Remove quotes around object keys using regex
		return jsonString.replace(/"(\w+)"\s*:/g, '$1:');
	}

	set(options){


		let stra = ""

		this.options = options;
let obj = options;

		obj.onTap && this.onTap(obj.onTap);


		let type = options.isFull;


	//	options.isFull && (stra += `\n isFull: "${options.isFull}",`);


		if (type){
			this.image(options.url, "exact", type, "a");
		} else {
			this.setup();
		}


		// `src` belongs on an <img>. The "exact"/"uncover" modes build a <div>
		// and paint through background-image, and setting src on it produced
		// `<div src="…">` — invalid HTML that fetches nothing, and the shape
		// every generated card grid emitted. Nothing read it back: the SSG's
		// relative-path rewriter is scoped to `script[src^="./"]`.
		if (this.res.tagName === "IMG") {
			options.url && this.res.setAttribute("src", options.url);
		} else if (options.alt !== undefined) {
			// A background image carries no alt, so a caller who supplies one
			// gets the accessible equivalent. Additive: absent `alt`, the
			// element is byte-for-byte what it was.
			this.res.setAttribute("role", "img");
			this.res.setAttribute("aria-label", options.alt);
		}

		// Responsive sources + loading hints. All optional, so images that
		// don't pass them are byte-for-byte what they were before. Only
		// meaningful when the element is a real <img> (the default setup),
		// not the background-image path taken by "exact"/"uncover".
		if (this.res.tagName === "IMG") {
			options.srcset && this.res.setAttribute("srcset", options.srcset);
			options.sizes && this.res.setAttribute("sizes", options.sizes);
			options.alt !== undefined && this.res.setAttribute("alt", options.alt);
			options.loading && this.res.setAttribute("loading", options.loading);
			options.decoding && this.res.setAttribute("decoding", options.decoding);
			options.fetchPriority &&
				this.res.setAttribute("fetchpriority", options.fetchPriority);
		}

		  options.id && this.res.setAttribute("id",  options.id);
		options.id && (stra += ` id: "${options.id}", \n`);
		this.id = options.id;

		
	//	alert("Thrice?");

			if (type === "exact"){ // Has to be there
				const str = `new Image("${this.url}", "exact")`;
			} else if (type === "uncover"){ // Has to be there
				const str = `new Image("${this.url}", "uncover")`;
			} else {
			}


	this.commonMethods(obj);

		options.vtn && (this.res.style.viewTransitionName = options.vtn);
		this.vtn = options.vtn;

		options.minHeight && (this.res.style.minHeight = options.minHeight);

		options.index && super.setIndex(options.index);
		options.index && (this.index = options.index);
		options.index && (stra += `\n index: "${options.index}",`);

		options.resprop && this.resprop(options.resprop, options);
		
		if (options.centerSelf){
			this.res.style.marginRight = "auto";
			this.res.style.marginLeft = "auto";
		}

		if (options.fitContent){
			(this.res.style.width = "100%");
			(this.res.style.height = "100%");
			(this.res.style.marginRight = "auto");
			(this.res.style.marginTop = "auto");
			(this.res.style.objectFit = "cover");
		}

		options.objectFit && (this.res.style.objectFit = /*"cover")*/ options.objectFit);
		options.objectFit && (stra += `\n objectFit: "${options.objectFit}",`);

		// Companion to objectFit — chooses which part of a cropped image stays
		// visible (e.g. "center 38%" to favour faces over foreground).
		options.objectPosition && (this.res.style.objectPosition = options.objectPosition);
		options.objectPosition && (stra += `\n objectPosition: "${options.objectPosition}",`);


		options.as && this.as(options.as);
		
		options.onScroll && this.onScroll(options.onScroll);

		options.class && (this.res.setAttribute("class", options.class));
		
		options.gpos && (this.gposObject = options.gpos);

		if (options.gpos){
			this.res.style.gridColumn = options.gpos.col;
			this.res.style.gridRow = options.gpos.row;

			stra += `\n gpos: ${this.removeQuotesFromFirstWord(JSON.stringify(options.gpos))}, `;

		}
		
		
		// console.log(options);
		
	//	// console.log(filterObject);

		if (options.filtera){ // smoke
			
	

			let noiseObject;

			if (Array.isArray(options.filtera)){
				noiseObject = obj.filtera.filter(a => a.op.name === "filter")[0];
			} else {
				noiseObject = options.filtera;
			}

			// console.log("OPTAAA");
			// console.warn(noiseObject);
			// console.log(noiseObject.op.filter);


			 let removed =  this.removeQuotesFromFirstWord(JSON.stringify(noiseObject));
			 (stra += `\n filtera: ${removed}, \n`); // If I comment this out the filter should disappear!
		
			 // Relief... shadow and span works whe copied, but stroke and filter does not
		
			}

		
		

	
		options.keySet && this.keySet(options.keySet); 

		options.stype && this.setType(options.stype);

		options.isBackground && (this.isBackground = options.isBackground);

		options.zIndex && (stra += `\n zIndex: "${options.zIndex}", \n`);

	
			options.area && this.setArea(options.area);
			options.area && (stra += `area: "${options.area}", \n`);
		
		
			options.opacity && (this.res.style.opacity = options.opacity);
		

		// alert(options.height);
		options.width && (this.res.style.width = options.width);
		options.width && (stra += `width: "${options.width}", `);

		options.maxWidth && (this.res.style.maxWidth = options.maxWidth);
		options.maxWidth && (stra += `maxWidth: "${options.maxWidth}", `);

		options.height && (this.res.style.height = options.height);
		options.height && (stra += `height: "${options.height}", `);


		options.maxWidth && this.maxWidth(options.maxWidth);

		options.maxWidth && (stra += `maxWidth: "${options.maxWidth}", \n`);
		

		options.radius && this.cornerRadius(options.radius);


	options.radius && (stra += `radius: "${options.radius}", \n`);

	if (options.marginOp) {
		let stringified = this.removeQuotesFromFirstWord(JSON.stringify(options.marginOp));
		stra += `\n marginOp: ${stringified},`;
	}

	options.clipPath && this.clipPath(options.clipPath);
	options.clipPath && (stra += `clipPath: "${options.clipPath}", \n`);

	//@ img.reveal {object}: Reveal the image through a mask as it scrolls into view: {mask: "square", size: 0.3, duration: "1.2s", easing, zoom: 1.12, offset: 0.2, delay: "0s", once: true}. It starts as a centred square `size` × its shorter side and opens to the full frame once the square rises `offset` of the viewport height above the bottom edge. Owns clip-path and scale while it runs; reduced-motion visitors, and pages with no IntersectionObserver (the prerender), get the image unmasked.
	options.reveal && this.reveal(options.reveal);


// console.log("261");
// console.warn(obj);
	//----
	if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.marginOp || obj.shadow || obj.filtera || obj.animation){

		//alert("P")
		// use obj.range and obj.op
		
				
		
					let first = obj.gradient;
		
					if (obj.gradient){
		
					
		
					this.globalGradient = obj.gradient.op.gradient;
					// console.log(obj.gradient);
					}
		
					
					if (obj.stroke){
		
						// console.warn("OAP");
						// console.log(obj.stroke.op.color);
		
					//super.setVar("1px yellow");
					super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
		
					
					//super.globalBlast = `1px solid yellow`;//`${obj.stroke.op.width} ${obj.stroke.op.color}`;
					// console.warn("GBL")
					// console.warn(super.globalBlast);
					}
		
					
					// console.log("what here");
					// console.log(obj.marginOp);
		
					// Filter just the elements with layout element
					let ft = [obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp, obj.layout, obj.marginOp, obj.shadow, obj.filtera, obj.animation]//obj.gradient.filter(el => el.op.name !== "layout");
					// console.log(ft);
		
					ft = ft.filter(el => el != undefined);
		
		
		
		
					let arr = [];
		
					for (var i = 0; i < ft.length; i++){
						// console.log("Hello");
						arr.push({
							range: ft[i].range,
							log: ft[i].op.name,
							target: ft[i].target,
							op: ft[i].op
						});
					}
		
					// Maybe just fill-in dynamically
		
		
					  // Both only 600-650
		
		
		
		
					  // REDUNDANT?????
					  // console.log(arr);
					 
					
					  // UNCOMMENT THIS !!!
				
					//console.warn("CALLINGA BETA REACT");
					this.chainReact(arr, this.options.id);

		
					}		

	//---

	if (obj.shadow){
			
		let noiseObject = obj.shadow;
		let stringified = this.removeQuotesFromFirstWord(JSON.stringify(noiseObject));
		 (stra += `\n shadow: ${stringified},`);
	}

	if (obj.animation){
			
		let noiseObject = obj.animation;
		let stringified = this.removeQuotesFromFirstWord(JSON.stringify(noiseObject));
		 (stra += `\n animation: ${stringified},`);
	}
		

		let str = `\n .set({${stra}}) \n \n`;

		if (Object.keys(options).length > 0){
			this.code.push(str);
		} else {
			this.code.push(",")
		}

		return this;
	}




	setID(id){
		if (id !== undefined && id !== null) this.res.setAttribute("id", id);
		return this;
	}


	opacity(value){
		this.res.style.opacity = `${value}`;
		return this;
	}




	setGrid(){
		this.res.style.gridRow = "span 2";
		this.res.style.gridColumn= "span 3";
		return this;
	}

	transform(str){
		this.res.style.transform = str; //"rotate3d(.5,-.866,0,15deg)  rotate(60deg)";
		return this;
	}

	offset(){
		this.res.style.marginLeft = "-60px";
		return this;
	}


    
	setClass(name){
		this.res.setAttribute("class", name);
		return this;
	}




	onTap(e) {
		this.res.addEventListener("click", e);
		return this;
	}
    
    border(corners){
        this.res.style.borderTopLeftRadius = "16px";
        this.res.style.borderTopRightRadius = "16px";
        return this;
    }


	mobileWidth(){
		let query = window.matchMedia("(max-device-width: 415px)");
		if (query.matches){
			this.res.style.width = "120%";
		}


		return this;
	}
	

	image(url, mode, type, vtn, gcs){
		//alert(gcs);
		//alert(mode);
		//alert(value);
		let query = window.matchMedia("(max-device-width: 415px)");
		let back = document.createElement("div");
		//alert(vtn);
		back.style.viewTransitionName = vtn;
		back.style.width = "100%";
		back.style.height = this.options.height ? this.options.height : "400px";


		if (gcs){

		//alert("P")
		back.style.gridColumn = gcs.gridColumn;
		back.style.gridRow = gcs.gridRow;
		}
		
		if (query.matches){
			back.style.height = "500";
		}
		
		back.style.backgroundImage = `url(${url})`;
		back.style.backgroundPosition = "center center";
         back.style.backgroundRepeat = "no-repeat";
       
		 back.style.backgroundSize = "cover";
		

		 if (type === "uncover"){
			
            back.style.backgroundSize = "contain";
        }
        
        if (mode === "contain"){
			//alert("J")
            back.style.backgroundSize = "contain";
        }
        
        
	
		this.res = back;
		return this;	
	}


	setup() {
		let img = document.createElement("img");
	    img.style.width = "100%";
		img.src = this.url;
		this.res = img;

		
		return this;
	}


	float(dir){
		this.res.style.float = `${dir}`;
		return this;
	}


	
	grayscale(val){
		this.res.style.filter = `grayscale(${val}%)`;
		return this;
	}
	
	
	flex(val){
		this.res.style.flex = 1;
		return this;
	}
	
	height(h){
		 this.res.style.height = h;
		 this.res.style.width = "auto";
			return this;
	}


	expand(obj){


		
	


		const convert = (value) => {


			var convertedValue = value;

			if ((value.includes("%")) || value.includes("px")){
				
				convertedValue = convertedValue.substr(0, 2);
			}


			if (value.includes("%")){
				return Number(convertedValue / 100 * window.innerWidth);
			}

			if (value.includes("px")){
				return Number(convertedValue);
			}
			
		}

		const check = () => {
			let mq = window.matchMedia(`(min-width: ${obj.at})`);

			if (mq.matches){
			//	alert("MATCH")
				this.res.style.width = `${obj.width}`;

				let newWidth = window.innerWidth / 2 - convert(obj.width) / 2;
				// alert(newWidth);
				this.res.style.marginLeft = `${newWidth}px`; // `calc(${window.innerWidth}-${obj.width} / 2)`;
			} else {
				this.res.style.width = `100%`;
				this.res.style.marginLeft = `0px`;
			}


			let mqa = window.matchMedia(`(max-device-width: 415px)`);
if (mqa.matches){
	this.res.style.width = `100%`;
				this.res.style.marginLeft = `0px`;
}

			
		}


		check();

		window.addEventListener("resize", check);
		

		return this;
	}
	
	
	width(w){
		 this.res.style.width = w;
		 this.res.style.height = "auto";
		return this;
	}


	
	
	
	/**
	 * Width and height. Renamed from size(), which collided with the `size`
	 * OPTION — on any component that calls commonMethods, `size:` is the
	 * fluid type scale (S1…S6), so `.size()` meaning width read as the same
	 * word doing two unrelated jobs in one call chain.
	 */
	
	dimensions(w, h) {
		if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}

		return this;
	}

	//@deprecated size: on this component `size()` set width and height, which collided with the `size` option (fluid type scale). Use `dimensions(w, h)`.
	size(w, h) {
		this.deprecatedOption("size() on this component", "dimensions(w, h)");
		return this.dimensions(w, h);
	}


    
    
    frame(obj) {
        let w = obj.width;
        let h = obj.height;
        
		if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}

		return this;
	}


	
	
	
    shadow(obj){
        
        
        
        
        
        if (obj.type === "mild"){
        this.res.style.boxShadow = `0px 3px 15px rgba(0,0,0,0.2)`;
        } else {
             this.res.style.boxShadow = `${obj.x}px ${obj.y}px ${obj.radius}px ${obj.color}`;
       
        }
        
        
        return this;
    }


	
	cornerRadius(val){
		this.res.style.borderRadius = val;
		return this;
	}

	/**
	 * Scroll reveal through a mask. The masked state is applied only where it
	 * can be undone: with no window, no IntersectionObserver (the jsdom
	 * prerender) or a reduced-motion preference the image stays unmasked,
	 * because a mask that never opens hides the content for good.
	 *
	 * The square is a true square: clip-path's inset() percentages resolve
	 * per axis, so on a portrait or wide frame a percentage inset draws a
	 * rectangle. The insets are measured in px instead and re-measured when
	 * the frame resizes; the percentage form is only the pre-layout guess.
	 *
	 * The zoom uses the `scale` property, not `transform`, so it composes with
	 * any transform the page sets instead of overwriting it.
	 */
	reveal(opts) {
		const el = this.res;
		const o = opts && typeof opts === "object" ? opts : {};
		const mask = o.mask ?? "square";
		if (mask !== "square") {
			console.warn(`nodality: img.reveal mask "${mask}" is not supported — use "square".`);
			return this;
		}
		if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") return this;
		const reduced = typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) return this;

		const size = Math.min(1, Math.max(0, Number(o.size ?? 0.3)));
		const duration = o.duration ?? "1.2s";
		const easing = o.easing ?? "cubic-bezier(0.76, 0, 0.24, 1)";
		const delay = o.delay ?? "0s";
		const zoom = Number(o.zoom ?? 1.12);
		const once = o.once !== false;
		const transition = ["clip-path", "scale"].map((p) => `${p} ${duration} ${easing} ${delay}`).join(", ");

		let open = false;
		const closed = () => {
			const w = el.clientWidth, h = el.clientHeight;
			if (!w || !h) return `inset(${(1 - size) * 50}% ${(1 - size) * 50}%)`;
			const s = Math.min(w, h) * size;
			return `inset(${(h - s) / 2}px ${(w - s) / 2}px)`;
		};
		// Re-measuring a closed mask must not animate: the frame's first
		// layout would otherwise play as a 1.2s morph from the guess.
		const settle = () => {
			el.style.transition = "none";
			el.style.clipPath = closed();
			void el.offsetWidth;
			el.style.transition = transition;
		};

		el.style.clipPath = closed();
		el.style.scale = String(zoom);
		el.style.willChange = "clip-path, scale";
		el.style.transition = transition;

		const ro = typeof window.ResizeObserver === "function"
			? new window.ResizeObserver(() => { if (!open) settle(); })
			: null;
		ro && ro.observe(el);

		// Triggered by a LINE, not an area ratio: the browser clips the target
		// by its own clip-path when it measures the intersection, so a closed
		// square never shows more than its own share of the frame (about 8% at
		// size 0.3) and a `threshold` of 0.35 would never be reached. Instead
		// the square opens once it rises `offset` of the viewport above the
		// bottom edge.
		const offset = Math.min(0.9, Math.max(0, Number(o.offset ?? 0.2)));
		const io = new window.IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && !open) {
					open = true;
					el.style.clipPath = "inset(0px 0px)";
					el.style.scale = "1";
					if (once) { io.disconnect(); ro && ro.disconnect(); }
				} else if (!entry.isIntersecting && open && !once) {
					open = false;
					el.style.clipPath = closed();
					el.style.scale = String(zoom);
				}
			}
		}, { threshold: 0, rootMargin: `0px 0px ${-offset * 100}% 0px` });
		io.observe(el);

		el.addEventListener("transitionend", () => { if (open && once) el.style.willChange = "auto"; });
		return this;
	}

	clipPath(pathData) {
        // Create a unique ID for the clip path
       
        // Apply the clip-path to the element
        this.res.style.clipPath = `path("${pathData}")`; //`path("M 20 240 \
 //C 20 0 300 0 300 240 Z")`;

 let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.style.display = "block";
svg.style.width = "100%";
svg.style.height = "100%";
svg.style.overflow = "visible";


        return this;
    }

	render(el) {
		let ela = this.res;//document.createElement("div");
		// apply to every element maybe through the 


		if (el) {
			document.querySelector(el).appendChild(/*this.res*/ ela);
		} else {
			return ela; //this.res;
		}
	}
}

export { Image };
