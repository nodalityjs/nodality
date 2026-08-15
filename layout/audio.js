/*!
 * nodality v1.1.6
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


	class Audio extends Animator {
	constructor(url, /*obj*/) {
		super();
		this.url = url;
		this.res = null;
		
		this.setup();
	}
		
		
		
		
		
		setup(){
			this.res = document.createElement("audio");
			this.res.setAttribute("src", this.url);
			this.res.setAttribute("controls", "controls");
			
			
		}
		
		
		
		size(w/*, h*/) {
			
			this.res.style.width = w;
			
			

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
