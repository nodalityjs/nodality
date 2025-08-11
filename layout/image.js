import {Animator} from "./animator.js";


class Image extends Animator {
	constructor(url, type, mode, gcs) {
		super();
		this.url = url;
		this.res = null;
		this.code = [];

		
	/*	if (type == "exact" || type == "uncover"){
			this.image(this.url, mode, type, "a", gcs);
		} else {
			this.setup();
		}
		

			if (type === "exact"){ // Has to be there
				const str = `new Image("${this.url}", "exact")`;
				this.code.push(str);
			} else if (type === "uncover"){ // Has to be there
				const str = `new Image("${this.url}", "uncover")`;
				this.code.push(str);
			} else {
				this.code.push(`new Image('${this.url}')`);
			}*/
	}

	removeQuotesFromFirstWord(jsonString) {
		const modifiedJSON = jsonString.replace(/"([^"]+)":/g, '$1:');
		return modifiedJSON;
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

	flexOne(){
		this.res.style.flex = "1";
		return this;
	}

	hand(){
		this.res.style.cursor = "hand";
		return this;
	}

	

	// Just for visual 
	setGridWithoutCode(){
		this.res.style.border = "1px solid white";
		return this;
	}


	maxWidth(w){
		this.res.style.maxWidth = w;
		return this;
	}


	getHeight(){
		// // console.log(this.res.height);
		return this.res.height;
	}

	getWidth(){
		// // console.log(this.res.width);
		return this.res.width;
	}

	getType(){ // 114145 anchor
		return "HTMLImageElement";
	}

	/*toCode(){
		return this.code;
	}*/

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

		
		

		
		let type = options.isFull; 


	//	options.isFull && (stra += `\n isFull: "${options.isFull}",`);


		if (type){
			this.image(options.url, "exact", type, "a");
		} else {
			this.setup();
		}


		options.url && this.res.setAttribute("src", options.url);
		

	//	alert("Thrice?");

			if (type === "exact"){ // Has to be there
				const str = `new Image("${this.url}", "exact")`;
			//	this.code.push(str);
			} else if (type === "uncover"){ // Has to be there
				const str = `new Image("${this.url}", "uncover")`;
				//this.code.push(str);
			} else {
				// this.code.push(`new Image('${this.url}')`);
			}

















		options.vtn && (this.res.style.viewTransitionName = options.vtn);
		this.vtn = options.vtn;

		options.minHeight && (this.res.style.minHeight = options.minHeight);

		options.index && super.setIndex(options.index);
		options.index && (this.index = options.index);
		options.index && (stra += `\n index: "${options.index}",`);

		/*if (options.index === 0){ // condition no fire
			//alert("not written here");
			stra += `\n index: "0",`;
		}*/

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


		options.as && this.as(options.as);
		
		options.onScroll && this.onScroll(options.onScroll);
	//	options.fitContent && (this.res.style.objectFit = "contain");

		options.class && (this.res.setAttribute("class", options.class));
		
		options.gpos && (this.gposObject = options.gpos);

		if (options.gpos){
			this.res.style.gridColumn = options.gpos.col;
			this.res.style.gridRow = options.gpos.row;

			stra += `\n gpos: ${this.removeQuotesFromFirstWord(JSON.stringify(options.gpos))}, `;

		}
		// options.gpos && alert(this.gposObject);
		
		/*if (Object.keys(options).length > 0){
		this.code.push(`\n .set({ \n}`);
		}*/
		
		// console.log(options);
		
		//const opts = optsa.filter(el => el.op.name === "blast")[0];
	//	let filterObject = this.options.filtera.filter(a => a.op.name === "filter")[0];
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

			// this.setFilter(noiseObject);

			 let removed =  this.removeQuotesFromFirstWord(JSON.stringify(noiseObject));
			 (stra += `\n filtera: ${removed}, \n`); // If I comment this out the filter should disappear!
		
			 // Relief... shadow and span works whe copied, but stroke and filter does not
		
			}

		
		//options.filter && (this.res.style.filter = options.filter);
		

	
		options.keySet && this.keySet(options.keySet); 

		options.stype && this.setType(options.stype);

		options.isBackground && (this.isBackground = options.isBackground);

		options.zIndex && (this.res.style.zIndex = options.zIndex);
		options.zIndex && (stra += `\n zIndex: "${options.zIndex}", \n`);

		options.id && this.res.setAttribute("id",  options.id);
		options.id && (stra += ` id: "${options.id}", \n`);
