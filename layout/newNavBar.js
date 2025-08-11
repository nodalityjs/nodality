import {Animator} from "./animator.js";
// import {CustomDivRenderer} from "./navFactor/customDiv.js";
// CORRECT
// const { TIS620_THAI_CI } = require("mysql/lib/protocol/constants/charsets");
class CustomDivRenderer {
    constructor(obj, items) {
        this.obj = obj || {};
        this.items = items || [];
    }

     render() {
        // Create inner div with flex display
        let tempDiv = document.createElement("div");
        tempDiv.style.display = "flex";
        tempDiv.style.width = "100%";
        tempDiv.style.justifyContent = "space-around";
        tempDiv.setAttribute("id", "innerItemsWrapper");
        
        let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);
        let media = window.matchMedia(`(max-width: 600px)`);

        if (mobileMedia.matches || media.matches){
            tempDiv.style.marginTop = "3rem";
        }

      //  console.log("ITEMS ARE ORDERED");
      //  console.log(this.items);

        // Append rendered items to inner div
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
          //  alert("KOJO")
            tempDiv.appendChild(item.render());
        }

        // Create outer div and apply styling based on obj properties
        let outerDiv = document.createElement("div");
        outerDiv.style.width = this.obj.isSide ? "333px" : "100%";
        outerDiv.style.background = this.obj.background || "white";
        outerDiv.style.display = "flex";
        outerDiv.style.justifyContent = "center";
        outerDiv.style.alignItems = "center";
        outerDiv.style.height = "100%";
        outerDiv.setAttribute("id", "outerItemsWrapper");
        outerDiv.appendChild(tempDiv);

        // Apply custom styles if specified in obj
        if (this.obj.customStyle) {
            tempDiv.style.width = "auto";
            tempDiv.style.top = "0rem";
            tempDiv.style.borderRadius = "1rem";
            tempDiv.style.background = this.obj.background || "white";
            tempDiv.style.margin = "1rem";
            tempDiv.style.position = "absolute";
            tempDiv.style.opacity = 0.8;
        }

        return outerDiv;
    }
}

//window.CustomDivRenderer = CustomDivRenderer;
//export { CustomDivRenderer };


class UINavBar extends Animator {
    constructor(els) {
        super();
        this.titleText = "";
        this.hasHamburger = false;
        this.code = [];
        this.attributes = {};
    }

    toCode(){
        let codeStr = `new UINavBar()`;
        // 16:01:09 09/11/24 What????
        // Convert attributes to .set({...}) format if there are any attributes
        if (Object.keys(this.attributes).length > 0) {
            codeStr += `.setup(${JSON.stringify(this.attributes, null, 2).replace(/"([^"]+)":/g, '$1:')})`;

          //  codeStr += `.set(${JSON.stringify(this.attributes, null, 2)})`;
        } else {
            codeStr += `.setup({})`;
        }
    
        codeStr += `.items([\n`;
    
        // Generate the code for each item and join with commas only between items
        codeStr += this.items
            .map(item => item.toCode().join("").trim()) // Trim any line breaks or whitespace around the item code
            .join(",\n"); // Insert commas only between items
    
        codeStr += `\n])`;

        return codeStr;
    
    }

    styled(obj) {
        this.setup(obj);
        this.styles = obj;
        return this;
    }

    setup(obj) {
        this.obj = obj;
        if (!this.obj.isSide) { // fuck that, not even Ing. can solve this
            this.obj.animate = false;
        }
        
        this.attributes = obj;
        let wrap = document.createElement("div");
        wrap.setAttribute("id", "sars");
        wrap.style.padding = 0;
        wrap.style.margin = 0;

        let el = document.createElement("div");
        el.setAttribute("id", "covid");
        el.style.position = "absolute"; // KEEP THIS ?? 07/01/2025
        el.style.width = "100%";
        el.style.zIndex = 1;
        el.style.alignItems = "flex-start";
        // LINE 700 FINAL STYLING !!!

      

        let back = document.createElement("div");
        back.style.background = "green";
        back.style.position = "absolute";

        el.style.margin = "20px";
        el.style.display = "flex";
        el.style.alignItems = "flex-end";
        el.style.margin = 0;
        el.style.padding = 0;
        el.style.margin = 0;

        wrap.appendChild(el);

        
        this.addCloseButton = false;
        this.res = wrap;
      //  console.log(this.res);


        if (obj.background) {
            this.background({
                color: obj.background
            });
        }


        if (obj.openColor){
            this.openColor = obj.openColor;
        }
      

        if (obj.sticky) {
            this.sticky();
        }

        if (obj.pad){
            this.pad(obj.pad);
        }

  
        if (obj.hamburgerColour) {
            this.hamburgerColour = obj.hamburgerColour;
        }

        if (obj.mobileSize) {
            this.mobileSize = obj.mobileSize;
        }

        if (obj.desktopSize) {
            this.desktopSize = obj.desktopSize;
        }

        if (obj.height) {
            this.res.children[0].style.height = obj.height;
        }

        return this;
    }


