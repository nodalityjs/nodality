


// 22/08/2020 - 16:30
class Animator {
    
    constructor(){
         this.state = {
           isExpanded: false,
             isMovedUp: false,
              isMovedDown: false
        }
    }

	keySet(obj){
		this.temporaryVal = 1;
		this.res.style[obj.key] = obj.value;
		return this;
	}
	
	onScroll(data){

		if (data.value === "opacity"){
		this.res.style.opacity = data.valMin;
		} else if (data.value === "scale") {
			this.res.style.transform = `scale(${data.valMax})`;
		}


			window.addEventListener("scroll", () => {
				let resa = this.smartRange(window.scrollY, {
					min: data.from,
					max: data.to // has to be switched
				}, {
					min: data.valMin,
					max: data.valMax
				});

				if (data.value === "opacity"){
					this.res.style.opacity = resa;

				} else if (data.value === "scale") {
					this.res.style.transform = `scale(${resa})`;
				}
				
			});
		
	}




	setAny(obj){
		this[Object.keys(obj)[0]] = [Object.values(obj)[0]];
	}

	setID(id){
		this.id = id;
	}

	setPrevText(prevText){ // 12:12:43 20/03/25 OK :)
		this.prevText = prevText;
	}

	getCSS(){
		return this.css;
	}


	 getPX(value) {
		const breakpoints = {
			xs: "0px",      // Extra small
			sm: "576px",    // Small
			md: "768px",    // Medium
			lg: "992px",    // Large
			xl: "1200px",   // Extra large
			xxl: "1400px",   // Extra extra large
			mxxl: "1800px"   // Extra extra large
		};
	
		return breakpoints[value] || "Invalid breakpoint"; // Fallback for invalid input
	}

	// [{ breakpoint: "sm" , values: [...]}]
	respad(arr){
		const react = () => { // 00:49:12 22/03/2025
			this.pad(arr[0].values);

			for(let i = 0; i < arr.length; i++) {
				let point = arr[i].breakpoint;
				if (window.matchMedia(`(min-width: ${this.getPX(point)}`).matches){
					// console.clear();
				//	console.log("MATCHING " + point);
					this.pad(arr[i].values);
				}
			}
		}


		window.addEventListener("resize", react);
		react();
	}

	resmar(arr){
		const react = () => { // 00:49:12 22/03/2025
			this.mar(arr[0].values);

			for(let i = 0; i < arr.length; i++) {
				let point = arr[i].breakpoint;
				if (window.matchMedia(`(max-width: ${this.getPX(point)}`).matches){
					this.mar(arr[i].values);
				}
			}
		}


		window.addEventListener("resize", react);
		react();
	}


	resprop(arr) {

		this.prevBackground = this.res.style.background;
			this.prevWidth = this.res.style.width;
			this.prevHeight = this.res.style.height;
			this.prevBorder = this.res.style.border;


		const react = () => { // 00:49:12 22/03/2025

			this.res.style.background = this.prevBackground;
			this.res.style.width = this.prevWidth;
			this.res.style.height = this.prevHeight;
			this.res.style.border = this.prevBorder;

			for (let i = 0; i < arr.length; i++) {
				let point = arr[i].breakpoint;
				if (window.matchMedia(`(max-width: ${this.getPX(point)}`).matches) {
					const filteredObj = {};
					for (const key in arr[i]) {
						if (key !== "breakpoint") {
							filteredObj[key] = arr[i][key];
						}
					}

					this.set(filteredObj);
				}
			}
		}


		window.addEventListener("resize", react);
		react();
	}

	isNumber(value) {
		return typeof value === 'number' && !isNaN(value);
	}
 
	pad(arr){

		for(let i = 0; i < arr.length; i++) {
	
			let keys = Object.keys(arr[i]);
			for(let j = 0; j < keys.length; j++) {
				let key = keys[j];
				let value = arr[i][key];
				for(let k = 0; k < key.length; k++) {
					switch(key[k]) {
						case 'a':
							
							//alert("OIHOI")
							this.res.style.padding = this.isNumber(value) ? `${value}px` : value;
							break;
						case 't':
							this.res.style.paddingTop =  this.isNumber(value) ? `${value}px` : value;
							break;
						case 'l':
							this.res.style.paddingLeft =  this.isNumber(value) ? `${value}px` : value;
							break;
						case 'r':
							this.res.style.paddingRight =  this.isNumber(value) ? `${value}px` : value;
							break;
						case 'b':
							this.res.style.paddingBottom =  this.isNumber(value) ? `${value}px` : value;
							break;
						default:
							// console.log(`Invalid key: ${key[k]}`);
					}
				}
			}
		}
		return this;
	}


	as(asa){
		this.res.style.alignSelf = asa;
		return this;
	}



	mar(arr){

		for(let i = 0; i < arr.length; i++) {
			let keys = Object.keys(arr[i]);
			for(let j = 0; j < keys.length; j++) {
				let key = keys[j];
				let value = arr[i][key];
				for(let k = 0; k < key.length; k++) {
					switch(key[k]) {
						case 'a':
						//	this.res.style.fontWeight = `bold`;
							this.res.style.margin = this.isNumber(value) ? `${value}px` : value;//`${value}px`;
							break;
						case 't':
							this.res.style.marginTop = this.isNumber(value) ? `${value}px` : value;//`${value}px`;
							break;
						case 'l':
							this.res.style.marginLeft = this.isNumber(value) ? `${value}px` : value; //`${value}px`;
							break;
						case 'r':
							this.res.style.marginRight = this.isNumber(value) ? `${value}px` : value; //`${value}px`;
							break;
						case 'b':
							this.res.style.marginBottom = this.isNumber(value) ? `${value}px` : value;//`${value}px`;
							break;
						default:
							// console.log(`Invalid key: ${key[k]}`);
					}

					if (key[k] === "auto"){
						this.res.style.marginLeft = "auto";
						this.res.style.marginRight = "auto";
					}
				}
			}
		}
		return this;
	}


