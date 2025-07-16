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

        this.navbarHeader.appendChild(this.brand);
        this.navbarHeader.appendChild(this.navContent);
        this.navbar.appendChild(this.navbarHeader);
        this.res = this.navbar;
       
    }

    set(obj){
        console.warn(obj);
        this.obj = obj;
        obj.background && (this.res.style.backgroundColor = obj.background);
        obj.mar && super.mar(obj.mar);
        obj.brand && this.setBrand(obj.brand);
        obj.radius && (this.res.style.borderRadius = obj.radius);
        // THANK YOU 215756!!!
        obj.maxHeight && (this.res.style.maxHeight = obj.maxHeight);

        if (obj.hamburgerColour) {
            this.hamburgerColour = obj.hamburgerColour;
        }
        // {
       // [{"a": 21}]
       this.setStyles();
        return this;
    }

    setStyles() {
        this.navbar.style.display = 'flex';
        this.navbar.style.flexDirection = 'column';
        this.navbar.style.padding = '1rem';
        this.navbar.style.backgroundColor = '#333';
        this.navbar.style.color = 'white';

        this.navbarHeader.style.display = 'flex';
        this.navbarHeader.style.alignItems = 'center';
        this.navbarHeader.style.justifyContent = 'space-between';
        this.navbarHeader.style.width = '100%';

        this.brand.style.fontSize = '1.5rem';

        this.navContent.style.display = 'flex';
        this.navContent.style.gap = '1rem';

    
    }

    setBrand(brandElement) {
        console.warn("SETA");
        console.log(brandElement);
        this.brand.innerHTML = '';
        this.brand.appendChild(brandElement);
        return this;
    }

    /*addNavItem(navItemElement) {
        this.navContent.appendChild(navItemElement);
        return this;
    }*/

    add(ele){
        this.items = ele;
        for (var i = 0; i < ele.length; i++){
            let item = ele[i];
            this.navContent.appendChild(ele[i].render());
        }

        return this;
    }

    toCode(){
        console.warn(this.items);
        let items = this.items.map(it => it.toCode()).flatMap(x => x);

        console.log("ITSA");
        console.log(items); // links should not be split in teo
        // console.warn(items.join("").replace(/}\)/g, '}),'));
      /* console.log(this.items[3]);
        console.log(this.items[3].toCode());

        if (this.items[3].toCode().length != 1){
            alert("Wrong link codegen");
        }*/

        //   ${items.join("")}
        console.log(`${items.join(",")}`);
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
       // container.appendChild(this.navbar);
    }
}


export {/*Beta*/DesktopBar}