    items(items) {
       
        this.items = items;
       // alert(this.items);
        let starts = ["Link", "Image", "Spacer", "Dropdown"].some(e => {
            return items[0].__proto__
                .constructor
                .toString()
                .startsWith(`class ${e}`);
        });

      //  console.log(starts);
      //alert("NEXT");
      //alert(this.items);
      console.log(this.items);
     // alert(starts); //THIS SHOULD BE TRUE;

        if (true) { // We are adding class instances to the Area

            this.itemCount = items.length; // 675 lines was
            let rend = new CustomDivRenderer(this.obj, this.items);
            let outerDiv = rend.render();

            this.res.children[0].appendChild(outerDiv);



            let child = this.res.children[0].children[0].children[0];
          //  console.log("AHELLO");
        //    console.log(child);
          //  console.log(child.children);


            // dont solve range object
           // console.log("ANIMATION OBJECT ");
           
            // Read initial state from this

            
            let animationObj = this.items[0].options;


            if (animationObj && animationObj.animation){

            
            let animation = animationObj.animation.op;
         //   console.log(animation);



            if (animation){


            let mobileMedia = window.matchMedia(`(max-device-width: 415px)`);

            let smallScreen = window.matchMedia(`(max-width: 600px)`);
            
            if (!mobileMedia.matches && !smallScreen.matches){

            
            for (var i = 0; i < child.children.length; i++){
                //child.children[i].style.border = "1px solid purple";

                // 1 - SET HIDDEN STATE BY IMMEDIATELLY FIRING ANIM
                // set hidden state immediatelly on the mobile
                let immediateAll =  {
                    duration: 1, // 1 should be acceptable here when I close
                    fill: 'forwards',
                    delay: 1 
                }

                child.children[i].animate(animation.keyframesClose, immediateAll);

                // 2 - ANIMATE INTO THE VIEW
                // animate using opening keyframes on the mobile when user click the button
                // when mobile nav is in opended state an I click button to set it to closing state
                // animate "#innerItemsWrapper" children using closing options
                child.children[i].animate(animation.keyframesOpen, animation.openOptions);


                

            }
        } else { // We are in animated state on mobile
            let immediateAll =  {
                duration: 1, // 1 should be acceptable here when I close
                fill: 'forwards',
                delay: 1 
            }

            //console.log("CHILDREN");
            //console.log(child);
            //console.log(child.children);

            for (var i = 0; i < child.children.length; i++){
            child.children[i].animate(animation.keyframesClose, immediateAll);
            }

        }

        }

    }
            
            this.adjust();
        }

        if (!starts) { // User is lazy

            this.itemCount = items.length;

            let div = document.createElement("div");
            div.style.backgroundColor = "orange";

            for (var i = 0; i < items.length; i++) {
                let item = items[i];


                if (item.logo) {
                    let logo = new Image(item.logo).width("100px");
                    let spacer = document.createElement("div");
                    spacer.style.flex = "1";
                    spacer.style.height = 23;

                    let wr = document.createElement("div");
                    wr.setAttribute("id", "WR")
                    wr.style.display = "flex";
                    wr.style.flexDirection = "row";
                    wr.appendChild(logo.render());
                    this.res.children[0].appendChild(logo.render());



                    // throws it

                    if (this.obj.spacing) {
                        this.res.children[0].appendChild(spacer);
                    }
                }


                if (item.logo) {
                    this.allowPad = true;
                }

                if (item.logo && this.obj.spacing) {
                    this.res.children[0].children[0].style.marginLeft = this.obj.spacing.sides;
                    this.res.children[0].children[0].style.marginRight = this.obj.spacing.sides;
                }


                if (item.title) {

                    let link;
                    if (this.allowPad) {
                        if (item.type) {
                            link = new Dropdown(item.items, item.title)
                        } else {
                            link = new Link(item.title, item.url)
                                .arrayPadding(["left", "right"], "1em");
                        }

                    } else {

                        if (item.type) {
                            link = new Link("DRPA", item.url);
                        } else {
                            link = new Link(item.title, item.url);
                        }

                    }

                    div.appendChild(link.render());
                }

            }

            this.res.children[0].appendChild(div);
            this.adjust();
        }




        // Insert hamburger button at the correct place
        var btn = this.addHamburger();

        let newCount = this.itemCount;
        if (this.obj.spacing) {
            newCount += 1;
        }

        btn.style.zIndex = 1;

        if (this.res.children[0].children.length === 1) { // Problem here
            this.res.children[0].insertBefore(btn, this.res.children[0].firstChild);
        }

        return this;
    }