 smartRange(val, from, to) {

    if (val < from.min) {
        val = from.min;
    }

    if (val > from.max) {
        val = from.max;
    }

    let percent = (val - from.min) / (from.max - from.min);

    if (from.min > from.max) {
        percent = (val - from.max) / (from.min - from.max);
    }

    let toRange = (to.min - to.max) * percent - to.min;
    toRange = Math.abs(toRange);

    if (to.min < to.max) {
        let sm = to.max + Math.abs(to.min);
        let timesPerc = sm * percent;
        toRange = to.min + timesPerc;
    }


    return toRange;
}


	gpos(obj){
		//alert(obj.col);
		this.res.style.gridColumn = obj.col;
		this.res.style.gridRow = obj.row;
		//this.res.style.border = "1px solid green";
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
             this.res.style.fontSize = display6;
        }
        
              return this;
    }


	
    
    setIndex(idx){
		this.index = idx;
	}

	borderObj(options){
		let type = options.type ?? "solid";
		this.res.style.border = `${options.width} ${type} ${options.color}`
		this.res.style.borderRadius = options.radius; 
		return this;
	}
    

 protoReact(queries, id) {
	// Sort the queries based on the starting range value in ascending order
	queries.sort((a, b) => parseInt(a.range[0]) - parseInt(b.range[0]));
  
	// Function to check and log queries based on screen size
	const checkQueries =() => {
	  const screenSize = window.innerWidth;
	  let ops = "";

	  this.storedQueries = queries.map(el => el.target).filter(el => el != undefined);
  
	  for (const query of queries) {
		this.counterIndex++;

		const [startRange, endRange] = query.range;
		const startSize = parseInt(startRange);
		const endSize = parseInt(endRange);


		let all = true;

		if (query.target){
			all = false;

			for (var i = 0; i < query.target.length; i++){
				if (query.target[i] === id){ // #id is required
					all = true;
				}
			}
		} 
  
		if (screenSize >= startSize && screenSize <= endSize && all) { // NEED TO COMMENT ALL
		// USE THIS, but apply all properties all the time !! 255447

		  if (query.log === "gradient"){
			ops += "gradient";
		  }

		  if (query.log === "blast"){
			ops += "blast";
		  }

		  if (query.log === "animation"){
			ops += "animation";
		  }

		  if (query.log === "shadow"){
			ops += "shadow";
		  }

		  if (query.log === "span"){
			ops += "span";
		  }

		  if (query.log === "filter"){
			ops += "filter";
		  }

		  if (query.log === "background"){
			ops += "background";
		  }
		} 
	  }
	
	
	  this.res.style.margin = "";
	  // Everything works 12:48:45 06/10/23

	  let defaultColor = this.res.style.color; // 11:05:40 Nice

		let mapped = queries.map(el => el.log).filter(el => el != undefined);
		
		if (mapped.includes("gradient")) {
			this.res.style.WebkitBackgroundClip = "";
			this.res.style.background = "";
		}


	  // Reset stroke
	  this.res.style['-webkit-text-stroke'] = "";
	  this.res.style.filter = ``;

	  // Reset shadow
	  this.res.style.textShadow = "";

      // Temp reset border
      this.res.style.border = "";
	  
	  while(this.res.firstChild) {  // not the problem...
		this.res.removeChild(this.res.firstChild); // Remove all children
	}

	this.res.textContent = this.text;


	

		if (ops === "") {
			this.res.style['-webkit-text-fill-color'] = '';
			this.res.style.color = defaultColor; //"green";
			//this.resCopy = this.res;
		}


		if (ops === "blast") { // Chekc id here ???
           // alert("O")
		   for (var i = 0; i < queries.length; i++){
			const off  = queries[i].op.offsets;
			// console.log(off);
			if (off && this.index !== undefined){
				 // console.warn("READ INDEXO");
				this.res.style.margin = off[Number(this.index)] + "px";
			}
		}

		 //  alert(this.passedID.id);
          //  this.res.style.border = "1px solid yellow";
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style['-webkit-text-stroke'] = this.globalBlast; //this.globalBlast; //`3px orange`;
			//this.resCopy = this.res;
	
			for (var i = 0; i < queries.length; i++){
				const off  = queries[i].op.offsets;
				// console.log(off);
				if (off && this.index !== undefined){
					 // console.warn("READ INDEX");
					this.res.style.margin = off[Number(this.index)] + "px";
				}
			}
		}
	
		

		if (ops === "gradient") { // the problem is not here
			this.res.style['-webkit-text-fill-color'] = 'transparent';
		    this.res.style.background = this.globalGradient;// "linear-gradient(to left, #3498db, #1abc9c)";
			this.res.style['-webkit-background-clip'] = 'text';
	
		     this.res.style.border = "1px solid orange"; // Something on Wrapper prevents border works on text
			
		}
	

		if (ops === "background"){
		
			this.res.style.background = "orange";
		}

		


		if (ops === "gradientblast") { 
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style.background = this.globalGradient;//"linear-gradient(to left, #3498db, #1abc9c)";
			this.res.style['-webkit-background-clip'] = 'text';
			this.res.style['-webkit-text-stroke'] = this.globalBlast; // `3px orange`;
		}




		if (ops === "gradientanimation") { // 12:33:14 Nice
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style.background = this.globalGradient; //"linear-gradient(to left, #3498db, #1abc9c)";
			this.res.style['-webkit-background-clip'] = 'text';
		}

		// // // console.log("GL " + this.globalShadow);
		if (ops === "gradientanimationshadow"){
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style.background = this.globalGradient; //"linear-gradient(to left, #3498db, #1abc9c)";
			this.res.style['-webkit-background-clip'] = 'text';
			this.res.style.textShadow = this.globalShadow; //"#1abc9cff -6px 6px, #1abc9c9f -12px 12px, #1abc9c40 -18px 18px";
		}

		if (ops === "animationshadow"){
			this.res.style['-webkit-text-fill-color'] = '';
			this.res.style.textShadow = this.globalShadow; //"#1abc9cff -6px 6px , #1abc9c40 -12px 12px";
		}

		if (ops === "shadow"){
			// Clear all children and add text content
			this.res.style['-webkit-text-fill-color'] = '';
			this.res.style.textShadow = this.globalShadow; //"#1abc9cff -6px 6px , #1abc9c40 -12px 12px";
		}


		if (ops === "span"){
			if (this.options.span){
				let noiseObject;
	
				if (Array.isArray(this.options.span)){
					noiseObject = this.options.span.filter(a => a.op.name === "span")[0];
				} else {
					noiseObject = this.options.span;
				}

				this.res.textContent = ""; // creating new element not helping
	
				for (var i = 0; i < noiseObject.op.parts.length; i++){
					let opts = noiseObject.op.parts[i].style;
					let span = new Text(noiseObject.op.parts[i].text).setup({type: "span"}).set(opts).render();
					this.res.appendChild(span);
				}
			}
		}
	  

		if (ops === "filter"){

			let filterName = this.options.filtera.op.filter;
			// alert(filterName);
			this.res.style.filter = filterName;
			this.res.style.border = "8px solid orange";
		}
	}
  
	// Add an event listener to check queries on window resize
	window.addEventListener('resize', checkQueries);
  
	// Initial check
	checkQueries();
  }




