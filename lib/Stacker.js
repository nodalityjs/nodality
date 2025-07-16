

class Stacker {
    constructor(){
        this.res = document.createElement("div");
        this.res.style.display = "flex";
        this.res.style.flexDirection = "column";
    }

    add(items){
        for (var i = 0; i < items.length; i++){
            let item = items[i].render();
           
            if (i === 0){ // if KeyframeAnima and then transformAnim apply this condition
                // Keep this in stacker for now
               item.style.zIndex = 1; // important
            }
          
            this.res.appendChild(item);
        }

        return this;
    }

    render(div){
        if (div){
            document.querySelector(div).appendChild(this.res);
        } else {
            return this.res;
        }
      //  document.body.appendChild(this.res);
    }
}


export {Stacker};