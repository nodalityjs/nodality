import {Animator} from "./animator.js";

// 13:28 07/04/2020 - BEGIN NOTHING GONNA STOP US NOW  Lets go!
class List {
	constructor() {
		this.tasks = [];
		this.setup();
	}

	set tasks(tasks) {
		this.items(tasks);
	}

	setup() {
		this.wrapper = document.createElement("div");
		this.wrapper.style.display = "flex";
		this.wrapper.style.flexDirection = "column";
		this.wrapper.style.padding = 0;
		this.wrapper.style.margin = 0;
		this.wrapCopy = this.wrapper;
		this.tasks = {};
	//	var copy = this.tasks;
		return this;
	}

	padding(val) {
		this.ele.style.padding = val;
		return this;
	}

	margin(val) {
		this.ele.style.margin = val;
		return this;
	}

	border(w, color) {
		this.ele.style.border = `${w}px solid ${color}`;
		return this;
	}

	set itemso(itemsa) {
		this.items(itemsa);
	}
	
	setItem(item){
		this.item = item;
		return this;
	}

	items(tasks) {
		if (this.wrapper) {
			while (this.wrapper.firstChild) {
				this.wrapper.removeChild(this.wrapper.lastChild);
			}
		}

		for (var i = 0; i < tasks.length; i++) {
			let cell = this.item.render(); 
			this.wrapper.appendChild(new Text(tasks[i]).render());
		}
		return this;
	}

	render(div) {
		if (div) {
			document.querySelector(div).appendChild(this.wrapper);
		} else {
			return this.wrapper;
		}

		return this;
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
}



class Cell {
	constructor(){
		this.res = null;
		this.setup();
	}
	
	setup(){
	  let el = document.createElement("div");
	  el.style.border = "2px solid gray";
	  this.res = el;
	  return this;
	}
	
	child(el){
		this.res.appendChild(el.render());
		return this;
	}
	
	render(){
		return this.res;
	}
}
window.List
Cell = List
Cell;
export { List
Cell };