setPref(id){
	this.preffersId = id;
	//alert(id);
}


setClass(id){
	this.class = id;
	//alert(id);
}




 betaReact(queries, id) {

	// // console.log("PPP");
	// // console.log(queries);

	this.ap = false;
	this.cta = 0;
	this.once = false;
	queries.sort((a, b) => parseInt(a.range[0]) - parseInt(b.range[0]));
  
	// Function to check and log queries based on screen size
	const checkQueries =() => {
	  const screenSize = window.innerWidth;
	  let ops = "";

	  this.resCopy = this.res;

	  this.storedQueries = queries.map(el => el.target).filter(el => el != undefined);
	  // // // console.log(this.storedQueries);
  
	  for (const query of queries) {
		this.counterIndex++;

		const [startRange, endRange] = query.range;
		const startSize = parseInt(startRange);
		const endSize = parseInt(endRange);
		let all = true;

		if (query.target){
		//alert("KKK")
			all = false;
		//alert(this.res.id);

			for (var i = 0; i < query.target.length; i++){
				// // // console.log("QT " + query.target[i]);
				// // // console.log("QS " + id);

				if (query.target[i] === id){ // #id is required
				
					all = true;
				}
			}
		} 
  
		if (screenSize >= startSize && screenSize <= endSize && all) { // NEED TO COMMENT ALL
		  if (query.log === "blast"){
			ops += "blast";
		  }

		  if (query.log === "shadow"){
			ops += "shadow";
		  }

		  if (query.log === "background"){
			ops += "background";
		  }

		  if (query.log === "gradient"){
			ops += "gradient";
		  }

		  if (query.log === "spana"){
			ops += "spana";
		  }

		  if (query.log === "layout"){
			ops += "layout";
		  }

		  if (query.log === "margin"){
			ops += "margin";
		  }

		  if (query.op && query.op.margin){
			this.useMargin = query.op.margin;
		  }
		} 

	  }



	  this.res.style.background = "";
	  this.res.style.backgroundColor = "";
	  this.res.style.textShadow = "";
	  this.res.style.border = "";
	  this.res.style.margin = ""

	  this.res.style['-webkit-text-fill-color'] = '';
		this.res.style['-webkit-text-stroke'] = "";
		this.res.style['-webkit-text-stroke-width'] = "";

	  if (ops === "background"){
		// alert("PPPA")
		this.res.style.backgroundColor = "green";
	  }

	  if (ops === "margin"){

		for (var i = 0; i < queries.length; i++){

			if (!queries[i].op){
				continue;
			}
			const off  = queries[i].op.offsets;
			if (off && this.index !== undefined){
				this.res.style.margin = off[Number(this.index)] + "px";
			}
		}

		
	  }

	  if (ops === "blastbackgroundmargin"){
	
	for (var i = 0; i < queries.length; i++){
		if (!queries[i].op){
			continue;
		}

		const off  = queries[i].op.offsets;
		// console.log(off);
		
		if (off && this.index !== undefined){
			 // console.warn("READ INDEX");
			this.res.style.margin = off[Number(this.index)] + "px";
		}
	}
		

		this.res.style.backgroundColor = "green";
		//this.useMargin ? this.res.style.margin = "1rem" : null;
		// alert("PPPA")
		if (this.getType() === "FlexRowLayoutElement"){
			this.res.style.border = "1px solid orange";
		} else {
			this.res.textContent = this.text; //"a"
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			//this.res.style['-webkit-background-clip'] = 'text';
			this.res.style['-webkit-text-stroke-color'] = "orange";
			this.res.style['-webkit-text-stroke-width'] = "1px";
		}
		
		this.res.style['-webkit-text-fill-color'] = 'transparent';
		this.res.style['-webkit-text-stroke-color'] = "orange";
		this.res.style['-webkit-text-stroke-width'] = "1px";
	  }

	  if (ops === "blastbackground"){

		for (var i = 0; i < queries.length; i++){
			if (!queries[i].op){
				continue;
			}

			const off  = queries[i].op.offsets;

			if (off && this.index !== undefined){
				this.res.style.margin = off[Number(this.index)] + "px";
			}
		}
	
		this.res.style.backgroundColor = "green";
		// no unused expression
		this.useMargin ? this.res.style.margin = "1rem" : this.res.setAttribute("id", "iofhwoiefhoih");
		//this.useMargin ? this.res.style.margin = "1rem" : null;
		if (this.getType() === "FlexRowLayoutElement"){
			this.res.style.border = "1px solid orange";
		} else {
			this.res.textContent = this.text; //"a"
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style['-webkit-text-stroke-color'] = "orange";
			this.res.style['-webkit-text-stroke-width'] = "1px";
		}
		
		this.res.style['-webkit-text-fill-color'] = 'transparent';
		this.res.style['-webkit-text-stroke-color'] = "orange";
		this.res.style['-webkit-text-stroke-width'] = "1px";
	  }

	  if (ops === "layout"){
		this.res.style.alignSelf = "start";
		this.res.style.border = "1px solid purple";
	  }


		

	  if (ops === "blast") { // the problem is not here
		
		for (var i = 0; i < queries.length; i++){
			if (!queries[i].op){
				continue;
			}
			
			const off  = queries[i].op.offsets;
			if (off && this.index !== undefined){
				this.res.style.margin = off[Number(this.index)] + "px";
			}
		}
		
		if (this.getType() === "FlexRowLayoutElement"){
			this.res.style.border = "1px solid orange";
		} else {
			this.res.textContent = this.text; //"a"
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style['-webkit-background-clip'] = 'text';
			this.res.style['-webkit-text-stroke-color'] = "orange";
			this.res.style['-webkit-text-stroke-width'] = "1px";
		}
		
		this.res.style['-webkit-text-fill-color'] = 'transparent';
		this.res.style['-webkit-text-stroke'] = "orange";
		this.res.style['-webkit-text-stroke-width'] = "1px";
	}


	if (ops === "blastgradientbackground"){
		this.res.style.border = "1px solid yellow";
		this.res.style['-webkit-text-stroke-color'] = "orange";
		this.res.style['-webkit-text-stroke-width'] = "1px";
	}


	

	if (ops === "gradient") {
		
		//alert("P")
		
		this.res.style.background = "linear-gradient(to left, #3498db, #1abc9c)";
		
		if (this.getType() === "FlexRowLayoutElement"){
		} else {

			this.res.children[0] && this.res.removeChild(this.res.children[0]);
			//// console.warn(this.res.children[0]);
			this.res.style['-webkit-text-fill-color'] = 'transparent';
			this.res.style['-webkit-background-clip'] = 'text';
			this.res.textContent = this.text; //"a"
			//this.res.children[0] && this.res.removeChild(this.res.children[0]);
		}
	}



	if (ops === "shadow"){

		if (this.getType() === "FlexRowLayoutElement"){
		} else {

			this.res.children[0] && this.res.removeChild(this.res.children[0]);
			//// console.warn(this.res.children[0]);
			this.res.style['-webkit-text-fill-color'] = '';
			this.res.style['-webkit-text-fill-color'] = '';
			this.res.style.textShadow = "#1abc9cff -6px 6px , #1abc9c40 -12px 12px";
			this.res.textContent = this.text; //"a"
			//this.res.children[0] && this.res.removeChild(this.res.children[0]);
		}
		
	//	this.res.style['-webkit-text-stroke'] = "orange";
	}

	}
  
	// Add an event listener to check queries on window resize
	window.addEventListener('resize', checkQueries);
  
	// Initial check
	checkQueries();
  }


  //--------- START OF INDEPENDENT


