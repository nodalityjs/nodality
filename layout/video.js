/*!
 * nodality v1.1.11
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


	
	
class Video extends Animator {
	constructor(url, /*obj*/) {
		super();
		this.url = url;
		this.res = null;
		
		this.setup();
	}
		
		
		
		setup(){
			this.res = document.createElement("video");
			this.res.setAttribute("src", this.url);
			this.res.setAttribute("controls", "controls");
		}


		set(obj){
			this.options = obj;
			obj.radius && (this.res.style.borderRadius = obj.radius);
			obj.width && (this.res.style.width = `${obj.width}`);
			obj.opacity && (this.res.style.opacity = obj.opacity);
			return this;
		}
		
		
		
		size(w/*, h*/) {
			
			this.res.style.width = w;
			
			

		return this;
	}
		
	toCode() {
        const objString = JSON.stringify(this.options, null, 4);
        return [`new Video("${this.url}").set(${objString})`];
    }
	
		render(el) {
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
	}
	
	
	
export { Video };