this.id = options.id;
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

		options.multimargin && this.makeMultiMargin(options.multimargin);
		//options.multimargin && this.code.push(`multimargin: [\n`);
		options.multimargin && (stra += `multimargin: [ \n`);

// Seascape add 12/07/23
options.arrayMargin && this.arrayMargin(options.arrayMargin.sides, options.arrayMargin.value);

		if (options.multimargin){
			for (var i = 0; i < options.multimargin.length; i++){
				const mer = options.multimargin[i];
				stra += `{side: "${mer.side}", value: "${mer.value}"}, \n`;
			}

			stra += `], \n`;
		//	this.code.push(`], \n`);

		}


		options.maxWidth && this.maxWidth(options.maxWidth);
		// options.maxWidth && this.code.push(`maxWidth: "${options.maxWidth}", \n`);

		options.maxWidth && (stra += `maxWidth: "${options.maxWidth}", \n`);
		
		// console.warn(this.res.style.width);

		options.radius && this.cornerRadius(options.radius);
	//	options.radius && this.code.push(`radius: "${options.radius}"`);


	options.radius && (stra += `radius: "${options.radius}", \n`);

	if (options.marginOp) {
		let stringified = this.removeQuotesFromFirstWord(JSON.stringify(options.marginOp));
		stra += `\n marginOp: ${stringified},`;
	}

	options.clipPath && this.clipPath(options.clipPath);
	options.clipPath && (stra += `clipPath: "${options.clipPath}", \n`);


