import {Animator} from "./animator.js";


class Box extends Animator {
    
    constructor(){
        super();
    }
    
	setup(obj){
	let el = document.createElement("div");
    el.style.width = obj.width;
    el.style.height = obj.height;
    el.style.backgroundColor = obj.color;
    this.res = el;
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


export { Box };
