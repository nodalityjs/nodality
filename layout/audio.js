import {Animator} from "./animator.js";

/*class Wrap {
	constructor(){
		this.setup();
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
	
	items(els){
		for (var i = 0; i < els.length; i++){
			this.res.appendChild(els[i].render().render());
		}
		return this;
	}
	
	
	
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
}*/



	class Audio extends Animator {
	constructor(url, /*obj*/) {
		super();
		this.url = url;
		this.res = null;
		//this.setup(obj);
		
		this.setup();
	}
		
		
		
		
		
		setup(){
			this.res = document.createElement("audio");
			this.res.setAttribute("src", this.url);
			this.res.setAttribute("controls", "controls");
			
			
			/*var x = document.createElement("VIDEO");

  if (x.canPlayType("video/mp4")) {
    x.setAttribute("src","movie.mp4");
  } else {
    x.setAttribute("src","movie.ogg");
  }

  x.setAttribute("width", "320");
  x.setAttribute("height", "240");
  x.setAttribute("controls", "controls");
  document.body.appendChild(x);
		
		
		
		
		*/
		}
		
		
		
		size(w/*, h*/) {
			
			this.res.style.width = w;
			//this.res.style.height = w;
			
			
		/*if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}*/

		return this;
	}
		
		
		render(el) {
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
	}
	

export { Audio };
