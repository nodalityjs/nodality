/*!
 * nodality v1.2.1
 * (c) 2026 Filip Vabrousek
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


	
		
	
	
	render(el) {
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
}
export { Center };
