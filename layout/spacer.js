import {Animator} from "./animator.js";

class Spacer { 
	constructor( hide) {
        
        
        
        
		this.hide = hide;
        
        if (hide){
            
      
    var card = document.createElement("div");
    card.style.flex = "1";
    this.res = card;
        }
        
        
         if (hide){
            this.res.setAttribute("class", "innerHider");
        }
        
	return this;
        
        
    }

	toCode(){
		return [`new Spacer(${this.hide})`];
	}
	
	render(){
		
        var one = document.createElement("h2");
        one.style.display = "none !important";
	
	return this.res ?? one;
	
			
			}
}

export { Spacer };
