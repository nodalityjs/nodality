import {Animator} from "./animator.js";


class Card {
	constructor(text, url) {
		this.text = text;
		this.url = url;
		this.setup();
	}

	setup() {
		let query = window.matchMedia("(max-device-width: 415px)");
		let card = document.createElement("div");
		card.style.display = "flex";
		card.style.flexDirection = "column";
		card.style.backgroundColor = "#fff";
		card.style.fontFamily = "Arial";
		card.style.width = "100%"; // NOT THE CUPLRIT
		// IMAGE NOT THE CUPLRIT
		// NORMATEC IS
		this.el = card;	
		return this;	
	}
	
	background(color){
		this.el.style.backgroundColor = color;
		return this;
	}
	
	color(color){
		this.el.style.color = color;
		return this;
	}
	
	title(text){
		let query = window.matchMedia("(max-device-width: 415px)");
		let title = document.createElement("h2");
		title.style.padding = "0.33em";
		if (query.matches){
			title.style.fontSize = "3em";
		}
		
		let node = document.createTextNode(text);
		title.appendChild(node);
		
		this.el.appendChild(title);
		return this;
	}
	
	content(text, h){
		let query = window.matchMedia("(max-device-width: 415px)");
		let subtitle = document.createElement("p");
		subtitle.style.padding = "0.33em";
		
		if (query.matches){
			subtitle.style.fontSize = "1.8em";
		}
		
		let snode = document.createTextNode(text);
		subtitle.appendChild(snode);
		subtitle.style.flex = 1;
		this.el.appendChild(subtitle);
		return this;
	}
	
	image(url, value, direction){
		let query = window.matchMedia("(max-device-width: 415px)");
		let back = document.createElement("div");
		back.style.backgroundColor = "#ecf0f1";
		back.style.width = "100%";
		back.style.height = "200";
		
		if (query.matches){
			back.style.height = "500";
		}
		
		back.style.backgroundImage = `url(${url})`;
		back.style.backgroundPosition = "center center";
		back.style.backgroundSize = "cover";
		back.style.borderTopLeftRadius = `${value}px`;
		back.style.borderTopRightRadius = `${value}px`;
	
		this.el.appendChild(back);
		return this;
	}
	
	
	button(text, target){
		let query = window.matchMedia("(max-device-width: 415px)");
		
		let a = document.createElement("a");
		a.setAttribute("href", target);
		let node = document.createTextNode(text);
		a.appendChild(node);
		a.style.backgroundColor = "#3498db";
		a.style.color = "white ";
		a.style.textDecoration = "none";
		a.style.padding = "1em";
		a.style.margin = "1em"
		a.style.borderRadius = "0.5em";
		
		if (query.matches){
			a.style.fontSize = "2.3em";
		}
		
		let flex = document.createElement("div");
		flex.style.display = "flex";
		flex.style.width = "100%";
		flex.style.height = "auto";
		flex.style.justifyContent = "center";
		flex.appendChild(a);
		 this.el.appendChild(flex);
		return this;
	}
	
	shadow(){
	this.el.style.boxShadow = "1px 1px 20px rgba(0, 0, 0, 0.20)";
	return this;
    }
	
	
	round(value){
	this.el.style.borderRadius = `${value}px`;
	return this;
	}

	render(div){
		if (div){
			document.querySelector(div).appendChild(this.el);
		} else {
			
			return this.el;
		}	
	}
} 
export { Card };
