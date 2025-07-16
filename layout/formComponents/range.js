import {Animator} from "../animator.js";

class Range {
    constructor(obj) {
        this.el = null;
        this.minLabel = null;
        this.maxLabel = null;
        this.currentLabel = null;
       // this.setup(obj);
    }

    padding(val) {
        this.el.style.padding = val;
        return this;
    }

    toCode() {
        const objString = JSON.stringify(this.options, null, 4);
        return [`new Range().set(${objString})`];
    }

    set(obj) {
        this.options = obj;
        // Create slider input
        let slider = document.createElement("input");
        slider.setAttribute("id", "slider");
        slider.setAttribute("type", "range");
        slider.setAttribute("min", obj.min);
        slider.setAttribute("max", obj.max);
        slider.setAttribute("value", obj.min);

        slider.style.width = obj.width ?? "100%";
        
       
            

        if (!obj.plain){
            // Default slider styling
            slider.style.setProperty("-webkit-appearance", "none");
            slider.style.appearance = "none";
            slider.style.height = "9px";
            slider.style.background =  obj.style.trackColor ?? "orange";
            slider.style.borderRadius = "5px";
          
        

        // Create and append thumb styles
        const thumbCSS = `
            #slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 25px;
                height: 25px;
                border-radius: 50%;
                background: ${obj.style.thumbColor ?? "4CAF50"};
                cursor: pointer;
            }
        `;
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(thumbCSS));
        document.head.appendChild(style);
        }

        // Create labels
        let wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.alignItems = "center";
        wrapper.style.width = "100%";

        let labelWrapper = document.createElement("div");
        labelWrapper.style.display = "flex";
        labelWrapper.style.justifyContent = "space-between";
       // labelWrapper.style.width = "100%";
       labelWrapper.style.width = obj.width ?? "100%";

        this.minLabel = document.createElement("span");
        this.minLabel.textContent = obj.min;

        this.maxLabel = document.createElement("span");
        this.maxLabel.textContent = obj.max;

        this.currentLabel = document.createElement("span");
        this.currentLabel.textContent = slider.value;

        obj.font && (this.currentLabel.style.fontFamily = obj.font);
        obj.font && (this.minLabel.style.fontFamily = obj.font);
        obj.font && (this.maxLabel.style.fontFamily = obj.font);

        if (!obj.plain){
            labelWrapper.appendChild(this.minLabel);
            labelWrapper.appendChild(this.currentLabel);
            labelWrapper.appendChild(this.maxLabel);
        }

        // Update current label on slider input
        slider.addEventListener("input", () => {
            this.currentLabel.textContent = slider.value;
        });

        // Mobile-specific styles
        let query = window.matchMedia("(max-device-width: 415px)");
        if (query.matches) {
            if (!obj.plain){
            slider.style.height = "20px";
            slider.style.background = obj.style.trackColor ?? "1abc9C";
            slider.style.borderRadius = "10px";
            slider.style.fontSize = "3rem";
            slider.style.width = "80%";

            const mobileThumbCSS = `
                #slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 25px;
                    height: 25px;
                    border-radius: 50%;
                    background: ${obj.style.thumbColor ?? "blue"};
                    cursor: pointer;
                }
            `;
            
            const mobileStyle = document.createElement('style');
            mobileStyle.appendChild(document.createTextNode(mobileThumbCSS));
            document.head.appendChild(mobileStyle);
            } else {
                slider.style.width = "80%";
            }
        }

        wrapper.appendChild(labelWrapper);
        wrapper.appendChild(slider);

        this.el = wrapper;
        return this;
    }

    value() {
        return this.el.querySelector("#slider").value;
    }

    render(div) {
        if (div) {
            document.querySelector(div).appendChild(this.el);
        } else {
            return this.el;
        }
    }
}







window.Range = Range;
export { Range };
