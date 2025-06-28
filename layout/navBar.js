import {Animator} from "./animator.js";

class NavBar {
	constructor(els){
		this.ele = null;
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
		//el.style.width = "100%";
		//-------------DEFAULT STYLING----------
		el.style.margin = 0;
		el.style.paddingTop = "1em";
		el.style.paddingBottom = "1em";
		this.ele = el;
		// EVIL LINE
		// window.addEventListener("resize", this.adjust.bind(this));
		
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
                        this.ele.style.marginTop = paddingObject['top'];
                    }
                    if (paddingObject.hasOwnProperty('right')) {
						//alert("P")
                        this.ele.style.marginRight = paddingObject['right'];
                    }
                    if (paddingObject.hasOwnProperty('bottom')) {
                        this.ele.style.marginBottom = paddingObject['bottom'];
                    }
                    if (paddingObject.hasOwnProperty('left')) {
                        this.ele.style.marginLeft = paddingObject['left'];
                    }
				}



                }
            }
        }

		return this;
    }
    
	radius(rad){
		this.ele.style.borderRadius = rad;
		return this;
	}
    
    
    
    items(items){
        
        
        
     /* var itemsa = items.filter(item => item.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer") === false);
        
        this.itemCount = itemsa.length;
        */
       
        
        
          this.itemCount = items.length;
        
        
        for (var i = 0; i < items.length; i++){
            
        var item = items[i];
        var isSpacer = item.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer");
            
            
            
           
                 this.ele.appendChild(item.render());
            
            
       
		}
        
        
        
        
        
        
		
		this.adjust();
          
        
        
        
    }
	
	
	/*items(items){
		this.itemCount = items.length;
		for (var i = 0; i < items.length; i++){
        this.ele.appendChild(items[i].render());
		}
		
		this.adjust();
		return this;
	}*/
	
	
	
	sticky(){
		this.ele.style.position = "fixed";
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
    
    
        background(obj){
            this.ele.style.backgroundColor = obj.color;
              this.ele.style.opacity = obj.opacity;
            return this;
        }
    
    transluescent(){
        this.ele.style.backgroundColor = "rgba(255,255,255,0.72)";
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
	let media = window.matchMedia(`(max-width: 731px)`); // 600
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

		// alert(this.hamburgerColour);
		btn.style.color = this.hamburgerColour ?? "#3498db";
		// btn.style.backgroundColor = "#fff"; nostalgia covid
		btn.style.fontSize = media2.matches ? "2.2em" : "2em";
		btn.appendChild(node);
		 btn.style.marginLeft = "auto";
		
	
		return btn;
	}

	
	const adjustFontSize = () => {
	//	alert("NOT USED IN VIEWPORT")
		for (var i = 0; i < this.ele.children.length; i++) {
			let el = this.ele.children[i];
			 el.style.fontSize = media2.matches ? "1.2em" : "1em";
			// el.style.fontSize = media2.matches ? "2.4em" : "1em";

            
              var isSpacer = el.__proto__
            .constructor
            .toString()
            .startsWith("class Spacer");
            
            // console.error("---------ERROR---------");
             console.warn(el.style.flexGrow == "1");
            console.log(el.style.getPropertyValue("flex-grow"));
            console.log(el.style.getPropertyValue("flex-grow") == 1);
            console.warn(isSpacer);
          
            
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
		for (var i = 0; i < this.ele.children.length; i++) {
			
			let child = this.ele.children[i];
			
			child.style.marginTop = "0em";
			child.style.display = "block";
			
			if (child.textContent === this.titleText && this.titleText.length > 0) {
                alert(child.textContent)
				child.style.fontSize = "2em";
			}
			
		if (this.ele.childNodes[i].textContent == "☰") {
			this.ele.removeChild(this.ele.childNodes[i]);
		}
		
		}

	
		this.ele.style.flexDirection = "row";
	}
	


	var added = false;
	
	const doInAdjust = () => {
		adjustFontSize();
		var closed = false;
		var btn = addHamburger();
		
		 /*(((this.ele.children.length == this.itemCount + 1)||*/
		if (this.ele.children.length == this.itemCount) {
			this.ele.insertBefore(btn, this.ele.firstChild);
		console.log("ADDA");
		}

		this.ele.style.flexDirection = "column";
		for (var i = 0; i < this.ele.children.length; i++) {
			if (this.ele.children[i].textContent == "☰" || this.ele.children[i].textContent == /*"Lands"*/ this.keepItem){
				this.ele.children[i].style.display = "block";
			} else {
				this.ele.children[i].style.display = "none";
			}
		}

		btn.addEventListener("click", () => {
			// alert
			closed = !closed;

			for (var i = 0; i < this.ele.children.length; i++) {
				if (i != 0 && this.ele.children[i].textContent != /*"Lands"*/ this.keepItem) {

					if (!closed) {
						this.ele.children[i].style.display = "none";
						this.ele.children[i].style.marginTop = "0em";
					} else {
                        
                        
                        if (this.ele.children[i].getAttribute("class") === "innerHider"){
                            // alert("WOW");
                               this.ele.children[i].style.display = "none";
                        } else {
                            this.ele.children[i].style.display = "block";
							this.ele.children[i].style.marginTop = "3em";
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
			document.querySelector(div).appendChild(this.ele);
		} else {
			return this.ele;
		}
			return this.ele;
	}
}
	 
window.NavBar
Spacer
Spacer
Spacer = NavBar
Spacer
Spacer
Spacer;
export { NavBar
Spacer
Spacer
Spacer };
