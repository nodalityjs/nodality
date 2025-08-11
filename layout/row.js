import {Animator} from "./animator.js";

class Row {
	constructor(frs, saveEl) {
		this.saveEl = saveEl;
		this.frs = frs;
		this.res = null;
		this.setup();
		this.responsive();
	}
	
	center() {
	//	this.res.style.justifyItems = "center";
		return this;
	}


	toCode(){
		return this.code;
	}
	
	toColumn(at){

		const toCol = () => {
			let media = window.matchMedia(`(max-width: ${at})`);
			// let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);

			if (media.matches){
				this.res.style.gridTemplateColumns = "1fr";
			} else {
				this.res.style.gridTemplateColumns = "1fr 1fr";

			}
		}

		toCol();
		window.addEventListener("resize", toCol);
	

		
	

		return this;
	}

	

	


	styled(obj){
		obj.gap && this.gap(obj.gap);
		return this;
	}

	gap(val){
		this.res.style.gap = val;
		return this;
	}


	static test(){
		alert("Wow")
	}

	setup(obj) {
		//let parent = document.createElement("div");
		//this.parent = parent;

		let flex = document.createElement("div");
        flex.setAttribute("class", "someClass");
		flex.style.display = "grid";
		flex.style.gridTemplateColumns = "1fr 1fr";
		flex.style.alignItems = "center";
		flex.style.margin = 0;
		flex.style.padding = "1em";
		//flex.style.width = "100%";
		
		//flex.style.display = "flex";
		
		this.res = flex;
		return this;
	}

	set(options){
		if (options.width){
			this.setWidth(options.width);
		}

		if (options.align){
			//alert("K")
			//this.makeAlign(options.align);
			 this.setAlign(options.align);
		}

		if (options.centered){
			this.res.style.marginRight = "auto";
			this.res.style.marginLeft = "auto";
		}


		if (options.toCol){
			this.toColumn(options.toCol);
		}


		

		

		return this;
	}



	setAlign(){
		this.res.style.justifyItems = "center";
		return this;
	}

	


	setWidth(w){
		this.res.style.width = w;
	}
	
    background(color){
        this.res.style.background = color;
        return this;
    }
    
    radius(val){
        this.res.style.borderRadius = `${val}px`;
        return this;
    }
    
    
	  items(arr) {
        
        var frString = "";
        
        
		//// console.warn(this.res);
		for (var i = 0; i < arr.length; i++) {
			
			
			frString += "1fr ";
			
			
			
			let r = arr[i].render();
		 // r.style.width = "100%";
			//r.style.flex = 1;
			this.res.appendChild(r);
		}
        
        
        this.res.style.gridTemplateColumns = frString;
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
		
		
		
		
		
		return this;
	}
	
     frame(obj){
        this.res.style.width = obj.width;
        this.res.style.height = obj.height;
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

export { Row };
