import {Animator} from "./animator.js";

 class Modal {
	constructor(){
		this.el = null;
		this.obj = null;
	}
	
	setup(obj){
		let el = document.createElement("div");
		el.style.width = "100vw";
		el.style.height = "160vh";
		el.style.backgroundColor = obj.background;//"rgba(70,157,115,0.8)";
	   // el.style.backgroundColor = "#3498db";
		el.style.zIndex = "1";
		//el.style.opacity = 0.90;
		el.style.position = "absolute";
		el.style.overflowY = "scroll";
		el.style.display = "block";
		
		this.obj = obj;
		this.res = el;
		return this;
	}

	
	
	
	
	close(){
		this.res.style.display = "none";
		return this;
	}
	
	show(){
		 this.res.style.display = "block";
		return this;
	}
	
	
	add(els){
		
		
		
		
		let el = document.createElement("div");
		el.style.marginTop = "60px";
		el.style.width = this.obj.width; //"60%";
		el.style.height = "auto";
		el.style.marginLeft = "auto";
		el.style.marginRight = "auto";
		el.style.backgroundColor = "white"; // "#3498db";
		el.style.opacity = 1.0;
		el.style.zIndex = "2";
		el.style.borderRadius = "16px";
	  //  el.style.padding = "2em";
		
		
		let mq = window.matchMedia("(max-device-width: 415px)");
		if (mq.matches){
			el.style.marginTop = "200px";
			 el.style.width = "100%";
		}
			
		
	   
		for (var i = 0; i < els.length; i++){
			console.log(els[i]);
			el.appendChild(els[i].render());
		}
		
		
		
		
		  this.res.appendChild(el);
		
	  /*  let inner = new Text("WOW");
	   let ren = inner.render();
		ren.style.zIndex = "2";
		
		this.res.appendChild(ren);
		*/
		
		
		
		return this;
		
	}
	
	
   
render(el) {
	if (el) {
		document.querySelector("body").style.margin = 0;
		document.querySelector("body").style.padding = 0;
		document.querySelector(el).appendChild(this.res);
	} else {
		return this.res;
	}
}
	
	
}


class GridNew {
	constructor(frs, saveEl) {
		this.saveEl = saveEl;
		this.frs = frs;
		this.res = null;
		this.setup();
	}

	setup() {
		let parent = document.createElement("div");
		parent.setAttribute("id", "ABC34");
		this.parent = parent;

		let grid = document.createElement("div");
		grid.style.margin = 0;
		grid.style.padding = 0;
		grid.style.display = "flex";
		grid.style.flexWrap = "wrap";
		
		
		/*
		if (this.frs){
			grid.style.gridTemplateColumns = Array(this.frs).fill("1fr").join(" ");
		}
		grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
		*/
		this.res = grid;
		return this;
	}
	
	absolute(){
		// this.res.style.position = "absolute";
		return this;
	}

	setAreas(areas){
		console.log(areas);
		this.res.children[0].style.gridArea = "a";
		this.res.children[1].style.gridArea = "b";
		this.res.style.gridTemplateAreas = `"a a a b"`;
		console.warn(this.res.style.gridTemplateAreas);
		
	
		return this;
	}

	detailView(){
		/*let detail = document.createElement("img");
		
		detail.setAttribute("src", "https://www.kasandbox.org/programming-images/animals/birds_rainbow-lorakeets.png");
detail.style.width = "400px";
detail.style.marginLeft = "auto";
detail.style.marginRight = "auto";
detail.style.position = "absolute";


		detail.style.zIndex = 2;



		this.parent.appendChild(detail);*/
		this.parent.appendChild(this.res);
		return this;

	}




	
	stretchFit() {
		this.res.style.height = "auto";
		this.res.style.width = "100%";
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
		console.warn(arr);
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
		
			//let media = window.matchMedia(`(max-width: 600px)`);
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
			document.querySelector(el).appendChild(this.parent);
		} else {
			return this.parent;
		}
		
	}
}







window.Modal
GridNew = Modal
GridNew;
export { Modal
GridNew };
