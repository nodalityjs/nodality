import {Animator} from "./animator.js";

class AspectImage extends Animator {
	constructor(url, animation) {
		super();
		this.url = url;
		this.res = null;
		this.animation = animation;
		// this.setup();
	}

	overlayColor(colour){
			this.overlayColor = colour;
			this.res.children[1].style.background = colour;
			return this;
	}

	setup(obj) {
		let wrap = document.createElement("div");
		wrap.style.overflow = "hidden";
		wrap.style.display = "flex";
		wrap.style.justifyContent = "center";
		wrap.style.alignItems = "center";

	/*	let text = document.createElement("p");
		let node = document.createTextNode("Big Ben");
		text.appendChild(node);
		text.style.position = "absolute";
		text.style.transform = "scale(0.0)";
		text.style.font = "Arial";
		text.style.fontSize = "2rem";
		text.style.fontWeight = "bold";
		text.style.pointerEvents = "none";
*/
		let text = obj.view.render();
		text.style.position = "absolute";
		text.style.transform = "scale(0.0)";
		text.style.font = "Arial";
		text.style.fontSize = "2rem";
		text.style.fontWeight = "bold";
		text.style.pointerEvents = "none";

		




		let overlay = document.createElement("div");
		overlay.style.position = "absolute";
		overlay.style.opacity = "0.33";
		overlay.style.width = "250px";
		overlay.style.height = "250px";
		overlay.style.opacity = "0.0"; // 0.0

		overlay.style.pointerEvents = "none";


		let div = document.createElement("div");
		div.style.width = "250px";
		
		
		let query = window.matchMedia("(max-device-width: 415px)");
		div.style.height = "250";
		
		// wrap.style.transition = "0.6s";
		text.style.transition = "0.6s";
		div.style.transition = "0.6s";
		overlay.style.transition = "0.6s";

		
	/*	if (query.matches){
			div.style.height = "450";
		} */
		


		 div.style.backgroundImage = `url("${this.url}")`;
		 div.style.backgroundSize = "cover";
		 div.style.backgroundPosition = "center center";




		 if (this.animation === "scale"){
			div.addEventListener("mouseover", (e) => {
				e.stopImmediatePropagation();
				//wrap.style.transform = "scale(1.25)";
				div.style.transform = "scale(1.25)";
				text.style.transform = "scale(1.0)";
				div.style.filter = "blur(1.5px)";
				overlay.style.opacity = "0.45";
			});
   
			div.addEventListener("mouseout", (e) => {
				e.stopImmediatePropagation();
				// wrap.style.transform = "scale(1.0)";
			   div.style.transform = "scale(1.0)";
			   text.style.transform = "scale(0.0)";
			   overlay.style.opacity = "0.0";
			 div.style.filter = "blur(0px)";
		   });
		 }
		
		



		 wrap.appendChild(div);
		 wrap.appendChild(overlay);
		 wrap.appendChild(text);
		 this.res = wrap;


		 return this;
	}


	arrayPadding(arr, value) {
		if (arr.includes("left")){
			this.res.style.paddingLeft = value;
		}
		
		if (arr.includes("right")){
			this.res.style.paddingRight = value;
		}
		
		if (arr.includes("top")){
			this.res.style.paddingTop = value;
		}
		
		if (arr.includes("bottom")){
			this.res.style.paddingBottom = value;
		}

		if (!value){
			this.res.style.paddingBottom = arr;
				}
			
		
		return this;
	}



	arrayMargin(arr, value) {
		if (arr.includes("left")){
			this.res.style.marginLeft = value;
		}
		
		if (arr.includes("right")){
			this.res.style.marginRight = value;
		}
		
		if (arr.includes("top")){
			this.res.style.marginTop = value;
		}
		
		if (arr.includes("bottom")){
			this.res.style.marginBottom = value;
		}

		if (!value){
			this.res.style.margin = arr;
				}
			
		
		return this;
	}

	onTap(e) {
		this.res.addEventListener("click", e);
		return this;
	}
    
	
	grayscale(amount){
		if (amount){
			this.res.style.filter = `grayscale(${amount})`;
		} else {
			this.res.style.filter = "grayscale(100%)";
		}
		
		return this;
	}
	
	sepia(amount){
		if (amount){
			this.res.style.filter = `sepia(${amount})`;
		} else {
			this.res.style.filter = "sepia(100%)";
		}
		
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




export { AspectImage };
