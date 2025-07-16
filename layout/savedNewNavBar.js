import {Animator} from "./animator.js";

class UINavBar extends Animator {
	constructor(els){
		super();
		this.res = null;
		this.titleText = "";
		this.hasHamburger = false;
		// this.setup();
		
		/*if (els){
			this.items(els);
		}*/
	}




	/*hamburger(colour){
this.hamburgerColour = colour;
return this;
	}*/


	styled(obj){
		this.obj = obj;
		this.setup(obj);
		return this;
	}
	
	setup(obj){
		let el = document.createElement("div");
		el.setAttribute("id", "covid");
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
		this.res = el;
		
		// EVIL LINE
		// window.addEventListener("resize", this.adjust.bind(this));
		




		if (obj.background){
			this.background({color: obj.background});
		}

		if (obj.sticky){
			this.sticky();
		}


		if (obj.hamburgerColour){
			this.hamburgerColour = obj.hamburgerColour;
		}


		if (obj.mobileSize){
			this.mobileSize = obj.mobileSize;
		}

		if (obj.desktopSize){
			this.desktopSize = obj.desktopSize;
		}

		if (obj.height){
			this.res.style.height = obj.height;
		}

		/*if (obj.height){
			this.res.style.height = obj.height;
		}*/

		return this;
	}
    
    
    
    
    items(items){
        
        
        
     /* var itemsa = items.filter(item => item.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer") === false);
        
        this.itemCount = itemsa.length;
        */
       



		let starts = ["Link", "Image", "Spacer"].some(e => {
			
			return items[0].__proto__
			.constructor
			.toString()
			.startsWith(`class ${e}`);
		});

		console.log(starts)




		// let allow = items[0] instanceof Link || items[0] instanceof Spacer || items[0] instanceof Text || items[0] instanceof Image
        
		
if (starts){

		console.log(items[0]);
		console.log(items[0] instanceof Spacer)
		console.log("WHAT ?????")
        
          this.itemCount = items.length;

        
        for (var i = 0; i < items.length; i++){
            
        var item = items[i];
        var isSpacer = item.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer");
                 this.res.appendChild(item.render());
		}
        
        
        this.adjust();
		
		
	}



		if (!starts) { // User is lazy
			this.itemCount = items.length;

			for (var i = 0; i < items.length; i++) {
				let item = items[i];


				if (item.logo){
					let logo = new Image(item.logo).width("100px");
					this.res.appendChild(logo.render());
				}

				if (this.obj.spacing){
					let d = document.createElement("div");
					d.style.flex = "1";
					//this.res.appendChild(d)
				}

				if (item.title){
					let link = new Link(item.title, item.url);
					this.res.appendChild(link.render());
				}


			}

			this.adjust();
		}

		
        
        
		return this;
        
    }

	

	instance(){
		return this.res;
	}
	
	
	/*items(items){
		this.itemCount = items.length;
		for (var i = 0; i < items.length; i++){
        this.res.appendChild(items[i].render());
		}
		
		this.adjust();
		return this;
	}*/
	
	
	
	sticky(){
		this.res.style.position = "fixed";
		return this;
	}
	
	font(family){
		
		for (var i = 0; i < this.res.children; i++){
			this.res.children[i].style.fontFamily = family;
		}
		
		return this;
	}
	

	
	openSymbol(symbol){
		this.symbol = symbol;
		return this;
	}
    
    
        background(obj){
            this.res.style.backgroundColor = obj.color;
              this.res.style.opacity = obj.opacity;
            return this;
        }
    
