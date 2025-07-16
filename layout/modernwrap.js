import {Animator} from "./animator.js";




class ModernWrap {
    
    setup(options){
		let gr = document.createElement("div");
		gr.style.padding = 0;
		gr.style.margin = 0;
		this.res = gr;
        return this;
	}
    
    
	add(els){
		for (var i = 0; i < els.length; i++){
			this.res.appendChild(els[i].render().render());
            console.log("NIONOIBOIBIO")
		}
        return this;
	}
	
	
	
	/*width(w, shouldCenter){
		this.res.style.width = w;
		
		if (shouldCenter){
		this.res.style.marginLeft = "auto";
		this.res.style.marginRight = "auto";
		}
		return this;
	}*/
	
	padding(value){
		this.res.style.padding = `${value}px`;
		return this;
	}
	
	size(w, h){
		this.w = w;
		this.h = h;
		
		if (this.w){
			this.res.style.width = this.w;
		} else {
			this.res.style.width = window.innerWidth;
		}
		
	if (this.h){
			this.res.style.height = this.h;
		} else {
			this.res.style.height = window.innerHeight;
		}
		
		
		return this;
	}
	
	
	
	
	
	/*items(els){
		for (var i = 0; i < els.length; i++){
			this.res.appendChild(els[i].render().render());
		}
		return this;
	}*/
	
	
	
	border(color, width){
		this.res.style.border = `${width}px solid ${color}`;
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



export { ModernWrap };
