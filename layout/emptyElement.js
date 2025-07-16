import {Animator} from "./animator.js";

class Empty {
    constructor() {
        this.res = document.createElement("null");
    }

    toCode(){
        return "";
    }

    render(div) {
        if (div) {
            document.querySelector(div).appendChild(this.res);
        } else {

            return this.res;
        }
    } 
} // 183934
export { Empty };
