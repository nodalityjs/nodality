import {Animator} from "./animator.js";

class NavBar {
	constructor(){
		this.ele = null;
		this.titleText = "";
		this.hasHamburger = false;
		this.setup();
	}
	
	
	setup(){
		let el = document.createElement("div");
		el.style.backgroundColor = "#fff";
	
		el.style.display = "flex";
		el.style.justifyContent = "space-around";
		el.style.alignItems = "center";
		el.style.margin = 0;
		el.style.padding = 0;
		el.style.width = "100%";
		//-------------DEFAULT STYLING----------
		el.style.margin = 0;
		el.style.paddingTop = "1em";
		el.style.paddingBottom = "1em";
		this.ele = el;
		
		window.addEventListener("resize", this.adjust.bind(this));
		return this;
	}
	

	
	title(text){
		this.titleText = text;
		let h = document.createElement("h2");
		let node = document.createTextNode(text);
		h.style.margin = 0;
		h.style.padding = 0;
		h.style.fontFamily = "Arial";
		h.style.fontSize = "2em";
		h.appendChild(node);
		this.ele.appendChild(h);
		return this;
	}
	
	
	image(url){
		let h = document.createElement("img");
		h.setAttribute("src", url);
		h.style.margin = 0;
		h.style.padding = 0;
		h.style.width = 50;
		this.ele.appendChild(h);
		return this;
	}
	
	items(items){
		this.itemCount = items.length;
		for (var i = 0; i < items.length; i++){
			this.ele.appendChild(items[i].render());
		}
		
		this.adjust();
		return this;
	}
	
	
	font(family){
		
		for (var i = 0; i < this.ele.children; i++){
			this.ele.children[i].style.fontFamily = family;
		}
		
		return this;
	}
	

	
	openSymbol(symbol){
		this.symbol = symbol;
		return this;
	}
	
	
/*--------------------------------------------------ADJUST--------------------------------------------------*/	
	// set habmurger icon
adjust(w) {
	let media = window.matchMedia(`(max-width: 600px)`);
	let media2 = window.matchMedia(`(max-device-width: 415px)`);

	if (media.matches || media2.matches) {
		this.ele.style.flexDirection = "column";
	} else {
		this.ele.style.flexDirection = "row";
		this.ele.style.marginLeft = 0;
	}

	const addHamburger = () => {
		var btn = document.createElement("button");
		var node = document.createTextNode(this.symbol ? this.symbol : "☰");
		btn.style.border = "none";
		btn.style.fontWeight = "bold";
		btn.style.color = "#3498db";
		btn.style.backgroundColor = "#fff";
		btn.style.fontSize = media2.matches ? "4em" : "2em";
		btn.appendChild(node);
		 btn.style.marginLeft = "auto";
		
	//	alert("ADDED HABURGER!");
		return btn;
	}

	
	const adjustFontSize = () => {
		for (var i = 0; i < this.ele.children.length; i++) {
			let el = this.ele.children[i];
			el.style.fontSize = media2.matches ? "2.4em" : "1em";

			if (el.textContent === "☰") {
				el.style.fontSize = "2em";
			}
		}
	}

	const toWideScreen = () => {
		for (var i = 0; i < this.ele.children.length; i++) {
			
			let child = this.ele.children[i];
			
			child.style.marginTop = "0em";
			child.style.display = "block";
			
			if (child.textContent === this.titleText) {
				child.style.fontSize = "2em";
			}
		}

		if (this.ele.childNodes[0].textContent == "☰") {
			this.ele.removeChild(this.ele.childNodes[0]);
		}
		
		this.ele.style.flexDirection = "row";
	}
	


	var added = false;
	
	const doInAdjust = () => {
		
		
		
		adjustFontSize();

		var closed = false;
		
		
		if (!this.hasHamburger){
			
		
		var btn = addHamburger();
	
		
		
		/*console.warn("LENA");
		console.log(this.ele.children.length);
		console.log(this.itemCount);*/
		
		
		
		
		if (((this.ele.children.length == this.itemCount + 1) || (this.ele.children.length == this.itemCount))) {
			this.ele.insertBefore(btn, this.ele.firstChild);
			this.hasHamburger = true;
		}

		this.ele.style.flexDirection = "column";
		for (var i = 0; i < this.ele.children.length; i++) {
			if (this.ele.children[i].textContent == "☰"){
				this.ele.children[i].style.display = "block";
				
			
				// MYCHANGE
			}/*  else if (this.ele.children[i].textContent == "London tours"){
				this.ele.children[i].style.display = "block";
				this.ele.children[i].style.paddingTop = "0";
				this.ele.children[i].style.position = "absolute";
			} */else {
				this.ele.children[i].style.display = "none";
			}
		}

		btn.addEventListener("click", () => {
			// alert
			closed = !closed;

			for (var i = 0; i < this.ele.children.length; i++) {
				if (i != 0) {

					if (!closed) {
						this.ele.children[i].style.display = "none";
						this.ele.children[i].style.marginTop = "0em";
					} else {
						this.ele.children[i].style.display = "block";
						this.ele.children[i].style.marginTop = "3em";
					}
				}
			}
		});
	}
		
		
		
		this.hasHamburger = true;
	}

	const adjust = () => {
		if (media.matches || media2.matches) {
			doInAdjust();
		} else {
			toWideScreen();
		}
	}

	if (media.matches || media2.matches) {
		doInAdjust();
	} else {
		toWideScreen();
	}



	window.addEventListener("resize", adjust);
	return this;
}
	
/*--------------------------------------------------ADJUST--------------------------------------------------*/	
	
	
	
	
	
	
	
	
	

	render(div){
		if (div){
			document.querySelector(div).style.padding = 0;
			document.querySelector(div).style.margin = 0;
			document.querySelector(div).appendChild(this.ele);
		} else {
			return this.ele;
		}
			return this.ele;
	}
}
	
export { NavBar };
