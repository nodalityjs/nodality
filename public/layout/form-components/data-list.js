import {Animator} from "../animator.js";


 class DataList {
        constructor(){
            this.res = null;
            this.currentItem = "";
        }
        
        set(items){

        let obj = items;
     

        this.options = items;
        var container = document.createElement("input");
        container.setAttribute("list", "dlCities");
        container.setAttribute("id", "my");
    
        var optionList = items.data;

    var i = 0,
    len = optionList.length,
    dl = document.createElement('datalist');

    dl.id = 'dlCities';
            
    for (var i = 0; i < len; i += 1) {
        var option = document.createElement('option');
        option.value = optionList[i];
        dl.appendChild(option);
    }
            
            container.appendChild(dl);
            container.addEventListener("change", () => {
                let val = document.querySelector("#my").value;
                console.log(val); 
                this.currentItem = val;
            });
            
            
            
            
            container.setAttribute("placeholder", "Type value");
            container.style.padding = ".4rem .75rem";
            container.style.fontSize = "1rem";
            this.res = container;
            this.responsive();

            obj.arrayPadding && this.arrayPadding(obj.arrayPadding.sides, obj.arrayPadding.value);
            obj.arrayMargin && this.arrayMargin(obj.arrayMargin.sides, obj.arrayMargin.value);

            obj.pad && this.pad(obj.pad);
            obj.mar && this.mar(obj.mar);


            return this;
            
        }

        toCode() {
            const objString = JSON.stringify(this.options, null, 4);
            return [`new DataList().set(${objString})`];
        }

        getValue(){
            return this.res.value;
        }


    arrayPadding(arr, value) {
		//alert("PP")
		console.log(arr);
			if (arr.includes("left")){
				this.res.style.paddingLeft = value;
			}
	
			// console.log("PAD");
			// console.log(this.res.style.paddingLeft);
			// console.log(arr);
			// console.log(value);
			
			if (arr.includes("right")){
				this.res.style.paddingRight = value;
			}
			
			if (arr.includes("top")){
				this.res.style.paddingTop = value;
			}
			
			if (arr.includes("bottom")){
				this.res.style.paddingBottom = value;
			}
	
			if (arr.includes("all")){
				this.res.style.padding = value;
					}
				
			
			return this;
		}
	
		arrayMargin(arr, value) {
			//alert("PP")
			console.log(arr);
				if (arr.includes("left")){
					this.res.style.marginLeft = value;
				}
		
				// console.log("PAD");
				// console.log(this.res.style.paddingLeft);
				// console.log(arr);
				// console.log(value);
				
				if (arr.includes("right")){
					this.res.style.marginRight = value;
				}
				
				if (arr.includes("top")){
					this.res.style.marginTop = value;
				}
				
				if (arr.includes("bottom")){
					this.res.style.marginBottom = value;
				}
		
				if (arr.includes("all")){
					this.res.style.margin = value;
						}
					
				
				return this;
			}
			
        
          margin(val){
        this.res.style.margin = val;
        return this;
    }
        
        responsive(){
            let query = window.matchMedia("(max-device-width: 415px)");
           
            // window.matchMedia(query)
           /* if (query.matches){
                
                this.el.style.fontSize = "3rem";
            } else {
                  this.el.style.fontSize = "1rem";
            }*/
            

                 
			if (query.matches) {
				this.res.style.width = "100%";
			
			} else {
				
			}

            
            return this;
        }
        
        
        
          render(div){
		if (div){
			document.querySelector(div).appendChild(this.res);
           
		} else {
			return this.res;
		}	
	   }
    }
    
    // Call without new
   var _oldDataList = DataList;
   DataList = function(...args) { return new _oldDataList(...args) };
    
    
window.DataList = DataList;
export { DataList };
