


function convertRange(value, oldRange, newRange) {
    let val = ((value - oldRange.min) * (newRange.max - newRange.min)) / (oldRange.max - oldRange.min) + newRange.min;

    if (val > 1) {
        val = 2 - val;
    }

    return val;
}

class TransformAnim { // 133506
    constructor(data) {
        this.data = data;
        this.targetHeight = this.data.targetHeight;
        if (this.data.type === undefined) {
            this.type = "default";
        } else {
            this.type = this.data.type;
        }

       // this.id = this.data.identifiers.wrapDIV;
        this.layout = "flex";
        this.setup();
    }

toCode(){
    return [""];
}
    set(obj){
        console.log("WHY NOT 900")
// alert(this.res.style.height);
        obj.arrayPadding && (this.wrdiv.style.marginTop = obj.arrayPadding.value /*this.res.style.height*/);
        obj.height && (this.wrdiv.style.height = obj.height);
        return this;
    }

    setup() {
      //  this.fireDist = this.data.fireDist;

        // I need two
        let wrapDiv = document.createElement("div");
        this.wrdiv = wrapDiv;
        wrapDiv.style.display = "flex";
        wrapDiv.style.flexDirection = "column";

        if (this.data.overflow){
            wrapDiv.style.overflow = "hidden";
        }

       // wrapDiv.setAttribute("id", this.data.identifiers.wrapDIV);
        wrapDiv.style.display = "flex";
        wrapDiv.style.justifyContent = "center";
        wrapDiv.style.alignItems = "center";
        wrapDiv.style.background = "orange";
      //  wrapDiv.style.height = "100vh"; // Keep this
      wrapDiv.style.height = "900px"; // same as paddingTop
      

        if (!this.data.sticky) {
           
              wrapDiv.style.position = "fixed";
        }

        wrapDiv.style.marginTop = "0px";


      

        let img = document.createElement("img");
        img.style.gridArea = "1/1";
        img.style.display = "none";
        img.style.width = "50%";
        img.setAttribute("src", "M2.jpeg");
        img.setAttribute("class", "m2");
       // img.setAttribute("id", this.data.identifiers.imageID);
      //  img.style.transform = `scale(1.5)`;
        wrapDiv.appendChild(img);
        

        if (this.data.view){
            // wrapDiv.appendChild(this.data.view.render());

             this.m2img = this.data.view.render();
             wrapDiv.appendChild(this.m2img);
          
          }

          if (this.data.paragraph){
            this.paragraph = this.data.paragraph.render();
            wrapDiv.appendChild(this.paragraph);
          }

        if (this.data.view){
            img.style.display = "none";
          //  img.style.opacity = 0;
        }

        let h2 = document.createElement("h2");
      //  h2.setAttribute("id", this.data.identifiers.headerID);
        // h2.setAttribute("id", "header");
        h2.style.fontFamily = "Arial";
        h2.style.fontSize = "2.4rem";
        h2.style.background = "linear-gradient(#3498db, #1abc9c)";
        h2.style.webkitBackgroundClip = "text";
        h2.style.webkitTextFillColor = "transparent"; // 222318

        let node = document.createTextNode("Supercharged");
        h2.appendChild(node);

        if (this.data.showTitle === true || this.data.showTitle === undefined){
    
    if (this.data.content && this.data.content.render){
        wrapDiv.appendChild(this.data.content.render());
    } else {
        wrapDiv.appendChild(h2);
    }
            //  wrapDiv.appendChild(h2);
        }


        let p = document.createElement("p");
        let pn = document.createTextNode("Hello");
       // p.appendChild(pn);



        wrapDiv.appendChild(p);

        this.res = wrapDiv;

        window.addEventListener("scroll", (e) => this.resize(wrapDiv, img, h2));
        this.resize(wrapDiv, img, h2);
    }

    setStickyData(obj){
        this.data.stickyData = obj;
        return this;
    }


    toAuto(){
        // M3 Max won't fit no 100vh
        this.res.style.height = "auto";
        return this;
    }


