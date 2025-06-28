import {Animator} from "./animator.js";

class Base { 
	constructor(items){
		this.items = items ?? [];
		Base.prototype.items = items;
		this.oldLength = 0;
	}
	
	set itemso(itemsa) {
		 this.items = itemsa;// (itemsa);
		Base.prototype.items = itemsa;
	}
	
	
	Proxima(a) {
		var me = this;
		return new Proxy(a, {
			get(target, property, receiver) { // GETTER FIRES THIS BEFORE WE GET DATA USING (this.items.push())
				/*
				me.itemso = a[property].map(t => String(t));
				return a[property];*/

				return a[property];
			},
			set(T, P, V, R) {
				 console.warn("PUSHED REACTIVELY :D");
				me.itemso = a[P].map(t => String(t));
				return a[P];
			},
			has(t, p) {
				return Reflect.has(t, p);
			}
		});
	}

	observe(obj) {
		return this.Proxima(obj);
	}
	
	
	adjustState(newData){
		if (newData.data.length > this.oldLength){
			let node = document.querySelector(this.el);
			
			while (node.firstChild){
				node.removeChild(node.lastChild);
			}
			
			this.render(this.el).render(this.el);	 // rendra ===> build
			this.oldLength = newData.data.length;
		}
	}
	
	
	
	
	 toNode(htmlString) {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();

  // Change this to div.childNodes to support multiple top-level nodes
  return div.firstChild; 
}
	
	reactState(){
		
		/*let nodess = document.querySelector(this.el);
			
			while (nodess.firstChild){
				nodess.removeChild(nodess.lastChild);
			}*/
		
		
		let node = document.querySelector("#res");
		alert(this.render());
		
		
		let nodes = this.toNode(this.toHTML());
		node.appendChild(nodes);
	}
	
	mount(el){
		this.el = el;
		this.render(el).render(el); // // this.render === function inside component
	}
	
	toHTML(el){
		return this.render(el).render(el).innerHTML; // // rendra ===> build
	}
}
export { Base };
