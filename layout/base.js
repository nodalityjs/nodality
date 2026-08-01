/*!
 * nodality v1.0.203
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";

class Base {
	constructor(/*items*/){
		//this.items = items ?? [];
		//Base.prototype.items = items;
		this.oldLength = 0;
	}
	
	
	/*set itemso(itemsa) {
		 this.items = itemsa;// (itemsa);
		Base.prototype.items = itemsa;
	}*/
	
	
	observe(obj) {
		this.initialState = obj//.data;
		return this.Proxima(obj);
	}
	
	Proxima(a) {
		var me = this;
		return new Proxy(a, {
			// Proxy set traps are (target, prop, value, receiver). The old
			// signature named the third parameter `key`, so `target[key] = value`
			// stored the incoming VALUE under the receiver as a property name and
			// the real property was never written — every reactive-state write
			// silently corrupted the object.
			set(target, prop, value) {
				target[prop] = value;

				if (me.initialState && me.initialState.data &&
					typeof me.initialState.data.push === "function") {
					me.initialState.data.push(prop);
				}

				 if (prop !== 'length') {
					 me.refreshUI("Added");
				 }
				return true;//a[P];
			},
			has(target, prop) {
				
				if (prop !== 'length') {
					 me.refreshUI("Deleted");
				}
				return Reflect.has(target, prop);
			}
		});
	}

	
	refreshUI(op){
		let data = this.initialState;
		this.adjustState(data);
		//alert(`${op} ${data.join(", ")}`);
	}
	
	
	
	loadState(data, id){
		this.loadEl = id;
		this.initialState = data;
		
		return this.observe(this.state.data);
		
		// Find what elements changed, and insert the node
	}
	
	
	
	
	
	
	
	
	
	
	
	
	// node should only be added, not removed
	
	// use template().render()
	 adjustState(newData){
		
		let node = document.querySelector(this.loadEl);
			
		let latestText = newData[newData.length - 1];
		
		let p = document.createElement("p");
		let textNode = document.createTextNode(latestText);
		p.appendChild(textNode);
		
		 // p
		 
		 
		//node.insertBefore(p, node.childNodes[node.childNodes.length]);
		document.body.appendChild(p);
	}
	
	
	
	
	
	/*adjustState(newData){
		
		let node = document.querySelector(this.el);
			
		
		alert("LENAX " + node.childNodes[0].children.length);
		
		
		var lenax = node.childNodes[0].children.length;
		
		//var len = node.childNodes[0];// 1
		alert(node.childNodes[0]);
			while (node.firstChild){
				node.removeChild(node.lastChild);
			}
			
			this.render(this.el).render(this.el);	 // rendra ===> build
	}*/
	
	
	
	
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
		
		
		let nodes = this.toNode(this.toHTML());
		node.appendChild(nodes);
	}
	
	mount(el){
		this.el = el;
		this.render(el).render(el); // // this.render === function inside component
	}

	toCode(){
		return [""];
	}
	
	toHTML(el){
		return this.render(el).render(el).innerHTML; // // rendra ===> build
	}
}
export { Base };
