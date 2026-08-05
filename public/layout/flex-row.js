import {Animator} from "./animator.js";

class FlexRow extends Animator {
	constructor(frs, saveEl) {
		super();
		this.code = []; // 191455
		this.saveEl = saveEl;
		this.frs = frs;
		this.res = null;
		this.setup();
		this.responsive();
	}

	getType(){
		return "FlexRowLayoutElement";
	}


	set(options){
		//alert("OJ")
		this.options = options;
		// console.log("OPTIONS ARE");
		// console.log(options);

		var obj = options;
		//------

		obj.onTap && this.onTap(obj.onTap);

		obj.id && this.res.setAttribute("id", obj.id); //"#ABC";
		obj.position && (this.res.style.position = obj.position); 	
		obj.top !== undefined && (this.res.style.top = obj.top); 


			// console.log("STAFF");
			// console.log(obj.id);
	//	}
//alert(obj.mar);
//// console.log("MARA");
//// console.log(obj.mar);
		
	
		

		// console.log("WITH BOP");
		// console.log(obj);
		
					//----------------


		
		options.id && this.res.setAttribute("id",  options.id);
		this.commonMethods(obj);

		if (options.padding){
			this.pad([{a: options.padding}]);
		}

	//alert(options.opacity);


		if (options.background){
			this.res.style.backgroundColor = "#ecf0f1";
			this.res.style.cornerRadius = "#3rem";
		}

		if (options.alignTo){
			//alert("J")
			this.res.style.justifyContent = options.alignTo;
		}

		
		


		if (options.background){
			this.res.style.backgroundColor = options.background;
		}

		if (options.justify){
			this.res.style.justifyContent = options.justify;
		}

		if (options.border) {
		
			if (options.border[0] === "top") {
				this.res.style.borderTop = `${options.border[1]} solid white`;
			//  border: ["top", "1px"],
			}

			if (options.border[0] === "all") {
				this.res.style.border = `${options.border[1]} solid orange`;
			//  border: ["top", "1px"],
			}

		

		}


		// Give this to animator
		if (options.borderObj){


this.borderObj(options.borderObj);
let stringified = JSON.stringify(options.borderObj);
			/*borderObj: {
				side: "all",
				width: "3px",
				color: "rgba(236, 227, 215, 0.5)"
			},*/
		}

		options.width && (this.res.style.width = options.width);

		options.height && (this.res.style.height = options.height);

		options.gap && (this.res.style.gap = options.gap);


		if (options.align){
			 let stringified = JSON.stringify(options.align);
			 this.res.style.alignItems = "flex-start";
			 this.res.style.alignItems = "flex-start";
		}
	
		// options.align && alert("K")

		options.wrap && this.wrap();
	//	options.wrap && this.code.push(`\n wrap: true,`)

		if (options.alignIts){
			let stringified = JSON.stringify(options.alignIts);
			 this.res.style.alignItems = "flex-start";
		
	}
		// options.alignIts && alert("J");
		//alignIts: "flex-start",

		options.owrap && this.onlyWrap();
		// options.owrap && this.code.push(`\n owrap: true,`)

		if (options.owrap != undefined){

		
		if (options.owrap === false){ // DANGEROUS
			// alert("FIRES AFTER OJ");
			this.res.style.flexWrap = "nowrap";
			this.res.style.background = "yellow";
		}
	}

	//	// console.warn(options);

		 // `toColumn` collapsed to a column unconditionally, ignoring the
		 // breakpoint it was given. `colat` is the documented option that
		 // actually honours one, via toColumnAt().
		 options.toColumn && this.deprecatedOption("toColumn", "colat");

	
		  options.column && this.makeCol(); // OK


		if (options.colat){
			
			options.colat && this.toColumnAt(options.colat);
		}
		 

		//alert(options.arrpad);


 


	//	alert(options.multipad);


		if (options.align){
			//alert("K")
			
			this.makeJustify(options.justify);
		}

		if (options.justify){
			
			this.makeAlign(options.justify);
		}
		if (options.justifo === "flex-start"){
		
			this.res.style.justifyContent = "flex-start";
		} else {
			//alert(options.justify);
		}
		
		// Use the passed value, not a hardcoded "1rem". commonMethods's
		// styleMap already maps radius → borderRadius, so this is a defensive
		// re-apply in case `borderObj()` (called above) clobbered it with an
		// undefined `borderObj.radius`.
		options.radius && (this.res.style.borderRadius = options.radius);

		options.aligns && this.aligns(options.aligns);
		


					 this.callReact(obj);

		// Centering shorthand: center: true → marginLeft/Right = auto (applied last so nothing overrides)
		if (options.center === true){
			this.res.style.marginLeft = "auto";
			this.res.style.marginRight = "auto";
		}

		return this;
	}


	callReact(obj){
        this.options = obj;

		let arr = [];

		// String transforms are plain CSS — handled by commonMethods. Only
		// object-shaped transforms (animation descriptors with .op) belong here.
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

			this.chainReact(arr, obj.id, keep);
		}
	}



	toColumnAt(at){ // THIS IS THE ONE!!!


		if (!this.columnAlways){

		
		const toCol = () => {
			
			let media = window.matchMedia(`(max-width: ${at})`);
			let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);

			if (media.matches || mobileMedia.matches){
				
				this.res.style.flexDirection = "column";
			} else {
				this.res.style.flexDirection = "row";

			}
		}

		toCol();
		window.addEventListener("resize", toCol);
	}
	

		  
	

		return this;
	}

