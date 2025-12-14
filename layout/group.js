import {Animator} from "./animator.js";

class Group extends Animator { 
	
	constructor(els){
		super();
		this.setup();
		
		if (els){
			for (var i = 0; i < els.length; i++){
			this.res.appendChild(els[i].render());
		}
		}
	}

	

	color(color){
		for (var i = 0; i < this.res.children.length; i++){
			this.res.children[i].style.color = color;
		}
		return this;
	}

	
	align(direction){
		this.res.style.display = "flex";
		this.res.style.flexDirection = "column";

		if (direction === "left"){
			this.res.style.alignItems = "flex-start"
		}
		
		return this;
	}
	
	setup(){
		let gr = document.createElement("div");
		gr.style.padding = 0;
		gr.style.margin = 0;
		this.res = gr;
	}

	centerContent(){
		
		this.res.style.display = "flex";
		this.res.style.flexDirection = "column";

		this.res.style.alignItems = "center";
		this.res.style.justifyContent = "spaceAround";
		this.res.style.width = "100vw";
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

	background(value){
		this.res.style.backgroundColor = value;
		return this;
	}	
	
	padding(value){
		this.res.style.padding = `${value}px`;
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
			this.res.appendChild(els[i].render());
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
}
export { Group };
