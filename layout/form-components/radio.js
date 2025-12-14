import {Animator} from "../animator.js";

class RadioGroup /*extends Animator*/ {
     constructor(){
       // super();
        this.el = null;
        this.radioCount = 0;
       // this.setup();
    }
    
    set(objects){
        
        this.options = objects;
        console.log("ORARA");
        console.log(this.options);
      
        
        this.radioCount = objects.items.length;
        
        let wrap = document.createElement("div");
	
        
        let obj = objects.items;
        
        for (var i = 0; i < obj.length; i++){
        
        
        let label = document.createElement("label"); 

        if (obj.font){
            label.style.font = obj.font;
        }

        if (obj.color){
            label.style.color = obj.color;
        }

        if (obj.exact){
            label.style.fontSize = obj.exact;
        }




        let node = document.createTextNode(obj[i]);
        label.appendChild(node);
        label.setAttribute("for", obj[i]); 
        
		let card = document.createElement("input");      
        card.setAttribute("type", "radio");
        card.setAttribute("id", `S${i}`);
        card.setAttribute("value", obj[i].split(" ").join(""));   

        card.style.appearance = 'none';
        card.style.width = '20px';
        card.style.height = '20px';
        card.style.border = this.options.tint ? `2px solid ${this.options.tint}` : '2px solid #007BFF';
        card.style.borderRadius = '50%';
        card.style.outline = 'none';
        card.style.cursor = 'pointer';
        card.style.transition = '0.3s';

    //    card.addEventListener('change', () => {
       //     alert("change");
          /*  if (card.checked) {
                card.style.backgroundColor = '#007BFF';
                card.style.boxShadow = '0 0 0 2px #0056b3 inset';
            } else {
                card.style.backgroundColor = 'transparent';
                card.style.boxShadow = 'none';
            }*/
      //  });
            
        this.options.font && (label.style.fontFamily = this.options.font);
            
           if (objects.multiple){
                card.setAttribute("name", obj[i].split(" ").join(""));   
            } else {
                card.setAttribute("name", objects.name);
              //  card.setAttribute("name", "same");
            } 
            
            
       /* card.addEventListener("change", () => {
            let picked = card.options[card.selectedIndex].value;
            console.log(picked);
        });*/
            
            
             wrap.appendChild(card);
             wrap.appendChild(label);
             wrap.innerHTML += "</br>";
        
        }
        
        this.el = wrap;
        
        this.responsive();
        return this;
    } 

    
    
     padding(val){
        this.el.style.padding = val;
        return this;
    }
    
    getCheckedValues(){
        console.log("NOW");
        
        var values = [];
        
        for (var i = 0; i < this.radioCount; i++){
            
           
            if (document.querySelector(`#S${i}`).checked) {
            let value = document.querySelector(`#S${i}`);
            console.log("VALUE IS " + value.value);    
            values.push(value.value);
                }
        }
        
        
        
        return values;
    }

    toCode() {
        /*let objString = JSON.stringify(
            this.options,
            (key, value) => (typeof key === "string" && key !== "" ? value : value),
            4
        );*/

        // 155735 preventing problem, no removal 
        let objString = JSON.stringify(this.options, null, 4);
        objString = objString.replace(/"(\w+)"(?=\s*:)/g, '$1');
        return [`new RadioGroup().set(${objString})`];
    }
    
    
    
    responsive(){
            let query = window.matchMedia("(max-device-width: 415px)");
           
            // window.matchMedia(query)
            if (query.matches){
                this.el.style.fontSize = "1.7em";
            }
            
            return this;
        }
    
    
    
     render(div){
		if (div){
			document.querySelector(div).appendChild(this.el);


          
           
		} else {




            console.log("MULA");
        //    console.log(this.el.children[0]);

      

        for (var i = 0; i < this.el.children.length; i++){

            let card =  this.el.children[i];
           // console.log(card.toString());

          


           if (card.toString() === "[object HTMLInputElement]") {
            card.addEventListener('change', () => {
                if (card.checked) {
                    card.style.backgroundColor = this.options.tint ? this.options.tint : '#007BFF';
                    card.style.boxShadow = this.options.tint ?`0 0 0 2px ${this.options.tint} inset` : '0 0 0 2px #0056b3 inset';
        
                    // Reset styles for other radio buttons in the group
                    for (let j = 0; j < this.el.children.length; j++) {
                        const sibling = this.el.children[j];
                      //  alert(this.options.multiple);
                        // Check if the sibling is an input element
                        if (sibling.tagName === 'INPUT' && sibling.type === 'radio') {
                            // Avoid resetting the current radio button
                            if (this.options.multiple === false && sibling !== card) {
                                sibling.style.backgroundColor = 'transparent';
                                sibling.style.boxShadow = 'none';
                            }
                        }
                    }
                } else {
                    card.style.backgroundColor = 'transparent';
                    card.style.boxShadow = 'none';
                }
            });
        }
        
      

        }

  
         




            
			return this.el;
		}	

	}
}






window.RadioGroup = RadioGroup;
export { RadioGroup };
