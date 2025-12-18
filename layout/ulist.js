import {Animator} from "./animator.js";

class UList extends Animator {
    constructor() {
        super();
        this.res = null;
        this.items = []; // unified storage
        this.setup();
    }

    set(obj) {
        this.options = obj;
        obj.pad && this.pad(obj.pad);
        obj.mar && this.mar(obj.mar);
       
        // CRITICAL
		// obj.transform && this.reactOnTransform(obj.transform); // remove obj.op.duration
		this.commonMethods(obj);
        this.callReact(obj);
        return this;
    }


	callReact(obj){

		let arr = [];

		if (obj.stroke || obj.gradient || obj.span || obj.backgroundOp || obj.layout || obj.shadow || obj.animation || obj.filtera || obj.transform){
			if (obj.gradient){
				this.globalGradient = obj.gradient.op.gradient;
				if (obj.gradient.op.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}
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

			this.chainReact(arr, this.options.id, keep);
		}
	}









    setup() {
        let el = document.createElement("ul");
        this.res = el;
        this.res.style.padding = 0;
        this.res.style.margin = 0;
        return this;
    }

    // unified method: accepts strings or components
    setItems(itemsArray) {
        this.items = itemsArray;

        for (let item of itemsArray) {
            if (typeof item === "string") {
                let li = document.createElement("li");
                li.textContent = item;
                this.res.appendChild(li);
            } else {
                let rendered = item.render();
                this.res.appendChild(rendered);
            }
        }
        return this;
    }

    font(font) {
        this.res.style.fontFamily = font;
        return this;
    }

    size(s) {
        this.res.style.fontSize = s;
        return this;
    }

    em(e) {
        this.res.style.fontSize = `${e}em`;
        return this;
    }

    color(color) {
        this.res.style.color = color;
        return this;
    }

    align(direction) {
        this.res.style.textAlign = `${direction}`;
        return this;
    }

    weight(weight) {
        this.res.style.fontWeight = weight;
        return this;
    }

    bold() {
        this.res.style.fontWeight = "bold";
        return this;
    }

    italic() {
        this.res.style.fontStyle = "italic";
        return this;
    }

    margin(val) {
        this.res.style.margin = val;
        return this;
    }

    border(w, color) {
        this.res.style.border = `${w}px solid ${color}`;
        return this;
    }

    padding(T, L, R, B) {
        this.res.style.paddingTop = T;
        this.res.style.paddingLeft = L;
        this.res.style.paddingRight = R;
        this.res.style.paddingBottom = B;
        return this;
    }

    headline() {
        this.em(4);
        this.font("Arial");
        this.bold();
        return this;
    }

    caption() {
        this.bold();
        this.res.style.fontFamily = "Arial";
        this.res.style.color = "#3498db";
        return this;
    }

	
toCode(indent = 0) {
        this.code = [];

        if (this.excludeFromCodeTrue) {
            return [""];
        }

        const pad = " ".repeat(indent);
        let code = `${pad}new UList()`;

        if (this.items && this.items.length) {
            code += `\n${pad}  .setItems([\n` +
                this.items.map(c =>
                    typeof c === "string"
                        ? `${" ".repeat(indent + 4)}"${c}"`
                        : c.toCode(indent + 4)
                ).join(",\n") +
                `\n${pad}  ])`;
        }

        code += `\n${pad}`;
        return [code];
    }

    render(div) {
        if (div) {
            document.querySelector(div).appendChild(this.res);
        } else {
            return this.res;
        }
    }
}

export { UList };
