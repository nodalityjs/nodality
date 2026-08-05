/*!
 * nodality v1.0.218
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

class Spacer { 
	constructor( hide) {
        
        
        
        
        
            
      
    var card = document.createElement("div");
    card.style.flex = "1";
    this.res = card;
      //  }
        
        
            this.res.setAttribute("class", "innerHider");
      //  }
        
	return this;
        
        
    }

	toCode(){
		return [`new Spacer(${this.hide})`];
	}
	
	render(){
		
	
	return this.res //this.res ?? one;
	
			
			}
}

export { Spacer };
