import {Animator} from "./animator.js";

class Wrap { 
	constructor(els){
		this.code = [];

		this.setup();
		
		
		
		
		for (var i = 0; i < els.length; i++){
			
			
			/*var element = els[i];
			var _oldEl = element;
			element = function(...args) { return new _oldEl(...args) };
			*/
			
			
			//console.log(new els[i])
			this.res.appendChild(els[i].render().render());



			
		}
	}



	
	
	setup(){
		let gr = document.createElement("div");
		gr.style.padding = 0;
		gr.style.margin = 0;
		this.res = gr;
	}
	
	width(w, shouldCenter){
		this.res.style.width = w;
		
		if (shouldCenter){
		this.res.style.marginLeft = "auto";
		this.res.style.marginRight = "auto";
		}
		return this;
	}
	
	padding(value){
		this.res.style.padding = `${value}px`;
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
	
	
	
	
	
	/*items(els){
		for (var i = 0; i < els.length; i++){
			this.res.appendChild(els[i].render().render());
		}
		return this;
	}*/
	
	
	
	border(color, width){
		this.res.style.border = `${width}px solid ${color}`;
		return this;
	}
	
	render(el){
		if (el){
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
		
	}
}





































export { Wrap };