    stick(obj){
        if (!obj){
            this.makeSticky();
            return this;
        }


        if (obj.offset){
            if (this.data.stickyData != undefined){
               // alert(topOffset);
               this.data.stickyData.top = obj.offset;
              
            } else {
                this.data.stickyData = {top: obj.offset};
                this.fixedToRelative(true); // inner method

            }
        }

        if (obj.value){
            this.makeSticky();
        } else {
            this.noSticky();
        }

        return this;
    }

    makeSticky(){
        this.wrdiv.style.position = "sticky";
        this.wrdiv.style.top = 0;

        // 22:23:18 Yes!!!
        // 22:23:39 mobile
        //this.wrdiv.style.marginTop = "800px";
        return this;
    }


    setProps(obj){

        if (obj.targetHeight){
            this.data.targetHeight = obj.targetHeight;
        }
      

        if (obj.flagValue){
            this.data.flagValue = obj.flagValue;
        }
       
        return this;
       /* targetHeight: 600, 
        flagValue: 3700,*/
    }


    noSticky(){
       // this.wrdiv.style.display = "none";
    // this.wrdiv.style.filter = "grayscale(1)";
        this.wrdiv.style.position = "";
        return this;
    }

    toSticky(){
        this.wrdiv.style.position = "sticky";
        this.wrdiv.style.top = "0";
        return this;
    }

    toOpacity(opacity){
        this.res.style.opacity = `${opacity}`;
    }

    setUncomment(value){
        this.data.uncomment = value;
    }

    fixedToRelative(value){
        this.data.uncomment = value;
        return this;
    }







    mask(data){
        window.addEventListener("scroll", () => {
            this.innerMask(data);
        });

        return this;
    }

    innerMask(data){
        if (data){
             
               let smart = smartRange(window.scrollY, {min: data.start, max: data.end}, {min: 7, max: 0}) // The other way
                console.warn(smart);
                console.warn(window.scrollY);
               // this.res.style.opacity = 0.7;


              // let smart = smartRange(window.scrollY, { min: data.start, max: data.end }, { min: 0, max: 7 }) // The other way
               let radius = smartRange(window.scrollY, { min: data.start, max: data.end }, { min: 37, max: 37 }) // both are 20 to stay round
              // this.res.style.clipPath = `inset(${smart}% ${smart}% round ${radius}px ${radius}px 0 0)`;
            
            
            
            
               // this.res.style.clipPath = `inset(${smart}% ${smart}% round 20px)`;
              //  console.log(`SMART: ${smart}`);
              //  console.log(this.textOpacity);




             // this.res.style.backgroundColor = "orange";

              /*  if (!this.hasH2){
                    let grayBack = document.createElement("div");
                    grayBack.style.background = "#ecf0f1";
                    grayBack.style.width = "86%";
                    grayBack.style.marginLeft = "7%";
                    grayBack.style.borderRadius = "1rem";

                this.hasH2 = true;
                grayBack.appendChild(this.data.newSection.render());
                rem.parentElement.appendChild(grayBack);
                }*/
        }


        return this;
    }

    setScale(obj){
//alert("///")
        /*
        range: {
            min: 0,
            max: 750,
            scaleMin: 0.67,
            scaleMax: 2.4
        },
        */

       // alert("J");
        this.data.range = obj;

        this.m2img.style.transform = `scale(${this.data.range.scaleMax})`;

window.addEventListener("scroll", () => {
    let resa = smartRange(window.scrollY, {
        min: this.data.range.min,
        max: this.data.range.max // has to be switched
    }, {
        min: this.data.range.scaleMax,
        max: this.data.range.scaleMin
    });

    if (this.m2img != undefined) {
           this.m2img.style.transform = `scale(${resa})`;
        }

});
       
return this;

    }

    

    

