import {Animator} from "./animator.js";


	
	
class Video extends Animator {
	constructor(url, /*obj*/) {
		super();
		this.url = url;
		this.res = null;
		//this.setup(obj);
		
		this.setup();
	}
		
		
		
		setup(){
			this.res = document.createElement("video");
			this.res.setAttribute("src", this.url);
			this.res.setAttribute("controls", "controls");
		}


		set(obj){
			this.options = obj;
			obj.radius && (this.res.style.borderRadius = "1rem");
			obj.width && (this.res.style.width = `${obj.width}`);
			obj.opacity && (this.res.style.opacity = obj.opacity);
			return this;
		}
		
		
		
		size(w/*, h*/) {
			
			this.res.style.width = w;
			//this.res.style.height = w;
			
			
		/*if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}*/

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
	
	
	//var _oldVideo = Video;
//Video = function(...args) { return new _oldVideo(...args) };
	
export { Video };
