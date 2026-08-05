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