let obj = options;
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
					/*let queries = [
						{
						  range: obj.gradient[1].range, // This is BLAST
						  log: "blast"
						},
						{
						  range:  obj.gradient[2].range, // This is GRADIENT
						  log: "gradient"
						}
					  ];*/
		
		
					  // Both only 600-650
		
		
		
		
					  // REDUNDANT?????
					  // window.addEventListener("resize", () => this.react(arr));
					  // console.log(arr);
					 
					
					  // UNCOMMENT THIS !!!
					//  this.protoReact(arr, this.options.id);
				
					//console.warn("CALLINGA BETA REACT");
					// this.betaReact(arr, this.options.id);
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


	setFilter(filter){

		// console.log("ABBAC------------");
		// console.log(filter);
		let arr = [];

		let ft = [filter]//obj.gradient.filter(el => el.op.name !== "layout");
			// console.log(ft);

			ft = ft.filter(el => el != undefined);




		//	let arr = [];

			for (var i = 0; i < ft.length; i++){
				// console.log("Hello");
				arr.push({
					range: ft[i].range,
					log: ft[i].op.name,
					target: ft[i].target
				});
			}

			//alert(arr.length);

			//this.protoReact(arr)
	}

	makeMultiMargin(obj){ // 11:22:52
	//	this.res.style.zIndex = "1";

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


	setID(id){
		this.res.setAttribute("id", id);
		return this;
	}

	square(){
		this.res.style.width = "30%";
		this.res.style.paddingBottom = "30%";
		return this;
	}


	opacity(value){
		this.res.style.opacity = `${value}`;
		return this;
	}


	rowCol(row, col){
		this.res.style.gridRow = row;
		this.res.style.gridColumn = col;
		return this;
	}


	setArea(area){
		this.res.style.gridArea = area;
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

	setGrid(){
		this.res.style.gridRow = "span 2";
		this.res.style.gridColumn= "span 3";
		//this.res.style.gridColumn = "span 3";
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

	offseta(){
		this.res.style.marginLeft = "90px";
		this.res.style.marginTop = "-30px";
		return this;
	}
	
	borderAround(data){
		this.res.style.border = data;
		return this;
	}
    
	setClass(name){
		this.res.setAttribute("class", name);
		return this;
	}
	
     scale(obj){
        
        let previousWidth = this.res.style.width;
          
        this.res.style.transition= "0.5s all";
      //  alert(previousWidth);
        
        this.res.addEventListener("mouseover", () => {
            let previousWidth = this.res.style.width;
             this.res.style.transform = "scale(1.04)";
        });
        
         this.res.addEventListener("mouseout", () => {
            let previousWidth = this.res.style.width;
              this.res.style.transform = "scale(1.0)";
        });
        
        
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

	allRound(dimensions){
this.res.style.borderRadius = dimensions;
return this;
	}


	mobileWidth(){
		let query = window.matchMedia("(max-device-width: 415px)");
		if (query.matches){
			this.res.style.width = "120%";
		}


		return this;
	}
	

	/*
	if (type == "exact" || type == "uncover"){
			this.image(this.url, mode);
		} else {
			this.setup();
		}
	*/
	image(url, mode, type, vtn, gcs){
		//alert(gcs);
		//alert(mode);
		//alert(value);
		// this.el = null;
		let query = window.matchMedia("(max-device-width: 415px)");
		let back = document.createElement("div");
		//alert(vtn);
		back.style.viewTransitionName = vtn;
		//back.style.backgroundColor = "#ecf0f1";
		back.style.width = "100%";
		back.style.height = "200";


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
       // back.style.backgroundRepeatX = "no-repeat";
         back.style.backgroundRepeat = "no-repeat";
       
		 back.style.backgroundSize = "cover";
		

		 if (type === "uncover"){
			
            back.style.backgroundSize = "contain";
        }
		/*back.style.backgroundSize = "cover";

		
		if (this.options.cover === false){
			back.style.backgroundSize = "";
		}*/
        
        if (mode === "contain"){
			//alert("J")
            back.style.backgroundSize = "contain";
        }
        
        
		//back.style.borderTopLeftRadius = `${value}px`;
		//back.style.borderTopRightRadius = `${value}px`;
	
		this.res = back;
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


	setup() {
		let img = document.createElement("img");
	    img.style.width = "100%";
		//img.style.height = "auto";
		img.src = this.url;
		this.res = img;

		
		return this;
	}

	autoW(){
		this.res.style.width = "initial";
		return this;
	}

	float(dir){
		this.res.style.float = `${dir}`;
		return this;
	}

	fillAvailable(){
		this.res.style.height = "-webkit-fill-available";
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
	
	/*center(w){
		
		
		const adj = () => {
			if (this.res.style.width != 0){
			let count = window.innerWidth / 2 - (((w * window.innerWidth) / 100) / 2);
			this.res.style.marginLeft = `${count}px`;
		}
		}
		
		
		adj();
		window.onresize = adj();
		return this;
	}*/
	
	width(w){
		 this.res.style.width = w;
		 this.res.style.height = "auto";
		return this;
	}


	toBack(){
		this.res.style.zIndex = "-1";
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
			
			if (T !== 0 || R !== 0 || B !== 0){
				//	alert("j")
		this.res.style.margin = L;	
			}
		
			
		}
		
		return this;
	}
	
	
	padding(el){
		this.res.style.padding = el;
		return this;
	}
	
	size(w, h) {
		if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}

		return this;
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

    
    
	RSize(w, h, ratio) {
		
		let mq = window.matchMedia("(max-device-width: 420px)");
			
		
		if (w && h) {
			
			this.res.style.width = mq.matches ? w * ratio : w;
			this.res.style.height = mq.matches ? h * ratio : h;
		} else {
			this.res.style.width = mq.matches ? w * ratio : w;
			this.res.style.height = mq.matches ? w * ratio : w;
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
    
    
    
	
	clipShape(shape) {
		this.res.style.borderRadius = "50%";
		return this;
	}
	
	cornerRadius(val){
		this.res.style.borderRadius = val;
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
//this.res.style.position = "absolute";

/*
 let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
 path.setAttribute("d", pathData);
 path.setAttribute("fill", "none");
 path.setAttribute("stroke", "black");
 path.setAttribute("stroke-width", "7");
 path.setAttribute("viewBox", "0 0 700 700");
 path.setAttribute("preserveAspectRatio", "xMidYMid meet");

 svg.appendChild(path);
 
document.body.appendChild(svg);*/


        return this;
    }

	render(el) {
		let ela = this.res;//document.createElement("div");
		//ela.style.overflowX = "hidden";
		//ela.style.overflowY = "hidden";
		//ela.appendChild(this.res); // cannot move while loading
		// apply to every element maybe through the 

	//	let ela = this.res;

		if (el) {
			document.querySelector(el).appendChild(/*this.res*/ ela);
		} else {
			return ela; //this.res;
		}
	}
}

export { Image };