    transluescent(){
        this.res.style.backgroundColor = "rgba(255,255,255,0.72)";
        return this;
        //background-color: rgba(255,255,255,0.72);
    }
    
    
    keepItem(item){
        console.log("Wow");
        this.keepItem = item;
        return this;
    }
	
/*--------------------------------------------------ADJUST--------------------------------------------------*/	
	// set habmurger icon
adjust(w) {
	let media = window.matchMedia(`(max-width: 600px)`);
	let media2 = window.matchMedia(`(max-device-width: 415px)`);

	if (media.matches || media2.matches) {
		this.res.style.height = "auto";
		this.res.style.flexDirection = "column";
	} else {
		this.res.style.flexDirection = "row";
		this.res.style.marginLeft = 0;
	}

	const addHamburger = () => {
		var btn = document.createElement("button");
		var node = document.createTextNode(this.symbol ? this.symbol : "☰");
		btn.style.border = "none";
		btn.style.fontWeight = "bold";

		// alert(this.hamburgerColour);
		btn.style.color = this.hamburgerColour ?? "#3498db";
		btn.style.backgroundColor = "#fff";
		btn.style.fontSize = media2.matches ? "2.1em" : "2em";
		btn.appendChild(node);
		 btn.style.marginLeft = "auto";
		
	
		return btn;
	}

	
	const adjustFontSize = () => {
		console.log("IN VIEWPORT")
		for (var i = 0; i < this.res.children.length; i++) {
			let el = this.res.children[i];
			el.style.fontSize = media2.matches ? (this.mobileSize ? this.mobileSize : "1.2em") : (this.desktopSize ? this.desktopSize : "1em");

            
              var isSpacer = el.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer");
            
           // console.error("---------ERROR---------");
           // console.warn(el.style.flexGrow == "1");
           // console.log(el.style.getPropertyValue("flex-grow"));
           // console.log(el.style.getPropertyValue("flex-grow") == 1);
           // console.warn(isSpacer);
          
            
            if (el.style.getPropertyValue("flex-grow") == 1){
              // alert("A")
                // el.style.setProperty("display", "none");
             //   el.style.marginTop = "0em";
              //  el.style.flex = "none";
                
              //  console.log(el.style)
               
            }
            
            
            
			if (el.textContent === "☰") {
				el.style.fontSize = "2em";
			}
		}
	}

	const toWideScreen = () => {
		for (var i = 0; i < this.res.children.length; i++) {
			
			let child = this.res.children[i];
			
			child.style.marginTop = "0em";
			child.style.display = "block";
			
			if (child.textContent === this.titleText && this.titleText.length > 0) {
                alert(child.textContent)
				child.style.fontSize = "2em";
			}
			
		if (this.res.childNodes[i].textContent == "☰") {
			this.res.removeChild(this.res.childNodes[i]);
		}
		
		}

	
		this.res.style.flexDirection = "row";
	}
	


	var added = false;
	
	const doInAdjust = () => {
		
		adjustFontSize();
		var closed = false;
		var btn = addHamburger();
		
		 /*(((this.res.children.length == this.itemCount + 1)||*/
		if (this.res.children.length == this.itemCount) { // Problem here
			this.res.insertBefore(btn, this.res.firstChild);
		// alert("ADDA");
		}

		this.res.style.flexDirection = "column";
		for (var i = 0; i < this.res.children.length; i++) {
			if (this.res.children[i].textContent == "☰" || this.res.children[i].textContent == /*"Lands"*/ this.keepItem){
				this.res.children[i].style.display = "block";
			} else {
				this.res.children[i].style.display = "none";
			}
		}

		btn.addEventListener("click", () => {
			// alert
			closed = !closed;

			for (var i = 0; i < this.res.children.length; i++) {
				if (i != 0 && this.res.children[i].textContent != /*"Lands"*/ this.keepItem) {

					if (!closed) {
						this.res.children[i].style.display = "none";
						this.res.children[i].style.marginTop = "0em";
					} else {
                        
                        
                        if (this.res.children[i].getAttribute("class") === "innerHider"){
                            // alert("WOW");
                               this.res.children[i].style.display = "none";
                        } else {
                            this.res.children[i].style.display = "block";
						this.res.children[i].style.marginTop = "3em";
                        }
                        
                        
						
					}
				}
			}
		});
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
			document.querySelector(div).appendChild(this.res);
		} else {
			return this.res;
		}
			return this.res;
	}
}
	 
window.UINavBar
Spacer
Spacer
Spacer = UINavBar
Spacer
Spacer
Spacer;
export { UINavBar
Spacer
Spacer
Spacer };
