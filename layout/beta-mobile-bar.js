/*!
 * nodality v1.1.13
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
import { keyPattern } from "../lib/codegen.js";
class /*Beta*/MobileBar extends Animator {
    constructor() {
        super();
       

    }


    

    removeQuotesFromFirstWord(jsonString) {
		if (!jsonString){
			return;
		}
		const modifiedJSON = jsonString.replace(keyPattern(), "$1:");
		return modifiedJSON;
	  }

    toCode(){
        let items = this.items.map(it => it.toCode()).flatMap(x => x);


  
     //   console.warn(items.join("").replace(/}\)/g, '}),'));
        
// I have to call toCode
// 1st reomve brand key from obj

let repl = this.removeQuotesFromFirstWord(JSON.stringify(this.obj));


// 23:38:35 Yes!!! 23/04/2025
// Alway construct neste in this way
let codeObj = `
background: "${this.obj.background}",
brand: ${this.obj.brand.toCode()},
mar: ${JSON.stringify(this.obj.mar)},
pad: ${JSON.stringify(this.obj.pad)},
resmar: ${JSON.stringify(this.obj.resmar)},
respad: ${JSON.stringify(this.obj.respad)},
radius: ${JSON.stringify(this.obj.radius)},
`;

        return `new MobileBar().set({${codeObj}}).add([
                         ${items.join(",")}

                    ])`
    }

    set(obj){
        this.obj = obj;

//console.log(obj.brand);
//console.log(Object.getPrototypeOf(obj.brand));
//console.log(obj.brand.render());

    //    console.log(obj.brand);


   

  //  console.log(obj.brand);
    //console.log(obj.brand.render());// CALLING RENDER CHANGES ABOVE
  //  console.log(obj.brand.res); // RES SHOULD BE OK
   // console.log(obj.brand.res); // RES SHOULD BE OK
    
      //  console.log(t);

        this.obj = obj;
        this.makeNavbar(obj);


      // Has to be the same
      obj.mar && super.mar(obj.mar);

    //  console.log("BOOA");
    //  console.log(obj.brand);
      // THANK YOU 215756!!!
      obj.maxHeight && (this.res.style.maxHeight = obj.maxHeight);

      obj.radius && (this.res.style.borderRadius = obj.radius);

      if (obj.hamburgerColour) {
          this.hamburgerColour = obj.hamburgerColour;
      }

   

      this.setStyles(obj);
        return this;
    }


    

    makeNavbar(obj){

     //   console.log(obj.brand.res);
     //   console.log(obj.brand);

        const newTextInstance = obj.brand;
       // newTextInstance.res.color = "green";
/*
// Restore state and other properties
newTextInstance.state = data.state;
newTextInstance.res = data.res;
newTextInstance.code = data.code;

console.log(newTextInstance.render());*/

        this.navbar = document.createElement('nav');
        this.navbar.classList.add('mobile-navbar');

        this.navbarHeader = document.createElement('div');
        this.navbarHeader.classList.add('navbar-header');

        this.brand = document.createElement('div');
        this.brand.classList.add('navbar-brand');
       


       //    console.log("APPENDING")
           // branda.textContent = "h";
            //console.log(obj.brand);
         //   console.log(obj.brand.res);
           // console.log(typeof obj.brand.res);

           
          // typeof obj.brand.res;
      //      console.log(obj.brand.render());
         

   // console.log(obj.brand.render());
  //console.log(obj.brand.res);
//} 

if (obj.brand && typeof newTextInstance.render === "function") {
    console.log("Appending brand:", newTextInstance.render());
    this.brand.appendChild(newTextInstance.render());
} else {
}
          
      //  }


      

        this.toggleButton = document.createElement('button');
        this.toggleButton.classList.add('navbar-toggle');
        this.toggleButton.innerHTML = '&#9776;'; // Hamburger icon

        this.navContent = document.createElement('div');
        this.navContent.classList.add('navbar-content');

        this.navbarHeader.appendChild(this.brand);
        this.navbarHeader.appendChild(this.toggleButton);
        this.navbar.appendChild(this.navbarHeader);
        this.navbar.appendChild(this.navContent);

        this.isMobileNavOpen = false;

        this.toggleButton.addEventListener('click', () => {
            this.toggleMobileNav();
        });

        this.res = this.navbar;
    }

    setStyles(obj) {
        this.navbar.style.display = 'flex';
        this.navbar.style.flexDirection = 'column';
        this.navbar.style.padding = '1rem';
        this.navbar.style.backgroundColor = obj.background ?? 'orange';

        this.navbarHeader.style.display = 'flex';
        this.navbarHeader.style.alignItems = 'center';
        this.navbarHeader.style.justifyContent = 'space-between';
        this.navbarHeader.style.width = '100%';

        this.brand.style.fontSize = '1.5rem';

        this.toggleButton.style.background = 'none';
        this.toggleButton.style.border = 'none';
        this.toggleButton.style.color = this.hamburgerColour ?? '#34495e';
        this.toggleButton.style.fontSize = '1.5rem';
        this.toggleButton.style.cursor = 'pointer';

        this.navContent.style.display = 'none';

        
    }


    add(ele){
        this.items = ele;

       
        for (var i = 0; i < ele.length; i++){
            let item = ele[i];
            this.navContent.appendChild(item.render());
        }

        return this;
    }

    toggleMobileNav() {
        this.isMobileNavOpen = !this.isMobileNavOpen;
        this.navContent.style.display = this.isMobileNavOpen ? 'flex' : 'none';
        if (this.isMobileNavOpen) {
            this.navContent.style.flexDirection = 'column';
            this.navContent.style.gap = '0.5rem';
            this.navContent.style.padding = '1rem';
        } else {
            this.navContent.style.flexDirection = '';
            this.navContent.style.gap = '';
            this.navContent.style.backgroundColor = '';
            this.navContent.style.padding = '';
        }
    }

    render(container) {
        if (container){
            document.querySelector(container).appendChild(this.navbar);
        }
        return this.navbar;
    }
}

export { /*Beta*/MobileBar };