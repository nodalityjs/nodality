/*!
 * nodality v1.1.11
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

 

class ZoomCard extends Animator {
    constructor() {
       super();
    }

    set(obj){
        this.imageUrl = obj.url;
        let stra = "";
        this.createCard();

        obj.useBrightness && (this.useBrightness = true);
        obj.useBrightness && (stra += `\n useBrightness: ${this.useBrightness}`);
        

     
       obj.pad && this.pad(obj.pad);
       obj.mar && this.mar(obj.mar);


        obj.inpad && this.inpad(obj.inpad);
        obj.inpad && (stra += `\n inpad: {${obj.inpad}}`);

        obj.font && (this.res.style.fontFamily = obj.font);
        obj.inpad && (stra += `\n font: ${obj.font}`);

       this.addListeners();
       

        return this;
    }

    inpad(pad){
        this.res.children[1].style.boxSizing = "border-box";
        this.res.children[1].style.padding = pad;
        return this;
    }

    items(arr){
        for (var i = 0; i < arr.length; i++){
            this.res.children[1].appendChild(arr[i].render());
        }

        return this;
    }

    createCard() {
        // Create a new div element for the card
      

        let stack = document.createElement("div");
        stack.style.display = "grid";
        stack.style.width = "300px";
        stack.style.height = "400px";
        stack.setAttribute("id", "AAA");

        let card = document.createElement('div');

        card.style.gridArea = "1/1";

        // Set the CSS properties of the card
        card.style.height = '400px';
        card.style.borderRadius = '15px';
        card.style.boxShadow = '0 4px 8px 0 rgba(0,0,0,0.2)';
        card.style.overflow = "hidden";

        let img = document.createElement("div");
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.transition = '0.9s';
        img.style.backgroundImage = `url(${this.imageUrl})`;
        img.style.backgroundSize = "cover";
        img.style.backgroundPostion = "cover";
        img.style.backgroundRepeat = 'no-repeat';

       
        card.appendChild(img);
        // Add a hover effect to make the background size larger
       


        let div = document.createElement("div");

       // div.appendChild(new Text("Hello").set({ fluidc: "S3", color: "green" }).render());
        div.style.gridArea = "1/1";
        div.style.zIndex = "1";


        stack.appendChild(card);
        stack.appendChild(div);

        this.res = stack;

        // Return the created card
        return this;
    }

    addListeners(){
        let img = this.res.children[0].children[0];
     //   console.log("FIGHT");
     //   console.log(img);
       

        this.res.onmouseover =  () => {
          
            img.style.transform = 'scale(1.3)';
            this.useBrightness && (img.style.filter = "brightness(31%)");
        };
        this.res.onmouseout =  () => {
            img.style.transform = 'scale(1.0)';        
            this.useBrightness && (img.style.filter = "brightness(100%)");
        };

        return this;
    }


	render(div) {

		/*console.log("FINAL CSS");
	*/

		


		
		
		if (div) {
			if (this.options.id){

				this.res.setAttribute("id", this.options.id);

			}
			document.querySelector(div).appendChild(this.res);
		} else {

			return this.res;
		}
	}
}


export { ZoomCard };
