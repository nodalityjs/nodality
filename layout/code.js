import {Animator} from "./animator.js";



class Code extends Animator {
    constructor(){
        super();
        this.res = document.createElement("code");
        this.pre = document.createElement("pre");
        this.res.style.background = "#18232e";
        this.res.style.display = "block";
        this.res.style.width = "auto";
        this.res.style.height = "auto";
        this.res.style.color = "white";
        this.res.style.borderRadius = "1rem";

        this.pre.appendChild(this.res);
      //  this.res.style.marginTop = "20rem";
       
    }


    set(obj){
        obj.code && (this.pre.children[0].innerHTML = obj.code);
        obj.class && this.pre.children[0].setAttribute("class", `${obj.class}`);
        obj.pad && this.pad(obj.pad);
        obj.mar && this.mar(obj.mar);
        obj.respad && this.respad(obj.respad);
		obj.resmar && this.resmar(obj.resmar);
        obj.resprop && this.resprop(obj.resprop);
        obj.width && (this.res.style.width = obj.width);
        obj.background && (this.res.style.background = obj.background);
        obj.color && (this.res.style.color = obj.color);
        obj.borderRadius && (this.res.style.background = obj.borderRadius);
        
        if (obj.borderObj){
			//alert(`${obj.borderObj.width}px solid ${obj.borderObj.color}`);
			this.res.style.border = `${obj.borderObj.width} solid ${obj.borderObj.color}`;
			this.res.style.borderRadius = `${obj.borderObj.radius}`;
			
			//this.res.style.border = `3px solid transparent`;
			//this.res.style.border = "10px solid yellow";

			//let rem = this.removeQuotesFromFirstWord(JSON.stringify(obj.borderObj));
			//stra += `\n borderObj: ${rem},`;
		}

        return this;
    }


    render(div){
        if (div){
            document.querySelector(div).appendChild(this.pre);
        }
        return this.res;
    }
}

export { Code };
