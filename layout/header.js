import {Animator} from "./animator.js";


class Header extends Animator {
	constructor(){
		super();
		this.ele = null;
		// this.setup();
	}

	
	setup(obj){
		let d = document.createElement("div");
		d.style.width = "100%";

		if (obj.width){
			d.style.width = obj.width;
		}
        
		// Add
        d.style.marginLeft = "auto";
		d.style.marginRight = "auto";
        
        if (obj.height){
            d.style.height = obj.height;
        }


		
        
		this.ele = d;
        
        
        this.globalHeight = obj.height;
        this.gRound = obj.round;
        
        
        if (obj.url){
            this.url(obj.url, 0, obj);
        }
        





		if (obj.fixedScale){
			
			this.ele.children[0].style.backgroundSize = "contain";
			this.ele.children[0].style.backgroundRepeat = "no-repeat";


			if (obj.width){
				d.style.width = obj.width;
			}
		}

		
		return this;
	}


	

	fadeIn(){
		this.ele.animate(
			[{ opacity: 0 }, 
				{ opacity: 1 }],
			{
			  duration: 1000,
			  easing: 'linear',
			},
		  );
		return this;
	}
	
	url(url, round, obj){
		let flex = document.createElement("div");
		flex.style.display = "flex";
		flex.style.flexDirection = "column";
		flex.style.justifyContent = "center";
		flex.style.alignItems = "center";
		flex.style.height = `${this.globalHeight}px`;
		flex.style.width = "100%";
		flex.style.backgroundImage = `url("${url}")`;


		if (obj.radius){
			flex.style.borderRadius = "1.4rem";
		}
		
		// NEW
		flex.style.backgroundPosition = "center";

		// flex.style.filter = "blur(8px)";
		flex.style.backgroundSize = "cover";
		if (this.gRound) {
			flex.style.borderRadius = `16px`;
		}
		
		this.ele.appendChild(flex);
		return this;
	}
	

	urlImage(url, round){
		let image = document.createElement("img");
		
		 image.setAttribute("src", url);
		 image.style.filter = "blur(8px)";
		
		if (this.gRound) {
			image.style.borderRadius = `16px`;
		}
		
		this.ele.appendChild(image);
		return this;
	}
	

	elements(els){
		for (var i = 0; i < els.length; i++){
			var res = els[i].render().render(); // TWICE RENDER HACK
			this.ele.childNodes[0].appendChild(res);
			//this.ele.appendChild(res);
		}
	
		return this;
	}
	
	

	round(value){
		this.ele.style.borderRadius = `${value}px`;
		return this;
		}
	

	onTap(e){
		this.ele.addEventListener("click", e);
		return this;
	}
	
	/*em(n){
		this.ele.style.fontSize = `${n}em`;
		return this;
	}*/
	
	render(div){
		document.querySelector("body").style.margin = 0;
		document.querySelector("body").style.padding = 0;
		
		if (div){
			document.querySelector(div).appendChild(this.ele);
		} else {
			return this.ele; // this.ele();
		}
			return this;
	}
} 












// ----------------------------------------------------------------

export { Header };
