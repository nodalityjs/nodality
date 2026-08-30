/*!
 * nodality v1.3.2
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class Grid extends Animator {
	constructor(frs, saveEl) {
		super();
		// Converted from a standalone class. Opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour; opt in per component.
		this._noTheme = true;
		this.saveEl = saveEl;
		this.frs = frs;
		this.res = null;
		this.setup();
	}

	getType(){
		return "GridLayoutElement";
	}

	setup() {
		let parent = document.createElement("div");
		this.parent = parent;


		let grid = document.createElement("div");
		grid.style.margin = 0;
		grid.style.padding = 0;
		grid.style.display = "grid";
		
		if (this.frs){
			grid.style.gridTemplateColumns = Array(this.frs).fill("1fr").join(" ");
		}
		
		this.res = grid;
		return this;
	}


	size(w, h) {
		if (w === "wide") {
			this.res.style.width = "100%";
		} else {
			this.res.style.width = w;
		}

		if (h === "fit") {
			this.res.style.height = "auto";
		} else {
			this.res.style.height = h;
		}

		return this;
	}

	border(){
		this.res.style.border = "3px solid green";
		return this;
	}

	items(arr) {
		for (var i = 0; i < arr.length; i++) {
			this.res.appendChild(arr[i].render());
		}
		return this;
	}


	center() {
		this.res.style.justifyItems = "center";
		return this;
	}

	padding(val, direction) {
		if (direction) {
			if (direction == "left") {
				this.res.style.paddingLeft = val;
			} else if (direction == "top") {
				this.res.style.paddingTop = val;
			}
		} else {
			this.res.style.padding = val;
		}

		return this;
	}

	onTap(e) {
		this.res.addEventListener("click", e);
		return this;
	}

	gap(value){
		this.gap = `${value}px`;
		return this;
	}

	setColumns(obj) { // (count, h)
		
		
		
		let count = obj.count;
		let h = obj.width;
		
		let query = window.matchMedia("(max-device-width: 415px)");
		
		if (window.innerWidth < h || query.matches) {
			this.res.style.gridTemplateColumns = Array(count).fill("1fr").join(" ");
			this.res.style.gridGap = this.gap; //"30px";
		} else {
			this.res.style.gridGap = this.gap; // "30px";
			this.res.style.gridTemplateColumns = Array(this.frs).fill("1fr").join(" ");
		}


		const adjust = () => {

			if (window.innerWidth < h) {
				this.res.style.gridTemplateColumns = Array(count).fill("1fr").join(" ");
				this.res.style.gridGap = this.gap; //"30px";
			} else {
				this.res.style.gridTemplateColumns = Array(this.frs).fill("1fr").join(" ");
				this.res.style.gridGap = this.gap;   // "30px";
			}
		}

		
		
		window.addEventListener("resize", adjust);
		
		
		return this;
	}

	render(el) {
		if (el){
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
		
	}
}


export { Grid };
