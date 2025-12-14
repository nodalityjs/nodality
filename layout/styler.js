import {Animator} from "./animator.js";









/*

	
let un = new UniStyle()
.maxWidth(800, new Style().color("blue"));
// write applyUniStyle for each element
	


*/




// write applyUniStyleMethod







class Style {
	constructor(obj) {
		this.width = obj.max;
		this.min = obj.min;
		this.max = obj.max;
		
		this.styles = {
			color: "",
			background: "",
			fontWeight: "",
			align: "",
			padding: [],
			margin: [],
			opacity: 1,
			fontSize: "",
			width: "",
			height:"",
			gridTemplateAreas: "",
			height: ""
		};
	}
	
	
	height(h){
		this.styles.height = h;
		return this;
	}
	
	arrayAreas(str){
		this.styles.gridTemplateAreas = str;
		return this;
	}

	color(name) {
		this.styles.color = name;
		return this;
	}

	background(name) {
		this.styles.background = name;
		return this;
	}

	bold() {
		this.styles.fontWeight = "bold";
		return this;
	}

	align(alignment) {
		this.styles.align = alignment;
		return this;
	}

	padding(L, T, R, B) {
		this.styles.padding = [L, T, R, B];
		return this;
	}

	margin(L, T, R, B) {
		this.styles.margin = [L, T, R, B];
		return this;
	}

	opacity(value) {
		this.styles.opacity = value;
		return this;
	}
	
	
	size(w, h) {
		this.styles.width = w;
		this.styles.height = w;
		return this;
	}
	
	em(val){
		this.styles.fontSize = `${val}em`;
		return this;
	}
}
export { Style };