    instance() {
        return this.res.children[0];
    }

    sticky() {
        this.res.children[0].style.position = "fixed";
        return this;
    }

    font(family) {

        for (var i = 0; i < this.res.children[0].children; i++) {
            this.res.children[0].children[i].style.fontFamily = family;
        }

        return this;
    }



    openSymbol(symbol) {
        this.symbol = symbol;
        return this;
    }


    background(obj) {

        if (!obj.background){
            this.res.children[0].style.backgroundColor = "transparent";
            return this;
        }
        
        this.res.children[0].style.backgroundColor = obj.color;
        this.res.children[0].style.opacity = obj.opacity;
        return this;
    }

    transluescent() {
        this.res.children[0].style.backgroundColor = "rgba(255,255,255,0.72)";
        return this;
    }


    keepItem(item) {
      //  console.log("Wow");
        this.keepItem = item;
        return this;
    }

    addHamburger = () => {



        let media2 = window.matchMedia(`(max-device-width: 415px)`);

        var btn = document.createElement("button");
        btn.setAttribute("id", "hamburger");
        btn.style.border = "none";
        btn.style.fontWeight = "bold";
        btn.style.position = "absolute"; // NEW
        btn.style.color = "orange";//this.obj.hamColour.opened; //this.hamburgerColour ?? "#3498db";
        btn.style.backgroundColor = "transparent";
        btn.style.fontSize = media2.matches ? "2.1em" : "2em";

        var node = document.createTextNode(this.symbol ? this.symbol : "☰");
        btn.appendChild(node);
        btn.style.marginLeft = "auto";

        this.isShown = false;

        btn.addEventListener("click", () => {

            
            this.isShown = !this.isShown;

            this.hasAnimatedToWide = false;

         //   alert("Hello");
          // alert(this.res.children[0].children[1].children[0].getAttribute("id"));

          // zmenším, otevřu, roztáhnu, zmenším => musím klinout 2x
          // zmenším => kliknu => animace se rozjede 2x

          // mám rotažené => zmenším, a při otevření se mi animace rozjede 2x

          // When onResize < 400px the nav must disappear


          let animationObj = this.items[0].options;


          if (animationObj && animationObj.animation){

          
          let animation = animationObj.animation.op;
       //   console.log(animation);

          



            const innerItemsWrapper = this.res.children[0].children[1].children[0];
               
            if (animation){

              

             //   console.log("Why not showing on 600px????");
             //   console.log(this.isShown);

               if (this.isShown){





                for (var i = 0; i < innerItemsWrapper.children.length; i++){
                    let inner = innerItemsWrapper.children[i];
                    let anima = inner.animate(animation.keyframesClose,  {
                        duration: 1, // 1 should be acceptable here when I close
                        fill: 'forwards',
                        delay: 0
                    });


                    // 9:16:04 Nice! 21/11/24
                    anima.onfinish = () => {
                        innerItemsWrapper.parentElement.style.display = "block";
                    }
                }


            /*    window.setTimeout(() => {
                    innerItemsWrapper.parentElement.style.display = "block";
                }, 50);*/






              
               } else { // culprit??? not 565 533
                innerItemsWrapper.parentElement.style.display = "none";
               }

                for (var i = 0; i < innerItemsWrapper.children.length; i++){
                    let inner = innerItemsWrapper.children[i];


                    
                    inner.animate(animation.keyframesClose,  {
                        duration: 1, // 1 should be acceptable here when I close
                        fill: 'forwards',
                        delay: 0
                    });


                    if (this.isShown){
                       
                       // if (inner.style.translateX != 0)
                        inner.animate(animation.keyframesOpen, animation.openOptions);
                    } else {
                        inner.animate(animation.keyframesClose, animation.closeOptions);
                    }
                }

         
               
            } 

        } else {
            if (this.isShown){
                innerItemsWrapper.parentElement.style.display = "block";
                } else {
                 innerItemsWrapper.parentElement.style.display = "none";
                }
        }


            // Hide outerItemsWrapper or animate links
        })

       // let hamb = document.querySelector("#hamburger");
      //  alert(this.res.children[0].children[0].getAttribute("id"));

        return btn;
    }