// 1:32:56, 1:33:24 talk 17/08


	onlyWrap(){
		this.res.style.flexWrap = "wrap";
		return this;
	}

	wrap(){
		this.res.style.flexWrap = "wrap";
		this.res.style.justifyContent = "space-between";
		return this;
	}


	aligns(st){

		if (st === "start"){
			this.res.style.alignItems = "flex-start";
		}


		if (st === "end"){
			this.res.style.alignItems = "flex-end";
		}

		if (st === "center"){
			this.res.style.alignItems = "center";
		}


		// alert(st);

		return this;
	}


	toCode(){
		// copy and clean options
    const clean = {};
    for (let [k, v] of Object.entries(this.options || {})) {
        if (v !== undefined && v !== null && v !== "") {
            clean[k] = v;
        }
    }

    // stringify cleaned object
    const objString = JSON.stringify(clean, null, 4)
        .replace(/"([^"]+)":/g, '$1:')  // unquote keys
        .replace(/"([^"]*)"/g, (m, p1) => {
            // wrap multiline text/code in backticks
            if (p1.includes("\n")) return "`" + p1.replace(/`/g, "\\`") + "`";
            return `"${p1}"`;
        });

    // recurse into children that support toCode()
    const itemsCode = (this.items || [])
        .map(item => (item?.toCode ? item.toCode() : "/* element */"))
        .join(",\n    ");


    return [[
        `new FlexRow().set(${objString})`,
        itemsCode ? `.items([\n    ${itemsCode}\n])` : ""
    ].join("")]; //commented out

	}


	

	cornerRadius(el){
		this.res.style.borderRadius = el;
		return this;
	}
	


	makeJustify(opt){
		//alert("KJ");
		if (opt === "start"){

			// alert("HJ");
		this.res.style.justifyContent = "flex-start";
		}

		return this;
	}


	makeAlign(opt){
		//alert("KJ");
		if (opt === "center"){

			// alert("HJ");
		this.res.style.alignItems = "center";
		} else {

		


			
				//alert(opt)
				this.res.style.justifyContent = opt;
		}

		return this;
	}

	
 makeCol(){
	this.res.style.flexDirection = "column";
	return this;
 }


    
    
    
    setClass(classa){
         this.res.setAttribute("class", classa);
        return this;
    }
    

	setup() {
		let flex = document.createElement("div");
		flex.style.display = "flex";
		flex.style.justifyContent = "space-around";
        flex.style.alignItems = "center";
		this.res = flex;


		//// console.log("FREDERICK!");
		//// console.log(this);

		

		return this;

		// 19:36:06 Houdini Roger kilimanjaro 06/03 audiovisual
	}


	/*
	{
		if 
	}
	
	*/
    
    
    
    
     frame(obj){
        this.res.style.width = obj.width;
        this.res.style.height = obj.height;
         
         
         let media = window.matchMedia("(max-device-width: 415px)");
         
         if (media.matches && obj.mobile){
              this.res.style.width = obj.mobile
         }
         
        return this;
    }
    
     background(color){
        this.res.style.background = color;
        return this;
    }
    
    radius(val){
        this.res.style.borderRadius = `${val}px`;
        return this;
    }
    
    shadow(x, y, radius){
          this.res.style.boxShadow = "0px 1px 10px 0px rgb(145 145 145)"; //`${x}px ${y}px ${radius}px #000`;
        return this;
    }
    
    onTap(e){
		this.res.addEventListener("click", e);
		return this;
	}
	
	
	items(arr) {
		//// console.log("2 images enter flex row")
		//// console.warn(arr); // 2 images enter flexRow or there is problem in FlexRow code gen


		this.els = arr;
		this.items = arr;

/*
		// console.log("FL ITEM---");
		// console.log(arr);
		// console.log("/FL ITEM---");*/

		for (var i = 0; i < arr.length; i++) {
			
		
			
			
		//	// console.error(arr[i].render);
			
		if (arr[i] != undefined){
		if (arr[i].render instanceof Function){ // 170736
				let r = arr[i].render();
				   this.res.appendChild(r);
			} else {
				this.res.appendChild(arr[i]);
			}
		}
		


			if (arr[i] != undefined){
			

			
			
			if (arr[i].render instanceof Function){
				let item = arr[i].render();//.render();
				this.res.appendChild(item);
			
	
				if (arr[i].toCode !== undefined){
				//	// console.log("arr[i]");
				//	// console.log(arr[i]);
					 this.code.push(arr[i].toCode().flatMap(l=>l)); // 20:10:00 Nice!
				// 12:25:10 Wow!!!


				// Image codegen problem
			}
		}
	}
			
			

		
			//// console.log("FREDERICK!");

		}


		
		return this;
	}


	
	responsive(h){
		let media = window.matchMedia(`(max-device-width: 415px)`);
		
		const adjust = () => {
			if (window.innerWidth < h || media.matches){
			this.res.style.gridTemplateColumns = "1fr";
		} else {
			this.res.style.gridTemplateColumns = "1fr 1fr";
		}
		}
		
		
		if (window.innerWidth < h || media.matches){
			this.res.style.gridTemplateColumns = "1fr";
		} else {
			this.res.style.gridTemplateColumns = "1fr 1fr";
		}
		
		
		window.addEventListener("resize", adjust);
		
		
		return this; // :D
		return this;
	}
	
	
	render(el) {
		if (el){
		document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
export { FlexRow };
