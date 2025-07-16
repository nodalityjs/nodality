import {Animator} from "./animator.js";

class Stack {
    constructor(st){
       this.res = null;

     this.st = st;
    }
    
    setup(){
        let grid = document.createElement("div");
        grid.style.display = "grid";
        this.res = grid;

        if (this.st){
            this.sticky();
           }


        return this;
    }
    
    set(obj){
        this.setup();
        obj.height && (this.res.style.height = obj.height);
        obj.sticky && this.sticky();
        return this;
    }

    sticky(){
        this.res.style.position = "sticky";
        this.res.style.top = 0;
        return this;
    }

    add(els){
        this.children = els;
        for (var i = 0; i < els.length; i++){
            let el = els[i].render();
            el.style.gridColumn = 1;
            el.style.gridRow = 1;
            this.res.appendChild(el);
        }
        
        
        return this;
    }   

    toCode() {
        // Initialize the code string with the Stack setup
        let code = `new Stack().set({})`;
        
        // Add child elements
        if (this.children.length > 0) {
            const childrenCode = this.children.map(child => child.toCode()).join(",\n");
            code += `.add([\n \n ${childrenCode} \n \n])`;
        }
        
        // Return the final code
        return [code];
    }
   
render(el) {
    if (el) {
        document.querySelector("body").style.margin = 0;
        document.querySelector("body").style.padding = 0;
        document.querySelector(el).appendChild(this.res);
    } else {
        return this.res;
    }
}
}



export { Stack };
