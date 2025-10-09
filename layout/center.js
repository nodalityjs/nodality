/*!
 * nodality v1.0.71
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


class Center extends Animator {
 constructor(){
	super();
    // alert("RENAME CONTAINER IN CENTER.js");
	 this.setup();
 }	 
	setup(){
		let el = document.createElement("div");
		
		
		
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

	set(obj){

if (obj.id){
		this.res.setAttribute("id", id);
		}

		this.commonMethods(obj);
		// common methods should be defined in animator
		// I can use pad in center, because animator class handles it

		/*obj.pad && this.pad(obj.pad);
		obj.respad && this.respad(obj.respad);
		obj.resmar && this.resmar(obj.resmar);
		obj.mar && this.mar(obj.mar);
		obj.exact && (this.res.style.fontSize = obj.exact);
		obj.zIndex && (this.res.style.zIndex = obj.zIndex);
		obj.position && (this.res.style.position = position);
		obj.top && (this.res.style.top = top);*/

return this;
	}


	
	toCode(){
		return [""]
	}
	
	items(els){ // keep both for now (items and add methods)
		for (var i = 0; i < els.length; i++){
			let item = els[i].render();//.render();
			this.res.appendChild(item);
		}
		
		return this;
	}

	add(els){
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
