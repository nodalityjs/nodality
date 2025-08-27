/*!
 * nodality v1.0.0-beta.100
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


// Add code-gen after backup
class FlexGrid extends Animator {
	constructor(){
		super();
		this.code = [];
		this.setup();
	}

	toCode(){
		return this.code;
	}
	
	setup(){
		this.code.push("new FlexGrid()");
		this.code.push(".setup()")
		let gr = document.createElement("div");
		gr.style.display = "flex";
		//gr.style.flexWrap = "wrap";
		
		gr.style.padding = 0;
		gr.style.margin = 0;
		//gr.style.width = "100%";
		this.res = gr;
		return this; // DANGEROUS FEBRUARY ?
	}

	// flex: 1, maxWidth: "400px", wrap: true

	getType(){
		return "FlexRowLayoutElement";
	}

	set(options){
		this.code.push(".set({");
	//	this.code.push(JSON.stringify(options));
	//	console.log("OPE");

		options.gap && (this.code.push(`gap: ${options.gap}`));
		options.gap && (this.res.style.gap = options.gap);
		
		options.width && this.code.push(`width: "${options.width}",`);
		options.flex && (this.res.style.flex = options.flex);
		options.flex && this.code.push(`flex: ${options.flex},`);

		options.maxWidth && (this.res.style.maxWidth = options.maxWidth);
		options.maxWidth && this.code.push(`maxWidth: "${options.maxWidth}",`);

		options.maxWidth && (this.res.style.minWidth = "400px");
		options.maxWidth && (this.res.style.marginLeft = "auto");
		options.maxWidth && (this.res.style.marginRight = "auto");

	//	this.res.style.width = "400px"
		options.width && (this.res.style.width = `${options.width}`);
		options.wrap && (this.res.style.flexWrap = `wrap`); // ok

		options.wrap && this.code.push(`wrap: ${options.wrap},`);
		
		options.align && (this.res.style.justifyContent = options.align);
		options.align && this.code.push(`align: ${options.align},`);


			
			options.colat && this.toColumnAt(options.colat);
			options.colat && this.code.push(`\n colat: "${options.colat}",`);
		


		this.code.push("}),");

		let obj = options;

		this.callReact(obj);
		// console.log(this.code);
		return this;
	}



	callReact(obj){
        this.options = obj;

		let arr = [];

		if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform){
			if (obj.gradient){
				this.globalGradient = obj.gradient.op.gradient;
			
				if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(orange, green)";
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

	/*	if (obj.transform){
			keep.push("transform");
		}*/

		// console.log("ARA IS " + arr);
		console.log("ARA IS ");
		console.log(arr);

			this.chainReact(arr, obj.id, keep);
		}
	}

	


	toColumnAt(at){ // THIS IS THE ONE!!!


		if (!this.columnAlways){
// alert(this.columnAlways);

		
		const toCol = () => {
			
			let media = window.matchMedia(`(max-width: ${at})`);
			let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);

			if (media.matches || mobileMedia.matches){
				
				this.res.style.flexDirection = "column";
				this.res.style.alignItems = "center";
			} else {
				this.res.style.flexDirection = "row";

			}
		}

		toCol();
		window.addEventListener("resize", toCol);
	}
}
	
	 flex(str){
		this.arra = Array.from(str.replace(/\s/g, ''));
		this.areas = Array.from(Array(str.replace(/\s/g, '')).join(""));
		this.save = `"${str}"`;
		return this;
	}
	
	
	padding(value){
		this.res.style.padding = `${value}px`;
		return this;
	}
	
	
	center(){
		this.res.style.marginLeft = "auto";
		this.res.style.marginRight = "auto";
		return this;
	}
	
	items(elements){
		this.items = elements;
		this.code.push("\n .items([");

		var count = -1;
		for (var i = 0; i < elements.length; i++){
			var el = elements[i];
			count += 1;


if (el != undefined){


			let ela = el.render()

			if (el.toCode !== undefined){
				this.code.push(el.toCode().flatMap(l=>l)); // 20:10:00 Nice!
		   // 12:25:10 Wow!!!
	  		 }


			// ela.style.flex = this.areas[count];
			this.res.appendChild(ela);
			}


		}

		this.code.push("\n ])");
		return this;
	}
	
	width(w){
		this.res.style.width = w;
		return this;
	}
	
	
	border(color, width){
		this.res.style.border = `${width}px solid ${color}`;
		return this;
	}
	
	adjust(h){
		const adj = () => {
		let query = window.matchMedia("(max-device-width: 415px)");
		
		if (window.innerWidth < h || query.matches) {
			for (var i = 0; i < this.res.children.length; i++){
				this.res.children[i].style.flex = "";
				this.res.children[i].style.width = "100%";
			}
		} else {
			//console.warn(this.arra);
			for (var i = 0; i < this.res.children.length; i++){			
				this.res.children[i].style.flex = `${this.arra[i]}`;
			}
		  }	
		}
	
		adj();
		window.addEventListener("resize", adj);
		return this;
	}
	
	render(el) {
		if (el) {
			document.querySelector("body").style.margin = 0;
			document.querySelector("body").style.padding = 0;
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
export { FlexGrid };
