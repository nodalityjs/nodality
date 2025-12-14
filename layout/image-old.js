import {Animator} from "./animator.js";


/*
class ExactImage {
	constructor(url){
		this.image(url);
	}
	
	image(url, value, direction){
		
		// this.el = null;
		let query = window.matchMedia("(max-device-width: 415px)");
		let back = document.createElement("div");
		back.style.backgroundColor = "#ecf0f1";
		back.style.width = "100%";
		back.style.height = "200";
		
		if (query.matches){
			back.style.height = "500";
		}
		
		back.style.backgroundImage = `url(${url})`;
		back.style.backgroundPosition = "center center";
		back.style.backgroundSize = "cover";
		back.style.borderTopLeftRadius = `${value}px`;
		back.style.borderTopRightRadius = `${value}px`;
	
		this.el = back;
		return this;	
	}
	
	
	render(){
		return this.el;
	}
}
*/

class Imager extends Animator {
	constructor(url, type, mode) {
		super();
		this.url = url;
		this.res = null;
		
		
		
		
		if (type == "exact"){
			this.image(this.url, mode);
		} else {
			this.setup();
		}
	}

	toSticky(){
		this.res.style.position = "sticky";
		this.res.style.top = "0px";
		return this;
	}

	setID(id){
		this.res.setAttribute("id", id);
		return this;
	}

	square(){
		this.res.style.width = "30%";
		this.res.style.paddingBottom = "30%";
		return this;
	}


	opacity(value){
		this.res.style.opacity = `${value}`;
		return this;
	}


	setGrid(){
		this.res.style.gridRow = "span 2";
		this.res.style.gridColumn= "span 3";
		//this.res.style.gridColumn = "span 3";
		return this;
	}

	transform(str){
		this.res.style.transform = str; //"rotate3d(.5,-.866,0,15deg)  rotate(60deg)";
		return this;
	}

	offset(){
		this.res.style.marginLeft = "-60px";
		return this;
	}

	offseta(){
		this.res.style.marginLeft = "90px";
		this.res.style.marginTop = "-30px";
		return this;
	}
	
	borderAround(data){
		this.res.style.border = data;
		return this;
	}
    
	setClass(name){
		this.res.setAttribute("class", name);
		return this;
	}
	
     scale(obj){
        
        let previousWidth = this.res.style.width;
          
        this.res.style.transition= "0.5s all";
      //  alert(previousWidth);
        
        this.res.addEventListener("mouseover", () => {
            let previousWidth = this.res.style.width;
             this.res.style.transform = "scale(1.04)";
        });
        
         this.res.addEventListener("mouseout", () => {
            let previousWidth = this.res.style.width;
              this.res.style.transform = "scale(1.0)";
        });
        
        
        return this;
    }


	onTap(e) {
		this.res.addEventListener("click", e);
		return this;
	}
    
    border(corners){
        this.res.style.borderTopLeftRadius = "16px";
        this.res.style.borderTopRightRadius = "16px";
        return this;
    }

	allRound(dimensions){
this.res.style.borderRadius = dimensions;
return this;
	}


	mobileWidth(){
		let query = window.matchMedia("(max-device-width: 415px)");
		if (query.matches){
			this.res.style.width = "120%";
		}


		return this;
	}
	
	image(url, mode, value, direction){
		
		// this.el = null;
		let query = window.matchMedia("(max-device-width: 415px)");
		let back = document.createElement("div");
		//back.style.backgroundColor = "#ecf0f1";
		back.style.width = "100%";
		back.style.height = "200";
		
		if (query.matches){
			back.style.height = "500";
		}
		
		back.style.backgroundImage = `url(${url})`;
		back.style.backgroundPosition = "center center";
       // back.style.backgroundRepeatX = "no-repeat";
         back.style.backgroundRepeat = "no-repeat";
       
		back.style.backgroundSize = "cover";
        
        
        if (mode === "contain"){
            back.style.backgroundSize = "contain";
        }
        
        
		back.style.borderTopLeftRadius = `${value}px`;
		back.style.borderTopRightRadius = `${value}px`;
	
		this.res = back;
		return this;	
	}

	arrayPadding(arr, value) {
		if (arr.includes("left")){
			this.res.style.paddingLeft = value;
		}
		
		if (arr.includes("right")){
			this.res.style.paddingRight = value;
		}
		
		if (arr.includes("top")){
			this.res.style.paddingTop = value;
		}
		
		if (arr.includes("bottom")){
			this.res.style.paddingBottom = value;
		}
			
		
		return this;
	}