    /*--------------------------------------------------ADJUST--------------------------------------------------*/
    // set habmurger icon
    adjust(w) {
        let media = window.matchMedia(`(max-width: 600px)`);
        let media2 = window.matchMedia(`(max-device-width: 415px)`);

        const adjustFontSize = () => {
            //console.log("IN VIEWPORT");

          //  console.log(this.res);
            for (var i = 0; i < this.res.children[0].children.length; i++) {
                let el = this.res.children[0].children[i];
                el.style.fontSize = media2.matches ? (this.mobileSize ? this.mobileSize : "1.2em") : (this.desktopSize ? this.desktopSize : "1em");


                if (el.textContent === "☰") {
                    el.style.fontSize = "2em";
                }
            }

          
        }


        const findNestedDivWithId = (elements, targetId)  => {
            for (var i = 0; i < elements.length; i++) {
                var element = elements[i];
        
                if (element.id === targetId) {
                    return element; // Found the target div
                }
        
                // Check nested children recursively
                var foundInChildren = findNestedDivWithId(element.children, targetId);
                if (foundInChildren) {
                    return foundInChildren;
                }
            }
            return null; // If not found
        }

        const toWideScreen = () => { 


            let my = this.res.children[0];

















           


            for (var i = 0; i < this.res.children[0].children.length; i++) {

                let child = this.res.children[0].children[i];

                child.style.marginTop = "0em";

                if (child.id === "WR") {
                    child.style.display = "flex";
                } else {
                    child.style.display = "flex";
                }

                if (child.textContent === this.titleText && this.titleText.length > 0) {
                  //  alert(child.textContent)
                    child.style.fontSize = "2em";
                }
            }




            // animate back

            let animationObj = this.items[0].options;


            if (animationObj && animationObj.animation){

          
                let animation = animationObj.animation.op;
               // console.log(animation);

            



            const covid = this.res.children[0];
            const innerItemsWrapper = covid.children[1].children[0];
            //findNestedDivWithId(this.res.children, 'innerItemsWrapper');
            ///covid.children[0].children[1].children[0];

          //  console.log("KINNERA");
          //  console.log(innerItemsWrapper);

          //  console.log("COVID");
         //   console.log(covid);
           // innerItemsWrapper.style.border = "3px solid orange";
            innerItemsWrapper.style.marginTop = "0";
               
            if (animation){
              //  console.log("Why not showing on 600px????")
              //  console.log("TOWIDE");


               // console.log(covid);
               // console.log(covid.children[1].children[0]);
             
              // alert("OIJHIOHO")

               // close the nav an expand bad

               if (!this.hasAnimatedToWide){
                this.hasAnimatedToWide = true;

                for (var i = 0; i < innerItemsWrapper.children.length; i++){

                   let link = innerItemsWrapper.children[i];

      

                   
                   link.animate(animation.keyframesOpen, animation.openOptions);
                   
                }
            }


            }


        } else {
           // alert("/");
           console.log(this.res);
          //   const innerItemsWrapper = this.res.children[0].children[0].children[0];//findNestedDivWithId(this.res.children, 'innerItemsWrapper');
         //   innerItemsWrapper.style.marginTop = "0";
           // const innerItemsWrapper = findNestedDivWithId(this.res.children, 'innerItemsWrapper');
          //  innerItemsWrapper.style.marginTop = "0";
        }






















        }

        // nice library!
        const doInAdjust = () => {

            this.isShown = false;


            let my = this.res.children[0];

     
            adjustFontSize();
            var closed = false;


            this.res.children[0].style.flexDirection = "column";

            for (var i = 0; i < this.res.children[0].children.length; i++) {
                if (this.res.children[0].children[i].textContent == "☰" || this.res.children[0].children[i].textContent == /*"Lands"*/ this.keepItem) {


                    let child = this.res.children[0].children[i];
                    if (child.id === "WR") {
                        this.res.children[0].children[i].style.display = "flex";
                    } else {
                        this.res.children[0].children[i].style.display = "flex";
                    }



                } else {
                    this.res.children[0].children[i].style.display = "none";
                }
            }
        }

        const adjust = () => {
            if (!this.obj.isSide) {
                if (media.matches || media2.matches) {
                   

                    
                    doInAdjust();
                    
                } else {
                    toWideScreen();
                }
            }


        }


        if (!this.obj.isSide) {

            let inner = this.res.children[1]; //document.querySelector("#outerItemsWrapper")
            if (inner != null) {
                inner.style.background = "yellow";
            }

            if (media.matches || media2.matches) {
                doInAdjust();
                //alert("P")
                //this.res.children[0].style.opacity = 0.3;
             //   console.log("884A");
             //   console.warn(this.res);
             //   console.log(this.res.children[0].children[0]);
            } else {
                toWideScreen();
            }
        } else {
            doInAdjust();
        }


        // was double anim once we commented this out
      //  this.hasAnimatedToWide = false;
      //  window.addEventListener("resize", adjust);
        return this;
    }

