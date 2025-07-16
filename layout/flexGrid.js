import {Animator} from "./animator.js";


// Add code-gen after backup
class FlexGrid {
	constructor(){
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

	set(options){
		this.code.push(".set({");
	//	this.code.push(JSON.stringify(options));
	//	console.log("OPE");
		
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

		// console.log(this.code);
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
