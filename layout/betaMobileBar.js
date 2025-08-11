import {Animator} from "./animator.js";
import {Text} from "./text.js";

class /*Beta*/MobileBar extends Animator {
    constructor() {
        super();
       

       // this.setStyles();
    }

    removeQuotesFromBoth(jsonString) {
        if (!jsonString) {
            return;
        }
        // Remove quotes from both keys and values
        const modifiedJSON = jsonString.replace(/"([^"]+)":\s*"([^"]+)"/g, '$1: $2');
        return modifiedJSON;
    }
    

    removeQuotesFromFirstWord(jsonString) {
		if (!jsonString){
			return;
		}
		const modifiedJSON = jsonString.replace(/"([^"]+)":/g, '$1:');
		return modifiedJSON;
	  }

    toCode(){
        console.warn(this.items);
        let items = this.items.map(it => it.toCode()).flatMap(x => x);

        console.log("BAD CONV");
        console.log(this.removeQuotesFromFirstWord(JSON.stringify(this.obj, null, 4)));

  
     //   console.warn(items.join("").replace(/}\)/g, '}),'));
        
// I have to call toCode
// 1st reomve brand key from obj

//delete this.obj.brand;
//this.obj.brand = this.obj.brand.toCode()[0];//.replace(/^"|"$/g, '');
let repl = this.removeQuotesFromFirstWord(JSON.stringify(this.obj));
console.log(repl);



console.log("REPL")
console.log(repl);

// 23:38:35 Yes!!! 23/04/2025
// Alway construct neste in this way
let codeObj = `
background: "${this.obj.background}",
brand: ${this.obj.brand.toCode()},
mar: ${JSON.stringify(this.obj.mar)},
pad: ${JSON.stringify(this.obj.mar)},
radius: ${JSON.stringify(this.obj.radius)},
`;

        return `new MobileBar().set({${codeObj}}).add([
                         ${items.join(",")}

                    ])`
    }

    set(obj){
        this.obj = obj;

        console.log("After passing to set:");
//console.log(obj.brand);
//console.log(Object.getPrototypeOf(obj.brand));
//console.log(obj.brand.render());

        console.log("OBJ IN SET");
    //    console.log(this.obj.brand);
    //    console.log(obj.brand);

   //  console.log(Object.getPrototypeOf(this.obj.brand));

   

  //  console.log(obj.brand);
    //console.log(obj.brand.render());// CALLING RENDER CHANGES ABOVE
  //  console.log(obj.brand.res); // RES SHOULD BE OK
   // console.log(obj.brand.res); // RES SHOULD BE OK
    
      //  let t = new Text("A").set({size: "S1"});
      //  console.log(t);

        this.obj = obj;
        this.makeNavbar(obj);
     //   obj.background && (this.res.style.backgroundColor = obj.background);
      //  obj.brand && this.setBrand(obj.brand);


      // Has to be the same
     // obj.background && //(this.res.style.backgroundColor = obj.background);
      obj.mar && super.mar(obj.mar);

    //  console.log("BOOA");
    //  console.log(obj.brand);
    //  obj.brand && this.setBrand(obj.brand);
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

        console.log("OBJ IN SETA");
     //   console.log(obj.brand.res);
     //   console.log(obj.brand);

        const newTextInstance = obj.brand;
       // const newTextInstance = new Text(data.text).set({color: "orange"});
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
       


      //  if (obj.brand && obj.brand instanceof Node) {
       //    console.log("APPENDING")
          //  let branda = document.createElement("h1");
           // branda.textContent = "h";
            console.log("BRIS");
            //console.log(obj.brand);
         //   console.log(obj.brand.res);
           // console.log(typeof obj.brand.res);

           
          // typeof obj.brand.res;
      //      console.log(obj.brand.render());
         
//if (obj.brand.render){

    console.log("APPENDED-")
  //  this.brand.appendChild(obj.brand.res);
   // console.log(obj.brand.render());
//this.brand.style.border = "3px solid orange";
//this.brand.style.width = "100px";
//this.brand.style.height = "100px";
  //  let t = new Text("A").set({size: "S3"});
  //console.log(obj.brand.res);
        //    this.brand.appendChild(obj.brand.res);
//} 

if (obj.brand && typeof newTextInstance.render === "function") {
    console.log("Appending brand:", newTextInstance.render());
    this.brand.appendChild(newTextInstance.render());
} else {
    console.warn("Brand does not have a valid render method:", obj.brand);
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
       // this.navbar.style.color = 'white';

        this.navbarHeader.style.display = 'flex';
        this.navbarHeader.style.alignItems = 'center';
        this.navbarHeader.style.justifyContent = 'space-between';
        this.navbarHeader.style.width = '100%';

        this.brand.style.fontSize = '1.5rem';

        this.toggleButton.style.background = 'none';
        this.toggleButton.style.border = 'none';
        this.toggleButton.style.color = this.hamburgerColour ?? 'white';
        this.toggleButton.style.fontSize = '1.5rem';
        this.toggleButton.style.cursor = 'pointer';

        this.navContent.style.display = 'none';

        
    }

   /* setBrand(brandElement) {

        if (brandElement instanceof Node) {
            console.log("KBO");
            console.log(brandElement);
            this.brand.innerHTML = '';

            console.log(this.navbarHeader.children);
            this.navContent.appendChild(brandElement);
           // this.brand.appendChild(brandElement);
        }

    }*/

  /*  addNavItem(navItemElement) {
        this.navContent.appendChild(navItemElement);
        return this;
    }*/

    add(ele){
        console.log(ele);
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
           // this.navContent.style.backgroundColor = '#444';
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
     //   container.appendChild(this.navbar);
    }
}

export { /*Beta*/MobileBar };