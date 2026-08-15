/*!
 * nodality v1.1.8
 * (c) 2026 Filip Vabrousek
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
		card.style.overflow = "hidden"
		this.res = card;	
		return this;	
	}



	set(obj){
		let stra = "";
		this.obj = obj;

		obj.onTap && this.onTap(obj.onTap);

		obj.background && (this.res.style.background = obj.background);

		if (obj.border){
			this.res.style.border = obj.border;
		}

		if (obj.radius){
			this.res.style.borderRadius = obj.radius;
		}

		


		obj.width && (this.res.style.width = obj.width);

this.options = obj;
		this.callReact(obj);

		this.commonMethods(obj);
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


      this.chainReact(arr, this.options.id, keep);

    }
  }
 //22155 snap to change phone screen
 


	frame(obj){

		if (obj.height){
		this.res.style.height = obj.height;
		}

		if (obj.width){
			this.res.style.width = obj.width;
			}

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
	/**
	 * Corner radius. A number is pixels; a string is passed through, so
	 * `radius("50%")` and `radius(12)` both work.
	 */



	
	render(div){
		if (div){
			document.querySelector(div).appendChild(this.res);
		} else {
			return this.res;
		}	
	}
}
export { Card };
