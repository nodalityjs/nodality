import {Animator} from "./animator.js";

class OffsetContainer extends Animator{ 
	constructor() {
        super();
		this.res = null;
		this.code = [];
		//this.setup();
	}

	toCode(){
		return this.code;
	}


	resetColumns(){
		this.res.style.gridTemplateColumns = "";
		this.res.style.gridTemplateRows = "";
		return this;
	}

	set(obj){
		 obj.align && this.flexAlign(obj.align);
		 obj.toStart && this.toStart(obj.toStart);
		 obj.columns && this.columns(obj.columns);
		 obj.width && (this.res.style.width = obj.width);
		 obj.border && (this.res.style.border = obj.border);
		 obj.simpleCenter && this.simpleCenter();
		// obj.simpleCenter && (stra += `center: "${obj.simpleCenter}",`);

		if (obj.field) {
			this.res.style.gridTemplateRows = obj.field.rows;
			this.res.style.gridTemplateColumns = obj.field.columns;
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

	// https://youtube.com/shorts/u7q1Qj1uuD8?feature=share


	columns(cols){
		this.res.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
		return this;
	}

	toStart(perc){
		/*this.res.style.display = "flex";
		this.res.style.justifyContent = "flex-start";
		this.res.style.alignItems = "flex-start";*/
		this.res.style.display = "grid";
		this.res.style.placeItems = "flex-start";
		this.res.style.justifyContent = "flex-start";
		return this; // 224505 15/03 Nice
	}

	flexAlign(perc){
		/*this.res.style.display = "flex";
		this.res.style.justifyContent = "flex-start";
		this.res.style.alignItems = "flex-start";*/
		this.res.style.display = "grid";
		this.res.style.placeItems = "flex-start";
		this.res.style.alignItems = "center";
		return this; // 224505 15/03 Nice
	}

	// https://youtube.com/shorts/u7q1Qj1uuD8?feature=share
	add(els){

		this.code.push("new OffsetContainer() \n");
		this.code.push(".setup({ class: 'wow', center: true, reset: true }) \n");
		// this.code.push(".margin('auto', 0, 'auto', 0) \n");
		this.code.push(".add([ \n");
// 155732 I can drag

		/* new OffsetContainer()
                    .setup({ class: "wow", center: true, reset: true })
                    .margin("auto", 0, "auto", 0)*/



		for (var i = 0; i < els.length; i++){

			if (els[i] === undefined){
				continue;
			}
			
			let item = els[i].render();//.render();

			if (this.options.reset){
				item.style.gridArea = "1/1";
			}
			this.res.appendChild(item);

			if (els[i].toCode()){
				// console.log("EMO");

				if (els[i].toCode() instanceof Array){ // 114341

					if (i === 0){
						
						//console.log(els[i].toCode());
						if (els[i].toCode()[0].startsWith(" ,new")){
							//console.log("---");
							els[i].toCode()[0] = els[i].toCode()[0].replace(" ,new", "new");

							
							const joined = els[i].toCode().flatMap(l => l).join("");
							//console.log(joined);
					this.code.push(`${joined}`);
						}
					} else {
						const joined = els[i].toCode().flatMap(l => l).join("");
						this.code.push(`${joined}`);
					}

					
				} else {
					this.code.push(`${els[i].toCode()}`);
				}
				


				if (i == els.length - 1){
					if (this.code[this.code.length - 1].endsWith(",")){
					//	alert("IJ")
					this.code[this.code.length - 1] = this.code[this.code.length - 1].replace(/(^[,\s]+)|([,\s]+$)/g, '')
					}
				}

				// 15:05:18 06/03/2023
			}

		}


		this.code.push("]),");





		
		return this;
	}
    
    
    setWidth(w){
       
        this.res.style.width = "100vw";
    }

	setHeight(w){
       
        this.res.style.height = `${w}`;
		return this;
    }



	/*toZStack(){
this.res.style.display = "grid";
		let st = this.res.style;

		this.res.style.display = "flex";
		st.justifyContent = "center";
		st.alignItems = "center";
	}*/
    
	setup(options) {
		this.options = options;
		let container = document.createElement("div");
		this.res = container;
		this.res.style.margin = 0;
		this.res.style.padding = 0;
        
        
      //  this.res.setAttribute("class", options.id);
        
          this.res.setAttribute("class", options.class);
        
        if (options.hideOverflow === true){
            this.res.style.overflow = "hidden";
             this.res.style.overflowY = "scroll";
        }
        
        
      
            this.res.style.display = "grid";
            this.res.style.flexDirection = "column";
            this.res.style.justifyContent = "center";
            this.res.style.alignItems = "center";
     
            this.res.style.gridColumnStart = 1;
            this.res.style.gridRowStart = 1;



            this.res.style.gridTemplateColumns = "1fr 1fr 1fr 1fr 1fr 1fr";
            this.res.style.gridTemplateRows = "1fr 1fr 1fr";
        
        
         if (options.height){
            this.res.style.height = options.height;
         }
        
        
        if (options.width){
            this.res.style.width = options.width;
            this.res.style.marginLeft = "auto";
            this.res.style.marginRight = "auto";
            
             let phone = window.matchMedia("(max-device-width: 415px)");
        
        
        if (phone.matches){
             this.res.style.width = "95%";
        }
        }
        
        
    


		if (options.reset){
			this.res.style.gridTemplateColumns = "";
			this.res.style.gridTemplateRows = "";
		//	this.res.style.placeItems = "center";
		}
       
        
		return this;
	}
	
	
	

	setTemplate(rows, cols){
		this.res.style.gridTemplateRows = rows;
		this.res.style.gridTemplateColumns = cols;
		return this;
	}

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
	
	
    
    
    
    
    
    
     
    /*intoJSXO(obj){
        return <div ref={ref => {
            ref && ref.appendChild(obj)
        }} />;
return this;
    }*/
    
    
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












export { OffsetContainer };
