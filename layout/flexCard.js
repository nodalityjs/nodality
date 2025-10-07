/*!
 * nodality v1.0.52
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

class Card extends Animator {
	constructor(text, url) {
        super();
		this.text = text;
		this.url = url;
		this.setup();
	}

	getType(){
		return "LayoutWrapperElement";
	}

	setup() {
		let query = window.matchMedia("(max-device-width: 415px)");
		let card = document.createElement("div");
		card.style.display = "flex";
		card.style.flexDirection = "column";
		card.style.alignItems = "center";
		card.style.backgroundColor = "#fff";
		card.style.fontFamily = "Arial";
		card.style.width = "100%";
		// card.style.boxShadow = "3px 3px 10px #111";
		card.style.overflow = "hidden"
		this.res = card;	
		return this;	
	}

	set(obj){
		let stra = "";
		this.obj = obj;

		obj.background && (this.res.style.background = obj.background);

		if (obj.border){
			this.res.style.border = obj.border;
		}

		if (obj.radius){
			this.res.style.borderRadius = obj.radius;
		}

		if (obj.arrayPadding){
			let sides = obj.arrayPadding.sides;
			//console.log(sides);
			//console.log(sides.map(x => `"${x}"`).join(", "));

			const mapped = sides.map(x => `"${x}"`).join(", ")
	
		

		obj.arrayPadding && this.arrayPadding(obj.arrayPadding.sides, obj.arrayPadding.value);
		//obj.arrayPadding && this.arrayPadding(obj.arrayMargin.sides, obj.arrayMargin.value);
		obj.arrayPadding && (stra += `\n arrayPadding: {sides: [${mapped}], value: "${obj.arrayPadding.value}"},`); // 2345 06/03
		
	
	}
		
		obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
		//obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);
		obj.arrayMargin && (stra += `\n arrayMargin: {sides: [${obj.arrayMargin.sides.map(side => `"${side}", `)}], value: "${obj.arrayMargin.value}"},`); // 2345 06/03


		obj.width && (this.res.style.width = obj.width);

this.options = obj;
		this.callReact(obj);
		return this;
	}


  callReact(obj) {
    let arr = [];

    if (
      obj.stroke || obj.gradient || obj.span || obj.backgroundOp ||
      obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform
    ) {
      if (obj.gradient) {
        this.globalGradient = obj.gradient.op.gradient;
		if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}
      }

      if (obj.stroke) {
        super.setAny({ globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}` });
      }

      if (obj.span) {
        obj.span.prevText = this.text;
      }

      let ft = [
        obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp,
        obj.layout, obj.marginOp, obj.shadow, obj.animation, obj.filtera, obj.transform
      ];
      ft = ft.filter(el => el != undefined);

      for (let i = 0; i < ft.length; i++) {
        arr.push({
          range: ft[i].range,
          log: ft[i].op.name,
          target: ft[i].target,
          op: ft[i].op
        });
      }

      let keep = [];
      if (obj.borderObj) keep.push("border");
      if (obj.backgroundOp) keep.push("background");
      if (obj.mar) keep.push("margin");
      if (obj.animation) keep.push("animation");
      if (obj.span) keep.push("span");

      keep.push("border");

      console.log("ARA IS ", arr);

      this.chainReact(arr, this.options.id, keep);

        //  this.res.style.border = "1px solid green";
    }
  }

	arrayPadding(arr, value) {

		if (!value){ // LTRB
			this.res.style.marginLeft = `${arr[0]}px`;
			this.res.style.marginTop = `${arr[1]}px`;
			this.res.style.marginRight = `${arr[2]}px`;
			this.res.style.marginBottom = `${arr[3]}px`;
		}

		if (arr[0] === "all"){
			this.res.style.paddingLeft = value;
			this.res.style.paddingTop = value;
			this.res.style.paddingRight = value;
			this.res.style.paddingBottom = value;
		}

		
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
		

		//alert(value);

		return this;
	} //22155 snap to change phone screen
 

	arrayMargin(arr, value) { // 224857 redefined earlier

		// console.log(arr);
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

		if (arr.includes("all")){
			this.res.style.margin = value;
		}

		if (!value){
			this.res.style.marginBottom = arr;
		}
		
		return this;
	}

	frame(obj){

		if (obj.height){
		this.res.style.height = obj.height;
		}

		if (obj.width){
			this.res.style.width = obj.width;
			}

			return this;
	}
    
    scale(obj){
        
        let previousWidth = this.res.style.width;
          
        this.res.style.transition= "0.5s all";
      //  alert(previousWidth);
        
        this.res.addEventListener("mouseover", () => {
            let previousWidth = this.res.style.width;
             this.res.style.transform = "scale(1.04)";
        });
        
         this.res.addEventListener("mouseout", () => {
            let previousWidth = this.res.style.width;
              this.res.style.transform = "scale(1.0)";
        });
        
        
        return this;
    }
	
	background(color){
		this.res.style.backgroundColor = color;
		return this;
	}
	
	color(color){
		this.res.style.color = color;
		return this;
	}
	
	padding(pad){
		this.res.style.padding = `${pad}px`;
		return this;
	}
	
	items(els){
		for (var i = 0; i < els.length; i++){
			this.res.appendChild(els[i].render());
		}
		
		return this;
	}
	
	shadow(){
	this.res.style.boxShadow = "1px 1px 20px rgba(0, 0, 0, 0.60)";
	return this;
	}
	
	round(value){
	this.res.style.borderRadius = `${value}px`;
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
export { Card };
