
class KeyframeAnim {
    constructor(data) {
        this.fromFirstImageFlag = false;
        this.flag = 0;
        this.flagValue = data.flagValue;
        this.data = data;
        this.mask = data.mask; // overwrites method
        this.maskData = data.maskData;
        this.id = data.id;

        this.halfHeight = data.halfHeight;
        if (this.data.type === undefined){
            this.type = "default";
        } else {
            this.type = this.data.type;
        }

        this.stickData = data.stickData;
        this.targetHeight = this.data.targetHeight;
        this.html = document.body;
        this.res = document.createElement("div"); // stack
        this.res.setAttribute("id", this.data.id);
        this.res.style.border = "1px solid green";
        this.res.style.width = "100%";
        this.res.style.display = "grid";

        //
       this.res.style.position = "sticky";// removed
        this.res.style.top = 0;
        this.res.style.alignSelf = "flex-start";

        this.res.style.justifyContent = "center";
        this.res.style.alignItems = "center";


        // Added

       
        if (!this.data.added){ // Nice effect with false
            this.res.style.marginTop = this.data.noAddedDistance; //"800px";
        }
       

        this.frameCount = 100; // 100





        this.lastScrollTop = window.scrollY;
        // modrý a bez kroužku
        this.setupTopElement();
        this.scrollFunction();

        

        window.addEventListener('scroll', () => {
            this.scrollFunction();
        });

        this.preloadImages();
        return this;
    }


    marginTop(data){
       // this.data.noAddedDistance = data;
        this.res.style.marginTop = data;
        return this;
    }

    toCode(){
        return [""];
    }

    scrollFunction = () => {
       // alert(this.flagValue);

     //  console.log(this.flagValue);

       if (this.flagValue === undefined){
        this.flagValue = 0;
       }

        var scrollTop = this.html.scrollTop - /*1700*/ this.flagValue;
        var maxScrollTop = this.html.scrollHeight - window.innerHeight;

        const scrollFraction = scrollTop / maxScrollTop * 16 /** 16*/ ; // TIMES 5 Speeds up the animation
        var frameIndex = Math.min(
            this.frameCount - 1,
            Math.ceil(scrollFraction * this.frameCount)
        );

      /*  if (frameIndex === 99) {
            frameIndex -= 99;
        }*/

        if (isNaN(frameIndex)) {
            frameIndex = 1;
        }

        if (frameIndex < 0){
            frameIndex = 0;
        }

      //  console.log(frameIndex);

        if (this.data.limit){
            
            if (frameIndex < this.data.limit){
               // console.log(frameIndex)
              //  console.log("MY Frame index is" + frameIndex);
                requestAnimationFrame(() => this.updateImage(frameIndex + 1));
            }
        } else {
                requestAnimationFrame(() => this.updateImage(frameIndex + 1));
        }


		let query = window.matchMedia("(max-device-width: 415px)");


        // Apple website does not transition...
       /* if (query.matches === false){
            if (window.scrollY > 2300){
                this.res.style.position = "relative";
                this.res.style.marginTop = "1300px";
            } else {
                this.res.style.marginTop = "800px";
                this.res.style.position = "sticky";
            }
        }*/

        // scroll less than 2300 and fix next
       
       /* if (window.scrollY > 2300){
            this.res.style.position = "relative";
            this.res.style.marginTop = "1400px";
        } else {
            this.res.style.marginTop = "800px";
            this.res.style.position = "sticky";
        }*/
    }


    currentFrame = index => {
        // https://stackoverflow.com/questions/5417979/batch-rename-sequential-files-by-padding-with-zeroes Thanks !  
        // for f in *.jpg;do n=${f#*_};n=${n%.*};mv $f $(printf "%04d".jpg $n);done
        let res = `${this.data.path}${index.toString().padStart(4, '0')}.${this.data.extension}`;
        return res;
    }

    preloadImages = () => {
        for (let i = 1; i < this.frameCount; i++) {
            const img = new Image();
            this.img.src = this.currentFrame(i);
        }
    };

    updateImage = index => {
      //  console.log(index);

        this.img.src = this.currentFrame(index);

     /*   if (window.scrollY > 20 && index > 98){
            this.res.style.position = "relative";
            this.res.style.marginTop = "420px"; 
        } */
        
         /* if (window.scrollY < 620 && this.isUp){ // 163408 okay, get exact value
             this.res.style.position = "fixed";
            this.res.style.marginTop = "0px";
          }*/


          // WILL NOT WORK
       /*   if (window.scrollY > 1370 && !this.isUp){ 
             this.res.style.position = "fixed";
             this.res.style.marginTop = "0px";
          } // 17:12:25 08/10/23 afetr win UH nice!
      


          if (window.scrollY <= 1370 && this.isUp){ 
            this.res.style.position = "relative";
            this.res.style.marginTop = "800px";
         } // 21:55:43 Nice !!!
*/
         // 22:20:50 developer tools change the necessary window.scrollY value
    }


   


