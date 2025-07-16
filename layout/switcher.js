import {Animator} from "./animator.js";

 
class Switcher {
    constructor(obj){
      this.res = null;
      this.obj = obj;
      this.code = [];
      console.warn(this.obj);

      if (obj.first.toCode && obj.second.toCode){

      
          this.code.push(`, new Switcher({breakpoint: "${this.obj.breakpoint}", first: ${this.obj.first.toCode()}, second: ${this.obj.second.toCode()}})`);
     
      }
     // console.log(this.obj.first.toCode());
  
      let area = document.createElement("textarea");
      area.style.fontWeight = "bold";
      area.style.height = 1000;
      area.style.width = 1000;
  
  
  
     /* te.value = te.value.replace(".mount('#mount');,", ".mount('#mount');");
      te.value = te.value.replace(" ,new Wrapper", "new Wrapper");
  */
  
  this.codeArr  = [...this.code];
  
     this.code =  this.code.toString().replaceAll(", .", ".")
     .replaceAll(",.", ".")
     .replaceAll(",,.", ".")
     .replaceAll("{,", "{")
     .replaceAll("[,", "[")
     .replace(/,+/g, ',');
  
      area.value = this.code;
      document.body.appendChild(area);
  
     
      /* {
        breakpoint: 700px,
        first: element,
        second: element,
  
      }*/
  
     this.switchElements();
    }
  
   
  switchElements(){


    this.res = document.createElement("div"); // move out of the loop
    // 17:27:15 29/09/23
   
    const innerSwitch = () => {

    console.log("I")

  // alert("LK")


this.res.innerHTML = "";
   // this.code.push(` \n .switchElements()`)
    let mq = window.matchMedia(`(max-width: ${this.obj.breakpoint})`).matches;

    if (mq){
    //  alert("O")
    
      this.res.appendChild(this.obj.first.render());
    } else {
    
      this.res.appendChild(this.obj.second.render());
    }
  }

  innerSwitch();

  window.addEventListener("resize", innerSwitch);
  // 17:30:22 Nice



  }
  
    toCode(){
     // alert("IO0")
     console.log(this.code);
      return this.codeArr;
    }
  
  
    render(div){
       document.querySelector(div).appendChild(this.res);
      return this.res;
    }
  }
export { Switcher };