// React without condition 
// loop through queries 
// to make all CSS immediatelly...

  cssGen(queries, id, classa, preffersClass){

	this.css = [""];
	return [""];

	this.css = [];
	queries.sort((a, b) => parseInt(a.range[0]) - parseInt(b.range[0]));
  
	// Function to check and log queries based on screen size
	const checkQueries =() => {
	  const screenSize = window.innerWidth;
	  let ops = "";
	  let operations = [];

	  this.resCopy = this.res;

	  this.storedQueries = queries.map(el => el.target).filter(el => el != undefined);
	 
	  // console.log("ULTRA");
	  // console.log(queries);

	  
  
	  for (const query of queries) {
		this.counterIndex++;

		const [startRange, endRange] = query.range;
		const startSize = parseInt(startRange);
		const endSize = parseInt(endRange);
		let all = true;

		

		if (query.target){
			//alert("KKK")
				all = false;
			//alert(this.res.id);
	
				for (var i = 0; i < query.target.length; i++){
					// // // console.log("QT " + query.target[i]);
					// // // console.log("QS " + id);
	
					if (query.target[i] === id){ // #id is required
					
						all = true;
					}
				}
			} 





		
if (all){ // make it work only with ID ???


		operations.push(query.log);

		let range = `\n @media (min-width: ${startSize}px) and (max-width: ${endSize}px)`;
		this.range = range; // this.range is always the last one!!!
		this.css.push({log: query.log, range: range, rules:[]});
}
	}

	

	if (operations.includes("blast")){
		let ft = this.css.map(q => q.log).lastIndexOf("blast");
		//// console.log("BLAST IDO IS " + ft + "TR" + this.range);

		// should be 0-900
		// is 880-930
//alert(this.preffersId);
//alert(this.class);

		this.css[ft].rules.push(` 
		${this.preffersId ? id : "." + this.class}{
			-webkit-text-stroke-width: 1px;
			-webkit-text-stroke-color: orange;
			-webkit-text-fill-color: transparent;
		}
		`);
	}

	if (operations.includes("gradient")){
		//let ft = this.css.map(q => q.range).lastIndexOf(this.range);
		//// console.log("IDO IS " + ft);
		let ft = this.css.map(q => q.log).lastIndexOf("gradient");
	//	// console.log("BLAST IDO IS " + ft + "TR" + this.range);

	
		this.css[ft].rules.push(` 
		${this.preffersId ? id : "." + this.class}{
			background: ${this.globalGradient};
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		}
		`);
	}

	if (operations.includes("background")){
		//let ft = this.css.map(q => q.range).lastIndexOf(this.range);
		//// console.log("IDO IS " + ft);
		let ft = this.css.map(q => q.log).lastIndexOf("background");
		// console.log("ABLAST IDO IS " + ft + "TR" + this.range);
//alert("Hello" + ft);
//alert(this.class);
		this.css[ft].rules.push(` 
		${this.preffersId ? this.id : "." + this.class}{
			background: green;
		}
		`);

		// console.log("-----Hello-----");
		// console.warn(this.css[ft]);

	}


	if (operations.includes("shadow")){
		let ft = this.css.map(q => q.log).lastIndexOf("shadow");
		
			let str = "";
					let off = 0;
					for (var i = 0; i < this.options.shadow.op.steps; i++){
						off += 3;
						str += `drop-shadow(${off}px ${off}px ${off}px gray) `; 
					}

		// BEWARE OF INDENTATION
		this.css[ft].rules.push(`
		${this.preffersId ? this.id : "." + this.class}{
			filter: ${str};
		 }
					`);
				//	this.res.style.filter = str;
		
	
	}
}

checkQueries();



// console.log("FINAL QUERIES HERE");
// console.log(this.css.map(r => r.rules));
// console.log("::::::::::::::::::::::");

  }

  chainReact(queries, id, keep) { // we use this

	this.cssGen(queries, id, this.class, this.class !== undefined); // 02/04/2024 10:43:40 Nice!!!

	this.ap = false;
	this.cta = 0;
	this.once = false;


	// REPLACE WITH DEFAULT RANGE INSIDE FOR LOOP IF NONE IS FOUND 
	// FOR LET QUEYR OF Q
	// if !q.range => q.range = ["0px", "99999px"]
	for (let q of queries){
		if (!q.range){
			// console.log("NOPA");
			q.range = ["0px", "999999px"];
		}
	}

	queries.sort((a, b) => parseInt(a.range[0]) - parseInt(b.range[0]));
  
	// Function to check and log queries based on screen size
	const checkQueries = () => {
		//alert("/P")
	  const screenSize = window.visualViewport.width;  // window.innerWidth window.screen.width window.visualViewport.width
	  let ops = "";
	  let operations = [];
	  let globalQueries = [];

	  this.resCopy = this.res;

	  this.storedQueries = queries.map(el => el.target).filter(el => el != undefined);
  
	  for (const query of queries) {
		this.counterIndex++;

		const [startRange, endRange] = query.range;
		const startSize = parseInt(startRange);
		const endSize = parseInt(endRange);
		let all = true;

		if (query.target){

			all = false;


			for (var i = 0; i < query.target.length; i++){

				if (query.target[i] === id){ // #id is required
				
					all = true;
				}
			}
		} 
  
		if (screenSize >= startSize && screenSize <= endSize && all) { // NEED TO COMMENT ALL
		  operations.push(query.log);
		  globalQueries.push(query);

		  if (query.op && query.op.margin){
			this.useMargin = query.op.margin;
		  }

		} 

	  }


	  if (keep && !keep.includes("background")){
		this.res.style.background = "";
		this.res.style.backgroundColor = "";
	  }
	 
	 
	  this.res.style.textShadow = "";

	  if (keep && !keep.includes("border")){
		this.res.style.border = "";
	  }


	  if (keep && !keep.includes("margin")){
		this.res.style.margin = "";
	  }
	

	  this.res.style['-webkit-text-fill-color'] = '';
	  this.res.style['-webkit-text-stroke-color'] = "";
	  this.res.style['-webkit-text-stroke-width'] = "";
	//  this.res.style['-webkit-background-clip'] = 'unset';
	  this.res.style.filter = "";


	  // NO CONITION, ALWAYS!!!!
	  if (operations.includes("gradient") || operations.includes("shadow")){
			this.res.style.position = "relative";
			this.res.style.zIndex = -1;
	  } // FIX 23:31:56 10/11/24

	

	  if (operations.includes("blast")){
		
		let gl = globalQueries.filter(x => x.log === "blast")[0].op.color;
		// console.log(gl);

		let w = globalQueries.filter(x => x.log === "blast")[0].op.width ?? "1px";
	

		if (this.getType() === "FlexRowLayoutElement"){
			this.res.style.border = `${w}px solid orange`;
		} else {
			
			this.res.textContent = this.text; //"a"
			this.res.style['-webkit-text-fill-color'] = 'transparent';
	
			this.res.style['-webkit-text-stroke-color'] =  gl;//"orange";
			this.res.style['-webkit-text-stroke-width'] = `${w}`;
		//alert("HIOH")
		}
	  }

	  if (operations.includes("filter")){
		let w = globalQueries.filter(x => x.log === "filter")[0]
		// console.log(w);
		let filterName = w.op.filter;
			this.res.style.filter = filterName;
	  }

	  if (operations.includes("background")){
		this.res.style.backgroundColor = "green";
	 }

	  if (operations.includes("gradient")){

	    // Set gradient to text
		this.res.style['-webkit-text-fill-color'] = 'transparent';
		this.res.style.background = this.globalGradient;// "linear-gradient(to left, #3498db, #1abc9c)";
		this.res.style['background-clip'] = 'text'; // 19:23:05 05/05/2024 -webkit was a problem here!
		

		// In Safari background linear gradient sets background-clip to border-box; this ai automatically put after		
	
	}

	
	  if (operations.includes("shadow")){
			if (this.getType() === "FlexRowLayoutElement"){
			} else {
		
				let str = "";
				let off = 0;
				for (var i = 0; i < this.options.shadow.op.steps; i++){
					off += 3;
					str += `drop-shadow(${off}px ${off}px ${off}px gray) `; 
				}


				this.res.style.filter = str; 
				
		}
	  }

	  if (operations.includes("margin")){
		for (var i = 0; i < queries.length; i++){
			if (!queries[i].op){
				continue;
			}
			
			const off  = queries[i].op.offsets;
			
			if (off && this.index !== undefined){
				this.res.style.margin = off[Number(this.index)] + "px";
			}
		}
  }

  /*if (operations.includes("spana") || operations.includes("span")){


	this.res = this.resCopy;

if (this.options.span){
	let noiseObject;

	if (Array.isArray(this.options.span)){
		noiseObject = this.options.span.filter(a => a.op.name === "span")[0];
	} else {
		noiseObject = this.options.span;
	}

	this.res.textContent = ""; // creating new element not helping

	for (var i = 0; i < noiseObject.op.parts.length; i++){
		let opts = noiseObject.op.parts[i].style;
		let span = new Text(noiseObject.op.parts[i].text).setup({type: "span"}).set(opts).render();
		this.res.appendChild(span);
	}
}



  } else {
	

	while (this.res.firstChild) {
		this.res.removeChild(this.res.firstChild);
	}
	let t = new Text(this.prevText).set({}).render();
	this.res.appendChild(t);
  }*/

  




if (id === "#home"){
	
}
	
  if (operations.includes("animation")) {	
	

if (this.options.animation && !this.hasAnimated && !this.options.animation.op.fireAt){



this.hasAnimated = true;
let ass = this.options.animation.op;

	this.res.animate(ass.keyframesClose, {
		duration: 0,
		fill: "forwards"
	   });



		this.res.animate(ass.keyframesOpen, ass.openOptions);
	   

}

// 18:42:30 it works! 02/02/2025
// Thanks ChatGPT!
	  if (this.options.animation && this.options.animation.op.fireAt && this.options.animation.op.fireAt.endsWith("px")) {

		  let ass = this.options.animation.op;

		  this.res.animate(ass.keyframesClose, {
			  duration: 0,
			  fill: "forwards"
		  });

		  const scrollHandler = () => {
			  if (window.scrollY > parseFloat(ass.fireAt)) {
				  this.res.animate(ass.keyframesOpen, ass.openOptions);
				  window.removeEventListener("scroll", scrollHandler);
			  }
		  };

		  window.addEventListener("scroll", scrollHandler);

	  } 

	  if (this.options.animation && this.options.animation.op.fireAt && this.options.animation.op.fireAt === "inview") {

		let ass = this.options.animation.op;

		this.res.animate(ass.keyframesClose, {
			duration: 0,
			fill: "forwards"
		});


	  const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				// console.log("Element is in view!");
				this.res.animate(ass.keyframesOpen, ass.openOptions);
				// Perform your action here
				observer.disconnect(); // Stop observing if you only want it to fire once
			}
		});
	});

		// Start observing the element
		observer.observe(this.res);
}
	
		
	}

	}
  
	// Add an event listener to check queries on window resize
	window.addEventListener('resize', checkQueries);
	checkQueries();
  }
  
  //--------- END OF INDEPENDENT
  
  reactOnTransform = (obj) => {

	if (obj.transform || obj.op && obj.op.transform){
		

		let transform = obj.transform; 

		if (!obj.transform ){ // 21:48:05 Nice!!! 30/03/25
			transform = obj.op.transform;
		}

		if (!transform.duration){
			transform.duration = "3s-ease-in-out";
		}

	
		this.setDefault = (value, defaultValue = "0px") => {
			return value.length === 0 ? defaultValue + " " : value;
		}

		const convertRotateString = (input)  => {
			const match = input.match(/rotate\(([^)]+)\)/);
			if (!match) return input; // Return unchanged if no match found
		
			const values = match[1].split(',').map(v => v.trim());
		
			if (values.length === 1) {
				return `rotate(${values[0]})`;
			} else if (values.length === 2) {
				return `rotateX(${values[0]}) rotateY(${values[1]})`;
			} else if (values.length === 3) {
				return `rotateX(${values[0]}) rotateY(${values[1]}) rotate(${values[2]})`;
			}
		
			return input; // Return unchanged if more than 3 values
		}
		
	
	const perform = () => {
	let translateX = '';
	let translateY = '';
	let translateZ = '';
	let scale = '';
	let skew = '';
	let rotate = '';
	let perspective = '';
	let matrix = '';
	let opacity = '';

	// Check if the transform values array is empty
	if (transform.values.length === 0) { 
		return; // If the array is empty, exit the function
	}

	// Loop through the transform values and extract the needed ones
	transform.values.forEach(value => {
		if (value.startsWith('tx:')) {
			translateX = value.replace('tx:', ''); // Extract -20px from ty:-20px
		} if (value.startsWith('ty:')) {
			translateY = value.replace('ty:', ''); // Extract -20px from ty:-20px
		} if (value.startsWith('tz:')) {
			translateZ = value.replace('tz:', ''); // Extract -20px from ty:-20px
		} else if (value.startsWith('scale(')) {
			scale = value; // Extract scale(3) or any other scale
		} else if (value.startsWith("skew(")) {
			skew = value;
		}  else if (value.startsWith("rotate(")) {
			rotate = convertRotateString(value);
		} else if (value.startsWith("perspective(")) {
			perspective = value;
		} else if (value.startsWith("matrix(")) {
			matrix = value;
		} else if (value.startsWith("opacity:")) {
			opacity = value.replace('opacity:', '');
			//alert(opacity);
		}
	});

	

	translateX = this.setDefault(translateX);
	translateY = this.setDefault(translateY);
	translateZ = this.setDefault(translateZ);

	// Apply the transform to the element, only if translateY or scale is present
	let transformValue = '';
	// PROBLEM HERE
	// transformValue += `translate(30px, 0px, 0px)`; // CSS translate has only two vals  (need trans3D for 3)
	
	
	if (translateY != "0px" && translateX != "0px" && translateZ != "0px") {
		transformValue += `translate3d(${translateX}, ${translateY}, ${translateZ})`;
	} else if (translateY != "0px" || translateX != "0px") {
		transformValue += `translate(${translateX}, ${translateY})`
	};


	if (scale) transformValue += ` ${scale}`;
	if (rotate) transformValue += ` ${rotate}`;
	if (skew) transformValue += ` ${skew}`;
	if (perspective) transformValue += ` ${perspective}`;
	if (matrix) transformValue += ` ${matrix}`;

	if (transformValue) {
		

		if (obj.op.transform.duration){ // transform 3s in and out takes 8 secs instead of 6....
			let newStr = obj.op.transform.duration.replace(/^(\d+)(s)-/, (_, n, s) => n / 2 + s + " "); 
			let trans = `transform ${newStr}, opacity  ${newStr}`; // Reset transition
			this.res.style.transition = trans;
		} else {
			this.res.style.transition = "transform 3s ease-in-out, opacity 3s ease-in-out"; // Reset transition
		}

		// 17:37:15 a comma was missing
		this.res.style.transform = transformValue;
		this.res.style.opacity = opacity;
	}
	}


	if (transform.on){
		this.res.addEventListener(transform.on, () => {
			if (transform.delay) {
				setTimeout(() => {
					perform();
				}, transform.delay);

			} else {
				perform()
			}
		});
		
	} else {
		window.addEventListener("load", () => {
			if (transform.delay) {

				setTimeout(() => {
					perform();
				}, transform.delay);
			} else {
				perform();
			}
		})
		
		
	}


	const reset = () => {
		let resetTransformValue = '';

		transform.values.forEach(value => {
			if (value.startsWith('tx:')) {
				resetTransformValue += "translateX(0) ";
			} else if (value.startsWith('ty:')) {
				resetTransformValue += "translateY(0) ";
			} else if (value.startsWith('tz:')) {
				resetTransformValue += "translateZ(0) ";
			} else if (value.startsWith('scale(')) {
				resetTransformValue += "scale(1) ";
			} else if (value.startsWith('skew(')) {
				resetTransformValue += "skew(0, 0) "; // Assuming 2D skew reset
			} else if (value.startsWith('rotate(')) {
				resetTransformValue += "rotate(0) ";
			} else if (value.startsWith('perspective(')) {
				resetTransformValue += "perspective(0) "; // Assuming 0 for perspective
			} else if (value.startsWith('matrix(')) {
				resetTransformValue += "matrix(1, 0, 0, 1, 0, 0) "; // Reset to identity matrix
			}

			this.res.style.opacity = "1";


		});
	
		// Apply reset transform if any values were provided
		if (resetTransformValue) {
		//	this.res.style.transition = "transform 0.5s ease-in-out"; // Reset transition
			this.res.style.transform = resetTransformValue.trim(); // Remove trailing space
		}
	}


if (transform.on){

	this.res.addEventListener("mouseout", () => {
		if (!transform.keep){
			reset();
		}
		
	});
} else {
	let duration = parseFloat(transform.duration) * 1000;
	let resetAfter = transform.closeAfter ? transform.closeAfter : 0;

	setTimeout(() => {
		if (!transform.keep) {
			reset();
		}
	}, duration / 2 + resetAfter); // 15:16:26 Nice!!!
}

	
	
	}

	}



