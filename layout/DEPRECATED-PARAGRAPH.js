import {Animator} from "./animator.js";

 class Paragraph extends Animator {
	constructor() {
		super();
		this.setup();
	}
	
	
	
	
	setup() {
		let paragraph = document.createElement("p");
		paragraph.padding = 0;
		paragraph.margin = 0;
		this.res = paragraph;
		return this;
	}
	
	font(font){
		this.res.style.fontFamily = "Arial";
		return this;
	}
	
	align(direction){
		this.res.style.textAlign = `${direction}`;
		return this;
	}
	
	bold(){
		this.res.style.fontWeight = "700";
		return this;
	}
	
	text(text){
		let node = document.createTextNode(text);
		this.res.appendChild(node);
		return this;
	}
	
	
	em(size){
		this.res.style.fontSize = `${size}em`;
		return this;
	}
	
	
	
	width(w, shouldCenter){
		this.res.style.width = w;
		
		if (shouldCenter){
		this.res.style.marginLeft = "auto";
		this.res.style.marginRight = "auto";
		}
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
	
	
	render(el) {
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
export { Paragraph };