	arrayMargin(arr, value) {
		if (arr.includes("left")){
			this.res.style.marginLeft = value;
		}
		
		if (arr.includes("right")){
			this.res.style.marginRight = value;
		}
		
		if (arr.includes("top")){
			this.res.style.marginTop = value;
		}
		
		if (arr.includes("bottom")){
			this.res.style.marginBottom = value;
		}
			
		
		return this;
	}


	setup() {
		let img = document.createElement("img");
	    img.style.width = "100%";
		//img.style.height = "auto";
		img.src = this.url;
		this.res = img;
		return this;
	}

	autoW(){
		this.res.style.width = "initial";
		return this;
	}

	float(dir){
		this.res.style.float = `${dir}`;
		return this;
	}

	fillAvailable(){
		this.res.style.height = "-webkit-fill-available";
	return this;
	}
	
	
	
	
	flex(val){
		this.res.style.flex = 1;
		return this;
	}
	
	height(h){
		 this.res.style.height = h;
		 this.res.style.width = "auto";
			return this;
	}




	expand(obj){


		
	


		const convert = (value) => {



			var convertedValue = value;

			if ((value.includes("%")) || value.includes("px")){
				
				convertedValue = convertedValue.substr(0, 2);
			}



			if (value.includes("%")){
				return Number(convertedValue / 100 * window.innerWidth);
			}

			if (value.includes("px")){
				return Number(convertedValue);
			}
			
		}

		const check = () => {
			let mq = window.matchMedia(`(min-width: ${obj.at})`);

			if (mq.matches){
			//	alert("MATCH")
				this.res.style.width = `${obj.width}`;

				let newWidth = window.innerWidth / 2 - convert(obj.width) / 2;
				// alert(newWidth);
				this.res.style.marginLeft = `${newWidth}px`; // `calc(${window.innerWidth}-${obj.width} / 2)`;
			} else {
				this.res.style.width = `100%`;
				this.res.style.marginLeft = `0px`;
			}


			let mqa = window.matchMedia(`(max-device-width: 415px)`);
if (mqa.matches){
	this.res.style.width = `100%`;
				this.res.style.marginLeft = `0px`;
}

			
		}


		check();

		window.addEventListener("resize", check);
		

		return this;
	}
	
	/*center(w){
		
		
		const adj = () => {
			if (this.res.style.width != 0){
			let count = window.innerWidth / 2 - (((w * window.innerWidth) / 100) / 2);
			this.res.style.marginLeft = `${count}px`;
		}
		}
		
		
		adj();
		window.onresize = adj();
		return this;
	}*/
	
	width(w){
		 this.res.style.width = w;
		 this.res.style.height = "auto";
		return this;
	}
	
	margin(L, T, R, B) {
		if (L || T || R || B){ // CAUGHT MYSELF
		this.res.style.marginLeft = L;
		this.res.style.marginTop = T;
		this.res.style.marginRight = R;
		this.res.style.marginBottom = B;
		} 
		
		if (!T && !R && !B){
			
			if (T !== 0 || R !== 0 || B !== 0){
				//	alert("j")
		this.res.style.margin = L;	
			}
		
			
		}
		
		return this;
	}
	
	
	padding(el){
		this.res.style.padding = el;
		return this;
	}
	
	size(w, h) {
		if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}

		return this;
	}

    
    
    frame(obj) {
        let w = obj.width;
        let h = obj.height;
        
		if (w && h) {
			this.res.style.width = w;
			this.res.style.height = h;
		} else {
			this.res.style.width = w;
			this.res.style.height = w;
		}

		return this;
	}

    
    
	RSize(w, h, ratio) {
		
		let mq = window.matchMedia("(max-device-width: 420px)");
			
		
		if (w && h) {
			
			this.res.style.width = mq.matches ? w * ratio : w;
			this.res.style.height = mq.matches ? h * ratio : h;
		} else {
			this.res.style.width = mq.matches ? w * ratio : w;
			this.res.style.height = mq.matches ? w * ratio : w;
		}

		return this;
	}

	
	
	
    shadow(obj){
        
        
        
        
        
        if (obj.type === "mild"){
        this.res.style.boxShadow = `0px 3px 15px rgba(0,0,0,0.2)`;
        } else {
             this.res.style.boxShadow = `${obj.x}px ${obj.y}px ${obj.radius}px ${obj.color}`;
       
        }
        
        
        return this;
    }
    
    
    
	
	clipShape(shape) {
		this.res.style.borderRadius = "50%";
		return this;
	}
	
	cornerRadius(val){
		this.res.style.borderRadius = val;
		return this;
	}

	render(el) {
		if (el) {
			document.querySelector(el).appendChild(this.res);
		} else {
			return this.res;
		}
	}
} 

window.ExactImage
Imager = ExactImage
Imager;
export { ExactImage
Imager };
