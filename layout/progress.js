import {Animator} from "./animator.js";

// changed on 26/12/2020

class Progress {
	constructor(value){
		this.res = null;
		this.value = value;
		this.setup();
	}
    
	setup(){
		let wrap = document.createElement("div");
		let bottom = document.createElement("div");
		let top = document.createElement("div");
		bottom.style.position = "absolute";
		top.style.position = "relative";
		wrap.appendChild(bottom);
		wrap.appendChild(top);
		this.res = wrap;
		return this;
	}
	
	padding(L, T, R, B) {
		if (L || T || R || B){ // CAUGHT MYSELF
		this.res.style.paddingLeft = L;
		this.res.style.paddingTop = T;
		this.res.style.paddingRight = R;
		this.res.style.paddingBottom = B;
		} 
		
		if (!T && !R && !B){
			//alert("j")
		this.res.style.padding = L;	
		}
		
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
	
	size(obj){
		let width = obj.width.split("%")[0];
		let h = obj.height;
		
		this.res.children[0].style.width = (width / 100) * window.innerWidth;
		this.res.children[0].style.height = h;
		this.res.children[1].style.width = (width / 100) * window.innerWidth * this.value; 
		this.res.children[1].style.height = h;
		
		
		const adjust = () => {
			this.res.children[0].style.width = (width / 100) * window.innerWidth;
		this.res.children[0].style.height = h;
		this.res.children[1].style.width = (width / 100) * window.innerWidth * this.value; 
		this.res.children[1].style.height = h;
			
		}
		
		
		window.addEventListener("resize", adjust);
		adjust();
		return this;
	}
	
	
	colors(front, back){
	   this.res.children[0].style.background = front;
	   this.res.children[1].style.background = back;
	   return this;
	}
    
    round(val){
      this.res.children[0].style.borderRadius = `${val}px`;
      this.res.children[1].style.borderRadius = `${val}px`;
      return this;
    }
	
	render(el) {
		Array.from(this.res.children).forEach(e => e.style.padding = 0);
		Array.from(this.res.children).forEach(e => e.style.margin = 0);
		
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
	
export { Progress };
