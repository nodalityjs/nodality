/*!
 * nodality v1.1.4
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import {Animator} from "./animator.js";
class /*Beta*/DesktopBar extends Animator { // add set method for background color and try to publish
    constructor() {
        super();
        this.navbar = document.createElement('nav');
        this.navbar.classList.add('desktop-navbar');

        this.navbarHeader = document.createElement('div');
        this.navbarHeader.classList.add('navbar-header');

        this.brand = document.createElement('div');
        this.brand.classList.add('navbar-brand');

        this.navContent = document.createElement('div');
        this.navContent.classList.add('navbar-content');
        this.navContent.style.width = "100%";
        this.navContent.style.alignItems = "center";

        this.navbarHeader.appendChild(this.brand);
        this.navbarHeader.appendChild(this.navContent);
        this.navbar.appendChild(this.navbarHeader);
        this.res = this.navbar;
       
    }

    set(obj){
        this.obj = obj;

        // Apply built-in defaults FIRST so caller-supplied pad/mar/
        // background/radius below can override them. Previously setStyles
        // ran last and hardcoded padding=1rem, silently clobbering
        // whatever pad the caller passed.
        this.setStyles(obj);

        obj.background && (this.res.style.backgroundColor = obj.background);
        obj.brand && this.setBrand(obj.brand);
        obj.radius && (this.res.style.borderRadius = obj.radius);

        obj.pad && this.pad(obj.pad);
		obj.respad && this.respad(obj.respad);
		obj.resmar && this.resmar(obj.resmar);
		obj.mar && this.mar(obj.mar);


        // THANK YOU 215756!!!
        obj.maxHeight && (this.res.style.maxHeight = obj.maxHeight);

        if (obj.hamburgerColour) {
            this.hamburgerColour = obj.hamburgerColour;
        }
        return this;
    }

    setStyles() {
        this.navbar.style.display = 'flex';
        this.navbar.style.flexDirection = 'column';

        // Default padding — caller-supplied `pad` in set() runs AFTER
        // this and overrides it.
        this.navbar.style.padding = '1rem';
        this.navbar.style.backgroundColor = this.obj.background ?? '#333';

        this.navbarHeader.style.display = 'flex';
        this.navbarHeader.style.alignItems = 'center';
        this.navbarHeader.style.justifyContent = 'space-between';
        this.navbarHeader.style.width = '100%';

        this.brand.style.fontSize = '1.5rem';

        this.navContent.style.display = 'flex';
        this.navContent.style.gap = '1rem';


    }

    setBrand(brandElement) {
        this.brand.innerHTML = '';
        this.brand.appendChild(brandElement);
        return this;
    }


    add(ele){
        this.items = ele;
        for (var i = 0; i < ele.length; i++){
            let item = ele[i];
            this.navContent.appendChild(ele[i].render());
        }

        return this;
    }

    toCode(){
        let items = this.items.map(it => it.toCode()).flatMap(x => x);

        // console.warn(items.join("").replace(/}\)/g, '}),'));

        //   ${items.join("")}
        return `new DesktopBar().set(${this.removeQuotesFromFirstWord(JSON.stringify(this.obj))}).add([
                  ${items.join(",")}

                      
                    

                    ])`
    }

    /*
    .replace(/}\)/g, '}),').replace("Spacer(true)", "Spacer(true),").replace(/,,/g, ",").replace(/}\),\./g, "}).")
    */
    render(container) {
        if (container){
            document.querySelector(container).appendChild(this.navbar);
        }

        return this.navbar;
    }
}


export {/*Beta*/DesktopBar}