     drawImageProp(ctx, img, x, y, w, h, offsetX, offsetY) {

if (arguments.length === 2) {
    x = y = 0;
    w = ctx.canvas.width;
    h = ctx.canvas.height;
}

// default offset is center
offsetX = typeof offsetX === "number" ? offsetX : 0.5;
offsetY = typeof offsetY === "number" ? offsetY : 0.5;

// keep bounds [0.0, 1.0]
if (offsetX < 0) offsetX = 0;
if (offsetY < 0) offsetY = 0;
if (offsetX > 1) offsetX = 1;
if (offsetY > 1) offsetY = 1;

var iw = img.width,
    ih = img.height,
    r = Math.min(w / iw, h / ih),
    nw = iw * r,   // new prop. width
    nh = ih * r,   // new prop. height
    cx, cy, cw, ch, ar = 1;

// decide which gap to fill    
if (nw < w) ar = w / nw;                             
if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh;  // updated
nw *= ar;
nh *= ar;

// calc source rectangle
cw = iw / (nw / w);
ch = ih / (nh / h);

cx = (iw - cw) * offsetX;
cy = (ih - ch) * offsetY;

// make sure source rectangle is valid
if (cx < 0) cx = 0;
if (cy < 0) cy = 0;
if (cw > iw) cw = iw;
if (ch > ih) ch = ih;

console.log("WEIRD")
console.log(img);
console.log(cy);
console.log(cw);
// fill image in dest. rectangle
ctx.drawImage(img, cx, cy, cw, ch,  x, y, w, h);
}


maska(data){
    window.addEventListener("scroll", () => {
        this.innerMask(data);
    });

    return this;
}

    innerMask(data) {
        if (data) {
            let smart = smartRange(window.scrollY, { min: data.start, max: data.end }, { min: 0, max: 7 }) // The other way
            let radius = smartRange(window.scrollY, { min: data.start, max: data.end }, { min: 37, max: 37 }) // both are 20 to stay round
            this.res.style.clipPath = `inset(${smart}% ${smart}% round 0 0 ${radius}px ${radius}px)`;
        }
    }

