import {Animator} from "./animator.js";
class Base extends Animator{
	constructor(/*items*/){
		super();
		// Converted from a standalone class; opting out of Theme keeps rendering
		// byte-identical to the pre-conversion behaviour.
		this._noTheme = true;
		//Base.prototype.items = items;
		this.oldLength = 0;
	}
	
	
	
	
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


	
	mount(el){
		this.res = el;
		this.render(el).render(el); // // this.render === function inside component
	}

	toCode(){
		return [""];
	}


}
export { Base };
