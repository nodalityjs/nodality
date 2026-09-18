/*!
 * nodality v1.3.11
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";


	class Audio extends Animator {
	constructor(url, /*obj*/) {
		super();
		this.url = url;
		this.res = null;
		// An object the mapper can write the element's id into, so that it
		// reaches the generated code below.
		this.options = {};
		
		this.setup();
	}

	// Options come from the generated code; the base class applies `id`
	// after this returns, as it does for every element.
	set(obj = {}) {
		this.options = obj || {};
		return this;
	}

	// There was none. Des mounts an element by running its generated code, and
	// with no toCode() it interpolated the instance itself — emitting
	// "[object Object].render(...)", which is a syntax error, so every
	// {type: "audio"} threw at render.
	toCode() {
		const opts = Object.fromEntries(Object.entries(this.options || {}).filter(([, v]) => v != null));
		const set = Object.keys(opts).length ? `.set(${JSON.stringify(opts)})` : "";
		return [`new Audio(${JSON.stringify(this.url)})${set}`];
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