maxWidth(w){
    this.res.style.maxWidth = w;
    return this;
}

removeQuotesFromFirstWord(jsonString) {
	const modifiedJSON = jsonString.replace(/"([^"]+)":/g, '$1:');
	return modifiedJSON;
  }
  

arrayMargin(arr, value) { // 224857 redefined earlier

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

	if (arr.includes("all")){
		this.res.style.margin = value;
	}

	if (!value){
		this.res.style.marginBottom = arr;
	}
	
	return this;
}


    navBarExpand(){
        this.res.style.backgroundColor = "green";
        this.res.animate([
            {transform: "scaleY(3.0)"}
        ], {
            
				
                duration: 2000,
                iterations: 1,
                 fill: "both"
                
        })//.play();

        return this;
    }





    
	scrollFade(duration, direction){
		this.res.style.visibility = "hidden";
		this.faden(duration, direction, "scroll");
		return this;
	}
    
    
    
    
    expand(obj){
        
        
        
        if (this.state.isExpanded === false){
            
        
        if (obj.on === "click"){
            this.res.addEventListener("click", () => {
               this.innerExpand(obj); 
                // this.moveUp(obj);
            });
        } else {
            this.innerExpand(obj);
           
        }
        
        } else {
            
            this.innerExpandBack(obj);
            
            
        }
        
        this.state.isExpanded = !this.state.isExpanded;
        
        // // // console.log("IS EXPANDED: " + this.state.isExpanded);
        return this;
    }
    
     
    move(obj){
        
        if (obj.on === "click"){
            this.res.addEventListener("click", () => {
               this.moveUpa(obj); 
                // this.moveUp(obj);
            });
        } else {
                if (obj.direction === "up"){
                    this.moveUpa(obj);
                }
            
            if (obj.direction === "down"){
                    this.moveDowna(obj);
                }
          //  }
            
            
             this.state.isMovedUp = !this.state.isMovedUp;
            
                if (obj.direction === "left"){
                    this.moveLeft(obj);
                }
        }
        
        return this;
    }
    
    
    
    
     moveLeft(obj){
         this.res.animate([
        {transform: `translateX(0px)`},   
         {transform: `translateX(-${obj.distance})`},
         
		],{
				
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		}).play();
        
        return this;
    }
    
   
    moveUpa(obj){
        if (this.state.isMovedUp === false){
            
        this.res.animate([
        {transform: `translateX(0px)`}, 
         {transform: `translateY(-${obj.distance})`},
		],{	
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		}).play();
        
        } else {
            
        this.res.animate([
        {transform: `translateX(0px)`}, 
         {transform: `translateY(${obj.distance})`},
		],{	
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		}).play();
            
        }
        return this;
    }
    
    
     moveDowna(obj){
        if (this.state.isMovedDown === false){
            
        this.res.animate([
        {transform: `translateX(0px)`}, 
         {transform: `translateY(${obj.distance})`},
		],{	
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		}).play();
        
        } else {
            
        this.res.animate([
        {transform: `translateX(0px)`}, 
         {transform: `translateY(-${obj.distance})`},
		],{	
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		}).play();
            
        }
        return this;
    }
    
    
    
    moveUpaBack(obj){
         this.res.animate([
        {transform: `translateX(0px)`},
		],{
				
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		}).play();
        
        
        return this;
    }
    
    

    innerExpandBack(obj){
         this.res.animate([
       
         
         {width: this.prevWidth,
          height: this.prevHeight},
         
       //  {width: "100px", height: "100px"}
		],{
				
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		});
    }
    
    innerExpand(obj){
        this.prevWidth = this.res.style.width;
        this.prevHeight = this.res.style.height;
            
     this.res.animate([
        {width: this.prevWidth,
        height: this.prevHeight},
         
         {width: obj.width ?? this.prevWidth,
          height: obj.height ?? this.prevHeight},
		],{
				
		duration: 900,
		iterations: obj.iterations,
         fill: "both"
		});
        
        return this;
        
        }
        

	fade(obj){
		
		this.res.style.visibility = "hidden";
		this.faden(obj.duration, obj.from, "load");

        if (obj.finalOpacity){
this.finalOpacity = obj.finalOpacity;
        }
		return this;
	}
	
	faden(duration, direction, event){
		this.res.style.visibility = "hidden";
		this.scrolled = false;	
	
		 window.addEventListener(event, () => {
			this.res.style.visibility = "visible";
			 var height = window.innerHeight;
			   var top = this.res.getBoundingClientRect().top;
            if ((top - height <= 0) || (event == "load")) {
				
			 if (this.scrolled == false){
				 
	if (direction == "left"){
					  
		this.res.animate([
			{transform: "translateX(-30px)"},
			{transform: "translateX(0px)"},
		],{
				
		duration: duration,
		iterations: 1
		});
	}
				 
	if (direction == "right"){
					  
		this.res.animate([
			{transform: "translateX(30px)"},
			{transform: "translateX(0px)"},
		],{
				
		duration: duration,
		iterations: 1
		});
	}
				 
				 
	if (direction == "top"){  
		this.res.animate([
			{transform: "translateY(-30px)"},
			{transform: "translateY(0px)"},
		],{
				
		duration: duration,
		iterations: 1
		});
	}
				 
	
	if (direction == "bottom"){
		this.res.animate([
			{transform: "translateY(30px)"},
			{transform: "translateY(0px)"},
		],{
				
		duration: duration,
		iterations: 1
		});
	}
				 
		this.res.animate([
			{opacity: "0.0"},
			{opacity: "1.0"}	
		],{
		duration: duration,
		iterations: 1
		});
				 
		this.scrolled = true;	 
			 }	
			} 
		 });
		return this;
	}
} // 2600-1870

export { Animator };
