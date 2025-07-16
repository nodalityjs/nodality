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
		this.code.push(" new FlexRow()");
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
		
		
		obj.id = "#ABC";
		

		if (obj.gradient){
			// console.log("STAFF");
			// console.log(obj.id);
		}
//alert(obj.mar);
//// console.log("MARA");
//// console.log(obj.mar);
		obj.pad && this.pad(obj.pad);
		obj.mar && this.mar(obj.mar);
		

		// console.log("WITH BOP");
		// console.log(obj);
		if (obj && obj.id && obj.stroke || obj && obj.id && obj.gradient || obj && obj.id && obj.span || obj && obj.id && obj.backgroundOp){
			//alert("P")
						if (obj.gradient){
						this.globalGradient = obj.gradient.op.gradient;
			
						} // OK
			
						if (obj.stroke){
						super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
						}
			
						// Filter just the elements with layout element
						let ft = [obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp]//obj.gradient.filter(el => el.op.name !== "layout");			
						ft = ft.filter(el => el != undefined);
			
						let arr = [];
			
						for (var i = 0; i < ft.length; i++){
							arr.push({
								range: ft[i].range,
								log: ft[i].op.name,
								target: ft[i].target
							});
						}
			
						  // console.log("-----RDAAA----");
						  // console.log(arr);
						  // console.log(obj.id);
						  this.res.setAttribute("id", obj.id);
						  this.betaReact(arr, obj.id);
						 // this.protoReact(arr, obj.id);
					} // 17:06:00 17/03/2024 Yes!!!

					//----------------


		
		options.id && this.res.setAttribute("id",  options.id);
		this.code.push(`\n .set({`);
		if (options.padding){
			this.padding(options.padding);
		}

	//alert(options.opacity);
		//(options.opacity === 0) && (this.res.style.opacity = 0 /*options.opacity*/);


		if (options.background){
			this.res.style.backgroundColor = "#ecf0f1";
			this.res.style.cornerRadius = "#3rem";
		}

		if (options.alignTo){
			//alert("J")
			this.res.style.justifyContent = options.alignTo;
		//	let stringified = JSON.stringify(options.alignTo);
			//this.code.push(`\n alignTo: "${stringified}",`);
		}

		
		



		if (options.background){
			this.res.style.backgroundColor = options.background;
			this.code.push(`\n background: "${options.background}",`);
		}

		if (options.justify){
			this.res.style.justifyContent = options.justify;
			this.code.push(`\n justify: "${options.justify}",`);
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

		

			this.code.push(`\n border: ["${options.border[0]}", "${options.border[1]}"],`);
		}


		// Give this to animator
		if (options.borderObj){

		/*	let type = options.borderObj.type ?? "solid";


			this.res.style.border = `${options.borderObj.width} ${type} ${options.borderObj.color}`
			this.res.style.borderRadius = options.borderObj.radius; 
			
			let stringified = JSON.stringify(options.borderObj);
			this.code.push(`\n borderObj: ${stringified},`);
*/

this.borderObj(options.borderObj);
let stringified = JSON.stringify(options.borderObj);
		this.code.push(`\n borderObj: ${stringified},`);
			/*borderObj: {
				side: "all",
				width: "3px",
				color: "rgba(236, 227, 215, 0.5)"
			},*/
		}

		options.width && (this.res.style.width = options.width);
		options.width && this.code.push(`\n width: "${options.width}",`);

		options.height && (this.res.style.height = options.height);
		options.height && this.code.push(`\n height: "${options.height}",`);


		if (options.align){
			 let stringified = JSON.stringify(options.align);
			 this.res.style.alignItems = "flex-start";
			 this.code.push(`\n alignIts: "flex-start",`);
			 this.res.style.alignItems = "flex-start";
		}
	
		// options.align && alert("K")

		options.wrap && this.wrap();
		options.wrap && this.code.push(`\n wrap: true,`)

		if (options.alignIts){
			let stringified = JSON.stringify(options.alignIts);
			 this.res.style.alignItems = "flex-start";
			this.code.push(`\n alignIts: ${stringified},`);
		
	}
		// options.alignIts && alert("J");
		//alignIts: "flex-start",

		options.owrap && this.onlyWrap();
		options.owrap && this.code.push(`\n owrap: true,`)

		if (options.owrap != undefined){

		
		if (options.owrap === false){ // DANGEROUS
			// alert("FIRES AFTER OJ");
			this.res.style.flexWrap = "nowrap";
			this.res.style.background = "yellow";
		}
	}

	//	// console.warn(options);

	//	options.columnAlways && (this.columnAlways = true);
		 options.columnAlways && alert("JIJ" + options.columnAlways);

		 options.toColumn && this.toColumn(options.toColumn); // OK

	
		  options.column && this.makeCol(); // OK



		if (options.colat){
			
			options.colat && this.toColumnAt(options.colat);
			this.code.push(`\n colat: "${options.colat}",`);
		}
		 

		//alert(options.arrpad);
		options.arrayPadding && this.arrayPadding(options.arrayPadding.sides, options.arrayPadding.value);


		options.arrayMargin && this.arrayMargin(options.arrayMargin.sides, options.arrayMargin.value);
		this.arrayMarginValue = options.arrayMargin;
		options.arrayMargin && this.code.push(`\n arrayMargin: {sides: [${options.arrayMargin.sides.map(m => `"${m}"`).join(", ")}], value: "${options.arrayMargin.value}"},`); // 2345 06/03

	//	alert(options.multipad);

		options.multipad && this.makeMultiPad(options.multipad);

		if (options.align){
			//alert("K")
			
			this.makeJustify(options.justify);
		//	 this.setAlign(options.align);
		}

		if (options.justify){
			
			this.makeAlign(options.justify);
		//	 this.setAlign(options.align);
		}
		//this.res.style.justifyContent = "flex-start";
		//alert(this.res.style.justifyContent);
		if (options.justifo === "flex-start"){
		
			this.res.style.justifyContent = "flex-start";
		} else {
			//alert(options.justify);
		}
		
		options.radius && (this.res.style.borderRadius = "1rem");

		//const obj = options;
		options.aligns && this.aligns(options.aligns);
		

		/*if (obj && obj.stroke || obj &&  obj.gradient || obj &&  obj.span){


			if (obj.gradient) {
				this.globalGradient = obj.gradient.op.gradient;
				// console.log(obj.gradient);
			}
			
						
						if (obj.stroke){
							// console.warn("OAP");
							// console.log(obj.stroke.op.color);
			
						super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
			
						// console.warn("GBL");
						// console.warn(super.globalBlast);
						}
			
						// Filter just the elements with layout element
						let ft = [obj.stroke, obj.gradient, obj.animation, obj.span]//obj.gradient.filter(el => el.op.name !== "layout");
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
			
						  // console.log(arr);
						  this.protoReact(arr, options.id);
					}*/

		this.code.push(`\n })`);
		return this;
	}

	


	setArea(area){
		this.res.style.gridArea = area;
		return this;
	}

	toColumnAt(at){ // THIS IS THE ONE!!!


		if (!this.columnAlways){
// alert(this.columnAlways);

		
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
		// alert("oj")
		this.res.style.flexWrap = "wrap";
		this.res.style.backgroundColor = "green";
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


	toColumn(at){
		 alert("ON")

		const toCol = () => {
			let media = window.matchMedia(`(max-width: ${at})`);
			let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);
			// alert(media);

			//// console.log(mobileMedia);

			if (media.matches || mobileMedia.matches){
				this.res.style.flexDirection = "column";
			} else {
				this.res.style.flexDirection = "row";

			}
		}

		toCol();
		window.addEventListener("resize", toCol);
	

		
	

		return this;
	}


	toCode(){
	 const objString = JSON
        .stringify(this.options, null, 4)
        .replace(/"([^"]+)":/g, '$1:');

    const itemsCode = this.items.map(item => item.toCode()).join(",\n    ");

    return [
        `new FlexRow().set(${objString}).items([`,
        `    ${itemsCode}`,
        `])`
    ].join("\n");
		//return this.code; // 21:40:09
	}

	arrayPadding(arr, value) {
		if (arr.includes("left")){
			this.res.style.paddingLeft = value;
		}
		
		if (arr.includes("right")){
			//alert("P")
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

	borderAround(data){
		this.res.style.border = data;
		return this;
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
			//	let stringified = JSON.stringify(options.alignTo);
				//this.code.push(`\n alignTo: "${stringified}",`);
		}

		return this;
	}

	
 makeCol(){
	this.res.style.flexDirection = "column";
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



	padding(vals){
		this.res.style.padding = vals;
		return this;
	}
	
	center() {
	//	this.res.style.justifyItems = "center";
		return this;
	}
    
    toColumn(){
        this.res.style.flexDirection = "column";
        return this;
    }
    
    
    
    setClass(classa){
         this.res.setAttribute("class", classa);
        return this;
    }
    
    toCenter(classa) {
        this.res.style.marginLeft = "auto";
        this.res.style.marginRight = "auto";
         this.res.setAttribute("class", classa);
        return this;
    }

	setup() {
		let flex = document.createElement("div");
		flex.style.display = "flex";
		flex.style.justifyContent = "space-around";
        flex.style.alignItems = "center";
		flex.style.margin = 0;
		// flex.style.width = "100%";
		this.res = flex;


		//// console.log("FREDERICK!");
		//// console.log(this);

		

		return this;

		// 19:36:06 Houdini Roger kilimanjaro 06/03 audiovisual
	}


	noSpaceAround(){
		this.res.style.justifyContent = "";
		return this;
	}




	itemAlignCenter(){
		this.res.style.justifyContent = "center";
        this.res.style.alignItems = "center";
		return this;
	}


	/*
	{
		if 
	}
	
	*/
    
    arrayMargin(arr, value) {

		//alert(arr);
		//alert(value);

		// alert(window.matchMedia("(max-device-width: 415px)").matches) 
//alert("K")
		if (!value){ // LTRB
			this.res.style.marginLeft = `${arr[0]}px`;
			this.res.style.marginTop = `${arr[1]}px`;
			this.res.style.marginRight = `${arr[2]}px`;
			this.res.style.marginBottom = `${arr[3]}px`;
		}


	//	alert("ROW.js 452"); //003337
		//alert(value);
		if (arr.includes("left")){
			this.res.style.marginLeft = `${value}px`;
		}
		
		if (arr.includes("right")){
			this.res.style.marginRight = `${value}px`;
		} // 161357 Surovikin line
		
		if (arr.includes("top")){
			// alert(value)
			this.res.style.marginTop = `${value}px`;
		}
		
		if (arr.includes("bottom")){
			this.res.style.marginBottom = `${value}px`;
        }
		return this;
	}
    
    
    
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

		//// console.warn(this.res);

		this.els = arr;
		this.items = arr;
		this.code.push(".items([");

/*
		// console.log("FL ITEM---");
		// console.log(arr);
		// console.log("/FL ITEM---");*/

		for (var i = 0; i < arr.length; i++) {
			
		
			
			
		//	// console.error(arr[i].render);
			
		if (arr[i] != undefined){
		if (arr[i].render instanceof Function){ // 170736
				let r = arr[i].render();
				// r.style.width = "100%";
				   //r.style.flex = 1;
				   this.res.appendChild(r);
			} else {
				this.res.appendChild(arr[i]);
			}
		}
		


			//this.code.push("L");


		/*	if (arr[i].toCode instanceof Array){
				// // console.warn(arr[i].toCode().flatMap(x => x));
				this.code.push(arr[i].toCode().flatMap(x => x));
			} else {
				if (arr[i].toCode){
					this.code.push(arr[i].toCode());
					
	
	
					
				}
			}*/


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
			//// console.log(this.code);

			//this.code = this.code.flatMap(x => x).flatMap(x => x);
		}


		this.code.push("])");


		// this.code = this.code.flatMap(x => x);
	//	// console.log(this.code);


		
		return this;
	}



	/*
	
		this.code.push(".add([ \n");
		for (var i = 0; i < els.length; i++){
			let item = els[i].render();//.render();
			this.res.appendChild(item);


			if (els[i].toCode !== undefined){

				 this.code.push(els[i].toCode().flatMap(l=>l)); // 20:10:00 Nice!
			// 12:25:10 Wow!!!

			
		}
		}
		
		//122616 06/03 Houdini M2 chip
		this.code.push("])");


		return this;
	*/


	

	adjustRatiosForLayout(){

		if (this.els[1].getWidth == undefined){
			return this;
		}

		if (this.els[1].getHeight == undefined){
			return this; // 171653 fix
		} // 171354

		window.addEventListener("resize", () => {
			this.resizeValues();
		});


		this.resizeValues();




		// 18:29:04
		
		return this;
	}
	

	resizeValues(){
		let newWidth = window.innerWidth * 0.7;
			let aspect = (this.els[1].getHeight() / this.els[1].getWidth());
			let goal = newWidth * aspect;
	
			this.res.children[0].style.height = `${goal}px`;
			this.res.children[0].style.width = `30%`;
			this.res.children[1].style.width = `70%`;
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
		// // console.log("BORDER:" + this.res.style.border);
		if (el){
		document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
export { FlexRow };
