import {Animator} from "./animator.js";


	
	// NExt
	
	class Audio extends Animator {
		constructor(url) {
			super();
			this.url = url;
			this.res = null;
			this.setup();
		}

		setup() {
			this.res = document.createElement("audio");
			this.res.setAttribute("src", this.url);
			this.res.setAttribute("controls", "controls");
			
		}


		set(obj) {
			this.options = obj;
			obj.background && this.background(obj.background);
			return this;
		}

		

		background(obj) {
			const style = document.createElement("style");
			style.type = "text/css";
			style.textContent = `
	audio::-webkit-media-controls-panel {
		background-color: ${obj};
	}
`;
			document.head.appendChild(style);
			return this;
		}

		toCode() {
			const objString = JSON.stringify(this.options, null, 4);
			return [`new Audio("${this.url}")`];
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

 


//var _oldAudio = Audio;
//Audio = function(...args) { return new _oldAudio(...args) };

export { Audio };
