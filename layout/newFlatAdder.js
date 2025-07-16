import {Animator} from "./animator.js";


class NewFlatAdder {
    constructor(){
        this.res = null;
        this.setup();
    }

    setup(){
        this.res = document.createElement("div");
        return this;
    }

    items(arr){
        for (var i = 0; i < arr.length; i++){
            console.log(arr[i].render().render());
            this.res.appendChild(arr[i].render().render());
        }

        return this;
    }

    flatItems(arr){
        for (var i = 0; i < arr.length; i++){
            
            this.res.appendChild(arr[i].render());
        }

        return this;
    }

    render(el){
		if (el){
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
} 
export { NewFlatAdder };
