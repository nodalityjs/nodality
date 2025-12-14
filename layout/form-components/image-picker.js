import {Animator} from "../animator.js";

class FilePickera extends Animator {
    constructor(){
        super();
        this.el = null;
        this.file = null;
    }
    
    set(obj){
        this.options = obj;
        this.okayColor = obj.okayColor;
        
        let query = window.matchMedia("(max-device-width: 415px)");
        
        let wrap = document.createElement("div"); 
        wrap.style.paddingBottom = "1em";
        wrap.style.display = "flex";        
        
        let allWrap = document.createElement("div");
        
        let nameField = document.createElement("input");
        nameField.setAttribute("type", "text");
        nameField.style.display = "none";
        nameField.style.margin = "0.5em";
        
		let card = document.createElement("input");
	    card.setAttribute("type", "file");
        card.setAttribute("name", obj.name);
        obj.accept && (card.accept = obj.accept);
        card.setAttribute("id", obj.id);
        card.style.visibility = "hidden";
        card.style.display = "none";
        
        
        let queryB = window.matchMedia("(max-device-width: 415px)");
			if (queryB.matches) {
				card.style.fontSize = '1rem';
			}
        
        let label = document.createElement("label");
	    label.setAttribute("for", obj.id);
        label.innerText = obj.title;
        label.style.marginRight = 12;
        label.style.padding = "0.5em";
        
        if (obj.color){
              label.style.color = obj.color;
        }
    
         if (obj.background){
            label.style.background = obj.background;
            label.style.padding = "10";
        }    

        
         card.addEventListener("change", () => {
          
             
             
             
                   nameField.style.display = "block";
             
             
             if (obj.hideField){
                  nameField.style.display = "none";
             }
             
             
             label.innerText = "Change";
             this.file = card.files[0];
             this.onLoad(this.file);
            // this.loadCall(this.func);
            // this.getLoaded(this.file);
             data[obj.index] = this.file;
             
             nameField.setAttribute("value", this.file.name);
             nameField.setAttribute("readonly", "true");
             
             
             
             
             
             this.getLoaded();
             this.highlight();
            // obj.cb(data);
            // console.log(this.file);
            
        })
        
        wrap.appendChild(card);
        wrap.appendChild(label);
        wrap.appendChild(nameField);
        
		this.el = wrap;	
        
        
      //  this.auto();

      obj.font && this.font(obj.font);
      obj.radius && this.borderRadius(obj.radius);
		return this;	
    }
    

    borderRadius(radius){
        this.el.style.borderRadius = radius;
       // console.warn(this.res);
        return this;
    }
	
    // 5:00 (2 min) 4km 3:35 (2 min) 3km (3:25) 2km (3:15), 1km ke (03:00)
   
    
    addClass(classa){
        this.el.setAttribute("class", classa);
        return this;
    }
    
    
    font(font){
        this.el.style.fontFamily = font;
        return this;
    }
    
    bold(){
        
        
        this.el.style.fontWeight = "bold";
        return this;
    }
    
    
    rounded(){
       // this.el.style.borderRadius = `${padding}px`;
         this.el.children[1].style.borderRadius = `8px`;
        return this;
    }
    
    
    
    highlight(){
        if (this.file === null){
            this.hasFile = false;
            this.el.children[1].style.background = "red";
                      //  alert("A");
                    } else {
                        this.hasFile = true;
                        
                        if (this.okayColor){
                            this.el.children[1].style.background = this.okayColor;
                        } else {
                            this.el.children[1].style.background = "#1abc9c";
                        }
                         
                    }
        
        
        return this;
    }
    
    
    
    
    
     auto() {
		const adj = () => {
			let query = window.matchMedia("(max-device-width: 415px)");
			if (query.matches) {
			//	this.el.style.fontSize = '3rem';
			} else {
			//	this.el.style.fontSize = '1rem';
			}
		}

		adj();
		window.addEventListener("resize", adj);
		return this;
	}
    
    onLoad(file){
        
      //  console.log(this.file);
        this.returnObject(this.file);
        return this;
    }
    
    
    
    
    
    getLoaded(){
    return this.file;    
    }
    
    returnObject(file){
      //  console.log("NOW");
        return file;
    }
    
    loadCall(func){
        this.func = func;
        this.func(this.file);
        return this;
    }

    toCode() {
        let objString = JSON.stringify(this.options, null, 4);
        objString = objString.replace(/"(\w+)"(?=\s*:)/g, '$1');
        return [`new FilePickera().set(${objString})`];
    }
    
    render(div){
		if (div){
			document.querySelector(div).appendChild(this.el);
            return this;
		} else {
			return this.el;
		}	
	}
}




var data = []; // Has to be called data!
/*
new FilePickera()
.setup({
    index: 0,
    id: "A",
    title: "Select picture A"
}).render("#res");*/

 /*new FilePicker()
.setup({
    index: 1,
    id: "B",
    title: "Select picture B"
}).render("#res");

*/



/*
class Appa extends Base {
    constructor(){
        super();
    }
    
    render(){
        return new Text("Q")
    }
}*/


// new Appa().mount("#res");






export { FilePickera
 };
