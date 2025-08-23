/*!
 * nodality v1.0.0-beta.93
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

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
      //  this.res.style.color = "white";
        this.res.style.borderRadius = "1rem";

        this.pre.appendChild(this.res);
      //  this.res.style.marginTop = "20rem";
       
    }


    getType(){
        return "LayoutWrapperElement"; // 222249
    }

    toCode(){
        let obj = this.options;
         // remove empty keys
    Object.keys(obj).forEach(k => obj[k] === undefined && delete obj[k]);

    // pretty JSON, but keep functions/nested objects readable
    const str = JSON.stringify(obj, null, 2)
        .replace(/"([^"]+)":/g, '$1:')   // remove quotes from keys
        .replace(/"([^"]+)"/g, (m, p1) => {
            // keep colors and class names quoted, but escape code safely
            if (p1.includes("\n") || p1.includes("'") || p1.includes('"')) {
                return "`" + p1.replace(/`/g, "\\`") + "`"; // wrap multiline in backticks
            }
            return `"${p1}"`;
        });

    return `new Code().set(${str})`;
    }


	callReact(obj){
        this.options = obj;

		let arr = [];

		if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform){
			if (obj.gradient){
				this.globalGradient = obj.gradient.op.gradient;
			}

		
			if (obj.stroke){
				super.setAny({globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}`});
			}

			if (obj.span){
				obj.span.prevText = this.text;
			}


			let ft = [obj.stroke, obj.gradient, obj.animation, obj.span, obj.backgroundOp, obj.layout, obj.marginOp, obj.shadow, /*obj.animation || obj.filtera*/obj.animation, obj.filtera, obj.transform];
			ft = ft.filter(el => el != undefined);

		

			for (var i = 0; i < ft.length; i++){
				arr.push({
					range: ft[i].range,
					log: ft[i].op.name,
					target: ft[i].target,
					op: ft[i].op
				});
			}

			let keep = [];

		if (obj.borderObj){
			keep.push("border");
		}

		if (obj.background){
			keep.push("background");
		}

		if (obj.mar){
			keep.push("margin");
		}

		if (obj.animation){
			keep.push("animation");
		}

		if (obj.span){
			keep.push("span");
		}

	/*	if (obj.transform){
			keep.push("transform");
		}*/

		// console.log("ARA IS " + arr);
		console.log("ARA IS ");
		console.log(arr);

			this.chainReact(arr, obj.id, keep);
		}
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

        this.callReact(obj);
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