    /*--------------------------------------------------ADJUST--------------------------------------------------*/
    render(div) {


        const method = () => {
            let media = window.matchMedia(`(max-width: 600px)`);

            // This gets owervwritten, column fires

            let myMedia = window.matchMedia(`(max-device-width: 415px)`);
            let outerItemsWrapper = this.res.children[0].children[1];
            let innerIW = outerItemsWrapper.children[0];

           // console.log("TEETH");
           // console.log(outerItemsWrapper);
           // console.log(innerIW);


            if (myMedia.matches) {
                innerIW.style.position = "relative";
            }



            if ((media.matches || myMedia.matches) && innerIW != undefined) {
                //alert("PP")
                innerIW.style.flexDirection = "column";
            } else if (innerIW != undefined && !this.obj.isSide) {
                innerIW.style.flexDirection = "row";
            }

            if (!this.obj.isSide && !media.matches && !myMedia.matches) {
                this.res.children[0].children[0].style.display = "none";
            }


            if (this.obj.isSide) {
                innerIW.style.flexDirection = "column";
            }

            if (!this.obj.isSide && !media.matches) {
                this.res.children[0].style.position = "relative";
                outerItemsWrapper.style.transform = "translateY(0px)";
            }

            if (!this.obj.isSide && media.matches) {
               // this.res.children[0].style.position = "absolute";
            }


            // my custom

            if (this.obj.customStyle){
              //  this.res.children[0].children[1].children[0].style.width = "200px";
                this.res.children[0].style.marginTop = "1rem";
                this.res.children[0].style.position = "absolute";
                this.res.children[0].style.borderRadius = "1rem";
               outerItemsWrapper.style.borderRadius = "1rem";
          
            }


            // Add line 700
            if (this.obj.radius){
                //  this.res.children[0].children[1].children[0].style.width = "200px";
              //  alert("P")

              // Both need to be like this
              this.res.children[0].style.borderRadius = "1rem";
                 outerItemsWrapper.style.borderRadius = "1rem";
                
              }
        }

        window.addEventListener("resize", () => method());
        method();

        if (div) {
            document.querySelector(div).style.padding = 0;
            document.querySelector(div).style.margin = 0;
            document.querySelector(div).appendChild(this.res);
        } else {
            return this.res; //.children[0];
        }
        return this.res; //.children[0];
    }
}

// If I shrink window and open the nav animates 2x

export { UINavBar };
