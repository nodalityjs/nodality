import {Animator} from "./animator.js";



// 13:28 07/04/2020 - BEGIN NOTHING GONNA STOP US NOW  Lets go!
class Footer {
	constructor(text){
		this.text = text;
		this.ele = null;
		this.setup();
	}
	
	setup(){
		let el = document.createElement("footer");
		let node = document.createTextNode(this.text);
		el.appendChild(node);
		this.ele = el;
		this.ele.style.padding = 0;
		this.ele.style.margin = 0;
		this.ele.style.textAlign = "center";
		
		this.padding(20);
		this.bold();
		this.ele.style.backgroundColor = "#ecf0f1";
		return this;
	}
	
	font(font){
		this.ele.style.fontFamily = font;
		return this;
	}
	
	size(s){
		this.ele.style.fontSize = s;
		return this;
	}
	
	em(e){
		this.ele.style.fontSize = `${e}em`;
		return this;
	}
	
	color(color){
		this.ele.style.color = color;
		return this;
	}
	
	weight(weight){
		this.ele.style.fontWeight = weight;
		return this;
	}
	
	bold(){
		this.ele.style.fontWeight = "bold";
		return this;
	}
	
	italic(){
		this.ele.style.fontStyle = "italic";
		return this;
	}
	
	padding(val){
		this.ele.style.padding = val;
		return this;
	}
	
	
	margin(val){
		this.ele.style.margin = val;
		return this;
	}
	
	render(div){
		if (div){
			document.querySelector(div).appendChild(this.ele);
		} else {
			return this.ele;
		}	
	}
}
	
export { Footer };
