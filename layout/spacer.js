/*!
 * nodality v1.0.223
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class Spacer extends Animator { 
	constructor( hide) {
		super();
		// Converted from a standalone class. Opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour; opt in per component.
		this._noTheme = true;
        
        
        
        
        
            
      
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