    resize(wrapDiv, img, h2){
        let st = window.scrollY || document.documentElement.scrollTop; // Credits: "https://github.com/qeremy/so/blob/master/so.dom.js#L426"
            if (st > this.lastScrollTop) {
                this.isUp = false;
            } else {
                this.isUp = true;
            }


         //   console.log(window.scrollY);


           // let wrapDiv =document.querySelector(`#${this.data.identifiers.wrapDIV}`);

           // let magicNumber = this.fireDist + 110;

         
           if (!this.data.sticky){


            if (this.data.stickyData){
               // console.log(this.data.stickyData.top);

                const top = this.data.stickyData.top; //800;
     
            
                // UNCOMMENT HERE

            

                if (this.data.uncomment) {
                    if (window.scrollY > top) { // MAKE THIS ADJUSTABLE
                        wrapDiv.style.background = "pink";
                        wrapDiv.style.position = "relative";
                        wrapDiv.style.top = top; // FIX HERE
                    } else {
                        wrapDiv.style.background = "orange";
                        wrapDiv.style.top = 0;
                        wrapDiv.style.position = "fixed";
                    }
                }

               

        }



        } else {
            wrapDiv.style.background = "#fafafa";
          //  wrapDiv.style.position = "relative"; UNCOMMENT ???
          //  wrapDiv.style.height = "100vh";
           // wrapDiv.style.marginTop = "900px"; // 17:09:46 Nice!!! 
           // After Psyche launch
        }

           // 15:19:50 Nice!!!



         /*   if (wrapDiv) {
                if (window.scrollY > this.data.distanceObject.scrollUpper) {
                    if (wrapDiv) {
                        wrapDiv.style.background = "pink";
                        wrapDiv.style.position = "relative";
                        wrapDiv.style.top = `${this.data.distanceObject.scrollUpper}px`;
                        h2.textContent = "Always";
                    }
                } else if (window.scrollY < this.data.distanceObject.scrollUpper && this.isUp) {
                    wrapDiv.style.background = "orange";
                    wrapDiv.style.top = "0px";
                    wrapDiv.style.position = "fixed";
                }
            } */


           

            this.lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling

            let hTwo = wrapDiv;
          /*  let elHeight = this.data.targetHeight;
            let begin = elHeight - 250;
            let end = elHeight + 250;*/

           /* let resa = smartRange(window.scrollY, {
                min: this.data.range.min,
                max: this.data.range.max // has to be switched
            }, {
                min: this.data.range.scaleMax,
                max: this.data.range.scaleMin
            });
*/
            let m2img = img;
            let header = h2;

            this.m2img = img;
            
            if (this.data.view){
                m2img = this.m2img;
            }


            if (m2img != undefined) {
            //    m2img.style.transform = `scale(${resa})`;
            }


            let translated = smartRange(window.scrollY, {
                min: 3150,
                max: 3300 // has to be switched
            }, {
                min: 0,
                max: 100
            });

            let translateScale = smartRange(window.scrollY, {
                min: 3150,
                max: 3300 // has to be switched
            }, {
                min: 60,
                max: 80
            });

            let rotateScale = smartRange(window.scrollY, {
                min: 3150,
                max: 3300 // has to be switched
            }, {
                min: 0,
                max: 40
            });



          //  console.warn(translateScale);


            if (this.data.operation){
                if (this.data.operation.type === "translate"){
                    m2img.style.transform = `translate3d(${translated}%, ${translated / 2}%, 0px) scale(${translateScale / 100}) rotate(${rotateScale}deg)`;
                  //  alert("I")
                }
            }
    }


    render(id) {
        if (id) {
            document.querySelector(id).appendChild(this.res);
        } else {
            return this.res;
        }
    }
}


function smartRange(val, from, to) {

    if (val < from.min) {
        val = from.min;
    }

    if (val > from.max) {
        val = from.max;
    }

    let percent = (val - from.min) / (from.max - from.min);

    if (from.min > from.max) {
        percent = (val - from.max) / (from.min - from.max);
    }

    let toRange = (to.min - to.max) * percent - to.min;
    toRange = Math.abs(toRange);

    if (to.min < to.max) {
        let sm = to.max + Math.abs(to.min);
        let timesPerc = sm * percent;
        toRange = to.min + timesPerc;
    }


    return toRange;
}


export {TransformAnim};