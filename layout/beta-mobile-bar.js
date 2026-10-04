/*!
 * nodality v1.3.20
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator, STYLE_OPTIONS} from "./animator.js";
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
// Des renders by running this code, so an option left out of it never
// reaches the page — hamburgerColour was read by set() and dropped here.
// Every option set() reads is emitted; brand only when there is one (it
// threw on a bar without a brand).
const SERIALISED = ["background", "color", "mar", "pad", "resmar", "respad", "radius", "maxHeight", "hamburgerColour", "keySet", "menuLabel", "menuId"];
// Plus every CSS-named option (STYLE_OPTIONS) the bar was given: set()
// applies them, so the code Des runs has to carry them too.
const keys = [...SERIALISED, ...Object.keys(this.obj).filter((k) => k in STYLE_OPTIONS && !SERIALISED.includes(k))];
let codeObj = keys
    .filter((k) => this.obj[k] !== undefined)
    .map((k) => `${k}: ${JSON.stringify(this.obj[k])},`)
    .join("\n");
if (this.obj.brand && typeof this.obj.brand.toCode === "function") {
    codeObj += `\nbrand: ${[].concat(this.obj.brand.toCode()).join("")},`;
}

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

      // After setStyles, so a page's values replace the defaults.
      obj.color && (this.navbar.style.color = obj.color);
      obj.pad && this.pad(obj.pad);
      // CSS-named options (backdropFilter, boxShadow, exact, weight, …) on the
      // bar itself, so a page need not reach for keySet. The four this bar
      // already applies above are left to it.
      {
        const { background, color, radius, maxHeight, ...style } = obj;
        this.applyStyleOptions(style);
      }
      obj.keySet && this.keySet(obj.keySet);
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
    this.brand.appendChild(newTextInstance.render());
} else {
}
          
      //  }


      

        this.toggleButton = document.createElement('button');
        this.toggleButton.classList.add('navbar-toggle');
        this.toggleButton.innerHTML = '&#9776;'; // Hamburger icon
        // A glyph is not a name: without these a screen reader announced the
        // button as "☰" and could not tell whether the menu was open.
        this.toggleButton.setAttribute('type', 'button');
        this.toggleButton.setAttribute('aria-label', obj.menuLabel ?? 'Menu');
        this.toggleButton.setAttribute('aria-expanded', 'false');

        this.navContent = document.createElement('div');
        this.navContent.classList.add('navbar-content');
        if (obj.menuId) {
            this.navContent.setAttribute('id', obj.menuId);
            this.toggleButton.setAttribute('aria-controls', obj.menuId);
        }
        // Following a link closes the menu. On a one-page site the links are
        // anchors, and a menu left open covered the section it had jumped to.
        this.navContent.addEventListener('click', (e) => {
            if (this.isMobileNavOpen && e.target && e.target.closest && e.target.closest('a')) {
                this.toggleMobileNav();
            }
        });

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
        this.toggleButton.setAttribute('aria-expanded', String(this.isMobileNavOpen));
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