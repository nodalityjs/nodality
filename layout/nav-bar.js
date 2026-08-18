/*!
 * nodality v1.2.0
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class NavBar extends Animator{
	constructor(els){
		super();
		// Converted from a standalone class; opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour.
		this._noTheme = true;
		this.res = null;
		this.titleText = "";
		this.hasHamburger = false;
		this.setup(); // should nt be eited 2024
		
		if (els){
			this.items(els);
		}
	}

	hamburger(colour) {
		this.hamburgerColour = colour;
		return this;
	}
	
	setup(){
		let el = document.createElement("div");
		el.style.backgroundColor = "#fff";
	
		el.style.display = "flex";
		el.style.justifyContent = "space-around";
		el.style.alignItems = "center";
		el.style.margin = 0;
		el.style.padding = 0;
		//-------------DEFAULT STYLING----------
		el.style.margin = 0;
		el.style.paddingTop = "1em";
		el.style.paddingBottom = "1em";
		this.res = el;
		// EVIL LINE
		
		return this;
	}
	
	set(styles) {
        for (let prop in styles) {
            if (prop === 'margin') {
                let paddingValues = styles[prop];
                if (Array.isArray(paddingValues) && paddingValues.length > 0) {
                   
					for (let pado of paddingValues){

					
					let paddingObject = pado;// paddingValues[0]; // Assuming only one object in the array
                    if (paddingObject.hasOwnProperty('top')) {
                        this.res.style.marginTop = paddingObject['top'];
                    }
                    if (paddingObject.hasOwnProperty('right')) {
						//alert("P")
                        this.res.style.marginRight = paddingObject['right'];
                    }
                    if (paddingObject.hasOwnProperty('bottom')) {
                        this.res.style.marginBottom = paddingObject['bottom'];
                    }
                    if (paddingObject.hasOwnProperty('left')) {
                        this.res.style.marginLeft = paddingObject['left'];
                    }
				}


                }
            }
        }

		return this;
    }
    
	radius(rad){
		this.res.style.borderRadius = rad;
		return this;
	}
    
    
    
    items(items){
        
        
        
       
        
        
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


    
    
        background(obj){
            this.res.style.backgroundColor = obj.color;
              this.res.style.opacity = obj.opacity;
            return this;
        }


	
/*--------------------------------------------------ADJUST--------------------------------------------------*/	
	// set habmurger icon
adjust(w) {
	let media = window.matchMedia(`(max-width: 731px)`); // 600
	let media2 = window.matchMedia(`(max-device-width: 415px)`);

	if (media.matches || media2.matches) {
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

		btn.style.color = this.hamburgerColour ?? "#3498db";
		btn.style.fontSize = media2.matches ? "2.2em" : "2em";
		btn.appendChild(node);
		 btn.style.marginLeft = "auto";
		
	
		return btn;
	}

	
	const adjustFontSize = () => {
	//	alert("NOT USED IN VIEWPORT")
		for (var i = 0; i < this.res.children.length; i++) {
			let el = this.res.children[i];
			 el.style.fontSize = media2.matches ? "1.2em" : "1em";

            
              var isSpacer = el.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer");
            
            // console.error("---------ERROR---------");
          
            
            if (el.style.getPropertyValue("flex-grow") == 1){
              // alert("A")
                
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
		if (this.res.children.length == this.itemCount) {
			this.res.insertBefore(btn, this.res.firstChild);
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
	 
if (typeof window !== "undefined") window.NavBar = NavBar;
export { NavBar };
