import {Animator} from "./animator.js";



// 13:28 07/04/2020 - BEGIN NOTHING GONNA STOP US NOW  Lets go!
class UList extends Animator {
	constructor(){
		super();
		this.res = null;
		this.setup();
	}


	set(obj){
		obj.pad && this.pad(obj.pad);
		obj.mar && this.mar(obj.mar);
		return this;
	}
	
	setup(){
		let el = document.createElement("ul");
		this.res = el;
		
		this.res.style.padding = 0;
		this.res.style.margin = 0;
		return this;
	}


	newItems(items){
		for (var i = 0; i < items.length; i++){
			console.log(items[i]);
			let rendered = items[i].render();
			this.res.appendChild(rendered);
		}
		
		return this;
	}
	
	items(itemso){
		for (var i = 0; i < itemso.length; i++){
			let li = document.createElement("li");
			let node = document.createTextNode(itemso[i]);
			li.appendChild(node);
			this.res.appendChild(li);
		}
		
		return this;
	}
	
	
	font(font){
		this.res.style.fontFamily = font;
		return this;
	}
	
	
	size(s){
		this.res.style.fontSize = s;
		return this;
	}
	
	em(e){
		this.res.style.fontSize = `${e}em`;
		return this;
	}
	
	color(color){
		this.res.style.color = color;
		return this;
	}
	
	align(direction){
		this.res.style.textAlign = `${direction}`;
		return this;
	}
	
	weight(weight){
		this.res.style.fontWeight = weight;
		return this;
	}
	
	bold(){
		this.res.style.fontWeight = "bold";
		return this;
	}
	
	italic(){
		this.res.style.fontStyle = "italic";
		return this;
	}
	
	/*padding(val){
		this.res.style.padding = val;
		return this;
	}*/
	
	
	margin(val){
		this.res.style.margin = val;
		return this;
	}
	
	border(w, color){
		this.res.style.border = `${w}px solid ${color}`;
		return this;
	}
	
	
	
	
	padding(T, L, R, B){
		this.res.style.paddingTop = T;
		this.res.style.paddingLeft = L;
		this.res.style.paddingRight = R;
		this.res.style.paddingBottom = B;
		return this;
	}
	
	
	
	
	headline(){
		this.em(4)
		this.font("Arial")
		this.bold()
		return this;
	}
	
	
	caption(){
		this.bold();
		this.res.style.fontFamily = "Arial";
		this.res.style.color = "#3498db";
		return this;
	}
	
	render(div){
		if (div){
			document.querySelector(div).appendChild(this.res);
		} else {
			return this.res;
		}	
	}
}
	 
export { UList };
