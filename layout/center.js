import {Animator} from "./animator.js";


class Center {
 constructor(id){
    // alert("RENAME CONTAINER IN CENTER.js");
	 this.setup(id);
 }	 
	setup(id){
		let el = document.createElement("div");
		
		if (id){
		el.setAttribute("id", id);
		}
		
		el.style.display = "flex";
		el.style.flexDirection = "column";
		el.style.justifyContent = "center";
		el.style.alignItems = "center";
		el.style.width = "100%";
		el.style.height = "auto";
		el.style.margin = 0;
		el.style.padding = 0;
		this.res = el;
	}
	
	toCode(){
		return [""]
	}
	
	
	items(els){
		for (var i = 0; i < els.length; i++){
			let item = els[i].render();//.render();
			this.res.appendChild(item);
		}
		
		return this;
	}
	
	itemWidth(w){
		for (var i = 0; i < this.res.childNodes.length; i++){
			let el = this.res.childNodes[i];
			el.style.width = w;
		}
		
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
			alert("j")
		this.res.style.margin = L;	
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
    
    itemWidth(w){
		for (var i = 0; i < this.res.childNodes.length; i++){
			let el = this.res.childNodes[i];
			el.style.width = w;
		}
		
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
			alert("j")
		this.res.style.margin = L;	
		}
		
		return this;
	}
	
	/*arrayPadding(arr, value) {
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
	}*/
	
	render(el) {
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
export { Center };
