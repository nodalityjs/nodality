import {Animator} from "./animator.js";


class SimpleBar extends Animator {
    constructor(){
        super();
        this.res = document.createElement("div");
    }

    items(arr){
        for (var i = 0; i < arr.length; i++){
            this.res.appendChild(arr[i].render());
        }
        return this;
    }

    render(div){
        if (div){
            document.querySelector(div).appendChild(this.res);
        }
        return this.res;
    }
}

export { SimpleBar };