    setupTopElement() {
    // If we scroll further after seeing topElement
    console.warn("TOP INIT");



        // 1 - Set up the stack
        // 2 - Set up bottom elements
        let fixTop = document.createElement("canvas");
        
        fixTop.style.gridArea = "1/1";
        fixTop.zIndex = 1;
        fixTop.style.display = "grid";
        fixTop.style.gridTemplate = "1fr/1fr";
        fixTop.style.justifyContent = "center";
        fixTop.style.alignItems = "center";
        fixTop.style.marginLeft = "auto";
        fixTop.style.marginRight = "auto";
        // fixTop.style.width = "100%";


        this.context = fixTop.getContext("2d");

        // 1158; WAS GOOD
        this.context.canvas.width = window.innerWidth; //document.body.clientWidth; // Make this responsive
        this.context.canvas.height = window.innerHeight * 1.2; //window.innerWidth / 1.77778;
      

    
       
        this.img = new Image();

        this.img.onload = () => {
                if (this.data.halfHeight){
                   this.drawImageProp(this.context, this.img, 0, 0, window.innerWidth, window.innerHeight / 2);
                } else {
                    this.drawImageProp(this.context, this.img, 0, 0, window.innerWidth, window.innerHeight * 1.2);
                }
             }


             // 11:41:33 Nice!
             // 17/10/2023
             // M2 iPad Air and iPad (11th gen) are coming today!
             window.addEventListener("resize", () => {
                this.context.canvas.width = window.innerWidth; //document.body.clientWidth; // Make this responsive
                this.context.canvas.height = window.innerHeight * 1.2; //window.innerWidth / 1.77778;
                this.drawImageProp(this.context, this.img, 0, 0, window.innerWidth, window.innerHeight * 1.2);
            });

        // https://twitter.com/L0vetodream/status/1240753794037600256

        // git reflog 180427 git reset HEAD@{index}
        this.res.appendChild(fixTop);
        if (this.data.text) {
            let wrap = document.createElement("div");
            wrap.style.gridArea = "1/1";

            let el = this.data.text.render();
            this.h2a = el;
            wrap.appendChild(el);
            wrap.setAttribute("id", "rem");





            if (this.data.hasRect) {
                let e = document.createElement("div");
                e.style.width = "30px";
                e.style.height = "30px";
                e.style.backgroundColor = "orange";
            } else {
                for (var i = 0; i < this.res.children.length; i++) {
                    if (this.res.children[i].id === "rem") {
                        this.res.removeChild(this.res.children[i]);
                    }

                }
            }

            this.res.appendChild(wrap);
        }

        this.lastScrollTop = 0;
        this.count = 1;
        this.isUp = false;
        this.done = false;
        this.fireOnce = true;
        this.dec = 1.0;
        this.tdec = 1.0;
        this.atdec = 0.0;
        this.textOpacity = 1.0;

        let hTwo = this.res.children[this.res.children.length - 1].children[0];
     //   hTwo.opacity = 0;
        hTwo.style.opacity = 0;




        if (this.data.text){

        
        window.addEventListener("scroll", () => {
            this.h2a.style.backgroundColor = "rgba(0, 0, 0, 0.8)"; //"black";
           this.h2a.style.opacity = 1;


           /* let offset = smartRange(window.scrollY, {
              //  min: this.data.lazyText.start,
               // max: this.data.lazyText.end
               min: 6180,
               max: 8000
            }, {
                min: 0,
                max: 200
            }); // 175
    
    
            let opacity = smartRange(window.scrollY, {
               // min: this.data.lazyText.start,
               // max: this.data.lazyText.end
               min: 6180, // variable args
                max: 8000
            }, {
                min: 0,
                max: 1
            }); // 175
    */
    // div below #rem has opacity 0
    
    
        /*   for (var i = 0; i <  this.h2a.children[0].children.length; i++){
                console.log("P")
                this.h2a.children[0].children[i].style.transform = `matrix(1, 0, 0, 1, 0, -${offset})`;
                this.h2a.children[0].children[i].style.opacity = `${opacity - i * 0.2}`;
            }*/

         //   this.h2a.style.transform = "matrix("
         // transform: matrix(1, 0, 0, 1, 0, 15.2135);


      /*   let offset = smartRange(window.scrollY, {
            min: 3750,
            max: 4000
        }, {
            min: 0,
            max: 200
        }); // 175


        let opacity = smartRange(window.scrollY, {
            min: 3750,
            max: 4200
        }, {
            min: 0,
            max: 1
        }); // 175




        for (var i = 0; i <  this.h2a.children[0].children.length; i++){
            this.h2a.children[0].children[i].style.transform = `matrix(1, 0, 0, 1, 0, -${offset})`;
            this.h2a.children[0].children[i].style.opacity = `${opacity - i * 0.2}`;
        }*/
       // this.h2a.children[0].children[1].style.backgroundColor = "orange";

       //  this.h2a.children[0].style.transform = `matrix(1, 0, 0, 1, 0, -${offset})`;

           // height here
            // 1800-2200

         /*   let res = smartRange(window.scrollY, {
               // min: 1800,
              //  max: 2200
            //  min: 30,
             // max: 800

             min: this.data.opacityRange.start,
             max: this.data.opacityRange.end
            }, {
                min: 0,
                max: 1
            }); // 175*/

         //   console.log(res);


           
           
           
           // this.h2a.style.opacity = res;
        });
    }







        window.addEventListener("scroll", (e) => {
        
          
// newly added
            if (this.data.stickyData){
                if (this.data.stickyData.top){
            const top = this.data.stickyData.top; //800;
     
            
            // UNCOMMENT HERE

           // alert(wrapDiv);
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

        }
            

          //  console.log(window.scrollY);

            let st = window.scrollY || document.documentElement.scrollTop; 
            if (st > this.lastScrollTop) {
                this.isUp = false;
            } else {
                this.isUp = true;
            }

            this.lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling

            if (this.isUp) {
                if (this.textOpacity < 0.98) {
                    this.textOpacity += 0.01;
                }
            }

            if (this.isUp === false) {
                if (this.textOpacity > 0.02) {
                    this.textOpacity -= 0.01;
                }
            }

            if (this.data.mask){
           
                let rem = this.res; //document.querySelector("#beauty");
      
                   let smart = smartRange(window.scrollY, {/*min: 2189, max: 2900*/ min: this.data.maskData.start, max: this.data.maskData.end}, {min: 0, max: 7} )
                   rem.style.clipPath = `inset(${smart}% ${smart}% round 20px)`;
                  //  console.log(`SMART: ${smart}`);
                  //  console.log(this.textOpacity);


                    if (!this.hasH2){
                        let grayBack = document.createElement("div");
                        grayBack.style.background = "#ecf0f1";
                        grayBack.style.width = "86%";
                        grayBack.style.marginLeft = "7%";
                        grayBack.style.borderRadius = "1rem";

                    this.hasH2 = true;
                    grayBack.appendChild(this.data.newSection.render());
                    rem.parentElement.appendChild(grayBack);
                    }
            }

            // 22:09:11 Code design object
            let elHeight = this.data.targetHeight;
            let begin = elHeight - 250;
            let end = elHeight + 250;

          /*  let res = sm(st + begin, {
                min: begin,
                max: end
            }, {
                min: 0,
                max: 2
            }); // 175

            if (res < -0.3) {
                res = Math.abs(res);
            }

            if (this.data.animation != "float") {
                hTwo.style.opacity = `${res}`;
            }*/


        });
    }


    

    setLazyText(obj){
        this.lazyText= obj;

     
        window.addEventListener("scroll", () => {
            let offset = smartRange(window.scrollY, {
                min: this.lazyText.start,
                max: this.lazyText.end
              //  min: 6180,
              //  max: 8000
            }, {
                min: 0,
                max: 200
            }); // 175
    
    
            let opacity = smartRange(window.scrollY, {
                min: this.lazyText.start,
                max: this.lazyText.end
              //  min: 6180, // variable args
               // max: 8000
            }, {
                min: 0,
                max: 1
            }); // 175
    
    // div below #rem has opacity 0
    
    
            for (var i = 0; i <  this.h2a.children[0].children.length; i++){
                console.log("P")
                this.h2a.children[0].children[i].style.transform = `matrix(1, 0, 0, 1, 0, -${offset})`;
                this.h2a.children[0].children[i].style.opacity = `${opacity - i * 0.2}`;
            }

        });


        return this;
    }

    setProps(obj){

        if (obj.targetHeight){
            this.data.targetHeight = obj.targetHeight;
        }
      

        if (obj.flagValue){
           // alert(obj.flagValue);
            this.flagValue = obj.flagValue;
        }
       
        return this;
       /* targetHeight: 600, 
        flagValue: 3700,*/
    }


    fixedToRelative(value){
        this.data.uncomment = value;
    }

    toSticky(){
        this.res.style.position = "sticky";
        this.res.style.top = "0";
        return this;
    }

    setOpacityRange(range){
        this.data.opacityRange = range.opacityRange;
        this.data.scaleRange = range.scaleRange;
        // 1800 and 2200 scale


        window.addEventListener("scroll", () => {
            let res = smartRange(window.scrollY, {
                // min: 1800,
               //  max: 2200
             //  min: 30,
              // max: 800
    
              min: this.data.opacityRange.start,
              max: this.data.opacityRange.end
             }, {
                 min: 0,
                 max: 1
             }); // 175


             this.h2a.style.opacity = res;


             let scale = smartRange(window.scrollY, {
                min: this.data.scaleRange.start,
                max:  this.data.scaleRange.end,
            }, {
                min: 3,
                max: 1
            }); // 175

         /*   let scaleChip = smartRange(window.scrollY, {
                min: 1800,
                max: 2200
            }, {
                min: 3,
                max: 0.6
            }); // 175
*/
            // Bad on mobile


            // 00:29:51 
            if (!window.matchMedia("(max-device-width: 415px)").matches){
                this.h2a.children[0].style.transform = `scale(${scale})`;
            }

        });

        return this;
  
    }



/*
    stick(value){


        if (topOffset != undefined){

        }

        if (value){
            this.makeSticky();
        } else {
            this.noSticky();
        }
        return this;
    }*/

    stick(obj){
        if (!obj){
            this.makeSticky();
            return this;
        }


        if (obj.offset){
            if (this.data.stickyData != undefined){
              //  alert(topOffset);
               this.data.stickyData.top = obj.offset;
            } else {
                this.data.stickyData = {top: obj.offset};

            }
        }

        if (obj.value){
            this.makeSticky();
        } else {
            this.noSticky();
        }

        return this;
    }

    to100vh(){
        this.res.style.height = "100vh";
    }

    
    makeSticky(){
        this.res.style.position = "sticky";
        this.res.style.top = 0;

        // 22:23:18 Yes!!!
        // 22:23:39 mobile
        //this.wrdiv.style.marginTop = "800px";
        return this;
    }


    noSticky(){
        // this.wrdiv.style.display = "none";
     // this.wrdiv.style.filter = "grayscale(1)";
         this.res.style.position = "";
         return this;
     }
 

    toOpacity(opacity){
        this.res.style.opacity = `${opacity}`;
    }


    render(id) {
       // this.res.style.position = "fixed";
        if (id) {
            document.querySelector(id).appendChild(this.res);
        } else {


            // Move this out to wrapper Layout element
           /* let el = document.createElement("div");
            el.style.height = "2300px";
            this.res.style.height = "100vh";
            el.appendChild(this.res);*/

            return this.res;
        }

    }
}


export {KeyframeAnim};

// http://localhost:64595/designertest/5-CleanScrollAnimation/cleaner-way